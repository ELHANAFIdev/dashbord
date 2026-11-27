'use client';
import type { FeatureCollection } from 'geojson';
import type * as Leaflet from 'leaflet';
import { ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRpc } from '@/client/rpc';
import { useTheme } from '@/client/theme';
import { CATEGORIES_ALL, CATEGORY_INFO } from '@/lib/constants';
import { fmtDec, fmtInt, plural } from '@/lib/format';
import { REGION_CODES, regionKey } from '@/lib/regions';
import type { MapUnit, PopulationRow } from '@/lib/types';
import { CategoryBadge, Chip, DataGate, Field, PageHeader, Panel, Segmented, SkeletonBlock, cx } from '../ui/primitives';
import { RegionSelect } from './shared';

// Emprise nationale (jusqu'à Lagouira) utilisée tant que le fond n'est pas chargé.
const NATIONAL_BOUNDS: [[number, number], [number, number]] = [
  [20.78, -17.1],
  [35.92, -1.0],
];
const ATTRIBUTION = 'Régions : © contributeurs OpenStreetMap (ODbL) · Voisins : Natural Earth';

type Fond = 'simple' | 'choro';
type GeoState = { status: 'loading' | 'ok' | 'missing'; regions?: FeatureCollection; voisins?: FeatureCollection };

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Classes de la choroplèthe : 5 seuils fixes calculés sur les valeurs (quantiles). */
function breaksOf(values: number[]): number[] {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return [];
  return [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.min(v.length - 1, Math.floor(q * v.length))]);
}
function classOf(x: number, breaks: number[]) {
  let i = 0;
  while (i < breaks.length && x >= breaks[i]) i++;
  return i; // 0..4
}
const SEQ = ['--seq-1', '--seq-2', '--seq-3', '--seq-5', '--seq-6'];

function useGeo(): GeoState {
  const [geo, setGeo] = useState<GeoState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    const get = (p: string) => fetch(p).then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null)).catch(() => null);
    Promise.all([get('/geo/maroc_regions.geojson'), get('/geo/maroc_voisins.geojson')]).then(([regions, voisins]) => {
      if (!alive) return;
      setGeo(regions ? { status: 'ok', regions, voisins: voisins ?? undefined } : { status: 'missing' });
    });
    return () => {
      alive = false;
    };
  }, []);
  return geo;
}

function featureRegionName(props: Record<string, unknown> | null | undefined): string {
  const nom = (props?.nom as string) ?? '';
  return nom || REGION_CODES[String(props?.code ?? '')] || '';
}

interface MapProps {
  units: MapUnit[];
  selected: number | null;
  onSelect: (id: number) => void;
  geo: GeoState;
  fond: Fond;
  regionValues: Map<string, number>;
  breaks: number[];
}

function LeafletMap({ units, selected, onSelect, geo, fond, regionValues, breaks }: MapProps) {
  const theme = useTheme();
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const voisinsLayer = useRef<Leaflet.GeoJSON | null>(null);
  const regionsLayer = useRef<Leaflet.GeoJSON | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Création de la carte (sans aucune tuile tierce).
  useEffect(() => {
    let disposed = false;
    import('leaflet').then((mod) => {
      if (disposed || !el.current || map.current) return;
      const lf = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = lf;
      const m = lf.map(el.current, { zoomControl: true, attributionControl: true, minZoom: 4, maxZoom: 11, zoomSnap: 0.25, keyboard: true });
      m.attributionControl.setPrefix(false);
      m.attributionControl.addAttribution(ATTRIBUTION);
      m.fitBounds(NATIONAL_BOUNDS, { padding: [12, 12] });
      m.createPane('voisins').style.zIndex = '350';
      m.createPane('regions').style.zIndex = '360';
      markers.current = lf.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Fond : voisins (terre neutre) puis régions officielles.
  useEffect(() => {
    const lf = L.current;
    const m = map.current;
    if (!ready || !lf || !m || geo.status !== 'ok' || !geo.regions) return;
    voisinsLayer.current?.remove();
    regionsLayer.current?.remove();
    if (geo.voisins) {
      voisinsLayer.current = lf.geoJSON(geo.voisins, { pane: 'voisins', interactive: false, style: () => ({}) }).addTo(m);
    }
    regionsLayer.current = lf
      .geoJSON(geo.regions, {
        pane: 'regions',
        style: () => ({}),
        onEachFeature: (f, layer) => {
          const name = featureRegionName(f.properties as Record<string, unknown>);
          layer.bindTooltip(name, { sticky: true, direction: 'top' });
        },
      })
      .addTo(m);
    const b = regionsLayer.current.getBounds();
    if (b.isValid()) m.fitBounds(b, { padding: [12, 12] });
  }, [ready, geo]);

  // Styles du fond (thème et choroplèthe) : les couleurs SVG doivent être des valeurs, pas des var().
  useEffect(() => {
    if (!ready) return;
    void theme;
    const land = css('--land');
    const landLine = css('--land-line');
    // Voisins : terre neutre, sans aucune frontière dessinée.
    voisinsLayer.current?.setStyle({ fillColor: land, fillOpacity: 1, stroke: false });
    void landLine;
    const seq = SEQ.map(css);
    const fill = css('--region-fill');
    const line = css('--region-line');
    regionsLayer.current?.eachLayer((layer) => {
      const f = (layer as Leaflet.GeoJSON & { feature?: GeoJSON.Feature }).feature;
      const name = featureRegionName(f?.properties as Record<string, unknown>);
      const v = regionValues.get(regionKey(name));
      const color = fond === 'choro' ? (v === undefined ? fill : seq[classOf(v, breaks)]) : fill;
      (layer as Leaflet.Path).setStyle({ fillColor: color, fillOpacity: fond === 'choro' && v !== undefined ? 0.85 : 1, color: line, weight: 0.9 });
      const tipText = fond === 'choro' ? `${name} : ${v === undefined ? 'sans unité' : `${fmtDec(v, 0)} consultations pour 1 000 hab. par an`}` : name;
      (layer as Leaflet.Layer).setTooltipContent(tipText);
    });
  }, [ready, theme, fond, regionValues, breaks, geo]);

  // Marqueurs des unités.
  useEffect(() => {
    const lf = L.current;
    const group = markers.current;
    if (!ready || !lf || !group) return;
    group.clearLayers();
    const ordered = [...units].sort((a, b) => Number(a.centre_id === selected) - Number(b.centre_id === selected));
    for (const u of ordered) {
      if (!Number.isFinite(u.latitude) || !Number.isFinite(u.longitude)) continue;
      const c = (u.category || 'X').toLowerCase();
      const isSel = u.centre_id === selected;
      const size = isSel ? 22 : 17;
      const icon = lf.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span class="unit-marker${u.open_events > 0 ? ' has-alert' : ''}${isSel ? ' is-selected' : ''}" style="width:${size}px;height:${size}px;background:var(--cat-${c});color:var(--cat-${c}-ink)">${u.category}</span>`,
      });
      const mk = lf.marker([u.latitude, u.longitude], {
        icon,
        title: `${u.centre_name}, catégorie ${u.category}${u.open_events ? `, ${u.open_events} alerte(s) ouverte(s)` : ''}`,
        alt: u.centre_name,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: isSel ? 1000 : u.open_events ? 100 : 0,
      });
      mk.on('click', () => onSelectRef.current(u.centre_id));
      mk.on('keypress', (e: Leaflet.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') onSelectRef.current(u.centre_id);
      });
      mk.addTo(group);
    }
  }, [ready, units, selected]);

  return <div ref={el} className="h-full w-full" role="region" aria-label="Carte des unités" />;
}

export function MapView() {
  const map = useRpc<MapUnit[]>('ui_map', {});
  const pop = useRpc<PopulationRow[]>('ui_population', {});
  const geo = useGeo();
  const [region, setRegion] = useState('');
  const [cats, setCats] = useState<Set<string>>(() => new Set(CATEGORIES_ALL));
  const [watchOnly, setWatchOnly] = useState(false);
  const [fond, setFond] = useState<Fond>('simple');
  const [selected, setSelected] = useState<number | null>(null);

  const regions = useMemo(() => [...new Set((map.data ?? []).map((u) => u.region))].sort((a, b) => a.localeCompare(b, 'fr')), [map.data]);
  const filtered = useMemo(
    () =>
      (map.data ?? []).filter(
        (u) => (!region || regionKey(u.region) === regionKey(region)) && cats.has(u.category || 'X') && (!watchOnly || u.attention),
      ),
    [map.data, region, cats, watchOnly],
  );

  // Consultations pour 1 000 habitants par région (somme des provinces couvertes).
  const regionValues = useMemo(() => {
    const acc = new Map<string, { c: number; p: number }>();
    for (const r of pop.data ?? []) {
      const k = regionKey(r.region);
      const a = acc.get(k) ?? { c: 0, p: 0 };
      a.c += r.consultations_12_mois ?? 0;
      a.p += r.population ?? 0;
      acc.set(k, a);
    }
    return new Map([...acc.entries()].filter(([, a]) => a.p > 0).map(([k, a]) => [k, (1000 * a.c) / a.p]));
  }, [pop.data]);
  const breaks = useMemo(() => breaksOf([...regionValues.values()]), [regionValues]);

  const sel = map.data?.find((u) => u.centre_id === selected) ?? null;
  const toggleCat = (c: string) =>
    setCats((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  const present = new Set((map.data ?? []).map((u) => u.category));

  return (
    <>
      <PageHeader title="Carte" description="Position des unités, catégorie et alertes ouvertes, sur le fond des 12 régions officielles du Royaume du Maroc." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[68vh] min-h-[440px] overflow-hidden rounded-[10px] border border-line bg-[color:var(--sea)] shadow-card">
          <DataGate state={map} skeleton={<div className="p-6"><SkeletonBlock rows={6} /></div>}>
            {() => (
              <LeafletMap units={filtered} selected={selected} onSelect={setSelected} geo={geo} fond={fond} regionValues={regionValues} breaks={breaks} />
            )}
          </DataGate>
          {geo.status !== 'ok' && map.data && (
            <p className="absolute left-3 top-3 z-[500] rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-2 shadow-card">
              {geo.status === 'loading' ? 'Fond de carte en cours de chargement' : 'Fond de carte en cours de chargement (fichier des régions indisponible)'}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Filtres" bodyClassName="space-y-4">
            <RegionSelect value={region} onChange={setRegion} regions={regions} />
            <fieldset>
              <legend className="mb-1.5 text-[12px] font-medium text-ink-2">Catégories</legend>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES_ALL.filter((c) => present.has(c) || 'ABCDE'.includes(c)).map((c) => {
                  const on = cats.has(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCat(c)}
                      title={CATEGORY_INFO[c].label}
                      className={cx('rounded-md border p-0.5 transition-opacity', on ? 'border-line-strong' : 'border-transparent opacity-35')}
                    >
                      <CategoryBadge category={c} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={watchOnly} onChange={(e) => setWatchOnly(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              Unités à surveiller uniquement
            </label>
            <Field label="Fond des régions">
              <Segmented<Fond>
                label="Fond des régions"
                value={fond}
                onChange={setFond}
                options={[
                  { value: 'simple', label: 'Simple' },
                  { value: 'choro', label: 'Pour 1 000 hab.' },
                ]}
              />
            </Field>
            {fond === 'choro' && (
              <div>
                <p className="mb-1 text-[12px] text-ink-2">Consultations par an pour 1 000 habitants des provinces couvertes</p>
                {pop.error ? (
                  <p className="text-[12px] text-crit">Population indisponible : {pop.error.message}</p>
                ) : breaks.length ? (
                  <div className="flex items-stretch gap-0.5" aria-hidden="true">
                    {SEQ.map((v, i) => (
                      <div key={v} className="flex-1 text-center">
                        <div className="h-2.5 rounded-sm" style={{ background: `var(${v})` }} />
                        <span className="num text-[11px] text-ink-3">{i === 0 ? '<' : ''}{fmtInt(i === 0 ? breaks[0] : breaks[i - 1])}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SkeletonBlock rows={1} height={10} />
                )}
              </div>
            )}
            <p className="num text-[12px] text-ink-3">{plural(filtered.length, 'unité affichée', 'unités affichées')}</p>
          </Panel>

          <Panel title="Unité sélectionnée">
            {sel ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CategoryBadge category={sel.category} size="lg" />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{sel.centre_name}</p>
                    <p className="text-[13px] text-ink-3">
                      {sel.province}, {sel.region}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[13px]">
                  <div>
                    <dt className="text-ink-3">Moyenne par jour</dt>
                    <dd className="num font-semibold">{fmtDec(sel.mean_value, 1)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Alertes ouvertes</dt>
                    <dd className="num font-semibold">{fmtInt(sel.open_events)}</dd>
                  </div>
                </dl>
                {sel.attention_reason && <Chip tone="warn">{sel.attention_reason}</Chip>}
                <Link
                  href={`/unites/${sel.centre_id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[14px] font-medium text-accent-ink hover:opacity-90"
                >
                  Ouvrir la fiche
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-[13px] text-ink-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Cliquez sur un repère (ou Tab puis Entrée) pour afficher l’unité. Un anneau rouge signale une alerte ouverte.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

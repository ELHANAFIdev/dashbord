'use client';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRpc } from '@/client/rpc';
import { fmtDec, fmtInt, fmtPct, plural, unitName } from '@/lib/format';
import { regionKey } from '@/lib/regions';
import type { CategoryRow, MapUnit } from '@/lib/types';
import { SortableTable, type Column } from '../ui/table';
import { CategoryBadge, Chip, DataGate, EmptyState, Field, PageHeader, Panel, SkeletonBlock, selectClass } from '../ui/primitives';
import { RegionSelect, UnitLink } from './shared';

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <span className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nom, province…"
          className={`${selectClass} w-full pl-8 sm:w-[240px]`}
        />
      </span>
    </Field>
  );
}

const match = (q: string, ...fields: string[]) => {
  if (!q) return true;
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return fields.some((f) => n(f).includes(n(q)));
};

export function RedListView() {
  const list = useRpc<CategoryRow[]>('sup_centre_category_list', { p_attention_only: true });
  const [region, setRegion] = useState('');
  const [q, setQ] = useState('');
  const [horsListe, setHorsListe] = useState(false);
  const nbHorsListe = useMemo(() => (list.data ?? []).filter((r) => r.actif === false).length, [list.data]);
  const regions = useMemo(
    () => [...new Set((list.data ?? []).map((r) => r.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
    [list.data],
  );
  const rows = useMemo(
    () =>
      (list.data ?? []).filter(
        (r) =>
          (horsListe || r.actif !== false) &&
          (!region || regionKey(r.region ?? '') === regionKey(region)) &&
          match(q, unitName(r.centre_name, r.centre_id), r.province ?? ''),
      ),
    [list.data, region, q, horsListe],
  );

  const columns: Column<CategoryRow>[] = [
    {
      key: 'name',
      header: 'Unité',
      sort: (r) => unitName(r.centre_name, r.centre_id),
      render: (r) => (
        <div>
          <UnitLink id={r.centre_id} name={r.centre_name} />
          {(r.province || r.region) && <p className="text-[12px] text-ink-3">{[r.province, r.region].filter(Boolean).join(', ')}</p>}
          {r.actif === false && (
            <p className="mt-1">
              <Chip tone="neutral">Hors liste active{r.motif_hors_liste ? ` : ${r.motif_hors_liste}` : ''}</Chip>
            </p>
          )}
        </div>
      ),
    },
    { key: 'cat', header: 'Catégorie', sort: (r) => r.category, render: (r) => <CategoryBadge category={r.category} />, align: 'center' },
    {
      key: 'mean',
      header: 'Moyenne par jour',
      sort: (r) => r.mean_value,
      align: 'right',
      render: (r) => (
        <div>
          <span className="font-semibold">{fmtDec(r.mean_value, 1)}</span>
          <p className="text-[12px] text-ink-3">
            IC {fmtDec(r.ci_low, 1)}–{fmtDec(r.ci_high, 1)}
          </p>
        </div>
      ),
    },
    {
      key: 'change',
      header: 'Évolution 30 j',
      sort: (r) => r.adj_change_pct,
      align: 'right',
      render: (r) => <span className={r.adj_change_pct !== null && r.adj_change_pct <= -10 ? 'text-crit' : ''}>{fmtPct(r.adj_change_pct, 0, true)}</span>,
    },
    { key: 'zero', header: 'Jours sans activité', sort: (r) => r.days_zero, align: 'right', render: (r) => `${fmtInt(r.days_zero)} / ${fmtInt(r.days_open)}` },
    { key: 'over', header: 'Jours à 21 et plus', sort: (r) => r.pct_days_over_target, align: 'right', render: (r) => fmtPct(r.pct_days_over_target, 0) },
    { key: 'reason', header: 'Raisons', render: (r) => <span className="text-[13px] text-ink-2">{r.attention_reason ?? '—'}</span>, className: 'min-w-[260px] max-w-[420px]' },
  ];

  return (
    <>
      <PageHeader
        title="Liste rouge"
        description="Unités à surveiller : niveau sous la cible, baisse récente ou jours sans activité. Triez par colonne, ouvrez la fiche pour comprendre."
      />
      <Panel
        title={list.data ? plural(rows.length, 'unité à surveiller', 'unités à surveiller') : 'Unités à surveiller'}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <RegionSelect value={region} onChange={setRegion} regions={regions} />
            <SearchBox value={q} onChange={setQ} label="Rechercher" />
            {nbHorsListe > 0 && (
              <label className="flex items-center gap-2 pb-2 text-[13px] text-ink-2">
                <input type="checkbox" checked={horsListe} onChange={(e) => setHorsListe(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Afficher les unités hors liste active ({fmtInt(nbHorsListe)})
              </label>
            )}
          </div>
        }
      >
        <DataGate state={list} skeleton={<SkeletonBlock rows={8} height={28} />}>
          {() => (
            <SortableTable
              caption="Unités à surveiller"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.centre_id}
              initialSort={{ key: 'mean', dir: 'asc' }}
              empty={<EmptyState title="Aucune unité à surveiller">Aucune unité ne correspond aux filtres.</EmptyState>}
            />
          )}
        </DataGate>
      </Panel>
    </>
  );
}

export function UnitsIndexView() {
  const map = useRpc<MapUnit[]>('ui_map', {});
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const regions = useMemo(() => [...new Set((map.data ?? []).map((r) => r.region))].sort((a, b) => a.localeCompare(b, 'fr')), [map.data]);
  const rows = useMemo(
    () => (map.data ?? []).filter((r) => (!region || regionKey(r.region) === regionKey(region)) && match(q, r.centre_name, r.province)),
    [map.data, q, region],
  );
  const columns: Column<MapUnit>[] = [
    {
      key: 'name',
      header: 'Unité',
      sort: (r) => r.centre_name,
      render: (r) => (
        <div>
          <UnitLink id={r.centre_id} name={r.centre_name} />
          <p className="text-[12px] text-ink-3">{r.province}</p>
        </div>
      ),
    },
    { key: 'region', header: 'Région', sort: (r) => r.region, render: (r) => r.region },
    { key: 'cat', header: 'Catégorie', sort: (r) => r.category, align: 'center', render: (r) => <CategoryBadge category={r.category} /> },
    { key: 'mean', header: 'Moyenne par jour', sort: (r) => r.mean_value, align: 'right', render: (r) => fmtDec(r.mean_value, 1) },
    { key: 'ev', header: 'Alertes ouvertes', sort: (r) => r.open_events, align: 'right', render: (r) => (r.open_events ? <span className="font-semibold text-crit">{fmtInt(r.open_events)}</span> : '0') },
  ];
  return (
    <>
      <PageHeader title="Fiche unité" description="Choisissez une unité pour voir son activité quotidienne, son contexte, ses anomalies et sa prévision." />
      <Panel
        title={map.data ? plural(rows.length, 'unité', 'unités') : 'Unités'}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <RegionSelect value={region} onChange={setRegion} regions={regions} />
            <SearchBox value={q} onChange={setQ} label="Rechercher une unité" />
          </div>
        }
      >
        <DataGate state={map} skeleton={<SkeletonBlock rows={10} height={24} />}>
          {() => <SortableTable caption="Liste des unités" columns={columns} rows={rows} rowKey={(r) => r.centre_id} initialSort={{ key: 'name', dir: 'asc' }} dense maxHeight={640} />}
        </DataGate>
      </Panel>
    </>
  );
}

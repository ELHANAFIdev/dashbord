'use client';
import { CalendarDays, Clock, CloudRain, Store, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useRpc } from '@/client/rpc';
import { ANOMALY_STATUS_LABELS, EVENT_STATUS_LABELS, SEVERITY_LABELS, catColor } from '@/lib/constants';
import { fmtDec, fmtInt, unitName } from '@/lib/format';
import type { Cause, MapUnit } from '@/lib/types';
import { Chip, Field, cx, selectClass, type Tone } from '../ui/primitives';

export function UnitLink({ id, name, className }: { id: number; name: string | null | undefined; className?: string }) {
  return (
    <Link href={`/unites/${id}`} className={cx('font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent', className)}>
      {unitName(name, id)}
    </Link>
  );
}

export function SeverityChip({ severity }: { severity: string }) {
  const tone: Tone = severity === 'high' ? 'crit' : severity === 'medium' ? 'warn' : 'neutral';
  return <Chip tone={tone}>{SEVERITY_LABELS[severity] ?? severity}</Chip>;
}

export function EventStatusChip({ status }: { status: string }) {
  const tone: Tone = status === 'open' ? 'warn' : status === 'resolved' ? 'ok' : 'info';
  return <Chip tone={tone}>{EVENT_STATUS_LABELS[status] ?? status}</Chip>;
}

export function AnomalyStatusChip({ statut }: { statut: string }) {
  const tone: Tone = statut === 'a_enqueter' ? 'warn' : statut === 'confirme' ? 'crit' : statut === 'explique' ? 'ok' : 'neutral';
  return <Chip tone={tone}>{ANOMALY_STATUS_LABELS[statut] ?? statut}</Chip>;
}

/** Sélecteur d'unité, regroupé par région (liste issue de ui_map). */
export function UnitPicker({ value, onChange, label = 'Unité' }: { value: number | null; onChange: (id: number) => void; label?: string }) {
  const map = useRpc<MapUnit[]>('ui_map', {});
  const groups = useMemo(() => {
    const g = new Map<string, MapUnit[]>();
    for (const u of map.data ?? []) {
      const list = g.get(u.region) ?? [];
      list.push(u);
      g.set(u.region, list);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [map.data]);
  return (
    <Field label={label} className="min-w-[240px]">
      <select className={selectClass} value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} disabled={!map.data}>
        {!map.data && <option value="">Chargement…</option>}
        {groups.map(([region, units]) => (
          <optgroup key={region} label={region}>
            {units
              .slice()
              .sort((a, b) => a.centre_name.localeCompare(b.centre_name, 'fr'))
              .map((u) => (
                <option key={u.centre_id} value={u.centre_id}>
                  {u.centre_name} ({u.category})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

/** Liste des régions présentes dans les données (pour les filtres). */
export function useRegions(): string[] {
  const map = useRpc<MapUnit[]>('ui_map', {});
  return useMemo(() => [...new Set((map.data ?? []).map((u) => u.region))].sort((a, b) => a.localeCompare(b, 'fr')), [map.data]);
}

export function RegionSelect({ value, onChange, regions }: { value: string; onChange: (v: string) => void; regions: string[] }) {
  return (
    <Field label="Région">
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Toutes les régions</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Catalogue des causes groupé par famille, pour un <select>. */
export function CauseOptions({ causes }: { causes: Cause[] }) {
  const families = useMemo(() => {
    const g = new Map<string, Cause[]>();
    for (const c of causes) g.set(c.famille, [...(g.get(c.famille) ?? []), c]);
    return [...g.entries()];
  }, [causes]);
  return (
    <>
      {families.map(([f, list]) => (
        <optgroup key={f} label={f}>
          {list.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} {c.libelle}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function ContextChips({ ctx }: { ctx: Record<string, unknown> | null | undefined }) {
  if (!ctx) return <span className="text-ink-3">—</span>;
  const chips: { key: string; icon?: ReactNode; text: string; tone?: Tone }[] = [];
  if (ctx.meteo) chips.push({ key: 'm', icon: <CloudRain className="h-3 w-3" aria-hidden="true" />, text: `Météo : ${String(ctx.meteo)}`, tone: 'info' });
  if (ctx.calendrier) chips.push({ key: 'c', icon: <CalendarDays className="h-3 w-3" aria-hidden="true" />, text: String(ctx.calendrier) });
  if (ctx.veille_fete) chips.push({ key: 'v', icon: <CalendarDays className="h-3 w-3" aria-hidden="true" />, text: 'Veille de fête' });
  if (ctx.lendemain_fete) chips.push({ key: 'l', icon: <CalendarDays className="h-3 w-3" aria-hidden="true" />, text: 'Lendemain de fête' });
  if (ctx.souk) chips.push({ key: 's', icon: <Store className="h-3 w-3" aria-hidden="true" />, text: typeof ctx.souk === 'string' ? ctx.souk : 'Jour de souk' });
  if (typeof ctx.baisse_province_pct === 'number' && ctx.baisse_province_pct >= 30)
    chips.push({ key: 'p', text: `Baisse province : ${fmtInt(ctx.baisse_province_pct)} % des unités`, tone: 'warn' });
  if (typeof ctx.baisse_reseau_pct === 'number' && ctx.baisse_reseau_pct >= 30)
    chips.push({ key: 'r', text: `Baisse réseau : ${fmtInt(ctx.baisse_reseau_pct)} % des unités`, tone: 'warn' });
  if (typeof ctx.hors_ligne_pct === 'number' && ctx.hors_ligne_pct >= 30)
    chips.push({ key: 'h', icon: <WifiOff className="h-3 w-3" aria-hidden="true" />, text: `Hors ligne : ${fmtInt(ctx.hors_ligne_pct)} %`, tone: 'warn' });
  if (typeof ctx.jours_zero_avant === 'number' && ctx.jours_zero_avant > 0)
    chips.push({ key: 'z', text: `${fmtInt(ctx.jours_zero_avant)} j sans activité avant` });
  if (ctx.provisoire) chips.push({ key: 'pr', icon: <Clock className="h-3 w-3" aria-hidden="true" />, text: 'Journée provisoire' });
  if (!chips.length) return <span className="text-[12px] text-ink-3">Aucun facteur connu</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Chip key={c.key} tone={c.tone} icon={c.icon}>
          {c.text}
        </Chip>
      ))}
    </div>
  );
}

export function CategoryLegend({ counts }: { counts?: Record<string, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      {(['A', 'B', 'C', 'D', 'E'] as const).map((c) => (
        <li key={c} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: catColor(c) }} aria-hidden="true" />
          {c}
          {counts && <span className="num text-ink-3">({fmtInt(counts[c] ?? 0)})</span>}
        </li>
      ))}
    </ul>
  );
}

export function Pct({ value, digits = 1 }: { value: number | null | undefined; digits?: number }) {
  return <span className="num">{value === null || value === undefined ? '—' : `${fmtDec(value, digits)} %`}</span>;
}

/** Petite infobulle flottante pour les marques d'un graphique HTML. */
export function useHoverTip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const node = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[260px] rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] text-ink shadow-pop"
      style={{ left: tip.x + 12, top: tip.y + 12 }}
    >
      {tip.content}
    </div>
  ) : null;
  return { show: (e: { clientX: number; clientY: number }, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content }), hide: () => setTip(null), node };
}

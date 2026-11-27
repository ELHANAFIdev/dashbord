'use client';
import { useMemo } from 'react';
import { useRpc } from '@/client/rpc';
import { fmtDec, fmtInt, fmtSigned, plural } from '@/lib/format';
import type { Causalite, Cause, Facteur } from '@/lib/types';
import { Chip, DataGate, EmptyState, PageHeader, Panel, SkeletonBlock, type Tone } from '../ui/primitives';
import { SortableTable, type Column } from '../ui/table';
import { useHoverTip } from './shared';

const isDemonstrated = (v: string) => /d[ée]montr[ée]e/i.test(v) && !/pas d/i.test(v);

function ForestPlot({ rows }: { rows: Facteur[] }) {
  const tip = useHoverTip();
  const sorted = useMemo(() => [...rows].sort((a, b) => a.effet_pct - b.effet_pct), [rows]);
  const lo = Math.min(0, ...sorted.map((r) => r.ic_bas));
  const hi = Math.max(0, ...sorted.map((r) => r.ic_haut));
  const span = hi - lo || 1;
  const pad = span * 0.05;
  const x0 = lo - pad;
  const x1 = hi + pad;
  const W = 1000; // largeur logique de la zone de tracé
  const sx = (v: number) => ((v - x0) / (x1 - x0)) * W;
  const ticks = useMemo(() => {
    const step = span > 80 ? 20 : span > 40 ? 10 : 5;
    const out: number[] = [];
    for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) out.push(v);
    return out;
  }, [span, x0, x1]);
  const rowH = 30;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" aria-hidden="true" /> Effet démontré (intervalle à 95 % qui ne croise pas 0)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink-3" aria-hidden="true" /> Effet faible, non démontré ou non applicable
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[220px_1fr_150px] items-end gap-3 border-b border-line pb-1 text-[12px] font-medium text-ink-3">
            <span>Facteur</span>
            <span className="text-center">Effet sur les consultations (%)</span>
            <span className="text-right">Effet, lift, jours</span>
          </div>
          {sorted.map((r) => {
            const strong = isDemonstrated(r.verdict);
            return (
              <div
                key={r.facteur}
                className="grid grid-cols-[220px_1fr_150px] items-center gap-3 border-b border-line/60 hover:bg-surface-2"
                style={{ height: rowH }}
                onMouseMove={(e) =>
                  tip.show(
                    e,
                    <>
                      <strong className="font-semibold">{r.libelle}</strong>
                      <br />
                      Effet {fmtSigned(r.effet_pct, 1)} % (IC 95 % {fmtSigned(r.ic_bas, 1)} à {fmtSigned(r.ic_haut, 1)})
                      <br />
                      {r.verdict}, {plural(r.n_jours, 'jour', 'jours')}
                      {r.lift !== null && (
                        <>
                          <br />
                          Présent dans {fmtDec(r.pct_anomalies, 1)} % des anomalies contre {fmtDec(r.pct_jours_normaux, 1)} % des jours normaux
                        </>
                      )}
                    </>,
                  )
                }
                onMouseLeave={tip.hide}
              >
                <span title={r.libelle} className={`truncate text-[13px] ${strong ? 'font-medium text-ink' : 'text-ink-2'}`}>{r.libelle}</span>
                <div className="relative h-[30px]">
                <svg viewBox={`0 0 ${W} ${rowH}`} preserveAspectRatio="none" className="h-[30px] w-full overflow-visible" role="img" aria-label={`${r.libelle} : ${fmtSigned(r.effet_pct, 1)} %, intervalle ${fmtSigned(r.ic_bas, 1)} à ${fmtSigned(r.ic_haut, 1)}, ${r.verdict}`}>
                  {ticks.map((t) => (
                    <line key={t} x1={sx(t)} x2={sx(t)} y1={0} y2={rowH} stroke={t === 0 ? 'var(--ink-3)' : 'var(--grid)'} strokeWidth={t === 0 ? 1.5 : 1} vectorEffect="non-scaling-stroke" />
                  ))}
                  <line x1={sx(r.ic_bas)} x2={sx(r.ic_haut)} y1={rowH / 2} y2={rowH / 2} stroke={strong ? 'var(--ink)' : 'var(--ink-3)'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </svg>
                  {/* point posé en HTML : il reste rond malgré l'étirement horizontal du SVG */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 block h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${(sx(r.effet_pct) / W) * 100}%`,
                      background: strong ? 'var(--ink)' : 'var(--surface)',
                      border: `2px solid ${strong ? 'var(--ink)' : 'var(--ink-3)'}`,
                    }}
                  />
                </div>
                <span className="num text-right text-[12px] text-ink-2">
                  <span className={strong ? 'font-semibold text-ink' : ''}>{fmtSigned(r.effet_pct, 0)} %</span>
                  {r.lift !== null && <span className="ml-2 text-ink-3">×{fmtDec(r.lift, 1)}</span>}
                  <span className="ml-2 text-ink-3">{fmtInt(r.n_jours)} j</span>
                </span>
              </div>
            );
          })}
          <div className="grid grid-cols-[220px_1fr_150px] gap-3 pt-1 text-[11px] text-ink-3">
            <span />
            <div className="relative h-4">
              {ticks.map((t) => (
                <span key={t} className="num absolute -translate-x-1/2" style={{ left: `${(sx(t) / W) * 100}%` }}>
                  {fmtSigned(t, 0)}
                </span>
              ))}
            </div>
            <span />
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        Effet : écart moyen des consultations les jours où le facteur est présent, par rapport à l’habitude de l’unité. Lift : combien de fois le facteur est plus fréquent les jours anormaux que les jours normaux. Lundi et vendredi sont mesurés contre le même jour de semaine : leur effet vaut environ zéro par construction.
      </p>
      {tip.node}
    </div>
  );
}

function CauseCatalogue({ causes }: { causes: Cause[] }) {
  const families = useMemo(() => {
    const g = new Map<string, Cause[]>();
    for (const c of causes) g.set(c.famille, [...(g.get(c.famille) ?? []), c]);
    return [...g.entries()];
  }, [causes]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {families.map(([famille, list]) => (
        <section key={famille} className="min-w-0">
          <h3 className="mb-2 flex items-baseline justify-between text-[14px] font-semibold">
            {famille}
            <span className="text-[12px] font-normal text-ink-3">
              {plural(list.length, 'cause', 'causes')}, {fmtInt(list.filter((c) => c.detection_auto).length)} détectables
            </span>
          </h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {list.map((c) => (
              <li key={c.code} className="grid grid-cols-[42px_1fr_auto] items-start gap-2 px-3 py-2 text-[13px]">
                <span className="num text-ink-3">{c.code}</span>
                <span className="min-w-0">
                  <span className="text-ink">{c.libelle}</span>
                  <span className="block text-[12px] text-ink-3">
                    Effet : {c.effet ?? '—'}. Portée : {c.portee ?? '—'}. Données : {c.donnees ?? '—'}.
                  </span>
                </span>
                {c.detection_auto ? <Chip tone="info">Automatique</Chip> : <Chip>Enquête terrain</Chip>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const VERDICT_TONE: Record<Causalite['verdict'], Tone> = {
  'cause probable': 'info',
  association: 'warn',
  'effet faible': 'neutral',
  "pas d'effet démontré": 'neutral',
  'artefact de saisie': 'neutral',
  'trop peu de jours': 'neutral',
};
const VERDICT_RANK: Record<Causalite['verdict'], number> = {
  'cause probable': 1,
  association: 2,
  'effet faible': 3,
  "pas d'effet démontré": 4,
  'artefact de saisie': 5,
  'trop peu de jours': 6,
};
const pct = (v: number | null) => (v === null ? '—' : `${fmtSigned(v, 1)} %`);

function CausalityTable({ rows }: { rows: Causalite[] }) {
  const columns: Column<Causalite>[] = [
    {
      key: 'f',
      header: 'Facteur',
      sort: (r) => r.libelle,
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.libelle}</p>
          <p className="text-[12px] text-ink-3">
            {r.famille} · {r.source}
            {r.remarque ? ` · ${r.remarque}` : ''}
          </p>
        </div>
      ),
      className: 'min-w-[220px]',
    },
    { key: 'v', header: 'Verdict', sort: (r) => VERDICT_RANK[r.verdict], render: (r) => <Chip tone={VERDICT_TONE[r.verdict]}>{r.verdict}</Chip> },
    {
      key: 'e',
      header: 'Effet (IC 95 %)',
      sort: (r) => r.effet_pct ?? 0,
      align: 'right',
      render: (r) =>
        r.effet_pct === null ? (
          '—'
        ) : (
          <div>
            <span className="font-semibold">{pct(r.effet_pct)}</span>
            {r.ic_bas !== null && r.ic_haut !== null && (
              <p className="text-[12px] text-ink-3">
                {fmtDec(r.ic_bas, 1)} à {fmtDec(r.ic_haut, 1)}
              </p>
            )}
          </div>
        ),
    },
    { key: 'a', header: 'Face aux voisines', sort: (r) => r.effet_ajuste_pct ?? 0, align: 'right', render: (r) => (r.portee === 'national' ? <span className="text-ink-3">national</span> : pct(r.effet_ajuste_pct)) },
    { key: 'p', header: 'Placebo (−10 j)', sort: (r) => Math.abs(r.placebo_pct ?? 0), align: 'right', render: (r) => pct(r.placebo_pct) },
    { key: 'w', header: 'Veille', sort: (r) => r.veille_pct ?? 0, align: 'right', render: (r) => pct(r.veille_pct) },
    {
      key: 'd',
      header: 'Dose-réponse',
      render: (r) =>
        r.dose?.length ? (
          <span className="num text-[12px] text-ink-2">{r.dose.map((q) => `${fmtSigned(q.effet_pct, 0)} %`).join(' → ')}</span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: 'c',
      header: 'Cohérence',
      sort: (r) => r.coherence_pct ?? 0,
      align: 'right',
      render: (r) => (r.coherence_pct === null ? '—' : `${fmtInt(r.coherence_pct)} % (${fmtInt(r.provinces ?? 0)} prov.)`),
    },
    { key: 'x', header: 'Lecture', render: (r) => <span className="text-[13px] text-ink-2">{r.explication}</span>, className: 'min-w-[260px] max-w-[420px]' },
  ];
  return (
    <SortableTable
      caption="Tests de causalité par facteur"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.facteur}
      initialSort={{ key: 'v', dir: 'asc' }}
      empty={<EmptyState title="Aucun facteur testé" />}
    />
  );
}

export function FactorsView() {
  const facteurs = useRpc<Facteur[]>('ui_facteurs', {});
  const causes = useRpc<Cause[]>('ui_causes', {});
  const causalite = useRpc<Causalite[]>('ui_causalite', {});
  return (
    <>
      <PageHeader
        title="Facteurs & causes"
        description="Ce qui fait varier la fréquentation, mesuré sur l’historique, et le catalogue des causes utilisé pour les enquêtes."
      />
      <Panel title="Effet mesuré des facteurs" description="Point : effet moyen. Trait : intervalle de confiance à 95 %. Seuls les effets démontrés sont en trait plein.">
        <DataGate state={facteurs} skeleton={<SkeletonBlock rows={10} height={22} />}>
          {(rows) => (rows.length ? <ForestPlot rows={rows} /> : <EmptyState title="Effets non encore calculés">Lancez le calcul des effets dans la base (étape 7 du LISEZ-MOI).</EmptyState>)}
        </DataGate>
      </Panel>
      <Panel
        className="mt-6"
        title="Corrélation ou causalité ?"
        description="Six tests par facteur : effet et intervalle de confiance, comparaison aux unités voisines le même jour, placebo décalé de 10 jours, veille, dose-réponse et cohérence entre provinces. Jours fériés exclus sauf pour « férié ». « Cause probable » reste à confirmer sur le terrain."
      >
        <DataGate state={causalite} skeleton={<SkeletonBlock rows={10} />}>
          {(rows) =>
            rows.length ? (
              <CausalityTable rows={rows} />
            ) : (
              <EmptyState title="Tests non encore lancés">Lancez le script 29 puis ana.fn_tester_causalite() dans la base.</EmptyState>
            )
          }
        </DataGate>
      </Panel>
      <Panel className="mt-6" title="Catalogue des causes" description="Causes regroupées par famille. « Automatique » : la base peut la détecter seule ; sinon elle s’obtient par l’enquête.">
        <DataGate state={causes} skeleton={<SkeletonBlock rows={10} />}>
          {(rows) => (rows.length ? <CauseCatalogue causes={rows} /> : <EmptyState title="Catalogue vide" />)}
        </DataGate>
      </Panel>
    </>
  );
}

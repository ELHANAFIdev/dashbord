'use client';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { useRpc } from '@/client/rpc';
import { useSession } from '@/client/session';
import { DATA_DAY } from '@/lib/constants';
import { addDays, fmtDay, fmtDec, fmtInt, plural } from '@/lib/format';
import { regionKey } from '@/lib/regions';
import type { PracticeIndicator, PracticeRow } from '@/lib/types';
import { Button, Chip, DataGate, EmptyState, Kpi, KpiBand, PageHeader, Panel, Segmented, Select, SkeletonBlock, cx } from '../ui/primitives';
import { RegionSelect } from './shared';

type Groupe = 'medecin' | 'centre';
type SortKey = 'problemes' | 'consultations' | 'nom';
const PAGE = 25;
const FAMILIES = ['Durée', 'Attente', 'Horaires', 'Tenue du dossier', 'Charge', 'Information'];
const PERIODS = [
  { value: '30', label: '30 derniers jours' },
  { value: '91', label: '3 derniers mois' },
  { value: '182', label: '6 derniers mois' },
];

function median(values: number[]) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const pctText = (p: number | null) => (p === null ? 'non mesuré' : `${fmtDec(p, 1)} %`);

function ProblemChips({ row }: { row: PracticeRow }) {
  const alerts = row.problemes.length
    ? row.problemes.map((lib) => row.indicateurs.find((i) => i.libelle === lib)).filter((i): i is PracticeIndicator => Boolean(i))
    : [];
  if (!alerts.length) return <span className="text-[13px] text-ink-3">Aucun problème</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {alerts.map((i) => (
        <Chip key={i.code} tone="crit" title={`${i.libelle} : ${pctText(i.pct)} (médiane du réseau ${pctText(i.mediane_reseau_pct)})`} className="whitespace-normal">
          {i.libelle} <span className="num font-semibold">{pctText(i.pct)}</span>
        </Chip>
      ))}
    </div>
  );
}

/** Les 13 indicateurs, groupés par famille, avec la médiane du réseau en repère. */
function IndicatorDetail({ row }: { row: PracticeRow }) {
  const max = Math.max(5, ...row.indicateurs.flatMap((i) => [i.pct ?? 0, i.mediane_reseau_pct ?? 0]));
  const families = FAMILIES.map((f) => [f, row.indicateurs.filter((i) => i.famille === f)] as const).filter(([, l]) => l.length);
  const others = row.indicateurs.filter((i) => !FAMILIES.includes(i.famille));
  const groups = others.length ? [...families, ['Autres', others] as const] : families;
  return (
    <div className="grid gap-x-8 gap-y-4 px-1 py-2 lg:grid-cols-2">
      {groups.map(([famille, list]) => (
        <section key={famille}>
          <h4 className="mb-1.5 text-[12px] font-semibold text-ink-2">{famille}</h4>
          <ul className="space-y-2">
            {list.map((i) => (
              <li key={i.code} className="grid grid-cols-[1fr_88px] items-center gap-x-3 gap-y-1 text-[13px]">
                <span className={cx('min-w-0', i.alerte ? 'font-medium text-crit' : 'text-ink')}>
                  <span className="num mr-1.5 text-[12px] text-ink-3">{i.code}</span>
                  {i.libelle}
                </span>
                <span className={cx('num text-right', i.alerte ? 'font-semibold text-crit' : i.pct === null ? 'text-ink-3' : '')}>{pctText(i.pct)}</span>
                {i.pct === null ? (
                  <span className="col-span-2 text-[12px] text-ink-3">Compléments non chargés pour cette période.</span>
                ) : (
                  <div className="col-span-2 flex items-center gap-2">
                    <div className="relative h-2 flex-1 rounded-full bg-sunken" role="img" aria-label={`${pctText(i.pct)} contre ${pctText(i.mediane_reseau_pct)} pour la médiane du réseau`}>
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(i.pct / max) * 100}%`, background: i.alerte ? 'var(--crit)' : 'var(--series-1)' }} />
                      {i.mediane_reseau_pct !== null && (
                        <div className="absolute -top-1 h-4 w-[2px] bg-ink" style={{ left: `calc(${(i.mediane_reseau_pct / max) * 100}% - 1px)` }} />
                      )}
                    </div>
                    <span className="num w-[88px] text-right text-[11px] text-ink-3">méd. {pctText(i.mediane_reseau_pct)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[12px] text-ink-3 lg:col-span-2">
        Barre : part observée ; trait vertical : médiane du réseau. Alerte quand la part atteint au moins deux fois la médiane (et au moins 5 %), sur au moins 3 cas. La saisie hors ligne est une information, jamais une alerte.
      </p>
    </div>
  );
}

export function PracticeView() {
  const { can } = useSession();
  const [groupe, setGroupe] = useState<Groupe>('medecin');
  const [period, setPeriod] = useState('91');
  const [region, setRegion] = useState('');
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('problemes');
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [shown, setShown] = useState(PAGE);
  const du = addDays(DATA_DAY, -(Number(period) - 1));
  const res = useRpc<PracticeRow[]>('ui_stats_formation', { p_du: du, p_au: DATA_DAY, p_groupe: groupe });
  const data = res.data;

  const regions = useMemo(() => [...new Set((data ?? []).map((r) => r.region ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [data]);
  const rows = useMemo(() => {
    const list = (data ?? []).filter((r) => (!region || regionKey(r.region) === regionKey(region)) && (!problemsOnly || r.problemes.length > 0));
    const by: Record<SortKey, (a: PracticeRow, b: PracticeRow) => number> = {
      problemes: (a, b) => b.problemes.length - a.problemes.length || b.consultations - a.consultations,
      consultations: (a, b) => b.consultations - a.consultations,
      nom: (a, b) => a.groupe_nom.localeCompare(b.groupe_nom, 'fr', { numeric: true }),
    };
    return [...list].sort(by[sort]);
  }, [data, region, problemsOnly, sort]);

  const summary = useMemo(() => {
    const list = data ?? [];
    const counts = new Map<string, { n: number; libelle: string }>();
    for (const r of list) for (const i of r.indicateurs) if (i.alerte) counts.set(i.code, { n: (counts.get(i.code)?.n ?? 0) + 1, libelle: i.libelle });
    const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    const codes = list[0]?.indicateurs.map((i) => i.code) ?? [];
    const unmeasured = codes.filter((code) => list.every((r) => r.indicateurs.find((i) => i.code === code)?.pct === null));
    return {
      withProblem: list.filter((r) => r.problemes.length > 0).length,
      total: list.length,
      top,
      consultations: list.reduce((a, r) => a + r.consultations, 0),
      duree: median(list.map((r) => r.duree_mediane_min ?? NaN)),
      unmeasured,
    };
  }, [data]);

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const who = groupe === 'medecin' ? ['médecin', 'médecins'] : ['unité', 'unités'];

  return (
    <>
      <PageHeader
        title="Problèmes de pratique"
        description={`Qualité par médecin et par unité, du ${fmtDay(du)} au ${fmtDay(DATA_DAY)}, comparée à la médiane du réseau.`}
        actions={
          <>
            <Select label="Période" value={period} onChange={setPeriod} options={PERIODS} />
            <div className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
              Regroupement
              <Segmented<Groupe>
                label="Regroupement"
                value={groupe}
                onChange={(g) => {
                  setGroupe(g);
                  setOpen(new Set());
                }}
                options={[
                  { value: 'medecin', label: 'Médecin' },
                  { value: 'centre', label: 'Unité' },
                ]}
              />
            </div>
          </>
        }
      />
      {groupe === 'medecin' && !can.viewDoctorNames && (
        <p className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
          Les noms des médecins sont réservés à la direction : le serveur les remplace par un numéro.
        </p>
      )}
      <KpiBand loading={!data && !res.error}>
        <Kpi
          label={`${who[1].charAt(0).toUpperCase()}${who[1].slice(1)} avec un problème`}
          value={
            <>
              {fmtInt(summary.withProblem)}
              <span className="text-[18px] font-normal text-ink-3"> / {fmtInt(summary.total)}</span>
            </>
          }
          tone={summary.withProblem ? 'warn' : undefined}
          detail="au moins un indicateur en alerte"
        />
        <Kpi
          label="Problème le plus fréquent"
          value={<span className="text-[18px] leading-tight">{summary.top ? summary.top[0] : '—'}</span>}
          detail={summary.top ? `${summary.top[1].libelle}, ${plural(summary.top[1].n, who[0], who[1])}` : 'aucune alerte'}
        />
        <Kpi label="Consultations analysées" value={fmtInt(summary.consultations)} detail={`${plural(summary.total, who[0], who[1])} de 10 consultations ou plus`} />
        <Kpi label="Durée médiane" value={summary.duree === null ? '—' : `${fmtDec(summary.duree, 0)} min`} detail="par consultation, médiane des groupes" />
        <Kpi
          label="Non mesurés"
          value={fmtInt(summary.unmeasured.length)}
          detail={summary.unmeasured.length ? `${summary.unmeasured.join(', ')} : compléments non chargés` : 'tous les indicateurs sont mesurés'}
        />
      </KpiBand>

      <Panel
        className="mt-6"
        title={data ? plural(rows.length, who[0], who[1]) : 'Problèmes'}
        description="Pastille rouge : indicateur en alerte, avec sa part. Dépliez une ligne pour voir les 13 indicateurs."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <RegionSelect value={region} onChange={setRegion} regions={regions} />
            <Select
              label="Trier par"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: 'problemes', label: 'Nombre de problèmes' },
                { value: 'consultations', label: 'Consultations' },
                { value: 'nom', label: 'Nom' },
              ]}
            />
            <label className="flex h-9 items-center gap-2 text-[13px]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
              Avec problème uniquement
            </label>
          </div>
        }
      >
        <DataGate state={res} skeleton={<SkeletonBlock rows={8} height={30} />}>
          {() =>
            rows.length ? (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                  <caption className="sr-only">Problèmes de pratique</caption>
                  <thead className="bg-surface-2 text-[12px] text-ink-2">
                    <tr>
                      <th scope="col" className="w-10 border-b border-line px-2 py-2">
                        <span className="sr-only">Détail</span>
                      </th>
                      <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
                        {groupe === 'medecin' ? 'Médecin' : 'Unité'}
                      </th>
                      <th scope="col" className="border-b border-line px-3 py-2 text-right font-semibold">
                        Consultations
                      </th>
                      <th scope="col" className="border-b border-line px-3 py-2 text-right font-semibold">
                        Par jour
                      </th>
                      <th scope="col" className="border-b border-line px-3 py-2 text-right font-semibold">
                        Durée médiane
                      </th>
                      <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
                        Problèmes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, shown).map((r) => {
                      const isOpen = open.has(r.groupe_id);
                      const detailId = `pratique-${groupe}-${r.groupe_id}`;
                      return (
                        <Fragment key={r.groupe_id}>
                          <tr className="border-b border-line hover:bg-surface-2">
                            <td className="px-2 py-2.5 align-top">
                              <button
                                type="button"
                                onClick={() => toggle(r.groupe_id)}
                                aria-expanded={isOpen}
                                aria-controls={detailId}
                                aria-label={`${isOpen ? 'Replier' : 'Déplier'} les indicateurs de ${r.groupe_nom}`}
                                className="rounded p-1 text-ink-2 hover:bg-sunken hover:text-ink"
                              >
                                {isOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <p className="font-medium">{r.groupe_nom}</p>
                              <p className="text-[12px] text-ink-3">
                                {groupe === 'medecin' ? `${r.centre_name ?? '—'}, ` : ''}
                                {r.province ?? '—'}, {r.region ?? '—'}
                              </p>
                            </td>
                            <td className="num px-3 py-2.5 text-right align-top">{fmtInt(r.consultations)}</td>
                            <td className="num px-3 py-2.5 text-right align-top">{fmtDec(r.consultations_par_jour, 1)}</td>
                            <td className="num px-3 py-2.5 text-right align-top">{r.duree_mediane_min === null ? '—' : `${fmtDec(r.duree_mediane_min, 0)} min`}</td>
                            <td className="px-3 py-2.5 align-top">
                              <ProblemChips row={r} />
                            </td>
                          </tr>
                          {isOpen && (
                            <tr id={detailId} className="border-b border-line bg-surface-2">
                              <td />
                              <td colSpan={5} className="px-3 py-3">
                                <IndicatorDetail row={r} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > shown && (
                  <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-ink-2">
                    <span className="num">
                      {fmtInt(shown)} sur {fmtInt(rows.length)} affichés
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                      Afficher {fmtInt(Math.min(PAGE, rows.length - shown))} de plus
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="Aucun groupe pour ces filtres">Groupes de moins de 10 consultations exclus.</EmptyState>
            )
          }
        </DataGate>
        <p className="mt-3 text-[12px] text-ink-3">Groupes de moins de 10 consultations exclus. « Non mesuré » : l’attente et la conclusion nécessitent les compléments de la base.</p>
      </Panel>
    </>
  );
}

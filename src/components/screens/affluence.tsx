'use client';
import type { ChartOptions } from 'chart.js';
import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useRpc } from '@/client/rpc';
import { YEAR_FROM, YEAR_TO } from '@/lib/constants';
import { WEEKDAYS, WEEKDAYS_SHORT, fmtDec, fmtInt, fmtMonthLong, fmtPct, unitName } from '@/lib/format';
import type { CroissanceRow, HeureRow, LieuUnite, RepartitionRow, RetourRow } from '@/lib/types';
import { baseOptions, useChartTokens } from '../charts/tokens';
import { DataGate, EmptyState, Field, Kpi, KpiBand, PageHeader, Panel, Skeleton, SkeletonBlock, selectClass } from '../ui/primitives';
import { useHoverTip } from './shared';

const HOURS = Array.from({ length: 13 }, (_, i) => 7 + i);
const DAYS = [1, 2, 3, 4, 5, 6];
const SEQ = ['--seq-0', '--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7'];

function Heatmap({ rows }: { rows: HeureRow[] }) {
  const tip = useHoverTip();
  const cell = useMemo(() => {
    const m = new Map<string, HeureRow>();
    for (const r of rows) m.set(`${r.jour_semaine}-${r.heure}`, r);
    return m;
  }, [rows]);
  const total = rows.filter((r) => r.jour_semaine <= 6 && r.heure >= 7 && r.heure <= 19).reduce((a, r) => a + r.consultations, 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r.consultations));
  const peak = rows.reduce<HeureRow | null>((best, r) => (!best || r.consultations > best.consultations ? r : best), null);
  const level = (v: number) => Math.min(SEQ.length - 1, Math.floor((v / max) * (SEQ.length - 1) + 0.0001));
  const inkFor = (lvl: number) => (lvl >= 5 ? 'var(--seq-ink-strong)' : 'var(--ink)');

  return (
    <div>
      {peak && (
        <p className="mb-4 text-[14px] text-ink">
          Pic d’affluence : <strong className="font-semibold">{WEEKDAYS[peak.jour_semaine - 1]} à {peak.heure} h</strong>, avec{' '}
          <span className="num">{fmtPct((peak.consultations / total) * 100, 1)}</span> des consultations de la semaine sur ce seul créneau.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-[3px] text-[12px]">
          <caption className="sr-only">Consultations par jour de semaine et par heure</caption>
          <thead>
            <tr>
              <th scope="col" className="w-12" />
              {HOURS.map((h) => (
                <th key={h} scope="col" className="num font-normal text-ink-3">
                  {h} h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <th scope="row" className="pr-2 text-left font-medium text-ink-2">
                  {WEEKDAYS_SHORT[d - 1]}
                </th>
                {HOURS.map((h) => {
                  const r = cell.get(`${d}-${h}`);
                  const v = r?.consultations ?? 0;
                  const lvl = level(v);
                  const isPeak = peak && r === peak;
                  return (
                    <td
                      key={h}
                      className="num h-10 rounded-[4px] text-center align-middle"
                      style={{ background: `var(${SEQ[lvl]})`, color: inkFor(lvl), outline: isPeak ? '2px solid var(--ink)' : undefined, outlineOffset: -2 }}
                      onMouseMove={(e) =>
                        tip.show(
                          e,
                          <>
                            <strong className="font-semibold">
                              {WEEKDAYS[d - 1]}, {h} h à {h + 1} h
                            </strong>
                            <br />
                            {fmtInt(v)} consultations ({fmtPct((v / total) * 100, 1)} de la semaine)
                            {r && (
                              <>
                                <br />
                                {fmtDec(r.consultations_par_heure_active, 2)} par heure d’unité active
                              </>
                            )}
                          </>,
                        )
                      }
                      onMouseLeave={tip.hide}
                    >
                      <span className="sr-only">
                        {WEEKDAYS[d - 1]} {h} h : {fmtInt(v)} consultations
                      </span>
                      <span aria-hidden="true">{fmtDec((v / total) * 100, 1)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
        <span>Part des consultations de la semaine (%)</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span>faible</span>
          {SEQ.map((s) => (
            <span key={s} className="h-3 w-5 rounded-sm" style={{ background: `var(${s})` }} />
          ))}
          <span>forte</span>
        </span>
      </div>
      {tip.node}
    </div>
  );
}

function GrowthChart({ rows }: { rows: CroissanceRow[] }) {
  const t = useChartTokens();
  if (!t) return <Skeleton className="h-[260px]" />;
  const base = baseOptions(t, { legend: true, yMin: 0 }) as unknown as ChartOptions<'bar'>;
  const options: ChartOptions<'bar'> = {
    ...base,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      ...base.plugins,
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          ...base.plugins?.tooltip?.callbacks,
          afterBody: (items) => {
            const r = rows[items[0]?.dataIndex ?? 0];
            return r?.variation_pct !== null && r?.variation_pct !== undefined ? `Variation : ${fmtPct(r.variation_pct, 1, true)}` : '';
          },
        },
      },
    },
  };
  return (
    <div className="h-[260px]">
      <Bar
        role="img"
        aria-label="Consultations par mois, 2026 comparé à 2025"
        options={options}
        data={{
          labels: rows.map((r) => fmtMonthLong(r.mois)),
          datasets: [
            { label: 'Année précédente', data: rows.map((r) => r.consultations_n_1), backgroundColor: t.axis, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.7 },
            { label: 'Cette année', data: rows.map((r) => r.consultations_n), backgroundColor: t.series1, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.7 },
          ],
        }}
      />
    </div>
  );
}

function RegionRanking({ rows }: { rows: RepartitionRow[] }) {
  const sorted = [...rows].sort((a, b) => a.rang - b.rang);
  const max = Math.max(1, ...sorted.map((r) => r.consultations_par_jour_actif));
  return (
    <ol className="space-y-2">
      {sorted.map((r) => (
        <li key={r.niveau} className="grid grid-cols-[24px_minmax(120px,210px)_1fr] items-center gap-3 text-[13px]">
          <span className="num text-right text-ink-3">{r.rang}</span>
          <span className="truncate text-ink">{r.niveau}</span>
          <span className="flex items-center gap-2">
            <span
              className="h-3.5 rounded-r-[4px]"
              style={{ width: `${(r.consultations_par_jour_actif / max) * 85}%`, background: r.rang === 1 ? 'var(--series-1)' : 'var(--seq-3)' }}
              aria-hidden="true"
            />
            <span className="num font-medium">{fmtDec(r.consultations_par_jour_actif, 1)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

type NiveauHeures = 'national' | 'region' | 'province' | 'commune' | 'centre';
const NIVEAUX_HEURES: { value: NiveauHeures; label: string }[] = [
  { value: 'national', label: 'Tout le réseau' },
  { value: 'region', label: 'Région' },
  { value: 'province', label: 'Province' },
  { value: 'commune', label: 'Commune' },
  { value: 'centre', label: 'Unité' },
];

/** Carte jour × heure : réseau entier (cache national) ou un lieu choisi (flux_heures_niveau, script 28). */
function HeatmapPanel() {
  const [niveau, setNiveau] = useState<NiveauHeures>('national');
  const [valeur, setValeur] = useState('');
  const lieux = useRpc<LieuUnite[]>('flux_lieux', {});
  const options = useMemo(() => {
    const l = lieux.data ?? [];
    const uniq = (xs: (string | null)[]) =>
      [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'fr')).map((x) => ({ value: x, label: x }));
    switch (niveau) {
      case 'region':
        return uniq(l.map((u) => u.region));
      case 'province':
        return uniq(l.map((u) => u.province));
      case 'commune':
        return [...new Map(l.filter((u) => u.commune).map((u) => [u.commune as string, { value: u.commune as string, label: `${u.commune} (${u.province ?? '—'})` }])).values()].sort(
          (a, b) => a.label.localeCompare(b.label, 'fr'),
        );
      case 'centre':
        return l
          .map((u) => ({ value: String(u.centre_id), label: `${unitName(u.centre_name, u.centre_id)} (${u.province ?? '—'})` }))
          .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
      default:
        return [];
    }
  }, [lieux.data, niveau]);
  const choix = niveau === 'national' ? '' : valeur || options[0]?.value || '';
  const national = useRpc<HeureRow[]>('flux_indicateurs', niveau === 'national' ? { p_indicateur: 'heures', p_du: YEAR_FROM, p_au: YEAR_TO, p_niveau: 'national' } : null);
  const local = useRpc<HeureRow[]>('flux_heures_niveau', niveau !== 'national' && choix ? { p_du: YEAR_FROM, p_au: YEAR_TO, p_niveau: niveau, p_valeur: choix } : null);
  const state = niveau === 'national' ? national : local;
  const libelle = niveau === 'national' ? 'toutes unités' : (options.find((o) => o.value === choix)?.label ?? '…');

  return (
    <Panel
      className="mt-6"
      title="Affluence par jour et par heure"
      description={`Douze derniers mois, ${libelle}. Chaque case donne la part des consultations de la semaine.`}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Niveau">
            <select className={selectClass} value={niveau} onChange={(e) => { setNiveau(e.target.value as NiveauHeures); setValeur(''); }}>
              {NIVEAUX_HEURES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </Field>
          {niveau !== 'national' && (
            <Field label={NIVEAUX_HEURES.find((n) => n.value === niveau)?.label ?? 'Lieu'}>
              <select className={`${selectClass} max-w-[280px]`} value={choix} onChange={(e) => setValeur(e.target.value)} disabled={!options.length}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      }
    >
      <DataGate state={state} skeleton={<SkeletonBlock rows={6} height={36} />}>
        {(rows) => (rows.length ? <Heatmap rows={rows} /> : <EmptyState title="Pas de données horaires pour ce choix" />)}
      </DataGate>
    </Panel>
  );
}

export function AffluenceView() {
  const croissance = useRpc<CroissanceRow[]>('flux_indicateurs', { p_indicateur: 'croissance', p_du: '2026-01-01', p_au: YEAR_TO, p_niveau: 'national' });
  const repartition = useRpc<RepartitionRow[]>('flux_indicateurs', { p_indicateur: 'repartition', p_du: YEAR_FROM, p_au: YEAR_TO, p_niveau: 'region' });
  const retour = useRpc<RetourRow[]>('flux_indicateurs', { p_indicateur: 'retour', p_du: YEAR_FROM, p_au: YEAR_TO, p_niveau: 'national' });

  const growth = useMemo(() => {
    const rows = croissance.data ?? [];
    const n = rows.reduce((a, r) => a + r.consultations_n, 0);
    const n1 = rows.reduce((a, r) => a + r.consultations_n_1, 0);
    return n1 ? ((n - n1) / n1) * 100 : null;
  }, [croissance.data]);
  const first = repartition.data?.find((r) => r.rang === 1);
  const ret = retour.data?.[0];
  const months = croissance.data ?? [];

  return (
    <>
      <PageHeader title="Affluence" description="Quand les patients viennent, comment la demande évolue d’une année sur l’autre, et quelles régions sont les plus actives." />
      <KpiBand loading={!croissance.data && !repartition.data && !retour.data}>
        <Kpi
          label="Croissance sur un an"
          value={growth === null ? '—' : fmtPct(growth, 1, true)}
          tone={growth !== null && growth > 0 ? 'ok' : undefined}
          detail={months.length ? `de ${fmtMonthLong(months[0].mois)} à ${fmtMonthLong(months[months.length - 1].mois)}, contre la même période de l’an dernier` : 'consultations, année contre année'}
        />
        <Kpi label="Région la plus active" value={<span className="text-[20px]">{first?.niveau ?? '—'}</span>} detail={first ? `${fmtDec(first.consultations_par_jour_actif, 1)} consultations par jour actif et par unité` : undefined} />
        <Kpi label="Patients revenus" value={ret ? fmtPct(ret.taux_retour_pct, 1) : '—'} detail={ret ? `${fmtInt(ret.patients_revenus)} sur ${fmtInt(ret.patients)} patients en 12 mois` : 'taux de retour'} />
        <Kpi label="Jours couverts" value="Lun. à sam." detail="les unités ne consultent pas le dimanche" />
        <Kpi label="Plage horaire" value="7 h à 19 h" detail="heure de début de consultation" />
      </KpiBand>

      <HeatmapPanel />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Croissance mois par mois" description="Consultations de cette année comparées au même mois de l’année précédente.">
          <DataGate state={croissance} skeleton={<Skeleton className="h-[260px]" />}>
            {(rows) => (rows.length ? <GrowthChart rows={rows} /> : <EmptyState title="Pas de données de croissance" />)}
          </DataGate>
        </Panel>
        <Panel title="Classement des régions" description="Consultations par jour actif et par unité, sur douze mois.">
          <DataGate state={repartition} skeleton={<SkeletonBlock rows={9} height={16} />}>
            {(rows) => (rows.length ? <RegionRanking rows={rows} /> : <EmptyState title="Pas de répartition disponible" />)}
          </DataGate>
        </Panel>
      </div>
    </>
  );
}

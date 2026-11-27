'use client';
import type { ChartOptions } from 'chart.js';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useRpc } from '@/client/rpc';
import { ANOMALY_TYPE_LABELS, CATEGORY_INFO, DETAIL_FROM, DETAIL_TO, EVOLUTION_STATUS_LABELS, catColor, signalLabel } from '@/lib/constants';
import { fmtDay, fmtDayShort, fmtDayWeek, fmtDec, fmtInt, fmtMonth, fmtPct, isSunday } from '@/lib/format';
import type { Anomaly, CentreDetail, ContextDay, EvolutionRow, Prevision } from '@/lib/types';
import { ForecastChart } from '../charts/forecast-chart';
import { baseOptions, useChartTokens } from '../charts/tokens';
import { CategoryBadge, Chip, DataGate, EmptyState, ErrorState, PageHeader, Panel, Skeleton, SkeletonBlock } from '../ui/primitives';
import { AnomalyStatusChip, EventStatusChip, SeverityChip, useHoverTip } from './shared';

function SeriesChart({ detail }: { detail: CentreDetail }) {
  const t = useChartTokens();
  if (!t) return <Skeleton className="h-[300px]" />;
  // Les dimanches (unités fermées) sont retirés du tracé : ils écraseraient la lecture à zéro.
  const s = detail.series.filter((d) => !(isSunday(d.day) && !d.value));
  const base = baseOptions(t, { legend: true, yMin: 0 });
  const options: ChartOptions<'line'> = {
    ...base,
    scales: { ...base.scales, x: { ...base.scales?.x, ticks: { ...base.scales?.x?.ticks, maxTicksLimit: 10 } } },
  };
  return (
    <div className="h-[300px]">
      <Line
        role="img"
        aria-label="Prises en charge quotidiennes, attendu et cible"
        options={options}
        data={{
          labels: s.map((d) => fmtDayShort(d.day)),
          datasets: [
            { label: 'Observé', data: s.map((d) => d.value), borderColor: t.series1, backgroundColor: t.series1, borderWidth: 1.75, pointRadius: 0, pointHoverRadius: 4, tension: 0.1 },
            { label: 'Attendu', data: s.map((d) => d.expected), borderColor: t.ink3, backgroundColor: t.ink3, borderWidth: 1.25, borderDash: [4, 3], pointRadius: 0, tension: 0.1 },
            {
              label: 'Signal',
              data: s.map((d) => (d.signal ? d.value : null)),
              borderColor: t.crit,
              backgroundColor: t.crit,
              pointBorderColor: t.surface,
              showLine: false,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBorderWidth: 2,
            },
            {
              label: `Cible (${detail.centre.target})`,
              data: s.map(() => detail.centre.target),
              borderColor: t.ok,
              backgroundColor: t.ok,
              borderWidth: 1,
              borderDash: [1, 3],
              pointRadius: 0,
              pointHoverRadius: 0,
            },
          ],
        }}
      />
    </div>
  );
}

/** Frise du contexte jour par jour : météo défavorable, souk, calendrier. */
function ContextTimeline({ days }: { days: ContextDay[] }) {
  const tip = useHoverTip();
  const rows: { label: string; on: (d: ContextDay) => boolean; color: string }[] = [
    { label: 'Météo défavorable', on: (d) => d.adverse_weather, color: 'var(--series-1)' },
    { label: 'Jour de souk', on: (d) => Boolean(d.souk_today), color: 'var(--cat-c)' },
    { label: 'Calendrier (fête, vacances)', on: (d) => Boolean(d.calendar), color: 'var(--cat-n)' },
  ];
  const describe = (d: ContextDay) => (
    <>
      <strong className="font-semibold">{fmtDayWeek(d.day)}</strong>
      <br />
      {d.t_min_c !== null && d.t_max_c !== null && (
        <>
          {fmtDec(d.t_min_c, 0)} à {fmtDec(d.t_max_c, 0)} °C, pluie {fmtDec(d.precip_mm ?? 0, 1)} mm
          <br />
        </>
      )}
      {[d.heavy_rain && 'pluie forte', d.snow && 'neige', d.strong_wind && 'vent fort', d.extreme_heat && 'chaleur extrême', d.cold && 'froid'].filter(Boolean).join(', ')}
      {d.souk_today && <><br />{d.souk_today}</>}
      {d.calendar && <><br />{d.calendar}</>}
    </>
  );
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[150px_1fr] items-center gap-2">
          <span className="truncate text-[12px] text-ink-2">{r.label}</span>
          <div className="flex h-4 gap-px" role="img" aria-label={`${r.label} : ${days.filter(r.on).length} jours sur ${days.length}`}>
            {days.map((d) => (
              <span
                key={d.day}
                className="flex-1 rounded-[1px]"
                style={{ background: r.on(d) ? r.color : 'var(--sunken)' }}
                onMouseMove={(e) => tip.show(e, describe(d))}
                onMouseLeave={tip.hide}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[150px_1fr] gap-2 text-[11px] text-ink-3">
        <span />
        <div className="flex justify-between">
          <span>{fmtDayShort(days[0]?.day)}</span>
          <span>{fmtDayShort(days[days.length - 1]?.day)}</span>
        </div>
      </div>
      {tip.node}
    </div>
  );
}

function EvolutionBlock({ row }: { row: EvolutionRow }) {
  const tone = row.statut === 'a_risque' ? 'crit' : row.statut === 'declin' ? 'warn' : row.statut === 'croissance' ? 'ok' : 'neutral';
  return (
    <div className="space-y-3">
      <Chip tone={tone}>{EVOLUTION_STATUS_LABELS[row.statut] ?? row.statut}</Chip>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <div>
          <dt className="text-ink-3">Tendance</dt>
          <dd className="num font-semibold">{fmtPct(row.tendance_pct_an, 1, true)} par an</dd>
        </div>
        <div>
          <dt className="text-ink-3">Par jour ouvré (3 mois)</dt>
          <dd className="num font-semibold">{fmtDec(row.par_jour_3_derniers_mois, 1)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Projection à 3 mois</dt>
          <dd className="num font-semibold">{fmtDec(row.prevision_3_mois, 1)} par jour</dd>
        </div>
        <div>
          <dt className="text-ink-3">Pour 1 000 habitants</dt>
          <dd className="num font-semibold">
            {fmtDec(row.pour_1000_hab_an, 0)}
            {row.mediane_reseau_pour_1000 !== null && <span className="font-normal text-ink-3"> (médiane {fmtDec(row.mediane_reseau_pour_1000, 0)})</span>}
          </dd>
        </div>
      </dl>
      {row.recommandation && <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink">{row.recommandation}</p>}
    </div>
  );
}

export function UnitView({ id }: { id: number }) {
  const range = { p_centre_id: id, p_from: DETAIL_FROM, p_to: DETAIL_TO };
  const detail = useRpc<CentreDetail>('ui_centre_detail', range);
  const ctx = useRpc<ContextDay[]>('ctx_centre_context', range);
  const anomalies = useRpc<Anomaly[]>('ui_anomalies', { p_du: DETAIL_FROM, p_au: DETAIL_TO, p_centre_id: id });
  const prev = useRpc<Prevision>('ui_prevision', { p_centre_id: id });
  const evo = useRpc<EvolutionRow[]>('ui_evolution', {});
  const evoRow = useMemo(() => evo.data?.find((r) => r.centre_id === id), [evo.data, id]);

  const back = (
    <Link href="/unites" className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Toutes les unités
    </Link>
  );

  if (detail.error) {
    return (
      <>
        <div className="mb-4">{back}</div>
        <PageHeader title="Fiche unité" />
        <ErrorState
          title={detail.error.status === 403 ? 'Accès refusé' : undefined}
          message={detail.error.message}
          onRetry={detail.error.status === 403 ? undefined : detail.reload}
        />
      </>
    );
  }
  const d = detail.data;
  const c = d?.centre;
  return (
    <>
      <div className="mb-4">{back}</div>
      {!c ? (
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-60" />
        </div>
      ) : (
        <PageHeader
          title={c.centre_name}
          description={
            <>
              {c.province}, {c.region}
            </>
          }
        >
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <CategoryBadge category={c.category} size="lg" />
              <div className="leading-tight">
                <p className="text-[13px] font-medium">{CATEGORY_INFO[c.category]?.label}</p>
                <p className="text-[12px] text-ink-3">Catégorie sur 30 jours</p>
              </div>
            </div>
            <div className="leading-tight">
              <p className="num text-[22px] font-semibold">
                {fmtDec(c.mean_value, 1)} <span className="text-[13px] font-normal text-ink-3">par jour</span>
              </p>
              <p className="num text-[12px] text-ink-3">
                IC 95 % {fmtDec(c.ci_low, 1)}–{fmtDec(c.ci_high, 1)}, cible {fmtInt(c.target)}
              </p>
            </div>
            <div className="leading-tight">
              <p className="num text-[22px] font-semibold">{fmtInt(c.days_zero)}</p>
              <p className="text-[12px] text-ink-3">jours sans activité</p>
            </div>
            {c.attention_reason && (
              <Chip tone="warn" icon={<TriangleAlert className="h-3 w-3" aria-hidden="true" />} className="whitespace-normal">
                {c.attention_reason}
              </Chip>
            )}
          </div>
        </PageHeader>
      )}

      <Panel title="Activité quotidienne" description={`Prises en charge observées et attendues du ${fmtDay(DETAIL_FROM)} au ${fmtDay(DETAIL_TO)}, hors dimanches ; les points rouges marquent un signal.`}>
        {d ? <SeriesChart detail={d} /> : <Skeleton className="h-[300px]" />}
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-[13px] font-medium text-ink">Contexte jour par jour</p>
          <DataGate state={ctx} skeleton={<SkeletonBlock rows={3} height={14} />}>
            {(days) => (days.length ? <ContextTimeline days={days} /> : <EmptyState title="Pas de contexte disponible pour cette période" />)}
          </DataGate>
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Anomalies de l’unité" description="Jours anormaux détectés sur la période." bodyClassName="p-0 md:p-0">
          <DataGate state={anomalies} skeleton={<div className="p-5"><SkeletonBlock rows={4} /></div>}>
            {(rows) =>
              rows.length ? (
                <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
                  {[...rows]
                    .sort((a, b) => (a.jour < b.jour ? 1 : -1))
                    .map((a) => (
                      <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] md:px-5">
                        <span className="num w-24 shrink-0 text-ink-2">{fmtDayShort(a.jour)}</span>
                        <span className="min-w-0 flex-1">
                          {ANOMALY_TYPE_LABELS[a.type] ?? a.type} : <span className="num">{fmtDec(a.observe, 0)}</span> pour <span className="num">{fmtDec(a.attendu, 0)}</span> attendues
                          {a.cause_proposee && <span className="block text-[12px] text-ink-3">{a.cause_proposee}</span>}
                        </span>
                        <AnomalyStatusChip statut={a.statut} />
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="p-5">
                  <EmptyState title="Aucune anomalie sur la période" />
                </div>
              )
            }
          </DataGate>
          <div className="border-t border-line px-5 py-2.5">
            <Link href="/anomalies" className="text-[13px] font-medium text-accent hover:underline">
              Enquêter dans Anomalies & enquêtes
            </Link>
          </div>
        </Panel>

        <Panel title="Prévision à 14 jours" description="Consultations prévues, avec un intervalle à 90 %.">
          <DataGate state={prev} skeleton={<Skeleton className="h-[240px]" />}>
            {(p) =>
              !p.modele ? (
                <EmptyState title="Modèle non encore ajusté">La prévision apparaîtra après le premier ajustement du modèle.</EmptyState>
              ) : p.jours.length ? (
                <ForecastChart jours={p.jours} height={240} />
              ) : (
                <EmptyState title="Aucun jour à prévoir" />
              )
            }
          </DataGate>
        </Panel>

        <Panel title="Évolution et population" description="Tendance sur 12 mois et fréquentation rapportée à la population de la province.">
          <DataGate state={evo} skeleton={<SkeletonBlock rows={4} />}>
            {() => (evoRow ? <EvolutionBlock row={evoRow} /> : <EmptyState title="Pas d’indicateur d’évolution pour cette unité" />)}
          </DataGate>
        </Panel>

        <Panel title="Événements et historique" bodyClassName="space-y-4">
          {!d ? (
            <SkeletonBlock rows={3} />
          ) : (
            <>
              <div>
                <p className="mb-2 text-[13px] font-medium">Catégorie mois par mois</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.category_history.map((h) => (
                    <div key={h.period_end} className="flex w-[52px] flex-col items-center gap-0.5" title={`${fmtMonth(h.period_end)} : ${fmtDec(h.mean_value, 1)} par jour`}>
                      <span className="flex h-6 w-full items-center justify-center rounded-[4px] text-[11px] font-semibold" style={{ background: catColor(h.category), color: `var(--cat-${h.category.toLowerCase()}-ink)` }}>
                        {h.category}
                      </span>
                      <span className="text-[11px] text-ink-3">{fmtMonth(h.period_end).replace(/\s\d{4}$/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium">Événements{d.events.length ? ` (${fmtInt(d.events.length)})` : ''}</p>
                {d.events.length ? (
                  <ul className="space-y-2">
                    {d.events.map((e) => (
                      <li key={e.id} className="rounded-md border border-line px-3 py-2 text-[13px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityChip severity={e.severity} />
                          <EventStatusChip status={e.status} />
                          <span className="font-medium">{signalLabel(e.signal_type)}</span>
                          <span className="num ml-auto text-[12px] text-ink-3">
                            {e.first_seen === e.last_seen ? fmtDayShort(e.first_seen) : `du ${fmtDayShort(e.first_seen)} au ${fmtDayShort(e.last_seen)}`}
                          </span>
                        </div>
                        <p className="mt-1 text-ink-2">{e.message}</p>
                        {e.explanation && <p className="mt-1 text-[12px] text-ink-3">Explication : {e.explanation}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-3">Aucun événement.</p>
                )}
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

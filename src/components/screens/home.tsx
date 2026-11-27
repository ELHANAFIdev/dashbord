'use client';
import { ArrowRight, BellRing, CircleCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useRpc } from '@/client/rpc';
import { useSession } from '@/client/session';
import { CATEGORIES_MAIN, CATEGORY_INFO, DATA_DAY, DETAIL_FROM, YEAR_FROM, YEAR_TO, catColor, signalLabel } from '@/lib/constants';
import { fmtDay, fmtDayShort, fmtDec, fmtInt, fmtMonth, fmtTime, plural } from '@/lib/format';
import type { Anomaly, Dashboard, EventRow, EvolutionRow, MapUnit, VolumeRow } from '@/lib/types';
import { baseOptions, useChartTokens } from '../charts/tokens';
import { CategoryBadge, DataGate, EmptyState, Kpi, KpiBand, PageHeader, Panel, Skeleton, SkeletonBlock } from '../ui/primitives';
import { SeverityChip, UnitLink, useHoverTip } from './shared';

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function UnitStrip({ units }: { units: MapUnit[] }) {
  const tip = useHoverTip();
  const byCat = useMemo(() => {
    const g: Record<string, MapUnit[]> = {};
    for (const u of units) (g[u.category] ??= []).push(u);
    for (const k of Object.keys(g)) g[k].sort((a, b) => b.mean_value - a.mean_value);
    return g;
  }, [units]);
  const others = units.filter((u) => !CATEGORIES_MAIN.includes(u.category));

  return (
    <div>
      <ul className="space-y-2.5">
        {CATEGORIES_MAIN.map((c) => {
          const list = byCat[c] ?? [];
          return (
            <li key={c} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[220px_1fr] sm:gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CategoryBadge category={c} />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[13px] font-medium text-ink">{CATEGORY_INFO[c].label}</p>
                  <p className="truncate text-[12px] text-ink-3">{CATEGORY_INFO[c].range}</p>
                </div>
                <span className="num ml-auto text-[18px] font-semibold text-ink">{fmtInt(list.length)}</span>
              </div>
              <div className="flex min-h-[18px] flex-wrap gap-[4px] py-[3px]">
                {list.map((u) => (
                  <Link
                    key={u.centre_id}
                    href={`/unites/${u.centre_id}`}
                    tabIndex={-1}
                    aria-label={`${u.centre_name}, ${u.mean_value} par jour`}
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <strong className="font-semibold">{u.centre_name}</strong>
                          <br />
                          {u.region}
                          <br />
                          <span className="num">{fmtDec(u.mean_value, 1)}</span> prises en charge par jour
                          {u.open_events > 0 && <><br />{plural(u.open_events, 'alerte ouverte', 'alertes ouvertes')}</>}
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                    className="block h-[16px] w-[16px] rounded-[3px] transition-transform hover:scale-125"
                    style={{ background: catColor(c), outline: u.open_events > 0 ? '2px solid var(--crit)' : undefined, outlineOffset: 1 }}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {others.length > 0 && <p className="mt-3 text-[12px] text-ink-3">{plural(others.length, 'unité non classée', 'unités non classées')} (nouvelles ou données insuffisantes).</p>}
      <p className="mt-4 text-[12px] text-ink-3">
        Une case par unité, classée selon sa moyenne de prises en charge par jour sur 30 jours (cible : 21). Une case cerclée de rouge a une alerte ouverte. Survolez une case pour le détail, cliquez pour ouvrir la fiche.
      </p>
      {tip.node}
    </div>
  );
}

function TrendChart({ rows }: { rows: VolumeRow[] }) {
  const t = useChartTokens();
  if (!t) return <Skeleton className="h-[240px]" />;
  const options = baseOptions(t, { yMin: 0 });
  const last = rows[rows.length - 1];
  return (
    <div>
      <div className="h-[240px]">
        <Line
          aria-label="Consultations par mois sur douze mois"
          role="img"
          options={options}
          data={{
            labels: rows.map((r) => fmtMonth(r.periode)),
            datasets: [
              {
                label: 'Consultations',
                data: rows.map((r) => r.consultations),
                borderColor: t.series1,
                backgroundColor: t.series1,
                borderWidth: 2,
                pointRadius: rows.map((_, i) => (i === rows.length - 1 ? 4 : 0)),
                pointHoverRadius: 5,
                tension: 0.25,
              },
            ],
          }}
        />
      </div>
      {last && (
        <p className="mt-2 text-[12px] text-ink-3">
          Dernier mois complet ({fmtMonth(last.periode)}) : <span className="num font-medium text-ink">{fmtInt(last.consultations)}</span> consultations,{' '}
          <span className="num">{fmtInt(last.patients)}</span> patients.
        </p>
      )}
    </div>
  );
}

export function HomeView() {
  const { user } = useSession();
  const dash = useRpc<Dashboard>('ui_dashboard', {});
  const map = useRpc<MapUnit[]>('ui_map', {});
  const events = useRpc<EventRow[]>('ui_events', { p_status: 'open' });
  const volumes = useRpc<VolumeRow[]>('flux_indicateurs', { p_indicateur: 'volumes', p_du: YEAR_FROM, p_au: YEAR_TO, p_niveau: 'national', p_grain: 'mois' });
  const anomalies = useRpc<Anomaly[]>('ui_anomalies', { p_du: DETAIL_FROM, p_au: DATA_DAY, p_statut: 'a_enqueter' });
  const evolution = useRpc<EvolutionRow[]>('ui_evolution', {});

  const regional = Boolean(user.region);
  const d = dash.data;
  const units = map.data;
  const openEvents = events.data;
  const urgent = openEvents?.filter((e) => e.severity === 'high').length;
  const attention = units?.filter((u) => u.attention).length;
  const topAlerts = useMemo(
    () =>
      [...(openEvents ?? [])]
        .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) || (a.last_seen < b.last_seen ? 1 : -1))
        .slice(0, 5),
    [openEvents],
  );
  const atRisk = evolution.data?.filter((e) => e.statut === 'a_risque').length;

  return (
    <>
      <PageHeader
        title="Vue d’ensemble"
        description={
          d ? (
            <>
              État du réseau au {fmtDay(d.day)}{regional ? `, région ${user.region}` : ''} : ce qui demande une action aujourd’hui.
            </>
          ) : (
            'État du réseau et actions du jour.'
          )
        }
      />

      {dash.error ? (
        <DataGate state={dash}>{() => null}</DataGate>
      ) : (
        <KpiBand loading={!d || !units || !openEvents}>
          {d && units && openEvents && (
            <>
              <Kpi
                href="/carte"
                label="Unités actives"
                value={
                  regional ? (
                    fmtInt(units.length)
                  ) : (
                    <>
                      {fmtInt(d.centres_actifs)}
                      <span className="text-[18px] font-normal text-ink-3"> / {fmtInt(d.centres_total)}</span>
                    </>
                  )
                }
                detail={regional ? `dans la région (${fmtInt(d.centres_total)} au total)` : 'ont transmis des données'}
              />
              <Kpi href="/affluence" label="Prises en charge du jour" value={fmtInt(d.pec_total)} detail={`${fmtInt(d.consultations_total)} consultations, médiane ${fmtInt(d.pec_median_centre)} par unité${regional ? ' (réseau)' : ''}`} />
              <Kpi
                href="/alertes"
                label="Alertes ouvertes"
                value={fmtInt(openEvents.length)}
                tone={urgent ? 'crit' : undefined}
                detail={urgent ? `dont ${plural(urgent, 'urgente', 'urgentes')}` : 'aucune urgente'}
                icon={<BellRing className="h-3.5 w-3.5" aria-hidden="true" />}
              />
              <Kpi href="/liste-rouge" label="Unités à surveiller" value={fmtInt(attention ?? 0)} tone={attention ? 'warn' : undefined} detail="niveau faible, baisse ou jours sans activité" />
              <Kpi
                href="/sante"
                label="Dernière nuit"
                value={d.last_night ? (d.last_night.ok ? 'Réussie' : 'En échec') : '—'}
                tone={d.last_night ? (d.last_night.ok ? 'ok' : 'crit') : undefined}
                icon={d.last_night?.ok ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
                detail={d.last_night ? `calculs terminés à ${fmtTime(d.last_night.ended_at)}` : 'aucun passage enregistré'}
              />
            </>
          )}
        </KpiBand>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title={units ? `Les ${fmtInt(units.length)} unités selon la règle des 21` : 'Répartition des unités'}
            description="Catégorie de chaque unité : prises en charge par jour, cible 21."
            actions={
              <Link href="/carte" className="text-[13px] font-medium text-accent hover:underline">
                Voir sur la carte
              </Link>
            }
          >
            <DataGate state={map} skeleton={<SkeletonBlock rows={5} height={22} />}>
              {(u) => (u.length ? <UnitStrip units={u} /> : <EmptyState title="Aucune unité">Aucune unité n’est visible pour votre profil.</EmptyState>)}
            </DataGate>
          </Panel>
          <Panel title="Consultations du réseau sur douze mois" description="Total national par mois, du mois d’août 2025 à juillet 2026.">
            <DataGate state={volumes} skeleton={<Skeleton className="h-[240px]" />}>
              {(rows) => (rows.length ? <TrendChart rows={rows} /> : <EmptyState title="Pas de données de volume sur la période" />)}
            </DataGate>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Alertes prioritaires"
            description="Les cinq alertes ouvertes les plus graves."
            actions={
              <Link href="/alertes" className="text-[13px] font-medium text-accent hover:underline">
                Toutes les alertes
              </Link>
            }
            bodyClassName="p-0 md:p-0"
          >
            <DataGate state={events} skeleton={<div className="p-5"><SkeletonBlock rows={5} /></div>}>
              {() =>
                topAlerts.length ? (
                  <ul className="divide-y divide-line">
                    {topAlerts.map((e) => (
                      <li key={e.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                        <SeverityChip severity={e.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px]">
                            <UnitLink id={e.centre_id} name={e.centre_name} /> <span className="text-ink-3">{e.province}</span>
                          </p>
                          <p className="mt-0.5 text-[13px] text-ink-2">
                            {signalLabel(e.signal_type)} : {e.message}
                          </p>
                        </div>
                        <span className="num shrink-0 text-[12px] text-ink-3">{fmtDayShort(e.last_seen)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-5">
                    <EmptyState title="Aucune alerte ouverte">Toutes les alertes ont été traitées.</EmptyState>
                  </div>
                )
              }
            </DataGate>
          </Panel>

          <Panel title="À examiner" bodyClassName="p-0 md:p-0">
            <ul className="divide-y divide-line">
              <li>
                <Link href="/anomalies" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 md:px-5">
                  <span className="num w-14 text-[24px] font-semibold text-ink">{anomalies.data ? fmtInt(anomalies.data.length) : '…'}</span>
                  <span className="flex-1 text-[13px] text-ink-2">jours anormaux à enquêter depuis le {fmtDay(DETAIL_FROM)}</span>
                  <ArrowRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/evolution" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 md:px-5">
                  <span className="num w-14 text-[24px] font-semibold text-ink">{atRisk !== undefined ? fmtInt(atRisk) : '…'}</span>
                  <span className="flex-1 text-[13px] text-ink-2">unités à risque (baisse durable ou niveau très faible)</span>
                  <ArrowRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
                </Link>
              </li>
            </ul>
            {(anomalies.error || evolution.error) && (
              <p className="px-5 pb-3 text-[12px] text-crit">Certains compteurs sont indisponibles : {(anomalies.error ?? evolution.error)?.message}</p>
            )}
          </Panel>
        </div>
      </div>


    </>
  );
}

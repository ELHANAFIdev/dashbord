'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { DashboardKPIs, EventItem } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/constants';
import { ScreenId } from '../Sidebar';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (screen: ScreenId, centreId?: number) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<EventItem[]>([]);
  const [weekly, setWeekly] = useState<{ period: string; pec: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashData, eventsData, seriesData] = await Promise.all([
          callRpc<DashboardKPIs>('ui_dashboard'),
          callRpc<EventItem[]>('ui_events', { status: 'open' }),
          callRpc<{ period: string; pec: number }[]>('flux_series', { p_level: 'national', p_grain: 'week' })
        ]);
        setKpis(dashData);
        setRecentAlerts(eventsData.slice(0, 5));
        setWeekly(seriesData.slice(-12));
      } catch (e) {
        console.error('Erreur chargement dashboard', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !kpis) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const weeklyMax = weekly.length ? Math.max(...weekly.map((w) => w.pec)) * 1.1 : 0;
  const weeklyMean = weekly.length ? weekly.reduce((a, w) => a + w.pec, 0) / weekly.length : 0;

  // Distribution A-E
  const categoriesDist = [
    { cat: 'A' as const, count: 42, pct: '40.4%' },
    { cat: 'B' as const, count: 24, pct: '23.1%' },
    { cat: 'C' as const, count: 12, pct: '11.5%' },
    { cat: 'D' as const, count: 15, pct: '14.4%' },
    { cat: 'E' as const, count: 7, pct: '6.7%' },
    { cat: 'N' as const, count: 2, pct: '1.9%' },
    { cat: 'X' as const, count: 2, pct: '1.9%' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 shadow-xl sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Tableau de Bord National UMMC
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Supervision opérationnelle des 104 unités médicales mobiles connectées
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('live')}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500"
          >
            <Clock className="h-4 w-4" />
            <span>Rejouer le 13/08 en Direct</span>
          </button>
        </div>
      </div>

      {/* 5 Main Metric Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Centres Actifs */}
        <div
          onClick={() => onNavigate('map')}
          className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-850 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Centres actifs</span>
            <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{kpis.centres_actifs}</span>
            <span className="text-xs text-slate-400">/ {kpis.centres_total}</span>
          </div>
          <p className="mt-1 text-[11px] text-teal-400">94.2% de disponibilité</p>
        </div>

        {/* Prises en charge */}
        <div
          onClick={() => onNavigate('stats')}
          className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-850 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Prises en charge</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{kpis.pec_total.toLocaleString('fr-FR')}</span>
            <span className="text-xs text-slate-400">actes</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400">Médiane : {kpis.pec_median_centre} / centre (Obj &gt; 21)</p>
        </div>

        {/* Alertes ouvertes */}
        <div
          onClick={() => onNavigate('alerts')}
          className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-850 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Alertes ouvertes</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">{kpis.events_open}</span>
            <span className="text-xs text-red-400">({kpis.events_urgent} urgentes)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Centre silencieux & anom.</p>
        </div>

        {/* Centres à surveiller */}
        <div
          onClick={() => onNavigate('redlist')}
          className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-850 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Liste rouge</span>
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-400">{kpis.attention}</span>
            <span className="text-xs text-slate-400">centres</span>
          </div>
          <p className="mt-1 text-[11px] text-red-400/90 font-medium">Baisse ou &lt; 21 consultations</p>
        </div>

        {/* Dernière nuit */}
        <div
          onClick={() => onNavigate('health')}
          className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-850 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Dernière nuit FW-A</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">OK</span>
            <span className="text-xs text-slate-400">02:04</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">104 centres recalculés</p>
        </div>
      </div>

      {/* Category Breakdown Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Répartition des catégories (A à E, N, X)</h2>
          <span className="text-xs text-slate-400">Règle des 21 prises en charge/jour</span>
        </div>

        <div className="mt-4 flex h-6 w-full overflow-hidden rounded-xl bg-slate-800">
          {categoriesDist.map((c) => (
            <div
              key={c.cat}
              style={{ width: c.pct, backgroundColor: CATEGORY_COLORS[c.cat].hex }}
              className="flex items-center justify-center text-[10px] font-bold text-white transition-all hover:opacity-80"
              title={`Catégorie ${c.cat}: ${c.count} centres (${c.pct})`}
            >
              {c.cat}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {categoriesDist.map((c) => (
            <div key={c.cat} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/30 p-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[c.cat].hex }}
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">
                  Cat. {c.cat} : {c.count}
                </span>
                <span className="text-[10px] text-slate-400">{c.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid: National 12-Month Curve Preview & 5 Latest Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* National 12-Month Series Preview */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Évolution nationale (12 dernières semaines)</h2>
            <button
              onClick={() => onNavigate('history')}
              className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300"
            >
              <span>Voir tout</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Total des prises en charge hebdomadaires
            {weekly.length > 0 && ` (moyenne ${Math.round(weeklyMean).toLocaleString('fr-FR')} / sem)`}
          </p>

          <div className="mt-6 flex h-48 items-end gap-2 border-b border-slate-800 pb-2">
            {weekly.map((w) => (
              <div key={w.period} className="group relative flex h-full flex-1 flex-col items-center">
                {/* Plot area: the bar is absolute so its % height resolves against it */}
                <div className="relative w-full flex-1">
                  <div
                    style={{ height: `${weeklyMax > 0 ? (w.pec / weeklyMax) * 100 : 0}%` }}
                    className="absolute bottom-0 left-0 w-full rounded-t-md bg-gradient-to-t from-teal-700 to-emerald-400 transition-all group-hover:from-teal-600 group-hover:to-emerald-300"
                  />
                </div>
                <span className="mt-2 text-[9px] text-slate-500">S{w.period.slice(6)}</span>
                {/* Tooltip on hover */}
                <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white shadow group-hover:block">
                  {w.pec.toLocaleString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
          {weekly.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{weekly[0].period}</span>
              <span>Source : flux_series</span>
              <span>{weekly[weekly.length - 1].period}</span>
            </div>
          )}
        </div>

        {/* 5 Dernières Alertes */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Dernières alertes de la journée</h2>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                {recentAlerts.length}
              </span>
            </div>
            <button
              onClick={() => onNavigate('alerts')}
              className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300"
            >
              <span>Gérer les alertes</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {recentAlerts.map((ev) => (
              <div
                key={ev.id}
                onClick={() => onNavigate('centre', ev.centre_id)}
                className="group flex cursor-pointer items-start justify-between rounded-xl border border-slate-800/80 bg-slate-800/30 p-3 transition hover:border-slate-700 hover:bg-slate-850"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-lg p-1.5 ${
                      ev.severity === 'high'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400">
                        {ev.centre_name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                          ev.severity === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {ev.signal_type}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-300">{ev.message}</p>
                  </div>
                </div>
                <span className="flex-shrink-0 text-[10px] text-slate-400">13/08/2026</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

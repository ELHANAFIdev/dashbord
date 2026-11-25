'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { CentreDetailData, ContextDayItem } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/constants';
import { ScreenId } from '../Sidebar';
import {
  Building2,
  Calendar,
  CloudSnow,
  Sun,
  Wind,
  ShoppingBag,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  TrendingDown,
  Layers
} from 'lucide-react';

interface CentreDetailViewProps {
  centreId?: number;
  onNavigate: (screen: ScreenId) => void;
}

export function CentreDetailView({ centreId = 70, onNavigate }: CentreDetailViewProps) {
  const [data, setData] = useState<CentreDetailData | null>(null);
  const [contexts, setContexts] = useState<ContextDayItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('2026-08-13');
  const [selectedMeasure, setSelectedMeasure] = useState<string>('pec');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCentre() {
      try {
        const [centreRes, contextRes] = await Promise.all([
          callRpc<CentreDetailData>('ui_centre_detail', { p_centre_id: centreId, p_measure: selectedMeasure }),
          callRpc<ContextDayItem[]>('ctx_centre_context', { p_centre_id: centreId })
        ]);
        setData(centreRes);
        setContexts(contextRes);
      } catch (err) {
        console.error('Erreur chargement fiche centre', err);
      } finally {
        setLoading(false);
      }
    }
    loadCentre();
  }, [centreId, selectedMeasure]);

  if (loading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const { centre, series, category_history, events } = data;
  const currentContext = contexts.find((c) => c.day === selectedDay) || contexts[0];
  const catCfg = CATEGORY_COLORS[centre.category] || CATEGORY_COLORS.X;
  const chartMax =
    Math.max(centre.target, ...series.map((s) => Math.max(s.value, s.expected))) * 1.15;

  return (
    <div className="space-y-6">
      {/* Return button */}
      <button
        onClick={() => onNavigate('map')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Retour à la carte nationale</span>
      </button>

      {/* Header Fiche Centre */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl lg:flex-row lg:items-center">
        <div className="flex items-start gap-4">
          <div
            style={{ backgroundColor: catCfg.hex }}
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-xl"
          >
            {centre.category}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {centre.centre_name}
              </h1>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                ID #{centre.centre_id}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {centre.province} • <span className="font-semibold text-teal-400">{centre.region}</span>
            </p>
          </div>
        </div>

        {/* Stats summary badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Moyenne journalière</span>
            <p className="text-base font-black text-white">
              {centre.mean_value} <span className="text-xs font-normal text-slate-400">actes/j</span>
            </p>
            <span className="text-[10px] text-slate-500">IC [{centre.ci_low} – {centre.ci_high}]</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Cible nationale</span>
            <p className="text-base font-black text-emerald-400">&gt; 21</p>
            <span className="text-[10px] text-slate-500">Prises en charge</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Jours sans activité</span>
            <p className="text-base font-black text-red-400">{centre.days_zero} jours</p>
            <span className="text-[10px] text-slate-500">Ce mois-ci</span>
          </div>
        </div>
      </div>

      {/* Measure Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Layers className="h-4 w-4 text-teal-400" />
          <span>Mesure affichée :</span>
        </div>
        <div className="flex gap-1">
          {[
            { id: 'pec', label: 'Prises en charge' },
            { id: 'patients', label: 'Patients' },
            { id: 'consultations', label: 'Consultations' },
            { id: 'admissions', label: 'Admissions' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMeasure(m.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedMeasure === m.id
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Time Series Chart with Click-to-Inspect Day */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Série journalière (Août 2026) : Valeur observée vs Valeur attendue
            </h2>
            <p className="text-xs text-slate-400">
              Cliquez sur un jour pour examiner le contexte météo, souks et alertes locales
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-teal-400" />
              <span>Valeur observée</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-b-2 border-dashed border-slate-400" />
              <span>Attendu</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-b-2 border-emerald-500" />
              <span>Cible (21)</span>
            </div>
          </div>
        </div>

        {/* Daily chart: plot row (bars, expected markers, target line) + label row */}
        <div className="mt-10">
          <div className="relative flex h-48 gap-2">
            {/* Target line across the plot area */}
            <div
              className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-emerald-500"
              style={{ bottom: `${(centre.target / chartMax) * 100}%` }}
            />
            {series.map((item) => {
              const isSelected = item.day === selectedDay;
              const hasSignal = item.signal !== null;
              const heightPct = Math.min(100, (item.value / chartMax) * 100);
              const expectedPct = Math.min(100, (item.expected / chartMax) * 100);

              return (
                <div
                  key={item.day}
                  onClick={() => setSelectedDay(item.day)}
                  className="group relative flex-1 cursor-pointer"
                >
                  {/* Bar (absolute so its % height resolves against the plot row) */}
                  <div
                    style={{ height: `${Math.max(2, heightPct)}%` }}
                    className={`absolute bottom-0 left-0 w-full rounded-t-md transition-all ${
                      isSelected
                        ? 'bg-gradient-to-t from-teal-500 to-emerald-300 ring-2 ring-white'
                        : hasSignal
                        ? 'bg-red-500/80 group-hover:bg-red-400'
                        : item.value >= centre.target
                        ? 'bg-emerald-500 group-hover:bg-emerald-400'
                        : 'bg-slate-700 group-hover:bg-teal-600'
                    }`}
                  />
                  {/* Expected value marker */}
                  <div
                    style={{ bottom: `${expectedPct}%` }}
                    className="absolute left-0 w-full border-b-2 border-dashed border-slate-300"
                  />
                  {/* Signal badge, just above the bar or the expected marker */}
                  {hasSignal && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{ bottom: `calc(${Math.max(heightPct, expectedPct)}% + 6px)` }}
                    >
                      <span className="whitespace-nowrap rounded bg-red-500 px-1 py-0.5 text-[8px] font-black text-white shadow">
                        ▲ {item.signal === 'SILENT_CENTRE' ? 'SILENCE' : 'ANOM'}
                      </span>
                    </div>
                  )}
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-12 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-white shadow-xl group-hover:block">
                    <div><strong>{item.day}</strong></div>
                    <div>Obs : {item.value} | Att : {item.expected}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-slate-800 pt-2">
            {series.map((item) => (
              <span
                key={item.day}
                onClick={() => setSelectedDay(item.day)}
                className={`flex-1 cursor-pointer text-center text-[10px] font-semibold ${
                  item.day === selectedDay ? 'text-white underline' : 'text-slate-500'
                }`}
              >
                {item.day.slice(8, 10)}/{item.day.slice(5, 7)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Split Grid: Contexte du jour sélectionné & Historique des catégories */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contexte du jour (Météo, Souks, Événements) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-white">
                Contexte du jour : <strong className="text-teal-300">{selectedDay}</strong>
              </h3>
            </div>
            <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              Source Open-Meteo & Référentiel Souks
            </span>
          </div>

          {currentContext ? (
            <div className="mt-4 space-y-3.5">
              {/* Weather Info */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <div className="flex items-center gap-3">
                  {currentContext.snow ? (
                    <CloudSnow className="h-6 w-6 text-blue-400" />
                  ) : currentContext.extreme_heat ? (
                    <Sun className="h-6 w-6 text-amber-400" />
                  ) : (
                    <Wind className="h-6 w-6 text-teal-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-white">Conditions Météo</span>
                    <p className="text-[11px] text-slate-400">
                      Températures : {currentContext.t_min_c}°C min / {currentContext.t_max_c}°C max
                    </p>
                  </div>
                </div>
                {currentContext.adverse_weather && (
                  <span className="rounded-md bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">
                    Météo défavorable
                  </span>
                )}
              </div>

              {/* Souk Info */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">Souk Hebdomadaire</span>
                    <p className="text-[11px] text-slate-400">
                      {currentContext.souk_today || 'Aucun souk majeur à proximité ce jour'}
                    </p>
                  </div>
                </div>
                {currentContext.souk_today && (
                  <span className="rounded-md bg-teal-500/20 px-2 py-1 text-[10px] font-bold text-teal-300">
                    Impact fréquentation
                  </span>
                )}
              </div>

              {/* Calendar / Provincial Events */}
              {currentContext.calendar && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
                  <span className="font-bold text-red-400">Alerte provinciale / Calendrier :</span>
                  <p className="mt-1 text-[11px]">{currentContext.calendar}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Aucun événement particulier enregistré pour cette journée.
            </div>
          )}
        </div>

        {/* Historique des catégories (6 mois) & Alertes du centre */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Historique des Catégories (Derniers 6 mois)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Tendance d&apos;activité : {centre.mean_value < 8 ? 'Niveau critique persistant' : 'Conforme'}
            </p>

            <div className="mt-4 flex items-center gap-2">
              {category_history.map((h, i) => {
                const cCfg = CATEGORY_COLORS[h.category] || CATEGORY_COLORS.X;
                return (
                  <div
                    key={i}
                    className="flex flex-1 flex-col items-center rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 text-center"
                  >
                    <span
                      style={{ backgroundColor: cCfg.hex }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white shadow"
                    >
                      {h.category}
                    </span>
                    <span className="mt-2 text-[10px] font-bold text-white">{h.mean_value}</span>
                    <span className="text-[9px] text-slate-500">{h.period_end.slice(5, 7)}/26</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alertes liées à ce centre */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <h4 className="text-xs font-bold text-slate-300">Alertes enregistrées sur ce centre :</h4>
            <div className="mt-2 space-y-2">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-800 bg-slate-800/30 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{ev.signal_type}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        ev.status === 'open'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {ev.status === 'open' ? 'En cours' : 'Expliquée'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{ev.message}</p>
                  {ev.explanation && (
                    <p className="mt-1 text-[10px] text-teal-400">
                      Justification : {ev.explanation} ({ev.ack_by})
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { overlapsRamadan } from '@/lib/calendar';
import { TrendingUp, Calendar, Layers, BarChart2 } from 'lucide-react';

interface SeriesData {
  period: string;
  pec: number;
  patients: number;
  consultations: number;
  admissions: number;
}

export function HistoryView() {
  const [series, setSeries] = useState<SeriesData[]>([]);
  const [selectedGrain, setSelectedGrain] = useState<'week' | 'month'>('week');
  const [activeMeasure, setActiveMeasure] = useState<'pec' | 'patients' | 'consultations' | 'admissions'>('pec');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSeries() {
      try {
        const data = await callRpc<SeriesData[]>('flux_series', {
          p_level: 'national',
          p_grain: selectedGrain
        });
        setSeries(data);
      } catch (err) {
        console.error('Erreur chargement séries historiques', err);
      } finally {
        setLoading(false);
      }
    }
    loadSeries();
  }, [selectedGrain]);

  const values = series.map((s) => s[activeMeasure] || 0);
  const maxValue = values.length ? Math.max(...values) * 1.1 : 0;
  const meanValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Flux Historique National UMMC
              </h1>
              <p className="text-xs text-slate-400">
                Évolution globale de l&apos;activité depuis Septembre 2023 avec suivi saisonnier (Ramadan, Aïd)
              </p>
            </div>
          </div>
        </div>

        {/* Grain toggles */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-1">
          <button
            onClick={() => setSelectedGrain('week')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedGrain === 'week' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hebdomadaire
          </button>
          <button
            onClick={() => setSelectedGrain('month')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedGrain === 'month' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mensuel
          </button>
        </div>
      </div>

      {/* Measure buttons */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        {[
          { id: 'pec', label: 'Prises en charge (PEC)' },
          { id: 'patients', label: 'Patients distincts' },
          { id: 'consultations', label: 'Consultations médicales' },
          { id: 'admissions', label: 'Admissions à l’accueil' }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveMeasure(m.id as typeof activeMeasure)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeMeasure === m.id
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Historical Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Courbe d’évolution : <span className="text-teal-400 capitalize">{activeMeasure}</span>
            </h2>
            <p className="text-xs text-slate-400">
              {series.length > 0
                ? `Moyenne ${selectedGrain === 'week' ? 'hebdomadaire' : 'mensuelle'} : ${Math.round(meanValue).toLocaleString('fr-FR')} (${series[0].period} → ${series[series.length - 1].period})`
                : 'Aucune donnée'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-purple-500/30 border border-purple-500/50" />
              <span>Zone Ramadan (Activité ralentie)</span>
            </div>
          </div>
        </div>

        {/* Visual curve container */}
        <div className="mt-8 flex h-64 items-end gap-3 border-b border-slate-800 pb-4">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              Chargement des séries...
            </div>
          ) : (
            series.map((item) => {
              const val = item[activeMeasure] || 0;
              const heightPct = maxValue > 0 ? Math.min(100, (val / maxValue) * 100) : 0;
              const isRamadanZone = overlapsRamadan(item.period);

              return (
                <div
                  key={item.period}
                  className={`group relative flex h-full flex-1 flex-col items-center rounded-t-lg transition-all ${
                    isRamadanZone ? 'bg-purple-950/20' : ''
                  }`}
                >
                  {/* Bar: absolutely positioned so its % height resolves against the plot area */}
                  <div className="relative w-full flex-1">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`absolute bottom-0 left-0 w-full rounded-t-md transition-all ${
                        isRamadanZone
                          ? 'bg-gradient-to-t from-purple-800 to-purple-400 group-hover:brightness-125'
                          : 'bg-gradient-to-t from-teal-700 to-emerald-400 group-hover:from-teal-600 group-hover:to-emerald-300'
                      }`}
                    />
                  </div>

                  {/* Label */}
                  <span className="mt-2 text-[10px] text-slate-400 font-semibold">{item.period.slice(5)}</span>

                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-12 hidden rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-white shadow-xl group-hover:block z-10">
                    <div className="font-bold">{item.period}</div>
                    <div className="text-teal-300">{val.toLocaleString('fr-FR')} {activeMeasure}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

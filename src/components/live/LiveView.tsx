'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { LiveCentreItem } from '@/lib/types';
import {
  Radio,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Users,
  PhoneCall,
  Activity,
  AlertCircle
} from 'lucide-react';

export function LiveView() {
  const [centres, setCentres] = useState<LiveCentreItem[]>([]);
  const [currentHour, setCurrentHour] = useState<number>(10.5); // 10:30
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterSilentOnly, setFilterSilentOnly] = useState<boolean>(false);

  useEffect(() => {
    async function loadLive() {
      try {
        const data = await callRpc<LiveCentreItem[]>('flux_live_centres', {
          p_at: `2026-08-13T${formatTime(currentHour)}:00+01:00`
        });
        setCentres(data);
      } catch (err) {
        console.error('Erreur chargement direct', err);
      } finally {
        setLoading(false);
      }
    }
    loadLive();
  }, [currentHour]);

  // Autoplay loop: advances 0.5 (30 mins) every 2 seconds
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentHour((prev) => {
        if (prev >= 18.0) {
          setIsPlaying(false);
          return 18.0;
        }
        return Number((prev + 0.5).toFixed(1));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  function formatTime(hourFloat: number) {
    const hours = Math.floor(hourFloat);
    const minutes = Math.round((hourFloat - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  const filteredCentres = centres.filter((c) => {
    if (filterSilentOnly && c.status !== 'silencieux') return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Direct Opérationnel — Rejeu du 13/08/2026
              </h1>
              <p className="text-xs text-slate-400">
                Suivi de l&apos;affluence, des files d&apos;attente et détection immédiate des centres silencieux
              </p>
            </div>
          </div>
        </div>

        {/* Play / Pause / Reset Controls */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-850 p-2 shadow-lg">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isPlaying ? 'Pause' : 'Lecture (Simuler journée)'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentHour(8.0);
            }}
            className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white"
            title="Revenir à 08:00"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
            <Clock className="h-4 w-4 text-teal-400" />
            <span className="text-sm font-black text-white">{formatTime(currentHour)}</span>
          </div>
        </div>
      </div>

      {/* Timeline Slider */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>08:00 (Ouverture des centres)</span>
          <span className="font-bold text-emerald-400 text-sm">{formatTime(currentHour)} (Heure simulée)</span>
          <span>18:00 (Clôture journalière)</span>
        </div>
        <input
          type="range"
          min="8.0"
          max="18.0"
          step="0.5"
          value={currentHour}
          onChange={(e) => setCurrentHour(parseFloat(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-500"
        />
      </div>

      {/* Filter and stats row */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={filterSilentOnly}
            onChange={(e) => setFilterSilentOnly(e.target.checked)}
            className="rounded text-red-500 focus:ring-0"
          />
          <span className="font-semibold text-red-400">Afficher uniquement les centres silencieux</span>
        </label>
        <span className="text-xs text-slate-400">
          Total centres supervisés : <strong className="text-white">{filteredCentres.length}</strong>
        </span>
      </div>

      {/* Live Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3.5">Centre</th>
              <th className="px-4 py-3.5">Province</th>
              <th className="px-4 py-3.5">Statut</th>
              <th className="px-4 py-3.5">Admissions</th>
              <th className="px-4 py-3.5">En attente</th>
              <th className="px-4 py-3.5">Consultations</th>
              <th className="px-4 py-3.5">Télé-expertises</th>
              <th className="px-4 py-3.5">Attente Médiane</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredCentres.map((c) => (
              <tr key={c.centre_id} className="transition hover:bg-slate-800/40">
                <td className="px-4 py-3.5 font-bold text-white">{c.centre_name}</td>
                <td className="px-4 py-3.5 text-slate-400">{c.province}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                      c.status === 'actif'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : c.status === 'silencieux'
                        ? 'bg-red-500/20 text-red-300 animate-pulse'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        c.status === 'actif'
                          ? 'bg-emerald-400'
                          : c.status === 'silencieux'
                          ? 'bg-red-400'
                          : 'bg-slate-400'
                      }`}
                    />
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-bold text-white">{c.admissions}</td>
                <td className="px-4 py-3.5 font-semibold text-amber-400">{c.waiting}</td>
                <td className="px-4 py-3.5 text-slate-300">
                  {c.consultations_done} / {c.consultations_started}
                </td>
                <td className="px-4 py-3.5 text-teal-300 font-semibold">{c.teleexpertises}</td>
                <td className="px-4 py-3.5">
                  {c.wait_median_min > 0 ? (
                    <span
                      className={`font-bold ${
                        c.wait_median_min > 30 ? 'text-amber-400' : 'text-slate-300'
                      }`}
                    >
                      {c.wait_median_min} min
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

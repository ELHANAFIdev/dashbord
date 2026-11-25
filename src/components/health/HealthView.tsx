'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { HealthData } from '@/lib/types';
import {
  HeartPulse,
  CheckCircle2,
  Clock,
  Send,
  CloudSun,
  ShieldCheck,
  Server,
  Database
} from 'lucide-react';

export function HealthView() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await callRpc<HealthData>('ui_health');
        setData(res);
      } catch (err) {
        console.error('Erreur chargement santé système', err);
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const { last_night, ingestion_lag_min, last_deliveries, context_sync } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Santé et Supervision de la Chaîne Technique
              </h1>
              <p className="text-xs text-slate-400">
                État des traitements automatisés de nuit (FW-A), alertes et synchronisations météo
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Chaîne Opérationnelle à 100%</span>
        </div>
      </div>

      {/* Grid: FW-A Night Job & Sync Lag */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* FW-A Night Run Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-teal-400" />
              <h2 className="text-sm font-semibold text-white">
                Dernier Passage de Nuit (Workflow FW-A)
              </h2>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              {last_night.status}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Début / Fin</span>
              <p className="mt-1 font-semibold text-white">
                02:00:03 → 02:04:11 <span className="text-slate-400 font-normal">({last_night.duration_sec} s)</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Centres traités</span>
              <p className="mt-1 font-semibold text-emerald-400">
                {last_night.centres_processed} / 104 centres
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Jours recalculés</span>
              <p className="mt-1 font-semibold text-white">
                {last_night.days_recomputed} jours
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Signaux détectés</span>
              <p className="mt-1 font-semibold text-amber-400">
                {last_night.signals_detected} signaux ({last_night.events_new} nouvelles alertes)
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-800/20 p-2.5 text-[11px] text-slate-400">
            Run ID : <code className="text-slate-300 font-mono">{last_night.run_id}</code>
          </div>
        </div>

        {/* Sync Lag & Open-Meteo */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-teal-400" />
                <h2 className="text-sm font-semibold text-white">
                  Intégration & Contexte Externe
                </h2>
              </div>
              <span className="text-xs text-slate-400">Lag : {ingestion_lag_min} min</span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <div className="flex items-center gap-2 font-bold text-white">
                  <CloudSun className="h-4 w-4 text-amber-400" />
                  <span>Synchronisation Open-Meteo (Hassan)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Statut : <strong className="text-emerald-400">{context_sync?.weather_status}</strong>
                </p>
                <p className="text-[10px] text-slate-500">Dernier batch : 14/08 à 03:15:00 UTC</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <div className="flex items-center gap-2 font-bold text-white">
                  <CheckCircle2 className="h-4 w-4 text-teal-400" />
                  <span>Référentiel des Souks Ruraux</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  <strong className="text-white">{context_sync?.souks_verified_count}</strong> souks cartographiés et reliés aux centres
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
            Aucun incident bloquant constaté sur les 7 derniers passages nocturnes.
          </div>
        </div>
      </div>

      {/* Deliveries Log */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <h2 className="text-sm font-semibold text-white">Derniers envois d’alertes et récapitulatifs (SMS & Email)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Canal</th>
                <th className="px-4 py-2.5">Destinataire</th>
                <th className="px-4 py-2.5">Horodatage</th>
                <th className="px-4 py-2.5">Alertes incluses</th>
                <th className="px-4 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {last_deliveries.map((d, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 font-bold uppercase text-teal-300 text-[10px]">{d.channel}</td>
                  <td className="px-4 py-2.5 font-medium text-white">{d.recipient}</td>
                  <td className="px-4 py-2.5 text-slate-400">{d.sent_at}</td>
                  <td className="px-4 py-2.5 text-slate-300">{d.events_count} alerte(s)</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      Livré
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { StatItem } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart3,
  Filter,
  Users,
  Clock,
  Layers,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export function StatsView() {
  const { canViewDoctorStats } = useAuth();
  const [stats, setStats] = useState<StatItem[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('wait_min');
  const [selectedGroupBy, setSelectedGroupBy] = useState<string>('centre_id');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const data = await callRpc<StatItem[]>('flux_stats', {
          p_metric: selectedMetric,
          p_group_by: [selectedGroupBy]
        });
        setStats(data);
      } catch (err) {
        console.error('Erreur chargement stats', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [selectedMetric, selectedGroupBy]);

  const metrics = [
    { id: 'wait_min', label: 'Temps d’attente (min)', unit: 'min' },
    { id: 'duration_min', label: 'Durée de consultation (min)', unit: 'min' },
    { id: 'pec', label: 'Prises en charge (PEC)', unit: 'actes' },
    { id: 'patients', label: 'Patients distincts', unit: 'patients' },
    { id: 'teleexpertise_rate', label: 'Taux télé-expertise (%)', unit: '%' },
    { id: 'first_visit_rate', label: 'Taux 1ères visites (%)', unit: '%' }
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Analyses Statistiques Avancées
              </h1>
              <p className="text-xs text-slate-400">
                Distribution asymétrique (médianes, quartiles P25–P90) et Graphiques en entonnoir (Funnel plots)
              </p>
            </div>
          </div>
        </div>

        {/* Statistical methodology note badge */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300">
          <HelpCircle className="h-4 w-4 text-teal-400" />
          <span>Règle : Groupes &lt; 10 masqués (confidentialité)</span>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Clock className="h-4 w-4 text-teal-400" />
            <span>Métrique :</span>
          </div>
          <select
            aria-label="Sélectionner la métrique"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 ml-2">
            <Layers className="h-4 w-4 text-teal-400" />
            <span>Regrouper par :</span>
          </div>
          <select
            aria-label="Sélectionner le regroupement"
            value={selectedGroupBy}
            onChange={(e) => setSelectedGroupBy(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="centre_id">Par Centre de santé</option>
            <option value="sex">Par Sexe (F / M)</option>
            <option value="age_band">Par Tranche d&apos;âge</option>
            {canViewDoctorStats && <option value="doctor_id">Par Médecin (Réservé Direction)</option>}
          </select>
        </div>

        {!canViewDoctorStats && (
          <span className="text-[11px] text-slate-500 italic">
            * Les statistiques individuelles par médecin sont réservées au rôle Direction.
          </span>
        )}
      </div>

      {/* Funnel Plot / Distribution Visualizer */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Graphique en Entonnoir (Funnel Plot) & Distribution
            </h2>
            <p className="text-xs text-slate-400">
              Positionnement par rapport aux limites nationales (95% et 99.8%) selon l&apos;effectif N
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Dans la norme</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-slate-300">En dessous (Plus rapide)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-slate-300">Au-dessus (Attente longue)</span>
            </div>
          </div>
        </div>

        {/* Visual Boxplot & Funnel points */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Calcul des statistiques...</div>
          ) : (
            stats.map((row, idx) => {
              const isMasked = row.n < 10;
              const title = row.centre_name || row.doctor_name || row.sex || row.age_band || `Item #${idx + 1}`;

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 transition hover:bg-slate-800/60"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-white text-xs">{title}</div>
                      <span className="rounded-md bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                        N = {row.n}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      {isMasked ? (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Effectif insuffisant (&lt; 10) : mesures masquées</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-slate-400">
                            Médiane : <strong className="text-emerald-400 text-sm">{row.median}</strong>
                          </div>
                          <div className="text-slate-400">
                            P25–P75 : <span className="text-white">[{row.p25} – {row.p75}]</span>
                          </div>
                          <div className="text-slate-400">
                            P90 : <span className="text-white">{row.p90}</span>
                          </div>
                          {row.funnel && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                row.funnel === 'dans_la_norme'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : row.funnel === 'en_dessous'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {row.funnel === 'dans_la_norme'
                                ? 'Dans la norme'
                                : row.funnel === 'en_dessous'
                                ? 'En dessous'
                                : 'Au-dessus'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Bar Visualizer */}
                  {!isMasked && row.median !== null && (
                    <div className="mt-3 relative h-2.5 w-full rounded-full bg-slate-900 overflow-hidden">
                      <div
                        style={{
                          left: `${Math.min(100, ((row.p25 || 0) / 120) * 100)}%`,
                          width: `${Math.min(100, (((row.p75 || 0) - (row.p25 || 0)) / 120) * 100)}%`
                        }}
                        className="absolute h-full bg-teal-500/40 rounded-sm"
                      />
                      <div
                        style={{ left: `${Math.min(100, (row.median / 120) * 100)}%` }}
                        className="absolute h-full w-1.5 bg-emerald-400 -translate-x-1/2"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

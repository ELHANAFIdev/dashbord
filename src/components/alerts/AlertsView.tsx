'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { EventItem } from '@/lib/types';
import { ACK_CAUSES, REGIONS_MOROCCO } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import {
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Filter,
  X,
  Send,
  Building2,
  Clock,
  ShieldAlert
} from 'lucide-react';

export function AlertsView() {
  const { user, canAcknowledgeAlerts } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>(user.region || 'Toutes les régions');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // Form states for Ack
  const [cause, setCause] = useState<string>(ACK_CAUSES[0]);
  const [comment, setComment] = useState<string>('');
  const [resolveNow, setResolveNow] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const data = await callRpc<EventItem[]>('ui_events');
        setEvents(data);
      } catch (err) {
        console.error('Erreur chargement alertes', err);
      } finally {
        setLoading(false);
      }
    }
    loadAlerts();
  }, []);

  const filteredEvents = events.filter((ev) => {
    if (selectedStatus !== 'all' && ev.status !== selectedStatus) return false;
    if (selectedRegion !== 'Toutes les régions' && ev.region !== selectedRegion) return false;
    return true;
  });

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    // Check regional permission
    if (user.role === 'coordinateur' && selectedEvent.region && selectedEvent.region !== user.region) {
      alert(`Action refusée : En tant que coordinateur de ${user.region}, vous ne pouvez pas acquitter une alerte de ${selectedEvent.region}.`);
      return;
    }

    setSubmitting(true);
    try {
      await callRpc('sup_event_ack', {
        p_id: selectedEvent.id,
        p_by: user.name,
        p_cause: `${cause} : ${comment}`,
        p_resolve: resolveNow
      });

      // Update state locally
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === selectedEvent.id
            ? {
                ...ev,
                status: resolveNow ? 'resolved' : 'explained',
                explanation: `${cause} : ${comment}`,
                ack_by: user.name,
                ack_at: new Date().toISOString()
              }
            : ev
        )
      );

      setSuccessMsg('Alerte mise à jour avec succès !');
      setTimeout(() => {
        setSuccessMsg(null);
        setSelectedEvent(null);
        setComment('');
      }, 1500);
    } catch (err) {
      alert(`Erreur lors de l'acquittement : ${err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Centre de Gestion des Alertes
              </h1>
              <p className="text-xs text-slate-400">
                Traitement, explication terrain et clôture des signaux opérationnels
              </p>
            </div>
          </div>
        </div>

        {/* Status Counts */}
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
            {events.filter((e) => e.status === 'open').length} En cours
          </span>
          <span className="rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-400">
            {events.filter((e) => e.status === 'explained').length} Expliquées
          </span>
          <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
            {events.filter((e) => e.status === 'resolved').length} Résolues
          </span>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Filter className="h-3.5 w-3.5 text-teal-400" />
            <span>Filtrer :</span>
          </div>

          <select
            aria-label="Filtrer les alertes par statut"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="open">En cours (Non traitée)</option>
            <option value="explained">Expliquée (Cause identifiée)</option>
            <option value="resolved">Résolue (Clôturée)</option>
          </select>

          <select
            aria-label="Filtrer les alertes par région"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            disabled={user.role === 'coordinateur'}
            className="disabled:cursor-not-allowed disabled:opacity-70 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            {REGIONS_MOROCCO.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Affichage de <strong className="text-white">{filteredEvents.length}</strong> alerte(s)
        </span>
      </div>

      {/* Alerts Grid / List */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Alerts list items */}
        <div className="space-y-3 lg:col-span-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Chargement des alertes...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 py-12 text-center text-xs text-slate-500">
              Aucune alerte trouvée.
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const isSelected = selectedEvent?.id === ev.id;
              const isUrgent = ev.severity === 'high';
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className={`cursor-pointer rounded-2xl border p-4.5 transition ${
                    isSelected
                      ? 'border-teal-500 bg-slate-850 shadow-lg'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-xl p-2 ${
                          isUrgent ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{ev.centre_name}</h3>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isUrgent
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {ev.signal_type}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300">{ev.message}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span>{ev.province}</span>
                          <span>•</span>
                          <span className="text-teal-400">{ev.region}</span>
                          <span>•</span>
                          <span>Obs : <strong className="text-white">{ev.last_value}</strong> (Attendu : {ev.last_expected})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                          ev.status === 'open'
                            ? 'bg-red-500/20 text-red-300'
                            : ev.status === 'explained'
                            ? 'bg-teal-500/20 text-teal-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {ev.status === 'open' ? 'En cours' : ev.status === 'explained' ? 'Expliquée' : 'Résolue'}
                      </span>
                      <span className="text-[10px] text-slate-500">{ev.last_seen}</span>
                    </div>
                  </div>

                  {ev.explanation && (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 text-xs text-slate-300">
                      <span className="font-bold text-teal-400">Explication enregistrée : </span>
                      {ev.explanation}
                      {ev.ack_by && <span className="text-slate-500"> — par {ev.ack_by}</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Detail & Ack Panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          {selectedEvent ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">Traiter l&apos;Alerte #{selectedEvent.id}</h3>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 text-xs space-y-1.5">
                <div>
                  <span className="text-slate-400">Centre concerné : </span>
                  <strong className="text-white">{selectedEvent.centre_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Région : </span>
                  <strong className="text-teal-300">{selectedEvent.region}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Constat : </span>
                  <span className="text-slate-300">{selectedEvent.message}</span>
                </div>
              </div>

              {successMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{successMsg}</span>
                </div>
              )}

              {canAcknowledgeAlerts ? (
                <form onSubmit={handleAcknowledge} className="space-y-3.5 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-300">
                      Motif / Cause constatée avec le terrain :
                    </label>
                    <select
                      value={cause}
                      onChange={(e) => setCause(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      {ACK_CAUSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">
                      Détails complémentaires (300 car. max) :
                    </label>
                    <textarea
                      maxLength={300}
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ex: Confirmation par téléphone avec le médecin sur place..."
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resolveNow}
                      onChange={(e) => setResolveNow(e.target.checked)}
                      className="rounded text-teal-500 focus:ring-0"
                    />
                    <span>Clôturer et marquer comme résolu</span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    <span>{submitting ? 'Envoi en cours...' : 'Enregistrer l’acquittement'}</span>
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-center text-xs text-slate-400">
                  Votre rôle actuel ({user.role}) ne dispose pas des droits d’acquittement sur cette alerte.
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-slate-500">
              <BellRing className="h-8 w-8 text-slate-700 mb-2" />
              <span>Sélectionnez une alerte à gauche pour visualiser les détails et enregistrer le retour terrain</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

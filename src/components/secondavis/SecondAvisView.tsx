'use client';

import React, { useEffect, useState } from 'react';
import { callRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SecondOpinionItem } from '@/lib/types';
import {
  BrainCircuit,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileEdit,
  Shield,
  Send,
  UserCheck
} from 'lucide-react';

export function SecondAvisView() {
  const { user, canReviewSecondOpinion } = useAuth();
  const [cases, setCases] = useState<SecondOpinionItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<SecondOpinionItem | null>(null);
  const [reviewVerdict, setReviewVerdict] = useState<'accepte' | 'modifie' | 'rejete'>('accepte');
  const [doctorComment, setDoctorComment] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSecondOpinions() {
      try {
        const data = await callRpc<SecondOpinionItem[]>('ui_second_opinion');
        setCases(data);
        if (data.length > 0) setSelectedCase(data[0]);
      } catch (err) {
        console.error('Erreur chargement second avis', err);
      } finally {
        setLoading(false);
      }
    }
    loadSecondOpinions();
  }, []);

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    try {
      // Saved on the server; the server checks that the profile may review and signs the decision.
      await callRpc('so_review', {
        p_version_key: selectedCase.versionKey,
        p_verdict: reviewVerdict,
        p_comment: doctorComment
      });
      setCases((prev) =>
        prev.map((c) =>
          c.versionKey === selectedCase.versionKey
            ? { ...c, status_review: reviewVerdict }
            : c
        )
      );
      alert(`Verdict « ${reviewVerdict.toUpperCase()} » enregistré pour le dossier ${selectedCase.versionKey}`);
    } catch (err) {
      alert(`Décision non enregistrée : ${err instanceof Error ? err.message : err}`);
    }
  };

  const priorityBadges = {
    CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', icon: AlertOctagon },
    HIGH: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', icon: AlertTriangle },
    MEDIUM: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', icon: Shield },
    ROUTINE: { bg: 'bg-slate-700/50', text: 'text-slate-300', border: 'border-slate-600', icon: CheckCircle },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Module Second Avis Médical Assisté par IA
              </h1>
              <p className="text-xs text-slate-400">
                Poste de revue et de validation clinique par le Dr. Saad (Médecin Référent)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300 font-semibold">
          <UserCheck className="h-4 w-4" />
          <span>Supervision Clinique Active</span>
        </div>
      </div>

      {/* Main split */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Cases List */}
        <div className="space-y-3 lg:col-span-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Chargement des avis...</div>
          ) : (
            cases.map((c) => {
              const isSelected = selectedCase?.versionKey === c.versionKey;
              const pCfg = priorityBadges[c.priority];
              const Icon = pCfg.icon;

              return (
                <div
                  key={c.versionKey}
                  onClick={() => setSelectedCase(c)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-purple-500 bg-slate-850 shadow-lg'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${pCfg.bg} ${pCfg.text}`}>
                      <Icon className="h-3 w-3" />
                      {c.priority}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${
                        c.status_review === 'pending'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {c.status_review === 'pending' ? 'À valider' : c.status_review}
                    </span>
                  </div>

                  <h3 className="mt-2 text-xs font-bold text-white line-clamp-1">{c.centre_name}</h3>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-300">{c.summary}</p>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-2">
                    <span>Patient : {c.age} ans ({c.gender})</span>
                    <span className="text-purple-300 font-bold">Confiance : {(c.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Case Deep Dive */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl lg:col-span-2">
          {selectedCase ? (
            <div className="space-y-5">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-400 font-bold">{selectedCase.versionKey}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                      Consultation #{selectedCase.consultationId}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white mt-1">{selectedCase.centre_name}</h2>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Patient : <strong className="text-white">{selectedCase.age} ans</strong> ({selectedCase.gender})</span>
                </div>
              </div>

              {/* Clinical Summary */}
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Synthèse Clinique</span>
                <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">{selectedCase.summary}</p>
              </div>

              {/* Red Flags Alert */}
              {selectedCase.redFlags.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Signaux d&apos;Alarme Détectés (Red Flags)</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pt-1 text-[11px]">
                    {selectedCase.redFlags.map((rf, i) => (
                      <li key={i}>{rf}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Opinion */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-300">Avis Proposé par l&apos;IA Médicale</span>
                  <span className="text-[10px] text-slate-400 font-mono">{selectedCase.reasoningModel}</span>
                </div>
                <p className="mt-2 text-xs text-purple-100 leading-relaxed font-medium">
                  {selectedCase.opinion}
                </p>
              </div>

              {/* Doctor Review Actions */}
              {canReviewSecondOpinion ? (
              <form onSubmit={handleDecision} className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 space-y-3">
                <span className="text-xs font-bold text-white">Validation du Médecin Référent (Dr. Saad) :</span>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="verdict"
                      value="accepte"
                      checked={reviewVerdict === 'accepte'}
                      onChange={() => setReviewVerdict('accepte')}
                      className="text-emerald-500"
                    />
                    <span>Accepter</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-amber-400 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="verdict"
                      value="modifie"
                      checked={reviewVerdict === 'modifie'}
                      onChange={() => setReviewVerdict('modifie')}
                      className="text-amber-500"
                    />
                    <span>Modifier</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-red-400 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="verdict"
                      value="rejete"
                      checked={reviewVerdict === 'rejete'}
                      onChange={() => setReviewVerdict('rejete')}
                      className="text-red-500"
                    />
                    <span>Rejeter</span>
                  </label>
                </div>

                <textarea
                  rows={2}
                  value={doctorComment}
                  onChange={(e) => setDoctorComment(e.target.value)}
                  placeholder="Notes cliniques et motif de la décision..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />

                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-purple-500 transition"
                >
                  <Send className="h-4 w-4" />
                  <span>Enregistrer la Décision Médicale</span>
                </button>
              </form>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 text-xs text-slate-400">
                  Consultation seule : la décision sur un second avis est réservée au médecin référent (profil actuel : {user.name}).
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Sélectionnez un cas clinique à gauche pour démarrer la revue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

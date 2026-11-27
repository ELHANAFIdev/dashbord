'use client';
import { Database, FlaskConical, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { callRpc, invalidate, RpcError, useRpc } from '@/client/rpc';
import { useSession } from '@/client/session';
import { fmtDateTime, fmtInt } from '@/lib/format';
import type { DataSource, Likelihood, ReviewPriority, ReviewVerdict, SecondOpinionBilan, SecondOpinionCase } from '@/lib/types';
import { Button, Chip, DataGate, EmptyState, Field, PageHeader, Panel, SkeletonBlock, cx, selectClass, type Tone } from '../ui/primitives';

const PRIORITY: Record<ReviewPriority, { label: string; tone: Tone; rank: number }> = {
  CRITICAL: { label: 'Critique', tone: 'crit', rank: 0 },
  HIGH: { label: 'Haute', tone: 'warn', rank: 1 },
  MEDIUM: { label: 'Moyenne', tone: 'info', rank: 2 },
  ROUTINE: { label: 'Routine', tone: 'neutral', rank: 3 },
};
const LIKELIHOOD: Record<Likelihood, string> = { high: 'Élevée', moderate: 'Modérée', low: 'Faible' };
const STATUTS: Record<string, string> = { SUCCESS: 'réussis', QUARANTINED: 'en quarantaine', FAILED_FINAL: 'non conformes', ERROR: 'en erreur', BLOCKED_CONFIG: 'bloqués (configuration)' };

/** Titre et ligne descriptive d'un cas : les résultats réels n'ont ni motif, ni âge, ni sexe. */
function caseTitle(c: SecondOpinionCase): string {
  return c.motif ?? `Consultation n° ${c.consultation_id ?? c.id}`;
}
function caseMeta(c: SecondOpinionCase): string {
  return [c.sexe, c.age != null ? `${c.age} ans` : null, c.centre_name, c.jour ? `consultation du ${c.jour.split('-').reverse().join('/')}` : null]
    .filter(Boolean)
    .join(', ');
}
const VERDICTS: Record<ReviewVerdict, { label: string; done: string }> = {
  accepte: { label: 'Accepter', done: 'Accepté' },
  modifie: { label: 'Modifier', done: 'Modifié' },
  rejete: { label: 'Rejeter', done: 'Rejeté' },
};

function List({ title, items, tone }: { title: string; items: string[]; tone?: 'crit' }) {
  return (
    <section>
      <h3 className={cx('mb-1.5 text-[13px] font-semibold', tone === 'crit' && 'text-crit')}>{title}</h3>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-3">Aucun.</p>
      )}
    </section>
  );
}

function Review({ item, source }: { item: SecondOpinionCase; source: DataSource | undefined }) {
  const { can } = useSession();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<ReviewVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (verdict: ReviewVerdict) => {
    if (verdict !== 'accepte' && !comment.trim()) {
      setError('Expliquez en une phrase la modification ou le rejet.');
      return;
    }
    setBusy(verdict);
    setError(null);
    try {
      await callRpc('so_review', { p_version_key: item.version_key, p_verdict: verdict, p_comment: comment.trim() || undefined });
      invalidate(['second_avis', 'second_avis_bilan']);
      setComment('');
    } catch (e) {
      setError(e instanceof RpcError ? e.message : 'Échec de l’enregistrement.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-lg border border-line bg-surface-2 p-4">
      <h3 className="text-[14px] font-semibold">Validation par le médecin référent</h3>
      {item.review ? (
        <p className="mt-2 text-[13px]">
          <Chip tone={item.review.verdict === 'accepte' ? 'ok' : item.review.verdict === 'rejete' ? 'crit' : 'warn'}>{VERDICTS[item.review.verdict].done}</Chip>{' '}
          par {item.review.by}, {fmtDateTime(item.review.at)}
          {item.review.comment && <span className="mt-1 block text-ink-2">« {item.review.comment} »</span>}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-ink-3">En attente de validation.</p>
      )}
      {can.review ? (
        <div className="mt-3 space-y-3">
          <Field label="Commentaire (obligatoire pour modifier ou rejeter)">
            <textarea className={`${selectClass} h-20 py-2`} value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VERDICTS) as ReviewVerdict[]).map((v) => (
              <Button key={v} variant={v === 'accepte' ? 'primary' : v === 'rejete' ? 'danger' : 'secondary'} disabled={busy !== null} onClick={() => send(v)}>
                {busy === v ? 'Enregistrement…' : VERDICTS[v].label}
              </Button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-crit">
              {error}
            </p>
          )}
          <p className="text-[12px] text-ink-3">
            {source === 'live' ? 'La validation est enregistrée dans la base locale, avec votre nom.' : 'Démonstration : la validation est gardée en mémoire du serveur, pas dans la base.'}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-ink-2">
          {can.readOnly ? 'Profil démonstration : consultation seule.' : 'Seuls le médecin référent et la direction valident un second avis.'}
        </p>
      )}
    </section>
  );
}

function Bilan({ bilan }: { bilan: SecondOpinionBilan }) {
  const ok = bilan.par_statut.SUCCESS ?? 0;
  const autres = Object.entries(bilan.par_statut).filter(([k]) => k !== 'SUCCESS');
  return (
    <p className="mt-3 text-[13px] text-ink-2">
      <span className="num font-medium text-ink">{fmtInt(bilan.consultations)}</span> consultations analysées en {fmtInt(bilan.lancements)} lancement
      {bilan.lancements > 1 ? 's' : ''} : <span className="num font-medium text-ink">{fmtInt(ok)}</span> seconds avis réussis
      {autres.map(([k, n]) => (
        <span key={k}>
          , <span className="num">{fmtInt(n)}</span> {STATUTS[k] ?? k}
        </span>
      ))}
      . <span className="num font-medium text-ink">{fmtInt(bilan.valides)}</span> validé{bilan.valides > 1 ? 's' : ''} par un médecin
      {bilan.dernier ? `, dernier résultat le ${fmtDateTime(bilan.dernier)}` : ''}.
    </p>
  );
}

export function SecondOpinionView() {
  const [priority, setPriority] = useState<ReviewPriority | ''>('');
  const data = useRpc<SecondOpinionCase[]>('second_avis', priority ? { p_priorite: priority } : {});
  const bilan = useRpc<SecondOpinionBilan>('second_avis_bilan', {});
  const [selected, setSelected] = useState<string | null>(null);
  const cases = useMemo(() => [...(data.data ?? [])].sort((a, b) => PRIORITY[a.review_priority].rank - PRIORITY[b.review_priority].rank), [data.data]);
  const item = cases.find((c) => c.id === selected) ?? cases[0];
  const live = data.source === 'live';

  return (
    <>
      <PageHeader
        title="Second avis IA"
        description="Second avis A3 : hypothèses argumentées, signaux d’alerte, examens à discuter et données manquantes. Aucun traitement, aucune dose, aucune consigne."
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {live ? (
            <Chip tone="info" icon={<Database className="h-3.5 w-3.5" aria-hidden="true" />}>
              Résultats du workflow A3 — décision réservée au médecin
            </Chip>
          ) : (
            <Chip tone="warn" icon={<FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />}>
              Échantillon de test — décision réservée au médecin
            </Chip>
          )}
          {(bilan.data?.modeles ?? (item ? [item.model] : [])).map((m) => (
            <Chip key={m}>Modèle : {m}</Chip>
          ))}
        </div>
        {bilan.data && <Bilan bilan={bilan.data} />}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Priorité de relecture">
          <select className={selectClass} value={priority} onChange={(e) => { setPriority(e.target.value as ReviewPriority | ''); setSelected(null); }}>
            <option value="">Toutes</option>
            {(Object.keys(PRIORITY) as ReviewPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY[p].label}
                {bilan.data?.par_priorite[p] !== undefined ? ` (${fmtInt(bilan.data.par_priorite[p])})` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <DataGate state={data} skeleton={<SkeletonBlock rows={8} />}>
        {() =>
          !item ? (
            <EmptyState title={live ? 'Aucun second avis réussi pour ce filtre' : 'Aucun cas dans l’échantillon'} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <Panel title={live ? `Seconds avis (${fmtInt(cases.length)})` : 'Cas de l’échantillon'} bodyClassName="p-0 md:p-0" className="lg:self-start">
                <ul role="listbox" aria-label="Seconds avis" className="max-h-[70vh] divide-y divide-line overflow-y-auto">
                  {cases.map((c) => {
                    const active = c.id === item.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => setSelected(c.id)}
                          className={cx('w-full px-4 py-3 text-left hover:bg-surface-2', active && 'bg-accent-soft')}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <Chip tone={PRIORITY[c.review_priority].tone}>{PRIORITY[c.review_priority].label}</Chip>
                            {c.review && <span className="text-[12px] text-ink-3">{VERDICTS[c.review.verdict].done}</span>}
                          </span>
                          <span className="mt-1.5 block text-[13px] font-medium text-ink">{caseTitle(c)}</span>
                          <span className="block text-[12px] text-ink-3">{caseMeta(c)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>

              <Panel
                title={caseTitle(item)}
                description={`${caseMeta(item)}, analysé le ${fmtDateTime(item.recu_le)}`}
                actions={<Chip tone={PRIORITY[item.review_priority].tone}>Priorité de relecture : {PRIORITY[item.review_priority].label}</Chip>}
                bodyClassName="space-y-5"
              >
                <section>
                  <h3 className="mb-1.5 text-[13px] font-semibold">Synthèse</h3>
                  <p className="max-w-[80ch] text-[14px] leading-relaxed">{item.output.summary}</p>
                </section>
                <section>
                  <h3 className="mb-2 text-[13px] font-semibold">Hypothèses à discuter</h3>
                  <ul className="space-y-3">
                    {item.output.differentials.map((d) => (
                      <li key={d.hypothesis} className="rounded-lg border border-line p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{d.hypothesis}</p>
                          <Chip tone={d.likelihood === 'high' ? 'warn' : d.likelihood === 'moderate' ? 'info' : 'neutral'}>Vraisemblance : {LIKELIHOOD[d.likelihood]}</Chip>
                        </div>
                        <div className="mt-2 grid gap-3 text-[13px] md:grid-cols-2">
                          <div>
                            <p className="text-[12px] font-medium text-ink-2">Arguments pour</p>
                            {d.supportingEvidence.length ? (
                              <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.supportingEvidence.map((x) => <li key={x}>{x}</li>)}</ul>
                            ) : (
                              <p className="mt-1 text-ink-3">Aucun.</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[12px] font-medium text-ink-2">Arguments contre</p>
                            {d.againstEvidence.length ? (
                              <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.againstEvidence.map((x) => <li key={x}>{x}</li>)}</ul>
                            ) : (
                              <p className="mt-1 text-ink-3">Aucun.</p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                <div className="grid gap-5 md:grid-cols-3">
                  <List title="Signaux d’alerte" items={item.output.redFlags} tone="crit" />
                  <List title="Examens à discuter" items={item.output.suggestedWorkup} />
                  <List title="Données manquantes" items={item.output.dataGaps} />
                </div>
                <p className="flex items-start gap-2 text-[13px] text-ink-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                  Confiance du modèle : {LIKELIHOOD[item.output.confidence]}. Ce texte aide la relecture ; il ne remplace ni l’examen ni la décision du médecin.
                </p>
                <Review item={item} source={data.source} />
              </Panel>
            </div>
          )
        }
      </DataGate>
    </>
  );
}

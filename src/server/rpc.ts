// Cœur du proxy RPC : liste blanche, paramètres exacts, droits par profil, filtrage
// régional, protection des noms de médecins, censure thérapeutique et source des données.
import echantillon from '@/data/second_avis_echantillon.json';
import { sameRegion } from '@/lib/regions';
import { canAcknowledgeAlerts, canInvestigate, canReviewSecondOpinion, isReadOnly } from '@/lib/roles';
import type { DataSource, SecondOpinionBilan, SecondOpinionCase, UserSession } from '@/lib/types';
import { FUNCTIONS } from './functions';
import { LiveError } from './live';
import { RuleError, filterByRegion, protectStats, redactDeep, sanitizeParams } from './rules';
import { store } from './store';

type Json = Record<string, unknown>;

export interface RpcDeps {
  mode: DataSource;
  callLive: (fn: string, params: Json) => Promise<unknown>;
  readMock: (fn: string, params: Json) => unknown | undefined;
  now?: () => Date;
}

export interface RpcResult {
  status: number;
  body: unknown;
  source?: DataSource;
}

const fail = (status: number, error: string): RpcResult => ({ status, body: { error } });

/** Lecture brute (base ou démonstration). En mode réel, une erreur n'est jamais remplacée par des données fictives. */
async function load(fn: string, params: Json, deps: RpcDeps): Promise<{ data: unknown; source: DataSource }> {
  if (deps.mode === 'live') return { data: await deps.callLive(fn, params), source: 'live' };
  const data = deps.readMock(fn, params);
  if (data === undefined) throw new RuleError(404, `Aucune donnée de démonstration pour ${fn}.`);
  return { data, source: 'mock' };
}

/** Région d'une unité, lue dans ui_map (sert à contrôler l'accès d'un coordinateur). */
async function regionOfCentre(centreId: number, deps: RpcDeps): Promise<string | undefined> {
  const { data } = await load('ui_map', {}, deps);
  const row = Array.isArray(data) ? (data as Json[]).find((r) => Number(r.centre_id) === centreId) : undefined;
  return row?.region as string | undefined;
}

/** Applique les écritures de démonstration, puis refiltre par statut comme le ferait la base. */
function overlayMock(fn: string, data: unknown, params: Json): unknown {
  if (!Array.isArray(data)) return data;
  if (fn === 'ui_events') {
    const status = (params.p_status as string | undefined) ?? 'open';
    return (data as Json[])
      .map((e) => {
        const ack = store.acks.get(Number(e.id));
        return ack ? { ...e, ...ack } : e;
      })
      .filter((e) => status === 'all' || e.status === status);
  }
  if (fn === 'ui_anomalies') {
    return (data as Json[])
      .map((a) => {
        const enq = store.enquetes.get(Number(a.id));
        return enq ? { ...a, ...enq } : a;
      })
      .filter((a) => params.p_statut === undefined || a.statut === params.p_statut);
  }
  return data;
}

function secondOpinionSample(priority?: unknown): SecondOpinionCase[] {
  return echantillon.cases
    .filter((c) => priority === undefined || c.review_priority === priority)
    .map((c) => {
      const review = store.reviews.get(c.version_key);
      return redactDeep({
        ...(c as Omit<SecondOpinionCase, 'model' | 'review'>),
        model: echantillon.model,
        review: review ? { ...review } : null,
      }) as SecondOpinionCase;
    });
}

function secondOpinionSampleBilan(): SecondOpinionBilan {
  const parPriorite: Record<string, number> = {};
  for (const c of echantillon.cases) parPriorite[c.review_priority] = (parPriorite[c.review_priority] ?? 0) + 1;
  return {
    consultations: echantillon.cases.length,
    par_statut: { SUCCESS: echantillon.cases.length },
    par_priorite: parPriorite,
    valides: store.reviews.size,
    lancements: 1,
    dernier: null,
    modeles: [echantillon.model],
  };
}

/** Second avis A3 : base locale en mode réel (censure thérapeutique et filtre régional appliqués ici aussi). */
async function readSecondOpinion(fn: string, params: Json, user: UserSession, deps: RpcDeps): Promise<RpcResult> {
  if (deps.mode !== 'live') {
    const body = fn === 'second_avis_bilan' ? secondOpinionSampleBilan() : secondOpinionSample(params.p_priorite);
    // L'échantillon fictif n'a pas de région : il est montré tel quel.
    return { status: 200, body, source: 'mock' };
  }
  const data = await deps.callLive(FUNCTIONS[fn].liveName as string, params);
  if (fn === 'second_avis_bilan') return { status: 200, body: data, source: 'live' };
  return { status: 200, body: filterByRegion(fn, redactDeep(data), user), source: 'live' };
}

async function read(fn: string, params: Json, user: UserSession, deps: RpcDeps): Promise<RpcResult> {
  const spec = FUNCTIONS[fn];
  if (fn === 'second_avis' || fn === 'second_avis_bilan') return readSecondOpinion(fn, params, user, deps);

  if (user.role === 'coordinateur' && spec.centreParam && typeof params.p_centre_id === 'number') {
    const region = await regionOfCentre(params.p_centre_id, deps);
    if (!region || !sameRegion(region, user.region)) {
      throw new RuleError(403, 'Cette unité n’appartient pas à votre région.');
    }
  }
  const loaded = await load(fn, params, deps);
  let data = loaded.source === 'mock' ? overlayMock(fn, loaded.data, params) : loaded.data;
  data = filterByRegion(fn, data, user);
  if (fn === 'ui_stats_formation') data = protectStats(data, user, params.p_groupe);
  return { status: 200, body: data, source: loaded.source };
}

async function write(fn: string, params: Json, user: UserSession, deps: RpcDeps): Promise<RpcResult> {
  if (isReadOnly(user)) return fail(403, 'Le profil démonstration est en lecture seule.');
  const at = (deps.now?.() ?? new Date()).toISOString();

  if (fn === 'so_review') {
    if (!canReviewSecondOpinion(user)) return fail(403, 'Seuls le médecin référent et la direction peuvent valider un second avis.');
    const key = String(params.p_version_key);
    if (deps.mode === 'live') {
      if (params.p_verdict !== 'accepte' && !String(params.p_comment ?? '').trim()) return fail(400, 'Commentaire obligatoire pour modifier ou rejeter.');
      const body = await deps.callLive('ui_so_revue', {
        p_version_key: key,
        p_verdict: params.p_verdict,
        p_par: user.name,
        p_commentaire: params.p_comment ?? null,
      });
      return { status: 200, body, source: 'live' };
    }
    if (!echantillon.cases.some((c) => c.version_key === key)) return fail(404, 'Second avis introuvable.');
    const record = { verdict: params.p_verdict as 'accepte' | 'modifie' | 'rejete', comment: String(params.p_comment ?? ''), by: user.name, at };
    store.reviews.set(key, record);
    return { status: 200, body: { ok: true, version_key: key, ...record }, source: 'mock' };
  }

  if (fn === 'sup_event_ack') {
    if (!canAcknowledgeAlerts(user)) return fail(403, 'Votre profil ne peut pas acquitter une alerte.');
    const id = params.p_id as number;
    const { data } = await load('ui_events', { p_status: 'all', p_limit: 5000 }, deps);
    const event = Array.isArray(data) ? (data as Json[]).find((e) => Number(e.id) === id) : undefined;
    if (!event) return fail(404, 'Alerte introuvable.');
    if (user.role === 'coordinateur' && !sameRegion(event.region as string, user.region)) {
      return fail(403, 'Cette alerte concerne une autre région.');
    }
    if (deps.mode === 'live') return { status: 200, body: await deps.callLive(fn, params), source: 'live' };
    const status = params.p_resolve ? 'resolved' : 'explained';
    store.acks.set(id, { status, explanation: (params.p_cause as string) ?? null, explanation_source: 'manuel', ack_by: user.name, ack_at: at });
    return { status: 200, body: { ok: true, id, status }, source: 'mock' };
  }

  if (fn === 'ui_anomalie_enquete') {
    if (!canInvestigate(user)) return fail(403, 'Votre profil ne peut pas mettre à jour une enquête.');
    const id = params.p_id as number;
    const { data } = await load('ui_anomalies', { p_du: '2000-01-01', p_au: '2100-12-31', p_limit: 100000 }, deps);
    const anomaly = Array.isArray(data) ? (data as Json[]).find((a) => Number(a.id) === id) : undefined;
    if (!anomaly) return fail(404, 'Anomalie introuvable.');
    if (user.role === 'coordinateur' && !sameRegion(anomaly.region as string, user.region)) {
      return fail(403, 'Cette anomalie concerne une autre région.');
    }
    if (deps.mode === 'live') return { status: 200, body: await deps.callLive(fn, params), source: 'live' };
    store.enquetes.set(id, {
      statut: params.p_statut as string,
      cause_confirmee: (params.p_cause_code as string) ?? null,
      commentaire: (params.p_commentaire as string) ?? null,
      par: user.name,
      maj: at,
    });
    return { status: 200, body: { ok: true, id, statut: params.p_statut }, source: 'mock' };
  }
  return fail(404, `Fonction inconnue : ${fn}`);
}

export async function handleRpc(fn: string, body: unknown, user: UserSession, deps: RpcDeps): Promise<RpcResult> {
  const spec = Object.prototype.hasOwnProperty.call(FUNCTIONS, fn) ? FUNCTIONS[fn] : undefined;
  if (!spec) return fail(404, `Fonction inconnue : ${fn}`);
  try {
    const params = sanitizeParams(fn, body, user);
    return spec.kind === 'read' ? await read(fn, params, user, deps) : await write(fn, params, user, deps);
  } catch (e) {
    if (e instanceof RuleError || e instanceof LiveError) return fail(e.status, e.message);
    return fail(500, 'Erreur interne du proxy.');
  }
}

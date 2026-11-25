import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  ROLE_COOKIE,
  sessionFor,
  canAcknowledgeAlerts,
  canReviewSecondOpinion,
  canViewDoctorStats,
} from '@/lib/roles';
import { UserSession } from '@/lib/types';

// Only these database functions can be reached through the proxy.
const READ_FNS = new Set([
  'ui_dashboard',
  'ui_events',
  'ui_map',
  'sup_centre_category_list',
  'ui_centre_detail',
  'ctx_centre_context',
  'flux_stats',
  'flux_series',
  'flux_live_centres',
  'ui_health',
  'ui_second_opinion',
]);
const WRITE_FNS = new Set(['sup_event_ack', 'so_review']);

// Functions whose rows carry a `region` field and are filtered for a regional coordinator.
const REGION_FILTERED = new Set(['ui_map', 'ui_events', 'sup_centre_category_list']);

type Json = Record<string, unknown>;
type Source = 'live' | 'mock';

// Demo-mode writes are kept in server memory (survives hot reload, not a restart).
interface AckRecord { status: 'explained' | 'resolved'; explanation: string; ack_by: string; ack_at: string }
interface ReviewRecord { status_review: string; reviewed_by: string; comment: string; reviewed_at: string }
const store = globalThis as unknown as { __ummcAcks?: Map<number, AckRecord>; __ummcReviews?: Map<string, ReviewRecord> };
const acks = (store.__ummcAcks ??= new Map());
const reviews = (store.__ummcReviews ??= new Map());

const isMock = () => (process.env.USE_MOCK ?? 'true').toLowerCase() === 'true' || !process.env.SUPA_URL || !process.env.SUPA_ANON_KEY;

function readMock(fn: string): unknown | undefined {
  const file = path.join(process.cwd(), 'src', 'mock', `${fn}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : undefined;
}

async function callLive(fn: string, body: Json): Promise<Response> {
  const key = process.env.SUPA_ANON_KEY as string;
  return fetch(`${process.env.SUPA_URL}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_token: process.env.SUPA_TOKEN, ...body }),
    cache: 'no-store',
  });
}

/** Read a function's data from the database, or from the mock file (demo mode or database failure). */
async function loadData(fn: string, body: Json): Promise<{ data: unknown; source: Source } | { error: string; status: number }> {
  if (!isMock()) {
    try {
      const res = await callLive(fn, body);
      if (res.ok) return { data: await res.json(), source: 'live' };
      console.warn(`[RPC fallback] ${fn} returned ${res.status}, loading mock.`);
    } catch {
      console.warn(`[RPC fallback] connection failure for ${fn}, loading mock.`);
    }
  }
  const mock = readMock(fn);
  if (mock === undefined) return { error: `Données indisponibles pour ${fn}`, status: 502 };
  return { data: mock, source: 'mock' };
}

// Second opinion: the interface never shows treatment, drug or dosage content.
const THERAPEUTIC = /(traitement|posolog|\bdoses?\b|\bmg\b|antiagr|anticoag|aspirine|h[ée]parine|prescri|administr|m[ée]dicament|antibio|insulin|perfusion|thrombolys)/i;
function redactOpinion(text: unknown): unknown {
  if (typeof text !== 'string') return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !THERAPEUTIC.test(s));
  if (kept.length === sentences.length) return text;
  return [...kept, '[Éléments thérapeutiques masqués : décision réservée au médecin.]'].join(' ');
}

function forbid(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function json(data: unknown, source: Source) {
  return NextResponse.json(data, { headers: { 'x-ummc-source': source } });
}

async function acknowledgeAlert(user: UserSession, body: Json) {
  if (!canAcknowledgeAlerts(user)) return forbid('Votre profil ne peut pas acquitter une alerte.');
  const id = Number(body.p_id);
  const loaded = await loadData('ui_events', {});
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const event = (loaded.data as Json[]).find((e) => Number(e.id) === id);
  if (!event) return NextResponse.json({ error: 'Alerte introuvable' }, { status: 404 });
  if (user.role === 'coordinateur' && event.region !== user.region) {
    return forbid(`Un coordinateur de ${user.region} ne peut pas acquitter une alerte de ${event.region}.`);
  }
  const cause = String(body.p_cause ?? '').slice(0, 500);
  const resolve = Boolean(body.p_resolve);
  // The author is taken from the server session, never from the request body.
  if (!isMock()) {
    const res = await callLive('sup_event_ack', { p_id: id, p_by: user.name, p_cause: cause, p_resolve: resolve });
    if (!res.ok) return NextResponse.json({ error: `Erreur RPC sup_event_ack: ${await res.text()}` }, { status: res.status });
    return json(await res.json(), 'live');
  }
  const record: AckRecord = {
    status: resolve ? 'resolved' : 'explained',
    explanation: cause,
    ack_by: user.name,
    ack_at: new Date().toISOString(),
  };
  acks.set(id, record);
  return json({ ok: true, ...record }, 'mock');
}

async function reviewSecondOpinion(user: UserSession, body: Json) {
  if (!canReviewSecondOpinion(user)) return forbid('Seul le médecin référent (ou la direction) peut valider un second avis.');
  const verdict = String(body.p_verdict ?? '');
  if (!['accepte', 'modifie', 'rejete'].includes(verdict)) {
    return NextResponse.json({ error: 'Décision invalide' }, { status: 400 });
  }
  const key = String(body.p_version_key ?? '');
  const comment = String(body.p_comment ?? '').slice(0, 1000);
  if (!isMock()) {
    const res = await callLive('so_review', { p_version_key: key, p_verdict: verdict, p_comment: comment, p_by: user.name });
    if (!res.ok) return NextResponse.json({ error: `Erreur RPC so_review: ${await res.text()}` }, { status: res.status });
    return json(await res.json(), 'live');
  }
  const record: ReviewRecord = { status_review: verdict, reviewed_by: user.name, comment, reviewed_at: new Date().toISOString() };
  reviews.set(key, record);
  return json({ ok: true, ...record }, 'mock');
}

export async function POST(request: NextRequest, context: { params: Promise<{ fn: string }> }) {
  const { fn } = await context.params;
  const user = sessionFor(request.cookies.get(ROLE_COOKIE)?.value);

  let body: Json = {};
  try {
    body = (await request.json()) as Json;
  } catch {
    body = {};
  }

  if (!READ_FNS.has(fn) && !WRITE_FNS.has(fn)) {
    return NextResponse.json({ error: `Fonction inconnue : ${fn}` }, { status: 404 });
  }
  if (fn === 'sup_event_ack') return acknowledgeAlert(user, body);
  if (fn === 'so_review') return reviewSecondOpinion(user, body);

  // Doctor-level statistics are reserved to the programme direction.
  const groupBy = Array.isArray(body.p_group_by) ? body.p_group_by : [];
  if (fn === 'flux_stats' && groupBy.includes('doctor_id') && !canViewDoctorStats(user)) {
    return forbid('Les statistiques par médecin sont réservées à la direction.');
  }
  // A regional coordinator only queries their region.
  if (user.role === 'coordinateur') body = { ...body, p_region: user.region };

  const loaded = await loadData(fn, body);
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  let data = loaded.data;

  if (user.role === 'coordinateur') {
    if (REGION_FILTERED.has(fn) && Array.isArray(data)) {
      data = (data as Json[]).filter((row) => row.region === user.region);
    }
    if (fn === 'ui_centre_detail') {
      const centre = (data as { centre?: Json }).centre;
      if (centre && centre.region !== user.region) return forbid('Cette unité n’appartient pas à votre région.');
    }
  }
  if (fn === 'ui_events' && Array.isArray(data)) {
    data = (data as Json[]).map((e) => {
      const ack = acks.get(Number(e.id));
      return ack ? { ...e, ...ack } : e;
    });
  }
  if (fn === 'flux_stats' && Array.isArray(data) && !canViewDoctorStats(user)) {
    data = (data as Json[]).map((row) => {
      const copy = { ...row };
      delete copy.doctor_id;
      delete copy.doctor_name;
      return copy;
    });
  }
  if (fn === 'ui_second_opinion' && Array.isArray(data)) {
    data = (data as Json[]).map((c) => ({
      ...c,
      opinion: redactOpinion(c.opinion),
      ...(reviews.get(String(c.versionKey)) ?? {}),
    }));
  }

  return json(data, loaded.source);
}

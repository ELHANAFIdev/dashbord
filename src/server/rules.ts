// Règles du proxy, sans effet de bord : testées par vitest (tests/proxy.test.ts).
import { FUNCTIONS, type ParamSpec } from './functions';
import { sameRegion } from '@/lib/regions';
import { canViewDoctorNames } from '@/lib/roles';
import type { UserSession } from '@/lib/types';

type Json = Record<string, unknown>;

export class RuleError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 1000;

function coerce(name: string, spec: ParamSpec, value: unknown): unknown {
  if (value === null || value === undefined || value === '') return undefined;
  const kind = spec.kind;
  if (kind === 'int') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n)) throw new RuleError(400, `Paramètre ${name} : entier attendu.`);
    return n;
  }
  if (kind === 'date') {
    if (typeof value !== 'string' || !DATE_RE.test(value)) throw new RuleError(400, `Paramètre ${name} : date AAAA-MM-JJ attendue.`);
    return value;
  }
  if (kind === 'bool') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 'false') return value === 'true';
    throw new RuleError(400, `Paramètre ${name} : booléen attendu.`);
  }
  if (kind === 'text') {
    if (typeof value !== 'string' && typeof value !== 'number') throw new RuleError(400, `Paramètre ${name} : texte attendu.`);
    return String(value).slice(0, MAX_TEXT);
  }
  if (typeof value !== 'string' || !kind.enum.includes(value)) {
    throw new RuleError(400, `Paramètre ${name} : valeur attendue parmi ${kind.enum.join(', ')}.`);
  }
  return value;
}

/**
 * Ne garde que les paramètres connus de la fonction, avec leur type, et ajoute ceux que
 * le serveur impose (auteur d'une écriture, région d'un coordinateur pour ui_events).
 * Un paramètre inconnu n'est jamais transmis : PostgREST le refuserait (PGRST202).
 */
export function sanitizeParams(fn: string, body: unknown, user: UserSession): Json {
  const spec = FUNCTIONS[fn];
  if (!spec) throw new RuleError(404, `Fonction inconnue : ${fn}`);
  const input = body && typeof body === 'object' && !Array.isArray(body) ? (body as Json) : {};
  const out: Json = {};
  for (const [name, p] of Object.entries(spec.params)) {
    if (p.server) continue;
    const v = coerce(name, p, input[name]);
    if (v !== undefined) out[name] = v;
  }
  // Seule ui_events accepte p_region ; un coordinateur y est toujours ramené à sa région.
  if (fn === 'ui_events' && user.role === 'coordinateur' && user.region) out.p_region = user.region;
  if ('p_by' in spec.params) out.p_by = user.name;
  if ('p_par' in spec.params) out.p_par = user.name;
  for (const [name, p] of Object.entries(spec.params)) {
    if (p.required && out[name] === undefined) throw new RuleError(400, `Paramètre obligatoire manquant : ${name}`);
  }
  return out;
}

/** Filtre par région les réponses qui portent un champ `region` (coordinateur uniquement). */
export function filterByRegion(fn: string, data: unknown, user: UserSession): unknown {
  if (user.role !== 'coordinateur' || !user.region) return data;
  const spec = FUNCTIONS[fn];
  if (spec?.regionRows && Array.isArray(data)) {
    return data.filter((row) => row && typeof row === 'object' && sameRegion((row as Json).region as string, user.region));
  }
  if (fn === 'ui_centre_detail' && data && typeof data === 'object') {
    const centre = (data as { centre?: Json }).centre;
    if (centre && !sameRegion(centre.region as string, user.region)) {
      throw new RuleError(403, 'Cette unité n’appartient pas à votre région.');
    }
  }
  return data;
}

/** Statistiques par médecin : noms réservés à la direction, groupes de moins de 10 consultations exclus. */
export function protectStats(data: unknown, user: UserSession, groupe: unknown): unknown {
  if (!Array.isArray(data)) return data;
  const rows = data.filter((r) => Number((r as Json)?.consultations ?? 0) >= 10);
  if (groupe !== 'medecin' || canViewDoctorNames(user)) return rows;
  return rows.map((r) => ({ ...(r as Json), groupe_nom: `Médecin n° ${(r as Json).groupe_id}` }));
}

// Second avis : l'interface ne montre jamais de contenu thérapeutique (traitement, molécule, dose, consigne).
const THERAPEUTIC =
  /(traitement|trait[ée]|posolog|\bdoses?\b|\d+\s?(mg|ml|µg|ui)\b|\bmg\b|antiagr|anticoag|aspirine|h[ée]parine|prescri|ordonnance|administr|m[ée]dicament|antibio|amoxi|parac[ée]tamol|insulin|perfusion|thrombolys|comprim[ée]|injection|transf[ée]rer|transfert|smur|\bdonner\b|\badministrer\b)/i;
export const REDACTION_NOTICE = '[Élément thérapeutique masqué : décision réservée au médecin.]';

export function redactText(text: unknown): unknown {
  if (typeof text !== 'string') return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !THERAPEUTIC.test(s));
  if (kept.length === sentences.length) return text;
  return [...kept, REDACTION_NOTICE].join(' ');
}

/** Applique la censure thérapeutique à toutes les chaînes d'une structure (récursif). */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redactText(value) as T;
  if (Array.isArray(value)) {
    const items = value.map((v) => redactDeep(v));
    // Plusieurs éléments masqués dans une même liste ne laissent qu'une seule mention.
    return items.filter((v, i) => !(v === REDACTION_NOTICE && items.indexOf(v) !== i)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json)) out[k] = redactDeep(v);
    return out as T;
  }
  return value;
}

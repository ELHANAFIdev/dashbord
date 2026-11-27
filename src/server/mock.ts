// Lecture des données de démonstration (src/mock/), avec application des paramètres
// que la vraie fonction appliquerait (filtres de dates, statut, limite…).
import fs from 'node:fs';
import path from 'node:path';
import { sameRegion } from '@/lib/regions';

type Json = Record<string, unknown>;
const MOCK_DIR = path.join(process.cwd(), 'src', 'mock');
const cache = new Map<string, unknown>();

function readFile(rel: string): unknown | undefined {
  if (cache.has(rel)) return structuredClone(cache.get(rel));
  const file = path.join(MOCK_DIR, rel);
  if (!file.startsWith(MOCK_DIR) || !fs.existsSync(file)) return undefined;
  const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
  cache.set(rel, data);
  return structuredClone(data);
}

const inRange = (d: unknown, from: unknown, to: unknown) =>
  typeof d === 'string' && (typeof from !== 'string' || d >= from) && (typeof to !== 'string' || d <= to);

/** Compare une période (AAAA, AAAA-MM ou AAAA-MM-JJ) à un intervalle de dates. */
function periodInRange(periode: string, du: unknown, au: unknown): boolean {
  const start = periode.length === 4 ? `${periode}-01-01` : periode.length === 7 ? `${periode}-01` : periode;
  const end = periode.length === 4 ? `${periode}-12-31` : periode.length === 7 ? `${periode}-31` : periode;
  return (typeof au !== 'string' || start <= au) && (typeof du !== 'string' || end >= du);
}

export function readMock(fn: string, p: Json): unknown | undefined {
  switch (fn) {
    case 'ui_centre_detail': {
      const d = readFile(`ui_centre_detail/${Number(p.p_centre_id)}.json`) as Json | undefined;
      if (!d) return undefined;
      d.series = (d.series as Json[]).filter((s) => inRange(s.day, p.p_from, p.p_to));
      return d;
    }
    case 'ctx_centre_context': {
      const rows = readFile(`ctx_centre_context/${Number(p.p_centre_id)}.json`) as Json[] | undefined;
      return rows?.filter((r) => inRange(r.day, p.p_from, p.p_to));
    }
    case 'ui_prevision': {
      const d = readFile(`ui_prevision/${Number(p.p_centre_id)}.json`) as Json | undefined;
      if (!d) return undefined;
      let jours = d.jours as Json[];
      if (typeof p.p_du === 'string') jours = jours.filter((j) => (j.jour as string) >= (p.p_du as string));
      d.jours = jours.slice(0, typeof p.p_jours === 'number' ? p.p_jours : 14);
      return d;
    }
    case 'ui_events': {
      const rows = readFile('ui_events.json') as Json[] | undefined;
      if (!rows) return undefined;
      const status = (p.p_status as string) ?? 'open';
      return rows
        .filter((r) => status === 'all' || r.status === status)
        .filter((r) => typeof p.p_region !== 'string' || sameRegion(r.region as string, p.p_region))
        .slice(0, typeof p.p_limit === 'number' ? p.p_limit : 100);
    }
    case 'sup_centre_category_list': {
      const rows = readFile('sup_centre_category_list.json') as Json[] | undefined;
      return p.p_attention_only === false ? rows : rows?.filter((r) => r.attention);
    }
    case 'ui_anomalies': {
      const rows = readFile('ui_anomalies.json') as Json[] | undefined;
      return rows
        ?.filter((r) => inRange(r.jour, p.p_du, p.p_au))
        .filter((r) => p.p_centre_id === undefined || r.centre_id === p.p_centre_id)
        .filter((r) => p.p_type === undefined || r.type === p.p_type)
        .filter((r) => p.p_statut === undefined || r.statut === p.p_statut)
        .slice(0, typeof p.p_limit === 'number' ? p.p_limit : 500);
    }
    case 'ui_stats_formation':
      return readFile(`ui_stats_formation/${p.p_groupe === 'medecin' ? 'medecin' : 'centre'}.json`);
    case 'flux_lieux': {
      const units = readFile('ui_map.json') as Json[] | undefined;
      return units?.map((u) => ({
        centre_id: u.centre_id,
        centre_name: u.centre_name,
        commune: `Commune de ${String(u.centre_name).replace(/^UM\d*\s*/i, '')}`,
        province: u.province,
        region: u.region,
      }));
    }
    case 'flux_heures_niveau': {
      // Démonstration : la carte nationale, mise à l'échelle et décalée d'une heure selon le lieu choisi.
      const base = readFile('flux_indicateurs/heures.national.json') as Json[] | undefined;
      if (!base || !p.p_valeur || p.p_niveau === 'national') return base;
      const seed = [...String(p.p_valeur)].reduce((a, c) => a + c.charCodeAt(0), 0);
      const scale = p.p_niveau === 'region' ? 0.12 : p.p_niveau === 'province' ? 0.04 : 0.012;
      const shift = seed % 3 === 0 ? 1 : 0;
      return base.map((r) => {
        const h = Number(r.heure) + shift;
        const c = Math.max(0, Math.round(Number(r.consultations) * scale * (0.8 + (seed % 7) / 15)));
        const ha = Math.max(1, Math.round(Number(r.heures_actives) * scale));
        return { ...r, heure: h, consultations: c, heures_actives: ha, consultations_par_heure_active: Math.round((c / ha) * 100) / 100 };
      });
    }
    case 'flux_indicateurs': {
      const ind = String(p.p_indicateur);
      const niveau = (p.p_niveau as string) ?? 'national';
      const grain = (p.p_grain as string) ?? 'mois';
      const data =
        readFile(`flux_indicateurs/${ind}.${niveau}.${grain}.json`) ?? readFile(`flux_indicateurs/${ind}.${niveau}.json`);
      if (!Array.isArray(data)) return data;
      if (ind === 'volumes') return (data as Json[]).filter((r) => periodInRange(String(r.periode), p.p_du, p.p_au));
      if (ind === 'croissance') return (data as Json[]).filter((r) => periodInRange(String(r.mois), p.p_du, p.p_au));
      return data;
    }
    default:
      return readFile(`${fn}.json`);
  }
}

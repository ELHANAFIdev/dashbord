import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionFor } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import { READ_FUNCTIONS, WRITE_FUNCTIONS } from '@/server/functions';
import { LiveError, normalizeLive } from '@/server/live';
import { readMock } from '@/server/mock';
import { REDACTION_NOTICE, redactDeep, redactText, sanitizeParams } from '@/server/rules';
import { handleRpc, type RpcDeps } from '@/server/rpc';
import { resetStore } from '@/server/store';

type Json = Record<string, unknown>;
const COORD_REGION = "L'Oriental";
const user = (role: UserRole) => sessionFor(role, COORD_REGION);

/** Base « réelle » simulée : enregistre chaque appel et répond avec les données de démonstration. */
function liveDeps() {
  const calls: { fn: string; params: Json }[] = [];
  const deps: RpcDeps = {
    mode: 'live',
    callLive: vi.fn(async (fn: string, params: Json) => {
      calls.push({ fn, params });
      if (fn === 'sup_event_ack') return { ok: true, id: params.p_id, status: 'explained' };
      if (fn === 'ui_anomalie_enquete') return { ok: true, id: params.p_id, statut: params.p_statut };
      return readMock(fn, params);
    }),
    readMock: () => {
      throw new Error('readMock ne doit jamais être appelé en mode réel');
    },
  };
  return { deps, calls };
}
const mockDeps: RpcDeps = { mode: 'mock', callLive: async () => Promise.reject(new Error('pas de base')), readMock };

const map = readMock('ui_map', {}) as Json[];
const otherRegionUnit = map.find((u) => u.region !== COORD_REGION)!;
const ownRegionUnit = map.find((u) => u.region === COORD_REGION)!;
const events = readMock('ui_events', { p_status: 'all', p_limit: 5000 }) as Json[];

beforeEach(() => resetStore());

describe('liste blanche', () => {
  it('refuse une fonction inconnue ou supprimée de la base', async () => {
    for (const fn of ['flux_series', 'flux_stats', 'flux_live_centres', 'ui_second_opinion', 'pg_sleep', '__proto__', 'constructor']) {
      const r = await handleRpc(fn, {}, user('direction'), mockDeps);
      expect(r.status, fn).toBe(404);
    }
  });

  it('expose exactement les fonctions du contrat', () => {
    expect(READ_FUNCTIONS.sort()).toEqual(
      [
        'ctx_centre_context',
        'flux_heures_niveau',
        'flux_indicateurs',
        'flux_lieux',
        'second_avis',
        'second_avis_bilan',
        'sup_centre_category_list',
        'ui_anomalies',
        'ui_causalite',
        'ui_causes',
        'ui_centre_detail',
        'ui_dashboard',
        'ui_events',
        'ui_evolution',
        'ui_facteurs',
        'ui_health',
        'ui_map',
        'ui_population',
        'ui_prevision',
        'ui_stats_formation',
      ].sort(),
    );
    expect(WRITE_FUNCTIONS.sort()).toEqual(['so_review', 'sup_event_ack', 'ui_anomalie_enquete']);
  });

  it('second avis en mode réel : ui_second_avis, puis ui_so_revue avec l’auteur pris dans la session', async () => {
    const calls: { fn: string; params: Json }[] = [];
    const deps: RpcDeps = {
      mode: 'live',
      callLive: vi.fn(async (fn: string, params: Json) => {
        calls.push({ fn, params });
        if (fn === 'ui_second_avis')
          return [
            { id: '1', version_key: 'so:1', region: COORD_REGION, review_priority: 'HIGH', output: { summary: 'Débuter un traitement antibiotique.' } },
            { id: '2', version_key: 'so:2', region: 'Autre région', review_priority: 'HIGH', output: { summary: 'RAS' } },
          ];
        if (fn === 'ui_so_revue') return { ok: true, version_key: params.p_version_key };
        return {};
      }),
      readMock: () => {
        throw new Error('readMock ne doit jamais être appelé en mode réel');
      },
    };
    const r = await handleRpc('second_avis', { p_priorite: 'HIGH', p_token: 'vole' }, user('direction'), deps);
    expect(r.source).toBe('live');
    expect(calls[0]).toEqual({ fn: 'ui_second_avis', params: { p_priorite: 'HIGH' } });
    expect(JSON.stringify(r.body)).not.toMatch(/antibiotique/);
    const coord = await handleRpc('second_avis', {}, user('coordinateur'), deps);
    expect((coord.body as Json[]).map((c) => c.id)).toEqual(['1']);
    const w = await handleRpc('so_review', { p_version_key: 'so:1', p_verdict: 'accepte', p_par: 'Usurpateur' }, user('medecin_referent'), deps);
    expect(w.status).toBe(200);
    expect(calls.at(-1)).toEqual({
      fn: 'ui_so_revue',
      params: { p_version_key: 'so:1', p_verdict: 'accepte', p_par: user('medecin_referent').name, p_commentaire: null },
    });
    const sansCommentaire = await handleRpc('so_review', { p_version_key: 'so:1', p_verdict: 'rejete' }, user('medecin_referent'), deps);
    expect(sansCommentaire.status).toBe(400);
  });
});

describe('paramètres', () => {
  it('ne transmet jamais un paramètre inconnu (ni p_token venu du navigateur)', async () => {
    const { deps, calls } = liveDeps();
    await handleRpc('ui_map', { p_measure: 'pec', p_token: 'pirate', p_region: 'Souss-Massa', p_foo: 1, select: '*' }, user('direction'), deps);
    expect(calls).toEqual([{ fn: 'ui_map', params: { p_measure: 'pec' } }]);
  });

  it('utilise p_status pour ui_events et accepte p_region pour cette seule fonction', async () => {
    const { deps, calls } = liveDeps();
    await handleRpc('ui_events', { p_status: 'all', p_region: 'Souss-Massa', status: 'open' }, user('direction'), deps);
    expect(calls[0].params).toEqual({ p_status: 'all', p_region: 'Souss-Massa' });
    const bad = await handleRpc('ui_events', { p_status: 'ouvert' }, user('direction'), deps);
    expect(bad.status).toBe(400);
  });

  it('impose la région du coordinateur sur ui_events, sans l’ajouter ailleurs', async () => {
    const { deps, calls } = liveDeps();
    await handleRpc('ui_events', { p_status: 'open', p_region: 'Souss-Massa' }, user('coordinateur'), deps);
    await handleRpc('sup_centre_category_list', { p_attention_only: true }, user('coordinateur'), deps);
    expect(calls[0].params.p_region).toBe(COORD_REGION);
    expect(calls[1].params).toEqual({ p_attention_only: true });
    expect('p_region' in calls[1].params).toBe(false);
  });

  it('exige p_from et p_to pour ui_centre_detail et ctx_centre_context', async () => {
    const { deps, calls } = liveDeps();
    for (const fn of ['ui_centre_detail', 'ctx_centre_context']) {
      const r = await handleRpc(fn, { p_centre_id: ownRegionUnit.centre_id }, user('direction'), deps);
      expect(r.status).toBe(400);
      expect((r.body as Json).error).toMatch(/p_from/);
    }
    expect(calls).toHaveLength(0);
    const ok = await handleRpc('ui_centre_detail', { p_centre_id: ownRegionUnit.centre_id, p_from: '2026-05-15', p_to: '2026-08-13' }, user('direction'), deps);
    expect(ok.status).toBe(200);
    expect(calls[0].params).toEqual({ p_centre_id: ownRegionUnit.centre_id, p_from: '2026-05-15', p_to: '2026-08-13' });
  });

  it('valide les types (entier, date, énumération)', () => {
    expect(() => sanitizeParams('ui_prevision', { p_centre_id: 'abc' }, user('direction'))).toThrow(/entier/);
    expect(() => sanitizeParams('ui_anomalies', { p_du: '13/08/2026', p_au: '2026-08-13' }, user('direction'))).toThrow(/date/);
    expect(() => sanitizeParams('flux_indicateurs', { p_indicateur: 'series', p_du: '2026-01-01', p_au: '2026-08-13' }, user('direction'))).toThrow(/valeur/);
    expect(sanitizeParams('ui_stats_formation', { p_du: '2026-05-15', p_au: '2026-08-13', p_groupe: 'medecin' }, user('direction'))).toEqual({
      p_du: '2026-05-15',
      p_au: '2026-08-13',
      p_groupe: 'medecin',
    });
  });
});

describe('auteur des écritures', () => {
  it('prend p_by et p_par dans la session, jamais dans la requête', async () => {
    const { deps, calls } = liveDeps();
    const ev = events.find((e) => e.status === 'open')!;
    await handleRpc('sup_event_ack', { p_id: ev.id, p_by: 'Usurpateur', p_cause: 'Pluie' }, user('direction'), deps);
    const ack = calls.find((c) => c.fn === 'sup_event_ack')!;
    expect(ack.params).toEqual({ p_id: ev.id, p_by: user('direction').name, p_cause: 'Pluie' });

    const an = (readMock('ui_anomalies', { p_du: '2000-01-01', p_au: '2100-01-01', p_limit: 100000 }) as Json[])[0];
    await handleRpc('ui_anomalie_enquete', { p_id: an.id, p_statut: 'explique', p_par: 'Usurpateur', p_cause_code: '2.2' }, user('direction'), deps);
    const enq = calls.find((c) => c.fn === 'ui_anomalie_enquete')!;
    expect(enq.params).toEqual({ p_id: an.id, p_statut: 'explique', p_cause_code: '2.2', p_par: user('direction').name });
  });
});

describe('filtrage régional du coordinateur', () => {
  it('ne renvoie que les lignes de sa région', async () => {
    for (const fn of ['ui_map', 'sup_centre_category_list', 'ui_evolution', 'ui_population']) {
      const r = await handleRpc(fn, {}, user('coordinateur'), mockDeps);
      const rows = r.body as Json[];
      expect(rows.length, fn).toBeGreaterThan(0);
      expect(rows.every((x) => x.region === COORD_REGION), fn).toBe(true);
    }
    const all = await handleRpc('ui_map', {}, user('direction'), mockDeps);
    expect((all.body as Json[]).length).toBe(100);
  });

  it('refuse la fiche, le contexte et la prévision d’une unité d’une autre région', async () => {
    const range = { p_from: '2026-05-15', p_to: '2026-08-13' };
    for (const [fn, params] of [
      ['ui_centre_detail', { p_centre_id: otherRegionUnit.centre_id, ...range }],
      ['ctx_centre_context', { p_centre_id: otherRegionUnit.centre_id, ...range }],
      ['ui_prevision', { p_centre_id: otherRegionUnit.centre_id }],
    ] as const) {
      const r = await handleRpc(fn, params, user('coordinateur'), mockDeps);
      expect(r.status, fn).toBe(403);
    }
    const own = await handleRpc('ui_centre_detail', { p_centre_id: ownRegionUnit.centre_id, ...range }, user('coordinateur'), mockDeps);
    expect(own.status).toBe(200);
  });

  it('refuse l’acquittement d’une alerte d’une autre région', async () => {
    const other = events.find((e) => e.region !== COORD_REGION)!;
    const r = await handleRpc('sup_event_ack', { p_id: other.id, p_cause: 'x' }, user('coordinateur'), mockDeps);
    expect(r.status).toBe(403);
  });
});

describe('problèmes de pratique : noms des médecins', () => {
  const params = { p_du: '2026-05-15', p_au: '2026-08-13', p_groupe: 'medecin' };

  it('garde les noms pour la direction', async () => {
    const r = await handleRpc('ui_stats_formation', params, user('direction'), mockDeps);
    expect((r.body as Json[]).some((x) => String(x.groupe_nom).startsWith('Dr '))).toBe(true);
  });

  it('remplace les noms par « Médecin n° id » pour les autres profils', async () => {
    for (const role of ['coordinateur', 'medecin_referent', 'demo'] as UserRole[]) {
      const r = await handleRpc('ui_stats_formation', params, user(role), mockDeps);
      const rows = r.body as Json[];
      expect(rows.length).toBeGreaterThan(0);
      for (const x of rows) expect(x.groupe_nom).toBe(`Médecin n° ${x.groupe_id}`);
      expect(JSON.stringify(rows)).not.toMatch(/Dr [A-Z]\./);
    }
  });

  it('renvoie la forme « problèmes de pratique » (13 indicateurs, plus de champs part_*)', async () => {
    const r = await handleRpc('ui_stats_formation', { ...params, p_groupe: 'centre' }, user('direction'), mockDeps);
    const rows = r.body as Json[];
    for (const x of rows) {
      const ind = x.indicateurs as Json[];
      expect(ind.map((i) => i.code)).toEqual(['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P11', 'P12', 'P07', 'P08', 'P09', 'P10', 'P13']);
      expect(Object.keys(x).some((k) => k.startsWith('part_') || k === 'besoins_formation' || k === 'mediane_reseau')).toBe(false);
      expect(ind.find((i) => i.code === 'P13')?.alerte).toBe(false);
      expect(x.problemes).toEqual(expect.arrayContaining(ind.filter((i) => i.alerte).map((i) => i.libelle)));
    }
  });

  it('exclut les groupes de moins de 10 consultations et ne touche pas aux noms d’unités', async () => {
    const { deps } = liveDeps();
    deps.callLive = async () => [
      { groupe_id: 1, groupe_nom: 'UM1 Test', consultations: 9, region: 'Souss-Massa' },
      { groupe_id: 2, groupe_nom: 'UM1 Autre', consultations: 40, region: 'Souss-Massa' },
    ];
    const r = await handleRpc('ui_stats_formation', { ...params, p_groupe: 'centre' }, user('medecin_referent'), deps);
    expect(r.body).toEqual([{ groupe_id: 2, groupe_nom: 'UM1 Autre', consultations: 40, region: 'Souss-Massa' }]);
  });
});

describe('censure thérapeutique du second avis', () => {
  it('retire les phrases de traitement, de dose ou de consigne', () => {
    const t = redactText('Douleur thoracique typique. Administrer 300 mg d’aspirine. Transfert SMUR immédiat. ECG à discuter.');
    expect(t).toBe(`Douleur thoracique typique. ECG à discuter. ${REDACTION_NOTICE}`);
    expect(redactText('Aucun signe de gravité.')).toBe('Aucun signe de gravité.');
    const deep = redactDeep({ a: ['Débuter un traitement antibiotique', 'Glycémie capillaire'], b: { c: 'Paracétamol 1 g.' } });
    expect(deep).toEqual({ a: [REDACTION_NOTICE, 'Glycémie capillaire'], b: { c: REDACTION_NOTICE } });
  });

  it('sert l’échantillon sans contenu thérapeutique, marqué comme démonstration', async () => {
    const r = await handleRpc('second_avis', {}, user('demo'), mockDeps);
    expect(r.source).toBe('mock');
    const text = JSON.stringify(r.body);
    expect(text).not.toMatch(/mg\b|posolog|prescri|traitement|SMUR|GPT/i);
    expect(text).toContain('google/gemma-4-31B-it');
  });
});

describe('profils et droits', () => {
  it('le profil démonstration est en lecture seule', async () => {
    const ev = events.find((e) => e.status === 'open')!;
    for (const [fn, body] of [
      ['sup_event_ack', { p_id: ev.id }],
      ['ui_anomalie_enquete', { p_id: 9001, p_statut: 'explique' }],
      ['so_review', { p_version_key: 'ech-001-v1', p_verdict: 'accepte' }],
    ] as const) {
      const r = await handleRpc(fn, body, user('demo'), mockDeps);
      expect(r.status, fn).toBe(403);
    }
    expect((await handleRpc('ui_dashboard', {}, user('demo'), mockDeps)).status).toBe(200);
  });

  it('le médecin référent valide un second avis mais n’acquitte pas une alerte', async () => {
    const ev = events.find((e) => e.status === 'open')!;
    expect((await handleRpc('sup_event_ack', { p_id: ev.id }, user('medecin_referent'), mockDeps)).status).toBe(403);
    const ok = await handleRpc('so_review', { p_version_key: 'ech-002-v1', p_verdict: 'modifie', p_comment: 'Peser l’enfant' }, user('medecin_referent'), mockDeps);
    expect(ok.status).toBe(200);
    const sample = (await handleRpc('second_avis', {}, user('direction'), mockDeps)).body as Json[];
    expect(sample.find((c) => c.version_key === 'ech-002-v1')?.review).toMatchObject({ verdict: 'modifie', by: user('medecin_referent').name });
  });

  it('un coordinateur ne valide pas de second avis', async () => {
    const r = await handleRpc('so_review', { p_version_key: 'ech-001-v1', p_verdict: 'accepte' }, user('coordinateur'), mockDeps);
    expect(r.status).toBe(403);
  });
});

describe('source des données', () => {
  it('signale la démonstration et applique les écritures en mémoire', async () => {
    const ev = events.find((e) => e.status === 'open')!;
    const ack = await handleRpc('sup_event_ack', { p_id: ev.id, p_cause: '2.2 Fortes pluies' }, user('direction'), mockDeps);
    expect(ack).toMatchObject({ status: 200, source: 'mock' });
    const open = (await handleRpc('ui_events', { p_status: 'all' }, user('direction'), mockDeps)).body as Json[];
    expect(open.find((e) => e.id === ev.id)).toMatchObject({ status: 'explained', ack_by: user('direction').name });
    const stillOpen = (await handleRpc('ui_events', { p_status: 'open' }, user('direction'), mockDeps)).body as Json[];
    expect(stillOpen.some((e) => e.id === ev.id)).toBe(false);
  });

  it('en mode réel, une panne de la base donne une erreur et jamais des données fictives', async () => {
    const readSpy = vi.fn(readMock);
    const deps: RpcDeps = {
      mode: 'live',
      callLive: async () => {
        throw new LiveError(502, 'Base de données injoignable (ui_dashboard).');
      },
      readMock: readSpy,
    };
    const r = await handleRpc('ui_dashboard', {}, user('direction'), deps);
    expect(r.status).toBe(502);
    expect(r.source).toBeUndefined();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('en mode réel, les réponses sont marquées live', async () => {
    const { deps } = liveDeps();
    const r = await handleRpc('ui_health', {}, user('direction'), deps);
    expect(r).toMatchObject({ status: 200, source: 'live' });
  });
});

describe('forme des réponses réelles', () => {
  it('flux_indicateurs : garde les lignes de l’enveloppe', () => {
    const rows = [{ periode: '2026-01-01', consultations: 10, patients: 8, nouveaux_patients: 2 }];
    expect(normalizeLive('flux_indicateurs', { p_indicateur: 'volumes' }, { indicateur: 'volumes', du: 'x', au: 'y', lignes: rows })).toEqual(rows);
  });
  it('flux_indicateurs croissance : mois AAAA-MM et mois vides retirés', () => {
    const out = normalizeLive('flux_indicateurs', { p_indicateur: 'croissance', p_au: '2026-07-31' }, {
      lignes: [
        { mois: 1, consultations_n: 100, consultations_n_1: 80, variation_pct: 25 },
        { mois: 8, consultations_n: 30, consultations_n_1: 95, variation_pct: -68 },
        { mois: 9, consultations_n: 0, consultations_n_1: 90, variation_pct: -100 },
      ],
    });
    expect(out).toEqual([{ mois: '2026-01', consultations_n: 100, consultations_n_1: 80, variation_pct: 25 }]);
  });
  it('les autres fonctions passent telles quelles', () => {
    const body = { day: '2026-08-13' };
    expect(normalizeLive('ui_dashboard', {}, body)).toBe(body);
  });
});

describe('compléments du 26/11', () => {
  it('flux_heures_niveau : seuls les niveaux connus passent, et p_token du navigateur est retiré', async () => {
    const { deps, calls } = liveDeps();
    await handleRpc('flux_heures_niveau', { p_du: '2025-08-01', p_au: '2026-07-31', p_niveau: 'commune', p_valeur: 'Tata', p_token: 'x' }, user('direction'), deps);
    expect(calls.at(-1)).toEqual({ fn: 'flux_heures_niveau', params: { p_du: '2025-08-01', p_au: '2026-07-31', p_niveau: 'commune', p_valeur: 'Tata' } });
    const bad = await handleRpc('flux_heures_niveau', { p_du: '2025-08-01', p_au: '2026-07-31', p_niveau: 'douar' }, user('direction'), deps);
    expect(bad.status).toBe(400);
  });
  it('flux_lieux en démonstration : une commune par unité', async () => {
    const r = await handleRpc('flux_lieux', {}, user('direction'), mockDeps);
    const rows = r.body as Json[];
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[0]).toHaveProperty('commune');
  });
});

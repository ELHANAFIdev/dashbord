// Liste blanche des fonctions joignables par le proxy, avec leurs paramètres exacts
// (CONTRATS_API.md). Tout paramètre absent de cette liste est retiré avant l'appel.

export type ParamKind = 'int' | 'date' | 'text' | 'bool' | { enum: readonly string[] };

export interface ParamSpec {
  kind: ParamKind;
  required?: boolean;
  /** Rempli par le serveur (auteur d'une écriture, région d'un coordinateur) : jamais lu dans la requête. */
  server?: boolean;
}

export interface FunctionSpec {
  kind: 'read' | 'write';
  params: Record<string, ParamSpec>;
  /** Les lignes portent un champ `region` : un coordinateur ne reçoit que la sienne. */
  regionRows?: boolean;
  /** Le paramètre p_centre_id désigne une unité dont la région est contrôlée. */
  centreParam?: boolean;
  /** Nom différent du proxy : en mode réel, la base est appelée sous ce nom. */
  liveName?: string;
}

const date: ParamSpec = { kind: 'date' };
const dateReq: ParamSpec = { kind: 'date', required: true };
const int: ParamSpec = { kind: 'int' };
const intReq: ParamSpec = { kind: 'int', required: true };
const text: ParamSpec = { kind: 'text' };

export const INDICATEURS = ['volumes', 'repartition', 'retour', 'profil', 'heures', 'entonnoir', 'croissance'] as const;
export const NIVEAUX = ['centre', 'province', 'region', 'national'] as const;
export const GRAINS = ['jour', 'mois', 'annee'] as const;
export const EVENT_STATUSES = ['open', 'all', 'explained', 'resolved'] as const;
export const ANOMALY_TYPES = ['consultations_basses', 'consultations_hautes', 'ecart_admissions'] as const;
export const ANOMALY_STATUSES = ['a_enqueter', 'explique', 'confirme', 'ecarte'] as const;
export const REVIEW_VERDICTS = ['accepte', 'modifie', 'rejete'] as const;
export const REVIEW_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'ROUTINE'] as const;

export const FUNCTIONS: Record<string, FunctionSpec> = {
  // ------------------------------------------------------------- lectures
  ui_dashboard: { kind: 'read', params: { p_day: date } },
  ui_map: { kind: 'read', params: { p_measure: text }, regionRows: true },
  ui_events: {
    kind: 'read',
    params: { p_status: { kind: { enum: EVENT_STATUSES } }, p_region: text, p_limit: int },
    regionRows: true,
  },
  sup_centre_category_list: {
    kind: 'read',
    params: { p_attention_only: { kind: 'bool' }, p_measure: text, p_period_end: date },
    regionRows: true,
  },
  ui_centre_detail: {
    kind: 'read',
    params: { p_centre_id: intReq, p_from: dateReq, p_to: dateReq, p_measure: text },
    centreParam: true,
  },
  ctx_centre_context: { kind: 'read', params: { p_centre_id: intReq, p_from: dateReq, p_to: dateReq }, centreParam: true },
  ui_health: { kind: 'read', params: {} },
  flux_indicateurs: {
    kind: 'read',
    params: {
      p_indicateur: { kind: { enum: INDICATEURS }, required: true },
      p_du: dateReq,
      p_au: dateReq,
      p_niveau: { kind: { enum: NIVEAUX } },
      p_centre_id: int,
      p_grain: { kind: { enum: GRAINS } },
    },
    centreParam: true,
  },
  // Script 28 : carte jour × heure à un niveau donné, et lieux des unités actives pour les filtres.
  flux_heures_niveau: {
    kind: 'read',
    params: {
      p_du: dateReq,
      p_au: dateReq,
      p_niveau: { kind: { enum: ['national', 'region', 'province', 'commune', 'centre'] } },
      p_valeur: text,
    },
  },
  flux_lieux: { kind: 'read', params: {}, regionRows: true },
  ui_anomalies: {
    kind: 'read',
    params: {
      p_du: dateReq,
      p_au: dateReq,
      p_centre_id: int,
      p_type: { kind: { enum: ANOMALY_TYPES } },
      p_statut: { kind: { enum: ANOMALY_STATUSES } },
      p_limit: int,
    },
    regionRows: true,
    centreParam: true,
  },
  ui_causes: { kind: 'read', params: {} },
  ui_facteurs: { kind: 'read', params: {} },
  // Script 29 : six tests par facteur pour séparer corrélation et causalité.
  ui_causalite: { kind: 'read', params: {} },
  ui_prevision: { kind: 'read', params: { p_centre_id: intReq, p_du: date, p_jours: int }, centreParam: true },
  ui_evolution: { kind: 'read', params: { p_mois: int }, regionRows: true },
  ui_population: { kind: 'read', params: {}, regionRows: true },
  ui_stats_formation: {
    kind: 'read',
    params: { p_du: dateReq, p_au: dateReq, p_groupe: { kind: { enum: ['medecin', 'centre'] }, required: true } },
    regionRows: true,
  },
  // Second avis A3 : base locale (script 26) en mode réel, échantillon fictif en démonstration.
  second_avis: { kind: 'read', params: { p_priorite: { kind: { enum: REVIEW_PRIORITIES } }, p_limit: int }, regionRows: true, liveName: 'ui_second_avis' },
  second_avis_bilan: { kind: 'read', params: {}, liveName: 'ui_second_avis_bilan' },

  // ------------------------------------------------------------- écritures
  sup_event_ack: {
    kind: 'write',
    params: { p_id: intReq, p_by: { kind: 'text', server: true }, p_cause: text, p_resolve: { kind: 'bool' } },
  },
  ui_anomalie_enquete: {
    kind: 'write',
    params: {
      p_id: intReq,
      p_statut: { kind: { enum: ANOMALY_STATUSES }, required: true },
      p_cause_code: text,
      p_commentaire: text,
      p_par: { kind: 'text', server: true },
    },
  },
  // Validation du second avis : ui_so_revue en mode réel ; en démonstration, gardée en mémoire du serveur.
  so_review: {
    kind: 'write',
    params: { p_version_key: { kind: 'text', required: true }, p_verdict: { kind: { enum: REVIEW_VERDICTS }, required: true }, p_comment: text },
    liveName: 'ui_so_revue',
  },
};

export const READ_FUNCTIONS = Object.keys(FUNCTIONS).filter((f) => FUNCTIONS[f].kind === 'read');
export const WRITE_FUNCTIONS = Object.keys(FUNCTIONS).filter((f) => FUNCTIONS[f].kind === 'write');

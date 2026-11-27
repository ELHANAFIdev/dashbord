import type { Category } from './types';

/** Dernier jour de la copie figée des données. */
export const DATA_DAY = '2026-08-13';
/** Fenêtre d'analyse de la fiche unité et des anomalies. */
export const DETAIL_FROM = '2026-05-15';
export const DETAIL_TO = DATA_DAY;
/** Douze derniers mois complets. */
export const YEAR_FROM = '2025-08-01';
export const YEAR_TO = '2026-07-31';
export const TARGET_PER_DAY = 21;

export const CATEGORIES_MAIN: Category[] = ['A', 'B', 'C', 'D', 'E'];
export const CATEGORIES_ALL: Category[] = ['A', 'B', 'C', 'D', 'E', 'N', 'X'];

export const CATEGORY_INFO: Record<Category, { label: string; range: string }> = {
  A: { label: 'Cible atteinte', range: '21 et plus par jour' },
  B: { label: 'Proche de la cible', range: '17 à 21 par jour' },
  C: { label: 'Intermédiaire', range: '13 à 17 par jour' },
  D: { label: 'Faible', range: '8 à 13 par jour' },
  E: { label: 'Très faible', range: 'moins de 8 par jour' },
  N: { label: 'Nouvelle unité', range: 'historique trop court' },
  X: { label: 'Données insuffisantes', range: 'non classée' },
};

export const catColor = (c: string) => `var(--cat-${(c || 'x').toLowerCase()})`;
export const catInk = (c: string) => `var(--cat-${(c || 'x').toLowerCase()}-ink)`;

export const SIGNAL_LABELS: Record<string, string> = {
  SILENT_CENTRE: 'Unité silencieuse',
  DAY_ANOMALY: 'Journée anormale',
  DAY_HIGH: 'Journée anormalement haute',
  TREND_DROP: 'Baisse durable',
  LOW_LEVEL: 'Niveau sous la cible',
  NETWORK_SILENCE: 'Silence du réseau',
};
export const signalLabel = (s: string | null | undefined) => (s ? SIGNAL_LABELS[s] ?? s.replace(/_/g, ' ').toLowerCase() : '');

export const SEVERITY_LABELS: Record<string, string> = { high: 'Urgente', medium: 'À traiter', low: 'Information' };
export const EVENT_STATUS_LABELS: Record<string, string> = { open: 'Ouverte', explained: 'Expliquée', resolved: 'Résolue' };

export const ANOMALY_TYPE_LABELS: Record<string, string> = {
  consultations_basses: 'Consultations basses',
  consultations_hautes: 'Consultations hautes',
  ecart_admissions: 'Écart admissions / consultations',
};
export const ANOMALY_STATUS_LABELS: Record<string, string> = {
  a_enqueter: 'À enquêter',
  explique: 'Expliqué',
  confirme: 'Confirmé',
  ecarte: 'Écarté',
};
export const EVOLUTION_STATUS_LABELS: Record<string, string> = {
  croissance: 'Croissance',
  stable: 'Stable',
  declin: 'Déclin',
  a_risque: 'À risque',
  nouveau: 'Nouveau',
  inactif: 'Inactif',
};

export const CONFIANCE_LABELS: Record<string, string> = { forte: 'Confiance forte', moyenne: 'Confiance moyenne', faible: 'Confiance faible', aucune: 'Aucune piste' };

// Types des réponses, calqués sur CONTRATS_API.md (contrat de référence).

export type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'N' | 'X';
export type UserRole = 'direction' | 'coordinateur' | 'medecin_referent' | 'demo';
export type DataSource = 'live' | 'mock';

export interface UserSession {
  role: UserRole;
  name: string;
  region?: string;
}

export interface SessionInfo extends UserSession {
  dataMode: DataSource;
}

export interface Dashboard {
  day: string;
  centres_actifs: number;
  centres_total: number;
  pec_total: number;
  patients_total: number;
  consultations_total: number;
  admissions_total: number;
  pec_median_centre: number;
  events_open: number;
  events_urgent: number;
  attention: number;
  last_night: { run_id: string; started_at: string; ended_at: string; ok: boolean } | null;
}

export interface MapUnit {
  centre_id: number;
  centre_name: string;
  province: string;
  region: string;
  latitude: number;
  longitude: number;
  category: Category;
  mean_value: number;
  attention: boolean;
  attention_reason: string | null;
  open_events: number;
}

export type EventStatus = 'open' | 'explained' | 'resolved';

export interface EventRow {
  id: number;
  centre_id: number;
  centre_name: string;
  province: string;
  region: string;
  signal_type: string;
  severity: 'high' | 'medium' | 'low' | string;
  status: EventStatus | string;
  first_seen: string;
  last_seen: string;
  occurrences: number;
  last_value: number | null;
  last_expected: number | null;
  message: string;
  explanation: string | null;
  explanation_source: string | null;
  ack_by: string | null;
  ack_at: string | null;
}

export interface CategoryRow {
  measure: string;
  period_end: string;
  centre_id: number;
  centre_name: string;
  province: string;
  region: string;
  category: Category;
  mean_value: number;
  ci_low: number;
  ci_high: number;
  pct_days_over_target: number;
  mean_prev: number | null;
  adj_change_pct: number | null;
  trend_z: number | null;
  days_open: number;
  days_zero: number;
  attention: boolean;
  attention_reason: string | null;
  /** Script 28 : false pour une unité hors de la liste active (règles R1 à R7), avec le motif. */
  actif?: boolean;
  motif_hors_liste?: string | null;
}

export interface CentreDetail {
  measure: string;
  centre: {
    centre_id: number;
    centre_name: string;
    province: string;
    region: string;
    latitude: number;
    longitude: number;
    category: Category;
    mean_value: number;
    ci_low: number;
    ci_high: number;
    days_zero: number;
    attention_reason: string | null;
    target: number;
  };
  series: { day: string; value: number; expected: number | null; signal: string | null }[];
  category_history: { period_end: string; category: Category; mean_value: number }[];
  events: EventRow[];
}

export interface ContextDay {
  day: string;
  t_min_c: number | null;
  t_max_c: number | null;
  precip_mm: number | null;
  snow_cm: number | null;
  gust_max_kmh: number | null;
  heavy_rain: boolean;
  snow: boolean;
  strong_wind: boolean;
  extreme_heat: boolean;
  cold: boolean;
  adverse_weather: boolean;
  souk_today: string | null;
  calendar: string | null;
}

export interface HealthNight {
  run_id: string;
  started_at: string;
  ended_at: string | null;
  ok: boolean;
  steps: unknown;
}

export interface Health {
  data_last_day: string;
  nights: HealthNight[];
  last_deliveries: { channel: string; recipient: string; sent_at: string; ok: boolean; event_id: number | null }[];
  context_loads: { dataset: string; loaded_at: string; n_rows: number; status: string }[];
}

export interface VolumeRow {
  periode: string;
  consultations: number;
  patients: number;
  nouveaux_patients: number;
}
export interface RepartitionRow {
  niveau: string;
  centres: number;
  consultations: number;
  patients: number;
  jours_actifs: number;
  consultations_par_jour_actif: number;
  rang: number;
}
export interface RetourRow {
  niveau: string;
  patients: number;
  patients_revenus: number;
  taux_retour_pct: number;
}
export interface HeureRow {
  jour_semaine: number;
  heure: number;
  consultations: number;
  heures_actives: number;
  consultations_par_heure_active: number;
}
export interface CroissanceRow {
  mois: string;
  consultations_n: number;
  consultations_n_1: number;
  variation_pct: number | null;
}

export type AnomalyType = 'consultations_basses' | 'consultations_hautes' | 'ecart_admissions';
export type AnomalyStatus = 'a_enqueter' | 'explique' | 'confirme' | 'ecarte';

export interface Anomaly {
  id: number;
  centre_id: number;
  centre_name: string;
  province: string;
  region: string;
  jour: string;
  type: AnomalyType | string;
  observe: number;
  attendu: number;
  ecart_pct: number | null;
  score: number | null;
  /** Toutes les clés sont facultatives (jsonb_strip_nulls côté base). */
  contexte: {
    meteo?: string | null;
    calendrier?: string | null;
    souk?: string | null;
    lendemain_fete?: boolean | null;
    veille_fete?: boolean | null;
    baisse_province_pct?: number | null;
    baisse_reseau_pct?: number | null;
    hors_ligne_pct?: number | null;
    jours_zero_avant?: number | null;
    provisoire?: boolean | null;
  } | null;
  cause_proposee: string | null;
  cause_code: string | null;
  /** forte | moyenne | faible | aucune */
  confiance: string | null;
  statut: AnomalyStatus | string;
  cause_confirmee: string | null;
  commentaire: string | null;
  par: string | null;
  maj: string | null;
}

export interface Cause {
  code: string;
  famille: string;
  libelle: string;
  effet: string | null;
  portee: string | null;
  donnees: string | null;
  detection_auto: boolean;
}

export interface Facteur {
  facteur: string;
  libelle: string;
  famille: string;
  portee: string;
  effet_pct: number;
  ic_bas: number;
  ic_haut: number;
  n_jours: number;
  pct_anomalies: number | null;
  pct_jours_normaux: number | null;
  lift: number | null;
  /** hausse démontrée | baisse démontrée | hausse faible | baisse faible | pas d'effet démontré | trop peu de jours | référence par jour de semaine */
  verdict: string;
}

export interface Prevision {
  centre: { centre_id: number; centre_name: string; province: string };
  /** null tant qu'aucun modèle n'est ajusté. */
  modele: {
    version: string;
    ajuste_le: string;
    erreur_moyenne_pct: number | null;
    erreur_reference_seule_pct: number | null;
    n_jours_test: number | null;
  } | null;
  jours: { jour: string; prevu: number; bas: number; haut: number; reference: number | null; ferie: boolean | null; souk: string | null; meteo: string | null }[];
  equation: { terme: string; coefficient: number | null; effet_pct: number | null; ic_bas_pct: number | null; ic_haut_pct: number | null; n_jours: number | null }[];
}

export type EvolutionStatus = 'croissance' | 'stable' | 'declin' | 'a_risque' | 'nouveau' | 'inactif';
export interface EvolutionRow {
  centre_id: number;
  centre_name: string;
  province: string;
  region: string;
  population_province: number | null;
  unites_province: number | null;
  premier_jour: string | null;
  consultations_periode: number;
  /** Consultations par jour ouvré, moyenne des 3 derniers mois. */
  par_jour_3_derniers_mois: number | null;
  pour_1000_hab_an: number | null;
  mediane_reseau_pour_1000: number | null;
  tendance_pct_an: number | null;
  t_stat: number | null;
  /** Projection à 3 mois, en consultations par jour ouvré. */
  prevision_3_mois: number | null;
  jours_sans_activite_90: number | null;
  anomalies_ouvertes_90: number | null;
  statut: EvolutionStatus | string;
  signaux: string[];
  recommandation: string | null;
}

export interface PopulationRow {
  region: string;
  province: string;
  population: number;
  menages: number | null;
  population_rurale: number | null;
  centres: number;
  consultations_12_mois: number;
  pour_1000_hab_an: number | null;
  patients_12_mois: number | null;
  couverture_pct: number | null;
  habitants_par_unite: number | null;
  source: string | null;
}

export interface PracticeIndicator {
  /** P01 à P13 */
  code: string;
  /** Libellé avec ses seuils (« plus de 60 min ») : à afficher tel quel. */
  libelle: string;
  /** Durée | Attente | Horaires | Tenue du dossier | Charge | Information */
  famille: string;
  /** consultations | jours | attentes mesurées | consultations lues */
  base: string;
  n: number | null;
  /** null : non mesuré (P04, P08 sans compléments chargés). */
  pct: number | null;
  mediane_reseau_pct: number | null;
  alerte: boolean;
}

/** Problèmes de pratique (ui_stats_formation) par médecin ou par unité. */
export interface PracticeRow {
  groupe_id: number;
  groupe_nom: string;
  centre_name: string | null;
  region: string | null;
  province: string | null;
  consultations: number;
  jours_actifs: number;
  consultations_par_jour: number | null;
  duree_mediane_min: number | null;
  attente_mediane_min: number | null;
  attentes_mesurees: number | null;
  indicateurs: PracticeIndicator[];
  problemes: string[];
}

export type Likelihood = 'low' | 'moderate' | 'high';
export type ReviewPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'ROUTINE';
export type ReviewVerdict = 'accepte' | 'modifie' | 'rejete';

export interface SecondOpinionOutput {
  summary: string;
  differentials: { hypothesis: string; supportingEvidence: string[]; againstEvidence: string[]; likelihood: Likelihood }[];
  redFlags: string[];
  suggestedWorkup: string[];
  dataGaps: string[];
  confidence: Likelihood;
}

export interface SecondOpinionCase {
  id: string;
  version_key: string;
  centre_name: string;
  /** Absents des résultats réels (pas d'accès à la table patients ; motif non transmis par A3). */
  age: number | null;
  sexe: string | null;
  motif: string | null;
  recu_le: string;
  review_priority: ReviewPriority;
  model: string;
  output: SecondOpinionOutput;
  review: { verdict: ReviewVerdict; comment: string; by: string; at: string } | null;
  // Résultats réels (ui_second_avis) seulement
  consultation_id?: number;
  region?: string | null;
  province?: string | null;
  jour?: string | null;
  run_id?: string | null;
  prompt_version?: string | null;
}

export interface SecondOpinionBilan {
  consultations: number;
  par_statut: Record<string, number>;
  par_priorite: Record<string, number>;
  valides: number;
  lancements: number;
  dernier: string | null;
  modeles: string[];
}

export interface AckResult {
  ok: boolean;
  id: number;
  status: string;
}
export interface EnqueteResult {
  ok: boolean;
  id: number;
  statut: string;
}

/** Script 28 : unité active et son lieu (filtres de la carte jour × heure). */
export interface LieuUnite {
  centre_id: number;
  centre_name: string | null;
  commune: string | null;
  province: string | null;
  region: string | null;
}

/** Script 29 : tests de causalité d'un facteur. Pourcentages déjà arrondis ; null quand le test ne s'applique pas. */
export interface Causalite {
  facteur: string;
  libelle: string;
  famille: string;
  portee: 'national' | 'unite';
  source: string;
  remarque: string | null;
  n_jours: number;
  effet_pct: number | null;
  ic_bas: number | null;
  ic_haut: number | null;
  effet_ajuste_pct: number | null;
  placebo_pct: number | null;
  veille_pct: number | null;
  dose: { quartile: number; intensite_moyenne: number; effet_pct: number }[] | null;
  coherence_pct: number | null;
  provinces: number | null;
  verdict: 'cause probable' | 'association' | 'effet faible' | "pas d'effet démontré" | 'artefact de saisie' | 'trop peu de jours';
  explication: string;
  calcule_le: string;
}

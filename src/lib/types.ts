export type CentreCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'N' | 'X';

export type UserRole = 'direction' | 'coordinateur' | 'medecin_referent' | 'demo';

export interface UserSession {
  role: UserRole;
  name: string;
  region?: string;
}

export interface DashboardKPIs {
  day: string;
  centres_actifs: number;
  centres_total: number;
  pec_total: number;
  pec_median_centre: number;
  events_open: number;
  events_urgent: number;
  attention: number;
  last_night: {
    ok: boolean;
    run_id: string;
    ended_at: string;
  };
}

export interface CentreMapItem {
  centre_id: number;
  centre_name: string;
  province: string;
  region: string;
  latitude: number;
  longitude: number;
  category: CentreCategory;
  mean_value: number;
  attention: boolean;
  attention_reason: string | null;
  open_events: number;
}

export interface CentreCategoryItem {
  period_end: string;
  centre_id: number;
  centre_name: string;
  province: string;
  region: string;
  category: CentreCategory;
  mean_patients: number;
  ci_low: number;
  ci_high: number;
  pct_days_over_target: number;
  mean_prev: number;
  adj_change_pct: number;
  trend_z: number;
  days_open: number;
  days_zero: number;
  attention: boolean;
  attention_reason: string | null;
}

export interface DaySeriesItem {
  day: string;
  value: number;
  expected: number;
  signal: string | null;
}

export interface CentreDetailData {
  centre: {
    centre_id: number;
    centre_name: string;
    province: string;
    region: string;
    category: CentreCategory;
    mean_value: number;
    ci_low: number;
    ci_high: number;
    target: number;
    days_zero: number;
  };
  measure: string;
  series: DaySeriesItem[];
  category_history: {
    period_end: string;
    category: CentreCategory;
    mean_value: number;
  }[];
  events: EventItem[];
}

export interface ContextDayItem {
  day: string;
  t_min_c: number;
  t_max_c: number;
  precip_mm: number;
  snow_cm: number;
  gust_max_kmh: number;
  heavy_rain: boolean;
  snow: boolean;
  strong_wind: boolean;
  extreme_heat: boolean;
  cold: boolean;
  adverse_weather: boolean;
  souk_today: string | null;
  calendar: string | null;
}

export interface EventItem {
  id: number;
  signal_type: 'DAY_ANOMALY' | 'SILENT_CENTRE' | 'NETWORK_SILENCE' | string;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'explained' | 'acknowledged' | 'resolved';
  centre_id: number;
  centre_name: string;
  province?: string;
  region?: string;
  first_seen: string;
  last_seen: string;
  occurrences: number;
  last_value: number;
  last_expected: number;
  message: string;
  explanation?: string | null;
  ack_by?: string | null;
  ack_at?: string | null;
}

export interface LiveCentreItem {
  centre_id: number;
  centre_name: string;
  province: string;
  as_of: string;
  admissions: number;
  waiting: number;
  consultations_started: number;
  consultations_done: number;
  calls_ended: number;
  calls_missed: number;
  teleexpertises: number;
  wait_median_min: number;
  wait_max_current_min: number;
  status: 'actif' | 'silencieux' | 'ferme';
}

export interface StatItem {
  centre_id?: number;
  centre_name?: string;
  doctor_id?: number;
  doctor_name?: string;
  sex?: string;
  age_band?: string;
  n: number;
  mean: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  funnel: 'au_dessus' | 'dans_la_norme' | 'en_dessous' | null;
}

export interface SecondOpinionItem {
  versionKey: string;
  consultationId: number;
  centre_id: number;
  centre_name: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'ROUTINE';
  age: number;
  gender: string;
  summary: string;
  redFlags: string[];
  signals: string[];
  confidence: number;
  status_review: 'pending' | 'accepte' | 'modifie' | 'rejete';
  opinion: string;
  reasoningModel: string;
  ts: string;
}

export interface HealthData {
  last_night: {
    run_id: string;
    workflow: string;
    ok: boolean;
    started_at: string;
    ended_at: string;
    duration_sec: number;
    centres_processed: number;
    days_recomputed: number;
    signals_detected: number;
    events_new: number;
    events_updated: number;
    status: string;
  };
  ingestion_lag_min: number;
  pages_in_error: number;
  last_deliveries: {
    channel: string;
    recipient: string;
    sent_at: string;
    ok: boolean;
    events_count: number;
  }[];
  context_sync?: {
    weather_last_sync: string;
    weather_status: string;
    souks_verified_count: number;
  };
}

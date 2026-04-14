import type { HealthDomainId } from '../constants/health-domains.js';
import type { HealthSignalId } from '../constants/health-signals.js';
import type { RiskBand, GovernanceBand } from './vin.js';

export type { RiskBand, GovernanceBand };
export type SignalState = 'final' | 'preliminary' | 'registered' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';

// ---- Subjects (replaces VIN) ----

export interface Subject {
  id: string;
  org_id: string;
  external_id: string;
  display_name: string;              // PHI — will be encrypted at rest in prod
  date_of_birth: string | null;      // PHI
  sex: 'M' | 'F' | 'other';
  fitness_level: 'low' | 'medium' | 'high';
  active_domains: HealthDomainId[];
  enrolled_at: string;

  // Current posterior state (latest snapshot)
  posterior_p: number;      // risk / concern probability (0-1)
  posterior_p_var: number;  // variance of P estimate (0=precise, 0.25=max uncertainty)
  posterior_c: number;      // evidence coverage / confidence (0-1)
  posterior_s: number;      // staleness (0=fresh, 1=stale)
  risk_band: RiskBand;
  governance_band: GovernanceBand;
  governance_reason: string;
  primary_domain: HealthDomainId;
  last_signal_at: string;
  created_at: string;
  updated_at: string;
}

// ---- Health Signals (replaces PillarEvent) ----

export interface HealthSignalEvent {
  id: string;
  subject_id: string;
  org_id: string;
  signal_name: HealthSignalId;
  signal_state: SignalState;
  confidence: number;
  source_type: string;           // 'oura', 'whoop', 'apple_watch', 'lab', 'self_report', 'practitioner', 'nutrition_app'
  raw_value: number | null;
  unit: string;
  normalized_value: number;      // 0-1, for cross-signal comparison
  occurred_at: string;
  metadata: Record<string, unknown>;
}

// ---- Posterior Snapshots (same concept, health context) ----

export interface HealthSnapshot {
  id: string;
  subject_id: string;
  org_id: string;
  domain: HealthDomainId;
  p_score: number;
  p_var: number;
  c_score: number;
  s_score: number;
  risk_band: RiskBand;
  governance_band: GovernanceBand;
  governance_reason: string;
  signal_vector: Record<string, SignalState>;
  frame_index: number;
  computed_at: string;
}

// ---- Practitioners (replaces Dealer) ----

export interface Practitioner {
  id: string;
  org_id: string;
  name: string;
  specialty: string;
  metro_area: string;
  certifications: string[];
  latitude: number;
  longitude: number;
}

export interface SessionSlot {
  id: string;
  practitioner_id: string;
  date: string;
  time_block: 'morning' | 'afternoon' | 'evening';
  capacity: number;
  booked: number;
  score?: number;
}

export interface SessionBooking {
  id: string;
  subject_id: string;
  practitioner_id: string;
  slot_id: string;
  org_id: string;
  status: 'draft' | 'held' | 'confirmed' | 'completed';
  reason: string;
  contact: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ---- Governance (same model) ----

export interface HealthGovernanceAction {
  id: string;
  subject_id: string;
  org_id: string;
  action_type: string;
  reason: string;
  triggered_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---- Audit Log (HIPAA foundation) ----

export interface AuditEntry {
  id: string;
  org_id: string;
  actor_id: string;          // user or system identity performing the action
  actor_type: 'user' | 'system' | 'api_key';
  action: 'read' | 'create' | 'update' | 'delete' | 'export';
  resource_type: string;     // 'subject', 'signal', 'snapshot', 'booking', etc.
  resource_id: string;
  phi_accessed: boolean;     // did this access touch PHI fields?
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---- Precision label (derived from p_var for coach-facing display) ----

export type PrecisionLabel = 'high_confidence' | 'moderate_confidence' | 'limited_data';

/**
 * Converts p_var to a human-readable label for coach display.
 * "82% concern (high confidence)" vs "82% concern (limited data)"
 *
 * p_var is bounded [0, 0.25] (variance of a Bernoulli maxes at p=0.5 → 0.25).
 * Low variance = many consistent signals = high confidence.
 */
export function getPrecisionLabel(pVar: number): PrecisionLabel {
  if (pVar <= 0.06) return 'high_confidence';
  if (pVar <= 0.14) return 'moderate_confidence';
  return 'limited_data';
}

export function formatPrecisionLabel(label: PrecisionLabel): string {
  switch (label) {
    case 'high_confidence': return 'high confidence';
    case 'moderate_confidence': return 'moderate confidence';
    case 'limited_data': return 'limited data';
  }
}

// ---- Sort Context (same as vehicle, health-contextualized) ----

export interface HealthSortContext {
  schema_version: string;
  as_of: string;
  vas: number;   // value-at-stake — how much is at risk
  esc: number;   // escalation urgency
  tsi: number;   // time-sensitivity index
  stale: boolean;
}

// ---- API shapes ----

export interface SubjectListQuery {
  domain?: HealthDomainId;
  band?: RiskBand;
  governance_band?: GovernanceBand;
  page?: number;
  limit?: number;
}

export interface SubjectListResponse {
  subjects: (Subject & { sort_context?: HealthSortContext })[];
  total: number;
  page: number;
  limit: number;
}

export interface SubjectDetailResponse {
  subject: Subject;
  signals: HealthSignalEvent[];
  timeline: HealthSnapshot[];
  governance: HealthGovernanceAction[];
  service_suggestion: {
    recommended: boolean;
    urgency: 'immediate' | 'soon' | 'routine' | 'none';
    reason: string;
  } | null;
  sort_context: HealthSortContext | null;
}

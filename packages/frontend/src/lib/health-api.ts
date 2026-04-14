const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

export interface ApiEnvelope<T> {
  data: T;
  meta: { org_id: string; page?: number; limit?: number; total?: number };
}

export interface SubjectRow {
  id: string;
  org_id: string;
  external_id: string;
  display_name: string;
  sex: string;
  fitness_level: string;
  active_domains: string[];
  posterior_p: number;
  posterior_p_var: number;
  posterior_c: number;
  posterior_s: number;
  risk_band: string;
  governance_band: string;
  governance_reason: string;
  primary_domain: string;
  precision_label: string;
  precision_display: string;
  sport: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_phase: string | null;
  calorie_target: number | null;
  coach_notes: string | null;
  races: Array<{ name: string; type: string; location: string; date: string; finish_time?: string; is_pr?: boolean }>;
  last_signal_at: string;
  enrolled_at: string;
  sort_context: {
    vas: number;
    esc: number;
    tsi: number;
    stale: boolean;
  };
}

export interface SubjectDetail {
  subject: SubjectRow;
  current_snapshot: {
    p_score: number;
    p_var: number;
    c_score: number;
    s_score: number;
    governance_band: string;
    governance_reason: string;
    signal_vector: Record<string, string>;
    domain: string;
  } | null;
  protocols: Array<{
    id: string;
    protocol_id: string;
    started_at: string;
    ended_at: string | null;
    status: string;
    dosing_notes: string;
  }>;
  data_sources: Array<{
    id: string;
    source_id: string;
    connected_at: string;
    last_sync_at: string | null;
    status: string;
  }>;
  governance_actions: Array<{
    id: string;
    action_type: string;
    reason: string;
    triggered_by: string;
    created_at: string;
  }>;
  practitioner: { id: string; name: string; specialty: string } | null;
  service_suggestion: {
    recommended: boolean;
    urgency: string;
    reason: string;
  };
}

export interface SignalEvent {
  id: string;
  signal_name: string;
  signal_state: string;
  raw_value: number | null;
  normalized_value: number;
  source_type: string;
  occurred_at: string;
  signal_meta: {
    label: string;
    unit: string;
    normal_range: [number, number];
    domains: string[];
  } | null;
}

export interface Snapshot {
  id: string;
  domain: string;
  p_score: number;
  p_var: number;
  c_score: number;
  s_score: number;
  governance_band: string;
  governance_reason: string;
  precision_label: string;
  precision_display: string;
  signal_vector: Record<string, string>;
  frame_index: number;
  computed_at: string;
}

export interface OrgStats {
  total_subjects: number;
  governance_bands: Record<string, number>;
  domains: Record<string, number>;
  active_protocols: Array<{ protocol_id: string; label: string; count: number }>;
  coverage: { active_last_7d: number; total: number; pct: number };
}

export interface Protocol {
  id: string;
  label: string;
  category: string;
  description: string;
  target_domains: string[];
  monitored_signals: Array<{ id: string; label: string; unit: string }>;
  dosing_cadence: string;
  onset_weeks: number;
  peak_weeks: number;
}

export interface Intelligence {
  coach_summary: {
    headline: string;
    constraint: string;
    body: string;
    action: string;
    urgency: 'high' | 'medium' | 'low';
    domain: string;
  };
  clinical: {
    primary_finding: {
      name: string;
      domain: string;
      domain_label: string;
      p_score: number;
      c_score: number;
      s_score: number;
      p_var: number;
      governance_band: string;
      governance_reason: string;
    };
    evidence_chain: Array<{
      type: 'blood' | 'wearable' | 'self_report';
      signal_id: string;
      label: string;
      value: number | null;
      unit: string;
      ref_range: string;
      date: string | null;
      trend: 'up' | 'down' | 'flat' | 'insufficient';
      delta_text: string | null;
    }>;
    performance_systems: Record<string, { score: number; label: string; signal_count: number }>;
    lab_markers: Array<{
      signal_id: string;
      label: string;
      unit: string;
      current_value: number | null;
      previous_value: number | null;
      delta_pct: number | null;
      normal_range: [number, number];
      range_badge: 'below' | 'normal' | 'above' | 'performance' | 'no_data';
      last_draw: string | null;
      source: string;
      trend_direction: 'up' | 'down' | 'flat' | 'insufficient';
    }>;
    protocol_tracking: Array<{
      protocol_id: string;
      label: string;
      status: string;
      started_at: string;
      monitored_signal: string;
      monitored_signal_label: string;
      trend: 'improving' | 'worsening' | 'stable' | 'insufficient';
      trend_values: number[];
      narrative: string;
    }>;
    actions: string[];
  };
}

export const healthApi = {
  subjects: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<ApiEnvelope<SubjectRow[]>>(`/api/v1/subjects${qs}`);
  },
  subject: (id: string) =>
    get<ApiEnvelope<SubjectDetail>>(`/api/v1/subjects/${id}`),
  signals: (id: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<ApiEnvelope<SignalEvent[]>>(`/api/v1/subjects/${id}/signals${qs}`);
  },
  snapshots: (id: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<ApiEnvelope<Snapshot[]>>(`/api/v1/subjects/${id}/snapshots${qs}`);
  },
  orgStats: () => get<ApiEnvelope<OrgStats>>('/api/v1/org/stats'),
  protocols: () => get<ApiEnvelope<Protocol[]>>('/api/v1/protocols'),
  practitioners: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<ApiEnvelope<any[]>>(`/api/v1/practitioners${qs}`);
  },
  dataSources: () => get<ApiEnvelope<any[]>>('/api/v1/data-sources'),
  intelligence: (id: string) =>
    get<ApiEnvelope<Intelligence>>(`/api/v1/subjects/${id}/intelligence`),
};

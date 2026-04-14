import type { HealthDomainId } from '@gravity/shared';

export interface HealthStoryline {
  id: number;
  name: string;
  description: string;
  primaryDomain: HealthDomainId;
  /** Risk probability curve over t=[0,1] representing 90-day arc. */
  pCurve: (t: number) => number;
  /** Confidence/coverage curve. */
  cCurve: (t: number) => number;
  /** Staleness curve (higher = more stale). */
  sCurve: (t: number) => number;
  /** Which signals are most active in this storyline. */
  activeSignals: string[];
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export const HEALTH_STORYLINES: HealthStoryline[] = [
  {
    id: 1,
    name: 'Overtraining Spiral',
    description: 'Strain stays high while HRV drops and sleep degrades. Recovery score tanks. Classic overtraining.',
    primaryDomain: 'cardiovascular',
    pCurve: (t) => clamp(0.2 + t * 0.65),
    cCurve: (t) => clamp(0.4 + t * 0.45),
    sCurve: (t) => clamp(0.15 + t * 0.25),
    activeSignals: ['hrv_rmssd', 'strain_score', 'recovery_score', 'sleep_quality', 'resting_hr'],
  },
  {
    id: 2,
    name: 'Metabolic Improvement',
    description: 'A1C trending down, activity up, weight stabilizing. Client is responding to protocol.',
    primaryDomain: 'metabolic',
    pCurve: (t) => clamp(0.7 - t * 0.55),
    cCurve: (t) => clamp(0.35 + t * 0.5),
    sCurve: (t) => clamp(0.3 - t * 0.15),
    activeSignals: ['lab_a1c', 'active_calories', 'steps', 'nutrition_calories', 'nutrition_protein'],
  },
  {
    id: 3,
    name: 'Hormonal Response Tracking',
    description: 'Testosterone and vitamin D responding to supplementation. Cortisol normalizing. Labs arrive every 4-8 weeks.',
    primaryDomain: 'hormonal',
    pCurve: (t) => clamp(0.6 - t * 0.4),
    cCurve: (t) => t < 0.3 ? clamp(0.25) : t < 0.6 ? clamp(0.5) : clamp(0.75),
    sCurve: (t) => t < 0.3 ? clamp(0.5) : t < 0.6 ? clamp(0.35) : clamp(0.2),
    activeSignals: ['lab_testosterone', 'lab_vitamin_d', 'lab_cortisol', 'self_energy', 'sleep_quality'],
  },
  {
    id: 4,
    name: 'Sleep Disruption Pattern',
    description: 'Sleep quality declining, resting HR rising, HRV dropping. Stress or environmental factor.',
    primaryDomain: 'sleep_recovery',
    pCurve: (t) => clamp(0.15 + t * 0.6),
    cCurve: (t) => clamp(0.5 + t * 0.35),
    sCurve: (t) => clamp(0.1 + t * 0.2),
    activeSignals: ['sleep_duration', 'sleep_quality', 'resting_hr', 'hrv_rmssd', 'recovery_score', 'self_energy'],
  },
  {
    id: 5,
    name: 'Post-Injury Recovery',
    description: 'Activity drops sharply, gradual return over weeks. Pain decreasing, strain rebuilding.',
    primaryDomain: 'musculoskeletal',
    pCurve: (t) => t < 0.2 ? clamp(0.85) : clamp(0.85 - (t - 0.2) * 0.75),
    cCurve: (t) => clamp(0.3 + t * 0.5),
    sCurve: (t) => clamp(0.4 - t * 0.25),
    activeSignals: ['self_pain', 'strain_score', 'recovery_score', 'active_calories', 'steps', 'lab_crp'],
  },
  {
    id: 6,
    name: 'Stress-Driven Decline',
    description: 'HRV crashes, sleep fragmented, cortisol spikes. Cognitive and cardiovascular signals degrade together.',
    primaryDomain: 'cognitive',
    pCurve: (t) => clamp(0.25 + t * 0.55),
    cCurve: (t) => clamp(0.45 + t * 0.3),
    sCurve: (t) => clamp(0.2 + t * 0.3),
    activeSignals: ['hrv_rmssd', 'lab_cortisol', 'sleep_quality', 'sleep_duration', 'self_energy'],
  },
  {
    id: 7,
    name: 'New Client Baseline',
    description: 'Just enrolled. Limited data. Building picture over first 30 days. Low risk because we don\'t know enough.',
    primaryDomain: 'sleep_recovery',
    pCurve: (t) => clamp(0.05 + t * 0.12),
    cCurve: (t) => clamp(0.1 + t * 0.35),
    sCurve: (t) => clamp(0.1 + t * 0.05),
    activeSignals: ['resting_hr', 'sleep_duration', 'steps'],
  },
  {
    id: 8,
    name: 'Plateau — Needs Protocol Change',
    description: 'All metrics flat for 3+ weeks. No degradation but no improvement. Signal to coach: change something.',
    primaryDomain: 'metabolic',
    pCurve: (t) => clamp(0.45 + Math.sin(t * Math.PI * 3) * 0.06),
    cCurve: (t) => clamp(0.65 + Math.sin(t * Math.PI * 2) * 0.05),
    sCurve: (t) => clamp(0.3),
    activeSignals: ['lab_a1c', 'active_calories', 'nutrition_calories', 'steps', 'hrv_rmssd'],
  },
  {
    id: 9,
    name: 'Strong Responder',
    description: 'Rapid improvement across domains. HRV up, sleep quality up, labs improving. Protocol is working.',
    primaryDomain: 'cardiovascular',
    pCurve: (t) => clamp(0.65 - t * 0.55),
    cCurve: (t) => clamp(0.4 + t * 0.5),
    sCurve: (t) => clamp(0.25 - t * 0.15),
    activeSignals: ['hrv_rmssd', 'sleep_quality', 'recovery_score', 'resting_hr', 'lab_crp', 'self_energy'],
  },
  {
    id: 10,
    name: 'Data Gap — Device Dropout',
    description: 'Client stopped wearing device or missed lab appointments. Signals go absent. Confidence drops. Governance suppresses.',
    primaryDomain: 'sleep_recovery',
    pCurve: (t) => t < 0.4 ? clamp(0.5) : clamp(0.5 + (t - 0.4) * 0.15),
    cCurve: (t) => t < 0.4 ? clamp(0.7) : clamp(0.7 - (t - 0.4) * 0.8),
    sCurve: (t) => t < 0.4 ? clamp(0.2) : clamp(0.2 + (t - 0.4) * 0.7),
    activeSignals: ['sleep_duration', 'resting_hr', 'hrv_rmssd'],
  },
];

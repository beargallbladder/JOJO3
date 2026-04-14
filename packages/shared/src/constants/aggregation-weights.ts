import type { HealthDomainId } from './health-domains.js';
import type { HealthSignalId } from './health-signals.js';

/**
 * Explicit weights for computing the concern score (P) per domain.
 * P = Σ(weight_i × deviation_i) / Σ(weight_i) where deviation is normalized
 * distance from normal range (0 = within range, 1 = at physiological extreme).
 *
 * Weights within each domain MUST sum to 1.0.
 * Validated at module load via assertion below.
 */
export const DOMAIN_SIGNAL_WEIGHTS: Record<HealthDomainId, Partial<Record<HealthSignalId, number>>> = {
  cardiovascular: {
    resting_hr: 0.10,
    hrv_rmssd: 0.14,
    strain_score: 0.06,
    active_calories: 0.04,
    steps: 0.04,
    resting_bp_systolic: 0.06,
    resting_bp_diastolic: 0.05,
    respiratory_rate: 0.04,
    spo2: 0.05,
    vo2_max: 0.06,
    lab_hemoglobin: 0.10,
    lab_hematocrit: 0.06,
    lab_ferritin: 0.06,
    lab_iron: 0.04,
    lab_transferrin_sat: 0.04,
    lab_apob: 0.04,
    lab_omega3_index: 0.02,
  },
  metabolic: {
    lab_a1c: 0.14,
    active_calories: 0.06,
    steps: 0.04,
    nutrition_calories: 0.08,
    nutrition_protein: 0.06,
    lab_crp: 0.10,
    lab_thyroid_tsh: 0.08,
    lab_fasting_glucose: 0.14,
    body_weight: 0.06,
    vo2_max: 0.06,
    lab_apob: 0.10,
    lab_omega3_index: 0.08,
  },
  hormonal: {
    lab_testosterone: 0.35,
    lab_vitamin_d: 0.20,
    lab_cortisol: 0.25,
    lab_thyroid_tsh: 0.20,
  },
  musculoskeletal: {
    strain_score: 0.10,
    recovery_score: 0.15,
    self_pain: 0.15,
    lab_crp: 0.12,
    lab_testosterone: 0.08,
    lab_vitamin_d: 0.08,
    nutrition_protein: 0.10,
    lab_creatine_kinase: 0.12,
    lab_ferritin: 0.10,
  },
  sleep_recovery: {
    sleep_duration: 0.18,
    sleep_quality: 0.18,
    recovery_score: 0.16,
    resting_hr: 0.10,
    hrv_rmssd: 0.14,
    self_energy: 0.10,
    respiratory_rate: 0.08,
    spo2: 0.06,
  },
  cognitive: {
    hrv_rmssd: 0.30,
    sleep_duration: 0.25,
    self_energy: 0.20,
    lab_cortisol: 0.25,
  },
};

/**
 * Governance thresholds for determining ESCALATED / MONITOR / SUPPRESSED bands.
 * These are calibrated design decisions, not published clinical cutoffs.
 */
export const GOVERNANCE_THRESHOLDS = {
  ESCALATED: {
    p: 0.85,     // top ~15% of concern distribution in synthetic cohort calibration
    c: 0.70,     // at least 70% of expected signals present for this domain
    s_days: 14,  // most recent signal within 2 weeks — data is actionable
  },
  MONITOR: {
    p: 0.60,     // top ~40% of concern distribution
    c: 0.60,     // at least 60% of expected signals present
  },
  STALENESS_CEILING: 60, // days — beyond this, suppress regardless of P/C
  COVERAGE_FLOOR: 0.50,  // below this, suppress regardless of P
} as const;

/**
 * Per-domain minimum signal count for ESCALATED eligibility.
 *
 * The flat C ≥ 0.70 threshold creates a structural problem for large domains:
 * Cardiovascular has 17 expected signals, requiring 12 present. But a single
 * wearable (Oura, WHOOP) provides 6–9 cardiovascular signals max. An athlete
 * on one device can never reach ESCALATED regardless of how alarming their data is.
 *
 * Solution: use absolute minimum counts per domain rather than a percentage.
 * If a subject has ≥ MIN_SIGNALS_FOR_ESCALATION[domain] present signals AND
 * P ≥ 0.85 AND freshness ≤ 14 days, they can escalate.
 */
export const MIN_SIGNALS_FOR_ESCALATION: Record<HealthDomainId, number> = {
  cardiovascular: 6,    // achievable with 1 wearable + 1 lab panel
  metabolic: 5,         // achievable with nutrition app + 1 lab panel
  hormonal: 3,          // 3 of 4 hormone labs
  musculoskeletal: 5,   // achievable with wearable + self-report + 1 lab
  sleep_recovery: 4,    // achievable with any single wearable
  cognitive: 3,         // achievable with wearable + self-report
};

// Runtime assertion: weights must sum to 1.0 per domain (±0.001 for float rounding)
for (const [domain, weights] of Object.entries(DOMAIN_SIGNAL_WEIGHTS)) {
  const sum = Object.values(weights).reduce<number>((a, b) => a + (b ?? 0), 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(
      `DOMAIN_SIGNAL_WEIGHTS[${domain}] sums to ${sum.toFixed(4)}, expected 1.0`
    );
  }
}

import type { HealthDomainId } from './health-domains.js';

export interface SignalDef {
  label: string;
  letter: string;
  source: string;
  unit: string;
  /** Typical healthy range [min, max]. Used by synthetic generator and UI. */
  normalRange: [number, number];
  /** Wider physiological range [min, max]. */
  fullRange: [number, number];
  /** Which health domains this signal is relevant to. */
  domains: HealthDomainId[];
}

export const HEALTH_SIGNALS: Record<string, SignalDef> = {
  resting_hr: {
    label: 'Resting Heart Rate', letter: 'A', source: 'Wearable',
    unit: 'bpm', normalRange: [50, 70], fullRange: [38, 100],
    domains: ['cardiovascular', 'sleep_recovery'],
  },
  hrv_rmssd: {
    label: 'HRV (RMSSD)', letter: 'B', source: 'Wearable',
    unit: 'ms', normalRange: [40, 100], fullRange: [10, 150],
    domains: ['cardiovascular', 'sleep_recovery', 'cognitive'],
  },
  sleep_duration: {
    label: 'Sleep Duration', letter: 'C', source: 'Wearable',
    unit: 'min', normalRange: [420, 540], fullRange: [180, 660],
    domains: ['sleep_recovery', 'cognitive'],
  },
  sleep_quality: {
    label: 'Sleep Quality Score', letter: 'D', source: 'Wearable',
    unit: 'score', normalRange: [70, 95], fullRange: [10, 100],
    domains: ['sleep_recovery'],
  },
  recovery_score: {
    label: 'Recovery Score', letter: 'E', source: 'Wearable (Whoop/Oura)',
    unit: 'score', normalRange: [60, 95], fullRange: [5, 100],
    domains: ['sleep_recovery', 'musculoskeletal'],
  },
  strain_score: {
    label: 'Daily Strain', letter: 'F', source: 'Wearable (Whoop)',
    unit: 'score', normalRange: [8, 16], fullRange: [0, 21],
    domains: ['cardiovascular', 'musculoskeletal'],
  },
  active_calories: {
    label: 'Active Calories', letter: 'G', source: 'Wearable',
    unit: 'kcal', normalRange: [300, 800], fullRange: [0, 2000],
    domains: ['metabolic', 'cardiovascular'],
  },
  steps: {
    label: 'Daily Steps', letter: 'H', source: 'Wearable',
    unit: 'steps', normalRange: [7000, 12000], fullRange: [500, 30000],
    domains: ['metabolic', 'cardiovascular'],
  },

  // Lab / biomarker signals — arrive less frequently (every 2-12 weeks)
  lab_a1c: {
    label: 'HbA1c', letter: 'I', source: 'Lab',
    unit: '%', normalRange: [4.2, 5.6], fullRange: [3.5, 10.0],
    domains: ['metabolic'],
  },
  lab_testosterone: {
    label: 'Testosterone', letter: 'J', source: 'Lab',
    unit: 'ng/dL', normalRange: [400, 900], fullRange: [100, 1500],
    domains: ['hormonal', 'musculoskeletal'],
  },
  lab_crp: {
    label: 'C-Reactive Protein', letter: 'K', source: 'Lab',
    unit: 'mg/L', normalRange: [0.1, 1.0], fullRange: [0.05, 15],
    domains: ['metabolic', 'musculoskeletal'],
  },
  lab_vitamin_d: {
    label: 'Vitamin D (25-OH)', letter: 'L', source: 'Lab',
    unit: 'ng/mL', normalRange: [30, 60], fullRange: [5, 100],
    domains: ['hormonal', 'musculoskeletal'],
  },
  lab_cortisol: {
    label: 'Cortisol (AM)', letter: 'M', source: 'Lab',
    unit: 'mcg/dL', normalRange: [6, 18], fullRange: [1, 35],
    domains: ['hormonal', 'cognitive'],
  },
  lab_thyroid_tsh: {
    label: 'TSH', letter: 'N', source: 'Lab',
    unit: 'mIU/L', normalRange: [0.5, 4.0], fullRange: [0.01, 20],
    domains: ['hormonal', 'metabolic'],
  },

  // Lab / biomarker signals — CBC & Iron Panel (oxygen transport)
  lab_hemoglobin: {
    label: 'Hemoglobin', letter: 'T', source: 'Lab',
    unit: 'g/dL', normalRange: [12.0, 17.5], fullRange: [7, 20],
    domains: ['cardiovascular'],
  },
  lab_hematocrit: {
    label: 'Hematocrit', letter: 'U', source: 'Lab',
    unit: '%', normalRange: [36, 50], fullRange: [20, 60],
    domains: ['cardiovascular'],
  },
  lab_ferritin: {
    label: 'Ferritin', letter: 'V', source: 'Lab',
    unit: 'ng/mL', normalRange: [20, 200], fullRange: [5, 500],
    domains: ['cardiovascular', 'musculoskeletal'],
  },
  lab_iron: {
    label: 'Iron (Serum)', letter: 'W', source: 'Lab',
    unit: 'mcg/dL', normalRange: [60, 170], fullRange: [10, 300],
    domains: ['cardiovascular'],
  },
  lab_transferrin_sat: {
    label: 'Transferrin Saturation', letter: 'X', source: 'Lab',
    unit: '%', normalRange: [20, 50], fullRange: [5, 80],
    domains: ['cardiovascular'],
  },

  // Lab / biomarker signals — Muscle & Metabolic
  lab_creatine_kinase: {
    label: 'Creatine Kinase', letter: 'Y', source: 'Lab',
    unit: 'U/L', normalRange: [30, 200], fullRange: [10, 2000],
    domains: ['musculoskeletal'],
  },
  lab_fasting_glucose: {
    label: 'Fasting Glucose', letter: 'Z', source: 'Lab',
    unit: 'mg/dL', normalRange: [70, 99], fullRange: [40, 200],
    domains: ['metabolic'],
  },

  // Self-report / practitioner signals
  self_energy: {
    label: 'Self-Reported Energy', letter: 'O', source: 'Self-Report',
    unit: 'score', normalRange: [6, 9], fullRange: [1, 10],
    domains: ['cognitive', 'sleep_recovery'],
  },
  self_pain: {
    label: 'Self-Reported Pain', letter: 'P', source: 'Self-Report',
    unit: 'score', normalRange: [0, 2], fullRange: [0, 10],
    domains: ['musculoskeletal'],
  },
  practitioner_note: {
    label: 'Practitioner Observation', letter: 'Q', source: 'Practitioner',
    unit: 'text', normalRange: [0, 1], fullRange: [0, 1],
    domains: ['cardiovascular', 'metabolic', 'hormonal', 'musculoskeletal', 'sleep_recovery', 'cognitive'],
  },
  nutrition_calories: {
    label: 'Daily Calorie Intake', letter: 'R', source: 'Nutrition App',
    unit: 'kcal', normalRange: [1800, 2800], fullRange: [800, 5000],
    domains: ['metabolic'],
  },
  nutrition_protein: {
    label: 'Daily Protein', letter: 'S', source: 'Nutrition App',
    unit: 'g', normalRange: [100, 200], fullRange: [20, 400],
    domains: ['metabolic', 'musculoskeletal'],
  },
} as const;

export type HealthSignalId = keyof typeof HEALTH_SIGNALS;
export const HEALTH_SIGNAL_LIST = Object.keys(HEALTH_SIGNALS) as HealthSignalId[];

/** Signals grouped by data-arrival cadence. Drives synthetic data realism. */
export const SIGNAL_CADENCE: Record<'daily' | 'weekly' | 'periodic_lab' | 'event', HealthSignalId[]> = {
  daily: [
    'resting_hr', 'hrv_rmssd', 'sleep_duration', 'sleep_quality',
    'recovery_score', 'strain_score', 'active_calories', 'steps',
    'nutrition_calories', 'nutrition_protein',
  ],
  weekly: ['self_energy', 'self_pain'],
  periodic_lab: [
    'lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d',
    'lab_cortisol', 'lab_thyroid_tsh',
    'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron',
    'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose',
  ],
  event: ['practitioner_note'],
};

/** Which signals map to each domain (like SUBSYSTEM_PILLARS in the vehicle model). */
export const DOMAIN_SIGNALS: Record<HealthDomainId, HealthSignalId[]> = {
  cardiovascular: ['resting_hr', 'hrv_rmssd', 'strain_score', 'active_calories', 'steps', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat'],
  metabolic: ['lab_a1c', 'active_calories', 'steps', 'nutrition_calories', 'nutrition_protein', 'lab_crp', 'lab_thyroid_tsh', 'lab_fasting_glucose'],
  hormonal: ['lab_testosterone', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh'],
  musculoskeletal: ['strain_score', 'recovery_score', 'self_pain', 'lab_crp', 'lab_testosterone', 'lab_vitamin_d', 'nutrition_protein', 'lab_creatine_kinase', 'lab_ferritin'],
  sleep_recovery: ['sleep_duration', 'sleep_quality', 'recovery_score', 'resting_hr', 'hrv_rmssd', 'self_energy'],
  cognitive: ['hrv_rmssd', 'sleep_duration', 'self_energy', 'lab_cortisol'],
};

export const DOMAIN_N_EXPECTED: Record<HealthDomainId, number> = {
  cardiovascular: 10,
  metabolic: 8,
  hormonal: 4,
  musculoskeletal: 9,
  sleep_recovery: 6,
  cognitive: 4,
};

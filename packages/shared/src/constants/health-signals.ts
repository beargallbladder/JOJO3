import type { HealthDomainId } from './health-domains.js';

export interface SignalDef {
  label: string;
  letter: string;
  source: string;
  unit: string;
  loinc: string | null;
  /** Typical healthy range [min, max]. Used by synthetic generator and UI. */
  normalRange: [number, number] | null;
  /** Sex-specific reference ranges where clinically distinct. */
  normalRangeBySex?: { M: [number, number]; F: [number, number] };
  /** Wider physiological range [min, max]. */
  fullRange: [number, number];
  /** Which health domains this signal is relevant to. */
  domains: HealthDomainId[];
}

export const HEALTH_SIGNALS: Record<string, SignalDef> = {
  // ======== DAILY WEARABLE SIGNALS (8) ========

  resting_hr: {
    label: 'Resting Heart Rate', letter: 'A', source: 'Wearable',
    loinc: '40443-4',
    unit: 'bpm', normalRange: [60, 100], fullRange: [38, 100],
    domains: ['cardiovascular', 'sleep_recovery'],
  },
  hrv_rmssd: {
    label: 'HRV (RMSSD)', letter: 'B', source: 'Wearable',
    loinc: '80404-7',
    unit: 'ms', normalRange: [40, 100], fullRange: [10, 150],
    domains: ['cardiovascular', 'sleep_recovery', 'cognitive'],
  },
  sleep_duration: {
    label: 'Sleep Duration', letter: 'C', source: 'Wearable',
    loinc: '93810-1',
    unit: 'min', normalRange: [420, 540], fullRange: [180, 660],
    domains: ['sleep_recovery', 'cognitive'],
  },
  sleep_quality: {
    label: 'Sleep Quality Score', letter: 'D', source: 'Wearable',
    // Proprietary wearable score — no LOINC mapping. Do not map to 93831-7 (PSQI).
    loinc: null,
    unit: 'score', normalRange: [70, 95], fullRange: [10, 100],
    domains: ['sleep_recovery'],
  },
  recovery_score: {
    label: 'Recovery Score', letter: 'E', source: 'Wearable (Whoop/Oura)',
    loinc: null,
    unit: 'score', normalRange: [60, 95], fullRange: [5, 100],
    domains: ['sleep_recovery', 'musculoskeletal'],
  },
  strain_score: {
    label: 'Daily Strain', letter: 'F', source: 'Wearable (Whoop)',
    loinc: null,
    unit: 'score', normalRange: [8, 16], fullRange: [0, 21],
    domains: ['cardiovascular', 'musculoskeletal'],
  },
  active_calories: {
    label: 'Active Calories', letter: 'G', source: 'Wearable',
    loinc: '41981-2',
    unit: 'kcal', normalRange: [300, 800], fullRange: [0, 2000],
    domains: ['metabolic', 'cardiovascular'],
  },
  steps: {
    label: 'Daily Steps', letter: 'H', source: 'Wearable',
    loinc: '55423-8',
    unit: 'steps', normalRange: [7000, 12000], fullRange: [500, 30000],
    domains: ['metabolic', 'cardiovascular'],
  },

  // ======== NEW WEARABLE / VITALS SIGNALS (5) ========

  resting_bp_systolic: {
    label: 'Systolic Blood Pressure', letter: 'A2', source: 'Wearable',
    loinc: '8480-6',
    unit: 'mmHg', normalRange: [90, 120], fullRange: [60, 200],
    domains: ['cardiovascular'],
  },
  resting_bp_diastolic: {
    label: 'Diastolic Blood Pressure', letter: 'A3', source: 'Wearable',
    loinc: '8462-4',
    unit: 'mmHg', normalRange: [60, 80], fullRange: [40, 130],
    domains: ['cardiovascular'],
  },
  respiratory_rate: {
    label: 'Respiratory Rate', letter: 'A4', source: 'Wearable',
    loinc: '9279-1',
    unit: '/min', normalRange: [12, 20], fullRange: [6, 40],
    domains: ['cardiovascular', 'sleep_recovery'],
  },
  spo2: {
    label: 'SpO2 (Blood Oxygen)', letter: 'A5', source: 'Wearable',
    loinc: '59408-5',
    unit: '%', normalRange: [95, 100], fullRange: [70, 100],
    domains: ['cardiovascular', 'sleep_recovery'],
  },
  vo2_max: {
    label: 'VO2 Max (Estimated)', letter: 'A6', source: 'Wearable',
    // 60842-2 is the correct LOINC for maximal O2 consumption. Wearable estimates
    // use HR-based algorithms, NOT graded exercise testing (gold standard).
    // Value is directional trend data — not clinical-grade measurement.
    loinc: '60842-2',
    unit: 'mL/kg/min', normalRange: [40, 60], fullRange: [15, 90],
    domains: ['cardiovascular', 'metabolic'],
  },

  // ======== BODY COMPOSITION (1) ========

  body_weight: {
    label: 'Body Weight', letter: 'A7', source: 'Wearable',
    loinc: '29463-7',
    unit: 'kg', normalRange: null, fullRange: [30, 250],
    domains: ['metabolic'],
  },

  // ======== LAB / BIOMARKER SIGNALS — CORE PANEL (6) ========

  lab_a1c: {
    label: 'HbA1c', letter: 'I', source: 'Lab',
    loinc: '4548-4',
    unit: '%', normalRange: [4.8, 5.6], fullRange: [3.5, 10.0],
    domains: ['metabolic'],
  },
  lab_testosterone: {
    label: 'Testosterone (Total)', letter: 'J', source: 'Lab',
    loinc: '2986-8',
    unit: 'ng/dL', normalRange: [250, 900], fullRange: [10, 1500],
    normalRangeBySex: { M: [400, 900], F: [15, 70] },
    domains: ['hormonal', 'musculoskeletal'],
  },
  lab_crp: {
    label: 'C-Reactive Protein (hs-CRP)', letter: 'K', source: 'Lab',
    loinc: '1988-5',
    unit: 'mg/L', normalRange: [0.1, 1.0], fullRange: [0.05, 15],
    domains: ['metabolic', 'musculoskeletal'],
  },
  lab_vitamin_d: {
    label: 'Vitamin D, 25-Hydroxy', letter: 'L', source: 'Lab',
    loinc: '14635-7',
    unit: 'ng/mL', normalRange: [30, 60], fullRange: [5, 100],
    domains: ['hormonal', 'musculoskeletal'],
  },
  lab_cortisol: {
    label: 'Cortisol, Morning', letter: 'M', source: 'Lab',
    loinc: '2144-4',
    unit: 'mcg/dL', normalRange: [6, 23], fullRange: [1, 35],
    domains: ['hormonal', 'cognitive'],
  },
  lab_thyroid_tsh: {
    label: 'TSH', letter: 'N', source: 'Lab',
    loinc: '11580-8',
    unit: 'mIU/L', normalRange: [0.5, 4.0], fullRange: [0.01, 20],
    domains: ['hormonal', 'metabolic'],
  },

  // ======== LAB / BIOMARKER — CBC & IRON PANEL (5) ========

  lab_hemoglobin: {
    label: 'Hemoglobin', letter: 'T', source: 'Lab',
    loinc: '718-7',
    unit: 'g/dL', normalRange: [12.0, 17.5], fullRange: [7, 20],
    normalRangeBySex: { M: [13.5, 17.5], F: [12.0, 15.5] },
    domains: ['cardiovascular'],
  },
  lab_hematocrit: {
    label: 'Hematocrit', letter: 'U', source: 'Lab',
    loinc: '4544-3',
    unit: '%', normalRange: [36, 50], fullRange: [20, 60],
    domains: ['cardiovascular'],
  },
  lab_ferritin: {
    label: 'Ferritin', letter: 'V', source: 'Lab',
    loinc: '2276-4',
    unit: 'ng/mL', normalRange: [20, 200], fullRange: [5, 500],
    domains: ['cardiovascular', 'musculoskeletal'],
  },
  lab_iron: {
    label: 'Iron, Serum', letter: 'W', source: 'Lab',
    loinc: '2498-4',
    unit: 'mcg/dL', normalRange: [60, 170], fullRange: [10, 300],
    domains: ['cardiovascular'],
  },
  lab_transferrin_sat: {
    label: 'Transferrin Saturation', letter: 'X', source: 'Lab',
    loinc: '2502-3',
    unit: '%', normalRange: [20, 50], fullRange: [5, 80],
    domains: ['cardiovascular'],
  },

  // ======== LAB / BIOMARKER — MUSCLE & METABOLIC (2) ========

  lab_creatine_kinase: {
    label: 'Creatine Kinase', letter: 'Y', source: 'Lab',
    loinc: '2157-6',
    unit: 'U/L', normalRange: [30, 200], fullRange: [10, 2000],
    domains: ['musculoskeletal'],
  },
  lab_fasting_glucose: {
    label: 'Fasting Glucose', letter: 'Z', source: 'Lab',
    loinc: '1558-6',
    unit: 'mg/dL', normalRange: [70, 99], fullRange: [40, 200],
    domains: ['metabolic'],
  },

  // ======== NEW LAB — LIPID & INFLAMMATION (2) ========

  lab_apob: {
    label: 'Apolipoprotein B', letter: 'Z2', source: 'Lab',
    loinc: '1884-6',
    unit: 'mg/dL', normalRange: [40, 80], fullRange: [20, 200],
    domains: ['cardiovascular', 'metabolic'],
  },
  lab_omega3_index: {
    label: 'Omega-3 Index', letter: 'Z3', source: 'Lab',
    loinc: '53476-7',
    unit: '%', normalRange: [8, 12], fullRange: [2, 20],
    domains: ['cardiovascular', 'metabolic'],
  },

  // ======== SELF-REPORT / PRACTITIONER SIGNALS (3) ========

  self_energy: {
    label: 'Self-Reported Energy', letter: 'O', source: 'Self-Report',
    // Custom VAS (1–10). Not a validated PROMIS instrument.
    loinc: null,
    unit: 'score', normalRange: [6, 9], fullRange: [1, 10],
    domains: ['cognitive', 'sleep_recovery'],
  },
  self_pain: {
    label: 'Self-Reported Pain', letter: 'P', source: 'Self-Report',
    loinc: '72514-3',
    unit: 'score', normalRange: [0, 2], fullRange: [0, 10],
    domains: ['musculoskeletal'],
  },
  practitioner_note: {
    label: 'Practitioner Observation', letter: 'Q', source: 'Practitioner',
    loinc: '11488-4',
    unit: 'text', normalRange: [0, 1], fullRange: [0, 1],
    domains: ['cardiovascular', 'metabolic', 'hormonal', 'musculoskeletal', 'sleep_recovery', 'cognitive'],
  },

  // ======== NUTRITION SIGNALS (2) ========

  nutrition_calories: {
    label: 'Daily Calorie Intake', letter: 'R', source: 'Nutrition App',
    loinc: '9052-2',
    unit: 'kcal', normalRange: [1800, 2800], fullRange: [800, 5000],
    domains: ['metabolic'],
  },
  nutrition_protein: {
    label: 'Daily Protein', letter: 'S', source: 'Nutrition App',
    loinc: '74165-2',
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
    'respiratory_rate', 'spo2', 'body_weight',
    'resting_bp_systolic', 'resting_bp_diastolic', 'vo2_max',
  ],
  weekly: ['self_energy', 'self_pain'],
  periodic_lab: [
    'lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d',
    'lab_cortisol', 'lab_thyroid_tsh',
    'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron',
    'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose',
    'lab_apob', 'lab_omega3_index',
  ],
  event: ['practitioner_note'],
};

/** Which signals map to each domain (like SUBSYSTEM_PILLARS in the vehicle model). */
export const DOMAIN_SIGNALS: Record<HealthDomainId, HealthSignalId[]> = {
  cardiovascular: ['resting_hr', 'hrv_rmssd', 'strain_score', 'active_calories', 'steps', 'resting_bp_systolic', 'resting_bp_diastolic', 'respiratory_rate', 'spo2', 'vo2_max', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat', 'lab_apob', 'lab_omega3_index'],
  metabolic: ['lab_a1c', 'active_calories', 'steps', 'nutrition_calories', 'nutrition_protein', 'lab_crp', 'lab_thyroid_tsh', 'lab_fasting_glucose', 'body_weight', 'vo2_max', 'lab_apob', 'lab_omega3_index'],
  hormonal: ['lab_testosterone', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh'],
  musculoskeletal: ['strain_score', 'recovery_score', 'self_pain', 'lab_crp', 'lab_testosterone', 'lab_vitamin_d', 'nutrition_protein', 'lab_creatine_kinase', 'lab_ferritin'],
  sleep_recovery: ['sleep_duration', 'sleep_quality', 'recovery_score', 'resting_hr', 'hrv_rmssd', 'self_energy', 'respiratory_rate', 'spo2'],
  cognitive: ['hrv_rmssd', 'sleep_duration', 'self_energy', 'lab_cortisol'],
};

export const DOMAIN_N_EXPECTED: Record<HealthDomainId, number> = {
  cardiovascular: 17,
  metabolic: 12,
  hormonal: 4,
  musculoskeletal: 9,
  sleep_recovery: 8,
  cognitive: 4,
};

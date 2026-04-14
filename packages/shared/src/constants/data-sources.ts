/**
 * Every real-world data source the sensor layer needs to ingest.
 * Each source produces specific signals at specific cadences.
 * The synthetic data generator uses these to create realistic multi-platform data.
 * When real integrations ship, the schema doesn't change — only the ingestion adapters.
 */

export type SourceCategory =
  | 'wearable'
  | 'biomarker_lab'
  | 'training_app'
  | 'nutrition_app'
  | 'medical_record'
  | 'self_report'
  | 'practitioner';

export interface DataSourceDef {
  label: string;
  category: SourceCategory;
  description: string;
  /** Signals this source can provide. */
  signals: string[];
  /** How often data typically arrives. */
  cadence: 'continuous' | 'daily' | 'weekly' | 'periodic' | 'event';
  /** Auth mechanism for real integration (future roadmap). */
  authType: 'oauth2' | 'api_key' | 'webhook' | 'manual' | 'fhir';
  /** Whether we have a planned integration path. */
  integrationStatus: 'planned' | 'future' | 'manual_only';
}

export const DATA_SOURCES: Record<string, DataSourceDef> = {

  // ======== WEARABLES ========

  oura: {
    label: 'Oura Ring',
    category: 'wearable',
    description: 'Sleep stages, HRV, readiness score, body temperature, respiratory rate.',
    signals: ['sleep_duration', 'sleep_quality', 'hrv_rmssd', 'resting_hr', 'recovery_score'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  whoop: {
    label: 'WHOOP',
    category: 'wearable',
    description: 'Strain, recovery, sleep performance, HRV, respiratory rate.',
    signals: ['strain_score', 'recovery_score', 'sleep_duration', 'sleep_quality', 'hrv_rmssd', 'resting_hr'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  garmin: {
    label: 'Garmin',
    category: 'wearable',
    description: 'Training load, body battery, sleep, stress, VO2max estimate, HR zones.',
    signals: ['resting_hr', 'hrv_rmssd', 'sleep_duration', 'sleep_quality', 'active_calories', 'steps', 'strain_score'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  apple_watch: {
    label: 'Apple Watch',
    category: 'wearable',
    description: 'Heart rate, activity rings, sleep, workouts, HRV, blood oxygen.',
    signals: ['resting_hr', 'hrv_rmssd', 'active_calories', 'steps', 'sleep_duration'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  fitbit: {
    label: 'Fitbit',
    category: 'wearable',
    description: 'Daily readiness, sleep score, active zone minutes, stress management score.',
    signals: ['resting_hr', 'hrv_rmssd', 'sleep_duration', 'sleep_quality', 'active_calories', 'steps', 'recovery_score'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  samsung_health: {
    label: 'Samsung Health',
    category: 'wearable',
    description: 'Heart rate, sleep, activity, body composition, blood oxygen.',
    signals: ['resting_hr', 'sleep_duration', 'active_calories', 'steps'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'future',
  },
  polar: {
    label: 'Polar',
    category: 'wearable',
    description: 'Training load, recovery status, nightly recharge, sleep plus.',
    signals: ['resting_hr', 'hrv_rmssd', 'strain_score', 'recovery_score', 'sleep_quality'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'future',
  },
  coros: {
    label: 'COROS',
    category: 'wearable',
    description: 'Training load, HRV trend, base fitness, sleep monitoring.',
    signals: ['resting_hr', 'hrv_rmssd', 'strain_score', 'sleep_duration', 'active_calories'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'future',
  },

  // ======== BIOMARKER LABS ========

  function_health: {
    label: 'Function Health',
    category: 'biomarker_lab',
    description: '100+ biomarkers per panel. Longitudinal tracking with quarterly draws.',
    signals: ['lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose'],
    cadence: 'periodic',
    authType: 'api_key',
    integrationStatus: 'planned',
  },
  insidetracker: {
    label: 'InsideTracker',
    category: 'biomarker_lab',
    description: 'Blood biomarkers with personalized optimal zones and action plans.',
    signals: ['lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose'],
    cadence: 'periodic',
    authType: 'api_key',
    integrationStatus: 'planned',
  },
  wild_health: {
    label: 'Wild Health',
    category: 'biomarker_lab',
    description: 'Precision medicine labs including genomics, metabolomics, and standard panels.',
    signals: ['lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose'],
    cadence: 'periodic',
    authType: 'api_key',
    integrationStatus: 'planned',
  },
  quest_diagnostics: {
    label: 'Quest Diagnostics',
    category: 'biomarker_lab',
    description: 'Standard clinical lab panels. Results via patient portal or FHIR.',
    signals: ['lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose'],
    cadence: 'periodic',
    authType: 'fhir',
    integrationStatus: 'future',
  },
  labcorp: {
    label: 'Labcorp',
    category: 'biomarker_lab',
    description: 'Clinical lab results via FHIR or manual entry.',
    signals: ['lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose'],
    cadence: 'periodic',
    authType: 'fhir',
    integrationStatus: 'future',
  },
  marek_health: {
    label: 'Marek Health',
    category: 'biomarker_lab',
    description: 'Comprehensive hormone and metabolic panels popular with optimization-focused practitioners.',
    signals: ['lab_testosterone', 'lab_cortisol', 'lab_thyroid_tsh', 'lab_vitamin_d', 'lab_crp', 'lab_hemoglobin', 'lab_hematocrit', 'lab_ferritin', 'lab_iron', 'lab_transferrin_sat', 'lab_creatine_kinase', 'lab_fasting_glucose'],
    cadence: 'periodic',
    authType: 'api_key',
    integrationStatus: 'future',
  },

  // ======== TRAINING APPS ========

  strava: {
    label: 'Strava',
    category: 'training_app',
    description: 'Activity tracking, training log, relative effort, fitness/freshness.',
    signals: ['active_calories', 'strain_score', 'steps'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  trainingpeaks: {
    label: 'TrainingPeaks',
    category: 'training_app',
    description: 'TSS, CTL, ATL, workout compliance, structured training plans.',
    signals: ['strain_score', 'active_calories'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  peloton: {
    label: 'Peloton',
    category: 'training_app',
    description: 'Workout history, output metrics, heart rate zones, streaks.',
    signals: ['active_calories', 'strain_score'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'future',
  },
  strong_app: {
    label: 'Strong / Hevy',
    category: 'training_app',
    description: 'Resistance training logs — volume, tonnage, PRs.',
    signals: ['strain_score', 'active_calories'],
    cadence: 'daily',
    authType: 'api_key',
    integrationStatus: 'future',
  },

  // ======== NUTRITION APPS ========

  myfitnesspal: {
    label: 'MyFitnessPal',
    category: 'nutrition_app',
    description: 'Calorie and macro tracking with large food database.',
    signals: ['nutrition_calories', 'nutrition_protein'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  cronometer: {
    label: 'Cronometer',
    category: 'nutrition_app',
    description: 'Detailed micro/macronutrient tracking favored by optimization-focused users.',
    signals: ['nutrition_calories', 'nutrition_protein'],
    cadence: 'daily',
    authType: 'oauth2',
    integrationStatus: 'planned',
  },
  macrofactor: {
    label: 'MacroFactor',
    category: 'nutrition_app',
    description: 'Adaptive TDEE tracking and macro coaching.',
    signals: ['nutrition_calories', 'nutrition_protein'],
    cadence: 'daily',
    authType: 'api_key',
    integrationStatus: 'future',
  },
  carbon_diet: {
    label: 'Carbon Diet Coach',
    category: 'nutrition_app',
    description: 'AI-adjusted macro targets based on weight and adherence trends.',
    signals: ['nutrition_calories', 'nutrition_protein'],
    cadence: 'daily',
    authType: 'api_key',
    integrationStatus: 'future',
  },

  // ======== MEDICAL RECORDS ========

  epic_mychart: {
    label: 'Epic MyChart',
    category: 'medical_record',
    description: 'EHR access via FHIR R4. Lab results, medications, visit notes, immunizations.',
    signals: ['lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh'],
    cadence: 'event',
    authType: 'fhir',
    integrationStatus: 'future',
  },
  cerner: {
    label: 'Oracle Health (Cerner)',
    category: 'medical_record',
    description: 'EHR access via FHIR R4. Clinical data interop.',
    signals: ['lab_a1c', 'lab_testosterone', 'lab_crp', 'lab_vitamin_d', 'lab_cortisol', 'lab_thyroid_tsh'],
    cadence: 'event',
    authType: 'fhir',
    integrationStatus: 'future',
  },

  // ======== SELF-REPORT / PRACTITIONER ========

  self_report: {
    label: 'Self-Report (In-App)',
    category: 'self_report',
    description: 'Patient-athlete self-reported energy, pain, mood, adherence.',
    signals: ['self_energy', 'self_pain'],
    cadence: 'weekly',
    authType: 'manual',
    integrationStatus: 'planned',
  },
  practitioner_entry: {
    label: 'Practitioner Entry',
    category: 'practitioner',
    description: 'Coach or physician observations, protocol adjustments, clinical notes.',
    signals: ['practitioner_note'],
    cadence: 'event',
    authType: 'manual',
    integrationStatus: 'planned',
  },
};

export type DataSourceId = keyof typeof DATA_SOURCES;
export const DATA_SOURCE_LIST = Object.keys(DATA_SOURCES) as DataSourceId[];

/** Sources grouped by category for UI rendering. */
export const SOURCES_BY_CATEGORY: Record<SourceCategory, DataSourceId[]> = {
  wearable: ['oura', 'whoop', 'garmin', 'apple_watch', 'fitbit', 'samsung_health', 'polar', 'coros'],
  biomarker_lab: ['function_health', 'insidetracker', 'wild_health', 'quest_diagnostics', 'labcorp', 'marek_health'],
  training_app: ['strava', 'trainingpeaks', 'peloton', 'strong_app'],
  nutrition_app: ['myfitnesspal', 'cronometer', 'macrofactor', 'carbon_diet'],
  medical_record: ['epic_mychart', 'cerner'],
  self_report: ['self_report'],
  practitioner: ['practitioner_entry'],
};

/** For synthetic data: which wearable a subject "uses" determines which signals arrive daily. */
export const WEARABLE_PROFILES: Record<string, { primary: DataSourceId; secondary?: DataSourceId }> = {
  oura_strava: { primary: 'oura', secondary: 'strava' },
  whoop_trainingpeaks: { primary: 'whoop', secondary: 'trainingpeaks' },
  garmin_strava: { primary: 'garmin', secondary: 'strava' },
  apple_watch_peloton: { primary: 'apple_watch', secondary: 'peloton' },
  fitbit_myfitnesspal: { primary: 'fitbit', secondary: 'myfitnesspal' },
  garmin_trainingpeaks: { primary: 'garmin', secondary: 'trainingpeaks' },
  whoop_strava: { primary: 'whoop', secondary: 'strava' },
  oura_only: { primary: 'oura' },
};

/** For synthetic data: which biomarker provider a subject uses determines lab cadence and signals. */
export const BIOMARKER_PROFILES: Record<string, { provider: DataSourceId; cadenceWeeks: number }> = {
  function_quarterly: { provider: 'function_health', cadenceWeeks: 13 },
  insidetracker_biannual: { provider: 'insidetracker', cadenceWeeks: 26 },
  wild_health_quarterly: { provider: 'wild_health', cadenceWeeks: 13 },
  marek_monthly: { provider: 'marek_health', cadenceWeeks: 6 },
  standard_lab: { provider: 'quest_diagnostics', cadenceWeeks: 26 },
};

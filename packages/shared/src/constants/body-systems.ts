/**
 * Body system and region definitions that the WASM Digital Twin renderer consumes.
 * Each region has associated health signals that drive its visual state:
 *   - thermal gradient (inflammation, recovery heat)
 *   - fluid/hydration level
 *   - stress/load intensity
 *   - recovery phase
 *
 * The backend computes region states from signal data.
 * The WASM frontend interpolates between snapshots at 60fps.
 */

export interface BodyRegionDef {
  label: string;
  /** Mesh group ID the WASM renderer targets. */
  meshId: string;
  /** Which health signals drive this region's visual state. */
  drivingSignals: string[];
  /** Which health domains this region maps to. */
  domains: string[];
  /** Default rest-state color (hex). WASM overrides based on data. */
  baseColor: string;
}

export const BODY_REGIONS: Record<string, BodyRegionDef> = {

  // ---- Cardiovascular / Core ----
  heart: {
    label: 'Heart',
    meshId: 'cardiac_mesh',
    drivingSignals: ['resting_hr', 'hrv_rmssd', 'strain_score', 'active_calories'],
    domains: ['cardiovascular'],
    baseColor: '#EF4444',
  },
  lungs: {
    label: 'Lungs',
    meshId: 'pulmonary_mesh',
    drivingSignals: ['strain_score', 'active_calories', 'recovery_score'],
    domains: ['cardiovascular'],
    baseColor: '#F87171',
  },

  // ---- Metabolic / Digestive ----
  liver: {
    label: 'Liver',
    meshId: 'hepatic_mesh',
    drivingSignals: ['lab_a1c', 'nutrition_calories', 'lab_crp'],
    domains: ['metabolic'],
    baseColor: '#B45309',
  },
  gut: {
    label: 'GI / Gut',
    meshId: 'gi_mesh',
    drivingSignals: ['nutrition_calories', 'nutrition_protein', 'self_energy'],
    domains: ['metabolic'],
    baseColor: '#D97706',
  },
  pancreas: {
    label: 'Pancreas',
    meshId: 'pancreatic_mesh',
    drivingSignals: ['lab_a1c', 'nutrition_calories'],
    domains: ['metabolic'],
    baseColor: '#F59E0B',
  },

  // ---- Hormonal / Endocrine ----
  thyroid: {
    label: 'Thyroid',
    meshId: 'thyroid_mesh',
    drivingSignals: ['lab_thyroid_tsh', 'self_energy', 'resting_hr'],
    domains: ['hormonal'],
    baseColor: '#8B5CF6',
  },
  adrenals: {
    label: 'Adrenal Glands',
    meshId: 'adrenal_mesh',
    drivingSignals: ['lab_cortisol', 'hrv_rmssd', 'sleep_quality'],
    domains: ['hormonal', 'cognitive'],
    baseColor: '#A78BFA',
  },
  pituitary: {
    label: 'Pituitary',
    meshId: 'pituitary_mesh',
    drivingSignals: ['lab_testosterone', 'sleep_quality', 'recovery_score'],
    domains: ['hormonal'],
    baseColor: '#C084FC',
  },

  // ---- Musculoskeletal ----
  upper_body: {
    label: 'Upper Body (Shoulders / Arms)',
    meshId: 'upper_musculo_mesh',
    drivingSignals: ['strain_score', 'self_pain', 'recovery_score', 'lab_crp'],
    domains: ['musculoskeletal'],
    baseColor: '#14B8A6',
  },
  core_trunk: {
    label: 'Core / Trunk',
    meshId: 'core_mesh',
    drivingSignals: ['strain_score', 'self_pain', 'active_calories'],
    domains: ['musculoskeletal'],
    baseColor: '#2DD4BF',
  },
  lower_body: {
    label: 'Lower Body (Legs / Knees)',
    meshId: 'lower_musculo_mesh',
    drivingSignals: ['strain_score', 'self_pain', 'recovery_score', 'steps', 'lab_crp'],
    domains: ['musculoskeletal'],
    baseColor: '#5EEAD4',
  },
  joints: {
    label: 'Joints (Connective Tissue)',
    meshId: 'joint_mesh',
    drivingSignals: ['self_pain', 'lab_crp', 'lab_vitamin_d', 'recovery_score'],
    domains: ['musculoskeletal'],
    baseColor: '#99F6E4',
  },

  // ---- Sleep / Recovery ----
  brain_sleep: {
    label: 'Brain (Sleep Architecture)',
    meshId: 'brain_sleep_mesh',
    drivingSignals: ['sleep_duration', 'sleep_quality', 'hrv_rmssd'],
    domains: ['sleep_recovery'],
    baseColor: '#3B82F6',
  },
  autonomic_ns: {
    label: 'Autonomic Nervous System',
    meshId: 'ans_mesh',
    drivingSignals: ['hrv_rmssd', 'resting_hr', 'recovery_score', 'sleep_quality'],
    domains: ['sleep_recovery', 'cardiovascular'],
    baseColor: '#60A5FA',
  },

  // ---- Cognitive / Stress ----
  brain_cognitive: {
    label: 'Brain (Cognitive / Stress)',
    meshId: 'brain_cog_mesh',
    drivingSignals: ['lab_cortisol', 'hrv_rmssd', 'self_energy', 'sleep_quality'],
    domains: ['cognitive'],
    baseColor: '#EC4899',
  },
};

export type BodyRegionId = keyof typeof BODY_REGIONS;
export const BODY_REGION_LIST = Object.keys(BODY_REGIONS) as BodyRegionId[];

// ---- Visualization state types (what the WASM renderer receives per frame) ----

export interface RegionState {
  regionId: BodyRegionId;
  /** 0-1 thermal intensity. 0 = cool/rested, 1 = hot/inflamed/active. */
  thermalIntensity: number;
  /** 0-1 fluid/hydration level. */
  hydrationLevel: number;
  /** 0-1 stress/load. Maps to glow intensity in the renderer. */
  stressLoad: number;
  /** 0-1 recovery phase. Drives the "healing" animation overlay. */
  recoveryPhase: number;
  /** Overall region health 0-1 (composite). Drives color interpolation. */
  healthScore: number;
  /** Active protocols affecting this region. */
  activeProtocols: string[];
}

export interface DigitalTwinFrame {
  subjectId: string;
  frameTimestamp: string;
  overallScore: number;
  regions: RegionState[];
}

/** Visual layer modes the WASM renderer can switch between. */
export type RenderLayer =
  | 'thermal'          // inflammation / temperature gradient
  | 'recovery'         // recovery phase overlay
  | 'stress'           // load / strain visualization
  | 'hydration'        // fluid levels
  | 'protocol_impact'  // highlight regions affected by active protocols
  | 'composite';       // blended default view

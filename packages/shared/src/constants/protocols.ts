import type { HealthDomainId } from './health-domains.js';
import type { HealthSignalId } from './health-signals.js';

export interface ProtocolDef {
  label: string;
  category: ProtocolCategory;
  description: string;
  /** Health domains this protocol targets. */
  targetDomains: HealthDomainId[];
  /** Signals that should improve (or be monitored) when on this protocol. */
  monitoredSignals: HealthSignalId[];
  /** Typical dosing frequency for synthetic data realism. */
  dosingCadence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'as_needed';
  /** Weeks before response signal typically appears. */
  onsetWeeks: number;
  /** Weeks to peak effect for synthetic curves. */
  peakWeeks: number;
}

export type ProtocolCategory =
  | 'metabolic_weight'
  | 'performance_cognitive'
  | 'aging_longevity'
  | 'recovery_tissue';

export const PROTOCOL_CATEGORIES: Record<ProtocolCategory, { label: string; color: string }> = {
  metabolic_weight: { label: 'Metabolic & Weight', color: '#F59E0B' },
  performance_cognitive: { label: 'Performance & Cognitive', color: '#3B82F6' },
  aging_longevity: { label: 'Aging & Longevity', color: '#A78BFA' },
  recovery_tissue: { label: 'Recovery & Tissue Support', color: '#2DD4BF' },
};

export const PROTOCOLS: Record<string, ProtocolDef> = {
  tirzepatide: {
    label: 'Tirzepatide',
    category: 'metabolic_weight',
    description: 'Dual-action GIP/GLP-1 peptide for appetite control, metabolic regulation, and energy balance.',
    targetDomains: ['metabolic'],
    monitoredSignals: ['lab_a1c', 'active_calories', 'steps', 'nutrition_calories', 'self_energy'],
    dosingCadence: 'weekly',
    onsetWeeks: 2,
    peakWeeks: 12,
  },
  semaglutide: {
    label: 'Semaglutide',
    category: 'metabolic_weight',
    description: 'GLP-1 medication supporting appetite regulation and metabolic signaling.',
    targetDomains: ['metabolic'],
    monitoredSignals: ['lab_a1c', 'active_calories', 'nutrition_calories', 'self_energy'],
    dosingCadence: 'weekly',
    onsetWeeks: 2,
    peakWeeks: 16,
  },
  aod_9604: {
    label: 'AOD-9604',
    category: 'metabolic_weight',
    description: 'Supports fat-metabolism signals, body composition, and joint comfort.',
    targetDomains: ['metabolic', 'musculoskeletal'],
    monitoredSignals: ['active_calories', 'self_pain', 'lab_crp'],
    dosingCadence: 'daily',
    onsetWeeks: 4,
    peakWeeks: 12,
  },
  lipo_c: {
    label: 'Lipo-C / MIC+B12',
    category: 'metabolic_weight',
    description: 'Lipotropic compounds with B vitamins for fat metabolism, energy, and liver function.',
    targetDomains: ['metabolic'],
    monitoredSignals: ['self_energy', 'active_calories', 'nutrition_calories'],
    dosingCadence: 'weekly',
    onsetWeeks: 1,
    peakWeeks: 6,
  },
  nad_plus: {
    label: 'NAD+',
    category: 'performance_cognitive',
    description: 'Essential molecule supporting cellular energy, mental clarity, recovery, and healthy aging.',
    targetDomains: ['cognitive', 'sleep_recovery', 'cardiovascular'],
    monitoredSignals: ['self_energy', 'hrv_rmssd', 'sleep_quality', 'recovery_score'],
    dosingCadence: 'biweekly',
    onsetWeeks: 1,
    peakWeeks: 8,
  },
  semax_selank: {
    label: 'Semax / Selank (Blend)',
    category: 'performance_cognitive',
    description: 'Peptide combination for calm focus, mood balance, stress resilience, and mental clarity.',
    targetDomains: ['cognitive'],
    monitoredSignals: ['self_energy', 'hrv_rmssd', 'lab_cortisol', 'sleep_quality'],
    dosingCadence: 'daily',
    onsetWeeks: 1,
    peakWeeks: 4,
  },
  glutathione: {
    label: 'Glutathione',
    category: 'aging_longevity',
    description: 'Powerful antioxidant supporting cellular repair, detoxification, and immune function.',
    targetDomains: ['metabolic', 'cardiovascular'],
    monitoredSignals: ['lab_crp', 'self_energy', 'recovery_score'],
    dosingCadence: 'biweekly',
    onsetWeeks: 2,
    peakWeeks: 8,
  },
  sermorelin: {
    label: 'Sermorelin',
    category: 'aging_longevity',
    description: 'Signals the pituitary to support natural growth hormone release for sleep, recovery, and vitality.',
    targetDomains: ['hormonal', 'sleep_recovery', 'musculoskeletal'],
    monitoredSignals: ['sleep_quality', 'sleep_duration', 'recovery_score', 'lab_testosterone', 'self_energy'],
    dosingCadence: 'daily',
    onsetWeeks: 4,
    peakWeeks: 12,
  },
  mots_c: {
    label: 'MOTS-C',
    category: 'aging_longevity',
    description: 'Supports healthy aging, exercise tolerance, metabolic flexibility, and physical resilience.',
    targetDomains: ['metabolic', 'cardiovascular', 'musculoskeletal'],
    monitoredSignals: ['active_calories', 'strain_score', 'recovery_score', 'hrv_rmssd'],
    dosingCadence: 'weekly',
    onsetWeeks: 3,
    peakWeeks: 10,
  },
  ghk_cu: {
    label: 'GHK-Cu',
    category: 'aging_longevity',
    description: 'Copper peptide complex supporting skin quality, tissue repair, collagen, and cosmetic wellness.',
    targetDomains: ['musculoskeletal'],
    monitoredSignals: ['self_pain', 'lab_crp', 'recovery_score'],
    dosingCadence: 'daily',
    onsetWeeks: 2,
    peakWeeks: 8,
  },
  bpc157_tb500: {
    label: 'BPC-157 / TB-500 (Blend)',
    category: 'recovery_tissue',
    description: '"Wolverine Blend" for joint comfort, tendon recovery, and tissue support after training or injury.',
    targetDomains: ['musculoskeletal'],
    monitoredSignals: ['self_pain', 'recovery_score', 'strain_score', 'lab_crp', 'active_calories'],
    dosingCadence: 'daily',
    onsetWeeks: 1,
    peakWeeks: 6,
  },
};

export type ProtocolId = keyof typeof PROTOCOLS;
export const PROTOCOL_LIST = Object.keys(PROTOCOLS) as ProtocolId[];

/** Common protocol stacks (multiple protocols used together). */
export const PROTOCOL_STACKS: Record<string, { label: string; protocols: ProtocolId[] }> = {
  metabolic_reset: {
    label: 'Metabolic Reset Stack',
    protocols: ['tirzepatide', 'lipo_c', 'glutathione'],
  },
  performance_longevity: {
    label: 'Performance & Longevity Stack',
    protocols: ['nad_plus', 'sermorelin', 'mots_c'],
  },
  injury_recovery: {
    label: 'Injury Recovery Stack',
    protocols: ['bpc157_tb500', 'ghk_cu', 'glutathione'],
  },
  cognitive_edge: {
    label: 'Cognitive Edge Stack',
    protocols: ['semax_selank', 'nad_plus'],
  },
  hormonal_optimization: {
    label: 'Hormonal Optimization Stack',
    protocols: ['sermorelin', 'mots_c', 'nad_plus'],
  },
};

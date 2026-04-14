export const HEALTH_DOMAINS = {
  cardiovascular: { label: 'Cardiovascular', shortLabel: 'CARDIO', color: '#EF4444' },
  metabolic: { label: 'Metabolic', shortLabel: 'META', color: '#F59E0B' },
  hormonal: { label: 'Hormonal', shortLabel: 'HORM', color: '#A78BFA' },
  musculoskeletal: { label: 'Musculoskeletal', shortLabel: 'MSK', color: '#2DD4BF' },
  sleep_recovery: { label: 'Sleep & Recovery', shortLabel: 'SLEEP', color: '#3B82F6' },
  cognitive: { label: 'Cognitive & Stress', shortLabel: 'COG', color: '#EC4899' },
} as const;

export type HealthDomainId = keyof typeof HEALTH_DOMAINS;
export const HEALTH_DOMAIN_LIST = Object.keys(HEALTH_DOMAINS) as HealthDomainId[];

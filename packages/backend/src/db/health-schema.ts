import { pgTable, uuid, text, real, integer, timestamp, jsonb, pgEnum, boolean, date, index, check } from 'drizzle-orm/pg-core';

// ---- Enums ----
export const healthRiskBandEnum = pgEnum('health_risk_band', ['critical', 'high', 'medium', 'low']);
export const healthDomainEnum = pgEnum('health_domain', [
  'cardiovascular', 'metabolic', 'hormonal', 'musculoskeletal', 'sleep_recovery', 'cognitive',
]);
export const healthSignalStateEnum = pgEnum('health_signal_state', [
  'final', 'preliminary', 'registered', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown',
]);
export const healthGovBandEnum = pgEnum('health_governance_band', ['ESCALATED', 'MONITOR', 'SUPPRESSED']);
export const sessionStatusEnum = pgEnum('session_status', ['draft', 'held', 'confirmed', 'completed']);
export const auditActionEnum = pgEnum('audit_action', ['read', 'create', 'update', 'delete', 'export']);
export const actorTypeEnum = pgEnum('actor_type', ['user', 'system', 'api_key']);
export const sexEnum = pgEnum('sex', ['M', 'F', 'other']);
export const fitnessLevelEnum = pgEnum('fitness_level', ['low', 'medium', 'high']);
export const trainingPhaseEnum = pgEnum('training_phase', ['recovery', 'base', 'build', 'peak', 'taper', 'race', 'off_season']);

// ---- Organizations (multi-tenancy from day 1) ----
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('free'),
  baa_status: text('baa_status').notNull().default('unsigned'), // 'unsigned' | 'pending' | 'signed' | 'expired'
  baa_signed_at: timestamp('baa_signed_at', { withTimezone: true }),
  baa_document_ref: text('baa_document_ref'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Subjects (replaces vins) ----
export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  external_id: text('external_id').notNull(),

  // PHI fields — encrypt at rest in production via pgcrypto or app-level AES
  display_name: text('display_name').notNull(),
  date_of_birth: text('date_of_birth'),  // stored as text for encryption compatibility
  sex: sexEnum('sex').notNull(),
  fitness_level: fitnessLevelEnum('fitness_level').notNull().default('medium'),
  sport: text('sport'),
  height_cm: real('height_cm'),
  weight_kg: real('weight_kg'),
  training_phase: trainingPhaseEnum('training_phase').default('base'),
  calorie_target: integer('calorie_target'),
  coach_notes: text('coach_notes').default(''),
  races: jsonb('races').default([]),
  active_domains: jsonb('active_domains').notNull().default([]),
  enrolled_at: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),

  // Current posterior state
  posterior_p: real('posterior_p').notNull().default(0),
  posterior_p_var: real('posterior_p_var').notNull().default(0.25),  // precision of P estimate (0=precise, 0.25=max uncertainty)
  posterior_c: real('posterior_c').notNull().default(0),
  posterior_s: real('posterior_s').notNull().default(0),
  risk_band: healthRiskBandEnum('risk_band').notNull().default('low'),
  governance_band: healthGovBandEnum('governance_band').notNull().default('SUPPRESSED'),
  governance_reason: text('governance_reason').notNull().default(''),
  primary_domain: healthDomainEnum('primary_domain').notNull().default('sleep_recovery'),
  last_signal_at: timestamp('last_signal_at', { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Health Signal Events (replaces pillar_events) ----
export const healthSignalEvents = pgTable('health_signal_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  signal_name: text('signal_name').notNull(),
  signal_state: healthSignalStateEnum('signal_state').notNull(),
  confidence: real('confidence').notNull().default(0.5),
  source_type: text('source_type').notNull(),    // 'oura', 'whoop', 'lab', 'self_report', etc.
  raw_value: real('raw_value'),
  unit: text('unit').notNull().default(''),
  normalized_value: real('normalized_value').notNull().default(0.5),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull(),
  metadata: jsonb('metadata').default({}),
});

// ---- Posterior Snapshots (same architecture, health context) ----
export const healthSnapshots = pgTable('health_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  domain: healthDomainEnum('domain').notNull(),
  p_score: real('p_score').notNull(),
  p_var: real('p_var').notNull().default(0.25),
  c_score: real('c_score').notNull(),
  s_score: real('s_score').notNull(),
  risk_band: healthRiskBandEnum('risk_band').notNull(),
  governance_band: healthGovBandEnum('governance_band').notNull().default('SUPPRESSED'),
  governance_reason: text('governance_reason').notNull().default(''),
  signal_vector: jsonb('signal_vector').default({}),
  frame_index: integer('frame_index').notNull(),
  computed_at: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Health Governance Actions ----
export const healthGovernanceActions = pgTable('health_governance_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  action_type: text('action_type').notNull(),
  reason: text('reason').notNull(),
  triggered_by: text('triggered_by').notNull(),
  metadata: jsonb('metadata').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Practitioners (replaces dealer_directory) ----
export const practitioners = pgTable('practitioners', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  specialty: text('specialty').notNull(),
  metro_area: text('metro_area').notNull(),
  certifications: jsonb('certifications').default([]),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Session Slots (replaces fsr_slots) ----
export const sessionSlots = pgTable('session_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  practitioner_id: uuid('practitioner_id').notNull().references(() => practitioners.id),
  date: text('date').notNull(),
  time_block: text('time_block').notNull(),
  capacity: integer('capacity').notNull().default(2),
  booked: integer('booked').notNull().default(0),
});

// ---- Session Bookings (replaces booking_drafts) ----
export const sessionBookings = pgTable('session_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  practitioner_id: uuid('practitioner_id').notNull().references(() => practitioners.id),
  slot_id: uuid('slot_id').notNull().references(() => sessionSlots.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  status: sessionStatusEnum('status').notNull().default('draft'),
  reason: text('reason').notNull(),
  contact: jsonb('contact').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Protocol Assignments (tracks which peptide/intervention a subject is on) ----
export const protocolAssignments = pgTable('protocol_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  protocol_id: text('protocol_id').notNull(),         // key into PROTOCOLS constant
  started_at: timestamp('started_at', { withTimezone: true }).notNull(),
  ended_at: timestamp('ended_at', { withTimezone: true }),
  // DEPRECATED: use structured dose_* columns. Kept for migration compatibility.
  dosing_notes: text('dosing_notes').notNull().default(''),
  dose_amount: real('dose_amount'),
  dose_unit: text('dose_unit'),                       // 'mg', 'mcg', 'mL', 'IU'
  dose_frequency: text('dose_frequency'),             // 'daily' | 'weekly' | 'biweekly' | 'as_needed'
  dose_route: text('dose_route'),                     // 'SubQ' | 'intranasal' | 'oral' | 'IV' | 'topical'
  dose_start_date: timestamp('dose_start_date', { withTimezone: true }),
  dose_end_date: timestamp('dose_end_date', { withTimezone: true }),
  prescribed_by: text('prescribed_by').notNull().default('system'),
  status: text('status').notNull().default('active'),  // 'active', 'paused', 'completed', 'discontinued'
  metadata: jsonb('metadata').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Subject Data Sources (which platforms a subject has connected) ----
export const subjectDataSources = pgTable('subject_data_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  source_id: text('source_id').notNull(),              // key into DATA_SOURCES constant
  connected_at: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  last_sync_at: timestamp('last_sync_at', { withTimezone: true }),
  status: text('status').notNull().default('active'),  // 'active', 'disconnected', 'error'
  // SECURITY: OAuth tokens must NOT be stored as plaintext in production.
  // Store a reference key pointing to a secrets manager (AWS Secrets Manager, Vault).
  // e.g. { secretRef: "longevity/org_id/subject_id/oura" }
  metadata: jsonb('metadata').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Audit Log (HIPAA foundation — built from day 1) ----
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id').notNull(),
  actor_id: text('actor_id').notNull(),
  actor_type: actorTypeEnum('actor_type').notNull().default('system'),
  action: auditActionEnum('action').notNull(),
  resource_type: text('resource_type').notNull(),
  resource_id: text('resource_id').notNull(),
  phi_accessed: integer('phi_accessed').notNull().default(0),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  metadata: jsonb('metadata').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Subject Current State (decoupled from subjects to reduce write contention) ----
export const subjectCurrentState = pgTable('subject_current_state', {
  subject_id: uuid('subject_id').primaryKey().references(() => subjects.id),
  org_id: uuid('org_id').notNull(),
  posterior_p: real('posterior_p').notNull().default(0.5),
  posterior_p_var: real('posterior_p_var').notNull().default(0.25),
  posterior_c: real('posterior_c').notNull().default(0.0),
  posterior_s: real('posterior_s').notNull().default(1.0),
  governance_band: text('governance_band').notNull().default('SUPPRESSED'),
  governance_reason: text('governance_reason').notNull().default(''),
  primary_domain: text('primary_domain'),
  last_signal_at: timestamp('last_signal_at', { withTimezone: true }),
  computed_at: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Adverse Events (tracks protocol side effects) ----
export const adverseEvents = pgTable('adverse_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  protocol_id: text('protocol_id'),
  event_type: text('event_type').notNull(),           // 'nausea', 'injection_site_reaction', etc.
  severity: text('severity').notNull(),               // 'mild' | 'moderate' | 'severe'
  onset_at: timestamp('onset_at', { withTimezone: true }).notNull(),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  notes: text('notes'),
  reported_by: text('reported_by').notNull(),         // 'subject' | 'practitioner' | 'system'
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Subject Consents (tracks data sharing and protocol consent) ----
export const subjectConsents = pgTable('subject_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  consent_type: text('consent_type').notNull(),       // 'data_collection' | 'protocol_enrollment' | 'third_party_sharing' | 'research_use'
  consented: boolean('consented').notNull(),
  consented_at: timestamp('consented_at', { withTimezone: true }).notNull(),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  consent_version: text('consent_version').notNull(),
  ip_address: text('ip_address'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Subject Medications (current meds/supplements for interaction checking) ----
export const subjectMedications = pgTable('subject_medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject_id: uuid('subject_id').notNull().references(() => subjects.id),
  org_id: uuid('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),                       // drug/supplement name
  rxcui: text('rxcui'),                               // RxNorm concept ID (optional)
  category: text('category').notNull(),               // 'prescription' | 'otc' | 'supplement' | 'peptide'
  dose_amount: real('dose_amount'),
  dose_unit: text('dose_unit'),
  frequency: text('frequency'),                       // 'daily' | 'weekly' | 'as_needed' | 'prn'
  route: text('route'),                               // 'oral' | 'SubQ' | 'topical' | 'IV'
  started_at: timestamp('started_at', { withTimezone: true }),
  ended_at: timestamp('ended_at', { withTimezone: true }),
  prescriber: text('prescriber'),
  status: text('status').notNull().default('active'), // 'active' | 'discontinued' | 'paused'
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

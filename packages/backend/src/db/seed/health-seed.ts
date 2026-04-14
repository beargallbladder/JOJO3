/**
 * Health domain seed script.
 * Generates 200 subjects with longitudinal wearable + biomarker + protocol data.
 * Run: npx tsx src/db/seed/health-seed.ts
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql, count } from 'drizzle-orm';
import * as hs from '../health-schema.js';
import { generateSubjects } from './health-subject-generator.js';
import { generateHealthSignalData } from './health-signal-generator.js';
import { generatePractitioners } from './health-practitioner-generator.js';

const BATCH = 100;

async function batchInsert<T extends Record<string, unknown>>(
  db: ReturnType<typeof drizzle>,
  table: any,
  rows: T[],
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(table).values(rows.slice(i, i + BATCH) as any);
  }
}

async function healthSeed() {
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gravity_leads';
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  const force = process.env.FORCE_SEED === '1';

  console.log('🩺 Starting health domain seed...');

  // Check if already seeded
  if (!force) {
    try {
      const existing = await db.select({ count: count() }).from(hs.subjects);
      const n = Number(existing[0]?.count ?? 0);
      if (n > 0) {
        console.log(`  Already seeded (subjects=${n}). Use FORCE_SEED=1 to rebuild.`);
        await pool.end();
        return;
      }
    } catch {
      console.log('  Health tables do not exist yet. Creating schema...');
    }
  }

  // Drop + recreate health tables
  console.log('  Dropping existing health tables...');
  await db.execute(sql`
    DROP TABLE IF EXISTS subject_medications CASCADE;
    DROP TABLE IF EXISTS subject_consents CASCADE;
    DROP TABLE IF EXISTS adverse_events CASCADE;
    DROP TABLE IF EXISTS subject_current_state CASCADE;
    DROP TABLE IF EXISTS audit_log CASCADE;
    DROP TABLE IF EXISTS session_bookings CASCADE;
    DROP TABLE IF EXISTS session_slots CASCADE;
    DROP TABLE IF EXISTS subject_data_sources CASCADE;
    DROP TABLE IF EXISTS protocol_assignments CASCADE;
    DROP TABLE IF EXISTS health_governance_actions CASCADE;
    DROP TABLE IF EXISTS health_snapshots CASCADE;
    DROP TABLE IF EXISTS health_signal_events CASCADE;
    DROP TABLE IF EXISTS practitioners CASCADE;
    DROP TABLE IF EXISTS subjects CASCADE;
    DROP TABLE IF EXISTS organizations CASCADE;
    DROP TYPE IF EXISTS health_risk_band CASCADE;
    DROP TYPE IF EXISTS health_domain CASCADE;
    DROP TYPE IF EXISTS health_signal_state CASCADE;
    DROP TYPE IF EXISTS health_governance_band CASCADE;
    DROP TYPE IF EXISTS session_status CASCADE;
    DROP TYPE IF EXISTS audit_action CASCADE;
    DROP TYPE IF EXISTS actor_type CASCADE;
    DROP TYPE IF EXISTS sex CASCADE;
    DROP TYPE IF EXISTS fitness_level CASCADE;
    DROP TYPE IF EXISTS training_phase CASCADE;
  `);

  console.log('  Creating health schema...');
  await db.execute(sql.raw(`
    DO $$ BEGIN CREATE TYPE "public"."health_risk_band" AS ENUM('critical','high','medium','low'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."health_domain" AS ENUM('cardiovascular','metabolic','hormonal','musculoskeletal','sleep_recovery','cognitive'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."health_signal_state" AS ENUM('final','preliminary','registered','amended','corrected','cancelled','entered-in-error','unknown'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."health_governance_band" AS ENUM('ESCALATED','MONITOR','SUPPRESSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."session_status" AS ENUM('draft','held','confirmed','completed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."audit_action" AS ENUM('read','create','update','delete','export'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."actor_type" AS ENUM('user','system','api_key'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."sex" AS ENUM('M','F','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."fitness_level" AS ENUM('low','medium','high'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE "public"."training_phase" AS ENUM('recovery','base','build','peak','taper','race','off_season'); EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "organizations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL, "slug" text NOT NULL UNIQUE,
      "plan" text NOT NULL DEFAULT 'free',
      "baa_status" text NOT NULL DEFAULT 'unsigned' CHECK (baa_status IN ('unsigned','pending','signed','expired')),
      "baa_signed_at" timestamp with time zone,
      "baa_document_ref" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "subjects" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "external_id" text NOT NULL,
      "display_name" text NOT NULL,
      "date_of_birth" text,
      "sex" "sex" NOT NULL,
      "fitness_level" "fitness_level" NOT NULL DEFAULT 'medium',
      "sport" text,
      "height_cm" real,
      "weight_kg" real,
      "training_phase" "training_phase" DEFAULT 'base',
      "calorie_target" integer,
      "coach_notes" text DEFAULT '',
      "races" jsonb DEFAULT '[]',
      "active_domains" jsonb NOT NULL DEFAULT '[]',
      "enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
      "posterior_p" real NOT NULL DEFAULT 0,
      "posterior_p_var" real NOT NULL DEFAULT 0.25,
      "posterior_c" real NOT NULL DEFAULT 0,
      "posterior_s" real NOT NULL DEFAULT 0,
      "risk_band" "health_risk_band" NOT NULL DEFAULT 'low',
      "governance_band" "health_governance_band" NOT NULL DEFAULT 'SUPPRESSED',
      "governance_reason" text NOT NULL DEFAULT '',
      "primary_domain" "health_domain" NOT NULL DEFAULT 'sleep_recovery',
      "last_signal_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "health_signal_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "signal_name" text NOT NULL,
      "signal_state" "health_signal_state" NOT NULL,
      "confidence" real NOT NULL DEFAULT 0.5,
      "source_type" text NOT NULL,
      "raw_value" real,
      "unit" text NOT NULL DEFAULT '',
      "normalized_value" real NOT NULL DEFAULT 0.5,
      "occurred_at" timestamp with time zone NOT NULL,
      "metadata" jsonb DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS "health_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "domain" "health_domain" NOT NULL,
      "p_score" real NOT NULL, "p_var" real NOT NULL DEFAULT 0.25,
      "c_score" real NOT NULL, "s_score" real NOT NULL,
      "risk_band" "health_risk_band" NOT NULL,
      "governance_band" "health_governance_band" NOT NULL DEFAULT 'SUPPRESSED',
      "governance_reason" text NOT NULL DEFAULT '',
      "signal_vector" jsonb DEFAULT '{}',
      "frame_index" integer NOT NULL,
      "computed_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "health_governance_actions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "action_type" text NOT NULL, "reason" text NOT NULL,
      "triggered_by" text NOT NULL,
      "metadata" jsonb DEFAULT '{}',
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "practitioners" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "name" text NOT NULL, "specialty" text NOT NULL, "metro_area" text NOT NULL,
      "certifications" jsonb DEFAULT '[]',
      "latitude" real NOT NULL, "longitude" real NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "session_slots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "practitioner_id" uuid NOT NULL REFERENCES "practitioners"("id"),
      "date" text NOT NULL, "time_block" text NOT NULL,
      "capacity" integer NOT NULL DEFAULT 3, "booked" integer NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS "session_bookings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "practitioner_id" uuid NOT NULL REFERENCES "practitioners"("id"),
      "slot_id" uuid NOT NULL REFERENCES "session_slots"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "status" "session_status" NOT NULL DEFAULT 'draft',
      "reason" text NOT NULL, "contact" jsonb DEFAULT '{}',
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "protocol_assignments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "protocol_id" text NOT NULL,
      "started_at" timestamp with time zone NOT NULL,
      "ended_at" timestamp with time zone,
      "dosing_notes" text NOT NULL DEFAULT '',
      "dose_amount" real, "dose_unit" text, "dose_frequency" text,
      "dose_route" text, "dose_start_date" timestamp with time zone, "dose_end_date" timestamp with time zone,
      "prescribed_by" text NOT NULL DEFAULT 'system',
      "status" text NOT NULL DEFAULT 'active',
      "metadata" jsonb DEFAULT '{}',
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "subject_data_sources" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "source_id" text NOT NULL,
      "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
      "last_sync_at" timestamp with time zone,
      "status" text NOT NULL DEFAULT 'active',
      "metadata" jsonb DEFAULT '{}',
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "audit_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL,
      "actor_id" text NOT NULL,
      "actor_type" "actor_type" NOT NULL DEFAULT 'system',
      "action" "audit_action" NOT NULL,
      "resource_type" text NOT NULL, "resource_id" text NOT NULL,
      "phi_accessed" integer NOT NULL DEFAULT 0,
      "ip_address" text, "user_agent" text,
      "metadata" jsonb DEFAULT '{}',
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "subject_current_state" (
      "subject_id" uuid PRIMARY KEY REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL,
      "posterior_p" real NOT NULL DEFAULT 0.5,
      "posterior_p_var" real NOT NULL DEFAULT 0.25,
      "posterior_c" real NOT NULL DEFAULT 0.0,
      "posterior_s" real NOT NULL DEFAULT 1.0,
      "governance_band" text NOT NULL DEFAULT 'SUPPRESSED',
      "governance_reason" text NOT NULL DEFAULT '',
      "primary_domain" text,
      "last_signal_at" timestamp with time zone,
      "computed_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "adverse_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "protocol_id" text,
      "event_type" text NOT NULL,
      "severity" text NOT NULL CHECK (severity IN ('mild','moderate','severe')),
      "onset_at" timestamp with time zone NOT NULL,
      "resolved_at" timestamp with time zone,
      "notes" text,
      "reported_by" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "subject_consents" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "consent_type" text NOT NULL CHECK (consent_type IN ('data_collection','protocol_enrollment','third_party_sharing','research_use')),
      "consented" boolean NOT NULL,
      "consented_at" timestamp with time zone NOT NULL,
      "revoked_at" timestamp with time zone,
      "consent_version" text NOT NULL,
      "ip_address" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "subject_medications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
      "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
      "name" text NOT NULL,
      "rxcui" text,
      "category" text NOT NULL,
      "dose_amount" real, "dose_unit" text, "frequency" text, "route" text,
      "started_at" timestamp with time zone,
      "ended_at" timestamp with time zone,
      "prescriber" text,
      "status" text NOT NULL DEFAULT 'active',
      "notes" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subject_medications_lookup ON subject_medications (subject_id, status);
    CREATE INDEX IF NOT EXISTS idx_hse_subject_signal_time ON health_signal_events (subject_id, signal_name, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_hse_org_time ON health_signal_events (org_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_org_time ON audit_log (org_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor_time ON audit_log (actor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_phi ON audit_log (phi_accessed, created_at DESC) WHERE phi_accessed = 1;
    CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log (resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_adverse_events_subject ON adverse_events (subject_id, onset_at);
    CREATE INDEX IF NOT EXISTS idx_adverse_events_org ON adverse_events (org_id, onset_at);
    CREATE INDEX IF NOT EXISTS idx_subject_consents_lookup ON subject_consents (subject_id, consent_type);
  `));

  // ---- Generate data ----

  // 1. Org
  const orgId = (await import('uuid')).v4();
  console.log('  Creating demo organization...');
  await db.insert(hs.organizations).values({
    id: orgId,
    name: 'LongevityPlan Demo',
    slug: 'longevityplan-demo',
    plan: 'pro',
  });

  // 2. Practitioners + slots
  console.log('  Generating practitioners + session slots...');
  const { practitioners, slots } = generatePractitioners(orgId);
  await batchInsert(db, hs.practitioners, practitioners.map(p => ({
    id: p.id, org_id: p.orgId, name: p.name, specialty: p.specialty,
    metro_area: p.metro_area, certifications: p.certifications,
    latitude: p.latitude, longitude: p.longitude,
  })));
  await batchInsert(db, hs.sessionSlots, slots.map(s => ({
    id: s.id, practitioner_id: s.practitioner_id,
    date: s.date, time_block: s.time_block,
    capacity: s.capacity, booked: s.booked,
  })));
  console.log(`  ✓ ${practitioners.length} practitioners, ${slots.length} slots`);

  // 3. Subjects
  console.log('  Generating 200 subjects...');
  const subjects = generateSubjects(200, orgId);
  await batchInsert(db, hs.subjects, subjects.map(s => ({
    id: s.id, org_id: s.orgId, external_id: s.externalId,
    display_name: s.displayName, date_of_birth: s.dateOfBirth,
    sex: s.sex, fitness_level: s.fitnessLevel,
    sport: s.sport, height_cm: s.heightCm, weight_kg: s.weightKg,
    training_phase: s.trainingPhase, calorie_target: s.calorieTarget,
    coach_notes: s.coachNotes, races: s.races,
    active_domains: s.activeDomains, enrolled_at: s.enrolledAt,
    posterior_p: s.posteriorP, posterior_p_var: s.posteriorPVar,
    posterior_c: s.posteriorC, posterior_s: s.posteriorS,
    risk_band: s.riskBand, governance_band: 'SUPPRESSED' as const,
    governance_reason: '', primary_domain: s.primaryDomain,
    last_signal_at: s.lastSignalAt,
  })));
  console.log(`  ✓ ${subjects.length} subjects`);

  // 4. Signal events + snapshots + protocol assignments + data source connections
  console.log('  Generating longitudinal signal data (this takes a moment)...');
  const {
    events, snapshots, subjectUpdates,
    protocolAssignments, dataSourceConnections,
  } = generateHealthSignalData(subjects);

  console.log(`  Inserting ${events.length} signal events...`);
  await batchInsert(db, hs.healthSignalEvents, events.map(e => ({
    id: e.id, subject_id: e.subject_id, org_id: e.org_id,
    signal_name: e.signal_name, signal_state: e.signal_state,
    confidence: e.confidence, source_type: e.source_type,
    raw_value: e.raw_value, unit: e.unit, normalized_value: e.normalized_value,
    occurred_at: e.occurred_at, metadata: e.metadata,
  })));

  console.log(`  Inserting ${snapshots.length} health snapshots...`);
  await batchInsert(db, hs.healthSnapshots, snapshots.map(s => ({
    id: s.id, subject_id: s.subject_id, org_id: s.org_id,
    domain: s.domain, p_score: s.p_score, p_var: s.p_var, c_score: s.c_score, s_score: s.s_score,
    risk_band: s.risk_band, governance_band: s.governance_band,
    governance_reason: s.governance_reason, signal_vector: s.signal_vector,
    frame_index: s.frame_index, computed_at: s.computed_at,
  })));

  console.log(`  Inserting ${protocolAssignments.length} protocol assignments...`);
  await batchInsert(db, hs.protocolAssignments, protocolAssignments.map(p => ({
    id: p.id, subject_id: p.subject_id, org_id: p.org_id,
    protocol_id: p.protocol_id, started_at: p.started_at,
    status: p.status, dosing_notes: p.dosing_notes,
  })));

  console.log(`  Inserting ${dataSourceConnections.length} data source connections...`);
  await batchInsert(db, hs.subjectDataSources, dataSourceConnections.map(d => ({
    id: d.id, subject_id: d.subject_id, org_id: d.org_id,
    source_id: d.source_id, connected_at: d.connected_at,
    last_sync_at: d.last_sync_at, status: d.status,
  })));

  // 5. Align subject posterior with last snapshot
  console.log('  Aligning subject posterior fields...');
  for (const u of subjectUpdates) {
    await db.update(hs.subjects).set({
      posterior_p: u.posterior_p,
      posterior_p_var: u.posterior_p_var,
      posterior_c: u.posterior_c,
      posterior_s: u.posterior_s,
      risk_band: u.risk_band,
      governance_band: u.governance_band,
      governance_reason: u.governance_reason,
      last_signal_at: u.last_signal_at,
      updated_at: new Date(),
    }).where(eq(hs.subjects.id, u.subject_id));
  }

  // 5b. Populate subject_current_state
  console.log('  Populating subject_current_state table...');
  await batchInsert(db, hs.subjectCurrentState, subjectUpdates.map(u => ({
    subject_id: u.subject_id,
    org_id: subjects.find(s => s.id === u.subject_id)!.orgId,
    posterior_p: u.posterior_p,
    posterior_p_var: u.posterior_p_var,
    posterior_c: u.posterior_c,
    posterior_s: u.posterior_s,
    governance_band: u.governance_band,
    governance_reason: u.governance_reason,
    primary_domain: subjects.find(s => s.id === u.subject_id)!.primaryDomain,
    last_signal_at: u.last_signal_at,
    computed_at: new Date(),
  })));
  console.log(`  ✓ ${subjectUpdates.length} subject_current_state rows`);

  // Count ESCALATED
  const escalatedCount = subjectUpdates.filter(u => u.governance_band === 'ESCALATED').length;
  const monitorCount = subjectUpdates.filter(u => u.governance_band === 'MONITOR').length;
  console.log(`  Governance: ${escalatedCount} ESCALATED, ${monitorCount} MONITOR, ${subjectUpdates.length - escalatedCount - monitorCount} SUPPRESSED`);

  // 6. Governance actions for escalated/monitored subjects
  console.log('  Generating governance actions...');
  const govActions = subjectUpdates
    .filter(u => u.governance_band !== 'SUPPRESSED')
    .map(u => ({
      id: (crypto as any).randomUUID(),
      subject_id: u.subject_id,
      org_id: subjects.find(s => s.id === u.subject_id)!.orgId,
      action_type: u.governance_band === 'ESCALATED' ? 'recommend_intervention' : 'monitor',
      reason: u.governance_reason,
      triggered_by: 'governance_engine',
      metadata: {},
    }));
  if (govActions.length > 0) {
    await batchInsert(db, hs.healthGovernanceActions, govActions);
  }
  console.log(`  ✓ ${govActions.length} governance actions`);

  // 7. Subject medications from active protocol assignments
  console.log('  Generating subject medications...');
  const PROTOCOL_MED_INFO: Record<string, { name: string; category: string; route: string; doseAmount: number; doseUnit: string; frequency: string }> = {
    tirzepatide:   { name: 'Tirzepatide',           category: 'peptide', route: 'SubQ', doseAmount: 2.5,  doseUnit: 'mg',  frequency: 'weekly' },
    semaglutide:   { name: 'Semaglutide',           category: 'peptide', route: 'SubQ', doseAmount: 0.25, doseUnit: 'mg',  frequency: 'weekly' },
    aod_9604:      { name: 'AOD-9604',              category: 'peptide', route: 'SubQ', doseAmount: 300,  doseUnit: 'mcg', frequency: 'daily' },
    lipo_c:        { name: 'Lipo-C / MIC+B12',     category: 'supplement', route: 'SubQ', doseAmount: 1, doseUnit: 'mL', frequency: 'weekly' },
    nad_plus:      { name: 'NAD+',                  category: 'peptide', route: 'IV',   doseAmount: 250,  doseUnit: 'mg',  frequency: 'weekly' },
    semax_selank:  { name: 'Semax / Selank Blend',  category: 'peptide', route: 'intranasal', doseAmount: 200, doseUnit: 'mcg', frequency: 'daily' },
    glutathione:   { name: 'Glutathione',           category: 'supplement', route: 'IV', doseAmount: 200, doseUnit: 'mg', frequency: 'weekly' },
    sermorelin:    { name: 'Sermorelin',            category: 'peptide', route: 'SubQ', doseAmount: 300,  doseUnit: 'mcg', frequency: 'daily' },
    mots_c:        { name: 'MOTS-C',               category: 'peptide', route: 'SubQ', doseAmount: 10,   doseUnit: 'mg',  frequency: 'weekly' },
    ghk_cu:        { name: 'GHK-Cu',               category: 'peptide', route: 'topical', doseAmount: 2, doseUnit: 'mL', frequency: 'daily' },
    bpc157_tb500:  { name: 'BPC-157 / TB-500 Blend', category: 'peptide', route: 'SubQ', doseAmount: 500, doseUnit: 'mcg', frequency: 'daily' },
  };

  const medRows = protocolAssignments
    .filter(pa => pa.status === 'active' && PROTOCOL_MED_INFO[pa.protocol_id])
    .map(pa => {
      const info = PROTOCOL_MED_INFO[pa.protocol_id];
      return {
        subject_id: pa.subject_id,
        org_id: pa.org_id,
        name: info.name,
        category: info.category,
        dose_amount: info.doseAmount,
        dose_unit: info.doseUnit,
        frequency: info.frequency,
        route: info.route,
        started_at: pa.started_at,
        status: 'active' as const,
      };
    });

  if (medRows.length > 0) {
    await batchInsert(db, hs.subjectMedications, medRows);
  }
  console.log(`  ✓ ${medRows.length} subject medications`);

  // 8. Adverse events for subjects on peptide protocols (clinical realism)
  console.log('  Generating adverse events...');
  const ADVERSE_TEMPLATES: Array<{ protocols: string[]; events: Array<{ type: string; severity: 'mild' | 'moderate' | 'severe'; pct: number }> }> = [
    {
      protocols: ['tirzepatide', 'semaglutide'],
      events: [
        { type: 'nausea', severity: 'mild', pct: 0.65 },
        { type: 'injection_site_reaction', severity: 'mild', pct: 0.30 },
        { type: 'diarrhea', severity: 'mild', pct: 0.20 },
        { type: 'nausea', severity: 'moderate', pct: 0.15 },
        { type: 'fatigue', severity: 'mild', pct: 0.10 },
      ],
    },
    {
      protocols: ['bpc_157'],
      events: [
        { type: 'injection_site_reaction', severity: 'mild', pct: 0.20 },
        { type: 'nausea', severity: 'mild', pct: 0.08 },
      ],
    },
    {
      protocols: ['sermorelin', 'ipamorelin_cjc'],
      events: [
        { type: 'injection_site_reaction', severity: 'mild', pct: 0.25 },
        { type: 'headache', severity: 'mild', pct: 0.15 },
        { type: 'flushing', severity: 'mild', pct: 0.10 },
      ],
    },
    {
      protocols: ['nad_plus'],
      events: [
        { type: 'flushing', severity: 'moderate', pct: 0.40 },
        { type: 'nausea', severity: 'mild', pct: 0.15 },
        { type: 'chest_tightness', severity: 'mild', pct: 0.10 },
      ],
    },
    {
      protocols: ['semax', 'selank'],
      events: [
        { type: 'nasal_irritation', severity: 'mild', pct: 0.20 },
      ],
    },
  ];

  const adverseEventRows: Array<{
    subject_id: string; org_id: string; protocol_id: string;
    event_type: string; severity: string; onset_at: Date;
    resolved_at: Date | null; notes: string; reported_by: string;
  }> = [];

  const rngSeed = 42;
  let advRng = rngSeed;
  const advRandom = () => { advRng = (advRng * 16807 + 0) % 2147483647; return advRng / 2147483647; };

  for (const pa of protocolAssignments) {
    for (const tmpl of ADVERSE_TEMPLATES) {
      if (!tmpl.protocols.includes(pa.protocol_id)) continue;
      for (const evt of tmpl.events) {
        if (advRandom() > evt.pct) continue;
        const daysAfterStart = 1 + Math.floor(advRandom() * 14);
        const onsetAt = new Date(pa.started_at.getTime() + daysAfterStart * 864e5);
        const resolved = evt.severity === 'mild' && advRandom() < 0.7;
        const resolvedAt = resolved ? new Date(onsetAt.getTime() + (2 + Math.floor(advRandom() * 10)) * 864e5) : null;
        adverseEventRows.push({
          subject_id: pa.subject_id,
          org_id: pa.org_id,
          protocol_id: pa.protocol_id,
          event_type: evt.type,
          severity: evt.severity,
          onset_at: onsetAt,
          resolved_at: resolvedAt,
          notes: resolved ? `Resolved with symptomatic management` : '',
          reported_by: advRandom() < 0.6 ? 'subject' : 'practitioner',
        });
      }
    }
  }

  if (adverseEventRows.length > 0) {
    await batchInsert(db, hs.adverseEvents, adverseEventRows);
  }
  console.log(`  ✓ ${adverseEventRows.length} adverse events`);

  // Summary
  console.log('\n✅ Health seed complete!');
  console.log(`  Organization: LongevityPlan Demo`);
  console.log(`  Subjects: ${subjects.length}`);
  console.log(`  Practitioners: ${practitioners.length}`);
  console.log(`  Session Slots: ${slots.length}`);
  console.log(`  Signal Events: ${events.length}`);
  console.log(`  Snapshots: ${snapshots.length}`);
  console.log(`  Protocol Assignments: ${protocolAssignments.length}`);
  console.log(`  Data Source Connections: ${dataSourceConnections.length}`);
  console.log(`  Governance Actions: ${govActions.length}`);
  console.log(`  Subject Medications: ${medRows.length}`);
  console.log(`  Adverse Events: ${adverseEventRows.length}`);

  await pool.end();
}

healthSeed().catch((err) => {
  console.error('Health seed failed:', err);
  process.exit(1);
});

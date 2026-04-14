-- Migration: health schema v2 — clinical review corrections
-- Date: 2026-04-14

-- 1b. Fix signal_state enum to align with FHIR R4 Observation.status
-- Map existing values before altering
ALTER TYPE health_signal_state RENAME TO health_signal_state_old;
CREATE TYPE health_signal_state AS ENUM (
  'final', 'preliminary', 'registered', 'amended', 'corrected',
  'cancelled', 'entered-in-error', 'unknown'
);
ALTER TABLE health_signal_events
  ALTER COLUMN signal_state TYPE health_signal_state
  USING CASE signal_state::text
    WHEN 'present' THEN 'final'::health_signal_state
    WHEN 'absent' THEN 'cancelled'::health_signal_state
    WHEN 'unknown' THEN 'unknown'::health_signal_state
  END;
DROP TYPE health_signal_state_old;

-- 1c. Add adverse_events table
CREATE TABLE IF NOT EXISTS adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  protocol_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('mild','moderate','severe')),
  onset_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  reported_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adverse_events_subject ON adverse_events (subject_id, onset_at);
CREATE INDEX IF NOT EXISTS idx_adverse_events_org ON adverse_events (org_id, onset_at);

-- 1d. Add subject_consents table
CREATE TABLE IF NOT EXISTS subject_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'data_collection','protocol_enrollment','third_party_sharing','research_use'
  )),
  consented BOOLEAN NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  consent_version TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subject_consents_lookup ON subject_consents (subject_id, consent_type);

-- 1e. Add structured dosing columns to protocol_assignments
ALTER TABLE protocol_assignments
  ADD COLUMN IF NOT EXISTS dose_amount REAL,
  ADD COLUMN IF NOT EXISTS dose_unit TEXT,
  ADD COLUMN IF NOT EXISTS dose_frequency TEXT,
  ADD COLUMN IF NOT EXISTS dose_route TEXT,
  ADD COLUMN IF NOT EXISTS dose_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dose_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
COMMENT ON COLUMN protocol_assignments.dosing_notes IS 'DEPRECATED: Use structured dose_* columns.';

-- 1f. Add created_at/updated_at to tables missing them
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE subject_data_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE subject_data_sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 1g. Add indexes to audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_org_time ON audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_time ON audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_phi ON audit_log (phi_accessed, created_at DESC) WHERE phi_accessed = 1;
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log (resource_type, resource_id);

-- 1h. Add subject_current_state table
CREATE TABLE IF NOT EXISTS subject_current_state (
  subject_id UUID PRIMARY KEY REFERENCES subjects(id),
  org_id UUID NOT NULL,
  posterior_p REAL NOT NULL DEFAULT 0.5,
  posterior_p_var REAL NOT NULL DEFAULT 0.25,
  posterior_c REAL NOT NULL DEFAULT 0.0,
  posterior_s REAL NOT NULL DEFAULT 1.0,
  governance_band TEXT NOT NULL DEFAULT 'SUPPRESSED',
  governance_reason TEXT NOT NULL DEFAULT '',
  primary_domain TEXT,
  last_signal_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill subject_current_state from subjects table
INSERT INTO subject_current_state (subject_id, org_id, posterior_p, posterior_p_var, posterior_c, posterior_s, governance_band, governance_reason, primary_domain, last_signal_at, computed_at)
SELECT id, org_id, posterior_p, posterior_p_var, posterior_c, posterior_s, governance_band::text, governance_reason, primary_domain::text, last_signal_at, updated_at
FROM subjects
ON CONFLICT (subject_id) DO NOTHING;

-- PHI field comments
-- PHI: display_name must be encrypted with AES-256-GCM before storage in production.
COMMENT ON COLUMN subjects.display_name IS 'PHI: Must be encrypted with AES-256-GCM before storage in production.';
-- date_of_birth stored as TEXT to support encrypted bytea swap without schema migration.
COMMENT ON COLUMN subjects.date_of_birth IS 'PHI: Stored as TEXT for encryption compatibility. Use pgcrypto pgp_sym_encrypt() or app-level encryption with KMS-managed key.';

-- 4a. Add BAA status fields to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS baa_status TEXT NOT NULL DEFAULT 'unsigned'
    CHECK (baa_status IN ('unsigned','pending','signed','expired')),
  ADD COLUMN IF NOT EXISTS baa_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baa_document_ref TEXT;

-- Add recommended indexes for health_signal_events
CREATE INDEX IF NOT EXISTS idx_hse_subject_signal_time ON health_signal_events (subject_id, signal_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_hse_org_time ON health_signal_events (org_id, occurred_at);

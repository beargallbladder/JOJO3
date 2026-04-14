# Data Inventory & Architecture Specification

**LongevityPlan.AI — Health Intelligence Platform**

Prepared by: Samson Kim
Date: April 14, 2026 (v3 — post delta review)

---

## Executive Summary

This document specifies the complete data architecture for LongevityPlan.AI: what data we ingest, from where, in what format, how we normalize it against clinical standards, how we store it in a multi-tenant PostgreSQL schema, how we compute intelligence from raw signals, and how we expose it through a REST API.

The architecture was designed schema-first against published clinical data standards (LOINC, FHIR R4, Open mHealth, IEEE 11073, UCUM) so that the transition from synthetic demonstration data to real patient data requires zero schema migration. Every adapter — whether it reads from Oura, a WHOOP strap, or an Epic MyChart FHIR bundle — writes the same row format to the same table.

The system currently runs against a synthetic population of 200 athletes across 90 days producing 157,837 signal events in 60 MB of PostgreSQL storage. This document describes every signal, every source, every table, every API response, and the decisions behind them.

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     LongevityPlan.AI — Data Flow                       │
  │                                                                        │
  │   SOURCES              NORMALIZE           STORE           INTELLIGENCE│
  │                                                                        │
  │  ┌─────────┐                                                           │
  │  │  Oura   │──┐                                                        │
  │  └─────────┘  │       ┌──────────┐     ┌──────────────┐  ┌──────────┐ │
  │  ┌─────────┐  │       │  Source   │     │ health_      │  │ Weighted │ │
  │  │  WHOOP  │──┼──────▶│  Adapter  │────▶│ signal_      │─▶│ Concern  │ │
  │  └─────────┘  │       │          │     │ events       │  │ Score    │ │
  │  ┌─────────┐  │       │ LOINC    │     │              │  │          │ │
  │  │ Garmin  │──┘       │ FHIR R4  │     │ 157K rows    │  │ P, C, S  │ │
  │  └─────────┘          │ UCUM     │     │ 34 signals   │  │ p_var    │ │
  │                       └──────────┘     └──────┬───────┘  └────┬─────┘ │
  │  ┌─────────┐                                  │               │       │
  │  │ Labs    │──┐       ┌──────────┐     ┌──────┴───────┐  ┌───┴──────┐│
  │  │ (Fxn,  │  ├──────▶│  Same    │────▶│ health_      │  │GOVERNANCE││
  │  │  IT)   │──┘       │  Contract│     │ snapshots    │  │          ││
  │  └─────────┘          └──────────┘     └──────────────┘  │ESCALATED ││
  │                                                           │MONITOR   ││
  │  ┌─────────┐          ┌──────────┐     ┌──────────────┐  │SUPPRESSED││
  │  │Self-    │─────────▶│  Manual  │────▶│ subject_     │  └───┬──────┘│
  │  │Report   │          │  Entry   │     │ current_state│      │       │
  │  └─────────┘          └──────────┘     └──────────────┘      │       │
  │                                                               ▼       │
  │                                                         ┌──────────┐ │
  │                                                         │ REST API │ │
  │                                                         │ (Hono)   │ │
  │                                                         └──────────┘ │
  └─────────────────────────────────────────────────────────────────────────┘
```

**v2 changes**: 8 new signals (34 total), FHIR R4-aligned signal_state enum, adverse events table, consent tracking, structured dosing, subject_current_state separation, sex-stratified reference ranges, corrected LOINC codes and clinical ranges, explicit aggregation weights, 14 ESCALATED subjects in demo data.

**v3 changes**: BP signals flagged as inverse (high = bad), vo2_max LOINC clarified as wearable estimate, per-domain coverage floors for ESCALATED eligibility (fixes single-device lockout), `dose_start_date`/`dose_end_date` changed from text to timestamptz, `subject_medications` table added for drug interaction tracking, CGM data sources added (Levels, Stelo, FreeStyle Libre), 173 adverse events seeded (GLP-1 nausea, NAD+ flushing, etc.), coverage recalibration documented.

---

## Table of Contents

1. [Signal Inventory — The 34 Health Signals](#1-signal-inventory)
2. [Data Source Inventory — 30+ Integrations](#2-data-source-inventory)
3. [Standards Alignment — LOINC, FHIR, UCUM](#3-standards-alignment)
4. [Database Schema — 13 Core Tables](#4-database-schema)
5. [Data Volume & Distribution — Current State](#5-data-volume--distribution)
6. [Normalization Pipeline — Source to Storage](#6-normalization-pipeline)
7. [Aggregation Engine — Signals to Concern Score](#7-aggregation-engine)
8. [Health Domains — Signal-to-System Mapping](#8-health-domains)
9. [Protocol Definitions — 11 Peptides](#9-protocol-definitions)
10. [API Surface — What Gets Exposed](#10-api-surface)
11. [PII Classification & HIPAA Posture](#11-pii-classification--hipaa-posture)
12. [Multi-Tenancy Architecture](#12-multi-tenancy-architecture)
13. [Synthetic-to-Real Transition Path](#13-synthetic-to-real-transition-path)
14. [Scaling Projections](#14-scaling-projections)

---

## 1. Signal Inventory

34 discrete health signals, each mapped to a clinical standard identifier (where one exists), a measurement unit, and one or more physiological domains.

### 1.1 Daily Wearable Signals (13 signals)

These arrive once per day from connected wearable devices.

| # | Signal ID | Label | LOINC | Unit (UCUM) | Normal Range | Full Range | Domains |
|---|-----------|-------|-------|-------------|-------------|-----------|---------|
| 1 | `resting_hr` | Resting Heart Rate | 40443-4 | `/min` (bpm) | 60–100 | 38–100 | Cardiovascular, Sleep |
| 2 | `hrv_rmssd` | HRV (RMSSD) | 80404-7 | `ms` | 40–100 | 10–150 | Cardiovascular, Sleep, Cognitive |
| 3 | `sleep_duration` | Sleep Duration | 93810-1 | `min` | 420–540 | 180–660 | Sleep, Cognitive |
| 4 | `sleep_quality` | Sleep Quality Score | — | `{score}` | 70–95 | 10–100 | Sleep |
| 5 | `recovery_score` | Recovery Score | — | `{score}` | 60–95 | 5–100 | Sleep, MSK |
| 6 | `strain_score` | Daily Strain | — | `{score}` | 8–16 | 0–21 | Cardiovascular, MSK |
| 7 | `active_calories` | Active Calories | 41981-2 | `kcal` | 300–800 | 0–2000 | Metabolic, Cardiovascular |
| 8 | `steps` | Daily Steps | 55423-8 | `{steps}` | 7,000–12,000 | 500–30,000 | Metabolic, Cardiovascular |
| 9 | `resting_bp_systolic` | Systolic BP | 8480-6 | `mmHg` | 90–120 | 60–200 | Cardiovascular |
| 10 | `resting_bp_diastolic` | Diastolic BP | 8462-4 | `mmHg` | 60–80 | 40–130 | Cardiovascular |
| 11 | `respiratory_rate` | Respiratory Rate | 9279-1 | `/min` | 12–20 | 6–40 | Cardiovascular, Sleep |
| 12 | `spo2` | SpO2 (Blood Oxygen) | 59408-5 | `%` | 95–100 | 70–100 | Cardiovascular, Sleep |
| 13 | `vo2_max` | VO2 Max (Estimated) | 60842-2 | `mL/kg/min` | 40–60 | 15–90 | Cardiovascular, Metabolic |

**Note on sleep_quality**: Proprietary wearable-derived score. No LOINC mapping — do not map to 93831-7 (Pittsburgh Sleep Quality Index, a validated questionnaire instrument).

**Note on resting_hr**: Normal range is 60–100 (standard clinical reference). For athlete-specific thresholds (40–70 bpm), the aggregation engine uses a separate context flag.

**Note on vo2_max**: LOINC 60842-2 is the correct concept code for maximal oxygen consumption and is retained. However, wearable-estimated VO2max uses HR-based algorithms, not graded exercise testing (gold standard). The value is directional trend data, not a clinical-grade measurement. This is documented in the constants file and should be noted in any clinical reporting context.

**Inverse signals** (high value = elevated concern): `resting_hr`, `resting_bp_systolic`, `resting_bp_diastolic`, `lab_apob`, `lab_crp`, `lab_cortisol`, `lab_a1c`, `lab_thyroid_tsh`, `lab_creatine_kinase`, `lab_fasting_glucose`, `self_pain`. All flagged in the normalization pipeline and aggregation engine.

### 1.2 Body Composition (1 signal)

| # | Signal ID | Label | LOINC | Unit | Normal Range | Full Range | Domains |
|---|-----------|-------|-------|------|-------------|-----------|---------|
| 14 | `body_weight` | Body Weight | 29463-7 | `kg` | — (individualized) | 30–250 | Metabolic |

### 1.3 Daily Nutrition Signals (2 signals)

| # | Signal ID | Label | LOINC | Unit | Normal Range | Full Range | Domains |
|---|-----------|-------|-------|------|-------------|-----------|---------|
| 15 | `nutrition_calories` | Daily Calorie Intake | 9052-2 | `kcal` | 1,800–2,800 | 800–5,000 | Metabolic |
| 16 | `nutrition_protein` | Daily Protein Intake | 74165-2 | `g` | 100–200 | 20–400 | Metabolic, MSK |

### 1.4 Periodic Lab / Biomarker Signals (15 signals)

These arrive every 6–26 weeks from blood panel providers.

| # | Signal ID | Label | LOINC | Unit | Normal Range | Full Range | Sex-Stratified? |
|---|-----------|-------|-------|------|-------------|-----------|-----------------|
| 17 | `lab_a1c` | HbA1c | 4548-4 | `%` | 4.8–5.6 | 3.5–10.0 | No |
| 18 | `lab_testosterone` | Testosterone (Total) | 2986-8 | `ng/dL` | 250–900 (fallback) | 10–1,500 | **Yes**: M 400–900, F 15–70 |
| 19 | `lab_crp` | C-Reactive Protein (hs-CRP) | 1988-5 | `mg/L` | 0.1–1.0 | 0.05–15 | No |
| 20 | `lab_vitamin_d` | Vitamin D, 25-Hydroxy | 14635-7 | `ng/mL` | 30–60 | 5–100 | No |
| 21 | `lab_cortisol` | Cortisol, Morning | 2144-4 | `mcg/dL` | 6–23 | 1–35 | No |
| 22 | `lab_thyroid_tsh` | TSH | 11580-8 | `mIU/L` | 0.5–4.0 | 0.01–20 | No |
| 23 | `lab_hemoglobin` | Hemoglobin | 718-7 | `g/dL` | 12.0–17.5 (fallback) | 7–20 | **Yes**: M 13.5–17.5, F 12.0–15.5 |
| 24 | `lab_hematocrit` | Hematocrit | 4544-3 | `%` | 36–50 | 20–60 | No |
| 25 | `lab_ferritin` | Ferritin | 2276-4 | `ng/mL` | 20–200 | 5–500 | No |
| 26 | `lab_iron` | Iron, Serum | 2498-4 | `mcg/dL` | 60–170 | 10–300 | No |
| 27 | `lab_transferrin_sat` | Transferrin Saturation | 2502-3 | `%` | 20–50 | 5–80 | No |
| 28 | `lab_creatine_kinase` | Creatine Kinase | 2157-6 | `U/L` | 30–200 | 10–2,000 | No |
| 29 | `lab_fasting_glucose` | Fasting Glucose | 1558-6 | `mg/dL` | 70–99 | 40–200 | No |
| 30 | `lab_apob` | Apolipoprotein B | 1884-6 | `mg/dL` | 40–80 | 20–200 | No |
| 31 | `lab_omega3_index` | Omega-3 Index | 53476-7 | `%` | 8–12 | 2–20 | No |

**Clinical corrections applied in v2**: `lab_a1c` lower bound changed from 4.2 to 4.8 (aligns with standard lab floors). `lab_cortisol` upper bound changed from 18 to 23 mcg/dL (aligns with morning reference range consensus). Sex-stratified ranges added for `lab_testosterone` and `lab_hemoglobin` — normalization pipeline uses `normalRangeBySex[subject.sex]` when available.

### 1.5 Self-Report & Practitioner Signals (3 signals)

| # | Signal ID | Label | LOINC | Unit | Normal Range | Full Range |
|---|-----------|-------|-------|------|-------------|-----------|
| 32 | `self_energy` | Self-Reported Energy | — | `{score}` 1–10 | 6–9 | 1–10 |
| 33 | `self_pain` | Self-Reported Pain | 72514-3 | `{score}` 0–10 | 0–2 | 0–10 |
| 34 | `practitioner_note` | Practitioner Observation | 11488-4 | `{text}` | — | — |

**Note on self_energy**: Custom Visual Analog Scale (1–10). Not a validated PROMIS instrument — do not claim psychometric validation.

### 1.6 Signal Cadence Summary

| Cadence | Count | Signals | Est. Events/Athlete/Year |
|---------|-------|---------|--------------------------|
| **Daily** | 16 | resting_hr, hrv_rmssd, sleep_duration, sleep_quality, recovery_score, strain_score, active_calories, steps, nutrition_calories, nutrition_protein, respiratory_rate, spo2, body_weight, resting_bp_systolic, resting_bp_diastolic, vo2_max | ~5,840 |
| **Weekly** | 2 | self_energy, self_pain | ~104 |
| **Periodic lab** | 15 | All lab_* signals | ~30–120 |
| **Event** | 1 | practitioner_note | Variable |
| | **34** | | **~6,000/year** |

---

## 2. Data Source Inventory

30 named data sources across 7 categories. Each source has a defined authentication mechanism, the specific signals it provides, its data arrival cadence, and its integration status.

### 2.1 Wearable Devices (8 sources)

| Source | Auth | Signals Provided | Status |
|--------|------|-----------------|--------|
| **Oura Ring** | OAuth 2.0 | sleep_duration, sleep_quality, hrv_rmssd, resting_hr, recovery_score, respiratory_rate, spo2 | Planned — Phase 1 |
| **WHOOP** | OAuth 2.0 | strain_score, recovery_score, sleep_duration, sleep_quality, hrv_rmssd, resting_hr, spo2, respiratory_rate | Planned — Phase 1 |
| **Garmin** | OAuth 2.0 | resting_hr, hrv_rmssd, sleep_duration, sleep_quality, active_calories, steps, strain_score, vo2_max, respiratory_rate, spo2, body_weight, resting_bp_systolic, resting_bp_diastolic | Planned — Phase 1 |
| **Apple Watch** | OAuth 2.0 (HealthKit) | resting_hr, hrv_rmssd, active_calories, steps, sleep_duration, spo2, respiratory_rate, vo2_max | Planned — Phase 2 |
| **Fitbit** | OAuth 2.0 | resting_hr, hrv_rmssd, sleep_duration, sleep_quality, active_calories, steps, recovery_score, spo2 | Planned — Phase 2 |
| **Samsung Health** | OAuth 2.0 | resting_hr, sleep_duration, active_calories, steps, spo2, body_weight | Future |
| **Polar** | OAuth 2.0 | resting_hr, hrv_rmssd, strain_score, recovery_score, sleep_quality | Future |
| **COROS** | OAuth 2.0 | resting_hr, hrv_rmssd, strain_score, sleep_duration, active_calories, vo2_max | Future |

### 2.2 Biomarker / Lab Providers (6 sources)

| Source | Auth | Cadence | Signals | Status |
|--------|------|---------|---------|--------|
| **Function Health** | API Key | Quarterly | All 15 lab signals | Planned — Phase 1 |
| **InsideTracker** | API Key | Biannual | All 15 lab signals | Planned — Phase 1 |
| **Wild Health** | API Key | Quarterly | All 15 lab signals | Planned — Phase 2 |
| **Quest Diagnostics** | FHIR R4 | Biannual | All 15 lab signals | Future |
| **Labcorp** | FHIR R4 | Biannual | All 15 lab signals | Future |
| **Marek Health** | API Key | 6-week cycle | 14 lab signals | Future |

### 2.3 Continuous Glucose Monitors (3 sources)

| Source | Auth | Signals | Status |
|--------|------|---------|--------|
| **Levels Health** | OAuth 2.0 | lab_fasting_glucose (continuous) | Future |
| **Dexcom Stelo** | OAuth 2.0 | lab_fasting_glucose (continuous) | Future |
| **FreeStyle Libre** | API Key | lab_fasting_glucose (continuous) | Future |

For a platform with Tirzepatide and Semaglutide as primary GLP-1 protocols, CGM integration is a near-term priority. Levels and Stelo both have documented APIs. Continuous glucose data would replace the periodic lab cadence for `lab_fasting_glucose` with 5-minute resolution data, dramatically improving metabolic domain coverage and time-to-escalation for metabolic emergencies.

### Signal Coverage by Source (Wearables)

```
                     Oura  WHOOP  Garmin  Apple  Fitbit  CGM*
  resting_hr          ●      ●      ●      ●      ●
  hrv_rmssd           ●      ●      ●      ●      ●
  sleep_duration      ●      ●      ●      ●      ●
  sleep_quality       ●      ●      ●             ●
  recovery_score      ●      ●                    ●
  strain_score               ●      ●
  active_calories                   ●      ●      ●
  steps                             ●      ●      ●
  respiratory_rate    ●      ●      ●      ●
  spo2                ●      ●      ●      ●      ●
  vo2_max                           ●      ●
  resting_bp_sys                    ●
  resting_bp_dia                    ●
  body_weight                       ●                    
  lab_fasting_glu                                         ●
  ─────────────────────────────────────────────────────────
  Signals provided:   7      9     13      8      8      1

  ● = signal provided by source     * = Future (Levels, Stelo, Libre)
```

### 2.4–2.7 Training, Nutrition, EHR, Self-Report (10 sources)

| Category | Sources | Auth | Signals | Status |
|----------|---------|------|---------|--------|
| Training | Strava, TrainingPeaks, Peloton, Strong/Hevy | OAuth / API Key | calories, strain, steps | Planned/Future |
| Nutrition | MyFitnessPal, Cronometer, MacroFactor, Carbon | OAuth / API Key | calories, protein | Planned/Future |
| EHR | Epic MyChart, Oracle Health (Cerner) | FHIR R4 | Lab signals via Observation | Future |
| Self-Report | In-app, Practitioner Entry | Manual | energy, pain, notes | Phase 1 |

---

## 3. Standards Alignment

### 3.1 Signal Level → LOINC + UCUM

All 34 signals are mapped. 25 signals carry LOINC codes. 9 proprietary/derived scores (sleep_quality, recovery_score, strain_score, self_energy, etc.) are explicitly marked `loinc: null` with comments documenting why no mapping exists. `vo2_max` carries LOINC 60842-2 (correct concept code) with a method qualifier noting that wearable estimates are HR-based, not graded exercise tests.

### 3.2 Record Level → FHIR R4 Observation

Every row in `health_signal_events` maps 1:1 to a FHIR R4 Observation resource.

**v2 correction**: The `signal_state` enum now uses the FHIR R4 Observation.status value set:

| FHIR R4 Status | Our Usage | Previous Value |
|----------------|-----------|---------------|
| `final` | Confirmed measurement | Was `present` |
| `preliminary` | Unverified / in-progress | New |
| `cancelled` | Measurement cancelled/void | Was `absent` |
| `unknown` | Status not known | Unchanged |
| `registered` | Registered but not yet resulted | New |
| `amended` | Measurement corrected | New |
| `corrected` | Correction of prior error | New |
| `entered-in-error` | Should not be used for clinical decisions | New |

### 3.3 Patient Level → FHIR R4 Patient

`subjects` table maps to FHIR R4 Patient. No changes from v1.

### 3.4 Organization Level → FHIR R4 Organization

`organizations` table maps to FHIR R4 Organization. Now includes BAA tracking fields.

---

## 4. Database Schema

13 core tables in PostgreSQL 16. Every table carries `org_id` for tenant isolation.

### 4.1 `health_signal_events` — The Core Asset

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `subject_id` | uuid | NOT NULL | — | FK → subjects |
| `org_id` | uuid | NOT NULL | — | FK → organizations |
| `signal_name` | text | NOT NULL | — | One of 34 signal IDs |
| `signal_state` | enum | NOT NULL | — | FHIR R4: final / preliminary / cancelled / unknown / etc. |
| `confidence` | real | NOT NULL | 0.5 | Source confidence (0–1) |
| `source_type` | text | NOT NULL | — | oura / whoop / garmin / etc. |
| `raw_value` | real | NULL | — | Measurement in native unit |
| `unit` | text | NOT NULL | '' | UCUM unit string |
| `normalized_value` | real | NOT NULL | 0.5 | Mapped 0–1 within full physiological range |
| `occurred_at` | timestamptz | NOT NULL | — | When measurement was taken |
| `metadata` | jsonb | NULL | '{}' | Extensible |

**Indexes**: PK, `(subject_id, signal_name, occurred_at)`, `(org_id, occurred_at)`.

### 4.2 `subjects` — Athlete Profiles

Contains demographic/profile data. Posterior state fields (`posterior_p`, `posterior_p_var`, etc.) are **deprecated** on this table — see `subject_current_state` (Section 4.5). Kept for migration compatibility.

### 4.3 `health_snapshots` — Concern Score Timeline

One row per subject × domain × time frame.

### 4.4 `protocol_assignments` — What's Prescribed

Now includes structured dosing columns alongside deprecated `dosing_notes`:

| New Column | Type | Description |
|------------|------|-------------|
| `dose_amount` | real | e.g., 2.5 |
| `dose_unit` | text | 'mg', 'mcg', 'mL', 'IU' |
| `dose_frequency` | text | 'daily' / 'weekly' / 'biweekly' / 'as_needed' |
| `dose_route` | text | 'SubQ' / 'intranasal' / 'oral' / 'IV' / 'topical' |
| `dose_start_date` | timestamptz | Dosing start date |
| `dose_end_date` | timestamptz | Dosing end date (NULL if ongoing) |

### 4.5 `subject_medications` — Drug/Supplement Tracking (NEW — v3)

Tracks current medications, supplements, and peptides per subject. Enables upstream contraindication checking at protocol assignment time rather than relying solely on after-the-fact adverse event capture.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → subjects |
| `org_id` | uuid | Tenant isolation |
| `name` | text | Drug/supplement name |
| `rxcui` | text | RxNorm concept ID (optional, for NLM interaction API) |
| `category` | text | `prescription` / `otc` / `supplement` / `peptide` |
| `dose_amount` | real | |
| `dose_unit` | text | |
| `frequency` | text | `daily` / `weekly` / `as_needed` / `prn` |
| `route` | text | `oral` / `SubQ` / `topical` / `IV` |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz | |
| `prescriber` | text | |
| `status` | text | `active` / `discontinued` / `paused` |
| `notes` | text | |

**Indexes**: `(subject_id, status)` for active medication lookup.

**Future integration**: The `rxcui` field supports integration with NLM RxNorm interaction APIs for automated contraindication flagging at protocol assignment time.

### 4.6 `subject_current_state` — Live Computed State (NEW — v2)

Decoupled from `subjects` to eliminate write contention on the profile row during posterior updates.

| Column | Type | Description |
|--------|------|-------------|
| `subject_id` | uuid | PK, FK → subjects |
| `org_id` | uuid | Tenant isolation |
| `posterior_p` | real | Concern score (0–1) |
| `posterior_p_var` | real | Precision of P estimate (0–0.25) |
| `posterior_c` | real | Evidence coverage (0–1) |
| `posterior_s` | real | Staleness (0–1) |
| `governance_band` | text | ESCALATED / MONITOR / SUPPRESSED |
| `governance_reason` | text | Human-readable |
| `primary_domain` | text | Dominant health domain |
| `last_signal_at` | timestamptz | Most recent data point |
| `computed_at` | timestamptz | When this state was computed |

### 4.7 `adverse_events` — Protocol Side Effects (NEW — v2)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → subjects |
| `org_id` | uuid | Tenant isolation |
| `protocol_id` | text | Which peptide caused it |
| `event_type` | text | 'nausea', 'injection_site_reaction', etc. |
| `severity` | text | 'mild' / 'moderate' / 'severe' (enforced by CHECK) |
| `onset_at` | timestamptz | When symptoms started |
| `resolved_at` | timestamptz | When resolved (NULL if ongoing) |
| `notes` | text | Free text |
| `reported_by` | text | 'subject' / 'practitioner' / 'system' |

**Indexes**: `(subject_id, onset_at)`, `(org_id, onset_at)`.

### 4.8 `subject_consents` — Data Consent Tracking (NEW — v2)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → subjects |
| `org_id` | uuid | Tenant isolation |
| `consent_type` | text | 'data_collection' / 'protocol_enrollment' / 'third_party_sharing' / 'research_use' |
| `consented` | boolean | |
| `consented_at` | timestamptz | |
| `revoked_at` | timestamptz | NULL if active |
| `consent_version` | text | Version of consent form |
| `ip_address` | text | For audit trail |

**Index**: `(subject_id, consent_type)`.

### 4.9 `health_governance_actions` — Action Log

Records every governance-triggered action (escalation recommendations, monitoring flags). One row per non-SUPPRESSED governance evaluation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → subjects |
| `org_id` | uuid | Tenant isolation |
| `action_type` | text | `recommend_intervention` (ESCALATED) / `monitor` (MONITOR) |
| `reason` | text | Governance reason string (human-readable) |
| `triggered_by` | text | `governance_engine` / `practitioner` / `system` |
| `metadata` | jsonb | Extensible context |
| `created_at` | timestamptz | When the action was generated |

**Current state**: 48 seeded rows (14 ESCALATED + 34 MONITOR subjects).

### 4.10 Other Tables

- **`subject_data_sources`** — Connected platforms (now with `created_at`, `updated_at`). OAuth tokens must NOT be stored plaintext in production — `metadata` field holds only a secret manager reference key.
- **`organizations`** — Now includes `baa_status` ('unsigned'/'pending'/'signed'/'expired'), `baa_signed_at`, `baa_document_ref`, and `updated_at`.
- **`practitioners`** — Now includes `created_at`, `updated_at`.
- **`audit_log`** — HIPAA audit trail. Now indexed: `(org_id, created_at DESC)`, `(actor_id, created_at DESC)`, `(phi_accessed, created_at DESC) WHERE phi_accessed = 1`, `(resource_type, resource_id)`.

### 4.11 Entity Relationship Summary

```
organizations (1)
  │
  ├── subjects (N)
  │     ├── health_signal_events (N)          ← raw measurements
  │     ├── health_snapshots (N)              ← concern score timeline per domain
  │     ├── subject_current_state (1)         ← live computed state (NEW)
  │     ├── protocol_assignments (1–5)        ← active protocols + structured dosing
  │     ├── subject_medications (0–N)         ← current drugs/supplements (NEW v3)
  │     ├── subject_data_sources (2–5)        ← connected wearables + labs
  │     ├── adverse_events (0–N)              ← protocol side effects
  │     ├── subject_consents (0–N)            ← consent records
  │     └── health_governance_actions (N)     ← action log
  │
  ├── practitioners (N)
  │
  └── audit_log (append-only)
```

---

## 5. Data Volume & Distribution

Current state: 200 synthetic athletes, 90-day window (Jan 13 – Apr 13, 2026).

### 5.1 Table Sizes

| Table | Rows | Disk Size |
|-------|------|-----------|
| health_signal_events | 157,837 | 50 MB |
| health_snapshots | 2,479 | 1.2 MB |
| subject_data_sources | 861 | 208 KB |
| protocol_assignments | 501 | 160 KB |
| subjects | 200 | 144 KB |
| subject_current_state | 200 | 88 KB |
| practitioners | 12 | 32 KB |
| health_governance_actions | 48 | 32 KB |
| adverse_events | 173 | 48 KB |
| subject_medications | 501 | 80 KB |
| subject_consents | 0 | 24 KB |
| audit_log | 0 | 48 KB |
| **Total database** | **162,812** | **60 MB** |

Subject medications seeded 1:1 from active protocol assignments — every prescribed peptide has a corresponding medication record.

### 5.2 Governance Distribution

| Band | Count | % |
|------|-------|---|
| ESCALATED | 14 | 7% |
| MONITOR | 34 | 17% |
| SUPPRESSED | 152 | 76% |

```
  Governance Band Distribution (200 athletes)

  ESCALATED  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  14  ( 7%)
  MONITOR    █████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  34  (17%)
  SUPPRESSED ████████████████████████████████████████████████ 152  (76%)
             ├─────────┼─────────┼─────────┼─────────┼──────┤
             0        50       100       150       200
```

ESCALATED subjects distributed across cardiovascular, metabolic, and musculoskeletal domains.

### 5.3 Adverse Event Distribution (v3)

```
  Adverse Events by Protocol (173 total, 107 subjects affected)

  NAD+         ███████████████████████████████████████  69  (40%)
  Tirzepatide  ███████████████████████████░░░░░░░░░░░  54  (31%)
  Sermorelin   █████████████████████░░░░░░░░░░░░░░░░░  38  (22%)
  Semaglutide  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12  ( 7%)

  Top event types: nausea (55), flushing (54), injection site (31)
```

---

## 6. Normalization Pipeline

Every data source writes the same row format. The normalization contract:

```
Vendor payload → Source Adapter → {
  signal_name     (LOINC-aligned ID)
  raw_value       (native unit measurement)
  unit            (UCUM standard)
  normalized_value ((raw - fullRange.min) / (fullRange.max - fullRange.min), 0–1)
  source_type     (vendor identifier)
  occurred_at     (ISO 8601)
  confidence      (source-assigned, 0–1)
  signal_state    'final' (FHIR R4 Observation.status)
}
→ INSERT INTO health_signal_events
```

**Sex-stratified normalization**: For `lab_testosterone` and `lab_hemoglobin`, the pipeline uses `normalRangeBySex[subject.sex]` when computing deviation scores. Falls back to the generic `normalRange` when sex is unknown or 'other'.

---

## 7. Aggregation Engine

Raw signal events become actionable intelligence through a weighted concern score computation with precision estimate.

```
  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ 1.COLLECT│──▶│ 2.COUNT  │──▶│ 3.STALE  │──▶│ 4.CONCERN│──▶│5.PRECISION──▶│ 6.GOVERN │
  │          │   │          │   │          │   │          │   │          │   │          │
  │ Query    │   │ Coverage │   │ Freshness│   │ Weighted │   │ Variance │   │ Band     │
  │ 90-day   │   │ C = n/N  │   │ S = age  │   │ P = Σwᵢdᵢ│   │ p_var    │   │ Rules    │
  │ window   │   │          │   │    /90   │   │   /Σwᵢ  │   │ [0,0.25] │   │          │
  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                     │                             │
                                                     ▼                             ▼
                                              ┌─────────────┐              ┌──────────────┐
                                              │ Inverse     │              │ ESCALATED    │
                                              │ signals     │              │ P≥.85 C≥.70  │
                                              │ flipped so  │              │ S≤14d        │
                                              │ high = bad  │              │──────────────│
                                              └─────────────┘              │ MONITOR      │
                                                                           │ P≥.60 C≥.60  │
                                                                           │──────────────│
                                                                           │ SUPPRESSED   │
                                                                           │ C<.50 or     │
                                                                           │ stale>60d    │
                                                                           └──────────────┘
```

### Step 1 — COLLECT
Query `health_signal_events` for a subject within a domain's signal set over a 90-day window.

### Step 2 — COUNT (Coverage: C)
**C = signals_present / signals_expected**

Domain expected counts: Cardiovascular 17, Metabolic 12, Hormonal 4, MSK 9, Sleep 8, Cognitive 4.

### Step 3 — STALE (Freshness: S)
**S = days_since_last / 90** (clamped 0–1)

### Step 4 — CONCERN (Weighted Score: P)

**P = Σ(weight_i × deviation_i) / Σ(weight_i)**

Where `deviation_i` is the normalized distance from normal range for signal `i` (0 = within range, 1 = at physiological extreme).

**Inverse signals** (high value = elevated concern, deviation is flipped): `resting_hr`, `resting_bp_systolic`, `resting_bp_diastolic`, `lab_apob`, `lab_crp`, `lab_cortisol`, `lab_a1c`, `lab_thyroid_tsh`, `lab_creatine_kinase`, `lab_fasting_glucose`, `self_pain`. This list is maintained in both the seed generator and the intelligence route.

Explicit weights are defined per domain in `packages/shared/src/constants/aggregation-weights.ts`. Example (cardiovascular):

| Signal | Weight |
|--------|--------|
| hrv_rmssd | 0.14 |
| resting_hr | 0.10 |
| lab_hemoglobin | 0.10 |
| vo2_max | 0.06 |
| resting_bp_systolic | 0.06 |
| lab_hematocrit | 0.06 |
| lab_ferritin | 0.06 |
| strain_score | 0.06 |
| resting_bp_diastolic | 0.05 |
| spo2 | 0.05 |
| steps | 0.04 |
| active_calories | 0.04 |
| lab_iron | 0.04 |
| lab_transferrin_sat | 0.04 |
| lab_apob | 0.04 |
| respiratory_rate | 0.04 |
| lab_omega3_index | 0.02 |
| **Total** | **1.00** |

Weights are validated at module load — a runtime assertion throws if any domain's weights don't sum to 1.0.

### Step 5 — PRECISION (Variance: p_var)
**p_var** ∈ [0, 0.25] (Bernoulli maximum variance).
Combines signal count, cross-signal consistency, and staleness penalty.
- p_var ≤ 0.06 → "High confidence"
- p_var ≤ 0.14 → "Moderate confidence"
- p_var > 0.14 → "Limited data — more signals needed"

### Step 6 — GOVERN

Deterministic rules with documented thresholds:

| Band | Rule | Rationale |
|------|------|-----------|
| **ESCALATED** | P ≥ 0.85 AND C ≥ 0.70 AND S ≤ 14 days | Top ~15% concern with ≥70% signal coverage and fresh data. Practitioner intervention warranted. |
| **MONITOR** | P ≥ 0.60 AND C ≥ 0.60 | Top ~40% concern with moderate evidence. Building picture. |
| **SUPPRESSED** | C < 0.50 OR staleness > 60 days OR below thresholds | Not enough data to act, or concern below threshold. |

**Per-domain coverage floors for ESCALATED** (v3 fix):

The flat C ≥ 0.70 threshold creates a structural lockout for large domains when users have a single data source. Cardiovascular has 17 expected signals, requiring 12 present — but a single wearable (Oura, WHOOP) provides 6–9 cardiovascular signals max. An athlete on one device can never reach ESCALATED regardless of signal severity. To fix this, the engine uses absolute minimum signal counts per domain:

| Domain | Expected Signals | Min for ESCALATED | Achievable With |
|--------|-----------------|-------------------|-----------------|
| Cardiovascular | 17 | 6 | 1 wearable + 1 lab panel |
| Metabolic | 12 | 5 | 1 nutrition app + 1 lab panel |
| Hormonal | 4 | 3 | 3 of 4 hormone labs |
| Musculoskeletal | 9 | 5 | 1 wearable + self-report + 1 lab |
| Sleep & Recovery | 8 | 4 | Any single wearable |
| Cognitive & Stress | 4 | 3 | 1 wearable + self-report |

These are defined in `MIN_SIGNALS_FOR_ESCALATION` in `aggregation-weights.ts`. The percentage-based C threshold (0.70) still applies as a secondary check when signal count exceeds the minimum — but the absolute floor ensures single-device users are never structurally excluded from escalation.

**Coverage recalibration note**: The p_var confidence bands (≤ 0.06 = high, ≤ 0.14 = moderate) were originally calibrated against smaller domain signal counts (e.g., cardiovascular = 10). With 17 expected cardiovascular signals, the same p_var thresholds may produce different confidence interpretations. These bands should be recalibrated against the new signal counts in a future calibration pass once real multi-source data is available.

**Note**: This is a weighted score with precision estimate — not a Bayesian posterior with an explicit prior/likelihood update formula. The "posterior" naming in the codebase is a legacy label. The computation is: weighted mean of signal deviations + a confidence/variance term + deterministic governance rules. No model training, no learned parameters.

---

## 8. Health Domains

6 physiological domains with updated signal counts reflecting the 8 new signals:

| Domain | Expected Signals (N) | Contributing Signals |
|--------|---------------------|---------------------|
| **Cardiovascular** | 17 | resting_hr, hrv_rmssd, strain_score, active_calories, steps, resting_bp_systolic, resting_bp_diastolic, respiratory_rate, spo2, vo2_max, lab_hemoglobin, lab_hematocrit, lab_ferritin, lab_iron, lab_transferrin_sat, lab_apob, lab_omega3_index |
| **Metabolic** | 12 | lab_a1c, active_calories, steps, nutrition_calories, nutrition_protein, lab_crp, lab_thyroid_tsh, lab_fasting_glucose, body_weight, vo2_max, lab_apob, lab_omega3_index |
| **Hormonal** | 4 | lab_testosterone, lab_vitamin_d, lab_cortisol, lab_thyroid_tsh |
| **Musculoskeletal** | 9 | strain_score, recovery_score, self_pain, lab_crp, lab_testosterone, lab_vitamin_d, nutrition_protein, lab_creatine_kinase, lab_ferritin |
| **Sleep & Recovery** | 8 | sleep_duration, sleep_quality, recovery_score, resting_hr, hrv_rmssd, self_energy, respiratory_rate, spo2 |
| **Cognitive & Stress** | 4 | hrv_rmssd, sleep_duration, self_energy, lab_cortisol |

---

## 9. Protocol Definitions

11 peptide therapy protocols. No changes from v1 — see PRD for full detail.

---

## 10. API Surface

REST API (Hono framework, TypeScript). All responses wrapped in `{ data: T, meta?: {} }` envelope. Payload measurements from v1 remain approximately the same (~78 KB for full coach session). Signal count increase adds ~5–10% to the signals endpoint payload.

---

## 11. PII Classification & HIPAA Posture

### 11.1 PHI Field Inventory

| Field | Table | Classification | Current State | Production Requirement |
|-------|-------|---------------|---------------|----------------------|
| `display_name` | subjects | **PHI** | Plaintext | AES-256-GCM |
| `date_of_birth` | subjects | **PHI** | Plaintext (text) | Encrypted |
| `contact` (future) | subjects | **PHI** | Not created | Encrypted from birth |
| `sex` | subjects | **PHI** (in combination) | Enum | Context-dependent |
| OAuth tokens | subject_data_sources.metadata | **Sensitive** | JSONB | Secrets manager ref only |

Database column comments document PHI encryption requirements.

### 11.2 Multi-Tenancy

Three-layer isolation: app-level `WHERE org_id = ?` + planned PostgreSQL RLS + audit trail.

### 11.3 Consent Architecture (NEW)

The `subject_consents` table tracks four consent types: `data_collection`, `protocol_enrollment`, `third_party_sharing`, `research_use`. Each has a versioned consent record with timestamp, revocation support, and IP capture.

### 11.4 Outstanding Compliance Items

| Item | Status | Remediation |
|------|--------|-------------|
| BAA workflow | Schema ready (`baa_status` on organizations) | Implement status transitions + document storage integration |
| Consent enforcement | Table built, no enforcement logic | Add middleware to check active consent before data operations |
| OAuth token secrets | Documented in code comments | Integrate AWS Secrets Manager or Vault; store refs only in metadata |
| Audit log enforcement | Schema + indexes built | Add audit middleware to PHI-touching routes |
| Data retention policy | Not defined | Define TTL per data type; implement purge job |
| PHI encryption | Fields identified, comments added | Implement app-level AES-256-GCM or pgcrypto |
| Adverse event reporting | Table built, seeded (173 events) | Define regulatory reporting workflow (if applicable) |
| Drug interaction checking | Table built (`subject_medications`), `rxcui` field ready | Integrate NLM RxNorm interaction API; add contraindication check at protocol assignment |
| CGM integration | 3 future sources defined (Levels, Stelo, Libre) | Build OAuth adapters; upgrade lab_fasting_glucose to continuous cadence |
| Menstrual cycle tracking | Not implemented | Add cycle phase signal for female athletes; affects hormonal domain scoring |
| p_var recalibration | Bands unchanged after domain signal count expansion | Recalibrate confidence thresholds against actual multi-source data |

---

## 12. Multi-Tenancy Architecture

No changes from v1. `org_id` on every table, app-level filtering, planned RLS.

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    Multi-Tenancy Isolation                      │
  │                                                                 │
  │  Layer 1: Application        Layer 2: Database    Layer 3: Audit│
  │  ─────────────────────       ──────────────────   ─────────────│
  │                                                                 │
  │  ┌─────────────────┐         ┌───────────────┐   ┌───────────┐│
  │  │ Every query      │         │ PostgreSQL    │   │ audit_log ││
  │  │ includes:        │         │ RLS policies  │   │           ││
  │  │                  │         │               │   │ who       ││
  │  │ WHERE org_id =   │────────▶│ org_id =      │──▶│ what      ││
  │  │   ctx.org_id     │         │   current_    │   │ when      ││
  │  │                  │         │   setting()   │   │ phi?      ││
  │  └─────────────────┘         └───────────────┘   └───────────┘│
  │        ▲                           ▲                    ▲      │
  │        │                           │                    │      │
  │    IMPLEMENTED               PLANNED (v4)          SCHEMA READY│
  └─────────────────────────────────────────────────────────────────┘
```

---

## 13. Synthetic-to-Real Transition Path

No structural changes. The 8 new signals follow the same adapter contract. The `adverse_events` table now has 173 seeded events (GLP-1 nausea, NAD+ flushing, injection site reactions) — clinically realistic for the protocol mix. `subject_consents` and `subject_medications` will be populated by real user interactions.

---

## 14. Scaling Projections

| Scale | Athletes | Signal Events | Est. DB Size | Notes |
|-------|----------|--------------|-------------|-------|
| Demo | 200 | 158K | 60 MB | Current synthetic data |
| Pilot (1 clinic) | 500 | 3M | ~900 MB | ~6K events/athlete/yr (16 daily + 15 periodic lab + 3 weekly) |
| Growth (10 clinics) | 5,000 | 30M | ~9 GB | Partition by org_id; add read replicas |
| Scale (100 clinics) | 50,000 | 300M | ~90 GB | TimescaleDB hypertables on signal_events |
| Enterprise | 500,000 | 3B | ~900 GB | Partition by org_id + date range |

```
  DB Size Growth Trajectory

  900 GB ┤                                                         ╭── Enterprise
         │                                                        ╱    (500K athletes)
         │                                                       ╱
  90 GB  ┤                                              ╭───────╯ Scale
         │                                             ╱           (50K athletes)
         │                                            ╱
  9 GB   ┤                                  ╭────────╯ Growth
         │                                 ╱               (5K athletes)
         │                                ╱
  900 MB ┤                      ╭────────╯ Pilot
         │                     ╱               (500 athletes)
  60 MB  ┤─────────────────────╯ Demo (200 athletes)
         ├──────────┬──────────┬──────────┬──────────┬──────────
         Demo     Pilot     Growth     Scale    Enterprise
```

---

*End of specification.*

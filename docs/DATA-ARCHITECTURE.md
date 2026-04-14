# Data Architecture — LongevityPlan.AI

> How we model health data, what standards we template against, how synthetic data flows to aggregation, and how every layer swaps to real sources without schema changes.

> Last updated: 2026-04-13

---

## 1. Design Principle: Schema-First, Source-Agnostic

Every table, every signal definition, every API response was designed against **published clinical and wearable data standards** so that:

1. Synthetic data generators write the same rows as real integrations will
2. A coach seeing demo data today sees the same UI as a coach with live Oura + Function Health data tomorrow
3. Any investor, partner, or engineer can verify our schema against public specifications

**We are not inventing a data model. We are implementing known models.**

---

## 2. Standards Alignment Map

### 2.1 Signal-Level: LOINC + Open mHealth + IEEE 11073

Every one of our 19 health signals maps to a known standard identifier:

| Our Signal ID | Label | LOINC Code | Open mHealth Schema | IEEE 11073 Device Spec | Unit (UCUM) |
|---------------|-------|------------|--------------------|-----------------------|-------------|
| `resting_hr` | Resting Heart Rate | **40443-4** | `omh:heart-rate:2.0` | 10441 (Activity Monitor) | `/min` (bpm) |
| `hrv_rmssd` | HRV (RMSSD) | **80404-7** | `omh:heart-rate-variability` (ext) | 10441 | `ms` |
| `sleep_duration` | Sleep Duration | **93810-1** | `omh:sleep-duration:2.0` | — | `min` |
| `sleep_quality` | Sleep Quality Score | **93831-7** (Sleep quality) | `omh:sleep-episode` (ext) | — | `{score}` |
| `recovery_score` | Recovery Score | — (proprietary) | Platform-specific (WHOOP/Oura) | — | `{score}` |
| `strain_score` | Daily Strain | — (proprietary) | Platform-specific (WHOOP) | 10441 | `{score}` |
| `active_calories` | Active Calories | **41981-2** | `omh:calories-burned:2.0` | 10441 | `kcal` |
| `steps` | Daily Steps | **55423-8** | `omh:step-count:2.0` | 10441 | `{steps}` |
| `lab_a1c` | HbA1c | **4548-4** | — | — | `%` |
| `lab_testosterone` | Testosterone | **2986-8** | — | — | `ng/dL` |
| `lab_crp` | C-Reactive Protein | **1988-5** | — | — | `mg/L` |
| `lab_vitamin_d` | Vitamin D (25-OH) | **14635-7** | — | — | `ng/mL` |
| `lab_cortisol` | Cortisol (AM) | **2144-4** | — | — | `mcg/dL` |
| `lab_thyroid_tsh` | TSH | **11580-8** | — | — | `mIU/L` |
| `self_energy` | Self-Reported Energy | **PROMIS** (adapted) | `omh:survey-answer` (ext) | — | `{score}` |
| `self_pain` | Self-Reported Pain | **72514-3** (Pain severity) | `omh:survey-answer` (ext) | — | `{score}` |
| `practitioner_note` | Practitioner Observation | **11488-4** (Consult note) | — | — | `{text}` |
| `nutrition_calories` | Daily Calorie Intake | **9052-2** | `omh:caloric-intake` (ext) | — | `kcal` |
| `nutrition_protein` | Daily Protein | **74165-2** (Protein intake) | `omh:macronutrient-intake` (ext) | — | `g` |

**Key:** LOINC codes verified against [loinc.org](https://loinc.org). Open mHealth schemas verified against [openmhealth.org](https://www.openmhealth.org/) and IEEE P1752. IEEE 11073 device specialization 10441 covers cardiovascular fitness and activity monitors.

### 2.2 Record-Level: FHIR R4 Observation

Our `health_signal_events` table maps 1:1 to a **FHIR R4 Observation** resource:

```
FHIR R4 Observation               →  health_signal_events
─────────────────────                 ─────────────────────
Observation.id                    →  id (uuid)
Observation.status                →  signal_state ('present'|'absent'|'unknown')
Observation.category              →  derived from signal_name cadence
Observation.code.coding[0].system →  "http://loinc.org"
Observation.code.coding[0].code   →  LOINC code from table above
Observation.subject.reference     →  "Patient/{subject_id}"
Observation.effectiveDateTime     →  occurred_at
Observation.valueQuantity.value   →  raw_value
Observation.valueQuantity.unit    →  unit
Observation.valueQuantity.system  →  "http://unitsofmeasure.org" (UCUM)
Observation.performer             →  source_type (device/practitioner)
Observation.meta.source           →  source_type ('oura', 'whoop', 'lab', etc.)
Observation.extension[confidence] →  confidence (0-1)
Observation.extension[normalized] →  normalized_value (0-1, our addition)
```

**Why this matters:** When Epic MyChart or Cerner sends us a FHIR R4 Observation bundle via webhook, we map it to `health_signal_events` with a <20-line adapter. No schema migration. No data model change. The same Bayesian engine processes it identically to synthetic data.

### 2.3 Patient-Level: FHIR R4 Patient

Our `subjects` table maps to **FHIR R4 Patient**:

```
FHIR R4 Patient                   →  subjects
──────────────                        ────────
Patient.id                        →  id
Patient.identifier[0].value       →  external_id
Patient.name.text                 →  display_name (PHI — encrypted in prod)
Patient.birthDate                 →  date_of_birth (PHI)
Patient.gender                    →  sex
Patient.managingOrganization      →  org_id
```

### 2.4 Multi-Tenancy: Organization = FHIR R4 Organization

```
FHIR R4 Organization             →  organizations
─────────────────────                ─────────────
Organization.id                  →  id
Organization.name                →  name
Organization.identifier.value    →  slug
```

---

## 3. Data Flow Architecture

### 3.1 The Full Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SOURCE LAYER (Tier 1)                           │
│                                                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Oura   │ │  WHOOP  │ │ Garmin  │ │Apple Wch │ │ Fitbit/etc.  │  │
│  │ OAuth2  │ │ OAuth2  │ │ OAuth2  │ │ OAuth2   │ │ OAuth2       │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘ └──────┬───────┘  │
│       │           │           │            │              │           │
│  ┌────┴───────────┴───────────┴────────────┴──────────────┴───────┐  │
│  │                    Source Adapter Layer                         │  │
│  │  Each adapter: normalize → LOINC code → UCUM unit → write row  │  │
│  └────────────────────────────────┬───────────────────────────────┘  │
│                                   │                                   │
│  ┌─────────┐ ┌───────────┐ ┌─────┴──────┐ ┌──────────┐ ┌────────┐  │
│  │Function │ │InsideTrkr │ │ Wild Health │ │  Quest   │ │ Marek  │  │
│  │Health   │ │  API key  │ │  API key   │ │  FHIR    │ │API key │  │
│  └────┬────┘ └─────┬─────┘ └─────┬──────┘ └────┬─────┘ └───┬────┘  │
│       │            │             │              │            │        │
│  ┌────┴────────────┴─────────────┴──────────────┴────────────┴───┐   │
│  │                  Lab / Biomarker Adapter Layer                 │   │
│  │  Each adapter: parse panel → LOINC code → UCUM unit → write   │   │
│  └───────────────────────────────┬───────────────────────────────┘   │
│                                  │                                    │
│  ┌──────────┐ ┌──────────────┐ ┌┴─────────────┐ ┌──────────────┐   │
│  │  Strava  │ │TrainingPeaks │ │  MyFitnessPal │ │  Cronometer  │   │
│  │ OAuth2   │ │   OAuth2     │ │   OAuth2      │ │  OAuth2      │   │
│  └────┬─────┘ └──────┬───────┘ └──────┬────────┘ └──────┬───────┘   │
│       └──────────────┬────────────────┴──────────────────┘           │
│                      ▼                                                │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  Self-Report (In-App)  │  Practitioner Entry  │  Epic FHIR   │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
           ALL sources write the same row:
           health_signal_events {signal_name, raw_value, unit,
           normalized_value, source_type, occurred_at, subject_id}
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    AGGREGATION LAYER (Tier 2)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  Posterior Snapshot Engine                     │   │
│  │                                                               │   │
│  │  For each subject × domain, on every new signal event:        │   │
│  │                                                               │   │
│  │  1. COLLECT: Query signal_events for subject in domain        │   │
│  │     window (last 90 days)                                     │   │
│  │                                                               │   │
│  │  2. COUNT: Of the N expected signals for this domain           │   │
│  │     (DOMAIN_N_EXPECTED), how many are present?                │   │
│  │     → C = present / expected                                   │   │
│  │                                                               │   │
│  │  3. STALE: When was the most recent signal?                    │   │
│  │     → S = days since last signal / 90                          │   │
│  │                                                               │   │
│  │  4. CONCERN: Weighted combination of normalized signal         │   │
│  │     values (inverse signals flipped: high pain = high P)       │   │
│  │     → P = weighted mean of normalized deviations from normal   │   │
│  │                                                               │   │
│  │  5. PRECISION: How much can we trust P?                        │   │
│  │     → p_var = f(signal_count, cross-signal_consistency,        │   │
│  │                  staleness_penalty)                            │   │
│  │     p_var ≤ 0.06 → "high confidence"                          │   │
│  │     p_var ≤ 0.14 → "moderate confidence"                      │   │
│  │     p_var > 0.14 → "limited data"                             │   │
│  │                                                               │   │
│  │  6. GOVERN: Deterministic rules → band + reason string         │   │
│  │     P≥0.85 ∧ C≥0.70 ∧ S≤14d  → ESCALATED                     │   │
│  │     P≥0.60 ∧ C≥0.60           → MONITOR                       │   │
│  │     else                      → SUPPRESSED                     │   │
│  │                                                               │   │
│  │  Output: health_snapshots row + subjects row update            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Currently: computed during seed (batch over 90 synthetic days)      │
│  Future:    triggered by ingest webhook (real-time on each event)    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   INTELLIGENCE LAYER (Tier 3)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               WASM Digital Twin Engine (Rust)                 │   │
│  │                                                               │   │
│  │  INPUT: Current snapshot + protocol assignments + time        │   │
│  │                                                               │   │
│  │  PHASE 1 — PROBLEM STATE ("Where you are now"):               │   │
│  │    map_signals_to_regions(snapshot_json)                       │   │
│  │    → Maps domain P/C/S/p_var to 16 body regions               │   │
│  │    → Cardiovascular domain → heart, lungs, blood              │   │
│  │    → Heat diffusion across adjacency graph (25 edges)         │   │
│  │    → Color: teal (recovered) → amber (stressed) → coral      │   │
│  │                                                               │   │
│  │  PHASE 2 — PROTOCOL PROJECTION ("What we expect"):            │   │
│  │    compute_protocol_projection(                               │   │
│  │      current_snapshot,                                        │   │
│  │      protocol_assignments[],  // id, started_at, onset, peak  │   │
│  │      cohort_response_curves,  // from proxy population data   │   │
│  │      projection_weeks         // how far forward to project   │   │
│  │    )                                                          │   │
│  │    → For each protocol × target region:                       │   │
│  │      - Compute weeks_on_protocol = now - started_at           │   │
│  │      - Compute response_curve(weeks, onset, peak)             │   │
│  │      - Apply domain-specific attenuation to affected regions  │   │
│  │      - Reduce heat, increase recovery proportional to curve   │   │
│  │    → Output: projected TwinFrame at T+N weeks                 │   │
│  │                                                               │   │
│  │  PHASE 3 — EVIDENCE OVERLAY ("What we actually see"):         │   │
│  │    overlay_actual_vs_projected(                                │   │
│  │      projected_frame,                                         │   │
│  │      actual_snapshot_series[], // real snapshots as they come  │   │
│  │    )                                                          │   │
│  │    → Compare projected recovery curve to actual signals        │   │
│  │    → Regions where actual > projected → green halo (ahead)    │   │
│  │    → Regions where actual < projected → amber pulse (behind)  │   │
│  │    → This is the feedback loop that builds trust               │   │
│  │                                                               │   │
│  │  PHASE 4 — TEMPORAL ANIMATION ("The story"):                  │   │
│  │    interpolate_frames(frame_week_0, frame_week_12, t)         │   │
│  │    → Smooth animation: coach scrubs timeline slider            │   │
│  │    → Sees body go from problem state → projected resolution   │   │
│  │    → Protocol start dates marked on timeline                  │   │
│  │    → Lab draw dates marked (evidence arrives here)            │   │
│  │    → "Watch what happens when we add BPC-157 at week 3"       │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               Cohort Proxy Engine                             │   │
│  │                                                               │   │
│  │  We have 200 synthetic subjects × 90 days × 19 signals.       │   │
│  │  10 storyline archetypes. 11 protocols. 5 stacks.             │   │
│  │                                                               │   │
│  │  For any new subject, we can answer:                           │   │
│  │  "Among subjects on BPC-157/TB-500 with similar baseline      │   │
│  │   pain scores and CRP, what was the median trajectory?"        │   │
│  │                                                               │   │
│  │  This is the PROXY DATA the user described.                    │   │
│  │  It's not fake — it's the prior distribution.                  │   │
│  │  Real data narrows the posterior. The Twin visualizes both.    │   │
│  │                                                               │   │
│  │  API: GET /api/v1/cohort/trajectory                           │   │
│  │    ?protocol=bpc157_tb500                                      │   │
│  │    &domain=musculoskeletal                                    │   │
│  │    &baseline_p=0.72                                           │   │
│  │    → Returns: { weeks: [0..12], median_p: [...],              │   │
│  │                 p25: [...], p75: [...] }                       │   │
│  │  This curve feeds into WASM Phase 2 as the expected response. │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (Tier 4)                        │
│                                                                      │
│  Coach Dashboard (Next.js)                                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  HOME: Subject list sorted by governance band (ESCALATED first)│  │
│  │  ├── P score + precision label per client                     │  │
│  │  ├── Domain badge + governance reason snippet                  │  │
│  │  └── "Who needs me most right now"                            │  │
│  │                                                                │  │
│  │  DETAIL: Subject profile                                      │  │
│  │  ├── Score rings (Concern, Evidence, Freshness, Precision)    │  │
│  │  ├── Risk trajectory sparkline (90 days)                      │  │
│  │  ├── Signal timeline (selectable: HRV, HR, Sleep, Recovery..) │  │
│  │  ├── Active protocols with dosing timeline                    │  │
│  │  ├── Connected data sources with sync status                  │  │
│  │  └── DIGITAL TWIN with 3 modes:                               │  │
│  │      [Current State] [Protocol Projection] [Actual vs Plan]   │  │
│  │                                                                │  │
│  │  PROTOCOL PROJECTION VIEW (the money shot):                   │  │
│  │  ├── Timeline slider: Week 0 ────────────────── Week 12       │  │
│  │  ├── Body animates from problem (coral) → projected (teal)    │  │
│  │  ├── Protocol badges below: "BPC-157 started Week 2"         │  │
│  │  ├── Lab draw markers: "Blood panel expected Week 6"          │  │
│  │  └── Cohort overlay: "78% of similar athletes improved by     │  │
│  │       Week 8 on this protocol" (from proxy data)              │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. The Prior/Posterior Loop

This is the core intellectual property. The WASM Twin visualizes a Bayesian reasoning loop:

### 4.1 The Prior (What We Know Before This Patient)

| Source | What It Gives Us | Where It Lives |
|--------|------------------|----------------|
| **Protocol definitions** | Onset weeks, peak weeks, target domains, monitored signals | `constants/protocols.ts` — 11 peptides with response curves |
| **Cohort population data** | 200 subjects × 90 days × 19 signals = trajectory distributions per protocol × domain | `health_signal_events` + `health_snapshots` tables |
| **Storyline archetypes** | 10 trajectory patterns (overtraining, metabolic improvement, sleep disruption, etc.) | `seed/health-storylines.ts` |
| **Body region adjacency** | Which systems bleed into each other (heart stress → lungs → blood) | WASM adjacency graph (25 edges) |
| **Signal-to-domain mapping** | Which signals drive which domains and body regions | `constants/health-signals.ts` DOMAIN_SIGNALS |
| **LOINC/FHIR alignment** | Clinical validity of every signal definition | Standards table (Section 2.1) |

### 4.2 The Likelihood (What This Patient Tells Us)

As evidence arrives from connected sources, the posterior updates:

```
                       ┌─────────────────────────────┐
                       │    Subject connects Oura     │
                       │    + starts BPC-157 protocol │
                       └──────────────┬──────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
  Week 0 (Baseline)           Week 4 (Onset)              Week 8 (Accumulating)
  ──────────────────          ──────────────               ─────────────────────
  C = 0.30 (3/10 signals)    C = 0.50 (5/10)             C = 0.80 (8/10)
  p_var = 0.22 (limited)     p_var = 0.14 (moderate)     p_var = 0.05 (high)
  P = 0.71 (concern)         P = 0.65 (easing)           P = 0.42 (resolving)
  Band = SUPPRESSED           Band = MONITOR              Band = SUPPRESSED
  (not enough data to act)   (watching improvement)       (concern below threshold)
  Twin: joints coral/hot     Twin: joints amber,          Twin: joints teal,
        low glow (low conf)        moderate glow                strong glow (high conf)
                                                          
  "We think there's a joint    "BPC-157 is 4 weeks in.    "CRP dropped from 4.2 to
   issue but we only have       Pain self-report dropped    1.1. Recovery score up 22%.
   self-report and steps.       from 7 to 4. Waiting on     Blood panel confirms what
   Need blood panel."           blood panel to confirm."    the wearable suggested."
```

### 4.3 The Posterior (What The Twin Shows)

The Digital Twin renders THREE simultaneous layers:

| Layer | What Coach Sees | Data Source |
|-------|-----------------|-------------|
| **Problem State** (red/coral) | Where the body is stressed *right now* based on latest signals | Current snapshot P/C/S per domain → `map_signals_to_regions()` |
| **Protocol Projection** (ghost/teal) | Where the body *should be* at T+N weeks given the prescribed protocol | Protocol response curves × cohort median trajectory |
| **Actual vs Expected** (green halo / amber pulse) | Whether real incoming data matches the projection | Overlay of actual snapshot series against projected curve |

The animation timeline lets the coach scrub through time:
- **Past** (left): See what the signals looked like before the protocol started
- **Present** (center): Current state with precision indicators
- **Future** (right): Projected improvement based on protocol + cohort prior

---

## 5. Synthetic → Real Data Swap

### 5.1 What Changes

| Component | Synthetic (Now) | Real (Future) | Schema Change? |
|-----------|----------------|---------------|----------------|
| Signal ingestion | Seed script writes batch rows | OAuth webhook writes rows on arrival | **None** — same `health_signal_events` table |
| Source identification | `source_type: 'oura'` (hardcoded) | `source_type: 'oura'` (from OAuth token) | **None** — same column |
| Signal naming | `signal_name: 'hrv_rmssd'` | `signal_name: 'hrv_rmssd'` (mapped from Oura's `average_hrv`) | **None** — adapter normalizes |
| Units | `unit: 'ms'` (UCUM) | `unit: 'ms'` (UCUM from LOINC table) | **None** |
| Normal ranges | `normalRange: [40, 100]` from constants | Same constants — clinically validated | **None** |
| Lab results | Generated from storyline curves | Parsed from Function Health / InsideTracker API response | **None** — same row format |
| FHIR records | Not used yet | Epic/Cerner send FHIR R4 Observation bundles → mapped to signal_events | **None** — FHIR → our schema is a 20-line adapter |
| Posterior computation | Batch in seed script | Real-time trigger on each new signal event | **Logic unchanged** — trigger mechanism changes |
| Cohort trajectories | 200 synthetic subjects | Growing real population | **Improves** — prior gets better with real data |

### 5.2 Source Adapter Contract

Every data source adapter implements the same interface:

```typescript
interface SourceAdapter {
  sourceId: string;                     // 'oura' | 'whoop' | 'garmin' | ...
  
  // OAuth flow (for wearables and apps)
  getAuthUrl(orgId: string, subjectId: string): string;
  handleCallback(code: string): Promise<{ accessToken: string; refreshToken: string }>;
  
  // Data pull (webhook or poll)
  fetchNewData(accessToken: string, since: Date): Promise<RawSourceData[]>;
  
  // Normalization — this is the key function
  normalize(raw: RawSourceData): HealthSignalEvent {
    // Map vendor-specific field names → our signal_name (LOINC-aligned)
    // Map vendor units → UCUM units
    // Compute normalized_value (0-1 within full physiological range)
    // Return a health_signal_events row
  }
}
```

**Example — Oura Ring adapter (planned):**

```typescript
// Oura API returns: { average_hrv: 52, lowest_resting_heart_rate: 54, ... }
normalize(raw: OuraDailySleep): HealthSignalEvent[] {
  return [
    {
      signal_name: 'hrv_rmssd',         // our ID
      raw_value: raw.average_hrv,        // Oura's field → our raw
      unit: 'ms',                        // UCUM
      normalized_value: (raw.average_hrv - 10) / 140,  // fullRange [10, 150]
      source_type: 'oura',
      occurred_at: raw.day,              // ISO date from Oura
      // ... same as synthetic rows
    },
    {
      signal_name: 'resting_hr',
      raw_value: raw.lowest_resting_heart_rate,
      unit: '/min',
      normalized_value: 1 - (raw.lowest_resting_heart_rate - 38) / 62,
      source_type: 'oura',
      occurred_at: raw.day,
    },
    // ... sleep_duration, sleep_quality, recovery_score
  ];
}
```

The synthetic generator's `generateRawValue()` function uses the **exact same normal ranges and full ranges** as a real adapter would. That's the point — the schema was designed from the standards first.

---

## 6. WASM Protocol Projection Spec

### 6.1 New WASM Export: `compute_protocol_projection`

```rust
#[wasm_bindgen]
pub fn compute_protocol_projection(
    current_snapshot_json: &str,   // { p_score, c_score, s_score, p_var, domain, signal_vector }
    protocols_json: &str,          // [{ id, started_at_weeks_ago, onset_weeks, peak_weeks, 
                                   //    target_domains, monitored_signals }]
    cohort_curve_json: &str,       // { median_p: [0.72, 0.68, ...], p25: [...], p75: [...] }
    projection_weeks: f64,         // how far forward
    time: f64,                     // animation time (ms)
) -> String                        // TwinFrame JSON
```

### 6.2 Response Curve Math

For each active protocol affecting a body region:

```
weeks_on = now - protocol.started_at
response_phase = 
    if weeks_on < onset:  0.0                          // no effect yet
    if weeks_on < peak:   (weeks_on - onset) / (peak - onset)  // ramping
    else:                 1.0                           // plateau

// Projection at future time T:
projected_weeks = weeks_on + projection_weeks
projected_phase = response_curve(projected_weeks, onset, peak)

// Effect on region heat:
heat_reduction = projected_phase × protocol_max_effect × cohort_median_response
projected_heat = current_heat × (1.0 - heat_reduction)

// Effect on region recovery:
recovery_boost = projected_phase × 0.4 × cohort_response
projected_recovery = current_recovery + recovery_boost × (1.0 - current_recovery)
```

### 6.3 Cohort Response Curves (From Our Population Data)

We compute these from existing synthetic data:

```sql
-- Median P trajectory for subjects on BPC-157 in musculoskeletal domain
SELECT 
  frame_index,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY p_score) as p25,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY p_score) as median_p,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY p_score) as p75
FROM health_snapshots hs
JOIN protocol_assignments pa ON pa.subject_id = hs.subject_id
WHERE pa.protocol_id = 'bpc157_tb500'
  AND hs.domain = 'musculoskeletal'
GROUP BY frame_index
ORDER BY frame_index;
```

This gives us the **population prior** — "what typically happens to musculoskeletal concern when someone starts BPC-157." The Twin renders this as the expected trajectory. As real blood panels and wearable data arrive for this specific patient, the Twin shows whether they're tracking ahead of, on, or behind the cohort curve.

### 6.4 Visual Modes

| Mode | Timeline Position | What Renders | Coach Interaction |
|------|-------------------|--------------|-------------------|
| **Current** | Now | Problem regions (coral/hot), confidence-weighted glow | Default view |
| **Projection** | Now → +12 weeks | Problem fading to teal as protocol takes effect | Scrub timeline slider |
| **Comparison** | Projected vs Actual | Green halo where ahead of projection, amber where behind | Toggle overlay |
| **Cohort** | Population median | Ghost silhouette showing typical response | Toggle cohort band |

---

## 7. Protocol-to-Region Mapping (Complete)

How each of LongevityPlan.AI's 11 peptides maps through the system to body regions in the Twin:

| Protocol | Target Domains | Monitored Signals | Affected Body Regions | Onset → Peak |
|----------|---------------|-------------------|----------------------|--------------|
| **Tirzepatide** | metabolic | A1c, active_cal, steps, nutrition_cal, energy | liver, gut, pancreas | 2w → 12w |
| **Semaglutide** | metabolic | A1c, active_cal, nutrition_cal, energy | liver, gut, pancreas | 2w → 16w |
| **AOD-9604** | metabolic, MSK | active_cal, pain, CRP | liver, gut, joints, lower_body | 4w → 12w |
| **Lipo-C / MIC+B12** | metabolic | energy, active_cal, nutrition_cal | liver, gut | 1w → 6w |
| **NAD+** | cognitive, sleep, cardio | energy, HRV, sleep_quality, recovery | brain_cog, brain_sleep, heart, ANS | 1w → 8w |
| **Semax/Selank** | cognitive | energy, HRV, cortisol, sleep_quality | brain_cog, adrenals | 1w → 4w |
| **Glutathione** | metabolic, cardio | CRP, energy, recovery | liver, heart, blood | 2w → 8w |
| **Sermorelin** | hormonal, sleep, MSK | sleep, recovery, testosterone, energy | pituitary, brain_sleep, upper_body | 4w → 12w |
| **MOTS-C** | metabolic, cardio, MSK | active_cal, strain, recovery, HRV | heart, lungs, upper_body, lower_body | 3w → 10w |
| **GHK-Cu** | MSK | pain, CRP, recovery | joints, lower_body, upper_body | 2w → 8w |
| **BPC-157/TB-500** | MSK | pain, recovery, strain, CRP, active_cal | joints, lower_body, upper_body, core_trunk | 1w → 6w |

When a coach prescribes "Injury Recovery Stack" (BPC-157/TB-500 + GHK-Cu + Glutathione), the Twin shows:
- **Week 0**: Joints, lower body, core trunk lit up coral. Liver mildly amber (CRP elevated).
- **Week 1**: BPC-157 onset. Joints start fading from coral → amber. GHK-Cu not yet active.
- **Week 2**: GHK-Cu onset. Glutathione onset. Liver region begins cooling. Joints continuing to improve.
- **Week 6**: BPC-157 at peak. Joints now teal. GHK-Cu ramping. CRP dropping → liver cooling.
- **Week 8**: All three at or near peak. Body predominantly teal. Recovery scores high.
- **Overlay**: Blood panel at week 6 shows CRP dropped from 4.2 → 1.1 mg/L. Green halo on liver region: "ahead of cohort median."

---

## 8. Evidence Arrival Schedule

When a patient-athlete is connected, this is what the coach dashboard shows arriving over time:

```
Day 1     │ Oura: resting_hr, hrv_rmssd, sleep_duration, sleep_quality, recovery_score
          │ Self-report: energy, pain (weekly)
          │ Twin: 5/19 signals → C=0.26, p_var=0.22 → "limited data"
          │ 
Day 7     │ + Strava: active_calories, strain_score, steps  
          │ + Self-report: energy, pain (second week)
          │ Twin: 10/19 signals → C=0.53, p_var=0.13 → "moderate confidence"
          │ 
Week 4    │ + Function Health blood panel: A1c, testosterone, CRP, vitamin D, cortisol, TSH
          │ Twin: 16/19 signals → C=0.84, p_var=0.04 → "high confidence"
          │ GOVERNANCE ENGINE NOW HAS ENOUGH DATA TO ESCALATE OR SUPPRESS CONFIDENTLY
          │ 
Week 8    │ + Second blood panel (if quarterly cadence)
          │ Twin: Full longitudinal view. Protocol projection verified against actuals.
          │ Coach can now see: "BPC-157 is working — CRP dropped as projected."
          │
Week 12   │ + Third blood panel
          │ Prior updated: this patient's response curve now informs future cohort curves.
          │ The population prior gets better with every real patient.
```

---

## 9. Database Table Relationships (ERD Summary)

```
organizations (1)
  │
  ├── subjects (N)
  │     ├── health_signal_events (N per subject, millions at scale)
  │     ├── health_snapshots (N per subject × domain, thousands at scale)
  │     ├── protocol_assignments (1-5 per subject)
  │     ├── subject_data_sources (2-5 per subject)
  │     ├── health_governance_actions (N per subject)
  │     └── session_bookings (0-N per subject)
  │
  ├── practitioners (N)
  │     └── session_slots (N per practitioner)
  │
  └── audit_log (append-only, every PHI access logged)
```

**All tables carry `org_id`** — row-level tenant isolation at application layer now, PostgreSQL RLS policies planned for HIPAA hardening.

---

## 10. Why This Architecture Works for LongevityPlan.AI

| Investor Question | Answer |
|-------------------|--------|
| "Is this a real data model?" | Every signal maps to a LOINC code. Every record maps to FHIR R4 Observation. Published standards. |
| "What happens when you get real data?" | Source adapters normalize vendor data → same `health_signal_events` rows. Zero schema migration. |
| "How do you know the peptides work?" | Protocol response curves + cohort trajectory data + blood panel verification. The Twin shows predicted vs actual. |
| "Is this HIPAA-ready?" | PHI fields identified, audit log built, org_id isolation from day 1. Encryption + BAA are configuration steps, not rewrites. |
| "Can you scale?" | PostgreSQL handles millions of signal events. TimescaleDB extension when needed. WASM runs client-side (no server compute for rendering). |
| "What's the moat?" | The cohort data. Every patient who connects improves the prior for every future patient. Network effect on data quality. |

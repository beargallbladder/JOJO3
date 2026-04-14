# Product Requirements Document — LongevityPlan.AI Platform

> Technical PRD for engineering, investors, and partners.
> No marketing. No fluff. What the data is, where it comes from, how we store it, what we expose, and what the coach experience should actually be.
>
> Last updated: 2026-04-14

---

## 1. What This Product Does

LongevityPlan.AI is a **multi-signal health intelligence platform** for coaches and practitioners managing athletes on peptide therapy protocols.

The core loop:
1. Ingest health signals from wearables, labs, nutrition apps, self-reports
2. Fuse them into a Bayesian posterior (concern × evidence × freshness × precision)
3. Apply governance rules (escalate / monitor / suppress)
4. Generate a natural-language intelligence summary for the coach
5. Visualize the body's state and protocol projection via a WASM Digital Twin
6. Every coach interaction feeds back as a signal for the next posterior update

The platform replaces spreadsheets, group texts, and gut feeling with evidence-based decision support.

---

## 2. Data Schema — What We Ingest, Store, and Expose

### 2.1 The 26 Health Signals

Every signal we track maps to a published clinical standard (LOINC code) and has a defined normal range, full physiological range, unit (UCUM), and domain assignment. We didn't invent these — we implemented them.

**Daily wearable signals (8)** — arrive every day from connected devices:

| Signal ID | Label | Unit | Normal Range | Source | Domains |
|-----------|-------|------|-------------|--------|---------|
| `resting_hr` | Resting Heart Rate | bpm | 50–70 | Oura, WHOOP, Garmin, Apple Watch, Fitbit | Cardiovascular, Sleep |
| `hrv_rmssd` | HRV (RMSSD) | ms | 40–100 | Oura, WHOOP, Garmin, Apple Watch, Fitbit | Cardiovascular, Sleep, Cognitive |
| `sleep_duration` | Sleep Duration | min | 420–540 | Oura, WHOOP, Garmin, Apple Watch, Fitbit | Sleep, Cognitive |
| `sleep_quality` | Sleep Quality Score | score | 70–95 | Oura, WHOOP, Garmin, Fitbit | Sleep |
| `recovery_score` | Recovery Score | score | 60–95 | WHOOP, Oura, Fitbit | Sleep, MSK |
| `strain_score` | Daily Strain | score | 8–16 | WHOOP, Garmin, Strava | Cardiovascular, MSK |
| `active_calories` | Active Calories | kcal | 300–800 | All wearables | Metabolic, Cardiovascular |
| `steps` | Daily Steps | steps | 7,000–12,000 | All wearables | Metabolic, Cardiovascular |

**Daily nutrition signals (2)** — from connected nutrition apps:

| Signal ID | Label | Unit | Normal Range | Source |
|-----------|-------|------|-------------|--------|
| `nutrition_calories` | Daily Calorie Intake | kcal | 1,800–2,800 | MyFitnessPal, Cronometer, MacroFactor |
| `nutrition_protein` | Daily Protein | g | 100–200 | MyFitnessPal, Cronometer, MacroFactor |

**Periodic lab signals (13)** — arrive every 6–26 weeks from blood panels:

| Signal ID | Label | Unit | Normal Range | LOINC Code |
|-----------|-------|------|-------------|-----------|
| `lab_a1c` | HbA1c | % | 4.2–5.6 | 4548-4 |
| `lab_testosterone` | Testosterone | ng/dL | 400–900 | 2986-8 |
| `lab_crp` | C-Reactive Protein | mg/L | 0.1–1.0 | 1988-5 |
| `lab_vitamin_d` | Vitamin D (25-OH) | ng/mL | 30–60 | 14635-7 |
| `lab_cortisol` | Cortisol (AM) | mcg/dL | 6–18 | 2144-4 |
| `lab_thyroid_tsh` | TSH | mIU/L | 0.5–4.0 | 11580-8 |
| `lab_hemoglobin` | Hemoglobin | g/dL | 12.0–17.5 | 718-7 |
| `lab_hematocrit` | Hematocrit | % | 36–50 | 4544-3 |
| `lab_ferritin` | Ferritin | ng/mL | 20–200 | 2276-4 |
| `lab_iron` | Iron (Serum) | mcg/dL | 60–170 | 2498-4 |
| `lab_transferrin_sat` | Transferrin Saturation | % | 20–50 | 2502-3 |
| `lab_creatine_kinase` | Creatine Kinase | U/L | 30–200 | 2157-6 |
| `lab_fasting_glucose` | Fasting Glucose | mg/dL | 70–99 | 1558-6 |

**Self-report + practitioner signals (3)** — weekly or event-driven:

| Signal ID | Label | Unit | Normal Range | Source |
|-----------|-------|------|-------------|--------|
| `self_energy` | Self-Reported Energy | score (1–10) | 6–9 | In-app check-in |
| `self_pain` | Self-Reported Pain | score (0–10) | 0–2 | In-app check-in |
| `practitioner_note` | Practitioner Observation | text | — | Coach entry |

### 2.2 Data Sources — Where Signals Come From

We've mapped 30+ real-world data sources across 7 categories. Each source has a defined auth mechanism and the specific signals it provides:

| Category | Sources | Auth | Signals Provided | Integration Status |
|----------|---------|------|-----------------|-------------------|
| **Wearable** | Oura, WHOOP, Garmin, Apple Watch, Fitbit, Samsung, Polar, COROS | OAuth 2.0 | HR, HRV, sleep, recovery, strain, calories, steps | Planned (Oura, WHOOP, Garmin first) |
| **Biomarker Lab** | Function Health, InsideTracker, Wild Health, Quest, Labcorp, Marek | API key / FHIR | All 13 lab signals | Planned (Function Health first) |
| **Training App** | Strava, TrainingPeaks, Peloton, Strong/Hevy | OAuth 2.0 | Calories, strain, steps | Planned (Strava first) |
| **Nutrition App** | MyFitnessPal, Cronometer, MacroFactor, Carbon | OAuth 2.0 | Calories, protein | Planned (MFP first) |
| **Medical Record** | Epic MyChart, Oracle Health (Cerner) | FHIR R4 | Lab signals via Observation bundles | Future |
| **Self-Report** | In-app | Manual | Energy, pain | Built (needs write endpoint) |
| **Practitioner** | In-app | Manual | Notes, observations | Built (needs write endpoint) |

**Key design decision**: Every source adapter normalizes vendor-specific field names to our signal IDs (LOINC-aligned), vendor units to UCUM units, and writes the same `health_signal_events` row. When real integrations ship, the database schema doesn't change. Only the ingestion adapters are new code.

### 2.3 The 11 Peptide Protocols

Each protocol has defined target domains, monitored signals, onset/peak timing, and dosing cadence:

| Protocol | Category | Target Domains | Key Monitored Signals | Onset → Peak |
|----------|----------|---------------|----------------------|-------------|
| Tirzepatide | Metabolic | metabolic | A1c, calories, steps, energy | 2w → 12w |
| Semaglutide | Metabolic | metabolic | A1c, calories, energy | 2w → 16w |
| AOD-9604 | Metabolic | metabolic, MSK | Calories, pain, CRP | 4w → 12w |
| Lipo-C / MIC+B12 | Metabolic | metabolic | Energy, calories | 1w → 6w |
| NAD+ | Performance | cognitive, sleep, cardio | Energy, HRV, sleep, recovery | 1w → 8w |
| Semax/Selank | Performance | cognitive | Energy, HRV, cortisol, sleep | 1w → 4w |
| Glutathione | Longevity | metabolic, cardio | CRP, energy, recovery | 2w → 8w |
| Sermorelin | Longevity | hormonal, sleep, MSK | Sleep, recovery, testosterone | 4w → 12w |
| MOTS-C | Longevity | metabolic, cardio, MSK | Calories, strain, recovery, HRV | 3w → 10w |
| GHK-Cu | Longevity | MSK | Pain, CRP, recovery | 2w → 8w |
| BPC-157/TB-500 | Recovery | MSK | Pain, recovery, strain, CRP | 1w → 6w |

5 protocol stacks combine these into common treatment patterns (Metabolic Reset, Performance & Longevity, Injury Recovery, Cognitive Edge, Hormonal Optimization).

---

## 3. Database Architecture

### 3.1 Current Scale (200 synthetic athletes, 90 days)

| Table | Rows | Disk Size | Purpose |
|-------|------|-----------|---------|
| `organizations` | 1 | 16 KB | Multi-tenant root |
| `subjects` | 200 | 144 KB | Athlete profiles + current posterior state |
| `health_signal_events` | 150,765 | 33 MB | Raw signal data (the core asset) |
| `health_snapshots` | 2,495 | 1.1 MB | Posterior timeline (P/C/S/p_var per domain per frame) |
| `protocol_assignments` | 484 | 152 KB | Which protocols each athlete is on |
| `subject_data_sources` | 856 | 192 KB | Connected platforms per athlete |
| `practitioners` | 12 | 32 KB | Coach/physician directory |
| `audit_log` | 0 | 16 KB | HIPAA audit trail (ready, not yet populated) |
| **Total** | **154,812** | **43 MB** | |

**Projection at 10,000 athletes**: ~7.5M signal events, ~125K snapshots. Approximately 2.2 GB. PostgreSQL handles this comfortably. TimescaleDB extension available when time-series queries need optimization.

### 3.2 Schema Design Principles

**Multi-tenancy**: `org_id` on every table from day 1. Application-level filtering now, PostgreSQL Row-Level Security (RLS) policies planned for HIPAA hardening. Not a migration — a configuration change.

**PHI identification**: `display_name`, `date_of_birth`, and `contact` (future) are marked as PHI fields. Currently stored as plaintext (acceptable for demo/dev). Production: app-level AES-256-GCM encryption or pgcrypto, with key management via AWS KMS or Vault. The columns exist, the encryption wraps around them.

**Audit logging**: `audit_log` table exists with `actor_id`, `action`, `resource_type`, `resource_id`, `phi_accessed`, `ip_address`. Middleware hook point exists in the API. HIPAA audit readiness is "turn on enforcement," not a rewrite.

**FHIR R4 alignment**: `health_signal_events` maps 1:1 to FHIR R4 Observation. `subjects` maps to FHIR R4 Patient. `organizations` maps to FHIR R4 Organization. When EHR integrations ship, the adapter is ~20 lines of field mapping.

### 3.3 The `subjects` Table (Athlete Profile)

| Column | Type | PHI? | Notes |
|--------|------|------|-------|
| `id` | UUID | No | Primary key |
| `org_id` | UUID | No | Tenant isolation |
| `external_id` | text | No | e.g., "LP-1058" |
| `display_name` | text | **Yes** | Encrypt in production |
| `date_of_birth` | text | **Yes** | Stored as text for encryption compatibility |
| `sex` | enum (M/F/other) | Yes | |
| `fitness_level` | enum (low/medium/high) | No | |
| `sport` | text | No | e.g., "Triathlon", "MMA", "Swimming" |
| `height_cm` | real | No | |
| `weight_kg` | real | No | |
| `training_phase` | enum | No | recovery/base/build/peak/taper/race/off_season |
| `calorie_target` | integer | No | |
| `coach_notes` | text | No | Free-text from coach |
| `races` | JSONB | No | `[{name, type, location, date, finish_time, is_pr}]` |
| `active_domains` | JSONB | No | Which health domains are relevant |
| `posterior_p` | real | No | Current concern score (0–1) |
| `posterior_p_var` | real | No | Precision of P estimate (0–0.25) |
| `posterior_c` | real | No | Evidence coverage (0–1) |
| `posterior_s` | real | No | Staleness (0–1) |
| `governance_band` | enum | No | ESCALATED / MONITOR / SUPPRESSED |
| `governance_reason` | text | No | Human-readable explanation |
| `primary_domain` | enum | No | Dominant health domain |
| `last_signal_at` | timestamp | No | Most recent data point |

---

## 4. API Payload Analysis — Mobile Readiness

### 4.1 Measured Payload Sizes

| Endpoint | Payload | Use Case | Mobile Impact |
|----------|---------|----------|--------------|
| `GET /subjects?limit=50` | **55 KB** | Dashboard athlete list | Acceptable. One request on app launch. |
| `GET /subjects/:id` | **4.9 KB** | Athlete detail (profile + snapshot + protocols + sources) | Excellent. Instant load. |
| `GET /subjects/:id/intelligence` | **7.4 KB** | Coach summary + clinical drill-down | Excellent. The core value in <8 KB. |
| `GET /subjects/:id/signals?limit=90` | **48.7 KB** | 90-day signal timeline for one signal | Large. Only fetch on demand (when coach taps into Signals view). |
| `GET /subjects/:id/snapshots` | **9.5 KB** | Posterior trajectory (all frames) | Fine. |
| `GET /org/stats` | **1.0 KB** | Dashboard summary stats | Trivial. |
| `GET /protocols` | **6.1 KB** | Protocol library | Cache on device. Rarely changes. |

**Total for the full coach experience** (dashboard + one athlete detail + intelligence):
- Dashboard load: 55 KB (subjects) + 1 KB (stats) = **56 KB**
- Athlete detail: 4.9 KB (detail) + 7.4 KB (intelligence) + 9.5 KB (snapshots) = **22 KB**
- **Total: ~78 KB** for the complete experience. That's smaller than a single Instagram image.

The 48.7 KB signals payload is only fetched if the coach actively digs into signal timelines — which brings us to the UX question.

### 4.2 What This Means for Mobile

The API is already mobile-ready. No GraphQL needed. No pagination gymnastics. The intelligence endpoint delivers the entire coach view in 7.4 KB. A React Native or Expo app fetching these endpoints over LTE would feel instant.

---

## 5. The UX Problem — Tabs Are Wrong for Mobile

### 5.1 What We Built (Desktop)

The desktop coach dashboard has 5 tabs per athlete: **Intelligence, Signals, Labs, Protocols, Twin**. This made sense for a desktop audit tool where a coach might investigate each system.

### 5.2 Why Tabs Are Wrong for a Coach on Mobile

A coach with 30+ athletes doesn't have time to tap through 5 tabs per person. The tab architecture implies the coach needs to investigate. But **the whole point of the intelligence layer is that the coach shouldn't have to investigate**.

If the coach trusts the system, they need:
1. **Who needs me** — sorted list, 2-second scan
2. **What's happening** — one card, one headline, one action
3. **Did I do it** — mark the action done, move on

That's not 5 tabs. That's a feed.

### 5.3 The Mobile Architecture (Proposed)

**One screen. A feed. Like Messages, not like Excel.**

```
┌──────────────────────────────────┐
│  LongevityPlan          Coach ●  │
├──────────────────────────────────┤
│                                  │
│  ● Marcus Rivera                 │
│    Oxygen Transport — HR rising, │
│    HRV falling. 61 days to       │
│    Ironman. Prioritize recovery. │
│    → Review HbA1c (+4 more)      │
│    [Mark Done]  [Open Detail]    │
│                                  │
│  ● Leila Okafor                  │
│    Recovery compromised — Sleep   │
│    duration falling 80 min.      │
│    → Review CRP (+2 more)        │
│    [Mark Done]  [Open Detail]    │
│                                  │
│  ● Derek Chen               ✓   │
│    On Track. No action needed.   │
│                                  │
│  ● Elena Diaz               ✓   │
│    On Track. No action needed.   │
│                                  │
│  ─────────── 196 more ────────── │
│                                  │
└──────────────────────────────────┘
```

**"Open Detail"** shows the athlete card with:
- Profile header (sport, phase, race countdown)
- Intelligence card (headline + body + action)
- Digital Twin (current state — one tap for projection)
- "Show science" toggle → the clinical drill-down expands

**The science exists. But it's hidden until the coach asks for it.** The default experience is: headline, narrative, one action, done.

### 5.4 Why This Beats Tabs

| Tabs (current) | Feed (proposed) |
|----------------|-----------------|
| Coach opens app, sees list, taps athlete, reads Intelligence tab, switches to Labs tab, switches to Protocols tab | Coach opens app, reads feed top-to-bottom, taps "Mark Done" on each, done in 2 minutes |
| 5 taps per athlete × 30 athletes = 150 taps | 1–2 taps per athlete × 30 athletes = 30–60 taps |
| Cognitive load: "what tab am I on?" | Cognitive load: "what's next?" |
| Information architecture designed for engineers | Information architecture designed for a human with 30 clients |

### 5.5 When Tabs Survive

The desktop dashboard keeps the tab structure for **deep investigation sessions** — when a coach sits down for 30 minutes to review a specific athlete's labs, protocol response, and signal trends before a scheduled call. That's a different mode. Mobile is triage. Desktop is analysis.

---

## 6. The Digital Twin — What the Images Showed vs. What We Built

### 6.1 What the Mockup Images Showed

The 17 mockup images showed a vision of:
- A full-body human figure with organ systems highlighted
- Color-coded regions (red = problem, green = healthy)
- Biomarker callouts attached to specific body regions
- Protocol effects visualized as changes over time
- A timeline scrubber showing before/during/after treatment
- Performance system scores (cardiovascular, metabolic, etc.)
- Lab marker cards with reference ranges and trend arrows

### 6.2 What We Built

- **WASM Digital Twin** (Rust → wasm32, 154 KB binary): 16 body regions, 25 adjacency connections, heat diffusion across connected systems, chi-like particle flow along meridians, organic radial gradient glows, breathing animation
- **Protocol projection**: Coach scrubs a timeline slider 0–12 weeks, body transitions from problem (coral) to projected recovery (teal) based on protocol response curves
- **Two rendering modes**: Current state and projection
- **Hit-testing**: Hover any body region → tooltip shows stress/recovery percentage
- **JS fallback**: If WASM fails to load, a JavaScript approximation renders

### 6.3 What's Missing (vs. Images)

| Mockup Feature | Status | Effort |
|----------------|--------|--------|
| Biomarker callout labels attached to body regions | Not built | 1–2 days |
| Protocol effect annotations on timeline | Not built | 1 day |
| Organ system detail view (tap a region → see its signals) | Not built | 2 days |
| 3D mesh (Three.js / WebGPU) | Not built | 2–3 weeks |
| Actual vs. projected overlay (green halo / amber pulse) | Designed in data architecture, not rendered | 1 week |
| Cohort band overlay (ghost silhouette showing population median) | Designed, not rendered | 1 week |

---

## 7. PII, HIPAA, and Multi-Tenancy

### 7.1 PHI Fields Identified

| Field | Table | Classification | Current State | Production Plan |
|-------|-------|---------------|---------------|-----------------|
| `display_name` | subjects | PHI | Plaintext | AES-256-GCM app-level encryption |
| `date_of_birth` | subjects | PHI | Plaintext (text column for encryption compat) | Encrypted |
| `contact` (future) | subjects | PHI | Not yet created | Encrypted from birth |
| `sex` | subjects | PHI (in combination) | Enum | Context-dependent; encrypt if stored with name |

### 7.2 Multi-Tenancy Architecture

**Current**: `org_id` column on every table. Application-level `WHERE org_id = ?` filtering in every query via mock auth middleware that injects `org_id` into request context.

**Production path**:
1. Replace mock auth with JWT + RBAC (role claims: practitioner, client, admin, org-admin)
2. Add PostgreSQL Row-Level Security (RLS) policies: `CREATE POLICY tenant_isolation ON subjects USING (org_id = current_setting('app.org_id'))`
3. Set `app.org_id` from JWT claims at connection time
4. Defense-in-depth: app-level filtering + RLS + audit log = three layers

**Why org_id from day 1**: Multi-tenancy is a schema decision. If you add it later, you migrate every table, every query, every index. We designed it in before writing the first route.

### 7.3 Audit Readiness

The `audit_log` table is built with:
- `actor_id` (who), `actor_type` (user/system/api_key)
- `action` (read/create/update/delete/export)
- `resource_type` + `resource_id` (what was accessed)
- `phi_accessed` (integer flag — was PHI involved?)
- `ip_address`, `user_agent` (where from)
- `created_at` (when)

Middleware hook exists. Not enforced yet. Turning on enforcement is a configuration change — add the audit middleware to routes that touch PHI tables. No new tables, no new columns, no new architecture.

### 7.4 HIPAA Compliance Posture

| Requirement | Status | Gap to Close |
|-------------|--------|-------------|
| PHI encryption at rest | Identified, not encrypted | App-level AES or pgcrypto |
| PHI encryption in transit | HTTPS everywhere (Render enforces TLS) | Done |
| Access controls | Mock auth (demo) | JWT + RBAC |
| Audit logging | Table + schema built | Enforce middleware |
| Business Associate Agreement | Not signed | Requires paid Render tier or AWS with BAA |
| Row-level tenant isolation | org_id + app filtering | Add PostgreSQL RLS |
| Data retention policy | Not defined | Define + implement TTL |
| Breach notification process | Not defined | Policy document |

**Estimate to HIPAA-ready**: 3–4 weeks of engineering + 1 week of policy/legal.

---

## 8. The Bayesian Engine — How Signals Become Intelligence

### 8.1 The Posterior Triple + Variance

Every athlete × domain has a current posterior state:

| Field | Range | Meaning |
|-------|-------|---------|
| **P** (concern) | 0–1 | How likely something is wrong. Weighted mean of normalized signal deviations. |
| **p_var** (precision) | 0–0.25 | Variance of P estimate. Low = we're sure. High = we're guessing. Bernoulli max = 0.25. |
| **C** (coverage) | 0–1 | Fraction of expected signals for this domain that are present. C=0.3 means 3 of 10 expected signals have data. |
| **S** (staleness) | 0–1 | How old is the freshest signal. S=0 means data arrived today. S=1 means 90+ days stale. |

**Precision labels** (shown to coach):
- p_var ≤ 0.06 → "High confidence"
- p_var ≤ 0.14 → "Moderate confidence"
- p_var > 0.14 → "Low — more data needed"

### 8.2 Governance Rules

Deterministic. No ML. No black box. A coach can read the reason string and understand why.

| Band | Trigger | What Coach Sees |
|------|---------|----------------|
| **ESCALATED** | P ≥ 0.85 AND C ≥ 0.70 AND S ≤ 14 days | Red. Intervention recommended. "Concern 87%, high confidence, data is fresh." |
| **MONITOR** | P ≥ 0.60 AND C ≥ 0.60 | Yellow. Building evidence. "Concern 65% but data coverage growing." |
| **SUPPRESSED** | Everything else | Blue/teal. Not enough to act. "Concern 78% but only 38% coverage — not enough to escalate." |

### 8.3 The Intelligence API

`GET /subjects/:id/intelligence` returns two tiers in one response (7.4 KB):

**Coach tier** — what the coach reads in 5 seconds:
```json
{
  "headline": "Oxygen Transport",
  "body": "Triathlon athlete in build phase showing cardiovascular load — 
           Resting HR rising (+9 bpm); HRV falling (-20 ms). With Ironman 
           70.3 Oceanside 61 days away, prioritize recovery.",
  "action": "Review HbA1c — 5.87% exceeds upper limit. (+4 more)",
  "urgency": "low"
}
```

**Clinical tier** — what the practitioner drills into:
- Evidence chain: 6–10 signals with type (blood/wearable/self), value, unit, reference range, trend arrow, delta text
- Performance systems: per-domain aggregate score (0–100) with signal count
- Lab markers: 13 markers with current value, previous value, reference range, status badge (Low/Normal/High/Optimal), trend direction
- Protocol tracking: per-protocol trend (improving/worsening/stable), sparkline values, narrative
- Clinical actions: numbered checklist ("Review HbA1c", "Schedule blood retest", "Flag for practitioner review")

The narrative in the coach tier connects **who** (sport, training phase) to **what** (signal trends) to **why it matters** (upcoming race, protocol timing) to **what to do** (top action). It's not a data dump — it's a sentence a coach can act on.

---

## 9. What's Not Built Yet (Honest Gaps)

| Gap | Why It Matters | Effort |
|-----|---------------|--------|
| **Write endpoints** (POST/PUT/PATCH) | Coach can't add notes, complete actions, adjust protocols, or log observations. The system is read-only. | 1–2 weeks |
| **Coach writes → signal events → posterior update** | Every coach touch should feed the Bayesian engine. A note about knee pain should become a signal_event that updates the posterior. Currently nothing writes back. | 1 week |
| **Real authentication** (JWT + RBAC) | Mock auth only. No real user accounts, no role enforcement, no session management. | 3–5 weeks |
| **Real data integrations** (Oura, WHOOP, Garmin) | Only synthetic data. The adapters are designed but not coded. | 2–4 weeks per source |
| **Mobile app** (React Native / Expo) | No mobile experience. The API is mobile-ready (78 KB total payload), but no app exists. | 4–8 weeks |
| **Client/athlete-facing experience** | The athlete never sees anything. No weekly summary, no push notification, no "your recovery is improving" message. This is the engagement hook. | 2–4 weeks |
| **HIPAA hardening** | PHI not encrypted, audit not enforced, no BAA signed. | 3–4 weeks |

---

## 10. The AI / ML Strategy — No Training, No Model, Not Yet

### 10.1 What People Mean When They Say "AI Engine"

When someone says "we're building an AI engine," they usually mean one of three things:

| What they say | What they probably mean | What it actually requires |
|---------------|----------------------|--------------------------|
| "We use AI" | We call an LLM API (Claude/GPT) to generate text | An API key. No training. No model. |
| "We have an AI engine" | We have statistical/rule-based logic that makes decisions | Math. Bayesian inference, decision trees, expert rules. No training. |
| "We trained a model" | We have a custom ML model trained on our proprietary data | Thousands of labeled examples, training infrastructure, evaluation pipeline, versioning, retraining cadence. |

**LongevityPlan.AI is currently #1 and #2. We are nowhere near #3. And that's correct.**

### 10.2 What We Actually Have (And Why It Works Without ML)

**Bayesian posterior engine** — pure statistics, no training:
- Takes raw signals, normalizes against published clinical ranges (LOINC)
- Computes a concern score (P), evidence coverage (C), staleness (S), and precision (p_var)
- Applies deterministic governance rules to classify: ESCALATED / MONITOR / SUPPRESSED
- This is a **statistical inference system**, not a learned model. It works with 3 signals or 300. No training step.

**LLM-as-a-service for narrative generation** — API call, no training:
- The intelligence endpoint can call Claude Haiku to turn structured signal data into a human-readable narrative
- The LLM already knows about HRV, CRP, peptides, training phases from its pre-training corpus
- We provide the patient's data as context (RAG pattern) → it generates the insight
- **Zero training pairs needed.** We're leveraging the LLM's existing knowledge with our structured data as grounding.

**Deterministic governance rules** — expert system, no training:
- "If P ≥ 0.85 AND C ≥ 0.70 AND S ≤ 14 days → ESCALATED"
- A coach or physician can read the rule, understand it, and audit it
- No black box. No model weights. No drift. No retraining.

**Protocol response curves** — parameterized from published literature, no training:
- BPC-157 onset at 1 week, peak at 6 weeks — from clinical studies
- Semaglutide onset at 2 weeks, peak at 16 weeks — from trial data
- These are **encoded priors from research**, not learned from our data

### 10.3 The Training Data Problem — Why We Can't Train Yet

To train a real ML model for peptide efficacy prediction, we'd need:

```
INPUT (features):
  - Athlete baseline: age, sex, sport, fitness level, body composition
  - Starting signal state: HRV, resting HR, CRP, testosterone, sleep, etc.
  - Protocol prescribed: which peptide(s), dosage, start date

OUTPUT (label):
  - Outcome at week 4, 8, 12: did CRP drop? Did HRV improve? 
    Did pain score decrease? By how much? 
  - Confirmed by blood panel (not just self-report)

REQUIRED VOLUME:
  - Minimum ~500–1,000 labeled patient-protocol-outcome triplets 
    per protocol for a useful supervised model
  - Ideally with 2+ blood panels per patient (baseline + follow-up)
  - That's 5,000–10,000 real patients across all 11 protocols
```

**We have zero of this.** Our 200 subjects are synthetic. The signal events are generated from storyline curves, not observed from real humans. Training on synthetic data teaches the model our assumptions, not reality.

### 10.4 The Path to Real Training Data

The platform itself IS the data collection instrument. Every real athlete who connects creates training pairs:

```
Phase 1 — NOW (0 patients, 0 training pairs)
├── Bayesian engine + LLM narratives + deterministic rules
├── All "intelligence" comes from statistics and pre-trained LLMs
├── VALUE: The platform works. Coaches get useful insights.
└── DATA: Nothing to train on.

Phase 2 — FIRST 100 REAL PATIENTS (6–12 months)
├── Each patient: wearable data (daily) + blood panels (quarterly)
├── Each protocol assignment becomes a natural experiment:
│   "Patient X started BPC-157 on Day 30. CRP at Day 0 was 4.2.
│    CRP at Day 90 was 1.1. Recovery score improved 22%."
├── That's ONE labeled training pair.
├── With 100 patients × 2 protocols average × 2 blood panels = 400 pairs
├── Not enough to train. Enough to VALIDATE our Bayesian priors.
└── DATA: Validate response curves. Refine onset/peak parameters.

Phase 3 — 1,000+ REAL PATIENTS (12–24 months)
├── 1,000 patients × 2 protocols × 3 blood panels = 6,000 pairs
├── NOW we can train:
│   - Protocol efficacy predictor (random forest or gradient boosted)
│   - Risk stratification model (who needs intervention earliest)
│   - Anomaly detector (signal patterns that precede adverse events)
│   - Personalized response curves (cluster patients by baseline → predict trajectory)
├── Training infrastructure: ONNX Runtime for serving, Python for training
└── DATA: The cohort prior is no longer synthetic. It's real.

Phase 4 — 10,000+ PATIENTS (24+ months)
├── Network effect: every new patient improves predictions for all patients
├── Fine-tune domain-specific LLM for narrative generation
│   (trained on physician-reviewed intelligence summaries)
├── Causal inference: which protocol combos work best for which profiles?
└── THIS is the moat. No competitor has this longitudinal peptide dataset.
```

### 10.5 What We Can Do NOW Without Training (Concrete Alternatives)

These require zero proprietary training data:

| Technique | What It Does | Training Required? | Available Now? |
|-----------|-------------|-------------------|----------------|
| **Bayesian posterior** | Fuses multi-signal evidence into concern/confidence scores | No — pure math | Yes (built) |
| **LLM-as-a-service (RAG)** | Generates narratives from structured patient data + LLM knowledge | No — API call with context window | Yes (built, Claude Haiku) |
| **Published literature priors** | Encodes peptide response curves from clinical trials | No — manually parameterized | Yes (built, 11 protocols) |
| **Pre-trained time-series models** | Prophet / NeuralProphet for signal forecasting (HR, HRV, sleep trends) | Pre-trained on general time-series, fine-tune on per-patient data | Could add in 1–2 weeks |
| **Isolation forests** | Anomaly detection on signal patterns (flag unusual readings) | Unsupervised — no labels needed | Could add in 1 week |
| **K-nearest neighbors on cohort** | "Athletes most similar to this one responded like X" | No training — distance computation on existing population | Could add in 1–2 days |
| **Clinical decision support rules** | IF cortisol > 20 AND sleep < 360 min AND training_phase = 'build' THEN flag overtraining | No — expert-authored rules | Could add as we learn from coaches |

The KNN approach is particularly interesting: with even 200 synthetic subjects (and eventually real ones), we can answer "among athletes with a similar baseline who started this protocol, what was the typical trajectory?" That's not ML. That's a nearest-neighbor lookup on the signal matrix. It's what our Cohort Proxy Engine is designed to do.

### 10.6 The Honest Statement for Investors

> LongevityPlan.AI does not train or operate a proprietary ML model today. The intelligence layer is powered by Bayesian statistical inference, deterministic governance rules, and LLM-as-a-service for narrative generation. None of these require proprietary training data.
>
> The platform IS the training data collection instrument. Every real patient who connects a wearable, completes a blood panel, and follows a protocol generates a labeled cause-effect pair: baseline signals → intervention → outcome signals. This longitudinal peptide-outcome dataset does not exist anywhere in the market today.
>
> At approximately 1,000 real patients with 2+ blood panels each, we will have sufficient labeled data to train supervised models for protocol efficacy prediction, risk stratification, and personalized response curves. At 10,000+ patients, the dataset becomes a defensible moat — every new patient improves predictions for every existing patient.
>
> Until then, the Bayesian engine and clinical decision rules provide high-quality, auditable, explainable decision support without any ML black box.

---

## 11. Summary — What We Have, What It Costs, What It Proves

**What exists today:**
- 26 health signals mapped to LOINC/FHIR standards
- 30+ data source definitions with auth types and signal mappings
- 11 peptide protocols with response curve parameters
- PostgreSQL schema with multi-tenant isolation and audit foundation
- 200 synthetic athletes with 150K+ signal events across 90 days (43 MB)
- Bayesian posterior engine (P/C/S/p_var) with governance rules
- Intelligence API generating contextual coach narratives
- WASM Digital Twin with chi-flow visualization and protocol projection
- Coach dashboard with sidebar, athlete table, 5-tab detail view
- API payloads small enough for mobile (78 KB for full experience)

**What it proves:**
- The data model works against real clinical standards
- The Bayesian engine produces actionable governance decisions
- The intelligence layer generates narratives a coach can read in 5 seconds
- The WASM Twin runs client-side with zero server compute
- The synthetic-to-real swap path requires zero schema changes
- The whole thing deploys on Render free tier (for demo) or HIPAA-eligible infrastructure (for production)

**What it doesn't prove yet:**
- That coaches will actually use it (needs real users)
- That the intelligence narratives are clinically accurate (needs physician review)
- That the Bayesian engine calibrates correctly with real data (needs real signal events)
- That the platform can onboard a real athlete from OAuth consent to first insight (needs integration adapters)

That's the honest state. The data architecture is sound. The science pipeline is built. The experience needs the write layer and the mobile client to close the loop.

# Data Inventory — Synthetic Fields to UX Mapping

> **Rule**: Every field the frontend renders MUST trace back to a seeded synthetic value,
> an API route that serves it, and a real-world data source that will eventually replace it.
> If a field cannot be traced, it is a hallucination. This document is the anti-hallucination contract.

## View Tiers

| Tier | Audience | Philosophy | Data Depth |
|------|----------|-----------|------------|
| **Coach** | Performance coach, trainer | Steve Jobs clean. One headline, one sentence, one action. White space. | Summarized, human language, color-coded urgency only |
| **Clinical** | Practitioner, sports medicine MD, the "drill-down fucker" | Every number, every chart, every reference range. Evidence chains, Bayesian math, raw signals. | Full granularity, lab ranges, correlation matrices |

Both tiers consume the **same API response** — the frontend decides what to show.

---

## 1. Wearable Signals (Daily Cadence)

These arrive continuously from wearable devices. Synthetic seed generates ~85-90 events per subject over 90 days.

| Signal ID | Label | Unit | Normal Range | Full Range | Source* | API Route | Coach View | Clinical View | Seed Status |
|-----------|-------|------|-------------|-----------|---------|-----------|------------|---------------|-------------|
| `resting_hr` | Resting Heart Rate | bpm | 50–70 | 38–100 | WHOOP, Oura, Garmin, Apple Watch, Fitbit, Polar, COROS | `GET /subjects/:id/signals?signal=resting_hr` | Twin glow color | Trend chart + range band | ~89 events/subj |
| `hrv_rmssd` | HRV (RMSSD) | ms | 40–100 | 10–150 | WHOOP, Oura, Garmin, Apple Watch, Fitbit, Polar, COROS | `GET /subjects/:id/signals?signal=hrv_rmssd` | Twin glow color, recovery % | Trend chart + range band + correlation w/ strain | ~87 events/subj |
| `sleep_duration` | Sleep Duration | min | 420–540 | 180–660 | WHOOP, Oura, Garmin, Apple Watch, Fitbit | `GET /subjects/:id/signals?signal=sleep_duration` | "Sleep" summary word | Trend chart | ~85 events/subj |
| `sleep_quality` | Sleep Quality Score | score | 70–95 | 10–100 | WHOOP, Oura, Garmin, Fitbit, Polar | `GET /subjects/:id/signals?signal=sleep_quality` | "Sleep" summary word | Trend chart + range band | ~85 events/subj |
| `recovery_score` | Recovery Score | score | 60–95 | 5–100 | WHOOP, Oura, Fitbit | `GET /subjects/:id/signals?signal=recovery_score` | Recovery % on twin, headline | Trend chart, protocol tracking | **0 events — BUG** |
| `strain_score` | Daily Strain | score | 8–16 | 0–21 | WHOOP, Garmin, Strava, TrainingPeaks, Polar, COROS | `GET /subjects/:id/signals?signal=strain_score` | Twin glow intensity | Trend chart, load analysis | ~85 events/subj |
| `active_calories` | Active Calories | kcal | 300–800 | 0–2000 | All wearables + Strava/TrainingPeaks/Peloton | `GET /subjects/:id/signals?signal=active_calories` | — | Trend chart | ~85 events/subj |
| `steps` | Daily Steps | steps | 7k–12k | 500–30k | All wearables | `GET /subjects/:id/signals?signal=steps` | — | Trend chart | ~86 events/subj |

### Root Cause of `recovery_score` = 0 events

The seed generator filters daily signals via: `SIGNAL_CADENCE.daily.filter(s => wearableSignals.has(s) || domainSignals.has(s))`.
`recovery_score` is in `SIGNAL_CADENCE.daily` and in `DOMAIN_SIGNALS.sleep_recovery` and `DOMAIN_SIGNALS.musculoskeletal`.
However, the wearable profiles for subjects whose primary domain is NOT `sleep_recovery` or `musculoskeletal` may not include `recovery_score` in their wearable's signal list AND the domain check only uses the subject's **primary** domain. A subject with `primaryDomain: 'cardiovascular'` gets `DOMAIN_SIGNALS.cardiovascular` which does NOT include `recovery_score`. **Fix**: also include signals from ALL `activeDomains`, not just primaryDomain.

---

## 2. Lab / Biomarker Signals (Periodic Cadence — every 6–26 weeks)

These arrive from blood draws at lab providers. Synthetic seed generates 1-3 draws per subject over 90 days depending on `biomarkerProfile`.

### Currently Seeded

| Signal ID | Label | Unit | Normal Range | Full Range | Source* | API Route | Coach View | Clinical View | Seed Status |
|-----------|-------|------|-------------|-----------|---------|-----------|------------|---------------|-------------|
| `lab_a1c` | HbA1c | % | 4.2–5.6 | 3.5–10.0 | Function Health, InsideTracker, Wild Health, Quest*, LabCorp*, Marek | `GET /subjects/:id/signals?signal=lab_a1c` | — | Marker card + range badge | ~1 event/subj |
| `lab_testosterone` | Testosterone | ng/dL | 400–900 | 100–1500 | Same as above | `GET /subjects/:id/signals?signal=lab_testosterone` | — | Marker card + range badge | ~1 event/subj |
| `lab_crp` | C-Reactive Protein | mg/L | 0.1–1.0 | 0.05–15 | Same as above | `GET /subjects/:id/signals?signal=lab_crp` | "Inflammation" word if elevated | Marker card + trend | ~1 event/subj |
| `lab_vitamin_d` | Vitamin D (25-OH) | ng/mL | 30–60 | 5–100 | Same as above | `GET /subjects/:id/signals?signal=lab_vitamin_d` | — | Marker card + range badge | ~1 event/subj |
| `lab_cortisol` | Cortisol (AM) | mcg/dL | 6–18 | 1–35 | Same as above | `GET /subjects/:id/signals?signal=lab_cortisol` | "Stress" word if elevated | Marker card + trend | ~1 event/subj |
| `lab_thyroid_tsh` | TSH | mIU/L | 0.5–4.0 | 0.01–20 | Same as above | `GET /subjects/:id/signals?signal=lab_thyroid_tsh` | — | Marker card + range badge | ~1 event/subj |

### NEW — Required by Mockups (Not Yet in Schema)

| Signal ID | Label | Unit | Normal Range | Athletic Optimal | Full Range | Source* | Mockup Screen | View Tier | Provider |
|-----------|-------|------|-------------|-----------------|-----------|---------|---------------|-----------|----------|
| `lab_hemoglobin` | Hemoglobin | g/dL | 12.0–17.5 (sex-dependent) | M: 14.5–16.5, F: 13.0–15.0 | 7–20 | Function Health, InsideTracker, Wild Health, Quest*, LabCorp*, Marek | Labs > Oxygen Delivery, Evidence Chain | Clinical | Labs |
| `lab_hematocrit` | Hematocrit | % | 36–50 (sex-dependent) | M: 42–48, F: 38–44 | 20–60 | Same | Labs > Oxygen Delivery | Clinical | Labs |
| `lab_ferritin` | Ferritin | ng/mL | 20–200 | Athletic: 30+ (F), 50+ (M) | 5–500 | Same | Labs > Oxygen Delivery, Twin callout, Evidence Chain, Mia's Story | Both (coach: "iron low") | Labs |
| `lab_iron` | Iron (Serum) | mcg/dL | 60–170 | 80–150 | 10–300 | Same | Labs > Oxygen Delivery | Clinical | Labs |
| `lab_transferrin_sat` | Transferrin Saturation | % | 20–50 | 25–45 | 5–80 | Same | Labs > Oxygen Delivery | Clinical | Labs |
| `lab_creatine_kinase` | Creatine Kinase | U/L | 30–200 | 50–300 post-exercise ok | 10–2000 | Same | Evidence Chain (Jake's Injury Risk), Twin callout | Both (coach: "muscle damage") | Labs |
| `lab_fasting_glucose` | Fasting Glucose | mg/dL | 70–99 | 75–90 | 40–200 | Same | Labs > Metabolic markers | Clinical | Labs |
| `lab_iron_saturation` | Iron Saturation | % | 20–50 | 25–45 | 5–80 | Same (alias of transferrin_sat, some labs report differently) | Labs tab | Clinical | Labs |

> **\* = Source not yet integrated**. All lab providers above deliver these markers in standard CBC / CMP / iron panels. The signal schema is identical — only the `source_type` field changes when a real provider replaces synthetic data.

---

## 3. Self-Report & Practitioner Signals (Weekly / Event Cadence)

| Signal ID | Label | Unit | Normal Range | Full Range | Source | API Route | Coach View | Clinical View | Seed Status |
|-----------|-------|------|-------------|-----------|--------|-----------|------------|---------------|-------------|
| `self_energy` | Self-Reported Energy | score | 6–9 | 1–10 | In-app questionnaire | `GET /subjects/:id/signals?signal=self_energy` | "Feels tired" / "Feels good" | Trend chart | **0 events — BUG** |
| `self_pain` | Self-Reported Pain | score | 0–2 | 0–10 | In-app questionnaire | `GET /subjects/:id/signals?signal=self_pain` | "Pain reported" alert | Trend chart | **0 events — BUG** |
| `practitioner_note` | Practitioner Observation | text | — | — | Coach/MD manual entry | `GET /subjects/:id/signals?signal=practitioner_note` | — | Note history | Not seeded (event-based) |
| `nutrition_calories` | Daily Calorie Intake | kcal | 1800–2800 | 800–5000 | MyFitnessPal, Cronometer, MacroFactor*, Carbon* | `GET /subjects/:id/signals?signal=nutrition_calories` | — | Nutrition trend | **0 events — BUG** |
| `nutrition_protein` | Daily Protein | g | 100–200 | 20–400 | Same | `GET /subjects/:id/signals?signal=nutrition_protein` | — | Nutrition trend | **0 events — BUG** |

### Root Cause of self_energy / self_pain = 0 events

The seed generates weekly signals via: `SIGNAL_CADENCE.weekly.filter(s => domainSignals.has(s))`.
`self_energy` appears in `DOMAIN_SIGNALS` for `sleep_recovery` and `cognitive` only.
`self_pain` appears in `DOMAIN_SIGNALS` for `musculoskeletal` only.
A subject with `primaryDomain: 'cardiovascular'` gets NONE of these. **Fix**: same as recovery_score — use all `activeDomains`.

### Root Cause of nutrition_calories / nutrition_protein = 0 events

These are in `SIGNAL_CADENCE.daily` but only in `DOMAIN_SIGNALS.metabolic` and `DOMAIN_SIGNALS.musculoskeletal`.
Additionally, they require a **nutrition app** data source (MyFitnessPal, Cronometer) but the seed doesn't connect nutrition apps as data sources — only wearable + biomarker + self_report. **Fix**: add nutrition app to connected sources when a subject's `activeDomains` includes `metabolic`.

---

## 4. Athlete Profile Fields (Subject Metadata)

Currently stored on `subjects` table. Required by mockup profile views.

| Field | Current Schema | Mockup Uses | View Tier | Seed Status |
|-------|---------------|-------------|-----------|-------------|
| `display_name` | `text` | Header, sidebar, cards | Coach | Seeded (200 names) |
| `date_of_birth` | `text` | Age calculation | Coach (as age) | Seeded |
| `sex` | `enum M/F/other` | Labs reference ranges (sex-dependent), profile | Clinical | Seeded |
| `fitness_level` | `enum low/med/high` | Context for ranges | Clinical | Seeded |
| `active_domains` | `jsonb` | Domain pills on header | Both | Seeded |
| `governance_band` | `enum` | "Needs Attention" / "Monitor" / "On Track" badge | Coach | Seeded |
| `governance_reason` | `text` | Reason card | Coach (simplified), Clinical (full) | Seeded |
| `posterior_p` | `real` | Score ring, sort order | Clinical (coach sees color only) | Seeded |
| `posterior_p_var` | `real` | Precision badge | Clinical | Seeded |
| `posterior_c` | `real` | Evidence score ring | Clinical | Seeded |
| `posterior_s` | `real` | Freshness score ring | Clinical | Seeded |
| **`sport`** | **NOT IN SCHEMA** | "Marathon", "Cycling", "Triathlon" badge on header | Coach | **MISSING** |
| **`height_cm`** | **NOT IN SCHEMA** | Profile card | Clinical | **MISSING** |
| **`weight_kg`** | **NOT IN SCHEMA** | Profile card, BMI calc | Clinical | **MISSING** |
| **`training_phase`** | **NOT IN SCHEMA** | "RECOVERY", "TAPER", "BUILD" badge | Coach | **MISSING** |
| **`calorie_target`** | **NOT IN SCHEMA** | Profile card | Clinical | **MISSING** |
| **`coach_notes`** | **NOT IN SCHEMA** | Editable free text area | Coach | **MISSING** |
| **`races`** | **NOT IN SCHEMA** | Race History table, "Boston Marathon in 9d" countdown | Coach (next race only), Clinical (full history) | **MISSING** |

> Note: `athleteType` already exists in the seed generator's `GeneratedSubject` type but is **never persisted to the database**. Fix: persist it as `sport`.

---

## 5. Computed / Intelligence Fields (Not Stored — Derived at Query Time)

These fields do NOT exist in the database. They are computed by the `/subjects/:id/intelligence` API route from existing stored data.

| Computed Field | Derivation | Coach View | Clinical View | API Route |
|---------------|-----------|------------|---------------|-----------|
| **`headline`** | Highest-P domain + governance reason, compressed to ≤8 words | "Injury Risk — Recovery Stalled" | Same | `GET /subjects/:id/intelligence` → `coach_summary.headline` |
| **`body`** | Top 2-3 degraded signals + magnitude of change, 1-2 sentences | "Muscle strain up 4x. Recovery dropped 40%." | — | `coach_summary.body` |
| **`action`** | Rule-based from governance band + protocol state + signal trends | "Reduce load to Zone 1, 7 days" | — | `coach_summary.action` |
| **`urgency`** | `governance_band` mapped to `high/medium/low/info` | Color-coded card border | — | `coach_summary.urgency` |
| **`primary_finding`** | Name + description of the constraint | — | "Injury Risk — Constrained" + narrative | `clinical.primary_finding` |
| **`evidence_chain`** | Blood markers + wearable signals correlated to the finding | — | Blood card + Wearable card + chart | `clinical.evidence_chain[]` |
| **`performance_systems`** | Per-domain aggregate scores (0-100) | — | "Recovery 52, Muscle Damage 96, ..." chips | `clinical.performance_systems{}` |
| **`lab_markers`** | All lab signals with current value, range badge, trend, last draw date | — | Marker card grid | `clinical.lab_markers[]` |
| **`actions`** | Rule-based clinical next steps | — | Checklist | `clinical.actions[]` |
| **`protocol_tracking`** | Per-protocol: monitored signal trend + improving/worsening badge | Protocol name only | Trend chart + narrative | `clinical.protocol_tracking[]` |

---

## 6. Organizational / Admin Fields

| Field | Current Schema | Mockup Uses | View Tier | Seed Status |
|-------|---------------|-------------|-----------|-------------|
| `organizations.name` | `text` | Org header | Admin | Seeded (1 org) |
| `practitioners.name` | `text` | Coach Roster table, sidebar identity | Admin | Seeded |
| `practitioners.specialty` | `text` | Coach Roster column | Admin | Seeded |
| **Athlete count per coach** | **NOT IN SCHEMA** — no `practitioner_id` on `subjects` | Coach Roster "Athletes" column | Admin | **MISSING** (need practitioner assignment) |
| **Protocol compliance %** | **NOT IN SCHEMA** — no adherence tracking | Org stats card, Coach Roster column | Admin | **MISSING** |
| **Performance compliance %** | **NOT IN SCHEMA** — no performance target tracking | Org stats card | Admin | **MISSING** |

---

## 7. Data Source Providers — Which Labs Provide Which Signals

This table maps every signal to which real-world providers deliver it, so when we replace synthetic data, we know exactly which adapter to build.

### Wearable Signals

| Signal | Oura | WHOOP | Garmin | Apple Watch | Fitbit | Polar | COROS | Strava | TrainingPeaks |
|--------|------|-------|--------|-------------|--------|-------|-------|--------|---------------|
| resting_hr | Y | Y | Y | Y | Y | Y | Y | — | — |
| hrv_rmssd | Y | Y | Y | Y | Y | Y | Y | — | — |
| sleep_duration | Y | Y | Y | Y | Y | — | Y | — | — |
| sleep_quality | Y | Y | Y | — | Y | Y | — | — | — |
| recovery_score | Y | Y | — | — | Y | — | — | — | — |
| strain_score | — | Y | Y | — | — | Y | Y | Y | Y |
| active_calories | — | — | Y | Y | Y | — | Y | Y | Y |
| steps | — | — | Y | Y | Y | — | — | — | — |

### Lab / Biomarker Signals

| Signal | Function Health | InsideTracker | Wild Health | Quest* | LabCorp* | Marek | Panel Type |
|--------|----------------|---------------|------------|--------|----------|-------|------------|
| lab_a1c | Y | Y | Y | Y | Y | Y | Metabolic / CMP |
| lab_testosterone | Y | Y | Y | Y | Y | Y | Hormone |
| lab_crp | Y | Y | Y | Y | Y | Y | Inflammation |
| lab_vitamin_d | Y | Y | Y | Y | Y | Y | Micronutrient |
| lab_cortisol | Y | Y | Y | Y | Y | Y | Hormone / Stress |
| lab_thyroid_tsh | Y | Y | Y | Y | Y | Y | Thyroid |
| **lab_hemoglobin** | Y | Y | Y | Y | Y | Y | **CBC** |
| **lab_hematocrit** | Y | Y | Y | Y | Y | Y | **CBC** |
| **lab_ferritin** | Y | Y | Y | Y | Y | Y | **Iron Panel** |
| **lab_iron** | Y | Y | Y | Y | Y | Y | **Iron Panel** |
| **lab_transferrin_sat** | Y | Y | Y | Y | Y | Y | **Iron Panel** |
| **lab_creatine_kinase** | Y | Y | Y | Y | Y | Y | **Muscle / CMP** |
| **lab_fasting_glucose** | Y | Y | Y | Y | Y | Y | **Metabolic / CMP** |

> **\*** = Provider not yet integrated (future roadmap). Signals are identical — only the `source_type` field on the event changes.

### Nutrition Signals

| Signal | MyFitnessPal | Cronometer | MacroFactor* | Carbon* |
|--------|--------------|------------|-------------|---------|
| nutrition_calories | Y | Y | Y | Y |
| nutrition_protein | Y | Y | Y | Y |

---

## 8. Mockup Screen → Data Field Mapping

### Coach View — Overview (default landing)

| UI Element | Data Field(s) | API Route | Seeded? |
|-----------|--------------|-----------|---------|
| "Welcome back, John" | `practitioners.name` | `GET /practitioners` | Yes |
| "1 athlete marked as urgent" | `COUNT WHERE governance_band = 'ESCALATED'` | `GET /org/stats` | Yes |
| New Flags count | `COUNT WHERE governance_band changed in last 7d` | `GET /org/stats` | **NEEDS: computed** |
| Check-ins Due count | `session_bookings WHERE status = 'draft'` | **NEEDS: new endpoint** | **NEEDS: seed** |
| Client table: name, phase, recovery sparkline, volume, next race | `subjects.display_name`, `training_phase`, `recovery_score` trend, `strain_score` avg, `races[0]` | `GET /subjects` (extended) | **Partial — needs profile fields + recovery_score fix** |
| Upcoming Races cards | `subjects.races WHERE date > now` | **NEEDS: new endpoint or embedded in subjects** | **NEEDS: races data** |

### Coach View — Athlete Card (one-glance)

| UI Element | Data Field(s) | API Route | Seeded? |
|-----------|--------------|-----------|---------|
| Avatar + Name | `display_name` | `GET /subjects` | Yes |
| "Needs Attention" / "Monitor" / "On Track" badge | `governance_band` | `GET /subjects` | Yes |
| KEY CONSTRAINT: "Injury Risk" | `intelligence.coach_summary.headline` | `GET /subjects/:id/intelligence` | **NEEDS: intelligence API** |
| Domain pills (Recovery, Muscle Damage, etc.) | `active_domains` mapped to labels | `GET /subjects` | Yes |
| Recovery % bar | Latest `recovery_score` signal | `GET /subjects/:id/signals` | **BUG: 0 events** |
| "Tier: Low (2)" | Computed from posterior_p | `GET /subjects` | Yes (derivable) |

### Coach View — Athlete Detail (clean)

| UI Element | Data Field(s) | API Route | Seeded? |
|-----------|--------------|-----------|---------|
| Name + badge + sport + age + phase + race countdown | `display_name`, `governance_band`, `sport`, `date_of_birth`, `training_phase`, `races[0]` | `GET /subjects/:id` | **Partial — needs sport, phase, races** |
| Body twin with glowing regions | `current_snapshot.signal_vector`, signals by domain | WASM + `GET /subjects/:id/snapshots` | Yes |
| Biomarker callouts on twin ("Ferritin +20ng/mL / 5mo") | Latest lab signal value + delta from first draw | `GET /subjects/:id/signals` | **Needs new lab signals** |
| One-line intelligence summary | `intelligence.coach_summary.body` | `GET /subjects/:id/intelligence` | **NEEDS: intelligence API** |
| One action card | `intelligence.coach_summary.action` | `GET /subjects/:id/intelligence` | **NEEDS: intelligence API** |

### Clinical Drill-Down — Intelligence Tab

| UI Element | Data Field(s) | API Route | Seeded? |
|-----------|--------------|-----------|---------|
| Primary Finding: "Injury Risk — Constrained" | `intelligence.clinical.primary_finding` | `GET /subjects/:id/intelligence` | **NEEDS: intelligence API** |
| Key markers table (Cortisol, CK, Vitamin D, HRV, Recovery Score, Last Draw) | Latest value per relevant signal | `GET /subjects/:id/intelligence` → `clinical.evidence_chain` | **Partial — needs new lab signals** |
| Evidence Chain: Blood card | Lab signal with value + ref range + draw date | Same | **Needs new lab signals** |
| Evidence Chain: Wearable card | Wearable signal trend + arrow + delta | Same | Yes (wearable data exists) |
| Correlation chart (CK vs Muscle Readiness) | Two signal time-series overlaid | `GET /subjects/:id/signals` (2 calls) | **Needs CK signal** |
| AI narrative paragraph | LLM-generated or template-based from signal context | `GET /subjects/:id/intelligence` → `clinical.narrative` | **NEEDS: narrative engine** |
| "Discuss with AI" button | Opens thread (future feature) | — | — |

### Clinical Drill-Down — Labs Tab

| UI Element | Data Field(s) | API Route | Seeded? |
|-----------|--------------|-----------|---------|
| Primary Limiter: "Oxygen Delivery" | Highest-concern domain among lab-driven domains | `GET /subjects/:id/intelligence` → `clinical.primary_finding` | **NEEDS** |
| Performance Systems chips (Recovery 77, etc.) | Per-domain score from latest snapshot or computed | `GET /subjects/:id/intelligence` → `clinical.performance_systems` | **NEEDS** |
| Sub-tabs: Overview, Panels, Trends | Frontend routing only | — | — |
| Filter: All, High, Low, Normal | Frontend filter on markers array | — | — |
| Lab marker cards: value, range badge, sparkline, date, % change | All `lab_*` signals for subject, with `signal_meta` enrichment | `GET /subjects/:id/signals?signal=lab_*` | **Partial — needs 7 new signals** |

### Clinical Drill-Down — Protocol Tracking

| UI Element | Data Field(s) | API Route | Seeded? |
|-----------|--------------|-----------|---------|
| Protocol card: name + status + start date | `protocol_assignments.*` | `GET /subjects/:id` → `protocols[]` | Yes |
| Protocol trend chart (HRV over time since protocol start) | Monitored signal time-series, filtered from `started_at` | `GET /subjects/:id/signals?signal=X&since=Y` | Yes (if signal exists) |
| "Improving" / "Worsening" badge | Slope of monitored signal over last 4 weeks | Computed in intelligence API | **NEEDS** |
| Protocol narrative | Template: "{Signal} has improved from X to Y over Z weeks" | `GET /subjects/:id/intelligence` → `clinical.protocol_tracking[].narrative` | **NEEDS** |
| Actions checklist | Rule-based from protocol + signal state | `GET /subjects/:id/intelligence` → `clinical.actions[]` | **NEEDS** |

### Athlete Profile (expandable)

| UI Element | Data Field(s) | API Route | Seeded? |
|-----------|--------------|-----------|---------|
| Integrations: WHOOP / OURA / STRAVA badges | `subject_data_sources[].source_id` mapped to labels | `GET /subjects/:id` → `data_sources[]` | Yes |
| Height / Weight / Sex / BMI | `height_cm`, `weight_kg`, `sex`, computed BMI | `GET /subjects/:id` → `subject.profile` | **NEEDS schema + seed** |
| Race History table | `races[]` JSONB | `GET /subjects/:id` → `subject.races` | **NEEDS schema + seed** |
| Personal Bests | Embedded in `races` or separate field | Same | **NEEDS** |
| Coach Notes | `coach_notes` text | `GET/PATCH /subjects/:id` | **NEEDS schema** |
| Daily Calorie Target | `calorie_target` | `GET /subjects/:id` → `subject.calorie_target` | **NEEDS schema + seed** |

---

## 9. Fix Checklist

### Tier 1 — Seed / Signal Fixes (no schema migration)

- [ ] Fix signal generation to use ALL `activeDomains`, not just `primaryDomain`
- [ ] This automatically fixes: `recovery_score`, `self_energy`, `self_pain`, `nutrition_*` producing 0 events
- [ ] Connect nutrition app data sources for subjects with `metabolic` in activeDomains
- [ ] Generate multi-domain snapshots (one per domain in `activeDomains`, not just primary)

### Tier 2 — New Lab Signals (schema + seed)

- [ ] Add 7 new signal definitions to `HEALTH_SIGNALS`: `lab_hemoglobin`, `lab_hematocrit`, `lab_ferritin`, `lab_iron`, `lab_transferrin_sat`, `lab_creatine_kinase`, `lab_fasting_glucose`
- [ ] Add to `SIGNAL_CADENCE.periodic_lab`
- [ ] Add to `DOMAIN_SIGNALS` mappings (iron panel → cardiovascular; CK → musculoskeletal; glucose → metabolic)
- [ ] Add to all lab provider signal lists in `DATA_SOURCES`
- [ ] Seed generates 2-4 draws per subject over 90 days (matching biomarker cadence)

### Tier 3 — Athlete Profile (schema migration)

- [ ] Add columns to `subjects` table: `sport`, `height_cm`, `weight_kg`, `training_phase`, `calorie_target`, `coach_notes`, `races`
- [ ] Persist `athleteType` (already generated) as `sport`
- [ ] Seed realistic height/weight/BMI by sex and sport
- [ ] Seed training phases: RECOVERY, BASE, BUILD, PEAK, TAPER, RACE
- [ ] Seed race history for hero subjects (matching mockup examples)

### Tier 4 — Intelligence API (new route)

- [ ] `GET /subjects/:id/intelligence` returns `{ coach_summary, clinical }`
- [ ] `coach_summary`: headline (≤8 words), body (1-2 sentences), action (1 sentence), urgency
- [ ] `clinical.primary_finding`: constraint name + affected markers
- [ ] `clinical.evidence_chain[]`: blood + wearable evidence cards
- [ ] `clinical.performance_systems{}`: per-domain 0-100 scores
- [ ] `clinical.lab_markers[]`: all lab signals with range badge + trend
- [ ] `clinical.protocol_tracking[]`: per-protocol trend + improving/worsening
- [ ] `clinical.actions[]`: rule-based clinical next steps

---

## 10. Anti-Hallucination Rules

1. **Every value shown on screen MUST have a `signal_events` row or a `subjects` column backing it.** No frontend-only fabrication.
2. **Every "Below Range" / "Above Range" badge MUST reference `signal_meta.normal_range`.** The range comes from the signal definition, not a hardcoded UI value.
3. **Every trend arrow (up/down/flat) MUST be computed from ≥2 signal events.** One data point = no trend shown.
4. **Every "Improving" / "Worsening" badge MUST be computed from ≥3 data points over ≥14 days.** Slope of linear regression, not just last-vs-first.
5. **If a signal has 0 events for a subject, the UI shows "No data" — never a default value.**
6. **AI narrative text MUST cite specific signal values and dates.** "Ferritin dropped from 35 to 18 ng/mL" — not "Ferritin is low."
7. **Coach view summary MUST be derivable from the clinical data.** It's a compression, not a different data source.
8. **The `source_type` field on every signal event identifies where the data came from.** The UI can show "via WHOOP" or "via Function Health" badges because this field exists.

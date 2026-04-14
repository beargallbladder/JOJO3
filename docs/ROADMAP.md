# LongevityPlan.AI — Platform Roadmap

> Backend infrastructure for the LongevityPlan.AI Digital Twin platform.
> This roadmap covers what's built, what's next, and how we get to production health data at scale.

---

## What's Built (Phase 0 — Now)

### Shared Domain Layer (`packages/shared`)
- **Health types**: Subject, HealthSignalEvent, HealthSnapshot, Practitioner, SessionSlot, SessionBooking, AuditEntry
- **6 health domains**: Cardiovascular, Metabolic, Hormonal, Musculoskeletal, Sleep & Recovery, Cognitive
- **19 health signals**: Daily wearable (HR, HRV, sleep, strain, recovery, steps, calories), periodic labs (A1C, testosterone, CRP, vitamin D, cortisol, TSH), nutrition (calories, protein), self-report (energy, pain), practitioner notes
- **11 peptide protocols**: Tirzepatide, Semaglutide, AOD-9604, Lipo-C, NAD+, Semax/Selank, Glutathione, Sermorelin, MOTS-C, GHK-Cu, BPC-157/TB-500 — with dosing cadences, onset/peak curves, monitored signals
- **5 protocol stacks**: Metabolic Reset, Performance & Longevity, Injury Recovery, Cognitive Edge, Hormonal Optimization
- **30+ data sources**: 8 wearables (Oura, WHOOP, Garmin, Apple Watch, Fitbit, Samsung, Polar, COROS), 6 biomarker labs (Function Health, InsideTracker, Wild Health, Quest, Labcorp, Marek), 4 training apps (Strava, TrainingPeaks, Peloton, Strong), 4 nutrition apps (MFP, Cronometer, MacroFactor, Carbon), 2 EHR systems (Epic, Cerner), self-report, practitioner entry
- **16 body regions**: Heart, lungs, liver, gut, pancreas, thyroid, adrenals, pituitary, upper body, core, lower body, joints, brain (sleep), ANS, brain (cognitive) — each mapped to driving signals and mesh IDs for WASM renderer
- **Digital Twin frame types**: RegionState (thermal, hydration, stress, recovery, healthScore), DigitalTwinFrame, RenderLayer modes

### Health Database Schema (`packages/backend`)
- **organizations** — multi-tenant from day 1 (`org_id` on every table)
- **subjects** — PHI fields identified (display_name, date_of_birth), posterior P/C/S + governance bands
- **health_signal_events** — raw + normalized values, source type, confidence, state
- **health_snapshots** — longitudinal posterior timeline per domain
- **health_governance_actions** — ESCALATED / MONITOR / SUPPRESSED with reasons
- **practitioners** — specialties, certifications, location
- **session_slots** + **session_bookings** — scheduling with capacity
- **protocol_assignments** — which peptide/intervention, start date, dosing, status
- **subject_data_sources** — which platforms connected, last sync
- **audit_log** — every data access logged (actor, action, resource, PHI flag, IP, timestamp)

### Synthetic Data Generator
- **200 subjects** with realistic profiles (age, sex, fitness level, athlete type, metro area)
- **10 health storylines**: Overtraining Spiral, Metabolic Improvement, Hormonal Response, Sleep Disruption, Post-Injury Recovery, Stress-Driven Decline, New Client Baseline, Plateau, Strong Responder, Data Gap
- **Multi-platform data**: Each subject has assigned wearable profile + biomarker provider + nutrition app
- **Protocol response curves**: Signals modulated by peptide onset/peak timing
- **90 days longitudinal**: Daily wearable signals, weekly self-reports, periodic lab draws, posterior snapshots
- **Governance engine**: Same P/C/S → band logic from vehicle domain, now health-contextualized

### Existing Vehicle Demo (still functional)
- Full Hono API with routes (leads, VIN, dealers, FSR, booking, voice, TTS, ops)
- Next.js frontend with lead table, VIN detail, pillar constellation, governance panel, voice overlay, scheduling
- Anthropic voice streaming with structured context → natural language

---

## Phase 1 — Health API Routes + Frontend Reskin (Weeks 1-3)

### Backend
- [ ] Health routes: `/subjects` (list + filter), `/subjects/:id` (detail + signals + timeline + governance)
- [ ] Health voice service: Rewrite system prompts for health/coaching context
- [ ] Practitioners routes: `/practitioners` (search), `/practitioners/:id/slots` (availability)
- [ ] Session booking routes: draft → held → confirmed → completed
- [ ] Protocol routes: `/subjects/:id/protocols` (list active, assign new)
- [ ] Data source routes: `/subjects/:id/sources` (connected platforms, last sync)

### Frontend
- [ ] Reskin lead table → Subject list (name, governance band, primary domain, protocol stack, last signal)
- [ ] Subject detail page → Signal constellation + timeline + governance panel + voice overlay
- [ ] Protocol panel: Active protocols with response timeline
- [ ] Connected sources panel: Which wearables/labs are feeding data
- [ ] Scheduling drawer: Book practitioner sessions

---

## Phase 2 — WASM Digital Twin Renderer (Weeks 3-6)

### Architecture
- [ ] Rust/C++ body mesh engine compiled to WASM
- [ ] WebGL canvas in Next.js consuming `DigitalTwinFrame` data from API
- [ ] 6 render layers: thermal, recovery, stress, hydration, protocol_impact, composite
- [ ] 16 body regions receiving per-frame `RegionState` updates
- [ ] Interpolation at 60fps between server-side snapshot frames
- [ ] Protocol impact overlay: highlight regions affected by active peptides

### Data Contract
- [ ] `/subjects/:id/twin-frame` endpoint returning `DigitalTwinFrame`
- [ ] Compute `RegionState` from latest signal values per region's driving signals
- [ ] WebSocket option for live-updating frames as new signals arrive

---

## Phase 3 — Authentication & Authorization (Weeks 4-6)

### Architecture Decisions
- JWT with role claims (practitioner, client, admin, org-admin)
- Hono middleware for token validation + org_id scoping
- `org_id` already on every table — queries filter automatically

### Implementation
- [ ] Auth service: signup, login, token refresh, password reset
- [ ] RBAC middleware: practitioner sees their clients, client sees their own data, admin sees org
- [ ] Client consent model: which data sources a client has authorized to share
- [ ] API key management for white-label API customers (usage-metered)

### Options (pick one)
- **Clerk** — fastest to ship, handles social login, org management built-in
- **Auth.js (NextAuth)** — self-hosted, flexible, no vendor lock
- **Custom JWT** — full control, more work, needed for white-label API keys anyway

---

## Phase 4 — HIPAA Compliance Posture (Weeks 5-8)

### Data at Rest
- [ ] PHI field encryption: `display_name`, `date_of_birth`, `contact` via pgcrypto or app-level AES-256-GCM
- [ ] Non-PHI analytic fields (scores, bands, signals) stay unencrypted for query performance
- [ ] Encryption key management: AWS KMS or Vault (not hardcoded env vars)

### Data in Transit
- [ ] TLS everywhere (already true for Render HTTPS, enforce HSTS)
- [ ] Internal service-to-service mTLS if we add microservices

### Audit Trail
- [ ] Audit log table already exists — wire middleware to populate it on every API call
- [ ] Log: who (actor_id), what (action + resource), when, from where (IP), PHI touched (boolean)
- [ ] Retention policy: 7 years minimum per HIPAA

### Hosting
- [ ] Move off Render free tier → HIPAA-eligible hosting
  - Option A: Render paid with BAA
  - Option B: AWS (RDS + ECS/Fargate) with BAA
  - Option C: Supabase with BAA for Postgres + auth
- [ ] BAA chain: us → hosting provider → any subprocessor

### Access Controls
- [ ] Row-level security in Postgres keyed on `org_id` (defense in depth beyond app middleware)
- [ ] Minimum necessary access: practitioners only see assigned clients
- [ ] Break-glass audit for admin override access

### Policies (non-code)
- [ ] Privacy policy update for PHI handling
- [ ] Breach notification procedure (72-hour window)
- [ ] Employee training documentation
- [ ] Risk assessment document

---

## Phase 5 — Real Data Integrations (Weeks 6-12+)

### Priority 1 — Planned (OAuth2)
| Source | Type | Auth | Notes |
|--------|------|------|-------|
| Oura | Wearable | OAuth2 | Well-documented API, daily summaries |
| WHOOP | Wearable | OAuth2 | Requires partner approval |
| Garmin | Wearable | OAuth2 | Health API + Connect IQ |
| Apple Watch | Wearable | HealthKit | Requires mobile app for sync |
| Fitbit | Wearable | OAuth2 | Google Health Connect migration |
| Strava | Training | OAuth2 | Activity + fitness data |
| TrainingPeaks | Training | OAuth2 | TSS/CTL/ATL |
| MyFitnessPal | Nutrition | OAuth2 | Calorie + macro data |
| Cronometer | Nutrition | OAuth2 | Detailed micro/macro |
| Function Health | Lab | API key | Quarterly panels |
| InsideTracker | Lab | API key | Biomarker + optimal zones |
| Wild Health | Lab | API key | Precision medicine |

### Priority 2 — Future
| Source | Type | Auth | Notes |
|--------|------|------|-------|
| Samsung Health | Wearable | OAuth2 | Galaxy Watch ecosystem |
| Polar | Wearable | OAuth2 | Training-focused |
| COROS | Wearable | OAuth2 | Outdoor athletes |
| Quest / Labcorp | Lab | FHIR | Standard clinical results |
| Marek Health | Lab | API key | Hormone panels |
| Epic MyChart | EHR | FHIR R4 | Multi-month project |
| Cerner | EHR | FHIR R4 | Oracle Health transition |

### Integration Architecture
- [ ] Adapter pattern: one adapter per source, all normalize to `HealthSignalEvent` schema
- [ ] OAuth2 token store with refresh (encrypted, per-subject)
- [ ] Webhook receivers for real-time push (Oura, WHOOP)
- [ ] Polling jobs for pull-based APIs (Garmin, Strava)
- [ ] Lab result parser: handle different formats, normalize to signal events
- [ ] Manual entry UI for practitioners (notes, ad-hoc labs)

---

## Phase 6 — Mobile App (Weeks 8-14)

### Options
- **React Native / Expo** — shared TS codebase with web, fastest path
- **PWA** — no app store, works now, limited HealthKit access
- **Flutter** — strong native feel, separate language (Dart)

### Recommendation: Expo + React Native
- Share `@gravity/shared` types and constants
- HealthKit bridge for Apple Watch data (required for direct device sync)
- Push notifications for governance alerts
- Offline-capable signal logging

### MVP Scope
- [ ] Client view: my signals, my protocols, my timeline, my practitioner
- [ ] Coach view: client portfolio, governance alerts, quick actions
- [ ] HealthKit sync adapter
- [ ] Push notifications for ESCALATED governance transitions

---

## Phase 7 — Intelligence Layer / ML (Weeks 10-16+)

### Near-term (rules + statistics)
- [ ] Governance engine is already rule-based (P/C/S → band) — this works and is explainable
- [ ] Population baseline comparison: percentile ranking against similar subjects
- [ ] Trend detection: 7-day / 30-day slope on each signal
- [ ] Protocol response scoring: is this peptide actually moving the monitored signals?

### Medium-term (learned models)
- [ ] Per-subject trajectory prediction (next 30 days given current signals)
- [ ] Anomaly detection: flag signals that deviate from personal baseline
- [ ] Protocol recommendation engine: given subject profile + goals, suggest protocol stack
- [ ] Dosing optimization: given response curves, suggest adjustments

### Long-term (Digital Twin ML)
- [ ] Cardiorespiratory Digital Twin: VO2max estimation from wearable data
- [ ] Peptide pharmacokinetic modeling per subject
- [ ] Multi-domain interaction modeling (sleep affects hormonal affects metabolic)
- [ ] Simulation: "what if we add Sermorelin to this client's stack?"

---

## Data Storage Strategy

### PostgreSQL (primary)
- All structured data: subjects, signals, snapshots, protocols, audit
- Multi-tenant via `org_id` on every table
- PHI fields encrypted at rest (pgcrypto or app-level AES)
- Non-PHI analytics fields unencrypted for query performance
- Estimated storage: ~50MB per 1000 active subjects per year (daily signals + periodic labs + snapshots)

### Cost Model
| Subjects | Signals/year | Storage | Hosting (est.) |
|----------|-------------|---------|----------------|
| 1,000 | ~5M rows | ~500MB | $50/mo (Render) |
| 10,000 | ~50M rows | ~5GB | $200/mo (AWS RDS) |
| 100,000 | ~500M rows | ~50GB | $800/mo (AWS RDS) |

### Scale-out Path
- Partition `health_signal_events` by `org_id` + month when row count exceeds 100M
- TimescaleDB extension for time-series query optimization (drop-in for Postgres)
- Read replicas for dashboard queries, primary for writes
- Archive cold data (>1 year) to S3 + Athena for compliance retention

---

## Run the Health Seed

```bash
# Ensure Postgres is running with the gravity_leads database
cd packages/backend
FORCE_SEED=1 npx tsx src/db/seed/health-seed.ts
```

This creates 200 subjects × 90 days of longitudinal data across all signal types, protocols, and governance states.

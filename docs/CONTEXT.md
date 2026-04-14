# JOJO3 — Project Context

> Single source of truth for any agent or human picking this up cold.
> Last updated: 2026-04-14

---

## What This Is

Backend + frontend infrastructure platform for **LongevityPlan.AI** — a B2B/B2C health optimization company that sells peptide therapy protocols and AI-powered coaching to practitioners, coaches, athletes, and patients.

LongevityPlan.AI has the brand, the physician network, the pharmacy supply chain (503A compounding), the content engine (30+ research articles), and the GTM. **They do not have a backend.** We are the product engineering that makes their platform claims real.

**Repo:** `https://github.com/beargallbladder/JOJO3.git` (branch: `main`)

---

## Architecture

### Monorepo Structure

```
packages/
  shared/        — Types, constants, domain model (consumed by backend + frontend)
  backend/       — Hono API on Node, Drizzle ORM + PostgreSQL
  frontend/      — Next.js 14 coach dashboard (React Query, Framer Motion, Tailwind)
  wasm-twin/     — Rust → WASM Digital Twin computation engine
scripts/         — Utility scripts (Python health data generator)
docs/            — ROADMAP.md, this file
```

### Stack

| Layer | Tech | Notes |
|-------|------|-------|
| API | **Hono** (TypeScript) | Lightweight, fast, middleware-based |
| ORM | **Drizzle** | Type-safe, SQL-first |
| DB | **PostgreSQL** | Multi-tenant via `org_id` on every table |
| Frontend | **Next.js 14** | App router, React Query, Tailwind, Framer Motion |
| WASM Digital Twin | **Rust → wasm32** | Browser-side body renderer: heat diffusion, region state computation, color interpolation, temporal animation. 138KB binary |
| Voice/AI | **Anthropic** (Claude Haiku) | Streaming SSE explanations from structured context |
| Deploy | **Render** | `render.yaml` at root. Free tier for demo; HIPAA-eligible paid tier for prod |
| Future ML | **Python train → ONNX serve in TS** | Avoids two-runtime tax at serving time |

---

## Domain Model (The Core Insight)

The system is a **multi-signal evidence fusion engine with governance**. It was originally built for vehicle health (VIN monitoring) and has been fully pivoted for human health. The core pattern is domain-agnostic:

1. **Collect signals** from multiple sources (wearables, labs, self-reports, practitioner notes)
2. **Assess confidence** — what do we know vs. what's missing
3. **Score risk** — posterior P (concern), C (evidence coverage), S (staleness), **p_var** (precision of P)
4. **Govern action** — deterministic rules produce ESCALATED / MONITOR / SUPPRESSED with human-readable reasons that include precision labels ("82% concern, high confidence" vs "82% concern, limited data")
5. **Explain in natural language** — Anthropic voice layer takes structured context → coach-readable summary
6. **Connect to action** — practitioner scheduling, protocol recommendations

### The Posterior Triple + Variance

| Field | Range | Meaning |
|-------|-------|---------|
| **P** (posterior_p) | 0-1 | Concern probability — how likely is something wrong |
| **p_var** (posterior_p_var) | 0-0.25 | Variance of P estimate (Bernoulli max). Low = precise, high = noisy |
| **C** (posterior_c) | 0-1 | Evidence coverage — fraction of expected signals observed |
| **S** (posterior_s) | 0-1 | Staleness — how old is the freshest evidence |

**Precision labels** derived from p_var:
- ≤ 0.06 → "high confidence"
- ≤ 0.14 → "moderate confidence"
- \> 0.14 → "limited data"

### Governance Bands

| Band | Trigger | Coach sees |
|------|---------|-----------|
| **ESCALATED** | P ≥ 0.85, C ≥ 0.70, S ≤ 14 days | Red alert, intervention recommended |
| **MONITOR** | P ≥ 0.60, C ≥ 0.60 | Yellow watch, building evidence |
| **SUPPRESSED** | Stale, low C, low P, or gap zone | Held back — not enough to act on |

---

## What's Built

### WASM Digital Twin (`packages/wasm-twin/`)

Rust crate compiled to WebAssembly (138KB binary), serving the Digital Twin visualization:

- **`compute_twin_frame(signals_json, time) → frame_json`** — Takes signal inputs per body region, applies heat diffusion across 16 adjacent body systems (3 iterations), computes per-region: heat, recovery, pulse rate, glow intensity, RGBA color (teal→amber→coral gradient), trend arrows, confidence. Returns full `TwinFrame` with global recovery/stress metrics.
- **`interpolate_frames(frame_a, frame_b, t) → frame`** — Smooth temporal interpolation between two frames for animation.
- **`map_signals_to_regions(snapshot_json) → signals_json`** — Maps health domain snapshots (P, C, S, p_var, domain, signal_vector) to body region signal inputs. Cardiovascular → heart/lungs/blood, metabolic → liver/gut/kidneys, etc. Secondary regions get attenuated signals.
- **16 body regions**: heart, lungs, liver, kidneys, gut, thyroid, adrenals, brain, spine, upper_body, lower_body, joints, skin, blood, immune, reproductive
- **Adjacency graph**: 25 region-pair connections for realistic heat bleeding
- **Color science**: Recovery-modulated thermal palette (teal=recovered → amber=stressed → coral=critical)

### Frontend Coach Dashboard (`packages/frontend/`)

Full reskin — all legacy vehicle/auto references removed. Steve Jobs clean. Two-tier UX: coach view (simple, actionable) and clinical drill-down (full evidence, lab markers, protocol tracking).

**Layout:**
- Persistent sidebar with brand, nav (Overview, Athletes), athlete list with status dots (color-coded by governance band), and coach identity footer
- Main content area fills remaining width
- No top header — sidebar is the sole chrome

**Pages:**
- **`/`** — Coach home. Auth gate (demo: coach/longevity2026). Minimal greeting, 4 stat cards (Athletes, Need Review, Protocols, Coverage), clean sortable table showing Name, Sport, Training Phase, Domain, Status.
- **`/athletes`** — Full athlete table with Name, Sport, Phase, Domain, Concern %, Status columns.
- **`/client/[id]`** — Athlete detail. Profile header with avatar, name, band badge, sport, training phase, domain, coach notes, and **race countdown** (days to next race). Tab navigation:
  - **Intelligence** — The Steve Jobs view. Coach summary card (urgency badge, headline, body narrative, single recommended action). "Clinical detail" toggle reveals full drill-down: performance systems (per-domain aggregate scores with progress bars), evidence chain (blood/wearable/self-report with values, units, ref ranges, trend arrows), and recommended clinical actions.
  - **Signals** — Interactive signal timeline chart. Selectable signals (HRV, Resting HR, Sleep, Recovery, Strain, Calories). SVG sparkline with reference range band overlay.
  - **Labs** — Full lab marker table (13+ markers): value, previous value, reference range, status badge (Low/Normal/High/Optimal/No Data), trend direction.
  - **Protocols** — Active protocol cards with dosing notes, trend badges (improving/worsening/stable), narrative explanation, and sparkline of tracked signal values.
  - **Twin** — WASM-powered Digital Twin body renderer with Current/Projection mode toggle and timeline slider for protocol projection (0-12 weeks).

**Intelligence API Integration:**
- `GET /api/v1/subjects/:id/intelligence` — Two-tier response:
  - `coach_summary`: headline, constraint, body (evidence narrative), action, urgency (high/medium/low), domain
  - `clinical`: primary finding, evidence chain (typed as blood/wearable/self_report), performance systems (per-domain aggregate), 13+ lab markers with ranges/trends/badges, protocol tracking with trend values and narrative, clinical actions list

**Design system:**
- Dark theme with warmer accent palette: indigo (#6366F1), warm violet (#A78BFA), teal (#2DD4BF), coral (#F97066), amber (#FBBF24)
- Domain colors: cardiovascular=coral, metabolic=amber, hormonal=violet, musculoskeletal=teal, sleep_recovery=indigo, cognitive=pink
- Band colors: escalated=coral, monitor=amber, suppressed=indigo
- Animations: fade-in, slide-up, breathe, pulse-soft, glow-pulse
- Typography: Geist Sans/Mono, uppercase tracking for labels, minimal human-centered copy

**WASM Integration:**
- Manual WebAssembly loader (`wasm-loader.ts`) fetches binary from `/public/wasm/` at runtime
- Canvas2D renderer draws stylized human silhouette + per-region elliptical heat overlays with pulsing glow
- Graceful JS fallback if WASM fails to load
- Region hover hit-testing with tooltip (stress%, recovery%)
- Protocol projection mode: WASM computes expected body state under active protocols at N weeks using response curves + cohort data

**Tech:**
- React Query hooks (`use-health.ts`): useSubjects, useSubject, useSignals, useSnapshots, useOrgStats, useProtocols, **useIntelligence**
- API client (`health-api.ts`): typed fetch wrapper for all `/api/v1/*` endpoints including `/intelligence`
- No framer-motion dependency on new pages (removed animation overhead for Steve Jobs simplicity)

### Health Domain Layer (`packages/shared/src/`)

- **6 health domains**: cardiovascular, metabolic, hormonal, musculoskeletal, sleep_recovery, cognitive
- **26 health signals**: daily wearable (HR, HRV, sleep duration/quality, recovery, strain, calories, steps), periodic labs (A1C, testosterone, CRP, vitamin D, cortisol, TSH, hemoglobin, hematocrit, ferritin, iron, transferrin saturation, creatine kinase, fasting glucose), nutrition (calories, protein), self-report (energy, pain), practitioner notes — each with unit, normal range, full range, domain mappings
- **11 peptide protocols**: Tirzepatide, Semaglutide, AOD-9604, Lipo-C, NAD+, Semax/Selank, Glutathione, Sermorelin, MOTS-C, GHK-Cu, BPC-157/TB-500 — with dosing cadence, onset/peak weeks, monitored signals
- **5 protocol stacks**: Metabolic Reset, Performance & Longevity, Injury Recovery, Cognitive Edge, Hormonal Optimization
- **30+ data sources**: 8 wearables (Oura, WHOOP, Garmin, Apple Watch, Fitbit, Samsung, Polar, COROS), 6 biomarker labs (Function Health, InsideTracker, Wild Health, Quest, Labcorp, Marek), 4 training apps (Strava, TrainingPeaks, Peloton, Strong), 4 nutrition apps (MFP, Cronometer, MacroFactor, Carbon), 2 EHR (Epic, Cerner), self-report, practitioner entry
- **16 body regions**: mapped to mesh IDs and driving signals for WASM Digital Twin renderer
- **Digital Twin frame types**: RegionState, DigitalTwinFrame, RenderLayer

### Health Database Schema (`packages/backend/src/db/health-schema.ts`)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| **organizations** | Multi-tenant root | id, name, slug, plan |
| **subjects** | Patient-athletes | org_id, display_name (PHI), sex, fitness_level, sport, height_cm, weight_kg, training_phase, calorie_target, coach_notes, races (JSONB), active_domains, posterior P/p_var/C/S, governance_band |
| **health_signal_events** | Raw signal data | subject_id, org_id, signal_name, signal_state, raw_value, normalized_value, source_type, occurred_at |
| **health_snapshots** | Posterior timeline | subject_id, org_id, domain, P/p_var/C/S, governance_band, signal_vector, frame_index |
| **health_governance_actions** | Governance audit | subject_id, action_type, reason, triggered_by |
| **practitioners** | Coaches/physicians | org_id, name, specialty, certifications, location |
| **session_slots** | Scheduling capacity | practitioner_id, date, time_block, capacity, booked |
| **session_bookings** | Appointments | subject_id, practitioner_id, slot_id, status (draft→held→confirmed→completed) |
| **protocol_assignments** | Which peptide a subject is on | subject_id, protocol_id, started_at, status, dosing_notes |
| **subject_data_sources** | Connected platforms | subject_id, source_id, connected_at, last_sync_at, status |
| **audit_log** | HIPAA foundation | actor_id, action, resource_type, resource_id, phi_accessed, ip_address |

### Synthetic Data Generator

- **200 subjects** with realistic profiles (age 25-55, M/F, fitness level, athlete type, metro area)
- **10 health storylines**: Overtraining Spiral, Metabolic Improvement, Hormonal Response, Sleep Disruption, Post-Injury Recovery, Stress-Driven Decline, New Client Baseline, Plateau, Strong Responder, Data Gap
- **6 hero subjects** with hand-crafted scenarios for demo walkthrough
- **Multi-platform simulation**: each subject assigned a wearable profile (Oura+Strava, WHOOP+TrainingPeaks, etc.) + biomarker provider + protocol stack
- **Protocol response curves**: signals modulated by peptide onset/peak timing (currently additive, no interaction terms)
- **90 days longitudinal**: ~155K signal events, ~2,600 snapshots, ~500 protocol assignments, ~700 data source connections
- **Deterministic PRNG** per subject (same seed = same data; reproducible demos)

Seed command: `FORCE_SEED=1 npx tsx src/db/seed/health-seed.ts`

### Health API v1 (`/api/v1/`)

All routes scoped to `org_id` via mock auth middleware. `{ data, meta }` envelope on every response.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/subjects` | List with governance sort, pagination, precision labels. Filters: domain, band, governance_band, q (search) |
| `GET /api/v1/subjects/:id` | Full profile + snapshot + protocols + sources + practitioner + service suggestion |
| `GET /api/v1/subjects/:id/signals` | Signal timeline. Filters: signal name, date range, resolution (raw/daily). Enriched with signal_meta |
| `GET /api/v1/subjects/:id/snapshots` | Governance history (P/p_var/C/S over time). Filter by domain |
| `GET /api/v1/protocols` | Protocol library (all 11 with signal mappings) |
| `GET /api/v1/practitioners` | Practitioner directory. Filter by metro |
| `GET /api/v1/practitioners/:id/slots` | Available session slots |
| `GET /api/v1/org/stats` | Dashboard aggregates (band counts, domain distribution, active protocols, 7-day coverage) |
| `GET /api/v1/subjects/:id/intelligence` | Two-tier intelligence: coach_summary (headline + action) + clinical drill-down (evidence chain, lab markers, performance systems, protocol tracking, actions) |
| `GET /api/v1/data-sources` | Integration catalog (all 30+ sources with status) |

---

## Key Decisions Made

1. **org_id on every table from day 1** — multi-tenancy is a schema decision, not a migration. App-level filtering now, Postgres RLS as defense-in-depth later.

2. **PHI fields identified but not yet encrypted** — `display_name`, `date_of_birth`, `contact` are marked. Encryption via pgcrypto or app-level AES happens when we move off Render free tier and sign a BAA.

3. **Audit log from day 1** — table exists, middleware hook point exists. Makes HIPAA audit readiness a "turn on enforcement" step, not a rewrite.

4. **p_var added to schema before building API routes** — ensures coaches see precision labels ("high confidence" vs "limited data") from the start. Column is ready for real Bayesian posterior when ML layer ships.

5. **Protocol interactions are additive** — BPC-157 + Sermorelin effects sum. No synergy/antagonism modeling yet. Data structure supports it when we get there (protocol_assignments tracks concurrent protocols).

6. **TypeScript everywhere, Python only for ML training** — ONNX Runtime in Node for model serving avoids two-runtime tax.

7. **WASM for Digital Twin rendering** — browser-side Rust→wasm32 for body visualization. Manual WebAssembly loading (bypasses webpack) from `/public/wasm/`. 138KB binary. JS fallback if WASM unavailable.

8. **Synthetic data designed for real-data swap** — signal events from Oura synthetic data have the same schema as real Oura OAuth data. When adapters ship, the DB doesn't change.

9. **All vehicle/auto references removed from frontend** — legacy vehicle routes still functional on backend for reference, but frontend is 100% health-focused coach dashboard with Steve Jobs clean two-tier UX (coach view + clinical drill-down).

---

## What's NOT Built Yet

| Gap | Phase | Est. Effort |
|-----|-------|-------------|
| Real authentication (JWT + RBAC) | Phase 3 | 3-5 weeks |
| HIPAA compliance posture (encryption, BAA, RLS) | Phase 4 | 3-4 weeks |
| Real data integrations (Oura, WHOOP, Garmin first) | Phase 5 | 2-4 weeks each |
| Mobile app (Expo + React Native) | Phase 6 | 4-8 weeks |
| ML inference layer (learned P, protocol recommendations) | Phase 7 | 6-12 weeks |
| Write endpoints (POST/PUT/PATCH) | When needed | 1-2 weeks |
| WebSocket/SSE for real-time signal updates | When needed | 1 week |
| Voice service rewrite for health context | Phase 1b | 1 week |
| 3D body mesh (Three.js/WebGPU upgrade from Canvas2D) | Phase 2b | 2-3 weeks |

---

## LongevityPlan.AI Context

- **Founder**: Tony Medrano (B2B Healthcare AI since 2016, worked with NFL/NBA/NASA/Olympics)
- **Co-founder**: Lina Ramos (35x Ironman, 2026 Kona qualifier)
- **CMO**: Dr. Karim Godamunne (MD MBA SFHM FACHE)
- **Market**: Coaches, practitioners, athletes, executives, military, corporate wellness
- **Revenue model**: Mobile app (subscription tiers), White-label API (fee per user)
- **Key claims**: Digital Twin for Predictive Peptide Performance, Cardiorespiratory Digital Twin, HIPAA compliance, FDA-approved peptide therapies via licensed physicians + 503A pharmacies
- **Veteran-owned**, serves military/government clients
- **Content**: 30+ research articles across longevity, performance science, peptides, digital twins, wearables, neuroscience, sleep, sports medicine

---

## File Map (key files)

```
packages/shared/src/
  index.ts                          — barrel exports
  types/health.ts                   — Subject, HealthSignalEvent, HealthSnapshot, precision labels
  types/vin.ts                      — legacy vehicle types (RiskBand, GovernanceBand reused)
  constants/health-domains.ts       — 6 health domains
  constants/health-signals.ts       — 19 signals with ranges, cadences, domain mappings
  constants/protocols.ts            — 11 peptides + 5 stacks
  constants/data-sources.ts         — 30+ integration targets
  constants/body-systems.ts         — 16 body regions for WASM renderer

packages/backend/src/
  app.ts                            — Hono app, routes wired here
  config/health-database.ts         — Drizzle + pg pool for health schema
  config/env.ts                     — Zod-validated env vars
  db/health-schema.ts               — Full health Postgres schema
  db/schema.ts                      — Legacy vehicle schema
  db/seed/health-seed.ts            — Master health seed script
  db/seed/health-subject-generator.ts
  db/seed/health-signal-generator.ts
  db/seed/health-storylines.ts
  db/seed/health-practitioner-generator.ts
  lib/api-envelope.ts               — { data, meta } response helper
  middleware/mock-auth.ts            — Demo auth injecting org_id
  routes/health/subjects.ts         — GET /subjects, GET /subjects/:id
  routes/health/signals.ts          — GET /subjects/:id/signals
  routes/health/snapshots.ts        — GET /subjects/:id/snapshots
  routes/health/intelligence.ts     — GET /subjects/:id/intelligence (two-tier coach + clinical)
  routes/health/supporting.ts       — /protocols, /practitioners, /org/stats, /data-sources
  types/hono-env.ts                 — AppEnv type for Hono context
  services/governance.ts            — computeGovernanceBand(P, C, S)
  services/voice.ts                 — Anthropic streaming explanations

packages/frontend/src/
  app/layout.tsx                    — Root layout with QueryProvider
  app/page.tsx                      — Coach dashboard home (sidebar + stat cards + athlete table)
  app/athletes/page.tsx             — Full athletes table view
  app/client/[id]/page.tsx          — Athlete detail (5 tabs: Intelligence, Signals, Labs, Protocols, Twin)
  components/layout/sidebar.tsx     — Persistent left sidebar (nav, athlete list with band dots, coach footer)
  components/twin/body-renderer.tsx — Canvas2D body renderer consuming WASM frames
  components/layout/header.tsx      — LongevityPlan branded header (legacy, replaced by sidebar)
  components/layout/auth-gate.tsx   — Demo authentication
  components/layout/query-provider.tsx — React Query client
  hooks/use-health.ts               — React Query hooks: useSubjects, useSubject, useSignals, useSnapshots, useOrgStats, useProtocols, useIntelligence
  lib/health-api.ts                 — Typed fetch client for /api/v1/* with Intelligence types
  lib/wasm-loader.ts                — Manual WebAssembly binary loader
  lib/cn.ts                         — clsx + tailwind-merge utility
  lib/format.ts                     — Number formatting helpers
  styles/globals.css                — CSS variables, glow utilities, scrollbar
  tailwind.config.ts                — Full design token system

packages/wasm-twin/
  Cargo.toml                        — Rust crate config
  src/lib.rs                        — WASM exports: compute_twin_frame, interpolate_frames, map_signals_to_regions
  pkg/                              — wasm-pack build output (138KB .wasm)

docs/
  ROADMAP.md                        — 7-phase roadmap with estimates
  DATA-ARCHITECTURE.md              — Full data architecture: standards alignment, pipeline, WASM projection spec
  CONTEXT.md                        — this file
```

---

## How to Run

```bash
# Install dependencies
npm install

# Build WASM (requires Rust + wasm-pack)
cd packages/wasm-twin && wasm-pack build --target web --release
cp pkg/longevity_twin_bg.wasm ../frontend/public/wasm/

# Ensure Postgres is running with gravity_leads database
# Set DATABASE_URL in .env (see .env.example)

# Seed health data
cd packages/backend
FORCE_SEED=1 npx tsx src/db/seed/health-seed.ts

# Start backend
npm run dev --workspace=packages/backend    # port 3001

# Start frontend
npm run dev --workspace=packages/frontend   # port 3000

# Demo login: coach / longevity2026

# Test health API
curl http://localhost:3001/api/v1/subjects | jq .meta
curl http://localhost:3001/api/v1/org/stats | jq .data
```

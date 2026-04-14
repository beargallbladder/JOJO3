import { Hono } from 'hono';
import { healthDb } from '../../config/health-database.js';
import {
  subjects, protocolAssignments, subjectDataSources,
  healthSignalEvents, healthSnapshots, healthGovernanceActions,
  practitioners, sessionBookings, subjectCurrentState,
} from '../../db/health-schema.js';
import { eq, and, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { envelope, envelopeList } from '../../lib/api-envelope.js';
import { getPrecisionLabel, formatPrecisionLabel } from '@gravity/shared';
import type { AppEnv } from '../../types/hono-env.js';

export const subjectsRoute = new Hono<AppEnv>();

// ---- Helpers ----

type SubjectState = typeof subjectCurrentState.$inferSelect | null;

function computeSortContext(s: typeof subjects.$inferSelect, st: SubjectState) {
  const p = st?.posterior_p ?? s.posterior_p;
  const c = st?.posterior_c ?? s.posterior_c;
  const sVal = st?.posterior_s ?? s.posterior_s;
  const lastSig = st?.last_signal_at ?? s.last_signal_at;
  const lastSignal = new Date(lastSig).getTime();
  const ageHours = (Date.now() - lastSignal) / (3600_000);
  const stale = ageHours > 48 * 30;

  const h = s.external_id.split('').reduce((a, ch) => ((a << 5) - a + ch.charCodeAt(0)) | 0, 0);
  const r1 = Math.abs(h % 100);
  const r2 = Math.abs((h * 3) % 100);
  const r3 = Math.abs((h * 7) % 100);

  return {
    schema_version: 'health_slc_v1',
    as_of: lastSig,
    vas: stale ? -1 : Math.min(100, Math.max(5, Math.round(p * 55 + r1 * 0.45))),
    esc: stale ? -1 : Math.min(100, Math.max(5, Math.round(sVal * 50 + r2 * 0.50))),
    tsi: stale ? -1 : Math.min(100, Math.max(5, Math.round(c * 45 + r3 * 0.55))),
    stale,
  };
}

function formatSubject(s: typeof subjects.$inferSelect, st?: SubjectState) {
  const pVar = st?.posterior_p_var ?? s.posterior_p_var;
  const precisionLabel = getPrecisionLabel(pVar);
  return {
    ...s,
    posterior_p: st?.posterior_p ?? s.posterior_p,
    posterior_p_var: pVar,
    posterior_c: st?.posterior_c ?? s.posterior_c,
    posterior_s: st?.posterior_s ?? s.posterior_s,
    governance_band: st?.governance_band ?? s.governance_band,
    governance_reason: st?.governance_reason ?? s.governance_reason,
    primary_domain: st?.primary_domain ?? s.primary_domain,
    last_signal_at: (st?.last_signal_at ?? s.last_signal_at).toISOString(),
    enrolled_at: s.enrolled_at.toISOString(),
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at.toISOString(),
    precision_label: precisionLabel,
    precision_display: formatPrecisionLabel(precisionLabel),
    sort_context: computeSortContext(s, st ?? null),
  };
}

// ---- GET /subjects ----

subjectsRoute.get('/', async (c) => {
  const orgId = c.get('org_id') as string;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
  const offset = (page - 1) * limit;

  const domain = c.req.query('domain');
  const band = c.req.query('band');
  const govBand = c.req.query('governance_band');
  const search = c.req.query('q');

  const conditions = [eq(subjects.org_id, orgId)];
  if (domain) conditions.push(sql`${subjectCurrentState.primary_domain} = ${domain}`);
  if (band) conditions.push(eq(subjects.risk_band, band as any));
  if (govBand) conditions.push(sql`${subjectCurrentState.governance_band} = ${govBand}`);
  if (search) conditions.push(sql`${subjects.display_name} ILIKE ${'%' + search + '%'}`);

  const where = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    healthDb.select({
      subject: subjects,
      state: subjectCurrentState,
    }).from(subjects)
      .leftJoin(subjectCurrentState, eq(subjects.id, subjectCurrentState.subject_id))
      .where(where)
      .orderBy(desc(subjectCurrentState.governance_band), desc(subjectCurrentState.posterior_p))
      .limit(limit).offset(offset),
    healthDb.select({ count: count() }).from(subjects)
      .leftJoin(subjectCurrentState, eq(subjects.id, subjectCurrentState.subject_id))
      .where(where),
  ]);

  return envelopeList(c, rows.map(r => formatSubject(r.subject, r.state)), {
    page,
    limit,
    total: Number(totalResult[0]?.count ?? 0),
  });
});

// ---- GET /subjects/:id ----

subjectsRoute.get('/:id', async (c) => {
  const orgId = c.get('org_id') as string;
  const subjectId = c.req.param('id');

  const [subject] = await healthDb.select().from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.org_id, orgId)));

  if (!subject) return c.json({ error: 'Subject not found' }, 404);

  const [stateRows, protocols, sources, governance, latestSnapshot] = await Promise.all([
    healthDb.select().from(subjectCurrentState)
      .where(eq(subjectCurrentState.subject_id, subjectId)),
    healthDb.select().from(protocolAssignments)
      .where(and(eq(protocolAssignments.subject_id, subjectId), eq(protocolAssignments.org_id, orgId))),
    healthDb.select().from(subjectDataSources)
      .where(and(eq(subjectDataSources.subject_id, subjectId), eq(subjectDataSources.org_id, orgId))),
    healthDb.select().from(healthGovernanceActions)
      .where(and(eq(healthGovernanceActions.subject_id, subjectId), eq(healthGovernanceActions.org_id, orgId)))
      .orderBy(desc(healthGovernanceActions.created_at)),
    healthDb.select().from(healthSnapshots)
      .where(and(eq(healthSnapshots.subject_id, subjectId), eq(healthSnapshots.org_id, orgId)))
      .orderBy(desc(healthSnapshots.frame_index))
      .limit(1),
  ]);

  const state = stateRows[0] ?? null;

  // Find practitioner via latest booking
  const [booking] = await healthDb.select().from(sessionBookings)
    .where(and(eq(sessionBookings.subject_id, subjectId), eq(sessionBookings.org_id, orgId)))
    .orderBy(desc(sessionBookings.created_at))
    .limit(1);

  let practitioner = null;
  if (booking) {
    const [p] = await healthDb.select().from(practitioners)
      .where(eq(practitioners.id, booking.practitioner_id));
    practitioner = p ?? null;
  }

  const pVar = state?.posterior_p_var ?? subject.posterior_p_var;
  const precisionLabel = getPrecisionLabel(pVar);
  const band = (state?.governance_band ?? subject.governance_band) as string;

  return envelope(c, {
    subject: formatSubject(subject, state),
    current_snapshot: latestSnapshot[0] ?? null,
    protocols: protocols.map(p => ({
      ...p,
      started_at: p.started_at.toISOString(),
      ended_at: p.ended_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
    })),
    data_sources: sources.map(s => ({
      ...s,
      connected_at: s.connected_at.toISOString(),
      last_sync_at: s.last_sync_at?.toISOString() ?? null,
    })),
    governance_actions: governance.map(g => ({
      ...g,
      created_at: g.created_at.toISOString(),
    })),
    practitioner,
    service_suggestion: band === 'ESCALATED'
      ? { recommended: true, urgency: 'immediate' as const, reason: subject.governance_reason }
      : band === 'MONITOR'
        ? { recommended: false, urgency: 'routine' as const, reason: subject.governance_reason }
        : { recommended: false, urgency: 'none' as const, reason: subject.governance_reason },
  });
});

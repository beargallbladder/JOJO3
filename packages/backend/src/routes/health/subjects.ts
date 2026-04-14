import { Hono } from 'hono';
import { healthDb } from '../../config/health-database.js';
import {
  subjects, protocolAssignments, subjectDataSources,
  healthSignalEvents, healthSnapshots, healthGovernanceActions,
  practitioners, sessionBookings,
} from '../../db/health-schema.js';
import { eq, and, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { envelope, envelopeList } from '../../lib/api-envelope.js';
import { getPrecisionLabel, formatPrecisionLabel } from '@gravity/shared';
import type { AppEnv } from '../../types/hono-env.js';

export const subjectsRoute = new Hono<AppEnv>();

// ---- Helpers ----

function computeSortContext(s: typeof subjects.$inferSelect) {
  const lastSignal = new Date(s.last_signal_at).getTime();
  const ageHours = (Date.now() - lastSignal) / (3600_000);
  const stale = ageHours > 48 * 30;

  const h = s.external_id.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const r1 = Math.abs(h % 100);
  const r2 = Math.abs((h * 3) % 100);
  const r3 = Math.abs((h * 7) % 100);

  return {
    schema_version: 'health_slc_v1',
    as_of: s.last_signal_at,
    vas: stale ? -1 : Math.min(100, Math.max(5, Math.round(s.posterior_p * 55 + r1 * 0.45))),
    esc: stale ? -1 : Math.min(100, Math.max(5, Math.round(s.posterior_s * 50 + r2 * 0.50))),
    tsi: stale ? -1 : Math.min(100, Math.max(5, Math.round(s.posterior_c * 45 + r3 * 0.55))),
    stale,
  };
}

function formatSubject(s: typeof subjects.$inferSelect) {
  const precisionLabel = getPrecisionLabel(s.posterior_p_var);
  return {
    ...s,
    last_signal_at: s.last_signal_at.toISOString(),
    enrolled_at: s.enrolled_at.toISOString(),
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at.toISOString(),
    precision_label: precisionLabel,
    precision_display: formatPrecisionLabel(precisionLabel),
    sort_context: computeSortContext(s),
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
  if (domain) conditions.push(eq(subjects.primary_domain, domain as any));
  if (band) conditions.push(eq(subjects.risk_band, band as any));
  if (govBand) conditions.push(eq(subjects.governance_band, govBand as any));
  if (search) conditions.push(sql`${subjects.display_name} ILIKE ${'%' + search + '%'}`);

  const where = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    healthDb.select().from(subjects)
      .where(where)
      .orderBy(desc(subjects.governance_band), desc(subjects.posterior_p))
      .limit(limit).offset(offset),
    healthDb.select({ count: count() }).from(subjects).where(where),
  ]);

  return envelopeList(c, rows.map(formatSubject), {
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

  const [protocols, sources, governance, latestSnapshot] = await Promise.all([
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

  const precisionLabel = getPrecisionLabel(subject.posterior_p_var);
  const band = subject.governance_band;

  return envelope(c, {
    subject: formatSubject(subject),
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

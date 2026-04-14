import { Hono } from 'hono';
import { healthDb } from '../../config/health-database.js';
import {
  subjects, practitioners, protocolAssignments,
  sessionSlots,
} from '../../db/health-schema.js';
import { eq, sql, and, gt, count } from 'drizzle-orm';
import { envelope, envelopeList } from '../../lib/api-envelope.js';
import { PROTOCOLS, HEALTH_SIGNALS, DATA_SOURCES } from '@gravity/shared';
import type { AppEnv } from '../../types/hono-env.js';

export const supportingRoute = new Hono<AppEnv>();

// ---- GET /protocols ----

supportingRoute.get('/protocols', (c) => {
  const protocolList = Object.entries(PROTOCOLS).map(([id, def]) => ({
    id,
    label: def.label,
    category: def.category,
    description: def.description,
    target_domains: def.targetDomains,
    monitored_signals: def.monitoredSignals.map(sig => {
      const sigDef = HEALTH_SIGNALS[sig as keyof typeof HEALTH_SIGNALS];
      return { id: sig, label: sigDef?.label ?? sig, unit: sigDef?.unit ?? '' };
    }),
    dosing_cadence: def.dosingCadence,
    onset_weeks: def.onsetWeeks,
    peak_weeks: def.peakWeeks,
  }));

  return envelope(c, protocolList);
});

// ---- GET /practitioners ----

supportingRoute.get('/practitioners', async (c) => {
  const orgId = c.get('org_id') as string;
  const metro = c.req.query('metro');
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
  const offset = (page - 1) * limit;

  const conditions = [eq(practitioners.org_id, orgId)];
  if (metro) conditions.push(eq(practitioners.metro_area, metro));

  const where = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    healthDb.select().from(practitioners).where(where).limit(limit).offset(offset),
    healthDb.select({ count: count() }).from(practitioners).where(where),
  ]);

  return envelopeList(c, rows, {
    page,
    limit,
    total: Number(totalResult[0]?.count ?? 0),
  });
});

// ---- GET /practitioners/:id/slots ----

supportingRoute.get('/practitioners/:id/slots', async (c) => {
  const practId = c.req.param('id');
  const fromDate = c.req.query('from');

  const conditions = [
    eq(sessionSlots.practitioner_id, practId),
    gt(sessionSlots.capacity, sessionSlots.booked),
  ];
  if (fromDate) {
    conditions.push(sql`${sessionSlots.date} >= ${fromDate}`);
  }

  const rows = await healthDb.select().from(sessionSlots)
    .where(and(...conditions))
    .orderBy(sessionSlots.date, sessionSlots.time_block);

  return envelope(c, rows);
});

// ---- GET /org/stats ----

supportingRoute.get('/org/stats', async (c) => {
  const orgId = c.get('org_id') as string;

  const [bandCounts, domainCounts, protocolCounts, totalSubjects] = await Promise.all([
    healthDb.execute(sql`
      SELECT governance_band, count(*)::int AS count
      FROM subject_current_state WHERE org_id = ${orgId}
      GROUP BY governance_band
    `),
    healthDb.execute(sql`
      SELECT primary_domain, count(*)::int AS count
      FROM subject_current_state WHERE org_id = ${orgId}
      GROUP BY primary_domain
    `),
    healthDb.execute(sql`
      SELECT pa.protocol_id, count(*)::int AS count
      FROM protocol_assignments pa
      JOIN subjects s ON s.id = pa.subject_id
      WHERE pa.org_id = ${orgId} AND pa.status = 'active'
      GROUP BY pa.protocol_id
      ORDER BY count DESC
    `),
    healthDb.select({ count: count() }).from(subjects).where(eq(subjects.org_id, orgId)),
  ]);

  // Coverage distribution: what % of subjects have signals in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeCoverage = await healthDb.execute(sql`
    SELECT count(DISTINCT subject_id)::int AS active_count
    FROM health_signal_events
    WHERE org_id = ${orgId} AND occurred_at >= ${sevenDaysAgo}
  `);

  const total = Number(totalSubjects[0]?.count ?? 0);
  const activeCount = Number((activeCoverage.rows[0] as any)?.active_count ?? 0);

  return envelope(c, {
    total_subjects: total,
    governance_bands: Object.fromEntries(
      (bandCounts.rows as any[]).map(r => [r.governance_band, r.count])
    ),
    domains: Object.fromEntries(
      (domainCounts.rows as any[]).map(r => [r.primary_domain, r.count])
    ),
    active_protocols: (protocolCounts.rows as any[]).map(r => {
      const def = PROTOCOLS[r.protocol_id as keyof typeof PROTOCOLS];
      return { protocol_id: r.protocol_id, label: def?.label ?? r.protocol_id, count: r.count };
    }),
    coverage: {
      active_last_7d: activeCount,
      total: total,
      pct: total > 0 ? Math.round((activeCount / total) * 100) : 0,
    },
  });
});

// ---- GET /data-sources ----

supportingRoute.get('/data-sources', (c) => {
  const sourceList = Object.entries(DATA_SOURCES).map(([id, def]) => ({
    id,
    label: def.label,
    category: def.category,
    description: def.description,
    signals: def.signals,
    cadence: def.cadence,
    auth_type: def.authType,
    integration_status: def.integrationStatus,
  }));

  return envelope(c, sourceList);
});

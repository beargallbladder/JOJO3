import { Hono } from 'hono';
import { healthDb } from '../../config/health-database.js';
import { healthSignalEvents, subjects, protocolAssignments } from '../../db/health-schema.js';
import { eq, and, desc, asc, gte, lte, sql } from 'drizzle-orm';
import { envelopeList } from '../../lib/api-envelope.js';
import { HEALTH_SIGNALS } from '@gravity/shared';
import type { AppEnv } from '../../types/hono-env.js';

export const signalsRoute = new Hono<AppEnv>();

// ---- GET /subjects/:id/signals ----

signalsRoute.get('/:id/signals', async (c) => {
  const orgId = c.get('org_id') as string;
  const subjectId = c.req.param('id');

  // Verify subject belongs to org
  const [subject] = await healthDb.select({ id: subjects.id }).from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.org_id, orgId)));
  if (!subject) return c.json({ error: 'Subject not found' }, 404);

  const signalName = c.req.query('signal');
  const fromDate = c.req.query('from');
  const toDate = c.req.query('to');
  const resolution = c.req.query('resolution') || 'raw'; // 'raw' | 'daily'
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(Number(c.req.query('limit')) || 200, 1000);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(healthSignalEvents.subject_id, subjectId),
    eq(healthSignalEvents.org_id, orgId),
  ];
  if (signalName) conditions.push(eq(healthSignalEvents.signal_name, signalName));
  if (fromDate) conditions.push(gte(healthSignalEvents.occurred_at, new Date(fromDate)));
  if (toDate) conditions.push(lte(healthSignalEvents.occurred_at, new Date(toDate)));

  const where = and(...conditions);

  if (resolution === 'daily' && signalName) {
    // Daily aggregates: avg raw_value, min, max, count per day
    const dailyRows = await healthDb.execute(sql`
      SELECT
        date_trunc('day', occurred_at) AS day,
        signal_name,
        AVG(raw_value) AS avg_value,
        MIN(raw_value) AS min_value,
        MAX(raw_value) AS max_value,
        AVG(normalized_value) AS avg_normalized,
        COUNT(*)::int AS sample_count
      FROM health_signal_events
      WHERE subject_id = ${subjectId}
        AND org_id = ${orgId}
        AND signal_name = ${signalName}
        ${fromDate ? sql`AND occurred_at >= ${new Date(fromDate)}` : sql``}
        ${toDate ? sql`AND occurred_at <= ${new Date(toDate)}` : sql``}
      GROUP BY day, signal_name
      ORDER BY day ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalResult = await healthDb.execute(sql`
      SELECT COUNT(DISTINCT date_trunc('day', occurred_at))::int AS count
      FROM health_signal_events
      WHERE subject_id = ${subjectId}
        AND org_id = ${orgId}
        AND signal_name = ${signalName}
        ${fromDate ? sql`AND occurred_at >= ${new Date(fromDate)}` : sql``}
        ${toDate ? sql`AND occurred_at <= ${new Date(toDate)}` : sql``}
    `);

    const signalDef = HEALTH_SIGNALS[signalName as keyof typeof HEALTH_SIGNALS];

    // Get protocol start dates for overlay markers
    const protocols = await healthDb.select().from(protocolAssignments)
      .where(and(eq(protocolAssignments.subject_id, subjectId), eq(protocolAssignments.org_id, orgId)));

    return envelopeList(c, (dailyRows.rows as any[]).map(r => ({
      day: r.day,
      signal_name: signalName,
      avg_value: r.avg_value != null ? Math.round(Number(r.avg_value) * 100) / 100 : null,
      min_value: r.min_value != null ? Math.round(Number(r.min_value) * 100) / 100 : null,
      max_value: r.max_value != null ? Math.round(Number(r.max_value) * 100) / 100 : null,
      avg_normalized: r.avg_normalized != null ? Math.round(Number(r.avg_normalized) * 1000) / 1000 : null,
      sample_count: r.sample_count,
      signal_meta: signalDef ? {
        label: signalDef.label,
        unit: signalDef.unit,
        normal_range: signalDef.normalRange,
        domains: signalDef.domains,
      } : null,
    })), {
      page,
      limit,
      total: Number((totalResult.rows[0] as any)?.count ?? 0),
    });
  }

  // Raw resolution
  const [rows, totalResult] = await Promise.all([
    healthDb.select().from(healthSignalEvents)
      .where(where)
      .orderBy(asc(healthSignalEvents.occurred_at))
      .limit(limit).offset(offset),
    healthDb.select({ count: sql`count(*)::int` }).from(healthSignalEvents).where(where),
  ]);

  // Enrich each event with signal definition metadata
  const enriched = rows.map(r => {
    const def = HEALTH_SIGNALS[r.signal_name as keyof typeof HEALTH_SIGNALS];
    return {
      ...r,
      occurred_at: r.occurred_at.toISOString(),
      signal_meta: def ? {
        label: def.label,
        unit: def.unit,
        normal_range: def.normalRange,
        domains: def.domains,
        source_label: def.source,
      } : null,
    };
  });

  return envelopeList(c, enriched, {
    page,
    limit,
    total: Number((totalResult[0] as any)?.count ?? 0),
  });
});

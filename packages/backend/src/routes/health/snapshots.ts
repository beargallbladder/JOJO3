import { Hono } from 'hono';
import { healthDb } from '../../config/health-database.js';
import { healthSnapshots, subjects } from '../../db/health-schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { envelopeList } from '../../lib/api-envelope.js';
import { getPrecisionLabel, formatPrecisionLabel } from '@gravity/shared';
import type { AppEnv } from '../../types/hono-env.js';

export const snapshotsRoute = new Hono<AppEnv>();

// ---- GET /subjects/:id/snapshots ----

snapshotsRoute.get('/:id/snapshots', async (c) => {
  const orgId = c.get('org_id') as string;
  const subjectId = c.req.param('id');

  const [subject] = await healthDb.select({ id: subjects.id }).from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.org_id, orgId)));
  if (!subject) return c.json({ error: 'Subject not found' }, 404);

  const domain = c.req.query('domain');

  const conditions = [
    eq(healthSnapshots.subject_id, subjectId),
    eq(healthSnapshots.org_id, orgId),
  ];
  if (domain) conditions.push(eq(healthSnapshots.domain, domain as any));

  const rows = await healthDb.select().from(healthSnapshots)
    .where(and(...conditions))
    .orderBy(asc(healthSnapshots.frame_index));

  const enriched = rows.map(s => {
    const precisionLabel = getPrecisionLabel(s.p_var);
    return {
      ...s,
      computed_at: s.computed_at.toISOString(),
      precision_label: precisionLabel,
      precision_display: formatPrecisionLabel(precisionLabel),
    };
  });

  return envelopeList(c, enriched, {
    page: 1,
    limit: rows.length,
    total: rows.length,
  });
});

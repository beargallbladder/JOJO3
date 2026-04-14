import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/hono-env.js';
import { healthDb } from '../config/health-database.js';
import { organizations } from '../db/health-schema.js';
import { eq } from 'drizzle-orm';

/**
 * Mock JWT middleware for demo/dev.
 * Injects org_id into context from the demo org.
 * Replace with real JWT validation in Phase 3.
 */
export const mockAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    // Future: validate JWT, extract org_id from claims
    // For now, treat any bearer token value as an org slug
    const slug = authHeader.slice(7);
    const [org] = await healthDb
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (org) {
      c.set('org_id', org.id);
      c.set('actor_id', 'demo-coach');
      c.set('actor_type', 'user');
      await next();
      return;
    }
  }

  // Default: use the first org (demo mode)
  const [defaultOrg] = await healthDb
    .select({ id: organizations.id })
    .from(organizations)
    .limit(1);

  if (!defaultOrg) {
    return c.json({ error: 'No organization found. Run seed:health first.' }, 500);
  }

  c.set('org_id', defaultOrg.id);
  c.set('actor_id', 'demo-coach');
  c.set('actor_type', 'user');
  await next();
};

import type { Context } from 'hono';
import type { AppEnv } from '../types/hono-env.js';

export interface ApiMeta {
  org_id: string;
  page?: number;
  limit?: number;
  total?: number;
  cached?: boolean;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export function envelope<T>(c: Context<AppEnv>, data: T, meta: Partial<ApiMeta> = {}) {
  const orgId = c.get('org_id') || '';
  return c.json({
    data,
    meta: { org_id: orgId, ...meta },
  } satisfies ApiEnvelope<T>);
}

export function envelopeList<T>(
  c: Context<AppEnv>,
  data: T[],
  opts: { page: number; limit: number; total: number },
) {
  const orgId = c.get('org_id') || '';
  return c.json({
    data,
    meta: { org_id: orgId, page: opts.page, limit: opts.limit, total: opts.total },
  } satisfies ApiEnvelope<T[]>);
}

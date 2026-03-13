import { Hono } from 'hono';
import { getLeads } from '../services/lead-scoring.js';

export const leadsRoute = new Hono();

leadsRoute.get('/', async (c) => {
  const query = {
    subsystem: c.req.query('subsystem'),
    band: c.req.query('band'),
    governance_band: c.req.query('governance_band'),
    page: c.req.query('page') ? parseInt(c.req.query('page')!) : undefined,
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined,
  };

  const result = await getLeads(query);
  return c.json(result);
});

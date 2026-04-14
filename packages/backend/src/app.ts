import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { mockAuth } from './middleware/mock-auth.js';
import { subjectsRoute } from './routes/health/subjects.js';
import { signalsRoute } from './routes/health/signals.js';
import { snapshotsRoute } from './routes/health/snapshots.js';
import { supportingRoute } from './routes/health/supporting.js';
import { intelligenceRoute } from './routes/health/intelligence.js';

export function createApp() {
  const app = new Hono();

  app.use('*', cors({ origin: '*' }));
  app.use('*', logger());
  app.use('*', requestId);
  app.onError(errorHandler);

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // ---- Health / LongevityPlan API v1 ----
  const v1 = new Hono<{ Variables: { org_id: string; actor_id: string; actor_type: string } }>();
  v1.use('*', mockAuth);
  v1.route('/subjects', subjectsRoute);
  v1.route('/subjects', signalsRoute);    // /subjects/:id/signals
  v1.route('/subjects', snapshotsRoute);  // /subjects/:id/snapshots
  v1.route('/subjects', intelligenceRoute); // /subjects/:id/intelligence
  v1.route('/', supportingRoute);         // /protocols, /practitioners, /org/stats, /data-sources

  app.route('/api/v1', v1);

  return app;
}

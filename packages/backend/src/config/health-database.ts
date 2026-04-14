import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as healthSchema from '../db/health-schema.js';
import { env } from './env.js';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const healthDb = drizzle(pool, { schema: healthSchema });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

let cached: ReturnType<typeof create> | undefined;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  // Lambda runs OUTSIDE a VPC (no NAT Gateway cost) and talks to serverless Postgres over TLS.
  // `prepare: false` keeps it compatible with PgBouncer / Neon pooled / Supabase pooler endpoints.
  const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!cached) cached = create();
  return cached;
}

export { schema };

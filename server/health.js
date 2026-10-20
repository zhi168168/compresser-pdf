import pg from 'pg';
import { timingSafeEqual } from 'node:crypto';
import { logOperationalEvent } from './observability.js';

function createHealthPool(env) {
  const database = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('Invalid database configuration');
  if ((env.VERCEL === '1' || env.NODE_ENV === 'production') && !['require', 'verify-ca', 'verify-full'].includes(database.searchParams.get('sslmode'))) throw new Error('Database TLS required');
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL, max: 1,
    connectionTimeoutMillis: 10000, idleTimeoutMillis: 5000,
    statement_timeout: 3000, query_timeout: 4000,
    allowExitOnIdle: true,
  });
  pool.on('error', () => logOperationalEvent('database_connection_failed'));
  return pool;
}

export function createHealthHandler({ env = process.env, createPool = createHealthPool, log = logOperationalEvent } = {}) {
  let pool;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex');
    const reply = (code, status) => { res.statusCode = code; res.end(JSON.stringify({ status })); };
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return reply(405, 'unavailable');
    }
    if (env.HEALTH_CHECK_TOKEN) {
      const expected = Buffer.from(`Bearer ${env.HEALTH_CHECK_TOKEN}`);
      const supplied = Buffer.from(String(req.headers?.authorization || ''));
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return reply(401, 'unavailable');
    }
    try {
      pool ||= createPool(env);
      await pool.query('SELECT 1');
      return reply(200, 'ok');
    } catch {
      log('health_check_failed');
      return reply(503, 'unavailable');
    }
  };
}

export default createHealthHandler();

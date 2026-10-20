import { readConfig } from './config.js';
import { createAuth } from './auth.js';
import { capabilities, createAccountHandler, reply } from './handler.js';
import { logOperationalEvent } from './observability.js';

// One lazy auth runtime / PostgreSQL pool per warm Function instance.
// Schema migrations are an explicit deployment command, never a request action.
export function createVercelHandler({ env = process.env, createRuntime = createAuth } = {}) {
  let runtime;
  async function initialize(config) {
    let pool;
    try {
      const created = createRuntime(config);
      pool = created.pool;
      // Better Auth caches context initialization. Discard a failed context so a
      // temporary database outage does not require a redeploy to recover.
      await created.auth.$context;
      return createAccountHandler(config, created.auth, pool, { vercel: env.VERCEL === '1' });
    } catch {
      try { await pool?.end?.(); } catch {}
      throw new Error('Account initialization failed');
    }
  }
  return async (req, res) => {
    let config;
    try { config = readConfig(env); }
    catch {
      if (req.method === 'GET' && req.url?.split('?')[0] === '/api/auth/config') return reply(res, 200, capabilities(null));
      return reply(res, 503, { message: 'Account service is not configured. PDF compression is available without an account.' });
    }
    if (req.method === 'GET' && req.url?.split('?')[0] === '/api/auth/config') return reply(res, 200, capabilities(config));
    try {
      runtime ||= initialize(config).catch(error => { runtime = undefined; throw error; });
      return await (await runtime)(req, res);
    } catch {
      logOperationalEvent('auth_server_error');
      return reply(res, 503, { message: 'Account service is temporarily unavailable' });
    }
  };
}

export default createVercelHandler();

import { readConfig } from './config.js';
import { createAuth } from './auth.js';
import { capabilities, createAccountHandler, reply } from './handler.js';

// One lazy auth runtime / PostgreSQL pool per warm Function instance.
// Schema migrations are an explicit deployment command, never a request action.
export function createVercelHandler({ env = process.env, createRuntime = createAuth } = {}) {
  let runtime;
  return async (req, res) => {
    let config;
    try { config = readConfig(env); }
    catch {
      if (req.method === 'GET' && req.url?.split('?')[0] === '/api/auth/config') return reply(res, 200, capabilities(null));
      return reply(res, 503, { message: 'Account service is not configured. PDF compression is available without an account.' });
    }
    try {
      if (!runtime) {
        const { auth, pool } = createRuntime(config);
        runtime = createAccountHandler(config, auth, pool, { vercel: env.VERCEL === '1' });
      }
      return await runtime(req, res);
    } catch { return reply(res, 503, { message: 'Account service is temporarily unavailable' }); }
  };
}

export default createVercelHandler();

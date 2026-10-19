import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { toNodeHandler } from 'better-auth/node';

export const MAX_ACCOUNT_BODY = 16384;
export const capabilities = config => ({ configured: Boolean(config), google: Boolean(config?.googleEnabled), emailRegistration: Boolean(config?.emailEnabled), passwordReset: Boolean(config?.emailEnabled) });
export function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}

export function createAccountHandler(config, auth, pool, { vercel = false } = {}) {
  const handler = toNodeHandler(auth);
  return async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const rawPath = String(req.url || '').split('?')[0];
      if (/%2f|%5c|%2e/i.test(rawPath) || rawPath.includes('..') || rawPath.includes('\\')) return reply(res, 400, { message: 'Invalid account path' });
      const path = new URL(req.url, config.PUBLIC_SITE_URL).pathname;
      if (path === '/healthz' && req.method === 'GET' && !vercel) {
        try { await pool.query('SELECT 1'); return reply(res, 200, { status: 'ok' }); }
        catch { return reply(res, 503, { status: 'unavailable' }); }
      }
      if (!path.startsWith('/api/auth/')) return reply(res, 404, { message: 'Not found' });
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(res, 405, { message: 'Method not allowed' }); }
      if (req.headers.origin && req.headers.origin !== config.PUBLIC_SITE_URL) return reply(res, 403, { message: 'Origin is not allowed' });
      if (path === '/api/auth/config' && req.method === 'GET') return reply(res, 200, capabilities(config));
      if (req.method === 'POST') {
        if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || ''))) return reply(res, 415, { message: 'JSON required' });
        if (Number(req.headers['content-length'] || 0) > MAX_ACCOUNT_BODY) return reply(res, 413, { message: 'Request too large' });
        let body;
        if (req.body !== undefined) body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
        else {
          const chunks = []; let length = 0;
          for await (const chunk of req) { const bytes = Buffer.from(chunk); length += bytes.length; if (length > MAX_ACCOUNT_BODY) return reply(res, 413, { message: 'Request too large' }); chunks.push(bytes); }
          body = Buffer.concat(chunks);
        }
        if (Buffer.byteLength(body) > MAX_ACCOUNT_BODY) return reply(res, 413, { message: 'Request too large' });
        try { req.body = JSON.parse(body.toString()); } catch { return reply(res, 400, { message: 'Invalid JSON' }); }
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return reply(res, 400, { message: 'JSON object required' });
        if (!config.emailEnabled && ['/api/auth/sign-up/email', '/api/auth/request-password-reset', '/api/auth/send-verification-email'].includes(path)) return reply(res, 503, { message: 'Email delivery is not configured. Please try Google sign-in if available.' });
      }
      let clientIP = req.socket?.remoteAddress || '127.0.0.1';
      if (vercel) {
        const forwarded = String(req.headers['x-vercel-forwarded-for'] || '').split(',')[0].trim();
        if (isIP(forwarded)) clientIP = forwarded;
      } else {
        const key = Buffer.from(String(req.headers['x-account-proxy-key'] || ''));
        const expected = Buffer.from(config.TRUSTED_PROXY_SECRET || '');
        const trusted = expected.length && key.length === expected.length && timingSafeEqual(key, expected);
        const forwarded = String(req.headers['x-account-client-ip'] || '');
        if (trusted && isIP(forwarded)) clientIP = forwarded;
      }
      req.headers['x-account-client-ip'] = clientIP;
      delete req.headers['x-account-proxy-key'];
      // Node adapter URL construction must not trust caller-supplied host/proto.
      const site = new URL(config.PUBLIC_SITE_URL);
      req.headers.host = site.host;
      req.headers['x-forwarded-host'] = site.host;
      req.headers['x-forwarded-proto'] = site.protocol.slice(0, -1);
      await handler(req, res);
    } catch {
      if (!res.headersSent) reply(res, 503, { message: 'Account service is temporarily unavailable' });
      else res.end();
    }
  };
}

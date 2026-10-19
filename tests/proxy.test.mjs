import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createVercelHandler } from '../server/vercel.js';

const env = { NODE_ENV: 'test', PUBLIC_SITE_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://x:x@127.0.0.1:1/x', BETTER_AUTH_SECRET: 'a-test-secret-with-more-than-32-characters' };
async function serve(t, handler) {
  const server = http.createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('unconfigured and partially configured accounts fail closed without disclosing configuration', async t => {
  for (const partial of [{}, { ...env, GOOGLE_CLIENT_ID: 'secret-test-id' }, { ...env, SMTP_HOST: 'secret-smtp.example' }, { ...env, NODE_ENV: 'production', PUBLIC_SITE_URL: 'https://site.example' }]) {
    const base = await serve(t, createVercelHandler({ env: partial, createRuntime() { throw new Error('must not create runtime'); } }));
    const config = await fetch(`${base}/api/auth/config`);
    assert.equal(config.status, 200);
    assert.deepEqual(await config.json(), { configured: false, google: false, emailRegistration: false, passwordReset: false });
    const login = await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST' });
    assert.equal(login.status, 503); assert.doesNotMatch(await login.text(), /secret-test|secret-smtp|DATABASE_URL/);
    assert.equal(login.headers.get('cache-control'), 'no-store');
  }
});

test('direct Vercel account handler validates JSON, origin, paths, and reuses one warm runtime', async t => {
  let starts = 0;
  const handler = createVercelHandler({ env, createRuntime: () => { starts++; return { auth: { handler: async request => new Response(JSON.stringify({ ip: request.headers.get('x-account-client-ip'), url: request.url }), { headers: { 'content-type': 'application/json' } }) }, pool: {} }; } });
  const base = await serve(t, handler);
  for (const [path, options, status] of [
    ['/anything', {}, 404],
    ['/api/auth/%2fget-session', {}, 400],
    ['/api/auth/get-session', { method: 'DELETE' }, 405],
    ['/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'multipart/form-data' }, body: 'pdf data' }, 415],
    ['/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(17000) }, 413],
    ['/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }, 400],
    ['/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]' }, 400],
    ['/api/auth/sign-in/email', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' }, 403],
    ['/api/auth/sign-up/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, 503],
  ]) assert.equal((await fetch(`${base}${path}`, options)).status, status, path);
  const config = await fetch(`${base}/api/auth/config`); assert.equal((await config.json()).configured, true);
  const response = await fetch(`${base}/api/auth/get-session`, { headers: { 'x-account-client-ip': '203.0.113.4', 'x-vercel-forwarded-for': '203.0.113.5', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' } });
  const data = await response.json(); assert.equal(data.ip, '127.0.0.1'); assert.equal(data.url, `${env.PUBLIC_SITE_URL}/api/auth/get-session`); assert.equal(starts, 1);
});

test('only the Vercel runtime uses its verified ingress IP header; cookies and OAuth redirects survive', async t => {
  const base = await serve(t, createVercelHandler({ env: { ...env, VERCEL: '1' }, createRuntime: () => ({ auth: { handler: async request => new Response(null, { status: 302, headers: [['location', `${env.PUBLIC_SITE_URL}/en/`], ['set-cookie', 'session=one; HttpOnly; Secure'], ['set-cookie', 'state=two; HttpOnly; Secure'], ['x-test-ip', request.headers.get('x-account-client-ip')]] }) }, pool: {} }) }));
  const response = await fetch(`${base}/api/auth/callback/google?code=synthetic`, { redirect: 'manual', headers: { 'x-vercel-forwarded-for': '203.0.113.6', 'x-account-client-ip': 'spoofed' } });
  assert.equal(response.status, 302); assert.equal(response.headers.get('location'), `${env.PUBLIC_SITE_URL}/en/`);
  assert.equal(response.headers.getSetCookie().length, 2); assert.equal(response.headers.get('x-test-ip'), '203.0.113.6');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readConfig } from '../config.js';
import { createServer } from '../index.js';
import { createAuth } from '../auth.js';
import { memoryAdapter } from 'better-auth/adapters/memory';

const env = { NODE_ENV: 'test', PUBLIC_SITE_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://x:x@127.0.0.1:1/x', BETTER_AUTH_SECRET: 'a-test-secret-with-more-than-32-characters' };
test('configuration rejects unsafe production origin and partial OAuth credentials', () => {
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production' }), /HTTPS/);
  assert.throws(() => readConfig({ ...env, GOOGLE_CLIENT_ID: 'id' }), /Both Google/);
  assert.throws(() => readConfig({ ...env, PUBLIC_SITE_URL: 'https://example.com/path' }), /origin/);
  assert.throws(() => readConfig({ ...env, BETTER_AUTH_SECRET: 'short' }), /BETTER_AUTH_SECRET/);
  assert.equal(readConfig(env).emailEnabled, false);
});
test('HTTP API has real health status, fail-closed email, CSRF origin and body limits', async t => {
  const config = readConfig(env);
  const server = createServer(config, { handler: async request => new Response(JSON.stringify({ parsed: await request.json() }), { headers: { 'content-type': 'application/json' } }) }, { query: async () => { throw new Error('offline'); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/healthz`)).status, 503);
  assert.deepEqual(await (await fetch(`${base}/api/auth/config`)).json(), { configured: true, google: false, emailRegistration: false, passwordReset: false, accountDeletion: false });
  assert.equal((await post('/api/auth/sign-up/email', { email: 'x@example.com' })).status, 503);
  assert.equal((await post('/api/auth/delete-user', { callbackURL: env.PUBLIC_SITE_URL })).status, 503);
  assert.equal((await post('/api/auth/sign-in/email', {}, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/auth/sign-in/email', { payload: 'x'.repeat(17000) })).status, 413);
  const response = await post('/api/auth/sign-in/email', { email: 'x@example.com', password: 'test' });
  assert.deepEqual(await response.json(), { parsed: { email: 'x@example.com', password: 'test' } });
  assert.equal((await fetch(`${base}/api/upload`)).status, 404);
});
test('actual Better Auth rejects an untrusted origin', async () => {
  const { auth, pool } = createAuth(readConfig(env), { database: memoryAdapter({ user: [], session: [], account: [], verification: [], rateLimit: [] }) });
  try {
    const response = await auth.handler(new Request('http://localhost:5173/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ email: 'test@example.com', password: 'password123456' }) }));
    assert.equal(response.status, 403);
    const redirect = await auth.handler(new Request('http://localhost:5173/api/auth/sign-in/social', { method: 'POST', headers: { 'content-type': 'application/json', origin: env.PUBLIC_SITE_URL }, body: JSON.stringify({ provider: 'google', callbackURL: 'https://evil.example/' }) }));
    assert.equal(redirect.status, 403);
  } finally { await pool.end(); }
});
test('actual auth lifecycle: verified email, session, reset and logout (in-memory test adapter, captured SMTP)', async () => {
  const messages = [];
  const { auth, pool } = createAuth(readConfig({ ...env, SMTP_HOST: 'test.local', SMTP_FROM: 'accounts@test.local' }), {
    database: memoryAdapter({ user: [], session: [], account: [], verification: [], rateLimit: [] }), mailer: { sendMail: async mail => { messages.push(mail); } },
  });
  const call = (path, data, cookie) => auth.handler(new Request(`http://localhost:5173/api/auth/${path}`, {
    method: data ? 'POST' : 'GET', headers: { origin: env.PUBLIC_SITE_URL, ...(data ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: data ? JSON.stringify(data) : undefined,
  }));
  try {
    const credentials = { email: 'test@example.com', password: 'Test123!', name: 'Test User' };
    assert.equal((await call('sign-up/email', { ...credentials, password: 'Test12!' })).status, 400);
    const signup = await call('sign-up/email', { ...credentials, callbackURL: 'http://localhost:5173/?account=verified' });
    assert.equal(signup.status, 200, await signup.text());
    assert.equal((await call('sign-in/email', credentials)).status, 403);
    assert.equal(messages.length, 1);
    const verifyURL = messages[0].text.match(/http:\/\/[^\s]+/)[0];
    const verified = await auth.handler(new Request(verifyURL));
    assert.ok([200, 302].includes(verified.status));
    const signin = await call('sign-in/email', credentials); assert.equal(signin.status, 200);
    const cookie = signin.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const session = await (await call('get-session', null, cookie)).json(); assert.equal(session.user.email, credentials.email);
    assert.equal((await call('request-password-reset', { email: credentials.email, redirectTo: 'http://localhost:5173/?account=reset' })).status, 200);
    assert.equal(messages.length, 2);
    const resetURL = messages[1].text.match(/http:\/\/[^\s]+/)[0];
    const token = new URL(resetURL).pathname.split('/').pop();
    assert.equal((await call('reset-password', { token, newPassword: 'New1234!' })).status, 200);
    assert.equal((await call('sign-in/email', credentials)).status, 401);
    assert.equal((await call('sign-in/email', { ...credentials, password: 'New1234!' })).status, 200);
    assert.equal((await call('sign-out', {}, cookie)).status, 200);
    assert.equal((await (await call('get-session', null, cookie)).json()), null);
  } finally { await pool.end(); }
});

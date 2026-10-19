import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createVercelHandler } from '../vercel.js';
import { createAuth } from '../auth.js';
import { readConfig } from '../config.js';

test('production database TLS is mandatory on Vercel; explicit same-host Docker exception stays isolated', () => {
  const base = { NODE_ENV: 'production', PUBLIC_SITE_URL: 'https://site.example', DATABASE_URL: 'postgresql://x:x@postgres/x', BETTER_AUTH_SECRET: 'a-serverless-test-secret-with-more-than-32-characters' };
  assert.throws(() => readConfig(base), /TLS/);
  assert.doesNotThrow(() => readConfig({ ...base, ALLOW_INSECURE_LOCAL_DATABASE: 'true' }));
  assert.throws(() => readConfig({ ...base, ALLOW_INSECURE_LOCAL_DATABASE: 'true', VERCEL: '1' }), /TLS/);
  assert.throws(() => readConfig({ ...base, ALLOW_INSECURE_LOCAL_DATABASE: 'true', DATABASE_URL: 'postgresql://x:x@external.example/x' }), /TLS/);
  assert.doesNotThrow(() => readConfig({ ...base, VERCEL: '1', DATABASE_URL: 'postgresql://x:x@external.example/x?sslmode=require' }));
  assert.equal(readConfig({ ...base, PUBLIC_SITE_URL: '', SITE_URL: 'https://site.example', DATABASE_URL: 'postgresql://x:x@external.example/x?sslmode=require' }).PUBLIC_SITE_URL, 'https://site.example');
});

// Actual Better Auth Node adapter through the same entrypoint as Vercel.
// Mail is captured; no live Google / SMTP credentials or Neon service are implied.
test('Vercel handler: real auth lifecycle, separate cookies, anonymous null, bilingual mail and safe redirects', async t => {
  const origin = 'https://site.example';
  const env = { NODE_ENV: 'production', PUBLIC_SITE_URL: origin, DATABASE_URL: 'postgresql://x:x@127.0.0.1:1/x?sslmode=require', BETTER_AUTH_SECRET: 'a-serverless-test-secret-with-more-than-32-characters', SMTP_HOST: 'test.local', SMTP_FROM: 'accounts@test.local', VERCEL: '1' };
  const messages = []; let pool, starts = 0;
  const handler = createVercelHandler({ env, createRuntime: config => {
    starts++;
    const runtime = createAuth(config, { database: memoryAdapter({ user: [], session: [], account: [], verification: [], rateLimit: [] }), mailer: { sendMail: async message => messages.push(message) } });
    pool = runtime.pool; return runtime;
  } });
  const server = http.createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await pool?.end(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let locale = 'fr';
  const call = (path, data, cookie) => fetch(`${base}/api/auth/${path}`, { method: data ? 'POST' : 'GET', headers: { origin, 'accept-language': locale, 'x-vercel-forwarded-for': locale === 'fr' ? '203.0.113.1' : '203.0.113.2', ...(data ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: data ? JSON.stringify(data) : undefined, redirect: 'manual' });
  assert.equal(await (await call('get-session')).json(), null);
  for (locale of ['fr', 'en']) {
    const credentials = { email: `${locale}@example.test`, password: 'a-strong-password-for-tests', name: `Test ${locale}` };
    const callbackURL = `${origin}${locale === 'en' ? '/en/' : '/'}?account=verified`;
    let response = await call('sign-up/email', { ...credentials, callbackURL }); assert.equal(response.status, 200, await response.text());
    const verification = messages.find(message => message.to === credentials.email);
    assert.match(verification.subject, locale === 'fr' ? /^Confirmez/ : /^Verify/);
    const verifyURL = new URL(verification.text.match(/https:\/\/[^\s]+/)[0]);
    response = await fetch(`${base}${verifyURL.pathname}${verifyURL.search}`, { redirect: 'manual' });
    assert.equal(response.status, 302); assert.equal(response.headers.get('location'), callbackURL);
    response = await call('sign-in/email', credentials); assert.equal(response.status, 200, await response.text());
    const cookies = response.headers.getSetCookie(); assert.ok(cookies.some(cookie => /HttpOnly/i.test(cookie) && /Secure/i.test(cookie)));
    const cookie = cookies.map(value => value.split(';')[0]).join('; ');
    assert.equal((await (await call('get-session', null, cookie)).json()).user.email, credentials.email);
    response = await call('request-password-reset', { email: credentials.email, redirectTo: `${origin}${locale === 'en' ? '/en/' : '/'}?account=reset` }); assert.equal(response.status, 200);
    const reset = messages.filter(message => message.to === credentials.email)[1];
    assert.match(reset.subject, locale === 'fr' ? /^Réinitialisez/ : /^Reset/);
    const token = new URL(reset.text.match(/https:\/\/[^\s]+/)[0]).pathname.split('/').pop();
    response = await call('reset-password', { token, newPassword: 'a-new-strong-password-for-tests' }); assert.equal(response.status, 200, await response.text());
    assert.equal(await (await call('get-session', null, cookie)).json(), null);
    response = await call('sign-in/email', { ...credentials, password: 'a-new-strong-password-for-tests' }); assert.equal(response.status, 200);
    const newCookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.equal((await call('sign-out', {}, newCookie)).status, 200);
    assert.equal(await (await call('get-session', null, newCookie)).json(), null);
  }
  assert.equal(starts, 1);
  const denied = await call('sign-in/social', { provider: 'google', callbackURL: 'https://evil.example' }); assert.equal(denied.status, 403);
});

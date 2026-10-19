import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { getMigrations } from 'better-auth/db/migration';
import { readConfig } from '../config.js';
import { createAuth } from '../auth.js';
import { createServer } from '../index.js';

test('PostgreSQL engine over TCP: migration and real HTTP register/verify/login/session/reset/logout', { timeout: 60000 }, async () => {
  const db = await PGlite.create();
  const postgres = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
  let pool, server;
  try {
    await postgres.start();
    const address = postgres.getServerConn();
    const config = readConfig({ NODE_ENV: 'test', PUBLIC_SITE_URL: 'http://localhost:5173', DATABASE_URL: `postgresql://postgres:postgres@${address}/postgres`, BETTER_AUTH_SECRET: 'postgres-test-secret-with-more-than-32-characters', SMTP_HOST: 'test.local', SMTP_FROM: 'accounts@test.local' });
    const messages = [];
    const account = createAuth(config, { skipSchemaValidation: true, mailer: { sendMail: async message => messages.push(message) } });
    pool = account.pool;
    const migration = await getMigrations(account.auth.options);
    await migration.runMigrations();
    server = createServer(config, account.auth, pool);
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, data, cookie) => fetch(`${base}/api/auth/${path}`, { method: data ? 'POST' : 'GET', headers: { origin: config.PUBLIC_SITE_URL, ...(data ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: data ? JSON.stringify(data) : undefined, redirect: 'manual' });
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    const credentials = { name: 'Postgres Test', email: 'pg@example.com', password: 'a-strong-pg-password' };
    let response = await request('sign-up/email', { ...credentials, callbackURL: 'http://localhost:5173/' });
    assert.equal(response.status, 200, await response.text());
    assert.equal((await request('sign-in/email', credentials)).status, 403);
    const verification = new URL(messages[0].text.match(/http:\/\/[^\s]+/)[0]);
    response = await fetch(`${base}${verification.pathname}${verification.search}`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    response = await request('sign-in/email', credentials); assert.equal(response.status, 200, await response.text());
    const cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    assert.equal((await (await request('get-session', null, cookie)).json()).user.email, credentials.email);
    const stored = await pool.query('SELECT password FROM account WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)', [credentials.email]);
    assert.notEqual(stored.rows[0].password, credentials.password);
    assert.equal((await request('request-password-reset', { email: credentials.email, redirectTo: 'http://localhost:5173/?account=reset' })).status, 200);
    const token = new URL(messages[1].text.match(/http:\/\/[^\s]+/)[0]).pathname.split('/').pop();
    assert.equal((await request('reset-password', { token, newPassword: 'a-new-strong-pg-password' })).status, 200);
    assert.equal((await request('get-session', null, cookie)).status, 200);
    assert.equal(await (await request('get-session', null, cookie)).json(), null);
    response = await request('sign-in/email', { ...credentials, password: 'a-new-strong-pg-password' }); assert.equal(response.status, 200);
    const newCookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    assert.equal((await request('sign-out', {}, newCookie)).status, 200);
    assert.equal(await (await request('get-session', null, newCookie)).json(), null);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    await postgres.stop(); await db.close();
  }
});

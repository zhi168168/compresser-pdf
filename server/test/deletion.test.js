import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../auth.js';
import { readConfig } from '../config.js';
import { createServer } from '../index.js';

test('account deletion requires emailed proof and active session; erases PostgreSQL user, accounts and every session', { timeout: 60000 }, async () => {
  const db = await PGlite.create();
  const postgres = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
  const origin = 'http://localhost:5173';
  const messages = [];
  let pool, server;
  try {
    await postgres.start();
    const config = readConfig({ NODE_ENV: 'test', PUBLIC_SITE_URL: origin, DATABASE_URL: `postgresql://postgres:postgres@${postgres.getServerConn()}/postgres`, BETTER_AUTH_SECRET: 'a-deletion-test-secret-longer-than-32-characters', SMTP_HOST: 'test.local', SMTP_FROM: 'accounts@test.local' });
    const runtime = createAuth(config, { skipSchemaValidation: true, mailer: { sendMail: async message => messages.push(message) } });
    pool = runtime.pool;
    await (await getMigrations(runtime.auth.options)).runMigrations();
    server = createServer(config, runtime.auth, pool);
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (path, body, cookie, locale = 'fr', requestOrigin = origin) => fetch(`${base}/api/auth/${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'manual',
      headers: { origin: requestOrigin, 'accept-language': locale, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const cookies = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const emailURL = mail => new URL(mail.text.match(/http:\/\/[^\s]+/)[0]);
    const open = (url, cookie) => fetch(`${base}${url.pathname}${url.search}`, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
    assert.equal((await call('delete-user', { callbackURL: `${origin}/?account=deleted` })).status, 401);
    for (const [locale, provider] of [['fr', 'credential'], ['en', 'google']]) {
      await pool.query('DELETE FROM "rateLimit"');
      const credentials = { name: `Deletion ${provider}`, email: `${provider}@example.test`, password: 'Deletion-test-123!' };
      assert.equal((await call('sign-up/email', credentials, null, locale)).status, 200);
      assert.equal((await open(emailURL(messages.at(-1)))).status, 302);
      const signedIn = await call('sign-in/email', credentials, null, locale);
      assert.equal(signedIn.status, 200);
      const cookie = cookies(signedIn);
      const secondCookie = cookies(await call('sign-in/email', credentials, null, locale));
      const session = await (await call('get-session', null, cookie)).json();
      const userId = session.user.id;
      if (provider === 'google') {
        // A Google-only database identity without contacting Google or storing real tokens.
        await pool.query('UPDATE account SET "providerId" = $1, password = NULL WHERE "userId" = $2', ['google', userId]);
      }
      const callbackURL = `${origin}${locale === 'en' ? '/en/' : '/'}?account=deleted`;
      assert.equal((await call('delete-user', { callbackURL }, cookie, locale, 'https://evil.example')).status, 403);
      assert.equal((await call('delete-user', { callbackURL: 'https://evil.example/' }, cookie, locale)).status, 403);
      assert.equal((await call('delete-user/callback?token=invalid', null, cookie)).status, 404);
      const context = await runtime.auth.$context;
      await context.internalAdapter.createVerificationValue({ identifier: 'delete-account-expired-proof', value: userId, expiresAt: new Date(Date.now() - 1000) });
      assert.equal((await call('delete-user/callback?token=expired-proof', null, cookie)).status, 404);
      const requested = await call('delete-user', { callbackURL }, cookie, locale);
      assert.equal(requested.status, 200, await requested.clone().text());
      assert.deepEqual(await requested.json(), { success: true, message: 'Verification email sent' });
      const deletionMail = messages.at(-1);
      assert.match(deletionMail.subject, locale === 'en' ? /^Confirm deletion/ : /^Confirmez la suppression/);
      assert.match(deletionMail.text, locale === 'en' ? /same browser while signed in/ : /même navigateur/);
      const url = emailURL(deletionMail);
      assert.equal(url.searchParams.get('callbackURL'), callbackURL);
      assert.equal((await pool.query('SELECT id FROM "user" WHERE id = $1', [userId])).rowCount, 1);
      assert.equal((await open(url)).status, 404, 'A token alone cannot delete without the authenticated session');
      const deleted = await open(url, cookie);
      assert.equal(deleted.status, 302, await deleted.text());
      assert.equal(deleted.headers.get('location'), callbackURL);
      for (const table of ['user', 'account', 'session']) {
        const column = table === 'user' ? 'id' : 'userId';
        assert.equal((await pool.query(`SELECT id FROM "${table}" WHERE "${column}" = $1`, [userId])).rowCount, 0, `${table} must be removed`);
      }
      assert.equal(await (await call('get-session', null, secondCookie)).json(), null);
      assert.equal((await open(url, cookie)).status, 404, 'Deletion link cannot be reused');
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    await postgres.stop(); await db.close();
  }
});

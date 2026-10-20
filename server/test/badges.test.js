import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createBadgeHandler, passwordHash, validateBadges } from '../badges.js';
import { migrateBadges } from '../badge-schema.js';

const example = { id: 'example', href: 'https://example.com/product', src: 'https://example.com/badge.svg', alt: 'Example', title: 'Featured', width: 175, height: 55, enabled: true };
test('badge validation rejects script URLs, duplicate identifiers and unbounded images', () => {
  for (const update of [{ href: 'javascript:alert(1)' }, { src: 'data:text/html,script' }, { src: 'https://user:pass@example.com/a' }, { width: 99999 }, { enabled: 'yes' }]) assert.throws(() => validateBadges([{ ...example, ...update }]));
  assert.throws(() => validateBadges([example, example]));
  assert.deepEqual(validateBadges([example]), [example]);
  assert.equal(validateBadges([{ ...example, src: 'data:image/png;base64,aGVsbG8=' }])[0].src, 'data:image/png;base64,aGVsbG8=');
});

test('database-backed badges: private edits, public filtering, conflicts, CSRF, sessions, password rotation and rate limits', { timeout: 60000 }, async () => {
  const db = await PGlite.create();
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 }); await socket.start();
  const pool = new pg.Pool({ connectionString: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`, max: 2 });
  const origin = 'https://site.example';
  const handler = createBadgeHandler({ env: { PUBLIC_SITE_URL: origin, BETTER_AUTH_SECRET: 'test-secret-not-used-in-production' }, pool });
  const server = http.createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/badges`;
  const password = 'test-only-admin-password'; let cookie = '';
  const call = (data, opts = {}) => fetch(base + (opts.public ? '' : '?admin=1'), { method: data ? 'POST' : 'GET', headers: { cookie, origin, ...(data ? { 'content-type': 'application/json' } : {}), ...opts.headers }, body: data ? JSON.stringify(data) : undefined });
  try {
    await migrateBadges(pool);
    await pool.query('INSERT INTO site_badges (id, badges) VALUES (1, $1::jsonb)', [JSON.stringify([example])]);
    await pool.query('INSERT INTO site_badge_admin (id, password_hash) VALUES (1, $1)', [await passwordHash(password)]);
    let response = await call(null, { public: true }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /s-maxage=30/);
    assert.deepEqual((await response.json()).badges, [example]);
    assert.equal((await call()).status, 401);
    assert.equal((await call({ action: 'save', badges: [], revision: 1 })).status, 401);
    assert.equal((await call({ action: 'login', password }, { headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await call({ action: 'login', password }, { headers: { origin: '' } })).status, 403);
    assert.equal((await call({ action: 'login', password: 'incorrect' })).status, 401);
    response = await call({ action: 'login', password }); assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie'); assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Strict/);
    cookie = setCookie.split(';')[0]; const firstCookie = cookie;
    assert.equal((await call()).status, 200);
    const hidden = { ...example, id: 'hidden', enabled: false };
    response = await call({ action: 'save', badges: [example, hidden], revision: 1 }); assert.equal(response.status, 200); assert.equal((await response.json()).revision, 2);
    assert.equal((await call({ action: 'save', badges: [], revision: 1 })).status, 409);
    assert.equal((await call({ action: 'save', badges: [{ ...example, href: 'javascript:alert(1)' }], revision: 2 })).status, 400);
    assert.equal((await (await call(null, { public: true })).json()).badges.length, 1);
    assert.equal((await (await call()).json()).badges.length, 2);
    const replacementPassword = 'a-different-admin-password';
    assert.equal((await call({ action: 'password', currentPassword: 'wrong', password: replacementPassword })).status, 403);
    assert.equal((await call({ action: 'password', currentPassword: password, password: replacementPassword })).status, 200);
    assert.equal((await call()).status, 401);
    assert.equal((await call({ action: 'login', password })).status, 401);
    response = await call({ action: 'login', password: replacementPassword }); assert.equal(response.status, 200);
    cookie = response.headers.get('set-cookie').split(';')[0];
    assert.equal((await call({ action: 'logout' })).status, 200); assert.equal((await call()).status, 401);
    cookie = firstCookie; assert.equal((await call()).status, 401);
    await pool.query('DELETE FROM site_badge_attempts');
    for (let i = 0; i < 10; i++) assert.equal((await call({ action: 'login', password: 'wrong' })).status, 401);
    assert.equal((await call({ action: 'login', password: replacementPassword })).status, 429);
    assert.equal((await (await call(null, { public: true })).json()).revision, 2);
  } finally { await new Promise(resolve => server.close(resolve)); await pool.end(); await socket.stop(); await db.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthHandler } from '../server/health.js';
import { logOperationalEvent } from '../server/observability.js';

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
}

test('health checks database and reuses its bounded pool without caching responses', async () => {
  let pools = 0; let queries = 0;
  const handler = createHealthHandler({ createPool() { pools++; return { async query(sql) { assert.equal(sql, 'SELECT 1'); queries++; } }; } });
  for (let i = 0; i < 2; i++) {
    const res = response(); await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200); assert.deepEqual(res.body, { status: 'ok' });
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
  assert.equal(pools, 1); assert.equal(queries, 2);
});

test('health failure exposes no database credentials and can recover on a warm instance', async () => {
  const events = []; let failing = true;
  const handler = createHealthHandler({ createPool: () => ({ async query() { if (failing) throw new Error('postgres://secret:password@db.internal'); } }), log: event => events.push(event) });
  const failed = response(); await handler({ method: 'GET' }, failed);
  assert.equal(failed.statusCode, 503); assert.deepEqual(failed.body, { status: 'unavailable' });
  assert.deepEqual(events, ['health_check_failed']);
  failing = false;
  const recovered = response(); await handler({ method: 'GET' }, recovered);
  assert.equal(recovered.statusCode, 200);
});

test('health optional token and method checks never connect to the database', async () => {
  let pools = 0;
  const handler = createHealthHandler({ env: { HEALTH_CHECK_TOKEN: 'private-token' }, createPool() { pools++; return { async query() {} }; } });
  for (const [request, code] of [[{ method: 'POST' }, 405], [{ method: 'GET' }, 401], [{ method: 'GET', headers: { authorization: 'Bearer wrong' } }, 401]]) {
    const res = response(); await handler(request, res); assert.equal(res.statusCode, code);
  }
  assert.equal(pools, 0);
  const res = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer private-token' } }, res);
  assert.equal(res.statusCode, 200); assert.equal(pools, 1);
});

test('operational logs include only an allowlisted event and generated identifier', () => {
  const lines = [];
  logOperationalEvent('mail_delivery_failed', { requestId: 'person@example.com', error: 'password', email: 'person@example.com' }, line => lines.push(line));
  logOperationalEvent('person@example.com', {}, line => lines.push(line));
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(event).sort(), ['event', 'requestId', 'timestamp']);
  assert.match(event.requestId, /^[a-f0-9]{12}$/);
  assert.equal(event.event, 'mail_delivery_failed');
  assert.doesNotMatch(lines[0], /password|person@example|postgres/);
});

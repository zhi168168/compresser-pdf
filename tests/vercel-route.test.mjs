import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import account from '../api/account.js';

test('Vercel rewrite restores nested auth paths and preserves OAuth callback parameters', async t => {
  const server = http.createServer((req, res) => account(req, res));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(`${base}/api/account?__authPath=config`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).configured, false);
  response = await fetch(`${base}/api/account?__authPath=callback%2Fgoogle&code=synthetic&state=test`);
  assert.equal(response.status, 503); // Reaches account service, rather than the hosting 404.
  response = await fetch(`${base}/api/account`);
  assert.equal(response.status, 404);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../auth.js';
import { readConfig } from '../config.js';
import { snapshotAccounts, restoreAccounts, encryptBackup, decryptBackup } from '../../scripts/backup-core.mjs';

test('encrypted snapshots reject tampering and incorrect keys; random nonce per backup', () => {
  const key = 'ab'.repeat(32), snapshot = { secret: 'private-user-record' };
  const first = encryptBackup(snapshot, key), second = encryptBackup(snapshot, key);
  assert.notDeepEqual(first, second);
  assert.equal(first.includes(Buffer.from(snapshot.secret)), false);
  assert.deepEqual(decryptBackup(first, key), snapshot);
  assert.throws(() => decryptBackup(first, 'cd'.repeat(32)));
  first[first.length - 1] ^= 1;
  assert.throws(() => decryptBackup(first, key));
  assert.throws(() => encryptBackup(snapshot, 'short'));
});

test('actual migrated PostgreSQL accounts restore atomically only into an empty target', { timeout: 60000 }, async () => {
  const resources = [];
  const open = async () => {
    const db = await PGlite.create();
    const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
    await socket.start();
    const config = readConfig({ NODE_ENV: 'test', PUBLIC_SITE_URL: 'http://localhost:5173',
      DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`,
      BETTER_AUTH_SECRET: 'backup-test-secret-with-more-than-32-characters' });
    const runtime = createAuth(config, { skipSchemaValidation: true });
    resources.push({ db, socket, pool: runtime.pool });
    await (await getMigrations(runtime.auth.options)).runMigrations();
    return runtime.pool.connect();
  };
  let source, target;
  try {
    source = await open(); target = await open();
    await source.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u1', 'Backup User', 'backup@example.com', true, now(), now())`);
    await source.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ('a1', 'u1', 'credential', 'u1', 'hashed-password', now(), now())`);
    const snapshot = await snapshotAccounts(source);
    assert.equal(snapshot.tables.user.length, 1);
    assert.equal(snapshot.tables.session, undefined);
    const encrypted = encryptBackup(snapshot, 'ab'.repeat(32));
    const roundtrip = decryptBackup(encrypted, 'ab'.repeat(32));
    const invalid = structuredClone(roundtrip);
    invalid.tables.account[0].userId = 'missing';
    await assert.rejects(restoreAccounts(target, invalid));
    assert.equal((await target.query('SELECT count(*) AS count FROM "user"')).rows[0].count, '0');
    await restoreAccounts(target, roundtrip);
    assert.equal((await target.query('SELECT email FROM "user"')).rows[0].email, 'backup@example.com');
    assert.equal((await target.query('SELECT password FROM account')).rows[0].password, 'hashed-password');
    assert.equal((await target.query('SELECT count(*) AS count FROM session')).rows[0].count, '0');
    await assert.rejects(restoreAccounts(target, roundtrip), /must all be empty/);
    assert.equal((await target.query('SELECT count(*) AS count FROM "user"')).rows[0].count, '1');
  } finally {
    source?.release(); target?.release();
    for (const resource of resources.reverse()) {
      await resource.pool.end(); await resource.socket.stop(); await resource.db.close();
    }
  }
});

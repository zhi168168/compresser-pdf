import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { decryptBackup, restoreAccounts, validateDatabaseURL } from './backup-core.mjs';

let client;
try {
  if (process.env.RESTORE_CONFIRM !== 'EMPTY_ISOLATED_DATABASE' || !process.argv[2]) throw new Error('Explicit restore confirmation and backup path required.');
  const connectionString = validateDatabaseURL(process.env.RESTORE_DATABASE_URL);
  if (connectionString === process.env.DATABASE_URL || connectionString === process.env.DB_BACKUP_URL) throw new Error('Use a separate isolated database.');
  const snapshot = decryptBackup(await readFile(process.argv[2]), process.env.BACKUP_ENCRYPTION_KEY);
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 120000 });
  await client.connect();
  await restoreAccounts(client, snapshot);
  console.log('Account restore completed. Review deletion requests and test login before switching production.');
} catch {
  console.error('Restore refused or failed. Check backup integrity/key, matching migrated schema, and that the isolated target is completely empty. No existing account data was overwritten.');
  process.exitCode = 1;
} finally { if (client) await client.end(); }

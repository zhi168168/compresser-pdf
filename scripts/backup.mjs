import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { snapshotAccounts, encryptBackup, validateDatabaseURL } from './backup-core.mjs';

let client;
try {
  const connectionString = validateDatabaseURL(process.env.DB_BACKUP_URL);
  // Validate the key before connecting; only encrypted bytes are ever written to disk.
  encryptBackup({}, process.env.BACKUP_ENCRYPTION_KEY);
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 120000 });
  await client.connect();
  const snapshot = await snapshotAccounts(client);
  const directory = resolve('.local/backups');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = resolve(directory, `accounts-${new Date().toISOString().replaceAll(':', '-')}.enc`);
  await writeFile(filename, encryptBackup(snapshot, process.env.BACKUP_ENCRYPTION_KEY), { flag: 'wx', mode: 0o600 });
  console.log('Encrypted account backup saved in .local/backups.');
} catch {
  // Driver errors can contain connection details. Do not log raw errors or row data.
  console.error('Backup failed. Check secret configuration, connectivity, key format, and migrated account schema. No plaintext backup was written.');
  process.exitCode = 1;
} finally { if (client) await client.end(); }

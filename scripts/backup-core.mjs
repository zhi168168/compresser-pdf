import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('CPDFBAK1');
const TABLES = ['user', 'account', 'session', 'verification', 'rateLimit'];
const SAVED = ['user', 'account'];
const quote = value => `"${value.replaceAll('"', '""')}"`;
const table = name => `public.${quote(name)}`;

function keyBytes(key) {
  if (!/^[a-f\d]{64}$/i.test(key || '')) throw new Error('BACKUP_ENCRYPTION_KEY must contain 64 hexadecimal characters.');
  return Buffer.from(key, 'hex');
}

export function encryptBackup(snapshot, key) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), nonce);
  cipher.setAAD(MAGIC);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot), 'utf8'), cipher.final()]);
  return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), ciphertext]);
}

export function decryptBackup(bytes, key) {
  if (bytes.length < 37 || !bytes.subarray(0, 8).equals(MAGIC)) throw new Error('Invalid encrypted backup format.');
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), bytes.subarray(8, 20));
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(bytes.subarray(20, 36));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]).toString('utf8'));
}

async function schema(client) {
  // pg_catalog exposes column metadata without granting SELECT on session/reset tables.
  const result = await client.query(`SELECT c.relname AS table_name, a.attname AS column_name,
    t.typname AS udt_name, CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])
      AND a.attnum > 0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum`, [TABLES]);
  const metadata = Object.fromEntries(TABLES.map(name => [name, result.rows.filter(row => row.table_name === name)]));
  if (TABLES.some(name => !metadata[name].length)) throw new Error('Migrate all account tables before backup or restore.');
  return metadata;
}

export async function snapshotAccounts(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const metadata = await schema(client);
    const tables = {};
    for (const name of SAVED) {
      const result = await client.query(`SELECT to_jsonb(t) AS record FROM ${table(name)} t ORDER BY id`);
      tables[name] = result.rows.map(row => row.record);
    }
    const snapshot = { format: 'compresser-pdf-accounts', version: 1, createdAt: new Date().toISOString(), sourceRevision: process.env.GITHUB_SHA || null,
      schema: metadata, tables, excludedTables: ['session', 'verification', 'rateLimit'] };
    await client.query('COMMIT');
    return snapshot;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

export async function restoreAccounts(client, snapshot) {
  if (snapshot?.format !== 'compresser-pdf-accounts' || snapshot.version !== 1 ||
    !snapshot.tables || Object.keys(snapshot.tables).sort().join(',') !== [...SAVED].sort().join(',') ||
    SAVED.some(name => !Array.isArray(snapshot.tables[name]))) throw new Error('Unsupported account backup.');
  await client.query('BEGIN');
  try {
    // Lock before checking emptiness: concurrent registration cannot slip between check and restore.
    await client.query(`LOCK TABLE ${TABLES.map(table).join(', ')} IN ACCESS EXCLUSIVE MODE`);
    const metadata = await schema(client);
    if (JSON.stringify(metadata) !== JSON.stringify(snapshot.schema)) throw new Error('Account schema does not match the backup. Use the matching application migration version.');
    for (const name of TABLES) {
      const count = await client.query(`SELECT EXISTS(SELECT 1 FROM ${table(name)}) AS populated`);
      if (count.rows[0].populated) throw new Error('Restore refused: target account tables must all be empty.');
    }
    for (const name of SAVED) {
      const columns = metadata[name].map(row => row.column_name);
      for (const record of snapshot.tables[name]) {
        if (Object.keys(record).sort().join(',') !== [...columns].sort().join(',')) throw new Error('Invalid backup row columns.');
        await client.query(`INSERT INTO ${table(name)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, columns.map(column => record[column]));
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

export function validateDatabaseURL(value) {
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['require', 'verify-full', 'verify-ca'].includes(parsed.searchParams.get('sslmode'))) {
    throw new Error('A PostgreSQL connection URL with required TLS is needed.');
  }
  return value;
}

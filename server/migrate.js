import { getMigrations } from 'better-auth/db/migration';
import { readConfig } from './config.js';
import { createAuth } from './auth.js';
const { auth, pool } = createAuth(readConfig({ ...process.env, DATABASE_URL: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL }), { skipSchemaValidation: true });
try { const { runMigrations } = await getMigrations(auth.options); await runMigrations(); console.log('Account schema is up to date.'); }
finally { await pool.end(); }

import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { migrateBadges } from '../server/badge-schema.js';
import { passwordHash } from '../server/badges.js';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL, max: 1 });
try {
  await migrateBadges(pool);
  const defaults = JSON.parse(await readFile(new URL('../public/badge-defaults.json', import.meta.url), 'utf8'));
  await pool.query('INSERT INTO site_badges (id, badges) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING', [JSON.stringify(defaults)]);
  // Persist the generated password locally before inserting its hash, so an interrupted run cannot lose it.
  if (!(await pool.query('SELECT id FROM site_badge_admin WHERE id = 1')).rows.length) {
    await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
    const file = new URL('../.local/badge-admin-access.txt', import.meta.url);
    let password;
    try { password = (await readFile(file, 'utf8')).match(/管理密码：(.+)/)?.[1]; } catch {}
    password ||= randomBytes(18).toString('base64url');
    await writeFile(file, `管理网址：https://compresser-pdf.com/admin/badges.html\n管理密码：${password}\n\n仅供你本人使用。请保存在密码管理器中。可在管理页面修改密码。\n`, { mode: 0o600 });
    await pool.query('INSERT INTO site_badge_admin (id, password_hash) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [await passwordHash(password)]);
    console.log('Badge admin initialized; access details saved in ignored .local/badge-admin-access.txt.');
  }
  console.log('Badge schema and existing badges initialized without overwriting saved settings.');
} finally { await pool.end(); }

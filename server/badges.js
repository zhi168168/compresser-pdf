import pg from 'pg';
import { randomBytes, createHash, createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { reply } from './handler.js';

const scrypt = promisify(scryptCallback);
const LIMIT = 768 * 1024;
const cookieName = '__Host-badge-admin';
const digest = value => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function passwordMatches(password, hash) {
  const [salt, stored] = hash.split(':');
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(stored, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function httpsURL(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('请填写有效的 HTTPS 地址。');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('仅支持 HTTPS 地址。');
  return url.href;
}
export function validateBadges(input) {
  if (!Array.isArray(input) || input.length > 50) throw new Error('最多保存 50 个徽章。');
  const ids = new Set();
  return input.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) || ids.has(item.id)) throw new Error('徽章标识重复或无效。');
    ids.add(item.id);
    let src;
    if (typeof item.src === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(item.src) && item.src.length <= 140000) src = item.src;
    else src = httpsURL(item.src);
    if (!Number.isInteger(item.width) || item.width < 1 || item.width > 1000 || !Number.isInteger(item.height) || item.height < 1 || item.height > 400) throw new Error('宽度须为 1–1000，高度须为 1–400。');
    if (typeof item.alt !== 'string' || !item.alt.trim() || item.alt.length > 200 || typeof item.title !== 'string' || item.title.length > 200 || typeof item.enabled !== 'boolean') throw new Error('请填写徽章名称（最多 200 字）。');
    return { id: item.id, href: httpsURL(item.href), src, alt: item.alt.trim(), title: item.title, width: item.width, height: item.height, enabled: item.enabled };
  });
}
async function bodyJSON(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('需要 JSON 请求。'), { status: 415 });
  if (Number(req.headers['content-length'] || 0) > LIMIT) throw Object.assign(new Error('内容过大，请减少图片大小。'), { status: 413 });
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
  else {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > LIMIT) throw Object.assign(new Error('内容过大。'), { status: 413 }); chunks.push(Buffer.from(chunk)); }
    raw = Buffer.concat(chunks);
  }
  if (Buffer.byteLength(raw) > LIMIT) throw Object.assign(new Error('内容过大。'), { status: 413 });
  try { const data = JSON.parse(raw.toString()); if (data && typeof data === 'object' && !Array.isArray(data)) return data; } catch {}
  throw Object.assign(new Error('请求内容无效。'), { status: 400 });
}
export function createBadgeHandler({ env = process.env, pool: suppliedPool } = {}) {
  let pool = suppliedPool;
  function database() {
    if (!pool) {
      const url = new URL(env.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || ((env.VERCEL === '1' || env.NODE_ENV === 'production') && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode')))) throw new Error('Database configuration unavailable');
      pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 2, connectionTimeoutMillis: 15000, idleTimeoutMillis: 5000, statement_timeout: 10000, allowExitOnIdle: true });
      pool.on('error', () => {});
    }
    return pool;
  }
  return async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex');
    const send = (status, data) => reply(res, status, data);
    try {
      const url = new URL(req.url, 'http://internal');
      const admin = url.searchParams.get('admin') === '1';
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, { message: '请求方式不支持。' }); }
      const db = database();
      if (req.method === 'GET' && !admin) {
        const { rows } = await db.query('SELECT badges, revision FROM site_badges WHERE id = 1');
        if (!rows[0]) return send(503, { message: '徽章尚未初始化。' });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.end(JSON.stringify({ badges: rows[0].badges.filter(b => b.enabled), revision: rows[0].revision }));
      }
      const origin = env.PUBLIC_SITE_URL || env.SITE_URL;
      if (!origin || (req.method === 'POST' && req.headers.origin !== origin) || (req.headers.origin && req.headers.origin !== origin)) return send(403, { message: '请求来源不允许。' });
      const secure = new URL(origin).protocol === 'https:';
      const name = secure ? cookieName : 'badge-admin';
      const setCookie = (token, maxAge) => res.setHeader('Set-Cookie', `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
      const cookie = String(req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(name + '='))?.slice(name.length + 1);
      const tokenHash = cookie && /^[a-f0-9]{64}$/.test(cookie) ? digest(cookie) : null;
      const data = req.method === 'POST' ? await bodyJSON(req) : null;
      if (data?.action === 'login') {
        if (typeof data.password !== 'string' || data.password.length > 256) return send(400, { message: '请输入管理密码。' });
        if (!env.BETTER_AUTH_SECRET) return send(503, { message: '管理服务尚未配置。' });
        const ip = env.VERCEL === '1' ? String(req.headers['x-vercel-forwarded-for'] || 'unknown').split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
        const key = createHmac('sha256', env.BETTER_AUTH_SECRET).update(`badges:${ip}`).digest('hex');
        const attempt = await db.query(`INSERT INTO site_badge_attempts (id, count, started_at) VALUES ($1, 1, now()) ON CONFLICT (id) DO UPDATE SET count = CASE WHEN site_badge_attempts.started_at < now() - interval '15 minutes' THEN 1 ELSE site_badge_attempts.count + 1 END, started_at = CASE WHEN site_badge_attempts.started_at < now() - interval '15 minutes' THEN now() ELSE site_badge_attempts.started_at END RETURNING count`, [key]);
        if (attempt.rows[0].count > 10) { res.setHeader('Retry-After', '900'); return send(429, { message: '尝试次数过多，请 15 分钟后重试。' }); }
        const { rows } = await db.query('SELECT password_hash, version FROM site_badge_admin WHERE id = 1');
        if (!rows[0] || !await passwordMatches(data.password, rows[0].password_hash)) return send(401, { message: '管理密码不正确。' });
        const token = randomBytes(32).toString('hex');
        await db.query(`INSERT INTO site_badge_sessions (id, expires_at, admin_version) VALUES ($1, now() + interval '8 hours', $2)`, [digest(token), rows[0].version]);
        await db.query(`DELETE FROM site_badge_sessions WHERE expires_at < now()`);
        await db.query(`DELETE FROM site_badge_attempts WHERE started_at < now() - interval '1 day'`);
        setCookie(token, 28800);
        return send(200, { ok: true });
      }
      if (!tokenHash || !(await db.query('SELECT s.id FROM site_badge_sessions s JOIN site_badge_admin a ON a.id = 1 AND a.version = s.admin_version WHERE s.id = $1 AND s.expires_at > now()', [tokenHash])).rows.length) return send(401, { message: '请先输入管理密码。' });
      if (req.method === 'GET') {
        const { rows } = await db.query('SELECT badges, revision FROM site_badges WHERE id = 1');
        return send(200, rows[0]);
      }
      if (data.action === 'logout') {
        await db.query('DELETE FROM site_badge_sessions WHERE id = $1', [tokenHash]); setCookie('', 0);
        return send(200, { ok: true });
      }
      if (data.action === 'password') {
        if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 256 || typeof data.currentPassword !== 'string' || data.currentPassword.length > 256) return send(400, { message: '新密码至少 12 位。' });
        const { rows } = await db.query('SELECT password_hash FROM site_badge_admin WHERE id = 1');
        if (!await passwordMatches(data.currentPassword, rows[0].password_hash)) return send(403, { message: '当前密码不正确。' });
        const hash = await passwordHash(data.password);
        const client = await db.connect();
        try {
          await client.query('BEGIN');
          await client.query('UPDATE site_badge_admin SET password_hash = $1, version = version + 1 WHERE id = 1', [hash]);
          await client.query('DELETE FROM site_badge_sessions');
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
        setCookie('', 0); return send(200, { ok: true });
      }
      if (data.action !== 'save') return send(400, { message: '操作无效。' });
      let badges;
      try { badges = validateBadges(data.badges); } catch (error) { return send(400, { message: error.message }); }
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) return send(400, { message: '版本无效，请刷新页面。' });
      const { rows } = await db.query('UPDATE site_badges SET badges = $1::jsonb, revision = revision + 1, updated_at = now() WHERE id = 1 AND revision = $2 RETURNING revision', [JSON.stringify(badges), data.revision]);
      if (!rows.length) return send(409, { message: '其他页面已更新配置，请先导出当前草稿，再刷新页面重新编辑。' });
      return send(200, { ok: true, revision: rows[0].revision });
    } catch (error) {
      if (error.status) return send(error.status, { message: error.message });
      return send(503, { message: '徽章服务暂时不可用，请稍后重试。' });
    }
  };
}

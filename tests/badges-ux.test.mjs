import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://localhost:5178';
const defaults = JSON.parse(await readFile(new URL('../public/badge-defaults.json', import.meta.url), 'utf8'));
test('local badge requests return JSON without exposing or transforming the server function', async () => {
  const response = await fetch(base + '/api/badges');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).badges.length, defaults.length);
  const admin = await fetch(base + '/api/badges?admin=1');
  assert.equal(admin.status, 503);
  assert.match((await admin.json()).message, /本地预览/);
});

test('badge manager parses inert HTML, preserves drafts, publishes order/visibility and updates both languages', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let state = structuredClone(defaults), revision = 1, loggedIn = false;
    await context.route('**/api/badges*', async route => {
      const request = route.request(), admin = new URL(request.url()).searchParams.has('admin');
      if (request.method() === 'GET') return route.fulfill({ status: admin && !loggedIn ? 401 : 200, json: admin && !loggedIn ? { message: '请先输入管理密码。' } : { badges: admin ? state : state.filter(b => b.enabled), revision } });
      const data = request.postDataJSON();
      if (data.action === 'login') { loggedIn = true; return route.fulfill({ json: { ok: true } }); }
      if (data.action === 'logout') { loggedIn = false; return route.fulfill({ json: { ok: true } }); }
      if (!loggedIn) return route.fulfill({ status: 401, json: { message: '请先输入管理密码。' } });
      if (data.action === 'save') { state = structuredClone(data.badges); revision++; return route.fulfill({ json: { revision } }); }
    });
    await context.route('https://**/*', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="175" height="55"><rect width="175" height="55" fill="#304e2a"/></svg>' }));
    const page = await context.newPage();
    await page.goto(base + '/admin/badges.html');
    assert.equal(await page.locator('#login-panel').isVisible(), true);
    await page.locator('#password').fill('fixture-password'); await page.locator('#login-form button').click();
    await page.locator('.badge-card').first().waitFor(); assert.equal(await page.locator('.badge-card').count(), 5);
    await page.locator('#snippet').fill('<script>window.badgeInjected=true</script><a href="https://example.com/new"><img src="https://example.com/new.svg" width="175" height="55" alt="New badge" onerror="window.badgeInjected=true"></a>');
    await page.locator('#parse').click(); assert.equal(await page.locator('.badge-card').count(), 6);
    assert.equal(await page.evaluate(() => window.badgeInjected), undefined);
    assert.equal(state.length, 5, 'Parsing must not publish automatically');
    await page.locator('.badge-card').last().getByRole('button', { name: '上移' }).click();
    await page.locator('.badge-card').first().locator('input[type=checkbox]').uncheck();
    await page.locator('#save').click(); await page.waitForFunction(() => document.getElementById('dirty').textContent === '已保存');
    assert.equal(state.length, 6); assert.equal(state[0].enabled, false); assert.equal(state[4].alt, 'New badge');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.reload(); await page.locator('.badge-card').first().waitFor(); assert.equal(await page.locator('.badge-card').count(), 6);
    for (const path of ['/', '/en/', '/about.html', '/en/contact.html']) {
      const home = await context.newPage(); await home.goto(base + path);
      await home.waitForFunction(() => document.querySelectorAll('[data-footer-badges] a').length === 5);
      assert.equal(await home.locator('[data-footer-badges] a').nth(3).getAttribute('href'), 'https://example.com/new');
      assert.equal(await home.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await home.close();
    }
    await page.locator('#logout').click(); await page.locator('#login-panel').waitFor(); assert.equal(await page.locator('#editor').isVisible(), false);
    await context.close();
  } finally { await browser.close(); }
});

test('dynamic footer removes every badge for an empty published list and preserves fallback during outages', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/api/badges', route => route.fulfill({ json: { revision: 2, badges: [] } }));
    await page.goto(base + '/'); await page.waitForFunction(() => document.querySelector('[data-footer-badges]').children.length === 0);
    await page.unroute('**/api/badges'); await page.route('**/api/badges', route => route.fulfill({ status: 503, json: {} }));
    await page.reload(); await page.waitForLoadState('networkidle'); assert.equal(await page.locator('[data-footer-badges] a').count(), 5);
  } finally { await browser.close(); }
});

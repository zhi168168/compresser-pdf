import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const origin = (process.env.TEST_URL || 'http://localhost:5178').replace(/\/$/, '');
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
async function fixture() {
  const doc = await PDFDocument.create(); doc.addPage().drawText('Keep this exact PDF through sign-in');
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
async function compress(page, bytes) {
  await page.locator('#file-input').setInputFiles({ name: 'preserve-me.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.locator('#compress-button').click();
  await page.locator('#result-panel').waitFor({ state: 'visible' });
}
async function comparison(page) {
  return page.locator('.size-comparison').innerText();
}
async function download(page) {
  const pending = page.waitForEvent('download'); await page.locator('#download-button').click();
  const result = await pending;
  return { bytes: await readFile(await result.path()), name: result.suggestedFilename() };
}
async function mockAccount(page, state) {
  await page.route('**/api/auth/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith('/config')) json = { configured: true, google: true, emailRegistration: true, passwordReset: true };
    else if (path.endsWith('/get-session')) json = state.signedIn ? { user: { name: 'Test', email: 'test@example.test' } } : null;
    else if (path.endsWith('/sign-in/email')) state.signedIn = true;
    else if (path.endsWith('/sign-in/social')) {
      state.callback = route.request().postDataJSON().callbackURL;
      json = { url: 'https://accounts.google.com/test-workspace-login' };
    }
    state.requests.push({ path, body: route.request().postData() });
    await route.fulfill({ json });
  });
}

test('guest comparison survives email login, dismissal and reload; expired session locks downloading again in both languages', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const language of ['fr', 'en']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const state = { signedIn: false, requests: [] }; await mockAccount(page, state);
      await page.goto(origin + (language === 'fr' ? '/' : '/en/'));
      await compress(page, await fixture());
      const before = await comparison(page);
      assert.equal(await page.locator('#download-button').getAttribute('href'), null);
      assert.match(await page.locator('#download-label').innerText(), language === 'fr' ? /Se connecter/ : /Sign in/);
      if (language === 'fr') {
        await mkdir('docs/screenshots', { recursive: true });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: 'docs/screenshots/download-gate-desktop.png' });
      }
      let downloads = 0; page.on('download', () => downloads++);
      await page.locator('#download-button').click();
      await page.locator('.account-dialog').waitFor({ state: 'visible' });
      assert.equal(downloads, 0); assert.equal(await comparison(page), before);
      assert.match(await page.locator('.account-intro').innerText(), language === 'fr' ? /restent ici/ : /stay here/);
      await page.locator('.account-close').click();
      await page.reload();
      await page.locator('#result-panel').waitFor({ state: 'visible' });
      assert.equal(await comparison(page), before);
      await page.locator('#download-button').click();
      await page.locator('[name="email"]').fill('test@example.test');
      await page.locator('[name="password"]').fill('Test123!');
      await page.locator('.account-primary').click();
      await page.locator('.account-dialog').waitFor({ state: 'hidden' });
      assert.equal(await comparison(page), before);
      const result = await download(page);
      assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 1);
      assert.match(result.name, /^preserve-me.*\.pdf$/);
      state.signedIn = false;
      await page.locator('#download-button').click();
      await page.locator('.account-dialog').waitFor({ state: 'visible' });
      assert.equal(downloads, 1, 'A stale signed-in UI must not permit another download');
      assert(state.requests.filter(r => r.body).every(r => /sign-in\/email$/.test(r.path)), 'Only credentials were posted');
      await context.close();
    }
  } finally { await browser.close(); }
});

test('Google redirect restores original bytes, result bytes, mode and comparison; reset removes the saved workspace', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage(); const state = { signedIn: false, requests: [] };
    await mockAccount(page, state);
    await page.route('https://accounts.google.com/**', async route => {
      state.signedIn = true;
      await route.fulfill({ status: 302, headers: { location: state.callback } });
    });
    await page.goto(origin + '/en/'); const original = await fixture();
    await compress(page, original); const before = await comparison(page);
    await page.locator('#download-button').click();
    await page.locator('.account-dialog').waitFor({ state: 'visible' });
    const stored = await page.evaluate(async () => {
      const { loadWorkspace, resumeID } = await import('/src/workspace-store.js');
      const record = await loadWorkspace(resumeID());
      return { original: [...new Uint8Array(await record.original.arrayBuffer())], result: [...new Uint8Array(await record.result.blob.arrayBuffer())], id: record.id };
    });
    assert.deepEqual(Buffer.from(stored.original), original);
    // The in-memory result must survive saving over a previously expired record
    // immediately before an OAuth redirect.
    await page.evaluate(id => new Promise((resolve, reject) => {
      const open = indexedDB.open('pdf-workspace', 1);
      open.onsuccess = () => {
        const db = open.result; const tx = db.transaction('pending', 'readwrite'); const store = tx.objectStore('pending');
        const get = store.get(id);
        get.onsuccess = () => store.put({ ...get.result, expiresAt: Date.now() - 1 });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      }; open.onerror = () => reject(open.error);
    }), stored.id);
    // A different tab must not accidentally see another tab's PDF.
    const other = await context.newPage(); await other.goto(origin + '/en/');
    assert.equal(await other.locator('#result-panel').isVisible(), false); await other.close();
    await page.locator('[data-account-google]').click();
    await page.waitForURL(url => url.searchParams.get('workspace') === stored.id);
    await page.locator('#result-panel').waitFor({ state: 'visible' });
    assert.equal(await comparison(page), before);
    assert(await page.locator('input[value="recommended"]').isChecked());
    assert.equal(await page.locator('#file-name').innerText(), 'preserve-me.pdf');
    const result = await download(page); assert.deepEqual(result.bytes, Buffer.from(stored.result));
    await page.locator('#adjust-compression').click(); await page.locator('input[value="lossless"]').check();
    await page.locator('#compress-button').click(); await page.locator('#result-panel').waitFor({ state: 'visible' });
    assert.equal((await PDFDocument.load((await download(page)).bytes)).getPageCount(), 1);
    await page.locator('#start-over').click();
    await page.waitForFunction(() => !sessionStorage.getItem('pdf-workspace-resume'));
    await page.reload(); assert.equal(await page.locator('#result-panel').isVisible(), false);
    await context.close();
  } finally { await browser.close(); }
});

test('blocked browser storage prevents a destructive sign-in redirect but keeps email login and the PDF usable', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const state = { signedIn: false, requests: [] }; await mockAccount(page, state);
    await page.addInitScript(() => { indexedDB.open = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
    await page.goto(origin + '/en/'); await compress(page, await fixture()); const before = await comparison(page);
    await mkdir('docs/screenshots', { recursive: true });
    await page.evaluate(() => document.querySelector('#compressor').scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: 'docs/screenshots/download-gate-mobile.png' });
    await page.locator('#download-button').click();
    await page.locator('[data-account-google]').click();
    await page.waitForFunction(() => document.querySelector('[data-account-status]').textContent.includes('preserve'));
    assert.equal(page.url(), origin + '/en/'); assert.equal(await comparison(page), before);
    assert.equal(state.requests.filter(r => r.path.endsWith('/sign-in/social')).length, 0);
    await page.locator('.account-close').click();
    await page.locator('#download-button').click();
    await page.locator('[name="email"]').fill('test@example.test'); await page.locator('[name="password"]').fill('Test123!');
    await page.locator('.account-primary').click(); await page.locator('.account-dialog').waitFor({ state: 'hidden' });
    assert.equal(await comparison(page), before); await download(page);
  } finally { await browser.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const origin = (process.env.TEST_URL || 'http://localhost:5178').replace(/\/$/, '');
test('French-first workflow, localized errors/results/account states, and an explicit English alternative', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
    // Browser language must not force an English redirect away from the French page.
    const requests = [];
    page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
    await page.goto(origin + '/');
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.match(await page.locator('h1').innerText(), /Compresser un PDF/);
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.locator('.account-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('.account-dialog').innerText(), /Google/);
    assert.equal(await page.locator('.account-dialog .account-privacy a').getAttribute('href'), '/privacy.html');
    await page.locator('.account-dialog [data-account-status]').waitFor({ state: 'visible' });
    await page.locator('.account-close').click();
    await page.locator('#file-input').setInputFiles({ name: 'invalide.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
    await page.locator('#error-message').waitFor({ state: 'visible' });
    assert.match(await page.locator('#error-message').innerText(), /PDF valide/);
    const doc = await PDFDocument.create(); doc.addPage();
    const bytes = Buffer.from(await doc.save({ useObjectStreams: false }));
    await page.locator('#file-input').setInputFiles({ name: 'document.pdf', mimeType: 'application/pdf', buffer: bytes });
    await page.locator('#selected-file').waitFor({ state: 'visible' });
    assert.match(await page.locator('#file-size').innerText(), /(?:Ko|o)$/);
    await page.locator('input[value="lossless"]').check();
    assert.match(await page.locator('#quality-note').innerText(), /structure du PDF/);
    await page.locator('#compress-button').click();
    await page.locator('#result-panel').waitFor({ state: 'visible', timeout: 30000 });
    assert.match(await page.locator('#result-title').innerText(), /PDF/);
    const result = await page.locator('#result-description').innerText();
    assert.match(result, /(?:page traitée|réduit la taille)/);
    assert(!/processed|smaller|Original kept/.test(await page.locator('#result-panel').innerText()));
    assert(!requests.some(request => ['POST', 'PUT', 'PATCH'].includes(request.method)), 'No document upload');
    assert(!requests.some(request => request.url.includes('document.pdf') || request.url.includes('invalide.pdf')));
    await page.locator('#start-over').click();
    await page.reload();
    await page.locator('input[value="recommended"]:checked').waitFor({ state: 'visible' });
    await mkdir('docs/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/screenshots/french-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: 'docs/screenshots/french-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'English', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(new URL(page.url()).pathname, '/en/');
    assert.match(await page.locator('h1').innerText(), /Compress PDF/);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    assert.equal(await page.locator('.account-dialog .account-privacy a').getAttribute('href'), '/en/privacy.html');
  } finally { await browser.close(); }
});

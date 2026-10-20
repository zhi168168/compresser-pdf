import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const origin = (process.env.TEST_URL || 'http://localhost:5178').replace(/\/$/, '');
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

test('PDF buttons report one GA event per activation in both languages, including guest download intent', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const doc = await PDFDocument.create(); doc.addPage().drawText('Analytics fixture');
  const buffer = Buffer.from(await doc.save({ useObjectStreams: false }));
  try {
    for (const language of ['fr', 'en']) {
      const page = await browser.newPage();
      // Keep real GA initialization/queueing but never send test events to GA.
      await page.route('https://www.googletagmanager.com/**', route => route.abort());
      await page.route('**/api/auth/**', route => route.fulfill({ json:
        route.request().url().endsWith('/config')
          ? { configured: true, google: true, emailRegistration: true } : null }));
      await page.goto(origin + (language === 'fr' ? '/' : '/en/'));
      await page.waitForFunction(() => document.querySelector('#compressor').getAttribute('aria-busy') === 'false');
      const picker = page.waitForEvent('filechooser');
      await page.locator('.choose-button').click(); await picker;
      const keyboardPicker = page.waitForEvent('filechooser');
      await page.locator('#drop-zone').press('Enter'); await keyboardPicker;
      await page.locator('#file-input').setInputFiles({ name: 'private-filename.pdf', mimeType: 'application/pdf', buffer });
      await page.locator('#compress-button').click();
      await page.locator('#result-panel').waitFor({ state: 'visible' });
      await page.locator('#download-button').click();
      await page.locator('.account-dialog').waitFor({ state: 'visible' });
      const events = await page.evaluate(() => window.dataLayer.filter(entry => entry[0] === 'event').map(entry => [entry[1], entry[2]]));
      assert.deepEqual(events, ['choose_pdf_click', 'choose_pdf_click', 'compress_pdf_click', 'download_pdf_click'].map(name => [name, { language }]));
      // An analytics failure cannot prevent opening the picker.
      await page.locator('.account-close').click();
      await page.locator('#start-over').click();
      await page.evaluate(() => { window.gtag = () => { throw new Error('Analytics blocked'); }; });
      const blockedPicker = page.waitForEvent('filechooser');
      await page.locator('.choose-button').click(); await blockedPicker;
      await page.close();
    }
  } finally { await browser.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { PDFDocument, StandardFonts, PDFName, PDFRawStream } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const url = (process.env.TEST_URL || 'http://localhost:5178').replace(/\/$/, '') + '/en/';
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const text = 'Clear text stays searchable: invoice 2026-1042';
async function downloadPDF(page) {
  const pending = page.waitForEvent('download');
  await page.locator('#download-button').click();
  const download = await pending;
  return { bytes: await readFile(await download.path()), filename: download.suggestedFilename() };
}

test('real browser compression preserves text, pages and image dimensions without uploading files', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/api/auth/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/config')
      ? { configured: true, google: true, emailRegistration: true, passwordReset: true }
      : { user: { name: 'Test', email: 'test@example.test' } } }));
    await page.goto(url);
    await page.waitForSelector('#compress-button', { state: 'attached' });
    assert.equal(await page.locator('#compression-settings').isVisible(), false);
    assert.equal(await page.locator('[data-step="file"]').getAttribute('aria-current'), 'step');
    const photo = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 900;
      const ctx = canvas.getContext('2d'); const im = ctx.createImageData(1200, 900);
      let seed = 42;
      for (let i = 0; i < im.data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        im.data[i] = (i / 4) % 256; im.data[i + 1] = seed >>> 24; im.data[i + 2] = 160; im.data[i + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pdfPage = doc.addPage([612, 792]);
    pdfPage.drawText(text, { x: 30, y: 740, size: 16, font });
    const image = await doc.embedJpg(new Uint8Array(photo));
    pdfPage.drawImage(image, { x: 30, y: 200, width: 550, height: 412.5 });
    const input = Buffer.from(await doc.save({ useObjectStreams: false }));
    const network = [];
    page.on('request', req => { if (['POST', 'PUT', 'PATCH'].includes(req.method())) network.push(req.url()); });
    await page.locator('#file-input').setInputFiles({ name: 'photo-invoice.pdf', mimeType: 'application/pdf', buffer: input });
    await page.locator('#compression-settings').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-step="settings"]').getAttribute('aria-current'), 'step');
    await page.locator('#compress-button').click();
    await page.locator('#result-panel').waitFor({ state: 'visible', timeout: 30000 });
    assert.match(await page.locator('#savings').innerText(), /smaller/);
    const firstDownload = await downloadPDF(page);
    const downloaded = firstDownload.bytes;
    assert(downloaded.length < input.length * 0.8, `${downloaded.length}/${input.length}`);
    assert.deepEqual(network, [], 'Compression must not send request bodies');
    const result = await PDFDocument.load(downloaded);
    assert.equal(result.getPageCount(), 1);
    const images = result.context.enumerateIndirectObjects().map(([, obj]) => obj).filter(obj => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
    assert.equal(images[0].dict.get(PDFName.of('Width')).asNumber(), 1200);
    assert.equal(images[0].dict.get(PDFName.of('Height')).asNumber(), 900);
    const parsed = await getDocument({ data: new Uint8Array(downloaded), useSystemFonts: true }).promise;
    assert((await (await parsed.getPage(1)).getTextContent()).items.some(item => item.str === text));
    await parsed.destroy();
    // Repeat downloading and switch settings after a result.
    assert.equal(firstDownload.filename, 'photo-invoice-compressed.pdf');
    assert.equal(await page.locator('#compression-settings').isVisible(), false);
    assert.equal(await page.locator('[data-step="result"]').getAttribute('aria-current'), 'step');
    await page.locator('#adjust-compression').click();
    await page.locator('input[value="lossless"]').check();
    assert(await page.locator('#compress-button').isVisible());
    await page.locator('#compress-button').click();
    await page.locator('#result-panel').waitFor({ state: 'visible' });
    const losslessBytes = (await downloadPDF(page)).bytes;
    const losslessDoc = await PDFDocument.load(new Uint8Array(losslessBytes));
    const preserved = losslessDoc.context.enumerateIndirectObjects().map(([, obj]) => obj).find(obj => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
    assert.deepEqual(preserved.getContents(), new Uint8Array(photo), 'Lossless mode must preserve encoded image bytes');
    await page.locator('#adjust-compression').click();
    await page.locator('input[value="stronger"]').check();
    await page.locator('#compress-button').click();
    await page.locator('#result-panel').waitFor({ state: 'visible' });
    const strongerBytes = (await downloadPDF(page)).bytes;
    assert(strongerBytes.length < downloaded.length, 'Stronger mode should shrink this photo fixture further');
    await mkdir('docs/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/screenshots/desktop-result.png', fullPage: false });
    console.log(`Fixture: ${input.length} → ${downloaded.length} bytes (${((1 - downloaded.length / input.length) * 100).toFixed(1)}% smaller), text/pages/dimensions preserved.`);
    await page.locator('#start-over').click();
    await page.locator('#file-input').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') });
    await page.locator('#error-message').waitFor({ state: 'visible' });
    assert.match(await page.locator('#error-message').innerText(), /valid PDF/);
    assert(!(await page.locator('#compress-button').isEnabled()));
    await page.reload();
    await page.screenshot({ path: 'docs/screenshots/desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
    await page.locator('[data-auth-open]').click();
    await page.locator('.account-dialog').waitFor({ state: 'visible' });
    assert(await page.locator('.account-dialog').isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  } finally { await browser.close(); }
});

test('worker rejects malformed and signed PDFs and supports abort', async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage(); await page.goto(url);
    const doc = await PDFDocument.create(); doc.addPage();
    doc.context.register(doc.context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite' }));
    const bytes = Array.from(await doc.save());
    const signed = await page.evaluate(async data => {
      const { compressPdf } = await import('/src/compressor.js');
      try { await compressPdf(new File([new Uint8Array(data)], 'signed.pdf'), { mode: 'lossless' }); return ''; } catch (error) { return error.message; }
    }, bytes);
    assert.match(signed, /signature/);
    const malformed = await page.evaluate(async () => {
      const { compressPdf } = await import('/src/compressor.js');
      try { await compressPdf(new File(['%PDF-1.7\ninvalid'], 'bad.pdf')); return ''; } catch (error) { return error.message; }
    });
    assert.match(malformed, /could not be read/);
    const abort = await page.evaluate(async data => {
      const { compressPdf } = await import('/src/compressor.js'); const controller = new AbortController(); controller.abort();
      try { await compressPdf(new File([new Uint8Array(data)], 'signed.pdf'), { signal: controller.signal }); return ''; } catch (error) { return error.name; }
    }, bytes);
    assert.equal(abort, 'AbortError');
    const runningAbort = await page.evaluate(async data => {
      const { compressPdf } = await import('/src/compressor.js'); const controller = new AbortController();
      try { await compressPdf(new File([new Uint8Array(data)], 'signed.pdf'), { signal: controller.signal, onProgress: () => controller.abort() }); return ''; } catch (error) { return error.name; }
    }, bytes);
    assert.equal(runningAbort, 'AbortError');
  } finally { await browser.close(); }
});

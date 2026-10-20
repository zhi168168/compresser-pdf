import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

test('account deletion requires typed confirmation, sends only an email request and supports both languages', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const language of ['fr', 'en']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const requests = [];
      await page.route('**/api/auth/**', async route => {
        const path = new URL(route.request().url()).pathname;
        const body = path.endsWith('/config') ? { configured: true, google: true, emailRegistration: true, passwordReset: true, accountDeletion: true }
          : path.endsWith('/get-session') ? { user: { name: 'Deletion Test', email: 'test@example.test' } }
            : { success: true, message: 'Verification email sent' };
        if (path.endsWith('/delete-user')) requests.push(route.request().postDataJSON());
        await route.fulfill({ json: body });
      });
      const home = (process.env.TEST_URL || 'http://localhost:5178') + (language === 'en' ? '/en/' : '/');
      await page.goto(home);
      await page.waitForFunction(() => /Mon compte|My account/.test(document.querySelector('[data-auth-open]').textContent));
      await page.locator('[data-auth-open]').first().click();
      await page.locator('[data-account-view="delete"]').click();
      assert.match(await page.locator('.account-dialog').innerText(), language === 'fr' ? /Rien ne sera supprimé avant votre confirmation/ : /Nothing is deleted until you confirm/);
      await page.locator('[name="deleteConfirmation"]').fill('wrong');
      await page.locator('[type="submit"]').click();
      assert.equal(requests.length, 0);
      assert.match(await page.locator('[data-account-status]').innerText(), language === 'fr' ? /SUPPRIMER/ : /DELETE/);
      await page.locator('[name="deleteConfirmation"]').fill(language === 'fr' ? 'SUPPRIMER' : 'DELETE');
      await page.locator('[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('[type="submit"]').disabled && /messagerie|inbox/.test(document.querySelector('[data-account-status]').textContent));
      assert.deepEqual(requests, [{ callbackURL: `${home}?account=deleted` }]);
      assert.match(await page.locator('[data-account-status]').innerText(), language === 'fr' ? /restant connecté/ : /still signed in/);
      assert.equal(await page.locator('.account-dialog').evaluate(element => element.scrollWidth <= element.clientWidth), true);
      await page.locator('[data-account-view="account"]').click();
      assert.equal(await page.locator('.account-identity').isVisible(), true);
      await page.close();
    }
  } finally { await browser.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

test('registration checks matching eight-character passwords in both languages; logout has secondary styling', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const language of ['fr', 'en']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const submissions = [];
      let signedIn = false;
      await page.route('**/api/auth/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let json = {};
        if (path.endsWith('/config')) json = { configured: true, google: true, emailRegistration: true, passwordReset: true };
        if (path.endsWith('/get-session')) json = signedIn ? { user: { name: 'Test', email: 'test@example.test' } } : null;
        if (path.endsWith('/sign-up/email')) submissions.push(route.request().postDataJSON());
        await route.fulfill({ json });
      });
      const home = (process.env.TEST_URL || 'http://localhost:5178') + (language === 'en' ? '/en/' : '/');
      await page.goto(home);
      await page.locator('[data-auth-open]').first().click();
      await page.locator('[data-account-view="register"]').click();
      await page.locator('[name="name"]').fill('Test');
      await page.locator('[name="email"]').fill('test@example.test');
      assert.equal(await page.locator('[name="password"]').getAttribute('minlength'), '8');
      await page.locator('[name="password"]').fill('Test123!');
      await page.locator('[name="confirmPassword"]').fill('Different!');
      await page.locator('[type="submit"]').click();
      assert.match(await page.locator('[data-account-status]').innerText(), language === 'fr' ? /ne correspondent pas/ : /do not match/);
      assert.equal(submissions.length, 0);
      await page.locator('[name="confirmPassword"]').fill('Test123!');
      await page.locator('[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('[data-account-status]').textContent.includes('verification') || document.querySelector('[data-account-status]').textContent.includes('confirmation'));
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0].password.length, 8);
      assert.equal('confirmPassword' in submissions[0], false);
      signedIn = true;
      await page.reload();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-auth-open]')].some(button => /Mon compte|My account/.test(button.textContent)));
      await page.locator('[data-auth-open]').first().click();
      const logout = page.locator('[data-account-logout]');
      assert.equal(await logout.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(255, 255, 255)');
      assert.equal(await logout.getAttribute('class'), 'account-signout');
      await page.close();
    }
  } finally { await browser.close(); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuth, accountLocale } from '../auth.js';
import { readConfig } from '../config.js';

test('account UI translator defaults to French, preserves English and unknown user content', async () => {
  const source = await readFile(new URL('../../src/auth.js', import.meta.url), 'utf8');
  const { translateAuthText } = await import(`data:text/javascript;base64,${Buffer.from(source.replace("import './auth.css';", '')).toString('base64')}`);
  assert.equal(translateAuthText('Sign in'), 'Se connecter');
  assert.equal(translateAuthText(' Continue with Google '), ' Continuer avec Google ');
  assert.equal(translateAuthText('Password', 'en'), 'Password');
  assert.equal(translateAuthText('Jane Example'), 'Jane Example');
  assert.equal(translateAuthText('Please wait…'), 'Veuillez patienter…');
  assert.match(translateAuthText('Account service is unavailable. You can still compress PDFs without an account.'), /^Le service/);
});

test('verification and reset emails use each request language with French fallback', async () => {
  const messages = [];
  const origin = 'http://localhost:5173';
  const { auth, pool } = createAuth(readConfig({
    NODE_ENV: 'test', PUBLIC_SITE_URL: origin, DATABASE_URL: 'postgresql://x:x@127.0.0.1:1/x',
    BETTER_AUTH_SECRET: 'a-locale-test-secret-with-more-than-32-characters', SMTP_HOST: 'test.local', SMTP_FROM: 'accounts@test.local',
  }), {
    database: memoryAdapter({ user: [], session: [], account: [], verification: [], rateLimit: [] }),
    mailer: { sendMail: async message => { messages.push(message); } },
  });
  const call = (path, data, locale) => auth.handler(new Request(`${origin}/api/auth/${path}`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json', ...(locale ? { 'accept-language': locale } : {}) }, body: JSON.stringify(data),
  }));
  try {
    for (const [locale, name] of [['en', 'English'], ['fr', 'French'], [undefined, 'Default']]) {
      const email = `${name.toLowerCase()}@example.com`;
      const callbackURL = `${origin}${locale === 'en' ? '/en/' : '/'}?account=verified`;
      const response = await call('sign-up/email', { name, email, password: 'a-strong-locale-password', locale: locale || 'fr', callbackURL }, locale);
      assert.equal(response.status, 200, await response.text());
      const verify = messages.find(mail => mail.to === email);
      assert.match(verify.subject, locale === 'en' ? /^Verify your/ : /^Confirmez votre/);
      const verificationURL = new URL(verify.text.match(/http:\/\/[^\s]+/)[0]);
      assert.equal(verificationURL.searchParams.get('callbackURL'), callbackURL);
      const reset = await call('request-password-reset', { email, locale: locale || 'fr', redirectTo: `${origin}${locale === 'en' ? '/en/' : '/'}?account=reset` }, locale);
      assert.equal(reset.status, 200, await reset.text());
      const resetMail = messages.filter(mail => mail.to === email)[1];
      assert.match(resetMail.subject, locale === 'en' ? /^Reset your/ : /^Réinitialisez votre/);
      assert.match(resetMail.text, locale === 'en' ? /If you did not request this/ : /Si vous n’avez pas fait cette demande/);
    }
    assert.equal(accountLocale(new Request(origin, { headers: { 'accept-language': 'en-US,en;q=0.9' } })), 'en');
    assert.equal(accountLocale(new Request(origin, { headers: { 'accept-language': 'fr-MA,fr;q=0.9,en;q=0.8' } })), 'fr');
  } finally { await pool.end(); }
});

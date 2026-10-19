import { betterAuth } from 'better-auth';
import pg from 'pg';
import nodemailer from 'nodemailer';

// Better Auth passes the originating Request separately to each mail callback.
// Locale remains request-scoped and is never stored in shared mutable state.
export function accountLocale(request) {
  const first = (request?.headers?.get('accept-language') || '').split(',')[0].split(';')[0].trim().toLowerCase();
  return first === 'en' || first.startsWith('en-') ? 'en' : 'fr';
}

export function accountEmail(kind, url, locale = 'fr') {
  if (locale === 'en') return kind === 'reset'
    ? { subject: 'Reset your Compresser PDF password', text: `Reset your password using this link:\n${url}\n\nIf you did not request this, ignore this email.` }
    : { subject: 'Verify your Compresser PDF email', text: `Verify your email using this link:\n${url}\n\nIf you did not create an account, ignore this email.` };
  return kind === 'reset'
    ? { subject: 'Réinitialisez votre mot de passe Compresser PDF', text: `Réinitialisez votre mot de passe à l’aide de ce lien :\n${url}\n\nSi vous n’avez pas fait cette demande, ignorez cet e-mail.` }
    : { subject: 'Confirmez votre adresse e-mail Compresser PDF', text: `Confirmez votre adresse e-mail à l’aide de ce lien :\n${url}\n\nSi vous n’avez pas créé de compte, ignorez cet e-mail.` };
}

export function createAuth(config, testDependencies = {}) {
  // Small warm-instance pool; allow suspended Neon compute to wake up.
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 3, connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000, allowExitOnIdle: true });
  pool.on('error', () => console.error('Account database connection failed.'));
  const mailer = testDependencies.mailer || (config.emailEnabled ? nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465,
    requireTLS: config.NODE_ENV === 'production' && config.SMTP_PORT !== 465,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {}),
    connectionTimeout: 10000, socketTimeout: 15000,
  }) : null);
  const send = async (email, kind, url, request) => {
    const { subject, text } = accountEmail(kind, url, accountLocale(request));
    if (!mailer) throw new Error('Email service is not configured');
    await mailer.sendMail({ from: config.SMTP_FROM, to: email, subject, text });
  };
  const auth = betterAuth({
    appName: 'Compresser PDF', baseURL: config.PUBLIC_SITE_URL, basePath: '/api/auth',
    secret: config.BETTER_AUTH_SECRET, database: testDependencies.database || pool,
    trustedOrigins: [config.PUBLIC_SITE_URL],
    telemetry: { enabled: false },
    advanced: { useSecureCookies: config.NODE_ENV === 'production', trustedProxyHeaders: false,
      database: { validateSchema: !testDependencies.skipSchemaValidation },
      ipAddress: { ipAddressHeaders: ['x-account-client-ip'] } },
    emailAndPassword: {
      enabled: true, disableSignUp: !config.emailEnabled, requireEmailVerification: true,
      minPasswordLength: 12, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true,
      ...(mailer ? { sendResetPassword: async ({ user, url }, request) => send(user.email, 'reset', url, request) } : {}),
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }, request) => send(user.email, 'verify', url, request),
    },
    socialProviders: config.googleEnabled ? { google: { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET } } : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    account: { accountLinking: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 40,
      customRules: { '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 60, max: 3 }, '/request-password-reset': { window: 60, max: 3 }, '/send-verification-email': { window: 60, max: 3 } } },
    logger: { level: 'error' },
  });
  return { auth, pool };
}

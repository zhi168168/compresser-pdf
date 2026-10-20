import { betterAuth } from 'better-auth';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { logOperationalEvent } from './observability.js';

// Better Auth passes the originating Request separately to each mail callback.
// Locale remains request-scoped and is never stored in shared mutable state.
export function accountLocale(request) {
  const first = (request?.headers?.get('accept-language') || '').split(',')[0].split(';')[0].trim().toLowerCase();
  return first === 'en' || first.startsWith('en-') ? 'en' : 'fr';
}

export function accountEmail(kind, url, locale = 'fr') {
  if (kind === 'delete') return locale === 'en'
    ? { subject: 'Confirm deletion of your Compresser PDF account', text: `You requested permanent deletion of your account, including your profile, linked sign-in accounts and all sessions. This cannot be undone. Your PDFs stay on your device.\n\nConfirm within 1 hour using this link in the same browser while signed in:\n${url}\n\nIf you did not request this, do not open the link. Your account has not been deleted.` }
    : { subject: 'Confirmez la suppression de votre compte Compresser PDF', text: `Vous avez demandé la suppression définitive de votre compte, y compris votre profil, vos comptes de connexion associés et toutes vos sessions. Cette action est irréversible. Vos PDF restent sur votre appareil.\n\nConfirmez dans un délai d’une heure avec ce lien, dans le même navigateur et en restant connecté :\n${url}\n\nSi vous n’avez pas fait cette demande, n’ouvrez pas ce lien. Votre compte n’a pas été supprimé.` };
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
  pool.on('error', () => logOperationalEvent('database_connection_failed'));
  const mailer = testDependencies.mailer || (config.emailEnabled ? nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465,
    requireTLS: config.NODE_ENV === 'production' && config.SMTP_PORT !== 465,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {}),
    connectionTimeout: 10000, socketTimeout: 15000,
  }) : null);
  const send = async (email, kind, url, request) => {
    const { subject, text } = accountEmail(kind, url, accountLocale(request));
    if (!mailer) throw new Error('Email service is not configured');
    try { await mailer.sendMail({ from: config.SMTP_FROM, to: email, subject, text }); }
    catch { logOperationalEvent('mail_delivery_failed'); throw new Error('Email delivery failed'); }
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
      minPasswordLength: 8, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true,
      ...(mailer ? { sendResetPassword: async ({ user, url }, request) => send(user.email, 'reset', url, request) } : {}),
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }, request) => send(user.email, 'verify', url, request),
    },
    socialProviders: config.googleEnabled ? { google: { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET } } : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    account: { accountLinking: { enabled: false } },
    // Always require a fresh email token for either password or Google accounts.
    // Disabling email must disable deletion, never fall back to session-only deletion.
    user: { deleteUser: { enabled: Boolean(config.emailEnabled), deleteTokenExpiresIn: 3600,
      sendDeleteAccountVerification: async ({ user, url }, request) => send(user.email, 'delete', url, request),
    } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 40,
      customRules: { '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 60, max: 3 }, '/request-password-reset': { window: 60, max: 3 }, '/send-verification-email': { window: 60, max: 3 }, '/delete-user': { window: 60, max: 3 } } },
    // Never print framework error arguments: they may contain emails, tokens or URLs.
    // The HTTP handler records only a fixed operational event for server failures.
    logger: { disabled: true },
  });
  return { auth, pool };
}

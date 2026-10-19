import { z } from 'zod';

export function readConfig(env = process.env) {
  // Never derive the origin from request Host / forwarding headers.
  env = { ...env, PUBLIC_SITE_URL: env.PUBLIC_SITE_URL || env.SITE_URL };
  const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
    BETTER_AUTH_SECRET: z.string().min(32),
    PUBLIC_SITE_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().optional(), GOOGLE_CLIENT_SECRET: z.string().optional(),
    SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(), SMTP_PASS: z.string().optional(), SMTP_FROM: z.string().optional(),
    TRUSTED_PROXY_SECRET: z.string().min(32).optional(),
  });
  const result = schema.safeParse(env);
  if (!result.success) throw new Error(`Invalid account configuration: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const config = result.data;
  const site = new URL(config.PUBLIC_SITE_URL);
  if (site.pathname !== '/' || site.search || site.hash || site.username || site.password) throw new Error('PUBLIC_SITE_URL must be an origin, without a path or credentials');
  if (config.NODE_ENV === 'production' && site.protocol !== 'https:') throw new Error('Production PUBLIC_SITE_URL requires HTTPS');
  const database = new URL(config.DATABASE_URL);
  const isolatedLocalDatabase = env.VERCEL !== '1' && env.ALLOW_INSECURE_LOCAL_DATABASE === 'true' && ['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(database.hostname);
  if (config.NODE_ENV === 'production' && !isolatedLocalDatabase && !['require', 'verify-ca', 'verify-full'].includes(database.searchParams.get('sslmode'))) throw new Error('Production DATABASE_URL requires TLS (sslmode=require or verify-full)');
  if (!['http:', 'https:'].includes(site.protocol)) throw new Error('PUBLIC_SITE_URL requires HTTP(S)');
  config.PUBLIC_SITE_URL = site.origin;
  config.googleEnabled = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  if (Boolean(config.GOOGLE_CLIENT_ID) !== Boolean(config.GOOGLE_CLIENT_SECRET)) throw new Error('Both Google credentials are required');
  config.emailEnabled = Boolean(config.SMTP_HOST && config.SMTP_FROM);
  if (config.SMTP_HOST && !config.SMTP_FROM) throw new Error('SMTP_FROM is required with SMTP_HOST');
  if (config.SMTP_FROM && !config.SMTP_HOST) throw new Error('SMTP_HOST is required with SMTP_FROM');
  if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASS)) throw new Error('Both SMTP credentials are required');
  return config;
}

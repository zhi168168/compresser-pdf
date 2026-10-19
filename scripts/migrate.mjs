// Run explicitly with production credentials after reviewing the schema change.
// Never run migrations automatically from requests or preview builds.
if (process.env.DIRECT_DATABASE_URL) process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
await import('../server/migrate.js');

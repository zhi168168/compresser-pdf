export async function migrateBadges(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS site_badges (
    id integer PRIMARY KEY CHECK (id = 1), badges jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS site_badge_admin (id integer PRIMARY KEY CHECK (id = 1), password_hash text NOT NULL, version integer NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS site_badge_sessions (id text PRIMARY KEY, expires_at timestamptz NOT NULL, admin_version integer NOT NULL);
  CREATE TABLE IF NOT EXISTS site_badge_attempts (id text PRIMARY KEY, count integer NOT NULL, started_at timestamptz NOT NULL);`);
}

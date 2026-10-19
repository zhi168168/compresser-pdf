import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readConfig } from './config.js';
import { createAuth } from './auth.js';
import { createAccountHandler } from './handler.js';

export function createServer(config, auth, pool) {
  return http.createServer(createAccountHandler(config, auth, pool));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = readConfig();
  const { auth, pool } = createAuth(config);
  const server = createServer(config, auth, pool);
  server.requestTimeout = 20000; server.headersTimeout = 15000;
  server.listen(config.PORT, '0.0.0.0', () => console.log(`Account service listening on ${config.PORT}`));
  const shutdown = () => { server.close(() => pool.end().finally(() => process.exit(0))); setTimeout(() => process.exit(1), 10000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';

export default defineConfig({
  // Discover the worker-only dependency before the first upload; late dependency
  // optimization can otherwise reload a page during a cold-start browser test.
  optimizeDeps: { entries: ['index.html', 'en/index.html'], include: ['pdf-lib'] },
  worker: { format: 'es' },
  build: { rollupOptions: { input: { french: 'index.html', english: 'en/index.html' } } },
  plugins: [{
    name: 'optional-local-accounts',
    configureServer(server) { addLocalBadges(server); if (!process.env.ACCOUNT_DEV_PROXY) addDisabledAccounts(server); },
    configurePreviewServer(server) { addLocalBadges(server); if (!process.env.ACCOUNT_DEV_PROXY) addDisabledAccounts(server); },
  }],
  server: {
    // Local account development uses the same paths as the Vercel account proxy.
    proxy: process.env.ACCOUNT_DEV_PROXY ? { '/api/auth': { target: process.env.ACCOUNT_DEV_PROXY, changeOrigin: false } } : undefined,
  },
});

function addLocalBadges(server) {
  // Vite is not a Vercel Function runtime. Without this boundary, an extensionless
  // API request can resolve api/badges.js as browser JS and trigger dependency reloads.
  server.middlewares.use('/api/badges', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' || new URL(req.url, 'http://local').searchParams.get('admin') === '1') {
      res.statusCode = 503;
      return res.end(JSON.stringify({ message: '本地预览未启用徽章管理，请使用正式网站的管理入口。' }));
    }
    try {
      const badges = JSON.parse(await readFile(new URL('./public/badge-defaults.json', import.meta.url), 'utf8'));
      res.end(JSON.stringify({ badges: badges.filter(b => b.enabled), revision: 0 }));
    } catch { res.statusCode = 503; res.end(JSON.stringify({ message: 'Local badge configuration unavailable' })); }
  });
}

function addDisabledAccounts(server) {
  server.middlewares.use('/api/auth', (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/config' && req.method === 'GET') return res.end(JSON.stringify({ configured: false, google: false, emailRegistration: false, passwordReset: false }));
    res.statusCode = 503; res.end(JSON.stringify({ message: 'Account service is not configured. PDF compression is available without an account.' }));
  });
}

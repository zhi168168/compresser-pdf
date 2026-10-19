import { defineConfig } from 'vite';

export default defineConfig({
  worker: { format: 'es' },
  build: { rollupOptions: { input: { french: 'index.html', english: 'en/index.html' } } },
  plugins: [{
    name: 'optional-local-accounts',
    configureServer(server) { if (!process.env.ACCOUNT_DEV_PROXY) addDisabledAccounts(server); },
    configurePreviewServer(server) { if (!process.env.ACCOUNT_DEV_PROXY) addDisabledAccounts(server); },
  }],
  server: {
    // Local account development uses the same paths as the Vercel account proxy.
    proxy: process.env.ACCOUNT_DEV_PROXY ? { '/api/auth': { target: process.env.ACCOUNT_DEV_PROXY, changeOrigin: false } } : undefined,
  },
});

function addDisabledAccounts(server) {
  server.middlewares.use('/api/auth', (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/config' && req.method === 'GET') return res.end(JSON.stringify({ configured: false, google: false, emailRegistration: false, passwordReset: false }));
    res.statusCode = 503; res.end(JSON.stringify({ message: 'Account service is not configured. PDF compression is available without an account.' }));
  });
}

import handler from '../server/vercel.js';

// An explicit rewrite supports nested Better Auth paths on static Vite deployments.
export default function account(req, res) {
  const url = new URL(req.url, 'http://internal');
  const path = req.query?.__authPath ?? url.searchParams.get('__authPath');
  if (typeof path !== 'string' || !path) {
    res.statusCode = 404;
    return res.end();
  }
  url.searchParams.delete('__authPath');
  req.url = `/api/auth/${path}${url.search}`;
  return handler(req, res);
}

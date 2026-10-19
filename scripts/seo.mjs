import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

// Run after Vite. A domain is deliberately never guessed from preview hostnames.
const root = resolve(process.env.SEO_DIST_DIR || 'dist');
const configured = process.env.SITE_URL?.trim();
let origin;
if (configured) {
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL must be your HTTPS production origin, e.g. https://your-domain.com');
  }
  origin = url.origin;
}
const production = Boolean(origin) && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
async function findHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? findHtml(resolve(dir, entry.name)) : entry.name.endsWith('.html') ? [resolve(dir, entry.name)] : []));
  return nested.flat();
}
const pages = await findHtml(root);
const pagePaths = new Set(pages.map(file => '/' + relative(root, file).split(sep).join('/').replace(/index\.html$/, '')));
const urls = [];
for (const file of pages) {
  let html = await readFile(file, 'utf8');
  const path = '/' + relative(root, file).split(sep).join('/').replace(/index\.html$/, '');
  const language = path.startsWith('/en/') ? 'en' : 'fr';
  const frenchPath = language === 'en' ? path.slice(3) : path;
  const englishPath = '/en' + frenchPath;
  const alternatePaths = { fr: frenchPath, en: englishPath, 'x-default': frenchPath };
  for (const alternate of Object.values(alternatePaths)) {
    if (!pagePaths.has(alternate)) throw new Error(`SEO validation failed: ${path} is missing its translation ${alternate}.`);
  }
  const canonical = origin ? new URL(path, origin).href : undefined;
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  const description = html.match(/<meta\s+name=["']description["']\s+content=(["'])([\s\S]*?)\1/i)?.[2];
  if (!title || !description || !new RegExp(`<html\\b[^>]*\\blang=["']${language}["']`, 'i').test(html) || (html.match(/<h1\b/gi) || []).length !== 1) {
    throw new Error(`SEO validation failed: ${path} needs ${language} language, unique H1, title and description.`);
  }
  html = html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->\s*/g, '')
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>\s*/gi, '')
    .replace(/<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhreflang=)[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*(?:name=["'](?:robots|googlebot|twitter:[^"']+)["']|property=["']og:[^"']+["']))[^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
  const meta = [
    '<!-- seo:start -->',
    `<meta name="robots" content="${production ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="compresser pdf">',
    `<meta property="og:locale" content="${language === 'fr' ? 'fr_FR' : 'en_US'}">`,
    `<meta property="og:locale:alternate" content="${language === 'fr' ? 'en_US' : 'fr_FR'}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(description)}">`,
  ];
  if (production) {
    meta.push(`<link rel="canonical" href="${escape(canonical)}">`, `<meta property="og:url" content="${escape(canonical)}">`);
    for (const [lang, alternate] of Object.entries(alternatePaths)) meta.push(`<link rel="alternate" hreflang="${lang}" href="${escape(new URL(alternate, origin).href)}">`);
    const graph = frenchPath === '/' ? [
      { '@type': 'WebSite', '@id': origin + '/#website', name: 'compresser pdf', url: origin + '/', inLanguage: ['fr', 'en'] },
      { '@type': 'WebApplication', '@id': canonical + '#app', name: 'compresser pdf', url: canonical, inLanguage: language, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any modern web browser', browserRequirements: 'Requires JavaScript and Web Workers; image compression requires OffscreenCanvas', description, isAccessibleForFree: true },
    ] : [{ '@type': 'WebPage', name: title, description, url: canonical, inLanguage: language, isPartOf: { '@id': origin + '/#website' } }];
    meta.push(`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>`);
    urls.push({ canonical, alternatePaths });
  }
  meta.push('<!-- seo:end -->');
  html = html.replace(/<\/head>/i, meta.join('\n') + '\n</head>');
  await writeFile(file, html);
}
await writeFile(resolve(root, 'robots.txt'), production ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
if (production) {
  await writeFile(resolve(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.map(({ canonical, alternatePaths }) => `  <url><loc>${escape(canonical)}</loc>${Object.entries(alternatePaths).map(([lang, path]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escape(new URL(path, origin).href)}"/>`).join('')}</url>`).join('\n')}\n</urlset>\n`);
} else {
  await unlink(resolve(root, 'sitemap.xml')).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
console.log(`SEO: validated ${pages.length} static pages; ${production ? `indexable for ${origin}` : 'indexing disabled (set SITE_URL on a production build)'}.`);

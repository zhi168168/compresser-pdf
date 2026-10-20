import test from 'node:test';
import assert from 'node:assert/strict';
import { access, cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(project, 'dist');
const origin = 'https://seo-audit.invalid';
const expected = ['about.html', 'contact.html', 'en/about.html', 'en/contact.html', 'en/guides/compress-pdf-without-losing-quality.html', 'en/index.html', 'en/privacy.html', 'en/terms.html', 'guides/compress-pdf-without-losing-quality.html', 'index.html', 'privacy.html', 'terms.html'];
const urlPath = path => '/' + path.replace(/index\.html$/, '');
const languageOf = path => path.startsWith('en/') ? 'en' : 'fr';
function alternatesOf(html) {
  return [...html.matchAll(/<link\b[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"[^>]*>/gi)].map(match => [match[1], match[2]]);
}
async function htmlFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = await Promise.all(entries.map(entry => entry.isDirectory()
    ? htmlFiles(join(dir, entry.name), prefix + entry.name + '/')
    : entry.name.endsWith('.html') ? [prefix + entry.name] : []));
  return result.flat().sort();
}
async function builtPages(root = dist) {
  const paths = await htmlFiles(root);
  return Promise.all(paths.map(async path => ({ path, html: await readFile(join(root, path), 'utf8') })));
}
function canonicalOf(html) {
  return [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/gi)].map(match => match[1]);
}
function structuredData(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1]));
}

test('twelve built pages have unique metadata, one H1, French/English language and parseable JSON-LD', async () => {
  const pages = await builtPages();
  assert.deepEqual(pages.map(page => page.path), expected, 'Run npm run build before this test.');
  const titles = new Set();
  const descriptions = new Set();
  for (const { path, html } of pages) {
    assert.match(html, new RegExp(`<html\\b[^>]*lang="${languageOf(path)}"`, 'i'), path);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, path);
    assert.match(html, /<meta\s+name="viewport"/i, path);
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
    assert.ok(title && description, path);
    assert.ok(!titles.has(title), `${path}: duplicate title`);
    assert.ok(!descriptions.has(description), `${path}: duplicate description`);
    titles.add(title); descriptions.add(description);
    assert.ok(canonicalOf(html).length <= 1, `${path}: duplicate canonical`);
    assert.equal((html.match(/name="robots"/g) || []).length, 1, path);
    for (const schema of structuredData(html)) {
      assert.equal(schema['@context'], 'https://schema.org');
      assert.ok(schema['@graph'].length > 0);
    }
  }
});

test('relative internal links and asset references resolve to real files and fragments', async () => {
  for (const { path, html } of await builtPages()) {
    const base = new URL(path === 'index.html' ? '/' : '/' + path, origin);
    for (const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']*)["']/gi)) {
      const raw = match[1].replaceAll('&amp;', '&');
      const target = new URL(raw, base);
      if (target.origin !== origin) continue;
      let pathname = decodeURIComponent(target.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(dist, '.' + pathname);
      assert.ok(file.startsWith(dist + sep), `${path}: path outside dist: ${raw}`);
      await assert.doesNotReject(access(file), `${path}: missing link or asset ${raw}`);
      if (target.hash && file.endsWith('.html')) {
        const linkedHtml = await readFile(file, 'utf8');
        const id = decodeURIComponent(target.hash.slice(1));
        const ids = [...linkedHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(item => item[1]);
        assert.ok(ids.includes(id), `${path}: missing fragment ${raw}`);
      }
    }
  }
});

test('SEO postbuild handles production, preview and missing domain in an isolated temporary copy', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'compresser-pdf-seo-'));
  try {
    await cp(dist, fixture, { recursive: true });
    const run = env => execFileSync(process.execPath, [join(project, 'scripts/seo.mjs')], {
      cwd: project,
      env: { ...process.env, SEO_DIST_DIR: fixture, SITE_URL: '', VERCEL_ENV: '', ...env },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    run({ SITE_URL: origin, VERCEL_ENV: 'production' });
    // A second pass must replace rather than duplicate metadata.
    run({ SITE_URL: origin, VERCEL_ENV: 'production' });
    for (const { path, html } of await builtPages(fixture)) {
      const expectedUrl = origin + urlPath(path);
      const frenchPath = languageOf(path) === 'en' ? urlPath(path).slice(3) : urlPath(path);
      assert.deepEqual(canonicalOf(html), [expectedUrl]);
      assert.deepEqual(alternatesOf(html), [['fr', origin + frenchPath], ['en', origin + '/en' + frenchPath], ['x-default', origin + frenchPath]], path);
      assert.match(html, new RegExp(`property="og:locale" content="${languageOf(path) === 'fr' ? 'fr_FR' : 'en_US'}"`));
      assert.match(html, new RegExp(`property="og:locale:alternate" content="${languageOf(path) === 'fr' ? 'en_US' : 'fr_FR'}"`));
      assert.match(html, /name="robots" content="index, follow, max-image-preview:large"/);
      assert.match(html, /property="og:url"/);
      assert.equal(structuredData(html).length, 1);
      const graph = structuredData(html)[0]['@graph'];
      const page = graph.find(item => ['WebPage', 'Article', 'AboutPage', 'ContactPage'].includes(item['@type']));
      assert.ok(page, path);
      assert.equal(page.author.name, 'Alan', path);
      assert.equal(page.dateModified, '2026-10-20', path);
      assert.match(html, /<time datetime="2026-10-20">/, path);
      assert.equal((html.match(/name="author"/g) || []).length, 1, path);
      assert.doesNotMatch(html, /zhihaosong168@gmail\.com/, path);
      for (const slug of ['about', 'contact', 'privacy', 'terms']) {
        const base = languageOf(path) === 'en' ? '/en/' : '/';
        assert.ok(html.includes(`href="${base}${slug}.html"`), `${path}: missing ${slug} link`);
      }
      if (frenchPath.startsWith('/guides/')) {
        assert.equal(page['@type'], 'Article');
        assert.equal(page.citation.length, 2);
        for (const citation of page.citation) assert.ok(html.includes(`href="${citation}"`));
        assert.match(html, /<table>/);
        assert.ok(!page.datePublished, 'Do not invent an original publication date');
      }
      assert.ok(graph.every(item => item.url?.startsWith(origin)));
      for (const item of graph) assert.deepEqual(item.inLanguage, item['@type'] === 'WebSite' ? ['fr', 'en'] : languageOf(path));
      if (frenchPath === '/') {
        const app = graph.find(item => item['@type'] === 'WebApplication');
        assert.equal(app.url, expectedUrl);
        assert.equal(app['@id'], expectedUrl + '#app');
      }
    }
    const sitemap = await readFile(join(fixture, 'sitemap.xml'), 'utf8');
    assert.equal((sitemap.match(/<loc>/g) || []).length, 12);
    assert.equal((sitemap.match(/<xhtml:link /g) || []).length, 36);
    assert.equal((sitemap.match(/<lastmod>2026-10-20<\/lastmod>/g) || []).length, 12);
    for (const path of expected) assert.ok(sitemap.includes(origin + urlPath(path)));
    assert.equal(await readFile(join(fixture, 'robots.txt'), 'utf8'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
    for (const env of [{ SITE_URL: origin, VERCEL_ENV: 'preview' }, { SITE_URL: '', VERCEL_ENV: 'production' }]) {
      run(env);
      for (const { html } of await builtPages(fixture)) {
        assert.match(html, /name="robots" content="noindex, nofollow"/);
        assert.deepEqual(canonicalOf(html), []);
        assert.deepEqual(alternatesOf(html), []);
        assert.doesNotMatch(html, /property="og:url"/);
        assert.equal(structuredData(html).length, 0);
      }
      assert.equal(await readFile(join(fixture, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
      await assert.rejects(access(join(fixture, 'sitemap.xml')), { code: 'ENOENT' });
    }
    assert.throws(() => run({ SITE_URL: 'http://unsafe.invalid', VERCEL_ENV: 'production' }), /HTTPS production origin/);
    const frenchFile = join(fixture, 'index.html');
    await writeFile(frenchFile, (await readFile(frenchFile, 'utf8')).replace('lang="fr"', 'lang="en"'));
    assert.throws(() => run({ SITE_URL: origin, VERCEL_ENV: 'production' }), /needs fr language/);
    await writeFile(frenchFile, (await readFile(frenchFile, 'utf8')).replace('lang="en"', 'lang="fr"'));
    const englishFile = join(fixture, 'en/index.html');
    await writeFile(englishFile, (await readFile(englishFile, 'utf8')).replace('lang="en"', 'lang="fr"'));
    assert.throws(() => run({ SITE_URL: origin, VERCEL_ENV: 'production' }), /needs en language/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

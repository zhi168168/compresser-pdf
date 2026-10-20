(() => {
  const root = document.querySelector('[data-footer-badges]');
  if (!root) return;
  let revision = null, pending = false;
  async function refresh() {
    if (pending) return;
    pending = true;
    try {
      const response = await fetch('/api/badges', { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.badges) || data.revision === revision) return;
      const nodes = data.badges.map(badge => {
        const a = document.createElement('a');
        const href = new URL(badge.href);
        if (href.protocol !== 'https:') throw new Error('Invalid badge link');
        if (!/^https:\/\//.test(badge.src) && !/^data:image\/(png|jpeg|webp);base64,/.test(badge.src)) throw new Error('Invalid badge image');
        a.className = 'directory-badge'; a.href = href.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        if (badge.title) a.title = badge.title;
        const img = document.createElement('img');
        img.src = badge.src; img.alt = badge.alt; img.width = badge.width; img.height = badge.height;
        img.loading = 'lazy'; img.decoding = 'async';
        a.append(img); return a;
      });
      root.replaceChildren(...nodes); revision = data.revision;
    } catch { /* Keep the last working footer during temporary service failures. */ }
    finally { pending = false; }
  }
  refresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
})();

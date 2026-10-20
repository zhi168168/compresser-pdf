const $ = id => document.getElementById(id);
let badges = [], revision = 0, dirty = false, busy = false;
const message = (text, error = false) => { $('message').textContent = text; $('message').classList.toggle('error', error); };
function changed() { dirty = true; $('dirty').textContent = '有未发布的修改'; }
function loginView() { $('editor').hidden = true; $('login-panel').hidden = false; }
async function api(body) {
  const response = await fetch('/api/badges?admin=1', { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) loginView();
    throw new Error(data.message || '操作失败，请稍后重试。');
  }
  return data;
}
function safeURL(value, image = false) {
  if (image && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length <= 140000) return value;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('图片和跳转链接必须是 HTTPS 地址。');
  return url.href;
}
function normalize(items) {
  if (!Array.isArray(items) || items.length > 50) throw new Error('最多添加 50 个徽章。');
  return items.map(b => {
    const width = Number(b.width), height = Number(b.height);
    if (!Number.isInteger(width) || width < 1 || width > 1000 || !Number.isInteger(height) || height < 1 || height > 400) throw new Error('宽度须为 1–1000，高度须为 1–400。');
    const alt = String(b.alt || '').trim(), title = String(b.title || '');
    if (!alt || alt.length > 200 || title.length > 200) throw new Error('请填写徽章名称（最多 200 字）。');
    return { id: String(b.id || crypto.randomUUID()), href: safeURL(b.href), src: safeURL(b.src, true), alt, title, width, height, enabled: b.enabled !== false };
  });
}
function button(text, action) { const node = document.createElement('button'); node.type = 'button'; node.className = 'secondary'; node.textContent = text; node.addEventListener('click', action); return node; }
function render() {
  $('count').textContent = `${badges.length} 个徽章 · ${badges.filter(b => b.enabled).length} 个显示`;
  $('empty').hidden = badges.length > 0;
  $('list').replaceChildren();
  badges.forEach((badge, index) => {
    const card = document.createElement('article'); card.className = 'badge-card';
    const top = document.createElement('div'); top.className = 'badge-top';
    const title = document.createElement('strong'); title.textContent = `${index + 1}. ${badge.alt}`;
    const toggle = document.createElement('label'); toggle.className = 'toggle';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = badge.enabled;
    checkbox.addEventListener('change', () => { badge.enabled = checkbox.checked; changed(); $('count').textContent = `${badges.length} 个徽章 · ${badges.filter(b => b.enabled).length} 个显示`; });
    toggle.append(checkbox, document.createTextNode('在页脚显示')); top.append(title, toggle);
    const preview = document.createElement('div'); preview.className = 'preview';
    const link = document.createElement('a'); link.target = '_blank'; link.rel = 'noopener noreferrer';
    const img = document.createElement('img'); const status = document.createElement('span'); status.className = 'image-status';
    img.onload = () => { status.textContent = '图片加载正常'; status.classList.remove('failed'); };
    img.onerror = () => { status.textContent = '图片无法加载。请检查源地址，或上传获准使用的 PNG / JPG / WebP 图片。'; status.classList.add('failed'); };
    link.append(img); preview.append(link, status);
    function updatePreview() {
      try {
        const src = safeURL(badge.src, true), href = safeURL(badge.href);
        img.alt = badge.alt; img.width = Number(badge.width) || 175; img.height = Number(badge.height) || 55; link.href = href; link.title = badge.title;
        if (img.getAttribute('src') !== src) { status.textContent = '正在检查图片…'; status.classList.remove('failed'); img.src = src; }
      } catch { status.textContent = '请填写有效的 HTTPS 图片和链接地址。'; status.classList.add('failed'); link.removeAttribute('href'); img.removeAttribute('src'); }
    }
    const fields = document.createElement('div'); fields.className = 'fields';
    for (const [key, labelText, type] of [['alt', '徽章名称 / 替代文字', 'text'], ['title', '鼠标悬停提示（可选）', 'text'], ['href', '点击后的跳转地址', 'url'], ['src', '图片地址（HTTPS）', 'text'], ['width', '宽度（像素）', 'number'], ['height', '高度（像素）', 'number']]) {
      const label = document.createElement('label'); label.textContent = labelText;
      const input = document.createElement('input'); input.type = type; input.value = badge[key];
      if (key === 'src' && badge.src.startsWith('data:')) { input.value = ''; input.placeholder = '已使用上传图片；填写新地址可替换'; }
      if (type === 'number') { input.min = '1'; input.max = key === 'width' ? '1000' : '400'; }
      input.addEventListener('input', () => { badge[key] = type === 'number' ? Number(input.value) : input.value; changed(); updatePreview(); if (key === 'alt') title.textContent = `${index + 1}. ${badge.alt}`; });
      label.append(input); fields.append(label);
    }
    const uploadLabel = document.createElement('label'); uploadLabel.className = 'image-file'; uploadLabel.textContent = '或上传图片（PNG / JPG / WebP，最大 100 KB）';
    const upload = document.createElement('input'); upload.type = 'file'; upload.accept = 'image/png,image/jpeg,image/webp';
    upload.addEventListener('change', async () => {
      const file = upload.files[0]; if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 100 * 1024) return message('请选择不超过 100 KB 的 PNG / JPG / WebP 图片。', true);
      try { badge.src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); changed(); render(); message('图片已加入草稿，请保存并发布。'); } catch { message('图片读取失败，请重试。', true); }
    });
    uploadLabel.append(upload);
    const actions = document.createElement('div'); actions.className = 'actions';
    const up = button('上移', () => { [badges[index - 1], badges[index]] = [badges[index], badges[index - 1]]; changed(); render(); }); up.disabled = index === 0;
    const down = button('下移', () => { [badges[index + 1], badges[index]] = [badges[index], badges[index + 1]]; changed(); render(); }); down.disabled = index === badges.length - 1;
    const remove = button('删除', () => { if (confirm(`从草稿中删除“${badge.alt}”？保存发布后生效。`)) { badges.splice(index, 1); changed(); render(); } });
    actions.append(up, down, remove); card.append(top, preview, fields, uploadLabel, actions); $('list').append(card); updatePreview();
  });
}
async function load() {
  const data = await api(); badges = normalize(data.badges); revision = data.revision;
  dirty = false; $('dirty').textContent = '已保存'; $('editor').hidden = false; $('login-panel').hidden = true; render();
}
$('login-form').addEventListener('submit', async e => {
  e.preventDefault(); const submit = e.submitter; submit.disabled = true;
  try { await api({ action: 'login', password: $('password').value }); $('password').value = ''; if (dirty) { $('editor').hidden = false; $('login-panel').hidden = true; message('已重新登录，未发布的修改仍然保留。'); } else { await load(); message('已进入管理。'); } } catch (error) { message(error.message, true); } finally { submit.disabled = false; }
});
$('parse').addEventListener('click', () => {
  try {
    const doc = new DOMParser().parseFromString($('snippet').value, 'text/html');
    const anchors = [...doc.querySelectorAll('a')].filter(a => a.querySelector('img'));
    if (!anchors.length) throw new Error('没有找到带图片的链接，请粘贴完整的 <a>…<img …>…</a> 代码。');
    const added = normalize(anchors.map(a => { const img = a.querySelector('img'); return { id: crypto.randomUUID(), href: a.getAttribute('href'), src: img.getAttribute('src'), alt: img.getAttribute('alt') || a.getAttribute('title') || 'Featured badge', title: a.getAttribute('title') || '', width: Number(img.getAttribute('width')) || 175, height: Number(img.getAttribute('height')) || 55, enabled: true }; }));
    for (const b of added) if (badges.some(old => old.href === b.href && old.src === b.src)) throw new Error(`“${b.alt}”已存在，请直接编辑原徽章。`);
    if (badges.length + added.length > 50) throw new Error('最多保存 50 个徽章。');
    badges.push(...added); $('snippet').value = ''; changed(); render(); message(`已添加 ${added.length} 个徽章到草稿。请检查预览后保存并发布。`);
  } catch (error) { message(error.message, true); }
});
$('save').addEventListener('click', async () => {
  if (busy) return;
  busy = true; $('save').disabled = true;
  try {
    const submitted = normalize(badges), serialized = JSON.stringify(badges);
    const data = await api({ action: 'save', badges: submitted, revision }); revision = data.revision;
    if (JSON.stringify(badges) === serialized) { dirty = false; $('dirty').textContent = '已保存'; }
    message('保存成功。所有页面通常一分钟内更新；可点击上方“查看网站”检查。');
  } catch (error) { message(error.message, true); } finally { busy = false; $('save').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  if (dirty && !confirm('还有未发布的修改，确定退出并放弃草稿？')) return;
  try { await api({ action: 'logout' }); badges = []; $('list').replaceChildren(); dirty = false; loginView(); message('已退出管理。'); } catch (error) { message(error.message, true); }
});
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, badges }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `footer-badges-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); message('配置已导出（包括尚未发布的草稿）。');
});
$('import').addEventListener('change', async () => {
  const file = $('import').files[0]; if (!file) return;
  try {
    if (file.size > 768 * 1024) throw new Error('配置文件过大。');
    const data = JSON.parse(await file.text()); const imported = normalize(data.badges);
    if (!confirm('用导入的配置替换当前草稿？保存并发布后才会更改线上徽章。')) return;
    badges = imported; changed(); render(); message('配置已导入草稿，请检查并保存。');
  } catch (error) { message(error.message, true); } finally { $('import').value = ''; }
});
$('password-form').addEventListener('submit', async e => {
  e.preventDefault();
  if ($('new-password').value !== $('confirm-password').value) return message('两次新密码不一致。', true);
  if (dirty && !confirm('修改密码将退出登录；未发布的草稿会保留在此页面。是否继续？')) return;
  const submit = e.submitter; submit.disabled = true;
  try { await api({ action: 'password', currentPassword: $('current-password').value, password: $('new-password').value }); $('password-form').reset(); loginView(); message('密码已修改，请用新密码登录。'); } catch (error) { message(error.message, true); } finally { submit.disabled = false; }
});
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
load().catch(error => { loginView(); if (!error.message.includes('请先输入')) message(error.message, true); });

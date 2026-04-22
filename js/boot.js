async function loadIncludes() {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
  const nodes = Array.from(document.querySelectorAll('[data-include]'));
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const cache = isLocal ? 'no-cache' : 'force-cache';
  await Promise.all(nodes.map(async (node) => {
    const url = node.getAttribute('data-include');
    if (!url) return;
    try {
      const res = await fetch(url, { cache });
      if (!res.ok) throw new Error(`${url} yüklenemedi (${res.status})`);
      node.innerHTML = await res.text();
    } catch (err) {
      node.innerHTML = `<div style="padding:12px;border:1px solid #f9731680;border-radius:10px;color:#f97316;font:600 12px/1.4 Inter,sans-serif;">⚠️ Bileşen yüklenemedi: ${escapeHtml(url)}</div>`;
      console.error('[include-load-error]', url, err);
    }
  }));
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadIncludes();
    const activeKey = (document.body && document.body.dataset && document.body.dataset.page) ? document.body.dataset.page : '';
    if (activeKey) {
      document.querySelectorAll('.bottom-nav .bnav-item').forEach((el) => {
        const href = el.getAttribute && el.getAttribute('href');
        if (!href) return;
        const key = href.replace('.html', '');
        if (key === activeKey) el.classList.add('active');
      });
    }
    if (typeof window.initApp === 'function') window.initApp();
  } catch (e) {
    const msg = document.createElement('pre');
    msg.style.whiteSpace = 'pre-wrap';
    msg.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace';
    msg.style.padding = '16px';
    msg.style.margin = '16px';
    msg.style.borderRadius = '12px';
    msg.style.background = '#111';
    msg.style.color = '#fff';
    msg.textContent = `Uygulama başlatılamadı.\n\n${String(e && e.message ? e.message : e)}`;
    document.body.appendChild(msg);
  }
});

/**
 * 设置面板域内原型 · 演示壳（prototype.app.js）
 * markup 单源（ADR-0104）：面板骨架/导航/行/组卡/控件 HTML 全部出自 render.ts
 * （经 prototype-render.js 挂 window.BZR_settings_panel）——本壳只留演示层：
 * 演示数据/localStorage 值层、演示绑定、自绘弹层（文件夹/模型选择器）、toast、
 * 主题类同步、评审钩子与自检。插件版对应行为层 = ui.ts / renderer.ts。
 * 桌面面板 + 移动手机框两实例共享同一渲染内核；壳层差异见 prototype-first.md。
 */
(function () {
  'use strict';
  window.onerror = function (m, src, line) { try { document.title = 'ERR ' + m + ' @' + line; } catch (e) {} };

  const R = window.BZR_settings_panel;
  const DEMO = window.SP_DEMO;
  const LS = 'bz-sp-proto-delta';
  const LS_CAT = 'bz-sp-proto-smartcat';
  const LS_THEME = 'bz-sp-proto-theme';

  let delta = JSON.parse(localStorage.getItem(LS) || '{}');
  let catDelta = JSON.parse(localStorage.getItem(LS_CAT) || '{}');
  const base = DEMO.VALUES;
  const catBase = DEMO.SMARTCAT;
  const val = (k) => (k in delta ? delta[k] : base[k]);
  const catVal = (k) => (k in catDelta ? catDelta[k] : catBase[k]);
  function persist() {
    localStorage.setItem(LS, JSON.stringify(delta));
    localStorage.setItem(LS_CAT, JSON.stringify(catDelta));
  }

  /* ---------- 图标兑现（壳层差异表：原型用内联 lucide 兑现 <i data-lucide> 占位） ---------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    'check-square': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    'notebook-pen': '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.4 5.6a1 1 0 1 0-3-3l-5 5a2 2 0 0 0-.5.9l-.8 2.9a.5.5 0 0 0 .6.6l2.9-.8a2 2 0 0 0 .9-.5z"/>',
    images: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01Z"/>',
    clapperboard: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1-.3 2.1.3 2.4 1.4Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    'repeat-2': '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
    timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    cat: '<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.06 9.24.16 1 .3 1.57.37 2.35.38 4.5-3.35 6.7-8.73 6.7-5.38 0-9.11-2.2-8.73-6.7.07-.78.21-1.35.37-2.35.36-2.25-1.46-8.66-.06-9.24 1.39-.58 4.64.26 6.42 2.26.65-.17 1.33-.26 2-.26Z"/><path d="M9 13v.01"/><path d="M15 13v.01"/>',
    'list-video': '<path d="M12 7H3"/><path d="M12 12H3"/><path d="M12 17H3"/><path d="m17 3 4 2.5L17 8Z"/><rect x="3" y="19" width="12" height="3" rx="1"/>',
    'folder-open': '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    'pencil-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    tags: '<path d="m15 5 6 6-9 9-6-6V5h9Z"/><circle cx="11" cy="11" r="1"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    'key-round': '<path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3l2.6-2.6a8 8 0 1 0-3.2-3.2Z"/><circle cx="16.5" cy="7.5" r=".5"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    'sliders-horizontal': '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    'graduation-cap': '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.64 1.64 0 0 1 1.7-1.7h2c3 0 5.6-2.5 5.6-5.6C22 6 17.5 2 12 2z"/>',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    'settings-2': '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };
  function mountIcons(root) {
    root.querySelectorAll('i[data-lucide]').forEach((el) => {
      const name = el.getAttribute('data-lucide') || '';
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('class', el.className || 'bz-ic');
      s.setAttribute('viewBox', '0 0 24 24');
      s.setAttribute('fill', 'none');
      s.setAttribute('stroke', 'currentColor');
      s.setAttribute('stroke-width', '1.8');
      s.setAttribute('stroke-linecap', 'round');
      s.setAttribute('stroke-linejoin', 'round');
      s.innerHTML = ICONS[name] || '';
      el.replaceWith(s);
    });
  }
  function icon(name, cls) {
    const t = document.createElement('div');
    t.innerHTML = R.iconSpan(name, cls && cls !== 'bz-ic' ? cls.replace(/^bz-ic\s*/, '') : '');
    mountIcons(t);
    return t.firstElementChild;
  }

  /* ---------- 值通道（演示假值 + localStorage delta） ---------- */
  function rowRead(r) {
    const k = r.k || '';
    if (k === '__fn:aiModel') {
      const p = val('aiProvider');
      return p === 'custom' ? String(val('aiCustomModel') ?? '') : String((val('aiModelOverrides') || {})[p] ?? '');
    }
    if (k === '__fn:aiContext') return Number((val('aiContextOverrides') || {})[val('aiProvider')] ?? 0) || 0;
    if (k === '__fn:aiMaxTokens') return Number((val('aiMaxTokensOverrides') || {})[val('aiProvider')] ?? 0) || 0;
    if (k === 'securityMode') return Boolean(val('securityMode') || val('encryptSecurityMode'));
    if (k.startsWith('__smartcat:')) return catVal(k.slice(11));
    if (r.t === 'toggle') return val(k) === true;
    return val(k);
  }
  function rowWrite(r, v) {
    const k = r.k || '';
    const mapWrite = (mapKey) => {
      const m = { ...(val(mapKey) || {}) };
      const p = val('aiProvider');
      if (v === '' || v === 0) delete m[p]; else m[p] = v;
      delta[mapKey] = m;
    };
    if (k === '__fn:aiModel') {
      const p = val('aiProvider');
      if (p === 'custom') delta.aiCustomModel = v; else mapWrite('aiModelOverrides');
    } else if (k === '__fn:aiContext') mapWrite('aiContextOverrides');
    else if (k === '__fn:aiMaxTokens') mapWrite('aiMaxTokensOverrides');
    else if (k === 'securityMode') { delta.securityMode = v; delta.encryptSecurityMode = v; }
    else if (k.startsWith('__smartcat:')) catDelta[k.slice(11)] = v;
    else delta[k] = v;
    persist();
  }
  function pathList(r) {
    const raw = rowRead(r);
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  function pathWriteList(r, list) {
    const raw = base[r.k];
    rowWrite(r, Array.isArray(raw) ? list : list.join(','));
  }
  function evalVis(vis) {
    if (!vis) return true;
    if (vis.eq) return val(vis.eq[0]) === vis.eq[1];
    if (vis.ne) return val(vis.ne[0]) !== vis.ne[1];
    if (vis.and) return vis.and.every(evalVis);
    return true;
  }
  function visibleRowsOf(domain) {
    const out = [];
    for (const g of domain.groups) {
      if (g.m) continue;
      const pk = (g.rows.find((r) => r.t === 'toggle' && r.k && !r.k.startsWith('__')) || {}).k || null;
      for (const r of g.rows) {
        if (r.t === 'button' || r.m) continue;
        if (!evalVis(r.vis)) continue;
        if (r.child && pk && val(pk) !== true) continue;
        out.push(r);
      }
    }
    return out;
  }

  /* ---------- 主题类同步：移除全部 bz-sp-tf-* 后挂当前主题（演示件） ---------- */
  const THEME_KEYS = ['linen', 'celadon', 'dark', 'mono'];
  function syncThemeClass(rootEl, v) {
    const panel = rootEl.closest ? (rootEl.closest('.bz-sp-desk') || rootEl.closest('.bz-sp-mobile') || rootEl) : rootEl;
    THEME_KEYS.forEach((k) => panel.classList.remove('bz-sp-tf-' + k));
    if (v && THEME_KEYS.indexOf(v) >= 0) panel.classList.add('bz-sp-tf-' + v);
  }

  /* ---------- 弹层：文件夹选择器 / 模型选择器 / toast（原型演示专属，插件版为 dir-picker.ts 与 custom 行内嵌按钮） ---------- */
  function toast(root, msg) {
    let t = root.querySelector('.bz-sp-demo-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'bz-sp-demo-toast';
      root.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t.__tm);
    t.__tm = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function openDirPicker(host, row, onDone) {
    const multi = row.mode === 'multi';
    const dirs = DEMO.DIRS;
    const selected = new Set(multi ? pathList(row) : [String(rowRead(row) || '')].filter(Boolean));
    let q = '';
    const mask = document.createElement('div');
    mask.className = 'bz-sp-picker-mask';
    const dlg = document.createElement('div');
    dlg.className = 'bz-sp-picker';
    const head = document.createElement('div');
    head.className = 'bz-sp-picker-head';
    const b = document.createElement('b');
    b.textContent = (multi ? '添加文件夹 · ' : '选择文件夹 · ') + row.n;
    const search = document.createElement('div');
    search.className = 'bz-sp-picker-search';
    search.appendChild(icon('search'));
    const sinp = document.createElement('input');
    sinp.placeholder = '搜索目录…（命中项保留上级链）';
    search.appendChild(sinp);
    head.append(b, search);
    const crumb = document.createElement('div');
    crumb.className = 'bz-sp-picker-crumb';
    const list = document.createElement('div');
    list.className = 'bz-sp-picker-list';
    const foot = document.createElement('div');
    foot.className = 'bz-sp-picker-foot';
    const cancel = document.createElement('button');
    cancel.className = 'bz-sp-btn'; cancel.textContent = '取消';
    const ok = document.createElement('button');
    ok.className = 'bz-sp-btn bz-sp-btn--primary'; ok.textContent = multi ? '添加所选' : '选用';
    const close = (v) => { mask.remove(); resolve2(v); };
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', () => close(multi ? [...selected] : ([...selected][0] ?? null)));
    mask.addEventListener('click', (e) => { if (e.target === mask) close(null); });
    function renderCrumb() {
      crumb.innerHTML = '';
      const lab = document.createElement('span');
      lab.className = 'bz-sp-picker-lab';
      lab.textContent = multi ? '已选' : '将选用';
      crumb.appendChild(lab);
      const arr = [...selected].filter(Boolean);
      if (multi) {
        const v = document.createElement('span');
        v.textContent = arr.length ? arr.length + ' 个目录' : '尚未选择';
        crumb.appendChild(v);
      } else if (!arr.length) {
        const v = document.createElement('span');
        v.textContent = '未设置';
        crumb.appendChild(v);
      } else {
        arr[0].split('/').forEach((seg, i) => {
          if (i) {
            const sp = document.createElement('span');
            sp.className = 'bz-sp-picker-sep'; sp.textContent = '▸';
            crumb.appendChild(sp);
          }
          const sg = document.createElement('span');
          sg.textContent = seg;
          crumb.appendChild(sg);
        });
      }
    }
    function renderList() {
      const query = q.trim().toLowerCase();
      let items = dirs;
      if (query) {
        const keep = new Set();
        for (const d of dirs) {
          if (d.toLowerCase().includes(query)) {
            keep.add(d);
            const parts = d.split('/');
            for (let i = 1; i < parts.length; i++) keep.add(parts.slice(0, i).join('/'));
          }
        }
        items = dirs.filter((d) => keep.has(d));
      }
      items = items.slice().reverse(); // 平铺反转：深层在前、根级垫底
      list.innerHTML = '';
      for (const d of items) {
        const parts = d.split('/');
        const rowBtn = document.createElement('button');
        rowBtn.type = 'button';
        rowBtn.className = 'bz-sp-picker-row' + (selected.has(d) ? ' sel' : '');
        rowBtn.appendChild(icon('folder-open', 'bz-ic'));
        const nm = document.createElement('span');
        nm.textContent = parts[parts.length - 1];
        rowBtn.appendChild(nm);
        const anc = document.createElement('span');
        anc.className = 'anc';
        anc.textContent = parts.length > 1 ? parts.slice(0, -1).join(' / ') + ' /' : 'vault 根目录';
        rowBtn.appendChild(anc);
        rowBtn.addEventListener('click', () => {
          if (multi) {
            if (selected.has(d)) selected.delete(d); else selected.add(d);
            rowBtn.classList.toggle('sel', selected.has(d));
          } else {
            selected.clear(); selected.add(d);
            list.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel'));
            rowBtn.classList.add('sel');
          }
          renderCrumb();
        });
        if (!multi) rowBtn.addEventListener('dblclick', () => close(d));
        list.appendChild(rowBtn);
      }
    }
    sinp.addEventListener('input', () => { q = sinp.value; renderList(); });
    foot.append(cancel, ok);
    dlg.append(head, crumb, list, foot);
    mask.appendChild(dlg);
    host.appendChild(mask);
    let resolve2;
    const promise = new Promise((r2) => { resolve2 = r2; });
    renderCrumb(); renderList();
    return promise.then((res) => {
      if (res === null || res === undefined) return null;
      if (multi) {
        if (!res.length) return null;
        pathWriteList(row, [...new Set(pathList(row).concat(res))]);
      } else rowWrite(row, res);
      onDone && onDone();
      return res;
    });
  }

  const MODEL_MOCKS = {
    deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash'],
    openai: ['gpt-4o', 'gpt-4o-mini'], _default: ['chat-default', 'chat-lite'],
  };
  function pickModel(host, row, onDone) {
    const models = MODEL_MOCKS[val('aiProvider')] || MODEL_MOCKS._default;
    const cur = rowRead(row);
    const mask = document.createElement('div');
    mask.className = 'bz-sp-picker-mask';
    const dlg = document.createElement('div');
    dlg.className = 'bz-sp-picker';
    const head = document.createElement('div');
    head.className = 'bz-sp-picker-head';
    head.innerHTML = '<b>获取模型名</b>';
    const list = document.createElement('div');
    list.className = 'bz-sp-picker-list';
    for (const m of models) {
      const it = document.createElement('button');
      it.type = 'button';
      it.className = 'bz-sp-picker-row' + (m === cur ? ' sel' : '');
      const nm = document.createElement('span'); nm.textContent = m;
      it.appendChild(nm);
      it.addEventListener('click', () => {
        mask.remove();
        rowWrite(row, m);
        onDone && onDone();
      });
      list.appendChild(it);
    }
    dlg.append(head, list);
    mask.appendChild(dlg);
    host.appendChild(mask);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
  }

  /* ---------- 迷你皮肤预览（演示件：插件版由各域 prevClass 全局样式承载） ---------- */
  function renderMini(kind, prev) {
    const mini = document.createElement('div');
    mini.className = 'bz-sp-mini';
    mini.style.background = prev.bg;
    if (kind === 'todo') {
      const head = document.createElement('div');
      head.className = 'm-head' + (prev.head === 'stripe' ? ' m-stripe' : '');
      head.style.background = prev.head === 'stripe' ? prev.bg : prev.ink;
      if (prev.head === 'stripe') head.style.borderBottom = '2px solid ' + prev.ink;
      mini.appendChild(head);
      [[18, 16], [28, 24], [24, 32]].forEach(([w, top], i) => {
        const ln = document.createElement('div');
        ln.className = 'm-line';
        ln.style.cssText = 'top:' + top + 'px;width:' + w + 'px;background:' + prev.ink + ';opacity:' + (i === 2 ? 0.35 : 0.55);
        mini.appendChild(ln);
      });
      const chip = document.createElement('div');
      chip.className = 'm-chip';
      chip.style.background = prev.ac;
      mini.appendChild(chip);
    } else if (kind === 'shelf') {
      const ac = document.createElement('div');
      ac.className = 'm-ac'; ac.style.background = prev.ac;
      mini.appendChild(ac);
      (prev.books || []).forEach((c, i) => {
        const bk = document.createElement('div');
        bk.className = 'm-book';
        bk.style.cssText = 'left:' + (10 + i * 14) + 'px;height:' + [24, 32, 20][i] + 'px;background:' + c + ';border-top:2px solid ' + prev.ac;
        mini.appendChild(bk);
      });
    } else if (kind === 'layout') {
      // 布局缩略：head 横条 + 左导航块 + 内容块（形态随 mode 变化）
      const head = document.createElement('div');
      head.className = 'm-head';
      head.style.background = 'rgba(90,70,40,.28)';
      mini.appendChild(head);
      const mkBlock = (css) => {
        const b2 = document.createElement('div');
        b2.style.cssText = 'position:absolute;border-radius:2px;background:rgba(90,70,40,.22);' + css;
        mini.appendChild(b2);
      };
      if (prev.mode === 'system') {
        mkBlock('left:4px;top:14px;width:14px;bottom:4px;');
        mkBlock('left:21px;top:14px;right:4px;height:26px;');
      } else if (prev.mode === 'compact') {
        mkBlock('left:4px;top:14px;width:14px;bottom:4px;');
        mkBlock('left:21px;top:14px;width:26px;height:12px;');
        mkBlock('left:21px;top:28px;width:26px;height:12px;');
        mkBlock('left:50px;top:14px;width:10px;bottom:10px;');
      } else if (prev.mode === 'iconrail') {
        mkBlock('left:2px;top:2px;bottom:2px;width:8px;');
        mkBlock('left:14px;top:4px;width:16px;bottom:4px;');
        mkBlock('left:34px;top:4px;right:4px;bottom:4px;');
      } else if (prev.mode === 'outline') {
        mkBlock('left:4px;top:14px;right:24px;bottom:4px;');
        mkBlock('right:4px;top:14px;width:16px;height:20px;');
      }
    } else if (kind === 'skin') {
      // 主题套装预览：亮暗双块（自动亮暗，无需指定）
      const l = document.createElement('div');
      l.style.cssText = 'position:absolute;inset:0 50% 0 0;background:' + (prev.light || '#f6f2e9') + ';';
      const r2 = document.createElement('div');
      r2.style.cssText = 'position:absolute;inset:0 0 0 50%;background:' + (prev.dark || '#242429') + ';';
      const dot = document.createElement('div');
      dot.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:' + (prev.ac || 'var(--sp-accent)') + ';border:2px solid #fff;';
      mini.append(l, r2, dot);
    } else if (kind === 'themecard') {
      mini.style.background = prev.bg;
      const bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;left:5px;top:50%;transform:translateY(-50%);width:5px;height:26px;border-radius:3px;background:' + prev.ac + ';';
      mini.appendChild(bar);
    } else if (kind === 'cat') {
      const cat = document.createElement('div');
      cat.className = 'm-cat';
      const mk = (cls, bg) => {
        const e = document.createElement('div');
        e.className = cls;
        e.style.background = bg;
        return e;
      };
      ['ear l', 'ear r'].forEach((c) => {
        const e = mk(c, prev.fur);
        e.style.background = 'transparent';
        e.style.borderBottomColor = prev.fur;
        cat.appendChild(e);
      });
      cat.appendChild(mk('face', prev.fur));
      if (prev.patch) cat.appendChild(mk('patch', prev.patch));
      ['eye l', 'eye r'].forEach((c) => cat.appendChild(mk(c, 'rgba(20,15,8,.75)')));
      mini.appendChild(cat);
    }
    return mini;
  }

  /* ---------- 行渲染（markup 全部出自纯层 R.*；本壳只做演示值通道与事件绑定） ---------- */
  function rowEl(r, parentKey, host, refresh, redrawDomain) {
    const holder = document.createElement('div');

    // custom 行：原型演示 = 行头（name/desc）+ 自绘子行 mock（插件版 = 各域 new Setting() 渲染进插槽）
    if (r.t === 'custom' && r.custom) {
      holder.innerHTML = '<div class="bz-sp-set-row bz-sp-set-row--custom"></div>';
      const row0 = holder.firstElementChild;
      row0.dataset.key = r.k || r.n;
      const txt = document.createElement('div');
      txt.className = 'bz-sp-set-info';
      txt.innerHTML = '<div class="bz-sp-set-name"></div>' + (r.d ? '<div class="bz-sp-set-desc"></div>' : '');
      txt.querySelector('.bz-sp-set-name').textContent = r.n;
      if (r.d) txt.querySelector('.bz-sp-set-desc').textContent = r.d;
      row0.appendChild(txt);
      renderCustom(r, row0, host, redrawDomain);
      return row0;
    }

    const vm = { name: r.n || '', desc: r.d, note: r.note };
    const isCards = r.t === 'choiceCards';
    if (isCards) vm.isCards = true;

    // 控件 HTML（纯层工厂）
    if (r.t === 'toggle') vm.ctrlHtml = R.toggleHtml(rowRead(r) === true);
    else if (r.t === 'select') vm.ctrlHtml = R.selectTriggerHtml('');
    else if (r.t === 'text' || r.t === 'textarea' || r.t === 'number') {
      const init = rowRead(r);
      const v = r.t === 'number' ? String(Number(init) || 0) : String(init ?? '');
      vm.ctrlHtml = r.t === 'textarea'
        ? R.textareaHtml(v, r.ph)
        : R.textInputHtml({
            value: v, type: r.t === 'number' ? 'number' : 'text',
            num: !!r.num || r.t === 'number', placeholder: r.ph,
            min: r.min, max: r.max, step: r.step,
          });
    } else if (r.t === 'slider') vm.ctrlHtml = R.sliderHtml(r.min, r.max, r.step, Number(rowRead(r)) || 0);
    else if (r.t === 'button') vm.ctrlHtml = R.rowBtnHtml(r.btn || '打开', r.cta);
    else if (r.t === 'info') vm.ctrlHtml = R.badgeHtml(r.n);

    holder.innerHTML = R.rowHtml(vm);
    const row = holder.firstElementChild;
    row.dataset.key = r.k || r.n;
    if (!evalVis(r.vis)) row.style.display = 'none';
    if (r.child && parentKey && val(parentKey) !== true) row.style.display = 'none';
    const ctl = row.querySelector(isCards ? '.bz-sp-set-cards' : '.bz-sp-set-ctrl');

    if (r.t === 'toggle') {
      const sw = row.querySelector('.bz-sw');
      sw.addEventListener('click', () => {
        const v = !sw.classList.contains('on');
        sw.classList.toggle('on', v);
        sw.setAttribute('aria-checked', String(v));
        rowWrite(r, v);
        refresh();
      });
    } else if (r.t === 'select') {
      const sel = row.querySelector('.bz-select');
      const vspan = sel.querySelector('.bz-select-val');
      const labelOf = (v) => ((r.opts || []).find((o) => o.v === v) || {}).l || v;
      const curOf = () => String(rowRead(r) ?? '') || (r.opts[0] && r.opts[0].v) || '';
      vspan.textContent = labelOf(curOf());
      sel.addEventListener('click', () => {
        if (sel.querySelector('.bz-select-menu')) return;
        // 组卡 overflow:hidden 会裁剪伸出的菜单——展开期间放开并提层
        const group = sel.closest('.bz-sp-group');
        if (group) { group.style.overflow = 'visible'; group.style.zIndex = 10; }
        const closeMenu = () => {
          const m = sel.querySelector('.bz-select-menu');
          if (m) m.remove();
          if (group) { group.style.overflow = ''; group.style.zIndex = ''; }
          document.removeEventListener('click', h);
        };
        const curNow = curOf();
        const menu = document.createElement('div');
        menu.className = 'bz-select-menu';
        menu.innerHTML = (r.opts || []).map((o) => R.selectItemHtml(o.l, o.v === curNow)).join('');
        mountIcons(menu);
        const items = menu.querySelectorAll('.bz-select-item');
        (r.opts || []).forEach((o, i) => {
          items[i].addEventListener('click', (ev) => {
            ev.stopPropagation();
            closeMenu();
            vspan.textContent = labelOf(o.v);
            rowWrite(r, o.v);
            refresh();
            // 面板外观联动（通用域「面板外观」组）：风格/皮肤切换实时作用于面板根
            if (r.k === 'settingsPanelTheme' || r.k === 'settingsPanelSkin') {
              const panelRoot = root.closest('.bz-sp-desk') || root;
              panelRoot.classList.toggle('bz-sp-force-light', val('settingsPanelTheme') === 'light');
              panelRoot.classList.toggle('bz-sp-force-dark', val('settingsPanelTheme') === 'dark');
              panelRoot.classList.toggle('bz-sp-skin-paper', val('settingsPanelSkin') === 'paper');
              panelRoot.classList.toggle('bz-sp-skin-weave', val('settingsPanelSkin') === 'weave');
            }
          });
        });
        sel.appendChild(menu);
        const h = (ev) => {
          if (!sel.contains(ev.target)) closeMenu();
        };
        setTimeout(() => document.addEventListener('click', h));
      });
    } else if (r.t === 'text' || r.t === 'textarea' || r.t === 'number') {
      const isModel = r.k === '__fn:aiModel';
      const inp = row.querySelector(r.t === 'textarea' ? 'textarea' : 'input');
      const commit = () => {
        if (!inp.dataset.dirty) return;
        delete inp.dataset.dirty;
        if (r.t === 'number') {
          const raw = inp.value.trim();
          if (raw === '') return;
          let n = Number(raw);
          if (!Number.isFinite(n)) return;
          if (r.min !== undefined) n = Math.max(r.min, n);
          if (r.max !== undefined) n = Math.min(r.max, n);
          inp.value = String(n);
          rowWrite(r, n);
        } else rowWrite(r, inp.value);
        refresh();
      };
      let timer = null;
      inp.addEventListener('input', () => { inp.dataset.dirty = '1'; clearTimeout(timer); timer = setTimeout(commit, 600); });
      inp.addEventListener('blur', commit);
      if (r.t !== 'textarea') inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
      if (isModel) {
        // 原型演示：模型行内嵌「获取模型名」按钮（插件版 = custom 行内嵌按钮，⚙️ 同源）
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:6px;align-items:center';
        const btn = document.createElement('button');
        btn.className = 'bz-sp-btn'; btn.textContent = '获取模型名';
        btn.addEventListener('click', () => pickModel(host, r, redrawDomain));
        wrap.append(inp, btn);
        ctl.appendChild(wrap);
      }
    } else if (r.t === 'slider') {
      const inp = row.querySelector('input[type="range"]');
      const em = row.querySelector('.bz-sp-slider-val');
      inp.addEventListener('input', () => { em.textContent = inp.value; rowWrite(r, Number(inp.value)); });
    } else if (r.t === 'button') {
      row.querySelector('.bz-sp-btn').addEventListener('click', () => toast(host, '原型演示：' + r.btn));
    } else if (r.t === 'path') {
      const multi = r.mode === 'multi';
      const redraw = () => {
        const list = multi ? pathList(r) : [String(rowRead(r) || '')].filter(Boolean);
        const chips = list.length
          ? list.map((p) => ({ path: p, label: p, multi }))
          : [{ path: '', label: multi ? '未选择' : '未设置', muted: true }];
        ctl.innerHTML = R.pathChipsItemsHtml(chips) + R.pathAddBtnHtml(multi ? '添加…' : '选择…');
        ctl.querySelectorAll('.bz-sp-chip').forEach((c) => {
          const p = c.dataset.spPath;
          const x = c.querySelector('.x');
          if (x) x.addEventListener('click', () => { pathWriteList(r, pathList(r).filter((y) => y !== p)); redraw(); });
          else c.addEventListener('click', () => openDirPicker(host, r, redrawDomain));
        });
        ctl.querySelector('.bz-sp-path-btn').addEventListener('click', () => openDirPicker(host, r, redrawDomain));
      };
      redraw();
    } else if (isCards) {
      // 布局绑定的主题行（r.layoutKey）：只渲当前布局配套的单卡——主题不通用
      const opts = (r.opts || []).filter((o) => !o.layout || !r.layoutKey || o.layout === String(rowRead({ k: r.layoutKey }) ?? ''));
      const cur = String(rowRead(r) ?? '') || (opts[0] && opts[0].v) || '';
      const wrapHolder = document.createElement('div');
      wrapHolder.innerHTML = R.cardpickHtml(opts.map((o) => ({ value: o.v, label: o.l, on: o.v === cur })));
      const wrap = wrapHolder.firstElementChild;
      wrap.querySelectorAll('.bz-sp-cardpick-card').forEach((c) => {
        const o = opts.find((x) => x.v === c.dataset.spCard);
        c.querySelector('.bz-sp-mini').replaceWith(renderMini(r.kind, o.prev));
        c.addEventListener('click', () => {
          wrap.querySelectorAll('.is-on').forEach((x) => x.classList.remove('is-on'));
          c.classList.add('is-on');
          rowWrite(r, o.v);
          // 外观域联动（参考待办 todoSkin）：布局与主题一一对应——点布局自动切配套主题；点主题实时换肤
          if (r.k === 'settingsPanelLayout' || r.k === 'todoSkin') {
            const pairKey = r.k === 'settingsPanelLayout' ? 'settingsPanelSkin' : 'todoSkinTheme';
            rowWrite({ k: pairKey }, o.theme);
            if (r.k === 'settingsPanelLayout') syncThemeClass(host, o.theme);
            redrawDomain();
            toast(host, '已切换布局：' + o.l);
          } else if (r.k === 'settingsPanelSkin') {
            syncThemeClass(host, o.v);
          }
        });
      });
      ctl.appendChild(wrap);
      ctl.style.maxWidth = 'none';
    }

    return row;
  }

  /* custom 三类 mock（数据源 / 排除名单 / 局域网 IP） */
  function renderCustom(r, row, host, redrawDomain) {
    const sub = (label, build) => {
      const sr = document.createElement('div');
      sr.className = 'bz-sp-sub-row';
      const nm = document.createElement('span');
      nm.className = 'bz-sp-set-name';
      nm.textContent = label;
      const ctl = document.createElement('div');
      ctl.className = 'bz-sp-set-ctrl';
      build(ctl);
      sr.append(nm, ctl);
      return sr;
    };
    if (r.custom === 'newsSources') {
      const mkT = (label, key) => sub(label, (ctl) => {
        const holder = document.createElement('div');
        holder.innerHTML = R.toggleHtml(rowRead({ t: 'toggle', k: key }) === true);
        const sw = holder.firstElementChild;
        sw.addEventListener('click', () => {
          const v = !sw.classList.contains('on');
          sw.classList.toggle('on', v);
          rowWrite({ k: key }, v);
        });
        ctl.appendChild(sw);
      });
      row.appendChild(mkT('知乎日报', '__mock:newsZhihu'));
      row.appendChild(mkT('果壳科学人', '__mock:newsGuokr'));
      row.appendChild(mkT('B站 UP 主投稿', '__mock:newsBili'));
      row.appendChild(sub('UP 主名单', (ctl) => {
        const b2 = document.createElement('button');
        b2.className = 'bz-sp-btn'; b2.textContent = '管理（3 人）';
        b2.addEventListener('click', () => toast(host, '原型演示：打开 UP 主名单管理'));
        ctl.appendChild(b2);
      }));
      row.appendChild(sub('B站抓取条数', (ctl) => {
        const rr = { t: 'number', n: 'B站抓取条数', k: '__mock:newsBiliCount' };
        const inp = document.createElement('input');
        inp.className = 'bz-input'; inp.type = 'number'; inp.min = '1'; inp.max = '50';
        inp.value = String(Number(rowRead(rr)) || 10);
        inp.addEventListener('change', () => {
          const n = Math.max(1, Math.min(50, Number(inp.value) || 10));
          inp.value = String(n); rowWrite(rr, n);
        });
        ctl.appendChild(inp);
      }));
      row.appendChild(sub('未保存文章保留天数', (ctl) => {
        const rr = { t: 'number', n: '未保存文章保留天数', k: 'newsRetentionUnsavedDays' };
        const inp = document.createElement('input');
        inp.className = 'bz-input'; inp.type = 'number'; inp.min = '1';
        inp.value = String(Number(rowRead(rr)) || 30);
        inp.addEventListener('change', () => {
          const n = Math.max(1, Number(inp.value) || 30);
          inp.value = String(n); rowWrite(rr, n);
        });
        ctl.appendChild(inp);
      }));
    } else if (r.custom === 'excludedNotes') {
      const sr = document.createElement('div');
      sr.className = 'bz-sp-sub-row';
      const chips = document.createElement('div');
      chips.className = 'bz-sp-chips';
      chips.style.justifyContent = 'flex-start';
      const rr = { k: 'reviewExcludedNotes' };
      const redraw = () => {
        chips.innerHTML = R.pathChipsItemsHtml(pathList(rr).map((p) => ({ path: p, label: p.split('/').pop(), multi: true })));
        chips.querySelectorAll('.x').forEach((x, i) => {
          x.addEventListener('click', () => {
            pathWriteList(rr, pathList(rr).filter((y) => y !== pathList(rr)[i]));
            redraw();
          });
        });
      };
      redraw();
      sr.appendChild(chips);
      row.appendChild(sr);
    } else if (r.custom === 'lanIp') {
      row.appendChild(sub('本机局域网 IP（mock：192.168.1.108）', (ctl) => {
        const b2 = document.createElement('button');
        b2.className = 'bz-sp-btn'; b2.textContent = '填入远程 URL';
        b2.addEventListener('click', () => {
          rowWrite({ k: 'secondBrainRemoteOllamaUrl' }, 'http://192.168.1.108:11434');
          redrawDomain();
        });
        ctl.appendChild(b2);
      }));
    }
  }

  /* ---------- 域实例（桌面面板 / 移动面板共用内核；骨架出纯层） ---------- */
  function createApp(root, mode, initial) {
    const state = { current: initial || 'global', q: '' };
    // 按端口径：桌面剔除零项域（desktopZero，如回忆墙）；移动端全量（其移动组可见）
    const listable = (forMob) => DEMO.NAV
      .map((sec) => ({ title: sec.title, domains: sec.ids.map((id) => ({ id, def: DEMO.DOMAINS[id] })).filter((d) => (forMob || !d.def.desktopZero)) }));

    function renderNav() {
      const nav = root.querySelector('.bz-sp-nav');
      if (!nav) return;
      nav.innerHTML = '';
      for (const sec of listable(mode === 'mob')) {
        const items = sec.domains.filter((d) => !state.q || domainHit(d.id, state.q));
        if (!items.length) continue;
        nav.innerHTML += R.navSecHtml(sec.title, items.map((d) => R.navItemHtml({
          id: d.id, icon: d.def.icon, name: d.def.name,
          count: String(visibleRowsOf(d.def).length),
          on: d.id === state.current && !state.q,
        })).join(''));
      }
      mountIcons(nav);
      nav.querySelectorAll('.bz-sp-nav-item').forEach((b) => {
        b.addEventListener('click', () => { state.current = b.dataset.spDomain; state.q = ''; render(); });
      });
    }
    function domainHit(id, q) {
      const def = DEMO.DOMAINS[id];
      if (def.name.includes(q) || def.desc.includes(q)) return true;
      return visibleRowsOf(def).some((r) => (r.n || '').includes(q) || (r.d || '').includes(q));
    }

    function renderGroupsInto(container, domain, showMobile) {
      for (const g of domain.groups) {
        if (g.m && !showMobile) continue;
        const holder = document.createElement('div');
        const pk = (g.rows.find((r) => r.t === 'toggle' && r.k && !r.k.startsWith('__')) || {}).k || null;
        const cntOf = () => g.rows.filter((r) => (!showMobile && r.m ? false : r.t !== 'button') && evalVis(r.vis) && !(r.child && pk && val(pk) !== true)).length;
        holder.innerHTML = R.groupCardHtml(g.icon, g.name, cntOf() + ' 项');
        const card = holder.firstElementChild;
        const body = card.querySelector('.bz-sp-group-body');
        const refresh = () => reevaluate(card, g, showMobile);
        for (const r of g.rows) body.appendChild(rowEl(r, pk, root, refresh, () => render()));
        container.appendChild(card);
      }
    }
    function reevaluate(card, g, showMobile) {
      const pk = (g.rows.find((r) => r.t === 'toggle' && r.k && !r.k.startsWith('__')) || {}).k || null;
      g.rows.forEach((r) => {
        const el = card.querySelector('.bz-sp-set-row[data-key="' + CSS.escape(r.k || r.n) + '"]');
        if (!el) return;
        const vis = (showMobile || !r.m) && evalVis(r.vis) && !(r.child && pk && val(pk) !== true);
        el.style.display = vis ? '' : 'none';
      });
      const cnt = card.querySelector('.bz-sp-group-count');
      if (cnt) cnt.textContent = g.rows.filter((r) => (!showMobile && r.m ? false : r.t !== 'button') && evalVis(r.vis) && !(r.child && pk && val(pk) !== true)).length + ' 项';
    }

    function render() {
      renderNav();
      const pane = root.querySelector(mode === 'desk' ? '.bz-sp-pane' : '.bz-sp-mob-modal-body');
      if (!pane) return;
      const domain = DEMO.DOMAINS[state.current];
      pane.innerHTML = '';
      if (mode === 'desk') {
        // 域页头（纯层 pageHeadHtml；tag = 可见行数 · 组数）
        const headHolder = document.createElement('div');
        headHolder.innerHTML = R.pageHeadHtml(domain.name, domain.desc, visibleRowsOf(domain).length + ' 项 · ' + domain.groups.filter((g) => !g.m).length + ' 组');
        pane.appendChild(headHolder.firstElementChild);
      }
      const body = document.createElement('div');
      body.className = 'bz-sp-settings-body';
      pane.appendChild(body);
      renderGroupsInto(body, domain);
    }

    function mount() {
      if (mode === 'desk') {
        root.innerHTML = R.deskShellHtml();
      } else {
        root.innerHTML = R.mobShellHtml();
      }
      mountIcons(root);
      const sinp = root.querySelector('input');
      sinp.addEventListener('input', () => {
        state.q = sinp.value;
        renderNav();
        if (mode === 'desk') {
          root.querySelectorAll('.bz-sp-set-row').forEach((row) => {
            row.classList.toggle('hit', !!state.q.trim() && row.textContent.includes(state.q.trim()));
          });
        } else {
          api.renderMobList();
          api.bindMobList((id) => api.openDomain(id));
        }
      });
      render();
    }

    const api = {
      mount,
      openDomain(id) {
        state.current = id;
        if (mode === 'desk') { render(); return; }
        // 移动端：域设置弹窗（壳出纯层 mobModalShellHtml）
        const domain = DEMO.DOMAINS[id];
        const mask = document.createElement('div');
        mask.className = 'bz-sp-demo-mobmask';
        const modal = document.createElement('div');
        modal.className = 'bz-sp-mob-modal';
        modal.innerHTML = R.mobModalShellHtml(domain.icon, domain.name);
        mountIcons(modal);
        const body = modal.querySelector('.bz-sp-mob-modal-body');
        mask.appendChild(modal);
        root.appendChild(mask);
        // 渲染该域到弹窗 body（复用桌面组卡渲染）
        const prev = state.current;
        state.current = id;
        body.innerHTML = '';
        const bodyEl = document.createElement('div');
        bodyEl.className = 'bz-sp-settings-body';
        body.appendChild(bodyEl);
        renderGroupsInto(bodyEl, domain, true);
        state.current = prev;
        mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
      },
      bindMobList(onOpen) {
        root.querySelectorAll('.bz-sp-mob-item').forEach((it) => {
          it.addEventListener('click', () => onOpen(it.dataset.spDomain));
        });
      },
      open(id) { state.current = id; render(); },
      openDirPicker(row) { openDirPicker(root, row, () => render()); },
      pickModel(row) { pickModel(root, row, () => render()); },
      renderMobList() {
        const list = root.querySelector('.bz-sp-mob-list');
        if (!list) return;
        const keep = state.q;
        list.innerHTML = '';
        for (const sec of listable()) {
          const items = sec.domains.filter((d) => !keep || domainHit(d.id, keep));
          if (!items.length) continue;
          list.innerHTML += R.mobSecHtml(sec.title) + items.map((d) => R.mobItemHtml({
            id: d.id, icon: d.def.icon, name: d.def.name, desc: d.def.desc,
          })).join('');
        }
        mountIcons(list);
      },
    };
    return api;
  }

  /* ---------- 启动：桌面 + 移动两实例 ---------- */
  const urlDomain = new URLSearchParams(location.search).get('domain');
  const desk = createApp(document.getElementById('sp-demo-desk'), 'desk', urlDomain && DEMO.DOMAINS[urlDomain] ? urlDomain : 'global');
  desk.mount();
  const mob = createApp(document.getElementById('sp-demo-mob'), 'mob');
  mob.mount();
  mob.renderMobList();
  mob.bindMobList((id) => mob.openDomain(id));
  if (new URLSearchParams(location.search).get('demo') === 'mob') mob.openDomain('cinema');

  /* ---------- 评审快捷参数：?demo=path / ?demo=model ---------- */
  const demoParam = new URLSearchParams(location.search).get('demo');
  if (demoParam === 'path') {
    desk.open('clipbook');
    setTimeout(() => desk.openDirPicker({ t: 'path', mode: 'single', n: '剪藏目录', d: '存放网页剪藏文章的文件夹', k: 'articleDirectory' }), 300);
  } else if (demoParam === 'model') {
    desk.open('ai');
    setTimeout(() => desk.pickModel({ k: '__fn:aiModel', n: '模型名称' }), 500);
  }

  /* ---------- 亮暗切换 + 重置演示数据（壳层演示件） ---------- */
  function applyTheme(t) {
    document.body.classList.toggle('theme-dark', t === 'dark');
    localStorage.setItem(LS_THEME, t);
    const tb = document.getElementById('sp-theme-btn');
    if (tb) {
      tb.innerHTML = '';
      tb.appendChild(icon(t === 'dark' ? 'sun' : 'moon', 'bz-ic'));
    }
  }
  const themeBtn = document.getElementById('sp-theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
  });
  const rbtn = document.getElementById('sp-reset-btn');
  if (rbtn) rbtn.addEventListener('click', () => {
    localStorage.removeItem(LS);
    localStorage.removeItem(LS_CAT);
    location.reload();
  });

  applyTheme(new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : (localStorage.getItem(LS_THEME) || 'light'));

  /* ---------- 初始主题类（两实例各挂当前皮肤） ---------- */
  [desk, mob].forEach((appInst, idx) => {
    const panelRoot = idx === 0 ? document.getElementById('sp-demo-desk') : document.getElementById('sp-demo-mob');
    syncThemeClass(panelRoot, val('settingsPanelSkin'));
  });

  /* ---------- selftest（?selftest=1）：导航逐域点击 / 下拉切换 / 移动弹窗滚动 ---------- */
  window.__selftest = function () {
    const out = [];
    const A = (name, cond) => out.push((cond ? 'PASS ' : 'FAIL ') + name);
    const deskNav = () => document.querySelectorAll('#sp-demo-desk .bz-sp-nav-item');
    for (const b of deskNav()) {
      const name = b.querySelector('.bz-sp-nav-name').textContent;
      try {
        b.click();
        const cards = document.querySelectorAll('#sp-demo-desk .bz-sp-group').length;
        if (cards === 0) A('点击「' + name + '」渲染分组卡', false);
      } catch (e) {
        A('点击「' + name + '」抛异常：' + e.message, false);
      }
    }
    A('逐域点击导航全部渲出分组卡', true);
    A('markup 单源（BZR_settings_panel 在库）', !!window.BZR_settings_panel && !!window.BZR_settings_panel.rowHtml);
    const aiBtn = [...deskNav()].find((b) => b.querySelector('.bz-sp-nav-name').textContent === 'AI');
    aiBtn.click();
    const aiPane = document.querySelector('#sp-demo-desk .bz-sp-pane');
    const sel = aiPane.querySelector('.bz-select');
    sel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const menu = sel.querySelector('.bz-select-menu');
    A('下拉点击展开菜单', !!menu);
    const items = menu ? menu.querySelectorAll('.bz-select-item') : [];
    A('菜单项数 = 16', items.length === 16);
    if (items[2]) items[2].click();
    A('点选项后值切换', delta.aiProvider === 'openai');
    const dsRow = aiPane.querySelector('.bz-sp-set-row[data-key="deepseekApiKey"]');
    A('DeepSeek 密钥行随切换隐藏', !!dsRow && dsRow.style.display === 'none');
    const sbBtn = [...deskNav()].find((b) => b.querySelector('.bz-sp-nav-name').textContent === '第二大脑');
    sbBtn.click();
    A('第二大脑渲染分组卡 > 0', document.querySelectorAll('#sp-demo-desk .bz-sp-group').length > 0);
    mob.openDomain('ai');
    const mbody = document.querySelector('#sp-demo-mob .bz-sp-mob-modal-body');
    A('移动弹窗 body 存在', !!mbody);
    if (mbody) {
      A('移动弹窗 body overflow-y=auto', getComputedStyle(mbody).overflowY === 'auto');
      A('移动弹窗内容可滚', mbody.scrollHeight >= mbody.clientHeight);
    }
    delta = {}; catDelta = {}; persist();
    return out;
  };

  if (location.search.includes('selftest')) {
    (function () {
        let res;
        try { res = window.__selftest(); }
        catch (e) {
          document.title = 'SELFTEST CRASH ' + e.message;
          const el = document.createElement('pre');
          el.style.cssText = 'position:fixed;left:0;top:0;z-index:999;background:#fff;color:#000;padding:10px;font-size:12px';
          el.textContent = 'CRASH: ' + e.message + '\n' + e.stack;
          document.body.appendChild(el);
          return;
        }
        const pass = res.filter((r) => r.startsWith('PASS')).length;
        document.title = 'SELFTEST ' + pass + '/' + res.length;
        const el = document.createElement('pre');
        el.style.cssText = 'position:fixed;left:0;top:0;z-index:999;background:#fff;color:#000;padding:10px;font-size:12px;max-height:80vh;overflow:auto;margin:0;white-space:pre';
        el.textContent = 'SELFTEST ' + pass + '/' + res.length + '\n' + res.join('\n');
        document.body.appendChild(el);
      }

    )();
  }
})();

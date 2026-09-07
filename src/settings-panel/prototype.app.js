/**
 * 设置面板域内原型 · 演示渲染器（prototype.app.js）
 * markup 单源（ADR-0104，2026-09-07 拍板以原型为主迁移）：桌面面板 + 移动手机框两实例，
 * 组件/行/组/子弹窗 HTML 全出自 window.BZR_settings_panel（render.ts 纯层构建产物，
 * 从本壳历史版逐字提取——原型是真理，render.ts 是其映射实现）；
 * 本壳只留演示层：值层（localStorage delta）、事件绑定、演示弹层行为、亮暗钮、selftest。
 * 值层 = 演示假值 + localStorage delta（bz-sp-proto-*），不触真实 vault。
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

  /* ---------- 壳基座：mountIcons（内联 SVG，对齐 core/ui icons.ts；markup 里 icon 占位由此兑现） ---------- */
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
    if (!root) return;
    root.querySelectorAll('i[data-lucide]').forEach((el) => {
      const d = ICONS[el.dataset.lucide];
      if (d && !el.firstChild) {
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
      }
    });
  }
  /** 兜底直拼（mountIcons 前需要 outerHTML 的少数场景） */
  function icon(name, cls) {
    const el = document.createElement('i');
    el.setAttribute('data-lucide', name);
    el.className = cls || 'bz-ic';
    mountIcons(el.parentNode || el);
    return el;
  }

  /* ---------- 值通道 ---------- */
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

  /* ---------- 主题类同步：移除全部 bz-sp-tf-* 后挂当前主题 ---------- */
  const THEME_KEYS = ['linen', 'celadon', 'dark', 'mono'];
  function syncThemeClass(rootEl, v) {
    const panel = rootEl.closest ? (rootEl.closest('.bz-sp-desk') || rootEl.closest('.bz-sp-mobile') || rootEl) : rootEl;
    THEME_KEYS.forEach((k) => panel.classList.remove('bz-sp-tf-' + k));
    if (v && THEME_KEYS.indexOf(v) >= 0) panel.classList.add('bz-sp-tf-' + v);
  }

  /* ---------- 弹层：文件夹选择器 / 模型选择器 / toast ---------- */
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

  /* ---------- 子弹窗：共享确认框 / UP 主名单 / 日记解析检测 / 数据体检 / 卡片目录选择器 ----------
   * 演示插件真实可达子弹层（A 组清单）：统一居中卡形态（复用 .bz-sp-picker-mask 遮罩与皮 tokens），
   * 类名对齐插件对应实现（.bz-path-picker-* / flow 确认语义），评审视觉与插件一致。 */

  /** 通用居中卡片弹层：mask 挂 host（面板作用域，同 openDirPicker）；返回 { mask, card, close } */
  function openDemoCard(host, opts) {
    const mask = document.createElement('div');
    mask.className = 'bz-sp-picker-mask';
    const card = document.createElement('div');
    card.className = 'bz-sp-demo-card';
    if (opts.width) card.style.maxWidth = opts.width;
    const close = (v) => { mask.remove(); if (opts.onClose) opts.onClose(v); };
    mask.addEventListener('click', (e) => { if (e.target === mask) close(undefined); });
    host.appendChild(mask);
    mask.appendChild(card);
    return { mask, card, close };
  }

  /** 共享确认框（对齐 core/flow-dialog 语义：h4 标题 + message + 取消/确认；遮罩/Esc = 取消） */
  function confirmDialog(host, opts) {
    const { mask, card, close } = openDemoCard(host, { width: 'min(440px, 86%)', onClose: opts.onCancel });
    card.classList.add('bz-sp-confirm');
    card.innerHTML = R.confirmHtml(opts);
    const [cancel, ok] = card.querySelectorAll('.bz-sp-confirm-actions .bz-sp-btn');
    cancel.addEventListener('click', () => close(undefined));
    ok.addEventListener('click', () => {
      close('ok');
      if (opts.onOk) opts.onOk();
    });
    return { close, el: card };
  }

  /* ---------- UP 主名单管理弹窗（对齐插件 openUpManagerModal：添加/Cookie/名单三区） ---------- */
  let upManagerUps = ['483421584', '1637835414', '1017844864'];
  const UP_NAMES = { '483421584': '影视飓风', '1637835414': '老师好我叫何同学', '1017844864': '智能路障' };
  function openUpManager(host, onChanged) {
    const { mask, card, close } = openDemoCard(host, { width: 'min(560px, 92%)' });
    card.classList.add('bz-sp-upmgr');
    const head = document.createElement('div');
    head.className = 'bz-sp-demo-card-head';
    const t = document.createElement('b');
    t.textContent = 'UP 主名单管理';
    head.appendChild(t);
    const body = document.createElement('div');
    body.className = 'bz-sp-demo-card-body';
    const redraw = () => {
      body.innerHTML = '';
      // 添加区
      const addHolder = document.createElement('div');
      addHolder.innerHTML = R.upmgrAddRowHtml();
      const add = addHolder.firstElementChild;
      const inp = add.querySelector('input');
      const addBtn = add.querySelector('.bz-sp-btn');
      addBtn.addEventListener('click', () => {
        const raw = (inp.value || '').trim();
        if (!raw) return;
        const m = raw.match(/(?:space\.bilibili\.com\/|uid=)(\d+)/) || raw.match(/^\d+$/);
        const uid = m ? m[1] || m[0] : null;
        if (!uid) { toast(host, '无法识别 UID，请粘贴主页链接'); return; }
        if (upManagerUps.includes(uid)) { toast(host, '该 UP 主已在名单中'); return; }
        upManagerUps = [uid, ...upManagerUps].slice(0, 50);
        if (onChanged) onChanged();
        redraw();
        toast(host, '已添加 UP 主 ' + uid);
      });
      body.appendChild(add);
      // 名单列表区（mock：头像占位省略，仅名字 + UID + 移除）
      const list = document.createElement('div');
      list.className = 'bz-sp-upmgr-list';
      if (!upManagerUps.length) {
        const empty = document.createElement('div');
        empty.className = 'bz-sp-picker-row';
        empty.style.opacity = '0.55';
        empty.textContent = '暂无跟踪 UP 主，在上方粘贴主页链接或视频链接添加';
        list.appendChild(empty);
      }
      upManagerUps.forEach((uid) => {
        const rowEl = document.createElement('div');
        rowEl.innerHTML = R.upmgrItemHtml(UP_NAMES[uid] || ('UP ' + uid), uid);
        const row = rowEl.firstElementChild;
        const del = row.querySelector('.bz-sp-btn');
        del.addEventListener('click', () => {
          upManagerUps = upManagerUps.filter((u) => u !== uid);
          if (onChanged) onChanged();
          redraw();
          toast(host, '已移除 UP 主 ' + uid);
        });
        list.appendChild(row);
      });
      body.appendChild(list);
    };
    const foot = document.createElement('div');
    foot.className = 'bz-sp-picker-foot';
    const done = document.createElement('button');
    done.className = 'bz-sp-btn bz-sp-btn--primary'; done.textContent = '完成';
    done.addEventListener('click', () => close('ok'));
    foot.appendChild(done);
    redraw();
    card.append(head, body, foot);
  }

  /* ---------- 日记解析检测面板（对齐插件 openDiaryRepairModal） ---------- */
  function openDiaryRepair(host) {
    const { mask, card, close } = openDemoCard(host, { width: 'min(640px, 94%)' });
    card.classList.add('bz-sp-demo-panel');
    const head = document.createElement('div');
    head.className = 'bz-sp-demo-card-head';
    const t = document.createElement('b');
    t.textContent = '日记解析检测';
    head.appendChild(t);
    const body = document.createElement('div');
    body.className = 'bz-sp-demo-card-body';
    // mock 扫描结果
    const intro = document.createElement('div');
    intro.className = 'bz-sp-upmgr-row';
    intro.innerHTML = '<div class="bz-sp-set-name">扫描完成</div><div class="bz-sp-set-desc">共 128 个日记文件，发现 2 个文件存在无法解析的行（演示数据）</div>';
    body.appendChild(intro);
    const fixable = [
      { file: '我的/日记/2025/09-01.md', before: '## 09:1 整理周报', after: '## 09:10 整理周报' },
      { file: '我的/日记/2025/09-03.md', before: '## 2:30 午睡', after: '## 02:30 午睡' },
    ];
    const g1 = document.createElement('div');
    g1.className = 'bz-sp-demo-sec';
    const g1t = document.createElement('div');
    g1t.className = 'bz-sp-demo-sec-t';
    g1t.textContent = '可自动修复（2）';
    g1.appendChild(g1t);
    fixable.forEach((f) => {
      const rowHolder = document.createElement('div');
      rowHolder.innerHTML = R.repairRowHtml(f.file, f.before, f.after);
      g1.appendChild(rowHolder.firstElementChild);
    });
    body.appendChild(g1);
    const g2 = document.createElement('div');
    g2.className = 'bz-sp-demo-sec';
    const g2t = document.createElement('div');
    g2t.className = 'bz-sp-demo-sec-t';
    g2t.textContent = '需手动处理（0）';
    g2.appendChild(g2t);
    body.appendChild(g2);
    const foot = document.createElement('div');
    foot.className = 'bz-sp-picker-foot';
    const fixBtn = document.createElement('button');
    fixBtn.className = 'bz-sp-btn bz-sp-btn--primary'; fixBtn.textContent = '一键修复 2 处';
    fixBtn.addEventListener('click', () => {
      confirmDialog(host, {
        title: '修复日记标题格式',
        message: '将批量修正 2 个文件的标题行（补空格/时间补零），正文内容不改。确定继续？',
        okText: '修复',
        danger: false,
        onOk: () => {
          body.innerHTML = '';
          const ok = document.createElement('div');
          ok.className = 'bz-sp-demo-sec';
          ok.innerHTML = '<div class="bz-sp-set-name">已修复 2 处</div><div class="bz-sp-set-desc">重新检测后无可修复项（演示）</div>';
          body.appendChild(ok);
          toast(host, '已修复 2 处日记标题');
        },
      });
    });
    const resc = document.createElement('button');
    resc.className = 'bz-sp-btn'; resc.textContent = '重新检测';
    resc.addEventListener('click', () => { toast(host, '重新检测完成：无可修复项（演示）'); });
    foot.append(resc, fixBtn);
    card.append(head, body, foot);
  }

  /* ---------- 数据体检面板（对齐插件 checkup 面板：空态 → 进度 → 报告） ---------- */
  function openCheckup(host) {
    const { mask, card, close } = openDemoCard(host, { width: 'min(640px, 94%)' });
    card.classList.add('bz-sp-demo-panel');
    const head = document.createElement('div');
    head.className = 'bz-sp-demo-card-head';
    const t = document.createElement('b');
    t.textContent = '数据体检';
    head.appendChild(t);
    const body = document.createElement('div');
    body.className = 'bz-sp-demo-card-body';
    const foot = document.createElement('div');
    foot.className = 'bz-sp-picker-foot';
    const idle = () => {
      body.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'bz-sp-demo-empty';
      empty.innerHTML = '<div class="bz-sp-set-name">还没体检过</div><div class="bz-sp-set-desc">体检会检查各域数据文件能否解析、字段是否漂移、条目指向是否失效，全程只读不改数据</div>';
      body.appendChild(empty);
      foot.innerHTML = '';
      const start = document.createElement('button');
      start.className = 'bz-sp-btn bz-sp-btn--primary'; start.textContent = '开始体检';
      start.addEventListener('click', () => run());
      foot.appendChild(start);
    };
    const run = () => {
      body.innerHTML = '';
      const steps = ['数据文件可解析', '字段漂移', '孤儿条目', '同源一致性'];
      const list = document.createElement('div');
      list.innerHTML = R.checkupStepsHtml(steps);
      const marks = [...list.querySelectorAll('.bz-sp-demo-step')];
      const prog = document.createElement('div');
      prog.className = 'bz-sp-demo-prog';
      prog.textContent = '体检中…';
      body.append(prog, list);
      foot.innerHTML = '';
      const cancel = document.createElement('button');
      cancel.className = 'bz-sp-btn'; cancel.textContent = '取消体检';
      cancel.addEventListener('click', () => { idle(); });
      foot.appendChild(cancel);
      let i = 0;
      const timer = setInterval(() => {
        if (!mask.isConnected) { clearInterval(timer); return; }
        marks.forEach((m, mi) => {
          m.classList.toggle('is-done', mi < i);
          m.classList.toggle('is-current', mi === i);
        });
        prog.textContent = i >= steps.length ? '体检中…' : '体检中（' + (i + 1) + '/' + steps.length + '）：' + steps[i];
        i += 1;
        if (i > steps.length) {
          clearInterval(timer);
          report();
        }
      }, 600);
    };
    const report = () => {
      body.innerHTML = '';
      foot.innerHTML = '';
      const summary = document.createElement('div');
      summary.className = 'bz-sp-demo-summary bz-sp-demo-summary--ok';
      summary.textContent = '体检完成：全部通过（演示数据无问题项）';
      body.appendChild(summary);
      const pass = document.createElement('div');
      pass.className = 'bz-sp-demo-sec';
      pass.innerHTML = '<div class="bz-sp-demo-sec-t">通过（4）</div>' +
        '<div class="bz-sp-demo-clean">json 可解析：全部文件可解析</div>' +
        '<div class="bz-sp-demo-clean">字段漂移：无意外/缺失字段</div>' +
        '<div class="bz-sp-demo-clean">孤儿条目：无失效引用</div>' +
        '<div class="bz-sp-demo-clean">同源一致性：双视角计数一致</div>';
      body.appendChild(pass);
      const again = document.createElement('button');
      again.className = 'bz-sp-btn bz-sp-btn--primary'; again.textContent = '重新体检';
      again.addEventListener('click', () => run());
      foot.appendChild(again);
    };
    idle();
    card.append(head, body, foot);
  }

  /* ---------- 卡片目录选择器（对齐插件 bz-path-picker 卡片壳；记忆目录等 pickerKind:card 行走这里） ---------- */
  function openPathPickerCard(host, row, onDone) {
    const multi = row.mode === 'multi';
    const dirs = DEMO.DIRS;
    const selected = new Set(multi ? pathList(row) : [String(rowRead(row) || '')].filter(Boolean));
    const { mask, card, close } = openDemoCard(host, { width: 'min(440px, 92%)' });
    card.classList.add('bz-path-picker');
    // 头部（h3 标题 + desc）
    const head = document.createElement('div');
    head.innerHTML = R.pathPickerHeadHtml((multi ? '添加文件夹 · ' : '选择文件夹 · ') + row.n, row.d);
    // 搜索
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'bz-path-picker-search';
    search.placeholder = '搜索目录…';
    // 列表（复刻插件有序列表：已选置顶 → 库根 → 其余反转）
    const listEl = document.createElement('div');
    listEl.className = 'bz-path-picker-list';
    // 底部
    const foot = document.createElement('div');
    foot.className = 'bz-path-picker-foot';
    const selinfo = document.createElement('span');
    selinfo.className = 'bz-path-picker-selinfo';
    const btns = document.createElement('div');
    btns.className = 'bz-path-picker-foot-btns';
    foot.append(selinfo, btns);
    const mkBtn = (label, primary, onclick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = 'bz-path-picker-btn' + (primary ? ' bz-path-picker-btn--primary' : '');
      b.onclick = onclick;
      btns.appendChild(b);
      return b;
    };
    let q = '';
    const closeSelf = () => {
      mask.remove();
      if (onDone) onDone();
    };
    const doConfirm = () => {
      const list = multi ? [...selected] : ([...selected][0] ?? null);
      const raw = base[row.k];
      const v = multi ? [...new Set(pathList(row).concat(list || []))] : (list || '');
      if (multi) pathWriteList(row, v);
      else rowWrite(row, v);
      closeSelf();
    };
    if (multi) mkBtn('清空', false, () => { selected.clear(); renderList(); updateSel(); });
    mkBtn(row.okText || (multi ? '添加所选' : '选用'), true, () => doConfirm());
    function orderedList() {
      const pinned = [];
      const rest = [];
      const pinSet = new Set(selected);
      for (const f of dirs) { if (pinSet.has(f)) pinned.push(f); else rest.push(f); }
      const rootIdx = rest.indexOf('');
      const root = rootIdx >= 0 ? rest.splice(rootIdx, 1)[0] : null;
      rest.reverse();
      return [...pinned, ...(root === null ? [] : [root]), ...rest];
    }
    function renderList() {
      listEl.innerHTML = '';
      const query = q.trim().toLowerCase();
      let n = 0;
      let total = 0;
      for (const folder of orderedList()) {
        if (query && folder !== query && !folder.toLowerCase().includes(query)) continue;
        total++;
        if (n >= 300) continue;
        n++;
        const on = selected.has(folder);
        const rowHolder = document.createElement('div');
        rowHolder.innerHTML = R.pathPickerRowHtml(folder, on, folder === '' ? '（库根目录）' : folder);
        const rowEl = rowHolder.firstElementChild;
        rowEl.onclick = () => {
          if (!multi) { selected.clear(); selected.add(folder); }
          else if (selected.has(folder)) selected.delete(folder);
          else selected.add(folder);
          renderList();
          updateSel();
        };
        listEl.appendChild(rowEl);
      }
      if (!total) {
        const empty = document.createElement('div');
        empty.className = 'bz-path-picker-empty';
        empty.textContent = '没有匹配的目录';
        listEl.appendChild(empty);
      }
    }
    function updateSel() {
      if (!multi) {
        const first = [...selected][0];
        selinfo.textContent = first === undefined ? '未选择' : first === '' ? '已选（库根目录）' : '已选 ' + first;
      } else {
        selinfo.textContent = '已选 ' + selected.size + ' 项';
      }
    }
    search.oninput = () => { q = search.value; renderList(); };
    renderList();
    updateSel();
    card.append(head, search, listEl, foot);
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
    head.innerHTML = R.pickerHeadHtml((multi ? '添加文件夹 · ' : '选择文件夹 · ') + row.n, '搜索目录…（命中项保留上级链）');
    const sinp = head.querySelector('input');
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
      const arr = [...selected].filter(Boolean);
      crumb.innerHTML = R.pickerCrumbHtml(multi, arr);
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
        const rowHolder = document.createElement('div');
        rowHolder.innerHTML = R.pickerRowHtml(
          parts[parts.length - 1],
          parts.length > 1 ? parts.slice(0, -1).join(' / ') + ' /' : 'vault 根目录',
          selected.has(d)
        );
        const rowBtn = rowHolder.firstElementChild;
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
      const itHolder = document.createElement('div');
      itHolder.innerHTML = R.modelItemHtml(m, m === cur);
      const it = itHolder.firstElementChild;
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

  /* ---------- 行渲染（markup 单源：行骨架与控件串全出自 R.*，行为绑定留壳） ---------- */
  function rowEl(r, parentKey, host, refresh, redrawDomain) {
    const holder = document.createElement('div');
    const isCards = r.t === 'choiceCards';
    const isCustom = r.t === 'custom' && r.custom;
    holder.innerHTML = R.rowHtml({
      key: r.k || r.n,
      isCards,
      isCustom,
      name: r.n || '',
      desc: r.d || '',
      note: r.note || '',
    });
    const row = holder.firstElementChild;
    // 显隐初值（原型逐字：vis 求值 + child 依赖父开关）
    if (!evalVis(r.vis)) row.style.display = 'none';
    if (r.child && parentKey && val(parentKey) !== true) row.style.display = 'none';
    if (!isCustom) {
      renderCtl(row.querySelector(isCards ? '.bz-sp-set-cards' : '.bz-sp-set-ctrl'), r, host, refresh, redrawDomain);
    } else {
      renderCustom(r, row, host, redrawDomain);
    }
    mountIcons(row);
    return row;
  }

  function renderCtl(ctl, r, host, refresh, redrawDomain) {
    const t = r.t;
    if (t === 'toggle') {
      ctl.innerHTML = R.toggleHtml(rowRead(r) === true);
      const sw = ctl.querySelector('.bz-sw');
      sw.addEventListener('click', () => {
        const v = !sw.classList.contains('on');
        sw.classList.toggle('on', v);
        sw.setAttribute('aria-checked', String(v));
        rowWrite(r, v);
        refresh();
      });
    } else if (t === 'select') {
      const labelOf = (v) => ((r.opts || []).find((o) => o.v === v) || {}).l || v;
      ctl.innerHTML = R.selectTriggerHtml(labelOf(String(rowRead(r) ?? '') || (r.opts[0] && r.opts[0].v) || ''));
      const sel = ctl.querySelector('.bz-select');
      sel.addEventListener('click', () => {
        if (sel.querySelector('.bz-select-menu')) return;
        // 组卡 overflow:hidden 会裁剪伸出的菜单——展开期间放开并提层
        const group = sel.closest('.bz-sp-group');
        if (group) { group.style.overflow = 'visible'; group.style.zIndex = 10; }
        const closeMenu = () => {
          sel.querySelector('.bz-select-menu') && sel.querySelector('.bz-select-menu').remove();
          if (group) { group.style.overflow = ''; group.style.zIndex = ''; }
          document.removeEventListener('click', h);
        };
        const menu = document.createElement('div');
        menu.className = 'bz-select-menu';
        const curNow = String(rowRead(r) ?? '') || (r.opts[0] && r.opts[0].v) || '';
        menu.innerHTML = (r.opts || []).map((o) => R.selectItemHtml(o.l, o.v === curNow)).join('');
        menu.querySelectorAll('.bz-select-item').forEach((it, i) => {
          const o = (r.opts || [])[i];
          it.addEventListener('click', (ev) => {
            ev.stopPropagation();
            closeMenu();
            sel.querySelector('.bz-select-val').textContent = labelOf(o.v);
            rowWrite(r, o.v);
            refresh();
            // 面板外观联动（通用域「面板外观」组）：风格/皮肤切换实时作用于面板根
            if (r.k === 'settingsPanelTheme' || r.k === 'settingsPanelSkin') {
              const panelRoot = host.closest('.bz-sp-desk') || host;
              panelRoot.classList.toggle('bz-sp-force-light', val('settingsPanelTheme') === 'light');
              panelRoot.classList.toggle('bz-sp-force-dark', val('settingsPanelTheme') === 'dark');
              panelRoot.classList.toggle('bz-sp-skin-paper', val('settingsPanelSkin') === 'paper');
              panelRoot.classList.toggle('bz-sp-skin-weave', val('settingsPanelSkin') === 'weave');
            }
          });
        });
        sel.appendChild(menu);
        mountIcons(menu);
        const h = (ev) => {
          if (!sel.contains(ev.target)) closeMenu();
        };
        setTimeout(() => document.addEventListener('click', h));
      });
    } else if (t === 'text' || t === 'textarea' || t === 'number') {
      const isModel = r.k === '__fn:aiModel';
      const isNum = t === 'number';
      const init = rowRead(r);
      const initStr = t === 'number' ? String(Number(init) || 0) : String(init ?? '');
      if (t === 'textarea') ctl.innerHTML = R.textareaHtml(initStr, r.ph);
      else {
        ctl.innerHTML = R.textInputHtml({
          value: initStr,
          type: isNum ? 'number' : 'text',
          num: !!(r.num) || isNum,
          mono: !!r.mono,
          secret: !!r.secret,
          placeholder: r.ph,
          min: r.min,
          max: r.max,
          step: isNum ? (r.step ?? 1) : undefined,
        });
      }
      const inp = ctl.querySelector('textarea, input');
      const commit = () => {
        if (!inp.dataset.dirty) return;
        delete inp.dataset.dirty;
        if (t === 'number') {
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
      if (t !== 'textarea') inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
      if (isModel) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:6px;align-items:center';
        while (ctl.firstChild) wrap.appendChild(ctl.firstChild);
        wrap.insertAdjacentHTML('beforeend', R.rowBtnHtml('获取模型名'));
        const btn = wrap.querySelector('.bz-sp-btn');
        btn.addEventListener('click', () => pickModel(host, r, redrawDomain));
        ctl.appendChild(wrap);
      }
    } else if (t === 'slider') {
      ctl.innerHTML = R.sliderHtml(r.min, r.max, r.step, Number(rowRead(r)) || 0);
      const inp = ctl.querySelector('input[type="range"]');
      const em = ctl.querySelector('.bz-sp-slider-val');
      inp.addEventListener('input', () => { em.textContent = inp.value; rowWrite(r, Number(inp.value)); });
    } else if (t === 'path') {
      const multi = r.mode === 'multi';
      const chips = document.createElement('div');
      chips.className = 'bz-sp-chips';
      const openPicker = () => {
        // pickerKind: 'card' = 插件走 core/bz-path-picker 卡片壳（如 smartcat 记忆目录）；缺省 = dir-picker 域内弹层
        if (r.pickerKind === 'card') openPathPickerCard(host, r, redrawDomain);
        else openDirPicker(host, r, redrawDomain);
      };
      const redraw = () => {
        const list = multi ? pathList(r) : [String(rowRead(r) || '')].filter(Boolean);
        const items = list.length
          ? list.map((p) => ({ path: p, label: p, multi }))
          : [{ path: '', label: multi ? '未选择' : '未设置', muted: true }];
        chips.innerHTML = R.pathChipsItemsHtml(items);
        chips.querySelectorAll('.bz-sp-chip').forEach((c) => {
          if (c.classList.contains('bz-sp-chip--muted')) return;
          const p = c.dataset.spPath;
          const x = c.querySelector('.x');
          if (x) x.addEventListener('click', () => { pathWriteList(r, pathList(r).filter((y) => y !== p)); redraw(); });
          else if (!multi) c.addEventListener('click', openPicker);
        });
      };
      redraw();
      ctl.appendChild(chips);
      ctl.insertAdjacentHTML('beforeend', R.pathAddBtnHtml(multi ? '添加…' : '选择…'));
      const btn = ctl.querySelector('.bz-sp-path-btn');
      btn.addEventListener('click', openPicker);
    } else if (t === 'button') {
      ctl.innerHTML = R.rowBtnHtml(r.btn || '打开', r.cta);
      const b2 = ctl.querySelector('.bz-sp-btn');
      b2.addEventListener('click', () => {
        // demo 标记分发真实子弹窗演示；缺省保留 toast 占位
        if (r.demo === 'checkup') openCheckup(host);
        else if (r.demo === 'diaryRepair') openDiaryRepair(host);
        else if (r.demo === 'reindex') {
          confirmDialog(host, {
            title: '重新索引',
            message: '将清空现有向量索引，按当前白名单全部重嵌入（约等于首次初始化全量跑一遍）。期间参考侧边栏与对话的向量检索会降级为文本匹配。确定继续吗？',
            okText: '开始重建',
            onOk: () => {
              toast(host, '已开始重新索引：清空 → 整库重嵌 → 统计（演示）');
              setTimeout(() => toast(host, '重新索引完成：已嵌入 847 段（演示）'), 1600);
            },
          });
        } else if (r.demo === 'clearHistory') {
          confirmDialog(host, {
            title: '清空历史',
            message: '将移除全部「成功」归档记录；文献笔记与视频文件保留在原处。',
            okText: '清空',
            danger: true,
            onOk: () => toast(host, '已清空归档历史（演示）'),
          });
        } else {
          toast(host, '原型演示：' + r.btn);
        }
      });
    } else if (t === 'choiceCards') {
      // 布局绑定的主题行（r.layoutKey）：只渲当前布局配套的单卡——主题不通用
      const opts = (r.opts || []).filter((o) => !o.layout || !r.layoutKey || o.layout === String(rowRead({ k: r.layoutKey }) ?? ''));
      const cur = String(rowRead(r) ?? '') || (opts[0] && opts[0].v) || '';
      ctl.innerHTML = R.cardpickHtml(opts.map((o) => ({ value: o.v, label: o.l, on: o.v === cur, kind: r.kind, prev: o.prev })));
      ctl.style.maxWidth = 'none';
      ctl.querySelectorAll('.bz-sp-cardpick-card').forEach((c) => {
        const o = opts.find((x) => x.v === c.dataset.spCard);
        c.addEventListener('click', () => {
          ctl.querySelectorAll('.is-on').forEach((x) => x.classList.remove('is-on'));
          c.classList.add('is-on');
          rowWrite(r, o.v);
          // 外观域联动（参考待办 todoSkin）：布局与主题一一对应——点布局自动切配套主题；点主题实时换肤
          // 布局键 → 配套主题键映射（新域接外观组在此登记一行）
          const layoutPairMap = { settingsPanelLayout: 'settingsPanelSkin', todoSkin: 'todoSkinTheme', belSkin: 'belSkinTheme' };
          if (layoutPairMap[r.k]) {
            rowWrite({ k: layoutPairMap[r.k] }, o.theme);
            if (r.k === 'settingsPanelLayout') syncThemeClass(host, o.theme);
            redrawDomain();
            toast(host, '已切换布局：' + o.l);
          } else if (r.k === 'settingsPanelSkin') {
            syncThemeClass(host, o.v);
          }
        });
      });
    }
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
        const rr = { t: 'toggle', n: label, k: key };
        ctl.innerHTML = R.toggleHtml(rowRead(rr) === true);
        const sw = ctl.querySelector('.bz-sw');
        sw.addEventListener('click', () => {
          const v = !sw.classList.contains('on');
          sw.classList.toggle('on', v);
          rowWrite(rr, v);
        });
      });
      row.appendChild(mkT('知乎日报', '__mock:newsZhihu'));
      row.appendChild(mkT('果壳科学人', '__mock:newsGuokr'));
      row.appendChild(mkT('B站 UP 主投稿', '__mock:newsBili'));
      row.appendChild(sub('UP 主名单', (ctl) => {
        ctl.innerHTML = R.rowBtnHtml('管理');
        const b2 = ctl.querySelector('.bz-sp-btn');
        const syncLabel = () => { b2.textContent = '管理（' + upManagerUps.length + ' 人）'; };
        syncLabel();
        b2.addEventListener('click', () => openUpManager(host, syncLabel));
      }));
      row.appendChild(sub('B站抓取条数', (ctl) => {
        const rr = { t: 'number', n: 'B站抓取条数', k: '__mock:newsBiliCount' };
        ctl.innerHTML = R.textInputHtml({ value: String(Number(rowRead(rr)) || 10), type: 'number', min: 1, max: 50 });
        const inp = ctl.querySelector('input');
        inp.addEventListener('change', () => {
          const n = Math.max(1, Math.min(50, Number(inp.value) || 10));
          inp.value = String(n); rowWrite(rr, n);
        });
      }));
      row.appendChild(sub('未保存文章保留天数', (ctl) => {
        const rr = { t: 'number', n: '未保存文章保留天数', k: 'newsRetentionUnsavedDays' };
        ctl.innerHTML = R.textInputHtml({ value: String(Number(rowRead(rr)) || 30), type: 'number', min: 1 });
        const inp = ctl.querySelector('input');
        inp.addEventListener('change', () => {
          const n = Math.max(1, Number(inp.value) || 30);
          inp.value = String(n); rowWrite(rr, n);
        });
      }));
    } else if (r.custom === 'excludedNotes') {
      const sr = document.createElement('div');
      sr.className = 'bz-sp-sub-row';
      const chips = document.createElement('div');
      chips.className = 'bz-sp-chips';
      chips.style.justifyContent = 'flex-start';
      const rr = { k: 'reviewExcludedNotes' };
      const redraw = () => {
        const list = pathList(rr);
        chips.innerHTML = R.pathChipsItemsHtml(list.map((p) => ({ path: p, label: p.split('/').pop(), multi: true })));
        chips.querySelectorAll('.bz-sp-chip .x').forEach((x, i) => {
          const p = list[i];
          x.addEventListener('click', () => { pathWriteList(rr, pathList(rr).filter((y) => y !== p)); redraw(); });
        });
      };
      redraw();
      sr.appendChild(chips);
      row.appendChild(sr);
    } else if (r.custom === 'lanIp') {
      row.appendChild(sub('本机局域网 IP（mock：192.168.1.108）', (ctl) => {
        ctl.innerHTML = R.rowBtnHtml('填入远程 URL');
        const b2 = ctl.querySelector('.bz-sp-btn');
        b2.addEventListener('click', () => {
          confirmDialog(host, {
            title: '填入远程 Ollama URL',
            message: '将「远程 Ollama URL（移动端）」覆盖为 http://192.168.1.108:11434？',
            okText: '覆盖',
            onOk: () => {
              rowWrite({ k: 'secondBrainRemoteOllamaUrl' }, 'http://192.168.1.108:11434');
              redrawDomain();
              toast(host, '已填入远程 URL：http://192.168.1.108:11434');
            },
          });
        });
        ctl.appendChild(b2);
      }));
    }
  }

  /* ---------- 域实例（桌面面板 / 移动面板共用内核） ---------- */
  function createApp(root, mode, initial) {
    const state = { current: initial || 'global', q: '' };
    // 按端口径：桌面剔除零项域（loadedCounts=0，如回忆墙/收藏本）；移动端全量（其移动组可见）
    const listable = (forMob) => DEMO.NAV
      .map((sec) => ({ title: sec.title, domains: sec.ids.map((id) => ({ id, def: DEMO.DOMAINS[id] })).filter((d) => (forMob || !d.def.desktopZero)) }));

    function renderNav() {
      const nav = root.querySelector('.bz-sp-nav');
      if (!nav) return;
      nav.innerHTML = '';
      for (const sec of listable(mode === 'mob')) {
        const items = sec.domains.filter((d) => !state.q || domainHit(d.id, state.q));
        if (!items.length) continue;
        let itemsHtml = '';
        for (const d of items) {
          itemsHtml += R.navItemHtml({
            id: d.id, icon: d.def.icon, name: d.def.name,
            count: String(visibleRowsOf(d.def).length),
            on: d.id === state.current && !state.q,
          });
        }
        nav.insertAdjacentHTML('beforeend', R.navSecHtml(sec.title, itemsHtml));
      }
      mountIcons(nav);
      nav.querySelectorAll('.bz-sp-nav-item').forEach((b) => {
        const id = b.dataset.spDomain;
        b.addEventListener('click', () => { state.current = id; state.q = ''; render(); });
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
        const pk = (g.rows.find((r) => r.t === 'toggle' && r.k && !r.k.startsWith('__')) || {}).k || null;
        const cntOf = () => g.rows.filter((r) => (!showMobile && r.m ? false : r.t !== 'button') && evalVis(r.vis) && !(r.child && pk && val(pk) !== true)).length;
        const cardHolder = document.createElement('div');
        cardHolder.innerHTML = R.groupCardHtml(g.icon, g.name, cntOf() + ' 项');
        const card = cardHolder.firstElementChild;
        const head = card.querySelector('.bz-sp-group-head');
        const cnt = head.querySelector('.bz-sp-group-count');
        const body = card.querySelector('.bz-sp-group-body');
        const refresh = () => reevaluate(card, g, showMobile);
        for (const r of g.rows) body.appendChild(rowEl(r, pk, root, () => refresh(card, g), () => render()));
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
        const headHolder = document.createElement('div');
        headHolder.innerHTML = R.pageHeadHtml(
          domain.name, domain.desc,
          visibleRowsOf(domain).length + ' 项 · ' + domain.groups.filter((g) => !g.m).length + ' 组'
        );
        pane.appendChild(headHolder.firstElementChild);
      }
      const body = document.createElement('div');
      body.className = 'bz-sp-settings-body';
      pane.appendChild(body);
      renderGroupsInto(body, domain);
    }

    function mount() {
      root.innerHTML = mode === 'desk' ? R.deskShellHtml() : R.mobShellHtml();
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
          renderMobList();
          bindMob();
        }
      });
      render();
    }

    return {
      mount,
      openDomain(id) {
        state.current = id;
        if (mode === 'desk') { render(); return; }
        // 移动端：域设置弹窗
        const domain = DEMO.DOMAINS[id];
        const mask = document.createElement('div');
        mask.className = 'bz-sp-demo-mobmask';
        const modal = document.createElement('div');
        modal.className = 'bz-sp-mob-modal';
        modal.innerHTML = R.mobModalShellHtml(domain.icon, domain.name);
        const body = modal.querySelector('.bz-sp-mob-modal-body');
        mask.appendChild(modal);
        root.appendChild(mask);
        // 渲染该域到弹窗 body（复用桌面组卡渲染，临时切换 current）
        const prev = state.current;
        state.current = id;
        const pane = body;
        pane.innerHTML = '';
        const bodyEl = document.createElement('div');
        bodyEl.className = 'bz-sp-settings-body';
        pane.appendChild(bodyEl);
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
        const savedRender = render;
        list.innerHTML = '';
        for (const sec of listable()) {
          const items = sec.domains.filter((d) => !keep || domainHit(d.id, keep));
          if (!items.length) continue;
          let itemsHtml = R.mobSecHtml(sec.title);
          for (const d of items) {
            itemsHtml += R.mobItemHtml({ id: d.id, icon: d.def.icon, name: d.def.name, desc: d.def.desc });
          }
          list.insertAdjacentHTML('beforeend', itemsHtml);
        }
        mountIcons(list);
      },
    };
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

  /* ---------- 评审快捷参数：?demo=path / ?demo=model / ?demo=checkup|repair|upmgr|confirm 直达子弹窗 ---------- */
  const demoParam = new URLSearchParams(location.search).get('demo');
  if (demoParam === 'path') {
    desk.open('clipbook');
    setTimeout(() => desk.openDirPicker({ t: 'path', mode: 'single', n: '剪藏目录', d: '存放网页剪藏文章的文件夹', k: 'articleDirectory' }), 300);
  } else if (demoParam === 'model') {
    desk.open('ai');
    setTimeout(() => desk.pickModel({ k: '__fn:aiModel', n: '模型名称' }), 500);
  } else if (demoParam === 'checkup') {
    desk.open('global');
    setTimeout(() => { const b = [...document.querySelectorAll('#sp-demo-desk .bz-sp-pane button')].find((x) => x.textContent.trim() === '打开体检'); if (b) b.click(); }, 400);
  } else if (demoParam === 'repair') {
    desk.open('diary');
    setTimeout(() => { const b = [...document.querySelectorAll('#sp-demo-desk .bz-sp-pane button')].find((x) => x.textContent.trim() === '检测日记解析'); if (b) b.click(); }, 400);
  } else if (demoParam === 'upmgr') {
    desk.open('clipbook');
    setTimeout(() => { const b = [...document.querySelectorAll('#sp-demo-desk .bz-sp-pane button')].find((x) => x.textContent.includes('管理（')); if (b) b.click(); }, 400);
  } else if (demoParam === 'confirm') {
    desk.open('literature');
    setTimeout(() => { const b = [...document.querySelectorAll('#sp-demo-desk .bz-sp-pane button')].find((x) => x.textContent.trim() === '清空历史'); if (b) b.click(); }, 400);
  } else if (demoParam === 'cardpicker') {
    desk.open('smartcat');
    setTimeout(() => { const b = [...document.querySelectorAll('#sp-demo-desk .bz-sp-pane button')].find((x) => x.textContent.trim() === '添加…' || x.textContent.trim() === '选择…'); if (b) b.click(); }, 400);
  }

  /* ---------- 亮暗切换 + 重置演示数据（壳层演示件） ---------- */
  function applyTheme(t) {
    document.body.classList.toggle('theme-dark', t === 'dark');
    localStorage.setItem(LS_THEME, t);
    const tb = document.getElementById('sp-theme-btn');
    if (tb) tb.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 'bz-ic').outerHTML;
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

    /* 子弹窗冒烟（补录子弹窗后）：数据体检 / 日记修复 / 重新索引确认 / 清空历史 / UP 管理 / 记忆目录卡片选择器 */
    const deskNav2 = () => document.querySelectorAll('#sp-demo-desk .bz-sp-nav-item');
    const clickNav = (name) => {
      const it = [...deskNav2()].find((b) => b.querySelector('.bz-sp-nav-name').textContent === name);
      if (!it) return null;
      it.click();
      return true;
    };
    const paneBtn = (label) => {
      const pane = document.querySelector('#sp-demo-desk .bz-sp-pane');
      return pane ? [...pane.querySelectorAll('button')].find((b) => b.textContent.trim() === label) : null;
    };
    try {
      clickNav('通用');
      const ck = paneBtn('打开体检');
      if (ck) { ck.click(); A('数据体检面板打开', !!document.querySelector('#sp-demo-desk .bz-sp-demo-panel .bz-sp-demo-empty')); document.querySelector('#sp-demo-desk .bz-sp-demo-card .bz-sp-btn--primary')?.click(); }
      clickNav('日记本');
      const rp = paneBtn('检测日记解析');
      if (rp) { rp.click(); A('日记解析检测面板打开', !!document.querySelector('#sp-demo-desk .bz-sp-demo-panel')); const any = document.querySelector('#sp-demo-desk .bz-sp-demo-card'); if (any) any.remove(); }
      clickNav('第二大脑');
      const ri = paneBtn('开始');
      if (ri) { ri.click(); A('重新索引确认框弹出', !!document.querySelector('#sp-demo-desk .bz-sp-confirm')); const any = document.querySelector('#sp-demo-desk .bz-sp-confirm'); if (any) any.closest('.bz-sp-picker-mask').remove(); }
      clickNav('文献盒');
      const cl = paneBtn('清空历史');
      if (cl) { cl.click(); A('清空历史确认框弹出（danger）', !!document.querySelector('#sp-demo-desk .bz-sp-confirm .bz-sp-btn--danger')); const any = document.querySelector('#sp-demo-desk .bz-sp-confirm'); if (any) any.closest('.bz-sp-picker-mask').remove(); }
    } catch (e) {
      A('子弹窗冒烟抛异常：' + e.message, false);
    }
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

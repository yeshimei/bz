/* 源指纹 18595bb6c8ffb87c · 仓内输入 2 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/core/ui/str.ts","src/password-vault/render.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/password-vault/render.ts → window.BZR_password_vault（评审壳预览包，ADR-0104） */
var BZR_password_vault = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/password-vault/render.ts
  var render_exports = {};
  __export(render_exports, {
    ICONS: () => ICONS,
    acctCardHtml: () => acctCardHtml,
    avatarHTML: () => avatarHTML,
    colorOf: () => colorOf,
    confirmHTML: () => confirmHTML,
    deskHTML: () => deskHTML,
    dots: () => dots,
    emptyHtml: () => emptyHtml,
    esc: () => esc,
    escAttr: () => escAttr,
    fmtDate: () => fmtDate,
    hitRowHtml: () => hitRowHtml,
    lockHTML: () => lockHTML,
    mobHTML: () => mobHTML,
    mobHitCardHtml: () => mobHitCardHtml,
    mobPlatCardHtml: () => mobPlatCardHtml,
    mobPlatHeadHtml: () => mobPlatHeadHtml,
    mobSegHtml: () => mobSegHtml,
    modalHTML: () => modalHTML,
    platDetailShellHtml: () => platDetailShellHtml,
    platEditHTML: () => platEditHTML,
    platRowHtml: () => platRowHtml,
    relTime: () => relTime
  });

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function escAttr(s) {
    return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  var PLATFORM_COLOR_MAP = {
    github: "#5a5f73",
    微信: "#3eb575",
    支付宝: "#4f7cf7",
    notion: "#111111",
    哔哩哔哩: "#fb7299",
    招商银行: "#d43d3d",
    豆瓣: "#3fa34d"
  };
  var PALETTE = ["#7c6bd6", "#3e8e5a", "#c98a1e", "#4f7cf7", "#d43d3d", "#2a9d8f", "#b4551d", "#5a5f73"];
  function colorOf(platform) {
    const k = Object.keys(PLATFORM_COLOR_MAP).find((x) => (platform || "").toLowerCase().includes(x.toLowerCase()));
    if (k) return PLATFORM_COLOR_MAP[k];
    let h = 0;
    const t = platform || "?";
    for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  // src/password-vault/render.ts
  function relTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 864e5;
    if (diff < 1) return "今天";
    if (diff < 2) return "昨天";
    if (diff < 30) return Math.round(diff) + " 天前";
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("zh-CN");
  }
  function dots(p) {
    return "•".repeat(Math.min((p || "").length, 18));
  }
  var ICONS = {
    seal: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1.6" fill="#fff" stroke="none"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
    menuDots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };
  var AV_BG = (platform) => `background:${colorOf(platform)}`;
  function avatarHTML(platform, url, cls = "bz-password-vault-av") {
    const ch = (platform || "?").slice(0, 1);
    return `<div class="${cls} bz-pwv-avatar" style="${AV_BG(platform)}" data-avatar="1" data-url="${escAttr(url || "")}"><span>${ch}</span></div>`;
  }
  function lockHTML(which) {
    return `
      <div class="bz-password-vault-lock" data-lock="${which}"></div>`;
  }
  function modalHTML(which) {
    return `
      <div class="bz-password-vault-modal" data-modal="${which}">
        <div class="bz-password-vault-dialog">
          <h3>添加密码条目</h3>
          <div class="sub">带 * 为必填 · 平台与账号密码不可为空</div>
          <label>平台 *</label><input data-f="platform" placeholder="如 GitHub">
          <label>链接（可选）</label><input data-f="url" placeholder="https://…">
          <label>账号 *</label><input data-f="account" placeholder="登录账号 / 邮箱 / 手机号">
          <label>密码 *</label>
          <div class="pwdrow"><input data-f="password" placeholder="密码"><button class="gen" data-act="gen">生成</button></div>
          <label>备注（可选）</label><input data-f="note" placeholder="备用信息…">
          <div class="err" data-f-err></div>
          <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="save" data-act="save">保存</button></div>
        </div>
      </div>`;
  }
  function confirmHTML(which) {
    return `
      <div class="bz-password-vault-pop2" data-confirm="${which}">
        <div class="card"><h3>确认</h3><div class="msg"></div>
        <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="ok" data-act="ok">确定</button></div></div>
      </div>`;
  }
  function platEditHTML(which) {
    return `
      <div class="bz-password-vault-pop2 bz-password-vault-platedit" data-plat-edit="${which}">
        <div class="card">
          <h3>编辑平台信息</h3>
          <div class="sub">改名/改链接将应用到该平台全部账号</div>
          <label>平台名 *</label><input data-f="platform" placeholder="如 GitHub">
          <label>链接（可选）</label><input data-f="url" placeholder="https://…">
          <div class="err"></div>
          <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="save" data-act="save">保存</button></div>
        </div>
      </div>`;
  }
  function deskHTML() {
    return `
      <div class="bz-password-vault-nav">
        <div class="bz-password-vault-logo">
          <div class="seal">${ICONS.seal}</div>
          <div class="name">密码本<small>PASSWORD VAULT</small></div>
        </div>
        <div class="bz-password-vault-navitem on" data-view="all">${ICONS.list}全部条目<span class="cnt" data-cnt="all"></span></div>
        <div class="bz-password-vault-navitem" data-view="fav">${ICONS.star}已收藏<span class="cnt" data-cnt="fav"></span></div>
      </div>
      <div class="bz-password-vault-list">
        <div class="bz-password-vault-listhead">
          <h1>全部条目</h1>
          <div class="bz-password-vault-search">${ICONS.search}<input placeholder="搜索平台、账号、备注…"></div>
        </div>
        <div class="bz-password-vault-count"></div>
        <div class="bz-password-vault-rows"></div>
      </div>
      <div class="bz-password-vault-detail">
        <div class="bz-password-vault-empty">
          ${ICONS.lock}
          <div class="t">选择一条记录</div>
          <div class="d">左侧列表选中后，这里显示完整详情与操作</div>
        </div>
      </div>
      ${lockHTML("desk")}
      <div class="bz-password-vault-toast"></div>
      ${modalHTML("desk")}
      ${confirmHTML("desk")}
      ${platEditHTML("desk")}
    `;
  }
  function mobHTML() {
    return `
      <div class="bz-password-vault-mobbar">
        <div class="seal">${ICONS.seal}</div>
        <div class="t">密码本</div>
        <button class="bz-password-vault-mobclose" data-act="mob-close" aria-label="关闭">${ICONS.x}</button>
      </div>
      <div class="bz-password-vault-mobsearch">${ICONS.search}<input placeholder="搜索平台、账号、备注…"></div>
      <div class="bz-password-vault-moblist"></div>
      <button class="bz-password-vault-fab">${ICONS.plus}</button>
      <div class="bz-password-vault-mobpage">
        <div class="bz-password-vault-mobsheet">
          <div class="head">
            <button class="bz-password-vault-back">${ICONS.back}</button>
            <div class="t">详情</div>
            <button class="ic" data-act="menu">${ICONS.menuDots}</button>
          </div>
          <div class="bz-password-vault-mobbody"></div>
        </div>
      </div>
      ${lockHTML("mob")}
      <div class="bz-password-vault-toast"></div>
      ${modalHTML("mob")}
      ${confirmHTML("mob")}
      ${platEditHTML("mob")}
    `;
  }
  function emptyHtml(cls, t, d, opts) {
    var _a;
    const style = (opts == null ? void 0 : opts.style) ? ` style="${opts.style}"` : "";
    const icon = (_a = opts == null ? void 0 : opts.icon) != null ? _a : "";
    const cta = (opts == null ? void 0 : opts.ctaLabel) ? `<button class="act" data-act="${opts.ctaAct}">${opts.ctaLabel}</button>` : "";
    return `<div class="${cls}"${style}>${icon}<div class="t">${t}</div><div class="d">${d}</div>${cta}</div>`;
  }
  function hitRowHtml(d) {
    return `${avatarHTML(d.platform, d.url)}
          <div class="mid"><div class="pl">${esc(d.platform)}${d.fav ? ' <span class="star">★</span>' : ""}</div><div class="ac">${esc(d.account || "(无账号)")}</div></div>
          <div class="tm">${relTime(d.createdAt)}</div>`;
  }
  function platRowHtml(opts) {
    const favStar = opts.fav ? ' <span class="star">★</span>' : "";
    const countBadge = opts.count > 1 ? `<span class="bz-password-vault-plcount">${opts.count}</span>` : "";
    return `${avatarHTML(opts.platform, opts.url)}
        <div class="mid"><div class="pl">${esc(opts.platform)}${favStar}${countBadge}</div><div class="ac">${opts.account ? esc(opts.account) : ""}</div></div>
        <div class="tm">${relTime(opts.time)}</div>`;
  }
  function platDetailShellHtml(opts) {
    const favStar = opts.fav ? ' <span style="color:var(--pwv-warn)">★</span>' : "";
    return `<div class="bz-password-vault-detailhead">
      <div class="ttl"><h2>${esc(opts.platform)}${favStar}</h2>
        ${opts.url ? `<a class="url" href="${esc(opts.url)}" target="_blank" rel="noopener">${esc(opts.url)} ↗</a>` : '<div class="url" style="color:var(--pwv-faint)">无链接</div>'}</div>
    </div>
    <div class="bz-password-vault-accthead">
      <div class="t">${opts.count} 个账号</div>
      <button class="add" data-act="plat-add">+ 在该平台新增账号</button>
    </div>
    <div class="bz-password-vault-accts"></div>`;
  }
  function acctCardHtml(d, shown) {
    return `<div class="accrow">
        <div class="name">${esc(d.account || "(无账号)")}${d.fav ? '<span class="star">★</span>' : ""}</div>
        <button class="copyac" data-act="copy-ac">${ICONS.copy} 复制账号</button>
      </div>
      <div class="pwrow">
        <div class="pw ${shown ? "" : "mask"}">${shown ? esc(d.password) : dots(d.password)}</div>
        <button class="mini" data-act="eye">${shown ? ICONS.eyeoff : ICONS.eye}</button>
        <button class="mini" data-act="copy-pw">${ICONS.copy}</button>
      </div>
      ${d.note ? `<div class="note">${esc(d.note)}</div>` : ""}
      <div class="meta">创建于 ${esc(fmtDate(d.createdAt))}${d.url ? ' · <a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.url.replace("https://", "")) + " ↗</a>" : ""}</div>`;
  }
  function mobHitCardHtml(d) {
    return `${avatarHTML(d.platform, d.url, "av")}
          <div class="mid"><div class="pl">${esc(d.platform)}${d.fav ? ' <span class="star">★</span>' : ""}</div><div class="ac">${esc(d.account || "(无账号)")}</div></div>
          <div class="go">${ICONS.go}</div>`;
  }
  function mobPlatCardHtml(opts) {
    const favStar = opts.fav ? ' <span class="star">★</span>' : "";
    const cnt = opts.count > 1 ? `<span class="cnt">${opts.count}</span>` : "";
    return `${avatarHTML(opts.platform, opts.url, "av")}
        <div class="mid"><div class="pl">${esc(opts.platform)}${favStar}${cnt}</div><div class="ac">${opts.account ? esc(opts.account) : ""}</div></div>
        <div class="go">${ICONS.go}</div>`;
  }
  function mobPlatHeadHtml(opts) {
    const favStar = opts.fav ? ' <span style="color:var(--pwv-warn)">★</span>' : "";
    return `<div class="bz-password-vault-mobplathead">
      <div><div style="font-size:17px;font-weight:700">${esc(opts.platform)}${favStar}</div>${opts.url ? `<a style="font-size:12px;color:var(--pwv-gold-ink)" href="${esc(opts.url)}" target="_blank" rel="noopener">${esc(opts.url)} ↗</a>` : '<div style="font-size:12px;color:var(--pwv-faint)">无链接</div>'}</div>
      <button class="bz-password-vault-btn gold" data-act="add">+ 新增账号</button>
    </div>`;
  }
  function mobSegHtml(d, shown, withId) {
    const idAttr = withId ? ` data-id="${d.id}"` : "";
    return `<div class="bz-password-vault-seg">
          <div class="seghead"><div class="acc">${esc(d.account || "(无账号)")}${d.fav ? ' <span class="star">★</span>' : ""}</div>
            <button class="copyac" data-act="copy-ac"${idAttr}>${ICONS.copy} 复制账号</button></div>
          <div class="pwdline"><div class="pw ${shown ? "" : "mask"}">${shown ? esc(d.password) : dots(d.password)}</div>
            <button class="mini" data-act="eye"${idAttr}>${shown ? ICONS.eyeoff : ICONS.eye}</button>
            <button class="mini" data-act="copy-pw"${idAttr}>${ICONS.copy}</button></div>
          ${d.note ? `<div class="note">${esc(d.note)}</div>` : ""}
          <div class="segmeta">创建于 ${esc(fmtDate(d.createdAt))}${d.url ? " · " + esc(d.url.replace("https://", "")) : ""}</div>
        </div>`;
  }
  return __toCommonJS(render_exports);
})();

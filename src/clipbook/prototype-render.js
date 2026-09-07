/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/clipbook/render.ts → window.BZR_clipbook（评审壳预览包，ADR-0104） */
var BZR_clipbook = (() => {
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

  // src/clipbook/render.ts
  var render_exports = {};
  __export(render_exports, {
    ICO: () => ICO,
    clipLoadingHtml: () => clipLoadingHtml,
    dotHtml: () => dotHtml,
    esc: () => esc,
    iconSpan: () => iconSpan,
    mobChipHtml: () => mobChipHtml,
    mobDetailHtml: () => mobDetailHtml,
    mobListHtml: () => mobListHtml,
    panelHtml: () => panelHtml,
    paragraphsHtml: () => paragraphsHtml,
    railFootHtml: () => railFootHtml,
    railItemHtml: () => railItemHtml,
    readerHtml: () => readerHtml,
    siteShort: () => siteShort,
    siteTint: () => siteTint,
    stateFlag: () => stateFlag,
    stateLabel: () => stateLabel,
    summaryHtml: () => summaryHtml,
    tocListHtml: () => tocListHtml
  });

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }

  // src/clipbook/render.ts
  var ICO = {
    inbox: "inbox",
    feed: "rss",
    clip: "scissors",
    bili: "play-square",
    mail: "mail",
    book: "book-open",
    check: "check",
    download: "download",
    external: "external-link",
    trash: "trash-2",
    search: "search",
    x: "x",
    arrow: "arrow-left",
    link: "link",
    globe: "globe",
    folder: "folder-open",
    rotate: "rotate-ccw",
    radio: "radio"
  };
  function panelHtml() {
    return `
    <div class="bz-panel-frame bz-clip-frame bz-panel-mtop">
      <!-- 桌面三栏 -->
      <div class="bz-clip-desk">
        <div class="bz-panel-head bz-panel-head--tall">
          <div class="bz-panel-title">剪藏本</div>
          <div class="bz-panel-head-sp"></div>
          <div class="bz-clip-issue" data-clip-issue></div>
          <div class="bz-clip-head-search bz-search">${iconSpan(ICO.search)}<input class="bz-input" type="text" data-clip-desk-search placeholder="检索标题、摘要、站点…"></div>
        </div>
        <div class="bz-clip-desk-body">
          <div class="bz-rail bz-rail--wide bz-clip-rail">
            <div class="bz-clip-rail-label">SITE 站点</div>
            <div class="bz-rail-scroll" data-clip-rail></div>
            <div class="bz-clip-rail-foot" data-clip-rail-foot></div>
          </div>
          <div class="bz-clip-mid">
            <div class="bz-clip-toc-head">目录</div>
            <div class="bz-clip-list" data-clip-list></div>
          </div>
          <div class="bz-clip-read" data-clip-read-pane tabindex="0">
            <div class="bz-clip-read-scroll"><div class="bz-clip-read-body" data-clip-reader></div></div>
          </div>
        </div>
      </div>
      <!-- 移动双屏 -->
      <div class="bz-clip-mob" data-clip-mob>
        <div class="bz-clip-mob-top">
          <div class="bz-clip-mob-title">剪藏本</div>
          <button class="bz-icon-btn bz-icon-btn--lg" data-clip-mob-search title="搜索">${iconSpan(ICO.search)}</button>
          <button class="bz-icon-btn bz-icon-btn--lg bz-icon-btn--close" data-clip-mob-close title="关闭">${iconSpan(ICO.x)}</button>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="搜索标题、摘要、站点、标签">
        </div>
        <div class="bz-mobstrip" data-clip-mob-sources></div>
        <div class="bz-clip-mob-list" data-clip-mob-list></div>
      </div>
      <!-- 移动详情 overlay（屏2） -->
      <div class="bz-clip-mob-detail bz-panel-mtop" data-clip-mob-detail style="display:none">
        <div class="bz-clip-mob-detail-top">
          <button class="bz-icon-btn bz-icon-btn--lg" data-clip-mob-back title="返回">${iconSpan(ICO.arrow)}</button>
          <div class="bz-clip-mob-detail-title" data-clip-mob-title></div>
          <button class="bz-clip-mob-save" data-clip-mob-save title="保存到剪藏本">${iconSpan(ICO.download, "bz-ic--sm")}</button>
        </div>
        <div class="bz-clip-mob-detail-body" data-clip-mob-detail-body></div>
      </div>
    </div>
  `;
  }
  function siteShort(s) {
    return String(s || "").replace("果壳科学人", "果壳");
  }
  function siteTint(site) {
    let h = 0;
    const t = String(site || "");
    for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) >>> 0;
    return `hsl(${h % 360}, 42%, 52%)`;
  }
  function dotHtml(st) {
    return `<span class="bz-clip-dot ${st}"></span>`;
  }
  function stateFlag(st) {
    if (st === "saved") return { icon: ICO.check, cls: "ok" };
    if (st === "reading") return { icon: ICO.book, cls: "warn" };
    return { icon: ICO.mail, cls: "info" };
  }
  function stateLabel(st) {
    return st === "saved" ? "已保存" : st === "reading" ? "在读" : st === "read" ? "已读" : "未读";
  }
  function railItemHtml(sel, label, unread, total, icon, color, active, sub) {
    const badge = icon === "feed" ? `<span class="bz-rail-badge" style="--bz-rail-tint:${color || "#58a6ff"}">${esc(sub || label.slice(0, 1))}</span>` : icon === "bili" ? `<span class="bz-rail-badge bili">${esc(sub || label.slice(0, 1))}</span>` : icon === "clip" ? `<span class="bz-rail-ic">${iconSpan("scissors")}</span>` : `<span class="bz-rail-ic${sel.kind === "all" ? " bz-rail-ic--accent" : ""}">${icon ? iconSpan(icon) : ""}</span>`;
    const count = `<span class="bz-rail-count">${unread > 0 ? `<b>${unread}</b>` : unread}/${total}</span>`;
    return `
    <div class="bz-rail-item${active ? " on" : ""}" data-src='${esc(JSON.stringify(sel))}' title="${esc(label)}">
      ${badge}
      <span class="bz-rail-name">${esc(label)}</span>
      <span class="bz-clip-lead"></span>
      ${count}
    </div>`;
  }
  function railFootHtml(todayRead) {
    return `今日已读<br><b>${todayRead}</b> 篇`;
  }
  function tocListHtml(list, curId, timeOf) {
    return list.map((a, i) => `
    <div class="bz-clip-item bz-clip-item--${a.st}${curId && curId === a.id ? " on" : ""}" data-id="${esc(a.id)}">
      <span class="bz-clip-no">${String(i + 1).padStart(2, "0")}</span>
      <div class="bz-clip-item-main">
        <div class="bz-clip-item-t"><span>${esc(a.title)}</span></div>
        <div class="bz-clip-item-meta">${esc(siteShort(a.srcName))} · ${esc(timeOf(a))}</div>
      </div>
    </div>`).join("");
  }
  function paragraphsHtml(paras, resolveImg) {
    return paras.map((p) => {
      if (p.type === "img") {
        const src = resolveImg(p.text);
        return src ? `<img class="bz-clip-art-img" src="${esc(src)}" alt="文章配图" loading="lazy">` : "";
      }
      return p.type === "quote" ? `<blockquote>${esc(p.text)}</blockquote>` : `<p>${esc(p.text)}</p>`;
    }).join("");
  }
  function summaryHtml(summary) {
    return `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan("sparkles", "bz-ic--xs")}摘要</span>${esc(summary)}</div>`;
  }
  function clipLoadingHtml() {
    return `<p class="dim">正在读取剪藏正文…</p>`;
  }
  function readerHtml(a, opts) {
    const openNoteFoot = a.origin === "clip" && a.notePath ? `<div class="bz-clip-art-foot"><span role="button" tabindex="0" data-clip-open-note>打开笔记 ${iconSpan(ICO.external, "bz-ic--xs")}</span></div>` : "";
    return `
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(opts.time)}</span>
      <span class="bz-clip-art-site"><span class="bz-clip-art-site-name">${esc(siteShort(a.srcName))}</span></span>
      <span class="bz-clip-art-state">${stateLabel(a.st)}</span>
    </div>
    <div class="bz-clip-art-fs" data-clip-fs></div>
    ${a.summary ? summaryHtml(a.summary) : ""}
    <div class="bz-clip-art-md" data-clip-md>${opts.paras || `<p class="dim">${esc(a.origin === "clip" ? "（笔记暂无正文）" : "正文已清空（已处理条目）")}</p>`}</div>
    ${openNoteFoot}
  `;
  }
  function mobChipHtml(sel, label, unread, active, icon, sub) {
    return `
    <div class="bz-mobstrip-chip${active ? " is-on" : ""}" data-src='${esc(JSON.stringify(sel))}'>
      ${icon === "feed" ? `<span class="bz-clip-favchip sm">${esc(sub || label.slice(0, 1))}</span>` : ""}
      <span>${esc(label)}</span>
      ${unread ? `<span class="bz-badge bz-badge--brand">${unread}</span>` : ""}
    </div>`;
  }
  function mobListHtml(list, timeOf) {
    return list.map((a) => `
    <div class="bz-clip-mob-item" data-id="${esc(a.id)}">
      <div class="bz-clip-item-t">${dotHtml(a.st)}<span>${esc(a.title)}</span></div>
      ${a.summary ? `<div class="bz-clip-item-sum">${esc(a.summary)}</div>` : ""}
      <div class="bz-clip-item-meta"><span>${esc(a.srcName)}</span><span class="bz-clip-item-time">${esc(timeOf(a))}</span></div>
    </div>`).join("");
  }
  function mobDetailHtml(a, opts) {
    const flag = stateFlag(a.st);
    return `
    <div class="bz-clip-mob-d-title">${esc(a.title)}</div>
    <div class="bz-clip-mob-d-meta"><span class="bz-clip-favchip">${esc(a.srcName.slice(0, 1))}</span><span>${esc(a.srcName)}</span><span class="bz-clip-mob-d-time">${esc(opts.time)}</span></div>
    <div class="bz-clip-art-flag ${flag.cls}">${iconSpan(flag.icon, "bz-ic--xs")}${stateLabel(a.st)}</div>
    ${a.summary ? summaryHtml(a.summary) : ""}
    <div class="bz-clip-art-md">${opts.paras || `<p class="dim">${esc(a.origin === "clip" ? "（剪藏笔记正文请在 Obsidian 中打开）" : "正文已清空")}</p>`}</div>
  `;
  }
  return __toCommonJS(render_exports);
})();

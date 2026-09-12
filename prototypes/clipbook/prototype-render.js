/* 源指纹 f2aded306ae8f7b1 · 仓内输入 2 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/clipbook/render.ts","src/core/ui/str.ts"]*/
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
    deskFoldRowHtml: () => deskFoldRowHtml,
    dotHtml: () => dotHtml,
    esc: () => esc,
    foldBodyHtml: () => foldBodyHtml,
    iconSpan: () => iconSpan,
    mobChHeadHtml: () => mobChHeadHtml,
    mobDetailHtml: () => mobDetailHtml,
    mobFoldBodyHtml: () => mobFoldBodyHtml,
    mobFoldHtml: () => mobFoldHtml,
    mobListHtml: () => mobListHtml,
    mobNoHitHtml: () => mobNoHitHtml,
    mobTocHtml: () => mobTocHtml,
    panelHtml: () => panelHtml,
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
          <span class="bz-clip-mob-act" data-clip-mob-search role="button">搜索</span>
          <span class="bz-clip-mob-act" data-clip-mob-close role="button">关闭</span>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="检索标题、摘要、站点…">
        </div>
        <div class="bz-clip-mob-list" data-clip-mob-list></div>
      </div>
      <!-- 移动详情 overlay（屏2） -->
      <div class="bz-clip-mob-detail bz-panel-mtop" data-clip-mob-detail style="display:none">
        <div class="bz-clip-mob-detail-top">
          <span class="bz-clip-mob-d-back" data-clip-mob-back role="button">‹ 返回</span>
          <div class="bz-clip-mob-detail-title" data-clip-mob-title></div>
          <span class="bz-clip-mob-save" data-clip-mob-save role="button">存为剪藏</span>
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
  function deskFoldRowHtml(kind, n, open) {
    const label = kind === "read" ? "已读" : "已收";
    const lab = open ? "收起" : `${label} <b>${n}</b> 篇`;
    return `
    <div class="bz-clip-desk-fold${open ? " on" : ""}" data-desk-fold="${kind}" role="button" aria-expanded="${open}">
      <span class="bz-clip-desk-fold-rule"></span>
      <span class="bz-clip-desk-fold-lab">${lab}</span>
      <span class="bz-clip-desk-fold-ar"></span>
      <span class="bz-clip-desk-fold-rule"></span>
    </div>`;
  }
  function foldBodyHtml(html, open) {
    return html ? `<div class="bz-clip-desk-fold-body"${open ? "" : " hidden"}>${html}</div>` : "";
  }
  function summaryHtml(summary) {
    return `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan("sparkles", "bz-ic--xs")}摘要</span>${esc(summary)}</div>`;
  }
  function readerHtml(a, opts) {
    const openNoteFoot = a.origin === "clip" && a.notePath ? `<div class="bz-clip-art-foot"><span role="button" tabindex="0" data-clip-open-note>打开笔记 ${iconSpan(ICO.external, "bz-ic--xs")}</span></div>` : "";
    return `
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(opts.time)}</span>
      <span class="bz-clip-art-site"><span class="bz-clip-art-site-name">${esc(siteShort(a.srcName))}</span></span>
    </div>
    ${a.summary ? summaryHtml(a.summary) : ""}
    <div class="bz-clip-art-md markdown-rendered" data-clip-md>${opts.note ? `<p class="dim">${esc(opts.note)}</p>` : ""}</div>
    ${openNoteFoot}
  `;
  }
  function mobListHtml(list, timeOf) {
    return list.map((a) => `
    <div class="bz-clip-mob-item ${a.st}" data-id="${esc(a.id)}">
      <span class="bz-clip-mob-dot ${a.st}"></span>
      <span class="bz-clip-mob-ttl">${esc(a.title)}</span>
      ${a.st === "reading" ? '<span class="bz-clip-mob-tag">在读</span>' : ""}
      <span class="bz-clip-mob-time">${esc(timeOf(a))}</span>
    </div>`).join("");
  }
  function mobChHeadHtml(site, unread, readN, savedN) {
    const seg = [];
    if (unread > 0) seg.push(`${unread} 未读`);
    if (readN > 0) seg.push(`${readN} 已读`);
    if (savedN > 0) seg.push(`${savedN} 已收`);
    const cntTxt = seg.join(" · ");
    return `
    <div class="bz-clip-mob-ch-hd" data-src='${esc(JSON.stringify({ kind: "site", site }))}' title="${esc(site)}">
      <span class="bz-clip-mob-ch-name">${esc(site)}</span>
      <span class="bz-clip-mob-ch-n">${cntTxt}</span>
      <span class="bz-clip-mob-ch-rule"></span>
    </div>`;
  }
  function mobFoldHtml(kind, n, open) {
    const label = kind === "read" ? "已读" : "已收";
    return `
    <div class="bz-clip-mob-fold${open ? " on" : ""}" data-fold data-fold-kind="${kind}" role="button" aria-expanded="${open}">
      <span class="bz-clip-mob-fold-rule"></span>
      <span class="bz-clip-mob-fold-lab">${open ? "收起" : `${label} <b>${n}</b> 篇`}</span>
      <span class="bz-clip-mob-fold-ar"></span>
      <span class="bz-clip-mob-fold-rule"></span>
    </div>`;
  }
  function mobFoldBodyHtml(kind, html, open) {
    return html ? open ? `<div class="bz-clip-mob-arch" data-arch-kind="${kind}">${html}</div>` : `<div class="bz-clip-mob-arch" data-arch-kind="${kind}" hidden>${html}</div>` : "";
  }
  function mobTocHtml(chapters, searching, expanded) {
    return chapters.map((ch) => {
      const readOpen = expanded.has("read:" + ch.site);
      const savedOpen = expanded.has("saved:" + ch.site);
      const foldRead = !searching && ch.readN > 0 ? mobFoldHtml("read", ch.readN, readOpen) : "";
      const foldSaved = !searching && ch.savedN > 0 ? mobFoldHtml("saved", ch.savedN, savedOpen) : "";
      const readBody = mobFoldBodyHtml("read", ch.readHtml, searching || readOpen);
      const savedBody = mobFoldBodyHtml("saved", ch.savedHtml, searching || savedOpen);
      return `
      <div class="bz-clip-mob-ch">
        ${mobChHeadHtml(ch.site, ch.unread, ch.readN, ch.savedN)}
        <div class="bz-clip-mob-ch-items">${ch.activeHtml}${foldRead}${readBody}${foldSaved}${savedBody}</div>
      </div>`;
    }).join("");
  }
  function mobNoHitHtml(text) {
    return `<div class="bz-clip-mob-no-hit">${esc(text)}</div>`;
  }
  function mobDetailHtml(a, opts) {
    return `
    <div class="bz-clip-mob-d-kicker"><span>${esc(siteShort(a.srcName))} · ${esc(opts.time)}</span><span>${esc(opts.seq)}</span></div>
    <div class="bz-clip-mob-d-title">${esc(a.title)}</div>
    <hr class="bz-clip-mob-d-rule">
    <div class="bz-clip-mob-d-md markdown-rendered" data-clip-mob-md>${opts.note ? `<p>${esc(opts.note)}</p>` : ""}</div>
    <div class="bz-clip-mob-d-foot"><span class="bz-clip-mob-d-next" data-clip-mob-next>↓ 读下一则</span><span class="bz-clip-mob-d-fch">${esc(siteShort(a.srcName))}</span></div>
  `;
  }
  return __toCommonJS(render_exports);
})();

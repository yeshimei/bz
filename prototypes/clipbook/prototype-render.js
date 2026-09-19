/* 源指纹 7987ebe450c2fc75 · 仓内输入 4 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/clipbook/render.ts","src/clipbook/report-stats.ts","src/core/chart-palette.ts","src/core/ui/str.ts"]*/
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
    buildClipReportSections: () => buildClipReportSections,
    clipReportEntryHtml: () => clipReportEntryHtml,
    clipReportShellHtml: () => clipReportShellHtml,
    clipReportSkeletonHtml: () => clipReportSkeletonHtml,
    deskFoldRowHtml: () => deskFoldRowHtml,
    esc: () => esc,
    foldBodyHtml: () => foldBodyHtml,
    highlightTitleHtml: () => highlightTitleHtml,
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
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }

  // src/core/chart-palette.ts
  var CHART_PASTEL_SERIES = ["#D6E4FF", "#D8F3DC", "#CDF0EA", "#FADDE1", "#FFE5CC", "#E6DFF5"];
  var CHART_RANK_BADGES = ["#FFF3C4", "#D8F3DC", "#D6E4FF"];
  var CHART_HIGHLIGHT = "#FFE5CC";

  // src/clipbook/report-stats.ts
  var REPORT_TOP_N = 5;
  function formatMinutes(min) {
    const m = Math.max(0, Math.round(min));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h <= 0) return `${r} 分钟`;
    return r > 0 ? `${h} 小时 ${r} 分钟` : `${h} 小时`;
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
    radio: "radio",
    checks: "check-check"
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
          <!-- 效率#12：尾部 ✕ 一键清除（有词才显示，ui.ts syncDeskSearchClear 同步）。定位走内联随单源
               markup 两侧生效；图标用内联 SVG——.bz-search .bz-ic 的左缘绝对定位会劫持 iconSpan 产物，
               且 mountIcons 换节点会丢内联样式；不带 display 内联值，hidden 属性才能生效 -->
          <div class="bz-clip-head-search bz-search">${iconSpan(ICO.search)}<input class="bz-input" type="text" data-clip-desk-search placeholder="检索标题、摘要、站点、来源…"><button type="button" class="bz-clip-search-clear" data-clip-search-clear title="清除搜索" aria-label="清除搜索" hidden style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;color:var(--bz-text-3);padding:2px;line-height:0"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
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
          <span class="bz-clip-mob-act" data-clip-mob-report role="button">报告</span>
          <span class="bz-clip-mob-act" data-clip-mob-search role="button">搜索</span>
          <span class="bz-clip-mob-act" data-clip-mob-close role="button">关闭</span>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="检索标题、摘要、站点、来源…">
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
  function stateFlag(st) {
    if (st === "saved") return { icon: ICO.check, cls: "ok" };
    if (st === "reading") return { icon: ICO.book, cls: "warn" };
    return { icon: ICO.mail, cls: "info" };
  }
  function stateLabel(st) {
    return st === "saved" ? "已保存" : st === "reading" ? "在读" : st === "read" ? "已读" : "未读";
  }
  function railItemHtml(sel, label, unread, total, icon, color, active, sub, markAllN = 0) {
    const badge = icon === "feed" ? `<span class="bz-rail-badge" style="--bz-rail-tint:${color || "#58a6ff"}">${esc(sub || label.slice(0, 1))}</span>` : icon === "bili" ? `<span class="bz-rail-badge bili">${esc(sub || label.slice(0, 1))}</span>` : icon === "clip" ? `<span class="bz-rail-ic">${iconSpan("scissors")}</span>` : `<span class="bz-rail-ic${sel.kind === "all" ? " bz-rail-ic--accent" : ""}">${icon ? iconSpan(icon) : ""}</span>`;
    const count = `<span class="bz-rail-count">${unread > 0 ? `<b>${unread}</b>` : unread}/${total}</span>`;
    const markAll = markAllN > 0 ? `<span class="bz-clip-rail-markall" data-clip-rail-markall role="button" aria-label="全部标为已读" title="全部标为已读（${markAllN} 篇）">${iconSpan(ICO.checks, "bz-ic--xs")}</span>` : "";
    return `
    <div class="bz-rail-item${active ? " on" : ""}" data-src='${esc(JSON.stringify(sel))}' title="${esc(label)}">
      ${badge}
      <span class="bz-rail-name">${esc(label)}</span>
      <span class="bz-clip-lead"></span>
      ${markAll}
      ${count}
    </div>`;
  }
  function railFootHtml(todayRead) {
    return `今日已读<br><b>${todayRead}</b> 篇`;
  }
  function clipReportEntryHtml() {
    return `<div class="bz-clp-rep-entry" data-clp-rep-entry role="button" tabindex="0">我读了什么 ${iconSpan("chevron-right", "bz-ic--xs")}</div>`;
  }
  function highlightTitleHtml(title, kw) {
    const safe = esc(title);
    const needle = esc((kw || "").trim()).toLowerCase();
    if (!needle) return safe;
    const hay = safe.toLowerCase();
    let out = "";
    let i = 0;
    for (; ; ) {
      const hit = hay.indexOf(needle, i);
      if (hit === -1) {
        out += safe.slice(i);
        break;
      }
      out += `${safe.slice(i, hit)}<mark>${safe.slice(hit, hit + needle.length)}</mark>`;
      i = hit + needle.length;
    }
    return out;
  }
  function tocTagsHtml(tags) {
    if (!tags.length) return "";
    const shown = tags.slice(0, 2).map((t) => `#${esc(t)}`).join(" ");
    return `<span class="bz-clip-item-tags">${shown}${tags.length > 2 ? " …" : ""}</span>`;
  }
  function tocListHtml(list, curId, timeOf, kw = "") {
    return list.map((a, i) => `
    <div class="bz-clip-item bz-clip-item--${a.st}${curId && curId === a.id ? " on" : ""}" data-id="${esc(a.id)}">
      <span class="bz-clip-no">${pad2(i + 1)}</span>
      <div class="bz-clip-item-main">
        <div class="bz-clip-item-t"><span>${highlightTitleHtml(a.title, kw)}</span></div>
        <div class="bz-clip-item-meta">${esc(siteShort(a.srcName))} · ${esc(timeOf(a))}${tocTagsHtml(a.tags)}</div>
      </div>
    </div>`).join("");
  }
  function deskFoldRowHtml(kind, n, open) {
    const label = kind === "read" ? "已读" : "已收";
    const lab = open ? "收起" : `${label} <b>${n}</b> 篇`;
    return `
    <div class="bz-clip-desk-fold${open ? " on" : ""}" data-desk-fold="${kind}" role="button" tabindex="0" aria-expanded="${open}">
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
  function artTagsHtml(tags) {
    if (!tags.length) return "";
    return `<div class="bz-clip-art-tags">${tags.map((t) => `<span class="bz-clip-art-tag">${esc(t)}</span>`).join("")}</div>`;
  }
  function readerHtml(a, opts) {
    const openNoteFoot = a.origin === "clip" && a.notePath ? `<div class="bz-clip-art-foot"><span role="button" tabindex="0" data-clip-open-note>打开笔记 ${iconSpan(ICO.external, "bz-ic--xs")}</span></div>` : "";
    return `
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(opts.time)}</span>
      <span class="bz-clip-art-site"><span class="bz-clip-art-site-name">${esc(siteShort(a.srcName))}</span></span>
    </div>
    ${artTagsHtml(a.tags)}
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
  function mobChHeadHtml(site, unread, readN, savedN, markAllN = 0) {
    const seg = [];
    if (unread > 0) seg.push(`${unread} 未读`);
    if (readN > 0) seg.push(`${readN} 已读`);
    if (savedN > 0) seg.push(`${savedN} 已收`);
    const cntTxt = seg.join(" · ");
    const mark = markAllN > 0 ? `<span class="bz-clip-mob-ch-mark" data-clip-ch-markall role="button" aria-label="全部标为已读" title="全部标为已读（${markAllN} 篇）">${iconSpan(ICO.checks, "bz-ic--xs")}</span>` : "";
    return `
    <div class="bz-clip-mob-ch-hd" data-src='${esc(JSON.stringify({ kind: "site", site }))}' title="${esc(site)}">
      <span class="bz-clip-mob-ch-name">${esc(site)}</span>
      <span class="bz-clip-mob-ch-n">${cntTxt}</span>
      <span class="bz-clip-mob-ch-rule"></span>
      ${mark}
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
        ${mobChHeadHtml(ch.site, ch.unread, ch.readN, ch.savedN, ch.markAllN || 0)}
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
  function clipReportShellHtml() {
    return `
    <div class="bz-panel-frame bz-clip-report-frame bz-panel-mtop">
      <div class="bz-panel-head">
        <div class="bz-panel-title">我读了什么</div>
        <div class="bz-clp-rep-seg" data-clp-rep-period role="tablist" aria-label="统计周期">
          <button class="bz-clp-rep-seg-btn on" data-period="week" type="button">本周</button>
          <button class="bz-clp-rep-seg-btn" data-period="month" type="button">本月</button>
        </div>
        <div class="bz-panel-head-sp"></div>
        <span class="bz-clp-rep-close" role="button" tabindex="0" data-clp-rep-close title="关闭">${iconSpan(ICO.x)}</span>
      </div>
      <div class="bz-clp-rep-body" data-clp-rep-body></div>
    </div>`;
  }
  function clipReportSkeletonHtml() {
    return `<div class="bz-clp-rep-skeleton">统计中…</div>`;
  }
  function buildClipReportSections(d, opts) {
    return [
      { key: "overview", label: "统计概览", generate: () => clipReportOverviewHtml(d, opts) },
      { key: "sources", label: "来源分布", generate: () => clipReportSourcesHtml(d) },
      { key: "hours", label: "阅读时段", generate: () => clipReportHoursHtml(d) }
    ];
  }
  function clipReportOverviewHtml(d, opts) {
    const keys = (opts == null ? void 0 : opts.availableKeys) || null;
    const topRows = d.topArticles.map((a, i) => {
      const badge = CHART_RANK_BADGES[i % CHART_RANK_BADGES.length];
      const openable = !!keys && keys.has(a.key);
      const openBtn = openable ? `<span class="bz-clp-rep-top-open" data-clip-rep-open role="button" tabindex="0" title="打开该篇回看">打开 ${iconSpan(ICO.external, "bz-ic--xs")}</span>` : "";
      return `
    <div class="bz-clp-rep-top-row"${openable ? ` data-clip-rep-key="${esc(a.key)}"` : ""}>
      <span class="bz-clp-rep-rank" style="background:${badge}">${i + 1}</span>
      <span class="bz-clp-rep-top-title" title="${esc(a.title)}">${esc(a.title)}</span>
      <span class="bz-clp-rep-top-src">${esc(a.src)}</span>
      <span class="bz-clp-rep-top-min">${esc(formatMinutes(a.minutes))}</span>
      ${openBtn}
    </div>`;
    }).join("");
    return `
    <div class="bz-clp-rep-sec">
      <div class="bz-clp-rep-sec-h">统计概览</div>
      <div class="bz-clp-rep-hero">
        <div class="bz-clp-rep-hero-card"><b>${d.articles}</b><span>已读篇数</span></div>
        <div class="bz-clp-rep-hero-card"><b>${esc(formatMinutes(d.totalMinutes))}</b><span>总时长</span></div>
        <div class="bz-clp-rep-hero-card"><b>${d.activeDays}</b><span>活跃天数</span></div>
      </div>
      ${topRows ? `<div class="bz-clp-rep-top"><div class="bz-clp-rep-sub">读得最久</div>${topRows}</div>` : ""}
    </div>`;
  }
  function clipReportSourcesHtml(d) {
    const rows = d.bySrc.slice(0, REPORT_TOP_N);
    if (!rows.length) {
      return `<div class="bz-clp-rep-sec"><div class="bz-clp-rep-sec-h">来源分布</div><p class="bz-clp-rep-none">本期暂无来源数据</p></div>`;
    }
    const max = Math.max(1, ...rows.map((r) => r.minutes));
    const barRows = rows.map((r, i) => {
      const width = Math.max(2, Math.round(r.minutes / max * 100));
      return `
    <div class="bz-clp-rep-bar-row">
      <span class="bz-clp-rep-bar-label" title="${esc(r.name)}">${esc(r.name)}</span>
      <span class="bz-clp-rep-bar-track"><i style="width:${width}%;background:${CHART_PASTEL_SERIES[i % CHART_PASTEL_SERIES.length]}"></i></span>
      <span class="bz-clp-rep-bar-val">${r.articles} 篇 · ${esc(formatMinutes(r.minutes))}</span>
    </div>`;
    }).join("");
    return `
    <div class="bz-clp-rep-sec">
      <div class="bz-clp-rep-sec-h">来源分布</div>
      <div class="bz-clp-rep-bars">${barRows}</div>
    </div>`;
  }
  function clipReportHoursHtml(d) {
    const max = Math.max(0, ...d.hours);
    const cols = d.hours.map((m, h) => {
      const height = max > 0 && m > 0 ? 10 + Math.round(m / max * 44) : 3;
      const accent = max > 0 && m > 0 && m === max;
      const bg = accent ? CHART_HIGHLIGHT : CHART_PASTEL_SERIES[0];
      return `<div class="bz-clp-rep-hcol"><div class="bz-clp-rep-hbar${accent ? " accent" : ""}" style="height:${height}px;background:${bg}" title="${h} 点 · ${esc(formatMinutes(m))}"></div><div class="bz-clp-rep-hlabel">${h}</div></div>`;
    }).join("");
    const peakHour = max > 0 ? d.hours.indexOf(max) : -1;
    const peakText = peakHour >= 0 ? `${peakHour} 点前后` : "暂无";
    return `
    <div class="bz-clp-rep-sec">
      <div class="bz-clp-rep-sec-h">阅读时段</div>
      <div class="bz-clp-rep-hours">${cols}</div>
      <div class="bz-clp-rep-hours-note">每根柱 = 该小时的阅读分钟 · 阅读高峰在 ${peakText}</div>
    </div>`;
  }
  return __toCommonJS(render_exports);
})();

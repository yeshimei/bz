/* 源指纹 5f846ee00d4f25d7 · 仓内输入 5 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/bookshelf/constants.ts","src/bookshelf/layouts/wall/render.ts","src/bookshelf/render.ts","src/bookshelf/shared.ts","src/core/ui/str.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/bookshelf/render.ts → window.BZR_bookshelf（评审壳预览包，ADR-0104） */
var BZR_bookshelf = (() => {
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

  // src/bookshelf/render.ts
  var render_exports = {};
  __export(render_exports, {
    catColor: () => catColor,
    catFilterItems: () => catFilterItems,
    categoryLabel: () => categoryLabel,
    currentSideItems: () => currentSideItems,
    detailBodyHtml: () => detailBodyHtml,
    fitTitle: () => fitTitle,
    getDisplayItems: () => getDisplayItems,
    itemId: () => itemId,
    kwFilter: () => kwFilter,
    labelsHtml: () => labelsHtml,
    packZone: () => packZone,
    panelHtml: () => panelHtml,
    primaryDate: () => primaryDate,
    renderWallInto: () => renderWallInto,
    sortItems: () => sortItems,
    sortSegHtml: () => sortSegHtml,
    spineHTML: () => spineHTML,
    spineVars: () => spineVars,
    statusColor: () => statusColor,
    wallEmptyHTML: () => wallEmptyHTML,
    wallLoadingHTML: () => wallLoadingHTML,
    wallScale: () => wallScale
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

  // src/bookshelf/constants.ts
  var STATUS_UNREAD = "未读";
  var STATUS_READING = "在读";
  var STATUS_DONE = "已读";
  var STATUS_COLORS = {
    [STATUS_UNREAD]: "var(--bz-text-3)",
    [STATUS_READING]: "var(--bz-brand)",
    [STATUS_DONE]: "var(--bz-success)"
  };
  var SORT_LABEL = {
    recent: "最近读完",
    time: "时长最长",
    title: "书名"
  };
  var ICON = {
    report: "bar-chart-3",
    close: "x"
  };
  var EMPTY_BOOKS_ICON = "library-big";
  var EMPTY_SEARCH_ICON = "search-x";
  var EMPTY_FILTER_ICON = "funnel";

  // src/bookshelf/shared.ts
  function statusColor(status) {
    return STATUS_COLORS[status] || "var(--bz-text-3)";
  }
  function itemId(it) {
    var _a, _b, _c, _d;
    return (_d = (_c = (_b = (_a = it.file) == null ? void 0 : _a.path) != null ? _b : it.epubVaultPath) != null ? _c : it.id) != null ? _d : "";
  }
  function primaryDate(it) {
    var _a, _b;
    const d = it.completionDate || it.readingDate;
    if (d) {
      const t = new Date(d).getTime();
      if (!isNaN(t)) return t;
    }
    if ((_b = (_a = it.file) == null ? void 0 : _a.stat) == null ? void 0 : _b.ctime) return it.file.stat.ctime;
    return it.ctime || 0;
  }
  function sortItems(list, key) {
    const sorted = [...list];
    if (key === "title") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh"));
    } else if (key === "time") {
      sorted.sort((a, b) => b.readingTimeMs - a.readingTimeMs || primaryDate(b) - primaryDate(a));
    } else {
      sorted.sort((a, b) => primaryDate(b) - primaryDate(a) || b.readingTimeMs - a.readingTimeMs);
    }
    return sorted;
  }
  function currentSideItems(items, side) {
    if (side === "all") return items;
    const status = side === "reading" ? "在读" : side === "unread" ? "未读" : "已读";
    return items.filter((it) => it.status === status);
  }
  function categoryLabel(it) {
    return it.category || "未分类";
  }
  function catFilterItems(list, cat) {
    if (!cat || cat === "all") return list;
    return list.filter((it) => categoryLabel(it) === cat);
  }
  function kwFilter(list, kw) {
    if (!kw) return list;
    const k = kw.trim().toLowerCase();
    return list.filter((it) => `${it.title} ${it.author || ""} ${it.category || ""}`.toLowerCase().includes(k));
  }
  function getDisplayItems(items, view) {
    let list = currentSideItems(items, view.side);
    list = catFilterItems(list, view.catFilter);
    list = kwFilter(list, view.q);
    return sortItems(list, view.sortMode);
  }
  function detailBodyHtml(it, coverSrc) {
    const cover = coverSrc ? `<img src="${esc(coverSrc)}" alt="">` : `<div class="bz-bs-d-cover-ph">${iconSpan("library")}<span>无封面</span></div>`;
    const review = it.bookReview ? `<div class="bz-bs-d-quote">“${esc(it.bookReview)}”</div>` : '<div class="bz-bs-d-quote dim">——尚无书评——</div>';
    const dense = it.highlights + it.thinks;
    const seal = it.status === "已读" ? "讫" : it.status === "在读" ? "阅" : "藏";
    const go = it.status === "在读" ? ` <button type="button" class="bz-bs-d-go" data-bs-d-continue title="继续阅读">继续</button>` : "";
    const hoursText = it.readingTimeFormat || (it.readingTimeMs > 0 ? (it.readingTimeMs / 36e5).toFixed(1) + " 小时" : "—");
    const prog = Math.round(it.progress);
    return `
    <div class="bz-bs-d-pull">已抽出这本书</div>
    <div class="bz-bs-d-card">
      <div class="bz-bs-d-cover">${cover}</div>
      <div class="bz-bs-d-info">
        <h2 class="bz-bs-d-title">${esc(it.title)}</h2>
        <div class="bz-bs-d-sub">${esc(it.author)} · ${esc(it.category || "未分类")}${it.isEpub ? " · EPUB" : ""}</div>
        <div class="bz-bs-d-body">
        ${review}
        <table class="bz-bs-d-ledger">
          <tr><td>状 态</td><td><span class="bz-bs-d-nowrap"><span class="bz-bs-d-stdot" style="background:${statusColor(it.status)}"></span>${esc(it.status)}${go}</span></td></tr>
          <tr><td>累计时长</td><td>${esc(hoursText)}</td></tr>
          <tr><td>起读 · 读完</td><td>${esc(it.readingDate || "—")} · ${esc(it.completionDate || "—")}</td></tr>
          <tr><td>划线 / 想法</td><td>${it.highlights} 条 / ${it.thinks} 条</td></tr>
          ${it.pages ? `<tr><td>页 数</td><td>${it.pages} 页</td></tr>` : ""}
          ${it.wordCount ? `<tr><td>字 数</td><td>${it.wordCount.toLocaleString()} 字</td></tr>` : ""}
        </table>
        <div class="bz-bs-d-meter">
          <div class="cap"><span>阅读进度</span><b class="bz-bs-d-prognum">${prog}%</b></div>
          <div class="bar"><i style="width:${prog}%"></i></div>
        </div>
        <div class="bz-bs-d-meter">
          <div class="cap">批注密度（划线 + 想法 = ${dense}）</div>
          <div class="bar"><i style="width:${Math.min(100, dense / Math.max(10, dense) * 100)}%"></i></div>
        </div>
        <div class="bz-bs-d-seal">${seal}</div>
        </div>
      </div>
    </div>`;
  }

  // src/bookshelf/layouts/wall/render.ts
  var CAT = {
    "文学": { bg: "#8f4a3a", fg: "#f2e4d8" },
    "推理": { bg: "#7a3b52", fg: "#f2dee6" },
    "哲学": { bg: "#4f6f52", fg: "#e9efe6" },
    "科幻": { bg: "#3d5a73", fg: "#e2ecf4" },
    "心理学": { bg: "#5c5273", fg: "#e9e4f2" },
    "摄影": { bg: "#2f4858", fg: "#dbe8f0" },
    "天文学": { bg: "#1f3242", fg: "#c9dde9" },
    "生物学": { bg: "#6d7a3f", fg: "#eef0dc" },
    "龙与地下城": { bg: "#4a3626", fg: "#e8d9b0" },
    "历史": { bg: "#8a6d3b", fg: "#f5ecd8" },
    "武侠": { bg: "#9a5a2f", fg: "#f7ead9" },
    "奇幻": { bg: "#3f5a4a", fg: "#dfeee4" },
    "艺术": { bg: "#6b4a6e", fg: "#efe2f0" },
    "未分类": { bg: "#6b6257", fg: "#ded8ce" }
  };
  var FALLBACKS = ["#8a6d3b", "#4f6f52", "#3d5a73", "#8f4a3a", "#5c5273", "#7a3b52", "#6d7a3f", "#2f4858"];
  function fallbackColor(seed) {
    let h = 0;
    for (const ch of seed) h = h * 31 + (ch.codePointAt(0) || 0) >>> 0;
    return { bg: FALLBACKS[h % FALLBACKS.length], fg: "#f0e8d8" };
  }
  function catColor(cat) {
    return CAT[cat] || fallbackColor(cat);
  }
  function shade(hex, p) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, v + p));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function wallScale(items) {
    return {
      maxHrs: Math.max(36e5, ...items.map((b) => b.readingTimeMs)),
      maxWc: Math.max(1e4, ...items.map((b) => b.wordCount))
    };
  }
  function spineVars(it, scale) {
    const dense = it.highlights + it.thinks;
    const wc = it.wordCount > 0 ? it.wordCount : dense * 800;
    const h = 150 + it.readingTimeMs / scale.maxHrs * 80;
    const th = 22 + Math.sqrt(Math.min(wc, scale.maxWc) / scale.maxWc) * 34;
    const c = it.status === "未读" ? { bg: "#6b6257", fg: "#ded8ce" } : catColor(it.category || "未分类");
    let sh = 0;
    for (const ch of it.title) sh = sh * 31 + (ch.codePointAt(0) || 0) >>> 0;
    const jit = sh % 15 - 7;
    return `height:${Math.round(h)}px;width:${Math.round(th)}px;--c1:${shade(c.bg, jit)};--c2:${c.fg}`;
  }
  function fitTitle(spine, it) {
    const t = spine.querySelector(".bz-bs-spine-title");
    const avail = parseFloat(spine.style.height) - 36;
    let parts = it.title.split(/[:：]/);
    if (parts.length > 2) parts = [parts[0], parts.slice(1).join("：")];
    const fitFs = (n) => Math.max(9, Math.min(14, Math.floor(avail / (1.18 * Math.max(1, n)))));
    const cols = parts.map((p) => ({ p, fs: fitFs([...p].length) }));
    let width = 24;
    for (const c of cols) width += Math.ceil(c.fs * 1.25) + 6;
    t.innerHTML = cols.map((c, i) => `<span class="${i === 0 ? "t-main" : "t-sub"}" style="font-size:${c.fs}px;letter-spacing:${Math.max(1, Math.round(c.fs * 0.18))}px">${esc(c.p)}</span>`).join("");
    spine.style.width = `${Math.min(64, Math.max(parseFloat(spine.style.width), width))}px`;
  }
  function spineHTML(it, scale) {
    const cls = it.status === "已读" ? "read" : it.status === "在读" ? "reading" : "unread";
    return `<div class="bz-bs-spine ${cls}" style="${spineVars(it, scale)}" data-bs-id="${esc(itemId(it))}" data-bs-epub="${it.isEpub ? "1" : ""}" title="${esc(it.title)} · ${esc(it.status)}${it.progress > 0 ? " " + it.progress + "%" : ""}">
    <span class="bz-bs-spine-title"></span>
    ${it.status === "已读" ? '<span class="stamp">讫</span>' : ""}
    ${it.status === "在读" ? '<span class="ribbon"></span>' : ""}
  </div>`;
  }
  function mkBookend() {
    const d = document.createElement("div");
    d.className = "bz-bs-bookend";
    return d;
  }
  function mkSpine(it, scale) {
    const wrap = document.createElement("div");
    wrap.innerHTML = spineHTML(it, scale);
    const sp = wrap.firstElementChild;
    fitTitle(sp, it);
    return sp;
  }
  function packZone(shelf, cat, books, scale) {
    let zone = null;
    const newRow = () => {
      zone = document.createElement("div");
      zone.className = "bz-bs-zone";
      zone.appendChild(mkBookend());
      const dv = document.createElement("div");
      dv.className = "bz-bs-divider";
      dv.textContent = cat + " 区";
      zone.appendChild(dv);
      shelf.appendChild(zone);
    };
    for (let i = 0; i < books.length; i++) {
      if (!zone) newRow();
      const sp = mkSpine(books[i], scale);
      zone.appendChild(sp);
      if (zone.scrollWidth > zone.clientWidth) {
        zone.removeChild(sp);
        if (!zone.querySelector(".bz-bs-spine")) zone.appendChild(sp);
        else {
          i--;
          zone = null;
        }
      }
    }
    zone = null;
  }
  function bzEmptyHtml(icon, title, desc) {
    return `<div class="bz-empty">${iconSpan(icon, "bz-empty-ic")}<div class="bz-empty-title">${esc(title)}</div><div class="bz-empty-desc">${esc(desc)}</div></div>`;
  }
  function wallEmptyHTML(itemsTotal, q, folder, tag) {
    const cfg = !itemsTotal ? { icon: EMPTY_BOOKS_ICON, title: "书库还是空的", desc: `把书籍笔记放进「${folder}」文件夹，并在 frontmatter 添加 tags: ${tag} 标签` } : q ? { icon: EMPTY_SEARCH_ICON, title: "没有找到相关的书", desc: "试试其他关键词，或换一个筛选" } : { icon: EMPTY_FILTER_ICON, title: "这个筛选下还没有书", desc: "换一个状态或分类标签，或用搜索找找" };
    return `<div class="bz-bs-wall-empty">${bzEmptyHtml(cfg.icon, cfg.title, cfg.desc)}</div>`;
  }
  function wallLoadingHTML() {
    return `<div class="bz-bs-wall-empty">${bzEmptyHtml("loader", "正在整理书架…", "")}</div>`;
  }
  function labelsHtml(items, side, catFilter) {
    const statusDefs = [
      { f: "all", n: items.length, t: "全馆藏书" },
      { f: "done", n: items.filter((x) => x.status === "已读").length, t: "已读 · 讫" },
      { f: "reading", n: items.filter((x) => x.status === "在读").length, t: "在读 · 抽出" },
      { f: "unread", n: items.filter((x) => x.status === "未读").length, t: "未读 · 倒叠" }
    ];
    const cats = /* @__PURE__ */ new Map();
    for (const b of items) {
      if (b.status === "未读") continue;
      const k = b.category || "未分类";
      const c = cats.get(k) || { n: 0, ms: 0 };
      c.n++;
      c.ms += b.readingTimeMs;
      cats.set(k, c);
    }
    const catPairs = [...cats.entries()].sort((a, b) => b[1].n - a[1].n);
    const filtering = side !== "all" || catFilter !== "all";
    const html = statusDefs.map((d) => {
      const on = d.f === "all" ? side === "all" && catFilter === "all" : side === d.f;
      const off = filtering && !on && d.f !== "all";
      return `
    <div class="bz-bs-taglabel${on ? " on" : ""}${off ? " off" : ""}" data-bs-side="${d.f}">
      <span class="pin"></span><div class="n">${d.n}</div><div class="t">${d.t}</div>
    </div>`;
    }).join("");
    const catHtml = catPairs.map(([cat, c]) => {
      const hrs = c.ms > 0 ? ` · ${Math.round(c.ms / 36e5)} 时` : "";
      const off = filtering && catFilter !== cat;
      return `<div class="bz-bs-taglabel dim-cat${catFilter === cat ? " on" : ""}${off ? " off" : ""}" data-bs-cat="${esc(cat)}">
      <span class="pin"></span><div class="n">${esc(cat)}</div><div class="t">${c.n} 册${hrs}</div>
    </div>`;
    }).join("");
    return `${html}<div class="bz-bs-cats">${catHtml}</div>`;
  }
  function sortSegHtml(sortMode) {
    return Object.keys(SORT_LABEL).map((k) => `<button type="button" data-bs-sort="${k}"${sortMode === k ? ' class="on"' : ""}>${SORT_LABEL[k]}</button>`).join("");
  }
  function panelHtml(skinClass) {
    return `
    <div class="bz-panel-frame bz-bs-panel bz-panel-mtop ${esc(skinClass)}">
      <div class="bz-bs-wallpage">
      <div class="bz-bs-header">
        <div class="bz-bs-plaque" data-bs-plaque><h1>书库</h1><p>LIBRARY</p></div>
        <div class="bz-bs-labels" id="bz-bs-labels"></div>
      </div>
        <div class="bz-bs-tools">
          <input id="bz-bs-dsearch" class="bz-bs-search" type="text" placeholder="检索书名或作者…" autocomplete="off">
          <div class="bz-bs-seg" id="bz-bs-sortseg"></div>
          <div class="bz-bs-hint" id="bz-bs-hint"></div>
        </div>
        <div class="bz-bs-view bz-bs-view-shelf active">
          <div class="bz-bs-room">
            <div class="bz-bs-shelf" id="bz-bs-shelf"></div>
            <div class="bz-bs-wallnote">—— 书脊的高度是时长，厚度是批注，抽出的是正在进行 ——</div>
          </div>
        </div>
        <div class="bz-bs-view bz-bs-view-report">
          <div class="bz-rr-head">
            <span class="bz-rr-title">${iconSpan(ICON.report, "bz-ic--sm")}阅读分析报告</span>
            <button class="bz-icon-btn bz-rr-close" data-rr-goto-shelf title="返回书库">${iconSpan(ICON.close)}</button>
          </div>
          <div class="bz-rr-content"></div>
        </div>
      </div>
    </div>`;
  }
  function renderWallInto(shelf, opts) {
    var _a;
    const scale = wallScale(opts.all);
    const onShelf = opts.list.filter((b) => b.status !== "未读");
    const unread = opts.list.filter((b) => b.status === "未读");
    shelf.innerHTML = "";
    if (opts.hint) opts.hint.textContent = `${onShelf.length + unread.length} 册在墙`;
    if (!onShelf.length && !unread.length) {
      shelf.innerHTML = wallEmptyHTML(opts.all.length, opts.q, opts.emptyFolder, opts.emptyTag);
      (_a = opts.hooks) == null ? void 0 : _a.mountIcons(shelf);
      return;
    }
    const zones = /* @__PURE__ */ new Map();
    for (const b of onShelf) {
      const k = b.category || "未分类";
      const arr = zones.get(k) || [];
      arr.push(b);
      zones.set(k, arr);
    }
    const sortedZones = [...zones.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [cat, books] of sortedZones) packZone(shelf, cat, books, scale);
    if (unread.length) {
      const zone = document.createElement("div");
      zone.className = "bz-bs-zone";
      const dv = document.createElement("div");
      dv.className = "bz-bs-divider";
      dv.textContent = "倒 叠 区";
      zone.appendChild(dv);
      zone.appendChild(mkBookend());
      for (const b of unread) zone.appendChild(mkSpine(b, scale));
      zone.appendChild(mkBookend());
      shelf.appendChild(zone);
    }
  }
  return __toCommonJS(render_exports);
})();

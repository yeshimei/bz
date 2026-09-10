/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/favorites/render.ts → window.BZR_favorites（评审壳预览包，ADR-0104） */
var BZR_favorites = (() => {
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

  // src/favorites/render.ts
  var render_exports = {};
  __export(render_exports, {
    ICON: () => ICON,
    actionSpecs: () => actionSpecs,
    archivedItems: () => archivedItems,
    boardHtml: () => boardHtml,
    cardHtml: () => cardHtml,
    chipsHtml: () => chipsHtml,
    ctxMenuHtml: () => ctxMenuHtml,
    emptyHtml: () => emptyHtml,
    esc: () => esc,
    filteredItems: () => filteredItems,
    formHtml: () => formHtml,
    hueOf: () => hueOf,
    iconSpan: () => iconSpan,
    localNow: () => localNow,
    panelHtml: () => panelHtml,
    pickChipsHtml: () => pickChipsHtml,
    poolOf: () => poolOf,
    relTime: () => relTime,
    renderBoardInto: () => renderBoardInto,
    renderPanelView: () => renderPanelView,
    renderTagsInto: () => renderTagsInto,
    sheetHtml: () => sheetHtml,
    tagCount: () => tagCount,
    visibleItems: () => visibleItems
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

  // src/favorites/config.ts
  var TAGS = [
    { label: "GitHub", ic: "github" },
    { label: "桌面软件", ic: "app-window" },
    { label: "网站", ic: "globe" },
    { label: "大模型", ic: "brain-circuit" },
    { label: "pi", ic: "keyboard" },
    { label: "Claude", ic: "bot" },
    { label: "skills", ic: "zap" },
    { label: "酒馆", ic: "beer" },
    { label: "DeepSeek Harness", ic: "waypoints" }
  ];

  // src/favorites/shared.ts
  var ICON = {
    close: "x",
    add: "plus",
    open: "external-link",
    pin: "pin",
    pinOff: "pin-off",
    edit: "pencil",
    archive: "archive",
    unarchive: "archive-restore",
    del: "trash-2",
    ai: "sparkles"
  };
  function localNow() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function relTime(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T"));
    if (isNaN(d.getTime())) return s;
    const diff = Date.now() - d.getTime();
    const m = 6e4, h = 36e5, day = 864e5;
    if (diff < m) return "刚刚";
    if (diff < h) return Math.floor(diff / m) + " 分钟前";
    if (diff < day) return Math.floor(diff / h) + " 小时前";
    if (diff < 7 * day) return Math.floor(diff / day) + " 天前";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}-${p(d.getDate())}`;
  }
  function hueOf(label) {
    const m = {
      GitHub: 215,
      桌面软件: 160,
      网站: 30,
      大模型: 265,
      pi: 100,
      Claude: 20,
      skills: 50,
      酒馆: 330,
      "DeepSeek Harness": 195
    };
    return m[label] != null ? m[label] : 200;
  }
  function visibleItems(items) {
    return items.filter((i) => !i.archived);
  }
  function archivedItems(items) {
    return items.filter((i) => !!i.archived);
  }
  function poolOf(items, view) {
    return view.archived ? archivedItems(items) : visibleItems(items);
  }
  function tagCount(items, label) {
    return visibleItems(items).filter((i) => (i.tags || []).includes(label)).length;
  }
  function filteredItems(items, view) {
    let list = poolOf(items, view);
    if (!view.archived && view.tag) list = list.filter((i) => (i.tags || []).includes(view.tag));
    const byTime = (a, b) => (b.created || "").localeCompare(a.created || "") || (b.id || "").localeCompare(a.id || "");
    const base = [...list].sort(byTime);
    const pinned = base.filter((i) => i.pinned);
    const rest = base.filter((i) => !i.pinned);
    return [...pinned, ...rest];
  }
  function cardHtml(it, idx) {
    const pinnedCls = it.pinned ? " bz-fav-pinc" : "";
    const archCls = it.archived ? " bz-fav-arch" : "";
    const hue = hueOf((it.tags || [])[0] || "");
    const tape = "bz-fav-tape" + (idx % 3 ? [" bz-fav-tape--r", " bz-fav-tape--g"][idx % 3 - 1] : "");
    return `<div class="bz-fav-card${pinnedCls}${archCls}" data-fav-id="${esc(it.id)}">
    <span class="${tape}"></span>
    <span class="bz-fav-dot" style="--c:hsl(${hue} 52% 58%)"></span>
    <h3>${esc(it.title || "无标题")}</h3>
    <p>${esc(it.description || "（这张卡只写了个名字）")}</p>
    <div class="bz-fav-ft"><span class="bz-fav-tags-row">${(it.tags || []).map((t) => {
      const h = hueOf(t);
      const ic = (TAGS.find((x) => x.label === t) || { ic: "" }).ic;
      return `<span class="bz-fav-tagb" style="background:hsl(${h} 70% 95%);color:hsl(${h} 45% 42%)">${ic ? iconSpan(ic, "bz-ic--xs") : ""}<span>${esc(t)}</span></span>`;
    }).join("")}</span>
      <span>${esc(relTime(it.created))}</span></div>
  </div>`;
  }
  function emptyHtml() {
    return '<div class="bz-fav-empty">这块板上还没有卡片</div>';
  }
  function actionSpecs(it) {
    const acts = [];
    if ((it.url || "").trim()) acts.push({ icon: ICON.open, label: "打开", act: "open" });
    acts.push({
      icon: it.pinned ? ICON.pinOff : ICON.pin,
      label: it.pinned ? "取消置顶" : "置顶",
      act: "pin"
    });
    acts.push({ icon: ICON.edit, label: "编辑", act: "edit" });
    acts.push(it.archived ? { icon: ICON.unarchive, label: "取消归档", act: "unarchive" } : { icon: ICON.archive, label: "归档", act: "archive" });
    acts.push({ icon: ICON.del, label: "删除", act: "del", danger: true });
    return acts;
  }
  function ctxMenuHtml(acts) {
    return acts.map((a, k) => {
      const last = k === acts.length - 1;
      const btn = `<button data-k="${k}"${a.danger ? ' class="bz-fav-danger"' : ""}>${iconSpan(a.icon, "bz-ic--sm")}<span>${esc(a.label)}</span></button>`;
      return last ? `<div class="bz-fav-ctx-sep"></div>${btn}` : btn;
    }).join("");
  }
  function sheetHtml(it, acts) {
    const hue = hueOf((it.tags || [])[0] || "");
    return `<div class="bz-fav-sh-head"><span class="bz-fav-sh-dot" style="--c:hsl(${hue} 52% 58%)"></span>
    <div><div class="bz-fav-sh-title">${esc(it.title || "无标题")}</div>
    <div class="bz-fav-sh-meta">${esc(relTime(it.created))}${it.pinned ? " · 已置顶" : ""}${it.archived ? " · 已归档" : ""}</div></div></div>
  <div class="bz-fav-sh-acts">${acts.map((a, k) => `<button data-k="${k}"${a.danger ? ' class="bz-fav-danger"' : ""}>${iconSpan(a.icon)}<span>${esc(a.label)}</span></button>`).join("")}</div>`;
  }
  function pickChipsHtml(sel) {
    return TAGS.map(
      (t) => `<button type="button" class="${sel.has(t.label) ? "bz-fav-on" : ""}" data-tag="${esc(t.label)}">${iconSpan(t.ic, "bz-ic--xs")}<span>${esc(t.label)}</span></button>`
    ).join("");
  }
  function formHtml(it) {
    const editing = !!it;
    return `<div class="bz-fav-form">
    <h2>${editing ? "编辑收藏" : "添加收藏"}</h2>
    <div class="bz-fav-fld"><label>标题</label><input id="fz-title" value="${esc(it ? it.title : "")}" placeholder="如：某篇好文"></div>
    <div class="bz-fav-fld"><label>链接</label><input id="fz-url" value="${esc(it ? it.url : "")}" placeholder="https://…"></div>
    <div class="bz-fav-fld"><label>简介</label><textarea id="fz-desc" placeholder="一句话记住它…">${esc(it ? it.description || "" : "")}</textarea></div>
    <div class="bz-fav-fld"><label>标签（可多选）</label><div class="bz-fav-pick" id="fz-tags"></div></div>
    <div class="bz-fav-fld bz-fav-inline"><span class="bz-fav-sw${it && it.pinned ? " bz-fav-on" : ""}" id="fz-pin"></span><span class="bz-fav-fld-desc">置顶后恒排最前</span></div>
    <div class="bz-fav-err" id="fz-err"></div>
    <div class="bz-fav-btns">
      <button type="button" id="fz-ai" class="bz-fav-ai-btn">${iconSpan(ICON.ai, "bz-ic--xs")} <span>AI 整理</span></button>
      <button type="button" data-fz-cancel>取消</button>
      <button type="button" id="fz-save" class="bz-fav-pri">${editing ? "更新" : "保存"}</button>
    </div>
  </div>`;
  }

  // src/favorites/layouts/board/render.ts
  function panelHtml(mobile) {
    const mob = mobile ? " bz-fav-mob bz-panel-mtop" : "";
    return `<div class="bz-fav-panel bz-fav-scope${mob}">
  <div class="bz-fav-head"><h1>收藏本</h1><button class="bz-fav-mob-close bz-touch-target bz-touch-target--xl" data-fav-close title="关闭">${iconSpan(ICON.close, "bz-ic--xs")}</button></div>
  <div class="bz-fav-tags" data-fav-tags></div>
  <div class="bz-fav-board" data-fav-content></div>
</div>`;
  }
  function chipsHtml(items, view, mobile) {
    const mk = (label, ic, cnt, active, grey = false) => `<button class="bz-fav-chip${active ? " bz-fav-on" : ""}${grey ? " bz-fav-chip--grey" : ""}" data-fav-tag="${esc(label)}">${ic ? iconSpan(ic, "bz-ic--xs") : ""}<span>${esc(label)} ${cnt}</span></button>`;
    const add = `<button class="bz-fav-chip-add" data-fav-add title="添加收藏">${iconSpan(ICON.add, "bz-ic--xs")}<span>新收藏</span></button>`;
    const chips = mk("全部", "", visibleItems(items).length, !view.archived && view.tag === null) + mk("已归档", "archive", archivedItems(items).length, view.archived, true) + TAGS.map((t) => {
      const n = tagCount(items, t.label);
      return n ? mk(t.label, t.ic, n, !view.archived && view.tag === t.label) : "";
    }).join("");
    return mobile ? add + chips : chips + add;
  }
  function boardHtml(items, view) {
    const list = filteredItems(items, view);
    if (!list.length) return emptyHtml();
    return list.map((it) => cardHtml(it, items.indexOf(it))).join("");
  }
  function renderTagsInto(mount, items, view, hooks) {
    mount.innerHTML = chipsHtml(items, view, hooks.mobile);
    hooks.mountIcons(mount);
  }
  function renderBoardInto(board, items, view, hooks) {
    board.innerHTML = boardHtml(items, view);
    hooks.mountIcons(board);
  }
  function renderPanelView(panel, items, view, hooks) {
    const tags = panel.querySelector("[data-fav-tags]");
    if (tags) renderTagsInto(tags, items, view, hooks);
    const board = panel.querySelector("[data-fav-content]");
    if (board) renderBoardInto(board, items, view, hooks);
  }
  return __toCommonJS(render_exports);
})();

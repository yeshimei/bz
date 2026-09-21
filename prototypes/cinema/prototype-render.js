/* 源指纹 c42a57ceadd1c1be · 仓内输入 6 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/cinema/constants.ts","src/cinema/layouts/midnight/render.ts","src/cinema/render.ts","src/cinema/seasons.ts","src/cinema/shared.ts","src/core/ui/str.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/cinema/render.ts → window.BZR_cinema（评审壳预览包，ADR-0104） */
var BZR_cinema = (() => {
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

  // src/cinema/render.ts
  var render_exports = {};
  __export(render_exports, {
    GROUP_SUBS_OF: () => GROUP_SUBS_OF,
    ICON: () => ICON,
    ST_COLOR: () => ST_COLOR,
    aiPageHtml: () => aiPageHtml,
    aiRecMeta: () => aiRecMeta,
    aiRecName: () => aiRecName,
    cardHtml: () => cardHtml,
    cardStatus: () => cardStatus,
    chipsHtml: () => chipsHtml,
    detailModalHtml: () => detailModalHtml,
    doubanSearchUrl: () => doubanSearchUrl,
    emptyPageHtml: () => emptyPageHtml,
    facePiecesHtml: () => facePiecesHtml,
    formAllTags: () => formAllTags,
    formChoicesHtml: () => formChoicesHtml,
    formModalHtml: () => formModalHtml,
    itemByKey: () => itemByKey,
    itemKey: () => itemKey,
    listHeadHtml: () => listHeadHtml,
    listToolsHtml: () => listToolsHtml,
    midnightDeskHtml: () => midnightDeskHtml,
    midnightMobHtml: () => midnightMobHtml,
    pcardHtml: () => pcardHtml,
    posterInner: () => posterInner,
    railHtml: () => railHtml,
    renderMidnightDesk: () => renderMidnightDesk,
    renderMidnightMob: () => renderMidnightMob,
    seasonDotsHtml: () => seasonDotsHtml,
    seasonSegState: () => seasonSegState,
    seriesCountsText: () => seriesCountsText,
    seriesDetailModalHtml: () => seriesDetailModalHtml,
    seriesSheetHeadHtml: () => seriesSheetHeadHtml,
    seriesStatus: () => seriesStatus,
    sheetHeadHtml: () => sheetHeadHtml,
    spHeadHtml: () => spHeadHtml,
    statusColor: () => statusColor,
    statusNum: () => statusNum,
    statusText: () => statusText,
    typeColor: () => typeColor,
    viewFiltered: () => viewFiltered
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

  // src/cinema/constants.ts
  var STATUS_WANT = 0;
  var STATUS_WATCHING = 1;
  var STATUS_WATCHED = 2;
  var ILLEGAL_NAME_CHARS = '\\\\/:*?"<>|';
  var ILLEGAL_NAME_RE = new RegExp(`[${ILLEGAL_NAME_CHARS}]`);
  var ILLEGAL_NAME_RE_GLOBAL = new RegExp(`[${ILLEGAL_NAME_CHARS}]`, "g");
  var TYPE_GROUPS = {
    电影: ["电影"],
    剧集: ["国产剧", "美剧", "英剧", "德剧", "日剧", "韩剧", "哥伦比亚剧"],
    动漫: ["日漫", "国漫", "美漫"],
    纪录片: ["纪录片"],
    公开课: ["公开课"]
  };
  var ALL_TAGS = Object.values(TYPE_GROUPS).flat();
  var GROUP_ORDER = ["电影", "剧集", "动漫", "纪录片", "公开课", "其他"];
  var TYPE_COLORS = {
    电影: "#e6951d",
    剧集: "#3d7bd6",
    动漫: "#d64d8f",
    纪录片: "#45a35c",
    公开课: "#9b6dd4",
    其他: "#888"
  };
  function getGroupForTag(tag) {
    for (const [group, tags] of Object.entries(TYPE_GROUPS)) {
      if (tags.includes(tag)) return group;
    }
    return null;
  }
  function getStarString(rating) {
    if (!rating || rating <= 0) return "";
    const stars = Math.min(Math.round(rating / 2 * 2) / 2, 5);
    const full = Math.floor(stars);
    let s = "";
    for (let i = 0; i < full; i++) s += "★";
    for (let j = full; j < 5; j++) s += "☆";
    return s;
  }

  // src/cinema/seasons.ts
  function cmpByRelease(a, b) {
    var _a, _b, _c, _d;
    const ra = (_b = (_a = a.releaseDate) != null ? _a : a.year) != null ? _b : "";
    const rb = (_d = (_c = b.releaseDate) != null ? _c : b.year) != null ? _d : "";
    if (ra === rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    return ra < rb ? -1 : 1;
  }
  function seasonsByRelease(slots) {
    return [...slots].sort((a, b) => cmpByRelease(a.item, b.item) || a.no - b.no);
  }
  function cardFace(e) {
    return e.kind === "series" ? e.face : e.item;
  }
  function cardGroup(e) {
    return e.kind === "series" ? e.group : e.item.group;
  }

  // src/cinema/shared.ts
  var ICON = {
    ai: "bot",
    stat: "bar-chart-3",
    close: "x",
    search: "search",
    add: "plus",
    edit: "pencil",
    del: "trash-2",
    confirm: "alert-circle",
    back: "chevron-left",
    grid: "layout-grid",
    eye: "eye",
    play: "play",
    globe: "globe"
  };
  function typeColor(group) {
    var _a;
    return group === "其他" ? "#8a8578" : (_a = TYPE_COLORS[group]) != null ? _a : "#8a8578";
  }
  var ST_COLOR = { 想看: "#98917f", 在看: "#d97c1d", 已看: "#4a9a5c" };
  function statusNum(status) {
    if (typeof status === "number") return status;
    return status === "想看" ? STATUS_WANT : status === "在看" ? STATUS_WATCHING : STATUS_WATCHED;
  }
  function statusColor(status) {
    const v = statusNum(status);
    return v === STATUS_WANT ? ST_COLOR["想看"] : v === STATUS_WATCHING ? ST_COLOR["在看"] : ST_COLOR["已看"];
  }
  function statusText(status) {
    const v = statusNum(status);
    return v === STATUS_WANT ? "想看" : v === STATUS_WATCHING ? "在看" : "已看";
  }
  function doubanSearchUrl(name) {
    return "https://movie.douban.com/search?q=" + encodeURIComponent(name);
  }
  function itemKey(it) {
    var _a, _b;
    return (_b = (_a = it.file) == null ? void 0 : _a.path) != null ? _b : `new:${it.name}`;
  }
  function itemByKey(items, key) {
    if (!key) return void 0;
    return items.find((it) => itemKey(it) === key);
  }
  function posterInner(item, url) {
    var _a, _b;
    const ph = `<div class="ph">${esc((_a = item.name[0]) != null ? _a : "")}</div>`;
    if (!url) return ph;
    return `<img loading="lazy" src="${esc(url)}" onerror="this.outerHTML='<div class=\\'ph\\'>${esc((_b = item.name[0]) != null ? _b : "")}</div>'">`;
  }
  function seasonSegState(item) {
    const st = statusNum(item.status);
    return st === STATUS_WATCHED ? "watched" : st === STATUS_WATCHING ? "watching" : "empty";
  }
  function seriesStatus(seasons, extra = []) {
    const states = seasons.map((s) => statusNum(s.item.status)).concat(extra.map((it) => statusNum(it.status)));
    if (states.includes(STATUS_WATCHING)) return STATUS_WATCHING;
    if (states.includes(STATUS_WANT)) return STATUS_WANT;
    return STATUS_WATCHED;
  }
  function cardStatus(e) {
    return e.kind === "series" ? seriesStatus(e.seasons, e.specials) : statusNum(e.item.status);
  }
  function seasonDotsHtml(seasons) {
    const n = { watched: 0, watching: 0, empty: 0 };
    const dots = seasons.map((s) => {
      const st = seasonSegState(s.item);
      n[st]++;
      return `<i class="${st}" data-cinema-season-key="${esc(itemKey(s.item))}"></i>`;
    }).join("");
    const label = `各季进度：共 ${seasons.length} 季，已看 ${n.watched}、在看 ${n.watching}、未看 ${n.empty}`;
    return `<span class="season-dots" role="img" aria-label="${esc(label)}">${dots}</span>`;
  }
  function facePiecesHtml(it, posterUrl, opts = {}) {
    var _a;
    const r = opts.rating !== void 0 ? opts.rating : it.rating;
    return {
      poster: posterInner(it, posterUrl),
      name: esc((_a = opts.name) != null ? _a : it.name),
      meta: esc([it.year || "", it.director || ""].filter(Boolean).join(" · ")),
      stars: r && r > 0 ? getStarString(r) + `<span class="num">${Number(r).toFixed(1)}</span>` : '<span class="star-none">未评分</span>'
    };
  }
  function cardHtml(e, posterUrl, fetching = false) {
    const it = e.kind === "series" ? e.face : e.item;
    const st = cardStatus(e);
    const p = facePiecesHtml(it, posterUrl, e.kind === "series" ? { name: e.name, rating: e.rating } : {});
    const label = `${e.kind === "series" ? e.name : it.name}，${statusText(st)}`;
    return `<div class="pcard${e.kind === "series" ? " pcard-series" : ""}" data-cinema-key="${esc(e.kind === "series" ? e.key : itemKey(it))}" tabindex="0" role="button" aria-label="${esc(label)}"><div class="pw"><div class="pw-face">${p.poster}</div>${fetching ? '<div class="pw-fetch"><span class="pw-spin"></span></div>' : ""}
    ${st !== STATUS_WATCHED ? `<span class="badge" style="background:${statusColor(st)}">${statusText(st)}</span>` : ""}${e.kind === "series" ? seasonDotsHtml(e.seasons) : ""}</div>
    <div class="pname">${p.name}</div>
    <div class="pmeta">${p.meta}</div>
    <div class="pstars">${p.stars}</div></div>`;
  }
  function pcardHtml(it, posterUrl, fetching = false) {
    return cardHtml({ kind: "single", item: it }, posterUrl, fetching);
  }
  function viewFiltered(view) {
    return !!(view.typeFilter || view.statusFilter || view.searchKeyword);
  }
  var HOT_FOLD_MIN = 120;
  function detailModalHtml(it, posterUrl) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const badge = (color, text) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
    const rows = [
      ["类型", (_a = it.genre) != null ? _a : ""],
      ["导演", (_b = it.director) != null ? _b : ""],
      ["主演", (_c = it.actors) != null ? _c : ""],
      ["制片国家/地区", (_d = it.region) != null ? _d : ""],
      ["上映日期", (_f = (_e = it.releaseDate) != null ? _e : it.year) != null ? _f : ""],
      // 完整年月日（year 只留年，卡片/统计用）
      ["片长", (_g = it.duration) != null ? _g : ""],
      ["季集", it.seasonText ? `${it.seasonText} 集` : ""],
      ["豆瓣评分", (_h = it.doubanRating) != null ? _h : ""]
    ].filter(([, v]) => v !== "");
    const hot = ((_i = it.hotComment) != null ? _i : "").trim();
    const hotFold = hot.length > HOT_FOLD_MIN;
    return `<div class="cn-modal cn-modal--detail">
    <div class="dm-head"><div class="dm-poster">${posterUrl ? `<img src="${esc(posterUrl)}" onerror="this.remove()">` : ""}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(it.name)}</div>
        <div class="dm-badges">${badge(typeColor(it.group), it.typeTag)}
          ${(() => {
      const st = statusNum(it.status);
      return st !== STATUS_WATCHED ? badge(statusColor(st), statusText(st)) : "";
    })()}
          ${it.rating && it.rating > 0 ? `<span class="dm-stars">${getStarString(it.rating)}</span><span class="dm-rating">${Number(it.rating).toFixed(1)}</span>` : ""}
          ${it.watchDate ? `<span class="dm-date">${esc((it.watchDate || "").slice(0, 10))}</span>` : ""}</div>
        ${it.review ? `<div class="dm-review">${esc(it.review)}</div>` : ""}</div></div>
    ${rows.length ? '<div class="dm-sec">豆 瓣 信 息</div>' + rows.map(([k, v]) => `<div class="dm-kv"><span class="dm-kv-k">${k}</span><span class="dm-kv-v">${esc(v)}</span></div>`).join("") : ""}
    ${it.doubanUrl ? `<div class="dm-kv"><span class="dm-kv-k">豆瓣链接</span><span class="dm-kv-v"><a href="${esc(it.doubanUrl)}" target="_blank" rel="noopener">${esc(it.doubanUrl)}</a></span></div>` : ""}
    ${hot ? `<div class="dm-sec">热 门 短 评</div><div class="dm-quote${hotFold ? " is-fold" : ""}" data-dm-quote>${esc(hot)}</div>${hotFold ? `<button type="button" class="dm-fold j-quote-fold" data-dm-fold>展开全文（${hot.length} 字）</button>` : ""}` : ""}
    ${it.synopsis ? `<div class="dm-sec">简 介</div><div class="dm-synopsis">${esc(it.synopsis)}</div>` : ""}
    <div class="dm-actions"><button class="dm-btn j-similar">${iconSpan(ICON.ai)}找同类</button><button class="dm-btn j-edit">${iconSpan(ICON.edit)}编辑</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`;
  }
  function seriesCountsText(card) {
    var _a;
    const byType = /* @__PURE__ */ new Map();
    for (const it of card.specials) {
      const t = it.typeTag || it.group;
      byType.set(t, ((_a = byType.get(t)) != null ? _a : 0) + 1);
    }
    const extra = [...byType].map(([t, n]) => `${n} 部${t}`).join(" · ");
    return `共 ${card.seasons.length} 季` + (extra ? ` · ${extra}` : "");
  }
  function seriesDetailModalHtml(card, posterOf) {
    const face = card.face;
    const url = posterOf(face);
    const st = seriesStatus(card.seasons, card.specials);
    const badge = (color, text) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
    const thumb = (it) => {
      const t = posterOf(it);
      return `<div class="s-thumb">${t ? `<img src="${esc(t)}" alt="" onerror="this.remove()">` : ""}</div>`;
    };
    const rowOf = (it, cls) => {
      const sub = [
        it.group !== card.group ? esc(it.group) : "",
        // 特别篇常是电影/纪录片：标出组，免得看着像「某一季」
        it.watchDate ? `观影 ${esc(it.watchDate.slice(0, 10))}` : "",
        it.seasonText ? esc(it.seasonText) : ""
        // 深审批 B #6：季集原文自带单位（「2季」），不再拼「 集」出「2季 集」叠字
      ].filter(Boolean).join(" · ");
      const r = it.rating;
      return `<div class="s-row${cls}" data-cinema-season-key="${esc(itemKey(it))}">${thumb(it)}
      <div class="s-mid"><div class="s-name">${esc(it.name)}</div>${sub ? `<div class="s-sub">${sub}</div>` : ""}</div>
      <span class="s-chip" style="background:${statusColor(it.status)}">${statusText(it.status)}</span>
      <span class="s-rate${r && r > 0 ? "" : " none"}">${r && r > 0 ? Number(r).toFixed(1) : "—"}</span></div>`;
    };
    const rowSrc = [
      ...seasonsByRelease(card.seasons).map((s) => ({ it: s.item, special: false })),
      ...card.specials.map((it) => ({ it, special: true }))
    ].sort((a, b) => cmpByRelease(a.it, b.it) || (a.special === b.special ? 0 : a.special ? 1 : -1));
    const rows = rowSrc.map(({ it, special }) => rowOf(it, special ? " s-row-special" : "")).join("");
    return `<div class="cn-modal cn-modal--detail">
    <div class="dm-head"><div class="dm-poster">${url ? `<img src="${esc(url)}" onerror="this.remove()">` : ""}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(card.name)}<span class="dm-n">${seriesCountsText(card)}</span></div>
        <div class="dm-badges">${badge(typeColor(card.group), face.typeTag)}
          ${st !== STATUS_WATCHED ? badge(statusColor(st), statusText(st)) : ""}
          ${card.rating && card.rating > 0 ? `<span class="dm-stars">${getStarString(card.rating)}</span><span class="dm-rating">${Number(card.rating).toFixed(1)}</span>` : ""}
          ${face.watchDate ? `<span class="dm-date">${esc(face.watchDate.slice(0, 10))}</span>` : ""}</div></div></div>
    <div class="s-list">${rows}</div>
  </div>`;
  }
  var GROUP_SUBS_OF = {
    电影: [],
    剧集: ["国产剧", "美剧", "英剧", "德剧", "日剧", "韩剧", "哥伦比亚剧"],
    动漫: ["日漫", "国漫", "美漫"],
    纪录片: [],
    公开课: ["公开课"]
  };
  function formAllTags() {
    const out = [];
    for (const g of GROUP_ORDER) {
      if (g === "其他") continue;
      const subs = GROUP_SUBS_OF[g];
      if (subs.length) subs.forEach((t) => out.push(t));
      else out.push(g);
    }
    return out;
  }
  function formChoicesHtml(values, cur, attr) {
    return values.map((v) => {
      var _a, _b;
      return `<button type="button" class="f-choice-btn${v === cur ? " is-on" : ""}" data-${attr}="${v}"><span class="dot" style="background:${attr === "f-tag" ? typeColor((_a = getGroupForTag(v)) != null ? _a : "其他") : (_b = ST_COLOR[v]) != null ? _b : "#888"}"></span>${v}</button>`;
    }).join("");
  }
  function formModalHtml(opts) {
    const { editing } = opts;
    const initSt = opts.stText;
    const ratingVal = opts.rating;
    return `<div class="cn-modal" style="width:100%">
    <div class="cn-modal-title">${editing ? "编辑影视" : "添加影视"}</div>
    <div class="f-field"><span class="f-label">名 称</span><input class="f-input j-name" value="${esc(opts.name)}" placeholder="影视名称"></div>
    <div class="f-field"><span class="f-label">类 型</span><div class="f-choice j-tags">${formChoicesHtml(formAllTags(), opts.typeTag, "f-tag")}</div></div>
    <div class="f-field"><span class="f-label">状 态</span><div class="f-choice j-sts">${formChoicesHtml(["想看", "在看", "已看"], initSt, "f-st")}</div></div>
    <div class="f-field j-rating" style="display:${initSt === "已看" ? "" : "none"}"><span class="f-label">评 分</span>
      <div class="f-range-row"><input type="range" class="f-range j-range" min="1" max="10" step="0.1" value="${ratingVal}"><span class="f-range-val j-rval">${Number(ratingVal).toFixed(1)}</span></div></div>
    <div class="f-field j-review" style="display:${initSt === "已看" ? "" : "none"}"><span class="f-label">影 评</span><textarea class="f-input j-review-t" placeholder="写点什么…">${esc(opts.review)}</textarea></div>
    <div class="dm-actions"><button class="dm-btn gold j-save">${editing ? "保存" : "添加"}</button></div>
  </div>`;
  }
  function aiRecName(r) {
    return (r == null ? void 0 : r.title) || (r == null ? void 0 : r.name) || "未命名";
  }
  function aiRecMeta(r) {
    return (r == null ? void 0 : r.meta) || [r == null ? void 0 : r.type, r == null ? void 0 : r.director].filter(Boolean).join(" · ");
  }
  function aiPageHtml(inp) {
    if (inp.running) {
      return `<div class="ai-guide"><div class="ai-spin"></div>
      <span class="ai-ic">${iconSpan(ICON.ai)}</span><div class="ai-title">${esc(inp.waitMsg || "AI 正在分析你的观影口味…")}</div>
      <div class="ai-sub">正在生成推荐，请稍候</div></div>`;
    }
    if (inp.error) {
      return `<div class="ai-guide"><span class="ai-ic ai-err-ic">${iconSpan(ICON.ai)}</span>
      <div class="ai-title">AI 分析失败</div><div class="ai-sub">${esc(inp.error)}</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>重试</button></div>`;
    }
    if (inp.results && inp.results.length > 0) {
      const cards = inp.results.map((rec, i) => {
        const name = aiRecName(rec);
        const inLib = inp.inLibrary(name);
        return `<div class="rec-card"><div class="rec-main"><div class="rec-name">${esc(name)}
        <a href="${esc(doubanSearchUrl(name))}" target="_blank" rel="noopener" title="在豆瓣搜索">${iconSpan(ICON.globe)}</a></div>
        <div class="rec-meta">${esc(aiRecMeta(rec))}</div><div class="rec-reason">${esc((rec == null ? void 0 : rec.reason) || "")}</div></div>
        <button class="rec-add" data-rec-add="${i}"${inLib ? " disabled" : ""}>${inLib ? "已在库中" : "＋ 想看"}</button></div>`;
      }).join("");
      return `<div class="ai-pref">偏好：<b>${esc(inp.pref)}</b></div>
      <div class="rec-list">${cards}</div>
      <div style="text-align:center;margin-top:14px"><button class="dm-btn j-ai-more" data-cinema-ai-start>${iconSpan(ICON.ai)}换一批</button></div>`;
    }
    return `<div class="ai-pref">偏好：<b>${esc(inp.pref)}</b></div>
    <div class="ai-guide">
      <div class="ai-title">让 AI 读懂你的片库</div>
      <div class="ai-sub">基于你的评分、影评与偏好标签生成荐片，<br>结果可直接加入想看清单</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>${iconSpan(ICON.ai)}开始推荐</button></div>`;
  }
  function sheetHeadHtml(it, posterUrl) {
    return `<div class="cn-sheet-head">${posterUrl ? `<img class="cn-sheet-poster" src="${esc(posterUrl)}" onerror="this.remove()">` : ""}
    <div><div class="cn-sheet-name">${esc(it.name)}</div><div class="cn-sheet-sub">${esc(it.year || "")} · ${esc(it.director || it.group)} · ${statusText(it.status)}</div></div></div>`;
  }
  function seriesSheetHeadHtml(card, posterUrl) {
    return `<div class="cn-sheet-head">${posterUrl ? `<img class="cn-sheet-poster" src="${esc(posterUrl)}" onerror="this.remove()">` : ""}
    <div><div class="cn-sheet-name">${esc(card.name)}</div><div class="cn-sheet-sub">${esc(seriesCountsText(card))}</div></div></div>`;
  }

  // src/cinema/layouts/midnight/render.ts
  function midnightDeskHtml() {
    return `<section class="bz-cinema--midnight" data-cinema-root="midnight">
    <div class="d-body">
      <aside class="d-rail">
        <div class="rail-brand"><h1>影院</h1><div class="en">CINEMA CLUB</div></div>
        <div class="rail-sec">
          <div class="rail-label">类 型</div>
          <div class="j-groups"></div>
          <div class="rail-label" style="padding-top:14px">状 态</div>
          <div class="j-status"></div>
        </div>
        <div class="rail-foot">
          <button class="rail-item j-tool" data-tool="ai">${iconSpan(ICON.ai)}AI 荐片</button>
          <button class="rail-item j-tool" data-tool="stat">${iconSpan(ICON.stat)}观影分析</button>
        </div>
      </aside>
      <div class="d-main j-view"></div>
    </div>
  </section>`;
  }
  function midnightMobHtml() {
    return `<section class="mob bz-cinema--midnight bz-panel-mtop" data-cinema-root="midnight">
    <div class="m-head"><h2 class="j-mtitle">全部</h2><span class="cnt j-mcnt"></span>
      <span class="m-acts">
        <button class="add j-madd bz-touch-target bz-touch-target--lg" data-cinema-add title="添加影片">${iconSpan(ICON.add)}</button>
        <button class="m-tool j-mai bz-touch-target bz-touch-target--lg" title="AI 荐片">${iconSpan(ICON.ai)}</button>
        <button class="m-tool j-mstat bz-touch-target bz-touch-target--lg" title="观影分析">${iconSpan(ICON.stat)}</button>
        <button class="m-tool j-mclose bz-touch-target bz-touch-target--lg" title="关闭">${iconSpan(ICON.close)}</button>
      </span>
    </div>
    <div class="m-chips j-chips"></div>
    <label class="m-search">${iconSpan(ICON.search)}<input class="j-mq" placeholder="搜索片名、类型、导演、主演、影评…"><button type="button" class="q-clear" data-cinema-clear title="清空搜索" aria-label="清空搜索" hidden>${iconSpan(ICON.close)}</button></label>
    <div class="m-scroll j-mview"></div>
  </section>`;
  }
  var railRow = (on, attr, color, name, n) => `<button class="rail-item${on ? " is-on" : ""}" ${attr}><span class="dot" style="background:${color}"></span>${esc(name)}<span class="n">${n}</span></button>`;
  function railHtml(cards, view) {
    const listOn = view.view === "list";
    const g = {};
    const c = { 想看: 0, 在看: 0, 已看: 0 };
    cards.forEach((e) => {
      const grp = cardGroup(e);
      g[grp] = (g[grp] || 0) + 1;
      c[statusText(cardStatus(e))]++;
    });
    let groups = railRow(listOn && !view.typeFilter && !view.statusFilter, 'data-g="全部"', "var(--gold)", "全部", cards.length);
    for (const name of GROUP_ORDER) {
      groups += railRow(listOn && view.typeFilter === name && !view.statusFilter, `data-g="${name}"`, typeColor(name), name, g[name] || 0);
    }
    let status = "";
    for (const s of ["想看", "在看", "已看"]) {
      status += railRow(listOn && view.statusFilter === s, `data-s="${s}"`, ST_COLOR[s], s, c[s]);
    }
    return { groups, status };
  }
  function chipsHtml(view) {
    const listOn = view.view === "list";
    let html = `<button class="chip bz-touch-target--lg${listOn && !view.typeFilter && !view.statusFilter ? " is-on" : ""}" data-c="all">${iconSpan(ICON.grid)}全部</button>`;
    for (const name of GROUP_ORDER) {
      html += `<button class="chip bz-touch-target--lg${listOn && view.typeFilter === name && !view.statusFilter ? " is-on" : ""}" data-c="${name}">${name}</button>`;
    }
    for (const s of ["想看", "在看", "已看"]) {
      html += `<button class="chip bz-touch-target--lg${listOn && view.statusFilter === s ? " is-on" : ""}" data-s="${s}">${s}</button>`;
    }
    return html;
  }
  function emptyPageHtml(filtered) {
    return `<div class="cn-empty-page"><div class="big">${filtered ? "无匹配影片" : "影片空空如也"}</div>
    ${filtered ? '<button class="dm-btn j-clear" data-cinema-clear style="margin-top:6px">清空筛选</button>' : '<span style="font-size:11.5px">点右上「添加影片」开始记录</span>'}</div>`;
  }
  function spHeadHtml(title, cnt) {
    return `<div class="sp-head"><button class="sp-back j-back">${iconSpan(ICON.back)}</button><span class="sp-title">${esc(title)}</span><span class="sp-cnt j-spcnt">${cnt}</span></div>`;
  }
  function cardsHtml(cards, inp) {
    return cards.map((e) => {
      var _a, _b;
      const face = cardFace(e);
      return cardHtml(e, inp.poster(face), (_b = (_a = inp.fetching) == null ? void 0 : _a.call(inp, face)) != null ? _b : false);
    }).join("");
  }
  function listHeadHtml(inp) {
    return `<div class="d-head"><h2 class="j-title">${esc(inp.title)}</h2><span class="cnt j-cnt">· ${inp.cards.length} 部</span>
    <button class="add j-add" data-cinema-add>${iconSpan(ICON.add)}添加影片</button></div>`;
  }
  function listToolsHtml(view) {
    return `<div class="d-tools"><label class="d-search">${iconSpan(ICON.search)}<input class="j-q" placeholder="搜索片名、类型、导演、主演、影评…" value="${esc(view.searchKeyword)}"><button type="button" class="q-clear" data-cinema-clear title="清空搜索" aria-label="清空搜索"${view.searchKeyword ? "" : " hidden"}>${iconSpan(ICON.close)}</button></label>
    <div class="seg j-sort">${[["date", "最近观看"], ["created", "加入先后"], ["rating", "按评分"]].map(([k, l]) => `<button data-k="${k}" class="${view.sortMode === k ? "is-on" : ""}">${l}</button>`).join("")}</div></div>`;
  }
  function renderMidnightDesk(root, inp) {
    const rail = railHtml(inp.allCards, inp.view);
    const groupsEl = root.querySelector(".j-groups");
    const statusEl = root.querySelector(".j-status");
    if (groupsEl) groupsEl.innerHTML = rail.groups;
    if (statusEl) statusEl.innerHTML = rail.status;
    const view = root.querySelector(".j-view");
    if (!view) return;
    const v = inp.view;
    if (v.view === "ai") {
      view.innerHTML = spHeadHtml("AI 荐片", inp.aiCount ? `· ${inp.aiCount} 部` : "") + `<div class="sp-body">${inp.aiHtml}</div>`;
    } else if (v.view === "stat") {
      view.innerHTML = spHeadHtml("观影分析", `· ${inp.watchedCount} 部已看`) + `<div class="sp-body">${inp.statHtml}</div>`;
    } else {
      const body = inp.cards.length ? `<div class="d-scroll"><div class="grid" style="grid-template-columns:repeat(${inp.cols},1fr)">${cardsHtml(inp.cards, inp)}</div></div>` : emptyPageHtml(viewFiltered(v));
      view.innerHTML = listHeadHtml(inp) + listToolsHtml(v) + body;
    }
  }
  function renderMidnightMob(root, inp) {
    const v = inp.view;
    const t = v.view === "list" ? inp.title : v.view === "ai" ? "AI 荐片" : "观影分析";
    const titleEl = root.querySelector(".j-mtitle");
    const cntEl = root.querySelector(".j-mcnt");
    if (titleEl) titleEl.textContent = t;
    if (cntEl) cntEl.textContent = v.view === "list" ? `· ${inp.cards.length}` : "";
    const q = root.querySelector(".j-mq");
    if (q && q.value !== v.searchKeyword) q.value = v.searchKeyword;
    const qClear = root.querySelector(".m-search .q-clear");
    if (qClear) qClear.hidden = !v.searchKeyword;
    const mv = root.querySelector(".j-mview");
    if (mv) {
      if (v.view === "list") {
        mv.className = inp.cards.length ? "m-scroll j-mview" : "m-scroll j-mview cn-mempty";
        mv.innerHTML = inp.cards.length ? `<div class="m-grid">${cardsHtml(inp.cards, inp)}</div>` : emptyPageHtml(viewFiltered(v));
      } else if (v.view === "ai") {
        mv.className = "sp-body j-mview";
        mv.innerHTML = inp.aiHtml;
      } else {
        mv.className = "sp-body j-mview";
        mv.innerHTML = inp.statHtml;
      }
    }
    const chips = root.querySelector(".j-chips");
    if (chips) chips.innerHTML = chipsHtml(v);
  }
  return __toCommonJS(render_exports);
})();

/* 源指纹 df8f4d24da135eb9 · 仓内输入 2 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/core/ui/str.ts","src/diary/render.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/diary/render.ts → window.BZR_diary（评审壳预览包，ADR-0104） */
var BZR_diary = (() => {
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

  // src/diary/render.ts
  var render_exports = {};
  __export(render_exports, {
    ACT_ICON: () => ACT_ICON,
    KIND_ICON: () => KIND_ICON,
    WEEK: () => WEEK,
    dayStats: () => dayStats,
    lbCaption: () => lbCaption,
    lbSubText: () => lbSubText,
    mediaCapHtml: () => mediaCapHtml,
    mimeOfMediaName: () => mimeOfMediaName,
    statHtml: () => statHtml,
    wallPanelHTML: () => wallPanelHTML
  });

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }

  // src/diary/render.ts
  var ACT_ICON = {
    add: "pen-line",
    search: "search",
    "lb-close": "x",
    "lb-prev": "chevron-left",
    "lb-next": "chevron-right"
  };
  var KIND_ICON = {
    img: "image",
    video: "video-off",
    audio: "music"
  };
  var MIME_BY_EXT = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    wav: "audio/wav",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    aac: "audio/aac",
    ogg: "audio/ogg"
  };
  function mimeOfMediaName(name) {
    const dot = name.lastIndexOf(".");
    const ext = dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
    return MIME_BY_EXT[ext] || "application/octet-stream";
  }
  function wallPanelHTML() {
    return `
      <div class="bz-diary-head bz-win-head">
        <div class="bz-diary-brand" data-act="date-picker" title="按日期筛选">
          <span class="bz-diary-bookname">日记本</span>
          <span class="bz-diary-range"></span>
        </div>
        <div class="bz-diary-btns">
          <button class="bz-diary-icon-btn bz-touch-target--xl" data-act="add" title="写日记"></button>
          <button class="bz-diary-icon-btn bz-touch-target--xl" data-act="search" title="搜索"></button>
        </div>
      </div>
      <div class="bz-diary-chiprow"></div>
      <div class="bz-diary-subrow" style="display:none"></div>
      <div class="bz-diary-searchrow" style="display:none"></div>
      <div class="bz-diary-body">
        <div class="bz-rail bz-diary-rail"></div>
        <div class="bz-diary-wall"></div>
      </div>
      <div class="bz-diary-lb">
        <button class="bz-diary-lbnav bz-diary-lbnav--prev" data-act="lb-prev" title="上一个（←）"></button>
        <button class="bz-diary-lbclose" data-act="lb-close" title="关闭"></button>
        <button class="bz-diary-lbnav bz-diary-lbnav--next" data-act="lb-next" title="下一个（→）"></button>
        <div class="bz-diary-lbmedia"></div>
        <div class="bz-diary-lbcap"></div>
        <div class="bz-diary-lbsub"></div>
      </div>
      <div class="bz-sheet-mask bz-diary-sheet-mask"></div>
      <div class="bz-sheet bz-diary-sheet">
        <div class="bz-sheet-grip"></div>
        <div class="bz-sheet-head bz-diary-sheet-head">
          <span class="bz-diary-sheet-emoji"></span>
          <div class="bz-diary-sheet-info">
            <div class="bz-sheet-title bz-diary-sheet-time"></div>
            <div class="bz-diary-sheet-content"></div>
            <div class="bz-diary-sheet-media"></div>
          </div>
        </div>
        <div class="bz-sheet-body bz-sheet-actions bz-diary-sheet-actions"></div>
      </div>
    `;
  }
  function dayStats(list) {
    let imgs = 0;
    let vids = 0;
    let auds = 0;
    let texts = 0;
    list.forEach((e) => {
      e.media.forEach((k) => {
        if (k.kind === "video") vids++;
        else if (k.kind === "audio") auds++;
        else imgs++;
      });
      if (e.content) texts++;
    });
    return { imgs, vids, auds, texts };
  }
  function statHtml(s) {
    const parts = [];
    if (s.imgs) parts.push(`<b>${s.imgs}</b> 图`);
    if (s.vids) parts.push(`<b>${s.vids}</b> 视频`);
    if (s.auds) parts.push(`<b>${s.auds}</b> 音频`);
    if (s.texts) parts.push(`<b>${s.texts}</b> 条文字`);
    return parts.join(" · ") || "空";
  }
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  function lbCaption(entry) {
    return `${entry.date} ${entry.time}` + (entry.tags.length ? ` · ${entry.tags.join(" ")}` : "");
  }
  function lbSubText(entry) {
    return entry.text || entry.content || "";
  }
  function mediaCapHtml(entry) {
    const tagText = entry.tags.filter((t) => t !== "加密").join(" ");
    return `<span style="opacity:.75">${esc(entry.emoji)} ${esc(entry.time)}</span>${tagText ? `　${esc(tagText)}` : ""}`;
  }
  return __toCommonJS(render_exports);
})();

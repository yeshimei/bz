/* 源指纹 6f0423d9a155eceb · 仓内输入 2 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/core/ui/str.ts","src/memo/render.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/memo/render.ts → window.BZR_memo（评审壳预览包，ADR-0104） */
var BZR_memo = (() => {
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

  // src/memo/render.ts
  var render_exports = {};
  __export(render_exports, {
    MEMO_ICONS: () => MEMO_ICONS,
    SCENE_DOTS: () => SCENE_DOTS,
    SCENE_PSEUDO_ICONS: () => SCENE_PSEUDO_ICONS,
    cardHtml: () => cardHtml,
    doneBarHtml: () => doneBarHtml,
    doneMoreHtml: () => doneMoreHtml,
    dueIconName: () => dueIconName,
    dueTagClass: () => dueTagClass,
    iconSpan: () => iconSpan,
    mainCountHtml: () => mainCountHtml,
    metaTagsHtml: () => metaTagsHtml,
    mobAddSceneChipHtml: () => mobAddSceneChipHtml,
    mobChipHtml: () => mobChipHtml,
    navBtnHtml: () => navBtnHtml,
    panelShellHtml: () => panelShellHtml,
    sceneDot: () => sceneDot,
    sceneLabel: () => sceneLabel,
    sceneLeadHtml: () => sceneLeadHtml,
    sectionLabelHtml: () => sectionLabelHtml
  });

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }

  // src/memo/render.ts
  var MEMO_ICONS = {
    brand: "list-checks",
    close: "x",
    search: "search",
    add: "plus",
    addScene: "tag",
    settings: "settings",
    empty: "inbox",
    pos: "pin",
    star: "star",
    edit: "pencil",
    del: "trash-2",
    course: "graduation-cap",
    script: "terminal",
    url: "arrow-up-right",
    overdue: "circle-alert",
    clock: "clock",
    calendar: "calendar",
    doneFold: "chevron-down",
    sceneAll: "layers",
    sceneToday: "sun"
  };
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }
  var SCENE_DOTS = {
    剪藏: "#e67341",
    代码: "#4c82c8",
    公开课: "#8f5fc0",
    学习: "#4c9e6c",
    生活: "#c27a48",
    工作: "#b25757"
  };
  function sceneDot(scene) {
    return SCENE_DOTS[scene] || "#8b8f9a";
  }
  function dueIconName(status) {
    if (status === "overdue") return MEMO_ICONS.overdue;
    if (status === "today") return MEMO_ICONS.clock;
    return MEMO_ICONS.calendar;
  }
  function dueTagClass(status) {
    if (status === "overdue") return "bz-memo-tag-overdue";
    if (status === "today") return "bz-memo-tag-today";
    return "bz-memo-tag-future";
  }
  var SCENE_PSEUDO_ICONS = {
    全部: { icon: MEMO_ICONS.sceneAll },
    今日: { icon: MEMO_ICONS.sceneToday },
    重要: { icon: MEMO_ICONS.star, cls: "bz-ic--warning" }
  };
  var LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;
  function sceneLabel(scene) {
    return scene.replace(LEADING_EMOJI_RE, "");
  }
  function sceneLeadHtml(o, dotCls) {
    var _a, _b;
    const pseudo = SCENE_PSEUDO_ICONS[o.scene];
    if (pseudo) return iconSpan(pseudo.icon, (_a = pseudo.cls) != null ? _a : "");
    const emo = (_b = o.scene.match(LEADING_EMOJI_RE)) == null ? void 0 : _b[1];
    if (emo) return `<span class="bz-rail-emoji">${escapeHtml(emo)}</span>`;
    if (!o.dot) return "";
    return `<span class="${dotCls}" style="--bz-rail-tint:${o.dot}"></span>`;
  }
  function mainCountHtml(total, undone) {
    return `· <span class="bz-memo-cnt-num">${total}</span> 项 · <span class="bz-memo-cnt-num">${undone}</span> 未完成`;
  }
  function navBtnHtml(o, active, count) {
    return `<button class="bz-rail-item${active ? " on" : ""}" data-memo-scene="${escapeHtml(o.scene)}">${sceneLeadHtml(o, "bz-rail-dot")}<span class="bz-rail-name">${escapeHtml(sceneLabel(o.scene))}</span><span class="bz-rail-count">${count}</span></button>`;
  }
  function mobChipHtml(o, active) {
    return `<button class="bz-mobstrip-chip${active ? " is-on" : ""}" data-memo-scene="${escapeHtml(o.scene)}">${sceneLeadHtml(o, "bz-mobstrip-dot")}${escapeHtml(sceneLabel(o.scene))}</button>`;
  }
  function mobAddSceneChipHtml() {
    return `<button class="bz-mobstrip-chip bz-mobstrip-add" data-memo-addscene title="添加场景">${iconSpan(MEMO_ICONS.addScene)}${escapeHtml("添加场景")}</button>`;
  }
  function panelShellHtml() {
    return `
    <div class="bz-panel-frame bz-memo-panel bz-panel-mtop">
      <div class="bz-panel-head">
        <div class="bz-panel-brand">${iconSpan(MEMO_ICONS.brand, "bz-ic--sm")}</div>
        <div class="bz-panel-title">备忘录</div>
        <div class="bz-panel-head-sp"></div>
        <div class="bz-panel-head-btns">
          <button class="bz-icon-btn bz-memo-head-settings" data-memo-head-settings title="打开备忘录设置">${iconSpan(MEMO_ICONS.settings)}</button>
          <button class="bz-icon-btn bz-touch-target bz-touch-target--lg bz-memo-head-close" data-memo-head-close title="关闭">${iconSpan(MEMO_ICONS.close)}</button>
        </div>
      </div>
      <div class="bz-memo-body">
        <div class="bz-rail">
          <div class="bz-rail-scroll">
            <div class="bz-rail-label">场景</div>
            <div data-memo-nav></div>
            <button class="bz-memo-side-add" data-memo-addscene>${iconSpan(MEMO_ICONS.addScene)} 添加场景</button>
          </div>
        </div>
        <div class="bz-memo-main">
          <div class="bz-main-head">
            <div class="bz-main-title" data-memo-main-title>全部</div>
            <div class="bz-main-count" data-memo-main-count></div>
            <div class="bz-main-spacer"></div>
            <button class="bz-btn bz-btn--primary bz-btn--md" data-memo-newbtn>${iconSpan(MEMO_ICONS.add, "bz-ic--sm")} 新建备忘录</button>
          </div>
          <div class="bz-toolrow">
            <div class="bz-search">${iconSpan(MEMO_ICONS.search)}<input class="bz-input" type="text" data-memo-search placeholder="搜索内容 / 场景…"></div>
            <div class="bz-memo-sort" data-memo-sort></div>
          </div>
          <div class="bz-mobstrip" data-memo-mob-scenes></div>
          <div class="bz-memo-content" data-memo-content></div>
          <div class="bz-memo-composer">
            <input class="bz-input" type="text" data-memo-composer-input placeholder="输入内容，Enter 保存…">
            <button class="bz-btn bz-btn--primary" data-memo-composer-add>${iconSpan(MEMO_ICONS.add, "bz-ic--sm")} 添加</button>
          </div>
        </div>
      </div>
    </div>`;
  }
  function metaTagsHtml(it, due, relTime) {
    const tags = [];
    if (it.scene === "公开课" && it.courseName) {
      tags.push(`<span class="bz-memo-tag bz-memo-tag-course">${iconSpan(MEMO_ICONS.course)} ${escapeHtml(it.courseName.replace(/^《|》$/g, ""))}</span>`);
    }
    if (it.scene === "代码" && it.scriptName) {
      tags.push(`<span class="bz-memo-tag bz-memo-tag-script">${iconSpan(MEMO_ICONS.script)} ${escapeHtml(it.scriptName)}</span>`);
    }
    if (it.url) {
      let host = "链接";
      try {
        host = new URL(it.url).hostname.replace(/^www\./, "");
      } catch (e) {
      }
      tags.push(`<span class="bz-memo-tag bz-memo-tag-url" title="${escapeHtml(it.url)}">${iconSpan(MEMO_ICONS.url)} ${escapeHtml(host)}</span>`);
    }
    if (it.notePath) {
      const name = it.notePath.split("/").pop().replace(/\.md$/i, "");
      const isCourseSame = it.scene === "公开课" && it.courseName && it.courseName.replace(/^《|》$/g, "") === name;
      if (!isCourseSame) {
        tags.push(`<span class="bz-memo-tag bz-memo-tag-pos" data-memo-pos="${escapeHtml(it.id)}">${iconSpan(MEMO_ICONS.pos)} ${escapeHtml(name)}</span>`);
      }
    }
    const imp = it.priority === "important" ? " bz-memo-tag-important" : "";
    tags.push(`<span class="bz-memo-tag bz-memo-tag-scene${imp}">#${escapeHtml(it.scene)}</span>`);
    if (due) {
      tags.push(`<span class="bz-memo-tag ${dueTagClass(due.status)}">${iconSpan(dueIconName(due.status))} ${escapeHtml(due.text)}</span>`);
    }
    if (it.created && relTime) {
      tags.push(`<span class="bz-memo-time">${escapeHtml(relTime)}</span>`);
    }
    return tags.join("");
  }
  function cardHtml(it, due, relTime) {
    const titleCls = it.completed ? " bz-memo-done" : "";
    const clickable = !!(it.linkedNote || it.url);
    const titleHtml = clickable ? `<a href="javascript:void(0)" data-memo-openitem="${escapeHtml(it.id)}">${escapeHtml(it.title)}</a>` : escapeHtml(it.title);
    return `<div class="bz-memo-card${titleCls}" data-memo-id="${escapeHtml(it.id)}">
      <span class="bz-memo-check${it.completed ? " bz-memo-checked" : ""}" data-memo-check title="${it.completed ? "恢复未完成" : "标记完成"}"></span>
      <div class="bz-memo-body-text">
        <div class="bz-memo-card-title">${titleHtml}</div>
        <div class="bz-memo-meta">${metaTagsHtml(it, due, relTime)}</div>
      </div>
    </div>`;
  }
  function sectionLabelHtml(label, count) {
    return `<div class="bz-memo-section-label">${label} <span class="bz-memo-sec-cnt">${count}</span></div>`;
  }
  function doneBarHtml(open, count) {
    return `<div class="bz-memo-donebar${open ? " bz-memo-donebar-open" : ""}" data-memo-donebar>
      ${iconSpan(MEMO_ICONS.doneFold)} 已完成 <span class="bz-memo-donebar-cnt">${count}</span></div>`;
  }
  function doneMoreHtml(n) {
    return `<button class="bz-memo-done-more" data-memo-donemore>更早 ${n} 条</button>`;
  }
  return __toCommonJS(render_exports);
})();

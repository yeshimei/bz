/* 源指纹 d3a794f795f4871a · 仓内输入 2 个（校验见 tests/preview-freshness.test.ts） */
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
    CAL_WEEKDAYS: () => CAL_WEEKDAYS,
    MEMO_ICONS: () => MEMO_ICONS,
    SCENE_DOTS: () => SCENE_DOTS,
    SCENE_PSEUDO_ICONS: () => SCENE_PSEUDO_ICONS,
    calDayPanelHtml: () => calDayPanelHtml,
    calEmptyHtml: () => calEmptyHtml,
    calGridHtml: () => calGridHtml,
    calHeadHtml: () => calHeadHtml,
    calStatsHtml: () => calStatsHtml,
    cardHtml: () => cardHtml,
    checkHtml: () => checkHtml,
    doneBarHtml: () => doneBarHtml,
    doneMoreHtml: () => doneMoreHtml,
    dueIconName: () => dueIconName,
    dueTagClass: () => dueTagClass,
    highlightTitleHtml: () => highlightTitleHtml,
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
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function emptyHtmlStr(icon, title, desc) {
    return `<div class="bz-empty">${icon ? iconSpan(icon, "bz-empty-ic") : ""}<div class="bz-empty-title">${esc(title)}</div>${desc ? `<div class="bz-empty-desc">${esc(desc)}</div>` : ""}</div>`;
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }
  function stripMdExt(name) {
    return String(name || "").replace(/\.md$/i, "");
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
    recur: "repeat",
    list: "list",
    doneFold: "chevron-down",
    sceneAll: "layers",
    sceneToday: "sun"
  };
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
          <button class="bz-icon-btn bz-touch-target bz-touch-target--lg bz-memo-head-close" data-memo-head-close title="关闭" aria-label="关闭">${iconSpan(MEMO_ICONS.close)}</button>
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
            <div class="bz-search">${iconSpan(MEMO_ICONS.search)}<input class="bz-input" type="text" data-memo-search placeholder="搜索内容 / 场景…" aria-label="搜索备忘录"><button type="button" class="bz-memo-search-clear" data-memo-search-clear title="清除搜索" aria-label="清除搜索" hidden>${iconSpan(MEMO_ICONS.close, "bz-ic--sm")}</button></div>
            <div class="bz-memo-sort" data-memo-sort></div>
            <div class="bz-memo-viewtoggle" data-memo-viewtoggle role="tablist" aria-label="视图切换">
              <button class="bz-memo-viewbtn bz-touch-target bz-touch-target--lg is-on" data-memo-view="list" title="列表视图" aria-label="列表视图">${iconSpan(MEMO_ICONS.list)}</button>
              <button class="bz-memo-viewbtn bz-touch-target bz-touch-target--lg" data-memo-view="calendar" title="月历视图" aria-label="月历视图">${iconSpan(MEMO_ICONS.calendar)}</button>
            </div>
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
  function metaTagsHtml(it, due, relTime, recurText = "") {
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
      const name = stripMdExt(it.notePath.split("/").pop() || "");
      const isCourseSame = it.scene === "公开课" && it.courseName && it.courseName.replace(/^《|》$/g, "") === name;
      if (!isCourseSame) {
        tags.push(`<span class="bz-memo-tag bz-memo-tag-pos" data-memo-pos="${escapeHtml(it.id)}">${iconSpan(MEMO_ICONS.pos)} ${escapeHtml(name)}</span>`);
      }
    }
    const imp = it.priority === "important" ? " bz-memo-tag-important" : "";
    tags.push(`<span class="bz-memo-tag bz-memo-tag-scene${imp}">#${escapeHtml(it.scene)}</span>`);
    if (recurText) {
      tags.push(`<span class="bz-memo-tag bz-memo-tag-recur" title="周期重复：完成后自动生成下一期">${iconSpan(MEMO_ICONS.recur)} ${escapeHtml(recurText)}</span>`);
    }
    if (due) {
      tags.push(`<span class="bz-memo-tag ${dueTagClass(due.status)}">${iconSpan(dueIconName(due.status))} ${escapeHtml(due.text)}</span>`);
    }
    if (it.created && relTime) {
      tags.push(`<span class="bz-memo-time">${escapeHtml(relTime)}</span>`);
    }
    return tags.join("");
  }
  function checkHtml(it) {
    const label = it.completed ? "恢复未完成" : "标记完成";
    return `<span class="bz-memo-check${it.completed ? " bz-memo-checked" : ""}" data-memo-check role="checkbox" tabindex="0" aria-checked="${it.completed ? "true" : "false"}" aria-label="${label}" title="${label}"></span>`;
  }
  function highlightTitleHtml(title, kw) {
    const safe = escapeHtml(title);
    const needle = escapeHtml((kw || "").trim()).toLowerCase();
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
  function cardHtml(it, due, relTime, recurText = "", kw = "") {
    const titleCls = it.completed ? " bz-memo-done" : "";
    const clickable = !!(it.linkedNote || it.url);
    const titleText = highlightTitleHtml(it.title, kw);
    const titleHtml = clickable ? `<a href="javascript:void(0)" data-memo-openitem="${escapeHtml(it.id)}">${titleText}</a>` : titleText;
    return `<div class="bz-memo-card${titleCls}" data-memo-id="${escapeHtml(it.id)}" tabindex="0">
      ${checkHtml(it)}
      <div class="bz-memo-body-text">
        <div class="bz-memo-card-title">${titleHtml}</div>
        <div class="bz-memo-meta">${metaTagsHtml(it, due, relTime, recurText)}</div>
      </div>
    </div>`;
  }
  function sectionLabelHtml(label, count, kind = "") {
    return `<div class="bz-memo-section-label"${kind ? ` data-memo-sec="${kind}"` : ""}>${label} <span class="bz-memo-sec-cnt">${count}</span></div>`;
  }
  function doneBarHtml(open, count) {
    return `<button type="button" class="bz-memo-donebar${open ? " bz-memo-donebar-open" : ""}" data-memo-donebar aria-expanded="${open ? "true" : "false"}">
      ${iconSpan(MEMO_ICONS.doneFold)} 已完成 <span class="bz-memo-donebar-cnt">${count}</span></button>`;
  }
  function doneMoreHtml(n) {
    return `<button class="bz-memo-done-more" data-memo-donemore>更早 ${n} 条</button>`;
  }
  var CAL_WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
  function calHeadHtml(monthLabel) {
    return `<div class="bz-memo-cal-head">
      <button class="bz-icon-btn bz-touch-target bz-touch-target--lg" data-memo-cal-prev title="上个月" aria-label="上个月">${iconSpan("chevron-left")}</button>
      <div class="bz-memo-cal-title">${escapeHtml(monthLabel)}</div>
      <button class="bz-icon-btn bz-touch-target bz-touch-target--lg" data-memo-cal-next title="下个月" aria-label="下个月">${iconSpan("chevron-right")}</button>
      <button class="bz-btn bz-btn--sm bz-memo-cal-today" data-memo-cal-today>回到今天</button>
    </div>`;
  }
  function calGridHtml(cells) {
    const wds = CAL_WEEKDAYS.map((w) => `<div class="bz-memo-cal-wd">${escapeHtml(w)}</div>`).join("");
    const grid = cells.map((c) => {
      if (c.blank) return `<div class="bz-memo-cal-cell is-blank"></div>`;
      const chips = c.chips.map(
        (ch) => ch.id ? `<div class="bz-memo-cal-chip ${ch.cls}" data-memo-cal-item="${escapeHtml(ch.id)}" title="${escapeHtml(ch.title)}"><span class="bz-memo-cal-chip-dot"></span><span class="bz-memo-cal-chip-txt">${escapeHtml(ch.title)}</span></div>` : `<div class="bz-memo-cal-chip ${ch.cls}" title="${escapeHtml(ch.title)}"><span class="bz-memo-cal-chip-dot"></span><span class="bz-memo-cal-chip-txt">${escapeHtml(ch.title)}</span></div>`
      ).join("");
      return `<div class="bz-memo-cal-cell${c.today ? " is-today" : ""}${c.selected ? " is-selected" : ""}" data-memo-cal-day="${c.day}">
        <div class="bz-memo-cal-day">${c.day}</div>
        <div class="bz-memo-cal-chips">${chips}</div>
      </div>`;
    }).join("");
    return `<div class="bz-memo-cal-grid">${wds}${grid}</div>`;
  }
  function calStatsHtml(monthCount, todayCount) {
    const todaySeg = todayCount === null ? "" : ` · 今日 <span class="bz-memo-cal-stats-n">${todayCount}</span> 条`;
    return `<div class="bz-memo-cal-stats">本月到期 <span class="bz-memo-cal-stats-n">${monthCount}</span> 条${todaySeg}</div>`;
  }
  function calEmptyHtml(filtered) {
    return filtered ? emptyHtmlStr("", "当前筛选下本月没有到期事项", "试试清除搜索或切换场景；设了截止时间的备忘录才会出现在月历上") : emptyHtmlStr("", "本月没有到期事项", "设了截止时间的备忘录才会出现在月历上");
  }
  function calDayPanelHtml(label, count, cardsHtml) {
    const body = cardsHtml || emptyHtmlStr("", "这一天没有备忘录");
    return `<div class="bz-memo-cal-daypanel">${sectionLabelHtml(label, count)}${body}</div>`;
  }
  return __toCommonJS(render_exports);
})();

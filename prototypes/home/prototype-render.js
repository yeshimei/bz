/* 源指纹 49ad8ad6ac9eaa10 · 仓内输入 5 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/core/domain-icons.ts","src/core/ui/str.ts","src/home/layouts/river/render.ts","src/home/render.ts","src/home/shared.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/home/render.ts → window.BZR_home（评审壳预览包，ADR-0104） */
var BZR_home = (() => {
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

  // src/home/render.ts
  var render_exports = {};
  __export(render_exports, {
    ALL_DOMAIN_IDS: () => ALL_DOMAIN_IDS,
    DOMAINS: () => DOMAINS,
    DOMAIN_DOT: () => DOMAIN_DOT,
    DOMAIN_ICONS: () => DOMAIN_ICONS,
    DOMAIN_MAP: () => DOMAIN_MAP,
    DOMAIN_MENU: () => DOMAIN_MENU,
    EMPTY_COUNTS: () => EMPTY_COUNTS,
    EMPTY_SUMMARY: () => EMPTY_SUMMARY,
    applyOrder: () => applyOrder,
    buildDots: () => buildDots,
    buildNotes: () => buildNotes,
    buildPreviews: () => buildPreviews,
    dateStrOf: () => dateStrOf,
    domainColor: () => domainColor,
    dotOf: () => dotOf,
    entriesHtml: () => entriesHtml,
    esc: () => esc,
    flowHtml: () => flowHtml,
    headDateText: () => headDateText,
    hiddenOf: () => hiddenOf,
    iconSpan: () => iconSpan,
    loadingEntriesHtml: () => loadingEntriesHtml,
    loadingFlowHtml: () => loadingFlowHtml,
    nextHtml: () => nextHtml,
    panelFrameHtml: () => panelFrameHtml,
    pomodoroMenuLabel: () => pomodoroMenuLabel,
    reorderTo: () => reorderTo,
    riverCountText: () => riverCountText,
    sheetHeadHtml: () => sheetHeadHtml,
    tilesHtml: () => tilesHtml,
    visibleDomains: () => visibleDomains,
    weekHtml: () => weekHtml
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

  // src/core/domain-icons.ts
  var DOMAIN_ICONS = {
    // 面板专属域（无对应命令）
    global: "settings",
    appearance: "palette",
    ai: "sparkles",
    // 域入口命令与面板导航共用
    home: "layout-grid",
    recap: "calendar-heart",
    memo: "check-square",
    belongings: "package",
    clipping: "scissors",
    favorites: "star",
    diary: "notebook-pen",
    "reading-report": "bar-chart-3",
    cinema: "clapperboard",
    bookshelf: "book-open",
    review: "repeat-2",
    secondbrain: "brain",
    "auto-summary": "sparkles",
    pomodoro: "timer",
    attach: "folder-down",
    encrypt: "lock",
    "password-vault": "key",
    smartcat: "cat",
    knowledge: "list-video",
    // 命令专属域
    "settings-panel": "settings-2"
  };

  // src/home/shared.ts
  var ICON_KEY = { settings: "settings-panel", vault: "password-vault" };
  var iconOf = (id) => {
    var _a;
    return DOMAIN_ICONS[(_a = ICON_KEY[id]) != null ? _a : id];
  };
  var DOMAINS = [
    { id: "diary", commandId: "bz-diary-open", name: "日记本", sub: "写今天的闪念 · 回忆媒体墙", icon: iconOf("diary") },
    // 备忘录（memo 域，ADR-0092/0117）：2026-09-10 用户拍板补入首页入口（此前只在命令面板可达）
    { id: "memo", commandId: "bz-memo-open", name: "备忘录", sub: "随手记与待办", icon: iconOf("memo") },
    { id: "cinema", commandId: "bz-cinema-open", name: "影院", sub: "影视想看与在看", icon: iconOf("cinema") },
    { id: "review", commandId: "bz-review-open", name: "复习计划", sub: "到期卡片队列", icon: iconOf("review") },
    { id: "pomodoro", commandId: "bz-pomodoro-open", name: "番茄钟", sub: "专注计时", icon: iconOf("pomodoro") },
    { id: "favorites", commandId: "bz-favorites-open", name: "收藏本", sub: "收藏条目", icon: iconOf("favorites") },
    { id: "clipping", commandId: "bz-clipbook-open", name: "剪藏本", sub: "未读流与剪藏", icon: iconOf("clipping") },
    // 文献盒（literature 域，ADR-0072）：文献笔记列表 + 视频/术语录入（补内容域曝光位）
    { id: "knowledge", commandId: "bz-knowledge-open", name: "知识盒", sub: "文献录入 · 卡片 · 主题", icon: iconOf("knowledge") },
    // 旧书库（library）域退役：本卡由书架墙（bookshelf）承接（id 变更后旧 home.json 里钉选的 library 自动失效，可在编辑模式重钉）
    { id: "bookshelf", commandId: "bz-bookshelf-open", name: "书库", sub: "藏书与读书笔记", icon: iconOf("bookshelf") },
    // 第二大脑（secondbrain 域，issue 251）：主面板统一入口（检索/对话/灵感参考都从面板进）
    { id: "secondbrain", commandId: "bz-secondbrain-panel", name: "第二大脑", sub: "笔记检索与问答", icon: iconOf("secondbrain") },
    { id: "belongings", commandId: "bz-belongings-open", name: "归物本", sub: "物品登记", icon: iconOf("belongings") },
    // 移动附件（attach 域）：2026-09-10 用户拍板自首页入口移除（命令仍可在命令面板调用）
    { id: "encrypt", commandId: "bz-encrypt-open", name: "保险库", sub: "密码·加密笔记·日记", icon: iconOf("encrypt") },
    // 密码本（password-vault 域，ADR-0109 拆回独立域；id 沿用合并前磁贴 id，旧钉选自动复活）
    { id: "vault", commandId: "bz-password-vault-open", name: "密码本", sub: "密码与密钥", icon: iconOf("vault") },
    { id: "settings", commandId: "bz-settings-panel-open", name: "设置", sub: "全域设置", icon: iconOf("settings") }
  ];
  var DOMAIN_MAP = new Map(DOMAINS.map((d) => [d.id, d]));
  var DOMAIN_DOT = {
    diary: "#e67341",
    memo: "#e8590c",
    recap: "#d64d8f",
    cinema: "#e6951d",
    review: "#7c5cd6",
    pomodoro: "#e5534b",
    favorites: "#f0b429",
    clipping: "#2f9e5f",
    knowledge: "#c2559d",
    bookshelf: "#3d7bd6",
    secondbrain: "#a33d2a",
    "reading-report": "#3fa7a0",
    belongings: "#45a35c",
    attach: "#8a8f99",
    encrypt: "#8a8f99",
    vault: "#c9a227",
    smartcat: "#e67341",
    settings: "#8a8f99"
  };
  var ALL_DOMAIN_IDS = DOMAINS.map((d) => d.id);
  function applyOrder(order, domains = DOMAINS) {
    if (!order || !order.length) return domains;
    const rank = /* @__PURE__ */ new Map();
    order.forEach((id, i) => {
      if (!rank.has(id)) rank.set(id, i);
    });
    const MISS = Number.MAX_SAFE_INTEGER;
    return [...domains].sort((a, b) => {
      var _a, _b;
      return ((_a = rank.get(a.id)) != null ? _a : MISS) - ((_b = rank.get(b.id)) != null ? _b : MISS);
    });
  }
  function reorderTo(order, id, toIndex, hidden = [], domains = DOMAINS) {
    const all = applyOrder(order, domains).map((d) => d.id);
    const off = new Set(hidden);
    const visible = all.filter((x) => !off.has(x));
    const from = visible.indexOf(id);
    if (from < 0 || toIndex < 0 || toIndex >= visible.length) return all;
    visible.splice(from, 1);
    visible.splice(toIndex, 0, id);
    return [...visible, ...all.filter((x) => off.has(x))];
  }
  function hiddenOf(order, scope) {
    return scope === "mob" ? order.hiddenMob : order.hiddenDesk;
  }
  function visibleDomains(order, hidden, domains = DOMAINS) {
    const hide = new Set(hidden != null ? hidden : []);
    return applyOrder(order, domains.filter((d) => !hide.has(d.id)));
  }
  function pomodoroMenuLabel(focusing) {
    return focusing ? "停止专注" : "开始专注";
  }
  var DOMAIN_MENU = {
    diary: [{ label: "写日记", commandId: "bz-diary-write", icon: "pen-line" }],
    memo: [{ label: "写备忘", commandId: "bz-memo-add", icon: "clipboard-list" }],
    cinema: [
      { label: "加影视", commandId: "bz-cinema-add", icon: "plus" },
      { label: "影视分析报告", commandId: "bz-cinema-analysis", icon: "bar-chart-3" }
    ],
    review: [
      { label: "开始复习", commandId: "bz-review-start", icon: "play" },
      { label: "加入复习计划", commandId: "bz-review-add", icon: "plus" },
      { label: "复习计划分析报告", commandId: "bz-review-report", icon: "bar-chart-3" }
    ],
    // 番茄钟：一把切换（专注中→停止；休息中→跳过休息再开；idle→开），命令 bz-pomodoro-focus-toggle。
    // 唯一动态文案项：label 由 ui.ts 按番茄钟实时相位改写为「停止专注 / 开始专注」（dynamic='focus'）
    pomodoro: [{ label: "开始专注", commandId: "bz-pomodoro-focus-toggle", icon: "timer", dynamic: "focus" }],
    favorites: [{ label: "加收藏", commandId: "bz-favorites-add", icon: "bookmark" }],
    knowledge: [
      { label: "术语生成文献笔记", commandId: "bz-knowledge-note-term", icon: "file-text" },
      { label: "视频生成文献笔记", commandId: "bz-knowledge-note-video", icon: "list-video" }
    ],
    bookshelf: [{ label: "阅读分析报告", commandId: "bz-reading-report-open", icon: "bar-chart-3" }],
    secondbrain: [
      { label: "第二大脑对话", commandId: "bz-secondbrain-chat", icon: "message-circle" },
      { label: "参考侧栏", commandId: "bz-secondbrain-open", icon: "zap" }
    ],
    belongings: [{ label: "加物品", commandId: "bz-belongings-add", icon: "archive" }],
    vault: [{ label: "快速生成密码", commandId: "bz-password-vault-gen", icon: "key" }]
  };
  function domainColor(id) {
    var _a;
    return (_a = DOMAIN_DOT[id]) != null ? _a : "#8a8f99";
  }
  function sheetHeadHtml(d, data) {
    var _a;
    const ct = (_a = riverCountText(d.id, data)) != null ? _a : d.sub;
    return '<div class="bz-home-sheet-head"><div class="bz-home-sheet-top"><span class="bz-home-sheet-ic" style="color:' + domainColor(d.id) + '">' + iconSpan(d.icon) + '</span><div class="bz-home-sheet-nm">' + esc(d.name) + '</div></div><div class="bz-home-sheet-sub">' + esc(ct) + "</div></div>";
  }
  var EMPTY_COUNTS = {
    diaryTotal: 0,
    memoOpen: 0,
    reviewTotal: 0,
    reviewOverdue: 0,
    reviewDueTomorrow: 0,
    cinemaWant: 0,
    cinemaWatching: 0,
    bookshelfReading: 0,
    bookshelfFinished: 0,
    clippingUnread: 0,
    favoritesTotal: 0,
    belongingsTotal: 0
  };
  var EMPTY_SUMMARY = {
    diary: 0,
    movies: 0,
    books: 0,
    memoDone: 0,
    memoCreated: 0,
    pomodoros: 0,
    pomodoroMinutes: 0
  };
  function p2(n) {
    return String(n).padStart(2, "0");
  }
  function dateStrOf(anchor) {
    const d = new Date(anchor);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }
  function fmtHm(t) {
    const d = new Date(t);
    return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  function headDateText(now = Date.now()) {
    const d = new Date(now);
    const wd = "日一二三四五六"[d.getDay()];
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} 周${wd} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  function dayOffsetMs(t) {
    const d = new Date(t);
    return d.getHours() * 36e5 + d.getMinutes() * 6e4 + d.getSeconds() * 1e3 + d.getMilliseconds();
  }
  function buildNotes(data) {
    const notes = [];
    const day = data.today;
    if (!day.events.length) return notes;
    if (day.firstTs !== null) {
      if (data.yesterday.firstTs !== null) {
        const diff = Math.round((dayOffsetMs(day.firstTs) - dayOffsetMs(data.yesterday.firstTs)) / 6e4);
        if (diff > 0) notes.push({ index: 0, text: `动手比昨天晚了 ${diff} 分钟，不过来了就好。` });
        else if (diff < 0) notes.push({ index: 0, text: `动手比昨天早了 ${-diff} 分钟，好开头。` });
        else notes.push({ index: 0, text: "和昨天几乎同一时间动手，节奏很稳。" });
      } else {
        notes.push({ index: 0, text: `今天第一笔动静在 ${fmtHm(day.firstTs)}。` });
      }
    }
    const last = day.events[day.events.length - 1];
    const evening = new Date(last.ts);
    evening.setHours(18, 0, 0, 0);
    if (!data.streak.diaryWrittenToday && data.streak.diaryStreak > 0 && last.ts >= evening.getTime()) {
      notes.push({ index: day.events.length - 1, text: `晚上效率回来了——但日记还空着，×${data.streak.diaryStreak} 连击在等你。` });
    }
    return notes;
  }
  function buildPreviews(data) {
    const c = data.counts;
    const t = data.today.summary;
    const s = data.streak;
    const out = [];
    if (c.reviewDueTomorrow > 0) {
      out.push({ h: `复习将到期 ${c.reviewDueTomorrow} 张`, b: "按 SRS 间隔推算，明天到期。今晚顺手过一遍队列，明天正好清干净。", go: "review", goLabel: "去复习计划 →" });
    } else if (c.reviewOverdue > 0) {
      out.push({ h: `还有 ${c.reviewOverdue} 张逾期卡`, b: "逾期是唯一会随时间变贵的债。约 4 分钟一张，还掉最划算。", go: "review", goLabel: "去还卡 →" });
    } else {
      out.push({ h: t.pomodoros > 0 ? `今天已专注 ${t.pomodoros} 轮` : "番茄引擎待命", b: "排一轮 25 分钟给明天最重要的那件事。", go: "pomodoro", goLabel: "开番茄钟 →" });
    }
    out.push(
      c.clippingUnread > 0 ? { h: `剪藏还压 ${c.clippingUnread} 篇`, b: "挑 1 篇放进明早：通勤读一篇，保持进出平衡。", go: "clipping", goLabel: "挑一篇放明早 →" } : { h: "剪藏库已清空", b: "库存干净了，明天遇到好文章放心收。", go: "clipping", goLabel: "去剪藏本 →" }
    );
    if (!s.diaryWrittenToday && s.diaryStreak > 0) {
      out.push({ h: `日记连击 ×${s.diaryStreak} 待续`, b: "写三行也算数。今晚补上，明天它自己接着长。", go: "diary", goLabel: "去写日记 →" });
    } else if (s.diaryWrittenToday) {
      out.push({ h: `今日日记已写 · 连击 ×${s.diaryStreak + 1}`, b: "明天同一时间回来续上，连击就是这么长起来的。", go: "diary", goLabel: "看日记本 →" });
    } else {
      out.push({ h: "给明天留一句话", b: "今晚写一篇日记，明晚它会变成日记本媒体墙上的新格子。", go: "diary", goLabel: "去写日记 →" });
    }
    return out;
  }
  function buildDots(data) {
    const day = data.today;
    const hasEvent = (d) => day.events.some((e) => e.domain === d);
    return {
      diary: day.summary.diary > 0 ? "ok" : data.streak.diaryStreak > 0 ? "warn" : "off",
      review: data.counts.reviewOverdue > 0 ? "hot" : "off",
      memo: day.summary.memoDone + day.summary.memoCreated > 0 ? "ok" : "off",
      pomodoro: day.summary.pomodoros > 0 ? "ok" : "off",
      cinema: hasEvent("cinema") ? "ok" : "off",
      bookshelf: hasEvent("bookshelf") ? "ok" : "off"
    };
  }
  function dotOf(dots, id) {
    var _a;
    return (_a = dots[id]) != null ? _a : "off";
  }
  function riverCountText(id, data) {
    const c = data.counts;
    switch (id) {
      case "diary":
        return `${c.diaryTotal} 篇${data.streak.diaryWrittenToday ? " · 今日已写" : ""}`;
      case "memo":
        return `${c.memoOpen} 条待办`;
      case "review":
        return c.reviewOverdue > 0 ? `${c.reviewTotal} 张 · 逾期 ${c.reviewOverdue}` : `${c.reviewTotal} 张在册`;
      case "cinema":
        return `想看 ${c.cinemaWant} · 在看 ${c.cinemaWatching}`;
      case "bookshelf":
        return `在读 ${c.bookshelfReading} · 读完 ${c.bookshelfFinished}`;
      case "clipping":
        return `未读 ${c.clippingUnread} 篇`;
      case "favorites":
        return `${c.favoritesTotal} 条`;
      case "belongings":
        return `登记 ${c.belongingsTotal} 件`;
      default:
        return null;
    }
  }

  // src/home/layouts/river/render.ts
  function panelFrameHtml() {
    return `
    <div class="bz-panel-frame bz-home-panel bz-panel-mtop">
      <div class="bz-home-head">
        <div class="bz-home-week" data-home-week></div>
        <span class="bz-home-date" data-home-date></span>
        <div role="button" tabindex="0" class="bz-home-close" data-home-close title="关闭" aria-label="关闭">${iconSpan("x")}</div>
      </div>
      <div class="bz-home-body">
        <div class="bz-home-grid">
          <div class="bz-home-entries" data-home-entries></div>
          <div class="bz-home-flow" data-home-flow></div>
          <div class="bz-home-next" data-home-next></div>
          <div class="bz-home-tiles" data-home-tiles></div>
        </div>
      </div>
    </div>`;
  }
  function loadingEntriesHtml() {
    return '<div class="bz-home-sec-t">全 部 域</div>';
  }
  function loadingFlowHtml() {
    return '<div class="bz-home-flow-empty">正在汇入今天的痕迹…</div>';
  }
  function weekHtml(week, todayDateStr, selDate) {
    return week.map((w) => {
      const isToday = w.dateStr === todayDateStr;
      return '<div role="button" tabindex="0" class="bz-home-wk' + (w.hit ? " bz-home-wk--hit" : "") + (w.dateStr === selDate ? " bz-home-wk--sel" : "") + '" data-home-weekday="' + w.dateStr + '" aria-label="' + (isToday ? "今天" : w.label) + (w.hit ? "，有动静" : "") + '"><i></i><span class="bz-home-wk-n">' + (isToday ? "今" : w.dayOfMonth) + "</span></div>";
    }).join("");
  }
  function entriesHtml(data, order, hidden) {
    const dotsMap = buildDots(data);
    return visibleDomains(order, hidden).map((d) => {
      var _a;
      const dot = dotOf(dotsMap, d.id);
      const ct = (_a = riverCountText(d.id, data)) != null ? _a : d.sub;
      return '<div role="button" tabindex="0" class="bz-home-erow" data-home-go="' + d.id + '"><span class="bz-home-dot bz-home-dot--' + dot + '"></span><span class="bz-home-eic" style="color:' + domainColor(d.id) + '">' + iconSpan(d.icon) + '</span><span class="bz-home-enm">' + esc(d.name) + '</span><span class="bz-home-ect">' + esc(ct) + '</span><span class="bz-home-ego">→</span></div>';
    }).join("");
  }
  function flowHtml(data, view) {
    var _a;
    const day = (_a = data.days.find((d) => d.dateStr === view)) != null ? _a : data.today;
    const isToday = day.dateStr === data.today.dateStr;
    const notes = isToday ? buildNotes(data) : [];
    const body = day.events.map((e, i) => {
      var _a2, _b, _c, _d;
      const note = notes.find((n) => n.index === i);
      const lastDiary = i === day.events.length - 1 && note && note.text.indexOf("日记") >= 0 ? " bz-home-ev--warn" : "";
      const memoId = e.domain;
      const dmColor = domainColor(memoId);
      const dmName = (_b = (_a2 = DOMAIN_MAP.get(memoId)) == null ? void 0 : _a2.name) != null ? _b : e.domain;
      const dmIcon = (_d = (_c = DOMAIN_MAP.get(memoId)) == null ? void 0 : _c.icon) != null ? _d : "";
      return '<div class="bz-home-ev' + lastDiary + '"><span class="bz-home-ev-tm">' + esc(e.timeLabel) + '</span><div class="bz-home-ev-bd"><div class="bz-home-ev-tx"><span class="bz-home-ev-dm" style="background:' + dmColor + '">' + iconSpan(dmIcon) + esc(dmName) + "</span>" + esc(e.text) + "</div>" + (note ? '<div class="bz-home-ev-note">' + esc(note.text) + "</div>" : "") + "</div></div>";
    }).join("");
    const empty = '<div class="bz-home-flow-empty">这一天还没有留下痕迹。<br><b>写一篇日记</b>、点一轮番茄、读几页书——<br>都会出现在这条河里。</div>';
    return day.events.length ? '<div class="bz-home-timeline">' + body + "</div>" : empty;
  }
  function nextHtml(data) {
    return '<div class="bz-home-sec-t bz-home-sec-t--ai">明 天 预 告</div>' + buildPreviews(data).map(
      (pr) => '<div role="button" tabindex="0" class="bz-home-pr" data-home-go="' + pr.go + '"><div class="bz-home-pr-h">' + esc(pr.h) + "</div><div>" + esc(pr.b) + '</div><span class="bz-home-pr-go">' + esc(pr.goLabel) + "</span></div>"
    ).join("");
  }
  function tilesHtml(data, order, hidden) {
    const dotsMap = buildDots(data);
    return '<div class="bz-home-m-tiles">' + visibleDomains(order, hidden).map((d) => {
      var _a;
      const dot = dotOf(dotsMap, d.id);
      const ct = (_a = riverCountText(d.id, data)) != null ? _a : d.sub;
      return '<div role="button" tabindex="0" class="bz-home-m-tile" data-home-go="' + d.id + '"><span class="bz-home-dot bz-home-dot--' + dot + '"></span><span class="bz-home-eic" style="color:' + domainColor(d.id) + '">' + iconSpan(d.icon) + '</span><span class="bz-home-enm">' + esc(d.name) + '</span><span class="bz-home-ect">' + esc(ct) + "</span></div>";
    }).join("") + "</div>";
  }
  return __toCommonJS(render_exports);
})();

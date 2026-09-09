/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/review/render.ts → window.BZR_review（评审壳预览包，ADR-0104） */
var BZR_review = (() => {
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

  // src/review/render.ts
  var render_exports = {};
  __export(render_exports, {
    cardHtml: () => cardHtml,
    currentRPct: () => currentRPct,
    difficultyDialogHtml: () => difficultyDialogHtml,
    dueLabelOf: () => dueLabelOf,
    esc: () => esc,
    icon: () => icon,
    isPlayable: () => isPlayable,
    markHtml: () => markHtml,
    queueViewHtml: () => queueViewHtml,
    reviewBarHtml: () => reviewBarHtml,
    sortColumn: () => sortColumn,
    sprintAsideHtml: () => sprintAsideHtml,
    sprintBodyHtml: () => sprintBodyHtml,
    sprintHeadHtml: () => sprintHeadHtml,
    sprintLoadingHtml: () => sprintLoadingHtml,
    sprintQuestionHtml: () => sprintQuestionHtml,
    sprintResultHtml: () => sprintResultHtml,
    sprintSummaryHtml: () => sprintSummaryHtml,
    stageNum: () => stageNum,
    stageTagHtml: () => stageTagHtml,
    todayLabel: () => todayLabel
  });

  // src/review/fsrs.ts
  var DEFAULT_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 1.26, 0.07, 0.35, 2.06, 0.57, 0.09, 0.05, 0.33, 2.15];
  var DEFAULT_D = 0.9;
  var FSRS = class {
    constructor(w = DEFAULT_W, d = DEFAULT_D) {
      this.w = w;
      this.d = d;
    }
    /** 记忆保留度：R(t, S) = (1 + t/(S·d))^-d */
    R(t, S) {
      return Math.pow(1 + t / (S * this.d), -this.d);
    }
    /** 初始稳定性 */
    initS(rating) {
      const map = { again: 0, hard: 1, good: 2, easy: 3 };
      return this.w[map[rating]] || 1;
    }
    /** 下一难度 */
    nextDiff(D, rating) {
      let newD;
      if (rating === "again") newD = this.w[4];
      else if (rating === "hard") newD = D + this.w[5];
      else if (rating === "easy") newD = D + this.w[6];
      else newD = D;
      return Math.max(0, Math.min(1, newD));
    }
    /** 下一稳定性 */
    nextStab(S, D, rating, R) {
      if (rating === "again") {
        return this.w[11] * Math.pow(D, -this.w[12]) * (Math.pow(S + 1, this.w[13]) - 1) * Math.exp(this.w[14] * R);
      }
      const base = Math.exp(this.w[8]) * (11 - D) * Math.pow(S, -this.w[9]) * (Math.exp(this.w[10] * (1 - R)) - 1);
      if (rating === "hard") return S * base;
      if (rating === "good") return S * (base + 1);
      return S * base * (Math.exp(this.w[17]) + 1);
    }
    /** 下一间隔（天） */
    nextInterval(S, D, rating, R) {
      const newD = this.nextDiff(D, rating);
      const newS = Math.max(0.01, this.nextStab(S, newD, rating, R));
      return { S: newS, D: newD, days: newS };
    }
  };
  var FSRS_FIRST_INTERVALS = [1 / 1440, 1 / 48, 1 / 4, 1, 3, 7, 15, 30, 60, 120];
  var TOTAL_STAGES = 10;

  // src/review/stats.ts
  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function historyOf(item) {
    return (item.reviewHistory || []).map((h) => ({
      timestamp: h.timestamp,
      rating: h.rating,
      stage: h.stage,
      stability: h.stability,
      difficulty: h.difficulty,
      R: h.R
    }));
  }
  function flattenHistory(items) {
    return items.flatMap((i) => historyOf(i).map((h) => ({ ...h, filePath: i.filePath })));
  }
  function computeStats(items, opts) {
    const history = flattenHistory(items);
    const days = /* @__PURE__ */ new Set();
    for (const h of history) days.add(dateKey(new Date(h.timestamp)));
    const totalReviews = days.size;
    const todayKey = dateKey(/* @__PURE__ */ new Date());
    let streak = 0;
    let cursor = /* @__PURE__ */ new Date();
    if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    const todayCount = history.filter((h) => dateKey(new Date(h.timestamp)) === todayKey).length;
    const ratingDist = { again: 0, hard: 0, good: 0, easy: 0 };
    for (const h of history) {
      if (h.rating in ratingDist) ratingDist[h.rating]++;
    }
    const active2 = items.filter((i) => !i.completed && !i.isCompleted);
    const overdue = active2.filter((i) => i.isOverdue);
    const overdueRate = active2.length ? overdue.length / active2.length : 0;
    const rFsrs = new FSRS((opts == null ? void 0 : opts.w) || DEFAULT_W);
    let rSum = 0;
    let rN = 0;
    for (const i of items) {
      if (i.phase === "fsrs" && i.stability && i.lastReviewed) {
        const t = ((/* @__PURE__ */ new Date()).getTime() - new Date(i.lastReviewed).getTime()) / 864e5;
        if (t > 0) {
          rSum += rFsrs.R(t, i.stability);
          rN++;
        }
      }
    }
    const avgR = rN ? rSum / rN : null;
    let firstReviewAt = null;
    if (history.length) {
      const ts = history.map((h) => new Date(h.timestamp).getTime());
      firstReviewAt = new Date(Math.min(...ts)).toISOString();
    }
    const daily7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const count = history.filter((h) => dateKey(new Date(h.timestamp)) === key).length;
      daily7.push({ date: key, count });
    }
    const reviewedNotes = new Set(history.filter((h) => h.filePath).map((h) => h.filePath)).size;
    return {
      totalReviews,
      streak,
      todayReviews: todayCount,
      ratingDist,
      overdueRate,
      avgR,
      reviewedNotes,
      firstReviewAt,
      daily7
    };
  }

  // src/review/queue.ts
  var DEFAULT_R_THRESHOLD = 0.9;
  function isDueToday(item) {
    if (!item.nextReviewDate) return false;
    return dateKey(new Date(item.nextReviewDate)) === dateKey(/* @__PURE__ */ new Date());
  }
  function isEarlyDue(item, rThreshold, w) {
    if (item.phase !== "fsrs" || !item.stability || !item.lastReviewed) return false;
    const t = (Date.now() - new Date(item.lastReviewed).getTime()) / 864e5;
    if (!(t > 0)) return false;
    return new FSRS(w).R(t, item.stability) < rThreshold;
  }
  function active(i) {
    return !i.isCompleted && !i.completed && !i.isMissing;
  }
  function partitionQueue(items, rThreshold = DEFAULT_R_THRESHOLD, w = DEFAULT_W) {
    const overdue = [];
    const today = [];
    const future = [];
    const done = [];
    for (const i of items) {
      if (!active(i)) {
        done.push(i);
        continue;
      }
      if (i.isOverdue) overdue.push(i);
      else if (isDueToday(i) || isEarlyDue(i, rThreshold, w)) today.push(i);
      else future.push(i);
    }
    return { overdue, today, future, done };
  }

  // src/review/render.ts
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  }
  function icon(name, extra = "bz-q-ic") {
    return `<span class="bz-ic${extra ? " " + extra : ""}" data-lucide="${name}"></span>`;
  }
  function markHtml(kind, size = "") {
    if (kind === "ok") return `<span class="bz-mark ok ${size}"><i data-lucide="check"></i></span>`;
    return `<span class="bz-mark bad ${size}"><i data-lucide="x"></i></span>`;
  }
  function todayLabel(now = /* @__PURE__ */ new Date()) {
    const week = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    return `${now.getMonth() + 1}月${now.getDate()}日 周${week}`;
  }
  function dueLabelOf(item, now = Date.now()) {
    if (item.isMissing) return { label: "文件缺失", cls: "is-missing" };
    if (item.isCompleted) return { label: "已完成", cls: "is-done" };
    if (!item.nextReviewDate) return { label: "待定", cls: "is-future" };
    const diff = new Date(item.nextReviewDate).getTime() - now;
    if (diff > 0) {
      const days = Math.floor(diff / 864e5);
      const hours = Math.floor(diff % 864e5 / 36e5);
      if (days > 0) return { label: `${days} 天后`, cls: "is-future" };
      if (hours > 0) return { label: `${hours} 小时后`, cls: "is-future" };
      return { label: `${Math.max(1, Math.floor(diff / 6e4))} 分钟后`, cls: "is-future" };
    }
    return { label: "已逾期", cls: "is-overdue" };
  }
  function isPlayable(item, now = Date.now()) {
    if (item.isMissing || item.isCompleted || item.completed) return false;
    if (!item.nextReviewDate) return false;
    return new Date(item.nextReviewDate).getTime() <= now;
  }
  function currentRPct(item, w = DEFAULT_W, now = Date.now()) {
    if (item.phase !== "fsrs" || !item.stability || !item.lastReviewed) return null;
    const t = (now - new Date(item.lastReviewed).getTime()) / 864e5;
    if (!(t > 0)) return null;
    return Math.round(new FSRS(w).R(t, item.stability) * 100);
  }
  function stageNum(item) {
    var _a;
    if (item.isMissing) return "挂起";
    if (item.phase === "fsrs") {
      const LADDER_MAX = 9;
      return `FSRS Lv.${item.stage - LADDER_MAX + 1}`;
    }
    return `${(_a = item.currentStage) != null ? _a : item.stage + 1}/${TOTAL_STAGES}`;
  }
  function stageTagHtml(item, w = DEFAULT_W, now = Date.now()) {
    var _a;
    if (item.completed) return '<span class="bz-q-tag is-done">已完成</span>';
    if (item.phase === "fsrs") {
      const r = currentRPct(item, w, now);
      if (r !== null) {
        const cls = r >= 90 ? "r-high" : r >= 70 ? "r-mid" : "r-low";
        return `<span class="bz-q-tag is-r ${cls}">R=${r}%</span>`;
      }
      return `<span class="bz-q-tag is-r">FSRS</span>`;
    }
    return `<span class="bz-q-tag is-stage">阶段 ${(_a = item.currentStage) != null ? _a : item.stage + 1}/${TOTAL_STAGES}</span>`;
  }
  function sortColumn(items, now = Date.now()) {
    return items.slice().sort((a, b) => {
      var _a, _b;
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const ra = a.phase === "fsrs" && a.stability ? (_a = currentRPct(a, DEFAULT_W, now)) != null ? _a : 999 : 999;
      const rb = b.phase === "fsrs" && b.stability ? (_b = currentRPct(b, DEFAULT_W, now)) != null ? _b : 999 : 999;
      if (ra !== rb) return ra - rb;
      return new Date(a.nextReviewDate || 0).getTime() - new Date(b.nextReviewDate || 0).getTime();
    });
  }
  function colHead(count, name) {
    return `<div class="bz-q-col-head"><span class="cnt">${count}</span><span class="name">${name}</span></div>`;
  }
  function cardHtml(item, ctx = {}) {
    var _a, _b, _c;
    const now = (_a = ctx.now) != null ? _a : Date.now();
    const w = (_b = ctx.w) != null ? _b : DEFAULT_W;
    const due = dueLabelOf(item, now);
    const canPlay = isPlayable(item, now) && !item.isMissing;
    const title = item.isCompleted ? `<s>${esc(item.name)}</s>` : esc(item.name);
    const cls = [
      "bz-q-card",
      item.isOverdue ? "danger" : "",
      item.isCompleted ? "done" : "",
      canPlay ? "" : "no",
      item.isMissing ? "missing" : ""
    ].join(" ").trim();
    const tags = [
      item.isMissing ? `<span class="bz-q-tag is-missing">文件缺失</span>` : `<span class="bz-q-tag ${due.cls}">${due.label}</span>`,
      // R 阈值提前复习卡挂「提前」tag（与开始本轮同口径，落「今天」列）
      !item.isMissing && isEarlyDue(item, (_c = ctx.rThreshold) != null ? _c : 0.9, w) ? `<span class="bz-q-tag is-early">提前</span>` : "",
      // V1 原型拍板（issue 253）：待重做旗标显性化——挂红 tag 提示「这题忘了要重做」
      item.pendingRedo && !item.isCompleted ? `<span class="bz-q-tag is-redo">待重做</span>` : "",
      stageTagHtml(item, w, now)
    ].join("");
    return `
      <div class="${cls}" data-id="${item.id}" role="button" tabindex="0" aria-disabled="${canPlay ? "false" : "true"}">
        <div class="bz-q-card-top"><span class="bz-q-card-title">${title}</span><span class="bz-q-card-stage">${item.isMissing ? "挂起" : stageNum(item)}</span></div>
        <div class="bz-q-card-meta">${tags}</div>
      </div>`;
  }
  function cardsOf(items, ctx) {
    if (!items.length) return `<div class="bz-q-hint">没有条目</div>`;
    return items.map((it) => cardHtml(it, ctx)).join("");
  }
  function queueViewHtml(items, ctx = {}) {
    var _a, _b, _c;
    const now = (_a = ctx.now) != null ? _a : Date.now();
    const w = (_b = ctx.w) != null ? _b : DEFAULT_W;
    const rt = (_c = ctx.rThreshold) != null ? _c : 0.9;
    const full = { ...ctx, now, w, rThreshold: rt };
    const col = partitionQueue(items, rt, w);
    const head = `
      <div class="bz-panel-head">
        <div class="bz-panel-brand">${icon("repeat-2", "bz-ic--sm")}</div>
        <div class="bz-panel-title">复习计划</div>
        <div class="bz-panel-head-pipe"></div>
        <div class="bz-panel-head-sub">${todayLabel(new Date(now))}</div>
        <span class="bz-panel-head-sp"></span>
        <div class="bz-panel-head-btns">
          <!-- ⚙设置直达钮两端退役（issue 254 迭代拍板，设置走插件设置页）；✕ 桌面隐藏
              （styles.css ≥769px 规则，点遮罩/ESC 关），仅移动端全屏保留 -->
          <button class="bz-icon-btn" data-act="close" title="关闭">${icon("x")}</button>
      </div>
      </div>`;
    if (!items.length) {
      const strip2 = `
      <div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">还没有任何复习条目</span>
      </div>`;
      return `<div class="bz-q-view">${head}${strip2}<div class="bz-q-cols bz-q-empty-wrap"><div data-empty-host></div></div></div>`;
    }
    const clearToday = col.overdue.length + col.today.length === 0;
    const futureCount = col.future.length;
    const strip = ctx.showArchived ? `<div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>已完成复习</strong>
      </div>` : clearToday ? `<div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">${futureCount ? `未来还有 ${futureCount} 篇待复习` : "没有待复习条目"}</span>
      </div>` : `<div class="bz-q-strip">
        <span class="bz-q-strip-dot"></span>
        <strong>开始本轮</strong>
        <span class="bz-q-strip-txt">今日 ${col.today.length} 篇到期 · 逾期 ${col.overdue.length} 篇顺延</span>
        <button class="bz-btn bz-btn--primary" data-act="begin">开始本轮</button>
      </div>`;
    const body = ctx.showArchived ? `<div class="bz-q-cols"><div class="bz-q-col done">${colHead(col.done.length, "已完成")}${cardsOf(sortColumn(col.done, now), full)}</div></div>` : `<div class="bz-q-cols">
          <div class="bz-q-col danger">${colHead(col.overdue.length, "已逾期")}${cardsOf(sortColumn(col.overdue, now), full)}</div>
          <div class="bz-q-col warn">${colHead(col.today.length, "今天到期")}${cardsOf(sortColumn(col.today, now), full)}</div>
          <div class="bz-q-col future">${colHead(col.future.length, "未来")}${cardsOf(sortColumn(col.future, now), full)}</div>
        </div>`;
    const stats = computeStats(items);
    const archItem = ctx.showArchived ? `<span class="bz-q-fitem bz-touch-target--lg is-back" data-act="arch" title="点此返回队列">
        ${icon("undo-2")}<span class="lbl">返回队列</span>
      </span>` : `<span class="bz-q-fitem bz-touch-target--lg" data-act="arch" title="查看已完成复习">
        ${icon("folder")}<span class="lbl">已完成 <b>${col.done.length}</b> 篇</span>
      </span>`;
    const footer = `
      <div class="bz-q-footer">
        ${archItem}
        <i class="sep"></i>
        <span class="bz-q-fitem bz-touch-target--lg" data-act="stats" title="查看复习统计分布">
          ${icon("bar-chart-3")}<span class="lbl">累计 <b>${stats.totalReviews}</b> 天 · 连续 <b>${stats.streak}</b> 天</span>
        </span>
      </div>`;
    return `<div class="bz-q-view">${head}${strip}${body}${footer}</div>`;
  }
  function sprintHeadHtml() {
    return `
      <div class="bz-sprint-head">
        <div class="t">
          <div class="bz-sprint-title">做题冲刺</div>
        </div>
        <div class="tools">
          <button class="bz-icon-btn" data-action="skip" title="跳过此篇（不评级，移到队尾）">${icon("skip-forward", "bz-sprint-ic")}</button>
          <button class="bz-icon-btn" data-action="quit" title="回面板">${icon("x", "bz-sprint-ic")}</button>
        </div>
      </div>`;
  }
  function sprintLoadingHtml() {
    return `<div class="bz-sprint-loading"><span class="spinner"></span>正在获取题目…</div>`;
  }
  function sprintOptsHtml(q, answered, sel, lastCorrect) {
    return q.options.map((opt, i) => {
      const isSel = sel.includes(i);
      let extra = "";
      if (answered) {
        if (q.correctIndices.includes(i)) extra = " is-correct";
        else if (isSel) extra = " is-wrong";
      } else if (isSel) extra = " is-sel";
      const m = answered && q.correctIndices.includes(i) ? markHtml("ok") : answered && isSel && !q.correctIndices.includes(i) ? markHtml("bad") : "";
      return `
          <div class="bz-sprint-opt${extra}${answered ? " is-disabled" : ""}" data-i="${i}" role="button" tabindex="${answered ? "-1" : "0"}" aria-disabled="${answered ? "true" : "false"}">
            <span class="k">${"ABCD"[i]}</span>
            <span class="t">${esc(opt)}</span>
            <span class="m">${m}</span>
          </div>`;
    }).join("");
  }
  function sprintQuestionHtml(entry, question, st) {
    const single = question.correctIndices.length === 1;
    const total = entry.questions.length;
    const done = entry.doneCount;
    const optsHtml = sprintOptsHtml(question, st.answered, st.sel, st.lastCorrect);
    const needSubmit = !single && !st.answered;
    const lastWrong = st.answered && !st.lastCorrect && !st.remaining;
    const nextBtn = st.answered && !st.lastCorrect && st.remaining ? `<button class="bz-btn bz-btn--primary" data-action="next">下一题 →</button>` : lastWrong ? `<button class="bz-btn bz-btn--primary" data-action="note">${icon("flag", "bz-sprint-ic")} 结束并结算</button>` : "";
    const submit = needSubmit ? `<button class="bz-btn bz-btn--primary bz-sprint-submit" data-action="submit">提交答案</button>` : "";
    const explain = st.answered && !st.lastCorrect && question.explain ? `<div class="bz-sprint-explain">${esc(question.explain)}</div>` : "";
    return `
      <div class="bz-sprint-qtop">
        <span class="bz-sprint-progress">${done + 1}/${total}</span>
      </div>
      <div class="bz-sprint-qcard">
        <div class="bz-sprint-qtype">${single ? "单选" : "多选"}</div>
        <div class="bz-sprint-qtext">${esc(question.question)}</div>
        <div class="bz-sprint-opts">${optsHtml}</div>
        ${explain}
        ${submit}
        ${nextBtn ? `<div class="bz-sprint-qfoot">${nextBtn}</div>` : ""}
      </div>`;
  }
  function sprintAsideHtml(entries) {
    const rows = entries.map((e) => {
      const name = esc(e.name);
      if (e.state === "passed") return `<div class="bz-sq-item passed"><span class="nm"><s>${name}</s></span></div>`;
      if (e.state === "failed") return `<div class="bz-sq-item failed"><span class="nm">${name}</span></div>`;
      if (e.state === "doing") return `<div class="bz-sq-item doing"><span class="nm">${name}</span></div>`;
      return `<div class="bz-sq-item"><span class="nm">${name}</span></div>`;
    }).join("");
    return `
      <div class="bz-sq-head"><b>本轮队列</b></div>
      <div class="bz-sq-list">${rows || '<div class="bz-empty"><div class="bz-empty-title">队列完毕</div></div>'}</div>`;
  }
  function sprintBodyHtml(mainHtml, entries) {
    return `
      <div class="bz-sprint-body">
        <div class="bz-sprint-main">${mainHtml}</div>
        <aside class="bz-sprint-queue">${sprintAsideHtml(entries)}</aside>
      </div>`;
  }
  function sprintResultHtml(p) {
    const total = p.acc + p.wrong;
    const inner = p.passed ? `
        <div class="bz-result-ic">${markHtml("ok", "lg")}</div>
        <div class="bz-result-name">${esc(p.name)}</div>
        <div class="bz-result-score">${p.acc}<span class="sl">/${total}</span></div>
        <span class="bz-result-rating pass">${p.ratingLine}</span>
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="next">${p.nextLabel}</button>
        ${p.showEnd ? `<button class="bz-btn bz-btn--ghost bz-btn--block" data-action="end">结束这次复习</button>` : ""}` : `
        <div class="bz-result-ic bad">${markHtml("bad", "lg")}</div>
        <div class="bz-result-name">${esc(p.name)}</div>
        <div class="bz-result-score">${p.acc}<span class="sl">/${total}</span></div>
        <span class="bz-result-rating fail">${p.ratingLine}</span>
        <button class="bz-btn bz-btn--danger bz-btn--block" data-action="note">${icon("file-text", "bz-sprint-ic")} 复习此笔记 · 打开原文</button>`;
    return `<div class="bz-result">${inner}</div>`;
  }
  function sprintSummaryHtml(p) {
    return `
      <div class="bz-summary">
        <div class="bz-summary-title">本轮复习完成</div>
        <div class="bz-summary-stats">
          <div class="st"><b>${p.total}</b><span>复习篇数</span></div>
          <div class="st"><b>${p.passed}</b><span>通过</span></div>
          <div class="st ${p.failed ? "warn" : ""}"><b>${p.failed}</b><span>未通过</span></div>
        </div>
        ${p.streak > 0 ? `<div class="bz-summary-streak">连续复习 <b>${p.streak}</b> 天</div>` : ""}
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="done">完成 · 回到复习计划</button>
      </div>`;
  }
  function difficultyDialogHtml(item) {
    return `
      <h4>标记复习：${esc(item.name)}</h4>
      <button class="diff-btn" data-diff="again">忘了（Again）</button>
      <button class="diff-btn" data-diff="hard">困难（Hard）</button>
      <button class="diff-btn" data-diff="good">一般（Good）</button>
      <button class="diff-btn" data-diff="easy">简单（Easy）</button>
      <button class="diff-btn diff-btn-cancel" data-diff="cancel">取消</button>
    `;
  }
  function reviewBarHtml(p) {
    const names = { again: "忘了", hard: "困难", good: "一般", easy: "简单" };
    const btns = ["again", "hard", "good", "easy"].map((r) => `<button class="bz-review-bar-btn bz-touch-target--sm is-${r}" data-rating="${r}">${names[r]}</button>`).join("");
    return `
    <span class="bz-review-bar-info">${esc(p.name.replace(/^《|》$/g, ""))}<i>(${p.index}/${p.total})</i></span>
    <span class="bz-review-bar-act">${btns}
      <button class="bz-review-bar-btn bz-touch-target--sm is-skip" data-rating="skip">${"跳过"}</button>
    </span>`;
  }
  return __toCommonJS(render_exports);
})();

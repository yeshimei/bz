/**
 * 复习计划渲染纯层（issue 253：markup 单源收编，ADR-0104/0106 范式）
 *
 * markup 唯一出处：三区队列（头行/工具行/开始本轮条/三区列/底部信息行/空态宿主）、
 * 整窗冲刺（头行/加载/题卡/本轮队列/结果卡/结算屏）、难度弹窗、悬浮迷你评级条。
 * 插件 ui.ts / sprint.ts 与评审壳 prototype.html 消费同一份（壳经 esbuild →
 * prototype-render.js 挂 window.BZR_review）。
 *
 * 纯度契约（tests/core/render-purity.test.ts）：import 图仅限本域 + 零模块级可变状态；
 * 禁 obsidian/moment/core 服务。日期一律「now 参数注入」——可测、可评审壳重放。
 */
import type { ReviewItem } from './data';
import { FSRS, DEFAULT_W, TOTAL_STAGES } from './fsrs';
import { partitionQueue, isEarlyDue } from './queue';
import { computeStats } from './stats';

/** 题面结构面（对齐 quiz-core/manager 的 QuizQuestion；此处只读 markup 所需字段） */
interface QuestionLike {
  question: string;
  options: string[];
  correctIndices: number[];
  explain?: string;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** HTML 转义（评审壳与插件同源；勿在两侧另写） */
export function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

/** lucide 占位（默认挂 .bz-q-ic 域内尺寸钩子；渲染后组件库 mountIcons 统一替换） */
export function icon(name: string, extra = 'bz-q-ic'): string {
  return `<span class="bz-ic${extra ? ' ' + extra : ''}" data-lucide="${name}"></span>`;
}

/** 对错标记（lucide check/x 占位；尺寸随 .bz-mark 字号档） */
export function markHtml(kind: 'ok' | 'bad', size: '' | 'lg' = ''): string {
  if (kind === 'ok') return `<span class="bz-mark ok ${size}"><i data-lucide="check"></i></span>`;
  return `<span class="bz-mark bad ${size}"><i data-lucide="x"></i></span>`;
}

/** 头行日期副题：9月9日 周三 */
export function todayLabel(now: Date = new Date()): string {
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  return `${now.getMonth() + 1}月${now.getDate()}日 周${week}`;
}

// ==================== 到期/阶段口径 ====================

/** 到期标签（missing → 文件缺失；无排期 → 待定；未来按 天/小时/分钟；其余已逾期） */
export function dueLabelOf(item: ReviewItem, now: number = Date.now()): { label: string; cls: string } {
  if (item.isMissing) return { label: '文件缺失', cls: 'is-missing' };
  if (item.isCompleted) return { label: '已完成', cls: 'is-done' };
  if (!item.nextReviewDate) return { label: '待定', cls: 'is-future' };
  const diff = new Date(item.nextReviewDate).getTime() - now;
  if (diff > 0) {
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return { label: `${days} 天后`, cls: 'is-future' };
    if (hours > 0) return { label: `${hours} 小时后`, cls: 'is-future' };
    return { label: `${Math.max(1, Math.floor(diff / 60000))} 分钟后`, cls: 'is-future' };
  }
  return { label: '已逾期', cls: 'is-overdue' };
}

/** 是否可做题（到期：逾期/今天；已完成/挂起/未来 → 不可） */
export function isPlayable(item: ReviewItem, now: number = Date.now()): boolean {
  if (item.isMissing || item.isCompleted || item.completed) return false;
  if (!item.nextReviewDate) return false;
  return new Date(item.nextReviewDate).getTime() <= now;
}

/** FSRS 相位当前保留率 %（与调度排期同权重源；阶梯/无 lastReviewed → null） */
export function currentRPct(item: ReviewItem, w: number[] = DEFAULT_W, now: number = Date.now()): number | null {
  if (item.phase !== 'fsrs' || !item.stability || !item.lastReviewed) return null;
  const t = (now - new Date(item.lastReviewed).getTime()) / 86400000;
  if (!(t > 0)) return null;
  return Math.round(new FSRS(w).R(t, item.stability) * 100);
}

/** 卡片右上阶段号（FSRS Lv.n / 阶梯 n/10 / 挂起） */
export function stageNum(item: ReviewItem): string {
  if (item.isMissing) return '挂起';
  if (item.phase === 'fsrs') {
    const LADDER_MAX = 9;
    return `FSRS Lv.${item.stage - LADDER_MAX + 1}`;
  }
  return `${item.currentStage ?? item.stage + 1}/${TOTAL_STAGES}`;
}

/** 阶段标签（FSRS=R% 分档色 / 阶梯=阶段 n/10 / 已完成） */
export function stageTagHtml(item: ReviewItem, w: number[] = DEFAULT_W, now: number = Date.now()): string {
  if (item.completed) return '<span class="bz-q-tag is-done">已完成</span>';
  if (item.phase === 'fsrs') {
    const r = currentRPct(item, w, now);
    if (r !== null) {
      const cls = r >= 90 ? 'r-high' : r >= 70 ? 'r-mid' : 'r-low';
      return `<span class="bz-q-tag is-r ${cls}">R=${r}%</span>`;
    }
    return `<span class="bz-q-tag is-r">FSRS</span>`;
  }
  return `<span class="bz-q-tag is-stage">阶段 ${item.currentStage ?? item.stage + 1}/${TOTAL_STAGES}</span>`;
}

/** 列内排序（V1 拍板：置顶 → R 升序 → 到期时间；阶梯无 R 视为最低优先级靠后） */
export function sortColumn(items: ReviewItem[], now: number = Date.now()): ReviewItem[] {
  return items.slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const ra = a.phase === 'fsrs' && a.stability ? currentRPct(a, DEFAULT_W, now) ?? 999 : 999;
    const rb = b.phase === 'fsrs' && b.stability ? currentRPct(b, DEFAULT_W, now) ?? 999 : 999;
    if (ra !== rb) return ra - rb;
    return new Date(a.nextReviewDate || 0).getTime() - new Date(b.nextReviewDate || 0).getTime();
  });
}

// ==================== 三区队列视图 ====================

export interface QueueViewCtx {
  now?: number;
  showArchived?: boolean;
  /** R 阈值（提前复习判定；与开始本轮同源） */
  rThreshold?: number;
  /** 调度权重源（拟合权重；缺省回退 DEFAULT_W） */
  w?: number[];
}

function colHead(count: number, name: string): string {
  return `<div class="bz-q-col-head"><span class="cnt">${count}</span><span class="name">${name}</span></div>`;
}

export function cardHtml(item: ReviewItem, ctx: QueueViewCtx = {}): string {
  const now = ctx.now ?? Date.now();
  const w = ctx.w ?? DEFAULT_W;
  const due = dueLabelOf(item, now);
  const canPlay = isPlayable(item, now) && !item.isMissing;
  const title = item.isCompleted ? `<s>${esc(item.name)}</s>` : esc(item.name);
  const cls = [
    'bz-q-card',
    item.isOverdue ? 'danger' : '',
    item.isCompleted ? 'done' : '',
    canPlay ? '' : 'no',
    item.isMissing ? 'missing' : '',
  ].join(' ').trim();
  const tags = [
    item.isMissing ? `<span class="bz-q-tag is-missing">文件缺失</span>` : `<span class="bz-q-tag ${due.cls}">${due.label}</span>`,
    // R 阈值提前复习卡挂「提前」tag（与开始本轮同口径，落「今天」列）
    !item.isMissing && isEarlyDue(item, ctx.rThreshold ?? 0.9, w) ? `<span class="bz-q-tag is-early">提前</span>` : '',
    // V1 原型拍板（issue 253）：待重做旗标显性化——挂红 tag 提示「这题忘了要重做」
    item.pendingRedo && !item.isCompleted ? `<span class="bz-q-tag is-redo">待重做</span>` : '',
    stageTagHtml(item, w, now),
  ].join('');
  return `
      <div class="${cls}" data-id="${item.id}" role="button" tabindex="0" aria-disabled="${canPlay ? 'false' : 'true'}">
        <div class="bz-q-card-top"><span class="bz-q-card-title">${title}</span><span class="bz-q-card-stage">${item.isMissing ? '挂起' : stageNum(item)}</span></div>
        <div class="bz-q-card-meta">${tags}</div>
      </div>`;
}

function cardsOf(items: ReviewItem[], ctx: QueueViewCtx): string {
  if (!items.length) return `<div class="bz-q-hint">没有条目</div>`;
  return items.map((it) => cardHtml(it, ctx)).join('');
}

/** 三区队列整视图（头行 + 开始本轮条 + 三区列/归档列 + 底部信息行）；搜索框已退役（issue 254 迭代） */
export function queueViewHtml(items: ReviewItem[], ctx: QueueViewCtx = {}): string {
  const now = ctx.now ?? Date.now();
  const w = ctx.w ?? DEFAULT_W;
  const rt = ctx.rThreshold ?? 0.9;
  const full: QueueViewCtx = { ...ctx, now, w, rThreshold: rt };
  const col = partitionQueue(items, rt, w);

  const head = `
      <div class="bz-panel-head">
        <div class="bz-panel-brand">${icon('repeat-2', 'bz-ic--sm')}</div>
        <div class="bz-panel-title">复习计划</div>
        <div class="bz-panel-head-pipe"></div>
        <div class="bz-panel-head-sub">${todayLabel(new Date(now))}</div>
        <span class="bz-panel-head-sp"></span>
        <div class="bz-panel-head-btns">
          <!-- ⚙设置直达钮两端退役（issue 254 迭代拍板，设置走插件设置页）；✕ 桌面隐藏
              （styles.css ≥769px 规则，点遮罩/ESC 关），仅移动端全屏保留 -->
          <button class="bz-icon-btn" data-act="close" title="关闭">${icon('x')}</button>
      </div>
      </div>`;

  // 空库 → 头行 + 清空条 + 空态宿主（uiEmpty 由 ui.ts 挂载并绑两条路动作）
  if (!items.length) {
    const strip = `
      <div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">还没有任何复习条目</span>
      </div>`;
    return `<div class="bz-q-view">${head}${strip}<div class="bz-q-cols bz-q-empty-wrap"><div data-empty-host></div></div></div>`;
  }

  // item 8：今日全清（开始本轮集合为空 = 逾期/今日/提前全无）→ 绿点 +「今日已清空」+ 隐藏主按钮
  // （partitionQueue 的 today 列已含提前卡 → overdue+today 与 roundQueue 同集合，item 6 同口径）
  const clearToday = col.overdue.length + col.today.length === 0;
  const futureCount = col.future.length;

  // V1 原型拍板（issue 253）：归档视图状态条 = 绿点 +「已完成复习」+ 回队列指引（旧态误用红点「开始本轮」）
  const strip = ctx.showArchived
    ? `<div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>已完成复习</strong>
      </div>`
    : clearToday
      ? `<div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">${futureCount ? `未来还有 ${futureCount} 篇待复习` : '没有待复习条目'}</span>
      </div>`
      : `<div class="bz-q-strip">
        <span class="bz-q-strip-dot"></span>
        <strong>开始本轮</strong>
        <span class="bz-q-strip-txt">今日 ${col.today.length} 篇到期 · 逾期 ${col.overdue.length} 篇顺延</span>
        <button class="bz-btn bz-btn--primary" data-act="begin">开始本轮</button>
      </div>`;

  // V1 拍板：列内排序 置顶 → R 升序 → 到期（sortColumn）
  const body = ctx.showArchived
    ? `<div class="bz-q-cols"><div class="bz-q-col done">${colHead(col.done.length, '已完成')}${cardsOf(sortColumn(col.done, now), full)}</div></div>`
    : `<div class="bz-q-cols">
          <div class="bz-q-col danger">${colHead(col.overdue.length, '已逾期')}${cardsOf(sortColumn(col.overdue, now), full)}</div>
          <div class="bz-q-col warn">${colHead(col.today.length, '今天到期')}${cardsOf(sortColumn(col.today, now), full)}</div>
          <div class="bz-q-col future">${colHead(col.future.length, '未来')}${cardsOf(sortColumn(col.future, now), full)}</div>
        </div>`;

  // 底部信息行：整行可点（归档 → 切换归档；统计 → 打开分布），无引导小字
  // item 13：「累计 X 天 · 连续 Y 天」（X=去重同日天数，computeStats.totalReviews）
  // 归档态：左下角变「返回队列」提醒钮（issue 254 迭代拍板），点击即回队列
  const stats = computeStats(items);
  const archItem = ctx.showArchived
    ? `<span class="bz-q-fitem bz-touch-target--lg is-back" data-act="arch" title="点此返回队列">
        ${icon('undo-2')}<span class="lbl">返回队列</span>
      </span>`
    : `<span class="bz-q-fitem bz-touch-target--lg" data-act="arch" title="查看已完成复习">
        ${icon('folder')}<span class="lbl">已完成 <b>${col.done.length}</b> 篇</span>
      </span>`;
  const footer = `
      <div class="bz-q-footer">
        ${archItem}
        <i class="sep"></i>
        <span class="bz-q-fitem bz-touch-target--lg" data-act="stats" title="查看复习统计分布">
          ${icon('bar-chart-3')}<span class="lbl">累计 <b>${stats.totalReviews}</b> 天 · 连续 <b>${stats.streak}</b> 天</span>
        </span>
      </div>`;

  return `<div class="bz-q-view">${head}${strip}${body}${footer}</div>`;
}

// ==================== 整窗冲刺视图 ====================

export function sprintHeadHtml(): string {
  return `
      <div class="bz-sprint-head">
        <div class="t">
          <div class="bz-sprint-title">做题冲刺</div>
        </div>
        <div class="tools">
          <button class="bz-icon-btn" data-action="skip" title="跳过此篇（不评级，移到队尾）">${icon('skip-forward', 'bz-sprint-ic')}</button>
          <button class="bz-icon-btn" data-action="quit" title="回面板">${icon('x', 'bz-sprint-ic')}</button>
        </div>
      </div>`;
}

export function sprintLoadingHtml(): string {
  return `<div class="bz-sprint-loading"><span class="spinner"></span>正在获取题目…</div>`;
}

/** 选项列（answered 后标对错；sel = 已选索引数组） */
function sprintOptsHtml(
  q: QuestionLike,
  answered: boolean,
  sel: number[],
  lastCorrect: boolean
): string {
  void lastCorrect;
  return q.options
    .map((opt, i) => {
      const isSel = sel.includes(i);
      let extra = '';
      if (answered) {
        if (q.correctIndices.includes(i)) extra = ' is-correct';
        else if (isSel) extra = ' is-wrong';
      } else if (isSel) extra = ' is-sel';
      const m = answered && q.correctIndices.includes(i)
        ? markHtml('ok')
        : answered && isSel && !q.correctIndices.includes(i)
          ? markHtml('bad')
          : '';
      return `
          <div class="bz-sprint-opt${extra}${answered ? ' is-disabled' : ''}" data-i="${i}" role="button" tabindex="${answered ? '-1' : '0'}" aria-disabled="${answered ? 'true' : 'false'}">
            <span class="k">${'ABCD'[i]}</span>
            <span class="t">${esc(opt)}</span>
            <span class="m">${m}</span>
          </div>`;
    })
    .join('');
}

/** 题卡视图（entry 进度 + 当前题 + 作答态；qfoot 提交/下一题/结束并结算按态组装） */
export function sprintQuestionHtml(
  entry: { questions: QuestionLike[]; doneCount: number },
  question: QuestionLike,
  st: { answered: boolean; sel: number[]; lastCorrect: boolean; remaining: number }
): string {
  const single = question.correctIndices.length === 1;
  const total = entry.questions.length;
  const done = entry.doneCount;
  const optsHtml = sprintOptsHtml(question, st.answered, st.sel, st.lastCorrect);

  const needSubmit = !single && !st.answered;
  // 答错后：还有题 → 「下一题」；本篇最后一题也答错 → 「结束并结算」（finishNote 按本篇 acc 评级）
  const lastWrong = st.answered && !st.lastCorrect && !st.remaining;
  const nextBtn =
    st.answered && !st.lastCorrect && st.remaining
      ? `<button class="bz-btn bz-btn--primary" data-action="next">下一题 →</button>`
      : lastWrong
        ? `<button class="bz-btn bz-btn--primary" data-action="note">${icon('flag', 'bz-sprint-ic')} 结束并结算</button>`
        : '';
  const submit = needSubmit ? `<button class="bz-btn bz-btn--primary bz-sprint-submit" data-action="submit">提交答案</button>` : '';
  // item 3：答错一行解析（随题存取的 explain；存量题无此字段静默不显示，零迁移）
  const explain =
    st.answered && !st.lastCorrect && question.explain
      ? `<div class="bz-sprint-explain">${esc(question.explain)}</div>`
      : '';

  return `
      <div class="bz-sprint-qtop">
        <span class="bz-sprint-progress">${done + 1}/${total}</span>
      </div>
      <div class="bz-sprint-qcard">
        <div class="bz-sprint-qtype">${single ? '单选' : '多选'}</div>
        <div class="bz-sprint-qtext">${esc(question.question)}</div>
        <div class="bz-sprint-opts">${optsHtml}</div>
        ${explain}
        ${submit}
        ${nextBtn ? `<div class="bz-sprint-qfoot">${nextBtn}</div>` : ''}
      </div>`;
}

/** 右栏「本轮队列」 */
export function sprintAsideHtml(entries: Array<{ name: string; state: string }>): string {
  const rows = entries
    .map((e) => {
      const name = esc(e.name);
      if (e.state === 'passed') return `<div class="bz-sq-item passed"><span class="nm"><s>${name}</s></span></div>`;
      if (e.state === 'failed') return `<div class="bz-sq-item failed"><span class="nm">${name}</span></div>`;
      if (e.state === 'doing') return `<div class="bz-sq-item doing"><span class="nm">${name}</span></div>`;
      return `<div class="bz-sq-item"><span class="nm">${name}</span></div>`;
    })
    .join('');
  return `
      <div class="bz-sq-head"><b>本轮队列</b></div>
      <div class="bz-sq-list">${rows || '<div class="bz-empty"><div class="bz-empty-title">队列完毕</div></div>'}</div>`;
}

/** 冲刺主体壳（左内容 + 右本轮队列） */
export function sprintBodyHtml(mainHtml: string, entries: Array<{ name: string; state: string }>): string {
  return `
      <div class="bz-sprint-body">
        <div class="bz-sprint-main">${mainHtml}</div>
        <aside class="bz-sprint-queue">${sprintAsideHtml(entries)}</aside>
      </div>`;
}

/** 结果卡（通过/未通过同构；ratingLine = 「一般 · 下次 12 天后」等由调用方拼） */
export function sprintResultHtml(p: {
  name: string;
  acc: number;
  wrong: number;
  passed: boolean;
  ratingLine: string;
  nextLabel: string;
  showEnd: boolean;
}): string {
  const total = p.acc + p.wrong;
  const inner = p.passed
    ? `
        <div class="bz-result-ic">${markHtml('ok', 'lg')}</div>
        <div class="bz-result-name">${esc(p.name)}</div>
        <div class="bz-result-score">${p.acc}<span class="sl">/${total}</span></div>
        <span class="bz-result-rating pass">${p.ratingLine}</span>
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="next">${p.nextLabel}</button>
        ${p.showEnd ? `<button class="bz-btn bz-btn--ghost bz-btn--block" data-action="end">结束这次复习</button>` : ''}`
    : `
        <div class="bz-result-ic bad">${markHtml('bad', 'lg')}</div>
        <div class="bz-result-name">${esc(p.name)}</div>
        <div class="bz-result-score">${p.acc}<span class="sl">/${total}</span></div>
        <span class="bz-result-rating fail">${p.ratingLine}</span>
        <button class="bz-btn bz-btn--danger bz-btn--block" data-action="note">${icon('file-text', 'bz-sprint-ic')} 复习此笔记 · 打开原文</button>`;
  return `<div class="bz-result">${inner}</div>`;
}

/** 结算屏 */
export function sprintSummaryHtml(p: { total: number; passed: number; failed: number; streak: number }): string {
  return `
      <div class="bz-summary">
        <div class="bz-summary-title">本轮复习完成</div>
        <div class="bz-summary-stats">
          <div class="st"><b>${p.total}</b><span>复习篇数</span></div>
          <div class="st"><b>${p.passed}</b><span>通过</span></div>
          <div class="st ${p.failed ? 'warn' : ''}"><b>${p.failed}</b><span>未通过</span></div>
        </div>
        ${p.streak > 0 ? `<div class="bz-summary-streak">连续复习 <b>${p.streak}</b> 天</div>` : ''}
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="done">完成 · 回到复习计划</button>
      </div>`;
}

// ==================== 难度弹窗 / 悬浮迷你评级条 ====================

/** 难度弹窗（评分命令用；showDifficultyDialog 消费） */
export function difficultyDialogHtml(item: { name: string }): string {
  return `
      <h4>标记复习：${esc(item.name)}</h4>
      <button class="diff-btn" data-diff="again">忘了（Again）</button>
      <button class="diff-btn" data-diff="hard">困难（Hard）</button>
      <button class="diff-btn" data-diff="good">一般（Good）</button>
      <button class="diff-btn" data-diff="easy">简单（Easy）</button>
      <button class="diff-btn diff-btn-cancel" data-diff="cancel">取消</button>
    `;
}

/** 悬浮迷你评级条（item 4，普通复习路径） */
export function reviewBarHtml(p: { name: string; index: number; total: number }): string {
  const names: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };
  const btns = ['again', 'hard', 'good', 'easy']
    .map((r) => `<button class="bz-review-bar-btn bz-touch-target--sm is-${r}" data-rating="${r}">${names[r]}</button>`)
    .join('');
  return `
    <span class="bz-review-bar-info">${esc(p.name.replace(/^《|》$/g, ''))}<i>(${p.index}/${p.total})</i></span>
    <span class="bz-review-bar-act">${btns}
      <button class="bz-review-bar-btn bz-touch-target--sm is-skip" data-rating="skip">${'跳过'}</button>
    </span>`;
}

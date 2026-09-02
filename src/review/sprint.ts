/**
 * 复习计划 · 做题冲刺会话（2026-09-04 用户拍板形态：三区队列面板内整窗做题，非弹窗）
 *
 * 交互规格（对齐 rp1x 原型评审结论）：
 *  - 桌面/移动同一 DOM，布局差异走 CSS media（移动端面板全屏挂 .bz-win-mfs）
 *  - 头行：标题「做题冲刺」+ 副标题（开始本轮/待重做/单条复习）+ 右侧「回面板」
 *  - 答题：单选即点即判，答对亮绿 0.8s 自动进下一题、答错标红 + 「下一题」；
 *    多选勾选后「提交答案」，全对才过
 *  - 答对题持久化出库（quiz manager.removeQuestion）；答错仅移出本轮（不删题）
 *  - 右栏「本轮队列」：排队/做题中/已通过/未通过 实时更新
 *  - 一篇答完自动评级（accuracyToRating）→ 结果卡：通过 → 下一篇/结束；未通过 → 复习此笔记
 *  - 队列耗尽 → 结算屏（评级分布 + 完成回面板）
 *  - 图标全 lucide（uiIcon 工厂替换 data-lucide 占位），正文无 emoji
 *
 * 本模块只做「会话编排 + 视图构建」，题目获取/评级写盘/笔记打开由调用方（app 编排）
 * 注入——保持与 data/fsrs/题库解耦，可独立测试。
 */
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { uiIcon } from '../core/ui';
import { escManager } from '../core/esc-manager';
import { escapeHtml } from '../core/utils';
import type { ReviewItem } from './data';
import type { QuizQuestion } from './quiz-core/manager';
import type { QuizMasterUI } from './quiz-core/session';

/** 答对后亮绿到自动进下一题的延时（ticket 156 用户拍板 0.8s） */
export const CORRECT_JUMP_DELAY_MS = 800;

/** 评级映射（app.accuracyToRating 同口径：≥90 简单 / ≥70 一般 / ≥50 困难 / <50 忘了） */
export function accuracyToRating(accuracy: number): 'easy' | 'good' | 'hard' | 'again' {
  if (accuracy >= 90) return 'easy';
  if (accuracy >= 70) return 'good';
  if (accuracy >= 50) return 'hard';
  return 'again';
}

export type SprintMode = 'round' | 'single' | 'redo';

/** 会话条目进度 */
interface SprintEntry {
  item: ReviewItem;
  state: 'pending' | 'doing' | 'passed' | 'failed';
  questions: QuizQuestion[];
  /** 已答对/答错数（题面由 questions 长度推算） */
  acc: number;
  wrong: number;
  /** 通过后展示文本（下次间隔等，写盘后由回调填） */
  passNote: string;
}

interface QuestionUi {
  list: QuizQuestion[]; // 剩余题目（首题为当前题）
  answered: boolean;
  sel: Set<number>;
  lastCorrect: boolean;
  single: boolean;
  /** 当前题目号（原题序） */
  doneCount: number;
  totalCount: number;
}

export interface SprintOpts {
  app: App;
  /** 内容区宿主（渲染冲刺视图于此；调用方负责队列视图 ↔ 冲刺视图切换） */
  host: HTMLElement;
  /** 本轮队列（已排序、已按上限截断；调用方保证非空） */
  queue: ReviewItem[];
  mode: SprintMode;
  /** 做题会话宿主（题目存取/ai；可为空 = 无题库，此时全部走降级） */
  quiz: QuizMasterUI | null;
  /** 取题：返回该篇题目（round=批量已生成映射 / single=现成题 / redo=重生成）；
   *  返回 null/空数组 = 该篇不可做题（调用方应跳过或降级） */
  fetchQuestions: (item: ReviewItem) => Promise<QuizQuestion[] | null>;
  /** 通过：写排期（round/single → markReview autoPending；redo → 仅清 pendingRedo） */
  onPassed: (item: ReviewItem, rating: string, entry: { acc: number; wrong: number }) => Promise<void>;
  /** 未通过（非 redo）：写排期 + 挂待重做 + 打开原文（由调用方执行，含会话结束语义） */
  onFailed: (item: ReviewItem, rating: string, entry: { acc: number; wrong: number }) => Promise<void>;
  /** 会话结束（正常/退出/未通过中断）统一回调：回队列视图 */
  onExit: () => void;
  /** 状态推进回调（宿主可刷新外部计数） */
  onProgress?: () => void;
}

/**
 * 整窗做题冲刺会话。start() 返回 Promise，会话结束（队列耗尽 / 用户退出 / 未通过中断）后 resolve。
 */
export class SprintSession {
  private opts: SprintOpts;
  private entries: SprintEntry[] = [];
  private cur = 0;
  private q: QuestionUi | null = null;
  private jumpTimer: ReturnType<typeof setTimeout> | null = null;
  private escHandle: { unregister: () => void } | null = null;
  private finished = false;
  private resolveDone: ((reason: 'done' | 'quit' | 'fail') => void) | null = null;
  private started = false;

  constructor(opts: SprintOpts) {
    this.opts = opts;
    this.entries = opts.queue.map((item) => ({
      item,
      state: 'pending',
      questions: [],
      acc: 0,
      wrong: 0,
      passNote: '',
    }));
  }

  get mode(): SprintMode {
    return this.opts.mode;
  }
  get current(): SprintEntry | null {
    return this.entries[this.cur] ?? null;
  }
  get passedCount(): number {
    return this.entries.filter((e) => e.state === 'passed').length;
  }
  get failedCount(): number {
    return this.entries.filter((e) => e.state === 'failed').length;
  }
  get remainingCount(): number {
    return this.entries.filter((e) => e.state === 'pending').length;
  }

  /** 开始会话（异步直到结束） */
  start(): Promise<'done' | 'quit' | 'fail'> {
    if (this.started) return Promise.resolve('quit');
    this.started = true;
    return new Promise<'done' | 'quit' | 'fail'>((resolve) => {
      this.resolveDone = resolve;
      this.escHandle = escManager.register('review-sprint', {
        isVisible: () => !this.finished,
        close: () => this.requestQuit(),
      });
      void this.runNext();
    });
  }

  /** 放弃确认（ESC/放弃按钮） */
  requestQuit(): void {
    if (this.finished) return;
    void openFlowDialog({
      title: '放弃本次做题？',
      message: '未完成的题目将丢弃，本轮复习按已完成篇目结算',
      actions: [
        { label: '继续做题', value: 'cancel' },
        { label: '放弃', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v !== 'ok' || this.finished) return;
      this.finish('quit');
    });
  }

  /** 结束会话（清资源 + 回调宿主） */
  private finish(reason: 'done' | 'quit' | 'fail'): void {
    if (this.finished) return;
    this.finished = true;
    this.clearJump();
    if (this.escHandle) {
      this.escHandle.unregister();
      this.escHandle = null;
    }
    this.opts.onExit();
    this.resolveDone?.(reason);
  }

  /** 宿主强制结束（面板关闭/卸载时调用，跳过确认） */
  destroy(): void {
    this.finish('quit');
  }

  private clearJump(): void {
    if (this.jumpTimer) {
      clearTimeout(this.jumpTimer);
      this.jumpTimer = null;
    }
  }

  // ================= 流程推进 =================

  private async runNext(): Promise<void> {
    if (this.finished) return;
    const nextIdx = this.entries.findIndex((e) => e.state === 'pending');
    if (nextIdx === -1) {
      this.showSummary();
      return;
    }
    this.cur = nextIdx;
    const entry = this.entries[nextIdx];
    entry.state = 'doing';
    this.renderTop(); // 顶部骨架（含本轮队列）
    this.showLoading(entry);

    const questions = await this.opts.fetchQuestions(entry.item);
    if (this.finished) return;
    if (!questions || !questions.length) {
      // 无题：跳过该篇（不写评级；保持逾期等下次）
      notice(`「${entry.item.name}」暂无题目，已跳过`, 'warning');
      entry.state = 'pending';
      // 从本轮剔除继续（不计数）
      this.entries.splice(nextIdx, 1);
      this.cur = Math.max(0, nextIdx - 1);
      await this.runNext();
      return;
    }
    entry.questions = questions;
    this.q = {
      list: questions.slice(),
      answered: false,
      sel: new Set(),
      lastCorrect: false,
      single: questions[0]?.correctIndices.length === 1,
      doneCount: 0,
      totalCount: questions.length,
    };
    this.renderQuestion();
  }

  private async finishNote(): Promise<void> {
    const entry = this.entry();
    const total = entry.acc + entry.wrong;
    const acc = total ? Math.round((entry.acc / total) * 100) : 0;
    const rating = accuracyToRating(acc);
    const passed = rating === 'easy' || rating === 'good';

    if (passed) {
      await this.opts.onPassed(entry.item, rating, { acc: entry.acc, wrong: entry.wrong });
      if (this.finished) return;
      entry.state = 'passed';
      entry.passNote = this.nextIntervalNote(entry.item);
    } else {
      // 未通过：写排期+挂待重做+打开原文（round/single 中断；redo 保持队列等下次）
      await this.opts.onFailed(entry.item, rating, { acc: entry.acc, wrong: entry.wrong });
      if (this.finished) return;
      entry.state = 'failed';
      // 未通过 = 会话结束（复习此笔记语义）
      this.finish('fail');
      return;
    }
    this.renderResult(entry);
    this.opts.onProgress?.();
  }

  private entry(): SprintEntry {
    return this.entries[this.cur];
  }

  /** 通过后的下次间隔展示（从 nextReviewDate 已更新值推算） */
  private nextIntervalNote(item: ReviewItem): string {
    if (!item.nextReviewDate) return '';
    const days = Math.max(1, Math.round((new Date(item.nextReviewDate).getTime() - Date.now()) / 86400000));
    return `${days} 天后`;
  }

  // ================= 答题 =================

  private currentQuestion(): QuizQuestion | null {
    return this.q && this.q.list.length ? this.q.list[0] : null;
  }

  /** 单选点选 / 多选勾选 */
  answer(idx: number): void {
    const q = this.q;
    if (!q || q.answered) return;
    const question = this.currentQuestion();
    if (!question) return;
    const single = question.correctIndices.length === 1;

    if (!single) {
      if (q.sel.has(idx)) q.sel.delete(idx);
      else q.sel.add(idx);
      this.renderQuestion();
      return;
    }
    q.answered = true;
    q.sel = new Set([idx]);
    const correct = idx === question.correctIndices[0];
    q.lastCorrect = correct;
    this.consume(question, correct);
  }

  /** 多选提交 */
  submitMulti(): void {
    const q = this.q;
    if (!q || q.answered) return;
    const question = this.currentQuestion();
    if (!question) return;
    if (!q.sel.size) {
      notice('请至少选择一项', 'warning');
      return;
    }
    q.answered = true;
    const sel = Array.from(q.sel).sort();
    const correctArr = question.correctIndices.slice().sort();
    const correct = sel.length === correctArr.length && sel.every((v, i) => v === correctArr[i]);
    q.lastCorrect = correct;
    this.consume(question, correct);
  }

  /** 消费当前题（出本轮；答对持久化删库后自动下一题，答错等「下一题」按钮） */
  private consume(question: QuizQuestion, correct: boolean): void {
    const q = this.q!;
    const entry = this.entry();
    q.list.shift();
    if (correct) entry.acc++;
    else entry.wrong++;
    q.doneCount++;

    if (correct) {
      // 答对：亮绿 → 0.8s 后自动下一题（先持久化删题，失败不阻断）
      void this.removeQuestionPersist(question).then(() => {
        if (this.finished) return;
        this.clearJump();
        this.jumpTimer = setTimeout(() => {
          this.jumpTimer = null;
          if (this.finished) return;
          this.advanceAfterAnswer();
        }, CORRECT_JUMP_DELAY_MS);
      });
    }
    this.renderQuestion();
  }

  private async removeQuestionPersist(q: QuizQuestion): Promise<void> {
    const quiz = this.opts.quiz;
    if (!quiz || !q.notePath) return;
    try {
      await quiz.manager.removeQuestion(this.opts.app, q.notePath, {
        question: q.question,
        options: q.options,
        correctIndices: q.correctIndices,
      });
    } catch (e: any) {
      notice('删除题目失败：' + e.message, 'error');
    }
  }

  /** 答错后「下一题」 / 答对自动跳 */
  nextQuestion(): void {
    if (!this.q?.answered) return;
    this.advanceAfterAnswer();
  }

  private advanceAfterAnswer(): void {
    const entry = this.entry();
    if (this.q!.list.length) {
      this.q!.answered = false;
      this.q!.sel = new Set();
      this.renderQuestion();
      return;
    }
    void this.finishNote();
  }

  // ================= 结果/结算动作 =================

  private async handleResult(action: 'next' | 'end' | 'note'): Promise<void> {
    if (action === 'note') {
      // 打开原文（未通过已在 onFailed 内开过？这里防御：只退出）
      this.finish('quit');
      return;
    }
    if (action === 'end') {
      this.showSummary();
      return;
    }
    await this.runNext();
  }

  // ================= 视图构建（单套 DOM，CSS 适配移动） =================

  /** 顶部头行（队列视图 / 冲刺共用外层结构由宿主渲染，本会话只接管内容区） */
  private renderTop(): void {
    // 内容区由宿主清空后本会话自绘全部（含顶部）。为与队列互斥，宿主仅给空容器。
  }

  private sprintHead(sub: string, extraRight = ''): string {
    return `
      <div class="bz-sprint-head">
        <div class="t">
          <div class="bz-sprint-title">做题冲刺</div>
          <div class="bz-sprint-sub">${sub}</div>
        </div>
        <div class="tools">
          ${extraRight}
          <button class="bz-icon-btn" data-action="quit" title="回面板">${this.icon('x')}</button>
        </div>
      </div>`;
  }

  private showLoading(entry: SprintEntry): void {
    this.opts.host.innerHTML = `
      ${this.sprintHead(this.subLabel())}
      <div class="bz-sprint-loading"><span class="spinner"></span>正在准备「${escapeHtml(entry.item.name)}」的题目…</div>`;
    this.bindTop();
  }

  private subLabel(): string {
    return this.mode === 'round' ? '开始本轮' : this.mode === 'redo' ? '待重做' : '单条复习';
  }

  private questionHeader(entry: SprintEntry): string {
    const total = entry.questions.length;
    const done = this.q!.doneCount;
    return `
      <div class="bz-sprint-qtop">
        <span class="bz-sprint-file">${this.icon('file-text')} ${escapeHtml(entry.item.name)}</span>
        <span class="bz-sprint-progress">${done + 1}/${total}</span>
      </div>`;
  }

  private renderQuestion(): void {
    const entry = this.entry();
    const q = this.q!;
    const question = this.currentQuestion();
    if (!question) return;
    const single = question.correctIndices.length === 1;

    const optsHtml = question.options
      .map((opt, i) => {
        const isSel = q.sel.has(i);
        let extra = '';
        if (q.answered) {
          if (question.correctIndices.includes(i)) extra = ' is-correct';
          else if (isSel) extra = ' is-wrong';
        } else if (isSel) extra = ' is-sel';
        return `
          <button class="bz-sprint-opt${extra}" data-i="${i}" ${q.answered ? 'disabled' : ''}>
            <span class="k">${'ABCD'[i]}</span>
            <span class="t">${escapeHtml(opt)}</span>
            <span class="m">${q.answered && question.correctIndices.includes(i) ? this.mark('ok') : q.answered && isSel ? this.mark('bad') : ''}</span>
          </button>`;
      })
      .join('');

    const needSubmit = !single && !q.answered;
    const showNext = q.answered && !q.lastCorrect && !q.list.length; // 答错且是最后一题 → 结果前置，无下一题按钮
    const nextBtn =
      q.answered && !q.lastCorrect && q.list.length
        ? `<button class="bz-btn bz-btn--primary" data-action="next">下一题 →</button>`
        : '';
    const submit = needSubmit ? `<button class="bz-btn bz-btn--primary bz-sprint-submit" data-action="submit">提交答案</button>` : '';

    const headNote = q.answered
      ? q.lastCorrect
        ? '答对 · 自动进入下一题'
        : '答错 · 查看正确答案'
      : single
        ? '选择即判对错 · 全对 = 轻松'
        : '多选 · 勾选后提交';

    const html = `
      ${this.sprintHead(this.subLabel())}
      <div class="bz-sprint-body">
        <div class="bz-sprint-main">
          ${this.questionHeader(entry)}
          <div class="bz-sprint-qcard">
            <div class="bz-sprint-qtype">${single ? '单选' : '多选'}</div>
            <div class="bz-sprint-qtext">${escapeHtml(question.question)}</div>
            <div class="bz-sprint-opts">${optsHtml}</div>
            ${submit}
            <div class="bz-sprint-qfoot">
              <span class="note">${headNote}</span>
              ${nextBtn}
            </div>
          </div>
        </div>
        <aside class="bz-sprint-queue">${this.queueHtml()}</aside>
      </div>`;
    this.opts.host.innerHTML = html;
    this.mountIcons(this.opts.host);
    this.bindTop();
    this.opts.host.querySelector('[data-action="submit"]')?.addEventListener('click', () => this.submitMulti());
    this.opts.host.querySelector('[data-action="next"]')?.addEventListener('click', () => this.nextQuestion());
    this.opts.host.querySelectorAll('.bz-sprint-opt').forEach((el) => {
      el.addEventListener('click', () => this.answer(Number((el as HTMLElement).dataset.i)));
    });
    this.opts.onProgress?.();
  }

  private queueHtml(): string {
    const rows = this.entries
      .map((e) => {
        const name = escapeHtml(e.item.name.replace(/^《|》$/g, ''));
        if (e.state === 'passed') return `<div class="bz-sq-item passed"><span class="nm"><s>${name}</s></span><span class="meta">${this.mark('ok')} 已通过 · ${escapeHtml(e.passNote)}</span></div>`;
        if (e.state === 'failed') return `<div class="bz-sq-item failed"><span class="nm">${name}</span><span class="meta">${this.mark('bad')} 未通过 · 挂待重做</span></div>`;
        if (e.state === 'doing') return `<div class="bz-sq-item doing"><span class="nm">${name}</span><span class="meta">做题中…</span></div>`;
        return `<div class="bz-sq-item"><span class="nm">${name}</span></div>`;
      })
      .join('');
    const passed = this.passedCount;
    const failed = this.failedCount;
    const remain = this.remainingCount;
    return `
      <div class="bz-sq-head"><b>本轮队列</b><span>剩 ${remain} 篇</span></div>
      <div class="bz-sq-list">${rows || '<div class="bz-sq-empty">— 队列完毕 —</div>'}</div>
      <div class="bz-sq-foot">已通过 ${passed} · 未通过 ${failed}</div>`;
  }

  private renderResult(entry: SprintEntry): void {
    const total = entry.acc + entry.wrong;
    const acc = total ? Math.round((entry.acc / total) * 100) : 0;
    const rating = accuracyToRating(acc);
    const passed = rating === 'easy' || rating === 'good';
    const remain = this.remainingCount;
    const name = escapeHtml(entry.item.name.replace(/^《|》$/g, ''));
    const nextLabel =
      this.mode === 'single'
        ? '完成 · 回面板'
        : remain > 0
          ? `下一篇 · ${this.nextPendingName()}`
          : '完成本轮 · 结算';

    const inner = passed
      ? `
        <div class="bz-result-ic">${this.mark('ok', 'lg')}</div>
        <div class="bz-result-name">${name}</div>
        <div class="bz-result-score">${entry.acc}<span class="sl">/${total}</span></div>
        <div class="bz-result-sub">答对 ${entry.acc} 题 · 答错 ${entry.wrong} 题 · 正确率 ${acc}%</div>
        <span class="bz-result-rating pass">${this.mark('ok')} 自动评级：${RATING_NAMES[rating]}</span>
        <div class="bz-result-meta">已写入复习计划 · 下次 <b>${escapeHtml(entry.passNote || '已排期')}</b></div>
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="next">${nextLabel}</button>
        ${remain > 0 ? `<button class="bz-btn bz-btn--ghost bz-btn--block" data-action="end">结束这次复习</button>` : ''}`
      : `
        <div class="bz-result-ic bad">${this.mark('bad', 'lg')}</div>
        <div class="bz-result-name">${name}</div>
        <div class="bz-result-score">${entry.acc}<span class="sl">/${total}</span></div>
        <div class="bz-result-sub">答对 ${entry.acc} 题 · 答错 ${entry.wrong} 题 · 正确率 ${acc}%</div>
        <span class="bz-result-rating fail">${this.mark('bad')} 自动评级：${RATING_NAMES[rating]}</span>
        <div class="bz-result-meta">已写入复习计划并挂「待重做」</div>
        <button class="bz-btn bz-btn--danger bz-btn--block" data-action="note">${this.icon('file-text')} 复习此笔记 · 打开原文</button>
        <div class="bz-result-note">打开笔记看一遍，稍后回来重做清掉它</div>`;

    const html = `
      ${this.sprintHead('本篇完成')}
      <div class="bz-sprint-body">
        <div class="bz-sprint-main"><div class="bz-result">${inner}</div></div>
        <aside class="bz-sprint-queue">${this.queueHtml()}</aside>
      </div>`;
    this.opts.host.innerHTML = html;
    this.mountIcons(this.opts.host);
    this.bindTop();
    this.opts.host.querySelector('[data-action="next"]')?.addEventListener('click', () => void this.handleResult('next'));
    this.opts.host.querySelector('[data-action="end"]')?.addEventListener('click', () => void this.handleResult('end'));
    this.opts.host.querySelector('[data-action="note"]')?.addEventListener('click', () => void this.handleResult('note'));
    this.opts.onProgress?.();
  }

  private nextPendingName(): string {
    const nx = this.entries.find((e) => e.state === 'pending');
    return nx ? escapeHtml(nx.item.name.replace(/^《|》$/g, '').slice(0, 12)) : '';
  }

  private showSummary(): void {
    const passed = this.passedCount;
    const failed = this.failedCount;
    const total = passed + failed;
    const html = `
      ${this.sprintHead('本轮完成')}
      <div class="bz-summary">
        <div class="bz-summary-title">本轮复习完成</div>
        <div class="bz-summary-sub">${total} 篇全部处理 · ${failed ? `${failed} 篇未通过` : '全部通过'}</div>
        <div class="bz-summary-stats">
          <div class="st"><b>${total}</b><span>复习篇数</span></div>
          <div class="st"><b>${passed}</b><span>通过</span></div>
          <div class="st ${failed ? 'warn' : ''}"><b>${failed}</b><span>${failed ? '未通过' : '未通过'}</span></div>
        </div>
        ${failed ? `<div class="bz-summary-note">${this.icon('rotate-ccw')} 未通过条目已挂待重做 · 打开笔记复习后再来清它们</div>` : ''}
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="done">完成 · 回到复习计划</button>
      </div>`;
    this.opts.host.innerHTML = html;
    this.mountIcons(this.opts.host);
    this.bindTop();
    this.opts.host.querySelector('[data-action="done"]')?.addEventListener('click', () => this.finish('done'));
  }

  /** 顶部/队列共同动作（退出按钮） */
  private bindTop(): void {
    this.opts.host.querySelector('[data-action="quit"]')?.addEventListener('click', () => this.requestQuit());
  }

  // ================= 图标/工具 =================

  private icon(name: string): string {
    return `<span class="bz-sprint-ic" data-lucide="${name}"></span>`;
  }

  private mark(kind: 'ok' | 'bad', size: 'lg' | '' = ''): string {
    if (kind === 'ok') return `<span class="bz-mark ok ${size}">✓</span>`;
    return `<span class="bz-mark bad ${size}">✕</span>`;
  }

  /** innerHTML 渲染后把 [data-lucide] 占位替换为真实 lucide 图标（uiIcon 工厂） */
  private mountIcons(host: HTMLElement): void {
    host.querySelectorAll<HTMLElement>('[data-lucide]').forEach((el) => {
      const name = el.dataset.lucide || '';
      const ic = uiIcon(name);
      ic.classList.add('bz-sprint-ic');
      el.replaceWith(ic);
    });
  }
}

/** 评级中文名（本地映射，避免依赖 stats 大模块） */
const RATING_NAMES: Record<string, string> = { easy: '轻松', good: '一般', hard: '困难', again: '忘了' };

/** 便捷入口：在宿主容器内跑完一次冲刺 */
export async function runSprint(opts: SprintOpts): Promise<'done' | 'quit' | 'fail'> {
  const session = new SprintSession(opts);
  return session.start();
}

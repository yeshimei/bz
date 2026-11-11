/* ============================================================
 * bz · 划线卡复习会话（review/card-session.ts）
 *
 * 复习一条划线卡不该打开任何文件——内容就在条目里。三种方式由复习计划这边
 * 定（设置里的「复习方式」），这里只管把选中的那种跑完：
 *
 *   · **抽认卡**：先给一句问句，点开看全文，再自评。问句不能等于答案——
 *     一上来给全文就是重读，看一眼点「容易」，排期直接失真。
 *   · **做题**：题库在加入计划时生成好了，这里只抽三分之一出来做。答完按
 *     正确率定难度（口径与做题冲刺同源：九成以上容易、七成以上一般……）。
 *   · **展开全文**：不碰模型，全文摆出来直接评。
 *
 * 三条共同取舍：
 *   · **答案必须一眼对得上**：全文 + 当时的想法 + 回原文，一个不少。
 *   · **卡住也能复习**：没配模型、题库没生成出来，退回「展开全文」，不让用户
 *     卡在空白页上。
 *   · **不碰文件**：这条链路要能在没网、没那本书的情况下跑完。
 * ============================================================ */
import type { App } from 'obsidian';
import { isCardItem, type ReviewCard, type ReviewItem } from './data';
import type { Rating } from './fsrs';
import type { CardMode } from './card-ai';
import { QUIZ_RATIO, pickCardQuestions } from './card-quiz';
import type { QuizQuestion } from './quiz-core/manager';
import { accuracyToRating } from './sprint';

/** 提示面：长划线给开头，短划线只给几个字（否则等于把答案念出来） */
export function promptOf(item: ReviewItem): string {
  const text = String(item.card?.text ?? '').trim();
  const chars = Array.from(text);
  if (!chars.length) return '';
  if (chars.length > 24) return `${chars.slice(0, 18).join('')}…`;
  return `${chars.slice(0, 4).join('')}…`;
}

/** 出处那行：书名 · 章节 */
export function sourceOf(item: ReviewItem): string {
  const book = String(item.card?.bookTitle ?? '').trim();
  const chapter = String(item.card?.chapterTitle ?? '').trim();
  if (book && chapter) return `${book} · ${chapter}`;
  return book || chapter || item.name || '';
}

const RATINGS: Array<{ value: Rating; label: string; key: string }> = [
  { value: 'again', label: '忘了', key: '1' },
  { value: 'hard', label: '困难', key: '2' },
  { value: 'good', label: '一般', key: '3' },
  { value: 'easy', label: '容易', key: '4' },
];

const RATING_NAMES: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '容易' };

export interface CardSessionOpts {
  app: App;
  host: HTMLElement;
  queue: ReviewItem[];
  /** 三种方式之一；缺省按抽认卡 */
  mode?: CardMode;
  /** 做题每轮抽多少（分母） */
  ratio?: number;
  /** 评完一条：写排期（由调用方负责落盘） */
  onRate: (item: ReviewItem, rating: Rating) => Promise<void>;
  /** 整轮走完 / 中途退出（completed=true 表示这一轮真的走完了） */
  onExit: (completed?: boolean) => void;
  /**
   * 让模型出一道问句当提示面（可选）。
   *
   * 返回 null 表示「这次没拿到」（没配 AI / 网络失败 / 回复不合格），会话
   * 退回内置提示——复习不该因为模型不可用而卡住。
   */
  ask?: (item: ReviewItem) => Promise<{ q: string; a: string } | null>;
  /** 取这张卡的题库（做题方式用；没有就降级展开全文） */
  loadQuiz?: (item: ReviewItem) => Promise<QuizQuestion[] | null>;
  /** 「重新生成」：重新问一次模型并覆盖卡上的内容；返回是否真的换了 */
  regenerate?: (item: ReviewItem) => Promise<boolean>;
}

/** 做题这一条的会话态 */
interface QuizRound {
  list: QuizQuestion[];
  idx: number;
  correct: number;
  wrong: number;
  /** 当前题选了第几个（null = 还没选） */
  picked: number | null;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class CardSession {
  private opts: CardSessionOpts;
  private index = 0;
  private revealed = false;
  private busy = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  /** 本次会话已经问过模型的卡（避免重画时反复请求） */
  private asked = new Set<string>();
  /** 已经拿到的问句（本会话缓存；落盘那一步由 ask 回调自己做） */
  private qCache = new Map<string, string>();
  /** 做题态；null = 还没开始/已交卷 */
  private quiz: QuizRound | null = null;
  /** 题库正在读 */
  private quizLoading = false;
  /** 这张卡没有题库（或读失败），退回展开全文 */
  private quizFallback = false;
  /** 刚点过「重新生成」，按钮上给个反馈 */
  private regenBusy = false;

  constructor(opts: CardSessionOpts) {
    this.opts = opts;
  }

  start(): void {
    this.render();
    this.keyHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.destroy();
        this.opts.onExit(false);
        return;
      }
      if (this.isQuizMode() && this.quiz) {
        this.handleQuizKey(e);
        return;
      }
      if (!this.revealed && !this.isPlainMode()) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.reveal();
        }
        return;
      }
      const hit = RATINGS.find((r) => r.key === e.key);
      if (hit) {
        e.preventDefault();
        void this.rate(hit.value);
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  destroy(): void {
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.opts.host.innerHTML = '';
  }

  private mode(): CardMode {
    return this.opts.mode ?? 'flashcard';
  }

  private isPlainMode(): boolean {
    return this.mode() === 'plain' || this.quizFallback;
  }

  private isQuizMode(): boolean {
    return this.mode() === 'quiz' && !this.quizFallback;
  }

  private current(): ReviewItem | undefined {
    return this.opts.queue[this.index];
  }

  private reveal(): void {
    this.revealed = true;
    this.render();
  }

  private async rate(rating: Rating): Promise<void> {
    if (this.busy) return;
    const item = this.current();
    if (!item) return;
    this.busy = true;
    try {
      await this.opts.onRate(item, rating);
    } finally {
      this.busy = false;
    }
    this.index += 1;
    this.revealed = false;
    this.quiz = null;
    this.quizLoading = false;
    this.quizFallback = false;
    if (this.index >= this.opts.queue.length) {
      this.destroy();
      this.opts.onExit(true);
      return;
    }
    this.render();
  }

  /**
   * 提示面用哪句话。
   *
   * 优先用卡上已经存好的 AI 问句（`card.qa`），其次用本会话刚拿到的；
   * 都没有且配了 `ask`，就去问一次——问的这段时间显示「正在生成提示…」，
   * 而不是先露出内置提示再换掉（那一瞬间用户已经把答案看完了）。
   */
  private promptFor(item: ReviewItem): string {
    const key = item.filePath;
    const cached = this.qCache.get(key) ?? String(item.card?.qa?.q ?? '').trim();
    if (cached) return cached;
    if (!this.opts.ask || this.asked.has(key)) return promptOf(item);
    this.asked.add(key);
    void this.opts
      .ask(item)
      .then((res) => {
        if (!res?.q) return;
        this.qCache.set(key, res.q);
        if (this.current()?.filePath === key) this.render();
      })
      .catch(() => undefined);
    return '';
  }

  /** 做题：进会话就把题库读出来，抽好这一轮要问的几道 */
  private ensureQuiz(item: ReviewItem): void {
    if (!this.isQuizMode() || this.quiz || this.quizLoading || this.quizFallback) return;
    if (!this.opts.loadQuiz) {
      this.quizFallback = true;
      this.render();
      return;
    }
    this.quizLoading = true;
    void (async () => {
      let list: QuizQuestion[] | null = null;
      try {
        list = await this.opts.loadQuiz!(item);
      } catch {
        list = null;
      }
      if (this.current()?.filePath !== item.filePath) return;
      this.quizLoading = false;
      if (!list?.length) {
        this.quizFallback = true;
        this.render();
        return;
      }
      this.quiz = {
        list: pickCardQuestions(list, this.opts.ratio ?? QUIZ_RATIO),
        idx: 0,
        correct: 0,
        wrong: 0,
        picked: null,
      };
      this.render();
    })();
  }

  private handleQuizKey(e: KeyboardEvent): void {
    const round = this.quiz;
    if (!round) return;
    const done = round.idx >= round.list.length;
    if (done) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void this.finishQuiz();
      }
      return;
    }
    if (round.picked === null) {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) {
        e.preventDefault();
        this.pickOption(n - 1);
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.nextQuestion();
    }
  }

  private pickOption(i: number): void {
    const round = this.quiz;
    if (!round || round.picked !== null) return;
    const q = round.list[round.idx];
    if (!q || i < 0 || i >= q.options.length) return;
    round.picked = i;
    if (q.correctIndices.includes(i)) round.correct += 1;
    else round.wrong += 1;
    this.render();
  }

  private nextQuestion(): void {
    const round = this.quiz;
    if (!round) return;
    round.idx += 1;
    round.picked = null;
    this.render();
  }

  /** 交卷：按正确率定难度，口径与做题冲刺同源 */
  private async finishQuiz(): Promise<void> {
    const round = this.quiz;
    if (!round) return;
    const total = round.correct + round.wrong;
    const acc = total ? Math.round((round.correct / total) * 100) : 0;
    await this.rate(accuracyToRating(acc));
  }

  private async regenerate(): Promise<void> {
    if (!this.opts.regenerate || this.regenBusy) return;
    const item = this.current();
    if (!item) return;
    this.regenBusy = true;
    this.render();
    try {
      const ok = await this.opts.regenerate(item);
      if (ok) {
        this.qCache.delete(item.filePath);
        this.asked.delete(item.filePath);
        this.quiz = null;
        this.quizFallback = false;
        this.revealed = false;
        // 重生成后卡上的内容变了：把最新那条换进来
        const card = item.card ?? ({} as ReviewCard);
        if (card.key) this.qCache.delete(card.key);
      }
    } finally {
      this.regenBusy = false;
      this.render();
    }
  }

  // ==================== 渲染 ====================

  private render(): void {
    const host = this.opts.host;
    const item = this.current();
    if (!item || !isCardItem(item)) {
      this.destroy();
      this.opts.onExit(false);
      return;
    }
    const total = this.opts.queue.length;
    const pos = `${this.index + 1} / ${total}`;
    const canRegen = this.mode() !== 'plain' && !!this.opts.regenerate;

    host.innerHTML = `
      <div class="bz-cs" role="group" aria-label="划线卡复习">
        <div class="bz-cs-head">
          <span class="bz-cs-pos">${esc(pos)}</span>
          <span class="bz-cs-src">${esc(sourceOf(item))}</span>
          ${
            canRegen
              ? `<button type="button" class="bz-btn bz-cs-regen" data-act="regen"${
                  this.regenBusy ? ' disabled' : ''
                }>${this.regenBusy ? '正在生成…' : '重新生成'}</button>`
              : ''
          }
        </div>
        <div class="bz-cs-body">${this.bodyHtml(item)}</div>
        <div class="bz-cs-foot">${this.footHtml(item)}</div>
      </div>`;

    this.bind(host);
    this.ensureQuiz(item);
  }

  /** 正文：看答案那一段（全文 + 想法 + 回原文），三种方式共用 */
  private answerHtml(card: ReviewCard): string {
    const idea = String(card.comment ?? '').trim();
    const back = String(card.backlink ?? '').trim();
    return `<blockquote class="bz-cs-text">${esc(card.text)}</blockquote>
      ${idea ? `<p class="bz-cs-idea">${esc(idea)}</p>` : ''}
      ${back ? `<a class="bz-cs-back" href="${esc(back)}">回到原文</a>` : ''}`;
  }

  private bodyHtml(item: ReviewItem): string {
    const card = item.card!;
    if (this.isPlainMode()) return this.answerHtml(card);

    if (this.isQuizMode()) {
      const round = this.quiz;
      if (!round) {
        return `<p class="bz-cs-prompt is-loading">${
          this.quizFallback ? '这张卡没有题库，直接看原文' : '正在准备题目…'
        }</p>`;
      }
      if (round.idx >= round.list.length) return this.quizSummaryHtml(round);
      const q = round.list[round.idx];
      const picked = round.picked;
      const labels = ['A', 'B', 'C', 'D'];
      const options = q.options
        .map((opt, i) => {
          /* 复用做题家的选项样式（quiz-option-btn + correct/wrong）：同一种交互
             不必再造一套配色，用户在两处看到的选择题长得一样才不会犹豫。 */
          let cls = 'quiz-option-btn bz-cs-opt';
          if (picked !== null) {
            if (q.correctIndices.includes(i)) cls += ' correct';
            else if (picked === i) cls += ' wrong';
          }
          /* 模型给的选项常自带「A. 」序号。再加一层就成了「AA. 」，所以有就不重复加 */
          const labeled = /^[A-Da-d][.、)．\s]/.test(opt);
          const mark = labeled ? '' : `<span class="bz-cs-opt-i">${labels[i] ?? i + 1}</span>`;
          return `<button type="button" class="${cls}" data-opt="${i}"${
            picked !== null ? ' disabled' : ''
          }>${mark}<span class="bz-cs-opt-t">${esc(opt)}</span></button>`;
        })
        .join('');
      const explain =
        picked !== null && q.explain ? `<p class="bz-cs-explain">${esc(q.explain)}</p>` : '';
      return `
        <div class="bz-cs-quiz-head">第 ${round.idx + 1} / ${round.list.length} 题</div>
        <p class="bz-cs-question">${esc(q.question)}</p>
        <div class="bz-cs-options">${options}</div>
        ${explain}`;
    }

    const prompt = this.promptFor(item);
    return `
      <p class="bz-cs-prompt${prompt ? '' : ' is-loading'}">${prompt ? esc(prompt) : '正在生成提示…'}</p>
      ${this.revealed ? this.answerHtml(card) : ''}`;
  }

  private quizSummaryHtml(round: QuizRound): string {
    const total = round.correct + round.wrong;
    const acc = total ? Math.round((round.correct / total) * 100) : 0;
    const rating = accuracyToRating(acc);
    return `
      <div class="bz-cs-quiz-done">
        <p class="bz-cs-quiz-acc">答对 ${round.correct} / ${total}</p>
        <p class="bz-cs-quiz-rating">本次按「${RATING_NAMES[rating] ?? rating}」记</p>
      </div>`;
  }

  private footHtml(item: ReviewItem): string {
    if (this.isPlainMode()) return this.ratingHtml();

    if (this.isQuizMode()) {
      const round = this.quiz;
      if (!round) return '';
      if (round.idx >= round.list.length) {
        return `<button type="button" class="bz-btn pri" data-act="finish">记下这次结果（Enter）</button>`;
      }
      if (round.picked === null) return `<span class="bz-cs-hint">按 1-4 或点选项作答</span>`;
      return `<button type="button" class="bz-btn pri" data-act="next">${
        round.idx + 1 >= round.list.length ? '看结果' : '下一题'
      }（Enter）</button>`;
    }

    if (this.revealed) return this.ratingHtml();
    return `<button type="button" class="bz-btn pri" data-act="reveal">看答案</button>`;
  }

  private ratingHtml(): string {
    return `<div class="bz-cs-rate">${RATINGS.map(
      (r) => `<button type="button" class="bz-btn" data-r="${r.value}">${r.label}（${r.key}）</button>`,
    ).join('')}</div>`;
  }

  private bind(host: HTMLElement): void {
    host.querySelector('[data-act="reveal"]')?.addEventListener('click', () => this.reveal());
    host.querySelector('[data-act="regen"]')?.addEventListener('click', () => void this.regenerate());
    host.querySelector('[data-act="next"]')?.addEventListener('click', () => this.nextQuestion());
    host.querySelector('[data-act="finish"]')?.addEventListener('click', () => void this.finishQuiz());
    host.querySelectorAll<HTMLElement>('[data-r]').forEach((btn) => {
      btn.addEventListener('click', () => void this.rate(btn.dataset.r as Rating));
    });
    host.querySelectorAll<HTMLElement>('[data-opt]').forEach((btn) => {
      btn.addEventListener('click', () => this.pickOption(Number(btn.dataset.opt)));
    });
  }
}

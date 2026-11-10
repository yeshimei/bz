/* ============================================================
 * bz · 划线卡复习会话（review/card-session.ts）
 *
 * 复习一条划线卡不该打开任何文件——内容就在条目里。所以这里自成一个界面：
 * 先给提示、点开看答案、再自评，一条接一条。
 *
 * 三条取舍：
 *   · **提示不能等于答案**：一上来给全文就是重读，看一眼点「容易」，排期
 *     直接失真。长划线给开头一截，短划线只给前几个字。
 *   · **答案必须一眼对得上**：全文 + 当时的想法 + 回原文，一个不少。回忆
 *     失败时用户要能立刻确认「我刚才想的是不是这个」。
 *   · **不碰文件、不碰 AI**：这条链路要能在没网、没模型、没那本书的情况下
 *     跑完——卡片自带全部内容。
 * ============================================================ */
import type { App } from 'obsidian';
import { isCardItem, type ReviewItem } from './data';
import type { Rating } from './fsrs';

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

export interface CardSessionOpts {
  app: App;
  host: HTMLElement;
  queue: ReviewItem[];
  /** 评完一条：写排期（由调用方负责落盘） */
  onRate: (item: ReviewItem, rating: Rating) => Promise<void>;
  /** 整轮走完 / 中途退出 */
  onExit: () => void;
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

  constructor(opts: CardSessionOpts) {
    this.opts = opts;
  }

  start(): void {
    this.render();
    this.keyHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.destroy();
        this.opts.onExit();
        return;
      }
      if (!this.revealed) {
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
    if (this.index >= this.opts.queue.length) {
      this.destroy();
      this.opts.onExit();
      return;
    }
    this.render();
  }

  private render(): void {
    const host = this.opts.host;
    const item = this.current();
    if (!item || !isCardItem(item)) {
      this.destroy();
      this.opts.onExit();
      return;
    }
    const total = this.opts.queue.length;
    const pos = `${this.index + 1} / ${total}`;
    const card = item.card!;
    const idea = String(card.comment ?? '').trim();
    const back = String(card.backlink ?? '').trim();

    host.innerHTML = `
      <div class="bz-cs" role="group" aria-label="划线卡复习">
        <div class="bz-cs-head">
          <span class="bz-cs-pos">${esc(pos)}</span>
          <span class="bz-cs-src">${esc(sourceOf(item))}</span>
        </div>
        <div class="bz-cs-body">
          <p class="bz-cs-prompt">${esc(promptOf(item))}</p>
          ${
            this.revealed
              ? `<blockquote class="bz-cs-text">${esc(card.text)}</blockquote>
                 ${idea ? `<p class="bz-cs-idea">${esc(idea)}</p>` : ''}
                 ${back ? `<a class="bz-cs-back" href="${esc(back)}">回到原文</a>` : ''}`
              : ''
          }
        </div>
        <div class="bz-cs-foot">
          ${
            this.revealed
              ? `<div class="bz-cs-rate">${RATINGS.map(
                  (r) => `<button type="button" class="bz-btn" data-r="${r.value}">${r.label}</button>`,
                ).join('')}</div>`
              : `<button type="button" class="bz-btn pri" data-act="reveal">看答案</button>`
          }
        </div>
      </div>`;

    host.querySelector('[data-act="reveal"]')?.addEventListener('click', () => this.reveal());
    host.querySelectorAll<HTMLElement>('[data-r]').forEach((btn) => {
      btn.addEventListener('click', () => void this.rate(btn.dataset.r as Rating));
    });
  }
}

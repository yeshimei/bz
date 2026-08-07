/**
 * 复习计划 UI（ticket 16，源码 L148-481 逐字移植）
 * UIManager：mask/popup/渲染/难度弹窗/确认框/搜索/归档。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { FSRS, FSRS_FIRST_TEXTS, LADDER_MAX, TOTAL_STAGES } from './fsrs';
import type { Rating } from './fsrs';
import type { ReviewItem } from './data';

export class UIManager {
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  entriesContainer: HTMLElement | null = null;
  confirmMask: HTMLElement | null = null;
  confirmPopup: HTMLElement | null = null;
  confirmCallback: (() => void) | null = null;
  escapeRegistered = false;
  searchInput: HTMLInputElement | null = null;
  showArchived = false;

  dataManager: any;
  app: App;

  constructor(app: App, dataManager: any) {
    this.app = app;
    this.dataManager = dataManager;
    this.injectStyles();
    this.registerEscape();
  }

  injectStyles(): void {
    if (document.querySelector('style[data-review-styles]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-review-styles', '');
    style.textContent = `
      #review-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 9998; display: flex; align-items: center; justify-content: center; }
      #review-popup { background: var(--background-primary); border-radius: 12px; max-width: 800px; width: 92%; max-height: 86vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); z-index: 9999; animation: reviewSlideUp .2s ease; }
      @keyframes reviewSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      #review-entries-container { overflow-y: auto; padding: 12px 16px; flex: 1; }
      .review-card { background: var(--background-secondary); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
      .review-card.completed { border-left: 3px solid #52c41a; }
      .review-card.overdue { border-left: 3px solid #ff4757; }
      .review-tag { font-size: .7rem; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
      .review-tag.ladder { background: #e6f7ff; color: #1890ff; }
      .review-tag.fsrs { background: #fff7e6; color: #fa8c16; }
      .review-tag.completed-tag { background: #f6ffed; color: #52c41a; }
      .review-tag.overdue-tag { background: #fff1f0; color: #ff4757; }
      .difficulty-dialog { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 10005; display: flex; align-items: center; justify-content: center; }
      .diff-btn { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-size: .9rem; margin: 4px; }
    `;
    document.head.appendChild(style);
  }

  registerEscape(): void {
    if (this.escapeRegistered) return;
    this.escapeRegistered = true;
    document.addEventListener('keydown', this.handleKeydown);
  }

  handleKeydown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (this.confirmMask) {
      this.closeConfirm();
    } else if (this.mask) {
      this.hideMain();
    }
  };

  /** 显示主面板（自动触发题库更新） */
  async showMain(): Promise<void> {
    const app = this.app;
    await this.dataManager.loadItems();

    if (this.mask) {
      this.mask.remove();
      this.mask = null;
    }

    const mask = document.createElement('div');
    mask.id = 'review-mask';
    const popup = document.createElement('div');
    popup.id = 'review-popup';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--background-modifier-border); flex-shrink:0;';
    header.innerHTML = '<span style="font-size:1.05rem; font-weight:600;">📚 复习计划</span>';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex; gap:4px;';

    const mkBtn = (text: string, id: string, title: string) => {
      const b = document.createElement('button');
      b.id = id;
      b.textContent = text;
      b.title = title;
      b.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; box-shadow:none; padding:2px 4px;';
      btnGroup.appendChild(b);
      return b;
    };

    const addBtn = mkBtn('➕', 'review-btn-add', '加入当前笔记');
    addBtn.addEventListener('click', async () => {
      const { reviewApp } = await import('./app');
      await reviewApp.addCurrentToReview(app, this.dataManager);
      this.refreshPanel();
    });

    const startBtn = mkBtn('▶️', 'review-btn-start', '开始复习（跳转逾期）');
    startBtn.addEventListener('click', async () => {
      const { reviewApp } = await import('./app');
      await reviewApp.autoJumpOverdue(app, this.dataManager, null);
    });

    const searchBtn = mkBtn('🔍', 'review-btn-search', '搜索');
    searchBtn.addEventListener('click', () => this.toggleSearch());

    const archiveBtn = mkBtn('📁', 'review-btn-archive', '归档');
    archiveBtn.addEventListener('click', () => {
      this.showArchived = !this.showArchived;
      archiveBtn.textContent = this.showArchived ? '📂' : '📁';
      this.refreshPanel();
    });

    const quizBtn = mkBtn('🎯', 'review-btn-quiz', '做题家');
    quizBtn.addEventListener('click', () => {
      (app as any).commands?.executeCommandById?.('quiz-master-open');
    });

    const closeBtn = mkBtn('❌', 'review-btn-close', '关闭');
    closeBtn.addEventListener('click', () => this.hideMain());

    header.appendChild(btnGroup);
    popup.appendChild(header);

    // 搜索框
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'display:none; padding:8px 16px;';
    const searchInput = document.createElement('input');
    searchInput.className = 'review-search-input';
    searchInput.placeholder = '搜索笔记...';
    searchInput.style.cssText = 'width:100%;';
    searchInput.addEventListener('input', () => this.refreshPanel());
    searchWrap.appendChild(searchInput);
    popup.appendChild(searchWrap);
    this.searchInput = searchInput;

    const entries = document.createElement('div');
    entries.id = 'review-entries-container';
    popup.appendChild(entries);
    this.entriesContainer = entries;

    mask.appendChild(popup);
    document.body.appendChild(mask);
    this.mask = mask;
    this.popup = popup;

    this.refreshPanel();

    // 自动更新题库
    try {
      (app as any).commands?.executeCommandById?.('quiz-master-update');
    } catch {
      /* ignore */
    }
  }

  toggleSearch(): void {
    const wrap = this.searchInput?.parentElement as HTMLElement | undefined;
    if (!wrap) return;
    const hidden = wrap.style.display === 'none' || !wrap.style.display;
    wrap.style.display = hidden ? 'block' : 'none';
    if (!hidden && this.searchInput) this.searchInput.value = '';
    this.refreshPanel();
  }

  refreshPanel(): void {
    if (!this.entriesContainer) return;
    const items = this.dataManager.items as ReviewItem[];
    const kw = (this.searchInput?.value || '').trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (this.showArchived !== !!i.completed) return false;
      if (kw && !i.fileName.toLowerCase().includes(kw)) return false;
      return true;
    });
    this.renderEntries(filtered);
  }

  renderEntries(items: ReviewItem[]): void {
    const container = this.entriesContainer!;
    container.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'text-align:center; color:var(--text-muted); padding:30px 0;';
      empty.textContent = this.showArchived ? '没有已完成（归档）的复习' : '没有复习计划 🎉';
      container.appendChild(empty);
      return;
    }

    // 排序：逾期优先，再按 nextReviewDate
    const sorted = [...items].sort((a, b) => {
      if (!!a.isOverdue !== !!b.isOverdue) return a.isOverdue ? -1 : 1;
      return (a.nextReviewDate || 0) - (b.nextReviewDate || 0);
    });

    for (const item of sorted) {
      container.appendChild(this.createCard(item));
    }
  }

  createCard(item: ReviewItem): HTMLElement {
    const card = document.createElement('div');
    card.className = `review-card${item.completed ? ' completed' : item.isOverdue ? ' overdue' : ''}`;

    const name = document.createElement('span');
    name.textContent = item.fileName;
    name.style.cssText = 'flex:1; font-size:.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    card.appendChild(name);

    // 状态文案
    const fsrs = new FSRS();
    let statusText: string;
    let tagClass = 'ladder';
    if (item.completed) {
      statusText = '✅ 已完成';
      tagClass = 'completed-tag';
    } else if (item.isOverdue) {
      statusText = item.phase === 'fsrs' ? '⚠️ 逾期 (FSRS)' : `⚠️ 逾期 (${FSRS_FIRST_TEXTS[(item.currentStage || 1) - 1]})`;
      tagClass = 'overdue-tag';
    } else if (item.phase === 'fsrs') {
      statusText = `FSRS Lv.${item.stage - LADDER_MAX + 1}`;
      tagClass = 'fsrs';
    } else {
      statusText = `${item.currentStage}/${TOTAL_STAGES} ${FSRS_FIRST_TEXTS[(item.currentStage || 1) - 1]}`;
    }
    const tag = document.createElement('span');
    tag.className = `review-tag ${tagClass}`;
    tag.textContent = statusText;
    card.appendChild(tag);

    // FSRS R 标签
    if (item.phase === 'fsrs' && item.lastReviewed && item.stability) {
      const t = (Date.now() - item.lastReviewed) / 86400000;
      const r = fsrs.R(t, item.stability);
      const rTag = document.createElement('span');
      rTag.className = 'review-tag fsrs';
      rTag.textContent = `R=${Math.round(r * 100)}%`;
      rTag.style.background = r > 0.8 ? '#52c41a22' : r > 0.5 ? '#faad1422' : '#ff475722';
      card.appendChild(rTag);
    }

    // 时间
    const time = document.createElement('span');
    time.style.cssText = 'font-size:.75rem; color:var(--text-muted); flex-shrink:0;';
    if (item.completed) {
      time.textContent = '✅ 完成';
    } else if (item.isOverdue) {
      time.textContent = '📅 逾期';
    } else if (item.nextReviewDate) {
      const diff = item.nextReviewDate - Date.now();
      if (diff > 0) {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        time.textContent = `⏳ ${d}d|${h}h|${m}m`;
      } else {
        time.textContent = '📅 逾期';
      }
    } else {
      time.textContent = '⏳ 待定';
    }
    card.appendChild(time);

    // 长按移出（500ms）
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const startPress = () => {
      pressTimer = setTimeout(() => {
        this.showConfirm('移出复习计划', `确定移出“${item.fileName}”？`, async () => {
          await this.dataManager.removeItem(item.id);
          this.refreshPanel();
        });
      }, 500);
    };
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
    };
    card.addEventListener('mousedown', startPress);
    card.addEventListener('mouseup', cancelPress);
    card.addEventListener('mouseleave', cancelPress);
    card.addEventListener('touchstart', startPress);
    card.addEventListener('touchend', cancelPress);

    // 双击打开笔记
    card.addEventListener('dblclick', () => {
      const f = this.app.vault.getAbstractFileByPath(item.filePath);
      if (f) (this.app as any).workspace.getLeaf().openFile(f);
    });

    return card;
  }

  /** 难度弹窗 */
  showDifficultyDialog(item: ReviewItem, onRate: (rating: Rating) => void): void {
    const old = document.querySelector('.difficulty-dialog');
    if (old) old.remove();

    const dialog = document.createElement('div');
    dialog.className = 'difficulty-dialog';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--background-primary); border-radius:12px; padding:24px; max-width:420px; width:90%; text-align:center;';
    box.innerHTML = `<h4 style="margin:0 0 4px 0;">${item.fileName}</h4><p style="margin:0 0 16px 0; color:var(--text-muted); font-size:.85rem;">选择回忆难度</p>`;

    const btns: [Rating, string][] = [
      ['again', '🟥 忘了（Again）'],
      ['hard', '🟧 困难（Hard）'],
      ['good', '🟩 一般（Good）'],
      ['easy', '✅ 简单（Easy）'],
    ];
    for (const [rating, label] of btns) {
      const btn = document.createElement('button');
      btn.className = 'diff-btn';
      btn.textContent = label;
      btn.setAttribute('data-diff', rating);
      btn.addEventListener('click', () => {
        dialog.remove();
        onRate(rating);
      });
      box.appendChild(btn);
    }
    const cancel = document.createElement('button');
    cancel.className = 'diff-btn';
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => dialog.remove());
    box.appendChild(cancel);

    dialog.appendChild(box);
    document.body.appendChild(dialog);
  }

  /** 确认框 */
  showConfirm(title: string, message: string, onOk: () => void): void {
    if (this.confirmMask) this.confirmMask.remove();
    const mask = document.createElement('div');
    mask.id = 'review-confirm-mask';
    mask.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10003; display:flex; align-items:center; justify-content:center;';
    const popup = document.createElement('div');
    popup.id = 'review-confirm-popup';
    popup.style.cssText = 'background:var(--background-primary); border-radius:12px; padding:24px; max-width:400px; width:90%; text-align:center;';
    popup.innerHTML = `<h4 id="confirm-title" style="margin:0 0 8px 0;">${title}</h4><p id="confirm-message" style="margin:0 0 20px 0; color:var(--text-muted);">${message}</p>`;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:8px; justify-content:center;';
    const cancel = document.createElement('button');
    cancel.id = 'confirm-cancel';
    cancel.textContent = '取消';
    cancel.style.cssText = 'padding:6px 16px; border-radius:6px; border:none; background:var(--background-modifier-border); cursor:pointer;';
    cancel.addEventListener('click', () => this.closeConfirm());
    const ok = document.createElement('button');
    ok.id = 'confirm-ok';
    ok.textContent = '确定';
    ok.style.cssText = 'padding:6px 16px; border-radius:6px; border:none; background:#ff4757; color:white; cursor:pointer;';
    ok.addEventListener('click', () => {
      const cb = this.confirmCallback;
      this.closeConfirm();
      if (cb) cb();
    });
    btnRow.appendChild(cancel);
    btnRow.appendChild(ok);
    popup.appendChild(btnRow);

    mask.appendChild(popup);
    document.body.appendChild(mask);
    this.confirmMask = mask;
    this.confirmPopup = popup;
    this.confirmCallback = onOk;
  }

  closeConfirm(): void {
    if (this.confirmMask) this.confirmMask.remove();
    this.confirmMask = null;
    this.confirmPopup = null;
    this.confirmCallback = null;
  }

  hideMain(): void {
    if (this.mask) {
      this.mask.remove();
      this.mask = null;
      this.popup = null;
      this.entriesContainer = null;
    }
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeydown);
    this.hideMain();
    this.closeConfirm();
  }
}

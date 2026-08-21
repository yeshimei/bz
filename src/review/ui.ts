/**
 * 复习计划 UI（ticket 16 修正版：对齐源码 UIManager + Renderer，常驻 DOM + display 切换）
 */
import type { App } from 'obsidian';
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import { FSRS, FSRS_FIRST_TEXTS, LADDER_MAX, TOTAL_STAGES } from './fsrs';
import type { Rating } from './fsrs';
import type { ReviewItem } from './data';
import { ReviewDataManager } from './data';

export class UIManager {
  app: App;
  dataManager: ReviewDataManager;
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  entriesContainer: HTMLElement | null = null;
  confirmMask: HTMLElement | null = null;
  confirmPopup: HTMLElement | null = null;
  confirmCallback: (() => void) | null = null;
  escapeRegistered = false;
  searchInput: HTMLInputElement | null = null;
  showArchived = false;

  constructor(app: App, dataManager: ReviewDataManager) {
    this.app = app;
    this.dataManager = dataManager;
    this.createMainUI();
    this.createConfirmDialog();
    this.registerEscape();
  }

  createMainUI(): void {
    if (this.mask && document.body.contains(this.mask)) return;
    this.mask = document.createElement('div');
    this.mask.id = 'review-mask';
    Object.assign(this.mask.style, { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--background-modifier-cover)', zIndex: '9998', display: 'none' });
    this.mask.onclick = () => this.hideMain();

    this.popup = document.createElement('div');
    this.popup.id = 'review-popup';
    Object.assign(this.popup.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--background-primary)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', zIndex: '9999', width: '90%', maxWidth: '800px', maxHeight: '80vh', display: 'none', flexDirection: 'column' });
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 24px 8px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;';
    header.innerHTML = `
      <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text-normal);">复习计划</h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button id="review-btn-add" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">➕</button>
        <button id="review-btn-start" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">▶️</button>
        <button id="review-btn-search" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">🔍</button>
        <button id="review-btn-archive" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">📁</button>
        <button id="review-btn-quiz" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">🎯</button>
        <button id="review-btn-settings" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">⚙️</button>
        <button id="review-btn-close" style="background:none;border:none;cursor:pointer;font-size:13px;padding:0;width:21px;height:25px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">❌</button>
      </div>
    `;
    this.popup.appendChild(header);

    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = 'padding:0 24px 8px 24px;display:none;';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'review-search-input';
    searchInput.placeholder = '搜索笔记...';
    searchInput.style.width = '100%';
    searchContainer.appendChild(searchInput);
    this.popup.appendChild(searchContainer);
    this.searchInput = searchInput;

    const container = document.createElement('div');
    container.id = 'review-entries-container';
    container.style.cssText = 'flex:1;overflow-y:auto;padding:0 20px;min-height:200px;';
    this.popup.appendChild(container);
    this.entriesContainer = container;

    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);

    // 头部按钮事件（拆分：_bindHeaderEvents）
    this._bindHeaderEvents(header, searchContainer, searchInput);
  }

  /** 头部按钮与搜索框事件绑定（createMainUI 拆分） */
  _bindHeaderEvents(header: HTMLElement, searchContainer: HTMLElement, searchInput: HTMLInputElement): void {
    const app = this.app;
    header.querySelector('#review-btn-add')!.addEventListener('click', async () => {
      const file = app.workspace.getActiveFile();
      if (!file) {
        notice('请先打开一个笔记');
        return;
      }
      try {
        const { reviewApp } = await import('./app');
        await reviewApp.addCurrentToReview(file);
        await reviewApp.refreshPanel();
        await reviewApp.applyReviewStyles(app);
      } catch (e: any) {
        notice('操作失败：' + e.message, 'error');
      }
    });
    header.querySelector('#review-btn-start')!.addEventListener('click', async () => {
      const { reviewApp } = await import('./app');
      await reviewApp.autoJumpOverdue();
    });
    let searchVisible = false;
    header.querySelector('#review-btn-search')!.addEventListener('click', () => {
      searchVisible = !searchVisible;
      searchContainer.style.display = searchVisible ? 'block' : 'none';
      if (searchVisible) searchInput.focus();
      else {
        searchInput.value = '';
        this.refreshPanel();
      }
    });
    searchInput.addEventListener('input', () => this.refreshPanel());
    header.querySelector('#review-btn-archive')!.addEventListener('click', () => {
      this.showArchived = !this.showArchived;
      const btn = header.querySelector('#review-btn-archive') as HTMLElement;
      btn.textContent = this.showArchived ? '📂' : '📁';
      this.refreshPanel();
    });
    header.querySelector('#review-btn-quiz')!.addEventListener('click', () => {
      (app as any).commands?.executeCommandById?.('bz-quiz-open');
    });
    // 复习计划设置弹窗（ADR-0009：检查间隔/逾期通知 + 做题家 5 项）
    header.querySelector('#review-btn-settings')!.addEventListener('click', () => {
      openSettingsModal({
        title: '复习计划设置',
        build: (el) => this._buildSettingsItems(el),
      });
    });
    header.querySelector('#review-btn-close')!.addEventListener('click', () => this.hideMain());
  }

  /** 复习设置弹窗项（_bindHeaderEvents 拆分）：检查间隔/逾期通知 + 做题家 5 项 */
  _buildSettingsItems(el: HTMLElement): void {
    const s = getSettings();
    new Setting(el)
      .setName('检查间隔（秒）')
      .setDesc('逾期检查间隔，单位秒')
      .addText((text) =>
        text.setValue(s.autoCheckInterval || '').onChange(async (v) => {
          s.autoCheckInterval = v;
          await saveSettings();
        })
      );
    new Setting(el)
      .setName('启用逾期通知')
      .setDesc('是否在逾期时弹出通知')
      .addToggle((toggle) =>
        toggle.setValue(!!s.enableAutoNotify).onChange(async (v) => {
          s.enableAutoNotify = v;
          await saveSettings();
        })
      );
    // 做题家 4 项容器：仅「做题决定难度」开启时动态显示（spec 2026-08-07 用户决策，仿 AI tab 隐藏模式）
    const quizBox = document.createElement('div');
    quizBox.id = 'review-quiz-settings';
    new Setting(el)
      .setName('做题决定难度')
      .setDesc('开启后，点击复习自动做题，根据正确率自动选择难度')
      .addToggle((toggle) =>
        toggle.setValue(!!s.forceQuizForReview).onChange(async (v) => {
          s.forceQuizForReview = v;
          await saveSettings();
          quizBox.style.display = v ? '' : 'none';
        })
      );
    el.appendChild(quizBox);
    quizBox.style.display = s.forceQuizForReview ? '' : 'none';

    new Setting(quizBox)
      .setName('允许多选题')
      .setDesc('若关闭，AI 只生成单选题')
      .addToggle((toggle) =>
        toggle.setValue(!!s.enableMultipleChoice).onChange(async (v) => {
          s.enableMultipleChoice = v;
          await saveSettings();
        })
      );
    new Setting(quizBox)
      .setName('每笔记题目数量（0为自动）')
      .setDesc('设为0则由AI决定，设为正整数则固定数量')
      .addText((text) =>
        text.setValue(s.questionsPerNote || '').onChange(async (v) => {
          s.questionsPerNote = v;
          await saveSettings();
        })
      );
    new Setting(quizBox)
      .setName('打乱题目顺序')
      .setDesc('每次打开做题窗口时是否随机打乱题目')
      .addToggle((toggle) =>
        toggle.setValue(!!s.shuffleQuestions).onChange(async (v) => {
          s.shuffleQuestions = v;
          await saveSettings();
        })
      );
    new Setting(quizBox)
      .setName('题目难度')
      .setDesc('生成题目时的难度等级')
      .addDropdown((dd) => {
        dd.addOption('random', '随机');
        dd.addOption('easy', '简单');
        dd.addOption('medium', '中等');
        dd.addOption('hard', '困难');
        dd.setValue(s.difficulty || 'random');
        dd.onChange(async (v) => {
          s.difficulty = v;
          await saveSettings();
        });
      });
    if (isMobileEnv()) {
      new Setting(el)
        .setName('移动端默认全屏')
        .setDesc('移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）')
        .addToggle((toggle) =>
          toggle.setValue(!!s.reviewMobileDefaultFullscreen).onChange(async (v) => {
            s.reviewMobileDefaultFullscreen = v;
            await saveSettings();
          })
        );
    }
  }

  showMain(): void {
    this.createMainUI();
    if (!this.mask || !this.popup) return;
    // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
    applyMobileWindowFullscreen(this.popup, tryGetSettings().reviewMobileDefaultFullscreen === true);
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    this.refreshPanel();
    // 自动更新题库（异步，不阻塞界面）
    try {
      (this.app as any).commands?.executeCommandById?.('bz-quiz-update');
    } catch {
      /* ignore */
    }
  }

  hideMain(): void {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  createConfirmDialog(): void {
    if (this.confirmMask && document.body.contains(this.confirmMask)) return;
    this.confirmMask = document.createElement('div');
    Object.assign(this.confirmMask.style, { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: '10003', display: 'none' });
    this.confirmMask.onclick = (e) => {
      if (e.target === this.confirmMask) this.hideConfirm();
    };
    this.confirmPopup = document.createElement('div');
    Object.assign(this.confirmPopup.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--background-primary)', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: '10004', padding: '24px', maxWidth: '400px', width: '90%', display: 'none', flexDirection: 'column', alignItems: 'center', textAlign: 'center' });
    this.confirmPopup.innerHTML = `
      <h4 id="confirm-title" style="margin:0 0 12px 0;font-size:18px;font-weight:600;">确认删除</h4>
      <p id="confirm-message" style="margin:0 0 20px 0;font-size:15px;color:var(--text-muted);"></p>
      <div style="display:flex;gap:12px;width:100%;">
        <button id="confirm-cancel" style="flex:1;padding:8px;border:none;border-radius:6px;background:var(--background-secondary);cursor:pointer;">取消</button>
        <button id="confirm-ok" style="flex:1;padding:8px;border:none;border-radius:6px;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-weight:500;">确定</button>
      </div>
    `;
    document.body.appendChild(this.confirmMask);
    document.body.appendChild(this.confirmPopup);
    this.confirmPopup.querySelector('#confirm-cancel')!.addEventListener('click', () => this.hideConfirm());
    this.confirmPopup.querySelector('#confirm-ok')!.addEventListener('click', () => {
      if (typeof this.confirmCallback === 'function') this.confirmCallback();
      this.hideConfirm();
    });
  }

  showConfirm(title: string, msg: string, onConfirm?: () => void): void {
    this.createConfirmDialog();
    if (!this.confirmPopup || !this.confirmMask) return;
    this.confirmPopup.querySelector('#confirm-title')!.textContent = title || '确认';
    this.confirmPopup.querySelector('#confirm-message')!.textContent = msg || '';
    this.confirmCallback = onConfirm || null;
    this.confirmMask.style.display = 'block';
    this.confirmPopup.style.display = 'flex';
  }

  hideConfirm(): void {
    if (this.confirmMask) this.confirmMask.style.display = 'none';
    if (this.confirmPopup) this.confirmPopup.style.display = 'none';
    this.confirmCallback = null;
  }

  /** 难度弹窗（源码 L312-330 逐字） */
  showDifficultyDialog(item: ReviewItem, onSelect?: (diff: string) => void): void {
    const old = document.querySelector('.difficulty-dialog');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'difficulty-dialog';
    div.innerHTML = `
      <h4 style="margin:0 0 12px 0;font-size:16px;">标记复习：${item.name}</h4>
      <button class="diff-btn" data-diff="again" style="border-left:3px solid #ff4757;">🟥 忘了（Again）</button>
      <button class="diff-btn" data-diff="hard" style="border-left:3px solid #ff9f43;">🟧 困难（Hard）</button>
      <button class="diff-btn" data-diff="good" style="border-left:3px solid #2ed573;">🟩 一般（Good）</button>
      <button class="diff-btn" data-diff="easy" style="border-left:3px solid #7bed9f;">✅ 简单（Easy）</button>
      <button class="diff-btn" data-diff="cancel" style="margin-top:12px;color:var(--text-muted);">取消</button>
    `;
    document.body.appendChild(div);
    div.style.display = 'block';
    div.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        div.remove();
        const diff = (btn as HTMLElement).dataset.diff;
        if (diff !== 'cancel' && diff && onSelect) onSelect(diff);
      });
    });
    setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (!div.contains(e.target as Node)) {
          div.remove();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 100);
  }

  registerEscape(): void {
    if (this.escapeRegistered) return;
    this.escapeRegistered = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.confirmMask?.style.display === 'block') {
        this.hideConfirm();
        e.preventDefault();
        return;
      }
      if (this.mask?.style.display === 'block') {
        this.hideMain();
        e.preventDefault();
      }
    });
  }

  /** 刷新列表（源码 App.refreshPanel → Renderer.render） */
  async refreshPanel(): Promise<void> {
    const items = await this.dataManager.loadItems();
    const searchText = this.searchInput ? this.searchInput.value.trim() : '';
    this.renderEntries(items, searchText);
  }

  renderEntries(items: ReviewItem[], searchText = ''): void {
    const container = this.entriesContainer;
    if (!container) return;
    container.innerHTML = '';
    let filtered = items;
    // 归档开关：false=仅未完成，true=全部（源码语义）
    if (!this.showArchived) filtered = filtered.filter((i) => !i.isCompleted);
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(lower));
    }
    if (!filtered.length) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-faint);font-size:16px;">${this.showArchived ? '没有已完成（归档）的复习' : '没有复习计划 🎉'}</div>`;
      return;
    }
    filtered.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.nextReviewDate!).getTime() - new Date(b.nextReviewDate!).getTime();
    });
    for (const item of filtered) container.appendChild(this.createCard(item));
  }

  createCard(item: ReviewItem): HTMLElement {
    const app = this.app;
    const card = document.createElement('div');
    card.className = 'review-card';

    const content = document.createElement('span');
    content.className = 'review-content';
    content.textContent = item.name.replace(/^《|》$/g, '');
    content.title = item.filePath;
    content.onclick = async () => {
      this.hideMain();
      const file = app.vault.getAbstractFileByPath(item.filePath);
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file as any);
      } else notice('文件已删除', 'success');
    };
    card.appendChild(content);

    const meta = document.createElement('div');
    meta.className = 'review-meta';

    const stageTag = document.createElement('span');
    stageTag.className = 'review-tag';
    if (item.completed) {
      stageTag.textContent = '✅ 已完成';
      stageTag.classList.add('completed');
    } else if (item.isOverdue) {
      stageTag.textContent = item.phase === 'fsrs' ? '⚠️ 逾期 (FSRS)' : `⚠️ 逾期 (${FSRS_FIRST_TEXTS[(item.currentStage || 1) - 1]})`;
      stageTag.classList.add('overdue');
    } else if (item.phase === 'fsrs') {
      stageTag.textContent = `FSRS Lv.${item.stage - LADDER_MAX + 1}`;
    } else {
      stageTag.textContent = `${item.currentStage}/${TOTAL_STAGES} ${FSRS_FIRST_TEXTS[(item.currentStage || 1) - 1]}`;
    }
    if (!item.isCompleted) {
      stageTag.onclick = (e) => {
        e.stopPropagation();
        this.showDifficultyDialog(item, async (diff) => {
          const { reviewApp } = await import('./app');
          await reviewApp.markReview(item.filePath, diff as Rating);
          await this.refreshPanel();
          await reviewApp.applyReviewStyles(app);
        });
      };
    }
    meta.appendChild(stageTag);

    if ((item.averageConfidence || 0) > 0 && item.phase !== 'fsrs') {
      const conf = document.createElement('span');
      conf.className = 'review-tag';
      conf.textContent = `🎯 ${Math.round((item.averageConfidence || 0) * 100)}%`;
      conf.style.cursor = 'default';
      meta.appendChild(conf);
    }

    // FSRS 阶段显示 R(t)
    if (item.phase === 'fsrs' && item.stability && !item.completed) {
      const now = new Date();
      const last = item.lastReviewed ? new Date(item.lastReviewed) : null;
      if (last) {
        const t = (now.getTime() - last.getTime()) / 86400000;
        const fsrs = new FSRS();
        const r = fsrs.R(t, item.stability);
        const rPct = Math.round(r * 100);
        const rTag = document.createElement('span');
        rTag.className = 'review-tag';
        rTag.textContent = `R=${rPct}%`;
        rTag.style.cursor = 'default';
        if (r >= 0.9) rTag.style.background = '#52c41a22';
        else if (r >= 0.7) rTag.style.background = '#faad1422';
        else rTag.style.background = '#ff475722';
        meta.appendChild(rTag);
      }
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'review-time';
    if (item.isCompleted) timeSpan.textContent = '✅ 完成';
    else if (item.nextReviewDate) {
      const now = new Date();
      const diff = new Date(item.nextReviewDate).getTime() - now.getTime();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        let text = '';
        if (days > 0) text = `${days}d`;
        else if (hours > 0) text = `${hours}h`;
        else text = `${mins}m`;
        timeSpan.textContent = `⏳ ${text}`;
      } else timeSpan.textContent = '📅 逾期';
    } else timeSpan.textContent = '⏳ 待定';

    // 长按移出（绑定 timeSpan，源码 L438-456）
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = (e: MouseEvent | TouchEvent) => {
      if ('button' in e && e.button !== 0) return;
      timer = setTimeout(() => {
        this.showConfirm('移出复习计划', `确定移出“${item.name}”？`, async () => {
          await this.dataManager.removeItem(item.filePath);
          await this.refreshPanel();
          const { reviewApp } = await import('./app');
          await reviewApp.applyReviewStyles(app);
        });
      }, 500);
    };
    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    timeSpan.addEventListener('mousedown', start);
    timeSpan.addEventListener('mouseup', cancel);
    timeSpan.addEventListener('mouseleave', cancel);
    timeSpan.addEventListener('touchstart', start);
    timeSpan.addEventListener('touchend', cancel);
    timeSpan.addEventListener('touchmove', cancel);
    meta.appendChild(timeSpan);

    card.appendChild(meta);
    return card;
  }

  /** 销毁（卸载清理） */
  destroy(): void {
    this.hideMain();
    this.hideConfirm();
    if (this.mask) this.mask.remove();
    if (this.popup) this.popup.remove();
    if (this.confirmMask) this.confirmMask.remove();
    if (this.confirmPopup) this.confirmPopup.remove();
    this.mask = null;
    this.popup = null;
    this.confirmMask = null;
    this.confirmPopup = null;
    this.entriesContainer = null;
  }
}

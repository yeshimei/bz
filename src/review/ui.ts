/**
 * 复习计划 UI（ticket 16 修正版：对齐源码 UIManager + Renderer，常驻 DOM + display 切换）
 * 统一抽屉（桌面右键/移动长按）：开始复习/打开原文/移出；双击名称打开对应笔记（用户拍板保留）。
 */
import type { App } from 'obsidian';
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import { FolderSelectModal } from '../attach/ui';
import {
  attachItemActions,
  registerSheetCompanion,
  unregisterSheetCompanion,
  closeItemMenu,
  type ItemAction,
} from '../core/item-actions';
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
    header.className = 'bz-win-head';
    header.style.cssText = 'padding:16px 24px 8px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;';
    header.innerHTML = `
      <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text-normal);">复习计划</h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button id="review-btn-add" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">➕</button>
        <button id="review-btn-start" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">▶️</button>
        <button id="review-btn-search" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">🔍</button>
        <button id="review-btn-archive" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">📁</button>
        <button id="review-btn-settings" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">⚙️</button>
        <button id="review-btn-close" class="bz-win-close" style="background:none;border:none;cursor:pointer;font-size:13px;padding:0;width:21px;height:25px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">❌</button>
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
    // ticket 099：监听文件夹（多目录、递归）——文件夹选择弹窗添加 + chip 关闭标签
    new Setting(el)
      .setName('监听文件夹')
      .setDesc('目录内未加入且未排除的 .md 自动进入复习计划（递归）；新增目录会先确认存量加入，取消则不添加');
    const watchBox = document.createElement('div');
    watchBox.id = 'review-watch-folders';
    el.appendChild(watchBox);
    const renderWatchRows = () => {
      watchBox.innerHTML = '';
      const folders = s.reviewWatchedFolders || [];
      folders.forEach((folder, idx) => {
        const chip = document.createElement('span');
        chip.className = 'bz-review-watch-chip';
        const name = document.createElement('span');
        name.className = 'bz-review-watch-name';
        name.textContent = folder;
        const close = document.createElement('button');
        close.className = 'bz-review-watch-close';
        close.setAttribute('aria-label', `移除监听文件夹 ${folder}`);
        close.textContent = '✕';
        close.onclick = () => {
          void (async () => {
            // ticket 099 追加：移除目录同时清空其下排除记录（否则二次添加时存量被旧黑名单挡住）
            const { ReviewWatcher } = await import('./watch');
            const cleared = await new ReviewWatcher(this.app, this.dataManager).removeWatchedFolder(folder);
            renderWatchRows();
            notice(cleared > 0 ? `已移除监听文件夹，并清理其下 ${cleared} 条排除记录` : '已移除监听文件夹', 'success');
          })();
        };
        chip.appendChild(name);
        chip.appendChild(close);
        watchBox.appendChild(chip);
      });
      const addRow = document.createElement('div');
      addRow.className = 'setting-item';
      addRow.style.cssText = 'border:none;padding:8px 0;';
      const ctl = document.createElement('div');
      ctl.className = 'setting-item-control';
      const addBtn = document.createElement('button');
      addBtn.className = 'mod-cta';
      addBtn.textContent = '＋ 添加监听文件夹';
      addBtn.onclick = () => {
        void (async () => {
          const { ReviewWatcher } = await import('./watch');
          const watcher = new ReviewWatcher(this.app, this.dataManager);
          // ticket 099 追加：复用附件搬移的 FolderSelectModal（z-index 200000 压设置弹窗；不读 attachLastFolder）
          new FolderSelectModal(this.app, async (picked) => {
            const folder = picked.trim().replace(/^\/+|\/+$/g, '');
            if (!folder) {
              notice('未选择文件夹', 'warning');
              return;
            }
            if ((s.reviewWatchedFolders || []).includes(folder)) {
              notice('该文件夹已在监听列表', 'info');
              return;
            }
            // 选择后立即确认存量收编：取消=什么都不做（不添加目录、不写排除名单）
            const confirmed = await watcher.confirmBatchAddForFolder(folder);
            if (!confirmed) return;
            s.reviewWatchedFolders = [...(s.reviewWatchedFolders || []), folder];
            await saveSettings();
            renderWatchRows();
          }, {
            title: '选择监听文件夹',
            okText: '确定',
            placeholder: 'vault 内目录路径，如 卡片盒/复习',
            initial: '',
          }).open();
        })();
      };
      ctl.appendChild(addBtn);
      addRow.appendChild(ctl);
      watchBox.appendChild(addRow);
    };
    renderWatchRows();

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
    // 自动更新题库（做题家命令入口已退役 → 模块直调，ADR-0045；异步不阻塞界面）
    void (async () => {
      try {
        const { quizUpdate } = await import('../quiz');
        await quizUpdate(this.app);
      } catch {
        /* ignore */
      }
    })();
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
        // 抽屉来源打开时注册过附属浮层：关闭前注销（非抽屉路径 unregister 未注册元素为 no-op）
        unregisterSheetCompanion(div);
        div.remove();
        const diff = (btn as HTMLElement).dataset.diff;
        if (diff !== 'cancel' && diff && onSelect) onSelect(diff);
      });
    });
    setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (!div.contains(e.target as Node)) {
          unregisterSheetCompanion(div);
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
    // ticket 098：挂起记录（文件不存在）→ 删除线
    if (item.isMissing) content.classList.add('review-missing');
    // 双击打开对应笔记（用户拍板保留双击；单击打开收敛进抽屉）
    content.addEventListener('dblclick', () => {
      if (item.isMissing) {
        notice('文件已删除');
        return;
      }
      void this.openItemFile(item);
    });
    card.appendChild(content);

    const meta = document.createElement('div');
    meta.className = 'review-meta';

    const stageTag = document.createElement('span');
    stageTag.className = 'review-tag';
    stageTag.textContent = this.stageLabel(item);
    if (item.completed) stageTag.classList.add('completed');
    else if (item.isOverdue) stageTag.classList.add('overdue');
    // 点击评分收敛进抽屉「开始复习」（用户拍板）
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
    timeSpan.textContent = this.dueLabel(item);
    // 长按移出收敛进抽屉（用户拍板）
    meta.appendChild(timeSpan);

    card.appendChild(meta);

    // 统一抽屉（桌面右键/移动长按）：开始复习 → 打开原文 → 移出
    this.attachDrawerActions(card, item);
    return card;
  }

  /** 阶段标签文本（卡片标签与抽屉头部共用） */
  private stageLabel(item: ReviewItem): string {
    if (item.isMissing) return '不存在';
    if (item.completed) return '✅ 已完成';
    if (item.isOverdue) {
      return item.phase === 'fsrs' ? '⚠️ 逾期 (FSRS)' : `⚠️ 逾期 (${FSRS_FIRST_TEXTS[(item.currentStage || 1) - 1]})`;
    }
    if (item.phase === 'fsrs') return `FSRS Lv.${item.stage - LADDER_MAX + 1}`;
    return `${item.currentStage}/${TOTAL_STAGES} ${FSRS_FIRST_TEXTS[(item.currentStage || 1) - 1]}`;
  }

  /** 到期时间文本（卡片时间与抽屉头部共用） */
  private dueLabel(item: ReviewItem): string {
    if (item.isMissing) return '文件缺失';
    if (item.isCompleted) return '✅ 完成';
    if (item.nextReviewDate) {
      const diff = new Date(item.nextReviewDate).getTime() - Date.now();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        let text = '';
        if (days > 0) text = `${days}d`;
        else if (hours > 0) text = `${hours}h`;
        else text = `${mins}m`;
        return `⏳ ${text}`;
      }
      return '📅 逾期';
    }
    return '⏳ 待定';
  }

  /** 打开对应笔记文件（双击名称与抽屉「打开原文」共用） */
  private async openItemFile(item: ReviewItem): Promise<void> {
    this.hideMain();
    const file = this.app.vault.getAbstractFileByPath(item.filePath);
    if (file) {
      const leaf = this.app.workspace.getLeaf();
      await leaf.openFile(file as any);
    } else notice('文件已删除', 'success');
  }

  /** 卡片挂统一抽屉 + 头部（🔁 名称 + 阶段 · 到期） */
  private attachDrawerActions(card: HTMLElement, item: ReviewItem): void {
    const actions: ItemAction[] = [];

    // 开始复习（未完成且文件存在；keepOpen + companion 难度弹窗，选完难度关抽屉——列表已重绘）
    if (!item.isCompleted && !item.completed && !item.isMissing) {
      actions.push({
        icon: 'play',
        label: '开始复习',
        keepOpen: true,
        onClick: () => {
          this.showDifficultyDialog(item, async (diff) => {
            const { reviewApp } = await import('./app');
            await reviewApp.markReview(item.filePath, diff as Rating);
            await this.refreshPanel();
            await reviewApp.applyReviewStyles(this.app);
            closeItemMenu(); // 复习已记录、列表重绘，抽屉数据陈旧直接关闭
          });
          // 难度弹窗作为附属浮层叠在抽屉上（内部点击不误关抽屉）
          const dlg = document.querySelector('.difficulty-dialog');
          if (dlg) registerSheetCompanion(dlg as HTMLElement);
        },
      });
    }

    // 打开原文（与名称双击同路径）
    actions.push({
      icon: 'file-text',
      label: '打开原文',
      onClick: () => {
        void this.openItemFile(item);
      },
    });

    // 移出复习计划（danger：先收抽屉再确认）
    actions.push({
      icon: 'trash-2',
      label: '移出复习计划',
      kind: 'danger',
      onClick: () => {
        this.showConfirm('移出复习计划', `确定移出“${item.name}”？`, async () => {
          await this.dataManager.removeItem(item.filePath);
          await this.refreshPanel();
          const { reviewApp } = await import('./app');
          await reviewApp.applyReviewStyles(this.app);
        });
      },
    });

    attachItemActions(card, actions, { sheetHead: this.buildSheetHead(item) });
  }

  /** 抽屉头部：🔁 + 名称；小字=阶段 · 到期 */
  private buildSheetHead(item: ReviewItem): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';

    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔁';
    body.appendChild(emoji);

    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';
    const title = document.createElement('div');
    title.className = 'bz-item-sheet-title';
    title.textContent = item.name.replace(/^《|》$/g, '');
    info.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'bz-item-sheet-sub';
    sub.textContent = `${this.stageLabel(item)} · ${this.dueLabel(item)}`;
    info.appendChild(sub);

    body.appendChild(info);
    head.appendChild(body);
    return head;
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


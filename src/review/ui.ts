/**
 * 复习计划 UI（ticket 16 修正版：对齐源码 UIManager + Renderer，常驻 DOM + display 切换）
 * 统一抽屉（桌面右键/移动长按）：开始复习/打开原文/移出；双击名称打开对应笔记（用户拍板保留）。
 */
import { Setting, type App } from 'obsidian';
import { topifyZ, allocZ } from '../core/z-order';
import { notice, notifyUndo, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
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

/**
 * 复习计划设置 schema（ticket 131 声明式；ADR-0064）：检查提醒/做题家/复习节奏/自动化/界面 +
 * 移动端六组卡片。做题家子项显隐（原 quizBox style.display + refreshSettingsGroupCounts）收敛为
 * visibleWhen 声明式联动；监听文件夹走通用 path 行（multi chips + 添加… 按钮，落盘外部 binding
 * 自管：新增先确认存量收编、移除连带清理排除记录）；排除名单 chips 区走 custom 插槽（DOM id/类名
 * 零变化）。置于模块顶层供文案 lint 直接引用；
 * deps 仅在交互回调（custom/path onChange）经闭包引用，工厂构建无副作用。
 */
export function reviewSettingsSchema(deps: { app: App; dataManager: ReviewDataManager }): SettingsSchema {
  // 排除名单 custom 行的 chips 重渲染句柄（原 renderExcludeRows；交互后调用）
  let renderExcludeRows: (() => void) | null = null;
  // enableAutoNotify 常驻轮询在 main.ts onload 注册、运行时按设置实时读值（app.ts checkOverdueAndNotify
  // 门控），设置弹窗 toggle 只需落盘，渲染器键直绑自动完成，无需额外副作用回调。
  return {
    groups: [
      {
        icon: 'bell',
        name: '检查提醒',
        rows: [
          { type: 'toggle', name: '到期提醒', desc: '有笔记到期待复习时自动弹出提醒', binding: { key: 'enableAutoNotify' } },
          { type: 'toggle', name: '新笔记加入提醒', desc: '新笔记被自动加入时弹出提示，多条合并成一条', binding: { key: 'reviewAutoAddNotice' } },
        ],
      },
      {
        icon: 'graduation-cap',
        name: '做题家',
        rows: [
          { type: 'toggle', name: '用做题测难度', desc: '开始复习即做题，按正确率自动定难度', binding: { key: 'forceQuizForReview' } },
          // 出题子项：仅「用做题测难度」开启时显示（ticket 170 isChild 联动 + visibleWhen 兜底）
          { type: 'toggle', name: '允许多选题', desc: '开启后 AI 可能出多选题，关闭则只出单选题', binding: { key: 'enableMultipleChoice' }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
          { type: 'text', name: '每篇笔记出题数量', desc: '固定每篇笔记出题的数量，留空/0=自动', binding: { key: 'questionsPerNote' }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
          { type: 'toggle', name: '打乱出题顺序', desc: '做题时随机排列题目顺序', binding: { key: 'shuffleQuestions' }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
          {
            type: 'select',
            name: '出题难度',
            desc: '控制 AI 出题深浅',
            binding: { key: 'difficulty' },
            options: [
              { value: 'random', label: '随机' },
              { value: 'easy', label: '简单' },
              { value: 'medium', label: '中等' },
              { value: 'hard', label: '困难' },
            ],
            visibleWhen: (s) => s.forceQuizForReview === true,
            isChild: true,
          },
        ],
      },
      {
        icon: 'timer',
        name: '复习节奏',
        rows: [
          // 非正数钳制为 0（原 onChange 口径：>0 保留否则 0）；空串不写（防脏值落盘）
          { type: 'number', name: '每日复习上限', desc: '一轮最多复习的篇数，不填则不限制', binding: { key: 'reviewDailyLimit' }, min: 0 },
          // 原钳制「n>0 且 n<=5 保留、否则回 1」：渲染器 min/max 只做边界钳制，超上界回 1 语义在 onChange 复刻
          {
            type: 'number',
            name: '复习间隔缩放',
            desc: '数值越小复习越频繁，数值越大越宽松',
            binding: { key: 'reviewIntervalScale' },
            onChange: (v) => {
              if (!(v > 0 && v <= 5)) (getSettings() as any).reviewIntervalScale = 1;
            },
          },
          // ADR-0077：R 目标阈值（低于该值视为可复习/提前；默认 0.9）
          {
            type: 'number',
            name: 'R 目标阈值',
            desc: '记忆保留度低于该值视为该复习了',
            binding: { key: 'reviewRThreshold' },
            min: 0.5,
            max: 0.99,
          },
        ],
      },
      {
        icon: 'brain',
        name: '记忆算法',
        rows: [
          // ADR-0077：FSRS 参数自动拟合（全自动定期重算）
          { type: 'toggle', name: '参数自动拟合', desc: '按个人复习历史拟合记忆参数，优化复习节奏', binding: { key: 'reviewEnableFit' } },
          {
            type: 'number',
            name: '每 N 次复习重算',
            desc: '累计 N 次评级后自动重拟合一次',
            binding: { key: 'reviewFitEveryN' },
            min: 1,
            visibleWhen: (s) => (s as any).reviewEnableFit === true,
            isChild: true,
          },
        ],
      },
      {
        icon: 'sliders-horizontal',
        name: '自动化',
        rows: [
          // 监听文件夹：通用 path 行（multi chips + 添加… 按钮，ticket 133 形态）。
          // 落盘走外部 binding 自管（权威写盘在 onChange）：新增目录需先确认存量收编（取消=不加入，
          // 回传回退清单否决本次变更），移除目录需连带清理其下排除记录（ticket 099）。
          {
            type: 'path',
            mode: 'multi',
            name: '监听文件夹',
            desc: '文件夹里的新笔记自动加入复习计划，包括子文件夹',
            binding: {
              get: () => ((getSettings() as any).reviewWatchedFolders || []) as string[],
              set: () => {},
              save: () => {},
            },
            pickerTitle: '选择监听文件夹',
            pickerDesc: '文件夹里的新笔记自动加入复习计划，包括子文件夹',
            okText: '确定',
            onChange: (list) => {
              const prev = [...(((getSettings() as any).reviewWatchedFolders as string[]) || [])];
              return (async (): Promise<string[]> => {
                const { ReviewWatcher } = await import('./watch');
                const watcher = new ReviewWatcher(deps.app, deps.dataManager);
                const kept: string[] = [];
                for (const folder of list) {
                  if (!folder) {
                    notice('暂不支持监听库根目录', 'warning');
                    continue;
                  }
                  if (prev.includes(folder)) {
                    kept.push(folder);
                    continue;
                  }
                  // 新增：先确认存量收编；取消 = 该目录不加入（不写排除名单）
                  if (await watcher.confirmBatchAddForFolder(folder)) kept.push(folder);
                }
                for (const folder of prev) {
                  if (list.includes(folder)) continue;
                  // 移除：同时清空其下排除记录（否则二次添加时存量被旧黑名单挡住）
                  const cleared = await watcher.removeWatchedFolder(folder);
                  notice(cleared > 0 ? `已移除监听文件夹，并清理其下 ${cleared} 条排除记录` : '已移除监听文件夹', 'success');
                }
                (getSettings() as any).reviewWatchedFolders = kept;
                await saveSettings();
                return kept;
              })();
            },
          },
          // 排除名单 chips 区（ticket 57 管理 UI；DOM id/类名零变化；交互后经 renderExcludeRows 重渲染）
          {
            type: 'custom',
            render: (body) => {
              const setting = new Setting(body).setName('排除名单').setDesc('不参与监听自动加入的笔记，可在此单条解除');
              setting.settingEl.classList.add('bz-review-exclude-row');
              const excludeBox = document.createElement('div');
              excludeBox.id = 'review-excluded-list';
              setting.controlEl.appendChild(excludeBox);
              renderExcludeRows = () => {
                excludeBox.innerHTML = '';
                const notes = (getSettings() as any).reviewExcludedNotes || [];
                if (!notes.length) {
                  const empty = document.createElement('div');
                  empty.className = 'bz-review-exclude-empty';
                  empty.textContent = '暂无排除笔记';
                  excludeBox.appendChild(empty);
                  return;
                }
                notes.forEach((path: string) => {
                  const chip = document.createElement('span');
                  chip.className = 'bz-review-exclude-chip';
                  const name = document.createElement('span');
                  name.className = 'bz-review-exclude-name';
                  name.textContent = path;
                  name.title = path;
                  const remove = document.createElement('button');
                  remove.className = 'bz-review-exclude-remove';
                  remove.setAttribute('aria-label', `解除排除 ${path}`);
                  remove.textContent = '✕';
                  remove.onclick = () => {
                    void (async () => {
                      const { ReviewWatcher } = await import('./watch');
                      await new ReviewWatcher(deps.app, deps.dataManager).removeExcludedNote(path);
                      renderExcludeRows?.();
                      notice('已解除排除', 'success');
                    })();
                  };
                  chip.appendChild(name);
                  chip.appendChild(remove);
                  excludeBox.appendChild(chip);
                });
              };
              renderExcludeRows();
            },
          },
        ],
      },
      {
        icon: 'eye',
        name: '界面',
        rows: [
          { type: 'toggle', name: '文件树标记', desc: '在文件树中为复习笔记着色并标到期时间', binding: { key: 'reviewTreeBadge' } },
        ],
      },
      // ticket 170：所有域移动端组统一无描述
      mobileFullscreenGroup('reviewMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}

export class UIManager {
  app: App;
  dataManager: ReviewDataManager;
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  entriesContainer: HTMLElement | null = null;
  /** ticket 141：ESC 走 escManager 层级（原私挂 document keydown 迁移，esc-manager 立约禁私挂） */
  private escHandle: { unregister: () => void } | null = null;
  /** 搜索防抖句柄（ticket 141：逐键全量重渲染收敛 180ms 防抖，对齐密码域先例） */
  private searchTimer: number | null = null;
  searchInput: HTMLInputElement | null = null;
  showArchived = false;
  /** ADR-0077：今日/明日预告条 */
  previewBar: HTMLElement | null = null;
  /** ADR-0077：文件夹筛选输入 */
  filterInput: HTMLInputElement | null = null;
  /** ADR-0077：当前文件夹筛选（空=不过滤） */
  folderFilter = '';

  constructor(app: App, dataManager: ReviewDataManager) {
    this.app = app;
    this.dataManager = dataManager;
    this.createMainUI();
    this.registerEscLayer();
  }

  createMainUI(): void {
    if (this.mask && document.body.contains(this.mask)) return;
    this.mask = document.createElement('div');
    this.mask.id = 'review-mask';
    // 显隐为功能性内联（铁律 8 允许）；布局/配色已收敛 styles.css
    this.mask.style.display = 'none';
    this.mask.style.zIndex = String(allocZ()); // ADR-0067：创建即发号（显示时 topifyZ 再抬）
    this.mask.onclick = () => this.hideMain();

    this.popup = document.createElement('div');
    this.popup.id = 'review-popup';
    this.popup.style.display = 'none';
    this.popup.style.zIndex = String(allocZ()); // ADR-0067：创建即发号
    // 头行按钮统一规格由 core styles.css `.bz-win-head button` 承担（含关闭钮隐藏/全屏显示约定）
    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <h3 class="bz-review-title">复习计划</h3>
      <div>
        <button id="review-btn-add" title="加入当前笔记">➕</button>
        <button id="review-btn-start" title="开始复习">▶️</button>
        <button id="review-btn-search" title="搜索">🔍</button>
        <button id="review-btn-stats" title="统计">📊</button>
        <button id="review-btn-archive" title="已完成（归档）">📁</button>
        <button id="review-btn-settings" title="设置">⚙️</button>
        <button id="review-btn-close" class="bz-win-close" title="关闭">❌</button>
      </div>
    `;
    this.popup.appendChild(header);

    const searchContainer = document.createElement('div');
    searchContainer.id = 'review-search-wrap';
    searchContainer.style.display = 'none';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'review-search-input';
    searchInput.placeholder = '搜索笔记...';
    searchContainer.appendChild(searchInput);
    this.popup.appendChild(searchContainer);
    this.searchInput = searchInput;

    // ADR-0077：今日/明日预告条 + 文件夹筛选栏 + 抽查输入（轻量，不另开窗）
    const previewBar = document.createElement('div');
    previewBar.id = 'review-preview-bar';
    previewBar.className = 'bz-review-preview-bar';
    previewBar.style.display = 'none';
    this.popup.appendChild(previewBar);
    this.previewBar = previewBar;

    const filterBar = document.createElement('div');
    filterBar.id = 'review-filter-bar';
    filterBar.className = 'bz-review-filter-bar';
    filterBar.style.display = 'none';
    const filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.id = 'review-filter-input';
    filterInput.className = 'review-filter-input';
    filterInput.placeholder = '按文件夹筛选...（如 项目/A）';
    filterBar.appendChild(filterInput);
    this.popup.appendChild(filterBar);
    this.filterInput = filterInput;

    const container = document.createElement('div');
    container.id = 'review-entries-container';
    this.popup.appendChild(container);
    this.entriesContainer = container;
    // ticket x5：列表键盘路径（方向键移动焦点 + 回车执行主操作；低频，Tab 原生可达无焦点陷阱）
    container.addEventListener('keydown', (e: KeyboardEvent) => this.onEntriesKeydown(e));

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
    // ADR-0077：统计弹窗（全局指标 + 负载 + 单条时间线）
    header.querySelector('#review-btn-stats')!.addEventListener('click', async () => {
      const { showStatsModal } = await import('./stats-ui');
      await showStatsModal(this.app, this.dataManager);
    });
    // ADR-0077：文件夹筛选栏（防抖重渲染）
    const filterInput = this.filterInput;
    filterInput?.addEventListener('input', () => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        this.folderFilter = filterInput.value.trim();
        void this.refreshPanel();
      }, 180);
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
    // ticket 141：搜索防抖 180ms（原逐键 loadItems + 全量重渲染）
    searchInput.addEventListener('input', () => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        void this.refreshPanel();
      }, 180);
    });
    header.querySelector('#review-btn-archive')!.addEventListener('click', () => {
      this.showArchived = !this.showArchived;
      const btn = header.querySelector('#review-btn-archive') as HTMLElement;
      btn.textContent = this.showArchived ? '📂' : '📁';
      this.refreshPanel();
    });

    // 复习计划设置弹窗（ADR-0009：检查提醒/做题家/复习节奏/自动化/界面/移动端；分组卡片重设计；
    // ticket 131 声明式 schema——六组逐一转 schema，做题家子项显隐走 visibleWhen）
    header.querySelector('#review-btn-settings')!.addEventListener('click', () => {
      openSettingsModal({
        title: '复习计划设置',
        maxWidth: 560,
        schema: reviewSettingsSchema({ app: this.app, dataManager: this.dataManager }),
      });
    });
    header.querySelector('#review-btn-close')!.addEventListener('click', () => this.hideMain());
  }

  showMain(): void {
    this.createMainUI();
    if (!this.mask || !this.popup) return;
    // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
    applyMobileWindowFullscreen(this.popup, tryGetSettings().reviewMobileDefaultFullscreen === true);
    topifyZ(this.mask, this.popup); // ADR-0067：显示即发号，谁后显示谁在上
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    this.refreshPanel();
    this.refreshPreviewBar();
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

  /** 难度弹窗（源码 L312-330 逐字） */
  showDifficultyDialog(item: ReviewItem, onSelect?: (diff: string) => void): void {
    const old = document.querySelector('.difficulty-dialog');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'difficulty-dialog';
    div.style.zIndex = String(allocZ()); // ADR-0067：一次性弹窗，创建即显示即发号
    // ticket s1：文件名经 escapeHtml 转义后拼 HTML
    div.innerHTML = `
      <h4>标记复习：${escapeHtml(item.name)}</h4>
      <button class="diff-btn" data-diff="again">🟥 忘了（Again）</button>
      <button class="diff-btn" data-diff="hard">🟧 困难（Hard）</button>
      <button class="diff-btn" data-diff="good">🟩 一般（Good）</button>
      <button class="diff-btn" data-diff="easy">✅ 简单（Easy）</button>
      <button class="diff-btn diff-btn-cancel" data-diff="cancel">取消</button>
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

  /**
   * ticket 141：ESC 走 escManager 层级注册（原 registerEscape 私挂 document keydown 迁移）。
   * 主面板层：确认框场景由 openFlowDialog 自带的 'q3-confirm' 层盖在其上，无需自管。
   */
  private registerEscLayer(): void {
    if (this.escHandle) return;
    this.escHandle = escManager.register('review-main', {
      isVisible: () => !!this.mask && this.mask.style.display === 'block',
      close: () => this.hideMain(),
    });
  }

  /** 刷新列表（源码 App.refreshPanel → Renderer.render） */
  async refreshPanel(): Promise<void> {
    const items = await this.dataManager.loadItems();
    const searchText = this.searchInput ? this.searchInput.value.trim() : '';
    this.renderEntries(items, searchText);
  }

  /** ADR-0077：今日/明日预告条刷新（负载预览，固定显示在面板顶部） */
  async refreshPreviewBar(): Promise<void> {
    const bar = this.previewBar;
    if (!bar) return;
    const items = await this.dataManager.loadItems();
    const { loadPreview } = await import('./stats');
    const { today, tomorrow } = loadPreview(items);
    bar.style.display = 'flex';
    bar.innerHTML = '';
    const todayEl = document.createElement('span');
    todayEl.className = 'bz-review-preview-chip';
    todayEl.textContent = `今日 ${today} 篇`;
    if (today > 0) todayEl.classList.add('bz-review-preview-hot');
    const tmrEl = document.createElement('span');
    tmrEl.className = 'bz-review-preview-chip';
    tmrEl.textContent = `明日 ${tomorrow} 篇`;
    bar.appendChild(todayEl);
    bar.appendChild(tmrEl);
  }

  renderEntries(items: ReviewItem[], searchText = ''): void {
    const container = this.entriesContainer;
    if (!container) return;
    container.innerHTML = '';
    let filtered = items;
    // 归档开关：false=仅未完成，true=全部（源码语义）
    if (!this.showArchived) filtered = filtered.filter((i) => !i.isCompleted);
    // ADR-0077：文件夹筛选（filePath 前缀匹配，空=不过滤）
    if (this.folderFilter) {
      const f = this.folderFilter.toLowerCase();
      filtered = filtered.filter((i) => i.filePath.toLowerCase().startsWith(f));
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(lower));
    }
    if (!filtered.length) {
      // ticket l6（解冻：新增空态文案）：空态补首步引导；ticket 141 样式收敛 classes
      if (this.showArchived) {
        container.innerHTML = `<div class="bz-review-empty">没有已完成（归档）的复习</div>`;
      } else {
        container.innerHTML = `
          <div class="bz-review-empty">
            <div>没有复习计划 🎉</div>
            <div class="bz-review-empty-sub">打开任意笔记使用「加入复习计划」命令，或在 ⚙️ 设置中添加监听文件夹</div>
          </div>`;
      }
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
    // ticket x5：列表键盘路径——卡片可聚焦（Tab 原生可达），方向键在卡片间移动焦点，回车执行主操作
    card.tabIndex = 0;
    (card as any).__reviewItem = item;

    const content = document.createElement('span');
    content.className = 'review-content';
    content.textContent = item.name.replace(/^《|》$/g, '');
    content.title = item.filePath;
    // ticket 098：挂起记录（文件不存在）→ 删除线
    if (item.isMissing) content.classList.add('review-missing');
    // 双击打开对应笔记（用户拍板保留双击；单击打开收敛进抽屉）
    content.addEventListener('dblclick', () => {
      if (item.isMissing) {
        notice('文件已删除', 'warning');
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
        if (r >= 0.9) rTag.classList.add('bz-review-r-high');
        else if (r >= 0.7) rTag.classList.add('bz-review-r-mid');
        else rTag.classList.add('bz-review-r-low');
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

  /** 到期时间文本（卡片时间与抽屉头部共用）
   *  ticket 174：已完成卡片时间列不再重复 ✅，改用相对完成时间（formatRelativeTime） */
  private dueLabel(item: ReviewItem): string {
    if (item.isMissing) return '文件缺失';
    if (item.isCompleted) {
      // 已完成：显示相对完成时间（无 lastReviewed 则空，避免与阶段标签「✅ 已完成」重复）
      return item.lastReviewed ? formatRelativeTime(new Date(item.lastReviewed)) : '';
    }
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

  /** 打开对应笔记文件（双击名称与抽屉「打开原文」共用）
   *  ticket 141：文件缺失通知改 warning（原 success 红绿颠倒） */
  private async openItemFile(item: ReviewItem): Promise<void> {
    this.hideMain();
    const file = this.app.vault.getAbstractFileByPath(item.filePath);
    if (file) {
      const leaf = this.app.workspace.getLeaf();
      await leaf.openFile(file as any);
    } else notice('文件已删除', 'warning');
  }

  /**
   * ticket x5：列表键盘路径（列表级 keydown，事件委托；低频，不引入焦点陷阱——Tab 原生可达）。
   * 方向键在卡片间移动焦点；回车执行主操作（与抽屉首动作一致：可复习 → 难度弹窗；否则打开原文）。
   */
  private onEntriesKeydown(e: KeyboardEvent): void {
    const container = this.entriesContainer;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.review-card'));
    if (!cards.length) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active && cards.includes(active) ? cards.indexOf(active) : -1;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next =
        idx === -1 ? (dir === 1 ? 0 : cards.length - 1) : Math.min(cards.length - 1, Math.max(0, idx + dir));
      cards[next].focus();
      return;
    }
    if (e.key === 'Enter' && idx !== -1) {
      e.preventDefault();
      this.keyboardExecute(cards[idx]);
    }
  }

  /** 回车执行主操作（与抽屉「开始复习/打开原文」语义一致） */
  private keyboardExecute(card: HTMLElement): void {
    const item = (card as any).__reviewItem as ReviewItem | undefined;
    if (!item) return;
    if (!item.isCompleted && !item.completed && !item.isMissing) {
      this.showDifficultyDialog(item, async (diff) => {
        const { reviewApp } = await import('./app');
        await reviewApp.markReview(item.filePath, diff as Rating);
        await this.refreshPanel();
        await reviewApp.applyReviewStyles(this.app);
      });
      // 难度弹窗作为附属浮层（内部点击不误关任何已开浮层；生命周期由弹窗自身注销）
      const dlg = document.querySelector('.difficulty-dialog');
      if (dlg) registerSheetCompanion(dlg as HTMLElement);
    } else {
      void this.openItemFile(item);
    }
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

    // ADR-0077：查看历史（单条复习时间线，reviewHistory 回放）
    actions.push({
      icon: 'history',
      label: '查看历史',
      onClick: () => {
        void (async () => {
          const { showTimeline } = await import('./stats-ui');
          showTimeline(this.app, this.dataManager, item);
        })();
      },
    });

    // 移出复习计划（danger：确认走 core openFlowDialog；ticket 141 通病 1 落地后 toast 挂撤销）
    actions.push({
      icon: 'trash-2',
      label: '移出复习计划',
      kind: 'danger',
      onClick: () => {
        void openFlowDialog({
          title: '移出复习计划',
          message: `确定移出“${item.name}”？`,
          actions: [
            { label: '取消', value: 'cancel' },
            { label: '确定', value: 'ok', cta: true },
          ],
        }).then(async (v) => {
          if (v !== 'ok') return;
          try {
            await this.dataManager.removeItem(item.filePath);
            await this.refreshPanel();
            const { reviewApp } = await import('./app');
            await reviewApp.applyReviewStyles(this.app);
            // ticket 141 通病 1：原条目（含阶段/排期/历史）重新插回，进度不丢
            notifyUndo(`已移出「${item.name}」`, () => {
              void (async () => {
                try {
                  await this.dataManager.restoreItem(item);
                  await this.refreshPanel();
                  const { reviewApp: ra } = await import('./app');
                  await ra.applyReviewStyles(this.app);
                } catch (e) {
                  notifySaveError(e, '恢复复习条目');
                }
              })();
            });
          } catch (e) {
            notifySaveError(e, '移出复习条目');
          }
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
    body.className = 'bz-review-sheet-body';

    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔁';
    body.appendChild(emoji);

    const info = document.createElement('div');
    info.className = 'bz-review-sheet-info';
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
    if (this.searchTimer !== null) {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    // ticket 141：注销 escManager 层（原 document keydown 处理器清理迁移）
    if (this.escHandle) {
      this.escHandle.unregister();
      this.escHandle = null;
    }
    if (this.mask) this.mask.remove();
    if (this.popup) this.popup.remove();
    this.mask = null;
    this.popup = null;
    this.entriesContainer = null;
  }
}


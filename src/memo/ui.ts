/**
 * 备忘录 UI（备忘录.js UIManager + Renderer 移植）
 * DOM id/类名与原脚本一致：todo-mask / todo-popup / todo-entries-container /
 * add-todo-mask / add-todo-popup / add-todo-* / scene-btn / priority-btn / todo-card。
 * 视觉样式已收敛至 styles.css（ticket 57），此处仅保留功能性内联样式（显隐/高度计算）。
 */
import moment from 'moment';
import { Setting } from 'obsidian';
import { notice, notify } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { confirm } from '../core/confirm';
import { createSiteIcon } from '../core/dom';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal, createSettingsGroup } from '../core/settings-modal';
import {
  formatRelativeTime,
  extractUrlAndDisplay,
  escapeHtml,
  generateId,
  getCurrentNoteInfo,
  getCurrentCursorPosition,
  fetchPageTitle,
  getPlatformName,
} from '../core/utils';
import { DataManager } from './data';
import { getDueStatus, formatDueText } from './due';
import type { MemoItem } from './types';
import { App } from './app';
// ticket 075（方法监听）：memo 动作观察（smartcat；未初始化/关闭时静默）
import { emitDomainEvent } from '../core/domain-bus';

/** 内容输入框一行高（14px × 1.5 行高 + 上下 padding 16px） */
const CONTENT_LINE_HEIGHT = 37;
/** 内容输入框最高 8 行（8 × 21 + 16 = 184px），超出内部滚动 */
const CONTENT_MAX_HEIGHT = 184;

/** 内容输入框 auto-grow：高度 = clamp(scrollHeight, 一行, 8 行)；空时一行高 */
function autoGrowContent(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  const h = Math.max(el.scrollHeight, CONTENT_LINE_HEIGHT);
  el.style.height = `${Math.min(h, CONTENT_MAX_HEIGHT)}px`;
  el.style.overflowY = el.scrollHeight > CONTENT_MAX_HEIGHT ? 'auto' : 'hidden';
}

// ---------- 共享小工具 ----------

/** 选中态 / 未选中态（场景、优先级按钮共用，视觉见 .active 类） */
function setActive(btn: HTMLElement, active: boolean) {
  btn.classList.toggle('active', active);
}
/** 取消容器内全部按钮选中 */
function clearActive(container: HTMLElement, cls: string) {
  container.querySelectorAll(`.${cls}`).forEach((b) => setActive(b as HTMLElement, false));
}

/** 胶囊选择按钮（scene-btn / priority-btn 共用选中逻辑） */
function makeChoiceBtn(container: HTMLElement, cls: string, value: string, label: string, onClick?: (btn: HTMLButtonElement) => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = cls;
  btn.dataset[cls === 'scene-btn' ? 'scene' : 'priority'] = value;
  btn.textContent = label;
  btn.onclick = () => {
    clearActive(container, cls);
    setActive(btn, true);
    onClick?.(btn);
  };
  container.appendChild(btn);
  return btn;
}

/** 输入建议列表（脚本/课程共用：过滤 → 渲染 → 点击回填 → 失焦关闭） */
function attachSuggestion<T>(
  input: HTMLInputElement,
  sugg: HTMLElement,
  container: HTMLElement,
  getList: () => T[],
  match: (val: string, item: T) => boolean,
  render: (item: T) => string,
  onPick: (item: T) => void
) {
  const refresh = () => {
    const val = input.value.trim().toLowerCase();
    const matched = getList().filter((item) => match(val, item));
    if (matched.length) {
      sugg.innerHTML = matched
        .map((item) => `<div class="bz-suggest-item">${render(item)}</div>`)
        .join('');
      sugg.className = 'bz-suggest-box';
      sugg.querySelectorAll('div').forEach((el, i) => {
        (el as HTMLElement).onclick = () => {
          onPick(matched[i]);
          sugg.style.display = 'none';
        };
      });
    } else {
      sugg.style.display = 'none';
    }
  };
  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  // P2 监听泄漏修复：引用化——容器脱离文档（弹窗销毁/重建）后首次点击自注销
  const onDocClick = (e: MouseEvent): void => {
    if (!container.isConnected) {
      document.removeEventListener('click', onDocClick);
      return;
    }
    if (!container.contains(e.target as Node)) sugg.style.display = 'none';
  };
  document.addEventListener('click', onDocClick);
}

// ---------- 设置弹窗（ADR-0009 域设置弹窗，分组卡片，10 项 5 组） ----------

/** 设置项辅助：toggle / textArea / dropdown 三类，写回设置并保存，支持副作用 */
function settingToggle(el: HTMLElement, name: string, desc: string, get: boolean, key: keyof any, after?: () => void) {
  new Setting(el).setName(name).setDesc(desc).addToggle((toggle) =>
    toggle.setValue(get).onChange(async (v) => {
      (getSettings() as any)[key] = v;
      await saveSettings();
      after?.();
    })
  );
}
function settingTextArea(el: HTMLElement, name: string, desc: string, placeholder: string, get: string, key: keyof any, after?: () => void) {
  new Setting(el).setName(name).setDesc(desc).addTextArea((text) =>
    text.setPlaceholder(placeholder).setValue(get).onChange(async (v) => {
      (getSettings() as any)[key] = v;
      await saveSettings();
      after?.();
    })
  );
}
function settingDropdown(el: HTMLElement, name: string, desc: string, options: [string, string][], get: string, key: keyof any) {
  new Setting(el).setName(name).setDesc(desc).addDropdown((dd) => {
    for (const [v, label] of options) dd.addOption(v, label);
    dd.setValue(get).onChange(async (v) => {
      (getSettings() as any)[key] = v;
      await saveSettings();
    });
  });
}

/** 添加弹窗共享元素上下文（createAddDialog 拆分传递） */
interface AddDialogCtx {
  contentInput: HTMLTextAreaElement;
  titleInput: HTMLInputElement;
  scriptInput: HTMLInputElement;
  scriptSuggest: HTMLElement;
  scriptContainer: HTMLElement;
  courseInput: HTMLInputElement;
  courseSuggest: HTMLElement;
  courseContainer: HTMLElement;
  sceneContainer: HTMLElement;
  priorityContainer: HTMLElement;
  dueInput: HTMLInputElement;
  posBtn: HTMLButtonElement;
}

export const UIManager = {
  mask: null as HTMLDivElement | null,
  popup: null as HTMLDivElement | null,
  entriesContainer: null as HTMLElement | null,
  addMask: null as HTMLDivElement | null,
  addPopup: null as HTMLDivElement | null,
  addEditingId: null as string | null,
  // 私有建议数据（避免全局污染）
  scriptSuggestions: [] as string[],
  courseSuggestions: [] as { name: string; path: string }[],

  // ---------- 主面板 ----------
  createMainUI() {
    if (this.mask && document.body.contains(this.mask)) return;

    this.mask = document.createElement('div');
    this.mask.id = 'todo-mask';
    this.mask.onclick = () => this.hideMain();

    this.popup = document.createElement('div');
    this.popup.id = 'todo-popup';
    this.popup.innerHTML = `
            <div class="bz-todo-head">
                <h3>备忘录</h3>
                <div class="bz-todo-head-btns">
                    <button class="todo-btn-add">✏️</button>
                    <button class="todo-btn-archive">📁</button>
                    <button class="todo-btn-settings">⚙️</button>
                    <button class="todo-btn-close">❌</button>
                </div>
            </div>
            <div id="todo-entries-container"></div>
        `;
    this.entriesContainer = this.popup.querySelector('#todo-entries-container');
    const settingsBtn = this.popup.querySelector('.todo-btn-settings');
    settingsBtn!.onclick = () => {
      const s = getSettings();
      // 场景/平台映射变更后即时生效：重建 DataManager 与添加弹窗场景按钮
      const reloadScenes = () => {
        DataManager.init(s);
        if (UIManager.addMask && document.body.contains(UIManager.addMask)) {
          UIManager.addMask.remove();
          if (UIManager.addPopup) UIManager.addPopup.remove();
          UIManager.addMask = null;
          UIManager.addPopup = null;
          UIManager.createAddDialog();
        }
      };

      openSettingsModal({
        title: '备忘录设置',
        maxWidth: 560,
        build: (el) => {
          // ===== 提醒组 =====
          const remindGroup = createSettingsGroup(el, { icon: 'bell', name: '提醒' });
          settingToggle(remindGroup, '启动时自动弹出', '启动时若有重要或到期未完成的备忘录，自动打开面板提醒', s.autoPopupOnStart, 'autoPopupOnStart');
          settingToggle(remindGroup, '打开笔记自动提醒', '打开笔记时若笔记有重要或到期的未完成备忘录，自动弹出面板', s.openNoteReminder !== false, 'openNoteReminder');

          // ===== 显示组 =====
          const viewGroup = createSettingsGroup(el, { icon: 'eye', name: '显示' });
          settingDropdown(viewGroup, '默认排序方式', '面板条目按所选规则排序', [['priority', '紧急优先'], ['due', '仅按到期时间'], ['created', '按创建时间']], s.memoSortMode || 'priority', 'memoSortMode');
          settingToggle(viewGroup, '默认显示归档', '打开面板时同时显示已归档条目', !!s.memoShowArchivedByDefault, 'memoShowArchivedByDefault');
          settingDropdown(viewGroup, '到期时间格式', '到期时间按相对或绝对格式显示', [['relative', '相对'], ['absolute', '绝对']], s.memoDueFormat || 'relative', 'memoDueFormat');

          // ===== 新建组 =====
          const createGroup = createSettingsGroup(el, { icon: 'pencil-line', name: '新建' });
          settingDropdown(createGroup, '新条目默认优先级', '新建备忘录时默认选中的优先级', [['minor', '次要'], ['important', '重要']], s.memoDefaultPriority || 'minor', 'memoDefaultPriority');
          settingDropdown(createGroup, '新条目默认场景', '新建备忘录时默认选用的场景', [['', '第一个场景'], ...DataManager.getScenarios().map((sc) => [sc, sc] as [string, string])], s.memoDefaultScene || '', 'memoDefaultScene');
          settingToggle(createGroup, '完成后自动归档', '勾选完成后条目移入归档，关闭则留在主列表并划线显示', s.memoAutoArchive !== false, 'memoAutoArchive');

          // ===== 场景列表组 =====
          const sceneGroup = createSettingsGroup(el, { icon: 'tags', name: '场景列表' });
          settingTextArea(sceneGroup, '自定义场景列表', '场景名用逗号分隔，留空使用默认场景', '剪藏,工作,学习,生活,代码,公开课', s.memoScenarios || '', 'memoScenarios', reloadScenes);

          // ===== 移动端组（仅移动端显示） =====
          if (isMobileEnv()) {
            const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
            new Setting(mobileGroup)
              .setName('移动端默认全屏')
              .setDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')
              .addToggle((toggle) =>
                toggle.setValue(!!s.memoMobileDefaultFullscreen).onChange(async (v) => { s.memoMobileDefaultFullscreen = v; await saveSettings(); })
              );
          }
        },
      });
    };
    const addBtn = this.popup.querySelector('.todo-btn-add');
    addBtn!.onclick = () => this.showAddDialog(null);
    const archiveBtn = this.popup.querySelector('.todo-btn-archive');
    archiveBtn!.onclick = () => {
      App.state.showArchived = !App.state.showArchived;
      archiveBtn!.textContent = App.state.showArchived ? '📂' : '📁';
      App.refresh();
    };
    const closeBtn = this.popup.querySelector('.todo-btn-close');
    closeBtn!.onclick = () => this.hideMain();

    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);
  },

  showMain(filter: ((item: MemoItem) => boolean) | null, sortByPriority: boolean) {
    this.createMainUI();
    App.state.filter = filter || null;
    App.state.sortByPriority = sortByPriority || false;
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
    applyMobileWindowFullscreen(this.popup, tryGetSettings().memoMobileDefaultFullscreen === true);
    App.refresh();
  },
  hideMain() {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  },
  getEntriesContainer() {
    return this.entriesContainer;
  },

  // ---------- 创建/编辑对话框 ----------
  createAddDialog() {
    if (this.addMask && document.body.contains(this.addMask)) return;

    this.addMask = document.createElement('div');
    this.addMask.id = 'add-todo-mask';
    this.addMask.onclick = (e) => {
      if (e.target === this.addMask) this.hideAddDialog();
    };

    this.addPopup = document.createElement('div');
    this.addPopup.id = 'add-todo-popup';
    // 构造内部HTML
    this.addPopup.innerHTML = `
            <h4>创建备忘录</h4>
            <textarea id="add-todo-content" rows="1" placeholder="输入备忘录内容..."></textarea>
            <input id="add-todo-title" type="text" placeholder="标题（可选）">
            <div id="add-todo-script-container">
                <input id="add-todo-script" type="text" placeholder="脚本名">
                <div id="add-todo-script-suggestions"></div>
            </div>
            <div id="add-todo-course-container">
                <input id="add-todo-course" type="text" placeholder="课程名">
                <div id="add-todo-course-suggestions"></div>
            </div>
            <div id="add-todo-scenes"></div>
            <div id="add-todo-priority"></div>
            <div id="add-todo-due">
                <input id="add-todo-due-input" type="datetime-local" step="60">
                <button id="add-todo-due-clear" type="button">✕</button>
                <span>截止日期（可选）</span>
            </div>
            <div class="bz-todo-pos-row">
                <button id="add-todo-pos-btn" type="button">📌</button>
            </div>
            <div class="bz-todo-btn-row">
                <button id="add-todo-cancel">取消</button>
                <button id="add-todo-save">保存</button>
            </div>
        `;

    document.body.appendChild(this.addMask);
    document.body.appendChild(this.addPopup);

    // 绑定事件
    const q = (sel: string) => this.addPopup!.querySelector(sel) as HTMLElement;
    const contentInput = q('#add-todo-content') as HTMLTextAreaElement;
    const titleInput = q('#add-todo-title') as HTMLInputElement;
    const sceneContainer = q('#add-todo-scenes');
    const priorityContainer = q('#add-todo-priority');
    const posBtn = q('#add-todo-pos-btn') as HTMLButtonElement;
    const cancelBtn = q('#add-todo-cancel') as HTMLButtonElement;
    const saveBtn = q('#add-todo-save') as HTMLButtonElement;
    const scriptInput = q('#add-todo-script') as HTMLInputElement;
    const scriptSuggest = q('#add-todo-script-suggestions');
    const scriptContainer = q('#add-todo-script-container');
    const courseInput = q('#add-todo-course') as HTMLInputElement;
    const courseSuggest = q('#add-todo-course-suggestions');
    const courseContainer = q('#add-todo-course-container');

    // 内容输入框 auto-grow（Enter 换行 = textarea 默认行为，不做任何拦截）
    contentInput.addEventListener('input', () => autoGrowContent(contentInput));

    // ---------- 优先级按钮 ----------
    makeChoiceBtn(priorityContainer, 'priority-btn', 'minor', '次要');
    makeChoiceBtn(priorityContainer, 'priority-btn', 'important', '重要');
    setActive(priorityContainer.querySelector('.priority-btn') as HTMLElement, true); // 默认次要

    // ---------- 截止日期 ----------
    const dueInput = q('#add-todo-due-input') as HTMLInputElement;
    const dueClear = q('#add-todo-due-clear') as HTMLButtonElement;
    dueInput.addEventListener('change', () => {
      dueClear.style.display = dueInput.value ? 'inline-block' : 'none';
    });
    dueClear.onclick = () => {
      dueInput.value = '';
      dueClear.style.display = 'none';
    };

    // ---------- 位置按钮 ----------
    (posBtn as any).positionData = { notePath: null, notePosition: null };
    posBtn.onclick = () => {
      const data = (posBtn as any).positionData || {};
      if (data.notePath && data.notePosition) {
        (posBtn as any).positionData = { notePath: null, notePosition: null };
        posBtn.textContent = '📌';
        posBtn.classList.remove('active');
      } else {
        const info = getCurrentNoteInfo();
        const pos = getCurrentCursorPosition();
        if (info && pos) {
          (posBtn as any).positionData = { notePath: info.path, notePosition: { line: pos.line, ch: pos.ch } };
          posBtn.textContent = `📌 ${info.name}`;
          posBtn.classList.add('active');
        } else {
          notice('无法获取当前位置');
        }
      }
    };

    // ---------- 场景按钮构建（拆分：_buildSceneButtons） ----------
    const ctx: AddDialogCtx = {
      contentInput, titleInput, scriptInput, scriptSuggest, scriptContainer,
      courseInput, courseSuggest, courseContainer, sceneContainer, priorityContainer, dueInput, posBtn,
    };
    this._buildSceneButtons(ctx);

    // ---------- 脚本输入建议（P2：render 输出过 escapeHtml，scriptName 含 HTML 时按文本渲染） ----------
    attachSuggestion<string>(
      scriptInput, scriptSuggest, scriptContainer,
      () => this.scriptSuggestions,
      (val, s) => !val || s.toLowerCase().includes(val),
      (s) => escapeHtml(s),
      (s) => { scriptInput.value = s; }
    );

    // ---------- 课程输入建议（渲染带 data-path，保存时回填 coursePath；P2：name/path 过 escapeHtml——属性值转义引号） ----------
    attachSuggestion<{ name: string; path: string }>(
      courseInput, courseSuggest, courseContainer,
      () => this.courseSuggestions,
      (val, c) => !val || c.name.toLowerCase().includes(val),
      (c) => `<span data-path="${escapeHtml(c.path)}">${escapeHtml(c.name)}</span>`,
      (c) => {
        courseInput.value = c.name;
        courseInput.dataset.coursePath = c.path;
      }
    );

    // ---------- 取消 / 保存 ----------
    cancelBtn.onclick = () => this.hideAddDialog();

    saveBtn.onclick = () => this._handleAddSave(ctx);

    // 键盘事件（ESC 关闭；e1-memo：stopImmediatePropagation 阻停冒泡 —— 否则事件会继续
    // 冒泡到 document 上的 escManager，把主面板一并关掉（一次 ESC 关两层、丢未保存草稿））
    this.addPopup.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        this.hideAddDialog();
      }
    });
  },

  // ---------- 添加弹窗拆分（ticket 61 重构） ----------

  /** 场景按钮构建 + 切换处理（剪藏剪贴板预填/代码/公开课显隐） */
  _buildSceneButtons(ctx: AddDialogCtx): void {
    const { sceneContainer, contentInput, titleInput, scriptInput, scriptSuggest, scriptContainer, courseInput, courseSuggest, courseContainer } = ctx;
    sceneContainer.innerHTML = '';
    for (const scene of DataManager.getScenarios()) {
      makeChoiceBtn(sceneContainer, 'scene-btn', scene, scene, (btn) => {
        // 拍板 10：切换场景默认保留已输入内容（不再清空 content/title、不弹窗询问）；
        // 离开剪藏仅还原剪藏预填态（占位符/剪贴板草稿）与标题框显隐
        const isClip = btn.dataset.scene === '剪藏';
        if (!isClip) {
          contentInput.placeholder = '输入备忘录内容...';
          contentInput.dataset.rawClipboard = '';
          titleInput.placeholder = '标题（可选）';
          titleInput.style.display = 'none';
        } else {
          // 剪藏场景：显示标题输入框，并尝试填充剪贴板
          titleInput.style.display = 'block';
          navigator.clipboard
            .readText()
            .then(async (text) => {
              if (text) {
                const trimmed = text.trim();
                contentInput.dataset.rawClipboard = trimmed;
                // 拍板 11：剪贴板预填成功给轻提示（正文不带 emoji；同键去重防连续切换刷屏）。
                // 建议 B：编辑模式（addEditingId 非空）不弹——编辑入口自动点击剪藏按钮会触发
                // 此读取，且异步回调晚于编辑回填，提示会误导
                if (!this.addEditingId) {
                  notify('已从剪贴板预填链接', { type: 'info', dedupeKey: 'memo-clip-prefill' });
                }
                const { url, display } = extractUrlAndDisplay(trimmed);
                if (url) {
                  contentInput.placeholder = url;
                  if (display && display !== url) titleInput.placeholder = display;
                  else if (display === url) {
                    const pageTitle = await fetchPageTitle(url);
                    if (pageTitle) titleInput.placeholder = pageTitle;
                  }
                } else {
                  contentInput.placeholder = '输入备忘录内容...';
                }
              }
            })
            .catch(() => {});
        }

        // 代码/公开课场景控制
        const isCode = btn.dataset.scene === '代码';
        scriptContainer.style.display = isCode ? 'block' : 'none';
        if (!isCode) {
          scriptInput.value = '';
          scriptSuggest.style.display = 'none';
        }
        const isCourse = btn.dataset.scene === '公开课';
        courseContainer.style.display = isCourse ? 'block' : 'none';
        if (!isCourse) {
          courseInput.value = '';
          courseSuggest.style.display = 'none';
        } else {
          courseInput.dispatchEvent(new Event('input'));
        }
      });
    }
  },

  /** 保存逻辑（新建/编辑共用）：收集字段 → 写库 → 刷新 */
  async _handleAddSave(ctx: AddDialogCtx): Promise<void> {
    const { contentInput, titleInput, scriptInput, courseInput, dueInput, posBtn, sceneContainer, priorityContainer } = ctx;
    let content = contentInput.value.trim();
    if (!content) {
      const placeholder = contentInput.placeholder;
      if (placeholder && placeholder !== '输入备忘录内容...') {
        contentInput.value = placeholder;
      } else {
        const raw = contentInput.dataset.rawClipboard || '';
        if (raw) {
          const { url } = extractUrlAndDisplay(raw);
          if (url) contentInput.value = url;
        }
      }
    }
    const finalContent = contentInput.value.trim();
    if (!finalContent) {
      notice('请输入内容');
      return;
    }

    const selectedScene = sceneContainer.querySelector('.scene-btn.active');
    if (!selectedScene) {
      notice('请选择场景');
      return;
    }
    const scene = (selectedScene as HTMLElement).dataset.scene!;

    const selectedPriority = priorityContainer.querySelector('.priority-btn.active');
    const priority = selectedPriority ? (selectedPriority as HTMLElement).dataset.priority : 'minor';

    let title = titleInput.value.trim();
    if (!title) {
      const ph = titleInput.placeholder;
      if (ph && ph !== '标题（可选）') title = ph;
    }

    // 分离 title 和 url
    const { url: extractedUrl, display } = extractUrlAndDisplay(finalContent);
    let finalTitle = display;
    if (title && extractedUrl) {
      finalTitle = title;
    } else if (!finalTitle) {
      finalTitle = finalContent;
    }
    const finalUrl = extractedUrl || null;

    const positionData = (posBtn as any).positionData || {};
    const notePath = positionData.notePath || null;
    const notePosition = positionData.notePosition || null;

    let scriptName: string | null = null;
    if (scene === '代码') {
      const sv = scriptInput.value.trim();
      if (sv) scriptName = sv;
    }
    let courseName: string | null = null,
      coursePath: string | null = null;
    if (scene === '公开课') {
      const cv = courseInput.value.trim();
      if (cv) {
        courseName = cv;
        if (courseInput.dataset.coursePath) coursePath = courseInput.dataset.coursePath;
        else {
          const matched = this.courseSuggestions.find((s) => s.name.toLowerCase() === cv.toLowerCase());
          if (matched) coursePath = matched.path;
        }
      }
    }

    const editingId = this.addEditingId;
    const dueValue = dueInput.value || null;
    // ticket 075（方法监听）：编辑 α 合并需旧值——保存前从已加载列表取（或 showAddDialog 的 editItem）
    let oldItem = editingId ? App.state.todoItems.find((i) => i.id === editingId) : undefined;
    try {
      if (editingId) {
        // ticket 084a B7：状态列表旧值缺失（并发刷新/其他入口改动）→ 落盘读一次兜底，
        // 保证编辑观察不静默丢失；落盘也没有 → 见下方「明确跳过」注释
        if (!oldItem) {
          const disk = (await DataManager.read()) as any[];
          oldItem = disk.find((d: any) => d.id === editingId);
        }
        await DataManager.updateItem(editingId, {
          title: finalTitle,
          scene,
          priority,
          due: dueValue,
          notePath,
          notePosition,
          scriptName,
          courseName,
          coursePath,
          url: finalUrl,
        } as any);
        // ticket 075（域事件派发）：编辑动作观察（α 合并一条；无变化 memo-source 返回 null 不产出）
        // ticket 084a B7：兜底后仍无旧值（极窄竞态，此时 updateItem 应已抛错）→ 明确跳过编辑观察
        if (oldItem) {
          emitDomainEvent('memo', {
            kind: 'edited',
            old: {
              title: oldItem.title,
              scene: oldItem.scene,
              priority: oldItem.priority === 'important' ? 'important' : 'minor',
              due: oldItem.due,
              notePath: oldItem.notePath,
              scriptName: oldItem.scriptName,
              courseName: oldItem.courseName,
            },
            next: {
              title: finalTitle,
              scene,
              priority: priority === 'important' ? 'important' : 'minor',
              due: dueValue,
              notePath,
              scriptName,
              courseName,
            },
          });
        }
      } else {
        const newItem = {
          id: generateId('todo'),
          title: finalTitle,
          scene,
          priority,
          created: moment().format('YYYY-MM-DD HH:mm:ss'),
          completed: null,
          due: dueValue,
          notePath,
          notePosition,
          scriptName,
          courseName,
          coursePath,
          url: finalUrl,
        };
        await DataManager.addItem(newItem as any);
        // ticket 075（域事件派发）：添加动作观察（键值式，有才加）
        emitDomainEvent('memo', {
          kind: 'added',
          title: finalTitle,
          scene,
          priority: priority === 'important' ? 'important' : 'minor',
          due: dueValue,
          notePath,
          scriptName,
          courseName,
        });
      }
      await App.loadData();
      App.refresh();
      this.hideAddDialog();
    } catch (e: any) {
      notice('保存失败：' + e.message, 'error');
      console.error(e);
    }
  },

  showAddDialog(editItem: MemoItem | null) {
    this.createAddDialog();
    if (!this.addMask || !this.addPopup) return;
    this.addEditingId = editItem ? editItem.id : null;

    const q = (sel: string) => this.addPopup!.querySelector(sel) as HTMLElement;
    const contentInput = q('#add-todo-content') as HTMLTextAreaElement;
    const titleInput = q('#add-todo-title') as HTMLInputElement;
    const sceneContainer = q('#add-todo-scenes');
    const priorityContainer = q('#add-todo-priority');
    const posBtn = q('#add-todo-pos-btn') as HTMLButtonElement;
    const scriptInput = q('#add-todo-script') as HTMLInputElement;
    const scriptContainer = q('#add-todo-script-container');
    const courseInput = q('#add-todo-course') as HTMLInputElement;
    const courseContainer = q('#add-todo-course-container');
    const scriptSuggest = q('#add-todo-script-suggestions');
    const courseSuggest = q('#add-todo-course-suggestions');
    const dueInput = q('#add-todo-due-input') as HTMLInputElement;
    const dueClear = q('#add-todo-due-clear') as HTMLButtonElement;

    // 重置
    contentInput.value = '';
    contentInput.dataset.rawClipboard = '';
    contentInput.placeholder = '输入备忘录内容...';
    titleInput.value = '';
    titleInput.placeholder = '标题（可选）';
    titleInput.style.display = 'none';
    dueInput.value = '';
    dueClear.style.display = 'none';
    scriptInput.value = '';
    scriptContainer.style.display = 'none';
    scriptSuggest.style.display = 'none';
    courseInput.value = '';
    courseInput.dataset.coursePath = '';
    courseContainer.style.display = 'none';
    courseSuggest.style.display = 'none';
    (posBtn as any).positionData = { notePath: null, notePosition: null };
    posBtn.textContent = '📌';
    posBtn.classList.remove('active');

    // 收集脚本建议（来自已有备忘录）
    const allScriptNames = App.state.todoItems
      .map((item) => item.scriptName)
      .filter((name) => name && name.trim().length > 0)
      .map((name) => name!.trim());
    this.scriptSuggestions = [...new Set(allScriptNames)].sort();
    // 异步加载课程建议
    DataManager.getCourseNotes().then((notes) => {
      this.courseSuggestions = notes;
      if (courseContainer.style.display !== 'none') {
        courseInput.dispatchEvent(new Event('input'));
      }
    });

    // 场景按钮激活（新建时按设置默认场景，空则第一个）
    const sceneBtns = sceneContainer.querySelectorAll('.scene-btn');
    if (sceneBtns.length) {
      if (editItem) {
        let found = false;
        sceneBtns.forEach((btn) => {
          if ((btn as HTMLElement).dataset.scene === editItem.scene) {
            (btn as HTMLElement).click();
            found = true;
          }
        });
        if (!found) (sceneBtns[0] as HTMLElement).click();
        // 编辑时回填内容到输入框（拍板 10 起场景按钮不再清空，回填仍放最后保证点击先就位）
        contentInput.value = editItem.title || '';
      } else {
        const defaultScene = App.settings.memoDefaultScene;
        let activated = false;
        if (defaultScene) {
          sceneBtns.forEach((btn) => {
            if ((btn as HTMLElement).dataset.scene === defaultScene) {
              (btn as HTMLElement).click();
              activated = true;
            }
          });
        }
        if (!activated) (sceneBtns[0] as HTMLElement).click();
      }
    }

    // 优先级
    const priorityBtns = priorityContainer.querySelectorAll('.priority-btn');
    priorityBtns.forEach((b) => {
      const btn = b as HTMLElement;
      const active =
        (editItem && btn.dataset.priority === editItem.priority) ||
        (!editItem && btn.dataset.priority === (App.settings.memoDefaultPriority || 'minor'));
      setActive(btn, active);
    });

    // 填充编辑数据
    if (editItem) {
      this.addPopup.querySelector('h4')!.textContent = '编辑备忘录';
      contentInput.value = editItem.title || '';
      contentInput.placeholder = editItem.url || '输入备忘录内容...';
      // 如果是剪藏场景且存在 url，显示标题输入框
      if (editItem.scene === '剪藏' && editItem.url) {
        titleInput.style.display = 'block';
        titleInput.value = editItem.title || '';
        titleInput.placeholder = '标题（可选）';
      } else {
        titleInput.style.display = 'none';
      }
      if (editItem.scene === '代码' && editItem.scriptName) {
        scriptInput.value = editItem.scriptName;
        scriptContainer.style.display = 'block';
        setTimeout(() => scriptInput.dispatchEvent(new Event('input')), 100);
      }
      if (editItem.scene === '公开课' && editItem.courseName) {
        courseInput.value = editItem.courseName;
        if (editItem.coursePath) courseInput.dataset.coursePath = editItem.coursePath;
        courseContainer.style.display = 'block';
        courseInput.dispatchEvent(new Event('input'));
      }
      if (editItem.notePath && editItem.notePosition) {
        (posBtn as any).positionData = {
          notePath: editItem.notePath,
          notePosition: editItem.notePosition,
        };
        const file = getApp().vault.getAbstractFileByPath(editItem.notePath);
        if (file) {
          posBtn.textContent = `📌 ${(file as any).basename}`;
          posBtn.classList.add('active');
        }
      }
      if (editItem.due) {
        // datetime-local 要求 YYYY-MM-DDTHH:mm 格式
        dueInput.value = editItem.due.replace(' ', 'T');
        dueClear.style.display = dueInput.value ? 'inline-block' : 'none';
      }
    } else {
      this.addPopup.querySelector('h4')!.textContent = '创建备忘录';
    }

    this.addMask.style.display = 'block';
    this.addPopup.style.display = 'block';
    autoGrowContent(contentInput); // 打开/编辑回填后按内容调整高度
    contentInput.focus();
  },

  hideAddDialog() {
    if (this.addMask) this.addMask.style.display = 'none';
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.addEditingId = null;
  },

  // ---------- 确认对话框（代理到 core confirm） ----------
  showConfirm(title: string, msg: string, onConfirm: () => void) {
    confirm({ title: title || '确认删除', message: msg || '', onConfirm });
  },

  // ---------- ESC ----------
  registerEscape() {
    escManager.register('bz', {
      // P2：双窗口径（对照 favorites/ui.ts）——主面板可见 || 添加弹窗可见，否则仅开添加弹窗时 ESC 失灵
      isVisible: () =>
        !!(this.mask && this.mask.style.display === 'block') ||
        !!(this.addMask && this.addMask.style.display === 'block'),
      close: () => {
        // 共享 confirm mask（重构后由 confirm 创建，不在 UIManager 里）
        const sharedMask = document.getElementById('__shared_confirm_mask__');
        if (sharedMask) { sharedMask.remove(); return; }
        if (this.addMask && this.addMask.style.display === 'block') this.hideAddDialog();
        else if (this.mask && this.mask.style.display === 'block') this.hideMain();
      },
    });
  },
};

// ---------- 渲染器 ----------

export const Renderer = {
  render(container: HTMLElement | null, items: MemoItem[], showArchived: boolean) {
    if (!container) return;
    container.innerHTML = '';
    // 完成后自动归档：关=完成条目保留主列表（显示完成态）
    const autoArchive = App.settings.memoAutoArchive !== false;
    const active = items.filter((i) => (autoArchive ? i.completed === null : true));
    const archived = items.filter((i) => i.completed !== null && autoArchive);
    const filter = App.state.filter;
    const filteredActive = filter ? active.filter(filter) : active;
    const filteredArchived = filter ? archived.filter(filter) : archived;

    if (filteredActive.length === 0 && filteredArchived.length === 0) {
      container.innerHTML = `<div class="bz-todo-empty">${filter ? '没有匹配的备忘录' : '没有备忘录 🎉'}</div>`;
      return;
    }

    // 排序模式：priority（紧急优先，默认）/ due（仅按到期时间）/ created（按创建时间）
    const sortMode = App.state.sortByPriority ? 'priority' : App.settings.memoSortMode || 'priority';

    const sortFn = (a: MemoItem, b: MemoItem) => {
      // 非归档模式下已完成条目排最后
      if (!autoArchive) {
        if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;
      }
      if (sortMode === 'created') {
        return b.created.localeCompare(a.created);
      }
      // 1. 截止日期紧急度：overdue > today > future > none
      const dueOrder: Record<string, number> = { overdue: 0, today: 1, future: 2 };
      const da = a.due && !a.completed ? (dueOrder[getDueStatus(a.due)!] ?? 3) : 3;
      const db = b.due && !b.completed ? (dueOrder[getDueStatus(b.due)!] ?? 3) : 3;
      if (da !== db) return da - db;

      // 2. 优先级（priority 模式）
      if (sortMode === 'priority') {
        const order: Record<string, number> = { important: 1, minor: 2 };
        const oa = order[a.priority] || 2;
        const ob = order[b.priority] || 2;
        if (oa !== ob) return oa - ob;
      }

      // 3. 截止日期近的优先
      if (a.due && b.due && !a.completed && !b.completed) {
        return a.due.localeCompare(b.due);
      }

      // 4. 创建时间降序
      return b.created.localeCompare(a.created);
    };

    filteredActive.sort(sortFn);
    filteredArchived.sort((a, b) => b.completed!.localeCompare(a.completed!));

    for (const item of filteredActive) {
      container.appendChild(this.createCard(item, false));
    }
    if (showArchived && filteredArchived.length) {
      const sep = document.createElement('div');
      sep.className = 'bz-todo-sep';
      sep.innerHTML = `<span>已归档</span>`;
      container.appendChild(sep);
      for (const item of filteredArchived) {
        container.appendChild(this.createCard(item, true));
      }
    }
  },

  /** 打开条目（操作条「打开」与内容链接共用）：内部笔记 > 外部 URL */
  openItem(item: MemoItem): void {
    const app = getApp();
    UIManager.hideMain(); // 关闭备忘录面板
    if (item.linkedNote) {
      const file = app.vault.getAbstractFileByPath(item.linkedNote);
      if (file) {
        void app.workspace.getLeaf().openFile(file as any);
      } else {
        notice('关联笔记不存在');
      }
    } else if (item.url) {
      try {
        (app as any).openUrl(item.url);
      } catch {
        // 桌面端 Electron 兜底
        const electron = (window as any).require && (window as any).require('electron');
        if (electron && electron.shell) electron.shell.openExternal(item.url);
      }
    }
  },

  /** 跳转关联笔记（📌 位置标签与抽屉「跳转关联笔记」项共用）：打开笔记并定位到光标位置 */
  openLinkedNote(item: MemoItem): void {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(item.notePath!);
    if (!file) {
      notice('关联笔记不存在');
      return;
    }
    UIManager.hideMain();
    const leaf = app.workspace.getLeaf();
    App.state.remindedFiles.add(item.notePath!);
    void leaf.openFile(file as any);
    const editor = (leaf as any).view?.editor;
    if (editor && item.notePosition) {
      const { line, ch } = item.notePosition;
      editor.focus();
      editor.setCursor(line, ch || 0);
      editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    }
  },

  /** 卡片内容区：内部笔记链接 > 外部 URL > 纯文本 */
  createContentSpan(item: MemoItem): HTMLSpanElement {
    const contentSpan = document.createElement('span');
    contentSpan.className = 'todo-content-span';
    const linkStyle = 'bz-todo-link';
    // 1. 优先 linkedNote（内部笔记）
    if (item.linkedNote) {
      const link = document.createElement('a');
      link.className = linkStyle;
      link.textContent = item.title; // 显示为链接文本
      link.onclick = (e) => {
        e.preventDefault();
        this.openItem(item);
      };
      contentSpan.appendChild(link);
    }
    // 2. 检查是否有外部 URL（直接使用 item.url）
    else if (item.url) {
      const link = document.createElement('a');
      link.className = linkStyle;
      link.href = item.url;
      link.textContent = item.title; // 使用存储的显示文本
      (link as any).target = 'blank';
      link.onclick = (e) => {
        e.preventDefault();
        this.openItem(item);
      };
      contentSpan.appendChild(link);
    }
    // 3. 纯文本（无链接）
    else {
      contentSpan.textContent = item.title;
    }
    return contentSpan;
  },

  /** meta 信息行（场景/时间/位置等）——列表卡片与移动端抽屉顶部共用，保证两处显示完全一致 */
  buildMeta(item: MemoItem): HTMLElement {
    const meta = document.createElement('div');
    meta.className = 'todo-meta-container';

    if (item.scene === '公开课' && item.courseName) {
      meta.appendChild(this.createCourseTag(item));
    }
    if (item.scene === '代码' && item.scriptName) {
      meta.appendChild(this.createScriptTag(item.scriptName));
    }
    if (item.url) {
      const platform = getPlatformName(item.url);
      if (platform) meta.appendChild(this.createPlatformTag(item.url, platform));
    }
    if (item.notePath && item.notePosition) {
      const posTag = this.createPositionTag(item);
      if (posTag) meta.appendChild(posTag);
    }
    meta.appendChild(this.createSceneTag(item));
    if (item.due && !item.completed) {
      meta.appendChild(this.createDueTag(item));
    }
    meta.appendChild(this.createTimeTag(item));
    return meta;
  },

  /** 移动端抽屉顶部信息区：与列表卡片一模一样的「标题 + meta」展示（纯展示，不带跳转交互） */
  buildSheetHead(item: MemoItem): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-entry';
    const title = document.createElement('div');
    title.className = 'todo-content-span';
    title.textContent = item.title;
    if (item.completed) title.classList.add('done'); // 完成状态划线，与列表一致
    head.appendChild(title);
    head.appendChild(this.buildMeta(item));
    return head;
  },

  createCard(item: MemoItem, isArchived: boolean): HTMLElement {
    const app = getApp();
    const card = document.createElement('div');
    card.className = 'todo-card' + (isArchived ? ' archived' : '');

    // 复选框（归档条目显示图标；非归档模式下已完成条目显示勾选态）
    if (isArchived) {
      const icon = document.createElement('span');
      icon.className = 'bz-archived-icon';
      icon.textContent = '📦';
      card.appendChild(icon);
    } else {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!item.completed;
      checkbox.disabled = !!item.completed;
      // ticket 084a A1：checkbox 真防抖——每次 onChange 清旧 timer 重设；
      // 取消勾选清 timer 不通知（反悔失效修复）；回调内「当前仍勾选」二次校验；
      // 与抽屉「标记完成」同条目互斥由 notify 侧近 300ms 防重兜底（B6，smartcat/index.ts）
      let completeTimer: ReturnType<typeof setTimeout> | null = null;
      checkbox.onchange = () => {
        if (completeTimer) {
          clearTimeout(completeTimer);
          completeTimer = null;
        }
        if (!checkbox.checked) {
          // 取消勾选：清 timer 不通知，恢复卡片透明度
          card.style.transition = '';
          card.style.opacity = '';
          return;
        }
        card.style.transition = 'opacity 0.3s';
        card.style.opacity = '0.5';
        completeTimer = setTimeout(async () => {
          completeTimer = null;
          // 二次校验：防抖窗口内已取消勾选 → 不误发完成通知
          if (!checkbox.checked) return;
          await DataManager.completeItem(item.id);
          // ticket 075（域事件派发）：完成观察（防抖到点且仍勾选才发；重复由 smartcat 订阅侧防重拦截）
          emitDomainEvent('memo', { kind: 'completed', title: item.title });
          App.refresh();
        }, 300);
      };
      card.appendChild(checkbox);
    }

    // ---------- 内容区域（跳转逻辑，直接使用 item.linkedNote 和 item.url） ----------
    const contentSpan = this.createContentSpan(item);
    if (item.completed && !isArchived) {
      contentSpan.classList.add('done'); // 非归档模式下已完成条目：划线显示
    }
    card.appendChild(contentSpan);

    // ---------- meta 信息（场景、时间、位置等；与抽屉顶部共用 buildMeta，两处一字不差） ----------
    const meta = this.buildMeta(item);

    card.appendChild(meta);

    // 统一操作条/长按浮层（手势统一）：动作构建拆至 buildCardActions
    attachItemActions(card, this.buildCardActions(item), {
      sheetHead: this.buildSheetHead(item),
      // 列表禁止选字/复制：长按整卡任何位置都弹抽屉（user-select:none 由 styles.css 承担）
    });

    return card;
  },

  /** 卡片操作条动作（createCard 拆分）：打开 > 跳转笔记 > 完成状态 > 延后 > 编辑 > 优先级 > 复制 > 删除；
   * 各项按条件显示：只有条目具备对应数据才出现（如「跳转关联笔记」仅绑定位置时显示） */
  buildCardActions(item: MemoItem): ItemAction[] {
    const actions: ItemAction[] = [];
    if (item.linkedNote || item.url) {
      let openSub: string | undefined;
      if (item.linkedNote) openSub = item.linkedNote.split('/').pop() || undefined;
      else if (item.url) {
        try {
          openSub = new URL(item.url).hostname;
        } catch (e) {
          /* 非法 URL 不显示小字 */
        }
      }
      actions.push({
        icon: 'external-link',
        label: '打开',
        title: '打开关联内容',
        sub: openSub,
        onClick: () => this.openItem(item),
      });
    }
    if (item.notePath) {
      actions.push({
        icon: 'book-open',
        label: '跳转关联笔记',
        title: '跳转关联笔记',
        sub: (item.notePath.split('/').pop() || '').replace(/\.md$/i, '') || undefined,
        onClick: () => this.openLinkedNote(item),
      });
    }
    if (!item.completed) {
      actions.push({
        icon: 'check-circle',
        label: '标记完成',
        title: '标记完成',
        sub: item.due ? formatDueText(item.due) : undefined, // 到期状态：剩 N 天/今天/已过期
        onClick: async () => {
          await DataManager.completeItem(item.id);
          // ticket 075（域事件派发）：完成观察
          emitDomainEvent('memo', { kind: 'completed', title: item.title });
          notice('已标记完成', 'success');
          App.refresh();
        },
      });
    } else {
      actions.push({
        icon: 'rotate-ccw',
        label: '恢复未完成',
        title: '恢复未完成',
        onClick: async () => {
          await DataManager.updateItem(item.id, { completed: null } as any);
          // ticket 075（域事件派发）：恢复未完成观察
          emitDomainEvent('memo', { kind: 'restored', title: item.title });
          notice('已恢复未完成', 'success');
          App.refresh();
        },
      });
    }
    if (item.due && !item.completed) {
      const postpone = (days: number) => {
        const next = moment(item.due!.replace('T', ' ')).add(days, 'days').format('YYYY-MM-DD HH:mm');
        void DataManager.updateItem(item.id, { due: next } as any).then(() => {
          // ticket 075（域事件派发）：延后观察（带延后后的新截止）
          emitDomainEvent('memo', { kind: 'postponed', title: item.title, due: next });
          notice(`已延后 ${days} 天`, 'success');
          App.refresh();
        });
      };
      // 小字 = 延后后的新日期（MM-DD HH:mm），一眼看到结果
      const postponeSub = (days: number) =>
        moment(item.due!.replace('T', ' ')).add(days, 'days').format('MM-DD HH:mm');
      actions.push({ icon: 'clock', label: '延后 1 天', title: '延后 1 天', sub: postponeSub(1), onClick: () => postpone(1) });
      actions.push({ icon: 'clock', label: '延后 3 天', title: '延后 3 天', sub: postponeSub(3), onClick: () => postpone(3) });
    }
    // 拆分高频单项：优先级切换（重要 ↔ 次要，即时写盘）
    const isImportant = item.priority === 'important';
    actions.push({
      icon: 'star',
      label: isImportant ? '转为次要' : '转为重要',
      title: '切换优先级',
      onClick: async () => {
        const to = isImportant ? 'minor' : 'important';
        await DataManager.updateItem(item.id, { priority: to } as any);
        // ticket 075（域事件派发）：切换优先级观察
        emitDomainEvent('memo', { kind: 'priority', title: item.title, to });
        notice(isImportant ? '已转为次要' : '已转为重要', 'success');
        App.refresh();
      },
    });
    actions.push({
      icon: 'copy',
      label: '复制内容',
      title: '复制内容',
      sub: `${item.title.length} 字`,
      onClick: async () => {
        await navigator.clipboard.writeText(item.title);
        notice('内容已复制', 'success');
      },
    });
    // 编辑紧贴删除之上（错误纠正：常用操作靠近危险项，删除永远垫底）
    actions.push({ icon: 'pencil', label: '编辑', title: '编辑', onClick: () => UIManager.showAddDialog(item) });
    actions.push({
      icon: 'trash-2',
      label: '删除',
      title: '删除',
      kind: 'danger',
      onClick: () =>
        UIManager.showConfirm('删除备忘录', item.title, async () => {
          await DataManager.deleteItem(item.id);
          // ticket 075（域事件派发）：删除观察
          emitDomainEvent('memo', { kind: 'deleted', title: item.title });
          App.refresh();
        }),
    });
    return actions;
  },

  createCourseTag(item: MemoItem): HTMLElement {
    const app = getApp();
    const displayName = item.courseName!.replace(/^《|》$/g, '');
    const tag = document.createElement('span');
    tag.className = 'bz-tag bz-tag-course';
    tag.textContent = `🎓 ${displayName}`;
    const targetPath = item.coursePath || item.notePath;
    if (targetPath) {
      const file = app.vault.getAbstractFileByPath(targetPath);
      if (file) {
        tag.onclick = async (e) => {
          e.stopPropagation();
          UIManager.hideMain();
          // 标记为已提醒，避免重复弹出
          App.state.remindedFiles.add(targetPath);
          const leaf = app.workspace.getLeaf();
          await leaf.openFile(file as any);
          // 如果有位置信息且跳转的是 notePath，定位光标
          if (item.notePosition && targetPath === item.notePath) {
            const editor = (leaf as any).view?.editor;
            if (editor) {
              editor.focus();
              editor.setCursor(item.notePosition.line, item.notePosition.ch || 0);
              editor.scrollIntoView(
                { from: { line: item.notePosition.line, ch: 0 }, to: { line: item.notePosition.line, ch: 0 } },
                true
              );
            }
          }
        };
      } else {
        tag.title = '关联文件不存在';
        tag.classList.remove('bz-tag-course');
        tag.classList.add('bz-tag-missing');
        tag.onclick = null;
      }
    }
    return tag;
  },

  createScriptTag(name: string): HTMLElement {
    const tag = document.createElement('span');
    tag.className = 'bz-tag bz-tag-script';
    tag.textContent = `💻 ${name}`;
    return tag;
  },

  createPlatformTag(url: string, platform: string): HTMLElement {
    const container = document.createElement('span');
    container.className = 'bz-tag bz-tag-platform';
    try {
      const domain = new URL(url).hostname;
      const icon = createSiteIcon(domain, 14);
      if (icon) container.appendChild(icon);
    } catch (e) { /* 无效 URL 忽略 */ }
    const text = document.createElement('span');
    text.textContent = platform;
    container.appendChild(text);
    return container;
  },

  createPositionTag(item: MemoItem): HTMLElement | null {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(item.notePath!);
    if (!file) {
      const base = item.notePath!.split('/').pop() || '未知文件';
      const tag = document.createElement('span');
      tag.className = 'bz-tag bz-tag-warn';
      tag.textContent = `⚠️ ${base.replace(/^《|》$/g, '')}`;
      return tag;
    }
    const fileName = (file as any).basename.replace(/^《|》$/g, '');
    if (item.scene === '公开课' && item.courseName) {
      const courseDisplay = item.courseName.replace(/^《|》$/g, '');
      if (fileName === courseDisplay) return null;
    }
    const tag = document.createElement('span');
    let label = '📌';
    if (App.state.showFileName) label += ` ${fileName}`;
    tag.className = 'bz-tag bz-tag-position';
    tag.textContent = label;
    tag.onclick = (e) => {
      e.stopPropagation();
      this.openLinkedNote(item);
    };
    return tag;
  },

  // 场景标签（纯展示；编辑入口收敛到卡片操作条/长按菜单，手势统一）
  createSceneTag(item: MemoItem): HTMLElement {
    const span = document.createElement('span');
    span.className = 'bz-tag bz-tag-scene' + (item.priority === 'important' ? ' important' : '');
    span.textContent = `#${item.scene}`;
    return span;
  },

  createTimeTag(item: MemoItem): HTMLElement {
    const span = document.createElement('span');
    span.className = 'bz-tag-time';
    span.textContent = formatRelativeTime(item.created);
    return span;
  },

  createDueTag(item: MemoItem): HTMLElement {
    const status = getDueStatus(item.due);
    const dueFormat = App.settings.memoDueFormat === 'absolute' ? 'absolute' : 'relative';
    const span = document.createElement('span');
    span.className = `bz-tag bz-tag-due ${status === 'overdue' ? 'overdue' : status === 'today' ? 'today' : 'future'}`;
    span.textContent = `${status === 'overdue' ? '🔴' : status === 'today' ? '⚠️' : '📅'} ${formatDueText(item.due!, dueFormat)}`;
    return span;
  },
};

/**
 * 备忘录 UI（备忘录.js UIManager + Renderer 逐字移植）
 * DOM id/类名与原脚本一致：todo-mask / todo-popup / todo-entries-container /
 * add-todo-mask / add-todo-popup / add-todo-* / scene-btn / priority-btn / todo-card。
 */
import moment from 'moment';
import { Notice } from 'obsidian';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { confirm } from '../core/confirm';
import { createSiteIcon, createIconBtn as _unused } from '../core/dom';
import {
  formatRelativeTime,
  extractUrlAndDisplay,
  generateId,
  getCurrentNoteInfo,
  getCurrentCursorPosition,
  fetchPageTitle,
} from '../core/utils';
import { checkAndShowChangelog } from '../core/changelog';
import { DataManager, getPlatformName } from './data';
import { getDueStatus, formatDueText } from './due';
import type { MemoItem, MemoPosition } from './types';
import { App } from './app';

/** 备忘录样式（TODOCSS，收敛 styles.css 前保留注入） */
const TODOCSS = `
#todo-mask { backdrop-filter: blur(2px); }
#todo-popup { animation: slideUp 0.3s ease-out; }
@keyframes slideUp {
    from { opacity:0; transform: translate(-50%, -40%); }
    to { opacity:1; transform: translate(-50%, -50%); }
}
#todo-entries-container::-webkit-scrollbar { width: 6px; }
#todo-entries-container::-webkit-scrollbar-thumb { background: var(--background-modifier-border); border-radius: 4px; }
#add-todo-due-input { color-scheme: light dark; }
#add-todo-due-input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
#add-todo-due-input::-webkit-calendar-picker-indicator:hover { opacity: 1; }
#todo-popup .todo-btn-add:hover, #todo-popup .todo-btn-archive:hover, #todo-popup .todo-btn-close:hover { background: var(--background-secondary); }

@media (max-width: 768px) {
    /* 移动端：居中弹窗（宽度 95%），不全屏 */
    #todo-popup { width: 95%; max-height: 90vh; }
    .todo-card {
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
    }
    .todo-card > input[type="checkbox"] {
        flex: 0 0 auto;
        width: auto;
        margin-right: 0;
    }
    .todo-card .todo-content-span {
        flex: 1 1 auto;
        min-width: 0;
    }
    .todo-card .todo-meta-container {
        flex: 0 0 100%;
        flex-direction: row;
        justify-content: flex-start;
        gap: 8px;
        padding-left: 28px;
    }
}
`;

export const UIManager = {
  mask: null as HTMLDivElement | null,
  popup: null as HTMLDivElement | null,
  entriesContainer: null as HTMLElement | null,
  addMask: null as HTMLDivElement | null,
  addPopup: null as HTMLDivElement | null,
  addEditingId: null as string | null,
  confirmMask: null as HTMLDivElement | null,
  confirmPopup: null as HTMLDivElement | null,
  confirmCallback: null as (() => void) | null,
  escapeRegistered: false,
  // 私有建议数据（避免全局污染）
  scriptSuggestions: [] as string[],
  courseSuggestions: [] as { name: string; path: string }[],
  _handleSave: null as (() => Promise<void>) | null,

  injectStyles() {
    if (document.querySelector('style[data-todo-styles]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-todo-styles', '');
    style.textContent = TODOCSS;
    document.head.appendChild(style);
  },

  // ---------- 主面板 ----------
  createMainUI() {
    if (this.mask && document.body.contains(this.mask)) return;

    this.mask = document.createElement('div');
    this.mask.id = 'todo-mask';
    Object.assign(this.mask.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--background-modifier-cover)',
      zIndex: 9998,
      display: 'none',
    });
    this.mask.onclick = () => this.hideMain();

    this.popup = document.createElement('div');
    this.popup.id = 'todo-popup';
    Object.assign(this.popup.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'var(--background-primary)',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      zIndex: 9999,
      width: '90%',
      maxWidth: '700px',
      maxHeight: '80vh',
      display: 'none',
      flexDirection: 'column',
    });
    this.popup.innerHTML = `
            <div style="padding:16px 24px 8px 24px;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text-normal);">备忘录</h3>
                <div style="display:flex;gap:8px;">
                    <button class="todo-btn-add" style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--text-muted);padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;display:flex;align-items:center;justify-content:center;">✏️</button>
                    <button class="todo-btn-archive" style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--text-muted);padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;display:flex;align-items:center;justify-content:center;">📁</button>
                    <button class="todo-btn-close" style="background:none;border:none;font-size:13px;cursor:pointer;color:var(--text-muted);padding:0;width:21px;height:25px;border-radius:4px;box-shadow:none;display:flex;align-items:center;justify-content:center;">❌</button>
                </div>
            </div>
            <div id="todo-entries-container" style="flex:1;overflow-y:auto;padding:0 20px;min-height:200px;"></div>
        `;
    this.entriesContainer = this.popup.querySelector('#todo-entries-container');
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
    App.refresh();
    checkAndShowChangelog('memo');
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
    Object.assign(this.addMask.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.3)',
      zIndex: 10001,
      display: 'none',
    });
    this.addMask.onclick = (e) => {
      if (e.target === this.addMask) this.hideAddDialog();
    };

    this.addPopup = document.createElement('div');
    this.addPopup.id = 'add-todo-popup';
    Object.assign(this.addPopup.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'var(--background-primary)',
      borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      zIndex: 10002,
      padding: '24px',
      maxWidth: '400px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto',
      display: 'none',
    });

    // 构造内部HTML（在底部按钮区增加 AI 推荐按钮）
    this.addPopup.innerHTML = `
            <h4 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:var(--text-normal);">创建备忘录</h4>
            <input id="add-todo-content" type="text" placeholder="输入备忘录内容..." style="width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:16px;">
            <input id="add-todo-title" type="text" placeholder="标题（可选）" style="width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:8px;display:none;">
            <div id="add-todo-script-container" style="display:none; margin-bottom:12px;">
                <input id="add-todo-script" type="text" placeholder="脚本名" style="width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;">
                <div id="add-todo-script-suggestions" style="max-height:150px;overflow-y:auto;background:var(--background-secondary);border-radius:4px;margin-top:4px;display:none;font-size:14px;"></div>
            </div>
            <div id="add-todo-course-container" style="display:none; margin-bottom:12px;">
                <input id="add-todo-course" type="text" placeholder="课程名" style="width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;">
                <div id="add-todo-course-suggestions" style="max-height:150px;overflow-y:auto;background:var(--background-secondary);border-radius:4px;margin-top:4px;display:none;font-size:14px;"></div>
            </div>
            <div id="add-todo-scenes" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;"></div>
            <div id="add-todo-priority" style="display:flex;gap:8px;margin-bottom:12px;align-items:center;"></div>
            <div id="add-todo-due" style="display:flex;gap:8px;margin-bottom:16px;align-items:center;">
                <input id="add-todo-due-input" type="datetime-local" step="60" style="padding:5px 10px;border-radius:16px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal);font-size:13px;cursor:pointer;box-shadow:none;max-width:220px;">
                <button id="add-todo-due-clear" type="button" style="display:none;padding:2px 8px;border-radius:12px;border:none;background:var(--background-secondary);color:var(--text-muted);cursor:pointer;font-size:12px;box-shadow:none;">✕</button>
                <span style="font-size:12px;color:var(--text-faint);">截止日期（可选）</span>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                <button id="add-todo-pos-btn" type="button" style="padding:4px 12px;border-radius:16px;background:var(--background-secondary);color:var(--text-muted);cursor:pointer;font-size:13px;box-shadow:none;border:1px solid var(--background-modifier-border);">📌</button>
            </div>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button id="add-todo-ai-recommend" style="padding:8px 16px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;box-shadow:none;">✨ AI 推荐</button>
                <button id="add-todo-cancel" style="padding:8px 16px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;box-shadow:none;">取消</button>
                <button id="add-todo-save" style="padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:14px;font-weight:500;box-shadow:none;">保存</button>
            </div>
        `;

    document.body.appendChild(this.addMask);
    document.body.appendChild(this.addPopup);

    // 绑定事件
    const contentInput = this.addPopup.querySelector('#add-todo-content') as HTMLInputElement;
    const titleInput = this.addPopup.querySelector('#add-todo-title') as HTMLInputElement;
    const sceneContainer = this.addPopup.querySelector('#add-todo-scenes') as HTMLElement;
    const priorityContainer = this.addPopup.querySelector('#add-todo-priority') as HTMLElement;
    const posBtn = this.addPopup.querySelector('#add-todo-pos-btn') as HTMLButtonElement;
    const cancelBtn = this.addPopup.querySelector('#add-todo-cancel') as HTMLButtonElement;
    const saveBtn = this.addPopup.querySelector('#add-todo-save') as HTMLButtonElement;
    const aiBtn = this.addPopup.querySelector('#add-todo-ai-recommend') as HTMLButtonElement;
    const scriptInput = this.addPopup.querySelector('#add-todo-script') as HTMLInputElement;
    const scriptSuggest = this.addPopup.querySelector('#add-todo-script-suggestions') as HTMLElement;
    const scriptContainer = this.addPopup.querySelector('#add-todo-script-container') as HTMLElement;
    const courseInput = this.addPopup.querySelector('#add-todo-course') as HTMLInputElement;
    const courseSuggest = this.addPopup.querySelector('#add-todo-course-suggestions') as HTMLElement;
    const courseContainer = this.addPopup.querySelector('#add-todo-course-container') as HTMLElement;

    // ---------- AI 推荐按钮 ----------
    aiBtn.onclick = async () => {
      const content = contentInput.value.trim();
      if (!content) {
        new Notice('请先输入备忘录内容');
        return;
      }
      await this.handleAIRecommend();
    };

    // ---------- 优先级按钮 ----------
    const priorities = [
      { value: 'minor', label: '次要' },
      { value: 'important', label: '重要' },
    ];
    for (const p of priorities) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'priority-btn';
      btn.dataset.priority = p.value;
      btn.textContent = p.label;
      Object.assign(btn.style, {
        padding: '6px 14px',
        borderRadius: '20px',
        background: 'var(--background-secondary)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s',
        opacity: '0.5',
        boxShadow: 'none',
        border: 'none',
      });
      if (p.value === 'minor') {
        btn.style.opacity = '1';
        btn.style.background = 'var(--interactive-accent)';
        btn.style.color = 'var(--text-on-accent)';
        btn.classList.add('active');
      }
      btn.onclick = () => {
        priorityContainer.querySelectorAll('.priority-btn').forEach((b) => {
          (b as HTMLElement).style.opacity = '0.5';
          (b as HTMLElement).style.background = 'var(--background-secondary)';
          (b as HTMLElement).style.color = 'var(--text-muted)';
          b.classList.remove('active');
        });
        btn.style.opacity = '1';
        btn.style.background = 'var(--interactive-accent)';
        btn.style.color = 'var(--text-on-accent)';
        btn.classList.add('active');
      };
      priorityContainer.appendChild(btn);
    }

    // ---------- 截止日期 ----------
    const dueInput = this.addPopup.querySelector('#add-todo-due-input') as HTMLInputElement;
    const dueClear = this.addPopup.querySelector('#add-todo-due-clear') as HTMLButtonElement;
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
        data.notePath = null;
        data.notePosition = null;
        (posBtn as any).positionData = data;
        posBtn.textContent = '📌';
        posBtn.style.background = 'var(--background-secondary)';
        posBtn.style.color = 'var(--text-muted)';
      } else {
        const info = getCurrentNoteInfo();
        const pos = getCurrentCursorPosition();
        if (info && pos) {
          data.notePath = info.path;
          data.notePosition = { line: pos.line, ch: pos.ch };
          (posBtn as any).positionData = data;
          posBtn.textContent = `📌 ${info.name}`;
          posBtn.style.background = 'var(--interactive-accent)';
          posBtn.style.color = 'var(--text-on-accent)';
        } else {
          new Notice('无法获取当前位置');
        }
      }
    };

    // ---------- 场景按钮构建 ----------
    const buildScenes = () => {
      sceneContainer.innerHTML = '';
      const scenarios = DataManager.getScenarios();
      for (const scene of scenarios) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'scene-btn';
        btn.dataset.scene = scene;
        btn.textContent = scene;
        Object.assign(btn.style, {
          padding: '6px 14px',
          borderRadius: '20px',
          background: 'var(--background-secondary)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s',
          opacity: '0.5',
          boxShadow: 'none',
          border: 'none',
        });
        btn.onclick = () => {
          sceneContainer.querySelectorAll('.scene-btn').forEach((b) => {
            (b as HTMLElement).style.opacity = '0.5';
            (b as HTMLElement).style.background = 'var(--background-secondary)';
            (b as HTMLElement).style.color = 'var(--text-muted)';
            b.classList.remove('active');
          });
          btn.style.opacity = '1';
          btn.style.background = 'var(--interactive-accent)';
          btn.style.color = 'var(--text-on-accent)';
          btn.classList.add('active');

          // 切换场景时清空输入框内容（如果离开剪藏）
          const isClip = btn.dataset.scene === '剪藏';
          if (!isClip) {
            // 清空内容输入框和标题输入框
            contentInput.value = '';
            contentInput.placeholder = '输入备忘录内容...';
            contentInput.dataset.rawClipboard = '';
            titleInput.value = '';
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
        };
        sceneContainer.appendChild(btn);
      }
    };
    buildScenes();

    // ---------- 脚本输入建议 ----------
    scriptInput.addEventListener('input', () => {
      const val = scriptInput.value.trim().toLowerCase();
      const suggestions = this.scriptSuggestions || [];
      let matched = suggestions;
      if (val) {
        matched = suggestions.filter((s) => s.toLowerCase().includes(val));
      }
      const sugg = scriptSuggest;
      if (matched.length) {
        sugg.innerHTML = matched
          .map(
            (s) =>
              `<div style="padding:6px 12px;cursor:pointer;border-bottom:1px solid var(--background-modifier-border);font-size:14px;">${s}</div>`
          )
          .join('');
        sugg.style.cssText = 'display: block !important; max-height: 150px; overflow-y: auto; background: var(--background-secondary); border-radius: 4px; margin-top: 4px;';
        sugg.querySelectorAll('div').forEach((el) => {
          (el as HTMLElement).onclick = () => {
            scriptInput.value = (el as HTMLElement).textContent || '';
            sugg.style.display = 'none';
          };
        });
      } else {
        sugg.style.display = 'none';
      }
    });
    document.addEventListener('click', (e) => {
      if (!scriptContainer.contains(e.target as Node)) scriptSuggest.style.display = 'none';
    });
    scriptInput.addEventListener('focus', () => {
      scriptInput.dispatchEvent(new Event('input'));
    });

    // ---------- 课程输入建议 ----------
    courseInput.addEventListener('input', () => {
      const val = courseInput.value.trim().toLowerCase();
      const suggestions = this.courseSuggestions || [];
      let matched = suggestions;
      if (val) {
        matched = suggestions.filter((s) => s.name.toLowerCase().includes(val));
      }
      const sugg = courseSuggest;
      if (matched.length) {
        sugg.innerHTML = matched
          .map(
            (s) =>
              `<div style="padding:6px 12px;cursor:pointer;border-bottom:1px solid var(--background-modifier-border);font-size:14px;" data-path="${s.path}">${s.name}</div>`
          )
          .join('');
        sugg.style.cssText = 'display: block !important; max-height: 150px; overflow-y: auto; background: var(--background-secondary); border-radius: 4px; margin-top: 4px;';
        sugg.querySelectorAll('div').forEach((el) => {
          (el as HTMLElement).onclick = () => {
            courseInput.value = (el as HTMLElement).textContent || '';
            courseInput.dataset.coursePath = (el as HTMLElement).dataset.path || '';
            sugg.style.display = 'none';
          };
        });
      } else {
        sugg.style.display = 'none';
      }
    });
    courseInput.addEventListener('focus', () => {
      courseInput.dispatchEvent(new Event('input'));
    });
    document.addEventListener('click', (e) => {
      if (!courseContainer.contains(e.target as Node)) courseSuggest.style.display = 'none';
    });

    // ---------- 取消 / 保存 ----------
    cancelBtn.onclick = () => this.hideAddDialog();

    // 将保存逻辑提取为独立函数以便复用
    const handleSave = async () => {
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
        new Notice('请输入内容');
        return;
      }

      const selectedScene = sceneContainer.querySelector('.scene-btn.active');
      if (!selectedScene) {
        new Notice('请选择场景');
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
            const suggestions = this.courseSuggestions || [];
            const matched = suggestions.find((s) => s.name.toLowerCase() === cv.toLowerCase());
            if (matched) coursePath = matched.path;
          }
        }
      }

      const editingId = this.addEditingId;
      const dueValue = dueInput.value || null;
      try {
        if (editingId) {
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
        }
        await App.loadData();
        App.refresh();
        this.hideAddDialog();
      } catch (e: any) {
        new Notice('保存失败：' + e.message);
        console.error(e);
      }
    };

    saveBtn.onclick = handleSave;

    // 键盘事件（ESC关闭）
    this.addPopup.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideAddDialog();
    });

    // 保存 handleSave 到实例，以便在 showAddDialog 中复用
    this._handleSave = handleSave;
  },

  // ---------- AI 推荐场景和优先级 ----------
  async handleAIRecommend() {
    const contentInput = document.getElementById('add-todo-content') as HTMLInputElement | null;
    if (!contentInput) return;
    const content = contentInput.value.trim();
    if (!content) {
      new Notice('请先输入备忘录内容');
      return;
    }

    const scenarios = DataManager.getScenarios();
    const scenariosStr = scenarios.map((s) => `"${s}"`).join('、');

    const prompt = `
你是一个备忘录智能助手。根据以下用户输入的备忘录内容，判断最适合的场景（scene）和优先级（priority）。

可选的场景有：${scenariosStr}。
优先级分为两种："重要" 或 "次要"。

请只返回一个 JSON 对象，格式如下：
{"scene": "场景名", "priority": "重要/次要"}

用户内容：${content}
`;

    try {
      if (!App.ai) {
        new Notice('AI 服务未初始化，请检查 QuickAdd 配置');
        return;
      }

      // 显示加载状态（可选）
      const aiBtn = document.querySelector('#add-todo-ai-recommend') as HTMLButtonElement | null;
      if (aiBtn) {
        aiBtn.textContent = '⏳ 推荐中...';
        aiBtn.disabled = true;
      }

      const result = await App.ai.chat(prompt);

      // 解析 AI 结果
      let recommendation: { scene: string; priority: string };
      try {
        let jsonStr = result.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonStr = jsonMatch[1].trim();
        }
        recommendation = JSON.parse(jsonStr);
      } catch (e) {
        // 备选：从文本中提取
        const sceneMatch = result.match(/场景[：:]\s*([^\s,，]+)/);
        const priorityMatch = result.match(/优先级[：:]\s*([^\s,，]+)/);
        if (sceneMatch && priorityMatch) {
          recommendation = { scene: sceneMatch[1], priority: priorityMatch[1] };
        } else {
          throw new Error('无法解析 AI 推荐结果');
        }
      }

      // 验证推荐
      const validScenes = DataManager.getScenarios();
      if (!validScenes.includes(recommendation.scene)) {
        new Notice(`推荐场景“${recommendation.scene}”不在可选列表中，请手动选择`);
        return;
      }
      if (!['重要', '次要'].includes(recommendation.priority)) {
        recommendation.priority = '次要';
      }

      // 自动选中场景按钮
      const sceneContainer = document.getElementById('add-todo-scenes');
      const sceneBtns = sceneContainer!.querySelectorAll('.scene-btn');
      sceneBtns.forEach((btn) => {
        if ((btn as HTMLElement).dataset.scene === recommendation.scene) {
          (btn as HTMLElement).click();
        }
      });

      // 自动选中优先级按钮
      const priorityContainer = document.getElementById('add-todo-priority');
      const priorityBtns = priorityContainer!.querySelectorAll('.priority-btn');
      const priorityMap: Record<string, string> = { '重要': 'important', '次要': 'minor' };
      const targetPriority = priorityMap[recommendation.priority] || 'minor';
      priorityBtns.forEach((btn) => {
        if ((btn as HTMLElement).dataset.priority === targetPriority) {
          (btn as HTMLElement).click();
        }
      });

      new Notice(`AI 推荐：场景【${recommendation.scene}】，优先级【${recommendation.priority}】`);
    } catch (e) {
      console.error('AI 推荐失败:', e);
      new Notice('AI 推荐失败，请手动选择');
    } finally {
      // 恢复按钮状态
      const aiBtn = document.querySelector('#add-todo-ai-recommend') as HTMLButtonElement | null;
      if (aiBtn) {
        aiBtn.textContent = '✨ AI 推荐';
        aiBtn.disabled = false;
      }
    }
  },

  showAddDialog(editItem: MemoItem | null) {
    this.createAddDialog();
    if (!this.addMask || !this.addPopup) return;
    this.addEditingId = editItem ? editItem.id : null;

    const contentInput = this.addPopup.querySelector('#add-todo-content') as HTMLInputElement;
    const titleInput = this.addPopup.querySelector('#add-todo-title') as HTMLInputElement;
    const sceneContainer = this.addPopup.querySelector('#add-todo-scenes') as HTMLElement;
    const priorityContainer = this.addPopup.querySelector('#add-todo-priority') as HTMLElement;
    const posBtn = this.addPopup.querySelector('#add-todo-pos-btn') as HTMLButtonElement;
    const scriptInput = this.addPopup.querySelector('#add-todo-script') as HTMLInputElement;
    const scriptContainer = this.addPopup.querySelector('#add-todo-script-container') as HTMLElement;
    const courseInput = this.addPopup.querySelector('#add-todo-course') as HTMLInputElement;
    const courseContainer = this.addPopup.querySelector('#add-todo-course-container') as HTMLElement;
    const scriptSuggest = this.addPopup.querySelector('#add-todo-script-suggestions') as HTMLElement;
    const courseSuggest = this.addPopup.querySelector('#add-todo-course-suggestions') as HTMLElement;
    const dueInput = this.addPopup.querySelector('#add-todo-due-input') as HTMLInputElement;
    const dueClear = this.addPopup.querySelector('#add-todo-due-clear') as HTMLButtonElement;

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
    posBtn.style.background = 'var(--background-secondary)';
    posBtn.style.color = 'var(--text-muted)';

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

    // 场景按钮激活第一个
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
        // 编辑时回填内容到输入框（场景按钮会清空，所以放在最后）
        contentInput.value = editItem.title || '';
      } else {
        (sceneBtns[0] as HTMLElement).click();
      }
    }

    // 优先级
    const priorityBtns = priorityContainer.querySelectorAll('.priority-btn');
    priorityBtns.forEach((b) => {
      const btn = b as HTMLElement;
      btn.style.opacity = '0.5';
      btn.style.background = 'var(--background-secondary)';
      btn.style.color = 'var(--text-muted)';
      btn.classList.remove('active');
      if (
        (editItem && btn.dataset.priority === editItem.priority) ||
        (!editItem && btn.dataset.priority === 'minor')
      ) {
        btn.style.opacity = '1';
        btn.style.background = 'var(--interactive-accent)';
        btn.style.color = 'var(--text-on-accent)';
        btn.classList.add('active');
      }
    });

    // 填充编辑数据
    if (editItem) {
      this.addPopup.querySelector('h4')!.textContent = '编辑备忘录';
      contentInput.value = editItem.title || '';
      if (editItem.url) {
        contentInput.placeholder = editItem.url;
      } else {
        contentInput.placeholder = '输入备忘录内容...';
      }
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
          posBtn.style.background = 'var(--interactive-accent)';
          posBtn.style.color = 'var(--text-on-accent)';
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
    contentInput.focus();

    // ---------- 绑定事件（重写保存逻辑以提取 url） ----------
    // 取消按钮
    this.addPopup.querySelector('#add-todo-cancel')!.onclick = () => this.hideAddDialog();

    const saveBtn = this.addPopup.querySelector('#add-todo-save') as HTMLButtonElement;
    saveBtn.onclick = async () => {
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
        new Notice('请输入内容');
        return;
      }

      const selectedScene = sceneContainer.querySelector('.scene-btn.active');
      if (!selectedScene) {
        new Notice('请选择场景');
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
            const suggestions = this.courseSuggestions || [];
            const matched = suggestions.find((s) => s.name.toLowerCase() === cv.toLowerCase());
            if (matched) coursePath = matched.path;
          }
        }
      }

      const editingId = this.addEditingId;
      const dueValue = dueInput.value || null;
      try {
        if (editingId) {
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
        }
        await App.loadData();
        App.refresh();
        this.hideAddDialog();
      } catch (e: any) {
        new Notice('保存失败：' + e.message);
        console.error(e);
      }
    };

    // 位置按钮（保留原有逻辑）
    this.addPopup.querySelector('#add-todo-pos-btn')!.onclick = () => {
      const data = (posBtn as any).positionData || {};
      if (data.notePath && data.notePosition) {
        data.notePath = null;
        data.notePosition = null;
        (posBtn as any).positionData = data;
        posBtn.textContent = '📌';
        posBtn.style.background = 'var(--background-secondary)';
        posBtn.style.color = 'var(--text-muted)';
      } else {
        const info = getCurrentNoteInfo();
        const pos = getCurrentCursorPosition();
        if (info && pos) {
          data.notePath = info.path;
          data.notePosition = { line: pos.line, ch: pos.ch };
          (posBtn as any).positionData = data;
          posBtn.textContent = `📌 ${info.name}`;
          posBtn.style.background = 'var(--interactive-accent)';
          posBtn.style.color = 'var(--text-on-accent)';
        } else {
          new Notice('无法获取当前位置');
        }
      }
    };

    // AI 推荐按钮（保留原有逻辑）
    this.addPopup.querySelector('#add-todo-ai-recommend')!.onclick = async () => {
      const content = contentInput.value.trim();
      if (!content) {
        new Notice('请先输入备忘录内容');
        return;
      }
      await this.handleAIRecommend();
    };
  },

  hideAddDialog() {
    if (this.addMask) this.addMask.style.display = 'none';
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.addEditingId = null;
  },

  // ---------- 确认对话框（代理到 core confirm） ----------
  createConfirmDialog() {},
  showConfirm(title: string, msg: string, onConfirm: () => void) {
    confirm({ title: title || '确认删除', message: msg || '', onConfirm });
  },
  hideConfirm() {},

  // ---------- ESC ----------
  registerEscape() {
    escManager.register('memo', {
      isVisible: () => !!(this.mask && this.mask.style.display === 'block'),
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
    const active = items.filter((i) => i.completed === null);
    const archived = items.filter((i) => i.completed !== null);
    const filter = App.state.filter;
    const filteredActive = filter ? active.filter(filter) : active;
    const filteredArchived = filter ? archived.filter(filter) : archived;

    if (filteredActive.length === 0 && filteredArchived.length === 0) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-faint);font-size:16px;">${filter ? '没有匹配的备忘录' : '没有备忘录 🎉'}</div>`;
      return;
    }

    const sortFn = (a: MemoItem, b: MemoItem) => {
      // 1. 截止日期紧急度：overdue > today > future > none
      const dueOrder: Record<string, number> = { overdue: 0, today: 1, future: 2 };
      const da = a.due && !a.completed ? (dueOrder[getDueStatus(a.due)!] ?? 3) : 3;
      const db = b.due && !b.completed ? (dueOrder[getDueStatus(b.due)!] ?? 3) : 3;
      if (da !== db) return da - db;

      // 2. 优先级（开启时）
      if (App.state.sortByPriority) {
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
      sep.style.cssText = 'margin:20px 0 12px 0;display:flex;align-items:center;justify-content:center;gap:12px;';
      sep.innerHTML = `<span style="font-size:14px;color:var(--text-faint);">已归档</span>`;
      container.appendChild(sep);
      for (const item of filteredArchived) {
        container.appendChild(this.createCard(item, true));
      }
    }
  },

  createCard(item: MemoItem, isArchived: boolean): HTMLElement {
    const app = getApp();
    const card = document.createElement('div');
    card.className = 'todo-card';
    Object.assign(card.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 0',
      borderBottom: '1px solid var(--background-modifier-border)',
      opacity: isArchived ? '0.7' : '1',
    });

    // 复选框（归档条目显示图标）
    if (isArchived) {
      const icon = document.createElement('span');
      icon.textContent = '📦';
      icon.style.cssText = 'font-size:16px;flex-shrink:0;width:18px;text-align:center;';
      card.appendChild(icon);
    } else {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.cssText = 'width:18px;height:18px;cursor:pointer;flex-shrink:0;';
      checkbox.checked = false;
      checkbox.onchange = async () => {
        if (checkbox.checked) {
          card.style.transition = 'opacity 0.3s';
          card.style.opacity = '0.5';
          setTimeout(async () => {
            await DataManager.completeItem(item.id);
            App.refresh();
          }, 300);
        }
      };
      card.appendChild(checkbox);
    }

    // ---------- 内容区域（跳转逻辑，直接使用 item.linkedNote 和 item.url） ----------
    const contentSpan = document.createElement('span');
    contentSpan.style.cssText = 'flex:1;font-size:15px;color:var(--text-normal);word-break:break-word;user-select:text;';

    // 1. 优先 linkedNote（内部笔记）
    if (item.linkedNote) {
      const link = document.createElement('a');
      link.textContent = item.title; // 显示为链接文本
      link.style.cssText = 'color:var(--text-accent);text-decoration:underline;cursor:pointer;word-break:break-word;';
      link.onclick = async (e) => {
        e.preventDefault();
        UIManager.hideMain(); // 关闭备忘录面板
        const file = app.vault.getAbstractFileByPath(item.linkedNote!);
        if (file) {
          const leaf = app.workspace.getLeaf();
          await leaf.openFile(file as any);
        } else {
          new Notice('关联笔记不存在');
        }
      };
      contentSpan.appendChild(link);
    }
    // 2. 检查是否有外部 URL（直接使用 item.url）
    else if (item.url) {
      const link = document.createElement('a');
      link.href = item.url;
      link.textContent = item.title; // 使用存储的显示文本
      (link as any).target = 'blank';
      link.style.cssText = 'color:var(--text-accent);text-decoration:underline;cursor:pointer;word-break:break-word;';
      link.onclick = (e) => {
        e.preventDefault();
        UIManager.hideMain(); // 关闭备忘录面板
        try {
          (app as any).openUrl(item.url);
        } catch {
          // 桌面端 Electron 兜底
          const electron = (window as any).require && (window as any).require('electron');
          if (electron && electron.shell) electron.shell.openExternal(item.url);
        }
      };
      contentSpan.appendChild(link);
    }
    // 3. 纯文本（无链接）
    else {
      contentSpan.textContent = item.title;
    }
    card.appendChild(contentSpan);

    // ---------- meta 信息（场景、时间、位置等） ----------
    const meta = document.createElement('div');
    meta.className = 'todo-meta-container';
    meta.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

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

    card.appendChild(meta);

    return card;
  },

  createCourseTag(item: MemoItem): HTMLElement {
    const app = getApp();
    const displayName = item.courseName!.replace(/^《|》$/g, '');
    const tag = document.createElement('span');
    tag.textContent = `🎓 ${displayName}`;
    Object.assign(tag.style, {
      padding: '0 8px',
      borderRadius: '12px',
      fontSize: '11px',
      background: 'var(--background-secondary)',
      color: 'var(--text-muted)',
      lineHeight: '20px',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      transition: 'background 0.2s',
    });
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
        tag.style.cursor = 'not-allowed';
        tag.onclick = null;
      }
    }
    return tag;
  },

  createScriptTag(name: string): HTMLElement {
    const tag = document.createElement('span');
    tag.textContent = `💻 ${name}`;
    Object.assign(tag.style, {
      padding: '0 8px',
      borderRadius: '12px',
      fontSize: '11px',
      background: 'var(--background-secondary)',
      color: 'var(--text-muted)',
      lineHeight: '20px',
      whiteSpace: 'nowrap',
    });
    return tag;
  },

  createPlatformTag(url: string, platform: string): HTMLElement {
    const container = document.createElement('span');
    container.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:12px;font-size:11px;background:var(--background-secondary);color:var(--text-muted);line-height:20px;white-space:nowrap;';
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
      tag.textContent = `⚠️ ${base.replace(/^《|》$/g, '')}`;
      tag.style.cssText =
        'padding:0 8px;border-radius:12px;font-size:11px;background:var(--background-secondary);color:var(--text-error);line-height:20px;white-space:nowrap;';
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
    tag.textContent = label;
    tag.style.cssText =
      'padding:0 8px;border-radius:12px;font-size:11px;background:var(--background-secondary);color:var(--text-muted);line-height:20px;white-space:nowrap;cursor:pointer;transition:background 0.2s;';
    tag.onclick = async (e) => {
      e.stopPropagation();
      UIManager.hideMain();
      const leaf = app.workspace.getLeaf();
      App.state.remindedFiles.add(item.notePath!);
      await leaf.openFile(file as any);
      const editor = (leaf as any).view?.editor;
      if (editor) {
        const { line, ch } = item.notePosition!;
        editor.focus();
        editor.setCursor(line, ch || 0);
        editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
      }
    };
    return tag;
  },

  // 长按事件（兼容移动端）
  createSceneTag(item: MemoItem): HTMLElement {
    const span = document.createElement('span');
    span.textContent = `#${item.scene}`;
    const isImportant = item.priority === 'important';
    span.style.cssText = `padding:2px 8px;border-radius:12px;font-size:12px;background:${isImportant ? '#ff4757' : 'var(--background-secondary)'};color:${isImportant ? 'white' : 'var(--text-muted)'};white-space:nowrap;cursor:pointer;`;

    let timer: any = null;
    let isTouching = false;

    const startLongPress = (e: any) => {
      if (e.button !== undefined && e.button !== 0) return; // 仅左键
      e.stopPropagation();
      // 阻止默认行为防止滚动或上下文菜单
      e.preventDefault();
      timer = setTimeout(() => {
        UIManager.showAddDialog(item);
        timer = null;
      }, 500);
    };

    const cancelLongPress = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    // 鼠标事件
    span.addEventListener('mousedown', startLongPress);
    span.addEventListener('mouseup', cancelLongPress);
    span.addEventListener('mouseleave', cancelLongPress);
    // 触摸事件（移动端）
    span.addEventListener('touchstart', (e) => {
      // 阻止 mouse 事件后续触发
      e.preventDefault();
      isTouching = true;
      startLongPress(e);
    });
    span.addEventListener('touchend', () => {
      isTouching = false;
      cancelLongPress();
    });
    span.addEventListener('touchmove', () => {
      if (isTouching) {
        cancelLongPress();
      }
    });

    return span;
  },

  createTimeTag(item: MemoItem): HTMLElement {
    const span = document.createElement('span');
    span.textContent = formatRelativeTime(item.created);
    span.style.cssText = 'font-size:12px;color:var(--text-faint);flex-shrink:0;cursor:pointer;';

    let timer: any = null;
    let isTouching = false;

    const startLongPress = (e: any) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      timer = setTimeout(() => {
        UIManager.showConfirm('删除备忘录', item.title, async () => {
          await DataManager.deleteItem(item.id);
          App.refresh();
        });
        timer = null;
      }, 500);
    };

    const cancelLongPress = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    span.addEventListener('mousedown', startLongPress);
    span.addEventListener('mouseup', cancelLongPress);
    span.addEventListener('mouseleave', cancelLongPress);
    span.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isTouching = true;
      startLongPress(e);
    });
    span.addEventListener('touchend', () => {
      isTouching = false;
      cancelLongPress();
    });
    span.addEventListener('touchmove', () => {
      if (isTouching) {
        cancelLongPress();
      }
    });

    return span;
  },

  createDueTag(item: MemoItem): HTMLElement {
    const status = getDueStatus(item.due);
    const span = document.createElement('span');
    span.textContent = `${status === 'overdue' ? '🔴' : status === 'today' ? '⚠️' : '📅'} ${formatDueText(item.due!)}`;
    let bgColor: string, fgColor: string;
    if (status === 'overdue') {
      bgColor = 'rgba(255,71,87,0.12)';
      fgColor = 'var(--text-error)';
    } else if (status === 'today') {
      bgColor = 'rgba(255,159,67,0.12)';
      fgColor = '#ff9f43';
    } else {
      bgColor = 'var(--background-secondary)';
      fgColor = 'var(--text-muted)';
    }
    span.style.cssText = `padding:0 8px;border-radius:12px;font-size:11px;background:${bgColor};color:${fgColor};line-height:20px;white-space:nowrap;`;
    return span;
  },
};

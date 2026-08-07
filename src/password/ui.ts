/**
 * 密码本 UI（密码本.js UIManager + PasswordAppController 逐字移植）
 * DOM id/类名与源码一致：pw-mask/pw-popup/pw-entries-container/pw-add-mask/
 * pw-add-popup/pw-add-* / pw-entry-card / pw-search-container / pw-suggestions。
 * 主密码流程：首次设置（再次输入确认）→ 解锁 → 加密驱动（showPasswordDialog）。
 */
import { Notice } from 'obsidian';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { confirm } from '../core/confirm';
import { createIconBtn, injectStyles } from '../core/dom';
import { formatRelativeTime } from '../core/utils';
import { DataManager, type PasswordEntry } from './data';

const PW_STYLES = `
    #pw-mask { backdrop-filter: blur(2px); }
    #pw-popup { animation: slideUp 0.3s ease-out; }
    @keyframes slideUp {
        from { opacity:0; transform: translate(-50%, -40%); }
        to { opacity:1; transform: translate(-50%, -50%); }
    }
    #pw-entries-container::-webkit-scrollbar { width: 6px; }
    #pw-entries-container::-webkit-scrollbar-thumb { background: var(--background-modifier-border); border-radius: 4px; }

    .pw-search-container {
        padding: 0 24px 12px 24px;
        display: none;
    }
    .pw-search-container input {
        width: 100%;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 14px;
        box-sizing: border-box;
    }

    .pw-entry-card {
        display: flex;
        flex-direction: column;
        padding: 10px 0;
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .pw-entry-top {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: nowrap;
    }
    .pw-account-wrapper {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 0 0 40%;
        max-width: 40%;
        overflow: hidden;
    }
    .pw-platform-link, .pw-platform-text {
        flex: 0 0 100px;
        font-weight: 600;
        font-size: 14px;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .pw-platform-link {
        color: var(--text-accent);
    }
    .pw-platform-link:hover {
        text-decoration: underline;
    }
    .pw-platform-text {
        color: var(--text-muted);
    }
    .pw-account {
        flex: 1;
        font-size: 14px;
        color: var(--text-normal);
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .pw-password-area {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        min-width: 0;
        cursor: pointer;
    }
    .pw-password-text {
        font-family: monospace;
        cursor: pointer;
        color: var(--text-muted);
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .pw-eye {
        cursor: pointer;
        font-size: 14px;
        user-select: none;
        opacity: 0.6;
        flex-shrink: 0;
    }
    .pw-date {
        font-size: 12px;
        color: var(--text-faint);
        flex: 0 0 auto;
        white-space: nowrap;
        cursor: pointer;
    }
    .pw-note {
        margin-top: 4px;
        font-size: 13px;
        color: var(--text-muted);
        padding: 10px 0;
        cursor: pointer;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .pw-note.hidden {
        color: transparent;
        background: repeating-linear-gradient(45deg, var(--background-modifier-border) 0px, var(--background-modifier-border) 2px, transparent 2px, transparent 4px);
        border-radius: 4px;
        padding: 10px 0;
        min-height: 1.2em;
    }

    .pw-add-dialog input, .pw-add-dialog textarea {
        width: 100%;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
        margin-bottom: 12px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-normal);
    }
    .pw-add-dialog textarea {
        resize: vertical;
        min-height: 60px;
    }
    .pw-generate-btn {
        padding: 4px 12px;
        border-radius: 16px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        cursor: pointer;
        font-size: 13px;
        margin-left: 8px;
    }
    .pw-generate-btn:hover {
        opacity: 0.8;
    }
    .pw-suggestions {
        max-height: 120px;
        overflow-y: auto;
        background: var(--background-secondary);
        border-radius: 4px;
        margin-top: -8px;
        margin-bottom: 12px;
        display: none;
        border: 1px solid var(--background-modifier-border);
    }
    .pw-suggestions .suggestion-item {
        padding: 6px 12px;
        cursor: pointer;
        font-size: 14px;
    }
    .pw-suggestions .suggestion-item:hover {
        background: var(--background-modifier-hover);
    }

    @media (max-width: 768px) {
        .pw-entry-top {
            flex-wrap: wrap;
        }
        .pw-account-wrapper {
            flex: 0 0 100%;
            max-width: 100%;
        }
        .pw-platform-link, .pw-platform-text {
            flex: 0 0 80px;
        }
        .pw-password-area {
            flex: 0 0 100%;
            min-width: 0;
        }
        .pw-date {
            margin-left: auto;
        }
    }
`;

interface UIConfig {
  charset: string;
  length: string;
  securityMode: boolean;
}

export class UIManager {
  dataManager: DataManager;
  config: UIConfig;
  // DOM 元素
  mask: HTMLDivElement | null = null;
  popup: HTMLDivElement | null = null;
  entriesContainer: HTMLDivElement | null = null;
  searchInput: HTMLInputElement | null = null;
  searchContainer: HTMLDivElement | null = null;
  addMask: HTMLDivElement | null = null;
  addPopup: HTMLDivElement | null = null;
  confirmMask: HTMLDivElement | null = null;
  confirmPopup: HTMLDivElement | null = null;
  confirmTitleEl: HTMLElement | null = null;
  confirmMessageEl: HTMLElement | null = null;
  confirmBtn: HTMLButtonElement | null = null;
  confirmCallback: (() => void) | null = null;
  // 状态
  editingId: string | null = null;
  searchKeyword = '';
  pendingPassword: string | null = null;
  // 内部标志
  _initialized = false;
  // 添加弹窗引用
  _addTitle!: HTMLElement;
  _platformInput!: HTMLInputElement;
  _urlInput!: HTMLInputElement;
  _accountInput!: HTMLInputElement;
  _passwordInput!: HTMLInputElement;
  _noteTextarea!: HTMLTextAreaElement;
  _platformSuggest!: HTMLDivElement;
  _accountSuggest!: HTMLDivElement;

  constructor(dataManager: DataManager, config: UIConfig) {
    this.dataManager = dataManager;
    this.config = config;
  }

  // ---------- 样式注入 ----------
  injectStyles() {
    injectStyles('pw-styles', PW_STYLES);
  }

  // ---------- 创建 DOM ----------
  ensureElements() {
    if (this._initialized) return;
    this.injectStyles();

    // 主遮罩和弹出
    this.mask = this.createMask('pw-mask');
    this.popup = this.createPopup();
    if (window.innerWidth <= 768) {
      this.popup.style.top = '0';
      this.popup.style.left = '0';
      this.popup.style.transform = 'none';
      this.popup.style.width = '100%';
      this.popup.style.maxWidth = '100%';
      this.popup.style.maxHeight = '100vh';
      this.popup.style.height = '100vh';
      this.popup.style.borderRadius = '0';
      this.popup.style.paddingTop = '24px';
    }
    // 搜索容器
    this.searchContainer = document.createElement('div');
    this.searchContainer.className = 'pw-search-container';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = '搜索平台、账号、备注...';
    this.searchInput.addEventListener('input', (e) => {
      this.searchKeyword = (e.target as HTMLInputElement).value.trim();
      this.renderList();
    });
    this.searchContainer.appendChild(this.searchInput);

    this.entriesContainer = document.createElement('div');
    this.entriesContainer.id = 'pw-entries-container';
    this.entriesContainer.style.cssText = 'flex:1;overflow-y:auto;padding:0 20px;min-height:200px;';

    const header = this.createHeader();
    this.popup.appendChild(header);
    this.popup.appendChild(this.searchContainer);
    this.popup.appendChild(this.entriesContainer);
    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);

    // 添加对话框
    this.createAddDialog();
    // 确认对话框
    this.createConfirmDialog();

    // 注册全局ESC
    this.registerEscape();

    this._initialized = true;
  }

  createMask(id: string): HTMLDivElement {
    const mask = document.createElement('div');
    mask.id = id;
    mask.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:9998;display:none;';
    mask.onclick = () => this.hide();
    return mask;
  }

  createPopup(): HTMLDivElement {
    const popup = document.createElement('div');
    popup.id = 'pw-popup';
    popup.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:9999;width:90%;max-width:700px;max-height:80vh;display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;';
    return popup;
  }

  createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 24px 8px 24px;display:flex;justify-content:space-between;align-items:center;';
    const title = document.createElement('h3');
    title.textContent = '密码本';
    title.style.cssText = 'margin:0;font-size:18px;font-weight:600;color:var(--text-normal);';
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;gap:12px;';

    const addBtn = createIconBtn('✏️', '添加密码条目', () => this.openAddDialog());
    const searchBtn = createIconBtn('🔍', '搜索', () => {
      if (this.searchContainer) {
        const isVisible = this.searchContainer.style.display !== 'none';
        this.searchContainer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) this.searchInput!.focus();
        if (isVisible) {
          this.searchKeyword = '';
          this.searchInput!.value = '';
          this.renderList();
        }
      }
    });
    const refreshBtn = createIconBtn('⏳', '刷新列表', () => {
      if (this.dataManager.unlocked) {
        this.dataManager
          .load()
          .then(() => this.renderList())
          .catch((e) => new Notice('刷新失败: ' + e.message));
      }
    });
    const closeBtn = createIconBtn('❌', '关闭', () => this.hide());

    btnContainer.appendChild(addBtn);
    btnContainer.appendChild(searchBtn);
    btnContainer.appendChild(refreshBtn);
    btnContainer.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(btnContainer);
    return header;
  }

  // ---------- 主面板显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    this.renderList();
  }

  hide() {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
    if (this.config.securityMode) {
      this.dataManager.lock();
      new Notice('安全模式：已自动上锁');
    }
  }

  // ---------- 渲染列表 ----------
  async renderList() {
    if (!this.entriesContainer) return;
    this.entriesContainer.innerHTML = '';
    try {
      // 重新加载数据以确保最新
      if (this.dataManager.unlocked) {
        await this.dataManager.load();
      }
    } catch (e: any) {
      new Notice('加载数据失败: ' + e.message);
      return;
    }

    let data = this.dataManager.pwData;
    if (this.searchKeyword) {
      data = this.dataManager.search(this.searchKeyword);
    }

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = this.searchKeyword ? '没有匹配的条目' : '没有密码条目，点击 ✏️ 添加';
      empty.style.cssText = 'padding:40px;text-align:center;color:var(--text-faint);font-size:16px;';
      this.entriesContainer.appendChild(empty);
      return;
    }

    const sorted = [...data].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
    for (const item of sorted) {
      const card = this.createCard(item);
      this.entriesContainer.appendChild(card);
    }
  }

  createCard(item: PasswordEntry): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'pw-entry-card';

    const top = document.createElement('div');
    top.className = 'pw-entry-top';

    // 账号与平台
    const accountWrapper = document.createElement('div');
    accountWrapper.className = 'pw-account-wrapper';

    if (item.platform) {
      if (item.url) {
        const link = document.createElement('a');
        link.className = 'pw-platform-link';
        link.href = item.url;
        (link as any).target = '_blank';
        link.textContent = item.platform;
        link.onclick = (e) => e.stopPropagation();
        accountWrapper.appendChild(link);
      } else {
        const span = document.createElement('span');
        span.className = 'pw-platform-text';
        span.textContent = item.platform;
        accountWrapper.appendChild(span);
      }
    }

    const accountSpan = document.createElement('span');
    accountSpan.className = 'pw-account';
    accountSpan.textContent = item.account || '(无账号)';
    accountSpan.onclick = (e) => {
      e.stopPropagation();
      if (item.account) {
        navigator.clipboard.writeText(item.account);
        new Notice('账号已复制');
      }
    };
    accountWrapper.appendChild(accountSpan);
    top.appendChild(accountWrapper);

    // 密码区域
    const passwordArea = document.createElement('div');
    passwordArea.className = 'pw-password-area';
    const passwordSpan = document.createElement('span');
    passwordSpan.className = 'pw-password-text';
    let showPassword = false;
    let noteSpan: HTMLDivElement | null = null;
    const updateDisplay = () => {
      if (showPassword) {
        passwordSpan.textContent = item.password || '';
      } else {
        passwordSpan.textContent = '•'.repeat(Math.min(item.password?.length || 8, 20));
      }
    };
    updateDisplay();

    passwordSpan.onclick = (e) => {
      e.stopPropagation();
      if (item.password) {
        navigator.clipboard.writeText(item.password);
        new Notice('密码已复制');
      }
    };

    const eyeSpan = document.createElement('span');
    eyeSpan.className = 'pw-eye';
    eyeSpan.textContent = '👁';
    eyeSpan.onclick = (e) => {
      e.stopPropagation();
      showPassword = !showPassword;
      updateDisplay();
      // 如果备注存在，同步显示/隐藏
      if (noteSpan) {
        if (showPassword) {
          noteSpan.classList.remove('hidden');
          noteSpan.textContent = item.note || '';
        } else {
          noteSpan.classList.add('hidden');
          noteSpan.textContent = item.note || '(备注隐藏)';
        }
      }
    };

    passwordArea.appendChild(passwordSpan);
    passwordArea.appendChild(eyeSpan);
    top.appendChild(passwordArea);

    // 日期
    const dateSpan = document.createElement('span');
    dateSpan.className = 'pw-date';
    dateSpan.textContent = formatRelativeTime(item.createdAt);
    // 长按删除
    let pressTimer: any = null;
    const startPress = () => {
      pressTimer = setTimeout(() => {
        this.showConfirm('删除密码条目', `确定删除账号 "${item.account}" 吗？`, async () => {
          try {
            await this.dataManager.deleteItem(item.id);
            await this.renderList();
            new Notice('已删除');
          } catch (e: any) {
            new Notice('删除失败: ' + e.message);
          }
        });
      }, 500);
    };
    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    dateSpan.addEventListener('mousedown', startPress);
    dateSpan.addEventListener('mouseup', cancelPress);
    dateSpan.addEventListener('mouseleave', cancelPress);
    dateSpan.addEventListener('touchstart', startPress);
    dateSpan.addEventListener('touchend', cancelPress);
    dateSpan.addEventListener('touchmove', cancelPress);

    top.appendChild(dateSpan);
    card.appendChild(top);

    // 备注
    if (item.note) {
      noteSpan = document.createElement('div');
      noteSpan.className = 'pw-note hidden';
      noteSpan.textContent = item.note || '(备注隐藏)';
      // 长按编辑
      let pressTimerNote: any = null;
      const startPressNote = () => {
        pressTimerNote = setTimeout(() => {
          this.openAddDialog(item);
        }, 500);
      };
      const cancelPressNote = () => {
        if (pressTimerNote) {
          clearTimeout(pressTimerNote);
          pressTimerNote = null;
        }
      };
      noteSpan.addEventListener('mousedown', startPressNote);
      noteSpan.addEventListener('mouseup', cancelPressNote);
      noteSpan.addEventListener('mouseleave', cancelPressNote);
      noteSpan.addEventListener('touchstart', startPressNote);
      noteSpan.addEventListener('touchend', cancelPressNote);
      noteSpan.addEventListener('touchmove', cancelPressNote);
      card.appendChild(noteSpan);
    }

    // 长按密码区域编辑
    let pressTimerPw: any = null;
    const startPressPw = () => {
      pressTimerPw = setTimeout(() => {
        this.openAddDialog(item);
      }, 500);
    };
    const cancelPressPw = () => {
      if (pressTimerPw) {
        clearTimeout(pressTimerPw);
        pressTimerPw = null;
      }
    };
    passwordArea.addEventListener('mousedown', startPressPw);
    passwordArea.addEventListener('mouseup', cancelPressPw);
    passwordArea.addEventListener('mouseleave', cancelPressPw);
    passwordArea.addEventListener('touchstart', startPressPw);
    passwordArea.addEventListener('touchend', cancelPressPw);
    passwordArea.addEventListener('touchmove', cancelPressPw);

    return card;
  }

  // ---------- 添加/编辑对话框 ----------
  createAddDialog() {
    if (this.addMask && this.addPopup) return;
    // 移除旧元素避免重复
    const oldMask = document.getElementById('pw-add-mask');
    if (oldMask) oldMask.remove();
    const oldPopup = document.getElementById('pw-add-popup');
    if (oldPopup) oldPopup.remove();

    this.addMask = document.createElement('div');
    this.addMask.id = 'pw-add-mask';
    this.addMask.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10001;display:none;';
    this.addMask.onclick = (e) => {
      if (e.target === this.addMask) this.closeAddDialog();
    };

    this.addPopup = document.createElement('div');
    this.addPopup.id = 'pw-add-popup';
    this.addPopup.className = 'pw-add-dialog';
    this.addPopup.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10002;padding:24px;max-width:420px;width:90%;display:none;';

    const title = document.createElement('h4');
    title.id = 'pw-add-title';
    title.textContent = '添加密码条目';
    title.style.cssText = 'margin:0 0 16px 0;font-size:18px;font-weight:600;color:var(--text-normal);';

    // 平台
    const platformWrapper = this.createSuggestionWrapper('platform', '平台（必填，如 GitHub）');
    const urlInput = this.createInput('url', 'url', '链接（可选）');
    const accountWrapper = this.createSuggestionWrapper('account', '账号');
    const passwordWrapper = this.createPasswordWrapper();
    const noteTextarea = this.createTextarea('备注（可选）');

    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText =
      'padding:8px 16px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;box-shadow:none;';
    cancelBtn.onclick = () => this.closeAddDialog();
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.style.cssText =
      'padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:14px;font-weight:500;box-shadow:none;';
    saveBtn.onclick = async () => {
      const platform = platformWrapper.input.value.trim();
      const url = urlInput.value.trim();
      const account = accountWrapper.input.value.trim();
      const password = passwordWrapper.input.value.trim();
      const note = noteTextarea.value.trim();

      if (!platform) {
        new Notice('平台不能为空');
        platformWrapper.input.focus();
        return;
      }
      if (!account || !password) {
        new Notice('账号和密码不能为空');
        return;
      }
      try {
        if (this.editingId) {
          await this.dataManager.updateItem(this.editingId, { platform, url, account, password, note });
        } else {
          await this.dataManager.addItem({ platform, url, account, password, note });
        }
        await this.renderList();
        this.closeAddDialog();
        new Notice('保存成功');
      } catch (e: any) {
        new Notice('保存失败: ' + e.message);
      }
    };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(saveBtn);

    this.addPopup.appendChild(title);
    this.addPopup.appendChild(platformWrapper.container);
    this.addPopup.appendChild(urlInput);
    this.addPopup.appendChild(accountWrapper.container);
    this.addPopup.appendChild(passwordWrapper.container);
    this.addPopup.appendChild(noteTextarea);
    this.addPopup.appendChild(btnContainer);

    this.addMask.appendChild(this.addPopup);
    document.body.appendChild(this.addMask);

    // 存储引用以便后续填充
    this._addTitle = title;
    this._platformInput = platformWrapper.input;
    this._urlInput = urlInput;
    this._accountInput = accountWrapper.input;
    this._passwordInput = passwordWrapper.input;
    this._noteTextarea = noteTextarea;
    this._platformSuggest = platformWrapper.suggest;
    this._accountSuggest = accountWrapper.suggest;
  }

  createSuggestionWrapper(field: string, placeholder: string) {
    const container = document.createElement('div');
    container.style.cssText = 'position:relative;margin-bottom:12px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.style.cssText =
      'width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);';
    const suggest = document.createElement('div');
    suggest.className = 'pw-suggestions';
    container.appendChild(input);
    container.appendChild(suggest);

    const showSuggest = () => {
      const suggestions = this.getSuggestions(field);
      suggest.innerHTML = '';
      if (suggestions.length === 0) {
        suggest.style.display = 'none';
        return;
      }
      suggestions.forEach((val) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = val;
        item.onmousedown = (e) => {
          e.preventDefault();
          input.value = val;
          suggest.style.display = 'none';
          input.dispatchEvent(new Event('input'));
        };
        suggest.appendChild(item);
      });
      suggest.style.display = 'block';
    };

    input.addEventListener('focus', showSuggest);
    input.addEventListener('input', showSuggest);
    input.addEventListener('blur', () => {
      setTimeout(() => {
        suggest.style.display = 'none';
      }, 200);
    });

    return { container, input, suggest };
  }

  createInput(id: string, type: string, placeholder: string): HTMLInputElement {
    const input = document.createElement('input');
    input.id = `pw-add-${id}`;
    input.type = type;
    input.placeholder = placeholder;
    input.style.cssText =
      'width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:12px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);';
    return input;
  }

  createPasswordWrapper() {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '密码';
    input.style.cssText =
      'flex:1;padding:8px 12px;border-radius:6px;font-size:14px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);';
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.className = 'pw-generate-btn';
    genBtn.textContent = '生成';
    genBtn.title = '随机生成密码';
    genBtn.onclick = () => {
      input.value = this.generatePassword();
    };
    container.appendChild(input);
    container.appendChild(genBtn);
    return { container, input };
  }

  createTextarea(placeholder: string): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.placeholder = placeholder;
    textarea.style.cssText =
      'width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:16px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);min-height:60px;resize:vertical;';
    return textarea;
  }

  getSuggestions(field: string): string[] {
    const freq: Record<string, number> = {};
    this.dataManager.pwData.forEach((item: any) => {
      const val = item[field]?.trim();
      if (val) freq[val] = (freq[val] || 0) + 1;
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([val]) => val);
  }

  openAddDialog(editItem: PasswordEntry | null = null) {
    if (!this.dataManager.unlocked) {
      new Notice('请先解锁密码本');
      return;
    }
    if (!this.addMask) this.createAddDialog();
    this.editingId = editItem ? editItem.id : null;
    if (editItem) {
      this._addTitle.textContent = '编辑密码条目';
      this._platformInput.value = editItem.platform || '';
      this._urlInput.value = editItem.url || '';
      this._accountInput.value = editItem.account || '';
      this._passwordInput.value = editItem.password || '';
      this._noteTextarea.value = editItem.note || '';
    } else {
      this._addTitle.textContent = '添加密码条目';
      this._platformInput.value = '';
      this._urlInput.value = '';
      this._accountInput.value = '';
      this._noteTextarea.value = '';
      // 使用暂存密码或生成新密码
      let pwd = this.pendingPassword || this.generatePassword();
      this._passwordInput.value = pwd;
      this.pendingPassword = null;
    }
    this.addMask!.style.display = 'block';
    this.addPopup!.style.display = 'block';
    this._platformInput.focus();
    // 隐藏建议
    document.querySelectorAll('.pw-suggestions').forEach((el) => ((el as HTMLElement).style.display = 'none'));
  }

  closeAddDialog() {
    if (this.addMask) this.addMask.style.display = 'none';
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.editingId = null;
    this.pendingPassword = null;
  }

  // ---------- 确认对话框（代理到 core confirm） ----------
  createConfirmDialog() {}
  showConfirm(title: string, message: string, onConfirm: () => void) {
    confirm({ title: title || '确认', message: message || '', onConfirm });
  }
  closeConfirm() {}

  // ---------- 密码输入对话框（解锁/首次设置） ----------
  showPasswordDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      const mask = document.createElement('div');
      mask.style.cssText =
        'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10005;display:flex;align-items:center;justify-content:center;';
      const box = document.createElement('div');
      box.style.cssText =
        'background:var(--background-primary);border-radius:12px;padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
      const title = document.createElement('h4');
      title.style.cssText = 'margin:0 0 12px 0;font-size:18px;font-weight:600;';
      const message = document.createElement('p');
      message.style.cssText = 'margin:0 0 16px 0;font-size:14px;color:var(--text-muted);';
      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = '输入主密码';
      input.style.cssText =
        'width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:12px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);';
      const input2 = document.createElement('input');
      input2.type = 'password';
      input2.placeholder = '再次输入';
      input2.style.cssText =
        'width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:16px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);display:none;';

      const warning = document.createElement('div');
      warning.style.cssText =
        'background:#ffecb0;color:#8a6d3b;padding:10px 12px;border-radius:6px;margin-bottom:16px;font-size:14px;border:1px solid #f5c842;display:none;';
      warning.innerHTML = `
                <strong>⚠️ 重要提醒</strong><br>
                • 主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>
                • 若遗忘密码，所有数据将永久丢失。<br>
                • 建议使用密码本（如 Bitwarden）保存此密码。
            `;

      const btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.style.cssText =
        'padding:8px 16px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;';
      cancelBtn.onclick = () => {
        document.body.removeChild(mask);
        resolve(false);
      };
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '确认';
      confirmBtn.style.cssText =
        'padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:14px;font-weight:500;';
      confirmBtn.onclick = async () => {
        const pw = input.value;
        if (!pw) {
          new Notice('请输入密码');
          return;
        }
        const fileExists = !!getApp().vault.getAbstractFileByPath(this.dataManager.filePath);
        if (!fileExists) {
          if (input2.style.display === 'none') {
            input2.style.display = 'block';
            input2.value = '';
            input2.focus();
            message.textContent = '请再次输入主密码确认';
            return;
          } else {
            if (pw !== input2.value) {
              new Notice('两次密码不一致');
              return;
            }
            try {
              await this.dataManager.unlock(pw);
              document.body.removeChild(mask);
              resolve(true);
              new Notice('密码已设置，数据已加密');
            } catch (e: any) {
              new Notice('设置失败: ' + e.message);
              resolve(false);
            }
            return;
          }
        } else {
          const success = await this.dataManager.unlock(pw);
          if (success) {
            document.body.removeChild(mask);
            resolve(true);
            new Notice('解锁成功');
          } else {
            new Notice('密码错误，请重试');
            input.value = '';
            input.focus();
          }
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmBtn.click();
      });
      input2.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmBtn.click();
      });

      btnContainer.appendChild(cancelBtn);
      btnContainer.appendChild(confirmBtn);
      box.appendChild(title);
      box.appendChild(warning);
      box.appendChild(message);
      box.appendChild(input);
      box.appendChild(input2);
      box.appendChild(btnContainer);
      mask.appendChild(box);
      document.body.appendChild(mask);

      // 检查文件是否存在
      (async () => {
        const fileExists = !!getApp().vault.getAbstractFileByPath(this.dataManager.filePath);
        if (fileExists) {
          title.textContent = '输入主密码';
          message.textContent = '请输入您设置的主密码以解锁密码本';
          input2.style.display = 'none';
          warning.style.display = 'none';
        } else {
          title.textContent = '设置主密码';
          message.textContent = '请设置一个主密码（用于加密所有数据）';
          input2.style.display = 'block';
          input2.placeholder = '再次输入';
          warning.style.display = 'block';
        }
        input.focus();
      })();
    });
  }

  // ---------- 密码生成 ----------
  generatePassword(): string {
    const length = parseInt(this.config.length) || 16;
    const charset =
      this.config.charset ||
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return pwd;
  }

  // ---------- ESC 处理 ----------
  registerEscape() {
    escManager.register('pw', {
      isVisible: () => !!(this.mask && this.mask.style.display === 'block'),
      close: () => {
        if (this.confirmMask && this.confirmMask.style.display === 'block') this.closeConfirm();
        else if (this.addMask && this.addMask.style.display === 'block') this.closeAddDialog();
        else if (this.mask && this.mask.style.display === 'block') this.hide();
      },
    });
  }
}

// ==================== Controller（命令入口；命令注册由 main.ts 管理） ====================

export class PasswordAppController {
  static instance: PasswordAppController | null = null;

  static getInstance(config: {
    storagePath: string;
    charset: string;
    length: string;
    securityMode: boolean;
  }): PasswordAppController {
    if (!PasswordAppController.instance) {
      PasswordAppController.instance = new PasswordAppController(config);
    }
    return PasswordAppController.instance;
  }

  storagePath: string;
  charset: string;
  length: string;
  securityMode: boolean;
  dataManager: DataManager;
  uiManager: UIManager;
  _initialized = false;

  constructor({ storagePath, charset, length, securityMode }: { storagePath: string; charset: string; length: string; securityMode: boolean }) {
    this.storagePath = storagePath;
    this.charset = charset;
    this.length = length;
    this.securityMode = securityMode;
    this.dataManager = new DataManager(storagePath);
    this.uiManager = new UIManager(this.dataManager, { charset, length, securityMode });
  }

  async init() {
    if (this._initialized) return;
    this.uiManager.ensureElements();
    this._initialized = true;
  }

  // 对外命令
  async openManager() {
    if (!this.dataManager.unlocked) {
      const result = await this.uiManager.showPasswordDialog();
      if (result) {
        this.uiManager.show();
      }
    } else {
      this.uiManager.show();
    }
  }

  addEntry() {
    if (!this.dataManager.unlocked) {
      new Notice('请先解锁密码本（打开管理器）');
      return;
    }
    this.uiManager.openAddDialog();
  }

  generatePassword() {
    const pwd = this.uiManager.generatePassword();
    navigator.clipboard
      .writeText(pwd)
      .then(() => {
        new Notice('密码已复制到剪贴板');
      })
      .catch(() => {
        new Notice('复制失败，请手动复制');
      });
    this.uiManager.pendingPassword = pwd;
    new Notice('密码已暂存，打开"添加条目"时将自动填入');
  }

  /** 卸载清理：移除注入 DOM */
  cleanup() {
    const ids = ['pw-mask', 'pw-popup', 'pw-add-mask', 'pw-add-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    this.uiManager.mask = null;
    this.uiManager.popup = null;
    this.uiManager.addMask = null;
    this.uiManager.addPopup = null;
    this.uiManager._initialized = false;
    this.dataManager.lock();
  }
}

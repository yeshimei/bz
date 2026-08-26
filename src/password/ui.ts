/**
 * 密码本 UI（密码本.js UIManager + PasswordAppController 逐字移植）
 * DOM id/类名与源码一致：pw-mask/pw-popup/pw-entries-container/pw-add-mask/
 * pw-add-popup/pw-add-* / pw-entry-card / pw-search-container / pw-suggestions。
 * 主密码流程：首次设置（再次输入确认）→ 解锁 → 加密驱动（showPasswordDialog）。
 * 统一抽屉（桌面右键/移动长按）：复制账号/复制密码/编辑/删除；卡片保留平台链接点击与 👁 显隐（用户拍板）。
 */
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { confirm } from '../core/confirm';
import { createIconBtn } from '../core/dom';
import {
  attachItemActions,
  registerSheetCompanion,
  unregisterSheetCompanion,
  closeItemMenu,
  type ItemAction,
} from '../core/item-actions';
import { formatRelativeTime } from '../core/utils';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { createSettingsGroup, openSettingsModal } from '../core/settings-modal';
import { ensureSafeUnlocked } from '../encrypt';
import { DataManager, type PasswordEntry } from './data';

interface UIConfig {
  charset: string;
  length: string;
  securityMode: boolean;
}

/**
 * 加密安全随机密码串（P2）：crypto.getRandomValues + 拒绝采样——
 * 旧实现 `Math.floor(Math.random() * len)` 有取模偏差且非加密安全源；
 * 拒绝采样只接受 `[0, LIMIT)` 均匀区间（LIMIT 为 2^32 内最大的 n 的整倍数），
 * 每个字符严格等概率，任意字符集长度都无偏差、不越界。
 */
export function secureRandomPassword(length: number, charset: string): string {
  const n = charset.length;
  if (!(length > 0) || n === 0) return '';
  const LIMIT = Math.floor(0x100000000 / n) * n;
  let pwd = '';
  while (pwd.length < length) {
    const buf = new Uint32Array(length - pwd.length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && pwd.length < length; i++) {
      if (buf[i] >= LIMIT) continue; // 超出均匀区间 → 该采样值丢弃重采
      pwd += charset.charAt(buf[i] % n);
    }
  }
  return pwd;
}

/** 敏感内容复制后自动清空剪贴板的延时（P2） */
const CLIPBOARD_CLEAR_DELAY_MS = 60_000;
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

/** 布防（或重置）60s 自动清空剪贴板计时；触发时写入空串覆盖敏感内容，失败静默（尽力而为） */
export function armClipboardClear(): void {
  if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
  clipboardClearTimer = setTimeout(() => {
    clipboardClearTimer = null;
    try {
      void navigator.clipboard.writeText('').catch(() => {
        /* 尽力而为 */
      });
    } catch (e) {
      /* 尽力而为：剪贴板 API 不可用时不打扰用户 */
    }
  }, CLIPBOARD_CLEAR_DELAY_MS);
}

/** 复制敏感内容：写入剪贴板成功后布防定时清空（P2）。
 *  clipboard API 缺失（非安全上下文/部分 WebView）时 writeText 会**同步抛 TypeError**，
 *  此处 try/catch 转成 rejected promise，保证调用方 .catch 始终能收到（对照 armClipboardClear 兜底先例）。
 */
export function copySensitiveText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text).then(() => armClipboardClear());
  } catch (e) {
    return Promise.reject(e);
  }
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
  // 状态
  editingId: string | null = null;
  searchKeyword = '';
  pendingPassword: string | null = null;
  /** 抽屉来源的编辑（保存成功后关抽屉，与收藏本/归物本同决策） */
  sheetEditPending = false;
  /** 搜索输入防抖计时器（ticket 43：快速连续输入只渲染最后一次，避免逐键整表 load/解密） */
  searchRenderTimer: ReturnType<typeof setTimeout> | null = null;
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

  // ---------- 创建 DOM ----------
  ensureElements() {
    if (this._initialized) return;

    // 主遮罩和弹出
    this.mask = this.createMask('pw-mask');
    this.popup = this.createPopup();
    // 搜索容器
    this.searchContainer = document.createElement('div');
    this.searchContainer.className = 'pw-search-container';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = '搜索平台、账号、备注...';
    this.searchInput.addEventListener('input', (e) => {
      this.searchKeyword = (e.target as HTMLInputElement).value.trim();
      this.scheduleSearchRender();
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
    header.className = 'bz-win-head';
    header.style.cssText = 'padding:16px 24px 8px 24px;display:flex;justify-content:space-between;align-items:center;';
    const title = document.createElement('h3');
    title.textContent = '密码本';
    title.style.cssText = 'margin:0;font-size:18px;font-weight:600;color:var(--text-normal);';
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;gap:8px;';

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
    // 密码本设置弹窗（ADR-0009 域设置弹窗；分组卡片重设计）
    const settingsBtn = createIconBtn('⚙️', '密码本设置', () => {
      // 以下配置项均为启动快照（控制器构造时读取），改动需重载插件后生效——首次改动即提示一次（ticket 55）
      let reloadWarned = false;
      const warnReload = () => {
        if (!reloadWarned) {
          reloadWarned = true;
          notice('密码本设置已保存，重载插件后生效', 'info');
        }
      };
      openSettingsModal({
        title: '密码本设置',
        maxWidth: 560,
        build: (el) => {
          const s = getSettings();
          // ===== 生成组：字符集 + 长度 =====
          const genGroup = createSettingsGroup(el, { icon: 'key-round', name: '生成' });
          new Setting(genGroup)
            .setName('密码生成字符集')
            .setDesc('随机生成密码时使用的字符集')
            .addText((text) =>
              text.setValue(s.passwordCharset || '').onChange(async (v) => {
                s.passwordCharset = v;
                await saveSettings();
                warnReload();
              })
            );
          new Setting(genGroup)
            .setName('密码生成长度')
            .setDesc('随机生成密码的字符个数')
            .addText((text) =>
              text.setValue(s.passwordLength || '').onChange(async (v) => {
                s.passwordLength = v;
                await saveSettings();
                warnReload();
              })
            );
          // ===== 安全组 =====
          const secureGroup = createSettingsGroup(el, { icon: 'shield', name: '安全' });
          new Setting(secureGroup)
            .setName('安全模式')
            .setDesc('关闭密码本窗口时立即上锁，保险箱同步锁定')
            .addToggle((toggle) =>
              toggle.setValue(!!s.securityMode).onChange(async (v) => {
                s.securityMode = v;
                await saveSettings();
                warnReload();
              })
            );
          // ===== 移动端组（仅移动端显示） =====
          if (isMobileEnv()) {
            const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
            new Setting(mobileGroup)
              .setName('移动端默认全屏')
              .setDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')
              .addToggle((toggle) =>
                toggle.setValue(!!s.passwordMobileDefaultFullscreen).onChange(async (v) => {
                  s.passwordMobileDefaultFullscreen = v;
                  await saveSettings();
                  warnReload();
                })
              );
          }
        },
      });
    });
    const closeBtn = createIconBtn('❌', '关闭', () => this.hide());

    btnContainer.appendChild(addBtn);
    btnContainer.appendChild(searchBtn);
    btnContainer.appendChild(settingsBtn);
    btnContainer.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(btnContainer);
    return header;
  }

  // ---------- 主面板显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
    // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
    applyMobileWindowFullscreen(this.popup, tryGetSettings().passwordMobileDefaultFullscreen === true);
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    this.renderList();
  }

  hide() {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
    if (this.config.securityMode) {
      this.dataManager.lock();
      notice('安全模式：已自动上锁');
    }
  }

  // ---------- 渲染列表 ----------
  /** 搜索输入防抖（ticket 43）：180ms 内连续键入只渲染最后一次，逐键不作整表 load/解密 */
  private scheduleSearchRender() {
    if (this.searchRenderTimer !== null) clearTimeout(this.searchRenderTimer);
    this.searchRenderTimer = setTimeout(() => {
      this.searchRenderTimer = null;
      void this.renderList();
    }, 180);
  }

  async renderList() {
    if (!this.entriesContainer) return;
    this.entriesContainer.innerHTML = '';
    try {
      // 重新加载数据以确保最新
      if (this.dataManager.unlocked) {
        await this.dataManager.load();
      }
    } catch (e: any) {
      notice('加载数据失败：' + e.message, 'error');
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
    // 复制账号收敛进抽屉动作（用户拍板）；卡片仅展示
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

    // 复制密码收敛进抽屉动作（用户拍板）；卡片仅展示（👁 显隐保留）

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
    // 删除收敛进抽屉动作（用户拍板）

    top.appendChild(dateSpan);
    card.appendChild(top);

    // 备注
    if (item.note) {
      noteSpan = document.createElement('div');
      noteSpan.className = 'pw-note hidden';
      noteSpan.textContent = item.note || '(备注隐藏)';
      card.appendChild(noteSpan);
    }

    // 统一抽屉（桌面右键/移动长按）：复制账号 → 复制密码 → 编辑 → 删除
    this.attachDrawerActions(card, item);

    return card;
  }

  /** 卡片挂统一抽屉 + 头部（平台/账号 · 创建时间） */
  private attachDrawerActions(card: HTMLDivElement, item: PasswordEntry): void {
    const actions: ItemAction[] = [];

    actions.push({
      icon: 'copy',
      label: '复制账号',
      onClick: () => {
        if (item.account) {
          copySensitiveText(item.account) // 复制后 60s 尽力清空剪贴板（P2）
            .then(() => notice('账号已复制', 'success'))
            .catch(() => notice('复制失败，请手动复制', 'error')); // 与 generatePassword 复制失败同口径（ticket 4）
        }
      },
    });

    actions.push({
      icon: 'key',
      label: '复制密码',
      onClick: () => {
        if (item.password) {
          copySensitiveText(item.password) // 复制后 60s 尽力清空剪贴板（P2）
            .then(() => notice('密码已复制', 'success'))
            .catch(() => notice('复制失败，请手动复制', 'error')); // 与 generatePassword 复制失败同口径（ticket 4）
        }
      },
    });

    // 编辑（keepOpen：编辑弹窗叠抽屉；保存后关抽屉）
    actions.push({
      icon: 'pencil',
      label: '编辑',
      keepOpen: true,
      onClick: () => {
        this.sheetEditPending = true;
        this.openAddDialog(item);
      },
    });

    // 删除（danger：先收抽屉再确认）
    actions.push({
      icon: 'trash-2',
      label: '删除',
      kind: 'danger',
      onClick: () => {
        this.showConfirm('删除密码条目', `确定删除账号 "${item.account}" 吗？`, async () => {
          try {
            await this.dataManager.deleteItem(item.id);
            await this.renderList();
            notice('已删除', 'success');
          } catch (e: any) {
            notice('删除失败：' + e.message, 'error');
          }
        });
      },
    });

    attachItemActions(card, actions, { sheetHead: this.buildSheetHead(item) });
  }

  /** 抽屉头部：平台名 + 账号；小字=创建时间 */
  private buildSheetHead(item: PasswordEntry): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';

    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔑';
    body.appendChild(emoji);

    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';
    const title = document.createElement('div');
    title.className = 'bz-item-sheet-title';
    title.textContent = item.platform || item.account || '密码条目';
    info.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'bz-item-sheet-sub';
    sub.textContent = `${item.account || ''}${item.account ? ' · ' : ''}${formatRelativeTime(item.createdAt)}`;
    info.appendChild(sub);

    body.appendChild(info);
    head.appendChild(body);
    return head;
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
        notice('平台不能为空');
        platformWrapper.input.focus();
        return;
      }
      if (!account || !password) {
        notice('账号和密码不能为空');
        return;
      }
      try {
        if (this.editingId) {
          await this.dataManager.updateItem(this.editingId, { platform, url, account, password, note });
        } else {
          await this.dataManager.addItem({ platform, url, account, password, note });
        }
        await this.renderList();
        // 抽屉来源的编辑：保存成功后关抽屉（用户拍板）
        const fromSheet = this.sheetEditPending;
        this.closeAddDialog();
        if (fromSheet) closeItemMenu();
        notice('已保存', 'success');
      } catch (e: any) {
        notice('保存失败：' + e.message, 'error');
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
      notice('请先解锁密码本');
      return;
    }
    if (!this.addMask) this.createAddDialog();
    // 抽屉来源的编辑：注册附属浮层（弹窗内点击不误关抽屉）
    if (this.sheetEditPending) registerSheetCompanion(this.addMask!);
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
    // 抽屉编辑标志清理 + 注销附属浮层（取消/遮罩/ESC 路径，抽屉保持）
    if (this.sheetEditPending && this.addMask) {
      this.sheetEditPending = false;
      unregisterSheetCompanion(this.addMask);
    }
  }

  // ---------- 确认（代理到 core confirm） ----------
  showConfirm(title: string, message: string, onConfirm: () => void) {
    confirm({ title: title || '确认', message: message || '', onConfirm });
  }

  // ---------- 解锁（统一走保险箱主密码弹窗：共享同一解锁态，不再自绘） ----------
  showPasswordDialog(): Promise<boolean> {
    return ensureSafeUnlocked();
  }

  // ---------- 密码生成 ----------
  generatePassword(): string {
    const length = parseInt(this.config.length) || 16;
    const charset =
      this.config.charset ||
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';
    return secureRandomPassword(length, charset); // 加密安全随机 + 拒绝采样（P2）
  }

  // ---------- ESC 处理 ----------
  registerEscape() {
    escManager.register('pw', {
      isVisible: () => !!(this.mask && this.mask.style.display === 'block'),
      close: () => {
        if (this.addMask && this.addMask.style.display === 'block') this.closeAddDialog();
        else if (this.mask && this.mask.style.display === 'block') this.hide();
      },
    });
  }
}

// ==================== Controller（命令入口；命令注册由 main.ts 管理） ====================

export class PasswordAppController {
  static instance: PasswordAppController | null = null;

  static getInstance(config: {
    charset: string;
    length: string;
    securityMode: boolean;
  }): PasswordAppController {
    if (!PasswordAppController.instance) {
      PasswordAppController.instance = new PasswordAppController(config);
    }
    return PasswordAppController.instance;
  }

  charset: string;
  length: string;
  securityMode: boolean;
  dataManager: DataManager;
  uiManager: UIManager;
  _initialized = false;

  constructor({ charset, length, securityMode }: { charset: string; length: string; securityMode: boolean }) {
    this.charset = charset;
    this.length = length;
    this.securityMode = securityMode;
    this.dataManager = new DataManager();
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
      notice('请先解锁密码本（打开管理器）');
      return;
    }
    this.uiManager.openAddDialog();
  }

  generatePassword() {
    const pwd = this.uiManager.generatePassword();
    navigator.clipboard
      .writeText(pwd)
      .then(() => {
        armClipboardClear(); // 复制后 60s 尽力清空剪贴板（P2）
        notice('密码已复制到剪贴板', 'success');
      })
      .catch(() => {
        notice('复制失败，请手动复制', 'error');
      });
    this.uiManager.pendingPassword = pwd;
    notice('密码已暂存，打开“添加条目”时将自动填入');
  }

  /** 卸载清理：移除注入 DOM；取消剪贴板自动清空与搜索防抖计时（l2-pw/ticket 43 残留定时器） */
  cleanup() {
    if (clipboardClearTimer !== null) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }
    if (this.uiManager.searchRenderTimer !== null) {
      clearTimeout(this.uiManager.searchRenderTimer);
      this.uiManager.searchRenderTimer = null;
    }
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

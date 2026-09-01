/**
 * 密码本 UI — Route C 平台聚合（v1-vault 1Password 风格）
 *
 * 三层布局：
 *   桌面（≥769px）：左导航 → 中平台列表 → 右详情面板
 *   移动（≤768px）：卡片列表 → 详情页（push/pop）
 *
 * 条目按 platform 聚合：同平台多账号显示为一行 + 计数徽标，点击展开看全部账号。
 * 保持既有公共 API：PasswordAppController / ensureElements / openManager / addEntry / generatePassword / cleanup。
 */
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { openFlowDialog } from '../core/flow-dialog';
import { createIconBtn, topifyZ } from '../core/dom';
import {
  attachItemActions,
  registerSheetCompanion,
  unregisterSheetCompanion,
  closeItemMenu,
  type ItemAction,
} from '../core/item-actions';
import { formatRelativeTime } from '../core/utils';
import { tryGetSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup, makeReloadWarnOnce, numStrBinding } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { ensureSafeUnlocked } from '../encrypt';
import { DataManager, type PasswordEntry } from './data';
import { setIcon } from 'obsidian';
import { isMobileEnv } from '../core/mobile';

// ==================== 密码生成 & 剪贴板安全 ====================

interface UIConfig {
  charset: string;
  length: string;
  securityMode: boolean;
}

/** 加密安全随机密码串（拒绝采样） */
export function secureRandomPassword(length: number, charset: string): string {
  const n = charset.length;
  if (!(length > 0) || n === 0) return '';
  const LIMIT = Math.floor(0x100000000 / n) * n;
  let pwd = '';
  while (pwd.length < length) {
    const buf = new Uint32Array(length - pwd.length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && pwd.length < length; i++) {
      if (buf[i] >= LIMIT) continue;
      pwd += charset.charAt(buf[i] % n);
    }
  }
  return pwd;
}

/** 敏感内容复制后自动清空剪贴板的延时 */
const CLIPBOARD_CLEAR_DELAY_MS = 60_000;
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

export function armClipboardClear(): void {
  if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
  clipboardClearTimer = setTimeout(() => {
    clipboardClearTimer = null;
    try {
      void navigator.clipboard.writeText('').catch(() => { /* 尽力而为 */ });
    } catch (e) { /* 尽力而为 */ }
  }, CLIPBOARD_CLEAR_DELAY_MS);
}

export function copySensitiveText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text).then(() => armClipboardClear());
  } catch (e) {
    return Promise.reject(e);
  }
}

/** 密码本设置 schema */
export function passwordSettingsSchema(): SettingsSchema {
  const warnReload = makeReloadWarnOnce();
  return {
    groups: [
      { icon: 'key-round', name: '生成', rows: [
        { type: 'text', name: '密码生成字符集', desc: '随机生成密码时使用的字符集', binding: { key: 'passwordCharset' }, onCommit: warnReload },
        { type: 'number', name: '密码生成长度', desc: '随机生成密码的字符个数', binding: numStrBinding('passwordLength', 16), min: 4, max: 128, step: 1, onCommit: warnReload },
      ]},
      { icon: 'shield', name: '安全', rows: [
        { type: 'toggle', name: '安全模式', desc: '关闭窗口立即自动上锁', binding: { key: 'securityMode' }, onChange: warnReload },
      ]},
      mobileFullscreenGroup('passwordMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}

// ==================== 平台聚合辅助 ====================

function colorOf(platform: string): string {
  const map: Record<string, string> = {
    'github': '#5a5f73', '微信': '#3eb575', '支付宝': '#4f7cf7',
    'notion': '#111111', '哔哩哔哩': '#fb7299', '招商银行': '#d43d3d',
    '豆瓣': '#3fa34d', 'google': '#4285f4', 'apple': '#333333',
    'twitter': '#1da1f2', 'x': '#111111', 'facebook': '#1877f2',
    'telegram': '#0088cc', 'steam': '#1b2838', '淘宝': '#ff5000',
    '京东': '#e1251b', 'bilibili': '#fb7299',
  };
  const k = Object.keys(map).find(x => (platform || '').toLowerCase().includes(x.toLowerCase()));
  if (k) return map[k];
  const palette = ['#7c6bd6', '#3e8e5a', '#c98a1e', '#4f7cf7', '#d43d3d', '#2a9d8f', '#b4551d', '#5a5f73'];
  let h = 0;
  const s = platform || '?';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function firstLetter(platform: string): string {
  return (platform || '?').charAt(0).toUpperCase();
}

interface PlatformGroup {
  platform: string;
  accounts: PasswordEntry[];
}

function groupPlatforms(data: PasswordEntry[]): PlatformGroup[] {
  const map = new Map<string, PasswordEntry[]>();
  for (const d of data) {
    const key = d.platform || '(无平台)';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  const list: PlatformGroup[] = [];
  for (const [p, accs] of map) {
    accs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
    list.push({ platform: p, accounts: accs });
  }
  list.sort((a, b) => (a.accounts[0].createdAt || '').localeCompare(b.accounts[0].createdAt || '') * -1);
  return list;
}

function accountsOf(data: PasswordEntry[], platform: string): PasswordEntry[] {
  const key = platform || '(无平台)';
  return data.filter(d => (d.platform || '(无平台)') === key)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
}

function hasFav(data: PasswordEntry[], platform: string): boolean {
  return accountsOf(data, platform).some(d => d.favorite);
}

// ==================== SVG 图标辅助 ====================

function icon(parent: HTMLElement, name: string, cls?: string): HTMLElement {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  setIcon(s, name as any);
  parent.appendChild(s);
  return s;
}

// ==================== UIManager ====================

export class UIManager {
  dataManager: DataManager;
  config: UIConfig;

  // 根容器
  root: HTMLDivElement | null = null;
  // 桌面元素
  desk: HTMLDivElement | null = null;
  navEl: HTMLDivElement | null = null;
  listEl: HTMLDivElement | null = null;
  detailEl: HTMLDivElement | null = null;
  // 移动元素
  mobEl: HTMLDivElement | null = null;

  // 状态
  editingId: string | null = null;
  editingPlatform: string | null = null; // 平台编辑模式
  pendingPassword: string | null = null;
  sheetEditPending = false;
  searchRenderTimer: ReturnType<typeof setTimeout> | null = null;
  searchKeyword = '';
  selectedPlatform: string | null = null;
  activeNav: 'all' | 'fav' = 'all';
  expandedAccounts = new Set<string>();
  mobilePageStack: string[] = []; // 移动端页面栈

  // 添加/编辑弹窗
  addMask: HTMLDivElement | null = null;
  addPopup: HTMLDivElement | null = null;
  _addTitle!: HTMLElement;
  _platformInput!: HTMLInputElement;
  _urlInput!: HTMLInputElement;
  _accountInput!: HTMLInputElement;
  _passwordInput!: HTMLInputElement;
  _noteTextarea!: HTMLTextAreaElement;
  _platformSuggest!: HTMLDivElement;

  // 平台编辑弹窗
  platMask: HTMLDivElement | null = null;
  platPopup: HTMLDivElement | null = null;
  _platNameInput!: HTMLInputElement;
  _platUrlInput!: HTMLInputElement;

  _initialized = false;

  constructor(dataManager: DataManager, config: UIConfig) {
    this.dataManager = dataManager;
    this.config = config;
  }

  // ==================== 初始化 DOM ====================

  ensureElements() {
    if (this._initialized) return;

    // 根容器
    this.root = document.createElement('div');
    this.root.className = 'bz-vault';

    // 桌面 3 列
    this.desk = document.createElement('div');
    this.desk.className = 'pw-desk';

    // 左导航
    this.navEl = document.createElement('div');
    this.navEl.className = 'pw-nav';

    // 中列表
    this.listEl = document.createElement('div');
    this.listEl.className = 'pw-list';

    // 右详情
    this.detailEl = document.createElement('div');
    this.detailEl.className = 'pw-detail';

    this.desk.appendChild(this.navEl);
    this.desk.appendChild(this.listEl);
    this.desk.appendChild(this.detailEl);

    // 移动布局
    this.mobEl = document.createElement('div');
    this.mobEl.className = 'pw-mob';
    this.mobEl.style.display = 'none';

    this.root.appendChild(this.desk);
    this.root.appendChild(this.mobEl);

    // 创建添加/编辑弹窗
    this.createAddDialog();
    // 创建平台编辑弹窗
    this.createPlatformEditDialog();

    // 注册 ESC
    this.registerEscape();

    this._initialized = true;
  }

  // ==================== 显示/隐藏 ====================

  async show() {
    if (!this._initialized) this.ensureElements();
    applyMobileWindowFullscreen(this.root, tryGetSettings().passwordMobileDefaultFullscreen === true);

    if (isMobileEnv()) {
      await this.renderMobile();
    } else {
      await this.renderDesktop();
    }
  }

  hide() {
    if (this.root) this.root.style.display = 'none';
    if (this.config.securityMode) {
      this.dataManager.lock();
      notice('安全模式：已自动上锁');
    }
  }

  // ==================== 桌面渲染 ====================

  private async renderDesktop() {
    if (!this.root || !this.navEl || !this.listEl || !this.detailEl) return;
    this.root.style.display = '';
    this.mobEl!.style.display = 'none';

    this.renderNav();
    await this.renderList();
    this.renderDetail();
  }

  // ---------- 导航栏 ----------
  private renderNav() {
    if (!this.navEl) return;
    this.navEl.innerHTML = '';

    const allCount = this.dataManager.pwData.length;
    const favCount = this.dataManager.pwData.filter(d => d.favorite).length;

    // 全部条目
    const allItem = document.createElement('div');
    allItem.className = 'pw-navitem' + (this.activeNav === 'all' ? ' active' : '');
    icon(allItem, 'layers');
    const allText = document.createElement('span');
    allText.textContent = '全部条目';
    allItem.appendChild(allText);
    const allBadge = document.createElement('span');
    allBadge.className = 'pw-navbadge';
    allBadge.textContent = String(allCount);
    allItem.appendChild(allBadge);
    allItem.onclick = () => {
      this.activeNav = 'all';
      this.searchKeyword = '';
      this.selectedPlatform = null;
      this.renderNav();
      this.renderList();
      this.renderDetail();
    };
    this.navEl.appendChild(allItem);

    // 已收藏
    const favItem = document.createElement('div');
    favItem.className = 'pw-navitem' + (this.activeNav === 'fav' ? ' active' : '');
    icon(favItem, 'star');
    const favText = document.createElement('span');
    favText.textContent = '已收藏';
    favItem.appendChild(favText);
    const favBadge = document.createElement('span');
    favBadge.className = 'pw-navbadge';
    favBadge.textContent = String(favCount);
    favItem.appendChild(favBadge);
    favItem.onclick = () => {
      this.activeNav = 'fav';
      this.searchKeyword = '';
      this.selectedPlatform = null;
      this.renderNav();
      this.renderList();
      this.renderDetail();
    };
    this.navEl.appendChild(favItem);
  }

  // ---------- 平台列表（中列） ----------
  private async renderList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    // 重新加载数据
    try {
      if (this.dataManager.unlocked) {
        await this.dataManager.load();
      }
    } catch (e: any) {
      notice('加载数据失败：' + e.message, 'error');
      return;
    }

    let data = this.dataManager.pwData;
    if (this.activeNav === 'fav') {
      data = data.filter(d => d.favorite);
    }
    if (this.searchKeyword) {
      data = this.dataManager.search(this.searchKeyword).filter(d => {
        if (this.activeNav === 'fav') return d.favorite;
        return true;
      });
    }

    // 列表头部
    const head = document.createElement('div');
    head.className = 'pw-listhead';
    const title = document.createElement('div');
    title.className = 'pw-listtitle';
    title.textContent = this.activeNav === 'fav' ? '已收藏' : '全部条目';
    head.appendChild(title);

    // 搜索栏
    const searchWrap = document.createElement('div');
    searchWrap.className = 'pw-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索平台、账号...';
    searchInput.value = this.searchKeyword;
    icon(searchWrap, 'search');
    searchWrap.appendChild(searchInput);
    head.appendChild(searchWrap);

    // 搜索防抖
    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    searchInput.addEventListener('input', () => {
      this.searchKeyword = searchInput.value.trim();
      if (searchTimer !== null) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.renderList();
      }, 180);
    });

    this.listEl.appendChild(head);

    // 滚动容器
    const rows = document.createElement('div');
    rows.className = 'pw-rows';

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pw-empty';
      icon(empty, 'key-round');
      const emptyText = document.createElement('span');
      emptyText.textContent = this.searchKeyword ? '没有匹配的条目' : (this.activeNav === 'fav' ? '暂无收藏' : '暂无密码条目');
      empty.appendChild(emptyText);
      rows.appendChild(empty);
    } else if (this.searchKeyword) {
      // 搜索模式：平铺账号行
      this.renderSearchRows(rows, data);
    } else {
      // 聚合模式：平台行
      const groups = groupPlatforms(data);
      for (const g of groups) {
        const row = this.createPlatformRow(g);
        rows.appendChild(row);
      }
    }

    this.listEl.appendChild(rows);
  }

  private createPlatformRow(g: PlatformGroup): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'pw-plrow' + (this.selectedPlatform === g.platform ? ' active' : '');

    // 头像
    const av = document.createElement('div');
    av.className = 'pw-av';
    av.style.background = colorOf(g.platform);
    av.textContent = firstLetter(g.platform);
    row.appendChild(av);

    // 信息
    const info = document.createElement('div');
    info.className = 'pw-plinfo';
    const name = document.createElement('div');
    name.className = 'pw-plname';
    name.textContent = g.platform;

    // 收藏星标
    if (hasFav(this.dataManager.pwData, g.platform)) {
      icon(name, 'star', 'pw-plstar');
    }
    info.appendChild(name);

    const time = document.createElement('div');
    time.className = 'pw-pltime';
    time.textContent = formatRelativeTime(g.accounts[0].createdAt);
    info.appendChild(time);
    row.appendChild(info);

    // 计数徽标
    if (g.accounts.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'pw-plcount';
      badge.textContent = String(g.accounts.length);
      row.appendChild(badge);
    }

    // 箭头
    const chevron = document.createElement('span');
    chevron.className = 'pw-plchevron';
    icon(chevron, 'chevron-right');
    row.appendChild(chevron);

    // 点击选中
    row.onclick = async () => {
      this.selectedPlatform = g.platform;
      this.expandedAccounts.clear();
      await this.renderList();
      this.renderDetail();
    };

    // 右键菜单
    row.oncontextmenu = (e) => {
      e.preventDefault();
      this.showPlatformContextMenu(e, g);
    };

    return row;
  }

  private renderSearchRows(container: HTMLElement, data: PasswordEntry[]) {
    for (const item of data) {
      const row = document.createElement('div');
      row.className = 'pw-srow';

      const av = document.createElement('div');
      av.className = 'pw-sr-av';
      av.style.background = colorOf(item.platform);
      av.textContent = firstLetter(item.platform);
      row.appendChild(av);

      const info = document.createElement('div');
      info.className = 'pw-sr-info';
      const plat = document.createElement('div');
      plat.className = 'pw-sr-platform';
      plat.textContent = item.platform || '(无平台)';
      info.appendChild(plat);
      const acct = document.createElement('div');
      acct.className = 'pw-sr-account';
      acct.textContent = item.account || '(无账号)';
      info.appendChild(acct);
      row.appendChild(info);

      const time = document.createElement('div');
      time.className = 'pw-sr-time';
      time.textContent = formatRelativeTime(item.createdAt);
      row.appendChild(time);

      row.onclick = () => {
        this.selectedPlatform = item.platform;
        this.expandedAccounts.clear();
        this.expandedAccounts.add(item.id);
        this.renderList();
        this.renderDetail();
      };

      row.oncontextmenu = (e) => {
        e.preventDefault();
        this.showAccountContextMenu(e, item);
      };

      container.appendChild(row);
    }
  }

  // ---------- 详情面板（右列） ----------
  private renderDetail() {
    if (!this.detailEl) return;
    this.detailEl.innerHTML = '';

    if (!this.selectedPlatform) {
      // 空态
      const empty = document.createElement('div');
      empty.className = 'pw-empty';
      icon(empty, 'vault');
      const text = document.createElement('span');
      text.textContent = '选择一个平台';
      empty.appendChild(text);
      this.detailEl.appendChild(empty);
      return;
    }

    const data = this.dataManager.pwData;
    const accts = accountsOf(data, this.selectedPlatform);
    if (accts.length === 0) {
      this.selectedPlatform = null;
      this.renderDetail();
      return;
    }

    const url = accts[0].url;

    // 平台头部
    const head = document.createElement('div');
    head.className = 'pw-detailhead';
    const av = document.createElement('div');
    av.className = 'pw-av';
    av.style.background = colorOf(this.selectedPlatform);
    av.textContent = firstLetter(this.selectedPlatform);
    head.appendChild(av);

    const headInfo = document.createElement('div');
    headInfo.className = 'pw-dh-info';
    const headName = document.createElement('div');
    headName.className = 'pw-dh-name';
    headName.textContent = this.selectedPlatform;
    headInfo.appendChild(headName);
    if (url) {
      const headUrl = document.createElement('div');
      headUrl.className = 'pw-dh-url';
      const link = document.createElement('a');
      link.href = url;
      link.textContent = url;
      (link as any).target = '_blank';
      link.onclick = (e) => e.stopPropagation();
      headUrl.appendChild(link);
      headInfo.appendChild(headUrl);
    }
    head.appendChild(headInfo);
    this.detailEl.appendChild(head);

    // 账号列表标题
    const acctHead = document.createElement('div');
    acctHead.className = 'pw-accthead';
    const acctLabel = document.createElement('span');
    acctLabel.textContent = `账号 (${accts.length})`;
    acctHead.appendChild(acctLabel);
    this.detailEl.appendChild(acctHead);

    // 账号卡片容器
    const acctsContainer = document.createElement('div');
    acctsContainer.className = 'pw-accts';

    for (const acct of accts) {
      const card = this.createAccountCard(acct);
      acctsContainer.appendChild(card);
    }

    this.detailEl.appendChild(acctsContainer);

    // 添加账号按钮
    const addBtn = document.createElement('div');
    addBtn.className = 'pw-add-acct';
    icon(addBtn, 'plus');
    const addText = document.createElement('span');
    addText.textContent = '在该平台新增账号';
    addBtn.appendChild(addText);
    addBtn.onclick = () => this.openAddDialog(null, this.selectedPlatform!);
    this.detailEl.appendChild(addBtn);
  }

  private createAccountCard(entry: PasswordEntry): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'pw-acctcard' + (this.expandedAccounts.has(entry.id) ? ' expanded' : '');

    // 头部行（点击展开/折叠）
    const head = document.createElement('div');
    head.className = 'head';

    const acctName = document.createElement('span');
    acctName.className = 'pw-acctname';
    const acctText = document.createElement('span');
    acctText.textContent = entry.account || '(无账号)';
    acctName.appendChild(acctText);
    if (entry.favorite) {
      icon(acctName, 'star', 'pw-acctstar');
    }
    head.appendChild(acctName);

    const chevron = document.createElement('span');
    chevron.className = 'pw-acctchevron';
    icon(chevron, 'chevron-down');
    head.appendChild(chevron);

    head.onclick = () => {
      if (this.expandedAccounts.has(entry.id)) {
        this.expandedAccounts.delete(entry.id);
        card.classList.remove('expanded');
      } else {
        this.expandedAccounts.add(entry.id);
        card.classList.add('expanded');
      }
    };

    // 右键菜单
    head.oncontextmenu = (e) => {
      e.preventDefault();
      this.showAccountContextMenu(e, entry);
    };

    card.appendChild(head);

    // 展开详情
    const details = document.createElement('div');
    details.className = 'details';

    // 密码字段
    let showPwd = false;
    const pwdField = document.createElement('div');
    pwdField.className = 'pw-field';
    const pwdLabel = document.createElement('span');
    pwdLabel.className = 'pw-flabel';
    pwdLabel.textContent = '密码';
    pwdField.appendChild(pwdLabel);
    const pwdValue = document.createElement('span');
    pwdValue.className = 'pw-fvalue';
    pwdValue.textContent = '•'.repeat(Math.min(entry.password?.length || 8, 20));
    pwdField.appendChild(pwdValue);

    // 复制密码
    const copyPwd = document.createElement('button');
    copyPwd.className = 'pw-mini';
    icon(copyPwd, 'copy');
    copyPwd.title = '复制密码';
    copyPwd.onclick = (e) => {
      e.stopPropagation();
      if (entry.password) {
        copySensitiveText(entry.password)
          .then(() => notice('密码已复制', 'success'))
          .catch(() => notice('复制失败', 'error'));
      }
    };
    pwdField.appendChild(copyPwd);

    // 显隐密码
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'pw-mini';
    icon(eyeBtn, 'eye');
    eyeBtn.title = '显示/隐藏密码';
    eyeBtn.onclick = (e) => {
      e.stopPropagation();
      showPwd = !showPwd;
      pwdValue.textContent = showPwd ? (entry.password || '') : '•'.repeat(Math.min(entry.password?.length || 8, 20));
      eyeBtn.innerHTML = '';
      icon(eyeBtn, showPwd ? 'eye-off' : 'eye');
    };
    pwdField.appendChild(eyeBtn);
    details.appendChild(pwdField);

    // 备注字段
    if (entry.note) {
      const noteField = document.createElement('div');
      noteField.className = 'pw-field';
      const noteLabel = document.createElement('span');
      noteLabel.className = 'pw-flabel';
      noteLabel.textContent = '备注';
      noteField.appendChild(noteLabel);
      const noteValue = document.createElement('span');
      noteValue.className = 'pw-fvalue pw-note-text';
      noteValue.textContent = entry.note;
      noteField.appendChild(noteValue);
      details.appendChild(noteField);
    }

    // 操作按钮行
    const actions = document.createElement('div');
    actions.className = 'pw-actions';

    // 复制账号
    const copyAcct = document.createElement('button');
    copyAcct.className = 'pw-btn';
    icon(copyAcct, 'copy');
    copyAcct.appendChild(document.createTextNode(' 复制账号'));
    copyAcct.onclick = (e) => {
      e.stopPropagation();
      if (entry.account) {
        copySensitiveText(entry.account)
          .then(() => notice('账号已复制', 'success'))
          .catch(() => notice('复制失败', 'error'));
      }
    };
    actions.appendChild(copyAcct);

    // 收藏切换
    const favBtn = document.createElement('button');
    favBtn.className = 'pw-btn';
    icon(favBtn, entry.favorite ? 'star-off' : 'star');
    favBtn.appendChild(document.createTextNode(entry.favorite ? ' 取消收藏' : ' 收藏'));
    favBtn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await this.dataManager.updateItem(entry.id, { favorite: !entry.favorite });
        await this.renderList();
        this.renderDetail();
        notice(entry.favorite ? '已取消收藏' : '已收藏', 'success');
      } catch (err: any) {
        notice('操作失败：' + err.message, 'error');
      }
    };
    actions.appendChild(favBtn);

    // 编辑
    const editBtn = document.createElement('button');
    editBtn.className = 'pw-btn';
    icon(editBtn, 'pencil');
    editBtn.appendChild(document.createTextNode(' 编辑'));
    editBtn.onclick = (e) => {
      e.stopPropagation();
      this.sheetEditPending = false;
      this.openAddDialog(entry);
    };
    actions.appendChild(editBtn);

    // 删除
    const delBtn = document.createElement('button');
    delBtn.className = 'pw-btn pw-btn-danger';
    icon(delBtn, 'trash-2');
    delBtn.appendChild(document.createTextNode(' 删除'));
    delBtn.onclick = (e) => {
      e.stopPropagation();
      this.showConfirm('删除密码条目', `确定删除账号 "${entry.account}" 吗？`, async () => {
        try {
          await this.dataManager.deleteItem(entry.id);
          this.expandedAccounts.delete(entry.id);
          // 如果平台下无账号了，取消选中
          const remaining = accountsOf(this.dataManager.pwData, this.selectedPlatform!);
          if (remaining.length === 0) this.selectedPlatform = null;
          this.renderNav();
          await this.renderList();
          this.renderDetail();
          notice('已删除', 'success');
        } catch (err: any) {
          notice('删除失败：' + err.message, 'error');
        }
      });
    };
    actions.appendChild(delBtn);

    details.appendChild(actions);

    // 元信息
    const meta = document.createElement('div');
    meta.className = 'pw-field';
    const metaLabel = document.createElement('span');
    metaLabel.className = 'pw-flabel';
    metaLabel.textContent = '创建';
    meta.appendChild(metaLabel);
    const metaValue = document.createElement('span');
    metaValue.className = 'pw-fvalue';
    metaValue.textContent = formatRelativeTime(entry.createdAt);
    metaValue.style.fontFamily = 'var(--font-interface, var(--font-text, sans-serif))';
    meta.appendChild(metaValue);
    details.appendChild(meta);

    card.appendChild(details);
    return card;
  }

  // ==================== 移动端渲染 ====================

  private async renderMobile() {
    if (!this.root || !this.mobEl) return;
    this.root.style.display = '';
    this.desk!.style.display = 'none';
    this.mobEl.style.display = '';

    // 重新加载数据
    try {
      if (this.dataManager.unlocked) {
        await this.dataManager.load();
      }
    } catch (e: any) {
      notice('加载数据失败：' + e.message, 'error');
      return;
    }

    this.mobEl.innerHTML = '';

    // 头部
    const bar = document.createElement('div');
    bar.className = 'pw-mobbar';
    const title = document.createElement('h3');
    title.textContent = this.activeNav === 'fav' ? '已收藏' : '密码本';
    bar.appendChild(title);

    const btns = document.createElement('div');
    btns.className = 'pw-mobbar-btns';

    // 切换全部/收藏
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'pw-mobbar-btn';
    icon(toggleBtn, this.activeNav === 'fav' ? 'layers' : 'star');
    toggleBtn.title = this.activeNav === 'fav' ? '查看全部' : '查看收藏';
    toggleBtn.onclick = () => {
      this.activeNav = this.activeNav === 'all' ? 'fav' : 'all';
      this.selectedPlatform = null;
      this.renderMobile();
    };
    btns.appendChild(toggleBtn);
    bar.appendChild(btns);
    this.mobEl.appendChild(bar);

    // 搜索
    const searchWrap = document.createElement('div');
    searchWrap.className = 'pw-mobsearch';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索...';
    searchInput.value = this.searchKeyword;
    searchWrap.appendChild(searchInput);
    this.mobEl.appendChild(searchWrap);

    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    searchInput.addEventListener('input', () => {
      this.searchKeyword = searchInput.value.trim();
      if (searchTimer !== null) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.renderMobile();
      }, 180);
    });

    // 卡片列表
    const list = document.createElement('div');
    list.className = 'pw-moblist';

    let data = this.dataManager.pwData;
    if (this.activeNav === 'fav') data = data.filter(d => d.favorite);
    if (this.searchKeyword) {
      data = this.dataManager.search(this.searchKeyword).filter(d => {
        if (this.activeNav === 'fav') return d.favorite;
        return true;
      });
    }

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pw-empty';
      icon(empty, 'key-round');
      const emptyText = document.createElement('span');
      emptyText.textContent = this.searchKeyword ? '没有匹配的条目' : (this.activeNav === 'fav' ? '暂无收藏' : '暂无密码条目');
      empty.appendChild(emptyText);
      list.appendChild(empty);
    } else if (this.searchKeyword) {
      // 搜索模式：平铺
      for (const item of data) {
        const card = this.createMobileSearchCard(item);
        list.appendChild(card);
      }
    } else {
      // 聚合模式：平台卡片
      const groups = groupPlatforms(data);
      for (const g of groups) {
        const card = this.createMobilePlatformCard(g);
        list.appendChild(card);
      }
    }

    this.mobEl.appendChild(list);

    // FAB
    const fab = document.createElement('button');
    fab.className = 'pw-fab';
    icon(fab, 'plus');
    fab.onclick = () => this.openAddDialog();
    this.mobEl.appendChild(fab);
  }

  private createMobilePlatformCard(g: PlatformGroup): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'pw-mobcard';

    const av = document.createElement('div');
    av.className = 'pw-av';
    av.style.background = colorOf(g.platform);
    av.textContent = firstLetter(g.platform);
    card.appendChild(av);

    const info = document.createElement('div');
    info.className = 'pw-mobcard-info';
    const name = document.createElement('div');
    name.className = 'pw-mobcard-name';
    name.textContent = g.platform;
    if (hasFav(this.dataManager.pwData, g.platform)) {
      icon(name, 'star', 'pw-plstar');
    }
    info.appendChild(name);
    const sub = document.createElement('div');
    sub.className = 'pw-mobcard-sub';
    sub.textContent = `${g.accounts.length} 个账号 · ${formatRelativeTime(g.accounts[0].createdAt)}`;
    info.appendChild(sub);
    card.appendChild(info);

    if (g.accounts.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'pw-mobcard-badge';
      badge.textContent = String(g.accounts.length);
      card.appendChild(badge);
    }

    const chevron = document.createElement('span');
    chevron.className = 'pw-mobcard-chevron';
    icon(chevron, 'chevron-right');
    card.appendChild(chevron);

    card.onclick = () => {
      this.selectedPlatform = g.platform;
      this.expandedAccounts.clear();
      this.renderMobileDetail();
    };

    // 长按菜单
    this.attachMobileLongPress(card, g);

    return card;
  }

  private createMobileSearchCard(item: PasswordEntry): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'pw-mobcard';

    const av = document.createElement('div');
    av.className = 'pw-av';
    av.style.background = colorOf(item.platform);
    av.textContent = firstLetter(item.platform);
    card.appendChild(av);

    const info = document.createElement('div');
    info.className = 'pw-mobcard-info';
    const name = document.createElement('div');
    name.className = 'pw-mobcard-name';
    name.textContent = item.account || '(无账号)';
    info.appendChild(name);
    const sub = document.createElement('div');
    sub.className = 'pw-mobcard-sub';
    sub.textContent = `${item.platform || '(无平台)'} · ${formatRelativeTime(item.createdAt)}`;
    info.appendChild(sub);
    card.appendChild(info);

    const chevron = document.createElement('span');
    chevron.className = 'pw-mobcard-chevron';
    icon(chevron, 'chevron-right');
    card.appendChild(chevron);

    card.onclick = () => {
      this.selectedPlatform = item.platform;
      this.expandedAccounts.clear();
      this.expandedAccounts.add(item.id);
      this.renderMobileDetail();
    };

    // 长按菜单
    card.addEventListener('touchstart', () => {}, { passive: true });

    return card;
  }

  // ---------- 移动端详情页 ----------
  private renderMobileDetail() {
    if (!this.mobEl) return;
    this.mobEl.innerHTML = '';

    const data = this.dataManager.pwData;
    const accts = this.selectedPlatform ? accountsOf(data, this.selectedPlatform) : [];
    if (accts.length === 0) {
      this.renderMobile();
      return;
    }

    const page = document.createElement('div');
    page.className = 'pw-mobpage';
    page.style.display = '';

    // 顶栏
    const bar = document.createElement('div');
    bar.className = 'pw-mobpagebar';
    const backBtn = document.createElement('button');
    backBtn.className = 'pw-mobback';
    icon(backBtn, 'arrow-left');
    backBtn.onclick = () => {
      this.selectedPlatform = null;
      this.renderMobile();
    };
    bar.appendChild(backBtn);

    const title = document.createElement('h3');
    title.textContent = this.selectedPlatform!;
    bar.appendChild(title);

    // 菜单按钮
    const menuBtn = document.createElement('button');
    menuBtn.className = 'pw-mobback';
    icon(menuBtn, 'more-horizontal');
    menuBtn.onclick = (e) => {
      this.showMobilePlatformSheet(e, this.selectedPlatform!);
    };
    bar.appendChild(menuBtn);

    page.appendChild(bar);

    // 平台头部
    const head = document.createElement('div');
    head.className = 'pw-mobpage-head';
    const av = document.createElement('div');
    av.className = 'pw-av';
    av.style.background = colorOf(this.selectedPlatform!);
    av.textContent = firstLetter(this.selectedPlatform!);
    head.appendChild(av);
    const headInfo = document.createElement('div');
    const headName = document.createElement('div');
    headName.className = 'pw-dh-name';
    headName.textContent = this.selectedPlatform!;
    headInfo.appendChild(headName);
    if (accts[0].url) {
      const headUrl = document.createElement('div');
      headUrl.className = 'pw-dh-url';
      const link = document.createElement('a');
      link.href = accts[0].url;
      link.textContent = accts[0].url;
      (link as any).target = '_blank';
      headUrl.appendChild(link);
      headInfo.appendChild(headUrl);
    }
    head.appendChild(headInfo);
    page.appendChild(head);

    // 可滚动账号列表
    const scroll = document.createElement('div');
    scroll.className = 'pw-mobpage-scroll';

    for (const acct of accts) {
      const seg = this.createMobileSegment(acct);
      scroll.appendChild(seg);
    }

    // 添加账号
    const addBtn = document.createElement('div');
    addBtn.className = 'pw-add-acct';
    icon(addBtn, 'plus');
    const addText = document.createElement('span');
    addText.textContent = '在该平台新增账号';
    addBtn.appendChild(addText);
    addBtn.onclick = () => this.openAddDialog(null, this.selectedPlatform!);
    scroll.appendChild(addBtn);

    page.appendChild(scroll);

    // FAB
    const fab = document.createElement('button');
    fab.className = 'pw-fab';
    icon(fab, 'plus');
    fab.onclick = () => this.openAddDialog(null, this.selectedPlatform!);
    page.appendChild(fab);

    this.mobEl.appendChild(page);
  }

  private createMobileSegment(entry: PasswordEntry): HTMLDivElement {
    const seg = document.createElement('div');
    seg.className = 'pw-seg' + (this.expandedAccounts.has(entry.id) ? ' expanded' : '');

    // 头部
    const head = document.createElement('div');
    head.className = 'head';

    const acctName = document.createElement('span');
    acctName.className = 'pw-acctname';
    const acctText = document.createElement('span');
    acctText.textContent = entry.account || '(无账号)';
    acctName.appendChild(acctText);
    if (entry.favorite) {
      icon(acctName, 'star', 'pw-acctstar');
    }
    head.appendChild(acctName);

    const chevron = document.createElement('span');
    chevron.className = 'pw-acctchevron';
    icon(chevron, 'chevron-down');
    head.appendChild(chevron);

    head.onclick = () => {
      if (this.expandedAccounts.has(entry.id)) {
        this.expandedAccounts.delete(entry.id);
        seg.classList.remove('expanded');
      } else {
        this.expandedAccounts.add(entry.id);
        seg.classList.add('expanded');
      }
    };

    // 长按抽屉
    this.attachMobileSegmentLongPress(head, entry);

    seg.appendChild(head);

    // 展开详情（与桌面 createAccountCard 相同结构）
    const details = document.createElement('div');
    details.className = 'details';

    // 密码
    let showPwd = false;
    const pwdField = document.createElement('div');
    pwdField.className = 'pw-field';
    const pwdLabel = document.createElement('span');
    pwdLabel.className = 'pw-flabel';
    pwdLabel.textContent = '密码';
    pwdField.appendChild(pwdLabel);
    const pwdValue = document.createElement('span');
    pwdValue.className = 'pw-fvalue';
    pwdValue.textContent = '•'.repeat(Math.min(entry.password?.length || 8, 20));
    pwdField.appendChild(pwdValue);

    const copyPwd = document.createElement('button');
    copyPwd.className = 'pw-mini';
    icon(copyPwd, 'copy');
    copyPwd.onclick = (e) => {
      e.stopPropagation();
      if (entry.password) {
        copySensitiveText(entry.password)
          .then(() => notice('密码已复制', 'success'))
          .catch(() => notice('复制失败', 'error'));
      }
    };
    pwdField.appendChild(copyPwd);

    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'pw-mini';
    icon(eyeBtn, 'eye');
    eyeBtn.onclick = (e) => {
      e.stopPropagation();
      showPwd = !showPwd;
      pwdValue.textContent = showPwd ? (entry.password || '') : '•'.repeat(Math.min(entry.password?.length || 8, 20));
      eyeBtn.innerHTML = '';
      icon(eyeBtn, showPwd ? 'eye-off' : 'eye');
    };
    pwdField.appendChild(eyeBtn);
    details.appendChild(pwdField);

    // 备注
    if (entry.note) {
      const noteField = document.createElement('div');
      noteField.className = 'pw-field';
      const noteLabel = document.createElement('span');
      noteLabel.className = 'pw-flabel';
      noteLabel.textContent = '备注';
      noteField.appendChild(noteLabel);
      const noteValue = document.createElement('span');
      noteValue.className = 'pw-fvalue pw-note-text';
      noteValue.textContent = entry.note;
      noteField.appendChild(noteValue);
      details.appendChild(noteField);
    }

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'pw-actions';

    const copyAcct = document.createElement('button');
    copyAcct.className = 'pw-btn';
    icon(copyAcct, 'copy');
    copyAcct.appendChild(document.createTextNode(' 复制账号'));
    copyAcct.onclick = (e) => {
      e.stopPropagation();
      if (entry.account) {
        copySensitiveText(entry.account)
          .then(() => notice('账号已复制', 'success'))
          .catch(() => notice('复制失败', 'error'));
      }
    };
    actions.appendChild(copyAcct);

    const favBtn = document.createElement('button');
    favBtn.className = 'pw-btn';
    icon(favBtn, entry.favorite ? 'star-off' : 'star');
    favBtn.appendChild(document.createTextNode(entry.favorite ? ' 取消收藏' : ' 收藏'));
    favBtn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await this.dataManager.updateItem(entry.id, { favorite: !entry.favorite });
        this.renderMobileDetail();
        notice(entry.favorite ? '已取消收藏' : '已收藏', 'success');
      } catch (err: any) {
        notice('操作失败：' + err.message, 'error');
      }
    };
    actions.appendChild(favBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'pw-btn';
    icon(editBtn, 'pencil');
    editBtn.appendChild(document.createTextNode(' 编辑'));
    editBtn.onclick = (e) => {
      e.stopPropagation();
      this.sheetEditPending = false;
      this.openAddDialog(entry);
    };
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'pw-btn pw-btn-danger';
    icon(delBtn, 'trash-2');
    delBtn.appendChild(document.createTextNode(' 删除'));
    delBtn.onclick = (e) => {
      e.stopPropagation();
      this.showConfirm('删除密码条目', `确定删除账号 "${entry.account}" 吗？`, async () => {
        try {
          await this.dataManager.deleteItem(entry.id);
          this.expandedAccounts.delete(entry.id);
          const remaining = accountsOf(this.dataManager.pwData, this.selectedPlatform!);
          if (remaining.length === 0) {
            this.selectedPlatform = null;
            this.renderMobile();
          } else {
            this.renderMobileDetail();
          }
          notice('已删除', 'success');
        } catch (err: any) {
          notice('删除失败：' + err.message, 'error');
        }
      });
    };
    actions.appendChild(delBtn);
    details.appendChild(actions);

    seg.appendChild(details);
    return seg;
  }

  // ==================== 上下文菜单 / 底部抽屉 ====================

  private showPlatformContextMenu(e: MouseEvent, g: PlatformGroup) {
    const recent = g.accounts[0];
    const actions: ItemAction[] = [
      {
        icon: 'copy',
        label: '复制最近账号',
        onClick: () => {
          if (recent.account) {
            copySensitiveText(recent.account)
              .then(() => notice('账号已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      {
        icon: 'key',
        label: '复制最近密码',
        onClick: () => {
          if (recent.password) {
            copySensitiveText(recent.password)
              .then(() => notice('密码已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      { icon: 'pencil', label: '编辑平台', keepOpen: true, onClick: () => this.openPlatformEditDialog(g.platform) },
      {
        icon: 'user-plus',
        label: '新增账号',
        keepOpen: true,
        onClick: () => this.openAddDialog(null, g.platform),
      },
      {
        icon: 'trash-2',
        label: '删除平台',
        kind: 'danger',
        onClick: () => {
          this.showConfirm(
            '删除平台',
            `确定删除平台 "${g.platform}" 及其 ${g.accounts.length} 个账号吗？`,
            async () => {
              try {
                for (const a of g.accounts) {
                  await this.dataManager.deleteItem(a.id);
                }
                if (this.selectedPlatform === g.platform) this.selectedPlatform = null;
                this.renderNav();
                this.renderList();
                this.renderDetail();
                notice('已删除', 'success');
              } catch (err: any) {
                notice('删除失败：' + err.message, 'error');
              }
            }
          );
        },
      },
    ];

    const sheetHead = document.createElement('div');
    sheetHead.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔑';
    body.appendChild(emoji);
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'bz-item-sheet-title';
    title.textContent = g.platform;
    info.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'bz-item-sheet-sub';
    sub.textContent = `${g.accounts.length} 个账号 · ${formatRelativeTime(recent.createdAt)}`;
    info.appendChild(sub);
    body.appendChild(info);
    sheetHead.appendChild(body);

    attachItemActions(
      document.elementFromPoint(e.clientX, e.clientY) as HTMLElement || document.body,
      actions,
      { sheetHead }
    );
  }

  private showAccountContextMenu(e: MouseEvent, entry: PasswordEntry) {
    const actions: ItemAction[] = [
      {
        icon: 'copy',
        label: '复制账号',
        onClick: () => {
          if (entry.account) {
            copySensitiveText(entry.account)
              .then(() => notice('账号已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      {
        icon: 'key',
        label: '复制密码',
        onClick: () => {
          if (entry.password) {
            copySensitiveText(entry.password)
              .then(() => notice('密码已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      {
        icon: entry.favorite ? 'star-off' : 'star',
        label: entry.favorite ? '取消收藏' : '收藏',
        onClick: async () => {
          try {
            await this.dataManager.updateItem(entry.id, { favorite: !entry.favorite });
            this.renderList();
            this.renderDetail();
            notice(entry.favorite ? '已取消收藏' : '已收藏', 'success');
          } catch (err: any) {
            notice('操作失败：' + err.message, 'error');
          }
        },
      },
      ...(entry.url
        ? [
            {
              icon: 'external-link' as const,
              label: '打开链接',
              onClick: () => {
                window.open(entry.url, '_blank');
              },
            },
          ]
        : []),
      {
        icon: 'pencil',
        label: '编辑',
        keepOpen: true,
        onClick: () => {
          this.sheetEditPending = false;
          this.openAddDialog(entry);
        },
      },
      {
        icon: 'trash-2',
        label: '删除',
        kind: 'danger' as const,
        onClick: () => {
          this.showConfirm('删除密码条目', `确定删除账号 "${entry.account}" 吗？`, async () => {
            try {
              await this.dataManager.deleteItem(entry.id);
              this.expandedAccounts.delete(entry.id);
              const remaining = accountsOf(this.dataManager.pwData, this.selectedPlatform!);
              if (remaining.length === 0) this.selectedPlatform = null;
              this.renderNav();
              this.renderList();
              this.renderDetail();
              notice('已删除', 'success');
            } catch (err: any) {
              notice('删除失败：' + err.message, 'error');
            }
          });
        },
      },
    ];

    const sheetHead = document.createElement('div');
    sheetHead.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔑';
    body.appendChild(emoji);
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'bz-item-sheet-title';
    title.textContent = entry.platform || entry.account || '密码条目';
    info.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'bz-item-sheet-sub';
    sub.textContent = `${entry.account || ''}${entry.account ? ' · ' : ''}${formatRelativeTime(entry.createdAt)}`;
    info.appendChild(sub);
    body.appendChild(info);
    sheetHead.appendChild(body);

    attachItemActions(
      document.elementFromPoint(e.clientX, e.clientY) as HTMLElement || document.body,
      actions,
      { sheetHead }
    );
  }

  // ---------- 移动端长按菜单 ----------
  private attachMobileLongPress(el: HTMLElement, g: PlatformGroup) {
    let timer: any = null;
    let touched = false;
    const onEnd = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };
    el.addEventListener('touchstart', () => {
      touched = false;
      timer = setTimeout(() => {
        touched = true;
        this.showMobilePlatformSheet(null, g.platform);
      }, 500);
    }, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchmove', onEnd);
    el.addEventListener('click', (e) => {
      if (touched) { e.preventDefault(); e.stopPropagation(); }
    });
  }

  private attachMobileSegmentLongPress(el: HTMLElement, entry: PasswordEntry) {
    let timer: any = null;
    let touched = false;
    const onEnd = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };
    el.addEventListener('touchstart', () => {
      touched = false;
      timer = setTimeout(() => {
        touched = true;
        this.showMobileAccountSheet(entry);
      }, 500);
    }, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchmove', onEnd);
    el.addEventListener('click', (e) => {
      if (touched) { e.preventDefault(); e.stopPropagation(); }
    });
  }

  private showMobilePlatformSheet(_e: any, platform: string) {
    const g = groupPlatforms(this.dataManager.pwData).find(x => x.platform === platform);
    if (!g) return;
    const recent = g.accounts[0];
    const actions: ItemAction[] = [
      {
        icon: 'copy',
        label: '复制最近账号',
        sub: recent.account,
        onClick: () => {
          if (recent.account) {
            copySensitiveText(recent.account)
              .then(() => notice('账号已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      {
        icon: 'key',
        label: '复制最近密码',
        onClick: () => {
          if (recent.password) {
            copySensitiveText(recent.password)
              .then(() => notice('密码已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      {
        icon: 'user-plus',
        label: '新增账号',
        keepOpen: true,
        onClick: () => this.openAddDialog(null, platform),
      },
      {
        icon: 'pencil',
        label: '编辑平台',
        keepOpen: true,
        onClick: () => this.openPlatformEditDialog(platform),
      },
      {
        icon: 'trash-2',
        label: '删除平台',
        kind: 'danger',
        onClick: () => {
          this.showConfirm('删除平台', `确定删除平台 "${platform}" 及其 ${g.accounts.length} 个账号吗？`, async () => {
            try {
              for (const a of g.accounts) await this.dataManager.deleteItem(a.id);
              if (this.selectedPlatform === platform) this.selectedPlatform = null;
              this.renderMobile();
              notice('已删除', 'success');
            } catch (err: any) {
              notice('删除失败：' + err.message, 'error');
            }
          });
        },
      },
    ];
    const sheetHead = document.createElement('div');
    sheetHead.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔑';
    body.appendChild(emoji);
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'bz-item-sheet-title';
    title.textContent = platform;
    info.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'bz-item-sheet-sub';
    sub.textContent = `${g.accounts.length} 个账号`;
    info.appendChild(sub);
    body.appendChild(info);
    sheetHead.appendChild(body);

    attachItemActions(document.body, actions, { sheetHead });
  }

  private showMobileAccountSheet(entry: PasswordEntry) {
    const actions: ItemAction[] = [
      {
        icon: 'copy',
        label: '复制账号',
        onClick: () => {
          if (entry.account) {
            copySensitiveText(entry.account)
              .then(() => notice('账号已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      {
        icon: 'key',
        label: '复制密码',
        onClick: () => {
          if (entry.password) {
            copySensitiveText(entry.password)
              .then(() => notice('密码已复制', 'success'))
              .catch(() => notice('复制失败', 'error'));
          }
        },
      },
      {
        icon: entry.favorite ? 'star-off' : 'star',
        label: entry.favorite ? '取消收藏' : '收藏',
        onClick: async () => {
          try {
            await this.dataManager.updateItem(entry.id, { favorite: !entry.favorite });
            this.renderMobileDetail();
            notice(entry.favorite ? '已取消收藏' : '已收藏', 'success');
          } catch (err: any) {
            notice('操作失败：' + err.message, 'error');
          }
        },
      },
      {
        icon: 'pencil',
        label: '编辑',
        keepOpen: true,
        onClick: () => {
          this.sheetEditPending = false;
          this.openAddDialog(entry);
        },
      },
      {
        icon: 'trash-2',
        label: '删除',
        kind: 'danger',
        onClick: () => {
          this.showConfirm('删除密码条目', `确定删除账号 "${entry.account}" 吗？`, async () => {
            try {
              await this.dataManager.deleteItem(entry.id);
              this.expandedAccounts.delete(entry.id);
              const remaining = accountsOf(this.dataManager.pwData, this.selectedPlatform!);
              if (remaining.length === 0) {
                this.selectedPlatform = null;
                this.renderMobile();
              } else {
                this.renderMobileDetail();
              }
              notice('已删除', 'success');
            } catch (err: any) {
              notice('删除失败：' + err.message, 'error');
            }
          });
        },
      },
    ];

    const sheetHead = document.createElement('div');
    sheetHead.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔑';
    body.appendChild(emoji);
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'bz-item-sheet-title';
    title.textContent = entry.platform || entry.account || '密码条目';
    info.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'bz-item-sheet-sub';
    sub.textContent = entry.account || '';
    info.appendChild(sub);
    body.appendChild(info);
    sheetHead.appendChild(body);

    attachItemActions(document.body, actions, { sheetHead });
  }

  // ==================== 添加/编辑弹窗 ====================

  private createAddDialog() {
    if (this.addMask && this.addPopup) return;

    this.addMask = document.createElement('div');
    this.addMask.className = 'pw-dialog-mask';
    this.addMask.style.display = 'none';
    this.addMask.onclick = (e) => {
      if (e.target === this.addMask) this.closeAddDialog();
    };

    this.addPopup = document.createElement('div');
    this.addPopup.className = 'pw-dialog';

    const title = document.createElement('h4');
    title.textContent = '添加密码条目';
    this._addTitle = title;

    // 平台
    const platField = this.createDialogField('平台 *', 'text', '如 GitHub、微信');
    this._platformInput = platField.input;
    this._platformSuggest = platField.suggest;

    // URL
    const urlField = this.createDialogField('链接', 'url', 'https://...');
    this._urlInput = urlField.input;

    // 账号
    const acctField = this.createDialogField('账号 *', 'text', '账号名或邮箱');
    this._accountInput = acctField.input;

    // 密码（带生成按钮）
    const pwdWrap = document.createElement('div');
    pwdWrap.className = 'pw-dfield pw-dfield-pwd';
    const pwdLabel = document.createElement('label');
    pwdLabel.textContent = '密码 *';
    pwdWrap.appendChild(pwdLabel);
    const pwdRow = document.createElement('div');
    pwdRow.className = 'pw-dfield pw-dfield-pwd';
    pwdRow.style.marginTop = '4px';
    const pwdInput = document.createElement('input');
    pwdInput.type = 'text';
    pwdInput.placeholder = '密码';
    this._passwordInput = pwdInput;
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.className = 'pw-genbtn';
    genBtn.textContent = '生成';
    genBtn.title = '随机生成密码';
    genBtn.onclick = () => {
      pwdInput.value = this.generatePassword();
    };
    pwdRow.appendChild(pwdInput);
    pwdRow.appendChild(genBtn);
    pwdWrap.appendChild(pwdRow);

    // 备注
    const noteField = document.createElement('div');
    noteField.className = 'pw-dfield';
    const noteLabel = document.createElement('label');
    noteLabel.textContent = '备注';
    noteField.appendChild(noteLabel);
    const noteTextarea = document.createElement('textarea');
    noteTextarea.placeholder = '备注（可选）';
    this._noteTextarea = noteTextarea;
    noteField.appendChild(noteTextarea);

    // 按钮
    const btns = document.createElement('div');
    btns.className = 'pw-dbtns';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'pw-dcancel';
    cancelBtn.onclick = () => this.closeAddDialog();
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'pw-dsave';
    saveBtn.onclick = () => this.saveAddDialog();
    btns.appendChild(cancelBtn);
    btns.appendChild(saveBtn);

    this.addPopup.appendChild(title);
    this.addPopup.appendChild(platField.wrap);
    this.addPopup.appendChild(urlField.wrap);
    this.addPopup.appendChild(acctField.wrap);
    this.addPopup.appendChild(pwdWrap);
    this.addPopup.appendChild(noteField);
    this.addPopup.appendChild(btns);

    this.addMask.appendChild(this.addPopup);
    document.body.appendChild(this.addMask);
  }

  private createDialogField(label: string, type: string, placeholder: string) {
    const wrap = document.createElement('div');
    wrap.className = 'pw-dfield';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    wrap.appendChild(lbl);
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    wrap.appendChild(input);

    // 自动补全（仅平台字段）
    const suggest = document.createElement('div');
    suggest.className = 'pw-suggest';
    wrap.appendChild(suggest);

    if (label.startsWith('平台')) {
      const showSuggest = () => {
        const val = input.value.trim().toLowerCase();
        const freq: Record<string, number> = {};
        this.dataManager.pwData.forEach((item) => {
          const v = item.platform?.trim();
          if (v) freq[v] = (freq[v] || 0) + 1;
        });
        const suggestions = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .map(([v]) => v)
          .filter(v => !val || v.toLowerCase().includes(val));

        suggest.innerHTML = '';
        if (suggestions.length === 0) {
          suggest.style.display = 'none';
          return;
        }
        for (const s of suggestions) {
          const item = document.createElement('div');
          item.className = 'pw-suggest-item';
          item.textContent = s;
          item.onmousedown = (e) => {
            e.preventDefault();
            input.value = s;
            suggest.style.display = 'none';
          };
          suggest.appendChild(item);
        }
        suggest.style.display = 'block';
      };
      input.addEventListener('focus', showSuggest);
      input.addEventListener('input', showSuggest);
      input.addEventListener('blur', () => {
        setTimeout(() => { suggest.style.display = 'none'; }, 200);
      });
    }

    return { wrap, input, suggest };
  }

  openAddDialog(editItem: PasswordEntry | null = null, prefillPlatform?: string) {
    if (!this.dataManager.unlocked) {
      notice('请先解锁密码本');
      return;
    }
    if (!this.addMask) this.createAddDialog();
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
      this._platformInput.value = prefillPlatform || '';
      this._urlInput.value = '';
      this._accountInput.value = '';
      this._noteTextarea.value = '';
      let pwd = this.pendingPassword || this.generatePassword();
      this._passwordInput.value = pwd;
      this.pendingPassword = null;
    }

    topifyZ(this.addMask!, this.addPopup!);
    this.addMask!.style.display = 'block';
    this.addPopup!.style.display = 'block';
    this._platformInput.focus();
    this._platformSuggest.style.display = 'none';
  }

  private closeAddDialog() {
    if (this.addMask) this.addMask.style.display = 'none';
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.editingId = null;
    this.pendingPassword = null;
    if (this.sheetEditPending && this.addMask) {
      this.sheetEditPending = false;
      unregisterSheetCompanion(this.addMask);
    }
  }

  private async saveAddDialog() {
    const platform = this._platformInput.value.trim();
    const url = this._urlInput.value.trim();
    const account = this._accountInput.value.trim();
    const password = this._passwordInput.value.trim();
    const note = this._noteTextarea.value.trim();

    if (!platform) {
      notice('平台不能为空');
      this._platformInput.focus();
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
      const fromSheet = this.sheetEditPending;
      this.closeAddDialog();
      if (fromSheet) closeItemMenu();

      // 刷新当前视图
      if (isMobileEnv()) {
        if (this.selectedPlatform) {
          this.renderMobileDetail();
        } else {
          this.renderMobile();
        }
      } else {
        this.selectedPlatform = platform;
        this.renderNav();
        this.renderList();
        this.renderDetail();
      }
      notice('已保存', 'success');
    } catch (e: any) {
      notice('保存失败：' + e.message, 'error');
    }
  }

  // ==================== 平台编辑弹窗 ====================

  private createPlatformEditDialog() {
    if (this.platMask && this.platPopup) return;

    this.platMask = document.createElement('div');
    this.platMask.className = 'pw-dialog-mask';
    this.platMask.style.display = 'none';
    this.platMask.onclick = (e) => {
      if (e.target === this.platMask) this.closePlatformEditDialog();
    };

    this.platPopup = document.createElement('div');
    this.platPopup.className = 'pw-dialog';

    const title = document.createElement('h4');
    title.textContent = '编辑平台';

    const nameField = this.createDialogField('平台名称', 'text', '平台名称');
    this._platNameInput = nameField.input;

    const urlField = this.createDialogField('链接', 'url', 'https://...');
    this._platUrlInput = urlField.input;

    const btns = document.createElement('div');
    btns.className = 'pw-dbtns';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'pw-dcancel';
    cancelBtn.onclick = () => this.closePlatformEditDialog();
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'pw-dsave';
    saveBtn.onclick = () => this.savePlatformEditDialog();
    btns.appendChild(cancelBtn);
    btns.appendChild(saveBtn);

    this.platPopup.appendChild(title);
    this.platPopup.appendChild(nameField.wrap);
    this.platPopup.appendChild(urlField.wrap);
    this.platPopup.appendChild(btns);

    this.platMask.appendChild(this.platPopup);
    document.body.appendChild(this.platMask);
  }

  private openPlatformEditDialog(platform: string) {
    if (!this.dataManager.unlocked) {
      notice('请先解锁密码本');
      return;
    }
    if (!this.platMask) this.createPlatformEditDialog();

    this.editingPlatform = platform;
    const accts = accountsOf(this.dataManager.pwData, platform);
    this._platNameInput.value = platform;
    this._platUrlInput.value = accts[0]?.url || '';

    topifyZ(this.platMask!, this.platPopup!);
    this.platMask!.style.display = 'block';
    this.platPopup!.style.display = 'block';
    this._platNameInput.focus();
  }

  private closePlatformEditDialog() {
    if (this.platMask) this.platMask.style.display = 'none';
    if (this.platPopup) this.platPopup.style.display = 'none';
    this.editingPlatform = null;
  }

  private async savePlatformEditDialog() {
    const newName = this._platNameInput.value.trim();
    const newUrl = this._platUrlInput.value.trim();
    if (!newName) {
      notice('平台名称不能为空');
      return;
    }
    if (!this.editingPlatform) return;

    try {
      const accts = accountsOf(this.dataManager.pwData, this.editingPlatform);
      for (const a of accts) {
        await this.dataManager.updateItem(a.id, {
          platform: newName,
          url: newUrl,
        });
      }
      this.selectedPlatform = newName;
      this.closePlatformEditDialog();
      this.renderNav();
      this.renderList();
      this.renderDetail();
      notice('已保存', 'success');
    } catch (e: any) {
      notice('保存失败：' + e.message, 'error');
    }
  }

  // ==================== 确认对话框 ====================

  private showConfirm(title: string, message: string, onConfirm: () => void) {
    void openFlowDialog({
      title: title || '确认',
      message: message || '',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '确定', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v === 'ok') onConfirm();
    });
  }

  // ==================== 解锁 ====================

  showPasswordDialog(): Promise<boolean> {
    return ensureSafeUnlocked();
  }

  // ==================== 密码生成 ====================

  generatePassword(): string {
    const length = parseInt(this.config.length) || 16;
    const charset =
      this.config.charset ||
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';
    return secureRandomPassword(length, charset);
  }

  // ==================== ESC 处理 ====================

  private registerEscape() {
    escManager.register('pw', {
      isVisible: () => {
        if (this.addMask && this.addMask.style.display === 'block') return true;
        if (this.platMask && this.platMask.style.display === 'block') return true;
        if (this.root && this.root.style.display !== 'none') return true;
        return false;
      },
      close: () => {
        if (this.addMask && this.addMask.style.display === 'block') {
          this.closeAddDialog();
        } else if (this.platMask && this.platMask.style.display === 'block') {
          this.closePlatformEditDialog();
        } else if (this.root && this.root.style.display !== 'none') {
          this.hide();
        }
      },
    });
  }
}

// ==================== Controller（命令入口） ====================

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
        armClipboardClear();
        notice('密码已复制到剪贴板', 'success');
      })
      .catch(() => {
        notice('复制失败，请手动复制', 'error');
      });
    this.uiManager.pendingPassword = pwd;
    notice('密码已暂存，打开"添加条目"时将自动填入');
  }

  /** 卸载清理 */
  cleanup() {
    if (clipboardClearTimer !== null) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }
    if (this.uiManager.searchRenderTimer !== null) {
      clearTimeout(this.uiManager.searchRenderTimer);
      this.uiManager.searchRenderTimer = null;
    }
    // 移除注入 DOM
    const ids = ['pw-mask', 'pw-popup', 'pw-add-mask', 'pw-add-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    // 移除根容器
    if (this.uiManager.root && this.uiManager.root.parentNode) {
      this.uiManager.root.remove();
    }
    if (this.uiManager.addMask && this.uiManager.addMask.parentNode) {
      this.uiManager.addMask.remove();
    }
    if (this.uiManager.platMask && this.uiManager.platMask.parentNode) {
      this.uiManager.platMask.remove();
    }
    this.uiManager.root = null;
    this.uiManager.desk = null;
    this.uiManager.navEl = null;
    this.uiManager.listEl = null;
    this.uiManager.detailEl = null;
    this.uiManager.mobEl = null;
    this.uiManager.addMask = null;
    this.uiManager.addPopup = null;
    this.uiManager.platMask = null;
    this.uiManager.platPopup = null;
    this.uiManager._initialized = false;
    this.dataManager.lock();
  }
}

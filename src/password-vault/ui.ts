/**
 * 保险库（password-vault）UI — 原型 v1「保险库」一比一移植
 * 桌面三栏工作台（导航+列表+详情）+ 移动端（列表卡+详情页+FAB）+ 原型自绘
 * 右键菜单 / 底部抽屉 / 确认框 / toast / 解锁屏（金色印章 + 安全机制嵌入）。
 * 数据经 PasswordVaultDataManager（保险箱 password-vault SafeNote 共享）；
 * 解锁底层走保险箱 SafeManager（同一主密码），原型锁屏仅作视觉壳，
 * 安全机制（首设风险确认/失败冷却/损坏重设/自愈提示）完整保留（Q13）。
 * 命令入口由 index.ts 注册（bz-password-vault-open）。
 */
import { escManager } from '../core/esc-manager';
import { topifyZ, createSiteIcon } from '../core/dom';
import { openFlowDialog } from '../core/flow-dialog';
import { notice } from '../core/notice';
import { attachItemActions, openItemSheet, type ItemAction } from '../core/item-actions';
import type { IconName } from 'obsidian';
import {
  PasswordVaultDataManager,
  type PasswordVaultEntry,
  type PlatformGroup,
} from './data';

/** 安全机制状态（Q13：完整保留保险箱行为） */
interface LockSecurity {
  unlockFailStreak: number;
  unlockCooldownUntil: number;
}

const DEFAULT_CHARSET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';

/** 加密安全随机密码（拒绝采样，与密码本同款） */
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

/** 复制敏感内容 + 60s 自动清空剪贴板 */
const CLIPBOARD_CLEAR_DELAY_MS = 60_000;
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;
export function armClipboardClear(): void {
  if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
  clipboardClearTimer = setTimeout(() => {
    clipboardClearTimer = null;
    try {
      void navigator.clipboard.writeText('').catch(() => {});
    } catch (e) {
      /* 尽力而为 */
    }
  }, CLIPBOARD_CLEAR_DELAY_MS);
}
export function copySensitiveText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text).then(() => armClipboardClear());
  } catch (e) {
    return Promise.reject(e);
  }
}

/** 相对时间（原型同款） */
export function relTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 864e5;
  if (diff < 1) return '今天';
  if (diff < 2) return '昨天';
  if (diff < 30) return Math.round(diff) + ' 天前';
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/** 密码掩码圆点 */
function dots(p: string): string {
  return '•'.repeat(Math.min((p || '').length, 18));
}

/** 平台色（原型同款：品牌色映射 + 哈希回退） */
const PLATFORM_COLOR_MAP: Record<string, string> = {
  github: '#5a5f73',
  微信: '#3eb575',
  支付宝: '#4f7cf7',
  notion: '#111111',
  哔哩哔哩: '#fb7299',
  招商银行: '#d43d3d',
  豆瓣: '#3fa34d',
};
const PALETTE = ['#7c6bd6', '#3e8e5a', '#c98a1e', '#4f7cf7', '#d43d3d', '#2a9d8f', '#b4551d', '#5a5f73'];
export function colorOf(platform: string): string {
  const k = Object.keys(PLATFORM_COLOR_MAP).find((x) => (platform || '').toLowerCase().includes(x.toLowerCase()));
  if (k) return PLATFORM_COLOR_MAP[k];
  let h = 0;
  for (let i = 0; i < (platform || '?').length; i++) h = (h * 31 + (platform || '?').charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** SVG 图标（原型同款） */
const ICONS = {
  seal: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1.6" fill="#fff" stroke="none"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
  menuDots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

/** 平台色（图标底色） */
const AV_BG = (platform: string) => `background:${colorOf(platform)}`;

/**
 * 平台头像 HTML：品牌色字母底 + favicon 真实图标盖层。
 * 真实图标（createSiteIcon）加载成功 → 隐藏字母、完整显示图标；失败 → 露出字母回退。
 * 渲染后需调 hydrateAvatars 注入 <img>（createSiteIcon 需 JS 创建）。
 * @param platform 平台名（字母回退）
 * @param url 平台链接（解析域名取真实 favicon）
 * @param cls 容器类名（默认列表头像 .bz-password-vault-av）
 */
function avatarHTML(platform: string, url: string | null | undefined, cls = 'bz-password-vault-av'): string {
  const ch = (platform || '?').slice(0, 1);
  return `<div class="${cls} bz-pwv-avatar" style="${AV_BG(platform)}" data-avatar="1" data-url="${escAttr(url || '')}"><span>${ch}</span></div>`;
}

/** 属性值 HTML 转义（avatarHTML 的 data-url 用） */
function escAttr(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 给容器内所有 [data-avatar] 注入真实 favicon 图标（域名从 url 解析）：
 * - createSiteIcon 加载成功（onload）→ 隐藏字母 span，完整显示真实图标（object-fit: contain）；
 * - 加载失败（onerror，createSiteIcon 内部隐藏 img）→ 保留字母回退。
 */
function hydrateAvatars(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('[data-avatar]').forEach((box) => {
    if (box.querySelector('img')) return; // 已注入
    const url = box.getAttribute('data-url');
    let domain: string | null = null;
    try {
      domain = url ? new URL(url).hostname : null;
    } catch (e) {
      domain = null;
    }
    const img = createSiteIcon(domain, 64);
    if (img) {
      img.className = 'bz-pwv-favicon';
      // createSiteIcon 内部强加内联尺寸（width/height=size），内联样式优先级高于 CSS，
      // 会导致图被固定 size 塞进容器、overflow 裁剪只剩一部分 → 清除由 CSS 全权控制
      img.removeAttribute('style');
      // 图标加载成功 → 隐藏字母；列表小头像（.bz-password-vault-av）去掉品牌色底（图标自带颜色）
      img.addEventListener('load', () => {
        const ch = box.querySelector('span');
        if (ch) ch.style.display = 'none';
        if (box.classList.contains('bz-password-vault-av')) box.removeAttribute('style');
      });
      box.appendChild(img);
    }
  });
}

export interface PasswordVaultUIConfig {
  charset: string;
  length: string;
  securityMode: boolean;
}

export class PasswordVaultUIManager {
  dataManager: PasswordVaultDataManager;
  config: PasswordVaultUIConfig;
  root: HTMLDivElement | null = null;
  // 状态
  view: 'all' | 'fav' = 'all';
  searchKw = '';
  selPlatform: string | null = null;
  selAccount: string | null = null;
  shownIds: Record<string, boolean> = {};
  pendingPassword: string | null = null;
  editingId: string | null = null;
  // 安全机制（Q13）
  security: LockSecurity = { unlockFailStreak: 0, unlockCooldownUntil: 0 };
  // 计时器
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private escUnregister: { unregister: () => void } | null = null;
  private _initialized = false;
  // DOM 引用（桌面）
  private desk!: {
    rows: HTMLElement;
    detail: HTMLElement;
    search: HTMLInputElement;
    count: HTMLElement;
    shown: HTMLElement;
    title: HTMLElement;
    lock: HTMLElement;
    toast: HTMLElement;
    modal: HTMLElement;
    confirm: HTMLElement;
    platEdit: HTMLElement;
  };
  // DOM 引用（移动）
  private mob!: {
    list: HTMLElement;
    search: HTMLInputElement;
    page: HTMLElement;
    pageBody: HTMLElement;
    pageTitle: HTMLElement;
    lock: HTMLElement;
    toast: HTMLElement;
    modal: HTMLElement;
    confirm: HTMLElement;
    platEdit: HTMLElement;
  };

  constructor(dataManager: PasswordVaultDataManager, config: PasswordVaultUIConfig) {
    this.dataManager = dataManager;
    this.config = config;
  }

  // ---------- 创建 DOM（桌面 + 移动双实例，共享同一 DataManager） ----------
  ensureElements() {
    if (this._initialized) return;
    this._initialized = true;
    // 根容器：固定全屏遮罩层（Obsidian 弹窗层之上）
    this.root = document.createElement('div');
    this.root.className = 'bz-password-vault';
    this.root.style.cssText =
      'position:fixed;inset:0;z-index:var(--bz-z-overlay,1000);display:none;';
    document.body.appendChild(this.root);

    // 桌面实例
    const desk = document.createElement('div');
    desk.className = 'bz-password-vault-desk';
    desk.innerHTML = this.deskHTML();
    this.root.appendChild(desk);
    this.desk = {
      rows: desk.querySelector('.bz-password-vault-rows')!,
      detail: desk.querySelector('.bz-password-vault-detail')!,
      search: desk.querySelector('.bz-password-vault-search input')!,
      count: desk.querySelector('.bz-password-vault-count')!,
      shown: desk.querySelector('.bz-password-vault-count')!,
      title: desk.querySelector('.bz-password-vault-listhead h1')!,
      lock: desk.querySelector('.bz-password-vault-lock')!,
      toast: desk.querySelector('.bz-password-vault-toast')!,
      modal: desk.querySelector('.bz-password-vault-modal')!,
      confirm: desk.querySelector('.bz-password-vault-pop2')!,
      platEdit: desk.querySelector('.bz-password-vault-platedit')!,
    };
    // 移动实例
    const mob = document.createElement('div');
    mob.className = 'bz-password-vault-mob';
    mob.innerHTML = this.mobHTML();
    this.root.appendChild(mob);
    this.mob = {
      list: mob.querySelector('.bz-password-vault-moblist')!,
      search: mob.querySelector('.bz-password-vault-mobsearch input')!,
      page: mob.querySelector('.bz-password-vault-mobpage')!,
      pageBody: mob.querySelector('.bz-password-vault-mobbody')!,
      pageTitle: mob.querySelector('.bz-password-vault-mobpage .head .t')!,
      lock: mob.querySelector('.bz-password-vault-lock')!,
      toast: mob.querySelector('.bz-password-vault-toast')!,
      modal: mob.querySelector('.bz-password-vault-modal')!,
      confirm: mob.querySelector('.bz-password-vault-pop2')!,
      platEdit: mob.querySelector('.bz-password-vault-platedit')!,
    };

    // 绑定交互
    this.bindDesk();
    this.bindMob();
    this.bindDialogs();
    this.registerEscape();
    // 外部变更（保险箱/旧密码本）→ 重绘
    this.dataManager.onExternalChange = () => {
      this.renderAll();
    };
  }

  private deskHTML(): string {
    return `
      <div class="bz-password-vault-nav">
        <div class="bz-password-vault-logo">
          <div class="seal">${ICONS.seal}</div>
          <div class="name">密码本<small>PASSWORD VAULT</small></div>
        </div>
        <div class="bz-password-vault-navitem on" data-view="all">${ICONS.list}全部条目<span class="cnt" data-cnt="all"></span></div>
        <div class="bz-password-vault-navitem" data-view="fav">${ICONS.star}已收藏<span class="cnt" data-cnt="fav"></span></div>
      </div>
      <div class="bz-password-vault-list">
        <div class="bz-password-vault-listhead">
          <h1>全部条目</h1>
          <div class="bz-password-vault-search">${ICONS.search}<input placeholder="搜索平台、账号、备注…"></div>
        </div>
        <div class="bz-password-vault-count"></div>
        <div class="bz-password-vault-rows"></div>
      </div>
      <div class="bz-password-vault-detail">
        <div class="bz-password-vault-empty">
          ${ICONS.lock}
          <div class="t">选择一条记录</div>
          <div class="d">左侧列表选中后，这里显示完整详情与操作</div>
        </div>
      </div>
      ${this.lockHTML('desk')}
      <div class="bz-password-vault-toast"></div>
      ${this.modalHTML('desk')}
      ${this.confirmHTML('desk')}
      ${this.platEditHTML('desk')}
    `;
  }

  private mobHTML(): string {
    return `
      <div class="bz-password-vault-mobbar">
        <div class="seal">${ICONS.seal}</div>
        <div class="t">密码本</div>
        <button class="bz-password-vault-mobclose" data-act="mob-close" aria-label="关闭">${ICONS.x}</button>
      </div>
      <div class="bz-password-vault-mobsearch">${ICONS.search}<input placeholder="搜索平台、账号、备注…"></div>
      <div class="bz-password-vault-moblist"></div>
      <button class="bz-password-vault-fab">${ICONS.plus}</button>
      <div class="bz-password-vault-mobpage">
        <div class="bz-password-vault-mobsheet">
          <div class="head">
            <button class="bz-password-vault-back">${ICONS.back}</button>
            <div class="t">详情</div>
            <button class="ic" data-act="menu">${ICONS.menuDots}</button>
          </div>
          <div class="bz-password-vault-mobbody"></div>
        </div>
      </div>
      ${this.lockHTML('mob')}
      <div class="bz-password-vault-toast"></div>
      ${this.modalHTML('mob')}
      ${this.confirmHTML('mob')}
      ${this.platEditHTML('mob')}
    `;
  }

  private lockHTML(which: 'desk' | 'mob'): string {
    return `
      <div class="bz-password-vault-lock" data-lock="${which}">
        <div class="seal">${ICONS.seal}</div>
        <h2 data-lock-title>设置主密码</h2>
        <input type="password" data-lock-p1 placeholder="主密码" autocomplete="off">
        <input type="password" data-lock-p2 placeholder="再次输入确认" autocomplete="off" style="display:none">
        <div class="err" data-lock-err></div>
        <button class="go" data-lock-go>解锁保险库</button>
      </div>`;
  }

  private modalHTML(which: 'desk' | 'mob'): string {
    return `
      <div class="bz-password-vault-modal" data-modal="${which}">
        <div class="bz-password-vault-dialog">
          <h3>添加密码条目</h3>
          <div class="sub">带 * 为必填 · 平台与账号密码不可为空</div>
          <label>平台 *</label><input data-f="platform" placeholder="如 GitHub">
          <label>链接（可选）</label><input data-f="url" placeholder="https://…">
          <label>账号 *</label><input data-f="account" placeholder="登录账号 / 邮箱 / 手机号">
          <label>密码 *</label>
          <div class="pwdrow"><input data-f="password" placeholder="密码"><button class="gen" data-act="gen">生成</button></div>
          <label>备注（可选）</label><input data-f="note" placeholder="备用信息…">
          <div class="err" data-f-err></div>
          <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="save" data-act="save">保存</button></div>
        </div>
      </div>`;
  }

  private confirmHTML(which: 'desk' | 'mob'): string {
    return `
      <div class="bz-password-vault-pop2" data-confirm="${which}">
        <div class="card"><h3>确认</h3><div class="msg"></div>
        <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="ok" data-act="ok">确定</button></div></div>
      </div>`;
  }

  private platEditHTML(which: 'desk' | 'mob'): string {
    return `
      <div class="bz-password-vault-pop2 bz-password-vault-platedit" data-plat-edit="${which}">
        <div class="card">
          <h3>编辑平台信息</h3>
          <div class="sub">改名/改链接将应用到该平台全部账号</div>
          <label>平台名 *</label><input data-f="platform" placeholder="如 GitHub">
          <label>链接（可选）</label><input data-f="url" placeholder="https://…">
          <div class="err"></div>
          <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="save" data-act="save">保存</button></div>
        </div>
      </div>`;
  }

  // ---------- 交互绑定 ----------
  private bindDesk() {
    const root = this.root!;
    // 导航
    root.querySelectorAll('.bz-password-vault-navitem').forEach((it) => {
      it.addEventListener('click', () => {
        root.querySelectorAll('.bz-password-vault-navitem').forEach((x) => x.classList.remove('on'));
        it.classList.add('on');
        this.view = (it.getAttribute('data-view') as 'all' | 'fav');
        this.renderAll();
      });
    });
    // 搜索防抖
    this.desk.search.addEventListener('input', (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchKw = v;
        this.renderAll();
      }, 180);
    });
    // 点击卡片外遮罩 → 关闭窗口
    root.addEventListener('click', (e) => {
      if (e.target === root && this.root!.style.display === 'flex') {
        this.hide();
      }
    });
  }

  private bindMob() {
    const root = this.root!;
    // 搜索
    this.mob.search.addEventListener('input', (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchKw = v;
        this.renderAll();
      }, 180);
    });
    // FAB 添加
    root.querySelector('.bz-password-vault-fab')?.addEventListener('click', () => this.openEntryDialog(null));
    // 移动端顶栏关闭按钮（无系统级手势，显式关闭入口）
    root.querySelector('[data-act="mob-close"]')?.addEventListener('click', () => this.hide());
    // 返回
    root.querySelector('.bz-password-vault-back')?.addEventListener('click', () => this.mob.page.classList.remove('open'));
    // 次级面板遮罩点击关闭（点击遮罩本身才关闭，面板内不关）
    this.mob.page.addEventListener('click', (e) => {
      if (e.target === this.mob.page) this.mob.page.classList.remove('open');
    });
    // 详情页右上菜单
    root.querySelector('.bz-password-vault-mobpage .head [data-act="menu"]')?.addEventListener('click', () => {
      const cur = this.mobPagePlatform;
      if (cur) {
        openItemSheet(this.buildPlatformActions(cur), {
          sheetHead: this.buildSheetHead(cur, '', ''),
        });
      }
    });
  }

  private mobPagePlatform: string | null = null;

  /** 绑定添加/编辑弹窗的保存/取消/生成按钮（双实例各一份） */
  private bindDialogs() {
    this.root!.querySelectorAll('.bz-password-vault-modal').forEach((modal) => {
      const dlg = modal.querySelector('.bz-password-vault-dialog')!;
      const errEl = dlg.querySelector('[data-f-err]') as HTMLElement;
      const get = (f: string) => (dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value.trim();
      // 点击遮罩（非弹窗本体）关闭
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeEntryDialog();
      });
      // 生成
      dlg.querySelector('[data-act="gen"]')?.addEventListener('click', () => {
        (dlg.querySelector('[data-f="password"]') as HTMLInputElement).value = this.generatePassword();
        this.toast('已生成新密码');
      });
      // 取消
      dlg.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
        this.closeEntryDialog();
      });
      // 保存
      dlg.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
        const platform = get('platform');
        if (!platform) {
          errEl.textContent = '平台不能为空';
          return;
        }
        if (!get('account') || !get('password')) {
          errEl.textContent = '账号和密码不能为空';
          return;
        }
        const item = {
          platform,
          url: get('url'),
          account: get('account'),
          password: get('password'),
          note: get('note'),
        };
        try {
          if (this.editingId) {
            await this.dataManager.updateItem(this.editingId, item);
            this.selPlatform = item.platform;
            this.selAccount = this.editingId;
          } else {
            await this.dataManager.addItem(item);
            this.selPlatform = item.platform;
            this.selAccount = this.dataManager.pwData[0]?.id ?? null;
          }
          this.closeEntryDialog();
          this.renderAll();
          this.toast('已保存');
        } catch (e: any) {
          errEl.textContent = '保存失败：' + e.message;
        }
      });
    });
    // 平台编辑弹窗
    this.root!.querySelectorAll('.bz-password-vault-platedit').forEach((el) => {
      const card = el as HTMLElement;
      const errEl = card.querySelector('.err') as HTMLElement;
      let currentPlatform: string | null = null;
      // 点击遮罩（非弹窗本体）关闭
      card.addEventListener('click', (e) => {
        if (e.target === card) card.classList.remove('open');
      });
      card.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
        card.classList.remove('open');
      });
      card.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
        const name = (card.querySelector('[data-f="platform"]') as HTMLInputElement).value.trim();
        if (!name) {
          errEl.textContent = '平台名不能为空';
          return;
        }
        if (!currentPlatform) return;
        const url = (card.querySelector('[data-f="url"]') as HTMLInputElement).value;
        try {
          await this.dataManager.updatePlatform(currentPlatform, { platform: name, url });
          this.selPlatform = name;
          this.selAccount = null;
          card.classList.remove('open');
          this.renderAll();
          this.toast('平台信息已更新');
        } catch (e: any) {
          errEl.textContent = '保存失败：' + e.message;
        }
      });
      // openPlatformEdit 需回写当前平台
      (card as any).__setCurrent = (p: string) => {
        currentPlatform = p;
      };
    });
  }

  // ---------- 渲染 ----------
  renderAll() {
    if (!this.root) return;
    this.renderLock();
    this.renderDeskList();
    this.renderDeskDetail();
    this.renderMobList();
  }

  private renderLock() {
    const unlocked = this.dataManager.unlocked;
    const mode = unlocked ? '' : 'open';
    this.root!.querySelectorAll('.bz-password-vault-lock').forEach((el) => {
      (el as HTMLElement).classList.toggle('open', !!mode);
    });
    if (unlocked) return;
    // 首设/解锁标题与副文本
    const first = !this.dataManager.unlocked; // 未解锁时无法知道首设；由 SafeManager.exists 判定（异步）
    // 解锁态由 unlock 流程控制；这里只负责锁屏显示
  }

  /** 解锁成功后重载数据：锁屏打开时 load() 因未解锁而失败，pwData 为空，
   *  解锁成功必须重新 load 才能渲染出清单（回归：解锁不重载 → 空列表） */
  private async reloadAfterUnlock(): Promise<void> {
    try {
      await this.dataManager.load();
    } catch (e: any) {
      notice('加载数据失败：' + e.message, 'error');
    }
  }

  /** 渲染桌面列表（平台聚合 / 搜索展平） */
  private renderDeskList() {
    const rows = this.desk.rows;
    const kw = this.searchKw;
    const count = this.dataManager.pwData.length;
    this.desk.count.textContent = count + ' 条';
    this.root!.querySelector('[data-cnt="all"]')!.textContent = String(count);
    this.root!.querySelector('[data-cnt="fav"]')!.textContent = String(this.dataManager.pwData.filter((d) => d.fav).length);
    this.desk.title.textContent = this.view === 'fav' ? '已收藏' : '全部条目';

    if (kw) {
      // 搜索态：展平为账号行
      const hits = this.dataManager
        .search(kw)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
      this.desk.shown.textContent = hits.length + ' 条匹配';
      rows.innerHTML = '';
      if (!hits.length) {
        rows.innerHTML = '<div class="bz-password-vault-empty" style="flex:1"><div class="t">没有匹配的条目</div><div class="d">换个关键词，或清空搜索</div></div>';
        return;
      }
      hits.forEach((d) => {
        const r = document.createElement('div');
        r.className = 'bz-password-vault-row' + (d.id === this.selAccount ? ' on' : '');
        r.innerHTML = `${avatarHTML(d.platform, d.url)}
          <div class="mid"><div class="pl">${this.esc(d.platform)}${d.fav ? ' <span class="star">★</span>' : ''}</div><div class="ac">${this.esc(d.account || '(无账号)')}</div></div>
          <div class="tm">${relTime(d.createdAt)}</div>`;
        r.addEventListener('click', (e) => {
          this.selAccount = d.id;
          this.renderAll();
        });
        // bz 统一右键菜单 / 长按抽屉（item-actions）
        attachItemActions(r, this.buildAccountActions(d), {
          sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
        });
        rows.appendChild(r);
      });
      hydrateAvatars(rows);
      return;
    }
    // 非搜索：平台聚合行
    let plats = this.dataManager.platforms();
    if (this.view === 'fav') plats = plats.filter((p) => this.dataManager.hasFav(p.platform));
    this.desk.shown.textContent = plats.length + ' 个平台';
    rows.innerHTML = '';
    if (!plats.length) {
      rows.innerHTML =
        this.view === 'fav'
          ? '<div class="bz-password-vault-empty" style="flex:1"><div class="t">还没有收藏</div><div class="d">点条目里的 ★ 收藏常用账号</div></div>'
          : `<div class="bz-password-vault-empty" style="flex:1"><div class="t">保险库还是空的</div><div class="d">点击右上角「添加密码」开始收录</div>
              <button class="act" data-act="add-first">添加第一条密码</button></div>`;
      rows.querySelector('[data-act="add-first"]')?.addEventListener('click', () => this.openEntryDialog(null));
      return;
    }
    plats.forEach((p) => {
      const r = document.createElement('div');
      r.className = 'bz-password-vault-plrow' + (p.platform === this.selPlatform ? ' on' : '');
      const recent = p.accounts[0];
      const favStar = this.dataManager.hasFav(p.platform) ? ' <span class="star">★</span>' : '';
      const countBadge = p.accounts.length > 1 ? `<span class="bz-password-vault-plcount">${p.accounts.length}</span>` : '';
      r.innerHTML = `${avatarHTML(p.platform, recent?.url)}
        <div class="mid"><div class="pl">${this.esc(p.platform)}${favStar}${countBadge}</div><div class="ac">${recent ? this.esc(recent.account || '(无账号)') : ''}</div></div>
        <div class="tm">${relTime(recent && recent.createdAt)}</div>`;
      r.addEventListener('click', (e) => {
        this.selPlatform = p.platform;
        this.selAccount = null;
        this.renderAll();
      });
      // bz 统一右键菜单 / 长按抽屉（item-actions）
      attachItemActions(r, this.buildPlatformActions(p.platform), {
        sheetHead: this.buildSheetHead(p.platform, recent?.account || '', recent?.createdAt || ''),
      });
      rows.appendChild(r);
    });
    hydrateAvatars(rows);
  }

  /** 渲染桌面详情（平台视图 / 账号详情） */
  private renderDeskDetail() {
    const detail = this.desk.detail;
    const kw = this.searchKw;
    if (kw) {
      const d = this.dataManager.pwData.find((x) => x.id === this.selAccount);
      if (d) {
        this.renderAccountDetail(d);
        return;
      }
      detail.innerHTML = '<div class="bz-password-vault-empty"><div class="t">选择一条结果</div><div class="d">点击左侧结果查看详情</div></div>';
      return;
    }
    const platform = this.selPlatform;
    if (!platform) {
      detail.innerHTML = `<div class="bz-password-vault-empty">${ICONS.lock}<div class="t">选择一个平台</div><div class="d">左侧选择平台后，这里显示其全部账号</div></div>`;
      return;
    }
    let accs = this.dataManager.accountsOf(platform);
    if (this.view === 'fav') accs = accs.filter((d) => d.fav);
    const favStar = this.dataManager.hasFav(platform) ? ' <span style="color:var(--pwv-warn)">★</span>' : '';
    detail.innerHTML = `<div class="bz-password-vault-detailhead">
      <div class="ttl"><h2>${this.esc(platform)}${favStar}</h2>
        ${accs[0] && accs[0].url ? `<a class="url" href="${this.esc(accs[0].url)}" target="_blank" rel="noopener">${this.esc(accs[0].url)} ↗</a>` : '<div class="url" style="color:var(--pwv-faint)">无链接</div>'}</div>
    </div>
    <div class="bz-password-vault-accthead">
      <div class="t">${accs.length} 个账号</div>
      <button class="add" data-act="plat-add">+ 在该平台新增账号</button>
    </div>
    <div class="bz-password-vault-accts"></div>`;
    detail.querySelector('[data-act="plat-add"]')?.addEventListener('click', () =>
      this.openEntryDialog(null, { platform, url: accs[0]?.url || '' })
    );
    const acctsEl = detail.querySelector('.bz-password-vault-accts')!;
    if (!accs.length) {
      acctsEl.innerHTML = '<div class="bz-password-vault-empty"><div class="t">该平台暂无账号</div></div>';
      return;
    }
    accs.forEach((d) => {
      const shown = !!this.shownIds[d.id];
      const card = document.createElement('div');
      card.className = 'bz-password-vault-acctcard';
      card.innerHTML = `<div class="accrow">
        <div class="name">${this.esc(d.account || '(无账号)')}${d.fav ? '<span class="star">★</span>' : ''}</div>
        <button class="copyac" data-act="copy-ac">${ICONS.copy} 复制账号</button>
      </div>
      <div class="pwrow">
        <div class="pw ${shown ? '' : 'mask'}">${shown ? this.esc(d.password) : dots(d.password)}</div>
        <button class="mini" data-act="eye">${shown ? ICONS.eyeoff : ICONS.eye}</button>
        <button class="mini" data-act="copy-pw">${ICONS.copy}</button>
      </div>
      ${d.note ? `<div class="note">${this.esc(d.note)}</div>` : ''}
      <div class="meta">创建于 ${this.esc(new Date(d.createdAt).toLocaleDateString('zh-CN'))}${d.url ? ' · <a href="' + this.esc(d.url) + '" target="_blank" rel="noopener">' + this.esc(d.url.replace('https://', '')) + ' ↗</a>' : ''}</div>`;
      card.querySelectorAll('[data-act]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.handleAccountAction(d, b.getAttribute('data-act') || '', 'desk');
        })
      );
      // bz 统一右键菜单 / 长按抽屉（编辑/删除/收藏收在这里，无 ⋮ 按钮）
      attachItemActions(card, this.buildAccountActions(d), {
        sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
      });
      acctsEl.appendChild(card);
    });
  }

  /** 渲染账号详情（搜索态，同构单卡） */
  private renderAccountDetail(d: PasswordVaultEntry) {
    const shown = !!this.shownIds[d.id];
    const accs = this.dataManager.accountsOf(d.platform);
    const favStar = this.dataManager.hasFav(d.platform) ? ' <span style="color:var(--pwv-warn)">★</span>' : '';
    this.desk.detail.innerHTML = `<div class="bz-password-vault-detailhead">
      <div class="ttl"><h2>${this.esc(d.platform)}${favStar}</h2>
        ${d.url ? `<a class="url" href="${this.esc(d.url)}" target="_blank" rel="noopener">${this.esc(d.url)} ↗</a>` : '<div class="url" style="color:var(--pwv-faint)">无链接</div>'}</div>
    </div>
    <div class="bz-password-vault-accthead">
      <div class="t">${accs.length} 个账号</div>
      <button class="add" data-act="plat-add">+ 在该平台新增账号</button>
    </div>
    <div class="bz-password-vault-accts">
      <div class="bz-password-vault-acctcard">
        <div class="accrow">
          <div class="name">${this.esc(d.account || '(无账号)')}${d.fav ? '<span class="star">★</span>' : ''}</div>
          <button class="copyac" data-act="copy-ac">${ICONS.copy} 复制账号</button>
        </div>
        <div class="pwrow">
          <div class="pw ${shown ? '' : 'mask'}">${shown ? this.esc(d.password) : dots(d.password)}</div>
          <button class="mini" data-act="eye">${shown ? ICONS.eyeoff : ICONS.eye}</button>
          <button class="mini" data-act="copy-pw">${ICONS.copy}</button>
        </div>
        ${d.note ? `<div class="note">${this.esc(d.note)}</div>` : ''}
        <div class="meta">创建于 ${this.esc(new Date(d.createdAt).toLocaleDateString('zh-CN'))}${d.url ? ' · <a href="' + this.esc(d.url) + '" target="_blank" rel="noopener">' + this.esc(d.url.replace('https://', '')) + ' ↗</a>' : ''}</div>
      </div>
    </div>`;
    this.desk.detail.querySelector('[data-act="plat-add"]')?.addEventListener('click', () =>
      this.openEntryDialog(null, { platform: d.platform, url: accs[0]?.url || '' })
    );
    const card = this.desk.detail.querySelector('.bz-password-vault-acctcard') as HTMLElement;
    card.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.handleAccountAction(d, b.getAttribute('data-act') || '', 'desk');
      })
    );
    attachItemActions(card, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
  }

  /** 账号级动作分发（桌面卡片/详情/搜索态共用） */
  private async handleAccountAction(d: PasswordVaultEntry, act: string, which: 'desk' | 'mob') {
    const t = (m: string, err = false) => this.toast(m, err);
    if (act === 'copy-ac') {
      (await this.copy(d.account || '')) ? t('账号已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
    } else if (act === 'copy-pw') {
      (await this.copy(d.password || '')) ? t('密码已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
    } else if (act === 'eye') {
      this.shownIds[d.id] = !this.shownIds[d.id];
      this.renderAll();
    } else if (act === 'edit') {
      this.openEntryDialog(d);
    } else if (act === 'fav') {
      await this.dataManager.toggleFav(d.id);
      this.renderAll();
    } else if (act === 'del') {
      this.askConfirm('删除密码条目', `确定删除账号 "${d.account}" 吗？此操作不可撤销。`, true, async () => {
        await this.dataManager.deleteItem(d.id);
        if (this.selAccount === d.id) this.selAccount = null;
        this.renderAll();
        t('已删除');
      });
    }
  }

  // ---------- 移动端渲染 ----------
  private renderMobList() {
    const list = this.mob.list;
    const kw = this.searchKw;
    list.innerHTML = '';
    if (kw) {
      const hits = this.dataManager
        .search(kw)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
      if (!hits.length) {
        list.innerHTML = '<div class="bz-password-vault-mobempty"><div class="t">没有匹配的条目</div><div class="d">换个关键词试试</div></div>';
        return;
      }
      hits.forEach((d) => {
        const c = document.createElement('div');
        c.className = 'bz-password-vault-mobcard';
        c.innerHTML = `${avatarHTML(d.platform, d.url, 'av')}
          <div class="mid"><div class="pl">${this.esc(d.platform)}${d.fav ? ' <span class="star">★</span>' : ''}</div><div class="ac">${this.esc(d.account || '(无账号)')}</div></div>
          <div class="go">${ICONS.go}</div>`;
        this.bindAccountCard(c, d);
        list.appendChild(c);
      });
      hydrateAvatars(list);
      return;
    }
    let plats = this.dataManager.platforms();
    if (this.view === 'fav') plats = plats.filter((p) => this.dataManager.hasFav(p.platform));
    if (!plats.length) {
      list.innerHTML =
        this.view === 'fav'
          ? '<div class="bz-password-vault-mobempty"><div class="t">还没有收藏</div><div class="d">点条目里的 ★ 收藏常用账号</div></div>'
          : `<div class="bz-password-vault-mobempty"><div class="t">保险库还是空的</div><div class="d">点击右下角 + 添加第一条密码</div><button class="act" data-act="add-first">添加密码</button></div>`;
      list.querySelector('[data-act="add-first"]')?.addEventListener('click', () => this.openEntryDialog(null));
      return;
    }
    plats.forEach((p) => {
      const recent = p.accounts[0];
      const c = document.createElement('div');
      c.className = 'bz-password-vault-mobcard';
      const favStar = this.dataManager.hasFav(p.platform) ? ' <span class="star">★</span>' : '';
      const cnt = p.accounts.length > 1 ? `<span class="cnt">${p.accounts.length}</span>` : '';
      c.innerHTML = `${avatarHTML(p.platform, recent?.url, 'av')}
        <div class="mid"><div class="pl">${this.esc(p.platform)}${favStar}${cnt}</div><div class="ac">${recent ? this.esc(recent.account || '(无账号)') : ''}</div></div>
        <div class="go">${ICONS.go}</div>`;
      this.bindCard(c, p);
      list.appendChild(c);
    });
    hydrateAvatars(list);
  }

  /** 平台卡：bz 统一右键/长按抽屉；点击 → 平台详情页 */
  private bindCard(card: HTMLElement, p: PlatformGroup) {
    // bz 统一右键菜单（桌面）/ 长按抽屉（移动）
    attachItemActions(card, this.buildPlatformActions(p.platform), {
      sheetHead: this.buildSheetHead(p.platform, p.accounts[0]?.account || '', p.accounts[0]?.createdAt || ''),
    });
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      this.openPage(p);
    });
  }

  /** 账号卡（搜索态）：bz 统一右键/长按抽屉；点击 → 账号详情页 */
  private bindAccountCard(card: HTMLElement, d: PasswordVaultEntry) {
    // bz 统一右键菜单（桌面）/ 长按抽屉（移动）
    attachItemActions(card, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      this.openAccountPage(d);
    });
  }

  /** 平台详情页 */
  private openPage(p: PlatformGroup) {
    const accs = p.accounts;
    let body = `<div class="bz-password-vault-mobplathead">
      <div><div style="font-size:17px;font-weight:700">${this.esc(p.platform)}${this.dataManager.hasFav(p.platform) ? ' <span style="color:var(--pwv-warn)">★</span>' : ''}</div>${accs[0] && accs[0].url ? `<a style="font-size:12px;color:var(--pwv-gold-ink)" href="${this.esc(accs[0].url)}" target="_blank" rel="noopener">${this.esc(accs[0].url)} ↗</a>` : '<div style="font-size:12px;color:var(--pwv-faint)">无链接</div>'}</div>
      <button class="bz-password-vault-btn gold" data-act="add">+ 新增账号</button>
    </div>`;
    if (!accs.length) {
      body += '<div class="bz-password-vault-mobempty"><div class="t">该平台暂无账号</div></div>';
    } else {
      accs.forEach((d) => {
        const shown = !!this.shownIds[d.id];
        body += `<div class="bz-password-vault-seg">
          <div class="seghead"><div class="acc">${this.esc(d.account || '(无账号)')}${d.fav ? ' <span class="star">★</span>' : ''}</div>
            <button class="copyac" data-act="copy-ac" data-id="${d.id}">${ICONS.copy} 复制账号</button></div>
          <div class="pwdline"><div class="pw ${shown ? '' : 'mask'}">${shown ? this.esc(d.password) : dots(d.password)}</div>
            <button class="mini" data-act="eye" data-id="${d.id}">${shown ? ICONS.eyeoff : ICONS.eye}</button>
            <button class="mini" data-act="copy-pw" data-id="${d.id}">${ICONS.copy}</button></div>
          ${d.note ? `<div class="note">${this.esc(d.note)}</div>` : ''}
          <div class="segmeta">创建于 ${this.esc(new Date(d.createdAt).toLocaleDateString('zh-CN'))}${d.url ? ' · ' + this.esc(d.url.replace('https://', '')) : ''}</div>
        </div>`;
      });
    }
    this.mob.pageBody.innerHTML = body;
    this.mob.pageBody.querySelector('[data-act="add"]')?.addEventListener('click', () => {
      this.mob.page.classList.remove('open');
      this.openEntryDialog(null, { platform: p.platform, url: accs[0]?.url || '' });
    });
    this.mob.pageBody.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = b.getAttribute('data-act') || '';
        const id = b.getAttribute('data-id') || '';
        const d = this.dataManager.pwData.find((x) => x.id === id);
        if (!d && a !== 'menu') return;
        void this.handleAccountAction(d!, a, 'mob');
      })
    );
    // 长按抽屉（编辑/删除/收藏收在这里，无 ⋮ 按钮）
    this.mob.pageBody.querySelectorAll('.bz-password-vault-seg').forEach((seg) => {
      const id = seg.querySelector('[data-id]')?.getAttribute('data-id') || '';
      const d = this.dataManager.pwData.find((x) => x.id === id);
      if (d) attachItemActions(seg as HTMLElement, this.buildAccountActions(d), {
        sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
      });
    });
    this.mob.pageTitle.textContent = p.platform;
    this.mobPagePlatform = p.platform;
    this.mob.page.classList.add('open');
  }

  /** 账号详情页（搜索态点账号卡，同构单卡） */
  private openAccountPage(d: PasswordVaultEntry) {
    const shown = !!this.shownIds[d.id];
    this.mob.pageBody.innerHTML = `<div class="bz-password-vault-mobplathead">
      <div><div style="font-size:17px;font-weight:700">${this.esc(d.platform)}${this.dataManager.hasFav(d.platform) ? ' <span style="color:var(--pwv-warn)">★</span>' : ''}</div>${d.url ? `<a style="font-size:12px;color:var(--pwv-gold-ink)" href="${this.esc(d.url)}" target="_blank" rel="noopener">${this.esc(d.url)} ↗</a>` : '<div style="font-size:12px;color:var(--pwv-faint)">无链接</div>'}</div>
      <button class="bz-password-vault-btn gold" data-act="add">+ 新增账号</button>
    </div>
    <div class="bz-password-vault-seg">
      <div class="seghead"><div class="acc">${this.esc(d.account || '(无账号)')}${d.fav ? ' <span class="star">★</span>' : ''}</div>
        <button class="copyac" data-act="copy-ac">${ICONS.copy} 复制账号</button></div>
      <div class="pwdline"><div class="pw ${shown ? '' : 'mask'}">${shown ? this.esc(d.password) : dots(d.password)}</div>
        <button class="mini" data-act="eye">${shown ? ICONS.eyeoff : ICONS.eye}</button>
        <button class="mini" data-act="copy-pw">${ICONS.copy}</button></div>
      ${d.note ? `<div class="note">${this.esc(d.note)}</div>` : ''}
      <div class="segmeta">创建于 ${this.esc(new Date(d.createdAt).toLocaleDateString('zh-CN'))}${d.url ? ' · ' + this.esc(d.url.replace('https://', '')) : ''}</div>
    </div>`;
    this.mob.pageBody.querySelector('[data-act="add"]')?.addEventListener('click', () => {
      this.mob.page.classList.remove('open');
      this.openEntryDialog(null, { platform: d.platform, url: d.url || '' });
    });
    this.mob.pageBody.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = b.getAttribute('data-act') || '';
        void this.handleAccountAction(d, a, 'mob');
      })
    );
    const seg = this.mob.pageBody.querySelector('.bz-password-vault-seg') as HTMLElement;
    attachItemActions(seg, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
    this.mob.pageTitle.textContent = d.platform;
    this.mobPagePlatform = d.platform;
    this.mob.page.classList.add('open');
  }

  // ---------- 动作定义（bz 统一右键菜单 / 长按抽屉，item-actions） ----------
  /** 抽屉头部（bz 统一抽屉样式：标题 + 副标题） */
  private buildSheetHead(title: string, sub: string, time: string): HTMLElement {
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
    const t = document.createElement('div');
    t.className = 'bz-item-sheet-title';
    t.textContent = title;
    info.appendChild(t);
    const s = document.createElement('div');
    s.className = 'bz-item-sheet-sub';
    s.textContent = `${sub}${sub ? ' · ' : ''}${relTime(time)}`;
    info.appendChild(s);
    body.appendChild(info);
    head.appendChild(body);
    return head;
  }

  // ---------- 动作定义（bz 统一右键菜单 / 长按抽屉，item-actions） ----------
  private buildAccountActions(d: PasswordVaultEntry): ItemAction[] {
    const t = (m: string, err = false) => this.toast(m, err);
    return [
      {
        icon: 'copy',
        label: '复制账号',
        onClick: () => {
          void (async () => {
            (await this.copy(d.account || '')) ? t('账号已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
          })();
        },
      },
      {
        icon: 'key',
        label: '复制密码',
        onClick: () => {
          void (async () => {
            (await this.copy(d.password || '')) ? t('密码已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
          })();
        },
      },
      {
        icon: 'star',
        label: d.fav ? '取消收藏' : '收藏',
        onClick: () => {
          void (async () => {
            await this.dataManager.toggleFav(d.id);
            this.renderAll();
          })();
        },
      },
      {
        icon: 'external-link',
        label: '打开链接',
        onClick: () => {
          if (d.url) this.openExternal(d.url);
          else t('该条目没有链接', true);
        },
      },
      { icon: 'pencil', label: '编辑', onClick: () => this.openEntryDialog(d) },
      {
        icon: 'trash-2',
        label: '删除',
        kind: 'danger',
        onClick: () =>
          this.askConfirm('删除密码条目', `确定删除账号 "${d.account}" 吗？此操作不可撤销。`, true, () => {
            void (async () => {
              await this.dataManager.deleteItem(d.id);
              this.renderAll();
              t('已删除');
            })();
          }),
      },
    ];
  }

  private buildPlatformActions(platform: string): ItemAction[] {
    const accs = this.dataManager.accountsOf(platform);
    const recent = accs[0];
    const count = accs.length;
    const t = (m: string, err = false) => this.toast(m, err);
    const actions: ItemAction[] = [
      {
        icon: 'plus',
        label: '在该平台新增账号',
        onClick: () => this.openEntryDialog(null, { platform, url: recent?.url || '' }),
      },
    ];
    if (recent) {
      actions.push({
        icon: 'copy',
        label: '复制最近账号',
        onClick: () => {
          void (async () => {
            (await this.copy(recent.account || '')) ? t('最近账号已复制（60 秒后自动清空）') : t('复制失败', true);
          })();
        },
      });
      actions.push({
        icon: 'key',
        label: '复制最近密码',
        onClick: () => {
          void (async () => {
            (await this.copy(recent.password || '')) ? t('最近密码已复制（60 秒后自动清空）') : t('复制失败', true);
          })();
        },
      });
    }
    actions.push({ icon: 'pencil', label: '编辑平台信息', onClick: () => this.openPlatformEdit(platform) });
    actions.push({
      icon: 'trash-2',
      label: '删除整个平台',
      kind: 'danger',
      onClick: () =>
        this.askConfirm('删除整个平台', `将删除「${platform}」的 ${count} 个账号，此操作不可撤销。确定继续？`, true, () => {
          void (async () => {
            const n = await this.dataManager.removePlatform(platform);
            this.selPlatform = null;
            this.renderAll();
            t(`已删除平台与 ${n} 个账号`);
          })();
        }),
    });
    return actions;
  }

  // ---------- 添加/编辑弹窗 ----------
  openEntryDialog(editItem: PasswordVaultEntry | null = null, preset?: { platform?: string; url?: string }) {
    if (!this.dataManager.unlocked) {
      notice('请先解锁保险库');
      return;
    }
    // 双实例同步显示（桌面 + 移动共享同一数据，同一弹窗内容）
    this.editingId = editItem ? editItem.id : null;
    const title = editItem ? '编辑密码条目' : '添加密码条目';
    const subtitle = '带 * 为必填 · 平台与账号密码不可为空';
    this.root!.querySelectorAll('.bz-password-vault-modal').forEach((modal) => {
      const dlg = modal.querySelector('.bz-password-vault-dialog')!;
      dlg.querySelector('h3')!.textContent = title;
      dlg.querySelector('.sub')!.textContent = subtitle;
      const fields = ['platform', 'url', 'account', 'password', 'note'] as const;
      fields.forEach((f) => {
        const input = dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement;
        input.value = editItem ? editItem[f] || '' : preset && f !== 'password' ? preset[f as 'platform' | 'url'] || '' : '';
      });
      if (!editItem) {
        const staged = this.pendingPassword;
        this.pendingPassword = null;
        (dlg.querySelector('[data-f="password"]') as HTMLInputElement).value = staged || this.generatePassword();
      }
      (dlg.querySelector('[data-f-err]') as HTMLElement).textContent = '';
      modal.classList.add('open');
    });
    // 焦点
    const first = this.root!.querySelector('.bz-password-vault-modal [data-f="platform"]') as HTMLInputElement;
    first?.focus();
  }

  private closeEntryDialog() {
    this.root!.querySelectorAll('.bz-password-vault-modal').forEach((m) => m.classList.remove('open'));
    this.editingId = null;
    this.pendingPassword = null;
  }

  // ---------- 平台编辑弹窗 ----------
  private openPlatformEdit(platform: string) {
    const accs = this.dataManager.accountsOf(platform);
    const d = accs[0] || ({} as PasswordVaultEntry);
    this.root!.querySelectorAll('.bz-password-vault-platedit').forEach((el) => {
      const card = el as HTMLElement;
      card.querySelector('h3')!.textContent = '编辑平台 · ' + platform;
      (card.querySelector('[data-f="platform"]') as HTMLInputElement).value = platform === '(无平台)' ? '' : platform;
      (card.querySelector('[data-f="url"]') as HTMLInputElement).value = d.url || '';
      (card.querySelector('.err') as HTMLElement).textContent = '';
      (card as any).__setCurrent?.(platform);
      card.classList.add('open');
    });
  }

  // ---------- 确认框（原型自绘，双实例同步） ----------
  askConfirm(title: string, message: string, danger: boolean, onYes: () => void) {
    this.root!.querySelectorAll('.bz-password-vault-pop2:not(.bz-password-vault-platedit)').forEach((pop) => {
      const card = pop.querySelector('.card')!;
      card.querySelector('h3')!.textContent = title;
      card.querySelector('.msg')!.textContent = message;
      const ok = card.querySelector('.ok') as HTMLButtonElement;
      ok.textContent = danger ? '删除' : '确定';
      ok.classList.toggle('danger', !!danger);
      pop.classList.add('open');
      (pop as HTMLElement).dataset.confirmCb = 'pending';
      // 点击遮罩（非弹窗本体）关闭
      if (!(pop as HTMLElement).dataset.maskBound) {
        (pop as HTMLElement).dataset.maskBound = '1';
        pop.addEventListener('click', (e) => {
          if (e.target === pop) {
            pop.classList.remove('open');
            (pop as HTMLElement).dataset.confirmCb = '';
          }
        });
      }
    });
    // 绑定确认按钮（一次性）
    this.root!.querySelectorAll('.bz-password-vault-pop2:not(.bz-password-vault-platedit) .ok').forEach((ok) => {
      ok.addEventListener('click', () => {
        const pop = ok.closest('.bz-password-vault-pop2') as HTMLElement;
        pop.classList.remove('open');
        if (pop.dataset.confirmCb === 'pending') {
          pop.dataset.confirmCb = '';
          onYes();
        }
      });
    });
  }

  // ---------- toast（原型自绘） ----------
  toast(msg: string, isErr = false) {
    this.root!.querySelectorAll('.bz-password-vault-toast').forEach((el) => {
      el.textContent = msg;
      el.classList.toggle('err', !!isErr);
      el.classList.add('show');
    });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.root!.querySelectorAll('.bz-password-vault-toast').forEach((el) => el.classList.remove('show'));
    }, 1800);
  }

  // ---------- 复制 ----------
  private async copy(text: string): Promise<boolean> {
    try {
      await copySensitiveText(text);
      return true;
    } catch (e) {
      // 降级：textarea 选中法
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) armClipboardClear();
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }

  /** 打开外链（electron shell 优先，Obsidian 环境） */
  private openExternal(url: string): void {
    try {
      const w = window as any;
      const electron = w.require && w.require('electron');
      if (electron && electron.shell) {
        electron.shell.openExternal(url);
        return;
      }
    } catch (e) {
      /* fallthrough */
    }
    window.open(url, '_blank');
  }

  // ---------- 生成器 ----------
  generatePassword(): string {
    const length = parseInt(this.config.length) || 16;
    const charset = this.config.charset || DEFAULT_CHARSET;
    return secureRandomPassword(length, charset);
  }

  // ---------- 显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
    this.root!.style.display = 'flex';
    topifyZ(this.root!); // ADR-0067
    void this.loadAndRender();
  }

  hide() {
    if (!this.root) return;
    this.root.style.display = 'none';
    if (this.config.securityMode) {
      this.dataManager.lock();
      this.toast('安全模式：已自动上锁');
    }
  }

  private async loadAndRender() {
    // 未解锁：静默（锁屏本身就是等待输入主密码，不弹「未解锁」错误通知）
    if (!this.dataManager.unlocked) {
      this.renderAll();
      this.showLock();
      return;
    }
    try {
      await this.dataManager.load();
    } catch (e: any) {
      notice('加载数据失败：' + e.message, 'error');
    }
    this.renderAll();
  }

  /** 显示锁屏（未解锁态）；锁屏绑定一次 */
  private showLock() {
    // 由 SafeManager 判定首设：exists()
    void this.isFirstTime().then((firstTime) => {
      this.root!.querySelectorAll('.bz-password-vault-lock').forEach((lockEl) => {
        const lock = lockEl as HTMLElement;
        lock.classList.add('open');
        const title = lock.querySelector('[data-lock-title]')!;
        const p1 = lock.querySelector('[data-lock-p1]') as HTMLInputElement;
        const p2 = lock.querySelector('[data-lock-p2]') as HTMLInputElement;
        const go = lock.querySelector('[data-lock-go]') as HTMLButtonElement;
        const err = lock.querySelector('[data-lock-err]') as HTMLElement;
        title.textContent = firstTime ? '设置主密码' : '输入主密码';
        p1.value = '';
        p2.value = '';
        p2.style.display = firstTime ? 'block' : 'none';
        err.textContent = '';
        go.textContent = firstTime ? '设置并解锁' : '解锁保险库';
        // 绑定（一次性）
        if (!lock.dataset.bound) {
          lock.dataset.bound = '1';
          this.bindLock(lock);
        }
        // 打开输入框自动聚焦（requestAnimationFrame 确保可见后再聚焦）
        requestAnimationFrame(() => {
          try {
            p1.focus();
          } catch (e) {
            /* 忽略 */
          }
        });
      });
    });
  }

  private async isFirstTime(): Promise<boolean> {
    const safe = this.dataManager.safeManager;
    try {
      return !(await safe.exists());
    } catch (e) {
      return false;
    }
  }

  /** 锁屏交互（原型视觉 + 保险箱安全机制） */
  private bindLock(lock: HTMLElement) {
    const p1 = lock.querySelector('[data-lock-p1]') as HTMLInputElement;
    const p2 = lock.querySelector('[data-lock-p2]') as HTMLInputElement;
    const err = lock.querySelector('[data-lock-err]') as HTMLElement;
    const go = lock.querySelector('[data-lock-go]') as HTMLButtonElement;
    const title = lock.querySelector('[data-lock-title]') as HTMLElement;
    const safe = this.dataManager.safeManager;
    let busy = false; // 解锁处理中防重入
    const showErr = (m: string) => {
      err.textContent = m;
      setTimeout(() => {
        if (err.textContent === m) err.textContent = '';
      }, 2600);
    };
    const setMode = () => {
      void this.isFirstTime().then((first) => {
        title.textContent = first ? '设置主密码' : '输入主密码';
        p2.style.display = first ? 'block' : 'none';
        go.textContent = first ? '设置并解锁' : '解锁保险库';
      });
    };
    go.addEventListener('click', async () => {
      if (busy) return;
      const first = await this.isFirstTime();
      const pw = p1.value;
      if (!pw) {
        showErr('请输入主密码');
        return;
      }
      if (first) {
        if (pw !== p2.value) {
          showErr('两次密码不一致');
          return;
        }
        if (pw.length < 4) {
          showErr('主密码至少 4 位');
          return;
        }
        // 首设风险确认（Q13 保留）：勾选后才能继续
        void openFlowDialog({
          title: '设置主密码',
          message:
            '主密码不会存储，也无法找回。若遗忘密码，保险库及加密数据将永久丢失。确定继续吗？',
          actions: [
            { label: '取消', value: 'cancel' },
            { label: '我已了解并继续', value: 'ok', cta: true },
          ],
        }).then(async (v) => {
          if (v !== 'ok') {
            p1.value = '';
            p2.value = '';
            showErr('已取消设置');
            return;
          }
          busy = true;
          go.textContent = '处理中…';
          try {
            const ok = await safe.unlock(pw);
            if (ok) {
              this.closeLock();
              this.toast('保险库已解锁');
              await this.reloadAfterUnlock();
              this.renderAll();
            } else {
              showErr('设置失败：无法写入清单，请检查磁盘空间后重试');
            }
          } catch (e: any) {
            showErr('设置失败：' + e.message);
          } finally {
            busy = false;
            go.textContent = first ? '设置并解锁' : '解锁保险库';
          }
        });
        return;
      }
      // 非首设：冷却节流（P2）
      const remainMs = this.security.unlockCooldownUntil - Date.now();
      if (remainMs > 0) {
        showErr(`尝试过于频繁，请再等 ${Math.ceil(remainMs / 1000)} 秒`);
        return;
      }
      busy = true;
      go.textContent = '处理中…';
      try {
        const ok = await safe.unlock(pw);
        if (ok) {
          this.security.unlockFailStreak = 0;
          this.security.unlockCooldownUntil = 0;
          this.closeLock();
          this.toast('保险库已解锁');
          await this.reloadAfterUnlock();
          this.renderAll();
        } else {
          // 清单损坏（empty/corrupt）→ 重设确认
          const issue = safe.manifestIssue;
          if (issue === 'empty' || issue === 'corrupt') {
            void openFlowDialog({
              title: '清单疑似损坏',
              message:
                '保险箱清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。' +
                '重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？',
              actions: [
                { label: '暂不重设', value: 'cancel' },
                { label: '仍要重设', value: 'ok', cta: true },
              ],
            }).then((v) => {
              if (v === 'ok') {
                void safe.unlock(pw, true).then(async (ok) => {
                  if (ok) {
                    this.security.unlockFailStreak = 0;
                    this.security.unlockCooldownUntil = 0;
                    this.closeLock();
                    this.toast('已重设主密码（旧数据不可恢复）', true);
                    await this.reloadAfterUnlock();
                    this.renderAll();
                  } else {
                    showErr('重设失败：无法写入清单');
                  }
                });
              } else {
                showErr('未重设：请先检查或备份数据文件');
              }
            });
            return;
          }
          showErr('密码错误，请重试');
          // 连续失败递增冷却（1/2/4/8s 封顶）
          this.security.unlockFailStreak += 1;
          const delaySec = Math.min(2 ** (this.security.unlockFailStreak - 1), 8);
          this.security.unlockCooldownUntil = Date.now() + delaySec * 1000;
          showErr(`${delaySec} 秒后可再次尝试`);
          p1.value = '';
          p1.focus();
        }
      } finally {
        busy = false;
        go.textContent = first ? '设置并解锁' : '解锁保险库';
      }
    });
    p1.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (p2.style.display === 'block') p2.focus();
        else go.click();
      }
    });
    p2.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go.click();
    });
  }

  private closeLock() {
    this.root!.querySelectorAll('.bz-password-vault-lock').forEach((l) => l.classList.remove('open'));
  }

  // ---------- ESC ----------
  private registerEscape() {
    this.escUnregister = escManager.register('password-vault', {
      isVisible: () => !!this.root && this.root.style.display === 'flex',
      close: () => {
        // 弹窗优先
        const openModal = this.root!.querySelector('.bz-password-vault-modal.open');
        if (openModal) {
          this.closeEntryDialog();
          return;
        }
        const openConfirm = this.root!.querySelector('.bz-password-vault-pop2.open');
        if (openConfirm) {
          openConfirm.classList.remove('open');
          return;
        }
        this.hide();
      },
    });
  }

  // ---------- 工具 ----------
  /** HTML 转义（防注入，原型直接用 innerHTML 有风险） */
  private esc(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- 卸载 ----------
  cleanup() {
    if (clipboardClearTimer !== null) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.escUnregister?.unregister();
    this.escUnregister = null;
    this.dataManager.destroy();
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this._initialized = false;
  }
}

// ==================== Controller（命令入口由 index.ts 管理） ====================

export class PasswordVaultAppController {
  static instance: PasswordVaultAppController | null = null;

  static getInstance(config: PasswordVaultUIConfig): PasswordVaultAppController {
    if (!PasswordVaultAppController.instance) {
      PasswordVaultAppController.instance = new PasswordVaultAppController(config);
    }
    return PasswordVaultAppController.instance;
  }

  dataManager: PasswordVaultDataManager;
  uiManager: PasswordVaultUIManager;
  _initialized = false;

  constructor(config: PasswordVaultUIConfig) {
    this.dataManager = new PasswordVaultDataManager();
    this.uiManager = new PasswordVaultUIManager(this.dataManager, config);
  }

  async init() {
    if (this._initialized) return;
    this.uiManager.ensureElements();
    this._initialized = true;
  }

  /** 打开：未解锁 → 先解锁（原型锁屏），解锁后进入 */
  async openManager() {
    await this.init();
    this.uiManager.show();
    // show() 内部会 loadAndRender；若未解锁显示锁屏
  }

  cleanup() {
    this.uiManager.cleanup();
    PasswordVaultAppController.instance = null;
  }
}

// 便捷导入（供 index.ts）
export type { PasswordVaultEntry } from './data';

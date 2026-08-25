/**
 * 第二大脑窄窗 FloatWindow（ticket 103；对齐 QA 闪念.js L1119-1315）
 * 补齐交互点：
 * - 右贴边 300px 全高窄窗 + 📚 图标 + 入场动画（L1121-1148）
 * - ⟲ 复位到右贴边基线（L1161-1166/L1239-1247）；◀ 隐藏成 30px 右边条，
 *   隐藏态悬停 200ms 自动展开（L1168-1175/L1218-1227/L1272-1302）
 * - ✕ 关闭（Esc）：ESC 走 core/escManager 注册层级，不私挂 document 监听（L1178-1183/L1229-1231）
 * - 标题栏拖拽（right→left 定位归一后交 ui-tools.makeDraggable，L888-902 同语义）
 * - 8 向缩放（ui-tools.makeResizable，minW/minH 对齐 QA L1210）
 * - 双击标题栏最大化/还原（L1213-1216/L1249-1265）
 * - ⚙️ 改开共享域设置弹窗 openSecondBrainSettings（替代 QA L1190-1194 的 Notice 占位）
 * 样式全部收敛根 styles.css「第二大脑」段；内联仅显隐与动态几何。
 */
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { openSecondBrainSettings } from './panel';
import { makeDraggable, makeResizable } from './ui-tools';

export class FloatWindow {
  el: HTMLElement;
  header: HTMLElement;
  body: HTMLElement;
  iconSpan: HTMLElement;
  titleEl: HTMLElement;
  headerRight: HTMLElement;
  hideBtn: HTMLButtonElement;
  isHidden = false;
  isMaximized = false;
  origWidth: number;
  onClose: (() => void) | null = null;

  private restoreRect: { left: string; top: string; right: string; width: string; height: string; transform: string } | null = null;
  private hoverExpandTimer: ReturnType<typeof setTimeout> | null = null;
  private detachFns: (() => void)[] = [];
  private escHandle: ReturnType<typeof escManager.register> | null = null;
  private closed = false;

  constructor(title: string, opts: { headerRight?: HTMLElement; width?: number; onClose?: () => void } = {}) {
    this.onClose = opts.onClose || null;
    this.origWidth = opts.width ?? 300;

    this.el = document.createElement('div');
    this.el.className = 'bz-sb-float-win bz-sb-float-enter';
    this.el.style.width = this.origWidth + 'px';

    // ----- 标题栏：📚 图标 + 标题 + 按钮秩序（复位/隐藏 → 功能注入 → ⚙️ → ✕） -----
    this.header = document.createElement('div');
    this.header.className = 'bz-sb-float-head';

    this.iconSpan = document.createElement('span');
    this.iconSpan.className = 'bz-sb-float-icon';
    this.iconSpan.textContent = '📚';

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'bz-sb-float-title';
    this.titleEl.textContent = title;

    this.headerRight = document.createElement('div');
    this.headerRight.className = 'bz-sb-float-headright';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'bz-sb-float-btn';
    resetBtn.textContent = '⟲';
    resetBtn.title = '复位位置';
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reset();
    });

    this.hideBtn = document.createElement('button');
    this.hideBtn.className = 'bz-sb-float-btn';
    this.hideBtn.textContent = '◀';
    this.hideBtn.title = '隐藏到右侧';
    this.hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleHide();
    });

    if (opts.headerRight) this.headerRight.appendChild(opts.headerRight);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'bz-sb-float-btn';
    settingsBtn.textContent = '⚙';
    settingsBtn.title = '设置';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSecondBrainSettings(getApp());
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bz-sb-float-btn bz-sb-float-btn-close';
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭 (Esc)';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    this.headerRight.appendChild(resetBtn);
    this.headerRight.appendChild(this.hideBtn);
    this.headerRight.appendChild(settingsBtn);
    this.headerRight.appendChild(closeBtn);
    // 按钮区按下不启动标题栏拖拽（QA L890 closest('button') 同语义）
    this.headerRight.addEventListener('mousedown', (e) => e.stopPropagation());

    this.header.appendChild(this.iconSpan);
    this.header.appendChild(this.titleEl);
    this.header.appendChild(this.headerRight);

    // ----- 内容区 -----
    this.body = document.createElement('div');
    this.body.className = 'bz-sb-float-body';

    this.el.appendChild(this.header);
    this.el.appendChild(this.body);
    document.body.appendChild(this.el);

    // right 贴边定位在首次拖拽/缩放前归一为 left 定位（QA L852-857/L892-897 同语义）
    this.el.addEventListener(
      'mousedown',
      () => {
        if (!this.el.style.left) {
          const r = this.el.getBoundingClientRect();
          this.el.style.left = r.left + 'px';
          this.el.style.top = r.top + 'px';
          this.el.style.right = 'auto';
        }
      },
      true
    );

    // ----- 拖拽 / 缩放 -----
    this.detachFns.push(makeDraggable(this.el, this.header));
    this.detachFns.push(makeResizable(this.el, 30, 180));

    // ----- 双击标题栏最大化（按钮上双击不触发） -----
    this.header.addEventListener('dblclick', (e) => {
      if (e.target instanceof Element && e.target.closest('button')) return;
      this.toggleMaximize();
    });

    // ----- 隐藏态悬停 200ms 自动展开 -----
    this.el.addEventListener('mouseenter', () => {
      if (this.hoverExpandTimer) clearTimeout(this.hoverExpandTimer);
      if (this.isHidden) {
        this.hoverExpandTimer = setTimeout(() => this.show(), 200);
      }
    });
    this.el.addEventListener('mouseleave', () => {
      if (this.hoverExpandTimer) clearTimeout(this.hoverExpandTimer);
    });

    // ----- Esc 关闭走 escManager 层级（禁私挂 document keydown） -----
    this.escHandle = escManager.register('bz-sb-float-win', {
      isVisible: () => !!this.el.isConnected,
      close: () => this.close(),
    });
  }

  get alive(): boolean {
    return !!this.el.isConnected;
  }

  /** 展开等价于触发一次悬停（隐藏态 200ms 后弹出；QA L1237 同构） */
  expand(): void {
    this.el.dispatchEvent(new Event('mouseenter'));
  }

  /** 复位到右贴边基线：清空内联定位回归 CSS 基线 */
  reset(): void {
    const c = this.el;
    c.style.right = '';
    c.style.left = '';
    c.style.top = '';
    c.style.transform = '';
    c.style.width = this.origWidth + 'px';
    c.style.height = window.innerHeight + 'px';
    c.classList.remove('bz-sb-float-max');
    this.isMaximized = false;
    this.isHidden = false;
    this.syncHiddenUI(false);
  }

  toggleMaximize(): void {
    const c = this.el;
    if (!this.isMaximized) {
      this.restoreRect = {
        left: c.style.left,
        top: c.style.top,
        right: c.style.right,
        width: c.style.width,
        height: c.style.height,
        transform: c.style.transform,
      };
      c.style.left = '0';
      c.style.top = '0';
      c.style.right = 'auto';
      c.style.width = '100vw';
      c.style.height = '100vh';
      c.style.transform = 'translateX(0)';
      c.classList.add('bz-sb-float-max');
      this.isMaximized = true;
      this.isHidden = false;
      this.syncHiddenUI(false);
    } else {
      const r = this.restoreRect;
      if (r) {
        c.style.left = r.left;
        c.style.top = r.top;
        c.style.right = r.right;
        c.style.width = r.width;
        c.style.height = r.height;
        c.style.transform = r.transform || 'translateX(0)';
      }
      c.classList.remove('bz-sb-float-max');
      this.restoreRect = null;
      this.isMaximized = false;
    }
  }

  toggleHide(): void {
    if (this.isMaximized) return;
    if (this.isHidden) this.show();
    else this.hide();
  }

  /** 收缩为右侧 30px 边条（transform 平移属动态几何） */
  hide(): void {
    if (this.isHidden || this.isMaximized) return;
    this.isHidden = true;
    const rect = this.el.getBoundingClientRect();
    this.el.style.transform = `translateX(${window.innerWidth - rect.left - 30}px)`;
    this.syncHiddenUI(true);
  }

  show(): void {
    if (!this.isHidden) return;
    this.isHidden = false;
    this.el.style.transform = 'translateX(0)';
    this.syncHiddenUI(false);
  }

  /** 隐藏态 UI：标题/按钮/内容淡出只留 📚 图标条（视觉切换收敛 CSS hidden 类） */
  syncHiddenUI(hidden: boolean): void {
    this.el.classList.toggle('bz-sb-float-hidden', hidden);
    this.hideBtn.textContent = hidden ? '▶' : '◀';
    this.hideBtn.title = hidden ? '展开' : '隐藏到右侧';
  }

  close(): void {
    if (this.closed || !this.alive) return;
    this.closed = true;
    this.el.style.opacity = '0';
    if (this.hoverExpandTimer) clearTimeout(this.hoverExpandTimer);
    this.detachFns.forEach((fn) => fn());
    this.detachFns = [];
    this.escHandle?.unregister();
    this.escHandle = null;
    setTimeout(() => this.el.remove(), 150);
    this.onClose?.();
  }
}

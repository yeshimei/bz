/**
 * 第二大脑桌面参考面板（ticket 103 建；ticket 108 头部与密度切换）
 * 交互点：
 * - 结果过滤当前文件；空态「暂无相关笔记」
 * - 卡片 = 文件名 + 匹配度百分比 + 正文 markdown 渲染（列表态收起）
 * - 密度切换（ticket 108）：📃 仅标题 / 📑 标题+省略内容，会话内有效不持久化
 * - 300ms 悬停浮出预览：路径 + 匹配度 + markdown 正文，按窄窗在屏左/右智能定位
 * - 双击卡片跳转 chunk 前 30 字并选中；浮卡态双击归位
 * - 长按 250ms 浮起 → 位移超 15px 拖出独立浮卡状态机：可拖拽/可缩放/双击归位回原位
 * - 🤖 按钮已移除（对话改独立弹窗，从主面板 💬 或命令进入——ticket 108）；
 *   vault modify(.md)/active-leaf-change/editor-change 自动刷新 +
 *   光标轮询 CURSOR_POLL_INTERVAL、防抖 DEBOUNCE_DELAY
 */
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { FloatWindow } from './float-window';
import { buildConfig } from './config';
import { getCurrentContext } from './context';
import { jumpToChunk, renderMarkdown, makeDraggable, makeResizable } from './ui-tools';
import type { SearchHit, VectorStore } from './vector-store';

export class ReferencePanel {
  fw: FloatWindow;
  resultsDiv: HTMLElement;
  store: VectorStore;
  app: App;
  lastQuery = '';
  floatingCards = new Set<HTMLElement>();
  /** 密度态：false=标题+省略内容（默认），true=仅标题（会话内有效，不持久化） */
  denseMode = false;
  private denseBtn: HTMLButtonElement;

  private isClosed = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCursor: string | null = null;
  private vaultRef: any = null;
  private leafRef: any = null;
  private editorRef: any = null;
  /** 浮卡拖出跟随的 document 级监听卸载器（close 时兜底清理） */
  private activeFollows = new Set<() => void>();

  constructor(app: App, store: VectorStore, existingWin?: FloatWindow) {
    this.app = app;
    this.store = store;

    // 密度切换钮（窄窗标题栏功能位，ticket 108）
    this.denseBtn = document.createElement('button');
    this.denseBtn.className = 'bz-sb-float-btn';
    this.denseBtn.textContent = '📑';
    this.denseBtn.title = '切换：仅标题 / 标题+内容';

    if (existingWin) {
      // 入口已建窄窗时复用（index 接线传 referenceWin，避免双窗）
      this.fw = existingWin;
      this.fw.headerRight.appendChild(this.denseBtn);
    } else {
      this.fw = new FloatWindow('灵感参考', { headerRight: this.denseBtn, onClose: () => this.destroyResources() });
    }
    this.denseBtn.addEventListener('click', () => this.toggleDensity());

    this.resultsDiv = document.createElement('div');
    this.resultsDiv.className = 'bz-sb-ref-list bz-sb-scroll-y';
    this.fw.body.appendChild(this.resultsDiv);

    // ----- 自动刷新事件（最小 mock / 异常环境下跳过订阅，面板仍可创建） -----
    try {
      this.vaultRef = app.vault.on('modify', (f) => {
        if ((f as TFile).extension === 'md') this.refreshWithDebounce();
      });
      this.leafRef = app.workspace.on('active-leaf-change', () => this.refreshWithDebounce());
      this.editorRef = app.workspace.on('editor-change', () => this.refreshWithDebounce());
    } catch {
      /* 订阅失败不阻断面板 */
    }

    // ----- 光标轮询 -----
    const CONFIG = buildConfig();
    this.pollTimer = setInterval(() => {
      const ed = app.workspace.activeEditor?.editor;
      if (!ed) return;
      const c = ed.getCursor();
      const k = `${c.line}:${c.ch}`;
      if (this.lastCursor !== k) {
        this.lastCursor = k;
        this.refreshWithDebounce();
      }
    }, CONFIG.CURSOR_POLL_INTERVAL);
  }

  get alive(): boolean {
    return this.fw.alive;
  }

  expand(): void {
    this.fw.expand();
  }

  /** 密度切换（ticket 108）：📃 仅标题 / 📑 标题+省略内容；CSS 类整体切换，会话内有效 */
  toggleDensity(): void {
    this.denseMode = !this.denseMode;
    this.resultsDiv.classList.toggle('bz-sb-ref-dense', this.denseMode);
    this.denseBtn.textContent = this.denseMode ? '📃' : '📑';
    this.denseBtn.title = this.denseMode ? '切换：标题+内容' : '切换：仅标题';
  }

  refreshWithDebounce(): void {
    if (this.isClosed) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const CONFIG = buildConfig();
    this.debounceTimer = setTimeout(() => void this.refreshContent(), CONFIG.DEBOUNCE_DELAY);
  }

  async refreshContent(): Promise<void> {
    if (this.isClosed) return;
    const ed = this.app.workspace.activeEditor?.editor;
    if (!ed) {
      this.resultsDiv.innerHTML = '';
      return;
    }
    const query = getCurrentContext(ed);
    if (query.length < 2 || query === this.lastQuery) return;
    this.lastQuery = query;
    try {
      const CONFIG = buildConfig();
      const results = await this.store.search(query, CONFIG.TOP_K);
      if (this.isClosed) return; // 关闭瞬间检索才返回：不再向已 detach 的 DOM 渲染（ticket 107）
      this.renderResults(results);
    } catch (err) {
      console.warn('[secondbrain] 参考面板检索失败', err);
    }
  }

  renderResults(results: SearchHit[]): void {
    this.resultsDiv.innerHTML = '';
    // 过滤当前文件（QA L1410-1411）
    const currentPath = this.app.workspace.getActiveFile()?.path || '';
    const filtered = (results || []).filter((item) => item.path !== currentPath);
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'bz-sb-ref-empty';
      empty.textContent = '暂无相关笔记';
      this.resultsDiv.appendChild(empty);
      return;
    }
    for (const item of filtered) {
      this.createResultCard(item);
    }
  }

  /** 单张卡片：悬停预览 / 双击跳转 / 长按浮出拖出独立浮卡 */
  createResultCard(item: SearchHit): HTMLElement {
    const panel = this;
    const card = document.createElement('div');
    card.className = 'bz-sb-ref-card';

    const topRow = document.createElement('div');
    topRow.className = 'bz-sb-ref-card-top';
    const pathDiv = document.createElement('div');
    pathDiv.className = 'bz-sb-ref-card-path';
    pathDiv.textContent = item.path.replace(/^.*[\\/]/, '').replace(/\.md$/i, '');
    const badge = document.createElement('span');
    badge.className = 'bz-sb-ref-card-score';
    badge.textContent = `${Math.round(item.score * 100)}%`;
    topRow.appendChild(pathDiv);
    topRow.appendChild(badge);

    // 正文 markdown 预渲染（列表态收起，浮出态展开）
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'bz-sb-ref-card-body';
    renderMarkdown(bodyDiv, item.chunk, panel.app);

    card.appendChild(topRow);
    card.appendChild(bodyDiv);
    panel.resultsDiv.appendChild(card);

    const isFloating = () => card.classList.contains('bz-sb-ref-card--float');

    // ====== 悬停预览（300ms）======
    card.addEventListener('mouseenter', () => {
      if (isFloating()) return;
      clearTimeout(panel.hoverTimer ?? undefined);
      panel.hoverTimer = setTimeout(() => {
        if (!isFloating()) panel.showHoverPreview(item, card);
      }, 300);
    });
    card.addEventListener('mouseleave', () => {
      clearTimeout(panel.hoverTimer ?? undefined);
      panel.hoverTimer = null;
      if (!isFloating()) panel.hideHoverPreview();
    });

    // ====== 双击：列表态跳转，浮窗态归位 ======
    card.addEventListener('dblclick', () => {
      if (isFloating()) {
        collapseCard();
        return;
      }
      const file = panel.app.vault.getAbstractFileByPath(item.path);
      if (!file) {
        notice('文件不存在');
        return;
      }
      jumpToChunk(file, item.chunk.slice(0, 30).trim(), true);
    });

    // ====== 长按状态机（QA L1470-1596）======
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let isHeld = false;
    let holdStartX = 0;
    let holdStartY = 0;
    let detachDrag: (() => void) | null = null;
    let detachResize: (() => void) | null = null;
    let originalNext: Element | null = null;

    const cancelHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
      isHeld = false;
      card.classList.remove('bz-sb-ref-card--held');
    };

    /** 拖出跟随（document 级，鼠标移出卡片仍跟随；up 自卸载） */
    const attachFollow = (sx: number, sy: number) => {
      const r = card.getBoundingClientRect();
      const baseLeft = r.left;
      const baseTop = r.top;
      const move = (e: MouseEvent) => {
        card.style.left = Math.max(0, baseLeft + e.clientX - sx) + 'px';
        card.style.top = Math.max(0, baseTop + e.clientY - sy) + 'px';
      };
      const detach = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        panel.activeFollows.delete(detach);
      };
      const up = () => detach();
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      panel.activeFollows.add(detach);
    };

    /** 拖出为独立浮卡：fixed 定位 + 标题栏拖拽 + 缩放（QA L1497-1530） */
    const floatCard = () => {
      card.classList.add('bz-sb-ref-card--float');
      panel.floatingCards.add(card);
      panel.hideHoverPreview();
      cancelHold();
      const r = card.getBoundingClientRect();
      card.style.position = 'fixed';
      card.style.left = r.left + 'px';
      card.style.top = r.top + 'px';
      card.style.width = r.width + 'px';
      originalNext = card.nextElementSibling; // 移出列表前记住原位后继
      document.body.appendChild(card);
      topRow.classList.add('bz-sb-ref-card-top--grip');
      detachDrag = makeDraggable(card, topRow);
      detachResize = makeResizable(card, 180, 120);
    };

    /** 归位：还原列表卡形态并插回原位置（QA L1532-1551） */
    const collapseCard = () => {
      card.classList.remove('bz-sb-ref-card--float');
      panel.floatingCards.delete(card);
      if (detachDrag) detachDrag();
      if (detachResize) detachResize();
      detachDrag = null;
      detachResize = null;
      topRow.classList.remove('bz-sb-ref-card-top--grip');
      card.style.cssText = '';
      if (originalNext && originalNext.parentNode === panel.resultsDiv) {
        panel.resultsDiv.insertBefore(card, originalNext);
      } else {
        panel.resultsDiv.appendChild(card);
      }
      originalNext = null;
      card.classList.add('bz-sb-ref-card--return');
      setTimeout(() => card.classList.remove('bz-sb-ref-card--return'), 400);
    };

    // 长按计时起点（QA L1554-1564）
    card.addEventListener('mousedown', (e) => {
      if (isFloating() || e.button !== 0) return;
      holdStartX = e.clientX;
      holdStartY = e.clientY;
      holdTimer = setTimeout(() => {
        holdTimer = null;
        isHeld = true;
        card.classList.add('bz-sb-ref-card--held');
        panel.hideHoverPreview();
      }, 250);
    });
    card.addEventListener('mousemove', (e) => {
      if (isFloating()) return;
      if (!isHeld) {
        if (holdTimer && (Math.abs(e.clientX - holdStartX) > 8 || Math.abs(e.clientY - holdStartY) > 8)) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        return;
      }
      if (Math.abs(e.clientX - holdStartX) > 15 || Math.abs(e.clientY - holdStartY) > 15) {
        floatCard();
        attachFollow(e.clientX, e.clientY);
      }
    });
    card.addEventListener('mouseup', () => {
      if (isFloating()) return;
      cancelHold();
    });
    card.addEventListener('mouseleave', () => {
      if (isFloating()) return;
      if (isHeld) {
        cancelHold();
        floatCard();
      }
    });

    return card;
  }

  /** 悬停预览：带路径与匹配度，按窄窗在屏左/右智能定位（QA L1599-1637） */
  showHoverPreview(item: SearchHit, cardEl: HTMLElement): void {
    this.hideHoverPreview();
    const refRect = this.fw.el.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const isRightSide = refRect.left > window.innerWidth / 2;
    const preview = document.createElement('div');
    preview.className = 'bz-sb-ref-preview';
    // 定位属动态几何内联；其余皮肤走 CSS
    preview.style.left = (isRightSide ? refRect.left - 310 : refRect.right + 8) + 'px';
    preview.style.top = Math.max(10, cardRect.top - 20) + 'px';

    const pathLabel = document.createElement('div');
    pathLabel.className = 'bz-sb-ref-preview-path';
    pathLabel.textContent = item.path;
    const scoreLabel = document.createElement('div');
    scoreLabel.className = 'bz-sb-ref-preview-score';
    scoreLabel.textContent = `匹配度 ${Math.round(item.score * 100)}%`;
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'bz-sb-ref-preview-body';
    renderMarkdown(bodyDiv, item.chunk, this.app);

    preview.appendChild(pathLabel);
    preview.appendChild(scoreLabel);
    preview.appendChild(bodyDiv);
    document.body.appendChild(preview);
  }

  hideHoverPreview(): void {
    document.querySelectorAll('.bz-sb-ref-preview').forEach((el) => el.remove());
    clearTimeout(this.hoverTimer ?? undefined);
    this.hoverTimer = null;
  }

  /** 关闭并释放全部资源（幂等） */
  close(): void {
    this.destroyResources();
    this.fw.close();
  }

  private destroyResources(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    clearTimeout(this.debounceTimer ?? undefined);
    clearInterval(this.pollTimer ?? undefined);
    this.debounceTimer = null;
    this.pollTimer = null;
    if (this.vaultRef || this.leafRef || this.editorRef) {
      try {
        if (this.vaultRef) this.app.vault.offref(this.vaultRef);
        if (this.leafRef) this.app.workspace.offref(this.leafRef);
        if (this.editorRef) this.app.workspace.offref(this.editorRef);
      } catch {
        /* 环境无 offref 能力时忽略 */
      }
    }
    this.hideHoverPreview();
    for (const detach of this.activeFollows) detach();
    this.activeFollows.clear();
    for (const fc of this.floatingCards) fc.remove();
    this.floatingCards.clear();
  }
}

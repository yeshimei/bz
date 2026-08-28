/**
 * 第二大脑桌面参考面板（ticket 103 建；ticket 108 头部与密度切换）
 * 交互点：
 * - 结果过滤当前文件；空态「暂无相关笔记」
 * - 卡片 = 文件名 + 匹配度百分比 + 正文 markdown 渲染（列表态收起）
 * - 密度切换（ticket 108）：📃 仅标题 / 📑 标题+省略内容，会话内有效不持久化
 * - 300ms 悬停浮出预览：路径 + 匹配度 + markdown 正文，按窄窗在屏左/右智能定位
 * - 双击卡片跳转 chunk 前 30 字并选中；浮卡态双击归位
 * - 长按 250ms 浮起 → 位移超 15px 拖出独立浮卡状态机：可拖拽/可缩放/双击归位回原位
 * - 刷新竞态防护：列表整页重建前清场未决长按/悬停计时；已摘除卡片禁止浮出
 *   （否则零矩形 fixed 浮卡 = 左上角幽灵卡）；关闭时对漂浮卡片兜底解绑拖拽/缩放监听
 * - 🤖 按钮已移除（对话改独立弹窗，从主面板 💬 或命令进入——ticket 108）；
 *   vault modify(.md)/active-leaf-change/editor-change 自动刷新 +
 *   光标轮询 CURSOR_POLL_INTERVAL、防抖 DEBOUNCE_DELAY
 */
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { allocZ } from '../core/z-order';
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
  /** 每张卡片的未决态清理器：列表整页重建/面板关闭前统一执行——长按计时器不得跨重建存活（左上角幽灵卡根因） */
  private cardTeardowns = new Map<HTMLElement, () => void>();
  /** 浮卡的拖拽/缩放 document 级监听卸载器：close 时对仍在漂浮的卡片兜底解绑 */
  private floatDetachers = new Map<HTMLElement, () => void>();

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

    // ----- 光标轮询（p2-sb 收敛：窄窗已关闭/收起边条时不再空转，仅面板可见时轮询）-----
    const CONFIG = buildConfig();
    this.pollTimer = setInterval(() => {
      if (!this.fw.alive || this.fw.isHidden) return; // 不可见（已关闭 / ◀️ 收起为边条）不轮询
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
    // fw.el.remove 延迟 150ms 执行，仅看 isConnected 会把刚关闭的实例误判为存活
    return !this.isClosed && this.fw.alive;
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
    // [46] 查询期 loading 占位：清掉旧结果给出进行中状态（避免停留上一份结果造成误导）
    this.showListState('检索中…');
    let degraded = false;
    try {
      const CONFIG = buildConfig();
      const results = await this.store.search(query, CONFIG.TOP_K, () => {
        degraded = true; // store 内部向量检索失败已降级文本：向用户明示
      });
      if (this.isClosed) return; // 关闭瞬间检索才返回：不再向已 detach 的 DOM 渲染（ticket 107）
      this.renderResults(results);
      if (degraded) this.appendListHint('⚠ 向量检索暂不可用，已降级为文本匹配');
    } catch (err) {
      console.warn('[secondbrain] 参考面板检索失败', err);
      if (this.isClosed) return;
      this.showListState('检索失败：请检查 Ollama 服务后重试');
    }
  }

  /** [46] 列表整体占位/错误提示（loading / 失败态，复用空态样式） */
  private showListState(text: string): void {
    this.cancelPendingCardStates(); // 旧卡未决态不跨重建存活
    this.resultsDiv.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'bz-sb-ref-empty';
    div.textContent = text;
    this.resultsDiv.appendChild(div);
  }

  /** [46] 降级脚注：不打断结果列表，在列表末追加一行说明 */
  private appendListHint(text: string): void {
    const div = document.createElement('div');
    div.className = 'bz-sb-ref-empty';
    div.textContent = text;
    this.resultsDiv.appendChild(div);
  }

  renderResults(results: SearchHit[]): void {
    this.cancelPendingCardStates();
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

  /** 列表重建/关闭前清场：取消所有卡片的未决长按与悬停计时（卡片即将被摘除，计时器不得存活） */
  private cancelPendingCardStates(): void {
    for (const teardown of this.cardTeardowns.values()) teardown();
    this.cardTeardowns.clear();
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
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
        // 卡片已被刷新摘除：放弃预览，杜绝零坐标孤儿预览（屏幕顶部残影）
        if (isFloating() || !card.isConnected) return;
        panel.showHoverPreview(item, card);
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
      // 双保险：对已脱离 DOM 的卡片取 rect 得全 0，会以 left/top=0、width=0 浮出——
      // 即左上角幽灵卡（不可抓握、无法拖动），任何路径都不得在此状态浮出
      if (!card.isConnected || isFloating()) return;
      card.classList.add('bz-sb-ref-card--float');
      card.style.zIndex = String(allocZ()); // ADR-0067：浮卡化 = 抬到最上（谁拖谁在上）
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
      // 关闭面板时对仍在漂浮的卡片兜底解绑 document 级监听
      panel.floatDetachers.set(card, () => {
        if (detachDrag) detachDrag();
        if (detachResize) detachResize();
      });
    };

    /** 归位：还原列表卡形态并插回原位置（QA L1532-1551） */
    const collapseCard = () => {
      card.classList.remove('bz-sb-ref-card--float');
      panel.floatingCards.delete(card);
      if (detachDrag) detachDrag();
      if (detachResize) detachResize();
      detachDrag = null;
      detachResize = null;
      panel.floatDetachers.delete(card);
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
        // 已被刷新摘除：不得进入浮起态（长按计时器跨列表重建存活 = 幽灵卡根因之一）
        if (!card.isConnected) return;
        isHeld = true;
        card.classList.add('bz-sb-ref-card--held');
        panel.hideHoverPreview();
      }, 250);
    });
    card.addEventListener('mousemove', (e) => {
      if (isFloating() || !card.isConnected) return;
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
      if (!card.isConnected) {
        // 刷新竞态：卡片摘除后浏览器补发的边界事件只清态，绝不浮出
        cancelHold();
        return;
      }
      if (isHeld) {
        cancelHold();
        floatCard();
      }
    });

    // 未决态清理器：renderResults 整页重建 / destroyResources 时执行，
    // 保证长按计时器与浮起态不存活于已被摘除的卡片上
    panel.cardTeardowns.set(card, () => cancelHold());

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
    preview.style.zIndex = String(allocZ()); // ADR-0067：hover 预览创建即显示即发号
    // 定位属动态几何内联；其余皮肤走 CSS。宽度与 styles.css .bz-sb-ref-preview 同步（ticket 109：460px）
    const PW = 460;
    let left = isRightSide ? refRect.left - (PW + 8) : refRect.right + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - PW - 8));
    preview.style.left = left + 'px';
    this.clampPreviewTop(preview, cardRect.top - 20);

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
    // 正文 markdown 异步渲染会长高，渲染后按实际高度再钳制一次（ticket 109）
    setTimeout(() => {
      if (preview.isConnected) this.clampPreviewTop(preview, cardRect.top - 20);
    }, 120);
  }

  /** 不限高随内容生长（ticket 109）：top 钳制进视口，尽量多显示全文 */
  private clampPreviewTop(preview: HTMLElement, desiredTop: number): void {
    const maxTop = window.innerHeight - preview.offsetHeight - 10;
    preview.style.top = Math.max(10, Math.min(desiredTop, maxTop)) + 'px';
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
    this.cancelPendingCardStates();
    this.hideHoverPreview();
    for (const detach of this.activeFollows) detach();
    this.activeFollows.clear();
    // 仍在漂浮的卡片：先解绑其 document 级拖拽/缩放监听再移除 DOM
    for (const detach of this.floatDetachers.values()) detach();
    this.floatDetachers.clear();
    for (const fc of this.floatingCards) fc.remove();
    this.floatingCards.clear();
  }
}

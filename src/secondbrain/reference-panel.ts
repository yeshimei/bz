/**
 * 第二大脑桌面参考浮窗（ticket 103 建；2026-11 重写为「同屋」右侧吸附浮窗）
 *
 * 形态：FloatWindow 右侧 400px 全高贴边，默认展开；内部 = 上下文卡 + 强相关/擦边分组 + 底部状态。
 * 交互（逐条保留旧行为，能留的尽量留）：
 * - 跟随当前编辑器上下文自动检索；空行/无编辑器短路，不发查询（issue 428）
 * - 过滤当前文件；检索中/失败/降级占位；只查最新（AbortController）
 * - 单击卡片就地展开/收起；双击跳转命中段；长按 250ms 拖出独立浮卡（浮卡双击归位）
 * - 密度切换（标题 / 标题+内容）；收起成右边条（FloatWindow 隐藏态）
 * - 上下文卡：锁定后停止自动跟随；换一批强制重查
 * - 动作：打开、插入引用、钉住（会话内，不持久化）
 *
 * 悬停预览方法保留（旧测试/未来可选），但新交互不再绑定 mouseenter——卡片改为就地展开，
 * 避免浮层遮住正文。
 */
import { stripMdExt, formatRelativeTime } from '../core/utils';
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { allocZ } from '../core/z-order';
import { openReaderJump } from '../core/reader-link';
import { mountIcons } from '../core/ui';
import { FloatWindow } from './float-window';
import { buildConfig } from './config';
import { getCurrentContext } from './context';
import { jumpToChunk, renderMarkdown, makeDraggable, makeResizable } from './ui-tools';
import {
  refCardHtml,
  refContextHtml,
  refFootHtml,
  refGroupHeadHtml,
  refRowHtml,
  refShellHtml,
  refStateHtml,
  sbBookColor,
  sbSourceColor,
  computeStats,
} from './render';
import { motionRefSweep, motionRefResults, motionPreviewIn, motionDensitySettle } from './motion';
import { relevancePct, type SearchHit, type VectorStore } from './vector-store';

type CardKind = 'strong' | 'near';

export class ReferencePanel {
  fw: FloatWindow;
  resultsDiv: HTMLElement;
  contextDiv: HTMLElement;
  footDiv: HTMLElement;
  store: VectorStore;
  app: App;
  lastQuery = '';
  lastResults: SearchHit[] = [];
  floatingCards = new Set<HTMLElement>();
  /** 密度态：false=标题+摘要（默认），true=仅标题（会话内有效，不持久化） */
  denseMode = false;
  /** 锁定上下文：停止自动跟随；手动「换一批」仍可用 */
  locked = false;
  /** 会话内钉住（不持久化；仅影响按钮态，不重排结果） */
  pinned = new Set<string>();
  private denseBtn: HTMLButtonElement;
  private chatBtn: HTMLButtonElement;
  private lastNoteName = '';
  private lastNotePath = '';
  private lastSentence = '';
  /** 最近一次检索完成的时间（上下文卡「N 分钟前」用它，不再写死「刚刚更新」） */
  private lastUpdatedAt = 0;
  private sourceOrder = new Map<string, number>();

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
  /** 每张卡片的未决态清理器：列表整页重建/面板关闭前统一执行 */
  private cardTeardowns = new Map<HTMLElement, () => void>();
  /** 浮卡的拖拽/缩放 document 级监听卸载器 */
  private floatDetachers = new Map<HTMLElement, () => void>();
  /** 在途检索（issue 428「只查最新」） */
  private inflight: AbortController | null = null;

  constructor(app: App, store: VectorStore) {
    this.app = app;
    this.store = store;

    // 头行按钮：密度 + 对话（收起/关闭由 FloatWindow 提供）
    this.denseBtn = document.createElement('button');
    this.denseBtn.className = 'bz-sb-float-btn';
    this.denseBtn.innerHTML = '<i data-lucide="list"></i>';
    this.denseBtn.title = '切换：标题 / 标题+内容';
    this.chatBtn = document.createElement('button');
    this.chatBtn.className = 'bz-sb-float-btn bz-sb-float-btn-chat';
    this.chatBtn.innerHTML = '<i data-lucide="message-square"></i>';
    this.chatBtn.title = 'AI 对话';
    this.chatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      (this.app as any).commands?.executeCommandById?.('bz-secondbrain-chat');
    });

    this.fw = new FloatWindow('灵感参考', {
      width: 400,
      headerRight: this.denseBtn,
      subtitle: '从当前笔记联想',
      glyph: 'radar',
      minimal: true,
      onClose: () => this.destroyResources(),
    });
    this.fw.headerRight.insertBefore(this.chatBtn, this.denseBtn.nextSibling);
    this.denseBtn.addEventListener('click', () => this.toggleDensity());
    mountIcons(this.denseBtn);
    mountIcons(this.chatBtn);

    // 内容骨架：上下文卡 + 结果列表 + 底部状态
    this.fw.body.innerHTML = refShellHtml();
    this.contextDiv = this.fw.body.querySelector('#bz-sb-ref-context') as HTMLElement;
    this.resultsDiv = this.fw.body.querySelector('#bz-sb-ref-list') as HTMLElement;
    this.footDiv = this.fw.body.querySelector('#bz-sb-ref-foot') as HTMLElement;

    // 上下文卡上的「锁定 / 换一批」
    this.contextDiv.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-ref-act]') as HTMLElement | null;
      if (!btn) return;
      if (btn.dataset.refAct === 'lock') this.toggleLock();
      else if (btn.dataset.refAct === 'refresh') void this.refreshContent(true);
    });

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

    // ----- 光标轮询（仅面板可见时轮询） -----
    const CONFIG = buildConfig();
    this.pollTimer = setInterval(() => {
      if (!this.fw.alive || this.fw.isHidden) return;
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
    return !this.isClosed && this.fw.alive;
  }

  expand(): void {
    this.fw.expand();
  }

  /** 密度切换：仅标题 / 标题+内容；CSS 类整体切换，会话内有效 */
  toggleDensity(): void {
    this.denseMode = !this.denseMode;
    this.resultsDiv.classList.toggle('bz-sb-ref-dense', this.denseMode);
    this.denseBtn.innerHTML = `<i data-lucide="${this.denseMode ? 'list-tree' : 'list'}"></i>`;
    mountIcons(this.denseBtn);
    this.denseBtn.title = this.denseMode ? '切换：标题+内容' : '切换：仅标题';
    motionDensitySettle(this.resultsDiv);
  }

  /** 锁定/解锁自动跟随；锁定后手动「换一批」仍可查 */
  toggleLock(): void {
    this.locked = !this.locked;
    this.renderContext();
    notice(this.locked ? '已锁定当前上下文，停止自动跟随' : '已恢复跟随光标', 'info');
  }

  refreshWithDebounce(): void {
    if (this.isClosed || this.locked) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const CONFIG = buildConfig();
    this.debounceTimer = setTimeout(() => void this.refreshContent(), CONFIG.DEBOUNCE_DELAY);
  }

  /**
   * 清掉「上一份结果仍有效」的记忆。
   *
   * 占位态（无编辑器 / 光标句不足 2 字）只换文案不够：早退条件看的是 lastQuery 与
   * lastResults——不清的话光标回到原句时会命中早退，列表永远停在「打开一篇笔记…」；
   * 在途检索也要一并中止，否则它回来会把占位盖成结果。
   */
  private resetListState(): void {
    this.lastQuery = '';
    this.lastResults = [];
    this.inflight?.abort();
    this.inflight = null;
  }

  async refreshContent(force = false): Promise<void> {
    if (this.isClosed) return;
    const ed = this.app.workspace.activeEditor?.editor;
    const note = this.app.workspace.getActiveFile();
    this.lastNoteName = note?.basename || '';
    this.lastNotePath = note?.path || '';
    if (!ed) {
      this.resetListState();
      this.lastSentence = '';
      this.renderContext();
      this.showListState('打开一篇笔记，参考会跟着光标走');
      return;
    }
    const query = getCurrentContext(ed);
    this.lastSentence = query;
    this.renderContext();
    if (query.length < 2) {
      this.resetListState();
      this.showListState('把光标放到正文里，这里会跟着联想');
      return;
    }
    if (!force && query === this.lastQuery && this.lastResults.length) return;

    this.lastQuery = query;
    this.inflight?.abort();
    const ac = new AbortController();
    this.inflight = ac;
    this.showListState('检索中…');
    let degraded = false;
    try {
      const CONFIG = buildConfig();
      const results = await this.store.search(
        query,
        CONFIG.TOP_K,
        () => {
          degraded = true;
        },
        ac.signal
      );
      if (this.inflight !== ac) return;
      this.inflight = null;
      if (this.isClosed) return;
      this.lastUpdatedAt = Date.now();
      this.renderResults(results);
      this.renderContext();
      if (degraded) this.appendListHint('⚠ 向量检索暂不可用，已降级为文本匹配');
    } catch (err) {
      if (ac.signal.aborted) return;
      this.resetListState();
      console.warn('[secondbrain] 参考面板检索失败', err);
      if (this.isClosed) return;
      this.showListState('检索失败：请检查 Ollama 服务后重试');
    }
  }

  /** 上下文卡（当前笔记 + 光标句 + 锁定/换一批） */
  private renderContext(): void {
    const noteName = this.lastNoteName || '未打开笔记';
    const parent = this.lastNotePath.includes('/')
      ? this.lastNotePath.slice(0, this.lastNotePath.lastIndexOf('/'))
      : '';
    this.contextDiv.innerHTML = refContextHtml({
      noteName,
      path: parent,
      sentence: this.lastSentence,
      locked: this.locked,
      updated: this.lastUpdatedAt ? formatRelativeTime(this.lastUpdatedAt) : '',
    });
    mountIcons(this.contextDiv);
    const sub = this.fw.header.querySelector('.bz-sb-float-sub');
    if (sub) sub.textContent = this.locked ? '上下文已锁定' : '从当前笔记联想';
  }

  /** 列表整体占位/错误提示（loading / 失败态，复用空态样式） */
  private showListState(text: string): void {
    this.cancelPendingCardStates();
    this.resultsDiv.innerHTML = '';
    this.resultsDiv.insertAdjacentHTML('beforeend', refStateHtml(text));
    this.renderFoot(0, 0);
    motionRefSweep(this.resultsDiv);
  }

  /** 降级脚注：不打断结果列表，在列表末追加一行说明（测试锚点） */
  private appendListHint(text: string): void {
    this.resultsDiv.insertAdjacentHTML('beforeend', refStateHtml(text));
  }

  /** 结果分组：前 2 条强相关，其余擦边；全部仍落 .bz-sb-ref-card（测试/浮卡状态机共用） */
  renderResults(results: SearchHit[]): void {
    this.cancelPendingCardStates();
    this.resultsDiv.innerHTML = '';
    const currentPath = this.app.workspace.getActiveFile()?.path || '';
    const filtered = (results || []).filter((item) => item.path !== currentPath);
    this.lastResults = filtered;
    if (!filtered.length) {
      this.resultsDiv.insertAdjacentHTML('beforeend', refStateHtml('暂无相关笔记'));
      this.renderFoot(0, 0);
      return;
    }
    this.sourceOrder = this.buildSourceOrder();
    const strong = filtered.slice(0, Math.min(2, filtered.length));
    const near = filtered.slice(strong.length);
    this.resultsDiv.insertAdjacentHTML('beforeend', refGroupHeadHtml('强相关', strong.length, '可直接引用'));
    for (const item of strong) this.resultsDiv.appendChild(this.createResultCard(item, 'strong'));
    if (near.length) {
      this.resultsDiv.insertAdjacentHTML('beforeend', refGroupHeadHtml('擦边线索', near.length, '值得看一眼'));
      for (const item of near) this.resultsDiv.appendChild(this.createResultCard(item, 'near'));
    }
    this.renderFoot(filtered.length, this.countSources(filtered));
    motionRefResults(this.resultsDiv);
  }

  private buildSourceOrder(): Map<string, number> {
    try {
      return new Map(computeStats(this.store.meta).bySource.map((s, i) => [s.name, i]));
    } catch {
      return new Map();
    }
  }

  /** 命中笔记的段数与修改时间（原型卡片底部「2 段 · 今天 08:14」） */
  private hitMeta(item: SearchHit, pct: number): string {
    if (item.bookId) return `书籍命中 · 匹配度 ${pct}%`;
    const entry = this.store.meta?.notes?.[item.path];
    const chunks = entry?.chunks?.length || 0;
    const when = this.formatWhen(entry?.mtime);
    const quality = pct >= 90 ? '高度重合' : '可作旁证';
    return [chunks ? `${chunks} 段` : '', when, quality].filter(Boolean).join(' · ');
  }

  private formatWhen(mtime?: number): string {
    if (!mtime) return '';
    const d = new Date(mtime);
    const now = new Date();
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return `今天 ${hh}:${mm}`;
    if (d.toDateString() === yest.toDateString()) return `昨天 ${hh}:${mm}`;
    // 跨年补年份：否则去年 12 月与今年 12 月在卡上看起来是同一天
    if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  private countSources(items: SearchHit[]): number {
    const set = new Set<string>();
    for (const it of items) set.add(it.bookId ? '__book__' : it.path.split('/')[0] || '（根目录）');
    return set.size;
  }

  private renderFoot(count: number, sources: number): void {
    this.footDiv.innerHTML = refFootHtml(count, sources);
  }

  /** 列表重建/关闭前清场：取消所有卡片的未决长按与悬停计时 */
  private cancelPendingCardStates(): void {
    for (const teardown of this.cardTeardowns.values()) teardown();
    this.cardTeardowns.clear();
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
  }

  /** 单张卡片：单击展开 / 双击跳转 / 长按拖出独立浮卡 / 动作按钮 */
  createResultCard(item: SearchHit, kind: CardKind = 'strong'): HTMLElement {
    const panel = this;
    const card = document.createElement('div');
    const pct = relevancePct(item);
    const source = item.bookId ? '书籍' : item.path.split('/')[0] || '（根目录）';
    const color = item.bookId ? sbBookColor(item.bookId) : sbSourceColor(source, this.sourceOrder);
    const name = item.label || stripMdExt(item.path.replace(/^.*[\\/]/, ''));
    card.className = `bz-sb-ref-card bz-sb-ref-card--${kind}`;
    card.dataset.path = item.path;
    if (item.bookId) card.dataset.book = item.bookId;
    const meta = this.hitMeta(item, pct);
    const snippet = item.chunk.replace(/\s+/g, ' ').trim().slice(0, 120);
    card.innerHTML =
      kind === 'near'
        ? refRowHtml(name, pct, color, { source, meta, snippet })
        : refCardHtml(name, pct, color, {
            source,
            meta,
            snippet,
            pinned: this.pinned.has(item.path),
            book: !!item.bookId,
          });
    const topRow = card.querySelector('.bz-sb-ref-card-top, .bz-sb-ref-row-head') as HTMLElement;
    const bodyDiv = card.querySelector('.bz-sb-ref-card-body') as HTMLElement;
    if (kind !== 'near') renderMarkdown(bodyDiv, item.chunk, panel.app);
    mountIcons(card);
    panel.resultsDiv.appendChild(card);

    const isFloating = () => card.classList.contains('bz-sb-ref-card--float');
    let clickTimer: ReturnType<typeof setTimeout> | null = null;

    const toggleOpen = () => {
      card.classList.toggle('is-open');
    };

    // ====== 动作按钮（打开 / 打开书 / 插入引用 / 钉住） ======
    card.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-ref-act]') as HTMLElement | null;
      if (!btn) return;
      e.stopPropagation();
      const act = btn.dataset.refAct;
      if (act === 'open') panel.openHit(item);
      else if (act === 'open-book') panel.openBook(item);
      else if (act === 'insert') panel.insertCite(item);
      else if (act === 'pin') panel.togglePin(item, btn);
    });

    // ====== 单击展开（双击/长按会取消） ======
    card.addEventListener('click', (e) => {
      if (isFloating()) return;
      if ((e.target as HTMLElement).closest('button')) return;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickTimer = null;
        if (!card.isConnected) return;
        toggleOpen();
      }, 220);
    });

    // ====== 双击：列表态跳转，浮窗态归位 ======
    card.addEventListener('dblclick', () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      if (isFloating()) {
        collapseCard();
        return;
      }
      panel.openHit(item);
    });

    // ====== 长按状态机（保留旧语义：250ms 浮起，位移 >15px 拖出） ======
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

    const floatCard = () => {
      if (!card.isConnected || isFloating()) return;
      card.classList.add('bz-sb-ref-card--float');
      card.style.zIndex = String(allocZ());
      panel.floatingCards.add(card);
      panel.hideHoverPreview();
      cancelHold();
      const r = card.getBoundingClientRect();
      card.style.position = 'fixed';
      card.style.left = r.left + 'px';
      card.style.top = r.top + 'px';
      card.style.width = r.width + 'px';
      originalNext = card.nextElementSibling;
      document.body.appendChild(card);
      topRow.classList.add('bz-sb-ref-card-top--grip');
      detachDrag = makeDraggable(card, topRow);
      detachResize = makeResizable(card, 180, 120);
      panel.floatDetachers.set(card, () => {
        if (detachDrag) detachDrag();
        if (detachResize) detachResize();
      });
    };

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

    card.addEventListener('mousedown', (e) => {
      if (isFloating() || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button')) return;
      holdStartX = e.clientX;
      holdStartY = e.clientY;
      holdTimer = setTimeout(() => {
        holdTimer = null;
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
        cancelHold();
        return;
      }
      if (isHeld) {
        cancelHold();
        floatCard();
      }
    });

    panel.cardTeardowns.set(card, () => {
      cancelHold();
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = null;
    });

    return card;
  }

  openHit(item: SearchHit): void {
    if (item.bookId) {
      openReaderJump(this.app, item.bookId);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(item.path);
    if (!file) {
      notice('文件不存在');
      return;
    }
    jumpToChunk(file, item.chunk.slice(0, 30).trim(), true);
  }

  openBook(item: SearchHit): void {
    if (item.bookId) openReaderJump(this.app, item.bookId);
  }

  /** 插入引用到当前编辑器光标处（书命中不支持） */
  insertCite(item: SearchHit): void {
    if (item.bookId) {
      notice('书籍命中不能插入笔记引用');
      return;
    }
    const ed = this.app.workspace.activeEditor?.editor;
    if (!ed) {
      notice('没有打开的编辑器');
      return;
    }
    // 链接用库内路径（不带 .md）：只看 basename 会在同名笔记间指到错的那篇
    const link = stripMdExt(item.path.replace(/\.md$/i, ''));
    ed.replaceSelection(`[[${link}]]`);
    notice('已插入引用', 'success');
  }

  /** 钉住是会话内视觉状态，不重排结果（重排会让用户刚看的卡片跳走） */
  togglePin(item: SearchHit, btn: HTMLElement): void {
    if (this.pinned.has(item.path)) this.pinned.delete(item.path);
    else this.pinned.add(item.path);
    btn.classList.toggle('is-on', this.pinned.has(item.path));
    btn.innerHTML = `<i data-lucide="pin"></i>${this.pinned.has(item.path) ? '已钉住' : '钉住'}`;
    mountIcons(btn);
  }

  /** 悬停预览：新交互不再绑定，保留给旧测试/未来可选（直挂 body，token 自携） */
  showHoverPreview(item: SearchHit, cardEl: HTMLElement): void {
    this.hideHoverPreview();
    const refRect = this.fw.el.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const isRightSide = refRect.left > window.innerWidth / 2;
    const preview = document.createElement('div');
    preview.className = 'bz-sb-ref-preview';
    preview.style.zIndex = String(allocZ());
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
    scoreLabel.textContent = `匹配度 ${relevancePct(item)}%`;
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'bz-sb-ref-preview-body';
    renderMarkdown(bodyDiv, item.chunk, this.app);

    preview.appendChild(pathLabel);
    preview.appendChild(scoreLabel);
    preview.appendChild(bodyDiv);
    document.body.appendChild(preview);
    motionPreviewIn(preview);
    setTimeout(() => {
      if (preview.isConnected) this.clampPreviewTop(preview, cardRect.top - 20);
    }, 120);
  }

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
    this.inflight?.abort();
    this.inflight = null;
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
    for (const detach of this.floatDetachers.values()) detach();
    this.floatDetachers.clear();
    for (const fc of this.floatingCards) fc.remove();
    this.floatingCards.clear();
  }
}

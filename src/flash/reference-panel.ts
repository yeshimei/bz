/**
 * 闪念桌面参考面板（ticket 18，源码 L1317-1642 语义移植）
 * ⚠️ WIP（ticket 18 未接线）：index.ts 仅占位，本模块尚未被任何入口引用，勿依赖其行为。
 */
import type { App } from 'obsidian';
import { FloatWindow } from './float-window';
import { buildConfig } from './config';
import { getCurrentContext } from './context';
import { jumpToChunk } from './ui-tools';
import type { VectorStore } from './vector-store';

export class ReferencePanel {
  fw: FloatWindow;
  resultsDiv: HTMLElement;
  store: VectorStore;
  app: App;
  lastQuery = '';
  pollTimer: ReturnType<typeof setInterval> | null = null;
  onOpenChat: (() => void) | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(app: App, store: VectorStore, onOpenChat?: () => void) {
    this.app = app;
    this.store = store;
    this.onOpenChat = onOpenChat || null;

    const chatBtn = document.createElement('button');
    chatBtn.textContent = '🤖';
    chatBtn.title = '打开 AI 对话';
    chatBtn.style.cssText = 'background:none;border:none;cursor:pointer;box-shadow:none;font-size:.85rem;';
    chatBtn.addEventListener('click', () => this.onOpenChat?.());

    this.fw = new FloatWindow('灵感参考', { headerRight: chatBtn, onClose: () => this.stopPoll() });

    this.resultsDiv = document.createElement('div');
    this.resultsDiv.className = 'sh-results';
    this.resultsDiv.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    this.fw.body.appendChild(this.resultsDiv);

    // 自动刷新：vault modify / active-leaf-change / editor-change
    (app.vault as any).on('modify', () => this.refreshWithDebounce());
    (app.workspace as any).on('active-leaf-change', () => this.refreshWithDebounce());
    (app.workspace as any).on('editor-change', () => this.refreshWithDebounce());
    // 光标轮询
    const CONFIG = buildConfig();
    this.pollTimer = setInterval(() => {
      const ed = (this.app.workspace as any).activeEditor?.editor;
      if (!ed) return;
      const cursor = ed.getCursor();
      const prev = (this as any)._lastCursor;
      if (!prev || prev.line !== cursor.line || prev.ch !== cursor.ch) {
        (this as any)._lastCursor = cursor;
        this.refreshWithDebounce();
      }
    }, CONFIG.CURSOR_POLL_INTERVAL);
  }

  refreshWithDebounce(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const CONFIG = buildConfig();
    this.debounceTimer = setTimeout(() => this.refreshContent(), CONFIG.DEBOUNCE_DELAY);
  }

  async refreshContent(): Promise<void> {
    const CONFIG = buildConfig();
    const ed = (this.app.workspace as any).activeEditor?.editor;
    const query = getCurrentContext(ed || null);
    if (query.length < 2 || query === this.lastQuery) return;
    this.lastQuery = query;
    const results = await this.store.search(query, CONFIG.TOP_K);
    this.renderResults(results);
  }

  renderResults(results: { path: string; chunk: string; score: number }[]): void {
    this.resultsDiv.innerHTML = '';
    if (!results.length) {
      this.resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:.8rem;">未找到相关笔记</p>';
      return;
    }
    for (const r of results) {
      this.resultsDiv.appendChild(this.createResultCard(r));
    }
  }

  createResultCard(r: { path: string; chunk: string; score: number }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'sh-result-card';
    card.style.cssText = 'background:var(--background-secondary);border-radius:8px;padding:8px 10px;cursor:pointer;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';
    const name = document.createElement('span');
    const file = r.path.split('/').pop()?.replace(/\.md$/, '') || r.path;
    name.textContent = file;
    name.style.cssText = 'font-size:.8rem;font-weight:600;';
    const score = document.createElement('span');
    score.textContent = `${(r.score * 100).toFixed(0)}%`;
    score.style.cssText = 'font-size:.7rem;color:var(--text-muted);';
    head.appendChild(name);
    head.appendChild(score);

    const chunk = document.createElement('div');
    chunk.textContent = r.chunk.slice(0, 120);
    chunk.style.cssText = 'font-size:.75rem;color:var(--text-muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;';
    card.appendChild(head);
    card.appendChild(chunk);

    // hover 300ms 预览
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    card.addEventListener('mouseenter', () => {
      hoverTimer = setTimeout(() => this.showHoverPreview(card, r), 300);
    });
    card.addEventListener('mouseleave', () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      document.querySelectorAll('.sh-hover-preview').forEach((p) => p.remove());
    });

    // dblclick 跳转
    card.addEventListener('dblclick', () => {
      const f = this.app.vault.getAbstractFileByPath(r.path);
      if (f) jumpToChunk(f, r.chunk.slice(0, 30).trim(), true);
    });

    return card;
  }

  showHoverPreview(anchor: HTMLElement, r: { path: string; chunk: string; score: number }): void {
    document.querySelectorAll('.sh-hover-preview').forEach((p) => p.remove());
    const prev = document.createElement('div');
    prev.className = 'sh-hover-preview';
    prev.style.cssText = 'position:fixed;width:300px;max-height:200px;overflow-y:auto;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:10px;z-index:10030;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-size:.8rem;white-space:pre-wrap;';
    prev.textContent = r.chunk;
    document.body.appendChild(prev);
    const rect = anchor.getBoundingClientRect();
    const x = rect.right + 320 > window.innerWidth ? rect.left - 310 : rect.right + 10;
    prev.style.left = x + 'px';
    prev.style.top = Math.min(rect.top, window.innerHeight - 220) + 'px';
  }

  stopPoll(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}

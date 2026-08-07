/**
 * 闪念移动端底部抽屉（ticket 18，源码 L1877-2186 语义移植）
 */
import { escManager } from '../core/esc-manager';
import { buildConfig } from './config';
import { renderMarkdown } from './ui-tools';
import { AI } from './ai';
import type { VectorStore } from './vector-store';

const SNAP_MID = 45;
const SNAP_HIGH = 75;
const COLLAPSE_THRESHOLD = 18;

export class MobilePanel {
  store: VectorStore;
  sheet: HTMLElement;
  app: any;
  mode: 'ref' | 'chat' = 'ref';
  refTab: HTMLElement;
  chatTab: HTMLElement;
  chatMessages: HTMLElement;
  chatInput: HTMLInputElement;
  chatToggle: HTMLInputElement;
  history: { role: string; content: string }[] = [];

  constructor(app: any, store: VectorStore) {
    this.app = app;
    this.store = store;

    this.sheet = document.createElement('div');
    this.sheet.className = 'sh-mb-sheet';
    this.sheet.style.cssText = `
      position: fixed; left: 0; right: 0; bottom: 0; height: 45vh; z-index: 10040;
      background: var(--background-primary); border-radius: 16px 16px 0 0;
      box-shadow: 0 -8px 30px rgba(0,0,0,0.2); display: flex; flex-direction: column;
      transition: height .25s ease;
    `;

    // 手柄
    const grip = document.createElement('div');
    grip.style.cssText = 'width:40px;height:4px;border-radius:2px;background:var(--background-modifier-border);margin:8px auto 0;';
    this.sheet.appendChild(grip);

    // tab 切换 pill
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:6px;justify-content:center;padding:8px;';
    const refPill = document.createElement('button');
    refPill.textContent = '📚';
    refPill.style.cssText = 'padding:4px 16px;border-radius:12px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:.85rem;';
    const chatPill = document.createElement('button');
    chatPill.textContent = '🤖';
    chatPill.style.cssText = 'padding:4px 16px;border-radius:12px;border:none;background:var(--background-secondary);cursor:pointer;font-size:.85rem;';
    refPill.addEventListener('click', () => this.switchTab('ref', refPill, chatPill));
    chatPill.addEventListener('click', () => this.switchTab('chat', refPill, chatPill));
    tabs.appendChild(refPill);
    tabs.appendChild(chatPill);
    this.sheet.appendChild(tabs);

    this.refTab = document.createElement('div');
    this.refTab.style.cssText = 'flex:1;overflow-y:auto;padding:0 12px 12px;';
    this.sheet.appendChild(this.refTab);

    this.chatTab = document.createElement('div');
    this.chatTab.style.cssText = 'flex:1;overflow-y:auto;padding:0 12px;display:none;flex-direction:column;';
    this.chatMessages = document.createElement('div');
    this.chatMessages.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;';
    const chatBottom = document.createElement('div');
    chatBottom.style.cssText = 'flex-shrink:0;display:flex;gap:6px;padding:8px 0;';

    const CONFIG = buildConfig();
    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
    this.chatToggle = document.createElement('input');
    this.chatToggle.type = 'checkbox';
    this.chatToggle.checked = CONFIG.DEFAULT_USE_DEEPSEEK;
    const tl = document.createElement('label');
    tl.textContent = 'DeepSeek';
    tl.style.cssText = 'font-size:.75rem;color:var(--text-muted);';
    toggleRow.appendChild(this.chatToggle);
    toggleRow.appendChild(tl);

    this.chatInput = document.createElement('input');
    this.chatInput.type = 'text';
    this.chatInput.placeholder = `检索 ${CONFIG.CHAT_TOP_K} 条笔记辅助回答...`;
    this.chatInput.style.cssText = 'flex:1;font-size:.8rem;';
    const send = document.createElement('button');
    send.textContent = '发送';
    send.style.cssText = 'padding:4px 12px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:.8rem;';
    send.addEventListener('click', () => this.sendChat());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendChat();
    });

    chatBottom.appendChild(toggleRow);
    chatBottom.appendChild(this.chatInput);
    chatBottom.appendChild(send);
    this.chatTab.appendChild(this.chatMessages);
    this.chatTab.appendChild(chatBottom);
    this.sheet.appendChild(this.chatTab);

    document.body.appendChild(this.sheet);
    this.refreshResults();

    // ESC
    escManager.register('sh-sheet', {
      isVisible: () => !!this.sheet.isConnected,
      close: () => this.close(),
    });

    // 拖拽调整高度
    this.setupDrag(grip);
  }

  switchTab(mode: 'ref' | 'chat', refPill: HTMLElement, chatPill: HTMLElement): void {
    this.mode = mode;
    if (mode === 'ref') {
      this.refTab.style.display = 'block';
      this.chatTab.style.display = 'none';
      refPill.style.background = 'var(--interactive-accent)';
      refPill.style.color = 'var(--text-on-accent)';
      chatPill.style.background = 'var(--background-secondary)';
      chatPill.style.color = 'var(--text-normal)';
    } else {
      this.refTab.style.display = 'none';
      this.chatTab.style.display = 'flex';
      chatPill.style.background = 'var(--interactive-accent)';
      chatPill.style.color = 'var(--text-on-accent)';
      refPill.style.background = 'var(--background-secondary)';
      refPill.style.color = 'var(--text-normal)';
    }
  }

  async refreshResults(): Promise<void> {
    const CONFIG = buildConfig();
    const ed = this.app.workspace?.activeEditor?.editor;
    let query = '';
    try {
      if (ed) {
        const { getCurrentContext } = await import('./context');
        query = getCurrentContext(ed);
      }
    } catch {
      /* ignore */
    }
    const results = query.length >= 2 ? await this.store.searchMobile(query, CONFIG.TOP_K) : [];
    this.renderRefTab(results);
  }

  renderRefTab(results: { path: string; chunk: string; score: number }[]): void {
    this.refTab.innerHTML = '';
    if (!results.length) {
      this.refTab.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:20px 0;">未找到相关笔记</p>';
      return;
    }
    for (const r of results) {
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--background-secondary);border-radius:8px;padding:8px 10px;margin-bottom:8px;';
      const file = r.path.split('/').pop()?.replace(/\.md$/, '') || r.path;
      card.innerHTML = `<div style="font-size:.8rem;font-weight:600;">${file} <span style="color:var(--text-muted);font-weight:400;">${(r.score * 100).toFixed(0)}%</span></div><div style="font-size:.75rem;color:var(--text-muted);margin-top:4px;">${r.chunk.slice(0, 100)}</div>`;
      this.refTab.appendChild(card);
    }
  }

  appendChatMsg(role: 'user' | 'assistant', content: string): void {
    const div = document.createElement('div');
    div.style.cssText = `background:${role === 'user' ? 'var(--interactive-accent)' : 'var(--background-secondary)'};border-radius:8px;padding:8px 10px;font-size:.8rem;white-space:pre-wrap;align-self:${role === 'user' ? 'flex-end' : 'flex-start'};max-width:90%;`;
    if (role === 'assistant') {
      renderMarkdown(div, content, this.app);
    } else {
      div.textContent = content;
    }
    this.chatMessages.appendChild(div);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    this.history.push({ role, content });
  }

  async sendChat(): Promise<void> {
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = '';
    this.appendChatMsg('user', text);
    try {
      const CONFIG = buildConfig();
      const results = await this.store.searchMobile(text, CONFIG.CHAT_TOP_K);
      const context = results.length
        ? results.map((r) => `[${r.path}] (${(r.score * 100).toFixed(0)}%)\n${r.chunk}`).join('\n\n')
        : '（未找到相关笔记）';
      const prompt = `你是知识助手。参考笔记库中 ${results.length} 条检索结果回答问题。不相关可忽略。

【参考内容】
${context}

【问题】
${text}`;
      const reply = await AI.ask(prompt, this.chatToggle.checked);
      this.appendChatMsg('assistant', reply);
    } catch (e: any) {
      this.appendChatMsg('assistant', '出错了：' + (e.message || e));
    }
    const CONFIG = buildConfig();
    if (this.history.length > CONFIG.MAX_HISTORY * 2) {
      this.history = this.history.slice(-CONFIG.MAX_HISTORY * 2);
    }
  }

  setupDrag(grip: HTMLElement): void {
    let dragging = false;
    let startY = 0;
    let startH = 0;
    grip.addEventListener('touchstart', (e) => {
      dragging = true;
      startY = (e as any).touches[0].clientY;
      startH = this.sheet.getBoundingClientRect().height;
    });
    grip.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const y = (e as any).touches[0].clientY;
      const newH = startH + (startY - y);
      const vh = window.innerHeight;
      const pct = (newH / vh) * 100;
      if (pct < COLLAPSE_THRESHOLD) {
        this.sheet.style.height = '45vh';
        return;
      }
      this.sheet.style.height = Math.min(pct, 90) + 'vh';
    });
    grip.addEventListener('touchend', () => {
      dragging = false;
      const pct = (this.sheet.getBoundingClientRect().height / window.innerHeight) * 100;
      if (pct < COLLAPSE_THRESHOLD + 8) this.sheet.style.height = SNAP_MID + 'vh';
      else if (pct < 60) this.sheet.style.height = SNAP_MID + 'vh';
      else this.sheet.style.height = SNAP_HIGH + 'vh';
    });
  }

  close(): void {
    if (this.sheet.isConnected) this.sheet.remove();
  }
}

/**
 * 闪念桌面 AI 对话面板（ticket 18，源码 L1644-1735 语义移植）
 */
import { FloatWindow } from './float-window';
import { buildConfig } from './config';
import { renderMarkdown } from './ui-tools';
import { AI } from './ai';
import type { VectorStore } from './vector-store';

export class ChatPanel {
  fw: FloatWindow;
  messagesDiv: HTMLElement;
  input: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  toggle: HTMLInputElement;
  store: VectorStore;
  history: { role: string; content: string }[] = [];

  constructor(store: VectorStore, app: any) {
    this.store = store;
    this.fw = new FloatWindow('AI 助手', { onClose: () => {} });

    this.messagesDiv = document.createElement('div');
    this.messagesDiv.style.cssText = 'display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto;';
    this.fw.body.style.display = 'flex';
    this.fw.body.style.flexDirection = 'column';
    this.fw.body.appendChild(this.messagesDiv);

    // 欢迎语
    const CONFIG = buildConfig();
    const welcome = document.createElement('div');
    welcome.className = 'sh-msg sh-msg-assistant';
    welcome.textContent = `你好！每次提问会独立检索 ${CONFIG.CHAT_TOP_K} 条笔记辅助回答。`;
    welcome.style.cssText = 'background:var(--background-secondary);border-radius:8px;padding:8px 10px;font-size:.8rem;';
    this.messagesDiv.appendChild(welcome);

    // 底部：toggle + input + send
    const bottom = document.createElement('div');
    bottom.style.cssText = 'flex-shrink:0;border-top:1px solid var(--background-modifier-border);padding:8px;';

    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
    this.toggle = document.createElement('input');
    this.toggle.type = 'checkbox';
    this.toggle.checked = CONFIG.DEFAULT_USE_DEEPSEEK;
    const toggleLabel = document.createElement('label');
    toggleLabel.textContent = 'DeepSeek';
    toggleLabel.style.cssText = 'font-size:.75rem;color:var(--text-muted);';
    toggleRow.appendChild(this.toggle);
    toggleRow.appendChild(toggleLabel);
    bottom.appendChild(toggleRow);

    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;gap:6px;';
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = `检索 ${CONFIG.CHAT_TOP_K} 条笔记辅助回答...`;
    this.input.style.cssText = 'flex:1;font-size:.8rem;';
    this.sendBtn = document.createElement('button');
    this.sendBtn.textContent = '发送';
    this.sendBtn.style.cssText = 'padding:4px 12px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:.8rem;';
    this.sendBtn.addEventListener('click', () => this.sendChatMessage());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });
    inputRow.appendChild(this.input);
    inputRow.appendChild(this.sendBtn);
    bottom.appendChild(inputRow);

    this.fw.body.appendChild(bottom);
  }

  get alive(): boolean {
    return this.fw.alive;
  }

  expand(): void {
    this.fw.show();
  }

  addChatMessage(role: 'user' | 'assistant', content: string): void {
    const div = document.createElement('div');
    div.className = `sh-msg sh-msg-${role}`;
    div.style.cssText = `background:${role === 'user' ? 'var(--interactive-accent)' : 'var(--background-secondary)'};border-radius:8px;padding:8px 10px;font-size:.8rem;white-space:pre-wrap;`;
    if (role === 'assistant') {
      renderMarkdown(div, content, (this.fw as any).app || (globalThis as any).__flashApp);
    } else {
      div.textContent = content;
    }
    this.messagesDiv.appendChild(div);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    this.history.push({ role, content });
  }

  async sendChatMessage(): Promise<void> {
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = '';
    this.addChatMessage('user', text);
    this.sendBtn.disabled = true;
    this.sendBtn.textContent = '···';

    try {
      const CONFIG = buildConfig();
      const results = await this.store.search(text, CONFIG.CHAT_TOP_K);
      let context = '';
      if (results.length) {
        context = results
          .map((r) => `[${r.path}] (${(r.score * 100).toFixed(0)}%)\n${r.chunk}`)
          .join('\n\n');
      } else {
        context = '（未找到相关笔记）';
      }
      const prompt = `你是知识助手。参考笔记库中 ${results.length} 条检索结果回答问题。不相关可忽略。

【参考内容】
${context}

【问题】
${text}`;

      const reply = await AI.ask(prompt, this.toggle.checked);
      this.addChatMessage('assistant', reply);
    } catch (e: any) {
      this.addChatMessage('assistant', '出错了：' + (e.message || e));
    } finally {
      this.sendBtn.disabled = false;
      this.sendBtn.textContent = '发送';
    }

    const CONFIG = buildConfig();
    const max = CONFIG.MAX_HISTORY * 2;
    if (this.history.length > max) {
      this.history = this.history.slice(-max);
    }
  }

  close(): void {
    this.fw.close();
  }
}

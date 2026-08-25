/**
 * 第二大脑桌面 AI 对话面板（ticket 103；对齐 QA 闪念.js L1644-1735）
 * 补齐交互点：
 * - DeepSeek 复选框（默认值 DEFAULT_USE_DEEPSEEK，L1663-1667）+ Enter 发送（L1728）
 * - RAG 提示词逐字对齐 L1718：每问独立检索 CHAT_TOP_K 条，context 格式 `[path] (xx%)\nchunk`；
 *   历史仅 UI 展示 + 裁剪 MAX_HISTORY×2 条，不进 prompt（L1703-1718）
 * - assistant 消息 markdown 渲染（renderMarkdown 失败回退纯文本），user 消息纯文本（L1693-1701）
 * - app 经构造函数注入（替代 QA 全局 app 与 WIP 半成品挂 window 的做法——铁律 5）
 */
import type { App } from 'obsidian';
import { FloatWindow } from './float-window';
import { buildConfig } from './config';
import { renderMarkdown } from './ui-tools';
import { AI } from './ai';
import type { SearchHit, VectorStore } from './vector-store';

export class ChatPanel {
  fw: FloatWindow;
  messagesDiv: HTMLElement;
  input: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  toggle: HTMLInputElement;
  store: VectorStore;
  history: { role: 'user' | 'assistant'; content: string }[] = [];
  private app: App;

  constructor(store: VectorStore, app: App, existingWin?: FloatWindow) {
    this.app = app;
    this.store = store;

    const chatContainer = document.createElement('div');
    chatContainer.className = 'bz-sb-chat-wrap';

    this.messagesDiv = document.createElement('div');
    this.messagesDiv.className = 'bz-sb-chat-messages bz-sb-scroll-y';
    chatContainer.appendChild(this.messagesDiv);

    const CONFIG = buildConfig();

    // 输入区：DeepSeek 开关 + 输入框 + 发送
    const inputArea = document.createElement('div');
    inputArea.className = 'bz-sb-chat-input-area';

    const toggleRow = document.createElement('label');
    toggleRow.className = 'bz-sb-chat-toggle';
    this.toggle = document.createElement('input');
    this.toggle.type = 'checkbox';
    this.toggle.checked = CONFIG.DEFAULT_USE_DEEPSEEK;
    toggleRow.appendChild(this.toggle);
    toggleRow.appendChild(document.createTextNode('DeepSeek'));
    inputArea.appendChild(toggleRow);

    const inputRow = document.createElement('div');
    inputRow.className = 'bz-sb-chat-input-row';
    this.input = document.createElement('input');
    this.input.className = 'bz-sb-chat-input';
    this.input.type = 'text';
    this.input.placeholder = `检索 ${CONFIG.CHAT_TOP_K} 条笔记辅助回答...`;
    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'bz-sb-chat-send';
    this.sendBtn.textContent = '发送';
    this.sendBtn.addEventListener('click', () => void this.sendChatMessage());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.sendChatMessage();
    });
    inputRow.appendChild(this.input);
    inputRow.appendChild(this.sendBtn);
    inputArea.appendChild(inputRow);
    chatContainer.appendChild(inputArea);

    if (existingWin) {
      // 入口已建窄窗时复用（index 接线传 chatWin，避免双窗）
      this.fw = existingWin;
    } else {
      this.fw = new FloatWindow('AI 助手', {});
    }
    this.fw.body.appendChild(chatContainer);

    this.addChatMessage('assistant', `你好！每次提问会独立检索 ${CONFIG.CHAT_TOP_K} 条笔记辅助回答。`);
    this.input.focus();
  }

  get alive(): boolean {
    return this.fw.alive;
  }

  expand(): void {
    this.fw.expand();
  }

  /** 历史仅 UI 展示用；裁剪 MAX_HISTORY×2 条，不进 prompt（每问独立检索） */
  addChatMessage(role: 'user' | 'assistant', content: string): void {
    const div = document.createElement('div');
    div.className = `bz-sb-chat-msg ${role}`;
    if (role === 'assistant') {
      renderMarkdown(div, content, this.app); // 失败时内部回退 textContent
    } else {
      div.textContent = content;
    }
    this.messagesDiv.appendChild(div);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    this.history.push({ role, content });
    const CONFIG = buildConfig();
    if (this.history.length > CONFIG.MAX_HISTORY * 2) {
      this.history = this.history.slice(-CONFIG.MAX_HISTORY * 2);
    }
  }

  async sendChatMessage(): Promise<void> {
    const userMsg = this.input.value.trim();
    if (!userMsg) return;
    this.input.value = '';
    this.addChatMessage('user', userMsg);
    this.sendBtn.disabled = true;
    this.sendBtn.textContent = '···';
    try {
      const CONFIG = buildConfig();
      const results: SearchHit[] = await this.store.search(userMsg, CONFIG.CHAT_TOP_K);
      const context =
        results.length > 0
          ? results.map((r) => `[${r.path}] (${Math.round(r.score * 100)}%)\n${r.chunk}`).join('\n\n')
          : '（未找到相关笔记）';
      // QA L1718 提示词原样
      const fullPrompt = `你是知识助手。参考笔记库中 ${results.length} 条检索结果回答问题。不相关可忽略。\n\n【参考内容】\n${context}\n\n【问题】\n${userMsg}`;
      const answer = await AI.ask(fullPrompt, this.toggle.checked);
      this.addChatMessage('assistant', answer);
    } catch (e: any) {
      this.addChatMessage('assistant', '出错了：' + (e?.message || e));
    } finally {
      this.sendBtn.disabled = false;
      this.sendBtn.textContent = '发送';
    }
  }

  close(): void {
    this.fw.close();
  }
}

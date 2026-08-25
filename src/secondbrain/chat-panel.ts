/**
 * 第二大脑 AI 对话（ticket 103 建；ticket 108 改居中弹窗）
 * - 形态：普通弹窗（core createOverlay，遮罩+ESC 关闭，无任何头部按钮——用户拍板）；
 *   此前为右侧窄窗形态，🤖 入口随参考窄窗按钮精简一并移除；
 * - DeepSeek 复选框删除：统一走主设置页「🤖 AI」服务商（ticket 108）；
 * - RAG 提示词逐字对齐 QA L1718：每问独立检索 CHAT_TOP_K 条，context 格式 `[path] (xx%)\nchunk`；
 *   历史仅 UI 展示 + 裁剪 MAX_HISTORY×2 条，不进 prompt；
 * - assistant 消息 markdown 渲染（失败回退纯文本），user 消息纯文本。
 */
import type { App } from 'obsidian';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { buildConfig } from './config';
import { renderMarkdown } from './ui-tools';
import { AI } from './ai';
import type { SearchHit, VectorStore } from './vector-store';

export class ChatPanel {
  store: VectorStore;
  messagesDiv: HTMLElement;
  input: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  history: { role: 'user' | 'assistant'; content: string }[] = [];
  mask: HTMLDivElement;
  popup: HTMLDivElement;
  private app: App;
  private escHandle: ReturnType<typeof escManager.register> | null = null;

  constructor(store: VectorStore, app: App) {
    this.app = app;
    this.store = store;

    const CONFIG = buildConfig();
    // 弹窗外壳：主面板族层级（9998 遮罩 / 9999 本体），与 smartcat 对话弹窗同款先例
    const { mask, popup } = createOverlay({
      maskId: 'bz-sb-chat-mask',
      popupId: 'bz-sb-chat-panel',
      zIndex: 9998,
      onMaskClick: () => this.close(),
    });
    this.mask = mask;
    this.popup = popup;
    this.popup.classList.add('bz-sb-chat-modal');

    // 头部：仅标题文字（不放任何按钮——靠遮罩+ESC 关闭）
    const head = document.createElement('div');
    head.className = 'bz-win-head bz-sb-chat-head';
    const title = document.createElement('h3');
    title.textContent = '🤖 AI 助手';
    head.appendChild(title);

    // 消息区
    this.messagesDiv = document.createElement('div');
    this.messagesDiv.className = 'bz-sb-chat-messages bz-sb-scroll-y';

    // 输入区（DeepSeek 开关已随统一 AI 通道移除）
    const inputArea = document.createElement('div');
    inputArea.className = 'bz-sb-chat-input-area';
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

    this.popup.appendChild(head);
    this.popup.appendChild(this.messagesDiv);
    this.popup.appendChild(inputArea);
    document.body.appendChild(mask);
    document.body.appendChild(popup);

    // ESC 关闭走 escManager 层级
    this.escHandle = escManager.register('bz-sb-chat-modal', {
      isVisible: () => this.popup.style.display === 'flex' && !!this.popup.isConnected,
      close: () => this.close(),
    });

    this.addChatMessage('assistant', `你好！每次提问会独立检索 ${CONFIG.CHAT_TOP_K} 条笔记辅助回答。`);
  }

  get alive(): boolean {
    return !!this.popup.isConnected;
  }

  /** 显示弹窗并聚焦输入框 */
  show(): void {
    if (!this.alive) return;
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    this.input.focus();
  }

  close(): void {
    this.mask.style.display = 'none';
    this.popup.style.display = 'none';
  }

  /** 完全销毁（unload 调用）：摘 ESC 层并移除 DOM */
  destroy(): void {
    this.escHandle?.unregister();
    this.escHandle = null;
    this.mask.remove();
    this.popup.remove();
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
      const answer = await AI.ask(fullPrompt);
      this.addChatMessage('assistant', answer);
    } catch (e: any) {
      this.addChatMessage('assistant', '出错了：' + (e?.message || e));
    } finally {
      this.sendBtn.disabled = false;
      this.sendBtn.textContent = '发送';
    }
  }
}

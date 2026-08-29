/**
 * 第二大脑 AI 对话（ticket 103 建；ticket 108 改居中弹窗；ticket 141 UX 批次）
 * - 形态：普通弹窗（core createOverlay，遮罩+ESC 关闭）；
 *   此前为右侧窄窗形态，🤖 入口随参考窄窗按钮精简一并移除；
 *   （ticket 141：头部新增「清空对话」小按钮——flow 确认后清空历史并写盘，关闭仍靠遮罩+ESC）
 * - DeepSeek 复选框删除：统一走主设置页「🤖 AI」服务商（ticket 108）；
 * - RAG 提示词逐字对齐 QA L1718：每问独立检索 CHAT_TOP_K 条，context 格式 `[path] (xx%)\nchunk`；
 *   历史仅 UI 展示 + 裁剪 MAX_HISTORY×2 条，不进 prompt；
 * - assistant 消息 markdown 渲染（失败回退纯文本），user 消息纯文本。
 * - ticket 141：
 *   ① 输入改多行 textarea（Enter 发送 / Shift+Enter 换行，isComposing 组合态回车不发送——
 *      与 smartcat 聊天输入同款交互；高度自增、CSS 钳制上限 5 行）；
 *   ② 请求可取消：发送钮原地切「停止」，AbortController 经 AI.ask 透传 core/ai 中止 fetch；
 *   ③ 流式增量渲染（onDelta 增量纯文本 → 完成后整段 markdown 重渲；中止丢弃未完成回复）；
 *   ④ 历史持久化：secondbrain.json chatHistory 段（上限 100 条，每轮问答写盘，打开读回渲染）。
 */
import type { App } from 'obsidian';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { openFlowDialog } from '../core/flow-dialog';
import { buildConfig } from './config';
import { renderMarkdown } from './ui-tools';
import { AI } from './ai';
import { appendChatHistory, clearChatHistory, loadChatHistory, type ChatHistoryEntry } from './store-file';
import type { SearchHit, VectorStore } from './vector-store';

/** 欢迎语（首次进入 / 清空后共用一份文案） */
function welcomeText(): string {
  return `你好！每次提问会独立检索 ${buildConfig().CHAT_TOP_K} 条笔记辅助回答。`;
}

export class ChatPanel {
  store: VectorStore;
  messagesDiv: HTMLElement;
  input: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  history: { role: 'user' | 'assistant'; content: string }[] = [];
  mask: HTMLDivElement;
  popup: HTMLDivElement;
  private app: App;
  private escHandle: ReturnType<typeof escManager.register> | null = null;
  /** 进行中的对话请求（ticket 141）：非空时发送钮呈「停止」态，点击中止 */
  private inFlight: AbortController | null = null;
  /** 轮次序号：清空对话 / 销毁后，旧轮的回调不再写 UI 与历史 */
  private seq = 0;

  constructor(store: VectorStore, app: App) {
    this.app = app;
    this.store = store;

    const CONFIG = buildConfig();
    // 弹窗外壳（z-index 动态发号，ADR-0067），与 smartcat 对话弹窗同款先例
    const { mask, popup } = createOverlay({
      maskId: 'bz-sb-chat-mask',
      popupId: 'bz-sb-chat-panel',
      onMaskClick: () => this.close(),
    });
    this.mask = mask;
    this.popup = popup;
    this.popup.classList.add('bz-sb-chat-modal');

    // 头部：标题 + 「清空对话」小按钮（ticket 141）
    const head = document.createElement('div');
    head.className = 'bz-win-head bz-sb-chat-head';
    const title = document.createElement('h3');
    title.textContent = '🤖 AI 助手';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'bz-sb-chat-clear';
    clearBtn.textContent = '清空对话';
    clearBtn.addEventListener('click', () => void this.confirmClear());
    head.appendChild(title);
    head.appendChild(clearBtn);

    // 消息区
    this.messagesDiv = document.createElement('div');
    this.messagesDiv.className = 'bz-sb-chat-messages bz-sb-scroll-y';

    // 输入区（DeepSeek 开关已随统一 AI 通道移除；ticket 141 单行 input → 多行 textarea）
    const inputArea = document.createElement('div');
    inputArea.className = 'bz-sb-chat-input-area';
    const inputRow = document.createElement('div');
    inputRow.className = 'bz-sb-chat-input-row';
    this.input = document.createElement('textarea');
    this.input.className = 'bz-sb-chat-input';
    this.input.rows = 1;
    this.input.placeholder = `检索 ${CONFIG.CHAT_TOP_K} 条笔记辅助回答...`;
    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'bz-sb-chat-send';
    this.sendBtn.textContent = '发送';
    this.sendBtn.addEventListener('click', () => {
      if (this.inFlight) {
        this.inFlight.abort(); // 「停止」态：中止当前请求
        return;
      }
      void this.sendChatMessage();
    });
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      // 中文输入法组合态（composition）回车是选字确认，不发送——isComposing 标准属性
      // + keyCode 229（Safari/部分浏览器组合期 keyCode 兜底）双保险（smartcat 聊天同款）
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.sendChatMessage();
      }
      // Shift+Enter 换行：走 textarea 默认行为，不拦截
    });
    this.input.addEventListener('input', () => this.autoGrowInput());
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

    this.addChatMessage('assistant', welcomeText());
    this.restorePersistedHistory(); // 打开读回持久化历史（ticket 141）
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

  /** 完全销毁（unload 调用）：摘 ESC 层、中止在途请求并移除 DOM */
  destroy(): void {
    this.seq++; // 旧轮回调失效
    this.inFlight?.abort();
    this.inFlight = null;
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

  // ==================== ticket 141：多行输入 / 取消 / 流式 / 历史持久化 ====================

  /** textarea 自增高度：随内容长高，CSS max-height 钳制上限 5 行，超出内部滚动 */
  private autoGrowInput(): void {
    this.input.style.height = 'auto';
    this.input.style.height = this.input.scrollHeight + 'px';
  }

  /** 每轮写盘（fire-and-forget；失败仅告警，不阻断对话） */
  private persistHistory(entries: ChatHistoryEntry[]): void {
    appendChatHistory(entries, this.app).catch((e) =>
      console.warn('[secondbrain] 对话历史写盘失败', e)
    );
  }

  /** 打开读回持久化历史（旧数据无 chatHistory 段 → []，保持欢迎语，零迁移） */
  private async restorePersistedHistory(): Promise<void> {
    let entries: ChatHistoryEntry[];
    try {
      entries = await loadChatHistory(this.app);
    } catch (e) {
      console.warn('[secondbrain] 对话历史读回失败', e);
      return;
    }
    if (!entries.length || !this.alive) return;
    for (const m of entries) this.addChatMessage(m.role, m.content);
  }

  async sendChatMessage(): Promise<void> {
    if (this.inFlight) return; // 请求进行中：发送钮当前是「停止」，Enter 不触发新一轮
    const userMsg = this.input.value.trim();
    if (!userMsg) return;
    this.input.value = '';
    this.autoGrowInput();
    this.addChatMessage('user', userMsg);
    this.persistHistory([{ role: 'user', content: userMsg }]);

    const controller = new AbortController();
    const seq = ++this.seq;
    this.inFlight = controller;
    this.sendBtn.disabled = false;
    this.sendBtn.textContent = '停止';

    // 流式占位气泡：增量纯文本；完成后整段按 markdown 重渲
    const live = document.createElement('div');
    live.className = 'bz-sb-chat-msg assistant';
    let acc = '';
    this.messagesDiv.appendChild(live);
    try {
      const CONFIG = buildConfig();
      const results: SearchHit[] = await this.store.search(userMsg, CONFIG.CHAT_TOP_K);
      const context =
        results.length > 0
          ? results.map((r) => `[${r.path}] (${Math.round(r.score * 100)}%)\n${r.chunk}`).join('\n\n')
          : '（未找到相关笔记）';
      // QA L1718 提示词原样
      const fullPrompt = `你是知识助手。参考笔记库中 ${results.length} 条检索结果回答问题。不相关可忽略。\n\n【参考内容】\n${context}\n\n【问题】\n${userMsg}`;
      const answer = await AI.ask(fullPrompt, {
        signal: controller.signal,
        onDelta: (delta) => {
          acc += delta;
          live.textContent = acc;
          this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
        },
      });
      live.remove();
      if (seq === this.seq) {
        this.addChatMessage('assistant', answer);
        this.persistHistory([{ role: 'assistant', content: answer }]);
      }
    } catch (e: any) {
      live.remove();
      if (seq !== this.seq) return; // 已清空/销毁：旧轮不再补写 UI
      if (controller.signal.aborted) {
        this.addChatMessage('assistant', '已停止生成。'); // 取消提示仅 UI 呈现，不落历史
      } else {
        this.addChatMessage('assistant', '出错了：' + (e?.message || e));
      }
    } finally {
      if (seq === this.seq) {
        this.inFlight = null;
        this.sendBtn.disabled = false;
        this.sendBtn.textContent = '发送';
      } else if (this.inFlight === controller) {
        this.inFlight = null;
      }
    }
  }

  /** 「清空对话」（ticket 141）：flow 确认 → 中止在途请求 → 清内存与 UI → 写盘空段 */
  private async confirmClear(): Promise<void> {
    const v = await openFlowDialog({
      title: '清空对话',
      message: '将清空全部对话历史并写盘，确定继续吗？',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '清空', value: 'ok', cta: true },
      ],
    });
    if (v !== 'ok') return;
    this.seq++; // 旧轮回调失效
    this.inFlight?.abort();
    this.inFlight = null;
    this.sendBtn.disabled = false;
    this.sendBtn.textContent = '发送';
    this.history = [];
    this.messagesDiv.innerHTML = '';
    this.addChatMessage('assistant', welcomeText());
    try {
      await clearChatHistory(this.app);
    } catch (e) {
      console.warn('[secondbrain] 对话历史清空写盘失败', e);
    }
  }
}

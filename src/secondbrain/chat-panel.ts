/**
 * 第二大脑 AI 对话（ticket 103 建；ticket 108 居中弹窗；ticket 141 UX 批次；issue 251 定稿原型重写）
 *
 * UI 按定稿原型重写（.zcode/ui-prototypes/secondbrain-final/chat.html）：头行模型徽标 +
 * 消息气泡（user 墨底右对齐 / assistant 白卡）+ 检索中态（呼吸点）+ 引用卡列表 + 推荐问法
 * 常驻 chips。markup 出 render.ts 纯层；本文件只留行为。
 *
 * 行为逐行保留：DeepSeek 统一走主设置页 AI 服务商；RAG 提示词逐字对齐 QA L1718（每问独立
 * 检索 CHAT_TOP_K 条，context 格式 `[path] (xx%)\nchunk`）；历史仅 UI 展示 + 裁剪
 * MAX_HISTORY×2 条不进 prompt；多行 textarea（Enter 发送 / Shift+Enter 换行 / isComposing
 * 组合态不发送）；请求可取消（发送钮原地切「停止」，AbortController 中止）；流式增量渲染
 * （onDelta 增量纯文本 → 完成后整段 markdown 重渲）；历史持久化 secondbrain.json
 * chatHistory 段（上限 100 条）。
 *
 * 落域适配（ADR-0110 §4）：检索命中（path+score）以引用卡渲染——仅会话内展示不落盘，
 * chatHistory 段 {role, content} 结构零改动（历史读回无引用卡）；引用卡点击 = 打开对应笔记。
 */
import type { App } from 'obsidian';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { openFlowDialog } from '../core/flow-dialog';
import { mountIcons } from '../core/ui';
import { buildConfig } from './config';
import { renderMarkdown } from './ui-tools';
import { AI } from './ai';
import { appendChatHistory, clearChatHistory, loadChatHistory, type ChatHistoryEntry } from './store-file';
import { chatShellHtml, chatUserMsgHtml, chatAiMsgHtml, chatThinkingHtml, chatCitesHtml, sbSourceColor, computeStats } from './render';
import type { SearchHit, VectorStore } from './vector-store';

/** 欢迎语（首次进入 / 清空后共用一份文案） */
function welcomeText(topK: number): string {
  return `你好！每次提问会独立检索 ${topK} 条笔记辅助回答。`;
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
    // 弹窗外壳（z-index 动态发号，ADR-0067）
    const { mask, popup } = createOverlay({
      maskId: 'bz-sb-chat-mask',
      popupId: 'bz-sb-chat-panel',
      onMaskClick: () => this.close(),
      width: '760px', // createOverlay 以内联样式设宽（优先级高于类规则），必须在此定尺寸
      maxWidth: 760,
    });
    this.mask = mask;
    this.popup = popup;
    this.popup.classList.add('bz-sb-chat-modal');
    this.popup.innerHTML = chatShellHtml(CONFIG.CHAT_TOP_K, CONFIG.DEEPSEEK_MODEL);
    mountIcons(this.popup); // data-lucide 占位物化

    this.messagesDiv = this.popup.querySelector('#bz-sb-chat-messages') as HTMLElement;
    this.input = this.popup.querySelector('#bz-sb-chat-input') as HTMLTextAreaElement;
    this.sendBtn = this.popup.querySelector('#bz-sb-chat-send') as HTMLButtonElement;

    this.popup.querySelector('#bz-sb-chat-clear')?.addEventListener('click', () => void this.confirmClear());
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

    // 推荐问法（定稿原型常驻 chips）：点击即问
    this.popup.querySelector('#bz-sb-chat-chips')?.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest('.bz-sb-chat-chip') as HTMLElement | null;
      if (!chip || this.inFlight) return;
      this.input.value = chip.dataset.q || '';
      void this.sendChatMessage();
    });

    // 引用卡点击 = 打开对应笔记（会话内检索命中）
    this.messagesDiv.addEventListener('click', (e) => {
      const cite = (e.target as HTMLElement).closest('.bz-sb-chat-cite') as HTMLElement | null;
      if (!cite) return;
      const path = cite.dataset.path;
      const f = path ? this.app.vault.getAbstractFileByPath(path) : null;
      if (f) void this.app.workspace.getLeaf(false).openFile(f as any);
      else if (path) this.appendAiNote('文件不存在或已被移动');
    });

    document.body.appendChild(mask);
    document.body.appendChild(popup);

    // ESC 关闭走 escManager 层级
    this.escHandle = escManager.register('bz-sb-chat-modal', {
      isVisible: () => this.popup.style.display === 'flex' && !!this.popup.isConnected,
      close: () => this.close(),
    });

    this.addChatMessage('assistant', welcomeText(CONFIG.CHAT_TOP_K));
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
  addChatMessage(role: 'user' | 'assistant', content: string, hits?: SearchHit[]): HTMLElement {
    const div = document.createElement('div');
    div.className = `bz-sb-chat-msg ${role}`;
    if (role === 'assistant') {
      div.innerHTML = chatAiMsgHtml();
      const bubble = div.querySelector('.bz-sb-chat-bubble') as HTMLElement;
      renderMarkdown(bubble, content, this.app); // 失败时内部回退 textContent
      if (hits?.length) bubble.insertAdjacentHTML('beforeend', chatCitesHtml(this.citeRows(hits)));
    } else {
      div.innerHTML = chatUserMsgHtml();
      (div.querySelector('.bz-sb-chat-bubble') as HTMLElement).textContent = content;
    }
    this.messagesDiv.appendChild(div);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    this.history.push({ role, content });
    const CONFIG = buildConfig();
    if (this.history.length > CONFIG.MAX_HISTORY * 2) {
      this.history = this.history.slice(-CONFIG.MAX_HISTORY * 2);
    }
    return div;
  }

  /** 引用卡行（来源色点按来源分布序取色板） */
  private citeRows(hits: SearchHit[]): Array<{ path: string; pct: number; color: string }> {
    const order = new Map(computeStats(this.store.meta).bySource.map((s, i) => [s.name, i]));
    return hits.slice(0, 5).map((h) => ({
      path: h.path,
      pct: Math.round(h.score * 100),
      color: sbSourceColor(h.path.split('/')[0] || '（根目录）', order),
    }));
  }

  /** 轻量 assistant 提示（不进历史；用于错误/停止等纯 UI 文案之外的补充说明） */
  private appendAiNote(text: string): void {
    const note = document.createElement('div');
    note.className = 'bz-sb-ref-empty';
    note.textContent = text;
    this.messagesDiv.appendChild(note);
  }

  // ==================== ticket 141：多行输入 / 取消 / 流式 / 历史持久化 ====================

  /** textarea 自增高度：随内容长高，CSS max-height 钳制上限，超出内部滚动 */
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

    const CONFIG = buildConfig();
    const controller = new AbortController();
    const seq = ++this.seq;
    this.inFlight = controller;
    this.sendBtn.disabled = false;
    this.sendBtn.setAttribute('data-state', 'stop');
    this.sendBtn.title = '停止';

    // 检索中态（定稿原型）：呼吸点占位 → 检索完成转流式输出
    const live = document.createElement('div');
    live.className = 'bz-sb-chat-msg assistant';
    live.innerHTML = chatAiMsgHtml();
    (live.querySelector('.bz-sb-chat-bubble') as HTMLElement).innerHTML = chatThinkingHtml(CONFIG.CHAT_TOP_K);
    this.messagesDiv.appendChild(live);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    let acc = '';
    try {
      const results: SearchHit[] = await this.store.search(userMsg, CONFIG.CHAT_TOP_K);
      if (seq !== this.seq) return; // 已清空/销毁
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
          const bubble = live.querySelector('.bz-sb-chat-bubble');
          if (bubble) bubble.textContent = acc;
          this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
        },
      });
      live.remove();
      if (seq === this.seq) {
        this.addChatMessage('assistant', answer, results); // 引用卡仅会话内展示（ADR-0110 §4）
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
        this.sendBtn.removeAttribute('data-state');
        this.sendBtn.title = '发送';
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
    this.sendBtn.removeAttribute('data-state');
    this.sendBtn.title = '发送';
    this.history = [];
    this.messagesDiv.innerHTML = '';
    this.addChatMessage('assistant', welcomeText(buildConfig().CHAT_TOP_K));
    try {
      await clearChatHistory(this.app);
    } catch (e) {
      console.warn('[secondbrain] 对话历史清空写盘失败', e);
    }
  }
}

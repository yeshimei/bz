/**
 * 第二大脑 AI 对话（ticket 103 建；2026-11 重写为「探针」三栏弹窗）
 *
 * 形态：与主面板同尺寸的居中弹窗（900×620，遮罩 + 点遮罩/ESC 关闭），
 * 内部三栏：本次问题索引 / 对话 / 本次依据。不是全屏工作区。
 *
 * 行为逐行保留：对话统一走主设置页 AI 设置（core AIService）；RAG 提示词在 QA L1718 基础上
 * 增加引用标号约定（每问独立检索 CHAT_TOP_K 条，context 格式 `[path] (xx%)\nchunk`）；历史仅 UI
 * 展示 + 裁剪 MAX_HISTORY×2 条不进 prompt；多行 textarea（Enter 发送 / Shift+Enter 换行 /
 * isComposing 组合态不发送）；请求可取消（发送钮原地切「停止」）；流式增量渲染；历史仍写盘
 * secondbrain.json chatHistory 段（上限 100 条），但打开默认空会话、不自动读回旧历史。
 *
 * 落域适配（ADR-0110 §4）：检索命中（path+score）以右栏引用卡渲染——仅会话内展示不落盘，
 * chatHistory 段 {role, content} 结构零改动（历史只写盘、打开不读回）；引用卡点击 = 打开对应笔记。
 */
import type { App, TFile } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { openFlowDialog } from '../core/flow-dialog';
import { bindMaskDismiss } from '../core/mask-dismiss';
import { openReaderJump } from '../core/reader-link';
import { topifyZ } from '../core/z-order';
import { mountIcons } from '../core/ui';
import { buildConfig } from './config';
import { renderMarkdown } from './ui-tools';
import { AI } from './ai';
import { getAIProvider, getProviderDescriptor } from '../core/ai';
import { appendChatHistory, clearChatHistory, type ChatHistoryEntry } from './store-file';
import {
  chatShellHtml,
  chatUserMsgHtml,
  chatAiMsgHtml,
  chatThinkingHtml,
  chatCitesPanelHtml,
  chatQuestionsHtml,
  sbSourceColor,
  sbBookColor,
  computeStats,
  escapeHtml,
} from './render';
import {
  motionChatIn,
  motionChatOut,
  motionMsgIn,
  motionSearchWave,
  motionChatClear,
  motionTeardown,
} from './motion';
import type { SearchHit, VectorStore } from './vector-store';
import { bookHitToSearchHit, searchSharedBooks } from './reader-books';

/** 欢迎语（首次进入 / 清空后共用一份文案） */
function welcomeText(topK: number): string {
  return `你好！每次提问会独立检索 ${topK} 条笔记辅助回答。`;
}

/** 回答末尾的建议追问分隔标记（同一次 AI 调用返回，避免二次请求） */
const CHAT_SUGGEST_MARK = '【建议追问】';

function splitChatAnswer(text: string): { body: string; suggestions: string } {
  const i = text.indexOf(CHAT_SUGGEST_MARK);
  if (i < 0) return { body: text, suggestions: '' };
  return { body: text.slice(0, i).trimEnd(), suggestions: text.slice(i + CHAT_SUGGEST_MARK.length) };
}

function parseSuggestions(text: string): string[] {
  if (!text) return [];
  const list = text
    .split(/\r?\n/)
    .map((s) => s.replace(/^[\s\-*·\d.、)）]+/, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 30);
  return Array.from(new Set(list)).slice(0, 6);
}

type CiteRow = { path: string; pct: number; color: string; bookId?: string; label?: string; source?: string; snippet?: string };

export class ChatPanel {
  store: VectorStore;
  messagesDiv: HTMLElement;
  questionsDiv: HTMLElement;
  citesDiv: HTMLElement;
  chipsEl: HTMLElement;
  input: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  history: { role: 'user' | 'assistant'; content: string }[] = [];
  mask: HTMLDivElement;
  popup: HTMLDivElement;
  private app: App;
  private escHandle: ReturnType<typeof escManager.register> | null = null;
  /** 进行中的对话请求：非空时发送钮呈「停止」态，点击中止 */
  private inFlight: AbortController | null = null;
  /** 轮次序号：清空对话 / 销毁后，旧轮的回调不再写 UI 与历史 */
  private seq = 0;
  /** 动效层：开/关代次——退场期间被重开时，迟到的退场收口不得收回新显示位 */
  private motionSeq = 0;
  /** 消息自增 id（左栏提问索引跳转用） */
  private msgSeq = 0;
  /** 每个问题对应的依据条数（左栏小字） */
  private questionCites = new Map<number, number>();
  /** 每轮回答结束后由 AI 生成的一组建议追问（默认空） */
  private suggestions: string[] = [];

  constructor(store: VectorStore, app: App, private readonly onBack?: () => void) {
    this.app = app;
    this.store = store;

    const CONFIG = buildConfig();
    // 与主面板同尺寸的居中弹窗：遮罩 + 点遮罩关闭
    this.mask = document.createElement('div');
    this.mask.className = 'bz-sb-ws-mask';
    this.mask.id = 'bz-sb-chat-mask';
    bindMaskDismiss(this.mask, () => this.close());
    this.popup = document.createElement('div');
    this.popup.className = 'bz-sb-chat-modal bz-sb-ws';
    this.popup.id = 'bz-sb-chat-panel';
    this.popup.style.display = 'none';
    this.popup.innerHTML = chatShellHtml();
    mountIcons(this.popup);

    this.messagesDiv = this.popup.querySelector('#bz-sb-chat-messages') as HTMLElement;
    this.questionsDiv = this.popup.querySelector('#bz-sb-ws-questions') as HTMLElement;
    this.citesDiv = this.popup.querySelector('#bz-sb-ws-cites') as HTMLElement;
    this.chipsEl = this.popup.querySelector('#bz-sb-chat-chips') as HTMLElement;
    this.input = this.popup.querySelector('#bz-sb-chat-input') as HTMLTextAreaElement;
    this.sendBtn = this.popup.querySelector('#bz-sb-chat-send') as HTMLButtonElement;
    this.clearBtn = this.popup.querySelector('#bz-sb-chat-clear') as HTMLButtonElement;

    // 顶栏：返回第二大脑 / 灵感参考
    const backToHub = () => {
      this.close();
      this.onBack?.();
    };
    this.popup.querySelector('#bz-sb-ws-back')?.addEventListener('click', backToHub);
    this.popup.querySelector('#bz-sb-ws-ref')?.addEventListener('click', () => {
      this.close();
      (this.app as any).commands?.executeCommandById?.('bz-secondbrain-open');
    });
    this.clearBtn.addEventListener('click', () => void this.confirmClear());

    this.sendBtn.addEventListener('click', () => {
      if (this.inFlight) {
        this.inFlight.abort(); // 「停止」态：中止当前请求
        return;
      }
      void this.sendChatMessage();
    });
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      // 中文输入法组合态（composition）回车是选字确认，不发送
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.sendChatMessage();
      }
      // Shift+Enter 换行：走 textarea 默认行为，不拦截
    });
    this.input.addEventListener('input', () => this.autoGrowInput());

    // 推荐问法：点击即问
    this.popup.querySelector('#bz-sb-chat-chips')?.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest('.bz-sb-chat-chip') as HTMLElement | null;
      if (!chip || this.inFlight) return;
      this.input.value = chip.dataset.q || '';
      void this.sendChatMessage();
    });

    // 左栏：点提问滚到对应消息；「下一步」把建议填进输入框
    this.questionsDiv.addEventListener('click', (e) => {
      const follow = (e.target as HTMLElement).closest('[data-follow]') as HTMLElement | null;
      if (follow) {
        this.input.value = follow.dataset.follow || '';
        this.input.focus();
        return;
      }
      const btn = (e.target as HTMLElement).closest('[data-msg]') as HTMLElement | null;
      if (!btn) return;
      const target = this.messagesDiv.querySelector(`[data-msg="${btn.dataset.msg}"]`) as HTMLElement | null;
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.classList.add('bz-sb-chat-msg--hit');
      setTimeout(() => target.classList.remove('bz-sb-chat-msg--hit'), 900);
    });

    // 右栏：引用卡点击 = 高亮正文标号 + 打开对应笔记 / 书
    this.popup.addEventListener('click', (e) => {
      const inline = (e.target as HTMLElement).closest('.bz-sb-cite') as HTMLElement | null;
      if (inline) {
        this.highlightCite(Number(inline.dataset.n));
        return;
      }
      const cite = (e.target as HTMLElement).closest('.bz-sb-chat-cite') as HTMLElement | null;
      if (!cite) return;
      this.highlightCite(Number(cite.dataset.n));
      const path = cite.dataset.path;
      const bookId = cite.dataset.book;
      if (bookId) {
        openReaderJump(this.app, bookId);
        return;
      }
      const f = path ? this.app.vault.getAbstractFileByPath(path) : null;
      if (f) void this.app.workspace.getLeaf(false).openFile(f as TFile);
      else if (path) this.appendAiNote('文件不存在或已被移动');
    });

    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);

    // ESC 关闭走 escManager 层级
    this.escHandle = escManager.register('bz-sb-chat-ws', {
      isVisible: () => this.popup.style.display === 'flex' && !!this.popup.isConnected,
      close: () => this.close(),
    });

    this.addChatMessage('assistant', welcomeText(CONFIG.CHAT_TOP_K));
    this.renderQuestions();
    this.renderCites([]);
    void this.loadModelBadge();
    // 默认空会话：打开只显示欢迎语；历史仍写盘（chatHistory 段），不自动读回
  }

  /** 顶栏模型徽标：按当前 AI 设置解析真实 provider/模型，未配置就照实说未配置 */
  private async loadModelBadge(): Promise<void> {
    const el = this.popup.querySelector('#bz-sb-ws-model') as HTMLElement | null;
    if (!el) return;
    try {
      const provider = await getAIProvider();
      if (!this.alive) return;
      const label = getProviderDescriptor(provider.id).label;
      el.classList.remove('is-off');
      el.innerHTML = `<i></i>${escapeHtml(label)}${provider.model ? ` · ${escapeHtml(provider.model)}` : ''}`;
    } catch {
      if (!this.alive) return;
      el.classList.add('is-off');
      el.innerHTML = `<i></i>未配置 AI`;
      el.title = '主设置 → AI 配置：填好密钥与模型后，问答才能用';
    }
  }

  get alive(): boolean {
    return !!this.popup.isConnected;
  }

  /** 显示工作区并聚焦输入框 */
  show(): void {
    if (!this.alive) return;
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    topifyZ(this.mask, this.popup);
    this.motionSeq++; // 新代次：在途退场收口作废
    motionChatIn(this.popup);
    this.input.focus();
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
  }

  close(): void {
    // 先演退场再收 display（收口 cancel 钉帧，防「关→再开」整屏隐形）
    const seq = this.motionSeq;
    motionChatOut(this.popup, () => {
      if (seq !== this.motionSeq) return;
      this.mask.style.display = 'none';
      this.popup.style.display = 'none';
    });
  }

  /** 完全销毁（unload 调用）：摘 ESC 层、中止在途请求并移除 DOM */
  destroy(): void {
    this.seq++;
    this.inFlight?.abort();
    this.inFlight = null;
    this.escHandle?.unregister();
    this.escHandle = null;
    motionTeardown();
    this.mask.remove();
    this.popup.remove();
  }

  /** 历史仅 UI 展示用；裁剪 MAX_HISTORY×2 条，不进 prompt */
  addChatMessage(role: 'user' | 'assistant', content: string, hits?: SearchHit[]): HTMLElement {
    const div = document.createElement('div');
    div.className = `bz-sb-chat-msg ${role}`;
    div.dataset.msg = String(++this.msgSeq);
    let bubble: HTMLElement | null = null;
    let rendered: Promise<void> | null = null;
    if (role === 'assistant') {
      div.innerHTML = chatAiMsgHtml();
      bubble = div.querySelector('.bz-sb-chat-bubble') as HTMLElement;
      rendered = renderMarkdown(bubble, content, this.app); // 失败时内部回退 textContent
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
    if (role === 'user') this.renderQuestions();
    if (hits) {
      const rows = this.citeRows(hits);
      this.renderCites(rows);
      const uid = this.lastUserId();
      if (uid != null) this.questionCites.set(uid, rows.length);
      this.renderQuestions();
      // markdown 渲染是异步的：等这一段落定后再把 [1] 这样的标号物化成可点角标
      // （固定延时赌时机在长回答/慢机器上会漏——角标不出现、点不动）
      if (bubble) {
        const root = bubble;
        void (rendered ?? Promise.resolve()).then(() => {
          if (root.isConnected) this.decorateCites(root, rows.length);
        });
      }
    }
    this.renderChips();
    return div;
  }

  private lastUserId(): number | null {
    const nodes = this.messagesDiv.querySelectorAll('.bz-sb-chat-msg.user');
    const last = nodes[nodes.length - 1] as HTMLElement | undefined;
    return last ? Number(last.dataset.msg) : null;
  }

  /** 把回答正文里的 [n] 物化成角标（只对存在的依据编号生效） */
  private decorateCites(root: HTMLElement, max: number): void {
    if (!root || max <= 0) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const text = node.nodeValue || '';
      if (!/\[\d+\]/.test(text)) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(/\[(\d+)\]/g, (m, n, idx) => {
        const num = Number(n);
        if (num < 1 || num > max) return m;
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const span = document.createElement('span');
        span.className = 'bz-sb-cite';
        span.dataset.n = String(num);
        span.textContent = String(num);
        frag.appendChild(span);
        last = idx + m.length;
        return m;
      });
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  }

  /** 角标/依据卡联动：两边同编号同时高亮 */
  private highlightCite(n: number): void {
    if (!Number.isFinite(n)) return;
    this.citesDiv.querySelectorAll('.bz-sb-chat-cite').forEach((x) =>
      x.classList.toggle('is-on', Number((x as HTMLElement).dataset.n) === n)
    );
    this.messagesDiv.querySelectorAll('.bz-sb-cite').forEach((x) =>
      x.classList.toggle('is-on', Number((x as HTMLElement).dataset.n) === n)
    );
    const target = this.citesDiv.querySelector(`[data-n="${n}"]`) as HTMLElement | null;
    target?.scrollIntoView?.({ block: 'nearest' });
  }

  /** 左栏提问索引（从消息 DOM 取，保证与渲染一致） */
  private renderQuestions(): void {
    const nodes = Array.from(this.messagesDiv.querySelectorAll('.bz-sb-chat-msg.user')) as HTMLElement[];
    const items = nodes.map((n) => {
      const count = this.questionCites.get(Number(n.dataset.msg));
      return {
        id: Number(n.dataset.msg),
        text: (n.querySelector('.bz-sb-chat-bubble')?.textContent || '').trim(),
        active: n === nodes[nodes.length - 1],
        meta: count != null ? `${count} 条依据` : undefined,
      };
    });
    this.questionsDiv.innerHTML = chatQuestionsHtml(items);
    mountIcons(this.questionsDiv);
  }

  /** 右栏本次依据（只渲染，不另存一份——重渲染后以 DOM 为准） */
  private renderCites(rows: CiteRow[]): void {
    this.citesDiv.innerHTML = chatCitesPanelHtml(rows);
    this.citesDiv.scrollTop = 0;
  }

  /** 推荐问法：默认不显示；每轮回答结束后由 AI 生成 */
  private renderChips(): void {
    if (!this.suggestions.length) {
      this.chipsEl.hidden = true;
      this.chipsEl.style.display = 'none';
      this.chipsEl.innerHTML = '';
      return;
    }
    this.chipsEl.hidden = false;
    this.chipsEl.style.display = 'flex';
    this.chipsEl.innerHTML = this.suggestions
      .map((q) => `<button class="bz-sb-chat-chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`)
      .join('');
  }

  /**
   * 引用卡行（来源色点按来源分布序取色板）。
   *
   * 笔记与书分席：笔记取前 5 条、书取前 3 条——书是「补充依据」，该有自己的位置。
   */
  private citeRows(hits: SearchHit[]): CiteRow[] {
    let order = new Map<string, number>();
    try {
      order = new Map(computeStats(this.store.meta).bySource.map((s, i) => [s.name, i]));
    } catch {
      order = new Map();
    }
    const notes = hits.filter((h) => !h.bookId).slice(0, 5);
    const books = hits.filter((h) => !!h.bookId).slice(0, 3);
    return [...notes, ...books].map((h) => ({
      path: h.path,
      pct: Math.round(h.score * 100),
      color: h.bookId ? sbBookColor(h.bookId) : sbSourceColor(h.path.split('/')[0] || '（根目录）', order),
      bookId: h.bookId,
      label: h.label,
      source: h.bookId ? '书籍' : h.path.split('/')[0] || '（根目录）',
      snippet: h.chunk.replace(/\s+/g, ' ').trim().slice(0, 90),
    }));
  }

  /** 轻量 assistant 提示（不进历史；用于错误/停止等补充说明） */
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

  async sendChatMessage(): Promise<void> {
    if (this.inFlight) return; // 请求进行中：发送钮当前是「停止」，Enter 不触发新一轮
    const userMsg = this.input.value.trim();
    if (!userMsg) return;
    this.input.value = '';
    this.autoGrowInput();
    this.suggestions = [];
    this.renderChips();
    const userEl = this.addChatMessage('user', userMsg);
    motionMsgIn(userEl);
    this.persistHistory([{ role: 'user', content: userMsg }]);

    const CONFIG = buildConfig();
    const controller = new AbortController();
    const seq = ++this.seq;
    this.inFlight = controller;
    this.sendBtn.disabled = false;
    this.sendBtn.setAttribute('data-state', 'stop');
    this.sendBtn.title = '停止';

    // 检索中态：呼吸点占位 → 检索完成转流式输出
    const live = document.createElement('div');
    live.className = 'bz-sb-chat-msg assistant';
    live.innerHTML = chatAiMsgHtml();
    (live.querySelector('.bz-sb-chat-bubble') as HTMLElement).innerHTML = chatThinkingHtml(CONFIG.CHAT_TOP_K);
    this.messagesDiv.appendChild(live);
    motionMsgIn(live);
    motionSearchWave(this.messagesDiv);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    let acc = '';
    try {
      const noteHits: SearchHit[] = await this.store.search(userMsg, CONFIG.CHAT_TOP_K);
      /* 共享打开时，书里检索到的块作为补充依据并进同一份上下文 */
      const bookHits: SearchHit[] = (
        await searchSharedBooks(this.app, userMsg, 3, { signal: controller.signal })
      ).map(bookHitToSearchHit);
      const results: SearchHit[] = [...noteHits, ...bookHits];
      if (seq !== this.seq) return;
      const context =
        results.length > 0
          ? results.map((r) => `[${r.path}] (${Math.round(r.score * 100)}%)\n${r.chunk}`).join('\n\n')
          : '（未找到相关笔记）';
      // QA L1718 提示词 + 引用标号约定（正文 [n] 与右栏依据联动）
      const fullPrompt = `你是知识助手。参考笔记库中 ${results.length} 条检索结果回答问题。不相关可忽略。引用某条参考内容时，在句末用 [1]、[2] 这样的标号标注来源编号（编号对应参考内容顺序）；没有引用的句子不要标。回答正文结束后，另起一行输出「${CHAT_SUGGEST_MARK}」，再逐行给出 4 个用户可能继续追问的短问题；每条不超过 14 个汉字，不要编号、不要解释。\n\n【参考内容】\n${context}\n\n【问题】\n${userMsg}`;
      const answer = await AI.ask(fullPrompt, {
        signal: controller.signal,
        onDelta: (delta) => {
          acc += delta;
          const bubble = live.querySelector('.bz-sb-chat-bubble');
          if (bubble) bubble.textContent = splitChatAnswer(acc).body;
          this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
        },
      });
      live.remove();
      if (seq === this.seq) {
        const { body, suggestions } = splitChatAnswer(answer);
        const finalMsg = this.addChatMessage('assistant', body || answer, results);
        motionMsgIn(finalMsg);
        this.persistHistory([{ role: 'assistant', content: body || answer }]);
        this.suggestions = parseSuggestions(suggestions);
        this.renderChips();
      }
    } catch (e: any) {
      live.remove();
      if (seq !== this.seq) return;
      const note = controller.signal.aborted
        ? this.addChatMessage('assistant', '已停止生成。')
        : this.addChatMessage('assistant', '出错了：' + (e?.message || e));
      motionMsgIn(note);
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

  /** 「清空对话」：flow 确认 → 中止在途请求 → 清内存与 UI → 写盘空段 */
  private async confirmClear(): Promise<void> {
    const v = await openFlowDialog({
      title: '清空对话',
      message: '将清空全部对话历史并写盘，确定继续吗？',
      className: 'bz-sb-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '清空', value: 'ok', cta: true, danger: true },
      ],
    });
    if (v !== 'ok') return;
    this.seq++;
    this.inFlight?.abort();
    this.inFlight = null;
    this.sendBtn.disabled = false;
    this.sendBtn.removeAttribute('data-state');
    this.sendBtn.title = '发送';
    this.history = [];
    this.questionCites.clear();
    this.suggestions = [];
    this.renderChips();
    motionChatClear(this.messagesDiv, () => {
      const w = this.addChatMessage('assistant', welcomeText(buildConfig().CHAT_TOP_K));
      motionMsgIn(w);
      this.renderQuestions();
      this.renderCites([]);
    });
    try {
      await clearChatHistory(this.app);
    } catch (e) {
      console.warn('[secondbrain] 对话历史清空写盘失败', e);
    }
  }
}

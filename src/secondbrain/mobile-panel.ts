/**
 * 第二大脑移动端底部抽屉（ticket 103；对齐 QA 闪念.js L1737-2186）
 * 补齐交互点：
 * - 📚参考 / 🤖AI 双 tab pill + 中央拖拽条（L1898-1916/L1981-1990）
 * - topbar 触摸拖拽调高，松手吸附 45vh/75vh；<18vh 收起为底部 mini 胶囊，
 *   点胶囊回 45vh 展开（L1891/L1952-1977/L1931-1949）
 * - ESC 走 escManager 注册层级（收起态不拦截）（L1950）
 * - selectionchange 监听（50ms 延迟）+ 光标轮询 CURSOR_POLL_INTERVAL +
 *   active-leaf-change，防抖 DEBOUNCE_DELAY 后独立检索（L1995-1999/L2016-2031）
 * - 参考卡：过滤当前文件、单击懒渲染 markdown 展开（L2076-2085）；
 *   长按 500ms 震动 navigator.vibrate(30) → jumpToChunk → 收起抽屉（L2086-2099）
 * - AI tab：DeepSeek 开关、Enter 发送、markdown 渲染回退纯文本；
 *   提示词与桌面同构但「【参考内容】」简写「【参考】」（L2135-2161）
 * - store.initMobile() 三级检索初始化（L1928-1929）
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { notice } from '../core/notice';
import { buildConfig } from './config';
import { getCurrentContext } from './context';
import { jumpToChunk, renderMarkdown } from './ui-tools';
import { AI } from './ai';
import type { SearchHit, VectorStore } from './vector-store';

const SNAP_MID = 45;
const SNAP_HIGH = 75;
const COLLAPSE_THRESHOLD = 18;

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export class MobilePanel {
  store: VectorStore;
  sheet: HTMLElement;
  mini: HTMLElement;
  body: HTMLElement;
  app: App;
  mode: 'ref' | 'chat' = 'ref';
  collapsed = false;
  chatHistory: ChatHistoryItem[] = [];
  refResults: SearchHit[] = [];

  private pillRef: HTMLElement;
  private pillChat: HTMLElement;
  private chatMessagesDiv: HTMLElement | null = null;
  private cursorPoll: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private evLeaf: any = null;
  private escHandle: ReturnType<typeof escManager.register> | null = null;
  private lastCursor: string | null = null;
  private lastQuery = '';
  private onSelectionChange: () => void;
  private onTouchMove: (e: TouchEvent) => void;
  private onTouchEnd: () => void;

  constructor(app: App, store: VectorStore) {
    this.app = app;
    this.store = store;

    const CONFIG = buildConfig();

    // ── DOM 骨架 ──
    this.sheet = document.createElement('div');
    this.sheet.className = 'bz-sb-mb-sheet';

    const topbar = document.createElement('div');
    topbar.className = 'bz-sb-mb-topbar';

    this.pillRef = document.createElement('button');
    this.pillRef.className = 'bz-sb-mb-pill active';
    this.pillRef.textContent = '📚';
    this.pillRef.title = '参考';
    this.pillChat = document.createElement('button');
    this.pillChat.className = 'bz-sb-mb-pill';
    this.pillChat.textContent = '🤖';
    this.pillChat.title = 'AI';

    const dragStrip = document.createElement('div');
    dragStrip.className = 'bz-sb-mb-drag-strip';
    const dragDot = document.createElement('div');
    dragDot.className = 'bz-sb-mb-drag-dot';
    dragStrip.appendChild(dragDot);

    topbar.appendChild(this.pillRef);
    topbar.appendChild(dragStrip);
    topbar.appendChild(this.pillChat);
    this.sheet.appendChild(topbar);

    this.body = document.createElement('div');
    this.body.className = 'bz-sb-mb-body bz-sb-scroll-y';
    this.sheet.appendChild(this.body);

    // 收起态底部 mini 胶囊
    this.mini = document.createElement('div');
    this.mini.className = 'bz-sb-mb-mini';
    const miniDot = document.createElement('span');
    miniDot.className = 'bz-sb-mb-mini-dot';
    const miniLabel = document.createElement('span');
    miniLabel.className = 'bz-sb-mb-mini-label';
    miniLabel.textContent = '参考';
    this.mini.appendChild(miniDot);
    this.mini.appendChild(miniLabel);

    document.body.appendChild(this.sheet);
    document.body.appendChild(this.mini);

    this.pillRef.addEventListener('click', () => this.switchTab('ref'));
    this.pillChat.addEventListener('click', () => this.switchTab('chat'));
    this.mini.addEventListener('click', () => this.expand());

    // ── 移动端三级检索初始化（remote→tfidf→text）──
    void store.initMobile().catch((e) => console.warn('[secondbrain] initMobile 失败', e));

    // ── ESC 层级（收起态不拦截，交给下层）──
    this.escHandle = escManager.register('bz-sb-mb-sheet', {
      isVisible: () => !this.collapsed && !!this.sheet.isConnected,
      close: () => this.collapse(),
    });

    // ── 拖拽调高手势（topbar 触发，document 跟手，QA L1952-1979）──
    let dragging = false;
    let dragStartY = 0;
    let dragStartH = 0;
    topbar.addEventListener(
      'touchstart',
      (e) => {
        if (this.collapsed) return;
        dragging = true;
        dragStartY = e.touches[0].clientY;
        dragStartH = this.sheet.getBoundingClientRect().height;
        this.sheet.classList.add('bz-sb-mb-dragging');
      },
      { passive: true }
    );
    this.onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dy = dragStartY - e.touches[0].clientY;
      const vh = window.innerHeight;
      const pct = Math.max(6, Math.min(88, (dragStartH + dy) / vh * 100));
      this.sheet.style.height = pct + 'vh'; // 动态几何内联
    };
    this.onTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      this.sheet.classList.remove('bz-sb-mb-dragging');
      const pct = (this.sheet.getBoundingClientRect().height / window.innerHeight) * 100;
      if (pct < COLLAPSE_THRESHOLD) {
        this.collapse();
        return;
      }
      const closest = Math.abs(SNAP_MID - pct) <= Math.abs(SNAP_HIGH - pct) ? SNAP_MID : SNAP_HIGH;
      this.sheet.style.height = closest + 'vh';
    };
    document.addEventListener('touchmove', this.onTouchMove, { passive: true });
    document.addEventListener('touchend', this.onTouchEnd);

    // ── 自动刷新：光标轮询 + 选区变化 + 活动叶子切换（QA L1995-1999）──
    this.cursorPoll = setInterval(() => this.checkCursor(), CONFIG.CURSOR_POLL_INTERVAL);
    try {
      this.evLeaf = app.workspace.on('active-leaf-change', () => this.checkCursor());
    } catch {
      /* 最小 mock / 异常环境下跳过订阅 */
    }
    this.onSelectionChange = () => {
      setTimeout(() => this.checkCursor(), 50);
    };
    document.addEventListener('selectionchange', this.onSelectionChange);

    this.renderBody();
    requestAnimationFrame(() => this.expand());

    // 初始上下文检索
    const initEd = app.workspace.activeEditor?.editor;
    if (initEd) {
      const q = getCurrentContext(initEd);
      if (q.length >= 2) {
        this.lastQuery = q;
        const c = initEd.getCursor();
        this.lastCursor = `${c.line}:${c.ch}`;
        void this.refreshResults(q);
      }
    }
  }

  get alive(): boolean {
    return !!this.sheet.isConnected;
  }

  /** 展开抽屉（expand 的对外别名，与 FloatWindow.show 语义对齐，index 接线使用） */
  show(): void {
    this.expand();
  }

  /** 展开（45vh），隐藏 mini */
  expand(): void {
    this.collapsed = false;
    this.sheet.classList.remove('bz-sb-mb-dragging');
    this.sheet.style.height = SNAP_MID + 'vh';
    this.sheet.classList.add('bz-sb-mb-open');
    this.mini.classList.remove('bz-sb-mb-visible');
  }

  /** 收起为底部 mini 胶囊 */
  collapse(): void {
    this.collapsed = true;
    this.sheet.classList.remove('bz-sb-mb-open');
    this.sheet.classList.remove('bz-sb-mb-dragging');
    this.mini.classList.add('bz-sb-mb-visible');
  }

  private updateMiniLabel(): void {
    const label = this.mini.querySelector('.bz-sb-mb-mini-label');
    if (label) label.textContent = this.mode === 'ref' ? '参考' : 'AI';
  }

  switchTab(tab: 'ref' | 'chat'): void {
    this.mode = tab;
    this.pillRef.classList.toggle('active', tab === 'ref');
    this.pillChat.classList.toggle('active', tab === 'chat');
    this.updateMiniLabel();
    this.renderBody();
  }

  /** 光标变化 → 防抖 → 上下文变化才重新检索（QA L2016-2031） */
  checkCursor(): void {
    const ed = this.app.workspace.activeEditor?.editor;
    if (!ed) return;
    const c = ed.getCursor();
    const k = `${c.line}:${c.ch}`;
    if (this.lastCursor === k) return;
    this.lastCursor = k;
    clearTimeout(this.debounceTimer ?? undefined);
    this.debounceTimer = setTimeout(() => {
      void (async () => {
        const q = getCurrentContext(ed);
        if (q === this.lastQuery) return;
        this.lastQuery = q;
        await this.refreshResults(q);
      })();
    }, buildConfig().DEBOUNCE_DELAY);
  }

  async refreshResults(query: string): Promise<void> {
    const CONFIG = buildConfig();
    if (!query || query.length < 2) {
      this.refResults = [];
      if (this.mode === 'ref') this.renderRefTab();
      return;
    }
    try {
      this.refResults = await this.store.searchMobile(query, CONFIG.TOP_K);
    } catch (e) {
      console.warn('[secondbrain] 移动端检索失败', e);
      this.refResults = [];
    }
    if (this.mode === 'ref') this.renderRefTab();
  }

  renderBody(): void {
    this.body.innerHTML = '';
    if (this.mode === 'ref') this.renderRefTab();
    else this.renderChatTab();
  }

  /** 参考 tab：过滤当前文件 + 单击懒渲染展开 + 长按震动跳转并收起（QA L2050-2100） */
  renderRefTab(): void {
    this.body.innerHTML = '';
    const currentPath = this.app.workspace.getActiveFile()?.path || '';
    const filtered = this.refResults.filter((r) => r.path !== currentPath);
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'bz-sb-mb-empty';
      empty.textContent = '暂无相关笔记';
      this.body.appendChild(empty);
      return;
    }
    for (const item of filtered) {
      const card = document.createElement('div');
      card.className = 'bz-sb-mb-card';

      const topRow = document.createElement('div');
      topRow.className = 'bz-sb-mb-card-top';
      const pathDiv = document.createElement('div');
      pathDiv.className = 'bz-sb-mb-card-path';
      pathDiv.textContent = item.path.replace(/^.*[\\/]/, '').replace(/\.md$/i, '');
      const scoreDiv = document.createElement('div');
      scoreDiv.className = 'bz-sb-mb-card-score';
      scoreDiv.textContent = `${Math.round(item.score * 100)}%`;
      topRow.appendChild(pathDiv);
      topRow.appendChild(scoreDiv);
      card.appendChild(topRow);

      // 正文懒渲染：首次展开才渲染 markdown
      const chunkDiv = document.createElement('div');
      chunkDiv.className = 'bz-sb-mb-card-chunk';
      card.appendChild(chunkDiv);
      this.body.appendChild(card);

      let expanded = false;
      let rendered = false;
      card.addEventListener('click', () => {
        expanded = !expanded;
        if (expanded && !rendered) {
          chunkDiv.innerHTML = '';
          renderMarkdown(chunkDiv, item.chunk, this.app);
          rendered = true;
        }
        chunkDiv.classList.toggle('expanded', expanded);
      });

      // 长按 500ms 震动跳转并收起抽屉
      let holdTimer: ReturnType<typeof setTimeout> | null = null;
      card.addEventListener(
        'touchstart',
        () => {
          holdTimer = setTimeout(() => {
            holdTimer = null;
            if (navigator.vibrate) navigator.vibrate(30);
            const file = this.app.vault.getAbstractFileByPath(item.path);
            if (!file) {
              notice('文件不存在');
              return;
            }
            jumpToChunk(file, item.chunk.slice(0, 30).trim(), false);
            this.collapse();
          }, 500);
        },
        { passive: true }
      );
      card.addEventListener('touchend', () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
      });
      card.addEventListener('touchmove', () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
      });
    }
  }

  /** AI tab：重建 DOM 并重放历史；空历史显示欢迎语（QA L2103-2162） */
  renderChatTab(): void {
    const CONFIG = buildConfig();
    const chat = document.createElement('div');
    chat.className = 'bz-sb-mb-chat';

    this.chatMessagesDiv = document.createElement('div');
    this.chatMessagesDiv.className = 'bz-sb-mb-chat-messages bz-sb-scroll-y';
    chat.appendChild(this.chatMessagesDiv);

    const toggleRow = document.createElement('label');
    toggleRow.className = 'bz-sb-mb-chat-toggle';
    const toggleCheck = document.createElement('input');
    toggleCheck.type = 'checkbox';
    toggleCheck.checked = CONFIG.DEFAULT_USE_DEEPSEEK;
    toggleRow.appendChild(toggleCheck);
    toggleRow.appendChild(document.createTextNode('DeepSeek'));
    chat.appendChild(toggleRow);

    const inputArea = document.createElement('div');
    inputArea.className = 'bz-sb-mb-chat-input-area';
    const input = document.createElement('input');
    input.className = 'bz-sb-mb-chat-input';
    input.type = 'text';
    input.placeholder = '检索笔记后回答...';
    const sendBtn = document.createElement('button');
    sendBtn.className = 'bz-sb-mb-chat-send';
    sendBtn.textContent = '发送';
    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    chat.appendChild(inputArea);
    this.body.appendChild(chat);

    for (const msg of this.chatHistory) this.appendChatMsg(msg.role, msg.content);
    if (!this.chatHistory.length) {
      this.appendChatMsg('assistant', `已加载 ${Object.keys(this.store.notes).length} 篇笔记`);
    }

    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.appendChatMsg('user', text);
      this.chatHistory.push({ role: 'user', content: text });
      sendBtn.disabled = true;
      sendBtn.textContent = '···';
      try {
        const results = await this.store.searchMobile(text, CONFIG.CHAT_TOP_K);
        const ctx =
          results.length > 0
            ? results.map((r) => `[${r.path}] (${Math.round(r.score * 100)}%)\n${r.chunk}`).join('\n\n')
            : '（未找到相关笔记）';
        // 移动端提示词：与桌面同构，「【参考内容】」简写「【参考】」（QA L2149）
        const prompt = `你是知识助手。参考 ${results.length} 条检索结果回答。不相关可忽略。\n\n【参考】\n${ctx}\n\n【问题】\n${text}`;
        const answer = await AI.ask(prompt, toggleCheck.checked);
        this.appendChatMsg('assistant', answer);
        this.chatHistory.push({ role: 'assistant', content: answer });
        if (this.chatHistory.length > CONFIG.MAX_HISTORY * 2) {
          this.chatHistory = this.chatHistory.slice(-CONFIG.MAX_HISTORY * 2);
        }
      } catch (e: any) {
        this.appendChatMsg('assistant', '出错了：' + (e?.message || e));
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
      }
    };
    sendBtn.addEventListener('click', () => void send());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void send();
    });
  }

  appendChatMsg(role: 'user' | 'assistant', content: string): void {
    if (!this.chatMessagesDiv) return;
    const div = document.createElement('div');
    div.className = `bz-sb-mb-chat-msg ${role}`;
    if (role === 'assistant') {
      renderMarkdown(div, content, this.app); // 失败时内部回退 textContent
    } else {
      div.textContent = content;
    }
    this.chatMessagesDiv.appendChild(div);
    this.chatMessagesDiv.scrollTop = this.chatMessagesDiv.scrollHeight;
  }

  /** 完全关闭（区别于收起）：清理监听与定时器后移除 DOM */
  close(): void {
    this.escHandle?.unregister();
    this.escHandle = null;
    if (this.evLeaf) {
      try {
        this.app.workspace.offref(this.evLeaf);
      } catch {
        /* 环境无 offref 能力时忽略 */
      }
    }
    document.removeEventListener('selectionchange', this.onSelectionChange);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    clearInterval(this.cursorPoll ?? undefined);
    clearTimeout(this.debounceTimer ?? undefined);
    this.cursorPoll = null;
    this.debounceTimer = null;
    this.sheet.classList.remove('bz-sb-mb-open');
    this.mini.classList.remove('bz-sb-mb-visible');
    setTimeout(() => {
      this.sheet.remove();
      this.mini.remove();
    }, 300);
  }
}

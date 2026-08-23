/**
 * 交互管理器（移植自 SmartCat.js InteractionManager）
 * 点触：单击=宠物消息、双击=聊天、三击=语音（桌面提示禁用）、五击=设置、长按=设置；
 * 拖拽（鼠标/触屏）；陪伴定时器（自言自语）；聊天（多轮+上下文）；书评消息。
 * 全部命令/面板操作经回调注入（index 组装，避免模块间循环依赖）。
 */
import { eventSystem, startThinking, stopThinking, stopAllThinking } from './state';
import { EVENTS } from './types';
import { getSmartCatMessage } from './messages';
import { generatePrompt } from './prompts';
import { callChat, isAIConfigured } from './api';
import { buildRetrieveQuery } from './memory';
import { buildCompanionContext } from './companion-context';
import { hasBookTag, getCursorContext, getViewportContent, getCurrentNoteContext, getVisibleContent } from './content';
import { CAT_CONTAINER_ID } from './ui';
import type { BubbleManager } from './bubble';
import type { MoodSystem } from './mood';
import type { SmartCatConfig } from './types';

export interface InteractionDeps {
  config: () => SmartCatConfig;
  saveConfig: (c: SmartCatConfig) => Promise<SmartCatDataLike>;
  bubble: BubbleManager;
  mood: MoodSystem;
  openChat: () => void;
  closeChat: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  onAppearanceChanged: (appearance: string) => void;
  /** 记忆流检索（ADR-0021：聊天上下文注入相关记忆；index 注入，避免顶层互访）
   *  ADR-0025：第二参 lexicalQuery 供词法降级模式使用（纯用户消息，避免「情绪/时段」噪音） */
  retrieveMemories?: (query: string, lexicalQuery?: string) => Promise<string>;
  /** 性格数据（ADR-0023：prompt 状态向量用；index 注入 data.personalityGrowth） */
  characterData?: () => any;
  /** 互动回流（ADR-0023：每种互动触发性格微移；index 接 PersonalityGrowth.developBasedOnInteraction） */
  onInteraction?: (type: string, intensity?: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SmartCatDataLike = any;

export class InteractionManager {
  private deps: InteractionDeps;
  isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLeft = 0;
  private initialTop = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  companionInterval: ReturnType<typeof setInterval> | null = null;
  isSettingsOpen = false;
  isChatOpen = false;
  private tapCount = 0;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private tapStartX = 0;
  private tapStartY = 0;
  private tapThreshold = 5;
  private generateAutoCompanionMessageLock = false;
  /** 鼠标当前是否按住（handleMouseMove 守卫：松开后即使监听残留也不再跟随） */
  private isMousePressed = false;
  /**
   * document 级拖拽监听的稳定引用。此前在 add/remove 处各写一次 `.bind(this)`，
   * 两次 bind 生成不同函数，removeEventListener 永远匹配不上——松开鼠标后
   * mousemove 监听残留，小橘会一直跟着光标走（桌面端拖拽后跟随 bug 根因）。
   */
  private boundMouseMove = this.handleMouseMove.bind(this);
  private boundMouseUp = this.handleMouseUp.bind(this);

  constructor(deps: InteractionDeps) {
    this.deps = deps;
  }

  /** 懂你上下文块（ADR-0025）：作息/情绪趋势/关系/相关记忆统一注入各 AI 通道 */
  private getCompanionContext(memoriesText = ''): string {
    const d = this.deps.characterData?.() ?? null;
    return buildCompanionContext({
      stream: d?.memory?.stream ?? [],
      relationship: d?.personalityGrowth?.relationship ?? null,
      emotion: d?.mood?.currentEmotion ?? null,
      memoriesText,
    });
  }

  /** 检索相关记忆（词法降级用 query——失败返回空串，不阻断主流程） */
  private async retrieveCompanionMemories(query: string, lexicalQuery?: string): Promise<string> {
    if (!this.deps.retrieveMemories) return '';
    try {
      return await this.deps.retrieveMemories(query, lexicalQuery ?? query);
    } catch {
      return '';
    }
  }

  get catContainer(): HTMLElement {
    return document.getElementById(CAT_CONTAINER_ID) as HTMLElement;
  }

  /** setupInteractions（原：滑块/拖拽/事件/配置回填/陪伴启动） */
  setupInteractions(): void {
    this.setupMovement();
    this.setupEventListeners();
    this.startCompanionMode();
    eventSystem.emit(EVENTS.INTERACTIONS_INITIALIZED);
  }

  private setupMovement(): void {
    const c = this.catContainer;
    c.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false } as any);
    c.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false } as any);
    c.addEventListener('touchend', this.handleTouchEnd.bind(this));
    c.addEventListener('mousedown', this.handleMouseDown.bind(this));
  }

  private handleTouchStart(e: any): void {
    if (this.isSettingsOpen || this.isChatOpen) return;
    e.preventDefault();
    const touch = e.touches[0];
    this.tapStartX = touch.clientX;
    this.tapStartY = touch.clientY;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    const computedStyle = window.getComputedStyle(this.catContainer);
    this.initialLeft = parseFloat(computedStyle.left) || (window.innerWidth - this.catContainer.offsetWidth) / 2;
    this.initialTop = parseFloat(computedStyle.top) || window.innerHeight - this.catContainer.offsetHeight;
    this.catContainer.style.transition = 'none';
    this.startLongPressTimer();
    eventSystem.emit('touchStarted', { x: this.startX, y: this.startY });
  }

  private handleTouchMove(e: any): void {
    if (this.isSettingsOpen || this.isChatOpen) return;
    e.preventDefault();
    this.clearLongPressTimer();
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.startX;
    const deltaY = touch.clientY - this.startY;
    const newLeft = this.initialLeft + deltaX;
    const newTop = this.initialTop + deltaY;
    const maxX = window.innerWidth - this.catContainer.offsetWidth;
    this.catContainer.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
    this.catContainer.style.top = Math.max(0, Math.min(newTop, window.innerHeight - 10)) + 'px';
    this.isDragging = true;
    eventSystem.emit(EVENTS.CAT_DRAGGED, { x: newLeft, y: newTop });
  }

  private handleTouchEnd(e: any): void {
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const moveDistance = Math.sqrt(Math.pow(endX - this.tapStartX, 2) + Math.pow(endY - this.tapStartY, 2));
    if (moveDistance < this.tapThreshold && !this.isDragging) this.handleTap();
    this.isDragging = false;
    this.catContainer.style.transition = 'all 0.3s ease';
    const rect = this.catContainer.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    if (rect.bottom > windowHeight - 5) this.catContainer.style.top = windowHeight - rect.height + 10 + 'px';
    if (rect.top < 10) this.catContainer.style.top = '10px';
    this.clearLongPressTimer();
    eventSystem.emit('touchEnded', { x: endX, y: endY });
  }

  private handleMouseDown(e: any): void {
    if (this.isSettingsOpen || this.isChatOpen) return;
    this.tapStartX = e.clientX;
    this.tapStartY = e.clientY;
    this.startX = e.clientX;
    this.startY = e.clientY;
    const computedStyle = window.getComputedStyle(this.catContainer);
    this.initialLeft = parseFloat(computedStyle.left) || (window.innerWidth - this.catContainer.offsetWidth) / 2;
    this.initialTop = parseFloat(computedStyle.top) || window.innerHeight - this.catContainer.offsetHeight;
    this.catContainer.style.transition = 'none';
    this.startLongPressTimer();
    this.isMousePressed = true;
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    eventSystem.emit('mouseDown', { x: this.startX, y: this.startY });
  }

  private handleMouseMove(e: any): void {
    if (!this.isMousePressed || this.isSettingsOpen || this.isChatOpen) return;
    this.clearLongPressTimer();
    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;
    const newLeft = this.initialLeft + deltaX;
    const newTop = this.initialTop + deltaY;
    const maxX = window.innerWidth - this.catContainer.offsetWidth;
    this.catContainer.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
    this.catContainer.style.top = Math.max(0, Math.min(newTop, window.innerHeight - 10)) + 'px';
    this.isDragging = true;
    eventSystem.emit(EVENTS.CAT_DRAGGED, { x: newLeft, y: newTop });
  }

  private handleMouseUp(e: any): void {
    const endX = e.clientX;
    const endY = e.clientY;
    const moveDistance = Math.sqrt(Math.pow(endX - this.tapStartX, 2) + Math.pow(endY - this.tapStartY, 2));
    if (moveDistance < this.tapThreshold && !this.isDragging) this.handleTap();
    this.isMousePressed = false;
    this.isDragging = false;
    this.catContainer.style.transition = 'all 0.3s ease';
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    this.clearLongPressTimer();
    eventSystem.emit('mouseUp', { x: endX, y: endY });
  }

  /** 点触连击（原 handleTap：单击抚摸、双击聊天、五击设置；三击语音已删 2026-08-23） */
  private handleTap(): void {
    this.tapCount++;
    if (this.tapCount === 1) {
      if (this.tapTimer) clearTimeout(this.tapTimer);
      this.tapTimer = setTimeout(() => {
        if (hasBookTag()) void this.generateAutoCompanionMessage();
        else this.showPetMessage();
        this.resetTapState();
      }, 300);
    } else if (this.tapCount === 2) {
      if (this.tapTimer) clearTimeout(this.tapTimer);
      this.clearLongPressTimer();
      this.tapTimer = setTimeout(() => {
        this.deps.openChat();
        this.resetTapState();
      }, 300);
    } else if (this.tapCount === 3) {
      // 语音模块已删（用户拍板）——三击无动作，直接复位
      this.resetTapState();
    } else if (this.tapCount === 5) {
      if (this.tapTimer) clearTimeout(this.tapTimer);
      this.clearLongPressTimer();
      this.tapTimer = setTimeout(() => {
        this.deps.openSettings();
        this.resetTapState();
      }, 300);
    }
    eventSystem.emit(EVENTS.CAT_TAPPED, { count: this.tapCount });
  }

  private resetTapState(): void {
    this.tapCount = 0;
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
    this.clearLongPressTimer();
  }

  /** 长按开设置（原 startLongPressTimer：800ms） */
  private startLongPressTimer(): void {
    this.longPressTimer = setTimeout(() => {
      this.deps.openSettings();
      this.tapCount = -1;
      if (this.tapTimer) {
        clearTimeout(this.tapTimer);
        this.tapTimer = null;
      }
      eventSystem.emit(EVENTS.LONG_PRESS_DETECTED);
    }, 800);
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /** 事件监听（原 setupEventListeners：聊天 send/Enter） */
  private setupEventListeners(): void { /* 聊天事件由 index 绑定面板回调；此处保留扩展点 */ }

  /** 宠物消息（原 showPetMessage：50% PET_MESSAGES / 心情分支（悬空，保留原逻辑）） */
  showPetMessage(): void {
    // 原版 window.smartCat.mood 悬空（铁律 4 保留）：永远走 getSmartCatMessage('PET_MESSAGES')
    const message = getSmartCatMessage('PET_MESSAGES');
    this.deps.bubble.showBubble(message, this.deps.mood.getCurrentMoodEmoji());
    const catBody = this.catContainer.querySelector('#cat-body') as HTMLElement;
    const animations = ['scale(1.15)', 'scale(1.1) rotate(5deg)', 'scale(1.12) rotate(-3deg)', 'scale(1.08)', 'scale(1.2)'];
    const randomAnim = animations[Math.floor(Math.random() * animations.length)];
    catBody.style.transform = randomAnim;
    catBody.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    setTimeout(() => {
      catBody.style.transform = 'scale(1) rotate(0deg)';
    }, 300);
    if (Math.random() < 0.5) {
      catBody.style.animation = 'heartbeat 0.5s ease-in-out';
      setTimeout(() => {
        catBody.style.animation = '';
      }, 500);
    }
    eventSystem.emit(EVENTS.PET_INTERACTION);
    // 2026-08-23 用户拍板：抚摸=纯互动信号，不持久影响信任/心情/人格（原 ADR-0023 性格微移已移除）
  }

  /** 陪伴定时器（原 startCompanionMode：speakInterval 分钟 × 概率；启动 1s 后欢迎/引导气泡） */
  startCompanionMode(): void {
    this.restartCompanionInterval();
    setTimeout(() => {
      void (async () => {
        if (await isAIConfigured()) {
          this.deps.bubble.showBubble(getSmartCatMessage('CONNECTED_MESSAGES'), this.deps.mood.getCurrentMoodEmoji());
        } else {
          this.deps.bubble.showBubble(getSmartCatMessage('SETUP_MESSAGES'));
        }
      })();
    }, 1000);
    eventSystem.emit(EVENTS.COMPANION_MODE_STARTED);
  }

  /** 重启陪伴定时器（原 restartCompanionInterval） */
  restartCompanionInterval(): void {
    if (this.companionInterval) clearInterval(this.companionInterval);
    const cfg = this.deps.config();
    this.companionInterval = setInterval(() => {
      if (Math.random() < cfg.speakProbability) {
        void this.generateAutoCompanionMessage();
      }
    }, cfg.speakInterval * 60 * 1000);
  }

  /** 自动陪伴消息（原 generateAutoCompanionMessage：选中文本/无上下文/有上下文三分支；无 key 回落硬编码） */
  async generateAutoCompanionMessage(): Promise<void> {
    const cfg = this.deps.config();
    if (this.generateAutoCompanionMessageLock) {
      this.deps.bubble.showBubble(getSmartCatMessage('THINKING_IN_PROGRESS_MESSAGES'));
      return;
    }
    if (!(await isAIConfigured())) {
      const randomMessages = ['喵~ 继续加油写笔记哦！', '笔记进展如何？需要我陪伴吗？', '保持专注，你做得很好！✨', '休息一下也不错哦~ 🐾🐾🐾'];
      this.deps.bubble.showBubble(randomMessages[Math.floor(Math.random() * randomMessages.length)]);
      return;
    }
    try {
      // ADR-0025：自言自语也携带「懂你上下文」（作息/趋势/关系/相关记忆）
      const memoriesText = await this.retrieveCompanionMemories('');
      const companionContext = this.getCompanionContext(memoriesText);

      let context: string | null;
      if (hasBookTag()) {
        context = getVisibleContent();
        context = context ? context.replace(/[\s\S]*?添加笔记属性/, '') : null;
      } else {
        context = getCursorContext(cfg.contextLength, cfg.contextSplitRatio);
      }
      if (!context) context = getViewportContent();

      const selection = window.getSelection ? (window.getSelection()?.toString() || '').trim() : '';
      const moodOpts = { pad: this.deps.mood.pad, data: this.deps.characterData?.() ?? null, currentMood: this.deps.mood.currentMood, currentEmotion: this.deps.mood.getCurrentEmotion(), companionContext };
      const prompt = generatePrompt('learn', context || '', moodOpts);

      if (selection && selection.length <= 1500) {
        startThinking();
        this.generateAutoCompanionMessageLock = true;
        try {
          const response = await callChat([
            { role: 'system', content: prompt },
            { role: 'user', content: `选中的文本："${selection}"\n\n上下文：${context}` },
          ]);
          if (response) this.deps.bubble.showBubble(response);
        } finally {
          stopThinking();
          this.generateAutoCompanionMessageLock = false;
        }
        return;
      }

      if (!context || context.length < 10) {
        const rp = generatePrompt('auto_companion', '', { pad: this.deps.mood.pad, data: this.deps.characterData?.() ?? null, currentMood: this.deps.mood.currentMood, currentEmotion: this.deps.mood.getCurrentEmotion(), companionContext });
        startThinking();
        this.generateAutoCompanionMessageLock = true;
        try {
          const response = await callChat([
            { role: 'system', content: rp },
            { role: 'user', content: '基于当前状态给我一个简短的陪伴消息，不需要特定上下文' },
          ]);
          if (response) this.deps.bubble.showBubble(response);
        } finally {
          stopThinking();
          this.generateAutoCompanionMessageLock = false;
        }
        return;
      }

      startThinking();
      this.generateAutoCompanionMessageLock = true;
      try {
        const response = await callChat([
          { role: 'system', content: prompt },
          { role: 'user', content: `基于以下内容给我一些陪伴或建议：${context}` },
        ]);
        if (response) this.deps.bubble.showBubble(response);
      } finally {
        stopThinking();
        this.generateAutoCompanionMessageLock = false;
      }
    } catch (error) {
      stopAllThinking();
      this.generateAutoCompanionMessageLock = false;
    }
  }

  /** 聊天消息组装（原 prepareChatMessages：system prompt + 历史 + 上下文 + 用户消息）
   *  ADR-0025：system prompt 携带「懂你上下文块」（作息/趋势/关系/检索记忆），
   *  用户消息保留当前笔记上下文；记忆注入不再拼在 user 尾部。 */
  async prepareChatMessages(userMessage: string): Promise<any[]> {
    const cfg = this.deps.config();
    const messages: any[] = [];
    const currentEmotion = this.deps.mood.getCurrentEmotion();
    // 检索记忆（语义 query 含情绪/时段；词法降级用纯用户消息，避免噪音 token 稀释命中率）
    const retrieveQuery = buildRetrieveQuery(userMessage, currentEmotion);
    const memoriesText = await this.retrieveCompanionMemories(retrieveQuery, userMessage);
    const companionContext = this.getCompanionContext(memoriesText);
    messages.push({ role: 'system', content: generatePrompt('talk', userMessage, { pad: this.deps.mood.pad, data: this.deps.characterData?.() ?? null, currentMood: this.deps.mood.currentMood, currentEmotion, companionContext }) });

    if (cfg.conversationHistory && cfg.conversationHistory.length > 0) {
      const maxHistoryMessages = Math.min(cfg.shortTermMemory * 2, cfg.conversationHistory.length);
      const recentHistory = cfg.conversationHistory.slice(-maxHistoryMessages);
      recentHistory.forEach((chat) => messages.push({ role: chat.role, content: chat.content }));
    }

    let contextMessage = '当前对话上下文：\n';
    const noteContext = getCurrentNoteContext();
    if (noteContext && noteContext.fileName) {
      contextMessage += `- 当前笔记：${noteContext.fileName}\n`;
      let contentContext: string | null;
      if (hasBookTag()) contentContext = getVisibleContent();
      else contentContext = getCursorContext(cfg.contextLength, cfg.contextSplitRatio);
      if (!contentContext) contentContext = getViewportContent();
      if (contentContext) contextMessage += `- 当前内容：${contentContext}\n`;
    }
    const finalUserMessage = contextMessage + `\n用户最新消息：${userMessage}`;
    messages.push({ role: 'user', content: finalUserMessage });
    return messages;
  }

  /** 设置保存（原 saveSettings 语义：外观/性格/间隔/概率/记忆量/上下文——apiKey 移除，AI 走 bz） */
  async saveSettings(changes: Partial<SmartCatConfig>): Promise<void> {
    const cfg = this.deps.config();
    const newConfig: SmartCatConfig = { ...cfg, ...changes };
    await this.deps.saveConfig(newConfig);
    this.deps.onAppearanceChanged(newConfig.appearance);
    this.restartCompanionInterval();
    this.deps.bubble.showBubble(getSmartCatMessage('SETUP_MESSAGES'));
    eventSystem.emit(EVENTS.SETTINGS_SAVED, { config: newConfig });
  }

  /** 清理（卸载） */
  dispose(): void {
    if (this.companionInterval) {
      clearInterval(this.companionInterval);
      this.companionInterval = null;
    }
    // 摘除 document 级拖拽监听（卸载时若正按住拖拽，避免残留监听访问已移除的容器）
    this.isMousePressed = false;
    this.isDragging = false;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.clearLongPressTimer();
    this.resetTapState();
  }
}

/** 移动端输入法适配（原 MobileInputAdapter 简版：输入框聚焦时把猫挪到可视区上方） */
export class MobileInputAdapter {
  private isInputActive = false;
  private isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  private boundFocusIn: (e: Event) => void;
  private boundFocusOut: (e: Event) => void;
  private boundVisualResize: () => void;

  constructor(private catContainer: HTMLElement) {
    this.boundFocusIn = this.handleFocusIn.bind(this);
    this.boundFocusOut = this.handleFocusOut.bind(this);
    this.boundVisualResize = () => {
      if (this.isInputActive) this.adjustCatPosition();
    };
    if (this.isMobileDevice) this.initialize();
  }

  private initialize(): void {
    document.addEventListener('focusin', this.boundFocusIn);
    document.addEventListener('focusout', this.boundFocusOut);
    if ((window as any).visualViewport) {
      (window as any).visualViewport.addEventListener('resize', this.boundVisualResize);
    }
  }

  private shouldHandleElement(element: any): boolean {
    const inputTypes = ['text', 'textarea', 'search', 'email', 'url', 'tel', 'number', 'password'];
    const tagNames = ['INPUT', 'TEXTAREA'];
    if (element && tagNames.includes(element.tagName)) {
      return inputTypes.includes(element.type) || element.type === '';
    }
    return element && element.isContentEditable;
  }

  private handleFocusIn(event: Event): void {
    if (!this.shouldHandleElement(event.target)) return;
    this.isInputActive = true;
    this.adjustCatPosition();
  }

  private handleFocusOut(): void {
    if (!this.isInputActive) return;
    setTimeout(() => {
      this.isInputActive = false;
      this.restoreOriginalPosition();
    }, 300);
  }

  private adjustCatPosition(): void {
    if (!this.isInputActive) return;
    const safeMargin = 20;
    const viewportHeight = (window as any).visualViewport ? (window as any).visualViewport.height : window.innerHeight;
    const catRect = this.catContainer.getBoundingClientRect();
    const catHeight = catRect.height;
    const safeTop = Math.max(10, viewportHeight - catHeight - safeMargin);
    this.catContainer.style.position = 'fixed';
    this.catContainer.style.top = safeTop + 'px';
    this.catContainer.style.left = '50%';
    this.catContainer.style.transform = 'translateX(-50%)';
    this.catContainer.style.zIndex = '9999';
    this.catContainer.style.transition = 'top 0.3s ease';
  }

  private restoreOriginalPosition(): void {
    const style = window.getComputedStyle(this.catContainer);
    // 还原为右下角默认位（styles.css .bz-sc-cat 承担静态定位；此处清内联）
    this.catContainer.style.position = '';
    this.catContainer.style.top = '';
    this.catContainer.style.left = '';
    this.catContainer.style.transform = '';
    this.catContainer.style.zIndex = '';
    this.catContainer.style.transition = '';
  }

  destroy(): void {
    document.removeEventListener('focusin', this.boundFocusIn);
    document.removeEventListener('focusout', this.boundFocusOut);
    if ((window as any).visualViewport) {
      (window as any).visualViewport.removeEventListener('resize', this.boundVisualResize);
    }
  }
}
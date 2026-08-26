/**
 * 交互管理器（移植自 SmartCat.js InteractionManager）
 * 点触手势桌面/移动同套（2026-08-23 用户拍板统一）：单击=宠物消息、双击=聊天、长按=设置
 * （三击语音已删、五击设置并入长按）；
 * 拖拽（鼠标/触屏）——设置/聊天面板开着时依旧可拖动（仅抑制点触/长按手势，2026-08-23 用户拍板）；
 * 陪伴定时器（自言自语）；聊天（多轮+上下文）；书评消息。
 * 全部命令/面板操作经回调注入（index 组装，避免模块间循环依赖）。
 */
import { eventSystem, startThinking, stopThinking, stopAllThinking } from './state';
import { EVENTS } from './types';
import { getSmartCatMessage } from './messages';
import { generatePrompt } from './prompts';
import { callChat, isAIConfigured } from './api';
import { buildRetrieveQuery, USER_CONTENT_BOUNDARY } from './memory';
import { buildCompanionContext } from './companion-context';
import { hasBookTag, getCursorContext, getViewportContent, getCurrentNoteContext, getVisibleContent } from './content';
import { CAT_CONTAINER_ID } from './ui';
import type { BubbleManager } from './bubble';
import type { MoodSystem } from './mood';
import type { SmartCatConfig } from './types';

/** 拖拽越界参数：拖动中每边至少保留可见的像素（允许拖出边缘做「探出」效果） */
const DRAG_PEEK = 14;
/** 松手回弹后距屏幕左/右/上边缘的安全像素 */
const EDGE_MARGIN = 8;
/** 底边允许的微收像素：小橘默认姿态即 bottom:-10px（蹲在屏幕下缘，styles.css 同款），
 *  松手回弹到底边内缩 10px 处而非强制完全可见——保留既定姿态（原移动端行为一致）。 */
const BOTTOM_TUCK = 10;
/** 回弹动画时长/缓动：过冲贝塞尔——与移动端原下边缘自动弹出同款手感 */
const SPRING_MS = 450;
const SPRING_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export interface InteractionDeps {
  config: () => SmartCatConfig;
  bubble: BubbleManager;
  mood: MoodSystem;
  openChat: () => void;
  openSettings: () => void;
  /** 记忆流检索（ADR-0021：聊天上下文注入相关记忆；index 注入，避免顶层互访）
   *  ADR-0025：第二参 lexicalQuery 供词法降级模式使用（纯用户消息，避免「情绪/时段」噪音） */
  retrieveMemories?: (query: string, lexicalQuery?: string) => Promise<string>;
  /** 性格数据（ADR-0023：prompt 状态向量用；index 注入 data.personalityGrowth） */
  characterData?: () => any;
}

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
  /** 松手回弹动画计时器（springBackIntoViewport 结束后恢复默认过渡用） */
  private springTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** prompt 状态对象（pad/性格数据/心情/瞬时情绪/懂你上下文；三分支与聊天共用组装） */
  private moodOpts(companionContext: string) {
    return {
      pad: this.deps.mood.pad,
      data: this.deps.characterData?.() ?? null,
      currentMood: this.deps.mood.currentMood,
      currentEmotion: this.deps.mood.getCurrentEmotion(),
      companionContext,
    };
  }

  /** 思考态 AI 调用（置锁 → callChat → 气泡展示 → finally 解锁；自动陪伴三分支共用骨架） */
  private async thinkingCall(systemPrompt: string, userContent: string): Promise<void> {
    startThinking();
    this.generateAutoCompanionMessageLock = true;
    try {
      const response = await callChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ]);
      if (response) this.deps.bubble.showBubble(response);
    } finally {
      stopThinking();
      this.generateAutoCompanionMessageLock = false;
    }
  }

  get catContainer(): HTMLElement {
    return document.getElementById(CAT_CONTAINER_ID) as HTMLElement;
  }

  /** 设置/聊天面板是否打开——只抑制点触/长按手势，不再锁拖拽（用户拍板：面板开着小橘依旧可移动，不定死） */
  private get panelOpen(): boolean {
    return this.isSettingsOpen || this.isChatOpen;
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
    eventSystem.emit('touchStarted', { x: this.startX, y: this.startY });
    // 面板开着仍可拖动（拖拽基准照记）；仅不再触发长按开设置
    if (this.panelOpen) return;
    this.startLongPressTimer();
  }

  private handleTouchMove(e: any): void {
    e.preventDefault();
    this.clearLongPressTimer();
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.startX;
    const deltaY = touch.clientY - this.startY;
    const newLeft = this.initialLeft + deltaX;
    const newTop = this.initialTop + deltaY;
    this.applyDragPosition(newLeft, newTop);
  }

  private handleTouchEnd(e: any): void {
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const moveDistance = Math.sqrt(Math.pow(endX - this.tapStartX, 2) + Math.pow(endY - this.tapStartY, 2));
    // 面板开着不触发点触手势（防误触再开聊天/设置），位置清理照常
    if (!this.panelOpen && moveDistance < this.tapThreshold && !this.isDragging) this.handleTap();
    this.isDragging = false;
    this.springBackIntoViewport();
    this.clearLongPressTimer();
    eventSystem.emit('touchEnded', { x: endX, y: endY });
  }

  /**
   * 拖拽中位置约束（桌面/移动统一）：允许小幅拖出屏幕边缘（每边至少保留 DRAG_PEEK 可见），
   * 松手由 springBackIntoViewport 统一弹回——原仅移动端下边缘有回弹，四边推广（用户拍板）。
   */
  private applyDragPosition(newLeft: number, newTop: number): void {
    const w = this.catContainer.offsetWidth;
    const h = this.catContainer.offsetHeight;
    const minLeft = -(w - DRAG_PEEK);
    const minTop = -(h - DRAG_PEEK);
    const maxLeft = window.innerWidth - DRAG_PEEK;
    const maxTop = window.innerHeight - DRAG_PEEK;
    this.catContainer.style.left = Math.max(minLeft, Math.min(newLeft, maxLeft)) + 'px';
    this.catContainer.style.top = Math.max(minTop, Math.min(newTop, maxTop)) + 'px';
    this.isDragging = true;
    eventSystem.emit(EVENTS.CAT_DRAGGED, { x: newLeft, y: newTop });
  }

  /**
   * 松手回弹：把拖出屏幕边缘的小橘以过冲动画弹回可视区（四边统一；原仅移动端下边缘有弹出）。
   * 边界口径：左/右完全可见（内缩 EDGE_MARGIN），底边回到微收 BOTTOM_TUCK（默认蹲姿）。
   */
  springBackIntoViewport(): void {
    const c = this.catContainer;
    if (!c) return;
    const curLeft = parseFloat(c.style.left);
    const curTop = parseFloat(c.style.top);
    if (Number.isNaN(curLeft) || Number.isNaN(curTop)) return; // 未拖拽过（无内联位置）无须修正
    const w = c.offsetWidth || 0;
    const h = c.offsetHeight || 0;
    const maxLeft = Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
    const maxTop = Math.max(EDGE_MARGIN, window.innerHeight - h + BOTTOM_TUCK);
    const targetLeft = Math.min(Math.max(curLeft, EDGE_MARGIN), maxLeft);
    const targetTop = Math.min(Math.max(curTop, EDGE_MARGIN), maxTop);
    if (Math.abs(targetLeft - curLeft) < 0.5 && Math.abs(targetTop - curTop) < 0.5) {
      c.style.transition = ''; // 未越界：清掉 mousedown 的 none，恢复样式表默认过渡
      return;
    }
    c.style.transition = `left ${SPRING_MS}ms ${SPRING_EASING}, top ${SPRING_MS}ms ${SPRING_EASING}`;
    c.style.left = targetLeft + 'px';
    c.style.top = targetTop + 'px';
    if (this.springTimer) clearTimeout(this.springTimer);
    // 动画结束恢复默认过渡（下次拖拽 start 仍会置 none，双保险）
    this.springTimer = setTimeout(() => { c.style.transition = ''; }, SPRING_MS + 60);
  }

  private handleMouseDown(e: any): void {
    this.tapStartX = e.clientX;
    this.tapStartY = e.clientY;
    this.startX = e.clientX;
    this.startY = e.clientY;
    const computedStyle = window.getComputedStyle(this.catContainer);
    this.initialLeft = parseFloat(computedStyle.left) || (window.innerWidth - this.catContainer.offsetWidth) / 2;
    this.initialTop = parseFloat(computedStyle.top) || window.innerHeight - this.catContainer.offsetHeight;
    this.catContainer.style.transition = 'none';
    this.isMousePressed = true;
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    eventSystem.emit('mouseDown', { x: this.startX, y: this.startY });
    // 面板开着仍可拖动（拖拽基准照记）；仅不再触发长按开设置
    if (this.panelOpen) return;
    this.startLongPressTimer();
  }

  private handleMouseMove(e: any): void {
    if (!this.isMousePressed) return;
    this.clearLongPressTimer();
    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;
    const newLeft = this.initialLeft + deltaX;
    const newTop = this.initialTop + deltaY;
    this.applyDragPosition(newLeft, newTop);
  }

  private handleMouseUp(e: any): void {
    const endX = e.clientX;
    const endY = e.clientY;
    const moveDistance = Math.sqrt(Math.pow(endX - this.tapStartX, 2) + Math.pow(endY - this.tapStartY, 2));
    // 面板开着不触发点触手势（防误触再开聊天/设置）
    if (!this.panelOpen && moveDistance < this.tapThreshold && !this.isDragging) this.handleTap();
    this.isMousePressed = false;
    this.isDragging = false;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    this.springBackIntoViewport();
    this.clearLongPressTimer();
    eventSystem.emit('mouseUp', { x: endX, y: endY });
  }

  /**
   * 点触连击（2026-08-23 用户拍板统一，桌面/移动同套）：
   * 单击=宠物消息、双击=聊天（立即开，不再等第二段延时）；设置统一走长按——
   * 原三击语音已删、五击设置并入长按。
   */
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
      this.deps.openChat();
      this.resetTapState();
    } else {
      // 三击及以上无动作（语音/五击手势均已删），直接复位
      this.resetTapState();
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

  /** 长按开设置（原 startLongPressTimer：800ms；桌面/移动统一入口——五击手势已并入） */
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
      const moodOpts = this.moodOpts(companionContext);
      const prompt = generatePrompt('learn', context || '', moodOpts);

      if (selection && selection.length <= 1500) {
        await this.thinkingCall(prompt + '\n\n' + USER_CONTENT_BOUNDARY, `选中的文本："${selection}"\n\n上下文：${context}`);
        return;
      }

      if (!context || context.length < 10) {
        const rp = generatePrompt('auto_companion', '', this.moodOpts(companionContext));
        await this.thinkingCall(rp + '\n\n' + USER_CONTENT_BOUNDARY, '基于当前状态给我一个简短的陪伴消息，不需要特定上下文');
        return;
      }

      await this.thinkingCall(prompt + '\n\n' + USER_CONTENT_BOUNDARY, `基于以下内容给我一些陪伴或建议：${context}`);
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
    // H4（087）：聊天 system 统一追加「数据非指令」边界（当前笔记内容/检索记忆仅作数据引用）
    messages.push({
      role: 'system',
      content: generatePrompt('talk', userMessage, this.moodOpts(companionContext)) + '\n\n' + USER_CONTENT_BOUNDARY,
    });

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
    if (this.springTimer) {
      clearTimeout(this.springTimer);
      this.springTimer = null;
    }
    this.resetTapState();
  }
}

/** 移动端输入法适配（UX 36 修订：焦点劫持范围收敛 + 失焦保留拖拽位置）——
 * 原版 document 级 focusin/focusout 对所有输入框生效（任意外部输入聚焦都把猫挪到可视区上方），
 * 且失焦时清空全部内联样式（把用户拖拽过的 left/top 一并抹掉，猫跳回默认位）。
 * 现改为：
 * ① 范围收敛：只有焦点落在小橘自家面板（聊天/设置/数据面板）内的输入才抬猫，
 *   其余全局输入（搜索框/他域设置等）不再干预；
 * ② 位置记忆：抬升前捕获当前内联 left/top（即拖拽位置），输入法收起/失焦后原样复原——
 *   不重置猫的拖拽位置（未拖拽过为空串 → 走样式表默认位）。 */
export class MobileInputAdapter {
  private isInputActive = false;
  private isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  private boundFocusIn: (e: Event) => void;
  private boundFocusOut: (e: Event) => void;
  private boundVisualResize: () => void;
  /** 抬升前捕获的内联位置记忆（left/top 原值；visualViewport resize 重算不覆盖） */
  private savedPosition: { left: string; top: string } | null = null;
  /** 失焦复原延时句柄（300ms 内重新聚焦 → 取消复原，防输入法抖动/焦点跳转竞态） */
  private focusOutTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** 焦点劫持范围收敛（UX 36）：只处理小橘自家面板内的输入——
   * 聊天面板 #chat-panel / 设置弹窗 #bz-settings-modal-popup / 数据面板 #smartcat-dashboard-panel */
  private isWithinOwnPanel(element: any): boolean {
    if (!element || typeof element.closest !== 'function') return false;
    return !!element.closest('#chat-panel, #bz-settings-modal-popup, #smartcat-dashboard-panel');
  }

  private handleFocusIn(event: Event): void {
    if (!this.shouldHandleElement(event.target)) return;
    if (!this.isWithinOwnPanel(event.target)) return; // 范围收敛：非小橘面板输入不抬猫
    // 竞态：上次失焦的复原延时未到已重新聚焦（输入法抖动/焦点跳转）→ 取消复原保持抬升态
    if (this.focusOutTimer) {
      clearTimeout(this.focusOutTimer);
      this.focusOutTimer = null;
    }
    this.isInputActive = true;
    this.adjustCatPosition();
  }

  private handleFocusOut(event: Event): void {
    if (!this.isInputActive) return;
    // 焦点仍在自家面板内（输入框之间跳转）→ 不复原
    const related = (event as any).relatedTarget;
    if (related && this.shouldHandleElement(related) && this.isWithinOwnPanel(related)) return;
    if (this.focusOutTimer) clearTimeout(this.focusOutTimer);
    this.focusOutTimer = setTimeout(() => {
      this.focusOutTimer = null;
      this.isInputActive = false;
      this.restoreOriginalPosition();
    }, 300);
  }

  private adjustCatPosition(): void {
    if (!this.isInputActive) return;
    // 位置记忆：抬升前捕获当前内联 left/top（用户拖拽位置）；visualViewport resize 重算时只捕一次
    if (this.savedPosition === null) {
      this.savedPosition = { left: this.catContainer.style.left, top: this.catContainer.style.top };
    }
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
    // 只复位抬升调整（position/transform/zIndex/transition）；left/top 恢复为抬升前捕获值——
    // 输入法收起不重置猫的拖拽位置（未拖拽过为空串 → 样式表默认位不变）
    this.catContainer.style.position = '';
    this.catContainer.style.transform = '';
    this.catContainer.style.zIndex = '';
    this.catContainer.style.transition = '';
    if (this.savedPosition) {
      this.catContainer.style.left = this.savedPosition.left;
      this.catContainer.style.top = this.savedPosition.top;
      this.savedPosition = null;
    } else {
      this.catContainer.style.left = '';
      this.catContainer.style.top = '';
    }
  }

  destroy(): void {
    document.removeEventListener('focusin', this.boundFocusIn);
    document.removeEventListener('focusout', this.boundFocusOut);
    if ((window as any).visualViewport) {
      (window as any).visualViewport.removeEventListener('resize', this.boundVisualResize);
    }
    if (this.focusOutTimer) {
      clearTimeout(this.focusOutTimer);
      this.focusOutTimer = null;
    }
  }
}
/**
 * 气泡管理器（移植自 SmartCat.js BubbleManager）
 * 行为保留：队列 + 打字机效果 + 计时/固定/双击转聊天 + 上限 4；
 * 堆叠由 #cat-bubbles-container 的 flex 布局自然承担（原 transform 推挤已废弃）。
 * 原 emoji 抽离到独立指示器已按用户要求删除——emoji 直接留在气泡文本里显示
 * （原 EmojiProcessor 类一并移除）。
 * 视口夹紧（2026-08-23 用户拍板）：气泡显示与打字过程中检测屏幕边缘，
 * 超界经 --bz-sc-shift 水平平移回可视区（styles.css transform 承载），永不超出屏幕边缘。
 */
import { eventSystem, isPageVisible } from './state';
import { EVENTS } from './types';

export type BubbleDuration = number | string | null;

/** 气泡距屏幕左右边缘的最小像素 */
export const BUBBLE_EDGE_PAD = 8;

/**
 * 气泡视口夹紧位移（纯函数）：按当前视觉矩形算还需水平平移多少 px（负=左移）才不出屏；
 * 无布局信息（宽 0，如 jsdom）或未超界返回 0。调用方把返回值累加到既有 shift 上
 * （测量含旧位移，增量即总量的修正项）。
 */
export function computeBubbleShift(
  rect: { left: number; right: number },
  viewportWidth: number,
  pad = BUBBLE_EDGE_PAD,
): number {
  if (!(rect.right > rect.left)) return 0;
  const needRight = rect.right - (viewportWidth - pad);
  if (needRight > 0) return -Math.round(needRight);
  const needLeft = pad - rect.left;
  if (needLeft > 0) return Math.round(needLeft);
  return 0;
}

export interface BubbleData {
  message: string;
  duration: BubbleDuration;
  timestamp: number;
}

export interface BubbleTiming {
  baseDisplayDuration: number;
  typingDuration: number;
  displayDuration: number;
  charInterval: number;
}

export class BubbleManager {
  bubbleQueue: BubbleData[] = [];
  isCurrentBubbleTyping = false;
  currentBubble: HTMLElement | null = null;
  private bubbleClickState = { firstClickTimestamp: 0, clickTimeout: null as ReturnType<typeof setTimeout> | null, isPermanent: false };

  /** 显示气泡（原 showBubble：不可见直接返回；入队；非打字中处理队列） */
  showBubble(message: string, duration: BubbleDuration = null): void {
    if (!isPageVisible) return;
    this.bubbleQueue.push({ message, duration, timestamp: Date.now() });
    if (!this.isCurrentBubbleTyping) this.processBubbleQueue();
    eventSystem.emit(EVENTS.BUBBLE_QUEUED, { message, duration });
  }

  processBubbleQueue(): void {
    if (this.bubbleQueue.length === 0 || this.isCurrentBubbleTyping) return;
    this.isCurrentBubbleTyping = true;
    const bubbleData = this.bubbleQueue.shift()!;
    this.showBubbleInternal(bubbleData.message, bubbleData.duration);
  }

  showBubbleInternal(message: string, duration: BubbleDuration = null): void {
    if (!message) return;
    const bubblesContainer = document.querySelector('#cat-bubbles-container');
    if (!bubblesContainer) return;

    const bubble = document.createElement('div');
    bubble.className = 'cat-bubble';
    this.currentBubble = bubble;

    const timing = this.calculateBubbleTiming(message, duration);
    bubblesContainer.appendChild(bubble);

    const allBubbles = Array.from(bubblesContainer.querySelectorAll<HTMLElement>('.cat-bubble'));

    void bubble.offsetWidth;
    bubble.classList.add('show');
    this.clampBubbleToViewport(bubble);

    this.startTypingEffect(bubble, message, timing);

    if (allBubbles.length > 4) {
      const oldestBubble = allBubbles[0];
      this.removeBubble(oldestBubble, true);
    }

    this.setupBubbleInteractions(bubble, message, timing);
    eventSystem.emit(EVENTS.BUBBLE_SHOWN, { message, duration: timing.baseDisplayDuration });
  }

  /** 计时计算（原 calculateBubbleTiming 逐字：默认 1000+200/字符 上限 15s；打字时长 min(100×字符,5s) 比例 0.6）
 *  注意原版 duration 可为字符串（如 '🎓'），数值运算后走 else 分支——铁律 4 保留。 */
  calculateBubbleTiming(message: string, duration: BubbleDuration): BubbleTiming {
    let baseDisplayDuration: any = duration;
    if (baseDisplayDuration === null) {
      const baseDuration = 1000;
      const charCount = message.length;
      const perCharDuration = 200;
      baseDisplayDuration = Math.min(baseDuration + charCount * perCharDuration, 15000);
      baseDisplayDuration = Math.max(baseDisplayDuration, 1000);
    }
    const MAX_TYPING_DURATION = 5000;
    const TYPING_RATIO = 0.6;
    const charCount = message.length;
    const requiredTypingDuration = Math.min(charCount * 100, MAX_TYPING_DURATION);

    let typingDuration: number;
    let displayDuration: number;

    if (requiredTypingDuration <= MAX_TYPING_DURATION) {
      if (requiredTypingDuration <= baseDisplayDuration * TYPING_RATIO) {
        typingDuration = requiredTypingDuration;
        displayDuration = baseDisplayDuration - typingDuration;
      } else {
        typingDuration = requiredTypingDuration;
        const minTotalDuration = typingDuration / TYPING_RATIO;
        displayDuration = minTotalDuration - typingDuration;
        baseDisplayDuration = minTotalDuration;
      }
    } else {
      typingDuration = MAX_TYPING_DURATION;
      displayDuration = baseDisplayDuration - typingDuration;
      if (displayDuration < 2000) {
        displayDuration = 2000;
        baseDisplayDuration = typingDuration + displayDuration;
      }
    }

    displayDuration = Math.max(displayDuration, 1000);
    const charInterval = Math.max(30, Math.min(150, typingDuration / charCount));

    return { baseDisplayDuration, typingDuration, displayDuration, charInterval };
  }

  /** 视口夹紧：测当前视觉矩形 → 增量位移累加到 --bz-sc-shift（styles.css transform 承载） */
  clampBubbleToViewport(bubble: HTMLElement): void {
    const vw = window.innerWidth || 0;
    const dx = computeBubbleShift(bubble.getBoundingClientRect(), vw);
    if (!dx) return;
    const prev = parseFloat(bubble.style.getPropertyValue('--bz-sc-shift')) || 0;
    bubble.style.setProperty('--bz-sc-shift', prev + dx + 'px');
  }

  /** 打字机效果（原 startTypingEffect 逐字：逐字 setInterval、完成清 interval、display 移除、队列推进、总超时兜底） */
  startTypingEffect(bubble: HTMLElement, message: string, timing: BubbleTiming): void {
    let currentText = '';
    let charIndex = 0;
    let isTypingComplete = false;
    const typingStartTime = Date.now();

    const typingEffect = setInterval(() => {
      if (charIndex < message.length) {
        currentText += message[charIndex];
        bubble.textContent = currentText;
        charIndex++;
        if (charIndex < message.length) bubble.textContent = currentText + '';
        // 文本增长会改变气泡宽度——每个打字节拍重测屏幕边缘（增量修正）
        this.clampBubbleToViewport(bubble);
      } else {
        const actualTypingTime = Date.now() - typingStartTime;
        bubble.textContent = currentText;
        clearInterval(typingEffect);
        isTypingComplete = true;
        bubble.dataset.typingComplete = 'true';
        const displayTimeoutId = setTimeout(() => {
          this.removeBubble(bubble);
        }, timing.displayDuration);
        bubble.dataset.displayTimeoutId = String(displayTimeoutId);
        setTimeout(() => {
          this.isCurrentBubbleTyping = false;
          this.currentBubble = null;
          this.processBubbleQueue();
        }, 100);
      }
    }, timing.charInterval);

    bubble.dataset.typingEffectId = String(typingEffect);
    const totalTimeoutId = setTimeout(() => {
      if (!isTypingComplete && bubble.dataset.typingEffectId) {
        clearInterval(typingEffect);
        bubble.textContent = message;
        isTypingComplete = true;
        bubble.dataset.typingComplete = 'true';
        const displayTimeoutId = setTimeout(() => {
          this.removeBubble(bubble);
        }, timing.displayDuration);
        bubble.dataset.displayTimeoutId = String(displayTimeoutId);
      } else if (isTypingComplete) {
        if (!bubble.dataset.displayTimeoutId) this.removeBubble(bubble);
      }
    }, timing.baseDisplayDuration + 3000);
    bubble.dataset.totalTimeoutId = String(totalTimeoutId);
  }

  /** 气泡交互（原 setupBubbleInteractions：单击/双击判定 500ms 窗口、pin/转聊天） */
  setupBubbleInteractions(bubble: HTMLElement, message: string, timing: BubbleTiming): void {
    bubble.style.pointerEvents = 'auto';
    bubble.style.cursor = 'pointer';
    const handleBubbleClick = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      const now = Date.now();
      const timeSinceFirstClick = now - this.bubbleClickState.firstClickTimestamp;
      if (timeSinceFirstClick > 500) {
        this.bubbleClickState.firstClickTimestamp = now;
        if (this.bubbleClickState.clickTimeout) clearTimeout(this.bubbleClickState.clickTimeout);
        this.bubbleClickState.clickTimeout = setTimeout(() => {
          this.handleSingleClick(bubble, message);
          this.bubbleClickState.firstClickTimestamp = 0;
        }, 300);
      } else {
        if (this.bubbleClickState.clickTimeout) clearTimeout(this.bubbleClickState.clickTimeout);
        this.bubbleClickState.firstClickTimestamp = 0;
        this.handleDoubleClick(bubble, message);
      }
    };
    bubble.addEventListener('click', handleBubbleClick);
    bubble.addEventListener('touchstart', handleBubbleClick, { passive: false } as any);
  }

  /** 单击：固定气泡（pin 绿框动画），再点移除 */
  handleSingleClick(bubble: HTMLElement, message: string): void {
    if (bubble.dataset.permanent === 'true') {
      this.removeBubble(bubble);
      return;
    }
    if (!bubble.dataset.typingComplete && bubble.dataset.typingEffectId) {
      clearInterval(Number(bubble.dataset.typingEffectId));
      bubble.textContent = message;
      bubble.dataset.typingComplete = 'true';
    }
    if (bubble.dataset.displayTimeoutId) {
      clearTimeout(Number(bubble.dataset.displayTimeoutId));
      bubble.dataset.displayTimeoutId = '';
    }
    if (bubble.dataset.totalTimeoutId) {
      clearTimeout(Number(bubble.dataset.totalTimeoutId));
      bubble.dataset.totalTimeoutId = '';
    }
    bubble.dataset.permanent = 'true';
    this.bubbleClickState.isPermanent = true;
    bubble.classList.add('bz-sc-bubble-pinned');
    setTimeout(() => bubble.classList.remove('bz-sc-bubble-pinned'), 1000);
    eventSystem.emit(EVENTS.BUBBLE_PINNED, { message });
  }

  /** 双击：转聊天（emit bubbleToChat 给 interaction 打开聊天带消息） */
  handleDoubleClick(bubble: HTMLElement, bubbleMessage: string): void {
    if (bubble.dataset.typingEffectId) clearInterval(Number(bubble.dataset.typingEffectId));
    if (bubble.dataset.displayTimeoutId) clearTimeout(Number(bubble.dataset.displayTimeoutId));
    if (bubble.dataset.totalTimeoutId) clearTimeout(Number(bubble.dataset.totalTimeoutId));
    if (!bubble.dataset.typingComplete) bubble.textContent = bubbleMessage;
    setTimeout(() => {
      this.removeBubble(bubble);
      eventSystem.emit(EVENTS.BUBBLE_TO_CHAT, { message: bubbleMessage });
    }, 50);
  }

  /** 移除气泡（原 removeBubble：清计时、hide 类、300ms 后 DOM 移除 + 重排 + 推进队列） */
  removeBubble(bubble: HTMLElement, isBeyondLimit = false): void {
    if (bubble.dataset.typingEffectId) clearInterval(Number(bubble.dataset.typingEffectId));
    if (bubble.dataset.displayTimeoutId) clearTimeout(Number(bubble.dataset.displayTimeoutId));
    if (bubble.dataset.totalTimeoutId) clearTimeout(Number(bubble.dataset.totalTimeoutId));
    bubble.classList.remove('show');
    bubble.classList.add('hide');
    if (this.bubbleClickState.isPermanent) this.bubbleClickState.isPermanent = false;

    setTimeout(() => {
      const bubblesContainer = document.querySelector('#cat-bubbles-container');
      if (bubblesContainer && bubble.parentNode === bubblesContainer) {
        bubblesContainer.removeChild(bubble);
        // 剩余气泡由 flex 自然重排，不再手动 transform 推挤（同推挤机制废弃原因）
      }
      this.isCurrentBubbleTyping = false;
      this.currentBubble = null;
      this.processBubbleQueue();
    }, 300);

    eventSystem.emit(EVENTS.BUBBLE_REMOVED, { element: bubble });
  }

  /** 清空全部气泡（window.smartCat.clearAllBubbles 语义） */
  clearAllBubbles(): void {
    const bubbles = document.querySelectorAll('.cat-bubble');
    bubbles.forEach((bubble) => this.removeBubble(bubble as HTMLElement));
  }
}
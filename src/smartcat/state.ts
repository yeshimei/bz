/**
 * smartcat 域状态（原 SmartCat.js EventSystem + thinking 计数器 + isPageVisible）
 * 域内单例，不挂 window（铁律 6）。
 */
import type { App } from 'obsidian';

/** 事件总线（原 EventSystem 逐字，on/off/emit） */
class EventSystem {
  events: Record<string, Function[]> = {};

  on(event: string, callback: Function): void {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  off(event: string, callback: Function): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  emit(event: string, data?: any): void {
    if (!this.events[event]) return;
    for (const cb of this.events[event]) {
      try {
        cb(data);
      } catch (error) {
        console.error(`[smartcat] 事件处理器错误 (${event}):`, error);
      }
    }
  }
}

export const eventSystem = new EventSystem();

/** 页面可见性（原 isPageVisible；document.hidden 无时默认可见） */
export let isPageVisible = typeof document === 'undefined' || !document.hidden;
export function setPageVisible(v: boolean): void {
  isPageVisible = v;
}

/** 思考状态计数（原 thinkingCount） */
let thinkingCount = 0;
let thinkingIndicator: HTMLElement | null = null;

/** 确保思考指示器存在（#thinking-indicator，挂到猫容器） */
export function ensureThinkingIndicator(container: HTMLElement | null): void {
  if (thinkingIndicator && thinkingIndicator.isConnected) return;
  thinkingIndicator = document.getElementById('thinking-indicator');
  if (!thinkingIndicator && container) {
    thinkingIndicator = document.createElement('div');
    thinkingIndicator.id = 'thinking-indicator';
    thinkingIndicator.className = 'thinking-indicator bz-sc-thinking';
    container.appendChild(thinkingIndicator);
  }
}

/** 开始思考（计数器 + active 类） */
export function startThinking(): void {
  if (!thinkingIndicator) ensureThinkingIndicator(null);
  thinkingCount++;
  if (thinkingIndicator) thinkingIndicator.classList.add('active');
}

/** 结束一次思考 */
export function stopThinking(): void {
  thinkingCount = Math.max(0, thinkingCount - 1);
  if (thinkingCount === 0 && thinkingIndicator) thinkingIndicator.classList.remove('active');
}

/** 清空全部思考状态 */
export function stopAllThinking(): void {
  thinkingCount = 0;
  if (thinkingIndicator) thinkingIndicator.classList.remove('active');
}

/** 获取思考计数（测试断言用） */
export function getThinkingCount(): number {
  return thinkingCount;
}

/** 重置思考指示器引用（卸载时） */
export function resetThinkingIndicator(el?: HTMLElement | null): void {
  if (el && thinkingIndicator === el) thinkingIndicator = null;
  else if (!el) thinkingIndicator = null;
  thinkingCount = 0;
}

let appRef: App | null = null;
export function setSmartcatApp(app: App): void {
  appRef = app;
}
export function getSmartcatApp(): App {
  if (!appRef) throw new Error('smartcat: app 未初始化（ensureSmartCat 未调用）');
  return appRef;
}

/** 可见性监听注册（原 setupSimpleVisibilityCheck 语义：离开 60s 才允许回程语） */
export interface VisibilityHandlers {
  onLeaveLong: () => void;
  onBack: () => void;
}

let visibilityCleanup: (() => void) | null = null;
let backMessageTimer: ReturnType<typeof setTimeout> | null = null;
let allowBackMessage = false;

/** 注册 visibilitychange（幂等：先清理旧监听），返回清理函数 */
export function setupVisibilityCheck(handlers: VisibilityHandlers): () => void {
  if (visibilityCleanup) visibilityCleanup();
  const onVis = () => {
    isPageVisible = !document.hidden;
    if (!isPageVisible) {
      if (backMessageTimer) clearTimeout(backMessageTimer);
      backMessageTimer = setTimeout(() => {
        allowBackMessage = true;
        handlers.onLeaveLong();
      }, 60 * 1000);
    } else {
      if (backMessageTimer) clearTimeout(backMessageTimer);
      if (allowBackMessage) {
        allowBackMessage = false;
        handlers.onBack();
      }
    }
  };
  document.addEventListener('visibilitychange', onVis);
  visibilityCleanup = () => {
    document.removeEventListener('visibilitychange', onVis);
    if (backMessageTimer) clearTimeout(backMessageTimer);
    backMessageTimer = null;
    allowBackMessage = false;
    visibilityCleanup = null;
  };
  return visibilityCleanup;
}

export function getAllowBackMessage(): boolean {
  return allowBackMessage;
}

/** 测试辅助：重置可见性状态 */
export function __resetVisibilityForTests(): void {
  if (visibilityCleanup) visibilityCleanup();
  backMessageTimer = null;
  allowBackMessage = false;
  isPageVisible = true;
}
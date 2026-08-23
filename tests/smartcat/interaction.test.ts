/**
 * smartcat 交互测试（UI 层）：桌面端拖拽——按住可拖动、松开后不再跟随光标。
 * 回归背景：此前 add/remove 处各写一次 `.bind(this)`，两次生成不同函数引用，
 * removeEventListener 永远匹配不上，导致松开鼠标后 mousemove 残留、小橘一直跟光标走。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractionManager } from '../../src/smartcat/interaction';
import type { InteractionDeps } from '../../src/smartcat/interaction';
import { CAT_CONTAINER_ID } from '../../src/smartcat/ui';

function mountCat(): HTMLElement {
  const existed = document.getElementById(CAT_CONTAINER_ID);
  if (existed) existed.remove();
  const c = document.createElement('div');
  c.id = CAT_CONTAINER_ID;
  document.body.appendChild(c);
  return c;
}

function makeDeps(): InteractionDeps {
  return {
    config: () => ({ speakInterval: 5, speakProbability: 0, appearance: 'orange' }) as never,
    saveConfig: async (c) => c,
    bubble: { showBubble: () => {} },
    mood: { pad: {}, currentMood: 'calm', getCurrentMoodEmoji: () => '😺', getCurrentEmotion: () => 'calm' },
    openChat: () => {},
    closeChat: () => {},
    openSettings: () => {},
    closeSettings: () => {},
    onAppearanceChanged: () => {},
  } as unknown as InteractionDeps;
}

/** jsdom 直接派发鼠标事件（clientX/Y 经 MouseEventInit 传入） */
function mouse(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

let manager: InteractionManager | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  mountCat();
});

afterEach(() => {
  manager?.dispose();
  manager = null;
  vi.useRealTimers();
});

describe('smartcat 桌面拖拽', () => {
  it('按住拖动：mousemove 连续移动猫容器', () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 200, 200);
    mouse(document, 'mousemove', 240, 180);
    const l1 = parseFloat(cat.style.left);
    const t1 = parseFloat(cat.style.top);
    expect(Number.isNaN(l1)).toBe(false);
    expect(Number.isNaN(t1)).toBe(false);
    mouse(document, 'mousemove', 280, 160);
    // 相对上一步再移动 Δ(40, -20)
    expect(parseFloat(cat.style.left) - l1).toBe(40);
    expect(parseFloat(cat.style.top) - t1).toBe(-20);
  });

  it('松开后不再跟随光标（核心回归：removeEventListener 用同引用才能摘除）', () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 200, 200);
    mouse(document, 'mousemove', 240, 180);
    const l1 = parseFloat(cat.style.left);
    const t1 = parseFloat(cat.style.top);
    mouse(document, 'mouseup', 240, 180);
    // 松开后随意晃动鼠标，位置必须纹丝不动
    mouse(document, 'mousemove', 600, 100);
    mouse(document, 'mousemove', 100, 700);
    expect(parseFloat(cat.style.left)).toBe(l1);
    expect(parseFloat(cat.style.top)).toBe(t1);
  });

  it('松开后即使拖拽监听异常残留，也不跟随（isMousePressed 守卫兜底）', () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 200, 200);
    mouse(document, 'mousemove', 240, 180);
    mouse(document, 'mouseup', 240, 180);
    // 模拟异常：把同一监听引用重新挂回 document（真实 bug 场景的等价物）
    const boundMouseMove = (manager as unknown as { boundMouseMove: EventListener }).boundMouseMove;
    document.addEventListener('mousemove', boundMouseMove);
    try {
      const l = parseFloat(cat.style.left);
      const t = parseFloat(cat.style.top);
      mouse(document, 'mousemove', 800, 800);
      expect(parseFloat(cat.style.left)).toBe(l);
      expect(parseFloat(cat.style.top)).toBe(t);
    } finally {
      document.removeEventListener('mousemove', boundMouseMove);
    }
  });

  it('松开后再次按住仍可正常拖拽', () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 200, 200);
    mouse(document, 'mousemove', 240, 180);
    mouse(document, 'mouseup', 240, 180);
    // 第二次按下：以新按下点为基准继续可拖
    mouse(cat, 'mousedown', 240, 180);
    mouse(document, 'mousemove', 300, 160);
    const l = parseFloat(cat.style.left);
    const t = parseFloat(cat.style.top);
    mouse(document, 'mousemove', 340, 150);
    expect(parseFloat(cat.style.left) - l).toBe(40);
    expect(parseFloat(cat.style.top) - t).toBe(-10);
    mouse(document, 'mouseup', 340, 150);
  });

  it('dispose 摘除 document 级监听：卸载后 mousemove 不再移动猫', () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 200, 200);
    mouse(document, 'mousemove', 240, 180);
    manager.dispose();
    mouse(document, 'mousemove', 900, 900);
    // dispose 后位置保持（监听已由 dispose 摘除）
    const l = parseFloat(cat.style.left);
    const t = parseFloat(cat.style.top);
    mouse(document, 'mousemove', 10, 10);
    expect(parseFloat(cat.style.left)).toBe(l);
    expect(parseFloat(cat.style.top)).toBe(t);
  });
});

/** jsdom 无 TouchEvent：派发带 touches 的普通 Event */
function touch(target: EventTarget, type: string, x: number, y: number): void {
  const e: any = new Event(type, { bubbles: true });
  e.touches = [{ clientX: x, clientY: y }];
  e.changedTouches = [{ clientX: x, clientY: y }];
  target.dispatchEvent(e);
}

describe('面板开着小橘仍可拖动（不定死）', () => {
  it('设置弹窗打开：鼠标拖拽正常；长按与连击手势被抑制', () => {
    const deps = makeDeps() as unknown as { openSettings: () => void } & InteractionDeps;
    const openSettings = vi.fn();
    deps.openSettings = openSettings;
    manager = new InteractionManager(deps as unknown as InteractionDeps);
    manager.setupInteractions();
    manager.isSettingsOpen = true;
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    // 按住超过长按阈值：不触发 openSettings
    mouse(cat, 'mousedown', 200, 200);
    vi.advanceTimersByTime(900);
    expect(openSettings).not.toHaveBeenCalled();
    // 但拖拽照常工作
    mouse(document, 'mousemove', 260, 180);
    expect(cat.style.left).not.toBe('');
    const l1 = parseFloat(cat.style.left);
    mouse(document, 'mousemove', 300, 180);
    expect(parseFloat(cat.style.left)).toBeGreaterThan(l1);
    mouse(document, 'mouseup', 300, 180);
    // 原地点击不进连击计数
    mouse(cat, 'mousedown', 300, 180);
    mouse(document, 'mouseup', 300, 180);
    expect((manager as unknown as { tapCount: number }).tapCount).toBe(0);
  });

  it('聊天面板打开：触摸拖拽正常；双击不再重复开聊天', () => {
    const deps = makeDeps() as unknown as { openChat: () => void } & InteractionDeps;
    const openChat = vi.fn();
    deps.openChat = openChat;
    manager = new InteractionManager(deps as unknown as InteractionDeps);
    manager.setupInteractions();
    manager.isChatOpen = true;
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    touch(cat, 'touchstart', 100, 100);
    touch(cat, 'touchmove', 160, 140);
    expect(cat.style.left).not.toBe('');
    touch(cat, 'touchend', 160, 140);
    // 快速双击（无位移）：不触发 handleTap → 不重复开聊天
    touch(cat, 'touchstart', 160, 140);
    touch(cat, 'touchend', 160, 140);
    touch(cat, 'touchstart', 160, 140);
    touch(cat, 'touchend', 160, 140);
    vi.advanceTimersByTime(700);
    expect(openChat).not.toHaveBeenCalled();
    expect((manager as unknown as { tapCount: number }).tapCount).toBe(0);
  });

  it('面板全关后手势恢复：双击正常打开聊天', () => {
    const deps = makeDeps() as unknown as { openChat: () => void } & InteractionDeps;
    const openChat = vi.fn();
    deps.openChat = openChat;
    manager = new InteractionManager(deps as unknown as InteractionDeps);
    manager.setupInteractions();
    manager.isSettingsOpen = true;
    manager.isSettingsOpen = false; // 开又关，确保状态复位路径无残留
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    touch(cat, 'touchstart', 100, 100);
    touch(cat, 'touchend', 100, 100);
    touch(cat, 'touchstart', 100, 100);
    touch(cat, 'touchend', 100, 100);
    vi.advanceTimersByTime(700);
    expect(openChat).toHaveBeenCalledTimes(1);
  });
});
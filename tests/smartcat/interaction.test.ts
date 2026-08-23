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
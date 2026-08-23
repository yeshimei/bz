/**
 * smartcat 交互测试（UI 层）：桌面端拖拽——按住可拖动、松开后不再跟随光标。
 * 回归背景：此前 add/remove 处各写一次 `.bind(this)`，两次生成不同函数引用，
 * removeEventListener 永远匹配不上，导致松开鼠标后 mousemove 残留、小橘一直跟光标走。
 * 手势统一（2026-08-23）：双击=聊天、长按=设置（五击已删）；拖出屏幕边缘松手回弹（四边统一）。
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
  // 猫体结构（单击宠物消息路径会取 #cat-body 做缩放动画）
  c.innerHTML = '<div id="cat-body"></div>';
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

describe('手势统一（2026-08-23：双击=聊天、长按=设置，桌面/移动同套）', () => {
  function withSpy<K extends keyof InteractionDeps>(key: K): { deps: InteractionDeps; spy: ReturnType<typeof vi.fn> } {
    const spy = vi.fn();
    const deps = makeDeps();
    (deps as any)[key] = spy;
    return { deps, spy };
  }

  it('双击立即打开聊天（不再等第二段 300ms 延时）', () => {
    const { deps, spy } = withSpy('openChat');
    manager = new InteractionManager(deps);
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 100, 100);
    mouse(document, 'mouseup', 100, 100);
    mouse(cat, 'mousedown', 100, 100);
    mouse(document, 'mouseup', 100, 100);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('五击不再触发设置（原五击手势已并入长按）', () => {
    const { deps, spy } = withSpy('openSettings');
    manager = new InteractionManager(deps);
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    for (let i = 0; i < 5; i++) {
      mouse(cat, 'mousedown', 100, 100);
      mouse(document, 'mouseup', 100, 100);
    }
    vi.advanceTimersByTime(700);
    expect(spy).not.toHaveBeenCalled();
    // 连击计数已复位（≥3 即清零），后续单击重新从 1 计
    mouse(cat, 'mousedown', 100, 100);
    mouse(document, 'mouseup', 100, 100);
    expect((manager as unknown as { tapCount: number }).tapCount).toBe(1);
  });

  it('按住 800ms 长按打开设置（鼠标路径）', () => {
    const { deps, spy } = withSpy('openSettings');
    manager = new InteractionManager(deps);
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 120, 120);
    vi.advanceTimersByTime(799);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('触摸路径长按同样打开设置（与桌面同一实现）', () => {
    const { deps, spy } = withSpy('openSettings');
    manager = new InteractionManager(deps);
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    touch(cat, 'touchstart', 90, 90);
    vi.advanceTimersByTime(850);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('拖出屏幕边缘松手回弹（四边统一；原仅移动端下边缘有弹出）', () => {
  /** jsdom 无布局：给容器钉上真实感尺寸（offsetWidth/Height 走实例自有属性遮蔽原型 getter） */
  function sizeCat(w: number, h: number): void {
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    Object.defineProperty(cat, 'offsetWidth', { value: w, configurable: true });
    Object.defineProperty(cat, 'offsetHeight', { value: h, configurable: true });
  }

  it('拖到右缘外松手：过冲动画弹回完全可见（右缘内缩 EDGE_MARGIN）', () => {
    sizeCat(50, 40);
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 500, 300);
    // 拖拽中允许探出：clamp 在 vw-PEEK（1024-14=1010），此刻本体右缘已在屏外
    mouse(document, 'mousemove', 2000, 300);
    expect(parseFloat(cat.style.left)).toBe(1010);
    mouse(document, 'mouseup', 2000, 300);
    // 松手弹回 vw-w-MARGIN（1024-50-8=966）
    expect(parseFloat(cat.style.left)).toBe(966);
    expect(cat.style.transition).toContain('cubic-bezier');
    // 动画结束恢复默认过渡
    vi.advanceTimersByTime(600);
    expect(cat.style.transition).toBe('');
  });

  it('拖到下缘外松手：弹回底部微收位（原移动端自动弹出行为保留并统一）', () => {
    sizeCat(50, 40);
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    touch(cat, 'touchstart', 300, 300);
    touch(cat, 'touchmove', 300, 2000);
    expect(parseFloat(cat.style.top)).toBe(754); // 拖拽中探出：vh-PEEK
    touch(cat, 'touchend', 300, 2000);
    expect(parseFloat(cat.style.top)).toBe(738); // 松手弹回：vh-h+BOTTOM_TUCK（默认蹲姿）
    expect(cat.style.transition).toContain('cubic-bezier');
  });

  it('拖到左缘外松手：弹回左安全边距内', () => {
    sizeCat(50, 40);
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 500, 300);
    mouse(document, 'mousemove', -1000, 300);
    expect(parseFloat(cat.style.left)).toBe(-36); // 探出左缘：-(w-PEEK)
    mouse(document, 'mouseup', -1000, 300);
    expect(parseFloat(cat.style.left)).toBe(8); // 回到 EDGE_MARGIN
  });

  it('未越界松手不施加回弹动画（位置与过渡均不动）', () => {
    sizeCat(50, 40);
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 400, 300);
    // 向上拖离底边（避免落在底边微收界外），全程在可视区内
    mouse(document, 'mousemove', 420, 200);
    const l = parseFloat(cat.style.left);
    const t = parseFloat(cat.style.top);
    mouse(document, 'mouseup', 420, 200);
    expect(parseFloat(cat.style.left)).toBe(l);
    expect(parseFloat(cat.style.top)).toBe(t);
    expect(cat.style.transition).toBe('');
  });
});
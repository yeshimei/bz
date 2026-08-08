/**
 * 手势触发测试（ticket 23 增量）：双击 / 连续三击 / 双指下滑（触屏双触点 + 滚轮兜底）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerGestureListeners } from '../../src/launcher/gestures';

function makeApp() {
  const executed: string[] = [];
  const app: any = {
    commands: {
      executeCommandById: vi.fn((id: string) => {
        executed.push(id);
      }),
    },
  };
  return { app, executed };
}

function fireClick(n = 1) {
  for (let i = 0; i < n; i++) {
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
}

function fireTouch(touches: Array<{ clientY: number }>) {
  // 构造最小 TouchEvent 面（jsdom 无 Touch 构造器，直接派发带 touches 的对象）
  const ev = new Event('touchmove') as any;
  ev.touches = touches.map((t) => ({ clientY: t.clientY }));
  document.dispatchEvent(ev);
}

describe('手势触发', () => {
  let unregister: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (unregister) {
      unregister();
      unregister = null;
    }
  });

  it('双击 → 执行绑定命令', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, { gestureDoubleTap: 'bz-launcher-open' });
    fireClick(2);
    expect(executed).toEqual(['bz-launcher-open']);
  });

  it('连续三击 → 执行三击绑定命令（不触发双击）', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, {
      gestureDoubleTap: 'double-cmd',
      gestureTripleTap: 'triple-cmd',
    });
    fireClick(3);
    expect(executed).toEqual(['triple-cmd']);
  });

  it('双击+三击都配置：第二击延迟判定，窗口内无第三击才触发双击', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, {
      gestureDoubleTap: 'double-cmd',
      gestureTripleTap: 'triple-cmd',
    });
    vi.useFakeTimers();
    try {
      fireClick(2);
      expect(executed).toEqual([]); // 等待第三击或窗口超时
      vi.advanceTimersByTime(500);
      expect(executed).toEqual(['double-cmd']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('单次点击不触发', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, { gestureDoubleTap: 'bz-launcher-open' });
    fireClick(1);
    expect(executed).toEqual([]);
  });

  it('触发抑制：短时间内连击只触发一次', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, { gestureDoubleTap: 'bz-launcher-open' });
    fireClick(2);
    fireClick(2); // 抑制窗口内 → 不重复触发
    expect(executed).toEqual(['bz-launcher-open']);
  });

  it('off 配置不注册 click 监听（不干扰既有交互）', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, {});
    fireClick(5);
    expect(executed).toEqual([]);
  });

  it('双指下滑（触屏双触点同向下移）→ 执行绑定命令', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, { gestureSwipeDown: 'bz-launcher-open' });
    // touchstart 记录双触点
    const start = new Event('touchstart') as any;
    start.touches = [{ clientY: 100 }, { clientY: 120 }];
    document.dispatchEvent(start);
    // 两指均下移 80px
    fireTouch([{ clientY: 180 }, { clientY: 200 }]);
    expect(executed).toEqual(['bz-launcher-open']);
  });

  it('单指移动不触发双指下滑', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, { gestureSwipeDown: 'bz-launcher-open' });
    const start = new Event('touchstart') as any;
    start.touches = [{ clientY: 100 }, { clientY: 120 }];
    document.dispatchEvent(start);
    const ev = new Event('touchmove') as any;
    ev.touches = [{ clientY: 180 }]; // 只剩一指
    document.dispatchEvent(ev);
    expect(executed).toEqual([]);
  });

  it('双指下滑（触控板滚轮累积兜底）→ 执行绑定命令', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, { gestureSwipeDown: 'bz-launcher-open' });
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 })); // 累积 300 → 触发
    expect(executed).toEqual(['bz-launcher-open']);
  });

  it('滚轮向上滚动不累积（重置）', () => {
    const { app, executed } = makeApp();
    unregister = registerGestureListeners(app, { gestureSwipeDown: 'bz-launcher-open' });
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: -50 })); // 反向 → 清零
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    expect(executed).toEqual([]);
  });

  it('unregister 后不再触发', () => {
    const { app, executed } = makeApp();
    const un = registerGestureListeners(app, { gestureDoubleTap: 'bz-launcher-open' });
    un();
    unregister = null;
    fireClick(2);
    expect(executed).toEqual([]);
  });

  it('命令执行失败不抛错（命令已失效）', () => {
    const app: any = {
      commands: {
        executeCommandById: () => {
          throw new Error('no such command');
        },
      },
    };
    unregister = registerGestureListeners(app, { gestureDoubleTap: 'gone' });
    expect(() => fireClick(2)).not.toThrow();
  });
});

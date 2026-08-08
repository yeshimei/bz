/**
 * 入口页手势触发（ticket 23 增量）：双击 / 连续三击 / 双指下滑 → 执行绑定命令。
 * 全局 document 监听，设置页配置（默认关闭，避免干扰既有交互）。
 * 双指下滑：触屏双触点同向下移（移动端）+ 滚轮累积兜底（触控板双指下滑 = 连续向下滚动）。
 */
export interface GestureSettings {
  /** 双击页面 → 命令 id（'off' 关闭） */
  gestureDoubleTap?: string;
  /** 连续三击页面 → 命令 id（'off' 关闭） */
  gestureTripleTap?: string;
  /** 双指下滑 → 命令 id（'off' 关闭） */
  gestureSwipeDown?: string;
}

/** 两次点击间隔超过该值视为新一轮计数 */
const TAP_WINDOW_MS = 400;
/** 三击判定后触发抑制（防止双击/三击连锁触发） */
const SUPPRESS_MS = 700;
/** 双指下滑：单指位移阈值（px） */
const SWIPE_DIST_PX = 60;
/** 滚轮累积阈值：600ms 内向下滚动累积超过该值视为触控板双指下滑 */
const WHEEL_ACC_PX = 300;
/** 滚轮累积窗口 */
const WHEEL_WINDOW_MS = 600;

function isOff(id?: string): boolean {
  return !id || id === 'off';
}

/**
 * 注册手势监听。返回 unregister（幂等移除）。
 * 事件源：click 计数（双击/三击）、touch 双触点（触屏双指下滑）、wheel 累积（触控板双指下滑）。
 */
export function registerGestureListeners(app: any, config: GestureSettings): () => void {
  const cbs: Array<[EventTarget, string, EventListener]> = [];

  let tapCount = 0;
  let lastTap = 0;
  let lastFire = 0;
  let doubleTimer: number | null = null;

  const fire = (commandId: string): void => {
    const now = Date.now();
    if (now - lastFire < SUPPRESS_MS) return;
    lastFire = now;
    try {
      app.commands.executeCommandById(commandId);
    } catch (e) {
      /* 命令可能已失效 */
    }
  };

  // ---- 双击 / 连续三击（click 计数）----
  const onTap = (e: MouseEvent) => {
    const now = Date.now();
    if (now - lastTap > TAP_WINDOW_MS) tapCount = 0;
    tapCount++;
    lastTap = now;
    if (tapCount >= 3 && !isOff(config.gestureTripleTap)) {
      // 第三击：取消待定的双击，触发三击
      if (doubleTimer !== null) {
        clearTimeout(doubleTimer);
        doubleTimer = null;
      }
      tapCount = 0;
      fire(config.gestureTripleTap as string);
    } else if (tapCount === 2 && !isOff(config.gestureDoubleTap)) {
      if (!isOff(config.gestureTripleTap)) {
        // 同时配置了三击：双击延迟判定（等待窗口内无第三击才触发）
        if (doubleTimer !== null) clearTimeout(doubleTimer);
        doubleTimer = window.setTimeout(() => {
          doubleTimer = null;
          tapCount = 0;
          fire(config.gestureDoubleTap as string);
        }, TAP_WINDOW_MS);
      } else {
        tapCount = 0;
        fire(config.gestureDoubleTap as string);
      }
    }
  };
  if (!isOff(config.gestureDoubleTap) || !isOff(config.gestureTripleTap)) {
    document.addEventListener('click', onTap);
    cbs.push([document, 'click', onTap]);
  }

  // ---- 双指下滑：触屏双触点同向下移 ----
  let pinch: { y1: number; y2: number; active: boolean } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      pinch = { y1: e.touches[0].clientY, y2: e.touches[1].clientY, active: false };
    } else if (e.touches.length === 0) {
      pinch = null;
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!pinch || pinch.active || e.touches.length < 2 || isOff(config.gestureSwipeDown)) return;
    const dy1 = e.touches[0].clientY - pinch.y1;
    const dy2 = e.touches[1].clientY - pinch.y2;
    if (dy1 > SWIPE_DIST_PX && dy2 > SWIPE_DIST_PX) {
      pinch.active = true;
      fire(config.gestureSwipeDown as string);
    }
  };
  const onTouchEnd = () => {
    pinch = null;
  };
  if (!isOff(config.gestureSwipeDown)) {
    document.addEventListener('touchstart', onTouchStart);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
    cbs.push([document, 'touchstart', onTouchStart]);
    cbs.push([document, 'touchmove', onTouchMove]);
    cbs.push([document, 'touchend', onTouchEnd]);
  }

  // ---- 双指下滑：滚轮累积兜底（触控板双指下滑 = 连续向下滚动）----
  let wheelAcc = 0;
  let wheelLast = 0;
  const onWheel = (e: WheelEvent) => {
    if (isOff(config.gestureSwipeDown)) return;
    const now = Date.now();
    if (now - wheelLast > WHEEL_WINDOW_MS) wheelAcc = 0;
    wheelLast = now;
    if (e.deltaY > 0) wheelAcc += e.deltaY;
    else wheelAcc = 0;
    if (wheelAcc >= WHEEL_ACC_PX) {
      wheelAcc = 0;
      fire(config.gestureSwipeDown as string);
    }
  };
  if (!isOff(config.gestureSwipeDown)) {
    document.addEventListener('wheel', onWheel);
    cbs.push([document, 'wheel', onWheel]);
  }

  return () => {
    for (const [target, type, cb] of cbs) {
      target.removeEventListener(type, cb);
    }
    cbs.length = 0;
    tapCount = 0;
    if (doubleTimer !== null) {
      clearTimeout(doubleTimer);
      doubleTimer = null;
    }
    pinch = null;
    wheelAcc = 0;
  };
}

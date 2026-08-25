/**
 * smartcat 状态模块覆盖率补测（原 EventSystem + thinking 计数器 + isPageVisible）：
 * 事件总线 on/off/emit（含处理器抛错隔离）、思考指示器创建/计数、
 * visibilitychange 监听（离开 60s 才允许回程语）与清理幂等。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  eventSystem, isPageVisible, setPageVisible,
  ensureThinkingIndicator, startThinking, stopThinking, stopAllThinking,
  setupVisibilityCheck, __resetVisibilityForTests,
} from '../../src/smartcat/state';

/** 覆写 jsdom 的 document.hidden（实例属性遮蔽原型 getter），返回还原函数 */
function setHidden(hidden: boolean): () => void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  return () => {
    delete (document as any).hidden;
  };
}

function fireVisibility(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  __resetVisibilityForTests();
});

afterEach(() => {
  __resetVisibilityForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('eventSystem 事件总线', () => {
  it('on + emit：回调按订阅顺序收到 data', () => {
    const got: string[] = [];
    const a = (d: any) => got.push(`a:${d}`);
    const b = (d: any) => got.push(`b:${d}`);
    eventSystem.on('cov-evt', a);
    eventSystem.on('cov-evt', b);
    eventSystem.emit('cov-evt', 'x');
    expect(got).toEqual(['a:x', 'b:x']);
    eventSystem.off('cov-evt', a);
    eventSystem.off('cov-evt', b);
  });

  it('off：移除后不再收到；对未注册事件 off 安全', () => {
    const cb = vi.fn();
    eventSystem.on('cov-off', cb);
    eventSystem.off('cov-off', cb);
    eventSystem.emit('cov-off', 1);
    expect(cb).not.toHaveBeenCalled();
    // 未注册事件 off 不抛错
    expect(() => eventSystem.off('cov-none', cb)).not.toThrow();
  });

  it('emit 未订阅事件安全；无 data 也照常派发（undefined 入参）', () => {
    const cb = vi.fn();
    eventSystem.on('cov-und', cb);
    expect(() => eventSystem.emit('cov-nobody')).not.toThrow();
    eventSystem.emit('cov-und');
    expect(cb).toHaveBeenCalledWith(undefined);
    eventSystem.off('cov-und', cb);
  });

  it('某处理器抛错：其余处理器继续执行，错误经 console.error 上报且不外抛', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = () => { throw new Error('boom'); };
    const good = vi.fn();
    eventSystem.on('cov-err', bad);
    eventSystem.on('cov-err', good);
    expect(() => eventSystem.emit('cov-err', 1)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith('[smartcat] 事件处理器错误 (cov-err):', expect.any(Error));
    eventSystem.off('cov-err', bad);
    eventSystem.off('cov-err', good);
  });
});

describe('页面可见性状态', () => {
  it('jsdom 默认可见；setPageVisible 可切换（导出为活绑定）', () => {
    expect(isPageVisible).toBe(true);
    setPageVisible(false);
    expect(isPageVisible).toBe(false);
    setPageVisible(true);
    expect(isPageVisible).toBe(true);
  });
});

describe('thinking 思考计数与指示器', () => {
  it('ensureThinkingIndicator：有容器时创建 #thinking-indicator 且类名齐全', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    ensureThinkingIndicator(container);
    const el = document.getElementById('thinking-indicator');
    expect(el).not.toBeNull();
    expect(el!.className).toBe('thinking-indicator bz-sc-thinking');
    expect(el!.parentElement).toBe(container);
  });

  it('ensureThinkingIndicator：已连接时幂等复用，不重复创建', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    ensureThinkingIndicator(container);
    const first = document.getElementById('thinking-indicator')!;
    ensureThinkingIndicator(container);
    ensureThinkingIndicator(null);
    expect(document.querySelectorAll('#thinking-indicator').length).toBe(1);
    expect(document.getElementById('thinking-indicator')).toBe(first);
  });

  it('ensureThinkingIndicator：DOM 已有同 id 元素（无容器）→ 复用既有节点', () => {
    const existing = document.createElement('div');
    existing.id = 'thinking-indicator';
    document.body.appendChild(existing);
    ensureThinkingIndicator(null);
    expect(document.getElementById('thinking-indicator')).toBe(existing);
  });

  it('startThinking：无容器且无元素 → 只计数不建节点不抛错', () => {
    expect(() => startThinking()).not.toThrow();
    expect(document.getElementById('thinking-indicator')).toBeNull();
    stopAllThinking();
  });

  it('startThinking/stopThinking 嵌套计数：归零才移除 active，不为负', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    ensureThinkingIndicator(container);
    const el = document.getElementById('thinking-indicator')!;
    startThinking();
    startThinking();
    expect(el.classList.contains('active')).toBe(true);
    stopThinking();
    expect(el.classList.contains('active')).toBe(true); // 还剩 1 层
    stopThinking();
    expect(el.classList.contains('active')).toBe(false); // 归零移除
    // 多余的 stop 钳位 0，不再误触
    stopThinking();
    expect(el.classList.contains('active')).toBe(false);
  });

  it('stopAllThinking：无论嵌套多少层一律清零并移除 active', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    ensureThinkingIndicator(container);
    const el = document.getElementById('thinking-indicator')!;
    startThinking();
    startThinking();
    startThinking();
    stopAllThinking();
    expect(el.classList.contains('active')).toBe(false);
  });

  it('startThinking 在指示器就绪后补挂 active（先计数后建节点的顺序兜底）', () => {
    // 先无容器 startThinking（仅计数），再建指示器，再次 startThinking → active 出现
    startThinking();
    const container = document.createElement('div');
    document.body.appendChild(container);
    ensureThinkingIndicator(container);
    startThinking();
    const el = document.getElementById('thinking-indicator')!;
    expect(el.classList.contains('active')).toBe(true);
    stopAllThinking();
  });
});

describe('setupVisibilityCheck（离开 60s 才允许回程语）', () => {
  let restoreHidden: () => void;
  afterEach(() => { restoreHidden?.(); });

  it('离开 <60s 回来：不触发 onLeaveLong 也不触发 onBack，isPageVisible 跟随切换', () => {
    restoreHidden = setHidden(true);
    const onLeaveLong = vi.fn();
    const onBack = vi.fn();
    setupVisibilityCheck({ onLeaveLong, onBack });
    fireVisibility();
    expect(isPageVisible).toBe(false);
    vi.advanceTimersByTime(59_999);
    restoreHidden();
    fireVisibility();
    expect(isPageVisible).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(onLeaveLong).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('离开 ≥60s：onLeaveLong 恰一次；回来触发 onBack 并复位允许位', () => {
    restoreHidden = setHidden(true);
    const onLeaveLong = vi.fn();
    const onBack = vi.fn();
    setupVisibilityCheck({ onLeaveLong, onBack });
    fireVisibility();
    vi.advanceTimersByTime(60_000);
    expect(onLeaveLong).toHaveBeenCalledTimes(1);
    restoreHidden();
    fireVisibility();
    expect(onBack).toHaveBeenCalledTimes(1);
    // 再次可见性抖动（未再长时间离开）→ 不再 onBack
    setHidden(true);
    fireVisibility();
    vi.advanceTimersByTime(10_000);
    restoreHidden();
    fireVisibility();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('离开期间反复切换：回程计时被重置（隐藏中再隐藏不清残留定时器语义）', () => {
    restoreHidden = setHidden(true);
    const onLeaveLong = vi.fn();
    const onBack = vi.fn();
    setupVisibilityCheck({ onLeaveLong, onBack });
    fireVisibility();
    vi.advanceTimersByTime(30_000);
    // 可见一下又隐藏：第一段 30s 计时应被清掉
    restoreHidden();
    fireVisibility();
    setHidden(true);
    fireVisibility();
    vi.advanceTimersByTime(31_000); // 若旧计时未清此刻应已触发
    expect(onLeaveLong).not.toHaveBeenCalled();
    vi.advanceTimersByTime(29_000); // 新计时的第 60s
    expect(onLeaveLong).toHaveBeenCalledTimes(1);
    restoreHidden();
    fireVisibility();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('cleanup 后：监听摘除、定时器清空，切换可见性完全静默', () => {
    restoreHidden = setHidden(true);
    const onLeaveLong = vi.fn();
    const onBack = vi.fn();
    const cleanup = setupVisibilityCheck({ onLeaveLong, onBack });
    cleanup();
    fireVisibility();
    vi.advanceTimersByTime(120_000);
    restoreHidden();
    fireVisibility();
    expect(onLeaveLong).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    expect(isPageVisible).toBe(true); // 处理器已摘除，状态不被改写
  });

  it('重复注册：旧监听被先清理（幂等），仅新处理器生效', () => {
    restoreHidden = setHidden(true);
    const oldLeave = vi.fn();
    const newLeave = vi.fn();
    setupVisibilityCheck({ onLeaveLong: oldLeave, onBack: () => {} });
    setupVisibilityCheck({ onLeaveLong: newLeave, onBack: () => {} });
    fireVisibility();
    vi.advanceTimersByTime(60_000);
    expect(oldLeave).not.toHaveBeenCalled();
    expect(newLeave).toHaveBeenCalledTimes(1);
  });
});

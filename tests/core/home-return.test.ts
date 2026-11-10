/**
 * 从首页进入、关闭后回首页（core/home-return）测试。
 * 覆盖 2026-11-10 用户拍板（GitHub issue #2 的补充答复）：
 *  - 从首页进入后，功能主面板关闭 → 回首页回调被调一次；
 *  - 直接打开功能（未上膛）→ 关闭不回调；
 *  - 关闭后马上打开另一个主面板（影院 → 分析特刊）→ 不回，等新的关掉；
 *  - 只开弹窗的会话 → notifyFloatClosed 才回。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { armHomeReturn, disarmHomeReturn, isHomeReturnArmed, notifyFloatClosed } from '../../src/core/home-return';
import { MAIN_PANEL_CLASS } from '../../src/core/ui/main-panel';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function panel(): HTMLElement {
  const el = document.createElement('div');
  el.className = `bz-panel-overlay-main ${MAIN_PANEL_CLASS}`;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  disarmHomeReturn();
});

afterEach(() => {
  disarmHomeReturn();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('首页返回总线', () => {
  it('功能主面板关闭 → 回调一次并下膛', async () => {
    const open = vi.fn();
    armHomeReturn(open);
    const p = panel();
    expect(isHomeReturnArmed()).toBe(true);
    await wait(60);
    p.remove();
    await wait(260);
    expect(open).toHaveBeenCalledTimes(1);
    expect(isHomeReturnArmed()).toBe(false);
  });

  it('未上膛时主面板开关不触发（直接打开功能的场景）', async () => {
    const open = vi.fn();
    const p = panel();
    await wait(60);
    p.remove();
    await wait(260);
    expect(open).not.toHaveBeenCalled();
  });

  it('关一个、马上开下一个：不误回首页，等新的也关掉才回', async () => {
    const open = vi.fn();
    armHomeReturn(open);
    const first = panel();
    await wait(60);
    first.remove();
    const second = panel(); // 影院面板关掉 → 分析特刊打开
    await wait(260);
    expect(open).not.toHaveBeenCalled();
    second.remove();
    await wait(260);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('只开弹窗的会话：notifyFloatClosed 时才回首页', async () => {
    const open = vi.fn();
    armHomeReturn(open);
    await wait(1400); // 过宽限期：本次不是主面板
    expect(open).not.toHaveBeenCalled();
    notifyFloatClosed();
    await wait(300);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('主面板还开着时的弹窗关闭不回首页', async () => {
    const open = vi.fn();
    armHomeReturn(open);
    const p = panel();
    await wait(60);
    notifyFloatClosed();
    await wait(300);
    expect(open).not.toHaveBeenCalled();
    expect(isHomeReturnArmed()).toBe(true);
    p.remove();
    await wait(260);
    expect(open).toHaveBeenCalledTimes(1);
  });
});

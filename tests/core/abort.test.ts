// @vitest-environment node
/**
 * 取消原语测试（issue 428）：AbortError 判定 / 同步检查点 / 内外 signal 合流与解绑。
 * 语义锚点：取消与超时是两种中断，判定只看 name（不依赖 DOMException），
 * 且合流解绑后外层再 abort 不得影响内层（防长寿命 signal 攒监听）。
 */
import { describe, it, expect, vi } from 'vitest';
import { abortError, isAbortError, linkAbort, throwIfAborted } from '../../src/core/abort';

describe('abort 原语（issue 428）', () => {
  it('abortError 带 AbortError 名；isAbortError 只认它（普通 Error 与空值不误判）', () => {
    const e = abortError();
    expect(e.name).toBe('AbortError');
    expect(isAbortError(e)).toBe(true);
    expect(isAbortError(new Error('普通错误'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });

  it('throwIfAborted：未取消不抛；已取消抛 AbortError；无 signal 安全', () => {
    expect(() => throwIfAborted()).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
    const ac = new AbortController();
    ac.abort();
    expect(() => throwIfAborted(ac.signal)).toThrowError(/请求已中断/);
    try {
      throwIfAborted(ac.signal);
    } catch (e) {
      expect(isAbortError(e)).toBe(true);
    }
  });

  it('linkAbort：外层 abort 中断内层；解绑后外层再 abort 不再影响内层', () => {
    const outer = new AbortController();
    const inner = new AbortController();
    const unlink = linkAbort(outer.signal, inner);
    outer.abort();
    expect(inner.signal.aborted).toBe(true);

    const outer2 = new AbortController();
    const inner2 = new AbortController();
    const unlink2 = linkAbort(outer2.signal, inner2);
    unlink2();
    outer2.abort();
    expect(inner2.signal.aborted).toBe(false);
    unlink(); // 幂等：重复解绑不抛
  });

  it('linkAbort：外层已取消 → 立刻中断内层；无外层 signal → 空解绑且不报错', () => {
    const outer = new AbortController();
    outer.abort();
    const inner = new AbortController();
    linkAbort(outer.signal, inner);
    expect(inner.signal.aborted).toBe(true);

    const inner2 = new AbortController();
    const unlink = linkAbort(undefined, inner2);
    expect(inner2.signal.aborted).toBe(false);
    expect(() => unlink()).not.toThrow();
  });

  it('linkAbort 不干扰内层自身的中断（超时定时器路径）', () => {
    const outer = new AbortController();
    const inner = new AbortController();
    const addSpy = vi.spyOn(outer.signal, 'addEventListener');
    linkAbort(outer.signal, inner);
    expect(addSpy).toHaveBeenCalledTimes(1);
    inner.abort(); // 内层超时：外层不受影响
    expect(outer.signal.aborted).toBe(false);
  });
});

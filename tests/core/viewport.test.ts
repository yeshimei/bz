/**
 * core/viewport 测试（架#5 测试缺口）：--bz-vvh 视口同步模块生命周期语义——
 * - bindMobileViewport 幂等：重复 bind 只挂一组 window 监听（spy 计数），返回同一解绑器；
 * - unbind 后 documentElement 无 --bz-vvh，且可重新 bind 恢复写入（卸载重启用语义）；
 * - syncMobileViewport：innerHeight < 120（MIN_VVH）异常帧不写变量，正常值写整数 px；
 * - jsdom 无 visualViewport：走 window resize 兜底分支不抛错。
 * jsdom 未实现 visualViewport：stub 置 undefined 固定走兜底（vv 侧挂载点为 no-op），
 * innerHeight 经 stubGlobal 注入（jsdom 原生只读）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bindMobileViewport, unbindMobileViewport, syncMobileViewport, VVH_VAR } from '../../src/core/viewport';

/** 当前 :root 上的 --bz-vvh 值（未写为空串） */
const vvh = (): string => document.documentElement.style.getPropertyValue(VVH_VAR);

beforeEach(() => {
  vi.stubGlobal('visualViewport', undefined); // 固定「无 visualViewport」环境
  vi.stubGlobal('innerHeight', 800);
});

afterEach(() => {
  unbindMobileViewport(); // 模块单例 cleanup：用例末统一解绑防串扰
  document.documentElement.style.removeProperty(VVH_VAR);
  vi.unstubAllGlobals();
});

describe('bindMobileViewport 幂等', () => {
  it('重复 bind 只挂一组 window 监听，返回同一解绑器', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const before = addSpy.mock.calls.length;

    const unbind1 = bindMobileViewport();
    const firstCount = addSpy.mock.calls.length - before;
    expect(firstCount).toBe(2); // window resize + orientationchange（vv 侧无 visualViewport → no-op）

    const unbind2 = bindMobileViewport();
    expect(unbind2).toBe(unbind1); // 幂等：同一解绑器，不叠加第二组监听
    expect(addSpy.mock.calls.length - before).toBe(firstCount);
  });

  it('unbind 后 documentElement 无 --bz-vvh，且可重新 bind 恢复写入', () => {
    vi.stubGlobal('innerHeight', 800);
    bindMobileViewport();
    expect(vvh()).toBe('800px');

    unbindMobileViewport();
    expect(vvh()).toBe(''); // 解绑即清变量

    vi.stubGlobal('innerHeight', 640);
    bindMobileViewport(); // 重 bind 可恢复（cleanup 复位后重新挂载）
    expect(vvh()).toBe('640px');
  });
});

describe('syncMobileViewport', () => {
  it('innerHeight < 120（MIN_VVH）不写变量（异常帧忽略）；正常值写整数 px', () => {
    document.documentElement.style.removeProperty(VVH_VAR);
    vi.stubGlobal('innerHeight', 100);
    syncMobileViewport();
    expect(vvh()).toBe(''); // 低于 MIN_VVH 的异常帧忽略

    vi.stubGlobal('innerHeight', 512.4);
    syncMobileViewport();
    expect(vvh()).toBe('512px'); // Math.round 整数 + px 单位（可被 calc 消费）
  });

  it('jsdom 无 visualViewport：window resize 兜底同步不抛错', () => {
    expect(window.visualViewport).toBeUndefined();
    bindMobileViewport();
    vi.stubGlobal('innerHeight', 640);
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
    expect(vvh()).toBe('640px'); // 兜底监听生效
  });
});

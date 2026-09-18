/**
 * esc-manager 回归测试（ticket P1-30 双触发 + N1 软关/重启用）：
 * 命中可见层后 stopImmediatePropagation —— 同 document 上其余 keydown 监听不再响应同一次 ESC；
 * 未命中（无可见层）时不拦截，后续监听正常触发。
 * N1（旧账）：destroy 改软关（disabled 旗标），arm 重挂——「禁用→再启用」后 ESC 处理恢复。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { escManager } from '../../src/core/esc-manager';

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

describe('esc-manager（P1-30 双触发回归）', () => {
  const handles: ReturnType<typeof escManager.register>[] = [];
  const privates: (() => void)[] = [];

  afterEach(() => {
    while (handles.length) handles.pop()!.unregister();
    while (privates.length) privates.pop()!();
    escManager.arm(); // N1：destroy 是软关旗标——本组用例 destroy 后必须恢复，防串扰后续用例
  });

  it('命中可见层：close 后同节点第二个监听不触发（stopImmediatePropagation）', () => {
    let closed = false;
    handles.push(escManager.register('t1-layer', { isVisible: () => !closed, close: () => { closed = true; } }));
    // 私挂监听：注册序晚于 escManager 的全局监听
    let privateFired = false;
    const onPrivate = () => { privateFired = true; };
    document.addEventListener('keydown', onPrivate);
    privates.push(() => document.removeEventListener('keydown', onPrivate));

    pressEscape();

    expect(closed).toBe(true);
    expect(privateFired).toBe(false);
  });

  it('未命中（无可见层）：第二个监听正常触发，不被拦截', () => {
    let closed = false;
    // 层不可见：isVisible false → escManager 不处理、不拦截
    handles.push(escManager.register('t2-layer-hidden', { isVisible: () => false, close: () => { closed = true; } }));
    let privateFired = false;
    const onPrivate = () => { privateFired = true; };
    document.addEventListener('keydown', onPrivate);
    privates.push(() => document.removeEventListener('keydown', onPrivate));

    pressEscape();

    expect(closed).toBe(false);
    expect(privateFired).toBe(true);
  });

  it('非 ESC 按键不拦截：第二个监听正常触发', () => {
    let closed = false;
    handles.push(escManager.register('t3-layer', { isVisible: () => !closed, close: () => { closed = true; } }));
    let privateFired = false;
    const onPrivate = (e: KeyboardEvent) => { if (e.key === 'Enter') privateFired = true; };
    document.addEventListener('keydown', onPrivate);
    privates.push(() => document.removeEventListener('keydown', onPrivate));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(closed).toBe(false);
    expect(privateFired).toBe(true);
  });
});

describe('esc-manager N1 软关/重启用回归', () => {
  const handles: ReturnType<typeof escManager.register>[] = [];

  afterEach(() => {
    while (handles.length) handles.pop()!.unregister();
    escManager.arm(); // 无论用例走到哪一步，组末恢复 ESC 处理
  });

  it('destroy 后 ESC 不响应：可见层不关（软关旗标短路，监听仍在但不处理）', () => {
    let closed = false;
    handles.push(escManager.register('n1-layer', { isVisible: () => !closed, close: () => { closed = true; } }));

    escManager.destroy();
    pressEscape();

    expect(closed).toBe(false);
  });

  it('destroy → arm 后 ESC 处理恢复工作（禁用→再启用场景）', () => {
    let closed = false;
    handles.push(escManager.register('n1-layer-rearm', { isVisible: () => !closed, close: () => { closed = true; } }));

    escManager.destroy();
    pressEscape();
    expect(closed).toBe(false); // 软关期间不处理

    escManager.arm();
    pressEscape();
    expect(closed).toBe(true); // 重启用后恢复
  });

  it('destroy 不清 layers：重启用后旧层仍在（isVisible 判活自愈），arm 幂等可重复调', () => {
    let closed = false;
    const h = escManager.register('n1-layer-keep', { isVisible: () => !closed, close: () => { closed = true; } });
    handles.push(h);

    escManager.destroy();
    escManager.arm();
    escManager.arm(); // 幂等：重复 arm 不抛错、语义不变
    pressEscape();
    expect(closed).toBe(true);
  });
});

/**
 * esc-manager 回归测试（ticket P1-30 双触发）：
 * 命中可见层后 stopImmediatePropagation —— 同 document 上其余 keydown 监听不再响应同一次 ESC；
 * 未命中（无可见层）时不拦截，后续监听正常触发。
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

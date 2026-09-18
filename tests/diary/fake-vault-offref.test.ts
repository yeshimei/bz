/**
 * 原型假层 FakeVault.offref 回归（diary 深查 A7，ADR-0122）：
 * 替身语义与宿主 Vault.offref 逐条对齐——按 ref 摘单个监听，不清空整表
 * （旧实现 listeners.clear() 会掩盖原型端的重复订阅泄漏）。
 */
import { describe, it, expect } from 'vitest';
import { FakeVault } from '../../prototypes/diary/fake/fake-obsidian';

describe('FakeVault offref（宿主同语义：按 ref 摘单个监听）', () => {
  it('offref 只摘对应 ref 的回调，其余监听不受影响', () => {
    const vault = new FakeVault();
    const seen: string[] = [];
    const r1 = vault.on('modify', () => seen.push('a'));
    const r2 = vault.on('modify', () => seen.push('b'));
    const r3 = vault.on('rename', () => seen.push('r'));

    vault.offref(r1);
    (vault as any).emit('modify', { path: 'x.md' });
    expect(seen).toEqual(['b']); // 只有 r2 的回调还在，r1 已摘、r3（rename）不串道

    vault.offref(r3);
    (vault as any).emit('rename', { path: 'y.md' });
    expect(seen).toEqual(['b']); // rename 监听已摘

    // 同一 ref 重复 offref 幂等，不误伤其他监听
    vault.offref(r1);
    (vault as any).emit('modify', { path: 'z.md' });
    expect(seen).toEqual(['b', 'b']);

    // r2 仍可单独摘除
    vault.offref(r2);
    (vault as any).emit('modify', { path: 'w.md' });
    expect(seen).toEqual(['b', 'b']);
  });

  it('on 返回携带数值 ref 的 EventRef 形状（与 core/app 消费方兼容）', () => {
    const vault = new FakeVault();
    const ref = vault.on('modify', () => {});
    expect(typeof (ref as any).ref).toBe('number');
  });
});

/**
 * 域事件总线测试：同步扇出顺序、退订幂等、handler 抛错隔离、通道隔离、clearDomainEvents。
 * 总线是模块级单例，每个用例后 clearDomainEvents 清场防串扰。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitDomainEvent, onDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';

afterEach(() => {
  clearDomainEvents();
});

describe('emitDomainEvent / onDomainEvent', () => {
  it('同步扇出：同通道多个 handler 按订阅顺序各收到一次事件', () => {
    const got: string[] = [];
    onDomainEvent<string>('test:order', (e) => got.push('a:' + e));
    onDomainEvent<string>('test:order', (e) => got.push('b:' + e));
    onDomainEvent<string>('test:order', (e) => got.push('c:' + e));
    emitDomainEvent('test:order', 'x');
    expect(got).toEqual(['a:x', 'b:x', 'c:x']);
  });

  it('通道隔离：不同通道订阅互不影响，事件只达本通道 handler', () => {
    const a = vi.fn();
    const b = vi.fn();
    onDomainEvent('test:iso-a', a);
    onDomainEvent('test:iso-b', b);
    emitDomainEvent('test:iso-a', { n: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith({ n: 1 });
    expect(b).not.toHaveBeenCalled();
  });

  it('退订后不再收到事件；同通道其他 handler 不受影响', () => {
    const kept = vi.fn();
    const gone = vi.fn();
    onDomainEvent('test:off', kept);
    const off = onDomainEvent('test:off', gone);
    off();
    emitDomainEvent('test:off', {});
    expect(kept).toHaveBeenCalledTimes(1);
    expect(gone).not.toHaveBeenCalled();
  });

  it('退订函数幂等：重复调用安全不抛错，也不影响重新订阅的新 handler', () => {
    const h1 = vi.fn();
    const off = onDomainEvent('test:idem', h1);
    expect(() => {
      off();
      off();
      off();
    }).not.toThrow();
    // 旧通道被回收后仍可重建订阅（空集合清理不破坏后续订阅）
    const h2 = vi.fn();
    onDomainEvent('test:idem', h2);
    emitDomainEvent('test:idem', {});
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('handler 抛错被隔离：后续 handler 照常收到、派发方不抛、console.error 记录一次', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const got: string[] = [];
      onDomainEvent('test:err', () => {
        throw new Error('boom');
      });
      onDomainEvent<string>('test:err', (e) => got.push(e));
      expect(() => emitDomainEvent('test:err', 'ok')).not.toThrow();
      expect(got).toEqual(['ok']);
      expect(errSpy).toHaveBeenCalledTimes(1);
    } finally {
      errSpy.mockRestore();
    }
  });

  it('扇出按本轮开始时的快照：中途退订者本轮仍收到、新订阅者下轮才生效', () => {
    const got: string[] = [];
    let offB: () => void = () => {};
    onDomainEvent<string>('test:snap', (e) => {
      got.push('a:' + e);
      offB(); // A 执行时退订 B
      onDomainEvent<string>('test:snap', (e2) => got.push('d:' + e2)); // 并新增 D
    });
    offB = onDomainEvent<string>('test:snap', (e) => got.push('b:' + e));
    emitDomainEvent('test:snap', '1'); // 本轮快照 [A,B]
    emitDomainEvent('test:snap', '2'); // 第二轮 [A,D]
    expect(got).toEqual(['a:1', 'b:1', 'a:2', 'd:2']);
  });

  it('无订阅者时派发为空操作不抛错', () => {
    expect(() => emitDomainEvent('test:none', { any: true })).not.toThrow();
  });
});

describe('clearDomainEvents', () => {
  it('清空全部订阅：所有通道 handler 失效；之后可重新订阅', () => {
    const a = vi.fn();
    const b = vi.fn();
    onDomainEvent('test:clear-a', a);
    onDomainEvent('test:clear-b', b);
    clearDomainEvents();
    emitDomainEvent('test:clear-a', {});
    emitDomainEvent('test:clear-b', {});
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    const c = vi.fn();
    onDomainEvent('test:clear-a', c);
    emitDomainEvent('test:clear-a', {});
    expect(c).toHaveBeenCalledTimes(1);
  });
});

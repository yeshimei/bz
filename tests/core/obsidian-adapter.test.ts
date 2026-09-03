/**
 * vault 事件适配器测试：伪造 app={vault:{on}} 捕获回调并手动触发，断言
 * 通用 + 语义两路事件与载荷、非 md 忽略、delete 失效对象只用 path、幂等挂载/摘除、
 * rename 三分支（同域内/跨域/移入域/移出域）只发一条 renamed 且 movedOut 判定正确。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachObsidianAdapter, detachObsidianAdapter } from '../../src/core/obsidian-adapter';
import { onDomainEvent, clearDomainEvents, emitDomainEvent } from '../../src/core/domain-bus';
import { setSettingsProvider } from '../../src/core/settings-provider';

/** 伪造 vault：捕获 vault.on 回调，fire 手动触发；offref 按真实语义移除监听（对齐 mock-vault.ts 事件替身风格） */
function makeFakeVault() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  return {
    listeners,
    on(name: string, cb: (...args: any[]) => void): any {
      (listeners[name] ||= []).push(cb);
      return { event: name, cb }; // Obsidian 事件引用替身
    },
    offref(ref: any): void {
      if (!ref || !ref.event) return;
      const arr = listeners[ref.event] || [];
      const idx = arr.indexOf(ref.cb);
      if (idx >= 0) arr.splice(idx, 1);
    },
    fire(name: string, ...args: any[]): void {
      for (const cb of [...(listeners[name] || [])]) cb(...args);
    },
  };
}

/** 批量订阅通道并记录收到的（channel, evt），供两路派发断言 */
function record(...channels: string[]) {
  const got: Array<{ channel: string; evt: any }> = [];
  const offs = channels.map((c) => onDomainEvent<any>(c, (evt) => got.push({ channel: c, evt })));
  return {
    got,
    names: () => got.map((g) => g.channel),
    payloadsOf: (channel: string) => got.filter((g) => g.channel === channel).map((g) => g.evt),
    stop: () => offs.forEach((off) => off()),
  };
}

describe('obsidian-adapter', () => {
  let vault: ReturnType<typeof makeFakeVault>;

  beforeEach(() => {
    clearDomainEvents();
    detachObsidianAdapter();
    setSettingsProvider(() => ({}) as any); // 空设置：分类走内置默认目录
    vault = makeFakeVault();
  });

  afterEach(() => {
    detachObsidianAdapter();
    clearDomainEvents();
    setSettingsProvider(() => ({}) as any);
  });

  it('create：md 文件恒发通用兜底事件，命中日记目录另发语义事件且附带 date', () => {
    const rec = record('vault:md-created', 'diary:file-created', 'flash:file-created');
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('create', { path: '我的/日记/2026-08-23.md', extension: 'md' });
    expect(rec.payloadsOf('vault:md-created')).toEqual([{ path: '我的/日记/2026-08-23.md' }]);
    expect(rec.payloadsOf('diary:file-created')).toEqual([
      { path: '我的/日记/2026-08-23.md', date: '2026-08-23' },
    ]);
    expect(rec.names()).toHaveLength(2); // 无多余事件
    rec.stop();
  });

  it('modify/delete：通用 + 语义两路；delete 失效对象只用 path；非日期命名的日记省略 date 字段', () => {
    const rec = record(
      'vault:md-modified',
      'flash:file-modified',
      'vault:md-deleted',
      'cinema:file-deleted',
      'vault:md-created',
      'diary:file-created'
    );
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('modify', { path: '卡片盒/TDD.md', extension: 'md' });
    expect(rec.payloadsOf('vault:md-modified')).toEqual([{ path: '卡片盒/TDD.md' }]);
    expect(rec.payloadsOf('flash:file-modified')).toEqual([{ path: '卡片盒/TDD.md' }]);
    expect('date' in rec.payloadsOf('flash:file-modified')[0]).toBe(false); // 仅 diary 附带 date

    vault.fire('delete', { path: '我的/影视/《a》观后感.md' }); // delete 失效对象：无 extension，只用 path
    expect(rec.payloadsOf('vault:md-deleted')).toEqual([{ path: '我的/影视/《a》观后感.md' }]);
    // ADR-0087：影视目录归 cinema（旧 movie:file-* 通道退役）
    expect(rec.payloadsOf('cinema:file-deleted')).toEqual([{ path: '我的/影视/《a》观后感.md' }]);

    vault.fire('create', { path: '我的/日记/随笔.md', extension: 'md' }); // 日记但非日期命名 → date 字段整个省略
    expect(rec.payloadsOf('diary:file-created')).toEqual([{ path: '我的/日记/随笔.md' }]);
    rec.stop();
  });

  it('未命中域的 md 只发通用兜底事件；非 md 事件完全忽略', () => {
    const rec = record('vault:md-created', 'vault:md-modified', 'diary:file-created');
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('create', { path: '随手记/x.md', extension: 'md' });
    expect(rec.names()).toEqual(['vault:md-created']);
    vault.fire('create', { path: '附件/a.png', extension: 'png' });
    vault.fire('modify', { path: '附件/b.pdf', extension: 'pdf' });
    vault.fire('delete', { path: '附件/c.png' });
    expect(rec.names()).toEqual(['vault:md-created']); // 非 md 零派发
    rec.stop();
  });

  it('rename 同域内：只发 renamed 一条（不补 created/deleted），movedOut=false', () => {
    const rec = record(
      'vault:md-renamed',
      'flash:file-renamed',
      'flash:file-created',
      'flash:file-deleted'
    );
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('rename', { path: '卡片盒/b.md', extension: 'md' }, '卡片盒/a.md');
    expect(rec.payloadsOf('vault:md-renamed')).toEqual([
      { oldPath: '卡片盒/a.md', newPath: '卡片盒/b.md' },
    ]);
    expect(rec.payloadsOf('flash:file-renamed')).toEqual([
      { oldPath: '卡片盒/a.md', newPath: '卡片盒/b.md', movedOut: false },
    ]);
    expect('date' in rec.payloadsOf('flash:file-renamed')[0]).toBe(false);
    expect(rec.names()).toHaveLength(2); // 未补发 created/deleted
    rec.stop();
  });

  it('rename 跨域/移入域：语义事件挂新路径域，movedOut=true', () => {
    const rec = record('poem:file-renamed', 'clipping:file-renamed');
    attachObsidianAdapter({ vault }, vi.fn());
    // 信 → 现代诗（跨域）
    vault.fire('rename', { path: '我的/现代诗/a.md', extension: 'md' }, '我的/信/a.md');
    // 未分类 → 剪藏（移入域，旧无新有）
    vault.fire('rename', { path: '归档/网页剪藏/c.md', extension: 'md' }, '随手记/c.md');
    expect(rec.payloadsOf('poem:file-renamed')).toEqual([
      { oldPath: '我的/信/a.md', newPath: '我的/现代诗/a.md', movedOut: true },
    ]);
    expect(rec.payloadsOf('clipping:file-renamed')).toEqual([
      { oldPath: '随手记/c.md', newPath: '归档/网页剪藏/c.md', movedOut: true },
    ]);
    rec.stop();
  });

  it('rename 移出域（旧有新无）：新路径未命中域，语义事件不派发仅剩通用兜底', () => {
    const semanticNames = [
      'flash:file-renamed',
      'diary:file-renamed',
      'poem:file-renamed',
      'letter:file-renamed',
      'cinema:file-renamed',
      'clipping:file-renamed',
    ];
    const rec = record('vault:md-renamed', ...semanticNames);
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('rename', { path: '随手记/d.md', extension: 'md' }, '卡片盒/d.md');
    expect(rec.names()).toEqual(['vault:md-renamed']);
    rec.stop();
  });

  it('rename 到日记目录：语义事件附带新路径日期', () => {
    const rec = record('diary:file-renamed');
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('rename', { path: '我的/日记/2026-01-03.md', extension: 'md' }, '我的/日记/2026-01-02.md');
    expect(rec.payloadsOf('diary:file-renamed')).toEqual([
      { oldPath: '我的/日记/2026-01-02.md', newPath: '我的/日记/2026-01-03.md', movedOut: false, date: '2026-01-03' },
    ]);
    rec.stop();
  });

  it('rename 非 md 完全忽略', () => {
    const rec = record('vault:md-renamed', 'flash:file-renamed');
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('rename', { path: '附件/e.png', extension: 'png' }, '附件/f.png');
    expect(rec.got).toHaveLength(0);
    rec.stop();
  });

  it('幂等挂载：重复 attach 每个 vault 事件只注册一次，registerRef 恰好收到全部引用', () => {
    const registerRef = vi.fn();
    attachObsidianAdapter({ vault }, registerRef);
    attachObsidianAdapter({ vault }, registerRef);
    attachObsidianAdapter({ vault }, registerRef);
    expect(vault.listeners['create']).toHaveLength(1);
    expect(vault.listeners['modify']).toHaveLength(1);
    expect(vault.listeners['delete']).toHaveLength(1);
    expect(vault.listeners['rename']).toHaveLength(1);
    expect(registerRef).toHaveBeenCalledTimes(4);
    // 不传 registerRef 也可挂载
    expect(() => attachObsidianAdapter({ vault })).not.toThrow();
  });

  it('detach 后事件不再派发（offref 移除监听）；可重新挂载恢复；未挂载时 detach 幂等安全', () => {
    const rec = record('vault:md-created');
    attachObsidianAdapter({ vault }, vi.fn());
    expect(() => detachObsidianAdapter()).not.toThrow();
    expect(() => detachObsidianAdapter()).not.toThrow(); // 幂等
    vault.fire('create', { path: '卡片盒/x.md', extension: 'md' });
    expect(rec.got).toHaveLength(0);
    attachObsidianAdapter({ vault }, vi.fn()); // 重新挂载恢复
    vault.fire('create', { path: '卡片盒/y.md', extension: 'md' });
    expect(rec.got).toHaveLength(1);
    rec.stop();
  });

  it('异常宿主（app 无 vault / vault.on 缺失）：静默不挂载，后续 attach 可重试', () => {
    expect(() => attachObsidianAdapter({}, vi.fn())).not.toThrow();
    expect(() => attachObsidianAdapter({ vault: {} }, vi.fn())).not.toThrow();
    // 重试成功：换上正常 vault 后照常工作
    const rec = record('vault:md-created');
    attachObsidianAdapter({ vault }, vi.fn());
    vault.fire('create', { path: '卡片盒/z.md', extension: 'md' });
    expect(rec.got).toHaveLength(1);
    rec.stop();
  });

  it('总线扇出经适配器全链路：emitDomainEvent 的错误隔离不影响适配器回调', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const got: string[] = [];
      onDomainEvent<string>('vault:md-created', () => {
        throw new Error('坏订阅方');
      });
      onDomainEvent<any>('vault:md-created', (e) => got.push(e.path));
      attachObsidianAdapter({ vault }, vi.fn());
      expect(() => vault.fire('create', { path: '卡片盒/w.md', extension: 'md' })).not.toThrow();
      expect(got).toEqual(['卡片盒/w.md']);
    } finally {
      errSpy.mockRestore();
    }
  });
});

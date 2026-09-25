// @vitest-environment node
/**
 * 自动关联测试（2026-09-19 机制审计 M8）。
 * 背景：`enableAutoLinking` / `linkWindowDays` 原为「用户可见的假开关」——有设置项、
 * 有默认值、有描述文案，但唯一实现零调用点，拨了什么都不发生。本次接线后补测试钉住行为。
 * 口径：同实体（structured.entityType + name 均非空且相等）、窗口内、双向、幂等、单侧上限。
 */
import { describe, it, expect } from 'vitest';
import { linkRelatedMemories, linkedSnippetOf, AUTO_LINK_CAP } from '../../src/smartcat/memory';
import type { MemoryStreamEntry } from '../../src/smartcat/types';

function entry(id: string, entityType?: string, name?: string, createdDaysAgo = 0): MemoryStreamEntry {
  return {
    id,
    created: new Date(Date.now() - createdDaysAgo * 86400000).toISOString(),
    lastAccessed: new Date().toISOString(),
    description: `desc-${id}`,
    importance: 0.5,
    type: 'observation',
    structured: entityType ? { entityType, action: 'created', name } : undefined,
  };
}

describe('linkRelatedMemories（M8 接线：假开关转真实现）', () => {
  it('同实体互链：新条目记旧条目，旧条目补反向链', () => {
    const stream = [entry('a', 'book', 'X'), entry('b', 'book', 'X')];
    const n = entry('n', 'book', 'X');
    stream.push(n);
    const linked = linkRelatedMemories(stream, n, { windowDays: 7 });
    expect(linked.sort()).toEqual(['a', 'b']);
    expect(n.relatedIds!.sort()).toEqual(['a', 'b']);
    expect(stream[0].relatedIds).toEqual(['n']); // 反向
    expect(stream[1].relatedIds).toEqual(['n']);
  });

  it('不同 entityType / 同名不同类 / 缺 structured → 不建链', () => {
    const a = entry('a', 'book', 'X');
    const b = entry('b', 'movie', 'X'); // 同名但不同类
    const c = entry('c');                // 无 structured
    const stream = [a, b, c];
    const n = entry('n', 'book', 'X');
    stream.push(n);
    expect(linkRelatedMemories(stream, n, { windowDays: 7 })).toEqual(['a']);
    expect(b.relatedIds).toBeUndefined();
    expect(c.relatedIds).toBeUndefined();
  });

  it('窗口外的旧条目不入链', () => {
    const old = entry('old', 'book', 'X', 30);
    const recent = entry('recent', 'book', 'X', 2);
    const stream = [old, recent];
    const n = entry('n', 'book', 'X');
    stream.push(n);
    expect(linkRelatedMemories(stream, n, { windowDays: 7 })).toEqual(['recent']);
    expect(old.relatedIds).toBeUndefined();
  });

  it('单侧上限 cap（取最近的）', () => {
    const stream: MemoryStreamEntry[] = [];
    for (let i = 0; i < 25; i++) stream.push(entry(`e${i}`, 'book', 'X', i));
    const n = entry('n', 'book', 'X');
    stream.push(n);
    const linked = linkRelatedMemories(stream, n, { windowDays: 365, cap: 3 });
    expect(linked).toEqual(['e0', 'e1', 'e2']); // 最近三条（stream 尾部优先）
    expect(n.relatedIds!.length).toBe(3);
  });

  it('幂等：重复调用不产生重复 id', () => {
    const stream = [entry('a', 'book', 'X')];
    const n = entry('n', 'book', 'X');
    stream.push(n);
    linkRelatedMemories(stream, n, { windowDays: 7 });
    linkRelatedMemories(stream, n, { windowDays: 7 });
    expect(n.relatedIds).toEqual(['a']);
    expect(stream[0].relatedIds).toEqual(['n']);
  });

  it('AUTO_LINK_CAP 默认 20（与旧口径一致）', () => {
    expect(AUTO_LINK_CAP).toBe(20);
  });
});

describe('linkedSnippetOf（prompt 1 跳回显）', () => {
  it('有关联 → 返回对方描述 + 相对时间', () => {
    const a = entry('a', 'book', 'X', 3);
    const n = entry('n', 'book', 'X');
    n.relatedIds = ['a'];
    const s = linkedSnippetOf([a, n], n);
    expect(s).toContain('desc-a');
    expect(s).toContain('3天前');
  });

  it('无关联 / 关联 id 已失效 → 空串', () => {
    const n = entry('n', 'book', 'X');
    expect(linkedSnippetOf([n], n)).toBe('');
    n.relatedIds = ['gone'];
    expect(linkedSnippetOf([n], n)).toBe('');
  });

  it('自引用被跳过', () => {
    const n = entry('n', 'book', 'X');
    n.relatedIds = ['n'];
    expect(linkedSnippetOf([n], n)).toBe('');
  });
});

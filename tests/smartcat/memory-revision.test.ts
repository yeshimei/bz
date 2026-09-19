// @vitest-environment node
/**
 * 记忆自动纠错测试（2026-09-20 ADR-0172）。
 * 用户硬约束是「记忆全自动、黑匣子，不要我手工纠错」——所以错误记忆只能靠自动通道兜住。
 * 钉住：修正检测（标记 + 同一件事双重近似）、两条失效通道（洞察 supersede / 观察 invalidated）、
 * 不删数据、以及回显的不确定语感。
 */
import { describe, it, expect } from 'vitest';
import {
  detectRevisions, applyRevisionInvalidation, isInvalidatedMemory, memoryHedge,
  contentBigrams, commonSubstringLen, REVISION_MARKERS,
} from '../../src/smartcat/memory';
import type { MemoryStreamEntry } from '../../src/smartcat/types';

const NOW = new Date('2026-09-20T15:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

function entry(id: string, description: string, createdDaysAgo = 10, type: 'observation' | 'insight' = 'observation', credibility?: number): MemoryStreamEntry {
  return {
    id,
    created: daysAgo(createdDaysAgo),
    lastAccessed: daysAgo(createdDaysAgo),
    description,
    importance: 0.6,
    type,
    credibility,
  };
}

describe('分词近似（bigram + 最长公共子串）', () => {
  it('整句中文不会退化成一个 token', () => {
    expect(contentBigrams('我不再喜欢跑步了').length).toBeGreaterThan(3);
  });

  it('commonSubstringLen 命中即早退（cap=3）', () => {
    expect(commonSubstringLen('我不再喜欢跑步了', '用户喜欢跑步', 3)).toBe(3);
    expect(commonSubstringLen('abc', 'xyz', 3)).toBe(0);
    expect(commonSubstringLen('', 'xyz', 3)).toBe(0);
  });
});

describe('detectRevisions（自动发现被推翻的旧记忆）', () => {
  it('修正语气 + 同一件事 → 命中（bigram 重叠）', () => {
    const stream = [entry('old', '用户喜欢跑步')];
    expect(detectRevisions(stream, { id: 'new', description: '我不再喜欢跑步了' }, { now: NOW })).toEqual(['old']);
  });

  it('修正语气 + 共有 ≥3 字连续子串 → 命中（兜住虚词差异）', () => {
    // bigram 重叠不足但连续子串足够长
    const stream = [entry('old', '用户在写那本关于天文的书')];
    const hit = detectRevisions(stream, { id: 'new', description: '其实不是关于天文的书了' }, { now: NOW });
    expect(hit).toEqual(['old']);
  });

  it('没有修正语气 → 不检测（正常重复不算推翻）', () => {
    const stream = [entry('old', '用户喜欢跑步')];
    expect(detectRevisions(stream, { id: 'new', description: '用户今天又去跑步了' }, { now: NOW })).toEqual([]);
  });

  it('说的是另一件事 → 不误伤', () => {
    const stream = [entry('old', '用户喜欢跑步')];
    expect(detectRevisions(stream, { id: 'new', description: '我不再熬夜了' }, { now: NOW })).toEqual([]);
  });

  it('超出窗口的旧记忆不动（人已改过的事不追溯）', () => {
    const stream = [entry('old', '用户喜欢跑步', 400)];
    expect(detectRevisions(stream, { id: 'new', description: '我不再喜欢跑步了' }, { now: NOW })).toEqual([]);
  });

  it('已失效的条目不重复命中（幂等）', () => {
    const old = entry('old', '用户喜欢跑步');
    old.invalidatedAt = daysAgo(1);
    expect(detectRevisions([old], { id: 'new', description: '我不再喜欢跑步了' }, { now: NOW })).toEqual([]);
  });

  it('不把自己算成冲突方', () => {
    const stream = [entry('same', '我不再喜欢跑步了')];
    expect(detectRevisions(stream, { id: 'same', description: '我不再喜欢跑步了' }, { now: NOW })).toEqual([]);
  });

  it('多个命中按时间升序返回', () => {
    const stream = [entry('a', '用户喜欢跑步，一周跑三次', 30), entry('b', '用户喜欢跑步这件事', 5)];
    expect(detectRevisions(stream, { id: 'new', description: '我不再喜欢跑步了' }, { now: NOW })).toEqual(['a', 'b']);
  });

  it('REVISION_MARKERS 覆盖常用改写语气', () => {
    for (const s of ['我不再抽烟了', '已经改成清淡饮食', '其实不是那样的', '我戒了', '搬家了', '换了工作']) {
      expect(REVISION_MARKERS.test(s)).toBe(true);
    }
    expect(REVISION_MARKERS.test('今天天气不错')).toBe(false);
  });
});

describe('applyRevisionInvalidation（两条失效通道，都不删数据）', () => {
  it('观察 → invalidatedAt + credibility 折半（不归零，痕迹还在）', () => {
    const old = entry('old', '用户喜欢跑步', 10, 'observation', 0.8);
    const stream = [old];
    const ids = applyRevisionInvalidation(stream, 'new', '我不再喜欢跑步了', { now: NOW });
    expect(ids).toEqual(['old']);
    expect(old.invalidatedAt).toBe(new Date(NOW).toISOString());
    expect(old.invalidReason).toBe('revision');
    expect(old.credibility).toBe(0.4);
    expect(stream).toHaveLength(1); // 没删
  });

  it('洞察 → 走既有 supersede 通道（不另起一套语义）', () => {
    const old = entry('old', '用户喜欢跑步', 10, 'insight');
    const stream = [old];
    applyRevisionInvalidation(stream, 'new_insight', '我不再喜欢跑步了', { now: NOW });
    expect(old.supersededBy).toBe('new_insight');
    expect(old.invalidatedAt).toBeUndefined();
  });

  it('洞察但没有后继 id → 退回 invalidatedAt（不写非法引用）', () => {
    const old = entry('old', '用户喜欢跑步', 10, 'insight');
    applyRevisionInvalidation([old], undefined, '我不再喜欢跑步了', { now: NOW });
    expect(old.supersededBy).toBeUndefined();
    expect(old.invalidatedAt).toBeTruthy();
  });

  it('credibility 折半有下限 0.05（不会归零）', () => {
    const old = entry('old', '用户喜欢跑步', 10, 'observation', 0.02);
    applyRevisionInvalidation([old], 'new', '我不再喜欢跑步了', { now: NOW });
    expect(old.credibility).toBe(0.05);
  });

  it('无命中 → 返回空数组且不改任何条目', () => {
    const old = entry('old', '今天天气不错', 10, 'observation');
    expect(applyRevisionInvalidation([old], 'new', '我不再喜欢跑步了', { now: NOW })).toEqual([]);
    expect(old.invalidatedAt).toBeUndefined();
  });

  it('isInvalidatedMemory 只认有 invalidatedAt 的条目', () => {
    expect(isInvalidatedMemory(entry('a', 'x'))).toBe(false);
    const b = entry('b', 'x');
    b.invalidatedAt = daysAgo(1);
    expect(isInvalidatedMemory(b)).toBe(true);
    expect(isInvalidatedMemory(null)).toBe(false);
    expect(isInvalidatedMemory(undefined)).toBe(false);
  });
});

describe('memoryHedge（人会记不清，回显带上不确定语感）', () => {
  it('低可信 → 记不太清', () => {
    expect(memoryHedge(entry('a', 'x', 1, 'observation', 0.3), NOW)).toBe('（记不太清）');
  });

  it('注入特征命中 → 没核实', () => {
    const m = entry('a', 'x', 1, 'observation', 0.8);
    m.suspicious = true;
    expect(memoryHedge(m, NOW)).toBe('（你当时随口一提，我没核实）');
  });

  it('入库 240 天以上且从未被检索过 → 模模糊糊记得', () => {
    expect(memoryHedge(entry('a', 'x', 300, 'observation', 0.8), NOW)).toBe('（模模糊糊记得）');
  });

  it('被检索过的老记忆不再模糊（想起来过就是清楚的）', () => {
    const m = entry('a', 'x', 300, 'observation', 0.8);
    m.lastAccessed = daysAgo(3);
    expect(memoryHedge(m, NOW)).toBe('');
  });

  it('普通近期记忆 → 无前缀', () => {
    expect(memoryHedge(entry('a', 'x', 2, 'observation', 0.9), NOW)).toBe('');
  });
});

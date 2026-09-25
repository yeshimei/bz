// @vitest-environment node
/**
 * 追问线测试（2026-09-20 ADR-0172）。
 * 钉住：抽取（前瞻标记 + bigram 关键词）、去重刷新、了结判定（保守口径）、
 * 召回排序与冷却、prompt 格式化。全程零 AI。
 */
import { describe, it, expect } from 'vitest';
import {
  extractOpenThreads, extractKeywords, threadOverlap, mergeThreads, resolveThreads,
  pruneThreads, pendingThreads, formatOpenThreads, markThreadsOffered, inferDueAt,
  THREAD_MAX, THREAD_TTL_MS, THREAD_OFFER_COOLDOWN_MS, THREAD_PROMPT_MAX, type OpenThread,
} from '../../src/smartcat/open-threads';

const NOW = new Date('2026-09-20T15:00:00Z').getTime();

describe('extractKeywords（bigram 近似分词）', () => {
  it('整句中文不退化成一个 token（否则重叠判定必然失效）', () => {
    const k = extractKeywords('我打算下个月开始学吉他');
    expect(k.length).toBeGreaterThan(4);
    expect(k).toContain('吉他');
  });

  it('去掉高频虚词，保留英文词', () => {
    const k = extractKeywords('这个是 Obsidian 的插件');
    expect(k).toContain('obsidian');
    expect(k).not.toContain('这个');
  });
});

describe('extractOpenThreads（抽取留了尾巴的事）', () => {
  it('前瞻标记句 → 抽成一条线', () => {
    const t = extractOpenThreads('我打算下个月开始学吉他', { now: NOW });
    expect(t).toHaveLength(1);
    expect(t[0].text).toContain('学吉他');
    expect(t[0].keywords.length).toBeGreaterThan(1);
    expect(t[0].createdAt).toBe(NOW);
  });

  it('无前瞻标记的日常陈述 → 不抽（不把普通记录当成悬念）', () => {
    expect(extractOpenThreads('今天天气不错，写了三千字', { now: NOW })).toHaveLength(0);
    expect(extractOpenThreads('', { now: NOW })).toHaveLength(0);
    expect(extractOpenThreads('嗯', { now: NOW })).toHaveLength(0);
  });

  it('一句话里最多抽两条，且只截 60 字', () => {
    const long = '我打算' + '很长的内容'.repeat(20) + '。下次要去爬山';
    const t = extractOpenThreads(long, { now: NOW });
    expect(t.length).toBeLessThanOrEqual(2);
    for (const x of t) expect(x.text.length).toBeLessThanOrEqual(60);
  });

  it('时间词推算 dueAt（明天/下周/下个月）', () => {
    expect(inferDueAt('明天要早起', NOW)).toBe(NOW + 86400000);
    expect(inferDueAt('下周去体检', NOW)).toBe(NOW + 7 * 86400000);
    expect(inferDueAt('以后有空再说', NOW)).toBeUndefined();
  });
});

describe('mergeThreads（去重刷新而非堆条目）', () => {
  it('同一话题再说一次 → 刷新而不是新增', () => {
    const first = extractOpenThreads('我打算下个月开始学吉他', { now: NOW });
    const again = extractOpenThreads('学吉他的事还没定下来', { now: NOW + 1000 });
    const merged = mergeThreads(first, again, NOW + 1000);
    expect(merged).toHaveLength(1);
    expect(merged[0].createdAt).toBe(NOW + 1000);
  });

  it('不同话题各自成条', () => {
    const a = extractOpenThreads('我打算下个月开始学吉他', { now: NOW });
    const b = extractOpenThreads('下次要去爬泰山', { now: NOW });
    expect(mergeThreads(a, b, NOW)).toHaveLength(2);
  });

  it('超出上限 → 先保未完成（新的在前），已完成补位', () => {
    const many: OpenThread[] = [];
    for (let i = 0; i < THREAD_MAX + 5; i++) {
      many.push({ id: `t${i}`, createdAt: NOW - i * 1000, text: `线${i}`, keywords: [`k${i}`] });
    }
    const kept = mergeThreads([], many, NOW);
    expect(kept).toHaveLength(THREAD_MAX);
    expect(kept[0].id).toBe('t0'); // 最新的在前
  });
});

describe('resolveThreads（保守了结，宁可不收也不误收）', () => {
  const thread = () => extractOpenThreads('我打算下个月开始学吉他', { now: NOW });

  it('完成语气 + 关键词命中 → 了结', () => {
    const r = resolveThreads(thread(), '吉他买好了', NOW);
    expect(r[0].resolvedAt).toBe(NOW);
  });

  it('还在拖（本条自己又是前瞻句）→ 不误收', () => {
    const r = resolveThreads(thread(), '我还在打算学吉他，还没想好', NOW);
    expect(r[0].resolvedAt).toBeUndefined();
  });

  it('完全无关的消息 → 不误收', () => {
    const r = resolveThreads(thread(), '今天开会到很晚', NOW);
    expect(r[0].resolvedAt).toBeUndefined();
  });

  it('已了结的线保持原样（幂等）', () => {
    const done = resolveThreads(thread(), '吉他买好了', NOW);
    const again = resolveThreads(done, '吉他买好了', NOW + 5000);
    expect(again[0].resolvedAt).toBe(NOW);
  });
});

describe('pendingThreads / pruneThreads（召回与淡出）', () => {
  it('超过 TTL 的未完成线淡出（人是会忘的）', () => {
    const old = extractOpenThreads('我打算学吉他', { now: NOW - THREAD_TTL_MS - 1000 });
    expect(pruneThreads(old, NOW)).toHaveLength(0);
  });

  it('已了结的线不受 TTL 影响（留作「上次那件事办完了吗」的自检）', () => {
    const t = extractOpenThreads('我打算学吉他', { now: NOW - THREAD_TTL_MS - 1000 });
    t[0].resolvedAt = NOW - 1000;
    expect(pruneThreads(t, NOW)).toHaveLength(1);
  });

  it('冷却期内的线不再提供（防复读）', () => {
    const t = extractOpenThreads('我打算学吉他', { now: NOW });
    const offered = markThreadsOffered(t, t, NOW);
    expect(pendingThreads(offered, NOW + 1000)).toHaveLength(0);
    expect(pendingThreads(offered, NOW + THREAD_OFFER_COOLDOWN_MS + 1)).toHaveLength(1);
  });

  it('到期的线排在前（约好的时间到了优先回访）', () => {
    const plain = extractOpenThreads('我以后想学吉他', { now: NOW });
    const due = extractOpenThreads('下周要去体检', { now: NOW - 8 * 86400000 });
    const list = [...plain, ...due];
    const p = pendingThreads(list, NOW);
    expect(p[0].text).toContain('体检');
  });

  it('已了结的线不提供', () => {
    const t = resolveThreads(extractOpenThreads('我打算学吉他', { now: NOW }), '吉他买好了', NOW);
    expect(pendingThreads(t, NOW)).toHaveLength(0);
  });
});

describe('formatOpenThreads（进 prompt 的块）', () => {
  it('有可用线 → 输出块并带上相对时间；条数不超上限', () => {
    const list = [
      ...extractOpenThreads('我打算学吉他', { now: NOW - 3 * 86400000 }),
      ...extractOpenThreads('下周要去体检', { now: NOW - 86400000 }),
      ...extractOpenThreads('改天要把书房收拾一下', { now: NOW - 5 * 86400000 }),
    ];
    const block = formatOpenThreads(list, NOW);
    expect(block).toContain('你们还没聊完的线');
    expect(block).toContain('3 天前');
    expect(block.split('\n- ').length - 1).toBeLessThanOrEqual(THREAD_PROMPT_MAX);
  });

  it('无可用线 → 空串（调用方自行省略）', () => {
    expect(formatOpenThreads([], NOW)).toBe('');
  });

  it('prompt 里明确写了「别硬提、别一次全抛」（护栏口径）', () => {
    const list = extractOpenThreads('我打算学吉他', { now: NOW });
    expect(formatOpenThreads(list, NOW)).toContain('别硬提');
  });
});

describe('threadOverlap', () => {
  it('共享 bigram 计数；空输入安全', () => {
    expect(threadOverlap(['吉他', '他买'], ['吉他', '他买'])).toBe(2);
    expect(threadOverlap([], ['x'])).toBe(0);
    expect(threadOverlap(['x'], [])).toBe(0);
  });
});

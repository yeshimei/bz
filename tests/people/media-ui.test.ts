/**
 * 媒体徽章 UI 测试（issue 445）：personMedia 跨导入累计与空数据判定、mediaBadge 渲染
 * （文案拼接 / 空数据不渲染元素）。徽章是详情页与卡墙共用的 UI 小件，抽出来整管单测。
 * 隐私口径：fixture 全构造数据。
 */
import { describe, it, expect } from 'vitest';
import { mediaBadge, personMedia } from '../../src/people/ui';
import type { ImportRecord, PersonEntry } from '../../src/people/types';

function person(imports: ImportRecord[]): PersonEntry {
  return { id: 'wxid_a', name: '老王', createdAt: '2026-09-25T00:00:00.000Z', imports };
}

function rec(stats: ImportRecord['stats']): ImportRecord {
  return {
    file: '老王.csv',
    importedAt: '2026-09-25T01:00:00.000Z',
    messageCount: 10,
    skippedCount: 0,
    timeFrom: '2024-01-01T00:00:00.000Z',
    timeTo: '2024-12-31T00:00:00.000Z',
    stats,
  };
}

describe('personMedia 跨导入累计', () => {
  it('多条导入的语音 / 时长 / 图片逐项相加', () => {
    const p = person([
      rec({ monthly: [], initiatedByMe: 0, initiatedByOther: 0, myAvgReplySec: 0, otherAvgReplySec: 0, myHourly: [], otherHourly: [], kindCounts: {}, voiceCount: 20, voiceTotalSec: 200, imageCount: 8 }),
      rec({ monthly: [], initiatedByMe: 0, initiatedByOther: 0, myAvgReplySec: 0, otherAvgReplySec: 0, myHourly: [], otherHourly: [], kindCounts: {}, voiceCount: 6, voiceTotalSec: 45, imageCount: 6 }),
    ]);
    expect(personMedia(p)).toEqual({ voiceCount: 26, voiceTotalSec: 245, imageCount: 14 });
  });

  it('旧数据（无媒体字段 / 无 stats）→ null，徽章不渲染', () => {
    expect(personMedia(person([]))).toBeNull();
    expect(personMedia(person([rec(undefined)]))).toBeNull();
  });

  it('媒体字段全零 / 缺省 → null；单一侧有值即出', () => {
    const zero = { monthly: [], initiatedByMe: 0, initiatedByOther: 0, myAvgReplySec: 0, otherAvgReplySec: 0, myHourly: [], otherHourly: [], kindCounts: {} };
    expect(personMedia(person([rec(zero)]))).toBeNull();
    const imageOnly = person([rec({ ...zero, imageCount: 3 })]);
    expect(personMedia(imageOnly)).toEqual({ voiceCount: 0, voiceTotalSec: 0, imageCount: 3 });
  });
});

describe('mediaBadge 渲染', () => {
  it('有媒体：胶囊元素，文案按零项省略拼接', () => {
    const p = person([
      rec({ monthly: [], initiatedByMe: 0, initiatedByOther: 0, myAvgReplySec: 0, otherAvgReplySec: 0, myHourly: [], otherHourly: [], kindCounts: {}, voiceCount: 26, voiceTotalSec: 245, imageCount: 14 }),
    ]);
    const badge = mediaBadge(p);
    expect(badge).not.toBeNull();
    expect(badge!.className).toBe('bz-people-media-badge');
    expect(badge!.textContent).toBe('语音 26 条 · 4 分 · 图片 14 张');

    const imageOnly = person([
      rec({ monthly: [], initiatedByMe: 0, initiatedByOther: 0, myAvgReplySec: 0, otherAvgReplySec: 0, myHourly: [], otherHourly: [], kindCounts: {}, imageCount: 2 }),
    ]);
    expect(mediaBadge(imageOnly)!.textContent).toBe('图片 2 张');
  });

  it('空数据（无媒体）返回 null：卡片与详情页都不出现徽章', () => {
    expect(mediaBadge(person([]))).toBeNull();
    expect(mediaBadge(person([rec(undefined)]))).toBeNull();
  });
});

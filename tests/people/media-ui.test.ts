/**
 * 媒体徽章测试（issue 445/447）：personMedia 跨导入累计与空数据判定（ui）、mediaLabel
 * 渲染文案（render 纯层：零项省略拼接 / 空数据出空串不渲染）。徽章是封面与详情共用小件。
 * 隐私口径：fixture 全构造数据。
 */
import { describe, it, expect } from 'vitest';
import { personMedia } from '../../src/people/ui';
import { mediaLabel } from '../../src/people/render';
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

describe('mediaLabel 文案（render 纯层）', () => {
  it('有媒体：文案按零项省略拼接', () => {
    expect(mediaLabel({ voiceCount: 26, voiceTotalSec: 245, imageCount: 14 })).toBe('语音 26 条 · 4 分 · 图片 14 张');
    expect(mediaLabel({ voiceCount: 0, voiceTotalSec: 0, imageCount: 2 })).toBe('图片 2 张');
    expect(mediaLabel({ voiceCount: 5, voiceTotalSec: 4200, imageCount: 0 })).toBe('语音 5 条 · 1.2 时');
  });

  it('空数据（无媒体）返回空串：封面与详情都不出现徽章', () => {
    expect(mediaLabel(null)).toBe('');
    expect(mediaLabel(undefined)).toBe('');
    expect(mediaLabel({ voiceCount: 0, voiceTotalSec: 0, imageCount: 0 })).toBe('');
  });
});

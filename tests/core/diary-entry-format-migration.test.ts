// @vitest-environment node
/**
 * 日记存储格式缺省翻牌（2026-11-05：缺省从 entry 改为 day）。
 *
 * 只改 DEFAULT_SETTINGS 会连带把「没显式选过格式」的老库切成 day——盘上已经全是
 * `YYMMDDHHmm.md`，切过去就变成两种格式混写。迁移给这类老库补写 `'entry'`；
 * 真新装（loadData 为空）不写，走新缺省。
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, migrateDiaryEntryFormatDefault } from '../../src/settings';

describe('migrateDiaryEntryFormatDefault', () => {
  it('真新装（无 data.json）不写，合并默认值得到 day', () => {
    expect(migrateDiaryEntryFormatDefault(null)).toBe(false);
    expect(migrateDiaryEntryFormatDefault(undefined)).toBe(false);
    expect(DEFAULT_SETTINGS.diaryEntryFormat).toBe('day');
  });

  it('老库没有该键但有日记痕迹 → 补写 entry（保住原写法）', () => {
    const raw: Record<string, unknown> = { diaryDirectory: '我的/日记' };
    expect(migrateDiaryEntryFormatDefault(raw)).toBe(true);
    expect(raw.diaryEntryFormat).toBe('entry');
  });

  it('已有显式值（day / entry）→ 一律不动', () => {
    const day = { diaryEntryFormat: 'day' };
    expect(migrateDiaryEntryFormatDefault(day)).toBe(false);
    expect(day.diaryEntryFormat).toBe('day');

    const entry = { diaryEntryFormat: 'entry' };
    expect(migrateDiaryEntryFormatDefault(entry)).toBe(false);
    expect(entry.diaryEntryFormat).toBe('entry');
  });

  it('无关的 data.json（只有别的域键）→ 不凭空写日记键', () => {
    const raw: Record<string, unknown> = { memoSkin: 'editorial' };
    expect(migrateDiaryEntryFormatDefault(raw)).toBe(false);
    expect('diaryEntryFormat' in raw).toBe(false);
  });
});

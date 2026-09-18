/**
 * 日记本（diary）UI · getYearRange 直测（review-deep diary-arch 测试缺口 1）
 * - getYearRange 是 DiaryAppController 公开方法（UX-34 写日记滚轮年份动态范围的数据源），
 *   此前零直测，本文件钉死其纯函数口径。
 * - 环境 jsdom：函数本身零 DOM 依赖，但所在模块 src/diary/ui.ts 顶层 import obsidian
 *   （Component/MarkdownRenderer）与 ui/dialogs 等子模块，jsdom 下才能加载（同 tests/diary/ui.test.ts）。
 * - 直接 new DiaryAppController()（不走 getInstance 单例，避免跨用例 DOM/ESC 残留），
 *   只公开字段 entries 与公开方法 getYearRange，不触任何 DOM 渲染路径。
 */
import { describe, expect, it } from 'vitest';
import { DiaryAppController } from '../../src/diary/ui';
import type { WallEntry } from '../../src/diary/types';

/** 最小 WallEntry 夹具：getYearRange 只读 date 字段，其余按类型契约补齐 */
function mkEntry(date: string): WallEntry {
  return {
    date,
    time: '00:00',
    tags: ['日记'],
    emoji: '📖',
    content: '',
    filename: `我的/日记/${date.replace(/-/g, '').slice(2)}.md`,
    filePath: `我的/日记/${date.replace(/-/g, '').slice(2)}.md`,
    lineNumber: 0,
    kind: 'diary',
    media: [],
    text: '',
    segments: [],
  };
}

/** 当年 +1（与实现同式取值，避免硬编码年份过期） */
function expectedMax(): number {
  return new Date().getFullYear() + 1;
}

function yearRangeOf(dates: string[]): { min: number; max: number } | null {
  const c = new DiaryAppController();
  c.entries = dates.map(mkEntry);
  return c.getYearRange();
}

describe('getYearRange（写日记滚轮年份动态范围，UX-34）', () => {
  it('空数据返回 null（控件回落默认 1900～当年+1）', () => {
    expect(yearRangeOf([])).toBeNull();
  });

  it('最早年份 < 1900 时下限钳制到 1900', () => {
    expect(yearRangeOf(['1850-06-01', '2020-05-01'])).toEqual({ min: 1900, max: expectedMax() });
    expect(yearRangeOf(['1899-12-31'])).toEqual({ min: 1900, max: expectedMax() });
  });

  it('最早年份 >= 1900 时原样透传（钳制不误伤）', () => {
    expect(yearRangeOf(['1900-01-01', '2026-09-01'])).toEqual({ min: 1900, max: expectedMax() });
    expect(yearRangeOf(['1950-03-04', '1980-06-15', '2026-01-01'])).toEqual({
      min: 1950,
      max: expectedMax(),
    });
  });

  it('上界恒为当年 + 1（与数据多新无关）', () => {
    // 数据已「来自未来」（手输日期/时钟偏差）：上界仍钉当年+1，不随数据抬高
    const future = `${new Date().getFullYear() + 3}-01-01`;
    expect(yearRangeOf(['2020-01-01', future])).toEqual({ min: 2020, max: expectedMax() });
  });

  it('非 YYYY 前缀日期忽略（parseInt NaN 不入最早年份）', () => {
    // 全部无效 → 等价空数据
    expect(yearRangeOf(['abc', '日记-2026', ''])).toBeNull();
    // 混有有效 → 只按有效项计算
    expect(yearRangeOf(['abc', '2020-03-04', '日记-2026'])).toEqual({ min: 2020, max: expectedMax() });
  });
});

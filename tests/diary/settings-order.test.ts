/**
 * 日记本设置页的组序（2026-11-05 用户要求：显示组挪到目录组下面）。
 *
 * 组序是用户能直接感知的结构：目录（放哪儿）→ 显示（怎么看）连着，读起来才顺；
 * 存储/分类是低频的配置，压在下半页。这条断言把它钉住，避免以后插组时挪乱。
 */
import { describe, expect, it } from 'vitest';
import { diarySettingsSchema } from '../../src/diary/settings';

describe('日记本设置组序', () => {
  it('依次是 外观 / 目录 / 显示 / 存储 / 分类', () => {
    expect(diarySettingsSchema().groups.map((g) => g.name)).toEqual(['外观', '目录', '显示', '存储', '分类']);
  });

  it('显示组紧跟目录组，中间不插别的组', () => {
    const names = diarySettingsSchema().groups.map((g) => g.name);
    expect(names.indexOf('显示')).toBe(names.indexOf('目录') + 1);
  });
});

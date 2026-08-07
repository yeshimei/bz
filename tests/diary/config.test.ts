import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyTagsConfig,
  buildTagMaps,
  emojiToTagMap,
  getAllAvailableTags,
  getParentPrimaryTag,
  getSortedTagsForAddDialog,
  getSubTagsOfPrimary,
  getTagEmoji,
  isSubTag,
  parseTagConfig,
  resetTagsConfig,
  tagToEmojiMap,
} from '../../src/diary/config';

// 回归：模块加载时即构建 emoji 映射（设置项「标签配置」移除后不依赖设置应用流程）
// 此断言位于 beforeEach 之前，真实反映模块顶层状态
if (emojiToTagMap['📖'] !== '日记' || tagToEmojiMap['日记'] !== '📖') {
  throw new Error('config 模块加载后 emoji 映射未构建——缺少模块顶层 buildTagMaps() 调用');
}

beforeEach(() => {
  resetTagsConfig();
});

describe('parseTagConfig 文本格式', () => {
  it('解析主标签行：标签名 + emoji', () => {
    const cfg = parseTagConfig('日记 📖\n念念碎 😶');
    expect(cfg['日记']).toEqual({ emoji: '📖' });
    expect(cfg['念念碎'].emoji).toBe('😶');
  });

  it('解析二级标签行：主标签 emoji > 子标签 emoji, 子标签 emoji', () => {
    const cfg = parseTagConfig('旅游 ✈️ > 四川 🀄, 大理 🛶');
    expect(cfg['旅游'].emoji).toBe('✈️');
    expect(cfg['旅游'].subTags).toEqual([
      { tag: '四川', emoji: '🀄' },
      { tag: '大理', emoji: '🛶' },
    ]);
  });

  it('跳过非法行（无空格分隔）', () => {
    const cfg = parseTagConfig('日记 📖\n没有emoji的行');
    expect(cfg['日记']).toBeDefined();
    expect(Object.keys(cfg)).toHaveLength(1);
  });

  it('处理多级 > 时剩余部分按最后一个词切分（保持原脚本行为）', () => {
    const cfg = parseTagConfig('A 😀 > B 😁 > C 😂');
    // 子标签部分为 "B 😁 > C 😂"，按 标签+emoji 规则匹配到最后一个词
    expect(cfg["A"].subTags).toEqual([{ tag: "B 😁>C", emoji: "😂" }]);
  });
});

describe('applyTagsConfig', () => {
  it('JSON 格式解析成功', () => {
    applyTagsConfig(JSON.stringify({ 测试: { emoji: '🦄' } }));
    expect(getTagEmoji('测试')).toBe('🦄');
  });

  it('JSON 解析失败时回退文本格式', () => {
    applyTagsConfig('{坏掉的 json');
    // 文本解析失败 → 空配置；buildTagMaps 仍执行
    expect(getTagEmoji('任意')).toBe('📖');
  });

  it('文本格式应用后映射同步', () => {
    applyTagsConfig('新标签 🆕');
    expect(getTagEmoji('新标签')).toBe('🆕');
    expect(emojiToTagMap['🆕']).toBe('新标签');
  });
});

describe('emoji 映射', () => {
  beforeEach(() => {
    buildTagMaps();
  });

  it('默认映射：主标签与二级标签', () => {
    expect(tagToEmojiMap['日记']).toBe('📖');
    expect(tagToEmojiMap['四川']).toBe('🀄');
    expect(emojiToTagMap['📖']).toBe('日记');
    expect(emojiToTagMap['🀄']).toBe('四川');
  });

  it('组合 emoji 作为键（🧑‍🎨 艺术）', () => {
    expect(tagToEmojiMap['艺术']).toBe('🧑‍🎨');
    expect(emojiToTagMap['🧑‍🎨']).toBe('艺术');
  });

  it('未知标签回退 📖', () => {
    expect(getTagEmoji('不存在的标签')).toBe('📖');
  });
});

describe('标签辅助函数', () => {
  it('getAllAvailableTags 包含主标签与二级标签', () => {
    const tags = getAllAvailableTags();
    expect(tags).toContain('日记');
    expect(tags).toContain('四川');
    expect(tags).toContain('大理');
  });

  it('isSubTag / getParentPrimaryTag', () => {
    expect(isSubTag('四川')).toBe(true);
    expect(isSubTag('日记')).toBe(false);
    expect(getParentPrimaryTag('四川')).toBe('旅游');
    expect(getParentPrimaryTag('日记')).toBeNull();
  });

  it('getSubTagsOfPrimary', () => {
    const subs = getSubTagsOfPrimary('旅游')!;
    expect(subs.map((s) => s.tag)).toEqual(['四川', '大理']);
    expect(getSubTagsOfPrimary('日记')).toBeNull();
  });

  it('getSortedTagsForAddDialog 隐藏有二级标签的主标签', () => {
    const sorted = getSortedTagsForAddDialog();
    expect(sorted).not.toContain('旅游');
    expect(sorted).not.toContain('收藏');
    expect(sorted).toContain('四川');
    expect(sorted).toContain('日记');
    // 二级标签按配置顺序
    expect(sorted.indexOf('四川')).toBeLessThan(sorted.indexOf('大理'));
  });
});

// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyDirectories,
  BATCH_SIZE,
  buildTagMaps,
  DIARY_DIRECTORY,
  emojiToTagMap,
  getParentPrimaryTag,
  getSortedTagsForAddDialog,
  getSubTagsOfPrimary,
  getTagEmoji,
  isSubTag,
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

describe('applyDirectories 设置应用', () => {
  it('diaryBatchSize 生效', () => {
    applyDirectories({ diaryBatchSize: '10' });
    expect(BATCH_SIZE).toBe(10);
  });

  it('diaryBatchSize 缺省/非法回退默认 20', () => {
    applyDirectories({});
    expect(BATCH_SIZE).toBe(20);
    applyDirectories({ diaryBatchSize: 'abc' });
    expect(BATCH_SIZE).toBe(20);
  });

  it('diaryDirectory 生效', () => {
    applyDirectories({ diaryDirectory: '日记2' });
    expect(DIARY_DIRECTORY).toBe('日记2');
  });
});

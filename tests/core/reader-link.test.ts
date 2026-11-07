/**
 * 阅读器协议单源（`core/reader-link`）。
 *
 * 这条串在四处被用到（书架墙、知识盒来源、第二大脑引用卡、外部反调），格式必须只有一处：
 * 参数顺序固定 `book → cfi → t → c`，值一律 encode，空值整段不出现。
 */
import { describe, expect, it, vi } from 'vitest';
import { openReaderJump, readerJumpUrl, READER_TEXT_SNIPPET } from '../../src/core/reader-link';

describe('readerJumpUrl', () => {
  it('没有书号 → 空串（调用方据此不假装打开了）', () => {
    expect(readerJumpUrl('')).toBe('');
    expect(readerJumpUrl('   ')).toBe('');
  });

  it('只带书号', () => {
    expect(readerJumpUrl('b1')).toBe('obsidian://bz-reader?book=b1');
  });

  it('参数顺序固定：book → cfi → t → c', () => {
    expect(readerJumpUrl('b1', { chapter: '第一章', text: '注意力', cfi: 'epubcfi(/6/2)' })).toBe(
      'obsidian://bz-reader?book=b1&cfi=epubcfi(%2F6%2F2)&t=%E6%B3%A8%E6%84%8F%E5%8A%9B&c=%E7%AC%AC%E4%B8%80%E7%AB%A0',
    );
  });

  it('空值整段不出现，不写空参数', () => {
    expect(readerJumpUrl('b1', { cfi: '', text: null, chapter: '  ' })).toBe('obsidian://bz-reader?book=b1');
  });

  it('原文片段压空白并截到约定长度（与阅读器 deeplink 同口径）', () => {
    const long = '甲'.repeat(READER_TEXT_SNIPPET + 10);
    const url = readerJumpUrl('b1', { text: `  ${long}  ` });
    expect(decodeURIComponent(url.split('t=')[1])).toBe('甲'.repeat(READER_TEXT_SNIPPET));
  });
});

describe('openReaderJump', () => {
  it('走宿主 openUrl，返回是否发起', () => {
    const openUrl = vi.fn();
    expect(openReaderJump({ openUrl }, 'b1', { cfi: 'x' })).toBe(true);
    expect(openUrl).toHaveBeenCalledWith('obsidian://bz-reader?book=b1&cfi=x');
  });

  it('没有书号 → 不调用、返回 false', () => {
    const openUrl = vi.fn();
    expect(openReaderJump({ openUrl }, '')).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});

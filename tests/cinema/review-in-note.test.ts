// @vitest-environment node
/**
 * 影院影评正文标记：开关打开后影评写进笔记正文 <BZ-MOVIE> 区，与属性双向同步。
 * 守卫纯函数的插入位置、幂等替换、清除保留、markdown 原样与空块抑制。
 */
import { describe, it, expect } from 'vitest';
import {
  REVIEW_BEGIN,
  REVIEW_END,
  readReviewFromContent,
  setReviewInContent,
  hasReviewBlock,
} from '../../src/cinema/review-in-note';

const note = (body: string): string =>
  `---\ntags:\n- 电影\n状态: 已看\n观影日期: "2026-01-01"\n---\n\n${body}`;

describe('影评正文标记读写', () => {
  it('把影评插在 frontmatter 之后、海报之前（用户拍板：笔记顶部，海报上面）', () => {
    const src = note('![[poster.png]]\n\n正文');
    const out = setReviewInContent(src, '很好看');
    expect(out).toContain(`${REVIEW_BEGIN}\n很好看\n${REVIEW_END}`);
    expect(out.indexOf(REVIEW_BEGIN)).toBeGreaterThan(out.indexOf('状态: 已看'));
    expect(out.indexOf(REVIEW_BEGIN)).toBeLessThan(out.indexOf('![[poster.png]]'));
  });

  it('已有标记时替换内容，不重复插（增强 5：重复打开不重复插标记）', () => {
    const once = setReviewInContent(note('![[poster.png]]'), '第一版');
    const twice = setReviewInContent(once, '第二版');
    expect(twice.split(REVIEW_BEGIN)).toHaveLength(2);
    expect(readReviewFromContent(twice)).toBe('第二版');
    expect(hasReviewBlock(twice)).toBe(true);
  });

  it('标记被回填海报挤到后面时，保存会移回海报上面（笔记顶部）', () => {
    const src = note('![[poster.png]]\n\n<BZ-MOVIE>\n旧影评\n</BZ-MOVIE>\n\n正文');
    const out = setReviewInContent(src, '新影评');
    expect(out.indexOf(REVIEW_BEGIN)).toBeLessThan(out.indexOf('![[poster.png]]'));
    expect(readReviewFromContent(out)).toBe('新影评');
    expect(out.split(REVIEW_BEGIN)).toHaveLength(2);
  });

  it('清除时只删标记，保留海报与其余正文（关掉后只在属性保留影评）', () => {
    const withReview = setReviewInContent(note('![[poster.png]]\n\n正文'), '影评');
    const cleared = setReviewInContent(withReview, null);
    expect(cleared).not.toContain(REVIEW_BEGIN);
    expect(cleared).toContain('![[poster.png]]');
    expect(cleared).toContain('正文');
    expect(hasReviewBlock(cleared)).toBe(false);
  });

  it('markdown 语法原样保留（Panda 的核心诉求）', () => {
    const md = '**加粗** 和 [链接](https://example.com) 与\n> 引用';
    const out = setReviewInContent(note('正文'), md);
    expect(readReviewFromContent(out)).toBe(md);
  });

  it('无标记返回 null；传 null 不插空块（增强 1：跳过无影评影片）', () => {
    expect(readReviewFromContent(note('正文'))).toBeNull();
    expect(setReviewInContent(note('正文'), null)).toBe(note('正文'));
  });

  it('无 frontmatter 的笔记插在最开头', () => {
    const out = setReviewInContent('正文开头', '影评');
    expect(out.startsWith(`${REVIEW_BEGIN}\n`)).toBe(true);
  });

  it('标记被用户手改坏（缺结束标记）时不误读正文', () => {
    expect(readReviewFromContent(`${REVIEW_BEGIN}\n半截内容`)).toBeNull();
  });
});

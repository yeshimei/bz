/**
 * 剪藏本文章标题字号回归（issue 300：桌面/移动阅读面顶栏文章标题降档）。
 * 断言读源文件文本（jsdom 不解析 css 文件；先例 review-mobile-type.test.ts）：
 * 1) 桌面文章标题 .bz-clip-art-title 走 display 档 token（项目倾向 token 化，不写死中间值）；
 * 2) 移动文章标题 .bz-clip-mob-d-title 为端互斥类，直接改基座值 27px（不新增 @media）；
 * 顶栏刊名（.bz-panel-title / .bz-clip-mob-title）不在本档，不在此锁。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const clipCss = () => readFileSync(resolve(process.cwd(), 'src/clipbook/styles.css'), 'utf8');

/** 取某选择器规则体的声明段（宽容解析：与规则在文件中的位置/顺序无关） */
const declOf = (sel: string): string => {
  const escaped = sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const m = clipCss().match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(m, `styles.css 缺 ${sel} 规则`).not.toBeNull();
  return m![1];
};

describe('clipbook 文章标题字号（issue 300）', () => {
  it('桌面文章标题走 display 档 token，不再写死 24px', () => {
    const decl = declOf('.bz-clip-art-title');
    expect(decl).toContain('font-size: var(--bz-font-display)');
    expect(decl).not.toContain('24px');
  });

  it('移动文章标题基座值 27px（端互斥类直改，不残留 33px）', () => {
    const decl = declOf('.bz-clip-mob-d-title');
    expect(decl).toContain('font-size: 27px');
    expect(decl).not.toContain('33px');
  });
});

// @vitest-environment node
/**
 * home 骨架期「全部域」列占位回归（H4/呈报#31，全域深审拍板后修复批 Wave1）：
 * 骨架期不再放「全 部 域」标题——数据到达后的入口行本就无此标题，骨架期先放会让它
 * 闪现后消失；改骨架线条占位（.bz-home-sk-line）同位呼吸。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadingEntriesHtml } from '../../src/home/layouts/river/render';

const repoCss = () => readFileSync(resolve(process.cwd(), 'src/home/styles.css'), 'utf8');

describe('H4：骨架期不放「全部域」标题（呈报#31）', () => {
  it('loadingEntriesHtml 不含「全 部 域」标题文本（修复前必红：旧版即标题占位）', () => {
    const html = loadingEntriesHtml();
    expect(html).not.toContain('全 部 域');
    expect(html).not.toContain('bz-home-sec-t');
  });

  it('骨架线条占位在位：.bz-home-sk 容器 + 多根 .bz-home-sk-line', () => {
    const html = loadingEntriesHtml();
    expect(html).toContain('class="bz-home-sk"');
    expect(html.match(/bz-home-sk-line/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('骨架线条样式落域 styles.css（呼吸动画 + --h-line 取色，亮暗随 token）', () => {
    const css = repoCss();
    expect(css).toContain('.bz-home-sk {');
    expect(css).toContain('.bz-home-sk-line {');
    expect(css).toContain('bz-home-sk-pulse');
    expect(css).toContain('var(--h-line)');
  });
});

/**
 * 复习计划移动端字号体系回归（2026-09-12 评审：面板在手机上整体偏小，按层级放大）。
 * 断言读源文件文本（jsdom 不解析 css 文件；先例 review-fix-b.test.ts / enh-sweep-c.test.ts）：
 *  1) 移动端字号块必须整体位于 `@media (max-width: 768px)` 内且为文件尾段（媒体查询不增特异性，
 *     靠「后写者赢」压过上方基础规则——挪到基础规则之前即失效）；
 *  2) 各层级定值在位（L1 面板题 20 / L2 列头计数 19 / L3 卡题 16 · 题面 17.5 / L6 角标 13）；
 *  3) 控件尺寸随同级文字抬档（面板内主钮 40px、头行图标钮 40×44、选项行 ≥44、评级条钮 ≥44）；
 *  4) 三项易回归的形态：开始本轮条主钮独占一行、评级条定宽（收缩宽 + flex-basis:100% 会塌成窄条）、
 *     评级条热区走 min-height 而非撑 padding。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const reviewCss = () => repo('src/review/styles.css');

const MARK = '移动端字号体系（≤768px';
/** 取移动端字号块（marker → 文件尾） */
const mobileBlock = () => {
  const css = reviewCss();
  const i = css.indexOf(MARK);
  expect(i, '缺移动端字号体系段').toBeGreaterThan(-1);
  return css.slice(i);
};
/** 取块内某选择器的声明体 */
const declOf = (sel: string): string => {
  const block = mobileBlock();
  const escaped = sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const m = block.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(m, `移动端块缺 ${sel} 规则`).not.toBeNull();
  return m![1];
};

describe('review 移动端字号：层级定值', () => {
  it('整段挂在 @media (max-width: 768px) 内（注释头之后即为媒体查询，桌面零影响）', () => {
    const block = mobileBlock();
    expect(block).toMatch(/@media \(max-width: 768px\) \{/);
    // 媒体查询必须在注释头之后立刻出现，且段内大括号闭合（未闭合会把后续桌面规则一并圈进移动端）
    const commentEnd = block.indexOf('*/');
    expect(commentEnd, '缺注释头收口').toBeGreaterThan(-1);
    const afterComment = block.slice(commentEnd + 2);
    expect(afterComment.trimStart().startsWith('@media (max-width: 768px) {')).toBe(true);
    let depth = 0;
    for (const ch of block) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      expect(depth, '移动端字号块大括号失衡').toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });

  it('L1 面板/整屏题：复习计划 20 · 做题冲刺 20 · 本轮复习完成 22', () => {
    expect(declOf('#review-popup .bz-panel-title')).toContain('font-size: 20px');
    expect(declOf('.bz-sprint-title')).toContain('font-size: 20px');
    expect(declOf('.bz-summary-title')).toContain('font-size: 22px');
  });

  it('L2/L3/L6：列头计数 19 · 卡片题 16 · 题面 17.5 · 选项 16 · 角标 tag 13', () => {
    expect(declOf('.bz-q-col-head .cnt')).toContain('font-size: 19px');
    expect(declOf('.bz-q-card-title')).toContain('font-size: 16px');
    expect(declOf('.bz-sprint-qtext')).toContain('font-size: 17.5px');
    expect(declOf('.bz-sprint-opt .t')).toContain('font-size: 16px');
    expect(declOf('.bz-q-tag')).toContain('font-size: 13px');
  });

  it('L4 正文/辅助：开始本轮条 16/14 · 底部信息行 14 · 解析 14 · 队列条目 14', () => {
    expect(declOf('.bz-q-strip strong')).toContain('font-size: 16px');
    expect(declOf('.bz-q-strip-txt')).toContain('font-size: 14px');
    expect(declOf('.bz-q-fitem')).toContain('font-size: 14px');
    expect(declOf('.bz-sprint-explain')).toContain('font-size: 14px');
    expect(declOf('.bz-sq-item .nm')).toContain('font-size: 14px');
  });

  it('层级同为递减：面板题 > 卡片题 > 角标；题面 > 选项文本（档间不倒挂）', () => {
    const px = (sel: string) => Number(declOf(sel).match(/font-size:\s*([\d.]+)px/)![1]);
    expect(px('#review-popup .bz-panel-title')).toBeGreaterThan(px('.bz-q-card-title'));
    expect(px('.bz-q-card-title')).toBeGreaterThan(px('.bz-q-tag'));
    expect(px('.bz-sprint-qtext')).toBeGreaterThan(px('.bz-sprint-opt .t'));
    expect(px('.bz-q-col-head .cnt')).toBeGreaterThan(px('.bz-q-col-head .name'));
    expect(mobileBlock(), '缺六档层级声明').toMatch(/L1 面板\/整屏题[\s\S]*L6 角标/);
  });
});

describe('review 移动端字号：控件随层级抬档（设计手册 §8.2）', () => {
  it('面板内主钮 40px 高；头行图标钮 40×44（移动端唯一关闭入口）', () => {
    const btn = declOf('#review-popup .bz-btn');
    expect(btn).toContain('height: 40px');
    expect(btn).toContain('font-size: 15px');
    const icon = declOf('#review-popup .bz-icon-btn');
    expect(icon).toContain('width: 40px');
    expect(icon).toContain('height: 44px');
  });

  it('选项行 ≥44（12+12 padding + 16px 文本）；评级条按钮 min-height 44', () => {
    expect(declOf('.bz-sprint-opt')).toContain('padding: 12px 14px');
    expect(declOf('.bz-review-bar-btn')).toContain('min-height: 44px');
  });
});

describe('review 移动端字号：易回归形态', () => {
  it('开始本轮条主钮独占一行（满宽靶；字号抬档后信息行放不下按钮的收口）', () => {
    const strip = declOf('.bz-q-strip');
    expect(strip).toContain('flex-wrap: wrap');
    expect(declOf('.bz-q-strip .bz-btn')).toContain('flex: 1 0 100%');
  });

  it('评级条定宽——收缩宽 + 子项 flex-basis:100% 会塌成窄条（实测按钮被压到 42px 宽、两字竖排）', () => {
    const bar = declOf('.bz-review-bar');
    expect(bar).toContain('width: min(94vw, 560px)');
    expect(bar).toContain('flex-wrap: wrap');
    expect(declOf('.bz-review-bar-info')).toContain('flex: 1 0 100%');
    expect(declOf('.bz-review-bar-act')).toContain('flex-wrap: wrap');
  });
});

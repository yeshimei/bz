/**
 * 备忘录主界面移动端关闭钮守卫（2026-11-15 备忘录）：
 *
 * 头行那枚 ✕ 一直都有（`data-memo-head-close`），但两处级联把它吃掉了：
 *  1. 「纸感手账」是远端皮肤包，运行时以 `<style>` 注入在插件样式**之后**，包里的
 *     `.bz-memo-skin-paper .bz-panel-head-btns{display:none}` 与收口段恢复规则同特异性，
 *     后写者赢 → 手机端整组钮（含关闭）被藏掉。
 *  2. 平板 / 横屏手机宽度超过 768px 时不进「移动端收口段」，编辑部主题的头行钮组
 *     仍被皮肤段藏着；触屏没有偏移指针可点遮罩，同样没有关闭出口。
 *
 * 修法：文件末尾加一段 `@media (pointer: coarse)`，用 (0,3,0) 选择器把两套皮肤的
 * 头行钮组放回。桌面鼠标端不进该段，逐像素不变。本文件只做样式源静态断言
 * （同 tests/memo/mobile-ui-3fix.test.ts 手法）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** 取出 `@media (pointer: coarse)` 块（花括号配对，末尾可带其它块） */
function coarseBlock(css: string): string {
  const start = css.indexOf('@media (pointer: coarse)');
  expect(start, '触屏补丁段存在').toBeGreaterThan(-1);
  let depth = 0;
  const open = css.indexOf('{', start);
  let i = open;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return css.slice(open, i + 1);
}

describe('备忘录主界面 · 触屏设备必须有关闭钮', () => {
  const css = read('src/memo/styles.css');
  const paper = read('src/memo/skins/paper.css');

  it('远端纸感皮肤确实藏了头行钮组（本补丁要反制的事实）', () => {
    expect(paper).toMatch(/\.bz-memo-skin-paper\s+\.bz-panel-head-btns\s*\{\s*display:\s*none/);
  });

  it('补丁段排在移动端收口段之后，且只作用于触屏指针', () => {
    expect(css.indexOf('@media (pointer: coarse)')).toBeGreaterThan(css.lastIndexOf('移动端收口段'));
    expect(coarseBlock(css)).toMatch(/display:\s*flex/);
  });

  it('两套皮肤都用 (0,3,0) 选择器放回钮组（压过运行期后注入的皮肤包）', () => {
    const block = coarseBlock(css);
    for (const skin of ['paper', 'editorial']) {
      const selector = `.bz-memo-panel.bz-memo-skin-${skin} .bz-panel-head-btns`;
      expect(block, `${skin} 必须有加特异性后的恢复选择器`).toContain(selector);
    }
    expect(block).toMatch(/display:\s*flex/);
    // 段内不得改变桌面原型口径：只放回关闭钮所在钮组，别把面板尺寸/顶距一起带进触屏
    expect(block).not.toMatch(/padding-top|height:\s*var\(--bz-vvh/);
  });

  it('桌面鼠标端零影响：皮肤段的桌面隐藏规则仍在', () => {
    expect(css).toMatch(/\.bz-memo-skin-editorial\s+\.bz-panel-head-btns\s*\{\s*display:\s*none/);
    // 补丁段不得写成全局无条件规则（那会把桌面原型的「头行无钮」一起改掉）
    expect(css.indexOf('@media (pointer: coarse)')).toBeGreaterThan(css.indexOf('.bz-memo-skin-editorial .bz-panel-head-btns { display: none; }'));
  });
});

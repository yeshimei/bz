/**
 * clipbook 域样式回归（issue 222 修复轮）：右键菜单编辑部换肤变量作用域。
 * 菜单挂 document.body（.bz-item-menu.bz-clip-menu-editorial，域内后代选择器不可达），
 * 不在 .bz-clip-frame 子树内——若定义 --clip-* 的规则不同时选中菜单根，
 * 菜单里 var(--clip-*) 计算值无效，背景/边框/悬停色全透明裸奔（jsdom 不算
 * CSS 变量级联，只能锚样式源文本）。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cssOf = (): string =>
  readFileSync(fileURLToPath(new URL('../../src/clipbook/styles.css', import.meta.url)), 'utf8');

describe('clipbook 菜单换肤变量作用域（issue 222 修复轮）', () => {
  it('定义 --clip-paper 的规则选择器必须同时包含面板根与菜单根', () => {
    const css = cssOf();
    const def = css.indexOf('--clip-paper');
    expect(def).toBeGreaterThan(-1);
    // 定义所在规则：向前找最近的 '{'，取其前的选择器段
    const selector = css.slice(0, css.lastIndexOf('{', def));
    // 选择器段回溯到上一个规则的 '}'（避免把前面无关规则并进来）
    const prevClose = selector.lastIndexOf('}');
    expect(selector.slice(prevClose + 1)).toContain('.bz-clip-frame');
    expect(selector.slice(prevClose + 1)).toContain('.bz-item-menu.bz-clip-menu-editorial');
  });

  it('菜单换肤块消费的 --clip-* 变量全部有定义', () => {
    const css = cssOf();
    // 定义块 = --clip-paper 所在规则体（变量块无嵌套花括号）
    const def = css.indexOf('--clip-paper');
    const defined = new Set(
      [...css.slice(css.lastIndexOf('{', def), css.indexOf('}', def)).matchAll(/(--clip-[a-z0-9-]*)\s*:/g)].map((x) => x[1]),
    );
    // 消费块 = 「右键菜单编辑部换肤」注释起，至「右键菜单头」注释止
    const start = css.indexOf('右键菜单编辑部换肤');
    const end = css.indexOf('右键菜单头');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const used = [...css.slice(start, end).matchAll(/var\((--clip-[a-z0-9-]*)/g)].map((x) => x[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const v of used) expect(defined.has(v)).toBe(true);
  });
});

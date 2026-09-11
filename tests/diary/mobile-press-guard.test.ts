// @vitest-environment node
/* ============================================================
 * 日记本移动端长按手势守卫（用户真机报告，2026-09-11）
 *
 *   长按 = 抽屉唯一入口（core/dom.longPress，500ms 计时）。条目正文若 user-select:text，
 *   真机长按正文时系统文本选择接管 → touchcancel 掐死计时 → 抽屉永不出（用户看到的
 *   「右键菜单」即系统选择浮标）。favorites/belongings/cinema 卡片均 user-select:none
 *   故无此症；diary 是全插件唯一开了 text 豁免的域（issue 217 正文可复制）——
 *   移动端必须收回豁免（桌面保留选中复制不受影响）。
 *
 * 本文件只做**样式源静态断言**（不跑 jsdom），与 tests/cinema/mobile-3fix-guard.test.ts 同款手法。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(process.cwd(), 'src/diary/styles.css'), 'utf8');

/** 取某条规则的声明块（选择器后第一个 {...}；diary styles.css 经 prettier，选择器与 { 有空格） */
function rule(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `规则 ${selector} 应存在`).toBeGreaterThan(-1);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('移动端长按手势 vs 正文选中豁免（issue 217）', () => {
  it('正文 user-select:text 豁免已退役（2026-09-11 用户拍板两端取消，防回归）', () => {
    const dec = rule('.bz-diary-text-tx');
    expect(dec, '正文卡规则不得再开选择豁免').not.toMatch(/user-select/);
    // 整个域样式不得再出现任何 user-select:text——系统选择接管会掐死长按抽屉计时
    expect(css).not.toMatch(/user-select:\s*text/);
  });
});

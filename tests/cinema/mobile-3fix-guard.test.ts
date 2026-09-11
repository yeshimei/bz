// @vitest-environment node
/* ============================================================
 * 影院移动端三缺陷守卫（用户真机报告，2026-09-10）
 *
 *   A. 移动端面板不全屏 —— 探索稿那套「手机模型框」（396×780 + 10px 黑边框 + 26px 圆角）
 *      落域时被照搬进插件，真机上等于在手机屏幕里再画一台手机。全插件移动端
 *      （belongings/bookshelf/diary/favorites/home/memo/recap/secondbrain）都走
 *      100vw×100vh，影院曾是唯一异类。
 *   B. 长按弹的是桌面右键菜单 —— 触屏长按同时发 pointerdown + contextmenu，右键菜单
 *      没按端分流就盖在抽屉上（行为断言在 tests/cinema/ui.test.ts）。
 *   C. 定尺方形图标钮不居中 —— width/height 定尺 + place-items:center，却没钉死宿主
 *      app.css 裸 button 基线的 padding（手机 4px 12px、平板 .is-tablet button 4px 20px）。
 *      不钉死时 border-box 盒子被 padding 撑破：实测 30px 的 m-tool 在平板口径下变 34~42px。
 *
 * 本文件只做**样式源静态断言**（不跑 jsdom、不加载构建产物），
 * 与 tests/memo/mobile-ui-3fix.test.ts（issue 266）同款手法。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(process.cwd(), 'src/cinema/styles.css'), 'utf8');

/** 取某条规则的声明块（选择器后第一个 {...}） */
function rule(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `规则 ${selector} 应存在`).toBeGreaterThan(-1);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('A. 移动端面板真机全屏', () => {
  const dec = rule('.bz-cinema--midnight.mob{');

  it('面板铺满视口（100vw × --bz-vvh），不再有手机模型框的定尺与边框', () => {
    expect(dec).toMatch(/width:100vw/);
    expect(dec).toMatch(/height:var\(--bz-vvh,100vh\)/);
    expect(dec, '探索稿的 396×780 定尺应退役').not.toMatch(/width:396px/);
    expect(dec).not.toMatch(/height:780px/);
    expect(dec, '外圈黑边框/圆角是手机模型框的残留').not.toMatch(/border:10px solid/);
    expect(dec).not.toMatch(/border-radius:26px/);
    // 桌面基类带 1px 边框 + 14px 圆角，全屏面板必须在自己这层清掉，否则真机四角有描边/圆角
    expect(dec).toMatch(/border:0/);
    expect(dec).toMatch(/border-radius:0/);
  });
});

describe('C. 右上角钮组（m-acts）图标精确居中', () => {
  // 只覆盖右上角这组：＋（.m-head .add）与 AI/分析/关闭（.m-tool）。
  // 其他按钮（弹窗关闭钮 cn-modal-x / 返回钮 sp-back / chips / rail）不在守卫内——
  // 用户明确要求「只修右上角按钮，不动其他按钮样式」。
  for (const [sel, icSel, icon] of [
    ['.bz-cinema--midnight .m-tool{', '.bz-cinema--midnight .m-tool .bz-ic{', 15],
    ['.bz-cinema--midnight .m-head .add{', '.bz-cinema--midnight .m-head .add .bz-ic{', 16],
  ] as const) {
    it(`${sel} 定尺 + 显式 padding:0 !important`, () => {
      const d = rule(sel);
      // !important 必需：宿主 `.is-tablet button:not(.clickable-icon)` 特异性 (0,2,1) > 本类 (0,2,0)
      expect(d).toMatch(/padding:0 !important/);
      expect(d).toMatch(/width:\d+px/);
      expect(d).toMatch(/height:\d+px/);
      expect(d).toMatch(/display:grid/);
    });

    // 偏移根因守卫：core 的 .bz-ic 是 width/height:1em（跟宿主 button 字号走），小于 svg 时
    // 图标从容器左上角溢出 → 实测中心偏右下 1~1.5px。容器尺寸必须与 svg 尺寸一致。
    it(`${icSel} 图标容器与 svg 同尺寸（${icon}px）`, () => {
      const d = rule(icSel);
      expect(d).toMatch(new RegExp(`width:${icon}px`));
      expect(d).toMatch(new RegExp(`height:${icon}px`));
    });
  }

  it('其他按钮未被波及（cn-modal-x 已随关闭钮退役 issue 271；sp-back 无 padding 钉死）', () => {
    expect(css.includes('.cn-modal-x')).toBe(false);
    expect(rule('.bz-cinema--midnight .sp-back{')).not.toMatch(/padding/);
  });
});

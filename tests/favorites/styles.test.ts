// @vitest-environment node
/**
 * 收藏本 CSS 合规回归（review-bel-fav-ux C 线：样式断言读源文件文本，jsdom 不解析 css）。
 * 覆盖：C1 选择器健壮性 + 原型 core 链 / C2 原型 mask 挂 scope / C7 死类删除 /
 * C8 ID 选择器退役 / C9 触控档 --xl / C10 图标尺寸对齐 c5 基准 / C11 z-index 兜底注释 /
 * C12 原型演示钩子对齐插件契约 / C16 core reset 注释如实。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const favCss = () => repo('src/favorites/styles.css');
const favUi = () => repo('src/favorites/ui.ts');
const favProto = () => repo('src/favorites/prototype.html');

describe('C1：域选择器脱离 core reset 同分顺序对抗 + 原型 core 链', () => {
  it('styles.css 磁贴/右键菜单 button 基础规则挂 .bz-fav-scope 前缀（(0,2,1)）', () => {
    const css = favCss();
    expect(css).toContain('.bz-fav-scope .bz-fav-tags button {');
    expect(css).toContain('.bz-fav-scope .bz-fav-ctx button {');
    // 不再有无前缀的 (0,1,1) 基础规则残留
    expect(css).not.toMatch(/^\.bz-fav-tags button \{/m);
    expect(css).not.toMatch(/^\.bz-fav-ctx button \{/m);
  });

  it('prototype.html link 链与 build-css SOURCES 同序（core 三份 → 域样式）', () => {
    const proto = favProto();
    const stylesIdx = proto.indexOf('../core/styles.css');
    const tokensIdx = proto.indexOf('../core/ui/tokens.css');
    const componentsIdx = proto.indexOf('../core/ui/components.css');
    const domainIdx = proto.indexOf('"./styles.css"');
    for (const idx of [stylesIdx, tokensIdx, componentsIdx, domainIdx]) {
      expect(idx, '原型缺 link 链一环').toBeGreaterThan(-1);
    }
    expect(stylesIdx).toBeLessThan(tokensIdx);
    expect(tokensIdx).toBeLessThan(componentsIdx);
    expect(componentsIdx).toBeLessThan(domainIdx);
  });
});

describe('C2：原型两处动态 mask 挂 bz-fav-scope（评审壳变量生效）', () => {
  it('confirmDlg / openForm 的 mask className 带 scope；无裸 bz-fav-form-mask 赋值残留', () => {
    const proto = favProto();
    expect(proto.match(/bz-fav-form-mask bz-fav-scope/g)?.length).toBe(2);
    expect(proto).not.toContain("= 'bz-fav-form-mask';");
  });
});

describe('C7/C8：表单按钮类名合规', () => {
  it('C7：bz-fav-pick-btn 死类已删（两端 CSS/原型均无此选择器）', () => {
    expect(favUi()).not.toContain('bz-fav-pick-btn');
    expect(favCss()).not.toContain('bz-fav-pick-btn');
    expect(favProto()).not.toContain('bz-fav-pick-btn');
  });

  it('C8：#fz-ai ID 选择器退役 → .bz-fav-ai-btn 类（ui.ts 模板与原型同步，#fz-ai 锚点保留供 JS/测试）', () => {
    expect(favCss()).not.toContain('#fz-ai');
    expect(favCss()).toContain('.bz-fav-form .bz-fav-btns .bz-fav-ai-btn {');
    expect(favUi()).toContain('<button type="button" id="fz-ai" class="bz-fav-ai-btn">');
    expect(favProto()).toContain('id="fz-ai" class="bz-fav-ai-btn"');
  });
});

describe('C9：移动关闭钮触控档 --xl', () => {
  it('mob-close 挂基类 + --xl 修饰（24px 钮：--xl inset -12px 补足 ≥44px；基类承载 ::after 外扩本体）', () => {
    // 核实 core 变体真实存在且外扩本体在基类（--xl 只设变量）
    const core = repo('src/core/ui/components.css');
    expect(core).toContain('.bz-touch-target--xl { --bz-touch-outset: -12px; }');
    expect(core).toMatch(/\.bz-touch-target::after\s*\{[^}]*inset: var\(--bz-touch-outset, -6px\)/);
    expect(favUi()).toContain('bz-fav-mob-close bz-touch-target bz-touch-target--xl');
  });
});

describe('C10：图标尺寸对齐 c5 基准（ADR-0101 1:1 恢复）', () => {
  it('抽屉动作行 15px（c5 动作按钮 icon(a.ic, 15)）+ 卡片标签徽记 11px（域内原型 icon(ic, 11)）', () => {
    const css = favCss();
    const sheetRule = css.match(/\.bz-fav-sheet \.bz-ic\s*\{[^}]*\}/);
    expect(sheetRule, '缺抽屉图标尺寸规则').not.toBeNull();
    expect(sheetRule![0]).toContain('width: 15px');
    expect(sheetRule![0]).toContain('height: 15px');
    // tagb 覆盖对抗 core .bz-ic--xs（12px !important）须同带 !important
    const tagbRule = css.match(/\.bz-fav-card \.bz-fav-tagb \.bz-ic\s*\{[^}]*\}/);
    expect(tagbRule, '缺标签徽记图标尺寸规则').not.toBeNull();
    expect(tagbRule![0]).toContain('width: 11px !important');
    expect(tagbRule![0]).toContain('height: 11px !important');
  });
});

describe('C11：静态 z-index 标注原型兜底', () => {
  it('ctx/sheet-mask/form-mask 三处 z-index 行带「原型兜底值，插件端以 topifyZ 为准」注释', () => {
    const css = favCss();
    expect(css.match(/原型兜底值，插件端以 topifyZ 为准/g)?.length).toBe(3);
    expect(css).toMatch(/z-index: 500; \/\* 原型兜底值/);
    expect(css).toMatch(/z-index: 400; \/\* 原型兜底值/);
    expect(css).toMatch(/z-index: 600; \/\* 原型兜底值/);
  });
});

describe('C12：原型表单演示钩子对齐插件契约', () => {
  it('取消= data-fz-cancel / 保存= id="fz-save"（模板与演示 JS 同步；确认框演示壳 data-a 不在约束内）', () => {
    const proto = favProto();
    expect(proto).toContain('<button type="button" data-fz-cancel>取消</button>');
    expect(proto).toContain('id="fz-save" class="bz-fav-pri"');
    // 演示 JS 委托改走 closest 契约钩子
    expect(proto).toContain("e.target.closest('[data-fz-cancel]')");
    expect(proto).toContain("e.target.closest('#fz-save')");
    expect(proto).not.toContain("e.target.dataset.a !== 'ok'");
  });
});

describe('C16：core reset 注释与实现相符', () => {
  it('button:not(.clickable-icon) 特异性如实标注 (0,1,1)，不再声称 :where 归零', () => {
    const reset = repo('src/core/reset.css');
    expect(reset).not.toContain(':where() 归零特异性'); // 原失实句式（实现并未用 :where）
    expect(reset).toContain('(0,1,1)');
    // 规则本体未被触碰
    expect(reset).toMatch(/button:not\(\.clickable-icon\) \{\s*color: unset;\s*background-color: unset;\s*box-shadow: unset;/);
  });
});

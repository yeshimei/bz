// @vitest-environment node
/**
 * B2（呈报#12）：归物本表单控件焦点去了但没有视觉反应 → 补 :focus-visible 焦点提示。
 * 病灶：styles.css「输入聚焦去轮廓」规则（:focus 去 outline/box-shadow）未给替代形态，
 * 键盘焦点在表单/详情输入框上不可见。修法：:focus-visible ring 替代（仅键盘焦点出现，
 * 鼠标点击不弹环，兼顾当初去 ring 的纸面顾虑），形态与全域焦点口径一致
 * （core components.css .bz-btn/.bz-icon-btn 等先例），色取域强调色贴海报皮。
 * 修复前必红：域样式表中不存在 :focus-visible 替代规则。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../../src/belongings/styles.css', import.meta.url)), 'utf8');

describe('B2：表单/详情输入框 :focus-visible 焦点替代', () => {
  it('修复前必红：表单与详情输入框存在 :focus-visible 替代 ring 规则', () => {
    expect(css).toContain('.bz-bel-form .bz-input:focus-visible');
    expect(css).toContain('.bz-bel-detail .bz-input:focus-visible');
  });

  it('替代形态 = outline ring（与全域 :focus-visible 口径一致），色取域强调色', () => {
    const m = css.match(/\.bz-bel-form \.bz-input:focus-visible[^{]*\{[^}]*\}/);
    expect(m, '替代规则应含 outline 声明').not.toBeNull();
    expect(m![0]).toContain('outline:');
    expect(m![0]).toContain('var(--bz-bel-accent)');
  });

  it('源序守卫：替代规则须在「去轮廓」规则之后（同特异性靠源序取胜）', () => {
    const strip = css.indexOf('.bz-bel-panel .bz-input:focus');
    const alt = css.indexOf('.bz-bel-form .bz-input:focus-visible');
    expect(strip).toBeGreaterThan(-1);
    expect(alt).toBeGreaterThan(strip);
  });
});

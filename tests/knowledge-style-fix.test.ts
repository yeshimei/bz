/**
 * issue 270 knowledge 三处无样式 UI 补齐回归：
 * - .bz-kb-brand（主壳面板头品牌区，ui.ts 桌面/移动两处）、.bz-lit-run-btn（视频批量处理钮 ▶️/⏹）、
 *   .bz-lit-ghost-btn（术语弹窗取消钮，与 .bz-lit-accent-btn 成对）在 src/knowledge/styles.css 有域内规则；
 * - 全部走 kb 纸墨皮 token（--ink/--ink2/--ink3/--line/--chip/--accent，.theme-dark .kb 自动暗色），新规则零硬编码色。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 review-fix-b.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const kbCss = () => repo('src/knowledge/styles.css');
const noHex = (rule: string) => expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);

describe('issue 270：knowledge 三处无样式 UI 补齐', () => {
  it('ui.ts 三处类钩子仍在（DOM 结构不动，样式全落域内 styles.css）', () => {
    const ui = repo('src/knowledge/ui.ts');
    expect(ui).toContain('class="bz-kb-brand"');
    expect(ui).toContain('bz-lit-run-btn');
    expect(ui).toContain('bz-lit-ghost-btn');
  });

  it('.bz-kb-brand：品牌区 flex 锁定居中 + accent 点墨短线（::after），零硬编码色', () => {
    const css = kbCss();
    const base = css.match(/\.bz-kb-brand\s*\{[^}]*\}/);
    expect(base, '缺 .bz-kb-brand 规则').not.toBeNull();
    expect(base![0]).toContain('display: flex');
    expect(base![0]).toContain('color: var(--ink)');
    noHex(base![0]);
    const tick = css.match(/\.bz-kb-brand::after\s*\{[^}]*\}/);
    expect(tick, '缺 .bz-kb-brand::after 点墨短线').not.toBeNull();
    expect(tick![0]).toContain('background: var(--accent)');
    noHex(tick![0]);
  });

  it('.bz-lit-run-btn：头行图标组内强调档，accent 软底 + hover 加深 + disabled 沉芯片底', () => {
    const css = kbCss();
    const base = css.match(/\.bz-lit-head-btns button\.bz-lit-run-btn\s*\{[^}]*\}/);
    expect(base, '缺 .bz-lit-run-btn 基础规则（须带 .bz-lit-head-btns 前缀压过同组 !important 档）').not.toBeNull();
    expect(base![0]).toContain('background: color-mix(in srgb, var(--accent)');
    noHex(base![0]);
    const hover = css.match(/\.bz-lit-head-btns button\.bz-lit-run-btn:hover\s*\{[^}]*\}/);
    expect(hover, '缺 hover 态').not.toBeNull();
    expect(hover![0]).toContain('background: color-mix(in srgb, var(--accent)');
    const disabled = css.match(/\.bz-lit-head-btns button\.bz-lit-run-btn:disabled\s*\{[^}]*\}/);
    expect(disabled, '缺 disabled 态').not.toBeNull();
    expect(disabled![0]).toContain('background: var(--chip)');
    expect(disabled![0]).toContain('cursor: default');
    noHex(disabled![0]);
  });

  it('.bz-lit-ghost-btn：ghost 档透底细边，hover 转芯片底；与 .bz-lit-accent-btn 相邻成对', () => {
    const css = kbCss();
    const base = css.match(/\.bz-lit-ghost-btn,\r?\n\.bz-lit-term-actions button\.bz-lit-ghost-btn\s*\{[^}]*\}/);
    expect(base, '缺 .bz-lit-ghost-btn 成对选择器规则').not.toBeNull();
    expect(base![0]).toContain('background: none');
    expect(base![0]).toContain('border: 1px solid var(--line)');
    noHex(base![0]);
    const hover = css.match(/\.bz-lit-term-actions button\.bz-lit-ghost-btn:hover\s*\{[^}]*\}/);
    expect(hover, '缺 hover 芯片底态').not.toBeNull();
    expect(hover![0]).toContain('background: var(--chip)');
    noHex(hover![0]);
    // 成对：ghost 规则紧跟 .bz-lit-accent-btn 档之后（同段维护）
    const accentIdx = css.indexOf('.bz-lit-accent-btn:disabled');
    const ghostIdx = css.indexOf('.bz-lit-ghost-btn,');
    expect(accentIdx).toBeGreaterThan(-1);
    expect(ghostIdx).toBeGreaterThan(accentIdx);
    expect(ghostIdx - accentIdx).toBeLessThan(400);
  });
});

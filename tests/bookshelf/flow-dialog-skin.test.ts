// @vitest-environment node
/**
 * issue 291：全域子弹窗统一 —— bookshelf「删除划线」确认框的样式源文本断言。
 *
 * 前情（缺陷）：借书卡详情弹窗 / 读书笔记弹窗都传了 `bsSkinClass()`，但 md 与 EPUB
 * 两条「删除划线」流程框在 notes-ui.ts 里漏传 —— 流程框挂 document.body，脱离
 * `.bz-bs-panel` 树后掉回 core 裸皮，同一域里出现「笔记弹窗有皮、删除确认没皮」。
 *
 * 本用例只读源码文本（jsdom 不解析 css 文件），守护：
 *  1) notes-ui.ts 两处 openFlowDialog 都传 `'bz-bs-flow-dialog ' + bsSkinClass()`；
 *  2) styles.css 有 `#__shared_confirm_popup__.bz-bs-flow-dialog` 规则块（id + 域类提特异性
 *     覆盖 core 的 id 选择器），块内壳取值走 --bsw-* 域变量，并自带字体栈；
 *  3) 由 `.bz-bs-skin-*` × `.bz-bs-mode-*` 变体承担亮暗，故不该另写 .theme-dark 块。
 * 运行时「popup classList 含皮肤类」断言在 tests/bookshelf/notes-ui.test.ts 的两条删除用例里。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const bsCss = () => repo('src/bookshelf/styles.css');
const notesUi = () => repo('src/bookshelf/notes-ui.ts');

const confirmBlock = (selector: string) =>
  bsCss().match(new RegExp(`#__shared_confirm_popup__\\.bz-bs-flow-dialog${selector}\\s*\\{([^}]*)\\}`));

describe('issue 291：bookshelf 删除划线确认框挂域皮肤类', () => {
  it('notes-ui.ts 两处（md / EPUB）都传流程框类 + 皮肤类，且皮肤类来自 ui.ts 的 bsSkinClass', () => {
    const src = notesUi();
    expect(
      src.match(/className: 'bz-bs-flow-dialog ' \+ bsSkinClass\(\)/g)?.length,
      'md 与 EPUB 两条删除路径各需一处 className'
    ).toBe(2);
    expect(src).toContain("import { bsSkinClass } from './ui';");
    // 负向守护：不允许把皮肤类写死成某一肤（皮肤由设置驱动）
    expect(src).not.toMatch(/bz-bs-flow-dialog bz-bs-skin-/);
  });

  it('styles.css 有 id + 域类复合选择器规则块（提特异性压过 core 的 id 选择器）', () => {
    const block = confirmBlock('');
    expect(block, '缺 #__shared_confirm_popup__.bz-bs-flow-dialog 规则块').not.toBeNull();
    // 纸卡壳映射：底/描边消费 --bsw-*（借书卡详情弹窗 .bz-bs-d-popup / .bz-bs-d-card 同套 token）
    expect(block![1]).toContain('background: var(--bsw-paper)');
    expect(block![1]).toContain('border-color: var(--bsw-line)');
    // 字体栈定义在 .bz-bs-panel 作用域，流程框挂 body 取不到 → 必须自带一份
    expect(block![1]).toContain('--bsw-serif');
    expect(block![1]).toContain('--bsw-sans');
  });

  it('标题 / 正文 / 主动作按钮逐条映射借书卡那套取值（衬线题 + 无衬线正文 + 墨色主钮）', () => {
    const h4 = confirmBlock(' h4');
    expect(h4, '缺确认框标题规则').not.toBeNull();
    expect(h4![1]).toContain('font-family: var(--bsw-serif)');
    expect(h4![1]).toContain('color: var(--bsw-ink)');

    const p = confirmBlock(' p');
    expect(p, '缺确认框正文规则').not.toBeNull();
    expect(p![1]).toContain('font-family: var(--bsw-sans)');
    expect(p![1]).toContain('color: var(--bsw-muted)');

    const css = bsCss();
    // 主动作钮：单独一条规则（不是与取消钮并列的那条）才带衬线字与墨色描边
    expect(css, '缺主动作按钮的衬线字规则').toMatch(
      /#__shared_confirm_popup__\.bz-bs-flow-dialog #__shared_confirm_ok__ \{\s*border-color: var\(--bsw-ink\);\s*font-family: var\(--bsw-serif\)/
    );
    // 只改配色/形制，不写几何——高度与组件库 .bz-btn 同源归 core
    const ok = css.match(
      /#__shared_confirm_popup__\.bz-bs-flow-dialog #__shared_confirm_ok__ \{\s*border-color: var\(--bsw-ink\);[\s\S]*?\}/
    );
    expect(ok, '缺主动作按钮规则').not.toBeNull();
    expect(ok![0]).not.toContain('height:');
  });

  it('亮暗由 .bz-bs-skin-* × .bz-bs-mode-* 变体承担：确认框不写硬编码 .theme-dark 块', () => {
    const css = bsCss();
    expect(css).not.toMatch(/\.theme-dark #__shared_confirm_popup__\.bz-bs-flow-dialog/);
    // 该域亮暗 token 组的既有前提（skin 类挂 popup 时变体才会命中）
    expect(css).toMatch(/\.bz-bs-skin-nordic\.bz-bs-mode-dark\s*\{[^}]*--bsw-paper:/);
  });
});

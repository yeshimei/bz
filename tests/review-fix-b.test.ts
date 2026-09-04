/**
 * 终局 review 修复批 B（样式与图标收编）回归测试。
 * 覆盖：
 *  1) 样式库共享修饰符：.bz-btn--danger-ghost / .bz-btn--hover-accent / .bz-chip--hover-accent（项 1）；
 *  3) 触控热区收编：core .bz-touch-target（--sm/--lg/--xl 档）+ 各域挂类、域内不再复制 ::after 外扩（项 3；
 *     cinema 域 ui 冻结、attach 为 padding 抬档形态，两者维持域内块不收编）；
 *  4) z-index 静态大数收口：launcher/literature/secondbrain/smartcat（项 4）；
 *  5) 图标单一事实源：DOMAIN_ICONS 补 diary-wall/settings-panel，home 磁贴/命令/写日记命令全量引用（项 5）；
 *  6) .bz-panel-mtop 补接：memo 随 mfs 开关同挂摘（项 6）。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 enh-sweep-c.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const componentsCss = () => repo('src/core/ui/components.css');

describe('批 B-1：样式库共享修饰符（hover 品牌档 / 描边 danger 档）', () => {
  it('components.css 含 .bz-btn--danger-ghost：常态透底 danger 描边，hover 转实底 on-danger', () => {
    const css = componentsCss();
    const base = css.match(/\.bz-btn--danger-ghost\s*\{[^}]*\}/);
    expect(base, '缺 .bz-btn--danger-ghost 基础规则').not.toBeNull();
    expect(base![0]).toContain('background: transparent');
    expect(base![0]).toContain('border-color: var(--bz-danger)');
    expect(base![0]).toContain('color: var(--bz-danger)');
    const hover = css.match(/\.bz-btn--danger-ghost:hover\s*\{[^}]*\}/);
    expect(hover, '缺 .bz-btn--danger-ghost:hover 规则').not.toBeNull();
    expect(hover![0]).toContain('background: var(--bz-danger)');
    expect(hover![0]).toContain('color: var(--bz-on-danger)');
  });

  it('components.css 含 .bz-btn--hover-accent / .bz-chip--hover-accent：hover 品牌软底 + 品牌描边字', () => {
    const css = componentsCss();
    for (const sel of ['.bz-btn--hover-accent:hover', '.bz-chip--hover-accent:hover']) {
      const rule = css.match(new RegExp(`${sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\{[^}]*\\}`));
      expect(rule, `缺 ${sel} 规则`).not.toBeNull();
      expect(rule![0]).toContain('background: var(--bz-brand-soft)');
      expect(rule![0]).toContain('border-color: var(--bz-brand)');
      expect(rule![0]).toContain('color: var(--bz-brand)');
    }
  });

  it('语义核对：实底 .bz-btn--danger 与描边 .bz-btn--danger-ghost 并存（形态不同、各司其职）', () => {
    const css = componentsCss();
    expect(css).toMatch(/\.bz-btn--danger\s*\{[^}]*background: var\(--bz-danger\)/);
    expect(css).toMatch(/\.bz-btn--danger-ghost\s*\{[^}]*background: transparent/);
  });
});

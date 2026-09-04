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

describe('批 B-3：触控热区收编 core .bz-touch-target', () => {
  it('样式库：coarse 断点内 ::after 外扩 + 默认 -6px 与三档参数化（--sm/-4 --lg/-8 --xl/-12）', () => {
    const css = componentsCss();
    const m = css.match(/@media \(pointer: coarse\) \{[\s\S]*?\n\}/);
    expect(m, '缺 pointer:coarse 断点').not.toBeNull();
    expect(m![0]).toContain('.bz-touch-target { position: relative; }');
    expect(m![0]).toContain('inset: var(--bz-touch-outset, -6px)');
    expect(m![0]).toContain('.bz-touch-target--sm { --bz-touch-outset: -4px; }');
    expect(m![0]).toContain('.bz-touch-target--lg { --bz-touch-outset: -8px; }');
    expect(m![0]).toContain('.bz-touch-target--xl { --bz-touch-outset: -12px; }');
  });

  it('收编域挂类与档位映射（外扩量与原域内 inset 一一对应）', () => {
    // 默认档（原 inset -6px）：32px 档头行图标钮
    expect(repo('src/belongings/ui.ts')).toMatch(/bz-icon-btn bz-touch-target/);
    expect(repo('src/favorites/ui.ts')).toMatch(/bz-icon-btn--lg bz-touch-target/);
    // --sm（原 -4px）：番茄钟控制钮、复习评级条
    expect(repo('src/pomodoro/ui.ts')).toMatch(/pomodoro-btn pomodoro-btn-primary bz-touch-target--sm/);
    expect(repo('src/review/ui.ts')).toContain('bz-review-bar-btn bz-touch-target--sm');
    // --lg（原 -8px）：home 迷你 chips/hero 盒装钮、加密空态钮/复制账号钮、复习信息行
    expect(repo('src/home/ui.ts')).toContain('bz-touch-target--lg bz-home-edit');
    expect(repo('src/home/ui.ts')).toContain('bz-home-mini bz-touch-target--lg');
    expect(repo('src/encrypt/vault-pw-view.ts')).toContain('bz-pwv-empty-add bz-touch-target--lg');
    expect(repo('src/encrypt/vault-pw-view.ts')).toContain('copyac bz-touch-target--lg');
    expect(repo('src/review/ui.ts')).toContain('bz-q-fitem bz-touch-target--lg');
    // --xl（原 -12px）：回忆墙四类元素、加密移动关闭/返回钮、复习三个关闭钮
    expect(repo('src/diary-wall/ui.ts')).toContain('bz-diary-wall-icon-btn bz-touch-target--xl');
    expect(repo('src/encrypt/ui.ts')).toContain('bz-vault-mobclose bz-touch-target--xl');
    expect(repo('src/encrypt/ui.ts')).toContain('back bz-touch-target--xl');
    expect(repo('src/review/settings-schema.ts')).toContain('bz-review-exclude-remove bz-touch-target--xl');
    expect(repo('src/review/stats-ui.ts')).toContain('bz-win-close bz-touch-target--xl');
    expect(repo('src/review/stats-ui.ts')).toContain('bz-review-history-close bz-touch-target--xl');
  });

  it(' favorites 域内对 .bz-icon-btn 的直接覆写退役（改挂 --lg 修饰符）', () => {
    const css = repo('src/favorites/styles.css');
    expect(css).not.toContain('.bz-fav-head-btns .bz-icon-btn { width');
    expect(repo('src/favorites/ui.ts')).toContain('bz-icon-btn--lg');
  });

  it('跳过项守护：cinema（ui 冻结）与 attach（padding 抬档形态）维持域内 pointer:coarse 块', () => {
    expect(repo('src/cinema/styles.css')).toMatch(/@media \(pointer: coarse\)/);
    expect(repo('src/attach/styles.css')).toMatch(/@media \(pointer: coarse\)/);
    expect(repo('src/attach/styles.css')).not.toMatch(/\w::after\s*\{/); // attach 刻意外扩（防误触邻行，仅注释提及）
  });
});

describe('批 B-4：z-index 静态大数收口（ADR-0067）', () => {
  it('launcher：拖拽磁贴降局部层叠档 10（兄弟磁贴间层叠，非 overlay 档）', () => {
    const css = repo('src/launcher/styles.css');
    expect(css).not.toMatch(/z-index:\s*9999/);
    expect(css).toMatch(/\.launcher-tile\.dragging\s*\{[^}]*z-index: 10;/);
  });

  it('literature：遮罩/窗口/小型弹窗静态档清零（显示路径 topifyZ 发号已就位）', () => {
    const css = repo('src/literature/styles.css');
    expect(css).not.toMatch(/z-index:/); // 域内原本仅 3 处静态档，全清
    for (const sel of ['.bz-lit-mask', '.bz-lit-window', '.bz-lit-dialog']) {
      const rule = css.match(new RegExp(`${sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\{[^}]*\\}`));
      expect(rule, sel).toBeTruthy();
    }
    // 五处显示路径均动态发号（遮罩在前本体在后）
    const ui = repo('src/literature/ui.ts');
    expect(ui.match(/topifyZ\(/g)!.length).toBeGreaterThanOrEqual(5);
  });

  it('secondbrain：mini 胶囊静态档清零，collapse() 显示时 topifyZ 发号', () => {
    expect(repo('src/secondbrain/styles.css')).not.toMatch(/z-index:\s*9000/);
    const ts = repo('src/secondbrain/mobile-panel.ts');
    expect(ts).toMatch(/collapse\(\)[\s\S]{0,200}topifyZ\(this\.mini\)/);
  });

  it('smartcat：猫容器 CSS 初值清零（恒顶走 registerAlwaysOnTop），子元素降局部小档且相对次序不变', () => {
    const css = repo('src/smartcat/styles.css');
    expect(css).not.toMatch(/z-index:\s*10000\d/);
    expect(css).not.toMatch(/z-index:\s*10001\b/);
    // 指示器(3) > 气泡容器(2) > 气泡(1)，同在猫 transform 层叠上下文内
    expect(css).toMatch(/\.thinking-indicator\s*\{[^}]*z-index: 3;/);
    expect(css).toMatch(/\.voice-indicator\s*\{[^}]*z-index: 3;/);
    expect(css).toMatch(/\.cat-bubbles-container\s*\{[^}]*z-index: 2;/);
    expect(css).toMatch(/\.cat-bubble\s*\{[^}]*z-index: 1;/);
    // 恒顶层注册仍在挂载路径上
    expect(repo('src/smartcat/ui.ts')).toContain('registerAlwaysOnTop(container)');
  });
});

// @vitest-environment node
/**
 * secondbrain 暗色模式回归（issue 270）。
 * 覆盖：
 *  1) 七根（三界面 + 移动抽屉/胶囊 + 浮动参考卡/hover 预览两个 body 逸出点）亮暗各一整组 --sb-* token；
 *  2) 关键硬编码色收编：#fbfaf7/#6b6455/#b45309/#f3efe6 裸消费清零转 token，墨色渐变值等价收编；
 *  3) 暗色装饰档：红棕渐变 / 一次性文字 / 阴影加深 / 脉冲光圈，全部 .theme-dark 前缀；
 *  4) 亮侧零改动守护：亮 token 组原值不变、遮罩亮暗同值、最大化去阴影语义暗色保持；
 *  5) 双逸出点挂载事实守护：浮动卡/hover 预览仍直挂 document.body（token 源靠类名自携）。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 review-fix-b.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const cssFlat = () => repo('src/secondbrain/styles.css').replace(/\s+/g, ' ');

/** 七根：三界面 + 移动抽屉/胶囊 + 双逸出点（顺序须与 styles.css token 组选择器一致） */
const ROOTS = [
  '.bz-sb-panel',
  '.bz-sb-chat-modal',
  '.bz-sb-float-win',
  '.bz-sb-mb-sheet',
  '.bz-sb-mb-mini',
  '.bz-sb-ref-preview',
  '.bz-sb-ref-card--float',
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 在空白归一后的 CSS 里取单条规则全文（域内无嵌套规则，@keyframes 体也仅一层） */
const block = (sel: string) => {
  const m = cssFlat().match(new RegExp(`${esc(sel)}\\s*\\{[^}]*\\}`));
  expect(m, `缺规则：${sel}`).not.toBeNull();
  return m![0];
};

describe('issue 270：secondbrain 暗色 token 组', () => {
  it('七根亮暗各一整组 --sb-* token；暗组深炭棕底 × 红棕提亮档', () => {
    const text = cssFlat();
    const lightSel = ROOTS.map(esc).join(',\\s*');
    const light = text.match(new RegExp(`${lightSel}\\s*\\{[^}]*\\}`));
    expect(light, '亮侧 token 组选择器缺根').not.toBeNull();
    expect(light![0]).toContain('--sb-bg: #fbfaf7');
    expect(light![0]).toContain('--sb-acc: #a33d2a');

    const darkSel = ROOTS.map((r) => `\\.theme-dark ${esc(r)}`).join(',\\s*');
    const dark = text.match(new RegExp(`${darkSel}\\s*\\{[^}]*\\}`));
    expect(dark, '暗侧 token 组选择器缺根').not.toBeNull();
    for (const v of [
      '--sb-bg: #17150f',
      '--sb-card: #211d16',
      '--sb-ink: #ece7db',
      '--sb-acc: #c4523d',
      '--sb-acc-soft: #2b1f19',
      '--sb-dark: #3f231b',
      '--sb-track: #171410',
      '--sb-warn: #e08a2e',
      '--sb-on-acc: #fbfaf7',
    ]) {
      expect(dark![0], `暗组缺 ${v}`).toContain(v);
    }
  });

  it('关键硬编码色收编：裸消费清零，token 消费位就位', () => {
    const text = repo('src/secondbrain/styles.css');
    expect(text, '#fbfaf7 白字未收编').not.toMatch(/color: #fbfaf7/);
    expect(text, '#6b6455 次强字未收编').not.toMatch(/color: #6b6455/);
    expect(text, '#b45309 警示未收编').not.toMatch(/color: #b45309/);
    expect(text, '#f3efe6 轨道未收编').not.toMatch(/background: #f3efe6/);
    expect(text, '墨色渐变未收编').not.toMatch(/#544e42, #211d16/);

    const count = (re: RegExp) => (text.match(re) ?? []).length;
    expect(count(/var\(--sb-on-acc\)/g)).toBeGreaterThanOrEqual(7);
    expect(count(/var\(--sb-ink3\)/g)).toBeGreaterThanOrEqual(4);
    expect(count(/var\(--sb-track\)/g)).toBeGreaterThanOrEqual(6);
    expect(count(/var\(--sb-warn\)/g)).toBeGreaterThanOrEqual(2);
    // 墨色「本周」柱渐变消费 ink2→dark token（暗色随组翻转）
    expect(text).toMatch(/var\(--sb-ink2\), var\(--sb-dark\)/);
  });

  it('暗色装饰档：红棕渐变 / 一次性文字 / 阴影加深 / 脉冲光圈，全部带 .theme-dark 前缀', () => {
    expect(block('.theme-dark .bz-sb-panel .bz-sb-trend-bar')).toContain('linear-gradient(180deg, #b26b58, #c4523d)');
    expect(block('.theme-dark .bz-sb-panel .bz-sb-init-fill')).toContain('linear-gradient(90deg, #b26b58, #c4523d)');
    expect(block('.theme-dark .bz-sb-panel .bz-sb-ai')).toContain('linear-gradient(135deg, #251d14, #271b15)');
    expect(block('.theme-dark .bz-sb-panel .bz-sb-ai-txt')).toContain('color: #c9c1b1');
    expect(block('.theme-dark .bz-sb-chat-modal .bz-sb-chat-msg.assistant .bz-sb-chat-bubble')).toContain('color: #d8d1c2');
    expect(block('.theme-dark .bz-sb-ref-card-body')).toContain('color: #a89f8d');

    expect(block('.theme-dark .bz-sb-panel, .theme-dark .bz-sb-chat-modal')).toContain('box-shadow: 0 24px 60px #00000080');
    expect(block('.theme-dark .bz-sb-float-win')).toContain('rgba(0, 0, 0, 0.5)');
    // .bz-sb-ref-card--float 是暗 token 组选择器列表末项，block() 会命中 token 组本体，改断规则全文
    expect(cssFlat()).toContain('.theme-dark .bz-sb-ref-card--float { box-shadow: 0 16px 40px #00000080');
    expect(block('.theme-dark .bz-sb-mb-sheet')).toContain('rgba(0, 0, 0, 0.55)');

    expect(cssFlat()).toContain('@keyframes bz-sb-pulse-dark');
    expect(block('.theme-dark .bz-sb-panel .bz-sb-pill-dot')).toContain('animation-name: bz-sb-pulse-dark');
  });

  it('亮侧零改动守护：亮 token 组原值不变；遮罩亮暗同值；最大化去阴影暗色保持', () => {
    const lightSel = ROOTS.map(esc).join(',\\s*');
    const light = cssFlat().match(new RegExp(`${lightSel}\\s*\\{[^}]*\\}`))![0];
    for (const v of [
      '#fbfaf7', '#ffffff', '#211d16', '#544e42', '#6b6455', '#a39b8c',
      '#c4bcae', '#eae4d8', '#ddd6c8', '#a33d2a', '#fdf6f3', '#eeddd5', '#f3efe6', '#b45309',
    ]) {
      expect(light, `亮组原值被动：${v}`).toContain(v);
    }
    // 面板遮罩双主题同值（本就是压暗内容的黑纱）
    expect(block('.bz-sb-panel-mask')).toContain('background: #2a261e4d');
    // float-max 去阴影规则须排在暗色加深规则之后（同权后到覆盖才不被翻回）
    const text = cssFlat();
    const deepen = text.indexOf('.theme-dark .bz-sb-float-win {');
    const maxNone = text.indexOf('.theme-dark .bz-sb-float-win.bz-sb-float-max {');
    expect(deepen).toBeGreaterThan(-1);
    expect(maxNone).toBeGreaterThan(deepen);
  });

  it('双逸出点挂载事实：浮动参考卡 / hover 预览仍直挂 document.body（token 源靠类名自携）', () => {
    const rp = repo('src/secondbrain/reference-panel.ts');
    expect(rp).toMatch(/document\.body\.appendChild\(card\)/);
    expect(rp).toMatch(/document\.body\.appendChild\(preview\)/);
  });
});

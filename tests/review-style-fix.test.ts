/**
 * issue 270（review 批）回归测试：quiz 会话弹窗样式恢复 + 统计/历史弹窗内联收编。
 * 覆盖：
 *  1) quiz-core 会话弹窗（session.ts）样式恢复——9c603ed7 并入 review 时 src/quiz/styles.css
 *     96 行被删未迁入，现恢复进 src/review/styles.css 并做 --bz-* token 对档（A 项）；
 *  2) stats-ui.ts 内联样式收编——静态值迁入 .bz-stats-* / .bz-review-history-* 类，
 *     仅数据驱动动态色（PASTEL_CARDS/accent/RATING_COLORS/width/height）与行为性
 *     display/zIndex 保留行内（B 项）。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 review-fix-b.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const reviewCss = () => repo('src/review/styles.css');
const statsUi = () => repo('src/review/stats-ui.ts');

describe('issue 270-A：quiz-core 会话弹窗样式恢复', () => {
  it('关键选择器全部存在于 src/review/styles.css（session.ts DOM 契约）', () => {
    const css = reviewCss();
    const selectors = [
      '#quiz-mask',
      '#quiz-popup',
      '.bz-quiz-head',
      '.bz-quiz-title',
      '.bz-quiz-question',
      '.bz-quiz-options',
      '.bz-quiz-option-text',
      '.quiz-option-btn',
      '.quiz-option-btn:hover:not(.disabled)',
      '.quiz-option-btn.correct',
      '.quiz-option-btn.wrong',
      '.quiz-option-btn.selected',
      '.quiz-option-btn .check-mark',
      '.quiz-option-btn.selected .check-mark',
      '.quiz-submit-btn',
      '.quiz-submit-btn:disabled',
      '.quiz-next-btn',
    ];
    for (const sel of selectors) {
      expect(css.includes(sel), `缺选择器 ${sel}`).toBe(true);
    }
  });

  it('配色消费 --bz-* token：弹窗壳/选项/对错态/按钮均不落 Obsidian 原生变量', () => {
    const css = reviewCss();
    const grab = (sel: string) => {
      const escaped = sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
      expect(m, `缺 ${sel} 规则`).not.toBeNull();
      return m![1];
    };
    // 弹窗壳规格对齐组件库 modal（--bz-radius-md / --bz-shadow-lg / 82vh 限高）
    const popup = grab('#quiz-popup');
    expect(popup).toMatch(/background:\s*var\(--bz-surface-2\)/);
    expect(popup).toMatch(/border-radius:\s*var\(--bz-radius-md\)/);
    expect(popup).toMatch(/box-shadow:\s*var\(--bz-shadow-lg\)/);
    expect(popup).toContain('max-height: 82vh');
    // 遮罩用 --bz-overlay，毛玻璃按设计手册明确不采用
    expect(grab('#quiz-mask')).toMatch(/background:\s*var\(--bz-overlay\)/);
    expect(grab('#quiz-mask')).not.toContain('backdrop-filter');
    // 对错态语义色
    expect(grab('.quiz-option-btn.correct')).toContain('var(--bz-success)');
    expect(grab('.quiz-option-btn.wrong')).toContain('var(--bz-danger)');
    expect(grab('.quiz-option-btn.selected')).toContain('var(--bz-brand)');
    // 提交钮品牌底 + 品牌上文字
    const submit = grab('.quiz-submit-btn');
    expect(submit).toMatch(/background:\s*var\(--bz-brand\)/);
    expect(submit).toMatch(/color:\s*var\(--bz-on-brand\)/);
  });

  it('quiz 分节零残留：无 Obsidian 原生变量、无硬编码对错色、无毛玻璃', () => {
    const section = reviewCss().slice(reviewCss().indexOf('quiz-core 会话弹窗样式恢复'));
    expect(section).not.toContain('backdrop-filter');
    expect(section).not.toMatch(/var\(--background-/);
    expect(section).not.toMatch(/var\(--text-(normal|muted|faint|on-accent)\)/);
    expect(section).not.toMatch(/var\(--interactive-accent\)/);
    expect(section).not.toContain('#52c41a');
    expect(section).not.toContain('#ff4757');
  });
});

describe('issue 270-B：stats-ui.ts 内联样式收编', () => {
  it('style.cssText 清零、style.*= 仅剩行为性 display/zIndex 赋值与 isVisible 比较', () => {
    const ts = statsUi();
    expect((ts.match(/style\.cssText/g) || []).length).toBe(0);
    const assignments = ts.match(/style\.[a-zA-Z]+\s*=/g) || [];
    // 8 处赋值（两弹窗 mask/popup 的 display + zIndex 发号）+ 3 处 isVisible 比较
    expect(assignments.length).toBeLessThanOrEqual(11);
    for (const a of assignments) {
      expect(/^style\.(display|zIndex)\s*==$/.test(a + '='), `非行为性内联残留：${a}`).toBe(true);
    }
  });

  it('静态 style="…" 清零：残留行内样式均为数据驱动动态值（插值表达式）', () => {
    const ts = statsUi();
    const inline = ts.match(/style="[^"]*"/g) || [];
    // PASTEL 卡/色条/进度条/柱体/徽章/圆点/评级字色共 8 处动态内联
    expect(inline.length).toBeLessThanOrEqual(8);
    for (const s of inline) {
      expect(s.includes('${'), `静态内联残留：${s}`).toBe(true);
    }
  });

  it('收编类在 styles.css 有规则：统计卡/板块/条/柱/chip/排名 + 历史时间线', () => {
    const css = reviewCss();
    const selectors = [
      '.bz-stats-cards', '.bz-stats-card', '.bz-stats-card-val', '.bz-stats-card-lbl',
      '.bz-stats-section', '.bz-stats-section-head', '.bz-stats-section-accent',
      '.bz-stats-empty',
      '.bz-stats-bar-row', '.bz-stats-bar-lbl', '.bz-stats-bar-track', '.bz-stats-bar-fill', '.bz-stats-bar-val',
      '.bz-stats-chart-scroll', '.bz-stats-chart', '.bz-stats-chart-col', '.bz-stats-chart-bar', '.bz-stats-chart-lbl',
      '.bz-stats-inline', '.bz-stats-inline-chip',
      '.bz-stats-rank-badge', '.bz-stats-rank-plain', '.bz-stats-rank-name', '.bz-stats-rank-sub', '.bz-stats-rank-meta',
      '.bz-stats-hint',
      '.bz-review-history-status', '.bz-review-history-name', '.bz-review-history-sub', '.bz-review-history-empty',
      '.bz-review-history-tl', '.bz-review-history-item', '.bz-review-history-item.is-last',
      '.bz-review-history-line', '.bz-review-history-dot', '.bz-review-history-row',
      '.bz-review-history-time', '.bz-review-history-rating', '.bz-review-history-stage',
    ];
    for (const sel of selectors) {
      expect(css.includes(sel), `缺类规则 ${sel}`).toBe(true);
    }
  });

  it('stats-ui.ts 引用收编类（markup 与样式接驳）', () => {
    const ts = statsUi();
    for (const cls of ['bz-stats-card', 'bz-stats-section', 'bz-stats-bar-fill', 'bz-stats-chart-bar', 'bz-stats-rank-badge', 'bz-stats-hint', 'bz-review-history-item', 'bz-review-history-dot', 'bz-review-history-rating']) {
      expect(ts.includes(cls), `stats-ui.ts 未引用 ${cls}`).toBe(true);
    }
  });
});

// @vitest-environment node
/**
 * 阅读报告内联样式收编 + 暗色适配守护（issue 270）。
 * 仿 tests/review-fix-b.test.ts 的 CSS 文本断言惯例（jsdom 不解析 css 文件）：
 *  1) report.ts 内联 style 计数阈值——静态样式全部迁 src/reading-report/styles.css，
 *     只余数据驱动项（条宽/柱高/运行时取色）；
 *  2) 收编类在域样式文件存在；
 *  3) 指标数字色 .theme-dark 提亮覆盖档存在（chart-palette 中调色暗底偏暗，报告侧 CSS 层覆盖）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHART_GRADIENT_VIOLET,
  CHART_GRADIENT_PINK,
  CHART_GRADIENT_AQUA,
  CHART_GRADIENT_MINT,
  CHART_GRADIENT_CORAL,
  CHART_SPEED_BAR_GRADIENT,
  CHART_METRIC_VIOLET,
  CHART_METRIC_AQUA,
  CHART_METRIC_MINT,
  CHART_METRIC_CORAL,
  CHART_METRIC_RED,
  CHART_METRIC_BLUE,
  CHART_METRIC_PURPLE,
  CHART_METRIC_GREEN,
  CHART_METRIC_ORANGE,
  CHART_METRIC_SKY,
  CHART_INK,
} from '../../src/core/chart-palette';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const reportSrc = () => repo('src/reading-report/report.ts');
const statsSrc = () => repo('src/reading-report/stats.ts');
const indexSrc = () => repo('src/reading-report/index.ts');
const css = () => repo('src/reading-report/styles.css');

describe('issue 270：report.ts 内联收编', () => {
  it('内联 style 计数 ≤ 8（迁移前 187；余量仅数据驱动项）', () => {
    const count = reportSrc().match(/style="/g)?.length ?? 0;
    expect(count, `report.ts 内联 style 应 ≤ 8，实际 ${count}`).toBeLessThanOrEqual(8);
  });

  it('余量内联全部为数据驱动模板插值（width/height/background 运行时值，无静态常量串）', () => {
    const src = reportSrc();
    const inline = src.match(/style="[^"]*"/g) ?? [];
    expect(inline.length).toBeGreaterThan(0);
    for (const frag of inline) {
      expect(frag, `非数据驱动内联: ${frag}`).toContain('${');
    }
  });

  it('收编类在域样式文件存在（容器/hero/指标/速度/专注/热力图网格）', () => {
    const sheet = css();
    const required = [
      '.bz-rr-card', '.bz-rr-card--sm', '.bz-rr-panel', '.bz-rr-panel--sm',
      '.bz-rr-section', '.bz-rr-empty', '.bz-rr-total', '.bz-rr-metric-row',
      '.bz-rr-grid', '.bz-rr-year-grid', '.bz-rr-author-grid', '.bz-rr-trend-grid',
      '.bz-rr-hm-metrics', '.bz-rr-focus-grid', '.bz-rr-cat-grid', '.bz-rr-int-grid',
      '.bz-rr-speed-grid', '.bz-rr-cell-grid',
      '.bz-rr-hero', '.bz-rr-hero--violet', '.bz-rr-hero--pink', '.bz-rr-hero--aqua', '.bz-rr-hero--mint', '.bz-rr-hero--coral',
      '.bz-rr-hero-num', '.bz-rr-hero-label', '.bz-rr-hero-sub',
      '.bz-rr-metric', '.bz-rr-metric-num', '.bz-rr-metric-label',
      '.bz-rr-cell', '.bz-rr-cell-num',
      '.bz-rr-speed-track', '.bz-rr-speed-fill', '.bz-rr-speed-scale',
      '.bz-rr-focus-row', '.bz-rr-focus-track', '.bz-rr-focus-fill',
      '.bz-rr-hm-month', '.bz-rr-hm-week', '.bz-rr-hm-grid', '.bz-rr-hm-cell--off',
      '.bz-rr-mbar-num', '.bz-rr-author-rank', '.bz-rr-bar-wrap',
    ];
    for (const sel of required) {
      expect(sheet, `缺收编类 ${sel}`).toContain(sel);
    }
  });

  it('CSS 渐变/速度条/月柱墨色与 core/chart-palette 常量值逐字一致（防单侧漂移）', () => {
    const sheet = css();
    for (const gradient of [CHART_GRADIENT_VIOLET, CHART_GRADIENT_PINK, CHART_GRADIENT_AQUA, CHART_GRADIENT_MINT, CHART_GRADIENT_CORAL, CHART_SPEED_BAR_GRADIENT]) {
      expect(sheet, `缺渐变值 ${gradient}`).toContain(gradient);
    }
    expect(sheet).toContain(CHART_INK);
    // report.ts 源码不再持有静态 hex（图表色全走 CSS 档或运行时常量）
    const hexes = [...reportSrc().matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((h) => h[0]);
    expect(hexes, `report.ts 残留内联 hex: ${hexes.join(', ')}`).toEqual([]);
  });
});

describe('issue 270：指标数字色暗色提亮档', () => {
  const METRICS: Array<[string, string]> = [
    ['violet', CHART_METRIC_VIOLET],
    ['aqua', CHART_METRIC_AQUA],
    ['mint', CHART_METRIC_MINT],
    ['coral', CHART_METRIC_CORAL],
    ['red', CHART_METRIC_RED],
    ['blue', CHART_METRIC_BLUE],
    ['purple', CHART_METRIC_PURPLE],
    ['green', CHART_METRIC_GREEN],
    ['orange', CHART_METRIC_ORANGE],
    ['sky', CHART_METRIC_SKY],
  ];

  it('十个指标色类齐备，亮档色值与 chart-palette 一致', () => {
    const sheet = css();
    for (const [name, value] of METRICS) {
      const rule = sheet.match(new RegExp(`\\.bz-rr-c-${name}\\s*\\{[^}]*\\}`));
      expect(rule, `缺 .bz-rr-c-${name}`).not.toBeNull();
      expect(rule![0]).toContain(value);
    }
  });

  it('.theme-dark 覆盖档齐备：color-mix 提亮（除 sky 少提档外统一 60% 混白）', () => {
    const sheet = css();
    for (const [name] of METRICS) {
      const dark = sheet.match(new RegExp(`\\.theme-dark \\.bz-rr-c-${name}\\s*\\{[^}]*\\}`));
      expect(dark, `缺 .theme-dark .bz-rr-c-${name} 提亮档`).not.toBeNull();
      expect(dark![0]).toContain('color-mix(in srgb');
      expect(dark![0]).toContain('#ffffff');
    }
  });

  it('.theme-dark 不动饱和渐变 hero 底（两主题白字可读）：hero 渐变类无 .theme-dark 覆盖', () => {
    expect(css()).not.toMatch(/\.theme-dark \.bz-rr-hero/);
  });
});

describe('深审修复批收编守卫（bz-fix-rr-core：C-2 扩面 + RR-U 系回归）', () => {
  it('C-2：index.ts 无静态内联 style（骨架/错误占位已迁 styles.css 类）', () => {
    expect(indexSrc().match(/style="/g)?.length ?? 0).toBe(0);
    expect(css()).toContain('.bz-rr-skeleton');
    expect(css()).toContain('.bz-rr-error');
  });

  it('C-2：stats.ts 无裸 hex（热力色阶收编 core/chart-palette CHART_HEATMAP_SERIES）', () => {
    const hexes = [...statsSrc().matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((h) => h[0]);
    expect(hexes, `stats.ts 残留内联 hex: ${hexes.join(', ')}`).toEqual([]);
    expect(statsSrc()).toContain('CHART_HEATMAP_SERIES');
  });

  it('RR-U9：hm-grid 无负 margin 残留（内容区不再横拖 20px）', () => {
    expect(css()).not.toContain('margin-right: -20px');
  });

  it('RR-U4：热力数据格撤 cursor:pointer 伪装可点；hover 放大配 position:relative 使 z-index 生效', () => {
    const rule = css().match(/\.bz-rr-hm-cell--data\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).not.toContain('cursor: pointer');
    expect(rule![0]).toContain('position: relative');
  });

  it('RR-U11：focus-label 去 60px 固定宽（长标签不再折行挤压轨道）；bar-label 移动端允许换行', () => {
    const rule = css().match(/\.bz-rr-focus-label\s*\{[^}]*\}/);
    expect(rule, '缺 .bz-rr-focus-label 规则').not.toBeNull();
    // min-width: 60px 合规，固定 width: 60px 不合规（负向断言避开 min- 前缀）
    expect(rule![0]).not.toMatch(/(?<![-a-z])width:\s*60px/);
    expect(rule![0]).toContain('flex: 0 0 auto');
    // 移动端媒体段放宽 bar-label
    const mobile = css().match(/@media \(max-width: 768px\)\s*\{[\s\S]*\.bz-rr-bar-label[\s\S]*?\}\s*\}/);
    expect(mobile, '缺 bar-label 移动端放宽规则').not.toBeNull();
    expect(mobile![0]).toContain('white-space: normal');
  });

  it('RR-U7：专注度对比死块样式随死标记同删（.bz-rr-block / .bz-rr-block-grid 清零）', () => {
    expect(css()).not.toContain('.bz-rr-block');
    expect(css()).not.toContain('.bz-rr-block-grid');
  });

  it('C-1：失效前提注释防回潮——域文件不再引用「左栏」返回路径（书脊墙换血后不存在）', () => {
    expect(css()).not.toContain('左栏');
    expect(indexSrc()).not.toContain('左栏');
  });

  it('EFF-5：报告态隐藏书架 chrome 死控件（:has 状态规则在域 CSS）', () => {
    const sheet = css();
    expect(sheet).toContain('.bz-bs-wallpage:has(.bz-bs-view-report.active) .bz-bs-labels');
    expect(sheet).toContain('.bz-bs-wallpage:has(.bz-bs-view-report.active) .bz-bs-tools');
  });

  it('EFF-10/RR-U3：翻月钮热区（markup 挂 bz-touch-target，见 seam.test 跨文件契约）', () => {
    expect(css().match(/\.bz-rr-hm-nav\s*\{[^}]*\}/)).not.toBeNull();
  });
});

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

  it('暗色不动饱和渐变 hero 底（两主题白字可读）：hero 渐变类无 .theme-dark 覆盖', () => {
    expect(css()).not.toMatch(/\.theme-dark \.bz-rr-hero/);
  });
});

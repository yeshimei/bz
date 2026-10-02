// @vitest-environment node
/* ============================================================
 * 日记本移动端长按手势守卫（用户真机报告 2026-09-11；ADR-0230 书页界面换代后改口径）
 *
 *   长按 = 便签菜单的唯一入口（`ui.ts::bindMenu` 的 500ms 计时）。书页正文若 `user-select:text`，
 *   真机长按正文时系统文本选择接管 → touchcancel 掐死计时 → 便签永不出（用户看到的
 *   「右键菜单」即系统选择浮标）。故触屏下整页收回选中豁免；桌面不受影响。
 *
 * 与回忆墙版的差别（ADR-0230 决策 7）：豁免的宿主从「正文卡 `.bz-diary-text-tx`」换成
 * **整页 `.bz-diary-page-item`**——书页里所有字都在页容器内，逐块挂豁免既漏又互相打架。
 *
 * 本文件只做**样式源静态断言**（不跑 jsdom），与 tests/cinema/mobile-3fix-guard.test.ts 同款手法。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(process.cwd(), 'src/diary/styles.css'), 'utf8');

describe('移动端长按手势 vs 书页选中豁免（ADR-0230）', () => {
  it('触屏下整页收回选中（桌面保留选中复制不受影响）', () => {
    const blocks = [...css.matchAll(/@media\s*\(pointer:\s*coarse\)\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(blocks.length, '域内应有 pointer:coarse 块').toBeGreaterThan(0);
    const joined = blocks.join('\n');
    expect(joined, '触屏下页容器必须 user-select:none').toMatch(
      /\.bz-diary-page-item\s*\{[^}]*user-select:\s*none/
    );
    // -webkit- 前缀同时给（Obsidian 移动端 WebView 的旧内核）
    expect(joined).toMatch(/-webkit-user-select:\s*none/);
  });

  it('整个域样式不得再出现任何 user-select:text——系统选择接管会掐死长按计时', () => {
    expect(css).not.toMatch(/user-select:\s*text/);
  });
});

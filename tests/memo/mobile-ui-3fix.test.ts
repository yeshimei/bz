// @vitest-environment node
/* ============================================================
 * issue 266 守卫：移动端备忘录面板三处 UI 缺陷的样式源静态断言
 *
 * 缺陷（用户报告，2026-09-10）：
 *   A. 移动端真全屏没有关闭按钮 —— 三重隐藏叠加：
 *      核心层「非真全屏一律隐藏关闭按钮」+ 皮肤层
 *      `.bz-memo-skin-{paper,editorial} .bz-panel-head-btns{display:none}`
 *      （隐藏整个头行钮组）+ 移动端无恢复规则。
 *   B. 移动端真全屏头行没有新建备忘录入口 —— 移动端 `display:none` 掉了
 *      含新建钮的 `.bz-main-head`，新建只剩底部录入条（输入型，不是弹窗表单）。
 *   C. 输入框不跟随软键盘 —— 移动端真全屏面板写死 `height: 100vh`，而 `100vh`
 *      等于布局视口高度、不随键盘收缩，底部录入条被键盘盖住。核心层新增
 *      `--bz-vvh` 变量资源（src/core/viewport.ts + components.css），由域内消费；
 *      本域同时把面板改为顶部对齐（父遮罩是 align-items:center，居中会让缩短后
 *      的底边仍落在键盘之下）。
 *
 * 本文件只做「样式源 + markup 源」的静态断言（不跑 jsdom、不加载构建产物），
 * 与 tests/core/settings-model-picker-ui.test.ts（ticket 265）同款手法。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** 取文本内**所有** `@media (max-width: 768px)` 块的拼接（一个文件可能有多块） */
function mobileBlock(css: string): string {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf('@media (max-width: 768px)', from);
    if (start === -1) break;
    // 花括号配对取整块
    let depth = 0;
    let i = css.indexOf('{', start);
    const brace = i;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(css.slice(brace, i + 1));
    from = i + 1;
  }
  expect(out.length, '≤768px 媒体查询存在').toBeGreaterThan(0);
  return out.join('\n');
}

describe('issue 266 · A. 移动端真全屏关闭按钮必须可见可用', () => {
  it('markup 源头行保留关闭钮，且带独立类（不吃核心层「非真全屏隐藏」的类名）', () => {
    const ts = read('src/memo/render.ts');
    expect(ts).toContain('data-memo-head-close');
    expect(ts).toContain('bz-memo-head-close');
    expect(ts).toContain('title="关闭"');
    // 独立类而非 .bz-icon-btn--close：核心层对该类无条件 display:none（ADR-0019 第 4 条）
    expect(ts).not.toMatch(/bz-memo-head-close[^>]*bz-icon-btn--close/);
  });

  it('行为接线已就位（零功能改动：复用既有委托）', () => {
    const ts = read('src/memo/ui.ts');
    expect(ts).toContain("t.closest('[data-memo-head-close]')");
    expect(ts).toMatch(/headClose[\s\S]{0,60}closeMemoPanel\(\)/);
  });

  it('移动端媒体查询把头行钮组放回（反制皮肤层 display:none）', () => {
    const css = read('src/memo/styles.css');
    // 皮肤层确实藏了（设计如此，桌面保留）
    expect(css).toMatch(/\.bz-memo-skin-paper\s+\.bz-panel-head-btns\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.bz-memo-skin-editorial\s+\.bz-panel-head-btns\s*\{\s*display:\s*none/);
    // 移动端收口段必须放回钮组
    const closing = css.slice(css.indexOf('移动端收口段（issue 266）'));
    expect(closing.length, '收口段存在').toBeGreaterThan(0);
    const block = mobileBlock(closing);
    expect(block).toMatch(/\.bz-memo-skin-paper\s+\.bz-panel-head-btns/);
    expect(block).toMatch(/\.bz-memo-skin-editorial\s+\.bz-panel-head-btns/);
    expect(block).toMatch(/display:\s*flex/);
  });

  it('关闭 / 新建钮在移动端抬到 32px 可视档 + .bz-touch-target 扩 44px 命中区', () => {
    const css = read('src/memo/styles.css');
    const closing = css.slice(css.indexOf('移动端收口段（issue 266）'));
    const block = mobileBlock(closing);
    expect(block).toMatch(/\.bz-memo-head-close[\s\S]{0,300}width:\s*var\(--bz-icon-btn-lg\)/);
    expect(block).toMatch(/\.bz-memo-head-new[\s\S]{0,300}flex-shrink:\s*0/);
    // 命中区靠核心层 .bz-touch-target（pointer:coarse 下默认外扩 -6px → 32+12 = 44px）
    // 与归物本移动端关闭钮同款：src/belongings/layouts/poster/render.ts:36
    const ts = read('src/memo/render.ts');
    expect(ts).toMatch(/bz-icon-btn bz-touch-target bz-memo-head-close/);
    expect(ts).toMatch(/bz-icon-btn bz-touch-target bz-memo-head-new/);
  });
});

describe('issue 266 · B. 移动端真全屏头行补「新建备忘录」入口', () => {
  it('头行新增移动端专属新建钮，复用既有 data-memo-newbtn 钩子', () => {
    const ts = read('src/memo/render.ts');
    expect(ts).toContain('bz-memo-head-new');
    // 头行新建钮共用同一个钩子 → 复用 ui.ts 的 openEditor(null) 委托，零新增行为
    const head = ts.slice(ts.indexOf('bz-panel-head-btns'), ts.indexOf('bz-memo-body'));
    expect(head).toContain('data-memo-newbtn');
  });

  it('桌面隐藏 / 移动端显示 走互补媒体查询（不赖顺序）', () => {
    const css = read('src/memo/styles.css');
    // 桌面：min-width: 769px 藏起（与全局移动档 max-width:768px 互补）
    expect(css).toMatch(/@media \(min-width: 769px\)\s*\{\s*\.bz-memo-head-new\s*\{\s*display:\s*none/);
    // 移动端不写 display：沿用核心层 .bz-icon-btn 的 inline-flex，两条规则互斥无顺序陷阱
    const mobileOnly = css.slice(0, css.indexOf('@media (min-width: 769px)'));
    expect(mobileOnly).not.toContain('.bz-memo-head-new { display: none; }');
  });

  it('行为仍只有一处接线（不改功能逻辑）', () => {
    const ts = read('src/memo/ui.ts');
    const hits = ts.match(/data-memo-newbtn/g) || [];
    expect(hits.length).toBe(1);
    expect(ts).toContain('openEditor(null)');
  });
});

describe('issue 266 · C. 移动端输入框随软键盘上浮（高度改挂可视视口）', () => {
  it('核心层新增视口高度模块并导出绑定/同步能力', () => {
    const ts = read('src/core/viewport.ts');
    expect(ts).toContain('visualViewport');
    expect(ts).toContain('export function bindMobileViewport');
    expect(ts).toContain('export function unbindMobileViewport');
    expect(ts).toContain('export function syncMobileViewport');
    expect(ts).toContain("'--bz-vvh'");
    // 主入口接线
    const main = read('src/main.ts');
    expect(main).toContain('bindMobileViewport()');
    expect(main).toContain('unbindMobileViewport()');
  });

  it('核心层只提供 --bz-vvh 变量资源（100vh 基线 + 100dvh 升级），不直接改面板高度', () => {
    const css = read('src/core/ui/components.css');
    const block = mobileBlock(css);
    expect(block).toMatch(/:root\s*\{\s*--bz-vvh:\s*100vh/);
    expect(css).toMatch(/@supports \(height: 100dvh\)[\s\S]{0,120}--bz-vvh:\s*100dvh/);
  });

  it('核心层不得用 !important 强改 .bz-panel-mtop 高度（会打坏 knowledge/clipbook 的锚定式面板）', () => {
    const css = read('src/core/ui/components.css');
    const block = mobileBlock(css);
    expect(block).not.toMatch(/\.bz-panel-mtop[\s\S]{0,120}height:\s*var\(--bz-vvh/);
    // knowledge：top/bottom 锚定 + height:auto；clipbook 详情：父级 inset:0 的嵌套层
    const kb = read('src/knowledge/styles.css');
    expect(kb).toMatch(/\.bz-kb-window\.bz-panel-mtop[\s\S]{0,200}height:\s*auto/);
  });

  it('备忘录面板移动端挂可视高度 + 顶部对齐（居中会让底边仍落在键盘下）', () => {
    const css = read('src/memo/styles.css');
    const block = mobileBlock(css);
    expect(block).toMatch(/\.bz-memo-panel[\s\S]{0,400}height:\s*var\(--bz-vvh/);
    expect(block).toMatch(/\.bz-memo-panel[\s\S]{0,600}align-self:\s*flex-start/);
    // 父层确为居中（本改动的理由），防止将来父层改了而此处注释/对齐失据
    const core = read('src/core/ui/components.css');
    expect(core).toMatch(/\.bz-panel-overlay[\s\S]{0,240}align-items:\s*center/);
  });

  it('桌面端零影响：面板桌面尺寸未被改动', () => {
    const css = read('src/memo/styles.css');
    expect(css).toMatch(/\.bz-memo-panel\s*\{\s*width:\s*720px/);
    // ≤768px 之外的 .bz-memo-panel 高度规则里不得出现 --bz-vvh（桌面不受管）
    const beforeMobile = css.slice(0, css.indexOf('@media (max-width: 768px)'));
    expect(beforeMobile).not.toContain('--bz-vvh');
  });
});

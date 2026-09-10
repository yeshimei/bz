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
 *      **issue 268 用户评审拍板推翻本条实现**：头行不再补新建钮（设置钮一并撤除），
 *      改由底部录入「添加」开创建弹窗 + 场景条尾部「添加场景」chip 承担；
 *      A 条的关闭钮同时从 32px 抬到 38px 并换装皮肤形态（见 B 段断言）。
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
    const closing = css.slice(css.lastIndexOf('移动端收口段'));
    expect(closing.length, '收口段存在').toBeGreaterThan(0);
    const block = mobileBlock(closing);
    expect(block).toMatch(/\.bz-memo-skin-paper\s+\.bz-panel-head-btns/);
    expect(block).toMatch(/\.bz-memo-skin-editorial\s+\.bz-panel-head-btns/);
    expect(block).toMatch(/display:\s*flex/);
  });

  it('关闭钮在移动端定档 28px + 皮肤贴纸形态 + 44px 命中区', () => {
    const css = read('src/memo/styles.css');
    const closing = css.slice(css.lastIndexOf('移动端收口段'));
    const block = mobileBlock(closing);
    // issue 269 两轮收小：268 的 38px → 34px → 28px（与头行品牌块 28×28 同尺寸）；图标 16px
    expect(block).toMatch(/--bz-memo-close-box:\s*28px/);
    expect(block).toMatch(/\.bz-memo-head-close[\s\S]{0,400}width:\s*var\(--bz-memo-close-box\)/);
    expect(block).toMatch(/\.bz-memo-head-close \.bz-ic[\s\S]{0,80}width:\s*16px/);
    // 28px 档 + -6px 外扩只有 40px，不足 44px → markup 必须挂 .bz-touch-target--lg（-8px → 44px）
    const ts = read('src/memo/render.ts');
    expect(ts).toMatch(/bz-icon-btn bz-touch-target bz-touch-target--lg bz-memo-head-close/);
    // 「符合风格」：纸感 = 墨框 + 硬偏移阴影；编辑部 = 方角细墨框
    expect(block).toMatch(/\.bz-memo-panel\.bz-memo-skin-paper \.bz-memo-head-close\s*\{[\s\S]{0,320}box-shadow:\s*2px 2px 0 var\(--bz-skin-ink\)/);
    expect(block).toMatch(/\.bz-memo-panel\.bz-memo-skin-editorial \.bz-memo-head-close\s*\{[\s\S]{0,220}border:\s*1\.5px solid var\(--bz-skin-ink\)/);
    // 组件基线 .bz-icon-btn 把背景/描边/阴影全钉死在 !important，皮肤覆盖必须同权
    expect(block).toMatch(/\.bz-memo-head-close\s*\{[\s\S]{0,240}background:[^;]*!important/);
    expect(block).toMatch(/\.bz-memo-head-close\s*\{[\s\S]{0,240}border:[^;]*!important/);
  });

  it('顶距 44px 改挂头行自身（issue 269：斜纹条铺到面板顶边）', () => {
    const css = read('src/memo/styles.css');
    const closing = css.slice(css.lastIndexOf('移动端收口段'));
    const block = mobileBlock(closing);
    // 面板根垫顶归零（压核心层 .bz-panel-mtop 的 !important）
    expect(block).toMatch(/\.bz-memo-panel\.bz-panel-mtop\s*\{\s*padding-top:\s*0\s*!important/);
    // 同 44px 落到头行自身，头行高度改 auto（垫顶 + 内容 = 44+44，总高不变）。
    // 选择器必须 (0,3,0)：核心层反制规则 `.bz-panel-mtop > div:first-child` 是 (0,2,1)
    expect(block).toMatch(/\.bz-memo-panel\.bz-panel-mtop \.bz-panel-head\s*\{[\s\S]{0,200}height:\s*auto/);
    expect(block).toMatch(/\.bz-memo-panel\.bz-panel-mtop \.bz-panel-head\s*\{[\s\S]{0,240}min-height:\s*calc\(44px \+ max\(44px,\s*env\(safe-area-inset-top/);
    expect(block).toMatch(/\.bz-memo-panel\.bz-panel-mtop \.bz-panel-head\s*\{[\s\S]{0,320}padding-top:\s*max\(44px,\s*env\(safe-area-inset-top/);
    expect(block).toMatch(/\.bz-memo-panel\.bz-panel-mtop \.bz-panel-head\s*\{[\s\S]{0,360}padding-top:[^;]*!important/);
    // 头行高度不得被写死（写死 44px 会让垫顶把内容压出盒子）
    expect(block).not.toMatch(/\.bz-panel-head\s*\{\s*height:\s*44px/);
  });
  it('移动场景条平铺 chip 也随皮肤换装（issue 269「平铺的场景也风格化」）', () => {
    const css = read('src/memo/styles.css');
    const paper = css.slice(css.indexOf('.bz-memo-skin-paper'));
    const editorial = css.slice(css.indexOf('.bz-memo-skin-editorial'));
    // 纸感：白底墨框贴纸；选中 = 品牌橙 + 墨框 + 硬阴影（与头行品牌块/主按钮同族）
    expect(paper).toMatch(/\.bz-memo-skin-paper \.bz-mobstrip-chip\s*\{[\s\S]{0,220}border:\s*1\.5px solid var\(--bz-skin-ink\)/);
    expect(paper).toMatch(/\.bz-memo-skin-paper \.bz-mobstrip-chip\.is-on\s*\{[\s\S]{0,260}box-shadow:\s*2px 2px 0 var\(--bz-skin-ink\)/);
    // 编辑部：方角细墨框白底；选中 = 黑底白字（与编辑部弹窗平铺选择同档）
    expect(editorial).toMatch(/\.bz-memo-skin-editorial \.bz-mobstrip-chip\s*\{[\s\S]{0,240}border-radius:\s*3px/);
    expect(editorial).toMatch(/\.bz-memo-skin-editorial \.bz-mobstrip-chip\.is-on\s*\{[\s\S]{0,200}background:\s*var\(--bz-skin-ink\)/);
    // 虚线动作 chip 必须排在通用 chip 段之后（同特异性 0,2,0 靠后写者赢，否则虚线被实框吃掉）
    for (const [skin, name] of [['paper', '纸感'], ['editorial', '编辑部']]) {
      const generic = css.indexOf(`.bz-memo-skin-${skin} .bz-mobstrip-chip {`);
      const dashed = css.indexOf(`.bz-memo-skin-${skin} .bz-mobstrip-chip.bz-mobstrip-add {`);
      expect(dashed, name + ' 虚线 chip 规则在场').toBeGreaterThan(-1);
      expect(dashed, name + ' 虚线 chip 必须排在通用 chip 规则之后').toBeGreaterThan(generic);
    }
  });
});

describe('issue 268 · B. 移动端头行只留关闭，设置/新建撤出', () => {
  it('设置钮移动端 display:none（桌面本就由皮肤段整组收掉）', () => {
    const css = read('src/memo/styles.css');
    const closing = css.slice(css.lastIndexOf('移动端收口段'));
    const block = mobileBlock(closing);
    expect(block).toMatch(/\.bz-memo-head-settings\s*\{\s*display:\s*none/);
    // 设置入口仍在（场景项菜单「在设置中编辑」）——撤的只是头行那一枚
    const ts = read('src/memo/ui.ts');
    expect(ts).toContain('openMemoInSettings');
    expect(ts).toContain("label: '在设置中编辑'");
  });

  it('移动端专属新建钮 .bz-memo-head-new 退役（issue 266 引入 → 268 撤除）', () => {
    const ts = read('src/memo/render.ts');
    expect(ts).not.toContain('bz-memo-head-new');
    const css = read('src/memo/styles.css');
    expect(css).not.toContain('bz-memo-head-new');
  });

  it('移动端新建入口改由底部录入「添加」与场景条尾部「添加场景」承担', () => {
    const ts = read('src/memo/ui.ts');
    // 底部「添加」：移动端分支开创建弹窗（桌面仍 addFromComposer 快速落盘）
    expect(ts).toMatch(/submitComposer[\s\S]{0,260}isMobileEnv\(\)[\s\S]{0,120}addFromComposer\(\)/);
    expect(ts).toMatch(/submitComposer[\s\S]{0,900}openEditor\(null,\s*\{/);
    // 场景条尾部 chip：render 纯层出 markup，ui 渲染尾部拼接
    const render = read('src/memo/render.ts');
    expect(render).toContain('mobAddSceneChipHtml');
    expect(render).toMatch(/bz-mobstrip-chip bz-mobstrip-add/);
    expect(ts).toMatch(/mobChipHtml\(o, M\.activeScene === o\.scene\)\)\s*\.join\(''\)\s*\+\s*mobAddSceneChipHtml\(\)/);
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

// @vitest-environment node
/**
 * issue 291：全域子弹窗统一 —— favorites 三个确认框的样式源文本断言。
 *
 * 前情（缺陷）：表单弹窗 openForm 的 mask 挂 body 时带 `bz-fav-form-mask bz-fav-scope`，
 * 但「归档收藏」「删除收藏」两个 openFlowDialog 与「放弃未保存草稿」的 confirmDiscard
 * 都没带皮肤类 —— 三个确认框掉回 core 裸皮，同一域里「表单有皮、确认没皮」。
 *
 * 本用例只读源码文本（jsdom 不解析 css 文件），守护：
 *  1) ui.ts 三处确认框都传 `'bz-fav-flow-dialog bz-fav-scope'`（confirmDiscard 走第三参透传）；
 *  2) styles.css 有 `#__shared_confirm_popup__.bz-fav-flow-dialog` 规则块 + 各子件映射，
 *     取值对齐同域表单弹窗 `.bz-fav-form`；
 *  3) 亮暗由 `.theme-dark .bz-fav-scope` 私有 token 组承担，故不需要另写暗色块；
 *     `bz-fav-scope` 必须跟着传，否则 --pop/--acc 等私有 token 解析失败。
 * 运行时「popup classList 含皮肤类」断言在 tests/favorites/ui.test.ts 的 issue 291 用例里。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const favCss = () => repo('src/favorites/styles.css');
const favUi = () => repo('src/favorites/ui.ts');

const confirmBlock = (selector: string) =>
  favCss().match(new RegExp(`#__shared_confirm_popup__\\.bz-fav-flow-dialog${selector}\\s*\\{([^}]*)\\}`));

describe('issue 291：favorites 确认框挂域皮肤类', () => {
  it('ui.ts 三处确认框（归档 / 删除 / 放弃草稿）都传 bz-fav-flow-dialog bz-fav-scope', () => {
    const src = favUi();
    // 归档 + 删除两处 openFlowDialog 的 className
    expect(src.match(/className: 'bz-fav-flow-dialog bz-fav-scope'/g)?.length).toBe(2);
    // 放弃草稿走 core/flow-dialog 的 confirmDiscard 第三参（className 透传通道）
    expect(src).toMatch(
      /confirmDiscard\(\(\) => closeForm\(popup\),\s*\n?\s*undefined,\s*\n?\s*'bz-fav-flow-dialog bz-fav-scope'\)/
    );
    // 三处口径一致：都是「域流程框类 + 私有 token 作用域类」这一串
    expect(src.match(/bz-fav-flow-dialog bz-fav-scope/g)?.length).toBe(3);
  });

  it('styles.css 有 id + 域类复合选择器规则块，壳取值映射表单弹窗 .bz-fav-form', () => {
    const block = confirmBlock('');
    expect(block, '缺 #__shared_confirm_popup__.bz-fav-flow-dialog 规则块').not.toBeNull();
    // 亚麻底 + 同款皮：逐值对齐 .bz-fav-form（--pop 底 / 14px 圆角 / 0 16px 44px .32 阴影）
    expect(block![1]).toContain('background: var(--pop)');
    expect(block![1]).toContain('border-radius: 14px');
    expect(block![1]).toMatch(/box-shadow:\s*0 16px 44px rgba\(0, 0, 0, \.32\)/);
    // 不写几何：高度/字号/内边距归 core（组件库 .bz-btn 同源）
    expect(block![1]).not.toContain('height:');
    expect(block![1]).not.toContain('font-size:');
  });

  it('标题 / 正文 / 双按钮逐条映射表单那套取值（墨字 + 亚麻纸钮 + 绿主钮 + 危险文字色）', () => {
    const h4 = confirmBlock(' h4');
    expect(h4, '缺确认框标题规则').not.toBeNull();
    expect(h4![1]).toContain('color: var(--pop-ink)');

    const p = confirmBlock(' p');
    expect(p, '缺确认框正文规则').not.toBeNull();
    expect(p![1]).toContain('color: var(--pop-mut)');

    const cancel = confirmBlock(' #__shared_confirm_cancel__');
    expect(cancel, '缺取消钮规则').not.toBeNull();
    expect(cancel![1]).toContain('background: var(--fld-bg)');
    expect(cancel![1]).toContain('color: var(--chip-ink)');

    const ok = confirmBlock(' #__shared_confirm_ok__');
    expect(ok, '缺主动作钮规则').not.toBeNull();
    expect(ok![1]).toContain('background: var(--acc)');
    expect(ok![1]).toContain('color: var(--on-acc)');

    // 危险主动作（删除收藏）：core 的 --danger 降档口径由域 token 承接（亮暗自动换色）
    const danger = favCss().match(
      /#__shared_confirm_popup__\.bz-fav-flow-dialog\.bz-flow-dialog--danger #__shared_confirm_ok__\s*\{([^}]*)\}/
    );
    expect(danger, '缺危险主动作降档映射').not.toBeNull();
    expect(danger![1]).toContain('color: var(--danger)');
    // 域规则须位于 core 段之后才能压过 core 的 popup id 复合规则（聚合顺序：core/styles.css → 域样式）
    expect(favCss().indexOf('#__shared_confirm_popup__.bz-fav-flow-dialog {')).toBeGreaterThan(-1);
  });

  it('亮暗随 .theme-dark .bz-fav-scope 私有 token 组自动反转：确认框不写硬编码暗色块', () => {
    const css = favCss();
    expect(css).not.toMatch(/\.theme-dark #__shared_confirm_popup__\.bz-fav-flow-dialog/);
    // 前提守护：暗色 token 组确实存在且覆盖本块用到的变量
    const dark = css.match(/\.theme-dark \.bz-fav-scope\s*\{([^}]*)\}/);
    expect(dark, '缺 .theme-dark .bz-fav-scope token 组').not.toBeNull();
    for (const token of ['--pop:', '--fld-bg:', '--acc:', '--on-acc:', '--danger:', '--pop-ink:', '--pop-mut:']) {
      expect(dark![1], `暗色组缺 ${token}`).toContain(token);
    }
  });
});

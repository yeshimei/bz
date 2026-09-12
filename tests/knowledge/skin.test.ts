// @vitest-environment node
/**
 * issue 291：全域子弹窗统一 —— knowledge 三处确认框随面板纸墨皮（样式源文本断言）。
 *
 * 前情（缺陷）：知识盒主窗与自绘弹窗都挂 `.kb`（纸墨 token 作用域，styles.css 开头
 * 「词典风」段，亮 :1-19 / 暗 .theme-dark 组），但「中止批量处理 / 删除转文献任务 /
 * 清空历史」三个 openFlowDialog 确认框没传 className —— 流程框挂 document.body，
 * 脱离 `.kb` 后纸墨私有 token 与域弹窗类全部失效，掉回 core 裸皮（同域里
 * 「添加文献 / 术语录入」有皮、确认框没皮；缺 `kb` 连底色 var(--panel) 都失效，
 * 同 issue 257 的透明背景事故）。
 *
 * 本用例守护：
 *  1) 三处 openFlowDialog 都传 `className: 'kb bz-kb-flow-dialog'`；
 *  2) 域 CSS 有 `#__shared_confirm_popup__.bz-kb-flow-dialog` 壳材质映射；
 *  3) `--bz-*` 组件 token 整组映射到纸墨私有 token（暗色主题可读性前提）；
 *  4) 危险语义不被域规则盖回（三处主动作均为 danger，域内不得出现 OK 钮选择器）。
 *
 * 注：tests/knowledge/ui.test.ts 在顶部 vi.mock 了 src/core/flow-dialog，那里做不了
 * 运行时 popup.classList 断言 —— 故样式/挂载一致性在本文件以源文本断言覆盖。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 tests/memo/skin-dark.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const css = () => repo('src/knowledge/styles.css');
const ui = () => repo('src/knowledge/ui.ts');

/** 取某选择器规则体（首个匹配；选择器内正则元字符转义） */
function block(sel: string): string | null {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css().match(new RegExp(`${esc}\\s*\\{[^}]*\\}`));
  return m ? m[0] : null;
}

describe('issue 291：knowledge 确认框随纸墨皮', () => {
  it('三处确认框都传 className: kb bz-kb-flow-dialog', () => {
    const hits = ui().match(/className: 'kb bz-kb-flow-dialog'/g) || [];
    expect(hits.length, '三处确认框（中止批量 / 删除任务 / 清空历史）各一处').toBe(3);
    // 三处流程框的标题守卫（防将来改文案/挪位置后本断言失去意义）
    for (const t of ['中止批量处理？', '删除转文献任务', '清空历史']) {
      expect(ui(), `缺确认框「${t}」`).toContain(t);
    }
  });

  it("'kb' 是纸墨 token 作用域（亮暗两档），自绘弹窗同为「域弹窗类 + kb」写法", () => {
    expect(css()).toMatch(/^\.kb \{/m);
    expect(css()).toMatch(/\.theme-dark \.kb \{/);
    // 域内先例：两处自绘弹窗都把 kb 并列写在根上（issue 257 注释同款）
    expect(ui()).toContain('bz-lit-dialog kb');
    expect(ui()).toContain('bz-kb-window kb');
  });

  it('壳材质映射：底/描边/圆角/投影逐值取自 .bz-lit-dialog（术语/添加任务弹窗）', () => {
    const b = block('#__shared_confirm_popup__.bz-kb-flow-dialog');
    expect(b, '缺 #__shared_confirm_popup__.bz-kb-flow-dialog 规则').not.toBeNull();
    expect(b!).toContain('background: var(--panel)');
    expect(b!).toContain('border: 1px solid var(--line)');
    expect(b!).toContain('border-radius: 14px');
    expect(b!).toContain('box-shadow');
    expect(b!).toContain('color: var(--ink)');
    // 明令不得套用浮层定位/尺寸（确认框已有自己的版式，套上会双份定位）
    for (const banned of ['position:', 'transform:', 'width:', 'height:']) {
      expect(b!, `壳规则不得含 ${banned}`).not.toContain(banned);
    }
  });

  it('token 映射：共享壳消费的 --bz-* 改走纸墨私有 token（防暗色主题浅底浅字不可读）', () => {
    const b = block('#__shared_confirm_popup__.bz-kb-flow-dialog');
    expect(b).not.toBeNull();
    for (const t of [
      '--bz-text-1: var(--ink)',
      '--bz-text-2: var(--ink2)',
      '--bz-surface-2: var(--card)',
      '--bz-surface-hover: var(--chip)',
      '--bz-danger: var(--red)',
      '--bz-radius-sm: 9px',
    ]) {
      expect(b!, `缺 ${t}`).toContain(t);
    }
  });

  it('标题/正文/取消钮：字体语言取 .bz-lit-sheet-title 与 .bz-lit-ghost-btn', () => {
    const h4 = block('#__shared_confirm_popup__.bz-kb-flow-dialog h4');
    expect(h4, '缺确认框标题规则').not.toBeNull();
    expect(h4!).toContain('serif');
    expect(h4!).toContain('letter-spacing');
    const p = block('#__shared_confirm_popup__.bz-kb-flow-dialog p');
    expect(p, '缺确认框正文规则').not.toBeNull();
    expect(p!).toContain('var(--ink2)');
    const cancel = block('#__shared_confirm_popup__.bz-kb-flow-dialog #__shared_confirm_cancel__');
    expect(cancel, '缺取消钮规则').not.toBeNull();
    expect(cancel!).toContain('var(--line)');
    expect(cancel!).toContain('var(--ink2)');
    expect(cancel!).toContain('background: none');
  });

  it('危险语义不被域规则覆盖：域内不写 OK 钮选择器（三处主动作都是 danger）', () => {
    // core 的 bz-flow-dialog--danger 已把主钮降级为「中性底 + 红字」（设计手册 §9/§10）；
    // 域规则若用更高特异性覆写 OK 钮会把危险语义盖回强调色 —— knowledge 段只做
    // token 映射（--bz-brand 映射只在非危险态生效，与危险修饰类无交集）。
    expect(css()).not.toContain('#__shared_confirm_popup__.bz-kb-flow-dialog #__shared_confirm_ok__');
  });
});

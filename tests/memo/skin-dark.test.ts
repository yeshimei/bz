// @vitest-environment node
/**
 * issue 270：memo 两肤暗色补齐 + 编辑器弹窗四类补样式 回归测试。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 review-fix-b.test.ts）：
 *  1) paper / editorial 各含 `.theme-dark .bz-memo-skin-*` token 整组覆盖
 *     （表面四档 + 文字三档 + 边框两档 + 品牌三档 + 皮肤墨色）；
 *  2) 三类壳（面板 / uiModal 弹窗 / 右键菜单）均有暗色壳规则；
 *  3) 编辑器四类（.bz-memo-editor / .bz-memo-due-row / .bz-memo-form-actions /
 *     .bz-memo-sortsel）在 CSS 中有规则；
 *  4) 暗色方案前提守护：uiModal 弹窗与 item-actions 菜单挂 document.body
 *     （.theme-dark 挂 body，后代选择器可达——挂载点改动会使暗色壳失效）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const css = () => repo('src/memo/styles.css');

/** 截取某暗色 token 组规则体（首个匹配） */
const darkTokenBlock = (skin: string) =>
  css().match(new RegExp(`\\.theme-dark \\.bz-memo-skin-${skin}\\s*\\{[^}]*\\}`));

describe('issue 270-A：两肤暗色 token 整组覆盖', () => {
  it.each(['paper', 'editorial'] as const)('%s：.theme-dark token 组存在且为整组覆盖', (skin) => {
    const block = darkTokenBlock(skin);
    expect(block, `缺 .theme-dark .bz-memo-skin-${skin} token 组`).not.toBeNull();
    for (const token of [
      '--bz-skin-ink',
      '--bz-surface-1', '--bz-surface-2', '--bz-surface-3', '--bz-surface-hover',
      '--bz-text-1', '--bz-text-2', '--bz-text-3',
      '--bz-border', '--bz-border-strong',
      '--bz-brand', '--bz-brand-hover', '--bz-brand-soft',
    ]) {
      expect(block![0], `token 组缺 ${token}`).toContain(token);
    }
  });

  it('paper 暗色保留米纸点阵语言：面板壳为 radial-gradient 点阵 + 深纸底 + 黑硬阴影', () => {
    const m = css().match(/\.theme-dark \.bz-memo-panel\.bz-memo-skin-paper\s*\{[\s\S]*?\n\}/);
    expect(m, '缺 paper 暗色面板壳规则').not.toBeNull();
    expect(m![0]).toContain('radial-gradient');
    expect(m![0]).toContain('box-shadow');
    expect(m![0]).toMatch(/rgba\(0, 0, 0, 0\.6\)/);
  });

  it('editorial 暗色为碳黑反转：面板壳/弹窗壳/右键菜单壳转深底 + 黑投影', () => {
    for (const sel of [
      '.theme-dark .bz-memo-panel.bz-memo-skin-editorial',
      '.theme-dark .bz-overlay-popup.bz-memo-skin-editorial',
      '.theme-dark .bz-item-menu.bz-memo-skin-editorial',
    ]) {
      const m = css().match(new RegExp(`${sel.replace(/\./g, '\\.')}\\s*\\{[^}]*\\}`));
      expect(m, `缺 ${sel} 暗色壳规则`).not.toBeNull();
      expect(m![0]).toContain('background');
      expect(m![0]).toContain('rgba(0, 0, 0');
    }
  });

  it('两类壳（uiModal 弹窗 / 右键菜单）两肤均有暗色规则（浮层挂 body 树内可达）', () => {
    for (const sel of [
      '.theme-dark .bz-overlay-popup.bz-memo-skin-paper',
      '.theme-dark .bz-item-menu.bz-memo-skin-paper',
    ]) {
      expect(css().match(new RegExp(`${sel.replace(/\./g, '\\.')}\\s*\\{[^}]*\\}`)),
        `缺 ${sel}`).not.toBeNull();
    }
  });

  it('暗色前提守护：uiModal 弹窗与 item-actions 菜单挂 document.body', () => {
    expect(repo('src/core/ui/modal.ts')).toContain('document.body.appendChild(mask)');
    expect(repo('src/core/item-actions.ts')).toContain('document.body.appendChild(m)');
  });
});

describe('issue 291：确认框随皮肤（流程框与 uiModal 同壳）', () => {
  it('ui.ts 两个流程框都传了皮肤类（删除备忘录 / 删除场景）', () => {
    const ui = repo('src/memo/ui.ts');
    // 两个 openFlowDialog 调用都带 className: skinClass()（漏传即掉回 core 裸皮 —— 本 issue 的缺陷形态）
    const hits = ui.match(/openFlowDialog\(\{[\s\S]*?\n  \}\);/g) ?? [];
    expect(hits.length).toBe(2);
    for (const h of hits) expect(h).toContain('className: skinClass()');
  });

  it('styles.css 有确认框双肤规则（纸感墨边硬阴影主按钮 + 两肤衬线标题）', () => {
    const paper = css().match(/#__shared_confirm_popup__\.bz-memo-skin-paper #__shared_confirm_ok__\s*\{[^}]*\}/);
    expect(paper, '缺纸感确认框主按钮规则').not.toBeNull();
    expect(paper![0]).toContain('var(--bz-skin-ink)'); // 墨边 + 硬偏移阴影随皮肤 token
    for (const sel of [
      '#__shared_confirm_popup__.bz-memo-skin-paper h4',
      '#__shared_confirm_popup__.bz-memo-skin-editorial h4',
    ]) {
      expect(css(), `缺 ${sel}`).toContain(sel);
    }
  });

  it('core 侧前提守护：流程框 popup 挂共享壳类 bz-overlay-popup（皮肤壳规则才命中）', () => {
    expect(repo('src/core/flow-dialog.ts')).toContain("'bz-overlay-popup bz-flow-dialog'");
  });
});

describe('issue 270-B：编辑器弹窗四类补样式', () => {
  it('.bz-memo-editor：弹窗内容包裹有纵向排布规则', () => {
    const m = css().match(/\.bz-memo-editor\s*\{[^}]*\}/);
    expect(m, '缺 .bz-memo-editor 规则').not.toBeNull();
    expect(m![0]).toContain('flex-direction: column');
  });

  it('.bz-memo-due-row：flex 行 + 输入框吃余量（防清除钮被 width:100% 挤换行）', () => {
    const row = css().match(/\.bz-memo-due-row\s*\{[^}]*\}/);
    expect(row, '缺 .bz-memo-due-row 规则').not.toBeNull();
    expect(row![0]).toContain('display: flex');
    expect(row![0]).toContain('align-items: center');
    const input = css().match(/\.bz-memo-due-row \.bz-input\s*\{[^}]*\}/);
    expect(input, '缺 .bz-memo-due-row .bz-input 规则').not.toBeNull();
    expect(input![0]).toContain('flex: 1');
    expect(input![0]).toContain('min-width: 0');
  });

  it('.bz-memo-form-actions：右对齐按钮行', () => {
    const m = css().match(/\.bz-memo-form-actions\s*\{[^}]*\}/);
    expect(m, '缺 .bz-memo-form-actions 规则').not.toBeNull();
    expect(m![0]).toContain('justify-content: flex-end');
  });

  it('.bz-memo-sortsel：排序下拉实例类有规则', () => {
    expect(css().match(/\.bz-memo-sortsel\s*\{[^}]*\}/), '缺 .bz-memo-sortsel 规则').not.toBeNull();
  });

  it('四类在 ui.ts 中确有挂载（样式与标记一一对应，防样式孤儿）', () => {
    const ui = repo('src/memo/ui.ts');
    for (const cls of ['bz-memo-editor', 'bz-memo-due-row', 'bz-memo-form-actions', 'bz-memo-sortsel']) {
      expect(ui, `ui.ts 缺 ${cls} 挂载`).toContain(cls);
    }
  });
});

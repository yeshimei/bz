/**
 * 归物本「瑞士大字报」poster 皮肤暗色模式（issue 270）守护。
 * 旧口径「纸面双主题恒定」作废：.theme-dark 下四壳（面板/表单/详情/右键菜单）
 * token 整组翻夜版海报（深炭底 × 米白粉笔墨 × 赤橙微提亮），亮色侧零改动。
 * 四壳中菜单/表单/详情挂 document.body、面板挂 workspace leaf——均为 body.theme-dark
 * 后代，祖先选择器可达；jsdom 不算 CSS 级联，锚样式源文本（先例 clipbook/menu-skin-vars）。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssText = () => readFileSync(resolve(process.cwd(), 'src/belongings/styles.css'), 'utf8');

/** 锚点在选择器段：返回该规则的选择器段与规则体 */
function ruleOfSelector(text: string, sel: string): { selector: string; body: string } {
  const at = text.indexOf(sel);
  expect(at, `缺选择器 ${sel}`).toBeGreaterThan(-1);
  const braceAt = text.indexOf('{', at);
  const selStart = text.lastIndexOf('}', braceAt) + 1;
  return { selector: text.slice(selStart, braceAt), body: text.slice(braceAt, text.indexOf('}', braceAt)) };
}

/** 锚点在规则体内部（token 定义行）：返回所在规则体 */
function ruleBodyOfToken(text: string, token: string): string {
  const at = text.indexOf(token);
  expect(at, `缺 token ${token}`).toBeGreaterThan(-1);
  const braceAt = text.lastIndexOf('{', at);
  return text.slice(braceAt, text.indexOf('}', braceAt));
}

describe('belongings poster 皮肤暗色模式（issue 270）', () => {
  it('暗色 token 组：.theme-dark 后代选择器同时覆盖四壳（面板/表单/详情/右键菜单）', () => {
    const { selector } = ruleOfSelector(cssText(), '.theme-dark .bz-bel--poster');
    for (const shell of [
      '.theme-dark .bz-bel--poster',
      '.theme-dark .bz-bel-form',
      '.theme-dark .bz-bel-detail',
      '.theme-dark .bz-bel-menu',
    ]) {
      expect(selector, `暗色组缺壳 ${shell}`).toContain(shell);
    }
  });

  it('暗色组整组翻夜版海报：深炭纸面 / 米白墨 / 赤橙提亮 / 纯黑硬阴影三档', () => {
    const { body } = ruleOfSelector(cssText(), '.theme-dark .bz-bel--poster');
    expect(body).toContain('--bz-bel-paper: #1a1815');
    expect(body).toContain('--bz-bel-ink: #ece7da');
    expect(body).toContain('--bz-bel-accent: #f0603a');
    expect(body).toContain('--bz-bel-dim: #25221d'); /* 离场灰化 / hover 浮起档 */
    expect(body).toContain('--bz-bel-shadow: rgba(0, 0, 0, 0.55)');
    expect(body).toContain('--bz-bel-shadow-strong: rgba(0, 0, 0, 0.9)');
    expect(body).toContain('--bz-bel-shadow-pop: rgba(0, 0, 0, 0.5)');
    expect(body).toContain('--bz-bel-ink-muted: #6b6455'); /* 反色底此时是米白，弱化字转深灰 */
  });

  it('暗色组 token 名集合与亮色组一致（不允许漏覆导致半翻色）', () => {
    const text = cssText();
    const light = ruleBodyOfToken(text, '--bz-bel-paper: #f5f2ec');
    const dark = ruleBodyOfToken(text, '--bz-bel-paper: #1a1815');
    const names = (body: string) =>
      [...body.matchAll(/(--bz-[a-z0-9-]*)\s*:/g)].map((m) => m[1]).sort();
    expect(names(dark)).toStrictEqual(names(light));
  });

  it('亮色基准零改动：纸面/墨/赤橙/品牌加深档原值保留，且暗色组在其后', () => {
    const text = cssText();
    expect(text).toContain('--bz-bel-paper: #f5f2ec');
    expect(text).toContain('--bz-bel-ink: #171512');
    expect(text).toContain('--bz-bel-accent: #e8481f');
    expect(text).toContain('--bz-brand-hover: #c93a10');
    expect(text.indexOf('--bz-bel-paper: #f5f2ec')).toBeLessThan(text.indexOf('--bz-bel-paper: #1a1815'));
  });

  it('硬偏移阴影收编 token：rgba(23,21,18,…) 仅存于亮色 shadow 三档定义行，结构规则零硬编码阴影', () => {
    const text = cssText();
    const hits = [...text.matchAll(/rgba\(23, 21, 18[^)]*\)/g)].map((m) => m[0]);
    expect(hits).toStrictEqual(['rgba(23, 21, 18, 0.22)', 'rgba(23, 21, 18, 0.85)', 'rgba(23, 21, 18, 0.15)']);
    for (const h of hits) {
      const lineStart = text.lastIndexOf('\n', text.indexOf(h)) + 1;
      expect(text.slice(lineStart, text.indexOf(h)), `${h} 未走 token`).toContain('--bz-bel-shadow');
    }
    expect(text.match(/box-shadow:[^;]*rgba\(/), 'box-shadow 规则不得硬编码 rgba').toBeNull();
  });

  it('反色弱化字与状态徽章收编 token：hover 弱化字 / 转卖 / 丢弃档不再硬编码 hex', () => {
    const text = cssText();
    expect(text).toMatch(/\.bz-bel-cell:hover \.bz-bel-cell-idx \{ color: var\(--bz-bel-ink-muted\); \}/);
    expect(text).toMatch(/\.bz-bel-tag--sold \{ border-color: var\(--bz-bel-tag-sold\); color: var\(--bz-bel-tag-sold\); \}/);
    expect(text).toMatch(/\.bz-bel-tag--discard \{ border-style: dashed; border-color: var\(--bz-bel-tag-discard\); color: var\(--bz-bel-tag-discard\); \}/);
  });
});

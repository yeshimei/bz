/**
 * issue 277 / ADR-0122：隐藏滚动条收敛为界面级单源（src/core/ui/components.css）回归：
 * - core 一条通杀规则覆盖「bz- 前缀类/ID + 面板壳整树 + 非 bz 前缀遗留弹层」，刻意不用 * 通配
 *   （Obsidian 核心 UI 不属本插件，不隐藏）；
 * - 域内可见条写法（scrollbar-width: thin / 自绘 ::-webkit-scrollbar-thumb）已清退且不得回潮；
 * - 滚动功能保留：只隐藏条，一律不动 overflow。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 knowledge-style-fix.test.ts / enh-sweep-c）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const componentsCss = () => repo('src/core/ui/components.css');

/** 递归收集 src 下全部 styles.css（根 styles.css 是构建产物，不在 src，天然排除） */
function listDomainStyles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listDomainStyles(p));
    else if (name === 'styles.css') out.push(p);
  }
  return out;
}

describe('issue 277：滚动条隐藏收敛界面级单源（ADR-0122）', () => {
  it('core components.css 持界面级规则：bz- 前缀类/ID + 面板壳整树 + 遗留容器全部在册', () => {
    const css = componentsCss();
    const rule = css.match(/\[class\^="bz-"\][^{}]*\{[^}]*scrollbar-width: none[^}]*\}/);
    expect(rule, '缺界面级隐藏滚动条规则（scrollbar-width: none 档）').not.toBeNull();
    for (const sel of [
      '[class^="bz-"]',
      '[class*=" bz-"]',
      '[id^="bz-"]',
      '[id^="knowledge-"]',
      '#add-diary-popup',
      '#review-entries-container',
      '#__shared_confirm_popup__',
    ]) {
      expect(css, `缺选择器 ${sel}`).toContain(sel);
    }
    // webkit 档同组在册（::-webkit-scrollbar 不继承，需对元素自身 + 子树显式枚举）
    expect(css).toContain('[id^="knowledge-"]::-webkit-scrollbar');
    expect(css).toContain('#review-entries-container *::-webkit-scrollbar');
  });

  it('界面级规则刻意不用顶层 * 通配（Obsidian 文件树/编辑器/核心设置不被波及）', () => {
    const css = componentsCss();
    const block = css.match(/\/\* bz 界面级隐藏滚动条[\s\S]*?display: none;\r?\n\}/);
    expect(block, '缺界面级规则区块').not.toBeNull();
    // 面板壳整树的「*」是子树内后代形态（.bz-panel-overlay *），顶层通配（行首 *）才是禁区
    expect(block![0]).not.toMatch(/(^|\n)\s*\*[\s,{:]/);
  });

  it('knowledge / encrypt：可见条写法清退（thin 与自绘 width 档零残留）', () => {
    expect(repo('src/knowledge/styles.css')).not.toContain('scrollbar-width: thin');
    expect(repo('src/encrypt/styles.css')).not.toContain('scrollbar-width: thin');
    expect(repo('src/encrypt/styles.css')).not.toMatch(/::-webkit-scrollbar\s*\{\s*width/);
    expect(repo('src/encrypt/styles.css')).not.toContain('::-webkit-scrollbar-thumb');
  });

  it('全仓 src/**/styles.css：thin/auto 与 ::-webkit-scrollbar-thumb 零回潮（杜绝可见条）', () => {
    const hits: string[] = [];
    for (const file of listDomainStyles('src')) {
      const css = repo(file);
      for (const m of css.matchAll(/scrollbar-width:\s*(thin|auto)\b/g)) hits.push(`${file}: ${m[0]}`);
      if (css.includes('::-webkit-scrollbar-thumb')) hits.push(`${file}: ::-webkit-scrollbar-thumb`);
    }
    expect(hits).toEqual([]);
  });
});

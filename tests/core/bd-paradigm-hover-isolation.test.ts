// @vitest-environment node
/**
 * 呈报#9（F4，拍板★A 立项）触屏悬浮隔离范式 · 契约测试
 *
 * 口径（拍板「取机械可验证口径」）：触屏 / 无悬浮设备一律不进悬浮态——
 * src 下**全部实现样式**中的 `:hover` 规则（功能型：hover 显钮 / 换内容 / 预览；
 * 与纯视觉型：变色 / 描边，一并统一口径）必须位于 `@media (hover: hover)` 媒体查询内。
 * - 桌面（hover 设备）零变化：媒体条件恒真，规则照常生效；
 * - 触屏（hover: none）：媒体不命中，规则整条不生效——点过的悬浮态不再粘在卡片上；
 * - 豁免清单已清零：memo 原豁免（队尾重审随重审统一处理）已随 memo2-consistency 新-1
 *   重审落地摘除，vendor 为第三方 normalize 不属实现样式，一并豁免。
 * 收藏夹（favorites）为 F4 首报验收样例：卡墙 hover 那条腿在此域断言在位。
 *
 * 解析器为本仓 CSS 子集（注释 / 字符串 / 嵌套 @media / 规则块），与迁移 codemod 同算法。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

/** 豁免清单：路径用 posix 分隔。新增样式文件不进清单即受契约约束。 */
const SKIPLIST: string[] = [];

interface HoverRule {
  sel: string;
  mediaStack: string[];
}

/** 去注释/字符串后的选择器文本 */
function effectiveSelector(prelude: string): string {
  let t = prelude.replace(/\/\*[\s\S]*?\*\//g, '');
  t = t.replace(/"[^"]*"|'[^']*'/g, '');
  return t;
}

/** 跳过 prelude 扫描中的块注释，返回注释收尾之后的位置 */
function skipComment(css: string, i: number): number {
  const end = css.indexOf('*/', i + 2);
  if (end === -1) throw new Error('unterminated comment');
  return end + 1;
}

/** 跳过带引号字符串，返回收尾引号位置 */
function skipString(css: string, i: number): number {
  const q = css[i];
  let k = i + 1;
  while (k < css.length) {
    if (css[k] === '\\') { k += 2; continue; }
    if (css[k] === q) return k;
    k++;
  }
  return k;
}

/** 扫描 CSS：返回全部 `:hover` 规则节点（选择器文本 + 其所在的 @media 条件栈）。
 *  与迁移 codemod 同算法：prelude 逐字符扫描（注释/字符串感知），规则块取配对大括号。 */
function collectHoverRules(css: string): HoverRule[] {
  const out: HoverRule[] = [];

  function walk(from: number, to: number, mediaStack: string[]): void {
    let i = from;
    while (i < to) {
      let preludeEnd = -1;
      for (let j = i; j < to; j++) {
        const c = css[j];
        if (c === '/' && css[j + 1] === '*') { j = skipComment(css, j); continue; }
        if (c === '"' || c === "'") { j = skipString(css, j); continue; }
        if (c === '{' || c === ';' || c === '}') { preludeEnd = j; break; }
      }
      if (preludeEnd === -1 || preludeEnd >= to) return;
      const prelude = css.slice(i, preludeEnd);
      if (css[preludeEnd] !== '{') { i = preludeEnd + 1; continue; } // 声明/散字符
      let depth = 0;
      let bodyEnd = -1;
      for (let j = preludeEnd; j < css.length; j++) {
        const c = css[j];
        if (c === '/' && css[j + 1] === '*') { j = skipComment(css, j); continue; }
        if (c === '"' || c === "'") { j = skipString(css, j); continue; }
        if (c === '{') depth++;
        if (c === '}') { depth--; if (depth === 0) { bodyEnd = j; break; } }
      }
      if (bodyEnd === -1) throw new Error('unbalanced braces');
      const cond = effectiveSelector(prelude).trim();
      if (cond.startsWith('@')) {
        walk(preludeEnd + 1, bodyEnd, cond.startsWith('@media') ? [...mediaStack, cond] : mediaStack);
      } else if (cond.includes(':hover')) {
        out.push({ sel: cond.replace(/\s+/g, ' '), mediaStack: [...mediaStack] });
      }
      i = bodyEnd + 1;
    }
  }

  walk(0, css.length, []);
  return out;
}

/** 递归收集待扫描样式文件（全部 *.css；vendor 豁免在扫描处过滤） */
function listCss(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listCss(p));
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}

const inHover = (stack: string[]) => stack.some((c) => /\(\s*hover\s*:\s*hover\s*\)/.test(c));

describe('呈报#9（F4）触屏悬浮隔离范式：:hover 规则全量包 @media (hover: hover)', () => {
  const files = listCss(join(ROOT, 'src')).map((p) => relative(ROOT, p).split('\\').join('/'))
    .filter((p) => !p.startsWith('src/core/vendor/')); // 第三方 normalize 不属实现样式
  const scanned = files.filter((p) => !SKIPLIST.includes(p));

  it('扫描面完整：域 styles.css + core 样式全部在册（不含 vendor；memo 豁免已摘除）', () => {
    expect(files.length).toBeGreaterThanOrEqual(24);
    for (const skip of SKIPLIST) expect(files, `豁免清单里的 ${skip} 应真实存在`).toContain(skip);
    expect(files).toContain('src/favorites/styles.css');
    expect(files).toContain('src/core/ui/components.css');
    expect(files).toContain('src/core/styles.css');
    expect(files).toContain('src/memo/styles.css'); // memo 随队尾重审入册，豁免摘除
    expect(scanned).toContain('src/memo/styles.css');
  });

  it('圈外 :hover 规则清零：全部位于 @media (hover: hover) 内（含嵌套媒体）', () => {
    const offenders: string[] = [];
    for (const rel of scanned) {
      const css = readFileSync(join(ROOT, rel), 'utf8');
      for (const r of collectHoverRules(css)) {
        if (!inHover(r.mediaStack)) offenders.push(`${rel} → ${r.sel}`);
      }
    }
    expect(offenders, `以下 :hover 规则未包 @media (hover: hover)（触屏粘滞范式破口）:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('范式确有落地（防「全文件恰好无 hover」空转）：核心样例域在位', () => {
    // F4 首报验收样例：收藏夹卡墙 hover 位移那套
    const fav = readFileSync(join(ROOT, 'src/favorites/styles.css'), 'utf8');
    expect(fav).toContain('@media (hover: hover)');
    expect(collectHoverRules(fav).some((r) => r.sel.includes('.bz-fav-card:hover'))).toBe(true);
    // core 单源：组件库交互基线（按钮/列表行 hover 变色）一并隔离
    const comp = readFileSync(join(ROOT, 'src/core/ui/components.css'), 'utf8');
    expect(comp).toContain('@media (hover: hover)');
    expect(collectHoverRules(comp).length).toBeGreaterThan(0);
  });

  it('豁免清单不蔓延：豁免已清零且不再新增', () => {
    expect(SKIPLIST).toEqual([]);
  });
});

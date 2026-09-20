/**
 * memo styles.css 结构守卫（拍板执行批收口发现）：移动端收口段的「5) 触控热区抬档」
 * 一组曾被机械悬浮包裹误关进嵌套 (hover:hover) 块——触屏无悬浮，整组 40/44px 抬档失效。
 * 口径：把文件里所有 `@media (hover: hover) { … }` 块整体剪掉后，热区抬档规则必须**仍然在场**
 * （若规则被关进悬浮块，剪块即一并消失，本用例即红）；另钉全文件花括号配平防结构漂移。
 */
import fs from 'node:fs';
import path from 'node:path';
import { it, expect } from 'vitest';

const css = fs.readFileSync(path.join(process.cwd(), 'src/memo/styles.css'), 'utf8');
const ANCHOR = '.bz-memo-panel .bz-memo-sort .bz-select { height: 40px; }';
const RULES = [
  ANCHOR,
  '.bz-memo-panel .bz-toolrow .bz-input { height: 40px; }',
  '.bz-memo-panel .bz-memo-composer .bz-btn { height: 40px; }',
  '.bz-memo-panel .bz-memo-donebar { min-height: 44px; }',
  '.bz-memo-panel .bz-memo-done-more { min-height: 44px; }',
  '.bz-memo-tag.bz-memo-tag-pos::after { content',
];

/** 剪掉所有 `@media (hover: hover) { … }` 平衡块（含嵌套花括号） */
function stripHoverBlocks(text: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const hit = text.indexOf('@media (hover: hover)', i);
    if (hit === -1) return out + text.slice(i);
    out += text.slice(i, hit);
    const open = text.indexOf('{', hit);
    let depth = 0;
    let j = open;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    i = j + 1;
  }
}

it('剪掉全部 hover:hover 块后，触控热区抬档规则仍然在场（未误关进悬浮块）', () => {
  expect(css).toContain(ANCHOR); // 规则本体存在
  const stripped = stripHoverBlocks(css);
  for (const r of RULES) expect(stripped, `规则应在悬浮块外：${r}`).toContain(r);
});

it('热区抬档组归属移动端收口段（最后一个 max-width:768px 块内）', () => {
  const start = css.lastIndexOf('@media (max-width: 768px)');
  expect(start).toBeGreaterThan(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  let j = open;
  for (; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  expect(css.slice(open, j + 1)).toContain(ANCHOR);
});

it('全文件花括号配平（防块内吞组结构漂移）', () => {
  expect(css.split('{').length - 1).toBe(css.split('}').length - 1);
});

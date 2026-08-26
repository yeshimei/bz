// @vitest-environment node
/**
 * 白名单目录工具测试（ticket 113）：parsePathList / formatPathList / normalizeSelection /
 * collectFolderInfos——纯函数，node 环境，无 DOM。
 */
import { describe, it, expect } from 'vitest';
import { parsePathList, formatPathList, normalizeSelection, collectFolderInfos } from '../../src/secondbrain/whitelist';

describe('parsePathList', () => {
  it('基本拆分：逗号分隔 + trim + 去首尾斜杠', () => {
    expect(parsePathList('我的, 卡片盒/, /CODE')).toEqual(['我的', '卡片盒', 'CODE']);
  });
  it('null/undefined/空串 → 空数组', () => {
    expect(parsePathList(null)).toEqual([]);
    expect(parsePathList(undefined)).toEqual([]);
    expect(parsePathList('')).toEqual([]);
  });
  it('保序去重：重复项只保留首次出现', () => {
    expect(parsePathList('A, B, A, C')).toEqual(['A', 'B', 'C']);
  });
  it('纯空白项被过滤', () => {
    expect(parsePathList(' , , ')).toEqual([]);
  });
  it('嵌套子目录正常保留', () => {
    expect(parsePathList('我的/日记, 我的')).toEqual(['我的/日记', '我的']);
  });
});

describe('formatPathList', () => {
  it('反向格式化：逗号拼接，无空格', () => {
    expect(formatPathList(['A', 'B'])).toBe('A,B');
  });
  it('空数组 → 空串', () => {
    expect(formatPathList([])).toBe('');
  });
  it('去重 + 去冗余后代（normalizeSelection 内置）', () => {
    expect(formatPathList(['我的', '我的/日记'])).toBe('我的');
  });
});

describe('normalizeSelection', () => {
  it('trim + 去空 + 去首尾斜杠 + 去重', () => {
    expect(normalizeSelection([' A ', '/B/', ' A '])).toEqual(['A', 'B']);
  });
  it('祖先已选则丢弃后代', () => {
    expect(normalizeSelection(['我的', '我的/日记', '我的/读书'])).toEqual(['我的']);
  });
  it('无祖先关系时保留全部', () => {
    expect(normalizeSelection(['A', 'B/C'])).toEqual(['A', 'B/C']);
  });
  it('子目录在前、祖先在后时也能正确过滤', () => {
    expect(normalizeSelection(['我的/日记', '我的'])).toEqual(['我的']);
  });
  it('空输入 → 空', () => {
    expect(normalizeSelection([])).toEqual([]);
  });
  it('仅 trim/去重，不干涉非祖先关系', () => {
    expect(normalizeSelection(['CODE', '卡片盒', '归档'])).toEqual(['CODE', '卡片盒', '归档']);
  });
});

describe('collectFolderInfos', () => {
  it('目录聚合 + 根级单文件识别', () => {
    const infos = collectFolderInfos([
      '我的/A.md',
      '我的/B.md',
      '我的/日记/C.md',
      'CODE/root.md',
      '独立文件.md',
    ]);
    const paths = infos.map((i) => i.path);
    // 根级单文件
    expect(paths).toContain('独立文件.md');
    const rf = infos.find((i) => i.path === '独立文件.md')!;
    expect(rf.isFile).toBe(true);
    expect(rf.notes).toBe(1);
    expect(rf.depth).toBe(0);
    // 目录：我的（3 篇子树）> CODE（1 篇）> 我的/日记（1 篇）
    const mine = infos.find((i) => i.path === '我的')!;
    expect(mine.notes).toBe(3);
    expect(mine.isFile).toBe(false);
    const diary = infos.find((i) => i.path === '我的/日记')!;
    expect(diary.notes).toBe(1);
    expect(diary.depth).toBe(1);
    const code = infos.find((i) => i.path === 'CODE')!;
    expect(code.notes).toBe(1);
  });
  it('排序：按 path 字典序；含根级单文件夹在目录之后', () => {
    const infos = collectFolderInfos(['Z/b.md', 'A/a.md', '独立.md']);
    expect(infos.map((i) => i.path)).toEqual(['A', 'Z', '独立.md']);
  });
  it('空库 → 空数组', () => {
    expect(collectFolderInfos([])).toEqual([]);
  });
  it('仅根级文件 → 全是 isFile 条目', () => {
    const infos = collectFolderInfos(['a.md', 'b.md']);
    expect(infos.every((i) => i.isFile)).toBe(true);
  });
  it('子目录逐级聚合：每级祖先都计数', () => {
    const infos = collectFolderInfos(['a/b/c/d.md']);
    const dirs = infos.filter((i) => !i.isFile).map((i) => i.path);
    expect(dirs).toContain('a');
    expect(dirs).toContain('a/b');
    expect(dirs).toContain('a/b/c');
    const a = infos.find((i) => i.path === 'a')!;
    expect(a.notes).toBe(1);
    expect(a.depth).toBe(0);
  });
});

// @vitest-environment node
/**
 * 闪念 UI 工具测试（P2）：jumpToChunk 选区定位——from 直接取 offsetToPos(idx)，
 * 不再因恒真三元退化为文档开头。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { jumpToChunk } from '../../src/secondbrain/ui-tools';
import { setApp } from '../../src/core/app';

describe('jumpToChunk（P2）', () => {
  beforeEach(() => setApp(null as any));

  function makeApp(text: string, ed: any) {
    return {
      vault: { getAbstractFileByPath: (p: string) => (p === 'N.md' ? { path: 'N.md' } : null) },
      workspace: { getLeaf: () => ({ openFile: async () => {}, view: { editor: ed } }) },
    } as any;
  }

  it('highlight=true：from/to 均来自 offsetToPos（可辨识映射验证精确选区）', async () => {
    const text = '第一段落\n这里是目标块文本所在行\n结尾';
    const needle = '目标块文本';
    const idx = text.indexOf(needle);
    const selections: any[][] = [];
    const ed = {
      getValue: () => text,
      offsetToPos: (off: number) => ({ line: off, ch: off * 2 }), // 可辨识映射
      setSelection: (a: any, b: any) => selections.push([a, b]),
    };
    setApp(makeApp(text, ed));
    jumpToChunk({ path: 'N.md' }, needle, true);
    await new Promise((r) => setTimeout(r, 0));
    expect(selections).toHaveLength(1);
    const [from, to] = selections[0];
    expect(from).toEqual({ line: idx, ch: idx * 2 }); // 不再是 {line:0,ch:0}
    expect(to).toEqual({ line: idx + needle.length, ch: (idx + needle.length) * 2 });
  });

  it('highlight=false 或未命中片段 → 不调用 setSelection', async () => {
    const text = '正文内容';
    const selections: any[] = [];
    const ed = {
      getValue: () => text,
      offsetToPos: (off: number) => ({ line: off, ch: 0 }),
      setSelection: (...args: any[]) => selections.push(args),
    };
    setApp(makeApp(text, ed));
    jumpToChunk({ path: 'N.md' }, '不存在片段', true);
    jumpToChunk({ path: 'N.md' }, '正文内容', false);
    await new Promise((r) => setTimeout(r, 0));
    expect(selections).toHaveLength(0);
  });

  it('文件不存在 → 安全返回', async () => {
    const app = {
      vault: { getAbstractFileByPath: () => null },
      workspace: { getLeaf: () => ({ openFile: async () => {} }) },
    } as any;
    setApp(app);
    expect(() => jumpToChunk({ path: 'X.md' }, '任意', true)).not.toThrow();
  });
});

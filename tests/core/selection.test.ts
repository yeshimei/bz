/**
 * 选区读取助手测试（ticket 02/06）：getSelectionSnapshot 从活动编辑器读取
 * 选中文字 + 起止位置快照；无编辑器/无选区/读取失败 → null（永不拒收降级）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { getSelectionSnapshot } from '../../src/core/selection';

function makeApp(activeEditor: any): any {
  return { workspace: { activeEditor } };
}

describe('getSelectionSnapshot', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
  });

  it('有选区：返回文字 + 起止位置快照 + 来源笔记路径', () => {
    const editor = {
      getSelection: () => '提喻法是修辞手法',
      getCursor: (which: string) => (which === 'from' ? { line: 3, ch: 2 } : { line: 3, ch: 10 }),
    };
    const app = makeApp({ editor, file: { path: '笔记/文学课.md' } });
    const snap = getSelectionSnapshot(app);
    expect(snap).toEqual({
      text: '提喻法是修辞手法',
      filePath: '笔记/文学课.md',
      line: 3,
      ch: 2,
      endLine: 3,
      endCh: 10,
    });
  });

  it('选区文字去首尾空白', () => {
    const editor = {
      getSelection: () => '  选中的内容  \n',
      getCursor: (which: string) => (which === 'from' ? { line: 0, ch: 0 } : { line: 1, ch: 2 }),
    };
    const app = makeApp({ editor, file: { path: 'a.md' } });
    const snap = getSelectionSnapshot(app);
    expect(snap!.text).toBe('选中的内容');
  });

  it('无活动编辑器 / 无选区 / 空白选区 → null', () => {
    expect(getSelectionSnapshot(makeApp(null))).toBeNull();
    expect(getSelectionSnapshot(makeApp({ editor: null, file: null }))).toBeNull();
    expect(
      getSelectionSnapshot(makeApp({ editor: { getSelection: () => '' }, file: null }))
    ).toBeNull();
    expect(
      getSelectionSnapshot(makeApp({ editor: { getSelection: () => '   ' }, file: null }))
    ).toBeNull();
  });

  it('选区读取抛错 → null（不阻断录入）', () => {
    const editor = {
      getSelection: () => {
        throw new Error('boom');
      },
    };
    expect(getSelectionSnapshot(makeApp({ editor, file: null }))).toBeNull();
    expect(getSelectionSnapshot(null as any)).toBeNull();
  });
});

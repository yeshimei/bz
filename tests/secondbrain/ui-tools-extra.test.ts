/**
 * 闪念 UI 工具补充覆盖：renderMarkdown / makeDraggable / makeResizable
 * （jumpToChunk 主路径见 ui-tools.test.ts；本文件补齐其余导出与防御分支）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { jumpToChunk, renderMarkdown, makeDraggable, makeResizable } from '../../src/secondbrain/ui-tools';
import { setApp } from '../../src/core/app';
import { MarkdownRenderer } from 'obsidian';

beforeEach(() => {
  setApp(null as any);
  vi.restoreAllMocks();
});

describe('renderMarkdown', () => {
  it('正常路径：委托 MarkdownRenderer.render（mock 写入 textContent）', () => {
    const el = document.createElement('div');
    const app = {} as any;
    renderMarkdown(el, '# 标题', app);
    expect((MarkdownRenderer as any).render).toHaveBeenCalledWith(app, '# 标题', el, '', expect.anything());
    expect(el.textContent).toBe('# 标题');
  });

  it('渲染同步抛错 → 回退 textContent 纯文本（不抛出）', () => {
    const el = document.createElement('div');
    vi.spyOn(MarkdownRenderer as any, 'render').mockImplementationOnce(() => {
      throw new Error('渲染失败');
    });
    expect(() => renderMarkdown(el, '**粗体**', {} as any)).not.toThrow();
    expect(el.textContent).toBe('**粗体**');
  });
});

describe('makeDraggable', () => {
  function mouse(type: string, x: number, y: number) {
    return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  }

  it('按下 + 移动 → left/top 跟随位移并回调 onMove', () => {
    const el = document.createElement('div');
    const handle = document.createElement('div');
    document.body.appendChild(el);
    const moves: Array<[number, number]> = [];
    const dispose = makeDraggable(el, handle, (x, y) => moves.push([x, y]));

    handle.dispatchEvent(mouse('mousedown', 10, 20));
    document.dispatchEvent(mouse('mousemove', 35, 45));
    // jsdom getBoundingClientRect 全 0：orig(0,0)，位移 = (35-10, 45-20)
    expect(el.style.left).toBe('25px');
    expect(el.style.top).toBe('25px');
    expect(moves).toEqual([[25, 25]]);
    dispose();
  });

  it('mouseup 后停止跟随；dispose 后监听移除不再响应', () => {
    const el = document.createElement('div');
    const handle = document.createElement('div');
    document.body.appendChild(el);
    const dispose = makeDraggable(el, handle);

    handle.dispatchEvent(mouse('mousedown', 0, 0));
    document.dispatchEvent(mouse('mousemove', 5, 5));
    document.dispatchEvent(mouse('mouseup', 5, 5));
    document.dispatchEvent(mouse('mousemove', 100, 100));
    expect(el.style.left).toBe('5px'); // mouseup 后冻结

    dispose();
    document.dispatchEvent(mouse('mousemove', 200, 200));
    expect(el.style.left).toBe('5px'); // dispose 后彻底不响应
  });

  it('未按下时 mousemove 不改变位置', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const dispose = makeDraggable(el, document.createElement('div'));
    document.dispatchEvent(mouse('mousemove', 50, 50));
    expect(el.style.left).toBe('');
    dispose();
  });
});

describe('makeResizable（8 向手柄）', () => {
  function mouse(type: string, x: number, y: number) {
    return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  }
  function setup(minW = 10, minH = 8) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const dispose = makeResizable(el, minW, minH);
    const handles = Array.from(el.children) as HTMLElement[];
    const byDir = (dir: string) =>
      handles.find((h) => h.style.cursor === `${dir}-resize`)!;
    return { el, dispose, byDir };
  }

  it('生成 8 个方向手柄，dispose 全部移除', () => {
    const { el, dispose } = setup();
    expect(el.children.length).toBe(8);
    dispose();
    expect(el.childElementCount).toBe(0);
  });

  it('e 向拖大 → width 增至 origW+dx', () => {
    const { el, byDir, dispose } = setup();
    byDir('e').dispatchEvent(mouse('mousedown', 0, 0));
    document.dispatchEvent(mouse('mousemove', 50, 0));
    expect(el.style.width).toBe('50px'); // max(minW=10, 0+50)
    dispose();
  });

  it('w 向拖动 → 宽度变化且左边距反向补偿', () => {
    const { el, byDir, dispose } = setup();
    byDir('w').dispatchEvent(mouse('mousedown', 0, 0));
    document.dispatchEvent(mouse('mousemove', -30, 0));
    expect(el.style.width).toBe('30px'); // max(10, 0-(-30))
    expect(el.style.left).toBe('-30px'); // origLeft + (origW - w) = 0-30
    dispose();
  });

  it('s 向拉高 → height 增至 origH+dy', () => {
    const { el, byDir, dispose } = setup();
    byDir('s').dispatchEvent(mouse('mousedown', 0, 0));
    document.dispatchEvent(mouse('mousemove', 0, 40));
    expect(el.style.height).toBe('40px'); // max(minH=8, 0+40)
    dispose();
  });

  it('n 向上收 → 高度受 minH 钳位且 top 反向补偿', () => {
    const { el, byDir, dispose } = setup();
    byDir('n').dispatchEvent(mouse('mousedown', 0, 0));
    document.dispatchEvent(mouse('mousemove', 0, 30)); // dy=30 → origH-dy=-30 < minH
    expect(el.style.height).toBe('8px'); // 钳到 minH
    expect(el.style.top).toBe('-8px'); // origTop + (origH - h)
    dispose();
  });

  it('mouseup 后冻结；dispose 后 mousemove 不再改尺寸', () => {
    const { el, byDir, dispose } = setup();
    byDir('ne').dispatchEvent(mouse('mousedown', 0, 0));
    document.dispatchEvent(mouse('mousemove', 20, 20));
    document.dispatchEvent(mouse('mouseup', 20, 20));
    document.dispatchEvent(mouse('mousemove', 80, 80));
    expect(el.style.width).toBe('20px');
    dispose();
    document.dispatchEvent(mouse('mousemove', 120, 120));
    expect(el.style.width).toBe('20px');
  });
});

describe('jumpToChunk 防御分支', () => {
  it('leaf.view 无 editor → openFile 正常、不抛错', async () => {
    let opened = 0;
    setApp({
      vault: { getAbstractFileByPath: () => ({ path: 'N.md' }) },
      workspace: { getLeaf: () => ({ openFile: async () => { opened++; }, view: {} }) },
    } as any);
    expect(() => jumpToChunk({ path: 'N.md' }, '片段', true)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(opened).toBe(1);
  });

  it('getApp 抛错（app 未注入）→ 吞掉异常安全返回', () => {
    setApp(null as any);
    expect(() => jumpToChunk({ path: 'N.md' }, '片段', true)).not.toThrow();
  });
});

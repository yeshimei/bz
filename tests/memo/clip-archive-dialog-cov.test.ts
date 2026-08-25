/**
 * AI 剪藏批准弹窗覆盖补测：HTML 转义、遮罩/内部点击区分、批准/忽略回调、ESC 关闭。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { showClipConfirmDialog } from '../../src/memo/clip-archive-dialog';
import { resetObsidianMocks } from '../mock-obsidian-entry';

describe('showClipConfirmDialog 剪藏批准弹窗', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function open(itemTitle = '备忘<b>条目', noteName = '新剪藏&笔记') {
    let confirmed = 0;
    showClipConfirmDialog({
      itemTitle,
      itemId: 'id-1',
      noteName,
      onConfirm: () => {
        confirmed++;
      },
    });
    const mask = document.querySelector('div[style*="z-index: 10000"]') as HTMLElement;
    return { mask, isConfirmed: () => confirmed };
  }

  it('渲染标题与命中信息，特殊字符经转义不注入 HTML', () => {
    const { mask } = open('<img src=x onerror=alert(1)>', 'A&B');
    expect(mask).toBeTruthy();
    expect(document.getElementById('clip-ok')).toBeTruthy();
    expect(document.getElementById('clip-cancel')).toBeTruthy();
    // 转义后以文本呈现而非真实元素/标签
    const html = mask.innerHTML;
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('A&amp;B');
    expect(mask.querySelector('img[src="x"]')).toBeNull();
  });

  it('点弹窗内部（非遮罩）→ 不关闭、不触发回调；点遮罩 → 关闭且不触发批准', () => {
    const { mask, isConfirmed } = open();
    const h3 = mask.querySelector('h3') as HTMLElement;
    h3.click(); // 内部点击
    expect(mask.isConnected).toBe(true);
    expect(isConfirmed()).toBe(0);
    // 点遮罩本体（e.target === mask）
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mask.isConnected).toBe(false);
    expect(isConfirmed()).toBe(0); // 遮罩关闭不算批准
  });

  it('点「忽略」→ 只关窗不批准；点「批准」→ 回调恰一次并关窗', () => {
    const first = open();
    (document.getElementById('clip-cancel') as HTMLElement).click();
    expect(first.mask.isConnected).toBe(false);
    expect(first.isConfirmed()).toBe(0);

    const second = open();
    (document.getElementById('clip-ok') as HTMLElement).click();
    expect(second.isConfirmed()).toBe(1);
    expect(second.mask.isConnected).toBe(false);
  });

  it('ESC 经 escManager 层级关闭弹窗（aia 层）', () => {
    const { mask } = open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(mask.isConnected).toBe(false);
  });
});

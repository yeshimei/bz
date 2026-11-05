/**
 * 日记本设置页「存储」组（jsdom）：
 *
 * 1. 切换格式确认框以**目标样例文件名**为视觉中心，正文只留三句（目标 / 已有 / 转换后果）——
 *    2026-11-05 用户报「排版没有视觉中心、描述太长」：旧版四段居中长文，样例文件名被折断。
 * 2. 转换进度条**只在转换期间存在于 DOM**：开始插入、结束移除。
 *    2026-11-05 用户报「切换完成后下面的正在转换还是没消失」——旧实现用 `hidden`，
 *    而 `.bz-diary-fmt-progress{display:flex}` 压过 `[hidden]` 的 UA 规则，转换完照旧留在页面上。
 *    jsdom 不加载插件 CSS，所以这里断言的是结构契约（不在 DOM 里），不是 computedStyle。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { applyDirectories } from '../../src/diary/config';
import { mountDiaryFormatEditor } from '../../src/diary/settings-format';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices } from '../mock-obsidian-entry';

const conv = vi.hoisted(() => {
  interface Call {
    target: string;
    onProgress?: (p: { done: number; total: number; current?: string }) => void;
  }
  const state: {
    calls: Call[];
    settle: ((r: unknown) => void) | null;
    fail: ((e: unknown) => void) | null;
  } = { calls: [], settle: null, fail: null };
  return {
    state,
    fn: vi.fn((target: string, onProgress?: Call['onProgress']) => {
      state.calls.push({ target, onProgress });
      return new Promise((resolve, reject) => {
        state.settle = resolve;
        state.fail = reject;
      });
    }),
    reset(): void {
      state.calls.length = 0;
      state.settle = null;
      state.fail = null;
    },
  };
});

vi.mock('../../src/diary/convert', () => ({ convertDiaryFormat: conv.fn }));

let vault: MockVault;
let body: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  conv.reset();
  conv.fn.mockClear();
  applyDirectories({});
  vault = new MockVault();
  // 一篇新格式日记：确认框里的「已有 N 个文件」要数到它
  vault.files.set('我的/日记/2606131223.md', '---\ndate: 2026-06-13 12:23\ntype:\n  - 随笔\n---\n\n正文');
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, diaryEntryFormat: 'entry' }) as never);
  body = document.createElement('div');
  document.body.appendChild(body);
  mountDiaryFormatEditor(body);
});

afterEach(() => {
  document.body.innerHTML = '';
});

function openSwitchDialog(): HTMLElement {
  (body.querySelector('[data-fmt="day"]') as HTMLElement).click();
  const popup = document.getElementById('__shared_confirm_popup__');
  if (!popup) throw new Error('切换确认框没有打开');
  return popup;
}

describe('切换格式确认框：样例外置成视觉中心 + 文案收敛', () => {
  beforeEach(() => {
    // 已有分类用法统计的后台扫描与本文件无关，清掉避免跨用例噪声
    clearNotices();
  });

  it('标题指向目标格式', () => {
    const popup = openSwitchDialog();
    expect(popup.querySelector('h4')?.textContent).toBe('切换到「一天一个文件」？');
  });

  it('样例块是独立视觉单元，文件名完整不折断', () => {
    const popup = openSwitchDialog();
    const sample = popup.querySelector('.bz-diary-fmt-dialog-sample');
    expect(sample).toBeTruthy();
    expect(sample?.querySelector('.bz-diary-fmt-dialog-file')?.textContent).toBe('2026-06-13.md');
    // 块里先给「之后新写的存成」这层引导，再接样例
    expect(sample?.querySelector('.bz-diary-fmt-dialog-cap')?.textContent).toContain('之后新写的');
  });

  it('正文只留三句：不再复述当前格式与分段规则', () => {
    const popup = openSwitchDialog();
    const text = popup.querySelector('.bz-diary-fmt-dialog-body')?.textContent || '';
    expect(text).not.toContain('现在按');
    expect(text).not.toContain('每篇用');
    expect(text).toContain('已有 1 个文件');
    expect(text).toContain('回收站');
  });

  it('没有已有日记时说明「还没有已存的日记文件」，不说「已有 0 个」', () => {
    vault.files.clear();
    const popup = openSwitchDialog();
    const text = popup.querySelector('.bz-diary-fmt-dialog-body')?.textContent || '';
    expect(text).toContain('还没有');
    expect(text).not.toContain('已有 0 个');
  });
});

describe('转换进度条的生命周期', () => {
  it('未开始转换时 DOM 里没有进度条（不是 hidden）', () => {
    expect(body.querySelector('.bz-diary-fmt-progress')).toBeNull();
  });

  it('转换中显示真实进度，结束即从 DOM 移除', async () => {
    const popup = openSwitchDialog();
    (document.getElementById('bz-flow-dialog-action-2') as HTMLButtonElement).click();

    await vi.waitFor(() => expect(body.querySelector('.bz-diary-fmt-progress')).toBeTruthy());
    conv.state.calls[0]?.onProgress?.({ done: 1, total: 2, current: '我的/日记/2606131223.md' });
    expect(body.querySelector('[data-role="pct"]')?.textContent).toBe('50%');

    conv.state.settle?.({ target: 'day', converted: 1, skipped: [], errors: [] });
    await vi.waitFor(() => expect(body.querySelector('.bz-diary-fmt-progress')).toBeNull());
    // 转换完两张卡恢复可点（busy 解除），别再卡在禁用态
    expect((body.querySelector('[data-fmt="day"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('转换抛错也收掉进度条', async () => {
    const popup = openSwitchDialog();
    (document.getElementById('bz-flow-dialog-action-2') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(body.querySelector('.bz-diary-fmt-progress')).toBeTruthy());

    conv.state.fail?.(new Error('写盘失败'));
    await vi.waitFor(() => expect(body.querySelector('.bz-diary-fmt-progress')).toBeNull());
  });
});

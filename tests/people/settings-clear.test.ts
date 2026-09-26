// @vitest-environment jsdom
/**
 * 「清空聊天数据」二次确认（issue 486 实案热修）：设置行 onClick 直连 clearStores 曾导致
 * 误点即清空全部联系人聊天仓。现在 onClick 先弹 openFlowDialog 确认——取消不动，确认才执行。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { peopleSettingsSchema } from '../../src/people/settings';
import type { SettingsSchema } from '../../src/core/settings-schema';

function clearRowOf(schema: SettingsSchema): { onClick: () => void } {
  const row = schema.groups
    .flatMap((g) => g.rows as unknown as Array<{ name?: string } & Record<string, unknown>>)
    .find((r) => r.name === '清空聊天数据');
  expect(row).toBeTruthy();
  return row as unknown as { onClick: () => void };
}

function buttonInDialog(text: string): HTMLButtonElement {
  const dialog = document.querySelector('.bz-flow-dialog');
  expect(dialog).not.toBeNull();
  const btn = [...(dialog as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  expect(btn).toBeTruthy();
  return btn as HTMLButtonElement;
}

describe('「清空聊天数据」二次确认（issue 486）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('onClick 先出确认弹窗且不立即执行；取消不动清空回调', async () => {
    const onClearStore = vi.fn();
    const row = clearRowOf(peopleSettingsSchema({ onClearStore }));
    row.onClick();
    await vi.waitFor(() => expect(document.querySelector('.bz-flow-dialog')).not.toBeNull());
    expect(onClearStore).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-flow-dialog')!.textContent).toContain('不可恢复');
    buttonInDialog('取消').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-flow-dialog')).toBeNull());
    expect(onClearStore).not.toHaveBeenCalled();
  });

  it('确认后执行清空回调（恰好一次）', async () => {
    const onClearStore = vi.fn();
    const row = clearRowOf(peopleSettingsSchema({ onClearStore }));
    row.onClick();
    await vi.waitFor(() => expect(document.querySelector('.bz-flow-dialog')).not.toBeNull());
    buttonInDialog('清空').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(onClearStore).toHaveBeenCalledOnce());
  });
});

/**
 * 写链路弹窗回归（ADR-0115 迁入后契约，jsdom）：
 * - saveNewEntry：校验（未选类型/时间格式非法）与成功写盘 + 关弹窗；
 * - 标签选择器保存：写层未命中告警不盲写；同刻唯一兜底定位成功改盘。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { createAddDialog, createTagPicker, openAddDialog, saveNewEntry, showTagPicker } from '../../src/diary/ui/dialogs';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';

let vault: MockVault;

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetTagsConfig();
  applyDirectories({});
  vi.restoreAllMocks();
  vault = new MockVault();
  setApp(mockAppWithVault(vault));
});

function openWriteDialog(datetime = '2024-01-01 10:30'): void {
  createAddDialog();
  openAddDialog();
  (document.querySelector('#add-diary-datetime') as HTMLInputElement).value = datetime;
}

function pickType(label: string): void {
  const btn = [...document.querySelectorAll<HTMLButtonElement>('#add-diary-type-container .diary-tag-selector-btn')].find(
    (b) => b.dataset.tag === label
  );
  btn!.click();
}

describe('saveNewEntry（写日记弹窗）', () => {
  it('未选类型：提示并不落盘', async () => {
    openWriteDialog();
    await saveNewEntry();
    expect(getNoticeMessages().join('\n')).toContain('请至少选择一个类型');
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(false);
  });

  it('时间格式非法：提示并不落盘', async () => {
    openWriteDialog('不是时间');
    pickType('日记');
    await saveNewEntry();
    expect(getNoticeMessages().join('\n')).toContain('日期时间格式不正确');
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(false);
  });

  it('成功：emoji 序列标题落盘 + 弹窗关闭（面板刷新走域事件，此处不插卡）', async () => {
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    await saveNewEntry();
    const disk = vault.files.get('我的/日记/2024-01-01.md')!;
    expect(disk).toContain('# 📖 10:30');
    expect((document.querySelector('#add-diary-popup') as HTMLElement).style.display).toBe('none');
    expect(getNoticeMessages().join('\n')).toContain('已保存日记');
  });
});

describe('showTagPicker（标签选择器，locator 定位）', () => {
  it('写层未命中：告警「未能在日记数据中定位」且不改盘', async () => {
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\nA\n');
    createTagPicker();
    showTagPicker({ filename: '2024-01-01', date: '2024-01-01', time: '23:59', lineNumber: 99, tags: ['日记'] });
    const popup = document.querySelector('#diary-tag-selector-popup') as HTMLElement;
    const save = [...popup.querySelectorAll<HTMLButtonElement>('.diary-tag-selector-actions button')].find((b) => b.textContent === '保存')!;
    const diaryBtn = popup.querySelector<HTMLButtonElement>('.diary-tag-selector-btn[data-tag="日记"]')!;
    const rideBtn = popup.querySelector<HTMLButtonElement>('.diary-tag-selector-btn[data-tag="骑行"]')!;
    expect(diaryBtn.classList.contains('diary-active')).toBe(true); // 当前标签已选中
    diaryBtn.classList.remove('diary-active');
    rideBtn.click();
    save.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(getNoticeMessages().join('\n')).toContain('未能在日记数据中定位该条目');
    expect(vault.files.get('我的/日记/2024-01-01.md')).toContain('# 📖 08:00');
  });

  it('同刻唯一兜底：行号失配仍按唯一时间命中改盘并发 tags-changed', async () => {
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\nA\n');
    createTagPicker();
    showTagPicker({ filename: '2024-01-01', date: '2024-01-01', time: '08:00', lineNumber: 99, tags: ['日记'] });
    const popup = document.querySelector('#diary-tag-selector-popup') as HTMLElement;
    const save = [...popup.querySelectorAll<HTMLButtonElement>('.diary-tag-selector-actions button')].find((b) => b.textContent === '保存')!;
    // 选择器语义：保存时提交全部选中标签——原「日记」保持选中，追加「骑行」
    popup.querySelector<HTMLButtonElement>('.diary-tag-selector-btn[data-tag="骑行"]')!.click();
    save.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(vault.files.get('我的/日记/2024-01-01.md')).toContain('# 📖🚴 08:00');
    expect(getNoticeMessages().join('\n')).not.toContain('未能在日记数据中定位');
  });

  it('删除按钮：locator 传给 showConfirm 并收起选择器', async () => {
    vi.mock('../../src/diary/ui/entry-actions', () => ({ showConfirm: vi.fn() }));
    const { showConfirm } = await import('../../src/diary/ui/entry-actions');
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\nA\n');
    createTagPicker();
    showTagPicker({ filename: '2024-01-01', date: '2024-01-01', time: '08:00', lineNumber: 1, tags: ['日记'] });
    const popup = document.querySelector('#diary-tag-selector-popup') as HTMLElement;
    const del = [...popup.querySelectorAll<HTMLButtonElement>('.diary-tag-selector-actions button')].find((b) => b.textContent === '删除')!;
    del.click();
    expect((document.querySelector('#diary-tag-selector-popup') as HTMLElement).style.display).toBe('none');
    expect(showConfirm).toHaveBeenCalledTimes(1);
    expect((showConfirm as any).mock.calls[0][0]).toMatchObject({ filename: '2024-01-01', time: '08:00', lineNumber: 1 });
  });
});

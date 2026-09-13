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

describe('saveNewEntry（写日记弹窗，ADR-0130 建条目文件）', () => {
  it('未选类型：提示并不落盘', async () => {
    openWriteDialog();
    await saveNewEntry();
    expect(getNoticeMessages().join('\n')).toContain('请至少选择一个类型');
    expect(vault.files.has('我的/日记/2024-01-01 10-30.md')).toBe(false);
  });

  it('时间格式非法：提示并不落盘', async () => {
    openWriteDialog('不是时间');
    pickType('日记');
    await saveNewEntry();
    expect(getNoticeMessages().join('\n')).toContain('日期时间格式不正确');
    expect(vault.files.has('我的/日记/2024-01-01 10-30.md')).toBe(false);
  });

  it('成功：条目文件落盘（frontmatter 日期+类型）+ 弹窗关闭，不再弹成功通知（收紧通知）', async () => {
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    await saveNewEntry();
    const disk = vault.files.get('我的/日记/2024-01-01 10-30.md')!;
    expect(disk).toContain('日期: 2024-01-01 10:30');
    expect(disk).toContain('  - 日记');
    expect((document.querySelector('#add-diary-popup') as HTMLElement).style.display).toBe('none');
    // 操作结果立即可见（弹窗关、墙已刷新）→ 不弹「已保存日记」
    expect(getNoticeMessages().join('\n')).not.toContain('已保存日记');
  });

  it('D7 回归：写盘进行中重复触发保存只写一篇（防连点，不同刻重复空条目文件）', async () => {
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    // 拖慢写层建文件，模拟大文件写盘慢的窗口
    const realCreate = vault.create.bind(vault);
    vi.spyOn(vault, 'create').mockImplementation(async (path: string, content: string) => {
      await new Promise((r) => setTimeout(r, 60));
      return realCreate(path, content);
    });
    const first = saveNewEntry();
    const second = saveNewEntry(); // 第一笔仍在写盘：直接忽略
    await Promise.all([first, second]);
    expect(vault.files.has('我的/日记/2024-01-01 10-30.md')).toBe(true);
    expect(vault.files.has('我的/日记/2024-01-01 10-30-2.md')).toBe(false); // 同刻只有一篇
  });

  it('D7 回归：写盘失败（建文件抛错）后防连点标志释放，下一笔可正常保存', async () => {
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    vi.spyOn(vault, 'create').mockRejectedValueOnce(new Error('磁盘已满'));
    await saveNewEntry(); // 建文件失败：抛错路径（finally 释放标志）
    expect(getNoticeMessages().join('\n')).toContain('保存日记失败');
    // 下一笔保存不被进行中标志拦截，正常落盘
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    await saveNewEntry();
    expect(vault.files.get('我的/日记/2024-01-01 10-30.md')).toContain('日期: 2024-01-01 10:30');
  });
});

describe('showTagPicker（标签选择器，locator 定位）', () => {
  it('写层未命中：告警「未能在日记数据中定位」且不改盘', async () => {
    vault.files.set(
      '我的/日记/2024-01-01 08-00.md',
      '---\n日期: 2024-01-01 08:00\n类型:\n  - 日记\n---\n\nA\n'
    );
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
    expect(vault.files.get('我的/日记/2024-01-01 08-00.md')).toContain('  - 日记');
  });

  it('命中条目文件：改盘（frontmatter 类型追加）并发 tags-changed', async () => {
    vault.files.set(
      '我的/日记/2024-01-01 08-00.md',
      '---\n日期: 2024-01-01 08:00\n类型:\n  - 日记\n---\n\nA\n'
    );
    createTagPicker();
    showTagPicker({ filename: '我的/日记/2024-01-01 08-00.md', date: '2024-01-01', time: '08:00', lineNumber: 0, tags: ['日记'] });
    const popup = document.querySelector('#diary-tag-selector-popup') as HTMLElement;
    const save = [...popup.querySelectorAll<HTMLButtonElement>('.diary-tag-selector-actions button')].find((b) => b.textContent === '保存')!;
    // 选择器语义：保存时提交全部选中标签——原「日记」保持选中，追加「骑行」
    popup.querySelector<HTMLButtonElement>('.diary-tag-selector-btn[data-tag="骑行"]')!.click();
    save.click();
    await new Promise((r) => setTimeout(r, 50));
    const disk = vault.files.get('我的/日记/2024-01-01 08-00.md')!;
    expect(disk).toContain('  - 日记');
    expect(disk).toContain('  - 骑行');
    expect(getNoticeMessages().join('\n')).not.toContain('未能在日记数据中定位');
  });

  it('删除按钮：locator 传给 showConfirm 并收起选择器', async () => {
    vi.mock('../../src/diary/ui/entry-actions', () => ({ showConfirm: vi.fn() }));
    const { showConfirm } = await import('../../src/diary/ui/entry-actions');
    vault.files.set(
      '我的/日记/2024-01-01 08-00.md',
      '---\n日期: 2024-01-01 08:00\n类型:\n  - 日记\n---\n\nA\n'
    );
    createTagPicker();
    showTagPicker({
      filename: '我的/日记/2024-01-01 08-00.md',
      filePath: '我的/日记/2024-01-01 08-00.md',
      date: '2024-01-01',
      time: '08:00',
      lineNumber: 0,
      tags: ['日记'],
    });
    const popup = document.querySelector('#diary-tag-selector-popup') as HTMLElement;
    const del = [...popup.querySelectorAll<HTMLButtonElement>('.diary-tag-selector-actions button')].find((b) => b.textContent === '删除')!;
    del.click();
    expect((document.querySelector('#diary-tag-selector-popup') as HTMLElement).style.display).toBe('none');
    expect(showConfirm).toHaveBeenCalledTimes(1);
    expect((showConfirm as any).mock.calls[0][0]).toMatchObject({
      filePath: '我的/日记/2024-01-01 08-00.md',
      time: '08:00',
    });
  });
});

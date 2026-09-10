/**
 * 删除确认回归（P3 审查修复延续，ADR-0115 locator 化）：entry-actions showConfirm。
 * - 删除失败：弹「删除日记失败」错误通知（不再是静默 unhandled rejection）；
 * - 取消：不触发删除；
 * - 加密条目：走保险箱密文销毁分支并发 diary:encrypted-purged；
 * - 普通条目：写层守卫拒删时静默（人话通知已由写层发出）。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import { showConfirm } from '../../src/diary/ui/entry-actions';
import { removeDiaryEntries } from '../../src/diary/store';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';

const mocks = vi.hoisted(() => ({
  deleteEncryptedEntry: vi.fn(async () => {}),
  emitDomainEvent: vi.fn(),
}));
vi.mock('../../src/diary/encrypt', () => ({
  deleteEncryptedEntry: mocks.deleteEncryptedEntry,
}));
vi.mock('../../src/core/domain-bus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/domain-bus')>();
  return { ...actual, emitDomainEvent: mocks.emitDomainEvent };
});

const LOC = { filename: '2024-01-01', date: '2024-01-01', time: '08:00', lineNumber: 1, tags: ['日记'] };

let vault: MockVault;

/** 点确认弹窗的「删除日记」钮（core flow-dialog 标准双动作） */
async function confirmOk(): Promise<void> {
  await vi.waitFor(() => {
    const b = document.querySelector('#__shared_confirm_ok__') as HTMLButtonElement | null;
    if (!b) throw new Error('确认框未开');
    b.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 30));
}

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  applyDirectories({});
  mocks.deleteEncryptedEntry.mockClear();
  mocks.emitDomainEvent.mockClear();
  vault = new MockVault();
  setApp(mockAppWithVault(vault));
});

describe('showConfirm 删除确认（locator 定位）', () => {
  it('删除失败（写层抛错）：弹「删除日记失败」错误通知', async () => {
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\nA\n');
    // 写层故障注入：vault.delete 抛错（删到空触发整文件删除分支）
    (vault as any).delete = async () => {
      throw new Error('disk error');
    };
    showConfirm(LOC);
    await confirmOk();
    expect(getNoticeMessages().join('\n')).toContain('删除日记失败');
    expect(getNoticeMessages().join('\n')).toContain('disk error');
  });

  it('取消：不触发删除，文件原样', async () => {
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\nA\n');
    showConfirm(LOC);
    await vi.waitFor(() => {
      const b = document.querySelector('#__shared_confirm_cancel__') as HTMLButtonElement | null;
      if (!b) throw new Error('确认框未开');
      b.click();
      return true;
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(true);
    expect(mocks.emitDomainEvent).not.toHaveBeenCalled();
  });

  it('加密条目：确认后销毁密文并发 diary:encrypted-purged', async () => {
    showConfirm({ ...LOC, encrypted: true, noteId: 'enc-1' });
    await confirmOk();
    expect(mocks.deleteEncryptedEntry).toHaveBeenCalledWith('enc-1');
    expect(mocks.emitDomainEvent).toHaveBeenCalledWith('diary:encrypted-purged', { noteId: 'enc-1' });
  });

  it('普通条目：守卫拒删（UnparsedLineError）静默——通知已由写层发出', async () => {
    const { UnparsedLineError } = await import('../../src/diary/store');
    const spy = vi
      .spyOn(await import('../../src/diary/store'), 'removeDiaryEntries')
      .mockRejectedValueOnce(new UnparsedLineError('2024-01-01', 2));
    showConfirm(LOC);
    await confirmOk();
    spy.mockRestore();
    expect(getNoticeMessages().join('\n')).not.toContain('删除日记失败');
    expect(mocks.emitDomainEvent).not.toHaveBeenCalled();
    void removeDiaryEntries;
  });
});

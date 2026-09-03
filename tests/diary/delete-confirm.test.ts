/**
 * 删除确认失败提示回归（P3 审查修复）：showConfirm 的 .then 补 .catch，
 * deleteEntry 抛错时弹人话错误通知，不再是 unhandled rejection 无提示。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { setDiaryDataMap, state } from '../../src/diary/state';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';

const mocks = vi.hoisted(() => ({
  dialog: vi.fn(async () => 'ok'),
  deleteEntry: vi.fn(async () => {}),
}));
// 确认弹窗直接返回「确定」；删除动作可编程拒绝
vi.mock('../../src/core/flow-dialog', () => ({
  openFlowDialog: mocks.dialog,
}));
vi.mock('../../src/diary/store', () => ({
  deleteEntry: mocks.deleteEntry,
  refreshFile: vi.fn(async () => {}),
  reloadWithEncrypted: vi.fn(async () => {}),
  loadAll: vi.fn(async () => {}),
}));
vi.mock('../../src/diary/ui/dialogs', () => ({
  showTagPicker: vi.fn(),
}));
vi.mock('../../src/encrypt', () => ({
  ensureSafeUnlocked: vi.fn(async () => true),
  getSafeManager: () => ({ manifest: { notes: [] } }),
}));
vi.mock('../../src/encrypt/ui', () => ({
  collectNoteAttachmentPaths: () => [],
}));
vi.mock('../../src/diary/encrypt', () => ({
  ENCRYPT_TAG: '加密',
  deleteEncryptedEntry: vi.fn(async () => {}),
  encryptEntry: vi.fn(async () => null),
  isUnlocked: () => false,
  reclassifyEntry: vi.fn(async () => true),
}));

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetTagsConfig();
  applyDirectories({});
  setDiaryDataMap(new Map());
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  for (const fn of Object.values(mocks)) fn.mockClear();
  mocks.dialog.mockResolvedValue('ok');
  setApp({ vault: {}, metadataCache: { getFileCache: () => null }, workspace: {} } as any);
});

describe('删除确认失败提示（P3 审查修复）', () => {
  it('deleteEntry 抛错：弹「删除日记失败」错误通知（不再静默 unhandled rejection）', async () => {
    const { showConfirm } = await import('../../src/diary/ui/entries');
    state.data.originalDiaryEntries = [
      { date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '📖', content: 'x', filename: '2024-01-01', lineNumber: 1, id: 'e1' },
    ];
    mocks.deleteEntry.mockRejectedValueOnce(new Error('磁盘写入失败'));
    showConfirm('e1');
    await vi.waitFor(() => {
      if (!getNoticeMessages().some((m) => m.includes('删除日记失败'))) throw new Error('notice not shown yet');
    });
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('删除日记失败');
    expect(msgs).toContain('磁盘写入失败');
    // 通知正文不带 emoji（类型图标由通知系统自绘）
    expect(msgs).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('取消：不触发删除', async () => {
    const { showConfirm } = await import('../../src/diary/ui/entries');
    state.data.originalDiaryEntries = [
      { date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '📖', content: 'x', filename: '2024-01-01', lineNumber: 1, id: 'e2' },
    ];
    mocks.dialog.mockResolvedValueOnce('cancel');
    showConfirm('e2');
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    expect(getNoticeMessages().join('\n')).not.toContain('已删除');
  });
});

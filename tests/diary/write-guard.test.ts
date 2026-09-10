/**
 * 写前守卫通知（P0 审查修复回归，jsdom）：
 * - 写/删命中「磁盘未解析行」时弹 warning 人话通知（点明日期、行数与修复入口）；
 * - 干净文件操作不弹守卫通知。
 * 磁盘状态断言在 store.test.ts（node 环境）。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { addEntry, removeDiaryEntries, setDiaryDataMap } from '../../src/diary/store';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';

let vault: MockVault;

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetTagsConfig();
  applyDirectories({});
  setDiaryDataMap(null);
  vi.restoreAllMocks();
  vault = new MockVault();
  setApp(mockAppWithVault(vault));
});

describe('写层守卫人话通知', () => {
  it('拒写时弹 warning：点明日期、行数与「检测日记解析」入口，正文不带 emoji', async () => {
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条\n\n# 游记标题\n这段会丢\n');
    await addEntry('2024-01-01', '10:00', ['日记'], '新').catch(() => {});
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('2024-01-01');
    expect(msgs).toContain('2 行内容无法解析');
    expect(msgs).toContain('检测日记解析');
    expect(msgs).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('拒删同口径：保留原文件通知 + 修复指引', async () => {
    vault.files.set('我的/日记/2024-02-02.md', '# 📖 08:00\n第一条\n\n# 游记标题\n这段会丢\n');
    await removeDiaryEntries('2024-02-02', () => true).catch(() => {});
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('无法解析');
    expect(msgs).toContain('检测日记解析');
    expect(vault.files.has('我的/日记/2024-02-02.md')).toBe(true);
  });

  it('干净文件写与删不弹守卫通知', async () => {
    vault.files.set('我的/日记/2024-01-02.md', '# 📖 08:00\n干净\n');
    await addEntry('2024-01-02', '09:00', ['日记'], '新');
    await removeDiaryEntries('2024-01-02', (e) => e.time === '08:00');
    expect(getNoticeMessages().join('\n')).not.toContain('无法解析');
  });
});

/**
 * 写层守卫通知（ADR-0131 语义，jsdom）：
 * - 操作目标解析不出条目（非条目文件名/日期非法）时弹 warning 人话通知（点明文件与「日记格式体检」入口）；
 * - 读盘失败弹 error 人话通知（D1：直接写会覆盖整篇日记）；
 * - 干净文件操作不弹守卫通知。
 * 磁盘状态断言在 store.test.ts（node 环境）。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { addEntry, removeDiaryEntries, updateDiaryTags, setDiaryDataMap } from '../../src/diary/store';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
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

describe('写层守卫人话通知（条目文件口径）', () => {
  it('目标解析不出条目：弹 warning 点明文件与「日记格式体检」入口，正文不带 emoji', async () => {
    vault.files.set('我的/日记/随手记.md', '没有 frontmatter 的普通笔记');
    await updateDiaryTags('2024-01-01', () => true, ['日记'], { filePath: '我的/日记/随手记.md' });
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('随手记');
    expect(msgs).toContain('无法解析为日记条目');
    expect(msgs).toContain('日记格式体检');
    expect(msgs).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('读盘失败：弹 error 点明「直接写会覆盖整篇日记」', async () => {
    const content = serializeDiaryEntryFile({ date: '2024-02-02', time: '08:00' }, ['日记'], '第一条');
    vault.files.set('我的/日记/2402020800.md', content);
    const realRead = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async (f: any) => {
      if (f.path === '我的/日记/2402020800.md') throw new Error('EBUSY');
      return realRead(f);
    });
    await removeDiaryEntries('2024-02-02', () => true);
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('读取失败');
    expect(msgs).toContain('覆盖整篇日记');
    expect(vault.files.has('我的/日记/2402020800.md')).toBe(true); // 文件原样保留
  });

  it('干净文件写与删不弹守卫通知', async () => {
    vault.files.set(
      '我的/日记/2401020800.md',
      serializeDiaryEntryFile({ date: '2024-01-02', time: '08:00' }, ['日记'], '干净')
    );
    await addEntry('2024-01-02', '09:00', ['日记'], '新');
    await removeDiaryEntries('2024-01-02', (e) => e.time === '08:00');
    expect(getNoticeMessages().join('\n')).not.toContain('无法解析');
  });
});

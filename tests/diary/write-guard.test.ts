/**
 * 写前守卫与未解析行警告（P0 审查修复）——jsdom 环境断言人话通知。
 * - writeFile 拒写时以 warning 通知引导「检测日记解析」；
 * - loadAll / refreshFile 的 onUnparsed 接上警告入口（UX-9）。
 * 磁盘状态断言在 tests/diary/store.test.ts（node 环境）。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { loadAll, refreshFile, writeFile } from '../../src/diary/store';
import { setDiaryDataMap, state } from '../../src/diary/state';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';

let vault: MockVault;

function makeVault(files: Record<string, string>) {
  vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  setApp(mockAppWithVault(vault));
  return vault;
}

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetTagsConfig();
  applyDirectories({});
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.events.isInternalUpdate = false;
  setDiaryDataMap(null);
  vi.restoreAllMocks();
});

describe('writeFile 写前守卫通知（P0 审查修复）', () => {
  it('拒写时弹 warning 通知：点明日期、行数与修复入口，正文不带 emoji', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\n第一条\n\n# 游记标题\n这段会丢\n' });
    await loadAll();
    clearNotices();
    const { writeFile } = await import('../../src/diary/store');
    await writeFile('2024-01-01');
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('2024-01-01');
    expect(msgs).toContain('2 行内容无法解析');
    expect(msgs).toContain('检测日记解析');
    expect(msgs).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('干净文件写回不弹守卫通知', async () => {
    makeVault({ '我的/日记/2024-01-02.md': '# 📖 08:00\n旧正文\n' });
    await loadAll();
    clearNotices();
    const entries = state.data.originalDiaryEntries;
    expect(entries).toHaveLength(1);
    entries[0].content = '新正文';
    const { writeFile } = await import('../../src/diary/store');
    await writeFile('2024-01-02');
    expect(getNoticeMessages().some((m) => m.includes('无法解析'))).toBe(false);
    expect(vault.files.get('我的/日记/2024-01-02.md')).toContain('新正文');
  });
});

describe('loadAll / refreshFile 未解析行警告（UX-9 接线）', () => {
  it('loadAll 汇总提示存在未解析行的文件数', async () => {
    // 用 spy 断言（绕开通知模块跨用例的 30s dedupe 窗口：前面的用例已触发过同键警告）
    const noticeMod = await import('../../src/core/notice');
    const spy = vi.spyOn(noticeMod, 'notify');
    makeVault({
      '我的/日记/2024-01-01.md': '开头的游离笔记\n\n# 📖 08:00\n正文\n',
      '我的/日记/2024-01-02.md': '# 📖 09:00\n干净\n',
    });
    await loadAll();
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls.find((c) => String(c[0]).includes('个日记文件存在无法解析的行'));
    expect(call).toBeTruthy();
    expect(String(call![0])).toContain('1 个日记文件存在无法解析的行');
    expect(String(call![0])).toContain('检测日记解析');
    expect((call![1] as any)?.type).toBe('warning');
    spy.mockRestore();
  });

  it('refreshFile 外部改动带未解析行时提示该文件', async () => {
    makeVault({ '我的/日记/2024-01-03.md': '# 📖 08:00\n正文\n' });
    await loadAll();
    clearNotices();
    vault.files.set('我的/日记/2024-01-03.md', '# 📖 08:00\n正文\n\n# 游记标题\n外部追加会丢\n');
    await refreshFile('我的/日记/2024-01-03.md');
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('2024-01-03');
    expect(msgs).toContain('无法解析');
  });
});

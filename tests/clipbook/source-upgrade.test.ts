// @vitest-environment node
/**
 * clipbook（issue 329 Bug 4）：保存物化 source 升级名单修复（纯数据链 node 层测试）。
 * 覆盖：存量侧写（只有 marks、无 pendingSource——修复前升级链死路形态）保存物化后
 * upgradeNoteSourceInternal 对 marks.notePath 被调、link = [[剪藏路径|条目标题]]；
 * pendingSource ∪ marks.notePath 并集去重（重复/多路径不重复写、保序）；
 * 物化收尾侧写三段清理。knowledge 动态 import 用 vi.mock 打桩（仿 toolbar.test）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
// node 环境无 DOM：writeClipNote 成功通知（core/notice）mock 掉，物化链语义不受影响；
// 保留原模块其余导出（mock-obsidian-entry 依赖 __resetNoticeForTests）
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notice: vi.fn(),
    notify: vi.fn(() => ({ setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() })),
  };
});
vi.mock('../../src/knowledge', () => ({
  upgradeNoteSourceInternal: vi.fn(async () => true),
}));
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { writeClipNote } from '../../src/clipbook/save';
import { readClipbookData } from '../../src/clipbook/data';

// 契约 API upgradeNoteSourceInternal 由 knowledge 侧实现，本 worktree vi.mock 打桩
// （save.ts materializeTracking 动态 import 按存在调用——mock 命中同一模块 ID）
const knowledgeMocks: Record<string, any> = await import('../../src/knowledge');

/** 当前 app 的 vault（断言落盘用） */
function getAppVault(): MockVault {
  return getApp().vault as unknown as MockVault;
}

/** 种子存量/内部侧写形态（articleKey = url:…） */
function seedSidecar(key: string, side: { marks?: any[]; pending?: string[] }): void {
  getAppVault().files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({
    articleOverrides: {}, savedArchive: [], order: [],
    marks: side.marks ? { [key]: side.marks } : {},
    savedImages: {},
    pendingSource: side.pending ? { [key]: side.pending } : {},
  }));
}

const RAW = (url: string, title: string, body: string) => ({
  platform: '果壳科学人', title, url, author: '果壳', date: '2026-09-01 08:00:00', body,
});

beforeEach(() => {
  resetObsidianMocks();
  (knowledgeMocks.upgradeNoteSourceInternal as ReturnType<typeof vi.fn>).mockClear();
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
});

describe('保存物化 source 升级名单（issue 329 Bug 4）', () => {
  it('存量形态（只有 marks 无 pendingSource）→ 保存物化后对 marks.notePath 升级，link = [[剪藏路径|标题]]', async () => {
    seedSidecar('url:https://guokr.com/1', {
      marks: [{ find: '量子纠缠', notePath: '文献盒/量子纠缠笔记.md', kind: 'term' }],
    });
    const vault = getAppVault();
    const ok = await writeClipNote(RAW('https://guokr.com/1', '甲文', '正文讲到了量子纠缠。'));
    expect(ok).toBe(true);
    // 修复前升级名单恒空（只认 pendingSource）→ 外链残留死路；现在 marks.notePath 一并救回
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledTimes(1);
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledWith(
      getApp(), '文献盒/量子纠缠笔记.md', '[[归档/网页剪藏/甲文.md|甲文]]',
    );
    // 划词双链照常物化进 md
    expect(vault.files.get('归档/网页剪藏/甲文.md')).toContain('[[量子纠缠笔记|量子纠缠]]');
    // 物化收尾：侧写两段清理
    const sidecar = await readClipbookData();
    expect(sidecar.marks['url:https://guokr.com/1']).toBeUndefined();
    expect(sidecar.pendingSource['url:https://guokr.com/1']).toBeUndefined();
  });

  it('pendingSource 与 marks 同路径重复 → 去重只升级一次（不重复写）', async () => {
    seedSidecar('url:https://guokr.com/2', {
      marks: [{ find: '量子纠缠', notePath: '文献盒/Q.md', kind: 'term' }],
      pending: ['文献盒/Q.md'],
    });
    const ok = await writeClipNote(RAW('https://guokr.com/2', '乙文', '讲到量子纠缠。'));
    expect(ok).toBe(true);
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledTimes(1);
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledWith(
      getApp(), '文献盒/Q.md', '[[归档/网页剪藏/乙文.md|乙文]]',
    );
  });

  it('并集多路径保序（pendingSource 在前、marks 补位）：不同路径逐个升级', async () => {
    seedSidecar('url:https://guokr.com/3', {
      marks: [
        { find: '甲词', notePath: '文献盒/A.md', kind: 'term' },
        { find: '乙段', notePath: '文献盒/B.md', kind: 'passage' },
      ],
      pending: ['文献盒/C.md'],
    });
    const ok = await writeClipNote(RAW('https://guokr.com/3', '丙文', '甲词与乙段。'));
    expect(ok).toBe(true);
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledTimes(3);
    const calls = (knowledgeMocks.upgradeNoteSourceInternal as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c: any[]) => c[1])).toEqual(['文献盒/C.md', '文献盒/A.md', '文献盒/B.md']);
    for (const c of calls) expect(c[2]).toBe('[[归档/网页剪藏/丙文.md|丙文]]');
  });
});

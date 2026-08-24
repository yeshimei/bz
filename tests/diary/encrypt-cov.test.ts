/**
 * 覆盖率补测：diary/encrypt 加密编排层。
 * 重点：未初始化降级、未解锁抛错、附件收集（缺失/读取失败跳过、视频类型）、
 * loadEncryptedEntries 防御分支（非日记类/损坏明文/解密失败/null）、
 * emoji 兜底去重、deleteEncryptedEntry 守卫、上锁通知、reclassifyEntry 分支。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp as setCoreApp } from '../../src/core/app';
import { setApp as setDiaryApp } from '../../src/diary/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { state, setDiaryDataMap } from '../../src/diary/state';
import {
  ENCRYPT_TAG,
  isUnlocked,
  onUnlockChange,
  lockSafe,
  encryptEntry,
  loadEncryptedEntries,
  deleteEncryptedEntry,
  reclassifyEntry,
} from '../../src/diary/encrypt';
import { getSafeManager, unloadEncrypt } from '../../src/encrypt';
import { EncryptAppController } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';

let vault: MockVault;

beforeEach(async () => {
  document.body.innerHTML = '';
  clearNotices();
  resetObsidianMocks();
  resetTagsConfig();
  applyDirectories({});
  unloadEncrypt();
  EncryptAppController.instance = null;
  setSettingsProvider(() => ({
    encryptRoot: 'CONFIG/.ENCRYPT',
    encryptPreviewEnabled: false,
    encryptSecurityMode: false,
  }) as any);
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.data.isLoadingData = false;
  state.events.isInternalUpdate = false;
  state.events.fileListenerAttached = false;
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  setDiaryDataMap(null);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  const app = mockAppWithVault(vault);
  setCoreApp(app as any);
  setDiaryApp(app as any);
});

afterEach(() => {
  unloadEncrypt();
  EncryptAppController.instance = null;
  document.body.innerHTML = '';
});

async function waitFor(cond: () => boolean, timeout = 8000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** 直连解锁保险箱 */
async function unlockSafe() {
  const sm = getSafeManager();
  await sm.unlock('pw');
  expect(isUnlocked()).toBe(true);
  return sm;
}

/** 一条普通条目（入库用） */
function plainEntry(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'p1', date: '2024-01-01', time: '08:00', timeValue: 800,
    tags: ['日记'], emoji: '📖', content: '第一条日记', filename: '2024-01-01', lineNumber: 0,
    ...overrides,
  } as any;
}

describe('解锁态与守卫', () => {
  it('isUnlocked：设置提供者缺失/抛错时降级为未解锁（不阻断渲染）', () => {
    setSettingsProvider(() => {
      throw new Error('设置未注入');
    });
    expect(isUnlocked()).toBe(false);
  });

  it('encryptEntry：未解锁直接抛错，不入库', async () => {
    getSafeManager(); // 初始化但保持锁定
    await expect(encryptEntry(plainEntry())).rejects.toThrow('未解锁，无法加密日记');
  });

  it('deleteEncryptedEntry：未解锁抛「未解锁」', async () => {
    getSafeManager();
    await expect(deleteEncryptedEntry('nope')).rejects.toThrow('未解锁');
  });

  it('lockSafe：触发解锁状态监听回调', async () => {
    await unlockSafe();
    const cb = vi.fn();
    onUnlockChange(cb);
    lockSafe();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(isUnlocked()).toBe(false);
  });
});

describe('encryptEntry 附件收集', () => {
  it('缺失附件与读取失败的附件均跳过；图片类型正确', async () => {
    const sm = await unlockSafe();
    vault.binaryFiles.set('a.png', new Uint8Array([1, 2, 3]));
    // v.mp4 存在但读取失败；ghost.png 不存在
    vault.binaryFiles.set('v.mp4', new Uint8Array([4]));
    const app = (await import('../../src/diary/app')).getApp() as any;
    // 仅 v.mp4 读取失败；其余附件（a.png）正常读取。
    // 注意：app.vault 即 vault 本体，必须先捕获原函数再 spyOn，避免递归自调
    const realReadBinary = vault.readBinary.bind(vault);
    vi.spyOn(app.vault, 'readBinary').mockImplementation(async (f: any) => {
      if (f.path === 'v.mp4') throw new Error('二进制损坏');
      return realReadBinary(f);
    });

    const res = await encryptEntry(plainEntry({ content: '图 ![[a.png]] 片 ![[v.mp4]] 缺 ![[ghost.png]]' }));
    expect(res).not.toBeNull();
    expect(res!.encrypted).toBe(true);
    expect(res!.tags).toContain(ENCRYPT_TAG);
    expect(res!.noteId).toBeTruthy();
    const note = sm.manifest.notes[sm.manifest.notes.length - 1];
    expect(res!.noteId).toBe(note.id);
    // 只有 a.png 成功收集（v.mp4 读取失败跳过、ghost.png 不存在跳过）
    expect(note.attachments.map((a: any) => a.path)).toEqual(['a.png']);
    expect(note.attachments[0].kind).toBe('image');
    // 密文元数据落清单：blob 引用非空、大小大于 0（明文不落盘）
    expect((note.attachments[0] as any).blobRef).toBeTruthy();
    expect((note.attachments[0] as any).blobSize).toBeGreaterThan(0);
  });

  it('视频附件 kind=video；base64 数据非空', async () => {
    const sm = await unlockSafe();
    vault.binaryFiles.set('clip.mp4', new Uint8Array([9, 9, 9, 9]));
    const res = await encryptEntry(plainEntry({ content: '看片 ![[clip.mp4]]' }));
    expect(res).not.toBeNull();
    const note = sm.manifest.notes[sm.manifest.notes.length - 1];
    expect(note.attachments).toHaveLength(1);
    expect(note.attachments[0].kind).toBe('video');
    expect((note.attachments[0] as any).blobSize).toBeGreaterThan(0); // 密文已入库
  });
});

describe('loadEncryptedEntries 防御分支', () => {
  it('非日记类/损坏明文/null 明文/解密失败均跳过；恢复后正常解析', async () => {
    const sm = await unlockSafe();
    const res = await encryptEntry(plainEntry());
    expect(res).not.toBeNull();
    const realNote = sm.manifest.notes[sm.manifest.notes.length - 1];
    // 混入三类脏数据
    sm.manifest.notes.push(
      { id: 'f-kind', kind: 'other', path: '我的/日记/x.md', attachments: [] } as any,
      { id: 'f-null', kind: 'diary-entry', path: '我的/日记/y.md', attachments: [] } as any,
      { id: 'f-throw', kind: 'diary-entry', path: '我的/日记/z.md', attachments: [] } as any
    );
    const spy = vi.spyOn(sm, 'getDiaryEntryPlain').mockImplementation(async (id: string) => {
      if (id === realNote.id) return '# 坏标题没有时间\n正文'; // 解析不出 DiaryEntry
      if (id === 'f-null') return null;
      if (id === 'f-throw') throw new Error('解密失败');
      return null;
    });
    expect(await loadEncryptedEntries()).toEqual([]); // 全部被防御分支跳过

    // 还原真实解密：正常解析出加密条目
    spy.mockRestore();
    const list = await loadEncryptedEntries();
    expect(list).toHaveLength(1);
    expect(list[0].encrypted).toBe(true);
    expect(list[0].content).toContain('第一条日记');
    expect(list[0].tags).toContain(ENCRYPT_TAG);
    expect(list[0].id).toBe(`enc-diary-${realNote.id}`);
  });

  it('未知 emoji 序列兜底「日记」标签且按图元去重', async () => {
    const sm = await unlockSafe();
    await encryptEntry(plainEntry());
    const spy = vi.spyOn(sm, 'getDiaryEntryPlain').mockResolvedValue('# 🔵🔵 09:30\n正文');
    let list = await loadEncryptedEntries();
    expect(list).toHaveLength(1);
    expect(list[0].tags).toEqual(['日记']); // 未知 emoji → 兜底，且重复只留一个

    spy.mockResolvedValue('# 📖📖 09:30\n正文');
    list = await loadEncryptedEntries();
    expect(list[0].tags).toEqual(['日记']); // 已知 emoji 重复同样去重
    expect(list[0].emoji).toBe('📖📖'); // 原始序列保留在 emoji 字段
    spy.mockRestore();
  });
});

describe('reclassifyEntry 分支', () => {
  it('newTags 为空 → 原文原样还原并从保险箱取出', async () => {
    const sm = await unlockSafe();
    // 用与现有块不同的时间槽，避免同标题幂等合并跳过写盘
    const res = await encryptEntry(plainEntry({ time: '21:00', timeValue: 2100, content: '要还原的日记' }));
    expect(res).not.toBeNull();
    const ok = await reclassifyEntry(res!.noteId!, []);
    expect(ok).toBe(true);
    await waitFor(() => sm.manifest.notes.length === 0);
    const md = vault.files.get('我的/日记/2024-01-01.md')!;
    expect(md).toContain('要还原的日记');
    // 空标签 = 原样保留：原始 emoji 序列（含 🔐）不动
    expect(md).toContain('# 📖🔐 21:00');
  });

  it('明文异常（无标题行）→ 返回 false 且清单不变', async () => {
    const sm = await unlockSafe();
    const res = await encryptEntry(plainEntry({ tags: ['诗'], emoji: '🌟' }));
    const noteId = res!.noteId!;
    const spy = vi.spyOn(sm, 'getDiaryEntryPlain').mockResolvedValue('完全不是块格式');
    expect(await reclassifyEntry(noteId, ['日记'])).toBe(false);
    expect(sm.manifest.notes.some((n) => n.id === noteId)).toBe(true); // 未取出
    spy.mockRestore();

    // 明文为 null 同样返回 false
    const spy2 = vi.spyOn(sm, 'getDiaryEntryPlain').mockResolvedValue(null);
    expect(await reclassifyEntry(noteId, ['日记'])).toBe(false);
    spy2.mockRestore();
  });

  it('单行明文（无正文）→ 以新标签重建标题行还原', async () => {
    const sm = await unlockSafe();
    const res = await encryptEntry(plainEntry({ tags: ['日记'], content: '' }));
    const noteId = res!.noteId!;
    const spy = vi.spyOn(sm, 'getDiaryEntryPlain').mockResolvedValue('# 📖 23:45');
    const ok = await reclassifyEntry(noteId, ['诗']);
    expect(ok).toBe(true);
    spy.mockRestore();
    await waitFor(() => sm.manifest.notes.length === 0);
    expect(vault.files.get('我的/日记/2024-01-01.md')).toContain('# 🌟 23:45');
  });
});

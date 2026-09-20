// @vitest-environment node
/**
 * memo 回滚残留字段清除测试（2026-09-19 用户拍板字段清除）：
 * 周期重复（issue 353 的 recur）/清单子任务（issue 354 的 checklist）已随回滚废弃且不再恢复，
 * 被回滚代码曾在 memo.json 条目上写下这两键。本批口径：载入即剥、任何保存回写不再产出两键、
 * 只剥键不删条目（周期克隆出的「下一期」条目剥后即普通条目，保留）、其余字段一字不损。
 * 一切以自造 fixture 验证，不读用户真实数据。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoData, normalizeItem, purgeStaleFields } from '../../src/memo/data';
import { MEMO_ITEM_FIELDS } from '../../src/checkup/checks-drift';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureFileSync, unloadFileSync } from '../../src/memo/file-sync';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';

const PATH = 'CONFIG/STORAGE/memo.json';

function makeApp(vault: MockVault) {
  return { vault, workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: () => null } };
}

const BASE_SETTINGS = { memoFilePath: 'CONFIG/STORAGE', cinemaFolderPath: '我的/影视' };

/** 自造 fixture：14 字段完整条目 + 回滚残留两键（形态取回滚前实现：recur 对象 / checklist 数组） */
function staleFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'stale-1',
    title: '周期条目',
    scene: '工作',
    priority: 'important',
    created: '2026-08-01 10:00:00',
    completed: null,
    due: '2026-09-25 18:00:00',
    notePath: '我的/日记/2026-09-03.md',
    notePosition: { line: 12, ch: 3 },
    scriptName: null,
    courseName: null,
    coursePath: null,
    linkedNote: '归档/网页剪藏/文章.md',
    url: 'https://example.com/a',
    recur: { kind: 'weekly', interval: 1 },
    checklist: [{ text: '子任务', done: false }],
    ...overrides,
  };
}

/** 断言条目（任意形态）不含两残留键 */
function expectNoStaleKeys(it: any) {
  expect(it).not.toHaveProperty('recur');
  expect(it).not.toHaveProperty('checklist');
}

describe('载入剥离（loadItems）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
  });

  it('带残留字段的旧数据载入：两键被剥、14 字段逐键无损', async () => {
    MemoData.init(BASE_SETTINGS);
    vault.files.set(PATH, JSON.stringify([staleFixture()], null, 2));
    const items = await MemoData.loadItems();
    expect(items).toHaveLength(1);
    const it = items[0] as any;
    expectNoStaleKeys(it);
    // 逐键断言：其余字段一字不损
    expect(it.id).toBe('stale-1');
    expect(it.title).toBe('周期条目');
    expect(it.scene).toBe('工作');
    expect(it.priority).toBe('important');
    expect(it.created).toBe('2026-08-01 10:00:00');
    expect(it.completed).toBeNull();
    expect(it.due).toBe('2026-09-25 18:00:00');
    expect(it.notePath).toBe('我的/日记/2026-09-03.md');
    expect(it.notePosition).toEqual({ line: 12, ch: 3 });
    expect(it.scriptName).toBeNull();
    expect(it.courseName).toBeNull();
    expect(it.coursePath).toBeNull();
    expect(it.linkedNote).toBe('归档/网页剪藏/文章.md');
    expect(it.url).toBe('https://example.com/a');
    expect([...Object.keys(it)].sort()).toEqual([...MEMO_ITEM_FIELDS].sort());
  });

  it('载入即清档：落盘产物不再含两键；只剥字段不删条目（周期克隆「下一期」条目保留为普通条目）', async () => {
    MemoData.init(BASE_SETTINGS);
    // 第二条模拟周期完成链克隆出的「下一期」条目：剥字段后是普通已完成条目，必须保留
    vault.files.set(
      PATH,
      JSON.stringify([
        staleFixture(),
        staleFixture({
          id: 'stale-next',
          title: '下一期克隆',
          completed: '2026-09-10 09:00:00',
          recur: { kind: 'monthly', anchorDay: 10 },
          checklist: [{ text: '做A', done: true }, { text: '做B', done: false }],
        }),
      ])
    );
    const items = await MemoData.loadItems();
    expect(items).toHaveLength(2); // 不删条目
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw).toHaveLength(2);
    expect(raw.map((i: any) => i.id)).toEqual(['stale-1', 'stale-next']);
    for (const it of raw) expectNoStaleKeys(it);
    // 克隆条目剥后即普通条目：完成态与 14 字段本体无损
    const next = raw.find((i: any) => i.id === 'stale-next');
    expect(next.completed).toBe('2026-09-10 09:00:00');
    expect([...Object.keys(next)].sort()).toEqual([...MEMO_ITEM_FIELDS].sort());
  });

  it('无残留字段数据载入零影响：不写盘、文件字节不变', async () => {
    MemoData.init(BASE_SETTINGS);
    const cleanItem: Record<string, any> = staleFixture();
    delete cleanItem.recur;
    delete cleanItem.checklist;
    const cleanContent = JSON.stringify([cleanItem], null, 2);
    vault.files.set(PATH, cleanContent);
    const items = await MemoData.loadItems();
    expect(items).toHaveLength(1);
    expect(vault.files.get(PATH)).toBe(cleanContent); // 字节不变
    expect(vault.modifiedPaths).not.toContain(PATH); // 零写入
  });

  it('缺 id + 残留并存：回写补 id 且消毒（原缺 id 回写路径不被残留拖脏）', async () => {
    MemoData.init(BASE_SETTINGS);
    const { id: _drop, ...noId } = staleFixture();
    vault.files.set(PATH, JSON.stringify([noId]));
    const items = await MemoData.loadItems();
    expect(items[0].id).toBeTruthy();
    expectNoStaleKeys(items[0]);
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].id).toBeTruthy();
    expectNoStaleKeys(raw[0]);
  });
});

describe('保存回写消毒（写盘路径不得再产出两键）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault) as any);
    MemoData.init(BASE_SETTINGS);
  });

  it('addItem 直写带残留的存量文件（未经 loadItems）：回写产物全局无两键', async () => {
    vault.files.set(PATH, JSON.stringify([staleFixture()]));
    await MemoData.addItem({ id: 'new-1', title: '新条目', scene: '生活' } as any);
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw.map((i: any) => i.id)).toEqual(['new-1', 'stale-1']);
    for (const it of raw) expectNoStaleKeys(it);
    expect(raw[1].due).toBe('2026-09-25 18:00:00'); // 旧条目其余字段无损
  });

  it('updateItem 合并回写同样不产出两键', async () => {
    vault.files.set(PATH, JSON.stringify([staleFixture()]));
    await MemoData.updateItem('stale-1', { title: '改题' } as any);
    const raw = JSON.parse(vault.files.get(PATH)!);
    expectNoStaleKeys(raw[0]);
    expect(raw[0].title).toBe('改题');
    expect(raw[0].due).toBe('2026-09-25 18:00:00');
    expect(raw[0].notePosition).toEqual({ line: 12, ch: 3 });
  });

  it('purgeStaleFields 单元：无残留数组同引用透传（避免无谓拷贝）、非数组透传', () => {
    const clean = [staleFixture({ id: 'a' })];
    delete (clean[0] as any).recur;
    delete (clean[0] as any).checklist;
    expect(purgeStaleFields(clean)).toBe(clean); // 同引用：零影响路径零开销
    expect(purgeStaleFields(null as any)).toBeNull();
    expect(purgeStaleFields({ recur: 1 } as any)).toEqual({ recur: 1 }); // 非数组不碰
    const out = purgeStaleFields([staleFixture()]) as any[];
    expect(out[0]).not.toHaveProperty('recur');
    expect(out[0]).not.toHaveProperty('checklist');
  });

  it('normalizeItem 白名单产物即 14 字段契约（MEMO_ITEM_FIELDS），不含残留键——checkup 契约口径本地再锁', () => {
    const out = normalizeItem(staleFixture()) as unknown as Record<string, unknown>;
    expect([...Object.keys(out)].sort()).toEqual([...MEMO_ITEM_FIELDS].sort());
    expectNoStaleKeys(out);
    expect(MEMO_ITEM_FIELDS).toHaveLength(14);
    expect(MEMO_ITEM_FIELDS).not.toContain('recur');
    expect(MEMO_ITEM_FIELDS).not.toContain('checklist');
  });
});

describe('file-sync 直写路径消毒（绕过 MemoData.write 的读改写）', () => {
  it('rename 同步回写带残留的存量文件：产物无两键、引用同步不受影响', async () => {
    unloadFileSync(); // 重置幂等守卫与监听（模块单例跨测试共享）
    clearDomainEvents();
    const vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
    ensureFileSync({ vault } as any);
    vault.files.set(
      PATH,
      JSON.stringify([
        staleFixture({ linkedNote: '卡片盒/旧笔记.md', notePath: '卡片盒/旧笔记.md' }),
      ])
    );

    emitDomainEvent('vault:md-renamed', { oldPath: '卡片盒/旧笔记.md', newPath: '卡片盒/新笔记.md' });
    // 越过去抖窗口（对齐 tests/memo/file-sync.test.ts flushQueue）
    await new Promise((r) => setTimeout(r, 400));
    await new Promise((r) => setTimeout(r, 30));
    await new Promise((r) => setTimeout(r, 0));
    unloadFileSync();

    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].linkedNote).toBe('卡片盒/新笔记.md'); // 同步功能本身不受影响
    expectNoStaleKeys(raw[0]);
  });
});

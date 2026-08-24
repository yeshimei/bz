/**
 * 备忘录动作观察集成（ticket 075 域事件派发）：emitDomainEvent('memo', evt) → 记忆流观察（source 'memo'）；
 * noteSource 关闭时不观察；maybeMemoDueScan 每日到期扫描（editingData.dueScan 跨天去重）。
 * 文案构造单测见 memo-source.test.ts。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { ensureSmartCat, unloadSmartCat, maybeMemoDueScan, __getSmartcatInternals } from '../../src/smartcat/index';
import type { MemoEditSnapshot } from '../../src/smartcat/memo-source';

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  const wsListeners: Record<string, Function[]> = {};
  app.workspace.on = (ev: string, cb: any) => { (wsListeners[ev] ||= []).push(cb); return { ev, cb }; };
  app.workspace.offref = (ref: any) => {
    const arr = wsListeners[ref?.ev] || [];
    const idx = arr.indexOf(ref?.cb);
    if (idx >= 0) arr.splice(idx, 1);
  };
  return { app, vault };
}

/** 等待 fire-and-forget 的 addObservation 落流 */
const settle = () => new Promise((r) => setTimeout(r, 100));

/** 固定「今天」= 2026-08-25 09:00（注入 maybeMemoDueScan，扫出的日期语义确定） */
const DAY1 = new Date(2026, 7, 25, 9, 0);

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

describe('notifyMemoAction（备忘录动作观察，域事件派发）', () => {
  it('添加（键值式）→ 观察入流，source memo', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('memo', { kind: 'added', title: '写周报', scene: '工作', priority: 'important', due: '2026-08-25 18:00', notePath: '书库/1984.md', scriptName: null, courseName: '算法' });
    await settle();
    const stream: any[] = __getSmartcatInternals().data.memory.stream;
    expect(stream[stream.length - 1].description).toBe('你添加了待办「写周报」（场景：工作，课程：算法，优先级：重要，截止：08-25 18:00，笔记：1984.md）');
    expect(stream[stream.length - 1].source).toBe('memo');
  });

  it('编辑 α 合并 / 完成 / 恢复 / 延后 / 优先级 / 删除 → 对应动作文案', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const old: MemoEditSnapshot = { title: '草稿', scene: '生活', priority: 'minor', due: '2026-08-25 18:00', notePath: null, scriptName: null, courseName: '旧课' };
    const next: MemoEditSnapshot = { title: '写周报', scene: '工作', priority: 'minor', due: '2026-08-25 18:00', notePath: '书库/1984.md', scriptName: null, courseName: '算法' };
    emitDomainEvent('memo', { kind: 'edited', old, next });
    emitDomainEvent('memo', { kind: 'completed', title: '写周报' });
    emitDomainEvent('memo', { kind: 'restored', title: '写周报' });
    emitDomainEvent('memo', { kind: 'postponed', title: '写周报', due: '2026-08-28 18:00' });
    emitDomainEvent('memo', { kind: 'priority', title: '写周报', to: 'important' });
    emitDomainEvent('memo', { kind: 'deleted', title: '写周报' });
    await settle();
    const stream: any[] = __getSmartcatInternals().data.memory.stream;
    const tail = stream.slice(-6).map((m) => m.description);
    expect(tail).toEqual([
      '你编辑了待办「写周报」（课程改为「算法」，场景改为「工作」，关联笔记 书库/1984.md）',
      '你完成了待办「写周报」',
      '你把待办「写周报」恢复为未完成',
      '你把待办「写周报」延后到了 08-28 18:00',
      '你把待办「写周报」转为重要',
      '你删除了待办「写周报」',
    ]);
  });

  it('noteSource 关闭 → 静默不观察', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    data.config.noteSource = false;
    const before = data.memory.stream.length;
    emitDomainEvent('memo', { kind: 'completed', title: '写周报' });
    await settle();
    expect(data.memory.stream.length).toBe(before);
  });

  it('未初始化（unload 后）→ 静默不观察', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    unloadSmartCat();
    expect(() => emitDomainEvent('memo', { kind: 'deleted', title: '写周报' })).not.toThrow();
  });

  it('B6 防重：同事件同 key 近 300ms 只发一次（勾选完成与抽屉「标记完成」双入口互斥）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    const before = data.memory.stream.length;
    // checkbox 300ms 防抖到点 + 抽屉「标记完成」重复触发 → 同 key 只入流一次
    emitDomainEvent('memo', { kind: 'completed', title: '写周报' });
    emitDomainEvent('memo', { kind: 'completed', title: '写周报' });
    await settle();
    expect(data.memory.stream.length).toBe(before + 1);
    // 窗口外（>300ms）同事件可再发；不同标题不误伤
    await new Promise((r) => setTimeout(r, 350));
    emitDomainEvent('memo', { kind: 'completed', title: '买菜' });
    emitDomainEvent('memo', { kind: 'completed', title: '写周报' });
    await settle();
    expect(data.memory.stream.length).toBe(before + 3);
  });
});

describe('maybeMemoDueScan（每日到期扫描）', () => {
  it('当天有到期未完成 → 合并一条观察 + dueScan 写入当日日期', async () => {
    const { app, vault } = makeApp();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: '1', title: '写周报', due: '2026-08-25 18:00', completed: null },
      { id: '2', title: '买菜', due: '2026-08-25T20:30', completed: null },
      { id: '3', title: '已完成', due: '2026-08-25 12:00', completed: '2026-08-25 08:00' },
      { id: '4', title: '明天', due: '2026-08-26 10:00', completed: null },
    ]));
    await ensureSmartCat(app);
    await maybeMemoDueScan(DAY1);
    await settle();
    const data: any = __getSmartcatInternals().data;
    const stream: any[] = data.memory.stream;
    expect(stream[stream.length - 1].description).toBe('你有 2 个待办今天到期：写周报（18:00）、买菜（20:30）');
    expect(stream[stream.length - 1].source).toBe('memo');
    expect(data.editingData.dueScan).toEqual({ date: '2026-08-25' });
  });

  it('当日去重：同一天再扫不重复产出；跨天（改 editingData 模拟）可再扫', async () => {
    const { app, vault } = makeApp();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: '1', title: '写周报', due: '2026-08-25 18:00', completed: null },
    ]));
    await ensureSmartCat(app);
    await maybeMemoDueScan(DAY1);
    await settle();
    const data: any = __getSmartcatInternals().data;
    const afterFirst = data.memory.stream.length;
    await maybeMemoDueScan(DAY1); // 当天已扫过 → 跳过
    expect(data.memory.stream.length).toBe(afterFirst);
    // 模拟第二天（把 dueScan 日期改为昨天/过去）
    data.editingData = { ...data.editingData, dueScan: { date: '2026-08-24' } };
    await maybeMemoDueScan(DAY1);
    await settle();
    expect(data.memory.stream.length).toBe(afterFirst + 1);
  });

  it('noteSource 关闭 → 扫描静默（不产出、不推进日期）', async () => {
    const { app, vault } = makeApp();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: '1', title: '写周报', due: '2026-08-25 18:00', completed: null },
    ]));
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    data.config.noteSource = false;
    const before = data.memory.stream.length;
    await maybeMemoDueScan(DAY1);
    await settle();
    expect(data.memory.stream.length).toBe(before);
    expect(data.editingData?.dueScan).toBeUndefined();
  });

  it('无 memo.json（memo 域未启用）→ 静默，不推进日期', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    const before = data.memory.stream.length;
    await maybeMemoDueScan(DAY1);
    await settle();
    expect(data.memory.stream.length).toBe(before);
    expect(data.editingData?.dueScan).toBeUndefined();
  });

  it('B8：连续 3 次读取失败 → 当日放弃（文件修复后同天不再扫）；跨天重置可再扫', async () => {
    const { app, vault } = makeApp();
    vault.files.set('CONFIG/STORAGE/memo.json', 'not-json'); // 读取解析失败路径
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    const before = data.memory.stream.length;
    for (let i = 0; i < 3; i++) await maybeMemoDueScan(DAY1); // 连续失败 3 次
    await settle();
    expect(data.editingData?.dueScan).toBeUndefined(); // 失败不推进日期
    // 文件恢复正常 + 同天第 4 次 → 当日放弃（不再扫，不产出不推进）
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: '1', title: '写周报', due: '2026-08-26 18:00', completed: null }, // 属 DAY2 当天（跨天验证用）
    ]));
    await maybeMemoDueScan(DAY1);
    await settle();
    expect(data.memory.stream.length).toBe(before);
    expect(data.editingData?.dueScan).toBeUndefined();
    // 跨天（DAY2）→ 失败计数重置 → 正常扫描产出
    const DAY2 = new Date(2026, 7, 26, 9, 0);
    await maybeMemoDueScan(DAY2);
    await settle();
    expect(data.memory.stream[data.memory.stream.length - 1].description).toBe('你有 1 个待办今天到期：写周报（18:00）');
    expect(data.editingData.dueScan).toEqual({ date: '2026-08-26' });
  });

  it('B8：失败 1 次后文件恢复 → 重试成功且仅一条（不重复入流）', async () => {
    const { app, vault } = makeApp();
    vault.files.set('CONFIG/STORAGE/memo.json', 'not-json');
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    await maybeMemoDueScan(DAY1); // 失败（计数 1）
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { id: '1', title: '写周报', due: '2026-08-25 18:00', completed: null },
    ]));
    await maybeMemoDueScan(DAY1); // 重试成功
    await settle();
    expect(data.editingData.dueScan).toEqual({ date: '2026-08-25' });
    const memoOnes = data.memory.stream.filter((m: any) => m.source === 'memo');
    expect(memoOnes.length).toBe(1);
    expect(memoOnes[0].description).toBe('你有 1 个待办今天到期：写周报（18:00）');
  });
});
/**
 * 备忘录周期重复（issue 353）回归：
 * - 数据层：recur 归一（零迁移）、nextRecurDue 周期算术（含补逾期逐跳锚定）、
 *   completeItem 自动生成下一期（全字段保留/幂等短路）、停止重复；
 * - 纯层：meta 标记 markup 口径（场景→重复→截止次序）；
 * - UI 层：列表「每周」标记、勾选完成后下一期浮现、编辑器重复选择读写。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { MemoData, normalizeRecur, nextRecurDue, hasPendingNextItem } from '../../src/memo/data';
import { recurLabel } from '../../src/memo/due';
import { metaTagsHtml } from '../../src/memo/render';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, openEditor } from '../../src/memo/ui';
import type { MemoItem } from '../../src/memo/types';

// ---------- 数据层 ----------

describe('issue 353 · recur 归一（零迁移）', () => {
  it('normalizeRecur：三基础周期原样保留；days 补 interval 缺省/非法回 1', () => {
    expect(normalizeRecur({ kind: 'weekly' })).toEqual({ kind: 'weekly' });
    expect(normalizeRecur({ kind: 'monthly' })).toEqual({ kind: 'monthly' });
    expect(normalizeRecur({ kind: 'yearly' })).toEqual({ kind: 'yearly' });
    expect(normalizeRecur({ kind: 'days', interval: 3 })).toEqual({ kind: 'days', interval: 3 });
    expect(normalizeRecur({ kind: 'days' })).toEqual({ kind: 'days', interval: 1 });
    expect(normalizeRecur({ kind: 'days', interval: -2 })).toEqual({ kind: 'days', interval: 1 });
    // 缺省/脏数据安全回落 null
    expect(normalizeRecur(undefined)).toBeNull();
    expect(normalizeRecur(null)).toBeNull();
    expect(normalizeRecur('weekly')).toBeNull();
    expect(normalizeRecur({ kind: 'bogus' })).toBeNull();
  });

  it('loadItems：旧数据无 recur 字段补 null（零迁移），有 recur 原样保留', async () => {
    const vault = new MockVault();
    setApp({ vault, workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: () => null } } as any);
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([
        { id: 'old', title: '旧条目', scene: '工作', priority: 'minor', created: '2026-01-01 00:00:00' },
        { id: 'rec', title: '周报', scene: '工作', priority: 'minor', created: '2026-01-01 00:00:00', recur: { kind: 'weekly' } },
      ])
    );
    MemoData.init({ storagePath: 'CONFIG/STORAGE' });
    const items = await MemoData.loadItems();
    expect(items.find((i) => i.id === 'old')!.recur).toBeNull();
    expect(items.find((i) => i.id === 'rec')!.recur).toEqual({ kind: 'weekly' });
  });
});

describe('issue 353 · nextRecurDue 周期算术', () => {
  const NOW = '2026-09-16 12:00:00';

  it('weekly：锚点 +7 天，时刻不变', () => {
    expect(nextRecurDue({ kind: 'weekly' }, '2026-09-23 09:30:00', NOW)).toBe('2026-09-30 09:30:00');
  });

  it('weekly：补完逾期老条目逐跳前跳，严格晚于完成时刻（锚定星期不丢）', () => {
    const next = nextRecurDue({ kind: 'weekly' }, '2026-08-01 09:00:00', NOW);
    expect(moment(next).valueOf()).toBeGreaterThan(moment(NOW).valueOf());
    // 与原 due 同星期同时刻
    expect(moment(next).format('HH:mm')).toBe('09:00');
    expect(moment(next).format('dddd')).toBe(moment('2026-08-01').format('dddd'));
  });

  it('monthly：月末钳制（1/31 → 2/28）+ 补逾期前跳', () => {
    expect(nextRecurDue({ kind: 'monthly' }, '2026-01-31 08:00:00', '2026-03-01 10:00:00')).toBe('2026-03-31 08:00:00');
  });

  it('审查 P1 · 月锚 anchorDay 链式：钳制后的 due 不回写锚，连两代完成 1/31 不退化', () => {
    // 第 1 代：锚 1/31 完成于 2 月初 → 2/28（钳制）；带上 anchorDay=31 再算第 2 代
    const gen1 = nextRecurDue({ kind: 'monthly', anchorDay: 31 }, '2026-01-31 08:00:00', '2026-02-01 10:00:00');
    expect(gen1).toBe('2026-02-28 08:00:00');
    // 第 2 代：锚仍是 31 号（修复前钳制 due 2/28 成新锚 → 永久退化 3/28）
    const gen2 = nextRecurDue({ kind: 'monthly', anchorDay: 31 }, gen1, '2026-03-01 10:00:00');
    expect(gen2).toBe('2026-03-31 08:00:00');
    const gen3 = nextRecurDue({ kind: 'monthly', anchorDay: 31 }, gen2, '2026-04-01 10:00:00');
    expect(gen3).toBe('2026-04-30 08:00:00'); // 4 月无 31 号 → 月末钳制
    const gen4 = nextRecurDue({ kind: 'monthly', anchorDay: 31 }, gen3, '2026-05-01 10:00:00');
    expect(gen4).toBe('2026-05-31 08:00:00'); // 钳制不传染：5 月回到 31 号
  });

  it('审查 P1 · 年锚 anchorDay：2/29 逐年取日，闰年回归 29 号', () => {
    // 2028 闰年锚 2/29，连跨三个平年后 2032 闰年应回到 2/29
    const g1 = nextRecurDue({ kind: 'yearly', anchorDay: 29 }, '2028-02-29 09:00:00', '2028-03-01 09:00:00');
    expect(g1).toBe('2029-02-28 09:00:00');
    const g2 = nextRecurDue({ kind: 'yearly', anchorDay: 29 }, g1, '2029-03-01 09:00:00');
    expect(g2).toBe('2030-02-28 09:00:00');
    const g3 = nextRecurDue({ kind: 'yearly', anchorDay: 29 }, g2, '2031-03-01 09:00:00');
    expect(g3).toBe('2032-02-29 09:00:00'); // 2032 闰年：锚 29 不漂移成 28
  });

  it('审查 P2 · days guard 耗尽仍落后：以完成时刻为锚兜底一期（不再产「过去到期」）', () => {
    // due 落后 6 年余（>366 个 7 天周期），修复前 guard 耗尽后返回的仍是过去时刻
    const next = nextRecurDue({ kind: 'days', interval: 7 }, '2020-01-01 09:00:00', '2026-09-16 12:00:00');
    expect(moment(next).valueOf()).toBeGreaterThan(moment('2026-09-16 12:00:00').valueOf());
    expect(next).toBe('2026-09-23 12:00:00'); // now + 7 天兜底
    // 小间隔（1 天）同理
    expect(nextRecurDue({ kind: 'days', interval: 1 }, '2020-01-01 09:00:00', '2026-09-16 12:00:00')).toBe('2026-09-17 12:00:00');
  });

  it('yearly：+1 年', () => {
    expect(nextRecurDue({ kind: 'yearly' }, '2026-06-01 09:00:00', NOW)).toBe('2027-06-01 09:00:00');
  });

  it('days：自定义 N 天间隔（预留结构，interval 非法按 1）', () => {
    expect(nextRecurDue({ kind: 'days', interval: 3 }, '2026-09-16 08:00:00', NOW)).toBe('2026-09-19 08:00:00');
    expect(nextRecurDue({ kind: 'days' }, '2026-09-16 08:00:00', NOW)).toBe('2026-09-17 08:00:00');
  });

  it('无 due：锚定完成时刻起算', () => {
    expect(nextRecurDue({ kind: 'weekly' }, null, NOW)).toBe('2026-09-23 12:00:00');
  });
});

describe('issue 353 · completeItem 自动生成下一期', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault, workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: () => null } } as any);
    MemoData.init({ storagePath: 'CONFIG/STORAGE' });
  });

  it('周期条目完成后生成下一期：全字段保留、新 id、completed 清空、due 顺延', async () => {
    const src: MemoItem = {
      id: 'r1', title: '交周报', scene: '工作', priority: 'important', created: '2026-09-01 09:00:00',
      completed: null, due: '2026-09-18 18:00:00', notePath: '工作/周报.md', notePosition: { line: 3, ch: 0 },
      scriptName: null, courseName: null, coursePath: null, linkedNote: '归档/网页剪藏/x.md',
      url: 'https://example.com', recur: { kind: 'weekly' }, checklist: null,
    };
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([src]));
    const { next } = await MemoData.completeItem('r1');
    expect(next).not.toBeNull();
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw).toHaveLength(2);
    const old = raw.find((i: any) => i.id === 'r1');
    expect(old.completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // 下一期：场景/优先级/关联笔记/位置/链接/recur 全保留；新 id、未完成、due 顺延一周
    expect(next!.id).not.toBe('r1');
    expect(next!.completed).toBeNull();
    expect(next!.scene).toBe('工作');
    expect(next!.priority).toBe('important');
    expect(next!.notePath).toBe('工作/周报.md');
    expect(next!.notePosition).toEqual({ line: 3, ch: 0 });
    expect(next!.linkedNote).toBe('归档/网页剪藏/x.md');
    expect(next!.url).toBe('https://example.com');
    expect(next!.recur).toEqual({ kind: 'weekly' });
    expect(next!.due).toBe('2026-09-25 18:00:00');
    // notePosition 深拷贝：改旧条目定位不影响下一期
    old.notePosition.line = 99;
    expect(next!.notePosition!.line).toBe(3);
    // 下一期在盘上（unshift 头插）
    expect(raw[0].id).toBe(next!.id);
  });

  it('非周期条目完成：不生成下一期（next = null）', async () => {
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([{ id: 'a', title: '普通条目', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00' }])
    );
    const { next } = await MemoData.completeItem('a');
    expect(next).toBeNull();
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toHaveLength(1);
  });

  it('幂等：重复 completeItem 已完成条目不再生成第二期', async () => {
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([{ id: 'r', title: '周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', recur: { kind: 'weekly' } }])
    );
    await MemoData.completeItem('r');
    const { next } = await MemoData.completeItem('r');
    expect(next).toBeNull();
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toHaveLength(2);
  });

  it('停止重复：updateItem recur → null，之后完成不再生成', async () => {
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([{ id: 'r', title: '周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', recur: { kind: 'weekly' } }])
    );
    await MemoData.updateItem('r', { recur: null });
    const { next } = await MemoData.completeItem('r');
    expect(next).toBeNull();
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toHaveLength(1);
  });

  it('审查 P1 · 月末锚跨代链式：completeItem 记 anchorDay，连两代完成 1/31 月重复不退化', async () => {
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([
        { id: 'm1', title: '月度盘点', scene: '工作', priority: 'minor', created: '2026-01-01 09:00:00', completed: null, due: '2026-01-31 09:00:00', recur: { kind: 'monthly' } },
      ])
    );
    // 第 1 代完成（2026-02 内）；只 fake Date（completeItem 的 now 取 moment()），不碰队列计时
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-02-05T10:00:00') });
    try {
      const r1 = await MemoData.completeItem('m1');
      expect(r1.next!.due).toBe('2026-02-28 09:00:00'); // 2 月无 31 号 → 钳制
      expect(r1.next!.recur).toEqual({ kind: 'monthly', anchorDay: 31 }); // 原始锚随下一代走
      // 第 2 代完成（2026-03 内）——修复前锚被钳制 due 2/28 接管 → 3/28 永久退化
      vault.files.set(
        'CONFIG/STORAGE/memo.json',
        JSON.stringify([
          { ...JSON.parse(JSON.stringify(r1.next!)), completed: null },
        ])
      );
      const r2 = await MemoData.completeItem(r1.next!.id);
      expect(r2.next!.due).toBe('2026-03-31 09:00:00'); // 回到 31 号，不退化
      expect(r2.next!.recur).toEqual({ kind: 'monthly', anchorDay: 31 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('审查 P3 · changed 语义：实际完成 true；幂等短路 false（UI 据此不重复发 completed 事件）', async () => {
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([{ id: 'c1', title: '普通条目', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00' }])
    );
    const first = await MemoData.completeItem('c1');
    expect(first.changed).toBe(true);
    const again = await MemoData.completeItem('c1');
    expect(again.changed).toBe(false);
    expect(again.next).toBeNull();
  });
});

describe('审查 P2 · hasPendingNextItem（恢复撤链判定）', () => {
  const base = (extra: Partial<MemoItem>): MemoItem => ({
    id: 't1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-10 09:00:00',
    completed: null, due: null, notePath: null, notePosition: null, scriptName: null,
    courseName: null, coursePath: null, linkedNote: null, url: null, recur: null, checklist: null, ...extra,
  });

  it('链上有同标题/场景/周期、未完成且 due 更晚的下期 → true', () => {
    const done = base({ id: 'a', completed: moment().subtract(1, 'day').format('YYYY-MM-DD') + ' 10:00:00', due: moment().subtract(2, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } });
    const pending = base({ id: 'b', due: moment().add(6, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } });
    expect(hasPendingNextItem([done, pending], done)).toBe(true);
  });

  it('标题不同 / 周期种类不同 / 下期已完成 / 无 recur / 自身未完成 → false', () => {
    const done = base({ id: 'a', completed: moment().subtract(1, 'day').format('YYYY-MM-DD') + ' 10:00:00', due: moment().subtract(2, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } });
    expect(hasPendingNextItem([done, base({ id: 'b', title: '别的标题', due: moment().add(6, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } })], done)).toBe(false);
    expect(hasPendingNextItem([done, base({ id: 'b', due: moment().add(6, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'monthly' } })], done)).toBe(false);
    expect(hasPendingNextItem([done, base({ id: 'b', completed: '2026-09-16 09:00:00', due: moment().add(6, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } })], done)).toBe(false);
    expect(hasPendingNextItem([done, base({ id: 'b', due: moment().add(6, 'day').format('YYYY-MM-DD') + ' 09:00:00' })], done)).toBe(false);
    expect(hasPendingNextItem([done], base({ id: 'a', recur: { kind: 'weekly' } }))).toBe(false); // 自身未完成
  });
});

// ---------- 纯层 markup ----------

describe('issue 353 · meta 重复标记（markup 口径）', () => {
  const base = (extra: Partial<MemoItem>): MemoItem => ({
    id: 't1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-10 09:00:00',
    completed: null, due: null, notePath: null, notePosition: null, scriptName: null,
    courseName: null, coursePath: null, linkedNote: null, url: null, recur: null, checklist: null, ...extra,
  });

  it('recur 文案注入 → bz-memo-tag-recur 标签，位于场景与截止之间', () => {
    const h = metaTagsHtml(base({ due: '2026-09-18 18:00:00' }), { status: 'future', text: '09/18 18:00 到期' }, '', recurLabel({ kind: 'weekly' }));
    expect(h).toContain('bz-memo-tag-recur');
    expect(h).toContain('data-lucide="repeat"');
    expect(h).toContain('每周');
    const atScene = h.indexOf('bz-memo-tag-scene');
    const atRecur = h.indexOf('bz-memo-tag-recur');
    const atDue = h.indexOf('bz-memo-tag-future');
    expect(atRecur).toBeGreaterThan(atScene);
    expect(atRecur).toBeLessThan(atDue);
  });

  it('无 recur 不出标签；recurLabel 四种文案', () => {
    expect(metaTagsHtml(base({}), null, '', '')).not.toContain('bz-memo-tag-recur');
    expect(recurLabel({ kind: 'weekly' })).toBe('每周');
    expect(recurLabel({ kind: 'monthly' })).toBe('每月');
    expect(recurLabel({ kind: 'yearly' })).toBe('每年');
    expect(recurLabel({ kind: 'days', interval: 3 })).toBe('每 3 天');
    expect(recurLabel({ kind: 'days' })).toBe('每 1 天');
  });
});

// ---------- UI 层 ----------

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '全部',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

describe('issue 353 · UI（列表标记/勾选重生/编辑器）', () => {
  let vault: MockVault;

  function seed(item: Record<string, unknown>):
    { app: ReturnType<typeof mockAppWithVault>; settings: Record<string, unknown> } {
    vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([{ ...item }]));
    const settings: Record<string, unknown> = { ...SETTINGS };
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => settings as any);
    setSettingsSaver(vi.fn(async () => {}));
    MemoData.init(settings as any);
    return { app, settings };
  }

  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('列表卡显示周期标记（每周）', async () => {
    const { app } = seed({ id: 'r1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', recur: { kind: 'weekly' } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-tag-recur')?.textContent).toContain('每周');
    });
  });

  it('勾选完成 → 下一期自动浮现（带每周标记），原条目入已完成折叠区', async () => {
    const { app } = seed({ id: 'r1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', due: moment().subtract(1, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-check')).toBeTruthy();
    });
    (document.querySelector('.bz-memo-check') as HTMLElement).click();
    // 300ms 防抖 + 数据层生成 + 重渲
    await new Promise((r) => setTimeout(r, 450));
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(1);
      expect((document.querySelector('.bz-memo-card') as HTMLElement).dataset.memoId).not.toBe('r1');
    });
    expect(document.querySelector('.bz-memo-tag-recur')?.textContent).toContain('每周');
    // 盘上两期
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw).toHaveLength(2);
    expect(raw.find((i: any) => i.id === 'r1').completed).toBeTruthy();
  });

  it('编辑器：周期条目回填选中档；改选每月保存落盘', async () => {
    const { app } = seed({ id: 'r1', title: '换滤芯', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00', recur: { kind: 'weekly' } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(1);
    });
    openEditor(M.items[0]);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
    });
    // 回填：每周选中
    expect(document.querySelector('.bz-memo-editor [data-value="weekly"].is-on')).toBeTruthy();
    // 改选每月 → 保存
    (document.querySelector('.bz-memo-editor [data-value="monthly"]') as HTMLElement).click();
    const saveBtn = [...document.querySelectorAll('.bz-memo-editor .bz-btn')].find((b) => b.textContent!.includes('保存')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw[0].recur).toEqual({ kind: 'monthly' });
    });
  });

  it('编辑器：不重复 → 保存清空 recur（停止重复的第二入口）', async () => {
    const { app } = seed({ id: 'r1', title: '换滤芯', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00', recur: { kind: 'monthly' } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(1);
    });
    openEditor(M.items[0]);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
    });
    (document.querySelector('.bz-memo-editor [data-value="none"]') as HTMLElement).click();
    const saveBtn = [...document.querySelectorAll('.bz-memo-editor .bz-btn')].find((b) => b.textContent!.includes('保存')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw[0].recur).toBeNull();
    });
  });

  it('审查 P3 · 已完成条目 meta 不再注入「每周」标签；恢复未完成后标记回来', async () => {
    const { app } = seed({ id: 'r1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: '2026-09-15 10:00:00', recur: { kind: 'weekly' } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-donebar]')).toBeTruthy();
    });
    // 展开已完成折叠区
    (document.querySelector('[data-memo-donebar]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="r1"]')).toBeTruthy();
    });
    // 已完成：无「每周」标签（期已了结，标每周有「还会自己回来」的误导）
    expect(document.querySelector('.bz-memo-card[data-memo-id="r1"] .bz-memo-tag-recur')).toBeNull();
    // 恢复未完成：标记随 recur 回来
    (document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="r1"] .bz-memo-tag-recur')).toBeTruthy();
    });
  });

  it('审查 P2 · 恢复已完成周期条目：链上已有未完成下期 → 一并撤链（recur 清空）+ 提示', async () => {
    // r1 = 已完成当期；r2 = 完成时克隆出的下期（未完成、due 更晚、同标题/场景/周期）
    const { app } = seed({ id: 'r1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: moment().subtract(1, 'day').format('YYYY-MM-DD') + ' 10:00:00', due: moment().subtract(2, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } });
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([
        { id: 'r1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: moment().subtract(1, 'day').format('YYYY-MM-DD') + ' 10:00:00', due: moment().subtract(2, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } },
        { id: 'r2', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-15 10:00:00', completed: null, due: moment().add(6, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } },
      ])
    );
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(2);
    });
    (document.querySelector('[data-memo-donebar]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="r1"]')).toBeTruthy();
    });
    (document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      const r1 = raw.find((i: any) => i.id === 'r1');
      expect(r1.completed).toBeNull();
      expect(r1.recur).toBeNull(); // 撤链：再完成不会再生成第二期（r2 即未来期）
    });
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-notice')?.textContent).toContain('下一期已存在');
    });
    // 下期原样保留
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.find((i: any) => i.id === 'r2').recur).toEqual({ kind: 'weekly' });
  });

  it('审查 P2 · 恢复无下期的已完成周期条目：recur 原样保留（再完成照常生成下期）', async () => {
    const { app } = seed({ id: 'r1', title: '交周报', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: moment().subtract(1, 'day').format('YYYY-MM-DD') + ' 10:00:00', due: moment().subtract(2, 'day').format('YYYY-MM-DD') + ' 09:00:00', recur: { kind: 'weekly' } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(1);
    });
    (document.querySelector('[data-memo-donebar]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="r1"]')).toBeTruthy();
    });
    (document.querySelector('.bz-memo-card[data-memo-id="r1"] [data-memo-check]') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      const r1 = raw.find((i: any) => i.id === 'r1');
      expect(r1.completed).toBeNull();
      expect(r1.recur).toEqual({ kind: 'weekly' });
    });
  });

  it('审查 P2 · 编辑器遇 kind:days 旧数据：不触碰重复档保存保留原值（不静默清 null）', async () => {
    const { app } = seed({ id: 'd1', title: '三天一查', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00', recur: { kind: 'days', interval: 3 } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(1);
    });
    openEditor(M.items[0]);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
    });
    // days 无 UI 档：回填显「不重复」；不动它直接保存
    expect(document.querySelector('.bz-memo-editor [data-value="days"]')).toBeNull();
    const saveBtn = [...document.querySelectorAll('.bz-memo-editor .bz-btn')].find((b) => b.textContent!.includes('保存')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw[0].recur).toEqual({ kind: 'days', interval: 3 });
    });
  });

  it('审查 P2 · 编辑器 days 旧数据：动了重复档则按所选落盘（含清成不重复）', async () => {
    const { app } = seed({ id: 'd1', title: '三天一查', scene: '生活', priority: 'minor', created: '2026-09-01 09:00:00', recur: { kind: 'days', interval: 3 } });
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(1);
    });
    openEditor(M.items[0]);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
    });
    (document.querySelector('.bz-memo-editor [data-value="none"]') as HTMLElement).click();
    const saveBtn = [...document.querySelectorAll('.bz-memo-editor .bz-btn')].find((b) => b.textContent!.includes('保存')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw[0].recur).toBeNull();
    });
  });
});

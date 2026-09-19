// @vitest-environment node
/**
 * favorites 域深审批 A（bz-fix-fav-data）数据侧修复回归：
 * - arch-1：normalizeItems 读出口条目级归一（合法 JSON + 字段类型漂移消毒/剔除告警）；
 * - E6 读侧半：url 读盘路径 normalizeUrl 统一归一（写侧保存链路归深审批 B）；
 * - func-3：update「表单快照形态」窄化合并写（盘侧托管字段不被内存旧快照回滚）；
 * - func-4：type = tags[0] 派生字段三条写链（add/update/updateTagLabelBulk）一处收口；
 * - func-5：AI 整理结果归一 normalizeAiOrganizeResult（回填前补协议；ui 接线归深审批 B）；
 * - arch-2：域事件 kind 发射侧（ui.ts）× smartcat 消费侧（favorites-source.ts）字面量对账锁
 *   （restored kind 随深审批 B func-2 增补：删除撤销补发）；
 * - arch-4：DataManager 双实例路径语义现状安全面（收口方案 = tagManagerDm 取主面板同实例，
 *   接线在 ui.ts，归深审批 B；本批在 data.ts 头注释钉死方案）。
 * 纪律：纯数据层测试，全部自造 fixture，零用户 vault 数据。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataManager, normalizeItems } from '../../src/favorites/data';
import { getStoragePath } from '../../src/favorites/config';
import { normalizeAiOrganizeResult } from '../../src/favorites/ai';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { enqueueFileTask, jsonFileStore } from '../../src/core/storage';
import { MockVault } from '../mock-vault';

const PATH = 'CONFIG/STORAGE/favorites.json';
const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

/** 合法 12 字段条目（继承 data.test 基准形状），patch 可注入漂移 */
const item = (id: string, patch: Record<string, any> = {}) => ({
  id, tags: [], title: '条目' + id, description: '', pinned: false, url: '', balance: null,
  balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-06-01 08:00:00', type: '',
  ...patch,
});

describe('normalizeItems 读出口归一（arch-1 + E6 读侧半）', () => {
  let vault: MockVault;
  let dm: DataManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('字段漂移注入五态：number created / string tags / 缺 id / 非对象条目 / 无协议 url → 读出归一形状，盘上原文件字节不变', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = JSON.stringify([
      item('a', { created: 1727300000 as any }),                    // created 数字（localeCompare 炸点）
      item('b', { tags: 'GitHub仓库' as any }),                     // tags 字符串（includes 误命中）
      item('c', { tags: ['A', 42, null, ''] as any }),              // tags 元素漂移
      { ...item('d'), id: '' },                                     // 缺 id（幽灵行）
      null,                                                         // 非对象条目
      item('e', { url: 'example.com/x' }),                          // 无协议 url
    ]);
    vault.files.set(PATH, raw);
    dm = new DataManager(PATH);
    const data = await dm.getAll();
    // 不可救条目（缺 id / null）剔除，其余四条保留
    expect(data.map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
    expect(data[0].created).toBe('1727300000'); // 数字 → String 纠偏（localeCompare 不再炸）
    expect(data[1].tags).toEqual(['GitHub仓库']); // 字符串收编为单元素（'X'.includes 误命中消失）
    expect(data[2].tags).toEqual(['A', '42']); // 元素纠偏、空值剔除
    expect(data[3].url).toBe('https://example.com/x'); // E6 读侧：补协议
    // 纯读不动盘：vault 原文件字节不变（checkup 漂移检查仍可复核）
    expect(vault.files.get(PATH)).toBe(raw);
    // 归一动作留痕告警（剔除 2 条：缺 id + null）
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('剔除 2 条');
    warn.mockRestore();
  });

  it('漂移读出不再炸渲染链比较器：created 数字归一后 localeCompare 可用', async () => {
    vault.files.set(PATH, JSON.stringify([
      item('a', { created: 999 as any }),
      item('b', { created: 1 as any }),
    ]));
    const dm = new DataManager(PATH);
    const data = await dm.getAll();
    expect(() => [...data].sort((x, y) => (y.created || '').localeCompare(x.created || ''))).not.toThrow();
    expect(data.map((d) => d.id)).toEqual(['a', 'b']); // '999' > '1' 串比较
  });

  it('根非数组（合法 JSON 但根是对象）→ []', async () => {
    vault.files.set(PATH, '{"not":"array"}');
    const dm = new DataManager(PATH);
    expect(await dm.getAll()).toEqual([]);
  });

  it('数字 id String 纠偏可救；type 缺失按 tags[0] 重算；未提及字段（balance/linkedNote/llmConfig）透传', async () => {
    vault.files.set(PATH, JSON.stringify([
      { ...item(1727300000 as any, { tags: ['网站'], type: '', linkedNote: '笔记.md', balance: '9.9' }), llmConfig: { apiKeys: 'sk', balanceUrl: 'u' } },
    ]));
    const dm = new DataManager(PATH);
    const [it] = await dm.getAll();
    expect(it.id).toBe('1727300000');
    expect(it.type).toBe('网站'); // func-4 读侧兜底：type = tags[0]
    expect(it.linkedNote).toBe('笔记.md');
    expect(it.balance).toBe('9.9');
    expect(it.llmConfig).toEqual({ apiKeys: 'sk', balanceUrl: 'u' });
  });

  it('url 归一口径：带协议原样（大小写/空格容忍走 normalizeUrl 单源）、空串不产 https://', async () => {
    vault.files.set(PATH, JSON.stringify([
      item('a', { url: 'http://a.b/c' }),
      item('b', { url: '   ' }),
      item('c', { url: '' }),
    ]));
    const dm = new DataManager(PATH);
    const data = await dm.getAll();
    expect(data[0].url).toBe('http://a.b/c');
    expect(data[1].url).toBe('');
    expect(data[2].url).toBe('');
  });

  it('写时自愈：mutateAll 写链读归一视图，写回固化归一形态（漂移字段纠偏落盘）', async () => {
    const raw = JSON.stringify([item('a', { created: 999 as any, url: 'example.com/x' })]);
    vault.files.set(PATH, raw);
    const dm = new DataManager(PATH);
    await dm.update('a', { pinned: true });
    const saved = JSON.parse(vault.files.get(PATH)!);
    expect(saved[0].created).toBe('999'); // 固化为字符串
    expect(saved[0].url).toBe('https://example.com/x');
    expect(saved[0].pinned).toBe(true);
  });

  it('normalizeItems 纯函数直测：剔除/纠偏计数告警一次留痕', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = normalizeItems([null, item('a', { created: 5 as any })] as any);
    expect(out.map((d) => d.id)).toEqual(['a']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('剔除 1 条');
    warn.mockRestore();
    // 干净数据零告警
    const warn2 = vi.spyOn(console, 'warn').mockImplementation(() => {});
    normalizeItems([item('b')] as any);
    expect(warn2).not.toHaveBeenCalled();
    warn2.mockRestore();
  });
});

describe('update 表单快照窄化合并写（func-3）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('盘侧字段不被回滚：checkup 清掉失效 linkedNote 后，编辑全量快照保存不再写回旧值', async () => {
    const dm = new DataManager(PATH);
    const old = item('a', { tags: ['网站'], title: '旧标题', linkedNote: '失效笔记.md', created: '2025-06-01 08:00:00', type: '网站' });
    await dm.add(old as any);

    // 模拟 checkup fixFavorites：jsonFileStore 直改盘上 linkedNote（同一 per-path 队列）
    await enqueueFileTask(PATH, async () => {
      const store = jsonFileStore<any[]>(PATH, { defaultValue: [] as any[] });
      const data = await store.read();
      const t = data.find((d: any) => d.id === 'a');
      if (t) t.linkedNote = null;
      await store.write(data);
    });

    // 面板未刷新：编辑链持内存旧快照 spread old 全量保存（ui saveForm 原形态，调用侧零改动）
    const staleNext = { ...old, title: '新标题', url: 'https://a.b', description: '改', tags: ['GitHub'], pinned: true };
    await dm.update('a', staleNext as any);

    const saved = JSON.parse(vault.files.get(PATH)!).find((d: any) => d.id === 'a');
    expect(saved.linkedNote).toBeNull(); // 盘侧修复不被内存旧值回滚
    expect(saved.title).toBe('新标题'); // 表单业务字段照常更新
    expect(saved.url).toBe('https://a.b');
    expect(saved.tags).toEqual(['GitHub']);
    expect(saved.pinned).toBe(true);
  });

  it('表单快照窄化不触碰归档态：盘上 archived/archivedAt 保留', async () => {
    const dm = new DataManager(PATH);
    const old = item('a', { tags: ['网站'], type: '网站', archived: true, archivedAt: '2026-09-01 10:00:00' });
    await dm.add(old as any);
    const staleNext = { ...old, title: '改', tags: ['GitHub'] }; // 内存快照的 archived 恰与盘一致，构造盘侧差异验证
    await enqueueFileTask(PATH, async () => {
      const store = jsonFileStore<any[]>(PATH, { defaultValue: [] as any[] });
      const data = await store.read();
      const t = data.find((d: any) => d.id === 'a');
      t.archivedAt = '2026-09-19 09:00:00'; // 盘侧归档时间被外部推进
      await store.write(data);
    });
    await dm.update('a', staleNext as any);
    const saved = JSON.parse(vault.files.get(PATH)!).find((d: any) => d.id === 'a');
    expect(saved.archived).toBe(true);
    expect(saved.archivedAt).toBe('2026-09-19 09:00:00'); // 保留盘上值
    expect(saved.title).toBe('改');
  });

  it('窄 patch 语义不变：置顶 {pinned}、归档 {archived, archivedAt} 各只动目标字段', async () => {
    const dm = new DataManager(PATH);
    await dm.add(item('a', { tags: ['网站'], title: 'T', type: '网站' }) as any);
    await dm.update('a', { pinned: true });
    await dm.update('a', { archived: true, archivedAt: '2026-09-19 08:00:00' });
    const saved = JSON.parse(vault.files.get(PATH)!)[0];
    expect(saved.pinned).toBe(true);
    expect(saved.archived).toBe(true);
    expect(saved.archivedAt).toBe('2026-09-19 08:00:00');
    expect(saved.title).toBe('T');
    expect(saved.linkedNote).toBeNull();
  });
});

describe('type = tags[0] 派生字段三写链收口（func-4）', () => {
  let vault: MockVault;
  let dm: DataManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    dm = new DataManager(PATH);
  });

  it('add 链：构造传错 type 也被纠为 tags[0]', async () => {
    await dm.add(item('a', { tags: ['GitHub'], type: '错误派生' }) as any);
    const saved = JSON.parse(vault.files.get(PATH)!)[0];
    expect(saved.type).toBe('GitHub');
  });

  it('update 编辑链：改标签后 type 重算（全量快照形态 = ui saveForm 原形态）', async () => {
    const old = item('a', { tags: ['GitHub', '网站'], type: 'GitHub' });
    await dm.add(old as any);
    const next = { ...old, tags: ['网站', 'GitHub'] }; // 首标签从 GitHub 换成 网站
    await dm.update('a', next as any);
    const saved = JSON.parse(vault.files.get(PATH)!)[0];
    expect(saved.type).toBe('网站'); // func-4：不再残留旧派生值
  });

  it('update 窄 patch：只传 {tags} 也重算；置顶/归档 patch 后 type 仍恒等于 tags[0]', async () => {
    await dm.add(item('a', { tags: ['GitHub'], type: 'GitHub' }) as any);
    await dm.update('a', { tags: ['酒馆'] });
    expect(JSON.parse(vault.files.get(PATH)!)[0].type).toBe('酒馆');
    await dm.update('a', { pinned: true });
    await dm.update('a', { archived: true, archivedAt: '2026-09-19 08:00:00' });
    expect(JSON.parse(vault.files.get(PATH)!)[0].type).toBe('酒馆');
  });

  it('bulk 链：改名后触达条目 type 重算为 tags[0]；type===from 脏条目归位 tags[0]', async () => {
    await dm.add(item('a', { tags: ['酒馆', 'GitHub'], type: '酒馆' }) as any);
    // 历史脏数据（type 与 tags 失同步）直写盘上注入——add 收口后写链已产不出这种形态
    vault.files.set(PATH, JSON.stringify([
      item('a', { tags: ['酒馆', 'GitHub'], type: '酒馆' }),
      item('b', { tags: ['X'], type: '酒馆' }),
    ]));
    const moved = await dm.updateTagLabelBulk('酒馆', '小酒馆');
    expect(moved).toBe(2);
    const saved = JSON.parse(vault.files.get(PATH)!);
    expect(saved.find((d: any) => d.id === 'a')).toMatchObject({ tags: ['小酒馆', 'GitHub'], type: '小酒馆' });
    expect(saved.find((d: any) => d.id === 'b')).toMatchObject({ tags: ['X'], type: 'X' }); // 脏条目彻底归位（非半拉子 to）
  });
});

describe('AI 整理结果归一（func-5）', () => {
  it('无协议 url 补 https://（整理完即可存，不被保存校验拦截）', () => {
    expect(normalizeAiOrganizeResult({ url: 'example.com/x' }).url).toBe('https://example.com/x');
  });
  it('带协议 url 原样；空/缺 url 不产 https://', () => {
    expect(normalizeAiOrganizeResult({ url: 'http://a.b/c' }).url).toBe('http://a.b/c');
    expect(normalizeAiOrganizeResult({ url: '  ' }).url).toBe('');
    expect(normalizeAiOrganizeResult({}).url).toBe('');
  });
  it('tags 数组化：数组元素非串纠偏、空值剔除；单串收编单元素；tags 数字串收编', () => {
    expect(normalizeAiOrganizeResult({ tags: ['A', 42, null, ''] as any }).tags).toEqual(['A', '42']);
    expect(normalizeAiOrganizeResult({ tags: 'GitHub' }).tags).toEqual(['GitHub']);
    expect(normalizeAiOrganizeResult({ tags: 42 as any }).tags).toEqual(['42']);
    expect(normalizeAiOrganizeResult({}).tags).toEqual([]);
  });
  it('title/description 非串 String 纠偏，null/缺回落空串', () => {
    expect(normalizeAiOrganizeResult({ title: 123, description: null } as any)).toMatchObject({ title: '123', description: '' });
  });
});

describe('域事件五 kind 端到端契约锁（arch-2）', () => {
  /** 发射侧：ui.ts emitDomainEvent('favorites', { kind: '...' }) 字面量集合（同一 kind 多处发射去重） */
  function emittedKinds(): string[] {
    const src = repo('src/favorites/ui.ts');
    const re = /emitDomainEvent\(\s*'favorites'\s*,\s*\{\s*kind:\s*'([a-z]+)'/g;
    return [...new Set([...src.matchAll(re)].map((m) => m[1]))].sort();
  }
  /** 消费侧：smartcat FavoritesActionEvent 联合类型 kind 字面量集合 */
  function consumedKinds(): string[] {
    const src = repo('src/smartcat/favorites-source.ts');
    const re = /\{\s*kind:\s*'([a-z]+)';/g;
    return [...new Set([...src.matchAll(re)].map((m) => m[1]))].sort();
  }

  it('发射侧 kind 集合与 FavoritesActionEvent 消费侧对账恒等（双侧手抄防漂移）', () => {
    const emit = emittedKinds();
    const consume = consumedKinds();
    expect(emit.length).toBeGreaterThan(0); // 防正则失配空集对空集假绿
    expect(consume.length).toBeGreaterThan(0);
    expect(emit).toEqual(consume);
  });

  it('六 kind 精确集合钉死（add/edit/delete/restored/archive/unarchive）——新增 kind 须双侧同步并更新本断言', () => {
    // restored = func-2（深审批 B）：删除撤销补发领域事件（与归档撤销补 unarchive 同制）
    expect(consumedKinds()).toEqual(['add', 'archive', 'delete', 'edit', 'restored', 'unarchive']);
    expect(emittedKinds()).toEqual(['add', 'archive', 'delete', 'edit', 'restored', 'unarchive']);
  });
});

describe('DataManager 双实例路径语义（arch-4 现状安全面）', () => {
  let vault: MockVault;
  let state: Record<string, unknown>;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    state = { storagePath: 'CONFIG/STORAGE' };
    setSettingsProvider(() => state as any);
  });

  it('同 storagePath 下主面板固化形态与标签管理现构造形态 filePath 恒等（现状安全面）', () => {
    const mainDm = new DataManager(getStoragePath(state.storagePath as string)); // app.init 形态
    const tagMgrDm = new DataManager(getStoragePath(state.storagePath as string)); // ui tagManagerDm 形态
    expect(tagMgrDm.filePath).toBe(mainDm.filePath);
  });

  it('主面板固化实例不随运行中设置变更漂移（storagePath 变更需重载插件，ADR-0009 口径；批 B 已收口 tagManagerDm 与此同源）', async () => {
    const mainDm = new DataManager(getStoragePath('CONFIG/STORAGE'));
    state.storagePath = '我的/数据';
    expect(mainDm.filePath).toBe('CONFIG/STORAGE/favorites.json'); // 固化语义：运行中变更不热切换
    // 原「现状漂移面」（tagManagerDm 现构造定位新路径）已由深审批 B 收口：ui.tagManagerDm
    // 改取 FavoritesApp.getInstance().dataManager 与主面板同实例——恒等断言见
    // tests/favorites/fav-view-fix.test.ts「arch-4 收口恒等」组；此处保留 getStoragePath 纯函数行为锚
    expect(getStoragePath('我的/数据')).toBe('我的/数据/favorites.json');
  });
});

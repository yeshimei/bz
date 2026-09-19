// @vitest-environment node
/**
 * 收藏本 DataManager 测试（ticket 11）：CRUD + 排序。
 * issue 363 修订：标签定义 data.json 设置键 favoriteTags 读写 / seed 回退 / 旧伴生文件
 * favorites.tags.json 一次性迁移（幂等）+ 改名/删除条目批量跟随（updateTagLabelBulk）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { DataManager } from '../../src/favorites/data';
import { getStorageDir, getStoragePath, isUrlLike, DEFAULT_TAGS, getTags, resetTagsState, normalizeTags } from '../../src/favorites/config';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

describe('DataManager', () => {
  let vault: MockVault;
  let dm: DataManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    dm = new DataManager('CONFIG/STORAGE/favorites.json');
  });

  it('空库读取 → [] + 自动建文件', async () => {
    const data = await dm.getAll();
    expect(data).toEqual([]);
    expect(vault.files.has('CONFIG/STORAGE/favorites.json')).toBe(true);
  });

  it('add → unshift 到最前', async () => {
    await dm.add({ id: '1', tags: ['GitHub'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-01 00:00:00', type: 'GitHub' } as any);
    await dm.add({ id: '2', tags: ['网站'], title: 'B', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-02 00:00:00', type: '网站' } as any);
    const data = await dm.getAll();
    expect(data.map((d) => d.id)).toEqual(['2', '1']);
  });

  it('update → 合并字段并落盘', async () => {
    await dm.add({ id: '1', tags: ['GitHub'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-01 00:00:00', type: 'GitHub' } as any);
    await dm.update('1', { pinned: true, title: 'A2' });
    const data = await dm.getAll();
    expect(data[0].pinned).toBe(true);
    expect(data[0].title).toBe('A2');
    expect(data[0].type).toBe('GitHub'); // 未更新的字段保留
  });

  it('delete → 移除', async () => {
    await dm.add({ id: '1', tags: [], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '' } as any);
    await dm.add({ id: '2', tags: [], title: 'B', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '' } as any);
    await dm.delete('1');
    expect((await dm.getAll()).map((d) => d.id)).toEqual(['2']);
  });

  it('restoreItem（ticket 141 通病 1）：删除后撤销，完整条目原样插回', async () => {
    const item = {
      id: '1', tags: ['GitHub'], title: 'A', description: '简介', pinned: true,
      url: 'https://github.com/a/b', balance: '9.9', balanceCacheTime: 123, balanceError: null,
      linkedNote: '笔记.md', created: '2025-06-01 08:00:00', type: 'GitHub',
      llmConfig: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
      archived: false,
    };
    await dm.add(item as any);
    await dm.delete('1');
    expect(await dm.getAll()).toEqual([]);

    await dm.restoreItem(item as any);
    const data = await dm.getAll();
    expect(data.length).toBe(1);
    expect(data[0]).toEqual(item as any); // 全字段原样（含 llmConfig/pinned/balance，不走 add 重置）
  });

  it('restoreItem：同 id 已存在 → 幂等跳过不重复插入', async () => {
    const item = { id: '1', tags: [], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '' } as any;
    await dm.add(item);
    await dm.restoreItem(item); // 并发写回场景：同 id 已存在
    const data = await dm.getAll();
    expect(data.length).toBe(1);
  });

  it('13 字段落盘格式', async () => {
    const item = {
      id: '1234567890', tags: ['GitHub'], title: 'T', description: 'D', pinned: true,
      url: 'https://github.com/a/b', balance: '10.5', balanceCacheTime: 123456, balanceError: null,
      linkedNote: '笔记.md', created: '2025-06-01 08:00:00', type: 'GitHub',
      llmConfig: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
    };
    await dm.add(item as any);
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(saved[0]).toEqual(item);
    expect(Object.keys(saved[0]).length).toBe(13); // 12 必选字段 + llmConfig
  });

  it('归档字段（ticket 140）：旧格式零迁移可读；归档 update 为加法扩展', async () => {
    await dm.add({ id: '1', tags: ['GitHub'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '2025-01-01 00:00:00', type: 'GitHub' } as any);
    // 旧数据（无 archived 字段）原样读回 = 未归档
    expect((await dm.getAll())[0].archived).toBeUndefined();

    await dm.update('1', { archived: true, archivedAt: '2026-08-30 10:00:00' });
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(saved[0].archived).toBe(true);
    expect(saved[0].archivedAt).toBe('2026-08-30 10:00:00');
    expect(Object.keys(saved[0]).length).toBe(14); // 12 基准字段（无 llmConfig）+ archived + archivedAt

    // 未归档条目不携带归档字段（写路径不加字段，兼容性最小扰动）
    await dm.add({ id: '2', tags: [], title: 'B', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '' } as any);
    const saved2 = JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(Object.keys(saved2[0]).length).toBe(12); // unshift 在前 = 新条目 B（12 基准字段，无归档键）
    expect(saved2[1].archived).toBe(true); // 已归档条目不受第二次写入影响
  });
});

describe('存储路径解析（文件名固定 favorites.json）', () => {
  it('目录设置 → 拼接固定文件名', () => {
    expect(getStoragePath('我的/数据')).toBe('我的/数据/favorites.json');
    expect(getStoragePath('我的/数据/')).toBe('我的/数据/favorites.json');
  });
  it('未设置 → 默认目录', () => {
    expect(getStoragePath(undefined)).toBe('CONFIG/STORAGE/favorites.json');
  });
  it('兼容旧值：完整文件路径 → 取目录', () => {
    expect(getStoragePath('CONFIG/STORAGE/favorites.json')).toBe('CONFIG/STORAGE/favorites.json');
    expect(getStoragePath('我的/数据/fav.json')).toBe('我的/数据/favorites.json');
  });
  it('文件名不可改：自定义 fav.json 一律落 favorites.json', () => {
    const dir = getStorageDir('我的/数据/fav.json');
    expect(dir).toBe('我的/数据');
  });
});

describe('标签定义 data.json 设置键 favoriteTags（issue 363 修订）', () => {
  let vault: MockVault;
  let dm: DataManager;
  let state: Record<string, unknown>;
  let saves: number;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    state = {};
    saves = 0;
    setSettingsProvider(() => state as any);
    setSettingsSaver(async () => { saves++; });
    dm = new DataManager('CONFIG/STORAGE/favorites.json');
    resetTagsState();
  });

  it('loadTags：设置键缺失 → 回退内置 9 类 seed（不写键不落盘，首次改动才落盘）', async () => {
    const tags = await dm.loadTags();
    expect(tags.map((t) => t.label)).toEqual(['GitHub', '桌面软件', '网站', '大模型', 'pi', 'Claude', 'skills', '酒馆', 'DeepSeek Harness']);
    expect(tags.every((t) => t.id && t.ic)).toBe(true);
    expect(getTags()).toBe(tags); // config 单源生效
    expect(state.favoriteTags).toBeUndefined(); // seed 回退不写键
    expect(saves).toBe(0);
    expect(vault.files.has('CONFIG/STORAGE/favorites.tags.json')).toBe(false);
  });

  it('saveTags：写设置键 + saveSettings 持久化 + 运行时即时生效；重载后自键重播种', async () => {
    const next = [{ id: 't1', label: '育儿', ic: 'heart' }, { id: 'web', label: '网站', ic: 'globe' }];
    await dm.saveTags(next);
    expect(state.favoriteTags).toEqual(next); // 落 data.json 设置键（不再写伴生文件）
    expect(saves).toBe(1);
    expect(getTags().map((t) => t.label)).toEqual(['育儿', '网站']);
    expect(vault.files.has('CONFIG/STORAGE/favorites.tags.json')).toBe(false);
    // 模拟插件重载：运行时集清空，getTags 自设置键重播种（设置键即真理）
    resetTagsState();
    expect(getTags().map((t) => t.label)).toEqual(['育儿', '网站']);
  });

  it('一次性迁移：旧伴生文件非空 → 内容迁入设置键并落盘 + 旧文件进系统回收站', async () => {
    const legacy = [{ id: 't1', label: '育儿', ic: 'heart' }, { id: 'github', label: 'GitHub', ic: 'github' }];
    vault.files.set('CONFIG/STORAGE/favorites.tags.json', JSON.stringify(legacy));
    const tags = await dm.loadTags();
    expect(state.favoriteTags).toEqual(legacy); // 迁入 data.json 键
    expect(saves).toBe(1);
    expect(tags.map((t) => t.id)).toEqual(['t1', 'github']);
    expect(vault.files.has('CONFIG/STORAGE/favorites.tags.json')).toBe(false); // 旧文件退役
    const trashRec = vault.trashed.find((t) => t.path === 'CONFIG/STORAGE/favorites.tags.json');
    expect(trashRec?.system).toBe(true); // 系统回收站，可反悔
  });

  it('迁移幂等：旧文件不存在 → 直接跳过（不写键不落盘不删文件）', async () => {
    await dm.loadTags();
    await dm.loadTags();
    expect(saves).toBe(0);
    expect(state.favoriteTags).toBeUndefined();
    expect(vault.trashed).toHaveLength(0);
  });

  it('迁移不回写：设置键已有自定义值（新真源更新）→ 保留键值只退役旧文件', async () => {
    state.favoriteTags = [{ id: 't9', label: '新真源', ic: 'star' }];
    vault.files.set('CONFIG/STORAGE/favorites.tags.json', JSON.stringify([{ id: 't1', label: '旧件值', ic: 'heart' }]));
    const tags = await dm.loadTags();
    expect(state.favoriteTags).toEqual([{ id: 't9', label: '新真源', ic: 'star' }]); // 新值不被旧件覆盖
    expect(saves).toBe(0);
    expect(tags.map((t) => t.label)).toEqual(['新真源']);
    expect(vault.files.has('CONFIG/STORAGE/favorites.tags.json')).toBe(false);
  });

  it('迁移空/坏旧件：空数组或坏 JSON 不迁（seed 回退），旧文件仍退役删除', async () => {
    vault.files.set('CONFIG/STORAGE/favorites.tags.json', '[]');
    expect((await dm.loadTags()).length).toBe(DEFAULT_TAGS.length);
    expect(state.favoriteTags).toBeUndefined();
    expect(vault.files.has('CONFIG/STORAGE/favorites.tags.json')).toBe(false);
    // 坏 JSON：jsonStore 原文件留档 CONFIG/.CORRUPT 后降级 []，同样只退役不迁
    resetTagsState();
    vault.files.set('CONFIG/STORAGE/favorites.tags.json', '{oops');
    expect((await dm.loadTags()).length).toBe(DEFAULT_TAGS.length);
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.CORRUPT/'))).toBe(true);
    expect(vault.files.has('CONFIG/STORAGE/favorites.tags.json')).toBe(false);
  });

  it('坏键回退：设置键非数组/空数组/全坏行 → seed 回退；部分有效行归一化生效且不改写键', async () => {
    state.favoriteTags = 'nope';
    expect(getTags()).toEqual(DEFAULT_TAGS);
    resetTagsState();
    state.favoriteTags = [];
    expect(getTags().length).toBe(DEFAULT_TAGS.length);
    resetTagsState();
    state.favoriteTags = [null, 42, { label: '  ' }, { label: '有效', ic: 'star' }];
    expect(getTags().map((t) => t.label)).toEqual(['有效']);
    expect(state.favoriteTags).toEqual([null, 42, { label: '  ' }, { label: '有效', ic: 'star' }]); // 坏键只读时回退，不主动改写
    expect(saves).toBe(0);
  });

  it('favorites.json 本体不动：迁移只碰旧伴生文件，favorites.json 不建不改', async () => {
    const dm2 = new DataManager('我的/数据/favorites.json');
    vault.files.set('我的/数据/favorites.tags.json', JSON.stringify([{ id: 'x', label: '装修灵感', ic: 'heart' }]));
    const tags = await dm2.loadTags();
    expect(tags.map((t) => t.label)).toEqual(['装修灵感']); // 旧文件在自定义目录也随 storagePath 定位
    expect(vault.files.has('我的/数据/favorites.tags.json')).toBe(false);
    expect(vault.files.has('我的/数据/favorites.json')).toBe(false); // 顶层纯数组契约零扰动
  });

  it('updateTagLabelBulk：条目 tags[] 与 type 批量跟随（updateSceneBulk 范式），返回迁移条数', async () => {
    await dm.add({ id: '1', tags: ['酒馆', 'GitHub'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '酒馆' } as any);
    await dm.add({ id: '2', tags: ['酒馆'], title: 'B', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '酒馆' } as any);
    await dm.add({ id: '3', tags: ['网站'], title: 'C', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '网站' } as any);

    const moved = await dm.updateTagLabelBulk('酒馆', '小酒馆');
    expect(moved).toBe(2);
    const data = await dm.getAll();
    expect(data.find((d) => d.id === '1')).toMatchObject({ tags: ['小酒馆', 'GitHub'], type: '小酒馆' });
    expect(data.find((d) => d.id === '2')).toMatchObject({ tags: ['小酒馆'], type: '小酒馆' });
    expect(data.find((d) => d.id === '3')).toMatchObject({ tags: ['网站'], type: '网站' }); // 无关条目不动
  });

  it('updateTagLabelBulk：零匹配返回 0 且不写盘；空名/同名幂等返回 0', async () => {
    await dm.add({ id: '1', tags: ['网站'], title: 'A', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '网站' } as any);
    const before = vault.files.get('CONFIG/STORAGE/favorites.json')!;
    expect(await dm.updateTagLabelBulk('不存在', '随便')).toBe(0);
    expect(await dm.updateTagLabelBulk('网站', '网站')).toBe(0);
    expect(await dm.updateTagLabelBulk('', 'x')).toBe(0);
    expect(vault.files.get('CONFIG/STORAGE/favorites.json')).toBe(before);
  });

  it('normalizeTags：非数组 → []；缺 id 补、缺 ic 回落 tag、名称去空白', () => {
    expect(normalizeTags('nope')).toEqual([]);
    const out = normalizeTags([{ label: ' A ' }, { id: 'k', label: 'B' }, { id: '', label: 'C', ic: '' }]);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ label: 'A', ic: 'tag' });
    expect(out[0].id).toBeTruthy();
    expect(out[1]).toMatchObject({ id: 'k', label: 'B', ic: 'tag' });
    expect(out[2].label).toBe('C');
    expect(out[2].ic).toBe('tag');
  });
});

describe('isUrlLike（ticket 188 贴链自动搬家判定）', () => {
  it('http(s):// 与 www. 开头 = URL 形态', () => {
    expect(isUrlLike('https://github.com/a/b')).toBe(true);
    expect(isUrlLike('http://example.com')).toBe(true);
    expect(isUrlLike('https://example.com')).toBe(true);
    expect(isUrlLike('www.example.com')).toBe(true);
    expect(isUrlLike('WWW.Example.COM/path')).toBe(true);
  });
  it('普通文本 / 带空白 / 空串 = 非 URL 形态', () => {
    expect(isUrlLike('一篇好文章')).toBe(false);
    expect(isUrlLike('see https://a.com and b.com')).toBe(false);
    expect(isUrlLike('')).toBe(false);
    expect(isUrlLike('   ')).toBe(false);
    expect(isUrlLike('github.com/a/b')).toBe(false); // 无协议头且非 www.：不搬家（读侧 normalizeItems 归一补协议；写侧保存链路归深审批 B）
  });
});


describe('审查修复批（issue 363）：标签链路健壮性', () => {
  it('newTagId：同一毫秒内连续调用不碰撞（序号后缀）', async () => {
    const { newTagId } = await import('../../src/favorites/config');
    const ids = Array.from({ length: 50 }, () => newTagId());
    expect(new Set(ids).size).toBe(50);
  });

  it('normalizeTags：同批坏数据补 id 互不相同', async () => {
    const out = normalizeTags([{ label: '甲' }, { label: '乙' }, { label: '丙' }] as any);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((t) => t.id)).size).toBe(3);
  });

  it('hueOf：空标签名回落中性色相 210（不再恒红）', async () => {
    const { hueOf } = await import('../../src/favorites/shared');
    expect(hueOf('')).toBe(210);
    expect(hueOf('已删除的标签')).toBeGreaterThanOrEqual(0);
  });
});

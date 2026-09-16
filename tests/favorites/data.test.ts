// @vitest-environment node
/**
 * 收藏本 DataManager 测试（ticket 11）：CRUD + 排序。
 * issue 363：标签定义 favorites.tags.json 读写 + 改名/删除条目批量跟随（updateTagLabelBulk）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
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

describe('标签定义 favorites.tags.json（issue 363）', () => {
  let vault: MockVault;
  let dm: DataManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp(makeApp(vault));
    dm = new DataManager('CONFIG/STORAGE/favorites.json');
    resetTagsState();
  });

  it('loadTags：文件缺失 → 回退内置 9 类 seed（零迁移，不建文件不写盘）', async () => {
    const tags = await dm.loadTags();
    expect(tags.map((t) => t.label)).toEqual(['GitHub', '桌面软件', '网站', '大模型', 'pi', 'Claude', 'skills', '酒馆', 'DeepSeek Harness']);
    expect(tags.every((t) => t.id && t.ic)).toBe(true);
    expect(getTags()).toBe(tags); // config 单源注入生效
    expect(vault.files.has('CONFIG/STORAGE/favorites.tags.json')).toBe(false);
  });

  it('loadTags：文件在自定义目录也按 storagePath 定位（同 favorites.json 目录）', async () => {
    const dm2 = new DataManager('我的/数据/favorites.json');
    vault.files.set('我的/数据/favorites.tags.json', JSON.stringify([{ id: 'x', label: '装修灵感', ic: 'heart' }]));
    const tags = await dm2.loadTags();
    expect(tags.map((t) => t.label)).toEqual(['装修灵感']);
  });

  it('loadTags：文件为数组（含自定义标签）→ 定义生效且顺序保留', async () => {
    vault.files.set('CONFIG/STORAGE/favorites.tags.json', JSON.stringify([
      { id: 't1', label: '育儿', ic: 'heart' },
      { id: 'github', label: 'GitHub', ic: 'github' },
    ]));
    const tags = await dm.loadTags();
    expect(tags.map((t) => t.id)).toEqual(['t1', 'github']);
    expect(getTags().map((t) => t.label)).toEqual(['育儿', 'GitHub']);
  });

  it('loadTags：空数组 / 坏行 → seed 回退（坏 JSON 由 jsonStore 留档降级为 []，同路径）', async () => {
    vault.files.set('CONFIG/STORAGE/favorites.tags.json', '[]');
    expect((await dm.loadTags()).length).toBe(DEFAULT_TAGS.length);
    vault.files.set('CONFIG/STORAGE/favorites.tags.json', JSON.stringify([null, 42, { label: '  ' }, { label: '有效', ic: 'star' }]));
    const tags = await dm.loadTags();
    expect(tags.map((t) => t.label)).toEqual(['有效']);
  });

  it('saveTags：写盘（裸数组 JSON）+ config 单源即时生效', async () => {
    const next = [{ id: 't1', label: '育儿', ic: 'heart' }, { id: 'web', label: '网站', ic: 'globe' }];
    await dm.saveTags(next);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/favorites.tags.json')!)).toEqual(next);
    expect(getTags().map((t) => t.label)).toEqual(['育儿', '网站']);
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
    expect(isUrlLike('github.com/a/b')).toBe(false); // 无协议头且非 www.：不搬家（保存校验会补）
  });
});


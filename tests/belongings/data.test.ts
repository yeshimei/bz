/**
 * 归物本数据层测试（ticket 06）：8 字段零迁移、默认分类合并、
 * 解析失败警告、保存结构、纯函数数值断言。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadDatabase, saveDatabase, calculateDailyCost, calculateDaysUsed, calculateDaysUsedUntil, getDataFilePath } from '../../src/belongings/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';

function setup(vault: MockVault, settings: any = {}) {
  setApp({ vault } as any);
  setSettingsProvider(() => settings as any);
  resetObsidianMocks();
}

describe('loadDatabase', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('文件不存在 → 空数据库结构（version 1.0/items {}）+ 空历史分类 + 建文件（统一读写语义）', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const db = await loadDatabase();
    expect(db.version).toBe('1.0');
    expect(db.items).toEqual({});
    expect(db.categories).toEqual([]); // issue 231：内置预设退役，分类由历史物品派生
    expect(db.categoryIcons).toEqual({});
    expect(vault.files.has('CONFIG/STORAGE/belongings.json')).toBe(true); // 统一读写语义：缺失建文件
  });

  it('迁移（issue 231/ADR-0102）：emoji 前缀分类拆为纯文字 + icon；未映射/无 emoji/已有 icon 各归其位', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const item = (id: string, category: string, icon?: string) => ({
      id, name: '物' + id, category,
      purchase_price: 10, purchase_date: '2024-06-01',
      current_status: '使用中', description: '',
      created_date: '2024-06-01T10:00:00.000Z', last_updated: '2024-06-01T10:00:00.000Z',
      ...(icon !== undefined ? { icon } : {}),
    });
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify({
      version: '1.0', last_updated: '2025-01-01T00:00:00.000Z',
      items: {
        item_1: item('item_1', '📱 智能手机'),
        item_2: item('item_2', '🧿 护身符'),
        item_3: item('item_3', '键盘周边'),
        item_4: item('item_4', '💻 笔记本电脑', 'laptop'),
      },
    }));
    const db = await loadDatabase();
    expect(db.items['item_1']).toMatchObject({ category: '智能手机', icon: 'smartphone' });
    expect(db.items['item_2'].category).toBe('护身符'); // 未映射 emoji：剥前缀、不写 icon
    expect(db.items['item_2'].icon ?? null).toBeNull();
    expect(db.items['item_3'].category).toBe('键盘周边'); // 无 emoji：原样
    expect(db.items['item_4']).toMatchObject({ category: '笔记本电脑', icon: 'laptop' }); // 已有 icon 不覆写
  });

  it('历史分类派生（issue 231）：categories = 频次降序去重；categoryIcons = 分类 → 馆内首个 icon', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const item = (id: string, category: string, icon?: string) => ({
      id, name: '物' + id, category,
      purchase_price: 10, purchase_date: '2024-06-01',
      current_status: '使用中', description: '',
      created_date: '2024-06-01T10:00:00.000Z', last_updated: '2024-06-01T10:00:00.000Z',
      ...(icon !== undefined ? { icon } : {}),
    });
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify({
      version: '1.0', last_updated: '2025-01-01T00:00:00.000Z',
      items: {
        item_1: item('item_1', '📱 智能手机'),
        item_2: item('item_2', '智能手机', 'smartphone'),
        item_3: item('item_3', '机械键盘', 'keyboard'),
      },
    }));
    const db = await loadDatabase();
    expect(db.categories).toEqual(['智能手机', '机械键盘']); // 频次 2 > 1
    expect(db.categoryIcons).toEqual({ 智能手机: 'smartphone', 机械键盘: 'keyboard' });
  });

  it('解析失败 → 走 core 默认通知（含留档路径）+ 原样留档 CONFIG/.CORRUPT 重建 + 重置为空库', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const broken = '{broken';
    vault.files.set('CONFIG/STORAGE/belongings.json', broken);
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = await loadDatabase();
    expect(db.items).toEqual({});
    // 走查批 D：删自定义 onCorrupt → core 默认文案（含留档路径与「数据不会丢」承诺）
    expect(hasNotice(/解析失败，原内容已留档到 .+，数据不会丢/)).toBe(true);
    // D1 留档契约：原内容原样留档（不再直接覆盖丢失）
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/.CORRUPT/belongings.json.'));
    expect(backups).toHaveLength(1);
    expect(vault.files.get(backups[0])).toBe(broken);
    // 原路径重建空库
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!)).toEqual(
      expect.objectContaining({ version: '1.0', items: {} })
    );
    warnSpy.mockRestore();
  });

  it('合法空对象 {} → 视为空库不告警（修复前每次打开都弹解析失败警告）', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    vault.files.set('CONFIG/STORAGE/belongings.json', '{}');
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clearNotices();
    const db = await loadDatabase();
    expect(db.items).toEqual({});
    expect(db.categories).toEqual([]); // issue 231：预设退役，空库无历史分类
    expect(hasNotice(/解析失败|结构异常/)).toBe(false);
    warnSpy.mockRestore();
  });

  it('P2 形状容错：内容为数组/null 字面量 → 「结构异常」警告 + 重置空库（非对象白屏防护）', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // 数组
    vault.files.set('CONFIG/STORAGE/belongings.json', '[{"id":"x"}]');
    let db = await loadDatabase();
    expect(db.items).toEqual({});
    expect(hasNotice('数据文件结构异常，已按空库继续，原文件未改动')).toBe(true);
    // null
    clearNotices();
    vault.files.set('CONFIG/STORAGE/belongings.json', 'null');
    db = await loadDatabase();
    expect(db.items).toEqual({});
    expect(hasNotice('数据文件结构异常，已按空库继续，原文件未改动')).toBe(true);
    warnSpy.mockRestore();
  });

  it('读取已有数据（issue 231 起载入迁移：emoji 分类 → 纯文字 + icon）', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const existing = {
      version: '1.0',
      last_updated: '2025-01-01T00:00:00.000Z',
      items: {
        item_1: {
          id: 'item_1',
          name: '机械键盘',
          category: '⌨ 机械键盘',
          purchase_price: 399,
          purchase_date: '2024-06-01',
          current_status: '使用中',
          description: '红轴',
          created_date: '2024-06-01T10:00:00.000Z',
          last_updated: '2024-06-01T10:00:00.000Z',
        },
      },
    };
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify(existing));
    const db = await loadDatabase();
    expect(db.items['item_1']).toMatchObject({
      name: '机械键盘',
      category: '机械键盘', // issue 231：emoji 前缀迁移为纯文字 + icon
      icon: 'keyboard',
      purchase_price: 399,
      current_status: '使用中',
    });
  });
});

describe('saveDatabase', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
  });

  it('保存结构：version/last_updated/items（无 categories 冗余）', async () => {
    const db = await loadDatabase();
    db.items['item_1'] = {
      id: 'item_1',
      name: '键盘',
      category: '⌨ 机械键盘',
      purchase_price: 399,
      purchase_date: '2024-06-01',
      current_status: '使用中',
      description: '',
      created_date: '2024-06-01T10:00:00.000Z',
      last_updated: '2024-06-01T10:00:00.000Z',
    };
    await saveDatabase(db);
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/belongings.json')!);
    expect(saved.version).toBe('1.0');
    expect(Object.keys(saved)).toEqual(['version', 'last_updated', 'items']);
    expect(saved.items['item_1'].name).toBe('键盘');
  });

  it('getDataFilePath：目录尾部斜杠去除', () => {
    setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE/' }) as any);
    expect(getDataFilePath()).toBe('CONFIG/STORAGE/belongings.json');
  });
});

describe('纯函数', () => {
  it('calculateDailyCost：价格/天数', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    // 30 天前买 300 元 → 10.00/天
    expect(calculateDailyCost(300, '2025-05-16T12:00:00')).toBe('10.00');
    // 当天买 → 返回全价
    expect(calculateDailyCost(100, '2025-06-15')).toBe('100.00');
    vi.useRealTimers();
  });

  it('calculateDaysUsed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    expect(calculateDaysUsed('2025-06-14T12:00:00')).toBe(1);
    expect(calculateDaysUsed('2025-05-16T12:00:00')).toBe(30);
    vi.useRealTimers();
  });

  it('P2 形状容错：无效日期 → 全价/0 天（不产出 NaN）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    expect(calculateDailyCost(300, '')).toBe('300.00');
    expect(calculateDaysUsed('')).toBe(0);
    vi.useRealTimers();
  });

  it('已用天数本地日历日口径：当天买 = 0 天（UTC 口径会多算一天——UTC+8 早 8 点前即触发）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    expect(calculateDaysUsed('2025-06-15')).toBe(0);
    expect(calculateDaysUsed('2025-06-15T00:30:00')).toBe(0);
    expect(calculateDaysUsed('2025-06-14')).toBe(1);
    // 跨时区确定：本地同一自然日内任意时刻都算 0 天
    vi.setSystemTime(new Date('2025-06-15T23:59:00'));
    expect(calculateDaysUsed('2025-06-15')).toBe(0);
    vi.useRealTimers();
  });

  it('calculateDaysUsedUntil（ticket 189 ADR-0089 出离封口）：endDate 缺省 = 今天口径；封口日期生效', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    // 缺省 endDate = 同 calculateDaysUsed
    expect(calculateDaysUsedUntil('2025-05-16T12:00:00')).toBe(30);
    expect(calculateDaysUsedUntil('2025-05-16T12:00:00', null)).toBe(30);
    // 封口在出离日：不再随「今天」增长
    expect(calculateDaysUsedUntil('2025-05-16T12:00:00', '2025-06-01')).toBe(16);
    expect(calculateDaysUsedUntil('2025-05-16', '2025-05-17')).toBe(1);
    // 出离日早于购买日（脏数据）= 0 天
    expect(calculateDaysUsedUntil('2025-06-10', '2025-06-01')).toBe(0);
    // 出离日无效 → 回落今天口径
    expect(calculateDaysUsedUntil('2025-05-16T12:00:00', 'not-a-date')).toBe(30);
    // 购买日无效 = 0
    expect(calculateDaysUsedUntil('', '2025-06-01')).toBe(0);
    vi.useRealTimers();
  });
});

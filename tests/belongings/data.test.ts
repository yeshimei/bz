/**
 * 归物本数据层测试（ticket 06）：8 字段零迁移、默认分类合并、
 * 解析失败警告、保存结构、纯函数数值断言。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadDatabase, saveDatabase, calculateDailyCost, calculateDaysUsed, getDataFilePath } from '../../src/belongings/data';
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

  it('文件不存在 → 空数据库结构（version 1.0/items {}）+ 默认分类 + 建文件（统一读写语义）', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const db = await loadDatabase();
    expect(db.version).toBe('1.0');
    expect(db.items).toEqual({});
    expect(db.categories.length).toBeGreaterThan(1000); // 1226 条默认分类
    expect(db.categories[0]).toBe('📱 智能手机');
    expect(db.categoryIcons['📱 智能手机']).toBe('📱');
    expect(vault.files.has('CONFIG/STORAGE/belongings.json')).toBe(true); // 统一读写语义：缺失建文件
  });

  it('分类固定为内置默认（自定义分类设置已移除）', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const db = await loadDatabase();
    expect(db.categories.includes('🎁 自定义分类')).toBe(false);
    expect(db.categories.filter((c) => c === '📱 智能手机').length).toBe(1);
  });

  it('解析失败 → 原文件改名留档重建 + 警告 Notice + 重置为空库', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const broken = '{broken';
    vault.files.set('CONFIG/STORAGE/belongings.json', broken);
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = await loadDatabase();
    expect(db.items).toEqual({});
    expect(hasNotice(/数据文件解析失败/)).toBe(true);
    // 统一读写语义：原内容改名留档（不再直接覆盖丢失）
    const backups = [...vault.files.keys()].filter((p) => p.startsWith('CONFIG/STORAGE/belongings.json.corrupt-'));
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
    expect(db.categories.length).toBeGreaterThan(1000); // 仍补齐默认分类
    expect(hasNotice(/数据文件解析失败/)).toBe(false);
    warnSpy.mockRestore();
  });

  it('P2 形状容错：内容为数组/null 字面量 → 警告 Notice + 重置空库（非对象白屏防护）', async () => {
    setup(vault, { belongingsDataFolder: 'CONFIG/STORAGE' });
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // 数组
    vault.files.set('CONFIG/STORAGE/belongings.json', '[{"id":"x"}]');
    let db = await loadDatabase();
    expect(db.items).toEqual({});
    expect(hasNotice(/数据文件解析失败/)).toBe(true);
    // null
    clearNotices();
    vault.files.set('CONFIG/STORAGE/belongings.json', 'null');
    db = await loadDatabase();
    expect(db.items).toEqual({});
    expect(hasNotice(/数据文件解析失败/)).toBe(true);
    warnSpy.mockRestore();
  });

  it('读取已有数据（8 字段零迁移保留）', async () => {
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
      category: '⌨ 机械键盘',
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
});

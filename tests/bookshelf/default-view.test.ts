// @vitest-environment node
/**
 * 书架墙默认视图接线 + 设置 schema 测试（issue 194）
 * - applyDefaultView：每次冷开读设置（openBookshelf/openReportView 两路径先调用），非法值回落；
 * - schema：目录 + 显示（默认筛选/默认排序）+ 移动端三组契约。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { M, resetBookshelfState, applyDefaultView } from '../../src/bookshelf/state';
import { bookshelfSettingsSchema } from '../../src/bookshelf/settings';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { setSettingsProvider } from '../../src/core/settings-provider';

describe('bookshelf applyDefaultView（issue 194）', () => {
  afterEach(() => {
    setSettingsProvider(() => ({} as any));
    resetBookshelfState();
  });

  it('未配置 → 全部筛选 + 最近阅读排序', () => {
    setSettingsProvider(() => ({} as any));
    applyDefaultView();
    expect(M.side).toBe('all');
    expect(M.sortMode).toBe('date');
  });

  it('合法配置生效（未读筛选 + 书名排序）', () => {
    setSettingsProvider(() => ({ bookshelfDefaultSide: 'unread', bookshelfSortMode: 'title' } as any));
    applyDefaultView();
    expect(M.side).toBe('unread');
    expect(M.sortMode).toBe('title');
  });

  it('非法值回落（未知 side 回 all、未知排序回 date）', () => {
    setSettingsProvider(() => ({ bookshelfDefaultSide: 'bogus', bookshelfSortMode: 'size' } as any));
    applyDefaultView();
    expect(M.side).toBe('all');
    expect(M.sortMode).toBe('date');
  });
});

describe('bookshelf 设置 schema（issue 194）', () => {
  it('组序：目录 → 显示 → 移动端；显示组四行键与选项集契约（issue 208 网格列数、issue 216 面板皮肤）', () => {
    const schema = bookshelfSettingsSchema();
    expect(schema.groups.map((g) => g.name)).toEqual(['目录', '显示', '移动端']);
    const view = schema.groups[1];
    expect(view.rows).toHaveLength(4);
    const [skin, side, sort] = view.rows as any[];
    // 面板皮肤（issue 216）：choiceCards 十选一，默认雪松白，onChange 热切换
    expect(skin.type).toBe('choiceCards');
    expect(skin.name).toBe('面板皮肤');
    expect(skin.binding).toMatchObject({ key: 'bookshelfSkin' });
    expect(skin.options.map((o: any) => o.value)).toEqual(
      ['nordic', 'dark', 'noir', 'wabi', 'bauhaus', 'blueprint', 'neon', 'kraft', 'velvet', 'mono'],
    );
    expect(skin.options.every((o: any) => typeof o.prevClass === 'string')).toBe(true);
    expect(typeof skin.onChange).toBe('function');
    expect(side.type).toBe('select');
    expect(side.name).toBe('默认筛选');
    expect(side.binding).toMatchObject({ key: 'bookshelfDefaultSide' });
    expect(side.options.map((o: any) => o.value)).toEqual(['all', 'reading', 'unread', 'done']);
    expect(sort.type).toBe('select');
    expect(sort.name).toBe('默认排序');
    expect(sort.binding).toMatchObject({ key: 'bookshelfSortMode' });
    expect(sort.options.map((o: any) => o.value)).toEqual(['date', 'title', 'author', 'progress']);
    // 网格每行列数（issue 208）：number 行 + string 键数字绑定，钳制 2~12，默认 6
    const grid = view.rows[3] as any;
    expect(grid.type).toBe('number');
    expect(grid.name).toBe('网格每行列数');
    expect(grid.min).toBe(2);
    expect(grid.max).toBe(12);
    expect(grid.binding.get()).toBe(6);
    // 默认值与选项集一致
    expect(DEFAULT_SETTINGS.bookshelfDefaultSide).toBe('all');
    expect(DEFAULT_SETTINGS.bookshelfSortMode).toBe('date');
    expect(DEFAULT_SETTINGS.bookshelfGridColumns).toBe('6');
    expect(DEFAULT_SETTINGS.bookshelfSkin).toBe('nordic');
  });

  it('网格每行列数：默认 6；非法/非正数回退默认（issue 208）', () => {
    const schema = bookshelfSettingsSchema();
    const grid = schema.groups.find((g) => g.name === '显示')!.rows[3] as any;
    const store: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    setSettingsProvider(() => store as never);
    expect(grid.binding.get()).toBe(6);
    grid.binding.set(9);
    expect(store.bookshelfGridColumns).toBe('9');
    expect(grid.binding.get()).toBe(9);
    store.bookshelfGridColumns = 'abc';
    expect(grid.binding.get()).toBe(6); // 非法值回退默认
  });
});

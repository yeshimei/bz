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

  it('未配置 → 全部筛选 + 最近读完排序（issue 218 三档口径）', () => {
    setSettingsProvider(() => ({} as any));
    applyDefaultView();
    expect(M.side).toBe('all');
    expect(M.sortMode).toBe('recent');
  });

  it('合法配置生效（未读筛选 + 书名排序）；存量排序值零感知映射', () => {
    setSettingsProvider(() => ({ bookshelfDefaultSide: 'unread', bookshelfSortMode: 'title' } as any));
    applyDefaultView();
    expect(M.side).toBe('unread');
    expect(M.sortMode).toBe('title');
    // 存量值映射（issue 218）：date/author → recent、progress → time
    setSettingsProvider(() => ({ bookshelfSortMode: 'date' } as any));
    applyDefaultView();
    expect(M.sortMode).toBe('recent');
    setSettingsProvider(() => ({ bookshelfSortMode: 'progress' } as any));
    applyDefaultView();
    expect(M.sortMode).toBe('time');
  });

  it('非法值回落（未知 side 回 all、未知排序回 recent）', () => {
    setSettingsProvider(() => ({ bookshelfDefaultSide: 'bogus', bookshelfSortMode: 'size' } as any));
    applyDefaultView();
    expect(M.side).toBe('all');
    expect(M.sortMode).toBe('recent');
  });
});

describe('bookshelf 设置 schema（issue 194）', () => {
  it('组序：目录 → 显示 → 移动端；显示组三行键与选项集契约（issue 215 皮肤、issue 218 排序三档）', () => {
    const schema = bookshelfSettingsSchema();
    expect(schema.groups.map((g) => g.name)).toEqual(['目录', '显示', '移动端']);
    const view = schema.groups[1];
    expect(view.rows).toHaveLength(3);
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
    expect(sort.options.map((o: any) => o.value)).toEqual(['recent', 'time', 'title']);
    // 默认值与选项集一致
    expect(DEFAULT_SETTINGS.bookshelfDefaultSide).toBe('all');
    expect(DEFAULT_SETTINGS.bookshelfSortMode).toBe('date'); // 存量键值不迁移（applyDefaultView 零感知映射）
    expect(DEFAULT_SETTINGS.bookshelfSkin).toBe('nordic');
  });
});

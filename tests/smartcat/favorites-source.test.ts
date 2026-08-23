/**
 * 收藏本动作观察文案层（ticket 078）：文案构造纯函数全覆盖——
 * 添加键值式（分类（tags 顿号全列）/简介「…」/链接 url 原文/已置顶，有才加、未置顶不写）；
 * 编辑 α 变化列表（title/description/url/tags 参与比较，tags 数组 join 比较；pinned/created/id/type/llmConfig/balance* 不参与；
 * 全不变 → 空数组，文本省略变化列表）；删除仅标题；置顶字段仅加不列编辑。
 */
import { describe, it, expect } from 'vitest';
import {
  favoritesAddedText, favoritesEditChanges, favoritesEditedText, favoritesDeletedText, buildFavoritesActionText,
  type FavoritesActionEvent,
} from '../../src/smartcat/favorites-source';
import type { FavoritesItem } from '../../src/favorites/types';

/** 基线条目（13 字段齐全，对齐 favorites.json） */
const item = (p: Partial<FavoritesItem>): FavoritesItem => ({
  id: '1001', tags: ['GitHub', 'DeepSeek Harness'], title: 'TokenLedger',
  description: '面向DeepSeek Harness的中继站点', pinned: false,
  url: 'https://github.com/zh667/TokenLedger', balance: null, balanceCacheTime: null,
  balanceError: null, linkedNote: null, created: '2026-08-23 09:00:00', type: 'GitHub',
  ...p,
});

describe('favoritesAddedText（添加，键值式有才加）', () => {
  it('全字段 → 分类（顿号全列）→ 简介「…」→ 链接 url 原文（ticket 示例逐字）', () => {
    expect(favoritesAddedText(item({})))
      .toBe('你收藏了《TokenLedger》：分类（GitHub、DeepSeek Harness）、简介「面向DeepSeek Harness的中继站点」、链接 https://github.com/zh667/TokenLedger');
  });
  it('置顶 → 追加「已置顶」（仅 pinned=true；无简介无链接省略）（ticket 示例逐字）', () => {
    expect(favoritesAddedText(item({ title: 'dsh-pocket', url: '', description: '', pinned: true })))
      .toBe('你收藏了《dsh-pocket》：分类（GitHub、DeepSeek Harness）、已置顶');
    expect(favoritesAddedText(item({ pinned: true }))).toContain('已置顶');
    expect(favoritesAddedText(item({ pinned: false }))).not.toContain('已置顶');
  });
  it('无简介无链接 → 仅分类段', () => {
    expect(favoritesAddedText(item({ description: '', url: '' }))).toBe('你收藏了《TokenLedger》：分类（GitHub、DeepSeek Harness）');
  });
  it('仅标题（无分类/简介/链接/置顶）→ 无冒号追加', () => {
    expect(favoritesAddedText(item({ tags: [], description: '', url: '', pinned: false }))).toBe('你收藏了《TokenLedger》');
  });
});

describe('favoritesEditChanges（编辑 α 变化列表）', () => {
  it('各字段单独变化：标题/简介/链接（trim 比较）', () => {
    expect(favoritesEditChanges(item({ title: '旧标题' }), item({ title: '新标题' }))).toEqual(['改了标题']);
    expect(favoritesEditChanges(item({ description: '旧简介' }), item({ description: '新简介' }))).toEqual(['改了简介']);
    expect(favoritesEditChanges(item({ url: 'https://old.example' }), item({ url: 'https://new.example' }))).toEqual(['改了链接']);
    // 空白差异忽略（UI 已 trim）
    expect(favoritesEditChanges(item({ title: 'X' }), item({ title: '  X  ' }))).toEqual([]);
  });
  it('分类：tags 数组 join 比较——同内容换引用不列；内容变/顺序变 → 改了分类', () => {
    expect(favoritesEditChanges(item({ tags: ['GitHub', 'DeepSeek Harness'] }), item({ tags: ['GitHub', 'DeepSeek Harness'] }))).toEqual([]);
    expect(favoritesEditChanges(item({ tags: ['GitHub'] }), item({ tags: ['GitHub', '网站'] }))).toEqual(['改了分类']);
    expect(favoritesEditChanges(item({ tags: ['GitHub', '网站'] }), item({ tags: ['网站', 'GitHub'] }))).toEqual(['改了分类']);
  });
  it('多字段 → 顺序固定：标题→简介→链接→分类', () => {
    expect(favoritesEditChanges(item({ title: '旧', description: '旧简介', url: 'https://old.example', tags: ['GitHub'] }),
      item({ title: '新', description: '新简介', url: 'https://new.example', tags: ['GitHub', '网站'] })))
      .toEqual(['改了标题', '改了简介', '改了链接', '改了分类']);
  });
  it('全不变 → 空数组；置顶/created/id/type/llmConfig/balance 变化一律不参与', () => {
    const same = item({});
    expect(favoritesEditChanges(same, { ...same })).toEqual([]);
    // 仅置顶翻转 → 空数组（用户拍板：置顶变化不列）
    expect(favoritesEditChanges(item({ pinned: false }), item({ pinned: true }))).toEqual([]);
    // 系统/配置字段变化 → 空数组
    expect(favoritesEditChanges(item({ created: 'a', id: '1', type: 'GitHub' }),
      item({ created: 'b', id: '2', type: '网站', llmConfig: { apiKeys: 'sk', balanceUrl: 'u' }, balance: '9.9', balanceCacheTime: 1, balanceError: null })))
      .toEqual([]);
  });
});

describe('favoritesEditedText / favoritesDeletedText（文案组装）', () => {
  it('编辑带变化列表 → 顿号分隔；无变化 → 省略列表不带尾冒号', () => {
    expect(favoritesEditedText('TokenLedger', ['改了标题', '改了简介'])).toBe('你编辑了收藏《TokenLedger》：改了标题、改了简介');
    expect(favoritesEditedText('TokenLedger', [])).toBe('你编辑了收藏《TokenLedger》');
  });
  it('删除仅标题', () => {
    expect(favoritesDeletedText('TokenLedger')).toBe('你删除了收藏《TokenLedger》');
  });
});

describe('buildFavoritesActionText（事件 → 观察文本）', () => {
  it('add/edit/delete 全事件映射（本域所有事件均有观察，编辑空变化仍产出文本）', () => {
    const add: FavoritesActionEvent = { kind: 'add', item: item({ title: 'dsh-pocket', url: '', description: '', pinned: true }) };
    expect(buildFavoritesActionText(add)).toBe('你收藏了《dsh-pocket》：分类（GitHub、DeepSeek Harness）、已置顶');
    expect(buildFavoritesActionText({ kind: 'edit', title: 'TokenLedger', changes: ['改了简介'] })).toBe('你编辑了收藏《TokenLedger》：改了简介');
    expect(buildFavoritesActionText({ kind: 'edit', title: 'TokenLedger', changes: [] })).toBe('你编辑了收藏《TokenLedger》');
    expect(buildFavoritesActionText({ kind: 'delete', title: 'TokenLedger' })).toBe('你删除了收藏《TokenLedger》');
  });
});
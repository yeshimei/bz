// @vitest-environment node
/**
 * issue 346 一次性迁移测试（migrateRetiredFavoritesSortKey，src/settings.ts）：
 * 收藏本 toolbar 排序循环钮键退役——ADR-0083 重设计后循环钮已删，键全链零消费点
 * （打开面板的排序由 favoritesDefaultSort 承担），旧值不迁移直接丢。
 */
import { describe, it, expect } from 'vitest';
import { migrateRetiredFavoritesSortKey } from '../../src/settings';

describe('migrateRetiredFavoritesSortKey', () => {
  it('旧键存在 → 就地删除并返回 true（调用方据此落盘）', () => {
    const raw: Record<string, unknown> = { favoritesOpenFilter: '', favoritesSortKey: 'title' };
    expect(migrateRetiredFavoritesSortKey(raw)).toBe(true);
    expect('favoritesSortKey' in raw).toBe(false);
    expect(raw.favoritesOpenFilter).toBe(''); // 其余键不动
  });

  it('无旧键 → 不改动返回 false（幂等，C16 不重复落盘）', () => {
    expect(migrateRetiredFavoritesSortKey({ favoritesDefaultSort: 'new' })).toBe(false);
    expect(migrateRetiredFavoritesSortKey({})).toBe(false);
    expect(migrateRetiredFavoritesSortKey(null)).toBe(false);
    expect(migrateRetiredFavoritesSortKey(undefined)).toBe(false);
    expect(migrateRetiredFavoritesSortKey('字符串')).toBe(false);
  });
});

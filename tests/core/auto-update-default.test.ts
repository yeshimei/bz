// @vitest-environment jsdom
/**
 * 「自动更新」缺省翻牌（2026-10-30 用户拍板：缺省关 → 缺省开）。
 *
 * 三层缺一不可：
 *  1. DEFAULT_SETTINGS 改开（新库直接生效）；
 *  2. 老库 data.json 里躺着显式 `false` —— 合并默认值永远压不过它，得一次性迁移；
 *  3. 迁移只做一次（打过标记），此后用户自己关掉的保持关掉，不会被下次启动又打开。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, migrateAutoUpdateDefault } from '../../src/settings';

describe('自动更新缺省值', () => {
  it('缺省开', () => {
    expect(DEFAULT_SETTINGS.autoUpdate).toBe(true);
  });

  it('老库的显式 false 一次性翻成开，并打标记', () => {
    const raw: Record<string, unknown> = { autoUpdate: false };
    expect(migrateAutoUpdateDefault(raw)).toBe(true);
    expect(raw.autoUpdate).toBe(true);
    expect(raw.autoUpdateDefaultedOn).toBe(true);
  });

  it('迁过之后用户自己关掉的保持关（不会每次启动又打开）', () => {
    const raw: Record<string, unknown> = { autoUpdate: false, autoUpdateDefaultedOn: true };
    expect(migrateAutoUpdateDefault(raw)).toBe(false);
    expect(raw.autoUpdate).toBe(false);
  });

  it('没有设置对象（从未写过 data.json）→ 不动，交给 DEFAULT_SETTINGS', () => {
    expect(migrateAutoUpdateDefault(null)).toBe(false);
    expect(migrateAutoUpdateDefault(undefined)).toBe(false);
  });
});

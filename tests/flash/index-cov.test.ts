/**
 * 闪念域入口覆盖补测：ensureFlash 幂等初始化、openFlashReference / openFlashChat 通知。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ensureFlash, openFlashReference, openFlashChat } from '../../src/flash/index';
import { resetObsidianMocks, clearNotices, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';

describe('flash/index 入口', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    clearNotices();
  });

  it('ensureFlash 幂等：重复调用只初始化一次且不抛错', () => {
    expect(() => ensureFlash(null as any)).not.toThrow();
    expect(() => ensureFlash(null as any)).not.toThrow(); // 已初始化 → 早退分支
    expect(hasNotice(/闪念/)).toBe(false); // 初始化本身不弹通知
  });

  it('openFlashReference / openFlashChat：弹出迁移中通知', () => {
    openFlashReference(null as any);
    expect(hasNotice('「闪念」正在迁移中（ticket 18）')).toBe(true);
    openFlashChat(null as any);
    expect(hasNotice('「闪念」正在迁移中（ticket 18）')).toBe(true);
  });
});

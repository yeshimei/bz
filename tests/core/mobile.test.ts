/**
 * src/core/mobile.ts isMobileEnv（移动端环境判定）。
 * 「移动端默认全屏」特性已全链退役（相关 helper 与设置键均已删除），仅保留环境判定覆盖。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Platform as MockPlatform } from '../mock-obsidian-entry';
import { isMobileEnv } from '../../src/core/mobile';

afterEach(() => {
  MockPlatform.isMobile = false;
});

describe('isMobileEnv', () => {
  it('桌面端返回 false', () => {
    expect(isMobileEnv()).toBe(false);
  });

  it('移动端返回 true', () => {
    MockPlatform.isMobile = true;
    expect(isMobileEnv()).toBe(true);
  });
});

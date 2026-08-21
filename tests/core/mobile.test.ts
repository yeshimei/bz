/**
 * 移动端主窗口默认全屏（ticket 68，ADR-0019）：
 * src/core/mobile.ts helper 行为 + DEFAULT_SETTINGS 13 键默认值（行为保持映射：11 开 2 关）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Platform as MockPlatform } from '../mock-obsidian-entry';
import { isMobileEnv, applyMobileWindowFullscreen } from '../../src/core/mobile';
import { DEFAULT_SETTINGS } from '../../src/settings';

afterEach(() => {
  MockPlatform.isMobile = false;
});

describe('isMobileEnv / applyMobileWindowFullscreen（ticket 68）', () => {
  it('桌面端恒不挂类（设置开也不影响）', () => {
    expect(isMobileEnv()).toBe(false);
    const el = document.createElement('div');
    applyMobileWindowFullscreen(el, true);
    expect(el.classList.contains('bz-win-mfs')).toBe(false);
  });

  it('移动端：开 → 挂 bz-win-mfs；关 → 摘（常规卡）；重复调用幂等', () => {
    MockPlatform.isMobile = true;
    expect(isMobileEnv()).toBe(true);
    const el = document.createElement('div');
    applyMobileWindowFullscreen(el, true);
    expect(el.classList.contains('bz-win-mfs')).toBe(true);
    applyMobileWindowFullscreen(el, true);
    expect(el.classList.contains('bz-win-mfs')).toBe(true);
    applyMobileWindowFullscreen(el, false);
    expect(el.classList.contains('bz-win-mfs')).toBe(false);
    applyMobileWindowFullscreen(el, true);
    expect(el.classList.contains('bz-win-mfs')).toBe(true);
  });

  it('移动端：开关关 → 不挂类', () => {
    MockPlatform.isMobile = true;
    const el = document.createElement('div');
    applyMobileWindowFullscreen(el, false);
    expect(el.classList.contains('bz-win-mfs')).toBe(false);
  });

  it('空元素安全（null/undefined 不抛错）', () => {
    MockPlatform.isMobile = true;
    expect(() => applyMobileWindowFullscreen(null, true)).not.toThrow();
    expect(() => applyMobileWindowFullscreen(undefined, true)).not.toThrow();
  });
});

describe('DEFAULT_SETTINGS 移动端默认全屏默认值（行为保持映射，ticket 68）', () => {
  it('13 键存在且默认值 = 原移动端行为（11 开 2 关）', () => {
    const ON = ['diary', 'belongings', 'clipping', 'news', 'password', 'favorites', 'library', 'readingReport', 'movie', 'review', 'encrypt'];
    const OFF = ['memo', 'pomodoro'];
    for (const k of ON) {
      expect(DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe(true);
      expect(typeof DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe('boolean');
    }
    for (const k of OFF) {
      expect(DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe(false);
      expect(typeof DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe('boolean');
    }
    // 13 键一个不少（与已排除的做题家/入口页区分）
    const all = [...ON, ...OFF];
    expect(all).toHaveLength(13);
    for (const k of all) {
      expect(`${k}MobileDefaultFullscreen` in DEFAULT_SETTINGS).toBe(true);
    }
  });
});
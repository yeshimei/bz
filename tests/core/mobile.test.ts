/**
 * 移动端主窗口默认全屏（ticket 68，ADR-0019）：
 * src/core/mobile.ts helper 行为 + DEFAULT_SETTINGS 11 键默认值（行为保持映射：9 开 2 关；
 * 聚合讯/阅读报告不设独立键——跟随剪藏本/书库，2026-08 用户拍板）。
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
  it('11 键存在且默认值 = 原移动端行为（9 开 2 关）；聚合讯/阅读报告不设独立键（ADR-0087 movie 键由 cinema 取代）', () => {
    const ON = ['diary', 'belongings', 'clipping', 'password', 'favorites', 'library', 'cinema', 'review', 'encrypt'];
    const OFF = ['memo', 'pomodoro'];
    for (const k of ON) {
      expect(DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe(true);
      expect(typeof DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe('boolean');
    }
    for (const k of OFF) {
      expect(DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe(false);
      expect(typeof DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe('boolean');
    }
    // 聚合讯跟随剪藏本键、阅读报告跟随书库键（2026-08 用户拍板）：独立键已删除
    // （旧 data.json 残留值由接口收窄后自然忽略，不影响行为）
    expect('newsMobileDefaultFullscreen' in DEFAULT_SETTINGS).toBe(false);
    expect('readingReportMobileDefaultFullscreen' in DEFAULT_SETTINGS).toBe(false);
    // 11 键一个不少（与已排除的做题家/入口页区分）
    const all = [...ON, ...OFF];
    expect(all).toHaveLength(11);
    for (const k of all) {
      expect(`${k}MobileDefaultFullscreen` in DEFAULT_SETTINGS).toBe(true);
    }
  });
});
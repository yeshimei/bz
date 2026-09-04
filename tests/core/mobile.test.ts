/**
 * 移动端主窗口默认全屏（ticket 68，ADR-0019）：
 * src/core/mobile.ts helper 行为 + DEFAULT_SETTINGS 移动端默认全屏键默认值（行为保持映射：8 开 2 关；
 * 聚合讯/阅读报告不设独立键——跟随剪藏本/书架墙，2026-08 用户拍板）。
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
  it('8 键存在且默认值 = 原移动端行为（6 开 2 关）', () => {
    // 旧 library 键已随书库域退役删除：阅读报告跟随书架墙（bookshelf）键
    // 旧 clipping 键为旧剪藏域孤儿键（实际生效 = clipbook 键），enh-sweep-a 双删
    const ON = ['diary', 'belongings', 'favorites', 'cinema', 'review', 'encrypt']; // password 键随 ADR-0085 由 encrypt 键取代，死键已删
    const OFF = ['todo', 'pomodoro']; // memo 键随 ADR-0092 memo 域退役删除，待办用自有 todo 键
    for (const k of ON) {
      expect(DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe(true);
      expect(typeof DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe('boolean');
    }
    for (const k of OFF) {
      expect(DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe(false);
      expect(typeof DEFAULT_SETTINGS[`${k}MobileDefaultFullscreen`]).toBe('boolean');
    }
    // 聚合讯跟随剪藏本键、阅读报告跟随书架墙键（2026-08 用户拍板）：独立键已删除
    // （旧 data.json 残留值由接口收窄后自然忽略，不影响行为）
    expect('newsMobileDefaultFullscreen' in DEFAULT_SETTINGS).toBe(false);
    expect('readingReportMobileDefaultFullscreen' in DEFAULT_SETTINGS).toBe(false);
    // 旧书库键已随 library 域退役删除
    expect('libraryMobileDefaultFullscreen' in DEFAULT_SETTINGS).toBe(false);
    // 旧 clipping 孤儿键已随死键清理删除（实际生效 = clipbook 键）
    expect('clippingMobileDefaultFullscreen' in DEFAULT_SETTINGS).toBe(false);
    expect('clipbookMobileDefaultFullscreen' in DEFAULT_SETTINGS).toBe(true);
    // 8 键一个不少（password 键已随 ADR-0085 并入 encrypt 键）
    const all = [...ON, ...OFF];
    expect(all).toHaveLength(8);
    for (const k of all) {
      expect(`${k}MobileDefaultFullscreen` in DEFAULT_SETTINGS).toBe(true);
    }
  });
});
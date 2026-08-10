/**
 * 番茄钟设置测试（ticket 31）：settings 结构 + ⚙️ 设置弹窗（9 项/12 档/动态显隐/保存）+ 设置生效
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro } from '../../src/pomodoro';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { PRESETS, CUSTOM_PRESET_ID } from '../../src/pomodoro/config';

const T0 = new Date('2026-08-10T10:00:00').getTime();

function setup(settings: any = {}) {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  const saves: any[] = [];
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {
    saves.push({ ...settings });
  });
  return { app, vault, settings, saves };
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

/** 弹窗内按名称找设置项 */
function itemByName(name: string): any {
  return Array.from(document.querySelectorAll('#bz-settings-modal-popup .setting-item')).find(
    (it) => (it as HTMLElement).dataset.name === name
  );
}

describe('settings 结构', () => {
  it('DEFAULT_SETTINGS 含番茄钟 9 项（ticket 31 默认值包）', () => {
    const s = DEFAULT_SETTINGS as any;
    expect(s.pomodoroPreset).toBe('classic');
    expect(s.pomodoroWorkMin).toBe('25');
    expect(s.pomodoroShortBreakMin).toBe('5');
    expect(s.pomodoroLongBreakMin).toBe('15');
    expect(s.pomodoroLongBreakInterval).toBe('4');
    expect(s.pomodoroForceFocus).toBe(false);
    expect(s.pomodoroAutoCycle).toBe(false);
    expect(s.pomodoroAutoSkipBreak).toBe(false);
    expect(s.pomodoroSound).toBe(true);
  });

  it('PRESETS 11 预设（手册表）+ custom 标识', () => {
    expect(Object.keys(PRESETS)).toHaveLength(11);
    expect(PRESETS.classic).toEqual({ label: '经典标准', workMin: 25, shortBreakMin: 5, longBreakMin: 15 });
    expect(PRESETS.marathon).toEqual({ label: '马拉松式', workMin: 45, shortBreakMin: 15, longBreakMin: 30 });
    expect(PRESETS.intense).toEqual({ label: '高强度', workMin: 50, shortBreakMin: 5, longBreakMin: 15 });
    expect(CUSTOM_PRESET_ID).toBe('custom');
  });
});

describe('⚙️ 设置弹窗', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    setSettingsSaver(async () => {});
    document.body.innerHTML = '';
    unloadPomodoro();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    unloadPomodoro();
    vi.useRealTimers();
  });

  it('打开设置弹窗：9 个设置项', async () => {
    const settings = { ...DEFAULT_SETTINGS } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    el('pomodoro-btn-settings').click();
    expect(el('bz-settings-modal-popup')).not.toBeNull();
    expect(document.querySelectorAll('#bz-settings-modal-popup .setting-item').length).toBe(9);
    expect(itemByName('预设方案')).not.toBeUndefined();
    expect(itemByName('长休息间隔')).not.toBeUndefined();
    expect(itemByName('声音提醒')).not.toBeUndefined();
  });

  it('预设下拉 12 档（11 预设 + 自定义）', async () => {
    const settings = { ...DEFAULT_SETTINGS } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    el('pomodoro-btn-settings').click();
    const dd = itemByName('预设方案').__setting.controls[0];
    expect(Object.keys(dd.options)).toHaveLength(12);
    expect(dd.value).toBe('classic');
    expect(dd.options.flow).toContain('深度心流');
  });

  it('自定义时长动态显隐：classic 隐藏 / 切 custom 显示', async () => {
    const settings = { ...DEFAULT_SETTINGS } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    el('pomodoro-btn-settings').click();
    const workRow = itemByName('工作时长（分钟）');
    expect(workRow.classList.contains('bz-setting-hidden')).toBe(true); // classic 非自定义
    const dd = itemByName('预设方案').__setting.controls[0];
    dd.trigger(CUSTOM_PRESET_ID);
    expect(workRow.classList.contains('bz-setting-hidden')).toBe(false);
    expect(itemByName('短休息时长（分钟）').classList.contains('bz-setting-hidden')).toBe(false);
    expect(itemByName('长休息时长（分钟）').classList.contains('bz-setting-hidden')).toBe(false);
    // 保存通道触发
    dd.trigger('flow');
    expect(workRow.classList.contains('bz-setting-hidden')).toBe(true);
  });

  it('变更即保存：改长休息间隔 → settings 对象更新 + saveSettings 调用', async () => {
    const settings = { ...DEFAULT_SETTINGS } as any;
    const { app, saves } = setup(settings);
    await openPomodoro(app);
    el('pomodoro-btn-settings').click();
    const text = itemByName('长休息间隔').__setting.controls[0];
    text.trigger('3');
    expect(settings.pomodoroLongBreakInterval).toBe('3');
    expect(saves.length).toBe(1);
    // toggle 保存
    const toggle = itemByName('自动循环').__setting.controls[0];
    toggle.trigger(true);
    expect(settings.pomodoroAutoCycle).toBe(true);
    expect(saves.length).toBe(2);
  });
});

describe('设置生效', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadPomodoro();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => {
    unloadPomodoro();
    vi.useRealTimers();
  });

  it('预设生效：flow（50/10/25）→ 空闲显示 50:00，专注阶段文案 1/4', async () => {
    const settings = { ...DEFAULT_SETTINGS, pomodoroPreset: 'flow' } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    expect(el('pomodoro-time').textContent).toBe('50:00');
    el('pomodoro-btn-start').click();
    expect(el('pomodoro-phase').textContent).toContain('专注 1/4');
    el('pomodoro-btn-skip').click(); // 短休息用预设时长 10min
    expect(el('pomodoro-time').textContent).toBe('10:00');
  });

  it('自定义时长生效：custom 30/6/18 → 空闲 30:00、跳过进 06:00 短休', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      pomodoroPreset: CUSTOM_PRESET_ID,
      pomodoroWorkMin: '30',
      pomodoroShortBreakMin: '6',
      pomodoroLongBreakMin: '18',
    } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    expect(el('pomodoro-time').textContent).toBe('30:00');
    el('pomodoro-btn-start').click();
    el('pomodoro-btn-skip').click();
    expect(el('pomodoro-time').textContent).toBe('06:00');
  });

  it('长休息间隔 N 生效：N=2 → 阶段文案 1/2', async () => {
    const settings = { ...DEFAULT_SETTINGS, pomodoroLongBreakInterval: '2' } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    expect(el('pomodoro-phase').textContent).toContain('专注 1/2');
  });

  it('autoCycle 生效：专注完成自动开始短休', async () => {
    const settings = { ...DEFAULT_SETTINGS, pomodoroAutoCycle: true } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    expect(el('pomodoro-phase').textContent).toContain('短休息');
    expect(el('pomodoro-btn-start').textContent).toContain('暂停'); // 自动开始中
  });

  it('autoSkipBreak 生效：专注完成直接开始下一专注', async () => {
    const settings = { ...DEFAULT_SETTINGS, pomodoroAutoSkipBreak: true } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    el('pomodoro-btn-start').click();
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);
    expect(el('pomodoro-phase').textContent).toContain('专注 2/4');
    expect(el('pomodoro-btn-start').textContent).toContain('暂停');
  });

  it('非法预设 id / 非数字时长 → 回退默认（25/5/15、N=4）', async () => {
    const settings = { ...DEFAULT_SETTINGS, pomodoroPreset: 'no-such', pomodoroWorkMin: 'abc' } as any;
    const { app } = setup(settings);
    await openPomodoro(app);
    expect(el('pomodoro-time').textContent).toBe('25:00');
    el('pomodoro-btn-start').click();
    expect(el('pomodoro-phase').textContent).toContain('专注 1/4');
  });

  it('重启保留：settings 默认值合并（data.json 持久化由插件机制）', async () => {
    const merged = { ...DEFAULT_SETTINGS, pomodoroPreset: 'marathon' };
    expect(merged.pomodoroPreset).toBe('marathon');
    expect(merged.pomodoroSound).toBe(true);
  });
});

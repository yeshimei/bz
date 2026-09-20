/**
 * 番茄钟深审拍板修复批回归（Wave1 bd-pomodoro 批）：
 * 呈报#63-PM2「停止专注」一词三义拆分——命令面板文案改「开始/重置专注」（重置语义），
 * 与首页菜单「停止专注」= 暂停、面板「暂停/重置」两颗钮用词分开（命令 name 见 src/main.ts）；
 * 呈报#49-PM3 统计档位跨重启记忆——偏好落插件设置键 pomodoroStatMode（最小面：挂设置键，
 * 不动 pomodoro.json 数据结构），卸载只回内存默认，重开按设置键装回上次档位。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { makeApp } from '../helpers/app';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { openPomodoro, unloadPomodoro } from '../../src/pomodoro';
import { unmountPomodoroStatusBar } from '../../src/pomodoro/statusbar';

const T0 = new Date('2026-08-10T10:00:00').getTime();

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

beforeEach(() => {
  resetObsidianMocks();
  setApp(null as any);
  setSettingsProvider(() => ({}) as any);
  setSettingsSaver(async () => {});
  document.body.innerHTML = '';
  unloadPomodoro();
  unmountPomodoroStatusBar();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(T0));
});

afterEach(() => {
  unloadPomodoro();
  unmountPomodoroStatusBar();
  vi.useRealTimers();
});

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, settings };
}

describe('呈报#63-PM2：「停止专注」一词三义拆分（命令=重置）', () => {
  it('命令表 name 改「开始/重置专注」，旧词「开始/停止专注」不再出现（id 不动）', () => {
    const mainSrc = readFileSync(resolve(__dirname, '../../src/main.ts'), 'utf8');
    expect(mainSrc).toContain("name: '开始/重置专注'");
    expect(mainSrc).not.toContain('开始/停止专注');
    // 命令 id 三段式不动（本批铁律：不新增不修改命令 ID）
    expect(mainSrc).toContain("id: 'bz-pomodoro-focus-toggle'");
  });
});

describe('呈报#49-PM3：统计档位跨重启记忆（落点：插件设置键 pomodoroStatMode）', () => {
  it('切「近 6 月」：偏好回写设置键并触发保存（修复前只在内存，重启即丢）', async () => {
    const settings: any = {};
    const saver = vi.fn(async () => {});
    setSettingsSaver(saver);
    const { app } = setup(new MockVault(), settings);
    await openPomodoro(app);
    expect(el('pomodoro-stat-tab-week').classList.contains('pomodoro-stat-tab-on')).toBe(true);
    el('pomodoro-stat-tab-month').click();
    expect(settings.pomodoroStatMode).toBe('month');
    expect(saver).toHaveBeenCalled();
  });

  it('重启后重开：按设置键直接落上次档位（月档高亮、月柱可见）', async () => {
    const { app } = setup(new MockVault(), { pomodoroStatMode: 'month' });
    await openPomodoro(app);
    expect(el('pomodoro-stat-tab-month').classList.contains('pomodoro-stat-tab-on')).toBe(true);
    expect(el('pomodoro-week').hidden).toBe(true);
    expect(el('pomodoro-months').hidden).toBe(false);
    const bars = [...el('pomodoro-months').querySelectorAll('.pomodoro-stat-day')] as HTMLElement[];
    expect(bars).toHaveLength(6); // 近 6 月趋势照常渲染，不是空白
  });

  it('卸载只回内存默认：unload 后重开按设置键装回，键值随之更新', async () => {
    const settings: any = { pomodoroStatMode: 'month' };
    const { app } = setup(new MockVault(), settings);
    await openPomodoro(app);
    expect(el('pomodoro-stat-tab-month').classList.contains('pomodoro-stat-tab-on')).toBe(true);
    el('pomodoro-stat-tab-week').click(); // 改回周档：设置键同步回写
    expect(settings.pomodoroStatMode).toBe('week');
    unloadPomodoro();
    // 卸载后重开：内存默认被卸载复位，重开按设置键装回 week
    await openPomodoro(app);
    expect(el('pomodoro-stat-tab-week').classList.contains('pomodoro-stat-tab-on')).toBe(true);
    expect(el('pomodoro-months').hidden).toBe(true);
  });
});

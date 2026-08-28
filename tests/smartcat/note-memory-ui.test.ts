/**
 * 记忆目录 UI 层测试（ADR-0069 记忆目录流）：⚙️ 小橘设置弹窗「记忆目录」行——
 * path-picker 多选渲染、已选 chips ✕ 移除回调、设置写回与 index 同步回调。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openSmartcatSettings } from '../../src/smartcat/ui';
import { setSettingsProvider, setSettingsSaver, getSettings } from '../../src/core/settings-provider';

function baseConfig(): any {
  return {
    appearance: 'orange',
    speakInterval: 5,
    speakProbability: 0.3,
    contextLength: 500,
    contextSplitRatio: 0.5,
    conversationHistory: [],
    shortTermMemory: 50,
    noteSource: true,
    proactiveCare: true,
    proactiveWeeklyCap: 2,
    cloudScoring: 'smart',
  };
}

function openWith(memoryDirectories: string[], hooks: { changed: string[][]; saves: number }) {
  // 生产 provider 返回常驻 settings 对象（index/index 侧改键即持久）；测试持同一对象模拟
  const settings: any = { memoryDirectories };
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => { hooks.saves++; });
  openSmartcatSettings({
    getConfig: () => baseConfig(),
    saveConfig: async () => {},
    settingsKeys: { enabled: true, mobileFullscreen: false },
    setMobileFullscreen: async () => {},
    onMemoryDirectoriesChanged: (dirs) => hooks.changed.push([...dirs]),
  });
}

const row = () => document.querySelector('.setting-item[data-name="记忆目录"]') as HTMLElement | null;

describe('⚙️ 小橘设置：记忆目录行（ADR-0069）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('空配置：行存在、显示紧凑「添加…」按钮（多选入口），无 chips', () => {
    const hooks = { changed: [] as string[][], saves: 0 };
    openWith([], hooks);
    const el = row();
    expect(el).not.toBeNull();
    // mock Setting 名称/描述存实例属性（DOM 只渲染控件）；弹窗行按 data-name 定位
    expect((el as any).__setting.name).toBe('记忆目录');
    expect((el as any).__setting.desc).toContain('小橘的记忆库');
    expect(el!.dataset.filled).toBe('0');
    const btn = el!.querySelector('button');
    expect(btn?.textContent).toBe('添加…');
    expect(el!.querySelector('.bz-path-picker-chip')).toBeNull();
  });

  it('已选配置：chips 渲染（✕ 移除）+ data-filled 标志；✕ 回调写回设置并通知 index', () => {
    const hooks = { changed: [] as string[][], saves: 0 };
    openWith(['笔记', '我的/日记'], hooks);
    const el = row()!;
    const chips = [...el.querySelectorAll('.bz-path-picker-chip-name')].map((n) => n.textContent);
    expect(chips).toEqual(['笔记', '我的/日记']);
    // 已选态：data-filled='1'（CSS 据此隐藏选择按钮，ticket 133；弹窗分离构建期按钮不摘 DOM）
    expect(el.dataset.filled).toBe('1');
    // ✕ 移除第一项 → onChange：写回 getSettings().memoryDirectories + onMemoryDirectoriesChanged
    const x = el.querySelectorAll('.bz-path-picker-chip-x')[0] as HTMLButtonElement;
    x.click();
    expect(getSettings().memoryDirectories).toEqual(['我的/日记']);
    expect(hooks.changed).toEqual([['我的/日记']]);
    expect(hooks.saves).toBe(1);
  });
});

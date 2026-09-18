/**
 * 备忘录（memo）UI 层回归（批 B 修复）：读链健壮化（A9/效率#14 读抛错 → 错误空态 +
 * 重试）、提醒定位场景重置（A3 openForNote 面板已开分支）、已完成区批量清理
 * （效率#11 入口 + 确认流 + 撤销原位插回）、openExternalUrl 单源收口（一致#14）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, unloadMemo } from '../../src/memo/ui';
import { ensureMemoReminders, unloadMemoReminders } from '../../src/memo/reminder';
import { MemoData } from '../../src/memo/data';
import { openExternalUrl } from '../../src/core/utils';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  autoPopupOnStart: false,
  openNoteReminder: true,
  cinemaFolderPath: '我的/影视',
};

/** 动态日期（相对今天）：清理时间窗依赖当下日历 */
function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function seedVault(extraItems: Record<string, unknown>[] = [], settingsPatch: Record<string, unknown> = {}) {
  const vault = new MockVault();
  const settings: any = { ...SETTINGS, ...settingsPatch };
  const saveSpy = vi.fn(async () => {});
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(saveSpy);
  if (vault.files.has('CONFIG/STORAGE/memo.json') === false && extraItems.length) {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(extraItems, null, 2));
  }
  MemoData.init(settings);
  return { vault, app, settings, saveSpy };
}

describe('批 B UI 修复', () => {
  const origMemoRead = MemoData.read;
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    clearNotices();
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    unloadMemoReminders();
    closeMemoPanel();
    unloadMemo();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
    clearNotices();
    MemoData.read = origMemoRead; // 还原用例内 monkey-patch（模块单例防跨用例污染）
  });

  it('A9 读抛错：面板出错误空态（图标+标题+原因+重试钮）+ 错误通知，恢复后点重试出列表', async () => {
    const { app } = seedVault([{ id: 'a', title: '正常条目', scene: '工作', created: at(-1, '09:00') }]);
    const origRead = MemoData.read.bind(MemoData);
    MemoData.read = async () => {
      throw new Error('磁盘被锁');
    };
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-content] .bz-empty')).toBeTruthy();
    });
    const empty = document.querySelector('[data-memo-content] .bz-empty') as HTMLElement;
    expect(empty.querySelector('.bz-empty-title')?.textContent).toBe('备忘录加载失败');
    expect(empty.querySelector('.bz-empty-desc')?.textContent).toContain('磁盘被锁');
    // 错误通知（对齐写路径口径）
    expect(hasNotice(/读取备忘录/)).toBe(true);
    // 重试钮在（错误空态为 content 直注 uiEmpty 形态串 + btn 追加），恢复读后点击 → 列表正常渲染
    const contentEl = document.querySelector('[data-memo-content]') as HTMLElement;
    const retry = [...contentEl.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('重试'));
    expect(retry).toBeTruthy();
    MemoData.read = origRead;
    (retry as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy();
    });
    expect(document.querySelector('[data-memo-content] .bz-empty')).toBeFalsy();
  });

  it('A9 读抛错期间重复重试仍失败 → 错误空态保留、无 unhandled 异常中断测试', async () => {
    const { app } = seedVault();
    MemoData.read = async () => {
      throw new Error('一直失败');
    };
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-content] .bz-empty')).toBeTruthy();
    });
    const retry = [...document.querySelectorAll('[data-memo-content] .bz-btn')].find((b) =>
      b.textContent?.includes('重试')
    ) as HTMLElement;
    retry.click();
    await vi.waitFor(() => {
      // 失败通知再 +1（重试链自身也兜 catch），错误态仍在
      expect(hasNotice(/一直失败/)).toBe(true);
    });
    expect(document.querySelector('[data-memo-content] .bz-empty')).toBeTruthy();
  });

  it('A3 openForNote 面板已开分支：停「工作」场景触发 file-open 提醒 → activeScene 重置「全部」+ 目标条目可见', async () => {
    const { vault, app } = seedVault([
      { id: 'a', title: '绑定笔记的重要事项', scene: '学习', priority: 'important', notePath: '笔记/项目A.md', created: at(-1, '09:00') },
      { id: 'b', title: '工作场景普通条目', scene: '工作', created: at(-2, '09:00') },
    ]);
    // 捕获 file-open handler（mock workspace.on 默认不存）
    const handlers: Record<string, (f: any) => void> = {};
    (app.workspace as any).on = (name: string, cb: (f: any) => void) => {
      handlers[name] = cb;
      return { ref: 'mock-ref' } as any;
    };
    ensureMemoReminders(app);
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="b"]')).toBeTruthy();
    });
    // 停到「工作」场景
    (document.querySelector('[data-memo-nav] [data-memo-scene="工作"]') as HTMLElement).click();
    expect(M.activeScene).toBe('工作');
    expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeFalsy(); // 场景过滤挡住目标
    // 打开笔记（绑定过备忘录）→ 提醒定位
    handlers['file-open']({ path: '笔记/项目A.md' });
    await vi.waitFor(() => {
      expect(M.activeScene).toBe('全部');
    });
    // 搜索框预设 notePath（列表即只显该笔记关联备忘录）
    const input = document.querySelector('[data-memo-search]') as HTMLInputElement;
    expect(input.value).toBe('笔记/项目A.md');
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy(); // 目标条目可见
    });
    expect(M.search).toBe('笔记/项目A.md');
  });

  it('效率#11 清理入口：时间窗截断 = 「清理更早 1 条」；确认后只删窗外条目；撤销按原位插回', async () => {
    const { vault, app } = seedVault([
      { id: 'd1', title: '未完成', scene: '工作', created: at(-3, '09:00') },
      { id: 'd2', title: '四十天前完成', scene: '工作', completed: at(-40, '10:00'), created: at(-41, '09:00') },
      { id: 'd3', title: '五天前完成', scene: '工作', completed: at(-5, '10:00'), created: at(-6, '09:00') },
      { id: 'd4', title: '今天完成', scene: '工作', completed: at(0, '09:00'), created: at(-1, '08:00') },
    ]);
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-doneclean]')).toBeTruthy();
    });
    expect((document.querySelector('[data-memo-doneclean]') as HTMLElement).textContent).toContain('清理更早 1 条');
    // 点击 → 确认框列明条数与窗口
    (document.querySelector('[data-memo-doneclean]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy();
    });
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup.querySelector('h4')?.textContent).toBe('清理已完成备忘录');
    expect(popup.querySelector('p')?.textContent).toContain('1 条 30 天前完成');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    // 只删时间窗外（d2），窗内/未完成保留
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.map((r: any) => r.id)).toEqual(['d1', 'd3', 'd4']);
    });
    // 撤销 → d2 回到原索引 1
    await vi.waitFor(() => {
      const undo = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销');
      expect(undo).toBeTruthy();
    });
    [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.map((r: any) => r.id)).toEqual(['d1', 'd2', 'd3', 'd4']);
    });
  });

  it('效率#11 memoDoneWindow=all：入口文案「清理已完成」，确认后清全部已完成，场景过滤收窄范围', async () => {
    const { vault, app } = seedVault(
      [
        { id: 'd1', title: '工作未完成', scene: '工作', created: at(-3, '09:00') },
        { id: 'd2', title: '工作旧完成', scene: '工作', completed: at(-40, '10:00'), created: at(-41, '09:00') },
        { id: 'd5', title: '生活旧完成', scene: '生活', completed: at(-50, '10:00'), created: at(-51, '09:00') },
      ],
      { memoDoneWindow: 'all' }
    );
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-doneclean]')).toBeTruthy();
    });
    expect((document.querySelector('[data-memo-doneclean]') as HTMLElement).textContent).toContain('清理已完成');
    // 停「工作」场景：候选收窄为该场景可见已完成（所见即所删）
    (document.querySelector('[data-memo-nav] [data-memo-scene="工作"]') as HTMLElement).click();
    (document.querySelector('[data-memo-doneclean]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy();
    });
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup.querySelector('p')?.textContent).toContain('「工作」视图内');
    expect(popup.querySelector('p')?.textContent).toContain('1 条已完成的备忘录');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.map((r: any) => r.id)).toEqual(['d1', 'd5']); // 只删工作场景的 d2
    });
  });

  it('一致#14 openExternalUrl 单源：openUrl 成功直开；openUrl 缺失落 electron；全链失败落提示', () => {
    const opened: string[] = [];
    // ① openUrl 正常
    openExternalUrl({ openUrl: (u: string) => opened.push('app:' + u) }, 'https://a.example');
    expect(opened).toEqual(['app:https://a.example']);
    // ② openUrl 缺失（TypeError 落兜底链）→ electron mock
    const requireBackup = (window as any).require;
    (window as any).require = () => ({ shell: { openExternal: (u: string) => opened.push('shell:' + u) } });
    openExternalUrl({}, 'https://b.example');
    expect(opened).toEqual(['app:https://a.example', 'shell:https://b.example']);
    // ③ electron 也不可用 → window.open 兜底；window.open 亦抛 → 人话提示
    (window as any).require = undefined;
    const openBackup = window.open;
    window.open = () => null;
    openExternalUrl({}, 'https://c.example');
    expect(hasNotice(/无法打开链接/)).toBe(true);
    window.open = openBackup;
    (window as any).require = requireBackup;
  });
});

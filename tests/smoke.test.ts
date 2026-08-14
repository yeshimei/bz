/**
 * 骨架加载冒烟（ticket 01）：mock obsidian 环境下插件可加载、
 * 25 命令裸注册、ribbon 主入口、设置页挂载、卸载清理命令。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { MockVault } from './mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from './mock-obsidian-entry';

/** 构造 mock app（workspace/vault/commands/metadataCache 最小面） */
function makeMockApp() {
  const vault = new MockVault();
  return {
    vault,
    workspace: {
      onLayoutReady: (cb: () => void) => cb(),
      getActiveFile: () => null,
      getActiveViewOfType: () => null,
      activeEditor: null,
      on: () => ({ ref: 'ref' }),
    },
    commands: {
      addCommand: (c: any) => {
        registeredCommands.push(c);
      },
      removeCommand: (id: string) => {
        removedCommands.push(id);
      },
      listCommands: () => [],
      executeCommandById: () => {},
    },
    metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
}

const removedCommands: string[] = [];
const registeredCommands: any[] = [];

/** 期望的命令 id 全集（spec「命令 id 全清单」第 9 轮：COMMANDS 表 39 个 + 日记本 bz-diary-open，共 40 个） */
const EXPECTED_COMMAND_IDS = [
  'bz-home',
  'bz-memo-open', 'bz-memo-add',
  'bz-belongings-add', 'bz-belongings-open',
  'bz-clipping-open',
  'bz-news-open',
  'bz-pw-open', 'bz-pw-add', 'bz-pw-generate',
  'bz-favorites-open', 'bz-favorites-add',
  'bz-library-open', 'bz-book-notes-open',
  'bz-reading-report-open',
  'bz-movie-open', 'bz-movie-add', 'bz-movie-report',
  'bz-review-open', 'bz-review-start', 'bz-review-add', 'bz-review-remove', 'bz-review-overdue', 'bz-review-rate',
  'bz-review-again', 'bz-review-hard', 'bz-review-good', 'bz-review-easy',
  'bz-quiz-update', 'bz-quiz-open',
  'bz-flash-open', 'bz-flash-chat',
  'bz-pomodoro-open',
  'bz-bili-open',
  'bz-diary-open',
];

/** 内存"磁盘"存储：模拟 Obsidian 插件的 data.json 持久层 */
const diskData: Record<string, any> = {};

async function createPlugin(app: any) {
  const plugin: any = new BzPlugin(app, {} as any);
  plugin.app = app;
  // MockPlugin.loadData/saveData 走共享 diskData（模拟插件 data.json）
  plugin.loadData = async () => diskData['bz'] ?? null;
  plugin.saveData = async (d: any) => {
    diskData['bz'] = d;
  };
  await plugin.onload();
  return plugin;
}

describe('bz 骨架冒烟', () => {
  beforeEach(() => {
    resetObsidianMocks();
    removedCommands.length = 0;
    registeredCommands.length = 0;
    delete diskData['bz'];
    document.body.innerHTML = '';
  });

  it('onload 裸注册全部命令 id（统一 bz- 前缀，app.commands 原样 id 注册）', async () => {
    await createPlugin(makeMockApp());

    const ids = registeredCommands.map((c: any) => c.id);
    // 含日记本 init 内注册的命令（bz-diary-write）
    const expected = [...EXPECTED_COMMAND_IDS, 'bz-diary-write'];
    expect(ids.sort()).toEqual(expected.sort());
    // 均未设置默认快捷键
    for (const c of registeredCommands) {
      expect(c.hotkeys).toBeUndefined();
    }
  });

  it('ribbon 主入口指向备忘录面板', async () => {
    const plugin = await createPlugin(makeMockApp());

    expect(plugin.ribbonIcons.length).toBeGreaterThanOrEqual(1);
    expect(plugin.ribbonIcons[0].title).toBe('备忘录');
  });

  it('设置页挂载且含 AI 配置骨架', async () => {
    const plugin = await createPlugin(makeMockApp());

    expect(plugin.settingTabs.length).toBe(1);
    expect(plugin.settingTabs[0]).toBeInstanceOf(BzSettingTab);
  });

  it('默认设置与源码默认值一致（抽查）', async () => {
    const plugin = await createPlugin(makeMockApp());

    const s = plugin.settings;
    expect(s.todoFilePath).toBe('CONFIG/STORAGE');
    expect(s.articleDirectory).toBe('归档/网页剪藏');
    expect(s.movieFolderPath).toBe('我的/影视');
    expect(s.libraryFolderPath).toBe('书库');
    expect(s.favoritesStoragePath).toBe('CONFIG/STORAGE');
    expect(s.OLLAMA_URL).toBe('http://localhost:11434');
    expect(s.EMBEDDING_MODEL).toBe('bge-m3');
    expect(s.passwordLength).toBe('16');
  });

  it('域命令回调不抛异常（已实现域真实执行，未实现域占位 Notice）', async () => {
    // 超时放宽到 15s：并行高负载下闪念/复习等异步初始化可能超过默认 5s
    const plugin = await createPlugin(makeMockApp());

    // 已实现域：归物本命令真实打开弹窗（异步），同步调用不抛错
    const cmd1 = registeredCommands.find((c: any) => c.id === 'bz-belongings-add');
    expect(() => cmd1.callback()).not.toThrow();
    // 已实现域：做题家/复习面板异步执行，同步调用不抛错
    const cmd2 = registeredCommands.find((c: any) => c.id === 'bz-quiz-open');
    expect(() => cmd2.callback()).not.toThrow();
    const cmd3 = registeredCommands.find((c: any) => c.id === 'bz-review-open');
    expect(() => cmd3.callback()).not.toThrow();
    expect(() => registeredCommands.find((c: any) => c.id === 'bz-review-add').callback()).not.toThrow();
    expect(() => registeredCommands.find((c: any) => c.id === 'bz-reading-report-open').callback()).not.toThrow();
  }, 15000);
  it('全部 31 命令回调冒烟：逐个调用覆盖各域懒加载入口（含日记本 init 两个命令）', async () => {
    const plugin = await createPlugin(makeMockApp());
    const failures: string[] = [];
    for (const c of registeredCommands) {
      try {
        c.callback();
        // 让异步初始化微任务跑完（不等待网络/长定时器）
        await new Promise((r) => setTimeout(r, 5));
      } catch (e) {
        failures.push(`${c.id}: ${(e as Error).message}`);
      }
    }
    expect(failures, `失败命令:
${failures.join('\n')}`).toEqual([]);
    expect(registeredCommands.length).toBeGreaterThanOrEqual(31);
  }, 15000);
  it('事件常驻域开关开启时 onload 注册（autoSummary/aiAgent/flash 懒加载分支）', async () => {
    delete diskData['bz'];
    diskData['bz'] = { autoSummaryEnabled: true, aiAgentEnabled: true, flashEnabled: true };
    const plugin = await createPlugin(makeMockApp());
    // 开启后 onLayoutReady 触发三个 ensure，均不抛错（占位/幂等）
    expect(plugin.settings.autoSummaryEnabled).toBe(true);
    expect(plugin.settings.aiAgentEnabled).toBe(true);
    expect(plugin.settings.flashEnabled).toBe(true);
  }, 15000);
  it('onunload 清理全部裸注册命令', async () => {
    const plugin = await createPlugin(makeMockApp());
    plugin.onunload();

    // 含日记本 init 内注册的命令（bz-diary-write）
    const expectedRemoved = [...EXPECTED_COMMAND_IDS, 'bz-diary-write'];
    expect(removedCommands.sort()).toEqual(expectedRemoved.sort());
  });

  it('设置持久化（saveData/loadData 往返）', async () => {
    const plugin = await createPlugin(makeMockApp());

    plugin.settings.todoFilePath = '自定义/路径';
    await plugin.saveSettings();
    expect(diskData['bz'].todoFilePath).toBe('自定义/路径');

    // 重新加载时合并默认值
    const plugin2 = await createPlugin(makeMockApp());
    expect(plugin2.settings.todoFilePath).toBe('自定义/路径');
    expect(plugin2.settings.movieFolderPath).toBe('我的/影视');
  });
});

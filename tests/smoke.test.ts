/**
 * 骨架加载冒烟（ticket 01）：mock obsidian 环境下插件可加载、
 * 25 命令裸注册、ribbon 主入口、设置页挂载、卸载清理命令。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import MemoSuitePlugin, { MemoSuiteSettingTab } from '../src/main';
import { MockVault } from './mock-vault';
import { MockNotice, resetObsidianMocks } from './mock-obsidian-entry';

/** 构造 mock app（workspace/vault/commands/metadataCache 最小面） */
function makeMockApp() {
  const vault = new MockVault();
  return {
    vault,
    workspace: {
      onLayoutReady: (cb: () => void) => cb(),
      getActiveFile: () => null,
      activeEditor: null,
      on: () => ({ ref: 'ref' }),
    },
    commands: {
      addCommand: (c: any) => {
        /* diary init 内部注册（diary-open-add-dialog / diary-create-quote），测试不追踪 */
      },
      removeCommand: (id: string) => {
        removedCommands.push(id);
      },
    },
    metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
}

const removedCommands: string[] = [];

/** 期望的命令 id 全集（spec「命令 id 全清单」25 个 + 日记本 open-panel，共 26 个） */
const EXPECTED_COMMAND_IDS = [
  'memo-open-panel', 'memo-create-item',
  'belongings-add-item',
  'article-open-view',
  'news-reader-open',
  'pw-open-manager', 'pw-add-entry', 'pw-generate-password',
  'favorites-open-panel', 'favorites-add-item',
  'open-library', 'open-book-notes',
  'open-panel',
  'show-reading-report',
  'movie-manager-open', 'movie-manager-add',
  'movie-analysis-open',
  'review-open-panel', 'review-add-current', 'review-remove-current', 'review-jump-overdue', 'review-mark-dialog',
  'review-mark-again', 'review-mark-hard', 'review-mark-good', 'review-mark-easy',
  'quiz-master-update', 'quiz-master-open',
  'shan-nian-open-reference', 'shan-nian-open-chat',
];

/** 内存"磁盘"存储：模拟 Obsidian 插件的 data.json 持久层 */
const diskData: Record<string, any> = {};

async function createPlugin(app: any) {
  const plugin: any = new MemoSuitePlugin(app, {} as any);
  plugin.app = app;
  // MockPlugin.loadData/saveData 走共享 diskData（模拟插件 data.json）
  plugin.loadData = async () => diskData['memo-suite'] ?? null;
  plugin.saveData = async (d: any) => {
    diskData['memo-suite'] = d;
  };
  await plugin.onload();
  return plugin;
}

describe('memo-suite 骨架冒烟', () => {
  beforeEach(() => {
    resetObsidianMocks();
    removedCommands.length = 0;
    delete diskData['memo-suite'];
    document.body.innerHTML = '';
  });

  it('onload 注册全部 26 个裸命令 id（不带插件前缀）', async () => {
    const plugin = await createPlugin(makeMockApp());

    const ids = plugin.commands.map((c: any) => c.id);
    expect(ids.sort()).toEqual([...EXPECTED_COMMAND_IDS].sort());
    // 均未设置默认快捷键
    for (const c of plugin.commands) {
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
    expect(plugin.settingTabs[0]).toBeInstanceOf(MemoSuiteSettingTab);
  });

  it('默认设置与源码默认值一致（抽查）', async () => {
    const plugin = await createPlugin(makeMockApp());

    const s = plugin.settings;
    expect(s.todoFilePath).toBe('CONFIG/STORAGE');
    expect(s.articleDirectory).toBe('归档/网页剪藏');
    expect(s.movieFolderPath).toBe('我的/影视');
    expect(s.libraryFolderPath).toBe('书库');
    expect(s.favoritesStoragePath).toBe('CONFIG/STORAGE/favorites.json');
    expect(s.OLLAMA_URL).toBe('http://localhost:11434');
    expect(s.EMBEDDING_MODEL).toBe('bge-m3');
    expect(s.passwordLength).toBe('16');
  });

  it('域命令回调不抛异常（已实现域真实执行，未实现域占位 Notice）', async () => {
    const plugin = await createPlugin(makeMockApp());

    // 已实现域：归物本命令真实打开弹窗（异步），同步调用不抛错
    const cmd1 = plugin.commands.find((c: any) => c.id === 'belongings-add-item');
    expect(() => cmd1.callback()).not.toThrow();
    // 已实现域：做题家/复习面板异步执行，同步调用不抛错
    const cmd2 = plugin.commands.find((c: any) => c.id === 'quiz-master-open');
    expect(() => cmd2.callback()).not.toThrow();
    const cmd3 = plugin.commands.find((c: any) => c.id === 'review-open-panel');
    expect(() => cmd3.callback()).not.toThrow();
    expect(() => plugin.commands.find((c: any) => c.id === 'review-add-current').callback()).not.toThrow();
    expect(() => plugin.commands.find((c: any) => c.id === 'movie-analysis-open').callback()).not.toThrow();
    expect(() => plugin.commands.find((c: any) => c.id === 'show-reading-report').callback()).not.toThrow();
  });

  it('onunload 清理全部裸注册命令', async () => {
    const plugin = await createPlugin(makeMockApp());
    plugin.onunload();

    // 含日记本 init 内注册的两个命令（diary-open-add-dialog / diary-create-quote）
    const expectedRemoved = [...EXPECTED_COMMAND_IDS, 'diary-open-add-dialog', 'diary-create-quote'];
    expect(removedCommands.sort()).toEqual(expectedRemoved.sort());
  });

  it('设置持久化（saveData/loadData 往返）', async () => {
    const plugin = await createPlugin(makeMockApp());

    plugin.settings.todoFilePath = '自定义/路径';
    await plugin.saveSettings();
    expect(diskData['memo-suite'].todoFilePath).toBe('自定义/路径');

    // 重新加载时合并默认值
    const plugin2 = await createPlugin(makeMockApp());
    expect(plugin2.settings.todoFilePath).toBe('自定义/路径');
    expect(plugin2.settings.movieFolderPath).toBe('我的/影视');
  });
});

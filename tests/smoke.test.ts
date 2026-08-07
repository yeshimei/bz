/**
 * 骨架加载冒烟（ticket 01）：mock obsidian 环境下插件可加载、
 * 25 命令裸注册、ribbon 主入口、设置页挂载、卸载清理命令。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
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
        registeredCommands.push(c);
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
const registeredCommands: any[] = [];

/** 期望的命令 id 全集（spec「命令 id 全清单」29 个主表 + 日记本 bz-open-panel，共 30 个） */
const EXPECTED_COMMAND_IDS = [
  'bz-memo-open-panel', 'bz-memo-create-item',
  'bz-belongings-add-item', 'bz-belongings-open-panel',
  'bz-article-open-view',
  'bz-news-reader-open',
  'bz-pw-open-manager', 'bz-pw-add-entry', 'bz-pw-generate-password',
  'bz-favorites-open-panel', 'bz-favorites-add-item',
  'bz-open-library', 'bz-open-book-notes',
  'bz-open-panel',
  'bz-show-reading-report',
  'bz-movie-manager-open', 'bz-movie-manager-add',
  'bz-review-open-panel', 'bz-review-add-current', 'bz-review-remove-current', 'bz-review-jump-overdue', 'bz-review-mark-dialog',
  'bz-review-mark-again', 'bz-review-mark-hard', 'bz-review-mark-good', 'bz-review-mark-easy',
  'bz-quiz-master-update', 'bz-quiz-master-open',
  'bz-shan-nian-open-reference', 'bz-shan-nian-open-chat',
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
    // 含日记本 init 内注册的两个命令（bz-diary-open-add-dialog / bz-diary-create-quote）
    const expected = [...EXPECTED_COMMAND_IDS, 'bz-diary-open-add-dialog', 'bz-diary-create-quote'];
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
    expect(s.favoritesStoragePath).toBe('CONFIG/STORAGE/favorites.json');
    expect(s.OLLAMA_URL).toBe('http://localhost:11434');
    expect(s.EMBEDDING_MODEL).toBe('bge-m3');
    expect(s.passwordLength).toBe('16');
  });

  it('域命令回调不抛异常（已实现域真实执行，未实现域占位 Notice）', async () => {
    // 超时放宽到 15s：并行高负载下闪念/复习等异步初始化可能超过默认 5s
    const plugin = await createPlugin(makeMockApp());

    // 已实现域：归物本命令真实打开弹窗（异步），同步调用不抛错
    const cmd1 = registeredCommands.find((c: any) => c.id === 'bz-belongings-add-item');
    expect(() => cmd1.callback()).not.toThrow();
    // 已实现域：做题家/复习面板异步执行，同步调用不抛错
    const cmd2 = registeredCommands.find((c: any) => c.id === 'bz-quiz-master-open');
    expect(() => cmd2.callback()).not.toThrow();
    const cmd3 = registeredCommands.find((c: any) => c.id === 'bz-review-open-panel');
    expect(() => cmd3.callback()).not.toThrow();
    expect(() => registeredCommands.find((c: any) => c.id === 'bz-review-add-current').callback()).not.toThrow();
    expect(() => registeredCommands.find((c: any) => c.id === 'bz-show-reading-report').callback()).not.toThrow();
  }, 15000);
  it('onunload 清理全部裸注册命令', async () => {
    const plugin = await createPlugin(makeMockApp());
    plugin.onunload();

    // 含日记本 init 内注册的两个命令（bz-diary-open-add-dialog / bz-diary-create-quote）
    const expectedRemoved = [...EXPECTED_COMMAND_IDS, 'bz-diary-open-add-dialog', 'bz-diary-create-quote'];
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

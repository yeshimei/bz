/**
 * 骨架加载冒烟（ticket 01）：mock obsidian 环境下插件可加载、
 * 25 命令裸注册、ribbon 主入口、设置页挂载、卸载清理命令。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { MockVault } from './mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from './mock-obsidian-entry';
import { notify } from '../src/core/notice';

// ai-agent 域解散后的新注册点隔离：ensureMemoFileSync/ensureFavoritesFileSync 换 spy
// （vi.mock 局部替换，其余导出保持真实实现，命令回调冒烟等用例不受影响）
const syncSpies = vi.hoisted(() => ({
  ensureMemoFileSync: vi.fn(),
  ensureFavoritesFileSync: vi.fn(),
}));
vi.mock('../src/memo', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureMemoFileSync: syncSpies.ensureMemoFileSync,
}));
vi.mock('../src/favorites', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureFavoritesFileSync: syncSpies.ensureFavoritesFileSync,
}));

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

/** 期望的命令 id 全集（spec「命令 id 全清单」第 9 轮：COMMANDS 表 + 日记本 bz-diary-open） */
const EXPECTED_COMMAND_IDS = [
  'bz-home',
  'bz-home-open',
  'bz-memo-open', 'bz-memo-add',
  'bz-todo-open', 'bz-todo-add',
  'bz-belongings-add', 'bz-belongings-open',
  // 剪藏本（clipbook 融合域，ADR-0082）：聚合讯未读流+剪藏笔记一体化；旧 bz-clipping-open/bz-news-open 断开
  'bz-clipbook-open',
  // 统一保险库（encrypt 域，ADR-0085）：密码/笔记/日记合一；旧 bz-password-vault-open 已删
  // 回忆墙（diary-wall 域，ADR-0081）：日记本数据的媒体优先只读视图
  'bz-diary-wall-open',
  'bz-favorites-open', 'bz-favorites-add',
  'bz-library-open', 'bz-book-notes-open',
  'bz-reading-report-open',
  'bz-movie-open', 'bz-movie-add', 'bz-movie-report',
  'bz-cinema-open', 'bz-cinema-add',
  // 书架墙（bookshelf 域，新域与书库并存）
  'bz-bookshelf-open',
  'bz-review-open', 'bz-review-report', 'bz-review-start', 'bz-review-add', 'bz-review-remove', 'bz-review-overdue', 'bz-review-rate',
  'bz-review-again', 'bz-review-hard', 'bz-review-good', 'bz-review-easy',
  'bz-secondbrain-panel', 'bz-secondbrain-open', 'bz-secondbrain-chat', 'bz-secondbrain-rebuild-links', 'bz-secondbrain-link-all',
  'bz-pomodoro-open',
  'bz-literature-open', 'bz-literature-note-term',
  'bz-attach-move',
  // 统一保险库（ADR-0085）：密码/加密笔记/加密日记 + 加密当前笔记
  'bz-encrypt-open', 'bz-encrypt-lock',
  'bz-smartcat-open', 'bz-smartcat-chat', 'bz-smartcat-hide', 'bz-smartcat-dashboard',
  // 设置面板（ADR-0080）
  'bz-settings-panel-open',
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

  it('命令名统一（f3/f7/t1/t2，id 不动）与重复图标去重（f7）', async () => {
    await createPlugin(makeMockApp());
    const byId = (id: string) => registeredCommands.find((c: any) => c.id === id)!;
    // t1：主页 → 入口页（术语随 CONTEXT.md；id bz-home 不变）
    expect(byId('bz-home').name).toBe('入口页');
    // f3：新建类动词统一（写备忘/写影视 → 加备忘/加影视，与加物品/加密码/加收藏一致）
    expect(byId('bz-memo-add').name).toBe('加备忘');
    expect(byId('bz-movie-add').name).toBe('加影视');
    expect(byId('bz-cinema-open').name).toBe('影院');
    expect(byId('bz-cinema-add').name).toBe('加影视（影院）');
    // 书架墙（bookshelf 新域）
    expect(byId('bz-bookshelf-open').name).toBe('书架墙');
    // todo 新域：待办 / 加待办（待办）
    expect(byId('bz-todo-open').name).toBe('待办');
    // clipbook 融合域（ADR-0082）：剪藏本 = 聚合讯+剪藏本合一入口
    expect(byId('bz-clipbook-open').name).toBe('剪藏本');
    expect(byId('bz-todo-add').name).toBe('加待办（待办）');
    // t2：阅读分析报告 → 阅读数据分析报告
    expect(byId('bz-reading-report-open').name).toBe('阅读数据分析报告');
    // f3：评级四命令去英文后缀、统一「复习（X）」标点
    expect(byId('bz-review-again').name).toBe('复习（忘了）');
    expect(byId('bz-review-hard').name).toBe('复习（困难）');
    expect(byId('bz-review-good').name).toBe('复习（一般）');
    expect(byId('bz-review-easy').name).toBe('复习（简单）');
    // f7：第二大脑面板与第二大脑参考区分（不再与功能名歧义）
    expect(byId('bz-secondbrain-panel').name).toBe('第二大脑面板');
    expect(byId('bz-secondbrain-open').name).toBe('第二大脑参考');
    // f7：重复图标去重——clapperboard / message-circle 各只出现一次
    const icons = registeredCommands.map((c: any) => c.icon);
    expect(icons.filter((i: string) => i === 'clapperboard')).toHaveLength(1);
    expect(icons.filter((i: string) => i === 'message-circle')).toHaveLength(1);
    expect(byId('bz-movie-report').icon).toBe('pie-chart');
    expect(byId('bz-smartcat-chat').icon).toBe('messages-square');
  });

  it('回忆墙（diary-wall，ADR-0081）：命令注册 + ensureDiaryWall 幂等可调用不抛错', async () => {
    const app = makeMockApp();
    await createPlugin(app);

    // 命令已裸注册且名称/图标正确
    const cmd = registeredCommands.find((c: any) => c.id === 'bz-diary-wall-open');
    expect(cmd).toBeDefined();
    expect(cmd.name).toBe('回忆墙');
    expect(cmd.icon).toBe('images');
    // 回调（openDiaryWall 异步 ensure 后 show）同步调用不抛
    expect(() => cmd.callback()).not.toThrow();
    // 幂等 ensureDiaryWall：mock app 下可调用且不抛（UI 层数据读取失败安全降级为空）
    const { ensureDiaryWall, unloadDiaryWall } = await import('../src/diary-wall');
    await expect(ensureDiaryWall(app as any)).resolves.toBeUndefined();
    await expect(ensureDiaryWall(app as any)).resolves.toBeUndefined();
    unloadDiaryWall();
  });

  it('onunload 清理 toast 容器（UX 整改 l2-toast）', async () => {
    const plugin = await createPlugin(makeMockApp());
    // createPlugin 期间日记本 mock 加载失败会弹一条 error 通知（既有噪音），先清空再精确计数
    clearNotices();
    notify('一条提示', { type: 'info' });
    expect(document.querySelectorAll('.bz-notice')).toHaveLength(1);
    await plugin.onunload();
    expect(document.getElementById('bz-notice-container')).toBeNull();
    expect(document.querySelectorAll('.bz-notice')).toHaveLength(0);
    // 卸载后如再触发通知也能重建容器（模块单例未被销毁）
    notify('重建');
    expect(document.getElementById('bz-notice-container')).not.toBeNull();
    clearNotices();
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
    expect(s.cinemaFolderPath).toBe(''); // 空 = 未配置（不抢占 movie 默认目录）
    expect(s.bookshelfFolderPath).toBe(''); // 空 = 未配置（回落 libraryFolderPath 同显）
    expect(s.libraryFolderPath).toBe('书库');
    expect(s.favoritesStoragePath).toBe('CONFIG/STORAGE');
    expect(s.secondBrainOllamaUrl).toBe('http://localhost:11434');
    expect(s.secondBrainEmbeddingModel).toBe('bge-m3');
    expect(s.passwordLength).toBe('16');
    // clipbook（ADR-0082）：移动端默认全屏对齐 clipping 默认开
    expect(s.clipbookMobileDefaultFullscreen).toBe(true);
  });

  it('域命令回调不抛异常（已实现域真实执行，未实现域占位 Notice）', async () => {
    // 超时放宽到 15s：并行高负载下闪念/复习等异步初始化可能超过默认 5s
    const plugin = await createPlugin(makeMockApp());

    // 已实现域：归物本命令真实打开弹窗（异步），同步调用不抛错
    const cmd1 = registeredCommands.find((c: any) => c.id === 'bz-belongings-add');
    expect(() => cmd1.callback()).not.toThrow();
    // 已实现域：复习面板异步执行，同步调用不抛错（做题家命令已退役，ADR-0045）
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
  it('事件常驻域开关开启时 onload 注册（autoSummary/aiAgent→memo+favorites 文件同步/secondBrain 懒加载分支；旧 flashEnabled 键随 ticket 103 迁移）', async () => {
    delete diskData['bz'];
    // 故意种旧键：验证 onload 迁移把 flashEnabled 平移为 secondBrainEnabled
    diskData['bz'] = { autoSummaryEnabled: true, aiAgentEnabled: true, flashEnabled: true };
    syncSpies.ensureMemoFileSync.mockClear();
    syncSpies.ensureFavoritesFileSync.mockClear();
    const app = makeMockApp();
    const plugin = await createPlugin(app);
    // aiAgent 键名不变（旧 data.json 兼容）：开启后 onLayoutReady 触发新注册点——
    // memo/favorites 两路文件同步 ensure 各恰好一次，均不抛错
    expect(plugin.settings.autoSummaryEnabled).toBe(true);
    expect(plugin.settings.aiAgentEnabled).toBe(true);
    expect(plugin.settings.secondBrainEnabled).toBe(true);
    expect(plugin.settings.flashEnabled).toBeUndefined();
    expect(syncSpies.ensureMemoFileSync).toHaveBeenCalledTimes(1);
    expect(syncSpies.ensureMemoFileSync).toHaveBeenCalledWith(app);
    expect(syncSpies.ensureFavoritesFileSync).toHaveBeenCalledTimes(1);
    expect(syncSpies.ensureFavoritesFileSync).toHaveBeenCalledWith(app);
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

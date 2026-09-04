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
  // 今日回顾（recap 域，方向一 R2：当天五域痕迹聚合面板）
  'bz-recap-today',
  'bz-memo-open', 'bz-memo-add',
  'bz-todo-open', 'bz-todo-add',
  'bz-belongings-add', 'bz-belongings-open',
  // 剪藏本（clipbook 融合域，ADR-0082）：聚合讯未读流+剪藏笔记一体化；旧 bz-clipping-open/bz-news-open 断开
  'bz-clipbook-open',
  // 自动摘要（enh-autosum 包 1）：当前剪藏笔记手动重跑 AI 摘要
  'bz-auto-summary-redo',
  // 统一保险库（encrypt 域，ADR-0085）：密码/笔记/日记合一；旧 bz-password-vault-open 已删
  // 回忆墙（diary-wall 域，ADR-0081）：日记本数据的媒体优先只读视图
  'bz-diary-wall-open',
  'bz-favorites-open', 'bz-favorites-add',
  // 旧书库（library）域退役：bz-library-open/bz-book-notes-open 已删（读书笔记入书架墙详情弹窗）
  'bz-reading-report-open',
  // ADR-0090：独立报告窗退役，原报告命令 id 换 bz-cinema-analysis（直达影院面板分析页）
  'bz-cinema-analysis',
  'bz-cinema-open', 'bz-cinema-add',
  // 书架墙（bookshelf 域，新域与书库并存）
  'bz-bookshelf-open',
  'bz-review-open', 'bz-review-report', 'bz-review-start', 'bz-review-add', 'bz-review-remove', 'bz-review-overdue', 'bz-review-rate',
  'bz-review-again', 'bz-review-hard', 'bz-review-good', 'bz-review-easy',
  'bz-secondbrain-panel', 'bz-secondbrain-open', 'bz-secondbrain-chat', 'bz-secondbrain-rebuild-links', 'bz-secondbrain-link-all',
  'bz-pomodoro-open',
  'bz-literature-open', 'bz-literature-note-term',
  'bz-attach-move',
  // 统一保险库（ADR-0085）：密码/加密笔记/加密日记 + 加密当前笔记 + 快速复制密码
  'bz-encrypt-open', 'bz-encrypt-lock', 'bz-encrypt-copy-password',
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

  it('ribbon 主入口指向待办面板（捕获入口改道：点击落点=待办工作台）', async () => {
    const plugin = await createPlugin(makeMockApp());

    expect(plugin.ribbonIcons.length).toBeGreaterThanOrEqual(1);
    expect(plugin.ribbonIcons[0].title).toBe('待办');
    // 点击落点核对：打开待办面板，备忘录旧弹窗（#todo-popup）不出现
    plugin.ribbonIcons[0].callback();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-overlay')).toBeTruthy();
    });
    expect(document.getElementById('todo-popup')).toBeNull();
  });

  it('命令名统一（f3/f7/t1/t2，id 不动）与重复图标去重（f7）', async () => {
    await createPlugin(makeMockApp());
    const byId = (id: string) => registeredCommands.find((c: any) => c.id === id)!;
    // t1：主页 → 入口页（术语随 CONTEXT.md；id bz-home 不变）
    expect(byId('bz-home').name).toBe('入口页');
    // f3：新建类动词统一（写备忘 → 加备忘，与加物品/加收藏一致；ADR-0087 旧 movie-add 已退役）
    expect(byId('bz-memo-add').name).toBe('加备忘');
    expect(byId('bz-cinema-open').name).toBe('影院');
    expect(byId('bz-cinema-add').name).toBe('加影视（影院）');
    // 书架墙（bookshelf 新域）
    expect(byId('bz-bookshelf-open').name).toBe('书架墙');
    // todo 新域：待办 / 加待办（enh-sweep-a 去冗余括号后缀）
    expect(byId('bz-todo-open').name).toBe('待办');
    // clipbook 融合域（ADR-0082）：剪藏本 = 聚合讯+剪藏本合一入口
    expect(byId('bz-clipbook-open').name).toBe('剪藏本');
    expect(byId('bz-todo-add').name).toBe('加待办');
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
    // f7：重复图标去重——message-circle 各只出现一次（clapperboard 随 movie-add 退役已无）
    const icons = registeredCommands.map((c: any) => c.icon);
    expect(icons.filter((i: string) => i === 'message-circle')).toHaveLength(1);
    expect(byId('bz-cinema-analysis').icon).toBe('pie-chart');
    expect(byId('bz-cinema-analysis').name).toBe('影视分析报告');
    expect(byId('bz-smartcat-chat').icon).toBe('messages-square');
  });

  it('域图标单一事实源（enh-sweep-a）：域入口命令 icon = DOMAIN_ICONS，历史重复图标已错开', async () => {
    await createPlugin(makeMockApp());
    const byId = (id: string) => registeredCommands.find((c: any) => c.id === id)!;
    const { DOMAIN_ICONS } = await import('../src/core/domain-icons');
    // 域入口命令 icon 全部来自 DOMAIN_ICONS（一处定义、两处引用：命令表 + 设置面板导航）
    const domainCommands: Array<[string, string]> = [
      ['bz-home', 'launcher'],
      ['bz-home-open', 'home'],
      ['bz-recap-today', 'recap'],
      ['bz-memo-open', 'memo'],
      ['bz-todo-open', 'todo'],
      ['bz-belongings-open', 'belongings'],
      ['bz-clipbook-open', 'clipping'],
      ['bz-auto-summary-redo', 'auto-summary'],
      ['bz-favorites-open', 'favorites'],
      ['bz-reading-report-open', 'reading-report'],
      ['bz-cinema-open', 'cinema'],
      ['bz-bookshelf-open', 'bookshelf'],
      ['bz-review-open', 'review'],
      ['bz-secondbrain-panel', 'secondbrain'],
      ['bz-pomodoro-open', 'pomodoro'],
      ['bz-literature-open', 'literature'],
      ['bz-attach-move', 'attach'],
      ['bz-encrypt-open', 'encrypt'],
      ['bz-smartcat-open', 'smartcat'],
      ['bz-diary-open', 'diary'],
    ];
    for (const [id, domain] of domainCommands) {
      expect(byId(id).icon, `${id} icon 应 = DOMAIN_ICONS.${domain}`).toBe(DOMAIN_ICONS[domain]);
    }
    // 历史重复图标错开（enh-sweep-a）：
    // 读书笔记类（日记本 notebook-pen / ribbon 同款）vs 书架墙（book-open 独占）
    expect(byId('bz-diary-open').icon).toBe('notebook-pen');
    expect(byId('bz-diary-open').icon).not.toBe(byId('bz-bookshelf-open').icon);
    // 两份分析报告：阅读 bar-chart-3 / 复习 calendar-check / 影视 pie-chart 各不相同
    expect(byId('bz-review-report').icon).toBe('calendar-check');
    const reportIcons = [byId('bz-reading-report-open').icon, byId('bz-review-report').icon, byId('bz-cinema-analysis').icon];
    expect(new Set(reportIcons).size).toBe(3);
    // 影院/复习域入口与内容首页磁贴同款（clapperboard / repeat-2，收敛磁贴漂移）
    expect(byId('bz-cinema-open').icon).toBe('clapperboard');
    expect(byId('bz-review-open').icon).toBe('repeat-2');
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
    expect(s.cinemaFolderPath).toBe('我的/影视'); // ADR-0087：接管影视目录（旧 movieFolderPath 键退役）
    expect(s.bookshelfFolderPath).toBe(''); // 空 = 未配置（运行时回落旧 libraryFolderPath 存量值）
    // 旧书库（library）域退役：libraryFolderPath/libraryMobileDefaultFullscreen/bookTag 三键已删
    expect('libraryFolderPath' in s).toBe(false);
    expect('libraryMobileDefaultFullscreen' in s).toBe(false);
    expect('bookTag' in s).toBe(false);
    expect(s.bookshelfMobileDefaultFullscreen).toBe(true);
    expect(s.favoritesStoragePath).toBe('CONFIG/STORAGE');
    expect(s.secondBrainOllamaUrl).toBe('http://localhost:11434');
    expect(s.secondBrainEmbeddingModel).toBe('bge-m3');
    // enh-sweep-a：远程 Ollama URL 默认留空（空 = 未配置远程，不再写死内网 IP）
    expect(s.secondBrainRemoteOllamaUrl).toBe('');
    expect(s.passwordLength).toBe('16');
    // clipbook（ADR-0082）：移动端默认全屏对齐 clipping 默认开
    expect(s.clipbookMobileDefaultFullscreen).toBe(true);
    // enh-sweep-a 死键清理：旧 clipping 域孤儿键（实际生效 = clipbook 键）与
    // bookshelf 未接管前遗留的 5 个书库展示开关键，全仓无消费方，接口+默认值双删
    expect('clippingMobileDefaultFullscreen' in s).toBe(false);
    for (const dead of ['showFileSize', 'showReadingTime', 'showHighlights', 'showThinks', 'showReview']) {
      expect(dead in s).toBe(false);
    }
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
  it('事件常驻域 onload 注册（autoSummary 开关 / 引用同步无条件常驻 issue 187 / secondBrain 懒加载分支；旧 flashEnabled 键随 ticket 103 迁移）', async () => {
    delete diskData['bz'];
    // 故意种旧键：验证 onload 迁移把 flashEnabled 平移为 secondBrainEnabled
    diskData['bz'] = { autoSummaryEnabled: true, flashEnabled: true };
    syncSpies.ensureMemoFileSync.mockClear();
    syncSpies.ensureFavoritesFileSync.mockClear();
    const app = makeMockApp();
    const plugin = await createPlugin(app);
    // 引用同步无条件常驻（issue 187：aiAgentEnabled 开关退役）——
    // memo/favorites 两路文件同步 ensure 各恰好一次，均不抛错
    expect(plugin.settings.autoSummaryEnabled).toBe(true);
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
    expect(plugin2.settings.cinemaFolderPath).toBe('我的/影视');
  });
});

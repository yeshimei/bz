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
  ensureFileSync: vi.fn(),
}));
vi.mock('../src/memo', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureFileSync: syncSpies.ensureFileSync,
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
  'bz-home-open',
  // 今日回顾（recap 域，方向一 R2：当天五域痕迹聚合面板）
  'bz-recap-today',
  'bz-memo-open', 'bz-memo-add',
  // 给当前笔记记一笔（2026-09-11 首页入口菜单）
  'bz-memo-note-binding',
  'bz-belongings-add', 'bz-belongings-open',
  // 剪藏本（clipbook 融合域，ADR-0082）：聚合讯未读流+剪藏笔记一体化；旧 bz-clipping-open/bz-news-open 断开
  'bz-clipbook-open',
  // 未读全部标为已读（2026-09-11 首页入口菜单；跨全库批量已读）
  'bz-clipbook-mark-all-read',
  // 立即抓取（issue 302 / ADR-0128：插件内抓取的手动入口，忽略间隔）
  'bz-clipbook-fetch-now',
  // 自动摘要（enh-autosum 包 1）：当前剪藏笔记手动重跑 AI 摘要
  'bz-auto-summary-redo',
  // 统一保险库（encrypt 域，ADR-0085）：密码/笔记/日记合一
  // 密码本（password-vault 域，ADR-0109 拆回独立域恢复 bz-password-vault-open）
  // 日记本（diary 域，ADR-0115 由回忆墙升格）：日记数据的媒体优先视图 + 写日记入口
  'bz-diary-open', 'bz-diary-write',
  'bz-favorites-open', 'bz-favorites-add',
  // 旧书库（library）域退役：bz-library-open/bz-book-notes-open 已删（读书笔记入书架墙详情弹窗）
  'bz-reading-report-open',
  // ADR-0090：独立报告窗退役，原报告命令 id 换 bz-cinema-analysis（直达影院面板分析页）
  'bz-cinema-analysis',
  'bz-cinema-open', 'bz-cinema-add',
  // 随机抽一部（2026-09-11 首页入口菜单；想看池随机直开详情）
  'bz-cinema-random-pick',
  // 书架墙（bookshelf 域，新域与书库并存）
  'bz-bookshelf-open',
  // 继续在读（2026-09-11 首页入口菜单；开书架墙落「在读」分栏）
  'bz-bookshelf-continue',
  'bz-review-open', 'bz-review-report', 'bz-review-start', 'bz-review-add', 'bz-review-remove', 'bz-review-overdue', 'bz-review-rate',
  'bz-review-again', 'bz-review-hard', 'bz-review-good', 'bz-review-easy',
  'bz-secondbrain-panel', 'bz-secondbrain-open', 'bz-secondbrain-chat', 'bz-secondbrain-rebuild-links', 'bz-secondbrain-link-all',
  // 重建索引（2026-09-11 首页入口菜单；函数早已存在、此前无命令入口）
  'bz-secondbrain-rebuild-index',
  'bz-pomodoro-open',
  // 开始/停止专注（2026-09-10：首页入口菜单联动）
  'bz-pomodoro-focus-toggle',
  // 跳过休息 / 暂停·继续（2026-09-11 首页入口菜单；相位派发的单动作，见 core/pomodoro-phase）
  'bz-pomodoro-skip', 'bz-pomodoro-pause',
  'bz-knowledge-open', 'bz-knowledge-note-term',
  // 视频生成文献笔记（2026-09-10：首页入口菜单联动）
  'bz-knowledge-note-video',
  'bz-attach-move',
  // 统一保险库（ADR-0085）：密码/加密笔记/加密日记 + 加密当前笔记 + 快速复制密码
  // 注意：bz-encrypt-lock 是历史遗留 id，实际动作是「加密当前笔记」；
  // 锁定保险库（2026-09-11 首页入口菜单）另用 bz-encrypt-lock-vault，避免撞 id
  'bz-encrypt-open', 'bz-encrypt-lock', 'bz-encrypt-copy-password',
  'bz-encrypt-lock-vault',
  // 密码本（password-vault 域，ADR-0109 拆回独立域）
  'bz-password-vault-open',
  // 快速生成密码（2026-09-10：首页入口菜单联动）
  'bz-password-vault-gen',
  // 锁定密码本（2026-09-11 首页入口菜单；与保险库同库同锁）
  'bz-password-vault-lock',
  'bz-smartcat-open', 'bz-smartcat-chat', 'bz-smartcat-hide', 'bz-smartcat-dashboard',
  // 设置面板（ADR-0080）
  'bz-settings-panel-open',
  // 数据体检（checkup 域，D4）
  'bz-data-checkup-open',
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
    // ADR-0115：日记本两命令（bz-diary-open / bz-diary-write）已入 COMMANDS 表，无域内注册增量
    const expected = [...EXPECTED_COMMAND_IDS];
    expect(ids.sort()).toEqual(expected.sort());
    // 均未设置默认快捷键
    for (const c of registeredCommands) {
      expect(c.hotkeys).toBeUndefined();
    }
  });

  it('ribbon 主入口指向备忘录面板（捕获入口改道：点击落点=备忘录工作台）', async () => {
    const plugin = await createPlugin(makeMockApp());

    expect(plugin.ribbonIcons.length).toBeGreaterThanOrEqual(1);
    expect(plugin.ribbonIcons[0].title).toBe('备忘录');
    // 点击落点核对：打开备忘录面板
    plugin.ribbonIcons[0].callback();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    });
  });

  it('命令名统一（f3/f7/t1/t2，id 不动）与重复图标去重（f7）', async () => {
    await createPlugin(makeMockApp());
    const byId = (id: string) => registeredCommands.find((c: any) => c.id === id)!;
    expect(byId('bz-cinema-open').name).toBe('影院');
    expect(byId('bz-cinema-add').name).toBe('加影视');
    // 书架墙（bookshelf 新域）
    expect(byId('bz-bookshelf-open').name).toBe('书库');
    // memo 新域：备忘录 / 加备忘录（enh-sweep-a 去冗余括号后缀）
    expect(byId('bz-memo-open').name).toBe('备忘录');
    // clipbook 融合域（ADR-0082）：剪藏本 = 聚合讯+剪藏本合一入口
    expect(byId('bz-clipbook-open').name).toBe('剪藏本');
    expect(byId('bz-memo-add').name).toBe('加备忘录');
    // t2：四套叫法统一「阅读分析报告」（走查批 D；home 磁贴保留短名「阅读报告」）
    expect(byId('bz-reading-report-open').name).toBe('阅读分析报告');
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
      ['bz-home-open', 'home'],
      ['bz-recap-today', 'recap'],
      ['bz-memo-open', 'memo'],
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
      ['bz-knowledge-open', 'knowledge'],
      ['bz-attach-move', 'attach'],
      ['bz-encrypt-open', 'encrypt'],
      ['bz-password-vault-open', 'password-vault'],
      ['bz-smartcat-open', 'smartcat'],
      ['bz-diary-open', 'diary'],
      ['bz-diary-write', 'diary'],
      // 批 B 补缺入表：设置面板（settings-2）；回忆墙键随 ADR-0115 升格并入 diary
      ['bz-settings-panel-open', 'settings-panel'],
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

  it('日记本（diary，ADR-0115 回忆墙升格）：命令注册 + ensureDiary 幂等可调用不抛错', async () => {
    const app = makeMockApp();
    await createPlugin(app);

    // 打开命令：已裸注册且名称/图标正确
    const cmd = registeredCommands.find((c: any) => c.id === 'bz-diary-open');
    expect(cmd).toBeDefined();
    expect(cmd.name).toBe('日记本');
    expect(cmd.icon).toBe('notebook-pen');
    // 回调（openDiary 异步 ensure 后 show）同步调用不抛
    expect(() => cmd.callback()).not.toThrow();
    // 写日记命令同表注册（旧域内注册已收编）
    const writeCmd = registeredCommands.find((c: any) => c.id === 'bz-diary-write');
    expect(writeCmd).toBeDefined();
    expect(writeCmd.name).toBe('写日记');
    // 幂等 ensureDiary：mock app 下可调用且不抛（UI 层数据读取失败安全降级为空）
    const { ensureDiary, unloadDiary } = await import('../src/diary');
    await expect(ensureDiary(app as any)).resolves.toBeUndefined();
    await expect(ensureDiary(app as any)).resolves.toBeUndefined();
    // D15 回归：标签选择器/写日记弹窗两个 body 级 mask 随 ensure 常驻 body，卸载时必须按 id 摘除
    expect(document.getElementById('diary-tag-selector-mask')).not.toBeNull();
    expect(document.getElementById('add-diary-mask')).not.toBeNull();
    unloadDiary();
    expect(document.getElementById('diary-tag-selector-mask')).toBeNull();
    expect(document.getElementById('add-diary-mask')).toBeNull();
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
    expect(s.articleDirectory).toBe('归档/网页剪藏');
    expect(s.cinemaFolderPath).toBe('我的/影视'); // ADR-0087：接管影视目录（旧 movieFolderPath 键退役）
    expect(s.bookshelfFolderPath).toBe(''); // 空 = 未配置（运行时回落旧 libraryFolderPath 存量值）
    // 旧书库（library）域退役：libraryFolderPath/libraryMobileDefaultFullscreen/bookTag 三键已删
    expect('libraryFolderPath' in s).toBe(false);
    expect('libraryMobileDefaultFullscreen' in s).toBe(false);
    expect('bookTag' in s).toBe(false);
    // 「移动端默认全屏」特性全链退役：bookshelf 键一并删除
    expect('bookshelfMobileDefaultFullscreen' in s).toBe(false);
    expect(s.secondBrainOllamaUrl).toBe('http://localhost:11434');
    expect(s.secondBrainEmbeddingModel).toBe('bge-m3');
    // enh-sweep-a：远程 Ollama URL 默认留空（空 = 未配置远程，不再写死内网 IP）
    expect(s.secondBrainRemoteOllamaUrl).toBe('');
    expect(s.passwordLength).toBe('16');
    // 「移动端默认全屏」特性全链退役：clipbook 键一并删除
    expect('clipbookMobileDefaultFullscreen' in s).toBe(false);
    // issue 222：目录栏宽度记忆（分割线拖宽），0 = 未拖过走 CSS 默认 360px
    expect(s.clipbookMidWidth).toBe(0);
    // issue 224：保留天数两键合一——旧 newsRetentionSavedDays/SkippedDays 退役，
    // 新「未保存文章保留天数」默认 30（已保存/已跳过骨架同口径）
    expect('newsRetentionSavedDays' in s).toBe(false);
    expect('newsRetentionSkippedDays' in s).toBe(false);
    expect(s.newsRetentionUnsavedDays).toBe('30');
    // 备忘录面板皮肤（issue 210 四轮）：默认风格下线，缺省 = 纸感手账
    expect(s.memoSkin).toBe('paper');
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
  it('全部 32 命令回调冒烟：逐个调用覆盖各域懒加载入口（含日记本 init 两个命令）', async () => {
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
    expect(registeredCommands.length).toBeGreaterThanOrEqual(32);
  }, 15000);
  it('事件常驻域 onload 注册（autoSummary 开关 / 引用同步无条件常驻 issue 187 / secondBrain 启动即加载）', async () => {
    delete diskData['bz'];
    diskData['bz'] = { autoSummaryEnabled: true };
    syncSpies.ensureFileSync.mockClear();
    const app = makeMockApp();
    const plugin = await createPlugin(app);
    // 引用同步无条件常驻（issue 187：aiAgentEnabled 开关退役）——
    // memo/favorites 两路文件同步 ensure 各恰好一次，均不抛错
    expect(plugin.settings.autoSummaryEnabled).toBe(true);
    // 第二大脑：2026-09-12 起启动即无条件加载，不再有 secondBrainEnabled 键可断言
    // favorites file-sync 整链随关联笔记退役（ADR-0101），仅剩 memo 一路
    expect(syncSpies.ensureFileSync).toHaveBeenCalledTimes(1);
    expect(syncSpies.ensureFileSync).toHaveBeenCalledWith(app);
  }, 15000);
  it('onunload 清理全部裸注册命令', async () => {
    const plugin = await createPlugin(makeMockApp());
    plugin.onunload();

    // ADR-0115：日记本两命令已入 COMMANDS 表，无域内注册增量
    const expectedRemoved = [...EXPECTED_COMMAND_IDS];
    expect(removedCommands.sort()).toEqual(expectedRemoved.sort());
  });

  it('设置持久化（saveData/loadData 往返）', async () => {
    const plugin = await createPlugin(makeMockApp());

    plugin.settings.memoFilePath = '自定义/路径';
    await plugin.saveSettings();
    expect(diskData['bz'].memoFilePath).toBe('自定义/路径');

    // 重新加载时合并默认值
    const plugin2 = await createPlugin(makeMockApp());
    expect(plugin2.settings.memoFilePath).toBe('自定义/路径');
    expect(plugin2.settings.cinemaFolderPath).toBe('我的/影视');
  });
});

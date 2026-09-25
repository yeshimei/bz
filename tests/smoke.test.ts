/**
 * 骨架加载冒烟（ticket 01）：mock obsidian 环境下插件可加载、
 * 25 命令裸注册、ribbon 主入口、设置页挂载、卸载清理命令。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { MockVault } from './mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from './mock-obsidian-entry';
import { notify } from '../src/core/notice';
import { serializeDiaryEntryFile } from '../src/core/diary-format';

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
  // 今日回顾面板已退役（ADR-0157）：bz-recap-today 随批删除，「生成今日总结」迁 home 时间线卡
  'bz-memo-open', 'bz-memo-add',
  // 给当前笔记记一笔（2026-09-11 首页入口菜单）
  'bz-memo-note-binding',
  'bz-belongings-add', 'bz-belongings-open',
  // 年度资产报告（issue 356：报告页直开，面板未开也从盘载库）
  'bz-belongings-report',
  // 剪藏本（clipbook 融合域，ADR-0082）：聚合讯未读流+剪藏笔记一体化；旧 bz-clipping-open/bz-news-open 断开
  'bz-clipbook-open',
  // 未读全部标为已读（2026-09-11 首页入口菜单；跨全库批量已读）
  'bz-clipbook-mark-all-read',
  // 立即抓取（issue 302 / ADR-0128：插件内抓取的手动入口，忽略间隔）
  'bz-clipbook-fetch-now',
  // 剪藏阅读报告（issue 358「我读了什么」：剪藏本自有阅读流水报告弹层）
  'bz-clipbook-report',
  // 自动摘要（enh-autosum 包 1）：当前剪藏笔记手动重跑 AI 摘要
  'bz-auto-summary-redo',
  // 统一保险库（encrypt 域，ADR-0085）：密码/笔记/日记合一
  // 密码本（password-vault 域，ADR-0109 拆回独立域恢复 bz-password-vault-open）
  // 日记本（diary 域，ADR-0115 由回忆墙升格）：日记数据的媒体优先视图 + 写日记入口
  'bz-diary-open', 'bz-diary-write',
  'bz-favorites-open', 'bz-favorites-add',
  // 脸谱本（people 域，issue 435/ADR-0191：微信聊天导入 + AI 生成脸谱）
  'bz-people-open', 'bz-people-import',
  // 旧书库（library）域退役：bz-library-open/bz-book-notes-open 已删（读书笔记入书架墙详情弹窗）
  'bz-reading-report-open',
  // ADR-0090：独立报告窗退役，原报告命令 id 换 bz-cinema-analysis（2026-09-22 起重写为独立全屏《观影志》26 幕；命令 id 与首页入口不变）
  'bz-cinema-analysis',
  'bz-cinema-open', 'bz-cinema-add',
  // 随机抽一部（2026-09-11 首页入口菜单；想看池随机直开详情）
  'bz-cinema-random-pick',
  // 游戏架（gameshelf 域，issue 368：Steam 直连自动拉库）
  'bz-gameshelf-open',
  // 立即同步 / 数据统计（2026-09-17 首页入口菜单：前者不开面板直接拉，后者开面板落统计页）
  'bz-gameshelf-sync', 'bz-gameshelf-stats',
  // 书架墙（bookshelf 域，新域与书库并存）
  'bz-bookshelf-open',
  // 继续在读（2026-09-11 首页入口菜单；开书架墙落「在读」分栏）
  'bz-bookshelf-continue',
  'bz-review-open', 'bz-review-report', 'bz-review-start', 'bz-review-add', 'bz-review-remove', 'bz-review-overdue', 'bz-review-rate',
  // 记忆分析特刊（analysis/）：全屏逐幕分析层入口
  'bz-review-analysis',
  // 做题练习（issue 362）：做题家独立面板入口
  'bz-review-quiz-open',
  // 评级四命令保留（issue 362 做题家面板依赖，原 issue 364 裁剪案撤回；难度弹窗仍为无热键时的面板外评级入口）
  'bz-review-again', 'bz-review-hard', 'bz-review-good', 'bz-review-easy',
  'bz-secondbrain-panel', 'bz-secondbrain-open', 'bz-secondbrain-chat',
  // 重建索引（2026-09-11 首页入口菜单；函数早已存在、此前无命令入口）
  'bz-secondbrain-rebuild-index',
  // 本周知识动态（issue 360：每周知识摘要，启动静默聚合 + 手动重聚详情弹层）
  'bz-secondbrain-weekly',
  'bz-pomodoro-open',
  // 开始/停止专注（2026-09-10：首页入口菜单联动）
  'bz-pomodoro-focus-toggle',
  // 跳过休息 / 暂停·继续（2026-09-11 首页入口菜单；相位派发的单动作，见 core/pomodoro-phase）
  'bz-pomodoro-skip', 'bz-pomodoro-pause',
  'bz-knowledge-open', 'bz-knowledge-note-term',
  // 视频生成文献笔记（2026-09-10：首页入口菜单联动）
  'bz-knowledge-note-video',
  // 段落/图版生成文献笔记（issue 326：与名词同款快捷命令——选区预填 + 当前笔记来源）
  'bz-knowledge-note-passage', 'bz-knowledge-note-image',
  // 挂载树白板（issues 317/319）：看挂载树（主卡 = 当前打开的笔记）/ 重跑挂载建议
  'bz-knowledge-mount-tree', 'bz-knowledge-mount-refresh',
  // 自动关联（ADR-0141 §1：两条建链命令随功能归属迁入知识盒，引擎留第二大脑）
  'bz-knowledge-relink', 'bz-knowledge-link-all',
  'bz-attach-move',
  // 统一保险库（ADR-0085）：加密笔记 + 加密日记 + 加密当前笔记（ADR-0158：密码资产视图
  // 与快速复制密码命令退役，快速取密统一归 bz-password-vault-gen）
  // 注意：bz-encrypt-lock 是历史遗留 id，实际动作是「加密当前笔记」；
  // 锁定保险库（2026-09-11 首页入口菜单）另用 bz-encrypt-lock-vault，避免撞 id
  'bz-encrypt-open', 'bz-encrypt-lock',
  'bz-encrypt-lock-vault',
  // 密码本（password-vault 域，ADR-0109 拆回独立域）
  'bz-password-vault-open',
  // 快速取密（ADR-0158 统一流：fuzzy 列现有密码 + 顶部「生成新」；id 承接旧「快速生成密码」）
  'bz-password-vault-gen',
  // 快速生成密码（2026-09-24 首页右键菜单：跳过选择器直接生成复制 + 记待存状态，
  // 下次解锁密码本自动弹录入窗预填）
  'bz-password-vault-quick-gen',
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
    // issue 358：剪藏阅读报告（与 bz-reading-report-open 书库报告并列的自有报告）
    expect(byId('bz-clipbook-report').name).toBe('剪藏阅读报告');
    expect(byId('bz-clipbook-report').icon).toBe('newspaper');
    expect(byId('bz-memo-add').name).toBe('加备忘录');
    // t2：四套叫法统一「阅读分析报告」（走查批 D；home 磁贴保留短名「阅读报告」）
    expect(byId('bz-reading-report-open').name).toBe('阅读分析报告');
    // f3：评级四命令去英文后缀（issue 362 起做题家面板依赖，保留）；呈报#56/R12 动宾式更名
    expect(byId('bz-review-again').name).toBe('复习评级：忘了');
    expect(byId('bz-review-hard').name).toBe('复习评级：困难');
    expect(byId('bz-review-good').name).toBe('复习评级：一般');
    expect(byId('bz-review-easy').name).toBe('复习评级：简单');
    // issue 362：做题家独立面板入口（graduation-cap 与复习域设置分组「做题家」同款）
    expect(byId('bz-review-quiz-open').name).toBe('做题练习');
    expect(byId('bz-review-quiz-open').icon).toBe('graduation-cap');
    // f7：第二大脑面板与第二大脑参考区分（不再与功能名歧义）
    expect(byId('bz-secondbrain-panel').name).toBe('第二大脑面板');
    expect(byId('bz-secondbrain-open').name).toBe('第二大脑参考');
    // issue 360：本周知识动态（图标 calendar-days，与复习报告 calendar-check 错开）
    expect(byId('bz-secondbrain-weekly').name).toBe('本周知识动态');
    expect(byId('bz-secondbrain-weekly').icon).toBe('calendar-days');
    expect(byId('bz-secondbrain-weekly').icon).not.toBe(byId('bz-review-report').icon);
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
    const { openAddDialog } = await import('../src/diary/ui/dialogs');
    await expect(ensureDiary(app as any)).resolves.toBeUndefined();
    await expect(ensureDiary(app as any)).resolves.toBeUndefined();
    // D15 回归（一致#2 迁 uiModal 壳后语义更新）：写链路弹窗改「按需构建、关即拆」——
    // ensure 后 body 不再有常驻 mask；开着时卸载必须按 id 摘干净（openAddDialog 即开）
    expect(document.getElementById('diary-tag-selector-mask')).toBeNull();
    expect(document.getElementById('add-diary-mask')).toBeNull();
    openAddDialog();
    expect(document.getElementById('add-diary-mask')).not.toBeNull();
    unloadDiary();
    expect(document.getElementById('add-diary-mask')).toBeNull();
  });

  it('日记本后台预热（②）：启动调度真实读盘填缓存、只热数据不建 DOM；unload 复位（ADR-0003 兼容）', async () => {
    const app = makeMockApp();
    const vault = app.vault as MockVault;
    vault.files.set(
      '我的/日记/2601010800.md',
      serializeDiaryEntryFile({ date: '2026-01-01', time: '08:00' }, ['日记'], '预热样张')
    );
    let diaryReads = 0;
    const real = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async (f: any) => {
      if (f && typeof f.path === 'string' && f.path.startsWith('我的/日记/')) diaryReads++;
      return real(f);
    });
    const plugin = await createPlugin(app); // onLayoutReady（mock 同步回调）内已调度 prewarmDiary
    const { prewarmDiary } = await import('../src/diary');
    expect(() => prewarmDiary(app as any, () => false)).not.toThrow(); // 幂等：已调度过，二次调用不抛
    // 等 rAF + setTimeout(0) 一拍落地（预热真实读盘）
    const t0 = Date.now();
    while (diaryReads === 0 && Date.now() - t0 < 1000) await new Promise((r) => setTimeout(r, 10));
    expect(diaryReads).toBeGreaterThan(0); // 预热真的走到了读盘
    // 关键不变量：预热只读数据，绝不拉起日记本面板 DOM
    expect(document.querySelector('.bz-diary')).toBeNull();
    const { loadWallEntries } = await import('../src/diary/data');
    const before = diaryReads;
    const entries = await loadWallEntries(app as any); // 开墙首读命中预热缓存
    expect(entries.some((e) => e.content.includes('预热样张'))).toBe(true);
    expect(diaryReads).toBe(before); // 命中缓存，不再读盘
    await plugin.onunload(); // unloadDiary → 缓存/订阅复位
    await loadWallEntries(app as any);
    expect(diaryReads).toBeGreaterThan(before); // 复位后重新读盘
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
    // issue 429：重排模型留空 = 用内置默认（secondbrain/config RERANK_MODEL）
    expect(s.secondBrainRerankModel).toBe('');
    // issue 431/ADR-0189：重排走 Jev 默认关——存量用户行为零变化
    expect(s.secondBrainRerankJev).toBe(false);
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
    // 备忘录面板皮肤（issue 210 四轮；2026-09-22 拍板：默认由纸感手账改为编辑部）
    expect(s.memoSkin).toBe('editorial');
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

  it('语音转写设置（issue 444 冒烟）：新键默认值 + knowledgeWhisperModel 一次性迁移到 asrWhisperModel', async () => {
    // 默认：引擎 sensevoice / 档位 small；退役键不再有值
    const plugin = await createPlugin(makeMockApp());
    expect(plugin.settings.asrEngine).toBe('sensevoice');
    expect(plugin.settings.asrWhisperModel).toBe('small');
    expect((plugin.settings as any).knowledgeWhisperModel).toBeUndefined();

    // 存量 data.json 带旧键 → onload 迁移（读旧写新删旧），Python 路径键不受影响
    delete diskData['bz'];
    diskData['bz'] = { knowledgeWhisperModel: 'medium', knowledgePythonPath: 'py' };
    const plugin2 = await createPlugin(makeMockApp());
    expect(plugin2.settings.asrWhisperModel).toBe('medium');
    expect(plugin2.settings.asrEngine).toBe('sensevoice'); // 引擎键新增，无旧可迁走缺省
    expect((plugin2.settings as any).knowledgeWhisperModel).toBeUndefined();
    expect(plugin2.settings.knowledgePythonPath).toBe('py'); // 两引擎共用，迁移零扰动
    delete diskData['bz'];
  });

  it('番茄钟统计两档（issue 357）：bz-pomodoro-open 打开弹窗含「近 7 天 / 近 6 月」切换与双柱区', async () => {
    const { unloadPomodoro } = await import('../src/pomodoro');
    const plugin = await createPlugin(makeMockApp());
    registeredCommands.find((c: any) => c.id === 'bz-pomodoro-open')!.callback();
    await vi.waitFor(() => {
      expect(document.getElementById('pomodoro-popup')).toBeTruthy();
    });
    // 统计区两档 tab + 双柱区容器（近 7 天明细 / 近 6 月趋势，与原型共用 render.ts 单源 markup）
    expect(document.getElementById('pomodoro-stat-tab-week')!.textContent).toBe('近 7 天');
    expect(document.getElementById('pomodoro-stat-tab-month')!.textContent).toBe('近 6 月');
    expect(document.getElementById('pomodoro-week')).toBeTruthy();
    expect(document.getElementById('pomodoro-months')!.hidden).toBe(true); // 默认近 7 天档
    unloadPomodoro(); // 清理弹窗与域内存态，不污染后续用例
  });
});

describe('收藏本标签自定义数据契约（issue 363 修订冒烟）', () => {
  it('favorites.json 纯数组根契约不动；标签定义走 data.json 设置键 favoriteTags，缺省回退内置 9 类', async () => {
    const { DataManager } = await import('../src/favorites/data');
    const { getTags, resetTagsState, DEFAULT_TAGS } = await import('../src/favorites/config');
    const { DEFAULT_SETTINGS } = await import('../src/settings');
    resetTagsState();
    // 设置键缺省 []（seed 不预落盘）→ 未自定义 = 内置 9 类 seed 运行时回退
    expect(DEFAULT_SETTINGS.favoriteTags).toEqual([]);
    expect(getTags().map((t) => t.id)).toEqual(
      ['github', 'desktop', 'web', 'llm', 'pi', 'claude', 'skills', 'pub', 'dsh']
    );
    expect(getTags()).toBe(DEFAULT_TAGS);
    // favorites.json 顶层保持纯条目数组（主页.js 读 favorites.length、checkup 纯数组漂移检查
    // 零扰动）；DataManager 不再持有伴生文件路径/store——定义本体在 data.json 设置键
    const dm = new DataManager('CONFIG/STORAGE/favorites.json');
    expect((dm as any).tagsPath).toBeUndefined();
    expect((dm as any).tagsStore).toBeUndefined();
    resetTagsState();
  });
});

describe('复习拟合全参放开（issue 361 冒烟）', () => {
  it('fitFromItems 分档：<300 对基础八参（不越界动 w[8..]）、≥300 对全 19 参；契约版本常量 1/2', async () => {
    const { fitFromItems } = await import('../src/review/fit');
    const { DEFAULT_W } = await import('../src/review/fsrs');
    const { FIT_PARAMS_VERSION } = await import('../src/review/data');
    // FSRS 相位形态历史（stability 标记 + 逐日时间戳 + 混合评级）
    const mk = (n: number) => [
      {
        reviewHistory: Array.from({ length: n }, (_, i) => ({
          timestamp: new Date(Date.UTC(2025, 0, 1) + i * 86400e3).toISOString(),
          stage: 10,
          rating: ['good', 'easy', 'again', 'hard'][i % 4],
          stability: 5,
          difficulty: 0.3,
        })),
      },
    ];
    const basic = (await fitFromItems(mk(150)))!; // 149 对 → 基础档
    expect(basic.fit.full).toBe(false);
    expect(basic.fit.w).toHaveLength(19);
    for (let i = 8; i < 19; i++) expect(basic.fit.w[i]).toBe(DEFAULT_W[i]); // 基础档不越界
    const full = (await fitFromItems(mk(350)))!; // 349 对 → 全参档
    expect(full.fit.full).toBe(true);
    expect(full.fit.w).toHaveLength(19);
    expect(Number.isFinite(full.fit.logLikelihood)).toBe(true);
    expect(FIT_PARAMS_VERSION.BASIC).toBe(1);
    expect(FIT_PARAMS_VERSION.FULL).toBe(2);
  });
});

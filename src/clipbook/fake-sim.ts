/**
 * 剪藏本行为单源 · sim 启动入口（issue 247/ADR-0106；范式自 cinema/favorites 适配）
 *
 * 评审壳侧启动器：把真行为层（clipbook ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（setApp 真身——core/storage 的 jsonFileStore 真实现跑在
 *     fake vault 上，读改写/留档/写队列全真；getAbstractFileByPath 对目录键做子树合成，
 *     剪藏目录扫描直接可跑，见 fake/fake-obsidian.ts）；
 *   - vault 事件桥：attachObsidianAdapter（core 真实现）把 FakeVault 的
 *     create/modify/delete 转译为 clipping:file-* 域事件——跨 iframe storage 桥 +
 *     300ms 防抖自动刷新与插件同一条链；
 *   - 种子数据：window.CLIP_DATA（prototype-data.js，真实库同构快照：63 未读 +
 *     10 已处理骨架 + 8 篇剪藏笔记；正文截断、cookie/守护配置不入种子）或评审壳父页
 *     同名全局，首启写入 fake vault 的 CONFIG/STORAGE/news.json、clipbook.json 与
 *     `归档/网页剪藏/*.md`；stats.byDate 以「当天」动态构造（今日已读脚注恒可演示）；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现可用，注入剪藏本实际键）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_clipbook，iframe 壳只调 boot + openPanel。
 * 插件的 ui.ts / render.ts / store.ts / flow.ts / loader.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, seedVaultFile } from './fake/fake-obsidian';
import { setApp } from '../core/app';
import { setSettingsProvider, setSettingsSaver } from '../core/settings-provider';
import { attachObsidianAdapter } from '../core/obsidian-adapter';
import { openClipbook, unloadClipbook } from './index';
import { closePanel as closePanelReal } from './ui';

/** 剪藏目录（与插件默认值同值；种子与扫描共用） */
const CLIP_DIR = '归档/网页剪藏';
/** 种子标记：存在 = 已种子过（用户在评审壳里的增删改保留，不被覆盖） */
const SEED_MARK = 'bz-sim:__clipbook-seed-v1';
/** 设置持久键（设置保存经 saveSettings 通道写入 localStorage；自检可断言） */
const SETTINGS_KEY = 'bz-sim:__settings';

/** fake vault 内数据文件路径（localStorage 键 = bz-sim: 前缀 + vault 路径） */
const NEWS_PATH = 'CONFIG/STORAGE/news.json';
const SIDECAR_PATH = 'CONFIG/STORAGE/clipbook.json';

/** prototype-data.js 单条形状（与插件 news.json article 字段同名） */
interface SeedArticle {
  platform?: string;
  title?: string;
  url?: string;
  author?: string;
  date?: string;
  fetchedAt?: string;
  body?: string;
  read?: boolean;
  state?: string;
}

interface SeedData {
  NEWS: { articles: SeedArticle[]; upInfo?: Record<string, { name?: string; avatar?: string }> };
  SIDECAR: { articleOverrides: Record<string, { reading?: boolean }>; savedArchive: Array<{ url: string; title: string; savedAt: string }>; order: string[] };
  NOTES: Array<{ path: string; md: string }>;
}

declare global {
  interface Window {
    CLIP_DATA?: SeedData;
  }
}

/** 本地日期键 YYYY-MM-DD（stats.byDate 口径，与 flow localDayKey 同形） */
function dayKey(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86400000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** stats.byDate 演示值：今天/昨天/前天（今日已读 rail 脚注恒可演示） */
function buildByDate(): Record<string, number> {
  return {
    [dayKey(0)]: 7,
    [dayKey(1)]: 12,
    [dayKey(2)]: 5,
  };
}

/** 种子：CLIP_DATA → fake vault（仅首启；剪藏笔记 ctime 按导出序递减） */
function seedDatabase(): void {
  // 自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 CLIP_DATA）
  const src = window.CLIP_DATA || (window.parent && (window.parent as Window).CLIP_DATA) || null;
  if (!src || localStorage.getItem(SEED_MARK)) return;
  seedVaultFile(NEWS_PATH, JSON.stringify({
    articles: src.NEWS.articles,
    stats: { totalRead: 24, totalSaved: 8, totalSkipped: 16, byPlatform: {}, byDate: buildByDate() },
    bilibiliUps: [],
    bilibiliUpInfo: src.NEWS.upInfo || {},
    bilibiliMaxItems: 10,
    bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  seedVaultFile(SIDECAR_PATH, JSON.stringify(src.SIDECAR));
  const base = 1700000000000;
  const n = src.NOTES.length;
  src.NOTES.forEach((note, i) => {
    // ctime 递减：导出序靠前者越新（剪藏扫描排序以 frontmatter created 为准，ctime 仅兜 stat 面）
    seedVaultFile(note.path, note.md, base + (n - i) * 1000);
  });
  localStorage.setItem(SEED_MARK, new Date().toISOString());
}

/** 剪藏本设置 store（真 settings-provider 注入；saveSettings 落 localStorage） */
const settingsStore: Record<string, unknown> = {
  storagePath: 'CONFIG/STORAGE',
  articleDirectory: CLIP_DIR,
  clipbookReaderFontSize: 'medium',
  newsRetentionUnsavedDays: 30,
  clipbookPanelWidth: 0,
  clipbookPanelHeight: 0,
  clipbookMidWidth: 0,
};

/** 设置注入（settings-provider 真实现可用） */
function injectSettings(): void {
  setSettingsProvider(() => settingsStore as never);
  setSettingsSaver(async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsStore));
  });
}

let simApp: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入 + 事件桥；幂等） */
export function bootClipbookSim(): void {
  const g = window as unknown as { __bzClipSimBooted?: boolean };
  if (g.__bzClipSimBooted) return;
  g.__bzClipSimBooted = true;
  seedDatabase();
  // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现依赖链消费面，
  // 运行期以 (app.vault as any) 等访问——类型断言收敛此处差异。
  const app = new FakeApp();
  simApp = app;
  setApp(app as never);
  injectSettings();
  // vault 事件 → 域事件（core 真适配器）：跨 iframe storage 桥也能驱动 300ms 防抖自动刷新
  attachObsidianAdapter(app as never);
}

/** 打开剪藏本（插件 index.openClipbook 同名语义：首开建面板 + show，之后 show） */
export function openPanel(): void {
  if (!simApp) bootClipbookSim();
  openClipbook(simApp as never);
}

/** 关闭剪藏本（ui.closePanel 直通：隐藏 overlay，DOM 保留） */
export function closePanel(): void {
  closePanelReal();
}

/** 卸载（自检/重置演示数据前清态用） */
export function unload(): void {
  unloadClipbook();
}

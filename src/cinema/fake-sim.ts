/**
 * 影院行为单源 · sim 启动入口（issue 245/ADR-0106；范式自 belongings 试点适配）
 *
 * 评审壳侧启动器：把真行为层（cinema ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（setApp 真身——core/ai 的 getApp 取到同一实例）：
 *     vault = localStorage 文件系统，metadataCache = 现场 frontmatter 解析
 *     （见 fake/fake-obsidian.ts——影院数据是 `我的/影视/*.md` 笔记而非 json）；
 *   - vault 事件桥：attachObsidianAdapter（core 真实现）把 FakeVault 的
 *     create/modify/delete/rename 转译为 vault:md-* / cinema:file-* 域事件——
 *     跨 iframe storage 桥 + 防抖自动刷新与插件同一条链；
 *   - 种子数据：window.CINEMA_DATA（prototype-data.js，真实库 50 部同构快照）或评审壳
 *     父页同名全局，首启转写成 fake vault 的 `我的/影视/《片名》.md`（状态 → 评分口径：
 *     想看=-1 / 在看=0 / 已看=评分值；ctime 按导出序递减 → 「加入先后」排序 = 导出序）；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现可用，注入 cinema 实际键）；
 *     AI 设置同一 store（无密钥 → AI 荐片走页内降级，原型不碰真 AI）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_cinema，iframe 壳只调 boot + openCinema。
 * 插件的 ui.ts / data.ts / recommend.ts / analysis.ts / index.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, seedVaultFile } from './fake/fake-obsidian';
import { setApp } from '../core/app';
import { setSettingsProvider, setSettingsSaver } from '../core/settings-provider';
import { setAISettingsProvider } from '../core/ai';
import { attachObsidianAdapter } from '../core/obsidian-adapter';
import { ensureCinema, openCinema as openCinemaDomain } from './index';
import { closeOverlay, openAddModalDirect } from './ui';

/** 影视目录（插件 DEFAULT_FOLDER 同值；种子与自动刷新前缀共用） */
const FOLDER = '我的/影视';
/** 种子标记：存在 = 已种子过（用户在评审壳里的增删改保留，不被覆盖） */
const SEED_MARK = 'bz-sim:__cinema-seed-v1';
/** 设置持久键（设置弹窗保存经 saveSettings 通道写入；自检可断言） */
const SETTINGS_KEY = 'bz-sim:__settings';

/** prototype-data.js 单条形状（与插件 CinemaItem 字段同名；status 是中文串） */
interface SeedItem {
  name: string;
  typeTag: string;
  group?: string;
  status: string;
  rating: number | null;
  watchDate: string | null;
  review: string | null;
  poster: string | null;
  genre: string | null;
  director: string | null;
  actors: string | null;
  region: string | null;
  year: string | null;
  doubanRating: string | null;
  doubanUrl: string | null;
  synopsis: string | null;
}

declare global {
  interface Window {
    CINEMA_DATA?: SeedItem[];
  }
}

/** 单行化（种子字段进 frontmatter 必须单行；换行折叠为空格） */
function one(v: unknown): string {
  return String(v ?? '').replace(/\s*\n+\s*/g, ' ').trim();
}

/** 种子条目 → 影视笔记（frontmatter 字段与 data.ts parseMovieFile 消费面同名） */
function mdOf(raw: SeedItem): string {
  const rating =
    raw.status === '想看' ? '-1' : raw.status === '在看' ? '0' : raw.rating == null ? '' : String(raw.rating);
  return [
    '---',
    'tags:',
    `- ${one(raw.typeTag) || '电影'}`,
    `观影日期: ${one(raw.watchDate)}`,
    `评分: ${rating}`,
    `海报: ${one(raw.poster)}`,
    `类型: ${one(raw.genre)}`,
    `导演: ${one(raw.director)}`,
    `主演: ${one(raw.actors)}`,
    `制片国家/地区: ${one(raw.region)}`,
    `上映日期: ${one(raw.year)}`,
    `豆瓣评分: ${one(raw.doubanRating)}`,
    `豆瓣链接: ${one(raw.doubanUrl)}`,
    `简介: ${one(raw.synopsis)}`,
    `影评: ${one(raw.review)}`,
    '---',
    '',
  ].join('\n');
}

/** 种子：CINEMA_DATA → fake vault 的影视笔记（仅首启；ctime 按导出序递减） */
function seedDatabase(): void {
  // 自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 CINEMA_DATA）
  const src = window.CINEMA_DATA || (window.parent && (window.parent as Window).CINEMA_DATA) || null;
  const items = src || [];
  if (localStorage.getItem(SEED_MARK)) return;
  const base = 1700000000000;
  const n = items.length;
  items.forEach((raw, i) => {
    if (!raw || !raw.name) return;
    // ctime 递减：导出序靠前者越新 → 「加入先后」排序 = 导出序（旧壳同语义）
    seedVaultFile(`${FOLDER}/《${raw.name}》.md`, mdOf(raw), base + (n - i) * 1000);
  });
  localStorage.setItem(SEED_MARK, new Date().toISOString());
}

/** 影院设置 store（真 settings-provider 注入；saveSettings 落 localStorage，设置项走插件设置页） */
const settingsStore: Record<string, unknown> = {
  cinemaStyle: 'midnight',
  cinemaFolderPath: FOLDER,
  cinemaSortMode: 'date',
  cinemaStatusFilter: '',
  cinemaGridColumns: '5',
  cinemaMobileDefaultFullscreen: false,
};

/** 设置注入（settings-provider + core/ai 共用同一 store；AI 无密钥 → 荐片走页内降级） */
function injectSettings(): void {
  setSettingsProvider(() => settingsStore as never);
  setSettingsSaver(async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsStore));
  });
  setAISettingsProvider(() => settingsStore as never);
}

let simApp: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入 + 事件桥 + 域初始化；幂等） */
export function bootCinemaSim(): void {
  const g = window as unknown as { __bzCinSimBooted?: boolean };
  if (g.__bzCinSimBooted) return;
  g.__bzCinSimBooted = true;
  seedDatabase();
  // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现依赖链消费面，
  // 运行期以 (app.vault as any) 等访问——类型断言收敛此处差异。
  const app = new FakeApp();
  simApp = app;
  setApp(app as never);
  injectSettings();
  // vault 事件 → 域事件（core 真适配器）：跨 iframe storage 桥也能驱动 300ms 防抖自动刷新
  attachObsidianAdapter(app as never);
  ensureCinema(app as never);
}

/** 打开影院（插件 index.openCinema 同名语义：toggle） */
export function openCinema(): void {
  if (!simApp) bootCinemaSim();
  openCinemaDomain(simApp as never);
}

/** 关闭影院（ui.closeOverlay 直通） */
export function closeCinema(): void {
  closeOverlay();
}

/** 添加影视（命令 bz-cinema-add 同语义：未开面板先建） */
export function addCinemaModal(): void {
  if (!simApp) bootCinemaSim();
  openAddModalDirect(simApp as never);
}

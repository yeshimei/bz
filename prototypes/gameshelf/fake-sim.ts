/**
 * 游戏架行为单源 · sim 启动入口（范式自 cinema/belongings 适配）
 *
 * 评审壳侧启动器：把真行为层（src/gameshelf/ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（setApp 真身）：vault = localStorage 文件系统，
 *     metadataCache = 现场 frontmatter 解析 → 游戏数据就是 `我的/游戏/《名》.md` 笔记；
 *   - 种子 = window.GAMESHELF_DATA（真实 vault 147 篇笔记的同构快照，含平台分项分钟与
 *     有成就标记）→ 首启转写成 fake vault 的游戏笔记，**字段与真机笔记逐键一致**；
 *   - Steam 罐头 = fake/fake-obsidian 的 requestUrl（真响应回放，见该文件头）；
 *   - 设置注入：setSettingsProvider 注入游戏架实际键（SteamID64/密钥/目录/自动同步），
 *     面板因此走「已配置」分支而不是引导态。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_gameshelf，iframe 壳只调 boot + openGameshelf。
 * 插件的 ui.ts / notes.ts / sync.ts / steam.ts / posters.ts / index.ts / core 一律零改动——单源。
 */
import { FakeApp, seedVaultFile, type SeedGame } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { setAISettingsProvider } from '../../src/core/ai';
import { attachObsidianAdapter } from '../../src/core/obsidian-adapter';
import { ensureGameshelf, openGameshelf as openGameshelfDomain, unloadGameshelf } from '../../src/gameshelf/index';
import { closePanel } from '../../src/gameshelf/ui';

/** 游戏目录（插件 DEFAULT_FOLDER 同值；种子与自动刷新前缀共用） */
const FOLDER = '我的/游戏';
/** 种子标记：存在 = 已种子过（用户在壳里的改动保留，不被覆盖）。
 *  ⚠️ 改种子内容必须同一次把版本号 +1——否则浏览器老 localStorage 里的旧种子不会重播。 */
const SEED_MARK = 'bz-sim:__gameshelf-seed-v2';
/** 设置持久键 */
const SETTINGS_KEY = 'bz-sim:__settings';

declare global {
  interface Window {
    GAMESHELF_DATA?: SeedGame[];
  }
}

/** 种子条目 → 游戏笔记（frontmatter 与 notes.ts noteMarkdown 同键同序） */
function mdOf(g: SeedGame): string {
  const lines = [
    '---',
    'tags:',
    '- 游戏',
    `AppID: ${g.appid}`,
    `游玩分钟: ${g.min}`,
    `最后游玩: "${g.last}"`,
    `封面: ${g.cover}`,
    `同步时间: "2026-09-17T05:35:19.664Z"`,
    `已下架: false`,
  ];
  // 中文名：有才写（与真机一致——没回填过的笔记就没有这个键，names.ts 队列会去补）
  if (g.zh) lines.push(`中文名: ${g.zh}`);
  lines.push(
    `图标: ${g.icon || '""'}`,
    `Windows分钟: ${g.win}`,
    `SteamDeck分钟: ${g.deck}`,
    `Mac分钟: ${g.mac}`,
    `Linux分钟: ${g.linux}`,
    `有成就: ${g.ach}`,
    '---',
    '',
    '',
  );
  return lines.join('\n');
}

/** 种子：GAMESHELF_DATA → fake vault 的游戏笔记（仅首启；ctime 按导出序递减） */
function seedDatabase(): void {
  const items = window.GAMESHELF_DATA || [];
  if (localStorage.getItem(SEED_MARK)) {
    // 形状自愈：数组约定的数据被写坏（老种子/手工改）时强制重播，别让页面静默空白
    const broken = items.some((g) => typeof g?.appid === 'number' && !localStorage.getItem(`bz-sim:${FOLDER}/《${g.name}》.md`));
    if (!broken) return;
    localStorage.removeItem(SEED_MARK);
  }
  const base = 1700000000000;
  const n = items.length;
  items.forEach((g, i) => {
    if (!g || !g.appid) return;
    seedVaultFile(`${FOLDER}/《${g.name}》.md`, mdOf(g), base + (n - i) * 1000);
  });
  localStorage.setItem(SEED_MARK, new Date().toISOString());
}

/** 游戏架设置 store（真 settings-provider 注入；与真机 data.json 同键） */
const settingsStore: Record<string, unknown> = {
  gameshelfFolderPath: FOLDER,
  // 真机默认 CONFIG/游戏海报；壳里给空串 → posters.ts 回落默认目录（避免污染演示数据）
  gameshelfPosterFolder: '',
  gameshelfSteamId: '76561198366147295',
  gameshelfSteamApiKey: 'demo-key-not-a-secret-32chars-ok',
  gameshelfAutoSync: true,
};

function injectSettings(): void {
  setSettingsProvider(() => settingsStore as never);
  setSettingsSaver(async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsStore));
  });
  setAISettingsProvider(() => settingsStore as never);
}

let simApp: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入 + 事件桥 + 域初始化；幂等） */
export function bootGameshelfSim(): void {
  const g = window as unknown as { __bzGsSimBooted?: boolean };
  if (g.__bzGsSimBooted) return;
  g.__bzGsSimBooted = true;
  seedDatabase();
  const app = new FakeApp();
  simApp = app;
  setApp(app as never);
  injectSettings();
  attachObsidianAdapter(app as never);
  ensureGameshelf(app as never);
}

/** 打开游戏架（命令 bz-gameshelf-open 同语义：toggle） */
export function openGameshelf(): void {
  if (!simApp) bootGameshelfSim();
  openGameshelfDomain(simApp as never);
}

/** 关闭面板（ui.closePanel 直通） */
export function closeGameshelf(): void {
  closePanel();
}

/** 卸载（main.ts onunload 同链：清海报队列 + 域状态） */
export function unloadGameshelfSim(): void {
  unloadGameshelf();
  simApp = null;
}

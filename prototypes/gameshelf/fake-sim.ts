/**
 * 游戏库行为单源 · sim 启动入口（范式自 cinema/belongings 适配）
 *
 * 评审壳侧启动器：把真行为层（src/gameshelf/ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（setApp 真身）：vault = localStorage 文件系统，
 *     metadataCache = 现场 frontmatter 解析 → 游戏数据就是 `我的/游戏/《名》.md` 笔记；
 *   - 种子 = window.GAMESHELF_DATA（真实 vault 147 篇笔记的同构快照，含平台分项分钟与
 *     有成就标记）→ 首启转写成 fake vault 的游戏笔记，**字段与真机笔记逐键一致**；
 *   - Steam 罐头 = fake/fake-obsidian 的 requestUrl（真响应回放，见该文件头）；
 *   - 设置注入：setSettingsProvider 注入游戏库实际键（SteamID64/密钥/目录/自动同步），
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
import { localAchIconPath, setMediaInterval } from '../../src/gameshelf/posters';
import { achRowText, parseAchievementRows, parseStoreMeta } from '../../src/gameshelf/steam';

/** 游戏目录（插件 DEFAULT_FOLDER 同值；种子与自动刷新前缀共用） */
const FOLDER = '我的/游戏';
/**
 * 评审种子条数上限：0 = 整库（147 款快照，评审默认口径）。交互调试期曾限 3 款
 * （媒体回填「落图 → 重渲」会让评审壳躁动），收尾已复原。若再要小种子评审，
 * 改这里 + 同一次把 SEED_MARK 版本 +1（sync 罐头回放同读此数据源，砍种子即一起砍）。
 */
const SEED_LIMIT = 0;
/** 种子标记：存在 = 已种子过（用户在壳里的改动保留，不被覆盖）。
 *  ⚠️ 改种子内容（含条数上限）必须同一次把版本号 +1——否则浏览器老 localStorage 里的
 *  旧种子不会重播。 */
const SEED_MARK = 'bz-sim:__gameshelf-seed-v9';
/** 设置持久键 */
const SETTINGS_KEY = 'bz-sim:__settings';

declare global {
  interface Window {
    GAMESHELF_DATA?: SeedGame[];
  }
}

/**
 * 罐头 → 该款的 `成就` 属性行（**真解析 + 真序列化**，与插件写盘口径逐字一致）。
 * 壳里种子直接带上全量行，是为了让评审跑的是「属性优先、零网络」那条主路径
 * （而不是每次都靠罐头现拉再回填）。罐头没这款 → 空数组。
 * 尾两段 = 图标本地路径（ADR-0167）：与媒体队列同源（localAchIconPath），
 * 罐头没给的那一色写 `-`（占位符口径与日期/全球率一致）。
 */
function achRowsOf(appid: number): string[] {
  const a = window.GAMESHELF_DETAIL?.ach?.[String(appid)];
  if (!a) return [];
  const d = parseAchievementRows(a.schema, a.player, a.global);
  return d
    ? d.rows.map((r) =>
        achRowText(r, {
          on: r.icon ? localAchIconPath(appid, r.apiName, true) : '',
          off: r.iconGray ? localAchIconPath(appid, r.apiName, false) : '',
        }),
      )
    : [];
}

/**
 * 罐头 store → 该款 `截图源`。
 * **走真解析器**（parseStoreMeta）而不是直接读原始字段：它会顺手做 8 张上限、
 * 「没有截图的不写这个键」等口径，种子这才和插件真机写盘的内容一致。
 */
function shotUrlsOf(appid: number): string[] {
  const entry = window.GAMESHELF_DETAIL?.store?.[String(appid)];
  if (!entry) return [];
  return parseStoreMeta(entry, appid)?.screenshots ?? [];
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
  // 详情时间：除首位游戏外都预置（模拟「全量回填已完成」的库）——backfill.ts 的入队
  // 判定看它；首位留空让壳自检能验证回填链（罐头回放 → 属性落 详情时间）
  if (g.appid !== window.GAMESHELF_DATA?.[0]?.appid) lines.push(`详情时间: "2026-09-18T00:00:00.000Z"`);
  // 成就全量行 + 截图源：模拟「已全量落盘」的笔记，让评审跑「属性优先、零网络」主路径
  const achRows = achRowsOf(g.appid);
  if (achRows.length > 0) {
    lines.push('成就:');
    for (const row of achRows) lines.push(`- ${row}`);
    lines.push(
      `成就已解: ${achRows.filter((r) => r.split(' | ')[2] === '1').length}`,
      `成就总数: ${achRows.length}`,
      // 刻意写**过期**时间：这样点开任一详情都会走「属性过期 → 静默刷新」那条路，
      // 顺带把该款的成就图标与截图补到本地。评审时因此每款一开就是齐的，
      // 不用等全量回填轮到它（回填按 vault 序排队，展示首位那款不一定是第一个）。
      '成就更新: "2026-09-01T00:00:00.000Z"',
    );
  }
  const shots = shotUrlsOf(g.appid);
  if (shots.length > 0) {
    lines.push('截图源:');
    for (const u of shots) lines.push(`- ${u}`);
  }
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
  const items = (window.GAMESHELF_DATA || []).slice(0, SEED_LIMIT > 0 ? SEED_LIMIT : undefined);
  if (localStorage.getItem(SEED_MARK)) {
    // 形状自愈：数组约定的数据被写坏（老种子/手工改）时强制重播，别让页面静默空白
    const broken = items.some((g) => typeof g?.appid === 'number' && !localStorage.getItem(`bz-sim:${FOLDER}/《${g.name}》.md`));
    if (!broken) return;
    localStorage.removeItem(SEED_MARK);
  }
  // 重播 = 整库替换语义：先清旧笔记再种（条数上限收紧后，老的多余笔记不能留下冒充库存）
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`bz-sim:${FOLDER}/`)) localStorage.removeItem(k);
  }
  const base = 1700000000000;
  const n = items.length;
  items.forEach((g, i) => {
    if (!g || !g.appid) return;
    seedVaultFile(`${FOLDER}/《${g.name}》.md`, mdOf(g), base + (n - i) * 1000);
  });
  localStorage.setItem(SEED_MARK, new Date().toISOString());
}

/** 游戏库设置 store（真 settings-provider 注入；与真机 data.json 同键） */
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
  // 条数上限砍在**数据源**上：sync 的罐头回放（GetOwnedGames）也经 globalOf 读
  // GAMESHELF_DATA，且 fake 层会**回落到父窗口**取——只切本 iframe 的话，开面板的
  // 自动同步照样从父窗口把整库 147 款灌回来（2026-09-18 实测）。顶层同源可写，一起切。
  // 壳自检的 DATA 常量在切之前已捕获（指向原数组），?selftest 的条数断言暂按全量口径。
  if (SEED_LIMIT > 0) {
    const sliced = (window.GAMESHELF_DATA || []).slice(0, SEED_LIMIT);
    window.GAMESHELF_DATA = sliced;
    try {
      if (window.parent && window.parent !== window) window.parent.GAMESHELF_DATA = sliced;
    } catch { /* 跨域隔离时放弃（本地壳恒同源） */ }
  }
  seedDatabase();
  // 媒体队列的任务间隔归零：生产那 120ms 是给 Steam CDN 留的礼貌间隔，壳里没有真网络，
  // 留着只会让评审时「图标一张张才出来」（成就图标一款就上百张）
  setMediaInterval(0);
  const app = new FakeApp();
  simApp = app;
  setApp(app as never);
  injectSettings();
  attachObsidianAdapter(app as never);
  ensureGameshelf(app as never);
}

/** 打开游戏库（命令 bz-gameshelf-open 同语义：toggle） */
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

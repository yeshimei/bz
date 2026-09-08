/**
 * 收藏本行为单源 · sim 启动入口（issue 245/ADR-0106，范式随 belongings 试点）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeVault 注入 core/app（core/storage 的 jsonFileStore 真实现跑在 fake vault 上——
 *     读改写/留档/写队列全真，只把「文件系统」换成 localStorage，见 fake/fake-obsidian.ts）；
 *   - 种子数据：window.FAV.ITEMS（prototype-data.js，真实库 51 条同构快照），或评审壳父页
 *     同名全局（iframe 场景 window.parent.FAV），首启写入 fake vault 的 favorites.json
 *     （数组形态，与插件 data 同构）；存储路径走 config.getStoragePath() 真实现（默认
 *     CONFIG/STORAGE/favorites.json）；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现，注入与插件 data.json 同形的默认键）；
 *   - 依赖注入：favorites 的 ui 入口带三参（app/dm/ai，插件侧由 index.ts 域外接线），
 *     本文件 boot 时构造 FakeApp + DataManager（真 data.ts）+ FavoritesAIService（真 ai.ts）
 *     并 initFavoritesUI 注入，openPanel 闭包代传——插件侧 index.ts 的接线形态在壳内等价重现。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_favorites，iframe 壳只调 boot + openPanel。
 * 插件的 ui.ts / data.ts / ai.ts / config.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp } from './fake/fake-obsidian';
import { setApp } from '../core/app';
import { setSettingsProvider } from '../core/settings-provider';
import { getStoragePath } from './config';
import { DataManager } from './data';
import { FavoritesAIService } from './ai';
import {
  initFavoritesUI, openPanel as openPanelReal, closePanel,
  openForm, resetFavoritesState,
} from './ui';

declare global {
  interface Window {
    FAV?: { ITEMS?: Array<Record<string, unknown>>; TAGS?: Array<Record<string, unknown>> };
  }
}

/** fake vault 内 favorites.json 路径（localStorage 键 = bz-sim: 前缀 + vault 路径） */
const VAULT_KEY = 'bz-sim:CONFIG/STORAGE/favorites.json';

let _app: FakeApp | null = null;
let _dm: DataManager | null = null;
let _ai: FavoritesAIService | null = null;

/** 评审壳种子：把原型演示数据写进 fake vault 的 favorites.json（仅当库里没有数据时） */
function seedDatabase(): void {
  // 自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 FAV）
  const src = window.FAV || (window.parent && (window.parent as Window).FAV) || null;
  const items = src?.ITEMS || [];
  // favorites.json = FavoritesItem 数组（data.ts DataManager.read 直读数组）；
  // 已种子过（用户改过数据）不覆盖——保持评审壳内编辑可持久
  if (!localStorage.getItem(VAULT_KEY)) {
    localStorage.setItem(VAULT_KEY, JSON.stringify(items, null, 2));
  }
  // 无条件注入 app（core/storage 的 jsonFileStore 经 getApp() 取——每次启动都要可用）。
  // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现 vault 读写面，
  // 运行期 core/storage 以 (app.vault as any) 访问——类型断言收敛此处差异。
  const app = new FakeApp();
  setApp(app as never);
  _app = app;
  _dm = new DataManager(getStoragePath());
  _ai = new FavoritesAIService();
  initFavoritesUI(_app, _dm, _ai);
}

/** 默认设置（settings-provider 真实现注入；键与插件 data.json 同形） */
function injectSettings(): void {
  setSettingsProvider(
    () =>
      ({} as Record<string, never>) as never
  );
}

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootFavoritesSim(): void {
  const g = window as unknown as { __bzFavSimBooted?: boolean };
  if (g.__bzFavSimBooted) return;
  g.__bzFavSimBooted = true;
  seedDatabase();
  injectSettings();
}

function ensureBoot(): void {
  bootFavoritesSim();
}

/** 打开主面板（真 openPanel 带 app/dm/ai 三参——boot 已构造，闭包代传；toggle 语义同插件） */
export function openPanel(): void {
  ensureBoot();
  openPanelReal(_app as never, _dm as never, _ai as never);
}

export { closePanel, openForm, resetFavoritesState };

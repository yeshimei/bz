/**
 * 日记本行为单源 · sim 启动入口（issue 256/ADR-0115，范式随 favorites/settings-panel 试点）
 *
 * 评审壳侧启动器：把真行为层（墙 ui.ts + 写链路 store/dialogs/entry-actions + data/config
 * 依赖链）在浏览器里跑起来。与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（vault = localStorage 文件系统 + adapter.list 目录面 +
 *     getResourcePath 媒体 URL；metadataCache = frontmatter 现解析 + 媒体链接解析）；
 *   - 种子数据：window.DIARY.FILES（prototype-data.js，真实 vault md 原文快照逐字入库），
 *     首启写入 fake vault 的 我的/日记|影视|信|书库 路径——由真数据链现场解析，
 *     标签/媒体/排序零解析复制（单源不裂）；
 *   - 设置注入：setSettingsProvider（真 settings-provider，注入空默认键——目录走 config
 *     默认回落链）、applyDirectories（真 config，跨域目录解析同插件路径）；
 *   - 入口：openPanel = 真 index.openDiary（ensureDiary + controller.show）；
 *     openWrite = 真 index.openDiaryWrite（bz-diary-write 同链路：摊开册子 → 摆出写作内页）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_diary，iframe 壳调 boot + openPanel
 * （`?write=1` 时改调 openWrite，直达写作内页——见 prototype-view.html）。
 * 插件的 ui.ts / data.ts / store.ts / dialogs.ts 等一律零改动——行为代码单源。
 */
import { FakeApp, encodeSeedFile } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { applyDirectories } from '../../src/diary/config';
import { openDiary, openDiaryWrite, unloadDiary } from '../../src/diary';

declare global {
  interface Window {
    DIARY?: { FILES?: Array<{ path: string; content: string; ctime: number }>; ASSETS?: string[] };
  }
}

/** 种子来源：自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 DIARY） */
function seedSource(): { FILES?: Array<{ path: string; content: string; ctime: number }> } | null {
  return window.DIARY || (window.parent && (window.parent as Window).DIARY) || null;
}

/** 评审壳种子：把真实 vault 快照原文写进 fake vault（仅当库里没有数据时） */
function seedVault(): void {
  const files = seedSource()?.FILES || [];
  if (files.length && !localStorage.getItem('bz-sim:' + files[0].path)) {
    for (const f of files) {
      localStorage.setItem('bz-sim:' + f.path, encodeSeedFile(f.content, { ctime: f.ctime, mtime: f.ctime }));
    }
  }
}

/**
 * 演示数据的三种状态（外景壳「文件夹」开关驱动，走视图 URL 的 state 参数）：
 *   unset  → 不注入目录（未配置：看引导纸）
 *   empty  → 注入目录 + 清掉本域演示文件（配好了但一篇都没有：看空册）
 *   full   → 注入目录 + 确保演示文件齐（有内容：看正常的墙）
 * 清/种都在这里做，壳不必知道 fake vault 的键长什么样。
 */
const LS_SEED = 'bz-sim:';
function applyDataMode(): void {
  let st = '';
  try {
    st = new URLSearchParams(location.search).get('state') || '';
  } catch (e) {
    return;
  }
  const files = (window.DIARY && window.DIARY.FILES) || [];
  if (!files.length) return;
  if (st === 'empty') {
    for (const f of files) localStorage.removeItem(LS_SEED + f.path);
    return;
  }
  for (const f of files) {
    if (!localStorage.getItem(LS_SEED + f.path)) {
      localStorage.setItem(LS_SEED + f.path, JSON.stringify({ c: f.content, ct: f.ctime, mt: f.ctime }));
    }
  }
}

/**
 * 评审开关：视图 URL 带 `dirs=1` → 注入「已配置」的目录（看正常册子）；
 * 不带 → 空设置（看未配置的引导纸）。`state=empty` 再叠一层「没内容」。
 */
function simDirs(): { diaryDirectory?: string; letterDirectory?: string } {
  try {
    return new URLSearchParams(location.search).get('dirs') === '1'
      ? { diaryDirectory: '我的/日记', letterDirectory: '我的/信' }
      : {};
  } catch (e) {
    return {};
  }
}

/** 默认设置（settings-provider 真实现注入；目录走 config 默认回落链，与插件缺省一致） */
function injectSettings(): void {
  setSettingsProvider(() => simDirs() as never);
}

let _app: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootDiarySim(): void {
  const g = window as unknown as { __bzDiarySimBooted?: boolean };
  if (g.__bzDiarySimBooted) return;
  g.__bzDiarySimBooted = true;
  seedVault();
  applyDataMode(); // 种子之后再按 URL 参数收口：state=empty 要能真把刚种下的清掉
  injectSettings();
  const app = new FakeApp();
  setApp(app as never);
  _app = app;
  // 目录常量应用（真 config：影视/书库跨域解析在壳内走默认回落——与插件缺省一致）
  applyDirectories({});
}

/** 打开日记本主窗口（真 index.openDiary：ensureDiary + controller.show） */
export function openPanel(): void {
  bootDiarySim();
  openDiary(_app as never);
}

/** 写日记命令（真 index.openDiaryWrite：bz-diary-write 同链路——先摊开册子，排好再摆写作内页） */
export function openWrite(): void {
  bootDiarySim();
  openDiaryWrite(_app as never);
}

export { unloadDiary };


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
 *     openWrite = 真 index.openDiaryWrite（bz-diary-write 同链路，写日记弹窗直开）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_diary，iframe 壳只调 boot + openPanel。
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

/** 默认设置（settings-provider 真实现注入；目录走 config 默认回落链，与插件缺省一致） */
function injectSettings(): void {
  setSettingsProvider(() => ({}) as never);
}

let _app: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootDiarySim(): void {
  const g = window as unknown as { __bzDiarySimBooted?: boolean };
  if (g.__bzDiarySimBooted) return;
  g.__bzDiarySimBooted = true;
  seedVault();
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

/** 写日记命令（真 index.openDiaryWrite：bz-diary-write 同链路，写日记弹窗直开） */
export function openWrite(): void {
  bootDiarySim();
  openDiaryWrite(_app as never);
}

export { unloadDiary };


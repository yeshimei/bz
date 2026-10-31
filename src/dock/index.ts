/**
 * 工具坞域入口（dock）：外部工具的登记、授权、运行、记账、调度。
 *
 * 契约 v2 —— **不认旧文件、不认旧字段**。整域只有三份真相：
 *  工具目录里的 `manifest.json`（作者写的）、`dock.intent.json`（人定的）、`dock.runtime.json`（机器记的）；
 *  外加数据目录的 `dock.json`（有哪些工具）与本机设置里的 `dockTrust`（授权）。
 *
 * 命令注册在 `main.ts`：`bz-dock-open` 在命令表里，每个已登记的工具另有一条直达运行命令。
 */

import { normalizeRegistryPaths, readRegistry, readTrust, registryPath } from './registry';
import { dirOf } from './files';
import { writeExitPulse } from './exit-pulse';
import { loadToolView } from './view';

export { openDock, closeDock, unloadDock, ensureDock, openToolPanel } from './ui';
export { runToolDirect, dockToolLabel, judgeRunGate } from './command';
export { startDockScheduler, stopDockScheduler, kickDockScheduler, notifyDockEvent } from './host';
export { mountDockStatusBar, unmountDockStatusBar } from './statusbar';

/** 执行依赖注入缝（测试塞假 child_process） */
export { setExecDeps as setDockRuntimeDeps } from './exec';
/** fs 注入缝（测试塞假 fs；移动端指向内存读桥） */
export { setDockFs } from './files';
/** 移动端只读读桥 */
export { installVaultFs, uninstallVaultFs, hasVaultFs, primeVaultFs } from './vault-fs';

/** 登记表读取（main.ts 启动时按它注册直达命令） */
export function readToolEntries(): { id: string; path: string; enabled: boolean }[] {
  const { registry } = readRegistry();
  const trust = readTrust();
  return registry.tools.map((e) => ({
    id: e.id,
    path: e.path,
    enabled: loadToolView(e, { trust }).intent.enabled !== false,
  }));
}

/** 登记表路径与文件名（诊断 / 数据体检用） */
export { registryPath as dockStorePath, DOCK_TRUST_KEY, dockVaultRoot } from './registry';
export const DOCK_STORE_FILENAME = 'dock.json';

/**
 * 插件卸载时留一枚「关闭脉冲」（`dock.exit.json`）。
 *
 * **只记一笔，不起进程** —— 宿主正在退出，这时候拉起来的子进程活不过几秒。
 * 下一拍（Obsidian 关着就是值守，值守也不在就等下次打开）读到它，`obsidian-exit`
 * 规则的判据才会响。重载/禁用插件时进程号没变，脉冲会被 `exitPulseFires` 判掉。
 */
export function markDockExit(): void {
  try {
    const dir = dirOf(registryPath());
    if (dir) writeExitPulse(dir);
  } catch {
    /* 卸载路径上不能抛 */
  }
}

/**
 * 启动时初始化。
 *
 * 只有一件事：把登记表里「在 vault 内的绝对路径」改写成可移植形态（`vault:...`）。
 * 这是为了让同一份登记表在手机、另一台电脑上还能用 —— 路径不可移植，
 * 手机上就永远只能靠「猜仓库名那一段」去读，猜错就是空列表。
 *
 * 读侧一切都是现读，没有需要预热的缓存。
 */
export async function initDock(): Promise<void> {
  try {
    normalizeRegistryPaths();
  } catch {
    /* 归一失败不该拦启动：面板照常打开，只是手机上可能读不到 */
  }
}

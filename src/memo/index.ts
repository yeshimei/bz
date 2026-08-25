/**
 * 备忘录域入口（ticket 04/05）
 * 命令（bz-memo-open-panel / bz-memo-create-item）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureBz 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { App as MemoApp } from './app';
import { UIManager } from './ui';
import type { BzSettingsLike } from './data';
import {
  ensureMemoFileSync as ensureFileSyncAgent,
  unloadMemoFileSync as unloadFileSyncAgent,
} from './file-sync';
import { ensureClipArchive, unloadClipArchive } from './clip-archive';

let settingsProvider: (() => BzSettingsLike) | null = null;

/** main.ts 注入插件设置读取器 */
export function setBzSettingsProvider(fn: () => BzSettingsLike): void {
  settingsProvider = fn;
}

function getBzSettings(): BzSettingsLike {
  return settingsProvider ? settingsProvider() : {};
}

export async function ensureBz(app: App): Promise<void> {
  if (MemoApp.initialized) return;
  await MemoApp.init(getBzSettings());
}

export function openBzPanel(app: App): void {
  void ensureBz(app).then(() => {
    UIManager.showMain(null, false);
  });
}

export function createMemoItem(app: App): void {
  void ensureBz(app).then(() => {
    UIManager.showAddDialog(null);
  });
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadBz(): void {
  MemoApp.unload();
}

// ---------- 自 ai-agent 拆入：引用同步 + 剪藏 AI 匹配归档（main 只调这一对入口） ----------

/**
 * 引用同步总装入口：备忘录实例（DataManager，归档写路径依赖，原 ensureAIAgent 的
 * ensureBz 语义）+ memo.json rename/delete 引用同步 + 剪藏 AI 匹配归档订阅一并安装。
 * 幂等；DOM 缺失环境（如纯 node 数据层测试）下 ensureBz 失败被静默跳过，
 * 不影响纯 JSON 读写的引用同步。
 */
export async function ensureMemoFileSync(app: App): Promise<void> {
  try {
    await ensureBz(app);
  } catch (e) { /* DOM 缺失环境：跳过面板初始化 */ }
  ensureFileSyncAgent(app);
  ensureClipArchive(app);
}

/** 总卸载入口：退订引用同步与剪藏归档监听并重置各自模块状态（各自幂等） */
export function unloadMemoFileSync(): void {
  unloadFileSyncAgent();
  unloadClipArchive();
}

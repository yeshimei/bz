/**
 * 游戏库（gameshelf）域同步编排（issue 368）：配置校验 → 间隔判定 → 拉库 → 对账落盘 → 域事件。
 * 节律仿 clipbook fetch：打开面板自动同步（lastSyncAt 间隔判定）+ 手动「立即同步」（忽略间隔）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { pad2 } from '../core/ui/str';
import { M, resolveGameshelfFolderPath, readSteamConfig } from './state';
import { rebuildItems, applySyncPlan } from './notes';
import { fetchSteamLibrary } from './steam';

/** 自动同步最小间隔：30 分钟（打开面板不必每开必拉，Steam 无增量推送、全量拉库不便宜） */
export const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

export interface SyncSummary {
  ok: boolean;
  added: number;
  updated: number;
  offShelf: number;
  /** 失败原因（ok=false 时）：config=未配置 auth=密钥无效 network=网络/代理 http=接口异常 */
  reason?: 'config' | 'auth' | 'network' | 'http' | 'busy';
  message?: string;
}

/** 全库最近一次同步时刻（各笔记 syncedAt 取 max；无笔记 → 0 = 永远过期） */
export function lastSyncedAt(syncedAts: string[]): number {
  let max = 0;
  for (const s of syncedAts) {
    const t = Date.parse(s);
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max;
}

/** 打开面板自动同步判定：无任何笔记 → 必拉；最近一次同步超间隔 → 拉取 */
export function isSyncDue(syncedAts: string[], now = Date.now()): boolean {
  return now - lastSyncedAt(syncedAts) >= AUTO_SYNC_INTERVAL_MS;
}

/**
 * 同步主入口。force=true 忽略间隔（手动「立即同步」）。
 * 进行中重入返回 busy（面板按钮态在 ui 层已防，命令/自动路径兜底）。
 */
export async function runSync(app: App, opts?: { force?: boolean }): Promise<SyncSummary> {
  if (M.syncing) return { ok: false, added: 0, updated: 0, offShelf: 0, reason: 'busy' };
  const folder = resolveGameshelfFolderPath();
  const syncedAts = rebuildItems(app)
    .map((it) => it.syncedAt || '')
    .filter(Boolean);
  if (!opts?.force && !isSyncDue(syncedAts)) {
    M.statusMsg = `游戏库已是最新（${fmtTime(new Date(lastSyncedAt(syncedAts)))}同步）`;
    return { ok: true, added: 0, updated: 0, offShelf: 0 };
  }
  const { steamId, apiKey } = readSteamConfig();
  if (!steamId.trim() || !apiKey.trim()) {
    return { ok: false, added: 0, updated: 0, offShelf: 0, reason: 'config', message: '尚未配置 SteamID64 与 Web API 密钥' };
  }
  M.syncing = true;
  M.statusMsg = '正在从 Steam 拉取游戏库…';
  M.renderFn?.();
  try {
    const result = await fetchSteamLibrary(steamId, apiKey);
    if (!result.ok) {
      M.statusMsg = result.message;
      notice(`游戏库同步失败：${result.message}`, 'error');
      return { ok: false, added: 0, updated: 0, offShelf: 0, reason: result.reason, message: result.message };
    }
    const r = await applySyncPlan(app, folder, result.owned, new Date().toISOString());
    rebuildItems(app);
    const parts: string[] = [];
    if (r.added > 0) parts.push(`新增 ${r.added}`);
    if (r.updated > 0) parts.push(`更新 ${r.updated}`);
    if (r.offShelf > 0) parts.push(`下架标记 ${r.offShelf}`);
    // 库内无变化 → 状态行留空（用户 2026-09-17：「同步完成：库内无变化」是噪音，
    // 每次点立即同步都挂一行「什么都没发生」；真有事才说话）
    M.statusMsg = parts.length > 0 ? `同步完成：${parts.join('，')}` : '';
    if (parts.length > 0) {
      notice(`游戏库已同步：${parts.join('，')}`, 'success');
    }
    // 行为流观察事件（emit-and-forget，零成本）：当前全仓无订阅方——原注释「smartcat 消费」
    // 系虚指已修正（深审 C6）；真接行为流时再按总线 `<域名>:<事件>` 约定定形制
    emitDomainEvent('gameshelf', { kind: 'synced', added: r.added, updated: r.updated, offShelf: r.offShelf });
    return { ok: true, ...r };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    M.statusMsg = `同步失败：${msg}`;
    notice(`游戏库同步失败：${msg}`, 'error');
    return { ok: false, added: 0, updated: 0, offShelf: 0, reason: 'http', message: msg };
  } finally {
    M.syncing = false;
    M.renderFn?.();
  }
}

function fmtTime(d: Date): string {
  // 补零走 core/ui/str 单源 pad2（深审 C2：域内 padStart 局部补零收编，纯层零依赖可直测）
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 打开面板路径：已配置且自动同步开才拉；间隔判定在 runSync 内（无笔记 syncedAt=0 必过期 → 首拉必跑）。
 * 返回 runSync 的 promise（深审 F1：此前 fire-and-forget，index.afterOpen 的 await 落空——
 * 首开空库/新游戏入账后三队列拿到的还是同步前的旧 M.items，媒体/中文名/回填整批漏启动）。
 * 未配置 / 已关自动同步 → 同步返回 undefined，调用方 await 立即通过，行为不变。
 */
export function autoSyncOnOpen(app: App): Promise<void> | undefined {
  const s = tryGetSettings() as Record<string, unknown>;
  if (s.gameshelfAutoSync === false) return undefined; // 关闭回落纯手动（「立即同步」不受影响）
  const { steamId, apiKey } = readSteamConfig();
  if (!steamId.trim() || !apiKey.trim()) return undefined;
  return runSync(app).then(() => M.renderFn?.());
}

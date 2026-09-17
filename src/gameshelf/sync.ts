/**
 * 游戏架（gameshelf）域同步编排（issue 368）：配置校验 → 间隔判定 → 拉库 → 对账落盘 → 域事件。
 * 节律仿 clipbook fetch：打开面板自动同步（lastSyncAt 间隔判定）+ 手动「立即同步」（忽略间隔）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { M, resolveGameshelfFolderPath } from './state';
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

/** Steam 配置读取（详情按需拉取与同步共用；无配置 → 空串） */
export function readSteamConfig(): { steamId: string; apiKey: string } {
  return readConfig();
}

function readConfig(): { steamId: string; apiKey: string } {
  const s = tryGetSettings() as Record<string, unknown>;
  return {
    steamId: typeof s.gameshelfSteamId === 'string' ? s.gameshelfSteamId : '',
    apiKey: typeof s.gameshelfSteamApiKey === 'string' ? s.gameshelfSteamApiKey : '',
  };
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
  const { steamId, apiKey } = readConfig();
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
      notice(`游戏架同步失败：${result.message}`, 'error');
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
      notice(`游戏架已同步：${parts.join('，')}`, 'success');
    }
    // 行为流观察（smartcat 消费；emit-and-forget，无订阅方零成本）
    emitDomainEvent('gameshelf', { kind: 'synced', added: r.added, updated: r.updated, offShelf: r.offShelf });
    return { ok: true, ...r };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    M.statusMsg = `同步失败：${msg}`;
    notice(`游戏架同步失败：${msg}`, 'error');
    return { ok: false, added: 0, updated: 0, offShelf: 0, reason: 'http', message: msg };
  } finally {
    M.syncing = false;
    M.renderFn?.();
  }
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 打开面板路径：已配置且自动同步开才拉；间隔判定在 runSync 内（无笔记 syncedAt=0 必过期 → 首拉必跑） */
export function autoSyncOnOpen(app: App): void {
  const s = tryGetSettings() as Record<string, unknown>;
  if (s.gameshelfAutoSync === false) return; // 关闭回落纯手动（「立即同步」不受影响）
  const { steamId, apiKey } = readConfig();
  if (!steamId.trim() || !apiKey.trim()) return;
  void runSync(app).then(() => M.renderFn?.());
}

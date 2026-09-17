/**
 * 游戏架（gameshelf）域 Steam 通道（issue 368 / 研究票 347）：
 * GetOwnedGames + GetRecentlyPlayedGames 直连拉库，封面 CDN 直拼。
 *
 * 实测口径（2026-09-17 主会话真机验证，.scratch/memo-suite-plugin/research/347-steam-live-test.md）：
 * - api.steampowered.com 国内网络直连常被重置，requestUrl 跟随系统代理可用——
 *   网络层失败与密钥错误必须分开报错（网络错提示查代理，不能一律「密钥无效」）。
 * - GetOwnedGames 空库时 response.games 缺省（非空数组）；GetRecentlyPlayedGames
 *   近两周没玩时 total_count=0 且 games 缺省——两处都按缺省兜底。
 * - 单条字段：playtime_forever=分钟、rtime_last_played=unix 秒；无 img_logo_url，
 *   封面走 header.jpg 直拼（CDN 不走代理也可达）。
 */
import { requestUrl } from 'obsidian';
import { withTimeout } from '../core/http';

const API_BASE = 'https://api.steampowered.com';
const REQUEST_TIMEOUT_MS = 20_000;

/** 库内单款游戏（GetOwnedGames 归一后） */
export interface SteamOwnedGame {
  appid: number;
  name: string;
  /** 累计游玩分钟（Steam playtime_forever 原值） */
  playtimeMin: number;
  /** 最后游玩 unix 毫秒（rtime_last_played 秒 ×1000；从未玩为 0） */
  lastPlayedTs: number;
}

/** 近两周在玩单款（GetRecentlyPlayedGames 归一后） */
export interface SteamRecentGame {
  appid: number;
  name: string;
  /** 近两周游玩分钟 */
  playtime2weeksMin: number;
}

export type SteamFetchResult =
  | { ok: true; owned: SteamOwnedGame[]; recent: SteamRecentGame[] }
  | { ok: false; reason: 'config' | 'network' | 'auth' | 'http'; message: string };

/** 封面直拼（CDN 独立于 API 通道，直连可达） */
export function steamCoverUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

/** SteamID64 形态粗校验：17 位纯数字（前缀恒 7656） */
export function isValidSteamId(steamId: string): boolean {
  return /^7656\d{13}$/.test(steamId.trim());
}

/** GET JSON：2xx → 解析体；HTTP 错误带状态码上抛（交调用方分流文案） */
async function getJson(url: string): Promise<unknown> {
  try {
    const resp = await withTimeout(requestUrl({ url, method: 'GET', throw: false }), REQUEST_TIMEOUT_MS, 'Steam Web API');
    if (resp.status === 401 || resp.status === 403) throw new SteamHttpError('auth', resp.status);
    if (resp.status >= 400) throw new SteamHttpError('http', resp.status);
    return resp.json;
  } catch (e) {
    if (e instanceof SteamHttpError) throw e;
    // requestUrl 网络错（连接重置/超时包裹）统一归 network——用户侧提示查网络与代理
    throw new SteamHttpError('network', undefined, e instanceof Error ? e.message : String(e));
  }
}

class SteamHttpError extends Error {
  constructor(public reason: 'network' | 'auth' | 'http', public status?: number, detail?: string) {
    super(detail || `Steam HTTP ${status ?? ''}`);
  }
}

/** 拉整库 + 近两周（recent 失败可容忍：库同步不因最近在玩接口抖动而整体失败） */
export async function fetchSteamLibrary(steamId: string, apiKey: string): Promise<SteamFetchResult> {
  if (!isValidSteamId(steamId)) {
    return { ok: false, reason: 'config', message: 'SteamID64 未填写或格式不对（应为 17 位数字）' };
  }
  if (!apiKey.trim()) {
    return { ok: false, reason: 'config', message: 'Web API 密钥未填写，请在设置面板游戏架页填入' };
  }
  const id = steamId.trim();
  const key = apiKey.trim();
  let ownedRaw: unknown;
  try {
    ownedRaw = await getJson(
      `${API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${id}` +
      `&include_appinfo=true&include_played_free_games=true&skip_unvetted_apps=0`,
    );
  } catch (e) {
    const err = e as SteamHttpError;
    if (err.reason === 'auth') {
      return { ok: false, reason: 'auth', message: 'Web API 密钥无效或已被吊销，请去 Steam 开发者页重新生成' };
    }
    if (err.reason === 'http') {
      return { ok: false, reason: 'http', message: `Steam 接口返回异常（${err.status}），稍后重试` };
    }
    return { ok: false, reason: 'network', message: '连不上 Steam 接口：请检查网络，国内网络需系统代理开启后再同步' };
  }
  let recentRaw: unknown = null;
  try {
    recentRaw = await getJson(`${API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${encodeURIComponent(key)}&steamid=${id}`);
  } catch {
    recentRaw = null; // 容忍：最近在玩是增强信息，拉不到不影响库存对账
  }
  return { ok: true, owned: parseOwnedGames(ownedRaw), recent: parseRecentGames(recentRaw) };
}

/** GetOwnedGames 响应 → 归一条目（空库/字段缺省兜底，坏条目跳过） */
export function parseOwnedGames(raw: unknown): SteamOwnedGame[] {
  const games = (raw as any)?.response?.games;
  if (!Array.isArray(games)) return [];
  const out: SteamOwnedGame[] = [];
  for (const g of games) {
    const appid = Number(g?.appid);
    if (!Number.isFinite(appid) || appid <= 0) continue;
    out.push({
      appid,
      name: typeof g?.name === 'string' && g.name ? g.name : `App ${appid}`,
      playtimeMin: Number.isFinite(Number(g?.playtime_forever)) ? Math.max(0, Math.floor(Number(g.playtime_forever))) : 0,
      lastPlayedTs: Number.isFinite(Number(g?.rtime_last_played)) ? Math.max(0, Math.floor(Number(g.rtime_last_played)) * 1000) : 0,
    });
  }
  return out;
}

/** GetRecentlyPlayedGames 响应 → 归一条目（没玩时 games 缺省 → 空数组） */
export function parseRecentGames(raw: unknown): SteamRecentGame[] {
  const games = (raw as any)?.response?.games;
  if (!Array.isArray(games)) return [];
  const out: SteamRecentGame[] = [];
  for (const g of games) {
    const appid = Number(g?.appid);
    if (!Number.isFinite(appid) || appid <= 0) continue;
    out.push({
      appid,
      name: typeof g?.name === 'string' && g.name ? g.name : `App ${appid}`,
      playtime2weeksMin: Number.isFinite(Number(g?.playtime_2weeks)) ? Math.max(0, Math.floor(Number(g.playtime_2weeks))) : 0,
    });
  }
  return out;
}

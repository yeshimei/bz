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
  /** 库内小图标完整 URL（img_icon_url hash 直拼；空 hash → null） */
  iconUrl: string | null;
  /** 平台分项时长（分钟；只统计在对应平台玩过的部分） */
  windowsMin: number;
  macMin: number;
  linuxMin: number;
  deckMin: number;
  /** 有社区可见成就页（has_community_visible_stats） */
  hasAchievements: boolean;
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

/** 库内小图标完整 URL（img_icon_url 是 hash，需按 appid 拼全） */
export function steamIconUrl(appid: number, hash: string): string {
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
}

/** GetOwnedGames 响应 → 归一条目（空库/字段缺省兜底，坏条目跳过） */
export function parseOwnedGames(raw: unknown): SteamOwnedGame[] {
  const games = (raw as any)?.response?.games;
  if (!Array.isArray(games)) return [];
  const out: SteamOwnedGame[] = [];
  for (const g of games) {
    const appid = Number(g?.appid);
    if (!Number.isFinite(appid) || appid <= 0) continue;
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
    out.push({
      appid,
      name: typeof g?.name === 'string' && g.name ? g.name : `App ${appid}`,
      playtimeMin: num(g?.playtime_forever),
      lastPlayedTs: num(g?.rtime_last_played) * 1000,
      iconUrl: typeof g?.img_icon_url === 'string' && g.img_icon_url ? steamIconUrl(appid, g.img_icon_url) : null,
      windowsMin: num(g?.playtime_windows_forever),
      macMin: num(g?.playtime_mac_forever),
      linuxMin: num(g?.playtime_linux_forever),
      deckMin: num(g?.playtime_deck_forever),
      hasAchievements: g?.has_community_visible_stats === true,
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

/* ==================== 逐游戏详情（按需拉取，写回 frontmatter 缓存） ====================
   全量 147 款 × 每款 2-4 请求会撞 Steam 限流——只有点开详情才拉，拉过即缓存不再请求。
   成就两接口走 api.steampowered.com（需代理）；商店 appdetails/appreviews 走
   store.steampowered.com（实测直连可达，且 l=schinese 直出中文类型/评语）。 */

/** 成就摘要（玩家解锁 × 全局解锁率 → 稀有成就） */
export interface AchievementSummary {
  total: number;
  unlocked: number;
  /** 已解成就里全球解锁率最低的一个（小黑盒式「稀有成就」） */
  rarestName: string | null;
  /** 该稀有成就的全球解锁率（0-100，一位小数） */
  rarestPercent: number | null;
}

export type DetailFetchResult<T> = { ok: true; data: T } | { ok: false; reason: 'none' | 'network' | 'parse'; message: string };

/** 成就接口响应 → 摘要（Schema.globalAchievement.percent × Player.achieved 联表） */
export function parseAchievementSummary(schemaRaw: unknown, playerRaw: unknown): AchievementSummary | null {
  const schemaAch = (schemaRaw as any)?.game?.availableGameStats?.achievements;
  const playerAch = (playerRaw as any)?.playerstats?.achievements;
  if (!Array.isArray(schemaAch) || !Array.isArray(playerAch)) return null;
  const global = new Map<string, number>();
  const names = new Map<string, string>();
  for (const a of schemaAch) {
    if (a && typeof a.name === 'string') {
      names.set(a.name, typeof a.displayName === 'string' ? a.displayName : a.name);
      if (Number.isFinite(Number(a?.globalAchievement?.percent))) global.set(a.name, Number(a.globalAchievement.percent));
    }
  }
  let unlocked = 0;
  let rarestName: string | null = null;
  let rarestPercent: number | null = null;
  for (const p of playerAch) {
    if (!p || p.achieved !== 1) continue;
    unlocked += 1;
    const pct = global.get(String(p.apiname));
    if (pct !== undefined && (rarestPercent === null || pct < rarestPercent)) {
      rarestPercent = pct;
      rarestName = names.get(String(p.apiname)) ?? null;
    }
  }
  return { total: schemaAch.length, unlocked, rarestName, rarestPercent: rarestPercent === null ? null : Math.round(rarestPercent * 10) / 10 };
}

/** 拉成就摘要（无成就/私密 → reason none；网络/解析问题如实上抛归类） */
export async function fetchAchievementSummary(steamId: string, apiKey: string, appid: number): Promise<DetailFetchResult<AchievementSummary>> {
  const enc = encodeURIComponent(apiKey.trim());
  try {
    const schema = await getJson(`${API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${enc}&appid=${appid}`);
    const player = await getJson(`${API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${enc}&steamid=${steamId.trim()}&appid=${appid}`);
    const summary = parseAchievementSummary(schema, player);
    if (!summary) return { ok: false, reason: 'none', message: '这款游戏没有公开成就，或成就页不可见' };
    return { ok: true, data: summary };
  } catch (e) {
    const err = e as SteamHttpError;
    if (err.reason === 'http' && (err.status === 400 || err.status === 403)) {
      return { ok: false, reason: 'none', message: '这款游戏没有公开成就，或成就页不可见' };
    }
    return { ok: false, reason: 'network', message: '成就拉取失败：请检查网络与系统代理' };
  }
}

/** 商店元数据（类型/开发商/发行日期/简体中文支持 + 好评率/评测数） */
export interface StoreMeta {
  genres: string | null;
  developers: string | null;
  releaseDate: string | null;
  zhSupported: boolean;
  reviewDesc: string | null;
  reviewsTotal: number | null;
}

/** appdetails 响应 → 静态元数据归一（评价段由 parseReviews 单独归一） */
export function parseStoreMeta(raw: unknown): Pick<StoreMeta, 'genres' | 'developers' | 'releaseDate' | 'zhSupported'> | null {
  const data = (raw as any)?.[0]?.data;
  if (!data || typeof data !== 'object') return null;
  const join = (v: unknown) => (Array.isArray(v) ? v.map((x: any) => String(typeof x === 'string' ? x : x?.description ?? x?.name ?? '')).filter(Boolean).join('、') : null);
  const langs = typeof data?.supported_languages === 'string' ? data.supported_languages : '';
  return {
    genres: join(data?.genres),
    developers: join(data?.developers),
    releaseDate: typeof data?.release_date?.date === 'string' && data.release_date.date ? data.release_date.date : null,
    zhSupported: langs.includes('简体中文'),
  };
}

/** appreviews 响应 → 好评摘要 */
export function parseReviews(raw: unknown): { reviewDesc: string | null; reviewsTotal: number | null } {
  const q = (raw as any)?.query_summary;
  return {
    reviewDesc: typeof q?.review_score_desc === 'string' && q.review_score_desc ? q.review_score_desc : null,
    reviewsTotal: Number.isFinite(Number(q?.total_reviews)) ? Number(q.total_reviews) : null,
  };
}

/** 拉商店元数据（store 域直连可达；失败不阻塞成就，调用方各自处理） */
export async function fetchStoreMeta(appid: number): Promise<DetailFetchResult<StoreMeta>> {
  try {
    const details = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=schinese`);
    const meta = parseStoreMeta(details);
    if (!meta) return { ok: false, reason: 'parse', message: '商店数据拉到了但解析不出（可能已下架）' };
    let reviews = { reviewDesc: null as string | null, reviewsTotal: null as number | null };
    try {
      reviews = parseReviews(await getJson(`https://store.steampowered.com/appreviews/${appid}?json=1&num_per_page=0&language=schinese&purchase_type=all`));
    } catch {
      /* 评价接口失败可容忍：静态元数据已到手 */
    }
    return { ok: true, data: { ...meta, ...reviews } };
  } catch (e) {
    const err = e as SteamHttpError;
    return { ok: false, reason: err.reason === 'auth' ? 'parse' : 'network', message: '商店数据拉取失败：请检查网络' };
  }
}

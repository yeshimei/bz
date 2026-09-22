/**
 * 游戏库（gameshelf）域 Steam 通道（issue 368 / 研究票 347；详情全量化 2026-09-17）：
 * 库同步 = GetOwnedGames + GetRecentlyPlayedGames；详情 = appdetails + appreviews +
 * 成就三接口（Schema / PlayerAchievements / GlobalAchievementPercentages）。
 *
 * 实测口径（2026-09-17 主会话真机验证，.scratch/memo-suite-plugin/research/347-steam-live-test.md）：
 * - api.steampowered.com 国内网络直连常被重置，requestUrl 跟随系统代理可用——
 *   网络层失败与密钥错误必须分开报错（网络错提示查代理，不能一律「密钥无效」）。
 * - GetOwnedGames 空库时 response.games 缺省（非空数组）；GetRecentlyPlayedGames
 *   近两周没玩时 total_count=0 且 games 缺省——两处都按缺省兜底。
 * - 单条字段：playtime_forever=分钟、rtime_last_played=unix 秒；无 img_logo_url，
 *   封面走 header.jpg 直拼（CDN 不走代理也可达）。
 * - store.steampowered.com（appdetails / appreviews）**直连可达**且 l=schinese 直出中文；
 *   api.steampowered.com（成就）与库同步同一条代理通道，GetSchemaForGame 也认 l=schinese
 *   （成就名与描述出中文；不传一律英文）。
 * - 成就全局解锁率的权威来源是 GetGlobalAchievementPercentagesForApp（独立接口）；
 *   Schema 内嵌的 globalAchievement 仅部分游戏有，故两条来源都读、全局接口优先。
 * - Schema 每条成就给**两个图标**：icon（已解锁，彩色）与 icongray（未解锁，灰）；
 *   两色都下到本地（见 posters.ts），界面按解锁态取用，状态翻转零下载。
 */
import { requestUrl } from 'obsidian';
import { withTimeout } from '../core/http';
import { pad2 } from '../core/ui/str';

const API_BASE = 'https://api.steampowered.com';
const STORE_BASE = 'https://store.steampowered.com';
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

/** 商店页地址（详情弹窗「在商店打开」用） */
export function steamStoreUrl(appid: number): string {
  return `${STORE_BASE}/app/${appid}/`;
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
    // requestUrl 只在 Content-Type 认得出来时才填 .json；Steam 个别节点会给
    // text/plain 或带 BOM 的响应 → 兜底用 text 自己解析一次，别直接当空数据
    if (resp.json === undefined || resp.json === null) {
      const text = typeof resp.text === 'string' ? resp.text.trim() : '';
      if (!text) return null;
      try {
        return JSON.parse(text.replace(/^\uFEFF/, ''));
      } catch {
        return null;
      }
    }
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
    return { ok: false, reason: 'config', message: 'Web API 密钥未填写，请在设置面板游戏库页填入' };
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
   全量 147 款 × 每款多次请求会撞 Steam 限流——只有点开详情才拉，拉过即缓存不再请求。
   成就三接口走 api.steampowered.com（需代理）；商店 appdetails/appreviews 走
   store.steampowered.com（实测直连可达，且 l=schinese 直出中文类型/评语）。 */

export type DetailFetchResult<T> = { ok: true; data: T } | { ok: false; reason: 'none' | 'network' | 'parse'; message: string };

/* ---------- 成就明细（Schema × Player × 全局解锁率） ---------- */

/** 成就单条（三来源联表后） */
export interface AchievementRow {
  apiName: string;
  /** 展示名（Schema displayName，缺省回落 apiName） */
  name: string;
  /** 描述（隐藏成就可能为空串） */
  desc: string;
  /** 是否隐藏成就（解锁前 Steam 不显示描述） */
  hidden: boolean;
  unlocked: boolean;
  /** 解锁时间 ISO 串（unlocktime 秒；未解锁/无时间 → null） */
  unlockedAt: string | null;
  /** 全球解锁率 %（0-100 一位小数；两来源都拿不到 → null） */
  globalPercent: number | null;
  /** 已解锁用的彩色图标（Schema icon；隐藏成就也有） */
  icon: string | null;
  /** 未解锁用的灰色图标（Schema icongray；Steam 未给 → null，界面回落彩色 + CSS 灰度） */
  iconGray: string | null;
}

/** 成就明细（弹窗成就段全量） */
export interface AchievementDetail {
  total: number;
  unlocked: number;
  /** 解锁占比（0-100 一位小数） */
  percent: number;
  /** 按稀有度升序（越稀有越靠前；同稀有度解锁在前） */
  rows: AchievementRow[];
  /** 已解成就里全球解锁率最低的一个（小黑盒式「稀有成就」） */
  rarestName: string | null;
  rarestPercent: number | null;
}

/** 成就摘要（写回 frontmatter 的标量三键） */
export interface AchievementSummary {
  total: number;
  unlocked: number;
  rarestName: string | null;
  rarestPercent: number | null;
}

/** 全局解锁率表（GetGlobalAchievementPercentagesForApp → apiname→percent） */
function globalPercents(globalRaw: unknown): Map<string, number> {
  const list = (globalRaw as any)?.achievementpercentages?.achievements;
  const map = new Map<string, number>();
  if (!Array.isArray(list)) return map;
  for (const a of list) {
    const p = Number(a?.percent);
    if (typeof a?.name === 'string' && Number.isFinite(p)) map.set(a.name, p);
  }
  return map;
}

/**
 * 成就三来源 → 明细。
 * - 名称/描述/隐藏/图标 取 Schema（GetSchemaForGame）；
 * - 解锁与否/解锁时间取 Player（GetPlayerAchievements）；
 * - 全球解锁率优先取全局接口，缺省回落 Schema 内嵌 globalAchievement；
 * - 无 Schema 成就表或无玩家成就表 → null（该游戏没有可展示的成就页）。
 */
export function parseAchievementRows(schemaRaw: unknown, playerRaw: unknown, globalRaw?: unknown): AchievementDetail | null {
  const schemaAch = (schemaRaw as any)?.game?.availableGameStats?.achievements;
  const playerAch = (playerRaw as any)?.playerstats?.achievements;
  if (!Array.isArray(schemaAch) || !Array.isArray(playerAch)) return null;
  const globals = globalPercents(globalRaw);
  const meta = new Map<string, { name: string; desc: string; hidden: boolean; icon: string | null; iconGray: string | null }>();
  for (const a of schemaAch) {
    if (!a || typeof a.name !== 'string') continue;
    // Schema 内嵌解锁率仅部分游戏有：全局接口没给时才用它补位
    const pct = Number(a?.globalAchievement?.percent);
    if (!globals.has(a.name) && Number.isFinite(pct)) globals.set(a.name, pct);
    meta.set(a.name, {
      name: typeof a.displayName === 'string' && a.displayName ? a.displayName : a.name,
      desc: typeof a.description === 'string' ? a.description : '',
      hidden: a.hidden === 1 || a.hidden === true,
      icon: typeof a.icon === 'string' && a.icon ? a.icon : null,
      iconGray: typeof a.icongray === 'string' && a.icongray ? a.icongray : null,
    });
  }
  const rows: AchievementRow[] = [];
  let unlocked = 0;
  let rarestName: string | null = null;
  let rarestPercent: number | null = null;
  for (const p of playerAch) {
    if (!p) continue;
    const apiName = String(p.apiname ?? '');
    if (!apiName) continue;
    const m = meta.get(apiName) ?? { name: apiName, desc: '', hidden: false, icon: null, iconGray: null };
    const isUnlocked = p.achieved === 1;
    if (isUnlocked) unlocked += 1;
    const pct = globals.get(apiName);
    const percent = pct === undefined ? null : Math.round(pct * 10) / 10;
    // 稀有成就只在**已解锁**的里挑（未解锁的 0.1% 成就算不上「我的稀有」）
    if (isUnlocked && percent !== null && (rarestPercent === null || percent < rarestPercent)) {
      rarestPercent = percent;
      rarestName = m.name;
    }
    rows.push({
      apiName,
      name: m.name,
      desc: m.desc,
      hidden: m.hidden,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked && Number(p.unlocktime) > 0 ? new Date(Number(p.unlocktime) * 1000).toISOString() : null,
      globalPercent: percent,
      icon: m.icon,
      iconGray: m.iconGray,
    });
  }
  // 排序：稀有度升序（越稀有越靠前），稀有度相同按解锁在前
  rows.sort((a, b) => (a.globalPercent ?? 101) - (b.globalPercent ?? 101) || Number(b.unlocked) - Number(a.unlocked));
  const total = rows.length;
  return {
    total,
    unlocked,
    percent: total > 0 ? Math.round((unlocked / total) * 1000) / 10 : 0,
    rows,
    rarestName,
    rarestPercent,
  };
}

/** 成就摘要（明细派生；frontmatter 三键口径不变） */
export function parseAchievementSummary(schemaRaw: unknown, playerRaw: unknown, globalRaw?: unknown): AchievementSummary | null {
  const d = parseAchievementRows(schemaRaw, playerRaw, globalRaw);
  if (!d) return null;
  return { total: d.total, unlocked: d.unlocked, rarestName: d.rarestName, rarestPercent: d.rarestPercent };
}

/* ---------- 成就属性行（frontmatter 全量落盘的序列化口径） ---------- */

/**
 * 段分隔符。**实测 10088 条真实成就的名字与描述里 `|` 零出现**，故取它；
 * 仍留 sanitizeSeg 把 `|` 换成断竖线 `¦` 兜底——格式契约不能靠「真实数据没出现」活着，
 * 一旦某款新游戏的文案带竖线，整行会切错位、解锁态与全球率全部错配，代价远大于一个字符。
 */
const ACH_SEP = ' | ';

/** 段净化：管道符换 ¦、换行折空格、收空白。引号交给 Obsidian 的 YAML 序列化，不自己转义 */
export function sanitizeSeg(v: unknown): string {
  return String(v ?? '')
    .replace(/\|/g, '¦')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 解锁时间 ISO → YYYY-MM-DD（存日期不存时间戳：可读、短、和 `最后游玩` 同格式） */
function dateOnly(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '-';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // C2 余量：pad2 收编 core 单源（深审批A 登记）
}

/**
 * 成就明细 → 属性行。**恒 6 段**（ADR-0176 把 2026-09-18 的 8 段格式收回）：
 *   显示名 | 描述 | 已解锁(1/0) | 解锁日期(未解锁 `-`) | 全球解锁率(未知 `-`) | apiname
 *
 * 第 6 段的 apiname 是这一行的稳定身份——用它而不是下标，是因为 Steam 追加成就会让下标
 * 整体位移，而 apiname 永不变；手改属性时也看得懂「这是哪一条」。
 *
 * 「日期 / 全球率未知」一律写 `-`，**不能用空串**：行尾空段的尾随空格会被 trim / YAML
 * 往返吃掉，段数就少一段。存量笔记里按 8 段格式写下的行不必迁移——解析侧只取前 6 段
 * （见 achRowFromText），下次成就刷新时自然收敛成 6 段。
 */
export function achRowText(row: AchievementRow): string {
  const pct = row.globalPercent === null ? '-' : row.globalPercent.toFixed(1);
  return [
    sanitizeSeg(row.name),
    sanitizeSeg(row.desc),
    row.unlocked ? '1' : '0',
    row.unlocked ? dateOnly(row.unlockedAt) : '-',
    pct,
    sanitizeSeg(row.apiName),
  ].join(ACH_SEP);
}

/** 属性行 → 结构化（段数不足 6 / 无 apiname → null，坏行跳过而不是带崩整段渲染） */
export function achRowFromText(text: string): {
  name: string;
  desc: string;
  unlocked: boolean;
  /** YYYY-MM-DD；未解锁或未知 → '' */
  date: string;
  /** null = 全球解锁率未知 */
  percent: number | null;
  apiName: string;
} | null {
  const parts = String(text).split(ACH_SEP);
  if (parts.length < 6) return null;
  const seg = parts.map((s) => s.trim());
  const [name, desc, on, date, pct, apiName] = seg;
  if (!apiName) return null;
  const n = Number(pct);
  return {
    name: name || apiName,
    desc,
    unlocked: on === '1',
    date: date === '-' ? '' : date,
    percent: pct === '-' || !Number.isFinite(n) ? null : n,
    apiName,
  };
}

/** 成就接口错误分流（无成就页的 400/403 与网络失败分开） */
function achievementFailure(e: unknown): DetailFetchResult<never> {
  const err = e as SteamHttpError;
  if (err instanceof SteamHttpError && err.reason === 'http' && (err.status === 400 || err.status === 403)) {
    return { ok: false, reason: 'none', message: '这款游戏没有公开成就，或成就页不可见' };
  }
  return { ok: false, reason: 'network', message: '成就拉取失败：请检查网络与系统代理' };
}

/** 拉成就明细（Schema + Player + 全局解锁率；全局接口失败可容忍） */
export async function fetchAchievementDetail(steamId: string, apiKey: string, appid: number): Promise<DetailFetchResult<AchievementDetail>> {
  const enc = encodeURIComponent(apiKey.trim());
  try {
    // l=schinese：成就名与描述出中文（实测 v2 接口认该参数；不传一律英文，
    // 与商店 appdetails 的本地化口径对齐）
    const schema = await getJson(`${API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${enc}&appid=${appid}&l=schinese`);
    const player = await getJson(`${API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${enc}&steamid=${steamId.trim()}&appid=${appid}`);
    let global: unknown = null;
    try {
      global = await getJson(`${API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appid}`);
    } catch {
      global = null; // 容忍：回落 Schema 内嵌 globalAchievement
    }
    const detail = parseAchievementRows(schema, player, global);
    if (!detail) return { ok: false, reason: 'none', message: '这款游戏没有公开成就，或成就页不可见' };
    return { ok: true, data: detail };
  } catch (e) {
    return achievementFailure(e) as DetailFetchResult<AchievementDetail>;
  }
}

/** 拉成就摘要（issue 368 口径保留，供只需三键的场景） */
export async function fetchAchievementSummary(steamId: string, apiKey: string, appid: number): Promise<DetailFetchResult<AchievementSummary>> {
  const r = await fetchAchievementDetail(steamId, apiKey, appid);
  if (!r.ok) return r;
  return { ok: true, data: { total: r.data.total, unlocked: r.data.unlocked, rarestName: r.data.rarestName, rarestPercent: r.data.rarestPercent } };
}

/* ---------- 商店元数据（appdetails + appreviews） ---------- */

/** 商店元数据（appdetails 静态字段 + appreviews 评价摘要；可空 = 该项 Steam 没给） */
export interface StoreMeta {
  /** 条目类型短码（game/dlc/demo/…） */
  type: string | null;
  /** 本地化名（l=schinese → 中文名；库里 GetOwnedGames 只给英文名，中文名只能从这里拿） */
  name: string | null;
  genres: string | null;
  developers: string | null;
  publishers: string | null;
  releaseDate: string | null;
  comingSoon: boolean;
  zhSupported: boolean;
  /** 支持平台（Windows、macOS、Linux） */
  platforms: string | null;
  /** 玩法分类（单人、多人、成就、云存档…） */
  categories: string | null;
  metacritic: number | null;
  /** Steam 推荐数（recommendations.total） */
  recommendations: number | null;
  isFree: boolean;
  /** 现价文案（免费 → 免费；无商店页/无价格 → null） */
  price: string | null;
  discountPercent: number | null;
  website: string | null;
  shortDescription: string | null;
  /** 商店页大图（background_raw；弹窗头图氛围用） */
  background: string | null;
  /** 截图（path_full，最多 8 张） */
  screenshots: string[];
  dlcCount: number | null;
  /** 商店侧成就总数（与成就接口的 total 互为印证） */
  achievementsTotal: number | null;
  supportUrl: string | null;
  supportEmail: string | null;
  reviewDesc: string | null;
  reviewsTotal: number | null;
  reviewsPositive: number | null;
  reviewsNegative: number | null;
}

/** appdetails 静态字段归一（data 段缺失/非对象 → null，调用方判「没拉到」） */
/**
 * appdetails 响应取 `data`——三种形态都要认：
 *   ① **真实 Steam**：`{ "<appid>": { success, data } }`，外层键是 **appid 字符串**。
 *      ⚠️ 2026-09-17 真机事故：原来只写 `raw[0].data`，对象形态下恒为 undefined →
 *      商店资料与中文名全部「拉到了但解析不出」（评审壳的罐头存成了数组形态，
 *      恰好命中旧分支，故评审阶段全绿、真机全红）。
 *   ② 数组形态 `[{ success, data }]`（旧抓取罐头与既有单测）：按下标 0。
 *   ③ 直接形态 `{ success, data }`（部分单测）：按 `.data`。
 * `success: false`（下架 / 地区限制）时三者都取不到 data → 返回 null，交给调用方分文案。
 */
function storeDataOf(raw: unknown, appid?: number): any {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  if (appid !== undefined && r[String(appid)] && typeof r[String(appid)] === 'object') {
    return r[String(appid)].data ?? null;
  }
  if (Array.isArray(raw)) return (raw as any[])[0]?.data ?? null;
  const vals = Object.values(r);
  if (vals.length === 1 && vals[0] && typeof vals[0] === 'object') return (vals[0] as any).data ?? null;
  return r.data ?? null;
}

export function parseStoreMeta(raw: unknown, appid?: number): Omit<StoreMeta, 'reviewDesc' | 'reviewsTotal' | 'reviewsPositive' | 'reviewsNegative'> | null {
  const data = storeDataOf(raw, appid);
  if (!data || typeof data !== 'object') return null;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  const join = (v: unknown): string | null =>
    Array.isArray(v)
      ? v.map((x: any) => String(typeof x === 'string' ? x : x?.description ?? x?.name ?? '')).filter(Boolean).join('、') || null
      : null;
  const langs = typeof data?.supported_languages === 'string' ? data.supported_languages : '';
  const plats = data?.platforms ?? {};
  const platformNames = [plats.windows ? 'Windows' : '', plats.mac ? 'macOS' : '', plats.linux ? 'Linux' : ''].filter(Boolean);
  const shots = Array.isArray(data?.screenshots)
    ? (data.screenshots
        .map((s: any) => str(s?.path_full))
        .filter((x: string | null): x is string => !!x)
        .slice(0, 8))
    : [];
  const num = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    type: str(data?.type),
    name: str(data?.name),
    genres: join(data?.genres),
    developers: join(data?.developers),
    publishers: join(data?.publishers),
    releaseDate: str(data?.release_date?.date),
    comingSoon: data?.release_date?.coming_soon === true,
    zhSupported: langs.includes('简体中文'),
    platforms: platformNames.length ? platformNames.join('、') : null,
    categories: join(data?.categories),
    metacritic: num(data?.metacritic?.score),
    recommendations: num(data?.recommendations?.total),
    isFree: data?.is_free === true,
    price: data?.is_free === true ? '免费' : str(data?.price_overview?.final_formatted),
    discountPercent: num(data?.price_overview?.discount_percent),
    website: str(data?.website),
    shortDescription: str(data?.short_description),
    background: str(data?.background_raw) ?? str(data?.background),
    screenshots: shots,
    dlcCount: Array.isArray(data?.dlc) ? data.dlc.length : null,
    achievementsTotal: num(data?.achievements?.total),
    supportUrl: str(data?.support_info?.url),
    supportEmail: str(data?.support_info?.email),
  };
}

/** appreviews 响应 → 评价摘要（好评率文案 + 总数 + 正负票） */
export function parseReviews(raw: unknown): { reviewDesc: string | null; reviewsTotal: number | null; reviewsPositive: number | null; reviewsNegative: number | null } {
  const q = (raw as any)?.query_summary;
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    reviewDesc: typeof q?.review_score_desc === 'string' && q.review_score_desc ? q.review_score_desc : null,
    reviewsTotal: num(q?.total_reviews),
    reviewsPositive: num(q?.total_positive),
    reviewsNegative: num(q?.total_negative),
  };
}

/** 拉商店元数据（store 域直连可达；评价接口失败不阻塞静态字段） */
export async function fetchStoreMeta(appid: number): Promise<DetailFetchResult<StoreMeta>> {
  try {
    const details = await getJson(`${STORE_BASE}/api/appdetails?appids=${appid}&l=schinese`);
    const meta = parseStoreMeta(details, appid);
    if (!meta) {
      // Steam 明确给了 success:false = 这款游戏在商店查不到（下架 / 地区限制）；
      // 否则才是结构没认出来 —— 两种原因给用户不同文案，方便判断该不该重试
      const denied = (details as Record<string, any> | null)?.[String(appid)]?.success === false;
      return {
        ok: false,
        reason: 'parse',
        message: denied
          ? 'Steam 没有返回这款游戏的商店数据（可能已下架或地区限制）'
          : '商店数据拉到了但解析不出（可能已下架）',
      };
    }
    let reviews: ReturnType<typeof parseReviews> = { reviewDesc: null, reviewsTotal: null, reviewsPositive: null, reviewsNegative: null };
    try {
      reviews = parseReviews(await getJson(`${STORE_BASE}/appreviews/${appid}?json=1&num_per_page=0&language=schinese&purchase_type=all`));
    } catch {
      /* 评价接口失败可容忍：静态元数据已到手 */
    }
    return { ok: true, data: { ...meta, ...reviews } };
  } catch (e) {
    const err = e as SteamHttpError;
    return { ok: false, reason: err.reason === 'auth' ? 'parse' : 'network', message: '商店数据拉取失败：请检查网络' };
  }
}

/* ---------- 本地化名（中文名回填） ---------- */

/** appdetails 响应 → 本地化名（l=schinese 时即中文名；下架/无商店页 → null） */
export function parseZhName(raw: unknown, appid?: number): string | null {
  const data = storeDataOf(raw, appid) as Record<string, unknown> | null;
  const n = data?.name;
  return typeof n === 'string' && n.trim() ? n.trim() : null;
}

/**
 * 拉本地化名（filters=basic：只要名字，响应体积最小）。
 * GetOwnedGames 只给英文名，中文名只能从商店接口取——全库回填走 names.ts 的串行队列。
 */
export async function fetchZhName(appid: number): Promise<DetailFetchResult<string>> {
  try {
    const raw = await getJson(`${STORE_BASE}/api/appdetails?appids=${appid}&l=schinese&filters=basic`);
    const name = parseZhName(raw, appid);
    if (!name) return { ok: false, reason: 'parse', message: '商店没有给出这款游戏的名字' };
    return { ok: true, data: name };
  } catch (e) {
    const err = e as SteamHttpError;
    return { ok: false, reason: err.reason === 'auth' ? 'parse' : 'network', message: '中文名拉取失败：请检查网络' };
  }
}

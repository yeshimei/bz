/**
 * 视频录入元信息抓取（issue 278 / ADR-0122 拍板要点 5；issue 306 / ADR-0133 改链接解析式）：
 * 「解析」按钮触发的降级链——B 站 view API（title/owner/pages/duration）→ 页面 <title> 清洗 → 失败态。
 * 净化单源 = normalizeSourceUrl（source.ts），本模块只抓不落库；全程零 notice（调用方按结果渲染）。
 * 联网范围仅限 B 站域（bilibili.com / b23.tv）：非 B 站链接只净化（调用方/落库收口）、零请求（Q4 拍板）。
 * 清晰度档位（ADR-0133）：x/player/playurl（fnval=4048 取 dash）带设置项 cookie——实测未签名即可拿完整档位；
 * 无 cookie 时受 B 站账号级限制只给 720P 以下（采用会误导），故档位查询前置 nav 登录态校验。
 * cookie 缺 / 失效 / 接口失败 → qualities = null（调用方回落固定档位列表），全程静默。
 * 已知限制：b23.tv 老式随机码短链拿不到重定向目标（requestUrl 响应无 url 字段），只抓标题、UP主 留空——
 * 下载阶段 CLI 的 [bz-info] 会按「只补空」补齐（processor.ts 同口径）。
 */
import { requestUrl } from 'obsidian';
import { fetchPageTitle } from '../core/utils';
import { cleanSourceTitle, isUrlLikeSourceText } from './source';

/** view API 的 bvid 判据：统一 10 位（仓内另有 {8,12} 展示用与 CLI {10} 写法，本模块为唯一解析口径） */
const BVID_RE = /BV[0-9A-Za-z]{10}/;

/** B 站域判据：只有 B 站链接联网抓取（含短链 b23.tv；子域如 space.bilibili.com 命中） */
const BILI_HOST_RE = /(^|\.)(bilibili\.com|b23\.tv)$/i;

function isBiliUrl(text: string): boolean {
  const m = text.match(/^https?:\/\/([^/?#]+)/i);
  return !!m && BILI_HOST_RE.test(m[1].toLowerCase().replace(/^www\./i, ''));
}

/** 从完整链接或裸 BV 号提取 bvid；无匹配返回 null */
export function parseBvid(input: string): string | null {
  const m = String(input ?? '').match(BVID_RE);
  return m ? m[0] : null;
}

/** 分 P 条目（view API data.pages 净化后的形状） */
export interface VideoPage {
  /** 1 起 */
  page: number;
  /** 分 P 标题（UP 主自定义，可能为空串） */
  part: string;
  /** 该 P 时长（秒，整数；0 = 未知回落到总时长） */
  duration: number;
  /** 该 P 的 cid（档位查询用） */
  cid: number;
}

/** 抓到的视频元信息（缺项缺省——调用方只补空字段） */
export interface VideoMeta {
  title?: string;
  uploader?: string;
  /** 总时长（秒；多 P 时为各 P 之和） */
  duration?: number;
  /** 分 P 列表（view API data.pages；单 P 视频也会有一项） */
  pages?: VideoPage[];
}

/** 一次解析的全量产物（ADR-0133：meta + 实测档位） */
export interface ResolvedVideo {
  meta: VideoMeta;
  /** 实测可用档位（height 数字，降序、去重）；null = 未取到（无 cookie / 未登录 / 接口失败） */
  qualities: number[] | null;
}

const VIEW_TIMEOUT_MS = 10000;
const QUALITY_TIMEOUT_MS = 10000;
const NAV_TIMEOUT_MS = 10000;

/** 超时包装（范式随 clipbook fetchRssFeedTitle）：超时 → null；落定时器清理（批量重抓不堆积） */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  const done = (): void => { if (timer) { clearTimeout(timer); timer = null; } };
  return Promise.race([p, timeout]).then(
    (v) => { done(); return v === null ? null : (v as T); },
    (e) => { done(); throw e; },
  );
}

/** 非 2xx 或 JSON 解析失败 → null */
function parseJson(resp: any): any {
  if (!resp || resp.status < 200 || resp.status >= 300) return null;
  try { return JSON.parse(resp.text as string); } catch { return null; }
}

/** 正整数化（容错 NaN/负/小数） */
function posInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** B 站 view API：10s 超时（Promise.race，范式随 clipbook fetchRssFeedTitle）；非 2xx/code!==0/异常 → null */
async function fetchFromViewApi(bvid: string): Promise<VideoMeta | null> {
  try {
    const json = parseJson(await withTimeout(requestUrl({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, method: 'GET' }), VIEW_TIMEOUT_MS));
    if (!json || json.code !== 0 || !json.data) return null;
    const d = json.data;
    const title = typeof d.title === 'string' ? d.title.trim() : '';
    const ownerName = d.owner && typeof d.owner.name === 'string' ? d.owner.name.trim() : '';
    const meta: VideoMeta = {};
    if (title) meta.title = title;
    if (ownerName) meta.uploader = ownerName;
    const duration = posInt(d.duration);
    if (duration) meta.duration = duration;
    let pages: VideoPage[] = [];
    if (Array.isArray(d.pages)) {
      d.pages.forEach((p: any, i: number) => {
        const cid = posInt(p && p.cid);
        if (!cid) return;
        pages.push({
          page: posInt(p.page) || i + 1,
          part: typeof p.part === 'string' ? p.part.trim() : '',
          duration: posInt(p.duration) || duration,
          cid,
        });
      });
    }
    if (pages.length) meta.pages = pages;
    return meta.title || meta.uploader || meta.pages ? meta : null;
  } catch {
    return null;
  }
}

/** 页面标题兜底（B 站页面——view API 失败的 video 链接、无 BV 字样的 B 站短链/主页——共用）：fetchPageTitle + 剥站点尾巴；拿不到 → null */
async function fetchFromPageTitle(url: string): Promise<VideoMeta | null> {
  try {
    const raw = await fetchPageTitle(url);
    const title = raw ? cleanSourceTitle(raw) : '';
    return title ? { title } : null;
  } catch {
    return null;
  }
}

/**
 * 输入 → 元信息（静默降级，联网范围仅限 B 站域）：
 * - B 站 video 链接 / 裸 BV 号 → view API，失败（含超时/风控）→ 页面标题兜底（仅输入本身是 B 站 http(s) 链接时有页面可抓，裸 BV 号到顶）；
 * - B 站域 URL 但无 BV 字样（b23.tv 短链、space 主页）→ 只走标题兜底，uploader 留空；
 * - 非 B 站 http(s) URL → null 零请求（只净化，净化在调用方/落库收口）；
 * - 非 URL 文本 → null，零网络请求。
 */
export async function fetchVideoMeta(input: string): Promise<VideoMeta | null> {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const bvid = parseBvid(text);
  if (bvid) {
    const viaApi = await fetchFromViewApi(bvid);
    if (viaApi) return viaApi;
    return isBiliUrl(text) ? await fetchFromPageTitle(text) : null;
  }
  if (!isUrlLikeSourceText(text)) return null; // 非 URL 文本：不联网
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (!isBiliUrl(url)) return null; // 非 B 站链接：只净化零请求（Q4 拍板）
  return await fetchFromPageTitle(url);
}

/**
 * cookie 登录态校验（nav；ADR-0133）：非登录/异常/超时 → false。
 * 未登录时 playurl 的档位受账号级限制（上限 720P），采用会误导——档位查询前置本校验。
 */
export async function isCookieLoggedIn(cookie: string): Promise<boolean> {
  const c = String(cookie ?? '').trim();
  if (!c) return false;
  try {
    const json = parseJson(await withTimeout(
      requestUrl({ url: 'https://api.bilibili.com/x/web-interface/nav', method: 'GET', headers: { Cookie: c } }),
      NAV_TIMEOUT_MS,
    ));
    return !!(json && json.code === 0 && json.data && json.data.isLogin === true);
  } catch {
    return false;
  }
}

/**
 * 实测可用清晰度档位（ADR-0133）：x/player/playurl（fnval=4048 取 dash）带 cookie，
 * 提取 dash.video 的 height 集合（降序去重）。失败/无 dash/空集 → null（调用方回落固定档位列表）。
 * 调用方须先过 isCookieLoggedIn（未登录档位不采用）。
 */
export async function fetchVideoQualities(bvid: string, cid: number, cookie: string): Promise<number[] | null> {
  const c = String(cookie ?? '').trim();
  if (!c || !bvid || !posInt(cid)) return null;
  try {
    const url = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${posInt(cid)}&qn=127&fnval=4048&fourk=1`;
    const json = parseJson(await withTimeout(
      requestUrl({ url, method: 'GET', headers: { Cookie: c } }),
      QUALITY_TIMEOUT_MS,
    ));
    const videos = json && json.code === 0 && json.data && json.data.dash ? json.data.dash.video : null;
    if (!Array.isArray(videos)) return null;
    const heights = Array.from(new Set<number>(videos.map((f: any) => posInt(f && f.height)).filter((h: number) => h > 0))).sort((a, b) => b - a);
    return heights.length ? heights : null;
  } catch {
    return null;
  }
}

/**
 * 切 P / 解析共用的档位查询入口（ADR-0133）：**nav 登录态门禁下沉到本模块**——
 * 未登录时 playurl 档位受账号级限制（上限 720P），采用会误导，宁可回落固定列表。
 * 调用方（弹窗切 P / resolveVideo）无从遗忘门禁。
 */
export async function fetchCheckedQualities(bvid: string, cid: number, cookie: string): Promise<number[] | null> {
  const c = String(cookie ?? '').trim();
  if (!c || !bvid || !posInt(cid)) return null;
  if (!(await isCookieLoggedIn(c))) return null;
  return await fetchVideoQualities(bvid, cid, c);
}

/**
 * 一次解析（ADR-0133 弹窗「解析」按钮的完整链路）：meta（三级降级）+ 实测档位（可选）。
 * - meta 为 null → 整体 null（调用方进失败态）；
 * - 档位仅在「有 bvid + 有 cookie + 登录态有效 + 有该 P 的 cid」时查询，其余情况 qualities = null（静默）；
 * - pageIndex：用第几个分 P 的 cid 查档位（0 起；缺省第 1 P）——切 P 时调用方走 fetchCheckedQualities 单独重查。
 */
export async function resolveVideo(input: string, cookie: string, pageIndex = 0): Promise<ResolvedVideo | null> {
  const meta = await fetchVideoMeta(input);
  if (!meta) return null;
  const bvid = parseBvid(input);
  const pages = meta.pages || [];
  const sel = pages[pageIndex] || pages[0];
  const qualities = bvid && sel && sel.cid ? await fetchCheckedQualities(bvid, sel.cid, cookie) : null;
  return { meta, qualities };
}

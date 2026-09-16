/**
 * 视频录入元信息抓取（issue 278 / ADR-0122 拍板要点 5；issue 306 / ADR-0133 改链接解析式；
 * issue 307 / ADR-0134 补 b23.tv 短链解析）：
 * 「解析」按钮触发的降级链——B 站 view API（title/owner/pages/duration）→ 页面 HTML
 * → 页面 <title> 清洗 → 失败态。
 * 净化单源 = normalizeSourceUrl（source.ts），本模块只抓不落库；全程零 notice（调用方按结果渲染）。
 * 联网范围仅限 B 站域（bilibili.com / b23.tv）：非 B 站链接只净化（调用方/落库收口）、零请求（Q4 拍板）。
 * 清晰度档位（ADR-0133）：x/player/playurl（fnval=4048 取 dash）带设置项 cookie——实测未签名即可拿完整档位；
 * 无 cookie 时受 B 站账号级限制只给 720P 以下（采用会误导），故档位查询前置 nav 登录态校验。
 * cookie 缺 / 失效 / 接口失败 → qualities = null（调用方回落固定档位列表），全程静默。
 *
 * 短链（ADR-0134）：b23.tv 分享链路的 BV 号不在 URL 里，requestUrl 响应又不暴露重定向目标——
 * 改为从**跟随后的落地页 HTML** 取：og:url **路径段** `/video/BV…`（列表/收藏夹页的 `?bvid=` 推荐位不算）
 * + `__INITIAL_STATE__`（桌面 videoData /
 * 手机 video.viewInfo，字段与 view API data 同名，实测三方 title/owner/duration/pages 完全对齐）。
 * 于是短链「标题/UP主/分P/时长」一次页面请求拿全，且 API 不可达时仍不残缺；meta.bvid 一并回传给调用方
 * （切 P 查档位、短链写回规范链接都靠它）。
 */
import { httpGetText, requestUrlAsFetch } from '../core/http';
import { cleanSourceTitle, isUrlLikeSourceText } from './source';

/** view API 的 bvid 判据：统一 10 位（仓内另有 {8,12} 展示用与 CLI {10} 写法，本模块为唯一解析口径） */
const BVID_RE = /BV[0-9A-Za-z]{10}/;

/** 整串精确判据（页面 state 的 bvid 字段校验用；BVID_RE 是提取口径，不锚定首尾） */
const BVID_EXACT_RE = /^BV[0-9A-Za-z]{10}$/;

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
  /**
   * BV 号（ADR-0134：短链场景由页面 og:url / state 补出，调用方凭它查档位、写回规范链接）。
   * 抓取失败或页面无 BV 时缺省。
   */
  bvid?: string;
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

/** 生产 HTTP 通道（requestUrl → fetch 形状适配，core/http 单源，issue 347） */
const httpImpl = requestUrlAsFetch();

/** 2xx 正文 → JSON（非 2xx / 网络错 / 超时已由 httpGetText 归 null；解析失败 → null） */
function parseJsonText(text: string | null): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** 正整数化（容错 NaN/负/小数） */
function posInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * 视频数据体（view API data / 桌面页 __INITIAL_STATE__.videoData / 手机页 __INITIAL_STATE__.video.viewInfo）
 * → VideoMeta；三处字段同名，故净化单源在这里。title/uploader/pages 全空 → null（调用方继续降级）。
 */
function metaFromVideoData(d: any): VideoMeta | null {
  if (!d || typeof d !== 'object') return null;
  const meta: VideoMeta = {};
  const title = typeof d.title === 'string' ? d.title.trim() : '';
  const ownerName = d.owner && typeof d.owner.name === 'string' ? d.owner.name.trim() : '';
  const bvid = bvidFromVideoData(d);
  if (title) meta.title = title;
  if (ownerName) meta.uploader = ownerName;
  if (bvid) meta.bvid = bvid;
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
}

/** page state 里的视频数据体：桌面 videoData / 手机 video.viewInfo（ADR-0134 实测同口径）；无 → null */
function videoDataFromState(state: unknown): any {
  const s = state as any;
  if (!s || typeof s !== 'object') return null;
  if (s.videoData && typeof s.videoData === 'object') return s.videoData;
  const v = s.video;
  if (v && typeof v === 'object' && v.viewInfo && typeof v.viewInfo === 'object') return v.viewInfo;
  return null;
}

/**
 * `__INITIAL_STATE__` JSON 片段抽取：页面把大 JSON 直接内联在脚本里、后面紧跟别的语句，
 * 非贪婪正则会截到第一个 `}` 就断——改用平衡括号扫描（字符串/转义感知）；解析失败 → null。
 */
function extractInitialState(html: string): unknown | null {
  const i = html.indexOf('__INITIAL_STATE__');
  if (i < 0) return null;
  const start = html.indexOf('{', i);
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let k = start; k < html.length; k++) {
    const ch = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = k + 1; break; }
    }
  }
  if (end < 0) return null;
  try { return JSON.parse(html.slice(start, end)); } catch { return null; }
}

/** 视频数据体里的 bvid（整串精确校验，防 "BV…x" 之类半截串）；无/非法 → null */
function bvidFromVideoData(d: any): string | null {
  const b = d && typeof d.bvid === 'string' ? d.bvid.trim() : '';
  return BVID_EXACT_RE.test(b) ? b : null;
}

/**
 * og:url 的**路径段**里才是本页视频——`/video/BV…`。
 * 只认路径段：列表页/收藏夹页的 og:url 形如 `/list/ml123?oid=…&bvid=BV…`（推荐位），
 * 命中它会把用户链接悄悄改写成无关视频（review 307）。
 */
function bvidFromOgUrl(html: string): string | null {
  const og = /og:url["']?\s+content=["']([^"']+)["']/i.exec(html);
  if (!og) return null;
  const m = /\/video\/(BV[0-9A-Za-z]{10})/.exec(og[1]);
  return m ? m[1] : null;
}

/**
 * 页面 HTML → bvid：og:url 路径段优先，退 `__INITIAL_STATE__` 里**已解析出的视频数据体**的 bvid。
 * 不做全页 `"bvid"` 正则——非视频页（列表/收藏夹/番剧）正文里的 bvid 属于别的视频。
 */
export function parseBvidFromHtml(html: string): string | null {
  return bvidFromOgUrl(html) || bvidFromVideoData(videoDataFromState(extractInitialState(html)));
}

/** B 站 view API：10s 超时（core/http）；非 2xx/code!==0/异常 → null */
async function fetchFromViewApi(bvid: string): Promise<VideoMeta | null> {
  try {
    const json = parseJsonText(await httpGetText(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      { timeoutMs: VIEW_TIMEOUT_MS, fetchImpl: httpImpl },
    ));
    if (!json || json.code !== 0 || !json.data) return null;
    return metaFromVideoData(json.data);
  } catch {
    return null;
  }
}

/** 页面抓取的请求头：桌面 UA 才稳定拿到带 __INITIAL_STATE__ 的 SSR 页（无 UA 时 B 站可能回拦截页） */
const PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://www.bilibili.com/',
};

/**
 * B 站页面抓取（一次请求，10s 超时）：bvid（og:url 路径段 / 视频 state）+ meta
 * （`__INITIAL_STATE__` 优先，退化到 <title> 清洗；两者皆无但有 bvid → 只回 bvid 的 meta）。
 * 页面完全不可达 → null（调用方按既有降级链收尾）。
 */
async function fetchFromPage(url: string): Promise<{ bvid: string | null; meta: VideoMeta | null } | null> {
  // httpGetText 已把非 2xx / 网络错 / 超时归 null；2xx 空正文同旧口径按不可达处理
  const html = String(await httpGetText(url, { timeoutMs: VIEW_TIMEOUT_MS, headers: { ...PAGE_HEADERS }, fetchImpl: httpImpl }) ?? '');
  if (!html) return null;
  const state = extractInitialState(html);
  const videoData = videoDataFromState(state);
  const viaState = metaFromVideoData(videoData);
  const bvid = bvidFromOgUrl(html) || bvidFromVideoData(videoData);
  if (viaState) return { bvid: bvid || viaState.bvid || null, meta: viaState };
  const t = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = t && t[1] ? cleanSourceTitle(t[1].trim()) : '';
  if (title) return { bvid, meta: bvid ? { title, bvid } : { title } };
  // 无 state 也无标题：仍回传 bvid（调用方据此写回规范链接、按页型继续走 API），meta 为空
  return { bvid, meta: null };
}

/**
 * 输入 → 元信息（静默降级，联网范围仅限 B 站域）：
 * - B 站 video 链接 / 裸 BV 号 → view API，失败（含超时/风控）→ 页面（state 优先，退化标题）；
 * - B 站域 URL 但无 BV 字样（b23.tv 分享短链、space 主页）→ 抓页面拿 bvid（og:url 路径段 / 视频 state）
 *   → 再走 view API，API 不可用则直接用页面 state 的 title/uploader/pages/duration（ADR-0134）；
 * - 非 B 站 http(s) URL → null 零请求（只净化，净化在调用方/落库收口）；
 * - 非 URL 文本 → null，零网络请求。
 * 成功判据：拿到 bvid **或** meta 有内容（只回 bvid 的 meta 也算成功——调用方据此写回规范链接）；
 * 已知的 bvid 一律回填到 meta.bvid。两者皆无 → null（调用方进失败态）。
 * 注：降级链最坏耗时 = 页面 10s + view API 10s + nav 10s + playurl 10s（每级各自超时，超时只放弃结果不中断请求）。
 */
export async function fetchVideoMeta(input: string): Promise<VideoMeta | null> {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const bvid = parseBvid(text);
  if (bvid) {
    const viaApi = await fetchFromViewApi(bvid);
    if (viaApi) return { ...viaApi, bvid: viaApi.bvid || bvid };
    if (!isBiliUrl(text)) return null; // 裸 BV 号：无页面可抓
    const page = await fetchFromPage(text);
    if (!page) return null;
    if (!page.meta && !page.bvid) return null; // 页面也没认出本视频（无 og:url 路径段 / 无 state / 无标题）→ 失败态
    const known = page.bvid || bvid;
    return { ...(page.meta || {}), bvid: (page.meta && page.meta.bvid) || known };
  }
  if (!isUrlLikeSourceText(text)) return null; // 非 URL 文本：不联网
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (!isBiliUrl(url)) return null; // 非 B 站链接：只净化零请求（Q4 拍板）
  const page = await fetchFromPage(url);
  if (!page) return null;
  if (page.bvid) {
    const viaApi = await fetchFromViewApi(page.bvid);
    if (viaApi) return { ...viaApi, bvid: viaApi.bvid || page.bvid };
  }
  if (!page.meta) return page.bvid ? { bvid: page.bvid } : null;
  return page.bvid && !page.meta.bvid ? { ...page.meta, bvid: page.bvid } : page.meta;
}

/**
 * 「链接需要修成规范 BV 链接」判据（ADR-0134，调用方 backfill / 落库修补共用）：
 * B 站域且 URL 里没有 BV 号（b23.tv 短链等）——非 B 站链接（YouTube 等）不算，
 * 免得每次开面板都空跑一轮、更免得把无关链接改写。
 */
export function needsBvidRepair(url: string): boolean {
  const text = String(url ?? '').trim();
  return !!text && isBiliUrl(text) && !parseBvid(text);
}

/**
 * cookie 登录态校验（nav；ADR-0133）：非登录/异常/超时 → false。
 * 未登录时 playurl 的档位受账号级限制（上限 720P），采用会误导——档位查询前置本校验。
 */
export async function isCookieLoggedIn(cookie: string): Promise<boolean> {
  const c = String(cookie ?? '').trim();
  if (!c) return false;
  try {
    const json = parseJsonText(await httpGetText(
      'https://api.bilibili.com/x/web-interface/nav',
      { timeoutMs: NAV_TIMEOUT_MS, headers: { Cookie: c }, fetchImpl: httpImpl },
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
    const json = parseJsonText(await httpGetText(
      url,
      { timeoutMs: QUALITY_TIMEOUT_MS, headers: { Cookie: c }, fetchImpl: httpImpl },
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
 * - 档位仅在「有 bvid（含短链从页面补出的）+ 有 cookie + 登录态有效 + 有该 P 的 cid」时查询，其余情况 qualities = null（静默）；
 * - pageIndex：用第几个分 P 的 cid 查档位（0 起；缺省第 1 P）——切 P 时调用方走 fetchCheckedQualities 单独重查。
 */
export async function resolveVideo(input: string, cookie: string, pageIndex = 0): Promise<ResolvedVideo | null> {
  const meta = await fetchVideoMeta(input);
  if (!meta) return null;
  const bvid = meta.bvid || parseBvid(input);
  const pages = meta.pages || [];
  const sel = pages[pageIndex] || pages[0];
  const qualities = bvid && sel && sel.cid ? await fetchCheckedQualities(bvid, sel.cid, cookie) : null;
  return { meta, qualities };
}

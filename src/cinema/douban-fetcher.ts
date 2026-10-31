/**
 * 影院豆瓣抓取核心（issue 303 / ADR-0129；ADR-0177 搜索页退役、ADR-0178 三路检索链）：
 * 自 tools/obsidian-douban-poster 移植入插件。
 * 源目录 2026-11-01 已从仓库删除（此处即唯一实现），历史见 git。
 * 字段链：**三路检索链**（ADR-0178）——①subject_suggest 补全接口（JSON 一步拿 sid + 规范名 +
 * 海报 URL，最快最全）→ ②rexxar 移动搜索（与①频控池独立；①有「200+空数组」软拒绝形态，
 * 实测窗口以分钟计）→ ③www.douban.com/search 搜索页 HTML（末路兜底复活）——命中即用，
 * 全空且有路被拦 → blocked、全空无拦 → notfound
 * → **ApiZero 豆瓣电影信息接口**（评分/导演/主演/类型/地区/片长首选 + 上映日期←year/热门短评，
 * key 设置项）→ rexxar 演职员兜底（缺导演/主演或需编剧时）；
 * 海报走豆瓣（检索路提 URL / sid 直取走 rexxar subject 详情 → upgradePosterUrl 高清 →
 * writeBinary 写盘）。
 * 豆瓣详情页 HTML 退役；移动端同源可用。
 * 写回口径（审查 C8/C9 拍板）：除豆瓣链接（修正脏值）外一律「缺失才填」——已有值
 * （含用户手工修正）不覆盖；ApiZero 逗号列表值写入前归一化为消费端的 ` / ` 切分口径（C2）。
 * 纯逻辑 + 依赖注入（httpGet / downloadBinary），node 环境可测。
 */
import type { App, TFile } from 'obsidian';
import { stripMdExt } from '../core/ui/str';
// YAML 值序列化单源 core/utils（含特殊字符/空格双引号包裹并转义；换行先行单行化——
// 审查 C3：裸 \n/\r 进 frontmatter 会破坏 YAML 解析、影片从面板消失）
import { yamlScalarOf, sleep } from '../core/utils';
import { ILLEGAL_NAME_RE_GLOBAL } from './constants';

// ---------- 依赖注入 ----------

export type HttpGet = (url: string, headers?: Record<string, string>) => Promise<string | null>;
type DownloadBinary = (url: string, headers?: Record<string, string>) => Promise<ArrayBuffer | null>;

export interface DoubanFetchDeps {
  httpGet: HttpGet;
  downloadBinary: DownloadBinary;
  /** adapter.writeBinary 适配 */
  writeBinary: (path: string, data: ArrayBuffer) => Promise<void>;
  /** 海报目录不存在时建目录（adapter.mkdir） */
  mkdir: (path: string) => Promise<void>;
  /** ApiZero Key（设置项；空 = 不走 ApiZero，字段落 rexxar 兜底） */
  apizeroKey?: string;
  /** 豆瓣 Cookie（设置项，可选；注入搜索/rexxar 请求头） */
  doubanCookie?: string;
  /** 海报保存文件夹（调用方用 resolveAssetDir 解析好再传；空 = 没地方可写，不落库根） */
  posterFolder?: string;
  now?: () => number;
}

// ---------- 纯函数（照搬 douban-client.js 正则口径） ----------

/** 从文件名提取影视名称（《名称》.md 与 名称.md 两种格式，照搬 note-processor）。
 *  stripMdExt 走 core/ui/str 零依赖单源（审查批 C 收敛）；data.ts parseMovieFile
 *  对 basename（无扩展名）消费同一函数，语义一致 */
export function extractMovieName(filename: string): string {
  const basename = stripMdExt(filename);
  const m = basename.match(/《(.+)》/);
  return m ? m[1] : basename;
}

interface DoubanSearchResult {
  title: string;
  detailUrl: string;
  posterUrl: string;
}

/** subject_suggest 条目的公共面（只要这几个字段；type 用于滤掉书/音乐条目） */
interface SuggestItem {
  title?: string;
  id?: string;
  img?: string;
  type?: string;
}

/** 纯函数：解析豆瓣 subject_suggest JSON（ADR-0177）：
 *  只留 movie/tv 条目（suggest 会混书籍/音乐）；detailUrl 由 id 规范化构造——
 *  suggest 的 url 字段带 ?suggest= 脏参数，不直接使用 */
export function parseSuggestResults(jsonText: string): DoubanSearchResult[] {
  let items: unknown;
  try {
    items = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  const results: DoubanSearchResult[] = [];
  for (const it of items as SuggestItem[]) {
    if (!it || (it.type !== 'movie' && it.type !== 'tv') || !it.id) continue;
    results.push({
      title: String(it.title ?? '').trim(),
      detailUrl: `https://movie.douban.com/subject/${it.id}/`,
      posterUrl: String(it.img ?? ''),
    });
  }
  return results;
}

/** 纯函数：suggest 响应是否为风控/异常形态——响应为 null（非 2xx/超时）
 *  或非 JSON（风控返回 HTML 拦截页）判风控；空数组**不算**明确空态：suggest 存在
 *  「200 + 空数组」软拒绝形态（频控，实测窗口以分钟计，ADR-0178），交上层走下一路 */
export function suggestLooksBlocked(jsonText: string | null): boolean {
  if (!jsonText) return true;
  try {
    JSON.parse(jsonText);
    return false;
  } catch {
    return true;
  }
}

/** rexxar search 条目的公共面（subjects.items[]；target_type 滤书/营销位） */
interface RexxarSearchItem {
  target_type?: string;
  target?: { title?: string; uri?: string; cover_url?: string };
}

/** 纯函数：解析 rexxar 移动搜索 JSON（ADR-0178 第二路）：
 *  subjects.items[] 只留 movie/tv（滤书籍与营销位）；sid 从 uri
 *  （douban://douban.com/<movie|tv>/<sid>）提取；cover_url 已是 large 规格直用
 *  （upgradePosterUrl 对无 s_ratio_poster 的 URL 原样返回，无害） */
export function parseRexxarSearch(jsonText: string): DoubanSearchResult[] {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const items = data?.subjects?.items;
  if (!Array.isArray(items)) return [];
  const results: DoubanSearchResult[] = [];
  for (const it of items as RexxarSearchItem[]) {
    const type = it?.target_type;
    const sid = it?.target?.uri?.match(/\/(\d+)/)?.[1];
    if ((type !== 'movie' && type !== 'tv') || !sid) continue;
    results.push({
      title: String(it.target?.title ?? '').trim(),
      detailUrl: `https://movie.douban.com/subject/${sid}/`,
      posterUrl: String(it.target?.cover_url ?? ''),
    });
  }
  return results;
}

/** 纯函数：解析豆瓣搜索页 HTML（www.douban.com/search，ADR-0178 第三路复活：
 *  result 块 → title/detailUrl/posterUrl；作为前两路 JSON 通道都拿不到时的兜底） */
export function parseSearchResults(html: string): DoubanSearchResult[] {
  const results: DoubanSearchResult[] = [];
  const itemRegex = /class="result"[\s\S]*?<div class="pic">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<div class="title">[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    const posterUrl = match[2];
    const title = match[3].trim();
    // 搜索结果链接是 link2 跳转包装，url= 参数里才是真实 subject 地址
    const urlMatch = rawUrl.match(/url=([^&]+)/);
    const detailUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;
    results.push({ title, detailUrl, posterUrl });
  }
  return results;
}

/** 纯函数：搜索页响应是否为风控拦截页——响应过短或无搜索结果结构
 *  （正常搜索页 >20KB 且含 result 块）；空态页含「没有找到」文案放行 */
export function searchPageLooksBlocked(html: string | null): boolean {
  if (!html) return true;
  if (html.length < 8000) return true;
  return !html.includes('class="result"') && !html.includes('没有找到') && !html.includes('没有相关的搜索结果');
}

/** 单路检索探测结果：hit = 命中结果；empty = 服务端正常应答但无结果（可能是软拒绝，
 *  交下一路）；blocked = 明确被拦（null/非 JSON/风控页）。任一路网络异常上抛 → network（C6） */
type SearchProbe =
  | { kind: 'hit'; results: DoubanSearchResult[] }
  | { kind: 'empty' }
  | { kind: 'blocked' };

/** 纯函数：海报规格升到 l（原图档）——s_ratio_poster / m_ratio_poster → l_ratio_poster。
 *  s 来自 suggest（缩略）、m 来自 rexxar subject 的 pic.large，两路都要能升到同一张图；
 *  无该片段的 URL（如 `large/public/p*.jpg`）原样返回，无害。 */
export function upgradePosterUrl(url: string): string {
  return url.replace(/[sm]_ratio_poster/, 'l_ratio_poster');
}

/** 纯函数：列表值归一化（审查 C2）——ApiZero 的 actor/genre/director/area 是逗号分隔，
 *  消费端（analysis.ts splitAdd、recommend.ts topBy）按 ` / ` 切分：全/半角逗号及其后空格
 *  统一改写为 ` / `；已含 ` / ` 的值不受影响（无逗号则原样返回，不重复替换） */
export function normalizeListValue(val: string): string {
  return val.replace(/[,，]\s*/g, ' / ');
}

/** 从详情页 URL 提取 subject ID */
export function extractSid(detailUrl: string): string | null {
  const m = detailUrl.match(/subject\/(\d+)/);
  return m ? m[1] : null;
}

interface CelebritiesInfo {
  directors: string;
  writers: string;
  casts: string;
  mediaType: 'tv' | 'movie' | null;
}

/** 纯函数：rexxar Celebrities JSON → 导演/编剧/主演（照搬 parseCelebrities；主演截前 6） */
export function parseCelebrities(data: any): { directors: string; writers: string; casts: string } {
  if (!data || data.msg) return { directors: '', writers: '', casts: '' };
  const directors = (data.directors || []).map((d: any) => d.name || d).join(' / ');
  const ws = (data.celebrities || []).filter((c: any) => (c.roles || []).some((r: string) => /编剧/.test(r)));
  const writers = ws.map((w: any) => w.name).join(' / ');
  const actors = data.actors || [];
  const casts = actors.length
    ? (typeof actors[0] === 'object' ? actors.slice(0, 6).map((a: any) => a.name || '').filter(Boolean) : actors.slice(0, 6)).join(' / ')
    : '';
  return { directors, writers, casts };
}

// ---------- 条目字段面（豆瓣移动端详情为主源，ApiZero 为可选兜底） ----------

/** 条目字段面：写回段只认这一份，两路产出同构（rexxar 详情 / ApiZero），字段缺失一律空串 */
export interface SubjectInfo {
  name: string;
  year: string;
  score: string;
  director: string;
  actor: string;
  genre: string;
  area: string;
  duration: string;
  /** 总集数（非季数），勿作季集写入（审查 C1 撤回：季集是季数口径，见 ADR-0129 修订更正） */
  episodes: string;
  isTv: boolean;
  doubanUrl: string;
  /** 远程海报 URL（ApiZero 不返回，恒空串） */
  posterUrl: string;
  /** 热门短评 + 作者（issue 303 字段扩展；只有 ApiZero 有，rexxar 详情没有） */
  shortComment: string;
  commentAuthor: string;
}

/** ApiZero 豆瓣电影信息接口（v1.apizero.cn/api/douban-movie?id=<sid>，Bearer key）。
 *  code !== 0（无效 id/额度耗尽等）→ null，交上层走 rexxar 兜底 */
export async function fetchApizeroInfo(sid: string, key: string, httpGet: HttpGet): Promise<SubjectInfo | null> {
  const text = await httpGet(`https://v1.apizero.cn/api/douban-movie?id=${encodeURIComponent(sid)}`, {
    Authorization: `Bearer ${key}`,
  });
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    if (!j || j.code !== 0 || !j.data) return null;
    const d = j.data;
    return {
      name: String(d.name ?? ''),
      year: String(d.year ?? ''),
      score: String(d.score ?? ''),
      director: String(d.director ?? ''),
      actor: String(d.actor ?? ''),
      genre: String(d.genre ?? ''),
      area: String(d.area ?? ''),
      duration: String(d.duration ?? ''),
      episodes: String(d.episodes ?? ''),
      isTv: d.is_tv === true,
      doubanUrl: String(d.douban_url || `https://movie.douban.com/subject/${sid}/`),
      posterUrl: '',
      shortComment: String(d.short_comment ?? ''),
      commentAuthor: String(d.comment_author ?? ''),
    };
  } catch {
    return null;
  }
}

// ---------- 端到端抓取 ----------

/** rexxar 演职员探测（tv 优先 404 判电影，照搬 fetchSubjectInfo 第 2 步；带 Cookie 注入） */
export async function fetchCelebrities(sid: string, httpGet: HttpGet, cookie?: string): Promise<CelebritiesInfo | null> {
  const headers: Record<string, string> = { Referer: `https://m.douban.com/movie/subject/${sid}/` };
  if (cookie) headers.Cookie = cookie;
  for (const type of ['tv', 'movie'] as const) {
    const text = await httpGet(`https://m.douban.com/rexxar/api/v2/${type}/${sid}/celebrities`, headers);
    if (text && text.length > 150) {
      try {
        const data = JSON.parse(text);
        if (!data.msg) {
          const c = parseCelebrities(data);
          return { ...c, mediaType: type };
        }
      } catch { /* 非 JSON 下一类型 */ }
    }
  }
  return null;
}

/** 纯函数：rexxar subject 详情 JSON → 海报 URL（pic.large 优先、pic.normal 兜底，
 *  再退 cover_url）。404 体（traversal_error）/非 JSON/无 pic → 空串。
 *  只认 http(s) 开头的真地址：畸形 JSON 可能给字符串哨兵（"0"/"null"），照单收下会让
 *  下游拿它当 URL 去下载——预览卡换了个注定失败的图源，队列还会把它记成 network 失败
 *  反复重抓。 */
export function parseRexxarSubjectPic(json: string | null): string {
  if (!json) return '';
  try {
    const d = JSON.parse(json);
    // 逐个候选过守卫（不用 `||` 链）：哨兵占了 pic.large 时不该连带丢掉正常的 pic.normal
    for (const c of [d?.pic?.large, d?.pic?.normal, d?.cover_url]) {
      if (typeof c === 'string' && /^https?:\/\//.test(c)) return c;
    }
    return '';
  } catch {
    return '';
  }
}

// ---------- 豆瓣移动端条目详情（rexxar）：字段主源 ----------

/** rexxar subject 详情里用得到的键（其余一律不认） */
interface RexxarSubjectJson {
  id?: unknown;
  title?: unknown;
  year?: unknown;
  type?: unknown;
  is_tv?: unknown;
  rating?: { value?: unknown };
  directors?: { name?: string }[];
  actors?: { name?: string }[];
  genres?: unknown[];
  countries?: unknown[];
  durations?: unknown[];
  episodes_count?: unknown;
  pic?: { large?: unknown; normal?: unknown };
  cover_url?: unknown;
}

/** 纯函数：rexxar subject 详情 JSON → 条目字段面。
 *  **判据是「有 id 且有 title」**——celebrities / search / 错误体（{msg}）都没有这两个键，
 *  据此把「条目详情」与「别的什么 JSON」分开；判不出就是 null，交上层走 ApiZero 兜底。
 *  值口径：导演/主演各截前 6（与 celebrities 一致）、列表用 ` / ` 拼（与 normalizeListValue 同形）、
 *  上映日期取 **year** 不取 pubdate——pubdate 首项常是重映/修复版（肖申克是 2026 年重映），
 *  写进去会把 1994 的片子标成 2026。 */
export function parseRexxarSubject(json: string | null): SubjectInfo | null {
  if (!json) return null;
  let d: RexxarSubjectJson;
  try {
    d = JSON.parse(json) as RexxarSubjectJson;
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object') return null;
  const sid = String(d.id ?? '').trim();
  const name = String(d.title ?? '').trim();
  // 判据只认 title：真实的条目详情必有它，celebrities / search / 错误体都没有。
  // id 缺了不拦——doubanUrl 交给调用方按入参 sid 兜底（写链接不该因一个冗余字段丢整条）。
  if (!name) return null;
  const people = (arr?: { name?: string }[]): string =>
    Array.isArray(arr) ? arr.slice(0, 6).map((p) => String(p?.name ?? '').trim()).filter(Boolean).join(' / ') : '';
  const list = (arr?: unknown[]): string =>
    Array.isArray(arr) ? arr.map((v) => String(v ?? '').trim()).filter(Boolean).join(' / ') : '';
  const pic = parseRexxarSubjectPic(json);
  const rating = typeof d.rating?.value === 'number' && d.rating.value > 0 ? String(d.rating.value) : '';
  return {
    name,
    year: String(d.year ?? '').trim(),
    score: rating,
    director: people(d.directors),
    actor: people(d.actors),
    genre: list(d.genres),
    area: list(d.countries),
    duration: list(d.durations).split(' / ')[0] ?? '',
    episodes: d.episodes_count ? String(d.episodes_count) : '',
    isTv: d.type === 'tv' || d.is_tv === true,
    doubanUrl: sid ? `https://movie.douban.com/subject/${sid}/` : '',
    posterUrl: pic,
    shortComment: '',
    commentAuthor: '',
  };
}

/** 按 sid 取豆瓣移动端条目详情（免费、不需任何 key；配了 Cookie 就带——登录态过风控率更高）。
 *  movie 路径对剧集 sid 也返回数据（实测），故先 movie 后 tv 兜底，常态一次请求。 */
export async function fetchRexxarSubject(sid: string, httpGet: HttpGet, cookie?: string): Promise<SubjectInfo | null> {
  const headers: Record<string, string> = { Referer: `https://m.douban.com/movie/subject/${sid}/` };
  if (cookie) headers.Cookie = cookie;
  for (const type of ['movie', 'tv'] as const) {
    try {
      const info = parseRexxarSubject(await httpGet(`https://m.douban.com/rexxar/api/v2/${type}/${sid}`, headers));
      if (info) return info;
    } catch { /* 异常/非详情体 → 换下一类型 */ }
  }
  return null;
}

/** rexxar subject 详情取海报 URL（issue 540）：sid 直取路径的补图腿。
 *  ApiZero 接口不返回海报，名称索引命中后跳过三路检索就再没有别的图源——预览卡与后台抓取
 *  都只能停在骨架 / 缺图。按 sid 精确取（不依赖名称匹配，比回流按名检索更准也更省）；
 *  movie 接口对剧集 sid 也返回数据（实测），故先 movie 后 tv 兜底——与 fetchCelebrities
 *  的 404 探测同款。任何异常/空 → 空串（图缺就缺，不抬走整条解析）。 */
export async function fetchSubjectPoster(sid: string, httpGet: HttpGet, cookie?: string): Promise<string> {
  return (await fetchRexxarSubject(sid, httpGet, cookie))?.posterUrl ?? '';
}

export type DoubanFetchOutcome =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: 'blocked' | 'notfound' | 'network' | 'write' };

/** 字段值形态：string = 已有则原地更新；{ value, ifMissing } = 仅当字段缺失时写入（审查
 *  C8/C9 拍板口径：防重抓覆盖用户手工修正，缺失才填） */
type FmFieldSpec = string | { value: string; ifMissing: boolean };

/** frontmatter 更新（纯函数，照搬 note-processor updateFrontmatterFields 的行级口径）：
 *  string 字段已有则原地更新、新字段插到 tags 列表后；ifMissing 字段已有则跳过；空值跳过。
 *  「已有」判断基于本函数收到的 content——调用方传入 process 回调的 fresh 内容即天然完成
 *  「写回前基于最新内容复核」（C8） */
export function updateFrontmatterFields(content: string, fields: Record<string, FmFieldSpec>): string {
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) {
    const fmLines = ['---'];
    for (const [k, spec] of Object.entries(fields)) {
      const v = typeof spec === 'string' ? spec : spec.value;
      if (v) fmLines.push(`${k}: ${yamlScalarOf(v)}`);
    }
    fmLines.push('---');
    return fmLines.join('\n') + '\n' + content;
  }
  const header = fmMatch[1];
  const footer = fmMatch[3];
  const rest = content.slice(fmMatch[0].length);
  const lines = fmMatch[2].split(/\r?\n/);

  let insertIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\s+- /)) insertIdx = i + 1;
  }
  const existingKeys = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(/^([^:]+):/);
    if (m) existingKeys.set(m[1].trim(), m[1]);
  }
  /** 取键当前值（剥引号；空值 null）——与 fieldValue 同口径，供「缺失才填」判断 */
  const lineValue = (key: string): string | null => {
    const m = lines.map((l) => l.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))).find(Boolean) as RegExpExecArray | null;
    if (!m) return null;
    const v = m[1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
    return v || null;
  };
  const newLines: string[] = [];
  for (const [key, spec] of Object.entries(fields)) {
    const val = typeof spec === 'string' ? spec : spec.value;
    if (!val) continue;
    if (existingKeys.has(key)) {
      // 缺失才填（C8/C9）：已有**非空**值不动，保留用户手改与存量；
      // 空值键（如模板预置的 `海报:`）视为缺失照写——否则属性永不回填，
      // 队列判未齐反复入队重抓（实测一次会话一张海报 + 一条 embed 的恶性循环）
      if (typeof spec !== 'string' && spec.ifMissing && lineValue(key)) continue;
      const lineKey = existingKeys.get(key)!;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(new RegExp(`^${lineKey}:`))) {
          lines[i] = `${lineKey}: ${yamlScalarOf(val)}`;
          break;
        }
      }
    } else {
      newLines.push(`${key}: ${yamlScalarOf(val)}`);
    }
  }
  if (newLines.length > 0) lines.splice(insertIdx, 0, ...newLines);
  return header + lines.join('\n') + footer + rest;
}

/** 正文 frontmatter 后插入海报 embed（纯函数，照搬 insertPosterEmbed；已存在跳过）。
 *  兼容 FM 闭合 --- 恰为文件末行（无尾换行）形态（审查 C4）：补换行后 embed 仍插在
 *  frontmatter 之后，frontmatter 保持居首有效 */
export function insertPosterEmbed(content: string, posterPath: string): string {
  const embedLink = `![[${posterPath}]]`;
  if (content.includes(embedLink)) return content;
  const fmMatch = content.match(/^(---\r?\n[\s\S]*?\r?\n---)(\r?\n)?/);
  if (fmMatch) {
    if (fmMatch[2]) {
      // FM 后已有换行：embed 紧跟 FM 闭合行
      return fmMatch[0] + embedLink + '\n' + content.slice(fmMatch[0].length);
    }
    // FM 即文件末尾（无尾换行）：先补换行再插 embed，结果首字符仍是 `---`
    return fmMatch[1] + '\n' + embedLink + '\n' + content.slice(fmMatch[1].length);
  }
  return embedLink + '\n' + content;
}

/** frontmatter 行级字段读取（剥引号；空值 null——队列 fetchComplete 同口径） */
function fieldValue(content: string, key: string): string | null {
  const m = content.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return null;
  const v = m[1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
  return v || null;
}

/** 豆瓣查询结果（**不落盘、不下载海报**）：字段取回来、海报只给远程 URL。
 *  两个调用方：表单「解析」（展示 + 交给 Jev 判分类）、抓取队列（继续下载海报并写盘）。 */
export interface DoubanQuery {
  /** 搜索命中的标题（可能与用户输入不同——豆瓣条目的规范名） */
  title: string;
  detailUrl: string;
  sid: string;
  /** 远程海报 URL（未下载；表单直接 img 展示，队列下载后落盘） */
  posterUrl: string;
  /** 条目字段面：豆瓣移动端详情优先，ApiZero 兜底（两者同构，写回段不关心来源） */
  subject: SubjectInfo | null;
  celebrities: CelebritiesInfo | null;
}

/** 查询失败原因（与 DoubanFetchOutcome 同口径，写盘类原因除外） */
export type DoubanQueryOutcome =
  | { ok: true; data: DoubanQuery }
  | { ok: false; reason: 'blocked' | 'notfound' | 'network' };

// ---------- 检索三路（ADR-0178：suggest → rexxar search → 搜索页） ----------

/** 检索公共头：各路自带业务 Referer（withLang = 附 Accept-Language）；配了 Cookie 就带
 *  （登录态提高过风控率——单一写点，三路共用） */
function doubanHeaders(referer: string, deps: DoubanFetchDeps, withLang = false): Record<string, string> {
  const headers: Record<string, string> = withLang
    ? { Referer: referer, 'Accept-Language': 'zh-CN,zh;q=0.9' }
    : { Referer: referer };
  if (deps.doubanCookie) headers.Cookie = deps.doubanCookie;
  return headers;
}

/** 三路单发：suggest 补全（主路，JSON、信息全）。软拒绝（200+空数组）归 empty 交下一路 */
async function probeSuggest(name: string, deps: DoubanFetchDeps): Promise<SearchProbe> {
  const headers = doubanHeaders('https://movie.douban.com/', deps, true);
  const json = await deps.httpGet(`https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(name)}`, headers);
  if (suggestLooksBlocked(json)) return { kind: 'blocked' };
  const results = parseSuggestResults(json!);
  return results.length > 0 ? { kind: 'hit', results } : { kind: 'empty' };
}

/** 三路单发：rexxar 移动搜索（二路；与 suggest 频控池独立，实测 suggest 全空时仍命中） */
async function probeRexxarSearch(name: string, deps: DoubanFetchDeps): Promise<SearchProbe> {
  const headers = doubanHeaders('https://m.douban.com/movie/', deps);
  const json = await deps.httpGet(`https://m.douban.com/rexxar/api/v2/search?q=${encodeURIComponent(name)}&count=5`, headers);
  if (!json) return { kind: 'blocked' };
  const results = parseRexxarSearch(json);
  return results.length > 0 ? { kind: 'hit', results } : { kind: 'empty' };
}

/** 三路单发：搜索页 HTML（末路兜底；体积大、风控面最宽，仅供最后一级） */
async function probeSearchPage(name: string, deps: DoubanFetchDeps): Promise<SearchProbe> {
  const headers = doubanHeaders('https://movie.douban.com/', deps, true);
  const html = await deps.httpGet(`https://www.douban.com/search?cat=1002&q=${encodeURIComponent(name)}`, headers);
  if (searchPageLooksBlocked(html)) return { kind: 'blocked' };
  const results = parseSearchResults(html!);
  return results.length > 0 ? { kind: 'hit', results } : { kind: 'empty' };
}

/** rexxar 演职员兜底：ApiZero 缺导演/主演时补（口径同 fetchNoteDouban C9）。
 *  异常收口（评审 P1-2）：rexxar 腿网络异常不抬走整体——字段缺就缺，解析照常成功 */
async function celebritiesIfMissing(sid: string, az: SubjectInfo | null, deps: DoubanFetchDeps): Promise<CelebritiesInfo | null> {
  try {
    if (!az || !az.director || !az.actor) return await fetchCelebrities(sid, deps.httpGet, deps.doubanCookie);
  } catch {
    return null;
  }
  return null;
}

/**
 * 按片名查询豆瓣（三路检索链 → sid → ApiZero 字段 → rexxar 演职员兜底）。
 * 表单「解析」与抓取队列 `fetchNoteDouban` **共用这一段**——各写一份必然漂移。
 * 只走网络、不碰文件系统，故不需要 TFile（表单阶段草稿尚未落盘）。
 *
 * 链路口径（ADR-0178）：逐路尝试，命中即用；suggest 有「200+空数组」软拒绝形态
 * （频控），empty 一律交下一路。全部走完未命中：任一路明确被拦 → blocked（提示
 * 「稍后再试」语义），否则 → notfound。任一路网络异常上抛 → network（C6：不与
 * 风控混淆；前路已成功的请求不浪费——单条内三连发上限，无指数放大）。
 */
export async function queryDoubanByName(name: string, deps: DoubanFetchDeps): Promise<DoubanQueryOutcome> {
  let first: DoubanSearchResult | null = null;
  let sawBlocked = false;
  try {
    for (const probe of [probeSuggest, probeRexxarSearch, probeSearchPage]) {
      const r = await probe(name, deps);
      if (r.kind === 'hit') { first = r.results[0]; break; }
      if (r.kind === 'blocked') sawBlocked = true;
    }
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (!first) return { ok: false, reason: sawBlocked ? 'blocked' : 'notfound' };
  const sid = extractSid(first.detailUrl);
  if (!sid) return { ok: false, reason: 'notfound' };

  // 字段：豆瓣移动端详情（免费、无 key、一次拿齐 评分/导演/主演/类型/地区/片长/上映年份/海报）
  // → 拿不到才回落 ApiZero（可选，需 key；多一项热门短评）
  let subject: SubjectInfo | null = null;
  try {
    subject = await fetchRexxarSubject(sid, deps.httpGet, deps.doubanCookie);
  } catch {
    subject = null;
  }
  if (!subject && deps.apizeroKey) {
    try {
      subject = await fetchApizeroInfo(sid, deps.apizeroKey, deps.httpGet);
    } catch {
      subject = null;
    }
  }
  const celebrities = await celebritiesIfMissing(sid, subject, deps);
  return {
    ok: true,
    data: {
      title: subject?.name || first.title,
      detailUrl: subject?.doubanUrl || first.detailUrl,
      sid,
      posterUrl: subject?.posterUrl || first.posterUrl,
      subject,
      celebrities,
    },
  };
}

/**
 * 带 sid 直取（issue 498 / ADR-0210）：本地名称索引命中后跳过三路检索，ApiZero 按 ID 拿字段。
 * 与 queryDoubanByName 的字段段完全同构（ApiZero → 缺导演/主演时 rexxar celebrities 兜底），
 * 差异只有两点：sid 来自索引而非检索产物；海报 URL 由 **rexxar subject 详情**补
 * （issue 540——ApiZero 无此字段，原来落到 `posterUrl = ''`，预览卡永远停在骨架、
 * 片单导入的条目也永远缺图，且队列按「缺海报」反复重抓；补图腿失败仍是空串，
 * 由保存/队列路径兜底，不抬走整条解析）。
 * ApiZero 不可用（key 未配/额度尽/网络空文）→ `{ ok: false, reason: 'notfound' }`，
 * 调用方（queryDoubanForPreview）据此回落按名全链，不在本层静默吞掉。
 */
export async function queryDoubanBySid(sid: string, name: string, deps: DoubanFetchDeps): Promise<DoubanQueryOutcome> {
  // 主路：豆瓣移动端详情（与 queryDoubanByName 的字段段同构）。一次请求同时给出
  // 评分/导演/主演/类型/地区/片长/上映年份/集数/海报——海报不再单独补腿
  let subject: SubjectInfo | null = null;
  try {
    subject = await fetchRexxarSubject(sid, deps.httpGet, deps.doubanCookie);
  } catch {
    subject = null;
  }
  // 兜底：ApiZero（配了 key 才有意义；它给的字段更少、额度按天算，只做兜底不做主路）
  if (!subject && deps.apizeroKey) {
    try {
      subject = await fetchApizeroInfo(sid, deps.apizeroKey, deps.httpGet);
    } catch {
      subject = null;
    }
  }
  if (!subject) return { ok: false, reason: 'notfound' };
  const celebrities = await celebritiesIfMissing(sid, subject, deps);
  const posterUrl = subject.posterUrl || (await fetchSubjectPoster(sid, deps.httpGet, deps.doubanCookie));
  return {
    ok: true,
    data: {
      title: subject.name || name,
      detailUrl: subject.doubanUrl || `https://movie.douban.com/subject/${sid}/`,
      sid,
      posterUrl,
      subject,
      celebrities,
    },
  };
}

/**
 * 海报下载落库（唯一实现）：高清 URL → 二进制 → 写盘，返回 vault 相对路径。
 * 两处共用：抓取队列 `fetchNoteDouban`，与「添加影视」保存（表单解析阶段已拿到远程 URL，
 * 保存即落盘 → 建档即齐、不再入队后台抓取；issue 397）。
 * 失败原因按 C6 语义拆开（network / write）由调用方决定怎么处置。
 */
export async function downloadPosterToVault(
  name: string,
  posterUrl: string,
  deps: DoubanFetchDeps,
): Promise<{ ok: true; path: string } | { ok: false; reason: 'network' | 'write' }> {
  let buf: ArrayBuffer | null;
  try {
    buf = await deps.downloadBinary(upgradePosterUrl(posterUrl), { Referer: 'https://movie.douban.com/' });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (!buf) return { ok: false, reason: 'network' };
  try {
    const posterFolder = String(deps.posterFolder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    // 三跳全空（没设海报文件夹、Obsidian 没固定附件目录、影视目录也没配）：不写盘，绝不落库根
    if (!posterFolder) return { ok: false, reason: 'write' };
    await deps.mkdir(posterFolder);
    const ext = posterUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)?.[1] || 'jpg';
    const safeName = name.replace(ILLEGAL_NAME_RE_GLOBAL, '_');
    const path = `${posterFolder}/${safeName}_${(deps.now || Date.now)()}.${ext}`;
    await deps.writeBinary(path, buf);
    return { ok: true, path };
  } catch {
    return { ok: false, reason: 'write' };
  }
}

/**
 * 单条笔记抓取（队列执行器注入点；成功 = 海报与豆瓣链接都写齐或本已齐全）。
 * 链路：suggest 检索（风控检测）→ 海报下载写盘（无海报时）→ ApiZero 字段 + rexxar 兜底 → frontmatter 写入。
 * 检索失败/网络异常 → network；suggest 风控/异常形态 → blocked；海报下载失败 → network；写盘失败 → write。
 * 写回经 vault.process：字段一律「缺失才填」并基于回调内 fresh 内容复核（C8），
 * 抓取期间用户手改不会被覆盖。
 */
export async function fetchNoteDouban(app: App, file: TFile, deps: DoubanFetchDeps, sid?: string): Promise<DoubanFetchOutcome> {
  // sid（豆瓣片单导入携带）：直取 queryDoubanBySid 跳过名称三路检索——与表单解析的
  // sid 直取同口径（issue 498），少一次检索请求也少一路误配风险
  const name = extractMovieName(file.name);
  let content: string;
  try {
    content = await app.vault.read(file);
  } catch {
    return { ok: false, reason: 'network' };
  }
  // 海报只读一次：hasPoster 与下面的相对路径同源（同快照，读两次白读）
  let posterRelative = fieldValue(content, '海报');
  const hasPoster = !!posterRelative;
  const doubanUrlRaw = fieldValue(content, '豆瓣链接');
  const hasDoubanInfo = !!doubanUrlRaw && /^https?:\/\//.test(doubanUrlRaw);
  if (hasPoster && hasDoubanInfo) return { ok: true, skipped: true };

  // 1. 查询（suggest 检索 + 字段；与表单「解析」共用查询链，单源不裂；有 sid 直取）
  let q = sid ? await queryDoubanBySid(sid, name, deps) : await queryDoubanByName(name, deps);
  // sid 直取只认 sid（豆瓣详情按 id 取，不依赖任何 key）。sid 失效/条目被删时回落按名检索，
  // 多给一条腿——2026-11-01 真机：导入 105 部全报「豆瓣信息获取失败」，根因是当时 sid 直取
  // 依赖 ApiZero 却没配 key，一条都补不上。现在该路径免费，回落只剩「sid 确实取不到」这一种情形。
  if (!q.ok && sid) q = await queryDoubanByName(name, deps);
  if (!q.ok) return { ok: false, reason: q.reason };
  // 参数 sid 仅用于查询前分流（直取 vs 按名检索）；命中后的链接/字段同源，不解构冗余键
  const { detailUrl, posterUrl, subject: az, celebrities: cel } = q.data;

  // 2. 海报（无海报时：高清 URL → 二进制 → 写盘 → frontmatter + 正文 embed）。
  //  保存目录/下载失败语义都在 downloadPosterToVault 里（与表单保存同一份实现）
  if (!hasPoster && posterUrl) {
    const dl = await downloadPosterToVault(name, posterUrl, deps);
    if (!dl.ok) return { ok: false, reason: dl.reason };
    posterRelative = dl.path;
  }

  // 3. 字段：豆瓣移动端详情（主源）→ ApiZero（可选兜底）；缺导演/主演时 rexxar 演职员补齐。
  //  口径（C9）：除豆瓣链接（修正脏值）外一律缺失才填——「已有」判断交给写回时基于
  //  fresh 内容复核（C8），此处不再依赖抓取开始时的快照
  const fields: Record<string, FmFieldSpec> = {};
  if (posterRelative) fields['海报'] = { value: posterRelative, ifMissing: true };
  fields['豆瓣链接'] = detailUrl;
  if (az) {
    if (az.score) fields['豆瓣评分'] = { value: az.score, ifMissing: true };
    if (az.director) fields['导演'] = { value: normalizeListValue(az.director), ifMissing: true };
    if (az.actor) fields['主演'] = { value: normalizeListValue(az.actor), ifMissing: true };
    if (az.genre) fields['类型'] = { value: normalizeListValue(az.genre), ifMissing: true };
    if (az.area) fields['制片国家/地区'] = { value: normalizeListValue(az.area), ifMissing: true };
    if (az.duration) fields['片长'] = { value: az.duration, ifMissing: true };
    // issue 303 字段扩展（ADR-0129 修订）：上映日期降级年份、热门短评，均缺失才填。
    // 季集←episodes 已撤回（C1）：episodes 是总集数非季数，勿写入
    if (az.year) fields['上映日期'] = { value: az.year, ifMissing: true };
    if (az.shortComment) fields['热门短评'] = { value: az.shortComment, ifMissing: true };
  }
  if (cel) {
    if (!fields['导演'] && cel.directors) fields['导演'] = { value: cel.directors, ifMissing: true };
    if (cel.writers) fields['编剧'] = { value: cel.writers, ifMissing: true };
    if (!fields['主演'] && cel.casts) fields['主演'] = { value: cel.casts, ifMissing: true };
  }

  // 4. 写入（vault.process 原子读改写；海报 embed 先于字段更新算好内容一次写）。
  //  fresh 复核（C8）：缺失才填由 updateFrontmatterFields 基于 c 复核；embed 仅当
  //  fresh 内容确无海报字段时插入（抓取中途用户贴海报则跳过）
  try {
    await app.vault.process(file, (c) => {
      let next = updateFrontmatterFields(c, fields);
      if (posterRelative && !hasPoster && !fieldValue(c, '海报')) next = insertPosterEmbed(next, posterRelative);
      return next;
    });
  } catch {
    return { ok: false, reason: 'write' };
  }
  return { ok: true };
}

// ==================== 豆瓣片单导入（一键批量建档） ====================

/** 片单条目（解析产物）：豆瓣条目 sid + 片名原文。
 *  stars/at/comment 只有**个人收藏页**（collect/wish）才有——豆瓣片单页（doulist）没有
 *  评分与标记日期，恒为 null/空。 */
export interface DoubanListEntry {
  sid: string;
  name: string;
  /** 我的评分（豆瓣 1~5 星；没打分 null）。豆瓣不能打半星，故无小数形态 */
  stars?: number | null;
  /** 标记日期 YYYY-MM-DD（我的收藏页的「看过/想看」日期；无 null） */
  at?: string | null;
  /** 我的短评（收藏页「备注」；无 ''） */
  comment?: string;
}

/** HTML 实体还原（片名/短评都走它；与浏览器同口径的最小集） */
function unescapeHtml(t: string): string {
  return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'');
}

/** 个人收藏页条目块 → 条目（纯函数，见 parseDoubanEntriesHtml 的口径注记） */
function parseCollectBlock(block: string): DoubanListEntry | null {
  const sid = /movie\.douban\.com\/subject\/(\d+)\//.exec(block)?.[1] ?? '';
  if (!sid) return null;
  // 片名三级回落：海报 <a title>（属性两序都吃）→ <em> 标题 → 链接文本（doulist 形态）
  const raw =
    /<a[^>]*?\stitle="([^"]*)"[^>]*?href="[^"]*subject\/\d+\//.exec(block)?.[1] ??
    /subject\/\d+\/[^>]*?\stitle="([^"]*)"/.exec(block)?.[1] ??
    /<em>([^<]*)<\/em>/.exec(block)?.[1] ??
    /subject\/\d+\/"[^>]*>([^<]{0,200})</.exec(block)?.[1] ??
    '';
  const name = stripForeignName(unescapeHtml(raw).replace(/\s+/g, ' ').trim());
  if (!name) return null;
  const stars = /class="rating(\d)-t"/.exec(block)?.[1];
  const at = /class="date">\s*(\d{4}-\d{2}-\d{2})/.exec(block)?.[1] ?? null;
  const comment = /class="comment">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? '';
  return {
    sid,
    name,
    stars: stars ? Number(stars) : null,
    at,
    comment: unescapeHtml(comment).replace(/\s+/g, ' ').trim(),
  };
}

/**
 * 豆瓣列表页 → 条目（**块级解析**，collect/wish 个人收藏页与 doulist 豆列通用）。
 *
 * 为什么必须块级：collect/wish 页的海报链接是 `<a title="片名" href="…/subject/N/">`——
 * **title 在 href 之前**；标题链接的片名又被 `<em>` 包着。老的行级正则
 * （`subject/N/"…title="…"` + 回落链接文本）两处都只能截到换行空白，
 * 实测 30 个链接全部空名 → 抓到 0 条，UI 把它误报成「需要登录态」
 * （2026-10-31 真机根因；cookie 本身是好的）。块级解析按 `<div class="item` 切块后
 * 在块内取字段，属性顺序不再影响结果，顺带拿到评分 / 标记日期 / 短评。
 *
 * 页面没有 `.item` 块（部分豆列形态）→ 回落 parseDoubanListHtml（只出 sid + 片名）。
 */
export function parseDoubanEntriesHtml(html: string): DoubanListEntry[] {
  if (!html) return [];
  const starts: number[] = [];
  const blockRe = /<div class="item\b/g;
  for (let m = blockRe.exec(html); m; m = blockRe.exec(html)) starts.push(m.index);
  if (!starts.length) return parseDoubanListHtml(html).map((e) => ({ ...e, stars: null, at: null, comment: '' }));
  const out: DoubanListEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < starts.length; i++) {
    const block = html.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : html.length);
    const e = parseCollectBlock(block);
    if (e && !seen.has(e.sid)) {
      seen.add(e.sid);
      out.push(e);
    }
  }
  return out;
}

/** 豆瓣个人收藏页 URL（数字 uid；dbcl2 前缀即 uid，见 doubanUidFromCookie） */
export function doubanMineCollectUrl(uid: string): string {
  return `https://movie.douban.com/people/${encodeURIComponent(uid)}/collect`;
}

/**
 * cookie → 豆瓣数字 uid（个人收藏页定位用）：登录态 cookie 的 `dbcl2` 值形如
 * `"150820610:xxxxx"` 或 `150820610:xxxxx`，冒号前那段就是 uid（数字 id 恒有效，
 * 自定义域名可能被改，故不读域名）。没有 dbcl2 = 不是登录态 cookie → null。
 */
export function doubanUidFromCookie(cookie: string): string | null {
  return /dbcl2=(?:"|')?(\d{3,})/.exec(cookie || '')?.[1] ?? null;
}

/**
 * 片名清洗：豆瓣列表页片名常是「中文名 Foreign Name」形态，导入建档只留中文名
 * （2026-09-30 拍板）。按空格切 token 后从尾部剥「不含 CJK 的连续 token 段」：
 *   - 整名没有任何 CJK → 原样（纯外文名不动）
 *   - 尾段是纯数字（「银翼杀手 2049」「终结者 2018」）视作中文名一部分，不剥
 *   - 剥之前必须存在含 CJK 的 token
 * 「奥本海默 Oppenheimer」→「奥本海默」、「谍影重重 The Bourne Identity」→
 * 「谍影重重」；原名在前（「E.T. 外星人」）、中文名自带拉丁（「头文字D」）不动。
 */
export function stripForeignName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  const tokens = trimmed.split(' ').filter(Boolean);
  if (tokens.length < 2) return trimmed;
  const hasCJK = (t: string): boolean => /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/.test(t);
  if (!tokens.some(hasCJK)) return trimmed;
  let end = tokens.length;
  while (end > 1 && !hasCJK(tokens[end - 1]) && !/^[\d.．、-]+$/.test(tokens[end - 1])) end--;
  return end === tokens.length ? trimmed : tokens.slice(0, end).join(' ');
}

/**
 * 片单页 HTML → 条目列表（纯函数，测试可直接喂 HTML）。
 * 兼容豆瓣两类真实形态（doulist 豆列的条目链接**不带** title 属性，片名只在
 * 链接文本里——2026-09-30 真机 doulist 导入抓到 0 条的根因）：
 *   - wish/collect 主页收藏页：`<a href="…/subject/N/" title="片名">…</a>`
 *   - doulist 豆列：          `<a href="…/subject/N/">片名</a>`
 * title 属性优先、缺失回落链接文本；片名过 stripForeignName 只留中文名。
 * 同一片在页面里出现多次（海报链接 + 文字链接）按 sid 去重保序。空结果 = 抓不到
 * （风控/需登录/链接不对，由调用方分流提示）。
 */
export function parseDoubanListHtml(html: string): DoubanListEntry[] {
  const out: DoubanListEntry[] = [];
  const seen = new Set<string>();
  // 实体还原走模块级 unescapeHtml（与块级解析同一份）
  const re = /movie\.douban\.com\/subject\/(\d+)\/"[^>]*?(?:\stitle="([^"]*)")?[^>]*>([^<]{0,200})</g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const sid = m[1];
    const name = stripForeignName(unescapeHtml(m[2] ?? m[3] ?? ''));
    if (!name || seen.has(sid)) continue;
    seen.add(sid);
    out.push({ sid, name });
  }
  return out;
}

/**
 * 片单名提取（首页 `<title>`）：doulist 的 title 即豆列名；wish 页是「XXX 的想看」
 * 形态——都可直接当导入片单的默认名（弹层里可改）。取不到回落空串（调用方给默认值）。
 */
export function extractListTitle(html: string): string {
  const raw = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
  return raw
    .replace(/&amp;/g, '&')
    .replace(/\s*[-–—]\s*豆瓣\s*$/, '')
    .replace(/\s*\(豆瓣\)\s*$/i, '')
    .trim();
}

/** 翻页上限（防死循环/防风控激怒）：按页计，40 页 ≈ collect 页 600 部（个人收藏常见规模
 *  几百部，16 页上限会在 240 部处截断）。真正的停页靠「本页为空 / 本页无新 sid」两个条件。 */
const DOUBAN_LIST_MAX_PAGES = 40;

/** 流式抓取的逐页回调：batch = 本页新解析条目（已清洗/去重），totalSoFar = 累计 */
export type DoubanListPageCb = (batch: DoubanListEntry[], totalSoFar: number) => void;

/**
 * 抓取整个豆瓣片单/收藏页（翻页聚合，**流式**——onPage 每页回调一次，调用方可增量渲染，
 * 不必等全部抓完）：collect / wish / doulist 等 subject 列表页按 `start=` 递进。
 * **步长 = 本页实际条数**（collect 15/页、wish 25/页、doulist 20/页各不相同；写死 25
 * 会让 collect 页跳过每页第 16~25 条）。
 * 停页条件：**本页解析为空即停**（到底/需登录/风控拦截页都表现为空），**本页无新 sid 也停**
 * （翻过界豆瓣回落末页内容，继续翻只会原地打转）。cookie 可选（个人页登录态；公开豆列不填）。
 * gapMs = 页间留白（防风控；默认 0——测试同步执行不拖时间，生产由调用方给）。
 * shouldStop = 外部叫停（导入弹层关掉时用）：每页开头问一次，返回 true 就地收尾——
 *   否则关层后 collect 那 40 页照样翻完（约一分钟），抓回来的东西没人要。
 * 返回条目全集、片单名（首页 title 提取）与「是否疑似被拦」。
 */
export async function fetchDoubanList(
  base: string,
  httpGet: HttpGet,
  cookie?: string,
  onPage?: DoubanListPageCb,
  gapMs = 0,
  shouldStop?: () => boolean,
): Promise<{ entries: DoubanListEntry[]; firstPageEmpty: boolean; listTitle: string }> {
  const sep = base.includes('?') ? '&' : '?';
  const headers = cookie?.trim() ? { Cookie: cookie.trim() } : undefined;
  const all: DoubanListEntry[] = [];
  const seen = new Set<string>();
  let firstPageEmpty = false;
  let listTitle = '';
  let start = 0;
  for (let p = 0; p < DOUBAN_LIST_MAX_PAGES; p++) {
    if (shouldStop?.()) break; // 调用方已放弃（弹层关掉）：别把剩下的页翻完
    if (p > 0 && gapMs > 0) await sleep(gapMs); // 页间留白（风控；首页不等）
    let html: string | null = null;
    try {
      html = await httpGet(`${base}${sep}start=${start}`, headers);
    } catch {
      break; // 网络失败：交已抓到的部分（可能是翻页中途断），抓不到就空
    }
    const page = parseDoubanEntriesHtml(html ?? '');
    if (start === 0) {
      listTitle = html ? extractListTitle(html) : '';
      if (page.length === 0) firstPageEmpty = true;
    }
    if (page.length === 0) break;
    start += page.length; // 步长跟本页实际条数
    const fresh: DoubanListEntry[] = [];
    for (const e of page) {
      if (seen.has(e.sid)) continue;
      seen.add(e.sid);
      all.push(e);
      fresh.push(e);
    }
    if (fresh.length && onPage) onPage(fresh, all.length);
    if (fresh.length === 0) break; // 翻过界：豆瓣回落末页内容，无新条目即到底
  }
  return { entries: all, firstPageEmpty, listTitle };
}

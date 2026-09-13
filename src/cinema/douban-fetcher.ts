/**
 * 影院豆瓣抓取核心（issue 303 / ADR-0129）：自 tools/obsidian-douban-poster 移植入插件。
 * 字段链（用户拍板）：搜索豆瓣（搜索页正则解析）→ **ApiZero 豆瓣电影信息接口**（评分/导演/
 * 主演/类型/地区/片长首选 + 上映日期←year/热门短评，key 设置项）→ rexxar 演职员兜底
 * （缺导演/主演或需编剧时）；海报走豆瓣（搜索页提 URL → upgradePosterUrl 高清 → writeBinary 写盘）。
 * 豆瓣详情页 HTML 退役（字段已由 ApiZero 承接）；移动端同源可用。
 * 写回口径（审查 C8/C9 拍板）：除豆瓣链接（修正脏值）外一律「缺失才填」——已有值
 * （含用户手工修正）不覆盖；ApiZero 逗号列表值写入前归一化为消费端的 ` / ` 切分口径（C2）。
 * 纯逻辑 + 依赖注入（httpGet / downloadBinary），node 环境可测。
 */
import type { App, TFile } from 'obsidian';

/** 海报目录（对齐 CLI config 默认值） */
export const POSTER_FOLDER = 'CONFIG/MOVIE POSTER';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BILIBILI_NONE = ''; // 占位防误用（无实际引用）

void BILIBILI_NONE;

// ---------- 依赖注入 ----------

export type HttpGet = (url: string, headers?: Record<string, string>) => Promise<string | null>;
export type DownloadBinary = (url: string, headers?: Record<string, string>) => Promise<ArrayBuffer | null>;

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
  now?: () => number;
}

// ---------- 纯函数（照搬 douban-client.js 正则口径） ----------

/** 从文件名提取影视名称（《名称》.md 与 名称.md 两种格式，照搬 note-processor） */
export function extractMovieName(filename: string): string {
  const basename = filename.replace(/\.md$/i, '');
  const m = basename.match(/《(.+)》/);
  return m ? m[1] : basename;
}

export interface DoubanSearchResult {
  title: string;
  detailUrl: string;
  posterUrl: string;
}

/** 纯函数：解析豆瓣搜索页 HTML（照搬 parseSearchResults）：result 块 → title/detailUrl/posterUrl */
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

/** 纯函数：搜索响应是否为风控拦截页——响应过短或无搜索结果结构（正常搜索页 >20KB 且含 result 块） */
export function searchLooksBlocked(html: string | null): boolean {
  if (!html) return true;
  if (html.length < 8000) return true;
  // 正常搜索页必然存在结果块或「没有找到」的空态结构；风控拦截页两者皆无
  return !html.includes('class="result"') && !html.includes('没有找到') && !html.includes('没有相关的搜索结果');
}

/** 纯函数：s_ratio_poster → l_ratio_poster（高清） */
export function upgradePosterUrl(url: string): string {
  return url.replace('s_ratio_poster', 'l_ratio_poster');
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

export interface CelebritiesInfo {
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

// ---------- ApiZero 客户端 ----------

export interface ApizeroInfo {
  name: string;
  year: string;
  score: string;
  director: string;
  actor: string;
  genre: string;
  area: string;
  duration: string;
  /** ApiZero 返回为总集数，非季数，勿作季集写入（审查 C1 撤回：季集是季数口径，见 ADR-0129 修订更正） */
  episodes: string;
  isTv: boolean;
  doubanUrl: string;
  /** 热门短评 + 作者（issue 303 字段扩展，ADR-0129 修订：可选风味字段） */
  shortComment: string;
  commentAuthor: string;
}

/** ApiZero 豆瓣电影信息接口（v1.apizero.cn/api/douban-movie?id=<sid>，Bearer key）。
 *  code !== 0（无效 id/额度耗尽等）→ null，交上层走 rexxar 兜底 */
export async function fetchApizeroInfo(sid: string, key: string, httpGet: HttpGet): Promise<ApizeroInfo | null> {
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

export type DoubanFetchOutcome =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: 'blocked' | 'notfound' | 'network' | 'write' };

/** 字段值形态：string = 已有则原地更新；{ value, ifMissing } = 仅当字段缺失时写入（审查
 *  C8/C9 拍板口径：防重抓覆盖用户手工修正，缺失才填） */
export type FmFieldSpec = string | { value: string; ifMissing: boolean };

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
      if (v) fmLines.push(`${k}: ${formatYamlValue(v)}`);
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
  const existingKeys = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^([^:]+):/);
    if (m) existingKeys.add(m[1].trim());
  }
  const newLines: string[] = [];
  for (const [key, spec] of Object.entries(fields)) {
    const val = typeof spec === 'string' ? spec : spec.value;
    if (!val || val === '') continue;
    if (existingKeys.has(key)) {
      // 缺失才填（C8/C9）：已有值不动，保留用户手改与存量
      if (typeof spec !== 'string' && spec.ifMissing) continue;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(new RegExp(`^${key}:`))) {
          lines[i] = `${key}: ${formatYamlValue(val)}`;
          break;
        }
      }
    } else {
      newLines.push(`${key}: ${formatYamlValue(val)}`);
    }
  }
  if (newLines.length > 0) lines.splice(insertIdx, 0, ...newLines);
  return header + lines.join('\n') + footer + rest;
}

/** YAML 值序列化（照搬 formatYamlValue）：含特殊字符/空格双引号包裹并转义。
 *  换行先行单行化（审查 C3）：裸 \n/\r 进 frontmatter 会破坏 YAML 解析、影片从面板消失 */
function formatYamlValue(val: string): string {
  let s = String(val);
  if (/[\r\n]/.test(s)) s = s.replace(/[ \t]*[\r\n]+[ \t]*/g, ' ');
  if (/[:"\-#[\]{}|>'?]/.test(s) || s.includes(' ')) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
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

/**
 * 单条笔记抓取（队列执行器注入点；成功 = 海报与豆瓣链接都写齐或本已齐全）。
 * 链路：搜索（风控检测）→ 海报下载写盘（无海报时）→ ApiZero 字段 + rexxar 兜底 → frontmatter 写入。
 * 搜索失败/网络异常 → network；搜索风控 → blocked；海报下载失败 → network；写盘失败 → write。
 * 写回经 vault.process：字段一律「缺失才填」并基于回调内 fresh 内容复核（C8），
 * 抓取期间用户手改不会被覆盖。
 */
export async function fetchNoteDouban(app: App, file: TFile, deps: DoubanFetchDeps): Promise<DoubanFetchOutcome> {
  const name = extractMovieName(file.name);
  let content: string;
  try {
    content = await app.vault.read(file);
  } catch {
    return { ok: false, reason: 'network' };
  }
  const hasPoster = !!(fieldValue(content, '海报'));
  const doubanUrlRaw = fieldValue(content, '豆瓣链接');
  const hasDoubanInfo = !!doubanUrlRaw && /^https?:\/\//.test(doubanUrlRaw);
  if (hasPoster && hasDoubanInfo) return { ok: true, skipped: true };

  // 1. 搜索（豆瓣搜索页；Cookie 注入）。网络异常上抛接住归 network（C6：不与风控混淆）
  const searchHeaders: Record<string, string> = { Referer: 'https://movie.douban.com/', 'Accept-Language': 'zh-CN,zh;q=0.9' };
  if (deps.doubanCookie) searchHeaders.Cookie = deps.doubanCookie;
  let html: string | null;
  try {
    html = await deps.httpGet(`https://www.douban.com/search?cat=1002&q=${encodeURIComponent(name)}`, searchHeaders);
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (searchLooksBlocked(html)) return { ok: false, reason: 'blocked' };
  const results = parseSearchResults(html!);
  if (results.length === 0) return { ok: false, reason: 'notfound' };
  const first = results[0];
  const sid = extractSid(first.detailUrl);
  if (!sid) return { ok: false, reason: 'notfound' };

  // 2. 海报（无海报时：高清 URL → 二进制 → 写盘 → frontmatter + 正文 embed）。
  //  下载失败（抛错/null）归 network，写盘失败归 write（C6：下载与落盘失败语义拆分）
  let posterRelative = fieldValue(content, '海报');
  if (!hasPoster && first.posterUrl) {
    let buf: ArrayBuffer | null;
    try {
      buf = await deps.downloadBinary(upgradePosterUrl(first.posterUrl), { Referer: 'https://movie.douban.com/' });
    } catch {
      return { ok: false, reason: 'network' };
    }
    if (!buf) return { ok: false, reason: 'network' };
    try {
      await deps.mkdir(POSTER_FOLDER);
      const ext = first.posterUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)?.[1] || 'jpg';
      const safeName = name.replace(/[/\\:*?"<>|]/g, '_');
      const fileName = `${safeName}_${(deps.now || Date.now)()}.${ext}`;
      posterRelative = `${POSTER_FOLDER}/${fileName}`;
      await deps.writeBinary(posterRelative, buf);
    } catch {
      return { ok: false, reason: 'write' };
    }
  }

  // 3. 字段：ApiZero 首选 → rexxar 兜底（缺导演/主演或需编剧）。
  //  口径（C9）：除豆瓣链接（修正脏值）外一律缺失才填——「已有」判断交给写回时基于
  //  fresh 内容复核（C8），此处不再依赖抓取开始时的快照
  const fields: Record<string, FmFieldSpec> = {};
  if (posterRelative) fields['海报'] = { value: posterRelative, ifMissing: true };
  fields['豆瓣链接'] = first.detailUrl;
  let az: ApizeroInfo | null = null;
  if (deps.apizeroKey) {
    az = await fetchApizeroInfo(sid, deps.apizeroKey, deps.httpGet);
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
  }
  const needCelebrities = !az || !az.director || !az.actor;
  if (needCelebrities) {
    const cel = await fetchCelebrities(sid, deps.httpGet, deps.doubanCookie);
    if (cel) {
      if (!fields['导演'] && cel.directors) fields['导演'] = { value: cel.directors, ifMissing: true };
      if (cel.writers) fields['编剧'] = { value: cel.writers, ifMissing: true };
      if (!fields['主演'] && cel.casts) fields['主演'] = { value: cel.casts, ifMissing: true };
    }
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

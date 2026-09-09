/**
 * 术语来源（ADR-0116）：术语录入的可选「来源」——内部笔记（Obsidian 原生双链）或外部链接（URL）。
 * 语义边界：related 是「关联」（卡片↔源文献的双向互链 + Obsidian 原生反向链接），不是出处；
 * 术语文献的出处一律走本模块的 source/sourceTitle 键，不搭 related 便车、不冒充视频文献的 url 键。
 */

/** 单条术语来源（内存态 + 落键值的唯一形态） */
export type TermSource =
  | { kind: 'external'; url: string; title?: string | null }
  | { kind: 'note'; path: string; name?: string };

/** 笔记来源的展示名：显式 name 优先，缺省取去目录去 .md 的文件名 */
export function noteSourceName(path: string, name?: string | null): string {
  const explicit = String(name ?? '').trim();
  if (explicit) return explicit;
  const base = String(path ?? '').replace(/\\/g, '/').split('/').pop() || '';
  return base.replace(/\.md$/i, '') || String(path ?? '');
}

/**
 * 来源文本是否判为「外部链接」（宽松域名字样判定，用户拍板）：
 * 整串无空白 且（http(s):// 前缀 或 形如 域名（≥2 个标签、末标签≥2 字母，含 b23.tv 这类单标签+TLD））。
 * 不校验可达性、不做平台特判（BV 号等纯代码串无域名字样 → 不识别，拍板不带 B 站特判）。
 */
const URL_LIKE_RE = /^(?:[\w-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/;
export function isUrlLikeSourceText(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s || /\s/.test(s)) return false;
  if (/^https?:\/\/\S+$/i.test(s)) return true;
  return URL_LIKE_RE.test(s);
}

/** 外部 URL 落库前净化：剥尾随中文/英文标点（粘贴常带句号/逗号等），协议缺省不补 */
export function cleanUrlText(text: string): string {
  return String(text ?? '').trim().replace(/[，。！？；、,;.!?…'"’”\])}>】」』]+$/, '');
}

/** 通用追踪参数黑名单（B 站 vd_source/seid、分享 share_*、通用 refer/scene 等；utm_-/spm- 前缀另剥） */
const TRACK_KEYS = new Set([
  'vd_source', 'vd_src', 'seid', 'unique_k', 'from', 'share_source', 'share_medium',
  'share_token', 'share_plat', 'share_to', 'share_from', 'share_times', 'gcid', 'refer', 'scene',
]);

/**
 * 外部链接落库前净化（issue 257 补记）：剥尾随标点 + 剥追踪参数，保持简洁可读。
 * - b23.tv 短链：query 全是分享追踪 → 整段剥掉
 * - bilibili 视频页：只留内容性参数 p（分P）/ t（时间点），spm_id_from/vd_source 等全剥
 * - 其余：剥 utm_* / spm_* 前缀与黑名单键；hash 保留（SPA 路由可能有用）
 * 字符串手术不改编码（不用 new URL 重编码中文路径）；非 http(s) 或解析失败原样返回。幂等。
 */
export function normalizeSourceUrl(input: string): string {
  const s = cleanUrlText(input);
  const m = s.match(/^(https?:\/\/)([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i);
  if (!m) return s;
  const [, scheme, host, path, query, hash] = m;
  const bare = host.toLowerCase().replace(/^www\./, '');
  if (bare === 'b23.tv') return scheme + host + path;
  if (bare.endsWith('bilibili.com') && /^\/video\//.test(path)) {
    const keep = (query ?? '').slice(1).split('&').filter((kv) => /^(p|t)=/.test(kv));
    return scheme + host + path + (keep.length ? '?' + keep.join('&') : '');
  }
  if (!query) return s;
  const kept = query.slice(1).split('&').filter(Boolean).filter((kv) => {
    const k = kv.split('=')[0].toLowerCase();
    return !k.startsWith('utm_') && !k.startsWith('spm_') && !TRACK_KEYS.has(k);
  });
  return scheme + host + path + (kept.length ? '?' + kept.join('&') : '') + (hash ?? '');
}

/** 实体最小解码（fetchPageTitle 取的是原始 <title> 文本） */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

/**
 * 来源标题净化（issue 257 补记）：实体解码 + 空白折叠 + 剥站点尾巴，保持简洁——
 * b 站 `标题 _哔哩哔哩_bilibili`、`标题-bilibili`；知乎系 `标题 - 知乎/知乎专栏/知乎日报`。
 */
export function cleanSourceTitle(raw: string): string {
  let t = decodeHtmlEntities(String(raw ?? '')).replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*[_\-–—|｜]\s*哔哩哔哩(?:_bilibili)?\s*$/i, '');
  t = t.replace(/\s*[_\-–—|｜]\s*bilibili\s*$/i, '');
  t = t.replace(/\s*[-–—|｜]\s*知乎(?:日报|专栏)?\s*$/, '');
  return t.trim();
}

/** 序列化为 frontmatter 键值（数据层唯一入口）；无来源 → null */
export function serializeTermSource(src: TermSource | null | undefined): { source: string; sourceTitle?: string } | null {
  if (!src) return null;
  if (src.kind === 'external') {
    const url = normalizeSourceUrl(src.url);
    if (!url) return null;
    const out: { source: string; sourceTitle?: string } = { source: url };
    const title = src.title ? cleanSourceTitle(src.title) : '';
    if (title) out.sourceTitle = title;
    return out;
  }
  const path = String(src.path ?? '').trim();
  if (!path) return null;
  const name = noteSourceName(path, src.name);
  return { source: `[[${path}|${name}]]` };
}

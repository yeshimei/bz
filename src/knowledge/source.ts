import { stripMdExt } from '../core/utils';
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
  return stripMdExt(base) || String(path ?? '');
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

/**
 * 规范视频链接（ADR-0134）：短链（b23.tv）解析出 bvid 后，弹窗写回与落库都用它——
 * 下载器只认链接里的 BV 号（tools/bili-downloader extractBv），短链进队列会在下载阶段报「无法识别 BV 号」。
 * 幂等：喂回来的规范链接与 normalizeSourceUrl 的输出同形。
 */
export function canonicalVideoUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${String(bvid ?? '').trim()}/`;
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

/** frontmatter 引号包裹（对齐 auto-summary YAML 风格，防冒号/引号破坏结构；note-gen 落盘与 source 升级共用同一范式） */
export function quoteYaml(s: unknown): string {
  return '"' + String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** source 键值是否已是内部双链形态（`[[路径|名]]`；与 openPreview 的 `!startsWith('[[')` 判据同源） */
export function isInternalSourceValue(v: string): boolean {
  return /^\[\[/.test(String(v ?? '').trim());
}

/** 内部双链值 → 目标路径半边（`[[路径|名]]` 取路径；非闭合内链形态返回 null） */
function internalLinkPathOf(value: string): string | null {
  const m = /^\[\[([^\]]+?)\]\]$/.exec(String(value ?? '').trim());
  if (!m) return null;
  return m[1].split('|')[0].trim() || null;
}

/** 链接路径归一（命中判据共用）：反斜杠转正斜杠 + 剥 .md 后缀，与落库形态解耦 */
function normalizeLinkPath(p: string): string {
  const s = String(p ?? '').trim().replace(/\\/g, '/');
  return s ? stripMdExt(s) : '';
}

/**
 * source 值是否为内部双链且指向 retiredPath（issue 336 / ADR-0149 退役命中判据）：
 * 摘除/降级编排的 metadataCache 预筛与 retireSourceLine 的内容级复核共用同一口径。
 * 两侧路径都归一（反斜杠转正斜杠、剥 .md 后缀）后比对。
 */
export function sourcePointsAt(value: unknown, retiredPath: string): boolean {
  const linkPath = normalizeLinkPath(internalLinkPathOf(String(value ?? '')) ?? '');
  if (!linkPath) return false;
  const target = normalizeLinkPath(retiredPath);
  return !!target && linkPath === target;
}

/**
 * source 退役（issue 336 / ADR-0149「删除/改名时的回退与摘除」）：frontmatter source 为
 * 内部双链且指向 retiredPath 时行级退役——fallbackUrl 非空 → 改写回外链形态
 * `quoteYaml(fallbackUrl)`（降级，出处零丢失，ADR-0144 的逆向）；fallbackUrl 空 →
 * 整行摘除（sourceTitle 保留，卡片回到「无来源」合法初始态而非悬挂）。
 * 手术边界同 upgradeSourceLine：只动 source 一行、换行符保真、不整体重序列化；
 * source 非内部 / 不指向 retiredPath / 已是目标形态 → 原样返回（幂等，ADR-0144 降级后
 * md-deleted 消费者天然跳过）；无 frontmatter / 无 source 行 → null（调用方不得写盘）。
 */
export function retireSourceLine(content: string, retiredPath: string, fallbackUrl?: string | null): string | null {
  const target = normalizeLinkPath(retiredPath);
  if (!target) return null;
  const lines = String(content ?? '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  let close = -1;
  let srcAt = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break; }
    if (/^source:/.test(lines[i])) srcAt = i; // 只认 frontmatter 内的顶层 source 行（正文不扫）
  }
  if (close === -1 || srcAt === -1) return null;
  const raw = lines[srcAt].slice('source:'.length).trim();
  const quoted = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));
  // 剥一层引号后还原 quoteYaml 的转义（\" → "、\\ → \），路径比对才不会因转义错位
  const value = (quoted ? raw.slice(1, -1) : raw).replace(/\\(["\\])/g, '$1');
  if (!sourcePointsAt(value, retiredPath)) return content; // 非内部 / 不指向 → 无可退役，零扰动
  if (fallbackUrl && String(fallbackUrl).trim()) {
    lines[srcAt] = `source: ${quoteYaml(String(fallbackUrl).trim())}`;
  } else {
    lines.splice(srcAt, 1); // 摘除：sourceTitle 与其余行零扰动
  }
  // 换行符保真：CRLF 文件整体回写时不悄悄改行尾（其余行原样回填）
  return lines.join(content.includes('\r\n') ? '\r\n' : '\n');
}

/**
 * source 升级（issue 329 / ADR-0144 §5「保存物化回写」的纯文本半边）：把 frontmatter 里的
 * 外链 URL 形态 source 改写为内部双链 `[[剪藏路径|标题]]`。未保存剪藏发起录入时 source 落的
 * 就是外链 URL（即 pendingSource 场景），物化时命中同一分支。
 * 手术边界：**只动 source 一行**——sourceTitle 与其余键、正文零扰动（行级替换，不做整体重序列化）；
 * 已是内部形态 → 幂等原样返回；无 frontmatter / 无 source 行 / source 既非外链也非内部 →
 * 返回 null（无可升级，调用方不得写盘）。写值走 quoteYaml 引号包裹，与 generate* 落盘同范式。
 */
export function upgradeSourceLine(content: string, internalLink: string): string | null {
  const link = String(internalLink ?? '').trim();
  if (!link) return null;
  const lines = String(content ?? '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  let close = -1;
  let srcAt = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break; }
    if (/^source:/.test(lines[i])) srcAt = i; // 只认 frontmatter 内的顶层 source 行（遇 --- 即止，正文不扫）
  }
  if (close === -1 || srcAt === -1) return null;
  const raw = lines[srcAt].slice('source:'.length).trim();
  const quoted = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));
  const value = quoted ? raw.slice(1, -1) : raw;
  if (isInternalSourceValue(value)) return content; // 幂等：已是内部双链，一个字节都不动
  if (!isUrlLikeSourceText(value)) return null; // 既非内部也非外链 URL（手写文字等）→ 不动
  lines[srcAt] = `source: ${quoteYaml(link)}`;
  // 换行符保真：CRLF 文件整体回写时不悄悄改行尾（其余行原样回填）
  return lines.join(content.includes('\r\n') ? '\r\n' : '\n');
}

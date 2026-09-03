/**
 * 附件搬移域——纯逻辑层（无 DOM / 无 App 依赖，全部可单测）。
 *
 * 核心语义（ticket 65，术语见 CONTEXT.md「附件/附件搬移」）：
 * - 附件 = 当前笔记引用的 vault 内非 .md 文件（wikilink 嵌入 + Markdown 链接）。
 * - 同名冲突：仅当目标文件夹已存在同名文件时才改名（`原名 (N).ext`）。
 * - 链接更新：移动与全库链接更新由 Obsidian 内建 `app.fileManager.renameFile`
 *   自动完成（ADR-0014，推翻 v1 自研全库改写——大库全量扫描 + 逐个 modify 会卡顿）。
 *   本层只负责「收集当前笔记的资源」与「算出去重后的目标路径」，不改写文档内容。
 */
export interface LinkRef {
  /** 引用形态：wiki（`[[]]`）/ md（`[]()`） */
  kind: 'wiki' | 'md';
  /** 是否嵌入（`!` 前缀） */
  embeds: boolean;
  /** wiki: 目标 linktext（可含路径/扩展名）；md: url 部分 */
  target: string;
  /** wiki: 后缀（`|别名` / `#标题` / `^锚点`，含前导符）；md: 显示文字（alt/text） */
  extra: string;
  /** 原文整段（收集用，仅用于定位与去重） */
  raw: string;
}

const WIKI_RE = /(!?)\[\[([^\[\]]+)\]\]/g;
const MD_RE = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
const EXT_RE = /\.[^./]+$/;
const OUTER_RE = /^(https?:|data:|file:)/i;

const stripExt = (p: string) => p.replace(EXT_RE, '');
const lastSeg = (p: string) => (p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p);
/** 父目录（根返回 ''） */
const parentDir = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
/** 归一化拼接（处理 . / ..） */
function normalizeJoin(dir: string, rel: string): string {
  const segs = (dir ? dir.split('/') : []).concat(rel.split('/'));
  const out: string[] = [];
  for (const s of segs) {
    if (!s || s === '.') continue;
    if (s === '..') {
      out.pop();
      continue;
    }
    out.push(s);
  }
  return out.join('/');
}

/** 解析笔记内容的全部链接引用（wikilink + Markdown 链接，含嵌入） */
export function parseLinkRefs(content: string): LinkRef[] {
  const out: LinkRef[] = [];
  let m: RegExpExecArray | null;
  WIKI_RE.lastIndex = 0;
  while ((m = WIKI_RE.exec(content)) !== null) {
    const inner = m[2];
    const embeds = m[1] === '!';
    const sep = inner.search(/[|#^]/);
    const target = (sep === -1 ? inner : inner.slice(0, sep)).trim();
    const extra = sep === -1 ? '' : inner.slice(sep);
    if (!target) continue;
    out.push({ kind: 'wiki', embeds, target, extra, raw: m[0] });
  }
  MD_RE.lastIndex = 0;
  while ((m = MD_RE.exec(content)) !== null) {
    const embeds = m[1] === '!';
    const text = m[2];
    const url = m[3].trim();
    if (!url) continue;
    out.push({ kind: 'md', embeds, target: url, extra: text, raw: m[0] });
  }
  return out;
}

/** 精确 / 扩展名推断匹配一个候选路径 */
function matchPath(allFiles: string[], p: string): string | null {
  if (allFiles.includes(p)) return p;
  const inferred = allFiles.filter((f) => f.startsWith(p + '.') && !f.slice(p.length + 1).includes('/'));
  return inferred.length === 1 ? inferred[0] : null;
}

/**
 * 链接目标解析（收集阶段用）：linktext/路径 → vault 文件路径（解析失败/含糊返回 null）。
 * 顺序：库根绝对 → 相对源笔记目录（md 链接语义）→ 库内唯一 basename；多同名时优先当前笔记同目录。
 * P2 审查修复：md 链接目标可能被百分号编码（Obsidian 对含空格文件名生成 `My%20Image.png`），
 * 先解码再解析；解码失败（含裸 % 的非编码串）或解码后无命中时回退原串。
 */
export function resolveTarget(allFiles: string[], target: string, sourcePath: string, kind: 'wiki' | 'md'): string | null {
  const t = target.trim();
  if (!t) return null;
  if (OUTER_RE.test(t)) return null; // 外链 / 编码数据不处理

  if (kind === 'md' && t.includes('%')) {
    let decoded = t;
    try {
      decoded = decodeURIComponent(t);
    } catch (e) {
      decoded = t; // 非法编码序列（如 `100%.png`）：保留原串
    }
    if (decoded !== t) {
      const hit = resolveEncodedTarget(allFiles, decoded, sourcePath, kind);
      if (hit) return hit;
    }
  }
  return resolveEncodedTarget(allFiles, t, sourcePath, kind);
}

/** resolveTarget 的解码后主体（不含百分号解码逻辑，wiki/md 同一套路径解析） */
function resolveEncodedTarget(allFiles: string[], t: string, sourcePath: string, kind: 'wiki' | 'md'): string | null {
  const abs = matchPath(allFiles, t);
  if (abs) return abs;

  // 相对路径解析
  const tries: string[] = [];
  if (t.startsWith('/')) tries.push(normalizeJoin('', t.slice(1)));
  if (t.startsWith('./') || t.startsWith('../')) {
    tries.push(normalizeJoin(parentDir(sourcePath), t));
  } else if (kind === 'md') {
    // md 链接常见无前缀相对形式（相对源笔记目录）
    tries.push(normalizeJoin(parentDir(sourcePath), t));
  }
  for (const cand of tries) {
    const hit = matchPath(allFiles, cand);
    if (hit) return hit;
  }

  // basename 兜底：库内唯一；若多处则优先“当前笔记同目录”（笔记旁资源最常见，就近原则）
  const base = t.includes('/') ? lastSeg(t) : t;
  const noExtBase = stripExt(base);
  const matches = allFiles.filter((f) => stripExt(lastSeg(f)) === noExtBase);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const sameDir = matches.filter((f) => parentDir(f) === parentDir(sourcePath));
    if (sameDir.length === 1) return sameDir[0];
  }
  return null;
}

/** 收集当前笔记引用的附件路径（vault 内非 .md 文件，去重） */
export function collectResources(content: string, allFiles: string[], sourcePath: string): string[] {
  const paths = new Set<string>();
  for (const ref of parseLinkRefs(content)) {
    const resolved = resolveTarget(allFiles, ref.target, sourcePath, ref.kind);
    if (!resolved) continue;
    const lastDot = resolved.lastIndexOf('.');
    const ext = lastDot === -1 ? '' : resolved.slice(lastDot + 1);
    if (ext && ext.toLowerCase() !== 'md') paths.add(resolved);
  }
  return [...paths];
}

export interface MoveOp {
  fromPath: string;
  toPath: string;
  toName: string;
  renamed: boolean;
}

/** 附件移动规划：同名冲突才改名（`原名 (N).ext`）；已在目标文件夹的跳过 */
export function planMoves(resources: string[], destFolder: string, allPaths: string[]): MoveOp[] {
  const out: MoveOp[] = [];
  const folder = destFolder.replace(/\/+$/, '') || '';
  const occupied = new Set(allPaths);
  for (const from of resources) {
    const name = lastSeg(from);
    if (parentDir(from) === folder) continue; // 已在目标文件夹
    let toName = name;
    let n = 1;
    while (occupied.has(folder ? folder + '/' + toName : toName)) {
      const base = stripExt(name);
      toName = `${base} (${n++})${name.slice(base.length)}`;
    }
    const toPath = folder ? folder + '/' + toName : toName;
    occupied.delete(from);
    occupied.add(toPath);
    out.push({ fromPath: from, toPath, toName, renamed: toName !== name });
  }
  return out;
}
/**
 * 附件搬移域——纯逻辑层（无 DOM / 无 App 依赖，全部可单测）。
 *
 * 核心语义（ticket 65，术语见 CONTEXT.md「附件/链接改写」）：
 * - 附件 = 当前笔记引用的 vault 内非 .md 文件（wikilink 嵌入 + Markdown 链接）。
 * - 同名冲突：仅当目标文件夹已存在同名文件时，被移动附件才改名（`原名 (N).ext`）。
 * - 链接改写：全库所有引用被移动附件的笔记同步改写，保留嵌入标记/别名/标题/锚点后缀。
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
  /** 原文整段（定位 + 全局替换用） */
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

/** 由 LinkRef + 新目标重建成完整引用串（保留嵌入标记/别名/标题前缀） */
export function buildLinkFromRef(ref: LinkRef, newTarget: string): string {
  if (ref.kind === 'wiki') return (ref.embeds ? '!' : '') + '[[' + newTarget + ref.extra + ']]';
  return (ref.embeds ? '!' : '') + '[' + ref.extra + '](' + newTarget + ')';
}

/** 精确 / 扩展名推断匹配一个候选路径 */
function matchPath(allFiles: string[], p: string): string | null {
  if (allFiles.includes(p)) return p;
  const inferred = allFiles.filter((f) => f.startsWith(p + '.') && !f.slice(p.length + 1).includes('/'));
  return inferred.length === 1 ? inferred[0] : null;
}

/**
 * 链接目标解析：linktext/路径 → vault 文件路径（解析失败/含糊返回 null）。
 * 顺序：库根绝对 → 相对源笔记目录（md 链接语义）→ 库内唯一 basename（wikilink 最短路径语义）。
 */
export function resolveTarget(allFiles: string[], target: string, sourcePath: string, kind: 'wiki' | 'md'): string | null {
  const t = target.trim();
  if (!t) return null;
  if (OUTER_RE.test(t)) return null; // 外链 / 编码数据不处理

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

export interface ReplacePair {
  filePath: string;
  raw: string;
  newRaw: string;
}

export interface RewritePlan {
  pairs: ReplacePair[];
  /** 被改写的笔记路径（去重） */
  touchedFiles: string[];
  /** 改写处总数（含同一文件内重复引用） */
  linkCount: number;
}

/** 全库改写规划：所有 md 笔记内引用被移动附件的地方 → 新目标 */
export function planRewritePairs(markdownMap: Record<string, string>, allFiles: string[], moves: MoveOp[]): RewritePlan {
  const moved = new Map<string, MoveOp>();
  for (const m of moves) moved.set(m.fromPath, m);
  const pairs: ReplacePair[] = [];
  const touched = new Set<string>();
  let linkCount = 0;
  for (const filePath of Object.keys(markdownMap)) {
    const content = markdownMap[filePath];
    const seen = new Set<string>();
    for (const ref of parseLinkRefs(content)) {
      const resolved = resolveTarget(allFiles, ref.target, filePath, ref.kind);
      const op = resolved ? moved.get(resolved) : undefined;
      if (!op) continue;
      // 新目标：md 链接用带扩展名完整路径（原样，Obsidian 可解析中文/空格）；wikilink 保留原扩展名形式，否则去扩展名
      let newTarget: string;
      if (ref.kind === 'md') {
        newTarget = op.toPath;
      } else {
        newTarget = lastSeg(ref.target).includes('.') ? op.toPath : op.toPath.replace(EXT_RE, '');
      }
      const newRaw = buildLinkFromRef(ref, newTarget);
      if (seen.has(ref.raw)) continue;
      seen.add(ref.raw);
      let idx = 0;
      let count = 0;
      while ((idx = content.indexOf(ref.raw, idx)) !== -1) {
        count++;
        idx += ref.raw.length;
      }
      linkCount += count;
      pairs.push({ filePath, raw: ref.raw, newRaw });
      touched.add(filePath);
    }
  }
  return { pairs, touchedFiles: [...touched], linkCount };
}

/** 把一批替换对应用到内容（全局替换，重复 raw 一并处理） */
export function applyReplacements(content: string, pairs: Array<{ raw: string; newRaw: string }>): string {
  let c = content;
  const done = new Set<string>();
  for (const p of pairs) {
    if (done.has(p.raw)) continue;
    done.add(p.raw);
    c = c.split(p.raw).join(p.newRaw);
  }
  return c;
}
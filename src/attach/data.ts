/**
 * 附件搬移域——纯逻辑层（无 DOM / 无 App 依赖，全部可单测）。
 *
 * 核心语义（ticket 65，术语见 CONTEXT.md「附件/附件搬移」）：
 * - 附件 = 当前笔记引用的 vault 内非 .md 文件（wikilink 嵌入 + Markdown 链接）。
 * - 同名冲突：仅当目标文件夹已存在同名文件时才改名（`原名 (N).ext`）。
 * - 链接更新：移动与全库链接更新由 Obsidian 内建 `app.fileManager.renameFile`
 *   自动完成（ADR-0014，推翻 v1 自研全库改写——大库全量扫描 + 逐个 modify 会卡顿）。
 *   本层只负责「收集当前笔记引用的附件」与「算出去重后的目标路径」，不改写文档内容。
 * 深审修复批（2026-09，bz-fix-at-core）：
 * - 收集语义对齐 encrypt「cache 为主 + 正则兜底」范式（ARCH-1）：cache 主路径见
 *   collectResourcesCached（真机 metadataCache 天然不含代码块内引用，AF-1 随语义源
 *   切换根治）；正则兜底先 stripNonLinkSegments 剥离同口径段落（AF-1），解析补
 *   大小写不敏感档（AF-2，对齐 Obsidian 链接解析语义）。strip 单源同时供测试假层
 *   mock-vault 消费（ARCH-T1：假层与实现侧围栏口径对齐，防盲区对盲区假绿）。
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

/**
 * 剥离真机 metadataCache 不承认为链接的段落（AF-1 / ARCH-T1 单源）：
 * fenced code（``` / ~~~ 围栏段）、inline code（成对反引号段）、HTML 注释（<!-- -->）。
 * frontmatter 段不剥——frontmatter 内 wiki 链接是真机 cache 承认的真引用
 * （frontmatterLinks），renameFile 会更新，收集应继续覆盖。
 * 消费方：collectResources 正则兜底（AF-1 兜底口径）+ 测试假层 mock-vault getFileCache
 * （与实现侧同源，防「盲区对盲区」假绿）。
 */
export function stripNonLinkSegments(content: string): string {
  // 1) fenced code：``` / ~~~ 开围栏行到同字符闭合围栏行，整段丢弃
  const kept: string[] = [];
  let fence: '`' | '~' | null = null;
  for (const line of content.split(/\r?\n/)) {
    if (fence) {
      const closeRe = fence === '`' ? /^\s*`{3,}\s*$/ : /^\s*~{3,}\s*$/;
      if (closeRe.test(line)) fence = null;
      continue;
    }
    const open = line.match(/^\s*(`{3,}|~{3,})/);
    if (open) {
      fence = open[1][0] as '`' | '~';
      kept.push('');
      continue;
    }
    kept.push(line);
  }
  let text = kept.join('\n');
  // 2) HTML 注释整段丢弃（注释内任何引用真机均不解析）
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // 3) inline code：成对反引号段以等长空白替换（保留行结构；未配对的孤立反引号保留）
  text = text.replace(/(`+)[\s\S]*?\1/g, (seg) => seg.replace(/[^\n]/g, ' '));
  return text;
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
    // F10：md 链接两种形态剥壳——尖括号包路径（`<my image.png>`，含空格）与尾标题
    // （`path "标题"`）；原样进 resolveTarget 永远匹配不上，清单偏小漏搬附件
    let url = m[3].trim();
    const angled = url.match(/^<([\s\S]+)>$/);
    if (angled) url = angled[1].trim();
    url = url.replace(/\s+(["'])(?:(?!\1).)*\1\s*$/, '').trim();
    if (!url) continue;
    out.push({ kind: 'md', embeds, target: url, extra: text, raw: m[0] });
  }
  return out;
}

/**
 * 精确 / 扩展名推断匹配一个候选路径。
 * AF-2：精确与扩展名推断之后补大小写不敏感兜底档（Obsidian 链接解析大小写不敏感，
 * Windows/macOS 大小写不敏感文件系统真实可达）；唯一命中才采用，多命中维持 null 消歧口径。
 */
function matchPath(allFiles: string[], p: string): string | null {
  if (allFiles.includes(p)) return p;
  const inferred = allFiles.filter((f) => f.startsWith(p + '.') && !f.slice(p.length + 1).includes('/'));
  if (inferred.length === 1) return inferred[0];
  const lp = p.toLowerCase();
  if (!lp) return null;
  const ciExact = allFiles.filter((f) => f.toLowerCase() === lp);
  if (ciExact.length === 1) return ciExact[0];
  const ciInferred = allFiles.filter((f) => {
    const lf = f.toLowerCase();
    return lf.startsWith(lp + '.') && !lf.slice(lp.length + 1).includes('/');
  });
  return ciInferred.length === 1 ? ciInferred[0] : null;
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

  // basename 兜底：库内唯一；若多处则优先“当前笔记同目录”（笔记旁附件最常见，就近原则）。
  // AF-2：精确比较未命中时补大小写不敏感档（精确优先原则不变）
  const base = t.includes('/') ? lastSeg(t) : t;
  const noExtBase = stripExt(base);
  let matches = allFiles.filter((f) => stripExt(lastSeg(f)) === noExtBase);
  if (matches.length === 0) {
    const lb = noExtBase.toLowerCase();
    matches = allFiles.filter((f) => stripExt(lastSeg(f)).toLowerCase() === lb);
  }
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const sameDir = matches.filter((f) => parentDir(f) === parentDir(sourcePath));
    if (sameDir.length === 1) return sameDir[0];
  }
  return null;
}

/** 附件判定与收集共用出口：解析命中且扩展名非 .md 才收入集合 */
function addIfAttachment(paths: Set<string>, resolved: string | null): void {
  if (!resolved) return;
  const lastDot = resolved.lastIndexOf('.');
  const ext = lastDot === -1 ? '' : resolved.slice(lastDot + 1);
  if (ext && ext.toLowerCase() !== 'md') paths.add(resolved);
}

/** 收集当前笔记引用的附件路径（正则兜底口径，vault 内非 .md 文件，去重）。
 *  AF-1：先剥离真机 cache 不承认为链接的段落（代码块/inline code/HTML 注释）再正则解析；
 *  cache 可用时调用方应走 collectResourcesCached 主路径（ARCH-1）。 */
export function collectResources(content: string, allFiles: string[], sourcePath: string): string[] {
  const paths = new Set<string>();
  for (const ref of parseLinkRefs(stripNonLinkSegments(content))) {
    addIfAttachment(paths, resolveTarget(allFiles, ref.target, sourcePath, ref.kind));
  }
  return [...paths];
}

/**
 * cache 主路径收集（ARCH-1 对齐 encrypt「cache 为主 + 正则兜底」范式）：
 * links = metadataCache 的 embeds/links/frontmatterLinks 原始 linktext——真机 cache
 * 天然不含代码块内引用（AF-1 随语义源切换根治）。每条先剥 wiki 式后缀（|别名 / #标题 /
 * ^块锚；md url 的 # 锚一并剥，替代原 EXT_RE 的意外剥锚），再按 wiki 语义解析、未命中
 * 退化 md 语义（相对源目录/百分号解码档）双档尝试；断链与 .md 目标不收。
 * cache 缺失（未索引/读取失败）的调用方应退化 collectResources 正则兜底。
 */
export function collectResourcesCached(links: readonly string[], allFiles: string[], sourcePath: string): string[] {
  const paths = new Set<string>();
  for (const raw of links) {
    const t = String(raw ?? '').trim();
    if (!t) continue;
    const sep = t.search(/[|#^]/);
    const clean = (sep === -1 ? t : t.slice(0, sep)).trim();
    if (!clean) continue;
    addIfAttachment(
      paths,
      resolveTarget(allFiles, clean, sourcePath, 'wiki') || resolveTarget(allFiles, clean, sourcePath, 'md'),
    );
  }
  return [...paths];
}

export interface MoveOp {
  fromPath: string;
  toPath: string;
  toName: string;
  renamed: boolean;
}

/**
 * 附件移动规划：同名冲突才改名（`原名 (N).ext`）；已在目标文件夹的跳过。
 * allPaths = 目标占用集（AT1 常态口径：含文件与文件夹路径——目标下同名子文件夹同样
 * 会让 renameFile 抛错，规划期即提前避让改名；调用方 listAllFilePaths 负责混入文件夹）。
 */
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
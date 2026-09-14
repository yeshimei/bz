/**
 * 挂载树数据层（issues 314 / 315；ADR-0137 §1–§4、ADR-0138 后果节、ADR-0139）
 *
 * 三源汇总（ADR-0137 §2）：固定（本卡 + 同名文献，实时对齐）／自动（正文 `[[…]]` + frontmatter related）／
 * 手动（frontmatter `mounted`，**全插件唯一落盘项**）。本模块只出数据：不碰 DOM、不写文件——
 * `writeMount` / `removeMount` 是**纯字符串**函数，落盘由调用方（渲染层动作）走 vault.process。
 *
 * 依赖方向（ADR-0002）：core ← knowledge。只 import 共享契约 `mount-types` 与 core 服务；
 * 不 import `ui.ts`（避免 ui ↔ data 反向依赖）、不 import 同包其它 mount-* 模块（渲染层负责接线）。
 *
 * 口径补充（契约未写、本模块自定，渲染层按此接线）：
 * 1. `missing` = **解析不到文件**（`getFirstLinkpathDest` 返回 null 且全库同名兜底也找不到）。文件存在但在
 *    卡片盒/文献盒之外 → **正常节点**（kind 按语法判 note/head/para/image/video）——ADR-0137 §2 明言双链
 *    「指向任何笔记」，盒外来源标注是后续项（ADR-0138 §5），不是断链。
 * 2. 自链（目标 = 承载它的卡自身，含 `[[本卡#标题]]`）在**树构建**阶段剪掉（不产节点、不产边）；
 *    解析层（`parseMountLinks` / `resolveMountLinks`）照常产出（测试即断言这一点）。
 * 3. 边恒为「深度递增」：`depth(to) > depth(from)`（契约不变式）。下游 from = 挂载方、to = 被挂目标；
 *    上游（看谁挂了我）同一条关系记成 from = 被挂方、to = 挂载方。于是**`anchor` 恒指「承载该挂载项的
 *    那篇笔记」正文里的位置**：下游在 `from` 节点正文里，上游在 `to` 节点正文里（渲染层按 direction 取）。
 * 4. 同名文献（source `sameName`）恒为 `attached`、不产边、**两个方向都吸附**（固定挂载「恒列第一位」）；
 *    先到先得：同一文件若既被同名对齐又被双链指到，取先入树者。
 * 5. 只有**卡片**节点继续展开（卡片 = 卡片盒目录内的 .md）；`missing` 节点不展开、`body` 为 null。
 * 6. 顺序稳定：nodes 按 (depth, 首次出现序)，edges 按 (from 出现序, to 出现序)——同输入必得同输出。
 */
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import type {
  AnchorRef,
  MountDirection,
  MountEdge,
  MountKind,
  MountLink,
  MountNode,
  MountSource,
  MountTree,
} from './mount-types';

/** 卡片盒目录缺省（设置键 knowledgeCardboxDirectory） */
const DEFAULT_CARDBOX = '卡片盒';
/** 文献盒目录缺省（设置键 knowledgeDirectory） */
const DEFAULT_LIT = '文献盒';
/** 图片扩展名（ADR-0137 §3 六类之 image） */
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);
/** 视频扩展名（六类之 video） */
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi']);

/** 挂载树数据层运行上下文（app + 两个目录；目录已归一：反斜杠转正斜杠、去首尾斜杠） */
export interface MountCtx {
  app: any;
  cardboxDir: string;
  litDir: string;
}

/* ------------------------------------------------------------------ *
 * 小工具（路径/文本）
 * ------------------------------------------------------------------ */

function normSlashes(s: unknown): string {
  return String(s ?? '').replace(/\\/g, '/');
}
/** 目录归一：反斜杠转正、去首尾斜杠；空值回退 fallback（fallback 为空串时返回空串） */
function normDir(raw: unknown, fallback: string): string {
  const s = normSlashes(raw).trim();
  if (!s) return fallback;
  return s.replace(/^\/+|\/+$/g, '');
}
function baseName(path: string): string {
  const p = normSlashes(path);
  return p.split('/').pop() || '';
}
/** 去 .md 的名字（大小写不敏感） */
function stripMd(name: string): string {
  return String(name ?? '').replace(/\.md$/i, '');
}
/** 文件名（去目录去 .md）——卡片名 / 文献名 */
function stemOf(path: string): string {
  const b = baseName(path);
  return stripMd(b) || b;
}
/** 扩展名（小写，无点；无扩展名返回空串） */
function extOf(name: string): string {
  const b = baseName(name).toLowerCase();
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1) : '';
}
/** 路径比较键：统一斜杠、去 .md、小写（Obsidian 路径大小写不敏感口径） */
function pathKey(path: string): string {
  return stripMd(normSlashes(path)).toLowerCase();
}
/** path 是否在 dir 目录内（含子目录；dir 为空 = 全库） */
function inDir(path: string, dir: string): boolean {
  const d = normDir(dir, '');
  const p = normSlashes(path);
  if (!d) return true;
  return p === d || p.startsWith(d + '/');
}
function samePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b);
}
/** 决定性排序：目录浅者优先，再按路径字典序 */
function byDepthThenPath(a: string, b: string): number {
  const da = normSlashes(a).split('/').length;
  const db = normSlashes(b).split('/').length;
  return da - db || a.localeCompare(b);
}
/** 去 frontmatter（返回正文；无 frontmatter 原样返回并去掉开头空行） */
function stripFrontmatter(text: string): string {
  const src = String(text ?? '');
  const m = src.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return (m ? src.slice(m[0].length) : src).replace(/^\r?\n+/, '');
}
/** 双链内芯拆分：`目标#子路径|别名` → { target, alias, subpath }（子路径不含 `#`） */
function splitLinkText(inner: string): { target: string; alias: string | null; subpath: string | null } {
  const raw = String(inner ?? '').trim();
  const bar = raw.indexOf('|');
  const left = bar >= 0 ? raw.slice(0, bar) : raw;
  const aliasRaw = bar >= 0 ? raw.slice(bar + 1).trim() : '';
  const hash = left.indexOf('#');
  return {
    target: (hash >= 0 ? left.slice(0, hash) : left).trim(),
    alias: aliasRaw || null,
    subpath: hash >= 0 ? left.slice(hash + 1).trim() || null : null,
  };
}
/** 语法层去重键：目标 + 子路径，大小写不敏感 */
function linkKey(target: string, subpath: string | null): string {
  return `${target.trim().toLowerCase()}#${(subpath ?? '').trim().toLowerCase()}`;
}
function safeApp(): any {
  try {
    return getApp();
  } catch {
    return null; // 未注入（测试/早期调用）——上层按空上下文降级
  }
}
function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/* ------------------------------------------------------------------ *
 * 上下文
 * ------------------------------------------------------------------ */

/** 从设置构造上下文（卡片盒键 `knowledgeCardboxDirectory` 缺省「卡片盒」；文献盒键 `knowledgeDirectory` 缺省「文献盒」） */
export function mountCtx(app?: any): MountCtx {
  const s = (tryGetSettings() ?? {}) as any;
  return {
    app: app ?? safeApp(),
    cardboxDir: normDir(s?.knowledgeCardboxDirectory, DEFAULT_CARDBOX) || DEFAULT_CARDBOX,
    litDir: normDir(s?.knowledgeDirectory, DEFAULT_LIT) || DEFAULT_LIT,
  };
}

/** 全库文件（含附件；mock/真实 vault 都实现 getFiles） */
function allFiles(ctx: MountCtx): any[] {
  const v = ctx?.app?.vault;
  const files = typeof v?.getFiles === 'function' ? v.getFiles() : null;
  return Array.isArray(files) ? files.filter((f: any) => f && f.path) : [];
}
/** 全库 md（按路径排序，保证遍历顺序稳定） */
function mdFiles(ctx: MountCtx): any[] {
  const v = ctx?.app?.vault;
  const files = typeof v?.getMarkdownFiles === 'function' ? v.getMarkdownFiles() : allFiles(ctx).filter((f: any) => f.extension === 'md');
  return (Array.isArray(files) ? files.filter((f: any) => f && f.path) : []).slice().sort((a: any, b: any) => String(a.path).localeCompare(String(b.path)));
}
/** 卡片盒里的卡片文件（按路径排序） */
function cardFiles(ctx: MountCtx): any[] {
  const dir = normDir(ctx?.cardboxDir, '');
  return mdFiles(ctx).filter((f: any) => inDir(f.path, dir));
}
/** 读文件文本（file 可为 TFile 或路径）；失败返回空串 */
async function readText(file: any, ctx: MountCtx): Promise<string> {
  const v = ctx?.app?.vault;
  if (!v || file === null || file === undefined) return '';
  let target = file;
  if (typeof file === 'string') {
    const p = normSlashes(file);
    if (!p) return '';
    target = v.getAbstractFileByPath?.(p) ?? v.getFileByPath?.(p) ?? p;
  }
  try {
    if (typeof v.cachedRead === 'function') return String((await v.cachedRead(target)) ?? '');
    if (typeof v.read === 'function') return String((await v.read(target)) ?? '');
  } catch {
    /* 读失败按空正文（节点 body 为 null），不打断整树构建 */
  }
  return '';
}
/** 文件正文（去 frontmatter）；一次构建内按路径缓存（改名跟随 = 每次构建重读，不落快照） */
async function bodyOf(path: string, ctx: MountCtx): Promise<string> {
  return stripFrontmatter(await readText(path, ctx));
}

/* ------------------------------------------------------------------ *
 * 314：正文双链解析
 * ------------------------------------------------------------------ */

/**
 * 正文双链**语法**解析（纯函数，不碰 vault）：`[[笔记]]`／`[[笔记|别名]]`／`[[路径/笔记]]`／
 * `[[笔记#标题]]`／`[[笔记#^块id]]`／`![[图片.png]]`／`![[视频.mp4]]`（含 `!` 嵌入）。
 * 大小写不敏感对齐由 `resolveMountLinks` 负责；同一目标重复出现只产一条（保留首条锚点）。
 * 产出 `path=null、missing=false`，`kind` 先按语法/扩展名粗判（`classifyKind` 的 path=null 分支）。
 * 自链照常产出（剪线由树构建负责）。
 */
export function parseMountLinks(body: string): MountLink[] {
  const src = String(body ?? '');
  const out: MountLink[] = [];
  const seen = new Set<string>();
  const re = /(!?)\[\[([^\[\]]+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const raw = m[0];
    const embed = m[1] === '!';
    const { target, alias, subpath } = splitLinkText(m[2]);
    if (!target) continue; // `[[#标题]]` / `[[#^块id]]` 同文件引用：无目标名可挂（块内跳转不产挂载项）
    const key = linkKey(target, subpath);
    if (seen.has(key)) continue; // 同一目标只产一条（保留首条锚点）
    seen.add(key);
    out.push({
      raw,
      target,
      alias,
      subpath,
      embed,
      kind: classifyKind(target, subpath, embed, null, ''),
      missing: false,
      path: null,
      anchor: { from: m.index, to: m.index + raw.length, text: raw },
    });
  }
  return out;
}

/**
 * 六类归类（ADR-0137 §3）。判定顺序：图片扩展名 → `image`；视频扩展名 → `video`；
 * 解析后路径在 `cardboxDir` 内 → `card`；`subpath` 以 `^` 开头 → `para`；`subpath` 有值 → `head`；否则 `note`。
 * `path` 为 null（语法层/断链）时按语法判；非 `!` 的 `[[x.png]]` 同样按扩展名判（白板按形态画小卡）。
 * 扩展名取「解析后路径」优先、再取目标文本（`[[图]]` 解析到 `附件/图.png` 也归 image）。
 */
export function classifyKind(
  target: string,
  subpath: string | null,
  embed: boolean,
  path: string | null,
  cardboxDir: string,
): MountKind {
  void embed; // `!` 嵌入与普通链接同类（形态由目标决定，不由语法决定）
  const t = String(target ?? '').trim();
  const p = path && String(path).trim() ? normSlashes(String(path)) : null;
  const exts = [p ? extOf(p) : '', extOf(t)].filter(Boolean);
  if (exts.some((e) => IMAGE_EXTS.has(e))) return 'image';
  if (exts.some((e) => VIDEO_EXTS.has(e))) return 'video';
  const dir = normDir(cardboxDir, '');
  if (p && dir && (p === dir || p.startsWith(dir + '/'))) return 'card';
  const sp = String(subpath ?? '').trim().replace(/^#/, '').trim();
  if (sp.startsWith('^')) return 'para';
  if (sp) return 'head';
  return 'note';
}

/** 全库同名兜底：精确全路径优先，其次同名（大小写不敏感、去 .md）；命中多个取目录最浅 + 字典序 */
function findBySameName(target: string, ctx: MountCtx): string | null {
  const t = normSlashes(target).trim();
  if (!t) return null;
  const files = allFiles(ctx);
  const wantFull = pathKey(t);
  const wantBase = stripMd(baseName(t)).toLowerCase();
  const exact = files.filter((f: any) => pathKey(f.path) === wantFull).map((f: any) => normSlashes(f.path));
  const named = files.filter((f: any) => stemOf(f.path).toLowerCase() === wantBase).map((f: any) => normSlashes(f.path));
  const pool = (exact.length ? exact : named).slice().sort(byDepthThenPath);
  return pool[0] ?? null;
}

/** 目标 → 库内路径（getFirstLinkpathDest 优先，全库同名兜底；都找不到 → null） */
function resolveLinkPath(target: string, ctx: MountCtx, sourcePath: string): string | null {
  const t = String(target ?? '').trim();
  if (!t) return null;
  try {
    const dest = ctx?.app?.metadataCache?.getFirstLinkpathDest?.(t, sourcePath) ?? null;
    const p = dest && typeof dest === 'object' ? dest.path : typeof dest === 'string' ? dest : null;
    if (p) return normSlashes(String(p));
  } catch {
    /* 解析异常走同名兜底 */
  }
  return findBySameName(t, ctx);
}

/**
 * 解析路径 + 精化 kind：`metadataCache.getFirstLinkpathDest(target, sourcePath)`；
 * 返回 null 时用「全库同名匹配」兜底（大小写不敏感、去 .md 比较），仍无 → `missing=true, path=null`。
 * 解析后按 `classifyKind` 精化（卡片盒目录内 → `card`）；按解析后路径去重（同一目标只留首条锚点）。
 * `sourcePath` 缺省 ''（调用方一般传承载链接的卡片路径，纯文件名解析更准）。
 */
export async function resolveMountLinks(links: MountLink[], ctx: MountCtx, sourcePath: string = ''): Promise<MountLink[]> {
  const out: MountLink[] = [];
  const seen = new Set<string>();
  const dir = ctx?.cardboxDir ?? '';
  for (const link of links ?? []) {
    if (!link) continue;
    const path = resolveLinkPath(link.target, ctx, sourcePath);
    const kind = classifyKind(link.target, link.subpath, link.embed, path, dir);
    const key = path ? `${pathKey(path)}#${(link.subpath ?? '').toLowerCase()}` : `missing:${linkKey(link.target, link.subpath)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...link, path, missing: !path, kind });
  }
  return out;
}

/**
 * 按 text 重定位锚点（编辑后 from/to 偏移失效；ADR-0138 后果节）：先精确 indexOf，
 * 再退化为去空白匹配（返回映射回原串的起始下标）；找不到返回 null。
 */
export function relocateAnchor(body: string, anchor: AnchorRef): number | null {
  const src = String(body ?? '');
  const text = String(anchor?.text ?? '');
  if (!text) return null;
  const exact = src.indexOf(text);
  if (exact >= 0) return exact;
  const flat = flattenWs(src);
  const needle = flattenWs(text).text;
  if (!needle) return null;
  const at = flat.text.indexOf(needle);
  return at < 0 ? null : flat.map[at];
}

/** 去空白（空格/制表/换行）并保留「去空白后第 i 字 → 原串下标」映射 */
function flattenWs(s: string): { text: string; map: number[] } {
  const map: number[] = [];
  let text = '';
  for (let i = 0; i < s.length; i++) {
    if (/\s/.test(s[i])) continue;
    map.push(i);
    text += s[i];
  }
  return { text, map };
}

/* ------------------------------------------------------------------ *
 * 314：子路径片段（head / para 节点显示用）
 * ------------------------------------------------------------------ */

/** 片段收尾：去掉首尾空行；内容全空返回 null（渲染层只显示标题） */
function joinSnippet(chunk: string[]): string | null {
  const text = chunk.join('\n').replace(/^\s*\n+/, '').replace(/\s+$/, '');
  return text.trim() ? text : null;
}
/** 按空行切块（保留每块的行范围） */
function splitBlocks(lines: string[]): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  let cur: string[] = [];
  let start = 0;
  const flush = (end: number) => {
    if (cur.length) out.push({ start, end, text: cur.join('\n') });
    cur = [];
  };
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      flush(i);
      continue;
    }
    if (!cur.length) start = i;
    cur.push(lines[i]);
  }
  flush(lines.length);
  return out;
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 标题片段：metadataCache headings 的 position 范围优先，行扫描兜底（取下级标题之前的内容，不含标题行） */
function headingSnippet(lines: string[], heading: string, cache: any): string | null {
  const want = heading.trim().toLowerCase();
  const hs = Array.isArray(cache?.headings) ? cache.headings : null;
  if (hs) {
    const idx = hs.findIndex((h: any) => String(h?.heading ?? '').trim().toLowerCase() === want);
    if (idx >= 0) {
      const start = numOr(hs[idx]?.position?.start?.line, -1);
      if (start >= 0) {
        const level = numOr(hs[idx]?.level, 1);
        let end = lines.length;
        for (let j = idx + 1; j < hs.length; j++) {
          if (numOr(hs[j]?.level, 1) <= level) {
            end = numOr(hs[j]?.position?.start?.line, lines.length);
            break;
          }
        }
        return joinSnippet(lines.slice(start + 1, end));
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
    if (!m || m[2].trim().toLowerCase() !== want) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const mm = /^(#{1,6})\s+/.exec(lines[j]);
      if (mm && mm[1].length <= m[1].length) {
        end = j;
        break;
      }
    }
    return joinSnippet(lines.slice(i + 1, end));
  }
  return null;
}

/** 段落片段（块引用 `#^id`）：metadataCache blocks position 优先，行扫描兜底（块尾 `^id` 或独占一行的取上一段） */
function blockSnippet(lines: string[], id: string, cache: any): string | null {
  const re = new RegExp(`(^|\\s)\\^${escapeRe(id)}(\\s|$)`);
  const start = numOr(cache?.blocks?.[id]?.position?.start?.line, -1);
  if (start >= 0) {
    const end = numOr(cache?.blocks?.[id]?.position?.end?.line, start);
    const text = lines.slice(start, end + 1).join('\n').replace(re, ' '); // 缓存路径同样剥掉块 id 标记
    return joinSnippet([text]);
  }
  const blocks = splitBlocks(lines);
  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].text;
    if (!re.test(text)) continue;
    if (!text.replace(re, ' ').trim() && i > 0) return joinSnippet([blocks[i - 1].text]); // ^id 独占一行 → 取上一段
    return joinSnippet([text.replace(re, ' ').trim()]);
  }
  return null;
}

/**
 * 取标题/块引用对应的正文片段（head/para 节点显示用）。
 * `subpath` = `#标题` 或 `#^块id`（不含 `#`；带 `#` 也容错）。找不到（无此标题/块）返回 null——
 * 文件在但片段不在不算断链（missing 只看文件解析）。
 */
export async function readSubpathBody(file: any, subpath: string, ctx: MountCtx): Promise<string | null> {
  const sp = String(subpath ?? '').trim().replace(/^#/, '').trim();
  if (!sp) return null;
  const path = typeof file === 'string' ? normSlashes(file) : normSlashes(file?.path ?? '');
  if (!path) return null;
  const content = await readText(file, ctx);
  if (!content) return null;
  // 行号按**文件原始行**（含 frontmatter）——metadataCache 的 position 是文件绝对行号；
  // 行扫描兜底同一套行号（frontmatter 行不是标题/块标记，不影响命中）
  const lines = String(content).split(/\r?\n/);
  const cache = ctx?.app?.metadataCache?.getFileCache?.(typeof file === 'string' ? path : file);
  if (sp.startsWith('^')) return blockSnippet(lines, sp.slice(1), cache);
  return headingSnippet(lines, sp, cache);
}

/* ------------------------------------------------------------------ *
 * 315：同名文献对齐（实时读、零落盘）
 * ------------------------------------------------------------------ */

/** 同名文献（文献盒目录内与卡片同名；实时读、零落盘；找不到 null）。改名跟随 = 每次重算 */
export async function findSameNameNote(cardPath: string, ctx: MountCtx): Promise<string | null> {
  const stem = stemOf(cardPath).toLowerCase();
  if (!stem) return null;
  const dir = normDir(ctx?.litDir, '');
  const hits = mdFiles(ctx)
    .filter((f: any) => inDir(f.path, dir) && stemOf(f.path).toLowerCase() === stem)
    .map((f: any) => normSlashes(f.path))
    .sort(byDepthThenPath);
  return hits[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * 315：frontmatter mounted / related（纯字符串行读写）
 * ------------------------------------------------------------------ */

/** frontmatter 列表项内芯（`  - "[[路径|名]]"` → `路径|名`；非列表项返回 null） */
function fmListLineInner(line: string): string | null {
  const m = /^\s*-\s*(.*?)\s*$/.exec(line);
  if (!m) return null;
  const v = m[1].replace(/^["']|["']$/g, '').replace(/^["']|["']$/g, '');
  const mm = v.match(/\[\[([^\]]+)\]\]/);
  return mm ? mm[1].trim() : v.trim();
}
/** frontmatter 键下的列表项（行扫描：只认 `key:` 起头的列表，遇非列表项即结束） */
function fmList(text: string, key: string): string[] {
  const lines = String(text ?? '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return [];
  const head = new RegExp(`^${key}\\s*:`);
  const out: string[] = [];
  let inList = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    if (head.test(line)) {
      inList = true;
      continue;
    }
    if (!inList) continue;
    const inner = fmListLineInner(line);
    if (inner !== null) out.push(inner);
    else if (line.trim() !== '') break; // 列表结束
  }
  return out;
}
/** 挂载项去重键：剥 `[[ ]]`/引号、**只认卡片本体**（别名与 subpath 一并剥掉，与 readMounts 同口径）、去 .md、大小写不敏感 */
function mountKey(link: string): string {
  const inner = String(link ?? '').trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
  return pathKey(splitLinkText(inner).target.trim());
}
/**
 * frontmatter 列表键的**纯字符串**增删（appendRelatedLine 同路子；不碰其它键）。
 * `add` 幂等（同目标已存在 → 原样返回）；`remove` 删掉全部同目标行，列表清空则连键行一起删。
 * 去重/删除**只认卡片本体**（`[[甲卡#标题]]` 与 `[[甲卡|别名]]` 同一条）；键下允许空行（空行不结束列表）。
 * 无 frontmatter / 空目标 / 键为内联非空列表（`mounted: [a, b]`）→ 原样返回（不写脏行、不猜用户手写格式）。
 */
function fmListWrite(text: string, key: string, value: string, mode: 'add' | 'remove'): string {
  const src = String(text ?? '');
  const lines = src.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return src;
  const valueKey = mountKey(value);
  if (!valueKey) return src; // 空目标（''/'[[]]'）：不写 `- "[[]]"` 脏行，也不误删
  let close = -1;
  let at = -1;
  const head = new RegExp(`^${key}\\s*:`);
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      close = i;
      break;
    }
    if (head.test(lines[i])) at = i;
  }
  if (close === -1) return src;
  const inline = at >= 0 ? lines[at].slice(lines[at].indexOf(':') + 1).trim() : '';
  if (at >= 0 && inline && inline !== '[]') return src; // 内联非空列表：不动
  // 列表区间：从键行后到**最后一条列表项**（容忍项之间/键后的空行；遇下一条键即结束）
  let to = at + 1;
  if (at >= 0) {
    let lastItem = -1;
    for (let i = at + 1; i < close; i++) {
      if (fmListLineInner(lines[i]) !== null) lastItem = i;
      else if (lines[i].trim() !== '') break;
    }
    if (lastItem >= 0) to = lastItem + 1;
  }
  const kept: string[] = [];
  let hit = false;
  for (let i = at + 1; i < to; i++) {
    const inner = fmListLineInner(lines[i]);
    if (inner !== null && mountKey(inner) === valueKey) {
      hit = true;
      continue; // 去重 / 删除
    }
    kept.push(lines[i]);
  }
  if (mode === 'add') {
    if (hit) return src; // 幂等
    const item = `  - "[[${String(value ?? '').trim()}]]"`;
    if (at === -1) return [...lines.slice(0, close), `${key}:`, item, ...lines.slice(close)].join('\n');
    const next = lines.slice();
    if (inline) next[at] = `${key}:`; // `mounted: []` → 列表形态
    next.splice(to, 0, item); // 追加到现有列表项之后（appendRelatedLine 同口径）
    return next.join('\n');
  }
  if (!hit || at === -1) return src;
  if (!kept.some((l) => fmListLineInner(l) !== null)) {
    // 列表已空：键行与区间内空行一起删
    return [...lines.slice(0, at), ...lines.slice(to)].join('\n');
  }
  return [...lines.slice(0, at + 1), ...kept, ...lines.slice(to)].join('\n');
}

/** frontmatter `mounted` 的**目标路径**列表（别名/子路径剥除；非卡片由调用方保证） */
export function readMounts(text: string): string[] {
  return fmList(text, 'mounted')
    .map((inner) => splitLinkText(inner).target)
    .filter(Boolean);
}
/** 追加一条手动挂载（`  - "[[link]]"`；同目标已存在 → 原样返回，幂等去重；不碰其它键） */
export function writeMount(text: string, link: string): string {
  return fmListWrite(text, 'mounted', link, 'add');
}
/** 删除一条手动挂载（同目标全部行；列表清空则连 `mounted:` 键行一起删；不碰其它键） */
export function removeMount(text: string, link: string): string {
  return fmListWrite(text, 'mounted', link, 'remove');
}

/**
 * frontmatter `related` 的**目标路径**列表（与 `ui.ts:116 parseRelatedNames` 同一套行扫描，
 * 但取目标而非展示名；写入格式即 `- "[[路径|名]]"`，见 `appendRelatedLine` / `ui.ts` 落卡）。
 */
export async function readRelated(cardPath: string, ctx: MountCtx): Promise<string[]> {
  const text = await readText(cardPath, ctx);
  return fmList(text, 'related')
    .map((inner) => splitLinkText(inner).target)
    .filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * 315：挂载树构建（三源汇总 + 六类形态；方向翻转同一构建器）
 * ------------------------------------------------------------------ */

/** 挂载项（构建内部用）：源 + 目标 + 锚点；上游方向多带 `container`（承载该项的笔记路径） */
interface MountItem {
  source: MountSource;
  kind: MountKind;
  /** 原始目标文本（missing 节点画灰节点用） */
  target: string;
  /** 解析到的库内路径；解析不到为 null */
  path: string | null;
  subpath: string | null;
  alias: string | null;
  anchor: AnchorRef | null;
  missing: boolean;
  /** 上游方向：承载该挂载项的笔记路径（= 挂载方） */
  container?: string;
}

interface Scan {
  ctx: MountCtx;
  /** 路径 → 出向挂载项（一次构建内缓存，实时读不落快照） */
  items: Map<string, MountItem[]>;
  /** 路径 → 正文 */
  bodies: Map<string, string>;
}

function newScan(ctx: MountCtx): Scan {
  return { ctx, items: new Map(), bodies: new Map() };
}

async function scanBody(scan: Scan, path: string): Promise<string> {
  const key = pathKey(path);
  if (!scan.bodies.has(key)) scan.bodies.set(key, await bodyOf(path, scan.ctx));
  return scan.bodies.get(key)!;
}

/** 单条链接文本（related / mounted 项）→ 挂载项 */
function itemFromLink(text: string, source: MountSource, ctx: MountCtx, sourcePath: string): MountItem | null {
  const { target, alias, subpath } = splitLinkText(text);
  if (!target) return null;
  const path = resolveLinkPath(target, ctx, sourcePath);
  return {
    source,
    kind: classifyKind(target, subpath, false, path, ctx?.cardboxDir ?? ''),
    target,
    path,
    subpath,
    alias,
    anchor: null,
    missing: !path,
  };
}

/** 一篇笔记的出向挂载项：正文双链（有锚点）+ related + mounted（手动）；同目标只留首条 */
async function outboundItems(scan: Scan, path: string): Promise<MountItem[]> {
  const key = pathKey(path);
  const cached = scan.items.get(key);
  if (cached) return cached;
  const text = await readText(path, scan.ctx);
  scan.bodies.set(key, stripFrontmatter(text));
  const items: MountItem[] = [];
  const links = await resolveMountLinks(parseMountLinks(stripFrontmatter(text)), scan.ctx, path);
  for (const l of links) {
    items.push({ source: 'link', kind: l.kind, target: l.target, path: l.path, subpath: l.subpath, alias: l.alias, anchor: l.anchor, missing: l.missing });
  }
  for (const t of fmList(text, 'related')) {
    const it = itemFromLink(t, 'related', scan.ctx, path);
    if (it) items.push(it);
  }
  for (const t of fmList(text, 'mounted')) {
    const it = itemFromLink(t, 'manual', scan.ctx, path);
    if (it) items.push(it);
  }
  const seen = new Set<string>();
  const deduped = items.filter((it) => {
    // 同一来源内按目标去重（正文双链 parseMountLinks 已去过重复）；不同来源各自成项
    // （related 与 mounted 指同一张卡算两条挂载项 → 树里节点/边仍唯一，仅引用计数各记一条）
    const k = `${it.source}:${it.path ? `${pathKey(it.path)}#${(it.subpath ?? '').toLowerCase()}` : `missing#${linkKey(it.target, it.subpath)}`}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  scan.items.set(key, deduped);
  return deduped;
}

/** 反查挂载方：全库 md 里挂载项指向 targetPath 的（上游方向） */
async function inboundItems(scan: Scan, targetPath: string): Promise<MountItem[]> {
  const out: MountItem[] = [];
  for (const f of mdFiles(scan.ctx)) {
    if (samePath(f.path, targetPath)) continue; // 自链不算挂载方
    const items = await outboundItems(scan, f.path);
    for (const it of items) {
      if (!it.path || !samePath(it.path, targetPath)) continue;
      out.push({ ...it, container: normSlashes(f.path) });
    }
  }
  return out;
}

/** 节点 id：下游 = 目标（`path` / `path#subpath`，missing 用原始目标文本）；上游 = 挂载方笔记路径 */
function itemId(it: MountItem): string {
  const p = it.path ?? it.target;
  return it.subpath ? `${p}#${it.subpath}` : p;
}

/** 自链判定（含自链子路径 / 断链但目标名即本卡名）：不产节点、不产边（剪线由树构建负责） */
function isSelfItem(it: MountItem, nodePath: string): boolean {
  if (it.path) return samePath(it.path, nodePath);
  return pathKey(it.target) === pathKey(nodePath) || stemOf(it.target).toLowerCase() === stemOf(nodePath).toLowerCase();
}

/** 主卡节点（root：source self、kind card、depth 0） */
async function rootNode(path: string, scan: Scan): Promise<MountNode> {
  return {
    id: path,
    path,
    title: stemOf(path),
    kind: 'card',
    source: 'self',
    depth: 0,
    anchor: null,
    missing: false,
    suggested: false,
    attached: false,
    body: await scanBody(scan, path),
  };
}

/** 节点的 kind/body/title 定型（下游：目标；上游：承载挂载项的笔记） */
async function materialize(scan: Scan, it: MountItem, depth: number, upstream: boolean): Promise<MountNode> {
  if (upstream) {
    const path = normSlashes(it.container ?? it.path ?? it.target);
    return {
      id: path,
      path,
      title: stemOf(path),
      kind: classifyKind(path, null, false, path, scan.ctx?.cardboxDir ?? ''),
      source: it.source,
      depth,
      anchor: it.anchor,
      missing: false,
      suggested: false,
      attached: false,
      body: await scanBody(scan, path),
    };
  }
  const path = it.path ?? it.target;
  let body: string | null = null;
  if (it.path && (it.kind === 'note' || it.kind === 'card')) body = await scanBody(scan, it.path);
  else if (it.path && (it.kind === 'head' || it.kind === 'para') && it.subpath) body = await readSubpathBody({ path: it.path }, it.subpath, scan.ctx);
  let title: string;
  if (it.kind === 'head') title = it.subpath ?? stemOf(path);
  else if (it.kind === 'para') title = (body ? body.split('\n')[0].trim().slice(0, 24) : '') || `^${String(it.subpath ?? '').replace(/^\^/, '')}`;
  else title = it.missing ? it.target : baseName(path) || it.target;
  return {
    id: itemId(it),
    path,
    title,
    kind: it.kind,
    source: it.source,
    depth,
    anchor: it.anchor,
    missing: it.missing,
    suggested: false,
    attached: false,
    body,
  };
}

/**
 * 主卡 → 挂载树（三源汇总 + 六类形态；可达／非回指／严格跨代；方向翻转同一构建器）。
 * - root = 主卡自身（source `self`、kind `card`、depth 0）
 * - 同名文献：`source: 'sameName'`、`attached: true`、depth = 父 + 1、**不进 edges**（两个方向都吸附）
 * - 双链 → `'link'`（带 anchor）；related → `'related'`；frontmatter mounted → `'manual'`
 * - 只有卡片节点继续展开；同一目标全树只出现一次（BFS 最短 depth）；自链剪掉
 * - 边恒 `depth(to) > depth(from)`（契约不变式）；`direction: 'upstream'` 时 from = 被挂方、to = 挂载方
 * - nodes 按 (depth, 首次出现序)、edges 按 (from 出现序, to 出现序)，同输入必得同输出
 */
export async function buildMountTree(cardPath: string, opts: { direction: MountDirection; ctx: MountCtx }): Promise<MountTree> {
  const ctx = opts?.ctx ?? mountCtx();
  const direction: MountDirection = opts?.direction === 'upstream' ? 'upstream' : 'downstream';
  const upstream = direction === 'upstream';
  const rootPath = normSlashes(String(cardPath ?? '')).replace(/^\/+|\/+$/g, '');
  const scan = newScan(ctx);
  const nodes = new Map<string, MountNode>();
  const order: string[] = [];
  const edges: MountEdge[] = [];
  const edgeKeys = new Set<string>();
  const root = await rootNode(rootPath, scan);
  nodes.set(root.id, root);
  order.push(root.id);
  const queue: string[] = [root.id];

  while (queue.length) {
    const node = nodes.get(queue.shift()!)!;
    if (node.kind !== 'card' || node.missing) continue; // 只有卡片节点继续展开
    // 同名文献吸附（固定挂载恒列；不产边）
    const sameNote = await findSameNameNote(node.path, ctx);
    if (sameNote && !nodes.has(sameNote)) {
      const child: MountNode = {
        id: sameNote,
        path: sameNote,
        title: stemOf(sameNote),
        kind: classifyKind(sameNote, null, false, sameNote, ctx.cardboxDir),
        source: 'sameName',
        depth: node.depth + 1,
        anchor: null,
        missing: false,
        suggested: false,
        attached: true,
        body: await scanBody(scan, sameNote),
      };
      nodes.set(child.id, child);
      order.push(child.id); // 非卡片（note）不展开，不入队
    }
    const items = upstream ? await inboundItems(scan, node.path) : await outboundItems(scan, node.path);
    for (const it of items) {
      // 自链剪线（下游 = 目标即本卡；上游的「自己挂自己」在 inboundItems 已排除，此处 it.path 恒为该节点自身）
      if (!upstream && isSelfItem(it, node.path)) continue;
      const id = upstream ? normSlashes(it.container ?? it.path ?? it.target) : itemId(it);
      let child = nodes.get(id) ?? null;
      let fresh = false;
      if (!child) {
        child = await materialize(scan, it, node.depth + 1, upstream);
        nodes.set(child.id, child);
        order.push(child.id);
        fresh = true;
      }
      // 边：可达（树内）+ 非回指（BFS 最短 depth）+ 严格跨代（depth(to) > depth(from)）；
      // 同名文献（attached）**恒不拉线**（ADR-0137 §4「文献不拉线」）——正文显式双链到同名文献也不产边
      if (!child.attached && child.depth > node.depth) {
        const ek = `${node.id}\u0000${child.id}`;
        if (!edgeKeys.has(ek)) {
          edgeKeys.add(ek);
          edges.push({ from: node.id, to: child.id, suggested: false });
        }
      }
      if (fresh && child.kind === 'card' && !child.missing) queue.push(child.id);
    }
  }

  // 顺序稳定：nodes 按 (depth, 首次出现序)
  const firstIdx = new Map(order.map((id, i) => [id, i]));
  const list = order.map((id) => nodes.get(id)!).filter(Boolean);
  list.sort((a, b) => a.depth - b.depth || (firstIdx.get(a.id) ?? 0) - (firstIdx.get(b.id) ?? 0));
  // edges 按 (from 出现序, to 出现序)
  const pos = new Map(list.map((n, i) => [n.id, i]));
  const sortedEdges = edges
    .slice()
    .sort((a, b) => (pos.get(a.from) ?? -1) - (pos.get(b.from) ?? -1) || (pos.get(a.to) ?? -1) - (pos.get(b.to) ?? -1));
  return { root: root.id, direction, nodes: list, edges: sortedEdges };
}

/* ------------------------------------------------------------------ *
 * 315：引用计数与孤儿卡（同包四项之二，ADR-0138 §5）
 * ------------------------------------------------------------------ */

/**
 * 引用计数（**只数用户双链**：正文 wikilink + related + mounted 指向该卡的总数）；
 * 不数同名文献、不数 AI 建议。键 = 卡片盒里的卡片路径（含 0），值 = 指向它的项数
 * （同一文件内重复指向同一目标只计 1——挂载项按目标去重）。
 */
export async function refCounts(ctx: MountCtx): Promise<Record<string, number>> {
  const scan = newScan(ctx);
  const cards = cardFiles(ctx);
  const byKey = new Map(cards.map((c: any) => [pathKey(c.path), normSlashes(c.path)]));
  const counts: Record<string, number> = {};
  for (const c of cards) counts[normSlashes(c.path)] = 0;
  for (const f of mdFiles(ctx)) {
    const items = await outboundItems(scan, f.path);
    for (const it of items) {
      if (!it.path) continue;
      const card = byKey.get(pathKey(it.path));
      if (card) counts[card] = (counts[card] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * 孤儿卡（列表筛选 + 行标记）：卡片盒里**既无入链也无挂载**的卡——
 * 即引用计数为 0 且自身挂载项（正文双链 / related / mounted）全空；
 * 同名文献的存在不解除孤儿（同名对齐不是双链）。按路径排序，同输入必得同输出。
 */
export async function orphanCards(ctx: MountCtx): Promise<string[]> {
  const scan = newScan(ctx);
  const counts = await refCounts(ctx);
  const out: string[] = [];
  for (const card of cardFiles(ctx)) {
    const path = normSlashes(card.path);
    if ((counts[path] ?? 0) > 0) continue;
    const items = await outboundItems(scan, path);
    if (items.length) continue;
    out.push(path);
  }
  return out.sort();
}

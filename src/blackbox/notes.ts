/**
 * 黑匣子笔记引擎（ticket 01，ADR-0015 笔记化）：三类条目落盘 `黑匣子/概念|摘抄|想法/*.md`，
 * 笔记即事实源。frontmatter（id/type/createdAt + 感触外壳 + 卡片盒可选字段）+ 正文（定义/摘抄/想法
 * + 底部关联区 `[[…]]` 双链）。本文件为纯函数 + 内容组装/解析（不依赖 App 实例，便于单测）。
 *
 * frontmatter 冻结字段：id / type / createdAt / emotions / people / scene / source
 * （+ 卡片盒可选 category / tags / summary）。v2 遗留 toward / links 作为兼容扩展字段落盘
 * （迁移无损；不改既有字段语义）。
 *
 * 正文约定（冻结）：
 * - 概念：定义文本 + 底部 `- 关联：[[概念A]] [[概念B]]`
 * - 摘抄：摘抄文本 + 底部 `来源：[[来源笔记]]`（或 URL 文本）、`关联概念：[[概念A]]`
 * - 想法：想法文本 + 底部 `来自：[[摘抄笔记]]`（提炼想法带出时）
 * 关联区为与正文空行分隔的末尾连续行块。
 */
import type { Entry, EntryType } from './types';
import { sanitizeEmotions, sanitizePeople, MAX_EMOTIONS, MAX_PEOPLE } from './types';

/** 笔记根目录（vault 相对路径） */
export const BB_NOTE_ROOT = '黑匣子';
/** 类型 → 子目录 */
export const TYPE_DIR: Record<EntryType, string> = {
  concept: '概念',
  literature: '摘抄',
  thought: '想法',
};

/** 条目类型 → 笔记子目录（concept/literature/thought） */
export function typeDir(type: EntryType): string {
  return TYPE_DIR[type] || '想法';
}

/** 是否为黑匣子笔记路径（实时同步/事件过滤用） */
export function isBlackBoxNotePath(path: string): boolean {
  return !!path && path.startsWith(`${BB_NOTE_ROOT}/`) && path.endsWith('.md');
}

/** 文件名非法字符清洗（`\\/:*?"<>|` 与空白折叠）；空结果回退「未命名」 */
export function sanitizeFileName(name: string): string {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '未命名';
}

/** 笔记路径 → 条目名（文件名去 .md、去重后缀 -N 剥离；概念名 = 该值） */
export function noteNameFromPath(path: string): string {
  const base = (path.split('/').pop() || '').replace(/\.md$/, '');
  return base.replace(/-\d+$/, '');
}

/** 条目 → 笔记标题（文件名）：概念 = 概念名；文献/想法 = AI 标题（ticket 03）或正文前 20 字（去空白）降级。 */
export function entryNoteTitle(entry: Entry): string {
  if (entry.type === 'concept') return sanitizeFileName(entry.name || '');
  if (entry.title && entry.title.trim()) return sanitizeFileName(entry.title.trim());
  const text = (entry.text || '').replace(/\s+/g, ' ').trim();
  return sanitizeFileName(text.slice(0, 20));
}

/** 笔记路径（含子目录；不含去重后缀） */
export function notePathOf(type: EntryType, title: string): string {
  return `${BB_NOTE_ROOT}/${typeDir(type)}/${sanitizeFileName(title)}.md`;
}

/** 行内 `[[…]]` 链接名解析（支持 [[名|别名]] / [[名#锚点]]，取主名；别名不取） */
export function parseWikilinkNames(line: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line || ''))) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

/** 行内 `[[…]]` 链接结构解析（2026-08-12：关联双链改完整路径 `[[路径|名]]`）：
 *  main = 主名（可能是笔记路径，也可能是不含 `/` 的旧格式概念名）；alias = 竖线后显示名（可能为空）。 */
export function parseWikilinks(line: string): { main: string; alias: string }[] {
  const out: { main: string; alias: string }[] = [];
  const re = /\[\[([^\]|#]+?)(?:\|([^\]|#]*))?(?:#[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line || ''))) {
    const main = (m[1] || '').trim();
    const alias = (m[2] || '').trim();
    if (main) out.push({ main, alias });
  }
  return out;
}

/** 链接显示名（别名 → 路径尾段 → 主名）：用于解析不到目标时写入 pendingLinks 的可读名 */
export function wikilinkDisplay(link: { main: string; alias: string }): string {
  if (link.alias) return link.alias;
  const tail = link.main.split('/').pop() || '';
  return tail || link.main;
}

/** YAML 标量引号剥除（与 Obsidian parseFrontmatter 一致） */
function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

/**
 * frontmatter 解析（简易 YAML 子集：`key: value` / `key: [a, b]` / `key:` + `  - 项`；
 * 兼容真实 Obsidian 导出的引号/数字形式）。
 */
export function parseFrontmatterBlock(content: string): Record<string, any> | null {
  const m = content.match(/^---\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!m) return null;
  const fm: Record<string, any> = {};
  let lastKey = '';
  for (const line of m[1].split('\n')) {
    if (/^\s*-\s+/.test(line)) {
      // YAML 列表项（emotions/people/links/tags…）；先于 key-value 判定（避免 `- https://…` 被冒号误判）
      const v: any = unquote(line.replace(/^\s*-\s+/, ''));
      if (!Array.isArray(fm[lastKey])) fm[lastKey] = [];
      fm[lastKey].push(v);
      continue;
    }
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (value === '' || value === '[]') {
        fm[key] = [];
        lastKey = key;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        fm[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => unquote(s))
          .filter(Boolean);
        lastKey = key;
      } else {
        fm[key] = unquote(value);
        lastKey = key;
      }
    }
  }
  return fm;
}

/** 标量引号包裹（含 `:` / `[[` 等特殊字符时安全；Obsidian YAML 兼容） */
function quoteScalar(v: string): string {
  if (/^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/.test(v)) return v;
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function fmList(key: string, list: string[] | undefined): string[] {
  const arr = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
  if (!arr.length) return [];
  return [`${key}:`, ...arr.map((x) => `  - ${x.trim()}`)];
}

function fmScalar(key: string, value: string | undefined): string[] {
  if (typeof value !== 'string' || !value) return [];
  return [`${key}: ${quoteScalar(value)}`];
}

/**
 * 条目 → 笔记内容（frontmatter + 正文 + 关联区）。
 * nameForId：条目 id → 笔记名（用于把 related/terms/from 的 id 解析为 `[[名]]`；解析不到跳过该链接）。
 */
export function buildNoteContent(entry: Entry, nameForId: (id: string) => { name: string; path: string } | undefined): string {
  const fm: string[] = ['---'];
  fm.push(`id: ${entry.id}`);
  fm.push(`type: ${entry.type}`);
  fm.push(`createdAt: ${quoteScalar(entry.createdAt || new Date().toISOString())}`);
  // 概念名/文献想法标题写进 frontmatter（文件名只是载体：避免「名含 -数字」被去重后缀剥离，如 LK-99）
  if (entry.type === 'concept') {
    if (entry.name) fm.push(`name: ${quoteScalar(entry.name.trim())}`);
  } else if (entry.title) {
    fm.push(`title: ${quoteScalar(entry.title.trim())}`);
  }
  if (entry.emotions && entry.emotions.length) fm.push(...fmList('emotions', entry.emotions.slice(0, MAX_EMOTIONS)));
  if (entry.people && entry.people.length) fm.push(...fmList('people', entry.people.slice(0, MAX_PEOPLE)));
  if (entry.scene) fm.push(...fmScalar('scene', entry.scene));
  if (entry.toward) fm.push(`toward: ${entry.toward}`);
  if (entry.links && entry.links.length) fm.push(...fmList('links', entry.links));
  if (entry.type === 'literature' && entry.source) fm.push(...fmScalar('source', entry.source));
  // 关联双链完整落盘 frontmatter（用户决策：正文关联区被手动修改/误删不丢数据，frontmatter 为准）：
  // 概念 related / 文献 terms（名字数组）；想法 from（来源摘抄名）；待补链 pendingLinks
  const relIds = entry.type === 'concept' ? entry.related || [] : entry.type === 'literature' ? entry.terms || [] : [];
  const relRefs = relIds.map(nameForId).filter((x): x is { name: string; path: string } => !!x);
  const relNames = relRefs
    .map((r) => r.name)
    .filter((n, i, a) => a.indexOf(n) === i);
  if (entry.type === 'concept' && relNames.length) fm.push(...fmList('related', relNames));
  if (entry.type === 'literature' && relNames.length) fm.push(...fmList('terms', relNames));
  if (entry.type === 'thought' && entry.from) {
    const fromRef = nameForId(entry.from);
    if (fromRef) fm.push(...fmScalar('from', fromRef.name));
  }
  if (entry.pendingLinks && entry.pendingLinks.length) fm.push(...fmList('pendingLinks', entry.pendingLinks));
  // 卡片盒导入元信息（可选）
  if (entry.category) fm.push(...fmScalar('category', entry.category));
  if (entry.tags && entry.tags.length) fm.push(...fmList('tags', entry.tags));
  if (entry.summary) fm.push(...fmScalar('summary', entry.summary));
  fm.push('---');

  // 正文关联区双链：完整路径 `[[黑匣子/概念/<分类>/<名>|显示名]]`（Obsidian 可点跳转、同名不歧义）；
  // pendingLinks（尚未落盘的概念）无路径 → 保持 `[[名]]`
  const toLink = (r: { name: string; path: string }): string => `[[${r.path.replace(/\.md$/, '')}|${r.name}]]`;
  const body: string[] = [];
  const rel: string[] = [];
  if (entry.type === 'concept') {
    if (entry.definition) body.push(entry.definition.replace(/\s+$/, ''));
    const links = [
      ...(entry.related || []).map((id) => nameForId(id)).filter((x): x is { name: string; path: string } => !!x).map(toLink),
      ...(entry.pendingLinks || []).map((n) => `[[${n}]]`),
    ].filter((l, i, a) => a.indexOf(l) === i);
    if (links.length) rel.push(`- 关联：${links.join(' ')}`);
  } else if (entry.type === 'literature') {
    if (entry.text) body.push(entry.text.replace(/\s+$/, ''));
    const src = (entry.source || '').trim();
    if (src) rel.push(`来源：${src}`);
    const links = [
      ...(entry.terms || []).map((id) => nameForId(id)).filter((x): x is { name: string; path: string } => !!x).map(toLink),
      ...(entry.pendingLinks || []).map((n) => `[[${n}]]`),
    ].filter((l, i, a) => a.indexOf(l) === i);
    if (links.length) rel.push(`关联概念：${links.join(' ')}`);
  } else {
    if (entry.text) body.push(entry.text.replace(/\s+$/, ''));
    const fromRef = entry.from ? nameForId(entry.from) : undefined;
    if (fromRef) rel.push(`来自：${toLink(fromRef)}`);
  }
  // 正文与关联区以空行分隔（无正文时也保留空行，解析统一）；关联区为连续行块
  const textBlock = body.join('\n\n');
  return fm.join('\n') + '\n' + (textBlock ? textBlock + '\n\n' : '\n') + (rel.length ? rel.join('\n') + '\n' : '');
}

/** 关联链接引用（2026-08-12：正文关联双链为完整路径 `[[路径|名]]`）：
 *  ref = 匹配键（路径链接 = 笔记路径（无 .md）；名字链接/frontmatter = 概念名或标题）；
 *  display = 可读名（别名 → 路径尾段 → 主名；解析不到目标时写入 pendingLinks 用）。 */
export interface LinkRef {
  ref: string;
  display: string;
}

/** 笔记内容解析 → 条目 + 关联区引用（关联 id 解析在 data 层完成）。解析失败返回 null（跳过该条并保留索引重试）。 */
export function parseNoteContent(
  content: string,
  path: string
): { entry: Entry; relatedNames: LinkRef[]; termsNames: LinkRef[]; fromName: LinkRef } | null {
  const fm = parseFrontmatterBlock(content || '');
  if (!fm) return null;
  if (typeof fm.id !== 'string' || !fm.id) return null;
  if (fm.type !== 'concept' && fm.type !== 'literature' && fm.type !== 'thought') return null;
  if (typeof fm.createdAt !== 'string' || !fm.createdAt) return null;

  // 正文：去掉 frontmatter（仅吃 `---` 行自身换行，保留分隔空行）后，末尾连续关联区行块剥离；
  // 关联区行块 = 以 `关联|来源|关联概念|来自：` 开头的连续行（含 `- 关联：`），与正文空行分隔或即为全文
  const rawBody = (content || '')
    .replace(/^---\n[\s\S]*?\n---[ \t]*\r?\n/, '')
    .replace(/^\n/, '');
  const relBlockRe = /(?:^|\n\n)((?:[- ]*(?:关联|来源|关联概念|来自)：[^\n]*\n?)+)$/;
  let text = rawBody.trim();
  let relText = '';
  const m = rawBody.match(relBlockRe);
  if (m) {
    relText = m[1];
    text = rawBody.slice(0, m.index).trim();
  }

  const relatedNames: LinkRef[] = [];
  const termsNames: LinkRef[] = [];
  let fromName: LinkRef = { ref: '', display: '' };
  // frontmatter 为准，正文关联区合并（用户手动增删任一处不丢数据；frontmatter 删了正文还在）
  const pushUnique = (arr: LinkRef[], n: LinkRef): void => {
    if (n.ref && !arr.some((x) => x.ref === n.ref)) arr.push(n);
  };
  const nameRef = (n: string): LinkRef => ({ ref: n, display: n });
  for (const n of Array.isArray(fm.related) ? fm.related.filter((x): x is string => typeof x === 'string') : []) pushUnique(relatedNames, nameRef(n.trim()));
  for (const n of Array.isArray(fm.terms) ? fm.terms.filter((x): x is string => typeof x === 'string') : []) pushUnique(termsNames, nameRef(n.trim()));
  for (const n of Array.isArray(fm.pendingLinks) ? fm.pendingLinks.filter((x): x is string => typeof x === 'string') : []) pushUnique(relatedNames, nameRef(n.trim()));
  if (typeof fm.from === 'string' && fm.from.trim()) fromName = nameRef(fm.from.trim());
  for (const line of relText.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const links = parseWikilinks(t);
    if (t.startsWith('- 关联：')) {
      for (const l of links) pushUnique(relatedNames, { ref: l.main, display: wikilinkDisplay(l) });
    } else if (t.startsWith('关联概念：')) {
      for (const l of links) pushUnique(termsNames, { ref: l.main, display: wikilinkDisplay(l) });
    } else if (t.startsWith('来自：')) {
      if (!fromName.ref) fromName = links.length ? { ref: links[0].main, display: wikilinkDisplay(links[0]) } : { ref: '', display: '' };
    }
  }

  const base: Entry = {
    id: fm.id,
    type: fm.type,
    createdAt: fm.createdAt,
    emotions: sanitizeEmotions(fm.emotions),
    people: sanitizePeople(fm.people),
    scene: typeof fm.scene === 'string' ? fm.scene : '',
    toward: fm.toward === 'self' || fm.toward === 'others' || fm.toward === 'world' ? fm.toward : '',
    links: Array.isArray(fm.links) ? fm.links.filter((l): l is string => typeof l === 'string') : [],
  };
  if (fm.type === 'concept') {
    base.name = typeof fm.name === 'string' && fm.name.trim() ? fm.name.trim() : noteNameFromPath(path);
    base.definition = text;
    base.related = [];
  } else if (fm.type === 'literature') {
    base.text = text;
    base.source = typeof fm.source === 'string' ? fm.source : '';
    base.terms = [];
    base.title = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : noteNameFromPath(path);
  } else {
    base.text = text;
    base.title = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : noteNameFromPath(path);
  }
  if (typeof fm.category === 'string' && fm.category.trim()) base.category = fm.category.trim();
  if (Array.isArray(fm.tags)) base.tags = fm.tags.filter((t): t is string => typeof t === 'string');
  if (typeof fm.summary === 'string' && fm.summary.trim()) base.summary = fm.summary.trim();
  return { entry: base, relatedNames, termsNames, fromName };
}

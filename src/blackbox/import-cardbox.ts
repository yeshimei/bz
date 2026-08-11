/**
 * 卡片盒批量导入（一次性工具）：bz-blackbox-import-cardbox「导入卡片盒」。
 * 扫描 vault「卡片盒/*.md」→ 解析 frontmatter + 正文（去图片/视频嵌入）→ 规则预筛（空卡/敏感词）→
 * AI 批量分类（concept/literature/skip + 理由）→ 自动关联（双链 [[…]] 解析 + TF-IDF 相似度）→
 * 预览确认（import-ui）→ 批量写入 blackbox.json（一次 load→push→save，写前重载）→
 * 进度记录 CONFIG/STORAGE/blackbox_import.json（已导入文件名，重跑自动跳过）。
 * 概念：name=文件名（去 .md），definition=正文原样（截断）；文献：text + source=原卡链接 + insight=AI 分类理由留空。
 * related 回填：既有概念存 id；本批新卡按 name→id 映射回填（上限 5，去重）。
 * 一次性定位：无常驻事件、无设置项；卡片盒源文件保留不动；导入不触发自动复盘（批量写入不走 addEntry）。
 */
import type { App } from 'obsidian';
import { BlackBoxAI, parseClassifyJson, parseSummaryJson } from './ai';
import { BlackBoxDataManager, createEntry } from './data';
import { TFIDF } from '../flash/tfidf';
import { tryGetSettings } from '../core/settings-provider';
import type { BlackBoxData, Entry } from './types';

/** 卡片盒目录（vault 相对路径） */
export const CARDBOX_FOLDER = '卡片盒';
/** 进度记录文件（独立于 blackbox.json，不动既有数据格式） */
export function getImportLogPath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/blackbox_import.json`;
}

/** 敏感内容正则（安全红线：含这些关键词的卡片直接跳过） */
const SENSITIVE_RE = /(恢复码|密码|密钥|验证码|私钥|身份证|银行卡|账号密码|登录凭证)/i;
/** 剪藏残渣文件名 */
const JUNK_NAME_RE = /(404|not found|未命名|error page)/i;
/** 正文截断上限 */
const MAX_TEXT = 1500;

export interface CardItem {
  /** 文件名去 .md（即概念名/文献标题） */
  name: string;
  /** 正文（frontmatter/图片视频嵌入已剔除） */
  text: string;
  /** frontmatter tags */
  tags: string[];
  /** frontmatter category */
  category: string;
  /** 卡片自带的一句话描述（inline (描述:: …) 字段，作为 summary 首选） */
  desc: string;
  /** 卡片创建时间（ISO，取文件 stat.ctime；作为条目 createdAt） */
  createdAt: string;
  path: string;
}

export type ClassifyKind = 'concept' | 'literature' | 'skip';

export interface ClassifiedCard extends CardItem {
  kind: ClassifyKind;
  reason: string;
  /** 关联候选：既有概念 id 或本批卡片名（上限 5，去重） */
  relatedNames: string[];
  /** 用户标记：该卡需 AI 生成 summary（预览确认时勾选；未勾选用 desc 或留空） */
  aiSummary: boolean;
  /** AI 生成结果回填（确认后生成，导入时写入条目） */
  summary: string;
}

// ---------------- 解析 ----------------

/** 解析单张卡片文件：frontmatter（tags/category）+ 正文（去嵌入、截断）+ inline (描述:: …) */
export function parseCardFile(name: string, content: string, createdAt = ''): CardItem {
  let text = content;
  let tags: string[] = [];
  let category = '';
  let desc = '';
  const fm = content.match(/^---\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (fm) {
    text = content.slice(fm[0].length);
    const tagMatch = fm[1].match(/tags:\s*\[([^\]]*)\]/);
    if (tagMatch) tags = tagMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    const catMatch = fm[1].match(/category:\s*(.+)$/m);
    if (catMatch) category = catMatch[1].trim();
  }
  // inline dataview 字段 (描述:: …) —— 卡片自带的一句话总结
  const descMatch = text.match(/\(描述::\s*([^)]+)\)/);
  if (descMatch) desc = descMatch[1].trim().slice(0, 200);
  // 去掉图片/视频/音频嵌入整行
  text = text
    .split('\n')
    .filter((l) => !/^\s*!\[\[/.test(l.trim()))
    .join('\n');
  text = text.trim().slice(0, MAX_TEXT);
  return { name, text, tags, category, desc, createdAt, path: `${CARDBOX_FOLDER}/${name}.md` };
}

/** 异步全量扫描（真实 vault 走 cachedRead；mock 走内存树） */
export async function scanCardboxAsync(app: App): Promise<CardItem[]> {
  const files = (app.vault.getMarkdownFiles() as any[]).filter((f) => f.path.startsWith(`${CARDBOX_FOLDER}/`));
  const out: CardItem[] = [];
  for (const f of files) {
    const base = (f as any).basename || f.name.replace(/\.md$/, '');
    let raw = '';
    try {
      raw = await (app.vault as any).cachedRead(f);
    } catch (e) {
      const v: any = app.vault;
      raw = v.files && typeof v.files.get === 'function' ? v.files.get(f.path) ?? '' : '';
    }
    // 卡片创建时间 → 条目录入时间（stat 缺失兜底为空 → 导入时用当前时间）
    let createdAt = '';
    try {
      const st = await (f as any).stat;
      if (st && st.ctime) createdAt = new Date(st.ctime).toISOString();
    } catch (e) {
      /* stat 不可用（mock 等） */
    }
    out.push(parseCardFile(base, raw, createdAt));
  }
  return out;
}

// ---------------- 规则预筛 ----------------

/** 规则预筛：空卡 / 剪藏残渣 / 敏感内容 → skip（永不进入 AI 分类） */
export function prefilterCard(card: CardItem): { kind: 'skip'; reason: string } | null {
  if (!card.text || card.text.length < 20) {
    return { kind: 'skip', reason: '空卡或内容过短' };
  }
  if (JUNK_NAME_RE.test(card.name)) {
    return { kind: 'skip', reason: '疑似剪藏残渣' };
  }
  if (SENSITIVE_RE.test(card.text)) {
    return { kind: 'skip', reason: '含敏感信息（恢复码/密码/密钥等）' };
  }
  return null;
}

// ---------------- AI 批量分类 ----------------

/** AI 批量分类（每批 20 张；失败降级为 concept——文本可读即入，永不拒收） */
export async function classifyCards(ai: BlackBoxAI, cards: CardItem[]): Promise<ClassifiedCard[]> {
  const out: ClassifiedCard[] = [];
  const BATCH = 20;
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const listText = batch
      .map((c, j) => `${i + j + 1}. ${c.name}：${c.text.slice(0, 150).replace(/\n/g, ' ')}`)
      .join('\n');
    let parsed: { i: number; kind: ClassifyKind; reason: string }[] = [];
    try {
      parsed = parseClassifyJson(await ai.classifyCards(listText));
    } catch (e) {
      /* AI 失败：整批降级为 concept */
    }
    batch.forEach((c, j) => {
      const hit = parsed.find((p) => p.i === i + j + 1);
      out.push({
        ...c,
        kind: hit ? hit.kind : 'concept',
        reason: hit ? hit.reason : 'AI 分类失败，默认按概念',
        relatedNames: [],
        aiSummary: false,
        summary: '',
      });
    });
  }
  return out;
}

/** 批量生成总结（仅对用户标记 aiSummary 的卡；失败行留空，不阻断导入） */
export async function generateSummaries(ai: BlackBoxAI, cards: ClassifiedCard[]): Promise<void> {
  const BATCH = 20;
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const listText = batch
      .map((c, j) => `${i + j + 1}. ${c.name}：${c.text.slice(0, 150).replace(/\n/g, ' ')}`)
      .join('\n');
    let parsed: { i: number; summary: string }[] = [];
    try {
      parsed = parseSummaryJson(await ai.summarizeCards(listText));
    } catch (e) {
      /* AI 失败：该批留空 */
    }
    batch.forEach((c, j) => {
      const hit = parsed.find((p) => p.i === i + j + 1);
      if (hit) c.summary = hit.summary;
    });
  }
}

// ---------------- 关联构建（双链 + TF-IDF） ----------------

/** 双链解析：正文中的 [[Name]] / [[Name|别名]] → 卡片名列表（排除自身） */
export function extractLinks(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

/**
 * 关联构建：双链命中（本批卡片名 / 既有概念名）+ TF-IDF 相似度 TopK。
 * 返回 name → 候选（既有概念 id 或本批卡片名），上限 5 去重。
 */
export function buildRelations(
  cards: CardItem[],
  existingConcepts: Entry[],
  topK = 3
): Map<string, string[]> {
  const rel = new Map<string, string[]>();
  const nameSet = new Set(cards.map((c) => c.name));
  const existingByName = new Map(existingConcepts.map((e) => [e.name, e.id]));

  const push = (from: string, target: string): void => {
    if (from === target) return;
    const list = rel.get(from) || [];
    if (!list.includes(target)) list.push(target);
    rel.set(from, list);
  };

  // 双链
  for (const c of cards) {
    for (const link of extractLinks(c.text)) {
      if (nameSet.has(link)) push(c.name, link);
      else if (existingByName.has(link)) push(c.name, existingByName.get(link)!);
    }
  }

  // TF-IDF 相似度
  if (cards.length > 1) {
    const tfidf = new TFIDF();
    tfidf.build(cards.map((c) => ({ path: c.name, text: `${c.name} ${c.text}` })));
    for (const c of cards) {
      const hits = tfidf.search(`${c.name} ${c.text}`, topK + 1); // +1 排除自身
      for (const h of hits) {
        const t = h.path as string;
        if (t === c.name) continue;
        if (nameSet.has(t)) push(c.name, t);
        else if (existingByName.has(t)) push(c.name, existingByName.get(t)!);
      }
    }
  }

  // 上限 5 去重
  for (const [k, v] of rel) {
    rel.set(k, [...new Set(v)].slice(0, 5));
  }
  return rel;
}

// ---------------- 批量导入（幂等） ----------------

/** 读取导入日志：{ imported: 已导入文件名, skipped: 用户标记永不导入的文件名 }（无文件返回空集） */
export async function readImportLog(app: App): Promise<{ imported: Set<string>; skipped: Set<string> }> {
  try {
    const raw = await (app.vault as any).adapter.read(getImportLogPath());
    const obj = JSON.parse(raw);
    return {
      imported: obj && Array.isArray(obj.imported) ? new Set(obj.imported) : new Set(),
      skipped: obj && Array.isArray(obj.skipped) ? new Set(obj.skipped) : new Set(),
    };
  } catch (e) {
    /* 无日志文件 */
  }
  return { imported: new Set(), skipped: new Set() };
}

/** 追加导入/跳过记录（读-改-写；失败静默——不影响主流程） */
export async function writeImportLog(
  app: App,
  imported: string[],
  skipped: string[] = []
): Promise<void> {
  try {
    const log = await readImportLog(app);
    for (const n of imported) log.imported.add(n);
    for (const n of skipped) log.skipped.add(n);
    await (app.vault as any).adapter.write(
      getImportLogPath(),
      JSON.stringify({ imported: [...log.imported], skipped: [...log.skipped] }, null, 2)
    );
  } catch (e) {
    /* 日志写入失败不阻断导入 */
  }
}

/**
 * 批量导入：一次 load → 创建全部条目 → related 回填（既有 id / 本批 name→id）→ 单次 save。
 * 不走 addEntry（不触发自动复盘）；写前重载防并发覆盖。返回导入数量。
 * skippedNames：用户标记永不导入的卡片名（随导入一并持久化，重跑不再出现）。
 */
export async function runImport(
  app: App,
  selected: ClassifiedCard[],
  existing: BlackBoxData,
  skippedNames: string[] = []
): Promise<{ imported: number; data: BlackBoxData }> {
  if (!selected.length) return { imported: 0, data: existing };
  const m = new BlackBoxDataManager(app);
  const latest = await m.load();
  const existingConcepts = latest.entries.filter((e) => e.type === 'concept');
  const existingByName = new Map(existingConcepts.map((e) => [e.name, e.id]));

  // 第一遍：创建全部条目（related 暂空），记录 name→id；写入导入元信息（createdAt/category/tags/summary）
  const nameToId = new Map<string, string>();
  const created: Entry[] = [];
  for (const c of selected) {
    const entry =
      c.kind === 'literature'
        ? createEntry({
            type: 'literature',
            text: c.text,
            source: `[[${c.name}]]`,
            terms: [],
            emotions: [],
            people: [],
            createdAt: c.createdAt || undefined,
            category: c.category || undefined,
            tags: c.tags && c.tags.length ? c.tags : undefined,
            summary: c.summary || c.desc || undefined,
          })
        : createEntry({
            type: 'concept',
            name: c.name,
            definition: c.text,
            related: [],
            createdAt: c.createdAt || undefined,
            category: c.category || undefined,
            tags: c.tags && c.tags.length ? c.tags : undefined,
            summary: c.summary || c.desc || undefined,
          });
    nameToId.set(c.name, entry.id);
    created.push(entry);
  }
  // 第二遍：related 回填（既有概念 id 直接用；本批卡片名 → 新 id；未知忽略）
  for (const c of selected) {
    const e = created.find((x) => x.id === nameToId.get(c.name));
    if (!e || e.type !== 'concept') continue;
    const ids = (c.relatedNames || [])
      .map((n) => {
        if (existingByName.has(n)) return existingByName.get(n)!;
        return nameToId.get(n);
      })
      .filter((x): x is string => !!x);
    e.related = [...new Set(ids)].slice(0, 5);
  }

  latest.entries.push(...created);
  await m.save(latest);
  await writeImportLog(app, selected.map((c) => c.name), skippedNames);
  return { imported: created.length, data: latest };
}

/**
 * 文献笔记生成（literature 域，ADR-0071：AI 回迁 bz 插件侧）
 * - 视频文献（type: video，frontmatter 九键：title/tags/summary/source/date/author/sourceTitle/type/domain，
 *   正文 = 润色转录 + 视频双链——ticket 151 补回：videoPath 非空时正文尾部嵌 `![[路径]]`，
 *   ADR-0066「保留视频原件」关（keepVideo=false）时 videoPath 为 null，无视频段）
 * - 术语文献（type: term，frontmatter 五键：title/type/domain/term/date + 可选 source/sourceTitle（术语来源，ADR-0116），正文=一段百科式简介）
 * - 段落文献（type: passage，issue 309：用户粘一段文字 → AI 自动出标题 + 领域 + 整理正文；
 *   frontmatter 五键同术语结构，无 term 键，正文=原文事实的整理，不得添加原文没有的信息）
 * - 图版文献（type: image，issue 312：拖入/粘贴一张图 → AI 读图出标题 + 领域 + 解读正文；
 *   图片本体落 `<文献目录>/assets/`，正文 = 图片嵌入 + 解读，嵌入写 vault 相对全路径）
 * - 旧笔记自动补全（type 启发式 + domain AI，补过落库不重复）
 */
import { createAI } from '../core/ai';
import { withTimeout } from '../core/http';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import type { App } from 'obsidian';
import { partialStringField } from './partial-json';
import { quoteYaml, serializeTermSource, upgradeSourceLine, type TermSource } from './source';

/** 领域词表解析（逗号/顿号分隔、去空、去重）；空 → [] = AI 自由写 */
export function parseDomainList(raw: string | undefined | null): string[] {
  return [...new Set(String(raw ?? '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean))];
}

/** 文件命名清洗：Windows 非法字符 + 空白折叠 + 截断 50 + 空兜底 */
function sanitizeMdTitle(s: unknown): string {
  const t = String(s ?? '').replace(/[\\/:*?"<>|#^[\]]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 50);
  return t || '文献笔记';
}

/** 转录分块：优先句边界（。！？；）切，单块不超 maxLen；超长单句硬切 */
export function chunkTranscript(text: string, maxLen = 4000): string[] {
  const src = String(text || '').trim();
  if (!src) return [];
  const segs = src.split(/(?<=[。！？!?；;])/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  for (const seg of segs) {
    if (cur && (cur + seg).length > maxLen) { chunks.push(cur); cur = ''; }
    if (seg.length <= maxLen) { cur += seg; continue; }
    if (cur) { chunks.push(cur); cur = ''; }
    let rest = seg;
    while (rest.length > maxLen) { chunks.push(rest.slice(0, maxLen)); rest = rest.slice(maxLen); }
    cur = rest;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** AI 返回 JSON 容错解析：剥 markdown 围栏 + 残留文本提取；失败抛错带片段 */
export function parseAiJson(raw: string): any {
  const cleaned = String(raw || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* 走提取 */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* 抛错 */ } }
  throw new Error('AI 返回的不是 JSON：' + cleaned.slice(0, 120));
}

/** 流式进度快照（ADR-0152）：每次 delta 到达后回调一次，值 = 当前已能解出的字段，未到达 = null */
export interface DraftFields {
  title: string | null;
  domain: string | null;
  summary: string | null;
}

/** 草稿生成的调用方钩子（ADR-0152）：onProgress 逐字刷新预览；signal 中止在途请求（关窗 / 再点生成） */
export interface DraftHooks {
  onProgress?: (fields: DraftFields) => void;
  signal?: AbortSignal;
}

/**
 * 组装 `ai.json()` 的流式选项（ADR-0152）：core/ai 的 `onDelta` 只给「增量片段」，
 * 这里自己累积全文，每帧拿累积前缀重算三个字段——累积文本在任意时刻都是最终 JSON 的前缀，
 * 故抽取器无需状态机（见 partial-json.ts）。
 * 不传 onProgress 时不接 `onDelta`：请求退回纯非流式形态，连每帧扫描的开销都不付
 * （非流式降级路径同样没有 `onDelta` 可喂，界面契约由 UI 侧统一收口）。
 */
function draftAiOptions(hooks?: DraftHooks): { onDelta?: (delta: string) => void; signal?: AbortSignal } {
  const onProgress = hooks?.onProgress;
  let onDelta: ((delta: string) => void) | undefined;
  if (onProgress) {
    let acc = '';
    onDelta = (delta: string) => {
      acc += delta;
      onProgress({
        title: partialStringField(acc, 'title'),
        domain: partialStringField(acc, 'domain'),
        summary: partialStringField(acc, 'summary'),
      });
    };
  }
  return { onDelta, signal: hooks?.signal };
}

/**
 * 正文空值守卫（ADR-0152 决策 6）：空正文不得成为草稿——否则「半篇 / 空篇」能一路走到确认写入。
 * 与「截断」互补：JSON 被截断时 parseAiJson 先抛错，JSON 完整但正文空时由这里拦下。
 */
function requireSummary(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) throw new Error('AI 未返回正文');
  return s;
}

/** 领域判定指令：有词表从词表选（可自定义），空词表自由写 */
function domainInstruction(list: string[]): string {
  if (!list.length) return '"domain": "领域，用一个中文词"';
  return `"domain": "从以下领域选一个最贴近的：${list.join('、')}；都不贴切可写一个新的中文领域词"`;
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 单次 AI 调用超时上限（withTimeout，core/http 单源收编；ticket 138 §1.3）。
 * 底层 ai.json 无法中途取消，超时只是让调用方得以跳过该条继续整批，
 * 挂起的 AI Promise 的 settle 结果被丢弃（本条已按超时处理，不算 AI 未配置）。
 */
const BACKFILL_AI_TIMEOUT_MS = 25000;

/** 写唯一路径笔记（永不覆盖；目录不存在自动建） */
export async function writeUniqueNote(dir: string, baseName: string, content: string): Promise<string> {
  const app = getApp();
  const folder = String(dir || '文献盒').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  let path = `${folder}/${baseName}.md`;
  for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${folder}/${baseName}_${i}.md`;
  try {
    const exists = await app.vault.adapter.exists(folder);
    if (!exists) await app.vault.createFolder(folder);
  } catch { /* 目录已存在等 */ }
  await app.vault.create(path, content);
  return path;
}

/**
 * 名词重名查重（ADR-0143/issue 328，只做名词入口）：输入经 sanitizeMdTitle 清洗后与文献目录
 * 既有 md 比对——path 构造与撞名判定同 writeUniqueNote，命中的正是「不拦就会变 _2」的情况。
 * 段落 / 图版 / 影像标题由 AI 生成，刻意不查（重名由 writeUniqueNote 兜底 _2 并列）。
 * 命中返回既有路径，无重复返回 null。
 */
export function findDuplicateTermNote(term: string): string | null {
  const app = getApp();
  const s = tryGetSettings();
  const dir = String(s.knowledgeDirectory || '文献盒').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const path = `${dir}/${sanitizeMdTitle(term)}.md`;
  return app.vault.getAbstractFileByPath(path) ? path : null;
}

/**
 * 生成视频文献笔记：元数据（title/tags/summary/domain）+ 分块润色 → 九键 frontmatter 落盘；
 * videoPath 非空时正文尾部附视频双链（ADR-0066/0073「正文 = 润色 + 视频双链」，ticket 151 补回）。
 * 返回 vault 相对笔记路径。
 */
export async function generateVideoNote(opts: {
  transcript: string;
  videoTitle: string;
  url: string;
  uploader: string;
  videoPath?: string | null;
}): Promise<string> {
  const ai = createAI();
  const s = tryGetSettings();
  const list = parseDomainList(s.knowledgeDomainList);
  const chunks = chunkTranscript(opts.transcript);
  // 元数据（一次 JSON 调用：标题/标签/简介/领域）
  const metaRaw = await ai.json(
    `你是文献整理助手。基于下方 B站视频《${opts.videoTitle || '未命名'}》的转写文稿片段，生成文献笔记元数据。只输出 JSON，不要任何解释：
{"title":"15-30字的中文完整陈述句，不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢），禁止冒号、破折号、句中句号问号，需要连接时用逗号","tags":["3-6个中文标签，每个不超过5个字，涵盖主题领域、关键概念、应用场景"],"summary":"一句话简介，不超过60字",${domainInstruction(list)}}
所有字段一律使用简体中文。

【转写文稿片段】
${chunks[0] || ''}`,
  );
  const meta = parseAiJson(metaRaw);
  const title = String(meta?.title || '').trim() || opts.videoTitle || '未命名';
  const tags = Array.isArray(meta?.tags) ? meta.tags.map(String).filter(Boolean).slice(0, 6) : [];
  const summary = String(meta?.summary || '').trim();
  const domain = String(meta?.domain || '').trim();
  // 分块润色
  const polished: string[] = [];
  for (const c of chunks) {
    const p = await ai.chat(
      `你是文字编辑。把下面的视频转写文稿轻度润色为书面语：口语转书面、删除口水词与重复内容，保持原顺序、原事实（数字与专名不变）。转写可能存在语音误听，专名与术语（如火箭型号、人名、地名、专业词）若明显是误听则按上下文纠正为最合理的写法；无法确定的保持原文。输出必须是简体中文（繁体转写一律转为简体）。直接输出润色后的正文，不要解释、不要加标题、不要列表。

【转写文稿】
${c}`,
      // 输出上限走设置面板（issue 334/ADR-0148）；模型也跟随设置——历史上这里曾想私换
      // deepseek-chat 避思考，但 options.model 从未被 prompt() 读取，属无效死参数，一并拆除
    );
    polished.push(String(p || '').trim());
  }
  const whole = polished.join('');
  // 视频双链（ticket 151 补回，ADR-0066）：CLI 交付的 mp4 vault 相对路径 → 正文尾部嵌 `![[…]]`；
  // keepVideo=false（未交付）时 videoPath 为 null → 无视频段
  const videoSection = opts.videoPath
    ? `![[${String(opts.videoPath).replace(/\\/g, '/')}]]`
    : null;
  const fm = [
    '---',
    `title: ${quoteYaml(title)}`,
    'tags:',
    tags.map((t) => `  - ${quoteYaml(t)}`).join('\n'),
    `summary: ${quoteYaml(summary)}`,
    `source: ${quoteYaml(opts.url)}`,
    `date: ${quoteYaml(nowStamp())}`,
    `author: ${quoteYaml(opts.uploader)}`,
    `sourceTitle: ${quoteYaml(opts.videoTitle)}`,
    'type: video',
    `domain: ${quoteYaml(domain)}`,
    '---',
  ].join('\n');
  const body = [fm, whole, videoSection].filter(Boolean).join('\n\n');
  return writeUniqueNote(String(s.knowledgeDirectory || '文献盒'), sanitizeMdTitle(title), body);
}

/** 术语 AI 简介提示词（预览/落盘共用同一指令，领域词表一致）。
 *  字段顺序（ADR-0152 决策 10）：domain 在前、summary 在后——领域是短字段、正文是长字段，
 *  让属性区的领域行早早落值、正文随后逐字长出，与「界面立刻在位、内容依次到位」一致。 */
function termPrompt(term: string, list: string[]): string {
  return `你是百科知识整理助手。为术语「${term}」生成一篇文献笔记。只输出 JSON，不要任何解释：
{${domainInstruction(list)},"summary":"一段关于该术语的简明介绍（百科总结式，150-300字简体中文，连贯成文，涵盖定义、核心要点与必要背景）"}`;
}

/**
 * 术语 AI 预览（纯生成、不落盘，ticket 138 §2.1 契约变更）：
 * 只调 AI 返回 {summary, domain}，供术语面板预览（领域/正文纯内存可编辑）；
 * 确认写入才调 generateTermNote 落盘——预览阶段文献目录不出现任何文件。
 * hooks（ADR-0152）：onProgress 逐字刷新预览、signal 中止在途请求；不传 = 行为与旧版一致。
 */
export async function generateTermDraft(term: string, hooks?: DraftHooks): Promise<{ summary: string; domain: string }> {
  const ai = createAI();
  const s = tryGetSettings();
  const list = parseDomainList(s.knowledgeDomainList);
  const t = String(term || '').trim();
  if (!t) throw new Error('术语为空');
  const raw = await ai.json(termPrompt(t, list), draftAiOptions(hooks));
  const meta = parseAiJson(raw);
  return {
    summary: requireSummary(meta?.summary),
    domain: String(meta?.domain || '').trim(),
  };
}

/** 术语简介总结（ticket 155）：对已生成的简介做一次 AI 精简（保留定义与关键事实、压缩篇幅），返回纯文本 */
export async function summarizeTermSummary(text: string): Promise<string> {
  const ai = createAI();
  const t = String(text || '').trim();
  if (!t) throw new Error('内容为空');
  const out = await ai.chat(
    `你是文字编辑。把下面的术语介绍压缩成更精简的一段话：保留术语定义与关键事实，删除冗余表述与重复内容，长度约为原文的一半。输出必须是简体中文。直接输出结果，不要解释、不要加标题、不要列表。

【原文】
${t}`,
  );
  const s = String(out || '').trim();
  if (!s) throw new Error('AI 返回为空');
  return s;
}

/**
 * 生成术语文献笔记：frontmatter（title/type/domain/term/date + 可选 source/sourceTitle）+ 简介正文落盘。
 * 返回 vault 相对笔记路径。
 * 可选 summary/domain：传入即**跳过 AI、所见即所得**（终审 P1-4——术语面板确认写入传面板当前值，
 * 不再重跑一次 AI 造成与预览不一致、也不浪费一次调用）；不传则走 generateTermDraft（AI 生成）。
 * 可选 source：术语来源（ADR-0116）——内部笔记写原生双链 `[[路径|名]]`（Obsidian 反向链接原生可溯），
 * 外部链接写 url 原文 + 抓到的页面标题落 sourceTitle；仅记录不参与生成、不回写任何笔记。
 */
export async function generateTermNote(opts: {
  term: string;
  summary?: string;
  domain?: string;
  source?: TermSource | null;
}): Promise<string> {
  const s = tryGetSettings();
  const term = String(opts.term || '').trim();
  if (!term) throw new Error('术语为空');
  // summary 显式传入（含空串）→ 跳过 AI、所见即所得；不传 → 走 generateTermDraft 恰好一次
  let summary: string;
  let domain: string;
  if (opts.summary === undefined) {
    const draft = await generateTermDraft(term);
    summary = draft.summary;
    domain = draft.domain;
  } else {
    summary = String(opts.summary).trim();
    domain = String(opts.domain ?? '').trim();
  }
  const fm = [
    '---',
    `title: ${quoteYaml(term)}`,
    'type: term',
    `domain: ${quoteYaml(domain)}`,
    `term: ${quoteYaml(term)}`,
    `date: ${quoteYaml(nowStamp())}`,
  ];
  const src = serializeTermSource(opts.source);
  if (src) {
    fm.push(`source: ${quoteYaml(src.source)}`);
    if (src.sourceTitle) fm.push(`sourceTitle: ${quoteYaml(src.sourceTitle)}`);
  }
  fm.push('---');
  const body = [fm.join('\n'), summary].filter(Boolean).join('\n\n');
  return writeUniqueNote(String(s.knowledgeDirectory || '文献盒'), sanitizeMdTitle(term), body);
}

/** 段落 AI 整理提示词（预览/落盘共用；issue 309）。
 *  字段顺序（ADR-0152 决策 10）：domain → title → summary，短字段在前，正文最后流出。 */
function passagePrompt(text: string, list: string[]): string {
  return `你是文献整理助手。把下方这段文字整理成一篇文献笔记。只输出 JSON，不要任何解释：
{${domainInstruction(list)},"title":"15-30字的中文完整陈述句，概括这段文字在讲什么；不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢），禁止冒号、破折号、句中句号问号，需要连接时用逗号","summary":"整理后的正文（保留原文的全部事实与要点，删去口水话、重复表述，可分自然段）"}
硬约束：正文只能来自原文，不得添加原文没有的事实、数字或结论，不得写成读后感。所有字段一律使用简体中文。

【原文】
${text}`;
}

/**
 * 段落 AI 草稿（issue 309，纯生成不落盘）：一段文字 → 自动标题 + 领域 + 整理正文，
 * 供段落面板预览（三项纯内存可改）；确认写入才调 generatePassageNote 落盘。
 * 上限 30 万字拒收由面板负责，此处只做空值校验。
 * hooks（ADR-0152）：onProgress 逐字刷新预览（领域 / 标题 / 正文依次到位）、signal 中止在途请求。
 */
export async function generatePassageDraft(text: string, hooks?: DraftHooks): Promise<{ title: string; summary: string; domain: string }> {
  const ai = createAI();
  const s = tryGetSettings();
  const list = parseDomainList(s.knowledgeDomainList);
  const t = String(text || '').trim();
  if (!t) throw new Error('段落为空');
  const raw = await ai.json(passagePrompt(t, list), draftAiOptions(hooks));
  const meta = parseAiJson(raw);
  return {
    title: String(meta?.title || '').trim(),
    summary: requireSummary(meta?.summary),
    domain: String(meta?.domain || '').trim(),
  };
}

/**
 * 生成段落文献笔记（issue 309）：frontmatter（title/type: passage/domain/date + 可选 source/sourceTitle）
 * + 整理正文落盘，返回 vault 相对笔记路径。
 * 可选 summary/domain 传入即**跳过 AI、所见即所得**（同术语口径：确认写入不重跑 AI）；
 * 标题缺失时回退目录内的首句兜底命名（不阻断落盘）。
 */
export async function generatePassageNote(opts: {
  title: string;
  summary?: string;
  domain?: string;
  source?: TermSource | null;
}): Promise<string> {
  const s = tryGetSettings();
  const title = String(opts.title || '').trim();
  const summary = String(opts.summary ?? '').trim();
  if (!title && !summary) throw new Error('段落为空');
  const domain = String(opts.domain ?? '').trim();
  const fm = [
    '---',
    `title: ${quoteYaml(title || summary.slice(0, 30))}`,
    'type: passage',
    `domain: ${quoteYaml(domain)}`,
    `date: ${quoteYaml(nowStamp())}`,
  ];
  const src = serializeTermSource(opts.source);
  if (src) {
    fm.push(`source: ${quoteYaml(src.source)}`);
    if (src.sourceTitle) fm.push(`sourceTitle: ${quoteYaml(src.sourceTitle)}`);
  }
  fm.push('---');
  const body = [fm.join('\n'), summary].filter(Boolean).join('\n\n');
  return writeUniqueNote(String(s.knowledgeDirectory || '文献盒'), sanitizeMdTitle(title || summary), body);
}

// ---------- 图版（issue 312：图片 → 读图成文；图片本体与笔记同域落盘） ----------

/** 图片本体落盘目录名（文献笔记旁的 assets/：与笔记同域，删笔记不留下跨域悬挂引用） */
export const IMAGE_ASSETS_DIR = 'assets';

/** 写唯一路径二进制（永不覆盖；目录不存在自动建）——writeUniqueNote 的二进制版（issue 312） */
export async function writeUniqueBinary(dir: string, baseName: string, ext: string, bytes: ArrayBuffer): Promise<string> {
  const app = getApp();
  const folder = String(dir || '文献盒').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  let path = `${folder}/${baseName}.${ext}`;
  for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${folder}/${baseName}_${i}.${ext}`;
  try {
    const exists = await app.vault.adapter.exists(folder);
    if (!exists) await app.vault.createFolder(folder);
  } catch { /* 目录已存在等 */ }
  await app.vault.createBinary(path, bytes);
  return path;
}

/** 图版读图提示词（issue 312；多图 issue 313：一组图合成一篇；JSON 契约与名词/段落一致）。
 *  descs（ADR-0145）：已填的逐图描述作为「用户图注」节喂给模型，标题/领域/解读更贴合；
 *  按图片序号对应列出，空白描述不列，全空则不加节（既有调用不传 descs 同样无节）。 */
function imagePrompt(list: string[], count: number, descs?: string[]): string {
  const multi = count > 1;
  const scope = multi
    ? `看下面这 ${count} 张图片，把它们**作为一组**生成一篇文献笔记`
    : '看这张图片，为它生成一篇文献笔记';
  const bodyAsk = multi
    ? '对这组图的整理说明（150-300字简体中文，连贯成文）：先说这组图共同在讲什么，再按图交代各自可见的内容与信息，图中含文字则整理其要点'
    : '对这张图的整理说明（150-300字简体中文，连贯成文）：图中含文字则整理其要点，是照片、示意图或图表则客观描述其可见内容与信息';
  let prompt = `你是文献整理助手。${scope}。只输出 JSON，不要任何解释：
{${domainInstruction(list)},"title":"15-30字的中文完整陈述句，概括${multi ? '这组图' : '这张图'}在讲什么；不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢），禁止冒号、破折号、句中句号问号，需要连接时用逗号","summary":"${bodyAsk}"}
硬约束：只能写图中确实能看到的内容，不得臆测、不得补充图中没有的事实与数字、不得写成观后感。所有字段一律使用简体中文。`;
  const notes = (Array.isArray(descs) ? descs : [])
    .map((d, i) => ({ n: i + 1, d: String(d ?? '').trim() }))
    .filter((x) => x.d);
  if (notes.length) {
    prompt += `\n\n【用户图注】用户为其中部分图片写的描述，解读请贴合这些关注点：\n${notes.map((x) => `第 ${x.n} 张：${x.d}`).join('\n')}`;
  }
  return prompt;
}

/**
 * 图版 AI 草稿（issue 312，纯生成不落盘）：图片 data URL 列表（多图 issue 313）→ 自动标题 +
 * 领域 + 解读正文，供图版面板预览（三项纯内存可改）；确认写入才调 generateImageNote 落盘。
 * 可选 descs（issue 329 / ADR-0145）：与 imageUrls 按位对应的用户图注，进入「用户图注」节
 * 作为读图上下文（全空无节）。走 core/ai 的多模态通道（issue 311：content 数组 + image_url）。
 * hooks（ADR-0152）：onProgress 逐字刷新预览、signal 中止在途请求；不传 = 行为与旧版一致。
 */
export async function generateImageDraft(imageUrls: string[], descs?: string[], hooks?: DraftHooks): Promise<{ title: string; summary: string; domain: string }> {
  const ai = createAI();
  const s = tryGetSettings();
  const list = parseDomainList(s.knowledgeDomainList);
  // url 与图注成对过滤：无效 url 剔除时其图注一并剔除，保住逐位对应关系
  const pairs = (Array.isArray(imageUrls) ? imageUrls : []).map((u, i) => ({
    url: String(u || '').trim(),
    desc: String((Array.isArray(descs) ? descs[i] : '') ?? '').trim(),
  }));
  const valid = pairs.filter((p) => p.url);
  if (!valid.length) throw new Error('图片为空');
  const raw = await ai.json(
    { text: imagePrompt(list, valid.length, valid.map((p) => p.desc)), images: valid.map((p) => p.url) },
    draftAiOptions(hooks),
  );
  const meta = parseAiJson(raw);
  return {
    title: String(meta?.title || '').trim(),
    summary: requireSummary(meta?.summary),
    domain: String(meta?.domain || '').trim(),
  };
}

/** 图版图片落地目录：设置优先，留空回落到文献目录下的 assets/（issue 313） */
export function resolveImageDir(settings: { knowledgeImageFolder?: string; knowledgeDirectory?: string }): string {
  const configured = String(settings?.knowledgeImageFolder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (configured) return configured;
  const dir = String(settings?.knowledgeDirectory || '文献盒').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || '文献盒';
  return `${dir}/${IMAGE_ASSETS_DIR}`;
}

/**
 * 生成图版文献笔记（issue 312；多图与目录可配见 issue 313）：**先把图片本体逐张写进
 * 图片目录**（默认 `<文献目录>/assets/`，可用设置 `knowledgeImageFolder` 改；文件名取最终标题、
 * 永不覆盖），再写笔记（frontmatter title/type: image/domain/date + 可选 source/sourceTitle；
 * 正文 = **先文字后图片**——读图解读在上、图片嵌入在下）。
 * 图片行语法分叉（ADR-0145）：该张有描述 → `![[路径|描述]]`，无描述 → `![[路径]]`，多图逐张
 * 对应；描述唯一载体是正文图片语法，**不设 frontmatter 键**。
 * 嵌入用全路径而非裸文件名：库里同名图很常见，裸名会指错。返回笔记路径。
 */
export async function generateImageNote(opts: {
  title: string;
  summary?: string;
  domain?: string;
  /** 图片本体列表（确认写入时才落盘；面板内的 data URL 只用于预览与投喂 AI）；desc = 该张用户图注（可选，ADR-0145） */
  images: Array<{ bytes: ArrayBuffer; ext: string; desc?: string }>;
  source?: TermSource | null;
}): Promise<string> {
  const s = tryGetSettings();
  const title = String(opts.title || '').trim();
  const summary = String(opts.summary ?? '').trim();
  if (!title && !summary) throw new Error('图版为空');
  const images = (Array.isArray(opts.images) ? opts.images : []).filter((im) => im && im.bytes);
  if (!images.length) throw new Error('图版没有图片');
  const dir = String(s.knowledgeDirectory || '文献盒');
  const name = sanitizeMdTitle(title || summary.slice(0, 30));
  const imageRoot = resolveImageDir(s);
  const imagePaths: string[] = [];
  for (const im of images) imagePaths.push(await writeUniqueBinary(imageRoot, name, im.ext || 'png', im.bytes));
  const domain = String(opts.domain ?? '').trim();
  const fm = [
    '---',
    `title: ${quoteYaml(title || name)}`,
    'type: image',
    `domain: ${quoteYaml(domain)}`,
    `date: ${quoteYaml(nowStamp())}`,
  ];
  const src = serializeTermSource(opts.source);
  if (src) {
    fm.push(`source: ${quoteYaml(src.source)}`);
    if (src.sourceTitle) fm.push(`sourceTitle: ${quoteYaml(src.sourceTitle)}`);
  }
  fm.push('---');
  // 文字在上、图片在下（issue 313 用户拍板）；图片行按有无描述分叉（ADR-0145）
  const imageLines = imagePaths.map((p, i) => {
    const desc = String(images[i]?.desc ?? '').trim();
    // 描述含 `]]` 会把嵌入语法提前闭合（别名截断、残文落正文）——插空格降级（issue 329 评审）
    return desc ? `![[${p}|${String(desc).replace(/\]\]/g, '] ]')}]]` : `![[${p}]]`;
  });
  const body = [fm.join('\n'), summary, ...imageLines].filter(Boolean).join('\n\n');
  return writeUniqueNote(dir, name, body);
}

/**
 * source 升级 · 文件半边（issue 329 / ADR-0144 §5「保存物化回写」；index.ts 跨域门面转发至此）：
 * 读目标笔记 → source.ts 的 upgradeSourceLine 做行级改写 → 写回。落位 note-gen 的口径：
 * 与 generate* 落盘同属「文献/笔记类用户文档写」（一次性读写，无竞态面）。
 * 返回 true = 已是内部形态（幂等，零写盘）或改写写盘成功；文件缺失 / 读失败 / 无可升级的
 * source（无 frontmatter、无 source 行、既非内部也非外链）返回 false 静默。
 */
export async function upgradeNoteSourceInFile(app: App, notePath: string, internalLink: string): Promise<boolean> {
  const path = String(notePath || '').trim();
  const link = String(internalLink || '').trim();
  if (!path || !link) return false;
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || (file as any).isFolder) return false; // 缺文件：静默
  let content: string;
  try {
    content = await app.vault.read(file as any);
  } catch {
    return false;
  }
  const upgraded = upgradeSourceLine(content, link);
  if (upgraded === null) return false; // 无 frontmatter / 无 source / 既非内部也非外链
  if (upgraded !== content) await app.vault.modify(file as any, upgraded);
  return true;
}

// ---------- 旧笔记自动补全（type 启发式 + domain AI） ----------
/** 轻量解析 frontmatter（仅取键值字符串；P3-3：value 剥一层引号，避免 `type: "video"` 判定为缺 type 重复注入） */
export function parseFrontmatter(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const m = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z\u4e00-\u9fa5_]+):\s*(.*)$/);
    if (kv) {
      const raw = String(kv[2] ?? '').trim();
      const quoted = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));
      out[kv[1].trim()] = quoted ? raw.slice(1, -1) : raw;
    }
  }
  return out;
}

/** 向 frontmatter 追加键值（保持引号包裹风格；无 frontmatter 则前置创建） */
export function injectFrontmatter(content: string, entries: string[]): string {
  const head = entries.map((kv) => {
    const [k, ...rest] = kv.split(':');
    const v = rest.join(':').trim();
    return `${k}: ${quoteYaml(v.replace(/^"(.*)"$/, '$1'))}`;
  }).join('\n');
  const m = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (m) return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${m[1]}\n${head}\n---`);
  return `---\n${head}\n---\n\n${content || ''}`;
}

/**
 * 存量键迁移（2026-09-16 统一来源，用户拍板）：视频文献的 `url` → `source`、
 * `videoTitle` → `sourceTitle`——四类文献的「出处」从此只有一个名字。
 * 手术边界：只动 frontmatter 里这两行，其余键与正文零扰动；换行符保真；幂等。
 * 已有同名目标键时不改名，**绝不造出重复键**。
 * 无 frontmatter / 两个键都没有 → 原样返回（调用方据此跳过写盘）。导出供单测直接断言。
 */
export function migrateVideoSourceKeys(content: string): string {
  const src = String(content ?? '');
  const lines = src.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return src;
  let close = -1;
  for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === '---') { close = i; break; } }
  if (close === -1) return src;
  let sourceAt = -1, sourceTitleAt = -1, urlAt = -1, videoTitleAt = -1;
  for (let i = 1; i < close; i++) {
    if (/^source:/.test(lines[i])) sourceAt = i;
    else if (/^sourceTitle:/.test(lines[i])) sourceTitleAt = i;
    else if (/^url:/.test(lines[i])) urlAt = i;
    else if (/^videoTitle:/.test(lines[i])) videoTitleAt = i;
  }
  let hit = false;
  // 保留原行的空格与引号包裹风格：只换键名，值原样搬过去
  if (urlAt >= 0 && sourceAt < 0) { lines[urlAt] = 'source:' + lines[urlAt].slice('url:'.length); hit = true; }
  if (videoTitleAt >= 0 && sourceTitleAt < 0) {
    lines[videoTitleAt] = 'sourceTitle:' + lines[videoTitleAt].slice('videoTitle:'.length);
    hit = true;
  }
  if (!hit) return src;
  return lines.join(src.includes('\r\n') ? '\r\n' : '\n');
}

/**
 * 旧笔记自动补全：type 用启发式（有 author → video；有 term → term），
 * domain 用 AI 分类；补过落库不再重复；AI 未配置跳过。返回 {scanned, filled, aiSkipped}。
 * ticket 138 §1.3：单次 AI 调用带超时（默认 25s），超时/失败即跳过该条继续，不卡死整批；
 * aiTimeoutMs 供测试注入短超时。
 * P1-2：domain 写回前对每条现读最新内容（type 启发式补丁可能已写盘），
 * 避免用读入时的旧 content 整体覆盖回滚 type 补丁；P3-3 由 parseFrontmatter 剥引号兜底。
 * 2026-09-16：入口先跑一次存量键迁移（见 migrateVideoSourceKeys）——必须排在
 * 「已补全即跳过」之前，否则已有 type+domain 的存量笔记永远轮不到迁移。
 */
export async function backfillNotes(opts: { aiTimeoutMs?: number } = {}): Promise<{ scanned: number; filled: number; aiSkipped: boolean }> {
  const app = getApp();
  const s = tryGetSettings();
  const aiTimeoutMs = opts.aiTimeoutMs ?? BACKFILL_AI_TIMEOUT_MS;
  const dir = String(s.knowledgeDirectory || '文献盒').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const files = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(dir + '/') && f.path.endsWith('.md'));
  const needDomain: { file: any }[] = [];
  let filled = 0;
  for (const f of files) {
    let content = await app.vault.read(f);
    // 存量键迁移先做（排在「已补全即跳过」之前）：否则已有 type+domain 的存量笔记永远轮不到迁移
    const migrated = migrateVideoSourceKeys(content);
    if (migrated !== content) {
      await app.vault.modify(f, migrated);
      content = migrated;
      filled++;
    }
    const fm = parseFrontmatter(content);
    const hasType = fm.type === 'video' || fm.type === 'term';
    const hasDomain = !!fm.domain;
    if (hasType && hasDomain) continue; // 已补全（含引号包裹值，parse 已剥引号）
    const patch: string[] = [];
    if (!hasType) {
      // video 判据改用 author（UP 主，四类里只有视频文献有）：url / videoTitle 已并入
      // source / sourceTitle（统一来源），而 source 是术语/段落/图版共用的键，不能当判据。
      const type = fm.author ? 'video' : fm.term ? 'term' : '';
      if (type) patch.push(`type:${type}`);
    }
    // domain 补全队列入列时只记 file——domain 写回时现读补丁后的最新内容
    if (!hasDomain) needDomain.push({ file: f });
    if (patch.length) {
      const updated = injectFrontmatter(content, patch);
      if (updated !== content) { await app.vault.modify(f, updated); filled++; }
    }
  }
  // AI 补 domain（逐个带超时；AI 未配置 → 跳过并标记）
  let aiSkipped = false;
  if (needDomain.length) {
    // createAI 不因缺 key 抛错；未配置在 ai.json() 时才抛（getAIProvider），由内层 catch 的
    // /API Key|AI 配置/ 识别为整体跳过（aiSkipped），单条失败/超时静默不阻塞。
    const ai = createAI();
    const list = parseDomainList(s.knowledgeDomainList);
    for (const { file } of needDomain) {
      try {
        // P1-2：现读最新内容（type 启发式补丁已写盘），domain 注入不会回滚 type
        const latest = await app.vault.read(file);
        const sample = latest.replace(/^---[\s\S]*?---/, '').slice(0, 2000);
        const raw = await withTimeout(
          ai.json(
            `请判断下面这段文字所属的领域（${domainInstruction(list)}）。只输出 JSON：{"domain":"<领域词>"}\n\n【文本】\n${sample}`,
          ),
          aiTimeoutMs,
          '领域判定',
        );
        const domain = String(parseAiJson(raw)?.domain || '').trim();
        if (domain) {
          await app.vault.modify(file, injectFrontmatter(latest, [`domain:${domain}`]));
          filled++;
        }
      } catch (e: any) {
        // 单条失败（含 AI 未配置/超时）静默跳过，继续下一条；未配置整体标记
        if (/API Key|AI 配置/.test(String(e?.message || ''))) aiSkipped = true;
      }
    }
  }
  return { scanned: files.length, filled, aiSkipped };
}

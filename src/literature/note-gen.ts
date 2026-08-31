/**
 * 文献笔记生成（literature 域，ADR-0071：AI 回迁 bz 插件侧）
 * - 视频文献（type: video，frontmatter 九键：title/tags/summary/url/date/author/videoTitle/type/domain，
 *   正文 = 润色转录 + 视频双链——ticket 151 补回：videoPath 非空时正文尾部嵌 `![[路径]]`，
 *   ADR-0066「保留视频原件」关（keepVideo=false）时 videoPath 为 null，无视频段）
 * - 术语文献（type: term，frontmatter 五键：title/type/domain/term/date，正文=一段百科式简介）
 * - 旧笔记自动补全（type 启发式 + domain AI，补过落库不重复）
 */
import { createAI } from '../core/ai';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';

/** 领域词表解析（逗号/顿号分隔、去空、去重）；空 → [] = AI 自由写 */
export function parseDomainList(raw: string | undefined | null): string[] {
  return [...new Set(String(raw ?? '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean))];
}

/** frontmatter 引号包裹（对齐 auto-summary YAML 风格，防冒号/引号破坏结构） */
function quoteYaml(s: unknown): string {
  return '"' + String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
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

/** 领域判定指令：有词表从词表选（可自定义），空词表自由写 */
function domainInstruction(list: string[]): string {
  if (!list.length) return '"domain": "领域，用一个中文词（如 物理/医学/心理/计算机/经济/文史哲 等）"';
  return `"domain": "从以下领域选一个最贴近的：${list.join('、')}；都不贴切可写一个新的中文领域词"`;
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 单次 AI 调用超时上限（Promise.race；ticket 138 §1.3）。
 * 底层 ai.json 无法中途取消，超时只是让调用方得以跳过该条继续整批，
 * 挂起的 AI Promise 的 settle 结果被丢弃（本条已按超时处理，不算 AI 未配置）。
 */
const BACKFILL_AI_TIMEOUT_MS = 25000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI 请求超时（${label}，${ms}ms）`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

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
  const list = parseDomainList(s.literatureDomainList);
  const chunks = chunkTranscript(opts.transcript);
  // 元数据（一次 JSON 调用：标题/标签/简介/领域）
  const metaRaw = await ai.json(
    `你是文献整理助手。基于下方 B站视频《${opts.videoTitle || '未命名'}》的转写文稿片段，生成文献笔记元数据。只输出 JSON，不要任何解释：
{"title":"15-30字的中文完整陈述句或疑问句，禁止冒号、破折号、句中句号问号，需要连接时用逗号","tags":["3-6个中文标签，每个不超过5个字，涵盖主题领域、关键概念、应用场景"],"summary":"一句话简介，不超过60字",${domainInstruction(list)}}
所有字段一律使用简体中文。

【转写文稿片段】
${chunks[0] || ''}`,
    { modelOptions: { max_tokens: 600 } },
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
      // deepseek-v4-flash（带思考）长文润色时 reasoning_content 会吃光 max_tokens 导致 content 空串
      // （ticket 复现：finish_reason=length、content=''）；deepseek-chat 无思考、输出直达 content，稳
      { model: 'deepseek-chat', modelOptions: { max_tokens: 8192 } },
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
    `url: ${quoteYaml(opts.url)}`,
    `date: ${quoteYaml(nowStamp())}`,
    `author: ${quoteYaml(opts.uploader)}`,
    `videoTitle: ${quoteYaml(opts.videoTitle)}`,
    'type: video',
    `domain: ${quoteYaml(domain)}`,
    '---',
  ].join('\n');
  const body = [fm, whole, videoSection].filter(Boolean).join('\n\n');
  return writeUniqueNote(String(s.literatureDirectory || '文献盒'), sanitizeMdTitle(title), body);
}

/** 术语 AI 简介提示词（预览/落盘共用同一指令，领域词表一致） */
function termPrompt(term: string, list: string[]): string {
  return `你是百科知识整理助手。为术语「${term}」生成一篇文献笔记。只输出 JSON，不要任何解释：
{"summary":"一段关于该术语的简明介绍（百科总结式，150-300字简体中文，连贯成文，涵盖定义、核心要点与必要背景）","domain": ${domainInstruction(list)}}`;
}

/**
 * 术语 AI 预览（纯生成、不落盘，ticket 138 §2.1 契约变更）：
 * 只调 AI 返回 {summary, domain}，供术语面板预览（领域/正文纯内存可编辑）；
 * 确认写入才调 generateTermNote 落盘——预览阶段文献目录不出现任何文件。
 */
export async function generateTermDraft(term: string): Promise<{ summary: string; domain: string }> {
  const ai = createAI();
  const s = tryGetSettings();
  const list = parseDomainList(s.literatureDomainList);
  const t = String(term || '').trim();
  if (!t) throw new Error('术语为空');
  const raw = await ai.json(termPrompt(t, list));
  const meta = parseAiJson(raw);
  return {
    summary: String(meta?.summary || '').trim(),
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
    { modelOptions: { max_tokens: 1024 } },
  );
  const s = String(out || '').trim();
  if (!s) throw new Error('AI 返回为空');
  return s;
}

/**
 * 生成术语文献笔记：五键 frontmatter（title/type/domain/term/date）+ 简介正文落盘。返回 vault 相对笔记路径。
 * 可选 summary/domain：传入即**跳过 AI、所见即所得**（终审 P1-4——术语面板确认写入传面板当前值，
 * 不再重跑一次 AI 造成与预览不一致、也不浪费一次调用）；不传则走 generateTermDraft（AI 生成）。
 */
export async function generateTermNote(opts: { term: string; summary?: string; domain?: string }): Promise<string> {
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
    '---',
  ].join('\n');
  const body = [fm, summary].filter(Boolean).join('\n\n');
  return writeUniqueNote(String(s.literatureDirectory || '文献盒'), sanitizeMdTitle(term), body);
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
 * 旧笔记自动补全：type 用启发式（有 url/author/videoTitle → video；有 term → term），
 * domain 用 AI 分类；补过落库不再重复；AI 未配置跳过。返回 {scanned, filled, aiSkipped}。
 * ticket 138 §1.3：单次 AI 调用带超时（默认 25s），超时/失败即跳过该条继续，不卡死整批；
 * aiTimeoutMs 供测试注入短超时。
 * P1-2：domain 写回前对每条现读最新内容（type 启发式补丁可能已写盘），
 * 避免用读入时的旧 content 整体覆盖回滚 type 补丁；P3-3 由 parseFrontmatter 剥引号兜底。
 */
export async function backfillNotes(opts: { aiTimeoutMs?: number } = {}): Promise<{ scanned: number; filled: number; aiSkipped: boolean }> {
  const app = getApp();
  const s = tryGetSettings();
  const aiTimeoutMs = opts.aiTimeoutMs ?? BACKFILL_AI_TIMEOUT_MS;
  const dir = String(s.literatureDirectory || '文献盒').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const files = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(dir + '/') && f.path.endsWith('.md'));
  const needDomain: { file: any }[] = [];
  let filled = 0;
  for (const f of files) {
    const content = await app.vault.read(f);
    const fm = parseFrontmatter(content);
    const hasType = fm.type === 'video' || fm.type === 'term';
    const hasDomain = !!fm.domain;
    if (hasType && hasDomain) continue; // 已补全（含引号包裹值，parse 已剥引号）
    const patch: string[] = [];
    if (!hasType) {
      const type = (fm.url || fm.author || fm.videoTitle) ? 'video' : fm.term ? 'term' : '';
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
    const list = parseDomainList(s.literatureDomainList);
    for (const { file } of needDomain) {
      try {
        // P1-2：现读最新内容（type 启发式补丁已写盘），domain 注入不会回滚 type
        const latest = await app.vault.read(file);
        const sample = latest.replace(/^---[\s\S]*?---/, '').slice(0, 2000);
        const raw = await withTimeout(
          ai.json(
            `请判断下面这段文字所属的领域（${domainInstruction(list)}）。只输出 JSON：{"domain":"<领域词>"}\n\n【文本】\n${sample}`,
            { modelOptions: { max_tokens: 80 } },
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

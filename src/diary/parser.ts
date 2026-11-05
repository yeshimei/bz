/**
 * 日记本（diary）域解析层——原回忆墙升格正名（ADR-0115；ADR-0130 条目文件格式）
 *
 * - parseEntryFile（条目文件，纯函数：frontmatter `date`+`type`，日期时间损坏从题目降级）；
 * - parseMovieFile / parseLetterFile（影视/信，读 frontmatter；信的时间段来自 frontmatter `date`）；
 * - parseBookFile（书库，读 completionDate/readingDate/title/bookReview/cover）。
 * 时分口径（A1，ADR-0157 补记）：ctime/mtime 推导已整体退役——信件用结构化时间
 * （frontmatter `date` 的 HH:mm 半段），影视/书在对端域补结构化时间前回落固定 `00:00`
 * （展示 00:00 比随复制/迁移漂移的 ctime 诚实）。
 * 特殊文件解析所需的 getFileFrontmatter 以 app 参数注入（不 import ../diary/app，自包含）。
 * moment 来自 'obsidian'（测试 alias 已替换为 moment）。
 */
import { moment } from 'obsidian';
import { parseDiaryEntryFile, resolveDiaryEntryMeta } from '../core/diary-format';
import { getTagEmoji } from './config';
import type { DiaryEntry } from './types';

/** 加密条目：内容含 🔐 的条目在列表中隐藏，但保留在数据映射中防止写入丢失 */
export function isEncryptedEntry(entry: DiaryEntry): boolean {
  return typeof entry.content === 'string' && entry.content.includes('🔐');
}

/**
 * 解析一篇条目文件为一个 DiaryEntry（ADR-0130：一目一文件）。
 * - 日期时间：frontmatter `date` 优先；损坏/缺失时从题目优雅降级（`YYMMDDHHmm(-N)`）；
 * - 标签：frontmatter `type`（标签名列表）；空缺回退 ['日记']；emoji 由标签派生（emoji 表只服务展示）；
 * - 正文：frontmatter 之后的原文（无一级标题概念）；
 * - filename/filePath = 完整 vault 路径，lineNumber 恒 0（行号定位随条目文件化退场）；
 * - id = `makeEntryId('diary', …)`（与影视/信/书同口径）：书页 UI 按 `data-eid` 定位条目，
 *   条目没有 id 会全部塌成 `data-eid=""`；
 * - 文件名非条目形状或日期非法且 frontmatter 不可信 → null（守卫拒写/加载跳过）。
 */
export function parseEntryFile(content: string, filePath: string): DiaryEntry | null {
  const parsed = parseDiaryEntryFile(content);
  // 降级唯一入口：属性不可信时日期与时间从题目（YYMMDDHHmm）完整还原
  const meta = resolveDiaryEntryMeta(filePath, parsed);
  if (!meta) return null;
  const [h = 0, min = 0] = meta.time.split(':').map(Number);
  const tags = parsed.tags.length > 0 ? parsed.tags : ['日记'];
  return {
    date: meta.date,
    time: meta.time,
    timeValue: h * 100 + min,
    tags,
    emoji: tags.map((tag) => getTagEmoji(tag)).join(''),
    content: parsed.body.trim(),
    filename: filePath,
    filePath,
    lineNumber: 0,
    /* 稳定 id：书页 UI（ADR-0230）按 `data-eid` 定位条目（便签菜单 / 撕页 / 明信片展信），
       没有 id 时所有日记条目都塌成 `data-eid=""`——右键哪一篇都会落到最后一篇上。
       与影视/信/书同一套 `makeEntryId` 口径（一目一文件，路径即唯一）。 */
    id: makeEntryId('diary', { path: filePath }, meta.date),
  };
}

/** 获取文件 frontmatter（无则返回 null）；app 由调用方注入（不依赖 diary/app 单例） */
function getFileFrontmatter(file: any, app: any): Record<string, any> | null {
  const cache = app.metadataCache.getFileCache(file);
  return cache && cache.frontmatter ? cache.frontmatter : null;
}

/** 影视/书条目过渡口径的固定时分（A1）：无结构化时间来源，回落 00:00 而非 ctime 推导 */
const FALLBACK_TIME = '00:00';
const FALLBACK_TIME_VALUE = 0;

/** 生成特殊文件条目的稳定 id */
function makeEntryId(prefix: string, file: any, dateStr: string): string {
  return `${prefix}-${file.path.replace(/\//g, '-')}-${dateStr}`;
}

/** 取 frontmatter 里非空的标量项（ADR-0230：票根/藏书票的展示余项）。
 *  **键名原样保留**（`豆瓣评分`/`导演`/…），不另造一套词；空白与缺失一律不收。 */
function pickFmStrings(fm: any, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = fm?.[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) out[k] = s;
  }
  return out;
}

/**
 * frontmatter 的日期值先摊成文本再判。宿主的 YAML 可能把裸日期直接解析成时间戳对象
 * （影院域为此专门给日期加引号，见 `src/cinema/recommend.ts` 的注），`moment(Date, 格式, true)`
 * 对这类输入是**忽略格式、按原生日期**解析的——所以老写法能吃下对象，纯正则吃不下。
 * 这里先摊平，别让「改宽了」反而丢掉一条以前能进的条目。
 */
function dateTextOf(raw: unknown): string {
  if (raw instanceof Date) {
    const d = new Date(raw.getTime()); // 用本地年月日：`toISOString()` 会把东八区的日子退前一天
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (raw && typeof raw === 'object' && typeof (raw as { format?: unknown }).format === 'function') {
    return String((raw as { format: (f: string) => string }).format('YYYY-MM-DD'));
  }
  return String(raw ?? '').trim();
}

/**
 * 影视条目「观影日期」→ `YYYY-MM-DD`（非法返回 null）。
 *
 * 影院域落盘的是**带时分的排序戳** `2026-10-25 14:34:43`（个别旧档是 ISO 的 `T` 形态），
 * 少数更旧的档才是纯日期 `2026-10-25`。日记这边原先按 `'YYYY-MM-DD'` **严格**解析，
 * 于是只要带时分就判非法 → 整条被跳过（真库 828 篇里被吞掉 9 篇，最新一篇正是
 * 《我的团长我的团》：`观影日期: 2026-10-25 14:34:43`）。
 *
 * 只取**日期段**再交 `moment` 严格校验：时分在日记里不显示（`render.sealHTML` 的时辰只给
 * 日记/信），取进来也只是给一个会在条头上被藏掉的占位值。
 * 类型不设限——电影/纪录片/电视剧/动漫/国产剧…只要有影评就进册子。
 */
function movieDateOf(raw: unknown): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(dateTextOf(raw));
  if (!m) return null;
  const d = moment(m[1], 'YYYY-MM-DD', true);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

/**
 * 解析影视文件，生成一个日记条目（每个文件对应一个条目）
 * - 必须有影评且非空、观影日期合法，否则返回 null（跳过）；
 * - 标签按 frontmatter tags 归类（电影/纪录片/电视剧/动漫），content = 影评 + `![[海报]]` + #文件名；
 * - filename 为完整 vault 路径（UI 跳转依据）。
 */
export async function parseMovieFile(file: any, app: any): Promise<DiaryEntry | null> {
  try {
    const fm = getFileFrontmatter(file, app);
    if (!fm) return null;

    // 必须有影评且非空
    let review = fm['影评'];
    if (!review || review.trim() === '') return null;

    // 观影日期（纯日期与带时分都收，见 movieDateOf）
    const dateStr = movieDateOf(fm['观影日期']);
    if (!dateStr) return null;

    let poster = fm['海报'];

    // 时分（A1）：无结构化时间来源，回落固定 00:00（不再用 ctime 推导，见文件头注释）
    const timeStr = FALLBACK_TIME;
    const timeValue = FALLBACK_TIME_VALUE;

    // 解析标签
    let rawTag = '';
    if (fm.tags && Array.isArray(fm.tags) && fm.tags.length > 0) {
      rawTag = fm.tags[0];
    } else if (fm.tags && typeof fm.tags === 'string') {
      rawTag = fm.tags;
    }
    let mainTag = '日记';
    if (rawTag === '电影') mainTag = '电影';
    else if (rawTag === '纪录片') mainTag = '纪录片';
    else if (rawTag.endsWith('剧')) mainTag = '电视剧';
    else if (rawTag.endsWith('漫')) mainTag = '动漫';
    else if (rawTag === '电视剧') mainTag = '电视剧';
    else if (rawTag === '动漫') mainTag = '动漫';

    // 构建内容：影评 + 空行 + #《文件名》
    // D12：无海报（或空白）跳过 `![[海报]]` 拼接——`![[undefined]]` 会拼出幽灵媒体格
    //（统计多计一次媒体、灯箱步进黑屏）
    const fileNameWithoutExt = file.basename;
    let content = review.trim();
    if (poster && String(poster).trim() !== '') {
      content += `\n\n![[${String(poster).trim()}]]`;
    }
    content += `\n\n#${fileNameWithoutExt}`;

    // 生成日记条目
    return {
      date: dateStr,
      time: timeStr,
      timeValue: timeValue,
      tags: [mainTag],
      emoji: getTagEmoji(mainTag),
      content: content,
      filename: file.path,
      lineNumber: 0,
      id: makeEntryId('movie', file, dateStr),
      // ADR-0230：票根渲染要的余项（content 里被压平丢掉的那部分 FM）
      extra: {
        title: fileNameWithoutExt.replace(/^《/, '').replace(/》$/, ''),
        review: review.trim(),
        poster: poster && String(poster).trim() !== '' ? String(poster).trim() : undefined,
        meta: pickFmStrings(fm, ['豆瓣评分', '导演', '类型', '片长', '上映日期']),
      },
    };
  } catch (err) {
    console.error(`解析影视文件失败 ${file.path}:`, err);
    return null;
  }
}

/**
 * 解析信文件，生成一个日记条目（每个文件对应一个条目）
 * - readonly=true 或缺少有效 date 返回 null（跳过）；
 * - content = `**标题**` + 正文（正文去掉 frontmatter）；
 * - filename 为完整 vault 路径（UI 跳转依据）。
 */
export async function parseLetterFile(file: any, app: any): Promise<DiaryEntry | null> {
  try {
    const fm = getFileFrontmatter(file, app);
    if (!fm) return null;

    // 如果 readonly 为 true，忽略
    if (fm.readonly === true) return null;

    // 解析 date（支持 "YYYY-MM-DD" 或 "YYYY-MM-DD HH:mm"）
    let dateStr = fm.date;
    if (!dateStr) return null;

    let parsed = moment(dateStr, ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm'], true);
    if (!parsed.isValid()) {
      parsed = moment(dateStr);
      if (!parsed.isValid()) return null;
    }
    const dateFormatted = parsed.format('YYYY-MM-DD');
    // 时分（A1）：frontmatter `date` 的时间半段（`YYYY-MM-DD HH:mm` 形态）——结构化来源；
    // 纯日期形态解析出 00:00，与影视/书的固定回落同口径（不再用 ctime 补时分）
    const timeStr = parsed.format('HH:mm');
    const timeValue = parseInt(parsed.format('HHmm'), 10);

    // 读取文件内容，提取正文（去掉 frontmatter）
    const fullContent = await app.vault.read(file);
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = fullContent.match(frontmatterRegex);
    let body = fullContent;
    if (match) {
      body = fullContent.slice(match[0].length);
    }
    body = body.trim();

    // 标题（不含扩展名）
    const title = file.basename;
    // 构建内容：标题（不带《》） + 空行 + 正文
    const entryContent = `**${title}**\n\n${body}`.trim();

    return {
      date: dateFormatted,
      time: timeStr,
      timeValue: timeValue,
      tags: ['信'],
      emoji: getTagEmoji('信'),
      content: entryContent,
      filename: file.path,
      lineNumber: 0,
      id: makeEntryId('letter', file, dateFormatted),
    };
  } catch (err) {
    console.error(`解析信文件失败 ${file.path}:`, err);
    return null;
  }
}

/**
 * 解析书文件（书库/*.md），生成一个日记条目（每个文件对应一个条目）
 * - 日期：**只认 `completionDate`（读完）**，缺失或非法返回 null（跳过）；`readingDate` 不再兜底
 *   ——用户 2026-11-05：「当书库中有读完并且有书评的书时，也会放到日记本当中」；
 * - 必须有书评且非空（bookReview），否则返回 null 跳过（用户要求「书只获取有书评的」，与影视影评同语义）；
 * - title：frontmatter title，缺省回退文件名（不含扩展名）；
 * - content = `**《title》**` + 空行 + bookReview；
 * - cover 拼进 content（`![[cover]]`），由数据层 extractMedia 提取为媒体；
 * - tag=['书']，emoji=getTagEmoji('书')；filename 为完整 vault 路径；id=makeEntryId('book',...)；
 * - 时分回落固定 00:00（与影视同口径，A1；用于同日混排，对端书库域补结构化时间前的过渡）。
 */
export async function parseBookFile(file: any, app: any): Promise<DiaryEntry | null> {
  try {
    const fm = getFileFrontmatter(file, app);
    if (!fm) return null;

    // 必须有书评且非空（与影视影评同口径：无书评不进入回忆墙）
    const review = fm.bookReview;
    if (!review || String(review).trim() === '') return null;

    // 必须读完：只认 completionDate（与书库 `status === '已读'` 同判据）；
    // 只有 readingDate 的在读/弃读不进册——用户 2026-11-05：「读完并且有书评」
    const completed = fm.completionDate;
    if (!completed || !moment(completed, 'YYYY-MM-DD', true).isValid()) return null;
    const dateStr = moment(completed).format('YYYY-MM-DD');

    // 标题：frontmatter title 优先，缺省回退文件名
    const title = (fm.title && String(fm.title).trim() !== '' ? String(fm.title).trim() : null) || file.basename;

    // 正文：`**《title》**` + bookReview
    let content = `**《${title}》**`;
    if (review && String(review).trim() !== '') {
      content += `\n\n${String(review).trim()}`;
    }

    // 封面：拼 `![[cover]]` 进 content（extractMedia 才能提取）；cover 可能带路径（如 CONFIG/BOOK/xx/cover.jpeg）
    const cover = fm.cover;
    if (cover && String(cover).trim() !== '') {
      content += `\n\n![[${String(cover).trim()}]]`;
    }

    // 时分（A1）：无结构化时间来源，回落固定 00:00（不再用 ctime 推导，见文件头注释）
    const timeStr = FALLBACK_TIME;
    const timeValue = FALLBACK_TIME_VALUE;

    return {
      date: dateStr,
      time: timeStr,
      timeValue: timeValue,
      tags: ['书'],
      emoji: getTagEmoji('书'),
      content: content,
      filename: file.path,
      lineNumber: 0,
      id: makeEntryId('book', file, dateStr),
      // ADR-0230：藏书票渲染要的余项（content 里被压平丢掉的那部分 FM）
      extra: {
        title,
        review: String(review).trim(),
        cover: cover && String(cover).trim() !== '' ? String(cover).trim() : undefined,
        author: fm.author && String(fm.author).trim() ? String(fm.author).trim() : undefined,
        category: fm.category && String(fm.category).trim() ? String(fm.category).trim() : undefined,
        publisher: fm.publisher && String(fm.publisher).trim() ? String(fm.publisher).trim() : undefined,
        pages:
          fm.pages !== undefined && fm.pages !== null && String(fm.pages).trim()
            ? String(fm.pages).trim()
            : undefined,
        readingTime:
          fm.readingTimeFormat && String(fm.readingTimeFormat).trim()
            ? String(fm.readingTimeFormat).trim()
            : undefined,
      },
    };
  } catch (err) {
    console.error(`解析书文件失败 ${file.path}:`, err);
    return null;
  }
}

// ===== 自然语言时间解析（issue 256 随写链路自旧 diary/parser 迁入） =====

/** 解析自然语言日期时间；失败返回 null */
export function parseNaturalTime(input: string): any {
  if (!input) return null;
  const now = moment();
  const lower = input.toLowerCase().trim();

  const relMatch = lower.match(/^(\d+)\s*(分钟?|小时?|天|秒)前$/);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    if (unit.startsWith('分')) return now.clone().subtract(num, 'minutes');
    if (unit.startsWith('小')) return now.clone().subtract(num, 'hours');
    if (unit === '天') return now.clone().subtract(num, 'days');
    if (unit === '秒') return now.clone().subtract(num, 'seconds');
  }

  const yesterdayMatch = lower.match(/^昨天\s*(\d{1,2}:\d{2})$/);
  if (yesterdayMatch) {
    const time = yesterdayMatch[1];
    const yesterday = now.clone().subtract(1, 'days');
    return moment(`${yesterday.format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm', true);
  }

  const beforeYesterdayMatch = lower.match(/^前天\s*(\d{1,2}:\d{2})$/);
  if (beforeYesterdayMatch) {
    const time = beforeYesterdayMatch[1];
    const before = now.clone().subtract(2, 'days');
    return moment(`${before.format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm', true);
  }

  const std = moment(input, 'YYYY-MM-DD HH:mm', true);
  if (std.isValid()) return std;
  return null;
}

/** 自然语言时间优先，失败回退严格 `YYYY-MM-DD HH:mm`（写日记保存与手动输入共用） */
export function parseFlexibleDateTime(input: string): any {
  const natural = parseNaturalTime(input);
  if (natural && natural.isValid()) return natural;
  return moment(input, 'YYYY-MM-DD HH:mm', true);
}

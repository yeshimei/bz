/**
 * 日记本（diary）域解析层——原回忆墙升格正名（ADR-0115；ADR-0130 条目文件格式）
 *
 * - parseEntryFile（条目文件，纯函数：frontmatter `date`+`type`，日期时间损坏从题目降级）；
 * - parseMovieFile / parseLetterFile（影视/信，读 frontmatter + 文件创建时间）；
 * - parseBookFile（书库，读 completionDate/readingDate/title/bookReview/cover）。
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
  };
}

/** 获取文件 frontmatter（无则返回 null）；app 由调用方注入（不依赖 diary/app 单例） */
function getFileFrontmatter(file: any, app: any): Record<string, any> | null {
  const cache = app.metadataCache.getFileCache(file);
  return cache && cache.frontmatter ? cache.frontmatter : null;
}

/** 文件创建时间 → { timeStr, timeValue } */
async function getFileTimeParts(file: any): Promise<{ timeStr: string; timeValue: number }> {
  const stat = await file.stat;
  const createTime = stat.ctime || stat.birthtime;
  const m = moment(createTime);
  return { timeStr: m.format('HH:mm'), timeValue: parseInt(m.format('HHmm')) };
}

/** 生成特殊文件条目的稳定 id */
function makeEntryId(prefix: string, file: any, dateStr: string): string {
  return `${prefix}-${file.path.replace(/\//g, '-')}-${dateStr}`;
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

    // 观影日期
    let dateStr = fm['观影日期'];
    if (!dateStr || !moment(dateStr, 'YYYY-MM-DD', true).isValid()) return null;
    dateStr = moment(dateStr).format('YYYY-MM-DD');

    let poster = fm['海报'];

    // 文件创建时间作为时分秒
    const { timeStr, timeValue } = await getFileTimeParts(file);

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
    // 文件创建时间作为时分秒
    const { timeStr, timeValue } = await getFileTimeParts(file);

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
 * - 日期：completionDate 优先，无则 readingDate，都无（或非法）返回 null（跳过）；
 * - 必须有书评且非空（bookReview），否则返回 null 跳过（用户要求「书只获取有书评的」，与影视影评同语义）；
 * - title：frontmatter title，缺省回退文件名（不含扩展名）；
 * - content = `**《title》**` + 空行 + bookReview；
 * - cover 拼进 content（`![[cover]]`），由数据层 extractMedia 提取为媒体；
 * - tag=['书']，emoji=getTagEmoji('书')；filename 为完整 vault 路径；id=makeEntryId('book',...)；
 * - 时间取文件创建时间（与影视/信同口径，用于同日混排）。
 */
export async function parseBookFile(file: any, app: any): Promise<DiaryEntry | null> {
  try {
    const fm = getFileFrontmatter(file, app);
    if (!fm) return null;

    // 必须有书评且非空（与影视影评同口径：无书评不进入回忆墙）
    const review = fm.bookReview;
    if (!review || String(review).trim() === '') return null;

    // 日期：completionDate 优先，无则 readingDate；都无跳过
    let dateStr = fm.completionDate ?? fm.readingDate;
    if (!dateStr || !moment(dateStr, 'YYYY-MM-DD', true).isValid()) return null;
    dateStr = moment(dateStr).format('YYYY-MM-DD');

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

    // 文件创建时间作为时分秒
    const { timeStr, timeValue } = await getFileTimeParts(file);

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

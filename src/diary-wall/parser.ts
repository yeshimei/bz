/**
 * 回忆墙（diary-wall）域解析层（自包含）
 *
 * 从 src/diary/parser.ts 拷贝（用户决策「回忆墙自包含，日后删除日记本域」）：
 * - parseFile（日记，纯函数：`# emoji序列 HH:mm` 标题切分，不依赖 app 注入）；
 * - parseMovieFile / parseLetterFile（影视/信，读 frontmatter + 文件创建时间）；
 * - 新增 parseBookFile（书库，读 completionDate/readingDate/title/bookReview/cover）。
 * 特殊文件解析所需的 getFileFrontmatter 以 app 参数注入（不 import ../diary/app，自包含）。
 * moment 来自 'obsidian'（测试 alias 已替换为 moment）。
 */
import { moment } from 'obsidian';
import { emojiToTagMap, getTagEmoji } from './config';
import type { DiaryEntry } from './types';

/** 加密条目：内容含 🔐 的条目在列表中隐藏，但保留在数据映射中防止写入丢失 */
export function isEncryptedEntry(entry: DiaryEntry): boolean {
  return typeof entry.content === 'string' && entry.content.includes('🔐');
}

/**
 * 解析日记文件内容（按 `# emoji序列 HH:mm` 标题切分条目）。
 * UX-9：顺带统计「未能解析的行」数（游离于首个条目之前的非空行、时间越界的条目标题行），
 * 不改解析结果、不动数据格式；onUnparsed 收到非零值时由调用方汇总提示。
 */
export function parseFile(content: string, dateStr: string, onUnparsed?: (unparsedLineCount: number) => void): DiaryEntry[] {
  const entries: DiaryEntry[] = [];
  const lines = content.split('\n');
  let currentEntry: DiaryEntry | null = null;
  let contentLines: string[] = [];
  let unparsedLines = 0;

  const headingRegex = /^#\s*((?:\S+)+)\s+(\d{2}:\d{2})/u;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(headingRegex);

    if (headingMatch) {
      if (currentEntry) {
        currentEntry.content = contentLines.join('\n').trim();
        entries.push(currentEntry);
        contentLines = [];
      }

      const emojiSequence = headingMatch[1];
      const time = headingMatch[2];

      const [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        // 时间越界的条目标题行：跳过（原行为），计入未解析行
        unparsedLines++;
        continue;
      }

      const timeValue = hours * 100 + minutes;

      // 使用 emoji 映射解析每个 emoji 对应的标签
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = segmenter.segment(emojiSequence);
      const tags: string[] = [];
      for (const seg of segments) {
        const ch = seg.segment;
        const mappedTag = emojiToTagMap[ch];
        if (mappedTag) {
          tags.push(mappedTag);
        }
      }
      if (tags.length === 0) {
        tags.push('日记');
      }

      currentEntry = {
        date: dateStr,
        time: time,
        timeValue: timeValue,
        tags: tags,
        emoji: emojiSequence,
        content: '',
        filename: dateStr,
        lineNumber: i + 1,
      };
    } else if (currentEntry) {
      if (line.trim() === '' && i + 1 < lines.length && lines[i + 1].match(/^#\s/)) {
        currentEntry.content = contentLines.join('\n').trim();
        entries.push(currentEntry);
        currentEntry = null;
        contentLines = [];
      } else {
        contentLines.push(line);
      }
    } else if (line.trim() !== '') {
      // 首个条目之前游离的非空行：无法归属任何条目（原行为静默丢弃），计入未解析行
      unparsedLines++;
    }
  }

  if (currentEntry) {
    currentEntry.content = contentLines.join('\n').trim();
    entries.push(currentEntry);
  }

  // UX-9：有未解析行才回调（零值时免打扰）
  if (onUnparsed && unparsedLines > 0) onUnparsed(unparsedLines);

  // 向后兼容旧数据
  for (const entry of entries) {
    if ((entry as any).type !== undefined) {
      entry.tags = [(entry as any).type];
      delete (entry as any).type;
    }
    if (!entry.tags || entry.tags.length === 0) {
      entry.tags = ['日记'];
    }
    // 重新生成 emoji 字段（保证与 tags 同步）
    entry.emoji = entry.tags.map((tag) => getTagEmoji(tag)).join('');
  }

  return entries;
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
    const fileNameWithoutExt = file.basename;
    const content = `${review.trim()}\n\n![[${poster}]]\n\n#${fileNameWithoutExt}`;

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
 * - title：frontmatter title，缺省回退文件名（不含扩展名）；
 * - content = `**《title》**` + 空行 + bookReview（bookReview 空则只标题）；
 * - cover 拼进 content（`![[cover]]`），由数据层 extractMedia 提取为媒体；
 * - tag=['书']，emoji=getTagEmoji('书')；filename 为完整 vault 路径；id=makeEntryId('book',...)；
 * - 时间取文件创建时间（与影视/信同口径，用于同日混排）。
 */
export async function parseBookFile(file: any, app: any): Promise<DiaryEntry | null> {
  try {
    const fm = getFileFrontmatter(file, app);
    if (!fm) return null;

    // 日期：completionDate 优先，无则 readingDate；都无跳过
    let dateStr = fm.completionDate ?? fm.readingDate;
    if (!dateStr || !moment(dateStr, 'YYYY-MM-DD', true).isValid()) return null;
    dateStr = moment(dateStr).format('YYYY-MM-DD');

    // 标题：frontmatter title 优先，缺省回退文件名
    const title = (fm.title && String(fm.title).trim() !== '' ? String(fm.title).trim() : null) || file.basename;

    // 正文：`**《title》**` + bookReview（空则只标题）
    let content = `**《${title}》**`;
    const review = fm.bookReview;
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

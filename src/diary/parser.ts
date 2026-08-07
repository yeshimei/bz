/**
 * 解析层：从文件内容/文件对象解析日记条目（纯函数，不直接触碰 DOM）。
 * 原脚本 1364-1721 行 + parseNaturalTime（3550-3581）。
 */
import { moment } from 'obsidian';
import { getApp } from './app';
import { emojiToTagMap, getTagEmoji } from './config';
import type { DiaryEntry } from './types';

/** 加密条目：内容含 🔐 的条目在列表中隐藏，但保留在数据映射中防止写入丢失 */
export function isEncryptedEntry(entry: DiaryEntry): boolean {
  return typeof entry.content === 'string' && entry.content.includes('🔐');
}

/**
 * 解析日记文件内容（按 `# emoji序列 HH:mm` 标题切分条目）
 */
export function parseFile(content: string, dateStr: string): DiaryEntry[] {
  const entries: DiaryEntry[] = [];
  const lines = content.split('\n');
  let currentEntry: DiaryEntry | null = null;
  let contentLines: string[] = [];

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
      if (isNaN(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) continue;

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
    }
  }

  if (currentEntry) {
    currentEntry.content = contentLines.join('\n').trim();
    entries.push(currentEntry);
  }

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

/** 获取文件 frontmatter（无则返回 null） */
export function getFileFrontmatter(file: any): Record<string, any> | null {
  const cache = getApp().metadataCache.getFileCache(file);
  return cache && cache.frontmatter ? cache.frontmatter : null;
}

/** 文件创建时间 → { timeStr, timeValue } */
export async function getFileTimeParts(file: any): Promise<{ timeStr: string; timeValue: number }> {
  const stat = await file.stat;
  const createTime = stat.ctime || stat.birthtime;
  const m = moment(createTime);
  return { timeStr: m.format('HH:mm'), timeValue: parseInt(m.format('HHmm')) };
}

/** 生成特殊文件条目的稳定 id */
export function makeEntryId(prefix: string, file: any, dateStr: string): string {
  return `${prefix}-${file.path.replace(/\//g, '-')}-${dateStr}`;
}

/**
 * 解析影视文件，生成一个日记条目（每个文件对应一个条目）
 */
export async function parseMovieFile(file: any): Promise<DiaryEntry | null> {
  try {
    const fm = getFileFrontmatter(file);
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
 */
export async function parseLetterFile(file: any): Promise<DiaryEntry | null> {
  try {
    const fm = getFileFrontmatter(file);
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
    const fullContent = await getApp().vault.read(file);
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

// ===== 自然语言时间解析（原 3550-3581） =====

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

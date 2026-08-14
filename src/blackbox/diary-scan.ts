/**
 * 黑匣子日记读取（ticket 58，ADR-0017）：日记是唯一事实源，黑匣子只读不写。
 * 复用 diary/parser 纯函数（parseFile/parseMovieFile/parseLetterFile）与 diary/config 目录常量
 * （DIARY_DIRECTORY/MOVIE_DIRECTORY/LETTER_DIRECTORY，跟随设置），不重造扫描轮子。
 * 黑匣子自建轻量三目录扫描（枚举 + vault.read）。
 */
import type { App } from 'obsidian';
import { DIARY_DIRECTORY, MOVIE_DIRECTORY, LETTER_DIRECTORY } from '../diary/config';
import { parseFile, parseMovieFile, parseLetterFile } from '../diary/parser';
import type { DiarySourceEntry } from './types';

/** 文件是否在日记流内（三目录前缀边界判断，与 diary/store onFileChange 同款 inDir 语义） */
export function isDiaryStreamFile(filePath: string): boolean {
  if (!filePath || !filePath.endsWith('.md')) return false;
  const inDir = (p: string, dir: string) => p === dir || p.startsWith(dir + '/');
  return inDir(filePath, DIARY_DIRECTORY) || inDir(filePath, MOVIE_DIRECTORY) || inDir(filePath, LETTER_DIRECTORY);
}

/** 目录内 md 文件枚举（无目录 → 空数组） */
function listMdFiles(app: App, dir: string): any[] {
  const folder = app.vault.getAbstractFileByPath(dir) as any;
  if (!folder || !folder.children) return [];
  return folder.children.filter((f: any) => f.extension === 'md');
}

/** 单文件解析为日记源条目（增量用；文件不存在 → 空数组） */
export async function parseDiaryFile(app: App, filePath: string): Promise<DiarySourceEntry[]> {
  const file = app.vault.getAbstractFileByPath(filePath) as any;
  if (!file || file.extension !== 'md') return [];
  const content = await app.vault.read(file);
  const dateStr = file.basename;
  const entries = parseFile(content, dateStr);
  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    time: e.time,
    content: e.content,
    filename: e.filename,
    lineNumber: e.lineNumber,
    tags: e.tags,
  }));
}

/** 全量扫描三目录 → 日记源条目（主日记 + 影视 + 信，按日期+时间降序，新在前） */
export async function scanAllDiaryEntries(app: App): Promise<DiarySourceEntry[]> {
  const out: DiarySourceEntry[] = [];

  // 主日记目录
  const diaryFiles = listMdFiles(app, DIARY_DIRECTORY).sort((a: any, b: any) => b.name.localeCompare(a.name));
  for (const file of diaryFiles) {
    const content = await app.vault.read(file);
    const dateStr = file.basename;
    const entries = parseFile(content, dateStr);
    for (const e of entries) {
      out.push({
        id: e.id,
        date: e.date,
        time: e.time,
        content: e.content,
        filename: e.filename,
        lineNumber: e.lineNumber,
        tags: e.tags,
      });
    }
  }

  // 影视（有影评 + 观影日期的文件 → 日记条目）
  const movieFiles = listMdFiles(app, MOVIE_DIRECTORY);
  for (const file of movieFiles) {
    try {
      const e = await parseMovieFile(file);
      if (e) {
        out.push({
          id: e.id,
          date: e.date,
          time: e.time,
          content: e.content,
          filename: e.filename,
          lineNumber: e.lineNumber,
          tags: e.tags,
        });
      }
    } catch {
      // 单个影视文件解析失败跳过（永不拒收）
    }
  }

  // 信
  const letterFiles = listMdFiles(app, LETTER_DIRECTORY);
  for (const file of letterFiles) {
    try {
      const e = await parseLetterFile(file);
      if (e) {
        out.push({
          id: e.id,
          date: e.date,
          time: e.time,
          content: e.content,
          filename: e.filename,
          lineNumber: e.lineNumber,
          tags: e.tags,
        });
      }
    } catch {
      // 单个信文件解析失败跳过
    }
  }

  // 统一排序：日期降序 + 时间降序（新在前）
  out.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    return dateCmp !== 0 ? dateCmp : b.time.localeCompare(a.time);
  });
  return out;
}
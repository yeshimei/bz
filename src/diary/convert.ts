/**
 * 日记格式互转（entry ⇄ day）。
 *
 * 入口：设置面板「存储 → 切换并转换」；也可以在命令/测试里直接调。
 * 口径（与 scripts/diary-split.mjs 同语义，但这里是运行中的真实写盘）：
 * - 旧 → 新：每个 `YYYY-MM-DD.md` 按 `# emoji HH:mm` 拆块，每块写成一个条目文件；
 *   有游离正文/坏时间头行的文件**整份跳过**（绝不静默丢行），原文件不动；
 * - 新 → 旧：同一天的条目文件按时间拼成一个 `YYYY-MM-DD.md`；目标已存在则整日跳过；
 * - 转换成功的原文件进 Obsidian 回收站（`trashNote`，可恢复），不做硬删；
 * - 任何一步失败：回滚本次已创建的目标文件，原文件保留，报告原因；
 * - 幂等：目标已存在且内容一致视为已转换，不重复写。
 *
 * 本模块只做文件搬运，不写 settings；切不切换格式由调用方（设置页）在成功后决定。
 */
import { getApp } from '../core/app';
import { trashNote } from '../core/note-trash';
import {
  diaryDayDateFromPath,
  diaryDayFormats,
  diaryEntryPath,
  diaryMetaFromEntryPath,
  parseDiaryEntryFile,
  serializeDiaryEntryFile,
} from '../core/diary-format';
import { DIARY_DIRECTORY, diaryDayPath, type DiaryEntryFormat } from './config';
import { parseLegacyDayFile, serializeLegacyBlock } from './legacy';
import { parseEntryFile } from './parser';

export interface ConvertProgress {
  done: number;
  total: number;
  /** 当前处理的文件（vault 相对路径） */
  current?: string;
}

export interface ConvertIssue {
  path: string;
  reason: string;
}

export interface ConvertReport {
  target: DiaryEntryFormat;
  /** 实际写出的目标文件数 */
  converted: number;
  /** 因冲突/无法解析而整份跳过的文件 */
  skipped: ConvertIssue[];
  /** 失败（已回滚本次目标写入） */
  errors: ConvertIssue[];
}

type ProgressFn = (p: ConvertProgress) => void;

/** 日记目录下的全部 md 路径（直接读 vault 清单，不递归 adapter，和墙同口径） */
function diaryMdPaths(): string[] {
  const prefix = `${DIARY_DIRECTORY}/`;
  return (getApp().vault.getMarkdownFiles?.() || [])
    .map((f) => String((f as { path?: string }).path || ''))
    .filter((p) => p.startsWith(prefix));
}

/** 让出一拍，给进度条/遮罩一次绘制机会（vault 写盘本身是异步，但连续 await 同一微任务队列） */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 旧 → 新：日期文件拆条目文件 */
export async function convertLegacyToEntries(onProgress?: ProgressFn): Promise<ConvertReport> {
  const app = getApp();
  const report: ConvertReport = { target: 'entry', converted: 0, skipped: [], errors: [] };
  const legacyPaths = diaryMdPaths().filter(
    (p) => !!diaryDayDateFromPath(p, DIARY_DIRECTORY, diaryDayFormats())
  );
  const total = legacyPaths.length;
  let done = 0;

  for (const path of legacyPaths) {
    onProgress?.({ done, total, current: path });
    const file = app.vault.getAbstractFileByPath(path) as any;
    if (!file) {
      report.errors.push({ path, reason: '文件不存在' });
      done++;
      continue;
    }
    const dir = path.split('/').slice(0, -1).join('/');
    const created: string[] = [];
    const dayDate = diaryDayDateFromPath(path, DIARY_DIRECTORY, diaryDayFormats());
    try {
      const content = await app.vault.read(file);
      const day = parseLegacyDayFile(content, path, dayDate ?? undefined);
      if (!day) {
        report.skipped.push({ path, reason: '不是日记日期文件' });
        done++;
        continue;
      }
      if (day.unparsed > 0) {
        report.skipped.push({ path, reason: `有 ${day.unparsed} 行游离正文/坏时间头行，整份未转换` });
        done++;
        continue;
      }
      if (day.blocks.length === 0) {
        report.skipped.push({ path, reason: '空文件，没有可拆的条目' });
        done++;
        continue;
      }

      const used = new Map<string, number>();
      for (const block of day.blocks) {
        const n = (used.get(block.time) ?? 0) + 1;
        used.set(block.time, n);
        let seq = n;
        let target = diaryEntryPath(dir, day.date, block.time, seq);
        let payload = serializeDiaryEntryFile({ date: day.date, time: block.time }, block.tags, block.body);

        // 同刻多条/盘上已有同名：内容一致 = 上次中断的重跑，跳过；内容不同则让位 -2/-3…
        for (let guard = 0; guard < 1000; guard++) {
          const existing = app.vault.getAbstractFileByPath(target) as any;
          if (!existing) break;
          const text = await app.vault.read(existing);
          if (text.replace(/\n$/, '') === payload.replace(/\n$/, '')) {
            // 上次中断的重跑：目标已经有同内容条目，不重复创建、也绝不列入回滚清单
            target = '';
            break;
          }
          seq += 1;
          target = diaryEntryPath(dir, day.date, block.time, seq);
          payload = serializeDiaryEntryFile({ date: day.date, time: block.time }, block.tags, block.body);
        }
        if (!target) continue;
        await app.vault.create(target, payload);
        created.push(target);
        report.converted++;
      }

      await trashNote(app, file);
    } catch (e) {
      // 回滚本次已创建的目标（原文件未动）
      for (const p of created) {
        try {
          const f = app.vault.getAbstractFileByPath(p) as any;
          if (f) await app.vault.delete(f);
        } catch (err) {
          /* 回滚失败不掩盖原始错误 */
        }
      }
      report.errors.push({ path, reason: e instanceof Error ? e.message : String(e) });
    }
    done++;
    await yieldToUi();
  }
  onProgress?.({ done, total });
  return report;
}

/** 新 → 旧：同一天的条目文件合并成日期文件 */
export async function convertEntriesToLegacy(onProgress?: ProgressFn): Promise<ConvertReport> {
  const app = getApp();
  const report: ConvertReport = { target: 'day', converted: 0, skipped: [], errors: [] };

  // 按日期分组（只认条目文件；旧日期文件留着的话目标会撞上，整日跳过）
  const byDate = new Map<string, string[]>();
  for (const p of diaryMdPaths()) {
    const meta = diaryMetaFromEntryPath(p);
    if (!meta) continue;
    const list = byDate.get(meta.date) ?? [];
    list.push(p);
    byDate.set(meta.date, list);
  }
  const dates = [...byDate.keys()].sort();
  const total = dates.length;
  let done = 0;

  for (const date of dates) {
    onProgress?.({ done, total, current: date });
    const dir = (byDate.get(date)?.[0] ?? '').split('/').slice(0, -1).join('/') || DIARY_DIRECTORY;
    const target = diaryDayPath(dir, date);
    const paths = (byDate.get(date) ?? []).slice().sort();

    if (app.vault.getAbstractFileByPath(target)) {
      report.skipped.push({ path: target, reason: `当天已存在 ${target.split('/').pop()}，整日跳过（避免合并冲突）` });
      done++;
      continue;
    }

    const entries: Array<{ time: string; tags: string[]; body: string; path: string }> = [];
    let parseFailed = false;
    try {
      for (const p of paths) {
        const file = app.vault.getAbstractFileByPath(p) as any;
        if (!file) { parseFailed = true; break; }
        const content = await app.vault.read(file);
        const parsed = parseDiaryEntryFile(content);
        const entry = parseEntryFile(content, p);
        if (!entry) { parseFailed = true; break; }
        entries.push({
          time: entry.time,
          tags: parsed.tags.length > 0 ? parsed.tags : ['日记'],
          body: parsed.body.trim(),
          path: p,
        });
      }
    } catch (e) {
      report.skipped.push({ path: target, reason: `读取失败，整日未转换：${e instanceof Error ? e.message : String(e)}` });
      done++;
      continue;
    }
    if (parseFailed) {
      report.skipped.push({ path: target, reason: '当天有条目文件解析失败，整日未转换' });
      done++;
      continue;
    }

    entries.sort((a, b) => a.time.localeCompare(b.time) || a.path.localeCompare(b.path));
    const content = entries.map((e) => serializeLegacyBlock(e.tags, e.time, e.body).trimEnd()).join('\n\n') + '\n';

    let made = false;
    try {
      await app.vault.create(target, content);
      made = true;
      report.converted++;
      // 原条目文件进回收站（可恢复）
      for (const p of paths) {
        const f = app.vault.getAbstractFileByPath(p) as any;
        if (f) await trashNote(app, f);
      }
    } catch (e) {
      // 目标写失败：不留半成品
      if (made) {
        const partial = app.vault.getAbstractFileByPath(target) as any;
        if (partial) {
          try { await app.vault.delete(partial); } catch (err) { /* 忽略 */ }
        }
      }
      report.errors.push({ path: target, reason: e instanceof Error ? e.message : String(e) });
    }
    done++;
    await yieldToUi();
  }
  onProgress?.({ done, total });
  return report;
}

/** 按目标格式分派 */
export function convertDiaryFormat(target: DiaryEntryFormat, onProgress?: ProgressFn): Promise<ConvertReport> {
  return target === 'day' ? convertEntriesToLegacy(onProgress) : convertLegacyToEntries(onProgress);
}

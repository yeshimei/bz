/**
 * 日记格式互转（entry ⇄ day）。
 *
 * 入口：设置面板「存储 → 切换并转换」；也可以在命令/测试里直接调。
 * 口径（与 scripts/diary-split.mjs 同语义，但这里是运行中的真实写盘）：
 * - 旧 → 新：每个 `YYYY-MM-DD.md` 按 `# emoji HH:mm` 拆块，每块写成一个条目文件；
 *   一个头行都没有的（Obsidian 原生日记）整篇算一条，时间取文件创建时间（不在当天记 00:00），
 *   这类文件单独记进 `inferred`，设置页会说明；
 *   有游离正文/坏时间头行的文件**整份跳过**（绝不静默丢行），原文件不动；
 * - 新 → 旧：同一天的条目文件按时间拼成一个 `YYYY-MM-DD.md`；目标已存在则整日跳过；
 * - 转换成功的原文件进 Obsidian 回收站（`trashNote`，可恢复），不做硬删；
 * - 任何一步失败：回滚本次已创建的目标文件，原文件保留，报告原因；
 * - 幂等：目标已存在且内容一致视为已转换，不重复写。
 *
 * 两段式（2026-11-06）：`convertDiaryFormat` 先**试运行**一遍（只读不写），
 * 整批都能转才真跑。格式切换是「切了就按新格式读」——半批转成功、半批没转时，
 * 无论切不切都会让一部分日记在日记本里看不见。宁可一个都不动，把不能转的
 * 那几篇一次说清（见 `ConvertReport.skipped` / `errors`）。
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
import { parseDayFileForRead, serializeLegacyBlock } from './legacy';
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
  /**
   * 有内容但整份跳过的文件（冲突 / 无法解析 / 游离正文）。
   * 空文件不算：它没有可丢的内容，不该挡住整批切换。
   */
  skipped: ConvertIssue[];
  /** 失败（已回滚本次目标写入） */
  errors: ConvertIssue[];
  /**
   * 目标已写出、但原文件没能移入回收站（回收站不可写 / 文件被占用）。
   * 目标保留不动，下次重跑按幂等只补移原文件；这里的路径供提示用户手动清理。
   */
  leftovers: ConvertIssue[];
  /**
   * 靠兜底时间转出来的（Obsidian 原生日记：整篇无分段时间头，时间取自文件创建时间，
   * 创建时间不在当天则记 00:00）。设置页的确认框与结果提示要用它说清「有几篇时间不是原文写的」。
   */
  inferred: ConvertIssue[];
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

/** 同名判定：行尾差不算内容不同（文件可能被别的工具补过末尾换行） */
function sameText(a: string, b: string): boolean {
  return a.replace(/\r\n/g, '\n').replace(/\n$/, '') === b.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

/** 旧 → 新：日期文件拆条目文件。`dryRun` 只读不写，用来在真跑之前确认整批可转 */
export async function convertLegacyToEntries(
  onProgress?: ProgressFn,
  dryRun = false
): Promise<ConvertReport> {
  const app = getApp();
  const report: ConvertReport = { target: 'entry', converted: 0, skipped: [], errors: [], leftovers: [], inferred: [] };
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
      /*
       * 读路径与转换共用降级解析：整篇无分段时间头的 Obsidian 原生日记算一条，
       * 时间取文件创建时间（不在当天则 00:00）。有坏头行的仍按 unparsed 整份跳过，不吞正文。
       */
      const day = parseDayFileForRead(content, path, dayDate ?? undefined, file.stat?.ctime);
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
        // 空文件：没有可拆的内容，也没有可丢的行——不算问题，也不挡整批切换（原文件留着）
        done++;
        continue;
      }
      if (day.whole) {
        report.inferred.push({
          path,
          reason: `原文件没有分段时间头，整篇转一条，时间 ${day.blocks[0]?.time ?? '00:00'}`,
        });
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
          if (sameText(text, payload)) {
            // 上次中断的重跑：目标已经有同内容条目，不重复创建、也绝不列入回滚清单
            target = '';
            break;
          }
          seq += 1;
          target = diaryEntryPath(dir, day.date, block.time, seq);
          payload = serializeDiaryEntryFile({ date: day.date, time: block.time }, block.tags, block.body);
        }
        if (!target) continue;
        if (!dryRun) {
          await app.vault.create(target, payload);
          created.push(target);
        }
        report.converted++;
      }

      // 试运行到此为止：不碰原文件（真跑才搬进回收站）
      if (!dryRun) {
        await trashNote(app, file);
      }
    } catch (e) {
      // 回滚本次已创建的目标（原文件未动）。试运行没有 created，自然不回滚
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

/** 新 → 旧：同一天的条目文件合并成日期文件。`dryRun` 只读不写 */
export async function convertEntriesToLegacy(
  onProgress?: ProgressFn,
  dryRun = false
): Promise<ConvertReport> {
  const app = getApp();
  const report: ConvertReport = { target: 'day', converted: 0, skipped: [], errors: [], leftovers: [], inferred: [] };

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

    // 目标已存在：内容一致 = 上次已转换（可能上次倒在「移原文件」那一步），只补移原文件；
    // 不一致 = 用户自己的文件，整日跳过（避免合并冲突）。这条幂等口径让 leftovers 能自愈：
    // 不做的话，上次残留的原条目文件会让这一天永远卡在 skipped，用户重跑多少次都过不去。
    const targetFile = app.vault.getAbstractFileByPath(target) as any;
    if (targetFile) {
      let same = false;
      try {
        same = sameText(await app.vault.read(targetFile), content);
      } catch {
        same = false;
      }
      if (!same) {
        report.skipped.push({ path: target, reason: `当天已存在 ${target.split('/').pop()}，整日跳过（避免合并冲突）` });
        done++;
        continue;
      }
    } else if (!dryRun) {
      try {
        await app.vault.create(target, content);
      } catch (e) {
        // 目标写失败：不留半成品（此时还没有任何原文件被搬走）
        report.errors.push({ path: target, reason: e instanceof Error ? e.message : String(e) });
        done++;
        await yieldToUi();
        continue;
      }
      report.converted++;
    } else {
      report.converted++; // 试运行：记「这一天可转」
    }

    // 原文件进回收站（可恢复）——与「目标已写好」不是一件事。回收站不可写/文件被占用时
    // 目标必须留着：原文件若也一起回滚，用户就两边都没了。失败只记账，下次重跑补移。
    if (!dryRun) {
      let left = 0;
      for (const p of paths) {
        const f = app.vault.getAbstractFileByPath(p) as any;
        if (!f) continue;
        try {
          await trashNote(app, f);
        } catch (err) {
          left++;
        }
      }
      if (left > 0) {
        report.leftovers.push({
          path: target,
          reason: `有 ${left} 个原条目文件未移入回收站（可手动删除；重跑也会补移）`,
        });
      }
    }
    done++;
    await yieldToUi();
  }
  onProgress?.({ done, total });
  return report;
}

/**
 * 按目标格式分派：先试运行确认整批都能转，再真跑。
 *
 * 试运行有 blocked（skipped 或 errors 非空）时**一个文件都不动**，返回 `converted: 0`
 * 的报告；调用方据此不切格式并把这些文件说给用户。执行期才失败（磁盘满/权限）仍会
 * 留下半批，报告里带 errors，设置页会按「格式没切」处理。
 */
export async function convertDiaryFormat(
  target: DiaryEntryFormat,
  onProgress?: ProgressFn
): Promise<ConvertReport> {
  const run = target === 'day' ? convertEntriesToLegacy : convertLegacyToEntries;
  const probe = await run(undefined, true);
  const blocked = [...probe.errors, ...probe.skipped];
  if (blocked.length > 0) return { ...probe, converted: 0 };
  return run(onProgress, false);
}

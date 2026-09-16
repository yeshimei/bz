/**
 * 番茄钟数据层（ticket 27）：pomodoro.json v1 读写。
 * 文件不存在/解析失败 → 默认数据（懒创建：save 时建目录建文件，jsonStore 语义）；
 * 路径跟随共享数据路径 storagePath（ADR-0009）。
 * ticket 63：移除 reading 字段与 target 归一（旧数据残留字段读取时自然忽略，不迁移）。
 * issue 357：可选段 archived（周归档行）——trimHistory 裁剪历史前先把离开 7 天保留窗的
 * 条目按自然周聚合成归档行落账（trimWithArchive），「history 只留 7 天明细」拍板不变；
 * 旧文件无此段照常工作（零迁移，首周起算）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import type { PomodoroState, HistoryEntry, ArchivedWeek } from './state';
import { createInitialState, PHASES } from './state';
import { aggregateWeeks, mergeArchived } from './stats';

export const POMODORO_FILE_PATH = 'CONFIG/STORAGE/pomodoro.json';

/** 番茄钟数据文件路径（storagePath 优先，未注入回退默认；尾斜杠清理收敛至 storageFile） */
export function getPomodoroFilePath(): string {
  return storageFile('pomodoro.json', ((tryGetSettings() as any)?.storagePath) || 'CONFIG/STORAGE');
}

export interface PomodoroData {
  version: 1;
  state: PomodoroState;
  history: HistoryEntry[];
  /** 周归档段（issue 357，可选）：离开 7 天保留窗的明细按自然周聚合；空数组不落盘，旧文件无此段 = 零迁移 */
  archived?: ArchivedWeek[];
}

export function defaultPomodoroData(): PomodoroData {
  return { version: 1, state: createInitialState(), history: [] };
}

/**
 * 历史保留窗裁剪（F13）：统计只消费近 7 个日历日（stats.ts last7Days/today*），窗外的完成
 * 记录在落盘前裁掉——history 永不裁剪会让 pomodoro.json 随使用线性膨胀。
 * 窗口起点 = 今日零点 −6 天（与 last7Days 最左一天同一起点，日历日口径 DST 安全）；
 * 未来时间戳（时钟回拨）落在窗口右侧，保守保留。
 */
export function trimHistory(history: HistoryEntry[], now: number): HistoryEntry[] {
  const t = retentionFloor(now);
  return history.filter((h) => h.ts >= t);
}

/** 保留窗窗口起点（今日零点 −6 天），trimHistory / trimWithArchive 同一口径 */
function retentionFloor(now: number): number {
  const floor = new Date(now);
  floor.setHours(0, 0, 0, 0);
  floor.setDate(floor.getDate() - 6);
  return floor.getTime();
}

/**
 * 裁剪 + 周归档（issue 357）：trimHistory 同款保留窗，被裁条目不直接丢弃——先按自然周
 * 聚合（aggregateWeeks）再以周 key 判重增量合并进 archived（mergeArchived，同一周不重复建行）。
 * 调用方保证每次传入的 history 只含「尚未被裁」的明细，故同一明细至多入账一次；
 * 明细与归档按日恒不交（归档只含已离开窗口的日子），月趋势合成（stats.lastNMonths）不重复累计。
 */
export function trimWithArchive(
  history: HistoryEntry[],
  archived: ArchivedWeek[] | undefined,
  now: number
): { history: HistoryEntry[]; archived: ArchivedWeek[] } {
  const floor = retentionFloor(now);
  const removed = history.filter((h) => h.ts < floor);
  const kept = removed.length ? history.filter((h) => h.ts >= floor) : history;
  return { history: kept, archived: removed.length ? mergeArchived(archived, aggregateWeeks(removed)) : archived ?? [] };
}

/** 容错归一：非法字段回退默认、history 过滤非法条目、archived 过滤非法归档行 */
function normalizeData(raw: any): PomodoroData {
  const def = defaultPomodoroData();
  if (!raw || typeof raw !== 'object') return def;
  const state = normalizeState(raw.state);
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((h: any) => h && typeof h.ts === 'number' && typeof h.duration === 'number')
        // 显式重建：剥离 target 等残留字段（ticket 63）；归属任务标题（字符串非空）保留
        .map((h: any) => ({
          ts: h.ts,
          duration: h.duration,
          ...(typeof h.task === 'string' && h.task ? { task: h.task } : {}),
        }))
    : [];
  const archived = normalizeArchived(raw.archived);
  return { version: 1, state, history, ...(archived.length ? { archived } : {}) };
}

/** archived 段容错归一（issue 357）：week 需 YYYY-MM-DD、count/minutes 需非负数、tasks 值需有限数；空段不落键 */
function normalizeArchived(raw: any): ArchivedWeek[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r: any) =>
        r &&
        typeof r.week === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.week) &&
        typeof r.count === 'number' &&
        r.count >= 0 &&
        typeof r.minutes === 'number' &&
        r.minutes >= 0
    )
    .map((r: any) => {
      const tasks: Record<string, number> = {};
      if (r.tasks && typeof r.tasks === 'object' && !Array.isArray(r.tasks)) {
        for (const [t, m] of Object.entries(r.tasks as Record<string, unknown>)) {
          if (typeof m === 'number' && Number.isFinite(m) && m >= 0) tasks[t] = m;
        }
      }
      return {
        week: r.week,
        count: r.count,
        minutes: r.minutes,
        ...(Object.keys(tasks).length ? { tasks } : {}),
      };
    });
}

/** 逐字段校验 state（非法 phase/负数 remaining 一律回退默认；旧 target/reading 字段忽略不迁移） */
function normalizeState(raw: any): PomodoroState {
  const def = createInitialState();
  if (!raw || typeof raw !== 'object') return def;
  return {
    phase: PHASES.includes(raw.phase) ? raw.phase : def.phase,
    endTime: typeof raw.endTime === 'number' ? raw.endTime : def.endTime,
    remaining: typeof raw.remaining === 'number' && raw.remaining >= 0 ? raw.remaining : def.remaining,
    paused: typeof raw.paused === 'boolean' ? raw.paused : def.paused,
    // 冻结来源标记：仅认 'autopause'，旧数据无此字段/非法值 → undefined（手动暂停语义）
    pausedBy: raw.pausedBy === 'autopause' ? 'autopause' : undefined,
    cycleFocusCount:
      typeof raw.cycleFocusCount === 'number' && raw.cycleFocusCount >= 0 ? raw.cycleFocusCount : def.cycleFocusCount,
    // 归属任务标题：仅字符串非空保留（旧数据/非法值 → undefined）
    task: typeof raw.task === 'string' && raw.task ? raw.task : undefined,
  };
}

export class PomodoroDataManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * 读取数据（统一数据读写层：不存在 → 建默认数据文件；坏 JSON → 原文件留档 CONFIG/.CORRUPT 后重建默认）。
   * 读也入 core per-path 串行队列：读是「load → 改 state → save」事务的读半边，
   * 排在未落盘的写任务之后才能读到新值（读写同队列，消灭「读-写窗口交错」）。
   */
  async load(): Promise<PomodoroData> {
    const raw = await enqueueFileTask(getPomodoroFilePath(), () =>
      jsonFileStore<any>(getPomodoroFilePath(), {
        defaultValue: () => defaultPomodoroData(),
        app: this.app,
      }).read()
    );
    return normalizeData(raw);
  }

  /**
   * 保存（统一数据读写层：存在 modify / 不存在 create+建目录）。
   * D3 可靠写契约原语 1 收编：整写入 core per-path 串行队列（键 = pomodoro.json 路径）——
   * 计时器心跳保存与用户操作保存并发时按序落盘，后写者不再用陈旧基线覆盖先写者；
   * 坏文件由 jsonFileStore 留档降级（原语 3）。数据形状与 API 不变。
   */
  async save(data: PomodoroData): Promise<void> {
    await enqueueFileTask(getPomodoroFilePath(), () =>
      jsonFileStore<PomodoroData>(getPomodoroFilePath(), { app: this.app }).write(data)
    );
  }
}
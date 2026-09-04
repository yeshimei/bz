/**
 * 番茄钟数据层（ticket 27）：pomodoro.json v1 读写。
 * 文件不存在/解析失败 → 默认数据（懒创建：save 时建目录建文件，jsonStore 语义）；
 * 路径跟随共享数据路径 storagePath（ADR-0009）。
 * ticket 63：移除 reading 字段与 target 归一（旧数据残留字段读取时自然忽略，不迁移）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import type { PomodoroState, HistoryEntry } from './state';
import { createInitialState, PHASES } from './state';

export const POMODORO_FILE_PATH = 'CONFIG/STORAGE/pomodoro.json';

/** 番茄钟数据文件路径（storagePath 优先，未注入回退默认；尾斜杠清理收敛至 storageFile） */
export function getPomodoroFilePath(): string {
  return storageFile('pomodoro.json', ((tryGetSettings() as any)?.storagePath) || 'CONFIG/STORAGE');
}

export interface PomodoroData {
  version: 1;
  state: PomodoroState;
  history: HistoryEntry[];
}

export function defaultPomodoroData(): PomodoroData {
  return { version: 1, state: createInitialState(), history: [] };
}

/** 容错归一：非法字段回退默认、history 过滤非法条目 */
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
  return { version: 1, state, history };
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
/**
 * 番茄钟数据层（ticket 27）：pomodoro.json v1 读写。
 * 文件不存在/解析失败 → 默认数据（懒创建：save 时建目录建文件，jsonStore 语义）；
 * 路径跟随共享数据路径 storagePath（ADR-0009）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import type { PomodoroState, HistoryEntry } from './state';
import { createInitialState, PHASES } from './state';

export const POMODORO_FILE_PATH = 'CONFIG/STORAGE/pomodoro.json';

/** 番茄钟数据文件路径（storagePath 优先，未注入回退默认；尾斜杠清理与全仓一致） */
export function getPomodoroFilePath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/pomodoro.json`;
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
    ? raw.history.filter((h: any) => h && typeof h.ts === 'number' && typeof h.duration === 'number')
    : [];
  return { version: 1, state, history };
}

/** 逐字段校验 state（非法 phase/负数 remaining 等一律回退默认） */
function normalizeState(raw: any): PomodoroState {
  const def = createInitialState();
  if (!raw || typeof raw !== 'object') return def;
  return {
    phase: PHASES.includes(raw.phase) ? raw.phase : def.phase,
    endTime: typeof raw.endTime === 'number' ? raw.endTime : def.endTime,
    remaining: typeof raw.remaining === 'number' && raw.remaining >= 0 ? raw.remaining : def.remaining,
    paused: typeof raw.paused === 'boolean' ? raw.paused : def.paused,
    cycleFocusCount:
      typeof raw.cycleFocusCount === 'number' && raw.cycleFocusCount >= 0 ? raw.cycleFocusCount : def.cycleFocusCount,
  };
}

export class PomodoroDataManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** 读取数据（不存在/坏 JSON → 默认数据） */
  async load(): Promise<PomodoroData> {
    const filePath = getPomodoroFilePath();
    const f = this.app.vault.getAbstractFileByPath(filePath);
    if (!f) return defaultPomodoroData();
    try {
      return normalizeData(JSON.parse(await this.app.vault.read(f as any)));
    } catch (e) {
      return defaultPomodoroData();
    }
  }

  /** 保存（存在 modify / 不存在 create，建目录兜底） */
  async save(data: PomodoroData): Promise<void> {
    const filePath = getPomodoroFilePath();
    const c = JSON.stringify(data, null, 2);
    const f = this.app.vault.getAbstractFileByPath(filePath);
    if (f) {
      await this.app.vault.modify(f as any, c);
    } else {
      const d = filePath.substring(0, filePath.lastIndexOf('/'));
      if (d && !this.app.vault.getAbstractFileByPath(d)) await this.app.vault.createFolder(d);
      await this.app.vault.create(filePath, c);
    }
  }
}

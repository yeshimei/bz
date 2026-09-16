/**
 * 文献盒数据管理器（视频转文献，literature 域；ADR-0066 正名「文献盒」，ADR-0072 迁出为新域）
 * literature.json 读写（jsonStore）、任务 CRUD、状态流转、时间格式校验。
 * D3 可靠写契约原语 1 收编：全部「读→改→写」事务整体入 core per-path 串行队列
 * （enqueueFileTask，键 = literature.json 路径）——下载守护进程回写状态与面板增删任务并发时
 * 按序落盘，后写者不再用陈旧基线覆盖先写者；坏文件由 jsonFileStore 留档降级（原语 3）。
 * read/write 保持无锁原语（仅限队列内调用，勿再入队——队列不可重入）。
 */
import moment from 'moment';
import { enqueueFileTask, jsonFileStore, storageFile, type JsonFileStore } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import { generateId } from '../core/utils';
import { pad2 } from '../core/ui/str';
import { getApp } from '../core/app';
import { cleanUrlText, normalizeSourceUrl } from './source';
import type { KnowledgeTask, KnowledgeTaskStatus } from './types';

export interface KnowledgeSettingsLike {
  /** ADR-0009 共享数据路径（优先），旧独立路径不涉及 */
  storagePath?: string;
}

/** 任务 CRUD 时输入的字段（id/status 系由管理器维护） */
export interface KnowledgeTaskInput {
  url: string;
  start?: string | null;
  end?: string | null;
  remark?: string | null;
  /** 下载清晰度任务级覆盖（null=跟随全局设置，ADR-0067） */
  quality?: string | null;
  /** 分P 序号（1 起；null/空=第 1 P，ADR-0067） */
  page?: number | null;
  /** 可选视频标题/UP主（聚合讯「保存至文献」入口预填，ticket 134/ADR-0068；解析后可被 [bz-info] 覆盖） */
  title?: string | null;
  uploader?: string | null;
  /** 视频时长（秒；ADR-0133 解析落库——多 P 时为所选分 P 时长，与弹窗保存同口径） */
  duration?: number | null;
}

/** 时间格式：mm:ss 或 hh:mm:ss(.S)，与工具 @jwbz/bili-downloader 一致（0.1s 精度） */
const TIME_RE = /^\d{1,3}:\d{1,2}(:\d{1,2}(\.\d{1,3})?)?$/;

/** 校验剪辑时间格式（宽松：mm:ss / hh:mm:ss / hh:mm:ss.S） */
export function isValidTime(t: string | null | undefined): boolean {
  if (!t || !t.trim()) return true; // 空 = 不剪辑整片
  return TIME_RE.test(t.trim());
}

/**
 * 宽松时间输入归一：分隔符 . - ：等一律视为时/分/秒分隔（12.2 / 12-2 → 12:02），
 * 单个数字 = 分钟（12 → 12:00，写秒用 0.30）；已是规范格式（含 hh:mm:ss.S 小数）原样保留。
 * 返回规范 mm:ss / hh:mm:ss 落库；无法解析返回 null，空串返回 ''（整片）。
 */
export function normalizeLooseTime(t: string | null | undefined): string | null {
  const s = (t ?? '').trim();
  if (!s) return '';
  if (TIME_RE.test(s)) return s;
  const parts = s.split(/[:：.。\-—_、，,\s]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const [a, b, c] = parts;
  let canon: string;
  if (c !== undefined) canon = `${a}:${b.padStart(2, '0')}:${c.padStart(2, '0')}`;
  else if (b !== undefined) canon = `${a}:${b.padStart(2, '0')}`;
  else canon = `${a}:00`;
  return TIME_RE.test(canon) ? canon : null;
}

/** 提取展示用链接文本：BV 号原样，链接取完整串；带参链接走净化剥追踪参数（issue 278），裸 BV/非 http 文本原样返回 */
export function normalizeUrl(raw: string): string {
  return normalizeSourceUrl(cleanUrlText(raw));
}

/** 时长（秒）→ 展示/时间框文本（ADR-0133）：<1h 用 M:SS，≥1h 用 H:MM:SS；非法（NaN/负）→ '0:00' */
export function secToTimeText(sec: number | null | undefined): string {
  const s = Number.isFinite(Number(sec)) && Number(sec) > 0 ? Math.round(Number(sec)) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
}

/**
 * 时间框文本 → 秒（ADR-0133 进度条联动用）：接受规范 M:SS / H:MM:SS(.S) 与宽松输入（走 normalizeLooseTime，
 * 单数字按分钟、12.2 → 12:02 等口径同落库）。空/非法 → null（调用方保持旧值）。
 */
export function timeTextToSec(t: string | null | undefined): number | null {
  const canon = normalizeLooseTime(t);
  if (!canon) return null; // ''（空）与 null（非法）都返回 null：范围选择必须两端都有值
  const parts = canon.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  return Math.round(parts[0]);
}

/** 状态是否终态（成功/失败） */
export function isTerminal(status: KnowledgeTaskStatus): boolean {
  return status === 'success' || status === 'failed';
}

export const KnowledgeData = {
  filePath: '',
  _store: null as JsonFileStore<any[]> | null,
  /** 旧数据文件 literature.json → knowledge.json 一次性迁移（ADR-0112：只复制不改写，旧文件保留在原处） */
  _legacyMigrated: false,

  /** 初始化（幂等）：固化文件路径与 store。未调用时 read/write 按当前设置惰性补齐（统一数据读写重构） */
  init(settings: KnowledgeSettingsLike) {
    const folder = ((settings.storagePath || 'CONFIG/STORAGE') as string).trim().replace(/\/+$/, '');
    this.filePath = folder + '/knowledge.json';
    this._store = jsonFileStore<any[]>(this.filePath);
  },

  /** 一次性迁移：knowledge.json 不存在而 literature.json 存在时原样复制一份（任务历史零丢失，ADR-0112） */
  async migrateLegacy(): Promise<void> {
    if (this._legacyMigrated) return;
    this._legacyMigrated = true;
    try {
      const app = getApp();
      if (app.vault.getAbstractFileByPath(this.filePath)) return;
      const legacyPath = this.filePath.replace(/knowledge\.json$/, 'literature.json');
      const legacy = app.vault.getAbstractFileByPath(legacyPath);
      if (legacy) await app.vault.create(this.filePath, await app.vault.read(legacy as any));
    } catch { /* 迁移失败不阻塞读取（store 按空数组起盘，下次打开再试） */ }
  },

  /** 惰性 store 获取：init 前调用时按当前设置补建（消除 init 前 _store 空指针） */
  _ensureStore(): JsonFileStore<any[]> {
    if (!this._store) this.init({ storagePath: tryGetSettings()?.storagePath });
    return this._store!;
  },

  /**
   * 读整表（形状兜底，issue 310）：文件被手改/旧格式写成非数组时按空库读取——
   * 不兜底的话 `data.push is not a function` 会直接打断面板刷新与保存（用户实测踩到）。
   * 读取本身不改盘；但 loadTasks/增删改都走 `_mutate`（读→改→写），首次调用即把文件收敛回数组形状。
   */
  async read(): Promise<any[]> {
    const data = await this._ensureStore().read();
    return Array.isArray(data) ? data : [];
  },
  async write(data: any): Promise<void> {
    return this._ensureStore().write(data);
  },

  /** 读改写事务：fn 基于磁盘现值改动，整体入 per-path 串行队列（D3 原语 1） */
  async _mutate<T>(fn: (data: any[]) => T | Promise<T>): Promise<T> {
    return enqueueFileTask(this.filePath, async () => {
      const data = await this.read();
      const result = await fn(data);
      await this.write(data);
      return result;
    });
  },

  /** 全量读取并统一字段形状（缺省补默认值，旧/手改数据零迁移） */
  async loadTasks(): Promise<KnowledgeTask[]> {
    // 旧数据文件一次性迁移先行（literature.json → knowledge.json，ADR-0112）
    await this.migrateLegacy();
    // 读改写整体入队：缺 id 补 id 的回写与并发任务写不互踩
    return this._mutate(async (raw) => {
      let needWrite = false;
      const tasks = raw.map((item: any) => {
        if (!item.id) {
          item.id = generateId('knowledge-task');
          needWrite = true;
        }
        return {
          id: item.id,
          url: item.url || '',
          start: item.start || null,
          end: item.end || null,
          status: (item.status as KnowledgeTaskStatus) || 'pending',
          reason: item.reason || null,
          remark: item.remark || null,
          notePath: item.notePath || null,
          videoPath: item.videoPath || null,
          created: item.created || moment().format('YYYY-MM-DD HH:mm:ss'),
          processedAt: item.processedAt || null,
          title: item.title || null,
          uploader: item.uploader || null,
          archived: item.archived === true,
          archivedAt: item.archivedAt || null,
          quality: item.quality || null,
          page: Number.isInteger(item.page) && Number(item.page) > 0 ? Number(item.page) : null,
          duration: Number.isFinite(Number(item.duration)) && Number(item.duration) > 0 ? Math.round(Number(item.duration)) : null,
        } as KnowledgeTask;
      });
      if (needWrite) await this.write(raw);
      return tasks;
    });
  },

  /** 追加一条待处理任务（队列尾 = 处理顺序尾） */
  addTask(input: KnowledgeTaskInput): Promise<KnowledgeTask> {
    const task: KnowledgeTask = {
      id: generateId('knowledge-task'),
      url: normalizeUrl(input.url),
      start: input.start?.trim() || null,
      end: input.end?.trim() || null,
      status: 'pending',
      reason: null,
      remark: input.remark?.trim() || null,
      title: input.title?.trim() || null,
      uploader: input.uploader?.trim() || null,
      notePath: null,
      videoPath: null,
      created: moment().format('YYYY-MM-DD HH:mm:ss'),
      processedAt: null,
      archived: false,
      archivedAt: null,
      quality: input.quality || null,
      page: Number.isInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : null,
      duration: Number.isFinite(Number(input.duration)) && Number(input.duration) > 0 ? Math.round(Number(input.duration)) : null,
    };
    return this._mutate((data) => {
      data.push(task);
      return task;
    });
  },

  updateTask(id: string, patch: Partial<KnowledgeTask>): Promise<void> {
    return this._mutate(async (data) => {
      const idx = data.findIndex((d: any) => d.id === id);
      if (idx === -1) throw new Error('任务不存在');
      data[idx] = { ...data[idx], ...patch, id: data[idx].id };
    }).then(() => undefined);
  },

  async deleteTask(id: string): Promise<void> {
    await this._mutate((data) => {
      const idx = data.findIndex((d: any) => d.id === id);
      if (idx !== -1) data.splice(idx, 1);
    });
  },

  /** 重试：失败/中止项回到待处理（保留旧结果字段，下次成功覆盖） */
  async retryTask(id: string): Promise<void> {
    await this.updateTask(id, {
      status: 'pending',
      reason: null,
      processedAt: null,
    });
  },

  /** 清空历史（archived 条目；主列表待处理/失败项不受影响，ADR-0067） */
  async clearHistory(): Promise<void> {
    await this._mutate((data) => {
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].archived === true) data.splice(i, 1);
      }
    });
  },
};
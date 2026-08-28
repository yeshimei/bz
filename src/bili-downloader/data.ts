/**
 * 文献盒数据管理器（视频转文献，bili-downloader 域；ADR-0066 正名「文献盒」）
 * bili-tasks.json 读写（jsonStore）、任务 CRUD、状态流转、时间格式校验。
 */
import moment from 'moment';
import { jsonStore } from '../core/json-store';
import { generateId } from '../core/utils';
import type { BiliTask, BiliTaskStatus } from './types';

export interface BiliSettingsLike {
  /** ADR-0009 共享数据路径（优先），旧独立路径不涉及 */
  storagePath?: string;
}

/** 任务 CRUD 时输入的字段（id/status 系由管理器维护） */
export interface BiliTaskInput {
  url: string;
  start?: string | null;
  end?: string | null;
  remark?: string | null;
  /** 下载清晰度任务级覆盖（null=跟随全局设置，ADR-0067） */
  quality?: string | null;
  /** 分P 序号（1 起；null/空=第 1 P，ADR-0067） */
  page?: number | null;
}

/** 时间格式：mm:ss 或 hh:mm:ss(.S)，与工具 @jwbz/bili-downloader 一致（0.1s 精度） */
const TIME_RE = /^\d{1,3}:\d{1,2}(:\d{1,2}(\.\d{1,3})?)?$/;

/** 校验剪辑时间格式（宽松：mm:ss / hh:mm:ss / hh:mm:ss.S） */
export function isValidTime(t: string | null | undefined): boolean {
  if (!t || !t.trim()) return true; // 空 = 不剪辑整片
  return TIME_RE.test(t.trim());
}

/** 提取展示用链接文本：BV 号原样，链接取完整串 */
export function normalizeUrl(raw: string): string {
  return raw.trim();
}

/** 状态是否终态（成功/失败） */
export function isTerminal(status: BiliTaskStatus): boolean {
  return status === 'success' || status === 'failed';
}

export const TasksData = {
  filePath: '',
  _store: null as ReturnType<typeof jsonStore> | null,

  init(settings: BiliSettingsLike) {
    const folder = ((settings.storagePath || 'CONFIG/STORAGE') as string).trim().replace(/\/+$/, '');
    this.filePath = folder + '/bili-tasks.json';
    this._store = jsonStore(this.filePath);
  },

  async read(): Promise<any[]> {
    return this._store!.read();
  },
  async write(data: any): Promise<void> {
    return this._store!.write(data);
  },

  /** 全量读取并统一字段形状（缺省补默认值，旧/手改数据零迁移） */
  async loadTasks(): Promise<BiliTask[]> {
    const raw = await this.read();
    let needWrite = false;
    const tasks = raw.map((item: any) => {
      if (!item.id) {
        item.id = generateId('bili-task');
        needWrite = true;
      }
      return {
        id: item.id,
        url: item.url || '',
        start: item.start || null,
        end: item.end || null,
        status: (item.status as BiliTaskStatus) || 'pending',
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
      } as BiliTask;
    });
    if (needWrite) await this.write(raw);
    return tasks;
  },

  /** 追加一条待处理任务（队列尾 = 处理顺序尾） */
  async addTask(input: BiliTaskInput): Promise<BiliTask> {
    const task: BiliTask = {
      id: generateId('bili-task'),
      url: normalizeUrl(input.url),
      start: input.start?.trim() || null,
      end: input.end?.trim() || null,
      status: 'pending',
      reason: null,
      remark: input.remark?.trim() || null,
      notePath: null,
      videoPath: null,
      created: moment().format('YYYY-MM-DD HH:mm:ss'),
      processedAt: null,
      title: null,
      uploader: null,
      archived: false,
      archivedAt: null,
      quality: input.quality || null,
      page: Number.isInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : null,
    };
    const data = await this.read();
    data.push(task);
    await this.write(data);
    return task;
  },

  async updateTask(id: string, patch: Partial<BiliTask>): Promise<void> {
    const data = await this.read();
    const idx = data.findIndex((d: any) => d.id === id);
    if (idx === -1) throw new Error('任务不存在');
    data[idx] = { ...data[idx], ...patch, id: data[idx].id };
    await this.write(data);
  },

  async deleteTask(id: string): Promise<void> {
    const data = await this.read();
    const idx = data.findIndex((d: any) => d.id === id);
    if (idx !== -1) {
      data.splice(idx, 1);
      await this.write(data);
    }
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
    const data = await this.read();
    const kept = data.filter((d: any) => d.archived !== true);
    await this.write(kept);
  },
};
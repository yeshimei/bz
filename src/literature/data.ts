/**
 * 文献盒数据管理器（视频转文献，literature 域；ADR-0066 正名「文献盒」，ADR-0072 迁出为新域）
 * literature.json 读写（jsonStore）、任务 CRUD、状态流转、时间格式校验。
 */
import moment from 'moment';
import { jsonFileStore, storageFile, type JsonFileStore } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import { generateId } from '../core/utils';
import type { LiteratureTask, LiteratureTaskStatus } from './types';

export interface LiteratureSettingsLike {
  /** ADR-0009 共享数据路径（优先），旧独立路径不涉及 */
  storagePath?: string;
}

/** 任务 CRUD 时输入的字段（id/status 系由管理器维护） */
export interface LiteratureTaskInput {
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

/** 提取展示用链接文本：BV 号原样，链接取完整串 */
export function normalizeUrl(raw: string): string {
  return raw.trim();
}

/** 状态是否终态（成功/失败） */
export function isTerminal(status: LiteratureTaskStatus): boolean {
  return status === 'success' || status === 'failed';
}

export const LiteratureData = {
  filePath: '',
  _store: null as JsonFileStore<any[]> | null,

  /** 初始化（幂等）：固化文件路径与 store。未调用时 read/write 按当前设置惰性补齐（统一数据读写重构） */
  init(settings: LiteratureSettingsLike) {
    const folder = ((settings.storagePath || 'CONFIG/STORAGE') as string).trim().replace(/\/+$/, '');
    this.filePath = folder + '/literature.json';
    this._store = jsonFileStore<any[]>(this.filePath);
  },

  /** 惰性 store 获取：init 前调用时按当前设置补建（消除 init 前 _store 空指针） */
  _ensureStore(): JsonFileStore<any[]> {
    if (!this._store) this.init({ storagePath: (tryGetSettings() as any)?.storagePath });
    return this._store!;
  },

  async read(): Promise<any[]> {
    return this._ensureStore().read();
  },
  async write(data: any): Promise<void> {
    return this._ensureStore().write(data);
  },

  /** 全量读取并统一字段形状（缺省补默认值，旧/手改数据零迁移） */
  async loadTasks(): Promise<LiteratureTask[]> {
    const raw = await this.read();
    let needWrite = false;
    const tasks = raw.map((item: any) => {
      if (!item.id) {
        item.id = generateId('literature-task');
        needWrite = true;
      }
      return {
        id: item.id,
        url: item.url || '',
        start: item.start || null,
        end: item.end || null,
        status: (item.status as LiteratureTaskStatus) || 'pending',
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
      } as LiteratureTask;
    });
    if (needWrite) await this.write(raw);
    return tasks;
  },

  /** 追加一条待处理任务（队列尾 = 处理顺序尾） */
  async addTask(input: LiteratureTaskInput): Promise<LiteratureTask> {
    const task: LiteratureTask = {
      id: generateId('literature-task'),
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
    };
    const data = await this.read();
    data.push(task);
    await this.write(data);
    return task;
  },

  async updateTask(id: string, patch: Partial<LiteratureTask>): Promise<void> {
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
/**
 * 备忘录数据管理器（备忘录.js DataManager 逐字移植）
 * memo.json 读写（jsonStore）、场景解析、条目 CRUD、公开课笔记检索。
 */
import moment from 'moment';
import { jsonStore } from '../core/json-store';
import { getApp } from '../core/app';
import { generateId, extractUrlAndDisplay } from '../core/utils';
import { storageFile } from '../core/storage';
import type { MemoItem, MemoPosition } from './types';

export interface BzSettingsLike {
  /** ADR-0009 共享数据路径（优先） */
  storagePath?: string;
  /** 旧独立路径（兼容保留） */
  todoFilePath?: string;
  showFileName?: boolean;
  autoPopupOnStart?: boolean;
  movieFolderPath?: string;
  /** 场景列表（逗号分隔，空则内置默认） */
  memoScenarios?: string;
  /** 打开笔记自动提醒 */
  openNoteReminder?: boolean;
  /** 默认排序方式：priority / due / created */
  memoSortMode?: string;
  /** 默认显示归档 */
  memoShowArchivedByDefault?: boolean;
  /** 新条目默认优先级：minor / important */
  memoDefaultPriority?: string;
  /** 完成后自动归档 */
  memoAutoArchive?: boolean;
  /** 新条目默认场景（空=第一个） */
  memoDefaultScene?: string;
  /** 到期时间格式：relative / absolute */
  memoDueFormat?: string;
}

/** 默认场景（DEFAULTSCENARIOS） */
const DEFAULTSCENARIOS = ['剪藏', '工作', '学习', '生活', '代码', '公开课'];

/** 场景列表解析：逗号分隔 → 去空/去重，空结果回退内置默认 */
export function parseScenarios(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [...DEFAULTSCENARIOS];
  const list = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length ? [...new Set(list)] : [...DEFAULTSCENARIOS];
}

/** 文件缓存中是否含「公开课」标签（正文标签或 frontmatter tags） */
function hasCourseTag(cache: any): boolean {
  if (cache.tags && (cache.tags as any[]).some((t) => t.tag === '#公开课' || t.tag === '公开课')) return true;
  const tags = cache.frontmatter?.tags;
  return !!tags && tags.includes('公开课'); // 数组与字符串均有 includes
}

export const DataManager = {
  todoFilePath: '',
  scenarios: [] as string[],
  _store: null as ReturnType<typeof jsonStore> | null,
  movieFolderPath: '我的/影视',

  init(settings: BzSettingsLike) {
    // ADR-0009：storagePath 优先，旧 todoFilePath 兼容兜底
    this.todoFilePath = storageFile('memo.json', (settings.storagePath || settings.todoFilePath) || 'CONFIG/STORAGE');
    this._store = jsonStore(this.todoFilePath);
    // 场景：设置可编辑（逗号分隔），空则内置默认
    this.scenarios = parseScenarios(settings.memoScenarios);
    this.movieFolderPath = settings.movieFolderPath || '我的/影视';
  },


  async read() {
    return this._store!.read();
  },
  async write(data: any) {
    return this._store!.write(data);
  },

  async loadItems(): Promise<MemoItem[]> {
    const raw = await this.read();
    let needWrite = false;
    const items = raw.map((item: any) => {
      if (!item.id) {
        item.id = generateId();
        needWrite = true;
      }
      // 统一字段形状（缺省补默认值，旧数据零迁移）
      const { title, scene, created } = item;
      return {
        id: item.id,
        title,
        scene,
        priority: item.priority || 'minor',
        created,
        completed: item.completed || null,
        due: item.due || null,
        notePath: item.notePath || null,
        notePosition: item.notePosition || null,
        scriptName: item.scriptName || null,
        courseName: item.courseName || null,
        coursePath: item.coursePath || null,
        linkedNote: item.linkedNote || null,
        url: item.url || null,
      };
    });
    if (needWrite) await this.write(raw);
    return items;
  },

  async addItem(item: MemoItem) {
    const data = await this.read();
    data.unshift(item as any);
    await this.write(data);
  },

  async updateItem(id: string, newData: Partial<MemoItem>) {
    const data = await this.read();
    const idx = data.findIndex((d: any) => d.id === id);
    if (idx === -1) throw new Error('条目不存在');
    const old = data[idx];
    // 如果新数据包含 title 但未提供 url，则自动提取
    if ((newData as any).title !== undefined && (newData as any).url === undefined) {
      const { url } = extractUrlAndDisplay((newData as any).title);
      (newData as any).url = url;
    }
    data[idx] = {
      ...old,
      ...newData,
      id: old.id,
      created: old.created,
    };
    await this.write(data);
  },

  async completeItem(id: string) {
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    await this.updateItem(id, { completed: now } as any);
  },

  async deleteItem(id: string) {
    const data = await this.read();
    const idx = data.findIndex((d: any) => d.id === id);
    if (idx !== -1) {
      data.splice(idx, 1);
      await this.write(data);
    }
  },

  /** 公开课笔记（影视目录中含 公开课 标签的文件） */
  async getCourseNotes(): Promise<{ name: string; path: string }[]> {
    const app = getApp();
    const result: { name: string; path: string }[] = [];
    for (const file of app.vault.getFiles()) {
      if (!file.path.startsWith(this.movieFolderPath) || file.extension !== 'md') continue;
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) continue;
      if (hasCourseTag(cache)) result.push({ name: file.basename, path: file.path });
    }
    return result;
  },

  getScenarios(): string[] {
    return this.scenarios;
  },
};

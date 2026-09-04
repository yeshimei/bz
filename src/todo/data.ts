/**
 * 待办（todo）域数据层：memo.json 读写（与旧 memo 域共用同一数据文件）
 * 自 memo/data.ts 迁移（对象单例 DataManager 语义逐字保留）：jsonStore 读写、
 * 字段归一补齐、条目 CRUD、场景解析、公开课笔记检索。
 * 纯数据层（无 DOM）；UI 层经 state/refresh 回调刷新。
 */
import moment from 'moment';
import { jsonStore } from '../core/json-store';
import { getApp } from '../core/app';
import { generateId, extractUrlAndDisplay } from '../core/utils';
import { enqueueFileTask, storageFile } from '../core/storage';
import type { TodoItem } from './types';

export interface TodoSettingsLike {
  /** ADR-0009 共享数据路径 */
  storagePath?: string;
  /** 场景列表（逗号分隔，空则内置默认；与旧 memo 共用 memoScenarios 键） */
  memoScenarios?: string;
  /** 公开课笔记目录（与 memo 共用 cinemaFolderPath） */
  cinemaFolderPath?: string;
}

/** 默认场景（与旧 memo 完全一致，保证同数据文件语义不漂移） */
export const DEFAULT_SCENARIOS = ['剪藏', '工作', '学习', '生活', '代码', '公开课'];

/** 场景列表解析：逗号分隔 → 去空/去重，空结果回退内置默认 */
export function parseScenarios(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [...DEFAULT_SCENARIOS];
  const list = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length ? [...new Set(list)] : [...DEFAULT_SCENARIOS];
}

/** 文件缓存中是否含「公开课」标签（正文标签或 frontmatter tags） */
function hasCourseTag(cache: any): boolean {
  if (cache.tags && (cache.tags as any[]).some((t) => t.tag === '#公开课' || t.tag === '公开课')) return true;
  const tags = cache.frontmatter?.tags;
  return !!tags && tags.includes('公开课'); // 数组与字符串均有 includes
}

/** 条目字段归一（缺省补默认值，旧数据零迁移）——与旧 memo loadItems 逐字段等价 */
export function normalizeItem(item: any): TodoItem {
  return {
    id: item.id,
    title: item.title,
    scene: item.scene,
    priority: item.priority || 'minor',
    created: item.created,
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
}

export const TodoData = {
  todoFilePath: '',
  scenarios: [] as string[],
  _store: null as ReturnType<typeof jsonStore> | null,
  cinemaFolderPath: '我的/影视',

  init(settings: TodoSettingsLike) {
    // memo.json 路径（ADR-0009 共享数据路径）
    this.todoFilePath = storageFile('memo.json', settings.storagePath || 'CONFIG/STORAGE');
    this._store = jsonStore(this.todoFilePath);
    // 场景：设置可编辑（逗号分隔），空则内置默认（与旧 memo 共用 memoScenarios 键）
    this.scenarios = parseScenarios(settings.memoScenarios);
    this.cinemaFolderPath = settings.cinemaFolderPath || '我的/影视';
  },

  async read() {
    return this._store!.read();
  },
  async write(data: any) {
    return this._store!.write(data);
  },

  /** 加载条目：读 + 缺 id 生成 + 字段归一（与旧 memo 一致：有缺 id 整写回补）。
   *  id 前缀用 generateId() 默认 'item'——与旧 memo 域同写 memo.json，保证两域对同文件
   *  的 id 形态完全一致（T5）。读改写整体入 per-path 串行队列（写竞态收敛，对照 memo/data.ts） */
  async loadItems(): Promise<TodoItem[]> {
    return enqueueFileTask(this.todoFilePath, async () => {
      const raw = await this.read();
      let needWrite = false;
      const items = raw.map((item: any) => {
        if (!item.id) {
          item.id = generateId();
          needWrite = true;
        }
        // 统一字段形状（缺省补默认值，旧数据零迁移）
        return normalizeItem(item);
      });
      if (needWrite) await this.write(raw);
      return items;
    });
  },

  async addItem(item: TodoItem) {
    return enqueueFileTask(this.todoFilePath, async () => {
      const data = await this.read();
      data.unshift(item as any);
      await this.write(data);
    });
  },

  async updateItem(id: string, newData: Partial<TodoItem>) {
    return enqueueFileTask(this.todoFilePath, async () => {
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
    });
  },

  async completeItem(id: string) {
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    await this.updateItem(id, { completed: now } as any);
  },

  /** 删除条目；返回被删条目的原索引（未找到返回 -1），供撤销时插回原位 */
  async deleteItem(id: string): Promise<number> {
    return enqueueFileTask(this.todoFilePath, async () => {
      const data = await this.read();
      const idx = data.findIndex((d: any) => d.id === id);
      if (idx !== -1) {
        data.splice(idx, 1);
        await this.write(data);
      }
      return idx;
    });
  },

  /** 撤销删除：把删除前的条目快照插回原索引（越界/未传则头部插入，对齐 addItem 语义） */
  async restoreItem(item: TodoItem, idx?: number) {
    return enqueueFileTask(this.todoFilePath, async () => {
      const data = await this.read();
      const at = idx !== undefined && idx >= 0 && idx <= data.length ? idx : 0;
      data.splice(at, 0, item as any);
      await this.write(data);
    });
  },

  /** 批量迁移条目场景（场景重命名/删除用）：scene === from → to，返回迁移条数。
   *  同源兼容：只改条目 scene 字段，写法与 memo 域读写同文件同形，memo 侧下次 loadItems 即读到 */
  async updateSceneBulk(from: string, to: string): Promise<number> {
    return enqueueFileTask(this.todoFilePath, async () => {
      const data = await this.read();
      let n = 0;
      data.forEach((d: any) => {
        if (d.scene === from) {
          d.scene = to;
          n++;
        }
      });
      if (n > 0) await this.write(data);
      return n;
    });
  },

  /** 公开课笔记（影视目录中含 公开课 标签的文件） */
  async getCourseNotes(): Promise<{ name: string; path: string }[]> {
    const app = getApp();
    const result: { name: string; path: string }[] = [];
    for (const file of app.vault.getFiles()) {
      if (!file.path.startsWith(this.cinemaFolderPath) || file.extension !== 'md') continue;
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

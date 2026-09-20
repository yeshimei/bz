/**
 * 备忘录（memo）域数据层：memo.json 读写（与旧 memo 域共用同一数据文件）
 * 自 memo/data.ts 迁移（对象单例 DataManager 语义逐字保留）：jsonStore 读写、
 * 字段归一补齐、条目 CRUD、场景解析、公开课笔记检索。
 * 纯数据层（无 DOM）；UI 层经 state/refresh 回调刷新。
 */
import moment from 'moment';
import { jsonStore } from '../core/json-store';
import { getApp } from '../core/app';
import { generateId, extractUrlAndDisplay, isUnderFolder } from '../core/utils';
import { backupOriginal, enqueueFileTask, storageFile } from '../core/storage';
import { notify } from '../core/notice';
import type { MemoItem } from './types';

export interface MemoSettingsLike {
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

/** 条目字段归一（缺省补默认值，旧数据零迁移）——与旧 memo loadItems 逐字段等价。
 *  健壮性兜底（memo2-func #2）：title/scene 做 String 兜底（外部同步合并冲突可能产出
 *  null/非串形态，不兜底会炸渲染面 esc(it.title)/it.title.length）；due 识别 iOS 延后
 *  落盘的 'NaN-…' 脏串（memo2-func #4 遗留清洗）置 null——getDueStatus 对 NaN 串的
 *  字符串比较行为不定，到期标记永久失真，清掉回归「无截止」。 */
export function normalizeItem(item: any): MemoItem {
  const due = item.due == null ? null : String(item.due);
  return {
    id: item.id,
    title: item.title == null ? '' : String(item.title),
    scene: item.scene == null ? '' : String(item.scene),
    priority: item.priority || 'minor',
    created: item.created,
    completed: item.completed || null,
    due: due && !/^NaN/i.test(due) ? due : null,
    notePath: item.notePath || null,
    notePosition: item.notePosition || null,
    scriptName: item.scriptName || null,
    courseName: item.courseName || null,
    coursePath: item.coursePath || null,
    linkedNote: item.linkedNote || null,
    url: item.url || null,
  };
}

/** 剥离条目残留回滚字段（recur/checklist）：2026-09-19 用户拍板字段清除——两功能（周期重复/清单子任务）已随回滚废弃不再恢复。
 *  只剥键不删条目（周期克隆出的「下一期」条目剥后即普通条目，保留）；其余字段一字不损。写盘单点消毒（MemoData.write / file-sync commit 共用）。 */
export function purgeStaleFields<T>(data: T): T {
  if (!Array.isArray(data)) return data;
  const stale = (it: any) => !!it && typeof it === 'object' && ('recur' in it || 'checklist' in it);
  if (!data.some(stale)) return data;
  return data.map((it: any) => {
    if (!stale(it)) return it;
    const rest = { ...it };
    delete rest.recur;
    delete rest.checklist;
    return rest;
  }) as unknown as T;
}

export const MemoData = {
  memoFilePath: '',
  scenarios: [] as string[],
  _store: null as ReturnType<typeof jsonStore> | null,
  cinemaFolderPath: '我的/影视',
  /** 公开课笔记会话级缓存（memo2-efficiency 新-3）：每次开编辑弹窗都全 vault 扫一遍纯空耗，
   *  结果在弹窗生命周期内不变；init（场景/目录设置变更）时失效。 */
  _courseNotesCache: null as { name: string; path: string }[] | null,

  init(settings: MemoSettingsLike) {
    // memo.json 路径（ADR-0009 共享数据路径）
    this.memoFilePath = storageFile('memo.json', settings.storagePath || 'CONFIG/STORAGE');
    this._store = jsonStore(this.memoFilePath);
    // 场景：设置可编辑（逗号分隔），空则内置默认（与旧 memo 共用 memoScenarios 键）
    this.scenarios = parseScenarios(settings.memoScenarios);
    this.cinemaFolderPath = settings.cinemaFolderPath || '我的/影视';
    this._courseNotesCache = null; // 目录设置可能变更，公开课笔记缓存失效
  },

  async read() {
    return this._store!.read();
  },
  async write(data: any) {
    // 写盘单点消毒：残留 recur/checklist 任何回写路径不得再落盘（见 purgeStaleFields 注）
    return this._store!.write(purgeStaleFields(data));
  },

  /** 加载条目：读 + 缺 id 生成 + 字段归一（与旧 memo 一致：有缺 id 整写回补）。
   *  id 前缀用 generateId() 默认 'item'——与旧 memo 域同写 memo.json，保证两域对同文件
   *  的 id 形态完全一致（T5）。读改写整体入 per-path 串行队列（写竞态收敛，对照 memo/data.ts） */
  async loadItems(): Promise<MemoItem[]> {
    return enqueueFileTask(this.memoFilePath, async () => {
      const raw = await this.read();
      // E23：合法 JSON 但非数组（对象/标量/null 等损坏形态）——此前 raw.map 抛 TypeError
      // 被上层吞掉，面板静默空白。按 D1 契约原样留档后重建空清单，不再无声丢形态。
      if (!Array.isArray(raw)) {
        const backup = await backupOriginal(getApp(), this.memoFilePath);
        await this.write([]);
        try {
          notify(
            backup
              ? `备忘录数据文件损坏（内容不是列表），原内容已留档到 ${backup}，已重建空清单继续使用`
            : '备忘录数据文件损坏（内容不是列表），已重建空清单继续使用',
            { type: 'warning', dedupeKey: 'memo-loaditems-corrupt' }
          );
        } catch (e) {
          /* 无 DOM 环境（纯数据层 node 测试等）静默 */
        }
        return [];
      }
      let needWrite = false;
      // 元素级守卫（memo2-func #2）：数组内 null/非对象元素此前在 item.id 直接 TypeError，
      // 全部读路径无 catch → 面板永久空白且无提示。剔除坏元素并置清档标记（D1 口径留痕于写盘）。
      const items: MemoItem[] = [];
      for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          needWrite = true;
          continue;
        }
        if (!item.id) {
          item.id = generateId();
          needWrite = true;
        }
        // 残留回滚字段（recur/checklist）也触发回写清档：载入即剥（内存态 normalizeItem 白名单本就不带，盘上见 write 消毒）
        if ('recur' in item || 'checklist' in item) needWrite = true;
        // iOS 延后落盘的 NaN 脏 due（memo2-func #4 遗留清洗）：内存归一为 null 之外，
        // 盘上脏串也要清掉——就地置 null（同上补 id 的 raw 就地修模式）并置回写标记
        if (item.due != null && /^NaN/i.test(String(item.due))) {
          item.due = null;
          needWrite = true;
        }
        // 统一字段形状（缺省补默认值，旧数据零迁移）
        items.push(normalizeItem(item));
      }
      if (needWrite) await this.write(raw.filter((it: any) => it && typeof it === 'object' && !Array.isArray(it)));
      return items;
    });
  },

  async addItem(item: MemoItem) {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      data.unshift(item);
      await this.write(data);
    });
  },

  async updateItem(id: string, newData: Partial<MemoItem>) {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      const idx = data.findIndex((d: any) => d.id === id);
      if (idx === -1) throw new Error('条目不存在');
      const old = data[idx];
      // 如果新数据包含 title 但未提供 url，则自动提取
      if (newData.title !== undefined && newData.url === undefined) {
        const { url } = extractUrlAndDisplay(newData.title);
        newData.url = url;
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
    await this.updateItem(id, { completed: now });
  },

  /** 删除条目；返回被删条目的原索引（未找到返回 -1），供撤销时插回原位 */
  async deleteItem(id: string): Promise<number> {
    return enqueueFileTask(this.memoFilePath, async () => {
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
  async restoreItem(item: MemoItem, idx?: number) {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      const at = idx !== undefined && idx >= 0 && idx <= data.length ? idx : 0;
      data.splice(at, 0, item);
      await this.write(data);
    });
  },

  /** 批量迁移条目场景（场景重命名/删除用）：scene === from → to，返回迁移条数。
   *  同源兼容：只改条目 scene 字段，写法与 memo 域读写同文件同形，memo 侧下次 loadItems 即读到 */
  async updateSceneBulk(from: string, to: string): Promise<number> {
    return enqueueFileTask(this.memoFilePath, async () => {
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

  /** 公开课笔记（影视目录中含 公开课 标签的文件；结果走会话级缓存，见 _courseNotesCache 注） */
  async getCourseNotes(): Promise<{ name: string; path: string }[]> {
    if (this._courseNotesCache) return this._courseNotesCache;
    const app = getApp();
    const result: { name: string; path: string }[] = [];
    for (const file of app.vault.getFiles()) {
      // 目录边界（memo2-func #15 / memo2-arch A6）：裸 startsWith 会把相邻同名目录
      // （如「我的/影视花絮/」）误命中，走 core isUnderFolder 单源（dir + '/' 口径）
      if (!isUnderFolder(this.cinemaFolderPath, file.path) || file.extension !== 'md') continue;
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) continue;
      if (hasCourseTag(cache)) result.push({ name: file.basename, path: file.path });
    }
    this._courseNotesCache = result;
    return result;
  },

  getScenarios(): string[] {
    return this.scenarios;
  },
};

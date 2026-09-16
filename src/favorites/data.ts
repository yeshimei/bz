/**
 * 收藏本数据管理器（ticket 11）：源码 收藏本.js L28-66 逐字。
 * D2 可靠写契约收编：全部「读→改→写」事务整体入 core per-path 串行队列
 * （enqueueFileTask，键 = favorites.json 路径）——UI（DataManager）与后台文件同步
 * （file-sync）并发写同文件不再互踩；坏文件由 jsonFileStore 留档降级（原语 3）。
 * read/getAll 仍为无锁读；write 保留整段覆盖原义（供既有调用方，队列内勿重入）。
 *
 * issue 363 标签自定义：标签定义存伴生文件 favorites.tags.json（favorites.json 根结构
 * 不动），本类扩展 loadTags/saveTags（经 config.setTags 单源注入）与 updateTagLabelBulk
 * （改名/删除时条目 tags[]+type 批量跟随，范式 = memo updateSceneBulk）。
 */
import { jsonStore } from '../core/json-store';
import { enqueueFileTask } from '../core/storage';
import { getApp } from '../core/app';
import { DEFAULT_TAGS, getTagsPath, normalizeTags, setTags } from './config';
import type { FavTag, FavoritesItem } from './types';

export class DataManager {
  store: ReturnType<typeof jsonStore>;
  /** 数据文件路径（per-path 串行队列键；与 store 同路径） */
  filePath: string;
  /** 标签定义文件路径（issue 363 伴生文件，与 favorites.json 同目录）与独立 store */
  tagsPath: string;
  tagsStore: ReturnType<typeof jsonStore>;

  constructor(storagePath: string) {
    this.store = jsonStore(storagePath);
    this.filePath = storagePath;
    this.tagsPath = getTagsPath(storagePath);
    this.tagsStore = jsonStore(this.tagsPath);
  }

  async read(): Promise<FavoritesItem[]> {
    return this.store.read();
  }

  async write(data: FavoritesItem[]): Promise<void> {
    return this.store.write(data);
  }

  /** 读改写事务：fn 基于磁盘现值就地改动（或返回新数组），整体入串行队列执行 */
  async mutateAll(fn: (data: FavoritesItem[]) => FavoritesItem[] | void): Promise<FavoritesItem[]> {
    return enqueueFileTask(this.filePath, async () => {
      const data = await this.read();
      const next = fn(data) || data;
      await this.write(next);
      return next;
    });
  }

  add(item: FavoritesItem): Promise<FavoritesItem[]> {
    return this.mutateAll((data) => {
      data.unshift(item);
    });
  }

  delete(id: string): Promise<FavoritesItem[]> {
    return this.mutateAll((data) => {
      const idx = data.findIndex((d) => d.id === id);
      if (idx !== -1) data.splice(idx, 1);
    });
  }

  /**
   * 撤销删除（ticket 141 通病 1）：删除前取到的完整条目原样插回（含 archived/llmConfig 等全部字段），
   * 不走 add() 重排——同 id 已存在（并发写回）则幂等跳过。参照 review/data.ts restoreItem 先例。
   */
  restoreItem(item: FavoritesItem): Promise<void> {
    return this.mutateAll((data) => {
      if (data.some((d) => d.id === item.id)) return;
      data.push(item);
    }).then(() => undefined);
  }

  update(id: string, newData: Partial<FavoritesItem>): Promise<FavoritesItem[]> {
    return this.mutateAll((data) => {
      const idx = data.findIndex((d) => d.id === id);
      if (idx !== -1) data[idx] = { ...data[idx], ...newData };
    });
  }

  async getAll(): Promise<FavoritesItem[]> {
    return await this.read();
  }

  // ==================== 标签定义（issue 363：favorites.tags.json） ====================

  /**
   * 载入标签定义并注入 config 单源（app.init 时调用）：文件缺失 → 回退内置 9 类 seed
   * （零迁移，不建文件不写盘）；文件在 → 归一化（坏行剔除/缺 id 补）后生效；空数组/坏
   * JSON（jsonStore 留档降级为 []）同样走 seed 回退。
   */
  async loadTags(): Promise<FavTag[]> {
    let raw: unknown = null;
    // 存在探测在前：jsonStore.read 对缺失文件会自建 [] 文件，seed 回退语义下不应落盘
    try {
      if (getApp().vault.getAbstractFileByPath(this.tagsPath)) {
        raw = await this.tagsStore.read();
      }
    } catch {
      raw = null;
    }
    const tags = normalizeTags(raw);
    const next = tags.length ? tags : DEFAULT_TAGS;
    setTags(next);
    return next;
  }

  /** 保存标签定义（管理界面增删改排序的唯一落盘点）：写盘 + 注入单源即时生效 */
  async saveTags(tags: FavTag[]): Promise<void> {
    await enqueueFileTask(this.tagsPath, async () => {
      await this.tagsStore.write(tags);
    });
    setTags(tags);
  }

  /**
   * 条目标签批量跟随（改名/删除迁移；范式 = memo updateSceneBulk）：tags[] 内 from → to
   * 且 type 同步（type = tags[0] 派生字段），返回迁移条数；零匹配不写盘。
   */
  async updateTagLabelBulk(from: string, to: string): Promise<number> {
    if (!from || from === to) return 0;
    return enqueueFileTask(this.filePath, async () => {
      const data = await this.read();
      let n = 0;
      data.forEach((d) => {
        if ((d.tags || []).includes(from)) {
          d.tags = d.tags.map((t) => (t === from ? to : t));
          if (d.type === from) d.type = to;
          n++;
        }
      });
      if (n > 0) await this.write(data);
      return n;
    });
  }
}

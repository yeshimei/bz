/**
 * 收藏本数据管理器（ticket 11）：源码 收藏本.js L28-66 逐字。
 * D2 可靠写契约收编：全部「读→改→写」事务整体入 core per-path 串行队列
 * （enqueueFileTask，键 = favorites.json 路径）——UI（DataManager）与后台文件同步
 * （file-sync）并发写同文件不再互踩；坏文件由 jsonFileStore 留档降级（原语 3）。
 * read/getAll 仍为无锁读；write 保留整段覆盖原义（供既有调用方，队列内勿重入）。
 */
import { jsonStore } from '../core/json-store';
import { enqueueFileTask } from '../core/storage';
import type { FavoritesItem } from './types';

export class DataManager {
  store: ReturnType<typeof jsonStore>;
  /** 数据文件路径（per-path 串行队列键；与 store 同路径） */
  filePath: string;

  constructor(storagePath: string) {
    this.store = jsonStore(storagePath);
    this.filePath = storagePath;
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
}

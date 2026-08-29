/**
 * 收藏本数据管理器（ticket 11）：源码 收藏本.js L28-66 逐字。
 */
import { jsonStore } from '../core/json-store';
import type { FavoritesItem } from './types';

export class DataManager {
  store: ReturnType<typeof jsonStore>;

  constructor(storagePath: string) {
    this.store = jsonStore(storagePath);
  }

  async read(): Promise<FavoritesItem[]> {
    return this.store.read();
  }

  async write(data: FavoritesItem[]): Promise<void> {
    return this.store.write(data);
  }

  async add(item: FavoritesItem): Promise<FavoritesItem[]> {
    const data = await this.read();
    data.unshift(item);
    await this.write(data);
    return data;
  }

  async delete(id: string): Promise<FavoritesItem[]> {
    const data = await this.read();
    const idx = data.findIndex((d) => d.id === id);
    if (idx !== -1) {
      data.splice(idx, 1);
      await this.write(data);
    }
    return data;
  }

  /**
   * 撤销删除（ticket 141 通病 1）：删除前取到的完整条目原样插回（含 archived/llmConfig 等全部字段），
   * 不走 add() 重排——同 id 已存在（并发写回）则幂等跳过。参照 review/data.ts restoreItem 先例。
   */
  async restoreItem(item: FavoritesItem): Promise<void> {
    const data = await this.read();
    if (data.some((d) => d.id === item.id)) return;
    data.push(item);
    await this.write(data);
  }

  async update(id: string, newData: Partial<FavoritesItem>): Promise<FavoritesItem[]> {
    const data = await this.read();
    const idx = data.findIndex((d) => d.id === id);
    if (idx !== -1) {
      data[idx] = { ...data[idx], ...newData };
      await this.write(data);
    }
    return data;
  }

  async getAll(): Promise<FavoritesItem[]> {
    return await this.read();
  }
}

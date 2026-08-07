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

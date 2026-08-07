/**
 * jsonStore（Q3.js window.__utils 移植）
 * read：不存在 → 建目录+建文件（[]）；解析失败 → 重置 []。
 * write：存在 modify / 不存在 create（建目录）。原实现无锁、无原子写，逐字保留。
 */
import { getApp } from './app';

export interface JsonStore {
  read(): Promise<any[]>;
  write(data: any): Promise<void>;
}

export function jsonStore(filePath: string): JsonStore {
  return {
    async read() {
      const app = getApp();
      let f = app.vault.getAbstractFileByPath(filePath);
      if (!f) {
        const d = filePath.substring(0, filePath.lastIndexOf('/'));
        if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
        await app.vault.create(filePath, JSON.stringify([], null, 2));
        return [];
      }
      try {
        return JSON.parse(await app.vault.read(f as any));
      } catch (e) {
        await app.vault.modify(f as any, JSON.stringify([], null, 2));
        return [];
      }
    },
    async write(data) {
      const app = getApp();
      const c = JSON.stringify(data, null, 2);
      let f = app.vault.getAbstractFileByPath(filePath);
      if (f) {
        await app.vault.modify(f as any, c);
      } else {
        const d = filePath.substring(0, filePath.lastIndexOf('/'));
        if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
        await app.vault.create(filePath, c);
      }
    },
  };
}

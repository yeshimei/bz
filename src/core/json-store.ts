/**
 * jsonStore（Q3.js window.__utils 移植）
 * read：不存在 → 建目录+建文件（[]）；解析失败 → 原文件原样留档（CONFIG/.CORRUPT/<名>.<yyyymmdd-hhmmss>.bak，D1 契约）后重建 []。
 * write：存在 modify / 不存在 create（建目录）。
 * P1-31：首建 TOCTOU——探测后 create 撞「已存在」（并发 read/write 抢先建成）时降级为重读/modify，
 *        数据不丢、不抛错；目录缺失仍会创建。
 * 存储文件格式与 API 签名不变；实现无锁、无原子写。
 *
 * 统一数据读写重构：实现迁移至 core/storage.ts 的 jsonFileStore（语义逐字保留），
 * 本模块保持薄封装与既有签名（JsonStore 契约 + 测试全绿），新域请直接用 storage.ts。
 */
import { jsonFileStore, type JsonFileStore } from './storage';

export interface JsonStore {
  read(): Promise<any[]>;
  write(data: any): Promise<void>;
}

export function jsonStore(filePath: string): JsonStore {
  return jsonFileStore<any[]>(filePath) as JsonFileStore<any[]> as JsonStore;
}

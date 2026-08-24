/**
 * jsonStore（Q3.js window.__utils 移植）
 * read：不存在 → 建目录+建文件（[]）；解析失败 → 原文件改名留档（.corrupt-<时间戳>）后重建 []。
 * write：存在 modify / 不存在 create（建目录）。
 * P1-31：首建 TOCTOU——探测后 create 撞「已存在」（并发 read/write 抢先建成）时降级为重读/modify，
 *        数据不丢、不抛错；目录缺失仍会创建。
 * 存储文件格式与 API 签名不变；实现仍无锁、无原子写（本次仅授权修复损坏处理与并发首建）。
 */
import { getApp } from './app';

export interface JsonStore {
  read(): Promise<any[]>;
  write(data: any): Promise<void>;
}

/** Obsidian vault.create 对已存在路径抛错（消息含 "already exists"）——并发首建竞态判定 */
function isAlreadyExistsError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /already exist/i.test(msg);
}

export function jsonStore(filePath: string): JsonStore {
  /** 首建前确保父目录存在（目录不存在才创建，保持原行为） */
  async function ensureDir(app: any): Promise<void> {
    const d = filePath.substring(0, filePath.lastIndexOf('/'));
    if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
  }

  /**
   * 容错首建：create 成功返回 true；撞「已存在」且文件确已出现（并发首建竞态，P1-31）
   * 返回 false 由调用方降级为重读/modify；其余错误照抛。
   */
  async function createIfMissing(app: any, content: string): Promise<boolean> {
    await ensureDir(app);
    try {
      await app.vault.create(filePath, content);
      return true;
    } catch (e) {
      if (isAlreadyExistsError(e) && app.vault.getAbstractFileByPath(filePath)) return false;
      throw e;
    }
  }

  return {
    async read() {
      const app = getApp();
      let f = app.vault.getAbstractFileByPath(filePath);
      if (!f) {
        const created = await createIfMissing(app, JSON.stringify([], null, 2));
        if (created) return [];
        // 并发降级（P1-31）：抢先写入方已建好文件 → 读取其真实内容，不用空库覆盖
        f = app.vault.getAbstractFileByPath(filePath);
        if (!f) return [];
      }
      try {
        return JSON.parse(await app.vault.read(f as any));
      } catch (e) {
        // P1-32：损坏不再静默清库——原文件改名留档后再重建空库
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = filePath + '.corrupt-' + stamp;
        try {
          await app.vault.rename(f as any, backupPath);
          console.warn('[json-store] ' + filePath + ' 解析失败，原内容留档至 ' + backupPath + '，已重建空库');
        } catch (renameErr) {
          console.warn('[json-store] ' + filePath + ' 留档失败（' + backupPath + '），原地重建空库', renameErr);
        }
        const fresh = app.vault.getAbstractFileByPath(filePath);
        if (fresh) {
          await app.vault.modify(fresh as any, JSON.stringify([], null, 2));
        } else {
          await createIfMissing(app, JSON.stringify([], null, 2));
        }
        return [];
      }
    },
    async write(data) {
      const app = getApp();
      const c = JSON.stringify(data, null, 2);
      let f = app.vault.getAbstractFileByPath(filePath);
      if (f) {
        await app.vault.modify(f as any, c);
        return;
      }
      const created = await createIfMissing(app, c);
      if (created) return;
      // 并发降级（P1-31）：read 首建空文件抢先 → 对最新句柄 modify，数据不丢
      const cur = app.vault.getAbstractFileByPath(filePath);
      if (!cur) throw new Error('json-store: create 竞态降级失败（' + filePath + '）');
      await app.vault.modify(cur as any, c);
    },
  };
}

/**
 * 脸谱域数据层（issue 435）：CONFIG/STORAGE/people.json，jsonFileStore 读写 +
 * enqueueFileTask 串行写队列（读→改→写事务整体入队，防并发写互相覆盖——review 同款）。
 * 聊天原文不落盘（ADR-0191）：本文件只有人物卡 / 事件 / 画像 / 导入元数据。
 */
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import type { FaceDigest, ImportRecord, PeopleData, PersonEntry } from './types';
import { emptyPeopleData } from './types';

/** 数据文件路径（storagePath 设置键可覆盖基目录，缺省 CONFIG/STORAGE） */
export function getPeopleFilePath(): string {
  const s = tryGetSettings() as { storagePath?: string } | null;
  return storageFile('people.json', (s && s.storagePath) || 'CONFIG/STORAGE');
}

export class PeopleStore {
  private readonly app: unknown;
  private readonly filePath: string;

  constructor(app: unknown) {
    this.app = app;
    this.filePath = getPeopleFilePath();
  }

  private open() {
    return jsonFileStore<PeopleData>(this.filePath, { defaultValue: emptyPeopleData, app: this.app });
  }

  /** 人物列表（建卡时间升序） */
  async list(): Promise<PersonEntry[]> {
    return enqueueFileTask(this.filePath, async () => {
      const data = await this.open().read();
      return [...data.people].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }

  /** 新增或整体替换人物卡（按 id） */
  async upsert(entry: PersonEntry): Promise<void> {
    await enqueueFileTask(this.filePath, async () => {
      const store = this.open();
      const data = await store.read();
      const i = data.people.findIndex((p) => p.id === entry.id);
      if (i >= 0) data.people[i] = entry;
      else data.people.push(entry);
      await store.write(data);
    });
  }

  /** 追加一条导入记录 */
  async appendImport(id: string, rec: ImportRecord): Promise<void> {
    await this.mutate(id, (p) => {
      p.imports.push(rec);
    });
  }

  /** 覆盖脸谱（重画） */
  async setDigest(id: string, digest: FaceDigest): Promise<void> {
    await this.mutate(id, (p) => {
      p.digest = digest;
    });
  }

  async remove(id: string): Promise<void> {
    await enqueueFileTask(this.filePath, async () => {
      const store = this.open();
      const data = await store.read();
      data.people = data.people.filter((p) => p.id !== id);
      await store.write(data);
    });
  }

  /** 队列内单人物变更（不存在抛错——静默丢失比失败更糟） */
  private async mutate(id: string, fn: (p: PersonEntry) => void): Promise<void> {
    await enqueueFileTask(this.filePath, async () => {
      const store = this.open();
      const data = await store.read();
      const p = data.people.find((x) => x.id === id);
      if (!p) throw new Error(`人物不存在: ${id}`);
      fn(p);
      await store.write(data);
    });
  }
}

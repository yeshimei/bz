/**
 * 脸谱域数据层（issue 435）：CONFIG/STORAGE/people.json，jsonFileStore 读写 +
 * enqueueFileTask 串行写队列（读→改→写事务整体入队，防并发写互相覆盖——review 同款）。
 * 聊天原文不落盘（ADR-0191）：本文件只有人物卡 / 事件 / 画像 / 导入元数据。
 */
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import type { FaceDigest, ImportRecord, ManualEvent, PeopleData, PersonEntry, PersonProfile } from './types';
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

  /** 设置人物档案（传 undefined 清空） */
  async updateProfile(id: string, profile: PersonProfile | undefined): Promise<void> {
    await this.mutate(id, (p) => {
      if (profile) p.profile = profile;
      else delete p.profile;
    });
  }

  /** 改称呼 */
  async rename(id: string, name: string): Promise<void> {
    await this.mutate(id, (p) => {
      p.name = name;
    });
  }

  /** 追加一条随手记（按日期序保持有序） */
  async addManualEvent(id: string, ev: ManualEvent): Promise<void> {
    await this.mutate(id, (p) => {
      (p.manualEvents ??= []).push(ev);
      p.manualEvents.sort((a, b) => a.ts.localeCompare(b.ts));
    });
  }

  /** 删除一条随手记 */
  async removeManualEvent(id: string, evId: string): Promise<void> {
    await this.mutate(id, (p) => {
      p.manualEvents = (p.manualEvents ?? []).filter((e) => e.id !== evId);
    });
  }

  /** 记录增量提炼锚点（毫秒时间戳） */
  async setLastProcessedTs(id: string, ts: number): Promise<void> {
    await this.mutate(id, (p) => {
      p.lastProcessedTs = ts;
    });
  }

  /**
   * 合并人物：把 from 的导入记录 / 随手记 / 档案并进 to，然后移除 from。
   * 用于同一人在数据里出现两个 wxid 的情况（两个不同号、或改过号）。
   * 两份画像不自动混（混出来没有意义）：to 没有画像时才继承 from 的。
   */
  async mergeInto(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) return;
    await enqueueFileTask(this.filePath, async () => {
      const store = this.open();
      const data = await store.read();
      const from = data.people.find((p) => p.id === fromId);
      const to = data.people.find((p) => p.id === toId);
      if (!from || !to) throw new Error(`人物不存在: ${!from ? fromId : toId}`);
      to.imports.push(...from.imports);
      to.imports.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
      to.manualEvents = [...(to.manualEvents ?? []), ...(from.manualEvents ?? [])].sort((a, b) => a.ts.localeCompare(b.ts));
      if (!to.profile && from.profile) to.profile = from.profile;
      if (!to.digest && from.digest) to.digest = from.digest;
      to.lastProcessedTs = Math.max(to.lastProcessedTs ?? 0, from.lastProcessedTs ?? 0);
      data.people = data.people.filter((p) => p.id !== fromId);
      await store.write(data);
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

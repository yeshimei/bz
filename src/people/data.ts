/**
 * 脸谱域人物卡数据层（issue 435 建域；issue 467 / ADR-0194 改造为保库记录门面）：
 * 明文 people.json 已退役——人物卡现在是保险库里每位联系人一条加密记录（SafeNote.kind =
 * 'people'）的 `person` 段，读写全部经 PeopleSafeStore（共锁同库，上锁即不可读）。
 * 本类保留 446 收编形态的方法面（list / upsert / appendImport / setDigest / …），
 * ui / jobs 两侧调用点零漂移；「人物不存在抛错」语义沿用（静默丢失比失败更糟）。
 */
import { getPeopleSafeStore, type PeopleSafeStore } from './safe-store';
import type { FaceDigest, ImportRecord, ManualEvent, PersonEntry, PersonProfile } from './types';

export class PeopleStore {
  constructor(_app?: unknown) {
    // app 参数保留（历史调用点 new PeopleStore(app) 兼容）；存储已迁入保库记录，不再落 vault 明文层
    void _app;
  }

  private async safe(): Promise<PeopleSafeStore> {
    return getPeopleSafeStore();
  }

  /** 人物列表（建卡时间升序；未解锁抛错——门禁在面板入口） */
  async list(): Promise<PersonEntry[]> {
    const safe = await this.safe();
    const all = await safe.readAll();
    return [...all.values()].map((r) => r.person).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** 新增或整体替换人物卡（按 id；无记录自动落骨架） */
  async upsert(entry: PersonEntry): Promise<void> {
    const safe = await this.safe();
    await safe.write(entry.id, (rec) => {
      rec.person = entry;
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
    const safe = await this.safe();
    const all = await safe.readAll();
    const from = all.get(fromId)?.person;
    const to = all.get(toId)?.person;
    if (!from || !to) throw new Error(`人物不存在: ${!from ? fromId : toId}`);
    await safe.write(toId, (rec) => {
      const t = rec.person;
      t.imports.push(...from.imports);
      t.imports.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
      t.manualEvents = [...(t.manualEvents ?? []), ...(from.manualEvents ?? [])].sort((a, b) => a.ts.localeCompare(b.ts));
      if (!t.profile && from.profile) t.profile = from.profile;
      if (!t.digest && from.digest) t.digest = from.digest;
      t.lastProcessedTs = Math.max(t.lastProcessedTs ?? 0, from.lastProcessedTs ?? 0);
    });
    await safe.removeContact(fromId);
  }

  async remove(id: string): Promise<void> {
    const safe = await this.safe();
    if (!(await safe.read(id))) throw new Error(`人物不存在: ${id}`);
    await safe.removeContact(id);
  }

  /** 单人物卡变更（不存在抛错——静默丢失比失败更糟） */
  private async mutate(id: string, fn: (p: PersonEntry) => void): Promise<void> {
    const safe = await this.safe();
    if (!(await safe.read(id))) throw new Error(`人物不存在: ${id}`);
    await safe.write(id, (rec) => {
      fn(rec.person);
    });
  }
}

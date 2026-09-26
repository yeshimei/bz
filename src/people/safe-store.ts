/**
 * 脸谱保库记录存储层（issue 467 / ADR-0194）：脸谱全部数据 = 保险库里**每个联系人一条加密
 * 记录**（SafeNote.kind = 'people'）——人物卡（原 people.json 的 PersonEntry）+ 聊天仓
 * （原 people-preview.json 的一只 StoreContact，结构沿用 466 的 v2 不另起）+ 该人生成任务
 * 条目（原 people-jobs.json 队列内该人一条）+ 头像附件 → **一个 .enc 文件**。改一个人只
 * 重写他那一份。
 *
 * 共锁同库（ADR-0194 决策 5）：注入与保险库 / 密码本同一 SafeManager 单例（同一主密码、
 * 同一 .safe.enc 清单），本域不新造锁；订阅 encrypt:unlock-changed——**上锁即清明文缓存**，
 * 订阅 encrypt:changed——外部清单变化即弃缓存（下次读现解）。
 *
 * 索引加密：联系人定位靠清单条目的虚拟 path（CONFIG/STORAGE/people/<talker>；清单整体封在
 * .safe.enc 密文里，未解锁读不到任何联系人名）；标题 = 联系人称呼，同样只活在密文清单里。
 *
 * 头像：SafeAttachment 承载（blobRef 密文镜像），渲染时 decryptAttachmentOriginal 解成
 * **内存 data URL**，不落明文文件；keptShared 置真——脸谱不删源（存量明文头像目录退役但
 * 不删文件，新头像源在 vault 外数据根，本就不归保库删）。
 *
 * encrypt 边界（主线程收口完成）：SafeNote.kind / LockNoteInput.kind 联合类型已并入 'people'，
 * removeNote 的删原文件守卫同样排除 'people'（虚拟占位无原文件），保险库面板四处资产过滤
 * （计数/锁屏统计/概览/笔记列表桌面+移动端）已排除脸谱记录—— 与 'password-vault' 先例同款口径。
 */
import { onDomainEvent } from '../core/domain-bus';
import {
  ENCRYPT_CHANGED_CHANNEL,
  ENCRYPT_UNLOCK_CHANGED_CHANNEL,
  fingerprintOf,
  type LockNoteInput,
  type SafeAttachment,
  type SafeManager,
} from '../encrypt/data';
import type { PersonEntry } from './types';
import type { StoreContact } from './datasource';
import type { PersonJob } from './jobs';

/** 保库记录的 kind 值（ADR-0194；清单内加密存储，encrypt 面板侧过滤待主线程收口） */
export const PEOPLE_KIND = 'people';

/** 保库记录清单条目的虚拟 path 前缀（路径即索引：后缀 = talker；path 从不落真实文件） */
export const PEOPLE_NOTE_PATH_PREFIX = 'CONFIG/STORAGE/people/';

/**
 * 保库记录体（一个联系人 = 一条 = 一个 .enc）。
 * store 沿用聊天仓 v2 的 StoreContact 结构（466 / ADR-0197），不另起结构；
 * job 为该人的生成任务条目（引擎保证同人至多一个任务）。
 */
export interface PeopleSafeRecord {
  version: 1;
  /** 人物卡（原 people.json 一条） */
  person: PersonEntry;
  /** 聊天仓（原 people-preview.json 一只桶；avatar 路径字段退役，头像走附件） */
  store: StoreContact;
  /** 该人的生成任务（无任务为 null；结构与 people-jobs.json 队列元素同形） */
  job?: PersonJob | null;
}

/** 头像写入入参：原始字节 base64 + 扩展名（jpg/png/webp/gif） */
export interface AvatarInput {
  base64: string;
  ext: string;
}

/** 由 talker 反查清单条目（path 后缀即 talker，不解密正文即可定位） */
export function peopleNotePath(talker: string): string {
  return PEOPLE_NOTE_PATH_PREFIX + talker;
}

function talkerOfPath(path: string): string | null {
  if (!path || !path.startsWith(PEOPLE_NOTE_PATH_PREFIX)) return null;
  const talker = path.slice(PEOPLE_NOTE_PATH_PREFIX.length);
  return talker || null;
}

/** 空聊天仓（迁移 / 建记录时的缺省桶；datasource 的根结构类已随明文文件退役，此处就地构造） */
export function emptyStoreContact(nowIso = new Date().toISOString()): StoreContact {
  return { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: nowIso };
}

/** 空人物卡（占位卡语义与 452 一致：有仓没卡的人先落一张空卡） */
export function emptyPersonEntry(id: string, name: string, nowIso: string): PersonEntry {
  return { id, name, createdAt: nowIso, imports: [] };
}

/** 记录体防御性归一（旧版本 / 外部改动的缺字段补齐，坏数据不炸面板） */
function normalizeRecord(talker: string, parsed: unknown): PeopleSafeRecord {
  const raw = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
  const personRaw = (raw.person && typeof raw.person === 'object' ? raw.person : {}) as Record<string, unknown>;
  const person: PersonEntry = {
    ...(personRaw as unknown as PersonEntry),
    id: String(personRaw.id ?? talker),
    name: String(personRaw.name ?? talker),
    createdAt: String(personRaw.createdAt ?? new Date().toISOString()),
    imports: Array.isArray(personRaw.imports) ? (personRaw.imports as PersonEntry['imports']) : [],
  };
  const storeRaw = (raw.store && typeof raw.store === 'object' ? raw.store : {}) as Record<string, unknown>;
  const store: StoreContact = {
    ...(storeRaw as unknown as StoreContact),
    msgs: Array.isArray(storeRaw.msgs) ? (storeRaw.msgs as StoreContact['msgs']) : [],
    watermarkSid: Number(storeRaw.watermarkSid ?? 0) || 0,
    stats:
      storeRaw.stats && typeof storeRaw.stats === 'object'
        ? (storeRaw.stats as StoreContact['stats'])
        : emptyStoreContact().stats,
    updatedAt: String(storeRaw.updatedAt ?? ''),
  };
  const job = raw.job && typeof raw.job === 'object' ? (raw.job as PersonJob) : null;
  return { version: 1, person, store, job };
}

/**
 * 保库记录读写器（注入 SafeManager——测试传内存假件 / MockVault 上的真件，同密码本先例）。
 * 同一 talker 的读改写经实例内 per-talker 串行链互斥（引擎落任务与面板落脸谱并发不互吞）。
 */
export class PeopleSafeStore {
  private readonly safe: SafeManager;
  /** 解密记录缓存（明文）；上锁 / 外部清单变更即清 */
  private cache = new Map<string, PeopleSafeRecord>();
  /** 头像 data URL 缓存；同上 */
  private avatarUrls = new Map<string, string>();
  /** per-talker 写串行链（读→改→写整体入队，防并发互吞） */
  private chains = new Map<string, Promise<unknown>>();
  private offUnlock: (() => void) | null = null;
  private offChanged: (() => void) | null = null;

  constructor(safe: SafeManager) {
    this.safe = safe;
    // 上锁即清明文缓存（ADR-0194 决策 5）：任意路径上锁（面板/锁屏/安全模式）都够不到本实例，
    // 单源订阅解锁态广播（密码本同款接法）
    this.offUnlock = onDomainEvent<{ unlocked: boolean }>(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
      if (evt?.unlocked !== false) return;
      this.clearPlainCaches();
    });
    // 外部清单变化（保险库面板增删 / 日记域写清单）：记录条目可能被增删，缓存一律作废
    this.offChanged = onDomainEvent(ENCRYPT_CHANGED_CHANNEL, () => {
      this.clearPlainCaches();
    });
  }

  /** 底层 SafeManager（解锁态判定 / 测试断言用） */
  get safeManager(): SafeManager {
    return this.safe;
  }

  /** 解锁态 = 共锁保险库的解锁态 */
  get unlocked(): boolean {
    return this.safe.unlocked;
  }

  /** 清明文缓存（记录 + 头像 data URL）；上锁事件与外部变更订阅共用同一收口 */
  clearPlainCaches(): void {
    this.cache.clear();
    this.avatarUrls.clear();
  }

  /** 退订域事件（测试隔离 / 卸载清理用） */
  destroy(): void {
    this.offUnlock?.();
    this.offUnlock = null;
    this.offChanged?.();
    this.offChanged = null;
  }

  private noteOf(talker: string) {
    return this.safe.manifest.notes.find((n) => (n as { kind?: string }).kind === PEOPLE_KIND && n.path === peopleNotePath(talker)) || null;
  }

  private requireUnlocked(): void {
    if (!this.safe.unlocked) throw new Error('保险库未解锁，脸谱数据不可读');
  }

  /** 全部联系人 talker（清单级定位，不解密正文；未解锁抛错——索引也不可读） */
  talkers(): string[] {
    this.requireUnlocked();
    const out: string[] = [];
    for (const n of this.safe.manifest.notes) {
      if ((n as { kind?: string }).kind !== PEOPLE_KIND) continue;
      const t = talkerOfPath(n.path);
      if (t) out.push(t);
    }
    return out.sort((a, b) => a.localeCompare(b, 'zh'));
  }

  /** 是否已有该联系人的保库记录（迁移幂等键；不解密正文） */
  has(talker: string): boolean {
    this.requireUnlocked();
    return this.noteOf(talker) !== null;
  }

  /** 该人记录的附件数（头像存在性校验用；不解密） */
  attachmentCount(talker: string): number {
    this.requireUnlocked();
    return this.noteOf(talker)?.attachments?.length ?? 0;
  }

  /** 读一位联系人的保库记录（缓存优先；无记录返回 null） */
  async read(talker: string): Promise<PeopleSafeRecord | null> {
    this.requireUnlocked();
    const hit = this.cache.get(talker);
    if (hit) return hit;
    const note = this.noteOf(talker);
    if (!note) return null;
    const plain = await this.safe.decryptNoteBody(note);
    if (plain === null) throw new Error('保库记录解密失败');
    let parsed: unknown;
    try {
      parsed = JSON.parse(plain);
    } catch {
      throw new Error('保库记录损坏（解密成功但解析失败）');
    }
    const rec = normalizeRecord(talker, parsed);
    this.cache.set(talker, rec);
    return rec;
  }

  /** 读全部联系人记录（面板墙一次拉全量） */
  async readAll(): Promise<Map<string, PeopleSafeRecord>> {
    const out = new Map<string, PeopleSafeRecord>();
    for (const t of this.talkers()) {
      const rec = await this.read(t);
      if (rec) out.set(t, rec);
    }
    return out;
  }

  /**
   * 头像 → 内存 data URL（渲染用；不解密正文，只解附件原始层）。
   * 无头像 / 解密失败返回 null；不落任何明文文件。
   */
  async avatarDataUrl(talker: string): Promise<string | null> {
    this.requireUnlocked();
    const hit = this.avatarUrls.get(talker);
    if (hit !== undefined) return hit;
    const note = this.noteOf(talker);
    const att: SafeAttachment | undefined = note?.attachments?.[0];
    if (!att) {
      this.avatarUrls.set(talker, '');
      return null;
    }
    const b64 = await this.safe.decryptAttachmentOriginal(att);
    if (!b64) {
      this.avatarUrls.set(talker, '');
      return null;
    }
    const ext = (att.path.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    const url = `data:${mime};base64,${b64}`;
    this.avatarUrls.set(talker, url);
    return url;
  }

  /**
   * 读改写一位联系人的记录（per-talker 串行）：
   * mutate 在最新记录上就地改（无记录则先落空骨架）；opts.avatar 传 AvatarInput 为设置头像、
   * 传 null 为移除头像、不传为不动。头像字节与既有密文指纹一致时零重写。
   * 返回 'created' | 'updated' | 'unchanged'（头像一致且无其他变化语义由调用方自行判定，
   * 这里只区分记录级动作）。
   */
  write(
    talker: string,
    mutate: (rec: PeopleSafeRecord) => void | Promise<void>,
    opts?: { avatar?: AvatarInput | null }
  ): Promise<'created' | 'updated'> {
    const prev = this.chains.get(talker) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(() => this.writeSerial(talker, mutate, opts));
    this.chains.set(talker, run);
    return run;
  }

  private async writeSerial(
    talker: string,
    mutate: (rec: PeopleSafeRecord) => void | Promise<void>,
    opts?: { avatar?: AvatarInput | null }
  ): Promise<'created' | 'updated'> {
    this.requireUnlocked();
    const existing = this.noteOf(talker);
    let rec: PeopleSafeRecord;
    if (existing) {
      const cur = await this.read(talker);
      if (!cur) throw new Error('保库记录读取失败');
      rec = cur;
    } else {
      const nowIso = new Date().toISOString();
      rec = { version: 1, person: emptyPersonEntry(talker, talker, nowIso), store: emptyStoreContact(nowIso), job: null };
    }
    await mutate(rec);

    // 头像判定：与既有附件指纹一致 → 零重写；不一致 / 无中生有 / 移除 → 附件层重建
    let avatar: AvatarInput | null | undefined = opts?.avatar;
    let avatarChanged = false;
    const oldAtt = existing?.attachments?.[0];
    if (avatar !== undefined) {
      const newFp = avatar ? await fingerprintOf(avatar.base64) : null;
      const oldFp = oldAtt?.fingerprint ?? null;
      avatarChanged = newFp !== oldFp;
      if (avatar && !avatarChanged) avatar = undefined; // 同图跳过（同步重复导不重加密）
    }

    if (!existing) {
      await this.lockNoteFresh(talker, rec, avatar ?? null);
      this.cache.set(talker, rec);
      return 'created';
    }
    if (avatarChanged) {
      // 无公开 API 替换单个附件 → 整条重建（removeNote 删旧镜像 + lockNote 重加密；
      // 头像只在同步导入时变化，低频路径）。重建前记录体已是最新（mutate 已跑）。
      await this.safe.removeNote(existing.id);
      await this.lockNoteFresh(talker, rec, avatar ?? null);
      this.cache.set(talker, rec);
      return 'updated';
    }
    const json = JSON.stringify(rec);
    await this.safe.updateNotePayload(existing.id, json); // 原子覆盖同一密文镜像，不堆积孤儿
    this.cache.set(talker, rec);
    if (avatar === null) this.avatarUrls.delete(talker);
    return 'updated';
  }

  /** 首建 / 重建整条记录（含头像附件；keptShared 置真——脸谱不删任何源文件） */
  private async lockNoteFresh(talker: string, rec: PeopleSafeRecord, avatar: AvatarInput | null): Promise<void> {
    const input: LockNoteInput = {
      path: peopleNotePath(talker),
      title: `脸谱：${rec.person.name || talker}`,
      kind: PEOPLE_KIND,
      content: JSON.stringify(rec),
      attachments: avatar
        ? [
            {
              path: `${peopleNotePath(talker)}/avatar.${avatar.ext}`,
              kind: 'image' as const,
              data: avatar.base64,
              // 不删源：存量明文头像目录退役不删文件；新头像源在 vault 外数据根（issue 338 他引保护通道复用）
              keptShared: true,
            },
          ]
        : [],
    };
    await this.safe.lockNote(input);
    this.avatarUrls.delete(talker);
  }

  /** 删除一位联系人的整条保库记录（连同头像镜像；二次确认由 UI 层管） */
  async removeContact(talker: string): Promise<void> {
    this.requireUnlocked();
    const note = this.noteOf(talker);
    if (note) await this.safe.removeNote(note.id);
    this.cache.delete(talker);
    this.avatarUrls.delete(talker);
  }

  /** 清空全部联系人的聊天仓（设置页「清空聊天仓」；不动人物卡与任务——原 MessageStore.clear 同语义） */
  async clearStores(): Promise<void> {
    this.requireUnlocked();
    for (const talker of this.talkers()) {
      await this.write(talker, (rec) => {
        rec.store = emptyStoreContact();
      });
    }
  }
}

// ---------------- 共享实例（注入缝） ----------------

let shared: PeopleSafeStore | null = null;

/** 测试注入缝：替换 / 清除共享实例（传 null 还原懒建） */
export function setPeopleSafeStoreForTests(store: PeopleSafeStore | null): void {
  shared?.destroy();
  shared = store;
}

/**
 * 共享 PeopleSafeStore（面板 / 引擎 / 迁移共用一份缓存与串行链）。
 * 首次调用经 encrypt 公开入口取共锁单例（函数级延迟解析——ADR-0002；与 encrypt 不构成环）。
 */
export async function getPeopleSafeStore(): Promise<PeopleSafeStore> {
  if (!shared) {
    const enc = await import('../encrypt');
    shared = new PeopleSafeStore(enc.getSafeManager());
  }
  return shared;
}

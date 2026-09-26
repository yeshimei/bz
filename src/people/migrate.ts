/**
 * 存量迁移（issue 467 / ADR-0194）：把明文时代的脸谱数据一次性迁进保库记录——
 *   people.json（人物卡）+ people-preview.json（聊天仓，**仅 v2**，v1 按 466 判废口径不迁）
 *   + people-jobs.json（任务队列按人拆条）+ 库内明文头像（CONFIG/FACES/<名>/avatar.<ext>）
 *   → 每位联系人一条加密记录（SafeNote.kind = 'people'）。
 *
 * 触发点：打开脸谱面板（解锁门禁通过之后、引擎启动之前）调一次。
 *
 * 幂等键 = talker 已有保库记录（peopleNotePath 命中即跳过）。半途崩溃收敛：记录按人逐条
 * 落盘（每条 saveManifest 都是提交点），崩溃后重跑——已迁的人跳过、剩下的补迁，全部落盘
 * 且逐条回读校验通过后才清理旧明文文件；校验不过则**保留现场**不删（宁留明文不冒丢数据险），
 * 由 UI 提示重试。
 *
 * 旧文件处置：people.json / people-preview.json / people-jobs.json 迁移校验通过后**删除**
 * （清空会留一具空壳继续骗 Obsidian 同步与用户视线；三份明文的全部信息已各就各位）。
 * CONFIG/FACES 明文头像目录**只退役不删除**——已有文件不主动清（不可逆操作，票面明令）。
 */
import { bytesToBase64 } from '../encrypt/data';
import { storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import type { App } from 'obsidian';
import type { PeopleData } from './types';
import type { MessageStoreData, StoreContact } from './datasource';
import { emptyStoreContact, type AvatarInput, type PeopleSafeStore, type PeopleSafeRecord } from './safe-store';
import type { JobsData, PersonJob } from './jobs';

/** 迁移结果（UI 通知口径） */
export interface MigrateOutcome {
  /** 本次新迁人数（幂等重跑为 0） */
  migrated: number;
  /** 已在保库记录里、本次跳过的人数 */
  skipped: number;
  /** 迁移后清理掉的旧明文文件（vault 相对路径） */
  cleaned: string[];
  /** 校验未过而保留的旧明文文件（非空 = 迁移不完整，未删任何东西） */
  keptBack: string[];
}

/** 旧明文三件的 vault 路径（storagePath 设置键可覆盖基目录，与旧读侧同一解析） */
function legacyPaths(): { people: string; preview: string; jobs: string } {
  const s = tryGetSettings() as { storagePath?: string } | null;
  const base = (s && s.storagePath) || 'CONFIG/STORAGE';
  return {
    people: storageFile('people.json', base),
    preview: storageFile('people-preview.json', base),
    jobs: storageFile('people-jobs.json', base),
  };
}

/** 只读直读旧 json（不走 jsonFileStore——缺失/损坏绝不触发「重建落盘」，保住迁移现场） */
async function readLegacyJson<T>(adapter: { exists(p: string): Promise<boolean>; read(p: string): Promise<string> }, path: string): Promise<T | null> {
  try {
    if (!(await adapter.exists(path))) return null;
    const raw = await adapter.read(path);
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 头像扩展名探测序（旧导入同序） */
const AVA_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/** 判定路径是否 vault 相对（无盘符、无根斜杠；旧 455 数据可能是库外绝对路径） */
function isVaultRelative(p: string): boolean {
  const norm = String(p ?? '').replace(/\\/g, '/');
  return Boolean(norm) && !/^[A-Za-z]:\//.test(norm) && !norm.startsWith('/');
}

/** fs（仅桌面端；读数据根侧的库外头像残留。globalThis 取窗体——node 测试环境无 window 不炸） */
function getFs(): any {
  const w = (globalThis as any).window;
  if (!w || !w.require) return null;
  try {
    return w.require('fs');
  } catch {
    return null;
  }
}

/**
 * 旧头像路径 → base64（vault 相对走 adapter 二进制读；库外绝对路径走 fs）。
 * 找不到 / 读不动返回 null（记录不带头像，不阻断迁移）。
 */
async function readAvatarInput(app: App, path: string | undefined): Promise<AvatarInput | null> {
  const p = String(path ?? '').trim();
  if (!p) return null;
  try {
    if (isVaultRelative(p)) {
      const adapter = (app.vault as any).adapter;
      if (!adapter) return null;
      // 后缀探测兜底：旧数据存的路径可能已不含扩展名变体，按序补探
      for (const candidate of [p, ...AVA_EXTS.map((e) => `${p.replace(/\.[^.]+$/, '')}.${e}`)]) {
        try {
          if (!(await adapter.exists(candidate))) continue;
          const buf = await adapter.readBinary(candidate);
          const bytes = new Uint8Array(buf);
          if (!bytes.length) continue;
          const ext = (candidate.split('.').pop() || 'jpg').toLowerCase();
          return { base64: bytesToBase64(bytes), ext };
        } catch {
          /* 换下一候选 */
        }
      }
      return null;
    }
    const fs = getFs();
    if (!fs || !fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p) as Uint8Array;
    if (!buf || !buf.length) return null;
    const ext = String(p.split('.').pop() ?? '').toLowerCase();
    return AVA_EXTS.includes(ext) ? { base64: bytesToBase64(buf), ext } : null;
  } catch {
    return null;
  }
}

/** 旧头像取数：按已存路径读字节（CONFIG/FACES 明文目录只读不删——退役非清除） */
async function resolveLegacyAvatar(app: App, contact: StoreContact): Promise<AvatarInput | null> {
  return readAvatarInput(app, contact?.avatar);
}

/**
 * 执行迁移（幂等；须已解锁）。见文件头。
 */
export async function migrateLegacyPeopleData(app: App, safe: PeopleSafeStore): Promise<MigrateOutcome> {
  if (!safe.unlocked) throw new Error('保险库未解锁，迁移不能执行');
  const adapter = (app.vault as any).adapter;
  const paths = legacyPaths();

  // 1. 读旧明文三件（只读；缺哪件算哪件）
  const people = await readLegacyJson<PeopleData>(adapter, paths.people);
  const preview = await readLegacyJson<MessageStoreData>(adapter, paths.preview);
  const jobs = await readLegacyJson<JobsData>(adapter, paths.jobs);

  const cards = Array.isArray(people?.people) ? people!.people : [];
  // 聊天仓只认 v2（466 / ADR-0197 决策 6：v1 缺回溯原料，判废不迁，从数据根重导）
  const contacts: Record<string, StoreContact> =
    preview && (preview as { version?: number }).version === 2 && preview.contacts && typeof preview.contacts === 'object'
      ? preview.contacts
      : {};
  const legacyJobs: PersonJob[] = Array.isArray(jobs?.queue) ? jobs!.queue : [];

  // 2. 迁移对象 = 三处来源的 talker 并集
  const talkers = new Set<string>();
  for (const c of cards) if (c?.id) talkers.add(String(c.id));
  for (const name of Object.keys(contacts)) if (name) talkers.add(name);
  for (const j of legacyJobs) if (j?.talker) talkers.add(String(j.talker));

  let migrated = 0;
  let skipped = 0;
  for (const talker of talkers) {
    if (safe.has(talker)) {
      skipped += 1; // 幂等键：已有记录即视为已迁（半途崩溃重跑的收敛点）
      continue;
    }
    const card = cards.find((c) => String(c.id) === talker);
    const contact = contacts[talker];
    // 同人至多一个任务（引擎不变量）；取末条兜底旧文件异常
    const jobList = legacyJobs.filter((j) => String(j?.talker ?? '') === talker);
    const job = jobList.length ? jobList[jobList.length - 1] : null;
    const nowIso = new Date().toISOString();
    const avatar = await resolveLegacyAvatar(app, contact ?? ({} as StoreContact));
    await safe.write(
      talker,
      (rec: PeopleSafeRecord) => {
        rec.person = card ?? { id: talker, name: talker, createdAt: nowIso, imports: [] };
        if (contact) {
          // 头像路径字段退役：头像本体走附件，路径不再进密文记录
          const { avatar: _dropped, ...rest } = contact;
          void _dropped;
          rec.store = { ...rest };
        } else {
          rec.store = emptyStoreContact(nowIso);
        }
        rec.job = job;
      },
      { avatar: avatar ?? null }
    );
    migrated += 1;
  }

  // 3. 校验（迁移完整落盘的确认）：逐人回读可解析、旧数据带头像的记录附件在位
  const verifyFail: string[] = [];
  for (const talker of talkers) {
    try {
      const rec = await safe.read(talker);
      if (!rec) {
        verifyFail.push(talker);
        continue;
      }
      const expectedAvatar = Boolean(contacts[talker]?.avatar);
      if (expectedAvatar && safe.attachmentCount(talker) === 0) verifyFail.push(talker);
    } catch {
      verifyFail.push(talker);
    }
  }

  // 4. 清理：全部校验通过才删旧明文三件（删前逐件确认存在；删除不可逆，宁留不险）
  const cleaned: string[] = [];
  const keptBack: string[] = [];
  if (verifyFail.length === 0) {
    for (const path of [paths.people, paths.preview, paths.jobs]) {
      try {
        if (await adapter.exists(path)) {
          await adapter.remove(path);
          cleaned.push(path);
        }
      } catch {
        keptBack.push(path); // 单件删除失败不吞：如实上报（数据已双份，重跑幂等）
      }
    }
  } else {
    keptBack.push(paths.people, paths.preview, paths.jobs);
  }

  return { migrated, skipped, cleaned, keptBack };
}

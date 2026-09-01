/**
 * 保险箱数据层（encrypt 域，safe 数据）
 * 移出式清单容器加密：SafeManager 负责 清单(.safe.enc) 读写、密文镜像（正文+附件）、
 * 加锁(lockNote) / 还原取出(restoreNote，还原成功即删除镜像与条目)。
 *
 * 数据落地（ADR-0016 平铺点前缀布局，用户拍板）：
 *   <encryptRoot>/.safe.enc            整库唯一加密清单（不含正文本体，点前缀）
 *   <encryptRoot>/.随机名.enc           正文密文镜像（平铺、随机名、点前缀）
 *   <encryptRoot>/.随机名.enc           附件原始层密文镜像（平铺、每文件独立随机名）
 *   <encryptRoot>/.随机名.enc           附件预览层密文镜像（同上）
 *
 * 点前缀目录/文件 Obsidian 侧栏一律隐藏（防误删）；还原/删除全靠清单 path+ref 映射，
 * 文件名不含任何可辨识信息。旧 附件/<原路径> 布局不再读取（ADR-0016：彻底不兼容）。
 *
 * 密钥：每个 blob 直接用主密码经 CryptoService.encrypt 独立加密（同 passwords.enc 模型）。
 * 依赖方向（ADR-0002）：core ← 本层；不挂 window；import CryptoService 复用密码本。
 */
import { getApp } from '../core/app';
import { emitDomainEvent } from '../core/domain-bus';
import { CryptoService, clearCryptoKeyCache } from '../password/crypto';

/** 保险箱数据变更通道（ADR-0078：密码本/保险库等外部消费者订阅；写操作后广播） */
export const ENCRYPT_CHANGED_CHANNEL = 'encrypt:changed' as const;
/** 保险箱解锁态变更通道（ADR-0078：外部消费者订阅解锁/上锁） */
export const ENCRYPT_UNLOCK_CHANGED_CHANNEL = 'encrypt:unlock-changed' as const;

/** 附件类型 */
export type AttachmentKind = 'image' | 'video';

/** 清单里的一条加密附件 */
export interface SafeAttachment {
  /** 原 vault 路径（如 我的/影视/x.png） */
  path: string;
  kind: AttachmentKind;
  /** 原始层镜像相对路径（encryptRoot 下，平铺随机名） */
  blobRef: string;
  /** 原始层密文文件大小（字节，便于 UI 展示） */
  blobSize: number;
  /** 原始层判重指纹（SHA-256(原始 base64)，覆盖冲突安全用） */
  fingerprint: string;
  /** 是否有预览层 */
  hasPreview: boolean;
  /** 预览层镜像相对路径（encryptRoot 下，平铺随机名） */
  previewRef: string;
}

/** 清单里的一条加密笔记 */
export interface SafeNote {
  id: string;
  /**
   * 来源类型：缺省=普通加密笔记；
   * 'diary-entry'=加密日记条目（ADR-0017，保险箱面板过滤，日记面板单独读）；
   * 'password-vault'=密码本整表（与保险箱共享主密码/解锁态，密码本面板单独读写）。
   */
  kind?: 'diary-entry' | 'password-vault';
  /** 原笔记路径（如 我的/日记/2025-06-01.md） */
  path: string;
  /** 列表展示标题 */
  title: string;
  createdAt: string;
  /** 正文密文镜像相对路径（encryptRoot 下，平铺随机名 .enc；与附件同级） */
  contentRef: string;
  attachments: SafeAttachment[];
}

/** 清单明文结构（整体加密进 safe.enc） */
export interface SafeManifest {
  version: number;
  notes: SafeNote[];
}

/** 体检问题类别：dead-entry/orphan-file 可勾选清理；损坏与缺失类只报告（删了就是真丢数据） */
export type HealthCategory = 'dead-entry' | 'orphan-file' | 'corrupted-body' | 'corrupted-attachment' | 'missing-attachment';

/** 体检发现的单个问题条目（勾选清理用；key 为唯一键） */
export interface HealthItem {
  cat: HealthCategory;
  /** 唯一键：dead-entry=`entry:<id>`；orphan-file=`file:<文件名>`；损坏/缺失类仅供展示 */
  key: string;
  /** 展示标签（条目标题 / 文件名 / 附件路径） */
  label: string;
  /** 关联清单条目 id（dead-entry/corrupted-body） */
  noteId?: string;
  /** 镜像相对路径（orphan-file/损坏/缺失类） */
  ref?: string;
}

/** 体检报告 */
export interface HealthReport {
  items: HealthItem[];
  /** 是否执行了解密完整性检测（解锁后 true；锁定态仅清单↔磁盘对账） */
  integrityChecked: boolean;
}

/** 体检进度回调（UI 动态显示：逐项检查即时报进度与新增发现） */
export interface HealthProgress {
  done: number;
  total: number;
  /** 当前正在检查的对象（条目标题/文件名/附件路径） */
  current: string;
  /** 本次回调新发现的问题（增量，UI 实时追加） */
  found: HealthItem[];
}

/** 加锁请求：由协调层（UI/测试）准备好各层数据与可选预览 */
export interface LockAttachmentInput {
  path: string;
  /** 附件类型（缺省按 image 处理，预览/展示用） */
  kind?: AttachmentKind;
  /** 原始内容 base64（已读出的 bytes → base64） */
  data: string;
  /** 预览内容 base64（压缩/抽帧产物）；不传则无预览层 */
  previewData?: string;
}

export interface LockNoteInput {
  /** 原笔记路径 */
  path: string;
  title: string;
  /** 来源类型：'diary-entry'=加密日记条目（ADR-0017）；'password-vault'=密码本整表 */
  kind?: 'diary-entry' | 'password-vault';
  /** 笔记正文（明文） */
  content: string;
  attachments: LockAttachmentInput[];
}

/** 加锁/还原的逐文件进度回调（done: 已完成数, total: 总数, current: 当前文件路径） */
export interface EncryptProgress {
  done: number;
  total: number;
  current: string;
}

/** ArrayBuffer → base64（分块，避免大附件逐字节性能瓶颈；结果与逐字节一致） */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32768
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as any);
  }
  return btoa(bin);
}

/** base64 → Uint8Array */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** SHA-256(base64 字符串) → base64 指纹；WebCrypto，node 环境可用 */
export async function fingerprintOf(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return bytesToBase64(new Uint8Array(digest));
}

/** 64 字符表（A-Za-z0-9-_）：byte % 64 无偏差，随机字节可直接映射 */
const RAND_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';

/** 加密安全随机 token（crypto.getRandomValues；64 字符表无取模偏差） */
export function randToken(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) s += RAND_CHARS[bytes[i] % 64];
  return s;
}

/** 镜像相对路径（平铺随机名）：`.随机.enc`，点前缀 Obsidian 侧栏隐藏；文件名不含路径与时间信息，还原靠清单映射 */
export function flatName(): string {
  return '.' + randToken(11) + '.enc';
}

/** 暂存目录名（encryptRoot 下，点前缀隐藏、与最终镜像同盘；ADR-0018 提交式加密） */
const STAGING_DIR = '.staging';
/** 挂起标记文件名（暂存区内，明文 noteId 列表；带外标记——不改清单结构，铁律 1） */
const PENDING_FILE = 'pending.json';

/** 生成 note id（前缀+时间戳便于排序辨识，随机段用加密安全源） */
export function genNoteId(): string {
  return 'enc-' + Date.now() + '-' + randToken(6);
}

/** 附件加密/还原准备阶段并发上限（独立 blob 互不依赖；并发放大 PBKDF2 吞吐，写盘由 adapter 队列兜底） */
const BLOB_CONCURRENCY = 3;

/**
 * 受控并发 map：同时最多 limit 个任务，返回顺序与输入一致。
 * 任一 reject 时仍等其余 worker 全部收尾后才整体 reject（P1-7）：
 * 失败方之外任务的副作用（如已写暂存镜像）此刻已全部完成并登记，
 * 调用方 catch 才能一次性清理干净，不留并发残尾。
 * （UI 不可用场景/数据层无 DOM 依赖，直接在数据层实现）
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers: Promise<void>[] = [];
  const n = Math.min(limit, items.length);
  for (let w = 0; w < n; w++) {
    workers.push(
      (async () => {
        while (next < items.length) {
          const i = next++;
          out[i] = await fn(items[i], i);
        }
      })()
    );
  }
  const settled = await Promise.allSettled(workers);
  const firstReject = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (firstReject) throw firstReject.reason;
  return out;
}

export class SafeManager {
  /** encryptRoot（vault 相对路径，默认 CONFIG/.ENCRYPT——点前缀目录 Obsidian 侧栏隐藏） */
  root = 'CONFIG/.ENCRYPT';
  /** 主密码（只存内存，锁定时清空） */
  password: string | null = null;
  unlocked = false;
  manifest: SafeManifest = { version: 1, notes: [] };
  /**
   * 最近一次 unlock 发现的清单异常（解锁成功后清除）：
   * 'empty' = .safe.enc 存在但内容为空（半写崩溃/被截断）；
   * 'corrupt' = 密文解密成功但清单解析失败（密码正确、数据损坏）。
   * 这两类必须由 UI 向用户明示「重设将丢失旧数据」后才能 forceReset，
   * 绝不静默当作首次设置（旧密文会因此永久不可解）。
   */
  manifestIssue?: 'empty' | 'corrupt';
  /**
   * 最近一次解锁时自愈回滚的条目数（ADR-0018；UI 解锁成功提示用，无自愈为 0）。
   * unlock 入口复位，selfHeal 结束时写回本次实际回滚数。
   */
  selfHealRolledBack = 0;

  constructor(root?: string) {
    if (root) this.root = root.replace(/\/+$/, '');
  }

  /** 解锁态变化回调（UI 状态栏等订阅；unlock 成功 / 首设成功 / lock() 时触发） */
  onUnlockChange: ((unlocked: boolean) => void) | null = null;

  /** 清单文件完整路径（点前缀，侧栏隐藏） */
  get manifestPath(): string {
    return this.root + '/.safe.enc';
  }

  /** 镜像相对路径 → vault 完整路径 */
  resolveRef(ref: string): string {
    return this.root + '/' + ref;
  }

  /** 点前缀兼容适配器：Obsidian 对点前缀路径不索引，getAbstractFileByPath 返回 null；
   *  因此加密根目录内的清单/镜像一律走 vault.adapter（直读磁盘，无视隐藏） */
  private get adapter(): any {
    return getApp().vault.adapter || (getApp().vault as any);
  }

  /** 清单是否存在（用于首设判断；adapter 直读磁盘，点前缀可用） */
  async exists(): Promise<boolean> {
    return await this.adapter.exists(this.manifestPath);
  }

  /**
   * 解锁：读 .safe.enc → 解密 → 解析清单。首设（无文件）时创建空清单并设密码。
   * 校验方式=解密成功即通过（GCM 认证，同密码本）。
   * @param password 主密码
   * @param forceReset 清单损坏（空/解析失败）时是否强制重设新密码——
   *   重设会丢弃旧清单（旧密文永久不可解），必须由 UI 在用户明确确认后传入。
   *   返回 false 时用 manifestIssue 区分「密码错误（无 issue）」与「清单损坏（empty/corrupt）」。
   */
  async unlock(password: string, forceReset = false): Promise<boolean> {
    this.manifestIssue = undefined;
    this.selfHealRolledBack = 0;
    // 先恢复可能中断的清单原子写（三段式 rename 的任一崩溃点，见 saveManifest）
    await this.recoverManifestWrite();
    const existsManifest = await this.exists();
    if (!existsManifest) return this.firstTimeSetup(password);
    const content = await this.adapter.read(this.manifestPath);
    if (!content.trim()) {
      // 清单文件存在但为空：半写崩溃/被截断——绝不静默重设
      this.manifestIssue = 'empty';
      if (!forceReset) return false;
      return this.firstTimeSetup(password);
    }
    try {
      const plain = await CryptoService.decrypt(content.trim(), password);
      let parsed: SafeManifest;
      try {
        parsed = JSON.parse(plain);
      } catch (e) {
        // 密码正确但内容损坏（解密通过、解析失败）
        this.manifestIssue = 'corrupt';
        if (!forceReset) return false;
        return this.firstTimeSetup(password);
      }
      if (!parsed || !Array.isArray(parsed.notes)) parsed.notes = [];
      parsed.version = parsed.version || 1;
      this.manifest = parsed;
      this.password = password;
      this.unlocked = true;
      this.onUnlockChange?.(true);
      emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
      // 自愈（ADR-0018）：回滚挂起的半提交 + 清空暂存残留；失败不阻塞解锁
      try {
        await this.selfHeal();
      } catch (e) {
        /* 自愈失败留待下次解锁重试 */
      }
      return true;
    } catch (e) {
      // GCM 认证失败：绝大多数是密码错误（数据损坏无法与密码错区分），
      // 按密码错误处理（不设 manifestIssue，UI 提示重试）。
      return false;
    }
  }

  /** 首设/强制重设：写空清单。写失败必须回滚解锁态（否则下次打开又误判无清单） */
  private async firstTimeSetup(password: string): Promise<boolean> {
    this.password = password;
    this.unlocked = true;
    this.onUnlockChange?.(true);
    emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
    this.manifest = { version: 1, notes: [] };
    try {
      await this.saveManifest();
      return true;
    } catch (e) {
      this.unlocked = false;
      this.password = null;
      this.manifest = { version: 1, notes: [] };
      return false;
    }
  }

  /** 加锁：清内存态（含派生密钥缓存，密钥不残留） */
  lock() {
    this.unlocked = false;
    this.password = null;
    this.manifest = { version: 1, notes: [] };
    this.onUnlockChange?.(false);
    emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: false });
    clearCryptoKeyCache();
  }

  /**
   * 持久化清单（整体加密写回 .safe.enc；adapter 直写磁盘，点前缀可用）。
   * 原子写，三段式 rename——
   * Obsidian adapter.rename 不支持覆盖已存在目标（报「Destination file already exists」），
   * 故 rename 目标恒为唯一名：S1 写 `.tmp` 完整密文 → S2 旧清单挪走为 `.bak`
   * → S3 `.tmp` 搬入为正本 → S4 删 `.bak`。任一中断点由解锁时 recoverManifestWrite 恢复：
   *   - S2 后崩溃：tmp+bak 在，manifest 缺（用 tmp 恢复，删 bak）
   *   - S3 后崩溃：manifest 新 + bak 旧（删 bak，保留新清单）
   *   - S1 后崩溃：仅 tmp 残留（清理）
   */
  async saveManifest() {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法保存清单');
    const json = JSON.stringify(this.manifest);
    const encrypted = await CryptoService.encrypt(json, this.password);
    await this.ensureDirFor(this.manifestPath);
    const tmp = this.manifestPath + '.tmp';
    const bak = this.manifestPath + '.bak';
    // 清上次残留（幂等）
    try {
      await this.adapter.remove(tmp);
    } catch (e) {
      /* 幂等 */
    }
    try {
      await this.adapter.remove(bak);
    } catch (e) {
      /* 幂等 */
    }
    await this.adapter.write(tmp, encrypted);
    // S2 旧清单挪走（目标 .bak 恒不存在，rename 无冲突）
    await this.adapter.rename(this.manifestPath, bak);
    try {
      // S3 新清单搬入正位（目标已挪走，rename 无冲突）
      await this.adapter.rename(tmp, this.manifestPath);
    } catch (e) {
      // 搬入失败：回滚旧清单（.bak → 正位），保持可用
      try {
        await this.adapter.rename(bak, this.manifestPath);
      } catch (err) {
        /* 回滚失败留待解锁恢复（tmp+bak 均在，可自愈） */
      }
      throw e;
    }
    // S4 删旧
    try {
      await this.adapter.remove(bak);
    } catch (e) {
      /* 幂等（残留的 .bak 由解锁恢复清理） */
    }
    // 清单变更广播（ADR-0078：保险库等外部消费者订阅重载；纯附加，无消费方依赖时不产生任何开销）
    emitDomainEvent(ENCRYPT_CHANGED_CHANNEL, { noteId: null });
  }

  /**
   * 原子写中断恢复（解锁前调用）：把清单恢复到一致状态，防「清单缺失被误判为首设」
   * 或「旧清单残留覆盖新清单」。失败静默（下次解锁重试；无残留时零开销）。
   */
  private async recoverManifestWrite(): Promise<void> {
    const adapter = this.adapter;
    const tmp = this.manifestPath + '.tmp';
    const bak = this.manifestPath + '.bak';
    try {
      const hasBak = await adapter.exists(bak);
      const hasTmp = await adapter.exists(tmp);
      if (hasBak) {
        if (hasTmp) {
          // S2 后崩溃：manifest 缺失，tmp 为最新完整密文 → 恢复正位，删旧
          await adapter.rename(tmp, this.manifestPath);
        }
        // S3 后崩溃（tmp 已搬走）：保留新清单，删旧
        await adapter.remove(bak);
      } else if (hasTmp) {
        // S1 后崩溃：仅残留 tmp，正位未动 → 清理
        await adapter.remove(tmp);
      }
    } catch (e) {
      /* 恢复失败留待下次解锁重试 */
    }
  }

  /** 确保加密根目录存在（平铺布局只需根目录；adapter.mkdir 递归建，点前缀可用） */
  private async ensureSafeRootDir() {
    await this.ensureDirFor(this.root + '/x');
  }

  /**
   * 递归确保目标 filePath 的父目录全部存在（用 adapter 直查磁盘 mkdir，
   * 点前缀目录 vault.getAbstractFileByPath 查不到，故不走 vault）。幂等。
   */
  private async ensureDirFor(filePath: string) {
    const adapter = this.adapter;
    const idx = filePath.lastIndexOf('/');
    if (idx <= 0) return; // 根目录下无需建
    let dir = filePath.slice(0, idx);
    const missing: string[] = [];
    let probe = dir;
    while (probe && probe !== '.' && probe !== '/') {
      let exists = false;
      try {
        exists = await adapter.exists(probe);
      } catch (e) {
        exists = false;
      }
      if (exists) break;
      missing.unshift(probe);
      const slash = probe.lastIndexOf('/');
      if (slash <= 0) break;
      probe = probe.slice(0, slash);
    }
    for (const p of missing) {
      await adapter.mkdir(p);
    }
  }

  /**
   * 递归确保目标文件的父目录全部存在（Obsidian vault 路径、非点前缀，
   * 还原写回原路径用；走 vault 使 Obsidian 认可目录）。
   */
  private async ensureVaultParentFolder(filePath: string) {
    const app = getApp();
    const idx = filePath.lastIndexOf('/');
    if (idx <= 0) return; // 根目录下无需建
    let dir = filePath.slice(0, idx);
    const missing: string[] = [];
    let probe = dir;
    while (probe && probe !== '.' && probe !== '/') {
      if (app.vault.getAbstractFileByPath(probe)) break;
      missing.unshift(probe);
      const slash = probe.lastIndexOf('/');
      if (slash <= 0) break;
      probe = probe.slice(0, slash);
    }
    for (const p of missing) {
      await app.vault.createFolder(p);
    }
  }

  /**
   * 原子覆盖写镜像密文（P0-1）：新密文先整体落暂存区，再 rename 换入正式位——
   * 复用 writeStaged/promoteStaged（与 .safe.enc 三段式同款思想），任何一步失败
   * （含 adapter.write 半写中断）正式位都保持旧完整密文，绝不出现半截文件。
   * 换入序列：旧镜像先挪 `.bak`（rename 目标恒不存在）→ 暂存镜像搬入正位 → 删 `.bak`；
   * 搬入失败回滚 `.bak`。无旧镜像时直接 promoteStaged（与 lockNote 提交同语义）。
   */
  private async replaceMirrorAtomic(ref: string, ciphertext: string): Promise<void> {
    const finalPath = this.resolveRef(ref);
    const stagedPath = this.stagingPath + '/' + ref;
    const bakPath = finalPath + '.bak';
    // 清上次残留（幂等）
    try {
      await this.adapter.remove(bakPath);
    } catch (e) {
      /* 幂等 */
    }
    try {
      await this.adapter.remove(stagedPath);
    } catch (e) {
      /* 幂等 */
    }
    // 完整新密文先写暂存区：此步失败正式位未触碰
    await this.writeStaged(ref, ciphertext);
    const hasOld = await this.adapter.exists(finalPath);
    if (!hasOld) {
      try {
        await this.promoteStaged(ref);
      } catch (e) {
        try {
          await this.adapter.remove(stagedPath);
        } catch (err) {
          /* 幂等 */
        }
        throw e;
      }
      return;
    }
    // 旧镜像挪走 → 新密文换入正位 → 删旧
    await this.adapter.rename(finalPath, bakPath);
    try {
      await this.promoteStaged(ref);
    } catch (e) {
      // 换入失败：旧镜像滚回正位（正式位保持旧完整密文），暂存清理；
      // 回滚也失败时残留 .bak 留待体检/自愈视角兜底（此处尽力而为）
      try {
        await this.adapter.rename(bakPath, finalPath);
      } catch (err) {
        /* 回滚失败留待下次覆盖重试（判定以磁盘现状为准） */
      }
      try {
        await this.adapter.remove(stagedPath);
      } catch (err) {
        /* 幂等 */
      }
      throw e;
    }
    try {
      await this.adapter.remove(bakPath);
    } catch (e) {
      /* 幂等（残留 .bak 不影响读取，下次覆盖前会清） */
    }
  }

  /** 读镜像密文文件 → base64 密文字符串（adapter，点前缀可用） */
  private async readMirror(ref: string): Promise<string | null> {
    const path = this.resolveRef(ref);
    try {
      if (!(await this.adapter.exists(path))) return null;
      const c = await this.adapter.read(path);
      return c.trim();
    } catch (e) {
      return null;
    }
  }

  /** 删除点前缀密文镜像文件（adapter，幂等） */
  private async deleteSafeFile(ref: string) {
    const path = this.resolveRef(ref);
    try {
      if (await this.adapter.exists(path)) await this.adapter.remove(path);
    } catch (e) {
      /* 幂等忽略 */
    }
  }

  /**
   * 删除一条条目的全部密文镜像（正文 + 附件原始层/预览层）。
   * 自愈回滚 / 彻底取出 / 失效条目清理共用；deleteSafeFile 幂等，正文缺失时为无害空操作。
   */
  private async deleteNoteMirrors(note: SafeNote): Promise<void> {
    if (note.contentRef) await this.deleteSafeFile(note.contentRef);
    for (const a of note.attachments) {
      await this.deleteSafeFile(a.blobRef);
      if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
    }
  }

  /** 删除 vault 原文件（非点前缀，走 vault 使 Obsidian 认可删除；幂等） */
  private async deleteVaultFile(path: string) {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path);
    if (file && (file as any).isFolder !== true) {
      await app.vault.delete(file as any);
    }
  }

  /** 是否存在 vault 文件（非点前缀原路径判断用） */
  private fileExists(path: string): boolean {
    const f = getApp().vault.getAbstractFileByPath(path);
    return !!f && (f as any).isFolder !== true;
  }

  // ---------- 提交式加密（ADR-0018）：暂存区 / 挂起标记 / 自愈 / 手动清理 ----------

  /** 暂存目录 vault 路径（点前缀隐藏，与最终镜像同盘保证 rename 高效） */
  get stagingPath(): string {
    return this.root + '/' + STAGING_DIR;
  }

  /** 挂起标记文件 vault 路径（暂存区内，明文 noteId 列表） */
  get pendingPath(): string {
    return this.stagingPath + '/' + PENDING_FILE;
  }

  /** 确保暂存目录存在 */
  private async ensureStagingDir() {
    await this.ensureDirFor(this.stagingPath + '/x');
  }

  /** 写镜像密文到暂存区（提交前不触碰数据文件夹正式布局、不占内存） */
  private async writeStaged(ref: string, ciphertext: string) {
    await this.ensureStagingDir();
    await this.adapter.write(this.stagingPath + '/' + ref, ciphertext);
  }

  /** 暂存镜像搬入正式顶层（同盘 rename；失败抛出 → 整笔放弃，挂起态留待解锁自愈兜底） */
  private async promoteStaged(ref: string) {
    const staged = this.stagingPath + '/' + ref;
    const final = this.resolveRef(ref);
    if (!(await this.adapter.exists(staged))) throw new Error('暂存镜像缺失：' + ref);
    await this.adapter.rename(staged, final);
  }

  /** 清空暂存区全部内容（含挂起标记；目录缺失/单文件失败一律幂等，不依赖目录注册） */
  private async clearStaging() {
    try {
      const listing = await this.adapter.list(this.stagingPath);
      for (const f of listing.files) {
        try {
          await this.adapter.remove(f);
        } catch (e) {
          /* 幂等 */
        }
      }
    } catch (e) {
      /* 幂等 */
    }
  }

  /** 读挂起标记（pending.json 的 noteId 列表；缺失/损坏返回空） */
  private async readPending(): Promise<string[]> {
    try {
      if (!(await this.adapter.exists(this.pendingPath))) return [];
      const raw = await this.adapter.read(this.pendingPath);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 追加一条挂起标记（读-改-写；P1-6）：整写 `[id]` 覆盖会把并发另一笔已登记的
   * 标记互吞掉（其半提交从此失去自愈线索），故先读现列表再追加写回。
   */
  private async addPending(id: string): Promise<void> {
    const list = await this.readPending();
    if (!list.includes(id)) list.push(id);
    await this.ensureStagingDir();
    await this.adapter.write(this.pendingPath, JSON.stringify(list));
  }

  /**
   * 移除单条挂起标记（读-改-写；P1-6）：只摘除自己的 id，其余笔的标记原样保留；
   * 列表清空则删除文件（对齐原「清除标记」语义，暂存区回归无标记状态）。
   */
  private async removePending(id: string): Promise<void> {
    const list = await this.readPending();
    const idx = list.indexOf(id);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) {
      if (await this.adapter.exists(this.pendingPath)) await this.adapter.remove(this.pendingPath);
      return;
    }
    await this.ensureStagingDir();
    await this.adapter.write(this.pendingPath, JSON.stringify(list));
  }

  /**
   * 自愈回滚（ADR-0018）：对挂起标记仍在的条目判定「半提交」——删除其引用的顶层镜像
   * （已搬入的清掉、未搬入的自然无文件）、从清单丢弃该条目，随后清空暂存区与标记。
   * 关键不变量：标记于删原文件前清除，故标记存在 ⇒ 原文件未删 ⇒ 回滚永远安全、
   * 不产生密文孤儿。无挂起条目时仅清空遗留暂存。解锁成功后调用；失败不阻塞解锁。
   * @returns 本次实际回滚的条目数（挂起标记无对应条目的不计入；无挂起为 0）
   */
  async selfHeal(): Promise<number> {
    if (!this.unlocked || !this.password) return 0;
    const pending = await this.readPending();
    let rolledBack = 0;
    if (pending.length) {
      for (const id of pending) {
        const idx = this.manifest.notes.findIndex((n) => n.id === id);
        if (idx === -1) continue;
        const note = this.manifest.notes[idx];
        await this.deleteNoteMirrors(note);
        this.manifest.notes.splice(idx, 1);
        rolledBack += 1;
      }
      if (rolledBack > 0) await this.saveManifest();
    }
    await this.clearStaging();
    this.selfHealRolledBack = rolledBack;
    return rolledBack;
  }

  /**
   * 体检扫描（用户拍板：右上角「体检」按钮替换原「清理」，先报告后勾选清理）。
   * 扫描分两段：
   * 1. 对账段（不依赖解锁，锁定态也可体检）：
   *    - dead-entry：正文镜像（contentRef）缺失的条目 = 失效条目（正文不可解、还原无意义）；
   *    - orphan-file：顶层未被任何清单条目 contentRef/blobRef/previewRef 引用的
   *      点前缀 `.随机.enc` 形态密文（`.safe.enc` 与目录结构一律不碰）。
   *    仅附件镜像缺失但正文可读的条目保留（预览不受影响）。
   * 2. 完整性段（需解锁，解锁后自动执行）：
   *    - corrupted-body：正文镜像解密失败（文件在但内容损坏/被替换）；
   *    - corrupted-attachment：附件原始层解密失败或指纹与加密时不符（被篡改）；
   *    - missing-attachment：附件原始层镜像缺失（正文可读，还原时该附件不可用）。
   *    预览层不校验——还原不依赖预览层，缺失不致命。
   *    损坏/缺失类只报告、不清理（删了就是真丢数据，由用户决定从备份恢复），
   *    只有 dead-entry 与 orphan-file 可勾选清理。
   * @param onProgress 进度回调（逐项检查时调用：done/total/当前对象/本次新增发现，UI 动态显示）
   * @returns { items: 问题清单, integrityChecked: 是否执行了解密完整性检测（未解锁为 false） }
   */
  async scanHealth(onProgress?: (p: HealthProgress) => void): Promise<HealthReport> {
    const items: HealthItem[] = [];
    // 未解锁：清单明文不在内存（lock 已清空），无引用判定依据——绝不做对账，
    // 否则会把全部正文镜像误判为孤儿（灾难性误删）。UI 层保证解锁后才体检，这里双保险。
    if (!this.unlocked || !this.password) return { items, integrityChecked: false };

    // 进度总步数：孤儿文件轮 1 + 每条（容器存在性 1 + 正文完整性 1 + 附件各自 1）
    let total = 1;
    for (const n of this.manifest.notes) total += 2 + n.attachments.length;
    let done = 0;
    const emit = (current: string, fresh: HealthItem[]) => {
      done += 1;
      if (fresh.length) items.push(...fresh); // 增量发现既进报告，也随回调给 UI 实时追加
      onProgress?.({ done, total, current, found: fresh });
    };

    // 清单侧对账：正文镜像缺失 = 失效条目（不解密）
    for (const n of this.manifest.notes) {
      let bodyExists = false;
      if (n.contentRef) {
        try {
          bodyExists = await this.adapter.exists(this.resolveRef(n.contentRef));
        } catch (e) {
          bodyExists = false;
        }
      }
      const fresh: HealthItem[] = [];
      if (!bodyExists) {
        fresh.push({ cat: 'dead-entry', key: 'entry:' + n.id, label: n.title, noteId: n.id });
      }
      emit(n.title, fresh);
    }

    // 文件侧对账：未被任何清单引用（contentRef/blobRef/previewRef）的顶层点前缀密文 = 孤儿
    const referenced = new Set<string>();
    for (const n of this.manifest.notes) {
      if (n.contentRef) referenced.add(n.contentRef);
      for (const a of n.attachments) {
        if (a.blobRef) referenced.add(a.blobRef);
        if (a.hasPreview && a.previewRef) referenced.add(a.previewRef);
      }
    }
    {
      const fresh: HealthItem[] = [];
      try {
        if (await this.adapter.exists(this.root)) {
          const listing = await this.adapter.list(this.root);
          for (const f of listing.files) {
            const name = f.slice(f.lastIndexOf('/') + 1);
            if (name === '.safe.enc') continue; // 清单本体绝不触碰
            if (!name.startsWith('.') || !name.endsWith('.enc')) continue; // 只认平铺点前缀密文形态
            if (referenced.has(name)) continue;
            fresh.push({ cat: 'orphan-file', key: 'file:' + name, label: name, ref: name });
          }
        }
      } catch (e) {
        /* 幂等 */
      }
      emit('孤儿密文文件', fresh);
    }

    // 完整性段（需解锁）：逐个正文/附件原始层解密校验
    const integrityChecked = !!(this.unlocked && this.password);
    if (integrityChecked) {
      const password = this.password as string;
      for (const n of this.manifest.notes) {
        // 正文：已失效（dead-entry）的条目跳过（镜像缺失无完整性可言）
        if (items.some((i) => i.cat === 'dead-entry' && i.noteId === n.id)) {
          emit(n.title + '（失效，跳过校验）', []);
          continue;
        }
        if (!n.contentRef) {
          emit(n.title, []);
          continue;
        }
        const fresh: HealthItem[] = [];
        try {
          const cipher = await this.readMirror(n.contentRef);
          if (cipher !== null) await CryptoService.decrypt(cipher, password);
          // cipher === null：镜像缺失已由对账段报告
        } catch (e) {
          fresh.push({ cat: 'corrupted-body', key: 'body:' + n.id, label: n.title, noteId: n.id, ref: n.contentRef });
        }
        emit(n.title, fresh);
      }
      for (const n of this.manifest.notes) {
        for (const a of n.attachments) {
          if (!a.blobRef) {
            emit(a.path, []);
            continue;
          }
          const key = 'att:' + n.id + ':' + a.path;
          const fresh: HealthItem[] = [];
          try {
            const cipher = await this.readMirror(a.blobRef);
            if (cipher === null) {
              // 附件原始层镜像缺失（正文可读 → 条目保留，还原时该附件不可用）
              fresh.push({ cat: 'missing-attachment', key, label: a.path, noteId: n.id, ref: a.blobRef });
            } else {
              const plain = await CryptoService.decrypt(cipher, password);
              const fp = await fingerprintOf(plain);
              if (fp !== a.fingerprint) {
                fresh.push({ cat: 'corrupted-attachment', key, label: a.path, noteId: n.id, ref: a.blobRef });
              }
            }
          } catch (e) {
            fresh.push({ cat: 'corrupted-attachment', key, label: a.path, noteId: n.id, ref: a.blobRef });
          }
          emit(a.path, fresh);
        }
      }
    }
    return { items, integrityChecked };
  }

  /**
   * 按勾选 key 清理（体检页「清理勾选项」执行；只处理可清理类，损坏/缺失类防御性忽略）：
   * 1. dead-entry（key `entry:<id>`）：正文镜像当前仍缺失 → 整条清除（残留附件镜像一并删除）——
   *    判定以当前磁盘为准（幂等：重复执行无副作用）；
   * 2. orphan-file（key `file:<name>`）：删除该顶层密文文件（形态校验同扫描，绝不越界）。
   * 有清单变更时持久化（落盘失败向上抛，下次重试判定幂等）；并清空暂存区。
   * @returns { files: 删除的孤儿密文文件数, notes: 清除的失效条目数 }
   */
  async resolveHealth(keys: string[]): Promise<{ files: number; notes: number }> {
    if (!this.unlocked) throw new Error('未解锁，无法清理');
    const want = new Set(keys);
    let notes = 0;
    let files = 0;

    // 1) 失效条目整条清除
    const kept: SafeNote[] = [];
    for (const n of this.manifest.notes) {
      let bodyExists = false;
      if (n.contentRef) {
        try {
          bodyExists = await this.adapter.exists(this.resolveRef(n.contentRef));
        } catch (e) {
          bodyExists = false;
        }
      }
      if (want.has('entry:' + n.id) && !bodyExists) {
        // 正文镜像已缺失（dead-entry 判定），deleteNoteMirrors 对缺失正文为无害空操作
        await this.deleteNoteMirrors(n);
        notes += 1;
      } else {
        kept.push(n);
      }
    }
    if (notes > 0) this.manifest.notes = kept;

    // 2) 孤儿密文文件删除（形态校验同扫描：点前缀 + .enc，避开清单与目录结构）
    for (const key of keys) {
      if (!key.startsWith('file:')) continue;
      const name = key.slice('file:'.length);
      if (!name.startsWith('.') || !name.endsWith('.enc')) continue;
      try {
        if (await this.adapter.exists(this.resolveRef(name))) {
          await this.adapter.remove(this.resolveRef(name));
          files += 1;
        }
      } catch (e) {
        /* 单文件失败继续 */
      }
    }

    if (notes > 0) await this.saveManifest(); // 清单落盘失败向上抛（下次重试，条目判定幂等）
    await this.clearStaging();
    return { files, notes };
  }

  /**
   * 操作级互斥（P1-6）：lockNote/restoreNote 实例级串行的 promise 链尾。
   * 并发调用按发起顺序排队；前序失败不断链（错误只回给其自己的调用方）。
   */
  private opQueue: Promise<unknown> = Promise.resolve();

  private enqueueOp<T>(op: () => Promise<T>): Promise<T> {
    const run = this.opQueue.then(op, op);
    this.opQueue = run.catch(() => undefined);
    return run;
  }

  /**
   * 加锁一篇笔记（操作级互斥入口，P1-6）：实例级 promise 链串行——
   * 并发 lockNote/restoreNote 按发起顺序排队执行，杜绝挂起标记/清单/暂存区的并发互吞。
   */
  lockNote(
    input: LockNoteInput,
    onProgress?: (p: EncryptProgress) => void,
    onDeleteFailed?: (paths: string[]) => void
  ): Promise<SafeNote> {
    return this.enqueueOp(() => this.lockNoteSerial(input, onProgress, onDeleteFailed));
  }

  /**
   * 加锁一篇笔记：把当前笔记正文 + 双链附件移入保险箱（ADR-0018 提交式加密）。
   * 加密阶段密文流式写入暂存区 `.staging/`（不占内存、不进入数据文件夹正式布局）；
   * 全部加密成功后才进入提交序列：
   *   S1 写挂起标记 → S2 清单先行（saveManifest，提交点）→ S3 暂存镜像搬入顶层
   *   → S4 清除挂起标记 → S5 尽力删原文件（失败仅提示，onDeleteFailed 收集，不回滚）。
   * 关键不变量：挂起标记存在 ⇒ 原文件未删 ⇒ 解锁自愈回滚永远安全；标记于删原文件前清除，
   * 标记清除后的意外一律视为已提交、绝不回滚（Q4-A）。
   * 任一失败（附件/正文加密、写暂存、清单写入、搬入、清标记）→ 整笔放弃：清理本次暂存、
   * 原文件不动；清单先行已残留的挂起态由解锁自愈兜底。
   * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
   */
  private async lockNoteSerial(
    input: LockNoteInput,
    onProgress?: (p: EncryptProgress) => void,
    onDeleteFailed?: (paths: string[]) => void
  ): Promise<SafeNote> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法加密笔记');
    await this.ensureSafeRootDir();
    await this.ensureStagingDir();
    const password = this.password; // 局部断言非空（箭头函数闭包内避免 TS 收窄失效）
    const total = input.attachments.length + 1;
    let done = 0;

    const attachments: SafeAttachment[] = [];
    const finalRefs: string[] = [];
    const stagedRefs: string[] = [];
    let note: SafeNote | null = null;
    let manifestSaved = false; // S2 是否落盘成功（P1-5：未落盘的失败在内存回退幽灵条目）
    try {
      // 附件加密并行（BLOB_CONCURRENCY=3）：每个 blob 独立 salt → 逐附件 PBKDF2(100k)，
      // 串行会让多附件明显变慢；进度按完成数上报（顺序不定，语义不变）。
      // 注意：回调只返回结果，由 mapLimit 按输入顺序归位——附件在清单中的顺序必须与输入一致
      //（直接被并发 push 会随完成顺序漂移，污染清单顺序与测试断言）。
      // 失败 → 整笔放弃：本次已写暂存镜像在 catch 里清理，原文件不动。
      // refs 即时登记（P1-7）：每写完一个暂存镜像立刻入册，mapLimit 中途失败时
      // catch 也能清理全部已写暂存（不再依赖成功返回后的结果归集填充）。
      const results = await mapLimit(input.attachments, BLOB_CONCURRENCY, async (a) => {
        const fp = await fingerprintOf(a.data);
        const enc = await CryptoService.encrypt(a.data, password);
        const blobRef = flatName();
        await this.writeStaged(blobRef, enc);
        stagedRefs.push(blobRef);
        finalRefs.push(blobRef);
        let hasPreview = false;
        let previewRef = '';
        if (a.previewData) {
          const encP = await CryptoService.encrypt(a.previewData, password);
          previewRef = flatName();
          await this.writeStaged(previewRef, encP);
          stagedRefs.push(previewRef);
          finalRefs.push(previewRef);
          hasPreview = true;
        }
        done += 1;
        onProgress?.({ done, total, current: a.path });
        return {
          path: a.path,
          kind: a.kind || 'image',
          blobRef,
          blobSize: enc.length,
          fingerprint: fp,
          hasPreview,
          previewRef,
        };
      });
      for (const r of results) attachments.push(r);

      done += 1;
      onProgress?.({ done, total, current: input.path });
      // 正文同样写镜像文件（不内嵌进清单）
      const bodyRef = flatName();
      const bodyCipher = await CryptoService.encrypt(input.content, this.password);
      await this.writeStaged(bodyRef, bodyCipher);
      stagedRefs.push(bodyRef);
      finalRefs.push(bodyRef);
      note = {
        id: genNoteId(),
        kind: input.kind || undefined,
        path: input.path,
        title: input.title,
        createdAt: new Date().toISOString(),
        contentRef: bodyRef,
        attachments,
      };

      // ---- 提交序列（ADR-0018） ----
      // S1 挂起标记（存在 ⇒ 可安全回滚；清除前绝不删除原文件）——读-改-写追加（P1-6：整写会互吞并发笔标记）
      await this.addPending(note.id);
      // S2 清单先行（提交点）：条目先于镜像文件写入清单
      this.manifest.notes.push(note);
      await this.saveManifest();
      manifestSaved = true;
      // S3 暂存镜像搬入顶层（失败抛出 → 整笔放弃，挂起态留待解锁自愈）
      for (const ref of finalRefs) await this.promoteStaged(ref);
      // S4 清除挂起标记（失败必须抛出：标记残留时绝不允许进入 S5 删原文件）——只摘自身 id（P1-6）
      try {
        await this.removePending(note.id);
      } catch (e) {
        throw new Error('清除挂起标记失败：' + (e as Error).message);
      }
      // S5 尽力删原文件（失败仅提示、不回滚；Q4-A）
      const deleteFailed: string[] = [];
      for (const a of input.attachments) {
        try {
          await this.deleteVaultFile(a.path);
        } catch (e) {
          deleteFailed.push(a.path);
        }
      }
      // 普通加密笔记删除整篇原文件；diary-entry/password-vault 无整文件可删
      //（日记条目块移除由日记域自行处理 ADR-0017 Q6-b；密码本无原文件，path 为虚拟占位）
      if (input.kind !== 'diary-entry' && input.kind !== 'password-vault') {
        try {
          await this.deleteVaultFile(input.path);
        } catch (e) {
          deleteFailed.push(input.path);
        }
      }
      onDeleteFailed?.(deleteFailed);
      return note;
    } catch (e) {
      // 整笔放弃：清理本次已写入的暂存镜像（原文件未动）；挂起标记/清单残留由解锁自愈回收
      for (const ref of stagedRefs) {
        try {
          await this.adapter.remove(this.stagingPath + '/' + ref);
        } catch (err) {
          /* 幂等 */
        }
      }
      // 清单尚未落盘成功（P1-5）：按 id 从内存清单回退本条目，防同会话内后续成功的
      // saveManifest 把幽灵条目固化；已落盘（S2 成功后）的失败不回退——交由挂起标记
      // 的自愈语义裁决（Q4-A：S4 前可自愈回滚，绝不在此处擅自改已提交清单）
      if (!manifestSaved && note) {
        const ghostId = note.id;
        const idx = this.manifest.notes.findIndex((n) => n.id === ghostId);
        if (idx !== -1) this.manifest.notes.splice(idx, 1);
      }
      throw e;
    }
  }

  /**
   * 还原（取出即删）一篇笔记（操作级互斥入口，P1-6）：与 lockNote 共享同一串行链。
   *
   * 解原文 + 原质量附件写回原路径。
   * 原子语义（用户决策修订）：阶段一并行解密全部附件 + 正文并完成全部校验
   * （指纹冲突/目标被占/镜像缺失/解密失败），**任一失败 → 整体放弃，零落盘**；
   * 阶段二才批量写回明文（写回中途失败尽力回滚本次创建的文件）。
   * 全部成功（无冲突）后：删除本文全部加密镜像（正文+附件原始层/预览层）、从清单移除，彻底取出。
   * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
   */
  restoreNote(
    noteId: string,
    onProgress?: (p: EncryptProgress) => void
  ): Promise<{ note: SafeNote; conflicts: string[]; removed: boolean; manifestSaveFailed?: boolean }> {
    return this.enqueueOp(() => this.restoreNoteSerial(noteId, onProgress));
  }

  private async restoreNoteSerial(
    noteId: string,
    onProgress?: (p: EncryptProgress) => void
  ): Promise<{ note: SafeNote; conflicts: string[]; removed: boolean; manifestSaveFailed?: boolean }> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法还原笔记');
    const app = getApp();
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note) throw new Error('未找到该加密笔记');
    const conflicts: string[] = [];
    const total = note.attachments.length + 1;

    // 阶段一（准备，并行）：附件解密 + 指纹校验 + 目标占用检查；冲突只收集不落盘
    let done = 0;
    const plainAttachments = await mapLimit(note.attachments, BLOB_CONCURRENCY, async (a) => {
      const plainB64 = await this.prepareRestoreAttachment(a);
      done += 1;
      onProgress?.({ done, total, current: a.path });
      return plainB64;
    });
    note.attachments.forEach((a, i) => {
      if (plainAttachments[i] === null) conflicts.push(a.path);
    });
    // 正文准备（contentRef 镜像）
    done += 1;
    onProgress?.({ done, total, current: note.path });
    const plain = await this.decryptNoteBody(note);
    if (plain === null || plain === undefined) {
      conflicts.push(note.path);
    } else if (note.kind === 'diary-entry') {
      // 加密日记条目：正文走 mergeDiaryBlock（ADR-0017），占用检查由 merge 路径自身处理
    } else if (this.fileExists(note.path)) {
      // 目标已被占用：内容与待还原明文一致（本系统上次还原残留/中断重试）→ 放行覆盖；
      // 不一致（用户自己的同名文件）→ 冲突，整体不落盘
      const sameContent = await this.isSameTextFile(note.path, plain);
      if (!sameContent) conflicts.push(note.path);
    }
    if (conflicts.length > 0) return { note, conflicts, removed: false };

    // 阶段二（提交）：全部准备成功才写回明文
    const created: string[] = [];
    try {
      for (let i = 0; i < note.attachments.length; i++) {
        const a = note.attachments[i];
        const wasCreated = await this.commitRestoreAttachment(a, plainAttachments[i]!);
        if (wasCreated) created.push(a.path);
      }
      if (note.kind === 'diary-entry') {
        // 加密日记条目：块级 merge 回原日期文件（按 # emoji HH:mm 时间序重插），非整文件覆盖（ADR-0017 Q23-A）
        const mergeOk = await this.mergeDiaryBlock(note.path, plain!);
        if (!mergeOk) throw new Error('日记块 merge 失败');
      } else {
        await this.ensureVaultParentFolder(note.path);
        const file = await app.vault.create(note.path, plain!);
        created.push(note.path);
        (app.metadataCache as any)?.trigger?.('changed', file);
      }
    } catch (e) {
      // 写回中途失败：删除本次创建的文件（不触碰覆盖/既有文件），保持「未全部成功不落盘」
      for (const p of created) {
        try {
          await this.deleteVaultFile(p);
        } catch (err) {
          /* 幂等 */
        }
      }
      return { note, conflicts: [...conflicts, note.path], removed: false };
    }

    // 全部成功 → 彻底取出（删镜像 + 移除清单条目）
    await this.deleteNoteMirrors(note);
    const idx = this.manifest.notes.indexOf(note);
    if (idx !== -1) this.manifest.notes.splice(idx, 1);
    try {
      await this.saveManifest();
    } catch (e) {
      // 文件已还原、内存条目已移除，仅清单落盘失败（磁盘异常）：
      // 如实告知（manifestSaveFailed），下次解锁后重试可幂等收敛——
      // 正文/附件目标已存在且内容一致 → 放行，再还原一次即完成清理，绝不产生重复数据
      return { note, conflicts, removed: false, manifestSaveFailed: true };
    }
    return { note, conflicts, removed: true };
  }

  /** 目标文件内容与待还原明文是否一致（归一化行尾；占用幂等放行判断用） */
  private async isSameTextFile(path: string, plain: string): Promise<boolean> {
    try {
      const app = getApp();
      const f = app.vault.getAbstractFileByPath(path);
      if (!f) return false;
      const existing = await app.vault.read(f as any);
      return existing.replace(/\r\n/g, '\n') === plain.replace(/\r\n/g, '\n');
    } catch (e) {
      return false;
    }
  }

  /** 解笔记正文明文（contentRef 镜像；无镜像返回 null） */
  async decryptNoteBody(note: SafeNote): Promise<string | null> {
    if (!this.unlocked || !this.password) throw new Error('未解锁');
    if (!note.contentRef) return null;
    const cipher = await this.readMirror(note.contentRef);
    if (!cipher) return null;
    return CryptoService.decrypt(cipher, this.password);
  }

  /**
   * 读条目标题镜像的原始密文字符串（不解密，零 PBKDF2 开销）。
   * 供密码本等高频读侧做「内容未变」判等（密文字节相同 ⇒ 载荷未变，可复用上次解密结果）。
   * 无镜像返回 null。
   */
  async readNotePayloadRaw(note: SafeNote): Promise<string | null> {
    if (!note.contentRef) return null;
    return this.readMirror(note.contentRef);
  }

  /**
   * 加密日记条目还原：还原附件 → 把 finalBlock（由调用方准备，可为原文或改分类降级后重建）merge 回原日期 md → 取出即删。
   * 原子语义同 restoreNote：全部附件解密/校验成功且块就绪才写回；任一失败零落盘。
   */
  async restoreDiaryEntry(noteId: string, finalBlock: string): Promise<boolean> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法还原加密日记');
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note || note.kind !== 'diary-entry') throw new Error('未找到该加密日记条目');
    const conflicts: string[] = [];
    // 阶段一（准备，并行）：全部附件解密 + 校验
    const plainAttachments = await mapLimit(note.attachments, BLOB_CONCURRENCY, async (a) =>
      this.prepareRestoreAttachment(a)
    );
    note.attachments.forEach((a, i) => {
      if (plainAttachments[i] === null) conflicts.push(a.path);
    });
    if (!finalBlock) conflicts.push(note.path);
    if (conflicts.length > 0) return false;
    // 阶段二（提交）：写回附件 + merge 块；失败回滚本次创建
    const created: string[] = [];
    try {
      for (let i = 0; i < note.attachments.length; i++) {
        const a = note.attachments[i];
        const wasCreated = await this.commitRestoreAttachment(a, plainAttachments[i]!);
        if (wasCreated) created.push(a.path);
      }
      const ok = await this.mergeDiaryBlock(note.path, finalBlock);
      if (!ok) throw new Error('日记块 merge 失败');
    } catch (e) {
      for (const p of created) {
        try {
          await this.deleteVaultFile(p);
        } catch (err) {
          /* 幂等 */
        }
      }
      return false;
    }
    // 无冲突则彻底取出（删镜像 + 移除清单条目）；清单落盘失败如实返回 false（merge 幂等兜底）
    await this.deleteNoteMirrors(note);
    const idx = this.manifest.notes.indexOf(note);
    if (idx !== -1) this.manifest.notes.splice(idx, 1);
    try {
      await this.saveManifest();
    } catch (e) {
      return false; // 块已 merge；重试时 mergeDiaryBlock 幂等跳过已存在标题行
    }
    return true;
  }

  /** 解加密日记正文明文（供日记域准备还原块；退回 null 表示解密失败） */
  async getDiaryEntryPlain(noteId: string): Promise<string | null> {
    if (!this.unlocked || !this.password) throw new Error('未解锁');
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note || note.kind !== 'diary-entry') return null;
    return this.decryptNoteBody(note);
  }

  /**
   * 加密日记条目还原辅助：把 `# emoji HH:mm\n正文` 块 merge 回目标日期 md 文件。
   * 解析块首行标题取时间 → 按时间序把块重插进该日期文件（文件已删则新建）；非整文件覆盖（ADR-0017 Q23-A）。
   * @returns 成功写入返回 true；目标路径被占且非本系统（fingerprint 冲突）由附件层处理，正文 merge 属幂等写回。
   */
  private async mergeDiaryBlock(datePath: string, block: string): Promise<boolean> {
    const app = getApp();
    if (!datePath || !block) return false;
    // 解析块标题 `# emoji HH:mm`
    const md = block.replace(/\r\n/g, '\n');
    const lines = md.split('\n');
    const headMatch = lines[0] ? lines[0].match(/^#\s+\S+\s+(\d{2}:\d{2})$/) : null;
    const time = headMatch ? headMatch[1] : null;
    const timeValue = time ? (parseInt(time.slice(0, 2), 10) * 100 + parseInt(time.slice(3, 5), 10)) : null;
    if (timeValue === null || Number.isNaN(timeValue)) return false;

    await this.ensureVaultParentFolder(datePath);
    const existing = app.vault.getAbstractFileByPath(datePath);
    let existingText = '';
    if (existing && (existing as any).isFolder !== true) {
      existingText = await app.vault.read(existing as any);
    }
    const existingLines = existingText ? existingText.replace(/\r\n/g, '\n').split('\n') : [];

    // 幂等：目标文件已含相同标题行（上次「块已 merge 但清单没保存」的中断残留/重试）
    // → 视为已完成，跳过防重复插入（标题行 = 块唯一标识：emoji 序列 + HH:mm）
    if (existingLines.some((l) => l.trim() === lines[0].trim())) return true;

    // 组装块行：标题行原样保留（`# emoji HH:mm`，不再拼接时间），标题与正文间补空行
    // （与 writeFile 生成格式一致：# emoji HH:mm → 空行 → 正文）
    const blockRows: string[] = [lines[0].trim()];
    const blockLines: string[] = [];
    for (let i = 1; i < lines.length; i++) blockLines.push(lines[i]);
    while (blockLines.length && blockLines[blockLines.length - 1].trim() === '') blockLines.pop();
    while (blockLines.length && blockLines[0].trim() === '') blockLines.shift();
    if (blockLines.length) {
      blockRows.push('');
      blockRows.push(...blockLines);
    }

    // 按时间序 merge：找到第一个 timeValue >= 本条的标题行，在其前插入；否则追加到末尾
    const headingRe = /^#\s+\S+\s+(\d{2}:\d{2})$/;
    let insertIdx = existingLines.length;
    for (let i = 0; i < existingLines.length; i++) {
      const m = existingLines[i].match(headingRe);
      if (m) {
        const tv = parseInt(m[1].slice(0, 2), 10) * 100 + parseInt(m[1].slice(3, 5), 10);
        if (tv >= timeValue) {
          insertIdx = i;
          break;
        }
      }
    }

    // 组装新文件内容：前段 + （与前条目分隔空行）+ 本条块 + （与后条目分隔空行）+ 后段
    const out: string[] = [];
    for (let i = 0; i < insertIdx; i++) out.push(existingLines[i]);
    if (insertIdx > 0 && existingLines[insertIdx - 1].trim() !== '') out.push('');
    out.push(...blockRows);
    if (insertIdx < existingLines.length && existingLines[insertIdx].trim() !== '') out.push('');
    for (let i = insertIdx; i < existingLines.length; i++) out.push(existingLines[i]);

    // 规整：连续空行折叠为一条、首尾不残留空行
    const clean: string[] = [];
    for (const ln of out) {
      if (ln.trim() === '') {
        if (clean.length && clean[clean.length - 1] !== '') clean.push('');
      } else {
        clean.push(ln);
      }
    }
    while (clean.length && clean[0] === '') clean.shift();
    while (clean.length && clean[clean.length - 1] === '') clean.pop();
    const finalText = clean.join('\n');

    if (existing && (existing as any).isFolder !== true) {
      await app.vault.modify(existing as any, finalText);
    } else {
      const file = await app.vault.create(datePath, finalText);
      (app.metadataCache as any)?.trigger?.('changed', file);
    }
    return true;
  }

  /**
   * 还原准备（原子语义）：解镜像 → 完整性指纹校验 → 目标占用检查。
   * 完整性：镜像解密内容指纹必须与加密时记录一致（防镜像被篡改/替换），与目标是否被占无关；
   * 占用：目标已有文件时读其内容比对指纹——相同 = 本系统还原残留（幂等覆盖），不同 = 用户文件（冲突）。
   * @returns 明文 base64；null = 镜像缺失 / 解密失败 / 完整性不符 / 目标被用户占用（整体不落盘）
   */
  private async prepareRestoreAttachment(a: SafeAttachment): Promise<string | null> {
    const password = this.password;
    if (!password) return null;
    const cipher = await this.readMirror(a.blobRef);
    if (cipher === null) return null;
    let plainB64: string;
    try {
      plainB64 = await CryptoService.decrypt(cipher, password);
    } catch (e) {
      return null;
    }
    // 完整性：镜像内容与加密时不一致（被替换/篡改）→ 永不写回（无论目标是否占用）
    const currentFp = await fingerprintOf(plainB64);
    if (currentFp !== a.fingerprint) return null;
    // 占用：目标已有文件，读其内容比对指纹（防误盖用户新建的同名文件）
    if (this.fileExists(a.path)) {
      try {
        const app = getApp();
        const existing = app.vault.getAbstractFileByPath(a.path);
        const buf = await app.vault.readBinary(existing as any);
        const existingFp = await fingerprintOf(bytesToBase64(new Uint8Array(buf)));
        if (existingFp !== a.fingerprint) return null; // 用户文件 → 冲突
        // 指纹相同 = 本系统还原残留/同名同内容 → 放行（提交阶段幂等覆盖）
      } catch (e) {
        return null; // 读不到目标内容（异常）→ 保守冲突
      }
    }
    return plainB64;
  }

  /**
   * 还原提交（仅在全部分解/校验成功后调用）：把准备阶段解出的明文写回原路径（二进制）。
   * @returns 是否本次新建（true 时失败回滚可安全删除；false = 覆盖既有同指纹文件，不删）
   */
  private async commitRestoreAttachment(a: SafeAttachment, plainB64: string): Promise<boolean> {
    const app = getApp();
    const data = base64ToBytes(plainB64);
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const existing = app.vault.getAbstractFileByPath(a.path);
    if (existing) {
      await (app.vault as any).writeBinary(existing as any, buf);
      return false;
    }
    await this.ensureVaultParentFolder(a.path);
    const file = await app.vault.createBinary(a.path, buf);
    (app.metadataCache as any)?.trigger?.('changed', file);
    return true;
  }

  /** 删除一条加密笔记（连同镜像文件、清单记录）。谨慎：真删除不可恢复。 */
  async removeNote(noteId: string): Promise<void> {
    if (!this.unlocked) throw new Error('未解锁');
    const idx = this.manifest.notes.findIndex((n) => n.id === noteId);
    if (idx === -1) return;
    const note = this.manifest.notes[idx];
    if (note.contentRef) await this.deleteSafeFile(note.contentRef);
    for (const a of note.attachments) {
      await this.deleteSafeFile(a.blobRef);
      if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
    }
    this.manifest.notes.splice(idx, 1);
    await this.saveManifest();
  }

  /**
   * 更新条目正文镜像（覆盖同一 contentRef，不产生孤儿镜像；清单同步持久化）。
   * 供密码本整表（password-vault）等高频改写载荷用：重用既有镜像名，避免每次新镜像堆积。
   * 覆盖走 replaceMirrorAtomic（P0-1）：暂存+rename 原子换入，任何写失败正式位保持旧完整密文。
   */
  async updateNotePayload(noteId: string, plainContent: string): Promise<void> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法保存');
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note) throw new Error('未找到清单条目');
    const encrypted = await CryptoService.encrypt(plainContent, this.password);
    if (note.contentRef) {
      await this.replaceMirrorAtomic(note.contentRef, encrypted); // 原子覆盖同一密文镜像
    } else {
      const ref = flatName();
      await this.replaceMirrorAtomic(ref, encrypted);
      note.contentRef = ref;
    }
    await this.saveManifest();
  }

  /** 解附件预览层 → dataUrl 明文（预览窗用；无预览层返回 null） */
  async decryptPreview(a: SafeAttachment): Promise<string | null> {
    if (!this.unlocked || !this.password) throw new Error('未解锁');
    if (!a.hasPreview) return null;
    const cipher = await this.readMirror(a.previewRef);
    if (!cipher) return null;
    return CryptoService.decrypt(cipher, this.password);
  }

  /**
   * 解附件原始层 → 原始 base64（预览窗缩略图点击按需加载原图/视频用）。
   * 与预览层不同：走 blobRef 解原质量密文；无密文返回 null，解密失败向上抛（调用方兜底）。
   */
  async decryptAttachmentOriginal(a: SafeAttachment): Promise<string | null> {
    if (!this.unlocked || !this.password) throw new Error('未解锁');
    const cipher = await this.readMirror(a.blobRef);
    if (!cipher) return null;
    return CryptoService.decrypt(cipher, this.password);
  }
}
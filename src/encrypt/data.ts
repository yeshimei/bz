/**
 * 加密保险箱数据层（encrypt 域，safe 数据）
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
import { CryptoService, clearCryptoKeyCache } from '../password/crypto';

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
  /** 是否已还原（明文在 vault） */
  restored: boolean;
}

/** 清单里的一条加密笔记 */
export interface SafeNote {
  id: string;
  /** 来源类型：缺省=普通加密笔记；'diary-entry'=加密日记条目（ADR-0017，保险箱面板过滤，日记面板单独读） */
  kind?: 'diary-entry';
  /** 原笔记路径（如 我的/日记/2025-06-01.md） */
  path: string;
  /** 列表展示标题 */
  title: string;
  /** 是否已还原（存量状态字段；现还原=取出即删，新建数据恒 false，仅兼容旧数据保留） */
  restored: boolean;
  createdAt: string;
  /** 正文密文镜像相对路径（encryptRoot 下，平铺随机名 .enc；与附件同级） */
  contentRef: string;
  /** 正文密文内嵌（base64）——旧版数据兼容；新版用 contentRef，此字段留空 */
  content: string;
  /** 摘要密文（base64，预览窗免费能力；可空） */
  summary: string;
  /** 是否含正文摘要（summary 空时 false） */
  hasSummary: boolean;
  attachments: SafeAttachment[];
}

/** 清单明文结构（整体加密进 safe.enc） */
export interface SafeManifest {
  version: number;
  notes: SafeNote[];
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
  /** 来源类型：'diary-entry'=加密日记条目（ADR-0017） */
  kind?: 'diary-entry';
  /** 笔记正文（明文） */
  content: string;
  /** 摘要（明文，可空） */
  summary?: string;
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

/** 镜像相对路径（平铺随机名）：`.随机.enc`，点前缀 Obsidian 侧栏隐藏；文件名不含路径信息，还原靠清单映射 */
export function flatName(): string {
  return '.' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36) + '.enc';
}

/** 暂存目录名（encryptRoot 下，点前缀隐藏、与最终镜像同盘；ADR-0018 提交式加密） */
const STAGING_DIR = '.staging';
/** 挂起标记文件名（暂存区内，明文 noteId 列表；带外标记——不改清单结构，铁律 1） */
const PENDING_FILE = 'pending.json';

/** 生成 note id */
export function genNoteId(): string {
  return 'enc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export class SafeManager {
  /** encryptRoot（vault 相对路径，默认 CONFIG/.ENCRYPT——点前缀目录 Obsidian 侧栏隐藏） */
  root = 'CONFIG/.ENCRYPT';
  /** 主密码（只存内存，锁定时清空） */
  password: string | null = null;
  unlocked = false;
  manifest: SafeManifest = { version: 1, notes: [] };

  constructor(root?: string) {
    if (root) this.root = root.replace(/\/+$/, '');
  }

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
   */
  async unlock(password: string): Promise<boolean> {
    const existsManifest = await this.exists();
    if (!existsManifest) {
      this.password = password;
      this.unlocked = true;
      this.manifest = { version: 1, notes: [] };
      await this.saveManifest();
      return true;
    }
    const content = await this.adapter.read(this.manifestPath);
    if (!content.trim()) {
      this.password = password;
      this.unlocked = true;
      this.manifest = { version: 1, notes: [] };
      await this.saveManifest();
      return true;
    }
    try {
      const plain = await CryptoService.decrypt(content.trim(), password);
      const parsed = JSON.parse(plain);
      if (!parsed || !Array.isArray(parsed.notes)) parsed.notes = [];
      parsed.version = parsed.version || 1;
      this.manifest = parsed;
      this.password = password;
      this.unlocked = true;
      // 自愈（ADR-0018）：回滚挂起的半提交 + 清空暂存残留；失败不阻塞解锁
      try {
        await this.selfHeal();
      } catch (e) {
        /* 自愈失败留待下次解锁重试 */
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 加锁：清内存态（含派生密钥缓存，密钥不残留） */
  lock() {
    this.unlocked = false;
    this.password = null;
    this.manifest = { version: 1, notes: [] };
    clearCryptoKeyCache();
  }

  /** 持久化清单（整体加密写回 .safe.enc；adapter 直写磁盘，点前缀可用） */
  async saveManifest() {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法保存清单');
    const json = JSON.stringify(this.manifest);
    const encrypted = await CryptoService.encrypt(json, this.password);
    await this.ensureDirFor(this.manifestPath);
    await this.adapter.write(this.manifestPath, encrypted);
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

  /** 写镜像密文文件（点前缀，adapter 直写磁盘） */
  private async writeMirror(ref: string, ciphertext: string) {
    const path = this.resolveRef(ref);
    await this.ensureDirFor(path);
    await this.adapter.write(path, ciphertext);
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
   * 自愈回滚（ADR-0018）：对挂起标记仍在的条目判定「半提交」——删除其引用的顶层镜像
   * （已搬入的清掉、未搬入的自然无文件）、从清单丢弃该条目，随后清空暂存区与标记。
   * 关键不变量：标记于删原文件前清除，故标记存在 ⇒ 原文件未删 ⇒ 回滚永远安全、
   * 不产生密文孤儿。无挂起条目时仅清空遗留暂存。解锁成功后调用；失败不阻塞解锁。
   */
  async selfHeal(): Promise<void> {
    if (!this.unlocked || !this.password) return;
    const pending = await this.readPending();
    if (pending.length) {
      let changed = false;
      for (const id of pending) {
        const idx = this.manifest.notes.findIndex((n) => n.id === id);
        if (idx === -1) continue;
        const note = this.manifest.notes[idx];
        if (note.contentRef) await this.deleteSafeFile(note.contentRef);
        for (const a of note.attachments) {
          await this.deleteSafeFile(a.blobRef);
          if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
        }
        this.manifest.notes.splice(idx, 1);
        changed = true;
      }
      if (changed) await this.saveManifest();
    }
    await this.clearStaging();
  }

  /**
   * 手动「清理未引用的密文」（Q5-A：不自动触发，点按钮才跑）：
   * 扫描 encryptRoot 顶层，删除未被任何清单条目 contentRef/blobRef/previewRef 引用的
   * 点前缀 `.随机.enc` 形态密文（`.safe.enc` 与本目录旧布局一律不碰），并清空暂存区。
   * @returns 删除的顶层密文文件数
   */
  async cleanupOrphans(): Promise<number> {
    if (!this.unlocked) throw new Error('未解锁，无法清理密文');
    const referenced = new Set<string>();
    for (const n of this.manifest.notes) {
      if (n.contentRef) referenced.add(n.contentRef);
      for (const a of n.attachments) {
        if (a.blobRef) referenced.add(a.blobRef);
        if (a.hasPreview && a.previewRef) referenced.add(a.previewRef);
      }
    }
    let removed = 0;
    try {
      if (await this.adapter.exists(this.root)) {
        const listing = await this.adapter.list(this.root);
        for (const f of listing.files) {
          const name = f.slice(f.lastIndexOf('/') + 1);
          if (name === '.safe.enc') continue; // 清单本体绝不触碰
          if (!name.startsWith('.') || !name.endsWith('.enc')) continue; // 只清平铺点前缀密文形态
          if (referenced.has(name)) continue; // 被引用不碰
          try {
            await this.adapter.remove(f);
            removed += 1;
          } catch (e) {
            /* 单文件失败继续 */
          }
        }
      }
      await this.clearStaging();
    } catch (e) {
      /* 幂等 */
    }
    return removed;
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
  async lockNote(
    input: LockNoteInput,
    onProgress?: (p: EncryptProgress) => void,
    onDeleteFailed?: (paths: string[]) => void
  ): Promise<SafeNote> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法加密笔记');
    await this.ensureSafeRootDir();
    await this.ensureStagingDir();
    const total = input.attachments.length + 1;
    let done = 0;

    const attachments: SafeAttachment[] = [];
    const finalRefs: string[] = [];
    const stagedRefs: string[] = [];
    try {
      for (const a of input.attachments) {
        done += 1;
        onProgress?.({ done, total, current: a.path });
        const fp = await fingerprintOf(a.data);
        const enc = await CryptoService.encrypt(a.data, this.password);
        const blobRef = flatName();
        await this.writeStaged(blobRef, enc);
        stagedRefs.push(blobRef);
        finalRefs.push(blobRef);
        let hasPreview = false;
        let previewRef = '';
        if (a.previewData) {
          const encP = await CryptoService.encrypt(a.previewData, this.password);
          previewRef = flatName();
          await this.writeStaged(previewRef, encP);
          stagedRefs.push(previewRef);
          finalRefs.push(previewRef);
          hasPreview = true;
        }
        attachments.push({
          path: a.path,
          kind: a.kind || 'image',
          blobRef,
          blobSize: enc.length,
          fingerprint: fp,
          hasPreview,
          previewRef,
          restored: false,
        });
      }

      done += 1;
      onProgress?.({ done, total, current: input.path });
      // 正文同样写镜像文件（不内嵌进清单）
      const bodyRef = flatName();
      const bodyCipher = await CryptoService.encrypt(input.content, this.password);
      await this.writeStaged(bodyRef, bodyCipher);
      stagedRefs.push(bodyRef);
      finalRefs.push(bodyRef);
      const note: SafeNote = {
        id: genNoteId(),
        kind: input.kind || undefined,
        path: input.path,
        title: input.title,
        restored: false,
        createdAt: new Date().toISOString(),
        contentRef: bodyRef,
        content: '',
        summary: input.summary ? await CryptoService.encrypt(input.summary, this.password) : '',
        hasSummary: !!input.summary,
        attachments,
      };

      // ---- 提交序列（ADR-0018） ----
      // S1 挂起标记（存在 ⇒ 可安全回滚；清除前绝不删除原文件）
      await this.ensureStagingDir();
      await this.adapter.write(this.pendingPath, JSON.stringify([note.id]));
      // S2 清单先行（提交点）：条目先于镜像文件写入清单
      this.manifest.notes.push(note);
      await this.saveManifest();
      // S3 暂存镜像搬入顶层（失败抛出 → 整笔放弃，挂起态留待解锁自愈）
      for (const ref of finalRefs) await this.promoteStaged(ref);
      // S4 清除挂起标记（失败必须抛出：标记残留时绝不允许进入 S5 删原文件）
      try {
        await this.adapter.remove(this.pendingPath);
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
      // 普通加密笔记删除整篇原文件；加密日记条目不删整 md（条目块移除由日记域自行处理，ADR-0017 Q6-b）
      if (input.kind !== 'diary-entry') {
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
      throw e;
    }
  }

  /**
   * 还原（取出即删）一篇笔记：解原文 + 原质量附件写回原路径。
   * 覆盖目标文件前校验指纹：不匹配（用户新建了同名文件）→ 跳过不盖 → 该条目留在保险箱。
   * 全部还原成功（无冲突）后：删除本文全部加密镜像（正文+附件原始层/预览层）、从清单移除，彻底取出。
   * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
   */
  async restoreNote(
    noteId: string,
    onProgress?: (p: EncryptProgress) => void
  ): Promise<{ note: SafeNote; conflicts: string[]; removed: boolean }> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法还原笔记');
    const app = getApp();
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note) throw new Error('未找到该加密笔记');
    const conflicts: string[] = [];
    const total = note.attachments.length + 1;
    let done = 0;

    // 附件先还原
    for (const a of note.attachments) {
      onProgress?.({ done, total, current: a.path });
      const ok = await this.restoreAttachment(a);
      done += 1;
      if (!ok) conflicts.push(a.path);
    }
    // 正文还原（contentRef 镜像优先，兼容旧版内嵌 content）
    onProgress?.({ done, total, current: note.path });
    const plain = await this.decryptNoteBody(note);
    if (plain === null || plain === undefined) {
      conflicts.push(note.path);
    } else if (note.kind === 'diary-entry') {
      // 加密日记条目：块级 merge 回原日期文件（按 # emoji HH:mm 时间序重插），非整文件覆盖（ADR-0017 Q23-A）
      const mergeOk = await this.mergeDiaryBlock(note.path, plain);
      if (!mergeOk) conflicts.push(note.path);
    } else if (this.fileExists(note.path)) {
      // 目标路径已被用户占用（非本次还原写回）→ 冲突跳过
      conflicts.push(note.path);
    } else {
      await this.ensureVaultParentFolder(note.path);
      const file = await app.vault.create(note.path, plain);
      (app.metadataCache as any)?.trigger?.('changed', file);
    }
    done = total;
    onProgress?.({ done, total, current: note.path });

    // 全部成功 → 彻底取出（删镜像 + 移除清单条目）；否则保留（含已还原文件留副本，安全第一）
    const removed = conflicts.length === 0;
    if (removed) {
      await this.deleteSafeFile(note.contentRef);
      for (const a of note.attachments) {
        await this.deleteSafeFile(a.blobRef);
        if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
      }
      const idx = this.manifest.notes.indexOf(note);
      if (idx !== -1) this.manifest.notes.splice(idx, 1);
    }
    await this.saveManifest();
    return { note, conflicts, removed };
  }

  /** 解笔记正文明文：contentRef 镜像优先，旧版内嵌 content base64 兼容回退 */
  async decryptNoteBody(note: SafeNote): Promise<string | null> {
    if (!this.unlocked || !this.password) throw new Error('未解锁');
    if (note.contentRef) {
      const cipher = await this.readMirror(note.contentRef);
      if (cipher) return CryptoService.decrypt(cipher, this.password);
    }
    if (note.content) return CryptoService.decrypt(note.content, this.password);
    return null;
  }

  /**
   * 加密日记条目还原：还原附件 → 把 finalBlock（由调用方准备，可为原文或改分类降级后重建）merge 回原日期 md → 取出即删。
   */
  async restoreDiaryEntry(noteId: string, finalBlock: string): Promise<boolean> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法还原加密日记');
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note || note.kind !== 'diary-entry') throw new Error('未找到该加密日记条目');
    const conflicts: string[] = [];
    for (const a of note.attachments) {
      const ok = await this.restoreAttachment(a);
      if (!ok) conflicts.push(a.path);
    }
    if (!finalBlock) {
      conflicts.push(note.path);
    } else {
      const ok = await this.mergeDiaryBlock(note.path, finalBlock);
      if (!ok) conflicts.push(note.path);
    }
    // 无冲突则彻底取出（删镜像 + 移除清单条目）
    if (conflicts.length === 0) {
      await this.deleteSafeFile(note.contentRef);
      for (const a of note.attachments) {
        await this.deleteSafeFile(a.blobRef);
        if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
      }
      const idx = this.manifest.notes.indexOf(note);
      if (idx !== -1) this.manifest.notes.splice(idx, 1);
    }
    await this.saveManifest();
    return conflicts.length === 0;
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

  /** 还原单个附件：解原始层 → 写回原路径（二进制）；指纹不符或已存在非本系统文件视为冲突跳过 */
  private async restoreAttachment(a: SafeAttachment): Promise<boolean> {
    const app = getApp();
    const password = this.password;
    if (!password) return false;
    const cipher = await this.readMirror(a.blobRef);
    if (cipher === null) return false;
    const plainB64 = await CryptoService.decrypt(cipher, password);
    const currentFp = await fingerprintOf(plainB64);
    if (this.fileExists(a.path)) {
      if (currentFp !== a.fingerprint) return false; // 用户新建同名文件 → 冲突
    }
    const data = base64ToBytes(plainB64);
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const existing = app.vault.getAbstractFileByPath(a.path);
    let file = existing;
    if (existing) await (app.vault as any).writeBinary(existing as any, buf);
    else {
      await this.ensureVaultParentFolder(a.path);
      file = await app.vault.createBinary(a.path, buf);
    }
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

  /** 解正文密文 → 明文（兼容旧版内嵌 content base64，供既有调用/测试使用） */
  async decryptText(contentCipher?: string): Promise<string> {
    if (!this.unlocked || !this.password) throw new Error('未解锁');
    if (!contentCipher) return '';
    return CryptoService.decrypt(contentCipher, this.password);
  }

  /** 解附件摘要密文 → 明文（预览窗用；无预览层返回 null） */
  async decryptSummary(note: SafeNote): Promise<string | null> {
    if (!this.unlocked || !this.password) throw new Error('未解锁');
    if (!note.hasSummary) return null;
    return CryptoService.decrypt(note.summary, this.password);
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

  /** 附件原始层尺寸（bytes） */
  attachmentSize(a: SafeAttachment): number {
    return a.blobSize;
  }
}
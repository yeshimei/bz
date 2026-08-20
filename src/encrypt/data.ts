/**
 * 加密保险箱数据层（encrypt 域，safe 数据）
 * 移出式清单容器加密：SafeManager 负责 清单(safe.enc) 读写、附件密文镜像、
 * 加锁(lockNote)/真还原(restoreNote)/收回(collectNote) 的状态机与落盘。
 *
 * 数据落地（用户拍板 Q10=A）：
 *   <encryptRoot>/safe.enc                整库唯一加密清单
 *   <encryptRoot>/附件/<原路径>             附件原始层密文镜像
 *   <encryptRoot>/附件/_预览/<原路径>        附件预览层密文镜像
 *
 * 密钥：每个 blob 直接用主密码经 CryptoService.encrypt 独立加密（同 passwords.enc 模型）。
 * 依赖方向（ADR-0002）：core ← 本层；不挂 window；import CryptoService 复用密码本。
 */
import { getApp } from '../core/app';
import { CryptoService } from '../password/crypto';

/** 附件类型 */
export type AttachmentKind = 'image' | 'video';

/** 清单里的一条加密附件 */
export interface SafeAttachment {
  /** 原 vault 路径（如 我的/影视/x.png） */
  path: string;
  kind: AttachmentKind;
  /** 原始层镜像相对路径（encryptRoot 下，如 附件/我的/影视/x.png） */
  blobRef: string;
  /** 原始层密文文件大小（字节，便于 UI 展示） */
  blobSize: number;
  /** 原始层判重指纹（SHA-256(原始 base64)，覆盖冲突安全用） */
  fingerprint: string;
  /** 是否有预览层 */
  hasPreview: boolean;
  /** 预览层镜像相对路径 */
  previewRef: string;
  /** 是否已还原（明文在 vault） */
  restored: boolean;
}

/** 清单里的一条加密笔记 */
export interface SafeNote {
  id: string;
  /** 原笔记路径（如 我的/日记/2025-06-01.md） */
  path: string;
  /** 列表展示标题 */
  title: string;
  /** 是否已还原（true=明文在 vault，待收回） */
  restored: boolean;
  createdAt: string;
  /** 正文密文（base64，CryptoService.encrypt(content)） */
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
  /** 笔记正文（明文） */
  content: string;
  /** 摘要（明文，可空） */
  summary?: string;
  attachments: LockAttachmentInput[];
}

/** ArrayBuffer → base64 */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
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

/** 镜像相对路径：附件原始层 */
export function mirrorRef(origPath: string): string {
  return '附件/' + origPath;
}

/** 镜像相对路径：附件预览层 */
export function previewMirrorRef(origPath: string): string {
  return '附件/_预览/' + origPath;
}

/** 生成 note id */
export function genNoteId(): string {
  return 'enc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export class SafeManager {
  /** encryptRoot（vault 相对路径，默认 CONFIG/ENCRYPT） */
  root = 'CONFIG/ENCRYPT';
  /** 主密码（只存内存，锁定时清空） */
  password: string | null = null;
  unlocked = false;
  manifest: SafeManifest = { version: 1, notes: [] };

  constructor(root?: string) {
    if (root) this.root = root.replace(/\/+$/, '');
  }

  /** 清单文件完整路径 */
  get manifestPath(): string {
    return this.root + '/safe.enc';
  }

  /** 镜像相对路径 → vault 完整路径 */
  resolveRef(ref: string): string {
    return this.root + '/' + ref;
  }

  /** 清单是否存在（用于首设判断） */
  exists(): boolean {
    return !!getApp().vault.getAbstractFileByPath(this.manifestPath);
  }

  /**
   * 解锁：读 safe.enc → 解密 → 解析清单。首设（无文件）时创建空清单并设密码。
   * 校验方式=解密成功即通过（GCM 认证，同密码本）。
   */
  async unlock(password: string): Promise<boolean> {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(this.manifestPath);
    if (!file) {
      this.password = password;
      this.unlocked = true;
      this.manifest = { version: 1, notes: [] };
      await this.saveManifest();
      return true;
    }
    const content = await app.vault.read(file as any);
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
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 加锁：清内存态 */
  lock() {
    this.unlocked = false;
    this.password = null;
    this.manifest = { version: 1, notes: [] };
  }

  /** 持久化清单（整体加密写回 safe.enc） */
  async saveManifest() {
    const app = getApp();
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法保存清单');
    const json = JSON.stringify(this.manifest);
    const encrypted = await CryptoService.encrypt(json, this.password);
    if (this.root) {
      const dir = app.vault.getAbstractFileByPath(this.root);
      if (!dir) await app.vault.createFolder(this.root);
    }
    const file = app.vault.getAbstractFileByPath(this.manifestPath);
    if (file) await app.vault.modify(file as any, encrypted);
    else await app.vault.create(this.manifestPath, encrypted);
  }

  /** 确保镜像目录存在（附件根 + 预览子目录） */
  private async ensureMirrorDirs() {
    const app = getApp();
    const mkdir = async (p: string) => {
      const dir = app.vault.getAbstractFileByPath(p);
      if (!dir) await app.vault.createFolder(p);
    };
    if (this.root) await mkdir(this.root);
    await mkdir(this.root + '/附件');
    await mkdir(this.root + '/附件/_预览');
  }

  /** 读附件原始层（当前 vault 文件）→ base64 */
  private async readAttachmentData(file: any): Promise<string> {
    const buf = await getApp().vault.readBinary(file);
    return bytesToBase64(new Uint8Array(buf));
  }

  /** 写镜像密文文件（文本 base64） */
  private async writeMirror(ref: string, ciphertext: string) {
    const app = getApp();
    const path = this.resolveRef(ref);
    const file = app.vault.getAbstractFileByPath(path);
    if (file) await app.vault.modify(file as any, ciphertext);
    else await app.vault.create(path, ciphertext);
  }

  /** 读镜像密文文件 → base64 密文字符串 */
  private async readMirror(ref: string): Promise<string | null> {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(this.resolveRef(ref));
    if (!file) return null;
    return (await app.vault.read(file as any)).trim();
  }

  /** 删除 vault 文件（幂等） */
  private async deleteVaultFile(path: string) {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path);
    if (file && (file as any).isFolder !== true) {
      await app.vault.delete(file as any);
    }
  }

  /** 是否存在 vault 文件 */
  private fileExists(path: string): boolean {
    const f = getApp().vault.getAbstractFileByPath(path);
    return !!f && (f as any).isFolder !== true;
  }

  /**
   * 加锁一篇笔记：把当前笔记正文 + 双链附件移入保险箱。
   * 先写密文镜像 + 更新清单，全部成功后才删 vault 原文件（崩溃幂等）。
   */
  async lockNote(input: LockNoteInput): Promise<SafeNote> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法加密笔记');
    await this.ensureMirrorDirs();

    const attachments: SafeAttachment[] = [];
    for (const a of input.attachments) {
      const fp = await fingerprintOf(a.data);
      const enc = await CryptoService.encrypt(a.data, this.password);
      const blobRef = mirrorRef(a.path);
      await this.writeMirror(blobRef, enc);
      let hasPreview = false;
      let previewRef = '';
      if (a.previewData) {
        const encP = await CryptoService.encrypt(a.previewData, this.password);
        previewRef = previewMirrorRef(a.path);
        await this.writeMirror(previewRef, encP);
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

    const note: SafeNote = {
      id: genNoteId(),
      path: input.path,
      title: input.title,
      restored: false,
      createdAt: new Date().toISOString(),
      content: await CryptoService.encrypt(input.content, this.password),
      summary: input.summary ? await CryptoService.encrypt(input.summary, this.password) : '',
      hasSummary: !!input.summary,
      attachments,
    };
    this.manifest.notes.push(note);
    await this.saveManifest();

    // 全部成功后删除 vault 原文件（笔记 + 附件）
    for (const a of input.attachments) await this.deleteVaultFile(a.path);
    await this.deleteVaultFile(input.path);

    return note;
  }

  /**
   * 真还原一篇笔记：解原文 + 原质量附件写回原路径，标记 restored。
   * 覆盖目标文件前校验指纹：不匹配（用户新建了同名文件）→ 跳过不盖。
   * 每写一个文件触发 metadataCache 更新（各域立即恢复）。
   */
  async restoreNote(noteId: string): Promise<{ note: SafeNote; conflicts: string[] }> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法还原笔记');
    const app = getApp();
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note) throw new Error('未找到该加密笔记');
    const conflicts: string[] = [];

    // 附件先还原
    for (const a of note.attachments) {
      if (a.restored) continue;
      const ok = await this.restoreAttachment(a);
      if (ok) a.restored = true;
      else conflicts.push(a.path);
    }
    // 正文还原
    const plain = await CryptoService.decrypt(note.content, this.password);
    if (this.fileExists(note.path)) {
      // restored=false 时 vault 里本不该有该笔记；有 = 非本系统写入 → 冲突跳过
      conflicts.push(note.path);
    } else {
      const file = await app.vault.create(note.path, plain);
      (app.metadataCache as any)?.trigger?.('changed', file);
      note.restored = true;
    }
    await this.saveManifest();
    return { note, conflicts };
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
    else file = await app.vault.createBinary(a.path, buf);
    (app.metadataCache as any)?.trigger?.('changed', file);
    return true;
  }

  /**
   * 收回（加锁已还原笔记）：重新读取 vault 当前明文笔记 + 附件，再加密入库。
   * 保留原 SafeNote 的 id/createdAt。
   */
  async collectNote(noteId: string): Promise<void> {
    if (!this.unlocked || !this.password) throw new Error('未解锁，无法收回笔记');
    const app = getApp();
    const note = this.manifest.notes.find((n) => n.id === noteId);
    if (!note) throw new Error('未找到该加密笔记');
    if (!note.restored) return; // 已在库中

    await this.ensureMirrorDirs();
    const file = app.vault.getAbstractFileByPath(note.path);
    if (!file) {
      // 笔记文件不存在：视为已被用户删除，标记 restored=false（自身消失）
      note.restored = false;
      for (const a of note.attachments) a.restored = false;
      await this.saveManifest();
      return;
    }
    const content = await app.vault.read(file as any);
    note.content = await CryptoService.encrypt(content, this.password);

    // 已还原的附件：重新取当前磁盘明文再加密；未还原的不动
    for (const a of note.attachments) {
      if (!a.restored) continue;
      const orig = app.vault.getAbstractFileByPath(a.path);
      if (orig) {
        const data = await this.readAttachmentData(orig);
        const enc = await CryptoService.encrypt(data, this.password);
        await this.writeMirror(a.blobRef, enc);
        a.fingerprint = await fingerprintOf(data);
      }
    }
    // 删除 vault 里已还原的原文件（正文 + 附件）
    await this.deleteVaultFile(note.path);
    for (const a of note.attachments) {
      if (a.restored) await this.deleteVaultFile(a.path);
    }
    note.restored = false;
    for (const a of note.attachments) a.restored = false;
    await this.saveManifest();
  }

  /** 删除一条加密笔记（连同镜像文件、清单记录）。谨慎：真删除不可恢复。 */
  async removeNote(noteId: string): Promise<void> {
    if (!this.unlocked) throw new Error('未解锁');
    const idx = this.manifest.notes.findIndex((n) => n.id === noteId);
    if (idx === -1) return;
    const note = this.manifest.notes[idx];
    for (const a of note.attachments) {
      await this.deleteVaultFile(this.resolveRef(a.blobRef));
      if (a.hasPreview) await this.deleteVaultFile(this.resolveRef(a.previewRef));
    }
    this.manifest.notes.splice(idx, 1);
    await this.saveManifest();
  }

  /** 解正文密文 → 明文（预览窗/阅读用） */
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

  /** 附件原始层尺寸（bytes） */
  attachmentSize(a: SafeAttachment): number {
    return a.blobSize;
  }
}
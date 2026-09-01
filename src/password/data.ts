/**
 * 密码本数据管理器（合并至保险箱：路线 B 硬合并）
 * 数据不再独立落盘（无 passwords.enc）——整表作为保险箱清单里的一篇 SafeNote：
 *   kind='password-vault'，正文镜像（contentRef）存整表密文，与保险箱共享主密码/解锁态。
 * 条目 8 字段：id/platform/url/account/password/note/createdAt/favorite。
 * 加解密复用 SafeManager（CryptoService 本就共享）；增删改 = 整表重加密覆盖同一镜像（不产生孤儿）。
 */
import { getSafeManager } from '../encrypt';
import { type SafeManager } from '../encrypt/data';

export interface PasswordEntry {
  id: string;
  platform: string;
  url: string;
  account: string;
  password: string;
  note: string;
  createdAt: string;
  favorite: boolean;
}

/** 保险箱清单条目约定：kind 值 + 虚拟路径/标题（无原文件，不参与还原/删除） */
const VAULT_KIND = 'password-vault' as const;
const VAULT_PATH = 'CONFIG/.ENCRYPT/passwords';
const VAULT_TITLE = '密码本';

export class DataManager {
  private safe: SafeManager;
  pwData: PasswordEntry[] = [];
  /**
   * load 结果缓存（ticket 43）：记录「清单条目 + 原始密文字节」。
   * 判等用密文字节而非解密：PBKDF2 解密昂贵，搜索逐键渲染等纯读场景命中缓存即跳过整表重解密；
   * 任何写操作都会重加密（密文天然变化）→ 缓存自动失效，不产生陈旧数据。
   */
  private loadCache: { noteId: string; cipher: string | null } | null = null;

  /** 注入 SafeManager（测试用）；缺省取保险箱单例（与保险箱面板共享主密码与解锁态） */
  constructor(safe?: SafeManager) {
    this.safe = safe || getSafeManager();
  }

  /** 解锁态 = 保险箱解锁态（同一把主密码） */
  get unlocked(): boolean {
    return this.safe.unlocked;
  }

  /** 密码本对应的清单条目（无则 null） */
  private get vaultNote() {
    return this.safe.manifest.notes.find((n) => n.kind === VAULT_KIND) || null;
  }

  async load() {
    if (!this.safe.unlocked) {
      throw new Error('未解锁，无法加载数据');
    }
    const note = this.vaultNote;
    if (!note) {
      this.pwData = [];
      this.loadCache = null;
      return;
    }
    // 缓存命中：同一清单条目且镜像密文字节未变 → 复用上次解密结果
    const cipher = await this.safe.readNotePayloadRaw(note);
    if (this.loadCache && this.loadCache.noteId === note.id && this.loadCache.cipher === cipher) {
      return;
    }
    const plain = await this.safe.decryptNoteBody(note);
    if (plain === null) throw new Error('密码本数据解密失败');
    let parsed: unknown;
    try {
      parsed = JSON.parse(plain);
    } catch (e) {
      throw new Error('密码本数据损坏');
    }
    // 脏数据防御（P2）：过滤 null / 非对象元素
    this.pwData = Array.isArray(parsed)
      ? parsed.filter((x): x is PasswordEntry => !!x && typeof x === 'object' && !Array.isArray(x))
      : [];
    // 确保每个条目有 id、基本字段和 favorite
    this.pwData = this.pwData.map((item: any) => {
      if (!item.id) item.id = `pw-${Date.now()}-${Math.random()}`;
      if (!item.platform) item.platform = '';
      if (!item.url) item.url = '';
      if (!item.account) item.account = '';
      if (!item.password) item.password = '';
      if (!item.note) item.note = '';
      if (!item.createdAt) item.createdAt = new Date().toISOString();
      if (typeof item.favorite !== 'boolean') item.favorite = false;
      return item;
    });
    this.loadCache = { noteId: note.id, cipher };
  }

  async save() {
    if (!this.safe.unlocked) {
      throw new Error('未解锁，无法保存数据');
    }
    const json = JSON.stringify(this.pwData, null, 2);
    const note = this.vaultNote;
    if (note) {
      await this.safe.updateNotePayload(note.id, json);
    } else {
      await this.safe.lockNote({
        path: VAULT_PATH,
        title: VAULT_TITLE,
        kind: VAULT_KIND,
        content: json,
        attachments: [],
      });
    }
  }

  /** 上锁：整体锁定（与保险箱共享解锁态），清空内存数据与 load 缓存 */
  lock() {
    this.safe.lock();
    this.pwData = [];
    this.loadCache = null;
  }

  async addItem(item: Partial<PasswordEntry>) {
    if (!this.unlocked) throw new Error('未解锁');
    (item as any).id = `pw-${Date.now()}-${Math.random()}`;
    (item as any).createdAt = new Date().toISOString();
    if (typeof (item as any).favorite !== 'boolean') (item as any).favorite = false;
    this.pwData.push(item as PasswordEntry);
    return this.save();
  }

  async updateItem(id: string, newData: Partial<PasswordEntry>) {
    if (!this.unlocked) throw new Error('未解锁');
    const index = this.pwData.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('条目不存在');
    this.pwData[index] = { ...this.pwData[index], ...newData };
    return this.save();
  }

  async deleteItem(id: string) {
    if (!this.unlocked) throw new Error('未解锁');
    const index = this.pwData.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('条目不存在');
    this.pwData.splice(index, 1);
    return this.save();
  }

  search(keyword: string): PasswordEntry[] {
    if (!this.unlocked) throw new Error('未解锁');
    if (!keyword) return this.pwData;
    const lower = keyword.toLowerCase();
    return this.pwData.filter(
      (item) =>
        (item.platform || '').toLowerCase().includes(lower) ||
        (item.account || '').toLowerCase().includes(lower) ||
        (item.note || '').toLowerCase().includes(lower)
    );
  }
}

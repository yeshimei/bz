/**
 * 保险库·密码资产数据管理器（encrypt 域子模块；ADR-0085 自 password-vault/data.ts 迁入）
 * 密码条目数据源 = 保险库清单内 kind='password-vault' 的 SafeNote（同一主密码/解锁态）：
 *  - 增删改 = 整表重加密覆盖同一镜像（updateNotePayload / lockNote 首建）；
 *  - fav 字段为新增（旧 7 字段数据缺失时默认 false，兼容性冻结不破坏）。
 * 域事件：本模块写操作后广播 'password-vault:changed'（source=password-vault 跳过自重载）；
 * 外部（日记/其他消费者）写保险库清单由 SafeManager 广播 'encrypt:changed' 后本模块订阅重载。
 */
import { emitDomainEvent, onDomainEvent } from '../core/domain-bus';
import { type SafeManager } from './data';

/** 密码资产域事件通道（自己广播；source=password-vault 跳过自重载） */
export const PASSWORD_VAULT_CHANNEL = 'password-vault:changed' as const;
/** 保险库数据变更通道（外部消费者写 password-vault SafeNote 时广播） */
export const ENCRYPT_CHANGED_CHANNEL = 'encrypt:changed' as const;

export interface PasswordVaultEntry {
  id: string;
  platform: string;
  url: string;
  account: string;
  password: string;
  note: string;
  createdAt: string;
  /** 收藏（v1 原型新增字段；旧数据缺失默认 false） */
  fav: boolean;
}

/** 保险库清单条目约定：kind 值 + 虚拟路径/标题（与旧密码本域完全一致，共享同一数据） */
const VAULT_KIND = 'password-vault' as const;
const VAULT_PATH = 'CONFIG/.ENCRYPT/passwords';
const VAULT_TITLE = '密码本';

/** 平台聚合查询结果：{ platform, accounts[] }（按最近账号时间倒序） */
export interface PlatformGroup {
  platform: string;
  accounts: PasswordVaultEntry[];
}

export class PasswordVaultDataManager {
  private safe: SafeManager;
  pwData: PasswordVaultEntry[] = [];
  /** load 缓存（ticket 43 同款）：清单条目 + 原始密文字节；密文未变不重解密 */
  private loadCache: { noteId: string; cipher: string | null } | null = null;
  /** 域事件退订 */
  private offChanged: (() => void) | null = null;
  private offEncryptChanged: (() => void) | null = null;
  /** 自身写盘中标志：save() 期间跳过外部事件重载（自己写的 encrypt:changed 广播不触发自重载） */
  private saving = false;
  /** 外部变更回调（UI 订阅；外部改动 → 重载后回调） */
  onExternalChange: (() => void) | null = null;

  /** 显式注入 SafeManager（ADR-0085：encrypt Controller 装配同一单例，避免域内循环依赖默认取单例） */
  constructor(safe: SafeManager) {
    this.safe = safe;
    // - 本通道（password-vault:changed）：其他实例/自己写后广播，source=password-vault 跳过
    // - 保险库通道（encrypt:changed）：外部改同一 SafeNote → 重载 + 通知 UI
    this.offChanged = onDomainEvent<{ source?: string }>(PASSWORD_VAULT_CHANNEL, (evt) => {
      if (evt?.source === 'password-vault') return; // 自己发的，不重复重载
      void this.reloadFromExternal();
    });
    this.offEncryptChanged = onDomainEvent<{ noteId?: string }>(ENCRYPT_CHANGED_CHANNEL, (evt) => {
      // 只关心 password-vault 条目（保险库可能改其他笔记）
      const note = this.vaultNote;
      if (!note || (evt?.noteId && evt.noteId !== note.id)) return;
      void this.reloadFromExternal();
    });
  }

  /** 解锁态 = 保险库解锁态（同一把主密码） */
  get unlocked(): boolean {
    return this.safe.unlocked;
  }

  /** 底层 SafeManager（锁屏/首设判定用；与数据层同一实例） */
  get safeManager(): SafeManager {
    return this.safe;
  }

  private get vaultNote() {
    return this.safe.manifest.notes.find((n) => n.kind === VAULT_KIND) || null;
  }

  /** 外部变更处理：尝试重载（未解锁/失败静默，由 UI 自行决定展示） */
  private async reloadFromExternal(): Promise<void> {
    if (this.saving) return; // 自己写盘期间（广播 encrypt:changed）不触发自重载
    if (!this.safe.unlocked) return;
    try {
      await this.load();
      this.onExternalChange?.();
    } catch (e) {
      /* 外部变更但重载失败：保持旧内存态，不打断用户 */
    }
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
    const cipher = await this.safe.readNotePayloadRaw(note);
    if (this.loadCache && this.loadCache.noteId === note.id && this.loadCache.cipher === cipher) {
      return;
    }
    const plain = await this.safe.decryptNoteBody(note);
    if (plain === null) throw new Error('保险库数据解密失败');
    let parsed: unknown;
    try {
      parsed = JSON.parse(plain);
    } catch (e) {
      throw new Error('保险库数据损坏');
    }
    // 脏数据防御（P2，与旧密码本同款）：过滤非对象元素 + 归一化补齐字段
    this.pwData = Array.isArray(parsed)
      ? parsed.filter((x): x is PasswordVaultEntry => !!x && typeof x === 'object' && !Array.isArray(x))
      : [];
    this.pwData = this.pwData.map((item: any) => {
      if (!item.id) item.id = `pw-${Date.now()}-${Math.random()}`;
      if (!item.platform) item.platform = '';
      if (!item.url) item.url = '';
      if (!item.account) item.account = '';
      if (!item.password) item.password = '';
      if (!item.note) item.note = '';
      if (!item.createdAt) item.createdAt = new Date().toISOString();
      // fav 兼容：旧数据缺失默认 false
      if (item.fav === undefined) item.fav = false;
      return item;
    });
    this.loadCache = { noteId: note.id, cipher };
  }

  async save() {
    if (!this.safe.unlocked) {
      throw new Error('未解锁，无法保存数据');
    }
    this.saving = true;
    try {
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
    } finally {
      this.saving = false;
    }
    // 写后广播（source 标记自己，订阅端跳过自重载）
    emitDomainEvent(PASSWORD_VAULT_CHANNEL, { source: 'password-vault' });
  }

  lock() {
    this.safe.lock();
    this.pwData = [];
    this.loadCache = null;
  }

  // ---------- 平台聚合 ----------
  platforms(): PlatformGroup[] {
    const map = new Map<string, PasswordVaultEntry[]>();
    for (const d of this.pwData) {
      const key = d.platform || '(无平台)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    const list: PlatformGroup[] = [];
    for (const [platform, accounts] of map) {
      accounts.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
      list.push({ platform, accounts });
    }
    list.sort((a, b) => (a.accounts[0]?.createdAt || '').localeCompare(b.accounts[0]?.createdAt || '') * -1);
    return list;
  }

  accountsOf(platform: string): PasswordVaultEntry[] {
    const key = platform || '(无平台)';
    return this.pwData
      .filter((d) => (d.platform || '(无平台)') === key)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
  }

  hasFav(platform: string): boolean {
    return this.accountsOf(platform).some((d) => d.fav);
  }

  favCount(platform: string): number {
    return this.accountsOf(platform).filter((d) => d.fav).length;
  }

  // ---------- 条目操作 ----------

  /** 内存快照（E1）：逐条浅拷贝——就地改对象的 mutator（toggleFav/updatePlatform）可回滚 */
  private snapshot(): PasswordVaultEntry[] {
    return this.pwData.map((d) => ({ ...d }));
  }

  /** 写事务（E1）：save 失败回滚内存到快照再 rethrow——磁盘/加密/清单写任一环节失败
   *  不残留幽灵条目/半改态（改盘前先恢复内存，交由 UI 层兜底提示 + 重渲染） */
  private async saveWithRollback(snap: PasswordVaultEntry[]): Promise<void> {
    try {
      await this.save();
    } catch (e) {
      this.pwData = snap;
      throw e;
    }
  }

  async addItem(item: Partial<PasswordVaultEntry>) {
    if (!this.unlocked) throw new Error('未解锁');
    const snap = this.snapshot();
    (item as any).id = `pw-${Date.now()}-${Math.random()}`;
    (item as any).createdAt = new Date().toISOString();
    if ((item as any).fav === undefined) (item as any).fav = false;
    this.pwData.unshift(item as PasswordVaultEntry);
    await this.saveWithRollback(snap);
  }

  async updateItem(id: string, newData: Partial<PasswordVaultEntry>) {
    if (!this.unlocked) throw new Error('未解锁');
    const index = this.pwData.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('条目不存在');
    const snap = this.snapshot();
    this.pwData[index] = { ...this.pwData[index], ...newData };
    await this.saveWithRollback(snap);
  }

  async deleteItem(id: string) {
    if (!this.unlocked) throw new Error('未解锁');
    const index = this.pwData.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('条目不存在');
    const snap = this.snapshot();
    this.pwData.splice(index, 1);
    await this.saveWithRollback(snap);
  }

  /** 删除整个平台（返回删除的账号数） */
  async removePlatform(platform: string): Promise<number> {
    if (!this.unlocked) throw new Error('未解锁');
    const key = platform || '(无平台)';
    const n = this.accountsOf(key).length;
    const snap = this.snapshot();
    this.pwData = this.pwData.filter((d) => (d.platform || '(无平台)') !== key);
    await this.saveWithRollback(snap);
    return n;
  }

  /** 编辑平台信息：改名/改链接应用到该平台全部账号 */
  async updatePlatform(platform: string, patch: { platform?: string; url?: string }) {
    if (!this.unlocked) throw new Error('未解锁');
    const key = platform || '(无平台)';
    const target = (patch.platform || '').trim() || key;
    const snap = this.snapshot();
    for (const d of this.pwData) {
      if ((d.platform || '(无平台)') === key) {
        d.platform = target;
        if (patch.url !== undefined) d.url = patch.url.trim();
      }
    }
    await this.saveWithRollback(snap);
  }

  async toggleFav(id: string) {
    if (!this.unlocked) throw new Error('未解锁');
    const d = this.pwData.find((x) => x.id === id);
    if (!d) throw new Error('条目不存在');
    const snap = this.snapshot();
    d.fav = !d.fav;
    await this.saveWithRollback(snap);
  }

  async clearAll() {
    if (!this.unlocked) throw new Error('未解锁');
    const snap = this.snapshot();
    this.pwData = [];
    await this.saveWithRollback(snap);
  }

  /** 搜索：平台/账号/备注（与旧密码本同口径） */
  search(keyword: string): PasswordVaultEntry[] {
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

  /** 卸载清理：退订域事件 */
  destroy() {
    this.offChanged?.();
    this.offChanged = null;
    this.offEncryptChanged?.();
    this.offEncryptChanged = null;
  }
}

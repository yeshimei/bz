/**
 * 密码本数据管理器（密码本.js DataManager 逐字移植）
 * 数据文件：<storagePath>/passwords.enc（AES-GCM 加密）
 * 条目 7 字段：id/platform/url/account/password/note/createdAt
 */
import { getApp } from '../core/app';
import { CryptoService } from './crypto';

export interface PasswordEntry {
  id: string;
  platform: string;
  url: string;
  account: string;
  password: string;
  note: string;
  createdAt: string;
}

export class DataManager {
  storagePath: string;
  filePath: string;
  masterPassword: string | null = null;
  unlocked = false;
  pwData: PasswordEntry[] = [];

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.filePath = `${storagePath}/passwords.enc`;
  }

  async load() {
    const app = getApp();
    if (!this.unlocked || !this.masterPassword) {
      throw new Error('未解锁，无法加载数据');
    }
    const file = app.vault.getAbstractFileByPath(this.filePath);
    if (!file) {
      this.pwData = [];
      return;
    }
    const content = await app.vault.read(file as any);
    if (!content.trim()) {
      this.pwData = [];
      return;
    }
    try {
      const decrypted = await CryptoService.decrypt(content.trim(), this.masterPassword);
      this.pwData = JSON.parse(decrypted);
      // 确保每个条目有 id 和基本字段
      this.pwData = this.pwData.map((item: any) => {
        if (!item.id) item.id = `pw-${Date.now()}-${Math.random()}`;
        if (!item.platform) item.platform = '';
        if (!item.url) item.url = '';
        if (!item.account) item.account = '';
        if (!item.password) item.password = '';
        if (!item.note) item.note = '';
        if (!item.createdAt) item.createdAt = new Date().toISOString();
        return item;
      });
    } catch (e) {
      console.error('解密失败', e);
      throw new Error('数据解密失败，密码可能错误');
    }
  }

  async save() {
    const app = getApp();
    if (!this.unlocked || !this.masterPassword) {
      throw new Error('未解锁，无法保存数据');
    }
    const json = JSON.stringify(this.pwData, null, 2);
    const encrypted = await CryptoService.encrypt(json, this.masterPassword);
    // 确保目录存在
    const dirPath = this.storagePath;
    if (dirPath) {
      const dir = app.vault.getAbstractFileByPath(dirPath);
      if (!dir) await app.vault.createFolder(dirPath);
    }
    const file = app.vault.getAbstractFileByPath(this.filePath);
    if (file) {
      await app.vault.modify(file as any, encrypted);
    } else {
      await app.vault.create(this.filePath, encrypted);
    }
  }

  async unlock(password: string): Promise<boolean> {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(this.filePath);
    if (!file) {
      // 首次使用：设置密码并创建空数据
      this.masterPassword = password;
      this.unlocked = true;
      this.pwData = [];
      await this.save();
      return true;
    }
    const content = await app.vault.read(file as any);
    if (!content.trim()) {
      // 文件为空，视为首次
      this.masterPassword = password;
      this.unlocked = true;
      this.pwData = [];
      await this.save();
      return true;
    }
    try {
      await CryptoService.decrypt(content.trim(), password);
      this.masterPassword = password;
      this.unlocked = true;
      await this.load();
      return true;
    } catch (e) {
      return false;
    }
  }

  lock() {
    this.unlocked = false;
    this.masterPassword = null;
    this.pwData = [];
  }

  async addItem(item: Partial<PasswordEntry>) {
    if (!this.unlocked) throw new Error('未解锁');
    (item as any).id = `pw-${Date.now()}-${Math.random()}`;
    (item as any).createdAt = new Date().toISOString();
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

  // 用于自检
  getDataCopy(): PasswordEntry[] {
    return JSON.parse(JSON.stringify(this.pwData));
  }
}

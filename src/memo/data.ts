/**
 * 备忘录数据管理器（备忘录.js DataManager 逐字移植）
 * memo.json 读写（jsonStore）、场景/平台映射构建、条目 CRUD、公开课笔记检索。
 */
import moment from 'moment';
import { jsonStore } from '../core/json-store';
import { getApp } from '../core/app';
import { generateId, extractUrlAndDisplay, DEFAULT_PLATFORM_MAP, getPlatformName as q3GetPlatformName } from '../core/utils';
import type { MemoItem, MemoPosition } from './types';

export interface MemoSettingsLike {
  todoFilePath?: string;
  scenarios?: string;
  platformMapping?: string;
  showFileName?: boolean;
  autoPopupOnStart?: boolean;
  movieFolderPath?: string;
}

/** 默认场景（DEFAULTSCENARIOS） */
export const DEFAULTSCENARIOS = ['剪藏', '工作', '学习', '生活', '代码', '公开课'];

export const DataManager = {
  todoFilePath: '',
  scenarios: [] as string[],
  platformMap: [] as { host: string; name: string }[],
  _store: null as ReturnType<typeof jsonStore> | null,
  movieFolderPath: '我的/影视',

  init(settings: MemoSettingsLike) {
    const folder = (settings.todoFilePath || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
    this.todoFilePath = folder + '/memo.json';
    this._store = jsonStore(this.todoFilePath);
    this.scenarios = this.buildScenarios(settings.scenarios || '');
    this.platformMap = this.buildPlatformMap(settings.platformMapping || '');
    this.movieFolderPath = settings.movieFolderPath || '我的/影视';
  },

  buildScenarios(raw: string): string[] {
    const user = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set([...DEFAULTSCENARIOS, ...user])];
  },

  buildPlatformMap(raw: string): { host: string; name: string }[] {
    const user = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const userMappings: { host: string; name: string }[] = [];
    for (const line of user) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        let host = parts[0].trim();
        try {
          host = new URL(host).hostname;
        } catch (e) { /* 保持原样 */ }
        const name = parts.slice(1).join(' ');
        if (host && name) userMappings.push({ host: host.toLowerCase(), name });
      }
    }
    const map = [...DEFAULT_PLATFORM_MAP];
    const userHosts = new Set(userMappings.map((m) => m.host));
    return [...map.filter((m) => !userHosts.has(m.host)), ...userMappings];
  },

  async read() {
    return this._store!.read();
  },
  async write(data: any) {
    return this._store!.write(data);
  },

  async loadItems(): Promise<MemoItem[]> {
    const raw = await this.read();
    let needWrite = false;
    const items = raw.map((item: any) => {
      if (!item.id) {
        item.id = generateId();
        needWrite = true;
      }
      return {
        id: item.id,
        title: item.title, // 统一使用 title
        scene: item.scene,
        priority: item.priority || 'minor',
        created: item.created,
        completed: item.completed || null,
        due: item.due || null,
        notePath: item.notePath || null,
        notePosition: item.notePosition || null,
        scriptName: item.scriptName || null,
        courseName: item.courseName || null,
        coursePath: item.coursePath || null,
        linkedNote: item.linkedNote || null,
        url: item.url || null,
      };
    });
    if (needWrite) await this.write(raw);
    return items;
  },

  async addItem(item: MemoItem) {
    const data = await this.read();
    data.unshift(item as any);
    await this.write(data);
  },

  async updateItem(id: string, newData: Partial<MemoItem>) {
    const data = await this.read();
    const idx = data.findIndex((d: any) => d.id === id);
    if (idx === -1) throw new Error('条目不存在');
    const old = data[idx];
    // 如果新数据包含 title 但未提供 url，则自动提取
    if ((newData as any).title !== undefined && (newData as any).url === undefined) {
      const { url } = extractUrlAndDisplay((newData as any).title);
      (newData as any).url = url;
    }
    data[idx] = {
      ...old,
      ...newData,
      id: old.id,
      created: old.created,
    };
    await this.write(data);
  },

  async completeItem(id: string) {
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    await this.updateItem(id, { completed: now } as any);
  },

  async deleteItem(id: string) {
    const data = await this.read();
    const idx = data.findIndex((d: any) => d.id === id);
    if (idx !== -1) {
      data.splice(idx, 1);
      await this.write(data);
    }
  },

  /** 公开课笔记（影视目录中含 公开课 标签的文件） */
  async getCourseNotes(): Promise<{ name: string; path: string }[]> {
    const app = getApp();
    const files = app.vault.getFiles();
    const target = this.movieFolderPath;
    const result: { name: string; path: string }[] = [];
    for (const file of files) {
      if (!file.path.startsWith(target) || file.extension !== 'md') continue;
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) continue;
      let hasTag = false;
      if (cache.tags) {
        hasTag = (cache.tags as any[]).some((t) => t.tag === '#公开课' || t.tag === '公开课');
      }
      if (!hasTag && (cache as any).frontmatter?.tags) {
        const tags = (cache as any).frontmatter.tags;
        if (Array.isArray(tags)) hasTag = tags.includes('公开课');
        else if (typeof tags === 'string') hasTag = tags.includes('公开课');
      }
      if (hasTag) result.push({ name: file.basename, path: file.path });
    }
    return result;
  },

  getScenarios(): string[] {
    return this.scenarios;
  },
  getPlatformMap(): { host: string; name: string }[] {
    return this.platformMap;
  },
};

/** getPlatformName（备忘录版：使用 DataManager.getPlatformMap） */
export function getPlatformName(url: string | null): string | null {
  if (!url) return null;
  return q3GetPlatformName(url, DataManager.getPlatformMap() as any);
}

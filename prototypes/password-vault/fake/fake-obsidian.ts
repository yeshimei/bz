/**
 * 密码本行为单源 · 公共假 obsidian（issue 251/ADR-0106；范式自 clipbook 适配）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但密码本 ui.ts / data.ts /
 * encrypt SafeManager 依赖链的真实现只用到以下少数出口，逐一提供浏览器版：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.PWV_ICONS，prototype-icons.js；
 *                                密码本域 markup 用自绘 SVG（render.ts ICONS），本表只喂
 *                                core 组件：item-actions 菜单/抽屉的 lucide 动作图标）
 *   - requestUrl               → 抛错（core/ai·utils 链走错误提示降级，原型不碰网络）
 *   - Setting / MarkdownRenderer / Component → 仅依赖链导入面（原型运行期不构造；
 *                                构建期 IIFE 内联需要导出存在，否则 alias 解析失败）
 *   - App / vault              → localStorage 文件系统（FakeVault）：SafeManager 清单
 *                               （.safe.enc）与密文镜像（contentRef）的读写删全真，只把
 *                               「文件系统」换成 localStorage + adapter 直读面（点前缀
 *                               兼容，与 Obsidian DataAdapter 同形）；跨 iframe storage
 *                               事件桥 = 桌面/移动双 iframe 共享同一演示库
 *   - metadataCache            → trigger no-op（SafeManager 写后触发，原型无缓存层）
 *
 * 与插件侧的差异收敛到这里（本文件随 prototype-behavior.js 产物进 git）。
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.PWV_ICONS） ====================

declare global {
  interface Window {
    PWV_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.PWV_ICONS?.[iconId]) || '';
  if (!d) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // 表里存的是内层 path/circle/polyline 片段——注入 innerHTML（内容为受控图标表）
  svg.innerHTML = d;
  // Obsidian setIcon 会保留容器已有 class；span.bz-ic 场景由调用方控制外观
  container.replaceChildren(svg);
}

export type IconName = string;

/** requestUrl（core/ai·utils 依赖链导入面）：原型无网络，抛错走提示降级 */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== 依赖链导入面桩（构建期需要导出存在） ====================

/** 最小 TFile：path/name/basename/extension/stat——SafeManager 文件面消费 */
export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
  stat: { ctime: number; mtime: number } = { ctime: 0, mtime: 0 };
}

/** Setting 桩：settings-schema/settings-modal 链导入（原型不打开设置弹窗，运行期不构造） */
export class Setting {
  settingEl = document.createElement('div');
  constructor(_container?: unknown) {}
}

/** MarkdownRenderer/Component 桩：encrypt/preview.ts 链导入（原型不预览加密笔记） */
export class MarkdownRenderer {}
export class Component {}

// ==================== App / vault（localStorage 文件系统 + 跨实例 storage 桥） ====================

const LS_PREFIX = 'bz-sim:';
const STAT_KEY = 'bz-sim:__stat__';
type FileStat = { ctime: number; mtime: number };

/** 最小目录节点（getAbstractFileByPath 目录探测消费 children 数组） */
interface TFolderLike {
  path: string;
  name: string;
  children: Array<TFile | TFolderLike>;
}

/**
 * 内存 vault：实现 SafeManager/加密镜像依赖链用到的文件系统面
 * （read/modify/create/delete/建目录/getAbstractFileByPath + adapter 直读面）。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一
 * 演示库；浏览器自动向另一 iframe 广播 storage 事件——安全模式上锁态等进程内状态
 * 不跨实例，双 iframe 各自解锁，与插件双窗口语义一致）。
 */
export class FakeVault {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  private idSeq = 0;

  constructor() {
    // 跨实例写入广播（obsidian-adapter 未挂接：密码本域事件走 SafeManager 同进程广播）
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith(LS_PREFIX) || e.key === STAT_KEY) return;
        const path = e.key.slice(LS_PREFIX.length);
        this.emit(e.newValue == null ? 'delete' : 'modify', { path });
      });
    }
  }

  private raw(path: string): string | null {
    return localStorage.getItem(LS_PREFIX + path);
  }

  private stats(): Record<string, FileStat> {
    try {
      return JSON.parse(localStorage.getItem(STAT_KEY) || '{}') as Record<string, FileStat>;
    } catch {
      return {};
    }
  }

  private saveStats(stats: Record<string, FileStat>): void {
    localStorage.setItem(STAT_KEY, JSON.stringify(stats));
  }

  private makeFile(path: string): TFile | null {
    if (this.raw(path) == null) return null;
    const s = this.stats()[path] || { ctime: 0, mtime: 0 };
    const f = new TFile();
    f.path = path;
    f.name = path.split('/').pop() || path;
    f.basename = f.name.replace(/\.[^.]+$/, '');
    f.extension = f.name.includes('.') ? f.name.split('.').pop()! : '';
    f.stat = { ...s };
    return f;
  }

  getAbstractFileByPath(path: string): TFile | TFolderLike | null {
    const f = this.makeFile(path);
    if (f) return f;
    // 目录合成：任何以 `path + '/'` 为前缀的键都证明该目录存在（createFolder 前的目录探测）
    const prefix = path + '/';
    const children: Array<TFile | TFolderLike> = [];
    const seen = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX) || k === STAT_KEY) continue;
      const p = k.slice(LS_PREFIX.length);
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const seg = rest.split('/')[0];
      if (!seg || seen.has(seg)) continue;
      seen.add(seg);
      if (rest.includes('/')) {
        children.push({ path: prefix + seg, name: seg, children: [] });
      } else {
        children.push(this.makeFile(p)!);
      }
    }
    if (!children.length) return null;
    return { path, name: path.split('/').pop() || path, children };
  }

  async read(f: TFile): Promise<string> {
    const raw = this.raw(f.path);
    if (raw == null) throw new Error('文件不存在：' + f.path);
    return raw;
  }

  async modify(f: TFile, content: string): Promise<void> {
    localStorage.setItem(LS_PREFIX + f.path, content);
    const stats = this.stats();
    const cur = stats[f.path] || { ctime: Date.now(), mtime: Date.now() };
    stats[f.path] = { ctime: cur.ctime, mtime: Date.now() };
    this.saveStats(stats);
    this.emit('modify', { path: f.path });
  }

  async create(path: string, content: string): Promise<TFile> {
    if (this.raw(path) != null) throw new Error('文件已存在：' + path);
    localStorage.setItem(LS_PREFIX + path, content);
    const stats = this.stats();
    stats[path] = { ctime: Date.now(), mtime: Date.now() };
    this.saveStats(stats);
    const f = this.makeFile(path)!;
    this.emit('create', f);
    return f;
  }

  async createFolder(_path: string): Promise<void> {
    // localStorage 无目录概念——SafeManager 建加密根目录时调用，no-op
    return undefined as never;
  }

  /** vault.delete（SafeManager 清理密文镜像面） */
  async delete(f: TFile | { path: string }, _force?: boolean): Promise<void> {
    localStorage.removeItem(LS_PREFIX + f.path);
    const stats = this.stats();
    delete stats[f.path];
    this.saveStats(stats);
    this.emit('delete', { path: f.path });
  }

  /** 回收站别名（同 delete：原型的回收站即消失） */
  async trash(f: TFile, _system?: boolean): Promise<void> {
    return this.delete(f);
  }

  async readBinary(path: TFile | string): Promise<ArrayBuffer> {
    const p = typeof path === 'string' ? path : path.path;
    const raw = this.raw(p);
    if (raw == null) throw new Error('文件不存在：' + p);
    // 文本存储的伪二进制（原型密码库无附件面，仅依赖链兜底）
    const buf = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i) & 0xff;
    return buf;
  }

  async createBinary(path: string, data: ArrayBuffer): Promise<TFile> {
    let s = '';
    const view = new Uint8Array(data);
    for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i]);
    return this.create(path, s);
  }

  /** 事件订阅（core 依赖链的 vault.on/offref 同形） */
  on(evt: string, cb: (...args: unknown[]) => void): { ref: number } {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(cb);
    const id = ++this.idSeq;
    return { ref: id };
  }

  offref(_ref: unknown): void {
    // 简化：全量退订（原型单会话无并发退订场景）
    this.listeners.clear();
  }

  private emit(evt: string, ...args: unknown[]): void {
    for (const cb of this.listeners.get(evt) ?? []) cb(...args);
  }

  /**
   * 点前缀兼容适配器（Obsidian DataAdapter 同形）：SafeManager 清单/密文镜像一律走
   * adapter 直读直写（无视点前缀隐藏）——localStorage 即「磁盘」，同 FakeVault 后端。
   */
  adapter = {
    read: async (path: string): Promise<string> => {
      const v = this.raw(path);
      if (v == null) throw new Error('file not found: ' + path);
      return v;
    },
    write: async (path: string, content: string): Promise<void> => {
      localStorage.setItem(LS_PREFIX + path, content);
      const stats = this.stats();
      const cur = stats[path] || { ctime: Date.now(), mtime: Date.now() };
      stats[path] = { ctime: cur.ctime, mtime: Date.now() };
      this.saveStats(stats);
    },
    exists: async (path: string): Promise<boolean> => this.raw(path) != null,
    remove: async (path: string): Promise<void> => {
      localStorage.removeItem(LS_PREFIX + path);
      const stats = this.stats();
      delete stats[path];
      this.saveStats(stats);
    },
    // 递归建目录（SafeManager ensureDir 面板；localStorage 无目录概念，no-op）
    mkdir: async (_path: string): Promise<void> => {},
    // 原子改名/晋升（SafeManager staged 三段式写：staged → 正式名；清单三段式同用）。
    // **源不存在 = 静默 no-op**，与真实现同判据（tests/mock-vault.ts 的 adapter.rename
    // 同样只在命中时才搬）。此处曾直接 throw，导致 SafeManager.saveManifest 的 S2
    // 「旧清单挪为 .bak」在**首设**（正本尚不存在）时抛错 → firstTimeSetup 回滚解锁态
    // → 表现为「输了新主密码却仍停在设置主密码」（2026-09-12 保险库壳现场建库时踩到）。
    rename: async (from: string, to: string): Promise<void> => {
      const v = this.raw(from);
      if (v == null) return;
      localStorage.setItem(LS_PREFIX + to, v);
      localStorage.removeItem(LS_PREFIX + from);
      const stats = this.stats();
      if (stats[from]) {
        stats[to] = stats[from];
        delete stats[from];
        this.saveStats(stats);
      }
    },
    // 平铺列举（SafeManager 体检/清理面）：返回 { files, folders } 与 Obsidian DataAdapter 同形
    list: async (path: string): Promise<{ files: string[]; folders: string[] }> => {
      const prefix = !path || path === '/' ? '' : path.endsWith('/') ? path : path + '/';
      const files: string[] = [];
      const folders = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(LS_PREFIX) || k === STAT_KEY) continue;
        const p = k.slice(LS_PREFIX.length);
        if (!p.startsWith(prefix)) continue;
        const rest = p.slice(prefix.length);
        if (rest.includes('/')) folders.add(prefix + rest.split('/')[0]);
        else files.push(p);
      }
      return { files, folders: [...folders] };
    },
  };
}

/** 评审壳种子直写（fake-sim 启动时用；不经事件——种子完成前行为层尚未挂订阅） */
export function seedVaultFile(path: string, content: string, ctime?: number): void {
  localStorage.setItem(LS_PREFIX + path, content);
  if (ctime == null) return;
  let stats: Record<string, FileStat> = {};
  try {
    stats = JSON.parse(localStorage.getItem(STAT_KEY) || '{}') as Record<string, FileStat>;
  } catch {
    stats = {};
  }
  stats[path] = { ctime, mtime: ctime };
  localStorage.setItem(STAT_KEY, JSON.stringify(stats));
}

/** 评审壳 App（密码本依赖链消费面：vault + metadataCache.trigger） */
export class FakeApp {
  vault = new FakeVault();
  metadataCache = {
    /** SafeManager 写后 trigger('changed')：原型无缓存层，no-op */
    trigger(): void {
      /* no-op */
    },
  };
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
// （fake-sim.ts import '../core/app' 的 setApp 注入 FakeApp；SafeManager 经
// getApp() 取到同一实例，单源不裂）。

export type App = FakeApp;

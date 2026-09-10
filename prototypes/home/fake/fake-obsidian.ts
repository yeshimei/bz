/**
 * 内容首页行为单源 · 公共假 obsidian（issue 245/ADR-0106）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 fake-sim.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但 home 的真实现（ui.ts 及
 * 其只读聚合依赖链 recap/review/cinema/bookshelf/belongings/favorites/diary）只
 * 用到以下少数出口，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.BZ_HOME_ICONS，prototype-icons.js）
 *   - moment                   → re-export npm moment（diary/parser 模块级
 *                                `import { moment } from 'obsidian'`——home 聚合链独有，
 *                                belongings 版无此出口；npm moment 已被 belongings/data
 *                                依赖，行为包内本就存在）
 *   - TFile                    → 空类占位（bookshelf/data 的 `instanceof TFile` 值引用；
 *                                EPUB vault 文件非 TFile → file=null，recap 侧可选链安全）
 *   - requestUrl               → 抛错降级（core/utils 模块级 import 触及；本链无网络路径）
 *   - App / vault / metadataCache → localStorage 文件系统 + frontmatter 解析缓存。
 *                                home 是只读聚合域，vault 面比 belongings 版宽：
 *                                getMarkdownFiles / file.stat(ctime,mtime) /
 *                                adapter.read（weave-data.json 直读）——recap 七天窗口、
 *                                影院与书库扫描、EPUB 聚合的真实现都吃这些接口。
 *
 * 与 belongings/fake/fake-obsidian.ts 同构的部分（FakeVault localStorage 后端 +
 * storage 事件桥 = 跨 iframe「文件 modify 自动刷新」）保留同款语义。
 * 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
 * （fake-sim.ts import '../core/app' 的 setApp 注入 FakeApp；core/storage 的
 * jsonFileStore 经 core/app getApp() 取到同一实例，单源不裂）。
 */
import moment from 'moment';

export { moment };

// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.BZ_HOME_ICONS） ====================

declare global {
  interface Window {
    BZ_HOME_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.BZ_HOME_ICONS?.[iconId]) || '';
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

/** TFile 值占位：bookshelf/data `vaultFile instanceof TFile`——FakeFile 非 TFile → file=null */
export class TFile {}

/** requestUrl（core/utils 模块级 import 触及）：原型无网络，抛错让调用方走各自降级 */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== 依赖闭包壳类（仅满足 import 可解析，不参与运行路径） ====================
/**
 * home 的真依赖闭包比 belongings 宽：river 静态依赖 review/app，review/app 内部
 * 动态 import review/ui / settings-panel / quiz-core（IIFE 产物会把动态 import 整体
 * 内联），把 settings-panel/memo/diary/diary-wall/smartcat/clipbook/secondbrain/
 * literature/encrypt/pomodoro 的 UI 模块一并拉进产物（esbuild metafile 实测 218 模块）。
 * 这些模块在首页评审里永不执行（首页只采集只读快照），其 obsidian 值导入只需
 * 「可解析 + 模块顶层求值不崩」——宽松壳类即可，不提供真实行为；运行期触达
 * （new/继承/链式）时也只会落到 no-op，不会误导评审。
 */
export class Setting {
  constructor(_app?: unknown, _opts?: unknown) {}
  setName(): this { return this; }
  setDesc(): this { return this; }
  setClass(): this { return this; }
  setTooltip(): this { return this; }
  addText(): this { return this; }
  addTextArea(): this { return this; }
  addToggle(): this { return this; }
  addDropdown(): this { return this; }
  addButton(): this { return this; }
  addExtraButton(): this { return this; }
  addSlider(): this { return this; }
  addSearch(): this { return this; }
  addColorPicker(): this { return this; }
  addMomentFormat(): this { return this; }
  then(cb?: (s: unknown) => unknown): this { if (cb) cb(this); return this; }
}

/** MarkdownRenderer / MarkdownView / Component 壳：diary/encrypt/secondbrain 等 UI 模块的值导入 */
export class MarkdownRenderer {
  static render(): Promise<void> { return Promise.resolve(); }
  static renderMarkdown(): Promise<string> { return Promise.resolve(''); }
}

export class MarkdownView {}

export class Component {
  load(): void {}
  unload(): void {}
  onload(): void {}
  onunload(): void {}
  addChild<T>(): T | null { return null; }
  removeChild(): void {}
  registerEvent(): void {}
  register(): void {}
  registerDomEvent(): void {}
  registerInterval(): number { return 0; }
}

/** 其余常见 obsidian 值导入的空壳（防闭包内 class extends / new 顶层求值崩） */
export class Notice {
  constructor(_msg?: string, _duration?: number) {}
  hide(): void {}
  setMessage(): this { return this; }
}
export class Modal {
  app?: unknown;
  constructor(_app?: unknown) {}
  open(): void {}
  close(): void {}
}
export class TFolder {}
export class TAbstractFile {}
export class Plugin {
  constructor(_app?: unknown, _manifest?: unknown) {}
  addRibbonIcon(): unknown { return null; }
  addSettingTab(): void {}
  registerEvent(): void {}
  register(): void {}
  registerDomEvent(): void {}
  registerInterval(): number { return 0; }
}
export class PluginSettingTab {
  constructor(_app?: unknown, _plugin?: unknown) {}
  display(): void {}
  hide(): void {}
}
export class FuzzySuggestModal {
  constructor(_app?: unknown) {}
  open(): void {}
  getItems(): unknown[] { return []; }
}
export class AbstractInputSuggest {
  constructor(_app?: unknown, _input?: unknown) {}
  open(): void {}
  close(): void {}
}
export class Scope {}
export function normalizePath(p: string): string { return p.replace(/([\\/])+/g, '/'); }
export function addIcon(_id?: string, _svg?: string): void {}

// ==================== App / vault / metadataCache（localStorage 文件系统） ====================

export interface FakeStat {
  ctime: number;
  mtime: number;
}

/** 文件对象：recap/cinema/bookshelf 真实现消费的 TFile 读取面（path/basename/stat） */
export interface FakeFile {
  path: string;
  basename: string;
  extension: string;
  name: string;
  stat: FakeStat;
  /** 内容内藏（FakeVault.read 吐出；不入 TFile 公开契约） */
  content: string;
}

/** localStorage 值封套：内容与 stat 同存（read 只吐 content） */
interface Envelope {
  c: string;
  ct: number;
  mt: number;
}

const KEY_PREFIX = 'bz-sim:';

/** 种子写入辅助（fake-sim 用；与 FakeVault 读回格式同一封套） */
export function encodeSeedFile(content: string, stat?: { ctime?: number; mtime?: number }): string {
  const now = Date.now();
  const env: Envelope = { c: content, ct: stat?.ctime ?? now, mt: stat?.mtime ?? stat?.ctime ?? now };
  return JSON.stringify(env);
}

/** frontmatter 极简解析（种子笔记专用）：`key: value` / `key:` + `- item` 列表 / `key: [a, b]` */
export function parseFrontmatter(content: string): Record<string, unknown> | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return null;
  const strip = (s: string): string => {
    const t = s.trim();
    if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
      return t.slice(1, -1);
    }
    return t;
  };
  const fm: Record<string, unknown> = {};
  let lastKey: string | null = null;
  for (const line of content.slice(3, end).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const listItem = /^\s*-\s*(.+)$/.exec(line);
    if (listItem && lastKey) {
      const arr = Array.isArray(fm[lastKey]) ? (fm[lastKey] as unknown[]) : [];
      arr.push(strip(listItem[1]));
      fm[lastKey] = arr;
      continue;
    }
    const kv = /^([^\s:][^:]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].trim();
    const rawVal = kv[2].trim();
    lastKey = key;
    if (rawVal === '') {
      fm[key] = []; // 待填充列表（种子未用空标量键）
    } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      fm[key] = rawVal
        .slice(1, -1)
        .split(',')
        .map((s) => strip(s))
        .filter(Boolean);
    } else {
      fm[key] = strip(rawVal);
    }
  }
  return fm;
}

/**
 * 内存 vault：实现 home 聚合链用到的 vault 读取面（探测/读/列文件/写/建目录/adapter）。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * 浏览器自动向另一 iframe 广播 storage 事件 → 本类转发为自己的 modify 监听，
 * 供「数据文件外部变更自动刷新」语义使用——home 打开时采集，靠的是这条桥的语义完整性）。
 */
export class FakeVault {
  static key(path: string): string {
    return KEY_PREFIX + path;
  }

  private listeners = new Map<string, Array<(file: unknown) => void>>();
  private idSeq = 0;

  constructor() {
    // 跨实例写入：浏览器只向「非写者」文档派发 storage 事件——收到即视为外部 modify
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith(KEY_PREFIX)) return;
        this.emit('modify', { path: e.key.slice(KEY_PREFIX.length) });
      });
    }
  }

  /** 原始值 → FakeFile（封套外敌数据按纯内容兜底，stat 取当前——防御性，种子外不发生） */
  private toFile(path: string, raw: string): FakeFile {
    let content = raw;
    let ct = Date.now();
    let mt = ct;
    try {
      const env = JSON.parse(raw) as Envelope | null;
      if (env && typeof env === 'object' && typeof env.c === 'string') {
        content = env.c;
        ct = Number(env.ct) || ct;
        mt = Number(env.mt) || mt;
      }
    } catch {
      /* 纯文本内容原样 */
    }
    const base = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
    const dot = base.lastIndexOf('.');
    return {
      path,
      // Obsidian TFile 契约：basename 不含扩展名，name 含
      basename: dot > 0 ? base.slice(0, dot) : base,
      extension: dot > 0 ? base.slice(dot + 1) : '',
      name: base,
      stat: { ctime: ct, mtime: mt },
      content,
    };
  }

  getAbstractFileByPath(path: string): FakeFile | null {
    const raw = localStorage.getItem(FakeVault.key(path));
    return raw == null ? null : this.toFile(path, raw);
  }

  /** 全部 md 文件（recap 影院/日记扫描、书库回落扫描、diary 计数吃这个列表） */
  getMarkdownFiles(): FakeFile[] {
    const out: FakeFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      if (!k.endsWith('.md')) continue;
      const path = k.slice(KEY_PREFIX.length);
      out.push(this.toFile(path, localStorage.getItem(k) as string));
    }
    return out;
  }

  async read(f: FakeFile): Promise<string> {
    return f.content;
  }

  async modify(f: FakeFile, content: string): Promise<void> {
    // stat 保持种子值不刷新：评审期反复打开面板，活动河时间口径稳定
    f.content = content;
    localStorage.setItem(FakeVault.key(f.path), encodeSeedFile(content, f.stat));
  }

  async create(path: string, content: string): Promise<FakeFile> {
    const f = this.toFile(path, encodeSeedFile(content));
    localStorage.setItem(FakeVault.key(path), encodeSeedFile(content));
    return f;
  }

  async createFolder(_path: string): Promise<void> {
    // localStorage 无目录概念；storage.json 的 ensureDir 调用此方法——no-op
    return undefined as never;
  }

  /** adapter（bookshelf readWeaveAggregates 走 vault.adapter.read 直读 weave-data.json） */
  adapter = {
    read: async (path: string): Promise<string> => {
      const raw = localStorage.getItem(FakeVault.key(path));
      if (raw == null) throw new Error('fake vault: 文件不存在 ' + path);
      return this.toFile(path, raw).content;
    },
  };

  /** 事件订阅（core/app vault.on/offref 同形） */
  on(evt: string, cb: (file: unknown) => void): { ref: unknown } {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(cb);
    const id = ++this.idSeq;
    return { ref: id };
  }

  offref(ref: unknown): void {
    // 简化：全量退订（原型单会话无并发订阅场景）
    this.listeners.clear();
    void ref;
  }

  private emit(evt: string, file: unknown): void {
    for (const cb of this.listeners.get(evt) ?? []) cb(file);
  }
}

/**
 * metadataCache：home 聚合链只用 getFileCache(file).frontmatter
 * （cinema parseMovieFile / bookshelf parseBookFile / diary getFileFrontmatter）。
 * 从 FakeFile 内容现解析 + 按路径 memo（种子笔记内容评审期不可变）。
 */
export class FakeMetadataCache {
  private cache = new Map<string, Record<string, unknown> | null>();

  getFileCache(file: { path: string; content?: string }): { frontmatter?: Record<string, unknown> } | null {
    if (!file || typeof file.path !== 'string') return null;
    if (!this.cache.has(file.path)) {
      const raw = typeof file.content === 'string' ? file.content : '';
      // content 不在调用方给的引用上时（消费方只传 TFile 形状）回退 vault 现读
      const fm = parseFrontmatter(raw || this.readThrough(file.path));
      this.cache.set(file.path, fm);
    }
    const fm = this.cache.get(file.path);
    return fm ? { frontmatter: fm } : null;
  }

  private readThrough(path: string): string {
    try {
      const raw = localStorage.getItem(FakeVault.key(path));
      if (raw == null) return '';
      const env = JSON.parse(raw) as Envelope | null;
      return env && typeof env === 'object' && typeof env.c === 'string' ? env.c : raw;
    } catch {
      return '';
    }
  }
}

/** 评审壳 App：vault + metadataCache（home 聚合链的完整读取面） */
export class FakeApp {
  vault = new FakeVault();
  metadataCache = new FakeMetadataCache();
}

export type App = FakeApp;

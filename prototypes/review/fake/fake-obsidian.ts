/**
 * 复习计划行为单源 · 公共假 obsidian（issue 253/ADR-0106；范式自 clipbook 适配）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但复习域真实现只用到以下出口：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳移动 iframe 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.RVW_ICONS，prototype-icons.js）
 *   - TFile                    → loadItems 的 basename/存在性面（FakeVault 返回本类实例）
 *   - Setting                  → 仅 ⚙ 直达动态 import('../settings-panel') 依赖链导入
 *                               （原型不打开设置面板，运行期不构造；构建期 IIFE 内联需要导出存在）
 *   - requestUrl               → 「出题 AI」canned 响应：从 prompt 识别出题请求，回种子题库
 *                               （window.RVW.SEED.quizBank），让真 ensureQuestions→generateBatch
 *                               链原样跑通；非出题请求一律抛错走降级（原型不碰真网络）
 *   - App / vault              → localStorage 文件系统（review.json/quiz.json + 文献盒/*.md
 *                               ——读改写/建目录/目录枚举全真，只把「文件系统」换成 localStorage；
 *                               目录键做子树合成）；同源 storage 事件桥 = 跨 iframe「文件
 *                               modify 自动刷新」语义
 *   - workspace / metadataCache → 原型 no-op 面（打开笔记不跳出；事件订阅接收但不触发）
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.RVW_ICONS） ====================

declare global {
  interface Window {
    RVW_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.RVW_ICONS?.[iconId]) || '';
  if (!d) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = d;
  container.replaceChildren(svg);
}

export type IconName = string;

// ==================== TFile / Setting / 闭包壳类（类型与导入链面） ====================

import moment from 'moment';

export { moment };

/** 最小 TFile：path/name/basename/extension/stat——loadItems 消费面 */
export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
  stat: { ctime: number; mtime: number } = { ctime: 0, mtime: 0 };
}

/**
 * Setting 桩：仅 ⚙ 直达动态 import('../settings-panel') 依赖链导入（settings-schema
 * 模块级 schema 数据需要该导出可解析；原型 sim 不打开设置面板，运行期不构造）。
 */
export class Setting {
  settingEl = document.createElement('div');
  constructor(_container?: unknown) {}
}

/** 以下为 ⚙ 直达 settings-panel 闭包（内联 diary/encrypt 等域 schema 链）的壳类：
 *  仅满足模块顶层求值/import 可解析，评审路径不执行（同 settings-panel 域假层）。 */
export class MarkdownRenderer {
  static render(): Promise<void> {
    return Promise.resolve();
  }
  static renderMarkdown(): Promise<string> {
    return Promise.resolve('');
  }
}
export class MarkdownView {}
export class Component {
  load(): void {}
  unload(): void {}
  onload(): void {}
  onunload(): void {}
  addChild<T>(): T | null {
    return null;
  }
  removeChild(): void {}
  registerEvent(): void {}
  register(): void {}
  registerDomEvent(): void {}
  registerInterval(): number {
    return 0;
  }
}
export class Notice {
  constructor(_msg?: string, _duration?: number) {}
  hide(): void {}
  setMessage(): this {
    return this;
  }
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
  addRibbonIcon(): unknown {
    return null;
  }
  addSettingTab(): void {}
  registerEvent(): void {}
  register(): void {}
  registerDomEvent(): void {}
  registerInterval(): number {
    return 0;
  }
}
export class PluginSettingTab {
  constructor(_app?: unknown, _plugin?: unknown) {}
  display(): void {}
  hide(): void {}
}
export class FuzzySuggestModal {
  constructor(_app?: unknown) {}
  open(): void {}
  getItems(): unknown[] {
    return [];
  }
}
export class AbstractInputSuggest {
  constructor(_app?: unknown, _input?: unknown) {}
  open(): void {}
  close(): void {}
}
export class Scope {}
export function normalizePath(p: string): string {
  return p.replace(/([\\/])+/g, '/');
}
export function addIcon(_id?: string, _svg?: string): void {}

// ==================== requestUrl（出题 AI canned 响应） ====================

/** 出题请求特征（generator.buildPrompt/buildBatchPrompt 的固定开头） */
const QUIZ_SINGLE_MARKER = '根据以下笔记内容，生成若干道四选一的选择题';
const QUIZ_BATCH_MARKER = '根据以下多篇笔记内容，为每篇笔记生成选择题';

type SeedLike = {
  /** 题库：notePath → 题目数组（与 quiz.json 同构） */
  quizBank?: Record<string, Array<{ question: string; options: string[]; correctIndices: number[]; explain?: string }>>;
  /** 笔记全文：notePath → content（单篇出题时按内容反查笔记） */
  notes?: Record<string, string>;
};

function simSeed(): SeedLike {
  const self = (typeof window !== 'undefined' ? (window as unknown as { RVW?: SeedLike }).RVW : null) || null;
  const parent = typeof window !== 'undefined' ? ((window.parent as unknown as { RVW?: SeedLike })?.RVW ?? null) : null;
  return self || parent || {};
}

/** 从 prompt 提取批量出题的笔记 ID（`===== 笔记ID:path =====` 行） */
function extractBatchIds(prompt: string): string[] {
  const ids: string[] = [];
  const re = /=====\s*笔记ID:(.+?)\s*=====/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt))) ids.push(m[1].trim());
  return ids;
}

/** 单篇出题：按「种子笔记全文 ⊆ prompt」反查笔记路径 */
function matchSingleNote(prompt: string): string | null {
  const notes = simSeed().notes || {};
  for (const [path, content] of Object.entries(notes)) {
    if (content && prompt.includes(content)) return path;
  }
  return null;
}

/**
 * requestUrl 假层：仅「出题」请求回 canned 成功响应（OpenAI chat 格式，text 供
 * chatCompletionsNonStream JSON.parse），其余一律抛错走降级——原型不碰真网络。
 * fetch 流式先失败（设置端点指向本地死端口）→ 自动 fallback 到本层，与插件语义一致。
 */
export async function requestUrl(opts: { url?: string; body?: string }): Promise<{ status: number; text: string }> {
  const seed = simSeed();
  let prompt = '';
  try {
    const body = JSON.parse(opts?.body || '{}') as { messages?: Array<{ content?: string }> };
    prompt = (body.messages || []).map((m) => m.content || '').join('\n');
  } catch {
    /* 非 JSON body → 按非出题处理 */
  }
  const bank = seed.quizBank || {};
  const respond = (content: string) => ({
    status: 200,
    text: JSON.stringify({ choices: [{ message: { content } }] }),
  });

  if (prompt.includes(QUIZ_BATCH_MARKER)) {
    const out: Record<string, unknown> = {};
    for (const id of extractBatchIds(prompt)) {
      const qs = bank[id];
      if (qs?.length) out[id] = qs;
    }
    return respond(JSON.stringify(out));
  }
  if (prompt.includes(QUIZ_SINGLE_MARKER)) {
    const path = matchSingleNote(prompt);
    const qs = path ? bank[path] : null;
    if (qs?.length) return respond(JSON.stringify({ questions: qs }));
  }
  throw new Error('原型环境无网络请求（fake obsidian requestUrl；仅出题请求有 canned 响应）');
}

// ==================== App / vault（localStorage 文件系统 + 跨实例 storage 桥） ====================

const LS_PREFIX = 'bz-sim:';
const STAT_KEY = 'bz-sim:__stat__';
type FileStat = { ctime: number; mtime: number };

/** 最小目录节点（目录探测/枚举消费 children 数组） */
interface TFolderLike {
  path: string;
  name: string;
  children: Array<TFile | TFolderLike>;
}

/**
 * 内存 vault：实现复习域依赖链用到的文件系统面（读改写/建目录/目录枚举）。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * 浏览器自动向另一 iframe 广播 storage 事件 → 本类转译为 modify/delete 事件 →
 * ui.ts 的 vault.on('modify') 自动刷新——完整模拟插件「数据文件外部变更自动刷新」语义）。
 */
export class FakeVault {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  private idSeq = 0;

  constructor() {
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
    // 目录合成：任何以 `path + '/'` 为前缀的键都证明该目录存在（watch 文件夹探测等）
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
    // localStorage 无目录概念——jsonFileStore.ensureDir 调用此方法，no-op
    return undefined as never;
  }

  /** 事件订阅（core/app vault.on/offref 同形） */
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

/** 评审壳 App（vault + workspace/metadataCache 的 no-op 面） */
export class FakeApp {
  vault = new FakeVault();
  /** 打开笔记（openItemFile 等 getLeaf().openFile）：原型中不跳出，no-op */
  workspace = {
    getActiveFile(): null {
      return null;
    },
    getLeaf(): { openFile(): Promise<void> } {
      return { openFile: async () => undefined };
    },
    on(_evt: string, _cb: (...args: unknown[]) => void): { ref: number } {
      return { ref: 0 };
    },
  };
  /** ensureReview 监听 metadataCache 'resolved'：原型不触发（样式染色随用随算） */
  metadataCache = {
    on(_evt: string, _cb: (...args: unknown[]) => void): { ref: number } {
      return { ref: 0 };
    },
    offref(_ref: unknown): void {},
  };
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
// （fake-sim.ts import '../core/app' 的 setApp 注入 FakeApp；core/storage 的
// jsonFileStore 经 core/app getApp() 取到同一实例，单源不裂）。

export type App = FakeApp;

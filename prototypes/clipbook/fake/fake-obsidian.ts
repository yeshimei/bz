/**
 * 剪藏本行为单源 · 公共假 obsidian（issue 247/ADR-0106；范式自 cinema/favorites 适配）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但剪藏本 ui.ts / core 的
 * 真实现只用到以下少数出口，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.CLIP_ICONS，prototype-icons.js）
 *   - TFile                    → news-data/save 的 instanceof/类型面（FakeVault 返回本类实例）
 *   - Setting                  → 仅 settings-modal 依赖链导入（原型不打开设置弹窗，运行期不构造）
 *   - requestUrl               → 抛错（core/ai → auto-summary 链走错误提示降级，原型不碰真 AI）
 *   - App / vault              → localStorage 文件系统（news.json/clipbook.json + 归档/网页剪藏/*.md
 *                               ——读改写/建目录/回收站/缓存读全真，只把「文件系统」换成 localStorage；
 *                               getAbstractFileByPath 对目录键做子树合成，剪藏目录扫描可直接跑）；
 *                               同源 storage 事件桥 = 跨 iframe「文件 modify 自动刷新」
 *   - metadataCache            → getFileCache 现场解析 frontmatter（scan.ts 唯一消费面）
 *   - workspace.openLinkText / openUrl → no-op（打开笔记/外链在原型中不跳出）
 *
 * 与插件侧的差异收敛到这里（本文件随 prototype-behavior.js 产物进 git）：
 *   - frontmatter 解析是最小 YAML 面（键: 值 顶格列表项/内联数组），覆盖剪藏笔记
 *     frontmatter 契约（url/author/site/summary/tags/date/created）与种子格式——不是完整 YAML；
 *   - 文件 stat：种子 ctime 由调用方给定（列表时序 = 导出序），运行期新建取当下时刻。
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.CLIP_ICONS） ====================

declare global {
  interface Window {
    CLIP_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.CLIP_ICONS?.[iconId]) || '';
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

/** requestUrl（core/ai → auto-summary 的 createAI 链用到）：原型无网络，抛错走提示降级 */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== TFile / Setting（类型与导入链面） ====================

/** 最小 TFile：path/name/basename/extension/stat——news-data/save/scan 消费面 */
export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
  stat: { ctime: number; mtime: number } = { ctime: 0, mtime: 0 };
}

/**
 * Setting 桩：仅 core/settings-modal → settings-schema 依赖链导入（clipbook 域设置
 * 走设置面板/命令入口，原型 sim 永不调用 openSettings，运行期不构造）。
 * 构建期需要导出存在，否则 esbuild alias 解析失败。
 */
export class Setting {
  settingEl = document.createElement('div');
  constructor(_container?: unknown) {}
}

/**
 * MarkdownView / MarkdownRenderer 桩：仅 flow.ts「B站保存 → 知识盒」动态 import('../knowledge')
 * 链需要（knowledge 更名前为 ../literature）。原型 sim 不保存 B站条目（运行期不构造）；
 * 构建期 IIFE 内联动态导入，导出必须存在。knowledge/ui 以 typeof MR.render 守卫调用，
 * 缺实现走纯文本回退。
 */
export class MarkdownView {
  file: TFile | null = null;
  getViewData(): string {
    return '';
  }
}
export class MarkdownRenderer {}

// ==================== frontmatter 最小解析 ====================

/** 去引号（种子均写裸值；容忍成对引号） */
function stripQuotes(v: string): string {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/** 最小 YAML：`key: 值` 顶格 + `- 值` 列表项 + 内联 `[a, b]`；值一律保字符串（消费方自转型） */
function parseYaml(text: string): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  let lastKey: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^\s*-\s+/.test(line)) {
      const v = stripQuotes(line.replace(/^\s*-\s+/, '').trim());
      if (!lastKey) continue;
      const cur = fm[lastKey];
      if (Array.isArray(cur)) cur.push(v);
      else fm[lastKey] = cur === '' || cur === undefined ? [v] : [String(cur), v];
      continue;
    }
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    lastKey = key;
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim();
      fm[key] = inner ? inner.split(',').map((s) => stripQuotes(s.trim())) : [];
    } else {
      fm[key] = stripQuotes(val);
    }
  }
  return fm;
}

/** 拆 frontmatter：有则解析并返回 body；无则整体按 body（frontmatter = null） */
export function splitFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/.exec(content);
  if (!m) return { frontmatter: null, body: content };
  return { frontmatter: parseYaml(m[1]), body: m[2] ?? '' };
}

// ==================== App / vault（localStorage 文件系统 + 跨实例 storage 桥） ====================

const LS_PREFIX = 'bz-sim:';
const STAT_KEY = 'bz-sim:__stat__';
type FileStat = { ctime: number; mtime: number };

/** 最小目录节点（scanClipDirectory 只消费 children 数组与子项 .extension） */
interface TFolderLike {
  path: string;
  name: string;
  children: Array<TFile | TFolderLike>;
}

/**
 * 内存 vault：实现剪藏本依赖链用到的文件系统面（读改写/建目录/回收站/缓存读/目录枚举）。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * 浏览器自动向另一 iframe 广播 storage 事件 → 本类转译为 modify/delete 事件 →
 * core/obsidian-adapter 转发为 clipping:file-* 域事件 → 300ms 防抖自动刷新——完整模拟
 * 插件「剪藏目录外部变更自动刷新」语义）。
 */
export class FakeVault {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  private idSeq = 0;

  constructor() {
    // 跨实例写入：浏览器只向「非写者」文档派发 storage 事件——收到即视为外部变更
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
    // 目录合成：任何以 `path + '/'` 为前缀的键都证明该目录存在（jsonFileStore.ensureDir /
    // scanClipDirectory / writeClipNote 的目录探测全走这一面）；
    // children = 直接子文件 + 子目录保形节点（扫描只消费直接子 .md）
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

  /** 缓存读（ui.ts loadClipBody / deleteClipNote 快照消费面）：localStorage 即「缓存」，同 read */
  async cachedRead(f: TFile): Promise<string> {
    return this.read(f);
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
    // localStorage 无目录概念——jsonFileStore.ensureDir / writeClipNote 调用此方法，no-op
    return undefined as never;
  }

  /** 回收站删除（deleteClipNote 的 vault.trash；system 参数与 Obsidian 同形，原型的回收站即消失） */
  async trash(f: TFile, _system?: boolean): Promise<void> {
    localStorage.removeItem(LS_PREFIX + f.path);
    const stats = this.stats();
    delete stats[f.path];
    this.saveStats(stats);
    this.emit('delete', { path: f.path });
  }

  /** 事件订阅（core/obsidian-adapter 的 vault.on/offref 同形） */
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

/** 评审壳种子数据（fake-sim 启动时写入） */
export class FakeApp {
  vault = new FakeVault();
  /** 打开笔记（openNote）：原型中不跳出，no-op */
  workspace = {
    openLinkText(): void {
      /* 原型 no-op：不跳出笔记 */
    },
  };
  /** 外链（openExternal 消费面）：原型中不弹浏览器，no-op */
  openUrl(): void {
    /* 原型 no-op */
  }
  metadataCache = {
    /** scan.ts defaultCache 唯一消费面：现场解析 frontmatter（文件缺失/无 frontmatter → null） */
    getFileCache(file: TFile): { frontmatter: Record<string, unknown> } | null {
      const content = localStorage.getItem(LS_PREFIX + file.path);
      if (content == null) return null;
      const { frontmatter } = splitFrontmatter(content);
      return frontmatter ? { frontmatter } : null;
    },
  };
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
// （fake-sim.ts import '../core/app' 的 setApp 注入 FakeApp；core/storage 的
// jsonFileStore 经 core/app getApp() 取到同一实例，单源不裂）。

export type App = FakeApp;

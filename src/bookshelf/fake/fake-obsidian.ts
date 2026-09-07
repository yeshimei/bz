/**
 * 书架墙行为单源 · 公共假 obsidian（issue 245/ADR-0106，范式承 belongings 试点）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但 bookshelf / reading-report
 * 的真实现只用到以下少数出口，逐一提供浏览器版即可让真行为代码原样运行。
 *
 * 与插件侧的差异收敛到这里（与 belongings/fake 同思路，本文件是 bookshelf 版）：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.BS_ICONS，prototype-icons.js）
 *   - TFile                    → 真类同名的假 TFile：data.ts/ui.ts 的 instanceof 判定与
 *                                basename/path/name/extension/stat 字段全部成立
 *   - App / vault              → localStorage 文件系统：getAbstractFileByPath/read/modify/
 *                                create/createFolder/getMarkdownFiles/adapter.read/
 *                                getResourcePath/process——书库是「md 笔记 + weave-data.json
 *                                + 封面图」的 vault 域（非 json 域），假 vault 按 TFile 语义供货；
 *                                storage 事件桥 = 跨 iframe「文件 modify 自动刷新」
 *   - App.metadataCache        → getFileCache 即时解析文件首部 frontmatter（我的种子格式）
 *   - App.workspace/plugins    → 空实现降级（深链跳转/Weave 设置读取在原型无意义）
 *   - requestUrl / moment / Setting / MarkdownRenderer 等 → ui.ts 依赖链未触及，不给
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.BS_ICONS） ====================

declare global {
  interface Window {
    BS_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义；
 *  读书报告的 chevron/trophy 不在书库图标表内，同真实端未知图标一样留空不崩） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.BS_ICONS?.[iconId]) || '';
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

/** requestUrl（依赖链上 core/utils→reading-report stats 的 pad2 同文件出口；tree-shake 后通常不达，保险给抛错版） */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== TFile（假同名类：instanceof 与字段面同真） ====================

/** 假 TFile：data.ts（vaultFile instanceof TFile）/ ui.ts coverUrl 的判定对象。
 *  file 字段面 = parseBookFile/primaryDate/notes-ui 实际读取的子集。 */
export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { ctime: number; mtime: number };
  /** 文件内容（假 vault 直挂；read() 经它返回） */
  content: string;

  constructor(path: string, content: string, stat?: { ctime: number; mtime: number }) {
    this.path = path;
    this.content = content;
    const slash = path.lastIndexOf('/');
    const dot = path.lastIndexOf('.');
    this.name = slash >= 0 ? path.slice(slash + 1) : path;
    this.basename = dot > slash + 1 ? this.name.slice(0, dot - slash - 1) : this.name;
    this.extension = dot > slash + 1 ? this.name.slice(dot - slash - 1 + 1).toLowerCase() : '';
    this.stat = stat || { ctime: 0, mtime: 0 };
  }
}

// ==================== App / vault（localStorage 文件系统 + 跨实例 storage 桥） ====================

const VAULT_PREFIX = 'bz-sim:';
const META_PREFIX = 'bz-sim-meta:';

/**
 * localStorage vault：实现 bookshelf/reading-report 依赖链用到的 vault 面。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * 浏览器只向「非写者」文档派发 storage 事件 → 本类转发为 modify 监听 → index.ts 的
 * vault.on('modify') 自动刷新语义照常）。数据域：书库 md / weave-data.json / 封面图。
 */
export class FakeVault {
  private listeners = new Map<string, Array<(file: unknown) => void>>();
  private idSeq = 0;

  constructor() {
    // 跨实例写入：收到 storage 事件即视为外部 modify（index.ts registerAutoRefresh 订阅）
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith(VAULT_PREFIX)) return;
        this.emit('modify', new TFile(e.key.slice(VAULT_PREFIX.length), ''));
      });
    }
  }

  private static key(path: string): string {
    return VAULT_PREFIX + path;
  }

  private statOf(path: string): { ctime: number; mtime: number } {
    try {
      const raw = localStorage.getItem(META_PREFIX + path);
      const c = raw ? (JSON.parse(raw) as { c?: number })?.c : 0;
      if (typeof c === 'number' && c > 0) return { ctime: c, mtime: c };
    } catch { /* 元数据缺失回落 0 */ }
    return { ctime: 0, mtime: 0 };
  }

  /** 写入文件（种子与 modify 共用；ctime 元数据随种落） */
  putFile(path: string, content: string, ctime?: number): void {
    localStorage.setItem(FakeVault.key(path), content);
    if (typeof ctime === 'number' && ctime > 0) {
      localStorage.setItem(META_PREFIX + path, JSON.stringify({ c: ctime }));
    }
  }

  getAbstractFileByPath(path: string): TFile | null {
    const raw = localStorage.getItem(FakeVault.key(path));
    if (raw == null) return null;
    return new TFile(path, raw, this.statOf(path));
  }

  /** 全库 md 文件（getAllBookNotes / scanMarkdownBooks 回落分支用） */
  getMarkdownFiles(): TFile[] {
    const files: TFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(VAULT_PREFIX)) continue;
      const path = key.slice(VAULT_PREFIX.length);
      if (!path.endsWith('.md')) continue;
      files.push(this.getAbstractFileByPath(path)!);
    }
    return files;
  }

  async read(f: TFile): Promise<string> {
    // 每次现取：另一 iframe 可能已改写（本实例缓存的 f.content 会过期）
    return localStorage.getItem(FakeVault.key(f.path)) ?? f.content;
  }

  async modify(f: TFile, content: string): Promise<void> {
    f.content = content;
    this.putFile(f.path, content);
    this.emit('modify', f);
  }

  /** 原子读改写（bookshelf/notes.ts 编辑批注/删划线收口） */
  async process(f: TFile, fn: (content: string) => string): Promise<void> {
    const latest = await this.read(f);
    await this.modify(f, fn(latest));
  }

  async create(path: string, content: string): Promise<TFile> {
    this.putFile(path, content);
    return this.getAbstractFileByPath(path)!;
  }

  async createFolder(_path: string): Promise<void> {
    // localStorage 无目录概念——no-op
    return undefined as never;
  }

  /** 资源 URL：种子把封面图内容存成 data URI，直接回它（借书卡封面可显示） */
  getResourcePath(f: TFile): string {
    return f.content.startsWith('data:') ? f.content : '';
  }

  /** adapter 面（readWeaveAggregates 读 weave-data.json 走这里） */
  adapter = {
    read: async (path: string): Promise<string> => {
      const raw = localStorage.getItem(FakeVault.key(path));
      if (raw == null) throw new Error(`文件不存在：${path}`);
      return raw;
    },
  };

  /** 事件订阅（index.ts registerAutoRefresh 的 vault.on/offref 同形） */
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

// ==================== metadataCache（frontmatter 即时解析） ====================

/** 极简 frontmatter 解析（fake-sim 种子格式同源自洽）：
 *  `key: value` 标量（null/布尔/数字/去引号字符串）+ 空值后随 `  - x` 列表 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown> } | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return null;
  const fm: Record<string, unknown> = {};
  let listKey: string | null = null;
  for (const line of content.slice(3, end).split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      (fm[listKey] as unknown[]).push(parseScalar(item[1].trim()));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    if (kv[2].trim() === '') {
      fm[kv[1]] = [];
      listKey = kv[1];
    } else {
      listKey = null;
      fm[kv[1]] = parseScalar(kv[2].trim());
    }
  }
  return { frontmatter: fm };
}

function parseScalar(v: string): unknown {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

/** 评审壳 App：vault + metadataCache + workspace/plugins 空降级（books 链实际读取面） */
export class FakeApp {
  vault = new FakeVault();
  /** parseBookFile/getAllBookNotes 的 frontmatter 来源：按文件内容即时解析 */
  metadataCache = {
    getFileCache: (file: TFile): { frontmatter: Record<string, unknown> } | null =>
      parseFrontmatter(file.content),
  };
  /** EPUB 笔记双击深链（notes-ui jumpToHighlight/openLinkText）：原型无工作台，no-op 降级 */
  workspace = {
    openLinkText: (): void => undefined,
  };
  /** resolveWeaveDataPath 读 plugins.plugins['weave-epub-reader'].settings——缺省回落 CONFIG/STORAGE */
  plugins: undefined;
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
// （fake-sim.ts import '../core/app' 的 setApp 注入 FakeApp；单源不裂）。

export type App = FakeApp;

/**
 * 第二大脑行为单源 · 公共假 obsidian（issue 251 / ADR-0106 / ADR-0110）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui 行为依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但行为链真实用到的出口
 * 只有以下几个，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile   → 视口 ≤768 判定
 *   - setIcon / IconName  → DOM 内联 SVG（表 = window.SB_ICONS，prototype-icons.js）
 *   - MarkdownRenderer /
 *     Component           → 轻量 markdown 降级渲染（ui-tools.renderMarkdown 原样跑，
 *                            失败回退 textContent 的语义由真实现自持）
 *   - requestUrl          → 原型无 Obsidian 网络：抛错（core/ai 流式 fetch 由
 *                            fake-sim patch window.fetch 拦截，非流式兜底在此被拒）
 *   - Setting             → schema 段为 plain object，浏览器依赖链不触及其渲染
 *
 * secondbrain 与 belongings/cinema 的关键差异：数据不走 vault 笔记正文，走
 * CONFIG/STORAGE/secondbrain.json + secondbrain.vec——因此 FakeVault 需带
 * adapter（stat/read/write/exists/readBinary/writeBinary，core/storage 与
 * vector-store 的存储面），种子由 fake-sim 写 localStorage。
 */

// ==================== 视口判定 ====================

export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.SB_ICONS） ====================

declare global {
  interface Window {
    SB_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.SB_ICONS?.[iconId]) || '';
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

/** requestUrl（core/ai 非流式兜底路径）：原型无 Obsidian 网络，抛错让上层走错误分支 */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无 Obsidian requestUrl（fake obsidian）');
}

// ==================== MarkdownRenderer / Component（ui-tools.renderMarkdown 用） ====================

/** 轻量 markdown：换行成段、**粗体**、`代码`——与插件端 MarkdownRenderer 输出形态对齐的最小实现 */
export const MarkdownRenderer = {
  async render(_app: unknown, md: string, el: HTMLElement): Promise<void> {
    const html = String(md)
      .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    el.innerHTML = html;
  },
};

export class Component {
  onload(): void {}
  unload(): void {}
}

export class Setting {
  constructor(_container: unknown) {}
  setName(): this {
    return this;
  }
  setDesc(): this {
    return this;
  }
  addText(): this {
    return this;
  }
}

// ==================== FakeVault（localStorage 文件系统 + adapter 存储面） ====================

interface FakeFile {
  path: string;
  content: string;
}

export class FakeVault {
  private static key(path: string): string {
    return 'bz-sb-sim:' + path;
  }
  private listeners = new Map<string, Array<(file: unknown) => void>>();

  getAbstractFileByPath(path: string): FakeFile | null {
    const raw = localStorage.getItem(FakeVault.key(path));
    return raw == null ? null : { path, content: raw };
  }

  /** 白名单扫描面（vector-store.refresh 链）：种子库无 md 笔记 → 无变更，refresh 快速完成 */
  getMarkdownFiles(): FakeFile[] {
    const out: FakeFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(FakeVault.key('')) && k.endsWith('.md')) {
        const path = k.slice(FakeVault.key('').length);
        out.push({ path, content: localStorage.getItem(k) || '' });
      }
    }
    return out;
  }

  async read(f: FakeFile): Promise<string> {
    return f.content;
  }

  async modify(f: FakeFile, content: string): Promise<void> {
    f.content = content;
    localStorage.setItem(FakeVault.key(f.path), content);
  }

  async create(path: string, content: string): Promise<FakeFile> {
    localStorage.setItem(FakeVault.key(path), content);
    return { path, content };
  }

  async createFolder(_path: string): Promise<void> {
    return undefined as never;
  }

  /** 存储面（core/storage jsonFileStore / vector-store 二进制 / 主面板存储占用） */
  readonly adapter = {
    exists: async (path: string): Promise<boolean> => localStorage.getItem(FakeVault.key(path)) != null,
    read: async (path: string): Promise<string> => {
      const raw = localStorage.getItem(FakeVault.key(path));
      if (raw == null) throw new Error('file not found: ' + path);
      return raw;
    },
    write: async (path: string, data: string): Promise<void> => {
      localStorage.setItem(FakeVault.key(path), data);
    },
    /** 与 Obsidian adapter.stat 同形：{ size } 或抛错（调用方 try/catch） */
    stat: async (path: string): Promise<{ size: number; type: 'file' }> => {
      const raw = localStorage.getItem(FakeVault.key(path));
      if (raw == null) throw new Error('file not found: ' + path);
      return { size: raw.length, type: 'file' };
    },
    /** 二进制面（vector-store 专用；原型以 base64 存取，行为代码原样跑） */
    readBinary: async (path: string): Promise<ArrayBuffer> => {
      const raw = localStorage.getItem(FakeVault.key(path));
      if (raw == null) throw new Error('file not found: ' + path);
      const bin = atob(raw);
      const buf = new ArrayBuffer(bin.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
      return buf;
    },
    writeBinary: async (path: string, data: ArrayBuffer): Promise<void> => {
      const view = new Uint8Array(data);
      let bin = '';
      for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
      localStorage.setItem(FakeVault.key(path), btoa(bin));
    },
  };

  on(evt: string, cb: (file: unknown) => void): { ref: unknown } {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(cb);
    return { ref: this.listeners.get(evt)!.length };
  }

  offref(_ref: unknown): void {
    /* 原型单会话无并发订阅场景，no-op */
  }

  emit(evt: string, file: unknown): void {
    for (const cb of this.listeners.get(evt) ?? []) cb(file);
  }
}

// ==================== FakeApp（workspace 面向参考面板/打开笔记的最小面） ====================

export class FakeApp {
  vault = new FakeVault();
  /** 参考面板的光标轮询在无编辑器时静默空转（真行为同语义）；演示检索由 fake-sim 的
   *  「换一篇当前笔记」驱动 refreshWithDebounce */
  workspace = {
    activeEditor: null,
    getActiveFile: (): null => null,
    getLeaf: (): { openFile: (f: unknown) => Promise<void> } => ({
      openFile: async () => {
        /* 原型无工作区：打开笔记降级为 no-op（真行为链的 catch 分支自持） */
      },
    }),
    on: (): { ref: number } => ({ ref: 0 }),
    offref(): void {},
  };
}

export type App = FakeApp;

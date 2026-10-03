/**
 * 工具坞行为单源 · 公共假 obsidian（issue 245/ADR-0106 范式，随 favorites 的轻量版适配）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但 dock/ui.ts 与它拖到的 core
 * 只用到以下少数出口，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile   → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管；移动端只读）
 *   - setIcon / IconName  → DOM 内联 SVG（表 = window.DOCK_ICONS，prototype-icons.js）
 *   - requestUrl          → core/http 的壳：原型无网络，抛错降级（dock 自身不用它）
 *   - Setting             → core/path-picker 的路径设置行用；dock 面板里不建这种行，
 *                           但模块级 import 需要这个导出存在，故给一个最小可实例化壳
 *   - App / vault         → 内存文件系统（Map 模拟 getAbstractFileByPath / read /
 *                           modify / create / createFolder）—— core/storage 的
 *                           jsonFileStore 真实现原样跑在它上面，清单缓存的读写路径全真；
 *                           运行记录文件则由「工具」侧（fake-sim）写完放进来，bz 只读
 */

/** ---------- 视口判定 ---------- */

export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
  isDesktop: true,
  isDesktopApp: true,
  isMobileApp: false,
};

/** ---------- 图标 ---------- */

declare global {
  interface Window {
    DOCK_ICONS?: Record<string, string>;
  }
}

export type IconName = string;

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.DOCK_ICONS?.[iconId]) || '';
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

/** ---------- 网络（原型无网） ---------- */

export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

/** 路径归一（core 少数处会用到；原样返回即可） */
export function normalizePath(p: string): string {
  return String(p ?? '').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

/** ---------- Setting（core/path-picker 的模块级 import 需要它存在） ---------- */

/** 最小 Setting 壳：只有 renderPathSettingRow 会实例化它，而 dock 面板不建那种行。
 *  这里保留 setName/setDesc/addButton 等链式方法，避免任何意外调用直接崩。 */
export class Setting {
  settingEl: HTMLElement;
  constructor(container: HTMLElement) {
    this.settingEl = document.createElement('div');
    if (container) container.appendChild(this.settingEl);
  }
  setName(name: string): this {
    this.settingEl.setAttribute('aria-label', name);
    return this;
  }
  setDesc(desc: string): this {
    this.settingEl.setAttribute('title', desc);
    return this;
  }
  setClass(cls: string): this {
    this.settingEl.className = cls;
    return this;
  }
  addButton(cb: (b: unknown) => void): this {
    cb({ setButtonText: () => undefined, onClick: () => undefined, setCta: () => undefined });
    return this;
  }
  addText(cb: (t: unknown) => void): this {
    cb({ setValue: () => undefined, onChange: () => undefined, inputEl: document.createElement('input') });
    return this;
  }
  addToggle(cb: (t: unknown) => void): this {
    cb({ setValue: () => undefined, onChange: () => undefined });
    return this;
  }
}

/** ---------- App / vault ---------- */

interface FakeFile {
  path: string;
  content: string;
}

/**
 * 内存 vault：实现 core/storage.ts jsonFileStore 用到的 5 个方法。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源）。
 */
export class FakeVault {
  private static key(path: string): string {
    return 'bz-sim:' + path;
  }
  private listeners = new Map<string, Array<(file: unknown) => void>>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith('bz-sim:')) return;
        const path = e.key.slice('bz-sim:'.length);
        for (const cb of this.listeners.get('modify') ?? []) cb({ path });
      });
    }
  }

  getAbstractFileByPath(path: string): FakeFile | null {
    const raw = localStorage.getItem(FakeVault.key(path));
    return raw == null ? null : { path, content: raw };
  }

  async read(f: FakeFile): Promise<string> {
    return f.content;
  }

  async modify(f: FakeFile, content: string): Promise<void> {
    f.content = content;
    localStorage.setItem(FakeVault.key(f.path), content);
  }

  async create(path: string, content: string): Promise<FakeFile> {
    const f = { path, content };
    localStorage.setItem(FakeVault.key(path), content);
    return f;
  }

  async createFolder(_path: string): Promise<void> {
    return undefined as never; // localStorage 无目录概念
  }

  on(evt: string, cb: (file: unknown) => void): { ref: unknown } {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(cb);
    return { ref: crypto.randomUUID?.() ?? String(Math.random()) };
  }

  offref(_ref: unknown): void {
    this.listeners.clear();
  }
}

export class FakeApp {
  vault = new FakeVault();
}

export type App = FakeApp;

// 评审壳统一走 core/app 的真 setApp/getApp（fake-sim.ts 注入 FakeApp），此处不另起一套

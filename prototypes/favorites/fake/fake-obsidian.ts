/**
 * 收藏本行为单源 · 公共假 obsidian（issue 245/ADR-0106，范式随 belongings 试点）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但 ui.ts / core 的真实现
 * 只用到以下少数出口，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.FAV_ICONS，prototype-icons.js）
 *   - App / vault              → 内存文件系统（Map 模拟 getAbstractFileByPath/
 *                               read/modify/create/createFolder）——core/storage.ts 的
 *                               jsonFileStore 真实现原样跑在它上面，读写路径全真
 *   - requestUrl               → favorites/ai 的 createAI 链用到：原型无网络，抛错降级
 *   - moment / Setting / MarkdownRenderer 等 → ui.ts 依赖链未触及，不给
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.FAV_ICONS） ====================

declare global {
  interface Window {
    FAV_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.FAV_ICONS?.[iconId]) || '';
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

/** requestUrl（favorites/ai → core/ai 的 createAI 链用到）：原型无网络，抛错让 AI 整理走错误提示降级 */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== App / vault（localStorage 文件系统 + 跨实例 storage 桥） ====================

interface FakeFile {
  path: string;
  content: string;
}

/**
 * 内存 vault：实现 core/storage.ts jsonFileStore 用到的 5 个方法（读改写/建目录/列文件）。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * 浏览器自动向另一 iframe 广播 storage 事件 → 本类转发为自己的 modify 监听——
 * favorites 的自动刷新接线在插件侧 index（域外），ui.ts 链上无 modify 订阅，
 * 此桥对收藏本为纯数据共享通道，不触发 UI 刷新）。
 */
export class FakeVault {
  private static key(path: string): string {
    return 'bz-sim:' + path;
  }
  private listeners = new Map<string, Array<(file: unknown) => void>>();
  private idSeq = 0;

  constructor() {
    // 跨实例写入：浏览器只向「非写者」文档派发 storage 事件——收到即视为外部 modify
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith('bz-sim:')) return;
        const path = e.key.slice('bz-sim:'.length);
        this.emit('modify', { path });
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
    // localStorage 无目录概念；storage.json 的 ensureDir 调用此方法——no-op
    return undefined as never;
  }

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

/** 评审壳种子数据（fake-sim 启动时写入，键与旧壳 localStorage 解耦——数据走内存） */
export class FakeApp {
  vault = new FakeVault();
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
// （fake-sim.ts import '../core/app' 的 setApp 注入 FakeApp；core/storage 的
// jsonFileStore 经 core/app getApp() 取到同一实例，单源不裂）。

export type App = FakeApp;

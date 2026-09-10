/**
 * 日记本行为单源 · 公共假 obsidian（issue 256/ADR-0115，范式随 settings-panel 全量假层）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 fake-sim.ts 依赖链上的
 * `obsidian` 包替换为本文件。日记本链 = 墙 ui.ts + 写链路（store/dialogs/entry-actions/
 * encrypt）+ 域内 config/parser/data ——obsidian 出口（issue 262 后头行「设置」按钮退役，
 * 仅剩的 `import('../settings-panel')` 已随之删除，该域闭包不再进本包，见 PROTOTYPE.md）
 * 覆盖面与 prototypes/settings-panel/fake 同量级，另加墙体所需的四件：
 *   - vault.delete             → 写层「整文件删除」分支（删除条目后该日期清空时调）
 *   - vault.getResourcePath    → 媒体 URL（清单 = window.DIARY.ASSETS，assets/ 实际拷入的
 *                                真实媒体文件；不在清单 → 返回 '' → 墙渐变占位，评审语义成立）
 *   - metadataCache.getFirstLinkpathDest → mediaSrc 的链接解析优先路（清单命中即解析）
 *   - MarkdownRenderer.render  → 纯文本直渲（真 Obsidian 端由宿主管线渲染 markdown；
 *                                评审壳保文字可读，语法不着色）
 * moment re-export npm 包（parser/datetime-picker 模块级 import）；Setting/FuzzySuggestModal
 * 等壳类防 settings-panel 全域 schema 闭包顶层求值崩——与 settings-panel 假层同构，此处不重复注释。
 */
import moment from 'moment';

export { moment };

// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.DIARY_ICONS） ====================

declare global {
  interface Window {
    DIARY_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.DIARY_ICONS?.[iconId]) || '';
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

/** requestUrl（core/utils、core/ai 模块级 import 触及）：原型无网络，抛错走各自降级 */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== markdown 渲染（评审壳纯文本直渲，保文字可读） ====================

/** 墙正文/抽屉的 MarkdownRenderer 消费面：无宿主管线，纯文本直渲（防注入走 textContent） */
export class MarkdownRenderer {
  static async render(_app: unknown, md: string, container: HTMLElement): Promise<void> {
    container.textContent = md;
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

// ==================== 壳类（防全域 schema 闭包顶层求值崩；issue 262 后该闭包已不进包，保留作兜底） ====================

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
export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
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

/** Setting 最小真实现（settings-panel schema custom 行运行期触达；同 settings-panel 假层面） */
export class Setting {
  settingEl: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private descEl: HTMLDivElement;
  private controlEl: HTMLDivElement;
  constructor(container: HTMLElement) {
    this.settingEl = document.createElement('div');
    this.settingEl.className = 'setting-item';
    const info = document.createElement('div');
    info.className = 'setting-item-info';
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'setting-item-name';
    this.descEl = document.createElement('div');
    this.descEl.className = 'setting-item-description';
    this.controlEl = document.createElement('div');
    this.controlEl.className = 'setting-item-control';
    info.append(this.nameEl, this.descEl);
    this.settingEl.append(info, this.controlEl);
    container.appendChild(this.settingEl);
  }
  setName(t: string | DocumentFragment): this {
    this.nameEl.textContent = String(t);
    return this;
  }
  setDesc(t: string | DocumentFragment): this {
    this.descEl.textContent = String(t);
    return this;
  }
  private wrap<T extends HTMLElement>(el: T): T {
    this.controlEl.appendChild(el);
    return el;
  }
  addText(cb: (c: never) => unknown): this {
    const input = this.wrap(document.createElement('input'));
    input.type = 'text';
    input.className = 'setting-text-input';
    const comp = {
      inputEl: input,
      setValue: (v: string) => ((input.value = v), comp),
      getValue: () => input.value,
      setPlaceholder: (p: string) => ((input.placeholder = p), comp),
      onChange: (fn: (v: string) => unknown) => {
        input.addEventListener('change', () => fn(input.value));
        return comp;
      },
    };
    cb(comp as never);
    return this;
  }
  addToggle(cb: (c: never) => unknown): this {
    const input = this.wrap(document.createElement('input'));
    input.type = 'checkbox';
    const comp = {
      toggleEl: input,
      setValue: (v: boolean) => ((input.checked = !!v), comp),
      getValue: () => input.checked,
      onChange: (fn: (v: boolean) => unknown) => {
        input.addEventListener('change', () => fn(input.checked));
        return comp;
      },
    };
    cb(comp as never);
    return this;
  }
  addDropdown(cb: (c: never) => unknown): this {
    const select = this.wrap(document.createElement('select'));
    const comp = {
      selectEl: select,
      addOptions: (opts: Array<{ value: string; label: string }>) => {
        for (const o of opts) {
          const op = document.createElement('option');
          op.value = o.value;
          op.textContent = o.label;
          select.appendChild(op);
        }
        return comp;
      },
      setValue: (v: string) => ((select.value = v), comp),
      onChange: (fn: (v: string) => unknown) => {
        select.addEventListener('change', () => fn(select.value));
        return comp;
      },
    };
    cb(comp as never);
    return this;
  }
  addButton(cb: (c: never) => unknown): this {
    const btn = this.wrap(document.createElement('button'));
    btn.type = 'button';
    const comp = {
      buttonEl: btn,
      setButtonText: (t: string) => ((btn.textContent = t), comp),
      setCta: () => (btn.classList.add('mod-cta'), comp),
      setDisabled: (v: boolean) => ((btn.disabled = v), comp),
      onClick: (fn: () => unknown) => {
        btn.addEventListener('click', () => fn());
        return comp;
      },
    };
    cb(comp as never);
    return this;
  }
  addExtraButton(cb: (c: never) => unknown): this {
    return this.addButton(cb as never);
  }
  addColorPicker(cb: (c: never) => unknown): this {
    const input = this.wrap(document.createElement('input'));
    input.type = 'color';
    const comp = {
      setValue: (v: string) => ((input.value = v), comp),
      onChange: (fn: (v: string) => unknown) => {
        input.addEventListener('change', () => fn(input.value));
        return comp;
      },
    };
    cb(comp as never);
    return this;
  }
  addSearch(cb: (c: never) => unknown): this {
    return this.addText(cb);
  }
  addTextArea(cb: (c: never) => unknown): this {
    const ta = this.wrap(document.createElement('textarea'));
    const comp = {
      inputEl: ta,
      setValue: (v: string) => ((ta.value = v), comp),
      getValue: () => ta.value,
      onChange: (fn: (v: string) => unknown) => {
        ta.addEventListener('change', () => fn(ta.value));
        return comp;
      },
    };
    cb(comp as never);
    return this;
  }
  addSlider(cb: (c: never) => unknown): this {
    const input = this.wrap(document.createElement('input'));
    input.type = 'range';
    const comp = {
      inputEl: input,
      setLimits: (min: number, max: number, step: number) => (
        ((input.min = String(min)), (input.max = String(max)), (input.step = String(step))), comp
      ),
      setValue: (v: number) => ((input.value = String(v)), comp),
      getValue: () => Number(input.value),
      onChange: (fn: (v: number) => unknown) => {
        input.addEventListener('change', () => fn(Number(input.value)));
        return comp;
      },
    };
    cb(comp as never);
    return this;
  }
}

// ==================== App / vault / metadataCache（localStorage 文件系统 + 媒体清单） ====================

export interface FakeStat {
  ctime: number;
  mtime: number;
}

export interface FakeFile {
  path: string;
  basename: string;
  extension: string;
  name: string;
  stat: FakeStat;
  content: string;
}

interface Envelope {
  c: string;
  ct: number;
  mt: number;
}

const KEY_PREFIX = 'bz-sim:';

/** 种子写入辅助（壳父页/fake-sim 共用；与 FakeVault 读回格式同一封套） */
export function encodeSeedFile(content: string, stat?: { ctime?: number; mtime?: number }): string {
  const now = Date.now();
  const env: Envelope = { c: content, ct: stat?.ctime ?? now, mt: stat?.mtime ?? stat?.ctime ?? now };
  return JSON.stringify(env);
}

/** 媒体清单（prototype-data.js 的 window.DIARY.ASSETS；assets/ 实际拷入的文件名集合） */
function assetManifest(): string[] {
  const src = (typeof window !== 'undefined' && window.DIARY) || (window.parent && (window.parent as Window).DIARY) || null;
  return src?.ASSETS || [];
}

/** 真实 vault 媒体名判定：按扩展名识别（与 data.ts 的媒体扩展名同口径的超集） */
const MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|mp4|m4v|webm|mov|ogv|mp3|m4a|aac|wav|flac|ogg|oga)$/i;

/**
 * 按需取流的服务端路由（preview-live.mjs 的 /__vault-media/<文件名>）：
 * 快照引用的媒体全量 1.8G，入库只留子集；其余由预览服务现场从真实 vault 取，
 * 保真且仓库不膨胀。非 http 环境（双击直开 file://）无服务端 → '' 走渐变占位。
 */
function vaultMediaUrl(base: string): string {
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return '';
  if (!MEDIA_EXT_RE.test(base)) return '';
  return '/__vault-media/' + encodeURIComponent(base);
}

declare global {
  interface Window {
    DIARY?: { FILES?: Array<{ path: string; content: string; ctime: number }>; ASSETS?: string[] };
  }
}

export class FakeVault {
  static key(path: string): string {
    return KEY_PREFIX + path;
  }

  private listeners = new Map<string, Array<(file: unknown) => void>>();
  private idSeq = 0;

  constructor() {
    // 跨实例写入：浏览器只向「非写者」文档派发 storage 事件——收到即视为外部 modify
    //（墙 DW3 vault modify 自动刷新在双 iframe 间真实成立）
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith(KEY_PREFIX)) return;
        this.emit('modify', { path: e.key.slice(KEY_PREFIX.length) });
      });
    }
  }

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

  async read(f: FakeFile): Promise<string> {
    return f.content;
  }

  async modify(f: FakeFile, content: string): Promise<void> {
    f.content = content;
    localStorage.setItem(FakeVault.key(f.path), encodeSeedFile(content, f.stat));
    this.emit('modify', { path: f.path });
  }

  async create(path: string, content: string): Promise<FakeFile> {
    localStorage.setItem(FakeVault.key(path), encodeSeedFile(content));
    const f = this.toFile(path, localStorage.getItem(FakeVault.key(path)) as string);
    this.emit('create', { path });
    return f;
  }

  /** 删除（写层「整文件删除」分支 + 保险箱清单镜像读写路径） */
  async delete(f: FakeFile | { path: string }): Promise<void> {
    localStorage.removeItem(FakeVault.key(f.path));
    this.emit('delete', { path: f.path });
  }

  async createFolder(_path: string): Promise<void> {
    return undefined as never;
  }

  /** 媒体资源 URL：入库子集命中 → assets/ 相对路径；否则按需走预览服务的真实 vault 取流；
   *  file://（双击直开、无服务端）下两者都不可用 → ''（墙渐变占位语义）。 */
  getResourcePath(file: { path: string }): string {
    const base = file.path.split('/').pop() || '';
    if (!base) return '';
    if (assetManifest().includes(base)) return './assets/' + encodeURIComponent(base);
    return vaultMediaUrl(base);
  }

  /** adapter 直读目录面（data.ts collectMdPaths 递归枚举 md 的数据源）。
   *  与 Obsidian DataAdapter.list 同契约：files/folders 均为【库内全路径】。 */
  adapter = {
    list: async (dir: string): Promise<{ folders: string[]; files: string[] }> => {
      const clean = String(dir).replace(/^\/+|\/+$/g, '');
      const dirs = new Set<string>();
      const files: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(KEY_PREFIX)) continue;
        const path = k.slice(KEY_PREFIX.length);
        if (!path) continue;
        const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        if (parent !== clean && !parent.startsWith(clean ? clean + '/' : '')) continue;
        const rest = clean ? path.slice(clean.length + 1) : path;
        if (!rest) continue;
        const slash = rest.indexOf('/');
        if (slash >= 0) {
          const name = rest.slice(0, slash);
          dirs.add(clean ? clean + '/' + name : name);
        } else {
          files.push(clean ? clean + '/' + rest : rest);
        }
      }
      return { folders: [...dirs].sort(), files };
    },
  };

  /** 事件订阅（core/app vault.on/offref 同形） */
  on(evt: string, cb: (file: unknown) => void): { ref: unknown } {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(cb);
    const id = ++this.idSeq;
    return { ref: id };
  }

  offref(_ref: unknown): void {
    this.listeners.clear();
  }

  private emit(evt: string, file: unknown): void {
    for (const cb of this.listeners.get(evt) ?? []) cb(file);
  }
}

/** metadataCache：getFileCache frontmatter 现解析 + getFirstLinkpathDest 媒体链接解析（清单命中） */
export class FakeMetadataCache {
  private cache = new Map<string, Record<string, unknown> | null>();

  getFileCache(file: { path: string; content?: string }): { frontmatter?: Record<string, unknown> } | null {
    if (!file || typeof file.path !== 'string') return null;
    if (!this.cache.has(file.path)) {
      const raw = typeof file.content === 'string' ? file.content : this.readThrough(file.path);
      this.cache.set(file.path, parseFrontmatter(raw));
    }
    const fm = this.cache.get(file.path);
    return fm ? { frontmatter: fm } : null;
  }

  /** 媒体链接解析（data.ts mediaSrc 优先路）：入库清单命中、或经预览服务可取真实 vault 媒体
   *  （http 环境 + 媒体扩展名）→ 返回 TFile 形状；否则 null → mediaSrc 回退 '' 走渐变占位。 */
  getFirstLinkpathDest(ref: string, _sourcePath: string): { path: string } | null {
    const base = (ref || '').split('/').pop() || '';
    if (!base) return null;
    if (assetManifest().includes(base)) return { path: base };
    return vaultMediaUrl(base) ? { path: base } : null;
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

/** frontmatter 极简解析（影视/信/书种子笔记的 影评/观影日期/date/completionDate 面） */
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
      fm[key] = [];
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

/** 评审壳 App：vault + metadataCache（日记本链完整读写面） */
export class FakeApp {
  vault = new FakeVault();
  metadataCache = new FakeMetadataCache();
}

export type App = FakeApp;

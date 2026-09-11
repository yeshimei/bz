/**
 * 番茄钟行为单源 · 公共假 obsidian（2026-09-11 接入预览管线，范式随 settings-panel）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 fake-sim.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但番茄钟的真实现
 * （ui.ts 及其依赖链 state/data/stats/config/sound/statusbar + core 服务）只用到
 * 以下少数出口，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.BZ_POMODORO_ICONS，prototype-icons.js）
 *   - Setting                  → ⚙ 设置弹窗运行期真触达（core/settings-modal →
 *                                core/settings-schema renderSettingsInto 逐行 new Setting）：
 *                                最小真实现（text/toggle/dropdown/slider/button 真出 DOM、
 *                                onChange 真触发），设置行在弹窗内照常可交互
 *   - moment                   → re-export npm moment（闭包内 diary 等模块级 import；
 *                                本链运行路径不用，仅求值可解析）
 *   - TFile / MarkdownRenderer / Component / Notice / Modal 等 → 壳类（仅满足闭包内
 *                                模块顶层求值/类型 import 可解析，评审路径不执行）
 *   - requestUrl               → 抛错降级（core/utils 模块级 import 触及；本链无网络路径）
 *   - App / vault / metadataCache → localStorage 文件系统（pomodoro.json 的读改写全真，
 *                                jsonFileStore 写队列真实现跑在 fake vault 上）。
 *
 * 与 settings-panel/fake/fake-obsidian.ts 同构的部分（FakeVault localStorage 后端 +
 * storage 事件桥 + metadataCache + Setting 真实现）保留同款语义。
 * 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
 * （fake-sim.ts import core/app 的 setApp 注入 FakeApp；core/storage 的 jsonFileStore
 * 经 core/app getApp() 取到同一实例，单源不裂）。
 */
import moment from 'moment';

export { moment };

// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.BZ_POMODORO_ICONS） ====================

declare global {
  interface Window {
    BZ_POMODORO_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.BZ_POMODORO_ICONS?.[iconId]) || '';
  if (!d) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // 表里存的是内层 path/circle/polyline 片段——注入 innerHTML（内容为受控图标表）。
  // trim：片段两侧空白会在 svg 里留文本节点，进而污染容器 textContent（自检断言按文本比对时踩过）
  svg.innerHTML = d.trim();
  // Obsidian setIcon 会保留容器已有 class；span.bz-ic 场景由调用方控制外观
  container.replaceChildren(svg);
}

export type IconName = string;

/** requestUrl（core/utils 模块级 import 触及）：原型无网络，抛错让调用方走各自降级 */
export async function requestUrl(): Promise<never> {
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== Setting（⚙ 设置弹窗运行期真触达的最小实现） ====================

/** 文本组件（addText/addSearch/addTextArea/addSlider 回调入参；onChange 真触发） */
interface FakeTextComponent {
  inputEl: HTMLInputElement | HTMLTextAreaElement;
  setValue(v: string): this;
  getValue(): string;
  setPlaceholder(p: string): this;
  onChange(cb: (v: string) => unknown): this;
}

/** 开关组件（addToggle） */
interface FakeToggleComponent {
  toggleEl: HTMLInputElement;
  setValue(v: boolean): this;
  getValue(): boolean;
  onChange(cb: (v: boolean) => unknown): this;
}

/** 下拉组件（addDropdown；addOption = Obsidian 原生 API 逐项添加——core/settings-schema
 *  渲染器 `for (const opt of row.options) dd.addOption(opt.value, opt.label)` 消费它） */
interface FakeDropdownComponent {
  selectEl: HTMLSelectElement;
  addOption(value: string, label: string): this;
  addOptions(opts: Array<{ value: string; label: string }>): this;
  setValue(v: string): this;
  onChange(cb: (v: string) => unknown): this;
}

/** 按钮组件（addButton/addExtraButton） */
interface FakeButtonComponent {
  buttonEl: HTMLButtonElement;
  setButtonText(t: string): this;
  setCta(v?: boolean): this;
  setDisabled(v: boolean): this;
  onClick(cb: () => unknown): this;
}

/** 滑条组件（addSlider；setLimits/setDynamicTooltip = Obsidian 原生 SliderComponent API——
 *  core/settings-schema 渲染器 setLimits(min,max,step) + setValue(number) 消费它） */
interface FakeSliderComponent {
  inputEl: HTMLInputElement;
  setLimits(min: number, max: number, step: number, value?: number): this;
  setValue(v: number): this;
  getValue(): number;
  setDynamicTooltip(): this;
  onChange(cb: (v: number) => unknown): this;
}

/** 取色组件（addColorPicker；评审路径未触达——no-op 占位） */
interface FakeColorComponent {
  setValue(v: string): unknown;
  onChange(cb: (v: string) => unknown): unknown;
}

/** 原生 Setting 的浏览器版最小实现：⚙ 设置弹窗 schema 渲染（core/settings-schema
 *  renderSettingsInto）逐行 new Setting 的真实触达面。产出与 Obsidian 同构的
 *  .setting-item DOM，text/toggle/dropdown/slider/button 真出 DOM、onChange 真回调。 */
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
    info.append(this.nameEl, this.descEl);
    this.controlEl = document.createElement('div');
    this.controlEl.className = 'setting-item-control';
    this.settingEl.append(info, this.controlEl);
    container.appendChild(this.settingEl);
  }

  setName(v: string | DocumentFragment): this {
    this.nameEl.textContent = v instanceof DocumentFragment ? v.textContent : String(v ?? '');
    return this;
  }

  setDesc(v: string | DocumentFragment): this {
    this.descEl.textContent = v instanceof DocumentFragment ? v.textContent : String(v ?? '');
    return this;
  }

  setClass(c: string): this {
    this.settingEl.classList.add(c);
    return this;
  }

  setTooltip(_t: string): this {
    return this;
  }

  addText(cb: (t: FakeTextComponent) => unknown): this {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'bz-input';
    const comp: FakeTextComponent = {
      inputEl: input,
      setValue(v: string) {
        input.value = v;
        return comp;
      },
      getValue: () => input.value,
      setPlaceholder(p: string) {
        input.placeholder = p;
        return comp;
      },
      onChange(cb2: (v: string) => unknown) {
        input.addEventListener('input', () => cb2(input.value));
        return comp;
      },
    };
    cb(comp);
    this.controlEl.appendChild(input);
    return this;
  }

  addSearch(cb: (t: FakeTextComponent) => unknown): this {
    return this.addText(cb);
  }

  addTextArea(cb: (t: FakeTextComponent) => unknown): this {
    const input = document.createElement('textarea');
    input.className = 'bz-input';
    const comp: FakeTextComponent = {
      inputEl: input,
      setValue(v: string) {
        input.value = v;
        return comp;
      },
      getValue: () => input.value,
      setPlaceholder(p: string) {
        input.placeholder = p;
        return comp;
      },
      onChange(cb2: (v: string) => unknown) {
        input.addEventListener('input', () => cb2(input.value));
        return comp;
      },
    };
    cb(comp);
    this.controlEl.appendChild(input);
    return this;
  }

  addToggle(cb: (t: FakeToggleComponent) => unknown): this {
    const toggleEl = document.createElement('input');
    toggleEl.type = 'checkbox';
    const comp: FakeToggleComponent = {
      toggleEl,
      setValue(v: boolean) {
        toggleEl.checked = v;
        return comp;
      },
      getValue: () => toggleEl.checked,
      onChange(cb2: (v: boolean) => unknown) {
        toggleEl.addEventListener('change', () => cb2(toggleEl.checked));
        return comp;
      },
    };
    cb(comp);
    this.controlEl.appendChild(toggleEl);
    return this;
  }

  addDropdown(cb: (t: FakeDropdownComponent) => unknown): this {
    const selectEl = document.createElement('select');
    const comp: FakeDropdownComponent = {
      selectEl,
      addOption(value: string, label: string) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        selectEl.appendChild(opt);
        return comp;
      },
      addOptions(opts: Array<{ value: string; label: string }>) {
        for (const o of opts) comp.addOption(o.value, o.label);
        return comp;
      },
      setValue(v: string) {
        selectEl.value = v;
        return comp;
      },
      onChange(cb2: (v: string) => unknown) {
        selectEl.addEventListener('change', () => cb2(selectEl.value));
        return comp;
      },
    };
    cb(comp);
    this.controlEl.appendChild(selectEl);
    return this;
  }

  private mkButton(cb: (b: FakeButtonComponent) => unknown): void {
    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    let onClickCb: (() => unknown) | null = null;
    const comp: FakeButtonComponent = {
      buttonEl,
      setButtonText(t: string) {
        buttonEl.textContent = t;
        return comp;
      },
      setCta(v?: boolean) {
        buttonEl.classList.toggle('bz-sp-btn--primary', v !== false);
        return comp;
      },
      setDisabled(v: boolean) {
        buttonEl.disabled = v;
        return comp;
      },
      onClick(cb2: () => unknown) {
        onClickCb = cb2;
        return comp;
      },
    };
    buttonEl.addEventListener('click', () => {
      if (onClickCb && !buttonEl.disabled) void onClickCb();
    });
    cb(comp);
    this.controlEl.appendChild(buttonEl);
  }

  addButton(cb: (b: FakeButtonComponent) => unknown): this {
    this.mkButton(cb);
    return this;
  }

  addExtraButton(cb: (b: FakeButtonComponent) => unknown): this {
    this.mkButton(cb);
    return this;
  }

  addSlider(cb: (t: FakeSliderComponent) => unknown): this {
    const input = document.createElement('input');
    input.type = 'range';
    const comp: FakeSliderComponent = {
      inputEl: input as HTMLInputElement,
      setLimits(min: number, max: number, step: number, value?: number) {
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        if (value !== undefined) input.value = String(value);
        return comp;
      },
      setValue(v: number) {
        input.value = String(v);
        return comp;
      },
      getValue: () => Number(input.value),
      setDynamicTooltip() {
        input.title = input.value;
        return comp;
      },
      onChange(cb2: (v: number) => unknown) {
        input.addEventListener('input', () => cb2(Number(input.value)));
        return comp;
      },
    };
    cb(comp);
    this.controlEl.appendChild(input);
    return this;
  }

  addColorPicker(cb: (t: FakeColorComponent) => unknown): this {
    void cb({ setValue: () => undefined, onChange: () => undefined });
    return this;
  }

  addMomentFormat(cb: (t: { sample: string }) => unknown): this {
    void cb({ sample: '' });
    return this;
  }

  then(cb?: (s: Setting) => unknown): this {
    if (cb) cb(this);
    return this;
  }
}

// ==================== 依赖闭包壳类（仅满足 import 可解析，不参与运行路径） ====================

/** TFile 值占位：闭包内 `instanceof TFile` 值引用——FakeFile 非 TFile → 判否 */
export class TFile {}

/** MarkdownRenderer / MarkdownView / Component 壳：闭包内 UI 模块的值导入 */
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

/** 其余常见 obsidian 值导入的空壳（防闭包内 class extends / new 顶层求值崩） */
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

// ==================== App / vault / metadataCache（localStorage 文件系统） ====================

export interface FakeStat {
  ctime: number;
  mtime: number;
}

/** 文件对象：消费方（jsonFileStore 等）拿到的 TFile 读取面 */
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

/**
 * 内存 vault：实现番茄钟链用到的 vault 面（jsonFileStore 读改写建全真）。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * 浏览器自动向另一 iframe 广播 storage 事件 → 本类转发为自己的 modify 监听）。
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

  /** 全部索引文件（jsonFileStore 的 pomodoro.json + 种子 md；点前缀目录不入——与真宿主同语义） */
  getFiles(): FakeFile[] {
    const out: FakeFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      const path = k.slice(KEY_PREFIX.length);
      if (!path || path.split('/').some((seg) => seg.startsWith('.'))) continue;
      out.push(this.toFile(path, localStorage.getItem(k) as string));
    }
    return out;
  }

  /** 全部 md 文件（闭包扫描吃这个列表；同 getFiles 的点前缀语义） */
  getMarkdownFiles(): FakeFile[] {
    return this.getFiles().filter((f) => f.extension === 'md');
  }

  async read(f: FakeFile): Promise<string> {
    return f.content;
  }

  async modify(f: FakeFile, content: string): Promise<void> {
    // stat 保持种子值不刷新：评审期反复打开面板，统计时间口径稳定
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

  /** adapter 直读（闭包内 readWeaveAggregates 等走 vault.adapter.read；本链运行路径不触达） */
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
 * metadataCache：闭包内只用 getFileCache(file).frontmatter。
 * 从 FakeFile 内容现解析 + 按路径 memo。
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
      fm[key] = []; // 待填充列表
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

/** 评审壳 App：vault + metadataCache（番茄钟链的完整读取面） */
export class FakeApp {
  vault = new FakeVault();
  metadataCache = new FakeMetadataCache();
}

export type App = FakeApp;

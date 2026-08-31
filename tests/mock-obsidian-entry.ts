/**
 * obsidian 模块测试替身入口（通过 vitest resolve.alias 替换）。
 * 注意：必须使用命名导出（`import { moment } from 'obsidian'` 按命名导出解析）。
 */
import { vi } from 'vitest';
import * as momentNs from 'moment';
import { __resetNoticeForTests } from '../src/core/notice';

// CJS/ESM 互操作：取到可调用的 moment 函数
const realMoment: any = (momentNs as any).default || momentNs;

export class MockNotice {
  static instances: MockNotice[] = [];
  message: string;
  constructor(message: string) {
    this.message = message;
    MockNotice.instances.push(this);
  }
}

/**
 * 通知 DOM 断言辅助（ticket 25：自绘通知替代原生 Notice 后，测试断言通知 DOM）。
 * getNoticeMessages：当前全部通知正文；hasNotice：精确（string）/模糊（RegExp）匹配；
 * clearNotices：清空通知 DOM（残留计时器由通知模块自身安全兜底）。
 */
export function getNoticeMessages(): string[] {
  return Array.from(document.querySelectorAll('.bz-notice-msg')).map(
    (el) => (el as HTMLElement).textContent || ''
  );
}

export function hasNotice(msg: string | RegExp): boolean {
  return getNoticeMessages().some((m) =>
    typeof msg === 'string' ? m === msg : msg.test(m)
  );
}

export function clearNotices(): void {
  const c = document.getElementById('bz-notice-container');
  if (c && c.parentNode) c.parentNode.removeChild(c);
  document.querySelectorAll('.bz-notice').forEach((el) => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
}

export const mockMarkdownRenderer = {
  render: vi.fn(async (_app: any, md: string, el: HTMLElement) => {
    if (el) el.textContent = md;
  }),
};

export class MockComponent {}

export class MockMarkdownView {}

export const moment = realMoment;
export const Notice = MockNotice;
export const MarkdownView = MockMarkdownView;
export const MarkdownRenderer = mockMarkdownRenderer;
export const Component = MockComponent;
export class MockPlugin {
  app: any = null;
  commands: any[] = [];
  settingTabs: any[] = [];
  ribbonIcons: any[] = [];
  statusBarItems: any[] = [];
  private data: any = null;

  async loadData(): Promise<any> {
    return this.data;
  }

  async saveData(data: any): Promise<void> {
    this.data = data;
  }

  addCommand(cmd: any): any {
    this.commands.push(cmd);
    return cmd;
  }

  addRibbonIcon(icon: string, title: string, callback: () => void): any {
    this.ribbonIcons.push({ icon, title, callback });
    return null;
  }

  addStatusBarItem(): any {
    const el = document.createElement('div');
    this.statusBarItems.push(el);
    return el;
  }

  addSettingTab(tab: any): void {
    this.settingTabs.push(tab);
  }

  registerEvent(): void {}
  registerDomEvent(): void {}
}
export const Plugin = MockPlugin;
/** PluginSettingTab mock：带 containerEl（display() 渲染目标） */
export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement;
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
    document.body.appendChild(this.containerEl);
  }
  display() {}
}

/** Setting 控件链式 mock（setName/setDesc/addDropdown/addText/addToggle/addButton）
 *  2026-08（ticket 128）：补真实 DOM 结构——settingEl 下建 .setting-item-info +
 *  .setting-item-control（对齐 Obsidian 真实布局；移动端两行式 markSettingSplitRows 按控件区
 *  子元素计数），addText/addButton 同步渲染真实 input/button 元素（buttonEl/inputEl 同真实 API），
 *  trigger() 为既有测试主路径保持不变。 */
export class MockDropdown {
  options: Record<string, string> = {};
  value = '';
  dropdownEl: HTMLSelectElement;
  private cb: ((v: string) => void) | null = null;
  constructor() {
    this.dropdownEl = document.createElement('select');
  }
  addOption(key: string, label: string): this {
    this.options[key] = label;
    return this;
  }
  setValue(v: string): this {
    this.value = v;
    return this;
  }
  onChange(cb: (v: string) => void): this {
    this.cb = cb;
    return this;
  }
  /** 测试辅助：模拟用户选择 */
  trigger(v: string) {
    this.value = v;
    if (this.cb) void this.cb(v);
  }
}
export class MockText {
  value = '';
  placeholder = '';
  inputEl: HTMLInputElement;
  private cb: ((v: string) => void) | null = null;
  constructor() {
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.addEventListener('input', () => {
      this.value = this.inputEl.value;
      if (this.cb) void this.cb(this.value);
    });
  }
  setValue(v: string): this {
    this.value = v;
    this.inputEl.value = v;
    return this;
  }
  setPlaceholder(p: string): this {
    this.placeholder = p;
    this.inputEl.placeholder = p;
    return this;
  }
  onChange(cb: (v: string) => void): this {
    this.cb = cb;
    return this;
  }
  /** 测试辅助：模拟输入 */
  trigger(v: string) {
    this.value = v;
    this.inputEl.value = v;
    if (this.cb) void this.cb(v);
  }
}
export class MockToggle {
  value = false;
  disabled = false;
  toggleEl: HTMLInputElement;
  private cb: ((v: boolean) => void) | null = null;
  constructor() {
    this.toggleEl = document.createElement('input');
    this.toggleEl.type = 'checkbox';
  }
  setValue(v: boolean): this {
    this.value = v;
    return this;
  }
  setDisabled(d: boolean): this {
    this.disabled = d;
    return this;
  }
  onChange(cb: (v: boolean) => void): this {
    this.cb = cb;
    return this;
  }
  /** 测试辅助：模拟开关 */
  trigger(v: boolean) {
    this.value = v;
    if (this.cb) void this.cb(v);
  }
}
export class MockButton {
  text = '';
  cta = false;
  isExtraButton = false;
  icon: string | null = null;
  buttonEl: HTMLButtonElement;
  private cb: (() => void) | null = null;
  constructor() {
    this.buttonEl = document.createElement('button');
    this.buttonEl.addEventListener('click', () => this.cb?.());
  }
  setButtonText(t: string): this {
    this.text = t;
    this.buttonEl.textContent = t;
    return this;
  }
  /** 真实 Obsidian SettingButton 有该 API（强调色按钮）；mock 记录 flag 供断言 */
  setCta(): this {
    this.cta = true;
    return this;
  }
  /** ticket 124：删除按钮 setIcon（mock 记录图标名） */
  setIcon(name: string): this {
    this.icon = name;
    return this;
  }
  setTooltip(_t: string): this {
    return this;
  }
  /** ticket 173：加载态禁用（真实 Obsidian ButtonComponent 有 setDisabled；mock 同步 buttonEl） */
  setDisabled(d: boolean): this {
    this.buttonEl.disabled = d;
    return this;
  }
  onClick(cb: () => void): this {
    this.cb = cb;
    return this;
  }
  /** 测试辅助：模拟点击 */
  trigger() {
    if (this.cb) this.cb();
  }
}

export class MockSlider {
  value = 0;
  limits: [number, number, number] = [0, 100, 1];
  private cb: ((v: number) => void) | null = null;
  setLimits(min: number, max: number, step: number): this {
    this.limits = [min, max, step];
    return this;
  }
  setValue(v: number): this {
    this.value = v;
    return this;
  }
  setDynamicTooltip(): this {
    return this;
  }
  onChange(cb: (v: number) => void): this {
    this.cb = cb;
    return this;
  }
  /** 测试辅助：模拟拖动 */
  trigger(v: number) {
    this.value = v;
    if (this.cb) void this.cb(v);
  }
}
export class Setting {
  containerEl: HTMLElement;
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  controlEl: HTMLElement;
  name = '';
  desc = '';
  controls: any[] = [];
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.settingEl = document.createElement('div');
    this.settingEl.className = 'setting-item';
    // 对齐 Obsidian 真实布局：info（名称/描述区）+ control（控件区）——移动端两行式
    // markSettingSplitRows 按 .setting-item-control 的子元素数挂 .bz-setting-split
    this.infoEl = document.createElement('div');
    this.infoEl.className = 'setting-item-info';
    this.controlEl = document.createElement('div');
    this.controlEl.className = 'setting-item-control';
    this.settingEl.append(this.infoEl, this.controlEl);
    // 测试辅助：settingEl 反向引用实例（取控件用）
    (this.settingEl as any).__setting = this;
    containerEl.appendChild(this.settingEl);
  }
  setName(name: string): this {
    this.name = name;
    this.settingEl.dataset.name = name;
    return this;
  }
  setHeading(): this {
    this.settingEl.classList.add('setting-item-heading');
    return this;
  }
  setDesc(desc: string): this {
    this.desc = desc;
    return this;
  }
  addDropdown(cb: (dd: MockDropdown) => void): this {
    const dd = new MockDropdown();
    cb(dd);
    this.controlEl.appendChild(dd.dropdownEl);
    this.controls.push(dd);
    return this;
  }
  addText(cb: (t: MockText) => void): this {
    const t = new MockText();
    cb(t);
    this.controlEl.appendChild(t.inputEl);
    this.controls.push(t);
    return this;
  }
  addTextArea(cb: (t: MockText) => void): this {
    const t = new MockText();
    cb(t);
    this.controlEl.appendChild(t.inputEl);
    this.controls.push(t);
    return this;
  }
  addToggle(cb: (t: MockToggle) => void): this {
    const t = new MockToggle();
    cb(t);
    this.controlEl.appendChild(t.toggleEl);
    this.controls.push(t);
    return this;
  }
  addButton(cb: (b: MockButton) => void): this {
    const b = new MockButton();
    cb(b);
    this.controlEl.appendChild(b.buttonEl);
    this.controls.push(b);
    return this;
  }
  /** ticket 124：数据源组 UP 名单删除按钮（Obsidian 真实 API；mock 复用 MockButton） */
  addExtraButton(cb: (b: MockButton) => void): this {
    const b = new MockButton();
    cb(b);
    this.controlEl.appendChild(b.buttonEl);
    this.controls.push(b);
    b.isExtraButton = true;
    return this;
  }
  addSlider(cb: (sl: MockSlider) => void): this {
    const sl = new MockSlider();
    cb(sl);
    this.controls.push(sl);
    return this;
  }
}
export const TFile = class {};
export const TFolder = class {};
export const normalizePath = (p: string) => p;

/** setIcon mock：把图标名记录到元素 dataset.icon（真实环境渲染 lucide svg） */
export const setIcon = vi.fn((el: HTMLElement, name: string, _size?: number) => {
  el.dataset.icon = name;
});

/** getIcon mock：ASCII 图标名视为 Obsidian 内置图标有效；emoji/字符无效 */
export const getIcon = vi.fn((name: string) =>
  name && /^[\x20-\x7E]+$/.test(name) ? {} : undefined
);

export const requestUrl = vi.fn(async (opts: any) => ({
  status: 200,
  text: '',
}));

/** Platform mock：isMobile 默认 false（桌面端）；测试切移动端改 isMobile = true */
export const Platform = {
  isMobile: false,
};

export const obsidianMock = {
  Notice,
  MarkdownView,
  MarkdownRenderer,
  Component,
  Plugin,
  PluginSettingTab,
  Setting,
  moment,
  TFile,
  TFolder,
  normalizePath,
  requestUrl,
  setIcon,
  getIcon,
  Platform,
};

export function resetObsidianMocks() {
  MockNotice.instances = [];
  mockMarkdownRenderer.render.mockClear();
  setIcon.mockClear();
  getIcon.mockClear();
  // 自绘通知（ticket 25）：清存活/去重记录，防 dedupeKey 窗口跨测试残留
  __resetNoticeForTests();
}

export default obsidianMock;

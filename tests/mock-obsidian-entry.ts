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

/** Setting 控件链式 mock（setName/setDesc/addDropdown/addText/addToggle/addButton） */
export class MockDropdown {
  options: Record<string, string> = {};
  value = '';
  private cb: ((v: string) => void) | null = null;
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
  private cb: ((v: string) => void) | null = null;
  setValue(v: string): this {
    this.value = v;
    return this;
  }
  setPlaceholder(p: string): this {
    this.placeholder = p;
    return this;
  }
  onChange(cb: (v: string) => void): this {
    this.cb = cb;
    return this;
  }
  /** 测试辅助：模拟输入 */
  trigger(v: string) {
    this.value = v;
    if (this.cb) void this.cb(v);
  }
}
export class MockToggle {
  value = false;
  disabled = false;
  private cb: ((v: boolean) => void) | null = null;
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
  private cb: (() => void) | null = null;
  setButtonText(t: string): this {
    this.text = t;
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
  name = '';
  desc = '';
  controls: any[] = [];
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.settingEl = document.createElement('div');
    this.settingEl.className = 'setting-item';
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
    this.controls.push(dd);
    return this;
  }
  addText(cb: (t: MockText) => void): this {
    const t = new MockText();
    cb(t);
    this.controls.push(t);
    return this;
  }
  addTextArea(cb: (t: MockText) => void): this {
    const t = new MockText();
    cb(t);
    this.controls.push(t);
    return this;
  }
  addToggle(cb: (t: MockToggle) => void): this {
    const t = new MockToggle();
    cb(t);
    this.controls.push(t);
    return this;
  }
  addButton(cb: (b: MockButton) => void): this {
    const b = new MockButton();
    cb(b);
    this.controls.push(b);
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
export const setIcon = vi.fn((el: HTMLElement, name: string) => {
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

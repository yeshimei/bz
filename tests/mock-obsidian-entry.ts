/**
 * obsidian 模块测试替身入口（通过 vitest resolve.alias 替换）。
 * 注意：必须使用命名导出（`import { moment } from 'obsidian'` 按命名导出解析）。
 */
import { vi } from 'vitest';
import * as momentNs from 'moment';

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

export const mockMarkdownRenderer = {
  render: vi.fn(async () => {}),
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
  private cb: ((v: boolean) => void) | null = null;
  setValue(v: boolean): this {
    this.value = v;
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
}
export const TFile = class {};
export const TFolder = class {};
export const normalizePath = (p: string) => p;

export const requestUrl = vi.fn(async (opts: any) => ({
  status: 200,
  text: '',
}));

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
};

export function resetObsidianMocks() {
  MockNotice.instances = [];
  mockMarkdownRenderer.render.mockClear();
}

export default obsidianMock;

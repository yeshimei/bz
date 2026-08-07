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
export const PluginSettingTab = class {};
export const Setting = class {};
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

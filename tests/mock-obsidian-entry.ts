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
export const Plugin = class {};
export const PluginSettingTab = class {};
export const Setting = class {};
export const TFile = class {};
export const TFolder = class {};
export const normalizePath = (p: string) => p;

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
};

export function resetObsidianMocks() {
  MockNotice.instances = [];
  mockMarkdownRenderer.render.mockClear();
}

export default obsidianMock;

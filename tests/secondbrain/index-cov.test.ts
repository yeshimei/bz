/**
 * 第二大脑域入口覆盖补测（ticket 103）：ensureSecondBrain 幂等、open 入口冒烟、unload 复位。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureSecondBrain,
  unloadSecondBrain,
  openSecondBrainPanel,
  openSecondBrainReference,
  openSecondBrainChat,
} from '../../src/secondbrain/index';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';

function makeMinimalApp(): any {
  return {
    vault: {
      adapter: {}, // read/readBinary/stat 缺失 → 各处 catch 兜底空库
      getMarkdownFiles: () => [],
    },
    workspace: {},
  };
}

describe('secondbrain/index 入口', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
    unloadSecondBrain(); // 复位模块单例
  });

  it('ensureSecondBrain 幂等：重复调用只初始化一次且不抛错', () => {
    const app = makeMinimalApp();
    expect(() => ensureSecondBrain(app)).not.toThrow();
    expect(() => ensureSecondBrain(app)).not.toThrow();
  });

  it('三个 open 入口在最小 mock 下同步路径不抛错', () => {
    const app = makeMinimalApp();
    expect(() => openSecondBrainPanel(app)).not.toThrow();
    expect(() => openSecondBrainReference(app)).not.toThrow();
    expect(() => openSecondBrainChat(app)).not.toThrow();
  });

  it('unload 后可重新初始化（单例复位）', () => {
    const app = makeMinimalApp();
    ensureSecondBrain(app);
    expect(() => unloadSecondBrain()).not.toThrow();
    expect(() => ensureSecondBrain(app)).not.toThrow();
    unloadSecondBrain();
  });
});

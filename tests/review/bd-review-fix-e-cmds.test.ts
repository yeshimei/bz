/**
 * review 域「全域深审拍板后修复批」Wave1 · 命令名回归（呈报#56/R12）：
 * 六条复习命令 name 从括号式改动宾式（命令面板顺读；id 一律不动，本批不新增不改命令 id）。
 * 命名对照：跳转逾期复习 / 选择复习难度 / 复习评级：忘了·困难·一般·简单。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import BzPlugin from '../../src/main';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const registeredCommands: any[] = [];

function makeMockApp() {
  return {
    vault: new MockVault(),
    workspace: {
      onLayoutReady: (cb: () => void) => cb(),
      getActiveFile: () => null,
      getActiveViewOfType: () => null,
      activeEditor: null,
      on: () => ({ ref: 'ref' }),
    },
    commands: {
      addCommand: (c: any) => {
        registeredCommands.push(c);
      },
      removeCommand: () => undefined,
      listCommands: () => [],
      executeCommandById: () => undefined,
    },
    metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
}

const EXPECTED_NAMES: Array<[string, string]> = [
  ['bz-review-overdue', '跳转逾期复习'],
  ['bz-review-rate', '选择复习难度'],
  ['bz-review-again', '复习评级：忘了'],
  ['bz-review-hard', '复习评级：困难'],
  ['bz-review-good', '复习评级：一般'],
  ['bz-review-easy', '复习评级：简单'],
];

beforeEach(async () => {
  resetObsidianMocks();
  registeredCommands.length = 0;
  document.body.innerHTML = '';
  setSettingsProvider(() => ({}) as any);
  const app = makeMockApp();
  setApp(app as any);
  const plugin: any = new BzPlugin(app as any, {} as any);
  plugin.app = app;
  plugin.loadData = async () => null;
  plugin.saveData = async () => undefined;
  await plugin.onload();
});

describe('呈报#56（R12）：六条复习命令名改动宾式', () => {
  it('六条 name 全对齐动宾式，id 不变', () => {
    for (const [id, name] of EXPECTED_NAMES) {
      const cmd = registeredCommands.find((c) => c.id === id);
      expect(cmd, `缺命令 ${id}`).toBeTruthy();
      expect(cmd.name, `${id} name 应为「${name}」`).toBe(name);
      expect(cmd.name, `${id} 不应再有括号式命名`).not.toMatch(/）/);
    }
  });
});

/**
 * 海报抓取测试（ticket 21）：mock window.require('child_process')，覆盖
 * 桌面/移动端门禁、create 过滤、延迟入队、串行队列、结果判定、通知、超时、卸载、设置页联动。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { MockVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, MockNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  ensurePosterFetch, unloadPosterFetch, probeInstall, getProbeState, isDesktop, PACKAGE_NAME,
} from '../../src/movie/poster';
import BzPlugin, { BzSettingTab } from '../../src/main';

const CLI_PATH = '/g/node_modules/@jwbz/obsidian-douban-poster/cli.js';

/** 可控的 Node 模块替身（child_process/fs/path） */
class FakeStream {
  cbs: Record<string, Function[]> = {};
  on(ev: string, cb: Function): this {
    (this.cbs[ev] ||= []).push(cb);
    return this;
  }
  emit(ev: string, ...args: any[]) {
    for (const cb of this.cbs[ev] || []) cb(...args);
  }
}

class FakeProc extends EventEmitter {
  stdout = new FakeStream();
  stderr = new FakeStream();
  killed = false;
  kill = vi.fn(() => { this.killed = true; });
}

interface NodeMock {
  cp: {
    spawn: ReturnType<typeof vi.fn>;
    execFile: ReturnType<typeof vi.fn>;
  };
  proc: FakeProc | null;
  spawnCalls: { bin: string; args: string[] }[];
  emitStdout(text: string): void;
  emitStderr(text: string): void;
  finish(code: number): void;
}

function installNodeMock(opts: { installed?: boolean; execError?: boolean } = {}): NodeMock {
  const { installed = true, execError = false } = opts;
  const m: NodeMock = {
    cp: {
      spawn: vi.fn(),
      execFile: vi.fn(),
    },
    proc: null,
    spawnCalls: [],
    emitStdout(text: string) { this.proc?.stdout.emit('data', text); },
    emitStderr(text: string) { this.proc?.stderr.emit('data', text); },
    finish(code: number) { this.proc?.emit('close', code); },
  };
  m.cp.spawn.mockImplementation((bin: string, args: string[]) => {
    m.spawnCalls.push({ bin, args });
    m.proc = new FakeProc();
    return m.proc;
  });
  m.cp.execFile.mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
    if (execError) { cb(new Error('npm 不存在'), null); return; }
    cb(null, installed ? '/g/node_modules' : '/g/node_modules');
  });
  const fs = { existsSync: (p: string) => installed && p === CLI_PATH };
  const pathMod = { join: (...p: string[]) => p.join('/') };
  (window as any).require = (mod: string) => {
    if (mod === 'child_process') return m.cp;
    if (mod === 'fs') return fs;
    if (mod === 'path') return pathMod;
    return undefined;
  };
  return m;
}

function clearNodeMock() {
  delete (window as any).require;
}

function makeApp(vault: MockVault, extra: any = {}) {
  const v = vault as any;
  v.adapter = { getFullPath: (p: string) => '/vault/' + p };
  const wsEvents: Record<string, Function[]> = {};
  const app = {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const content = vault.files.get(f.path) ?? '';
        return content ? { frontmatter: parseFrontmatter(content) || {} } : null;
      },
    },
    workspace: {
      on: (ev: string, cb: any) => {
        (wsEvents[ev] ||= []).push(cb);
        return { ev, cb };
      },
      offref: (ref: any) => {
        const arr = wsEvents[ref.ev] || [];
        const i = arr.indexOf(ref.cb);
        if (i >= 0) arr.splice(i, 1);
      },
      emit: (ev: string, ...args: any[]) => {
        for (const cb of wsEvents[ev] || []) cb(...args);
      },
    },
    _wsEvents: wsEvents,
  };
  Object.assign(app, extra);
  return app;
}

function makePluginApp() {
  const vault = new MockVault();
  return {
    vault,
    workspace: { onLayoutReady: (cb: () => void) => cb(), on: () => ({ ref: 'ref' }) },
    commands: { addCommand: () => {}, removeCommand: () => {} },
    metadataCache: { getFileCache: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
}

const diskData: Record<string, any> = {};

async function createPlugin(app: any) {
  const plugin: any = new BzPlugin(app, {} as any);
  plugin.app = app;
  plugin.loadData = async () => diskData['bz'] ?? null;
  plugin.saveData = async (d: any) => { diskData['bz'] = d; };
  await plugin.onload();
  return plugin;
}

describe('海报抓取 poster', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMocks();
    document.body.innerHTML = '';
    diskData['bz'] = undefined;
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ movieFolderPath: '我的/影视' }) as any);
  });

  afterEach(() => {
    unloadPosterFetch();
    clearNodeMock();
    vi.useRealTimers();
  });

  describe('桌面端门禁', () => {
    it('isDesktop：有 child_process → true；无 require → false', () => {
      installNodeMock();
      expect(isDesktop()).toBe(true);
      clearNodeMock();
      expect(isDesktop()).toBe(false);
    });

    it('移动端（无 require）：ensure 不注册 create/file-open 监听', () => {
      const app = makeApp(vault);
      ensurePosterFetch(app);
      expect(vault.listeners['create']).toBeUndefined();
      expect(app._wsEvents['file-open']).toBeUndefined();
    });

    it('桌面端：ensure 注册 create + file-open 监听，幂等', () => {
      installNodeMock();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      expect(vault.listeners['create']).toHaveLength(1);
      expect(app._wsEvents['file-open']).toHaveLength(1);
      ensurePosterFetch(app);
      expect(vault.listeners['create']).toHaveLength(1);
      expect(app._wsEvents['file-open']).toHaveLength(1);
    });
  });

  describe('探测', () => {
    it('已安装：npm root -g + existsSync → installed + cliPath 生效', () => {
      installNodeMock({ installed: true });
      probeInstall();
      expect(getProbeState()).toBe('installed');
      expect((window as any).__lastProbe).toBeUndefined();
    });

    it('未安装：execFile 报错 → missing', () => {
      installNodeMock({ execError: true });
      probeInstall();
      expect(getProbeState()).toBe('missing');
    });

    it('未安装：root 下无 cli.js → missing', () => {
      installNodeMock({ installed: false });
      probeInstall();
      expect(getProbeState()).toBe('missing');
    });

    it('移动端：probeInstall 直接 missing，不调 execFile', () => {
      clearNodeMock();
      probeInstall();
      expect(getProbeState()).toBe('missing');
    });
  });

  describe('触发与执行', () => {
    it('影视目录内新 md → 3s 后 spawn node cli.js fetch <path> + 触发通知', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《新片》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《新片》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toEqual([{ bin: 'node', args: [CLI_PATH, 'fetch', '/vault/我的/影视/《新片》.md'] }]);
      expect(MockNotice.instances.some((n) => n.message.includes('正在为《新片》抓取海报'))).toBe(true);
    });

    it('非 md / 影视目录外 → 不 spawn', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('Inbox/x.md', '---\n---');
      vault.files.set('我的/影视/y.txt', 'hi');
      vault.emit('create', vault.file('Inbox/x.md'));
      vault.emit('create', vault.file('我的/影视/y.txt'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(0);
    });

    it('成功：stdout [完成] + close(0) → 已补全通知', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《A》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《A》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      MockNotice.instances.length = 0;
      m.emitStdout('[完成] 海报已保存: CONFIG/MOVIE POSTER/a.jpg\n[完成] 海报已写入: 《A》.md\n');
      m.finish(0);
      expect(MockNotice.instances.some((n) => n.message === '《A》海报与豆瓣信息已补全')).toBe(true);
    });

    it('失败：stdout [失败] → 失败通知含原因', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《B》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《B》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      MockNotice.instances.length = 0;
      m.emitStdout('[失败] 未找到《B》的豆瓣结果\n');
      m.finish(0);
      const n = MockNotice.instances.find((x) => x.message.includes('《B》抓取失败'));
      expect(n?.message).toContain('未找到《B》的豆瓣结果');
    });

    it('跳过：stdout [跳过] → 跳过通知', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《C》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《C》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      MockNotice.instances.length = 0;
      m.emitStdout('[跳过] 《C》 已有海报和豆瓣信息\n');
      m.finish(0);
      expect(MockNotice.instances.some((n) => n.message.includes('《C》跳过'))).toBe(true);
    });

    it('exit≠0 → 失败通知取 stderr 尾部', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《D》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《D》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      MockNotice.instances.length = 0;
      m.emitStderr('[配置] 请先创建配置文件\n');
      m.finish(1);
      const n = MockNotice.instances.find((x) => x.message.includes('《D》抓取失败'));
      expect(n?.message).toContain('请先创建配置文件');
    });

    it('未安装 → 不 spawn，通知安装指引', async () => {
      const m = installNodeMock({ execError: true });
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《E》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《E》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(0);
      const n = MockNotice.instances.find((x) => x.message.includes('《E》抓取失败'));
      expect(n?.message).toContain(`未检测到全局包 ${PACKAGE_NAME}`);
    });

    it('延迟期间文件被删 → 取消，不 spawn', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《F》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《F》.md'));
      vault.files.delete('我的/影视/《F》.md');
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(0);
    });

    it('串行队列：第二个文件等第一个 close 后才 spawn', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《G1》.md', '---\n---');
      vault.files.set('我的/影视/《G2》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《G1》.md'));
      vault.emit('create', vault.file('我的/影视/《G2》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(1);
      m.emitStdout('[完成] x\n');
      m.finish(0);
      expect(m.spawnCalls).toHaveLength(2);
      expect(m.spawnCalls[1].args[2]).toBe('/vault/我的/影视/《G2》.md');
    });

  describe('打开影视笔记触发（无海报）', () => {
    it('打开无海报影视笔记 → 3s 后 spawn（绝对路径）', async () => {
      const m = installNodeMock();
      probeInstall();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      vault.files.set('我的/影视/《开》.md', '---\ntags: [电影]\n---\n');
      app.workspace.emit('file-open', vault.file('我的/影视/《开》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toEqual([{ bin: 'node', args: [CLI_PATH, 'fetch', '/vault/我的/影视/《开》.md'] }]);
      expect(MockNotice.instances.some((n) => n.message.includes('正在为《开》抓取海报'))).toBe(true);
    });

    it('打开已有海报的笔记 → 不触发', async () => {
      const m = installNodeMock();
      probeInstall();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      vault.files.set('我的/影视/《有》.md', '---\n海报: CONFIG/MOVIE POSTER/x.jpg\n---\n');
      app.workspace.emit('file-open', vault.file('我的/影视/《有》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(0);
      expect(MockNotice.instances).toHaveLength(0);
    });

    it('打开目录外笔记 / 非 md → 不触发', async () => {
      const m = installNodeMock();
      probeInstall();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      vault.files.set('Inbox/《外》.md', '---\n---');
      vault.files.set('我的/影视/x.txt', 'hi');
      app.workspace.emit('file-open', vault.file('Inbox/《外》.md'));
      app.workspace.emit('file-open', vault.file('我的/影视/x.txt'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(0);
    });

    it('create + open 双触发 → 冷却去重只抓一次', async () => {
      const m = installNodeMock();
      probeInstall();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      vault.files.set('我的/影视/《双》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《双》.md'));
      // 冷却期内的 open 被去重
      app.workspace.emit('file-open', vault.file('我的/影视/《双》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(1);
    });

    it('冷却 60s：重复打开不触发；冷却过后可再触发', async () => {
      const m = installNodeMock();
      probeInstall();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      vault.files.set('我的/影视/《冷》.md', '---\n---');
      app.workspace.emit('file-open', vault.file('我的/影视/《冷》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      m.emitStdout('[完成] x\n');
      m.finish(0);
      // 冷却期内再次打开
      app.workspace.emit('file-open', vault.file('我的/影视/《冷》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(1);
      // 冷却过后（fake timers 同步推进 Date.now）
      await vi.advanceTimersByTimeAsync(60000);
      app.workspace.emit('file-open', vault.file('我的/影视/《冷》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(2);
    });

    it('打开 null（关闭标签页）→ 不崩、不触发', async () => {
      const m = installNodeMock();
      probeInstall();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      app.workspace.emit('file-open', null);
      await vi.advanceTimersByTimeAsync(3000);
      expect(m.spawnCalls).toHaveLength(0);
    });

    it('卸载：workspace file-open 监听 offref', async () => {
      installNodeMock();
      probeInstall();
      const app = makeApp(vault);
      ensurePosterFetch(app);
      expect(app._wsEvents['file-open']).toHaveLength(1);
      unloadPosterFetch();
      expect(app._wsEvents['file-open']).toHaveLength(0);
    });
  });
    it('超时 60s → kill + 失败通知', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《H》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《H》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      MockNotice.instances.length = 0;
      await vi.advanceTimersByTimeAsync(60000);
      expect(m.proc?.killed).toBe(true);
      expect(MockNotice.instances.some((n) => n.message.includes('抓取超时'))).toBe(true);
    });
  });

  describe('卸载', () => {
    it('unloadPosterFetch：offref + 活跃进程 kill + initialized 复位 + probe 复位', async () => {
      const m = installNodeMock();
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      vault.files.set('我的/影视/《I》.md', '---\n---');
      vault.emit('create', vault.file('我的/影视/《I》.md'));
      await vi.advanceTimersByTimeAsync(3000);
      unloadPosterFetch();
      expect(m.proc?.killed).toBe(true);
      expect(getProbeState()).toBe('unknown');
      // 再次 ensure 可重新注册
      probeInstall();
      ensurePosterFetch(makeApp(vault));
      expect(vault.listeners['create']).toHaveLength(1);
    });
  });

  describe('设置页联动', () => {
    async function setupSettingsTab(node: NodeMock | null) {
      if (node) installNodeMock(); else clearNodeMock();
      const app = makePluginApp();
      const plugin = await createPlugin(app);
      const tab = new BzSettingTab(plugin.app, plugin);
      tab.display();
      return { plugin, tab };
    }

    it('移动端：开关置灰 + 「仅桌面端可用」', async () => {
      const { tab } = await setupSettingsTab(null);
      const el = [...tab.containerEl.querySelectorAll('.setting-item')].find(
        (s) => (s as HTMLElement).dataset.name === '新建影视笔记自动抓取海报'
      ) as HTMLElement;
      expect(el).toBeTruthy();
      const toggle = (el as any).__setting.controls[0];
      expect(toggle.disabled).toBe(true);
      const row = (el as any).__setting;
      expect(row.desc).toContain('仅桌面端可用');
    });

    it('桌面端已安装：开关可用；打开 → 注册监听 + 持久化', async () => {
      const node = installNodeMock();
      const { plugin, tab } = await setupSettingsTab(node);
      const el = [...tab.containerEl.querySelectorAll('.setting-item')].find(
        (s) => (s as HTMLElement).dataset.name === '新建影视笔记自动抓取海报'
      ) as HTMLElement;
      const row = (el as any).__setting;
      const toggle = row.controls[0];
      expect(toggle.disabled).toBe(false);
      expect(row.desc).toContain('自动从豆瓣抓取高清海报并补全信息');
      expect(row.desc).not.toContain('未检测到');
      toggle.trigger(true);
      expect(plugin.settings.doubanPosterEnabled).toBe(true);
      expect(diskData['bz'].doubanPosterEnabled).toBe(true);
      expect(plugin.app.vault.listeners['create']).toHaveLength(1);
      // 关闭 → 卸载监听
      toggle.trigger(false);
      expect(plugin.settings.doubanPosterEnabled).toBe(false);
      expect(plugin.app.vault.listeners['create']).toHaveLength(0);
    });

    it('桌面端未安装：开关置灰 + 安装指引', async () => {
      installNodeMock({ execError: true });
      const app = makePluginApp();
      await createPlugin(app);
      const plugin = await createPlugin(app);
      const tab = new BzSettingTab(plugin.app, plugin);
      tab.display();
      const el = [...tab.containerEl.querySelectorAll('.setting-item')].find(
        (s) => (s as HTMLElement).dataset.name === '新建影视笔记自动抓取海报'
      ) as HTMLElement;
      const row = (el as any).__setting;
      expect(row.controls[0].disabled).toBe(true);
      expect(row.desc).toContain(`npm install -g ${PACKAGE_NAME}`);
    });
  });
});

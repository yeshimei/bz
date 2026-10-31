/**
 * 运行时解析（core/tool-runtime.ts）：外部工具「用谁跑」的唯一判据。
 *
 * 两条不变式（对应用户能感知的两种状态，2026-10-28 起**没有 PATH 回落**）：
 *  1. 本地包不在（或包在但机器上没有 Node）→ `via:'none'`、cmd 空串：面板说「未安装」，
 *     起跑前由调用方给「去在线资源下载」的引导——系统 PATH 上有没有同名命令与插件无关；
 *  2. 包 + Node 都在 → 绝对路径 + `shell:false`（路径里的空格/中文/& 不再经过 cmd 解析）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveToolBase,
  resolveToolCommand,
  safeToolBase,
  setFsProbe,
  setToolBaseProbe,
  resetNodeRuntimeCache,
  probeNodeRuntime,
  toolReadyState,
  toolInstallHint,
} from '../../src/core/tool-runtime';

const VAULT = 'E:/vault';
const PLUGIN = 'E:/vault/.obsidian/plugins/bz';

/** 精确命中清单：只让这几条路径「存在」（不能用 startsWith(PLUGIN)——便携 node 也住在 PLUGIN 下） */
function fsWith(paths: string[]): (p: string) => boolean {
  const set = new Set(paths);
  return (p) => set.has(p);
}

function appOf(): unknown {
  return { vault: { adapter: { getBasePath: () => VAULT }, configDir: '.obsidian' } };
}

/** 造一个假的 window.require：`where node` 命中给定路径，`node -v` 回版本串 */
function stubNodeOnPath(nodePath: string | null): void {
  const cp = {
    spawnSync: (cmd: string, args: string[]) => {
      if (cmd === 'where' || cmd === 'which') {
        return nodePath ? { status: 0, stdout: `${nodePath}\n` } : { status: 1, stdout: '' };
      }
      if (args?.[0] === '-v') return { status: 0, stdout: 'v22.22.2\n' };
      return { status: 1, stdout: '' };
    },
  };
  // jsdom 的 window 不可重定义：直接挂 require（tool-runtime 只读这一个属性）
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) => (m === 'child_process' ? cp : null);
}

beforeEach(() => {
  resetNodeRuntimeCache();
  // 缺省：磁盘上什么都没有
  setFsProbe(() => false);
});

afterEach(() => {
  setFsProbe(null);
  resetNodeRuntimeCache();
  delete (window as unknown as { require?: unknown }).require;
});

describe('resolveToolBase：只认本地包', () => {
  it('没包 → via=none、cmd 为空（不再回落 PATH）', () => {
    stubNodeOnPath('C:/nodejs/node.exe');
    const base = resolveToolBase(appOf(), 'bili-downloader');
    expect(base).toEqual({ cmd: '', shell: false, via: 'none' });
  });

  it('包在但没 Node → 也算未就绪（不拿跑不了的本地路径硬上）', () => {
    stubNodeOnPath(null);
    setFsProbe(fsWith([`${PLUGIN}/downloads/tools/bili-downloader/cli.js`]));
    const base = resolveToolBase(appOf(), 'bili-downloader');
    expect(base.via).toBe('none');
    expect(base.cmd).toBe('');
  });

  it('包 + Node 都在 → 绝对路径 + shell:false', () => {
    stubNodeOnPath('C:/nodejs/node.exe');
    setFsProbe(fsWith([`${PLUGIN}/downloads/tools/obsidian-face/bin/bz-face.js`, 'C:/nodejs/node.exe']));
    const base = resolveToolBase(appOf(), 'obsidian-face');
    expect(base).toMatchObject({ cmd: 'C:/nodejs/node.exe', shell: false, via: 'bundle' });
  });
});

describe('resolveToolCommand：业务参数接在入口脚本之后', () => {
  it('本地包：参数数组 = [入口脚本绝对路径, ...业务参数]', () => {
    stubNodeOnPath('C:/nodejs/node.exe');
    setFsProbe(fsWith([`${PLUGIN}/downloads/tools/obsidian-face/bin/bz-face.js`, 'C:/nodejs/node.exe']));
    const r = resolveToolCommand(appOf(), 'obsidian-face', ['sync', '--data-root', 'E:/微信 数据']);
    expect(r.shell).toBe(false);
    expect(r.args[0]).toBe(`${PLUGIN}/downloads/tools/obsidian-face/bin/bz-face.js`);
    // 带空格的路径原样作为**一个** argv 元素（这条正是 shell 口径做不到的）
    expect(r.args.slice(1)).toEqual(['sync', '--data-root', 'E:/微信 数据']);
  });

  it('没包 → 空命令 + via=none（调用方据此拦住，不 spawn）', () => {
    stubNodeOnPath('C:/nodejs/node.exe');
    const r = resolveToolCommand(appOf(), 'bili-downloader', ['--batch', 'b64:xx']);
    expect(r).toMatchObject({ cmd: '', shell: false, via: 'none' });
    expect(r.args).toEqual(['--batch', 'b64:xx']);
  });
});

describe('probeNodeRuntime / toolReadyState', () => {
  it('系统 node 可用 → kind=system 且带版本', () => {
    stubNodeOnPath('C:/nodejs/node.exe');
    setFsProbe((p) => p === 'C:/nodejs/node.exe');
    const rt = probeNodeRuntime(appOf(), { fresh: true });
    expect(rt).toMatchObject({ kind: 'system', path: 'C:/nodejs/node.exe', version: 'v22.22.2' });
  });

  it('插件内便携 node 优先于系统 node', () => {
    stubNodeOnPath('C:/nodejs/node.exe');
    const bundled = `${PLUGIN}/downloads/tools/node-runtime/node.exe`;
    setFsProbe((p) => p === bundled || p === 'C:/nodejs/node.exe');
    const rt = probeNodeRuntime(appOf(), { fresh: true });
    expect(rt.kind).toBe('bundled');
    expect(rt.path).toBe(bundled);
  });

  it('都没有 → none（探测失败不抛错，这是一条正常结局）', () => {
    stubNodeOnPath(null);
    const rt = probeNodeRuntime(appOf(), { fresh: true });
    expect(rt).toMatchObject({ kind: 'none', path: '' });
  });

  it('toolReadyState：整包解完 → via=bundle；半截解包 / 都没有 → via=none', () => {
    stubNodeOnPath('C:/nodejs/node.exe');
    const script = `${PLUGIN}/downloads/tools/dock-watch/cli.js`;
    const marker = `${PLUGIN}/downloads/tools/dock-watch/.bz-bundle.json`;
    // 整包解完 = 入口脚本 + 就绪标记都在
    setFsProbe(fsWith([script, marker, 'C:/nodejs/node.exe']));
    expect(toolReadyState(appOf(), 'dock-watch')).toEqual({ ready: true, via: 'bundle' });

    // 2026-11-01 补的判据：入口脚本落盘了但解包没解完（断网 / 磁盘满 / 路径超 260）——
    // 脚本在、标记不在 → 不算就绪。这是用户报的「检测屏说已下载、内容屏又让下载」
    // 和「下载失败了完成屏还说已下载」的同一个根因。
    setFsProbe(fsWith([script, 'C:/nodejs/node.exe']));
    expect(toolReadyState(appOf(), 'dock-watch')).toEqual({ ready: false, via: 'none' });

    // 有标记但没 node：工具跑不起来，同样不算就绪
    resetNodeRuntimeCache();
    stubNodeOnPath(null);
    setFsProbe(fsWith([script, marker]));
    expect(toolReadyState(appOf(), 'dock-watch')).toEqual({ ready: false, via: 'none' });

    setFsProbe(() => false);
    expect(toolReadyState(appOf(), 'dock-watch')).toEqual({ ready: false, via: 'none' });
  });
});

describe('引导文案', () => {
  it('未安装的指引指向设置面板，而不是一条终端命令', () => {
    const hint = toolInstallHint('obsidian-face');
    expect(hint).toContain('外部工具'); // 2026-10-28 起工具单独成组，不再在「在线资源」里
    expect(hint).not.toContain('npm install');
  });

  it('通用版（不传 id）：external-tool 拦空命令时用它', () => {
    expect(toolInstallHint()).toContain('外部工具');
    expect(toolInstallHint()).toContain('设置');
  });
});

describe('safeToolBase：没有 app 时如实说没有', () => {
  afterEach(() => setToolBaseProbe(null));

  it('拿不到 app → via=none、cmd 空串（不编一条全局命令名出来）', () => {
    expect(safeToolBase('obsidian-face')).toEqual({ cmd: '', shell: false, via: 'none' });
  });

  it('注入缝覆盖解析（纯函数 builder 在单测里靠它，生产不走）', () => {
    setToolBaseProbe(() => ({ cmd: 'bz-face', shell: true, via: 'bundle' }));
    expect(safeToolBase('obsidian-face')).toMatchObject({ cmd: 'bz-face', via: 'bundle' });
  });
});

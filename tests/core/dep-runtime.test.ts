/**
 * core/dep-runtime：Python 与 ffmpeg 是「搬不进插件目录、又必须有」的两样。
 * 这里测**取哪个包、从哪取、怎么判就绪、装不上怎么说话**——真实的 109MB 下载不在这里跑。
 *
 * 与 node-runtime-install 的测试分工一致：纯逻辑与失败路径全部覆盖，
 * 真跑的验证（`ffmpeg -version`）靠 mock 的 spawnSync 代替。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  depArchives,
  depDirAbs,
  ensureDepSettings,
  installDep,
  probeDep,
  setDepFsProbe,
  FFMPEG_VERSION,
  PYTHON_BUILD_TAG,
  PYTHON_VERSION,
} from '../../src/core/dep-runtime';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';

const PLUGIN = 'E:/vault/.obsidian/plugins/bz';

/** 一个「桌面端」app 的最小形状：插件目录能解析、adapter 能写但读不到东西 */
function appOf(): unknown {
  return {
    vault: {
      configDir: '.obsidian',
      adapter: {
        getBasePath: () => 'E:/vault',
        writeBinary: async () => undefined,
        mkdir: async () => undefined,
        rmdir: async () => undefined,
        remove: async () => undefined,
        readBinary: async () => {
          throw new Error('没有缓存');
        },
      },
    },
  };
}

/** 注入 spawnSync：`where`/`which` 与「跑一次拿版本」共用同一个壳，按 cmd 分派 */
function stubExec(fn: (cmd: string, args: string[]) => { status?: number; stdout?: string; stderr?: string }): void {
  (window as unknown as { require?: unknown }).require = (mod: string) =>
    mod === 'child_process' ? { spawnSync: fn } : {};
}

/** 所有 PATH 查找都失败、所有 exe 都跑不出东西 */
function stubNothing(): void {
  stubExec(() => ({ status: 1, stdout: '' }));
}

let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
  setSettingsProvider(() => store as never);
  setSettingsSaver(async () => undefined);
});

afterEach(() => {
  setDepFsProbe(null);
  delete (window as unknown as { require?: unknown }).require;
});

describe('取哪个包', () => {
  it('Python 走 python-build-standalone 的固定 tag：南大镜像 → GitHub → 反代兜底', () => {
    const [plan] = depArchives('python', 'win32', 'x64');
    expect(plan.file).toBe(`cpython-${PYTHON_VERSION}+${PYTHON_BUILD_TAG}-x86_64-pc-windows-msvc-install_only.tar.gz`);
    expect(plan.kind).toBe('tar.gz');
    // 整包展开（标准库 / DLLs / Scripts），不是只抽一个文件
    expect(plan.members).toEqual([]);
    expect(plan.stripPrefix).toBe('python/');
    // 通道顺序 = 2026-11-01 实测速度顺序：南大 3.6 MB/s → GitHub 2.3 MB/s → 反代（可能挂住）
    expect(plan.urls[0]).toContain('mirror.nju.edu.cn');
    expect(plan.urls[0]).toContain(`/${PYTHON_BUILD_TAG}/`); // 按 tag 精确路径，不是 LatestRelease 软链
    expect(plan.urls[1]).toContain('astral-sh/python-build-standalone');
    expect(plan.urls[2]).toContain('gh-proxy.com');
  });

  it('Python 的产物名按平台与架构分派', () => {
    expect(depArchives('python', 'darwin', 'arm64')[0].file).toContain('aarch64-apple-darwin');
    expect(depArchives('python', 'linux', 'x64')[0].file).toContain('x86_64-unknown-linux-gnu');
    expect(depArchives('python', 'win32', 'arm64')[0].file).toContain('aarch64-pc-windows-msvc');
    expect(depArchives('python', 'aix', 'ppc64')).toEqual([]);
  });

  it('ffmpeg 主源是 BtbN（GitHub，快），备源是 gyan 的固定版本（慢但版本锁死）', () => {
    const plans = depArchives('ffmpeg', 'win32', 'x64');
    // 包大 60MB 但链路快一个数量级：实测 GitHub 2.3 MB/s（175MB 约 77 秒）对 gyan 150 KB/s（109MB 要 12 分钟）。
    // 用户感知的是等待时间，不是字节数
    expect(plans[0].file).toBe('ffmpeg-master-latest-win64-lgpl.zip');
    expect(plans[0].urls[0]).toContain('BtbN');
    expect(plans[0].members.map((m) => m.to)).toEqual(['ffmpeg.exe', 'ffprobe.exe']);
    // 备源锁版本号而不是 `ffmpeg-release-essentials.zip`：后者会 303 到带版本号的地址，内容随上游发版漂移
    expect(plans[1].file).toBe(`ffmpeg-${FFMPEG_VERSION}-essentials_build.zip`);
    expect(plans[1].urls[0]).toContain(`ffmpeg-${FFMPEG_VERSION}-essentials_build.zip`);
  });

  it('ffmpeg 在 macOS / Linux 不自装（静态构建是 tar.xz，core/tar 只吃 gz）', () => {
    expect(depArchives('ffmpeg', 'darwin', 'arm64')).toEqual([]);
    expect(depArchives('ffmpeg', 'linux', 'x64')).toEqual([]);
  });

  it('落位与设置键对得上：python.exe / ffmpeg.exe + ffprobe.exe', () => {
    expect(depDirAbs(appOf(), 'python')).toBe(`${PLUGIN}/downloads/tools/python`);
    expect(depDirAbs(appOf(), 'ffmpeg')).toBe(`${PLUGIN}/downloads/tools/ffmpeg`);
  });
});

describe('探测：设置里填的 → 插件内便携 → PATH', () => {
  it('设置里填了有效的绝对路径 → 用它，插件内那份不顶掉它', () => {
    const bundled = `${PLUGIN}/downloads/tools/python/python.exe`;
    const custom = 'D:/Python312/python.exe';
    setDepFsProbe((p) => p === bundled || p === custom);
    stubExec((cmd) => (cmd === 'where' ? { status: 1 } : { status: 0, stdout: 'Python 3.12.4' }));

    store.pythonPath = custom;
    const s = probeDep(appOf(), 'python');
    expect(s.entries[0].path).toBe(custom);
    expect(s.via).toBe('settings');
    expect(s.ok).toBe(true);
  });

  it('设置空 → 插件内便携（并在 ok 时报 bundled）', () => {
    const bundled = `${PLUGIN}/downloads/tools/python/python.exe`;
    setDepFsProbe((p) => p === bundled);
    stubExec((cmd) => (cmd === 'where' ? { status: 1 } : { status: 0, stdout: 'Python 3.12.4' }));

    const s = probeDep(appOf(), 'python');
    expect(s.entries[0].path).toBe(bundled);
    expect(s.via).toBe('bundled');
    expect(s.ok).toBe(true);
  });

  it('两边都没有 → 走 PATH', () => {
    setDepFsProbe(() => false);
    stubExec((cmd) =>
      cmd === 'where' ? { status: 0, stdout: 'C:/Python312/python.exe\n' } : { status: 0, stdout: 'Python 3.12.4' },
    );

    const s = probeDep(appOf(), 'python');
    expect(s.via).toBe('path');
    expect(s.entries[0].path).toBe('C:/Python312/python.exe');
    expect(s.ok).toBe(true);
  });

  it('设置里填的路径不存在 → 记 stale，不静默换成别的还说没问题', () => {
    setDepFsProbe(() => false);
    stubNothing();
    store.pythonPath = 'D:/nope/python.exe';

    const s = probeDep(appOf(), 'python');
    expect(s.ok).toBe(false);
    expect(s.stale).toContain('不存在');
  });

  it('文件在但跑不起来（半截下载 / 被拦截）→ 不算就绪', () => {
    const bundled = `${PLUGIN}/downloads/tools/python/python.exe`;
    setDepFsProbe((p) => p === bundled);
    // 文件在，但执行回不出「Python 3.x」——Windows 应用商店那个占位符就是长这样
    stubExec((cmd) =>
      cmd === 'where'
        ? { status: 1 }
        : { status: 0, stdout: 'Python was not found; run without arguments to install from the Microsoft Store' },
    );

    expect(probeDep(appOf(), 'python').ok).toBe(false);
  });

  it('ffmpeg 要两个入口都跑得起来才算就绪（只有 ffmpeg 没有 ffprobe 的机器很多）', () => {
    const dir = `${PLUGIN}/downloads/tools/ffmpeg`;
    setDepFsProbe((p) => p === `${dir}/ffmpeg.exe`);
    stubExec((cmd, args) => {
      if (cmd === 'where') return { status: 1 };
      return { status: 0, stdout: args[0] === '-version' ? 'ffmpeg version 9.0.2' : '' };
    });

    const s = probeDep(appOf(), 'ffmpeg');
    expect(s.entries.map((e) => e.name)).toEqual(['ffmpeg.exe', 'ffprobe.exe']);
    expect(s.entries[0].path).toBe(`${dir}/ffmpeg.exe`);
    expect(s.ok).toBe(false);
  });
});

describe('设置对齐：装了包必须把绝对路径写进去', () => {
  it('只写空的和失效的键，用户填好的路径一个字都不动', async () => {
    const bundled = `${PLUGIN}/downloads/tools/python/python.exe`;
    const custom = 'D:/Python312/python.exe';
    setDepFsProbe((p) => p === bundled || p === custom);

    store.pythonPath = custom;
    expect(await ensureDepSettings(appOf(), 'python')).toBe(false);
    expect(store.pythonPath).toBe(custom);

    store.pythonPath = '';
    expect(await ensureDepSettings(appOf(), 'python')).toBe(true);
    expect(store.pythonPath).toBe(bundled);
  });

  it('设置指向的文件没了 → 用插件内那份补上（失效配置留着只会让人以为配好了）', async () => {
    const bundled = `${PLUGIN}/downloads/tools/python/python.exe`;
    setDepFsProbe((p) => p === bundled);
    store.pythonPath = 'D:/gone/python.exe';

    expect(await ensureDepSettings(appOf(), 'python')).toBe(true);
    expect(store.pythonPath).toBe(bundled);
  });

  it('插件内没有包 → 什么也不写（探测不到就别装懂）', async () => {
    setDepFsProbe(() => false);
    store.pythonPath = '';
    expect(await ensureDepSettings(appOf(), 'python')).toBe(false);
    expect(store.pythonPath).toBe('');
  });
});

describe('装不上时怎么说话', () => {
  it('所有下载源都失败 → 抛错并带上每个地址的原因', async () => {
    await expect(
      installDep(appOf(), 'python', {
        platform: 'win32',
        arch: 'x64',
        fetchBytes: async (url) => {
          throw new Error(`连不上 ${url.split('/')[2]}`);
        },
      }),
    ).rejects.toThrow(/安装失败.*连不上/);
  });

  it('平台不支持 → 直接说「用包管理器装」，不做无意义的下载', async () => {
    await expect(installDep(appOf(), 'ffmpeg', { platform: 'darwin', arch: 'arm64' })).rejects.toThrow(
      /brew install ffmpeg/,
    );
  });

  it('归档里没有入口文件 → 报「包里没有」，不写一个空文件', async () => {
    // 空 zip（只有目录尾）：能读，但找不到 bin/ffmpeg.exe
    const emptyZip = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await expect(
      installDep(appOf(), 'ffmpeg', {
        platform: 'win32',
        arch: 'x64',
        fetchBytes: async () => emptyZip,
      }),
    ).rejects.toThrow(/里没有 bin\/ffmpeg\.exe/);
  });
});

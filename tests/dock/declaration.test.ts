// @vitest-environment node
/**
 * 声明文件与设置文件测试（工具侧那两份）。
 *
 * 这一层盯着三件事：
 *  1. **读文件不执行任何东西** —— 所以未建立信任也能看清声明内容（D4 修订的整个理由）。
 *     这里的假 fs 只有 read/write/rename 三个面，没有 spawn —— 结构上就不可能执行。
 *  2. **路径补缺省只看声明本身能确定的东西** —— `cwd` 缺省 = 声明文件所在目录，
 *     `shell` 缺省按扩展名判；不猜别的。
 *  3. **设置文件是手可改的** —— 坏 JSON / 版本不符 / `tool` 串台一律当「没有值」，
 *     绝不给一个可能属于别的工具的凭据放行。
 */
import { describe, it, expect } from 'vitest';
import {
  DECLARATION_FILENAME,
  DOCK_SETTINGS_VERSION,
  SETTINGS_FILENAME,
  dirOf,
  joinPath,
  readDeclaration,
  readSettings,
  resolveRun,
  settingsPathFor,
  toolDirOf,
  writeSettings,
  type DockFs,
} from '../../src/dock/declaration';
import type { DockManifest } from '../../src/dock/schema';

/** 内存 fs：只兑现本域用到的三个面（rename 可选 —— 用它与不用它两条路都要能走） */
function memFs(files: Record<string, string> = {}, opts: { rename?: boolean } = {}): DockFs & { files: Record<string, string> } {
  const store: Record<string, string> = { ...files };
  const fs: DockFs & { files: Record<string, string> } = {
    files: store,
    readText: (p) => (p in store ? store[p] : null),
    writeText: (p, d) => {
      store[p] = d;
    },
  };
  if (opts.rename !== false) {
    fs.rename = (from, to) => {
      if (!(from in store)) throw new Error('no such tmp');
      store[to] = store[from];
      delete store[from];
    };
  }
  return fs;
}

const DECL = 'E:/dock-tools/signin/dock.json';

const decl = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ v: 1, id: 'signin', name: '签到', ...over });

// ==================== 路径 ====================

describe('路径助手', () => {
  it('dirOf 取目录，盘符根也认得', () => {
    expect(dirOf('C:/a/b/dock.json')).toBe('C:/a/b');
    expect(dirOf('C:/dock.json')).toBe('C:/');
    expect(dirOf('C:\\a\\b\\dock.json')).toBe('C:/a/b'); // 反斜杠归一
    expect(dirOf('dock.json')).toBe('');
  });

  it('joinPath 归一尾斜杠，空目录直接给文件名', () => {
    expect(joinPath('C:/a/', 'x.json')).toBe('C:/a/x.json');
    expect(joinPath('C:/a', 'x.json')).toBe('C:/a/x.json');
    expect(joinPath('', 'x.json')).toBe('x.json');
  });

  it('两份文件都固定在声明文件同目录（工具目录 = 声明文件所在目录）', () => {
    expect(toolDirOf(DECL)).toBe('E:/dock-tools/signin');
    expect(settingsPathFor(DECL)).toBe(`E:/dock-tools/signin/${SETTINGS_FILENAME}`);
    expect(DECLARATION_FILENAME).toBe('dock.json');
  });
});

// ==================== 启动方式 ====================

describe('resolveRun', () => {
  const m = (run: unknown): DockManifest => ({ v: 1, id: 'signin', name: '签到', params: [], run } as DockManifest);

  it('cwd 缺省 = 声明文件所在目录（整个工具目录搬到哪都不用改配置）', () => {
    const r = resolveRun(m({ cmd: 'node', args: ['signin.mjs'] }), DECL)!;
    expect(r.cwd).toBe('E:/dock-tools/signin');
    expect(r.args).toEqual(['signin.mjs']);
  });

  it('声明写了 cwd 就用它', () => {
    expect(resolveRun(m({ cmd: 'node', cwd: 'C:/elsewhere' }), DECL)!.cwd).toBe('C:/elsewhere');
  });

  it('shell 缺省按扩展名判（Windows 的 .cmd/.bat 不经 shell 起不来）；声明写了就听声明的', () => {
    expect(resolveRun(m({ cmd: 'C:/t/run.cmd' }), DECL)!.shell).toBe(true);
    expect(resolveRun(m({ cmd: 'C:/t/RUN.BAT' }), DECL)!.shell).toBe(true);
    expect(resolveRun(m({ cmd: 'node' }), DECL)!.shell).toBe(false);
    expect(resolveRun(m({ cmd: 'C:/t/run.cmd', shell: false }), DECL)!.shell).toBe(false);
    expect(resolveRun(m({ cmd: 'node', shell: true }), DECL)!.shell).toBe(true);
  });

  it('没有 run 段（或声明读不到）→ null：只能看、不能跑', () => {
    expect(resolveRun(m(undefined), DECL)).toBeNull();
    expect(resolveRun(null, DECL)).toBeNull();
  });
});

// ==================== 读声明 ====================

describe('readDeclaration', () => {
  it('合法声明 → 读出来，且不碰进程（假 fs 结构上就没有 spawn）', () => {
    const fs = memFs({ [DECL]: decl({ run: { cmd: 'node' }, params: [{ key: 'cookie', label: 'Cookie', type: 'secret' }] }) });
    const res = readDeclaration(DECL, fs);
    expect(res.ok).toBe(true);
    expect(res.manifest!.name).toBe('签到');
    expect(res.manifest!.params).toHaveLength(1);
  });

  it('读不到 / 坏 JSON / 校验不过 → ok:false + 人话原因（永不抛）', () => {
    expect(readDeclaration(DECL, memFs({})).ok).toBe(false);
    expect(readDeclaration(DECL, memFs({})).error).toContain('读不到');

    const bad = readDeclaration(DECL, memFs({ [DECL]: '{ not json' }));
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('JSON');

    const invalid = readDeclaration(DECL, memFs({ [DECL]: decl({ id: '../evil' }) }));
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toContain('校验不过');
  });

  it('容忍 UTF-8 BOM（用 PowerShell 手写声明很常见）', () => {
    const fs = memFs({ [DECL]: '\uFEFF' + decl() });
    expect(readDeclaration(DECL, fs).ok).toBe(true);
  });

  it('没有 fs（移动端）→ 明确说需要桌面端，不假装读到了空声明', () => {
    const res = readDeclaration(DECL, null);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('桌面端');
  });
});

// ==================== 参数值 ====================

describe('readSettings / writeSettings', () => {
  const path = settingsPathFor(DECL);

  it('写进去读得回来（且落盘形状带版本与 tool）', () => {
    const fs = memFs({});
    expect(writeSettings(DECL, 'signin', { cookie: 'abc' }, fs)).toBe(true);
    expect(JSON.parse(fs.files[path])).toEqual({
      v: DOCK_SETTINGS_VERSION,
      tool: 'signin',
      values: { cookie: 'abc' },
    });
    expect(readSettings(DECL, 'signin', fs)).toEqual({ cookie: 'abc' });
  });

  it('有 rename 时走 tmp + 改名（不留半截文件）', () => {
    const fs = memFs({});
    writeSettings(DECL, 'signin', { cookie: 'x' }, fs);
    expect(Object.keys(fs.files)).toEqual([path]); // 临时文件已被改名吃掉
  });

  it('没有 rename 也能写（退回直写）', () => {
    const fs = memFs({}, { rename: false });
    expect(writeSettings(DECL, 'signin', { cookie: 'x' }, fs)).toBe(true);
    expect(readSettings(DECL, 'signin', fs)).toEqual({ cookie: 'x' });
  });

  it('tool 串台 → 当没有值（宁可为空让人重填，也不把别人的凭据发出去）', () => {
    const fs = memFs({ [path]: JSON.stringify({ v: 1, tool: 'other', values: { cookie: '别人的' } }) });
    expect(readSettings(DECL, 'signin', fs)).toEqual({});
  });

  it('版本不认识 / 坏 JSON / 读不到 → 空对象，不抛', () => {
    expect(readSettings(DECL, 'signin', memFs({}))).toEqual({});
    expect(readSettings(DECL, 'signin', memFs({ [path]: '{ not json' }))).toEqual({});
    expect(readSettings(DECL, 'signin', memFs({ [path]: JSON.stringify({ v: 9, tool: 'signin', values: { a: 1 } }) }))).toEqual({});
    expect(readSettings(DECL, 'signin', memFs({ [path]: JSON.stringify({ v: 1, tool: 'signin', values: 'x' }) }))).toEqual({});
  });

  it('写失败返回 false 不抛（目录不可写时面板要照常能用）', () => {
    const boom: DockFs = {
      readText: () => null,
      writeText: () => {
        throw new Error('EACCES');
      },
    };
    expect(writeSettings(DECL, 'signin', { a: 1 }, boom)).toBe(false);
    expect(writeSettings(DECL, 'signin', { a: 1 }, null)).toBe(false);
  });
});

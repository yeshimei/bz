// @vitest-environment node
/**
 * 声明文件与设置文件测试（工具侧那两份）。
 *
 * 这一层盯着四件事：
 *  1. **读文件不执行任何东西** —— 所以未建立信任也能看清声明内容（D4 修订的整个理由）。
 *     这里的假 fs 只有 read/write/rename/exists/unlink 几个面，没有 spawn —— 结构上就不可能执行。
 *  2. **路径补缺省只看声明本身能确定的东西** —— `cwd` 缺省 = 声明文件所在目录，
 *     `shell` 缺省按扩展名判；约定入口只认 `main.mjs` 这一个名字；不猜别的。
 *  3. **设置文件是手可改的** —— 坏 JSON / 版本不符 / `tool` 串台一律当「没有值」，
 *     绝不给一个可能属于别的工具的凭据放行。
 *  4. **旧名回落只救「文件不在」**（ADR-0237）—— 新名 `manifest.json` / `data.json` /
 *     `runs.json` 读不到才试旧名；新名在但无效时以新名为准，不绕过它去翻旧名。
 */
import { describe, it, expect } from 'vitest';
import {
  DECLARATION_FILENAME,
  DECLARATION_FILENAME_LEGACY,
  DOCK_SETTINGS_VERSION,
  MAIN_ENTRY_FILENAME,
  SETTINGS_FILENAME,
  RUNS_FILENAME,
  dirOf,
  joinPath,
  readDeclaration,
  readRunsText,
  readSettings,
  resolveRun,
  settingsPathFor,
  toolDirOf,
  writeSettings,
  type DockFs,
} from '../../src/dock/declaration';
import type { DockManifest } from '../../src/dock/schema';

/** 内存 fs：rename / exists / unlink 可选 —— 用与不用各条路都要能走 */
function memFs(
  files: Record<string, string> = {},
  opts: { rename?: boolean; unlink?: boolean; exists?: boolean } = {},
): DockFs & { files: Record<string, string> } {
  const store: Record<string, string> = { ...files };
  const fs: DockFs & { files: Record<string, string> } = {
    files: store,
    readText: (p) => (p in store ? store[p] : null),
    writeText: (p, d) => {
      store[p] = d;
    },
  };
  if (opts.exists !== false) fs.exists = (p) => p in store;
  if (opts.rename !== false) {
    fs.rename = (from, to) => {
      if (!(from in store)) throw new Error('no such tmp');
      store[to] = store[from];
      delete store[from];
    };
  }
  if (opts.unlink !== false) {
    fs.unlink = (p) => {
      if (!(p in store)) throw new Error('no such file');
      delete store[p];
    };
  }
  return fs;
}

const DIR = 'E:/dock-tools/signin';
const DECL = `${DIR}/${DECLARATION_FILENAME}`;
const DECL_LEGACY = `${DIR}/${DECLARATION_FILENAME_LEGACY}`;

const decl = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ v: 1, id: 'signin', name: '签到', ...over });

// ==================== 路径 ====================

describe('路径助手', () => {
  it('dirOf 取目录，盘符根也认得', () => {
    expect(dirOf('C:/a/b/manifest.json')).toBe('C:/a/b');
    expect(dirOf('C:/manifest.json')).toBe('C:/');
    expect(dirOf('C:\\a\\b\\manifest.json')).toBe('C:/a/b'); // 反斜杠归一
    expect(dirOf('manifest.json')).toBe('');
  });

  it('joinPath 归一尾斜杠，空目录直接给文件名', () => {
    expect(joinPath('C:/a/', 'x.json')).toBe('C:/a/x.json');
    expect(joinPath('C:/a', 'x.json')).toBe('C:/a/x.json');
    expect(joinPath('', 'x.json')).toBe('x.json');
  });

  it('两份文件都固定在声明文件同目录（工具目录 = 声明文件所在目录）', () => {
    expect(toolDirOf(DECL)).toBe(DIR);
    expect(settingsPathFor(DECL)).toBe(`${DIR}/${SETTINGS_FILENAME}`);
    expect(DECLARATION_FILENAME).toBe('manifest.json');
    expect(SETTINGS_FILENAME).toBe('data.json');
    expect(RUNS_FILENAME).toBe('runs.json');
    expect(MAIN_ENTRY_FILENAME).toBe('main.mjs');
  });
});

// ==================== 启动方式 ====================

describe('resolveRun', () => {
  const m = (run: unknown): DockManifest => ({ v: 1, id: 'signin', name: '签到', params: [], run } as DockManifest);

  it('cwd 缺省 = 声明文件所在目录（整个工具目录搬到哪都不用改配置）', () => {
    const r = resolveRun(m({ cmd: 'node', args: ['main.mjs'] }), DECL)!;
    expect(r.cwd).toBe(DIR);
    expect(r.args).toEqual(['main.mjs']);
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

  it('约定入口（第三参）：声明没写 run 时用它，shell 恒 false、cwd 照样补缺省', () => {
    const conv = { cmd: 'node', args: ['main.mjs'] };
    const r = resolveRun(m(undefined), DECL, conv)!;
    expect(r).toEqual({ cmd: 'node', args: ['main.mjs'], cwd: DIR, shell: false });
    // 声明自己的 run 永远赢过约定 —— 约定只是缺省
    expect(resolveRun(m({ cmd: 'python', args: ['x.py'] }), DECL, conv)!.cmd).toBe('python');
  });

  it('没有 run 段也没有约定入口（或声明读不到）→ null：只能看、不能跑', () => {
    expect(resolveRun(m(undefined), DECL)).toBeNull();
    expect(resolveRun(null, DECL)).toBeNull();
    expect(resolveRun(null, DECL, { cmd: 'node', args: ['main.mjs'] })).toEqual({
      cmd: 'node',
      args: ['main.mjs'],
      cwd: DIR,
      shell: false,
    });
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

describe('readDeclaration —— 旧名回落（ADR-0237）', () => {
  it('新名不在、旧名在 → 回落读到，path 指向实际文件（旧工具零迁移）', () => {
    const fs = memFs({ [DECL_LEGACY]: decl() });
    const res = readDeclaration(DECL, fs);
    expect(res.ok).toBe(true);
    expect(res.path).toBe(DECL_LEGACY);
    expect(res.manifest!.name).toBe('签到');
  });

  it('登记 path 还挂着旧名、目录里已有新名 → 同样回落，path 指新名', () => {
    const fs = memFs({ [DECL]: decl() });
    const res = readDeclaration(DECL_LEGACY, fs);
    expect(res.ok).toBe(true);
    expect(res.path).toBe(DECL);
  });

  it('两名都在 → 新名说了算（不往回翻旧名）', () => {
    const fs = memFs({ [DECL]: decl({ name: '新版' }), [DECL_LEGACY]: decl({ name: '旧版' }) });
    const res = readDeclaration(DECL, fs);
    expect(res.manifest!.name).toBe('新版');
    expect(res.path).toBe(DECL);
  });

  it('尾名不认识 → 不回落（别的文件名不是声明）', () => {
    const fs = memFs({ [DECL_LEGACY]: decl() });
    const res = readDeclaration('E:/x/other.json', fs);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('读不到');
  });

  it('回落读到的是坏声明 → 报实际路径，不把旧名的事赖到新名头上', () => {
    const fs = memFs({ [DECL_LEGACY]: '{ not json' });
    const res = readDeclaration(DECL, fs);
    expect(res.ok).toBe(false);
    expect(res.error).toContain(DECL_LEGACY);
  });

  it('新名在但坏 JSON、旧名有效 → 不翻旧名（回落只救「文件不在」）', () => {
    const fs = memFs({ [DECL]: '{ not json', [DECL_LEGACY]: decl({ name: '旧版' }) });
    const res = readDeclaration(DECL, fs);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('JSON');
  });
});

describe('readDeclaration —— 约定入口 main.mjs（ADR-0237）', () => {
  const CONV = { cmd: 'node', args: ['main.mjs'] };

  it('声明没写 run 段、目录里有 main.mjs → 给出约定启动方式', () => {
    const fs = memFs({ [DECL]: decl(), [`${DIR}/main.mjs`]: 'console.log(1)' });
    const res = readDeclaration(DECL, fs);
    expect(res.conventionalRun).toEqual(CONV);
    expect(resolveRun(res.manifest!, DECL, res.conventionalRun)).toEqual({
      cmd: 'node',
      args: ['main.mjs'],
      cwd: DIR,
      shell: false,
    });
  });

  it('声明写了 run 段 → 不探测不给约定（声明的永远优先）', () => {
    const fs = memFs({ [DECL]: decl({ run: { cmd: 'python', args: ['x.py'] } }), [`${DIR}/main.mjs`]: 'x' });
    const res = readDeclaration(DECL, fs);
    expect(res.conventionalRun).toBeUndefined();
  });

  it('没写 run 段也没有 main.mjs → 什么都没有（只能看）', () => {
    const fs = memFs({ [DECL]: decl() });
    const res = readDeclaration(DECL, fs);
    expect(res.conventionalRun).toBeUndefined();
    expect(resolveRun(res.manifest!, DECL, res.conventionalRun)).toBeNull();
  });

  it('约定入口只认 main.mjs —— main.js 不算（.js 在无 package.json 的目录里按 CommonJS 解析）', () => {
    const fs = memFs({ [DECL]: decl(), [`${DIR}/main.js`]: 'x' });
    expect(readDeclaration(DECL, fs).conventionalRun).toBeUndefined();
  });

  it('回落命中旧名时，约定入口按实际读到声明的那份目录探测（同一目录，口径一致）', () => {
    const fs = memFs({ [DECL_LEGACY]: decl(), [`${DIR}/main.mjs`]: 'x' });
    const res = readDeclaration(DECL, fs); // 新名不在 → 回落旧名
    expect(res.path).toBe(DECL_LEGACY);
    expect(res.conventionalRun).toEqual({ cmd: 'node', args: ['main.mjs'] });
  });

  it('没有 exists 面的桩 → 探测退回「读一下试试」，约定入口照常发现', () => {
    const fs = memFs({ [DECL]: decl(), [`${DIR}/main.mjs`]: 'x' }, { exists: false });
    expect(readDeclaration(DECL, fs).conventionalRun).toEqual({ cmd: 'node', args: ['main.mjs'] });
  });
});

// ==================== 参数值 ====================

describe('readSettings / writeSettings', () => {
  const path = settingsPathFor(DECL);
  const legacyPath = `${DIR}/dock.settings.json`;

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

describe('参数值 —— 旧名回落与迁移（ADR-0237）', () => {
  const path = settingsPathFor(DECL);
  const legacyPath = `${DIR}/dock.settings.json`;

  it('新名不在、旧名在 → 读到旧值（已有工具的 Cookie 不丢）', () => {
    const fs = memFs({ [legacyPath]: JSON.stringify({ v: 1, tool: 'signin', values: { cookie: '旧值' } }) });
    expect(readSettings(DECL, 'signin', fs)).toEqual({ cookie: '旧值' });
  });

  it('两名都在 → 新名说了算；新名在但无效也不翻旧名（不绕过它说的话）', () => {
    const both = memFs({
      [path]: JSON.stringify({ v: 1, tool: 'signin', values: { cookie: '新值' } }),
      [legacyPath]: JSON.stringify({ v: 1, tool: 'signin', values: { cookie: '旧值' } }),
    });
    expect(readSettings(DECL, 'signin', both)).toEqual({ cookie: '新值' });

    const staleNew = memFs({
      [path]: JSON.stringify({ v: 1, tool: 'other', values: { cookie: '别人的' } }),
      [legacyPath]: JSON.stringify({ v: 1, tool: 'signin', values: { cookie: '旧值' } }),
    });
    expect(readSettings(DECL, 'signin', staleNew)).toEqual({});
  });

  it('写新名成功后清掉旧名残留（同一份凭据不两处落盘）', () => {
    const fs = memFs({ [legacyPath]: JSON.stringify({ v: 1, tool: 'signin', values: { cookie: '旧值' } }) });
    writeSettings(DECL, 'signin', { cookie: '新值' }, fs);
    expect(fs.files[path]).toBeDefined();
    expect(fs.files[legacyPath]).toBeUndefined();
  });

  it('没有 unlink 的桩 → 旧名留着也不出事（读侧永远新名优先）', () => {
    const fs = memFs({ [legacyPath]: 'x' }, { unlink: false });
    writeSettings(DECL, 'signin', { cookie: '新值' }, fs);
    expect(fs.files[legacyPath]).toBe('x');
    expect(readSettings(DECL, 'signin', fs)).toEqual({ cookie: '新值' });
  });

  it('没有 exists 面的桩 → 清理退回「读一下试试」探测，照常清掉旧名', () => {
    const fs = memFs({ [legacyPath]: '旧值' }, { exists: false });
    writeSettings(DECL, 'signin', { cookie: '新值' }, fs);
    expect(fs.files[legacyPath]).toBeUndefined();
    expect(fs.files[path]).toBeDefined();
  });

  it('写失败（目录不可写）不动旧名 —— 旧值是用户唯一的凭据，不能在写失败时丢', () => {
    const legacy = JSON.stringify({ v: 1, tool: 'signin', values: { cookie: '旧值' } });
    const fs = memFs({ [legacyPath]: legacy });
    const boom: DockFs = {
      readText: (p) => (p in fs.files ? fs.files[p] : null),
      exists: (p) => p in fs.files,
      writeText: () => {
        throw new Error('EACCES');
      },
      unlink: (p) => {
        delete fs.files[p];
      },
    };
    expect(writeSettings(DECL, 'signin', { cookie: '新值' }, boom)).toBe(false);
    expect(fs.files[legacyPath]).toBe(legacy);
  });
});

// ==================== 运行记录（只读 + 旧名回落） ====================

describe('readRunsText', () => {
  it('新名在 → 读新名', () => {
    const fs = memFs({ [`${DIR}/runs.json`]: '{"v":1}' });
    expect(readRunsText(DECL, fs)).toBe('{"v":1}');
  });

  it('只有旧名 → 回落读到（工具还没跟新契约时历史不丢）', () => {
    const fs = memFs({ [`${DIR}/dock.runs.json`]: '{"v":1}' });
    expect(readRunsText(DECL, fs)).toBe('{"v":1}');
  });

  it('两名都不在 → null（调用方降级为「还没有记录」，不抛）', () => {
    expect(readRunsText(DECL, memFs({}))).toBeNull();
    expect(readRunsText(DECL, null)).toBeNull();
  });
});

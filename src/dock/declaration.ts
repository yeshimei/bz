/**
 * 声明文件与设置文件 —— **工具侧的两份文件**（spec D4 修订：声明不再靠 `--manifest` 子命令）。
 *
 * | 文件 | 位置 | 谁写 | 内容 |
 * |---|---|---|---|
 * | `dock.json` | 工具目录 | **工具作者**（手写） | 标题 / 描述 / 参数定义 / 节奏 / 启动命令 |
 * | `dock.settings.json` | 工具目录 | **bz**（面板表单） | 用户填的参数**值** |
 *
 * 两条设计意图：
 *
 * 1) **声明文件是元数据的唯一真理源**。bz 不缓存它 —— 缓存会过期，而「过期」这件事本身
 *    就是缺陷的来源（曾经真的发生过：脚本改了声明，vault 里那份旧缓存还在，面板照着旧
 *    缓存渲染出早就删掉的参数）。读文件很便宜，所以直接读。
 *    更要紧的是：**读文件不执行任何东西**，所以「先看清它会跑什么，再决定信不信任」
 *    这个顺序才成立。原先靠 `--manifest` 子命令自描述，就必须先信任才能执行那条命令 ——
 *    等于蒙着眼签字。
 *
 * 2) **参数值住在工具侧**。Cookie 这类凭据不进 vault：不跟着 vault 同步、不进 git、
 *    不落运行记录。bz 只负责按声明的参数表渲染表单、把值写回这个文件，运行前再通过
 *    `--key=value` 下发给进程（工具不必读这个文件 —— 它是 bz 的账本，住得离工具近而已）。
 *
 * fs 走注入缝：插件侧 `window.require('fs')`，评审壳 / node 测试塞假件（本仓既有范式，
 * 见 `people/prep.ts` 的 `PrepFs`）。
 */

import { parseJsonObjectText, parseManifest, type DockManifest, type DockRunSpec } from './schema';

/** 声明文件名（固定在工具目录下；名字是契约的一部分） */
export const DECLARATION_FILENAME = 'dock.json';

/** 参数值文件名（bz 写；固定在声明文件同目录） */
export const SETTINGS_FILENAME = 'dock.settings.json';

/** 运行记录文件名（**工具写、bz 只读**；固定在声明文件同目录 —— spec D10 修订） */
export const RUNS_FILENAME = 'dock.runs.json';

/** 设置文件版本（不认识的版本视为没有值，不猜） */
export const DOCK_SETTINGS_VERSION = 1;

// ==================== fs 缝 ====================

/** 本域所需的最小 fs 面（缺省 = 桌面端 `window.require('fs')`；移动端为 null） */
export interface DockFs {
  /** 读文本；文件不存在 / 读失败返回 null（不抛） */
  readText(path: string): string | null;
  /** 写文本 */
  writeText(path: string, data: string): void;
  /** 原子换名（可选；缺省实现带 renameSync，测试桩可不给 —— 调用方退回直写） */
  rename?(from: string, to: string): void;
}

let injectedFs: DockFs | null | undefined;

/** 注入 fs（评审壳 / 测试；传 undefined 复原真身） */
export function setDockFs(fs: DockFs | null | undefined): void {
  injectedFs = fs;
}

function defaultDockFs(): DockFs | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { require?: (id: string) => unknown };
  if (!w.require) return null;
  try {
    const fs = w.require('fs') as {
      readFileSync(p: string, enc: string): string;
      writeFileSync(p: string, d: string): void;
      existsSync(p: string): boolean;
      renameSync?(a: string, b: string): void;
      unlinkSync?(p: string): void;
    };
    return {
      readText: (p) => {
        try {
          return fs.readFileSync(p, 'utf8');
        } catch {
          return null;
        }
      },
      writeText: (p, d) => fs.writeFileSync(p, d),
      rename:
        typeof fs.renameSync === 'function'
          ? (a, b) => fs.renameSync!(a, b)
          : undefined,
    };
  } catch {
    return null;
  }
}

/** 当前生效的 fs（注入优先，否则真身）；移动端 / 非桌面环境为 null */
export function currentFs(): DockFs | null {
  return injectedFs !== undefined ? injectedFs : defaultDockFs();
}

// ==================== 路径 ====================

/** 取目录部分（`C:/a/b.json` → `C:/a`；`C:/b.json` → `C:/`）。统一成 `/` 分隔。 */
export function dirOf(p: string): string {
  const s = p.replace(/\\/g, '/');
  const i = s.lastIndexOf('/');
  if (i < 0) return '';
  if (i === 0) return '/';
  if (s[i - 1] === ':') return s.slice(0, i + 1); // 盘符根
  return s.slice(0, i);
}

/** 拼一个文件名到目录上（分隔符统一 `/`） */
export function joinPath(dir: string, name: string): string {
  const d = dir.replace(/\\/g, '/').replace(/\/+$/, '');
  return d === '' ? name : `${d}/${name}`;
}

/** 设置文件路径 = 声明文件同目录 + `dock.settings.json` */
export function settingsPathFor(declPath: string): string {
  return joinPath(dirOf(declPath), SETTINGS_FILENAME);
}

/** 运行记录路径 = 声明文件同目录 + `dock.runs.json` */
export function runsPathFor(declPath: string): string {
  return joinPath(dirOf(declPath), RUNS_FILENAME);
}

/** 工具目录（声明文件所在目录） */
export function toolDirOf(declPath: string): string {
  return dirOf(declPath);
}

// ==================== 启动方式 ====================

/** 解析后的启动方式（缺省都补齐了，可以直接喂给 `runExternalTool`） */
export interface ResolvedRun {
  cmd: string;
  args: string[];
  /** 缺省 = 声明文件所在目录 */
  cwd: string | undefined;
  shell: boolean;
}

/**
 * 声明 → 可直接执行的启动方式。`run` 缺省返回 null（声明只能看、不能跑）。
 *
 * 两处补缺省，都**只看声明本身能确定的东西**，不猜：
 *  - `cwd` 缺省 = 声明文件所在目录（工具目录就是这个目录，所以声明里直接写 `signin.mjs` 即可，
 *    整个目录搬到哪都不用改）；
 *  - `shell` 缺省按 `cmd` 扩展名判 —— Windows 的 `.cmd` / `.bat` 不经 shell 起不来
 *    （见 `core/external-tool.ts`），这是「不猜」里唯一一条能从现有信息推出来的。
 */
export function resolveRun(manifest: DockManifest | null, declPath: string): ResolvedRun | null {
  const run: DockRunSpec | undefined = manifest?.run;
  if (!run || !run.cmd) return null;
  return {
    cmd: run.cmd,
    args: [...(run.args ?? [])],
    cwd: run.cwd ?? (dirOf(declPath) || undefined),
    shell: run.shell ?? /\.(cmd|bat)$/i.test(run.cmd),
  };
}

// ==================== 声明读取 ====================

export interface DeclarationRead {
  ok: boolean;
  manifest?: DockManifest;
  /** 失败原因（人话；直接进 UI / 通知） */
  error?: string;
}

/**
 * 读并校验一份声明。**不执行任何东西** —— 所以未建立信任的工具也能先看清它声明了什么。
 * 永不抛：读不到 / 坏 JSON / 版本不认识 / 必填缺失 → `{ ok:false, error }`。
 */
export function readDeclaration(declPath: string, fs: DockFs | null = currentFs()): DeclarationRead {
  if (!fs) return { ok: false, error: '读声明需要桌面端（移动端只读面板）' };
  const text = fs.readText(declPath);
  if (text === null) return { ok: false, error: `声明文件读不到：${declPath}` };

  const raw = parseJsonObjectText(text);
  if (raw === null) return { ok: false, error: `声明文件不是合法 JSON：${declPath}` };

  const manifest = parseManifest(raw);
  if (!manifest) {
    return {
      ok: false,
      error: `声明文件校验不过（v 须为 1、id 只能小写字母数字连字符、name 不能空）：${declPath}`,
    };
  }
  return { ok: true, manifest };
}

// ==================== 参数值（工具侧设置文件） ====================

interface SettingsFile {
  v: number;
  tool: string;
  values: Record<string, unknown>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 读参数值。
 *
 * 读不到 / 坏 JSON / 版本不认识 / `tool` 与调用方期望不符 → 空对象。
 * 最后那一条是**防串台**：设置文件是手可改的，`tool` 不符说明这文件不是给这个工具用的，
 * 拿了就会把别人的凭据发给它。这里宁可为空（用户重填一次），不冒这个险。
 */
export function readSettings(
  declPath: string,
  toolId: string,
  fs: DockFs | null = currentFs(),
): Record<string, unknown> {
  if (!fs) return {};
  const raw = parseJsonObjectText(fs.readText(settingsPathFor(declPath)));
  if (!raw) return {};
  if (raw.v !== DOCK_SETTINGS_VERSION) return {};
  if (raw.tool !== toolId) return {};
  return isPlainObject(raw.values) ? { ...raw.values } : {};
}

/**
 * 写参数值（tmp + rename 原子换名 —— 面板边填边存，写坏一次就等于丢凭据）。
 *
 * 返回是否写成功；失败不抛（面板要照常可用，最多是这次没存住）。
 */
export function writeSettings(
  declPath: string,
  toolId: string,
  values: Record<string, unknown>,
  fs: DockFs | null = currentFs(),
): boolean {
  if (!fs) return false;
  const target = settingsPathFor(declPath);
  const payload: SettingsFile = { v: DOCK_SETTINGS_VERSION, tool: toolId, values };
  const text = JSON.stringify(payload, null, 2);
  try {
    if (fs.rename) {
      const tmp = `${target}.tmp`;
      fs.writeText(tmp, text);
      fs.rename(tmp, target);
    } else {
      fs.writeText(target, text);
    }
    return true;
  } catch {
    return false;
  }
}

// ==================== 运行记录（工具写、bz 只读） ====================

/**
 * 读运行记录原文（**只读** —— 这里刻意没有 write 对应物，bz 一写就成了第二个写者）。
 *
 * 记录住**工具目录**（与声明、参数值同一层）：一个工具的全部数据都在它自己的目录里，
 * 搬走目录就是搬走一切，bz 侧只剩下一条登记项（spec D9/D10 修订）。
 * 读不到 / 读失败 = null，调用方降级为「该工具记录不可读」，绝不抛（同 `parseBzLine` 精神）。
 */
export function readRunsText(declPath: string, fs: DockFs | null = currentFs()): string | null {
  if (!fs) return null;
  return fs.readText(runsPathFor(declPath));
}

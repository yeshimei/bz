/**
 * dock 契约（清单 + 运行记录）的类型与校验。
 *
 * 契约规格见 `.scratch/dock/spec.md` §4。两条铁律：
 *
 *  1) **校验永不抛异常** —— 外部工具的输出是不可信输入。畸形、坏 JSON、缺字段
 *     一律降级为「拒绝这一条」或「跳过这一项」，绝不把异常抛给调用方。
 *     与 `src/core/external-tool.ts` 的 `parseBzLine`「永不抛异常」同口径。
 *  2) **未知字段一律保留**（前向兼容）—— bz 不动、不报错、原样带在结果里，
 *     这样高版本脚本写的清单在被低版本 bz 读到时不会丢信息。
 *
 * 依赖方向：本模块**零 import**（纯函数），node 可直接加载，便于单测。
 */

/** 契约版本。不认识的版本一律拒绝 —— 不猜。 */
export const DOCK_CONTRACT_VERSION = 1;

/**
 * 工具 id 的合法形态。
 * 它同时决定运行记录的文件名，所以必须能安全拼路径：只允许小写字母、数字、连字符，
 * 且不允许以连字符开头（防 `..`、防绝对路径、防盘符）。
 */
export const DOCK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** id 长度上限（防超长文件名） */
export const DOCK_ID_MAX_LEN = 64;

/** ---------- 声明（工具目录里的 `dock.json`） ---------- */

/** 参数类型 → UI 控件的映射见 spec §4.1 */
export type DockParamType =
  | 'text'        // 单行输入
  | 'multiline'   // 多行文本域
  | 'number'      // 数字框
  | 'bool'        // 开关
  | 'choice'      // 单选下拉
  | 'multichoice' // 多选胶囊
  | 'path'        // 文件/目录选择器
  | 'secret';     // 密码框（**不写进运行记录**）

const PARAM_TYPES: ReadonlySet<string> = new Set<DockParamType>([
  'text', 'multiline', 'number', 'bool', 'choice', 'multichoice', 'path', 'secret',
]);

export interface DockParamOption {
  value: string;
  label: string;
}

export interface DockParam {
  key: string;
  label: string;
  type: DockParamType;
  default?: unknown;
  help?: string;
  placeholder?: string;
  required?: boolean;
  /** number 专用 */
  min?: number;
  max?: number;
  step?: number;
  /** multiline 专用 */
  rows?: number;
  /** choice / multichoice 专用 */
  options?: DockParamOption[];
  /** path 专用 */
  mode?: 'file' | 'dir';
}

/** 期望节奏。**可选** —— 缺省时 dock 只展示「最后运行时间」，不判漏跑（spec D11）。 */
export type DockScheduleKind = 'daily' | 'weekly' | 'interval' | 'on-demand' | 'unknown';

const SCHEDULE_KINDS: ReadonlySet<string> = new Set<DockScheduleKind>([
  'daily', 'weekly', 'interval', 'on-demand', 'unknown',
]);

/**
 * 节奏声明（可选，spec D11）。
 *
 * 结构化字段全部**可选**：声明得越细，漏跑判定越准；只写 `kind` 也能用（退化为粗判）。
 * 三条硬约束：① 不认识的 `kind` 视同未声明；② 字段越界（hour 不在 0-23 等）**丢弃该字段**
 * 而不是丢弃整条节奏（少一个字段只是判得粗一点）；③ 判定所需的「期望时刻」全部按**本地时区**。
 */
export interface DockSchedule {
  kind: DockScheduleKind;
  /** 人话注释（如「09:00 起随机 0~2 小时」），仅展示 */
  note?: string;
  /** `daily` 专用：期望在当天何时之前跑完（0-23）。缺省 = 不判「还没到点」，一过零点就算欠 */
  hour?: number;
  /** `weekly` 专用：期望星期几（0=周日 … 6=周六）。缺省 = 只要求「最近 7 天内有」 */
  weekday?: number;
  /** `interval` 专用：期望间隔小时数（> 0）。缺省 = 不判 */
  everyHours?: number;
}

/**
 * 启动方式（声明文件的 `run` 段）。
 *
 * 这一段是「声明文件自包含」的关键 —— 连**怎么跑**都在声明里，所以登记时用户只需要选一个
 * 文件，不用填命令 / 参数 / 工作目录。`args` 里的相对路径由工具自己解析（bz 把声明原样交给
 * 进程）；`cwd` 缺省 = **声明文件所在目录**（由 `declaration.ts` 补齐，不在这里猜）。
 */
export interface DockRunSpec {
  cmd: string;
  args?: string[];
  /** 缺省 = 声明文件所在目录 */
  cwd?: string;
  /** 经 shell 启动（Windows 的 .cmd / .bat 必须开）；缺省按 `cmd` 扩展名自动判 */
  shell?: boolean;
}

export interface DockManifest {
  v: number;
  id: string;
  name: string;
  description?: string;
  author?: string;
  toolVersion?: string;
  /** lucide 名；未知由 UI 回落域图标 */
  icon?: string;
  group?: string;
  desktopOnly?: boolean;
  docs?: string;
  /** 声明它会不会吐 [bz-info] / [bz-result] */
  produces?: string[];
  schedule?: DockSchedule;
  /** 启动方式。缺省 = 这份声明只能看、不能跑（UI 提示「声明里没写怎么跑」） */
  run?: DockRunSpec;
  runtime?: { estimatedSec?: number };
  params: DockParam[];
  /** 未知字段原样保留（前向兼容） */
  [extra: string]: unknown;
}

/** ---------- 运行记录（工具写、dock 读） ---------- */

export type DockRunStatus = 'ok' | 'failed' | 'stopped' | 'running' | 'timeout';

const RUN_STATUSES: ReadonlySet<string> = new Set<DockRunStatus>([
  'ok', 'failed', 'stopped', 'running', 'timeout',
]);

/**
 * 失败分类。这是「汇报完成情况」最值钱的字段 ——
 * 有了它 UI 才能给出**可操作**的提示（`auth` → 去重新导出 cookie），
 * 而不是干巴巴一句「失败了」。
 */
export type DockErrorKind = 'auth' | 'network' | 'config' | 'timeout' | 'aborted' | 'unknown';

const ERROR_KINDS: ReadonlySet<string> = new Set<DockErrorKind>([
  'auth', 'network', 'config', 'timeout', 'aborted', 'unknown',
]);

export interface DockRunStep {
  text: string;
  at?: string;
  status?: string;
}

/** 阶段进度（phase / pct 均可为 null：阶段未知 / 该阶段不可估 —— 绝不假报） */
export interface DockProgress {
  phase: string | null;
  pct: number | null;
}

export interface DockRunRecord {
  runId: string;
  /** auto = 按节奏自动跑（bz 调度器或系统计划任务拉的）；manual = 用户在面板里点的。
   *  注意：在场/离场（有没有实时流）由「谁启动」定，与这个字段无关 —— 见 runner.ts 顶部说明。 */
  trigger: 'auto' | 'manual';
  status: DockRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  exitCode?: number | null;
  /** 给人类看的一句话，UI 主文案 */
  message?: string;
  /** 本次实际参数（`secret` 类型必须已被工具剔除） */
  params?: Record<string, unknown>;
  /** 历史进度靠它 */
  steps?: DockRunStep[];
  progress?: DockProgress;
  /** 脚本给 dock 的结构化数据 —— 离场运行的数据出口 */
  info?: unknown[];
  result?: unknown;
  metrics?: Record<string, number>;
  artifacts?: { path: string; label?: string }[];
  error?: { kind: DockErrorKind; detail?: string; stderr?: string };
  [extra: string]: unknown;
}

export interface DockRunsFile {
  v: number;
  tool: string;
  updatedAt?: string;
  runs: DockRunRecord[];
  [extra: string]: unknown;
}

/** 每工具保留的运行条数上限（spec D13；裁剪由**工具**负责，dock 只检测不修改） */
export const DOCK_RUNS_PER_TOOL_LIMIT = 200;

/** ---------- 基础取值助手（全部不抛） ---------- */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/** 非空字符串（空白视为缺省） */
function nonEmptyStr(v: unknown): string | undefined {
  const s = str(v);
  return s !== undefined && s.trim() !== '' ? s : undefined;
}

/** 闭区间内的整数（越界/非整数返回 undefined —— 由调用方决定丢弃该字段） */
function intInRange(v: unknown, lo: number, hi: number): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined;
}

/**
 * 解析一段 JSON 文本；坏 JSON / 非对象一律 null（不抛）。
 * 兼容 UTF-8 BOM（工具用 PowerShell 写文件时很常见）。
 */
export function parseJsonObjectText(text: string | null | undefined): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (trimmed.trim() === '') return null;
  try {
    const v = JSON.parse(trimmed);
    return isPlainObject(v) ? v : null;
  } catch {
    return null;
  }
}

/** ---------- 声明校验 ---------- */

/** 参数校验：合法则返回归一后的参数，否则 null（**整项丢弃**，不抛） */
export function parseParam(raw: unknown): DockParam | null {
  if (!isPlainObject(raw)) return null;
  const key = nonEmptyStr(raw.key);
  const label = nonEmptyStr(raw.label);
  const type = str(raw.type);
  if (!key || !label || !type || !PARAM_TYPES.has(type)) return null;

  // options 只对 choice / multichoice 有意义；逐项校验，坏项丢弃
  let options: DockParamOption[] | undefined;
  if (type === 'choice' || type === 'multichoice') {
    if (Array.isArray(raw.options)) {
      const kept: DockParamOption[] = [];
      for (const o of raw.options) {
        if (!isPlainObject(o)) continue;
        const value = str(o.value);
        if (value === undefined) continue;
        kept.push({ value, label: nonEmptyStr(o.label) ?? value });
      }
      options = kept;
    }
  }

  const out: DockParam = { key, label, type: type as DockParamType };
  if ('default' in raw) out.default = raw.default;
  const help = nonEmptyStr(raw.help);
  if (help) out.help = help;
  const placeholder = nonEmptyStr(raw.placeholder);
  if (placeholder) out.placeholder = placeholder;
  const required = bool(raw.required);
  if (required !== undefined) out.required = required;
  const min = num(raw.min);
  if (min !== undefined) out.min = min;
  const max = num(raw.max);
  if (max !== undefined) out.max = max;
  const step = num(raw.step);
  if (step !== undefined) out.step = step;
  const rows = num(raw.rows);
  if (rows !== undefined) out.rows = rows;
  if (type === 'path') {
    const mode = str(raw.mode);
    out.mode = mode === 'file' || mode === 'dir' ? mode : 'file';
  }
  if (options) out.options = options;
  return out;
}

/**
 * 节奏校验（从声明或 bz 的覆盖里读一段节奏）。
 *
 * 抽出来给**两处**共用：声明文件的 `schedule`（工具作者的默认值）与登记项里的
 * `scheduleOverride`（用户改过的值）。两处必须同口径 —— 否则「用户改的和作者写的一样，
 * 却被判成不同」这种幽灵差异迟早冒出来。
 *
 * 三条纪律沿用原本内联在 `parseManifest` 里的那套：
 *  - 不认识的 `kind` → 整条作废（返回 undefined），不猜；
 *  - 越界字段（`hour` 不在 0-23 等）→ **逐个丢字段**，节奏本身留下（判得粗一点，不是不判）；
 *  - 永不抛。
 */
export function parseSchedule(raw: unknown): DockSchedule | undefined {
  if (!isPlainObject(raw)) return undefined;
  const kind = str(raw.kind);
  if (!kind || !SCHEDULE_KINDS.has(kind)) return undefined;

  const s: DockSchedule = { kind: kind as DockScheduleKind };
  const note = nonEmptyStr(raw.note);
  if (note) s.note = note;
  const hour = intInRange(raw.hour, 0, 23);
  if (hour !== undefined) s.hour = hour;
  const weekday = intInRange(raw.weekday, 0, 6);
  if (weekday !== undefined) s.weekday = weekday;
  const everyHours = num(raw.everyHours);
  if (everyHours !== undefined && everyHours > 0) s.everyHours = everyHours;
  return s;
}

/**
 * 声明校验（工具目录里那份 `dock.json` 的正文）。
 * 返回 null 的情形：非对象 / `v` 不认识 / `id` 非法 / `name` 空。
 * `params` 里坏的单项**丢弃**而不是整份拒绝 —— 一个写错的参数不该让整个工具消失。
 * `run` 段不合法只丢那段（该工具退化为「只能看，不能跑」），不影响其余元数据。
 */
export function parseManifest(raw: unknown): DockManifest | null {
  if (!isPlainObject(raw)) return null;
  if (raw.v !== DOCK_CONTRACT_VERSION) return null; // 不认识就拒绝，不猜

  const id = str(raw.id);
  if (!id || id.length > DOCK_ID_MAX_LEN || !DOCK_ID_RE.test(id)) return null;

  const name = nonEmptyStr(raw.name);
  if (!name) return null;

  const params: DockParam[] = [];
  if (Array.isArray(raw.params)) {
    const seen = new Set<string>();
    for (const p of raw.params) {
      const parsed = parseParam(p);
      if (!parsed) continue;
      if (seen.has(parsed.key)) continue; // 同 key 只留第一个，后面的丢弃
      seen.add(parsed.key);
      params.push(parsed);
    }
  }

  // 未知字段保留：以原始对象为底再覆写已知字段
  const out: DockManifest = { ...raw, v: DOCK_CONTRACT_VERSION, id, name, params };

  out.description = nonEmptyStr(raw.description);
  out.author = nonEmptyStr(raw.author);
  out.toolVersion = nonEmptyStr(raw.toolVersion);
  out.icon = nonEmptyStr(raw.icon);
  out.group = nonEmptyStr(raw.group);
  out.docs = nonEmptyStr(raw.docs);
  out.desktopOnly = bool(raw.desktopOnly);
  if (Array.isArray(raw.produces)) {
    out.produces = raw.produces.filter((x): x is string => typeof x === 'string');
  }

  // run：唯一决定「能不能跑」的段。`cmd` 空 → 整段丢弃（声明只能看，不能跑）
  // cmd / cwd 额外 trim：它们是路径与可执行名，两头空白永远没有意义，而声明是手写的
  // （其余元数据沿用 nonEmptyStr 的「原样保留」口径，不动）。
  if (isPlainObject(raw.run)) {
    const cmd = nonEmptyStr(raw.run.cmd)?.trim();
    if (cmd) {
      const r: DockRunSpec = { cmd };
      if (Array.isArray(raw.run.args)) {
        const args = raw.run.args.filter((x): x is string => typeof x === 'string');
        if (args.length) r.args = args;
      }
      const cwd = nonEmptyStr(raw.run.cwd)?.trim();
      if (cwd) r.cwd = cwd;
      const shell = bool(raw.run.shell);
      if (shell !== undefined) r.shell = shell;
      out.run = r;
    } else {
      delete out.run;
    }
  } else {
    delete out.run;
  }

  // schedule 抽到 parseSchedule（与登记项的 scheduleOverride 同口径）
  const schedule = parseSchedule(raw.schedule);
  if (schedule) out.schedule = schedule;
  else delete out.schedule; // 形态不合法 / 未声明 → 视同无节奏（只展示最后运行时间）

  if (isPlainObject(raw.runtime)) {
    const estimatedSec = num(raw.runtime.estimatedSec);
    out.runtime = estimatedSec !== undefined && estimatedSec > 0 ? { estimatedSec } : {};
  } else {
    delete out.runtime;
  }

  return out;
}

/** ---------- 运行记录校验 ---------- */

/** 单条运行记录校验：合法返回归一结果，否则 null（丢弃该条，不连累其它） */
export function parseRunRecord(raw: unknown): DockRunRecord | null {
  if (!isPlainObject(raw)) return null;

  const startedAt = nonEmptyStr(raw.startedAt);
  const status = str(raw.status);
  if (!startedAt || !status || !RUN_STATUSES.has(status)) return null;

  const runId = nonEmptyStr(raw.runId) ?? startedAt;
  const trigger = str(raw.trigger) === 'auto' ? 'auto' : 'manual';

  const out: DockRunRecord = { ...raw, runId, trigger, status: status as DockRunStatus, startedAt };

  out.finishedAt = nonEmptyStr(raw.finishedAt);
  if (raw.exitCode === null) out.exitCode = null;
  else out.exitCode = num(raw.exitCode);
  out.durationMs = num(raw.durationMs);
  out.message = nonEmptyStr(raw.message);

  if (isPlainObject(raw.params)) out.params = raw.params;
  else delete out.params;

  if (Array.isArray(raw.steps)) {
    const steps: DockRunStep[] = [];
    for (const s of raw.steps) {
      if (!isPlainObject(s)) continue;
      const text = nonEmptyStr(s.text);
      if (!text) continue;
      const step: DockRunStep = { text };
      const at = nonEmptyStr(s.at);
      if (at) step.at = at;
      const st = nonEmptyStr(s.status);
      if (st) step.status = st;
      steps.push(step);
    }
    if (steps.length) out.steps = steps;
    else delete out.steps;
  } else {
    delete out.steps;
  }

  if (isPlainObject(raw.progress)) {
    const phase = nonEmptyStr(raw.progress.phase) ?? null;
    const pctRaw = raw.progress.pct;
    // pct 允许 null = 该阶段不可估；缺失/非有限数一律归 null（**绝不假报**）
    const pct = typeof pctRaw === 'number' && Number.isFinite(pctRaw) ? pctRaw : null;
    out.progress = { phase, pct };
  } else {
    delete out.progress;
  }

  if (!Array.isArray(raw.info)) delete out.info;
  if (!('result' in raw)) delete out.result;

  if (isPlainObject(raw.metrics)) {
    const metrics: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.metrics)) {
      const n = num(v);
      if (n !== undefined) metrics[k] = n;
    }
    if (Object.keys(metrics).length) out.metrics = metrics;
    else delete out.metrics;
  } else {
    delete out.metrics;
  }

  if (Array.isArray(raw.artifacts)) {
    const artifacts: { path: string; label?: string }[] = [];
    for (const a of raw.artifacts) {
      if (!isPlainObject(a)) continue;
      const path = nonEmptyStr(a.path);
      if (!path) continue;
      const label = nonEmptyStr(a.label);
      artifacts.push(label ? { path, label } : { path });
    }
    if (artifacts.length) out.artifacts = artifacts;
    else delete out.artifacts;
  } else {
    delete out.artifacts;
  }

  if (isPlainObject(raw.error)) {
    const kindRaw = str(raw.error.kind);
    const kind: DockErrorKind =
      kindRaw && ERROR_KINDS.has(kindRaw) ? (kindRaw as DockErrorKind) : 'unknown';
    const error: { kind: DockErrorKind; detail?: string; stderr?: string } = { kind };
    const detail = nonEmptyStr(raw.error.detail);
    if (detail) error.detail = detail;
    const stderr = nonEmptyStr(raw.error.stderr);
    if (stderr) error.stderr = stderr;
    out.error = error;
  } else {
    delete out.error;
  }

  return out;
}

/**
 * 运行记录文件校验。`tool` 必须等于调用方期望的 id —— 防「A 工具的记录文件被
 * 写成 B 的内容」这种串台；不符即整份拒绝。
 */
export function parseRunsFile(raw: unknown, expectToolId?: string): DockRunsFile | null {
  if (!isPlainObject(raw)) return null;
  if (raw.v !== DOCK_CONTRACT_VERSION) return null;

  const tool = str(raw.tool);
  if (!tool) return null;
  if (expectToolId !== undefined && tool !== expectToolId) return null;

  const runs: DockRunRecord[] = [];
  if (Array.isArray(raw.runs)) {
    for (const r of raw.runs) {
      const parsed = parseRunRecord(r);
      if (parsed) runs.push(parsed);
    }
  }

  const out: DockRunsFile = { ...raw, v: DOCK_CONTRACT_VERSION, tool, runs };
  const updatedAt = nonEmptyStr(raw.updatedAt);
  if (updatedAt) out.updatedAt = updatedAt;
  else delete out.updatedAt;
  return out;
}

/** 从记录文件文本解析（坏 JSON / 结构不符一律 null，不抛） */
export function parseRunsFileText(
  text: string | null | undefined,
  expectToolId?: string,
): DockRunsFile | null {
  return parseRunsFile(parseJsonObjectText(text), expectToolId);
}

/** ---------- 参数序列化（清单 → 命令行 argv） ---------- */

/**
 * 把用户在界面填的参数拼成命令行参数表。
 *
 * 约定：`--<key>=<value>`；`bool` 为 true 时发 `--<key>`（无值），false 时**不发**；
 * `multichoice` 重复发同一 key；`secret` 照发（工具需要它）。
 * 值里的引号与反斜杠**不在此处理** —— 是否 `shell:true` 由调用方决定
 * （见 core/external-tool.ts 的 ExternalToolSpec.shell 注释）。
 *
 * 跳过的情形：值等于 undefined / null；空字符串（除非 required）。
 */
export function buildArgs(
  manifest: Pick<DockManifest, 'params'>,
  values: Record<string, unknown>,
): string[] {
  const args: string[] = [];
  for (const p of manifest.params) {
    const v = values[p.key];
    if (v === undefined || v === null) continue;

    if (p.type === 'bool') {
      if (v === true) args.push(`--${p.key}`);
      continue;
    }

    if (p.type === 'multichoice') {
      const list = Array.isArray(v) ? v : [v];
      for (const item of list) {
        const s = String(item);
        if (s !== '') args.push(`--${p.key}=${s}`);
      }
      continue;
    }

    const s = String(v);
    if (s === '' && !p.required) continue;
    args.push(`--${p.key}=${s}`);
  }
  return args;
}

/**
 * 从本次运行的参数里剔除 `secret` —— 运行记录要落盘，密钥不能跟着落（spec §4.1）。
 * 返回新对象，不改原对象。
 */
export function stripSecrets(
  manifest: Pick<DockManifest, 'params'>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const secretKeys = new Set(
    manifest.params.filter((p) => p.type === 'secret').map((p) => p.key),
  );
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (secretKeys.has(k)) continue;
    out[k] = v;
  }
  return out;
}

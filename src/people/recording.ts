/**
 * 补充素材·录音管线驱动（issue 509 / ADR-0212、0213；0214 起工具收编 bz-face 包）。
 *
 * 分工（ADR-0214）：分离 / 转写在 `bz-face rec`、质心构建在 `bz-face refs`
 * （@jwbz/obsidian-face v0.4+，python/bz_rec.py / bz_refs.py——方案 C，funasr 全本地零 API
 * 费），本层只负责——spawn 组装（bz-face + pythonPath 设置键下发）、sidecar
 * （`recordings/<名>.turns.json`）解析与状态归并、文件名时间解析（→ mtime 回落）、
 * 质心参考存在性判断（`<数据根>/voiceprints/<联系人>.npz`，降级阶梯提示）。进度不走
 * stdout 协议：脚本逐阶段把账本写进 sidecar，UI 轮询 sidecar 渲染（挂画谱任务进度块
 * 同位置，不入引擎队列）；聊天仓合并由插件执行（applyRecordingTurnsToMsgs，
 * datasource 层——插件是聊天仓唯一写入者）。
 *
 * 会话口径：一录音一进程，句柄存模块级注册表（stop 可杀）；Obsidian 重启会杀进程，
 * sidecar phase 停在中途 = 「中断可续跑」，续跑由脚本按账本只补缺口。
 */
import { runExternalTool, type ExternalToolHandle, type ExternalToolSpec } from '../core/external-tool';
import { quotePathArg } from './sync';
import type { RecordingTurn } from './datasource';

// ---------------- 路径 ----------------

/** 数据根下联系人录音目录：`<dataRoot>/<talker>/recordings`（原件落位处，vault 外） */
export function recordingsDirOf(dataRoot: string, talker: string): string {
  return `${String(dataRoot ?? '').replace(/[\\/]+$/, '')}/${talker}/recordings`;
}

/** 录音 sidecar：`<dataRoot>/<talker>/recordings/<file>.turns.json`（脚本逐阶段写账本） */
export function recordingSidecarPath(dataRoot: string, talker: string, file: string): string {
  return `${recordingsDirOf(dataRoot, talker)}/${file}.turns.json`;
}

/** 质心参考：`<dataRoot>/voiceprints/<talker>.npz`（bz-face refs 产，随数据根走） */
export function voiceprintRefPath(dataRoot: string, talker: string): string {
  return `${String(dataRoot ?? '').replace(/[\\/]+$/, '')}/voiceprints/${talker}.npz`;
}

// ---------------- spawn 组装 ----------------

export interface BuildRecordingSpecOpts {
  dataRoot: string;
  /** 联系人目录名（质心 npz 键同源） */
  talker: string;
  /** 录音文件名（recordings/ 下） */
  file: string;
  /** Python 命令（pythonPath 设置键；非空才传，缺省跟随 bz-face 默认 python） */
  python?: string;
}

/** `bz-face rec <录音> --data-root … --contact …`（口径同 prep：路径参数包引号，--python 是命令词不包） */
export function buildRecordingSpec(opts: BuildRecordingSpecOpts): ExternalToolSpec {
  const python = opts.python?.trim() || undefined;
  return {
    cmd: 'bz-face',
    args: [
      'rec',
      quotePathArg(opts.file),
      '--data-root',
      quotePathArg(opts.dataRoot),
      '--contact',
      quotePathArg(opts.talker),
      ...(python ? ['--python', python] : []),
    ],
    shell: true,
  };
}

/** `bz-face refs --data-root … --contact …`（质心构建；语音样本不足脚本自行降级 / 跳过） */
export function buildVoiceprintSpec(opts: { dataRoot: string; talker: string; python?: string }): ExternalToolSpec {
  const python = opts.python?.trim() || undefined;
  return {
    cmd: 'bz-face',
    args: [
      'refs',
      '--data-root',
      quotePathArg(opts.dataRoot),
      '--contact',
      quotePathArg(opts.talker),
      ...(python ? ['--python', python] : []),
    ],
    shell: true,
  };
}

// ---------------- sidecar 解析（脚本账本的只读端） ----------------

export type RecordingPhase = 'vad' | 'voiceprint' | 'transcribe' | 'done' | 'error';

export interface RecordingSidecarProgress {
  /** 人话进度行（如 声纹窗 3000/10984） */
  text?: string;
  done?: number;
  total?: number;
}

/** `.turns.json` sidecar（脚本写、插件读；snake_case 字段在此归一成 camelCase） */
export interface RecordingSidecar {
  file?: string;
  contact?: string;
  phase: RecordingPhase;
  /** phase=error 时的中文/工具原因 */
  error?: string;
  /** 录音总时长（秒） */
  durationSec?: number;
  /** 质心模式：dual / me-only / blind（降级阶梯诊断，ADR-0213） */
  mode?: string;
  speakersSec?: Record<string, number>;
  progress?: RecordingSidecarProgress;
  turns?: RecordingTurn[];
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function parseTurns(raw: unknown): RecordingTurn[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const turns: RecordingTurn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const start = num(o.start) ?? 0;
    turns.push({
      start,
      end: num(o.end) ?? start,
      speaker: str(o.speaker) ?? '?',
      ...(str(o.emotion) ? { emotion: str(o.emotion) } : {}),
      text: typeof o.text === 'string' ? o.text : '',
      ...(num(o.mean_abs_llr) !== undefined ? { meanAbsLlr: num(o.mean_abs_llr) } : {}),
    });
  }
  return turns;
}

/** sidecar JSON 文本 → 结构（坏 JSON / 缺 phase 回落 null = 视同未处理；永不抛） */
export function parseRecordingSidecar(text: string): RecordingSidecar | null {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  const phase = str(o.phase) as RecordingPhase | undefined;
  if (!phase || !['vad', 'voiceprint', 'transcribe', 'done', 'error'].includes(phase)) return null;
  const speakers = o.speakers_sec;
  const turnsParsed = parseTurns(o.turns);
  return {
    ...(str(o.file) ? { file: str(o.file) } : {}),
    ...(str(o.contact) ? { contact: str(o.contact) } : {}),
    phase,
    ...(str(o.error) ? { error: str(o.error) } : {}),
    ...(num(o.duration_sec) !== undefined ? { durationSec: num(o.duration_sec) } : {}),
    ...(str(o.mode) ? { mode: str(o.mode) } : {}),
    ...(speakers && typeof speakers === 'object' && !Array.isArray(speakers)
      ? { speakersSec: Object.fromEntries(Object.entries(speakers as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as Record<string, number> }
      : {}),
    ...(o.progress && typeof o.progress === 'object' ? { progress: o.progress as RecordingSidecarProgress } : {}),
    ...(turnsParsed ? { turns: turnsParsed } : {}),
  };
}

/** sidecar 进度 → 百分比（0-100；无账本 / total 无效返回 null = 不可估，绝不假报） */
export function recordingPhasePct(s: RecordingSidecar | null): number | null {
  const total = s?.progress?.total;
  const done = s?.progress?.done;
  if (!Number.isFinite(total) || (total as number) <= 0 || !Number.isFinite(done)) return null;
  return Math.max(0, Math.min(100, Math.round(((done as number) / (total as number)) * 100)));
}

/** 录音条目状态（合并 sidecar 与仓事实）：
 *  merged = 仓里已有本录音轮次（权威，重跑中除外）；running-phase = sidecar 停在处理中
 *  （配合注册表区分手上的 / 中断的）；failed / done / pending 同名。 */
export type RecordingItemState = 'pending' | 'running-phase' | 'interrupted' | 'failed' | 'merged';

export function recordingItemState(sidecar: RecordingSidecar | null, mergedInStore: boolean): RecordingItemState {
  if (mergedInStore) return 'merged';
  if (!sidecar) return 'pending';
  switch (sidecar.phase) {
    case 'done':
      return 'merged'; // done 而仓里没有：编排层并入动作紧随其后，UI 短暂同义
    case 'error':
      return 'failed';
    case 'vad':
    case 'voiceprint':
    case 'transcribe':
      return 'interrupted'; // 手上的进程由 UI 以注册表状态优先显示
  }
}

// ---------------- 文件名时间解析（ts = 文件名 → mtime 回落） ----------------

/**
 * 录音文件名时间解析（509：ts 文件名解析优先 → mtime 回落）。
 * 认三种常见导出名：`20260923_001830`（紧凑 8 位日期 + 4/6 位时间，分隔符任意）、
 * `2026-09-23 00.18.30`（分隔日期）、`2026年9月23日 0点18分`（中文）。
 * 无日期不猜（如「周二 00点18分」）→ null。
 */
export function parseRecordingFilenameTs(fileName: string): number | null {
  const base = String(fileName ?? '').replace(/\.[^.]+$/, ''); // 剥扩展名
  const zh = /(20\d{2})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[点时](\d{2})分?(?:(\d{2})秒)?/.exec(base);
  if (zh) {
    return composeTs(Number(zh[1]), Number(zh[2]), Number(zh[3]), Number(zh[4]), Number(zh[5]), zh[6] ? Number(zh[6]) : 0);
  }
  let y: number;
  let mo: number;
  let d: number;
  let rest: string;
  const compact = /20\d{6}/.exec(base);
  const sep = /20\d{2}[-_.]\d{1,2}[-_.]\d{1,2}/.exec(base);
  if (compact) {
    y = Number(compact[0].slice(0, 4));
    mo = Number(compact[0].slice(4, 6));
    d = Number(compact[0].slice(6, 8));
    rest = base.slice(compact.index + 8);
  } else if (sep) {
    const parts = sep[0].split(/[-_.]/);
    y = Number(parts[0]);
    mo = Number(parts[1]);
    d = Number(parts[2]);
    rest = base.slice(sep.index + sep[0].length);
  } else {
    return null;
  }
  const tm = /(\d{1,2})\D?(\d{2})(?:\D?(\d{2}))?/.exec(rest.replace(/^\D+/, ''));
  return composeTs(y, mo, d, tm ? Number(tm[1]) : 0, tm ? Number(tm[2]) : 0, tm && tm[3] ? Number(tm[3]) : 0);
}

function composeTs(y: number, mo: number, d: number, h: number, mi: number, s: number): number | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const t = new Date(y, mo - 1, d, h, mi, s).getTime();
  // roundtrip 校验：20260230 这类不存在的日子会被 Date 滚进下月，按无效处理
  if (!Number.isFinite(t) || new Date(t).getDate() !== d) return null;
  return t;
}

/** 录音 ts 三级回落：文件名 → mtime → now（永不返回无效值） */
export function recordingTsOf(fileName: string, mtimeMs?: number, nowMs?: number): number {
  const fromName = parseRecordingFilenameTs(fileName);
  if (fromName !== null) return fromName;
  if (typeof mtimeMs === 'number' && Number.isFinite(mtimeMs) && mtimeMs > 0) return Math.round(mtimeMs);
  return Math.round(nowMs ?? Date.now());
}

// ---------------- 质心参考与 fs 探测 ----------------

/** 桌面端 fs（同 datasource 口径；非桌面端 null） */
function getFs(): any {
  const w = typeof window === 'undefined' ? null : (window as any);
  if (!w || !w.require) return null;
  try {
    return w.require('fs');
  } catch {
    return null;
  }
}

/** 质心参考就绪态：npz 在 = ready（dual 或 me-only 由脚本读时自判）；缺 = missing（将降级） */
export function voiceprintRefStatus(dataRoot: string, talker: string): 'ready' | 'missing' {
  const fs2 = getFs();
  if (!fs2) return 'missing';
  try {
    return fs2.existsSync(voiceprintRefPath(dataRoot, talker)) ? 'ready' : 'missing';
  } catch {
    return 'missing';
  }
}

/** 录音 sidecar 文本读取（缺文件 / IO 失败 → null = 未处理过） */
export function readRecordingSidecar(dataRoot: string, talker: string, file: string): RecordingSidecar | null {
  const fs2 = getFs();
  if (!fs2) return null;
  try {
    if (!fs2.existsSync(recordingSidecarPath(dataRoot, talker, file))) return null;
    return parseRecordingSidecar(fs2.readFileSync(recordingSidecarPath(dataRoot, talker, file), 'utf8'));
  } catch {
    return null;
  }
}

/** 仓里是否已并过该录音的轮次（merged 的权威判据：key 前缀 rec:<file>:） */
export function hasRecordingTurns(msgs: Array<{ key: string }>, file: string): boolean {
  const prefix = `rec:${String(file ?? '').trim()}:`;
  return msgs.some((m) => m.key.startsWith(prefix));
}

// ---------------- 进程注册表（一录音一进程；杀 / 重启） ----------------

/** 进程壳注入缝（测试打桩；生产 = core/external-tool 的 runExternalTool） */
export type RecordingRunner = typeof runExternalTool;
let runner: RecordingRunner = runExternalTool;

/** 测试注入缝：替换 / 还原进程壳 */
export function setRecordingRunnerForTests(fn: RecordingRunner | null): void {
  runner = fn ?? runExternalTool;
}

const running = new Map<string, { handle: ExternalToolHandle; talker: string; file: string }>();

/** 该录音（按 sidecar 路径键）是否手上有进程在跑 */
export function isRecordingRunning(sidecarPath: string): boolean {
  return running.has(sidecarPath);
}

/** 手上在跑的录音任务（进度块位置渲染用：面板重开后也要能列出来） */
export function runningRecordingItems(): Array<{ path: string; talker: string; file: string }> {
  return [...running.entries()].map(([path, v]) => ({ path, talker: v.talker, file: v.file }));
}

/** 手上在跑的录音任务数（UI 汇总提示用） */
export function runningRecordingCount(): number {
  return running.size;
}

/**
 * 起一条录音 / 质心构建进程（幂等护栏：同 key 已在跑则不起第二条）。
 * onExit 在进程终结后回调（成功 / 失败 / 停止），注册表条目先摘除。
 */
export function startRecordingTask(
  spec: ExternalToolSpec,
  key: string,
  onExit?: (outcome: { ok: boolean; stopped: boolean; error: string }) => void,
  meta?: { talker: string; file: string }
): void {
  if (running.has(key)) return;
  const handle = runner(spec, { onStep: () => {}, onProgress: () => {}, onInfo: () => {}, onResult: () => {} });
  running.set(key, { handle, talker: meta?.talker ?? '', file: meta?.file ?? '' });
  void handle.done.then((outcome) => {
    running.delete(key);
    onExit?.({ ok: outcome.ok, stopped: outcome.stopped, error: outcome.error?.message ?? '' });
  });
}

/** 停掉该键的在跑进程（幂等；不在跑 = no-op） */
export function stopRecordingTask(key: string): void {
  running.get(key)?.handle.stop();
}

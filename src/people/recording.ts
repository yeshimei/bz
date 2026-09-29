/**
 * 补充素材·录音管线驱动（issue 509 / ADR-0212、0213；0214 起工具收编 bz-face 包，510 起对齐 prep）。
 *
 * 分工（ADR-0214）：分离 / 转写在 `bz-face rec`、质心构建在 `bz-face refs`
 * （@jwbz/obsidian-face v0.5+，python/bz_rec.py / bz_refs.py——方案 C，funasr 全本地零 API
 * 费），本层只负责——spawn 组装（bz-face + pythonPath / ffmpegPath 设置键下发）、
 * capabilities 版本门（起跑前探一次包版本，旧版给人话引导而非跑到一半报「未知命令」）、
 * sidecar（`recordings/<名>.turns.json`）解析与状态归并、文件名时间解析（→ mtime 回落）、
 * 质心参考存在性判断（`<数据根>/voiceprints/<联系人>.npz`，降级阶梯提示）。进度不走
 * stdout 协议：脚本逐阶段把账本写进 sidecar，UI 轮询 sidecar 渲染（挂画谱任务进度块
 * 同位置，不入引擎队列）；聊天仓合并由插件执行（applyRecordingTurnsToMsgs，
 * datasource 层——插件是聊天仓唯一写入者）。
 *
 * 会话口径：一录音一进程，句柄存模块级注册表；「停止」是协作式的——写该任务专属的
 * `<数据根>/.bz-face/rec-control/<联系人>/<文件名>.control.json`（按任务派生，并发录音
 * 互不串台，与 prep 的 control.json 亦无共享），脚本在安全点留账本退出（模型不卸载也不丢
 * 进度），90 秒未退才兜底杀；Obsidian 重启会杀进程，sidecar phase 停在中途 = 「中断可续跑」，
 * 续跑由脚本按账本只补缺口。
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
  /** ffmpeg 命令 / 路径（ffmpegPath 设置键；非空才传，缺省跟随脚本默认 ffmpeg） */
  ffmpeg?: string;
}

/** `bz-face rec <录音> --data-root … --contact …`（口径同 prep：路径参数包引号，--python 是命令词不包） */
export function buildRecordingSpec(opts: BuildRecordingSpecOpts): ExternalToolSpec {
  const python = opts.python?.trim() || undefined;
  const ffmpeg = opts.ffmpeg?.trim() || undefined;
  return {
    cmd: 'bz-face',
    args: [
      'rec',
      quotePathArg(opts.file),
      '--data-root',
      quotePathArg(opts.dataRoot),
      '--contact',
      quotePathArg(opts.talker),
      ...(ffmpeg ? ['--ffmpeg', quotePathArg(ffmpeg)] : []),
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

// ---------------- 阶段链（issue 511：完整进度与过程信息） ----------------

/** 录音处理阶段：load = 进程在跑但 sidecar 还没本轮第一笔账（模型冷加载，分钟级） */
export type RecordingStage = 'load' | 'vad' | 'voiceprint' | 'transcribe';

/**
 * 当前阶段判定（running 行与进度块共用单源）：进程在跑由调用方保证；
 * sidecarFresh 由 UI 判（账本 mtime ≥ 起跑时刻）——sidecar 缺席 / 上一轮的 done / error
 * 余账都算 load（本轮还没写到第一笔）；done 在 fresh 下归 transcribe（完成瞬间由
 * onExit 重画行状态，轮询帧内短暂可见不算撒谎）。
 */
export function recordingStageOf(side: RecordingSidecar | null, sidecarFresh: boolean): RecordingStage {
  if (!sidecarFresh || !side) return 'load';
  if (side.phase === 'vad' || side.phase === 'voiceprint') return side.phase;
  if (side.phase === 'transcribe' || side.phase === 'done') return 'transcribe';
  return 'load';
}

/** 耗时人话（进度行「已 …」用）：`45s` / `3m12s`；负值按 0 */
export function formatRecElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
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

// ---------------- 协作式控制文件（按任务独立；issue 510 对齐 prep） ----------------

/**
 * 协作式控制文件：`<数据根>/.bz-face/rec-control/<联系人>/<文件名>.control.json`。
 * **按任务派生**——并发多条录音互不串台（停 A 不动 B，B 的起跑清理也吞不掉 A 的 stop），
 * 与 prep 的 control.json 亦无共享。
 */
export function recControlFilePath(dataRoot: string, talker: string, file: string): string {
  const base = String(dataRoot ?? '').replace(/[\\/]+$/, '');
  return `${base}/.bz-face/rec-control/${talker}/${file}.control.json`;
}

/** 测试注入缝（fs 读写；null 还原 = window.require('fs')） */
let recFsOverride: any = null;

/** 测试注入缝：替换 / 还原控制文件用的 fs */
export function setRecordingFsForTests(fs2: any): void {
  recFsOverride = fs2;
}

function controlFs(): any {
  if (recFsOverride) return recFsOverride;
  const w = typeof window === 'undefined' ? null : (window as any);
  if (!w || !w.require) return null;
  try {
    return w.require('fs');
  } catch {
    return null;
  }
}

/** 写协作控制指令（stop；保留 resume/pause 形参以对齐 prep 契约）。写失败只告警返回 false——控制通道失联不中断任务，兜底杀在 stopRecordingTask 里等着。 */
export function writeRecControl(dataRoot: string, action: 'pause' | 'resume' | 'stop', talker: string, file: string): boolean {
  const fs2 = controlFs();
  const p = recControlFilePath(dataRoot, talker, file);
  if (!fs2 || !dataRoot || !talker || !file) return false;
  try {
    fs2.mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true });
    fs2.writeFileSync(p, `${JSON.stringify({ action })}\n`, 'utf8');
    return true;
  } catch (e) {
    console.warn('[people] 写录音控制文件失败:', e);
    return false;
  }
}

/** 清掉控制文件（起跑前防陈旧 stop、终结后防残留 pause）；缺文件 / IO 失败都算清完 */
export function clearRecControl(dataRoot: string, talker: string, file: string): void {
  const fs2 = controlFs();
  if (!fs2 || !dataRoot || !talker || !file) return;
  try {
    fs2.rmSync(recControlFilePath(dataRoot, talker, file), { force: true });
  } catch {
    /* 尽力而为 */
  }
}

// ---------------- capabilities 版本门（issue 510：旧版 bz-face 给人话引导，不跑到一半才炸） ----------------

/** 本机 bz-face 能力声明（capabilities 子命令的 [bz-result] 体） */
export interface FaceCapabilities {
  version: string;
  commands: string[];
}

/** 会话级缓存：undefined = 未探测；null = 探测过但失败（bz-face 缺失 / 太旧无此命令） */
let capsCache: FaceCapabilities | null | undefined;

/** 测试注入缝：清 capabilities 缓存 */
export function resetFaceCapabilitiesForTests(): void {
  capsCache = undefined;
}

/**
 * 探一次本机 bz-face 能力（会话级缓存；rec / refs 起跑前调用）。探测失败（命令缺失 /
 * 退出非 0 / 没有 [bz-result] 行）返回 null = 能力未知——调用方放行，让真实 spawn 自己
 * 报错，不双重报错。
 */
export async function probeFaceCapabilities(): Promise<FaceCapabilities | null> {
  if (capsCache !== undefined) return capsCache;
  let resultBody: Record<string, unknown> | null = null;
  const handle = runner({ cmd: 'bz-face', args: ['capabilities'], shell: true }, {
    onStep: () => {},
    onProgress: () => {},
    onInfo: () => {},
    onResult: (data) => {
      resultBody = data;
    },
  });
  const outcome = await handle.done;
  if (!outcome.ok || !resultBody || typeof resultBody !== 'object') {
    capsCache = null;
    return capsCache;
  }
  const body = resultBody as Record<string, unknown>;
  const version = typeof body.version === 'string' ? body.version : '';
  const commands = Array.isArray(body.commands) ? body.commands.filter((c): c is string => typeof c === 'string') : [];
  if (!version || !commands.length) {
    capsCache = null;
    return capsCache;
  }
  capsCache = { version, commands };
  return capsCache;
}

/** 点分版本 → [major, minor]（畸形段按 0；只够版本门比较用，不做完整 semver） */
function minorVersionOf(v: string): [number, number] {
  const parts = String(v ?? '').split('.').map((x) => parseInt(x, 10) || 0);
  return [parts[0] || 0, parts[1] || 0];
}

/**
 * rec / refs 的版本门（纯函数）：caps = null（能力未知）→ 放行返回 null；
 * 版本 < 0.5 或 commands 缺 rec → 中文升级指引；否则 null = 放行。
 */
export function faceRecSupportError(caps: FaceCapabilities | null): string | null {
  if (!caps) return null;
  const [maj, min] = minorVersionOf(caps.version);
  const tooOld = maj === 0 && min < 5; // v0.5 = 510 修复收编缺陷的起线；0.10 / 1.x 都不算旧
  if (tooOld || !caps.commands.includes('rec')) {
    // 本包不发公开 registry——npm update 拉不到，指 npm link / 仓内路径重装
    return `本机 bz-face（v${caps.version}）过旧：录音分离 / 声纹构建需要 v0.5+——本包不发 registry，请在包目录 tools/obsidian-face 重新 npm link（或 npm install -g <仓库>/tools/obsidian-face）后重试`;
  }
  return null;
}

// ---------------- 进程注册表（一录音一进程；协作停止 / 兜底杀） ----------------

/** 进程壳注入缝（测试打桩；生产 = core/external-tool 的 runExternalTool） */
export type RecordingRunner = typeof runExternalTool;
let runner: RecordingRunner = runExternalTool;

/** 测试注入缝：替换 / 还原进程壳 */
export function setRecordingRunnerForTests(fn: RecordingRunner | null): void {
  runner = fn ?? runExternalTool;
}

const running = new Map<string, { handle: ExternalToolHandle; talker: string; file: string; startedAt: number }>();

/** 该录音（按 sidecar 路径键）是否手上有进程在跑 */
export function isRecordingRunning(sidecarPath: string): boolean {
  return running.has(sidecarPath);
}

/** 手上在跑的录音任务（进度块位置渲染用：面板重开后也要能列出来；startedAt 供进度行算已耗时） */
export function runningRecordingItems(): Array<{ path: string; talker: string; file: string; startedAt: number }> {
  return [...running.entries()].map(([path, v]) => ({ path, talker: v.talker, file: v.file, startedAt: v.startedAt }));
}

/** 手上在跑的录音任务数（UI 汇总提示用） */
export function runningRecordingCount(): number {
  return running.size;
}

/** 协作停止的兜底等待（毫秒）：控制文件写了但脚本最迟在下一个安全点（一轮转写 ≈ 半分钟内）就会退；超时仍未退 = 控制通道失联，兜底杀 */
const COOP_STOP_KILL_MS = 90000;

/**
 * 起一条录音 / 质心构建进程（幂等护栏：同 key 已在跑则不起第二条）。
 * meta 齐备（dataRoot + talker + file）就按任务管理控制文件：起跑前清陈旧指令（残留 stop
 * 会让脚本一启动就退），终结后再清一次。onExit 在进程终结后回调（成功 / 失败 / 停止），
 * 注册表条目先摘除。
 */
export function startRecordingTask(
  spec: ExternalToolSpec,
  key: string,
  onExit?: (outcome: { ok: boolean; stopped: boolean; error: string }) => void,
  meta?: { talker: string; file: string; dataRoot?: string }
): void {
  if (running.has(key)) return;
  if (meta?.dataRoot && meta.talker && meta.file) clearRecControl(meta.dataRoot, meta.talker, meta.file);
  const handle = runner(spec, { onStep: () => {}, onProgress: () => {}, onInfo: () => {}, onResult: () => {} });
  running.set(key, { handle, talker: meta?.talker ?? '', file: meta?.file ?? '', startedAt: Date.now() });
  void handle.done.then((outcome) => {
    running.delete(key);
    if (meta?.dataRoot && meta.talker && meta.file) clearRecControl(meta.dataRoot, meta.talker, meta.file);
    onExit?.({ ok: outcome.ok, stopped: outcome.stopped, error: outcome.error?.message ?? '' });
  });
}

/**
 * 停掉该键的在跑进程（幂等；不在跑 = no-op）。
 * opts 齐备（dataRoot + talker + file）→ 协作式停止：写该任务专属的 rec-control 文件让
 * 脚本在安全点留账本退出（模型不卸载、进度不丢，且并发录音互不波及），90 秒未退才兜底杀；
 * 不齐备（旧口径 / refs / 无数据根）→ 直接杀。
 */
export function stopRecordingTask(key: string, opts?: { dataRoot?: string; talker?: string; file?: string }): void {
  const entry = running.get(key);
  if (!entry) return;
  const coop = !!opts?.dataRoot && !!opts.talker && !!opts.file;
  if (!coop || !writeRecControl(opts!.dataRoot!, 'stop', opts!.talker!, opts!.file!)) {
    entry.handle.stop();
    return;
  }
  const timer = setTimeout(() => {
    if (running.has(key)) entry.handle.stop();
  }, COOP_STOP_KILL_MS);
  void entry.handle.done.then(() => clearTimeout(timer));
}

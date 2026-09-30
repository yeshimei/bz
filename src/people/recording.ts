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
import { notice } from '../core/notice';
import { preemptHeavyStandby, releaseHeavy, waitHeavyGate } from './heavy-gate';
import { quotePathArg, quotePythonArg } from './sync';
import { recordingTurnSegments, type RecordingTurn } from './datasource';

// ---------------- 路径 ----------------

/** 数据根下联系人录音目录：`<dataRoot>/<talker>/recordings`（原件落位处，vault 外） */
export function recordingsDirOf(dataRoot: string, talker: string): string {
  return `${String(dataRoot ?? '').replace(/[\\/]+$/, '')}/${talker}/recordings`;
}

/** 录音 sidecar：`<dataRoot>/<talker>/recordings/<file 去扩展名>.turns.json`。
 *  命名口径对齐 bz_rec.py（os.path.splitext(src)[0] + '.turns.json'，issue 512）——
 *  此前插件不剥扩展名（`大琳.aac.turns.json` vs 磁盘 `大琳.turns.json`），
 *  账本永远读不到：状态恒「待处理」、预检恒放行、进度不显、并仓通道整体失灵。 */
export function recordingSidecarPath(dataRoot: string, talker: string, file: string): string {
  return `${recordingsDirOf(dataRoot, talker)}/${recordingStem(file)}.turns.json`;
}

/** 录音起点等插件侧一等数据的落点：`<dataRoot>/<talker>/recordings/<名>.meta.json`。
 *  插件写、插件读，**不进 sidecar**（ADR-0217）——sidecar 是脚本账本，而「要重转就删
 *  `.turns.json`」会连起点一起删掉；起点是用户确认过的输入，不该被「重转」清掉。 */
export function recordingMetaPath(dataRoot: string, talker: string, file: string): string {
  return `${recordingsDirOf(dataRoot, talker)}/${recordingStem(file)}.meta.json`;
}

/** 逐轮时间轴（人类可读，插件写；含旁音轮以便复核，ADR-0217） */
export function recordingTurnsMdPath(dataRoot: string, talker: string, file: string): string {
  return `${recordingsDirOf(dataRoot, talker)}/${recordingStem(file)}.turns.md`;
}

/**
 * `recordings/` 下的**派生物后缀**（不是录音原件）——列目录时必须在**此处单源**过滤，
 * 否则 meta / sidecar / 时间轴 / 半截 tmp 会被当成录音列进 UI（ADR-0217 后果节）。
 * 新后缀往这里加，别在调用点各自 endsWith。
 */
export const RECORDING_DERIVED_SUFFIXES = ['.turns.json', '.meta.json', '.turns.md', '.tmp'] as const;

/** 该文件名是否录音原件（非派生物）。空名 / 派生物后缀 → false。 */
export function isRecordingFile(name: string): boolean {
  const f = String(name ?? '');
  return !!f && !RECORDING_DERIVED_SUFFIXES.some((s) => f.endsWith(s));
}

/** 录音词干（剥最后一段扩展名，与 sidecar / meta / turns.md 同口径） */
function recordingStem(file: string): string {
  return String(file ?? '').replace(/\.[^.]+$/, '');
}

/**
 * 一条录音的全部派生物路径（删除时逐项清；新后缀往 {@link RECORDING_DERIVED_SUFFIXES} 加，
 * 并在这里补上，别让调用点各自拼）。**不含**录音原件、也不含控制文件（各有落点）。
 */
export function recordingArtifactPaths(dataRoot: string, talker: string, file: string): string[] {
  const dir = recordingsDirOf(dataRoot, talker);
  const stem = recordingStem(file);
  return [`${dir}/${stem}.turns.json`, `${dir}/${stem}.meta.json`, `${dir}/${stem}.turns.md`];
}

/** 落账半截 tmp（`<stem>.turns.json.<pid>.<n>.tmp`）的匹配前缀——删账本时一并扫掉 */
export function recordingTmpPrefix(file: string): string {
  return `${recordingStem(file)}.turns.json.`;
}

// ---------------- 失败诊断（issue 516 Q16h：别只留 stdout 里的一句英文） ----------------

/** 阶段名（诊断文案用；与 render 的 SUPP_REC_STAGES 同口径） */
const PHASE_LABEL: Record<string, string> = {
  load: '启动模型',
  vad: 'VAD 切窗',
  voiceprint: '声纹分离',
  transcribe: '逐轮转写',
};

/**
 * 失败原因人话（行上 errText）：把「崩在哪个阶段」和「下一步怎么办」一起说清。
 * 账本是逐轮落的，所以任何阶段崩都不白跑——文案里明确「点重试只补缺口」。
 */
export function recordingFailureText(side: RecordingSidecar): string {
  // done 而没有可并轮次（recordingItemState 判 failed 的那条路）：没崩过，别按「进程异常退出」误报
  if (side.phase === 'done' && !recordingTurnsComplete(side)) {
    return '没有转写出有效语音（整段可能都是旁音或静音）。点「重试」可再跑一次';
  }
  const where = side.phase === 'error' ? '' : `（崩在${PHASE_LABEL[side.phase] ?? side.phase}阶段）`;
  const raw = String(side.error ?? '').trim() || '进程异常退出（没有留下原因）';
  const p = side.progress?.text ? `；最后进度：${side.progress.text}` : '';
  return `${raw}${where}${p}。账本已留，点「重试」只补缺口`;
}

// ---------------- 逐轮时间轴（`<名>.turns.md`；插件写，人类可读，ADR-0217/0219） ----------------

/** 秒 → `mm:ss`（超一小时给 `h:mm:ss`） */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p2(m)}:${p2(ss)}` : `${p2(m)}:${p2(ss)}`;
}

/** 毫秒 → 本地 `YYYY-MM-DD HH:MM:SS`（时间轴里的绝对时刻列） */
function fmtLocalStamp(ms: number): string {
  const d = new Date(ms);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/**
 * 逐轮时间轴 markdown（ADR-0217 决策 Q21）：**含旁音轮**——这份档的另一个用途正是
 * 「复核我们没误杀」，把滤掉的整轮留在这里肉眼可见。绝对时间 = 起点 + 轮内偏移。
 */
export function buildRecordingTurnsMd(file: string, startMs: number, side: RecordingSidecar): string {
  const turns = side.turns ?? [];
  const sideCount = turns.filter((t) => t.speaker === '其他').length;
  // 段界（ADR-0220 §7）：进仓单位是段，这份档要让人看得出「哪几轮并成了一条消息」
  const segs = recordingTurnSegments(turns);
  const segCount = segs.reduce((m, s) => Math.max(m, s.seg), 0);
  const body = turns.map((t, i) => {
    const sp = String(t.speaker ?? '').trim() || '?';
    const emo = String(t.emotion ?? '').trim();
    const text = String(t.text ?? '').trim();
    const sg = segs[i] ?? { seg: 0, head: false };
    // ↳ = 与上一行同一段；旁音 / 空轮不属于任何段
    const segCell = sg.head ? `**${sg.seg}**` : sg.seg > 0 ? '↳' : sp === '其他' ? '旁音' : '—';
    return `| ${i + 1} | ${segCell} | ${fmtLocalStamp(startMs + Math.round((Number(t.start) || 0) * 1000))} | ${fmtClock(t.start)}-${fmtClock(t.end)} | ${sp} | ${emo || '—'} | ${text || '（空转写）'} |`;
  });
  return [
    `# ${file} · 转写时间轴`,
    '',
    `- 起点：${fmtLocalStamp(startMs)}`,
    `- 轮次：${turns.length}${sideCount ? `（其中旁音 ${sideCount}）` : ''}`,
    `- 段落：${segCount} 段（同一人连续说话并为一段，进聊天仓的就是这 ${segCount} 条）`,
    `- 模式：${side.mode ?? '—'}`,
    '',
    '_由包仔生成（每次并仓 / 改起点重写）。旁音轮不进聊天仓，只在这份档里留底供复核。_',
    '_「段」列：粗体数字 = 这一段的第一轮；↳ = 与上一行同属一段；旁音 / 空转写轮不属于任何段。_',
    '',
    '| # | 段 | 绝对时间 | 起-止 | 说话人 | 情感 | 文本 |',
    '|---:|---:|---|---|---|---|---|',
    ...body,
    '',
  ].join('\n');
}

/**
 * 扫清该录音 stem 的陈旧半截 tmp（`<stem>.turns.json.<pid>.<n>.tmp`，ADR-0219）：崩溃遗留的
 * tmp 没有清扫入口会永久滞留（此前只有「删除该录音」才顺手扫）。挂在并仓 / 改起点（即
 * writeRecordingTurnsMd 的调用时刻）顺手扫：**只删 mtime 早于 cutoffMs 的**——比它新的可能
 * 是在写文件，不动。返回删掉的个数；无 fs / 读目录失败静默 0（尽力而为，不反噬主流程）。
 */
function sweepRecordingTmpFiles(dir: string, file: string, cutoffMs: number): number {
  const fs2 = controlFs();
  if (!fs2 || !dir || !file) return 0;
  const prefix = recordingTmpPrefix(file);
  let names: string[] = [];
  try {
    names = fs2.readdirSync(dir) as string[];
  } catch {
    return 0; // 目录还不存在
  }
  let removed = 0;
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.tmp')) continue;
    const p = `${dir}/${name}`;
    try {
      const st = fs2.statSync(p);
      if (Number(st.mtimeMs) >= cutoffMs) continue; // 新于本次处理开始：可能是在写，不动
      fs2.rmSync(p, { force: true });
      removed++;
    } catch {
      /* 单个失败不中断清扫 */
    }
  }
  return removed;
}

/** 写 `<名>.turns.md`（插件是唯一写者，幂等覆盖）；失败只告警返回 false。
 *  写成后顺手扫清该录音的陈旧半截 tmp（本函数的调用时刻 = 并仓 / 改起点，见上）。 */
export function writeRecordingTurnsMd(dataRoot: string, talker: string, file: string, md: string): boolean {
  const fs2 = controlFs();
  if (!fs2 || !dataRoot || !talker || !file) return false;
  const p = recordingTurnsMdPath(dataRoot, talker, file);
  const startedAt = Date.now(); // 本次处理的起点：早于它的 tmp 才算陈旧
  try {
    fs2.mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true });
    fs2.writeFileSync(p, md, 'utf8');
    sweepRecordingTmpFiles(recordingsDirOf(dataRoot, talker), file, startedAt);
    return true;
  } catch (e) {
    console.warn('[people] 写录音时间轴失败:', e);
    return false;
  }
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

/** `bz-face check --data-root … --contact … --src …`（导入前归属抽检，issue 516 Q15；
 *  一个进程查完所有源文件——每条起一个进程会白付分钟级模型冷加载） */
export function buildRecordingCheckSpec(opts: { dataRoot: string; talker: string; srcs: string[]; python?: string; ffmpeg?: string }): ExternalToolSpec {
  const python = opts.python?.trim() || undefined;
  const ffmpeg = opts.ffmpeg?.trim() || undefined;
  return {
    cmd: 'bz-face',
    args: [
      'check',
      '--data-root',
      quotePathArg(opts.dataRoot),
      '--contact',
      quotePathArg(opts.talker),
      ...opts.srcs.flatMap((s) => ['--src', quotePathArg(s)]),
      ...(ffmpeg ? ['--ffmpeg', quotePathArg(ffmpeg)] : []),
      ...(python ? ['--python', python] : []),
    ],
    shell: true,
  };
}

/** check 的 `[bz-result]` 里 verdicts 的取值（unknown = 没判据 / 抽检失败 → 一律放行） */
export type RecordingCheckVerdict = 'ok' | 'stranger' | 'unknown';

/** 解析 check 的结果行（`{verdicts: {<src>: verdict}}`；畸形一律空表 = 全放行） */
export function parseRecordingCheckResult(data: Record<string, unknown> | null | undefined): Map<string, RecordingCheckVerdict> {
  const out = new Map<string, RecordingCheckVerdict>();
  const v = (data ?? {}).verdicts;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === 'ok' || val === 'stranger' || val === 'unknown') out.set(k, val);
  }
  return out;
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
  /** LLM 校对已落（ADR-0222）：插件写回的 additive 标记，工具重跑补账时按轮次 text 保留语义不变 */
  proofread?: boolean;
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
    ...(o.proofread === true ? { proofread: true } : {}),
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
      // done 但没有可并的轮次（零有效语音：整段旁音 / 静音）≠ merged——并仓判定
      // recordingTurnsComplete 要求 turns.length > 0，标 merged 会变成点并仓永无动作的假态，
      // 按 failed 落行（点「重试」可再跑一次，与 failure 文案同一出口）
      return recordingTurnsComplete(sidecar) ? 'merged' : 'failed';
    case 'error':
      return 'failed';
    case 'vad':
    case 'voiceprint':
    case 'transcribe':
      return 'interrupted'; // 手上的进程由 UI 以注册表状态优先显示
  }
}

/**
 * 转写完成度兜底（ADR-0219 决策 4）：sidecar 停在 `transcribe` 但**转写成果已齐**
 * → 视为完成、可直接并仓——不为一枚收尾 `phase:"done"` 标记白重跑一遍脚本。
 *
 * 成果已齐的两条等价证据（任一成立）：
 * - `progress.done === progress.total === turns.length`：转写循环走到最后一轮才有的账；
 * - 每一轮都有非空 text（真实空轮会让这条不成立，此时按未齐处理，点「续跑」只补空轮、很便宜）。
 */
export function recordingTurnsComplete(side: RecordingSidecar | null): boolean {
  const turns = side?.turns;
  if (!turns?.length) return false;
  if (side!.phase === 'done') return true;
  if (side!.phase !== 'transcribe') return false;
  const { done, total } = side!.progress ?? {};
  if (Number.isFinite(done) && Number.isFinite(total) && total === turns.length && done === total) return true;
  return turns.every((t) => !!String(t.text ?? '').trim());
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

/** 录音 ts 三级回落：文件名 → mtime → now（永不返回无效值）。
 *  **只作旧数据兜底**——新导入一律先确认起点并写 `<名>.meta.json`（见 `recordingStartOf`）。 */
export function recordingTsOf(fileName: string, mtimeMs?: number, nowMs?: number): number {
  const fromName = parseRecordingFilenameTs(fileName);
  if (fromName !== null) return fromName;
  if (typeof mtimeMs === 'number' && Number.isFinite(mtimeMs) && mtimeMs > 0) return Math.round(mtimeMs);
  return Math.round(nowMs ?? Date.now());
}

/**
 * 录音起点（**一等数据**，ADR-0217）：meta 里的用户确认值优先，其次才回落旧口径
 * （文件名 → mtime → now）。并仓时的绝对时间基准就是它。
 */
export function recordingStartOf(dataRoot: string, talker: string, file: string, mtimeMs?: number): number {
  const meta = readRecordingMeta(dataRoot, talker, file);
  if (meta?.startMs) return meta.startMs;
  return recordingTsOf(file, mtimeMs);
}

/**
 * 落盘时的同名消歧（issue 516 Q2）：同名 + **内容相同** → 跳过（返回 null）；
 * 同名 + **内容不同** → 加 ` (2)` ` (3)` 后缀，两份都留。
 * 静默丢文件是数据损失，比多一条脏录音严重——所以不再"同名就 continue"。
 */
export function resolveRecordingTargetName(exists: (name: string) => boolean, name: string): string | null {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  if (!exists(name)) return name;
  for (let i = 2; i < 100; i++) {
    const cand = `${stem} (${i})${ext}`;
    if (!exists(cand)) return cand;
  }
  return null;
}

// ---------------- 起点候选反推（ADR-0217 决策 2：相对时间信息不自动反推，给候选让用户点） ----------------

/** 导出名里常见的相对时间信息：`周X / 星期X` + `N点M分 / N:M` */
function parseRelativeTime(fileName: string): { weekday: number | null; hh: number | null; mm: number | null } {
  const base = String(fileName ?? '').replace(/\.[^.]+$/, '');
  const wd = /(?:周|星期)\s*([一二三四五六日天])/.exec(base);
  const WEEKDAY: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
  const tm = /(\d{1,2})\s*[点时:：]\s*(\d{1,2})?/.exec(base);
  const hh = tm ? Number(tm[1]) : null;
  const mm = tm && tm[2] ? Number(tm[2]) : tm ? 0 : null;
  return {
    weekday: wd ? WEEKDAY[wd[1]] : null,
    hh: hh !== null && hh >= 0 && hh <= 23 ? hh : null,
    mm: mm !== null && mm >= 0 && mm <= 59 ? mm : null,
  };
}

/**
 * 相对时间信息的候选起点（**不自动反推**，只给候选让用户点一下确认，ADR-0217 决策 2）。
 * `mtimeMs` 在这里的正确用法是**上界**（文件不可能早于录制时刻落盘）——候选从 mtime 往前找。
 * 最多给 3 个（最近的在前）。一个都推不出 → 空数组（导入页必填）。
 */
export function recordingStartCandidates(fileName: string, mtimeMs: number): number[] {
  const exact = parseRecordingFilenameTs(fileName);
  if (exact !== null) return [exact];
  if (!Number.isFinite(mtimeMs) || mtimeMs <= 0) return [];
  const { weekday, hh, mm } = parseRelativeTime(fileName);
  if (hh === null) return []; // 连时刻都没有：无从推起，必填
  const out: number[] = [];
  const minute = mm ?? 0;
  const cursor = new Date(mtimeMs);
  cursor.setHours(hh, minute, 0, 0);
  if (cursor.getTime() > mtimeMs) cursor.setDate(cursor.getDate() - 1); // 上界：不晚于 mtime
  for (let i = 0; i < 30 && out.length < 3; i++) {
    if (weekday === null || cursor.getDay() === weekday) out.push(cursor.getTime());
    cursor.setDate(cursor.getDate() - 1);
  }
  return out;
}

// ---------------- 文件字节 sha256（去重判据；issue 516 Q1 只做字节级） ----------------
function nodeCrypto(): any {
  const w = typeof window === 'undefined' ? null : (window as any);
  if (!w || !w.require) return null;
  try {
    return w.require('crypto');
  } catch {
    return null;
  }
}

/** 文件字节 sha256（读不到 / 非桌面端 → null：调用方按"判不了"处理，不误杀） */
export function fileSha256(path: string): string | null {
  const fs2 = controlFs();
  const c = nodeCrypto();
  if (!fs2 || !c) return null;
  try {
    return c.createHash('sha256').update(fs2.readFileSync(path)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * 库里疑似重复组（同内容不同名 → 同组；issue 516 Q3：**只巡检不清**——重复的两条可能
 * 一条已并仓一条没有，自动裁决必然削掉数据）。
 * 代价控制：先按 **文件大小** 分组（只 stat，不读内容），只有同尺寸 ≥2 个才真读盘哈希
 * ——库越大越省，正常录音时长各异，绝大多数情况一次都不读。
 */
export function duplicateRecordingGroups(
  dir: string,
  fs2: any,
  sha256: (p: string) => string | null = fileSha256,
): string[][] {
  if (!fs2) return [];
  let names: string[] = [];
  try {
    names = (fs2.readdirSync(dir) as string[]).filter((f) => isRecordingFile(f));
  } catch {
    return []; // 目录还不存在
  }
  const bySize = new Map<number, string[]>();
  for (const f of names) {
    let size = -1;
    try {
      size = Number(fs2.statSync(`${dir}/${f}`).size);
    } catch {
      continue;
    }
    if (!Number.isFinite(size) || size <= 0) continue; // 0 字节 / 读不到：不参与（哈希也没意义）
    const arr = bySize.get(size);
    if (arr) arr.push(f);
    else bySize.set(size, [f]);
  }
  const groups: string[][] = [];
  for (const same of bySize.values()) {
    if (same.length < 2) continue; // 尺寸就不同 → 必不是同一份，不读盘
    const bySha = new Map<string, string[]>();
    for (const f of same) {
      const sha = sha256(`${dir}/${f}`);
      if (!sha) continue;
      const arr = bySha.get(sha);
      if (arr) arr.push(f);
      else bySha.set(sha, [f]);
    }
    for (const g of bySha.values()) {
      if (g.length > 1) groups.push(g.slice().sort());
    }
  }
  return groups.sort((a, b) => a[0].localeCompare(b[0]));
}

// ---------------- 质心参考（fs 取用统一走下方 controlFs） ----------------

/** 质心参考就绪态：npz 在 = ready（dual 或 me-only 由脚本读时自判）；缺 = missing（将降级） */
export function voiceprintRefStatus(dataRoot: string, talker: string): 'ready' | 'missing' {
  const fs2 = controlFs();
  if (!fs2) return 'missing';
  try {
    return fs2.existsSync(voiceprintRefPath(dataRoot, talker)) ? 'ready' : 'missing';
  } catch {
    return 'missing';
  }
}

/**
 * sidecar 读缓存（ADR-0219）：键 = sidecar 路径，值 = 上次 stat 签名 + 解析结果。
 * Windows 上 Node 开文件**不带 `FILE_SHARE_DELETE`**——只要有一个读句柄在，脚本的
 * `os.replace(tmp → sidecar)` 就**确定性被拒**（WinError 5；实测 21/21 全拒）。
 * 故读取一律「先 `stat` 判签名，未变不 open」：`stat` 不占读句柄、不阻塞 replace，
 * open 次数从「每秒每条」降到「每次变化一次」，把必然碰撞压成概率≈0。
 * 签名取 mtime + ctime + size——逐轮落账 size 必增，三重叠加不为同一文件重复命中。
 */
const sidecarCache = new Map<string, { sig: string; value: RecordingSidecar | null }>();

/** 测试注入缝：清 sidecar 读缓存 */
export function resetRecordingSidecarCacheForTests(): void {
  sidecarCache.clear();
}

/** 录音 sidecar 读取（缺文件 / IO 失败 → null = 未处理过）。stat 未变则复用上次解析，不 open。 */
export function readRecordingSidecar(dataRoot: string, talker: string, file: string): RecordingSidecar | null {
  const fs2 = controlFs();
  if (!fs2) return null;
  const p = recordingSidecarPath(dataRoot, talker, file);
  let sig: string;
  try {
    const st = fs2.statSync(p);
    sig = `${st.mtimeMs}-${st.ctimeMs}-${st.size}`;
  } catch {
    sidecarCache.delete(p); // 缺失 / 不可读：清缓存，下次出现重新解析
    return null;
  }
  const hit = sidecarCache.get(p);
  if (hit && hit.sig === sig) return hit.value;
  let value: RecordingSidecar | null = null;
  try {
    value = parseRecordingSidecar(fs2.readFileSync(p, 'utf8'));
  } catch {
    value = null;
  }
  sidecarCache.set(p, { sig, value });
  return value;
}

/**
 * LLM 校对结果写回录音账本（ADR-0222 / issue 518）：texts 与「有转写文本的轮次」按序一一对齐，
 * 就地替换 turns[].text 并落顶层 `proofread: true` 标记。在**原始 JSON** 上动刀——snake_case
 * 字段（duration_sec / mean_abs_llr…）零触碰，工具续跑照常读；写成功失效 sidecar 缓存。
 * 只在整档校对全成后调用（调用方失败不写回）；条数对不上（账本中途被工具重写）返回 false 不写。
 */
export function writeRecordingTurnsProofread(
  dataRoot: string,
  talker: string,
  file: string,
  texts: string[]
): boolean {
  const fs2 = controlFs();
  if (!fs2 || !texts.length) return false;
  const p = recordingSidecarPath(dataRoot, talker, file);
  let raw: any;
  try {
    raw = JSON.parse(fs2.readFileSync(p, 'utf8'));
  } catch {
    return false;
  }
  if (!raw || !Array.isArray(raw.turns)) return false;
  const hit: number[] = [];
  for (let i = 0; i < raw.turns.length; i++) {
    const t = raw.turns[i];
    if (t && typeof t === 'object' && typeof t.text === 'string' && t.text.trim() !== '') hit.push(i);
  }
  if (hit.length !== texts.length) return false;
  hit.forEach((ti, k) => { raw.turns[ti].text = texts[k]; });
  raw.proofread = true;
  try {
    // 原子落盘（tmp + rename，与转写脚本的 os.replace 同口径）：直写正式路径会跟在跑脚本的
    // replace 竞态——脚本随后整档覆盖 = 校对稿白写；写一半崩 = 半截 JSON 让 sidecar 退回「待处理」。
    if (typeof fs2.renameSync === 'function') {
      const tmp = `${p}.proofread.tmp`;
      try {
        fs2.writeFileSync(tmp, JSON.stringify(raw, null, 1));
        fs2.renameSync(tmp, p);
      } catch (e) {
        try { fs2.unlinkSync(tmp); } catch { /* 清理失败不影响结论 */ }
        throw e;
      }
    } else {
      fs2.writeFileSync(p, JSON.stringify(raw, null, 1)); // 测试桩等无 rename 环境：退回直写
    }
  } catch {
    return false;
  }
  sidecarCache.delete(p);
  return true;
}

// ---------------- 录音 meta（插件侧一等数据；ADR-0217） ----------------

/** `<名>.meta.json`（插件写、插件读；**不进 sidecar**——重转删账本不该连起点一起删） */
export interface RecordingMeta {
  /** 录音起点毫秒（用户确认过的绝对时刻）；轮次绝对时间 = 起点 + 轮内偏移 */
  startMs?: number;
  /** 源录音文件 sha256（去重判据：同名不同内容两份都留，同名同内容跳过） */
  sha256?: string;
  /** 起点来源（诊断 / 导入页回显）：name = 文件名解析、candidate = 相对候选确认、manual = 手填 */
  startSource?: 'name' | 'candidate' | 'manual';
}

/** 读 `<名>.meta.json`（缺文件 / 坏 JSON / IO 失败 → null，永不抛） */
export function readRecordingMeta(dataRoot: string, talker: string, file: string): RecordingMeta | null {
  const fs2 = controlFs();
  if (!fs2) return null;
  try {
    const d: unknown = JSON.parse(fs2.readFileSync(recordingMetaPath(dataRoot, talker, file), 'utf8'));
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const o = d as Record<string, unknown>;
    const src = o.startSource;
    return {
      ...(num(o.startMs) !== undefined ? { startMs: num(o.startMs) } : {}),
      ...(str(o.sha256) ? { sha256: str(o.sha256) } : {}),
      ...(src === 'name' || src === 'candidate' || src === 'manual' ? { startSource: src } : {}),
    };
  } catch {
    return null;
  }
}

/** 写 `<名>.meta.json`（插件是唯一写者，无并发读者，直接落盘即可）。失败只告警返回 false。 */
export function writeRecordingMeta(dataRoot: string, talker: string, file: string, meta: RecordingMeta): boolean {
  const fs2 = controlFs();
  if (!fs2 || !dataRoot || !talker || !file) return false;
  const p = recordingMetaPath(dataRoot, talker, file);
  try {
    fs2.mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true });
    fs2.writeFileSync(p, `${JSON.stringify(meta, null, 1)}\n`, 'utf8');
    return true;
  } catch (e) {
    console.warn('[people] 写录音 meta 失败:', e);
    return false;
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

/** 测试注入缝：替换 / 还原脸谱录音域的 fs（控制文件 + sidecar 读取共用） */
export function setRecordingFsForTests(fs2: any): void {
  recFsOverride = fs2;
}

/** 脸谱录音域的 fs 唯一取用点（控制文件读写 + sidecar stat/读）；非桌面端 null */
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
  const tooOld = maj === 0 && min < 6; // v0.6 = 旁音过滤 + 归属抽检 + 账本替换重试的起线；0.10 / 1.x 都不算旧
  if (tooOld || !caps.commands.includes('rec') || !caps.commands.includes('check')) {
    // 本包不发公开 registry——npm update 拉不到，指 npm link / 仓内路径重装
    return `本机 bz-face（v${caps.version}）过旧：v0.6 起才有「账本替换重试（修你遇到的那个 PermissionError 拒绝访问）」+ 旁音过滤 + 归属抽检——本包不发 registry，请在包目录 tools/obsidian-face 重新 npm link（或 npm install -g <仓库>/tools/obsidian-face）后重试`;
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
 *
 * **别直接调它起任务**——统一走 `enqueueRecordingTask`（全局串行 + 重进程闸门，ADR-0218）：
 * 本函数是队列的执行器，返回 handle 供队列 await（已在跑则返回 null）。
 */
export function startRecordingTask(
  spec: ExternalToolSpec,
  key: string,
  onExit?: (outcome: { ok: boolean; stopped: boolean; error: string }) => void,
  meta?: { talker: string; file: string; dataRoot?: string },
  onResult?: (data: Record<string, unknown>) => void
): ExternalToolHandle | null {
  if (running.has(key)) return null;
  if (meta?.dataRoot && meta.talker && meta.file) clearRecControl(meta.dataRoot, meta.talker, meta.file);
  const handle = runner(spec, {
    onStep: () => {},
    onProgress: () => {},
    onInfo: () => {},
    onResult: (data) => onResult?.(data as Record<string, unknown>),
  });
  running.set(key, { handle, talker: meta?.talker ?? '', file: meta?.file ?? '', startedAt: Date.now() });
  void handle.done.then((outcome) => {
    running.delete(key);
    if (meta?.dataRoot && meta.talker && meta.file) clearRecControl(meta.dataRoot, meta.talker, meta.file);
    onExit?.({ ok: outcome.ok, stopped: outcome.stopped, error: outcome.error?.message ?? '' });
  });
  return handle;
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

// ---------------- 录音处理队列（ADR-0218 决策 5：全局一条串行，内存态不持久化） ----------------

/**
 * 队列条目。`spec` 用**函数**延迟组装——**出队那一刻**才拼（前面的任务可能刚把质心建好，
 * 入队时判会白建一次）。`prepare` 同理由出队时调用（质心前置编排的落点）。
 */
export interface RecordingQueueEntry {
  /** 唯一键（录音 = sidecar 路径；质心构建 = `ref:<talker>`） */
  key: string;
  talker: string;
  file: string;
  spec: () => ExternalToolSpec;
  /** 出队那一刻的判定（如缺质心则先建）；返回 false = 放弃该条（不起进程） */
  prepare?: () => Promise<boolean>;
  onExit?: (outcome: { ok: boolean; stopped: boolean; error: string }) => void;
  /** `[bz-result]` 交付行（check 抽检的 verdicts 就走这里） */
  onResult?: (data: Record<string, unknown>) => void;
  meta?: { talker: string; file: string; dataRoot?: string };
}

const queue: RecordingQueueEntry[] = [];
let pumping = false;
/** 队列代次：reset（测试）时自增，让悬挂的旧 pump 循环立刻收手（不误处理新队列） */
let queueEpoch = 0;
const queueSubs = new Set<() => void>();

/** 队列轮询间隔（等闸门时用；测试可注入） */
let queueSleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms));

/** 测试注入缝：替换 / 还原队列等待的 sleep（null 还原默认） */
export function setRecordingQueueSleepForTests(fn: ((ms: number) => Promise<void>) | null): void {
  queueSleep = fn ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
}

/** 测试注入缝：清空队列与订阅（并作废旧 pump 循环） */
export function resetRecordingQueueForTests(): void {
  queueEpoch++;
  queue.length = 0;
  pumping = false;
  queueSubs.clear();
}

/** 测试注入缝：清空进程注册表（**只清记账，不碰真进程**——测试隔离用，生产别调） */
export function resetRecordingProcessesForTests(): void {
  running.clear();
}

/** 订阅队列变化（UI 重画排队行 / 进度块）；返回退订函数 */
export function subscribeRecordingQueue(fn: () => void): () => void {
  queueSubs.add(fn);
  return () => queueSubs.delete(fn);
}

function notifyQueue(): void {
  for (const fn of [...queueSubs]) {
    try {
      fn();
    } catch {
      /* 订阅者异常不影响队列 */
    }
  }
}

/** 该键是否在队列里等（含正在出队但还没起进程的瞬间） */
export function isRecordingQueued(key: string): boolean {
  return queue.some((e) => e.key === key);
}

/** 排队位次（1 = 下一个跑；0 = 不在队列） */
export function recordingQueuePosition(key: string): number {
  const i = queue.findIndex((e) => e.key === key);
  return i < 0 ? 0 : i + 1;
}

/** 排队中的条目（UI 列表用） */
export function queuedRecordingItems(): Array<{ key: string; talker: string; file: string; position: number }> {
  return queue.map((e, i) => ({ key: e.key, talker: e.talker, file: e.file, position: i + 1 }));
}

/** 排队条数（进度块文案 `N 条等待`） */
export function queuedRecordingCount(): number {
  return queue.length;
}

/**
 * 入队（幂等：同 key 已在跑 / 已在队 = no-op）。**入队即返回**，出队由队列自己驱动（全局串行）。
 */
export function enqueueRecordingTask(entry: RecordingQueueEntry): void {
  if (!entry?.key) return;
  if (running.has(entry.key) || isRecordingQueued(entry.key)) return;
  queue.push(entry);
  notifyQueue();
  void pumpRecordingQueue();
}

/** 移出队列（排队行上的「移出队列」）；不在队 = false */
export function dequeueRecordingTask(key: string): boolean {
  const i = queue.findIndex((e) => e.key === key);
  if (i < 0) return false;
  queue.splice(i, 1);
  notifyQueue();
  return true;
}

/** 清空队列（腾机器；在跑的那条不受影响——要停它另有「停止」） */
export function clearRecordingQueue(): number {
  const n = queue.length;
  queue.length = 0;
  notifyQueue();
  return n;
}

/** 单次队列推进（测试可手动驱动） */
async function pumpRecordingQueue(): Promise<void> {
  if (pumping) return;
  pumping = true;
  const epoch = queueEpoch;
  try {
    while (queue.length && epoch === queueEpoch) {
      const entry = queue[0];
      // 重进程闸门（ADR-0218）：画谱任务在跑 → 等它释放；那边只剩待命 prep 进程 → 请求协作式
      // 终结（内部自判，不可抢占时是 no-op）后继续等。被移出 / 清空 / 作废 → keepWaiting false 放弃。
      // 抢占请求：**发成功一次就不再发**（stop 已送到，重发只堆定时器）。注意 latch 条件是
      // 「成功」而非「试过」——画谱任务真在跑时 preempt 返回 false，若那次就锁死，等任务跑完
      // 只剩待命进程持闸，录音就永久等下去（本批修过的一个真死锁）。
      let preempted = false;
      const got = await waitHeavyGate(
        'recording',
        () => epoch === queueEpoch && queue.includes(entry),
        async (ms) => {
          if (!preempted && preemptHeavyStandby()) preempted = true;
          await queueSleep(ms);
        }
      );
      if (epoch !== queueEpoch) return;
      if (!got) {
        dequeueRecordingTask(entry.key);
        continue;
      }
      dequeueRecordingTask(entry.key); // 出队（位置信息随之消失，行状态转 running）
      let go = true;
      if (entry.prepare) {
        try {
          go = await entry.prepare();
        } catch {
          go = false;
        }
      }
      if (epoch !== queueEpoch) {
        releaseHeavy('recording');
        return;
      }
      if (!go) {
        releaseHeavy('recording');
        continue;
      }
      let handle: ExternalToolHandle | null = null;
      try {
        handle = startRecordingTask(
          entry.spec(),
          entry.key,
          entry.onExit,
          entry.meta ?? { talker: entry.talker, file: entry.file },
          entry.onResult
        );
      } catch (e) {
        // spec 组装就炸（路径含 % 之类参数面问题，quotePathArg 拒绝）：这条按失败收账、
        // 松闸续跑下一条——异常穿出 pump 会卡死 pumping 标记，整条队列跟着装死
        const msg = e instanceof Error ? e.message : String(e);
        releaseHeavy('recording');
        entry.onExit?.({ ok: false, stopped: false, error: msg });
        notice(`录音任务无法启动：${msg}`, 'error');
        continue;
      }
      if (!handle) {
        releaseHeavy('recording');
        continue;
      }
      await handle.done; // 一条跑完才轮到下一条（全局串行）
      releaseHeavy('recording');
    }
  } finally {
    if (epoch === queueEpoch) pumping = false;
    notifyQueue();
  }
}


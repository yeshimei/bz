/**
 * 脸谱画脸谱工具段（prep）驱动层（issue 469 / ADR-0195 / ADR-0196 决策 1、3、4、5、7）：
 * 调 `bz-face prep <联系人>` 跑媒体导出 → 派生图片档 → 图片关联表 → 语音转写，
 * 接进既有生成任务引擎（jobs.ts 的 preprocess 阶段）。
 *
 * 结构照 sync.ts（issue 465 先例）：
 *   - 命令定位照 bili-downloader 先例：纯 PATH 找 `bz-face`、shell:true（.cmd shim）、
 *     ENOENT 给安装指引（与 sync 同一口径文案）。
 *   - 参数下发（468 prep-core CLI 参数面）：--data-root ← peopleDataDir（必填）；
 *     --asr-engine ← asrEngine（恒下发）；--asr-model 仅 faster-whisper 且配置非空才传；
 *     --src ← peopleWxAccountDir、--python ← pythonPath、--ffmpeg ← ffmpegPath（非空才传）。
 *     路径类参数 win32 下包引号（sync.ts 先例：shell 按空格拆散的坑）。
 *   - 进度协议走 core/external-tool 四行协议：[bz-p]{phase,pct}（phase ∈ media/derive/map/
 *     transcribe，与工具 PREP_PHASES 同词汇）、[bz-info]（分段汇总计数 + 暂停/恢复态）、
 *     [bz-result] 为结果权威（ok:false = 密钥/解密类硬失败；failed>0 = 单条失败已计账继续）。
 *
 * 协作式暂停（ADR-0196 决策 3）：暂停/恢复不杀进程——写数据根 `.bz-face/control.json`
 * {action:"pause"|"resume"}，工具在步骤边界与每条媒体之间轮询让行待命（本地语音模型冷加载
 * 按分钟计，绝不硬杀）；中断 = 杀进程留状态（removeJob / 应用退出），重跑幂等续。
 *
 * 进程会话模块级单例：暂停后进程待命，恢复复用同一进程（不重起）；重启 Obsidian 后会话
 * 自然消失，续跑重起进程由工具的产物幂等补缺口。
 */
import { runExternalTool, type ExternalToolCallbacks, type ExternalToolHandle, type ExternalToolSpec, type ExternalToolOutcome } from '../core/external-tool';
import { BZ_FACE_INSTALL_HINT } from './sync';
import type { VoiceItem, ImageMapItem } from './datasource';

// ---------------- 阶段词汇表（与 tools/obsidian-face lib/prep-core PREP_PHASES 同词汇） ----------------

/** prep 四段的 phase 词 → 中文标签（进度块阶段行 / 断点展示共用；470 图片描述段接续同一词汇体系） */
export const PREP_PHASE_LABELS: Record<string, string> = {
  media: '媒体导出',
  derive: '派生图片档',
  map: '图片关联表',
  transcribe: '语音转写',
};

/** prep 全部段词（段序 = 工具执行序；donePhases 的完成判定基准） */
export const PREP_PHASES = ['media', 'derive', 'map', 'transcribe'] as const;

/** 阶段词 → 中文标签（未知词回落空串） */
export function prepPhaseLabel(phase: string | null): string {
  return (phase && PREP_PHASE_LABELS[phase]) || '';
}

/** 阶段行文案（进度块主行 / job.message 同源）：`媒体导出 312/1631` / `语音转写 40%` / `图片关联表…` */
export function prepStageLine(prog: PrepProgress): string {
  const label = prepPhaseLabel(prog.phase);
  if (!label) return prog.donePhases.length >= PREP_PHASES.length ? '预处理完成' : '预处理中…';
  const c = prog.counts[prog.phase as string];
  if (c && c.total > 0) return `${label} ${c.done}/${c.total}`;
  if (prog.pct != null) return `${label} ${Math.round(prog.pct)}%`;
  return `${label}…`;
}

// ---------------- 段进度模型（挂在 job 上落盘；纯元数据无原文） ----------------

/** 单段计数（已完成 / 总数；total 来自建任务时的聊天仓口径预存或段末 [bz-info] 汇总校正） */
export interface PrepCount {
  done: number;
  total: number;
}

/**
 * prep 段进度（PersonJob.prep；断点记录就位——donePhases 即「已完成段」账本，重启续跑
 * 据此判定 prep 是否还需起进程；段内高频进度只进内存快照，段完成才落盘）。
 */
export interface PrepProgress {
  /** 当前段词（media|derive|map|transcribe；null = 未起段 / 已完成） */
  phase: string | null;
  /** 当前段百分比（null = 该段不可估——map 段工具不给 pct，绝不假报） */
  pct: number | null;
  /** 各段已完成/总数（段末 [bz-info] 汇总校正；进行中按 pct × 预存总数推算——两个口径同一字段） */
  counts: Record<string, PrepCount>;
  /** 已完成段词（[bz-info] 汇总确认；断点账本） */
  donePhases: string[];
  /** 单条媒体/语音失败累计（[bz-result].failed 为权威） */
  failed: number;
  /** 工具让行待命中（[bz-info]{status:"paused"}） */
  paused?: boolean;
}

/** 建 prep 段进度（totals = 建任务时聊天仓口径的预存总数；null 段位不预存——绝不编数） */
export function newPrepProgress(totals?: { media?: number; transcribe?: number; map?: number }): PrepProgress {
  const counts: Record<string, PrepCount> = {};
  if (totals?.media && totals.media > 0) counts.media = { done: 0, total: totals.media };
  if (totals?.map && totals.map > 0) counts.map = { done: 0, total: totals.map };
  if (totals?.transcribe && totals.transcribe > 0) counts.transcribe = { done: 0, total: totals.transcribe };
  return { phase: null, pct: null, counts, donePhases: [], failed: 0 };
}

/** prep 是否已全部完成（donePhases 覆盖四段——断点续跑跳过工具段的判定） */
export function prepAllDone(prog: PrepProgress): boolean {
  return PREP_PHASES.every((p) => prog.donePhases.includes(p));
}

/**
 * [bz-p]{phase,pct} → 段进度（进行中口径）：更新当前段；总数已预存（或已校正）的段按
 * pct 推算已完成数（工具在段内的完成序与 chat.json 口径不完全同序，这是进度展示用的推算值，
 * 段末 [bz-info] 汇总会校正为准确值）。
 */
export function applyPrepProgress(prog: PrepProgress, phase: string | null, pct: number | null): void {
  prog.phase = phase;
  prog.pct = pct;
  if (phase && pct != null) {
    const c = prog.counts[phase];
    if (c && c.total > 0) c.done = Math.min(c.total, Math.max(c.done, Math.round((pct / 100) * c.total)));
  }
}

/**
 * [bz-info] 事件 → 段计数累计（识别到才动账本，返回是否识别）：
 *   {phase:"media", counts:{voice:{done,skip,fail},image:…,…}} → 各类求和；
 *   {phase:"derive"|"transcribe", done, skip, fail} → 同口径三项；
 *   {phase:"map", refs, mapped} → 图片引用数 × 成功关联数；
 *   {status:"paused"|"resumed"} → 让行待命态（note 文案透传给 message 用）。
 * 段汇总落账即记入 donePhases（断点账本）。
 */
export function collectPrepInfo(prog: PrepProgress, data: Record<string, unknown>): boolean {
  if (data.status === 'paused') {
    prog.paused = true;
    return true;
  }
  if (data.status === 'resumed') {
    prog.paused = false;
    return true;
  }
  const phase = typeof data.phase === 'string' ? data.phase : '';
  if (!phase || !PREP_PHASES.includes(phase as (typeof PREP_PHASES)[number])) return false;
  let done = 0;
  let total = 0;
  if (phase === 'media') {
    const counts = data.counts && typeof data.counts === 'object' ? (data.counts as Record<string, unknown>) : null;
    for (const v of Object.values(counts ?? {})) {
      const o = v as Record<string, unknown> | null;
      if (!o || typeof o !== 'object') continue;
      const d = Number(o.done) || 0;
      const s = Number(o.skip) || 0;
      const f = Number(o.fail) || 0;
      done += d + s;
      total += d + s + f;
    }
  } else if (phase === 'map') {
    done = Number(data.mapped) || 0;
    total = Number(data.refs) || 0;
  } else {
    const d = Number(data.done) || 0;
    const s = Number(data.skip) || 0;
    const f = Number(data.fail) || 0;
    done = d + s;
    total = d + s + f;
  }
  if (total > 0) prog.counts[phase] = { done, total };
  else prog.counts[phase] = { done, total: prog.counts[phase]?.total ?? 0 };
  if (!prog.donePhases.includes(phase)) prog.donePhases.push(phase);
  return true;
}

/** 整段总进度（0~100，进度条用）：四段均分，当前段按段内 pct 折算（map 段不可估按 0——保守不假报） */
export function prepOverallPct(prog: PrepProgress): number {
  const cur = prog.phase && !prog.donePhases.includes(prog.phase) ? (prog.pct ?? 0) / 100 : 0;
  const ratio = Math.min(PREP_PHASES.length, prog.donePhases.length + cur) / PREP_PHASES.length;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

// ---------------- 零媒体判定（ADR-0196 决策 9：零媒体联系人自动跳过 prep 全段） ----------------

/** 聊天仓口径的媒体总数（kindCounts 中文形态键为准——chat.json 全量口径；旧数据缺回落 stats） */
export function prepMediaTotals(
  kindCounts?: Record<string, number>,
  stats?: { voiceCount?: number; imageCount?: number }
): { media: number; transcribe: number; map: number } | null {
  const kc = kindCounts ?? {};
  const pick = (key: string): number => (Number.isFinite(kc[key]) ? Number(kc[key]) : 0);
  let voice = pick('语音');
  let image = pick('图片');
  const video = pick('视频');
  const file = pick('文件');
  if (!voice && !image && stats) {
    voice = Number(stats.voiceCount) || 0;
    image = Number(stats.imageCount) || 0;
  }
  const media = voice + image + video + file;
  if (media <= 0) return null; // 零媒体：不为 0 张图起一次工具进程（决策 9）
  return { media, transcribe: voice, map: image };
}

// ---------------- 参数组装（468 prep-core CLI 参数面；引号口径同 sync.ts） ----------------

export interface BuildPrepSpecOpts {
  dataRoot: string;
  /** 联系人（sync 导出的目录名，位置参数） */
  contact: string;
  /** 转写引擎（恒下发；sensevoice 缺省 / faster-whisper 备选） */
  asrEngine?: string;
  /** Whisper 档位（仅 faster-whisper 且非空才传） */
  asrModel?: string;
  /** 微信账号目录覆盖（非空才传） */
  src?: string;
  /** Python 命令覆盖（非空才传；'py -3' 按词拆） */
  python?: string;
  /** ffmpeg 路径覆盖（非空才传） */
  ffmpeg?: string;
}

/**
 * 组装 `bz-face prep` 启动参数。shell 会把参数按空格拆散（sync.ts 同源坑）——Windows 下
 * 路径/联系人名一律包引号（Win32 路径不含双引号，无损）；--python 是命令词不包。
 */
export function buildPrepSpec(opts: BuildPrepSpecOpts): ExternalToolSpec {
  const engine = opts.asrEngine === 'faster-whisper' ? 'faster-whisper' : 'sensevoice';
  const model = opts.asrModel?.trim();
  const src = opts.src?.trim() || undefined;
  const python = opts.python?.trim() || undefined;
  const ffmpeg = opts.ffmpeg?.trim() || undefined;
  const q = (v: string): string => (process.platform === 'win32' ? `"${v}"` : v);
  return {
    cmd: 'bz-face',
    args: [
      'prep',
      q(opts.contact),
      '--data-root',
      q(opts.dataRoot),
      '--asr-engine',
      engine,
      ...(engine === 'faster-whisper' && model ? ['--asr-model', model] : []),
      ...(src ? ['--src', q(src)] : []),
      ...(ffmpeg ? ['--ffmpeg', q(ffmpeg)] : []),
      ...(python ? ['--python', python] : []),
    ],
    shell: true,
  };
}

// ---------------- 控制文件（协作式暂停契约；468 prep-core parseControlAction 消费侧） ----------------

/** 协作式控制文件路径：`<数据根>/.bz-face/control.json`（工具在安全点轮询） */
export function controlFilePath(dataRoot: string): string {
  const base = dataRoot.endsWith('\\') || dataRoot.endsWith('/') ? dataRoot : `${dataRoot}/`;
  return `${base}.bz-face/control.json`;
}

// ---------------- fs 缝（控制文件读写 / 旁路表读取；node 测试注入假件） ----------------

/** prep 所需的最小 fs 面（缺省桌面端 window.require('fs') 适配） */
export interface PrepFs {
  writeText(path: string, data: string): void;
  readText(path: string): string | null;
  exists(path: string): boolean;
  unlink(path: string): void;
}

function defaultPrepFs(): PrepFs | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { require?: (id: string) => unknown };
  if (!w.require) return null;
  try {
    const fs = w.require('fs') as {
      writeFileSync(p: string, d: string): void;
      readFileSync(p: string, enc: string): string;
      existsSync(p: string): boolean;
      unlinkSync(p: string): void;
    };
    return {
      writeText: (p, d) => fs.writeFileSync(p, d),
      readText: (p) => {
        try {
          return fs.readFileSync(p, 'utf8');
        } catch {
          return null;
        }
      },
      exists: (p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      },
      unlink: (p) => {
        try {
          fs.unlinkSync(p);
        } catch {
          /* 已不存在 */
        }
      },
    };
  } catch {
    return null;
  }
}

let prepFsOverride: PrepFs | null = null;

/** 测试注入缝：替换 / 还原 fs 假件（传 null 还原缺省实现） */
export function setPrepFsForTests(fs: PrepFs | null): void {
  prepFsOverride = fs;
}

function fso(): PrepFs | null {
  return prepFsOverride ?? defaultPrepFs();
}

/**
 * 写协作式控制文件（暂停 / 恢复 / 停止）。写失败（数据根不可写 / 未配置）只告警返回 false
 * ——进程收不到指令会跑完当前段，产物幂等无害，不因控制通道失联中断任务。
 */
export async function writePrepControl(dataRoot: string, action: 'pause' | 'resume' | 'stop'): Promise<boolean> {
  const fs = fso();
  const path = controlFilePath(dataRoot);
  if (!fs || !dataRoot) return false;
  try {
    fs.writeText(path, `${JSON.stringify({ action })}\n`);
    return true;
  } catch (e) {
    console.warn('[people] 写控制文件失败:', e);
    return false;
  }
}

/** 清掉控制文件（任务终态收尾：残留的 pause 会让下一次 prep 起跑即待命） */
export function clearPrepControl(dataRoot: string): void {
  const fs = fso();
  if (!fs || !dataRoot) return;
  fs.unlink(controlFilePath(dataRoot));
}

/**
 * 读该联系人的 prep 旁路表（voice.json 转写 + image_map.json 图片关联；ADR-0197 决策 4：
 * 合并进聊天仓的动作由插件执行——读数据根、写保库记录）。
 * 两表都缺 / 读不动返回 null（无产物可合并；重跑 prep 再补）。路径统一归一成正斜杠
 * （win32 fs 两种分隔符都收；测试假件按字面匹配同款字符串）。
 */
export function readPrepSidecars(dataRoot: string, contact: string): { voice: VoiceItem[]; imageMap: ImageMapItem[] } | null {
  const fs = fso();
  if (!fs || !dataRoot || !contact) return null;
  const readArray = (p: string): unknown[] | null => {
    const raw = fs.readText(p);
    if (raw == null) return null;
    try {
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const norm = (s: string): string => s.replace(/\\/g, '/');
  const base = `${dataRoot}/${contact}`.replace(/\/+$/, '');
  const voice = readArray(norm(`${base}/voice.json`));
  const imageMap = readArray(norm(`${base}/image_map.json`));
  if (!voice && !imageMap) return null;
  return {
    voice: (voice ?? []).filter((v): v is VoiceItem => !!v && typeof v === 'object'),
    imageMap: (imageMap ?? []).filter((v): v is ImageMapItem => !!v && typeof v === 'object'),
  };
}

// ---------------- 失败分流（错误面归类同 sync.ts 口径） ----------------

/** 错误消息取首行并限长（不抛栈，弹窗 / 进度块一行放得下） */
function firstLine(text: string, max = 200): string {
  const line = String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
  return line.length > max ? line.slice(0, max) + '…' : line;
}

const DOCTOR_HINT = '到终端运行 bz-face doctor 可自检环境';

/** 非 0 退出 / 无结果行时的错误面归类（人话 + 下一步动作） */
export function classifyPrepFailure(outcome: ExternalToolOutcome): { message: string; hint: string } {
  const msg = outcome.error?.message ?? '';
  if (/ENOENT/.test(msg)) return { message: '未找到 bz-face 命令', hint: BZ_FACE_INSTALL_HINT };
  if (/EACCES|权限/.test(msg)) return { message: 'bz-face 命令没有执行权限', hint: '检查命令权限，或重新 link 后重试' };
  const stderr = outcome.stderr || '';
  if (/ModuleNotFoundError|ImportError/.test(stderr) || /ModuleNotFoundError|ImportError/.test(msg)) {
    return { message: 'Python 缺少预处理依赖', hint: `${DOCTOR_HINT}，按提示安装缺的依赖后重试` };
  }
  if (/微信|数据根|联系人不|chat\.json/.test(msg)) return { message: firstLine(msg), hint: '' }; // 工具给的中文引导已含下一步动作
  return {
    message: firstLine(msg || '预处理进程异常退出，没有给出原因'),
    hint: /bz-face|doctor|pip|npm/.test(msg) ? '' : DOCTOR_HINT,
  };
}

// ---------------- 进程会话（模块级单例；暂停待命复用同一进程） ----------------

/** prep 终结产物：进程三态分流 + [bz-result] 权威体 */
export interface PrepOutcome {
  outcome: ExternalToolOutcome;
  /** [bz-result] 体（进程没吐结果行为 null） */
  result: Record<string, unknown> | null;
}

/** 在跑的 prep 会话（talker 定位；done 永不 reject） */
export interface PrepSession {
  talker: string;
  handle: ExternalToolHandle;
  done: Promise<PrepOutcome>;
  /** 进程是否仍在（待命 / 运行中；终结后 false——复用判定用） */
  alive(): boolean;
}

export type PrepRunner = typeof runExternalTool;

let session: PrepSession | null = null;
let sessionSettled = false;

/** 进程壳注入缝（测试打桩；生产 = runExternalTool） */
let runner: PrepRunner = runExternalTool;

/** 测试注入缝：替换 / 还原进程壳（一并清会话状态，给每个用例干净起点） */
export function setPrepRunnerForTests(fn: PrepRunner | null): void {
  runner = fn ?? runExternalTool;
  session = null;
  sessionSettled = false;
}

/** 清会话（测试隔离） */
export function resetPrepForTests(): void {
  session = null;
  sessionSettled = false;
}

/** 当前活会话（有待命进程可复用时非空） */
export function currentPrepSession(): PrepSession | null {
  return session && session.alive() ? session : null;
}

/**
 * 起 prep 进程（或复用同联系人的待命进程）。幂等：同联系人已有活会话直接返回（暂停后
 * 恢复不重起——模型冷加载不白付）；不同联系人的遗留会话先杀（至多一个 prep 在跑）。
 * cbs 的进度事件直接透传（调用方更新 job 进度）；[bz-result] 由本函数记账进终态。
 */
export function startPrepSession(talker: string, spec: ExternalToolSpec, cbs: ExternalToolCallbacks): PrepSession {
  if (session && session.alive()) {
    if (session.talker === talker) return session; // 待命进程复用（恢复场景）
    session.handle.stop(); // 换人跑：上一家的进程不留（至多一个 prep）
  }
  let lastResult: Record<string, unknown> | null = null;
  sessionSettled = false;
  const handle = runner(spec, {
    ...cbs,
    onResult: (data) => {
      lastResult = data;
      cbs.onResult(data);
    },
  });
  const wrapped: PrepSession = {
    talker,
    handle,
    done: handle.done.then((outcome) => {
      sessionSettled = true;
      return { outcome, result: lastResult };
    }),
    alive: () => !sessionSettled,
  };
  session = wrapped;
  return wrapped;
}

/** 杀在跑的 prep 进程（中断语义：杀进程留状态，重跑幂等续）；无会话 / 非该联系人则不动 */
export function abortPrepSession(talker?: string): void {
  if (session && session.alive() && (!talker || session.talker === talker)) session.handle.stop();
}

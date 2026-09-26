/**
 * 脸谱数据源同步（issue 465 / ADR-0195 / ADR-0196 决策 1、5、6、10）：
 * 数据源弹窗「同步」按钮的驱动层——调 `bz-face sync` 从微信重新取数
 * （取密钥 → 解密 → 逐联系人导出 chat.json + 头像源）。
 *
 * 职责：
 *   - 命令定位照 bili-downloader 先例（src/knowledge/processor.ts）：纯 PATH 找 `bz-face`、
 *     shell:true（.cmd shim）、不带路径设置键；ENOENT 给安装指引（ADR-0195：不发公开
 *     registry，本机 link / 全局装）。
 *   - 参数下发：--data-root ← peopleDataDir（必填，未配置直接给中文引导不起进程）；
 *     --src ← peopleWxAccountDir、--python ← pythonPath（462 域无关键，非空才传）。
 *   - 进度协议走 core/external-tool 四行协议：[bz-p]{phase,pct} 驱动主进度行
 *     （phase ∈ key/decrypt/contacts，工具侧头像随 contacts 逐人进行），
 *     [bz-step] 更新副文案，[bz-info]{phase:"contact"} 逐人事件实时累计，
 *     [bz-result] 为结果权威（exit 0 但 failed>0 属正常完成——单联系人失败不中断整体）。
 *   - 运行状态模块级单例（独立于面板 / 弹窗生命周期，关弹窗同步照跑、重开即恢复）；
 *     `isSyncing()` 即「同步与画脸谱互斥」的判定源（ADR-0196 决策 10，469 阶段机同读此标志）。
 *   - 停止 = runExternalTool 的 stop（杀进程）。sync 无控制文件协作暂停，但工具产物
 *     原子写 + 字节比对幂等 + 解密增量跳过，杀掉安全——停止面给「可重跑续传」文案。
 *
 * 错误面全部收敛成中文人话 + 下一步动作（不抛栈）：微信未开 / 版本封堵 / 数据根问题
 * 由工具预检以 [bz-result]{ok:false,error} 给出，原样透传；工具未装（ENOENT）给安装
 * 指引；Python 依赖缺失（stderr ModuleNotFoundError）给 bz-face doctor 引导。
 */
import { runExternalTool, type ExternalToolCallbacks, type ExternalToolHandle, type ExternalToolSpec, type ExternalToolOutcome } from '../core/external-tool';
import { notice } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';

/** 同步进行到哪了（idle = 从未跑过；终态保留在弹窗进度行里直到下次开跑） */
export type SyncOutcome = 'idle' | 'running' | 'ok' | 'stopped' | 'error';

/** 同步成果统计（联系人数口径；failures 为失败名单明细） */
export interface SyncStats {
  /** 导出的联系人总数（= 写入 + 未变） */
  contacts: number;
  /** 本轮有产物更新（新增或内容变了）的联系人数——「更新数」 */
  written: number;
  /** 产物没变的联系人数（字节比对幂等，未重写） */
  unchanged: number;
  /** 跳过（无消息记录 / 少于下限） */
  skipped: number;
  /** 单联系人导出失败数 */
  failed: number;
  /** 导出的消息总条数 */
  msgTotal: number;
  /** 表情命名条数 */
  named: number;
  /** 失败名单（名 + 中文原因） */
  failures: Array<{ name: string; error: string }>;
}

/** 同步状态快照（模块级单例；订阅推送） */
export interface PeopleSyncState {
  outcome: SyncOutcome;
  /** 当前阶段（[bz-p].phase 原词：key/decrypt/contacts） */
  phase: string | null;
  /** 阶段百分比（null = 该阶段不可估，绝不假报） */
  pct: number | null;
  /** [bz-step] 副文案 */
  step: string;
  /** 终态主消息：完成摘要 / 错误原因（中文人话） */
  message: string;
  /** 下一步动作（错误 / 停止面；空 = 不需要） */
  hint: string;
  /** 成果统计（running 期间为逐人事件实时累计；终态以 [bz-result] 为权威） */
  stats: SyncStats;
}

/** 工具未装时的安装指引（ADR-0195 口径：不发公开 registry，本机 link / 全局装） */
export const BZ_FACE_INSTALL_HINT =
  '未找到 bz-face 命令——先安装脸谱工具包（@jwbz/obsidian-face）：在仓库 tools/obsidian-face 目录下运行 npm link，或 npm install -g <仓库>/tools/obsidian-face，装好后重试';

const DOCTOR_HINT = '到终端运行 bz-face doctor 可自检环境';

/** [bz-p].phase → 中文阶段标签（与 tools/obsidian-face sync-core SYNC_PHASES 同词汇） */
const PHASE_LABELS: Record<string, string> = {
  key: '取密钥',
  decrypt: '解密数据库',
  contacts: '导出聊天',
  avatar: '头像源',
};

/** 阶段词 → 中文标签（未知词回落空串——主行用「正在同步」兜底） */
export function syncPhaseLabel(phase: string | null): string {
  return (phase && PHASE_LABELS[phase]) || '';
}

export function emptySyncStats(): SyncStats {
  return { contacts: 0, written: 0, unchanged: 0, skipped: 0, failed: 0, msgTotal: 0, named: 0, failures: [] };
}

/** ---------- 纯函数（组装 / 归类 / 摘要，独立可测） ---------- */

export interface BuildSyncSpecOpts {
  dataRoot: string;
  /** 微信账号目录覆盖（非空才传） */
  src?: string;
  /** Python 命令覆盖（非空才传；留空 = 跟随工具默认 python） */
  python?: string;
}

/**
 * 组装 `bz-face sync` 启动参数（照 bili-dl 先例：纯 PATH 找命令、.cmd shim 需 shell:true；
 * JSON 类参数不走这里，sync 参数都是路径 / 词，shell 安全）。src / python 空白视同未配置。
 */
export function buildSyncSpec(opts: BuildSyncSpecOpts): ExternalToolSpec {
  const src = opts.src?.trim() || undefined;
  const python = opts.python?.trim() || undefined;
  return {
    cmd: 'bz-face',
    args: [
      'sync',
      '--data-root',
      opts.dataRoot,
      ...(src ? ['--src', src] : []),
      ...(python ? ['--python', python] : []),
    ],
    shell: true,
  };
}

/** [bz-info]{phase:"contact"} 逐人事件 → 实时累计（识别到才动 stats，返回是否识别） */
export function collectContactInfo(stats: SyncStats, data: Record<string, unknown>): boolean {
  if (data.phase !== 'contact' || typeof data.name !== 'string' || !data.name) return false;
  if (data.status === 'ok') {
    stats.contacts++;
    if (data.chat === 'unchanged') stats.unchanged++;
    else stats.written++;
    if (Number.isFinite(data.msgs)) stats.msgTotal += Number(data.msgs);
    if (Number.isFinite(data.named)) stats.named += Number(data.named);
    return true;
  }
  if (data.status === 'skipped') {
    stats.skipped++;
    return true;
  }
  if (data.status === 'failed') {
    stats.failed++;
    stats.failures.push({ name: data.name, error: typeof data.error === 'string' ? data.error : '导出失败' });
    return true;
  }
  return false;
}

/** [bz-result] 体 → 权威统计（缺失字段回落实时累计值） */
export function statsFromResult(result: Record<string, unknown>, live: SyncStats): SyncStats {
  const num = (v: unknown, fallback: number): number => (Number.isFinite(v) ? Number(v) : fallback);
  const failures = Array.isArray(result.failures)
    ? result.failures
        .map((f): { name: string; error: string } | null => {
          const o = f as Record<string, unknown> | null;
          if (!o || typeof o.name !== 'string') return null;
          return { name: o.name, error: typeof o.error === 'string' ? o.error : '导出失败' };
        })
        .filter((f): f is { name: string; error: string } => f !== null)
    : live.failures;
  const written = num(result.written, live.written);
  const unchanged = num(result.unchanged, live.unchanged);
  return {
    contacts: num(result.contacts, written + unchanged),
    written,
    unchanged,
    skipped: num(result.skipped, live.skipped),
    failed: num(result.failed, live.failed),
    msgTotal: num(result.msgTotal, live.msgTotal),
    named: num(result.named, live.named),
    failures,
  };
}

/** 完成摘要一行（「更新数」= written） */
export function describeSyncStats(st: SyncStats): string {
  const parts = [`更新 ${st.written} 位`, `未变 ${st.unchanged} 位`, `跳过 ${st.skipped} 位`];
  if (st.failed > 0) parts.push(`${st.failed} 位失败`);
  return `同步完成：${parts.join(' · ')}，消息 ${st.msgTotal} 条`;
}

/** 错误消息取首行并限长（stderr 尾可能带多行细节，弹窗一行放不下也不抛栈） */
function firstLine(text: string, max = 200): string {
  const line = String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
  return line.length > max ? line.slice(0, max) + '…' : line;
}

/** 非 0 退出 / 无结果行时的错误面归类（人话 + 下一步动作，不抛栈） */
export function classifySyncFailure(outcome: ExternalToolOutcome): { message: string; hint: string } {
  const msg = outcome.error?.message ?? '';
  if (/ENOENT/.test(msg)) return { message: '未找到 bz-face 命令', hint: BZ_FACE_INSTALL_HINT };
  if (/EACCES|权限/.test(msg)) return { message: 'bz-face 命令没有执行权限', hint: '检查命令权限，或重新 link 后重试' };
  const stderr = outcome.stderr || '';
  if (/ModuleNotFoundError|ImportError/.test(stderr) || /ModuleNotFoundError|ImportError/.test(msg)) {
    return { message: 'Python 缺少同步依赖', hint: `${DOCTOR_HINT}，按提示安装缺的依赖后重试` };
  }
  if (/微信/.test(msg)) return { message: firstLine(msg), hint: '' }; // 工具给的中文引导已含下一步动作
  return {
    message: firstLine(msg || '同步进程异常退出，没有给出原因'),
    hint: /bz-face|doctor|pip|npm/.test(msg) ? '' : DOCTOR_HINT,
  };
}

/** ---------- 模块级状态机（单例，独立于面板生命周期） ---------- */

let state: PeopleSyncState = {
  outcome: 'idle',
  phase: null,
  pct: null,
  step: '',
  message: '',
  hint: '',
  stats: emptySyncStats(),
};

let handle: ExternalToolHandle | null = null;
const listeners = new Set<(s: PeopleSyncState) => void>();

function setState(patch: Partial<PeopleSyncState>): void {
  state = { ...state, ...patch };
  for (const fn of [...listeners]) fn(state);
}

/** 当前同步状态快照（数据源弹窗渲染 / 互斥判定同源） */
export function syncState(): PeopleSyncState {
  return state;
}

/** 同步是否进行中（ADR-0196 决策 10：画脸谱互斥的判定源） */
export function isSyncing(): boolean {
  return state.outcome === 'running';
}

/** 订阅同步状态（返回退订函数） */
export function subscribeSync(fn: (s: PeopleSyncState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 进程壳注入缝（测试打桩；生产 = core/external-tool 的 runExternalTool）。
 *  注入 / 还原同时把状态机重置回 idle——给每个用例干净起点（跨用例不残留运行态）。 */
export type SyncRunner = typeof runExternalTool;
let runner: SyncRunner = runExternalTool;

export function setSyncRunnerForTests(fn: SyncRunner | null): void {
  runner = fn ?? runExternalTool;
  handle = null;
  state = {
    outcome: 'idle',
    phase: null,
    pct: null,
    step: '',
    message: '',
    hint: '',
    stats: emptySyncStats(),
  };
}

function nonEmpty(v: unknown): string | undefined {
  const t = typeof v === 'string' ? v.trim() : '';
  return t || undefined;
}

/** 面板侧弹错（终态通知一次性发，运行中不发——进度在弹窗进度行里） */
function emitNotice(s: PeopleSyncState): void {
  if (s.outcome === 'ok') {
    if (s.stats.failed > 0) {
      const names = s.stats.failures.slice(0, 3).map((f) => f.name).join('、');
      notice(`同步完成，${s.stats.failed} 位联系人失败${names ? `（${names}${s.stats.failures.length > 3 ? '等' : ''}）` : ''}——重跑同步只补失败项`, 'warning');
    } else {
      notice(`同步完成：更新 ${s.stats.written} 位、未变 ${s.stats.unchanged} 位联系人`, 'success');
    }
    return;
  }
  if (s.outcome === 'error') notice(`同步失败：${firstLine(s.message)}`, 'error');
  if (s.outcome === 'stopped') notice('同步已停止——已导出的部分保留，重跑可续传', 'info');
}

/**
 * 开跑同步（数据源弹窗「同步」按钮）。幂等：运行中重复调用直接忽略。
 * 数据根未配置不开进程，直接落错误面（中文引导去设置页配置）。
 */
export function startSync(): void {
  if (state.outcome === 'running') return;
  const s = tryGetSettings();
  const dataRoot = String(s?.peopleDataDir ?? '').trim();
  if (!dataRoot) {
    setState({
      outcome: 'error',
      phase: null,
      pct: null,
      step: '',
      message: '先在下方配置数据根目录——同步会把微信数据解密导出到那里',
      hint: '到「设置 → 脸谱 → 数据源」粘贴数据根目录路径，再点同步',
      stats: emptySyncStats(),
    });
    return;
  }
  const spec = buildSyncSpec({
    dataRoot,
    src: nonEmpty(s?.peopleWxAccountDir),
    python: nonEmpty(s?.pythonPath),
  });
  const live = emptySyncStats();
  let result: Record<string, unknown> | null = null;
  const cbs: ExternalToolCallbacks = {
    onStep: (text) => setState({ step: text }),
    onProgress: (phase, pct) => setState({ phase, pct }),
    onInfo: (data) => {
      if (collectContactInfo(live, data)) setState({});
    },
    onResult: (data) => {
      result = data;
    },
  };
  handle = runner(spec, cbs);
  setState({ outcome: 'running', phase: null, pct: null, step: '', message: '', hint: '', stats: live });
  void handle.done.then((outcome) => {
    handle = null;
    finishSync(outcome, result);
  });
}

/** 终态分流（stopped 优先——与 core/external-tool 同口径；[bz-result] 是成果权威） */
function finishSync(outcome: ExternalToolOutcome, result: Record<string, unknown> | null): void {
  if (outcome.stopped) {
    setState({
      outcome: 'stopped',
      pct: null,
      message: '已停止',
      hint: '点「同步」重跑续传——已导出的部分不会重复搬',
    });
    emitNotice(state);
    return;
  }
  if (result && (result as Record<string, unknown>).ok === false) {
    const msg = typeof (result as Record<string, unknown>).error === 'string' && String((result as Record<string, unknown>).error).trim()
      ? String((result as Record<string, unknown>).error).trim()
      : '同步失败：工具报错，没有给出原因';
    setState({ outcome: 'error', phase: null, pct: null, message: firstLine(msg), hint: /微信|数据根/.test(msg) ? '' : DOCTOR_HINT });
    emitNotice(state);
    return;
  }
  if (outcome.ok && result && (result as Record<string, unknown>).ok === true) {
    const st = statsFromResult(result as Record<string, unknown>, state.stats);
    setState({ outcome: 'ok', phase: null, pct: 100, step: '', message: describeSyncStats(st), hint: '', stats: st });
    emitNotice(state);
    return;
  }
  const classified = classifySyncFailure(outcome);
  setState({ outcome: 'error', phase: null, pct: null, message: classified.message, hint: classified.hint });
  emitNotice(state);
}

/** 停止在跑的同步（杀进程；产物幂等，重跑续传） */
export function stopSync(): void {
  handle?.stop();
}

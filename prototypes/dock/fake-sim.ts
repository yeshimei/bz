/**
 * 工具坞行为单源 · sim 启动入口（范式随 favorites/gameshelf 适配）
 *
 * 评审壳侧启动器：把真行为层（src/dock/ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - **FakeVault 注入 core/app**：core/storage 的 jsonFileStore 真实现跑在 localStorage 上，
 *     运行记录的读路径全真；
 *   - **假 fs 注入 declaration 的 fs 缝**（`setDockFs`）：声明文件与参数值住在**工具目录**
 *     （vault 外），壳里用一张 localStorage 表模拟那片磁盘；
 *   - **种子**：往两处摆文件——工具目录里的 `dock.json`（各工具自己声明「我是谁、有什么参数、
 *     怎么跑」）与 `dock.settings.json`（用户填过的参数值），以及约定路径下的
 *     `CONFIG/STORAGE/dock/runs/<id>.json`（工具侧账本，由「工具」写，bz 只读）。
 *     刻意摆齐几种形态：当天已跑 / 逾期未跑 / 失败带 error.kind / 只有手动记录 / 声明文件
 *     读不到 / 未建立信任；
 *   - **执行注入**：`setDockRuntimeDeps({ cp })` 塞一个**假 child_process**——它按四行协议
 *     (`[bz-step]` / `[bz-p]` / `[bz-info]` / `[bz-result]`) 吐流，跑完**由它自己**把运行记录
 *     追加进 `runs/<id>.json`（这正是不变量：bz 永远不是运行记录的写者）。它按
 *     `BZ_DOCK_TOOL` 认自己是谁——不再有 `--manifest` 子命令可演（D4 修订后声明就是文件）；
 *   - **路径选择**：注入 `setSystemFolderPicker`（core/path-picker 的演示级注入点）+ 给
 *     `window.require('@electron/remote')` 一个假 dialog，让「导入声明」的选择钮可用。
 *
 * ⚠️ `Buffer`：core/external-tool 的行缓冲按字节切分，用到了 Node 的 `Buffer`。
 *    浏览器没有，故此处先装一个最小 polyfill（只实现它用到的那几个面）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_dock，iframe 壳只调 boot + openPanel + 自检钩子。
 * 插件的 ui.ts / data.ts / runner.ts / declaration.ts / schema.ts / schedule.ts / core 一律零改动——单源。
 */
import { FakeApp } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { setSystemFolderPicker } from '../../src/core/path-picker';
import { openDock, closeDock, unloadDock, setDockFs } from '../../src/dock/index';
import { setDockRuntimeDeps } from '../../src/dock/runner';
import { resolveRun, settingsPathFor, type DockFs } from '../../src/dock/declaration';
import { runSignature, type DockToolEntry } from '../../src/dock/registry';
import { triggerOf } from '../../src/dock/schedule';
import type { DockSchedule } from '../../src/dock/schema';

/** 共享数据根（插件默认 storagePath；所有路径都由它派生） */
const STORE = 'CONFIG/STORAGE/dock';
/** 壳内的「工具目录」——真机上是用户自己的脚本目录，这里只是几个好看点的假路径 */
const TOOLS_DIR = 'C:/Users/PC/scripts';
const KEY = 'bz-sim:';
const SEED_MARK = 'bz-sim:__dock_seed_v2';

declare global {
  interface Window {
    DOCK_SEED_TOOLS?: Array<Record<string, unknown>>;
  }
}

/** 某工具的声明文件路径（工具目录 = 声明文件所在目录） */
const declPathOf = (id: string): string => `${TOOLS_DIR}/${id}/dock.json`;

// ==================== Buffer polyfill（core/external-tool 的行缓冲要它） ====================
// 只兑现 BzLineSplitter 真正用到的面：from/concat/length/indexOf/subarray/toString。
// 刻意**不**继承 Uint8Array：静态侧 from 的签名与 Uint8ArrayConstructor.from 不兼容（TS2417），
// 而这里根本不需要那个继承关系——包一层字节数组即可。

class MiniBuffer {
  private bytes: Uint8Array;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }
  static from(input: string | Uint8Array, _encoding?: string): MiniBuffer {
    return input instanceof Uint8Array
      ? new MiniBuffer(input)
      : new MiniBuffer(new TextEncoder().encode(input));
  }
  static concat(parts: MiniBuffer[]): MiniBuffer {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p.bytes, off);
      off += p.length;
    }
    return new MiniBuffer(out);
  }
  get length(): number {
    return this.bytes.length;
  }
  indexOf(value: number, from = 0): number {
    for (let i = from; i < this.bytes.length; i++) if (this.bytes[i] === value) return i;
    return -1;
  }
  subarray(start = 0, end = this.bytes.length): MiniBuffer {
    return new MiniBuffer(this.bytes.subarray(start, end));
  }
  toString(_encoding?: string): string {
    return new TextDecoder().decode(this.bytes);
  }
}

function installBufferPolyfill(): void {
  const w = window as unknown as { Buffer?: unknown };
  if (!w.Buffer) w.Buffer = MiniBuffer;
}

// ==================== 时间助手（种子按「现在」锚定，相对时间才好看） ====================

function iso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ==================== 种子：声明文件 + 参数值 + 运行记录 ====================

/** 一条运行记录（形状与契约一致；bz 读它、工具写它） */
interface SeedRun {
  runId: string;
  trigger: 'auto' | 'manual';
  status: 'ok' | 'failed' | 'stopped' | 'timeout';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  exitCode?: number | null;
  message?: string;
  params?: Record<string, unknown>;
  steps?: Array<{ text: string; at?: string; status?: string }>;
  progress?: { phase: string | null; pct: number | null };
  info?: unknown[];
  result?: unknown;
  metrics?: Record<string, number>;
  artifacts?: Array<{ path: string; label?: string }>;
  error?: { kind: string; detail?: string; stderr?: string };
}

/**
 * 各工具的**声明**（就是 `dock.json` 的内容）。
 * 注意 `run` 段：`cwd` 不写 —— 缺省即声明文件所在目录，所以 `args` 里可以直接写相对文件名。
 */
const DECLARATIONS: Record<string, Record<string, unknown>> = {
  'iamtxt-signin': {
    v: 1,
    id: 'iamtxt-signin',
    name: 'iamtxt 每日签到',
    description: '每天在 iamtxt.com 自动签到拿积分；cookie 失效时要重新导出。',
    author: '叫我包仔',
    toolVersion: '1.0.2',
    icon: 'calendar-check',
    produces: ['info', 'result'],
    schedule: { kind: 'daily', hour: 9, note: '09:00 起随机 0~2 小时' },
    runtime: { estimatedSec: 25 },
    run: { cmd: `${TOOLS_DIR}/iamtxt-signin/run.cmd` },
    params: [{ key: 'cookie', label: 'Cookie', type: 'secret', help: '登录后在浏览器里复制整串 Cookie' }],
  },
  'rss-fetch': {
    v: 1,
    id: 'rss-fetch',
    name: '订阅源抓取',
    description: '把订阅源的新文章拉进剪藏目录，按增量落盘。',
    icon: 'rss',
    schedule: { kind: 'interval', everyHours: 6 },
    produces: ['result'],
    run: { cmd: 'node', args: ['fetch.mjs'] },
    params: [
      { key: 'since', label: '回溯天数', type: 'number', default: 3, min: 1, max: 30, step: 1, help: '只抓这个天数以内的新文章' },
      { key: 'full', label: '抓全文', type: 'bool', default: true },
      {
        key: 'comment',
        label: '备注',
        type: 'multiline',
        rows: 2,
        placeholder: '写进这次运行记录的备注（选填）',
      },
    ],
  },
  'drive-backup': {
    v: 1,
    id: 'drive-backup',
    name: '网盘备份',
    description: '把 vault 里的加密目录打包上云，每周日跑一次。',
    icon: 'hard-drive-upload',
    schedule: { kind: 'weekly', weekday: 0, note: '周日任意时刻' },
    runtime: { estimatedSec: 900 },
    run: { cmd: `${TOOLS_DIR}/backup/push.exe`, args: ['--quiet'] },
    params: [
      {
        key: 'mode',
        label: '模式',
        type: 'choice',
        options: [
          { value: 'incr', label: '增量' },
          { value: 'full', label: '全量' },
        ],
        default: 'incr',
      },
      { key: 'target', label: '本地中转目录', type: 'path', mode: 'dir' },
      { key: 'token', label: '网盘令牌', type: 'secret' },
    ],
  },
  'clipping-export': {
    v: 1,
    id: 'clipping-export',
    name: '剪藏导出 Markdown',
    description: '把剪藏本里的文章按标签导出成一份可分享的 Markdown 包。',
    icon: 'file-down',
    run: { cmd: `${TOOLS_DIR}/clipping/export.cmd` },
    params: [
      {
        key: 'tags',
        label: '标签',
        type: 'multichoice',
        options: [
          { value: 'tech', label: '技术' },
          { value: 'life', label: '生活' },
          { value: 'read', label: '阅读' },
        ],
      },
      { key: 'note', label: '备注', type: 'text', placeholder: '选填' },
    ],
  },
  // 未建立信任的那个：声明在、能看清它要跑什么，但用户还没点「信任」
  'imported-tool': {
    v: 1,
    id: 'imported-tool',
    name: '从朋友那拷来的工具',
    description: '朋友给的脚本，声明写得挺全 —— 但命令不是我自己的，运行前得先看一眼。',
    icon: 'package',
    run: { cmd: `${TOOLS_DIR}/from-a-friend/run.cmd` },
    params: [{ key: 'target', label: '输出目录', type: 'path', mode: 'dir' }],
  },
  // 故意**不给** local-report 声明文件：面板上它只该有「声明读不到 + 重新读」这一条路
};

/**
 * **只躺在磁盘上、还没登记**的声明 —— 演示「导入声明」这条路：
 * 壳里点「导入」时假 dialog 就把这份文件递回来。
 */
const PENDING_DECL_ID = 'newcomer';
const PENDING_DECLARATION: Record<string, unknown> = {
  v: 1,
  id: PENDING_DECL_ID,
  name: '新搬来的工具',
  description: '刚放到工具目录里的脚本：选它的 dock.json 就够了，面板自己读得出标题、参数和怎么跑。',
  icon: 'sparkles',
  schedule: { kind: 'daily', hour: 21 },
  run: { cmd: `node`, args: ['newcomer.mjs'] },
  params: [{ key: 'greeting', label: '问候语', type: 'text', default: '你好' }],
};

/** 用户填过的参数值（就是工具目录里的 `dock.settings.json`） */
const SETTINGS: Record<string, Record<string, unknown>> = {
  'clipping-export': { tags: ['tech', 'read'], note: '给同事的版本' },
  'iamtxt-signin': { cookie: 'session=sim-cookie-value; uid=10086' },
};

const RUNS: Record<string, SeedRun[]> = {
  // 今天已跑：ok
  'iamtxt-signin': [
    { runId: 's-1', trigger: 'auto', status: 'ok', startedAt: iso(6 * HOUR), finishedAt: iso(6 * HOUR - 1800), durationMs: 1800, exitCode: 0, message: '签到成功，+2 分', progress: { phase: '签到', pct: 100 }, result: { balance: 52, signedDate: new Date().toISOString().slice(0, 10) }, metrics: { pointsGained: 2 }, steps: [{ text: '检查登录态' }, { text: '发起签到' }] },
    { runId: 's-2', trigger: 'auto', status: 'ok', startedAt: iso(1 * DAY + 5 * HOUR), finishedAt: iso(1 * DAY + 5 * HOUR - 1500), durationMs: 1500, exitCode: 0, message: '签到成功，+1 分' },
    { runId: 's-3', trigger: 'auto', status: 'failed', startedAt: iso(3 * DAY + 5 * HOUR), finishedAt: iso(3 * DAY + 5 * HOUR - 900), durationMs: 900, exitCode: 2, message: '登录态已失效', error: { kind: 'auth', detail: 'cookie 里的 session 字段过期', stderr: 'ERROR auth: session expired at signin.ts:42' } },
    { runId: 's-4', trigger: 'auto', status: 'ok', startedAt: iso(4 * DAY + 5 * HOUR), exitCode: 0, message: '签到成功，+3 分' },
  ],
  // 超过声明间隔：逾期（最近 7 次有两次失败）
  'rss-fetch': [
    { runId: 'r-1', trigger: 'auto', status: 'ok', startedAt: iso(9 * HOUR), durationMs: 42_000, exitCode: 0, message: '抓到 12 篇新文章', result: { fetched: 12, skipped: 3 }, metrics: { fetched: 12 }, steps: [{ text: '读取订阅源（18 个）' }, { text: '增量比对' }, { text: '落盘 12 篇' }] },
    { runId: 'r-2', trigger: 'auto', status: 'failed', startedAt: iso(15 * HOUR), exitCode: 1, message: '有三个源连不上', error: { kind: 'network', detail: 'ETIMEDOUT', stderr: 'fetch failed: 3 sources timed out' } },
    { runId: 'r-3', trigger: 'auto', status: 'ok', startedAt: iso(21 * HOUR), exitCode: 0, message: '抓到 5 篇新文章' },
    { runId: 'r-4', trigger: 'auto', status: 'failed', startedAt: iso(27 * HOUR), exitCode: 1, message: '源站返回 403', error: { kind: 'auth' } },
    { runId: 'r-5', trigger: 'auto', status: 'ok', startedAt: iso(33 * HOUR), exitCode: 0, message: '抓到 0 篇新文章' },
    { runId: 'r-6', trigger: 'auto', status: 'ok', startedAt: iso(39 * HOUR), exitCode: 0, message: '抓到 7 篇新文章' },
    { runId: 'r-7', trigger: 'auto', status: 'ok', startedAt: iso(45 * HOUR), exitCode: 0, message: '抓到 2 篇新文章' },
  ],
  // 上周日过、本周日也过，且**最近一次是失败**：卡面该同时给出「逾期 + 怎么办」
  'drive-backup': [
    { runId: 'd-1', trigger: 'auto', status: 'failed', startedAt: iso(9 * DAY), finishedAt: iso(9 * DAY - 4000), exitCode: 2, message: '网盘令牌过期，上传被拒', error: { kind: 'auth', detail: 'refresh_token 已失效', stderr: 'ERROR auth: refresh_token expired (drive.ts:88)' } },
    { runId: 'd-2', trigger: 'auto', status: 'ok', startedAt: iso(16 * DAY), durationMs: 812_000, exitCode: 0, message: '备份完成，上传 1.2 GB', artifacts: [{ path: 'D:/backup/2026-09-18.tar.zst', label: '归档包' }] },
    { runId: 'd-3', trigger: 'auto', status: 'timeout', startedAt: iso(23 * DAY), exitCode: null, message: '上传超时', error: { kind: 'timeout', detail: '超过 15 分钟硬上限' } },
  ],
  // 只有手动记录；含一次带可操作提示的失败 + 结构化产出
  'clipping-export': [
    { runId: 'c-1', trigger: 'manual', status: 'ok', startedAt: iso(2 * DAY), durationMs: 6400, exitCode: 0, message: '导出 38 篇，共 412 KB', params: { tags: ['tech', 'read'], note: '给同事的版本' }, metrics: { articles: 38, bytes: 421888 }, result: { files: 38, path: 'CONFIG/STORAGE/dock/out/clipping-2026-10-01.zip' }, artifacts: [{ path: 'CONFIG/STORAGE/dock/out/clipping-2026-10-01.zip', label: '导出包' }], steps: [{ text: '收集带标签的条目' }, { text: '渲染 Markdown' }, { text: '打包' }] },
    { runId: 'c-2', trigger: 'manual', status: 'failed', startedAt: iso(5 * DAY), exitCode: 3, message: '缺必填的标签', error: { kind: 'config', detail: '--tags 为空', stderr: 'usage: clipping-export --tags=a,b' } },
  ],
  // 一条都没有：记录文件的「空账本」（工具写过、但还没跑过）
  'local-report': [],
};

/**
 * 工具登记 —— **只记 bz 自己那份事实**（id + 声明文件路径 + 信任/启用）。
 * `trustedRun` 是「建立信任时那条命令」的签名：声明文件改了命令，它就对不上，面板会重新问一次。
 */
function seedEntries(): DockToolEntry[] {
  const trustedAt = iso(30 * DAY);
  const list: DockToolEntry[] = [];
  for (const [id, decl] of Object.entries(DECLARATIONS)) {
    const path = declPathOf(id);
    const run = resolveRun(decl as never, path);
    const trusted = id !== 'imported-tool';
    list.push({
      id,
      path,
      ...(trusted ? { trustedAt } : {}),
      ...(trusted && run ? { trustedRun: runSignature(run) } : {}),
    });
  }
  // 声明文件故意缺失的那个：登记在册，但读不到声明
  list.push({ id: 'local-report', path: declPathOf('local-report'), trustedAt });
  return list;
}

function wipeSimFiles(): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY)) doomed.push(k);
  }
  for (const k of doomed) localStorage.removeItem(k);
}

/** 壳内「工具目录那片磁盘」：路径 → localStorage 键 */
const fileKeyOf = (p: string): string => KEY + p.replace(/\\/g, '/');

function seedStore(): void {
  if (localStorage.getItem(SEED_MARK)) return;
  wipeSimFiles();
  const updatedAt = new Date().toISOString();

  // 工具目录：声明 + 参数值
  for (const [id, decl] of Object.entries(DECLARATIONS)) {
    const declPath = declPathOf(id);
    localStorage.setItem(fileKeyOf(declPath), JSON.stringify(decl, null, 2));
    const values = SETTINGS[id];
    if (values) {
      localStorage.setItem(
        fileKeyOf(settingsPathFor(declPath)),
        JSON.stringify({ v: 1, tool: id, values }, null, 2),
      );
    }
  }
  // 只躺盘上的那份（等着被「导入」）
  localStorage.setItem(
    fileKeyOf(declPathOf(PENDING_DECL_ID)),
    JSON.stringify(PENDING_DECLARATION, null, 2),
  );

  // vault 内：运行记录（工具写的那份账本）
  for (const id of Object.keys(DECLARATIONS).concat('local-report')) {
    localStorage.setItem(
      `${KEY}${STORE}/runs/${id}.json`,
      JSON.stringify({ v: 1, tool: id, updatedAt, runs: RUNS[id] ?? [] }, null, 2),
    );
  }
  localStorage.setItem(SEED_MARK, new Date().toISOString());
}

// ==================== 假 child_process（四行协议 + 自己落账） ====================

type Listener = (...args: unknown[]) => void;

class MiniEmitter {
  private map = new Map<string, Listener[]>();
  on(evt: string, fn: Listener): void {
    if (!this.map.has(evt)) this.map.set(evt, []);
    this.map.get(evt)!.push(fn);
  }
  emit(evt: string, ...args: unknown[]): void {
    for (const fn of this.map.get(evt) ?? []) fn(...args);
  }
}

/** 运行记录路径 → localStorage 键 */
function runsKeyOf(envPath: string | undefined): string | null {
  return envPath ? KEY + envPath.replace(/\\/g, '/') : null;
}

/** 把一次运行追加进「工具自己的账本」（新的在前，封顶 200 —— 裁剪是工具的活） */
function appendRun(envPath: string | undefined, record: SeedRun): void {
  const key = runsKeyOf(envPath);
  if (!key) return;
  let file: { v: number; tool: string; updatedAt: string; runs: SeedRun[] };
  try {
    file = JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    file = null as never;
  }
  if (!file || !Array.isArray(file.runs)) {
    const tool = (envPath ?? '').split('/').pop()!.replace(/\.json$/, '');
    file = { v: 1, tool, updatedAt: '', runs: [] };
  }
  file.runs.unshift(record);
  if (file.runs.length > 200) file.runs.length = 200;
  file.updatedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(file, null, 2));
}

/** 假 child_process：spawn 出来的「进程」按四行协议吐流，跑完自己落账 */
function makeFakeCp() {
  return {
    spawn(cmd: string, args: string[], opts: { env?: Record<string, string> } = {}) {
      const emitter = new MiniEmitter();
      // 认自己是谁靠 bz 注入的环境变量（不再有 --manifest 子命令可问）
      const tool = opts.env?.BZ_DOCK_TOOL ?? 'unknown';
      const runsFile = opts.env?.BZ_DOCK_RUNS_FILE;
      let killed = false;
      let timer = 0;

      const write = (line: string) => {
        if (killed) return;
        emitter.emit('out', line + '\n');
      };
      const later = (ms: number, fn: () => void) => {
        timer = window.setTimeout(() => {
          if (!killed) fn();
        }, ms);
      };
      const finish = (code: number | null, stderr = '') => {
        if (killed) return;
        if (stderr) emitter.emit('err', stderr);
        window.clearTimeout(timer);
        emitter.emit('close', code);
      };

      // ---- 一次运行 ----
      const startedAt = new Date().toISOString();
      const willFail = tool === 'unknown' || tool.includes('fail');
      const steps = willFail
        ? ['检查登录态', '发起请求']
        : ['检查登录态', '发起请求', '读取返回', '落盘'];
      // 步进 420ms：既让评审时看得清实时步骤，也给「运行中的卡」留足断言窗口
      const STEP_MS = 420;
      steps.forEach((s, i) => later(150 + i * STEP_MS, () => write(`[bz-step] ${s}`)));
      const total = steps.length;
      let phase = 0;
      const tick = window.setInterval(() => {
        if (killed) return;
        phase += 1;
        write(`[bz-p] ${JSON.stringify({ phase: steps[Math.min(phase, total - 1)], pct: Math.min(100, Math.round((phase / total) * 100)) })}`);
      }, STEP_MS);

      later(150 + total * STEP_MS, () => {
        window.clearInterval(tick);
        const finishedAt = new Date().toISOString();
        if (willFail) {
          write(`[bz-info] ${JSON.stringify({ reason: '模拟失败', at: finishedAt })}`);
          const rec: SeedRun = {
            runId: `sim-${Date.now()}`,
            trigger: 'manual',
            status: 'failed',
            startedAt,
            finishedAt,
            exitCode: 1,
            message: '模拟失败：命令返回非零退出码',
            steps: steps.map((t) => ({ text: t })),
            error: { kind: 'unknown', detail: '这是壳里的模拟失败', stderr: 'simulated failure (prototype)' },
          };
          appendRun(runsFile, rec);
          finish(1, 'simulated failure (prototype)');
          return;
        }
        write(`[bz-result] ${JSON.stringify({ ok: true, at: finishedAt, note: '壳内模拟执行' })}`);
        const rec: SeedRun = {
          runId: `sim-${Date.now()}`,
          trigger: 'manual',
          status: 'ok',
          startedAt,
          finishedAt,
          exitCode: 0,
          message: '壳内模拟执行完成（这条记录由「工具」自己落账）',
          steps: steps.map((t) => ({ text: t })),
          progress: { phase: steps[total - 1], pct: 100 },
          result: { ok: true, tool, cmd, args, at: finishedAt },
        };
        appendRun(runsFile, rec);
        finish(0);
      });

      return makeChild(emitter, () => {
        killed = true;
        window.clearTimeout(timer);
      });
    },
  };
}

function makeChild(emitter: MiniEmitter, kill: () => void) {
  return {
    stdout: { on: (evt: string, fn: Listener) => emitter.on(evt === 'data' ? 'out' : evt, fn) },
    stderr: { on: (evt: string, fn: Listener) => emitter.on(evt === 'data' ? 'err' : evt, fn) },
    on: (evt: string, fn: Listener) => emitter.on(evt, fn),
    // 杀掉也要补一条 close（code=null）：core/external-tool 靠 close 才算终结，
    // 不补的话「停止」在壳里会把运行卡在 running（真机上进程被 kill 是会 close 的）。
    kill: () => {
      kill();
      window.setTimeout(() => emitter.emit('close', null), 60);
    },
  };
}

// ==================== 假 fs（工具目录那片磁盘） ====================

/** 声明 / 参数值住在 vault 外，壳里用 localStorage 假装那片磁盘 */
function makeFakeFs(): DockFs {
  return {
    readText: (p) => localStorage.getItem(fileKeyOf(p)),
    writeText: (p, d) => localStorage.setItem(fileKeyOf(p), d),
    rename: (from, to) => {
      const v = localStorage.getItem(fileKeyOf(from));
      if (v === null) throw new Error('ENOENT: ' + from);
      localStorage.setItem(fileKeyOf(to), v);
      localStorage.removeItem(fileKeyOf(from));
    },
  };
}

// ==================== 注入与启动 ====================

const settingsStore: Record<string, unknown> = {
  storagePath: 'CONFIG/STORAGE',
  dockTools: seedEntries(),
  dockNotifyMissed: true,
};

let simApp: FakeApp | null = null;

function installPathPickers(): void {
  // 目录选择：core/path-picker 的演示级注入点（path 型参数用）
  setSystemFolderPicker(async () => 'C:/Users/PC/backup-staging');
  // 文件选择：core/path-picker 走 window.require('@electron/remote')，这里给个假 dialog。
  // 「导入声明」要的是 dock.json —— 直接递 iamtxt 那份，把整条导入链演完整。
  const w = window as unknown as { require?: (m: string) => unknown };
  w.require = (m: string) =>
    m === '@electron/remote'
      ? {
          dialog: {
            showOpenDialog: async (o: { title?: string }) =>
              /声明/.test(o?.title ?? '')
                ? { canceled: false, filePaths: [declPathOf(PENDING_DECL_ID)] }
                : { canceled: true, filePaths: [] },
          },
        }
      : null;
}

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootDockSim(): void {
  const g = window as unknown as { __bzDockSimBooted?: boolean };
  if (g.__bzDockSimBooted) return;
  g.__bzDockSimBooted = true;
  installBufferPolyfill();
  installPathPickers();
  seedStore();
  const app = new FakeApp();
  simApp = app;
  setApp(app as never);
  setSettingsProvider(() => settingsStore as never);
  setSettingsSaver(async () => {
    localStorage.setItem('bz-sim:__dock_settings', JSON.stringify(settingsStore));
  });
  setDockFs(makeFakeFs());
  setDockRuntimeDeps({ cp: makeFakeCp() });

  // 种子事实外露（评审壳自检按它现算期望值，避免壳里硬编码一份会漂的数字）。
  // 「自动化 / 手动」按声明的节奏现推 —— 与面板同源（triggerOf），壳里不另算一套。
  const entries = seedEntries();
  const scheduleOf = (id: string): DockSchedule | undefined =>
    DECLARATIONS[id]?.schedule as DockSchedule | undefined;
  (window as unknown as { DOCK_SEED?: unknown }).DOCK_SEED = {
    total: entries.length,
    auto: entries.filter((e) => triggerOf(scheduleOf(e.id)) === 'auto').length,
    manual: entries.filter((e) => triggerOf(scheduleOf(e.id)) === 'manual').length,
    noDecl: entries.filter((e) => !(e.id in DECLARATIONS)).length,
    untrusted: entries.filter((e) => !e.trustedAt).length,
    runs: Object.fromEntries(
      Object.keys(DECLARATIONS)
        .concat('local-report')
        .map((id) => [id, (RUNS[id] ?? []).length]),
    ),
    // 详情页要断言的几个字符串也从种子里现取，别在壳里复述
    clippingCmd: String(
      (DECLARATIONS['clipping-export'].run as { cmd?: string } | undefined)?.cmd ?? '',
    ),
    clippingDeclPath: declPathOf('clipping-export'),
    // 「导入声明」演示：它躺在工具目录里但还没登记，导入后总数 +1
    pendingImport: {
      id: PENDING_DECL_ID,
      name: String(PENDING_DECLARATION.name ?? ''),
      cmd: String((PENDING_DECLARATION.run as { cmd?: string } | undefined)?.cmd ?? ''),
      params: Array.isArray(PENDING_DECLARATION.params) ? PENDING_DECLARATION.params.length : 0,
    },
  };
}

/** 打开工具坞面板（命令 bz-dock-open 同语义） */
export function openDockPanel(): void {
  bootDockSim();
  openDock(simApp as never);
}

export { closeDock as closeDockPanel };

/** 卸载（main.ts onunload 同链） */
export function unloadDockSim(): void {
  unloadDock();
  simApp = null;
}

/** 重置演示数据（壳的重置钮用）：清 fake vault 与种子标记，由调用方 reload 重灌 */
export function resetDockSim(): void {
  wipeSimFiles();
}

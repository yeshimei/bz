/**
 * 外部工具调用壳 + 四行协议解析（核心层可复用，issue 461 / ADR-0195 / ADR-0196）。
 *
 * 协议（与知识盒 bili-dl 同口径，ADR-0196 决策 5）——工具进程 stdout 逐行输出：
 *   [bz-step] <步骤文案>                    → 步骤行：文案透传给 onStep
 *   [bz-p] {"phase":"download","pct":35}    → 阶段进度行：pct 0-100，null=该阶段不可估（绝不假报）
 *   [bz-info] {...}                         → 解析信息行：JSON 体原样交给 onInfo
 *   [bz-result] {...}                       → 交付结果行：JSON 体原样交给 onResult
 *
 * 本模块职责：进程生命周期（spawn / stop（含 3 秒未退升级强杀整树）/ 终结分流）、stdout 逐行解析（跨 chunk 行缓冲、
 * 多字节安全、超长行截断）、畸形行容错（坏协议行忽略、非协议行透传）、stderr 尾部收集
 * （2KB 滑窗）与退出码语义（code 0=成功；经 stop()=中止；其余=失败且错误带 stderr）。
 * 知识盒本次不动（继续用自己的实现，src/knowledge/processor.ts）；后续外部工具集成
 * （脸谱工具包 bz-face 等）统一走此模块。依赖方向：core 层，不 import 任何 src/<域>/。
 */

/** ---------- 协议行解析（纯函数，独立可测） ---------- */

/** 四行协议解析出的事件（raw = 非协议输出原样透传） */
export type BzToolEvent =
  | { kind: 'step'; text: string }
  | { kind: 'progress'; phase: string | null; pct: number | null }
  | { kind: 'info'; data: Record<string, unknown> }
  | { kind: 'result'; data: Record<string, unknown> }
  | { kind: 'raw'; text: string };

const BZ_LINE_PREFIX_RE = /^\[bz-(step|p|info|result)\]/;

/**
 * 解析单行协议输出。永不抛异常。
 * 返回 null（忽略）的情形：空行 / 纯空白行 / 协议前缀行但体损坏（JSON 坏、step 空文案）
 * ——与知识盒「忽略坏行」同口径；非协议输出原样透传为 { kind:'raw' }。
 */
export function parseBzLine(line: string): BzToolEvent | null {
  const text = line.endsWith('\r') ? line.slice(0, -1) : line; // CRLF 剥除
  const m = text.match(BZ_LINE_PREFIX_RE);
  if (!m) {
    if (!text.trim()) return null; // 空行：忽略
    return { kind: 'raw', text }; // 非协议输出：原样透传
  }
  const body = text.slice(m[0].length).trim();
  switch (m[1]) {
    case 'step':
      return body ? { kind: 'step', text: body } : null; // 空文案 = 畸形：忽略
    case 'p': {
      const p = parseJsonObject(body);
      if (!p) return null;
      return {
        kind: 'progress',
        phase: typeof p.phase === 'string' ? p.phase : null,
        // pct 允许 null = 该阶段不可估；缺失/非有限数一律归 null（绝不假报）
        pct: Number.isFinite(p.pct as number) ? Number(p.pct) : null,
      };
    }
    case 'info': {
      const info = parseJsonObject(body);
      return info ? { kind: 'info', data: info } : null;
    }
    default: {
      const r = parseJsonObject(body);
      return r ? { kind: 'result', data: r } : null;
    }
  }
}

/** JSON 体解析：坏体 / 非普通对象（数组、原始值）一律返回 null（不抛） */
function parseJsonObject(body: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(body);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** ---------- stdout 行缓冲（跨 chunk、多字节安全、超长截断） ---------- */

/** 单行字节上限（1 MiB）：超长行截断透传，不抛异常、不无限吃内存 */
export const MAX_LINE_BYTES = 1024 * 1024;

/**
 * stdout 行缓冲：字节级扫描换行（UTF-8 续字节 ≥0x80，不会与 0x0A 相撞，多字节被
 * chunk 劈开也能正确解码），跨 chunk 拼半行，超出单行上限的行截断透传。
 */
export class BzLineSplitter {
  private parts: Buffer[] = [];
  private len = 0;
  private overflowed = false;

  constructor(private maxLineBytes: number = MAX_LINE_BYTES) {}

  /** 喂一段 stdout（Buffer 或 string），返回其中切出的完整行（不含行尾符） */
  push(chunk: string | Buffer): string[] {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    const lines: string[] = [];
    let pos = 0;
    while (pos < buf.length) {
      const nl = buf.indexOf(0x0a, pos);
      if (nl === -1) {
        this.accumulate(buf.subarray(pos));
        break;
      }
      this.accumulate(buf.subarray(pos, nl));
      lines.push(this.takeLine());
      pos = nl + 1;
    }
    return lines;
  }

  /** 进程终结时冲刷残留半行（无残留返回 null）——无尾换行的最后一行靠这里出列 */
  flush(): string | null {
    return this.len > 0 || this.overflowed ? this.takeLine() : null;
  }

  /** 累积字节；超出单行上限后丢弃后续字节（截断语义，待换行时一并出列） */
  private accumulate(part: Buffer): void {
    if (this.overflowed) return;
    const room = this.maxLineBytes - this.len;
    if (part.length <= room) {
      this.parts.push(part);
      this.len += part.length;
    } else {
      this.parts.push(part.subarray(0, room));
      this.len = this.maxLineBytes;
      this.overflowed = true;
    }
  }

  /** 出列一行（overflow 时为截断行）；CRLF 的 \r 在此剥除 */
  private takeLine(): string {
    const s = Buffer.concat(this.parts).toString('utf8');
    this.parts = [];
    this.len = 0;
    this.overflowed = false;
    return s.endsWith('\r') ? s.slice(0, -1) : s;
  }
}

/** ---------- 调用壳（spawn + 生命周期 + 终结分流） ---------- */

export interface ExternalToolSpec {
  /** 命令（如 'bz-face'；Windows .cmd shim 需配 shell:true） */
  cmd: string;
  /** 参数表 */
  args?: string[];
  /** 经 shell 启动（.cmd shim 必须；含引号/空格的 JSON 参数自行 base64，参考知识盒 b64: 口径） */
  shell?: boolean;
  /** 子进程工作目录（缺省继承宿主） */
  cwd?: string;
  /** 子进程环境变量（缺省继承宿主） */
  env?: Record<string, string>;
}

export interface ExternalToolCallbacks {
  /** [bz-step] 步骤文案 */
  onStep(text: string): void;
  /** [bz-p] 阶段进度（phase / pct 均可为 null：阶段未知 / 该阶段不可估） */
  onProgress(phase: string | null, pct: number | null): void;
  /** [bz-info] 解析信息体 */
  onInfo(data: Record<string, unknown>): void;
  /** [bz-result] 交付结果体 */
  onResult(data: Record<string, unknown>): void;
  /** 非协议输出透传（可选：日志/透显用；畸形协议行不进这里——它们被忽略） */
  onRaw?(text: string): void;
}

/** 进程终结结果（done 永不 reject，调用方按 ok / stopped / error 三态分流） */
export interface ExternalToolOutcome {
  /** 正常退出（code 0）且未被 stop */
  ok: boolean;
  /** 经 stop() 主动停止（即使退出码 0 也按中止算） */
  stopped: boolean;
  /** 退出码；null = 进程未能启动 */
  code: number | null;
  /** stderr 尾部（2KB 滑窗，可能为空串） */
  stderr: string;
  /** 失败原因：spawn 失败或非 0 退出时给出带 stderr 的错误；成功 / 中止为 null */
  error: Error | null;
}

export interface ExternalToolHandle {
  /** 停止在跑进程（幂等）；温和 kill 约 3 秒（FORCE_KILL_GRACE_MS）没退干净会升级强杀整棵树；停止后的终结一律按 stopped 算 */
  stop(): void;
  /** 进程终结 Promise（永不 reject） */
  done: Promise<ExternalToolOutcome>;
}

/** child_process 注入口（测试打桩用；缺省桌面端 window.require('child_process')） */
export interface ExternalToolDeps {
  cp?: any;
}

/** stderr 尾部滑窗字符数（同知识盒口径：留尾不留头，失败原因取最后可见内容） */
const STDERR_TAIL_CHARS = 2048;

/**
 * 强杀宽限：温和 kill 之后给工具这么久自己退，到点还没退干净才升级强杀整棵树。
 * 导出常量是为了测试与调用方对得上「约 3 秒」这个数，不另立口径。
 */
export const FORCE_KILL_GRACE_MS = 3000;

/** 桌面端专属（同知识盒 processor）：非桌面端返回 null */
function defaultChildProcess(): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (!w.require) return null;
  try {
    return w.require('child_process');
  } catch {
    return null;
  }
}

/**
 * 启动外部工具并挂上四行协议解析。同步返回撤销句柄（stop 可停止在跑进程）；
 * 进程终结后 done 以三态分流：ok（code 0）/ stopped（主动停止）/ 失败（error 带 stderr）。
 */
export function runExternalTool(spec: ExternalToolSpec, cb: ExternalToolCallbacks, deps?: ExternalToolDeps): ExternalToolHandle {
  const cp = deps && deps.cp ? deps.cp : defaultChildProcess();
  const splitter = new BzLineSplitter();
  let stderrTail = '';
  let settled = false;
  let stopped = false;
  let child: any = null;
  /** 直属进程是否已退（exit 事件到过）；强杀到点时靠它分辨「赖着不走」与「根死了、孤儿压着管道」 */
  let exitSeen = false;
  let exitCode: number | null = null;
  /** 强杀宽限定时器；终结（close / error / 强制结算）即摘，绝不悬挂（摘除收口在 settle） */
  let forceTimer: ReturnType<typeof setTimeout> | null = null;

  let resolveDone!: (o: ExternalToolOutcome) => void;
  const done = new Promise<ExternalToolOutcome>((r) => {
    resolveDone = r;
  });
  const settle = (o: ExternalToolOutcome): void => {
    if (settled) return; // 幂等护栏：error/close/重复 close 只取第一个终结
    settled = true;
    // 任何终结都意味着不再需要强杀（进程自然退干净，或已按 stopped 强制结算）
    if (forceTimer !== null) {
      clearTimeout(forceTimer);
      forceTimer = null;
    }
    resolveDone(o);
  };

  // stderr 尾部滑窗：超窗即裁到窗口（给出去的 stderr 恒 ≤ 2KB，长跑进程不攒内存）
  const collectStderr = (d: string | Buffer): void => {
    stderrTail += String(d);
    if (stderrTail.length > STDERR_TAIL_CHARS) stderrTail = stderrTail.slice(-STDERR_TAIL_CHARS);
  };

  const dispatchLine = (line: string): void => {
    const ev = parseBzLine(line);
    if (!ev) return;
    switch (ev.kind) {
      case 'step':
        cb.onStep(ev.text);
        break;
      case 'progress':
        cb.onProgress(ev.phase, ev.pct);
        break;
      case 'info':
        cb.onInfo(ev.data);
        break;
      case 'result':
        cb.onResult(ev.data);
        break;
      case 'raw':
        if (cb.onRaw) cb.onRaw(ev.text);
        break;
    }
  };

  if (!cp) {
    settle({ ok: false, stopped: false, code: null, stderr: '', error: new Error('仅桌面端可用：外部工具需要 Node.js 子进程') });
    return { stop: () => {}, done };
  }

  const spawnOpts: any = { shell: !!spec.shell, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] };
  if (spec.cwd) spawnOpts.cwd = spec.cwd;
  if (spec.env) spawnOpts.env = spec.env;
  try {
    child = cp.spawn(spec.cmd, spec.args || [], spawnOpts);
  } catch (e: any) {
    settle({ ok: false, stopped: false, code: null, stderr: stderrTail.trim(), error: new Error(`外部工具启动失败：${e?.message || String(e)}`) });
    return { stop: () => {}, done };
  }

  child.stdout?.on('data', (d: string | Buffer) => {
    for (const line of splitter.push(d)) dispatchLine(line);
  });
  child.stderr?.on('data', collectStderr);
  child.on('error', (e: Error) => {
    // 已终结（spawn 同步抛错路径）或 error 后再补发 close：一律忽略
    if (settled) return;
    settle({ ok: false, stopped: false, code: null, stderr: stderrTail.trim(), error: new Error(`外部工具启动失败：${e.message}`) });
  });
  child.on('exit', (code: number | null) => {
    // 只记账不结算：终结分流仍归 close（stdio 收尾、残留行冲刷都在那边）
    exitSeen = true;
    exitCode = code;
  });
  child.on('close', (code: number | null) => {
    if (settled) return;
    const rest = splitter.flush();
    if (rest !== null) dispatchLine(rest); // 无尾换行的残留行照常走解析
    const stderr = stderrTail.trim();
    if (stopped) {
      // 中止优先：即使进程恰好正常退出也按 stopped 算（同知识盒 abort 口径）
      settle({ ok: false, stopped: true, code, stderr, error: null });
      return;
    }
    if (code === 0) {
      settle({ ok: true, stopped: false, code: 0, stderr, error: null });
      return;
    }
    const err = new Error(code === null ? `外部工具异常退出（无退出码）${stderr ? '：' + stderr : ''}` : `外部工具异常退出（退出码 ${code}）${stderr ? '：' + stderr : ''}`);
    (err as any).stderr = stderr; // 结构化取用：不想拼消息的调用方直接读 stderr 字段
    settle({ ok: false, stopped: false, code, stderr, error: err });
  });

  // ---------- 停止的强杀升级（进程树） ----------

  const isWindows = (): boolean => process.platform === 'win32';

  /**
   * 起一个 fire-and-forget 的强杀辅助进程（taskkill，裸名即可：System32 恒在 PATH，
   * 干净 env 也起得来）。起失败 / 异步 error 都静默——强杀是升级手段，不能反过来把调用方炸了
   * （ChildProcess 没有 error 监听器时，'error' 事件会抛成未处理异常）。
   */
  const spawnSuppressed = (cmd: string, args: string[]): void => {
    try {
      const killer = cp.spawn(cmd, args, { stdio: 'ignore', windowsHide: true });
      killer.on?.('error', () => {});
    } catch {
      /* 起不来就放弃这一手 */
    }
  };

  /**
   * 宽限到点、close 仍没来 → 强杀升级。
   *
   * 为什么是「升级」而不是「替换」：温和 kill 给工具收拾尾巴的机会（POSIX 的 SIGTERM 可被
   * 捕获，工具能冲缓存、删临时件、写完最后一行账），强杀不给；3 秒是宽限——正常工具被掐断
   * 后毫秒级就退了，强杀那步几乎永远轮不到，轮到就说明真有进程赖着。close 是「到点没退」的
   * 判据而不是 exit：经 shell 启动时被杀的就是壳，exit 照发，close 却被攥着 stdio 管道的
   * 孤儿真身压住——那正是要强杀的信号。
   *
   * 手段：Windows 用 `taskkill /pid <pid> /T /F` 整树收割（/T 连子进程、/F 强制）；非 Windows
   * 用 `process.kill(pid, 'SIGKILL')` 兜底——SIGKILL 只及直属进程、**非树**，壳下的真身够不着，
   * 这是没有进程组可用时的已知局限（别把这一步当成整树保证）。
   *
   * 还有一类死法强杀也够不着：直属进程已 exit、close 没来——树根没了，`taskkill /T` 无根可寻
   * （实测对死 pid 直接报「没有找到进程」），孤儿真身是盲区。这时能做的只有**立刻按 stopped
   * 结算**：dock 调度器串行跑批，一次悬挂 = 整个队列停摆，「不堵队列」比「杀干净」更不能让。
   */
  const escalateForceKill = (): void => {
    forceTimer = null;
    if (settled) return; // 宽限期内进程已退干净：什么也不做（settle 已摘表，这里双保险）
    const pid = child?.pid;
    if (typeof pid !== 'number' || pid <= 0) return;
    if (exitSeen) {
      // 根已死、管道被孤儿攥着：放弃收割，按 stopped 结算（退出码用 exit 记下的那份）
      settle({ ok: false, stopped: true, code: exitCode, stderr: stderrTail.trim(), error: null });
      return;
    }
    if (isWindows()) {
      spawnSuppressed('taskkill', ['/pid', String(pid), '/T', '/F']);
      return; // 强杀已出手：给内核一点时间收管道，close 照常走自然终结分流
    }
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* 已退出（ESRCH） */
    }
  };

  /**
   * 温和一步。经 shell 启动的（Windows .cmd/.bat，dock 域对这类命令自动开 shell）有个特别的坑，
   * 也是这次升级的由来：child.kill() 只杀 cmd.exe 壳，真身（node/python）变孤儿继续跑——
   * close 永远不来、done 永不结算。而且 TerminateProcess 本就没有「收拾尾巴」可言，杀壳这一下
   * 既不温和，还把树根提前杀掉（taskkill /T 需要活根才能整树收割，见 escalateForceKill）。
   * 所以 shell 场景的温和一步改用**不带 /F 的 taskkill /T**：控制台进程杀不动（根活着留给强杀
   * 那步整树收割），带窗口的进程则得到一次体面收尾的机会；宽限时长由上面的定时器统一给。
   * 非 shell 的照旧 child.kill()——直属进程没有「壳」可绕，POSIX 上它就是可捕获的 SIGTERM。
   */
  const stopChild = (): void => {
    const pid = child?.pid;
    if (spec.shell && isWindows() && typeof pid === 'number' && pid > 0) {
      spawnSuppressed('taskkill', ['/pid', String(pid), '/T']);
    } else {
      try {
        child?.kill?.();
      } catch {
        /* 已退出 */
      }
    }
    // 3 秒宽限：到点没退干净才升级。pid 拿不到（测试假件/异常形态）就没有可杀对象，不排程
    if (typeof pid === 'number' && pid > 0) {
      forceTimer = setTimeout(escalateForceKill, FORCE_KILL_GRACE_MS);
    }
  };

  return {
    stop: () => {
      if (settled || stopped) return; // 幂等：重复 stop 不再补 kill、不重排强杀
      stopped = true;
      stopChild();
    },
    done,
  };
}

/**
 * 外部工具调用壳 + 四行协议解析（核心层可复用，issue 461 / ADR-0195 / ADR-0196）。
 *
 * 协议（与知识盒 bili-dl 同口径，ADR-0196 决策 5）——工具进程 stdout 逐行输出：
 *   [bz-step] <步骤文案>                    → 步骤行：文案透传给 onStep
 *   [bz-p] {"phase":"download","pct":35}    → 阶段进度行：pct 0-100，null=该阶段不可估（绝不假报）
 *   [bz-info] {...}                         → 解析信息行：JSON 体原样交给 onInfo
 *   [bz-result] {...}                       → 交付结果行：JSON 体原样交给 onResult
 *
 * 本模块职责：进程生命周期（spawn / stop / 终结分流）、stdout 逐行解析（跨 chunk 行缓冲、
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
  /** 停止在跑进程（幂等）；停止后的终结一律按 stopped 算 */
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

  let resolveDone!: (o: ExternalToolOutcome) => void;
  const done = new Promise<ExternalToolOutcome>((r) => {
    resolveDone = r;
  });
  const settle = (o: ExternalToolOutcome): void => {
    if (settled) return; // 幂等护栏：error/close/重复 close 只取第一个终结
    settled = true;
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

  return {
    stop: () => {
      if (settled || stopped) return; // 幂等：重复 stop 不再补 kill
      stopped = true;
      try {
        child?.kill?.();
      } catch {
        /* 已退出 */
      }
    },
    done,
  };
}

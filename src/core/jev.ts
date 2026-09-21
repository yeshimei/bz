/**
 * Jev 决策通道（ADR-0173 / issue 389）：与 `core/ai.ts`（**生成通道**）并存的**判定通道**。
 *
 * TypeSafe AI 的 System One 模型 Jev——输入 state + 类型化问题，输出类型化答案 + 校准概率，
 * **不生成任何文本**，故不存在「JSON 解析失败」这类生成通道固有的失败模式。三种题型原样透传
 * （choice 从清单选一个 / score 按有序量表打分 / noul 判是或否），本层**不做任何业务语义包装**
 * ——候选清单、问题文本、state 全部由调用方注入，通道不认识具体域。
 *
 * 传输走 `requestUrl`（Obsidian 官方 API，免 CORS、移动端可用）——实测
 * `api.typesafe.ai` 的预检响应不带 `access-control-allow-origin`，浏览器 fetch 必被拒，
 * 故不套用 `core/ai.ts` 的「fetch 优先 + requestUrl 兜底」双通道。代价：`requestUrl` 无中止
 * 能力，`AbortSignal` 只能做到「立即拒绝、底层结果弃用」（与本项目 core/http.ts 的既有取舍一致）。
 *
 * 与生成通道的边界（ADR-0173 §6）：Jev **不走** `AI_PROVIDER_REGISTRY`——那张表的每条描述符
 * 都带生成专用语义（max_tokens / 思考档位风格映射），判定通道没有这些概念。端点、密钥、模型、
 * 超时独立配置（`jev*` 键，见设置面板 AI 分区的独立分组）。
 *
 * 失败一律**抛错**，由调用方决定回落（ADR-0173 §2：Jev 优先、失败即当次回落 LLM）——
 * 通道自己不兜底、不静默返回空答案，否则一次故障会被伪装成「这批确实没有关联」。
 * 取消（`signal.aborted`）抛 AbortError 语义错误，**与失败可区分**：调用方据 `signal.aborted`
 * 判定，不触发回落（用户主动放弃，回落等于白烧一次 LLM）。
 */
import { requestUrl } from 'obsidian';
import { tryGetSettings } from './settings-provider';

// ---------------- 报文类型（2026-09-21 实测确认，勿凭记忆改） ----------------

/** Noul：判是或否，返回 0–1 概率 */
export interface JevNoulQuestion {
  type: 'noul';
  instructions: string;
}

/** Choice：从固定清单选一个。`criteria` 是**字典**（选项值 → 说明），**写反会被 422 拒** */
export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

/** Score：按**有序**量表打分。`criteria` 是**数组**（低 → 高），与 Choice 形态不同 */
export interface JevScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}

export type JevQuestion = JevNoulQuestion | JevChoiceQuestion | JevScoreQuestion;

export interface JevNoulAnswer {
  type: 'noul';
  /** 0–1 校准概率 */
  noul: number;
}

export interface JevChoiceAnswer {
  type: 'choice';
  /** 命中的选项值（= 请求 criteria 的某个键） */
  choice: string;
  /** 0–1；由概率分布的形状导出，分布越集中越高 */
  confidence: number;
  probabilities: Record<string, number>;
}

export interface JevScoreAnswer {
  type: 'score';
  /** **可小数的档位索引**（如 3.99 落在第 4 档），不是百分比 */
  score: number;
  confidence: number;
  /** 索引 → 档名（回显请求的 criteria） */
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface JevResult {
  /** 服务端实际解析到的模型版本（如 jev-1.13.0）——口径审计用 */
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: JevUsage;
}

// ---------------- 配置 ----------------

export const JEV_DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
/** 固定版本，不用 `jev-latest`（ADR-0173 §5）：口径是核心资产，不该由远端别名决定何时变更 */
export const JEV_DEFAULT_MODEL = 'jev-1.13.0';
/** 实测单次 1–2 秒（含跨国网络），留 5x 余量 */
export const JEV_DEFAULT_TIMEOUT_MS = 10000;

export interface JevConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/** 读取 Jev 配置（设置注入未就绪时用缺省；`override` 用于测试与显式指定） */
export function resolveJevConfig(override?: Partial<JevConfig>): JevConfig {
  const s = tryGetSettings() as Record<string, unknown>;
  const pick = <T>(key: string, fallback: T): T => {
    const v = s?.[key];
    return v === undefined || v === null || v === '' ? fallback : (v as T);
  };
  const timeoutRaw = Number(pick('jevTimeoutMs', JEV_DEFAULT_TIMEOUT_MS));
  return {
    endpoint: String(override?.endpoint ?? pick('jevEndpoint', JEV_DEFAULT_ENDPOINT)),
    apiKey: String(override?.apiKey ?? pick('jevApiKey', '')),
    model: String(override?.model ?? pick('jevModel', JEV_DEFAULT_MODEL)),
    timeoutMs:
      override?.timeoutMs ??
      (Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : JEV_DEFAULT_TIMEOUT_MS),
  };
}

/**
 * 是否已配置可用（启用开关 + 端点 + 密钥齐备）。
 * **这只是就绪检查**——通道自己不判断「要不要用 Jev」，调用方的门（如 `jevEnabled`）。
 */
export function isJevConfigured(): boolean {
  const s = tryGetSettings() as Record<string, unknown>;
  if (s?.jevEnabled !== true) return false;
  const cfg = resolveJevConfig();
  return !!cfg.endpoint && !!cfg.apiKey;
}

// ---------------- 错误 ----------------

/** 取消异常（AbortError 语义：调用方据 `signal.aborted` 判定取消，不触发回落） */
function abortError(): Error {
  const e = new Error('Jev 请求已取消');
  e.name = 'AbortError';
  return e;
}

/** 超时异常（TimeoutError 语义：可识别于网络失败，便于调用方分别提示） */
function timeoutError(ms: number): Error {
  const e = new Error(`Jev 请求超时（${Math.round(ms / 1000)} 秒无响应）`);
  e.name = 'TimeoutError';
  return e;
}

// ---------------- 请求 ----------------

export interface JevAskOptions {
  /** 取消通道（关联预演 issue 327：重新生成即断在途裁判） */
  signal?: AbortSignal;
  /** 显式覆盖配置（测试 / 特殊调用点） */
  config?: Partial<JevConfig>;
}

/** 请求体构造（独立导出便于单测断言报文形态——criteria 的字典/数组之别是踩过的坑） */
export function buildJevBody(
  state: string,
  questions: Record<string, JevQuestion>,
  model: string
): Record<string, unknown> {
  return { model, state, questions };
}

/** 响应体 → JevResult；`answers` 缺失/非对象时抛错（见下） */
function parseJevResponse(text: string, status: number): JevResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Jev 响应不是合法 JSON（HTTP ${status}）`);
  }
  const answers = data?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    // 不静默当成「零命中」——那会让一次故障伪装成「这批笔记确实没有关联」（issue 392 §决策 9）
    const detail = data?.detail ? `: ${JSON.stringify(data.detail)}` : '';
    throw new Error(`Jev 响应缺少 answers 字段（HTTP ${status}）${detail}`);
  }
  return {
    model: String(data.model ?? ''),
    answers: answers as Record<string, JevAnswer>,
    usage: data.usage,
  };
}

/**
 * 判定请求：`state` + 类型化问题 → 类型化答案。
 *
 * - `questions` 为空 → 直接返回空 `answers`，不发请求（省一次注定无意义的往返）；
 * - 超时 / 网络失败 / HTTP 非 2xx / 响应畸形 → **抛错**，由调用方决定回落；
 * - `signal.aborted` → 抛 AbortError 语义错误（与失败可区分）。
 */
export async function askJev(
  state: string,
  questions: Record<string, JevQuestion>,
  opts: JevAskOptions = {}
): Promise<JevResult> {
  const keys = Object.keys(questions || {});
  if (!keys.length) return { model: '', answers: {} };

  const cfg = resolveJevConfig(opts.config);
  const signal = opts.signal;
  if (signal?.aborted) throw abortError();
  if (!cfg.endpoint) throw new Error('未配置 Jev 端点');
  if (!cfg.apiKey) throw new Error('未配置 Jev 密钥（插件设置 → AI → Jev 决策通道）');

  const body = buildJevBody(state, questions, cfg.model);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };

  // requestUrl 无中止能力：以 race 兜底——到点/被取消即立刻 settle，底层请求结果弃用
  // （与 core/http.ts 既有取舍一致：不假装能取消连接，只保证调用方不被阻塞）
  const resp: any = await new Promise<any>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => settle(() => reject(abortError()));
    function settle(fn: () => void): void {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      fn();
    }
    timer = setTimeout(() => settle(() => reject(timeoutError(cfg.timeoutMs))), cfg.timeoutMs);
    signal?.addEventListener('abort', onAbort);
    requestUrl({
      url: cfg.endpoint,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      throw: false,
    }).then(
      (r: any) => settle(() => resolve(r)),
      (e: any) => settle(() => reject(e))
    );
  });

  if (signal?.aborted) throw abortError();

  const status = Number(resp?.status ?? 0);
  const text = String(resp?.text ?? '');
  if (status < 200 || status >= 300) {
    // 错误正文尽量透出（如 422 的字段级校验说明、503 no healthy upstream），便于定位
    const brief = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Jev API ${status}: ${brief || '无响应正文'}`);
  }
  return parseJevResponse(text, status);
}

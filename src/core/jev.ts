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
 * 都带生成专用语义（max_tokens / 思考档位风格映射），判定通道没有这些概念，故自带一张更小的
 * `JEV_PROVIDER_REGISTRY`（issue 424/ADR-0184：服务商选择照 LLM 同款；issue 430 起两家，
 * 在册者必须与 SystemOne 报文同构）。配置只剩服务商 / 密钥 / 模型三项 `jev*` 键（超时固化、总开关退役，issue 424/ADR-0184）。
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

/** Jev 服务商描述符（issue 424/ADR-0184：照 `AI_PROVIDER_REGISTRY` 同款，供设置行与端点解析共用）。
 *  与生成通道注册表分开的理由见模块头——判定通道没有 max_tokens / 思考档位这些生成专用语义。
 *  `modelsUrl` 为服务商自家模型列表端点（GET，非 OpenAI 兼容面，响应见 parseJevModels）。
 *  在册者必须与 SystemOne 报文同构（issue 430：博查实测同款报文/同款列表格式）——
 *  OpenAI chat 面的服务商（如硅基流动）报文不同构，接入前先加适配层，不许直接塞进本表。 */
export interface JevProviderDescriptor {
  id: string;
  label: string;
  /** 判定端点（POST，报文见 buildJevBody） */
  endpoint: string;
  /** 模型列表端点（GET） */
  modelsUrl: string;
  /** 服务商缺省模型（「Jev 模型」留空时回落；issue 430 起按服务商各配） */
  defaultModel: string;
}

/** 在册 Jev 服务商（issue 430 起两家：Typesafe 官方 + 博查平替。
 *  博查 2026-09-24 实测：jev.bochaai.com 与 Typesafe 报文/列表格式同构，国内直连 ~0.2s；
 *  `jev-latest` 在博查是 bocha-jev-v1 的兼容别名，故存量模型键换服务商后依旧可调。） */
export const JEV_PROVIDER_REGISTRY: JevProviderDescriptor[] = [
  {
    id: 'typesafe',
    label: 'Typesafe',
    endpoint: 'https://api.typesafe.ai/v1/systemone',
    modelsUrl: 'https://api.typesafe.ai/v1/models',
    defaultModel: 'jev-latest',
  },
  {
    id: 'bocha',
    label: '博查',
    endpoint: 'https://jev.bochaai.com/v1/systemone',
    modelsUrl: 'https://jev.bochaai.com/v1/models',
    defaultModel: 'bocha-jev-v1',
  },
];

export const DEFAULT_JEV_PROVIDER = 'typesafe';

/** 按 id 取服务商描述（未在册/缺省 → 缺省服务商；口径同 `getProviderDescriptor`） */
export function getJevProviderDescriptor(id?: string): JevProviderDescriptor {
  return JEV_PROVIDER_REGISTRY.find((p) => p.id === id) || JEV_PROVIDER_REGISTRY[0];
}

/** 缺省服务商判定端点（= 注册表首条；issue 424 起端点由「Jev 服务商」行决定，不再是设置项） */
export const JEV_DEFAULT_ENDPOINT = JEV_PROVIDER_REGISTRY[0].endpoint;
/** 缺省模型：服务端最新版（issue 424/ADR-0184 起——模型可用列表在线获取，别名不再由插件钉版本）。
 *  实为 Typesafe 的缺省；其他服务商看各自描述符的 `defaultModel`（resolveJevConfig 按服务商回落）。 */
export const JEV_DEFAULT_MODEL = JEV_PROVIDER_REGISTRY[0].defaultModel;
/** 实测单次 1–2 秒（含跨国网络），留 5x 余量；issue 424 起固化（原「Jev 超时」设置项已删） */
export const JEV_DEFAULT_TIMEOUT_MS = 10000;

export interface JevConfig {
  /** 判定端点（由服务商描述符解析；`override.endpoint` 可显式指定，测试用） */
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
  const desc = getJevProviderDescriptor(pick('jevProvider', DEFAULT_JEV_PROVIDER));
  return {
    endpoint: String(override?.endpoint ?? desc.endpoint),
    apiKey: String(override?.apiKey ?? pick('jevApiKey', '')),
    // 模型留空按服务商各回各的缺省（issue 430）：typesafe → jev-latest，博查 → bocha-jev-v1
    model: String(override?.model ?? pick('jevModel', desc.defaultModel)),
    timeoutMs: override?.timeoutMs ?? JEV_DEFAULT_TIMEOUT_MS,
  };
}

/**
 * 是否已配置可用（端点 + 密钥齐备）。
 * **常开**（issue 424/ADR-0184 用户拍板「默认启动，无需设置」）：没有总开关，填了密钥即接管判定，
 * 清空密钥即回落 LLM——「要不要用 Jev」这件事只剩这一个可观察事实。
 */
export function isJevConfigured(): boolean {
  const cfg = resolveJevConfig();
  return !!cfg.endpoint && !!cfg.apiKey;
}

/* ---------------- 模型列表（issue 424/ADR-0184「获取模型」） ---------------- */

/** 模型选项（与 `core/ai-models.ts` 的 ModelOption 同形——选择器弹窗按结构消费，两模块互不依赖） */
export interface JevModelOption {
  id: string;
  detail?: string;
}

/** 模型列表拉取注入（测试桩；缺省用插件运行时真实实现） */
export interface JevModelsFetchDeps {
  requestUrlFn?: (opts: {
    url: string;
    method: string;
    headers: Record<string, string>;
    throw?: boolean;
  }) => Promise<{ status: number; text: string }>;
}

/** `/v1/models` 响应 → 选项列表（自家格式 `{models:[{name, description?, release_date?}]}`；
 *  畸形项跳过。说明取描述 + 发布日；都缺回落服务商名） */
export function parseJevModels(data: any, label = 'Typesafe'): JevModelOption[] {
  const list = data?.models;
  if (!Array.isArray(list)) return [];
  const out: JevModelOption[] = [];
  for (const m of list) {
    const id = m && typeof m.name === 'string' ? m.name : '';
    if (!id) continue;
    const bits: string[] = [];
    if (typeof m.description === 'string' && m.description) bits.push(m.description);
    if (typeof m.release_date === 'string' && m.release_date) bits.push(m.release_date);
    out.push({ id, detail: bits.join('，') || label });
  }
  return out;
}

/**
 * 拉取 Jev 服务商模型列表（AI 面板「Jev 模型」行的「获取模型」按钮）。走 `requestUrl`——
 * 与判定请求同因（`api.typesafe.ai` 预检无 ACAO，浏览器 fetch 必被拒），故不套 fetch 优先双通道。
 * 报错文案抛给调用方（本模块只做数据层，不弹提示）。
 */
export async function fetchJevModels(deps: JevModelsFetchDeps = {}): Promise<JevModelOption[]> {
  const s = tryGetSettings() as Record<string, unknown>;
  const cfg = resolveJevConfig();
  const desc = getJevProviderDescriptor(String(s?.jevProvider ?? '') || DEFAULT_JEV_PROVIDER);
  if (!cfg.apiKey) throw new Error(`未配置 ${desc.label} 密钥（插件设置 → AI → JEV）`);

  const requestUrlFn = deps.requestUrlFn || requestUrl;
  const resp: any = await requestUrlFn({
    url: desc.modelsUrl,
    method: 'GET',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    throw: false,
  });
  const status = Number(resp?.status ?? 0);
  const text = String(resp?.text ?? '');
  if (status < 200 || status >= 300) {
    const brief = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`${desc.label} 模型列表请求失败（${status}）：${brief || '无响应正文'}`);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${desc.label} 模型列表响应不是合法 JSON（HTTP ${status}）`);
  }
  const models = parseJevModels(data, desc.label);
  if (!models.length) throw new Error(`${desc.label} 未返回可用模型`);
  return models;
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
  if (!cfg.apiKey) throw new Error('未配置 Jev 密钥（插件设置 → AI → JEV）');

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

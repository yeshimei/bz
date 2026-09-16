/**
 * 带超时网络请求单源（issue 365 复用上收批第 1 项）：此前多处各自手写 Promise.race /
 * AbortController 超时壳（clipbook 抓取、knowledge 视频/笔记、favorites GitHub、encrypt
 * 预览……），本模块收敛为两把工具——
 * - withTimeout：超时 → reject（错误信息含 label 便于定位），原 Promise 照旧 settle 但结果
 *   弃用（其 rejection 已被内部 then 消化，不会 unhandled，C23 语义）；
 * - httpGetText：2xx → 正文、非 2xx / 网络错 / 超时 → null（静默不打日志——对齐被收编
 *   各处的多数现行为）。超时后请求照旧在途、仅弃用结果（requestUrl 无中止能力，与旧
 *   race 壳一致）。
 * 生产 HTTP 通道仍是 requestUrl（移动端可用、免 CORS）：requestUrlAsFetch 把它适配成
 * fetch 形状，httpGetText 的 fetchImpl 注入点在测试里换 fake、在生产换该适配器。
 *
 * 三态对照（收编前逐处核对，勿凭记忆套用）：「超时→null 但网络错→上抛」（cinema
 * douban-queue，两者分别归入风控/网络失败两类用户通知）与「真中止连接」（secondbrain
 * ollama 的 AbortController）两套语义本模块**不覆盖**——强收会改外部行为，调用点保持本地实现。
 */
import { requestUrl } from 'obsidian';

/** fetch 最小结构视图：真 fetch 的 Response 与 requestUrlAsFetch 适配结果的公共面 */
export interface HttpTextResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** fetchImpl 注入点形状（fetch 兼容子集；headers 用简单 Record 便于 requestUrl 适配） */
export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<HttpTextResponse>;

export interface HttpGetTextOptions {
  /** 超时上限 ms（到点弃果归 null） */
  timeoutMs: number;
  headers?: Record<string, string>;
  /** 测试注入点；缺省 globalThis.fetch，生产传 requestUrlAsFetch() */
  fetchImpl?: FetchLike;
}

/**
 * 给 Promise 挂超时：到点 reject（信息含 label 与时限，定位是哪个请求慢）；p 照旧
 * settle 但结果弃用。任一方先落定即清计时器，批量调用不堆积悬挂定时器。
 */
export function withTimeout<T>(p: Promise<T>, ms: number, label?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`请求超时（${label || '未命名请求'}，${ms}ms）`)),
      ms,
    );
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * GET 文本：2xx → 正文；非 2xx / 网络错 / 超时 → null（静默）。超时后请求照旧在途，
 * 仅弃用结果；迟到 rejection 由 withTimeout 消化（C23）。
 */
export async function httpGetText(url: string, opts: HttpGetTextOptions): Promise<string | null> {
  const fetchImpl: FetchLike = opts.fetchImpl || ((u, init) => globalThis.fetch(u, init));
  try {
    const resp = await withTimeout(fetchImpl(url, { headers: opts.headers }), opts.timeoutMs, url);
    if (!resp || !resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

/**
 * requestUrl GET → fetch 形状适配（生产 HTTP 通道）。throw:false——HTTP 错误状态交
 * ok/status 判定（不 reject），网络错仍走 rejection、由 httpGetText 归 null。
 */
export function requestUrlAsFetch(): FetchLike {
  return async (url, init) => {
    const resp = await requestUrl({ url, method: 'GET', headers: init?.headers, throw: false });
    const status = resp.status;
    return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(resp.text) };
  };
}

/**
 * 取消原语（issue 428）：交互式检索「只查最新」的中断支持。
 *
 * 为什么需要单独的原语：`fetch` 的 reject 既可能是超时、也可能是取消，两者必须分开——
 * 超时要提示/降级，取消要静默（发起方已经换成新查询，旧一轮的任何回填都是错的）。
 * 判定统一走 `name === 'AbortError'`：不依赖 DOMException（node 环境与测试桩都能造）。
 */

/** 中断错误：面板据此静默丢弃本轮结果（不提示、不降级） */
export function abortError(): Error {
  const e = new Error('请求已中断');
  e.name = 'AbortError';
  return e;
}

export function isAbortError(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { name?: unknown }).name === 'AbortError';
}

/** 同步段检查点：HTTP 之间的循环里插入，尽快把控制权让给外部取消 */
export function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw abortError();
}

/**
 * 外层 signal 与内层（自带超时定时器）controller 合流：任一触发都中断内层请求。
 * 返回解绑函数——内层定时器到点/请求结束后必须调用，否则外层 signal 会攒下监听（长寿命
 * signal 反复复用即监听泄漏）。
 */
export function linkAbort(outer: AbortSignal | undefined | null, controller: AbortController): () => void {
  if (!outer) return () => {};
  if (outer.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  outer.addEventListener('abort', onAbort);
  return () => outer.removeEventListener('abort', onAbort);
}

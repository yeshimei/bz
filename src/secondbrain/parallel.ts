/**
 * 第二大脑自适应并发 parallelMap（ticket 103；逐字对齐 QA 闪念.js L233-275）
 * EMA 延迟爬坡：均延迟 < 最小延迟×1.3 且并发 <60 时递增；
 * 越过 ×1.5 锁定并发并打日志。单任务失败以 { error } 占位不中断整批。
 */
export type ParallelMapResult<T> = T | { error: string };

export async function parallelMap<T, R>(
  array: T[],
  initConcurrency: number,
  asyncFn: (item: T, i: number) => Promise<R>
): Promise<ParallelMapResult<R>[]> {
  const results: ParallelMapResult<R>[] = [];
  let index = 0;
  const inProgress = new Set<Promise<void>>();
  let concurrency = initConcurrency;
  let emaMs = 0;
  const ALPHA = 0.3;
  let minLatency = Infinity;
  let rampUpDone = false;

  return new Promise((resolve) => {
    function next(): void {
      if (index >= array.length && inProgress.size === 0) {
        resolve(results);
        return;
      }
      while (index < array.length && inProgress.size < concurrency) {
        const i = index++;
        const t0 = Date.now();
        const promise: Promise<void> = asyncFn(array[i], i)
          .then((result) => {
            const ms = Date.now() - t0;
            emaMs = emaMs ? ALPHA * ms + (1 - ALPHA) * emaMs : ms;
            if (ms < minLatency) minLatency = ms;
            if (!rampUpDone && emaMs < minLatency * 1.3 && concurrency < 60) concurrency++;
            if (!rampUpDone && emaMs > minLatency * 1.5) {
              rampUpDone = true;
              console.log(`[secondbrain] 并发锁定: ${concurrency}, 均延迟: ${Math.round(emaMs)}ms`);
            }
            results[i] = result;
          })
          .catch((err: any) => {
            results[i] = { error: String(err?.message ?? err) };
          })
          .finally(() => {
            inProgress.delete(promise);
            next();
          });
        inProgress.add(promise);
      }
    }
    next();
  });
}

/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：news.json 写回串行队列。
 *
 * 背景（P1 审查项）：news.json 是插件与后台抓取守护进程的**双写者**文件，此前
 * loader（保留策略清理写回）、news-source-settings（设置写回）、store（writeNewsState）
 * 各自直接 writeNewsData，绕过 flow 的串行队列——多次读改写互相交错、并对 daemon
 * 在 read→write 窗口内的写入无任何合并。现在全部写回统一入队串行执行，且每次写
 * 前重读磁盘做段级合并（见 news-data.writeNewsDataMerged）。
 *
 * 队列语义：
 * - 同一时间只有一个写操作在执行，操作内部「读盘 → 改 → 合并写」不再被下一操作打断；
 * - 单个操作失败不中断后续操作（错误向该次调用方传递，队列本身保持存活）。
 */

let chain: Promise<unknown> = Promise.resolve();

/** 入队一个 news.json 读改写操作；返回该操作自己的 Promise（调用方可 await 结果） */
export function enqueueNewsWrite<T>(op: () => Promise<T>): Promise<T> {
  const run = chain.then(op);
  // 队列存活：吞掉错误只向后传递给 await 方，不让链断裂
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** 测试钩子：等待队列清空（当前在途操作全部完成） */
export function drainNewsWritesForTests(): Promise<void> {
  return chain.then(
    () => undefined,
    () => undefined
  );
}

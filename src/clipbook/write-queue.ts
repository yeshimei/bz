/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：news.json 写回串行队列。
 *
 * 背景（P1 审查项）：news.json 是插件与后台抓取守护进程的**双写者**文件，此前
 * loader（保留策略清理写回）、news-source-settings（设置写回）、store（writeNewsState）
 * 各自直接 writeNewsData，绕过 flow 的串行队列——多次读改写互相交错、并对 daemon
 * 在 read→write 窗口内的写入无任何合并。现在全部写回统一入队串行执行，且每次写
 * 前重读磁盘做段级合并（见 news-data.writeNewsDataMerged）。
 *
 * D2 收编（可靠写契约原语 1）：队列本体不再维护域私有 promise 链，直接委托 core
 * `enqueueFileTask`（键 = news.json 路径）——语义与原实现逐条等价（同路径 FIFO 串行、
 * 单操作失败不堵队列、错误只透传该调用方），且与全仓其他写方（含 D3 后续迁移域）
 * 共享同一条 per-path 队列，同路径写者天然互斥。
 * 队列不可重入（契约）：op 内部勿再对 news.json 调 enqueueFileTask/updateFileSections。
 */

import { enqueueFileTask } from '../core/storage';
import { getNewsFilePath } from './news-data';

/** 入队一个 news.json 读改写操作；返回该操作自己的 Promise（调用方可 await 结果） */
export function enqueueNewsWrite<T>(op: () => Promise<T>): Promise<T> {
  return enqueueFileTask(getNewsFilePath(), op);
}

/** 测试钩子：等待队列清空（当前在途操作全部完成）——FIFO 队尾哨兵任务完成后即前排全清 */
export function drainNewsWritesForTests(): Promise<void> {
  return enqueueNewsWrite(async () => undefined).then(() => undefined);
}

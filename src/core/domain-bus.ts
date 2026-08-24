/**
 * 域事件总线：进程内发布订阅（模块级 Map 实现，无 DOM、无 Obsidian 依赖）。
 *
 * 设计约定：
 * - 通道命名 `<域名>:<事件>`（如 'vault:md-created'、'diary:file-created'）；通道字符串即契约，
 *   派发方与消费方共用同一字面量，不设独立常量表。
 * - fire-and-forget 语义：emitDomainEvent 同步扇出、无返回值；派发方不感知订阅方存在，
 *   也不等待任何异步结果（handler 内的异步逻辑自行兜底，总线只负责转交）。
 * - 错误隔离：单个 handler 抛错被隔离捕获并 console.error，不影响同通道其他 handler
 *   与派发方——单订阅方故障不炸总线、不中断扇出。
 * - 回环抑制是订阅端职责：总线不做去重/节流/防抖；同一事件重复 emit 原样多次扇出，
 *   消费端若在 handler 内再次 emit 同通道事件造成回环，由订阅端自行短路。
 */

export type DomainEventHandler<E = unknown> = (evt: E) => void;

/** 订阅表：channel → handler 集合（Set 插入序 = 扇出顺序） */
const channels = new Map<string, Set<DomainEventHandler<unknown>>>();

/** 派发事件（同步扇出；单个 handler 抛错被隔离捕获 console.error，不影响其他 handler 与派发方） */
export function emitDomainEvent<E = unknown>(channel: string, evt: E): void {
  const handlers = channels.get(channel);
  if (!handlers || handlers.size === 0) return;
  // 按本轮开始时的快照遍历：handler 内退订/新订阅不影响本轮扇出，下一轮生效
  for (const handler of [...handlers]) {
    try {
      handler(evt);
    } catch (e) {
      console.error(`bz: 域事件 handler 异常（channel=${channel}）`, e);
    }
  }
}

/** 订阅；返回退订函数（幂等，重复调用安全） */
export function onDomainEvent<E = unknown>(channel: string, handler: DomainEventHandler<E>): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(handler as DomainEventHandler<unknown>);
  let offed = false;
  return () => {
    if (offed) return; // 幂等：重复退订直接跳过
    offed = true;
    const cur = channels.get(channel);
    if (!cur) return;
    cur.delete(handler as DomainEventHandler<unknown>);
    if (cur.size === 0) channels.delete(channel); // 空通道回收，避免长期运行下 Map 膨胀
  };
}

/** 清空全部订阅（插件 onunload 调用） */
export function clearDomainEvents(): void {
  channels.clear();
}

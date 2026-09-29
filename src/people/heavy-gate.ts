/**
 * 脸谱域**重进程闸门**（ADR-0218）——跨通道单资源闸：同一时刻至多一个持有者。
 *
 * 两类持有身份：
 * - `portrait`：画谱任务（引擎 `runningJob` 期间 **+** prep 进程存活期间——**含待命**：
 *   `pauseJobs` 只写控制文件让进程让行，模型不卸载仍在内存里，故仍算占用）；
 * - `recording`：录音处理 / 质心构建（全程）。
 *
 * 为什么存在：两条通道都起 funasr 类重进程（数 GB 内存 + 分钟级冷加载），此前互不相识，
 * 实测出现「两条录音并发」「画谱 prep 段与录音并发」。语义与取舍详见 ADR-0218。
 *
 * **本模块不 import 任何 `people/` 模块**（`jobs.ts` 与 `recording.ts` 都依赖它，
 * 反向依赖会破 ADR-0002 依赖方向）；需要跨模块协作的"终结待命进程"由持有方注册回调
 * （`setHeavyPreemptHandler`）。
 *
 * 同身份**可重入**（计数）：画谱侧 `runJob` 与 prep 会话各持一份，谁先退出都不松开闸门
 * ——这正是"任务暂停但 prep 进程待命仍占闸"的实现方式。不同身份互斥（抢占见决策 4）。
 */

export type HeavyHolder = 'portrait' | 'recording';

let holder: HeavyHolder | null = null;
/** 同身份重入计数（>0 才真正持有） */
let depth = 0;
/** portrait 是否**真在跑**（false = 只有待命 prep 进程占着）——录音侧据此前置抢占（决策 4） */
let portraitBusy = false;
/** 「终结待命 prep 进程」回调（由 jobs.ts 注册，避免 recording → jobs 的依赖） */
let preemptHandler: (() => void) | null = null;
const subs = new Set<() => void>();

/** 等待闸门的轮询间隔（等待窗口是分钟级，轮询足够且实现简单） */
const HEAVY_WAIT_POLL_MS = 300;

function notify(): void {
  for (const fn of [...subs]) {
    try {
      fn();
    } catch {
      /* 订阅者异常不影响闸门状态 */
    }
  }
}

/** 闸门当前持有者（null = 空闲） */
export function heavyGateHolder(): HeavyHolder | null {
  return holder;
}

/** 闸门重入计数（诊断 / 测试；0 = 空闲） */
export function heavyGateDepth(): number {
  return depth;
}

/** 现在能否取得闸门（空闲，或已由同身份持有——可重入） */
export function canAcquireHeavy(h: HeavyHolder): boolean {
  return holder === null || holder === h;
}

/** 立即尝试取得闸门；成功（含同身份重入）返回 true */
export function tryAcquireHeavy(h: HeavyHolder): boolean {
  if (!canAcquireHeavy(h)) return false;
  if (holder === null) holder = h;
  depth++;
  notify();
  return true;
}

/** 释放（未持有该身份 = no-op；计数归零才真正空闲） */
export function releaseHeavy(h: HeavyHolder): void {
  if (holder !== h) return;
  depth = Math.max(0, depth - 1);
  if (depth === 0) {
    holder = null;
    portraitBusy = false;
  }
  notify();
}

/** portrait 是否真在跑（false = 只有待命进程占闸） */
export function heavyGatePortraitBusy(): boolean {
  return portraitBusy;
}

/** 画谱引擎上报"任务是否 running"（runJob 进出时调；只影响抢占判定，不影响持有） */
export function setHeavyPortraitBusy(busy: boolean): void {
  if (portraitBusy === busy) return;
  portraitBusy = busy;
  notify();
}

/** 注册「协作式终结待命 prep 进程」回调（jobs.ts 注册；重复注册覆盖） */
export function setHeavyPreemptHandler(fn: (() => void) | null): void {
  preemptHandler = fn;
}

/** 现在能否抢占：闸门被 portrait 占着，但那边只是待命进程（没有任务在跑） */
export function heavyGateCanPreempt(): boolean {
  return holder === 'portrait' && !portraitBusy;
}

/** 请求抢占（录音侧调）：终结待命进程让对方尽快释放；不能抢占 / 没注册回调 = no-op */
export function preemptHeavyStandby(): boolean {
  if (!heavyGateCanPreempt() || !preemptHandler) return false;
  try {
    preemptHandler();
    return true;
  } catch {
    return false;
  }
}

/** 订阅闸门变化（UI 重画等待态）；返回退订函数 */
export function subscribeHeavy(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** 默认睡眠（可注入便于测试） */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 等闸门（FIFO 意义上的先到先得——本域最多两个通道竞争，无需显式排队号）：
 * 立即能取就取；否则轮询等待。`keepWaiting` 返回 false = 放弃（任务被删 / 暂停 / 上锁 / 移出队列）。
 * 返回是否**已取得**（false = 放弃了）。
 */
export async function waitHeavyGate(
  h: HeavyHolder,
  keepWaiting?: () => boolean,
  sleep: (ms: number) => Promise<void> = defaultSleep
): Promise<boolean> {
  for (;;) {
    if (keepWaiting && !keepWaiting()) return false;
    if (canAcquireHeavy(h)) return tryAcquireHeavy(h);
    await sleep(HEAVY_WAIT_POLL_MS);
  }
}

/** 测试用：清空闸门与订阅（不留跨用例脏状态） */
export function resetHeavyGateForTests(): void {
  holder = null;
  depth = 0;
  portraitBusy = false;
  preemptHandler = null;
  subs.clear();
}

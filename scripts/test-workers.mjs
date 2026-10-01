/**
 * 测试 worker 数决策 —— 独占吃满、并发自动折半。
 *
 * 为什么需要它：全量用例 586 文件里 ~91% 的耗时是**每个文件构建一次 jsdom 环境**
 * （node 环境 0.19s/文件，jsdom 1.5s/文件），这份开销不随用例多少变化，只能靠
 * 「减少文件数」或「让文件跑得更快」来摊薄；而 worker 数决定的是另一件事——
 * **把这份固定的总工时摊到几个核上**。实测（同一份代码，16 逻辑核）：
 *
 *   worker=8  → 158s      worker=12 → 123s      worker=16 → 109s
 *
 * 也就是说独占时吃满最快。但 agent 会话并发是这台机器的常态：两个会话各吃满 16
 * → 32 线程抢 16 逻辑核，两边都被拖到 3~4 倍（实测 430s+），且假红率飙升。
 *
 * 于是把「该开几个」从**手动记忆**改成**自动判断**：用 tmpdir 下的心跳锁文件数出
 * 当前有几个全量测试在跑，独占就吃满、N 个并发就各拿 1/N。显式传
 * `BZ_TEST_MAX_WORKERS` 仍然优先（CI / 复现特定并发时用）。
 *
 * 锁文件用 PID 命名 + 30s 心跳刷新 mtime：
 *  - 同一进程重复加载配置（watch 重载 / 被多个入口求值）→ 同文件名，天然幂等；
 *  - 进程被强杀（来不及跑 exit 清理）→ 心跳停更，120s 后自动判定为死会话剔除。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOCK_DIR = path.join(os.tmpdir(), 'bz-test-runs');
/** 心跳间隔：够密以在崩溃后快速降级，够疏以免写盘成为噪声 */
const HEARTBEAT_MS = 30_000;
/** 超过这个时长没心跳即视为死会话（= 4 拍） */
const FRESH_MS = HEARTBEAT_MS * 4;
const MIN_WORKERS = 2;

/** 清掉死会话的锁，返回仍存活的锁路径（**调用前应先 claim 自己**） */
function pruneStale(lockDir = LOCK_DIR, now = Date.now()) {
  let names;
  try {
    names = fs.readdirSync(lockDir);
  } catch {
    return [];
  }
  const live = [];
  for (const name of names) {
    const p = path.join(lockDir, name);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (now - st.mtimeMs > FRESH_MS) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        /* 另一个会话可能同时删，忽略 */
      }
      continue;
    }
    live.push(p);
  }
  return live;
}

let claimed = null;

/**
 * 登记当前测试会话（幂等）。返回释放函数。
 * 应在 vitest 配置求值时调用：worker 数必须在起线程前定下来。
 */
export function claimTestRun(pid = process.pid, lockDir = LOCK_DIR) {
  if (claimed) return claimed.release;
  try {
    fs.mkdirSync(lockDir, { recursive: true });
  } catch {
    /* 建不出来就退化为「不参与并发统计」，不影响测试本身 */
  }
  const file = path.join(lockDir, `${pid}.lock`);
  const touch = () => {
    try {
      fs.writeFileSync(file, String(pid));
    } catch {
      /* 忽略 */
    }
  };
  touch();
  const timer = setInterval(touch, HEARTBEAT_MS);
  // 心跳不该拖住进程退出
  if (typeof timer.unref === 'function') timer.unref();

  const release = () => {
    clearInterval(timer);
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* 忽略 */
    }
    claimed = null;
  };
  process.once('exit', release);
  claimed = { file, release };
  return release;
}

/**
 * 算出本次该开几个 worker。
 * 优先级：显式 env > 独占吃满 > 按并发会话数均分。
 */
export function resolveWorkerCount(env = process.env, lockDir = LOCK_DIR) {
  const explicit = Number(env?.BZ_TEST_MAX_WORKERS);
  if (Number.isFinite(explicit) && explicit >= 1) return Math.floor(explicit);

  const max = Math.max(MIN_WORKERS, os.availableParallelism());
  const runs = Math.max(1, pruneStale(lockDir).length);
  return Math.max(MIN_WORKERS, Math.floor(max / runs));
}

export const _internals = { LOCK_DIR, HEARTBEAT_MS, FRESH_MS, MIN_WORKERS, pruneStale };

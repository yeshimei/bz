/**
 * 测试环境共享 setup：jsdom 中补齐 Obsidian 运行时常用 API。
 * obsidian 模块的替换由 vitest.config.ts 的 resolve.alias 完成。
 */
import { afterAll, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { __setPbkdf2IterationsForTests } from '../src/core/crypto';
import { ReadableStream as NodeReadableStream, WritableStream as NodeWritableStream, TransformStream as NodeTransformStream } from 'node:stream/web';

/**
 * 补齐 VM realm 里缺失的 Node 全局。
 *
 * `pool: 'vmThreads'`（环境每 worker 建一次、每文件全新 VM 上下文）下，测试代码跑在
 * 独立的 VM realm 里，`crypto.subtle` / `ReadableStream` 这类 Node 全局**不会**被带进去，
 * 表现是加密域大面积 `Cannot read properties of undefined (reading 'importKey')`
 * 与 `ReadableStream is not defined`。这里按需兜底（已存在的环境不动）。
 */
const VM_GLOBAL_POLYFILLS: Record<string, unknown> = {
  ReadableStream: NodeReadableStream,
  WritableStream: NodeWritableStream,
  TransformStream: NodeTransformStream,
};
for (const [name, value] of Object.entries(VM_GLOBAL_POLYFILLS)) {
  if (value && typeof (globalThis as Record<string, unknown>)[name] === 'undefined') {
    (globalThis as Record<string, unknown>)[name] = value;
  }
}
if ((globalThis as { crypto?: Crypto }).crypto?.subtle === undefined) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });
}
// `CryptoKey` / `SubtleCrypto` 这两个类没有公开导出（`node:crypto` 与 `webcrypto` 上都没有），
// 只能从真实实现产出的实例上取原型构造器——否则 `toBeInstanceOf(CryptoKey)` 会因为
// 拿到的是另一个类而假红。
if (typeof (globalThis as Record<string, unknown>).CryptoKey === 'undefined') {
  const probe = await webcrypto.subtle.importKey(
    'raw',
    new Uint8Array([0]),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  (globalThis as Record<string, unknown>).CryptoKey = Object.getPrototypeOf(probe).constructor;
  (globalThis as Record<string, unknown>).SubtleCrypto = Object.getPrototypeOf(webcrypto.subtle).constructor;
}

/**
 * 测试统一降低 PBKDF2 迭代数（100000 → 1000）。
 *
 * 保险库/密码本/脸谱/日记加密的每个用例都在真跑 PBKDF2 + AES-GCM——链路留真，只调强度参数：
 * 单次派生 100k≈12.5ms → 1k≈0.3ms（Node webcrypto 基准），而「每次加密新 salt 必 cache miss」，
 * 加密密集的域（people / encrypt / password-vault）里这是最大单项 CPU。加解密同源读同一变量，
 * 密文照常互解；没有任何用例断言迭代强度或依赖预烘焙密文
 * （2026-10-01 全仓 grep 核对过：所有 decrypt 的入参都是同运行内 encrypt 的产物）。
 */
__setPbkdf2IterationsForTests(1000);

/**
 * waitFor 默认超时加宽（1000ms → 5000ms）。
 *
 * vitest 4 的 `vi.waitFor` 默认 `timeout: 1e3` 是**硬编码**的，没有全局配置键
 * （testTimeout 只管用例整体上限，管不到它），全仓 1568 处调用也都没传 timeout。
 * 于是每处轮询只有 1s 预算——多 worktree 并发跑测试时 CPU 被分掉，一次正常几毫秒的
 * DOM 刷新能被拖到秒级，1s 预算随即告吹，表现为「同一套用例这次过下次不过」的假红
 * （实测：同一分支单跑 114s/10 红，双会话并发 443s/15 红，且**失败集合不一致**——
 * 只有抖动才会这样，真 bug 的失败集合是稳定的）。
 *
 * 抬到 5s 与 testTimeout 放宽到 20s 同源：只影响上限，正常用例仍是毫秒级返回；
 * 真死循环 / 真没渲染出来照样在 5s 后超时暴露，不会把 bug 藏成绿灯。
 * 显式传了 timeout 的调用（含数字简写）原样透传。
 */
const WAIT_FOR_TIMEOUT_MS = 5000;
/**
 * waitFor 轮询间隔（默认 50ms → 2ms，2026-10-01 实测定稿）。
 *
 * 上面的 timeout 只管「等多久放弃」，管不到「多久看一眼」——而后者才是常态成本：`vi.waitFor`
 * 默认 `interval` 是 **50ms 硬编码**，vitest 的检查节拍是「首次立即查，不通过后每 interval
 * 复查一次」，于是「查过一次、几毫秒后才成立」的调用每处至少白等一个 50ms 周期。全仓
 * 1580 处 waitFor，interval 压到 2ms 后实测（受控单文件 A/B 交替各 2 轮、--no-file-parallelism；
 * 括号内为调用密度）：
 *   · knowledge/ui（203 处）6.42s → 2.58s（-60%） · clipbook/core-fix-c（57）7.80 → 6.22（-20%）
 *   · clipbook/enhance（36）9.26 → 7.61（-18%）     · clipbook/toolbar（52）13.06 → 11.63（-11%）
 *   · pomodoro/ui（0 处）3.61 → 3.52（无差异——收益严格跟随 waitFor 密度，零调用零影响）
 *   · encrypt/ui（71 处「本地 25ms 轮询函数」，不经 vi.waitFor）14.0 → 14.0（无差异）
 * 全量 588 文件 A/B 各 2 轮：用例时长累加 492.3 → 463.0s（-29.3s，-6.0%，与「1580 处 × 平均
 * ~19ms」吻合）；墙钟 39.0 → 38.1s（-2.5%，单轮墙钟噪声 ±2s，负载为更稳口径）。
 *
 * 语义不变：条件成立即返回，条件恒假照样在 timeout 后暴露。代价是忙轮询（条件长时间不成立时
 * 每 2ms 空转一次检查）——但那正是「该失败」的场景，上限仍是 timeout；callback 为微秒级断言，
 * 2ms 与 50ms 的 CPU 占用差可忽略。显式传了 interval 的调用原样透传。
 */
const WAIT_FOR_INTERVAL_MS = 2;
{
  const original = vi.waitFor.bind(vi);
  const patched = ((callback: any, options?: any) =>
    original(
      callback,
      typeof options === 'number'
        ? options
        : { timeout: WAIT_FOR_TIMEOUT_MS, interval: WAIT_FOR_INTERVAL_MS, ...(options ?? {}) },
    )) as typeof vi.waitFor;
  try {
    vi.waitFor = patched;
  } catch {
    // 属性只读时的兜底（下游用的是同一份对象，重定义同样生效）
    Object.defineProperty(vi, 'waitFor', { value: patched, writable: true, configurable: true });
  }
}

/**
 * 给「发出去没等」的异步收尾一个跑完的窗口（必须在环境拆除之前）。
 *
 * 生产代码里有多处 fire-and-forget（`void manager.removeNote(...).then(渲染).catch(通知)`、
 * 智能猫的异步挂载等）。测试触发之后就结束了，这些收尾会拖到**文件环境拆除之后**才执行，
 * 那时 `document` 已被删掉 → `TypeError: Cannot read properties of undefined (reading
 * 'getElementById' / 'createElement')`。线程池下它们偶发地被掩盖，`pool: 'vmThreads'`
 * 下会稳定冒出来，并被计成 Unhandled Rejection（整个 run 退出码变红）。
 *
 * 这里在 afterAll 里排空微任务 + 让出一轮宏任务：既让收尾在 document 还在时跑完，
 * 又几乎不花时间。宏任务用**模块加载时抓到的真实实现**，避免被文件内 vi.useFakeTimers 拦掉。
 */
const realMacrotask: (cb: () => void) => unknown =
  typeof setImmediate === 'function' ? setImmediate : (cb) => setTimeout(cb, 0);
const realTimeout = setTimeout;
/**
 * 排空窗口。**这是本文件唯一需要调的数**，取值逻辑：
 *
 * - 几轮宏任务不够：真实收尾里有 `setTimeout` 兜底与**真实 PBKDF2**（保险库预览解密）,
 *   它们既不在微任务队列里，也无法从 `process._getActiveRequests()` 观测到
 *   （实测 threadpool 加密请求恒为 0），只能在**真实时间**上等。
 * - 10ms 能把「5 个未处理拒绝」压到 1 个，说明差的就是最后一段真实异步尾巴；
 *   60ms 给到 6 倍富余，全量连跑 4 遍零错误（见提交说明）。
 * - 成本 = 60ms × 文件数 / worker 数 ≈ 60ms × 588 / 16 ≈ 2.2s（全量 ~50s 的 4%）。
 *
 * 为什么不逐个去修那几处 fire-and-forget：它们是**开放集合**（加密预览、复制、
 * 智能猫挂载…，且新代码会继续用同一模式），且 `void x.then(渲染)` 里的 promise
 * 没有对外句柄，测试无法 await。窗口排空是唯一不依赖逐个定位、对新代码也自动生效的做法。
 */
const DRAIN_MS = 60;
afterAll(async () => {
  await new Promise<void>((resolve) => realTimeout(() => resolve(), DRAIN_MS));
  await new Promise<void>((resolve) => realMacrotask(() => resolve()));
});

// 补齐 jsdom 缺失的 API（node 环境跳过：数据层测试不依赖 DOM）
if (typeof window !== 'undefined' && !window.getSelection) {
  (window as any).getSelection = () => ({
    rangeCount: 0,
    removeAllRanges: () => {},
    addRange: () => {},
  });
}

// 补齐 jsdom 缺失的 Clipboard API（备忘录剪贴板读取/写入）
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      readText: () => Promise.resolve(''),
      writeText: () => Promise.resolve(),
    },
    configurable: true,
  });
}

// 补齐 jsdom 缺失的 scrollIntoView（搜索下拉键盘导航等）
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  (Element.prototype as any).scrollIntoView = () => {};
}

// 补齐 Obsidian DOM 扩展（设置页/UI 常用：createDiv/empty/addClass/toggleClass）
if (typeof HTMLElement !== 'undefined' && !(HTMLElement.prototype as any).createDiv) {
  (HTMLElement.prototype as any).createDiv = function (opts: any = {}) {
    const div = document.createElement('div');
    if (opts.cls) div.className = opts.cls;
    if (opts.text) div.textContent = opts.text;
    this.appendChild(div);
    return div;
  };
  (HTMLElement.prototype as any).empty = function () {
    this.innerHTML = '';
  };
  (HTMLElement.prototype as any).createEl = function (tag: string, opts: any = {}) {
    const el = document.createElement(tag);
    if (opts.cls) el.className = opts.cls;
    if (opts.text) el.textContent = opts.text;
    this.appendChild(el);
    return el;
  };
  (HTMLElement.prototype as any).createSpan = function (opts: any = {}) {
    return (this as any).createEl('span', opts);
  };
  (HTMLElement.prototype as any).addClass = function (c: string) {
    this.classList.add(c);
  };
  (HTMLElement.prototype as any).toggleClass = function (c: string, on: boolean) {
    this.classList.toggle(c, on);
  };
}

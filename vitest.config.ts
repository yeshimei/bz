import { defineConfig } from 'vitest/config';
import path from 'path';
import { claimTestRun, resolveLiveRuns, resolveRetryCount, resolveWorkerCount } from './scripts/test-workers.mjs';

// worker 数自适应（独占吃满、并发折半），决策逻辑与实测数据见 scripts/test-workers.mjs。
//
// 历史：这个值手动改过两轮——先是吃满 16，后因「并发 agent 会话是这台机器的常态、
// 两会话各 16 就是 32 线程抢 16 核、整套被拖到 4 倍且失败集合漂移」而改成固定 8。
// 固定折半的代价是**独占时白白慢 31%**（实测 158s vs 109s）。2026-10-01 起改为自动判断：
// 先登记本会话（tmpdir 心跳锁），再按存活会话数均分，独占即吃满。
// 显式 `BZ_TEST_MAX_WORKERS=8 pnpm test` 仍然优先（CI / 复现特定并发时用）。
claimTestRun();
const maxWorkers = resolveWorkerCount();
const liveRuns = resolveLiveRuns();
// waitFor 预算跟并发走：并发时 CPU 被分掉，5s 是防假红的底；独占时 CPU 空闲，
// 一次正常刷新几毫秒就成立，5s 只是**失败用例白等的时长**。2.5s 仍高于
// tests/core/waitfor-default-timeout.test.ts 那条「1.4s 慢响应必须等到」的守卫。
// 由配置写进 env 再传下去：setupFiles 在 worker 里跑，读不到这里的局部变量。
process.env.BZ_TEST_WAIT_FOR_MS ||= String(liveRuns > 1 ? 5000 : 2500);

export default defineConfig({
  resolve: {
    alias: {
      // 测试环境将 obsidian 模块替换为 mock（vi.mock 在 setupFiles 中不可靠）
      obsidian: path.resolve(__dirname, 'tests/mock-obsidian-entry.ts'),
    },
  },
  test: {
    // jsdom 与 Obsidian(Chromium) 行为最接近。happy-dom 实测环境成本只省一半
    // （0.54s vs 1.05s/文件）却要赔上 46 个文件的断言差异，不采用。
    // 纯数据层测试用首行 `// @vitest-environment node` 标注跳过 DOM 环境（已有 300+ 文件）。
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    setupFiles: ['tests/setup.ts'],
    // vmThreads 池：**环境按 worker 建一次**，每个文件只发一份全新的 VM 上下文 + window。
    //
    // 为什么换掉默认的 threads：官方性能文档即指出「每次导入 jsdom 要 200-500ms，隔离池下
    // 每个测试文件都要付一遍，通常是 DOM 套件里占比最大的开销」。本项目实测更极端——逐步骤
    // 计时把每文件 1.05s 拆开是 `import(jsdom)≈1000ms / new JSDOM 70ms / populateGlobal 2ms`，
    // 即 ~950ms 纯粹是「jsdom 这个包被逐文件重新导入」。vmThreads 下环境只建一次，
    // Duration 分解里的 environment 从 664s 掉到 ~45s（两者都是跨 worker 累计值）。
    //
    // 代价与配套（都落在 tests/setup.ts）：
    //  1) 测试代码跑在独立 VM realm，`crypto.subtle` / `CryptoKey` / `ReadableStream` 等
    //     Node 全局不会带进去 → setup.ts 逐个兜底，否则加密域成片假红；
    //  2) realm 拆除更及时，会暴露「发出去没等」的异步收尾 → setup.ts 的 afterAll 排空兜住。
    pool: 'vmThreads',
    maxWorkers,
    // 默认 5000ms 在全量并发下会假超时（单文件几百 ms 的用例被拖到 5s+，见 smartcat 域）。
    // 放宽到 20s：只影响上限，不影响正常用例速度；真死循环仍会超时暴露。
    // 注意这只管用例整体上限——`vi.waitFor` 自己的默认超时是另一路，由 tests/setup.ts
    // 统一抬到 5s（vitest 4 没有全局配置键；假红的大头在那边，见 setup.ts 注释）。
    testTimeout: 20000,
    // 重试只吸收「多会话抢 CPU」的假红，所以与 worker 数同一个信号：独占 0、并发 2
    // （判定在 scripts/test-workers.mjs 的 resolveRetryCount；BZ_TEST_RETRY 可显式覆盖）。
    //
    // 2026-10-31 改：原来恒 2。红的时候它是纯代价——失败用例每条多等两轮，单轮成本 = 用例里
    // 最深的那个 waitFor 超时（默认 5s），一条真失败白等 15s；几十条同时红，整轮从 40s 拖到
    // 十几分钟，而全程 CPU 闲着（用户原话「风扇都不响」）。独占时不会有假红，没必要买这份保险。
    retry: resolveRetryCount(process.env),
  },
  // 转译/模块求值结果落盘复用。**vitest 5 迁移点**：v4 里它挂在 `test.experimental.fsModuleCache`，
  // v5 转正为配置顶层同名项（沿用旧写法会打 DEPRECATED 且不再生效）；默认缓存目录也随之从
  // `node_modules/.experimental-vitest-cache` 换成 `node_modules/.vitest-cache`——两者都在
  // node_modules/ 忽略范围内，无需另行 ignore。
  //
  // 为什么开（实测，16 worker、温机；结论出自主线 513a0916）：这是**每文件固定开销**那一块的
  // 解法——第二轮起 transform 累计 39.97s→8.17s（-80%）、import 90.27s→54.06s（-40%），
  // 墙钟 52.5s→48.3s。对照实验：单独开 NODE_COMPILE_CACHE 无此效果（transform/import 各只动
  // ~1s），收益 100% 来自这里，故不引入那个额外的缓存目录。
  //
  // 代价与边界：缓存冷时第一轮要写缓存，反而慢约 9s（52.5s→61.7s）；所以它是**本地反复跑
  // 测试**的收益。CI 若每次全新检出且不缓存该目录，请改用不带此开关的运行方式，或把
  // node_modules/.vitest-cache 一并纳入缓存。
  fsModuleCache: true,
  coverage: {
    provider: 'v8',
    include: ['src/**/*.ts'],
    exclude: ['src/**/*.gen.ts'],
    reporter: ['text', 'html', 'json-summary'],
    reportsDirectory: 'coverage',
    thresholds: {
      statements: 80,
      lines: 80,
      functions: 70,
      branches: 60,
    },
  },
});

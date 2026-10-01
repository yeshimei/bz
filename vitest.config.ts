import { defineConfig } from 'vitest/config';
import { availableParallelism } from 'node:os';
import path from 'path';

// 并发会话限流：多个 worktree 同时全量跑测试时，各自设
// `BZ_TEST_MAX_WORKERS=8 pnpm test` 防止线程数超卖物理核互拖（实测单跑：
// 默认 ~16 worker 26s；12 → 28s；8 → 32s。两会话各 8 合计≈物理并行度）。
//
// 2026-10-01：默认值改为「物理并行度的一半」而不是吃满。原因是全量跑**不是**线性并行——
// 单会话吃满 16 核时，再来一个会话（并发 agent 会话是这台机器的常态）就变 32 线程抢 16 核，
// 整套用例被拉长到 4 倍：同一份代码单跑 114s 全绿，双会话并发 430s 且失败集合每次都变
// （真实 bug 的失败集合是稳定的，只有抢 CPU 才会漂）。默认折半后单会话多花几秒，换来
// 两会话并存时不再互相踩。要单跑最快仍可显式覆盖：`BZ_TEST_MAX_WORKERS=16 pnpm test`。
const concurrencyCap = Math.max(2, Math.floor(availableParallelism() / 2));
const maxWorkers = Number(process.env.BZ_TEST_MAX_WORKERS) || concurrencyCap;

export default defineConfig({
  resolve: {
    alias: {
      // 测试环境将 obsidian 模块替换为 mock（vi.mock 在 setupFiles 中不可靠）
      obsidian: path.resolve(__dirname, 'tests/mock-obsidian-entry.ts'),
    },
  },
  test: {
    // jsdom 与 Obsidian(Chromium) 行为最接近；happy-dom 试跑省 ~30% 墙钟但有
    // 9 处断言级行为差异（style 序列化/CSS.escape 等），迁移需逐个重写断言，暂不采用。
    // 纯数据层测试用首行 `// @vitest-environment node` 标注跳过 DOM 环境（已有 53 个文件）。
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    setupFiles: ['tests/setup.ts'],
    // threads 池：Windows 下比默认 forks 进程池启动成本低（全量 ~32s → ~22s）
    pool: 'threads',
    maxWorkers,
    // 默认 5000ms 在全量并发下会假超时（单文件几百 ms 的用例被拖到 5s+，见 smartcat 域）。
    // 放宽到 20s：只影响上限，不影响正常用例速度；真死循环仍会超时暴露。
    // 注意这只管用例整体上限——`vi.waitFor` 自己的默认超时是另一路，由 tests/setup.ts
    // 统一抬到 5s（vitest 4 没有全局配置键；假红的大头在那边，见 setup.ts 注释）。
    testTimeout: 20000,
    // 多个 worktree 同时跑测试（并发 agent 会话）时 CPU 争抢会让用例偶发假失败。
    // retry 只重试失败的用例：真 bug 重试仍失败照常红，flaky 抖动自动吸收。
    retry: 2,
  },
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

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // 测试环境将 obsidian 模块替换为 mock（vi.mock 在 setupFiles 中不可靠）
      obsidian: path.resolve(__dirname, 'tests/mock-obsidian-entry.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // threads 池：Windows 下比默认 forks 进程池启动成本低（全量 ~32s → ~22s）
    pool: 'threads',
    // 默认 5000ms 在全量并发下会假超时（单文件几百 ms 的用例被拖到 5s+，见 smartcat 域）。
    // 放宽到 20s：只影响上限，不影响正常用例速度；真死循环仍会超时暴露。
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

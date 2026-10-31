import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * 端到端（真实网络）专用配置：只跑 tests/e2e/**。
 *
 * 主配置 `vitest.config.ts` 把 tests/e2e/** 排除在外——它依赖外网与临时仓库
 * （yeshimei/bz-e2e）的实时状态，混进门禁只会制造「随机失败」。
 *
 * 跑法：
 *   BZ_E2E_LOCAL=1.36.0 BZ_E2E_EXPECT=installed:1.37.0 npx vitest run --config vitest.e2e.config.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      // 与主配置同一套 mock（requestUrl 在本套件里被换成「真网络 + URL 重写到临时仓」）
      obsidian: path.resolve(__dirname, 'tests/mock-obsidian-entry.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/e2e/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});

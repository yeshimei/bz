import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // 测试环境将 obsidian 模块替换为 mock（vi.mock 在 setupFiles 中不可靠）
      obsidian: path.resolve(__dirname, 'src/test/mock-obsidian-entry.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});

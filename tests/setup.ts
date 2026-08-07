/**
 * 测试环境共享 setup：jsdom 中补齐 Obsidian 运行时常用 API。
 * obsidian 模块的替换由 vitest.config.ts 的 resolve.alias 完成。
 */
// 补齐 jsdom 缺失的 API
if (!window.getSelection) {
  (window as any).getSelection = () => ({
    rangeCount: 0,
    removeAllRanges: () => {},
    addRange: () => {},
  });
}

// 补齐 jsdom 缺失的 Clipboard API（备忘录剪贴板读取）
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText: () => Promise.resolve('') },
    configurable: true,
  });
}

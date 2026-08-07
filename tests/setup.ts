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

// 补齐 jsdom 缺失的 Clipboard API（备忘录剪贴板读取/写入）
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      readText: () => Promise.resolve(''),
      writeText: () => Promise.resolve(),
    },
    configurable: true,
  });
}

// 补齐 jsdom 缺失的 scrollIntoView（搜索下拉键盘导航等）
if (!Element.prototype.scrollIntoView) {
  (Element.prototype as any).scrollIntoView = () => {};
}

// 补齐 Obsidian DOM 扩展（设置页/UI 常用：createDiv/empty/addClass/toggleClass）
if (!(HTMLElement.prototype as any).createDiv) {
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
  (HTMLElement.prototype as any).addClass = function (c: string) {
    this.classList.add(c);
  };
  (HTMLElement.prototype as any).toggleClass = function (c: string, on: boolean) {
    this.classList.toggle(c, on);
  };
}

/**
 * 测试环境共享 setup：jsdom 中补齐 Obsidian 运行时常用 API。
 * obsidian 模块的替换由 vitest.config.ts 的 resolve.alias 完成。
 */
import { vi } from 'vitest';

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
{
  const original = vi.waitFor.bind(vi);
  const patched = ((callback: any, options?: any) =>
    original(
      callback,
      typeof options === 'number' ? options : { timeout: WAIT_FOR_TIMEOUT_MS, ...(options ?? {}) },
    )) as typeof vi.waitFor;
  try {
    vi.waitFor = patched;
  } catch {
    // 属性只读时的兜底（下游用的是同一份对象，重定义同样生效）
    Object.defineProperty(vi, 'waitFor', { value: patched, writable: true, configurable: true });
  }
}

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

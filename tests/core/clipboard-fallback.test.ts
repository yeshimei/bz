/**
 * core 剪贴板复制降级兜底单源测试（issue 347 第 4 项）：
 * copySensitiveWithFallback = copySensitiveText（navigator.clipboard.writeText）失败 →
 * textarea + execCommand('copy') 选中法兜底；任一路径成功布防 60s 自动清空剪贴板。
 * encrypt/ui（日记正文复制）与 password-vault（面板复制 + quick-pick 快速取密）双域消费同一实现。
 * jsdom 下 mock navigator.clipboard 与 document.execCommand（jsdom 无二者真实现）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { copySensitiveWithFallback, cancelClipboardClear } from '../../src/core/utils';

/** 替换 navigator.clipboard（configurable: true，setup.ts 的补齐桩可被覆盖） */
function stubClipboard(writeText: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText: vi.fn(() => Promise.resolve('')) },
    configurable: true,
  });
}

describe('copySensitiveWithFallback（core 剪贴板降级兜底单源）', () => {
  beforeEach(() => {
    cancelClipboardClear(); // 清前序用例可能布防的 60s 定时器
  });

  afterEach(() => {
    cancelClipboardClear();
    delete (document as any).execCommand; // 摘掉用例注入的 execCommand
    vi.useRealTimers();
  });

  it('navigator.clipboard 成功 → 直接成功（不走兜底），布防 60s 清空（到点回写空串）', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    vi.useFakeTimers();
    await expect(copySensitiveWithFallback('secret')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('secret');
    // 60s 自动清空：明文不留存
    await vi.advanceTimersByTimeAsync(60_000);
    expect(writeText).toHaveBeenLastCalledWith('');
  });

  it('navigator.clipboard 失败 → textarea+execCommand 兜底成功，布防 60s 清空', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    stubClipboard(writeText);
    const exec = vi.fn(() => true);
    (document as any).execCommand = exec;
    vi.useFakeTimers();
    await expect(copySensitiveWithFallback('secret')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    // 兜底 textarea 用后即摘，不残留 DOM
    expect(document.querySelectorAll('textarea').length).toBe(0);
    // 首次失败写入 + 兜底成功后布防的 60s 清空（回写空串）
    await vi.advanceTimersByTimeAsync(60_000);
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith('');
  });

  it('execCommand 返回 false（兜底也失败）→ 返回 false，且不布防 60s 清空', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    stubClipboard(writeText);
    (document as any).execCommand = vi.fn(() => false);
    vi.useFakeTimers();
    await expect(copySensitiveWithFallback('secret')).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(writeText).toHaveBeenCalledTimes(1); // 仅失败的那次尝试，无清空回写
  });

  it('execCommand 抛错 → 吞掉异常返回 false（不向上抛）', async () => {
    stubClipboard(vi.fn(() => Promise.reject(new Error('denied'))));
    (document as any).execCommand = vi.fn(() => {
      throw new Error('boom');
    });
    await expect(copySensitiveWithFallback('secret')).resolves.toBe(false);
  });
});

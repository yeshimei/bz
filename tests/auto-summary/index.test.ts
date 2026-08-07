/**
 * 自动摘要入口测试（ticket 10）：fake timers 推进注册 + create 事件三种路径。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { ensureAutoSummary, isAutoSummaryInitialized, unloadAutoSummary } from '../../src/auto-summary/index';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

describe('auto-summary 入口', () => {
  let vault: MockVault;
  const LONG_BODY = '段落内容。'.repeat(30);

  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  afterEach(() => {
    unloadAutoSummary();
    vi.useRealTimers();
  });

  it('初始化幂等 + 延迟注册监听', () => {
    ensureAutoSummary(makeApp(vault));
    expect(isAutoSummaryInitialized()).toBe(true);
    // 未到 2000ms 不注册监听
    expect(vault.listeners['create']).toBeUndefined();
  });

  it('非 md / 目录外文件 → 不处理', async () => {
    ensureAutoSummary(makeApp(vault));
    await vi.advanceTimersByTimeAsync(2000);
    // 目录外 md
    vault.files.set('Inbox/x.md', `---\nlink: "https://x.com/x"\n---\n\n${LONG_BODY}`);
    // 非 md
    vault.files.set('归档/网页剪藏/y.txt', 'hello');
    vault.emit('create', vault.file('Inbox/x.md'));
    vault.emit('create', vault.file('归档/网页剪藏/y.txt'));
    await vi.advanceTimersByTimeAsync(1600);
    // 无 AI 配置时 fetch 可能失败，但文件不应被 modify
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('卸载清理：offref + initialized=false', () => {
    ensureAutoSummary(makeApp(vault));
    vi.advanceTimersByTime(2000);
    expect(isAutoSummaryInitialized()).toBe(true);
    unloadAutoSummary();
    expect(isAutoSummaryInitialized()).toBe(false);
    // 再次 ensure 可重新注册
    ensureAutoSummary(makeApp(vault));
    expect(isAutoSummaryInitialized()).toBe(true);
  });
});

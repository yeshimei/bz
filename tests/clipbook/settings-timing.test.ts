/**
 * clipbook 设置「摘要时机」onChange 测试（审计修复）：
 * timing 切换即时生效——onChange 重注册 auto-summary 监听（lazy↔immediate 无需重启）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clipbookSettingsSchema } from '../../src/clipbook/ui';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { ensureAutoSummary, isAutoSummaryInitialized, unloadAutoSummary } from '../../src/auto-summary';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function timingRow(): { onChange?: (v: string, ctx?: unknown) => void } {
  const schema = clipbookSettingsSchema();
  const group = schema.groups.find((g) => g.name === '智能')!;
  const row: any = group.rows.find((r: any) => r.name === '摘要时机');
  expect(row).toBeTruthy();
  return row;
}

describe('clipbook 摘要时机 onChange（重注册监听）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp({ vault, metadataCache: {}, workspace: { on: () => ({}) } } as any);
    setSettingsProvider(() => ({ autoSummaryEnabled: true, autoSummaryTiming: 'immediate', articleDirectory: '归档/网页剪藏' }) as any);
  });

  afterEach(() => {
    unloadAutoSummary();
    vi.useRealTimers();
  });

  it('immediate → lazy：onChange 后新监听按 lazy 注册（不再等重启）', async () => {
    ensureAutoSummary({ vault, metadataCache: {}, workspace: { on: () => ({}) } } as any);
    await vi.advanceTimersByTimeAsync(2000);
    expect(isAutoSummaryInitialized()).toBe(true);
    expect(vault.listeners['create']).toHaveLength(1); // immediate：create 监听在

    timingRow().onChange!('lazy'); // 渲染器先写 settings 再触发 onChange（此处同步切 provider 模拟）
    setSettingsProvider(() => ({ autoSummaryEnabled: true, autoSummaryTiming: 'lazy', articleDirectory: '归档/网页剪藏' }) as any);
    // onChange：stopAutoSummary 摘除旧监听 + ensureAutoSummary 重注册（按新 timing）
    expect(vault.listeners['create']).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.listeners['create']).toHaveLength(0); // lazy：不再注册 create
  });  it('lazy → immediate：onChange 后恢复 create 监听', async () => {
    setSettingsProvider(() => ({ autoSummaryEnabled: true, autoSummaryTiming: 'lazy', articleDirectory: '归档/网页剪藏' }) as any);
    ensureAutoSummary({ vault, metadataCache: {}, workspace: { on: () => ({}) } } as any);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.listeners['create']).toBeUndefined(); // lazy：无 create 监听

    setSettingsProvider(() => ({ autoSummaryEnabled: true, autoSummaryTiming: 'immediate', articleDirectory: '归档/网页剪藏' }) as any);
    timingRow().onChange!('immediate');
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.listeners['create']).toHaveLength(1); // 立即恢复 create 监听
  });
});

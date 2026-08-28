/**
 * 阅读数据分析报告错误路径测试（m1b）：统计失败 → 人话错误（弹窗占位 + toast），详情留 console。
 * getAllBookNotes 经 vi.mock 抛错，验证 index 的 catch 路径不把技术异常暴露给用户面。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/reading-report/stats', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    getAllBookNotes: vi.fn(() => {
      throw new Error('模拟书库读取失败');
    }),
  };
});

import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { __resetNoticeForTests } from '../../src/core/notice';
import { showReadingReport } from '../../src/reading-report/index';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {
      getFileCache: () => null,
    },
    workspace: {},
  } as any;
}

describe('统计失败（m1b 人话化）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    __resetNoticeForTests();
    setSettingsProvider(() => ({}) as any);
  });

  it('getAllBookNotes 抛错 → 弹窗显示人话错误、toast 提示、技术详情留 console', async () => {
    const vault = new MockVault();
    setApp(makeApp(vault));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await showReadingReport(makeApp(vault) as any);

      // 弹窗占位 → 人话错误（不展示原始异常字符串）
      const modal = document.querySelector('.bz-reading-report-overlay') as HTMLElement;
      expect(modal).not.toBeNull();
      expect(modal.textContent).toContain('统计失败');
      expect(modal.textContent).toContain('请查看控制台');
      expect(modal.textContent).not.toContain('模拟书库读取失败');

      // progress toast 转 error，同样人话
      const toast = document.querySelector('#bz-notice-container .bz-notice') as HTMLElement;
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('统计失败：读取书库时出错');

      // 技术详情留 console
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
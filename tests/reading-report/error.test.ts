/**
 * 阅读数据分析报告错误路径测试（m1b）：统计失败 → 人话错误（容器占位 + toast），详情留 console。
 * getAllBookNotes 经 vi.mock 抛错，验证 index 的 catch 路径不把技术异常暴露给用户面。
 * （读书报告内嵌化：原独立弹窗容器换成书架墙面板内容区容器。）
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
import { renderReadingReport } from '../../src/reading-report/index';
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

  it('getAllBookNotes 抛错 → 容器显示人话错误、toast 提示、技术详情留 console', async () => {
    const vault = new MockVault();
    setApp(makeApp(vault));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const container = document.createElement('div');
      document.body.appendChild(container);
      renderReadingReport(container, makeApp(vault) as any);
      await new Promise((r) => setTimeout(r, 60));

      // 容器占位 → 人话错误（不展示原始异常字符串）
      expect(container.textContent).toContain('统计失败');
      expect(container.textContent).toContain('请查看控制台');
      expect(container.textContent).not.toContain('模拟书库读取失败');

      // progress toast 转 error，同样人话（走查批 D：不引导用户去控制台）
      const toast = document.querySelector('#bz-notice-container .bz-notice') as HTMLElement;
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('统计失败：读取书库时出错，请重试；若反复出现请重新打开面板');

      // 技术详情留 console
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
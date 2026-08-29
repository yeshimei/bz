/**
 * 文献盒补充覆盖测试（src/literature/index.ts 未触达分支）：
 * openLiteratureAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）与 unloadLiterature 卸载。
 * （原 bz-bili-open 网页版启动器用例已随网页版移除，ticket 136）
 */
import { describe, it, expect, afterEach } from 'vitest';
import { openLiteratureAddTask, unloadLiterature } from '../../src/literature';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

describe('openLiteratureAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）', () => {
  afterEach(() => {
    unloadLiterature();
    document.body.innerHTML = '';
  });

  it('ensure 幂等初始化 → 主面板叠开添加弹窗，预填链接去空白/标题/UP主（新增模式标题）', () => {
    setApp({ vault: new MockVault() } as any);
    openLiteratureAddTask({} as any, { url: ' https://www.bilibili.com/video/BV1xx411c7mD ', title: '某视频', uploader: 'UP主甲' });
    expect(document.getElementById('bili-tasks-popup')!.style.display).toBe('flex');
    expect(document.getElementById('bili-add-popup')!.style.display).toBe('flex');
    expect((document.getElementById('bili-add-url') as HTMLInputElement).value).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    expect((document.getElementById('bili-add-vtitle') as HTMLInputElement).value).toBe('某视频');
    expect((document.getElementById('bili-add-uploader') as HTMLInputElement).value).toBe('UP主甲');
    expect(document.getElementById('bili-add-title')!.textContent).toBe('添加转文献任务');
  });
});

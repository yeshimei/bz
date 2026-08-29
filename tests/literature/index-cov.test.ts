/**
 * 文献盒补充覆盖测试（src/literature/index.ts 未触达分支）：
 * openLiteratureAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）与 unloadLiterature 卸载。
 * ticket 136 改版：入口打开的是「视频录入」面板（任务队列 + 叠开添加弹窗），id 前缀改 literature-/lit-；
 * （原 bz-bili-open 网页版启动器用例已随网页版移除，ticket 136）
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openLiteratureAddTask, unloadLiterature } from '../../src/literature';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

describe('openLiteratureAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）', () => {
  afterEach(() => {
    unloadLiterature();
    document.body.innerHTML = '';
  });

  it('ensure 幂等初始化 → 视频录入面板叠开添加弹窗，预填链接/标题/UP主（新增模式标题）', async () => {
    resetObsidianMocks();
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', literatureDirectory: '文献盒' }) as any);
    setSettingsSaver(async () => {});

    openLiteratureAddTask(app, { url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '某视频', uploader: 'UP主甲' });

    await vi.waitFor(() => expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex'));
    await vi.waitFor(() => expect(document.getElementById('literature-add-popup')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-add-url') as HTMLInputElement).value).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    expect((document.getElementById('lit-add-vtitle') as HTMLInputElement).value).toBe('某视频');
    expect((document.getElementById('lit-add-uploader') as HTMLInputElement).value).toBe('UP主甲');
    expect(document.getElementById('lit-add-title')!.textContent).toBe('添加转文献任务');
  });

  it('无 prefill：仅打开视频录入面板，不叠开添加弹窗', async () => {
    resetObsidianMocks();
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', literatureDirectory: '文献盒' }) as any);
    setSettingsSaver(async () => {});

    openLiteratureAddTask(app);

    await vi.waitFor(() => expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex'));
    expect(document.getElementById('literature-add-popup')!.style.display).toBe('none');
  });
});

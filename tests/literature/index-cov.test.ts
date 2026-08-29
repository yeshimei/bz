/**
 * 文献盒补充覆盖测试（src/literature/index.ts 未触达分支）：
 * openLiteratureAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）、
 * openTermNote（bz-literature-note-term 命令：MarkdownView 类右值 + 选区预填，ticket 138 §1.1）、
 * 与 unloadLiterature 卸载。
 * ticket 136 改版：入口打开的是「视频录入」面板（任务队列 + 叠开添加弹窗），id 前缀改 literature-/lit-；
 * （原 bz-bili-open 网页版启动器用例已随网页版移除，ticket 136）
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MarkdownView } from 'obsidian';
import { openLiteratureAddTask, openTermNote, unloadLiterature } from '../../src/literature';
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
    // ticket 143：无标题，新增模式无编辑标签
    expect(document.getElementById('lit-add-title')).toBeNull();
    expect(document.getElementById('lit-add-mode')!.style.display).toBe('none');
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

describe('openTermNote（bz-literature-note-term 命令：MarkdownView 类右值 + 选区预填，ticket 138 §1.1）', () => {
  afterEach(() => {
    unloadLiterature();
    document.body.innerHTML = '';
  });

  /** 注入 getActiveViewOfType 桩：记录被调用参数（应为 MarkdownView 类），返回指定视图 */
  function setupApp(viewOfType: any): any {
    resetObsidianMocks();
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveViewOfType = vi.fn(() => viewOfType);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', literatureDirectory: '文献盒' }) as any);
    setSettingsSaver(async () => {});
    return app;
  }

  it('无显式 term：读激活 Markdown 视图选区预填（getActiveViewOfType 传 MarkdownView 类而非字符串）', async () => {
    const app = setupApp({ editor: { getSelection: () => '  黑洞  ' } });

    openTermNote(app);

    await vi.waitFor(() => expect(document.getElementById('literature-term-popup')!.style.display).toBe('flex'));
    expect(app.workspace.getActiveViewOfType).toHaveBeenCalledWith(MarkdownView); // 类右值（1.1 根因修复）
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('黑洞');
    expect(document.getElementById('lit-term-preview')!.style.display).toBe('none');
  });

  it('显式 term 优先：不读选区；选区为空白 → 空输入框', async () => {
    const app = setupApp({ editor: { getSelection: () => '   ' } });

    openTermNote(app, '贝叶斯定理');

    await vi.waitFor(() => expect(document.getElementById('literature-term-popup')!.style.display).toBe('flex'));
    expect(app.workspace.getActiveViewOfType).not.toHaveBeenCalled();
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('贝叶斯定理');
  });

  it('无激活视图（getActiveViewOfType 返回 null）→ 空输入框手填，不抛错', async () => {
    const app = setupApp(null);

    expect(() => openTermNote(app)).not.toThrow();

    await vi.waitFor(() => expect(document.getElementById('literature-term-popup')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('');
  });
});

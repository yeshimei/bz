/**
 * 黑匣子三标签面板骨架测试（ticket 59）：打开/关闭/标签切换/空态/数据渲染/打开即时提炼。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxPanel, closeBlackBoxPanel, unloadBlackBoxPanel, getPanelState } from '../../src/blackbox/panel';
import { BlackBoxDataManager, createProfile, createEvent } from '../../src/blackbox/data';
import { defaultBlackBoxData } from '../../src/blackbox/types';

async function setup(withData = false) {
  const vault = new MockVault();
  vault.create('我的/日记/2026-08-10.md', '# 📖 08:30\n\n和妈妈搬完家。\n');
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  if (withData) {
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    data.profiles.push(createProfile('妈妈', '2026-08-10'));
    data.events.push(createEvent('搬家完成', '2026-08-10T08:30', 0.9, { path: '2026-08-10', lineNumber: 1, time: '08:30' }));
    await dm.save(data);
  }
  return { vault, app };
}

describe('黑匣子面板骨架', () => {
  beforeEach(() => resetObsidianMocks());
  afterEach(() => unloadBlackBoxPanel());

  it('打开 → 弹窗 + 标题「黑匣子」+ 三标签', async () => {
    const { app } = await setup();
    openBlackBoxPanel(app);
    const popup = document.getElementById('bz-blackbox-panel');
    expect(popup).not.toBeNull();
    expect(popup!.style.display).not.toBe('none');
    const title = document.getElementById('bz-blackbox-panel-title');
    expect(title!.textContent).toContain('黑匣子');
    const tabs = popup!.querySelectorAll('.bz-blackbox-tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toContain('人物');
    expect(tabs[1].textContent).toContain('时间线');
    expect(tabs[2].textContent).toContain('复盘');
  });

  it('空数据 → 人物墙空态', async () => {
    const { app } = await setup();
    openBlackBoxPanel(app);
    await new Promise((r) => setTimeout(r, 30));
    const content = document.getElementById('bz-blackbox-panel-content');
    expect(content!.textContent).toContain('暂无');
  });

  it('有画像 → 人物墙渲染画像卡', async () => {
    const { app } = await setup(true);
    openBlackBoxPanel(app);
    // 等待数据 load（异步）
    await new Promise((r) => setTimeout(r, 30));
    const content = document.getElementById('bz-blackbox-panel-content');
    expect(content!.textContent).toContain('妈妈');
  });

  it('标签切换：时间线显示事件 / 复盘流显示复盘', async () => {
    const { app } = await setup(true);
    openBlackBoxPanel(app);
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-blackbox-panel')!;
    const tabs = popup.querySelectorAll('.bz-blackbox-tab');
    (tabs[1] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const content = document.getElementById('bz-blackbox-panel-content')!;
    expect(content.textContent).toContain('搬家完成');
    (tabs[2] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(content.textContent).toContain('暂无');
  });

  it('❌ 关闭 → 弹窗隐藏', async () => {
    const { app } = await setup();
    openBlackBoxPanel(app);
    const popup = document.getElementById('bz-blackbox-panel')!;
    const close = popup.querySelector('.bz-icon-btn--close') as HTMLElement;
    close.click();
    expect(popup.style.display).toBe('none');
    expect(getPanelState().isVisible()).toBe(false);
  });

  it('打开时触发即时提炼（有待处理条目 → 调 AI）', async () => {
    const { app } = await setup();
    const ai = { json: vi.fn().mockResolvedValue('{"people":[],"events":[],"emotions":[]}') } as any;
    openBlackBoxPanel(app, ai);
    await new Promise((r) => setTimeout(r, 50));
    expect(ai.json).toHaveBeenCalled();
  });
});
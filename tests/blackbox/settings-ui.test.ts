/**
 * 黑匣子设置弹窗测试（ticket 64）：6 项设置渲染（AI 服务商/Ollama URL/Ollama 模型/历史条数/推测开关）+ 情绪词表增删持久化。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxSettings } from '../../src/blackbox/settings-ui';
import { closeSettingsModal } from '../../src/core/settings-modal';
import { BlackBoxDataManager } from '../../src/blackbox/data';

function setup() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  const settings: any = {
    storagePath: 'CONFIG/STORAGE',
    blackboxAIProvider: 'deepseek',
    blackboxOllamaUrl: 'http://localhost:11434',
    blackboxOllamaModel: 'qwen2.5:14b-instruct',
    blackboxMaxHistory: '20',
    blackboxShowSpeculativeEvents: true,
  };
  setSettingsProvider(() => settings);
  return { vault, app, settings };
}

describe('黑匣子设置弹窗（ticket 64）', () => {
  beforeEach(() => resetObsidianMocks());
  afterEach(() => closeSettingsModal());

  it('打开 → 6 项设置（服务商/Ollama URL/Ollama 模型/历史条数/推测开关/词表）', async () => {
    setup();
    openBlackBoxSettings();
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup).not.toBeNull();
    const text = popup.textContent!;
    expect(text).toContain('情绪词表');
    const items = popup.querySelectorAll('.setting-item');
    expect(items.length).toBeGreaterThanOrEqual(5);
    // mock Setting.setName 写入 dataset.name
    const names = [...items].map((i) => (i as HTMLElement).dataset.name || '');
    expect(names).toContain('AI 服务商');
    expect(names).toContain('Ollama URL');
    expect(names).toContain('Ollama 模型');
    expect(names).toContain('对话历史条数');
    expect(names).toContain('推测事件显示');
  });

  it('词表增删：删除词 → 落盘 blackbox.json settings.words', async () => {
    const { vault } = setup();
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.settings.words).toContain('触动');
    openBlackBoxSettings();
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const chips = popup.querySelectorAll('.bz-word-chip');
    expect(chips.length).toBe(24);
    // 删除第一个词
    (chips[0].querySelector('.bz-word-del') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const dm2 = new BlackBoxDataManager();
    const data2 = await dm2.load();
    expect(data2.settings.words).toHaveLength(23);
  });

  it('词表新增：输入 + 添加 → 落盘', async () => {
    setup();
    openBlackBoxSettings();
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const input = popup.querySelector('.bz-word-add-row input') as HTMLInputElement;
    input.value = '平静';
    (popup.querySelector('.bz-word-add-row button') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.settings.words).toContain('平静');
  });

  it('设置项变更 → settings 落盘（服务商切换）', async () => {
    const { settings } = setup();
    openBlackBoxSettings();
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-settings-modal-popup')!;
    // 找「AI 服务商」设置项 → 反查 mock Setting → 取 dropdown 控件 trigger
    const item = [...popup.querySelectorAll('.setting-item')].find((i) => (i as HTMLElement).dataset.name === 'AI 服务商') as any;
    const dd = item.__setting.controls[0];
    dd.trigger('ollama');
    await new Promise((r) => setTimeout(r, 30));
    expect(settings.blackboxAIProvider).toBe('ollama');
  });
});
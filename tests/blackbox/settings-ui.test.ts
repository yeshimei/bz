/**
 * 黑匣子设置弹窗测试（ticket 38/45，v3 增第 8 项）：推测事件显示开关（默认开/持久化）、
 * 情绪词表编辑（增删持久化，不影响存量条目）、主面板默认类型筛选（默认全部/保存）、既有 5 项保留。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxSettings } from '../../src/blackbox/settings-ui';
import { closeSettingsModal } from '../../src/core/settings-modal';
import { getBlackBoxFilePath } from '../../src/blackbox/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  return { app, vault };
}

function seedVault(vault: MockVault, extra?: any): void {
  vault.files.set(
    getBlackBoxFilePath(),
    JSON.stringify({
      version: 2,
      settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖', '想念', '难过'] },
      persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
      entries: [
        { id: 'bb_t1', type: 'thought', createdAt: 't', text: '旧条目带旧情绪词', emotions: ['旧词'], people: [], scene: '', toward: '', links: [] },
      ],
      profiles: [],
      events: [],
      reviews: [],
      chat: [],
      meta: { lastReviewAt: '', totalEntries: 1, totalEvents: 0 },
      ...extra,
    })
  );
}

function loaded(vault: MockVault): any {
  return JSON.parse(vault.files.get(getBlackBoxFilePath())!);
}

/** 弹窗内按名称找设置项（mock Setting 模式，与 pomodoro/settings.test.ts 一致） */
function itemByName(name: string): any {
  return Array.from(document.querySelectorAll('#bz-settings-modal-popup .setting-item')).find(
    (it) => (it as HTMLElement).dataset.name === name
  );
}

describe('黑匣子设置弹窗（v3 8 项）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
  });
  afterEach(() => {
    closeSettingsModal();
  });

  it('打开：既有 5 项 + 推测事件显示开关 + 情绪词表编辑区', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const settings: any = { blackboxAIProvider: 'deepseek', blackboxOllamaUrl: 'http://localhost:11434', blackboxOllamaModel: 'qwen2.5:14b-instruct', blackboxReviewThreshold: '10', blackboxMaxHistory: '20' };
    const { app } = setup(vault, settings);
    await openBlackBoxSettings(app);
    expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy();
    // 既有 5 项
    for (const n of ['AI 服务', 'Ollama 地址', 'Ollama 对话模型', '复盘阈值', '对话历史保留']) {
      expect(itemByName(n)).toBeTruthy();
    }
    // v2 2 项
    expect(itemByName('推测事件显示')).toBeTruthy();
    expect(itemByName('情绪词表')).toBeTruthy();
    // v3 1 项
    expect(itemByName('主面板默认类型筛选')).toBeTruthy();
    // 词表 4 词渲染
    expect(document.querySelectorAll('.bz-blackbox-word-chip').length).toBe(4);
  });

  it('推测事件显示开关：默认开；切换后全局设置与数据兜底同步持久化', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const settings: any = {};
    const { app } = setup(vault, settings);
    await openBlackBoxSettings(app);
    const tg = itemByName('推测事件显示').__setting.controls[0];
    expect(tg.value).toBe(true); // 默认开
    tg.trigger(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(settings.blackboxShowSpeculativeEvents).toBe(false);
    expect(loaded(vault).settings.showSpeculativeEvents).toBe(false); // 数据兜底同步
  });

  it('情绪词表增删：持久化到 blackbox.json settings.words；不影响存量条目 emotions', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxSettings(app);
    // 添加
    const input = document.getElementById('bz-blackbox-word-input') as HTMLInputElement;
    input.value = '释怀';
    document.getElementById('bz-blackbox-word-add')!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(hasNotice('✅ 已添加「释怀」')).toBe(true);
    expect(loaded(vault).settings.words).toContain('释怀');
    expect(document.querySelectorAll('.bz-blackbox-word-chip').length).toBe(5);
    // 删除「难过」
    const chips = document.querySelectorAll('.bz-blackbox-word-chip');
    const target = Array.from(chips).find((c) => c.textContent?.includes('难过')) as HTMLElement;
    (target.querySelector('.bz-blackbox-people-remove') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    const data = loaded(vault);
    expect(data.settings.words).not.toContain('难过');
    // 存量条目 emotions 不受影响
    expect(data.entries[0].emotions).toEqual(['旧词']);
  });

  it('主面板默认类型筛选：默认全部；切换后持久化到 data.json', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const settings: any = {};
    const { app } = setup(vault, settings);
    await openBlackBoxSettings(app);
    const dd = itemByName('主面板默认类型筛选').__setting.controls[0];
    expect(dd.value).toBe(''); // 默认全部
    dd.trigger('thought');
    await new Promise((r) => setTimeout(r, 50));
    expect(settings.blackboxDefaultTypeFilter).toBe('thought');
    // 已设值时回显
    const settings2: any = { blackboxDefaultTypeFilter: 'concept' };
    const { app: app2 } = setup(vault, settings2);
    await openBlackBoxSettings(app2);
    expect(itemByName('主面板默认类型筛选').__setting.controls[0].value).toBe('concept');
  });

  it('重复词拒绝；空词拒绝', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxSettings(app);
    const input = document.getElementById('bz-blackbox-word-input') as HTMLInputElement;
    input.value = '触动';
    document.getElementById('bz-blackbox-word-add')!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(hasNotice('⚠️ 词已存在')).toBe(true);
    input.value = '   ';
    document.getElementById('bz-blackbox-word-add')!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(hasNotice('⚠️ 词不能为空')).toBe(true);
    expect(loaded(vault).settings.words.length).toBe(4);
  });
});

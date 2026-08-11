/**
 * 黑匣子对话面板 UI 测试（ticket 36/45）：欢迎语/发送对话（mock Ollama）/失败降级/成长区（含 v2 复盘产物）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxChat, closeBlackBoxChat, unloadBlackBox } from '../../src/blackbox';
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

function mockOllama(content: string) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: { content } }) }));
  (global as any).fetch = fetchMock;
  return fetchMock;
}

/** 预置 v2 数据：3 条内容 + 1 个画像 + 1 个事件 + 1 条复盘（含 v2 产物字段） */
function seedVault(vault: MockVault, extra?: any): void {
  vault.files.set(
    getBlackBoxFilePath(),
    JSON.stringify({
      version: 2,
      settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖', '想念', '难过'] },
      persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [{ ts: 't0', view: '我认识主人了' }] },
      entries: [
        { id: 'bb_t1', type: 'thought', createdAt: 't1', text: '给妹妹买吉他', emotions: ['温暖'], people: ['pf_1'], scene: '', toward: '', links: [] },
        { id: 'bb_t2', type: 'thought', createdAt: 't2', text: '量子隧穿', emotions: [], people: [], scene: '', toward: '', links: [] },
        { id: 'bb_t3', type: 'thought', createdAt: 't3', text: '茉莉花的香气', emotions: [], people: [], scene: '', toward: '', links: [] },
      ],
      profiles: [{ id: 'pf_1', name: '妹妹', relation: '家人', impression: '很要强', aiObservations: [], pinnedEvents: [], createdAt: 't' }],
      events: [
        { id: 'ev_1', title: '给妹妹买吉他', time: '2026-08-01', inferred: false, summary: '', people: ['pf_1'], mainPerson: 'pf_1', evidence: ['bb_t1'], emotions: ['温暖'], edited: false },
      ],
      reviews: [
        { ts: 't4', text: '我看到一个细腻又好奇的人', impressionCount: 3, newSelfView: '', eventReport: '这周我整理了 1 件新事件', profileHint: '👤 我常听你提起「老王」' },
      ],
      chat: [],
      meta: { lastReviewAt: 't4', totalEntries: 3, totalEvents: 1 },
      ...extra,
    })
  );
}

describe('黑匣子对话面板', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadBlackBox();
  });
  afterEach(() => {
    unloadBlackBox();
    delete (global as any).fetch;
  });

  it('打开：标题显示包仔与条目计数；空历史渲染欢迎语', async () => {
    const vault = new MockVault();
    const { app } = setup(vault);
    await openBlackBoxChat(app);
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-chat-popup')!.style.display).toBe('flex');
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('包仔');
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('0 条内容');
    const bubbles = document.querySelectorAll('.bz-blackbox-bubble-assistant');
    expect(bubbles.length).toBe(1);
    expect(bubbles[0].textContent).toContain('黑匣子的意识体');
  });

  it('发送对话（mock AI）：用户消息 + AI 回复写入 chat；标题计数', async () => {
    mockOllama('当然记得，茉莉花和夏夜的风。');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    const input = document.getElementById('bz-blackbox-chat-input') as HTMLTextAreaElement;
    input.value = '你还记得茉莉花吗';
    document.getElementById('bz-blackbox-chat-send')!.click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('当然记得，茉莉花和夏夜的风。');
    });
    const data = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(data.chat.some((m: any) => m.role === 'user' && m.text === '你还记得茉莉花吗')).toBe(true);
    expect(data.chat.some((m: any) => m.role === 'assistant' && m.text === '当然记得，茉莉花和夏夜的风。')).toBe(true);
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('3 条内容');
  });

  it('AI 失败：toast 降级提示，对话不写入', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    (global as any).fetch = vi.fn(async () => {
      throw new Error('网络错误');
    });
    await openBlackBoxChat(app);
    const input = document.getElementById('bz-blackbox-chat-input') as HTMLTextAreaElement;
    input.value = '在吗';
    document.getElementById('bz-blackbox-chat-send')!.click();
    await vi.waitFor(() => {
      expect(hasNotice('❌ 包仔暂时没法说话（AI 未配置或网络异常）')).toBe(true);
    });
    const data = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(data.chat.filter((m: any) => m.role === 'assistant').length).toBe(0);
  });

  it('成长区：显示最近复盘产物（含事件汇报/新人物提示）+ 手动复盘按钮', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxChat(app);
    const growth = document.getElementById('bz-blackbox-growth')!;
    expect(growth.textContent).toContain('我看到一个细腻又好奇的人');
    expect(growth.textContent).toContain('这周我整理了 1 件新事件');
    expect(growth.textContent).toContain('老王');
    const btn = growth.querySelector('.bz-blackbox-review-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('复盘一次');
  });

  it('手动复盘：产物公开写入对话流（复盘文本作为包仔的话）', async () => {
    mockOllama('{"text": "我看到一个细腻又好奇的人", "newSelfView": "我越来越懂主人了"}');
    const vault = new MockVault();
    seedVault(vault, { reviews: [], chat: [], meta: { lastReviewAt: '', totalEntries: 3, totalEvents: 1 } });
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    const btn = document.querySelector('.bz-blackbox-review-btn') as HTMLButtonElement;
    btn.click();
    await vi.waitFor(() => {
      const data = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
      expect(data.reviews.length).toBe(1);
    });
    const data = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(data.reviews[0].text).toContain('细腻');
    expect(data.persona.selfViews[data.persona.selfViews.length - 1].view).toBe('我越来越懂主人了');
    // 产物以"包仔的话"出现在对话流
    expect(data.chat.some((m: any) => m.role === 'assistant' && m.text.includes('细腻'))).toBe(true);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-blackbox-bubble-assistant').length).toBeGreaterThan(0);
    });
  });
});

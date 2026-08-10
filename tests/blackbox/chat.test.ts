/**
 * 黑匣子对话面板 UI 测试（ticket 36/37）：欢迎语/发送对话（mock Ollama）/失败降级/成长区/手动复盘。
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

/** 预置有 3 条感触 + 1 条复盘的数据文件 */
function seedVault(vault: MockVault, extra?: any): void {
  vault.files.set(
    getBlackBoxFilePath(),
    JSON.stringify({
      version: 1,
      persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [{ ts: 't0', view: '我认识主人了' }] },
      impressions: [
        { id: 'i1', ts: 't1', material: '茉莉花', feeling: '夏夜', emotions: [], scene: '', people: '', direction: '', links: [] },
        { id: 'i2', ts: 't2', material: '量子隧穿', feeling: '震撼', emotions: [], scene: '', people: '', direction: '', links: [] },
        { id: 'i3', ts: 't3', material: '给妹妹买吉他', feeling: '温暖', emotions: [], scene: '', people: '', direction: '', links: [] },
      ],
      reviews: [{ ts: 't4', text: '我看到一个细腻又好奇的人', impressionCount: 3, newSelfView: '' }],
      chat: [],
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

  it('打开：标题显示包仔与感触计数；空历史渲染欢迎语', async () => {
    const vault = new MockVault();
    const { app } = setup(vault);
    await openBlackBoxChat(app);
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-chat-popup')!.style.display).toBe('flex');
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('包仔');
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('0 条感触');
    const bubbles = document.querySelectorAll('.bz-blackbox-bubble-assistant');
    expect(bubbles.length).toBe(1);
    expect(bubbles[0].textContent).toContain('我是包仔');
  });

  it('标题计数随数据更新；成长区显示最近复盘', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault);
    await openBlackBoxChat(app);
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('3 条感触');
    const growth = document.getElementById('bz-blackbox-growth')!;
    expect(growth.textContent).toContain('包仔的成长');
    expect(growth.textContent).toContain('细腻又好奇');
  });

  it('发送消息：user 气泡 + AI 回复气泡 + 落盘', async () => {
    mockOllama('我记得那朵茉莉花。');
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    const input = document.getElementById('bz-blackbox-chat-input') as HTMLTextAreaElement;
    input.value = '你还记得茉莉花吗';
    (document.getElementById('bz-blackbox-chat-send') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const bodies = Array.from(document.querySelectorAll('.bz-blackbox-bubble-body')).map((b) => b.textContent);
    expect(bodies).toContain('你还记得茉莉花吗');
    expect(bodies).toContain('我记得那朵茉莉花。');
    const saved = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(saved.chat.map((m: any) => m.text)).toEqual(['你还记得茉莉花吗', '我记得那朵茉莉花。']);
  });

  it('AI 失败：toast 降级提示，输入未丢失', async () => {
    (global as any).fetch = vi.fn(async () => {
      throw new Error('down');
    });
    const { app } = setup(new MockVault(), { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    const input = document.getElementById('bz-blackbox-chat-input') as HTMLTextAreaElement;
    input.value = '你好';
    (document.getElementById('bz-blackbox-chat-send') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(hasNotice(/包仔暂时没法说话/)).toBe(true);
    const sendBtn = document.getElementById('bz-blackbox-chat-send') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);
  });

  it('手动复盘：产物追加 reviews + 对话 + toast 反馈 + 成长区刷新', async () => {
    mockOllama('{"text": "复盘之后，我更懂你了", "newSelfView": "我是陪伴者"}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    const btn = document.querySelector('.bz-blackbox-review-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(hasNotice(/包仔复盘完成/)).toBe(true);
    const saved = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(saved.reviews.length).toBe(2);
    expect(saved.reviews[1].text).toBe('复盘之后，我更懂你了');
    expect(saved.persona.selfViews[saved.persona.selfViews.length - 1].view).toBe('我是陪伴者');
    expect(saved.chat.some((m: any) => m.text.includes('复盘之后'))).toBe(true);
    expect(document.getElementById('bz-blackbox-growth')!.textContent).toContain('复盘之后');
  });

  it('空库手动复盘：提示先写感触', async () => {
    const { app } = setup(new MockVault(), { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    const btn = document.querySelector('.bz-blackbox-review-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice(/先写几条感触/)).toBe(true);
  });

  it('关闭清理：esc 注销，重复开关无残留', async () => {
    const { app } = setup();
    await openBlackBoxChat(app);
    closeBlackBoxChat();
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeFalsy();
    await openBlackBoxChat(app);
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeTruthy();
  });
});

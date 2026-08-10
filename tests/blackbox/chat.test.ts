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

  it('发送时重载最新数据：面板快照期间外部新增的感触不被覆盖', async () => {
    mockOllama('回复');
    const vault = new MockVault();
    seedVault(vault); // 3 条感触
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    // 模拟面板开着时经「写感触」录入了第 4 条（直接改文件）
    const raw = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    raw.impressions.push({
      id: 'i4', ts: 't9', material: '新录入的感触', feeling: '不该被覆盖',
      emotions: [], scene: '', people: '', direction: '', links: [],
    });
    vault.files.set(getBlackBoxFilePath(), JSON.stringify(raw));
    // 面板内发消息
    const input = document.getElementById('bz-blackbox-chat-input') as HTMLTextAreaElement;
    input.value = '你好';
    (document.getElementById('bz-blackbox-chat-send') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const saved = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(saved.impressions.length).toBe(4); // 第 4 条未被旧快照覆盖
    expect(saved.impressions.some((i: any) => i.id === 'i4')).toBe(true);
    expect(saved.chat.length).toBeGreaterThan(0);
  });

  it('重开面板重载数据：外部新增的感触反映到标题计数', async () => {
    const vault = new MockVault();
    seedVault(vault); // 3 条
    const { app } = setup(vault);
    await openBlackBoxChat(app);
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('3 条感触');
    // 外部写入第 4 条
    const raw = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    raw.impressions.push({
      id: 'i4', ts: 't9', material: 'x', feeling: 'y',
      emotions: [], scene: '', people: '', direction: '', links: [],
    });
    vault.files.set(getBlackBoxFilePath(), JSON.stringify(raw));
    // 命令再次触发 open（面板已开）→ 重载刷新
    await openBlackBoxChat(app);
    expect(document.getElementById('bz-blackbox-chat-title')!.textContent).toContain('4 条感触');
  });

  it('AI 回复写前重载：回复期间外部新增的感触不被覆盖', async () => {
    const fetchMock = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 60)); // 模拟长 AI 调用
      return { ok: true, json: async () => ({ message: { content: '回复内容' } }) };
    });
    (global as any).fetch = fetchMock;
    const vault = new MockVault();
    seedVault(vault); // 3 条
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxChat(app);
    const input = document.getElementById('bz-blackbox-chat-input') as HTMLTextAreaElement;
    input.value = '你好';
    (document.getElementById('bz-blackbox-chat-send') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20)); // AI 在途
    // 外部并发写入第 4 条感触
    const raw = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    raw.impressions.push({
      id: 'i4', ts: 't9', material: '并发新增', feeling: '不该被覆盖',
      emotions: [], scene: '', people: '', direction: '', links: [],
    });
    vault.files.set(getBlackBoxFilePath(), JSON.stringify(raw));
    await new Promise((r) => setTimeout(r, 120));
    const saved = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(saved.impressions.length).toBe(4); // 外部新增未被回复写回覆盖
    expect(saved.chat.some((m: any) => m.text === '回复内容')).toBe(true);
  });

  it('关闭清理：esc 注销，重复开关无残留', async () => {
    const { app } = setup();
    await openBlackBoxChat(app);
    closeBlackBoxChat();
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeFalsy();
    expect(document.getElementById('bz-blackbox-chat-popup')).toBeFalsy(); // popup 是兄弟节点，必须同移除
    await openBlackBoxChat(app);
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeTruthy();
    expect(document.querySelectorAll('#bz-blackbox-chat-popup').length).toBe(1); // 无堆积
  });

  it('点击遮罩关闭：mask 与 popup 同消失', async () => {
    const { app } = setup();
    await openBlackBoxChat(app);
    document.getElementById('bz-blackbox-chat-mask')!.click();
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeFalsy();
    expect(document.getElementById('bz-blackbox-chat-popup')).toBeFalsy();
  });

  it('点击右上角 ✕ 关闭：mask 与 popup 同消失', async () => {
    const { app } = setup();
    await openBlackBoxChat(app);
    (document.querySelector('.bz-blackbox-modal-close') as HTMLButtonElement).click();
    expect(document.getElementById('bz-blackbox-chat-mask')).toBeFalsy();
    expect(document.getElementById('bz-blackbox-chat-popup')).toBeFalsy();
  });
});

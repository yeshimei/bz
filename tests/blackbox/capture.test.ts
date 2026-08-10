/**
 * 黑匣子录入弹窗 UI 测试（ticket 35）：必填校验/情绪 chips 限 3 + 强度/保存落盘/阈值静默复盘/AI 辅助降级。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxCapture, closeBlackBoxCapture, unloadBlackBox } from '../../src/blackbox';
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

/** ollama 模式 mock fetch（POST /api/chat → message.content） */
function mockOllama(content: string) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: { content } }) }));
  (global as any).fetch = fetchMock;
  return fetchMock;
}

function openAndFill(material: string, feeling: string) {
  const m = document.getElementById('bz-blackbox-material') as HTMLTextAreaElement;
  const f = document.getElementById('bz-blackbox-feeling') as HTMLTextAreaElement;
  if (m) m.value = material;
  if (f) f.value = feeling;
}

describe('黑匣子录入弹窗', () => {
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

  it('打开：渲染必填区与 24 个情绪 chips', () => {
    const { app } = setup();
    openBlackBoxCapture(app);
    expect(document.getElementById('bz-blackbox-capture-mask')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-capture-popup')!.style.display).toBe('flex');
    expect(document.getElementById('bz-blackbox-material')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-feeling')).toBeTruthy();
    expect(document.querySelectorAll('.bz-blackbox-chip').length).toBe(24);
  });

  it('重复打开幂等：不重建 DOM', () => {
    const { app } = setup();
    openBlackBoxCapture(app);
    const first = document.getElementById('bz-blackbox-capture-popup');
    openBlackBoxCapture(app);
    expect(document.getElementById('bz-blackbox-capture-popup')).toBe(first);
  });

  it('情绪 chips：最多选 3 个，第 4 个被拒 + 强度区随选中出现', () => {
    const { app } = setup();
    openBlackBoxCapture(app);
    const chips = Array.from(document.querySelectorAll('.bz-blackbox-chip')) as HTMLButtonElement[];
    chips[0].click();
    chips[1].click();
    chips[2].click();
    expect(document.querySelectorAll('.bz-blackbox-chip-on').length).toBe(3);
    expect(document.querySelectorAll('.bz-blackbox-intensity-group').length).toBe(3);
    chips[3].click();
    expect(document.querySelectorAll('.bz-blackbox-chip-on').length).toBe(3);
    expect(hasNotice(/最多选 3 个情绪/)).toBe(true);
  });

  it('强度按钮：点击后高亮，保存时记录', async () => {
    const { app, vault } = setup(new MockVault(), { blackboxReviewThreshold: '999' });
    openBlackBoxCapture(app);
    (document.querySelectorAll('.bz-blackbox-chip')[0] as HTMLButtonElement).click();
    const intensityBtns = Array.from(document.querySelectorAll('.bz-blackbox-intensity-btn')) as HTMLButtonElement[];
    intensityBtns[4].click(); // 强度 5
    openAndFill('那段话', '很触动我');
    (document.getElementById('bz-blackbox-save') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    const saved = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(saved.impressions[0].emotions).toEqual([{ tag: '触动', intensity: 5 }]);
  });

  it('保存校验：素材/感受为空时拒绝并提示', async () => {
    const { app } = setup();
    openBlackBoxCapture(app);
    (document.getElementById('bz-blackbox-save') as HTMLButtonElement).click();
    expect(hasNotice(/素材不能为空/)).toBe(true);
    openAndFill('素材有了', '');
    (document.getElementById('bz-blackbox-save') as HTMLButtonElement).click();
    expect(hasNotice(/感受不能为空/)).toBe(true);
  });

  it('保存成功：落盘 + toast + 关闭弹窗', async () => {
    const { app, vault } = setup(new MockVault(), { blackboxReviewThreshold: '999' });
    openBlackBoxCapture(app);
    openAndFill('别人说的那句话', '因为我想起了外婆');
    (document.getElementById('bz-blackbox-save') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice(/已存入黑匣子/)).toBe(true);
    const saved = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(saved.impressions.length).toBe(1);
    expect(saved.impressions[0].material).toBe('别人说的那句话');
    expect(saved.impressions[0].feeling).toBe('因为我想起了外婆');
    expect(document.getElementById('bz-blackbox-capture-mask')).toBeFalsy(); // 已关闭
  });

  it('阈值命中自动静默复盘：产物写入 reviews + 对话，无复盘 toast', async () => {
    mockOllama('{"text": "我看到了一个细腻的人", "newSelfView": "主人是个细腻的人"}');
    const { app, vault } = setup(new MockVault(), { blackboxReviewThreshold: '1', blackboxAIProvider: 'ollama' });
    openBlackBoxCapture(app);
    openAndFill('素材', '感受');
    (document.getElementById('bz-blackbox-save') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50)); // 等静默复盘完成
    const saved = JSON.parse(vault.files.get(getBlackBoxFilePath())!);
    expect(saved.reviews.length).toBe(1);
    expect(saved.reviews[0].text).toBe('我看到了一个细腻的人');
    expect(saved.persona.selfViews).toEqual([{ ts: saved.reviews[0].ts, view: '主人是个细腻的人' }]);
    expect(saved.chat.some((m: any) => m.role === 'assistant' && m.text.includes('细腻'))).toBe(true);
    expect(hasNotice(/复盘完成/)).toBe(false); // 静默：不弹复盘 toast
  });

  it('AI 辅助追问失败降级：本地文案显示在结果区', async () => {
    (global as any).fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const { app } = setup(new MockVault(), { blackboxAIProvider: 'ollama' });
    openBlackBoxCapture(app);
    openAndFill('素材', '一句话感受');
    const askBtn = Array.from(document.querySelectorAll('.bz-blackbox-ai-btn')).find(
      (b) => b.textContent === '❓ 追问'
    ) as HTMLButtonElement;
    askBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    const result = document.getElementById('bz-blackbox-ai-result')!;
    expect(result.querySelector('.bz-blackbox-ai-fallback')).toBeTruthy();
  });

  it('关闭清理：esc 注册注销，重复开关无残留', () => {
    const { app } = setup();
    openBlackBoxCapture(app);
    closeBlackBoxCapture();
    expect(document.getElementById('bz-blackbox-capture-mask')).toBeFalsy();
    openBlackBoxCapture(app);
    expect(document.getElementById('bz-blackbox-capture-mask')).toBeTruthy();
  });
});

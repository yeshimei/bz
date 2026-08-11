/**
 * 黑匣子三类录入弹窗 UI 测试（ticket 40/41）：三类型切换/概念生成/文献名词表/带出想法/感触外壳/画像选择器/降级。
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

/** mock Ollama 对话（deepseek 走 requestUrl，ollama 走 fetch；测试统一 ollama 模式） */
function mockOllama(content: string) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: { content } }) }));
  (global as any).fetch = fetchMock;
  return fetchMock;
}

/** 预置 v2 数据：1 个既有概念 + 1 个画像 + 自定义词表 */
function seedVault(vault: MockVault, extra?: any): void {
  vault.files.set(
    getBlackBoxFilePath(),
    JSON.stringify({
      version: 2,
      settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖', '想念', '难过'] },
      persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
      entries: [
        { id: 'bb_c1', type: 'concept', createdAt: '2026-08-01T00:00:00.000Z', name: '提喻法', definition: '以部分代整体', related: [], emotions: [], people: [], scene: '', toward: '', links: [] },
      ],
      profiles: [{ id: 'pf_1', name: '妹妹', relation: '家人', impression: '', aiObservations: [], pinnedEvents: [], createdAt: 't' }],
      events: [],
      reviews: [],
      chat: [],
      meta: { lastReviewAt: '', totalEntries: 1, totalEvents: 0 },
      ...extra,
    })
  );
}

/** 读回落盘数据的辅助 */
function loaded(vault: MockVault): any {
  return JSON.parse(vault.files.get(getBlackBoxFilePath())!);
}

describe('黑匣子录入弹窗（三类）', () => {
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

  it('打开：三类型胶囊渲染，默认想法 tab，感触外壳对概念隐藏', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    expect(document.getElementById('bz-blackbox-capture-mask')).toBeTruthy();
    // 头部动作区：💾 保存 + ❌ 关闭（关闭在最后）；底部 footer 已移除
    const hdrBtns = document.querySelectorAll('#bz-blackbox-capture-popup .bz-blackbox-hdr-actions button');
    expect(hdrBtns.length).toBe(2);
    expect(hdrBtns[0].id).toBe('bz-blackbox-save');
    expect(hdrBtns[0].textContent).toBe('💾');
    expect(hdrBtns[1].textContent).toBe('❌');
    expect(document.querySelector('#bz-blackbox-capture-popup .bz-blackbox-modal-footer')).toBeNull();
    const tabs = document.querySelectorAll('.bz-blackbox-type-btn');
    expect(tabs.length).toBe(3);
    expect((tabs[0] as HTMLElement).textContent).toContain('概念');
    expect((tabs[1] as HTMLElement).textContent).toContain('文献');
    expect((tabs[2] as HTMLElement).textContent).toContain('想法');
    expect(document.getElementById('bz-blackbox-tab-thought')!.style.display).toBe('block');
    expect(document.getElementById('bz-blackbox-tab-concept')!.style.display).toBe('none');
    // 情绪词表来自数据 settings.words（自定义词表）
    const chips = document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip');
    expect(chips.length).toBe(4);
  });

  it('类型切换保留已填内容不丢', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    const thought = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
    thought.value = '我昨晚做的梦';
    thought.dispatchEvent(new Event('input'));
    // 切到概念
    (document.querySelector('.bz-blackbox-type-btn[data-type="concept"]') as HTMLElement).click();
    expect(document.getElementById('bz-blackbox-tab-concept')!.style.display).toBe('block');
    expect(document.getElementById('bz-blackbox-tab-thought')!.style.display).toBe('none');
    expect(document.getElementById('bz-blackbox-shell')!.style.display).toBe('none'); // 概念无感触外壳
    // 切回想法
    (document.querySelector('.bz-blackbox-type-btn[data-type="thought"]') as HTMLElement).click();
    const thought2 = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
    expect(thought2.value).toBe('我昨晚做的梦');
  });

  it('概念流程：生成卡片（mock AI）→ 确认录入（无感触外壳）', async () => {
    mockOllama('{"definition": "以部分代整体的修辞", "relatedNames": ["提喻法"]}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    (document.querySelector('.bz-blackbox-type-btn[data-type="concept"]') as HTMLElement).click();
    const name = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    name.value = '借代';
    name.dispatchEvent(new Event('input'));
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-blackbox-concept-def')).toBeTruthy();
    });
    expect(document.getElementById('bz-blackbox-concept-preview')!.textContent).toContain('以部分代整体的修辞');
    expect(document.getElementById('bz-blackbox-concept-preview')!.textContent).toContain('提喻法'); // 关联
    document.getElementById('bz-blackbox-concept-confirm')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-capture-mask')).toBeFalsy();
    });
    const data = loaded(vault);
    const concept = data.entries.find((e: any) => e.type === 'concept' && e.name === '借代');
    expect(concept).toBeTruthy();
    expect(concept.definition).toContain('以部分代整体的修辞');
    expect(concept.related).toEqual(['bb_c1']);
    // 概念无感触外壳
    expect(concept.emotions).toEqual([]);
    expect(concept.people).toEqual([]);
  });

  it('概念流程：AI 失败 → 纯名字仍可保存（永不拒收）', async () => {
    mockOllama('not json');
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    (document.querySelector('.bz-blackbox-type-btn[data-type="concept"]') as HTMLElement).click();
    const name = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    name.value = '熵增';
    name.dispatchEvent(new Event('input'));
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-blackbox-concept-card')).toBeTruthy(); // 纯文本保留
    });
    document.getElementById('bz-blackbox-concept-confirm')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-capture-mask')).toBeFalsy();
    });
    const data = loaded(vault);
    expect(data.entries.some((e: any) => e.type === 'concept' && e.name === '熵增')).toBe(true);
  });

  it('概念流程：直接保存（未生成）→ 允许，definition 空', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    (document.querySelector('.bz-blackbox-type-btn[data-type="concept"]') as HTMLElement).click();
    const name = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    name.value = '空卡片';
    name.dispatchEvent(new Event('input'));
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-capture-mask')).toBeFalsy();
    });
    const data = loaded(vault);
    const c = data.entries.find((e: any) => e.name === '空卡片');
    expect(c.definition).toBe('');
  });

  it('文献流程：分析名词（预勾已有概念 + 新概念）→ 带出想法 → 一次保存三条目', async () => {
    mockOllama('{"matched": ["提喻法"], "newConcepts": ["隐喻"]}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    (document.querySelector('.bz-blackbox-type-btn[data-type="literature"]') as HTMLElement).click();
    const text = document.getElementById('bz-blackbox-lit-text') as HTMLTextAreaElement;
    text.value = '修辞手法在诗歌中随处可见';
    text.dispatchEvent(new Event('input'));
    const source = document.getElementById('bz-blackbox-lit-source') as HTMLInputElement;
    source.value = '《诗学》';
    source.dispatchEvent(new Event('input'));
    document.getElementById('bz-blackbox-lit-analyze')!.click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-blackbox-term-chip').length).toBe(2);
    });
    // 提喻法预勾（✓），隐喻未勾
    const chips = document.querySelectorAll('.bz-blackbox-term-chip');
    expect((chips[0] as HTMLElement).textContent).toContain('提喻法');
    expect((chips[0] as HTMLElement).classList.contains('bz-blackbox-term-chip-on')).toBe(true);
    expect((chips[1] as HTMLElement).textContent).toContain('隐喻');
    expect((chips[1] as HTMLElement).classList.contains('bz-blackbox-term-chip-on')).toBe(false);
    // 勾选新概念
    (chips[1] as HTMLElement).click();
    // 展开带出想法
    const carry = document.getElementById('bz-blackbox-carry') as HTMLDetailsElement;
    carry.open = true;
    carry.dispatchEvent(new Event('toggle'));
    const carryText = document.getElementById('bz-blackbox-carry-text') as HTMLTextAreaElement;
    carryText.value = '这让我想到诗歌的本质';
    carryText.dispatchEvent(new Event('input'));
    // 情绪 + 涉及的人
    (document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip')[0] as HTMLElement).click();
    const peopleInput = document.getElementById('bz-blackbox-people-input') as HTMLInputElement;
    peopleInput.value = '妹妹';
    peopleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-capture-mask')).toBeFalsy();
    });
    const data = loaded(vault);
    const lit = data.entries.find((e: any) => e.type === 'literature');
    expect(lit).toBeTruthy();
    expect(lit.source).toBe('《诗学》');
    expect(lit.terms).toEqual(['bb_c1']);
    expect(lit.people).toEqual(['pf_1']); // 名字匹配已有画像 → id
    expect(lit.emotions).toEqual(['触动']);
    const thought = data.entries.find((e: any) => e.type === 'thought' && e.text.includes('诗歌的本质'));
    expect(thought).toBeTruthy();
    expect(thought.people).toEqual(['pf_1']); // 带出想法共享外壳
    const newConcept = data.entries.find((e: any) => e.type === 'concept' && e.name === '隐喻');
    expect(newConcept).toBeTruthy(); // 勾选的新概念落为概念条目
  });

  it('想法流程：保存 + 情绪 ≤3 校验 + 无画像纯名字', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    const thought = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
    thought.value = '今晚的风很安静';
    thought.dispatchEvent(new Event('input'));
    // 点 4 个情绪：第 4 个被拒
    const chips = document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip');
    for (let i = 0; i < 4; i++) (chips[i] as HTMLElement).click();
    expect(hasNotice('⚠️ 最多选 3 个情绪')).toBe(true);
    expect(document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip-on').length).toBe(3);
    // 纯名字（无匹配画像）
    const peopleInput = document.getElementById('bz-blackbox-people-input') as HTMLInputElement;
    peopleInput.value = '老王';
    peopleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.bz-blackbox-people-tag')!.textContent).toContain('老王');
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-capture-mask')).toBeFalsy();
    });
    const data = loaded(vault);
    const t = data.entries.find((e: any) => e.type === 'thought');
    expect(t.text).toBe('今晚的风很安静');
    expect(t.emotions.length).toBe(3);
    expect(t.people).toEqual(['老王']);
  });

  it('涉及的人：输入匹配已有画像自动补全 → 存画像 id；上限 5', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    const peopleInput = document.getElementById('bz-blackbox-people-input') as HTMLInputElement;
    // 输入「妹」出现补全建议
    peopleInput.value = '妹';
    peopleInput.dispatchEvent(new Event('input'));
    const suggest = document.getElementById('bz-blackbox-people-suggest')!;
    expect(suggest.style.display).toBe('block');
    const items = suggest.querySelectorAll('.bz-blackbox-people-suggest-item');
    expect(items.length).toBe(1);
    expect((items[0] as HTMLElement).textContent).toContain('妹妹');
    // 点击建议 → 画像 id chip
    (items[0] as HTMLElement).click();
    expect(document.querySelector('.bz-blackbox-people-tag')!.textContent).toContain('妹妹');
    // 上限 5
    for (let i = 0; i < 6; i++) {
      peopleInput.value = `路人${i}`;
      peopleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    expect(hasNotice('⚠️ 最多 5 个人')).toBe(true);
    expect(document.querySelectorAll('.bz-blackbox-people-tag').length).toBe(5);
  });

  it('现场新建画像（冷启动双路径）：创建即关联，画像落盘', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    document.getElementById('bz-blackbox-profile-new')!.click();
    const name = document.getElementById('bz-blackbox-profile-form-name') as HTMLInputElement;
    name.value = '前女友';
    document.getElementById('bz-blackbox-profile-form-create')!.click();
    await vi.waitFor(() => {
      expect(hasNotice('✅ 画像「前女友」已创建')).toBe(true);
    });
    // chip 是画像 id（pf_ 前缀）
    const chip = document.querySelector('.bz-blackbox-people-tag')!;
    expect(chip.textContent).toContain('前女友');
    const data = loaded(vault);
    expect(data.profiles.some((p: any) => p.name === '前女友')).toBe(true);
  });

  it('想法 AI 辅助：⚡ 联想（mock AI）→ 可加入想法', async () => {
    mockOllama('这让我想起 7 月——茉莉花的香气');
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    const thought = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
    thought.value = '茉莉花';
    thought.dispatchEvent(new Event('input'));
    // 联想按钮（⚡）
    const recallBtn = Array.from(document.querySelectorAll('.bz-blackbox-ai-btn')).find((b) => b.textContent?.includes('联想'));
    (recallBtn as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-blackbox-ai-append')).toBeTruthy();
    });
    const append = document.querySelector('.bz-blackbox-ai-append') as HTMLButtonElement;
    append.click();
    expect(thought.value).toContain('这让我想起 7 月');
  });

  it('关闭重开不残留上次录入内容（状态泄漏回归）', async () => {
    const vault = new MockVault();
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    const thought = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
    thought.value = '这是一条旧的思考';
    thought.dispatchEvent(new Event('input'));
    closeBlackBoxCapture();
    await openBlackBoxCapture(app);
    const fresh = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
    expect(fresh.value).toBe(''); // 不残留
    expect(document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip-on').length).toBe(0);
  });

  it('保存后阈值命中触发自动复盘（产物写入对话流）', async () => {
    mockOllama('{"text": "我看到一个细腻的人", "newSelfView": "我懂主人了"}');
    const vault = new MockVault();
    // 已有 2 条 → 全局阈值 3 → 本次录入后命中
    seedVault(vault, {
      entries: [
        { id: 'bb_c1', type: 'concept', createdAt: 't', name: '提喻法', definition: 'x', related: [], emotions: [], people: [], scene: '', toward: '', links: [] },
        { id: 'bb_t1', type: 'thought', createdAt: 't2', text: '旧想法', emotions: [], people: [], scene: '', toward: '', links: [] },
      ],
    });
    const { app } = setup(vault, { blackboxAIProvider: 'ollama', blackboxReviewThreshold: '3' });
    await openBlackBoxCapture(app);
    const thought = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
    thought.value = '第三条';
    thought.dispatchEvent(new Event('input'));
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).reviews.length).toBe(1);
    });
    const data = loaded(vault);
    expect(data.reviews[0].text).toContain('细腻');
    expect(data.persona.selfViews.length).toBe(1);
    expect(data.chat.some((m: any) => m.role === 'assistant')).toBe(true);
  });
});

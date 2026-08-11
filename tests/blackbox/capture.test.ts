/**
 * 黑匣子录入弹窗（引导式 v3）UI 测试：① 类型选择三卡片（无 header/保存/关闭）→
 * ② 内容输入（概念 生成卡片→确认录入→连接展示 / 文献 分析名词→感触 / 想法 联想追问→感触）→
 * ③ 感触（情绪/涉及的人/场景，无指向/链接）→ 存入；AI 失败降级永不拒收；保存回类型选择可连续录入。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, getNoticeMessages } from '../mock-obsidian-entry';
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

/** mock Ollama 失败（永不拒收降级路径） */
function mockOllamaFail() {
  const fetchMock = vi.fn(async () => {
    throw new Error('network down');
  });
  (global as any).fetch = fetchMock;
  return fetchMock;
}

/** 预置 v2 数据：2 个既有概念 + 1 个画像 + 自定义词表 */
function seedVault(vault: MockVault, extra?: any): void {
  vault.files.set(
    getBlackBoxFilePath(),
    JSON.stringify({
      version: 2,
      settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖', '想念', '难过'] },
      persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
      entries: [
        { id: 'bb_c1', type: 'concept', createdAt: '2026-08-01T00:00:00.000Z', name: '提喻法', definition: '以部分代整体', related: [], emotions: [], people: [], scene: '', toward: '', links: [] },
        { id: 'bb_c2', type: 'concept', createdAt: '2026-08-02T00:00:00.000Z', name: '借代', definition: '用相关事物代替本体', related: [], emotions: [], people: [], scene: '', toward: '', links: [] },
      ],
      profiles: [{ id: 'pf_1', name: '妹妹', relation: '家人', impression: '', aiObservations: [], pinnedEvents: [], createdAt: 't' }],
      events: [],
      reviews: [],
      chat: [],
      meta: { lastReviewAt: '', totalEntries: 2, totalEvents: 0 },
      ...extra,
    })
  );
}

/** 读回落盘数据的辅助 */
function loaded(vault: MockVault): any {
  return JSON.parse(vault.files.get(getBlackBoxFilePath())!);
}

/** 点击类型卡片进入内容步 */
function selectType(type: string): void {
  const card = document.querySelector(`.bz-blackbox-guide-card[data-ct="${type}"]`) as HTMLElement;
  expect(card).toBeTruthy();
  card.click();
}

function setValue(id: string, v: string): void {
  const el = document.getElementById(id) as HTMLInputElement;
  el.value = v;
  el.dispatchEvent(new Event('input'));
}

describe('黑匣子录入弹窗（引导式）', () => {
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

  // ---------------- ① 类型选择 ----------------

  it('打开：类型选择页三张卡片；无 header/胶囊/保存/关闭按钮', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    expect(document.getElementById('bz-blackbox-capture-mask')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-step-type')!.style.display).toBe('block');
    const cards = document.querySelectorAll('.bz-blackbox-guide-card');
    expect(cards.length).toBe(3);
    expect((cards[0] as HTMLElement).textContent).toContain('概念');
    expect((cards[1] as HTMLElement).textContent).toContain('文献');
    expect((cards[2] as HTMLElement).textContent).toContain('想法');
    // 无标题（去「这次想记录什么」）/ 卡片无描述
    expect(document.querySelector('.bz-blackbox-guide-page-title')).toBeNull();
    expect(document.querySelector('.bz-blackbox-guide-card-desc')).toBeNull();
    // 无 header / 胶囊 / 保存 / 关闭
    expect(document.querySelector('#bz-blackbox-capture-popup .bz-blackbox-modal-header')).toBeNull();
    expect(document.querySelector('.bz-blackbox-type-tabs')).toBeNull();
    expect(document.getElementById('bz-blackbox-save')).toBeNull();
    expect(document.querySelector('#bz-blackbox-capture-popup .bz-blackbox-hdr-close')).toBeNull();
    // 内容/感触/连接步隐藏
    expect(document.getElementById('bz-blackbox-step-content')!.style.display).toBe('none');
    expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('none');
    expect(document.getElementById('bz-blackbox-step-conn')!.style.display).toBe('none');
  });

  // ---------------- 🧩 概念 ----------------

  it('概念：选类型 → 一个输入框 + 生成按钮；无头部/无 label（引导在 placeholder）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('concept');
    expect(document.getElementById('bz-blackbox-step-content')!.style.display).toBe('block');
    expect(document.getElementById('bz-blackbox-concept-name')).toBeTruthy(); // 一个输入框
    expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✨ 生成卡片');
    // 无头部标题 / 无返回按钮 / 无 label
    expect(document.querySelector('#bz-blackbox-step-content .bz-blackbox-guide-head')).toBeNull();
    expect(document.querySelector('.bz-blackbox-guide-back')).toBeNull();
    expect(document.querySelector('#bz-blackbox-step-content .bz-blackbox-field-label')).toBeNull();
    expect((document.getElementById('bz-blackbox-concept-name') as HTMLTextAreaElement).placeholder).toContain('提喻法');
    // 只有一个输入框（无其他字段）
    expect(document.querySelectorAll('#bz-blackbox-step-content textarea').length).toBe(1);
  });

  it('概念：生成卡片 → 百科定义填入输入框可编辑，按钮变「确认录入」', async () => {
    mockOllama('{"definition": "以部分代整体的修辞手法，语言含蓄而有力。", "relatedNames": ["提喻法"]}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('concept');
    setValue('bz-blackbox-concept-name', '隐喻');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect((document.getElementById('bz-blackbox-concept-name') as HTMLTextAreaElement).value).toContain('修辞手法');
    });
    expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✅ 确认录入');
    // 生成内容可编辑（编辑后保存生效）
    const input = document.getElementById('bz-blackbox-concept-name') as HTMLTextAreaElement;
    input.value = '以部分代整体的修辞手法，语言含蓄而有力。（补充：源自法语 métonymie）';
    input.dispatchEvent(new Event('input'));
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).entries.some((e: any) => e.type === 'concept' && e.name === '隐喻')).toBe(true);
    });
    const c = loaded(vault).entries.find((e: any) => e.type === 'concept' && e.name === '隐喻');
    expect(c.definition).toContain('métonymie');
    expect(c.related).toEqual(['bb_c1']); // 关联既有概念「提喻法」
    // 动态双向关联：既有概念「提喻法」反向关联新卡「隐喻」
    const old = loaded(vault).entries.find((e: any) => e.id === 'bb_c1');
    expect(old.related).toContain(c.id);
    expect(old.related.length).toBe(1); // 无重复
  });

  it('概念：确认录入后显示连接页（与其他概念的连接），✓ 完成回类型选择', async () => {
    mockOllama('{"definition": "以部分代整体的修辞手法。", "relatedNames": ["提喻法"]}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('concept');
    setValue('bz-blackbox-concept-name', '隐喻');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect((document.getElementById('bz-blackbox-concept-name') as HTMLTextAreaElement).value).toContain('修辞');
    });
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-step-conn')!.style.display).toBe('block');
    });
    expect(document.getElementById('bz-blackbox-step-conn')!.textContent).toContain('已录入「隐喻」');
    expect(document.getElementById('bz-blackbox-step-conn')!.textContent).toContain('与 1 个概念建立了连接');
    expect(document.getElementById('bz-blackbox-step-conn')!.textContent).toContain('提喻法');
    // ✓ 完成 → 回类型选择（连续录入）
    document.getElementById('bz-blackbox-guide-done')!.click();
    expect(document.getElementById('bz-blackbox-step-type')!.style.display).toBe('block');
    expect(document.getElementById('bz-blackbox-step-content')!.style.display).toBe('none');
  });

  it('概念：生成卡片 AI 失败 → 降级为确认录入（永不拒收）', async () => {
    mockOllamaFail();
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('concept');
    setValue('bz-blackbox-concept-name', '隐喻');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✅ 确认录入');
    });
    expect(hasNotice(/生成失败/)).toBe(true);
    // 输入框保留名词，可直接确认保存
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).entries.some((e: any) => e.type === 'concept' && e.name === '隐喻')).toBe(true);
    });
    expect(loaded(vault).entries.find((e: any) => e.name === '隐喻').definition).toBe('隐喻');
  });

  it('概念：名词为空点生成 → 提示不调用 AI', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('concept');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    expect(hasNotice('⚠️ 先输入名词')).toBe(true);
    expect((global as any).fetch).toBeUndefined();
  });

  // ---------------- 📎 文献 ----------------

  it('文献：摘抄+来源 → 分析名词 → 感触页（名词表/提炼想法/情绪/人/场景）', async () => {
    mockOllama('{"matched": ["提喻法"], "newConcepts": ["修辞"], "insight": "修辞让有限语言装下无限情意。"}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('literature');
    expect(document.getElementById('bz-blackbox-lit-text')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-lit-source')).toBeTruthy();
    setValue('bz-blackbox-lit-text', '提喻法是常见的修辞手法。');
    setValue('bz-blackbox-lit-source', '《诗学》');
    document.getElementById("bz-blackbox-lit-analyze")!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    // 名词表：既有概念「提喻法」预勾，新概念「修辞」未勾
    const chips = document.querySelectorAll('#bz-blackbox-step-feel .bz-blackbox-term-chip');
    expect(chips.length).toBe(2);
    expect((chips[0] as HTMLElement).textContent).toContain('提喻法');
    expect((chips[0] as HTMLElement).classList.contains('bz-blackbox-term-chip-on')).toBe(true);
    expect((chips[1] as HTMLElement).textContent).toContain('修辞');
    // 提炼想法有 AI 内容
    expect((document.getElementById('bz-blackbox-insight') as HTMLTextAreaElement).value).toContain('情意');
    // 情绪/人/场景区都在
    expect(document.getElementById('bz-blackbox-emotions')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-people-row')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-scene')).toBeTruthy();
    // 无指向/链接
    expect(document.getElementById('bz-blackbox-links')).toBeNull();
    expect(document.querySelector('.bz-blackbox-dir-row')).toBeNull();
  });

  it('文献：存入 → literature 条目 + 提炼想法 thought 条目 + 勾选新概念条目；toward/links 为空', async () => {
    mockOllama('{"matched": ["提喻法"], "newConcepts": ["修辞"], "insight": "修辞让有限语言装下无限情意。"}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('literature');
    setValue('bz-blackbox-lit-text', '提喻法是常见的修辞手法。');
    setValue('bz-blackbox-lit-source', '《诗学》');
    document.getElementById("bz-blackbox-lit-analyze")!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    // 勾选新概念「修辞」+ 选情绪/人/场景
    const chips = document.querySelectorAll('#bz-blackbox-step-feel .bz-blackbox-term-chip');
    (chips[1] as HTMLElement).click();
    setValue('bz-blackbox-scene', '深夜读书');
    // 情绪
    const emo = document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip');
    (emo[0] as HTMLElement).click();
    // 涉及的人：纯名字
    const peopleInput = document.getElementById('bz-blackbox-people-input') as HTMLInputElement;
    peopleInput.value = '老王';
    peopleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).entries.length).toBe(5); // 2 既有 + 文献 + 想法 + 新概念
    });
    const lit = loaded(vault).entries.find((e: any) => e.type === 'literature');
    expect(lit.text).toContain('提喻法');
    expect(lit.source).toBe('《诗学》');
    expect(lit.terms).toEqual(['bb_c1', '修辞'].length ? ['bb_c1'] : []);
    expect(lit.emotions).toEqual(['触动']);
    expect(lit.people).toEqual(['老王']);
    expect(lit.scene).toBe('深夜读书');
    expect(lit.toward).toBe(''); // 指向字段不再 UI 录入
    expect(lit.links).toEqual([]); // 链接字段不再 UI 录入
    const thought = loaded(vault).entries.find((e: any) => e.type === 'thought');
    expect(thought.text).toContain('情意');
    const concept = loaded(vault).entries.find((e: any) => e.type === 'concept' && e.name === '修辞');
    expect(concept).toBeTruthy();
  });

  it("文献：分析 AI 失败 → 提示 + 仍进感触页 + 纯文本可保存（永不拒收）", async () => {
    mockOllamaFail();
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('literature');
    setValue('bz-blackbox-lit-text', '只是一段摘抄。');
    document.getElementById("bz-blackbox-lit-analyze")!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    expect(hasNotice(/分析失败/)).toBe(true);
    // 无名词表无提炼，但可保存
    expect(document.querySelectorAll('#bz-blackbox-step-feel .bz-blackbox-term-chip').length).toBe(0);
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).entries.some((e: any) => e.type === 'literature')).toBe(true);
    });
  });

  it('文献：摘抄为空点分析 → 提示', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('literature');
    document.getElementById("bz-blackbox-lit-analyze")!.click();
    expect(hasNotice('⚠️ 先粘贴摘抄内容')).toBe(true);
  });

  // ---------------- 💡 想法 ----------------

  it('想法：联想/追问按钮存在、无查概念；确认 → 感触页', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('thought');
    const aiRow = document.querySelector('#bz-blackbox-step-content .bz-blackbox-ai-row')!;
    expect(aiRow.textContent).toContain('⚡ 联想');
    expect(aiRow.textContent).toContain('❓ 追问');
    expect(aiRow.textContent).not.toContain('查概念');
    setValue('bz-blackbox-thought-text', '今晚的风很安静');
    document.getElementById('bz-blackbox-thought-confirm')!.click();
    expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    expect(document.getElementById('bz-blackbox-emotions')).toBeTruthy();
  });

  it('想法：联想（mock AI）→ 结果可加入想法', async () => {
    mockOllama('这让我想起 8 月 1 日——那天你也说风很静');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('thought');
    setValue('bz-blackbox-thought-text', '今晚的风很安静');
    const recall = Array.from(document.querySelectorAll('#bz-blackbox-step-content .bz-blackbox-ai-row button')).find(
      (b) => b.textContent === '⚡ 联想'
    ) as HTMLElement;
    recall.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-ai-result')!.textContent).toContain('风很静');
    });
    (document.querySelector('#bz-blackbox-ai-result .bz-blackbox-ai-append') as HTMLElement).click();
    expect((document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement).value).toContain('风很静');
  });

  it('想法：确认 → 感触（情绪≤3/人/场景）→ 保存 thought 条目', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('thought');
    setValue('bz-blackbox-thought-text', '今晚的风很安静');
    document.getElementById('bz-blackbox-thought-confirm')!.click();
    // 情绪选 4 个 → 第 4 个被拒
    for (let i = 0; i < 4; i++) {
      const emo = document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip');
      const firstOff = Array.from(emo).find((c) => !c.classList.contains('bz-blackbox-chip-on')) as HTMLElement;
      firstOff.click();
    }
    expect(getNoticeMessages()).toContain('⚠️ 最多选 3 个情绪');
    expect(document.querySelectorAll('#bz-blackbox-emotions .bz-blackbox-chip-on').length).toBe(3);
    // 场景 + 涉及的人（匹配画像 → 存 id）
    setValue('bz-blackbox-scene', '窗台');
    const peopleInput = document.getElementById('bz-blackbox-people-input') as HTMLInputElement;
    peopleInput.value = '妹妹';
    peopleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(loaded(vault).entries.some((e: any) => e.type === 'thought' && e.text === '今晚的风很安静')).toBe(true);
    });
    const t = loaded(vault).entries.find((e: any) => e.type === 'thought');
    expect(t.emotions.length).toBe(3);
    expect(t.people).toEqual(['pf_1']);
    expect(t.scene).toBe('窗台');
    expect(t.toward).toBe('');
    expect(t.links).toEqual([]);
  });

  it('想法：空内容点确认 → 提示不进感触页', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('thought');
    document.getElementById('bz-blackbox-thought-confirm')!.click();
    expect(hasNotice('⚠️ 先写下想法')).toBe(true);
    expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('none');
  });

  // ---------------- 导航与收尾 ----------------

  it('保存后回类型选择可连续录入；重开不残留（无返回按钮，换类型=关闭重开）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCapture(app);
    selectType('thought');
    expect(document.querySelector('.bz-blackbox-guide-back')).toBeNull(); // 无返回按钮
    // 走完整流程保存 → 回类型选择
    setValue('bz-blackbox-thought-text', '第二条');
    document.getElementById('bz-blackbox-thought-confirm')!.click();
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(() => {
      expect(document.getElementById('bz-blackbox-step-type')!.style.display).toBe('block');
    });
    expect(loaded(vault).entries.some((e: any) => e.text === '第二条')).toBe(true);
    // 关闭重开：无残留
    closeBlackBoxCapture();
    await openBlackBoxCapture(app);
    selectType('thought');
    expect((document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement).value).toBe('');
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
      meta: { lastReviewAt: '', totalEntries: 2, totalEvents: 0 },
    });
    const { app } = setup(vault, { blackboxAIProvider: 'ollama', blackboxReviewThreshold: '3' });
    await openBlackBoxCapture(app);
    selectType('thought');
    setValue('bz-blackbox-thought-text', '第三条');
    document.getElementById('bz-blackbox-thought-confirm')!.click();
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

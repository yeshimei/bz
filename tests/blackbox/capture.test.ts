/**
 * 黑匣子录入弹窗（引导式 v3）UI 测试：① 类型选择三卡片（无 header/保存/关闭）→
 * ② 内容输入（概念 生成卡片→确认录入→连接展示 / 文献 分析名词→感触 / 想法 联想追问→感触）→
 * ③ 感触（情绪/涉及的人/场景，无指向/链接）→ 存入；AI 失败降级永不拒收；保存回类型选择可连续录入。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { seedV3 } from './v3-seed';
import { resetObsidianMocks, hasNotice, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxCapture, openBlackBoxCaptureConcept, openBlackBoxCaptureLiterature, openBlackBoxCaptureThought, closeBlackBoxCapture, unloadBlackBox } from '../../src/blackbox';
import { BlackBoxDataManager, getBlackBoxFilePath } from '../../src/blackbox/data';

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
  seedV3(vault, {
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
  });
}

/** 读回落盘数据的辅助（v3：经 manager load 由笔记水合） */
async function loaded(app: any, vault: MockVault): Promise<any> {
  return new BlackBoxDataManager(app).load();
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
    expect((document.getElementById('bz-blackbox-concept-name') as HTMLInputElement).placeholder).toContain('提喻法');
    // 双输入（ticket 02）：概念名单行 + 定义 textarea ≤8 行；无其他字段
    expect(document.getElementById('bz-blackbox-concept-def')).toBeTruthy();
    expect(document.querySelectorAll('#bz-blackbox-step-content textarea').length).toBe(1);
    expect((document.getElementById('bz-blackbox-concept-name') as HTMLInputElement).type).toBe('text');
    // 按钮按文本内容判定：文本空 → 生成卡片
    expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✨ 生成卡片');
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
    await vi.waitFor(async () => {
      expect((document.getElementById('bz-blackbox-concept-def') as HTMLTextAreaElement).value).toContain('修辞手法');
    });
    expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✅ 确定录入');
    // 生成内容可编辑（编辑后保存生效）
    const input = document.getElementById('bz-blackbox-concept-def') as HTMLTextAreaElement;
    input.value = '以部分代整体的修辞手法，语言含蓄而有力。（补充：源自法语 métonymie）';
    input.dispatchEvent(new Event('input'));
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'concept' && e.name === '隐喻')).toBe(true);
    });
    const c = (await loaded(app, vault)).entries.find((e: any) => e.type === 'concept' && e.name === '隐喻');
    expect(c.definition).toContain('métonymie');
    expect(c.related).toEqual(['bb_c1']); // 关联既有概念「提喻法」
    // 动态双向关联：既有概念「提喻法」反向关联新卡「隐喻」
    const old = (await loaded(app, vault)).entries.find((e: any) => e.id === 'bb_c1');
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
    await vi.waitFor(async () => {
      expect((document.getElementById('bz-blackbox-concept-def') as HTMLTextAreaElement).value).toContain('修辞');
    });
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(async () => {
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
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✅ 确定录入');
    });
    expect(hasNotice(/生成失败/)).toBe(true);
    // 定义降级为原名词（可编辑），可直接确定保存
    expect((document.getElementById('bz-blackbox-concept-def') as HTMLTextAreaElement).value).toBe('隐喻');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'concept' && e.name === '隐喻')).toBe(true);
    });
    expect((await loaded(app, vault)).entries.find((e: any) => e.name === '隐喻').definition).toBe('隐喻');
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
    await vi.waitFor(async () => {
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
    await vi.waitFor(async () => {
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
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.length).toBe(5); // 2 既有 + 文献 + 想法 + 新概念
    });
    const lit = (await loaded(app, vault)).entries.find((e: any) => e.type === 'literature');
    expect(lit.text).toContain('提喻法');
    expect(lit.source).toBe('《诗学》');
    expect(lit.terms).toEqual(['bb_c1', '修辞'].length ? ['bb_c1'] : []);
    expect(lit.emotions).toEqual(['触动']);
    expect(lit.people).toEqual(['老王']);
    expect(lit.scene).toBe('深夜读书');
    expect(lit.toward).toBe(''); // 指向字段不再 UI 录入
    expect(lit.links).toEqual([]); // 链接字段不再 UI 录入
    const thought = (await loaded(app, vault)).entries.find((e: any) => e.type === 'thought');
    expect(thought.text).toContain('情意');
    const concept = (await loaded(app, vault)).entries.find((e: any) => e.type === 'concept' && e.name === '修辞');
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
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    expect(hasNotice(/分析失败/)).toBe(true);
    // 无名词表无提炼，但可保存
    expect(document.querySelectorAll('#bz-blackbox-step-feel .bz-blackbox-term-chip').length).toBe(0);
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'literature')).toBe(true);
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
    await vi.waitFor(async () => {
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
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'thought' && e.text === '今晚的风很安静')).toBe(true);
    });
    const t = (await loaded(app, vault)).entries.find((e: any) => e.type === 'thought');
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
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-step-type')!.style.display).toBe('block');
    });
    expect((await loaded(app, vault)).entries.some((e: any) => e.text === '第二条')).toBe(true);
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
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).reviews.length).toBe(1);
    });
    const data = await loaded(app, vault);
    expect(data.reviews[0].text).toContain('细腻');
    expect(data.persona.selfViews.length).toBe(1);
    expect(data.chat.some((m: any) => m.role === 'assistant')).toBe(true);
  });
});

describe('概念直达命令（ticket 02：bz-blackbox-capture-concept）', () => {
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

  /** 给 mock app 挂上活动编辑器选区 */
  function withSelection(app: any, text: string, filePath = '笔记/来源.md'): void {
    app.workspace.activeEditor = {
      editor: {
        getSelection: () => text,
        getCursor: (which: string) => (which === 'from' ? { line: 2, ch: 0 } : { line: 2, ch: text.length }),
      },
      file: { path: filePath },
    };
  }

  it('直达命令：跳过类型选择直达概念页（双输入），保存后弹窗直接关闭', async () => {
    mockOllama('{"definition": "以部分代整体的修辞手法。", "relatedNames": []}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureConcept(app);
    // 直达：内容步直接显示，类型选择步隐藏
    expect(document.getElementById('bz-blackbox-step-content')!.style.display).toBe('block');
    expect(document.getElementById('bz-blackbox-step-type')!.style.display).toBe('none');
    expect(document.getElementById('bz-blackbox-concept-name')).toBeTruthy();
    expect(document.getElementById('bz-blackbox-concept-def')).toBeTruthy();
    // 生成卡片（AI 填定义）→ 确定录入 → 保存后直接关闭
    setValue('bz-blackbox-concept-name', '隐喻');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(async () => {
      expect((document.getElementById('bz-blackbox-concept-def') as HTMLTextAreaElement).value).toContain('修辞手法');
    });
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'concept' && e.name === '隐喻')).toBe(true);
    });
    expect(document.getElementById('bz-blackbox-capture-popup')).toBeNull(); // 保存即关
  });

  it('直达命令：选中文字自动填充概念名并锁定只读；保存写概念笔记', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    withSelection(app, '提喻法');
    await openBlackBoxCaptureConcept(app);
    const nameInput = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    expect(nameInput.value).toBe('提喻法'); // 自动填充
    expect(nameInput.readOnly).toBe(true); // 锁定只读
    expect(nameInput.className).toContain('bz-blackbox-locked');
    // 锁定态输入事件不生效（状态不被篡改；readonly 防用户输入）
    nameInput.value = '篡改';
    nameInput.dispatchEvent(new Event('input'));
    // 手动填定义 → 确定录入保存
    setValue('bz-blackbox-concept-def', '以部分代整体');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'concept' && e.name === '提喻法')).toBe(true);
    });
    expect((await loaded(app, vault)).entries.find((e: any) => e.name === '提喻法').definition).toBe('以部分代整体');
    expect(document.getElementById('bz-blackbox-capture-popup')).toBeNull();
    // 概念笔记落盘
    const notes = [...vault.files.keys()].filter((p) => p.startsWith('黑匣子/概念/'));
    expect(notes).toContain('黑匣子/概念/提喻法.md');
  });

  it('无选区：概念名可手动输入；文本有内容 → 按钮「确定录入」直接保存（不调 AI）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureConcept(app);
    const nameInput = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    expect(nameInput.readOnly).toBe(false);
    setValue('bz-blackbox-concept-name', '修辞');
    // 文本输入框有内容 → 「确定录入」（无重新生成入口）
    setValue('bz-blackbox-concept-def', '让表达更生动的技巧');
    expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✅ 确定录入');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'concept' && e.name === '修辞')).toBe(true);
    });
    expect((global as any).fetch).toBeUndefined(); // 手动录入不调 AI
    expect((await loaded(app, vault)).entries.find((e: any) => e.name === '修辞').definition).toBe('让表达更生动的技巧');
  });

  it('文本有内容后清空 → 按钮回「生成卡片」（内容判定）', async () => {
    mockOllama('{"definition": "x。", "relatedNames": []}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureConcept(app);
    setValue('bz-blackbox-concept-name', '隐喻');
    setValue('bz-blackbox-concept-def', '有内容');
    expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✅ 确定录入');
    setValue('bz-blackbox-concept-def', '   ');
    expect(document.getElementById('bz-blackbox-concept-gen')!.textContent).toBe('✨ 生成卡片');
  });
});

describe('摘抄/想法直达命令（ticket 03：标题 AI 生成 + 提炼想法 + 保存即关）', () => {
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

  function withSelection(app: any, text: string, filePath = '笔记/文学课.md'): void {
    app.workspace.activeEditor = {
      editor: {
        getSelection: () => text,
        getCursor: (which: string) => (which === 'from' ? { line: 1, ch: 0 } : { line: 1, ch: text.length }),
      },
      file: { path: filePath },
    };
  }

  it('摘抄直达：选区自动填充（文本锁定 + 来源=来源笔记）→ 分析名词（标题建议）→ 保存即关 + 笔记落盘', async () => {
    mockOllama('{"title": "修辞的弹性", "matched": ["提喻法"], "newConcepts": [], "insight": ""}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    withSelection(app, '修辞是语言的弹性，让有限词句装下无限情意。');
    await openBlackBoxCaptureLiterature(app);
    // 直达内容步 + 选区填充锁定
    expect(document.getElementById('bz-blackbox-step-type')!.style.display).toBe('none');
    const textEl = document.getElementById('bz-blackbox-lit-text') as HTMLTextAreaElement;
    expect(textEl.value).toBe('修辞是语言的弹性，让有限词句装下无限情意。');
    expect(textEl.readOnly).toBe(true);
    expect((document.getElementById('bz-blackbox-lit-source') as HTMLInputElement).value).toBe('[[文学课]]');
    // 分析名词（标题建议存下）
    document.getElementById('bz-blackbox-lit-analyze')!.click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    // 保存（感触步空提交）
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'literature')).toBe(true);
    });
    expect(document.getElementById('bz-blackbox-capture-popup')).toBeNull(); // 保存即关
    // 笔记落盘：标题 = 分析标题建议
    expect(vault.files.has('黑匣子/摘抄/修辞的弹性.md')).toBe(true);
    const note = vault.files.get('黑匣子/摘抄/修辞的弹性.md')!;
    expect(note).toContain('来源：[[文学课]]');
    expect(note).toContain('关联概念：[[提喻法]]');
    // 水合：source + terms 解析回内存
    const d = await loaded(app, vault);
    const lit = d.entries.find((e: any) => e.type === 'literature')!;
    expect(lit.source).toBe('[[文学课]]');
    expect(lit.terms).toEqual(['bb_c1']);
  });

  it('摘抄保存：未分析时 AI 生成标题（保存时），AI 失败降级正文前 20 字', async () => {
    // 无分析直接保存：AI 标题调用返回标题文本
    mockOllama('修辞的弹性');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureLiterature(app);
    setValue('bz-blackbox-lit-text', '修辞是语言的弹性，让有限词句装下无限情意。');
    setValue('bz-blackbox-lit-source', '《诗学》');
    document.getElementById('bz-blackbox-lit-analyze')!.click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'literature')).toBe(true);
    });
    expect(vault.files.has('黑匣子/摘抄/修辞的弹性.md')).toBe(true); // AI 标题
  });

  it('摘抄保存：AI 标题失败 → 降级正文前 20 字（永不拒收）', async () => {
    mockOllamaFail();
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureLiterature(app);
    setValue('bz-blackbox-lit-text', '修辞是语言的弹性，让有限词句装下无限情意。');
    document.getElementById('bz-blackbox-lit-analyze')!.click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'literature')).toBe(true);
    });
    // 标题 = 正文前 20 字（去空白）
    const title = '修辞是语言的弹性，让有限词句装下无限情意。'.slice(0, 20);
    expect(vault.files.has(`黑匣子/摘抄/${title}.md`)).toBe(true);
  });

  it('提炼想法 → 独立想法笔记 + 摘抄笔记底部「来自：[[摘抄]]」双链', async () => {
    mockOllama('{"title": "修辞的弹性", "matched": ["提喻法"], "newConcepts": [], "insight": "语言有弹性，人就有了被理解的余地。"}');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureLiterature(app);
    setValue('bz-blackbox-lit-text', '修辞是语言的弹性，让有限词句装下无限情意。');
    document.getElementById('bz-blackbox-lit-analyze')!.click();
    await vi.waitFor(async () => {
      expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    });
    // 想法内容自动填入提炼想法框（分析 insight），直接保存
    const insight = document.getElementById('bz-blackbox-insight') as HTMLTextAreaElement;
    expect(insight.value).toContain('语言有弹性');
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(async () => {
      const d = await loaded(app, vault);
      expect(d.entries.filter((e: any) => e.type === 'thought').length).toBe(1);
    });
    // 想法笔记落盘：底部「来自：[[修辞的弹性]]」
    const thoughtNotes = [...vault.files.keys()].filter((p) => p.startsWith('黑匣子/想法/'));
    expect(thoughtNotes.length).toBe(1);
    const thoughtNote = vault.files.get(thoughtNotes[0])!;
    expect(thoughtNote).toContain('来自：[[修辞的弹性]]');
    // 水合：想法 from 解析为摘抄 id
    const d = await loaded(app, vault);
    const thought = d.entries.find((e: any) => e.type === 'thought')!;
    const lit = d.entries.find((e: any) => e.type === 'literature')!;
    expect(thought.from).toBe(lit.id);
  });

  it('想法直达：文本 + 保存即关；AI 生成标题失败降级', async () => {
    mockOllamaFail();
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureThought(app);
    expect(document.getElementById('bz-blackbox-step-type')!.style.display).toBe('none');
    setValue('bz-blackbox-thought-text', '给妹妹买吉他，她笑了很久。');
    document.getElementById('bz-blackbox-thought-confirm')!.click();
    expect(document.getElementById('bz-blackbox-step-feel')!.style.display).toBe('block');
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'thought')).toBe(true);
    });
    expect(document.getElementById('bz-blackbox-capture-popup')).toBeNull(); // 保存即关
    const title = '给妹妹买吉他，她笑了很久。'.slice(0, 20);
    expect(vault.files.has(`黑匣子/想法/${title}.md`)).toBe(true); // AI 失败降级前 20 字
  });

  it('想法直达：AI 生成标题成功 → 文件名 = AI 标题', async () => {
    mockOllama('夏夜的吉他声');
    const vault = new MockVault();
    seedVault(vault);
    const { app } = setup(vault, { blackboxAIProvider: 'ollama' });
    await openBlackBoxCaptureThought(app);
    setValue('bz-blackbox-thought-text', '给妹妹买吉他，她笑了很久。');
    document.getElementById('bz-blackbox-thought-confirm')!.click();
    document.getElementById('bz-blackbox-save')!.click();
    await vi.waitFor(async () => {
      expect((await loaded(app, vault)).entries.some((e: any) => e.type === 'thought')).toBe(true);
    });
    expect(vault.files.has('黑匣子/想法/夏夜的吉他声.md')).toBe(true);
  });
});

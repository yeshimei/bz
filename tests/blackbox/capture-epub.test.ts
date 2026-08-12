/**
 * 书内选区录入测试（ticket 07 / ADR-0016）：外部选区 {selectedText, sourceLink} 直达概念/摘抄——
 * 文本锁定填充、概念来源=links 单值、摘抄来源=sourceLink、保存后笔记含 `来源：` 行；
 * externalSel 模式跳过原位注入（epub 不可写）；无外部参数行为与现状一致。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { seedV3 } from './v3-seed';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openBlackBoxCaptureFromEpub, closeBlackBoxCapture, unloadBlackBox } from '../../src/blackbox';
import { BlackBoxDataManager } from '../../src/blackbox/data';

const EPUB_LINK = '[[书架/三体.epub#weave-cfi=epubcfi(/6/14!/4/2/2/1:0)|三体]]';

function setup(vault: MockVault = new MockVault(), settings: any = {}) {
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  seedV3(vault, {
    settings: { reviewThreshold: 10, showSpeculativeEvents: true, words: ['触动', '温暖'] },
    persona: { name: '包仔', seed: '种子', toneExample: '语气', selfViews: [] },
    entries: [],
    profiles: [],
    events: [],
    reviews: [],
    chat: [],
    meta: { lastReviewAt: '', totalEntries: 0, totalEvents: 0 },
  });
  return { app, vault };
}

/** mock Ollama：autoClassify 等异步 AI 调用失败静默（永不拒收） */
function mockOllamaFail() {
  const fetchMock = vi.fn(async () => {
    throw new Error('network down');
  });
  (global as any).fetch = fetchMock;
  return fetchMock;
}

/** 编辑器选区（getSelectionSnapshot 读取路径；filePath 默认笔记路径） */
function withEditorSelection(app: any, text: string, filePath = '笔记/来源.md'): void {
  app.workspace.activeEditor = {
    editor: {
      getSelection: () => text,
      getCursor: (which: string) => (which === 'from' ? { line: 2, ch: 0 } : { line: 2, ch: text.length }),
    },
    file: { path: filePath },
  };
}

function fillConceptAndSave(): void {
  const def = document.getElementById('bz-blackbox-concept-def') as HTMLTextAreaElement;
  def.value = '以部分代整体的修辞手法。';
  def.dispatchEvent(new Event('input'));
  (document.getElementById('bz-blackbox-concept-gen') as HTMLButtonElement).click();
}

async function saveLiteratureFlow(): Promise<void> {
  // 直达文献：内容步点「分析名词」（文本已锁定；AI 失败仍进感触步）
  (document.getElementById('bz-blackbox-lit-analyze') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r, 10));
  // 感触步：直接保存
  (document.getElementById('bz-blackbox-save') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r, 20));
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  closeBlackBoxCapture();
  unloadBlackBox();
  delete (global as any).fetch;
});

describe('书内选区录入：概念（ADR-0016）', () => {
  it('外部选区 → 概念名锁定填充；保存后 links[0]=双链、笔记含 `来源：` 行', async () => {
    const { app, vault } = setup();
    mockOllamaFail();
    await openBlackBoxCaptureFromEpub(app, 'concept', { selectedText: '提喻法', sourceLink: EPUB_LINK });

    const nameInput = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    expect(nameInput.value).toBe('提喻法');
    expect(nameInput.readOnly).toBe(true);

    fillConceptAndSave();
    await vi.waitFor(async () => {
      const m = new BlackBoxDataManager(app);
      expect((await m.load()).entries.some((e) => e.type === 'concept' && e.name === '提喻法')).toBe(true);
    });

    const m = new BlackBoxDataManager(app);
    const concept = (await m.load()).entries.find((e) => e.type === 'concept');
    expect(concept!.links).toEqual([EPUB_LINK]);

    // 笔记落盘：frontmatter links + 正文 `来源：` 行
    const note = vault.files.get('黑匣子/概念/提喻法.md') || '';
    expect(note).toContain(`  - ${EPUB_LINK}`);
    expect(note).toContain(`来源：${EPUB_LINK}`);
  });

  it('外部选区 + 编辑器恰有选区 → 不原位注入来源笔记（epub 不可写）', async () => {
    const { app, vault } = setup();
    mockOllamaFail();
    withEditorSelection(app, '编辑器里的选区', '笔记/来源.md');
    await openBlackBoxCaptureFromEpub(app, 'concept', { selectedText: '提喻法', sourceLink: EPUB_LINK });
    fillConceptAndSave();
    await vi.waitFor(async () => {
      const m = new BlackBoxDataManager(app);
      expect((await m.load()).entries.length).toBe(1);
    });
    // 来源笔记未被创建/写入（原位注入跳过）
    expect(vault.files.has('笔记/来源.md')).toBe(false);
  });
});

describe('书内选区录入：摘抄（ADR-0016）', () => {
  it('外部选区 → 摘抄文本锁定 + 来源=双链；保存后 source 与笔记 `来源：` 行正确', async () => {
    const { app, vault } = setup();
    mockOllamaFail();
    await openBlackBoxCaptureFromEpub(app, 'literature', {
      selectedText: '宇宙很大，生活更大。',
      sourceLink: EPUB_LINK,
    });

    const ta = document.getElementById('bz-blackbox-lit-text') as HTMLTextAreaElement;
    expect(ta.value).toBe('宇宙很大，生活更大。');
    expect(ta.readOnly).toBe(true);
    const src = document.getElementById('bz-blackbox-lit-source') as HTMLInputElement;
    // ticket 50：书内来源只读显示纯文字书名（保存仍存完整双链，cfi 不丢）
    expect(src.value).toBe('三体');
    expect(src.readOnly).toBe(true);
    expect(src.classList.contains('bz-blackbox-locked')).toBe(true);

    await saveLiteratureFlow();

    const m = new BlackBoxDataManager(app);
    const lit = (await m.load()).entries.find((e) => e.type === 'literature');
    expect(lit).toBeTruthy();
    expect(lit!.text).toBe('宇宙很大，生活更大。');
    expect(lit!.source).toBe(EPUB_LINK);

    const notePath = [...vault.files.keys()].find((p) => p.startsWith('黑匣子/摘抄/'));
    expect(notePath).toBeTruthy();
    expect(vault.files.get(notePath!)).toContain(`来源：${EPUB_LINK}`);
  });
});

describe('对称来源回归：无外部参数（ADR-0016）', () => {
  it('概念：笔记编辑器有选区 → 来源自动 = [[来源笔记]]（新对称行为）', async () => {
    const { app, vault } = setup();
    mockOllamaFail();
    withEditorSelection(app, '提喻法', '笔记/文学课.md');
    await openBlackBoxCaptureFromEpub(app, 'concept', null as never);

    const nameInput = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    expect(nameInput.value).toBe('提喻法');
    expect(nameInput.readOnly).toBe(true);
    fillConceptAndSave();
    await vi.waitFor(async () => {
      const m = new BlackBoxDataManager(app);
      expect((await m.load()).entries.length).toBe(1);
    });

    const m = new BlackBoxDataManager(app);
    const concept = (await m.load()).entries.find((e) => e.type === 'concept');
    expect(concept!.links).toEqual(['[[文学课]]']);
    expect(vault.files.get('黑匣子/概念/提喻法.md')).toContain('来源：[[文学课]]');
  });

  it('无选区无外部参数 → 概念无来源（links 为空，笔记无 `来源：` 行）', async () => {
    const { app, vault } = setup();
    mockOllamaFail();
    await openBlackBoxCaptureFromEpub(app, 'concept', null as never);
    const nameInput = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    nameInput.value = '提喻法';
    nameInput.dispatchEvent(new Event('input'));
    fillConceptAndSave();
    await vi.waitFor(async () => {
      const m = new BlackBoxDataManager(app);
      expect((await m.load()).entries.length).toBe(1);
    });

    const note = vault.files.get('黑匣子/概念/提喻法.md') || '';
    expect(note).not.toContain('来源：');
    const m = new BlackBoxDataManager(app);
    const concept = (await m.load()).entries.find((e) => e.type === 'concept');
    expect(concept!.links).toEqual([]);
  });
});

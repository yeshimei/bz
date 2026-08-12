/**
 * 来源笔记原位注入测试（ticket 06）：替换正确性 / 四重守卫 / 降级路径（纯函数 + mock vault 写文件）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { computeInjection, injectIntoSourceNote, lineToOffset } from '../../src/blackbox/inject';
import { openBlackBoxCaptureConcept, openBlackBoxCaptureLiterature, closeBlackBoxCapture, unloadBlackBox } from '../../src/blackbox';
import { BlackBoxDataManager, getBlackBoxFilePath } from '../../src/blackbox/data';

describe('computeInjection 纯函数', () => {
  it('普通替换：选区原文 → [[目标|原文字]]（显示不变）', () => {
    const content = '第一行\n提喻法是修辞手法。\n第三行';
    // 选区 = 第 2 行「提喻法」3 字（行 1 起 0 列）
    const r = computeInjection(content, 1, 0, 1, 3, '提喻法');
    expect(r).toEqual({ ok: true, newContent: '第一行\n[[提喻法|提喻法]]是修辞手法。\n第三行' });
  });

  it('多行选区替换 + 起止列偏移正确', () => {
    const content = 'abc\ndef\nghi';
    const r = computeInjection(content, 1, 1, 2, 2, '概念X');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.newContent).toBe('abc\nd[[概念X|ef\ngh]]i');
  });

  it('守卫：frontmatter 重叠 → 跳过', () => {
    const content = '---\nid: bb_x\ntype: concept\n---\n正文内容';
    const r = computeInjection(content, 1, 0, 1, 3, 'X');
    expect(r).toEqual({ ok: false, reason: 'frontmatter' });
    // 正文区正常注入
    const ok = computeInjection(content, 4, 0, 4, 2, 'X');
    expect(ok.ok).toBe(true);
  });

  it('守卫：代码块重叠（``` 与 ~~~）→ 跳过；块外正常', () => {
    const content = '前文\n```ts\nconst a = 1;\n```\n后文';
    expect(computeInjection(content, 2, 0, 2, 5, 'X')).toEqual({ ok: false, reason: 'code' });
    expect(computeInjection(content, 0, 0, 0, 2, 'X').ok).toBe(true); // 块外
    expect(computeInjection(content, 4, 0, 4, 2, 'X').ok).toBe(true); // 块后
    const tildes = '前\n~~~\n内\n~~~\n后';
    expect(computeInjection(tildes, 2, 0, 2, 1, 'X')).toEqual({ ok: false, reason: 'code' });
  });

  it('守卫：未闭合代码栅栏 → 视为块内跳过', () => {
    const content = '前文\n```\n没闭合的内容';
    expect(computeInjection(content, 2, 0, 2, 2, 'X')).toEqual({ ok: false, reason: 'code' });
  });

  it('守卫：数学块重叠（$$）→ 跳过', () => {
    const content = '前文\n$$\nE = mc^2\n$$\n后文';
    expect(computeInjection(content, 2, 0, 2, 4, 'X')).toEqual({ ok: false, reason: 'math' });
    expect(computeInjection(content, 4, 0, 4, 2, 'X').ok).toBe(true);
  });

  it('守卫：选区已是 [[…]] 包裹（含别名形式）→ 跳过', () => {
    const content = '看 [[提喻法]] 这个条目';
    // 选区 = 提喻法（已被 [[…]] 包裹）
    expect(computeInjection(content, 0, 4, 0, 7, '隐喻')).toEqual({ ok: false, reason: 'wrapped' });
    const alias = '看 [[修辞|提喻法]] 这个条目';
    expect(computeInjection(alias, 0, 7, 0, 10, '隐喻')).toEqual({ ok: false, reason: 'wrapped' });
  });

  it('降级：空选区 / 选区越界 / 空目标名 → empty（不 toast）', () => {
    expect(computeInjection('内容', 0, 0, 0, 0, 'X')).toEqual({ ok: false, reason: 'empty' });
    expect(computeInjection('内容', 0, 0, 5, 0, 'X')).toEqual({ ok: false, reason: 'empty' });
    expect(computeInjection('内容', 0, 0, 0, 2, '  ')).toEqual({ ok: false, reason: 'empty' });
    expect(computeInjection('', 0, 0, 0, 1, 'X')).toEqual({ ok: false, reason: 'empty' });
  });

  it('lineToOffset：行号 → 字符偏移', () => {
    expect(lineToOffset('a\nbb\nccc', 0)).toBe(0);
    expect(lineToOffset('a\nbb\nccc', 1)).toBe(2);
    expect(lineToOffset('a\nbb\nccc', 2)).toBe(5);
    expect(lineToOffset('a\nbb\nccc', 9)).toBe(8); // 越界钳制到内容末尾
  });
});

describe('injectIntoSourceNote（mock vault 写文件）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadBlackBox();
  });
  afterEach(() => {
    unloadBlackBox();
  });

  const SNAP = (text: string, filePath = '笔记/文学课.md') => ({
    text,
    filePath,
    line: 1,
    ch: 0,
    endLine: 1,
    endCh: text.length,
  });

  it('来源笔记存在 → 选区原文被替换为 [[目标|原文字]]', async () => {
    const vault = new MockVault();
    vault.files.set('笔记/文学课.md', '第一行\n修辞是语言的弹性。\n第三行');
    const { app } = setup2(vault);
    const r = await injectIntoSourceNote(app, SNAP('修辞是语言的弹性。'), '修辞的弹性');
    expect(r.injected).toBe(true);
    expect(vault.files.get('笔记/文学课.md')).toBe('第一行\n[[修辞的弹性|修辞是语言的弹性。]]\n第三行');
  });

  it('来源笔记不存在 → 不注入不报错（正常保存）', async () => {
    const vault = new MockVault();
    const { app } = setup2(vault);
    const r = await injectIntoSourceNote(app, SNAP('x', '笔记/不存在.md'), '目标');
    expect(r.injected).toBe(false);
    expect(r.blocked).toBeUndefined();
    expect(hasNotice(/未插入链接/)).toBe(false);
  });

  it('守卫命中（代码块）→ 跳过 + toast「选区位于代码块/元数据内，未插入链接」；原文不动', async () => {
    const vault = new MockVault();
    vault.files.set('笔记/代码.md', '前\n```\nconst a = 1;\n```\n后');
    const { app } = setup2(vault);
    const r = await injectIntoSourceNote(app, { ...SNAP('const a = 1;', '笔记/代码.md'), line: 2, endLine: 2 }, '目标');
    expect(r.injected).toBe(false);
    expect(r.blocked).toBe('code');
    expect(hasNotice('⚠️ 选区位于代码块/元数据内，未插入链接')).toBe(true);
    expect(vault.files.get('笔记/代码.md')).toBe('前\n```\nconst a = 1;\n```\n后'); // 原文不动
  });

  it('无选区快照 → 不注入（永不拒收）', async () => {
    const vault = new MockVault();
    vault.files.set('笔记/a.md', '内容');
    const { app } = setup2(vault);
    expect((await injectIntoSourceNote(app, null, '目标')).injected).toBe(false);
    expect((await injectIntoSourceNote(app, { ...SNAP(''), filePath: null }, '目标')).injected).toBe(false);
  });

  function setup2(vault: MockVault) {
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({} as any));
    return { app, vault };
  }
});

describe('录入链路原位注入（ticket 06 集成）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    document.body.innerHTML = '';
    unloadBlackBox();
    delete (global as any).fetch;
  });
  afterEach(() => {
    unloadBlackBox();
    delete (global as any).fetch;
  });

  function seedVault(vault: MockVault): void {
    vault.files.set(
      getBlackBoxFilePath(),
      JSON.stringify({
        version: 3,
        settings: {},
        persona: {},
        entries: [],
        profiles: [],
        events: [],
        reviews: [],
        chat: [],
        meta: {},
        index: {},
      })
    );
  }

  function withSelection(app: any, text: string, filePath = '笔记/文学课.md'): void {
    app.workspace.activeEditor = {
      editor: {
        getSelection: () => text,
        getCursor: (which: string) => (which === 'from' ? { line: 1, ch: 0 } : { line: 1, ch: text.length }),
      },
      file: { path: filePath },
    };
  }

  it('概念直达：保存后来源笔记选区被替换为 [[概念名|原文字]]', async () => {
    const vault = new MockVault();
    seedVault(vault);
    vault.files.set('笔记/文学课.md', '第一行\n提喻法是修辞手法。\n第三行');
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ blackboxAIProvider: 'ollama' } as any));
    withSelection(app, '提喻法是修辞手法');
    (global as any).fetch = async () => {
      throw new Error('ai down'); // 生成失败降级，走直接录入
    };
    await openBlackBoxCaptureConcept(app);
    // 概念名锁定 = 选区
    const nameInput = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
    expect(nameInput.value).toBe('提喻法是修辞手法');
    setValue('bz-blackbox-concept-def', '以部分代整体');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await new Promise((r) => setTimeout(r, 200));
    expect(vault.files.get('笔记/文学课.md')).toBe('第一行\n[[提喻法是修辞手法|提喻法是修辞手法]]。\n第三行');
  });

  it('摘抄直达：注入目标 = AI 标题（标题确定后注入）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    vault.files.set('笔记/文学课.md', '第一行\n修辞是语言的弹性。\n第三行');
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ blackboxAIProvider: 'ollama' } as any));
    withSelection(app, '修辞是语言的弹性。');
    (global as any).fetch = async () => ({
      ok: true,
      json: async () => ({ message: { content: '修辞的弹性' } }),
    });
    await openBlackBoxCaptureLiterature(app);
    // 不分析直接保存：AI 标题 = 「修辞的弹性」
    document.getElementById('bz-blackbox-lit-analyze')!.click();
    await new Promise((r) => setTimeout(r, 50));
    document.getElementById('bz-blackbox-save')!.click();
    await new Promise((r) => setTimeout(r, 300));
    expect(vault.files.get('笔记/文学课.md')).toBe('第一行\n[[修辞的弹性|修辞是语言的弹性。]]\n第三行');
    const d = await new BlackBoxDataManager(app).load();
    expect(d.entries.some((e: any) => e.type === 'literature')).toBe(true);
  });

  it('来源笔记已删除 → 不注入正常保存（永不拒收）', async () => {
    const vault = new MockVault();
    seedVault(vault);
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ blackboxAIProvider: 'ollama' } as any));
    withSelection(app, '提喻法是修辞手法', '笔记/已删除.md'); // 文件不存在
    await openBlackBoxCaptureConcept(app);
    setValue('bz-blackbox-concept-def', '以部分代整体');
    document.getElementById('bz-blackbox-concept-gen')!.click();
    await new Promise((r) => setTimeout(r, 200));
    const d = await new BlackBoxDataManager(app).load();
    expect(d.entries.some((e: any) => e.type === 'concept')).toBe(true); // 正常保存
  });

  function setValue(id: string, v: string): void {
    const el = document.getElementById(id) as HTMLInputElement;
    el.value = v;
    el.dispatchEvent(new Event('input'));
  }
});

/**
 * 文献盒补充覆盖测试（src/knowledge/index.ts 未触达分支）：
 * openKnowledgeAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）、
 * openTermNote（bz-knowledge-note-term 命令：MarkdownView 类右值 + 选区预填，ticket 138 §1.1）、
 * 与 unloadKnowledge 卸载。
 * ticket 136 改版：入口打开的是「影像」录入界面（issue 310 起直达录入，不再先落处理队列），id 前缀改 literature-/lit-；
 * （原 bz-bili-open 网页版启动器用例已随网页版移除，ticket 136）
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MarkdownView } from 'obsidian';
import { openKnowledgeAddTask, openTermNote, openPassageNote, openImageNote, unloadKnowledge } from '../../src/knowledge';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

// ticket 155：带词入口自动生成，openTermNote 用例统一打桩 note-gen（避免真实 AI 调用）
const noteGen = vi.hoisted(() => ({
  generateVideoNote: vi.fn(),
  generateTermDraft: vi.fn().mockResolvedValue({ summary: 'AI 简介', domain: '物理' }),
  summarizeTermSummary: vi.fn().mockResolvedValue('精简简介'),
  generateTermNote: vi.fn().mockResolvedValue('文献盒/AI 简介.md'),
  generatePassageDraft: vi.fn().mockResolvedValue({ title: '自动标题', summary: '整理正文', domain: '社会' }),
  generatePassageNote: vi.fn().mockResolvedValue('文献盒/自动标题.md'),
  generateImageDraft: vi.fn().mockResolvedValue({ title: '自动图题', summary: '读图解读', domain: '艺术' }),
  generateImageNote: vi.fn().mockResolvedValue('文献盒/自动图题.md'),
  resolveImageDir: vi.fn(() => '文献盒/assets'),
  backfillNotes: vi.fn().mockResolvedValue({ scanned: 0, filled: 0, aiSkipped: false }),
}));
vi.mock('../../src/knowledge/note-gen', () => noteGen);

describe('openKnowledgeAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）', () => {
  afterEach(() => {
    unloadKnowledge();
    document.body.innerHTML = '';
  });

  it('ensure 幂等初始化 → 直达影像录入界面，预填链接 + 只读信息区标题/UP主（新增模式无编辑标签）', async () => {
    resetObsidianMocks();
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeDirectory: '文献盒' }) as any);
    setSettingsSaver(async () => {});

    openKnowledgeAddTask(app, { url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '某视频', uploader: 'UP主甲' });

    // issue 310：聚合讯入口与主窗「影像」一致——直达录入界面，不再先落处理队列
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
    expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('none');
    expect((document.getElementById('lit-add-url') as HTMLInputElement).value).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    // 预填标题/UP 落只读信息行（ADR-0133：标题与 UP 主输入框退役）
    expect(document.getElementById('lit-add-ititle')!.textContent).toBe('某视频');
    expect(document.getElementById('lit-add-iuploader')!.textContent).toBe('UP主甲');
    // ticket 143：无标题，新增模式无编辑标签
    expect(document.getElementById('lit-add-title')).toBeNull();
    expect(document.getElementById('lit-add-mode')!.style.display).toBe('none');
  });

  it('无 prefill：打开影像录入界面（空表单，未解析）', async () => {
    resetObsidianMocks();
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeDirectory: '文献盒' }) as any);
    setSettingsSaver(async () => {});

    openKnowledgeAddTask(app);

    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
    expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('none');
    expect((document.getElementById('lit-add-url') as HTMLInputElement).value).toBe('');
    expect(document.getElementById('lit-add-more')!.style.display).toBe('none'); // 未解析：只见链接行
  });
});

describe('openTermNote（bz-knowledge-note-term 命令：MarkdownView 类右值 + 选区预填，ticket 138 §1.1）', () => {
  afterEach(() => {
    unloadKnowledge();
    document.body.innerHTML = '';
    noteGen.generateTermDraft.mockClear();
    noteGen.generateTermNote.mockClear();
  });

  /** 注入 getActiveViewOfType 桩：记录被调用参数（应为 MarkdownView 类），返回指定视图 */
  function setupApp(viewOfType: any): any {
    resetObsidianMocks();
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveViewOfType = vi.fn(() => viewOfType);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeDirectory: '文献盒' }) as any);
    setSettingsSaver(async () => {});
    return app;
  }

  it('无显式 term：读激活 Markdown 视图选区预填（getActiveViewOfType 传 MarkdownView 类而非字符串）；带词自动生成（ticket 155）', async () => {
    const app = setupApp({ editor: { getSelection: () => '  黑洞  ' } });

    openTermNote(app);

    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    expect(app.workspace.getActiveViewOfType).toHaveBeenCalledWith(MarkdownView); // 类右值（1.1 根因修复）
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('黑洞');
    // ticket 155：带词入口自动触发生成
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('黑洞'));
  });

  it('显式 term 优先：不读选区；选区为空白 → 空输入框', async () => {
    const app = setupApp({ editor: { getSelection: () => '   ' } });

    openTermNote(app, '贝叶斯定理');

    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    expect(app.workspace.getActiveViewOfType).not.toHaveBeenCalled();
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('贝叶斯定理');
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('贝叶斯定理'));
  });

  it('无激活视图（getActiveViewOfType 返回 null）→ 空输入框手填，不抛错、不自动生成', async () => {
    const app = setupApp(null);

    expect(() => openTermNote(app)).not.toThrow();

    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('');
    expect(noteGen.generateTermDraft).not.toHaveBeenCalled();
  });
});

describe('openPassageNote / openImageNote（bz-knowledge-note-passage / -image 命令，issue 326）', () => {
  afterEach(() => {
    unloadKnowledge();
    document.body.innerHTML = '';
    noteGen.generatePassageDraft.mockClear();
  });

  /** 同 openTermNote 段：注入 getActiveViewOfType 桩（类右值断言沿用） */
  function setupApp(viewOfType: any): any {
    resetObsidianMocks();
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveViewOfType = vi.fn(() => viewOfType);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeDirectory: '文献盒' }) as any);
    setSettingsSaver(async () => {});
    return app;
  }

  it('段落：选区预填 textarea（裁空白）+ 当前笔记作来源 chip；**不自动生成**（与名词的差异点）', async () => {
    const app = setupApp({ editor: { getSelection: () => '  一段城市化观察  ' }, file: { path: '笔记/读报.md', extension: 'md' } });

    openPassageNote(app);

    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect(popup.getAttribute('data-lit-entry')).toBe('passage');
    expect((document.getElementById('lit-passage-input') as HTMLTextAreaElement).value).toBe('一段城市化观察');
    // ADR-0116 命令入口带当前笔记：来源 chip 预填（内部笔记方向）
    expect(document.getElementById('lit-term-src-chip')!.style.display).not.toBe('none');
    // 差异点：段落预填不自动触发生成（名词带词即生成，ticket 155）
    expect(noteGen.generatePassageDraft).not.toHaveBeenCalled();
  });

  it('段落：无激活视图 → 空输入框手填，不抛错、不带来源', async () => {
    const app = setupApp(null);

    expect(() => openPassageNote(app)).not.toThrow();

    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect((document.getElementById('lit-passage-input') as HTMLTextAreaElement).value).toBe('');
    expect(document.getElementById('lit-term-src-chip')!.style.display).toBe('none');
  });

  it('图版：命令入口直接开图版态，当前笔记作来源 chip（图无预填可言）', async () => {
    const app = setupApp({ editor: { getSelection: () => '' }, file: { path: '笔记/读报.md', extension: 'md' } });

    openImageNote(app);

    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect(popup.getAttribute('data-lit-entry')).toBe('image');
    expect(document.getElementById('lit-term-src-chip')!.style.display).not.toBe('none');
  });
});

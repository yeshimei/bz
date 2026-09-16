/**
 * 文献盒补充覆盖测试（src/knowledge/index.ts 未触达分支）：
 * openKnowledgeAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0068）、
 * openTermNote（bz-knowledge-note-term 命令：MarkdownView 类右值 + 选区预填，ticket 138 §1.1）、
 * 与 unloadKnowledge 卸载。
 * ticket 136 改版：入口打开的是「影像」录入界面（issue 310 起直达录入，不再先落处理队列），id 前缀改 literature-/lit-；
 * （原 bz-bili-open 网页版启动器用例已随网页版移除，ticket 136）
 * issue 329 增补：录入预填扩展（source/text/images/onCreated）、openKnowledgePreview 预览直达、
 * upgradeNoteSourceInternal source 升级——剪藏本划选工具框消费的契约面。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MarkdownView, requestUrl } from 'obsidian';
import {
  openKnowledgeAddTask,
  openTermNote,
  openPassageNote,
  openImageNote,
  openKnowledgePreview,
  upgradeNoteSourceInternal,
  unloadKnowledge,
} from '../../src/knowledge';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, getNoticeMessages, resetObsidianMocks } from '../mock-obsidian-entry';

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
  findDuplicateTermNote: vi.fn(), // ADR-0143（issue 329 预填继承用例）；默认 undefined = 无重复
}));
// AI 生成链路全部打桩；唯独 upgradeNoteSourceInFile 保留真实现（issue 329 source 升级用例要打真文件 IO）
vi.mock('../../src/knowledge/note-gen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/knowledge/note-gen')>();
  return { ...actual, ...noteGen, upgradeNoteSourceInFile: actual.upgradeNoteSourceInFile };
});

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
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('黑洞', expect.anything()));
  });

  it('显式 term 优先：不读选区；选区为空白 → 空输入框', async () => {
    const app = setupApp({ editor: { getSelection: () => '   ' } });

    openTermNote(app, '贝叶斯定理');

    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    expect(app.workspace.getActiveViewOfType).not.toHaveBeenCalled();
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('贝叶斯定理');
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('贝叶斯定理', expect.anything()));
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

// ==================== issue 329：录入预填扩展 / 预览直达 / source 升级（剪藏本工具框消费的契约面） ====================

/** issue 329 共用脚手架：独立 app（可注入激活视图 / openLinkText 侦探）+ 文献盒设置 */
function setup329(viewOfType: any = null): { app: any; vault: MockVault } {
  resetObsidianMocks();
  clearNotices();
  const vault = new MockVault();
  const app = mockAppWithVault(vault) as any;
  app.workspace.getActiveViewOfType = vi.fn(() => viewOfType);
  app.workspace.openLinkText = vi.fn(async () => {});
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeDirectory: '文献盒' }) as any);
  setSettingsSaver(async () => {});
  return { app, vault };
}

/** 8 字节 PNG 罐头的 data URL（字节内容不参与断言，只要走通解码 + MIME 白名单） */
const PNG_DATA_URL = (() => {
  let bin = '';
  for (const b of [137, 80, 78, 71, 13, 10, 26, 10]) bin += String.fromCharCode(b);
  return 'data:image/png;base64,' + btoa(bin);
})();

describe('issue 329 录入预填扩展（source/text/images/onCreated）', () => {
  afterEach(() => {
    unloadKnowledge();
    document.body.innerHTML = '';
    vi.clearAllMocks();
    clearNotices();
  });

  it('openTermNote 带 opts.source(url+title)：外部 chip 即现，title 直接用不重复抓页面标题', async () => {
    const { app } = setup329();
    (requestUrl as any).mockClear();
    openTermNote(app, '黑洞', { source: { kind: 'url', url: 'https://zhuanlan.zhihu.com/p/1', title: '某文章' } });
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('黑洞');
    const chip = document.getElementById('lit-term-src-chip')!;
    expect(chip.style.display).not.toBe('none');
    expect(chip.textContent).toContain('外 部');
    expect(chip.textContent).toContain('某文章');
    await new Promise((r) => setTimeout(r, 20));
    expect(requestUrl).not.toHaveBeenCalled(); // 已有 title 不重复抓（fetchPageTitle 走 requestUrl）
  });

  it('openPassageNote opts.text 优先于编辑器选区（且不自动生成）；无 opts 回归读选区 + 当前笔记 chip', async () => {
    const view = { editor: { getSelection: () => '  编辑器里的选区  ' }, file: { path: '笔记/读报.md', extension: 'md' } };
    const { app } = setup329(view);
    openPassageNote(app, { text: '剪藏选中的正文' });
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect((document.getElementById('lit-passage-input') as HTMLTextAreaElement).value).toBe('剪藏选中的正文');
    expect(noteGen.generatePassageDraft).not.toHaveBeenCalled(); // 段落预填不自动生成（issue 326 语义不变）
    // 回归：无 opts → 读选区 + 当前笔记作来源候选
    unloadKnowledge();
    document.body.innerHTML = '';
    const again = setup329(view);
    openPassageNote(again.app);
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-passage-input') as HTMLTextAreaElement).value).toBe('编辑器里的选区');
    expect(document.getElementById('lit-term-src-chip')!.style.display).not.toBe('none');
  });

  it('openImageNote opts.images 预填内存图列表（等价粘贴路径）；显式 opts.source 优先于当前笔记', async () => {
    const view = { editor: { getSelection: () => '' }, file: { path: '笔记/读报.md', extension: 'md' } };
    const { app } = setup329(view);
    openImageNote(app, { images: [PNG_DATA_URL], source: { kind: 'url', url: 'https://x.com/a' } });
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect(popup.getAttribute('data-lit-entry')).toBe('image');
    await vi.waitFor(() => expect(document.querySelectorAll('#lit-image-grid img')).toHaveLength(1));
    expect((document.querySelector('#lit-image-grid img') as HTMLImageElement).src).toBe(PNG_DATA_URL);
    const chip = document.getElementById('lit-term-src-chip')!;
    expect(chip.style.display).not.toBe('none');
    expect(chip.getAttribute('title')).toBe('https://x.com/a'); // url 态 chip，非当前笔记
  });

  it('onCreated 端到端：图版确认写入落盘后回调 notePath，且不自动打开笔记（ADR-0144 工具框流程）', async () => {
    const { app } = setup329();
    const openFile = vi.fn();
    app.workspace.getLeaf = () => ({ openFile });
    const onCreated = vi.fn();
    openImageNote(app, { images: [PNG_DATA_URL], onCreated });
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    await vi.waitFor(() => expect(document.querySelectorAll('#lit-image-grid img')).toHaveLength(1));
    (document.getElementById('lit-term-generate') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith('文献盒/自动图题.md'));
    expect(noteGen.generateImageNote).toHaveBeenCalledTimes(1);
    expect(openFile).not.toHaveBeenCalled();
    expect(popup.style.display).toBe('none');
  });

  it('预填名词命中重名（ADR-0143 继承）：确认写入拒写、onCreated 不触发', async () => {
    const { app } = setup329();
    noteGen.findDuplicateTermNote.mockReturnValueOnce('文献盒/黑洞.md');
    const onCreated = vi.fn();
    openTermNote(app, '黑洞', { onCreated });
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(noteGen.generateTermNote).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(getNoticeMessages().join('\n')).toContain('已存在同名文献笔记');
    expect(popup.style.display).toBe('flex'); // 面板保留，改名即可重试
  });
});

describe('openKnowledgePreview（issue 329 预览直达，ADR-0144 划词双链点击）', () => {
  afterEach(() => {
    unloadKnowledge();
    document.body.innerHTML = '';
    vi.clearAllMocks();
    clearNotices();
  });

  const litNoteMd = ['---', 'title: "手稿"', 'type: image', 'domain: "自然"', '---', '', '解读正文与图片。'].join('\n');

  it('文献目录内命中 → 直开预览弹层（openPreview 同壳），不落 openLinkText、不展开主面板', async () => {
    const { app, vault } = setup329();
    vault.files.set('文献盒/手稿.md', litNoteMd);
    await openKnowledgePreview(app, '文献盒/手稿.md');
    const ovl = (await vi.waitFor(() => document.querySelector('.bz-kb-ovl'))) as HTMLElement;
    expect(ovl.parentElement!.className).toContain('bz-kb-sheet-host'); // 主面板不在场 → 独立宿主
    expect(document.getElementById('knowledge-popup')!.style.display).not.toBe('flex');
    await vi.waitFor(() => expect(ovl.textContent).toContain('解读正文与图片。'));
    expect(app.workspace.openLinkText).not.toHaveBeenCalled();
  });

  it('不在文献目录 / 缺文件 → notice 提示 + openLinkText 回退', async () => {
    const { app, vault } = setup329();
    vault.files.set('别的目录/笔记.md', litNoteMd);
    await openKnowledgePreview(app, '别的目录/笔记.md');
    await vi.waitFor(() => expect(app.workspace.openLinkText).toHaveBeenCalledWith('别的目录/笔记.md', '', false));
    expect(getNoticeMessages().join('\n')).toContain('不在知识盒文献目录');
    expect(document.querySelector('.bz-kb-ovl')).toBeNull();

    await openKnowledgePreview(app, '文献盒/不存在.md');
    await vi.waitFor(() => expect(app.workspace.openLinkText).toHaveBeenCalledWith('文献盒/不存在.md', '', false));
  });
});

describe('upgradeNoteSourceInternal（issue 329 source 升级，ADR-0144 §5 保存物化回写）', () => {
  afterEach(() => {
    unloadKnowledge();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  const termNoteMd = (sourceLine: string) =>
    ['---', 'title: "某名词"', 'type: term', sourceLine, 'sourceTitle: "页面标题"', 'date: "2026-09-15 10:00:00"', '---', '', '正文一段。'].join('\n');

  it('外链 source → 改写为内部双链并写盘；sourceTitle 与其余键、正文零扰动', async () => {
    const { app, vault } = setup329();
    vault.files.set('文献盒/某名词.md', termNoteMd('source: "https://zhuanlan.zhihu.com/p/123"'));
    const ok = await upgradeNoteSourceInternal(app, '文献盒/某名词.md', '[[归档/网页剪藏/文章.md|文章标题]]');
    expect(ok).toBe(true);
    const content = vault.files.get('文献盒/某名词.md')!;
    expect(content).toContain('source: "[[归档/网页剪藏/文章.md|文章标题]]"');
    expect(content).toContain('sourceTitle: "页面标题"');
    expect(content).toContain('title: "某名词"');
    expect(content).toContain('正文一段。');
    expect(content.match(/^source:/gm)).toHaveLength(1);
  });

  it('已是内部形态 → 幂等 true 且零写盘；缺文件 / 空链接 / 非外链非内部 → false 静默', async () => {
    const { app, vault } = setup329();
    vault.files.set('文献盒/已内部.md', termNoteMd('source: "[[归档/网页剪藏/文章.md|文章]]"'));
    expect(await upgradeNoteSourceInternal(app, '文献盒/已内部.md', '[[x.md|x]]')).toBe(true);
    expect(vault.modifiedPaths).toHaveLength(0); // 幂等不动，零写盘

    expect(await upgradeNoteSourceInternal(app, '文献盒/缺失.md', '[[x.md|x]]')).toBe(false);
    expect(await upgradeNoteSourceInternal(app, '', '[[x.md|x]]')).toBe(false);
    vault.files.set('文献盒/手写来源.md', termNoteMd('source: "随手写的文字"'));
    expect(await upgradeNoteSourceInternal(app, '文献盒/手写来源.md', '[[x.md|x]]')).toBe(false); // 无可升级
    expect(await upgradeNoteSourceInternal(app, '文献盒/手写来源.md', '  ')).toBe(false);
  });
});

/**
 * 知识盒（knowledge 域）UI 测试 · ADR-0112 三部重构（原型为唯一真理）：
 * - 主壳：词典头（知识盒 + 三部切换）/ 部壹录入入口与文献词典行 / 预览（全文段落+related+提炼成卡）/
 *   提炼成卡（源链+领域自动带、连一张旧卡、为什么相关、落卡写卡片盒+源文献互链）/ 部贰卡片列表 /
 *   部叁主题展示（列表 + 只读渲染）。
 * - 视频录入面板：按钮组、单钮态机、添加弹窗校验/入库、行内时间线（STEP_DONE_MAP + 百分比仅下载）、历史分组与清空。
 * - 术语面板（ticket 142/155 契约）：简洁版结构、预填自动生成、确认写入（事件+打开）、无预览提示。
 * - ESC 分层、设置 schema 四组（含卡片/主题目录新键）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Platform } from 'obsidian';
import { UIManager, knowledgeSettingsSchema } from '../../src/knowledge/ui';
import { KnowledgeData } from '../../src/knowledge/data';
import { BatchRunner } from '../../src/knowledge/processor';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, getNoticeMessages, resetObsidianMocks } from '../mock-obsidian-entry';

const noteGen = vi.hoisted(() => ({
  generateTermNote: vi.fn(),
  generateTermDraft: vi.fn(),
  summarizeTermSummary: vi.fn(),
  backfillNotes: vi.fn(),
}));
vi.mock('../../src/knowledge/note-gen', () => noteGen);

vi.mock('../../src/core/flow-dialog', () => ({ openFlowDialog: vi.fn().mockResolvedValue('ok') }));

function makeApp(vault: MockVault) {
  const openFile = vi.fn();
  const base = mockAppWithVault(vault) as any;
  base.workspace = { ...base.workspace, getLeaf: () => ({ openFile }) };
  base.openUrl = vi.fn();
  setApp(base);
  return { app: base, openFile };
}

const BASE_SETTINGS: Record<string, any> = {
  knowledgeDirectory: '文献盒',
  knowledgeCardboxDirectory: '卡片盒',
  knowledgeTopicDirectory: '主题盒',
  knowledgeDomainList: '',
  knowledgeProgressDetail: true,
  knowledgeKeepVideo: true,
  knowledgeQuality: 'highest',
  knowledgeStopOnFailure: false,
  knowledgeOutputDir: '',
  knowledgeCompress: true,
  knowledgeCrf: 23,
  knowledgeFfmpegPath: 'ffmpeg',
  knowledgeFfprobePath: 'ffprobe',
  knowledgePythonPath: '',
  knowledgeWhisperModel: 'small',
  knowledgeCacheDir: '',
  knowledgeCacheRetentionDays: 7,
};

/** 带 frontmatter 的文献笔记 markdown */
function noteMd(opts: { title: string; type?: string; domain?: string; date?: string; summary?: string; url?: string; body?: string; related?: string[] }) {
  const lines = ['---', `title: "${opts.title}"`];
  if (opts.type) lines.push(`type: ${opts.type}`);
  if (opts.domain) lines.push(`domain: "${opts.domain}"`);
  lines.push(`summary: "${opts.summary ?? '一段简介'}"`);
  lines.push(`date: "${opts.date ?? '2026-08-01 10:00:00'}"`);
  if (opts.url) lines.push(`url: "${opts.url}"`);
  if (opts.related?.length) {
    lines.push('related:');
    for (const r of opts.related) lines.push(`  - "[[${r}]]"`);
  }
  lines.push('---');
  const body = opts.body ?? '正文段落一。\n\n正文段落二。';
  return lines.join('\n') + '\n\n' + body;
}

/** 带 frontmatter 的卡片笔记 markdown */
function cardMd(opts: { title?: string; category?: string; domain?: string; review?: boolean }) {
  const lines = ['---'];
  lines.push(`title: "${opts.title ?? ''}"`);
  if (opts.domain) lines.push(`domain: "${opts.domain}"`);
  if (opts.category) lines.push(`category: "${opts.category}"`);
  if (opts.review) lines.push('reviewStart: "2026-08-01T00:00:00"');
  lines.push('---');
  return lines.join('\n') + '\n卡片正文';
}

describe('知识盒 UI（ADR-0112 三部）', () => {
  let vault: MockVault;
  let openFile: ReturnType<typeof vi.fn>;
  let app: any;
  let ui: UIManager;
  let settings: Record<string, any>;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    ({ app, openFile } = makeApp(vault));
    KnowledgeData.init({ storagePath: 'CONFIG/STORAGE' });
    clearNotices();
    settings = { ...BASE_SETTINGS };
    setSettingsProvider(() => settings as any);
    setSettingsSaver(async () => {});
    noteGen.generateTermNote.mockReset();
    noteGen.generateTermDraft.mockReset();
    noteGen.summarizeTermSummary.mockReset();
    noteGen.backfillNotes.mockReset();
    noteGen.generateTermDraft.mockResolvedValue({ summary: 'AI 简介', domain: '心理' });
    noteGen.summarizeTermSummary.mockResolvedValue('精简版简介');
    noteGen.generateTermNote.mockResolvedValue('文献盒/松果体.md');
    noteGen.backfillNotes.mockResolvedValue({ scanned: 0, filled: 0, aiSkipped: false });
    (BatchRunner as any).running = false;
    ui = new UIManager(app);
  });

  afterEach(() => {
    ui.destroy();
    (Platform as any).isMobile = false;
    document.body.innerHTML = '';
  });

  // ==================== 主壳 ====================

  it('showMain 渲染三部壳：词典头「知识盒」+ 三部按钮 + 部壹录入入口（两种来源）', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.getElementById('knowledge-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-popup')!;
    expect(popup.querySelector('.bz-kb-title')!.textContent).toBe('知 识 盒');
    const parts = Array.from(popup.querySelectorAll<HTMLElement>('.bz-kb-part')).map((b) => b.textContent);
    expect(parts).toEqual(['部壹 · 文献', '部贰 · 卡片', '部叁 · 主题']);
    const entries = Array.from(popup.querySelectorAll<HTMLElement>('.bz-kb-entrybtn b')).map((b) => b.textContent);
    expect(entries).toEqual(['文字录入 · 术语', '视频录入 · 任务']);
    await vi.waitFor(() => expect(popup.querySelector('.bz-kb-sc')!.textContent).toContain('还没有文献笔记'));
  });

  it('部壹文献列表：词条/影像 + 领域 + LIT 编号，最近创建降序；行点击开预览（全文段落 + related + 提炼成卡）', async () => {
    vault.files.set('文献盒/视频C.md', noteMd({
      title: '视频C', type: 'video', domain: '物理', date: '2026-09-01 10:00:00',
      body: '段落一。\n\n段落二。', related: ['卡片盒/旧卡A'],
    }));
    vault.files.set('文献盒/术语B.md', noteMd({ title: '术语B', type: 'term', domain: '数学', date: '2026-08-28 10:00:00' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(2));
    const ws = Array.from(document.querySelectorAll<HTMLElement>('.bz-kb-lexrow .bz-kb-w')).map((x) => x.textContent);
    expect(ws).toEqual(['视频C', '术语B']);
    (document.querySelector('.bz-kb-lexrow[data-kb-act=lit-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-ovl')!).toBeTruthy());
    const sheet = document.querySelector('.bz-kb-sheet')!;
    expect(sheet.textContent).toContain('段落一');
    expect(sheet.textContent).toContain('段落二');
    expect(sheet.textContent).toContain('旧卡A');
    expect(sheet.querySelector('[data-kb-act=card-new]')).toBeTruthy();
  });

  it('提炼成卡：候选同域优先带推荐；落卡写卡片盒（category/related/why）+ 源文献 related 互链 + 部贰新落', async () => {
    vault.files.set('文献盒/无助.md', noteMd({
      title: '无助竟是大脑本能', type: 'video', domain: '心理', date: '2026-08-29 10:00:00',
      body: '塞里格曼修正理论。', related: ['卡片盒/习得性无助'],
    }));
    vault.files.set('卡片盒/习得性无助.md', cardMd({ title: '习得性无助', category: '心理', review: true }));
    vault.files.set('卡片盒/工作记忆.md', cardMd({ title: '工作记忆', category: '认知' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    (document.querySelector('.bz-kb-lexrow[data-kb-act=lit-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('[data-kb-act=card-new]')).toBeTruthy());
    (document.querySelector('[data-kb-act=card-new]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('[data-kb-role=why]')).toBeTruthy());
    const olds = Array.from(document.querySelectorAll<HTMLElement>('[data-kb-old]')).map((b) => b.textContent);
    expect(olds[0]).toContain('习得性无助');
    expect(olds[0]).toContain('推荐');
        (document.querySelector('[data-kb-old]') as HTMLElement).click();
    await vi.waitFor(() => expect((document.querySelector('[data-kb-act=card-save]') as HTMLButtonElement).disabled).toBe(false));
    (document.querySelector('[data-kb-act=card-save]') as HTMLElement).click();
    await vi.waitFor(() => expect(vault.files.has('卡片盒/无助竟是大脑本能.md')).toBe(true));
    await vi.waitFor(() => expect((vault.files.get('文献盒/无助.md') as string)).toContain('[[卡片盒/无助竟是大脑本能|无助竟是大脑本能]]'));
    const cardText = vault.files.get('卡片盒/无助竟是大脑本能.md') as string;
    expect(cardText).toContain('category: 心理');
    expect(cardText).toContain('[[文献盒/无助.md|无助竟是大脑本能]]');
    expect(cardText).toContain('整理为显式连接');
    const srcText = vault.files.get('文献盒/无助.md') as string;
    expect(srcText).toContain('[[卡片盒/无助竟是大脑本能|无助竟是大脑本能]]');
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('无助竟是大脑本能'));
    expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('新 落');
  });

  it('部贰：卡片领域读序 domain → category → 未分类；复习中/未入复习', async () => {
    vault.files.set('卡片盒/A.md', cardMd({ title: 'A', category: '生物', review: true }));
    vault.files.set('卡片盒/B.md', cardMd({ title: 'B', domain: '历史' }));
    vault.files.set('卡片盒/C.md', cardMd({ title: 'C' }));
    ui.showMain();
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('提 炼 层'));
    expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('3 张');
    expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('复习中 · 到期由闹钟安排');
    expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('未入复习');
  });

  it('部叁：主题笔记展示（列表 + 只读渲染 + 返回），文案标明关联机制探索中', async () => {
    vault.files.set('主题盒/认知觉醒.md', '# 本能脑\n\n[[书库/认知觉醒]] 块引用正文');
    ui.showMain();
    (document.querySelector('[data-part=z3]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('认知觉醒'));
    expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('仅做展示');
    (document.querySelector('[data-kb-act=topic-open]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-noteview')).toBeTruthy());
    expect(document.querySelector('.bz-kb-noteview')!.textContent).toContain('本能脑');
    (document.querySelector('[data-kb-act=topics-back]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('一篇普通笔记'));
  });

  it('录入入口：术语面板 / 视频面板叠开', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelector('[data-kb-act=term-entry]')).toBeTruthy());
    (document.querySelector('[data-kb-act=term-entry]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    ui.hideTermEntry();
    (document.querySelector('[data-kb-act=video-entry]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
  });

  // ==================== 视频录入 ====================

  it('视频面板：➕/▶️/🕘/✕ 按钮组；单钮态机（空队列禁用；运行 ⏹）；行内时间线（STEP_DONE_MAP + 百分比仅下载）', async () => {
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-video-popup')!;
    expect(popup.querySelector('.bz-kb-vtitle')!.textContent).toBe('视频录入');
    expect(popup.querySelector('#lit-btn-video-add')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-run')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-history')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-close')).toBeTruthy();
    await vi.waitFor(() => expect((popup.querySelector('#lit-btn-video-run') as HTMLButtonElement).disabled).toBe(true));
    const t = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1abc', start: '00:00:10', end: '00:00:30' });
    await KnowledgeData.updateTask(t.id, { status: 'processing' });
    (ui as any).runState.set(t.id, { steps: ['解析视频信息', '下载视频', 'AI 生成文献笔记中', '笔记落盘中'], phase: 'download', pct: 42, startAt: Date.now() });
    await ui.refreshVideoPanel();
    (ui as any).updateRowProgress(t.id);
    const card = popup.querySelector('.bz-kb-taskcard')!;
    expect(card.querySelector('.bz-kb-status')!.textContent).toBe('处理中');
    expect(card.querySelector('.bz-kb-step-done')!.textContent).toBe('✓ 已解析视频信息');
    expect(card.querySelector('.bz-kb-step-cur')!.textContent).toBe('笔记落盘中');
    expect(card.textContent).toContain('✓ 已生成文献笔记');
    expect(card.querySelector('.bz-kb-step-pct')!.textContent).toBe('42%');
    expect(card.querySelector('.bz-kb-progress-track')!.innerHTML).toContain('width:42%');
    expect(card.textContent).toContain('✓ 已生成文献笔记');
    (BatchRunner as any).running = true;
    await ui.refreshVideoPanel();
    const run = popup.querySelector('#lit-btn-video-run') as HTMLButtonElement;
    expect(run.textContent).toBe('⏹');
    expect(run.disabled).toBe(false);
    (BatchRunner as any).running = false;
    await ui.refreshVideoPanel();
    expect((popup.querySelector('#lit-btn-video-run') as HTMLButtonElement).textContent).toBe('▶️');
  });

  it('添加弹窗：校验 + 整片/剪辑开关 + 保存入库（宽松时间归一）', async () => {
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const popup = document.getElementById('knowledge-add-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect(document.getElementById('lit-add-clip-fields')!.style.display).toBe('block');
    (document.getElementById('lit-add-save') as HTMLElement).click();
    expect(getNoticeMessages().join('\n')).toContain('请填写视频链接');
    (document.getElementById('lit-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1test';
    (document.getElementById('lit-add-start') as HTMLInputElement).value = '12.2';
    (document.getElementById('lit-add-end') as HTMLInputElement).value = '1:02:03';
    (document.getElementById('lit-add-save') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-taskcard').length).toBe(1));
    expect(document.querySelector('.bz-kb-taskcard')!.textContent).toContain('12:02 ~ 1:02:03');
    (document.querySelector('#lit-add-range button[data-range="whole"]') as HTMLElement).click();
    expect(document.getElementById('lit-add-clip-fields')!.style.display).toBe('none');
  });

  it('历史：🕘 打开 + 归档分组 + 计数；清空历史（确认后清空）', async () => {
    const a = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1aaa', start: '00:00:10', end: '00:00:20', title: '视频甲', uploader: 'UP甲' });
    const a2 = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1aaa', start: '00:01:00', end: '00:01:30', title: '视频甲' });
    await KnowledgeData.updateTask(a2.id, { archived: true, processedAt: '2026-09-01 11:00:00', notePath: '文献盒/视频甲2.md' });
    await KnowledgeData.updateTask(a.id, { archived: true, processedAt: '2026-09-01 10:00:00', notePath: '文献盒/视频甲.md' });
    const b = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1bbb', title: '视频乙' });
    await KnowledgeData.updateTask(b.id, { archived: true, processedAt: '2026-09-02 10:00:00', notePath: '文献盒/视频乙.md' });
    ui.showHistory();
    await vi.waitFor(() => expect(document.getElementById('knowledge-history-popup')!.style.display).toBe('flex'));
    await vi.waitFor(() => expect(document.getElementById('lit-history-counts')!.textContent).toContain('共 3 条'));
    expect(document.querySelectorAll('.bz-kb-hgroup').length).toBe(2);
    expect(document.querySelectorAll('.bz-kb-hnote').length).toBe(3);
    expect(document.getElementById('knowledge-history-list')!.textContent).toContain('视频甲');
    const schema = knowledgeSettingsSchema({ onClearHistory: async () => { await KnowledgeData.clearHistory(); await (ui as any).refreshHistory(); } });
    const row = schema.groups.flatMap((g) => g.rows).find((r) => (r as any).name === '清空历史') as any;
    await row.onClick();
    await vi.waitFor(() => expect(document.getElementById('lit-history-counts')!.textContent).toContain('共 0 条'));
  });

  // ==================== 术语面板（142/155 契约） ====================

  it('术语面板简洁版契约：无 label/placeholder；预填自动生成；属性卡+内容卡', async () => {
    ui.showTermEntry('松果体');
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('松果体'));
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-term-popup')!;
    expect(popup.querySelector('label')).toBeNull();
    expect((document.getElementById('lit-term-input') as HTMLInputElement).placeholder).toBe('');
    expect(popup.querySelector('#lit-term-meta-term')!.textContent).toBe('松果体');
    expect(popup.querySelector('#lit-term-meta-domain')!.textContent).toBe('心理');
    expect(popup.querySelector('#lit-term-content')!.textContent).toBe('AI 简介');
  });

  it('确认写入：按预览值落盘一次 + 打开笔记 + term-generated 事件；无预览提示先生成', async () => {
    const seen: string[] = [];
    onDomainEvent('knowledge:tasks', (evt: any) => { if (evt.kind === 'term-generated') seen.push(evt.term); });
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '褪黑素';
    (document.getElementById('lit-term-save') as HTMLElement).click();
    expect(getNoticeMessages().join('\n')).toContain('请先点击「生成」');
    vault.files.set('文献盒/松果体.md', '---\ntitle: 松果体\ntype: term\ndomain: 医学\n---\n\n简介');
    await (ui as any).onTermGenerate();
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalled());
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({ term: '褪黑素', summary: 'AI 简介', domain: '心理' });
    expect(openFile).toHaveBeenCalled();
    await vi.waitFor(() => expect(seen).toEqual(['褪黑素']));
  });

  // ==================== 设置 schema / ESC ====================

  it('knowledgeSettingsSchema：四组（目录与分类含卡片/主题目录新键、视频处理、工具、维护）+ 清空历史回调', async () => {
    const schema = knowledgeSettingsSchema();
    expect(schema.groups.map((g) => g.name)).toEqual(['外观', '目录与分类', '视频处理', '工具', '维护']);
    const dirRows = schema.groups[1].rows.map((r) => (r as any).binding?.key);
    expect(dirRows).toContain('knowledgeCardboxDirectory');
    expect(dirRows).toContain('knowledgeTopicDirectory');
    expect((schema.groups[1].rows[0] as any).binding.key).toBe('knowledgeDirectory');
  });

  it('ESC 分层：术语 → 视频 → 主面板 逐层关', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.getElementById('knowledge-popup')!.style.display).toBe('flex'));
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('none');
    expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('none');
    expect(document.getElementById('knowledge-popup')!.style.display).toBe('flex');
  });
});

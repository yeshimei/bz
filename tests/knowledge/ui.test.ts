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
import { Platform, requestUrl } from 'obsidian';
import { UIManager, knowledgeSettingsSchema } from '../../src/knowledge/ui';
import { KnowledgeData } from '../../src/knowledge/data';
import { BatchRunner } from '../../src/knowledge/processor';
import { openFlowDialog } from '../../src/core/flow-dialog'; // issue 291 断言用（本文件已 vi.mock 为 spy）
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, getNoticeMessages, mockMarkdownRenderer, resetObsidianMocks } from '../mock-obsidian-entry';

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

/** requestUrl 罐头（issue 278 测试）：补齐 RequestUrlResponse 形状，测试只消费 status/text */
function httpResp(status: number, text: string): any {
  return {
    status,
    text,
    headers: {},
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
    json: async () => JSON.parse(text),
  };
}

/** ADR-0134 落地页罐头：og:url + `__INITIAL_STATE__`（桌面 videoData 形态，字段同 view API data） */
const LANDING_HTML = '<html><head><title>落地页标题 _哔哩哔哩_bilibili</title>'
  + '<meta property="og:url" content="https://www.bilibili.com/video/BV1shortlink/"></head><body><script>'
  + 'window.__INITIAL_STATE__=' + JSON.stringify({
    videoData: {
      bvid: 'BV1shortlink', title: '失语者的声音', owner: { name: '央视频' }, duration: 300,
      pages: [
        { cid: 11, page: 1, part: '上集', duration: 120 },
        { cid: 12, page: 2, part: '下集', duration: 180 },
      ],
    },
  }) + ';(function(){})();</script></body></html>';

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

  it('部壹文献列表：词条/影像 + 领域 + LIT 编号，最近创建降序；行点击开预览（全文段落 + 关联；无操作按钮）', async () => {
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
    // 预览只读：提炼成卡/先放回去按钮已移除；壳头 ✕ 已退役（issue 271：点遮罩/ESC 关闭）
    expect(sheet.querySelector('[data-kb-act=card-new]')).toBeNull();
    expect(sheet.querySelector('.bz-kb-sheet-close')).toBeNull();
  });

  it('影像文献预览：正文经 MarkdownRenderer 渲染（含 ![[mp4]] 内嵌）；原文链接可点外开', async () => {
    vault.files.set('文献盒/带片C.md', noteMd({
      title: '带片C', type: 'video', domain: '物理', date: '2026-09-02 10:00:00',
      url: 'https://www.bilibili.com/video/BV1demo/',
      body: '段落零。\n\n![[CONFIG/APPENDIX/带片C.mp4]]',
    }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    mockMarkdownRenderer.render.mockClear();
    (document.querySelector('.bz-kb-lexrow[data-kb-act=lit-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-kb-preview-body')).toBeTruthy());
    // 整个正文交给 MarkdownRenderer（内嵌 mp4 语法随正文进入渲染管线），带源路径
    expect(mockMarkdownRenderer.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('![[CONFIG/APPENDIX/带片C.mp4]]'),
      expect.anything(),
      '文献盒/带片C.md',
      expect.anything(),
    );
    // mock 追加语义（ADR-0122，与真机一致）渲染进空容器：标记串恰好一份——
    // 骨架不再预填 parasHtml（预填 + 追加 = 双份，issue 275）
    const bodyEl = document.getElementById('bz-kb-preview-body')!;
    expect(bodyEl.textContent!.split('段落零').length - 1).toBe(1);
    // ![[…mp4]] 只出现一次：整段正文只经渲染器产出一份
    expect(bodyEl.textContent!.split('![[CONFIG/APPENDIX/带片C.mp4]]').length - 1).toBe(1);
    // 视频 url → 「原文」可点链接（openUrl 外开）
    const link = document.querySelector('[data-lit-src-url]') as HTMLElement;
    expect(link?.getAttribute('data-lit-src-url')).toBe('https://www.bilibili.com/video/BV1demo/');
    link.click();
    await vi.waitFor(() => expect(app.openUrl).toHaveBeenCalledWith('https://www.bilibili.com/video/BV1demo/'));
  });

  it('纯嵌入正文（只有 ![[…mp4]]）渲染成功 → 不误触发纯文本兜底（review 275：成败判据=是否产出元素）', async () => {
    vault.files.set('文献盒/纯嵌入C.md', noteMd({
      title: '纯嵌入C', type: 'video', domain: '物理', date: '2026-09-04 10:00:00',
      body: '![[CONFIG/APPENDIX/带片C.mp4]]',
    }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    (document.querySelector('.bz-kb-lexrow[data-kb-act=lit-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-kb-preview-body')).toBeTruthy());
    const bodyEl = document.getElementById('bz-kb-preview-body')!;
    // 渲染产出元素（mock 为包裹 div）→ 兜底不落地：嵌入字面恰好一份、无「（无正文）」兜底段
    expect(bodyEl.querySelector('*')).toBeTruthy();
    expect(bodyEl.textContent!.split('![[CONFIG/APPENDIX/带片C.mp4]]').length - 1).toBe(1);
    expect(bodyEl.textContent).not.toContain('（无正文）');
  });

  it('渲染抛错 → 纯文本兜底且不叠加：兜底只写一份；再开（渲染恢复）仍恰好一份（issue 275）', async () => {
    vault.files.set('文献盒/抛错C.md', noteMd({
      title: '抛错C', type: 'video', domain: '物理', date: '2026-09-03 10:00:00',
      body: '兜底段落一。\n\n兜底段落二。',
    }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    mockMarkdownRenderer.render.mockRejectedValueOnce(new Error('渲染管线失败'));
    (document.querySelector('.bz-kb-lexrow[data-kb-act=lit-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-kb-preview-body')!.textContent).toContain('兜底段落一'));
    const bodyEl = document.getElementById('bz-kb-preview-body')!;
    expect(bodyEl.querySelector('p')).toBeTruthy(); // 纯文本段落兜底在位
    expect(bodyEl.textContent!.split('兜底段落一').length - 1).toBe(1); // 兜底只写一份
    // 点遮罩关 → 再开（渲染恢复）：渲染前清空语义保证仍恰好一份
    (document.querySelector('.bz-kb-ovl') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-ovl')).toBeNull());
    (document.querySelector('.bz-kb-lexrow[data-kb-act=lit-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-kb-preview-body')!.textContent).toContain('兜底段落一'));
    expect(document.getElementById('bz-kb-preview-body')!.textContent!.split('兜底段落一').length - 1).toBe(1);
  });

  it('空正文笔记：预览显式「（无正文）」空态，不留全白（issue 275）', async () => {
    vault.files.set('文献盒/无正文.md', noteMd({ title: '无正文', type: 'term', domain: '数学', date: '2026-09-03 10:00:00', body: '' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    (document.querySelector('.bz-kb-lexrow[data-kb-act=lit-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-kb-preview-body')!.textContent).toContain('（无正文）'));
  });

  it('提炼成卡（预览按钮已移除，编辑器编程触达保行为覆盖）：候选同域优先带推荐；落卡写卡片盒 + 源文献 related 互链 + 部贰新落', async () => {
    vault.files.set('文献盒/无助.md', noteMd({
      title: '无助竟是大脑本能', type: 'video', domain: '心理', date: '2026-08-29 10:00:00',
      body: '塞里格曼修正理论。', related: ['卡片盒/习得性无助'],
    }));
    vault.files.set('卡片盒/习得性无助.md', cardMd({ title: '习得性无助', category: '心理', review: true }));
    vault.files.set('卡片盒/工作记忆.md', cardMd({ title: '工作记忆', category: '认知' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(1));
    // 预览入口按钮已移除（快改批）：直接打开编辑器，保 saveCard 行为覆盖
    await (ui as any).openCardEditor((ui as any).allNotes[0]);
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
    await vi.waitFor(() => expect(document.querySelector('[data-kb-act=card-peek]')).toBeTruthy());
    expect(document.querySelectorAll('[data-kb-act=card-peek]').length).toBe(3);
    expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('复习中 · 到期由闹钟安排');
    expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('未入复习');
  });

  it('部叁：主题笔记展示（列表 + 三部统一预览弹层），文案标明关联机制探索中', async () => {
    vault.files.set('主题盒/认知觉醒.md', '# 本能脑\n\n[[书库/认知觉醒]] 块引用正文');
    ui.showMain();
    (document.querySelector('[data-part=z3]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-sc')!.textContent).toContain('认知觉醒'));
    (document.querySelector('[data-kb-act=topic-open]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-kb-preview-body')).toBeTruthy());
    expect(document.querySelector('.bz-kb-sheet')!.textContent).toContain('主题预览');
    expect(document.getElementById('bz-kb-preview-body')!.textContent).toContain('本能脑');
    // 同一 openPreview 的清空语义：主题正文也恰好一份（issue 275）
    expect(document.getElementById('bz-kb-preview-body')!.textContent!.split('本能脑').length - 1).toBe(1);
  });

  it('三部统一预览：卡片行点击开同款弹层（卡片预览）', async () => {
    vault.files.set('卡片盒/A.md', cardMd({ title: 'A', domain: '历史' }));
    ui.showMain();
    (document.querySelector('[data-part=z2]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('[data-kb-act=card-peek]')).toBeTruthy());
    (document.querySelector('[data-kb-act=card-peek]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-kb-preview-body')).toBeTruthy());
    expect(document.querySelector('.bz-kb-sheet')!.textContent).toContain('卡片预览');
    expect(document.querySelector('.bz-kb-sheet')!.querySelector('[data-lit-src-url]')).toBeNull();
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

  it('视频面板：➕/▶️/🕘 按钮组（✕ 退役 issue 271）；单钮态机（空队列禁用；运行 ⏹）；行内时间线（STEP_DONE_MAP + 百分比仅下载）', async () => {
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-video-popup')!;
    expect(popup.querySelector('.bz-kb-vtitle')!.textContent).toBe('视频录入');
    expect(popup.querySelector('#lit-btn-video-add')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-run')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-history')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-close')).toBeNull(); // issue 271：✕ 退役
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

  it('添加弹窗（ADR-0133）：解析按钮 → 信息区/分P 下拉 → 整片保存入库（净化 URL）', async () => {
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) {
        return httpResp(200, JSON.stringify({ code: 0, data: {
          title: '解析出的标题', owner: { mid: 1, name: '解析UP' }, duration: 300,
          pages: [
            { cid: 11, page: 1, part: '第一集', duration: 120 },
            { cid: 12, page: 2, part: '第二集', duration: 180 },
          ],
        } }));
      }
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const popup = document.getElementById('knowledge-add-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    // 空链接保存 → 校验提示
    (document.getElementById('lit-add-save') as HTMLElement).click();
    expect(getNoticeMessages().join('\n')).toContain('请填写视频链接');
    // 填链接 → 解析按钮（无防抖：不点不解析）
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://www.bilibili.com/video/BV1testaaaaa/?spm_id_from=333.0';
    expect(document.getElementById('lit-add-info')!.style.display).toBe('none'); // 未解析：信息区隐藏
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('解析出的标题'));
    expect(urlInput.value).toBe('https://www.bilibili.com/video/BV1testaaaaa/'); // 解析时净化写回
    expect(document.getElementById('lit-add-iuploader')!.textContent).toBe('解析UP');
    // 多 P → 下拉可见（P{n} · part · 时长），默认 P1
    const pageSel = document.getElementById('lit-add-page') as HTMLSelectElement;
    expect(document.getElementById('lit-add-page-row')!.style.display).not.toBe('none');
    expect(pageSel.options.length).toBe(2);
    expect(pageSel.options[0].textContent).toBe('P1 · 第一集 · 2:00');
    // 范围默认全选（P1 量程 120s）
    expect((document.getElementById('lit-add-start') as HTMLInputElement).value).toBe('0:00');
    expect((document.getElementById('lit-add-end') as HTMLInputElement).value).toBe('2:00');
    // 保存（整片）
    (document.getElementById('lit-add-save') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-taskcard').length).toBe(1));
    const tasks = await KnowledgeData.loadTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].url).toBe('https://www.bilibili.com/video/BV1testaaaaa/');
    expect(tasks[0].start).toBeNull();
    expect(tasks[0].end).toBeNull();
    expect(tasks[0].title).toBe('解析出的标题');
    expect(tasks[0].uploader).toBe('解析UP');
    expect(tasks[0].duration).toBe(120);
    expect(tasks[0].page).toBeNull();
    expect(document.querySelector('.bz-kb-taskcard')!.textContent).toContain('整片');
  });

  it('b23.tv 短链（ADR-0134）：落地页 state 补全信息、输入框写回规范链接、切 P 查档、落库规范 URL', async () => {
    settings.bilibiliCookie = 'SESSDATA=x';
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    // 落地页罐头：og:url + __INITIAL_STATE__（桌面 videoData 形态，字段同 view API data）
    const landing = LANDING_HTML;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.startsWith('https://b23.tv/')) return httpResp(200, landing);
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: -412, message: '风控', data: null })); // API 不可用 → 落地页 state 顶上
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: true } }));
      if (url.includes('player/playurl')) return httpResp(200, JSON.stringify({ code: 0, data: { dash: { video: [{ height: 720 }, { height: 360 }] } } }));
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://b23.tv/AtDgBVH';
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    // 短链 → 标题/UP主/分P/时长全给（不靠 view API）
    await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('失语者的声音'));
    expect(document.getElementById('lit-add-iuploader')!.textContent).toBe('央视频');
    expect(urlInput.value).toBe('https://www.bilibili.com/video/BV1shortlink/'); // 写回规范链接
    const pageSel = document.getElementById('lit-add-page') as HTMLSelectElement;
    expect([...pageSel.options].map((o) => o.textContent)).toEqual(['P1 · 上集 · 2:00', 'P2 · 下集 · 3:00']);
    // 档位：bvid 由 meta 补出 → nav 门禁后查到实测档位
    const qSel = document.getElementById('lit-add-quality') as HTMLSelectElement;
    await vi.waitFor(() => expect([...qSel.options].map((o) => o.value)).toEqual(['highest', '720', '360']));
    // 切 P2：链接里没有 BV 字样，仍靠 meta.bvid 查（cid=12）
    pageSel.value = '2';
    pageSel.dispatchEvent(new Event('change', { bubbles: true }));
    expect((document.getElementById('lit-add-end') as HTMLInputElement).value).toBe('3:00');
    await vi.waitFor(() => {
      const last = reqMock.mock.calls[reqMock.mock.calls.length - 1][0] as any;
      expect(String(last.url)).toContain('playurl?bvid=BV1shortlink&cid=12');
    });
    // 保存 → 落库规范链接（下载器只认链接里的 BV 号）
    (document.getElementById('lit-add-save') as HTMLElement).click();
    await vi.waitFor(async () => expect((await KnowledgeData.loadTasks()).length).toBe(1));
    const tasks = await KnowledgeData.loadTasks();
    expect(tasks[0].url).toBe('https://www.bilibili.com/video/BV1shortlink/');
    expect(tasks[0].title).toBe('失语者的声音');
    expect(tasks[0].uploader).toBe('央视频');
    expect(tasks[0].page).toBe(2);
  });

  it('范围选择（ADR-0133）：时间框提交钳制 + ↑/↓ 微调 + 剪辑范围落库与整片重置', async () => {
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) {
        return httpResp(200, JSON.stringify({ code: 0, data: {
          title: '单P视频', owner: { mid: 1, name: 'UP' }, duration: 300,
          pages: [{ cid: 9, page: 1, part: '', duration: 300 }],
        } }));
      }
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://www.bilibili.com/video/BV1rangeaaaa';
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('单P视频'));
    // 单 P：分P 字段隐藏（下拉与数字框都不可见）
    expect(document.getElementById('lit-add-page-row')!.style.display).toBe('none');
    expect(document.getElementById('lit-add-pagenum-row')!.style.display).toBe('none');
    const startInput = document.getElementById('lit-add-start') as HTMLInputElement;
    const endInput = document.getElementById('lit-add-end') as HTMLInputElement;
    // 时间框提交：宽松输入归一 + 钳制
    startInput.value = '1:00';
    startInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(startInput.value).toBe('1:00');
    // ↑ 键 ±1 秒
    startInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(startInput.value).toBe('1:01');
    startInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    expect(startInput.value).toBe('0:51');
    // 非法输入 → 回填旧值（不改变状态）
    startInput.value = '乱码';
    startInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(startInput.value).toBe('0:51');
    // 剪辑范围保存（非全选）→ start/end 落库
    (document.getElementById('lit-add-save') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-taskcard').length).toBe(1));
    let tasks = await KnowledgeData.loadTasks();
    expect(tasks[0].start).toBe('0:51');
    expect(tasks[0].end).toBe('5:00');
    // 编辑态回显 + 「整片」重置 → 保存落 null
    ui.showAddDialog(tasks[0]);
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-add-start') as HTMLInputElement).value).toBe('0:51');
    (document.getElementById('lit-add-whole') as HTMLElement).click();
    expect((document.getElementById('lit-add-start') as HTMLInputElement).value).toBe('0:00');
    expect((document.getElementById('lit-add-end') as HTMLInputElement).value).toBe('5:00');
    (document.getElementById('lit-add-save') as HTMLElement).click();
    await vi.waitFor(async () => {
      tasks = await KnowledgeData.loadTasks();
      expect(tasks[0].start).toBeNull();
    });
    expect(tasks[0].end).toBeNull();
  });

  it('解析式录入（ADR-0133）：净化写回 + 只读信息区；改动输入作废旧信息；失败进失败态可手填', async () => {
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    let failMode = false;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (failMode) return httpResp(500, '');
      if (url.includes('web-interface/view')) {
        return httpResp(200, JSON.stringify({ code: 0, data: {
          title: '解析出的标题', owner: { mid: 1, name: '解析UP' }, duration: 300,
          pages: [{ cid: 9, page: 1, part: '', duration: 300 }],
        } }));
      }
      return httpResp(404, '');
    });
    try {
      ui.showVideoEntry();
      (document.getElementById('lit-btn-video-add') as HTMLElement).click();
      const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
      urlInput.value = 'https://www.bilibili.com/video/BV1awbg6XELn/?spm_id_from=333.0&vd_source=abc';
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('解析出的标题'));
      expect(urlInput.value).toBe('https://www.bilibili.com/video/BV1awbg6XELn/'); // 追踪参数已剥
      expect(document.getElementById('lit-add-iuploader')!.textContent).toBe('解析UP');
      // 改动输入 → 作废已解析信息（需重新解析）
      urlInput.value = 'https://www.bilibili.com/video/BV1otheraaaa';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(document.getElementById('lit-add-info')!.style.display).toBe('none');
      expect(document.getElementById('lit-add-rstate')!.style.display).toBe('none');
      // 解析失败 → 失败态（原因 + 可手填分P 数字框）
      failMode = true;
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(document.getElementById('lit-add-rstate')!.textContent).toContain('解析失败'));
      expect(document.getElementById('lit-add-pagenum-row')!.style.display).not.toBe('none');
      expect(document.getElementById('lit-add-page-row')!.style.display).toBe('none');
      // 失败态可保存（标题/UP 留空，卡片回落显示链接）
      (document.getElementById('lit-add-save') as HTMLElement).click();
      await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-taskcard').length).toBe(1));
      const tasks = await KnowledgeData.loadTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBeNull();
      expect(tasks[0].url).toBe('https://www.bilibili.com/video/BV1otheraaaa');
    } finally {
      reqMock.mockImplementation(async () => httpResp(200, ''));
    }
  });

  it('解析序列号（ADR-0133）：过期响应不回填/不渲染，新解析照常；关弹窗后迟到响应丢弃', async () => {
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    const pending: Array<(v: any) => void> = [];
    reqMock.mockImplementation((opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return new Promise<any>((res) => { pending.push(res); });
      return Promise.resolve(httpResp(404, ''));
    });
    try {
      ui.showVideoEntry();
      (document.getElementById('lit-btn-video-add') as HTMLElement).click();
      const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
      urlInput.value = 'https://www.bilibili.com/video/BV1aaaaaaaaa/';
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(pending.length).toBe(1));
      // 改输入（input：在途解析作废、按钮恢复可用）→ 重新解析
      urlInput.value = 'https://www.bilibili.com/video/BV1bbbbbbbbb/';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(pending.length).toBe(2));
      pending[0](httpResp(200, JSON.stringify({ code: 0, data: { title: '过期标题', owner: { name: '过期UP' }, duration: 10 } })));
      await new Promise((r) => setTimeout(r, 0));
      expect(document.getElementById('lit-add-ititle')!.textContent).not.toBe('过期标题'); // 旧响应被丢弃
      pending[1](httpResp(200, JSON.stringify({ code: 0, data: { title: '新鲜标题', owner: { name: '新鲜UP' }, duration: 10 } })));
      await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('新鲜标题'));
      // 再起在途解析后关弹窗：序列失效——迟到响应不得写进已隐藏弹层
      urlInput.value = 'https://www.bilibili.com/video/BV1ccccccccc/';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(pending.length).toBe(3));
      ui.hideAddDialog();
      pending[2](httpResp(200, JSON.stringify({ code: 0, data: { title: '迟到标题', owner: { name: '迟到UP' }, duration: 10 } })));
      await new Promise((r) => setTimeout(r, 0));
      expect(document.getElementById('lit-add-ititle')!.textContent).not.toBe('迟到标题');
    } finally {
      reqMock.mockImplementation(async () => httpResp(200, ''));
    }
  });

  it('粘贴后立即保存仍写净化 URL（ADR-0133：保存兜底，未解析也可存）', async () => {
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://www.bilibili.com/video/BV1saveaaaaa/?spm_id_from=7&vd_source=x';
    // 不点解析、不等任何防抖，直接保存
    (document.getElementById('lit-add-save') as HTMLElement).click();
    await vi.waitFor(async () => {
      const tasks = await KnowledgeData.loadTasks();
      expect(tasks).toHaveLength(1);
    });
    const tasks = await KnowledgeData.loadTasks();
    expect(tasks[0].url).toBe('https://www.bilibili.com/video/BV1saveaaaaa/'); // 落库即净化值
  });

  it('清晰度下拉（ADR-0133）：无实测档位 → 固定三项默认全局档；有实测档位 → 档位列表 + 全局档不可用回落最高可用 + 提示', async () => {
    settings.knowledgeQuality = '1080';
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: { title: 'T', owner: { name: 'U' }, duration: 100, pages: [{ cid: 1, page: 1, part: '', duration: 100 }] } }));
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: true } }));
      if (url.includes('player/playurl')) return httpResp(200, JSON.stringify({ code: 0, data: { dash: { video: [{ height: 720 }, { height: 480 }] } } }));
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const sel = document.getElementById('lit-add-quality') as HTMLSelectElement;
    // 未解析（无实测档位）→ 固定三项 + 默认全局档
    expect([...sel.options].map((o) => o.value)).toEqual(['highest', '1080', '720']);
    expect(sel.value).toBe('1080');
    // 配 cookie + 解析 → 实测档位替换列表；全局 1080 不可用 → 回落最高可用 720 + 提示
    settings.bilibiliCookie = 'SESSDATA=x';
    (document.getElementById('lit-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1qualityaa';
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    await vi.waitFor(() => expect([...sel.options].map((o) => o.value)).toEqual(['highest', '720', '480']));
    expect(sel.value).toBe('720');
    const hint = document.getElementById('lit-add-rhint')!;
    expect(hint.style.display).not.toBe('none');
    expect(hint.textContent).toContain('720P');
  });

  it('打开面板自动重抓（ADR-0133）：缺标题任务补信息落库、不自动处理；已尝试的 id 会话内不重复请求', async () => {
    await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1backfilla' });
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: { title: '补回的标题', owner: { name: '补回的UP' }, duration: 88, pages: [{ cid: 5, page: 1, part: '', duration: 88 }] } }));
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    await vi.waitFor(async () => {
      const tasks = await KnowledgeData.loadTasks();
      expect(tasks[0].title).toBe('补回的标题');
    });
    const tasks = await KnowledgeData.loadTasks();
    expect(tasks[0].uploader).toBe('补回的UP');
    expect(tasks[0].duration).toBe(88);
    expect(tasks[0].status).toBe('pending'); // 不自动处理（ADR-0133 拍板：保存与打开面板均不触发处理）
    // 再次打开面板：已尝试过的 id 不再请求（backfillTried 会话级）
    const calls = reqMock.mock.calls.length;
    ui.hideVideo();
    ui.showVideoEntry();
    await new Promise((r) => setTimeout(r, 400));
    expect(reqMock.mock.calls.length).toBe(calls);
  });

  it('存量短链任务（ADR-0134）：已带标题但 url 里没有 BV → 打开面板自动重抓时修成规范链接', async () => {
    await KnowledgeData.addTask({ url: 'https://b23.tv/AtDgBVH', title: '已有标题' });
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.startsWith('https://b23.tv/')) return httpResp(200, LANDING_HTML);
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: {
        bvid: 'BV1shortlink', title: '落地页标题', owner: { name: '央视频' }, duration: 100,
        pages: [{ cid: 11, page: 1, part: '', duration: 100 }],
      } }));
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    await vi.waitFor(async () => {
      const t = (await KnowledgeData.loadTasks())[0];
      expect(t.url).toBe('https://www.bilibili.com/video/BV1shortlink/');
    });
    const t = (await KnowledgeData.loadTasks())[0];
    expect(t.title).toBe('已有标题'); // 只补缺失：已有标题不被覆盖
    expect(t.uploader).toBe('央视频');
    expect(t.status).toBe('pending'); // 修链接不触发处理
  });

  it('切 P（ADR-0133）：量程随该 P 重置为全选；档位重查过 nav 门禁；未登录清档回落固定列表', async () => {
    settings.bilibiliCookie = 'SESSDATA=x';
    settings.knowledgeQuality = 'highest';
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    let loggedIn = true;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: { title: 'T', owner: { name: 'U' }, duration: 300, pages: [
        { cid: 11, page: 1, part: 'A', duration: 120 },
        { cid: 12, page: 2, part: 'B', duration: 180 },
      ] } }));
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: loggedIn } }));
      if (url.includes('player/playurl')) return httpResp(200, JSON.stringify({ code: 0, data: { dash: { video: [{ height: 1080 }, { height: 480 }] } } }));
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    (document.getElementById('lit-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1switchpaa';
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    const sel = document.getElementById('lit-add-quality') as HTMLSelectElement;
    await vi.waitFor(() => expect([...sel.options].map((o) => o.value)).toEqual(['highest', '1080', '480']));
    // 切 P2：量程随该 P 重置为全选（180s = 3:00）
    const pageSel = document.getElementById('lit-add-page') as HTMLSelectElement;
    pageSel.value = '2';
    pageSel.dispatchEvent(new Event('change', { bubbles: true }));
    expect((document.getElementById('lit-add-end') as HTMLInputElement).value).toBe('3:00');
    expect((document.getElementById('lit-add-start') as HTMLInputElement).value).toBe('0:00');
    // 登录态失效后切回 P1：清档回落固定列表（不留 P2 的实测档位当真）
    loggedIn = false;
    pageSel.value = '1';
    pageSel.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect([...sel.options].map((o) => o.value)).toEqual(['highest', '1080', '720']));
  });

  it('编辑态自动重抓（ADR-0133）：打开弹窗即抓取并落库（只补缺失、范围不动）', async () => {
    const t = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1editaaaaa' });
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: { title: '编辑补回标题', owner: { name: '编辑补回UP' }, duration: 90, pages: [{ cid: 3, page: 1, part: '', duration: 90 }] } }));
      return httpResp(404, '');
    });
    ui.showAddDialog(t);
    await vi.waitFor(async () => {
      const tasks = await KnowledgeData.loadTasks();
      expect(tasks[0].title).toBe('编辑补回标题');
    });
    const tasks = await KnowledgeData.loadTasks();
    expect(tasks[0].uploader).toBe('编辑补回UP');
    expect(tasks[0].duration).toBe(90);
    expect(tasks[0].start).toBeNull(); // 结果落库不写范围（保留任务原值/用户编辑）
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

  // ==================== 术语面板（142/155 契约 + 258 完整词典皮） ====================

  it('术语面板完整版契约：词典皮标题栏（✕ 退役 issue 271）/ 术语来源同款行内标签（无说明行无试试）；预填自动生成 + 属性卡内容卡', async () => {
    ui.showTermEntry('松果体');
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('松果体'));
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-term-popup')!;
    // 词典皮：衬线标题栏（✕ 已退役 issue 271）；术语/来源同款行内标签（快改批：统一排版，试试示例与说明行已删）
    expect(popup.querySelector('.bz-lit-sheet-title')!.textContent).toBe('文字录入 · 术语');
    expect(popup.querySelector('[data-term-close]')).toBeNull();
    const labels = Array.from(popup.querySelectorAll<HTMLElement>('.bz-lit-term-row .bz-lit-term-meta-k')).map((x) => x.textContent);
    expect(labels).toEqual(['术语', '来源']);
    expect(popup.querySelector('label')).toBeNull();
    expect((document.getElementById('lit-term-input') as HTMLInputElement).placeholder).toBe('');
    expect(popup.querySelector('.bz-lit-term-note')).toBeNull();
    expect(popup.querySelector('#lit-term-cancel')).toBeTruthy();
    expect(popup.querySelector('#lit-term-try')).toBeNull();
    // 预览属性卡 + 内容卡
    expect(popup.querySelector('#lit-term-meta-term')!.textContent).toBe('松果体');
    expect(popup.querySelector('#lit-term-meta-domain')!.textContent).toBe('心理');
    expect(popup.querySelector('#lit-term-content')!.textContent).toBe('AI 简介');
    // 点遮罩与 取消 都能关弹层（issue 271：✕ 退役）
    (document.getElementById('knowledge-term-mask') as HTMLElement).click();
    expect(popup.style.display).toBe('none');
    ui.showTermEntry();
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    (document.getElementById('lit-term-cancel') as HTMLElement).click();
    expect(popup.style.display).toBe('none');
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
    // ADR-0116：未填来源 → source 显式 null（数据契约），键不落盘由 note-gen 层保证
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({ term: '褪黑素', summary: 'AI 简介', domain: '心理', source: null });
    expect(openFile).toHaveBeenCalled();
    await vi.waitFor(() => expect(seen).toEqual(['褪黑素']));
  });

  // ==================== 术语来源（ADR-0116） ====================

  it('来源行 UI + kb 作用域：术语/添加弹层挂 .kb（纸墨皮背景修复）；URL 回车 → 外部 chip + meta 第 4 行 + 落 source', async () => {
    const termPopup = document.getElementById('knowledge-term-popup')!;
    const addPopup = document.getElementById('knowledge-add-popup')!;
    // issue 257：术语/添加弹层缺 .kb（纸墨皮变量作用域）→ var(--panel) 失效背景透明；历史/视频窗本就有 kb
    expect(termPopup.classList.contains('kb')).toBe(true);
    expect(addPopup.classList.contains('kb')).toBe(true);
    expect(document.getElementById('knowledge-video-popup')!.classList.contains('kb')).toBe(true);
    ui.showTermEntry();
    await vi.waitFor(() => expect(termPopup.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '心流';
    const srcInput = document.getElementById('lit-term-src') as HTMLInputElement;
    srcInput.value = 'https://b23.tv/abcDEF，'; // 粘贴常带中文标点——净化在落库前
    srcInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const chip = document.getElementById('lit-term-src-chip')!;
    expect(chip.style.display).toBe('inline-flex');
    expect(chip.textContent).toContain('外 部');
    expect(chip.textContent).toContain('b23.tv/abcDEF');
    expect(srcInput.style.display).toBe('none'); // 输入框让位给 chip
    await (ui as any).onTermGenerate();
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    // 属性卡第 4 行「来源」：URL 已净化尾标点
    expect(document.getElementById('lit-term-meta-srcrow')!.style.display).not.toBe('none');
    expect(document.getElementById('lit-term-meta-src')!.textContent).toBe('https://b23.tv/abcDEF');
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalled());
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({
      term: '心流', summary: 'AI 简介', domain: '心理',
      source: { kind: 'external', url: 'https://b23.tv/abcDEF' },
    });
  });

  it('来源链接净化：B 站追踪参数剥除（spm_id_from/vd_source），chip/属性卡/落库均为干净 URL（issue 257 补记）', async () => {
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '心流';
    const srcInput = document.getElementById('lit-term-src') as HTMLInputElement;
    srcInput.value = 'https://www.bilibili.com/video/BV1awbg6XELn/?spm_id_from=333.1391.0.0&vd_source=15205b8944be621a94fb0bf0efdb81f3';
    srcInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const chip = document.getElementById('lit-term-src-chip')!;
    expect(chip.style.display).toBe('inline-flex');
    expect(chip.title).toBe('https://www.bilibili.com/video/BV1awbg6XELn/');
    expect(chip.textContent).toContain('BV1awbg6XELn');
    await (ui as any).onTermGenerate();
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    expect(document.getElementById('lit-term-meta-src')!.textContent).toBe('https://www.bilibili.com/video/BV1awbg6XELn/');
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalled());
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({
      term: '心流', summary: 'AI 简介', domain: '心理',
      source: { kind: 'external', url: 'https://www.bilibili.com/video/BV1awbg6XELn/' },
    });
  });

  it('来源=内部笔记：搜索联想点选 → 「内 部」chip（title 存全路径）；✕ 清除还原输入框', async () => {
    vault.files.set('我的/心流体验.md', '正文');
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    const srcInput = document.getElementById('lit-term-src') as HTMLInputElement;
    srcInput.value = '心流';
    srcInput.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-popover-item')).toBeTruthy());
    const hit = Array.from(document.querySelectorAll<HTMLElement>('.bz-popover-item')).find((b) => b.textContent!.includes('心流体验'));
    expect(hit).toBeTruthy();
    hit!.click();
    const chip = document.getElementById('lit-term-src-chip')!;
    expect(chip.style.display).toBe('inline-flex');
    expect(chip.textContent).toContain('内 部');
    expect(chip.textContent).toContain('心流体验');
    expect(chip.title).toBe('我的/心流体验.md');
    (chip.querySelector('[data-term-src-clear]') as HTMLElement).click();
    expect(document.getElementById('lit-term-src-chip')!.style.display).toBe('none');
    expect(srcInput.style.display).not.toBe('none');
    expect(srcInput.value).toBe('');
  });

  it('命令入口预填：showTermEntry 带内部来源 → chip 即现 + 自动生成后 meta 行展示 + 落 source note', async () => {
    ui.showTermEntry('松果体', { kind: 'note', path: '我的/心流体验.md' });
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    const chip = document.getElementById('lit-term-src-chip')!;
    expect(chip.style.display).toBe('inline-flex');
    expect(chip.textContent).toContain('内 部');
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    expect(document.getElementById('lit-term-meta-src')!.textContent).toBe('心流体验');
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalled());
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({
      term: '松果体', summary: 'AI 简介', domain: '心理',
      source: { kind: 'note', path: '我的/心流体验.md' },
    });
    // 关闭后再开（按钮入口无来源）→ 来源清空，不复带上次
    ui.hideTermEntry();
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    expect(document.getElementById('lit-term-src-chip')!.style.display).toBe('none');
  });

  it('部壹预览：术语外部来源出可点「来源」（标题优先、openUrl 打开）；内部来源不在部壹预览展示', async () => {
    vault.files.set('文献盒/心流B.md', '---\ntitle: "心流B"\ntype: term\ndomain: "心理"\ndate: "2026-08-30 10:00:00"\nsource: "https://zhuanlan.zhihu.com/p/123"\nsourceTitle: "什么是心流"\n---\n\n正文一段。');
    vault.files.set('文献盒/术语C.md', '---\ntitle: "术语C"\ntype: term\ndomain: "数学"\ndate: "2026-08-30 10:00:00"\nsource: "[[我的/心流体验.md|心流体验]]"\n---\n\n正文。');
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow').length).toBe(2));
    // 内部来源笔记：预览不展示来源块
    const rowC = Array.from(document.querySelectorAll<HTMLElement>('.bz-kb-lexrow')).find((r) => r.textContent!.includes('术语C'))!;
    rowC.click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-ovl')!).toBeTruthy());
    expect(document.querySelector('.bz-kb-sheet')!.querySelector('[data-lit-src-url]')).toBeNull();
    (document.querySelector('.bz-kb-ovl') as HTMLElement).click(); // issue 271：点遮罩关
    // 外部来源：可点链接（标题优先显示）
    const rowB = Array.from(document.querySelectorAll<HTMLElement>('.bz-kb-lexrow')).find((r) => r.textContent!.includes('心流B'))!;
    rowB.click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-sheet')!.querySelector('[data-lit-src-url]')).toBeTruthy());
    const link = document.querySelector('[data-lit-src-url]') as HTMLAnchorElement;
    expect(link.dataset.litSrcUrl).toBe('https://zhuanlan.zhihu.com/p/123');
    expect(link.textContent).toBe('什么是心流'); // 标题优先于 URL
    link.click();
    await vi.waitFor(() => expect(app.openUrl).toHaveBeenCalledWith('https://zhuanlan.zhihu.com/p/123'));
  });

  // ==================== 移动端主窗全屏（ADR-0116） ====================

  it('移动端：主窗挂 bz-panel-mtop 真全屏 + 头栏 ✕ 关闭出口（点 ✕ → hideMain）；桌面不渲染 ✕', async () => {
    const deskPopup = document.getElementById('knowledge-popup')!;
    expect(deskPopup.classList.contains('bz-panel-mtop')).toBe(false);
    expect(deskPopup.querySelector('.bz-kb-mclose')).toBeNull(); // 桌面态无 ✕
    ui.destroy();
    (Platform as any).isMobile = true;
    ui = new UIManager(app);
    const popup = document.getElementById('knowledge-popup')!;
    expect(popup.classList.contains('bz-panel-mtop')).toBe(true);
    ui.showMain();
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    const close = popup.querySelector<HTMLElement>('.bz-kb-mclose')!;
    expect(close).toBeTruthy();
    close.click();
    expect(popup.style.display).toBe('none');
    (Platform as any).isMobile = false;
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

  // ==================== issue 291：确认框随纸墨皮 ====================

  it('三处确认框都传 className: kb bz-kb-flow-dialog（中止批量 / 删除任务 / 清空历史）', async () => {
    // 本文件把 src/core/flow-dialog mock 掉了（无真实 popup DOM），故这里断言调用通道的
    // className 实参（漏传即回归）；popup.classList 与样式规则由 tests/knowledge/skin.test.ts
    // 的源文本断言覆盖。
    const flow = openFlowDialog as unknown as ReturnType<typeof vi.fn>;
    flow.mockClear();

    (BatchRunner as any).running = true;
    await (ui as any).onAbortBatch();
    (BatchRunner as any).running = false;
    await (ui as any).confirmDelete({ id: 'task-x' });
    await (ui as any).confirmClearHistory();

    expect(flow).toHaveBeenCalledTimes(3);
    for (const call of flow.mock.calls) {
      // 'kb' = 纸墨变量作用域（弹窗挂 body 后 var(--panel) 失效即透明底，issue 257 事故）
      expect(call[0]).toMatchObject({ className: 'kb bz-kb-flow-dialog' });
      // 主干契约不破：双动作结构（含 danger 标记）不因皮肤类改动
      expect(call[0].actions).toHaveLength(2);
    }
  });
});

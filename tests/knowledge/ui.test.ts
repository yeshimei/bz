/**
 * 知识盒（knowledge 域）UI 测试 · ADR-0112 三部重构（原型为唯一真理）：
 * - 主壳：词典头（知识盒 + 三部切换）/ 部壹录入入口与文献词典行 / 预览（全文段落+related+提炼成卡）/
 *   提炼成卡（源链+领域自动带、连一张旧卡、为什么相关、落卡写卡片盒+源文献互链）/ 部贰卡片列表 /
 *   部叁主题展示（列表 + 只读渲染）。
 * - 视频录入面板：按钮组、单钮态机、添加弹窗校验/入库、行内时间线（STEP_DONE_MAP + 百分比仅下载）、历史分组与清空。
 * - 术语面板（ticket 142/155 契约 + issue 309 同壳双态）：简洁版结构、预填自动生成、确认写入
 *   （落盘 + 域事件 + 关联行）、无预览提示；段落录入（多行 → AI 自动标题 → type: passage）。
 * - 关联行（issue 309）：**生成出内容即**经 core/link-now 通道起跑关联预演（只算不写），
 *   loading → 完成后就地显示；确认写入只把预演结果落库（不重跑检索与裁判）；
 *   通道未注入（自动双链关闭）时显式呈现「自动双链未开启」。
 * - ESC 分层、设置 schema 五组（含卡片/主题目录新键 + ADR-0141 的「自动关联」组）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Platform, requestUrl } from 'obsidian';
import { UIManager, knowledgeSettingsSchema } from '../../src/knowledge/ui';
import { KnowledgeData } from '../../src/knowledge/data';
import { parseBvid } from '../../src/knowledge/video-meta';
import { BatchRunner } from '../../src/knowledge/processor';
import { openFlowDialog } from '../../src/core/flow-dialog'; // issue 291 断言用（本文件已 vi.mock 为 spy）
import { setLinkBridge } from '../../src/core/link-now';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { onDomainEvent } from '../../src/core/domain-bus';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, getNoticeMessages, mockMarkdownRenderer, resetObsidianMocks } from '../mock-obsidian-entry';

const noteGen = vi.hoisted(() => ({
  generateTermNote: vi.fn(),
  generateTermDraft: vi.fn(),
  generatePassageNote: vi.fn(),
  generatePassageDraft: vi.fn(),
  generateImageNote: vi.fn(),
  generateImageDraft: vi.fn(),
  resolveImageDir: vi.fn(() => '文献盒/assets'),
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
    noteGen.generatePassageNote.mockReset();
    noteGen.generatePassageDraft.mockReset();
    noteGen.generateImageNote.mockReset();
    noteGen.generateImageDraft.mockReset();
    noteGen.summarizeTermSummary.mockReset();
    noteGen.backfillNotes.mockReset();
    noteGen.generateTermDraft.mockResolvedValue({ summary: 'AI 简介', domain: '心理' });
    noteGen.summarizeTermSummary.mockResolvedValue('精简版简介');
    noteGen.generateTermNote.mockResolvedValue('文献盒/松果体.md');
    noteGen.generatePassageDraft.mockResolvedValue({ title: '自动标题', summary: '整理正文', domain: '社会' });
    noteGen.generatePassageNote.mockResolvedValue('文献盒/自动标题.md');
    noteGen.generateImageDraft.mockResolvedValue({ title: '自动图题', summary: '读图解读', domain: '艺术' });
    noteGen.generateImageNote.mockResolvedValue('文献盒/自动图题.md');
    noteGen.backfillNotes.mockResolvedValue({ scanned: 0, filled: 0, aiSkipped: false });
    (BatchRunner as any).running = false;
    ui = new UIManager(app);
  });

  afterEach(() => {
    setLinkBridge(null); // 关联行通道是模块级单例：用例间不串
    ui.destroy();
    (Platform as any).isMobile = false;
    document.body.innerHTML = '';
  });

  // ==================== 主壳 ====================

  it('showMain 渲染三部壳：词典头「知识盒」+ 三部按钮 + 部壹四种录入入口（名词 / 段落 / 图版 / 影像）', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.getElementById('knowledge-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-popup')!;
    expect(popup.querySelector('.bz-kb-title')!.textContent).toBe('知 识 盒');
    const parts = Array.from(popup.querySelectorAll<HTMLElement>('.bz-kb-part')).map((b) => b.textContent);
    expect(parts).toEqual(['部壹 · 文献', '部贰 · 卡片', '部叁 · 主题']);
    // issue 309/312/313：入口名收成简单名词（名词 / 段落 / 图版 / 影像——图版排在影像之前，2026-09-14 复核改序），
    // 入口下不再带灰色说明小字
    const entries = Array.from(popup.querySelectorAll<HTMLElement>('.bz-kb-entrybtn b')).map((b) => b.textContent);
    expect(entries).toEqual(['名词', '段落', '图版', '影像']);
    expect(popup.querySelectorAll('.bz-kb-entrybtn span').length).toBe(0);
    const acts = Array.from(popup.querySelectorAll<HTMLElement>('.bz-kb-entrybtn')).map((b) => b.getAttribute('data-kb-act'));
    expect(acts).toEqual(['term-entry', 'passage-entry', 'image-entry', 'video-entry']);
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

  it('录入入口：名词面板 / 影像直达录入界面（issue 310：不再先落处理队列）', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelector('[data-kb-act=term-entry]')).toBeTruthy());
    (document.querySelector('[data-kb-act=term-entry]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    ui.hideTermEntry();
    (document.querySelector('[data-kb-act=video-entry]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
    expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('none'); // 处理队列不再自动叠开
  });

  // ==================== 视频录入 ====================

  it('影像处理面板：词典头（题字「影 像」）+ 新增/批量/历史 图标钮（✕ 退役 issue 271；emoji 退役 issue 310）；单钮态机（空队列禁用；运行换停止图标）；行内时间线（STEP_DONE_MAP + 百分比仅下载）', async () => {
    ui.showVideoTasks();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-video-popup')!;
    expect(popup.querySelector('.bz-kb-title')!.textContent!.replace(/\s/g, '')).toBe('影像');
    expect(popup.querySelector('.bz-kb-head')).toBeTruthy(); // 与主窗同一套词典头（issue 310）
    expect(popup.querySelector('#lit-btn-video-add')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-run')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-history')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-close')).toBeNull(); // issue 271：✕ 退役
    // 头部左右分工（2026-09-14 复核）：左列状态计数、右列图标组（两者原先相反）
    const head = popup.querySelector('.bz-kb-head')!;
    expect(head.children[0].id).toBe('lit-video-counts');
    expect(head.children[head.children.length - 1].className).toBe('bz-lit-head-btns');
    expect((document.getElementById('lit-btn-video-back') as HTMLElement).style.display).toBe('none'); // 处理视图无返回钮
    // 图标化（issue 310）：三个钮里是 lucide 图标 span（mock 记 data-icon），正文不再有 emoji 字形
    expect(popup.querySelector('#lit-btn-video-add .bz-ic')!.getAttribute('data-icon')).toBe('plus');
    expect(popup.querySelector('#lit-btn-video-history .bz-ic')!.getAttribute('data-icon')).toBe('history');
    expect(popup.querySelector('#lit-btn-video-run .bz-ic')!.getAttribute('data-icon')).toBe('play');
    expect(/[➕▶⏹🕘⌛⏳📄⏱]/.test(popup.textContent || '')).toBe(false);
    await vi.waitFor(() => expect((popup.querySelector('#lit-btn-video-run') as HTMLButtonElement).disabled).toBe(true));
    const t = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1abc', start: '00:00:10', end: '00:00:30' });
    await KnowledgeData.updateTask(t.id, { status: 'processing' });
    (ui as any).runState.set(t.id, { steps: ['解析视频信息', '下载视频', 'AI 生成文献笔记中', '笔记落盘中'], phase: 'download', pct: 42, startAt: Date.now() });
    await ui.refreshVideoPanel();
    expect(popup.querySelector('#lit-video-counts')!.textContent).toBe('1 处理中'); // 左列状态计数（2026-09-14 复核换到左侧）
    (ui as any).updateRowProgress(t.id);
    const card = popup.querySelector('.bz-kb-taskcard')!;
    expect(card.querySelector('.bz-kb-status')!.textContent).toBe('处理中');
    expect(card.querySelector('.bz-kb-step-done')!.textContent).toBe('✓ 已解析视频信息');
    expect(card.querySelector('.bz-kb-step-cur')!.textContent).toBe('笔记落盘中');
    expect(card.textContent).toContain('✓ 已生成文献笔记');
    expect(card.querySelector('.bz-kb-step-pct')!.textContent).toBe('42%');
    expect(card.querySelector('.bz-kb-progress-track')!.innerHTML).toContain('width:42%');
    expect(card.querySelector('.bz-kb-elapsed .bz-ic')!.getAttribute('data-icon')).toBe('timer');
    (BatchRunner as any).running = true;
    await ui.refreshVideoPanel();
    const run = popup.querySelector('#lit-btn-video-run') as HTMLButtonElement;
    expect(popup.querySelector('#lit-btn-video-run .bz-ic')!.getAttribute('data-icon')).toBe('square'); // 运行中 = 停止图标
    expect(run.disabled).toBe(false);
    (BatchRunner as any).running = false;
    await ui.refreshVideoPanel();
    expect(popup.querySelector('#lit-btn-video-run .bz-ic')!.getAttribute('data-icon')).toBe('play');
  });

  it('影像录入界面（ADR-0133 + issue 310）：未解析只出链接行 → 解析后展开下半表单 → 整片保存入库（净化 URL）', async () => {
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
    ui.showVideoEntry(); // 影像入口直达录入界面（issue 310）
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-add-popup')!;
    expect(popup.querySelector('.bz-lit-sheet-title')!.textContent!.replace(/\s/g, '')).toBe('影像');
    expect(popup.querySelector('.bz-lit-term-row .bz-lit-term-meta-k')!.textContent).toBe('链接');
    // 未解析：下半表单（信息 / 分P / 剪辑 / 清晰度 / 保存）整体收起
    const more = document.getElementById('lit-add-more')!;
    expect(more.style.display).toBe('none');
    expect(more.querySelector('#lit-add-save')).toBeTruthy(); // 保存钮在下半表单内 → 未解析不可达
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://www.bilibili.com/video/BV1testaaaaa/?spm_id_from=333.0';
    expect(more.style.display).toBe('none');
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('解析出的标题'));
    expect(more.style.display).not.toBe('none'); // 解析跑完 → 展开
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
    // 保存（整片）→ 关弹窗并落到处理队列
    (document.getElementById('lit-add-save') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    await vi.waitFor(() => expect(document.querySelectorAll('#knowledge-video-list .bz-kb-taskcard').length).toBe(1));
    expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('none');
    const tasks = await KnowledgeData.loadTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].url).toBe('https://www.bilibili.com/video/BV1testaaaaa/');
    expect(tasks[0].start).toBeNull();
    expect(tasks[0].end).toBeNull();
    expect(tasks[0].title).toBe('解析出的标题');
    expect(tasks[0].uploader).toBe('解析UP');
    expect(tasks[0].duration).toBe(120);
    expect(tasks[0].page).toBeNull();
    expect(document.querySelector('#knowledge-video-list .bz-kb-taskcard')!.textContent).toContain('整片');
  });

  it('录入界面标题栏不放出口（issue 310 复核）：处理队列与历史随「保存」进入', async () => {
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-add-popup')!;
    expect(popup.querySelector('.bz-lit-head-btns')).toBeNull(); // 右上角两个钮已退役
    expect(document.getElementById('lit-add-tasks')).toBeNull();
    expect(document.getElementById('lit-add-history')).toBeNull();
    // 处理队列仍可达：保存 → 关窗 + 打开处理面板（另一个用例断言落库；此处断言窗口切换）
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: { title: 'T', owner: { name: 'U' }, duration: 60, pages: [{ cid: 1, page: 1, part: '', duration: 60 }] } }));
      return httpResp(404, '');
    });
    try {
      (document.getElementById('lit-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1notoolbar';
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(document.getElementById('lit-add-more')!.style.display).not.toBe('none'));
      (document.getElementById('lit-add-save') as HTMLElement).click();
      await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
      expect(popup.style.display).toBe('none');
    } finally {
      reqMock.mockImplementation(async () => httpResp(200, ''));
    }
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

  it('短链 bvid 兜底隔离（ADR-0134）：URL 里没有 BV 字样时，切 P 靠 meta.bvid 查档', async () => {
    settings.bilibiliCookie = 'SESSDATA=x';
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.startsWith('https://b23.tv/')) return httpResp(200, LANDING_HTML);
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: -412, message: '风控', data: null }));
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: true } }));
      if (url.includes('player/playurl')) return httpResp(200, JSON.stringify({ code: 0, data: { dash: { video: [{ height: 720 }] } } }));
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://b23.tv/AtDgBVH';
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('失语者的声音'));
    // 换回短链形态（不派发 input：addMeta 保留，模拟「写回未落 / 存量短链任务」）
    urlInput.value = 'https://b23.tv/AtDgBVH';
    expect(parseBvid(urlInput.value)).toBeNull();
    reqMock.mockClear();
    const pageSel = document.getElementById('lit-add-page') as HTMLSelectElement;
    pageSel.value = '2';
    pageSel.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(reqMock.mock.calls.some((c) => String(c[0]?.url).includes('playurl'))).toBe(true));
    const playurl = reqMock.mock.calls.map((c) => String(c[0]?.url)).find((u) => u.includes('playurl'))!;
    expect(playurl).toContain('bvid=BV1shortlink&cid=12'); // bvid 来自 meta.bvid，不是 URL
  });

  it('在途解析遇用户改输入（ADR-0134 写回保护）：迟到响应不改写输入框、不渲染信息区', async () => {
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    let release: (() => void) | null = null;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.startsWith('https://b23.tv/')) {
        await new Promise<void>((r) => { release = r; });
        return httpResp(200, LANDING_HTML);
      }
      return httpResp(404, '');
    });
    ui.showVideoEntry(); // issue 310：入口直达录入界面（不再点 ➕ 叠开）
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://b23.tv/AtDgBVH';
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    await vi.waitFor(() => expect(release).not.toBeNull());
    urlInput.value = 'https://b23.tv/OtherLink1';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    release!();
    await new Promise((r) => setTimeout(r, 60));
    expect(urlInput.value).toBe('https://b23.tv/OtherLink1'); // 迟到响应不写回
    // issue 310 重构：只读信息区挪进「解析后才展开」的 #lit-add-more 容器 ——
    // 迟到响应既不能渲染信息，也不能把下半表单展开
    expect(document.getElementById('lit-add-more')!.style.display).toBe('none');
    expect(document.getElementById('lit-add-ititle')!.textContent).not.toBe('失语者的声音');
  });

  it('切 P 档位查询带序列号判据（ADR-0134 收口）：查询期间改输入 → 迟到档位不渲染', async () => {
    settings.bilibiliCookie = 'SESSDATA=x';
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    let playCalls = 0;
    let releasePlay: (() => void) | null = null;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: {
        title: 'T', owner: { name: 'U' }, duration: 300,
        pages: [{ cid: 11, page: 1, part: 'A', duration: 120 }, { cid: 12, page: 2, part: 'B', duration: 180 }],
      } }));
      if (url.includes('web-interface/nav')) return httpResp(200, JSON.stringify({ code: 0, data: { isLogin: true } }));
      if (url.includes('player/playurl')) {
        playCalls += 1;
        if (playCalls === 3) await new Promise<void>((r) => { releasePlay = r; }); // 第三次（切回 P1）挂起
        const heights = playCalls === 1 ? [{ height: 1080 }] : [{ height: 480 }];
        return httpResp(200, JSON.stringify({ code: 0, data: { dash: { video: heights } } }));
      }
      return httpResp(404, '');
    });
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLElement).click();
    const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
    urlInput.value = 'https://www.bilibili.com/video/BV1switchpaa';
    (document.getElementById('lit-add-resolve') as HTMLElement).click();
    const sel = document.getElementById('lit-add-quality') as HTMLSelectElement;
    await vi.waitFor(() => expect([...sel.options].map((o) => o.value)).toEqual(['highest', '1080']));
    const pageSel = document.getElementById('lit-add-page') as HTMLSelectElement;
    pageSel.value = '2';
    pageSel.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect([...sel.options].map((o) => o.value)).toEqual(['highest', '480']));
    // 切回 P1（查询挂起中）→ 改输入：addPage 被重置为 1，单靠 addPage 判据拦不住这次迟到响应
    pageSel.value = '1';
    pageSel.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(releasePlay).not.toBeNull());
    urlInput.value = 'https://www.bilibili.com/video/BV1otherlink';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    releasePlay!();
    await new Promise((r) => setTimeout(r, 60));
    expect([...sel.options].map((o) => o.value)).toEqual(['highest', '1080', '720']); // 迟到档位（480）被丢弃，回落固定列表
  });

  it('自动重抓收口（ADR-0134）：非 B 站任务与已成功的任务不纳入（不改 URL、零请求）', async () => {
    await KnowledgeData.addTask({ url: 'https://www.youtube.com/watch?v=abc', title: 'YouTube 任务' });
    await KnowledgeData.addTask({ url: 'https://b23.tv/DoneTask1', title: '已完成短链任务' });
    const seeded = await KnowledgeData.loadTasks();
    await KnowledgeData.updateTask(seeded[1].id, { status: 'success' });
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async () => httpResp(404, ''));
    reqMock.mockClear(); // 只数本用例的请求（前序用例的调用史会留着）
    ui.showVideoEntry();
    await new Promise((r) => setTimeout(r, 500));
    expect(reqMock.mock.calls.map((c) => String(c[0]?.url))).toEqual([]);
    const after = await KnowledgeData.loadTasks();
    expect(after[0].url).toBe('https://www.youtube.com/watch?v=abc');
    expect(after[1].url).toBe('https://b23.tv/DoneTask1');
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
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
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
      await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
      const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
      urlInput.value = 'https://www.bilibili.com/video/BV1awbg6XELn/?spm_id_from=333.0&vd_source=abc';
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(document.getElementById('lit-add-ititle')!.textContent).toBe('解析出的标题'));
      expect(urlInput.value).toBe('https://www.bilibili.com/video/BV1awbg6XELn/'); // 追踪参数已剥
      expect(document.getElementById('lit-add-iuploader')!.textContent).toBe('解析UP');
      // 改动输入 → 作废已解析信息（需重新解析）：下半表单整体收起（issue 310）
      urlInput.value = 'https://www.bilibili.com/video/BV1otheraaaa';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(document.getElementById('lit-add-more')!.style.display).toBe('none');
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
      await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
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

  it('未解析不可保存（issue 310 改口径）：保存钮在收起的下半表单内；解析后展开且写净化 URL', async () => {
    const reqMock = requestUrl as ReturnType<typeof vi.fn>;
    reqMock.mockImplementation(async (opts: any) => {
      const url = String(opts?.url ?? '');
      if (url.includes('web-interface/view')) return httpResp(200, JSON.stringify({ code: 0, data: { title: 'T', owner: { name: 'U' }, duration: 100, pages: [{ cid: 1, page: 1, part: '', duration: 100 }] } }));
      return httpResp(404, '');
    });
    try {
      ui.showVideoEntry();
      await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
      const urlInput = document.getElementById('lit-add-url') as HTMLInputElement;
      urlInput.value = 'https://www.bilibili.com/video/BV1saveaaaaa/?spm_id_from=7&vd_source=x';
      // 未解析：保存钮被收起的容器包住（界面上不可达——可见性由 #lit-add-more 统一控制）
      const more = document.getElementById('lit-add-more')!;
      expect(more.style.display).toBe('none');
      expect(more.contains(document.getElementById('lit-add-save'))).toBe(true);
      expect(more.contains(document.getElementById('lit-add-quality'))).toBe(true);
      // 解析 → 表单展开 + URL 净化写回；落库取净化值
      (document.getElementById('lit-add-resolve') as HTMLElement).click();
      await vi.waitFor(() => expect(document.getElementById('lit-add-more')!.style.display).not.toBe('none'));
      expect(urlInput.value).toBe('https://www.bilibili.com/video/BV1saveaaaaa/');
      (document.getElementById('lit-add-save') as HTMLElement).click();
      await vi.waitFor(async () => {
        const tasks = await KnowledgeData.loadTasks();
        expect(tasks).toHaveLength(1);
      });
      const tasks = await KnowledgeData.loadTasks();
      expect(tasks[0].url).toBe('https://www.bilibili.com/video/BV1saveaaaaa/'); // 落库即净化值
    } finally {
      reqMock.mockImplementation(async () => httpResp(200, ''));
    }
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
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
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
    ui.showVideoTasks(); // 自动重抓挂在「处理」面板打开时（issue 310）
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
    ui.showVideoTasks();
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
    ui.showVideoTasks(); // issue 310：缺标题任务的自动重抓挂「处理」面板打开时
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
    await vi.waitFor(() => expect(document.getElementById('knowledge-add-popup')!.style.display).toBe('flex'));
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

  it('历史：面板内切换（不另开弹窗）+ 归档分组 + 计数；返回箭头回队列；清空历史（确认后清空）', async () => {
    const a = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1aaa', start: '00:00:10', end: '00:00:20', title: '视频甲', uploader: 'UP甲' });
    const a2 = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1aaa', start: '00:01:00', end: '00:01:30', title: '视频甲' });
    await KnowledgeData.updateTask(a2.id, { archived: true, processedAt: '2026-09-01 11:00:00', notePath: '文献盒/视频甲2.md' });
    await KnowledgeData.updateTask(a.id, { archived: true, processedAt: '2026-09-01 10:00:00', notePath: '文献盒/视频甲.md' });
    const b = await KnowledgeData.addTask({ url: 'https://www.bilibili.com/video/BV1bbb', title: '视频乙' });
    await KnowledgeData.updateTask(b.id, { archived: true, processedAt: '2026-09-02 10:00:00', notePath: '文献盒/视频乙.md' });
    ui.showVideoTasks();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-video-popup')!;
    (document.getElementById('lit-btn-video-history') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-video-counts')!.textContent).toContain('共 3 条'));
    // 2026-09-14 复核：历史进同一面板（无独立历史窗），题字换「历 史」、图标组只留返回箭头
    expect(document.getElementById('knowledge-history-popup')).toBeNull();
    expect(popup.querySelector('.bz-kb-title')!.textContent!.replace(/\s/g, '')).toBe('历史');
    expect((document.getElementById('lit-btn-video-add') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('lit-btn-video-run') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('lit-btn-video-history') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('lit-btn-video-back') as HTMLElement).style.display).not.toBe('none');
    expect(document.querySelectorAll('#knowledge-video-list .bz-kb-hgroup').length).toBe(2);
    expect(document.querySelectorAll('#knowledge-video-list .bz-kb-hnote').length).toBe(3);
    expect(document.getElementById('knowledge-video-list')!.textContent).toContain('视频甲');
    // 返回箭头 → 回到任务队列视图（题字与图标组复位，计数换回状态口径）
    (document.getElementById('lit-btn-video-back') as HTMLElement).click();
    await vi.waitFor(() => expect(popup.querySelector('.bz-kb-title')!.textContent!.replace(/\s/g, '')).toBe('影像'));
    expect((document.getElementById('lit-btn-video-back') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('lit-btn-video-history') as HTMLElement).style.display).not.toBe('none');
    // 清空历史后视图内计数归零
    (document.getElementById('lit-btn-video-history') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-video-counts')!.textContent).toContain('共 3 条'));
    const schema = knowledgeSettingsSchema({ onClearHistory: async () => { await KnowledgeData.clearHistory(); await ui.refreshVideoPanel(); } });
    const row = schema.groups.flatMap((g) => g.rows).find((r) => (r as any).name === '清空历史') as any;
    await row.onClick();
    await vi.waitFor(() => expect(document.getElementById('lit-video-counts')!.textContent).toContain('共 0 条'));
  });

  // ==================== 术语面板（142/155 契约 + 258 完整词典皮） ====================

  it('术语面板完整版契约：词典皮标题栏（✕ 退役 issue 271）/ 术语来源同款行内标签（无说明行无试试）；预填自动生成 + 属性卡内容卡', async () => {
    ui.showTermEntry('松果体');
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('松果体'));
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    const popup = document.getElementById('knowledge-term-popup')!;
    // 词典皮：衬线标题栏（✕ 已退役 issue 271）；术语/来源同款行内标签（快改批：统一排版，试试示例与说明行已删）
    expect(popup.querySelector('.bz-lit-sheet-title')!.textContent).toBe('名词');
    expect(popup.getAttribute('data-lit-entry')).toBe('term'); // 同壳双态（issue 309）
    expect(popup.querySelector('[data-term-close]')).toBeNull();
    // 同壳双态：两条录入行同壳共存（名词态由 .bz-lit-passage-only 隐藏）——DOM 上三行标签齐备
    const labels = Array.from(popup.querySelectorAll<HTMLElement>('.bz-lit-term-row .bz-lit-term-meta-k')).map((x) => x.textContent);
    expect(labels).toEqual(['名词', '段落', '图版', '来源']); // 三类录入行同壳共存（非当前态由 data-lit-entry 隐藏）
    expect(popup.querySelector('label')).toBeNull();
    expect((document.getElementById('lit-term-input') as HTMLInputElement).placeholder).toBe('');
    expect(popup.querySelector('.bz-lit-term-note')).toBeNull();
    // issue 309 复核：取消按钮与「打开笔记」按钮均退役（退出走点遮罩 / ESC，写入即关窗）
    expect(popup.querySelector('#lit-term-cancel')).toBeNull();
    expect(popup.querySelector('#lit-term-open')).toBeNull();
    expect(popup.querySelector('#lit-term-try')).toBeNull();
    // 预览属性卡 + 内容卡
    expect(popup.querySelector('#lit-term-meta-term')!.textContent).toBe('松果体');
    expect(popup.querySelector('#lit-term-meta-domain')!.textContent).toBe('心理');
    expect(popup.querySelector('#lit-term-content')!.textContent).toBe('AI 简介');
    // 退出只剩两条道：点遮罩、ESC（✕ / 取消按钮都退役）
    (document.getElementById('knowledge-term-mask') as HTMLElement).click();
    expect(popup.style.display).toBe('none');
    ui.showTermEntry();
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    ui.hideTermEntry();
    expect(popup.style.display).toBe('none');
  });

  it('确认写入：按预览值落盘一次 + term-generated 事件 + 关联落库后直接关窗', async () => {
    const seen: string[] = [];
    const applies: Array<[string, string[]]> = [];
    setLinkBridge({
      backfill: async () => ({ status: 'done' as const, processed: 0, created: 0 }),
      preview: async () => ({ status: 'done' as const, picks: [{ path: '卡片盒/睡眠卫生.md', title: '睡眠卫生' }] }),
      apply: async (path: string, picks: string[]) => { applies.push([path, picks]); return { status: 'done' as const, created: picks.length }; },
      now: async () => ({ status: 'done' as const, created: 0 }),
    });
    noteGen.generateTermNote.mockResolvedValueOnce('文献盒/松果体.md');
    onDomainEvent('knowledge:tasks', (evt: any) => { if (evt.kind === 'term-generated') seen.push(evt.term); });
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '褪黑素';
    (document.getElementById('lit-term-save') as HTMLElement).click();
    expect(getNoticeMessages().join('\\n')).toContain('请先点击「生成」');
    await (ui as any).onTermGenerate();
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalled());
    // ADR-0116：未填来源 → source 显式 null（数据契约），键不落盘由 note-gen 层保证
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({ term: '褪黑素', summary: 'AI 简介', domain: '心理', source: null });
    await vi.waitFor(() => expect(seen).toEqual(['褪黑素']));
    // issue 309 复核：预演结果随写入落库（apply 而非重算），写完直接关窗、也不自动打开笔记
    await vi.waitFor(() => expect(applies).toEqual([['文献盒/松果体.md', ['卡片盒/睡眠卫生.md']]]));
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('none'));
    expect(openFile).not.toHaveBeenCalled();
  });

  it('通道未注入（自动双链关闭）：关联行显式「自动双链未开启」，确认写入照常落盘并关窗', async () => {
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '褪黑素';
    await (ui as any).onTermGenerate();
    expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('自动双链未开启');
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalled());
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('none'));
  });

  it('关联分析中禁用「重新生成 / 总结 / 确认写入」；总结后正文变了 → 再次重跑预演', async () => {
    const previews: string[] = [];
    const releases: Array<(v: any) => void> = [];
    setLinkBridge({
      backfill: async () => ({ status: 'done' as const, processed: 0, created: 0 }),
      preview: (content: string) => { previews.push(content); return new Promise((r) => releases.push(r)); },
      apply: async () => ({ status: 'done' as const, created: 0 }),
      now: async () => ({ status: 'done' as const, created: 0 }),
    });
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '心流';
    await (ui as any).onTermGenerate(); // 生成完即起预演（挂在 loading 上，未落地）
    const gen = document.getElementById('lit-term-generate') as HTMLButtonElement;
    const regen = document.getElementById('lit-term-regenerate') as HTMLButtonElement;
    const save = document.getElementById('lit-term-save') as HTMLButtonElement;
    expect(previews).toEqual(['AI 简介']);
    expect([gen.disabled, regen.disabled, save.disabled]).toEqual([true, true, true]); // 分析中：三个按钮全禁
    releases.shift()!({ status: 'done', picks: [] });
    await vi.waitFor(() => expect(save.disabled).toBe(false)); // 分析落地 → 恢复可用
    expect([gen.disabled, regen.disabled]).toEqual([false, false]);
    // 总结 → 正文被改写 → 关联重新分析（回到禁用态）
    await (ui as any).onTermSummarize();
    expect(previews).toEqual(['AI 简介', '精简版简介']);
    expect([gen.disabled, regen.disabled, save.disabled]).toEqual([true, true, true]);
    releases.shift()!({ status: 'done', picks: [] });
    await vi.waitFor(() => expect(save.disabled).toBe(false));
  });

  it('段落录入（issue 309）：同壳切到 passage + 多行输入 → AI 自动标题 → 按标题落 type: passage', async () => {
    const seen: Array<Record<string, unknown>> = [];
    onDomainEvent('knowledge:tasks', (evt: any) => { if (evt.kind === 'passage-generated') seen.push(evt); });
    ui.showPassageEntry();
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect(popup.getAttribute('data-lit-entry')).toBe('passage');
    expect(popup.querySelector('.bz-lit-sheet-title')!.textContent).toBe('段落');
    // 空段落拒收
    (document.getElementById('lit-term-generate') as HTMLElement).click();
    expect(getNoticeMessages().join('\n')).toContain('请粘贴要整理的段落');
    (document.getElementById('lit-passage-input') as HTMLTextAreaElement).value = '  一段关于城市化的文字。  ';
    await (ui as any).onTermGenerate();
    expect(noteGen.generatePassageDraft).toHaveBeenCalledWith('一段关于城市化的文字。'); // 首尾空白已裁
    // 标题自动填入属性卡（可改）
    expect((document.getElementById('lit-entry-meta-title') as HTMLInputElement).value).toBe('自动标题');
    // 改写标题后落盘（所见即所得：不重跑 AI）
    (document.getElementById('lit-entry-meta-title') as HTMLInputElement).value = '城市化的三种动力';
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generatePassageNote).toHaveBeenCalled());
    expect(noteGen.generatePassageNote).toHaveBeenCalledWith({
      title: '城市化的三种动力',
      summary: '整理正文',
      domain: '社会',
      source: null,
    });
    await vi.waitFor(() => expect(seen.map((e) => e.title)).toEqual(['城市化的三种动力']));
  });

  // ==================== 图版录入（issue 312；多图 issue 313） ====================

  /** 造一张可被收图链路收下的图片 File（字节内容不参与断言，只要非空 + MIME 合法） */
  function pngFile(name = 'plate.png', type = 'image/png') {
    return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, { type });
  }

  /** 造带 clipboardData 的 paste 事件（jsdom 无 DataTransfer，手挂 items/files —— 同 favorites 域做法） */
  function pasteImageEvent(files: File[]): ClipboardEvent {
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as any;
    ev.clipboardData = {
      items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
      files,
    };
    return ev as ClipboardEvent;
  }

  const thumbs = () => Array.from(document.querySelectorAll<HTMLImageElement>('#lit-image-grid .bz-lit-drop-item img'));

  it('图版录入（issue 313）：多张图同壳进面板 → 一次投给 AI → 按标题落 type: image + 图片本体全落盘', async () => {
    const seen: Array<Record<string, unknown>> = [];
    onDomainEvent('knowledge:tasks', (evt: any) => { if (evt.kind === 'image-generated') seen.push(evt); });
    ui.showImageEntry();
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    expect(popup.getAttribute('data-lit-entry')).toBe('image');
    expect(popup.querySelector('.bz-lit-sheet-title')!.textContent).toBe('图版');
    // 没图点生成 → 拒收（不发 AI）
    (document.getElementById('lit-term-generate') as HTMLElement).click();
    expect(getNoticeMessages().join('\n')).toContain('请先拖入或粘贴图片');
    expect(noteGen.generateImageDraft).not.toHaveBeenCalled();
    // 收图（拖入 / 点选 / 粘贴三路共用同一处理器；一次可进多张，也支持分次追加）
    await (ui as any).acceptImageFiles([pngFile('a.png'), pngFile('b.jpg', 'image/jpeg')]);
    expect(document.getElementById('lit-image-grid')!.style.display).not.toBe('none');
    expect(thumbs()).toHaveLength(2);
    expect(thumbs()[0].src.startsWith('data:image/png;base64,')).toBe(true);
    expect(thumbs()[1].src.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(document.getElementById('lit-image-hint')!.textContent).toContain('已放 2 张');
    await (ui as any).acceptImageFiles([pngFile('c.webp', 'image/webp')]); // 追加第三张
    expect(thumbs()).toHaveLength(3);
    // 读图：AI 拿到的是**全部** data URL；此刻一个文件都没落盘（图只在内存）
    await (ui as any).onTermGenerate();
    expect(noteGen.generateImageDraft).toHaveBeenCalledWith(thumbs().map((t) => t.src));
    expect(noteGen.generateImageNote).not.toHaveBeenCalled();
    expect((document.getElementById('lit-entry-meta-title') as HTMLInputElement).value).toBe('自动图题');
    expect(document.getElementById('lit-term-content')!.textContent).toBe('读图解读');
    expect(document.getElementById('lit-term-meta-domain')!.textContent).toBe('艺术');
    // 确认写入：三张图的本体 + 笔记一并落盘（bytes 与扩展名交给 note-gen，顺序 = 放入顺序）
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(noteGen.generateImageNote).toHaveBeenCalled());
    const arg = noteGen.generateImageNote.mock.calls[0][0];
    expect(arg.title).toBe('自动图题');
    expect(arg.summary).toBe('读图解读');
    expect(arg.domain).toBe('艺术');
    expect(arg.source).toBeNull();
    expect(arg.images.map((im: any) => im.ext)).toEqual(['png', 'jpg', 'webp']);
    expect(arg.images[0].bytes.byteLength).toBe(8);
    await vi.waitFor(() => expect(seen.map((e) => e.title)).toEqual(['自动图题']));
    // 写完直接关窗 + 内存里的图字节清掉（不留悬挂副本）
    await vi.waitFor(() => expect(popup.style.display).toBe('none'));
    expect((ui as any).entryImages).toEqual([]);
    expect(document.getElementById('lit-image-grid')!.style.display).toBe('none');
  });

  it('图版：非 PNG/JPEG/GIF/WebP 那张被跳过，其余照收；加图 / 删图都作废旧草稿', async () => {
    ui.showImageEntry();
    const popup = document.getElementById('knowledge-term-popup')!;
    await vi.waitFor(() => expect(popup.style.display).toBe('flex'));
    // 一批里混一张 svg：只跳它，合法那张照样进
    await (ui as any).acceptImageFiles([new File([new Uint8Array([1, 2])], 'a.svg', { type: 'image/svg+xml' }), pngFile('ok.png')]);
    expect(getNoticeMessages().join('\n')).toContain('只支持 PNG / JPEG / GIF / WebP 图片');
    expect(thumbs()).toHaveLength(1);
    // 生成 → 预览可见；再追加一张 → 旧草稿失效（预览收起 + 关联行归位）
    await (ui as any).onTermGenerate();
    expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex');
    expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('自动双链未开启'); // 通道未注入
    await (ui as any).acceptImageFiles([pngFile('b.jpg', 'image/jpeg')]);
    expect(document.getElementById('lit-term-preview')!.style.display).toBe('none');
    expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('—');
    expect(thumbs()).toHaveLength(2);
    // 缩略图上的 ✕：删掉第 1 张（同样作废草稿），剩下的自动补位
    await (ui as any).onTermGenerate();
    expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex');
    (document.querySelector('[data-lit-image-remove="0"]') as HTMLElement).click();
    expect(thumbs()).toHaveLength(1);
    expect(thumbs()[0].src.startsWith('data:image/jpeg;base64,')).toBe(true); // 留下的是后加的 jpg
    expect(document.getElementById('lit-term-preview')!.style.display).toBe('none');
    // 全部删光 → 回到提示态；点生成被拒
    (document.querySelector('[data-lit-image-remove="0"]') as HTMLElement).click();
    expect(thumbs()).toHaveLength(0);
    expect(document.getElementById('lit-image-hint')!.textContent).toContain('拖入图片');
    (document.getElementById('lit-term-generate') as HTMLElement).click();
    expect(getNoticeMessages().join('\n')).toContain('请先拖入或粘贴图片');
    // 标题被清空 → 拒写（图版必须有标题；属性卡标题是它落盘的文件名）
    await (ui as any).acceptImageFiles([pngFile('c.png')]);
    await (ui as any).onTermGenerate();
    (document.getElementById('lit-entry-meta-title') as HTMLInputElement).value = '';
    (document.getElementById('lit-term-save') as HTMLElement).click();
    expect(getNoticeMessages().join('\n')).toContain('标题不能为空');
    expect(noteGen.generateImageNote).not.toHaveBeenCalled();
  });

  it('图版：单次最多 9 张（多余不发、不走 AI），且只读提示一次', async () => {
    ui.showImageEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    await (ui as any).acceptImageFiles(Array.from({ length: 12 }, (_v, i) => pngFile(`p${i}.png`)));
    expect(thumbs()).toHaveLength(9);
    expect(getNoticeMessages().join('\n')).toContain('一次最多放 9 张图');
  });

  it('图版：分析中加图 / 删图 → 作废在途预演并解除按钮闸门（不能停在禁用态）', async () => {
    let release!: (v: any) => void;
    setLinkBridge({
      backfill: async () => ({ status: 'done' as const, processed: 0, created: 0 }),
      preview: () => new Promise((r) => { release = r; }),
      apply: async () => ({ status: 'done' as const, created: 0 }),
      now: async () => ({ status: 'done' as const, created: 0 }),
    });
    ui.showImageEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    await (ui as any).acceptImageFiles([pngFile('a.png'), pngFile('b.png')]);
    await (ui as any).onTermGenerate();
    const gen = document.getElementById('lit-term-generate') as HTMLButtonElement;
    const save = document.getElementById('lit-term-save') as HTMLButtonElement;
    expect([gen.disabled, save.disabled]).toEqual([true, true]); // 分析中：闸门落下
    await (ui as any).acceptImageFiles([pngFile('c.png')]); // 加图 = 作废在途预演
    expect([gen.disabled, save.disabled]).toEqual([false, false]); // 闸门必须跟着解除
    release({ status: 'done', picks: [{ path: '卡片盒/旧.md', title: '旧' }] }); // 晚到响应不得回改状态
    await new Promise((r) => setTimeout(r, 10));
    expect([gen.disabled, save.disabled]).toEqual([false, false]);
    expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('—'); // 关联行也不被晚到结果污染
    // 删一张同样解闸（复跑一遍，压在闸门落下的时刻）
    await (ui as any).onTermGenerate();
    expect([gen.disabled, save.disabled]).toEqual([true, true]);
    (document.querySelector('[data-lit-image-remove="0"]') as HTMLElement).click();
    expect([gen.disabled, save.disabled]).toEqual([false, false]);
    release({ status: 'done', picks: [] });
  });

  it('图版：Ctrl+V 粘贴截图只在图版态接管（名词 / 段落态不抢粘贴），多图一次进', async () => {
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    document.dispatchEvent(pasteImageEvent([pngFile()]));
    await new Promise((r) => setTimeout(r, 10));
    expect((ui as any).entryImages).toEqual([]); // 名词态：粘贴不被接管
    ui.showImageEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    document.dispatchEvent(pasteImageEvent([pngFile('shot1.png'), pngFile('shot2.png')]));
    await vi.waitFor(() => expect(thumbs()).toHaveLength(2));
    // 关面板：内存图随关窗清空
    ui.hideTermEntry();
    expect((ui as any).entryImages).toEqual([]);
  });

  it('关联行（issue 309）：生成出内容即起跑预演 → 分析中… → 完成后就地显示；确认写入只落库不重算', async () => {
    const previews: Array<[string, string | undefined]> = [];
    const applies: Array<[string, string[]]> = [];
    let release!: (v: any) => void;
    setLinkBridge({
      backfill: async () => ({ status: 'done' as const, processed: 0, created: 0 }),
      preview: (content: string, title?: string) => {
        previews.push([content, title]);
        return new Promise((r) => { release = r; });
      },
      apply: async (path: string, picks: string[]) => { applies.push([path, picks]); return { status: 'done', created: picks.length }; },
      now: async () => ({ status: 'done', created: 0 }),
    });
    noteGen.generateTermNote.mockResolvedValueOnce('文献盒/松果体.md');
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '松果体';
    await (ui as any).onTermGenerate();
    // 生成出内容的那一刻就进预演（此时草稿还没落盘、也没写任何文件）
    expect(previews).toEqual([['AI 简介', '松果体']]);
    expect(noteGen.generateTermNote).not.toHaveBeenCalled();
    expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('分析中…');
    release({ status: 'done', picks: [{ path: '卡片盒/睡眠卫生.md', title: '睡眠卫生' }] });
    await vi.waitFor(() => expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('睡眠卫生'));
    // 确认写入：落盘 + 只写预演结果（apply 而非 now —— 不重跑检索与裁判）
    vault.files.set('文献盒/松果体.md', '---\ntitle: 松果体\nrelated:\n  - "[[卡片盒/睡眠卫生|睡眠卫生]]"\n---\n\n简介');
    (document.getElementById('lit-term-save') as HTMLElement).click();
    await vi.waitFor(() => expect(applies.length).toBe(1));
    expect(applies[0]).toEqual(['文献盒/松果体.md', ['卡片盒/睡眠卫生.md']]);
  });

  it('关联行：零命中 → 「暂无关联」；检索不可达 → 「已入队」（均由预演直接给出）', async () => {
    const bridgeOf = (preview: () => Promise<any>) => ({
      preview,
      apply: async () => ({ status: 'done' as const, created: 0 }),
      now: async () => ({ status: 'done' as const, created: 0 }),
      backfill: async () => ({ status: 'done' as const, processed: 0, created: 0 }),
    });
    setLinkBridge(bridgeOf(async () => ({ status: 'done', picks: [] })));
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '空命中';
    await (ui as any).onTermGenerate();
    await vi.waitFor(() => expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('暂无关联'));
    setLinkBridge(bridgeOf(async () => ({ status: 'queued' })));
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '不可达';
    await (ui as any).onTermGenerate();
    await vi.waitFor(() => expect(document.getElementById('lit-term-meta-rel')!.textContent).toBe('向量服务不可达，已入队'));
  });

  // ==================== 术语来源（ADR-0116） ====================

  it('来源行 UI + kb 作用域：术语/添加弹层挂 .kb（纸墨皮背景修复）；URL 回车 → 外部 chip + meta 第 4 行 + 落 source', async () => {
    const termPopup = document.getElementById('knowledge-term-popup')!;
    const addPopup = document.getElementById('knowledge-add-popup')!;
    // issue 257：术语/添加弹层缺 .kb（纸墨皮变量作用域）→ var(--panel) 失效背景透明；视频窗（含历史视图）本就有 kb
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

  it('knowledgeSettingsSchema：五组（目录与分类含卡片/主题目录新键、自动关联、视频处理、工具、维护）+ 清空历史回调', async () => {
    const schema = knowledgeSettingsSchema();
    expect(schema.groups.map((g) => g.name)).toEqual(['外观', '目录与分类', '自动关联', '视频处理', '工具', '维护']);
    const dirRows = schema.groups[1].rows.map((r) => (r as any).binding?.key);
    expect(dirRows).toContain('knowledgeCardboxDirectory');
    expect(dirRows).toContain('knowledgeTopicDirectory');
    expect((schema.groups[1].rows[0] as any).binding.key).toBe('knowledgeDirectory');
    // issue 313：图版图片目录可配，空值时 chips 区显示实际生效目录（同书库 fallbackValue 先例）
    expect(dirRows).toContain('knowledgeImageFolder');
    const imgRow = schema.groups[1].rows.find((r) => (r as any).binding?.key === 'knowledgeImageFolder') as any;
    expect(imgRow.type).toBe('path');
    expect(typeof imgRow.fallbackValue).toBe('function');
    expect(imgRow.fallbackValue()).toBe('文献盒/assets'); // note-gen 在本文件被 mock：这里验的是接线
  });

  it('「自动关联」组（ADR-0141 §1/§2）：六行绑定 linkAgent* 键，且没有「关联范围」行', () => {
    const schema = knowledgeSettingsSchema();
    const group = schema.groups.find((g) => g.name === '自动关联')!;
    expect(group).toBeTruthy();
    const rows = group.rows as any[];
    // 总开关 + 五条明细（顺序即面板顺序）
    expect(rows[0].type).toBe('toggle');
    expect(rows[0].name).toBe('自动关联');
    expect(rows[0].binding.get()).toBe(true); // 缺省开语义（键缺失视为开）
    const names = rows.map((r) => r.name);
    expect(names).toEqual(['自动关联', '单篇候选数量 TopK', '每篇关联上限', '完成通知', '失效关联自动清理', '已有关联不再建链']);
    // 明细绑定的是第二大脑那七个键里的六个（键名不改，ADR-0141 §7）
    const boundKeys = rows.slice(1).map((r) => r.binding?.key ?? r.binding?.get?.toString() ?? '');
    expect(boundKeys.length).toBe(5);
    for (const r of rows.slice(1)) expect(r.isChild).toBe(true);
    // 范围恒为三个盒子，不再有范围行（ADR-0141 §2）
    expect(names).not.toContain('关联范围');
  });

  it('ESC 分层：术语 → 视频 → 主面板 逐层关；历史视图先退回队列', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.getElementById('knowledge-popup')!.style.display).toBe('flex'));
    ui.showVideoTasks();
    await vi.waitFor(() => expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex'));
    ui.showTermEntry();
    await vi.waitFor(() => expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('flex'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('knowledge-term-popup')!.style.display).toBe('none');
    expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex');
    // 面板内历史视图：一次 ESC 退回处理队列，面板不关
    ui.showHistory();
    await vi.waitFor(() => expect((document.getElementById('lit-btn-video-back') as HTMLElement).style.display).not.toBe('none'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('knowledge-video-popup')!.style.display).toBe('flex');
    await vi.waitFor(() => expect((document.getElementById('lit-btn-video-back') as HTMLElement).style.display).toBe('none'));
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

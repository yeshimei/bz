// @vitest-environment node
/**
 * 文献笔记生成层测试（src/literature/note-gen.ts）：
 * parseDomainList / chunkTranscript / parseAiJson / parseFrontmatter / injectFrontmatter 纯函数，
 * generateVideoNote / generateTermDraft / generateTermNote 生成链路（AI 打桩 + MockVault 落盘断言），
 * 以及 backfillNotes 超时跳过继续（ticket 138 §1.3）。
 * 纯数据层：无 DOM，node 环境直跑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, parseFrontmatter as vaultParseFrontmatter } from '../mock-vault';
import {
  parseDomainList,
  chunkTranscript,
  parseAiJson,
  parseFrontmatter,
  injectFrontmatter,
  generateVideoNote,
  generateTermDraft,
  generateTermNote,
  backfillNotes,
} from '../../src/literature/note-gen';

// AI 打桩：createAI 返回固定 json/chat（元数据一次 JSON、分块润色逐块 chat，各可计数断言）
const aiStub = vi.hoisted(() => ({
  json: vi.fn(async (_prompt: string) => '{"title":"T","tags":["a"],"summary":"s","domain":"心理"}'),
  chat: vi.fn(async (_prompt: string) => '润色'),
}));
vi.mock('../../src/core/ai', () => ({
  createAI: () => ({ json: aiStub.json, chat: aiStub.chat }),
}));

describe('parseDomainList（领域词表：逗号/顿号分隔、去空、去重）', () => {
  it('逗号/顿号混合分隔 + 去空格 + 去重，顺序保留', () => {
    expect(parseDomainList(' 心理, 计算机， 医学、 医学、')).toEqual(['心理', '计算机', '医学']);
    expect(parseDomainList('医学, 心理')).toEqual(['医学', '心理']); // 顺序保留
  });

  it('空/白/仅分隔符 → []（= AI 自由写领域）', () => {
    expect(parseDomainList('')).toEqual([]);
    expect(parseDomainList(undefined)).toEqual([]);
    expect(parseDomainList(null)).toEqual([]);
    expect(parseDomainList('  ， 、 ')).toEqual([]);
  });
});

describe('chunkTranscript（转录分块：句边界优先，超长硬切）', () => {
  it('句边界切块：优先在。！？等句末处分界，不切句', () => {
    // maxLen=8：第一句+第二句共 8 字可并块，第三句另起一块——边界全部落在句末
    expect(chunkTranscript('第一句。第二句！第三问？', 8)).toEqual(['第一句。第二句！', '第三问？']);
    // 默认 4000：短文本单块合并，内容原样
    expect(chunkTranscript('第一句。第二句！', 4000)).toEqual(['第一句。第二句！']);
  });

  it('超长单句硬切：每块不超 maxLen，总内容不丢', () => {
    const text = '短句。' + '长'.repeat(120);
    const chunks = chunkTranscript(text, 10);
    expect(chunks[0]).toBe('短句。'); // 句末分块先行
    expect(chunks.every((c) => c.length <= 10)).toBe(true);
    expect(chunks.length).toBe(13); // 1 句块 + 12 硬切块
    expect(chunks.join('')).toBe(text); // 内容完整无丢失
  });

  it('混合：句边界 + 超长并存时边界优先', () => {
    const chunks = chunkTranscript('短。' + '长'.repeat(50), 10);
    expect(chunks.join('')).toBe('短。' + '长'.repeat(50));
    expect(chunks[0]).toBe('短。');
  });

  it('空输入 → []', () => {
    expect(chunkTranscript('')).toEqual([]);
    expect(chunkTranscript('   ')).toEqual([]);
    expect(chunkTranscript(null as any)).toEqual([]);
    expect(chunkTranscript(undefined as any)).toEqual([]);
  });
});

describe('parseAiJson（AI JSON 容错解析）', () => {
  it('剥 markdown 围栏（```json / ```）', () => {
    expect(parseAiJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseAiJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('残留文本提取：围栏外/前后说明文字不影响', () => {
    expect(parseAiJson('好的：\n```\n{"a":1}\n```\n完毕')).toEqual({ a: 1 });
    expect(parseAiJson('以下是结果 {"title":"T"} 结尾')).toEqual({ title: 'T' });
  });

  it('坏 JSON → 抛错（带片段提示）', () => {
    expect(() => parseAiJson('这不是 JSON')).toThrow();
    expect(() => parseAiJson('')).toThrow();
    expect(() => parseAiJson('{"a":1,}')).toThrow();
  });
});

describe('parseFrontmatter / injectFrontmatter（frontmatter 轻量读写）', () => {
  it('parseFrontmatter 取键：frontmatter 内行级键值进入 map', () => {
    const fm = parseFrontmatter('---\ntitle: "你好"\ntype: video\ndomain: "心理"\n---\n\n正文');
    expect(fm.type).toBe('video');
    expect(fm.title).toContain('你好');
    expect(fm.domain).toContain('心理');
  });

  it('parseFrontmatter 无 frontmatter → 空对象', () => {
    expect(parseFrontmatter('什么都没有')).toEqual({});
    expect(parseFrontmatter('')).toEqual({});
  });

  it('parseFrontmatter 剥引号（P3-3）：type: "video" / domain: "心理" 判为已补全，不重复注入', () => {
    const fm = parseFrontmatter('---\ntype: "video"\ndomain: "心理"\n---\n\n正文');
    expect(fm.type).toBe('video');
    expect(fm.domain).toBe('心理');
  });

  it('injectFrontmatter 无 frontmatter → 前置创建，正文保留', () => {
    const out = injectFrontmatter('正文内容', ['type:video', 'domain:心理']);
    expect(out).toMatch(/^---\ntype: "video"\ndomain: "心理"\n---\n\n正文内容$/);
  });

  it('injectFrontmatter 有 frontmatter → 追加不重复（已有键不再复制）', () => {
    const out = injectFrontmatter('---\ntype: term\n---\n\n正文', ['domain:心理']);
    expect(out).toBe('---\ntype: term\ndomain: "心理"\n---\n\n正文');
    // domain 恰好一次，type 行保持原样一次
    expect(out.match(/domain/g)).toHaveLength(1);
    expect(out.match(/type: term/g)).toHaveLength(1);
    expect(out.match(/^---$/gm)).toHaveLength(2);
  });
});

describe('generateVideoNote（视频文献：九键 frontmatter + 润色正文）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ literatureDirectory: '文献盒', literatureDomainList: '心理, 计算机' }) as any);
  });

  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  it('元数据一次 JSON（提示词带领域词表）+ 分块润色逐块 chat → 九键 frontmatter 落盘', async () => {
    // 两段各 <4000、合并 >4000 → 分两块 → chat 两次
    const transcript = '长'.repeat(3000) + '。' + '长'.repeat(3000);
    const path = await generateVideoNote({ transcript, videoTitle: '测试视频', url: 'https://b23.tv/xxx', uploader: '某UP' });

    expect(path).toBe('文献盒/T.md'); // 文件名取 AI title：sanitizeMdTitle('T')
    expect(aiStub.json).toHaveBeenCalledTimes(1);
    expect(String(aiStub.json.mock.calls[0][0])).toContain('心理、计算机'); // 领域词表进入判定指令
    expect(aiStub.chat).toHaveBeenCalledTimes(2); // 两块转录 → 两次润色

    const content = vault.files.get(path)!;
    const fm = vaultParseFrontmatter(content)!;
    // 九键：title/tags/summary/url/date/author/videoTitle/type/domain
    expect(fm.title).toBe('T');
    expect(fm.tags).toEqual(['a']);
    expect(fm.summary).toBe('s');
    expect(fm.url).toBe('https://b23.tv/xxx');
    expect(fm.date).toBeTruthy();
    expect(fm.author).toBe('某UP');
    expect(fm.videoTitle).toBe('测试视频');
    expect(fm.type).toBe('video');
    expect(fm.domain).toBe('心理');
    // 正文 = 两块润色拼接
    expect(content).toContain('润色润色');
  });

  it('短转录单块：一次 chat，正文为单段润色', async () => {
    const path = await generateVideoNote({ transcript: '第一段。第二段！', videoTitle: '短视频', url: 'BV1xx411c7mD', uploader: 'UP主' });
    expect(path).toBe('文献盒/T.md');
    expect(aiStub.chat).toHaveBeenCalledTimes(1);
    expect(vault.files.get(path)!).toContain('润色');
  });
});

describe('generateTermDraft（纯 AI 预览，不落盘；ticket 138 §2.1 契约变更）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ literatureDirectory: '文献盒', literatureDomainList: '心理, 计算机' }) as any);
  });

  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  it('返回 {summary, domain}，只调一次 AI，不写任何文件（预览阶段不落盘）', async () => {
    const draft = await generateTermDraft('贝叶斯');
    expect(draft).toEqual({ summary: 's', domain: '心理' }); // stub：summary 's'、domain 从词表选
    expect(aiStub.json).toHaveBeenCalledTimes(1);
    expect(vault.getMarkdownFiles()).toHaveLength(0); // 未确认不落盘
  });

  it('空术语 → 抛错，与落盘版同校验', async () => {
    await expect(generateTermDraft('  ')).rejects.toThrow('术语为空');
    await expect(generateTermDraft('')).rejects.toThrow('术语为空');
    expect(vault.getMarkdownFiles()).toHaveLength(0);
  });
});

describe('generateTermNote（术语文献：五键 frontmatter + 一段简介）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ literatureDirectory: '文献盒', literatureDomainList: '心理, 计算机' }) as any);
  });

  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  it('术语词作文件名与 title，落盘五键 frontmatter（title/type/domain/term/date）+ 简介正文', async () => {
    const path = await generateTermNote({ term: '心理' });

    expect(path).toBe('文献盒/心理.md');
    expect(aiStub.json).toHaveBeenCalledTimes(1);

    const content = vault.files.get(path)!;
    const fm = vaultParseFrontmatter(content)!;
    // 五键：title/type/domain/term/date；不得混入视频键（tags/summary/url/author/videoTitle）
    expect(fm.title).toBe('心理');
    expect(fm.type).toBe('term');
    expect(fm.domain).toBe('心理');
    expect(fm.term).toBe('心理');
    expect(fm.date).toBeTruthy();
    expect(fm.tags).toBeUndefined();
    expect(fm.summary).toBeUndefined();
    expect(fm.url).toBeUndefined();
    expect(fm.author).toBeUndefined();
    expect(fm.videoTitle).toBeUndefined();
    // 正文 = AI 简介（stub summary 's'）
    expect(content).toContain('\n\ns');
  });

  it('重名加序号：连续两次同术语 → _2（uniquePath 永不覆盖）', async () => {
    const p1 = await generateTermNote({ term: '心理' });
    const p2 = await generateTermNote({ term: '心理' });
    expect(p1).toBe('文献盒/心理.md');
    expect(p2).toBe('文献盒/心理_2.md');
    // 两份都在，内容完整（不互相覆盖）
    expect(vault.files.get(p1)).toContain('type: term');
    expect(vault.files.get(p2)).toContain('type: term');
  });

  it('空术语 → 抛错不落盘', async () => {
    await expect(generateTermNote({ term: '  ' })).rejects.toThrow('术语为空');
    await expect(generateTermNote({ term: '' })).rejects.toThrow('术语为空');
    expect(vault.getMarkdownFiles()).toHaveLength(0);
  });

  it('传 summary/domain → 跳过 AI、所见即所得（终审 P1-4：确认写入不重跑 AI 不调用第二次）', async () => {
    const path = await generateTermNote({ term: '黑洞', summary: '手改后的简介', domain: '天体物理' });
    expect(path).toBe('文献盒/黑洞.md');
    expect(aiStub.json).not.toHaveBeenCalled(); // 未重跑 AI
    const content = vault.files.get(path)!;
    const fm = vaultParseFrontmatter(content)!;
    expect(fm.title).toBe('黑洞');
    expect(fm.type).toBe('term');
    expect(fm.domain).toBe('天体物理');
    expect(fm.term).toBe('黑洞');
    expect(fm.summary).toBeUndefined(); // 五键，无 summary 键
    expect(content).toContain('\n\n手改后的简介'); // 正文 = 传入的 summary
  });

  it('传空串 summary → 也跳过 AI，正文为空', async () => {
    const path = await generateTermNote({ term: '黑洞', summary: '', domain: '物理' });
    expect(aiStub.json).not.toHaveBeenCalled();
    const content = vault.files.get(path)!;
    expect(content).toContain('domain: "物理"');
    expect(content).not.toContain('\n\n'); // 空正文不产生空段
  });
});

describe('backfillNotes（旧笔记自动补全；ticket 138 §1.3：单次 AI 超时跳过，不卡死整批）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ literatureDirectory: '文献盒', literatureDomainList: '物理, 数学' }) as any);
  });

  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  it('AI 挂起超时 → 跳过该条并继续补全后续笔记（aiSkipped 语义保持为 false）', async () => {
    // 两条缺 domain 的旧笔记（type 已启发式补好，进 AI 补全队列）
    vault.files.set('文献盒/A.md', '---\ntype: video\n---\n\n正文A');
    vault.files.set('文献盒/B.md', '---\ntype: term\n---\n\n正文B');
    // 第一条 AI 调用挂起（永不 settle）→ 40ms 注入超时；第二条正常返回领域
    aiStub.json.mockImplementationOnce(() => new Promise(() => {}));
    aiStub.json.mockImplementationOnce(async () => '{"domain":"物理"}');

    const res = await backfillNotes({ aiTimeoutMs: 40 });

    // 整批跑完：只补了 B（filled=1）；超时条 A 保持原样；不是 AI 未配置（aiSkipped=false）
    expect(res).toEqual({ scanned: 2, filled: 1, aiSkipped: false });
    expect(vault.files.get('文献盒/A.md')).not.toContain('domain');
    expect(vault.files.get('文献盒/B.md')).toContain('domain: "物理"');
  });

  it('普通补全不设超时也逐条成功（回归：默认分支行为不变）', async () => {
    vault.files.set('文献盒/A.md', '---\ntype: term\n---\n\n正文A');
    aiStub.json.mockImplementationOnce(async () => '{"domain":"数学"}');

    const res = await backfillNotes();
    expect(res).toEqual({ scanned: 1, filled: 1, aiSkipped: false });
    expect(vault.files.get('文献盒/A.md')).toContain('domain: "数学"');
  });

  it('双缺（type 启发式 + AI domain）：两处都落盘且不互覆盖（P1-2 回归：domain 写回不回滚 type 补丁）', async () => {
    // 旧笔记只有 url（启发式 → type: video），缺 type 与 domain——ADR-0073 主目标人群
    vault.files.set('文献盒/旧A.md', '---\nurl: "https://www.bilibili.com/video/BV1xx411c7mD"\n---\n\n正文A');
    aiStub.json.mockImplementationOnce(async () => '{"domain":"物理"}');

    const res = await backfillNotes();

    expect(res).toEqual({ scanned: 1, filled: 2, aiSkipped: false }); // type 补丁写盘 + domain 写盘
    const content = vault.files.get('文献盒/旧A.md')!;
    expect(content).toContain('type: "video"');
    expect(content).toContain('domain: "物理"');
    // type/domain 各恰出现一次（未被重复注入/覆盖）
    expect((content.match(/^type:/gm) || []).length).toBe(1);
    expect((content.match(/^domain:/gm) || []).length).toBe(1);
  });

  it('单缺 type（已有 domain）：只做启发式补 type，不调 AI', async () => {
    vault.files.set('文献盒/B.md', '---\ndomain: "物理"\nterm: "贝叶斯"\n---\n\n正文B');

    const res = await backfillNotes();

    expect(res).toEqual({ scanned: 1, filled: 1, aiSkipped: false });
    expect(vault.files.get('文献盒/B.md')).toContain('type: "term"');
    expect(aiStub.json).not.toHaveBeenCalled(); // 有 domain 不进 AI 补全队列
  });

  it('单缺 domain（已有 type）：只 AI 补 domain', async () => {
    vault.files.set('文献盒/C.md', '---\ntype: video\n---\n\n正文C');
    aiStub.json.mockImplementationOnce(async () => '{"domain":"数学"}');

    const res = await backfillNotes();

    expect(res).toEqual({ scanned: 1, filled: 1, aiSkipped: false });
    expect(vault.files.get('文献盒/C.md')).toContain('domain: "数学"');
  });

  it('已补全（type+domain 双全）：不重跑、不写盘', async () => {
    vault.files.set('文献盒/D.md', '---\ntype: video\ndomain: "物理"\n---\n\n正文D');

    const res = await backfillNotes();

    expect(res).toEqual({ scanned: 1, filled: 0, aiSkipped: false });
    expect(aiStub.json).not.toHaveBeenCalled();
  });

  it('引号包裹 type（P3-3）：type: "video" 视为已补全，不被重复注入', async () => {
    vault.files.set('文献盒/E.md', '---\ntype: "video"\n---\n\n正文E');
    aiStub.json.mockImplementationOnce(async () => '{"domain":"心理"}');

    const res = await backfillNotes();

    expect(res).toEqual({ scanned: 1, filled: 1, aiSkipped: false });
    const content = vault.files.get('文献盒/E.md')!;
    expect((content.match(/^type:/gm) || []).length).toBe(1); // type 恰一次
    expect(content).toContain('domain: "心理"');
  });

  it('AI 未配置：整批跳过并标记 aiSkipped=true，不落盘', async () => {
    vault.files.set('文献盒/F.md', '---\ntype: video\n---\n\n正文F');
    aiStub.json.mockImplementationOnce(async () => { throw new Error('未配置 OpenCode Go API Key：插件设置 → AI 配置'); });

    const res = await backfillNotes();

    expect(res).toEqual({ scanned: 1, filled: 0, aiSkipped: true });
    expect(vault.files.get('文献盒/F.md')).not.toContain('domain');
  });
});
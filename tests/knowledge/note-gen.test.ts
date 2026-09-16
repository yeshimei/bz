// @vitest-environment node
/**
 * 文献笔记生成层测试（src/knowledge/note-gen.ts）：
 * parseDomainList / chunkTranscript / parseAiJson / parseFrontmatter / injectFrontmatter 纯函数，
 * generateVideoNote / generateTermDraft / generateTermNote / generateImageDraft / generateImageNote
 * 生成链路（AI 打桩 + MockVault 落盘断言；图版含图片本体 createBinary），
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
  migrateVideoSourceKeys,
  generateVideoNote,
  generateTermDraft,
  generatePassageDraft,
  summarizeTermSummary,
  generateTermNote,
  findDuplicateTermNote,
  generateImageDraft,
  generateImageNote,
  resolveImageDir,
  backfillNotes,
  type DraftFields,
} from '../../src/knowledge/note-gen';

// AI 打桩：createAI 返回固定 json/chat（元数据一次 JSON、分块润色逐块 chat，各可计数断言）。
// json 的第二参是调用方选项（signal / onDelta）——ADR-0152 起调用方会带上，桩留出该形参供断言与流式模拟。
const aiStub = vi.hoisted(() => ({
  json: vi.fn(async (_prompt: string, _opts?: any): Promise<string> => '{"title":"T","tags":["a"],"summary":"s","domain":"心理"}'),
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
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '心理, 计算机' }) as any);
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
    // issue 276：标题指令收敛为完整陈述句（禁疑问语气），旧口径「陈述句或疑问句」移除
    const metaPrompt = String(aiStub.json.mock.calls[0][0]);
    expect(metaPrompt).toContain('完整陈述句');
    expect(metaPrompt).toContain('不得使用疑问句或疑问语气');
    expect(metaPrompt).not.toContain('陈述句或疑问句');
    expect(aiStub.chat).toHaveBeenCalledTimes(2); // 两块转录 → 两次润色

    const content = vault.files.get(path)!;
    const fm = vaultParseFrontmatter(content)!;
    // 九键：title/tags/summary/source/date/author/sourceTitle/type/domain
    // （2026-09-16 统一来源：url → source、videoTitle → sourceTitle，四类文献共用「来源」一个名）
    expect(fm.title).toBe('T');
    expect(fm.tags).toEqual(['a']);
    expect(fm.summary).toBe('s');
    expect(fm.source).toBe('https://b23.tv/xxx');
    expect(fm.date).toBeTruthy();
    expect(fm.author).toBe('某UP');
    expect(fm.sourceTitle).toBe('测试视频');
    expect(fm.type).toBe('video');
    expect(fm.domain).toBe('心理');
    // 旧键名不再出现
    expect(fm.url).toBeUndefined();
    expect(fm.videoTitle).toBeUndefined();
    // 正文 = 两块润色拼接
    expect(content).toContain('润色润色');
    // 未传 videoPath（keepVideo=false 等）→ 无视频段
    expect(content).not.toContain('![[CONFIG/APPENDIX/');
  });

  it('videoPath 非空 → 正文尾部附视频双链（ticket 151 补回，ADR-0066）', async () => {
    const path = await generateVideoNote({
      transcript: '第一段。第二段！', videoTitle: '短视频', url: 'BV1xx411c7mD', uploader: 'UP主',
      videoPath: 'CONFIG/APPENDIX/短视频_BV1xx411c7mD.mp4',
    });
    const content = vault.files.get(path)!;
    expect(content).not.toContain('## 视频');
    expect(content).toContain('![[CONFIG/APPENDIX/短视频_BV1xx411c7mD.mp4]]');
    // 反斜杠路径归一化为正斜杠（跨平台交付路径）
    const p2 = await generateVideoNote({
      transcript: 'x', videoTitle: 't2', url: 'u', uploader: 'w', videoPath: 'CONFIG\\APPENDIX\\v2.mp4',
    });
    expect(vault.files.get(p2)!).toContain('![[CONFIG/APPENDIX/v2.mp4]]');
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
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '心理, 计算机' }) as any);
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

describe('草稿流式（ADR-0152 / issue 343：onProgress 增量 + 空正文守卫 + prompt 字段顺序）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 一次性返回值（Once）不随 clearAllMocks 清空——某例中途失败残留的 Once 会污染下一例，
    // 这里显式重置并重设默认实现，保证每例从干净的桩开始
    aiStub.json.mockReset();
    aiStub.json.mockImplementation(async (_prompt: string) => '{"title":"T","tags":["a"],"summary":"s","domain":"心理"}');
    aiStub.chat.mockReset();
    aiStub.chat.mockImplementation(async (_prompt: string) => '润色');
    setApp({ vault: new MockVault() } as any);
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '心理, 计算机' }) as any);
  });

  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  /** 把完整 JSON 按 1 字符切片喂给 ai.json 的 onDelta，模拟 SSE 逐段到达（返回整段文本 = 收尾解析的输入） */
  function streamOnce(full: string): void {
    aiStub.json.mockImplementationOnce(async (_input: any, opts: any) => {
      for (const ch of full) opts?.onDelta?.(ch);
      return full;
    });
  }

  it('onProgress：每段到达回调一次，正文逐字长出、领域先落地，终值与返回值一致', async () => {
    streamOnce('{"domain":"心理","summary":"量子纠缠是物理现象"}');
    const frames: DraftFields[] = [];
    const draft = await generateTermDraft('量子纠缠', { onProgress: (f) => frames.push(f) });
    expect(draft).toEqual({ summary: '量子纠缠是物理现象', domain: '心理' });
    // 终值 = 收尾 parseAiJson 的结果（预览与落盘同源，ADR-0152「后果」）
    expect(frames[frames.length - 1]).toEqual({ title: null, domain: '心理', summary: '量子纠缠是物理现象' });
    // 领域是短字段且排在 summary 之前 → 存在「领域已落地、正文还没开始」的帧
    expect(frames.some((f) => f.domain === '心理' && f.summary === null)).toBe(true);
    // 正文逐字增长：出现过单字帧，且相邻帧是前缀关系（只可能变长）
    const sums = frames.map((f) => f.summary).filter((s): s is string => s !== null);
    expect(sums.some((s) => s.length === 1)).toBe(true);
    for (let i = 1; i < sums.length; i++) expect(sums[i].startsWith(sums[i - 1])).toBe(true);
  });

  it('不传 onProgress → 不接 onDelta、不带 signal（纯非流式形态，零额外汇总开销）', async () => {
    await generateTermDraft('量子纠缠');
    const opts = aiStub.json.mock.calls[0][1] as any;
    expect(opts?.onDelta).toBeUndefined();
    expect(opts?.signal).toBeUndefined();
  });

  it('signal 原样透传给 ai.json（关窗 / 再点生成据此中止在途请求）', async () => {
    const ac = new AbortController();
    await generateTermDraft('量子纠缠', { signal: ac.signal });
    expect((aiStub.json.mock.calls[0][1] as any)?.signal).toBe(ac.signal);
  });

  it('空正文守卫：空 / 纯空白 summary → 抛错，不得成为草稿（ADR-0152 决策 6）', async () => {
    aiStub.json.mockResolvedValueOnce('{"domain":"心理","summary":""}');
    await expect(generateTermDraft('量子纠缠')).rejects.toThrow('AI 未返回正文');
    aiStub.json.mockResolvedValueOnce('{"domain":"心理","summary":"   "}');
    await expect(generateTermDraft('量子纠缠')).rejects.toThrow('AI 未返回正文');
  });

  it('段落 / 图版：空正文同样被守卫拦下', async () => {
    aiStub.json.mockResolvedValueOnce('{"domain":"社会","title":"标题","summary":""}');
    await expect(generatePassageDraft('一段文字')).rejects.toThrow('AI 未返回正文');
    aiStub.json.mockResolvedValueOnce('{"domain":"艺术","title":"图题","summary":""}');
    await expect(generateImageDraft(['data:image/png;base64,AAAA'])).rejects.toThrow('AI 未返回正文');
  });

  it('截断的 JSON 走既有报错路径（parseAiJson 抛错，不静默落半篇）', async () => {
    aiStub.json.mockResolvedValueOnce('{"domain":"心理","summary":"被截断的正');
    await expect(generateTermDraft('量子纠缠')).rejects.toThrow();
  });

  it('prompt 字段顺序：三态都是 domain 在前、正文最后（ADR-0152 决策 10）', async () => {
    await generateTermDraft('量子纠缠');
    const tp = String(aiStub.json.mock.calls[0][0]);
    expect(tp.indexOf('"domain"')).toBeGreaterThan(-1);
    expect(tp.indexOf('"domain"')).toBeLessThan(tp.indexOf('"summary"'));
    aiStub.json.mockClear();
    await generatePassageDraft('一段文字');
    const pp = String(aiStub.json.mock.calls[0][0]);
    expect(pp.indexOf('"domain"')).toBeLessThan(pp.indexOf('"title"'));
    expect(pp.indexOf('"title"')).toBeLessThan(pp.indexOf('"summary"'));
    aiStub.json.mockClear();
    await generateImageDraft(['data:image/png;base64,AAAA']);
    const ip = String((aiStub.json.mock.calls[0][0] as any).text);
    expect(ip.indexOf('"domain"')).toBeLessThan(ip.indexOf('"title"'));
    expect(ip.indexOf('"title"')).toBeLessThan(ip.indexOf('"summary"'));
  });
});

describe('summarizeTermSummary（术语简介 AI 精简，ticket 155）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '心理, 计算机' }) as any);
    aiStub.chat.mockResolvedValue('精简后的一段话');
  });

  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  it('走 ai.chat 精简，prompt 含原文，返回去空白结果，不写任何文件', async () => {
    const out = await summarizeTermSummary('  一段很长很长的术语介绍  ');
    expect(out).toBe('精简后的一段话');
    expect(aiStub.chat).toHaveBeenCalledTimes(1);
    const prompt = aiStub.chat.mock.calls[0][0] as string;
    expect(prompt).toContain('一段很长很长的术语介绍');
    expect(prompt).toContain('精简');
    expect(vault.getMarkdownFiles()).toHaveLength(0);
  });

  it('空内容 → 抛错不调 AI；AI 返回空白 → 抛错', async () => {
    await expect(summarizeTermSummary('  ')).rejects.toThrow('内容为空');
    expect(aiStub.chat).not.toHaveBeenCalled();
    aiStub.chat.mockResolvedValue('   ');
    await expect(summarizeTermSummary('正文')).rejects.toThrow('AI 返回为空');
  });
});

describe('findDuplicateTermNote（名词重名查重，ADR-0143/issue 328）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒' }) as any);
  });

  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  it('命中：文献目录已有同名 md → 返回既有路径', () => {
    vault.files.set('文献盒/褪黑素.md', '---\ntitle: 褪黑素\n---\n旧笔记');
    expect(findDuplicateTermNote('褪黑素')).toBe('文献盒/褪黑素.md');
  });

  it('不命中：目录为空 / 名字不同 → null', () => {
    expect(findDuplicateTermNote('褪黑素')).toBeNull();
    vault.files.set('文献盒/褪黑素.md', 'x');
    expect(findDuplicateTermNote('血清素')).toBeNull();
  });

  it('清洗后比对：非法字符经 sanitize 归 _ 后命中（与 writeUniqueNote 撞名判定同源）', () => {
    vault.files.set('文献盒/a_b_c.md', 'x');
    expect(findDuplicateTermNote('a/b:c')).toBe('文献盒/a_b_c.md');
  });

  it('其他目录同名不算（只查文献目录）', () => {
    vault.files.set('知识盒/褪黑素.md', 'x');
    expect(findDuplicateTermNote('褪黑素')).toBeNull();
  });
});

describe('generateTermNote（术语文献：五键 frontmatter + 一段简介）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '心理, 计算机' }) as any);
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
    // 五键：title/type/domain/term/date；不得混入视频专有键（tags/summary/author/sourceTitle），
    // 未传 source → 来源两键一个都不落
    expect(fm.title).toBe('心理');
    expect(fm.type).toBe('term');
    expect(fm.domain).toBe('心理');
    expect(fm.term).toBe('心理');
    expect(fm.date).toBeTruthy();
    expect(fm.tags).toBeUndefined();
    expect(fm.summary).toBeUndefined();
    expect(fm.author).toBeUndefined();
    expect(fm.source).toBeUndefined();
    expect(fm.sourceTitle).toBeUndefined();
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

  // ---- ADR-0116：术语来源（可选 source/sourceTitle 键） ----
  it('来源=内部笔记 → source 写原生双链 [[路径|名]]（无 sourceTitle，不碰 related）', async () => {
    const path = await generateTermNote({
      term: '心流', summary: 's', domain: '心理',
      source: { kind: 'note', path: '我的/日记/心流体验.md' },
    });
    const content = vault.files.get(path)!;
    const fm = vaultParseFrontmatter(content)!;
    expect(fm.source).toBe('[[我的/日记/心流体验.md|心流体验]]');
    expect(fm.sourceTitle).toBeUndefined();
    expect(fm.related).toBeUndefined(); // 来源≠关联：不落 related
    expect(content).not.toContain('related:');
  });

  it('来源=内部笔记带显式名 → 双链取显式名', async () => {
    const path = await generateTermNote({
      term: '心流', summary: 's', domain: '心理',
      source: { kind: 'note', path: '我的/日记/心流体验.md', name: '体验心流' },
    });
    const fm = vaultParseFrontmatter(vault.files.get(path)!)!;
    expect(fm.source).toBe('[[我的/日记/心流体验.md|体验心流]]');
  });

  it('来源=外部链接 → source 落 URL 原文；带抓到的标题 → sourceTitle；键序在 date 之后', async () => {
    const path = await generateTermNote({
      term: '心流', summary: 's', domain: '心理',
      source: { kind: 'external', url: 'https://zhuanlan.zhihu.com/p/123456', title: '心流是什么' },
    });
    const content = vault.files.get(path)!;
    const fm = vaultParseFrontmatter(content)!;
    expect(fm.source).toBe('https://zhuanlan.zhihu.com/p/123456');
    expect(fm.sourceTitle).toBe('心流是什么');
    expect(content).toContain('date:');
    expect(content.indexOf('date:')).toBeLessThan(content.indexOf('source:')); // 五键顺序不变，来源追加在后
  });

  it('外部链接不带标题 → 只有 source 无 sourceTitle；URL 尾随标点（粘贴带入）落库前净化', async () => {
    const path = await generateTermNote({
      term: '心流', summary: 's', domain: '心理',
      source: { kind: 'external', url: 'https://b23.tv/abcDEF，' },
    });
    const fm = vaultParseFrontmatter(vault.files.get(path)!)!;
    expect(fm.source).toBe('https://b23.tv/abcDEF');
    expect(fm.sourceTitle).toBeUndefined();
  });

  it('source 为 null/空值 → 不写来源键（五键原样）', async () => {
    const path = await generateTermNote({ term: '心流', summary: 's', domain: '心理', source: null });
    const content = vault.files.get(path)!;
    expect(content).not.toContain('source:');
    expect(content).not.toContain('sourceTitle:');
  });
});

describe('backfillNotes（旧笔记自动补全；ticket 138 §1.3：单次 AI 超时跳过，不卡死整批）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '物理, 数学' }) as any);
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
    // 旧笔记带 author + url（启发式 → type: video），缺 type 与 domain——ADR-0073 主目标人群；
    // url 同时被存量键迁移改写成 source（2026-09-16 统一来源），故 filled = 迁移 1 + type 1 + domain 1
    vault.files.set('文献盒/旧A.md', '---\nauthor: "某UP"\nurl: "https://www.bilibili.com/video/BV1xx411c7mD"\n---\n\n正文A');
    aiStub.json.mockImplementationOnce(async () => '{"domain":"物理"}');

    const res = await backfillNotes();

    expect(res).toEqual({ scanned: 1, filled: 3, aiSkipped: false });
    const content = vault.files.get('文献盒/旧A.md')!;
    expect(content).toContain('source: "https://www.bilibili.com/video/BV1xx411c7mD"'); // 迁移后的形态
    expect(content).toContain('type: "video"');
    expect(content).toContain('domain: "物理"');
    // source/type/domain 各恰出现一次（迁移不造重复键、补丁未被重复注入）
    expect((content.match(/^source:/gm) || []).length).toBe(1);
    expect((content.match(/^type:/gm) || []).length).toBe(1);
    expect((content.match(/^domain:/gm) || []).length).toBe(1);
  });

  it('存量键迁移（统一来源）：url → source、videoTitle → sourceTitle；幂等、不造重复键、正文零扰动', async () => {
    expect(migrateVideoSourceKeys('---\nurl: "https://x"\n---\n\n正文')).toBe('---\nsource: "https://x"\n---\n\n正文');
    expect(migrateVideoSourceKeys('---\nvideoTitle: "视频原题"\n---\n\n正文')).toBe('---\nsourceTitle: "视频原题"\n---\n\n正文');
    // 两键同时 + 其它键与正文原样保留（只动这两行）
    expect(
      migrateVideoSourceKeys('---\ntitle: "T"\nurl: "u"\nauthor: "A"\nvideoTitle: "V"\ntype: video\n---\n\n正文段')
    ).toBe('---\ntitle: "T"\nsource: "u"\nauthor: "A"\nsourceTitle: "V"\ntype: video\n---\n\n正文段');
    // 幂等：迁移过的内容再喂一次逐字节相同
    const once = migrateVideoSourceKeys('---\nurl: "u"\nvideoTitle: "V"\n---\n\n正文');
    expect(migrateVideoSourceKeys(once)).toBe(once);
    // 已有目标键 → 不改名（绝不造出重复键），原样返回
    expect(migrateVideoSourceKeys('---\nsource: "s"\nurl: "u"\n---\n\n正文')).toBe('---\nsource: "s"\nurl: "u"\n---\n\n正文');
    // 无 frontmatter / 两键都没有 → 原样
    expect(migrateVideoSourceKeys('正文而已')).toBe('正文而已');
    expect(migrateVideoSourceKeys('---\ntitle: "T"\n---\n\n正文')).toBe('---\ntitle: "T"\n---\n\n正文');
    // CRLF 保真
    expect(migrateVideoSourceKeys('---\r\nurl: "u"\r\n---\r\n\r\n正文')).toBe('---\r\nsource: "u"\r\n---\r\n\r\n正文');
    // 正文里的 url:/videoTitle: 行不受影响（只扫 frontmatter）
    expect(migrateVideoSourceKeys('---\ntitle: "T"\n---\nurl: "正文里的"\n')).toBe('---\ntitle: "T"\n---\nurl: "正文里的"\n');
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


// ==================== 图版（issue 312；多图与目录设置 issue 313） ====================

describe('generateImageDraft（图版读图草稿：走多模态通道，不落盘）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '艺术, 历史' }) as any);
  });

  it('单图走 {text, images} 多模态输入（文本带读图指令、images 恰一项）', async () => {
    aiStub.json.mockResolvedValueOnce('{"title":"图题","summary":"解读","domain":"艺术"}');

    const draft = await generateImageDraft(['data:image/png;base64,AAAB']);

    expect(draft).toEqual({ title: '图题', summary: '解读', domain: '艺术' });
    const arg: any = aiStub.json.mock.calls[0][0];
    expect(typeof arg).toBe('object'); // 不是纯文本串——带图必须走 content 数组的入参形态
    expect(arg.images).toEqual(['data:image/png;base64,AAAB']);
    expect(arg.text).toContain('看这张图片');
    expect(arg.text).toContain('艺术、历史'); // 领域词表进提示词
  });

  it('多图（issue 313）：一次全投，提示词改成「作为一组」并标出张数', async () => {
    aiStub.json.mockResolvedValueOnce('{"title":"组图题","summary":"解读","domain":"艺术"}');

    await generateImageDraft(['data:image/png;base64,AAA', 'data:image/jpeg;base64,BBB', 'data:image/webp;base64,CCC']);

    const arg: any = aiStub.json.mock.calls[0][0];
    expect(arg.images).toHaveLength(3); // 三张一起发，不拆请求
    expect(arg.images[2]).toBe('data:image/webp;base64,CCC');
    expect(arg.text).toContain('看下面这 3 张图片');
    expect(arg.text).toContain('作为一组');
  });

  it('空图 / 空白项 → 抛错且不调用 AI（过滤后为空也算空）', async () => {
    await expect(generateImageDraft([])).rejects.toThrow('图片为空');
    await expect(generateImageDraft(['  ', ''])).rejects.toThrow('图片为空');
    expect(aiStub.json).not.toHaveBeenCalled();
  });

  it('已填描述进读图提示词「用户图注」节（ADR-0145，issue 329）：按序号对应、空白描述不列、全空无节', async () => {
    aiStub.json.mockResolvedValueOnce('{"title":"t","summary":"s","domain":"艺术"}');
    await generateImageDraft(['data:image/png;base64,AAA', 'data:image/jpeg;base64,BBB'], ['一张窗外的树', '  ']);
    const arg: any = aiStub.json.mock.calls[0][0];
    expect(arg.text).toContain('用户图注');
    expect(arg.text).toContain('第 1 张：一张窗外的树');
    expect(arg.text).not.toContain('第 2 张'); // 空白描述不列

    // 全空 / 不传 descs（既有调用形态回归）→ 不加「用户图注」节
    aiStub.json.mockResolvedValueOnce('{"title":"t","summary":"s","domain":"艺术"}');
    await generateImageDraft(['data:image/png;base64,AAA'], ['   ']);
    expect(String((aiStub.json.mock.calls[1][0] as any).text)).not.toContain('用户图注');
    aiStub.json.mockResolvedValueOnce('{"title":"t","summary":"s","domain":"艺术"}');
    await generateImageDraft(['data:image/png;base64,AAA']);
    expect(String((aiStub.json.mock.calls[2][0] as any).text)).not.toContain('用户图注');
  });

  it('图注与图片逐位对应：无效 url 被剔除时其图注一并剔除，不错位', async () => {
    aiStub.json.mockResolvedValueOnce('{"title":"t","summary":"s","domain":"艺术"}');
    await generateImageDraft(['data:image/png;base64,AAA', '  ', 'data:image/png;base64,CCC'], ['甲', '乙', '丙']);
    const arg: any = aiStub.json.mock.calls[0][0];
    expect(arg.images).toEqual(['data:image/png;base64,AAA', 'data:image/png;base64,CCC']);
    expect(arg.text).toContain('第 1 张：甲');
    expect(arg.text).toContain('第 2 张：丙'); // 丙跟随原第三张升为第 2 位
    expect(arg.text).not.toContain('乙');
  });
});

describe('generateImageNote（图版文献：图片本体 + 五键 frontmatter + 先文字后图片）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeDomainList: '' }) as any);
  });

  afterEach(() => {
    setSettingsProvider(() => ({} ) as any);
  });

  const bytesOf = (n: number) => new Uint8Array(Array.from({ length: n }, (_v, i) => i + 1)).buffer;
  const imgs = (...list: Array<[number, string]>) => list.map(([n, ext]) => ({ bytes: bytesOf(n), ext }));

  it('图片本体落 <文献目录>/assets/、笔记落文献目录；正文文字在上、图片在下', async () => {
    const path = await generateImageNote({
      title: '窗外的树',
      summary: '一张树的照片',
      domain: '自然',
      images: imgs([4, 'png']),
    });

    expect(path).toBe('文献盒/窗外的树.md');
    expect(vault.binaryFiles.has('文献盒/assets/窗外的树.png')).toBe(true);
    expect(Array.from(vault.binaryFiles.get('文献盒/assets/窗外的树.png')!)).toEqual([1, 2, 3, 4]);
    const content = vault.files.get(path)!;
    const fm = vaultParseFrontmatter(content)!;
    expect(fm.title).toBe('窗外的树');
    expect(fm.type).toBe('image');
    expect(fm.domain).toBe('自然');
    expect(fm.date).toBeTruthy();
    // 不得混入其它文献类型的键
    expect(fm.term).toBeUndefined();
    expect(fm.author).toBeUndefined();
    expect(fm.tags).toBeUndefined();
    // 正文 = 全路径嵌入（裸名会指错同名图）+ 读图解读，解读在前、嵌入在后（issue 313）
    expect(content).toContain('![[文献盒/assets/窗外的树.png]]');
    expect(content).toContain('一张树的照片');
    expect(content.indexOf('一张树的照片')).toBeLessThan(content.indexOf('![[文献盒/assets/窗外的树.png]]'));
  });

  it('描述含 ]] 不破嵌入语法（评审修复：]] 插空格降级）', async () => {
    const path = await generateImageNote({
      title: '描述带双括号',
      summary: '用户图注里带 wikilink 结束符',
      images: [{ bytes: bytesOf(4), ext: 'png', desc: '见图]]否则截断' }],
    });
    const content = vault.files.get(path)!;
    expect(content).toContain('![[文献盒/assets/描述带双括号.png|见图] ]否则截断]]');
    // 全文恰好一对嵌入闭合（描述内的 ]] 已降级，无残文落正文）
    expect(content.match(/\]\]/g)!.length).toBe(1);
  });

  it('多图（issue 313）：逐张落盘 + 逐条嵌入，顺序与传入一致且全在文字之后', async () => {
    const path = await generateImageNote({
      title: '三张写生',
      summary: '一组三张的写生记录',
      images: imgs([2, 'png'], [3, 'jpg'], [4, 'webp']),
    });

    expect(vault.binaryFiles.has('文献盒/assets/三张写生.png')).toBe(true);
    expect(vault.binaryFiles.has('文献盒/assets/三张写生.jpg')).toBe(true);
    expect(vault.binaryFiles.has('文献盒/assets/三张写生.webp')).toBe(true);
    const content = vault.files.get(path)!;
    const i1 = content.indexOf('![[文献盒/assets/三张写生.png]]');
    const i2 = content.indexOf('![[文献盒/assets/三张写生.jpg]]');
    const i3 = content.indexOf('![[文献盒/assets/三张写生.webp]]');
    expect(i1).toBeGreaterThan(-1);
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
    expect(content.indexOf('一组三张的写生记录')).toBeLessThan(i1); // 文字仍在上
  });

  it('图片目录可由设置指定（issue 313）；留空回落到 <文献目录>/assets', async () => {
    expect(resolveImageDir({ knowledgeDirectory: '文献盒' })).toBe('文献盒/assets');
    expect(resolveImageDir({ knowledgeDirectory: '文献盒', knowledgeImageFolder: '  ' })).toBe('文献盒/assets');
    expect(resolveImageDir({ knowledgeDirectory: '文献盒', knowledgeImageFolder: '/附图/' })).toBe('附图'); // 两侧斜杠归一
    expect(resolveImageDir({ knowledgeImageFolder: '我的/图片' })).toBe('我的/图片'); // 指定即完全以它为准

    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeImageFolder: '附图' }) as any);
    const path = await generateImageNote({ title: '手稿', summary: '解读', images: imgs([1, 'png']) });

    expect(vault.binaryFiles.has('附图/手稿.png')).toBe(true);
    expect(vault.binaryFiles.has('文献盒/assets/手稿.png')).toBe(false);
    expect(vault.files.get(path)).toContain('![[附图/手稿.png]]'); // 嵌入随目录一起变
  });

  it('重名：图片与笔记各自加序号，互不覆盖（同扩展名才判重）', async () => {
    const p1 = await generateImageNote({ title: '窗外的树', summary: 'A', images: imgs([2, 'png']) });
    const p2 = await generateImageNote({ title: '窗外的树', summary: 'B', images: imgs([3, 'png']) });
    const p3 = await generateImageNote({ title: '窗外的树', summary: 'C', images: imgs([4, 'jpg']) });

    expect(p1).toBe('文献盒/窗外的树.md');
    expect(p2).toBe('文献盒/窗外的树_2.md');
    expect(vault.binaryFiles.has('文献盒/assets/窗外的树.png')).toBe(true);
    expect(vault.binaryFiles.has('文献盒/assets/窗外的树_2.png')).toBe(true);
    // 换扩展名 = 另一个文件，不占用序号（同名 png 已存在也不影响 jpg）；图与笔记各自独立判重
    expect(vault.binaryFiles.has('文献盒/assets/窗外的树.jpg')).toBe(true);
    expect(p3).toBe('文献盒/窗外的树_3.md');
    expect(vault.files.get(p1)).toContain('A');
    expect(vault.files.get(p2)).toContain('B');
  });

  it('来源按 ADR-0116 落 source/sourceTitle（内部笔记 = 原生双链）', async () => {
    const path = await generateImageNote({
      title: '手稿页',
      summary: '解读',
      images: imgs([1, 'webp']),
      source: { kind: 'note', path: '我的/日记/2026-09-14.md' },
    });

    const content = vault.files.get(path)!;
    expect(content).toContain('source: "[[我的/日记/2026-09-14.md|2026-09-14]]"');
    expect(vault.binaryFiles.has('文献盒/assets/手稿页.webp')).toBe(true);
  });

  it('标题与解读全空 → 抛错不落盘（既不写图也不写笔记）', async () => {
    await expect(generateImageNote({ title: ' ', summary: '', images: imgs([1, 'png']) }))
      .rejects.toThrow('图版为空');
    expect(vault.binaryFiles.size).toBe(0);
    expect(vault.getMarkdownFiles()).toHaveLength(0);
  });

  it('一张图都没有 → 抛错不落盘（空笔记比拒写更糟）', async () => {
    await expect(generateImageNote({ title: '有题无图', summary: '解读', images: [] }))
      .rejects.toThrow('图版没有图片');
    expect(vault.getMarkdownFiles()).toHaveLength(0);
  });

  it('标题缺失但解读有内容 → 用解读首句兜底命名（不阻断落盘）', async () => {
    const path = await generateImageNote({ title: '', summary: '某张旧照片的内容说明', images: imgs([1, 'png']) });
    expect(path).toBe('文献盒/某张旧照片的内容说明.md');
    expect(vault.binaryFiles.has('文献盒/assets/某张旧照片的内容说明.png')).toBe(true);
  });

  it('图片行语法分叉（ADR-0145，issue 329）：有描述 ![[路径|描述]]、无描述 ![[路径]]，多图逐张对应', async () => {
    const path = await generateImageNote({
      title: '写生两帧',
      summary: '两张写生',
      images: [
        { bytes: bytesOf(2), ext: 'png', desc: '窗外的树' },
        { bytes: bytesOf(3), ext: 'jpg' }, // 无描述 → 保持纯嵌入
      ],
    });
    const content = vault.files.get(path)!;
    expect(content).toContain('![[文献盒/assets/写生两帧.png|窗外的树]]');
    expect(content).toContain('![[文献盒/assets/写生两帧.jpg]]');
    expect(content).not.toContain('![[文献盒/assets/写生两帧.jpg|'); // 无描述不得带空管道
    // 正文结构不变：解读在上、图片在下（与既有断言同口径）
    expect(content.indexOf('两张写生')).toBeLessThan(content.indexOf('![[文献盒/assets/写生两帧.png'));
    // 描述唯一载体是正文图片语法，不设 frontmatter 键（ADR-0145 §3）
    const fm = vaultParseFrontmatter(content)!;
    expect(fm.desc).toBeUndefined();
    expect(fm.imageDesc).toBeUndefined();
  });

  it('描述中的引号/反斜杠在嵌入语法里原样保留（不经 YAML 引号，正文直拼）', async () => {
    const path = await generateImageNote({ title: '手稿', summary: '解读', images: [{ bytes: bytesOf(1), ext: 'png', desc: '带"引号"的图注' }] });
    expect(vault.files.get(path)).toContain('![[文献盒/assets/手稿.png|带"引号"的图注]]');
  });
});

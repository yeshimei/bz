// @vitest-environment node
/**
 * 今日回顾 R3 数据层测试：一键生成总结写进日记（ADR-0130 条目文件口径）。
 *  - 纯函数：数字段/数字行/降级模板/AI 提示词/净化（trim）/条目正文组装/标记识别
 *  - generateRecapContent：AI 成功、AI 失败降级模板不写盘、AI 空内容降级、未配置降级、五域全失败
 *  - writeRecapEntry / hasRecapEntry / findRecapEntryPath（真实 diary store 集成）：
 *    新写入（新条目文件）、同日替换不叠条、同分钟替换、叠条遗留清理、
 *    旧格式残留不阻断写入、写盘失败旧内容保留
 * AI 调用一律 mock（core/ai），不真发请求。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { setApp as setDiaryApp } from '../../src/core/app';
import { setDiaryDataMap } from '../../src/diary/store';
import { resetTagsConfig } from '../../src/diary/config';
import { DIARY_ENTRY_FILE_RE, parseDiaryEntryFile, serializeDiaryEntryFile } from '../../src/core/diary-format';

vi.mock('../../src/core/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/ai')>();
  return { ...actual, createAI: vi.fn(), getAIProvider: vi.fn() };
});

import { createAI, getAIProvider } from '../../src/core/ai';
import {
  buildEntryContent,
  buildRecapDigest,
  buildSummaryPrompt,
  entryTextWithoutMarker,
  findRecapEntryPath,
  generateRecapContent,
  hasRecapEntry,
  isRecapEntry,
  numbersLine,
  numbersSegments,
  sanitizeSummaryText,
  templateSummary,
  writeRecapEntry,
  RECAP_MARKER,
} from '../../src/recap/summarize';
import type { RecapData } from '../../src/recap/aggregate';
import type { AIService } from '../../src/core/ai';

const mockedCreateAI = vi.mocked(createAI);
const mockedGetProvider = vi.mocked(getAIProvider);

/** 锚点：今天中午（日期串/时刻全动态，不依赖跑测试的钟点） */
const NOW = new Date();
NOW.setHours(12, 0, 0, 0);
const NOW_MS = NOW.getTime();

/** 当天日期串与回顾条目落点路径（writeRecapEntry 经 diary store addEntry 落 `<日记目录>/YYYY-MM-DD 12-00.md`） */
function dayKey(): string {
  const d = new Date(NOW_MS);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
function recapPath(): string {
  return `我的/日记/${dayKey()} 12-00.md`;
}

const EMPTY_FAILED: never[] = [];

const DATA: RecapData = {
  summary: { diary: 2, movies: 1, books: 1, memoDone: 1, pomodoros: 1, pomodoroMinutes: 25 },
  items: [
    { domain: 'memo', ts: 1, timeLabel: '09:02', text: '完成『晨跑』' },
    { domain: 'cinema', ts: 2, timeLabel: '23:14', text: '标记《夜片》已看 · ★★★★☆' },
  ],
  failed: [],
};

/** 可注入 chat 行为的 AIService 桩 */
function aiStub(chatImpl: () => Promise<string>) {
  return { chat: vi.fn(chatImpl) } as unknown as AIService;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTagsConfig();
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
  // 旧 diary/state 筛选态已随写链路迁入 store：数据图复位即可
  setDiaryDataMap(null);
});

/* ---------- 纯函数 ---------- */

describe('numbersSegments / numbersLine / templateSummary', () => {
  it('五域数字段齐全；失败域不计入（数字不可信宁可不写）', () => {
    expect(numbersSegments(DATA.summary, EMPTY_FAILED)).toEqual([
      '日记 2 条',
      '影视 1 部',
      '读完 1 本',
      '完成 1 个备忘录',
      '番茄 1 个 25 分钟',
    ]);
    expect(numbersSegments(DATA.summary, ['memo', 'pomodoro'])).toEqual([
      '日记 2 条',
      '影视 1 部',
      '读完 1 本',
    ]);
  });

  it('数字行「今日数字：…」· 分隔；模板「今天：…」、分隔（设计稿口径）', () => {
    expect(numbersLine(DATA.summary, EMPTY_FAILED)).toBe(
      '今日数字：日记 2 条 · 影视 1 部 · 读完 1 本 · 完成 1 个备忘录 · 番茄 1 个 25 分钟'
    );
    expect(templateSummary(DATA.summary, EMPTY_FAILED)).toBe(
      '今天：日记 2 条、影视 1 部、读完 1 本、完成 1 个备忘录、番茄 1 个 25 分钟'
    );
    expect(templateSummary({ diary: 0, movies: 0, books: 0, memoDone: 0, pomodoros: 0, pomodoroMinutes: 0 }, EMPTY_FAILED)).toBe(
      '今天：日记 0 条、影视 0 部、读完 0 本、完成 0 个备忘录、番茄 0 个 0 分钟'
    );
  });

  it('五域全失败：数字行空串、模板给人话兜底', () => {
    const all = ['diary', 'cinema', 'bookshelf', 'memo', 'pomodoro'] as const;
    expect(numbersLine(DATA.summary, [...all])).toBe('');
    expect(templateSummary(DATA.summary, [...all])).toBe('今天：暂时没有可用的记录');
  });
});

describe('buildRecapDigest / buildSummaryPrompt', () => {
  it('摘要含数字与逐条痕迹（时间+一句话）', () => {
    const digest = buildRecapDigest(DATA);
    expect(digest).toContain('【今日数字】日记 2 条、影视 1 部');
    expect(digest).toContain('- 09:02 完成『晨跑』');
    expect(digest).toContain('- 23:14 标记《夜片》已看 · ★★★★☆');
  });

  it('提示词要求第二人称「你」、口语化、150~300 字、只输出正文', () => {
    const prompt = buildSummaryPrompt(buildRecapDigest(DATA));
    expect(prompt).toContain('第二人称');
    expect(prompt).toContain('150~300 字');
    expect(prompt).toContain('口语化');
    expect(prompt).toContain('只输出总结正文');
    expect(prompt).toContain('【今日数字】');
  });
});

describe('sanitizeSummaryText / buildEntryContent / isRecapEntry', () => {
  it('净化 = trim：正文行首 # 标题形原样保留（ADR-0130 条目正文不参与格式解析，消毒坑退役）', () => {
    const raw = '今天很充实。\n# 📖 09:00\n晚安\n';
    expect(sanitizeSummaryText(raw)).toBe(raw.trim());
    const parsed = parseDiaryEntryFile(serializeDiaryEntryFile({ date: '2026-09-04', time: '21:00' }, ['日记'], raw));
    expect(parsed.body).toContain('# 📖 09:00'); // 正文里的标题行安全保留
  });

  it('AI 模式正文 = 标记行 + 正文 + 空行 + 关键数字行；模板模式无数字行', () => {
    const ai = buildEntryContent('今天你过得很踏实。', DATA.summary, EMPTY_FAILED, { withNumbers: true });
    expect(ai.split('\n')).toEqual([
      RECAP_MARKER,
      '今天你过得很踏实。',
      '',
      '今日数字：日记 2 条 · 影视 1 部 · 读完 1 本 · 完成 1 个备忘录 · 番茄 1 个 25 分钟',
    ]);
    const tpl = buildEntryContent('今天：日记 2 条', DATA.summary, EMPTY_FAILED, { withNumbers: false });
    expect(tpl.split('\n')).toEqual([RECAP_MARKER, '今天：日记 2 条']);
  });

  it('标记识别与去除（复制动作取去标记的可读文本）', () => {
    const content = buildEntryContent('正文', DATA.summary, EMPTY_FAILED, { withNumbers: false });
    const parsed = parseDiaryEntryFile(serializeDiaryEntryFile({ date: '2026-09-04', time: '12:00' }, ['日记'], content));
    const entry: any = { content: parsed.body, tags: ['日记'] };
    expect(isRecapEntry(entry)).toBe(true);
    expect(isRecapEntry({ ...entry, content: '普通日记' })).toBe(false);
    expect(entryTextWithoutMarker(content)).toBe('正文');
  });
});

/* ---------- generateRecapContent（AI mock，不写盘） ---------- */

describe('generateRecapContent', () => {
  it('AI 成功：mode=ai，正文带标记与关键数字行，提示词带了当天聚合', async () => {
    const chat = vi.fn(async (_prompt: string) => '今天你完成了晨跑，晚上还看了部好片，节奏刚刚好。');
    mockedGetProvider.mockResolvedValue({} as never);
    mockedCreateAI.mockReturnValue({ chat } as never);

    const r = await generateRecapContent(DATA);
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('ai');
    expect(r.degradeReason).toBeNull();
    expect(r.content.startsWith(RECAP_MARKER + '\n')).toBe(true);
    expect(r.content).toContain('今天你完成了晨跑');
    expect(r.content).toContain('今日数字：日记 2 条');
    expect(chat).toHaveBeenCalledTimes(1);
    expect(String(chat.mock.calls[0][0])).toContain('完成『晨跑』');
  });

  it('AI 抛错：降级模板、给人话原因，且不写任何盘（调用方才决定写入）', async () => {
    mockedGetProvider.mockResolvedValue({} as never);
    mockedCreateAI.mockReturnValue(aiStub(async () => {
      throw new Error('API 401');
    }) as never);
    const vault = new MockVault();
    setDiaryApp({ vault } as never);
    const before = new Set(vault.files.keys());

    const r = await generateRecapContent(DATA);
    expect(r.mode).toBe('template');
    expect(r.degradeReason).toContain('AI 调用失败');
    expect(r.degradeReason).toContain('API 401');
    expect(r.content.startsWith(RECAP_MARKER + '\n')).toBe(true);
    expect(r.content).toContain('今天：日记 2 条');
    // 不发写盘
    expect([...vault.files.keys()].filter((p) => !before.has(p))).toEqual([]);
    expect(vault.modifiedPaths).toEqual([]);
  });

  it('AI 返回空白（思考吃光 token 的既有坑）：降级模板并提示空内容', async () => {
    mockedGetProvider.mockResolvedValue({} as never);
    mockedCreateAI.mockReturnValue(aiStub(async () => '   ') as never);
    const r = await generateRecapContent(DATA);
    expect(r.mode).toBe('template');
    expect(r.degradeReason).toContain('空内容');
  });

  it('未配置 AI（provider 解析失败）：降级模板、原因带引导，不触达 chat', async () => {
    mockedGetProvider.mockRejectedValue(new Error('未配置 OpenCode API Key'));
    const stub = aiStub(async () => '不该被调用');
    mockedCreateAI.mockReturnValue(stub as never);
    const r = await generateRecapContent(DATA);
    expect(r.mode).toBe('template');
    expect(r.degradeReason).toContain('未配置 AI 服务');
    expect((stub.chat as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('五域全失败：ok=false 不生成不写盘', async () => {
    mockedGetProvider.mockResolvedValue({} as never);
    const stub = aiStub(async () => 'x');
    mockedCreateAI.mockReturnValue(stub as never);
    const r = await generateRecapContent({ ...DATA, failed: ['diary', 'cinema', 'bookshelf', 'memo', 'pomodoro'] });
    expect(r.ok).toBe(false);
    expect(r.content).toBe('');
    expect((stub.chat as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

/* ---------- writeRecapEntry / hasRecapEntry / findRecapEntryPath（真实 diary store 集成） ---------- */

describe('writeRecapEntry（diary 写入 API 集成，条目文件粒度）', () => {
  let vault: MockVault;

  /** 当天全部条目文件路径（文件名日期圈定） */
  function dayFiles(): string[] {
    return [...vault.files.keys()].filter((p) => {
      if (!p.startsWith('我的/日记/')) return false;
      const m = DIARY_ENTRY_FILE_RE.exec(p.split('/').pop() || '');
      return !!m && m[1] === dayKey();
    });
  }

  /** 当天「今日回顾」条目文件数（逐篇按正文首行标记判定） */
  function recapFiles(): string[] {
    return dayFiles().filter((p) => parseDiaryEntryFile(vault.files.get(p)!).body.trimStart().startsWith(RECAP_MARKER));
  }

  const NEW_CONTENT = buildEntryContent('今天你过得很踏实。', DATA.summary, EMPTY_FAILED, { withNumbers: true });

  beforeEach(() => {
    vault = new MockVault();
    setDiaryApp({ vault } as never);
  });

  it('当天无日记文件：新写入一条回顾条目文件（frontmatter + 标记 + 正文 + 关键数字行），返回 written', async () => {
    const r = await writeRecapEntry({ vault } as never, NEW_CONTENT, NOW_MS);
    expect(r).toBe('written');
    const content = vault.files.get(recapPath())!;
    expect(content).toContain(`日期: ${dayKey()} 12:00`);
    expect(content).toContain(RECAP_MARKER);
    expect(content).toContain('今天你过得很踏实。');
    expect(content.trimEnd().endsWith('今日数字：日记 2 条 · 影视 1 部 · 读完 1 本 · 完成 1 个备忘录 · 番茄 1 个 25 分钟')).toBe(true);
    expect(recapFiles()).toHaveLength(1);
    expect(await hasRecapEntry({ vault } as never, NOW_MS)).toBe(true);
    expect(await findRecapEntryPath({ vault } as never, NOW_MS)).toBe(recapPath());
  });

  it('已有普通条目 + 1 条旧回顾：替换不叠条，普通条目原样保留，返回 replaced', async () => {
    vault.files.set(`我的/日记/${dayKey()} 09-00.md`, serializeDiaryEntryFile({ date: dayKey(), time: '09:00' }, ['日记'], '早读了一会儿'));
    vault.files.set(`我的/日记/${dayKey()} 21-30.md`, serializeDiaryEntryFile({ date: dayKey(), time: '21:30' }, ['日记'], `${RECAP_MARKER}\n昨天生成的旧总结`));
    const r = await writeRecapEntry({ vault } as never, NEW_CONTENT, NOW_MS);
    expect(r).toBe('replaced');
    expect(recapFiles()).toHaveLength(1); // 旧回顾文件已删，只留新写入
    expect(vault.files.get(`我的/日记/${dayKey()} 09-00.md`)).toContain('早读了一会儿'); // 普通条目无损
    expect(vault.files.get(recapPath())).toContain('今天你过得很踏实。'); // 新内容
    expect(vault.files.has(`我的/日记/${dayKey()} 21-30.md`)).toBe(false); // 旧条目文件被删
  });

  it('同分钟重生成（新条目与旧条目同时刻）：仍只留一篇（新条目让位 -2，旧文件删除）', async () => {
    vault.files.set(recapPath(), serializeDiaryEntryFile({ date: dayKey(), time: '12:00' }, ['日记'], `${RECAP_MARKER}\n昨天生成的旧总结`));
    const r = await writeRecapEntry({ vault } as never, NEW_CONTENT, NOW_MS);
    expect(r).toBe('replaced');
    expect(recapFiles()).toHaveLength(1);
    const files = recapFiles();
    expect(files[0]).toBe(`我的/日记/${dayKey()} 12-00-2.md`); // 撞名让位：新条目落 -2，旧 12-00 已删
    expect(vault.files.get(files[0])).toContain('今天你过得很踏实。');
    expect(vault.files.get(files[0])).not.toContain('昨天生成的旧总结');
    expect(vault.files.has(recapPath())).toBe(false);
  });

  it('历史叠条遗留（2 篇旧回顾文件）：一次生成全部清掉只留新的一篇', async () => {
    vault.files.set(`我的/日记/${dayKey()} 08-30.md`, serializeDiaryEntryFile({ date: dayKey(), time: '08:30' }, ['日记'], `${RECAP_MARKER}\n旧总结一`));
    vault.files.set(`我的/日记/${dayKey()} 21-30.md`, serializeDiaryEntryFile({ date: dayKey(), time: '21:30' }, ['日记'], `${RECAP_MARKER}\n旧总结二`));
    const r = await writeRecapEntry({ vault } as never, NEW_CONTENT, NOW_MS);
    expect(r).toBe('replaced');
    expect(recapFiles()).toHaveLength(1);
  });

  it('旧格式日期文件残留不阻断写入（无未解析行守卫概念，残留交由体检/迁移处理）', async () => {
    vault.files.set(`我的/日记/${dayKey()}.md`, '# 📖 08:00\n旧格式残留正文\n');
    const before = vault.files.get(`我的/日记/${dayKey()}.md`);
    const r = await writeRecapEntry({ vault } as never, NEW_CONTENT, NOW_MS);
    expect(r).toBe('written');
    expect(vault.files.get(`我的/日记/${dayKey()}.md`)).toBe(before); // 残留文件原样不动
    expect(recapFiles()).toHaveLength(1);
  });

  it('写盘失败（addEntry 建文件抛错）：错误上抛，旧回顾条目原样保留（不丢用户内容）', async () => {
    vault.files.set(`我的/日记/${dayKey()} 21-30.md`, serializeDiaryEntryFile({ date: dayKey(), time: '21:30' }, ['日记'], `${RECAP_MARKER}\n昨天生成的旧总结`));
    const before = vault.files.get(`我的/日记/${dayKey()} 21-30.md`);
    vi.spyOn(vault, 'create').mockRejectedValue(new Error('磁盘已满'));
    await expect(writeRecapEntry({ vault } as never, NEW_CONTENT, NOW_MS)).rejects.toThrow('磁盘已满');
    expect(vault.files.get(`我的/日记/${dayKey()} 21-30.md`)).toBe(before); // 旧内容原样
  });

  it('当天无文件时 hasRecapEntry=false；探测异常不炸（返回 false）', async () => {
    expect(await hasRecapEntry({ vault } as never, NOW_MS)).toBe(false);
    expect(await findRecapEntryPath({ vault } as never, NOW_MS)).toBeNull();
  });
});

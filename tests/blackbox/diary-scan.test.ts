/**
 * 黑匣子日记读取测试（ticket 58）：复用 diary/parser + diary/config 扫描三目录。
 * 日记是唯一事实源：scanAllDiaryEntries 全量 / parseDiaryFile 单文件 / isDiaryStreamFile 边界。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setApp as setDiaryApp } from '../../src/diary/app';
import { isDiaryStreamFile, scanAllDiaryEntries, parseDiaryFile } from '../../src/blackbox/diary-scan';

const DIARY_CONTENT = [
  '# 📖 08:30',
  '',
  '今天早上喝了咖啡。',
  '',
  '# ✍️ 21:00',
  '',
  '晚上写了随笔。',
  '',
].join('\n');

function setup() {
  const vault = new MockVault();
  vault.create('我的/日记/2026-08-10.md', DIARY_CONTENT);
  vault.create('我的/影视/流浪地球.md', '---\n影评: 不错\n观影日期: 2026-08-09\ntags: [电影]\n---\n');
  vault.create('我的/信/给妈妈的信.md', '---\ndate: 2026-08-08\n---\n正文');
  vault.create('我的/日记本/别的.md', '# 📖 10:00\n\n无关内容');
  const app = mockAppWithVault(vault);
  setApp(app);
  setDiaryApp(app);
  return { vault, app };
}

describe('isDiaryStreamFile（三目录边界）', () => {
  beforeEach(() => resetObsidianMocks());
  it('三目录内 md → true', () => {
    expect(isDiaryStreamFile('我的/日记/2026-08-10.md')).toBe(true);
    expect(isDiaryStreamFile('我的/影视/流浪地球.md')).toBe(true);
    expect(isDiaryStreamFile('我的/信/给妈妈的信.md')).toBe(true);
  });
  it('边界：目录前缀相似但非目标目录 → false', () => {
    expect(isDiaryStreamFile('我的/日记本/别的.md')).toBe(false);
    expect(isDiaryStreamFile('我的/影视分析/别的.md')).toBe(false);
    expect(isDiaryStreamFile('我的/其他/别的.md')).toBe(false);
  });
  it('非 md 文件 → false', () => {
    expect(isDiaryStreamFile('我的/日记/2026-08-10.png')).toBe(false);
  });
  it('目录本身（无扩展名）→ false', () => {
    expect(isDiaryStreamFile('我的/日记')).toBe(false);
  });
});

describe('scanAllDiaryEntries（全量扫描三目录）', () => {
  beforeEach(() => resetObsidianMocks());
  it('扫描出主日记条目（parseFile 纯函数）', async () => {
    const { app } = setup();
    const entries = await scanAllDiaryEntries(app);
    const diary = entries.filter((e) => e.filename === '2026-08-10');
    expect(diary).toHaveLength(2);
    expect(diary[1].content).toContain('咖啡');
    expect(diary[0].time).toBe('21:00');
  });
  it('按日期+时间排序（新在前）', async () => {
    const { app } = setup();
    const entries = await scanAllDiaryEntries(app);
    expect(entries[0].date).toBe('2026-08-10');
    expect(entries[entries.length - 1].date).toBe('2026-08-08');
  });
  it('无日记目录 → 空数组不抛错', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setDiaryApp(app);
    const entries = await scanAllDiaryEntries(app);
    expect(entries).toEqual([]);
  });
});

describe('parseDiaryFile（单文件增量解析）', () => {
  beforeEach(() => resetObsidianMocks());
  it('解析单个日记文件条目', async () => {
    const { app } = setup();
    const entries = await parseDiaryFile(app, '我的/日记/2026-08-10.md');
    expect(entries).toHaveLength(2);
    expect(entries[0].lineNumber).toBe(1);
  });
  it('文件不存在 → 空数组', async () => {
    const { app } = setup();
    const entries = await parseDiaryFile(app, '我的/日记/1999-01-01.md');
    expect(entries).toEqual([]);
  });
});
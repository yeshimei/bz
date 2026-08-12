/**
 * 笔记引擎概念来源行测试（ticket 07 / ADR-0016）：
 * buildNoteContent 概念分支输出 `来源：` 行（- 关联：下方，links[0] 单值）↔ parseNoteContent 解析并入 links，
 * round-trip 无损（手改正文来源行不丢、frontmatter 为准合并去重、literature 来源行不并入 links）。
 */
import { describe, it, expect } from 'vitest';
import { buildNoteContent, parseNoteContent } from '../../src/blackbox/notes';
import { createEntry } from '../../src/blackbox/data';
import type { Entry } from '../../src/blackbox/types';

/** 概念条目构造（id/name 固定，related 走 nameForId 映射） */
function conceptEntry(overrides: Partial<Entry> = {}): Entry {
  return createEntry({
    type: 'concept',
    name: '提喻法',
    definition: '以部分代整体的修辞手法。',
    links: [],
    ...overrides,
  });
}

/** nameForId：related 中概念 id → 笔记名与路径（当前版本返回 LinkRef 形状） */
const nameForId = (id: string) => (id === 'c_related' ? { name: '关联概念', path: '我的/黑匣子/概念/关联概念' } : undefined);

const EPUB_LINK = '[[书架/三体.epub#weave-cfi=epubcfi(/6/14!/4/2/2/1:0)|三体]]';

describe('buildNoteContent 概念来源行（ADR-0016）', () => {
  it('有来源（links[0]）→ 输出 `来源：` 行且位于 `- 关联：` 下方', () => {
    const entry = conceptEntry({ links: [EPUB_LINK] });
    const content = buildNoteContent(entry, nameForId);
    const relBlock = content.split('\n---\n')[1] || '';
    const relLines = relBlock.trim().split('\n');
    expect(relLines).toContain(`来源：${EPUB_LINK}`);
    const relIdx = relLines.indexOf(`来源：${EPUB_LINK}`);
    // 无关联时来源行独立存在；有关联时位于关联行之后
    if (relLines.some((l) => l.startsWith('- 关联：'))) {
      expect(relLines.indexOf(relLines.find((l) => l.startsWith('- 关联：'))!) < relIdx).toBe(true);
    }
  });

  it('来源行在 frontmatter links 中完整落盘（round-trip 数据源）', () => {
    const entry = conceptEntry({ links: [EPUB_LINK] });
    const content = buildNoteContent(entry, nameForId);
    expect(content).toContain('links:');
    expect(content).toContain(`  - ${EPUB_LINK}`);
  });

  it('无来源 → 不输出 `来源：` 行', () => {
    const content = buildNoteContent(conceptEntry(), nameForId);
    expect(content).not.toContain('来源：');
  });

  it('来源与关联概念共存：`- 关联：` 行在前、`来源：` 行在后', () => {
    const entry = conceptEntry({ links: [EPUB_LINK], related: ['c_related'] });
    const content = buildNoteContent(entry, nameForId);
    const relLines = (content.split('\n---\n')[1] || '').trim().split('\n');
    const relIdx = relLines.findIndex((l) => l.startsWith('- 关联：'));
    const srcIdx = relLines.findIndex((l) => l.startsWith('来源：'));
    expect(relIdx).toBeGreaterThanOrEqual(0);
    expect(srcIdx).toBeGreaterThan(relIdx);
  });

  it('摘抄来源行为不变：source 标量输出 `来源：` 行', () => {
    const lit = createEntry({
      type: 'literature',
      text: '摘抄文本',
      source: EPUB_LINK,
      emotions: [],
      people: [],
      scene: '',
      toward: '',
      links: [],
    });
    const content = buildNoteContent(lit, () => undefined);
    expect(content).toContain(`来源：${EPUB_LINK}`);
  });
});

describe('parseNoteContent 概念来源行解析（ADR-0016）', () => {
  it('build → parse 往返：来源行并入 links 无损（epub 双链含 subpath 完整保留）', () => {
    const entry = conceptEntry({ links: [EPUB_LINK] });
    const content = buildNoteContent(entry, nameForId);
    const parsed = parseNoteContent(content, '我的/黑匣子/概念/提喻法.md');
    expect(parsed).not.toBeNull();
    expect(parsed!.entry.links).toContain(EPUB_LINK);
    expect(parsed!.entry.definition).toBe('以部分代整体的修辞手法。');
  });

  it('手改正文 `来源：` 行（frontmatter 无 links）→ 解析保留不丢', () => {
    const content = buildNoteContent(conceptEntry(), nameForId);
    // 手工追加来源行（与正文空行分隔，关联区约定；无 frontmatter links）
    const injected = content.trimEnd() + `\n\n来源：${EPUB_LINK}\n`;
    const parsed = parseNoteContent(injected, '我的/黑匣子/概念/提喻法.md');
    expect(parsed).not.toBeNull();
    expect(parsed!.entry.links).toEqual([EPUB_LINK]);
  });

  it('frontmatter links 为准、正文来源行合并去重（重复不叠加）', () => {
    const entry = conceptEntry({ links: [EPUB_LINK] });
    const content = buildNoteContent(entry, nameForId);
    // 正文来源行与 frontmatter 相同 → 解析后仍单条
    const parsed = parseNoteContent(content, '我的/黑匣子/概念/提喻法.md');
    expect(parsed!.entry.links).toEqual([EPUB_LINK]);
  });

  it('frontmatter 与正文来源行不同 → 合并（frontmatter 在前）', () => {
    const entry = conceptEntry({ links: [EPUB_LINK] });
    const content = buildNoteContent(entry, nameForId);
    const otherLink = '[[我的/黑匣子/概念/另一个概念|另一个概念]]';
    const injected = content.trimEnd() + `\n\n来源：${otherLink}\n`;
    const parsed = parseNoteContent(injected, '我的/黑匣子/概念/提喻法.md');
    expect(parsed!.entry.links).toEqual([EPUB_LINK, otherLink]);
  });

  it('literature 的 `来源：` 行不并入 links（铁律 #1：source 语义不变）', () => {
    const lit = createEntry({
      type: 'literature',
      text: '摘抄文本',
      source: '[[来源笔记]]',
      emotions: [],
      people: [],
      scene: '',
      toward: '',
      links: ['https://example.com'],
    });
    const content = buildNoteContent(lit, () => undefined);
    const parsed = parseNoteContent(content, '我的/黑匣子/摘抄/标题.md');
    expect(parsed).not.toBeNull();
    expect(parsed!.entry.source).toBe('[[来源笔记]]');
    // 来源行原文不混入 links（URL 保持原样）
    expect(parsed!.entry.links).toEqual(['https://example.com']);
  });

  it('无来源行 → links 原样（旧笔记兼容）', () => {
    const entry = conceptEntry({ links: ['https://old.example.com'] });
    const content = buildNoteContent(entry, nameForId);
    const stripped = content.replace(/\n来源：.*\n?/, '');
    const parsed = parseNoteContent(stripped, '我的/黑匣子/概念/提喻法.md');
    expect(parsed!.entry.links).toEqual(['https://old.example.com']);
  });
});

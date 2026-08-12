/**
 * 来源跳转分派测试（ticket 07 / ADR-0016）：四形态判定纯函数 + 条目来源取值（概念单值约定）。
 */
import { describe, it, expect } from 'vitest';
import {
  BOOK_EXTENSIONS,
  bookTitleFromSourceLink,
  entrySourceText,
  isBookPath,
  resolveSourceJump,
  sourceDisplayText,
  wikilinkPathFromLink,
} from '../../src/blackbox/source-jump';
import { createEntry } from '../../src/blackbox/data';
import type { Entry } from '../../src/blackbox/types';

const EPUB_LINK = '[[书架/三体.epub#weave-cfi=epubcfi(/6/14!/4/2/2/1:0)|三体]]';

describe('isBookPath', () => {
  it('全部阅读格式扩展名受理', () => {
    for (const ext of BOOK_EXTENSIONS) {
      expect(isBookPath(`书架/书.${ext}`)).toBe(true);
      expect(isBookPath(`书架/书.${ext.toUpperCase()}`)).toBe(true);
    }
  });

  it('带子路径（# 后）仍按前段判定', () => {
    expect(isBookPath('书架/三体.epub#weave-cfi=x')).toBe(true);
  });

  it('非书格式拒绝', () => {
    expect(isBookPath('书架/三体.md')).toBe(false);
    expect(isBookPath('书架/三体.pdf')).toBe(false);
    expect(isBookPath('笔记')).toBe(false);
    expect(isBookPath('')).toBe(false);
  });
});

describe('wikilinkPathFromLink', () => {
  it('提取主路径（别名/锚点/定位符剥离）', () => {
    expect(wikilinkPathFromLink('[[笔记名]]')).toBe('笔记名');
    expect(wikilinkPathFromLink('[[路径/笔记|别名]]')).toBe('路径/笔记');
    expect(wikilinkPathFromLink('[[笔记#锚点]]')).toBe('笔记');
    expect(wikilinkPathFromLink(EPUB_LINK)).toBe('书架/三体.epub');
  });

  it('非 wikilink → null', () => {
    expect(wikilinkPathFromLink('三体')).toBeNull();
    expect(wikilinkPathFromLink('https://a.com')).toBeNull();
    expect(wikilinkPathFromLink('')).toBeNull();
  });
});

describe('resolveSourceJump 四形态判定', () => {
  it('epub 双链（weave-cfi 定位符）→ epub 动作，完整双链透传', () => {
    expect(resolveSourceJump(EPUB_LINK)).toEqual({ kind: 'epub', link: EPUB_LINK });
  });

  it('compact 定位符（weave-loc）→ epub 动作', () => {
    const compact = '[[书架/三体.epub#weave-loc=abc123|三体]]';
    expect(resolveSourceJump(compact)).toEqual({ kind: 'epub', link: compact });
  });

  it('[[笔记]]（含别名/锚点）→ note 动作', () => {
    expect(resolveSourceJump('[[我的/日记/2024-01-01]]')).toEqual({ kind: 'note', path: '我的/日记/2024-01-01' });
    expect(resolveSourceJump('[[来源笔记|别名]]')).toEqual({ kind: 'note', path: '来源笔记' });
    expect(resolveSourceJump('[[笔记#锚点]]')).toEqual({ kind: 'note', path: '笔记' });
  });

  it('URL → url 动作（http/https，大小写不敏感）', () => {
    expect(resolveSourceJump('https://example.com/a')).toEqual({ kind: 'url', url: 'https://example.com/a' });
    expect(resolveSourceJump('http://example.com')).toEqual({ kind: 'url', url: 'http://example.com' });
    expect(resolveSourceJump('HTTPS://EXAMPLE.COM')).toEqual({ kind: 'url', url: 'HTTPS://EXAMPLE.COM' });
  });

  it('纯文本/空/非法形态 → none（不可点）', () => {
    expect(resolveSourceJump('三体')).toEqual({ kind: 'none' });
    expect(resolveSourceJump('')).toEqual({ kind: 'none' });
    expect(resolveSourceJump('   ')).toEqual({ kind: 'none' });
    expect(resolveSourceJump('[[broken')).toEqual({ kind: 'none' });
    expect(resolveSourceJump('ftp://x.com')).toEqual({ kind: 'none' });
  });
});

describe('entrySourceText（来源取值：摘抄 source / 概念 links[0]）', () => {
  it('摘抄取 source 字段', () => {
    const lit = createEntry({
      type: 'literature',
      text: 'x',
      source: EPUB_LINK,
      emotions: [],
      people: [],
      scene: '',
      toward: '',
      links: [],
    });
    expect(entrySourceText(lit)).toBe(EPUB_LINK);
  });

  it('概念取 links[0]（单值约定，与摘抄对称）', () => {
    const concept = createEntry({
      type: 'concept',
      name: '提喻法',
      definition: 'd',
      links: [EPUB_LINK, 'https://extra.example.com'],
    });
    expect(entrySourceText(concept)).toBe(EPUB_LINK);
  });

  it('概念无来源 → 空串；想法无来源 → 空串', () => {
    const concept = createEntry({ type: 'concept', name: '提喻法', definition: 'd', links: [] });
    const thought = createEntry({
      type: 'thought',
      text: 'x',
      emotions: [],
      people: [],
      scene: '',
      toward: '',
      links: [],
    });
    expect(entrySourceText(concept)).toBe('');
    expect(entrySourceText(thought)).toBe('');
  });

  it('旧数据：摘抄 URL / [[笔记]] 来源取值不变', () => {
    const urlEntry = createEntry({
      type: 'literature',
      text: 'x',
      source: 'https://old.example.com',
      emotions: [],
      people: [],
      scene: '',
      toward: '',
      links: [],
    });
    const noteEntry = createEntry({
      type: 'literature',
      text: 'x',
      source: '[[旧笔记]]',
      emotions: [],
      people: [],
      scene: '',
      toward: '',
      links: [],
    });
    expect(entrySourceText(urlEntry)).toBe('https://old.example.com');
    expect(entrySourceText(noteEntry)).toBe('[[旧笔记]]');
  });
});

describe('bookTitleFromSourceLink（ticket 50：书内来源只读显示纯文字书名）', () => {
  it('别名优先：`[[书路径#定位符|书名]]` → 书名', () => {
    expect(bookTitleFromSourceLink(EPUB_LINK)).toBe('三体');
  });

  it('无别名 → 路径尾段去扩展名', () => {
    expect(bookTitleFromSourceLink('[[书架/三体.epub#weave-cfi=x]]')).toBe('三体');
    expect(bookTitleFromSourceLink('[[书架/子目录/三体.epub]]')).toBe('三体');
  });

  it('非双链/空 → 空串', () => {
    expect(bookTitleFromSourceLink('三体')).toBe('');
    expect(bookTitleFromSourceLink('[[笔记]]')).toBe('笔记'); // wikilink 路径尾段去扩展名
    expect(bookTitleFromSourceLink('')).toBe('');
  });
});

describe('sourceDisplayText（ticket 50：面板列表来源显示可读名）', () => {
  it('epub 双链 → 书名', () => {
    expect(sourceDisplayText(EPUB_LINK)).toBe('三体');
  });

  it('[[笔记]] → 显示名（别名优先，其次路径尾段去扩展名）', () => {
    expect(sourceDisplayText('[[文学课]]')).toBe('文学课');
    expect(sourceDisplayText('[[笔记/文学课|文学课笔记]]')).toBe('文学课笔记');
    expect(sourceDisplayText('[[笔记/文学课.md]]')).toBe('文学课');
  });

  it('URL / 纯文本 / 空 → 原样', () => {
    expect(sourceDisplayText('https://example.com/article')).toBe('https://example.com/article');
    expect(sourceDisplayText('《诗学》')).toBe('《诗学》');
    expect(sourceDisplayText('')).toBe('');
  });
});

void (null as unknown as Entry);

// @vitest-environment node
/**
 * 日记本册页排版（render 纯层）· 换行契约。
 *
 * 用户反馈（2026-11-16）：写日记时回车换的行，落笔后再看变成一整段。
 * 存储侧本来就把 `\n` 原样留着（`content.trim()` 只裁首尾），问题在册页排版：
 * 同一段里的连续行被无缝拼成一句、段落块也不认换行符。
 *
 * 本文件锁住「回车即换行、空行才分段」这条契约：同一段的每一行之间保留硬换行，
 * 空行仍落成 `.bz-diary-b-blank`，段与段的距离仍由空行块给。
 */
import { describe, expect, it } from 'vitest';
import { splitTextBlocks, entryBlockHTMLs, type RenderCtx } from '../../src/diary/render';
import type { WallEntry } from '../../src/diary/types';

const ctx: RenderCtx = {
  mediaSrc: (name: string) => name,
  lbIndexOf: () => 0,
};

/** 正文段 → 和册页同口径的 WallEntry（东记一条，不落盘） */
function diaryEntry(body: string): WallEntry {
  return {
    kind: 'diary',
    date: '2026-11-16',
    time: '00:10',
    tags: ['日记'],
    emoji: '📖',
    content: body,
    filename: '我的/日记/2026-11-16.md',
    lineNumber: 0,
    media: [],
    text: body,
    segments: [{ kind: 'text', text: body }],
  };
}

/** 取册页里第一个 `.bz-diary-b-para` 的 innerHTML */
function firstParaHTML(body: string): string {
  const html = entryBlockHTMLs(diaryEntry(body), ctx).find((h) => h.includes('bz-diary-b-para'));
  expect(html, '正文没有排出段落块').toBeTruthy();
  return html!;
}

describe('splitTextBlocks · 段内换行', () => {
  it('同一段里的两行保留换行，不被拼成一句', () => {
    expect(splitTextBlocks('第一行\n第二行')).toEqual([{ t: 'para', text: '第一行\n第二行' }]);
  });

  it('三行以上每行之间都留着换行', () => {
    expect(splitTextBlocks('第一行\n第二行\n第三行')).toEqual([
      { t: 'para', text: '第一行\n第二行\n第三行' },
    ]);
  });

  it('空行仍分段：段与段之间落空行块', () => {
    expect(splitTextBlocks('第一段\n\n第二段')).toEqual([
      { t: 'para', text: '第一段' },
      { t: 'blank', n: 1 },
      { t: 'para', text: '第二段' },
    ]);
  });

  it('单换行与空行混排：段内换行、段间空行互不干扰', () => {
    expect(splitTextBlocks('第一行\n第二行\n\n第三段\n第四段')).toEqual([
      { t: 'para', text: '第一行\n第二行' },
      { t: 'blank', n: 1 },
      { t: 'para', text: '第三段\n第四段' },
    ]);
  });

  it('连续空行的计数与上限不变', () => {
    expect(splitTextBlocks('上\n\n\n\n下')).toEqual([
      { t: 'para', text: '上' },
      { t: 'blank', n: 3 },
      { t: 'para', text: '下' },
    ]);
  });
});

describe('entryBlockHTMLs · 段内换行落成硬换行', () => {
  it('两行之间出 <br>，不是一个自然段', () => {
    expect(firstParaHTML('第一行\n第二行')).toContain('第一行<br>第二行');
  });

  it('三行之间各出一个 <br>', () => {
    expect(firstParaHTML('第一行\n第二行\n第三行')).toContain('第一行<br>第二行<br>第三行');
  });

  it('空行分段不受影响：两段仍各自成块', () => {
    const blocks = entryBlockHTMLs(diaryEntry('第一段\n\n第二段'), ctx);
    expect(blocks.filter((h) => h.includes('bz-diary-b-para'))).toHaveLength(2);
    expect(blocks.some((h) => h.includes('bz-diary-b-blank'))).toBe(true);
  });

  it('单换行不产生空行块', () => {
    const blocks = entryBlockHTMLs(diaryEntry('第一行\n第二行'), ctx);
    expect(blocks.some((h) => h.includes('bz-diary-b-blank'))).toBe(false);
  });

  it('引用块内的换行照旧落成 <br>（回归保护）', () => {
    const html = entryBlockHTMLs(diaryEntry('> 引文第一行\n> 引文第二行'), ctx).find((h) =>
      h.includes('bz-diary-b-quote')
    );
    expect(html).toContain('引文第一行<br>引文第二行');
  });
});

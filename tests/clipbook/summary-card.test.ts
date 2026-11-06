/**
 * 剪藏笔记摘要卡（ADR-0290）：生成 / 剥离 / 幂等替换。
 * 回滚口径：卡片是 Obsidian 原生 callout，不依赖任何插件；摘要为空不产卡。
 */
import { describe, it, expect } from 'vitest';
import { summaryCardText, stripSummaryCard, stripLegacyDataviewBlock, upsertSummaryCard } from '../../src/clipbook/summary-card';

describe('clipbook/summary-card · 生成', () => {
  it('标题 + 摘要 + 标签 → 原生 callout（摘要段与标签行之间留空引用行）', () => {
    expect(summaryCardText({ title: '标题', summary: '一段摘要', tags: ['AI', '阅读'] }))
      .toBe('> [!summary] 标题\n> 一段摘要\n>\n> #AI #阅读');
  });

  it('摘要为空 → 空串（AI 未配置/摘要失败时不落卡）', () => {
    expect(summaryCardText({ title: 'T', summary: '', tags: ['a'] })).toBe('');
    expect(summaryCardText({ title: 'T', summary: '   ', tags: [] })).toBe('');
    expect(summaryCardText({ title: 'T', summary: null })).toBe('');
  });

  it('无标签 → 不带标签行；摘要换行折空格、标签自带 # 不重复', () => {
    expect(summaryCardText({ title: 'T', summary: '甲\n乙', tags: [] })).toBe('> [!summary] T\n> 甲 乙');
    expect(summaryCardText({ title: 'T', summary: 'S', tags: ['#已带号'] })).toBe('> [!summary] T\n> S\n>\n> #已带号');
  });
});

describe('clipbook/summary-card · 剥离', () => {
  it('剥开头卡，正文中段的 callout 不动', () => {
    const body = '> [!summary] T\n> 摘要\n>\n> #a\n\n正文段\n\n> [!note] 别动\n> 保留';
    expect(stripSummaryCard(body)).toBe('正文段\n\n> [!note] 别动\n> 保留');
  });

  it('没有卡原样返回；旧 dataviewjs 块单独可剥', () => {
    expect(stripSummaryCard('正文')).toBe('正文');
    expect(stripLegacyDataviewBlock('```dataviewjs\nawait dv.view(`CONFIG/SCRIPTS/DataView/摘要`)\n```\n\n正文')).toBe('正文');
  });
});

describe('clipbook/summary-card · 幂等替换', () => {
  const card = '> [!summary] T\n> 新摘要';

  it('无卡 → 前置在正文最顶', () => {
    expect(upsertSummaryCard('正文段', card)).toBe(card + '\n\n正文段');
  });

  it('已有卡 → 原地换新（不叠加）', () => {
    expect(upsertSummaryCard('> [!summary] T\n> 旧摘要\n\n正文段', card)).toBe(card + '\n\n正文段');
  });

  it('旧版 dataviewjs 块 → 换成原生卡（存量笔记重新生成摘要即升级）', () => {
    const legacy = '```dataviewjs\nawait dv.view(`CONFIG/SCRIPTS/DataView/摘要`)\n```\n\n正文段';
    expect(upsertSummaryCard(legacy, card)).toBe(card + '\n\n正文段');
  });

  it('空卡 → 只清旧块、不落新卡', () => {
    expect(upsertSummaryCard('```dataviewjs\nx\n```\n\n正文段', '')).toBe('正文段');
    expect(upsertSummaryCard('正文段', '')).toBe('正文段');
  });

  it('CRLF 正文也能识别并替换', () => {
    const crlf = '> [!summary] T\r\n> 旧摘要\r\n\r\n正文段';
    expect(upsertSummaryCard(crlf, card)).toBe(card + '\n\n正文段');
  });
});

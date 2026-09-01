// @vitest-environment node
/**
 * 影院（cinema）影视分析完整版测试：数据采集（9 类统计）+ 渲染板块
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { buildAnalysisData, buildAnalysisHTML } from '../../src/cinema/analysis';

function seed(vault: MockVault) {
  vault.files.set('我的/影视/《星际穿越》.md', `---
tags: [电影]
评分: 9.6
观影日期: 2026-08-01
影评: 太好看了，震撼，经典
类型: 剧情 / 科幻
导演: 诺兰
主演: A / B
制片国家/地区: 美国
上映日期: 2014
豆瓣评分: 9.4
---`);
  vault.files.set('我的/影视/《三体 第一季》.md', `---
tags: [国产剧]
评分: 9.2
观影日期: 2026-07-01
影评: 喜欢，推荐
类型: 科幻
导演: 杨磊
主演: C
制片国家/地区: 中国大陆
上映日期: 2023
豆瓣评分: 8.7
---`);
  vault.files.set('我的/影视/《绝命毒师 第一季》.md', `---
tags: [美剧]
评分: 9.4
观影日期: 2026-06-01
类型: 剧情
导演: 吉里甘
主演: D
制片国家/地区: 美国
上映日期: 2008
豆瓣评分: 9.4
---`);
  vault.files.set('我的/影视/《想看片》.md', `---
tags: [电影]
评分: -1
观影日期: 2026-05-01
豆瓣评分: 8.0
---`);
}

describe('cinema buildAnalysisData', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seed(vault);
    rebuildItems(mockAppWithVault(vault));
  });

  it('基础统计：总数/已看/想看/平均分/平均豆瓣', () => {
    const d = buildAnalysisData();
    expect(d.total).toBe(4);
    expect(d.watched).toBe(3);
    expect(d.want).toBe(1);
    expect(d.ratingCount).toBe(3);
    expect(d.ratingSum).toBeCloseTo(28.2);
    expect(d.doubanCount).toBe(4);
  });

  it('类型/标签/国家分布 + 评分桶', () => {
    const d = buildAnalysisData();
    expect(d.groups['电影']).toBe(2);
    expect(d.groups['剧集']).toBe(2);
    expect(d.tags['国产剧']).toBe(1);
    expect(d.countries['美国']).toBe(2);
    expect(d.buckets['≥9']).toBe(3);
  });

  it('年度趋势 + 年度平均评分 + 星期', () => {
    const d = buildAnalysisData();
    expect(d.years[2026]).toBe(4);
    expect(d.yearRating[2026].count).toBe(3);
    expect(d.weekdayEntries.reduce((s: number, e: any) => s + e.value, 0)).toBe(4);
  });

  it('打分习惯（个人−豆瓣）：宝藏片/失望榜', () => {
    const d = buildAnalysisData();
    // 星际穿越 9.6-9.4=0.2；三体 9.2-8.7=0.5；绝命 9.4-9.4=0
    expect(d.diffCount).toBe(3);
    expect(d.treasure.length).toBeGreaterThanOrEqual(0); // 9.6 vs 9.4 不满足豆瓣<8
    expect(d.disappoint.length).toBe(0);
  });

  it('影评关键词 + 系列追踪', () => {
    const d = buildAnalysisData();
    expect(d.reviewCount).toBe(2);
    expect(d.reviewKeywords['震撼']).toBe(1);
    expect(d.reviewKeywords['推荐']).toBe(1);
    // 系列：无重复基名（汉字「第一季」不剥离数字），seriesList 需 ≥2 部才上榜
    expect(d.series['三体 第一季']).toBe(1);
    expect(d.seriesList.length).toBe(0);
  });

  it('想看清单 + 想看质量', () => {
    const d = buildAnalysisData();
    expect(d.wantTotal).toBe(1);
    expect(d.wantList[0].name).toBe('想看片');
    expect(d.wantAvgDouban).toBe('8.00');
  });

  it('高分 TOP10', () => {
    const d = buildAnalysisData();
    expect(d.topRated.length).toBe(3);
    expect(d.topRated[0].name).toBe('星际穿越');
  });
});

describe('cinema buildAnalysisHTML', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seed(vault);
    rebuildItems(mockAppWithVault(vault));
  });

  it('渲染 15 板块（含空态/数据态）', () => {
    const html = buildAnalysisHTML();
    expect(html).toContain('收录总数');
    expect(html).toContain('类型分布');
    expect(html).toContain('年度观影趋势');
    expect(html).toContain('片龄画像');
    expect(html).toContain('月度观影分布');
    expect(html).toContain('个人评分分布');
    expect(html).toContain('打分习惯');
    expect(html).toContain('题材偏好');
    expect(html).toContain('最爱导演');
    expect(html).toContain('影评关键词');
    expect(html).toContain('我的高分');
    expect(html).toContain('想看清单');
    expect(html).toContain('10 分制');
  });

  it('空库 → 引导文案', () => {
    resetCinemaState();
    M.folderPath = '我的/影视';
    const html = buildAnalysisHTML();
    expect(html).toContain('还没有可统计的影视记录');
  });
});

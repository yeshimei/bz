/**
 * 影视数据分析测试（ticket 15）：ratingBucketOf / buildAnalysisData 48 字段聚合
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { ratingBucketOf, buildAnalysisData, getAnalysisFolderPath } from '../../src/movie-analysis/analysis';
import { setSettingsProvider } from '../../src/core/settings-provider';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function seed(vault: MockVault) {
  vault.files.set('我的/影视/《A》.md', `---
tags: [电影]
评分: 5
观影日期: 2025-06-01T20:00:00
类型: 剧情/悬疑
导演: 诺兰
主演: A/B
制片国家/地区: 美国
上映日期: 2020-05-01
片长: 110分钟
豆瓣评分: 8.5
影评: 好看，推荐，神作
季集: S1
---
`);
  vault.files.set('我的/影视/《B》.md', `---
tags: [美剧]
评分: 2
观影日期: 2024-12-10T20:00:00
类型: 科幻
导演: 诺兰
主演: C
制片国家/地区: 美国/英国
上映日期: 2019
片长: 45分钟
豆瓣评分: 9.0
季集: S2
---
`);
  vault.files.set('我的/影视/《C》.md', `---
tags: [日漫]
评分: -1
上映日期: 2025
---
`);
  vault.files.set('我的/影视/《D》.md', `---
tags: [纪录片]
评分: 4
观影日期: 2025-06-20T20:00:00
类型: 自然
导演: X
上映日期: 2024-03-01
片长: 120分钟
豆瓣评分: 8.0
影评: 失望
---
`);
}

describe('ratingBucketOf', () => {
  it('6 档边界', () => {
    expect(ratingBucketOf(5.5)).toBe('≥5.5');
    expect(ratingBucketOf(5.2)).toBe('5~5.5');
    expect(ratingBucketOf(4.5)).toBe('4~5');
    expect(ratingBucketOf(3.5)).toBe('3~4');
    expect(ratingBucketOf(2.5)).toBe('2~3');
    expect(ratingBucketOf(1)).toBe('<2');
  });
});

describe('buildAnalysisData', () => {
  beforeEach(() => {
    resetObsidianMocks();
  });

  it('计数/组/标签/评分/豆瓣聚合', () => {
    const vault = new MockVault();
    seed(vault);
    const d = buildAnalysisData(makeApp(vault));
    expect(d.total).toBe(4);
    expect(d.watched).toBe(3);
    expect(d.watching).toBe(0);
    expect(d.want).toBe(1);
    expect(d.ratingCount).toBe(3);
    expect(d.ratingSum).toBe(11);
    expect(Number(d.avgRating)).toBeCloseTo(6.11, 2);
    expect(d.doubanCount).toBe(3);
    expect(d.groups['电影']).toBe(1);
    expect(d.groups['剧集']).toBe(1);
    expect(d.tags['美剧']).toBe(1);
  });

  it('类型/国家/导演/主演 slash 拆分（主演取单次）', () => {
    const vault = new MockVault();
    seed(vault);
    const d = buildAnalysisData(makeApp(vault));
    expect(d.genres['剧情']).toBe(1);
    expect(d.genres['科幻']).toBe(1);
    expect(d.countries['美国']).toBe(2); // A + B
    expect(d.countries['英国']).toBe(1);
    expect(d.directors['诺兰']).toBe(2);
    expect(d.actors['A']).toBe(1);
    expect(d.actors['B']).toBe(1);
    expect(d.actors['C']).toBe(1);
  });

  it('片龄分桶/年代/片长/星期/月度键', () => {
    const vault = new MockVault();
    seed(vault);
    const d = buildAnalysisData(makeApp(vault));
    // A: 2025-2020=5 → 4-10年；B: 2024-2019=5 → 4-10年；D: 2025-2024=1 → 1-3年
    expect(d.ageBuckets['4-10年']).toBe(2);
    expect(d.ageBuckets['1-3年']).toBe(1);
    expect(d.avgAge).toBe(String(((5 + 5 + 1) / 3).toFixed(1)));
    expect(d.eras['2020']).toBe(2); // 2020s（A+B 2019/2020 都是 2020 十位）
    expect(d.durBuckets['90-120']).toBe(2); // 110 + 120
    expect(d.durBuckets['<90']).toBe(1); // 45
    expect(d.avgDur).toBe('92'); // (110+45+120)/3=91.67
    expect(d.weekdays.reduce((a: number, b: number) => a + b, 0)).toBe(3);
    expect(d.monthKeys.size).toBe(2); // 2025-6 + 2024-12
    expect(d.monthFreq).toBe('2.0');
  });

  it('打分习惯：平均差值/宝藏/失望', () => {
    const vault = new MockVault();
    seed(vault);
    const d = buildAnalysisData(makeApp(vault));
    // A: 5*1.67=8.33 vs 8.5 → diff -0.17；B: 2*1.67=3.33 vs 9 → 失望；D: 4*1.67=6.67 vs 8 → 无
    expect(d.diffCount).toBe(3);
    expect(d.disappoint.length).toBe(1);
    expect(d.disappoint[0].name).toBe('B');
    expect(d.treasure.length).toBe(0);
  });

  it('影评关键词/系列/季集/想看清单/年度评分', () => {
    const vault = new MockVault();
    seed(vault);
    const d = buildAnalysisData(makeApp(vault));
    expect(d.reviewCount).toBe(2); // A + D
    expect(d.reviewKeywords['好看']).toBe(1);
    expect(d.reviewKeywords['推荐']).toBe(1);
    expect(d.reviewKeywords['失望']).toBe(1);
    // 系列：A/B 无尾数字 → 各自独立；想看 C
    expect(d.wantList.length).toBe(1);
    expect(d.wantList[0].name).toBe('C');
    expect(d.seasonSum).toBe(3);
    expect(d.avgSeason).toBe('1.5');
    expect(d.yearRating['2025'].count).toBe(2); // A + D
    expect(d.yearRating['2024'].count).toBe(1);
    // 年度环比 2024→2025：( (5+4)/2 - 2 ) / 2 = 125%
    const trend = d.yearTrend.find((t: any) => t.label === '2024→2025');
    expect(trend.value).toBe(125);
  });

  it('无 frontmatter/无类型标签跳过；folderPath 外部跳过', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《X》.md', '---\ntags: [随笔]\n---');
    vault.files.set('其他/《Y》.md', '---\ntags: [电影]\n---');
    vault.files.set('我的/影视/《Z》.md', '正文');
    const d = buildAnalysisData(makeApp(vault));
    expect(d.total).toBe(0);
  });
});

describe('getAnalysisFolderPath', () => {
  it('settings.analysisFolderPath 优先，其次 movie 路径', () => {
    setSettingsProvider(() => ({ analysisFolderPath: '我的/影视库' } as any));
    expect(getAnalysisFolderPath()).toBe('我的/影视库');
    setSettingsProvider(() => ({ movieFolderPath: '我的/影视' } as any));
    expect(getAnalysisFolderPath()).toBe('我的/影视');
  });
});

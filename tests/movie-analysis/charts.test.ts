/**
 * 影视数据分析 charts 测试（ticket 15）：图表组件 HTML + buildAnalysisHTML 21 section
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { buildAnalysisData } from '../../src/movie-analysis/analysis';
import { buildAnalysisHTML, statCardHTML, barChartHTML, donutChartHTML, softBarHTML, sectionHTML, topListHTML, ratingCompareListHTML, statInlineHTML, emptyHTML } from '../../src/movie-analysis/charts';

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
影评: 好看，推荐
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
---
`);
  vault.files.set('我的/影视/《C》.md', '---\ntags: [日漫]\n评分: -1\n---');
}

describe('图表组件', () => {
  it('statCardHTML：6 色卡板循环', () => {
    expect(statCardHTML('总数', '3', 0)).toContain('总数');
    expect(statCardHTML('总数', '3', 0)).toContain('#D6E4FF'); // PASTEL_CARDS[0]
    expect(statCardHTML('总数', '3', 6)).toContain('#D6E4FF'); // 循环 6%6=0
  });

  it('barChartHTML：空 entries → emptyHTML；value 0 → minH 26px', () => {
    expect(barChartHTML([])).toContain('暂无数据');
    expect(barChartHTML([{ label: 'a', value: 0 }])).toContain('height:26px');
  });

  it('donutChartHTML：总数为 0 不除零', () => {
    expect(donutChartHTML([{ label: 'a', value: 0 }], ['#fff'])).toContain('0');
  });

  it('softBarHTML：max(…,1) 防除零', () => {
    expect(softBarHTML([{ label: 'x', value: 0 }], '#fff')).toContain('width:2%');
  });

  it('sectionHTML：色条 + 标题', () => {
    expect(sectionHTML('🎬 类型分布', 'body', '#D6E4FF')).toContain('🎬 类型分布');
  });

  it('topListHTML：TOP 徽章 + 《名》', () => {
    const html = topListHTML([{ name: 'A', typeTag: '电影', rating: 5 }], true);
    expect(html).toContain('《A》');
    expect(html).toContain('1');
    expect(html).toContain('5');
  });

  it('ratingCompareListHTML：换算 10 分制', () => {
    const html = ratingCompareListHTML([{ name: 'B', typeTag: '美剧', rating: 2, douban: 9 }]);
    expect(html).toContain('豆瓣9');
    expect(html).toContain('(3.3)');
  });

  it('emptyHTML', () => {
    expect(emptyHTML()).toContain('暂无数据');
  });
});

describe('buildAnalysisHTML 21 section', () => {
  beforeEach(() => {
    resetObsidianMocks();
  });

  it('核心统计卡 + 各章节标题 + footer', () => {
    const vault = new MockVault();
    seed(vault);
    const d = buildAnalysisData(mockAppWithVault(vault));
    const html = buildAnalysisHTML(d);
    expect(html).toContain('收录总数');
    expect(html).toContain('已看');
    expect(html).toContain('🎬 类型分布');
    expect(html).toContain('📅 年度观影趋势');
    expect(html).toContain('🕰️ 片龄画像');
    expect(html).toContain('⏱️ 片长画像');
    expect(html).toContain('🗓️ 月度观影分布');
    expect(html).toContain('📆 观影节奏');
    expect(html).toContain('⭐ 个人评分分布');
    expect(html).toContain('📈 评分趋势（个人6分制）');
    expect(html).toContain('⚖️ 打分习惯（换算10分制）');
    expect(html).toContain('🎭 题材偏好 TOP10');
    expect(html).toContain('🌍 制片国家/地区 TOP10');
    expect(html).toContain('🎥 最爱导演 TOP10');
    expect(html).toContain('👥 最爱主演 TOP10');
    expect(html).toContain('❤️ 真爱重复');
    expect(html).toContain('💬 影评关键词');
    expect(html).toContain('🏆 我的高分 TOP10');
    expect(html).toContain('🔗 系列追踪');
    expect(html).toContain('📺 追剧深度');
    expect(html).toContain('📌 想看清单');
    expect(html).toContain('个人评分 6 分制 ⇄ 豆瓣 10 分制，换算 ×1.67');
  });

  it('空数据 → 各章节空态', () => {
    const vault = new MockVault();
    const d = buildAnalysisData(mockAppWithVault(vault));
    const html = buildAnalysisHTML(d);
    expect(html).toContain('0');
    expect(html).toContain('想看清单（0）');
  });
});

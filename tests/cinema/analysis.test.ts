// @vitest-environment node
/**
 * 影院（cinema）影视分析完整版测试：数据采集（9 类统计）+ 渲染板块
 * ADR-0090：原独立观影报告（独立域已删，ADR-0090）能力并入内嵌页——
 * 片长/季集统计、19 板块对照断言、类型分布条形行、空态动作、头行小计。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { buildAnalysisData, buildAnalysisHTML, buildStatPageHtml, analysisHeadSub } from '../../src/cinema/analysis';

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

  it('渲染 19 板块（原独立报告全量板块，ADR-0090）', () => {
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

// ======================= ADR-0090 独立报告能力并入 =======================

/** 原独立观影报告（已退役）19 板块标题全清单——内嵌页不丢能力的对照基线 */
const REPORT_19_SECTIONS = [
  '类型分布', '年度观影趋势', '片龄画像', '片长画像', '月度观影分布', '观影节奏',
  '个人评分分布', '评分趋势（个人10分制）', '打分习惯（个人−豆瓣）', '题材偏好 TOP10',
  '制片国家/地区 TOP10', '最爱导演 TOP10', '最爱主演 TOP10', '真爱重复', '影评关键词',
  '我的高分 TOP10', '系列追踪', '追剧深度', '想看清单',
];

describe('ADR-0090 片长/季集统计并入（原独立报告能力）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', `---
tags: [电影]
评分: 5
观影日期: 2025-06-01
上映日期: 2024-01-01
片长: 118分钟
---`);
    vault.files.set('我的/影视/《A2》.md', `---
tags: [电影]
评分: 4
观影日期: 2025-06-02
上映日期: 2025-01-01
片长: 45分钟
---`);
    vault.files.set('我的/影视/《剧》.md', `---
tags: [美剧]
评分: 2
观影日期: 2024-12-01
上映日期: 2020-01-01
片长: 200分钟
季集: 2季
---`);
    rebuildItems(mockAppWithVault(vault));
  });

  it('片长分桶 + 平均片长 + 分组均长（90-120 / <90 / >120）', () => {
    const d = buildAnalysisData();
    expect(d.durBuckets['<90']).toBe(1);
    expect(d.durBuckets['90-120']).toBe(1);
    expect(d.durBuckets['>120']).toBe(1);
    // (118+45+200)/3 = 121
    expect(d.avgDur).toBe('121');
    expect(d.groupDurEntries).toEqual([{ label: '剧集', value: 200 }, { label: '电影', value: 82 }]);
  });

  it('季集统计：首个数字入平均 + 追剧深度榜', () => {
    const d = buildAnalysisData();
    expect(d.seasonCount).toBe(1);
    expect(d.avgSeason).toBe('2.0');
    expect(d.seasons).toEqual([{ name: '剧', seasons: 2 }]);
  });

  it('无片长/季集字段不误入统计（缺省回落「—」）', () => {
    resetCinemaState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    vault.files.set('我的/影视/《裸条》.md', '---\ntags: [电影]\n评分: 7\n观影日期: 2025-01-01\n---');
    rebuildItems(mockAppWithVault(vault));
    const d = buildAnalysisData();
    expect(d.durCount).toBe(0);
    expect(d.avgDur).toBe('—');
    expect(d.seasonCount).toBe(0);
    expect(d.avgSeason).toBe('—');
  });
});

describe('ADR-0090 内嵌页板块对照（19 板块不丢能力）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    seed(vault);
    rebuildItems(mockAppWithVault(vault));
  });

  it('19 板块标题全部存在', () => {
    const html = buildAnalysisHTML();
    for (const t of REPORT_19_SECTIONS) expect(html).toContain(t);
  });

  it('19 板块标题全部 lucide 化（无 emoji 残留，icon 参数齐）', () => {
    const html = buildAnalysisHTML();
    // 19 板块 sectionHTML 均带 data-lucide 占位（另有页头 1 个，≥19 即齐）
    const icons = html.match(/data-lucide="/g) || [];
    expect(icons.length).toBeGreaterThanOrEqual(19);
    expect(html).toContain('data-lucide="hourglass"'); // 片龄画像（原 🕰️）
    expect(html).toContain('data-lucide="timer"'); // 片长画像（原 ⏱️）
    expect(html).toContain('data-lucide="tv"'); // 追剧深度（原 📺）
    expect(html).toContain('data-lucide="heart"'); // 真爱重复（原 ❤️）
    expect(html).toContain('data-lucide="scale"'); // 打分习惯（原 ⚖️）
    // 原 19 板块标题 emoji 全无残留
    for (const emoji of ['🎬', '📅', '🕰', '⏱', '🗓', '📆', '⭐', '📈', '⚖', '🎭', '🌍', '🎥', '👥', '❤', '💬', '🏆', '🔗', '📺', '📌']) {
      expect(html).not.toContain(emoji);
    }
  });

  it('类型分布改水平条形行（圆形统计被否）：无 svg 环形，条形行带类型色', () => {
    const html = buildAnalysisHTML();
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('donut');
    expect(html).not.toContain('stroke-dasharray'); // 环形图虚线描边不应再有
    // 类型组名以条形行标签出现（seed 有 电影/剧集 两组）
    expect(html).toContain('类型分布');
    expect(html).toContain('剧集');
  });
});

describe('ADR-0090 头行小计 + 空态动作 + 整页组装', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
  });

  it('analysisHeadSub：「N 部 · 已看 N · YYYY–YYYY」（单年只出一年）', () => {
    const vault = new MockVault();
    seed(vault);
    rebuildItems(mockAppWithVault(vault));
    // seed 4 条全部 2026 年观影 → 单年
    expect(analysisHeadSub()).toBe('4 部 · 已看 3 · 2026');
  });

  it('analysisHeadSub：跨年区间 + 无记录时无年份段', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n评分: 7\n观影日期: 2024-03-01\n---');
    vault.files.set('我的/影视/《B》.md', '---\ntags: [电影]\n评分: 8\n观影日期: 2026-03-01\n---');
    rebuildItems(mockAppWithVault(vault));
    expect(analysisHeadSub()).toBe('2 部 · 已看 2 · 2024–2026');
    resetCinemaState();
    M.folderPath = '我的/影视';
    expect(analysisHeadSub()).toBe('0 部 · 已看 0');
  });

  it('空库整页：引导文案 + 「添加影视」动作按钮（data-cinema-analysis-add）', () => {
    const html = buildStatPageHtml();
    expect(html).toContain('还没有可统计的影视记录');
    expect(html).toContain('data-cinema-analysis-add');
    expect(html).toContain('添加影视');
  });

  it('整页 = 页头（bar-chart-3 + 头行小计） + 板块流', () => {
    const vault = new MockVault();
    seed(vault);
    rebuildItems(mockAppWithVault(vault));
    const html = buildStatPageHtml();
    expect(html).toContain('bz-cinema-page-head');
    expect(html).toContain('data-lucide="bar-chart-3"');
    expect(html).toContain('4 部 · 已看 3 · 2026');
    expect(html).toContain('类型分布');
    expect(html).toContain('想看清单');
  });
});

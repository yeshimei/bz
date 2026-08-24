/**
 * 影视数据分析补充覆盖测试（src/movie/analysis.ts 未触达函数分支 + src/movie/constants.ts）：
 * 评分全桶、宝藏/失望双榜、想看质量、片龄边界（当年/≥10年/负差值）、系列基名剥离
 * （含纯数字书名）、季集缺失回退、影评关键词多命中、年度趋势、无日期条目、
 * 字符串标签容错；空库/富库两套弹窗渲染路径；常量工具浅暗主题。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetMovieState } from '../../src/movie/state';
import { buildAnalysisData, openAnalysisModal, closeAnalysis } from '../../src/movie/analysis';
import {
  STATUS_WANT,
  STATUS_WATCHING,
  STATUS_WATCHED,
  TYPE_GROUPS,
  ALL_TAGS,
  getTypeColor,
  getGroupForTag,
  getStarRating,
} from '../../src/movie/constants';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 生成影视笔记 frontmatter */
function movieMd(fields: Record<string, any>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`- ${item}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---', '正文');
  return lines.join('\n');
}

beforeEach(() => {
  resetObsidianMocks();
  resetMovieState();
  M.folderPath = '我的/影视';
});

describe('constants 常量与工具', () => {
  it('状态常量与类型分组结构稳定（外部依赖的数据约定）', () => {
    expect(STATUS_WANT).toBe(0);
    expect(STATUS_WATCHING).toBe(1);
    expect(STATUS_WATCHED).toBe(2);
    expect(Object.keys(TYPE_GROUPS)).toEqual(['电影', '剧集', '动漫', '纪录片', '公开课']);
    // ALL_TAGS 为所有分组的扁平并集
    expect(ALL_TAGS).toContain('电影');
    expect(ALL_TAGS).toContain('TED');
    expect(ALL_TAGS.length).toBe(Object.values(TYPE_GROUPS).flat().length);
  });

  it('getTypeColor：浅色取 light、暗色取 dark、未知分组回退灰', () => {
    document.body.classList.remove('theme-dark');
    expect(getTypeColor('电影')).toBe('#FF9800');
    document.body.classList.add('theme-dark');
    expect(getTypeColor('电影')).toBe('#FFA726');
    document.body.classList.remove('theme-dark');
    expect(getTypeColor('不存在的组')).toBe('#95a5a6');
  });

  it('getGroupForTag：命中返回分组名，未命中返回 null', () => {
    expect(getGroupForTag('美剧')).toBe('剧集');
    expect(getGroupForTag('国漫')).toBe('动漫');
    expect(getGroupForTag('杂七杂八')).toBeNull();
  });

  it('getStarRating：向下取整重复 ⭐，0 分为空串', () => {
    expect(getStarRating(4.9)).toBe('⭐⭐⭐⭐');
    expect(getStarRating(5)).toBe('⭐⭐⭐⭐⭐');
    expect(getStarRating(0)).toBe('');
  });
});

/** 富库：覆盖全部评分桶 / 双榜 / 片龄边界 / 系列 / 季集 / 关键词 */
function seedRichVault(vault: MockVault) {
  vault.files.set('我的/影视/《高分》.md', movieMd({
    tags: ['电影'], '观影日期': '2025-03-05T20:00:00', 评分: 5.5, '豆瓣评分': 7,
    '上映日期': '2024-05-01', 片长: '130分钟', 影评: '好看，推荐，神作',
    导演: '诺兰', 主演: '演员甲/演员乙', 类型: '科幻/悬疑', '制片国家/地区': '美国',
  }));
  vault.files.set('我的/影视/《中评》.md', movieMd({
    tags: ['美剧'], '观影日期': '2024-07-10T20:00:00', 评分: 5, '豆瓣评分': 8.6,
    '上映日期': '2010-01-01', 片长: '45分钟', 影评: '无聊，一般', '季集': '3季',
    导演: '诺兰', 主演: '演员甲/演员丙',
  }));
  vault.files.set('我的/影视/《失望》.md', movieMd({
    tags: ['日漫'], '观影日期': '2025-01-20T20:00:00', 评分: 2, '豆瓣评分': 9,
    '上映日期': '2023-06-01', 片长: '90分钟', 影评: '失望',
    导演: '诺兰', 主演: '演员甲/演员乙', 类型: '奇幻',
  }));
  vault.files.set('我的/影视/《低分》.md', movieMd({
    tags: ['纪录片'], '观影日期': '2024-11-11T20:00:00', 评分: 1.5, '豆瓣评分': 'abc',
  }));
  vault.files.set('我的/影视/《在看》.md', movieMd({ tags: ['电影'], '观影日期': '', 评分: 0 }));
  vault.files.set('我的/影视/《想看甲》.md', movieMd({ tags: ['国产剧'], 评分: -1, '豆瓣评分': 8.2 }));
  vault.files.set('我的/影视/《想看乙》.md', movieMd({ tags: ['TED'], 评分: -1 }));
  vault.files.set('我的/影视/无书名号电影.md', movieMd({
    tags: ['电影'], '观影日期': '2025-02-02T20:00:00', 评分: 4, '豆瓣评分': 6.5,
  }));
  // 系列三部（基名剥离尾数字）
  vault.files.set('我的/影视/《谍影重重》.md', movieMd({ tags: ['国漫'], '观影日期': '2025-05-01T20:00:00', 评分: 3 }));
  vault.files.set('我的/影视/《谍影重重2》.md', movieMd({ tags: ['国漫'], '观影日期': '2025-05-02T20:00:00', 评分: 3 }));
  vault.files.set('我的/影视/《谍影重重3》.md', movieMd({ tags: ['国漫'], '观影日期': '2025-05-03T20:00:00', 评分: 3 }));
  // 纯数字书名：基名剥离后为空 → 回退原名（防误伤分支）
  vault.files.set('我的/影视/《2046》.md', movieMd({ tags: ['电影'], '观影日期': '2025-04-04T20:00:00', 评分: 3.5 }));
  // 标签为字符串（非数组）也能识别
  vault.files.set('我的/影视/《字符串标签》.md', movieMd({ tags: '英剧', '观影日期': '2025-06-06T20:00:00', 评分: 4 }));
  // 无有效类型标签 → 忽略
  vault.files.set('我的/影视/《杂项》.md', movieMd({ tags: ['杂项'], 评分: 5 }));
}

describe('buildAnalysisData 全维度统计', () => {
  it('评分六桶全命中 + 状态归类 + 非法/缺省评分容错', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    // 13 部入统计：5.5→≥5.5、5→5~5.5、4×2→4~5、3~3.9×4（谍×3+2046）→3~4、2→2~3、1.5→<2
    expect(data.total).toBe(13);
    expect(data.buckets).toEqual({ '≥5.5': 1, '5~5.5': 1, '4~5': 2, '3~4': 4, '2~3': 1, '<2': 1 });
    expect(data.watched).toBeGreaterThan(0);
    expect(data.watching).toBe(1); // 评分 0 → 在看
    expect(data.want).toBe(2); // 评分 -1 → 想看
    // 豆瓣 'abc'/缺失 → NaN 不计入均分：有效仅 高分7/中评8.6/失望9/想看甲8.2/无书名号6.5
    expect(data.doubanCount).toBe(5);
  });

  it('宝藏榜（个人换算≥8.33 且豆瓣<8）/ 失望榜（个人≤2 且豆瓣≥8.5）双向命中', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    const treasureNames = data.treasure.map((t: any) => t.name);
    expect(treasureNames).toContain('高分'); // 5.5→9.17 且豆瓣 7<8
    const disappointNames = data.disappoint.map((d: any) => d.name);
    expect(disappointNames).toContain('失望'); // 个人 2≤2 且豆瓣 9≥8.5
    // 平均差值为负（失望项拉低）
    expect(Number(data.avgDiff)).toBeLessThan(0);
  });

  it('片龄画像：当年 / 1-3年 / ≥10年命中；上映晚于观影（负差值）不计入', () => {
    const vault = new MockVault();
    // 高分 2025 观 2024 映 → 1年；中评 2024 观 2010 映 → 14年；失望 2025 观 2023 映 → 2 年；
    // 再造一部「未来上映」：观 2020、映 2024 → 差值 -4 不计入任何桶也不进均值
    seedRichVault(vault);
    vault.files.set('我的/影视/《未来上映》.md', movieMd({
      tags: ['电影'], '观影日期': '2020-01-01T20:00:00', 评分: 4, '上映日期': '2024-01-01',
    }));
    const data = buildAnalysisData(makeApp(vault));
    // 高分 2025 观 2024 映 → 1 年；失望 → 2 年（中评 14 年入 ≥10年；「未来上映」负差值不计）
    expect(data.ageBuckets['当年']).toBe(0);
    expect(data.ageBuckets['1-3年']).toBe(2);
    expect(data.ageBuckets['≥10年']).toBe(1);
    // 未来上映仍按上映年代入 eras（2020s），但不影响平均片龄分母
    expect(data.eraEntries.some((e: any) => e.label === '2020s')).toBe(true);
    expect(data.avgAge).not.toBe('—');
  });

  it('片长三桶 + 分组均片长；无片长条目不进分母', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    expect(data.durBuckets['<90']).toBe(1); // 45 分钟（中评）
    expect(data.durBuckets['90-120']).toBe(1); // 90 分钟（失望）
    expect(data.durBuckets['>120']).toBe(1); // 130 分钟（高分）
    expect(data.avgDur).toBe(String(Math.round((130 + 45 + 90) / 3)));
    // 分组均片长条目化：电影/剧集/动漫各有均值
    const labels = data.groupDurEntries.map((g: any) => g.label);
    expect(labels).toEqual(expect.arrayContaining(['电影', '剧集', '动漫']));
  });

  it('系列追踪：基名剥离聚合 ≥2 部；纯数字书名不误伤；排序按部数', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    expect(data.seriesList[0]).toEqual(['谍影重重', 3]);
    expect(JSON.stringify(data.seriesList)).not.toContain('2046'); // 单部不成列
    expect(data.series['2046']).toBe(1); // 但计数仍在
  });

  it('季集统计：有则求均值入榜，全无则回退「—」', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    let data = buildAnalysisData(makeApp(vault));
    expect(data.seasons).toEqual([{ name: '中评', seasons: 3 }]);
    expect(data.avgSeason).toBe('3.0');

    const emptySeason = new MockVault();
    emptySeason.files.set('我的/影视/《A》.md', movieMd({ tags: ['电影'], 评分: 4 }));
    data = buildAnalysisData(makeApp(emptySeason));
    expect(data.avgSeason).toBe('—');
    expect(data.seasons).toEqual([]);
  });

  it('影评关键词多命中计数 + 有影评占比 + 平均字数', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    expect(data.reviewKeywords['好看']).toBe(1);
    expect(data.reviewKeywords['神作']).toBe(1);
    expect(data.reviewKeywords['一般']).toBe(1);
    expect(data.reviewCount).toBe(3); // 仅 高分/中评/失望 三部有影评
    expect(data.reviewRate).toBe(Math.round((3 / data.total) * 100));
    expect(data.reviewAvgChars).toBeGreaterThan(0);
    // keywordEntries 按次数降序
    const counts = data.keywordEntries.map(([, v]: any) => v);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it('想看质量：带豆瓣的计入均分与标签计数，无豆瓣的只入清单', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    expect(data.wantDoubanCount).toBe(1);
    expect(data.wantAvgDouban).toBe('8.20');
    // 两个想看条目各按类型标签计数（TED 也是合法类型标签）
    expect(data.wantTags).toEqual({ 国产剧: 1, TED: 1 });
    expect(data.wantList.map((w: any) => w.name)).toEqual(expect.arrayContaining(['想看甲', '想看乙']));
  });

  it('真爱重复：导演≥3 部与主演≥3 部各计 1 人', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    expect(data.dirRepeat).toBe(1); // 诺兰 ×3
    expect(data.actRepeat).toBe(1); // 演员甲 ×3
  });

  it('题材/国家拆分累计 + 年度趋势（跨年增量百分比）+ 星期分布', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    const data = buildAnalysisData(makeApp(vault));
    expect(data.genres['科幻']).toBe(1);
    expect(data.countries['美国']).toBe(1);
    // 年度趋势：2024 → 2025 的增量条目存在且为整数百分比
    const trend = data.yearTrend.find((t: any) => t.label === '2024→2025');
    expect(trend).toBeTruthy();
    expect(Number.isInteger(trend.value)).toBe(true);
    // 星期分布总和：缺日期键/空串均回退 epoch（合法日期）→ 全部 13 部都计入
    const weekdaySum = data.weekdayEntries.reduce((s: number, w: any) => s + w.value, 0);
    expect(weekdaySum).toBe(13);
    expect(data.monthFreq).not.toBe('—');
  });

  it('观影日期为非法字符串（Invalid Date）→ 年/月/星期均不累计，但条目仍入统计', () => {
    const vault = new MockVault();
    // 空串/缺键会回退 epoch（new Date(null) 合法）；真 Invalid 需非空非法值
    vault.files.set('我的/影视/《无日期》.md', movieMd({ tags: ['电影'], '观影日期': '不是日期', 评分: 4 }));
    const data = buildAnalysisData(makeApp(vault));
    expect(data.total).toBe(1);
    expect(data.watched).toBe(1);
    expect(Object.keys(data.years)).toHaveLength(0);
    expect(Object.keys(data.months)).toHaveLength(0);
    expect(data.weekdays.every((n: number) => n === 0)).toBe(true);
    expect(data.monthFreq).toBe('—');
    expect(data.yearTrend).toEqual([]);
  });

  it('标签为字符串（非数组）→ 按单值识别类型', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《字符串标签》.md', movieMd({ tags: '英剧', 评分: 4 }));
    const data = buildAnalysisData(makeApp(vault));
    expect(data.total).toBe(1);
    expect(data.groups['剧集']).toBe(1);
    expect(data.tags['英剧']).toBe(1);
  });
});

describe('分析弹窗渲染两态', () => {
  it('空库渲染：全部图表走「暂无数据」占位 + 统计卡零值 + 换算尾注', () => {
    const app = makeApp(new MockVault());
    openAnalysisModal(app);
    const overlay = document.body.querySelector('div[style*="z-index: 1200"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('收录总数');
    expect(overlay.textContent).toContain('暂无数据');
    expect(overlay.textContent).toContain('—');
    expect(overlay.textContent).toContain('个人评分 6 分制');
    // 关闭幂等：再关一次不抛错
    closeAnalysis();
    expect(overlay.isConnected).toBe(false);
    expect(() => closeAnalysis()).not.toThrow();
  });

  it('富库渲染：双榜/系列/追剧深度/想看清单均豆瓣/关键词 chips 全量出现；ESC 可关', () => {
    const vault = new MockVault();
    seedRichVault(vault);
    openAnalysisModal(makeApp(vault));
    const overlay = document.body.querySelector('div[style*="z-index: 1200"]') as HTMLElement;
    const text = overlay.textContent!;
    expect(text).toContain('宝藏片'); // 宝藏榜小节
    expect(text).toContain('失望榜');
    expect(text).toContain('谍影重重'); // 系列追踪行
    expect(text).toContain('3 季'); // 追剧深度
    expect(text).toContain('8.20'); // 想看清单 · 均豆瓣
    expect(text).toContain('好看 1'); // 影评关键词 chip
    expect(text).toContain('诺兰'); // 最爱导演 TOP10
    // ESC 经 escManager 层关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(overlay.isConnected).toBe(false);
  });
});

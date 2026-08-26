/**
 * 影视数据分析测试（ticket 23 迁移自 QuickAdd《影视数据分析.js》；ADR-0048 随独立域迁至 tests/movie-report/）
 * 数据层：buildAnalysisData 纯函数统计；UI 层：弹窗打开/顶部 34px/关闭
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { resetMovieReportState, setReportFolderPath } from '../../src/movie-report/state';
import { buildAnalysisData, openAnalysisModal, closeAnalysis } from '../../src/movie-report/analysis';
import { openMovieReport } from '../../src/movie-report/index';
import { setSettingsProvider } from '../../src/core/settings-provider';

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
  resetMovieReportState();
  setReportFolderPath('我的/影视');
});

describe('buildAnalysisData 数据采集', () => {
  it('空库：全部统计为零', () => {
    const vault = new MockVault();
    const data = buildAnalysisData(makeApp(vault));
    expect(data.total).toBe(0);
    expect(data.watched).toBe(0);
    expect(data.watching).toBe(0);
    expect(data.want).toBe(0);
    expect(data.avgAge).toBe('—');
    expect(data.seriesList).toEqual([]);
  });

  it('状态归类：已看/在看/想看 + 类型分组 + 评分桶；自定义 tag 归「其他」入统计（x4）', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', movieMd({ tags: ['电影'], '观影日期': '2025-06-01T20:00:00', 评分: 5, '豆瓣评分': 8 }));
    vault.files.set('我的/影视/《B》.md', movieMd({ tags: ['国产剧'], '观影日期': '2025-06-02T20:00:00', 评分: 0 }));
    vault.files.set('我的/影视/《C》.md', movieMd({ tags: ['日漫'], 评分: -1 }));
    // 自定义标签归「其他」组入统计（不再被忽略）
    vault.files.set('我的/影视/《D》.md', movieMd({ tags: ['杂项'], 评分: 5 }));

    const data = buildAnalysisData(makeApp(vault));
    expect(data.total).toBe(4);
    expect(data.watched).toBe(2);
    expect(data.watching).toBe(1);
    expect(data.want).toBe(1);
    expect(data.groups).toEqual({ 电影: 1, 剧集: 1, 动漫: 1, 其他: 1 });
    expect(data.tags).toEqual({ 电影: 1, 国产剧: 1, 日漫: 1, 杂项: 1 });
    // 评分桶：5 分 ×2 → 5~5.5
    expect(data.buckets['5~5.5']).toBe(2);
    expect(data.topRated.length).toBe(2);
    expect(data.topRated[0].name).toBe('A');
  });

  it('评分空值 → 已看（P2）：`评分:` 空串不再误判在看', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《空》.md', movieMd({ tags: ['电影'], '观影日期': '2025-06-01T20:00:00', 评分: '' }));
    const data = buildAnalysisData(makeApp(vault));
    expect(data.total).toBe(1);
    expect(data.watched).toBe(1);
    expect(data.watching).toBe(0);
    expect(data.want).toBe(0);
    // 空值不参与平均分统计
    expect(data.ratingCount).toBe(0);
  });

  it('片龄/片长/星期/打分习惯/影评关键词/系列/季集/年度评分', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', movieMd({
      tags: ['电影'], '观影日期': '2025-06-01T20:00:00', 评分: 5, '豆瓣评分': 8,
      '上映日期': '2024-01-01', 片长: '118分钟', 影评: '好看，神作', '季集': '',
    }));
    vault.files.set('我的/影视/《A2》.md', movieMd({
      tags: ['电影'], '观影日期': '2025-06-02T20:00:00', 评分: 4, '豆瓣评分': 7,
      '上映日期': '2025-01-01', 片长: '45分钟', 影评: '一般', '季集': '',
    }));
    vault.files.set('我的/影视/《剧》.md', movieMd({
      tags: ['美剧'], '观影日期': '2024-12-01T20:00:00', 评分: 2, '豆瓣评分': 9,
      '上映日期': '2020-01-01', 片长: '200分钟', '季集': '2季', 影评: '失望',
    }));

    const data = buildAnalysisData(makeApp(vault));
    // 片龄：A 上映2024 → 2025-2024=1 → 1-3年；A2 当年；剧 2020 → ≥4 → 4-10年
    expect(data.ageBuckets['当年']).toBe(1);
    expect(data.ageBuckets['1-3年']).toBe(1);
    expect(data.ageBuckets['4-10年']).toBe(1);
    // 片长：118 → 90-120；45 → <90；200 → >120
    expect(data.durBuckets['<90']).toBe(1);
    expect(data.durBuckets['90-120']).toBe(1);
    expect(data.durBuckets['>120']).toBe(1);
    // 打分习惯：剧 个人2 豆瓣9 → r10=3.33 <8.33 非宝藏；评分≤2 且豆瓣≥8.5 → 失望榜
    expect(data.disappoint.length).toBe(1);
    expect(data.disappoint[0].name).toBe('剧');
    // 影评关键词：好看/神作/一般/失望
    expect(data.reviewKeywords['好看']).toBe(1);
    expect(data.reviewKeywords['神作']).toBe(1);
    expect(data.reviewKeywords['一般']).toBe(1);
    expect(data.reviewKeywords['失望']).toBe(1);
    // 系列：A / A2 基名 A → 2 部
    expect(data.seriesList).toEqual([['A', 2]]);
    // 季集：2季 → 平均 2 季
    expect(data.avgSeason).toBe('2.0');
    // 年度评分：2025 → (5+4)/2=4.5
    expect(data.yearRatingEntries).toEqual([{ label: '2024', value: 2 }, { label: '2025', value: 4.5 }]);
  });
});

describe('openAnalysisModal 弹窗', () => {
  it('打开：遮罩 + 标题；❌ 关闭；移动端+开关开 → 分析窗挂 bz-win-mfs（ticket 68，基样式不再自带 34px 防双重垫顶）', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', movieMd({ tags: ['电影'], '观影日期': '2025-06-01T20:00:00', 评分: 5 }));
    openAnalysisModal(makeApp(vault));

    const overlay = document.body.querySelector('.bz-movie-report-overlay--1200') as HTMLElement;
    expect(overlay).not.toBeNull();
    const modal = overlay.querySelector(':scope > div') as HTMLElement;
    // 顶部 34px 避让由 .bz-win-mfs 统一提供（仅移动端真全屏），基样式不再自带（ticket 68 后续）
    expect(modal.style.paddingTop).toBe('');
    expect(modal.classList.contains('bz-win-mfs')).toBe(false);
    expect(overlay.textContent).toContain('📊 观影数据分析');
    expect(overlay.textContent).toContain('收录总数');

    // ❌ 关闭
    const closeBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '❌')!;
    closeBtn.click();
    expect(overlay.isConnected).toBe(false);

    // 移动端 + 开关开 → 真全屏类（与影视主面板同一键控制）
    MockPlatform.isMobile = true;
    setSettingsProvider(() => ({ movieMobileDefaultFullscreen: true } as any));
    openAnalysisModal(makeApp(vault));
    const overlay2 = document.body.querySelector('.bz-movie-report-overlay--1200') as HTMLElement;
    expect(overlay2).not.toBeNull();
    expect((overlay2.querySelector(':scope > div') as HTMLElement).classList.contains('bz-win-mfs')).toBe(true);
    closeAnalysis();
    MockPlatform.isMobile = false;
  });

  it('已打开再调用 → 关闭（切换语义）；点遮罩关闭', () => {
    const vault = new MockVault();
    openAnalysisModal(makeApp(vault));
    const overlay = document.body.querySelector('.bz-movie-report-overlay--1200') as HTMLElement;
    expect(overlay).not.toBeNull();
    // 再开 → 关闭
    openAnalysisModal(makeApp(vault));
    expect(overlay.isConnected).toBe(false);

    // 重开 → 点遮罩关闭
    openAnalysisModal(makeApp(vault));
    const overlay2 = document.body.querySelector('.bz-movie-report-overlay--1200') as HTMLElement;
    expect(overlay2).not.toBeNull();
    overlay2.click();
    expect(overlay2.isConnected).toBe(false);
  });

  it('openMovieReport（bz-movie-report 命令回调）打开分析窗口', () => {
    const vault = new MockVault();
    openMovieReport(makeApp(vault));
    const overlay = document.body.querySelector('.bz-movie-report-overlay--1200') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('观影数据分析');
    closeAnalysis();
  });
});

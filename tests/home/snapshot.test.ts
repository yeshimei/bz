// @vitest-environment node
/**
 * 内容首页（home 域）快照测试：跨域真实统计读取（读失败静默回落默认、目录缺失容错）。
 * 环境注入：core setApp + setSettingsProvider（belongings/library/memo 严格读设置）；
 * memo 需 DataManager.init（读文件路径）；review 经 reviewApp.ensure(app) 新建 dataManager。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { DataManager as MemoDataManager } from '../../src/memo/data';
import { reviewApp } from '../../src/review/app';
import { collectHomeSnapshot, NO_STAT_DOMAINS } from '../../src/home/snapshot';
import { DOMAINS, ALL_DOMAIN_IDS } from '../../src/home/domains';

/** 影片 md frontmatter（cinema 解析必需：评分决定状态） */
function cinemaMd(name: string, rating: number | null, tag = '电影'): string {
  return `---\ntags:\n- ${tag}\n观影日期: 2026-01-01\n评分: ${rating ?? ''}\n---\n`;
}

const DAY_MS_MS = 86400000;

describe('home 快照', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    MemoDataManager.init(DEFAULT_SETTINGS as any);
    // reviewApp 为跨用例模块单例：重置 dataManager 防旧用例 vault 绑定污染
    (reviewApp as any).dataManager = null;
  });

  it('空库：全域返回空徽标（不抛错）', async () => {
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.ok).toBe(true);
    for (const id of ALL_DOMAIN_IDS) {
      expect(snap.byDomain[id], `域 ${id} 应为空`).toBeDefined();
      expect(snap.byDomain[id].text).toBe('');
    }
  });

  it('只读契约：空库快照不创建任何域数据文件（无写盘副作用）', async () => {
    const filesBefore = new Set(vault.files.keys());
    await collectHomeSnapshot(mockAppWithVault(vault) as any);
    const created = [...vault.files.keys()].filter((p) => !filesBefore.has(p));
    expect(created).toEqual([]);
  });

  it('NO_STAT_DOMAINS 覆盖纯工具域（attach/encrypt/smartcat/settings/wall；vault 域已并入 encrypt ADR-0085）', () => {
    expect(NO_STAT_DOMAINS.size).toBe(5);
    for (const id of NO_STAT_DOMAINS) {
      expect(DOMAINS.some((d) => d.id === id)).toBe(true);
    }
  });

  it('diary：目录 md 计数 + 今日已写判定', async () => {
    vault.dirs.add('我的/日记');
    const today = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const todayName = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
    vault.files.set(`我的/日记/${todayName}.md`, '# 今天\n');
    vault.files.set('我的/日记/2026-08-01.md', '# 旧\n');
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.diary.text).toBe('2 篇');
    expect(snap.byDomain.diary.sub).toBe('今日已写');
  });

  it('diary：目录不存在 → 空（不建目录不抛错）', async () => {
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.diary.text).toBe('');
  });

  it('memo：未完成待办计数 + 到期标记', async () => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const dueToday = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} 12:00:00`;
    vault.files.set(
      'CONFIG/STORAGE/memo.json',
      JSON.stringify([
        { id: 'a', title: '完成项', scene: '工作', priority: 'minor', created: '2026-01-01 10:00:00', completed: '2026-01-02 10:00:00', due: null },
        { id: 'b', title: '未完成无到期', scene: '工作', priority: 'minor', created: '2026-01-01 10:00:00', completed: null, due: null },
        { id: 'c', title: '今天到期', scene: '学习', priority: 'minor', created: '2026-01-01 10:00:00', completed: null, due: dueToday },
        { id: 'd', title: '已逾期', scene: '生活', priority: 'minor', created: '2026-01-01 10:00:00', completed: null, due: '2020-01-01 10:00:00' },
      ])
    );
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.memo.text).toBe('3 条待办');
    expect(snap.byDomain.memo.sub).toContain('到期 2');
  });

  it('cinema：想看/在看计数（frontmatter 评分语义）', async () => {
    vault.dirs.add('我的/影视');
    vault.files.set('我的/影视/《想看片》.md', cinemaMd('想看片', -1));
    vault.files.set('我的/影视/《在看片》.md', cinemaMd('在看片', 0));
    vault.files.set('我的/影视/《已看片》.md', cinemaMd('已看片', 8));
    vault.files.set('我的/影视/《无评分》.md', cinemaMd('无评分', null));
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.cinema.text).toBe('想看 1 · 在看 1');
  });

  it('review：到期/今日队列统计（review.json 缺失 → 空）', async () => {
    const now = Date.now();
    const isoAgo = (ms: number): string => new Date(now - ms).toISOString();
    const d = new Date();
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    vault.dirs.add('书库');
    vault.files.set('书库/到期卡.md', '# 到期卡\n');
    vault.files.set('书库/今日卡.md', '# 今日卡\n');
    vault.files.set('书库/未来卡.md', '# 未来卡\n');
    vault.files.set(
      'CONFIG/STORAGE/review.json',
      JSON.stringify([
        { id: 'r1', filePath: '书库/到期卡.md', name: '到期卡', reviewStart: '2026-01-01T00:00:00.000Z', stage: 1, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 1, averageConfidence: 5, nextReviewDate: isoAgo(3 * DAY_MS_MS), lastReviewed: '2026-01-01T00:00:00.000Z', lastDifficulty: 'good', completed: false },
        { id: 'r2', filePath: '书库/今日卡.md', name: '今日卡', reviewStart: '2026-01-01T00:00:00.000Z', stage: 1, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 1, averageConfidence: 5, nextReviewDate: new Date(dayStart + 60_000).toISOString(), lastReviewed: '2026-01-01T00:00:00.000Z', lastDifficulty: 'good', completed: false },
        { id: 'r3', filePath: '书库/未来卡.md', name: '未来卡', reviewStart: '2026-01-01T00:00:00.000Z', stage: 1, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 1, averageConfidence: 5, nextReviewDate: isoAgo(-9 * DAY_MS_MS), lastReviewed: '2026-01-01T00:00:00.000Z', lastDifficulty: 'good', completed: false },
      ])
    );
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.review.text).toBe('2 张到期');
    expect(snap.byDomain.review.sub).toContain('今日 1');
  });

  it('pomodoro：今日完成 + 运行中剩余', async () => {
    const now = Date.now();
    const p = (n: number) => String(n).padStart(2, '0');
    const day = new Date(now);
    const todayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    vault.files.set(
      'CONFIG/STORAGE/pomodoro.json',
      JSON.stringify({
        version: 1,
        state: { phase: 'focus', endTime: now + 15 * 60 * 1000, remaining: 0, paused: false, cycleFocusCount: 1 },
        history: [
          { ts: todayStart + 1000, duration: 1500 },
          { ts: now - 86400000, duration: 1500 },
        ],
      })
    );
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.pomodoro.text).toBe('今日 1 轮');
    expect(snap.byDomain.pomodoro.hl).toBe(true);
    expect(snap.byDomain.pomodoro.sub).toContain('15:00');
  });

  it('favorites/quiz/clipping/belongings 统计', async () => {
    vault.files.set(
      'CONFIG/STORAGE/favorites.json',
      JSON.stringify([
        { id: 'f1', tags: ['网站'], title: 'a', created: '2026-01-01 00:00:00' },
        { id: 'f2', tags: ['网站'], title: 'b', created: '2026-01-01 00:00:00', archived: true },
      ])
    );
    vault.files.set(
      'CONFIG/STORAGE/quiz.json',
      JSON.stringify({ notes: { 'a.md': [{ question: 'q1', options: ['a', 'b'], correctIndices: [0] }], 'b.md': [{ question: 'q2', options: ['a'], correctIndices: [0] }, { question: 'q3', options: ['a'], correctIndices: [0] }] } })
    );
    vault.files.set(
      'CONFIG/STORAGE/belongings.json',
      JSON.stringify({ version: '1.0', last_updated: '2026-01-01T00:00:00.000Z', items: { i1: { id: 'i1', name: 'x' }, i2: { id: 'i2', name: 'y' } }, categories: [], categoryIcons: {} })
    );
    vault.dirs.add('归档/网页剪藏');
    vault.files.set('归档/网页剪藏/1.md', '# 剪藏\n');
    vault.files.set('归档/网页剪藏/2.md', '# 剪藏\n');
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.favorites.text).toBe('1 条收藏');
    expect(snap.byDomain.quiz.text).toBe('3 题');
    expect(snap.byDomain.clipping.text).toBe('2 篇');
    expect(snap.byDomain.belongings.text).toBe('2 件');
  });

  it('bookshelf：在读计数（书库目录 frontmatter tags 命中；双日期口径）', async () => {
    vault.files.set('书库/《在读》.md', '---\ntags: [book]\nreadingDate: 2026-01-01\n---\n');
    vault.files.set('书库/《已读》.md', '---\ntags: [book]\nreadingDate: 2026-01-01\ncompletionDate: 2026-02-01\n---\n');
    vault.files.set('书库/《未读》.md', '---\ntags: [book]\n---\n');
    vault.files.set('别处/非书.md', '---\ntags: [book]\nreadingDate: 2026-01-01\n---\n');
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.bookshelf.text).toBe('在读 1');
  });

  it('review 数据文件缺失 → 空（不抛错不建文件）', async () => {
    const snap = await collectHomeSnapshot(mockAppWithVault(vault) as any);
    expect(snap.byDomain.review.text).toBe('');
  });
});

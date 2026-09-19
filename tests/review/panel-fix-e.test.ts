/**
 * 批 E（review 域深审）回归：统计 UI 与设置与样式与文档
 *  - C14① 出题数量行型：text → number + min 0（string 键 binding 自管转 string 落盘，0=自动）
 *  - C14②/A14/U12(T3) 复习间隔缩放：声明式 min/max（输入 8 落盘 5 + 回显 5），
 *    onChange「超界回 1」复刻删除——不再出现显示 8 落 1 的缝
 *  - C14③ 外观占位组 desc 披露「预留」；F3 R 目标阈值 desc 披露「不改变排期间隔」
 *  - C15 统计/历史弹窗构造期不再 allocZ——显示时 topifyZ 发号（ADR-0067 单形制），遮罩/本体成对相邻
 *  - C7 链路：统计/历史弹窗 ESC 可关（esc 层 id 已改 bz-review-stats / bz-review-history）
 *  - U7/A15 域样式契约：裸 .spinner 改 .bz-q-spinner；排除名单 chip 族与 .meta 死规则零残留；
 *    .difficulty-dialog 族保留（批 C 迁移中，生死由主线程定）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { reviewSettingsSchema } from '../../src/review/settings-schema';
import { showStatsModal, showTimeline, closeStatsModal, closeTimeline } from '../../src/review/stats-ui';
import type { ReviewItem } from '../../src/review/data';

const repo = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const flush = (ms = 5) => new Promise((r) => setTimeout(r, ms));

function mkItem(history: ReviewItem['reviewHistory']): ReviewItem {
  return {
    id: '1',
    filePath: 'A.md',
    name: 'A',
    reviewStart: new Date().toISOString(),
    stage: 10,
    phase: 'fsrs',
    stability: 5,
    difficulty: 0.3,
    reviewHistory: history,
    totalReviews: history?.length ?? 0,
    averageConfidence: 0,
    nextReviewDate: null,
    lastReviewed: null,
    lastDifficulty: null,
    completed: false,
  } as ReviewItem;
}

describe('批 E：review 设置行（C14①②③/F3）', () => {
  let state: Record<string, unknown>;
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    state = { forceQuizForReview: true, questionsPerNote: '0', reviewIntervalScale: 1 };
    setSettingsProvider(() => state as any);
  });

  const render = () => {
    // 走 core 渲染器（renderSettingsInto = 域内设置弹窗通路，R9 钳制回显在此实现；
    // settings-panel 侧栏渲染器 commit 钳制不回显的缝归面板批次，不在本批边界）
    const host = document.createElement('div');
    document.body.appendChild(host);
    return renderSettingsInto(host, reviewSettingsSchema({ app: {} as any, dataManager: {} as any }));
  };

  const inputOf = (name: string): HTMLInputElement =>
    document.querySelector(`[data-name="${name}"] input`) as HTMLInputElement;

  const type = (input: HTMLInputElement, v: string) => {
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('T3（A14/U12）：复习间隔缩放输入 8 → 落盘 5 + 输入框回显 5（声明式钳制，R9 通路）', async () => {
    render();
    const input = inputOf('复习间隔缩放');
    expect(input.value).toBe('1');
    type(input, '8');
    // 钳制即时回写：显示值 = 落盘值（旧 onChange 复刻会落 1 而输入框仍显 8）
    expect(input.value).toBe('5');
    expect(state.reviewIntervalScale).toBe(5);
    input.dispatchEvent(new Event('blur'));
    await flush();
    expect(state.reviewIntervalScale).toBe(5);
  });

  it('缩放行下界：输入 0 与 0.05 → 钳到 0.1（min 防非正，替代旧 onChange 回 1）', async () => {
    render();
    const input = inputOf('复习间隔缩放');
    type(input, '0');
    expect(input.value).toBe('0.1');
    expect(state.reviewIntervalScale).toBe(0.1);
    type(input, '0.05');
    expect(input.value).toBe('0.1');
    expect(state.reviewIntervalScale).toBe(0.1);
  });

  it('C14①：出题数量 number 行——string 键落盘仍为 string（session parseInt 口径），min 0 钳负值', () => {
    render();
    const input = inputOf('每篇笔记出题数量');
    expect(input.value).toBe('0'); // 存量 '0'（自动）显示为 0
    type(input, '8');
    expect(state.questionsPerNote).toBe('8'); // string 落盘，类型口径不变
    type(input, '-5');
    expect(state.questionsPerNote).toBe('0'); // 负值钳 0（0=自动）
    expect(input.value).toBe('0');
  });

  it('schema 行声明：缩放行 min/max 且无 onChange、外观占位披露、R 阈值披露、出题数量行型', () => {
    const schema = reviewSettingsSchema({ app: {} as any, dataManager: {} as any });
    // SettingsRow 联合（CustomRow 无 name）统一放宽断言（测试侧只读）
    const rowsOf = (group: string): any[] =>
      (schema.groups.find((g) => g.name === group)!.rows) as any[];
    const scale = rowsOf('复习节奏').find((r) => r.name === '复习间隔缩放');
    expect(scale.type).toBe('number');
    expect(scale.min).toBe(0.1);
    expect(scale.max).toBe(5);
    expect(scale.onChange).toBeUndefined(); // 超界回 1 复刻已删
    const threshold = rowsOf('复习节奏').find((r) => r.name === 'R 目标阈值');
    expect(threshold.desc).toContain('不改变排期间隔'); // F3 语义披露
    const look = rowsOf('外观');
    expect(look.length).toBe(2);
    for (const row of look) expect(row.desc).toBe('预留功能，暂未生效'); // C14③
    const perNote = rowsOf('做题家').find((r) => r.name === '每篇笔记出题数量');
    expect(perNote.type).toBe('number');
    expect(perNote.min).toBe(0);
    expect(perNote.desc).toContain('0 为自动'); // 0=自动语义保留
  });
});

describe('批 E：统计/历史弹窗（C15/C7）', () => {
  const dm = { loadItems: async () => [] as ReviewItem[] } as any;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    closeStatsModal();
    closeTimeline();
  });

  it('C15：统计弹窗显示时 topifyZ 发号——遮罩/本体成对相邻（本体 = 遮罩 + 1，无静态档）', async () => {
    await showStatsModal({ vault: { getAbstractFileByPath: () => null } } as any, dm);
    const mask = document.getElementById('review-stats-mask')!;
    const popup = document.getElementById('review-stats-popup')!;
    const mz = Number(mask.style.zIndex);
    expect(mz).toBeGreaterThan(0);
    expect(Number(popup.style.zIndex)).toBe(mz + 1);
    closeStatsModal();
  });

  it('C7 链路：统计弹窗 ESC 可关（bz-review-stats 层）', async () => {
    await showStatsModal({ vault: { getAbstractFileByPath: () => null } } as any, dm);
    expect(document.getElementById('review-stats-popup')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('review-stats-popup')).toBeNull();
    expect(document.getElementById('review-stats-mask')).toBeNull();
  });

  it('C15/C7 链路：历史弹窗同口径（成对 z + ESC 可关）', async () => {
    await showTimeline(null as any, dm, mkItem([
      { timestamp: new Date().toISOString(), stage: 10, rating: 'good' },
    ]));
    const mask = document.getElementById('review-history-mask')!;
    const popup = document.getElementById('review-history-popup')!;
    const mz = Number(mask.style.zIndex);
    expect(mz).toBeGreaterThan(0);
    expect(Number(popup.style.zIndex)).toBe(mz + 1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('review-history-popup')).toBeNull();
  });
});

describe('批 E：域样式契约（U7/A15）', () => {
  const css = () => repo('src/review/styles.css');

  it('A15：裸 .spinner 已改 .bz-q-spinner（无前缀通用类名不进全局聚合命名空间）', () => {
    expect(css()).not.toMatch(/(^|[\s,}])\.spinner[\s,{:]/);
    expect(css()).toContain('.bz-q-spinner');
  });

  it('U7：排除名单 chip 族与 .bz-sq-item .meta 死规则零残留', () => {
    const c = css();
    expect(c).not.toContain('review-excluded-list');
    expect(c).not.toContain('bz-review-exclude-chip');
    expect(c).not.toContain('bz-review-exclude-remove');
    expect(c).not.toContain('.meta');
  });

  it('U7 边界守护：.difficulty-dialog 族保留（批 C 迁移难度弹窗，生死由主线程定）', () => {
    expect(css()).toContain('.difficulty-dialog');
  });
});

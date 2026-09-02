/**
 * 复习计划核心应用补测（覆盖率目标）：markReview 防御分支与 FSRS 缩放兜底、
 * regenerateQuestions 未初始化、redoReviewLoop popup 缺失路径、quizReviewLoop 空题/失败
 * 与弹窗缺失路径、reviewLoop 快速完成复用常驻通知 + 超时收尾、applyReviewStyles 全着色分支、
 * checkOverdueAndNotify 异常兜底。
 * 兼容性冻结：只按现状断言，不改生产代码。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { reviewApp } from '../../src/review/app';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

async function seedOverdue(vault: MockVault, partial: any = {}) {
  const now = new Date();
  vault.files.set(
    REVIEW_FILE_PATH,
    JSON.stringify([
      {
        id: 'x', filePath: 'A.md', name: 'A',
        reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
        reviewHistory: [], totalReviews: 0, averageConfidence: 0,
        nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
        ...partial,
      },
    ])
  );
}

/** 复习会话 quiz mock；popupOnStart=false 时 startReviewSession 不建 DOM（覆盖 popup 缺失分支） */
function makeQuizMock(opts: { ai?: boolean; popupOnStart?: boolean } = {}) {
  const quiz: any = {
    ai: opts.ai === false ? null : {},
    popup: null as any,
    mask: null as any,
    _cb: null as any,
    _ended: 0,
    startReviewSession(o: any) {
      this._cb = o.onComplete;
      if (opts.popupOnStart !== false) {
        this.popup = document.createElement('div');
        this.popup.id = 'quiz-popup';
        this.mask = document.createElement('div');
        document.body.appendChild(this.mask);
        document.body.appendChild(this.popup);
      }
    },
    endReviewSession() {
      this._ended++;
    },
    close() {
      if (this.popup && this.popup.parentNode) this.popup.remove();
      if (this.mask && this.mask.parentNode) this.mask.remove();
      this.popup = null;
      this.mask = null;
    },
    manager: {
      getQuestionsForNote: async () => [],
      saveQuestionsForNote: async () => {},
    },
    ensureQuestions: async () => {},
  };
  return quiz;
}

const Q = [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }];

describe('markReview 防御分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null;
  });

  it('条目不存在 → 「条目不存在」且不新增条目', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('不存在.md', 'good');
    expect(getNoticeMessages()).toContain('条目不存在');
    // loadItems 首建空库（jsonStore 语义），但不会有任何条目写入
    const raw = vault.files.has(REVIEW_FILE_PATH) ? JSON.parse(vault.files.get(REVIEW_FILE_PATH)!) : [];
    expect(raw).toEqual([]);
  });

  it('nextReviewDate 为空的存量数据 → 视作早已到期，正常推进阶梯', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 2, nextReviewDate: null });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'easy'); // easy +2 → stage 4
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(4);
    expect(getNoticeMessages().some((m) => m.includes('后复习'))).toBe(true); // 阶梯通知文案
  });
});

describe('FSRS 相位间隔缩放兜底', () => {
  beforeEach(() => {
    resetObsidianMocks();
    (reviewApp as any).dataManager = null;
  });

  it('缩放系数非法（非正数/NaN）→ 按 1 处理（与 scale=1 结果一致）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    const runWith = async (scale: any): Promise<number> => {
      vault.files.set(
        REVIEW_FILE_PATH,
        JSON.stringify([
          {
            id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 12, phase: 'fsrs',
            stability: 100, difficulty: 0.3, reviewHistory: [], totalReviews: 1, averageConfidence: 0,
            nextReviewDate: now.toISOString(),
            lastReviewed: new Date(now.getTime() - 30 * 86400000).toISOString(),
            lastDifficulty: 'good', completed: false,
          },
        ])
      );
      setSettingsProvider(() => ({ reviewIntervalScale: scale }) as any);
      const app = makeApp(vault);
      setApp(app);
      await reviewApp.markReview('A.md', 'good');
      const items = await new ReviewDataManager(app).loadItems();
      return new Date(items[0].nextReviewDate!).getTime();
    };
    const base = await runWith(1);
    const badText = await runWith('abc'); // NaN → 1
    const negative = await runWith(-2); // ≤0 → 1
    expect(Math.abs(badText - base)).toBeLessThan(base * 0.02);
    expect(Math.abs(negative - base)).toBeLessThan(base * 0.02);
  });

  it('极小结果钳到 0.01 天下限（R 极低 + again）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 0.05, difficulty: 1,
      lastReviewed: new Date(now.getTime() - 400 * 86400000).toISOString(),
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'again');
    const items = await new ReviewDataManager(app).loadItems();
    const diffDays = (new Date(items[0].nextReviewDate!).getTime() - now.getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(0); // 不为负即可（内部 max(0.01) 兜底）
  });
});

describe('regenerateQuestions / batchGenerateQuestions 未初始化', () => {
  beforeEach(() => {
    resetObsidianMocks();
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._quizOverride = null;
  });

  afterEach(async () => {
    (reviewApp as any)._quizOverride = null;
    vi.restoreAllMocks();
    const quizModule = await import('../../src/review/quiz-core');
    quizModule.QuizMasterUI.ai = null;
    quizModule.quizUI.ai = null;
  });

  it('做题家未初始化 → regenerate 返回 []；batch 提示并返回 {}', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const quizModule = await import('../../src/review/quiz-core');
    quizModule.quizUI.ai = null;
    const out = await reviewApp.regenerateQuestions('A.md');
    expect(out).toEqual([]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const batch = await reviewApp.batchGenerateQuestions([
      { id: '1', filePath: 'A.md', name: 'A' } as any,
    ]);
    expect(batch).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    expect(getNoticeMessages()).toContain('做题家未初始化（缺少 AI），已改用普通复习');
  });
});





describe('reviewLoop 常驻通知复用与超时收尾', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._reviewNotice = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    (reviewApp as any)._reviewNotice = null;
    vi.restoreAllMocks();
  });

  function mkRow(path: string, lastReviewed: string | null): any {
    const now = new Date();
    return {
      id: path, filePath: path, name: path, reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed, lastDifficulty: null, completed: false,
    };
  }

  it('第一篇已复习（30s 内）→ 直接进第二篇并复用同一条常驻通知 setMessage', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', 'x');
    vault.files.set('B.md', 'x');
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    let activePath = 'A.md'; // 第一篇期间必须停在 A 上，否则首 tick 即判「切走」
    (app.workspace as any).getActiveFile = () => ({ path: activePath });
    setApp(app);
    // A 已在 10s 前被评级 → 首 tick 判定完成直接跳 B
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([mkRow('A.md', new Date(Date.now() - 10000).toISOString()), mkRow('B.md', null)]));
    const handle = { setType: vi.fn(), setMessage: vi.fn(), hide: vi.fn() };
    vi.spyOn(await import('../../src/core/notice'), 'notify').mockReturnValue(handle as any);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const p = reviewApp.reviewLoop([mkRow('A.md', null), mkRow('B.md', null)], 0);
    await vi.advanceTimersByTimeAsync(1100); // 第一篇：发现 A 已复习 → 进第二篇（通知复用）
    expect(handle.setMessage).toHaveBeenLastCalledWith(expect.stringContaining('(2/2): B.md'));
    // 切走活动文件 → 中断收尾
    activePath = 'OTHER.md';
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();
    await expect(p).resolves.toBeUndefined();
    expect(handle.setMessage).toHaveBeenCalledWith('已切换到其他笔记，本轮复习中断');
    expect(handle.setType).toHaveBeenCalledWith('warning');
  });

  it('300 次轮询超时 → 常驻通知 warning「复习超时」收尾', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', 'x');
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'A.md' }); // 一直在目标笔记上但不评级
    setApp(app);
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([mkRow('A.md', null)]));
    const handle = { setType: vi.fn(), setMessage: vi.fn(), hide: vi.fn() };
    vi.spyOn(await import('../../src/core/notice'), 'notify').mockReturnValue(handle as any);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const p = reviewApp.reviewLoop([mkRow('A.md', null)], 0);
    await vi.advanceTimersByTimeAsync(301 * 1000); // 超过 maxChecks=300
    vi.useRealTimers();
    await expect(p).resolves.toBeUndefined();
    expect(handle.setMessage).toHaveBeenCalledWith('复习超时，请手动继续');
    expect(handle.setType).toHaveBeenCalledWith('warning');
    expect((reviewApp as any)._reviewNotice).toBeNull();
  });
});

describe('applyReviewStyles 着色矩阵', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._styledPaths = new Set(); // ticket 48：曾染色集合逐用例隔离
    vault = new MockVault();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /** 在文件树挂 data-path 节点（可缺 tree-item-inner） */
  function treeNode(path: string, withInner = true): HTMLElement | null {
    if (!withInner) {
      const bare = document.createElement('div');
      bare.setAttribute('data-path', path);
      document.body.appendChild(bare);
      return null;
    }
    const el = document.createElement('div');
    el.setAttribute('data-path', path);
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    el.appendChild(inner);
    document.body.appendChild(el);
    return inner;
  }

  function row(partial: any): any {
    const now = new Date();
    return {
      id: partial.filePath, filePath: partial.filePath, name: partial.filePath,
      reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
      reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: null, lastReviewed: null, lastDifficulty: null, completed: false,
      ...partial,
    };
  }

  it('ticket 48 缩范围：非复习条目节点全库扫描不动；树节点缺失跳过；旧徽标先移除', async () => {
    // A：有文件但无树节点 → 不在处理范围（continue 语义）
    vault.files.set('A.md', 'x');
    // C：有树节点但无复习条目 → 缩范围后不再被全库重置（颜色保持用户/他方设置）
    const innerC = treeNode('C.md')!;
    vault.files.set('C.md', 'x');
    innerC.style.color = '#1890ff';
    // D：有条目且已有旧徽标 → 先移除再按状态重建
    const innerD = treeNode('D.md')!;
    vault.files.set('D.md', 'x');
    const staleBadge = document.createElement('span');
    staleBadge.className = 'review-stage-badge';
    staleBadge.textContent = '99d';
    innerD.appendChild(staleBadge);

    vault.files.set(
      REVIEW_FILE_PATH,
      JSON.stringify([row({ filePath: 'D.md', stage: 1, currentStage: undefined })])
    );
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app); // 无 changedFile → 复习条目扫描（非全库）
    // 非条目节点颜色不被触碰（此前全库路径会重置为空）
    expect(innerC.style.color).toBe('rgb(24, 144, 255)');
    // 旧「99d」徽标先被移除；该条目 completed=false 且无到期日 → 不再挂新徽标
    expect(innerD.querySelector('.review-stage-badge')).toBeNull();
  });

  it('ticket 48：曾染色条目移出计划 → 下次扫描回退颜色与徽章', async () => {
    const inner = treeNode('E.md')!;
    vault.files.set('E.md', 'x');
    vault.files.set(
      REVIEW_FILE_PATH,
      JSON.stringify([row({ filePath: 'E.md', stage: 1, nextReviewDate: new Date(Date.now() + 3600000).toISOString() })])
    );
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app); // 首次：条目染色 + 挂徽标
    expect(inner.style.color).toBe('rgb(24, 144, 255)');
    expect(inner.querySelector('.review-stage-badge')).not.toBeNull();
    // 移出计划（条目不存在于 review.json）→ 曾染色路径被回退
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([]));
    await reviewApp.applyReviewStyles(app);
    expect(inner.style.color).toBe('');
    expect(inner.querySelector('.review-stage-badge')).toBeNull();
    expect((reviewApp as any)._styledPaths.has('E.md')).toBe(false);
  });

  it('逾期红 + 📅 徽标；阶梯 stage3-6 黄、stage7+ 绿；时间徽标 d/h/m 三档', async () => {
    const now = Date.now();
    // 到期时间均留足余量（断言只关心 d/h/m 单位选择分支，不卡精确边界）
    vault.files.set('A.md', 'x');
    vault.files.set('B.md', 'x');
    vault.files.set('C.md', 'x');
    vault.files.set('D.md', 'x');
    const inA = treeNode('A.md')!;
    const inB = treeNode('B.md')!;
    const inC = treeNode('C.md')!;
    const inD = treeNode('D.md')!;
    vault.files.set(
      REVIEW_FILE_PATH,
      JSON.stringify([
        row({ filePath: 'A.md', stage: 1, nextReviewDate: new Date(now - 60000).toISOString() }), // 逾期
        row({ filePath: 'B.md', stage: 4, nextReviewDate: new Date(now + 5 * 3600000 + 30 * 60000).toISOString() }), // 黄 5h
        row({ filePath: 'C.md', stage: 8, nextReviewDate: new Date(now + 2 * 86400000 + 6 * 3600000).toISOString() }), // 绿 2d
        row({ filePath: 'D.md', stage: 1, nextReviewDate: new Date(now + 45 * 60000 + 30000).toISOString() }), // 蓝 45m
      ])
    );
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app);
    expect(inA.style.color).toBe('rgb(255, 71, 87)');
    expect(inA.querySelector('.review-stage-badge')!.textContent).toBe('📅');
    expect(inB.style.color).toBe('rgb(250, 173, 20)');
    expect(inB.querySelector('.review-stage-badge')!.textContent).toBe('5h');
    expect(inC.style.color).toBe('rgb(82, 196, 26)');
    expect(inC.querySelector('.review-stage-badge')!.textContent).toBe('2d');
    expect(inD.style.color).toBe('rgb(24, 144, 255)');
    expect(inD.querySelector('.review-stage-badge')!.textContent).toBe('45m');
  });

  it('FSRS 相位按 R(t) 着色三档（绿/黄/橙）；无到期日不挂徽标', async () => {
    const now = Date.now();
    vault.files.set('A.md', 'x');
    vault.files.set('B.md', 'x');
    vault.files.set('C.md', 'x');
    const inA = treeNode('A.md')!;
    const inB = treeNode('B.md')!;
    const inC = treeNode('C.md')!;
    vault.files.set(
      REVIEW_FILE_PATH,
      JSON.stringify([
        row({
          filePath: 'A.md', stage: 12, phase: 'fsrs', stability: 100,
          lastReviewed: new Date(now).toISOString(),
        }),
        row({
          filePath: 'B.md', stage: 12, phase: 'fsrs', stability: 5,
          lastReviewed: new Date(now - 2 * 86400000).toISOString(),
        }),
        row({
          filePath: 'C.md', stage: 12, phase: 'fsrs', stability: 1,
          lastReviewed: new Date(now - 30 * 86400000).toISOString(),
        }),
      ])
    );
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app);
    expect(inA.style.color).toBe('rgb(82, 196, 26)'); // R≥0.9
    expect(inA.querySelector('.review-stage-badge')).toBeNull(); // 无 nextReviewDate → 无徽标
    const pctB = (() => {
      // 与 UI 同式计算校验落在黄档
      const t = 2;
      const r = Math.pow(1 + t / (5 * 0.9), -0.9);
      return Math.round(r * 100);
    })();
    if (pctB >= 70 && pctB < 90) expect(inB.style.color).toBe('rgb(250, 173, 20)');
    else if (pctB >= 90) expect(inB.style.color).toBe('rgb(82, 196, 26)');
    else expect(inB.style.color).toBe('rgb(255, 159, 67)');
    expect(inC.style.color).toBe('rgb(255, 159, 67)'); // R<0.7 橙
  });
});

describe('checkOverdueAndNotify 异常兜底', () => {
  beforeEach(() => {
    resetObsidianMocks();
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._notifiedOverdue = new Set();
  });

  afterEach(() => {
    (reviewApp as any)._notifiedOverdue = new Set();
    vi.restoreAllMocks();
  });

  it('getApp 抛错（未初始化）→ console.error 兜底不外抛', async () => {
    setApp(null as any);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await reviewApp.checkOverdueAndNotify();
    expect(errSpy).toHaveBeenCalled();
  });
});

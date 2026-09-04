// @vitest-environment node
/**
 * 数据体检（checkup 域，D4）数据层回归：
 * - 检查一 json 可解析：全绿样本 / 坏 json + CONFIG/.CORRUPT 留档路径列出；
 * - 检查二 字段漂移：约定外字段/缺失字段统计、段级漂移（只报告不修）；
 * - 检查三 孤儿条目：影院海报 / 书架 md 封面与 EPUB / 剪藏 savedArchive 残留 / 收藏关联笔记；
 * - 检查四 同源一致性：双视角计数（含不一致样本）/ 非对象 / 重复 id / 缺 id / 缺标题；
 * - 一键修复 + 撤销链：favorites 关联清空与还原、clipbook savedArchive 移除与插回。
 * 全部只读纪律断言：体检/检查不写任何文件（仅修复写定点数据文件）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { verdictOfJsonTarget, checkJsonFiles, jsonIssuesOf } from '../../src/checkup/checks-json';
import {
  MEMO_ITEM_FIELDS,
  FAVORITES_ITEM_FIELDS,
  POMODORO_HISTORY_FIELDS,
  analyzeItemDrift,
  analyzeSegmentDrift,
  checkFieldDrift,
  driftIssuesOf,
} from '../../src/checkup/checks-drift';
import { checkOrphans } from '../../src/checkup/checks-orphans';
import {
  analyzeMemoConsistency,
  consistencyIssuesOf,
  checkSameSourceConsistency,
} from '../../src/checkup/checks-consistency';
import { fixOrphanIssues, runCheckup, getLastCheckupReport, __resetCheckupCacheForTests } from '../../src/checkup/run';

const DIR = 'CONFIG/STORAGE';
const CORRUPT = 'CONFIG/.CORRUPT';

/** memo 条目全字段样本（14 字段齐全 = 无缺失漂移） */
function fullMemoItem(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'item-1', title: '买牛奶', scene: '生活', priority: 'minor', created: '2026-01-01 00:00:00',
    completed: null, due: null, notePath: null, notePosition: null, scriptName: null,
    courseName: null, coursePath: null, linkedNote: null, url: null, ...over,
  };
}

/** favorites 条目全字段样本（15 字段齐全） */
function fullFavItem(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fav-1', tags: ['GitHub'], title: '仓库', description: '', pinned: false,
    url: 'https://github.com', balance: null, balanceCacheTime: null, balanceError: null,
    linkedNote: null, created: '2026-01-01 00:00:00', type: 'GitHub', llmConfig: null,
    archived: false, archivedAt: null, ...over,
  };
}

/** 构造 mock app：vault 文件 + metadataCache frontmatter 按路径返回 */
function makeApp(
  files: Record<string, string> = {},
  frontmatter: Record<string, Record<string, unknown>> = {}
): { app: any; vault: MockVault } {
  const vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  const app = {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const fm = frontmatter[f.path];
        return fm ? { frontmatter: fm } : null;
      },
    },
    plugins: {},
  };
  setApp(app as never);
  return { app: app as any, vault };
}

describe('检查一：json 可解析', () => {
  beforeEach(() => __resetCheckupCacheForTests());

  it('纯函数 verdictOfJsonTarget：missing/ok/corrupt 三态', () => {
    expect(verdictOfJsonTarget('a', 'A', null, []).state).toBe('missing');
    expect(verdictOfJsonTarget('a', 'A', { ok: true, data: [] }, []).state).toBe('ok');
    const v = verdictOfJsonTarget('a', 'A', { ok: false, raw: 'x' }, ['a.1.bak']);
    expect(v.state).toBe('corrupt');
    expect(v.backups).toEqual(['a.1.bak']);
  });

  it('全绿样本：坏文件为零，问题清单为空', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]', [`${DIR}/favorites.json`]: '[]' });
    const sec = await checkJsonFiles(app);
    expect(sec).not.toBeNull();
    expect(sec!.issues).toEqual([]);
    expect(sec!.summary).toContain('2 个数据文件全部可解析');
    expect(sec!.scanned).toBe(2);
  });

  it('坏 json 样本：红色问题列出文件与 CONFIG/.CORRUPT 留档路径', async () => {
    const { app } = makeApp({
      [`${DIR}/memo.json`]: '{oops',
      [`${CORRUPT}/memo.json.20260904-120000.bak`]: '[]',
    });
    const sec = await checkJsonFiles(app);
    expect(sec).not.toBeNull();
    const errs = sec!.issues.filter((i) => i.severity === 'error');
    expect(errs).toHaveLength(1);
    expect(errs[0].title).toContain('备忘录 / 待办');
    expect(errs[0].detail).toContain(`${DIR}/memo.json`);
    expect(errs[0].detail).toContain(`${CORRUPT}/memo.json.20260904-120000.bak`);
    // 无留档时的坏文件也照报（留档：暂无）
    const { app: app2 } = makeApp({ [`${DIR}/memo.json`]: '{oops' });
    const sec2 = await checkJsonFiles(app2);
    const err2 = sec2!.issues.find((i) => i.severity === 'error');
    expect(err2!.detail).toContain('暂无');
  });

  it('jsonIssuesOf：无坏文件时不出「D1 留档」说明', () => {
    const ok = jsonIssuesOf([{ file: 'a', label: 'A', state: 'ok', backups: [] }]);
    expect(ok.issues).toEqual([]);
  });
});

describe('检查二：字段漂移', () => {
  it('纯函数 analyzeItemDrift：意外字段/缺失字段计数', () => {
    const item = fullMemoItem({ foo: 1, bar: 2 }) as Record<string, unknown>;
    delete item.due; // 缺一个约定字段
    const s = analyzeItemDrift([item], MEMO_ITEM_FIELDS);
    expect(s.scanned).toBe(1);
    expect(s.extra['foo']).toBe(1);
    expect(s.extra['bar']).toBe(1);
    expect(s.missing['due']).toBe(1);
  });

  it('纯函数 analyzeItemDrift：非对象条目计数', () => {
    const s = analyzeItemDrift(['oops', 42, fullMemoItem()], MEMO_ITEM_FIELDS);
    expect(s.nonObject).toBe(2);
    expect(s.scanned).toBe(1);
  });

  it('纯函数 analyzeSegmentDrift：数组/缺段/多段', () => {
    expect(analyzeSegmentDrift([], ['version']).isArray).toBe(true);
    const s = analyzeSegmentDrift({ version: 1, ghost: true }, ['version', 'pinned']);
    expect(s.extra).toEqual(['ghost']);
    expect(s.missing).toEqual(['pinned']);
  });

  it('driftIssuesOf：约定外字段出黄色问题，缺失字段只出提示，不修任何数据', async () => {
    const { app, vault } = makeApp({
      [`${DIR}/memo.json`]: JSON.stringify([fullMemoItem({ legacy: 'x' })]),
      [`${DIR}/favorites.json`]: JSON.stringify([fullFavItem()]),
    });
    const sec = await checkFieldDrift(app);
    expect(sec).not.toBeNull();
    const warns = sec!.issues.filter((i) => i.severity === 'warn');
    expect(warns.some((w) => w.title.includes('约定外字段') && w.title.includes('备忘录'))).toBe(true);
    expect(warns.some((w) => w.detail && w.detail.includes('legacy'))).toBe(true);
    // 只报告不修：文件未被改动
    expect(vault.modifiedPaths).toEqual([]);
    expect(sec!.summary).toContain('漂移');
  });

  it('pomodoro history 条目：残留字段（target 等）按约定外统计', async () => {
    const { app } = makeApp({
      [`${DIR}/pomodoro.json`]: JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false },
        history: [{ ts: 1, duration: 25, target: '旧残留' }],
      }),
    });
    const sec = await checkFieldDrift(app);
    const warn = sec!.issues.find((i) => i.severity === 'warn' && i.title.includes('番茄钟'));
    expect(warn).toBeTruthy();
    expect(warn!.title).toContain('约定外字段');
  });

  it('全绿样本：全字段条目 + 段级齐全 → 零问题', async () => {
    const { app } = makeApp({
      [`${DIR}/memo.json`]: JSON.stringify([fullMemoItem()]),
      [`${DIR}/favorites.json`]: JSON.stringify([fullFavItem()]),
      [`${DIR}/clipbook.json`]: JSON.stringify({ articleOverrides: {}, savedArchive: [], order: [] }),
      [`${DIR}/news.json`]: JSON.stringify({ articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: {} }),
      [`${DIR}/home.json`]: JSON.stringify({ version: 1, pinned: [] }),
    });
    const sec = await checkFieldDrift(app);
    expect(sec!.issues).toEqual([]);
    expect(sec!.summary).not.toContain('漂移');
  });

  it('漂移字段常量与域 normalize 契约一致（14/15/3）', () => {
    expect(MEMO_ITEM_FIELDS).toHaveLength(14);
    expect(FAVORITES_ITEM_FIELDS).toHaveLength(15);
    expect(POMODORO_HISTORY_FIELDS).toEqual(['ts', 'duration', 'task']);
  });

  it('driftIssuesOf：非对象条目红色问题（检查函数层面）', () => {
    const { summary, issues } = driftIssuesOf([
      {
        plan: { file: `${DIR}/memo.json`, label: '备忘录 / 待办', kind: 'item' },
        parsed: { ok: true, data: [] } as const,
        item: { scanned: 0, nonObject: 1, extra: {}, missing: {} },
      },
    ]);
    expect(issues[0].severity).toBe('error');
    expect(summary).toContain('1 个存在字段漂移');
  });
});

describe('检查三：孤儿条目', () => {
  it('影院：海报文件缺失列出条目与路径；文件在则不报', async () => {
    const fm = { '我的/影视/《T》.md': { tags: ['电影'], 海报: 'CONFIG/BOOK/p.png' } };
    const { app } = makeApp({ '我的/影视/《T》.md': '# T' }, fm);
    const sec = await checkOrphans(app);
    const hit = sec!.issues.find((i) => i.title.includes('影视《T》'));
    expect(hit).toBeTruthy();
    expect(hit!.detail).toContain('CONFIG/BOOK/p.png');

    const { app: app2 } = makeApp({ '我的/影视/《T》.md': '# T', 'CONFIG/BOOK/p.png': 'img' }, fm);
    const sec2 = await checkOrphans(app2);
    expect(sec2!.issues.find((i) => i.title.includes('影视《T》'))).toBeUndefined();
  });

  it('书架墙：md 封面缺失与 EPUB 文件缺失分别报告', async () => {
    const weave = JSON.stringify({
      books: {
        a: {
          meta: { title: 'E书' },
          file: { vaultPath: 'Books/e.epub' },
          reading: { position: { percent: 0.5 }, stats: {} },
          notes: {},
        },
      },
    });
    const { app } = makeApp(
      {
        '书库/B.md': '# B',
        [`${DIR}/weave-data.json`]: weave,
      },
      { '书库/B.md': { tags: ['book'], cover: 'CONFIG/BOOK/B/c.png' } }
    );
    const sec = await checkOrphans(app);
    expect(sec!.issues.some((i) => i.title.includes('书目《B》') && i.detail!.includes('CONFIG/BOOK/B/c.png'))).toBe(true);
    expect(sec!.issues.some((i) => i.title.includes('EPUB 书目《E书》'))).toBe(true);
  });

  it('剪藏本：savedArchive 残留指向不存在笔记 → 可修复项；url 命中剪藏则不报', async () => {
    const sidecar = JSON.stringify({ articleOverrides: {}, savedArchive: [{ url: 'https://x', title: '甲', savedAt: '1' }], order: [] });
    const { app } = makeApp(
      {
        [`${DIR}/clipbook.json`]: sidecar,
        '归档/网页剪藏/n.md': '# n',
      },
      { '归档/网页剪藏/n.md': { url: 'https://y' } }
    );
    const sec = await checkOrphans(app);
    const hit = sec!.issues.find((i) => i.fixGroup === 'clipbook');
    expect(hit).toBeTruthy();
    expect(hit!.fixKey).toBe('https://x');
    expect(hit!.title).toContain('剪藏残留《甲》');

    const { app: app2 } = makeApp(
      { [`${DIR}/clipbook.json`]: sidecar, '归档/网页剪藏/n.md': '# n' },
      { '归档/网页剪藏/n.md': { url: 'https://x' } }
    );
    const sec2 = await checkOrphans(app2);
    expect(sec2!.issues.find((i) => i.fixGroup === 'clipbook')).toBeUndefined();
  });

  it('收藏本：关联笔记不存在 → 可修复项；存在则不报', async () => {
    const { app } = makeApp({
      [`${DIR}/favorites.json`]: JSON.stringify([fullFavItem({ linkedNote: '我的/missing.md' })]),
    });
    const sec = await checkOrphans(app);
    const hit = sec!.issues.find((i) => i.fixGroup === 'favorites');
    expect(hit).toBeTruthy();
    expect(hit!.detail).toContain('我的/missing.md');

    const { app: app2 } = makeApp({
      [`${DIR}/favorites.json`]: JSON.stringify([fullFavItem({ linkedNote: '我的/here.md' })]),
      '我的/here.md': '# here',
    });
    const sec2 = await checkOrphans(app2);
    expect(sec2!.issues).toEqual([]);
  });

  it('只读纪律：孤儿检查全程不写盘', async () => {
    const { app, vault } = makeApp({
      '我的/影视/《T》.md': '# T',
      [`${DIR}/favorites.json`]: JSON.stringify([fullFavItem({ linkedNote: 'x.md' })]),
    }, { '我的/影视/《T》.md': { tags: ['电影'], 海报: 'nope.png' } });
    await checkOrphans(app);
    expect(vault.modifiedPaths).toEqual([]);
  });
});

describe('检查四：同源一致性', () => {
  it('全绿样本：双视角条数/完成数一致', async () => {
    const items = [fullMemoItem(), fullMemoItem({ id: 'item-2', completed: '2026-01-02 00:00:00' })];
    const { app } = makeApp({ [`${DIR}/memo.json`]: JSON.stringify(items) });
    const sec = await checkSameSourceConsistency(app);
    expect(sec!.issues).toEqual([]);
    expect(sec!.summary).toContain('两域口径一致');
    expect(sec!.summary).toContain('完成 1');
  });

  it('双视角不一致样本：计数分叉报红', () => {
    const { issues } = consistencyIssuesOf({
      total: 3, nonObject: 0, missingId: 0, duplicateId: 0, missingTitle: 0,
      memoView: { total: 3, done: 2 },
      todoView: { total: 2, done: 1 },
    });
    const err = issues.find((i) => i.severity === 'error');
    expect(err).toBeTruthy();
    expect(err!.title).toContain('双视角计数不一致');
  });

  it('非对象条目报红（两域读取都会中断）', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: JSON.stringify(['oops']) });
    const sec = await checkSameSourceConsistency(app);
    expect(sec!.issues.some((i) => i.severity === 'error' && i.title.includes('非对象条目'))).toBe(true);
  });

  it('重复 id 报黄、缺标题报黄、缺 id 只提示', async () => {
    const { app } = makeApp({
      [`${DIR}/memo.json`]: JSON.stringify([
        fullMemoItem(),
        fullMemoItem({ title: '  ' }),
        fullMemoItem({ id: '' }),
      ]),
    });
    const sec = await checkSameSourceConsistency(app);
    expect(sec!.issues.some((i) => i.severity === 'warn' && i.title.includes('重复 id'))).toBe(true);
    expect(sec!.issues.some((i) => i.severity === 'warn' && i.title.includes('缺少标题'))).toBe(true);
    expect(sec!.issues.some((i) => i.severity === 'info' && i.title.includes('缺少 id'))).toBe(true);
  });

  it('文件非数组形态报红；文件不存在跳过不报', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '{"x":1}' });
    const sec = await checkSameSourceConsistency(app);
    expect(sec!.issues.some((i) => i.severity === 'error')).toBe(true);

    const { app: app2 } = makeApp({});
    const sec2 = await checkSameSourceConsistency(app2);
    expect(sec2!.issues).toEqual([]);
    expect(sec2!.summary).toContain('跳过');
  });
});

describe('一键修复 + 撤销链', () => {
  it('favorites：清空失效关联（条目保留），undo 原样恢复', async () => {
    const raw = JSON.stringify([
      fullFavItem({ id: 'a', linkedNote: '我的/gone.md' }),
      fullFavItem({ id: 'b', linkedNote: '我的/keep.md' }),
    ]);
    const { app, vault } = makeApp({ [`${DIR}/favorites.json`]: raw, '我的/keep.md': '# k' });
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'favorites', fixKey: 'a' },
    ];
    const [outcome] = await fixOrphanIssues(app, issues);
    expect(outcome.fixed).toBe(1);
    const after = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    expect(after[0].linkedNote).toBeNull();
    expect(after[1].linkedNote).toBe('我的/keep.md');
    // 撤销链
    await outcome.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    expect(restored[0].linkedNote).toBe('我的/gone.md');
  });

  it('clipbook：移除失效 savedArchive 残留，undo 按原索引插回', async () => {
    const raw = JSON.stringify({
      articleOverrides: {},
      savedArchive: [
        { url: 'https://gone', title: '甲', savedAt: '1' },
        { url: 'https://stay', title: '乙', savedAt: '2' },
        { url: 'https://gone2', title: '丙', savedAt: '3' },
      ],
      order: [],
    });
    const { app, vault } = makeApp({ [`${DIR}/clipbook.json`]: raw });
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook', fixKey: 'https://gone' },
      { severity: 'warn' as const, title: 't2', fixGroup: 'clipbook', fixKey: 'https://gone2' },
    ];
    const [outcome] = await fixOrphanIssues(app, issues);
    expect(outcome.fixed).toBe(2);
    const mid = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(mid.savedArchive.map((s: any) => s.url)).toEqual(['https://stay']);
    await outcome.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(restored.savedArchive.map((s: any) => s.url)).toEqual(['https://gone', 'https://stay', 'https://gone2']);
  });

  it('无可修复组时不写盘、返回空', async () => {
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    const outcomes = await fixOrphanIssues(app, [{ severity: 'warn', title: '海报缺失' }]);
    expect(outcomes).toEqual([]);
    expect(vault.modifiedPaths).toEqual([]);
  });
});

describe('编排器与结果缓存', () => {
  beforeEach(() => __resetCheckupCacheForTests());

  it('runCheckup：四项检查齐全，报告入缓存；再跑覆盖', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    const report = await runCheckup(app);
    expect(report).not.toBeNull();
    expect(report!.sections.map((s) => s.id)).toEqual(['json', 'drift', 'orphan', 'consistency']);
    expect(getLastCheckupReport()).toBe(report);
    const report2 = await runCheckup(app);
    expect(report2!.finishedAt).toBe(report!.finishedAt || report2!.finishedAt); // 结构覆盖即可
    expect(getLastCheckupReport()).toBe(report2);
  });

  it('runCheckup：取消后返回 null，不产生报告', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    const report = await runCheckup(app, { isCancelled: () => true });
    expect(report).toBeNull();
    expect(getLastCheckupReport()).toBeNull();
  });

  it('单检查抛错降级为该项红色问题，不拖垮整页', async () => {
    const app: any = makeApp({}).app;
    (app as any).vault = {
      // 故意弄坏 getMarkdownFiles：孤儿检查抛错
      ...app.vault,
      getMarkdownFiles: () => {
        throw new Error('boom');
      },
    };
    const report = await runCheckup(app);
    expect(report).not.toBeNull();
    const orphan = report!.sections.find((s) => s.id === 'orphan')!;
    expect(orphan.issues[0].severity).toBe('error');
    expect(orphan.issues[0].detail).toContain('boom');
    expect(report!.sections).toHaveLength(4);
  });
});

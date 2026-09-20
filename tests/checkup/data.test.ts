// @vitest-environment node
/**
 * 数据体检（checkup 域，D4）数据层回归：
 * - 检查一 json 可解析：全绿样本 / 坏 json + CONFIG/.CORRUPT 留档路径列出 / 读失败≠缺失；
 * - 检查二 字段漂移：约定外字段/缺失字段统计、段级漂移（只报告不修）；
 * - 检查三 孤儿条目：影院海报 / 书架 md 封面与 EPUB / 游戏封面截图 / 剪藏 savedArchive 残留 /
 *   收藏关联笔记（剪藏目录与 url 命中已收编 clipbook 单源）；
 * - 检查四 同源一致性：双链计数（含不一致样本）/ 字段级归一分叉 / 非对象 / 重复 id；
 * - 一键修复 + 撤销链：favorites 关联清空与还原、clipbook 三组合批一次读写、
 *   文件缺失不建 stub、undo 不顶掉用户新编辑。
 * 全部只读纪律断言：体检/检查不写任何文件（仅修复写定点数据文件）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { verdictOfJsonTarget, checkJsonFiles, jsonIssuesOf } from '../../src/checkup/checks-json';
import {
  MEMO_ITEM_FIELDS,
  FAVORITES_ITEM_FIELDS,
  POMODORO_HISTORY_FIELDS,
  SEGMENT_FIELDS,
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
  divergedKeysOf,
} from '../../src/checkup/checks-consistency';
import { fixOrphanIssues, runCheckup, getLastCheckupReport, __resetCheckupCacheForTests, CHECK_LABELS } from '../../src/checkup/run';
import { emptySidecar } from '../../src/clipbook/data';
import { emptyData } from '../../src/clipbook/news-data';

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

/** 构造 mock app：vault 文件 + metadataCache frontmatter 按路径返回（settings 可选注入） */
function makeApp(
  files: Record<string, string> = {},
  frontmatter: Record<string, Record<string, unknown>> = {},
  settings: Record<string, unknown> = {}
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
  setSettingsProvider(() => settings as never);
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

  it('坏 json 样本：红色问题列出文件与 CONFIG/.CORRUPT 留档路径；时态文案对（func P3-5：体检当下未重建）', async () => {
    const { app } = makeApp({
      [`${DIR}/memo.json`]: '{oops',
      [`${CORRUPT}/memo.json.20260904-120000.bak`]: '[]',
    });
    const sec = await checkJsonFiles(app);
    expect(sec).not.toBeNull();
    const errs = sec!.issues.filter((i) => i.severity === 'error');
    expect(errs).toHaveLength(1);
    expect(errs[0].title).toContain('备忘录');
    expect(errs[0].detail).toContain(`${DIR}/memo.json`);
    expect(errs[0].detail).toContain(`${CORRUPT}/memo.json.20260904-120000.bak`);
    // func P3-5：留档+重建发生在「对应功能下次读取时」，体检当下什么都没发生——文案不得写成已完成时态
    const d1 = sec!.issues.find((i) => i.title.includes('自动留档'));
    expect(d1).toBeTruthy();
    expect(d1!.title).toContain('下次读取时');
    expect(d1!.title).not.toContain('已由存储层');
    // 无留档时的坏文件也照报（留档：暂无）
    const { app: app2 } = makeApp({ [`${DIR}/memo.json`]: '{oops' });
    const sec2 = await checkJsonFiles(app2);
    const err2 = sec2!.issues.find((i) => i.severity === 'error');
    expect(err2!.detail).toContain('暂无');
  });

  it('P3-1：文件存在但读不动（IO/占用）→ warn 提示重试，不吞成 missing 假绿', async () => {
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    (vault.adapter as any).read = async () => {
      throw new Error('device busy');
    };
    const sec = await checkJsonFiles(app);
    const stuck = sec!.issues.find((i) => i.title.includes('读不动'));
    expect(stuck).toBeTruthy();
    expect(stuck!.severity).toBe('warn');
    expect(stuck!.title).toContain('读不动');
    expect(stuck!.detail).toContain('重新体检');
    expect(sec!.summary).toContain('读不动');

    // 对照：文件真不存在 → 仍按 missing 处理，不出问题项
    const { app: app2 } = makeApp({});
    const sec2 = await checkJsonFiles(app2);
    expect(sec2!.issues).toEqual([]);
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

  it('PA-1：pomodoro.json 带 archived 周归档段（issue 357 正常数据）→ 不误报约定外数据段', async () => {
    const { app } = makeApp({
      [`${DIR}/pomodoro.json`]: JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false },
        history: [],
        archived: [{ week: '2026-07-06', count: 2, minutes: 50 }],
      }),
    });
    const sec = await checkFieldDrift(app);
    const pomoWarn = sec!.issues.filter((i) => i.severity === 'warn' && i.title.includes('番茄钟'));
    expect(pomoWarn).toEqual([]); // 修复前：本插件自己写的 archived 段被误报「约定外数据段/可能是外部写入」
  });

  it('PA-1：白名单外的真异常段仍 warn（契约不松，且不得把 archived 误列）；旧文件缺 archived 为可选段豁免不再出 info（呈报#50/CK1）', async () => {
    const { app } = makeApp({
      [`${DIR}/pomodoro.json`]: JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false },
        history: [],
        ghost: 1, // 真异常段
      }),
    });
    const sec = await checkFieldDrift(app);
    const warns = sec!.issues.filter((i) => i.severity === 'warn' && i.title.includes('番茄钟'));
    expect(warns).toHaveLength(1);
    expect(warns[0].title).toContain('约定外数据段');
    expect(warns[0].title).toContain('ghost');
    expect(warns[0].title).not.toContain('archived'); // archived 已入白名单，不算异常
    // 旧文件无 archived 段（issue 357 前的形状）→ 可选段豁免（CK1 拍板）：不再计缺出 info
    const missingInfo = sec!.issues.find((i) => i.severity === 'info' && i.title.includes('archived'));
    expect(missingInfo).toBeUndefined();
  });

  it('PA-1：SEGMENT_FIELDS 番茄钟段契约锁（version/state/history/archived）', () => {
    expect(SEGMENT_FIELDS['pomodoro.json']).toEqual(['version', 'state', 'history', 'archived']);
  });

  it('全绿样本：全字段条目 + 段级齐全（域写侧形状派生，TA-1 防手写盲区）→ 零问题', async () => {
    const { app } = makeApp({
      [`${DIR}/memo.json`]: JSON.stringify([fullMemoItem()]),
      [`${DIR}/favorites.json`]: JSON.stringify([fullFavItem()]),
      // 段级样本直接从域写侧单源派生（emptySidecar 7 段 / emptyData 10 键）——
      // 不再按白名单手写（func P2-1/P2-2 正是从手写盲区漏进来的）
      [`${DIR}/clipbook.json`]: JSON.stringify(emptySidecar()),
      [`${DIR}/news.json`]: JSON.stringify(emptyData()),
      [`${DIR}/belongings.json`]: JSON.stringify({ version: '1.0', last_updated: '2026-01-01T00:00:00.000Z', items: {} }),
      // v3 形状（order.ts 落盘键集；白名单对齐见 tests/home/home-json-drift.test.ts——
      // 旧 v1 pinned 段自 home 深审跨域一行起按约定外段报告，属预期行为）
      [`${DIR}/home.json`]: JSON.stringify({ version: 3, desk: [], mob: [], hiddenDesk: [], hiddenMob: [] }),
    });
    const sec = await checkFieldDrift(app);
    expect(sec!.issues).toEqual([]);
    expect(sec!.summary).not.toContain('漂移');
  });

  it('func P2-1 翻版：clipbook.json 7 段齐全（emptySidecar 派生）→ 零 warn；真异常段仍 warn', async () => {
    const { app } = makeApp({
      [`${DIR}/clipbook.json`]: JSON.stringify(emptySidecar()),
    });
    const sec = await checkFieldDrift(app);
    expect(sec!.issues.filter((i) => i.severity === 'warn' && i.title.includes('剪藏'))).toEqual([]);

    const { app: app2 } = makeApp({
      [`${DIR}/clipbook.json`]: JSON.stringify({ ...emptySidecar(), ghost: 1 }),
    });
    const sec2 = await checkFieldDrift(app2);
    const warn = sec2!.issues.find((i) => i.severity === 'warn' && i.title.includes('约定外数据段'));
    expect(warn).toBeTruthy();
    expect(warn!.title).toContain('ghost');
  });

  it('func P2-2 翻版：news.json 10 键齐全（emptyData 派生，含抓取元数据）→ 零 warn', async () => {
    const { app } = makeApp({
      [`${DIR}/news.json`]: JSON.stringify(emptyData()),
    });
    const sec = await checkFieldDrift(app);
    expect(sec!.issues.filter((i) => i.severity === 'warn' && i.title.includes('剪藏本'))).toEqual([]);
  });

  it('func P2-4 翻版：belongings.json 3 键落盘形状（ADR-0102 派生段不落盘）→ 零 info「缺少数据段」', async () => {
    const { app } = makeApp({
      [`${DIR}/belongings.json`]: JSON.stringify({ version: '1.0', last_updated: '2026-01-01T00:00:00.000Z', items: {} }),
    });
    const sec = await checkFieldDrift(app);
    expect(sec!.issues.filter((i) => i.title.includes('归物本'))).toEqual([]);
  });

  it('func P3-2：favorites.json 根形态被写成对象（非数组）→ warn「读取链会失败」，不再静默漏检', async () => {
    const { app } = makeApp({
      [`${DIR}/favorites.json`]: JSON.stringify({ oops: true }),
    });
    const sec = await checkFieldDrift(app);
    const warn = sec!.issues.find((i) => i.severity === 'warn' && i.title.includes('不是条目数组形态'));
    expect(warn).toBeTruthy();
    expect(warn!.title).toContain('收藏本');
  });

  it('cons P3-4：favorites 非对象条目文案域中性（不再硬编码「两条读取链/备忘录」）', async () => {
    const { app } = makeApp({
      [`${DIR}/favorites.json`]: JSON.stringify(['oops', 42]),
    });
    const sec = await checkFieldDrift(app);
    const err = sec!.issues.find((i) => i.severity === 'error' && i.title.includes('非对象条目'));
    expect(err).toBeTruthy();
    expect(err!.title).toContain('收藏本');
    expect(err!.title).not.toContain('两条');
    expect(err!.title).not.toContain('备忘录');
    expect(err!.detail).toContain('收藏本的读取链');
    expect(err!.detail).not.toContain('备忘录的读取链');
  });

  it('漂移字段常量与域 normalize 契约一致（14/15/3）', () => {
    expect(MEMO_ITEM_FIELDS).toHaveLength(14);
    expect(FAVORITES_ITEM_FIELDS).toHaveLength(15);
    expect(POMODORO_HISTORY_FIELDS).toEqual(['ts', 'duration', 'task']);
  });

  it('driftIssuesOf：非对象条目红色问题（检查函数层面）', () => {
    const { summary, issues } = driftIssuesOf([
      {
        plan: { file: `${DIR}/memo.json`, label: '备忘录', kind: 'item' },
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

  it('剪藏本：savedArchive 残留指向不存在笔记 → 可修复项；url 命中剪藏（单源契约 url+created）则不报', async () => {
    const sidecar = JSON.stringify({ articleOverrides: {}, savedArchive: [{ url: 'https://x', title: '甲', savedAt: '1' }], order: [] });
    // 收编 clipbook 单源后扫描面/契约同 loader：剪藏笔记需 url + created（缺一拒收）
    const { app } = makeApp(
      {
        [`${DIR}/clipbook.json`]: sidecar,
        '归档/网页剪藏/n.md': '# n',
      },
      { '归档/网页剪藏/n.md': { url: 'https://y', created: '2026-01-01' } }
    );
    const sec = await checkOrphans(app);
    const hit = sec!.issues.find((i) => i.fixGroup === 'clipbook');
    expect(hit).toBeTruthy();
    expect(hit!.fixKey).toBe('https://x');
    expect(hit!.title).toContain('剪藏残留《甲》');

    const { app: app2 } = makeApp(
      { [`${DIR}/clipbook.json`]: sidecar, '归档/网页剪藏/n.md': '# n' },
      { '归档/网页剪藏/n.md': { url: 'https://x', created: '2026-01-01' } }
    );
    const sec2 = await checkOrphans(app2);
    expect(sec2!.issues.find((i) => i.fixGroup === 'clipbook')).toBeUndefined();
  });

  it('cons P3-1：非字符串 url（Obsidian 属性面板数字形态）按单源语义 String 化命中，不再误报残留', async () => {
    // 单源 parseClipFile 对 fm.url 任意真值 String 化——url: 12345 的剪藏是「已保存」；
    // 旧本地实现只认字符串 url，会把残留误报孤儿并进一键修复清单（清掉真数据）
    const sidecar = JSON.stringify({ articleOverrides: {}, savedArchive: [{ url: '12345', title: '数字链', savedAt: '1' }], order: [] });
    const { app } = makeApp(
      { [`${DIR}/clipbook.json`]: sidecar, '归档/网页剪藏/n.md': '# n' },
      { '归档/网页剪藏/n.md': { url: 12345, created: '2026-01-01' } }
    );
    const sec = await checkOrphans(app);
    expect(sec!.issues.find((i) => i.fixGroup === 'clipbook')).toBeUndefined();
  });

  it('cons P3-2：cinemaFolderPath 空白串回落默认目录（ADR-0115 唯一真理），海报缺失照报不静默漏检', async () => {
    const fm = { '我的/影视/《T》.md': { tags: ['电影'], 海报: 'CONFIG/BOOK/p.png' } };
    const { app } = makeApp({ '我的/影视/《T》.md': '# T' }, fm, { cinemaFolderPath: '   ' });
    const sec = await checkOrphans(app);
    expect(sec!.issues.find((i) => i.title.includes('影视《T》'))).toBeTruthy();
  });

  it('func P3-4：gameshelf 封面/截图本地路径缺失报告（远端地址与文件在则不报；只报告无 fixGroup）', async () => {
    const fm = {
      '我的/游戏/G.md': { 封面: 'CONFIG/BOOK/g.png', 截图: ['CONFIG/BOOK/s1.png', ''], 封面源: 'https://cdn/x.png' },
    };
    const { app } = makeApp({ '我的/游戏/G.md': '# G' }, fm);
    const sec = await checkOrphans(app);
    const hit = sec!.issues.find((i) => i.title.includes('游戏《G》'));
    expect(hit).toBeTruthy();
    expect(hit!.detail).toContain('CONFIG/BOOK/g.png');
    expect(hit!.detail).toContain('CONFIG/BOOK/s1.png');
    expect(hit!.fixGroup).toBeUndefined(); // 用户笔记 frontmatter，只报告不可修

    // 文件齐 + 远端封面 → 不报
    const { app: app2 } = makeApp(
      { '我的/游戏/G.md': '# G', 'CONFIG/BOOK/g.png': 'img', 'CONFIG/BOOK/s1.png': 'img' },
      fm
    );
    const sec2 = await checkOrphans(app2);
    expect(sec2!.issues.find((i) => i.title.includes('游戏《G》'))).toBeUndefined();
  });

  it('eff P2-1/G-E1：大库孤儿段 tick label 带条目计数推进（修复前恒为同一常量）', async () => {
    const saved = Array.from({ length: 5 }, (_, i) => ({ url: `https://g${i}`, title: `甲${i}`, savedAt: '1' }));
    const { app } = makeApp({
      [`${DIR}/clipbook.json`]: JSON.stringify({ articleOverrides: {}, savedArchive: saved, order: [] }),
    });
    const labels: string[] = [];
    await checkOrphans(app, { tick: (label) => void labels.push(label) });
    const savedTicks = labels.filter((l) => l.startsWith('剪藏残留'));
    expect(savedTicks.length).toBeGreaterThanOrEqual(2);
    expect(new Set(savedTicks).size).toBeGreaterThanOrEqual(2); // 段内 label 随条目推进出现 ≥2 个不同值
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
  it('全绿样本：双链条数/完成数一致', async () => {
    const items = [fullMemoItem(), fullMemoItem({ id: 'item-2', completed: '2026-01-02 00:00:00' })];
    const { app } = makeApp({ [`${DIR}/memo.json`]: JSON.stringify(items) });
    const sec = await checkSameSourceConsistency(app);
    expect(sec!.issues).toEqual([]);
    expect(sec!.summary).toContain('双链口径一致');
    expect(sec!.summary).toContain('完成 1');
  });

  it('双链不一致样本：计数分叉报红', () => {
    const { issues } = consistencyIssuesOf({
      total: 3, nonObject: 0, missingId: 0, duplicateId: 0, missingTitle: 0, divergedKeys: {},
      storeView: { total: 3, done: 2 },
      rawView: { total: 2, done: 1 },
    });
    const err = issues.find((i) => i.severity === 'error');
    expect(err).toBeTruthy();
    expect(err!.title).toContain('双链计数不一致');
  });

  it('P2-5 方案 b：字段级归一分叉报红（normalizeItem 语义漂移检测，超出现有数据可造的分叉）', () => {
    // 快照 vs 活函数逐键 Object.is：人为制造归一差异验证判定与呈现
    const a = { id: 'x', priority: 'high' };
    const b = { id: 'x', priority: 'minor', url: 'https://y' };
    expect(divergedKeysOf(a, b)).toEqual(['priority', 'url']);
    expect(divergedKeysOf({ a: null }, { a: undefined })).toEqual(['a']); // Object.is 严格区分 null/undefined
    expect(divergedKeysOf(a, a)).toEqual([]);

    const { issues } = consistencyIssuesOf({
      total: 2, nonObject: 0, missingId: 0, duplicateId: 0, missingTitle: 0,
      divergedKeys: { priority: 2, url: 1 },
      storeView: { total: 2, done: 0 },
      rawView: { total: 2, done: 0 },
    });
    const err = issues.find((i) => i.severity === 'error' && i.title.includes('双链归一分叉'));
    expect(err).toBeTruthy();
    expect(err!.title).toContain('priority');
    expect(err!.title).toContain('url');
  });

  it('P2-5：正常数据（快照与 normalizeItem 等价）零分叉', () => {
    const items = [fullMemoItem(), fullMemoItem({ id: 'i2', priority: '', completed: '2026-01-02' })];
    const stats = analyzeMemoConsistency(items);
    expect(stats.divergedKeys).toEqual({});
    expect(Object.keys(stats.divergedKeys)).toHaveLength(0);
  });

  it('非对象条目报红（两条读取链都会中断）', async () => {
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
    const { outcomes, failures } = await fixOrphanIssues(app, issues);
    expect(failures).toEqual([]);
    const [outcome] = outcomes;
    expect(outcome.fixed).toBe(1);
    const after = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    expect(after[0].linkedNote).toBeNull();
    expect(after[1].linkedNote).toBe('我的/keep.md');
    // 撤销链
    await outcome.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    expect(restored[0].linkedNote).toBe('我的/gone.md');
  });

  it('func P3-8：撤销不顶掉用户新编辑——撤销窗口内已设新关联则跳过恢复', async () => {
    const raw = JSON.stringify([fullFavItem({ id: 'a', linkedNote: '我的/gone.md' })]);
    const { app, vault } = makeApp({ [`${DIR}/favorites.json`]: raw });
    const issues = [{ severity: 'warn' as const, title: 't', fixGroup: 'favorites', fixKey: 'a' }];
    const { outcomes } = await fixOrphanIssues(app, issues);
    const [outcome] = outcomes;
    expect(JSON.parse(vault.files.get(`${DIR}/favorites.json`)!)[0].linkedNote).toBeNull();
    // 用户在撤销窗口内给同一条目设置了新关联
    const cur = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    cur[0].linkedNote = '我的/new-note.md';
    vault.files.set(`${DIR}/favorites.json`, JSON.stringify(cur));
    await outcome.undo();
    const after = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    expect(after[0].linkedNote).toBe('我的/new-note.md'); // 新关联保留，旧失效值不复活
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
    const { outcomes } = await fixOrphanIssues(app, issues);
    const [outcome] = outcomes;
    expect(outcome.fixed).toBe(2);
    const mid = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(mid.savedArchive.map((s: any) => s.url)).toEqual(['https://stay']);
    await outcome.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(restored.savedArchive.map((s: any) => s.url)).toEqual(['https://gone', 'https://stay', 'https://gone2']);
  });

  it('无可修复组时不写盘、返回空', async () => {
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    const { outcomes, failures } = await fixOrphanIssues(app, [{ severity: 'warn', title: '海报缺失' }]);
    expect(outcomes).toEqual([]);
    expect(failures).toEqual([]);
    expect(vault.modifiedPaths).toEqual([]);
  });

  it('ARCH-1：文件在扫描后、修复前被删 → 零命中修复不凭空建 stub 文件', async () => {
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook', fixKey: 'https://gone' },
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook-marks', fixKey: JSON.stringify(['u', 'f', 'p.md']) },
    ];
    const { outcomes } = await fixOrphanIssues(app, issues);
    expect(outcomes.every((o) => o.fixed === 0)).toBe(true);
    expect(vault.files.has(`${DIR}/clipbook.json`)).toBe(false); // 不落盘 defaultValue 残形 stub
    expect(vault.modifiedPaths).toEqual([]);
  });

  it('eff P3-7：剪藏三组（残留/标注/待回写）合批一次读写——clipbook.json 恰写 1 次', async () => {
    const raw = JSON.stringify({
      articleOverrides: {},
      savedArchive: [{ url: 'https://gone', title: '甲', savedAt: '1' }],
      order: [],
      marks: { 'url:https://x': [{ find: '选', notePath: '文献盒/gone.md', kind: 'term' }] },
      savedImages: {},
      pendingSource: { 'url:https://x': ['文献盒/gone.md'] },
      readLog: [],
    });
    const { app, vault } = makeApp({ [`${DIR}/clipbook.json`]: raw });
    const before = vault.modifiedPaths.filter((p) => p.endsWith('clipbook.json')).length;
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook', fixKey: 'https://gone' },
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook-marks', fixKey: JSON.stringify(['url:https://x', '选', '文献盒/gone.md']) },
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook-source', fixKey: JSON.stringify(['url:https://x', '文献盒/gone.md']) },
    ];
    const { outcomes } = await fixOrphanIssues(app, issues);
    expect(outcomes.map((o) => o.fixed)).toEqual([1, 1, 1]);
    const writes = vault.modifiedPaths.filter((p) => p.endsWith('clipbook.json')).length - before;
    expect(writes).toBe(1); // 旧实现三组各自读改写 = 3 次
    // 三组 undo 逐一仍还原
    for (const o of outcomes) await o.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(restored.savedArchive.map((s: any) => s.url)).toEqual(['https://gone']);
    expect(restored.marks['url:https://x']).toHaveLength(1);
    expect(restored.pendingSource['url:https://x']).toEqual(['文献盒/gone.md']);
  });

  it('ui P3-2：一组写盘抛错不丢前序已落盘组的撤销链（failures 单独上报）', async () => {
    const raw = JSON.stringify([fullFavItem({ id: 'a', linkedNote: '我的/gone.md' })]);
    const { app, vault } = makeApp({
      [`${DIR}/favorites.json`]: raw,
      [`${DIR}/knowledge.json`]: JSON.stringify([{ id: 'kt', notePath: '文献盒/gone.md' }]),
    });
    // knowledge.json 读取抛错（模拟磁盘故障）：knowledge 组失败，favorites 组已落盘
    const origRead = vault.read.bind(vault);
    (vault as any).read = (f: any) => {
      if (String(f.path).endsWith('knowledge.json')) throw new Error('EIO');
      return origRead(f);
    };
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'favorites', fixKey: 'a' },
      { severity: 'warn' as const, title: 't', fixGroup: 'knowledge', fixKey: 'kt|note' },
    ];
    const { outcomes, failures } = await fixOrphanIssues(app, issues);
    expect(failures).toEqual(['知识盒任务引用']);
    const favOutcome = outcomes.find((o) => o.group === '收藏关联');
    expect(favOutcome).toBeTruthy();
    expect(favOutcome!.fixed).toBe(1); // 前序组照常返回（撤销链不随异常丢失）
    expect(JSON.parse(vault.files.get(`${DIR}/favorites.json`)!)[0].linkedNote).toBeNull();
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

  it('补维-1：CHECK_LABELS 与 CHECKS 注册表同源（id/label/runner 单源，运行态步骤不再手抄）', async () => {
    expect(CHECK_LABELS).toEqual(['数据文件可解析', '字段漂移', '孤儿条目', '同源一致性']);
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    const report = await runCheckup(app);
    // section 顺序/id 与注册表对齐（检查四 name 带「（备忘录）」域内后缀，label 即其前缀）
    expect(report!.sections.map((s) => s.id)).toEqual(['json', 'drift', 'orphan', 'consistency']);
    report!.sections.forEach((s, i) => expect(s.name.startsWith(CHECK_LABELS[i])).toBe(true));
  });

  it('eff P2-1：onProgress 携带子任务进度（subDone/subTotal），检查项内可插值', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]', [`${DIR}/favorites.json`]: '[]' });
    const subs: Array<{ index: number; subDone?: number; subTotal?: number }> = [];
    await runCheckup(app, {
      onProgress: (p) => subs.push({ index: p.index, subDone: p.subDone, subTotal: p.subTotal }),
    });
    const jsonSubs = subs.filter((s) => s.index === 0 && s.subTotal);
    expect(jsonSubs.length).toBeGreaterThanOrEqual(2);
    const last = jsonSubs[jsonSubs.length - 1]!;
    expect(last.subDone).toBe(last.subTotal);
  });

  it('eff P3-6：缓存数据指纹——数据未变 clean；扫描文件消失后 changed', async () => {
    const { cacheFreshness } = await import('../../src/checkup/run');
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    await runCheckup(app);
    expect(cacheFreshness(app)).toBe('clean'); // mtime 未变（MockVault 恒定 stat）
    // 任一扫描文件消失 → 指纹键数变化 → changed
    vault.files.delete(`${DIR}/memo.json`);
    expect(cacheFreshness(app)).toBe('changed');
  });
});

describe('检查三扩展（issue 339）：知识盒与剪藏标注孤儿', () => {
  it('知识盒：任务 notePath/videoPath 指向缺失分别报告（可修复）；文件在则不报', async () => {
    const task = {
      id: 'knowledge-task-1', url: 'https://b23.tv/x', status: 'success',
      title: '视频甲', notePath: '文献盒/甲.md', videoPath: '附件/视频甲.mp4',
    };
    const { app } = makeApp({ [`${DIR}/knowledge.json`]: JSON.stringify([task]) });
    const sec = await checkOrphans(app);
    const note = sec!.issues.find((i) => i.fixGroup === 'knowledge' && i.fixKey === 'knowledge-task-1|note');
    const video = sec!.issues.find((i) => i.fixGroup === 'knowledge' && i.fixKey === 'knowledge-task-1|video');
    expect(note).toBeTruthy();
    expect(note!.title).toContain('知识盒任务「视频甲」的文献笔记不存在');
    expect(note!.detail).toContain('文献盒/甲.md');
    expect(video).toBeTruthy();
    expect(video!.detail).toContain('附件/视频甲.mp4');

    // 引用齐全 → 不报
    const { app: app2 } = makeApp({
      [`${DIR}/knowledge.json`]: JSON.stringify([task]),
      '文献盒/甲.md': '# 甲',
      '附件/视频甲.mp4': 'bin',
    });
    const sec2 = await checkOrphans(app2);
    expect(sec2!.issues.filter((i) => i.fixGroup === 'knowledge')).toEqual([]);
  });

  it('剪藏 marks / pendingSource：notePath 指向缺失报告（fixKey 编码条目与笔记，任意字符安全）', async () => {
    const sidecar = JSON.stringify({
      articleOverrides: {}, savedArchive: [], order: [],
      marks: { 'url:https://x': [{ find: '选|文', notePath: '文献盒/ gone.md', kind: 'term' }] },
      savedImages: {},
      pendingSource: { 'url:https://x': ['文献盒/gone.md'] },
    });
    const { app } = makeApp({ [`${DIR}/clipbook.json`]: sidecar });
    const sec = await checkOrphans(app);
    const mark = sec!.issues.find((i) => i.fixGroup === 'clipbook-marks');
    expect(mark).toBeTruthy();
    expect(mark!.title).toContain('剪藏标注指向的笔记不存在');
    expect(JSON.parse(mark!.fixKey!)).toEqual(['url:https://x', '选|文', '文献盒/ gone.md']);
    const src = sec!.issues.find((i) => i.fixGroup === 'clipbook-source');
    expect(src).toBeTruthy();
    expect(JSON.parse(src!.fixKey!)).toEqual(['url:https://x', '文献盒/gone.md']);

    // 笔记存在 → 不报
    const { app: app2 } = makeApp({
      [`${DIR}/clipbook.json`]: sidecar,
      '文献盒/ gone.md': '# a',
      '文献盒/gone.md': '# b',
    });
    const sec2 = await checkOrphans(app2);
    expect(sec2!.issues.filter((i) => i.fixGroup === 'clipbook-marks' || i.fixGroup === 'clipbook-source')).toEqual([]);
  });
});

describe('一键修复扩展（issue 339）', () => {
  it('knowledge：清空失效 notePath/videoPath（任务本体保留），undo 原样恢复', async () => {
    const raw = JSON.stringify([
      { id: 'kt-1', url: 'u', status: 'success', notePath: '文献盒/gone.md', videoPath: '附件/gone.mp4' },
      { id: 'kt-2', url: 'u', status: 'success', notePath: '文献盒/keep.md', videoPath: null },
    ]);
    const { app, vault } = makeApp({
      [`${DIR}/knowledge.json`]: raw,
      '文献盒/keep.md': '# k',
    });
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'knowledge', fixKey: 'kt-1|note' },
      { severity: 'warn' as const, title: 't', fixGroup: 'knowledge', fixKey: 'kt-1|video' },
    ];
    const { outcomes: fixOutcomes } = await fixOrphanIssues(app, issues);
    const [outcome] = fixOutcomes;
    expect(outcome.fixed).toBe(2);
    const mid = JSON.parse(vault.files.get(`${DIR}/knowledge.json`)!);
    expect(mid[0].notePath).toBeNull();
    expect(mid[0].videoPath).toBeNull();
    expect(mid[1].notePath).toBe('文献盒/keep.md'); // 未列入修复的任务不动
    await outcome.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/knowledge.json`)!);
    expect(restored[0].notePath).toBe('文献盒/gone.md');
    expect(restored[0].videoPath).toBe('附件/gone.mp4');
  });

  it('clipbook marks：移除失效标注（列表清空连键删），undo 按原索引插回', async () => {
    const raw = JSON.stringify({
      articleOverrides: {}, savedArchive: [], order: [],
      marks: {
        'url:https://x': [
          { find: '甲', notePath: '文献盒/gone.md', kind: 'term' },
          { find: '乙', notePath: '文献盒/keep.md', kind: 'passage' },
        ],
        'url:https://y': [{ find: '丙', notePath: '文献盒/gone2.md', kind: 'term' }],
      },
      savedImages: {},
      pendingSource: {},
    });
    const { app, vault } = makeApp({
      [`${DIR}/clipbook.json`]: raw,
      '文献盒/keep.md': '# k',
    });
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook-marks', fixKey: JSON.stringify(['url:https://x', '甲', '文献盒/gone.md']) },
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook-marks', fixKey: JSON.stringify(['url:https://y', '丙', '文献盒/gone2.md']) },
    ];
    const { outcomes: fixOutcomes } = await fixOrphanIssues(app, issues);
    const [outcome] = fixOutcomes;
    expect(outcome.fixed).toBe(2);
    const mid = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(mid.marks['url:https://x'].map((m: any) => m.find)).toEqual(['乙']); // 命中者保留
    expect(mid.marks['url:https://y']).toBeUndefined(); // 清空连键删
    await outcome.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(restored.marks['url:https://x'].map((m: any) => m.find)).toEqual(['甲', '乙']);
    expect(restored.marks['url:https://y'].map((m: any) => m.find)).toEqual(['丙']);
  });

  it('clipbook pendingSource：移除失效待回写路径，undo 插回', async () => {
    const raw = JSON.stringify({
      articleOverrides: {}, savedArchive: [], order: [], marks: {}, savedImages: {},
      pendingSource: { 'url:https://x': ['文献盒/gone.md', '文献盒/keep.md'] },
    });
    const { app, vault } = makeApp({
      [`${DIR}/clipbook.json`]: raw,
      '文献盒/keep.md': '# k',
    });
    const issues = [
      { severity: 'warn' as const, title: 't', fixGroup: 'clipbook-source', fixKey: JSON.stringify(['url:https://x', '文献盒/gone.md']) },
    ];
    const { outcomes: fixOutcomes } = await fixOrphanIssues(app, issues);
    const [outcome] = fixOutcomes;
    expect(outcome.fixed).toBe(1);
    const mid = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(mid.pendingSource['url:https://x']).toEqual(['文献盒/keep.md']);
    await outcome.undo();
    const restored = JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!);
    expect(restored.pendingSource['url:https://x']).toEqual(['文献盒/gone.md', '文献盒/keep.md']);
  });
});

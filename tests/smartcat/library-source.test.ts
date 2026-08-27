/**
 * 书库观察（ticket 081 v2，ADR-0034）：weave-data.json 数据文件监听。
 * 1) libraryWeaveDiff 纯函数：书架增删三态（加入/开始读/移出）、读完、时长带进度、划线/想法带内容结构化 diff；
 *    首快照（snapshotDomains）只记状态不产出；
 * 2) normalizeWeavePercent / buildLibraryNoteText 纯函数；
 * 3) index onVaultActivity：书库 md 通道短路（kind==='reading' 不产观察）；
 * 4) index 层 5 分钟防抖合并：划线/想法窗口内合并、超时结算一条（注入短时长，对齐 diary/news 测试模式）；
 * 5) ticket 084c：A3 noteSource 关三入口静默（consumeLibraryDiff/settleLibraryPending/onDomainActivity）；
 *    A4 hl/ex 按内容指纹记账（删除划线不重发旧内容、同内容只产一次）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { ensureSmartCat, unloadSmartCat, __getSmartcatInternals, __setLibraryDebounceMsForTests, __getLibraryPendingForTests } from '../../src/smartcat/index';
import { snapshotDomains } from '../../src/smartcat/domain-source';
import { libraryWeaveDiff, libraryWeaveExtract, normalizeWeavePercent, buildLibraryNoteText } from '../../src/smartcat/library-source';

/** 构造 weave-data 形状（按实测样例：books 对象字典） */
function weave(books: Record<string, any>): any {
  return { schemaVersion: 1, updatedAt: 0, books };
}
function book(over: any = {}): any {
  return {
    id: 'b1',
    file: { vaultPath: '书库/测试书.epub' },
    meta: { title: '测试书' },
    reading: { position: { percent: 0 }, stats: {}, sessions: [] },
    notes: { highlights: [], excerpts: [] },
    ...over,
  };
}
/** 模拟一次完整保存后的 prev 基线（had=1、done=0、hl/ex 空已见指纹集合、sess 计数，A4 指纹记账） */
function baseline(extra: Record<string, string> = {}): Map<string, string> {
  return new Map<string, string>(
    Object.entries({
      'lib:b1:had': '1',
      'lib:b1:done': '0',
      'lib:b1:pct': '0',
      'lib:b1:hl': '', // 空串 = 空已见指纹集合（ticket 084c A4：划线/想法按内容指纹记账，非计数）
      'lib:b1:ex': '',
      'lib:b1:sess': '0',
      'lib:b1:title': '测试书',
      ...extra,
    }),
  );
}

describe('libraryWeaveDiff（书架增删三态 + 读完 + 时长带进度 + 划线想法带内容）', () => {
  it('新书 percent==0 → added（加入书架）；已记账的旧书无变化 → null', () => {
    const prev = new Map<string, string>();
    const d = libraryWeaveDiff(weave({ b1: book() }), prev);
    expect(d).not.toBeNull();
    expect(d!.added.map((e) => e.title)).toEqual(['测试书']);
    expect(d!.started).toHaveLength(0);
    expect(prev.get('lib:b1:had')).toBe('1');
    expect(prev.get('lib:b1:hl')).toBe('');
    expect(libraryWeaveDiff(weave({ b1: book() }), prev)).toBeNull();
  });

  it('新书 percent>0 → started（开始读），added 为空（读覆盖加入不双发）', () => {
    const prev = new Map<string, string>();
    const d = libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 47.86 }, stats: {}, sessions: [] } }) }), prev);
    expect(d!.started.map((e) => e.title)).toEqual(['测试书']);
    expect(d!.added).toHaveLength(0);
  });

  it('旧条目 percent 前进 → 不产（进度百分比不观察）', () => {
    const prev = baseline();
    expect(libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 80 }, stats: {}, sessions: [] } }) }), prev)).toBeNull();
    expect(libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 99 }, stats: {}, sessions: [] } }) }), prev)).toBeNull();
  });

  it('completedTime 首次出现 → done（读完了）', () => {
    const prev = baseline();
    const d = libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 100 }, stats: { completedTime: 1787475378000 }, sessions: [] } }) }), prev);
    expect(d!.done.map((e) => e.title)).toEqual(['测试书']);
    expect(libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 100 }, stats: { completedTime: 1787475378000 }, sessions: [] } }) }), prev)).toBeNull();
  });

  it('sessions 新增 300s+600s → 时长带进度「约 15 分钟（读到 48%）」（percent 取当次保存值）', () => {
    const prev = baseline();
    const d = libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 47.86 }, stats: {}, sessions: [{ durationSeconds: 300 }, { durationSeconds: 600 }] } }) }), prev);
    expect(d!.sessions).toEqual([{ id: 'b1', title: '测试书', minutes: 15, percent: 48 }]);
    expect(libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 47.86 }, stats: {}, sessions: [{ durationSeconds: 300 }, { durationSeconds: 600 }] } }) }), prev)).toBeNull();
  });

  it('percent 1.0/1 → 归一 100（时长括注整数）', () => {
    const prev = baseline();
    const d = libraryWeaveDiff(weave({ b1: book({ reading: { position: { percent: 1 }, stats: {}, sessions: [{ durationSeconds: 30 }] } }) }), prev);
    expect(d!.sessions[0].percent).toBe(100);
    expect(d!.sessions[0].minutes).toBe(1); // 30s → ceil(0.5) → 1（防 0）
  });

  it('highlights 新增 → 取新增各条 text 内容；无文本的新增项过滤（全空则事件不发）', () => {
    const prev = baseline();
    const d = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: 'c1', commentText: '批注' }, { text: 'c2' }, { color: 'yellow' }], excerpts: [] } }) }), prev);
    expect(d!.highlightEvents).toHaveLength(1);
    expect(d!.highlightEvents[0].texts).toEqual(['c1', 'c2']); // 无文本的第 3 条被过滤
    const prev2 = baseline({ 'lib:b1:hl': '1' });
    const d2 = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ color: 'yellow' }], excerpts: [] } }) }), prev2);
    expect(d2).toBeNull(); // 全部无文本 → 不产划线事件
  });

  it('excerpts 新增 → 取新增各条想法文本（commentText 优先）', () => {
    const prev = baseline();
    const d = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [], excerpts: [{ commentText: '想法A', text: '原文' }, { text: '想法B' }] } }) }), prev);
    expect(d!.excerptEvents[0].texts).toEqual(['想法A', '想法B']);
  });

  it('多事件同保存 → 结构化 diff 各数组齐全；一次啥都没变 → null', () => {
    const prev = new Map<string, string>();
    const d = libraryWeaveDiff(weave({
      b1: book({
        reading: {
          position: { percent: 100 },
          stats: { completedTime: 123 },
          sessions: [{ durationSeconds: 300 }, { durationSeconds: 600 }],
        },
        notes: { highlights: [{ text: 'c1' }, { text: 'c2' }], excerpts: [{ commentText: 'e1' }] },
      }),
    }), prev);
    expect(d!.started).toHaveLength(1);
    expect(d!.done).toHaveLength(1);
    expect(d!.sessions[0]).toMatchObject({ minutes: 15, percent: 100 });
    expect(d!.highlightEvents[0].texts).toEqual(['c1', 'c2']);
    expect(d!.excerptEvents[0].texts).toEqual(['e1']);
    expect(libraryWeaveDiff(weave({
      b1: book({
        reading: { position: { percent: 100 }, stats: { completedTime: 123 }, sessions: [{ durationSeconds: 300 }, { durationSeconds: 600 }] },
        notes: { highlights: [{ text: 'c1' }, { text: 'c2' }], excerpts: [{ commentText: 'e1' }] },
      }),
    }), prev)).toBeNull();
  });

  it('条目从字典消失 → removed（移出书架）+ prev 清理；重新加入视为新书', () => {
    const prev = baseline();
    const d = libraryWeaveDiff(weave({}), prev);
    expect(d!.removed.map((e) => e.title)).toEqual(['测试书']);
    expect(prev.has('lib:b1:had')).toBe(false);
    expect(prev.size).toBe(0);
    // 重新加入（percent 0）→ 再次 added
    const d2 = libraryWeaveDiff(weave({ b1: book() }), prev);
    expect(d2!.added.map((e) => e.title)).toEqual(['测试书']);
  });

  it('title 缺失 → 跳过（不产、prev 不记账）；raw/books 非对象 → null', () => {
    const prev = new Map<string, string>();
    expect(libraryWeaveDiff(weave({ b1: book({ meta: { title: '' } }) }), prev)).toBeNull();
    expect(prev.size).toBe(0);
    expect(libraryWeaveDiff(null, prev)).toBeNull();
    expect(libraryWeaveDiff('x', prev)).toBeNull();
    expect(libraryWeaveDiff({}, prev)).toBeNull();
    expect(libraryWeaveDiff({ books: [] }, prev)).toBeNull();
  });

  it('libraryWeaveExtract 与 libraryWeaveDiff 同函数（命名兼容）', () => {
    expect(libraryWeaveExtract).toBe(libraryWeaveDiff);
  });
});

describe('libraryWeaveDiff（A4 内容指纹记账，ticket 084c）', () => {
  it('删除划线 → 再新增只发新内容（旧划线不重发）', () => {
    const prev = baseline();
    // 首次：两条划线入账并产事件
    const d1 = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: '旧划线' }, { text: '中划线' }], excerpts: [] } }) }), prev);
    expect(d1!.highlightEvents[0].texts).toEqual(['旧划线', '中划线']);
    // 删除「旧划线」（bz deleteEpubNote 直改 weave-data）→ 无新增（删除不产事件）
    expect(libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: '中划线' }], excerpts: [] } }) }), prev)).toBeNull();
    // 再新增「新划线」→ 只发新内容（旧「中划线」不被重当新增）
    const d3 = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: '中划线' }, { text: '新划线' }], excerpts: [] } }) }), prev);
    expect(d3!.highlightEvents).toHaveLength(1);
    expect(d3!.highlightEvents[0].texts).toEqual(['新划线']);
  });

  it('同内容划两条只产一次（text+commentText 指纹去重；跨保存同内容不重发）', () => {
    const prev = baseline();
    const d1 = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: '重复内容' }, { text: '重复内容', commentText: '' }, { text: '重复内容', commentText: '  ' }], excerpts: [] } }) }), prev);
    expect(d1!.highlightEvents[0].texts).toEqual(['重复内容']); // 三条同指纹 → 只产一次
    // 再次保存同内容（未新增）→ 不重发
    expect(libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: '重复内容' }], excerpts: [] } }) }), prev)).toBeNull();
  });

  it('想法通道同语义：删除一条再新增只发新想法；同想法只产一次', () => {
    const prev = baseline();
    const d1 = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [], excerpts: [{ commentText: '旧想法' }, { commentText: '旧想法' }] } }) }), prev);
    expect(d1!.excerptEvents[0].texts).toEqual(['旧想法']); // 同想法两条 → 只产一次
    // 删除旧想法 → 无事件
    expect(libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [], excerpts: [] } }) }), prev)).toBeNull();
    // 再新增 → 只发新想法
    const d3 = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [], excerpts: [{ commentText: '新想法' }] } }) }), prev);
    expect(d3!.excerptEvents[0].texts).toEqual(['新想法']);
  });

  it('hl/ex prev 落指纹集合串（排序 join）：删除不回收已见指纹，重加曾删除内容也不重发', () => {
    const prev = baseline();
    libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: 'c1' }, { text: 'c2' }], excerpts: [{ commentText: 'e1' }] } }) }), prev);
    expect(prev.get('lib:b1:hl')).toBe('c1\u0001\u0002c2\u0001');
    expect(prev.get('lib:b1:ex')).toBe('\u0001e1');
    // 删 c1 → 已见集合保留（不缩小），无新增事件
    expect(libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: 'c2' }], excerpts: [{ commentText: 'e1' }] } }) }), prev)).toBeNull();
    expect(prev.get('lib:b1:hl')).toBe('c1\u0001\u0002c2\u0001');
    // 重加已删除的 c1 → 曾已见 → 不重发（防旧内容重发）
    expect(libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: 'c1' }, { text: 'c2' }], excerpts: [{ commentText: 'e1' }] } }) }), prev)).toBeNull();
    // 新增 c3 → 只发 c3
    const d = libraryWeaveDiff(weave({ b1: book({ notes: { highlights: [{ text: 'c2' }, { text: 'c3' }], excerpts: [{ commentText: 'e1' }] } }) }), prev);
    expect(d!.highlightEvents).toHaveLength(1);
    expect(d!.highlightEvents[0].texts).toEqual(['c3']);
  });
});

describe('normalizeWeavePercent', () => {
  it('0-1 刻度 ×100（1.0 → 100）；0-100 刻度直接取整（47.86 → 48）；非法 → 0', () => {
    expect(normalizeWeavePercent(0)).toBe(0);
    expect(normalizeWeavePercent(0.5)).toBe(50);
    expect(normalizeWeavePercent(1)).toBe(100);
    expect(normalizeWeavePercent(1.0)).toBe(100);
    expect(normalizeWeavePercent(47.86)).toBe(48);
    expect(normalizeWeavePercent(99.6)).toBe(100);
    expect(normalizeWeavePercent(null)).toBe(0);
    expect(normalizeWeavePercent('x')).toBe(0);
  });
});

describe('buildLibraryNoteText（防抖结算文案）', () => {
  it('只有划线：1 条 → 划了条重点；多条 → 划了 N 条重点（「、」连接）', () => {
    expect(buildLibraryNoteText('X', ['c1'], [])).toBe('你在《X》划了条重点：「c1」');
    expect(buildLibraryNoteText('X', ['c1', 'c2'], [])).toBe('你在《X》划了 2 条重点：「c1」、「c2」');
  });
  it('划线+想法 → 「；」拼接', () => {
    expect(buildLibraryNoteText('X', ['c1'], ['e1'])).toBe('你在《X》划了条重点：「c1」；写了条想法：「e1」');
  });
  it('只有想法：1 条 → 写了条想法；多条 → 写了 N 条想法', () => {
    expect(buildLibraryNoteText('X', [], ['e1'])).toBe('你在《X》写了条想法：「e1」');
    expect(buildLibraryNoteText('X', [], ['e1', 'e2'])).toBe('你在《X》写了 2 条想法：「e1」、「e2」');
  });
  it('无内容 → null', () => {
    expect(buildLibraryNoteText('X', [], [])).toBeNull();
    expect(buildLibraryNoteText('X', [''], ['  '])).toBeNull();
  });
});

describe('snapshotDomains 首次快照（library）', () => {
  it('首快照只记状态不产出（基线落 prev：had/pct/hl/ex/sess/done/title），此后 diff 才产', async () => {
    const prev = new Map<string, string>();
    const w = weave({
      b1: book({
        reading: { position: { percent: 50 }, stats: { completedTime: 123 }, sessions: [{ durationSeconds: 300 }] },
        notes: { highlights: [{ text: 'c1' }], excerpts: [{ commentText: 'e1' }] },
      }),
    });
    const found = await snapshotDomains(async (path: string) => {
      if (path === 'CONFIG/STORAGE/weave-data.json') return w;
      throw new Error('no file');
    }, prev);
    expect(found).toContain('library');
    expect(prev.get('lib:b1:had')).toBe('1');
    expect(prev.get('lib:b1:done')).toBe('1');
    expect(prev.get('lib:b1:pct')).toBe('50');
    expect(prev.get('lib:b1:hl')).toBe('c1\u0001'); // 指纹集合串：text+commentText trim 后 \u0001 拼接（A4）
    expect(prev.get('lib:b1:ex')).toBe('\u0001e1');
    expect(prev.get('lib:b1:sess')).toBe('1');
    expect(prev.get('lib:b1:title')).toBe('测试书');
    // 同一份数据再 diff → 无变化
    expect(libraryWeaveDiff(w, prev)).toBeNull();
  });
});

// ===== 短路 + 防抖集成（照 news-action.test.ts 范式）=====
let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  const wsListeners: Record<string, Function[]> = {};
  app.workspace.on = (ev: string, cb: any) => { (wsListeners[ev] ||= []).push(cb); return { ev, cb }; };
  app.workspace.offref = (ref: any) => {
    const arr = wsListeners[ref?.ev] || [];
    const idx = arr.indexOf(ref?.cb);
    if (idx >= 0) arr.splice(idx, 1);
  };
  return { app, vault };
}

const settle = () => new Promise((r) => setTimeout(r, 100));
/** 轮询等待条件成立（即时观察异步入流不稳定，用轮询替代固定等待；对齐 diary/news 测试稳健性先例）。
 *  默认 2000ms 在全量并发下会被拖超（waitFor timeout），放宽到 10000ms。 */
const waitFor = (pred: () => boolean, timeout = 10000, step = 30) =>
  new Promise<void>((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (pred()) return resolve();
      if (Date.now() - t0 > timeout) return reject(new Error('waitFor timeout'));
      setTimeout(tick, step);
    };
    tick();
  });
const readStream = (): any[] => __getSmartcatInternals().data.memory.memoryStream;
const WEAVE_PATH = 'CONFIG/STORAGE/weave-data.json';

/** weave 文件先写入 vault → ensureSmartCat（首快照基线）→ 返回 */
async function bootWithWeave(books: Record<string, any>) {
  const { app, vault } = makeApp();
  vault.files.set(WEAVE_PATH, JSON.stringify(weave(books)));
  await ensureSmartCat(app);
  await settle(); // 等首快照完成（domainObserved 含 library + prev 基线落账）
  return { app, vault };
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
  __setLibraryDebounceMsForTests(5 * 60 * 1000); // 复位默认窗口
});

describe('书库 md 通道短路（ticket 081：onVaultActivity reading 短路）', () => {
  it('带 book 标签的 书库/*.md modify → 不产 reading 观察（划线/想法改由 weave-data 指纹记账）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    await settle();
    const bookPath = '书库/1984.md';
    vault.files.set(bookPath, '---\ntags: [book]\n---\n<span class="__comment cm-highlight">划线内容</span>\n==dialogue==\n想法内容');
    const before = readStream().length;
    vault.emit('modify', vault.file(bookPath));
    await settle();
    const stream = readStream();
    expect(stream.length).toBe(before);
    expect(stream.some((m) => m.description.includes('你读了《'))).toBe(false);
  });
});

describe('weave-data modify 链路（domain:library；书架/时长即时 + 划线想法防抖）', () => {
  it('首快照不产出；已有书无变化 modify → 也不产', async () => {
    const { vault } = await bootWithWeave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [{ durationSeconds: 300 }] } }) });
    await settle();
    const before = readStream().length;
    vault.emit('modify', vault.file(WEAVE_PATH));
    await settle();
    expect(readStream().length).toBe(before);
  });

  it('书架新书(percent>0) + 时长 → 即时入流；划线入 pending，窗口超时结算一条带内容', async () => {
    __setLibraryDebounceMsForTests(200);
    const { vault } = await bootWithWeave({});
    const before = readStream().length;
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b2: book({
        id: 'b2',
        meta: { title: '血与蜜之地' },
        reading: { position: { percent: 47.86 }, stats: {}, sessions: [{ durationSeconds: 300 }, { durationSeconds: 600 }] },
        notes: { highlights: [{ text: '巴尔干是一片破碎之地' }, { text: '边界是虚构的' }], excerpts: [] },
      }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    // 即时事件：开始读 + 时长带进度（划线仍走防抖 pending）
    await waitFor(() => readStream().some((m) => m.description === '你开始读《血与蜜之地》'));
    await waitFor(() => readStream().some((m) => m.description === '你读了《血与蜜之地》约 15 分钟（读到 48%）'));
    await waitFor(() => __getLibraryPendingForTests().size === 1);
    expect(readStream().some((m) => m.description.includes('划了'))).toBe(false);
    // 窗口超时（200ms）→ 结算一条「划了 2 条重点」
    await waitFor(() => {
      const tail = readStream();
      return tail.length > before && tail[tail.length - 1].description === '你在《血与蜜之地》划了 2 条重点：「巴尔干是一片破碎之地」、「边界是虚构的」';
    });
    expect(readStream()[readStream().length - 1].source).toBe('domain:library');
    expect(__getLibraryPendingForTests().size).toBe(0);
  });

  it('窗口内再变化 → 追加内容并重置计时；超时合并为一条（划线+想法）', async () => {
    __setLibraryDebounceMsForTests(500);
    const { vault } = await bootWithWeave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [] } }) });
    const before = readStream().length;
    // 第一次 save：划线 1 条
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 51 }, stats: {}, sessions: [] }, notes: { highlights: [{ text: 'c1' }], excerpts: [] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await waitFor(() => __getLibraryPendingForTests().size === 1);
    expect(readStream().length).toBe(before); // 划线走防抖，不即时
    // 窗口内（500ms）第二次 save：划线 +1、想法 +1 → 追加内容并重置窗口
    await new Promise((r) => setTimeout(r, 150));
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 52 }, stats: {}, sessions: [] }, notes: { highlights: [{ text: 'c1' }, { text: 'c2' }], excerpts: [{ commentText: 'e1' }] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await waitFor(() => {
      const p = __getLibraryPendingForTests().get('b1');
      return !!p && p.highlights.length === 2 && p.excerpts.length === 1;
    });
    // 窗口最终超时（重置后 500ms）→ 一条合并观察（划线 2 条 + 想法 1 条）
    await waitFor(() => {
      const tail = readStream();
      return tail.length > before && tail[tail.length - 1].description === '你在《测试书》划了 2 条重点：「c1」、「c2」；写了条想法：「e1」';
    }, 3000);
    expect(readStream()[readStream().length - 1].source).toBe('domain:library');
    expect(__getLibraryPendingForTests().size).toBe(0);
  });

  it('时长事件不受防抖限制（独立即时）：书架不动只加会话 → 即时入流，划线仍 pending', async () => {
    __setLibraryDebounceMsForTests(200);
    const { vault } = await bootWithWeave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [] } }) });
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 55 }, stats: {}, sessions: [{ durationSeconds: 600 }] }, notes: { highlights: [{ text: 'c1' }], excerpts: [] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await waitFor(() => readStream().some((m) => m.description === '你读了《测试书》约 10 分钟（读到 55%）'));
    await waitFor(() => __getLibraryPendingForTests().size === 1);
  });

  it('unload → pending 清空不残留', async () => {
    __setLibraryDebounceMsForTests(60 * 1000);
    const { vault } = await bootWithWeave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [] } }) });
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 55 }, stats: {}, sessions: [] }, notes: { highlights: [{ text: 'c1' }], excerpts: [] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await settle();
    expect(__getLibraryPendingForTests().size).toBe(1);
    unloadSmartCat();
    expect(__getLibraryPendingForTests().size).toBe(0);
  });
});

describe('noteSource 关 → 书库观察整链静默（ticket 084c A3 三入口守卫）', () => {
  it('weave modify（书架新书+时长+划线）→ 即时（书架/时长）与防抖档案均不产', async () => {
    const { vault } = await bootWithWeave({});
    (__getSmartcatInternals().data as any).config.noteSource = false;
    const before = readStream().length;
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b2: book({
        id: 'b2',
        meta: { title: '静默书' },
        reading: { position: { percent: 40 }, stats: {}, sessions: [{ durationSeconds: 600 }] },
        notes: { highlights: [{ text: 'h1' }], excerpts: [] },
      }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await settle();
    expect(readStream().length).toBe(before); // 书架加入/开始读/时长/划线全不产
    expect(__getLibraryPendingForTests().size).toBe(0); // 防抖档案也不装
    expect(readStream().some((m) => m.description.includes('静默书'))).toBe(false);
  });

  it('noteSource 关（已挂 pending）→ 防抖结算不产，防抖表照常清', async () => {
    __setLibraryDebounceMsForTests(150);
    const { vault } = await bootWithWeave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [] } }) });
    // 开启状态划一条 → pending 挂上
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 51 }, stats: {}, sessions: [] }, notes: { highlights: [{ text: 'c1' }], excerpts: [] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await waitFor(() => __getLibraryPendingForTests().size === 1);
    const before = readStream().length;
    // 关掉 noteSource → 窗口到期结算：内容丢弃不入流（防晚到入流），pending 照常清
    (__getSmartcatInternals().data as any).config.noteSource = false;
    await waitFor(() => __getLibraryPendingForTests().size === 0);
    await settle();
    expect(readStream().length).toBe(before);
    expect(readStream().some((m) => m.description.includes('划了'))).toBe(false);
  });
});

describe('删除划线 → 再新增 → 防抖结算只发新内容（ticket 084c A4 全链）', () => {
  it('删「旧划线」后新增「新划线」 → 结算观察只有新内容（旧内容不重发）', async () => {
    __setLibraryDebounceMsForTests(150);
    const { vault } = await bootWithWeave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [] } }) });
    // 首次划两条 → 防抖结算发一条带两条内容
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 51 }, stats: {}, sessions: [] }, notes: { highlights: [{ text: '旧划线' }, { text: '中划线' }], excerpts: [] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await waitFor(() => {
      const tail = readStream();
      return tail.length > 0 && tail[tail.length - 1].description === '你在《测试书》划了 2 条重点：「旧划线」、「中划线」';
    });
    // 删除「旧划线」（deleteEpubNote 场景）→ 无新增不产
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 52 }, stats: {}, sessions: [] }, notes: { highlights: [{ text: '中划线' }], excerpts: [] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await settle();
    expect(readStream().map((m) => m.description).filter((d) => d.includes('划了')).length).toBe(1);
    // 再新增「新划线」→ 只结算新内容（旧「中划线」不被重当新增）
    vault.files.set(WEAVE_PATH, JSON.stringify(weave({
      b1: book({ reading: { position: { percent: 53 }, stats: {}, sessions: [] }, notes: { highlights: [{ text: '中划线' }, { text: '新划线' }], excerpts: [] } }),
    })));
    vault.emit('modify', vault.file(WEAVE_PATH));
    await waitFor(() => {
      const tail = readStream();
      return tail.length > 1 && tail[tail.length - 1].description === '你在《测试书》划了条重点：「新划线」';
    });
    const descs = readStream().map((m) => m.description).filter((d) => d.includes('划了'));
    expect(descs).toHaveLength(2); // 首条（旧+中）+ 新增（新），无第三条重发
    expect(descs[1]).toBe('你在《测试书》划了条重点：「新划线」');
  });
});

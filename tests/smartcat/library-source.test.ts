/**
 * 书库观察（ticket 081，ADR-0034）：weave-data.json 数据文件监听。
 * 1) libraryWeaveExtract 纯函数：开始读/读完了/划重点/写想法/阅读时长 diff，单次保存多事件产数组；
 * 2) snapshotDomains 首次快照：只记状态不产出；
 * 3) index onVaultActivity：书库 md 通道短路（kind==='reading' 不产观察，划线/想法改走 weave 计数）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { ensureSmartCat, unloadSmartCat, __getSmartcatInternals } from '../../src/smartcat/index';
import { DOMAIN_FILES, snapshotDomains } from '../../src/smartcat/domain-source';
import { libraryWeaveExtract } from '../../src/smartcat/library-source';

/** 构造 weave-data 形状（按实测样例：books 对象字典，读多书聚合） */
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
/** 模拟一次完整保存后的 prev 基线（除 hl/ex 外的状态均已记账） */
function baseline(extra: Record<string, string> = {}): Map<string, string> {
  return new Map<string, string>(
    Object.entries({
      'lib:b1:started': '1',
      'lib:b1:done': '0',
      'lib:b1:sess': '0',
      'lib:b1:hl': '0',
      'lib:b1:ex': '0',
      ...extra,
    }),
  );
}

describe('libraryWeaveExtract（weave-data.json 盲通道 diff）', () => {
  it('percent 0 的新书 → 不产；prev 记 started=0（后续开始读可触发）', () => {
    const prev = new Map<string, string>();
    expect(libraryWeaveExtract(weave({ b1: book() }), prev)).toBeNull();
    expect(prev.get('lib:b1:started')).toBe('0');
    expect(prev.get('lib:b1:done')).toBe('0');
    expect(prev.get('lib:b1:hl')).toBe('0');
    expect(prev.get('lib:b1:ex')).toBe('0');
    expect(prev.get('lib:b1:sess')).toBe('0');
  });

  it('percent>0 首次出现 → 你开始读《测试书》；重复保存不再产', () => {
    const prev = new Map<string, string>();
    const w = weave({ b1: book({ reading: { position: { percent: 47.86 }, stats: {}, sessions: [] } }) });
    expect(libraryWeaveExtract(w, prev)).toEqual(['你开始读《测试书》']);
    expect(libraryWeaveExtract(w, prev)).toBeNull();
  });

  it('percent 前进 → 不产（进度百分比不观察，避免高频）', () => {
    const prev = baseline();
    expect(libraryWeaveExtract(weave({ b1: book({ reading: { position: { percent: 80 }, stats: {}, sessions: [] } }) }), prev)).toBeNull();
    expect(libraryWeaveExtract(weave({ b1: book({ reading: { position: { percent: 99 }, stats: {}, sessions: [] } }) }), prev)).toBeNull();
  });

  it('completedTime 首次出现 → 你读完了《测试书》；重复保存不再产', () => {
    const prev = baseline();
    const w = weave({ b1: book({ reading: { position: { percent: 100 }, stats: { completedTime: 1787475378000 }, sessions: [] } }) });
    expect(libraryWeaveExtract(w, prev)).toEqual(['你读完了《测试书》']);
    expect(libraryWeaveExtract(w, prev)).toBeNull();
  });

  it('highlights 1→3 → 划了 2 条重点；单条增长 → 划了条重点', () => {
    const prev = baseline({ 'lib:b1:hl': '1' });
    expect(libraryWeaveExtract(weave({ b1: book({ notes: { highlights: [{}, {}, {}], excerpts: [] } }) }), prev)).toEqual(['你在《测试书》划了 2 条重点']);
    const prev2 = baseline();
    expect(libraryWeaveExtract(weave({ b1: book({ notes: { highlights: [{}], excerpts: [] } }) }), prev2)).toEqual(['你在《测试书》划了条重点']);
  });

  it('excerpts 0→1 → 写了条想法', () => {
    const prev = baseline();
    expect(libraryWeaveExtract(weave({ b1: book({ notes: { highlights: [], excerpts: [{}] } }) }), prev)).toEqual(['你在《测试书》写了条想法']);
  });

  it('sessions 新增 2 条 300s+600s → 读了约 15 分钟；无新增不再产', () => {
    const prev = baseline();
    const w = weave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [{ durationSeconds: 300 }, { durationSeconds: 600 }] } }) });
    expect(libraryWeaveExtract(w, prev)).toEqual(['你读了《测试书》约 15 分钟']);
    expect(libraryWeaveExtract(w, prev)).toBeNull();
  });

  it('时长防 0：新增条 durationSeconds 为 0 → 约 1 分钟（Math.max 下限）', () => {
    const prev = baseline();
    const w1 = weave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [{ durationSeconds: 300 }] } }) });
    expect(libraryWeaveExtract(w1, prev)).toEqual(['你读了《测试书》约 5 分钟']);
    const w2 = weave({ b1: book({ reading: { position: { percent: 50 }, stats: {}, sessions: [{ durationSeconds: 300 }, { durationSeconds: 0 }] } }) });
    expect(libraryWeaveExtract(w2, prev)).toEqual(['你读了《测试书》约 1 分钟']);
  });

  it('多事件同保存 → 数组多条（按书、按 开始读/读完/重点/想法/时长 顺序）', () => {
    const prev = new Map<string, string>();
    const w = weave({
      b1: book({
        reading: {
          position: { percent: 100 },
          stats: { completedTime: 123 },
          sessions: [{ durationSeconds: 300 }, { durationSeconds: 600 }],
        },
        notes: { highlights: [{}, {}], excerpts: [{}] },
      }),
    });
    expect(libraryWeaveExtract(w, prev)).toEqual([
      '你开始读《测试书》',
      '你读完了《测试书》',
      '你在《测试书》划了 2 条重点',
      '你在《测试书》写了条想法',
      '你读了《测试书》约 15 分钟',
    ]);
  });

  it('title 缺失 → 跳过（不产、prev 不记账）', () => {
    const prev = new Map<string, string>();
    const w = weave({
      b1: book({ meta: { title: '' } }),
      b2: book({ meta: {}, id: 'b2', reading: { position: { percent: 10 }, stats: {}, sessions: [] } }),
    });
    expect(libraryWeaveExtract(w, prev)).toBeNull();
    expect(prev.size).toBe(0);
  });

  it('raw / books 非对象 → null（不产噪音）', () => {
    const prev = new Map<string, string>();
    expect(libraryWeaveExtract(null, prev)).toBeNull();
    expect(libraryWeaveExtract('x', prev)).toBeNull();
    expect(libraryWeaveExtract({}, prev)).toBeNull();
    expect(libraryWeaveExtract({ books: null }, prev)).toBeNull();
    expect(libraryWeaveExtract({ books: [] }, prev)).toBeNull();
  });

  it('一次啥都没变 → null', () => {
    const prev = baseline({ 'lib:b1:hl': '1', 'lib:b1:ex': '1', 'lib:b1:sess': '1' });
    const w = weave({
      b1: book({
        reading: { position: { percent: 50 }, stats: {}, sessions: [{ durationSeconds: 300 }] },
        notes: { highlights: [{}], excerpts: [{}] },
      }),
    });
    expect(libraryWeaveExtract(w, prev)).toBeNull();
  });
});

describe('snapshotDomains 首次快照（library）', () => {
  it('首快照只记状态不产出；此后 diff 才产（started/done/hl/ex/sess 基线落 prev）', async () => {
    const prev = new Map<string, string>();
    const w = {
      books: {
        b1: book({
          reading: { position: { percent: 50 }, stats: { completedTime: 123 }, sessions: [{ durationSeconds: 300 }] },
          notes: { highlights: [{}], excerpts: [{}] },
        }),
      },
    };
    const found = await snapshotDomains(async (path: string) => {
      if (path === 'CONFIG/STORAGE/weave-data.json') return w;
      throw new Error('no file');
    }, prev);
    expect(found).toContain('library');
    // 首快照基线已记账（extract 返回值被丢弃 = 不产出）
    expect(prev.get('lib:b1:started')).toBe('1');
    expect(prev.get('lib:b1:done')).toBe('1');
    expect(prev.get('lib:b1:hl')).toBe('1');
    expect(prev.get('lib:b1:ex')).toBe('1');
    expect(prev.get('lib:b1:sess')).toBe('1');
    // 同一份数据再 diff → 无变化
    expect(libraryWeaveExtract(w, prev)).toBeNull();
  });
});

// ===== 短路集成（照 news-action.test.ts 范式）=====
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
const readStream = (): any[] => __getSmartcatInternals().data.memory.stream;

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

describe('书库 md 通道短路（ticket 081：onVaultActivity reading 短路）', () => {
  it('带 book 标签的 书库/*.md modify → 不产 reading 观察（划线/想法改由 weave-data 计数）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
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
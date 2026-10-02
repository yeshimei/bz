/**
 * 日记本书页界面（ADR-0230「桌上那本」）· 纯函数 + markup 守卫 + 控制器回归。
 *
 * 回忆墙 UI 已整域退役（ADR-0230 决策 7），本文件是换代后的第一条主线测试，覆盖三层：
 *
 * 1. **纯函数**（`collectPhotoRefs` / `paginateFlow` / `monthMarks` / `pageDateOf` / `plainTextOf`）——
 *    分页与索引是这次换代里唯一「算法」所在，抽成纯函数就是为了能脱开 DOM 量尺直接测；
 * 2. **markup 守卫**（render 纯层）——类名一律 `bz-diary-` 前缀（21 域共用一个 document）、
 *    零内联视觉样式（倾角走 `bz-diary-tilt-N` 类）、失败态走 `data-media-err` 换类；
 *    以及 ADR-0230 三条拍板：不带外链字体（决策 3）、无「抹」文具（决策 9）、书内无写作页（决策 8）；
 * 3. **控制器**（`DiaryAppController`）——StPageFlip 边界（建书参数 / 页数 / 页序 / 翻页）、
 *    窄屏单页翻档、文具四项接线、便签菜单的可用项分流。
 *
 * 内嵌翻页库用替身（`./page-flip-fake`）：要断言的是 `ui.ts → 库` 这条边界，不是库的动画。
 */
import { describe, expect, it, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp, getApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages, Platform } from '../mock-obsidian-entry';
import { DiaryAppController } from '../../src/diary/ui';
import {
  collectPhotoRefs,
  paginateFlow,
  monthMarks,
  pageDateOf,
  plainTextOf,
  type FlowItem,
  type Page,
} from '../../src/diary/ui';
import {
  bookPanelHTML,
  daystampHTML,
  entryBlockHTMLs,
  photoHTML,
  tiltClassOf,
  type RenderCtx,
} from '../../src/diary/render';
import type { WallEntry, WallMedia, WallSegment } from '../../src/diary/types';
import { lastFlip, flipRecords, resetFlips } from './page-flip-fake';

// ===== 翻页库替身 =====

vi.mock('../../src/diary/vendor/page-flip.browser.js', async () => {
  const mod = await import('./page-flip-fake');
  return { PageFlip: mod.FakePageFlip };
});

// ===== 外部依赖替身（本文件只测「控制器接线」，不重测各依赖自身） =====

const mocks = vi.hoisted(() => ({
  openAddDialog: vi.fn(),
  showTagPicker: vi.fn(),
  hideAddDialog: vi.fn(),
  hideTagPicker: vi.fn(),
  copyDiaryLink: vi.fn(async () => {}),
  showConfirm: vi.fn(),
  openFlowDialog: vi.fn(async (): Promise<string | undefined> => 'ok'),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<any[]> => []),
  encryptEntry: vi.fn(async (_entry: unknown): Promise<any> => ({ encrypted: true, noteId: 'note-1' })),
  reclassifyEntry: vi.fn(async (): Promise<boolean> => true),
  deleteEncryptedEntry: vi.fn(async () => {}),
  loadWallEntries: vi.fn(async (app: any, real: (a: any) => Promise<any[]>) => real(app)),
  getSafeManager: vi.fn(
    () =>
      ({
        unlocked: true, // 默认已解锁：动保险箱的动作不该在测里卡在密码框上
        manifest: null,
        unlock: mocks.safeUnlock,
      }) as unknown
  ),
  safeUnlock: vi.fn(async () => true),
}));

vi.mock('../../src/diary/ui/dialogs', () => ({
  openAddDialog: mocks.openAddDialog,
  showTagPicker: mocks.showTagPicker,
  hideAddDialog: mocks.hideAddDialog,
  hideTagPicker: mocks.hideTagPicker,
}));
vi.mock('../../src/diary/ui/entry-actions', () => ({
  copyDiaryLink: mocks.copyDiaryLink,
  showConfirm: mocks.showConfirm,
  jumpToDiaryEntry: vi.fn(),
}));
vi.mock('../../src/core/flow-dialog', () => ({ openFlowDialog: mocks.openFlowDialog }));
// 数据层只截 `loadWallEntries`（默认转真实现）：读盘失败态是 `loadEntries` 的兜底分支，
// 只靠假 vault 触不到（逐文件读错在 readBatch 里已被吞成 warn）。
vi.mock('../../src/diary/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary/data')>();
  return {
    ...actual,
    loadWallEntries: (app: any) => mocks.loadWallEntries(app, actual.loadWallEntries),
  };
});
vi.mock('../../src/encrypt', () => ({
  openEncrypt: vi.fn(),
  getSafeManager: () => mocks.getSafeManager(),
}));
// store 不 mock：反查/摘除走真实写层，落盘断言才是真的（与旧 actions.test.ts 同口径）
vi.mock('../../src/diary/encrypt', () => ({
  ENCRYPT_TAG: '加密',
  isUnlocked: mocks.isUnlocked,
  loadEncryptedEntries: mocks.loadEncryptedEntries,
  encryptEntry: mocks.encryptEntry,
  reclassifyEntry: mocks.reclassifyEntry,
  deleteEncryptedEntry: mocks.deleteEncryptedEntry,
}));

// ===== 夹具 =====

/** 最小 WallEntry 夹具（纯函数测试用，不落盘） */
function mk(partial: Partial<WallEntry> & Pick<WallEntry, 'date' | 'kind'>): WallEntry {
  return {
    time: '00:00',
    tags: [],
    emoji: '',
    content: '',
    filename: '',
    lineNumber: 0,
    media: [],
    text: '',
    segments: [],
    ...partial,
  };
}

const CTX: RenderCtx = { mediaSrc: (n) => `app://vault/${n}`, lbIndexOf: () => 0 };

function mkSegMedia(name: string, kind: WallMedia['kind']): WallSegment {
  return { kind: 'media', media: { name, kind } };
}

const DIARY_PATH = '我的/日记/2608192302.md';
const YOUNGER_PATH = '我的/日记/2501010800.md';
const MOVIE_PATH = '我的/影视/film.md';
const BOOK_PATH = '书库/书.md';
const LETTER_PATH = '我的/信/信.md';

function fixtureFiles(): Record<string, string> {
  return {
    [DIARY_PATH]: serializeDiaryEntryFile({ date: '2026-08-19', time: '23:02' }, ['日记'], '被猫盯着\n\n![[photo.jpg]]\n\n今天 #随手记'),
    [YOUNGER_PATH]: serializeDiaryEntryFile({ date: '2025-01-01', time: '08:00' }, ['日记'], '元旦那天'),
    [MOVIE_PATH]: ['---', '影评: 好看', '观影日期: 2026-08-19', '导演: 某导演', '豆瓣评分: 8.5', 'tags: [电影]', '---', ''].join('\n'),
    [BOOK_PATH]: ['---', 'title: 某本书', 'bookReview: 值得一读', 'completionDate: 2026-08-19', 'author: 某人', 'category: 小说', '---', ''].join('\n'),
    [LETTER_PATH]: ['---', 'date: 2026-08-19 10:00', '---', '', '见字如面'].join('\n'),
  };
}

let vault: MockVault;

beforeAll(() => {
  // jsdom 不实现 Web Animations API，碎纸动效用它（`tearAnim`）。
  // 不给替身的话撕页会在动画抛错处中断，`showConfirm` 永远到不了——那是环境缺口，不是实现缺陷。
  if (typeof Element.prototype.animate !== 'function') {
    (Element.prototype as unknown as { animate: () => unknown }).animate = () => ({
      finished: Promise.resolve(),
      cancel: () => {},
    });
  }
});

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetObsidianMocks();
  resetFlips();
  applyDirectories({});
  for (const fn of Object.values(mocks)) fn.mockClear();
  mocks.isUnlocked.mockReturnValue(false);
  mocks.encryptEntry.mockResolvedValue({ encrypted: true, noteId: 'note-1' });
  mocks.openFlowDialog.mockResolvedValue('ok');
  // mockClear 不清 mockReturnValue：解锁态默认值每用例复位（「没解锁」那条会临时翻 false）
  mocks.getSafeManager.mockReturnValue({ unlocked: true, manifest: null, unlock: mocks.safeUnlock });
  mocks.loadEncryptedEntries.mockResolvedValue([]);
  mocks.loadWallEntries.mockImplementation(async (app: any, real: (a: any) => Promise<any[]>) => real(app));
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(async () => {}) },
    configurable: true,
  });
  Platform.isMobile = false;
  vault = new MockVault();
  for (const [p, c] of Object.entries(fixtureFiles())) vault.files.set(p, c);
  setApp(mockAppWithVault(vault));
});

afterEach(() => {
  DiaryAppController.instance?.cleanup();
  DiaryAppController.instance = null;
  document.body.innerHTML = '';
});

/** 起册并等首屏落定（`show()` → afterPaint → 读盘 → relayout → 建书） */
async function openBook(): Promise<DiaryAppController> {
  const c = DiaryAppController.getInstance();
  c.show();
  await vi.waitFor(() => expect(document.querySelectorAll('.bz-diary-page-item').length).toBeGreaterThan(0));
  return c;
}

const q = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const qa = (sel: string): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(sel));

// ============================================================
//  一、分页引擎（纯函数）
// ============================================================

describe('paginateFlow（块流 → 页）', () => {
  const el = () => document.createElement('div');
  const items = (...hs: [number, boolean?][]): FlowItem[] => hs.map(([h, keep]) => ({ el: el(), h, keep }));
  const heights = new Map<HTMLElement, number>();
  const noSplit = () => null;

  beforeEach(() => heights.clear());

  it('装得下就顺着排，装不下换页', () => {
    const pages = paginateFlow(items([40], [40], [40]), 100, noSplit, () => 0);
    expect(pages.map((p) => p.length)).toEqual([2, 1]);
  });

  it('日戳（keep）必开新纸，且补一张空白背面——每一天都起于跨页左位', () => {
    const pages = paginateFlow(items([10, true], [10], [10, true], [10], [10, true], [10]), 100, noSplit, () => 0);
    // [日戳+条] [空白背面] [日戳+条] [空白背面] [日戳+条]
    expect(pages.map((p) => p.length)).toEqual([2, 0, 2, 0, 2]);
  });

  it('空页上遇到超一整页的块：先按整页高切一刀，下半续到下页', () => {
    // 切页契约（与 `splitParagraph` 一致）：**上半是原元素就地改**（返回 [el, down, downH]），
    // 故这刀切完页上仍是那个原块；桩里若另给一个「上半」元素，实现照原型用的也是原块。
    const up = el();
    const down = el();
    heights.set(up, 100);
    const items_ = items([250]);
    items_[0].el = up; // 上半 = 原块
    const split = (target: HTMLElement, avail: number): [HTMLElement, HTMLElement, number] | null => {
      expect(target).toBe(up);
      expect(avail).toBe(96); // availH - 4
      return [up, down, 60];
    };
    const pages = paginateFlow(items_, 100, split, (e) => heights.get(e) ?? 60);
    expect(pages.map((p) => p.length)).toEqual([1, 1]);
    expect(pages[0][0]).toBe(up);
    expect(pages[1][0]).toBe(down);
  });

  it('页尾够高（≥84px）就在剩余空间里逐行续排，上半留页尾、下半顶格下页', () => {
    const up = el();
    const down = el();
    const seen: number[] = [];
    const items_ = items([110], [110]);
    const split = (_e: HTMLElement, avail: number): [HTMLElement, HTMLElement, number] | null => {
      seen.push(avail);
      return [up, down, 30];
    };
    const pages = paginateFlow(items_, 200, split, () => 30);
    // 第一块 110 占页；第二块 110 装不下，剩余 90 → 切一刀（可用高 86）
    expect(seen).toEqual([86]);
    expect(pages.map((p) => p.length)).toEqual([2, 1]);
    expect(pages[0][1]).toBe(up);
    expect(pages[1][0]).toBe(down);
  });

  it('页尾不够高就不切（切出来两行字没有意义），直接换页', () => {
    let called = 0;
    const split = (): null => {
      called++;
      return null;
    };
    const pages = paginateFlow(items([90], [90]), 100, split, () => 0);
    expect(called).toBe(0); // 剩余 10px < 84px → 连试都不试
    expect(pages.map((p) => p.length)).toEqual([1, 1]);
  });

  it('没有日戳时全部落在一页（块高为 0 的退化场景，jsdom 量尺即如此）', () => {
    const pages = paginateFlow(items([0], [0], [0]), 100, noSplit, () => 0);
    expect(pages.length).toBe(1);
    expect(pages[0].length).toBe(3);
  });
});

describe('monthMarks / pageDateOf（册页索引口径）', () => {
  const stamp = (date: string) => {
    const t = document.createElement('template');
    t.innerHTML = daystampHTML(date, 1);
    return t.content.firstElementChild as HTMLElement;
  };

  it('每个月第一次出现的页（1 起），条目数按月份汇总', () => {
    const pages: Page[] = [[stamp('2026-08-19')], [], [stamp('2026-07-02')], [], [stamp('2025-12-31')]];
    const entries = [
      mk({ date: '2026-08-19', kind: 'diary' }),
      mk({ date: '2026-08-01', kind: 'diary' }),
      mk({ date: '2026-07-02', kind: 'diary' }),
      mk({ date: '2025-12-31', kind: 'movie', time: '00:00' }),
    ];
    expect(monthMarks(pages, entries)).toEqual([
      { key: '2026-08', page1: 1, n: 2 },
      { key: '2026-07', page1: 3, n: 1 },
      { key: '2025-12', page1: 5, n: 1 },
    ]);
  });

  it('没有日戳的页面不进索引，pageDateOf 返回 null', () => {
    const pages: Page[] = [[stamp('2026-08-19')], []];
    expect(monthMarks(pages, [])).toEqual([{ key: '2026-08', page1: 1, n: 0 }]);
    expect(pageDateOf(pages[0])).toBe('2026-08-19');
    expect(pageDateOf(pages[1])).toBeNull();
  });
});

describe('collectPhotoRefs（灯箱序列）', () => {
  it('按条目序 × 段序收集；同名只登记一次；录音不进灯箱；加密条目不进', () => {
    const viewer = mk({
      date: '2026-08-19',
      kind: 'diary',
      segments: [
        { kind: 'text', text: '前' },
        mkSegMedia('a.jpg', 'img'),
        mkSegMedia('voice.m4a', 'audio'),
        mkSegMedia('a.jpg', 'img'), // 同一张图引用两次
        mkSegMedia('clip.mp4', 'video'),
      ],
    });
    const sealed = mk({
      date: '2026-08-18',
      kind: 'diary',
      encrypted: true,
      segments: [mkSegMedia('secret.png', 'img')],
    });
    const older = mk({ date: '2026-08-17', kind: 'diary', segments: [mkSegMedia('b.png', 'img')] });
    expect(collectPhotoRefs([viewer, sealed, older]).map((r) => r.media.name)).toEqual([
      'a.jpg',
      'clip.mp4',
      'b.png',
    ]);
  });
});

describe('plainTextOf（誊录正文）', () => {
  it('影视：片名 + 观影日期 + 影评', () => {
    expect(plainTextOf(mk({ date: '2026-08-19', kind: 'movie', extra: { title: '某片', review: '好看' } }))).toBe(
      '《某片》观影于 2026-08-19\n好看'
    );
  });

  it('书：书名 + 作者 + 书评', () => {
    expect(
      plainTextOf(mk({ date: '2026-08-19', kind: 'book', extra: { title: '某书', author: '某人', review: '值得' } }))
    ).toBe('《某书》某人\n值得');
  });

  it('信：文件名（去扩展名）+ 正文', () => {
    expect(plainTextOf(mk({ date: '2026-08-19', kind: 'letter', filename: '我的/信/给某人.md', content: '见字如面' }))).toBe(
      '给某人\n见字如面'
    );
  });

  it('日记：正文原样', () => {
    expect(plainTextOf(mk({ date: '2026-08-19', kind: 'diary', content: '被猫盯着' }))).toBe('被猫盯着');
  });
});

// ============================================================
//  二、markup 守卫（render 纯层 + 域样式）
// ============================================================

describe('render 纯层：命名空间与零内联视觉样式', () => {
  const sampleHTML = (): string[] => {
    const diary = mk({
      date: '2026-08-19',
      time: '23:02',
      kind: 'diary',
      text: '被猫盯着',
      segments: [{ kind: 'text', text: '被猫盯着\n\n![[photo.jpg]]\n\n今天#随手记' }, mkSegMedia('photo.jpg', 'img')],
    });
    const movie = mk({
      date: '2026-08-19',
      kind: 'movie',
      extra: { title: '某片', review: '好看', poster: 'poster.png', meta: { 导演: '某人', 豆瓣评分: '8.5' } },
    });
    const book = mk({
      date: '2026-08-19',
      kind: 'book',
      extra: { title: '某书', review: '值得', cover: 'cover.jpg', author: '某人', category: '小说' },
    });
    const letter = mk({ date: '2026-08-19', kind: 'letter', filename: '我的/信/信.md', segments: [{ kind: 'text', text: '见字如面' }] });
    const sealed = mk({ date: '2026-08-18', kind: 'diary', encrypted: true });
    return [
      bookPanelHTML(),
      daystampHTML('2026-08-19', 3),
      ...entryBlockHTMLs(diary, CTX),
      ...entryBlockHTMLs(movie, CTX),
      ...entryBlockHTMLs(book, CTX),
      ...entryBlockHTMLs(letter, CTX),
      ...entryBlockHTMLs(sealed, CTX),
      photoHTML({ name: 'a.jpg', kind: 'img' }, diary, 0, CTX),
    ];
  };

  it('所有类名都带 bz-diary- 前缀（21 个域共用一个 document，裸类名会撞车）', () => {
    const joined = sampleHTML().join('\n');
    const classes = Array.from(joined.matchAll(/class="([^"]*)"/g))
      .flatMap((m) => m[1].split(/\s+/))
      .filter(Boolean);
    expect(classes.length).toBeGreaterThan(30);
    // core 自有的共享类不算「裸类名」（21 个域共用同一份 core 样式，本来就全局唯一）
    const CORE_SHARED = new Set(['bz-ic']);
    for (const c of classes) {
      expect(c.startsWith('bz-diary-') || CORE_SHARED.has(c), `类名未加域前缀：${c}`).toBe(true);
    }
  });

  it('零内联视觉样式：倾角走 bz-diary-tilt-N 类，图片失败态走 data-media-err', () => {
    const joined = sampleHTML().join('\n');
    expect(joined).not.toContain('style="');
    expect(joined).toMatch(/class="bz-diary-photo bz-diary-tilt-\d"/);
    // 失败时要换上的类名以完整类名写出（ui 侧按值换 className）
    expect(joined).toContain('data-media-err="bz-diary-ph-empty"');
    expect(joined).toContain('data-media-err="bz-diary-ex-nothing"');
  });

  it('tiltClassOf 恒落在 0..5 六档（确定性倾角，同一序号每次一样）', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const cls = tiltClassOf(i);
      expect(cls).toMatch(/^bz-diary-tilt-[0-5]$/);
      seen.add(cls);
    }
    expect(tiltClassOf(7)).toBe(tiltClassOf(7));
    expect(seen.size).toBe(6);
  });

  it('ADR-0230 决策 9：案头只有四件文具，没有「抹」', () => {
    const panel = bookPanelHTML();
    expect(panel.match(/data-tact="/g)?.length).toBe(4);
    for (const t of ['pencil', 'lens', 'calendar', 'stickers']) expect(panel).toContain(`data-tact="${t}"`);
    expect(panel).not.toContain('data-tact="eraser"');
  });

  it('ADR-0233：书桌上摆着写作内页的空壳（正文区 / 贴纸槽 / 揉掉·落笔）', () => {
    const panel = bookPanelHTML();
    expect(panel).toContain('bz-diary-wsp-area');
    expect(panel).toContain('bz-diary-wsp-tools');
    expect(panel).toContain('data-wact="discard"');
    expect(panel).toContain('data-wact="save"');
    // 旧写日记弹窗的挂点不再出现在书桌上（那条路已由内页接手）
    expect(panel).not.toContain('add-diary-popup');
  });

  it('ADR-0233：开册进度纸条与进度条挂点在位（读全量之前书是空的）', () => {
    const panel = bookPanelHTML();
    expect(panel).toContain('bz-diary-loading');
    expect(panel).toContain('bz-diary-ld-title');
    expect(panel).toContain('bz-diary-ld-bar');
  });

  it('加密条目只出一枚火漆信封（全文不装在纸面上）', () => {
    const sealed = mk({ date: '2026-08-18', kind: 'diary', encrypted: true });
    const htmls = entryBlockHTMLs(sealed, CTX);
    expect(htmls.length).toBe(1);
    expect(htmls[0]).toContain('bz-diary-envelope');
    expect(htmls[0]).toContain('bz-diary-env-reseal');
  });

  it('拆分后（unwrap）以加密身份渲全文：媒体只留 data-enc-name 挂载点，不发 src / data-lb', () => {
    const sealed = mk({
      date: '2026-08-18',
      kind: 'diary',
      encrypted: true,
      segments: [{ kind: 'text', text: '藏在信封里的话' }, mkSegMedia('secret.png', 'img'), mkSegMedia('v.m4a', 'audio')],
    });
    const joined = entryBlockHTMLs(sealed, CTX, { unwrap: true }).join('\n');
    expect(joined).not.toContain('bz-diary-envelope');
    expect(joined).toContain('藏在信封里的话');
    expect(joined).toContain('data-enc-name="secret.png"');
    expect(joined).toContain('data-enc-kind="img"');
    expect(joined).toContain('data-enc-name="v.m4a"');
    expect(joined).not.toMatch(/<img[^>]* src=/);
    expect(joined).not.toContain('data-lb=');
    // 明文条目的同一段照常解析 src 与灯箱号
    const plain = mk({ date: '2026-08-18', kind: 'diary', segments: [mkSegMedia('secret.png', 'img')] });
    const plainHtml = entryBlockHTMLs(plain, CTX, { unwrap: true }).join('\n');
    expect(plainHtml).toContain(' src="app://vault/secret.png"');
    expect(plainHtml).toContain('data-lb="0"');
    expect(plainHtml).not.toContain('data-enc-name');
  });
});

describe('域样式：换代留下的痕迹', () => {
  const css = () => readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');

  it('回忆墙选择器整族退役（桌面卡 / 移动全屏 / 条目卡 / 日期筛选 / 墙区）', () => {
    const text = css();
    for (const gone of ['.bz-diary-item', '.bz-diary-mob', '.bz-diary-datefilter', '.bz-diary-wall', '.bz-diary-day-head']) {
      expect(text, `${gone} 应随回忆墙退役`).not.toContain(gone);
    }
  });

  it('ADR-0230 决策 3：不引外链字体、不 @font-face、不 @import', () => {
    const text = css();
    expect(text).not.toMatch(/@import\s/);
    expect(text).not.toMatch(/@font-face/);
    expect(text).not.toMatch(/fonts\.(googleapis|gstatic)/);
    expect(text).not.toContain('cdn.');
  });

  it('书页版的域根与书口在位（.bz-diary-scene / .bz-diary-book / 年份色阶 8 档）', () => {
    const text = css();
    expect(text).toContain('.bz-diary-scene');
    expect(text).toContain('.bz-diary-book');
    for (const cls of ['.bz-diary-ey-0', '.bz-diary-ey-7']) expect(text).toContain(cls);
  });
});

// ============================================================
//  三、控制器（书桌搭起来 + 文具接线 + 便签分流）
// ============================================================

describe('DiaryAppController · 首屏与建书', () => {
  it('show() 搭出唯一域根并翻开：3 页（2 天 + 1 张空白背面），日戳按天各一枚', async () => {
    const c = await openBook();
    const root = q('.bz-diary-scene');
    expect(document.querySelectorAll('.bz-diary-scene').length).toBe(1);
    expect(root.style.display).toBe('flex');
    expect(c.root).toBe(root);

    // 夹具里 2026-08-19（日记/信/影视/书四则同日）与 2025-01-01（一则）→ 两天
    expect(qa('.bz-diary-b-daystamp').map((el) => el.dataset.date)).toEqual(['2026-08-19', '2025-01-01']);
    // 每则一枚类型签：4 + 1 = 5 则
    expect(qa('.bz-diary-b-seal').length).toBe(5);
    // 票根 / 藏书票 / 信笺标题 / 信笺正文
    expect(qa('.bz-diary-ticket').length).toBe(1);
    expect(qa('.bz-diary-exlibris').length).toBe(1);
    expect(qa('.bz-diary-b-head').length).toBe(1);
    // 段落里的 `#随手记` 被提到类型签，正文里不再出现
    expect(q('.bz-diary-seal-hashes').textContent).toContain('#随手记');
    expect(q('.bz-diary-b-para').textContent).not.toContain('#随手记');
  });

  it('StPageFlip 建书契约：页数与页序、无扉页、禁四角点击、翻页时长', async () => {
    await openBook();
    const rec = lastFlip();
    expect(rec.items.length).toBe(3);
    expect(rec.opts.showCover).toBe(false);
    expect(rec.opts.disableFlipByClick).toBe(true);
    expect(rec.opts.showPageCorners).toBe(false);
    // 620 太拖（原型里翻一页像等半拍），按手感收到 380
    expect(rec.opts.flippingTime).toBe(380);
    expect(rec.opts.size).toBe('fixed');
    // 页内元素真的装进了页容器
    expect(rec.items[0].querySelector('.bz-diary-b-daystamp')).toBeTruthy();
    // 补出来的空白背面（第 1 页）不印页码：有内容的两页才有页码
    expect(rec.items[0].querySelector('.bz-diary-page-no')).toBeTruthy();
    expect(rec.items[1].querySelector('.bz-diary-page-no')).toBeNull();
    expect(rec.items[2].querySelector('.bz-diary-page-no')).toBeTruthy();
  });

  it('书口年份染色：跨年才画，色阶类按年序轮转（几何走内联，颜色走类）', async () => {
    await openBook();
    const years = qa('.bz-diary-edge-year');
    expect(years.length).toBe(2);
    expect(years[0].className).toContain('bz-diary-ey-0');
    expect(years[1].className).toContain('bz-diary-ey-1');
    expect(years[0].style.top).not.toBe('');
  });

  it('重排会先销毁旧书再建新书（库的 destroy 摘掉容器，必须放回去）', async () => {
    const c = await openBook();
    const first = lastFlip();
    const host = first.host;
    (c as unknown as { relayout: (keep: boolean) => void }).relayout(false);
    expect(first.destroyed).toBe(true);
    expect(flipRecords.length).toBe(2);
    const second = lastFlip();
    expect(second.host).toBe(host); // 同一个容器被放回书芯
    expect(second.host.isConnected).toBe(true);
    expect(qa('.bz-diary-page-item').length).toBe(3);
  });

  it('窄屏（≤720px）翻档单页模式，根上挂 bz-diary-single；宽回来再翻回跨页', async () => {
    await openBook();
    expect(lastFlip().opts.usePortrait).toBe(false);
    expect(q('.bz-diary-scene').classList.contains('bz-diary-single')).toBe(false);

    const before = flipRecords.length;
    window.innerWidth = 600;
    window.dispatchEvent(new Event('resize'));
    await vi.waitFor(() => expect(flipRecords.length).toBeGreaterThan(before));
    expect(lastFlip().opts.usePortrait).toBe(true);
    expect(q('.bz-diary-scene').classList.contains('bz-diary-single')).toBe(true);

    const after = flipRecords.length;
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));
    await vi.waitFor(() => expect(flipRecords.length).toBeGreaterThan(after));
    expect(lastFlip().opts.usePortrait).toBe(false);
  });

  it('滚轮翻页节流；键盘 ← → 翻页；Esc 无浮层时翻回最新', async () => {
    await openBook();
    const rec = lastFlip();
    const book = q('.bz-diary-book');
    const wheel = (d: number) =>
      book.dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true }));

    expect(rec.page).toBe(0); // 翻开就是最新那一篇
    wheel(120); // 向下滚 = 往后翻
    expect(rec.page).toBe(1);
    wheel(120); // 节流窗（560ms）内：这一下不翻
    expect(rec.page).toBe(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(rec.page).toBe(2); // 3 页（0/1/2），到顶
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(rec.page).toBe(1);

    // Esc：无任何浮层 → 回到最新那一页（第 0 页）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(rec.page).toBe(0);
    expect(q('.bz-diary-toast').textContent).toContain('翻到最新');
  });
});

describe('DiaryAppController · 文具四项接线', () => {
  it('写 → 书内写作内页；找 → 放大镜纸条；跳 → 台历；类 → 贴纸册', async () => {
    const c = await openBook();
    const tact = (n: string) => q(`.bz-diary-tools [data-tact="${n}"]`);
    expect(qa('.bz-diary-tools [data-tact]').length).toBe(4);

    tact('pencil').click();
    expect(q('.bz-diary-wsp').hidden).toBe(false); // ADR-0233：不再开旧弹窗
    expect(mocks.openAddDialog).not.toHaveBeenCalled();
    q('[data-wact="discard"]').click(); // 空纸：直接揉掉，不留草稿
    expect(q('.bz-diary-wsp').hidden).toBe(true);

    tact('lens').click();
    expect(q('.bz-diary-slip').hidden).toBe(false);
    // 纸条标题按书页版式带字距（书页正字排印，不是回忆墙的密排标题）
    expect(q('.bz-diary-slip-title').textContent).toContain('放 大 镜');
    (c as unknown as { closeSlip: () => void }).closeSlip();

    tact('calendar').click();
    expect(q('.bz-diary-cal-pop').hidden).toBe(false);
    expect(q('.bz-diary-cal-ym').textContent).toBe('2026 年 8 月'); // 落最新一则所在的年月
    // 有日记的那天可点，点它就跳过去
    expect(qa('.bz-diary-cal-cell.bz-diary-has').length).toBe(1);
    (c as unknown as { closeCal: () => void }).closeCal();

    tact('stickers').click();
    expect(q('.bz-diary-album-pop').hidden).toBe(false);
    const stickers = qa('.bz-diary-ap-sticker').map((el) => el.textContent || '');
    expect(stickers.some((t) => t.includes('日记'))).toBe(true);
    expect(q('.bz-diary-ap-confirm').hidden).toBe(true); // 只留「按类翻」一种模式
  });

  it('贴纸册按类重装订：点一张只留带该类标签的条目，书口按新页重建', async () => {
    const c = await openBook();
    q('.bz-diary-tools [data-tact="stickers"]').click();
    const sticker = qa('.bz-diary-ap-sticker').find((el) => (el.textContent || '').includes('日记'))!;
    sticker.click();
    await vi.waitFor(() => expect(q('.bz-diary-filter-tab').classList.contains('bz-diary-on')).toBe(true));
    expect((c as unknown as { filterTag: string | null }).filterTag).toBe('日记');
    expect(qa('.bz-diary-b-seal').length).toBe(2); // 只剩两则日记
    expect(lastFlip().items.length).toBe(3); // 两天 → 3 页（含一张空白背面）

    // 取下书签 → 整本册子回来
    q('.bz-diary-filter-tab').click();
    await vi.waitFor(() => expect(qa('.bz-diary-b-seal').length).toBe(5));
    expect(q('.bz-diary-filter-tab').classList.contains('bz-diary-on')).toBe(false);
  });

  it('书口点一下抽出「册页索引」：一年一段、一月一行，行上带跳页号', async () => {
    await openBook();
    q('.bz-diary-bk-edge').click();
    expect(q('.bz-diary-sheet').hidden).toBe(false);
    expect(q('.bz-diary-sh-title').textContent).toContain('索');
    expect(qa('.bz-diary-idx-year').length).toBe(2); // 2026 / 2025
    const rows = qa('.bz-diary-idx-row');
    expect(rows.length).toBe(2); // 2026-08 / 2025-01
    expect(rows[0].dataset.jumpPage).toBe('0');
  });

  it('放大镜命中用荧光笔标出，且只拆检索打的那一笔（手写 ==高亮== 不动）', async () => {
    await openBook();
    q('.bz-diary-tools [data-tact="lens"]').click();
    const input = q<HTMLInputElement>('.bz-diary-slip-input');
    input.value = '猫';
    q('.bz-diary-slip-row .bz-diary-slip-btn.bz-diary-primary').click();
    expect(q('.bz-diary-slip').hidden).toBe(true);
    await vi.waitFor(() => expect(qa('.bz-diary-page-item mark.bz-diary-hl-on').length).toBe(1));
    expect(q('.bz-diary-toast').textContent).toContain('荧光笔');

    // 没命中 → 弹「没找到」纸条，不标任何东西
    await vi.waitFor(() => expect(qa('mark.bz-diary-hl-on').length).toBe(1));
    q('.bz-diary-tools [data-tact="lens"]').click();
    const input2 = q<HTMLInputElement>('.bz-diary-slip-input');
    input2.value = '绝无此词';
    q('.bz-diary-slip-row .bz-diary-slip-btn.bz-diary-primary').click();
    await vi.waitFor(() => expect(q('.bz-diary-slip-title').textContent).toContain('没'));
    expect(qa('mark.bz-diary-hl-on').length).toBe(0); // 新一次检索先拆旧笔
  });

  it('台历点有日记的那天 → 翻到那天；没落笔的那天只提示', async () => {
    const c = await openBook();
    q('.bz-diary-tools [data-tact="calendar"]').click();
    const day = q('.bz-diary-cal-cell.bz-diary-has');
    const dayDate = `2026-08-${day.dataset.d!.padStart(2, '0')}`;
    day.click();
    expect(q('.bz-diary-cal-pop').hidden).toBe(true);
    expect(lastFlip().page).toBe(0); // 2026-08-19 就是第 0 页
    (c as unknown as { jumpToDay: (d: string) => void }).jumpToDay('2026-08-15');
    expect(q('.bz-diary-toast').textContent).toContain('没落笔');
  });
});

describe('DiaryAppController · 便签菜单（右键 / 长按）', () => {
  /** 取某则条目的可点元素（`data-eid` 落在块根上） */
  function blockOf(kind: string): HTMLElement {
    const sel =
      kind === 'movie'
        ? '.bz-diary-ticket'
        : kind === 'book'
          ? '.bz-diary-exlibris'
          : '.bz-diary-b-para';
    const el = q(sel);
    return el.closest<HTMLElement>('[data-eid]')!;
  }

  function openMenuOn(el: HTMLElement): HTMLElement[] {
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 50 }));
    const menu = q('.bz-diary-menu');
    expect(menu.hidden).toBe(false);
    return qa('.bz-diary-menu .bz-diary-mn-item').filter((i) => !i.hidden);
  }

  it('普通日记条目：换贴纸 / 收进信封 / 誊录正文 / 誊录位置 / 撕掉；无「拆信/取出」', async () => {
    await openBook();
    const acts = openMenuOn(blockOf('diary')).map((i) => i.dataset.act);
    expect(acts).toEqual(['retype', 'envelope', 'copytext', 'copylink', 'tear']);
  });

  it('影视/书条目：只能誊录（无加密/删除入口，写层语义错位）', async () => {
    await openBook();
    const acts = openMenuOn(blockOf('movie')).map((i) => i.dataset.act);
    expect(acts).toEqual(['copytext', 'copylink']); // 影视没有 filePath 时连誊录位置都没有
  });

  it('加密条目：拆信看 / 从信封取出 / 撕掉（文案改成销毁密文），无「收进信封」', async () => {
    const c = await openBook();
    // 直接把一枚加密条目并入册子（解锁态由 mergeEncryptedEntries 真跑，这里只验菜单分流）
    mocks.isUnlocked.mockReturnValue(true);
    mocks.loadEncryptedEntries.mockResolvedValue([
      { date: '2026-08-10', time: '21:00', tags: ['日记', '加密'], emoji: '🔐', content: '密文', filename: 'vault/x', id: 'enc-1', noteId: 'note-9' },
    ]);
    await (c as unknown as { loadAndRelayout: () => Promise<void> }).loadAndRelayout();
    const env = q('.bz-diary-envelope');
    expect(env).toBeTruthy();
    const menu = env.closest<HTMLElement>('[data-eid]')!;
    const acts = openMenuOn(menu);
    expect(acts.map((i) => i.dataset.act)).toEqual(['unseal', 'takeout', 'copytext', 'tear']);
    expect(acts.find((i) => i.dataset.act === 'tear')!.textContent).toContain('销毁密文');
  });

  it('「换张贴纸」接本域标签选择器（带定位与保险箱信息）', async () => {
    await openBook();
    openMenuOn(blockOf('diary'));
    q('.bz-diary-menu .bz-diary-mn-item[data-act="retype"]').click();
    expect(mocks.showTagPicker).toHaveBeenCalledTimes(1);
    expect(mocks.showTagPicker.mock.calls[0][0]).toMatchObject({
      filePath: DIARY_PATH,
      date: '2026-08-19',
      time: '23:02',
      tags: ['日记'],
    });
  });

  it('「誊录正文」把纯文本写进剪贴板', async () => {
    await openBook();
    openMenuOn(blockOf('diary'));
    q('.bz-diary-menu .bz-diary-mn-item[data-act="copytext"]').click();
    await vi.waitFor(() => expect((navigator.clipboard.writeText as any).mock.calls.length).toBe(1));
    expect((navigator.clipboard.writeText as any).mock.calls[0][0]).toContain('被猫盯着');
  });

  it('「誊录位置」：普通条目交 entry-actions 拼锚点双链；影视条目本地拼文件级双链', async () => {
    const c = await openBook();
    await (c as unknown as { copyLink: (e: WallEntry) => Promise<void> }).copyLink(
      mk({ date: '2026-08-19', kind: 'diary', filename: DIARY_PATH, filePath: DIARY_PATH, emoji: '📖', time: '23:02' })
    );
    expect(mocks.copyDiaryLink).toHaveBeenCalledWith({
      filename: DIARY_PATH,
      filePath: DIARY_PATH,
      emoji: '📖',
      time: '23:02',
    });

    await (c as unknown as { copyLink: (e: WallEntry) => Promise<void> }).copyLink(
      mk({ date: '2026-08-19', kind: 'movie', filename: MOVIE_PATH })
    );
    expect((navigator.clipboard.writeText as any).mock.calls.at(-1)[0]).toBe('[[我的/影视/film]]');
    expect(mocks.copyDiaryLink).toHaveBeenCalledTimes(1); // 影视不走 entry-actions
  });

  it('右键菜单夹在窗口内（上下都夹，窗口比菜单窄时 left 不为负）', async () => {
    await openBook();
    const el = blockOf('diary');
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: -50, clientY: 99999 }));
    expect(Number.parseFloat(q('.bz-diary-menu').style.left)).toBeGreaterThanOrEqual(10);
    expect(Number.parseFloat(q('.bz-diary-menu').style.top)).toBeGreaterThanOrEqual(10);
  });

  it('点菜单外面关掉它；Esc 也关', async () => {
    await openBook();
    openMenuOn(blockOf('diary'));
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(q('.bz-diary-menu').hidden).toBe(true);

    openMenuOn(blockOf('diary'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(q('.bz-diary-menu').hidden).toBe(true);
  });

  it('长按 500ms 开便签，移动超阈值就取消（触屏唯一入口）', async () => {
    Platform.isMobile = true;
    await openBook();
    const el = blockOf('diary');
    const touch = (type: string, x: number, y: number): TouchEvent => {
      const ev = new TouchEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] });
      return ev;
    };
    el.dispatchEvent(touch('touchstart', 10, 10));
    await new Promise((r) => setTimeout(r, 560));
    expect(q('.bz-diary-menu').hidden).toBe(false);
    (q('.bz-diary-menu') as HTMLElement).hidden = true;

    el.dispatchEvent(touch('touchstart', 10, 10));
    el.dispatchEvent(touch('touchmove', 60, 60)); // 超过 12px → 取消
    await new Promise((r) => setTimeout(r, 560));
    expect(q('.bz-diary-menu').hidden).toBe(true);
    Platform.isMobile = false;
  });
});

describe('DiaryAppController · 条目动作走真写层', () => {
  it('「收进信封」：二次确认 → 反查真实条目入库 → 摘除原文件（磁盘实变），并广播域事件', async () => {
    await openBook();
    q('.bz-diary-b-para').closest<HTMLElement>('[data-eid]')!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 30 })
    );
    q('.bz-diary-menu .bz-diary-mn-item[data-act="envelope"]').click();
    await vi.waitFor(() => expect(vault.files.has(DIARY_PATH)).toBe(false));
    // 解锁门禁问的是真保险箱状态（`getSafeManager().unlocked`），不再借通用解锁屏
    expect(mocks.getSafeManager).toHaveBeenCalled();
    expect(mocks.openFlowDialog).toHaveBeenCalledTimes(1);
    // 入库的是写层反查出的真实条目（filename=条目文件路径、时刻与磁盘一致）
    expect(mocks.encryptEntry.mock.calls[0][0]).toMatchObject({ filename: DIARY_PATH, time: '23:02', lineNumber: 0 });
  });

  it('二次确认取消就不加密（关掉这个出口不该留下半个密文）', async () => {
    await openBook();
    mocks.openFlowDialog.mockResolvedValue('cancel');
    q('.bz-diary-b-para').closest<HTMLElement>('[data-eid]')!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 30 })
    );
    q('.bz-diary-menu .bz-diary-mn-item[data-act="envelope"]').click();
    await vi.waitFor(() => expect(mocks.openFlowDialog).toHaveBeenCalled());
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
    expect(vault.files.has(DIARY_PATH)).toBe(true);
  });

  it('摘除失败要回滚密文（否则解锁后同一条出现两次、重试越积越多）', async () => {
    await openBook();
    mocks.encryptEntry.mockImplementation(async () => {
      vault.files.delete(DIARY_PATH); // 密文已入库、原文却在摘除前没了
      return { encrypted: true, noteId: 'note-d5' };
    });
    q('.bz-diary-b-para').closest<HTMLElement>('[data-eid]')!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 30 })
    );
    q('.bz-diary-menu .bz-diary-mn-item[data-act="envelope"]').click();
    await vi.waitFor(() => expect(getNoticeMessages().join('\n')).toContain('摘除未生效'));
    expect(mocks.deleteEncryptedEntry).toHaveBeenCalledWith('note-d5');
  });

  it('「撕掉」：影视条目不着手（提示去对应面板），普通条目交 entry-actions 确认框', async () => {
    const c = await openBook();
    const movie = mk({ date: '2026-08-19', kind: 'movie', filename: MOVIE_PATH });
    await (c as unknown as { tearEntry: (e: WallEntry) => Promise<void> }).tearEntry(movie);
    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(getNoticeMessages().join('\n')).toContain('对应面板');

    const diary = mk({
      date: '2026-08-19',
      time: '23:02',
      kind: 'diary',
      filename: DIARY_PATH,
      filePath: DIARY_PATH,
      id: 'e-diary',
      tags: ['日记'],
    });
    await (c as unknown as { tearEntry: (e: WallEntry) => Promise<void> }).tearEntry(diary);
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.showConfirm.mock.calls[0][0]).toMatchObject({
      filename: DIARY_PATH,
      filePath: DIARY_PATH,
      date: '2026-08-19',
      time: '23:02',
    });
  });

  it('「从信封取出」：reclassifyEntry 成功才广播解密事件，失败保持密文', async () => {
    const c = await openBook();
    const enc = mk({ date: '2026-08-10', time: '21:00', kind: 'diary', tags: ['日记', '加密'], noteId: 'note-9' });
    await (c as unknown as { decryptEntryAction: (e: WallEntry) => Promise<void> }).decryptEntryAction(enc);
    expect(mocks.reclassifyEntry).toHaveBeenCalledWith('note-9', ['日记']);

    mocks.reclassifyEntry.mockResolvedValue(false);
    await (c as unknown as { decryptEntryAction: (e: WallEntry) => Promise<void> }).decryptEntryAction(enc);
    expect(getNoticeMessages().join('\n')).toContain('取出失败');

    // 没有保险箱记录 → 直接拒绝
    await (c as unknown as { decryptEntryAction: (e: WallEntry) => Promise<void> }).decryptEntryAction(
      mk({ date: '2026-08-10', kind: 'diary' })
    );
    expect(getNoticeMessages().join('\n')).toContain('缺少保险箱记录');
  });

  it('拆信（信封被点）：演完拆封动效把全文放到抽出的纸上，并「重新封缄」收回信封', async () => {
    const c = await openBook();
    mocks.isUnlocked.mockReturnValue(true);
    mocks.loadEncryptedEntries.mockResolvedValue([
      { date: '2026-08-10', time: '21:00', tags: ['日记', '加密'], emoji: '🔐', content: '藏在信封里的话', filename: 'vault/x', id: 'enc-1', noteId: 'note-9' },
    ]);
    await (c as unknown as { loadAndRelayout: () => Promise<void> }).loadAndRelayout();
    const env = q('.bz-diary-envelope');
    env.click();
    expect(env.classList.contains('bz-diary-opening')).toBe(true);
    await vi.waitFor(() => expect(q('.bz-diary-sheet').hidden).toBe(false), { timeout: 2500 });
    expect(env.classList.contains('bz-diary-unsealed')).toBe(true);
    expect(q('.bz-diary-sheet-body').textContent).toContain('藏在信封里的话');

    q('.bz-diary-env-reseal').click();
    expect(env.classList.contains('bz-diary-unsealed')).toBe(false);
    expect(q('.bz-diary-sheet').hidden).toBe(true);
  });

  it('拆信后的照片按需解密：纸上是 data-enc-name 挂载点，解出附件才补 src（不入灯箱）', async () => {
    const c = await openBook();
    mocks.isUnlocked.mockReturnValue(true);
    mocks.loadEncryptedEntries.mockResolvedValue([
      {
        date: '2026-08-10',
        time: '21:00',
        tags: ['日记', '加密'],
        emoji: '🔐',
        content: '藏在信封里的话\n\n![[secret.png]]',
        filename: 'vault/x',
        id: 'enc-1',
        noteId: 'note-9',
      },
    ]);
    mocks.getSafeManager.mockReturnValue({
      unlocked: true,
      manifest: { notes: [{ id: 'note-9', attachments: [{ path: 'secret.png' }] }] },
      decryptAttachmentOriginal: async () => 'QUJD',
    });
    await (c as unknown as { loadAndRelayout: () => Promise<void> }).loadAndRelayout();
    const env = q('.bz-diary-envelope');
    env.click();
    await vi.waitFor(() => expect(q('.bz-diary-sheet').hidden).toBe(false), { timeout: 2500 });

    const img = q<HTMLImageElement>('.bz-diary-sheet-body img[data-enc-name="secret.png"]');
    // 纸上是**挂载点**（`data-enc-name`），src 由 mountEncryptedMedia 解密后补——
    // 「先留空」那一瞬是微任务级别的，测里观察不到；能钉的是挂载点属性和最终 src。
    expect(img.dataset.encName).toBe('secret.png');
    await vi.waitFor(() => expect(img.getAttribute('src')).toBe('data:image/png;base64,QUJD'));
    // 不进灯箱：加密媒体不入 collectPhotoRefs，也不该挂 data-lb
    expect(img.closest('.bz-diary-photo')!.hasAttribute('data-lb')).toBe(false);
  });

  it('影视票根点「影评全文」/藏书票整张点 → 抽出那张纸', async () => {
    await openBook();
    q('.bz-diary-tk-more').click();
    expect(q('.bz-diary-sheet').hidden).toBe(false);
    expect(q('.bz-diary-sh-title').textContent).toContain('影评');
    q('.bz-diary-sh-close').click();
    expect(q('.bz-diary-sheet').hidden).toBe(true);

    q('.bz-diary-exlibris').click();
    expect(q('.bz-diary-sheet').hidden).toBe(false);
    // 书名在**纸的标题行**（`《某本书》书评`），正文纸只有作者/分类/读毕与书评
    expect(q('.bz-diary-sh-title').textContent).toContain('某本书');
    expect(q('.bz-diary-sheet-body').textContent).toContain('值得一读');
  });

  it('照片点开进灯箱：题注带日期与文件名，序号对分子/分母，左右键步进', async () => {
    await openBook();
    const photo = q('.bz-diary-photo');
    expect(photo.dataset.lb).toBe('0');
    photo.click();
    expect(q('.bz-diary-lightbox').hidden).toBe(false);
    expect(q('.bz-diary-lb-count').textContent).toBe('1 / 1');
    expect(q('.bz-diary-lb-cap').textContent).toContain('2026-08-19 23:02 · photo.jpg');
    expect(q('.bz-diary-lb-media img')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(q('.bz-diary-lightbox').hidden).toBe(true);
  });

  it('hide() 关掉所有浮层但保住域根，cleanup() 才拆 DOM', async () => {
    const c = await openBook();
    q('.bz-diary-tools [data-tact="calendar"]').click();
    expect(q('.bz-diary-cal-pop').hidden).toBe(false);
    c.hide();
    expect(q('.bz-diary-cal-pop').hidden).toBe(true);
    expect(q('.bz-diary-scene').style.display).toBe('none');
    expect(DiaryAppController.instance).toBe(c); // 单例还在：下次 show() 复用

    c.cleanup();
    expect(document.querySelector('.bz-diary-scene')).toBeNull();
    expect(DiaryAppController.instance).toBeNull();
  });

  it('读盘失败 → 出兜底纸并提示，不让面板卡在空壳上', async () => {
    mocks.loadWallEntries.mockImplementation(async () => {
      throw new Error('盘读不动');
    });
    const c = DiaryAppController.getInstance();
    c.show();
    await vi.waitFor(() => expect(q('.bz-diary-fallback').hidden).toBe(false));
    expect(q('.bz-diary-fallback').textContent).toContain('没读出来');
    expect(getNoticeMessages().join('\n')).toContain('加载日记失败');
  });
});

// ============================================================
//  六、写作内页（ADR-0233）与开册进度
// ============================================================

/** 内页里的私有件（本文件按「控制器接线」口径直取，不另造公开面） */
type WriteInternals = {
  draft: { date: string; time: string; tags: string[] } | null;
  showLoading(): void;
  updateLoading(done: number, total: number): void;
  setLoadingBinding(): void;
  hideLoading(): void;
  importMedia(files: File[]): Promise<void>;
};

const inner = (c: DiaryAppController): WriteInternals => c as unknown as WriteInternals;

/** 假 App 的 fileManager（mock-vault 只给了 processFrontMatter / renameFile；
 *  「附件默认位置」这条 API 由用例按需补上，用来钉 mediaPathFor 的优先路） */
function getAppMockFileManager(): { getAvailablePathForAttachment?: (n: string, src?: string) => Promise<string> } {
  return (getApp() as unknown as { fileManager: Record<string, unknown> })
    .fileManager as unknown as { getAvailablePathForAttachment?: (n: string, src?: string) => Promise<string> };
}

/** 摊开写作内页（点「写」文具），返回正文区 */
async function openWritePage(c: DiaryAppController): Promise<HTMLTextAreaElement> {
  q('.bz-diary-tools [data-tact="pencil"]').click();
  await vi.waitFor(() => expect(q('.bz-diary-wsp').hidden).toBe(false));
  return q<HTMLTextAreaElement>('.bz-diary-wsp-area');
}

describe('DiaryAppController · 写作内页（ADR-0233）', () => {
  it('点「写」摊开一张素纸：日戳落在今天、贴纸列出来、不预选任何一类', async () => {
    const c = await openBook();
    const area = await openWritePage(c);

    const today = new Date();
    expect(q('.bz-diary-wsp-day .bz-diary-ds-day').textContent).toBe(String(today.getDate()));
    expect(q('.bz-diary-wsp-day .bz-diary-ds-year').textContent).toBe(String(today.getFullYear()));
    expect(q('.bz-diary-wsp-datebtn').textContent).toContain('改日子');
    expect(qa('.bz-diary-wsp-chip').length).toBeGreaterThan(3);
    expect(qa('.bz-diary-wsp-chip.bz-diary-on').length).toBe(0); // 与旧弹窗同口径：默认不选
    // 这张纸不是 StPageFlip 的页：书里的页数一点没变
    expect(lastFlip().items.length).toBe(3);
    await vi.waitFor(() => expect(document.activeElement).toBe(area));
  });

  it('落笔：正文与贴纸进写层（落盘 + 域事件），内页收起、书翻回最新那页', async () => {
    const c = await openBook();
    const area = await openWritePage(c);
    area.value = '今天猫又把杯子推下去了';
    const chip = qa('.bz-diary-wsp-chip').find((el) => (el.textContent || '').includes('日记'))!;
    chip.click();
    expect(chip.classList.contains('bz-diary-on')).toBe(true);

    const before = new Set(Object.keys(fixtureFiles()));
    q('[data-wact="save"]').click();
    await vi.waitFor(() => expect(q('.bz-diary-wsp').hidden).toBe(true));

    const created = [...vault.files.entries()].filter(([p]) => p.startsWith('我的/日记/') && !before.has(p));
    expect(created.length).toBe(1);
    expect(created[0][1]).toContain('今天猫又把杯子推下去了');
    expect(created[0][1]).toContain('日记');
    expect(lastFlip().page).toBe(0); // 新条目是最新那篇：落回第 0 页等回刷把它排进来
  });

  it('空纸落笔 → 「一个字都没写呢」，不落盘、内页不关（字还在纸上等着）', async () => {
    const c = await openBook();
    await openWritePage(c);
    const before = vault.files.size;
    q('[data-wact="save"]').click();
    await vi.waitFor(() => expect(q('.bz-diary-toast').textContent).toContain('一个字都没写呢'));
    expect(vault.files.size).toBe(before);
    expect(q('.bz-diary-wsp').hidden).toBe(false);
  });

  it('写了一半点「揉掉」：先在纸条层问一句，确认了才收纸', async () => {
    const c = await openBook();
    const area = await openWritePage(c);
    area.value = '写了半句';
    q('[data-wact="discard"]').click();
    expect(q('.bz-diary-slip').hidden).toBe(false);
    expect(q('.bz-diary-slip-title').textContent).toContain('还没落笔');
    expect(q('.bz-diary-wsp').hidden).toBe(false); // 还没收：选择权在人手上

    qa('.bz-diary-slip-btn')
      .find((b) => b.textContent === '揉掉')!
      .click();
    expect(q('.bz-diary-wsp').hidden).toBe(true);
    expect(q('.bz-diary-slip').hidden).toBe(true);
    expect(inner(c).draft).toBeNull();
  });

  it('草稿在纸上：滚轮 / 索引行跳转都让路，Esc 只提醒不关册子', async () => {
    const c = await openBook();
    await openWritePage(c);
    const rec = lastFlip();

    q('.bz-diary-book').dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
    expect(rec.page).toBe(0);

    q('.bz-diary-bk-edge').click(); // 抽出册页索引
    qa('.bz-diary-idx-row')[0].click(); // 点一行
    expect(rec.page).toBe(0); // 没翻过去

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(q('.bz-diary-scene').style.display).toBe('flex'); // 册子还开着
    expect(q('.bz-diary-wsp').hidden).toBe(false);
    expect(q('.bz-diary-toast').textContent).toContain('先落笔');
  });

  it('改日子 · 时辰：台历进写作模式（空白日子也能点），「就这天」回写日戳', async () => {
    const c = await openBook();
    await openWritePage(c);
    q('.bz-diary-wsp-datebtn').click();
    expect(q('.bz-diary-cal-pop').hidden).toBe(false);
    expect(q('.bz-diary-cal-time-row').hidden).toBe(false); // 写作模式才有时辰行
    expect(q('.bz-diary-cal-ok').hidden).toBe(false);

    const cells = qa('.bz-diary-cal-cell[data-d]');
    expect(cells.length).toBeGreaterThanOrEqual(28);
    // 写作模式：整月的格子都可点（补写空白日子是常事），跳日模式只给有落笔的那天挂监听
    expect(qa('.bz-diary-cal-cell.bz-diary-pickable').length).toBe(cells.length);
    const blank = cells.find((x) => !x.classList.contains('bz-diary-has'))!;
    blank.click();
    expect(blank.classList.contains('bz-diary-sel')).toBe(true);

    q<HTMLInputElement>('.bz-diary-ct-input').value = '07:05';
    q('.bz-diary-cal-ok').click();
    expect(q('.bz-diary-cal-pop').hidden).toBe(true);
    expect(q('.bz-diary-wsp-day .bz-diary-ds-day').textContent).toBe(String(Number(blank.dataset.d)));
    expect(inner(c).draft?.time).toBe('07:05');
  });

  it('时辰那一行认不出就留在框里报错，日子与时辰都不动（不猜）', async () => {
    const c = await openBook();
    await openWritePage(c);
    const before = inner(c).draft!.time;
    q('.bz-diary-wsp-datebtn').click();
    q<HTMLInputElement>('.bz-diary-ct-input').value = '晌午前后';
    q('.bz-diary-cal-ok').click();
    expect(q('.bz-diary-cal-pop').hidden).toBe(false);
    expect(q('.bz-diary-ct-err').textContent).toContain('没认出来');
    expect(inner(c).draft?.time).toBe(before);
  });

  it('台历跳日模式仍是「只有落过笔的日子可点」，且不显时辰行', async () => {
    await openBook();
    q('.bz-diary-tools [data-tact="calendar"]').click();
    expect(q('.bz-diary-cal-time-row').hidden).toBe(true);
    expect(q('.bz-diary-cal-ok').hidden).toBe(true);
    expect(qa('.bz-diary-cal-cell.bz-diary-pickable').length).toBe(0);
  });

  it('添一件本机媒体：写进 vault 的附件位置，正文里留一条 ![[名字]]（自占一行）', async () => {
    const c = await openBook();
    const app = getAppMockFileManager();
    app.getAvailablePathForAttachment = vi.fn(async (n: string) => `CONFIG/APPENDIX/${n}`);

    const area = await openWritePage(c);
    area.value = '先写一句';
    area.setSelectionRange(area.value.length, area.value.length);

    const file = {
      name: '相纸.png',
      size: 3,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as unknown as File;
    await inner(c).importMedia([file]);

    expect(app.getAvailablePathForAttachment).toHaveBeenCalledWith('相纸.png', '我的/日记/');
    expect(vault.binaryFiles.has('CONFIG/APPENDIX/相纸.png')).toBe(true);
    expect(area.value).toBe('先写一句\n![[相纸.png]]\n');
    expect(getNoticeMessages().join('\n')).toContain('放进册子 1 件');
  });

  it('宿主没有 getAvailablePathForAttachment 时退到日记目录下的「附件/」，并自己避重名', async () => {
    const c = await openBook();
    const area = await openWritePage(c);
    const file = (name: string) =>
      ({ name, size: 1, arrayBuffer: async () => new Uint8Array([1]).buffer }) as unknown as File;

    await inner(c).importMedia([file('相纸.png')]);
    await inner(c).importMedia([file('相纸.png')]);
    expect(vault.binaryFiles.has('我的/日记/附件/相纸.png')).toBe(true);
    expect(vault.binaryFiles.has('我的/日记/附件/相纸_2.png')).toBe(true); // 不覆盖前一件
    expect(area.value).toBe('![[相纸.png]]\n![[相纸_2.png]]\n');
  });
});

describe('DiaryAppController · 开册进度（读全量 → 一次成册）', () => {
  it('读盘进度一路报到 UI：读数与填充跟着 (已读, 总数) 走，装订那一段是 100%', async () => {
    const c = await openBook();
    const priv = inner(c);
    priv.showLoading();
    priv.updateLoading(30, 120);
    expect(q('.bz-diary-ld-count').textContent).toBe('30 / 120 篇');
    expect(q<HTMLElement>('.bz-diary-ld-bar .bz-progress i').style.width).toBe('25%');

    priv.setLoadingBinding();
    expect(q('.bz-diary-ld-title').textContent).toBe('正在装订…');
    expect(q<HTMLElement>('.bz-diary-ld-bar .bz-progress i').style.width).toBe('100%');
    expect(q('.bz-diary-ld-count').textContent).toContain('则');

    priv.hideLoading();
    expect(q('.bz-diary-loading').hidden).toBe(true);
  });

  it('读盘每批都向订阅者报一次进度，末次 = 读到的全量（进度条的唯一数据源）', async () => {
    const { onWallProgress } = await import('../../src/diary/data');
    const seen: [number, number][] = [];
    const off = onWallProgress((done, total) => seen.push([done, total]));
    try {
      await openBook();
    } finally {
      off();
    }
    expect(seen.length).toBeGreaterThan(0);
    const [done, total] = seen[seen.length - 1];
    expect(total).toBeGreaterThan(0);
    expect(done).toBe(total); // 末尾那一批读完 = 全量到位
  });

  it('成册之后进度纸条收起（不挡着书）', async () => {
    await openBook();
    expect(q('.bz-diary-loading').hidden).toBe(true);
  });
});


/**
 * 日记本书页界面（ADR-0230）· 条目动作与媒体回归。
 *
 * 与 `ui-book.test.ts` 的分工：那边管**结构**（分页/建书/文具/菜单分流），这边管**动作的细枝末节**——
 * 复制双链的三种分流、加密/取出的守卫与失败分支、撕掉的确认对象、媒体失败态与显影、
 * 录音卡「一次只放一段」、`[[双链]]` 跳转、那年今天的明信片、浮层 Esc 栈的顺序。
 *
 * 淘汰自回忆墙版的同名文件（ADR-0230 决策 7）：旧版整套断言挂在 `.bz-diary-desk` /
 * `.bz-diary-mob` / `.bz-item-menu` / `openManager()` 上，那些对象已随墙退役。
 */
import { describe, expect, it, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { DiaryAppController } from '../../src/diary/ui';
import { resetFlips, lastFlip } from './page-flip-fake';
import type { WallEntry } from '../../src/diary/types';

vi.mock('../../src/diary/vendor/page-flip.browser.js', async () => {
  const mod = await import('./page-flip-fake');
  return { PageFlip: mod.FakePageFlip };
});

const mocks = vi.hoisted(() => ({
  openAddDialog: vi.fn(),
  showTagPicker: vi.fn(),
  hideAddDialog: vi.fn(),
  hideTagPicker: vi.fn(),
  copyDiaryLink: vi.fn(async () => {}),
  showConfirm: vi.fn(),
  openFlowDialog: vi.fn(async (): Promise<string | undefined> => 'ok'),
  /** 保险箱状态可控：默认是已解锁，只有「没解锁」那条用例临时翻成 false */
  getSafeManager: vi.fn(
    () => ({ unlocked: true, manifest: null, unlock: mocks.safeUnlock }) as unknown
  ),
  safeUnlock: vi.fn(async () => true),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<any[]> => []),
  encryptEntry: vi.fn(async (): Promise<any> => ({ encrypted: true, noteId: 'note-1' })),
  reclassifyEntry: vi.fn(async (): Promise<boolean> => true),
  deleteEncryptedEntry: vi.fn(async () => {}),
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
vi.mock('../../src/encrypt', () => ({
  openEncrypt: vi.fn(),
  getSafeManager: () => mocks.getSafeManager(),
}));
vi.mock('../../src/diary/encrypt', () => ({
  ENCRYPT_TAG: '加密',
  isUnlocked: mocks.isUnlocked,
  loadEncryptedEntries: mocks.loadEncryptedEntries,
  encryptEntry: mocks.encryptEntry,
  reclassifyEntry: mocks.reclassifyEntry,
  deleteEncryptedEntry: mocks.deleteEncryptedEntry,
}));

// ===== 夹具 =====

const DIARY_PATH = '我的/日记/2608192302.md';
const MOVIE_PATH = '我的/影视/film.md';
const NOTE_PATH = '笔记/某笔记.md';

/** 「那年今天」需要一个**去年的今天**（跨年命中；当年写的条目会被 pickOnThisDay 排除） */
function lastYearSameDay(): string {
  const d = new Date();
  return `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 去年那则的**条目文件路径**：日记目录下一目一文件、题目是 `YYMMDDHHmm` 简写 */
function lastYearSameDayPath(): string {
  const [y, m, d] = lastYearSameDay().split('-');
  return `我的/日记/${y.slice(2)}${m}${d}0900.md`;
}

let vault: MockVault;
let openFile: ReturnType<typeof vi.fn>;

function fixtureFiles(): Record<string, string> {
  return {
    // 正文里带「照片 + 录音 + 双链」，一条夹具覆盖后面几族断言
    [DIARY_PATH]: serializeDiaryEntryFile(
      { date: '2026-08-19', time: '23:02' },
      ['日记'],
      `被猫盯着\n\n![[cat.jpg]]\n\n![[voice.m4a]]\n\n见 [[${NOTE_PATH.replace(/\.md$/, '')}]]`
    ),
    [lastYearSameDayPath()]: serializeDiaryEntryFile({ date: lastYearSameDay(), time: '09:00' }, ['日记'], '去年的今天在下雨'),
    // 双链的落点：`[[笔记/某笔记]]` 要真能解析到一篇笔记，才测得到 openFile 那条路
    [NOTE_PATH]: ['---', 'title: 某笔记', '---', '', '落点'].join('\n'),
    // 带海报的票根：`.bz-diary-tk-poster` 是 `img[data-media-err]`，是媒体失败态换类的样本
    [MOVIE_PATH]: [
      '---',
      '影评: 好看',
      '观影日期: 2026-08-19',
      '海报: poster.png',
      'tags: [电影]',
      '---',
      '',
    ].join('\n'),
  };
}

beforeAll(() => {
  if (typeof Element.prototype.animate !== 'function') {
    (Element.prototype as unknown as { animate: () => unknown }).animate = () => ({
      finished: Promise.resolve(),
      cancel: () => {},
    });
  }
  // jsdom 不实现媒体播放：给桩，才能断言「一次只放一段」这类编排
  HTMLMediaElement.prototype.play = vi.fn(async () => {}) as unknown as HTMLMediaElement['play'];
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause'];
});

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetObsidianMocks();
  resetFlips();
  applyDirectories({});
  for (const fn of Object.values(mocks)) fn.mockClear();
  mocks.openFlowDialog.mockResolvedValue('ok');
  // mockClear 不清 mockReturnValue：解锁态默认值每用例复位（「没解锁」那条会临时翻 false）
  mocks.getSafeManager.mockReturnValue({ unlocked: true, manifest: null, unlock: mocks.safeUnlock });
  mocks.encryptEntry.mockResolvedValue({ encrypted: true, noteId: 'note-1' });
  mocks.isUnlocked.mockReturnValue(false);
  mocks.loadEncryptedEntries.mockResolvedValue([]);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(async () => {}) },
    configurable: true,
  });

  vault = new MockVault();
  for (const [p, c] of Object.entries(fixtureFiles())) vault.files.set(p, c);
  const app = mockAppWithVault(vault);
  // 共享 mock 未实现的两条 Obsidian API（双链跳转与资源路径）
  (app.metadataCache as any).getFirstLinkpathDest = (link: string) => {
    const exact = vault.getAbstractFileByPath(link.endsWith('.md') ? link : link + '.md');
    if (exact && !exact.children) return exact;
    const name = link.split('/').pop()!.toLowerCase();
    return vault.getFiles().find((f: any) => (f.name || '').replace(/\.md$/, '').toLowerCase() === name) ?? null;
  };
  openFile = vi.fn(async () => {});
  (app.workspace as any).getLeaf = () => ({ openFile });
  setApp(app);
});

afterEach(() => {
  DiaryAppController.instance?.cleanup();
  DiaryAppController.instance = null;
  document.body.innerHTML = '';
});

async function openBook(): Promise<DiaryAppController> {
  const c = DiaryAppController.getInstance();
  c.show();
  await vi.waitFor(() => expect(document.querySelectorAll('.bz-diary-page-item').length).toBeGreaterThan(0));
  return c;
}

const q = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

/** 打开某则条目的便签（`data-eid` 落在块根上） */
function openMenuFor(sel: string): void {
  const block = q(sel).closest<HTMLElement>('[data-eid]')!;
  block.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 30 }));
  expect(q('.bz-diary-menu').hidden).toBe(false);
}

function menuAct(act: string): HTMLElement {
  return q(`.bz-diary-menu .bz-diary-mn-item[data-act="${act}"]`);
}

// ============================================================
//  复制双链：三种分流
// ============================================================

describe('誊录位置（复制双链）', () => {
  it('普通日记条目 → 交本域 copyDiaryLink（带 filename/workfilePath/emoji/time）', async () => {
    await openBook();
    openMenuFor('.bz-diary-b-para');
    menuAct('copylink').click();
    await vi.waitFor(() => expect(mocks.copyDiaryLink).toHaveBeenCalledTimes(1));
    expect(mocks.copyDiaryLink).toHaveBeenCalledWith({
      filename: DIARY_PATH,
      filePath: DIARY_PATH,
      emoji: '📖',
      time: '23:02',
    });
  });

  it('影视/信/书条目 → 本地拼文件级双链，不走 entry-actions（那边要日记 state）', async () => {
    await openBook();
    openMenuFor('.bz-diary-ticket');
    menuAct('copylink').click();
    await vi.waitFor(() => expect((navigator.clipboard.writeText as any).mock.calls.length).toBeGreaterThan(0));
    expect((navigator.clipboard.writeText as any).mock.calls[0][0]).toBe('[[我的/影视/film]]');
    expect(mocks.copyDiaryLink).not.toHaveBeenCalled();
  });

  it('加密条目无 md 锚点 → 复制正文本身', async () => {
    const c = await openBook();
    await (c as unknown as { copyLink: (e: WallEntry) => Promise<void> }).copyLink({
      date: '2026-08-10',
      time: '21:00',
      tags: ['日记', '加密'],
      emoji: '🔐',
      content: '密文正文',
      filename: 'vault/x',
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: '密文正文',
      segments: [],
      encrypted: true,
      noteId: 'note-9',
    });
    expect((navigator.clipboard.writeText as any).mock.calls[0][0]).toBe('密文正文');
    expect(getNoticeMessages().join('\n')).toContain('已复制加密日记正文');
    expect(mocks.copyDiaryLink).not.toHaveBeenCalled();
  });

  it('找不到原文（无 filename / filePath）→ 只提示，不写剪贴板', async () => {
    const c = await openBook();
    await (c as unknown as { copyLink: (e: WallEntry) => Promise<void> }).copyLink({
      date: '2026-08-19',
      time: '00:00',
      tags: ['日记'],
      emoji: '📖',
      content: 'x',
      filename: '',
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: 'x',
      segments: [],
    });
    expect(getNoticeMessages().join('\n')).toContain('找不到原文');
    expect((navigator.clipboard.writeText as any).mock.calls.length).toBe(0);
  });
});

// ============================================================
//  收进信封 / 从信封取出：守卫与失败分支
// ============================================================

describe('收进信封（加密）的守卫与失败分支', () => {
  it('非日记条目直接早退（影视/信/书没有加密入口，入库语义错位）', async () => {
    const c = await openBook();
    await (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction({
      date: '2026-08-19',
      time: '00:00',
      tags: ['电影'],
      emoji: '🎬',
      content: 'x',
      filename: MOVIE_PATH,
      lineNumber: 0,
      kind: 'movie',
      media: [],
      text: 'x',
      segments: [],
    });
    expect(mocks.getSafeManager).not.toHaveBeenCalled();
    expect(mocks.openFlowDialog).not.toHaveBeenCalled();
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
  });

  it('保险箱没解锁：弹本域火漆密码框候着，点了「算了」就原地退出（没弹二次确认、没动文件）', async () => {
    const c = await openBook();
    mocks.getSafeManager.mockReturnValue({ unlocked: false, manifest: null, unlock: mocks.safeUnlock });
    const p = (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction({
      date: '2026-08-19',
      time: '23:02',
      tags: ['日记'],
      emoji: '📖',
      content: 'x',
      filename: DIARY_PATH,
      filePath: DIARY_PATH,
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: 'x',
      segments: [],
    });
    // 未解锁时不该直接走写层：先摆密码框，二次确认框得等密码过了才轮到
    await vi.waitFor(() => expect(q('.bz-diary-pass').hidden).toBe(false));
    expect(mocks.openFlowDialog).not.toHaveBeenCalled();
    expect(vault.files.has(DIARY_PATH)).toBe(true);
    q('.bz-diary-pass-btn[data-pact="cancel"]').click();
    await p;
    expect(q('.bz-diary-pass').hidden).toBe(true);
    expect(mocks.openFlowDialog).not.toHaveBeenCalled();
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
    expect(vault.files.has(DIARY_PATH)).toBe(true);
  });

  it('保险箱没解锁时填对主密码 → 放行（密码交给真保险箱校验，本域只收字符串）', async () => {
    const c = await openBook();
    mocks.getSafeManager.mockReturnValue({ unlocked: false, manifest: null, unlock: mocks.safeUnlock });
    const p = (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction({
      date: '2026-08-19',
      time: '23:02',
      tags: ['日记'],
      emoji: '📖',
      content: 'x',
      filename: DIARY_PATH,
      filePath: DIARY_PATH,
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: 'x',
      segments: [],
    });
    await vi.waitFor(() => expect(q('.bz-diary-pass').hidden).toBe(false));
    (q('.bz-diary-pass-input') as HTMLInputElement).value = '主密码-123';
    q('.bz-diary-pass-btn[data-pact="ok"]').click();
    await p;
    expect(mocks.safeUnlock).toHaveBeenCalledWith('主密码-123');
    expect(q('.bz-diary-pass').hidden).toBe(true);
    expect(mocks.encryptEntry).toHaveBeenCalled();
  });

  it('磁盘上找不到原文条目 → 提示并不入库', async () => {
    const c = await openBook();
    await (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction({
      date: '2026-01-01',
      time: '00:00',
      tags: ['日记'],
      emoji: '📖',
      content: 'x',
      filename: '我的/日记/2601010000.md',
      filePath: '我的/日记/2601010000.md',
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: 'x',
      segments: [],
    });
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
    expect(getNoticeMessages().join('\n')).toContain('找不到原文条目');
  });

  it('密文入库失败（encryptEntry 返回 null）→ 不动原文', async () => {
    const c = await openBook();
    mocks.encryptEntry.mockResolvedValue(null);
    await (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction({
      date: '2026-08-19',
      time: '23:02',
      tags: ['日记'],
      emoji: '📖',
      content: 'x',
      filename: DIARY_PATH,
      filePath: DIARY_PATH,
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: 'x',
      segments: [],
    });
    expect(vault.files.has(DIARY_PATH)).toBe(true);
    expect(mocks.deleteEncryptedEntry).not.toHaveBeenCalled();
  });
});

describe('从信封取出（解密）的守卫', () => {
  it('reclassifyEntry 抛错 → 提示主密码有问题且密文未受影响（不广播解密事件）', async () => {
    const c = await openBook();
    mocks.reclassifyEntry.mockRejectedValue(new Error('wrong password'));
    await (c as unknown as { decryptEntryAction: (e: WallEntry) => Promise<void> }).decryptEntryAction({
      date: '2026-08-10',
      time: '21:00',
      tags: ['日记', '加密'],
      emoji: '🔐',
      content: 'x',
      filename: 'vault/x',
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: 'x',
      segments: [],
      encrypted: true,
      noteId: 'note-9',
    });
    expect(getNoticeMessages().join('\n')).toContain('取出失败：主密码可能不正确');
  });

  it('「拆信看」在册面上找不到信封（纸已被重排掉）→ 直接把全文摊在抽出的纸上', async () => {
    const c = await openBook();
    (c as unknown as { unsealEntry: (e: WallEntry) => void }).unsealEntry({
      date: '2026-08-10',
      time: '21:00',
      tags: ['日记', '加密'],
      emoji: '🔐',
      content: '藏在信封里的话',
      filename: 'vault/x',
      lineNumber: 0,
      kind: 'diary',
      media: [],
      text: '藏在信封里的话',
      segments: [{ kind: 'text', text: '藏在信封里的话' }],
      encrypted: true,
      noteId: 'note-9',
      id: 'enc-not-on-page',
    });
    expect(q('.bz-diary-sheet').hidden).toBe(false);
    expect(q('.bz-diary-sheet-body').textContent).toContain('藏在信封里的话');
  });
});

// ============================================================
//  媒体：显影 / 失败态 / 录音卡 / 双链
// ============================================================

describe('媒体失败态与显影', () => {
  it('票根海报加载失败 → 换成占位类并摘掉 src（走 data-media-err，零内联样式）', async () => {
    await openBook();
    const poster = q<HTMLImageElement>('.bz-diary-tk-poster');
    expect(poster.tagName).toBe('IMG');
    expect(poster.dataset.mediaErr).toBe('bz-diary-ph-empty');
    poster.dispatchEvent(new Event('error'));
    expect(poster.className).toBe('bz-diary-ph-empty');
    expect(poster.getAttribute('src')).toBeNull();
    expect(poster.hasAttribute('data-media-err')).toBe(false); // 只换一次
  });

  it('正文照片加载失败 → 相纸位留一句「相片未冲出」', async () => {
    await openBook();
    const img = q<HTMLImageElement>('.bz-diary-ph-media img');
    img.dispatchEvent(new Event('error'));
    expect(q('.bz-diary-ph-media .bz-diary-ph-empty').textContent).toBe('相片未冲出');
    expect(q('.bz-diary-ph-media img')).toBeNull();
  });

  it('正文照片加载成功 → 加上显影类（药水里浮出来）', async () => {
    await openBook();
    const img = q<HTMLImageElement>('.bz-diary-ph-media img');
    img.dispatchEvent(new Event('load'));
    expect(img.classList.contains('bz-diary-develop')).toBe(true);
  });

  it('录音卡：自绘键驱动播/停，换一张卡前面那段自己停', async () => {
    const c = await openBook();
    // 另一则也带录音，凑出两张卡
    vault.files.set(
      '我的/日记/2608180900.md',
      serializeDiaryEntryFile({ date: '2026-08-18', time: '09:00' }, ['日记'], '昨天\n\n![[another.m4a]]')
    );
    await (c as unknown as { loadAndRelayout: () => Promise<void> }).loadAndRelayout();

    const cards = Array.from(document.querySelectorAll<HTMLElement>('.bz-diary-ba-card'));
    expect(cards.length).toBe(2);
    const audios = Array.from(document.querySelectorAll<HTMLAudioElement>('.bz-diary-b-audio audio'));
    expect(audios.length).toBe(2);

    cards[0].click(); // 播放第一张
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    // jsdom 不会真的播放，故手动补一发 play 事件：自绘键的换标与播放态由它驱动
    audios[0].dispatchEvent(new Event('play'));
    expect(cards[0].querySelector('.bz-diary-ba-play')!.textContent).toBe('❚❚');
    expect(cards[0].closest('.bz-diary-b-audio')!.classList.contains('bz-diary-playing')).toBe(true);

    cards[1].click(); // 换第二张：第一张应被暂停
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    audios[0].dispatchEvent(new Event('pause'));
    expect(cards[0].closest('.bz-diary-b-audio')!.classList.contains('bz-diary-playing')).toBe(false);
  });
  it('「放不出」的录音：timeupdate 时（时长未知）只显示已播时长', async () => {
    await openBook();
    const audio = q<HTMLAudioElement>('.bz-diary-b-audio audio');
    Object.defineProperty(audio, 'duration', { value: NaN, configurable: true });
    Object.defineProperty(audio, 'currentTime', { value: 12, configurable: true });
    audio.dispatchEvent(new Event('timeupdate'));
    expect(q('.bz-diary-ba-time').textContent).toBe('0:12');

    audio.dispatchEvent(new Event('error'));
    expect(q('.bz-diary-ba-time').textContent).toBe('放不出');
  });
});

describe('纸上的 [[双链]]', () => {
  it('点它跳原文（workspace.getLeaf → openFile）', async () => {
    await openBook();
    const wl = q('.bz-diary-wikilink');
    expect(wl.dataset.target).toBe('笔记/某笔记');
    wl.click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
    expect(openFile.mock.calls[0][0].path).toBe(NOTE_PATH);
  });

  it('目标解析不到 → 只在纸上提示，不抛', async () => {
    await openBook();
    const wl = q('.bz-diary-wikilink');
    wl.dataset.target = '不存在/的笔记';
    wl.click();
    expect(q('.bz-diary-toast').textContent).toContain('找不到');
    expect(openFile).not.toHaveBeenCalled();
  });
});

// ============================================================
//  那年今天（明信片）—— 整件退役
// ============================================================
/* 明信片是开册就往桌上摆的非请求物件，与「只要日记本本身」冲突，随 ADR-0230 追加拍板退役：
   标记（.bz-diary-postcard）、逻辑（checkOnThisDay）与用例在本轮一并摘除。
   反向钉死一处：域内不得再出现这张明信片（防有人按旧稿恢复）。 */
describe('那年今天', () => {
  it('明信片已退役：开册不摆明信片，控制器也不再有 checkOnThisDay', async () => {
    await openBook();
    expect(document.querySelector('.bz-diary-postcard')).toBeNull();
    expect(document.querySelector('.bz-diary-hint')).toBeNull();
    const proto = DiaryAppController.prototype as unknown as Record<string, unknown>;
    expect(proto.checkOnThisDay).toBeUndefined();
  });
});

// ============================================================
//  Esc 栈：一个 Esc 只收一层
// ============================================================

describe('Esc 栈顺序', () => {
  it('贴纸册 → 台历 → 抽出的纸 → 便签，各收一层；都收干净后翻回最新', async () => {
    const c = await openBook();
    const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const album = q('.bz-diary-album-pop');
    const cal = q('.bz-diary-cal-pop');
    const sheet = q('.bz-diary-sheet');
    const menu = q('.bz-diary-menu');

    (c as unknown as { openAlbum: () => void }).openAlbum();
    (c as unknown as { openCal: () => void }).openCal();
    (c as unknown as { openSheet: (t: string, s: string) => void }).openSheet('标题', '正文');
    openMenuFor('.bz-diary-b-para');
    expect([album.hidden, cal.hidden, sheet.hidden, menu.hidden]).toEqual([false, false, false, false]);

    esc();
    expect(album.hidden).toBe(true); // 贴纸册在最上
    esc();
    expect(cal.hidden).toBe(true);
    esc();
    expect(sheet.hidden).toBe(true);
    esc();
    expect(menu.hidden).toBe(true);

    // 最后一个 Esc：没有浮层了 → 翻回最新那页
    (c as unknown as { jumpToPage: (n: number) => void }).jumpToPage(2);
    esc();
    expect(lastFlip().page).toBe(0);
    expect(q('.bz-diary-toast').textContent).toContain('翻到最新');
  });
});

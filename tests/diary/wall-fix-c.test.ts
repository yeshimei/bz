/**
 * diary 修复批 C：墙面板（ui.ts/render.ts/entry-actions.ts）bug + 体验全家桶回归。
 * 逐条对号钉死：
 * - P2 D-UI1  抽屉缩略点击先关抽屉再开灯箱（灯箱被 body 级抽屉盖住的「点击无反应」）
 * - P2 效率#12 加密动作二次确认（取消不放行 / 确认放行；文案带条目标识 + danger 中性主钮标记）
 * - func N10   灯箱序列落空覆盖前存 _lbSeqMain（连看不再退化为单条）
 * - all2 D6'   灯箱会话代次：关灯箱立刻重开，旧慢解密 promise 不穿透新灯箱
 * - all2 D7'   灯箱开着时 renderWall 暂缓重建 _lbSeq（步进不落错媒体）
 * - arch A2    加密/解密成功补发 diary:entry-deleted / diary:entry-decrypted 域事件
 * - arch A4    v2「日期.md」路径兜底退役：异常条目显式报「找不到原文」，不拼幽灵路径
 * - 效率#6     range 文案带筛选态 + 「✕ 清除」胶囊 + 「今天」钮
 * - 效率#8     搜索增量显隐（DOM 探针证明未整墙重建；空结果才重建）
 * - 效率#9     搜索命中词 <mark> 高亮（DOM 形态断言）
 * - 效率#13    loadAndRender 期间骨架占位（DOM 形态断言）
 * - 效率#14    读墙失败空态分流错误态 + 重试（DOM 形态断言）
 * - 一致#4     空态接 core uiEmpty 单源（.bz-empty），域内 .bz-diary-empty 家族样式已删
 * - D-UI3      搜索防抖收起/ESC 取消尾触（关键词不「复活」）
 * - D-UI4      灯箱 touchstart 过滤媒体原生控件（拖进度条不再切图）
 * - D-UI6      头行钮/chips/subchips/时光条卡不再挂 bz-touch-target--xl
 * - func N5    vault create（外部新建/移入条目文件）防抖回刷上墙
 * - all2 D8'   ESC 分流探测抽屉 DOM，core 路径关闭后 sheetEntry 残留不再空消费
 * - all2 D9'   show()/loadAndRender 按真实锁态重置 lockedVisible
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp } from '../../src/core/app';
import { applyDirectories, emojiToTagMap } from '../../src/diary/config';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { DiaryAppController } from '../../src/diary/ui';
import { jumpToDiaryEntry } from '../../src/diary/ui/entry-actions';
import { onDomainEvent } from '../../src/core/domain-bus';

function seed(date: string, time: string, emojiSeq: string, body: string): string {
  const tags: string[] = [];
  for (const ch of Array.from(emojiSeq)) {
    const t = (emojiToTagMap as Record<string, string>)[ch];
    if (t && !tags.includes(t)) tags.push(t);
  }
  if (!tags.length) tags.push('日记');
  return serializeDiaryEntryFile({ date, time }, tags, body);
}

const mocks = vi.hoisted(() => ({
  mediaSrc: vi.fn((_app: any, name: string) => `https://example.com/vault/${encodeURI(name)}`),
  loadWallEntries: vi.fn(),
  openAddDialog: vi.fn(),
  showTagPicker: vi.fn(),
  jumpToEntry: vi.fn(),
  copyDiaryLink: vi.fn(async () => {}),
  showConfirm: vi.fn(),
  openFlowDialog: vi.fn(async (_opts?: any): Promise<string | undefined> => 'ok'),
  ensureSafeUnlocked: vi.fn(async () => true),
  openEncrypt: vi.fn(),
  getSafeManager: vi.fn(() => ({ unlocked: false, manifest: { notes: [] } })),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<any[]> => []),
  deleteEncryptedEntry: vi.fn(async () => {}),
  encryptEntry: vi.fn(async (_e: any) => ({ encrypted: true, noteId: 'note-c' })),
  reclassifyEntry: vi.fn(async (): Promise<boolean> => true),
}));

// 效率#13 需要 loadWallEntries 可控（慢 promise / 抛错）——partial mock 保留其余纯函数。
// 容器须放 vi.hoisted（vi.mock 工厂 hoist 早于模块顶层 let 声明，直接闭包引用会 TDZ）
const holder = vi.hoisted(() => ({
  actualLoad: null as ((app: any) => Promise<any[]>) | null,
}));
vi.mock('../../src/diary/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary/data')>();
  holder.actualLoad = actual.loadWallEntries;
  return {
    ...actual,
    mediaSrc: mocks.mediaSrc,
    loadWallEntries: (...args: [any]) => mocks.loadWallEntries(...args),
  };
});
vi.mock('../../src/diary/ui/dialogs', () => ({
  openAddDialog: mocks.openAddDialog,
  showTagPicker: mocks.showTagPicker,
}));
// partial mock：jumpToDiaryEntry/copyDiaryLink 默认走真实现（A4 直测），spy 断言时换 mock
vi.mock('../../src/diary/ui/entry-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary/ui/entry-actions')>();
  return {
    ...actual,
    copyDiaryLink: mocks.copyDiaryLink,
    showConfirm: mocks.showConfirm,
  };
});
vi.mock('../../src/core/flow-dialog', () => ({
  openFlowDialog: mocks.openFlowDialog,
}));
vi.mock('../../src/encrypt', () => ({
  ensureSafeUnlocked: mocks.ensureSafeUnlocked,
  openEncrypt: mocks.openEncrypt,
  getSafeManager: mocks.getSafeManager,
}));
vi.mock('../../src/diary/encrypt', () => ({
  isUnlocked: mocks.isUnlocked,
  loadEncryptedEntries: mocks.loadEncryptedEntries,
  encryptEntry: mocks.encryptEntry,
  reclassifyEntry: mocks.reclassifyEntry,
  deleteEncryptedEntry: mocks.deleteEncryptedEntry,
}));

let vault: MockVault;

async function waitFor(fn: () => boolean, timeout = 2000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function openAndWait() {
  const c = DiaryAppController.getInstance();
  await c.openManager();
  await waitFor(() => !!document.querySelector('.bz-diary-day-head'));
  return c;
}

beforeEach(async () => {
  document.body.innerHTML = '';
  clearNotices();
  resetObsidianMocks();
  applyDirectories({});
  for (const fn of Object.values(mocks)) fn.mockClear();
  mocks.openFlowDialog.mockImplementation(async () => 'ok');
  mocks.isUnlocked.mockReturnValue(false);
  mocks.loadEncryptedEntries.mockResolvedValue([]);
  mocks.encryptEntry.mockResolvedValue({ encrypted: true, noteId: 'note-c' });
  mocks.reclassifyEntry.mockResolvedValue(true);
  mocks.getSafeManager.mockImplementation(() => ({ unlocked: false, manifest: { notes: [] } }));
  mocks.loadWallEntries.mockImplementation(async (app: any) => holder.actualLoad!(app));
  vault = new MockVault();
  vault.files.set(
    '我的/日记/2608192302.md',
    seed('2026-08-19', '23:02', '📖', '上厕所时被猫盯着。\n![[IMG_20260819_164331.jpg]]\n![[VID_20260819_231437.mp4]]')
  );
  vault.files.set('我的/日记/2606112129.md', seed('2026-06-11', '21:29', '📸', '![[IMG_20260611_211240.jpg]]'));
  vault.files.set(
    '我的/日记/2606122033.md',
    seed('2026-06-12', '20:33', '🤝', '"又有了新的小想法。"一首新的诗朗诵。')
  );
  setApp(mockAppWithVault(vault));
});

afterEach(() => {
  DiaryAppController.instance?.cleanup();
  DiaryAppController.instance = null;
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function deskEl(sel: string): HTMLElement {
  return document.querySelector<HTMLElement>(`.bz-diary-desk ${sel}`)!;
}

describe('P2 D-UI1：抽屉缩略图点击先关抽屉再开灯箱', () => {
  it('点抽屉头缩略图：.bz-item-sheet 移除 + 灯箱 --show（旧实现灯箱被抽屉盖住点击无反应）', async () => {
    const c = await openAndWait();
    const entry = (c as any)._wallEntries.find((e: any) => e.media.length);
    expect(entry).toBeTruthy();
    (c as any).openSheet(entry);
    expect(document.querySelector('.bz-item-sheet')).toBeTruthy();
    const thumb = document.querySelector<HTMLElement>('.bz-diary-sheet-thumb')!;
    expect(thumb).toBeTruthy();
    // core openItemSheet 有 400ms 触屏静置窗口（吞开浮层瞬间的残余 click）——
    // 真机长按到点缩略图远超窗口，这里等窗口过掉再点
    await new Promise((r) => setTimeout(r, 430));
    thumb.click();
    // 先关抽屉（core closeItemMenu 幂等移除）——sheetEntry 一并复位
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect((c as any).sheetEntry).toBeNull();
    // 灯箱在面板实例内打开且不被盖住语义成立（先收抽屉）
    expect(deskEl('.bz-diary-lb.bz-diary-lb--show')).toBeTruthy();
  });
});

describe('P2 效率#12 + arch A2：加密二次确认与域事件', () => {
  it('加密前弹 openFlowDialog：取消不放行（条目原样），确认才加密', async () => {
    const c = await openAndWait();
    const entry = (c as any)._wallEntries.find((e: any) => e.kind === 'diary');
    // 取消：确认框文案带条目标识、主钮 danger+cta（中性主钮口径）；加密链路不执行
    mocks.openFlowDialog.mockResolvedValueOnce('cancel');
    await (c as any).encryptEntryAction(entry);
    expect(mocks.openFlowDialog).toHaveBeenCalledTimes(1);
    const opts = mocks.openFlowDialog.mock.calls[0][0];
    expect(opts.message).toContain('移入保险库');
    expect(opts.message).toContain(entry.date);
    expect(opts.message).toContain(entry.time);
    expect(opts.message).toContain('不再保留明文');
    const okAct = opts.actions.find((a: any) => a.value === 'ok');
    expect(okAct.label).toBe('加密');
    expect(okAct.cta).toBe(true);
    expect(okAct.danger).toBe(true);
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
    expect(vault.files.has('我的/日记/2608192302.md')).toBe(true);
    // 确认：走完整加密链路（写层反查入库 + 摘除原条目文件）
    await (c as any).encryptEntryAction(entry);
    await waitFor(() => vault.files.get('我的/日记/2608192302.md') === undefined);
    expect(mocks.encryptEntry).toHaveBeenCalledTimes(1);
  });

  it('A2：加密成功可观测 diary:entry-deleted、解密成功可观测 diary:entry-decrypted', async () => {
    const deleted: any[] = [];
    const decrypted: any[] = [];
    const off1 = onDomainEvent('diary:entry-deleted', (e) => deleted.push(e));
    const off2 = onDomainEvent('diary:entry-decrypted', (e) => decrypted.push(e));
    try {
      const c = await openAndWait();
      const entry = (c as any)._wallEntries.find((e: any) => e.kind === 'diary');
      await (c as any).encryptEntryAction(entry); // openFlowDialog 默认 'ok'
      await waitFor(() => deleted.length > 0);
      expect(deleted[0]).toMatchObject({ date: entry.date, time: entry.time });
      const encEntry = { ...entry, noteId: 'note-a2', tags: ['日记', '加密'], encrypted: true };
      await (c as any).decryptEntryAction(encEntry);
      await waitFor(() => decrypted.length > 0);
      expect(decrypted[0]).toMatchObject({ noteId: 'note-a2', date: entry.date });
    } finally {
      off1();
      off2();
    }
  });
});

describe('N10 + D6\' + D7\'：灯箱序列三件套', () => {
  it('N10：openLightbox 落空先存 _lbSeqMain，关灯箱还原主序列', async () => {
    const c = await openAndWait();
    const seqMain = (c as any)._lbSeq as any[];
    expect(seqMain.length).toBeGreaterThan(1);
    const ghost = { ...seqMain[0].entry }; // 引用不同 → findIndex 落空（后台重渲染后的抽屉入口）
    (c as any).openLightbox({ name: 'ghost.jpg', kind: 'img' }, ghost);
    expect((c as any)._lbSeqMain).toBe(seqMain);
    expect((c as any)._lbSeq.length).toBe(1);
    (c as any).closeLightbox();
    expect((c as any)._lbSeq).toBe(seqMain);
    expect((c as any)._lbSeqMain).toBeNull();
  });

  it("D6'：关灯箱立刻重开，旧会话慢解密 promise 不穿透新灯箱", async () => {
    let resolveSlow!: (v: string) => void;
    const slowP = new Promise<string>((r) => (resolveSlow = r));
    mocks.isUnlocked.mockReturnValue(true);
    const c = await openAndWait();
    const encEntry: any = {
      date: '2026-08-19',
      time: '23:02',
      tags: ['日记', '加密'],
      emoji: '📖',
      content: '加密正文',
      text: '加密正文',
      segments: [],
      filename: 'enc.md',
      filePath: '我的/日记/enc.md',
      lineNumber: 0,
      id: 'x',
      noteId: 'enc-1',
      encrypted: true,
      kind: 'diary' as const,
      media: [
        { name: 'enc1.jpg', kind: 'img' as const },
        { name: 'enc2.jpg', kind: 'img' as const },
      ],
    };
    // 预填解密缓存（D6' 测的是 fillLbMedia 的会话代次拦截，不经 decryptEncMedia 动态 import）：
    // enc1 = 挂起的慢 promise（旧会话），enc2 = 已就绪的新媒体
    (c as any).encMediaCache.set('enc-1|img|enc1.jpg', slowP.then((v: string) => `data:image/jpeg;base64,${v}`));
    (c as any).encMediaCache.set('enc-1|img|enc2.jpg', Promise.resolve('data:image/jpeg;base64,YmFy'));
    // 第一会话：enc1.jpg 慢解密挂起
    (c as any).openLightbox({ name: 'enc1.jpg', kind: 'img' }, encEntry);
    expect(deskEl('.bz-diary-lbmedia .bz-diary-lb-pending')).toBeTruthy();
    // 立刻关闭重开第二会话（同下标 0，不同媒体名）：gen 递增
    (c as any).closeLightbox();
    (c as any).openLightbox({ name: 'enc2.jpg', kind: 'img' }, encEntry);
    await waitFor(() => !!deskEl('.bz-diary-lbmedia img'));
    const img = deskEl('.bz-diary-lbmedia img') as HTMLImageElement;
    expect(img.src).toContain('YmFy'); // 第二会话媒体先落地
    // 旧会话慢解密晚到：必须被会话代次拦下，不得覆盖新灯箱
    resolveSlow('Zm9v');
    await new Promise((r) => setTimeout(r, 30));
    expect((deskEl('.bz-diary-lbmedia img') as HTMLImageElement).src).toContain('YmFy');
  });

  it("D7'：灯箱开着时 renderWall 暂缓重建 _lbSeq，关闭后恢复重建", async () => {
    const c = await openAndWait();
    const seqBefore = (c as any)._lbSeq;
    (c as any).desk.lb.classList.add('bz-diary-lb--show'); // 灯箱可见
    c.renderAll();
    expect((c as any)._lbSeq).toBe(seqBefore); // 暂缓重建
    (c as any).desk.lb.classList.remove('bz-diary-lb--show');
    c.renderAll();
    expect((c as any)._lbSeq).not.toBe(seqBefore); // 正常重建
  });
});

describe('arch A4：v2「日期.md」路径兜底退役', () => {
  it('异常条目（无 filePath/filename）动作显式报「找不到原文」，不拼幽灵路径', async () => {
    const c = await openAndWait();
    clearNotices();
    const ghost = {
      date: '2020-01-01',
      time: '00:00',
      tags: ['日记'],
      emoji: '📖',
      content: '',
      text: '',
      segments: [],
      filename: '',
      filePath: undefined,
      lineNumber: 0,
      kind: 'diary' as const,
      media: [],
    };
    await (c as any).copyLink(ghost);
    expect(getNoticeMessages().join('\n')).toContain('找不到原文，无法复制双链');
    expect(mocks.copyDiaryLink).not.toHaveBeenCalled();
    await (c as any).jumpTo(ghost);
    expect(getNoticeMessages().join('\n')).toContain('找不到原文');
    expect(mocks.jumpToEntry ?? null).not.toBeNull();
  });

  it('jumpToDiaryEntry 纯日期 filename 不再拼 `<日记目录>/<日期>.md`', async () => {
    await openAndWait();
    const spy = vi.spyOn(vault, 'getAbstractFileByPath');
    await jumpToDiaryEntry({ filename: '2020-01-01', emoji: '📖', time: '00:00' });
    expect(spy).toHaveBeenCalledWith('2020-01-01');
    spy.mockRestore();
    expect(getNoticeMessages().join('\n')).toContain('找不到日记文件');
  });
});

describe('效率#6：时间位置感（筛选态文案 / 清除胶囊 / 今天钮）', () => {
  it('range 带筛选态 + 「✕ 清除」胶囊一键清日期筛选', async () => {
    const c = await openAndWait();
    (c as any).selDateFilter = { year: '2026', month: '06' };
    c.renderAll();
    const range = deskEl('.bz-diary-range');
    expect(range.textContent).toContain('2026-06');
    expect(range.textContent).toContain('条');
    const chip = deskEl('.bz-diary-filter-clear');
    expect(chip).toBeTruthy();
    chip.click();
    expect((c as any).selDateFilter).toBeNull();
    expect(deskEl('.bz-diary-range').textContent).not.toContain('2026-06');
    expect(document.querySelector('.bz-diary-filter-clear')).toBeNull();
  });

  it('头行「今天」钮：清日期筛选', async () => {
    const c = await openAndWait();
    (c as any).selDateFilter = { year: '2025' };
    c.renderAll();
    const todayBtn = deskEl('[data-act="today"]');
    expect(todayBtn).toBeTruthy();
    todayBtn.click();
    expect((c as any).selDateFilter).toBeNull();
  });
});

describe('效率#8：搜索增量显隐', () => {
  it('关键词变化只 toggle 既有卡片 display（DOM 探针证明未整墙重建），空结果才整墙重建', async () => {
    const c = await openAndWait();
    const wall = deskEl('.bz-diary-wall');
    const total = wall.querySelectorAll('.bz-diary-item').length;
    expect(total).toBe(3);
    (wall.querySelector('.bz-diary-item') as HTMLElement).dataset.probe = '1';
    // 命中部分条目：增量显隐
    (c as any)._searchDebounced('诗');
    await new Promise((r) => setTimeout(r, 320));
    expect(wall.querySelector('.bz-diary-item[data-probe="1"]')).toBeTruthy(); // 未整墙重建
    const items = Array.from(wall.querySelectorAll<HTMLElement>('.bz-diary-item'));
    const visible = items.filter((el) => el.style.display !== 'none');
    expect(visible.length).toBe(1); // 只有 2026-06-12（正文含「诗」）
    // 全藏的日期分节：节头与容器一并隐藏
    const hiddenHeads = Array.from(wall.querySelectorAll<HTMLElement>('.bz-diary-day-head')).filter(
      (h) => h.style.display === 'none'
    );
    expect(hiddenHeads.length).toBe(2);
    // 空结果：走整墙重建（探针消失 + 渲染空态）
    (c as any)._searchDebounced('zzz不存在的词zzz');
    await new Promise((r) => setTimeout(r, 320));
    expect(wall.querySelector('.bz-diary-item[data-probe="1"]')).toBeNull();
    expect(wall.querySelector('.bz-empty')).toBeTruthy();
    // 清词：恢复全量
    (c as any)._searchDebounced('');
    await new Promise((r) => setTimeout(r, 320));
    expect(wall.querySelectorAll('.bz-diary-item').length).toBe(3);
  });
});

describe('效率#9/#13/#14：渲染态 DOM 形态', () => {
  it('效率#9：搜索命中词在纯文字卡渲染 <mark class="bz-diary-mark"> 高亮', async () => {
    const c = await openAndWait();
    (c as any).searchKeyword = '诗';
    c.renderAll();
    await waitFor(() => !!document.querySelector('.bz-diary-desk mark.bz-diary-mark'));
    const mark = document.querySelector('.bz-diary-desk mark.bz-diary-mark')!;
    expect(mark.textContent).toBe('诗');
    expect(!!mark.closest('.bz-diary-text-tx')).toBe(true);
  });

  it('效率#13：loadAndRender 读取期间墙区骨架占位，数据到后骨架消失', async () => {
    mocks.loadWallEntries.mockImplementationOnce(async (app: any) => {
      await new Promise((r) => setTimeout(r, 60));
      return holder.actualLoad!(app);
    });
    const c = DiaryAppController.getInstance();
    void c.openManager();
    await waitFor(() => !!document.querySelector('.bz-diary-skel'));
    const skel = document.querySelector('.bz-diary-skel')!;
    expect(skel.textContent).toContain('正在翻日记');
    expect(skel.querySelectorAll('.bz-diary-skel-card').length).toBeGreaterThan(0);
    await waitFor(() => !!document.querySelector('.bz-diary-day-head'));
    expect(document.querySelector('.bz-diary-skel')).toBeNull();
  });

  it('效率#14：读墙失败渲染错误态（不是「写第一篇」引导空态），重试可恢复', async () => {
    mocks.loadWallEntries.mockImplementationOnce(async () => {
      throw new Error('磁盘读取失败');
    });
    const c = DiaryAppController.getInstance();
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-empty'));
    const box = document.querySelector('.bz-empty')!;
    expect(box.textContent).toContain('日记加载失败');
    expect(box.textContent).toContain('磁盘读取失败');
    expect(box.textContent).not.toContain('写下第一篇');
    const retry = Array.from(box.querySelectorAll('button')).find((b) => b.textContent!.includes('重试'))!;
    expect(retry).toBeTruthy();
    retry.click();
    await waitFor(() => !!document.querySelector('.bz-diary-day-head'));
  });

  it('一致#4：空库空态走 core uiEmpty 单源（.bz-empty），域内 .bz-diary-empty 家族样式已删', async () => {
    DiaryAppController.instance?.cleanup();
    DiaryAppController.instance = null;
    vault.files.clear();
    const c = DiaryAppController.getInstance();
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-empty'));
    expect(document.querySelector('.bz-diary-empty')).toBeNull();
    const writeBtn = Array.from(document.querySelectorAll('.bz-empty button')).find((b) =>
      b.textContent!.includes('写第一篇')
    );
    expect(writeBtn).toBeTruthy();
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    expect(css).not.toMatch(/^\s*\.bz-diary-empty/m); // 域内规则已删（core .bz-empty 族接管）
  });
});

describe('D-UI3：搜索防抖尾触取消', () => {
  it('输入后 250ms 内点 ✕ 收起：防抖尾触被取消，关键词不「复活」', async () => {
    const c = await openAndWait();
    vi.useFakeTimers();
    const searchBtn = deskEl('[data-act="search"]');
    searchBtn.click(); // 展开
    const box = deskEl('.bz-diary-searchrow input') as HTMLInputElement;
    box.value = '诗';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(100); // 未到 250ms
    searchBtn.click(); // 收起（cancel 路径）
    vi.advanceTimersByTime(500);
    expect((c as any).searchKeyword).toBe('');
  });

  it('搜索框内 ESC 清空：同样取消防抖尾触', async () => {
    const c = await openAndWait();
    vi.useFakeTimers();
    deskEl('[data-act="search"]').click();
    const box = deskEl('.bz-diary-searchrow input') as HTMLInputElement;
    box.value = '诗';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(100);
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    vi.advanceTimersByTime(500);
    expect((c as any).searchKeyword).toBe('');
  });
});

describe('D-UI4：灯箱触屏滑动过滤媒体原生控件', () => {
  it('在 video 原生控件上横拖 ≥40px 不切图；灯箱背景区滑动照常切图', async () => {
    const c = await openAndWait();
    const entry = (c as any)._wallEntries.find((e: any) => e.media.some((m: any) => m.kind === 'video'));
    (c as any).openLightbox(
      entry.media.find((m: any) => m.kind === 'video'),
      entry
    );
    expect(deskEl('.bz-diary-lb.bz-diary-lb--show')).toBeTruthy();
    const lb = deskEl('.bz-diary-lb');
    const idxBefore = (c as any)._lbIdx as number;
    // video 控件上横拖：touchstart target = video → 忽略
    const video = lb.querySelector('video')!;
    expect(video).toBeTruthy();
    const ts = new TouchEvent('touchstart', { bubbles: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientX: 100, clientY: 10 }] });
    video.dispatchEvent(ts);
    const te = new TouchEvent('touchend', { bubbles: true });
    Object.defineProperty(te, 'changedTouches', { value: [{ clientX: 200, clientY: 10 }] });
    video.dispatchEvent(te);
    expect((c as any)._lbIdx).toBe(idxBefore); // 未切图
    // 灯箱背景滑动：照常切图
    // 灯箱背景滑动照常切图（原语义：右滑 dx>0 = 上一个，与移动端相册手势一致）
    const len = ((c as any)._lbSeq.length as number) || 1;
    const ts2 = new TouchEvent('touchstart', { bubbles: true });
    Object.defineProperty(ts2, 'touches', { value: [{ clientX: 100, clientY: 10 }] });
    lb.dispatchEvent(ts2);
    const te2 = new TouchEvent('touchend', { bubbles: true });
    Object.defineProperty(te2, 'changedTouches', { value: [{ clientX: 200, clientY: 10 }] });
    lb.dispatchEvent(te2);
    expect((c as any)._lbIdx).toBe((idxBefore + len - 1) % len);
  });
});

describe('D-UI6：触控热区收敛（去 --xl 外扩）', () => {
  it('头行钮/chips/subchips/时光条卡不再挂 bz-touch-target--xl（移动端热区走 padding 抬档）', async () => {
    await openAndWait();
    expect(document.querySelectorAll('.bz-diary .bz-touch-target--xl').length).toBe(0);
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    // padding 抬档达标（≥40px 绝对下限）在 768px 段
    expect(css).toMatch(/\.bz-diary-mob \.bz-diary-chip\s*{[^}]*padding: 11px 16px/s);
    expect(css).toMatch(/\.bz-diary-mob \.bz-diary-subchip\s*{[^}]*padding: 12px 15px/s);
  });
});

describe('func N5：vault create（外部新建）回刷', () => {
  it('墙开着时外部写入条目文件 → create 事件防抖回刷上墙；面板关闭期不刷新', async () => {
    const c = await openAndWait();
    const before = (c as any).entries.length as number;
    vault.files.set('我的/日记/2601010101.md', seed('2026-01-01', '01:01', '📖', '外部新建的条目'));
    vault.emit('create', { path: '我的/日记/2601010101.md' });
    await waitFor(() => (c as any).entries.length === before + 1);
    // 目录外文件不触发
    vault.files.set('其他/笔记.md', '# 无关文件');
    vault.emit('create', { path: '其他/笔记.md' });
    await new Promise((r) => setTimeout(r, 520));
    expect((c as any).entries.length).toBe(before + 1);
  });
});

describe("D8'/D9'：ESC 分流探测与锁态复位", () => {
  it("D8'：抽屉被 core 关闭后 sheetEntry 残留 → ESC 不被空操作消费，直接关灯箱", async () => {
    const c = await openAndWait();
    const entry = (c as any)._wallEntries.find((e: any) => e.media.length);
    (c as any).openLightbox(entry.media[0], entry);
    expect(deskEl('.bz-diary-lb.bz-diary-lb--show')).toBeTruthy();
    // 模拟 core 路径（遮罩/下拉）已关抽屉、diary.sheetEntry 残留（core 无 onClose）
    (c as any).sheetEntry = entry;
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect((c as any).sheetEntry).toBeNull(); // 残留被探测清除
    expect(deskEl('.bz-diary-lb.bz-diary-lb--show')).toBeNull(); // 第一次 ESC 即关到灯箱
  });

  it("D9'：面板关闭期间被上锁 → 重开按真实锁态重置 lockedVisible", async () => {
    mocks.isUnlocked.mockReturnValue(true);
    const c = await openAndWait();
    expect((c as any).lockedVisible).toBe(true);
    // 关闭期间外部上锁
    mocks.isUnlocked.mockReturnValue(false);
    c.hide();
    c.show();
    await waitFor(() => (c as any).lockedVisible === false);
    c.hide();
  });
});

describe('效率#10：灯箱「⋯」动作菜单', () => {
  it('灯箱 ⋯ 钮打开当前连看项的条目菜单（含「打开原文」）', async () => {
    const c = await openAndWait();
    const entry = (c as any)._wallEntries.find((e: any) => e.media.length);
    (c as any).openLightbox(entry.media[0], entry);
    const more = deskEl('[data-act="lb-more"]');
    expect(more).toBeTruthy();
    more.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 40 }));
    const menu = document.querySelector('.bz-item-menu')!;
    expect(menu).toBeTruthy();
    const openBtn = Array.from(menu.querySelectorAll('button')).find((b) => b.textContent!.includes('打开原文'));
    expect(openBtn).toBeTruthy();
  });
});

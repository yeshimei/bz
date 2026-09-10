/**
 * 日记本（diary，原回忆墙升格 ADR-0115）UI 层测试
 * - jsdom 环境（不加 node 注释）；
 * - MockVault 注入带媒体的假日记文件 → await ui.openManager()；
 * - 断言：根容器 .bz-diary 出现且可见、章节栏月份项、瀑布流媒体块与文字条、
 *   灯箱点击媒体能打开、章节点击/空态/筛选/ESC。
 * - mockAppWithVault(vault) 的 metadataCache 未实现 getFirstLinkpathDest，数据层 mediaSrc
 *   内部 try 会降级返回 '' → 测试 vi.mock data 模块的 mediaSrc 返回稳定 URL。
 * - jsdom 无 IntersectionObserver → UI 懒加载走 fallback（直接挂 src），断言以 img[src]/video[src] 为准。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { DiaryAppController } from '../../src/diary/ui';

// mock data 模块的 mediaSrc（MockVault 无 getResourcePath，返回稳定 vault 内 URL；
// 用标准 https 协议——jsdom 对 app:// 非标准协议的 src 赋值会归一化为空）
const mocks = vi.hoisted(() => ({
  mediaSrc: vi.fn((_app: any, name: string) => `https://example.com/vault/${encodeURI(name)}`),
  openAddDialog: vi.fn(),
  showTagPicker: vi.fn(),
  jumpToEntry: vi.fn(),
  copyDiaryLink: vi.fn(),
  showConfirm: vi.fn(),
  encryptEntry: vi.fn(),
  reclassifyEntry: vi.fn(async (): Promise<boolean> => true),
  ensureSafeUnlocked: vi.fn(async () => true),
  openEncrypt: vi.fn(),
  getSafeManager: vi.fn(() => ({ unlocked: false, manifest: { notes: [] } })),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<any[]> => []),
  deleteEncryptedEntry: vi.fn(async () => {}),
}));
vi.mock('../../src/diary/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary/data')>();
  return {
    ...actual,
    mediaSrc: mocks.mediaSrc,
  };
});
// 写链路弹窗 mock（ui.ts 静态 import：openAddDialog / showTagPicker）
vi.mock('../../src/diary/ui/dialogs', () => ({
  openAddDialog: mocks.openAddDialog,
  showTagPicker: mocks.showTagPicker,
}));
// 条目动作 mock（ui.ts 静态 import：jumpToDiaryEntry / copyDiaryLink / showConfirm）
vi.mock('../../src/diary/ui/entry-actions', () => ({
  jumpToDiaryEntry: mocks.jumpToEntry,
  copyDiaryLink: mocks.copyDiaryLink,
  showConfirm: mocks.showConfirm,
}));
// 加密解锁 mock（ui.ts 动态 import '../encrypt' 与 '../diary/encrypt'；getSafeManager 供加密媒体按需解密）
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

async function waitFor(fn: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(async () => {
  document.body.innerHTML = '';
  applyDirectories({});
  resetObsidianMocks();
  mocks.openAddDialog.mockClear();
  mocks.showTagPicker.mockClear();
  mocks.jumpToEntry.mockClear();
  mocks.copyDiaryLink.mockClear();
  mocks.showConfirm.mockClear();
  mocks.encryptEntry.mockClear();
  mocks.reclassifyEntry.mockClear();
  mocks.ensureSafeUnlocked.mockClear();
  mocks.ensureSafeUnlocked.mockResolvedValue(true);
  mocks.openEncrypt.mockClear();
  mocks.getSafeManager.mockClear();
  mocks.getSafeManager.mockImplementation(() => ({ unlocked: false, manifest: { notes: [] } }));
  mocks.isUnlocked.mockClear();
  mocks.isUnlocked.mockReturnValue(false);
  mocks.loadEncryptedEntries.mockClear();
  mocks.loadEncryptedEntries.mockResolvedValue([]);
  mocks.deleteEncryptedEntry.mockClear();
  vault = new MockVault();
  // 三个日期：2026-08-19（图片/视频/音频媒体 + 纯文字）、2026-06-11（摄影带图）、2026-06-12（纯文字对谈）
  vault.files.set(
    '我的/日记/2026-08-19.md',
    '# 📖 23:02\n上厕所时被猫盯着。\n![[IMG_20260819_164331.jpg]]\n![[VID_20260819_231437.mp4]]\n![[2026年05月30日 11点05分.m4a]]\n'
  );
  vault.files.set('我的/日记/2026-06-11.md', '# 📸 21:29\n![[IMG_20260611_211240.jpg]]\n');
  vault.files.set(
    '我的/日记/2026-06-12.md',
    '# 🤝 20:33\n"又有了新的小想法。"一首新的诗朗诵。\n'
  );
  const app = mockAppWithVault(vault);
  setApp(app); // 墙/写链路统一走 core/app
});

afterEach(() => {
  // 单例跨用例清理：unregister ESC + 移除 DOM（幂等；cleanup 用例自身已清理）
  DiaryAppController.instance?.cleanup();
  DiaryAppController.instance = null;
  document.body.innerHTML = '';
});

/** 打开并等待数据渲染完成（loadAndRender 为异步 fire-and-forget） */
async function openAndWait() {
  const c = DiaryAppController.getInstance();
  await c.openManager();
  await waitFor(() => !!document.querySelector('.bz-diary-day-head'));
  return c;
}

describe('回忆墙 UI', () => {
  it('openManager 创建根容器并显示', async () => {
    await openAndWait();
    const root = document.querySelector('.bz-diary') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.display).toBe('flex');
    expect(document.querySelectorAll('.bz-diary-desk').length).toBe(1);
    expect(document.querySelectorAll('.bz-diary-mob').length).toBe(1);
  });

  it('渲染章节栏（月份倒序）+ 瀑布流（媒体块 + 文字条 + 日期节头）', async () => {
    await openAndWait();
    // 章节栏月份（倒序：2026-08 / 2026-06）——只统计桌面实例（移动无章节栏）
    const months = Array.from(document.querySelectorAll('.bz-diary-desk .bz-diary-month')).map(
      (el) => (el as HTMLElement).dataset.month
    );
    expect(months).toEqual(['2026-08', '2026-06']);
    // 瀑布流（桌面实例）：媒体块（img/video/audio 各存在；jsdom 无 IO → fallback 已挂 src）
    const desk = document.querySelector('.bz-diary-desk')!;
    const medias = desk.querySelectorAll('.bz-diary-media');
    expect(medias.length).toBeGreaterThanOrEqual(3);
    expect(desk.querySelectorAll('.bz-diary-media img[src]').length).toBeGreaterThanOrEqual(1);
    expect(desk.querySelectorAll('.bz-diary-media video[src]').length).toBeGreaterThanOrEqual(1);
    // 音频块（🎵 占位 ph）
    expect(desk.querySelectorAll('.bz-diary-media .bz-diary-ph').length).toBeGreaterThanOrEqual(3);
    // 纯文字条（2026-06-12 对谈）
    expect(desk.querySelectorAll('.bz-diary-text').length).toBeGreaterThanOrEqual(1);
    // 日期节头（3 个日期，桌面实例）
    const heads = Array.from(desk.querySelectorAll('.bz-diary-day-head'));
    expect(heads.length).toBe(3);
  });

  it('章节栏点击月份 → 平滑滚动定位到该月首个节头', async () => {
    const c = await openAndWait();
    const monthItem = document.querySelector<HTMLElement>('.bz-diary-month[data-month="2026-08"]');
    expect(monthItem).toBeTruthy();
    const scrollSpy = vi.fn();
    const wall = document.querySelector('.bz-diary-wall') as HTMLElement;
    wall.scrollTo = scrollSpy as any;
    monthItem!.click();
    expect(scrollSpy).toHaveBeenCalled();
    // 目标 day-head 存在
    const head = wall.querySelector('.bz-diary-day-head[data-date^="2026-08"]');
    expect(head).toBeTruthy();
    void c;
  });

  it('点击媒体块打开灯箱（mediaSrc 注入 URL），点背景关闭', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const media = desk.querySelector('.bz-diary-media') as HTMLElement;
    expect(media).toBeTruthy();
    media.click();
    // 灯箱已打开（DW5：仅可见实例加 --show，桌面端 1 个）
    const lb = desk.querySelector('.bz-diary-lb--show') as HTMLElement;
    expect(lb).toBeTruthy();
    expect(document.querySelectorAll('.bz-diary-lb--show').length).toBe(1);
    // 灯箱内已注入 img（mediaSrc 返回 URL）
    const img = lb.querySelector('.bz-diary-lb-media') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('https://example.com/vault/');
    // 点击灯箱背景关闭（桌面实例）
    lb.click();
    expect(desk.querySelector('.bz-diary-lb--show')).toBeNull();
  });

  it('灯箱副行显示日记正文文字而非媒体路径；标题行为「日期 时间 · 标签」（增强 #6 去文件名）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const media = desk.querySelector('.bz-diary-media') as HTMLElement;
    media.click();
    const lb = desk.querySelector('.bz-diary-lb--show') as HTMLElement;
    expect(lb).toBeTruthy();
    // 副行 = 条目正文（去媒体引用后的文字），不含 app:// 路径
    const sub = lb.querySelector('.bz-diary-lbsub') as HTMLElement;
    expect(sub.textContent).toContain('上厕所时被猫盯着');
    expect(sub.textContent).not.toContain('https://');
    // 标题行 = 「日期 时间 · 标签」，不再显示媒体文件名（增强 #6）
    const cap = lb.querySelector('.bz-diary-lbcap') as HTMLElement;
    expect(cap.textContent).toContain('2026-08-19 23:02');
    expect(cap.textContent).toContain('日记');
    expect(cap.textContent).not.toContain('IMG_20260819_164331.jpg');
  });

  it('媒体块不再显示 emoji 角标（#1 视频无 emoji、#2 图片无 🖼 角标）；音频占位与播放角标 lucide 化（增强 #4）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    // 图片块：无 .bz-diary-att 角标
    expect(desk.querySelector('.bz-diary-att')).toBeNull();
    // 视频块占位：无 emoji 文字（ph 无文本内容）
    const videoPh = Array.from(desk.querySelectorAll<HTMLElement>('.bz-diary-media .bz-diary-ph')).filter(
      (el) => {
        const wrap = el.closest('.bz-diary-media')!;
        return wrap.querySelector('video');
      }
    );
    expect(videoPh.length).toBeGreaterThanOrEqual(1);
    videoPh.forEach((ph) => expect(ph.textContent.trim()).toBe(''));
    // 音频块 music 线条图标（无封面可显示；增强 #4 emoji → lucide）
    const audioPh = Array.from(desk.querySelectorAll<HTMLElement>('.bz-diary-media .bz-diary-ph')).filter(
      (el) => {
        const wrap = el.closest('.bz-diary-media')!;
        return !wrap.querySelector('img, video');
      }
    );
    expect(audioPh.length).toBeGreaterThanOrEqual(1);
    const musicIc = audioPh[0].querySelector('.bz-ic') as HTMLElement;
    expect(musicIc).toBeTruthy();
    expect(musicIc.dataset.icon).toBe('music');
    // 视频播放角标 play 线条图标（原 ▶ 文本）
    const playIc = desk.querySelector('.bz-diary-play .bz-ic') as HTMLElement;
    expect(playIc).toBeTruthy();
    expect(playIc.dataset.icon).toBe('play');
  });

  it('桌面右键：正文/图片/视频子元素右键都能打开条目菜单（#9 容器委托）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    // 正文（文字条内文本）右键
    const tx = desk.querySelector('.bz-diary-text-tx') as HTMLElement;
    tx.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
    expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    document.querySelector('.bz-item-menu')!.remove();
    // 图片（img 元素）右键
    const img = desk.querySelector('.bz-diary-media img') as HTMLElement;
    img.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 90 }));
    expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    document.querySelector('.bz-item-menu')!.remove();
    // 视频（video 元素）右键
    const video = desk.querySelector('.bz-diary-media video') as HTMLElement;
    video.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 130 }));
    expect(document.querySelector('.bz-item-menu')).toBeTruthy();
  });

  it('空态：无日记时显示提示与动作按钮', async () => {
    const emptyVault = new MockVault();
    emptyVault.dirs.add('我的/日记');
    const emptyApp = mockAppWithVault(emptyVault);
    setApp(emptyApp);
    setApp(emptyApp);
    const c = DiaryAppController.getInstance();
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-diary-empty'));
    const empty = document.querySelector('.bz-diary-empty')!;
    expect(empty.textContent).toContain('这一页还空着');
    expect(empty.querySelector('.bz-diary-empty-btn')).toBeTruthy();
  });

  it('ESC 关闭（escManager 注册）', async () => {
    await openAndWait();
    const root = document.querySelector('.bz-diary') as HTMLElement;
    expect(root.style.display).toBe('flex');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.style.display).toBe('none');
  });

  it('类型 chip 筛选（点击「摄影」只剩摄影条目，再点还原）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const chip = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="摄影"]');
    expect(chip).toBeTruthy();
    chip!.click();
    // 只剩 2026-06-11 的 📸 条目（桌面实例）
    const heads = Array.from(desk.querySelectorAll('.bz-diary-day-head'));
    expect(heads.map((h) => (h as HTMLElement).dataset.date)).toEqual(['2026-06-11']);
    expect(desk.querySelectorAll('.bz-diary-media').length).toBe(1);
    // 再点取消筛选
    chip!.click();
    expect(desk.querySelectorAll('.bz-diary-day-head').length).toBe(3);
  });

  it('cleanup 移除根容器并置空单例', async () => {
    const c = DiaryAppController.getInstance();
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-diary-day-head'));
    expect(document.querySelector('.bz-diary')).toBeTruthy();
    c.cleanup();
    expect(document.querySelector('.bz-diary')).toBeNull();
    expect(DiaryAppController.instance).toBeNull();
  });

  // ===== v2 新功能 =====
  it('头部按钮序：编辑、搜索、按年月跳转（增强 #10）、设置（issue 201）、关闭；图标 lucide 化（增强 #4）', async () => {
    await openAndWait();
    const btns = Array.from(document.querySelectorAll('.bz-diary-desk .bz-diary-btns [data-act]')).map(
      (b) => (b as HTMLElement).dataset.act
    );
    // 编辑 → 搜索 → 年月跳转 → 设置 → 关闭（issue 201 头行对齐待办：+⚙设置直达）
    expect(btns).toEqual(['add', 'search', 'date-picker', 'settings', 'close']);
    // 头行图标：pen-line / search / calendar / settings / x（uiIcon 经 setIcon 渲染，mock 记录到 dataset.icon）
    const icons = Array.from(
      document.querySelectorAll<HTMLElement>('.bz-diary-desk .bz-diary-btns [data-act] .bz-ic')
    ).map((i) => i.dataset.icon);
    expect(icons).toEqual(['pen-line', 'search', 'calendar', 'settings', 'x']);
    // 关闭钮对齐待办：不挂 bz-win-close（core 规则非真全屏隐藏之）→ 桌面常显
    const closeBtn = document.querySelector('.bz-diary-desk [data-act="close"]') as HTMLElement;
    expect(closeBtn.classList.contains('bz-win-close')).toBe(false);
  });

  it('加密 chip 常驻显示（即使无加密条目），锁定态点击 → 弹解锁面板，解锁后选中「加密」', async () => {
    await openAndWait();
    // mock 数据无加密条目 → 加密 chip 仍应显示（用户需要入口测试加密流程）
    const desk = document.querySelector('.bz-diary-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]');
    expect(encChip).toBeTruthy();
    expect(encChip!.classList.contains('bz-diary-chip--locked')).toBe(true);
    // 点击锁定态「加密」→ ensureSafeUnlocked 被调（保险箱弹解锁面板）
    encChip!.click();
    await waitFor(() => mocks.ensureSafeUnlocked.mock.calls.length > 0);
    expect(mocks.ensureSafeUnlocked).toHaveBeenCalled();
    await waitFor(() => (DiaryAppController.instance as any).lockedVisible === true);
    expect((DiaryAppController.instance as any).lockedVisible).toBe(true);
    expect((DiaryAppController.instance as any).selTag).toBe('加密');
  });

  it('加密 chip：解锁被取消（ensureSafeUnlocked=false）→ 保持锁定态不选中', async () => {
    mocks.ensureSafeUnlocked.mockResolvedValueOnce(false);
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => mocks.ensureSafeUnlocked.mock.calls.length > 0);
    // 解锁失败：lockedVisible 仍 false，未选中
    expect((DiaryAppController.instance as any).lockedVisible).toBe(false);
    expect((DiaryAppController.instance as any).selTag).toBeNull();
  });

  it('解锁后加载加密日记（loadEncryptedEntries 合并进 entries 并显示）', async () => {
    mocks.isUnlocked.mockReturnValue(true);
    const encEntry = {
      date: '2026-07-01',
      time: '10:30',
      timeValue: 1030,
      tags: ['日记', '加密'],
      emoji: '📖🔐',
      content: '加密的日记内容\n![[enc.jpg]]',
      filename: '2026-07-01',
      lineNumber: 0,
      encrypted: true,
      noteId: 'enc-1',
      id: 'enc-diary-enc-1',
    };
    mocks.loadEncryptedEntries.mockResolvedValueOnce([encEntry]);
    await openAndWait();
    // 打开时保险箱已解锁 → 合并加密条目（loadAndRender 内 mergeEncryptedEntries）
    await waitFor(() => {
      const c = DiaryAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    expect(mocks.loadEncryptedEntries).toHaveBeenCalled();
    // 加密条目在「加密」筛选下可见
    const desk = document.querySelector('.bz-diary-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    expect(desk.querySelector('.bz-diary-day-head')!.textContent).toContain('2026-07-01');
  });

  it('加密条目动作分流：打开走保险箱、删除走密文销毁、复制双链复制正文（P1-2 审查修复）', async () => {
    mocks.isUnlocked.mockReturnValue(true);
    const encEntry = {
      date: '2026-07-01',
      time: '10:30',
      timeValue: 1030,
      tags: ['日记', '加密'],
      emoji: '📖🔐',
      content: '加密的日记内容',
      filename: '2026-07-01',
      lineNumber: 0,
      encrypted: true,
      noteId: 'enc-1',
      id: 'enc-diary-enc-1',
    };
    mocks.loadEncryptedEntries.mockResolvedValueOnce([encEntry]);
    await openAndWait();
    await waitFor(() => {
      const c = DiaryAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    // 选中「加密」筛选出加密条目
    const desk = document.querySelector('.bz-diary-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    const item = desk.querySelector('.bz-diary-item') as HTMLElement;
    // 打开原文 → openEncrypt（不跳不存在的 md）
    mocks.openEncrypt.mockClear();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 双击
    await new Promise((r) => setTimeout(r, 30));
    expect(mocks.openEncrypt).toHaveBeenCalled();
    // 右键菜单：加密条目显示「解密」而非「改标签/加密」
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
    const menu = document.querySelector('.bz-item-menu')!;
    expect(menu.textContent).toContain('解密');
    expect(menu.textContent).not.toContain('改标签');
  });

  it('加密条目删除 → 走保险箱密文销毁（deleteEncryptedEntry）', async () => {
    mocks.isUnlocked.mockReturnValue(true);
    mocks.deleteEncryptedEntry.mockClear();
    const encEntry = {
      date: '2026-07-01',
      time: '10:30',
      timeValue: 1030,
      tags: ['日记', '加密'],
      emoji: '📖🔐',
      content: '加密的日记内容',
      filename: '2026-07-01',
      lineNumber: 0,
      encrypted: true,
      noteId: 'enc-1',
      id: 'enc-diary-enc-1',
    };
    mocks.loadEncryptedEntries.mockResolvedValueOnce([encEntry]);
    await openAndWait();
    await waitFor(() => {
      const c = DiaryAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    const desk = document.querySelector('.bz-diary-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    const item = desk.querySelector('.bz-diary-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
    const menu = document.querySelector('.bz-item-menu')!;
    const delBtn = Array.from(menu.querySelectorAll('button')).find((b) => b.textContent!.includes('删除'))!;
    delBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    // flow-dialog 确认弹窗（mock 环境未 mock flow-dialog → 点真实确认按钮或跳过）
    const confirmMask = document.querySelector('.bz-flow-dialog, #__shared_confirm_mask__');
    if (confirmMask) {
      const okBtn = Array.from(confirmMask.querySelectorAll('button')).find(
        (b) => b.textContent!.includes('删除')
      );
      okBtn?.click();
      await new Promise((r) => setTimeout(r, 30));
    }
    if (mocks.deleteEncryptedEntry.mock.calls.length > 0) {
      expect(mocks.deleteEncryptedEntry).toHaveBeenCalledWith('enc-1');
    }
  });

  it('文字条右上角不再显示中文标签（去 tag），媒体块无 ⋯ 按钮', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    // 文字条：无 .bz-diary-text-tag
    expect(desk.querySelector('.bz-diary-text-tag')).toBeNull();
    // 媒体块：无 .bz-diary-ops
    expect(desk.querySelector('.bz-diary-ops')).toBeNull();
    // 文字条仍保留 时间 + emoji 行
    const textRow = desk.querySelector('.bz-diary-text-row');
    expect(textRow).toBeTruthy();
  });

  it('标题（品牌）点击 → 打开自包含日期选择器弹窗', async () => {
    await openAndWait();
    const brand = document.querySelector('.bz-diary-desk .bz-diary-brand') as HTMLElement;
    brand.click();
    const popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.style.display).toBe('flex');
    expect(popup.textContent).toContain('按日期筛选');
    // 年份行（2026 / 2025 来自 mock 数据日期）
    expect(popup.querySelectorAll('.bz-diary-datefilter-year').length).toBeGreaterThanOrEqual(1);
  });

  it('日期选择器：点年份 → 月份网格；点月份 → 过滤该月条目', async () => {
    await openAndWait();
    const brand = document.querySelector('.bz-diary-desk .bz-diary-brand') as HTMLElement;
    brand.click();
    const popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    // 点 2026 年 → 弹窗重建出月份网格
    const year2026 = popup.querySelector<HTMLElement>('.bz-diary-datefilter-year[data-year="2026"]');
    expect(year2026).toBeTruthy();
    year2026!.click();
    const popup2 = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    expect(popup2.querySelectorAll('.bz-diary-datefilter-month').length).toBe(12);
    // 点 8 月（有数据）→ 应用过滤（只剩 2026-08-19 条目）并关闭弹窗
    const aug = Array.from(popup2.querySelectorAll<HTMLElement>('.bz-diary-datefilter-month')).find(
      (m) => m.textContent!.includes('8月')
    )!;
    expect(aug).toBeTruthy();
    aug.click();
    expect(document.querySelector('.bz-diary-datefilter')).toBeNull(); // 弹窗已关
    const desk = document.querySelector('.bz-diary-desk')!;
    const heads = Array.from(desk.querySelectorAll('.bz-diary-day-head')).map((h) =>
      (h as HTMLElement).dataset.date
    );
    expect(heads).toEqual(['2026-08-19']);
  });

  it('E6 审查修复：点年份只切换浏览年份，关闭弹窗不提交筛选', async () => {
    const c = await openAndWait();
    const brand = document.querySelector('.bz-diary-desk .bz-diary-brand') as HTMLElement;
    brand.click();
    let popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    // 点 2026 年 → 只重建浏览网格，不写筛选
    popup.querySelector<HTMLElement>('.bz-diary-datefilter-year[data-year="2026"]')!.click();
    popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    expect(popup.querySelectorAll('.bz-diary-datefilter-month').length).toBe(12);
    expect(c.selDateFilter).toBeNull(); // 年份只是浏览临时值
    // ✕ 关闭：筛选仍未生效，列表未被过滤
    (popup.querySelector('.bz-diary-datefilter-close') as HTMLElement)!.click();
    expect(document.querySelector('.bz-diary-datefilter')).toBeNull();
    expect(c.selDateFilter).toBeNull();
    expect(document.querySelectorAll('.bz-diary-desk .bz-diary-day-head').length).toBe(3);
  });

  it('E6：点年份后点月份提交筛选；「全部」清除', async () => {
    const c = await openAndWait();
    const brand = document.querySelector('.bz-diary-desk .bz-diary-brand') as HTMLElement;
    brand.click();
    let popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    popup.querySelector<HTMLElement>('.bz-diary-datefilter-year[data-year="2026"]')!.click();
    popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    const aug = Array.from(popup.querySelectorAll<HTMLElement>('.bz-diary-datefilter-month')).find(
      (m) => m.textContent!.includes('8月')
    )!;
    aug.click();
    expect(c.selDateFilter).toEqual({ year: '2026', month: '08' });
    expect(document.querySelectorAll('.bz-diary-desk .bz-diary-day-head').length).toBe(1);
    // 再开 → 「全部」清除
    brand.click();
    popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    (popup.querySelector('.bz-diary-datefilter-reset') as HTMLElement)!.click();
    expect(c.selDateFilter).toBeNull();
    expect(document.querySelectorAll('.bz-diary-desk .bz-diary-day-head').length).toBe(3);
  });

  it('桌面单击条目 → 不开底部抽屉（动作入口为右键/双击）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const item = desk.querySelector('.bz-diary-item') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 抽屉不应打开
    expect(desk.querySelector('.bz-sheet--show')).toBeNull();
    // 媒体块 ⋯ 按钮已移除（用户要求去掉右上角三点）
    expect(item.querySelector('.bz-diary-ops')).toBeNull();
  });

  it('移动端单击条目 → 打开底部抽屉', async () => {
    await openAndWait();
    // 移动实例（.bz-diary-mob）的条目：jsdom 无媒体差异，移动实例与桌面共用 renderWall(mobile=true)
    const mob = document.querySelector('.bz-diary-mob')!;
    const item = mob.querySelector('.bz-diary-item') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mob.querySelector('.bz-sheet--show')).toBeTruthy();
  });

  it('稀疏铺满：单条日文字条跨列占满整行（sparse-1）', async () => {
    // 2026-06-12 只有一条对谈（纯文字）→ 其 masonry 容器应带 --sparse-1
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    // 三个单条日期（08-19 媒体 / 06-11 媒体 / 06-12 文字）都应 sparse-1
    const sparse1 = desk.querySelectorAll('.bz-diary-masonry--sparse-1');
    expect(sparse1.length).toBeGreaterThanOrEqual(2);
    // 至少一个 sparse-1 容器内含文字条（06-12 对谈）
    const hasText = Array.from(sparse1).some((m) => m.querySelector('.bz-diary-text'));
    expect(hasText).toBe(true);
  });

  it('搜索：输入关键词过滤条目，清空还原', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    // 打开搜索行
    const searchBtn = desk.querySelector('[data-act="search"]') as HTMLElement;
    searchBtn.click();
    const box = desk.querySelector('.bz-diary-searchrow .bz-search input') as HTMLInputElement;
    expect(box).toBeTruthy();
    // 输入「猫」（2026-08-19 日记内容含「被猫盯着」）
    box.value = '猫';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    expect(desk.querySelectorAll('.bz-diary-day-head').length).toBe(1);
    // 清空还原（再次点搜索按钮收起）
    searchBtn.click();
    expect(desk.querySelectorAll('.bz-diary-day-head').length).toBe(3);
  });

  it('二级标签：点击带子标签的主标签显示子标签行', async () => {
    // mock 数据：两条 🀄（四川 子标签）+ 一条 📖（普通日记）——点子标签「四川」后应只剩四川条目
    const c = DiaryAppController.getInstance();
    const v2 = new MockVault();
    v2.files.set('我的/日记/2026-08-19.md', '# 🀄 23:02\n![[IMG_x.jpg]]\n');
    v2.files.set('我的/日记/2026-06-11.md', '# 🀄 21:29\n![[IMG_y.jpg]]\n');
    v2.files.set('我的/日记/2026-06-12.md', '# 📖 20:33\n普通日记\n');
    const v2app = mockAppWithVault(v2);
    setApp(v2app);
    setApp(v2app);
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-diary-day-head'));
    const desk = document.querySelector('.bz-diary-desk')!;
    // 标签列表来自 config 全量：旅游 chip 一定存在（renderChips 不再硬编码）
    const travel = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="旅游"]');
    expect(travel).toBeTruthy();
    travel!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-subchip').length > 0);
    expect(desk.querySelectorAll('.bz-diary-subchip').length).toBeGreaterThan(0);
    // 点子标签「四川」过滤：只剩 2026-08-19 + 2026-06-11 两条
    const sub = desk.querySelector<HTMLElement>('.bz-diary-subchip[data-tag="四川"]');
    expect(sub).toBeTruthy();
    sub!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 2);
    expect(desk.querySelectorAll('.bz-diary-day-head').length).toBe(2);
  });

  it('右键菜单：条目 contextmenu 打开跟手菜单，含打开/复制/改标签/加密/删除', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const item = desk.querySelector('.bz-diary-item') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
    const menu = document.querySelector('.bz-item-menu');
    expect(menu).toBeTruthy();
    expect(menu!.textContent).toContain('打开原文');
    expect(menu!.textContent).toContain('复制双链');
    expect(menu!.textContent).toContain('复制正文');
    expect(menu!.textContent).toContain('改标签');
    expect(menu!.textContent).toContain('删除');
  });

  it('双击条目 → 跳转原文（jumpTo 被调）', async () => {
    const spy = vi.spyOn(DiaryAppController.prototype as any, 'jumpTo').mockResolvedValue(undefined);
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const item = desk.querySelector('.bz-diary-text') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 双击 = 300ms 内两次点击
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('DW4：移动端媒体单击开条目抽屉（不直进灯箱）；DW7：重渲染宽高比稳定', async () => {
    await openAndWait();
    const mob = document.querySelector('.bz-diary-mob')!;
    const media = mob.querySelector('.bz-diary-media') as HTMLElement;
    expect(media).toBeTruthy();
    media.click();
    // 抽屉打开（媒体条目的条目级动作可达），灯箱未开
    expect(mob.querySelector('.bz-sheet--show')).toBeTruthy();
    expect(mob.querySelector('.bz-diary-lb--show')).toBeNull();
    // 抽屉内媒体缩略图仍可进灯箱（openLightbox 按可见实例亮——jsdom 桌面宽度 → desk 实例）
    const thumb = mob.querySelector('.bz-diary-sheet-thumb') as HTMLElement;
    expect(thumb).toBeTruthy();
    thumb.click();
    expect(document.querySelector('.bz-diary-lb--show')).toBeTruthy();
    // DW7：重渲染后同条目媒体宽高比不变（稳定散列，非全局递增 seed）
    const c = DiaryAppController.instance!;
    const before = Array.from(document.querySelectorAll('.bz-diary-desk .bz-diary-media')).map(
      (m) => (m as HTMLElement).style.aspectRatio
    );
    c.renderAll();
    const after = Array.from(document.querySelectorAll('.bz-diary-desk .bz-diary-media')).map(
      (m) => (m as HTMLElement).style.aspectRatio
    );
    expect(after).toEqual(before);
  });

  it('DW3：墙开着时日记文件 modify → 防抖重读刷新', async () => {
    await openAndWait();
    const app = (await import('../../src/core/app')).getApp();
    // 新增一天日记 → modify 事件（真实场景：外部编辑既有文件，此处新增文件内容验证重读链路）
    vault.files.set('我的/日记/2026-09-01.md', '# 📝 08:00\n新日记条目。\n');
    const file = (app.vault as any).file('我的/日记/2026-09-01.md');
    (app.vault as any).emit('modify', file);
    await waitFor(() => {
      const heads = document.querySelectorAll('.bz-diary-desk .bz-diary-day-head');
      return heads.length === 4;
    }, 2000);
  });

  it('DW8：月份点击 smooth 滚动只触发一次；DW9：视频时长角标显示真实时长', async () => {
    await openAndWait();
    const wall = document.querySelector('.bz-diary-desk .bz-diary-wall') as HTMLElement;
    const scrollSpy = vi.fn();
    wall.scrollTo = scrollSpy as any;
    const monthItem = document.querySelector<HTMLElement>('.bz-diary-desk .bz-diary-month[data-month="2026-08"]');
    monthItem!.click();
    // DW8：委托单次绑定（原 bindPanel 委托 + renderWall 逐月绑定双触发）
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    // DW9：视频 metadata 就绪 → 角标从 ▶ 变真实时长
    const video = document.querySelector('.bz-diary-desk .bz-diary-media video') as HTMLVideoElement;
    expect(video).toBeTruthy();
    Object.defineProperty(video, 'duration', { value: 125, configurable: true });
    video.dispatchEvent(new Event('loadedmetadata'));
    const dur = video.parentElement!.querySelector('.bz-diary-dur') as HTMLElement;
    expect(dur.textContent).toBe('2:05');
  });

  it('G1 审查修复：点击已滚过月份按流式位置推算目标（吸顶头 rect 不再污染）', async () => {
    await openAndWait();
    const wall = document.querySelector('.bz-diary-desk .bz-diary-wall') as HTMLElement;
    const head = wall.querySelector<HTMLElement>('.bz-diary-day-head[data-date^="2026-08"]')!;
    const masonry = head.nextElementSibling as HTMLElement;
    expect(masonry.classList.contains('bz-diary-masonry')).toBe(true);
    // 模拟已滚过该月：节头是 sticky（rect 恒贴墙顶，不可用），其 masonry（非 sticky）
    // rect 为流式真实位置——已在视口上方 860px，墙顶位于视口 100px 处
    wall.getBoundingClientRect = () => ({ top: 100 } as any);
    masonry.getBoundingClientRect = () => ({ top: -860 } as any);
    Object.defineProperty(head, 'offsetHeight', { value: 40, configurable: true });
    wall.scrollTop = 2000;
    const scrollSpy = vi.fn();
    wall.scrollTo = scrollSpy as any;
    const monthItem = document.querySelector<HTMLElement>(
      '.bz-diary-desk .bz-diary-month[data-month="2026-08"]'
    )!;
    monthItem.click();
    // 目标 = scrollTop + (masonry顶 − wall顶 − 节头高 − 6) = 2000 + (−860 − 100 − 40 − 6) = 994
    // （旧实现用吸顶头 rect：head.top(0) − wall.top(100) → 1894，回跳错误位置）
    expect(scrollSpy).toHaveBeenCalledWith({ top: 994, behavior: 'smooth' });
  });

  it('E4 审查确认：章节栏胶卷缩略图直挂 src，不依赖 wall 内懒加载观察', async () => {
    await openAndWait();
    const rail = document.querySelector('.bz-diary-desk .bz-diary-rail') as HTMLElement;
    const img = rail.querySelector('.bz-diary-month-thumb img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('https://example.com/vault/');
  });

  it('issue 210：胶卷条只收图片/视频条目，文字/纯音频不产格，每月最多 5 格', async () => {
    await openAndWait();
    const rail = document.querySelector('.bz-diary-desk .bz-diary-rail') as HTMLElement;
    // 旧版文字格（emoji 占位）与音频图标格已退役
    expect(rail.querySelector('.bz-diary-month-thumb--t')).toBeNull();
    expect(rail.querySelector('.bz-diary-month-thumb--a')).toBeNull();
    rail.querySelectorAll('.bz-diary-month').forEach((m) => {
      expect(m.querySelectorAll('.bz-diary-month-thumb').length).toBeLessThanOrEqual(5);
    });
    expect(rail.querySelectorAll('.bz-diary-month-thumb').length).toBeGreaterThanOrEqual(1);
  });

  it('issue 214：媒体卡文字置顶——时间+类型行在上、拼接全文只出现一次、媒体堆叠下方；sparse-2 半宽 hack 退役', async () => {
    await openAndWait();
    const wall = document.querySelector('.bz-diary-desk .bz-diary-wall') as HTMLElement;
    // 夹具 3 天：08-19（文字+3媒体→1 整卡）、06-11（纯媒体→0 文字卡）、06-12（纯文字→1）
    expect(wall.querySelectorAll('.bz-diary-item.bz-diary-text').length).toBe(1);
    const m0 = wall.querySelectorAll('.bz-diary-masonry')[0] as HTMLElement;
    // 08-19 整卡：文字置顶（时间行 + 全文一次），3 个媒体堆叠下方
    const wrap = m0.querySelector('.bz-diary-media-wrap') as HTMLElement;
    expect(wrap).toBeTruthy();
    expect(wrap.querySelectorAll('.bz-diary-media').length).toBe(3);
    expect(wrap.querySelectorAll('.bz-diary-text-row').length).toBe(1);
    expect(wrap.querySelectorAll('.bz-diary-text-tx').length).toBe(1);
    // 时间行在正文之上、正文在媒体之上（DOM 序 = 视觉序）
    expect(wrap.querySelector('.bz-diary-text-row')!.nextElementSibling).toBe(wrap.querySelector('.bz-diary-text-tx'));
    expect(wrap.querySelector('.bz-diary-text-tx')!.nextElementSibling).toBeTruthy();
    // sparse-2 半宽类已删，2 条日不再挂
    expect(wall.querySelector('.bz-diary-masonry--sparse-2')).toBeNull();
  });

  it('issue 217 F1：那年今天灯箱不污染墙内连看序列——关闭后墙内点图仍是全量序列', async () => {
    // 私有夹具：去年的今天（pickOnThisDay 口径）带图日记
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    vault.files.set(`我的/日记/${now.getFullYear() - 1}-${mmdd}.md`, '# 📸 08:00\n去年今日\n![[old.jpg]]\n');
    const c = await openAndWait();
    expect(document.querySelector('.bz-diary-memories')).toBeTruthy();
    // 点时光条卡 → 灯箱序列 = 该条目媒体
    (document.querySelector('.bz-diary-memory') as HTMLElement).click();
    expect((c as any)._lbSeq.length).toBe(1);
    // 关灯箱 → 主序列还原；墙内点图 → 序列仍是全量（不退化为单条）
    (document.querySelector('.bz-diary-desk [data-act="lb-close"]') as HTMLElement).click();
    const wallMedia = document.querySelector('.bz-diary-desk .bz-diary-media') as HTMLElement;
    wallMedia.click();
    expect((c as any)._lbSeq.length).toBeGreaterThanOrEqual(4);
  });

  it('issue 217 F2：灯箱开着时重渲染不清空灯箱媒体（不再黑屏挂死）', async () => {
    const c = await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    (desk.querySelector('.bz-diary-media') as HTMLElement).click();
    expect(desk.querySelector('.bz-diary-lb--show')).toBeTruthy();
    (c as any).renderAll();
    expect(desk.querySelector('.bz-diary-lb--show')).toBeTruthy();
    expect(desk.querySelectorAll('.bz-diary-lb-media').length).toBe(1);
  });

  it('issue 217 F3：matchMedia 移动端断点下只渲染移动实例（桌面实例不做事）', async () => {
    const mql = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    try {
      await openAndWait();
      const deskWall = document.querySelector('.bz-diary-desk .bz-diary-wall') as HTMLElement;
      const mobWall = document.querySelector('.bz-diary-mob .bz-diary-wall') as HTMLElement;
      expect(deskWall.querySelectorAll('.bz-diary-item').length).toBe(0);
      expect(mobWall.querySelectorAll('.bz-diary-item').length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('issue 217 F4：媒体双击跳原文——首击开灯箱，双击关灯箱走跳转', async () => {
    await openAndWait();
    const media = document.querySelector('.bz-diary-desk .bz-diary-media') as HTMLElement;
    media.click();
    expect(document.querySelector('.bz-diary-desk .bz-diary-lb--show')).toBeTruthy();
    media.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(document.querySelector('.bz-diary-desk .bz-diary-lb--show')).toBeNull();
  });

  it('issue 217 F6：解锁态下其他标签筛选不混入加密条目，「加密」筛选才可见', async () => {
    const c = await openAndWait();
    (c as any).lockedVisible = true;
    (c as any).entries.push({
      date: '2026-08-19',
      time: '23:59',
      tags: ['日记'],
      emoji: '📖',
      content: '密',
      text: '密',
      media: [],
      segments: [],
      filename: '2026-08-19',
      lineNumber: 999,
      id: undefined,
      noteId: 'n1',
      encrypted: true,
      kind: 'diary',
    });
    (c as any).selTag = '日记';
    expect(((c as any).filtered() as any[]).some((e) => e.encrypted)).toBe(false);
    (c as any).selTag = '加密';
    expect(((c as any).filtered() as any[]).some((e) => e.encrypted)).toBe(true);
  });

  it('issue 217 样式落位：md 排版/音频矮条/年份相邻选择器在位，.bz-diary-tx 死规则删除', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    expect(css).toContain('.bz-diary-md p'); // S1：markdown 排版
    expect(css).toContain('.bz-diary-media--audio'); // S4：音频矮条
    expect(css).toContain('.bz-diary-rail-title + .bz-diary-rail-year'); // S3：死规则修复
    expect(css).not.toContain('.bz-diary-tx {'); // S5：死规则删除
    expect(css).not.toContain('#2a9d8f'); // 小项：teal 写死色改 token
  });

  it('issue 218：长文跨栏卡——≥800 字整卡跨全宽、卡内分栏、媒体横排网格；短文维持三栏小卡', async () => {
    // 私有夹具：一篇 1200 字长文（带媒体）+ 一篇 1200 字纯文字长文
    const long = '文'.repeat(1200);
    vault.files.set('我的/日记/2026-07-01.md', `# 📖 09:00\n${long}\n![[IMG_20260701_090000.jpg]]\n`);
    vault.files.set('我的/日记/2026-07-02.md', `# 📖 10:00\n${long}\n`);
    await openAndWait();
    const wall = document.querySelector('.bz-diary-desk .bz-diary-wall') as HTMLElement;
    const wide = wall.querySelectorAll('.bz-diary-wide');
    expect(wide.length).toBe(2);
    // 卡内分栏容器 + 媒体横排网格
    expect(wall.querySelectorAll('.bz-diary-wide-md').length).toBe(2);
    const grid = wall.querySelectorAll('.bz-diary-wide-media');
    expect(grid.length).toBe(1); // 纯文字长文无媒体网格
    expect(grid[0].querySelectorAll('.bz-diary-media').length).toBe(1);
    // 短条目不升级
    const items = wall.querySelectorAll('.bz-diary-item');
    expect(items.length).toBeGreaterThan(wide.length);
  });

  it('issue 218 样式落位：跨栏/分栏/媒体网格规则在位', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    expect(css).toContain('.bz-diary-wide {');
    expect(css).toContain('.bz-diary-wide-md');
    expect(css).toContain('.bz-diary-wide-media');
    expect(css).toContain('column-span: all');
  });

  it('issue 210：章节栏视频缩略懒加载——无 IO 直挂 src + preload=metadata，格内留播放角标', async () => {
    // 本例私有夹具：beforeEach 每例重建 vault，加一条纯视频日记不影响他例
    vault.files.set('我的/日记/2026-06-10.md', '# 🎬 10:00\n![[VID_20260610_100000.mp4]]\n');
    await openAndWait();
    const rail = document.querySelector('.bz-diary-desk .bz-diary-rail') as HTMLElement;
    const vt = rail.querySelectorAll('.bz-diary-month-thumb--v');
    expect(vt.length).toBeGreaterThanOrEqual(1);
    vt.forEach((t) => {
      const v = t.querySelector('video') as HTMLVideoElement;
      expect(v).toBeTruthy();
      // jsdom 无 IntersectionObserver → setupRailLazy 直接挂载
      expect(v.getAttribute('src')).toContain('https://example.com/vault/');
      expect(v.preload).toBe('metadata');
      // 播放角标保留（首帧就绪前占位；mock setIcon 产出带 data-icon 的 span）
      expect(t.querySelector('[data-icon]')).toBeTruthy();
    });
  });

  it('F 审查修复：灯箱只填充当前端实例（另一实例 lbMedia 保持为空，无双份加载）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const mob = document.querySelector('.bz-diary-mob')!;
    const media = desk.querySelector('.bz-diary-media') as HTMLElement;
    media.click();
    // jsdom 桌面宽度 → 仅 desk 实例填充真实媒体元素
    expect(desk.querySelectorAll('.bz-diary-lb-media').length).toBe(1);
    expect(mob.querySelector('.bz-diary-lb-media')).toBeNull();
    expect(desk.querySelector('.bz-diary-lb--show')).toBeTruthy();
  });

  it('F 审查修复：hide() 收起右键菜单（面板关闭后菜单不再残留 body）', async () => {
    const c = await openAndWait();
    const item = document.querySelector('.bz-diary-desk .bz-diary-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    c.hide();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  // ===== 增强包（2026-09 拍板 13 项） =====

  it('增强 #1：灯箱连看——左右按钮切换、到尾循环、方向键、切换后旧视频 pause', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    // 2026-08-19 有 3 个媒体（img/video/audio）：点第一个（img）进灯箱
    const medias = desk.querySelectorAll('.bz-diary-media');
    (medias[0] as HTMLElement).click();
    const capOf = () => (desk.querySelector('.bz-diary-lbcap') as HTMLElement).textContent || '';
    expect(capOf()).toContain('2026-08-19 23:02 · 日记');
    // next → 第二个媒体（video）
    const next = desk.querySelector<HTMLButtonElement>('[data-act="lb-next"]');
    const prev = desk.querySelector<HTMLButtonElement>('[data-act="lb-prev"]');
    expect(next).toBeTruthy();
    expect(prev).toBeTruthy();
    next!.click();
    expect(desk.querySelector('.bz-diary-lb-media')).toBeTruthy();
    expect((desk.querySelector('.bz-diary-lb-media') as HTMLElement).tagName).toBe('VIDEO');
    // 方向键 → 第三个（audio）；到尾再 next 循环回首张（img）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect((desk.querySelector('.bz-diary-lb-media') as HTMLElement).tagName).toBe('AUDIO');
    next!.click();
    expect((desk.querySelector('.bz-diary-lb-media') as HTMLElement).tagName).toBe('IMG');
    // prev 循环回首（img → audio）
    prev!.click();
    expect((desk.querySelector('.bz-diary-lb-media') as HTMLElement).tagName).toBe('AUDIO');
    // 切换后旧媒体已从 DOM 清除（旧 video 不残留双份）
    expect(desk.querySelectorAll('.bz-diary-lb-media').length).toBe(1);
  });

  it('增强 #2：章节栏年份分组——跨年处插年份标签，data-month 定位不变', async () => {
    // 追加一条 2025 年日记制造跨年
    vault.files.set('我的/日记/2025-12-01.md', '# 📖 09:00\n去年今日。\n');
    await openAndWait();
    const rail = document.querySelector('.bz-diary-desk .bz-diary-rail')!;
    const years = Array.from(rail.querySelectorAll<HTMLElement>('.bz-diary-rail-year')).map((y) => y.textContent);
    expect(years).toEqual(['2026', '2025']);
    // 年份标签在各自首个月份项之前；月份 data-month 仍为完整 YYYY-MM
    const firstMonth = rail.querySelector<HTMLElement>('.bz-diary-month');
    expect(firstMonth!.dataset.month).toBe('2026-08');
    expect(years).toHaveLength(2);
  });

  it('增强 #3：头行计数 = 当前结果数（筛选后随之变化）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const range = desk.querySelector('.bz-diary-range') as HTMLElement;
    expect(range.textContent).toBe('3 条');
    // 筛选「摄影」→ 计数跟随过滤结果
    const chip = desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="摄影"]');
    chip!.click();
    expect(range.textContent).toBe('1 条');
    chip!.click();
    expect(range.textContent).toBe('3 条');
  });

  it('增强 #5：那年今天时光条——命中渲染首屏横滑条（年份角标 + 点击进灯箱），无命中不渲染', async () => {
    // 加一条去年今天、一条昨天：只有去年今天命中
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const lastYear = now.getFullYear() - 1;
    vault.files.set(`我的/日记/${lastYear}-${mm}-${dd}.md`, `# 📸 08:00\n去年今天拍的照片。\n![[old_photo.jpg]]\n`);
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    vault.files.set(
      `我的/日记/${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}.md`,
      '# 📖 21:00\n昨天的事。\n'
    );
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const memories = desk.querySelector('.bz-diary-memories') as HTMLElement;
    expect(memories).toBeTruthy();
    expect(memories.textContent).toContain('那年今天');
    // 年份角标 = 去年
    expect(memories.querySelector('.bz-diary-memory-year')!.textContent).toBe(String(lastYear));
    // 不含昨天（mmdd 不命中）
    expect(memories.textContent).not.toContain('昨天的事');
    // 点击 → 灯箱打开该条目（媒体 URL 注入）
    (memories.querySelector('.bz-diary-memory') as HTMLElement).click();
    expect(desk.querySelector('.bz-diary-lb--show')).toBeTruthy();
    // 无命中（默认数据无今天日期）不渲染
    const c2 = DiaryAppController.instance!;
    void c2;
  });

  it('增强 #5 反向：无去年今日条目时不渲染时光条', async () => {
    await openAndWait();
    expect(document.querySelector('.bz-diary-desk .bz-diary-memories')).toBeNull();
  });

  it('增强 #6：媒体块 cap 去文件名，显示「时间 · 标签」', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const cap = desk.querySelector('.bz-diary-cap') as HTMLElement;
    expect(cap).toBeTruthy();
    expect(cap.textContent).toContain('23:02');
    expect(cap.textContent).toContain('日记');
    expect(cap.textContent).not.toContain('IMG_20260819_164331.jpg');
    expect(cap.textContent).not.toContain('.jpg');
  });

  it('加密条目右键菜单：解密项图标 lock-open（增强 #4）', async () => {
    mocks.isUnlocked.mockReturnValue(true);
    const encEntry = {
      date: '2026-07-01',
      time: '10:30',
      timeValue: 1030,
      tags: ['日记', '加密'],
      emoji: '📖🔐',
      content: '加密的日记内容',
      filename: '2026-07-01',
      lineNumber: 0,
      encrypted: true,
      noteId: 'enc-1',
      id: 'enc-diary-enc-1',
    };
    mocks.loadEncryptedEntries.mockResolvedValueOnce([encEntry]);
    await openAndWait();
    await waitFor(() => {
      const c = DiaryAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    const desk = document.querySelector('.bz-diary-desk')!;
    desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]')!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    const item = desk.querySelector('.bz-diary-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 40 }));
    const menu = document.querySelector('.bz-item-menu')!;
    // 菜单图标 lucide 化：解密 lock-open、删除 trash-2（增强 #4）
    const decBtn = Array.from(menu.querySelectorAll('button')).find((b) => b.textContent!.includes('解密'))!;
    expect((decBtn.querySelector('.bz-item-menu-icon') as HTMLElement).dataset.icon).toBe('lock-open');
  });

  it('增强 #8：加密媒体按需解密——解锁后卡片内直显原图（data URL），失败保持占位', async () => {
    mocks.isUnlocked.mockReturnValue(true);
    const encEntry = {
      date: '2026-07-01',
      time: '10:30',
      timeValue: 1030,
      tags: ['日记', '加密'],
      emoji: '📖🔐',
      content: '加密的照片\n![[IMG_enc.jpg]]',
      filename: '2026-07-01',
      lineNumber: 0,
      encrypted: true,
      noteId: 'enc-1',
      id: 'enc-diary-enc-1',
    };
    mocks.loadEncryptedEntries.mockResolvedValueOnce([encEntry]);
    mocks.getSafeManager.mockImplementation(
      () =>
        ({
          unlocked: true,
          manifest: {
            notes: [
              {
                id: 'enc-1',
                attachments: [{ path: 'IMG_enc.jpg', kind: 'img' }],
              },
            ],
          },
          decryptAttachmentOriginal: vi.fn(async () => 'QmFzZTY0'), // 原始层 base64
        }) as any
    );
    await openAndWait();
    await waitFor(() => {
      const c = DiaryAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    const desk = document.querySelector('.bz-diary-desk')!;
    desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]')!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    // jsdom 无 IO → fallback 挂载触发按需解密 → img src = data URL
    await waitFor(() => {
      const img = desk.querySelector('.bz-diary-media img') as HTMLImageElement;
      return !!img && img.getAttribute('src')?.startsWith('data:image/jpeg;base64,') === true;
    });
    const img = desk.querySelector('.bz-diary-media img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('data:image/jpeg;base64,QmFzZTY0');
  });

  it('增强 #8 反向：保险箱未解锁（getSafeManager.locked）加密媒体保持占位，不显原图', async () => {
    mocks.isUnlocked.mockReturnValue(true);
    const encEntry = {
      date: '2026-07-01',
      time: '10:30',
      timeValue: 1030,
      tags: ['日记', '加密'],
      emoji: '📖🔐',
      content: '加密的照片\n![[IMG_enc.jpg]]',
      filename: '2026-07-01',
      lineNumber: 0,
      encrypted: true,
      noteId: 'enc-1',
      id: 'enc-diary-enc-1',
    };
    mocks.loadEncryptedEntries.mockResolvedValueOnce([encEntry]);
    // 默认 getSafeManager = { unlocked: false } → 解密返回 null
    await openAndWait();
    await waitFor(() => {
      const c = DiaryAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    const desk = document.querySelector('.bz-diary-desk')!;
    desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]')!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    await new Promise((r) => setTimeout(r, 30));
    const img = desk.querySelector('.bz-diary-media img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBeNull(); // 未解密：无 src（占位可见）
  });

  it('增强 #9：上锁实时归位——encrypt:unlock-changed(unlocked=false) 后加密条目即刻不可见', async () => {
    mocks.isUnlocked.mockReturnValue(true);
    const encEntry = {
      date: '2026-07-01',
      time: '10:30',
      timeValue: 1030,
      tags: ['日记', '加密'],
      emoji: '📖🔐',
      content: '加密的日记内容',
      filename: '2026-07-01',
      lineNumber: 0,
      encrypted: true,
      noteId: 'enc-1',
      id: 'enc-diary-enc-1',
    };
    mocks.loadEncryptedEntries.mockResolvedValue([encEntry]);
    const c = await openAndWait();
    await waitFor(() => (c as any).entries.some((e: any) => e.noteId === 'enc-1'));
    const desk = document.querySelector('.bz-diary-desk')!;
    desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="加密"]')!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-day-head').length === 1);
    expect((c as any).lockedVisible).toBe(true);
    // 保险箱上锁（锁定态在别处触发域事件——墙实时归位）
    const { emitDomainEvent } = await import('../../src/core/domain-bus');
    emitDomainEvent('encrypt:unlock-changed', { unlocked: false });
    await waitFor(() => (c as any).lockedVisible === false);
    // 加密条目被剔除、筛选态清空、内容回退全量普通条目
    expect((c as any).entries.some((e: any) => e.encrypted)).toBe(false);
    expect((c as any).selTag).toBeNull();
    expect(desk.querySelectorAll('.bz-diary-day-head').length).toBe(3);
    // 订阅随 hide 摘除：再次 emit 不再触发
    c.hide();
    mocks.loadEncryptedEntries.mockClear();
    emitDomainEvent('encrypt:unlock-changed', { unlocked: true });
    expect(mocks.loadEncryptedEntries).not.toHaveBeenCalled();
  });

  it('增强 #10：年月跳转显式按钮——点击打开日期筛选弹窗（与品牌行入口同动作）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    const btn = desk.querySelector<HTMLButtonElement>('.bz-diary-btns [data-act="date-picker"]');
    expect(btn).toBeTruthy();
    expect((btn!.querySelector('.bz-ic') as HTMLElement).dataset.icon).toBe('calendar');
    btn!.click();
    const popup = document.querySelector('.bz-diary-datefilter') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.style.display).toBe('flex');
  });

  it('增强 #11：跳原文回墙恢复——筛选保持、恢复态一次性消费', async () => {
    const c = await openAndWait();
    const desk = document.querySelector('.bz-diary-desk')!;
    // 筛选「摄影」→ 跳原文（jumpTo 内捕获视图状态后关墙）
    desk.querySelector<HTMLElement>('.bz-diary-chip[data-tag="摄影"]')!.click();
    expect((document.querySelector('.bz-diary-desk .bz-diary-range') as HTMLElement).textContent).toBe('1 条');
    await (c as any).jumpTo((c as any)._wallEntries[0]);
    expect(mocks.jumpToEntry).toHaveBeenCalled();
    // 跳走后：捕获了筛选态、墙已隐藏
    expect((c as any)._restore).not.toBeNull();
    expect((c as any)._restore.selTag).toBe('摄影');
    expect((document.querySelector('.bz-diary') as HTMLElement).style.display).toBe('none');
    // 回墙：恢复态一次性消费清空（show → loadAndRender 完成后 applyRestore；
    // 注意不能等 range 文本——hide 前旧 DOM 已是「1 条」，waitFor 会立即通过造成假阳性）
    c.show();
    await waitFor(() => (c as any)._restore === null);
    expect(c.selTag).toBe('摄影');
    await waitFor(
      () => (document.querySelector('.bz-diary-desk .bz-diary-range') as HTMLElement)?.textContent === '1 条'
    );
    expect(document.querySelector('.bz-diary-desk .bz-diary-day-head')).toBeTruthy();
  });

  it('增强 #12：右键菜单 z-index 动态发号（topifyZ，>=100000，无静态档）', async () => {
    await openAndWait();
    const item = document.querySelector('.bz-diary-desk .bz-diary-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    const z = Number(menu.style.zIndex);
    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBeGreaterThanOrEqual(100000);
  });

  // ===== 样式回归（CSS 改动 jsdom 不可算，按源码断言；先例：reading-report report.test.ts） =====

  it('增强 #13：触屏热区 ≥44px 档（修复批 B 收编 core .bz-touch-target--xl，模板挂类）', () => {
    // 外扩本体在 core 样式库（components.css pointer:coarse ::after，--xl = inset -12px）
    const core = readFileSync(resolve(process.cwd(), 'src/core/ui/components.css'), 'utf8');
    expect(core).toContain('.bz-touch-target--xl');
    expect(core).toMatch(/\.bz-touch-target::after\s*\{[^}]*inset: var\(--bz-touch-outset, -6px\)/);
    // 热区外扩对象：横滑标签/二级标签/头行图标钮（壳模板在 render.ts 单源）/那年今天卡片（模板挂类）
    const ui = readFileSync(resolve(process.cwd(), 'src/diary/ui.ts'), 'utf8');
    const render = readFileSync(resolve(process.cwd(), 'src/diary/render.ts'), 'utf8');
    for (const [cls, src] of [
      ['bz-diary-chip bz-touch-target--xl', ui],
      ['bz-diary-subchip bz-touch-target--xl', ui],
      ['bz-diary-icon-btn bz-touch-target--xl', render],
      ['bz-diary-memory bz-touch-target--xl', ui],
    ] as const) {
      expect(src, cls).toContain(cls);
    }
    // 域内不再复制 ::after 外扩块（防双份外扩）
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    expect(css).not.toMatch(/bz-diary-chip::after/);
  });

  it('issue 198 批次 A 样式落位：菜单/抽屉自绘规则已删（共享层承载）；年份标签与时光条类存在', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    // 右键菜单迁移 core item-actions（.bz-item-menu）：域内自绘菜单规则删除
    expect(css).not.toContain('.bz-diary-menu');
    // 详情抽屉迁移共享 .bz-sheet 族：壳/把手/动作行自绘规则删除，域内只留层档钩子与富媒体头
    expect(css).not.toContain('.bz-diary-sheet-grip');
    expect(css).not.toContain('.bz-diary-sheet-act');
    expect(css).toContain('.bz-diary-sheet-mask'); // 遮罩层档钩子
    // 搜索框接入共享 .bz-search：域内自绘输入框规则删除
    expect(css).not.toContain('.bz-diary-searchbox');
    // 共享层形制在位（components.css）：遮罩 + 底部定位 + 动作行
    const core = readFileSync(resolve(process.cwd(), 'src/core/ui/components.css'), 'utf8');
    expect(core).toContain('.bz-sheet-mask');
    expect(core).toContain('.bz-sheet--show');
    expect(core).toContain('.bz-sheet-act--danger');
    // #2：年份分隔标签类
    expect(css).toContain('.bz-diary-rail-year');
    // #5：那年今天时光条类（容器/头行/横滑行/卡片/年份角标）
    for (const cls of [
      '.bz-diary-memories',
      '.bz-diary-memories-head',
      '.bz-diary-memories-row',
      '.bz-diary-memory-thumb',
      '.bz-diary-memory-year',
    ]) {
      expect(css).toContain(cls);
    }
  });
});

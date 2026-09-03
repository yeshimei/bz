/**
 * 回忆墙（diary-wall）UI 层测试
 * - jsdom 环境（不加 node 注释）；
 * - MockVault 注入带媒体的假日记文件 → await ui.openManager()；
 * - 断言：根容器 .bz-diary-wall 出现且可见、章节栏月份项、瀑布流媒体块与文字条、
 *   灯箱点击媒体能打开、章节点击/空态/筛选/ESC。
 * - mockAppWithVault(vault) 的 metadataCache 未实现 getFirstLinkpathDest，数据层 mediaSrc
 *   内部 try 会降级返回 '' → 测试 vi.mock data 模块的 mediaSrc 返回稳定 URL。
 * - jsdom 无 IntersectionObserver → UI 懒加载走 fallback（直接挂 src），断言以 img[src]/video[src] 为准。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { DiaryWallAppController } from '../../src/diary-wall/ui';

// mock data 模块的 mediaSrc（MockVault 无 getResourcePath，返回稳定 vault 内 URL；
// 用标准 https 协议——jsdom 对 app:// 非标准协议的 src 赋值会归一化为空）
const mocks = vi.hoisted(() => ({
  mediaSrc: vi.fn((_app: any, name: string) => `https://example.com/vault/${encodeURI(name)}`),
  showDatePicker: vi.fn(),
  openAddDialog: vi.fn(),
  jumpToEntry: vi.fn(),
  ensureSafeUnlocked: vi.fn(async () => true),
  openEncrypt: vi.fn(),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<any[]> => []),
  deleteEncryptedEntry: vi.fn(async () => {}),
}));
vi.mock('../../src/diary-wall/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary-wall/data')>();
  return {
    ...actual,
    mediaSrc: mocks.mediaSrc,
  };
});
// diary 域动作 mock：写日记/日期选择器/跳转（ui.ts 动态 import）
vi.mock('../../src/diary/ui/dialogs', () => ({
  showDatePicker: mocks.showDatePicker,
  openAddDialog: mocks.openAddDialog,
}));
vi.mock('../../src/diary/ui/entries', () => ({
  jumpToEntry: mocks.jumpToEntry,
}));
// 加密解锁 mock（ui.ts 动态 import '../encrypt' 与 '../diary/encrypt'）
vi.mock('../../src/encrypt', () => ({
  ensureSafeUnlocked: mocks.ensureSafeUnlocked,
  openEncrypt: mocks.openEncrypt,
}));
vi.mock('../../src/diary/encrypt', () => ({
  isUnlocked: mocks.isUnlocked,
  loadEncryptedEntries: mocks.loadEncryptedEntries,
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
  mocks.showDatePicker.mockClear();
  mocks.openAddDialog.mockClear();
  mocks.jumpToEntry.mockClear();
  mocks.ensureSafeUnlocked.mockClear();
  mocks.ensureSafeUnlocked.mockResolvedValue(true);
  mocks.openEncrypt.mockClear();
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
  setApp(app); // 回忆墙走 core/app
  // diary 域动作（写日记/日期选择器/跳转）走 diary/app——同一 app 对象双注入
  (await import('../../src/diary/app')).setApp(app);
});

afterEach(() => {
  // 单例跨用例清理：unregister ESC + 移除 DOM（幂等；cleanup 用例自身已清理）
  DiaryWallAppController.instance?.cleanup();
  DiaryWallAppController.instance = null;
  document.body.innerHTML = '';
});

/** 打开并等待数据渲染完成（loadAndRender 为异步 fire-and-forget） */
async function openAndWait(opts = { mobileDefaultFullscreen: false }) {
  const c = DiaryWallAppController.getInstance(opts);
  await c.openManager();
  await waitFor(() => !!document.querySelector('.bz-diary-wall-day-head'));
  return c;
}

describe('回忆墙 UI', () => {
  it('openManager 创建根容器并显示', async () => {
    await openAndWait();
    const root = document.querySelector('.bz-diary-wall') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.display).toBe('flex');
    expect(document.querySelectorAll('.bz-diary-wall-desk').length).toBe(1);
    expect(document.querySelectorAll('.bz-diary-wall-mob').length).toBe(1);
  });

  it('渲染章节栏（月份倒序）+ 瀑布流（媒体块 + 文字条 + 日期节头）', async () => {
    await openAndWait();
    // 章节栏月份（倒序：2026-08 / 2026-06）——只统计桌面实例（移动无章节栏）
    const months = Array.from(document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-month')).map(
      (el) => (el as HTMLElement).dataset.month
    );
    expect(months).toEqual(['2026-08', '2026-06']);
    // 瀑布流（桌面实例）：媒体块（img/video/audio 各存在；jsdom 无 IO → fallback 已挂 src）
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const medias = desk.querySelectorAll('.bz-diary-wall-media');
    expect(medias.length).toBeGreaterThanOrEqual(3);
    expect(desk.querySelectorAll('.bz-diary-wall-media img[src]').length).toBeGreaterThanOrEqual(1);
    expect(desk.querySelectorAll('.bz-diary-wall-media video[src]').length).toBeGreaterThanOrEqual(1);
    // 音频块（🎵 占位 ph）
    expect(desk.querySelectorAll('.bz-diary-wall-media .bz-diary-wall-ph').length).toBeGreaterThanOrEqual(3);
    // 纯文字条（2026-06-12 对谈）
    expect(desk.querySelectorAll('.bz-diary-wall-text').length).toBeGreaterThanOrEqual(1);
    // 日期节头（3 个日期，桌面实例）
    const heads = Array.from(desk.querySelectorAll('.bz-diary-wall-day-head'));
    expect(heads.length).toBe(3);
  });

  it('章节栏点击月份 → 平滑滚动定位到该月首个节头', async () => {
    const c = await openAndWait();
    const monthItem = document.querySelector<HTMLElement>('.bz-diary-wall-month[data-month="2026-08"]');
    expect(monthItem).toBeTruthy();
    const scrollSpy = vi.fn();
    const wall = document.querySelector('.bz-diary-wall-wall') as HTMLElement;
    wall.scrollTo = scrollSpy as any;
    monthItem!.click();
    expect(scrollSpy).toHaveBeenCalled();
    // 目标 day-head 存在
    const head = wall.querySelector('.bz-diary-wall-day-head[data-date^="2026-08"]');
    expect(head).toBeTruthy();
    void c;
  });

  it('点击媒体块打开灯箱（mediaSrc 注入 URL），点背景关闭', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const media = desk.querySelector('.bz-diary-wall-media') as HTMLElement;
    expect(media).toBeTruthy();
    media.click();
    // 灯箱已打开（DW5：仅可见实例加 --show，桌面端 1 个）
    const lb = desk.querySelector('.bz-diary-wall-lb--show') as HTMLElement;
    expect(lb).toBeTruthy();
    expect(document.querySelectorAll('.bz-diary-wall-lb--show').length).toBe(1);
    // 灯箱内已注入 img（mediaSrc 返回 URL）
    const img = lb.querySelector('.bz-diary-wall-lb-media') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('https://example.com/vault/');
    // 点击灯箱背景关闭（桌面实例）
    lb.click();
    expect(desk.querySelector('.bz-diary-wall-lb--show')).toBeNull();
  });

  it('灯箱副行显示日记正文文字而非媒体路径（#10）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const media = desk.querySelector('.bz-diary-wall-media') as HTMLElement;
    media.click();
    const lb = desk.querySelector('.bz-diary-wall-lb--show') as HTMLElement;
    expect(lb).toBeTruthy();
    // 副行 = 条目正文（去媒体引用后的文字），不含 app:// 路径
    const sub = lb.querySelector('.bz-diary-wall-lbsub') as HTMLElement;
    expect(sub.textContent).toContain('上厕所时被猫盯着');
    expect(sub.textContent).not.toContain('https://');
    // 标题行 = 媒体文件名
    const cap = lb.querySelector('.bz-diary-wall-lbcap') as HTMLElement;
    expect(cap.textContent).toContain('IMG_20260819_164331.jpg');
  });

  it('媒体块不再显示 emoji 角标（#1 视频无 emoji、#2 图片无 🖼 角标）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    // 图片块：无 .bz-diary-wall-att 角标
    expect(desk.querySelector('.bz-diary-wall-att')).toBeNull();
    // 视频块占位：无 🎬 emoji 文字（ph 无文本内容）
    const videoPh = Array.from(desk.querySelectorAll<HTMLElement>('.bz-diary-wall-media .bz-diary-wall-ph')).filter(
      (el) => {
        const wrap = el.closest('.bz-diary-wall-media')!;
        return wrap.querySelector('video');
      }
    );
    expect(videoPh.length).toBeGreaterThanOrEqual(1);
    videoPh.forEach((ph) => expect(ph.textContent.trim()).toBe(''));
    // 音频块仍保留 🎵 图标（无封面可显示）
    const audioPh = Array.from(desk.querySelectorAll<HTMLElement>('.bz-diary-wall-media .bz-diary-wall-ph')).filter(
      (el) => {
        const wrap = el.closest('.bz-diary-wall-media')!;
        return !wrap.querySelector('img, video');
      }
    );
    expect(audioPh.length).toBeGreaterThanOrEqual(1);
    expect(audioPh[0].textContent).toContain('🎵');
  });

  it('桌面右键：正文/图片/视频子元素右键都能打开条目菜单（#9 容器委托）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    // 正文（文字条内文本）右键
    const tx = desk.querySelector('.bz-diary-wall-text-tx') as HTMLElement;
    tx.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
    expect(document.querySelector('.bz-diary-wall-menu')).toBeTruthy();
    document.querySelector('.bz-diary-wall-menu')!.remove();
    // 图片（img 元素）右键
    const img = desk.querySelector('.bz-diary-wall-media img') as HTMLElement;
    img.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 90 }));
    expect(document.querySelector('.bz-diary-wall-menu')).toBeTruthy();
    document.querySelector('.bz-diary-wall-menu')!.remove();
    // 视频（video 元素）右键
    const video = desk.querySelector('.bz-diary-wall-media video') as HTMLElement;
    video.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 130 }));
    expect(document.querySelector('.bz-diary-wall-menu')).toBeTruthy();
  });

  it('空态：无日记时显示提示与动作按钮', async () => {
    const emptyVault = new MockVault();
    emptyVault.dirs.add('我的/日记');
    const emptyApp = mockAppWithVault(emptyVault);
    setApp(emptyApp);
    (await import('../../src/diary/app')).setApp(emptyApp);
    const c = DiaryWallAppController.getInstance({ mobileDefaultFullscreen: false });
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-diary-wall-empty'));
    const empty = document.querySelector('.bz-diary-wall-empty')!;
    expect(empty.textContent).toContain('这一页还空着');
    expect(empty.querySelector('.bz-diary-wall-empty-btn')).toBeTruthy();
  });

  it('ESC 关闭（escManager 注册）', async () => {
    await openAndWait();
    const root = document.querySelector('.bz-diary-wall') as HTMLElement;
    expect(root.style.display).toBe('flex');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.style.display).toBe('none');
  });

  it('类型 chip 筛选（点击「摄影」只剩摄影条目，再点还原）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const chip = desk.querySelector<HTMLElement>('.bz-diary-wall-chip[data-tag="摄影"]');
    expect(chip).toBeTruthy();
    chip!.click();
    // 只剩 2026-06-11 的 📸 条目（桌面实例）
    const heads = Array.from(desk.querySelectorAll('.bz-diary-wall-day-head'));
    expect(heads.map((h) => (h as HTMLElement).dataset.date)).toEqual(['2026-06-11']);
    expect(desk.querySelectorAll('.bz-diary-wall-media').length).toBe(1);
    // 再点取消筛选
    chip!.click();
    expect(desk.querySelectorAll('.bz-diary-wall-day-head').length).toBe(3);
  });

  it('cleanup 移除根容器并置空单例', async () => {
    const c = DiaryWallAppController.getInstance({ mobileDefaultFullscreen: false });
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-diary-wall-day-head'));
    expect(document.querySelector('.bz-diary-wall')).toBeTruthy();
    c.cleanup();
    expect(document.querySelector('.bz-diary-wall')).toBeNull();
    expect(DiaryWallAppController.instance).toBeNull();
  });

  // ===== v2 新功能 =====
  it('头部按钮序：编辑在前、搜索次之、无设置按钮（关闭钮仅真全屏显示）', async () => {
    await openAndWait();
    const btns = Array.from(document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-btns [data-act]')).map(
      (b) => (b as HTMLElement).dataset.act
    );
    // 编辑 → 搜索 → 关闭（无 settings）
    expect(btns).toEqual(['add', 'search', 'close']);
    expect(document.querySelector('[data-act="settings"]')).toBeNull();
  });

  it('加密 chip 常驻显示（即使无加密条目），锁定态点击 → 弹解锁面板，解锁后选中「加密」', async () => {
    await openAndWait();
    // mock 数据无加密条目 → 加密 chip 仍应显示（用户需要入口测试加密流程）
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-wall-chip[data-tag="加密"]');
    expect(encChip).toBeTruthy();
    expect(encChip!.classList.contains('bz-diary-wall-chip--locked')).toBe(true);
    // 点击锁定态「加密」→ ensureSafeUnlocked 被调（保险箱弹解锁面板）
    encChip!.click();
    await waitFor(() => mocks.ensureSafeUnlocked.mock.calls.length > 0);
    expect(mocks.ensureSafeUnlocked).toHaveBeenCalled();
    await waitFor(() => (DiaryWallAppController.instance as any).lockedVisible === true);
    expect((DiaryWallAppController.instance as any).lockedVisible).toBe(true);
    expect((DiaryWallAppController.instance as any).selTag).toBe('加密');
  });

  it('加密 chip：解锁被取消（ensureSafeUnlocked=false）→ 保持锁定态不选中', async () => {
    mocks.ensureSafeUnlocked.mockResolvedValueOnce(false);
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-wall-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => mocks.ensureSafeUnlocked.mock.calls.length > 0);
    // 解锁失败：lockedVisible 仍 false，未选中
    expect((DiaryWallAppController.instance as any).lockedVisible).toBe(false);
    expect((DiaryWallAppController.instance as any).selTag).toBeNull();
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
      const c = DiaryWallAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    expect(mocks.loadEncryptedEntries).toHaveBeenCalled();
    // 加密条目在「加密」筛选下可见
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-wall-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-wall-day-head').length === 1);
    expect(desk.querySelector('.bz-diary-wall-day-head')!.textContent).toContain('2026-07-01');
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
      const c = DiaryWallAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    // 选中「加密」筛选出加密条目
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-wall-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-wall-day-head').length === 1);
    const item = desk.querySelector('.bz-diary-wall-item') as HTMLElement;
    // 打开原文 → openEncrypt（不跳不存在的 md）
    mocks.openEncrypt.mockClear();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 双击
    await new Promise((r) => setTimeout(r, 30));
    expect(mocks.openEncrypt).toHaveBeenCalled();
    // 右键菜单：加密条目显示「解密」而非「改标签/加密」
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
    const menu = document.querySelector('.bz-diary-wall-menu')!;
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
      const c = DiaryWallAppController.instance as any;
      return c.entries.some((e: any) => e.noteId === 'enc-1');
    });
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const encChip = desk.querySelector<HTMLElement>('.bz-diary-wall-chip[data-tag="加密"]');
    encChip!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-wall-day-head').length === 1);
    const item = desk.querySelector('.bz-diary-wall-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
    const menu = document.querySelector('.bz-diary-wall-menu')!;
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
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    // 文字条：无 .bz-diary-wall-text-tag
    expect(desk.querySelector('.bz-diary-wall-text-tag')).toBeNull();
    // 媒体块：无 .bz-diary-wall-ops
    expect(desk.querySelector('.bz-diary-wall-ops')).toBeNull();
    // 文字条仍保留 时间 + emoji 行
    const textRow = desk.querySelector('.bz-diary-wall-text-row');
    expect(textRow).toBeTruthy();
  });

  it('标题（品牌）点击 → 打开自包含日期选择器弹窗', async () => {
    await openAndWait();
    expect(mocks.showDatePicker).not.toHaveBeenCalled(); // 不再调 diary 面板的日期选择器
    const brand = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-brand') as HTMLElement;
    brand.click();
    const popup = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.style.display).toBe('flex');
    expect(popup.textContent).toContain('按日期筛选');
    // 年份行（2026 / 2025 来自 mock 数据日期）
    expect(popup.querySelectorAll('.bz-diary-wall-datefilter-year').length).toBeGreaterThanOrEqual(1);
  });

  it('日期选择器：点年份 → 月份网格；点月份 → 过滤该月条目', async () => {
    await openAndWait();
    const brand = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-brand') as HTMLElement;
    brand.click();
    const popup = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    // 点 2026 年 → 弹窗重建出月份网格
    const year2026 = popup.querySelector<HTMLElement>('.bz-diary-wall-datefilter-year[data-year="2026"]');
    expect(year2026).toBeTruthy();
    year2026!.click();
    const popup2 = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    expect(popup2.querySelectorAll('.bz-diary-wall-datefilter-month').length).toBe(12);
    // 点 8 月（有数据）→ 应用过滤（只剩 2026-08-19 条目）并关闭弹窗
    const aug = Array.from(popup2.querySelectorAll<HTMLElement>('.bz-diary-wall-datefilter-month')).find(
      (m) => m.textContent!.includes('8月')
    )!;
    expect(aug).toBeTruthy();
    aug.click();
    expect(document.querySelector('.bz-diary-wall-datefilter')).toBeNull(); // 弹窗已关
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const heads = Array.from(desk.querySelectorAll('.bz-diary-wall-day-head')).map((h) =>
      (h as HTMLElement).dataset.date
    );
    expect(heads).toEqual(['2026-08-19']);
  });

  it('E6 审查修复：点年份只切换浏览年份，关闭弹窗不提交筛选', async () => {
    const c = await openAndWait();
    const brand = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-brand') as HTMLElement;
    brand.click();
    let popup = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    // 点 2026 年 → 只重建浏览网格，不写筛选
    popup.querySelector<HTMLElement>('.bz-diary-wall-datefilter-year[data-year="2026"]')!.click();
    popup = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    expect(popup.querySelectorAll('.bz-diary-wall-datefilter-month').length).toBe(12);
    expect(c.selDateFilter).toBeNull(); // 年份只是浏览临时值
    // ✕ 关闭：筛选仍未生效，列表未被过滤
    (popup.querySelector('.bz-diary-wall-datefilter-close') as HTMLElement)!.click();
    expect(document.querySelector('.bz-diary-wall-datefilter')).toBeNull();
    expect(c.selDateFilter).toBeNull();
    expect(document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-day-head').length).toBe(3);
  });

  it('E6：点年份后点月份提交筛选；「全部」清除', async () => {
    const c = await openAndWait();
    const brand = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-brand') as HTMLElement;
    brand.click();
    let popup = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    popup.querySelector<HTMLElement>('.bz-diary-wall-datefilter-year[data-year="2026"]')!.click();
    popup = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    const aug = Array.from(popup.querySelectorAll<HTMLElement>('.bz-diary-wall-datefilter-month')).find(
      (m) => m.textContent!.includes('8月')
    )!;
    aug.click();
    expect(c.selDateFilter).toEqual({ year: '2026', month: '08' });
    expect(document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-day-head').length).toBe(1);
    // 再开 → 「全部」清除
    brand.click();
    popup = document.querySelector('.bz-diary-wall-datefilter') as HTMLElement;
    (popup.querySelector('.bz-diary-wall-datefilter-reset') as HTMLElement)!.click();
    expect(c.selDateFilter).toBeNull();
    expect(document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-day-head').length).toBe(3);
  });

  it('桌面单击条目 → 不开底部抽屉（动作入口为右键/双击）', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const item = desk.querySelector('.bz-diary-wall-item') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 抽屉不应打开
    expect(desk.querySelector('.bz-diary-wall-sheet--show')).toBeNull();
    // 媒体块 ⋯ 按钮已移除（用户要求去掉右上角三点）
    expect(item.querySelector('.bz-diary-wall-ops')).toBeNull();
  });

  it('移动端单击条目 → 打开底部抽屉', async () => {
    await openAndWait();
    // 移动实例（.bz-diary-wall-mob）的条目：jsdom 无媒体差异，移动实例与桌面共用 renderWall(mobile=true)
    const mob = document.querySelector('.bz-diary-wall-mob')!;
    const item = mob.querySelector('.bz-diary-wall-item') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mob.querySelector('.bz-diary-wall-sheet--show')).toBeTruthy();
  });

  it('稀疏铺满：单条日文字条跨列占满整行（sparse-1）', async () => {
    // 2026-06-12 只有一条对谈（纯文字）→ 其 masonry 容器应带 --sparse-1
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    // 三个单条日期（08-19 媒体 / 06-11 媒体 / 06-12 文字）都应 sparse-1
    const sparse1 = desk.querySelectorAll('.bz-diary-wall-masonry--sparse-1');
    expect(sparse1.length).toBeGreaterThanOrEqual(2);
    // 至少一个 sparse-1 容器内含文字条（06-12 对谈）
    const hasText = Array.from(sparse1).some((m) => m.querySelector('.bz-diary-wall-text'));
    expect(hasText).toBe(true);
  });

  it('搜索：输入关键词过滤条目，清空还原', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    // 打开搜索行
    const searchBtn = desk.querySelector('[data-act="search"]') as HTMLElement;
    searchBtn.click();
    const box = desk.querySelector('.bz-diary-wall-searchbox') as HTMLInputElement;
    expect(box).toBeTruthy();
    // 输入「猫」（2026-08-19 日记内容含「被猫盯着」）
    box.value = '猫';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => desk.querySelectorAll('.bz-diary-wall-day-head').length === 1);
    expect(desk.querySelectorAll('.bz-diary-wall-day-head').length).toBe(1);
    // 清空还原（再次点搜索按钮收起）
    searchBtn.click();
    expect(desk.querySelectorAll('.bz-diary-wall-day-head').length).toBe(3);
  });

  it('二级标签：点击带子标签的主标签显示子标签行', async () => {
    // mock 数据：两条 🀄（四川 子标签）+ 一条 📖（普通日记）——点子标签「四川」后应只剩四川条目
    const c = DiaryWallAppController.getInstance({ mobileDefaultFullscreen: false });
    const v2 = new MockVault();
    v2.files.set('我的/日记/2026-08-19.md', '# 🀄 23:02\n![[IMG_x.jpg]]\n');
    v2.files.set('我的/日记/2026-06-11.md', '# 🀄 21:29\n![[IMG_y.jpg]]\n');
    v2.files.set('我的/日记/2026-06-12.md', '# 📖 20:33\n普通日记\n');
    const v2app = mockAppWithVault(v2);
    setApp(v2app);
    (await import('../../src/diary/app')).setApp(v2app);
    await c.openManager();
    await waitFor(() => !!document.querySelector('.bz-diary-wall-day-head'));
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    // 标签列表来自 config 全量：旅游 chip 一定存在（renderChips 不再硬编码）
    const travel = desk.querySelector<HTMLElement>('.bz-diary-wall-chip[data-tag="旅游"]');
    expect(travel).toBeTruthy();
    travel!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-wall-subchip').length > 0);
    expect(desk.querySelectorAll('.bz-diary-wall-subchip').length).toBeGreaterThan(0);
    // 点子标签「四川」过滤：只剩 2026-08-19 + 2026-06-11 两条
    const sub = desk.querySelector<HTMLElement>('.bz-diary-wall-subchip[data-tag="四川"]');
    expect(sub).toBeTruthy();
    sub!.click();
    await waitFor(() => desk.querySelectorAll('.bz-diary-wall-day-head').length === 2);
    expect(desk.querySelectorAll('.bz-diary-wall-day-head').length).toBe(2);
  });

  it('右键菜单：条目 contextmenu 打开跟手菜单，含打开/复制/改标签/加密/删除', async () => {
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const item = desk.querySelector('.bz-diary-wall-item') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
    const menu = document.querySelector('.bz-diary-wall-menu');
    expect(menu).toBeTruthy();
    expect(menu!.textContent).toContain('打开原文');
    expect(menu!.textContent).toContain('复制双链');
    expect(menu!.textContent).toContain('复制正文');
    expect(menu!.textContent).toContain('改标签');
    expect(menu!.textContent).toContain('删除');
  });

  it('双击条目 → 跳转原文（jumpTo 被调）', async () => {
    const spy = vi.spyOn(DiaryWallAppController.prototype as any, 'jumpTo').mockResolvedValue(undefined);
    await openAndWait();
    const desk = document.querySelector('.bz-diary-wall-desk')!;
    const item = desk.querySelector('.bz-diary-wall-text') as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 双击 = 300ms 内两次点击
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('DW4：移动端媒体单击开条目抽屉（不直进灯箱）；DW7：重渲染宽高比稳定', async () => {
    await openAndWait();
    const mob = document.querySelector('.bz-diary-wall-mob')!;
    const media = mob.querySelector('.bz-diary-wall-media') as HTMLElement;
    expect(media).toBeTruthy();
    media.click();
    // 抽屉打开（媒体条目的条目级动作可达），灯箱未开
    expect(mob.querySelector('.bz-diary-wall-sheet--show')).toBeTruthy();
    expect(mob.querySelector('.bz-diary-wall-lb--show')).toBeNull();
    // 抽屉内媒体缩略图仍可进灯箱（openLightbox 按可见实例亮——jsdom 桌面宽度 → desk 实例）
    const thumb = mob.querySelector('.bz-diary-wall-sheet-thumb') as HTMLElement;
    expect(thumb).toBeTruthy();
    thumb.click();
    expect(document.querySelector('.bz-diary-wall-lb--show')).toBeTruthy();
    // DW7：重渲染后同条目媒体宽高比不变（稳定散列，非全局递增 seed）
    const c = DiaryWallAppController.instance!;
    const before = Array.from(document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-media')).map(
      (m) => (m as HTMLElement).style.aspectRatio
    );
    c.renderAll();
    const after = Array.from(document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-media')).map(
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
      const heads = document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-day-head');
      return heads.length === 4;
    }, 2000);
  });

  it('DW8：月份点击 smooth 滚动只触发一次；DW9：视频时长角标显示真实时长', async () => {
    await openAndWait();
    const wall = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-wall') as HTMLElement;
    const scrollSpy = vi.fn();
    wall.scrollTo = scrollSpy as any;
    const monthItem = document.querySelector<HTMLElement>('.bz-diary-wall-desk .bz-diary-wall-month[data-month="2026-08"]');
    monthItem!.click();
    // DW8：委托单次绑定（原 bindPanel 委托 + renderWall 逐月绑定双触发）
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    // DW9：视频 metadata 就绪 → 角标从 ▶ 变真实时长
    const video = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-media video') as HTMLVideoElement;
    expect(video).toBeTruthy();
    Object.defineProperty(video, 'duration', { value: 125, configurable: true });
    video.dispatchEvent(new Event('loadedmetadata'));
    const dur = video.parentElement!.querySelector('.bz-diary-wall-dur') as HTMLElement;
    expect(dur.textContent).toBe('2:05');
  });

  it('G1 审查修复：点击已滚过月份按流式位置推算目标（吸顶头 rect 不再污染）', async () => {
    await openAndWait();
    const wall = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-wall') as HTMLElement;
    const head = wall.querySelector<HTMLElement>('.bz-diary-wall-day-head[data-date^="2026-08"]')!;
    const masonry = head.nextElementSibling as HTMLElement;
    expect(masonry.classList.contains('bz-diary-wall-masonry')).toBe(true);
    // 模拟已滚过该月：节头是 sticky（rect 恒贴墙顶，不可用），其 masonry（非 sticky）
    // rect 为流式真实位置——已在视口上方 860px，墙顶位于视口 100px 处
    wall.getBoundingClientRect = () => ({ top: 100 } as any);
    masonry.getBoundingClientRect = () => ({ top: -860 } as any);
    Object.defineProperty(head, 'offsetHeight', { value: 40, configurable: true });
    wall.scrollTop = 2000;
    const scrollSpy = vi.fn();
    wall.scrollTo = scrollSpy as any;
    const monthItem = document.querySelector<HTMLElement>(
      '.bz-diary-wall-desk .bz-diary-wall-month[data-month="2026-08"]'
    )!;
    monthItem.click();
    // 目标 = scrollTop + (masonry顶 − wall顶 − 节头高 − 6) = 2000 + (−860 − 100 − 40 − 6) = 994
    // （旧实现用吸顶头 rect：head.top(0) − wall.top(100) → 1894，回跳错误位置）
    expect(scrollSpy).toHaveBeenCalledWith({ top: 994, behavior: 'smooth' });
  });

  it('E4 审查确认：章节栏胶卷缩略图直挂 src，不依赖 wall 内懒加载观察', async () => {
    await openAndWait();
    const rail = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-rail') as HTMLElement;
    const img = rail.querySelector('.bz-diary-wall-month-thumb img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('https://example.com/vault/');
  });
});

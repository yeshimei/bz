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
import { setApp } from '../../src/diary/app';
import { applyDirectories } from '../../src/diary/config';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { DiaryWallAppController } from '../../src/diary-wall/ui';

// mock data 模块的 mediaSrc（MockVault 无 getResourcePath，返回稳定 vault 内 URL；
// 用标准 https 协议——jsdom 对 app:// 非标准协议的 src 赋值会归一化为空）
const mocks = vi.hoisted(() => ({
  mediaSrc: vi.fn((_app: any, name: string) => `https://example.com/vault/${encodeURI(name)}`),
}));
vi.mock('../../src/diary-wall/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary-wall/data')>();
  return {
    ...actual,
    mediaSrc: mocks.mediaSrc,
  };
});

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
  setApp(mockAppWithVault(vault));
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
    // 桌面 + 移动实例同步开灯箱（双 DOM 共享状态）
    const lb = desk.querySelector('.bz-diary-wall-lb--show') as HTMLElement;
    expect(lb).toBeTruthy();
    expect(document.querySelectorAll('.bz-diary-wall-lb--show').length).toBe(2);
    // 灯箱内已注入 img（mediaSrc 返回 URL）
    const img = lb.querySelector('.bz-diary-wall-lb-media') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toContain('https://example.com/vault/');
    // 点击灯箱背景关闭（桌面实例）
    lb.click();
    expect(desk.querySelector('.bz-diary-wall-lb--show')).toBeNull();
  });

  it('空态：无日记时显示提示与动作按钮', async () => {
    const emptyVault = new MockVault();
    emptyVault.dirs.add('我的/日记');
    setApp(mockAppWithVault(emptyVault));
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
});

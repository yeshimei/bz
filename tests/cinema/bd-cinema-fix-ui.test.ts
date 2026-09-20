/**
 * 影院深审拍板修复批回归（Wave1 bd-cinema 批）：
 * 呈报#7（C2）添加/编辑表单桌面端打开即聚焦名称框（移动端维持不聚焦防弹键盘）；
 * 呈报#14（C3）季圆点 6px 命中面过小——外观一点不动，委托目标放宽到容器衬底/间隙
 * （落点取几何最近圆点），悬浮换脸不再需要瞄准 6px 的点本体。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { createOverlay, openAddModalDirect } from '../../src/cinema/ui';
import { ensureCinema, unloadCinema } from '../../src/cinema';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';

function md(content: string): string {
  return content;
}

function seedVault(): ReturnType<typeof mockAppWithVault> {
  const vault = new MockVault();
  vault.files.set('我的/影视/《星际穿越》.md', md('---\ntags: [电影]\n评分: 9.6\n观影日期: 2026-08-01\n---'));
  vault.files.set('我的/影视/《奥本海默》.md', md('---\ntags: [电影]\n评分: 9\n观影日期: 2026-09-01\n---'));
  const app = mockAppWithVault(vault);
  setApp(app);
  ensureCinema(app);
  rebuildItems(app);
  return app;
}

/** 老友记三季（已看/在看/想看）+ 一部电影，开合并出季圆点（同 ui.test.ts seedSeasons 口径） */
function seedSeasons(): ReturnType<typeof mockAppWithVault> {
  const vault = new MockVault();
  vault.files.set('我的/影视/《老友记 第一季》.md', md('---\ntags: [美剧]\n评分: 9.2\n观影日期: 2026-06-18\n---'));
  vault.files.set('我的/影视/《老友记 第二季》.md', md('---\ntags: [美剧]\n评分: 0\n观影日期: 2026-08-18\n---'));
  vault.files.set('我的/影视/《老友记 第三季》.md', md('---\ntags: [美剧]\n评分: -1\n观影日期:\n---'));
  vault.files.set('我的/影视/《奥本海默》.md', md('---\ntags: [电影]\n评分: 9\n观影日期: 2026-09-01\n---'));
  const app = mockAppWithVault(vault);
  setApp(app);
  ensureCinema(app);
  rebuildItems(app);
  return app;
}

beforeEach(() => {
  resetObsidianMocks();
  resetCinemaState();
  M.folderPath = '我的/影视';
  document.body.innerHTML = '';
  setSettingsProvider(() => ({}) as any);
});

afterEach(() => {
  Platform.isMobile = false;
  unloadCinema();
  document.body.innerHTML = '';
});

describe('呈报#7（C2）：添加/编辑表单打开自动定位名称框', () => {
  it('桌面端：添加表单打开即聚焦名称框', () => {
    const app = seedVault();
    createOverlay(app);
    openAddModalDirect(app);
    const form = document.querySelector('.cn-modal') as HTMLElement;
    expect(form.querySelector('.j-name')).toBeTruthy();
    expect(document.activeElement).toBe(form.querySelector('.j-name'));
  });

  it('桌面端：编辑表单同样聚焦名称框（编辑入口与添加共用 openForm）', () => {
    const app = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    // 点卡片开详情 → 点「编辑」开表单
    (root.querySelector('.pcard') as HTMLElement).click();
    ((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit') as HTMLElement).click();
    const form = root.querySelector('.cn-modal') as HTMLElement;
    expect((form.querySelector('.j-name') as HTMLInputElement).value).toBe('奥本海默');
    expect(document.activeElement).toBe(form.querySelector('.j-name'));
  });

  it('移动端：维持不聚焦（防软键盘弹出遮挡表单）', () => {
    Platform.isMobile = true;
    const app = seedVault();
    createOverlay(app);
    openAddModalDirect(app);
    const form = document.querySelector('.cn-modal') as HTMLElement;
    expect(form.querySelector('.j-name')).toBeTruthy();
    expect(document.activeElement).not.toBe(form.querySelector('.j-name'));
  });
});

describe('呈报#14（C3）：季圆点等效热区（外观不动，落点取最近圆点）', () => {
  it('外观不变拍板守卫：styles.css 圆点本体仍为 6px（只放宽委托目标，不改视觉）', () => {
    const css = readFileSync(resolve(__dirname, '../../src/cinema/styles.css'), 'utf8');
    const rule = css.match(/\.bz-cinema--midnight \.season-dots i\{[^}]*\}/);
    expect(rule, '季圆点规则应在位').toBeTruthy();
    expect(rule![0]).toContain('width:6px');
    expect(rule![0]).toContain('height:6px');
  });

  it('落点在容器衬底/间隙：取几何最近圆点换脸（修复前 mousemove 无监听，不换脸）', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const app = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const series = root.querySelector('.pcard-series') as HTMLElement;
    const dots = Array.from(series.querySelectorAll<HTMLElement>('.pw .season-dots i'));
    expect(dots).toHaveLength(3);
    // 静息态：正脸 = 最近看的那季（第二季），名字是归一名称
    expect(series.querySelector('.pname')?.textContent).toBe('老友记');
    // jsdom 无布局：逐点摆位（第 i 枚圆点左上角 = (i*10, 0)，6px 见方），间隙 4px
    dots.forEach((d, i) => {
      d.getBoundingClientRect = () =>
        ({ left: i * 10, top: 0, right: i * 10 + 6, bottom: 6, width: 6, height: 6, x: i * 10, y: 0 } as DOMRect);
    });
    const box = series.querySelector('.season-dots') as HTMLElement;
    // clientX=16：距第 2 枚中心 3px、距第 3 枚中心 7px → 最近 = 第 2 枚（在看季）
    box.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 16, clientY: 3 }));
    expect(series.classList.contains('is-peek')).toBe(true);
    expect(series.querySelector('.pname')?.textContent).toBe('老友记 第二季');
    // 圆点本体原地不动（换脸只写正脸件，不动圆点）
    expect(series.querySelectorAll('.pw .season-dots i')).toHaveLength(3);

    // 离开容器（relatedTarget 在容器外）→ 回静息态
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    box.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: outside }));
    expect(series.classList.contains('is-peek')).toBe(false);
    expect(series.querySelector('.pname')?.textContent).toBe('老友记');
    outside.remove();
  });

  it('圆点本体直击与容器内滑动不误换季：近处圆点优先且不打回静息态', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const app = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const series = root.querySelector('.pcard-series') as HTMLElement;
    const dots = Array.from(series.querySelectorAll<HTMLElement>('.pw .season-dots i'));
    dots.forEach((d, i) => {
      d.getBoundingClientRect = () =>
        ({ left: i * 10, top: 0, right: i * 10 + 6, bottom: 6, width: 6, height: 6, x: i * 10, y: 0 } as DOMRect);
    });
    const box = series.querySelector('.season-dots') as HTMLElement;
    // 直击第 3 枚（想看季）：mouseover 路径不变
    dots[2].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(series.querySelector('.pname')?.textContent).toBe('老友记 第三季');
    // 滑进第 2、3 枚之间的间隙（clientX=18 等距，取先到者=第 2 枚就近一侧 clientX=17）→ 换到第 2 枚
    box.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 17, clientY: 3 }));
    expect(series.querySelector('.pname')?.textContent).toBe('老友记 第二季');
  });
});

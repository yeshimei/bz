/**
 * 影院季圆点悬浮通道能力判定回归（悬浮收尾批）：
 * 旧判定按 .mob 壳（视口宽窄）近似「桌面=有鼠标」，桌面宽度的触屏设备（宽壳 + 无悬浮能力）
 * 仍会粘脸——tap 发 mouseover 不发 mouseout，换脸滞留。现与 gameshelf/ui.ts hoverCapable
 * 同口径（'(hover: hover) and (pointer: fine)'），与范式批 CSS @media (hover: hover) 全域对齐：
 * 宽屏 + 无悬浮能力不进换脸不粘脸；触屏窄屏行为不变；桌面有悬浮行为零变化。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { createOverlay } from '../../src/cinema/ui';
import { ensureCinema, unloadCinema } from '../../src/cinema';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';

function md(content: string): string {
  return content;
}

/** 老友记三季（已看/在看/想看），开合并出季圆点（同 ui.test.ts seedSeasons 口径） */
function seedSeasons(): ReturnType<typeof mockAppWithVault> {
  const vault = new MockVault();
  vault.files.set('我的/影视/《老友记 第一季》.md', md('---\ntags: [美剧]\n评分: 9.2\n观影日期: 2026-06-18\n---'));
  vault.files.set('我的/影视/《老友记 第二季》.md', md('---\ntags: [美剧]\n评分: 0\n观影日期: 2026-08-18\n---'));
  vault.files.set('我的/影视/《老友记 第三季》.md', md('---\ntags: [美剧]\n评分: -1\n观影日期:\n---'));
  const app = mockAppWithVault(vault);
  setApp(app);
  ensureCinema(app);
  rebuildItems(app);
  return app;
}

/** 按 query 分发的 matchMedia stub：只认悬浮口径，其他查询一律 false（不误伤其他消费方） */
function stubHoverCapable(on: boolean): void {
  (window as any).matchMedia = (q: string) => ({
    matches: on && q === '(hover: hover) and (pointer: fine)',
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
}

beforeEach(() => {
  resetObsidianMocks();
  resetCinemaState();
  M.folderPath = '我的/影视';
  document.body.innerHTML = '';
  setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
});

afterEach(() => {
  Platform.isMobile = false;
  unloadCinema();
  document.body.innerHTML = '';
  delete (window as any).matchMedia;
});

describe('影院季圆点悬浮通道：壳类近似改悬浮能力判定（悬浮收尾批）', () => {
  it('宽屏 + 无悬浮能力（桌面宽度的触屏）：不进悬浮换脸也不粘脸', () => {
    stubHoverCapable(false);
    const app = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    // 宽壳在场：旧判定（!mob）此刻会挂悬浮监听，正是粘脸 bug 场景
    expect(root.classList.contains('mob')).toBe(false);
    const series = root.querySelector('.pcard-series') as HTMLElement;
    const dot = series.querySelector<HTMLElement>('.pw .season-dots i');
    expect(dot).toBeTruthy();
    // tap 只发 mouseover 不发 mouseout：无能力时不挂监听，换脸不发生也就无从滞留
    dot!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(series.classList.contains('is-peek')).toBe(false);
    // 衬底/间隙内 mousemove 同样不进（旧 bug 下 tap 滑动即粘脸）
    const box = series.querySelector('.season-dots') as HTMLElement;
    box.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(series.classList.contains('is-peek')).toBe(false);
    expect(series.querySelector('.pname')?.textContent).toBe('老友记'); // 正脸未被换
  });

  it('触屏窄屏（mob 壳 + 无悬浮能力）：行为不变，不进悬浮换脸', () => {
    Platform.isMobile = true;
    stubHoverCapable(false);
    const app = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('section.mob[data-cinema-root]') as HTMLElement;
    const dot = root.querySelector<HTMLElement>('.m-grid .season-dots i');
    expect(dot).toBeTruthy();
    dot!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(root.querySelector('.pcard-series')?.classList.contains('is-peek')).toBe(false);
  });

  it('桌面有悬浮能力：换脸与复原零变化', () => {
    stubHoverCapable(true);
    const app = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const series = root.querySelector('.pcard-series') as HTMLElement;
    const dots = Array.from(series.querySelectorAll<HTMLElement>('.pw .season-dots i'));
    expect(dots).toHaveLength(3);
    // 悬浮第 3 枚（想看季）→ 换脸
    dots[2].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(series.classList.contains('is-peek')).toBe(true);
    expect(series.querySelector('.pname')?.textContent).toBe('老友记 第三季');
    // 离开 → 回静息态（快照回填，非重算）
    dots[2].dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(series.classList.contains('is-peek')).toBe(false);
    expect(series.querySelector('.pname')?.textContent).toBe('老友记');
  });

  it('口径守卫：悬浮通道走 matchMedia 能力判定（gameshelf 同口径），不再按壳类近似', () => {
    const src = readFileSync(resolve(__dirname, '../../src/cinema/ui.ts'), 'utf8');
    expect(src).toContain("matchMedia('(hover: hover) and (pointer: fine)')");
    expect(src).toContain('hoverable = hoverCapable()');
    expect(src).toContain('if (hoverable) {');
  });
});

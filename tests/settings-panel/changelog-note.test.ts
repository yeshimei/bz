// @vitest-environment jsdom
/**
 * 更新提示小窗（settings-panel/changelog-note.ts，2026-11-02）
 *
 * 测的是「窗口里到底有什么」：标题口径「本次更新」、最新一版的版本徽标 / 日期 / 改动数、
 * 三段只渲染有内容的、新功能那段才带 accent 竖线、更早的版本收在**一整块**折叠里
 * （点开是连续文本流，不是一版一个折叠行）、页脚四个入口（GitHub / QQ / B 站 / 支持作者）
 * 齐全且顺序固定，「知道了」关窗。
 * 触发时机（第一次打开 bz 界面）与记账在 main.ts，数据顺序与上限在 core/changelog-data，各有其测试。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { openChangelogNote } from '../../src/settings-panel/changelog-note';
import { setApp } from '../../src/core/app';

vi.mock('../../src/core/reward-dialog', () => ({ openRewardDialog: vi.fn() }));

const release = (over: Record<string, unknown> = {}): any => ({
  version: '1.39.1',
  date: '2026-11-02',
  added: [],
  improved: [{ domain: '游戏库', text: '排序默认改成「最近玩」，并排在最前' }],
  fixed: [{ domain: '游戏库', text: '后台拉封面时主界面不再闪', sub: '只改变化的那几处' }],
  ...over,
});

const older = (): any =>
  release({
    version: '1.38.0',
    date: '2026-10-20',
    improved: [],
    fixed: [{ domain: '日记本', text: '夜间模式下字色偏灰' }],
  });

const oldest = (): any =>
  release({
    version: '1.37.0',
    date: '2026-10-10',
    improved: [],
    fixed: [],
    added: [{ domain: '首页', text: '时间线改成按天分组' }],
  });

const note = () => document.querySelector<HTMLElement>('.bz-chg-note');
/** 最新一版的三段（scroll 的直接子 section），不含折叠块里的旧版本 */
const newestSecTitles = (root: ParentNode = document) =>
  [...root.querySelectorAll('.bz-chg-scroll > .bz-chg-sec .bz-chg-sec-h')].map((e) => e.textContent);
/** 折叠块里每个旧版本的一行标题 */
const oldBlocks = () => [...document.querySelectorAll<HTMLElement>('.bz-chg-oldrel')];
const oldBlock = () => document.querySelector<HTMLElement>('.bz-chg-old');
const oldHead = () => document.querySelector<HTMLElement>('.bz-chg-old-h');

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp({ vault: {}, workspace: {} } as any);
});

describe('更新提示小窗', () => {
  it('标题是「本次更新」，并显示最新版的版本 / 日期 / 改动数', () => {
    openChangelogNote([release(), older()]);
    expect(note()?.querySelector('.bz-chg-title')?.textContent).toBe('本次更新');
    expect(note()?.querySelector('.bz-chg-badge')?.textContent).toBe('v1.39.1');
    expect(note()?.querySelector('.bz-chg-head .bz-chg-date')?.textContent).toBe('2026-11-02');
    expect(note()?.querySelector('.bz-chg-head .bz-chg-count')?.textContent).toBe('2 处改动');
  });

  it('只渲染有内容的三段，且只有「新功能」带 accent 竖线类', () => {
    openChangelogNote([release()]);
    expect(newestSecTitles()).toEqual(['体验优化', '问题修复']);
    expect(note()?.querySelector('.bz-chg-sec.pri')).toBeNull();

    openChangelogNote([release({ added: [{ domain: '日记本', text: '新增一键成册' }] })]);
    // 上一窗没关（uiModal 允许叠开）——取最后一个
    const last = [...document.querySelectorAll<HTMLElement>('.bz-chg-note')].pop()!;
    expect(newestSecTitles(last)).toEqual(['新功能', '体验优化', '问题修复']);
    expect(last.querySelector('.bz-chg-sec.pri .bz-chg-sec-h')?.textContent).toBe('新功能');
  });

  it('条目带副行时渲染副行，不带的没有空节点', () => {
    openChangelogNote([release()]);
    const subs = [...document.querySelectorAll('.bz-chg-scroll > .bz-chg-sec .bz-chg-sub')].map(
      (e) => e.textContent,
    );
    expect(subs).toEqual(['只改变化的那几处']);
  });

  it('页脚四个入口顺序固定：GitHub / QQ / B 站 / 支持作者', () => {
    openChangelogNote([release()]);
    const links = [...document.querySelectorAll<HTMLElement>('.bz-chg-note .bz-chg-link')];
    expect(links).toHaveLength(4);
    expect(links[0].getAttribute('aria-label')).toBe('GitHub 仓库');
    expect(links[1].getAttribute('aria-label')).toContain('QQ');
    expect(links[2].getAttribute('aria-label')).toBe('B 站视频教程');
    expect(links[3].classList.contains('donate')).toBe(true);
    expect(links[3].textContent).toContain('支持作者');
  });

  it('「知道了」关闭窗口', () => {
    openChangelogNote([release()]);
    note()!.querySelector<HTMLElement>('.bz-chg-ok')!.click();
    expect(note()).toBeNull();
  });

  it('一条改动都没有的内容不弹空窗（调用方本就不该传进来，这里是最后一道闸）', () => {
    openChangelogNote([release({ improved: [], fixed: [] })]);
    expect(note()).toBeNull();
  });
});

describe('更新提示小窗 · 更早的版本', () => {
  it('旧版本收在**一整块**折叠里，不是一版一个折叠行', () => {
    openChangelogNote([release(), older(), oldest()]);
    // 只有一个折叠开关
    expect(document.querySelectorAll('.bz-chg-old')).toHaveLength(1);
    expect(document.querySelectorAll('.bz-chg-old-h')).toHaveLength(1);
    // 里面是两个版本块，按新→旧
    expect(oldBlocks().map((b) => b.querySelector('.bz-chg-oldrel-v')?.textContent)).toEqual([
      'v1.38.0',
      'v1.37.0',
    ]);
    expect(oldBlock()?.classList.contains('open')).toBe(false);
    expect(oldHead()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('折叠开关文案是「更早的版本 · N 版」，N 等于版本块数', () => {
    openChangelogNote([release(), older(), oldest()]);
    expect(oldHead()?.querySelector('.bz-chg-old-t')?.textContent).toBe('更早的版本 · 2 版');
  });

  it('只有一版时不出现折叠块', () => {
    openChangelogNote([release()]);
    expect(oldBlock()).toBeNull();
    expect(oldBlocks()).toHaveLength(0);
  });

  it('点一下整块展开：所有旧版本正文一次全在，用户直接往下滚', () => {
    openChangelogNote([release(), older(), oldest()]);
    oldHead()!.click();
    expect(oldBlock()?.classList.contains('open')).toBe(true);
    expect(oldHead()?.getAttribute('aria-expanded')).toBe('true');
    const text = oldBlock()?.querySelector('.bz-chg-old-body')?.textContent || '';
    // 两个版本的正文都在（不是点一版出一版）
    expect(text).toContain('夜间模式下字色偏灰');
    expect(text).toContain('时间线改成按天分组');
  });

  it('再点一次收起（内容留着，不重复渲染）', () => {
    openChangelogNote([release(), older()]);
    const head = oldHead()!;
    head.click();
    const html = oldBlock()!.querySelector('.bz-chg-old-body')!.innerHTML;
    head.click();
    expect(oldBlock()?.classList.contains('open')).toBe(false);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(oldBlock()!.querySelector('.bz-chg-old-body')!.innerHTML).toBe(html);
  });

  it('每个版本块自带日期与改动数', () => {
    openChangelogNote([release(), older()]);
    const first = oldBlocks()[0];
    expect(first.querySelector('.bz-chg-date')?.textContent).toBe('2026-10-20');
    expect(first.querySelector('.bz-chg-count')?.textContent).toBe('1 处改动');
  });

  it('传了 expectVersion 就按它定位「本次更新」，不看数组首项', () => {
    // 调用方已经用 pickReleaseFor 验过版本在数据里；这里模拟首项与目标不一致的情况
    openChangelogNote([release(), older(), oldest()], '1.38.0');
    expect(note()?.querySelector('.bz-chg-badge')?.textContent).toBe('v1.38.0');
    // 比它更早的只剩 1.37.0
    expect(oldHead()?.querySelector('.bz-chg-old-t')?.textContent).toBe('更早的版本 · 1 版');
  });
});

// @vitest-environment jsdom
/**
 * 更新日志弹窗（settings-panel/changelog-note.ts，2026-11-02 合一重做）
 *
 * 测「窗口里到底有什么」，两端共用一份 DOM：
 *  - 桌面：左栏版本时间轴（当前版实心点 + aria-current）、右栏单版正文（眉标 / 大号版本号 /
 *    日期 / 改动统计 / 三段）、右下四个入口；
 *  - 移动：全部版本铺成一篇文档流，最新那版带「当前」小胶囊。
 * 点左栏切版本、`expectVersion` 定位、空内容不弹空窗、关闭钮收口。
 *
 * 触及时机与记账在 main.ts，数据结构在 core/changelog-data，各有其测试。
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
  fixed: [{ domain: '游戏库', text: '后台拉封面时主界面不再闪' }],
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
/** uiModal 允许叠开：新开的窗取最后一个 */
const lastNote = () => [...document.querySelectorAll<HTMLElement>('.bz-chg-note')].pop() || null;

const railItems = (root: ParentNode = document) => [
  ...root.querySelectorAll<HTMLElement>('.bz-chgn-v'),
];
/** 右栏正文的三段标题（左栏是别人的，别混进来） */
const paneGroups = (root: ParentNode = document) =>
  [...root.querySelectorAll('.bz-chgn-body .bz-chgn-grp-hd')].map((e) =>
    (e.textContent || '').replace(/\d+$/, ''),
  );

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp({ vault: {}, workspace: {} } as any);
});

describe('更新日志弹窗 · 桌面', () => {
  it('眉标是「本次更新」，显示大号版本号、点分日期、改动统计', () => {
    openChangelogNote([release(), older()]);
    expect(note()?.querySelector('.bz-chgn-eyebrow')?.textContent).toBe('本次更新');
    expect(note()?.querySelector('.bz-chgn-ver')?.textContent).toBe('v1.39.12026.11.02');
    expect(note()?.querySelector('.bz-chgn-ver small')?.textContent).toBe('2026.11.02');
    const meta = note()?.querySelector('.bz-chgn-meta')?.textContent || '';
    expect(meta).toContain('共 2 处改动');
    expect(meta).toContain('体验优化 1');
    expect(meta).toContain('修复 1');
  });

  it('只渲染有内容的三段，段内条目是「域名 + 文案」', () => {
    openChangelogNote([release()]);
    expect(paneGroups()).toEqual(['体验优化', '修复']);
    const first = note()?.querySelector('.bz-chgn-row');
    expect(first?.querySelector('.bz-chgn-k')?.textContent).toBe('游戏库');
    expect(first?.querySelector('.bz-chgn-t')?.textContent).toContain('最近玩');
  });

  it('左栏时间轴按新→旧铺全部版本，当前版带 on 与 aria-current', () => {
    openChangelogNote([release(), older(), oldest()]);
    const items = railItems();
    expect(items).toHaveLength(3);
    expect(items.map((e) => e.querySelector('.v')?.textContent)).toEqual([
      'v1.39.1',
      'v1.38.0',
      'v1.37.0',
    ]);
    expect(items[0].classList.contains('on')).toBe(true);
    expect(items[0].getAttribute('aria-current')).toBe('true');
    expect(items[1].classList.contains('on')).toBe(false);
    expect(items[1].hasAttribute('aria-current')).toBe(false);
    // 悬停才淡入的那行「N 处改动」也在 DOM 里
    expect(items[0].querySelector('.n')?.textContent).toBe('2 处改动');
  });

  it('点左栏任一项：右栏换成那一版，眉标变「历史版本」，选中态跟着走', () => {
    openChangelogNote([release(), older(), oldest()]);
    railItems()[2].click();
    const root = lastNote()!;
    expect(root.querySelector('.bz-chgn-eyebrow')?.textContent).toBe('历史版本');
    expect(root.querySelector('.bz-chgn-ver small')?.textContent).toBe('2026.10.10');
    expect(root.querySelector('.bz-chgn-body')?.textContent).toContain('时间线改成按天分组');
    expect(root.querySelector('.bz-chgn-body')?.textContent).not.toContain('最近玩');
    expect(railItems(root)[2].classList.contains('on')).toBe(true);
    expect(railItems(root)[0].classList.contains('on')).toBe(false);
  });

  it('传了 expectVersion 就停在那一版，不看数组首项', () => {
    // 调用方已用 pickReleaseFor 验过版本在数据里；这里模拟首项与目标不一致
    openChangelogNote([release(), older(), oldest()], '1.38.0');
    const root = lastNote()!;
    expect(root.querySelector('.bz-chgn-eyebrow')?.textContent).toBe('历史版本');
    expect(root.querySelector('.bz-chgn-ver small')?.textContent).toBe('2026.10.20');
    expect(railItems(root)[1].classList.contains('on')).toBe(true);
  });

  it('入口四个顺序固定：GitHub / QQ / B 站 / 支持作者', () => {
    openChangelogNote([release()]);
    const links = [...document.querySelectorAll<HTMLElement>('.bz-chg-note .bz-chg-link')];
    // 桌面页脚 + 移动浮动条各一套，同一份标记
    expect(links.length).toBeGreaterThanOrEqual(4);
    const firstFour = links.slice(0, 4);
    expect(firstFour[0].getAttribute('aria-label')).toBe('GitHub 仓库');
    expect(firstFour[1].getAttribute('aria-label')).toContain('QQ');
    expect(firstFour[2].getAttribute('aria-label')).toBe('B 站视频教程');
    expect(firstFour[3].classList.contains('donate')).toBe(true);
    expect(firstFour[3].textContent).toContain('支持作者');
  });

  it('两套入口各自都绑上了行为（别按全局索引查表）', async () => {
    const reward = await import('../../src/core/reward-dialog');
    vi.mocked(reward.openRewardDialog).mockClear();
    openChangelogNote([release()]);
    const root = lastNote()!;
    // 桌面页脚在前、手机浮动条在后，同一份标记两份 DOM
    for (const box of [
      root.querySelector<HTMLElement>('.bz-chgn-ft')!,
      root.querySelector<HTMLElement>('.bz-chgn-mtools')!,
    ]) {
      expect([...box.querySelectorAll('.bz-chg-link')].map((b) => b.getAttribute('data-bz-act'))).toEqual([
        'repo',
        'qq',
        'video',
        'donate',
      ]);
    }
    // 浮动条那组在 DOM 里排在页脚之后：按索引查表的话这一下会静默无事
    root.querySelector<HTMLElement>('.bz-chgn-mtools .bz-chg-link.donate')!.click();
    await vi.waitFor(() => expect(reward.openRewardDialog).toHaveBeenCalled());
  });

  // 2026-11-09：× 不再直接关窗，先弹「支持作者」提醒（core/support-prompt）
  it('右上 × 先弹「支持作者」提醒，日志窗留在下面', async () => {
    openChangelogNote([release()]);
    note()!.querySelector<HTMLElement>('.bz-chgn-pane ~ .bz-chgn-close, .bz-chgn-close')!.click();
    await vi.waitFor(() => expect(document.querySelector('.bz-sup')).toBeTruthy());
    expect(note()).not.toBeNull();
  });

  it('提醒窗选「以后再说」：两个窗一起收掉', async () => {
    openChangelogNote([release()]);
    note()!.querySelector<HTMLElement>('.bz-chgn-close')!.click();
    await vi.waitFor(() => expect(document.querySelector('.bz-sup')).toBeTruthy());
    document.querySelector<HTMLElement>('.bz-sup-later')!.click();
    await vi.waitFor(() => expect(note()).toBeNull());
    expect(document.querySelector('.bz-sup')).toBeNull();
  });

  it('提醒窗选「支持作者」：日志窗收掉，打开赞赏扫码窗', async () => {
    const reward = await import('../../src/core/reward-dialog');
    vi.mocked(reward.openRewardDialog).mockClear();
    openChangelogNote([release()]);
    note()!.querySelector<HTMLElement>('.bz-chgn-close')!.click();
    await vi.waitFor(() => expect(document.querySelector('.bz-sup')).toBeTruthy());
    document.querySelector<HTMLElement>('.bz-sup-go')!.click();
    await vi.waitFor(() => expect(reward.openRewardDialog).toHaveBeenCalled());
    expect(note()).toBeNull();
  });

  it('句柄 close() 不弹提醒（插件卸载收口不该问一句）', () => {
    const handle = openChangelogNote([release()]);
    handle.close();
    expect(note()).toBeNull();
    expect(document.querySelector('.bz-sup')).toBeNull();
  });

  it('一条改动都没有的内容不弹空窗', () => {
    openChangelogNote([release({ improved: [], fixed: [] })]);
    expect(note()).toBeNull();
  });

  it('内容不溢出时不亮渐隐（别拿假的「还有内容」骗人）', () => {
    openChangelogNote([release()]);
    // jsdom 里 scrollHeight === clientHeight === 0
    expect(note()?.querySelector('.bz-chgn-fade-top')?.classList.contains('show')).toBe(false);
    expect(note()?.querySelector('.bz-chgn-fade-bot')?.classList.contains('show')).toBe(false);
  });
});

describe('更新日志弹窗 · 移动端', () => {
  it('全部版本铺成一篇文档流，不是一版一个折叠', () => {
    openChangelogNote([release(), older(), oldest()]);
    const rels = [...document.querySelectorAll<HTMLElement>('.bz-chgn-mrel')];
    expect(rels).toHaveLength(3);
    expect(rels.map((e) => e.querySelector('.bz-chgn-mver')?.textContent)).toEqual([
      'v1.39.1',
      'v1.38.0',
      'v1.37.0',
    ]);
  });

  it('只有最新一版带「当前」小胶囊', () => {
    openChangelogNote([release(), older()]);
    const rels = [...document.querySelectorAll<HTMLElement>('.bz-chgn-mrel')];
    expect(rels[0].querySelector('.bz-chgn-mcur')?.textContent).toBe('当前');
    expect(rels[1].querySelector('.bz-chgn-mcur')).toBeNull();
  });

  it('旧版正文一次全在，滚下去就能读', () => {
    openChangelogNote([release(), older(), oldest()]);
    const text = document.querySelector('.bz-chgn-mpage')?.textContent || '';
    expect(text).toContain('最近玩');
    expect(text).toContain('字色偏灰');
    expect(text).toContain('时间线改成按天分组');
  });

  it('顶栏有标题与关闭钮，没有版本栏（手机上不让人先点一次）', () => {
    openChangelogNote([release()]);
    const m = note()?.querySelector<HTMLElement>('.bz-chgn-m');
    expect(m?.querySelector('.bz-chgn-mtitle')?.textContent).toContain('更新日志');
    expect(m?.querySelector('.bz-chgn-mbar .bz-chgn-close')).toBeTruthy();
    expect(m?.querySelector('.bz-chgn-rail')).toBeNull();
    // 浮动入口条在
    expect(m?.querySelector('.bz-chgn-mtools .bz-chg-link')).toBeTruthy();
  });
});

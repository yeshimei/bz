import { todayStr } from '../helpers/date';
/**
 * 内容首页（home 域）UI 测试（issue 232 活动河改版）：
 * 面板装配（头行/三栏/移动瓦片）、全域入口行、时间线空态、预告三卡、点行直达、ESC/遮罩关闭。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { openHome, unloadHome } from '../../src/home';
import { closeOverlay } from '../../src/home/ui';
import { resetHomeState, H } from '../../src/home/state';
import { DOMAINS } from '../../src/home/domains';


function yesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function yesterdayStr(): string {
  return `${yesterdayDateStr()} 09:00:00`;
}

function recApp(vault: MockVault): any {
  const app = mockAppWithVault(vault) as any;
  app.__executed = [] as string[];
  app.commands = {
    listCommands: () => [],
    executeCommandById: (id: string) => {
      app.__executed.push(id);
    },
  };
  return app;
}

describe('home 活动河 UI（issue 232）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetHomeState();
  });

  afterEach(() => {
    unloadHome();
  });

  it('面板装配：头行（周历+日期，标题已退役）+ 三栏容器 + 关闭钮；数据采集后全量入口行渲染', async () => {
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.bz-home-title')).toBeNull(); // 2026-09-09：标题桌面/移动都去掉
    expect(overlay.querySelectorAll('[data-home-weekday]').length).toBe(7);
    expect(overlay.querySelector('[data-home-date]')!.textContent).toMatch(/\d{4}-\d{2}-\d{2} 周/);
    expect(overlay.querySelector('[data-home-close]')).toBeTruthy();
    expect(overlay.querySelectorAll('[data-home-go]').length).toBeGreaterThanOrEqual(DOMAINS.length);
    // 每行：彩点 + 图标 + 名称 + 计数
    expect(overlay.querySelectorAll('.bz-home-erow').length).toBe(DOMAINS.length);
    expect(overlay.querySelectorAll('.bz-home-erow .bz-ic').length).toBe(DOMAINS.length);
  });

  it('时间线空态与预告三卡', async () => {
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay = document.querySelector('.bz-home-overlay')!;
    expect(overlay.querySelector('.bz-home-flow-empty')).toBeTruthy(); // 空河引导文案
    const prs = overlay.querySelectorAll('.bz-home-pr');
    expect(prs.length).toBe(3); // 复习/剪藏/日记三张规则卡
    expect((overlay.querySelector('[data-home-next]') as HTMLElement).textContent).toContain('明 天 预 告');
  });

  it('入口彩点 class（item-1789106079981）：日记动静 ok、剪藏未读/影院在看 warn、重要备忘 hot、规则外域 off', async () => {
    vault.files.set(`我的/日记/${todayStr()}.md`, '# 🌤 08:30\n记一笔。\n'); // 今日有动静 → diary ok
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({ articles: [{ read: false }, { read: true }] })); // 未读 > 0 → clipping warn
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { title: '重要待办', created: '2026-01-01 09:00:00', completed: null, priority: 'important' }, // 重要未完成 → memo hot
    ]));
    vault.files.set('我的/影视/《正在看》.md', '---\ntags:\n- 电影\n评分: 0\n---\n'); // 在看 > 0 → cinema warn
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay = document.querySelector('.bz-home-overlay')!;
    const dotClass = (id: string): string => {
      const el = overlay.querySelector(`[data-home-go="${id}"] .bz-home-dot`);
      expect(el, `域 ${id} 入口行彩点缺失`).toBeTruthy();
      return Array.from(el!.classList).find((c) => c.startsWith('bz-home-dot--'))!;
    };
    expect(dotClass('diary')).toBe('bz-home-dot--ok');
    expect(dotClass('clipping')).toBe('bz-home-dot--warn');
    expect(dotClass('cinema')).toBe('bz-home-dot--warn');
    expect(dotClass('memo')).toBe('bz-home-dot--hot');
    expect(dotClass('favorites')).toBe('bz-home-dot--off'); // 规则外域由 dotOf 回落 off
  });

  it('点入口行执行对应域命令并关首页（demo 命令通道记录 id）', async () => {
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('[data-home-go="cinema"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(app.__executed).toEqual(['bz-cinema-open']);
    expect(document.querySelector('.bz-home-overlay')).toBeNull();
    expect(H.river).toBeNull(); // 关闭清采集态
  });

  it('第二大脑磁贴（issue 251）：入口行在册、图标物化、点行直达主面板命令', async () => {
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const row = document.querySelector('[data-home-go="secondbrain"]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.querySelector('.bz-ic')).toBeTruthy();
    expect((row.querySelector('.bz-ic') as HTMLElement).dataset.icon).toBe('brain'); // mock setIcon 记录图标名
    expect(row.textContent).toContain('第二大脑');
    row.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(app.__executed).toEqual(['bz-secondbrain-panel']);
  });

  it('周历：7 格动静历渲染；点昨天格时间线切天、选中格同步', async () => {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { title: '甲', created: yesterdayStr() + ' 09:00:00', completed: null },
    ]));
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const wks = document.querySelectorAll('[data-home-weekday]');
    expect(wks.length).toBe(7);
    // 倒排：第一格=今天，显示「今」不写数字
    expect((wks[0] as HTMLElement).dataset.homeWeekday).toBe(todayStr());
    expect(wks[0].querySelector('.bz-home-wk-n')!.textContent).toBe('今');
    expect(document.querySelectorAll('.bz-home-wk--hit').length).toBe(1); // 只有昨天有动静
    const yesterday = yesterdayDateStr();
    const ybtn = document.querySelector(`[data-home-weekday="${yesterday}"]`) as HTMLElement;
    ybtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('[data-home-flow] .bz-home-sec-t')).toBeNull(); // 时间线标题行已退役，选中日由周历高亮表达
    expect(document.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(1); // 新增备忘录一条
    expect(document.querySelector(`[data-home-weekday="${yesterday}"]`)!.classList.contains('bz-home-wk--sel')).toBe(true);
  });

  it('点关闭钮 / 遮罩均关闭（桌面无关闭钮显示由 CSS 控制事件仍可用）', async () => {
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('[data-home-close]') as HTMLElement).click();
    expect(document.querySelector('.bz-home-overlay')).toBeNull();

    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay = document.querySelector('.bz-home-overlay')!;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-home-overlay')).toBeNull();
  });
});

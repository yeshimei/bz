import { todayStr } from '../helpers/date';
/**
 * 内容首页（home 域）UI 测试（issue 232 活动河改版）：
 * 面板装配（头行/三栏/移动瓦片）、全域入口行、时间线空态、预告三卡、点行直达、ESC/遮罩关闭；
 * issue 290 秒开三件套：首次骨架秒开、关闭保留 DOM 重开复用刷新、卸载真销毁。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { diaryEntryPath, serializeDiaryEntryFile } from '../../src/core/diary-format';
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

/** 今日/昨日的某时刻（行为流条目时刻用运行期 now 派生，与 todayStr()/yesterdayDateStr() 同口径） */
function todayAt(h: number, m = 0): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function yesterdayAt(h: number, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(h, m, 0, 0);
  return d;
}

/** 写行为流侧车（issue 305：时间线痕迹源；recap 文件统计只供摘要/计数） */
function writeBehavior(vault: MockVault, items: Array<{ source: string; type: string; name: string; dt: Date }>): void {
  vault.files.set('CONFIG/STORAGE/smartcat-behavior.json', JSON.stringify({
    version: 1,
    items: items.map(({ source, type, name, dt }) => ({
      id: `beh_${dt.getTime()}`,
      timestamp: dt.toISOString(),
      type,
      source,
      description: `${source}:${type} ${name}`,
      metadata: { entityType: source, action: type, name },
    })),
  }));
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
    // 面板异步装配（骨架秒开 → 数据采集回填）：固定 sleep 在高负载（部署后 Obsidian 重索引整库）下
    // 会读到半成品 DOM（[data-home-weekday] 实得 0），故改为对「渲染完成」这件事本身做 waitFor（issue 291 §7①）
    const overlay = await vi.waitFor(() => {
      const el = document.querySelector('.bz-home-overlay') as HTMLElement;
      expect(el).toBeTruthy();
      expect(el.querySelectorAll('[data-home-weekday]').length).toBe(7); // issue 288 本周 → 周历七格
      expect(el.querySelectorAll('.bz-home-erow').length).toBe(DOMAINS.length);
      return el;
    });
    expect(overlay.querySelector('.bz-home-title')).toBeNull(); // 2026-09-09：标题桌面/移动都去掉
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
    vault.files.set(diaryEntryPath('我的/日记', todayStr(), '08:30'), serializeDiaryEntryFile({ date: todayStr(), time: '08:30' }, ['日记'], '记一笔。')); // 今日有动静 → diary ok
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
    // issue 290：关闭 = 隐藏保留 DOM（重开秒显），采集态一并保留
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.display).toBe('none');
    expect(H.overlayVisible).toBe(false);
    expect(H.river).not.toBeNull();
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

  it('周历：默认「本周」档出 7 格；缩到「当天」只留今天一格、点过去的天时间线切天', async () => {
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '甲', dt: yesterdayAt(9) }]);
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    // issue 288：默认「时间范围」= 本周 → 7 格全出（旧口径 today 只留一格已废）
    const wks0 = document.querySelectorAll('[data-home-weekday]');
    expect(wks0.length).toBe(7);
    expect(document.querySelectorAll('.bz-home-wk--hit').length).toBe(1); // 只有昨天有动静

    // 缩到「当天」：周历只留今天一格（范围设置本身就管「能往回翻几天」）
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, homeTimelineRange: 'today' }));
    unloadHome();
    resetHomeState();
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('[data-home-weekday]').length).toBe(1);

    // 回到「本周」：点昨天那格 → 时间线切到昨天
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, homeTimelineRange: 'week' }));
    unloadHome();
    resetHomeState();
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const wks = document.querySelectorAll('[data-home-weekday]');
    expect(wks.length).toBe(7);
    // 倒排：第一格=今天。2026-09-23 用户拍板：格内只留星期中文（日期数字行退役），
    // 今天不再写「今」字（数字行没了），改 --today 红字标（样式见 styles.css 头排段）
    expect((wks[0] as HTMLElement).dataset.homeWeekday).toBe(todayStr());
    expect(wks[0].classList.contains('bz-home-wk--today')).toBe(true);
    expect(wks[0].querySelector('.bz-home-wk-n')!.textContent).toBe('日一二三四五六'[new Date().getDay()]);
    const yesterday = yesterdayDateStr();
    const ybtn = document.querySelector(`[data-home-weekday="${yesterday}"]`) as HTMLElement;
    ybtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('[data-home-flow] .bz-home-sec-t')).toBeNull(); // 时间线标题行已退役，选中日由周历高亮表达
    expect(document.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(1); // 新增备忘录一条
    expect(document.querySelector(`[data-home-weekday="${yesterday}"]`)!.classList.contains('bz-home-wk--sel')).toBe(true);
  });

  it('issue 287：时间线内容过滤 / 时刻列 / 字号档 从设置读，关掉即不出（每次开面板现读，无缓存）', async () => {
    // 行为流 memo:added → kind=progress（状态推进类）
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '甲', dt: todayAt(9) }]);
    setSettingsProvider(() => ({
      ...DEFAULT_SETTINGS,
      homeTimelineProgress: false, // 关掉状态推进 → 唯一的痕迹该被挡掉
      homeTimelineTime: false,
      homeTimelineSize: 'compact',
    }));
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(0);
    expect(document.querySelector('.bz-home-flow-empty')!.textContent).toContain('内容过滤');
    expect((document.querySelector('.bz-home-timeline') as HTMLElement).dataset.tlSize).toBe('compact');
    expect((document.querySelector('.bz-home-timeline') as HTMLElement).dataset.tlTime).toBe('0');
    expect(document.querySelector('.bz-home-ev-tm')).toBeNull(); // 时刻列关掉 → 连 span 都不渲染
  });

  it('issue 287：明天预告卡关掉 → 第三栏整个收掉（display 断移动 flex 收缩 + 修饰类断桌面 grid 轨道收口）', async () => {
    // ui P3-2 注记：旧断言只锁 style.display==='none'（实现手段）——display:none 只让 item
    // 离开网格，桌面显式三轨道仍空置 224px；修复后由 grid 修饰类同步收口轨道，两手段并断。
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, homeNextCards: false }));
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const next = document.querySelector('[data-home-next]') as HTMLElement;
    expect(next.style.display).toBe('none');
    expect(next.innerHTML).toBe('');
    // 修饰类挂在 grid 上（桌面轨道塌缩的正解），随设置开关切换
    const grid = document.querySelector('.bz-home-grid') as HTMLElement;
    expect(grid.classList.contains('bz-home-grid--no-next')).toBe(true);
    // 开回来 → 类摘除、栏恢复
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, homeNextCards: true }));
    unloadHome();
    resetHomeState();
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const grid2 = document.querySelector('.bz-home-grid') as HTMLElement;
    expect(grid2.classList.contains('bz-home-grid--no-next')).toBe(false);
    expect((document.querySelector('[data-home-next]') as HTMLElement).textContent).toContain('明 天 预 告');
  });

  it('ui P3-3：周历选中格 aria-pressed 表达「当前在看哪天」，点选切换后同步', async () => {
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '甲', dt: yesterdayAt(9) }]);
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const today = todayStr();
    const yesterday = yesterdayDateStr();
    // 默认打开今天：今天格 pressed、其余 false
    expect(document.querySelector(`[data-home-weekday="${today}"]`)!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector(`[data-home-weekday="${yesterday}"]`)!.getAttribute('aria-pressed')).toBe('false');
    // 点昨天 → pressed 跟着切（局部更新，无全量重建）
    (document.querySelector(`[data-home-weekday="${yesterday}"]`) as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector(`[data-home-weekday="${yesterday}"]`)!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector(`[data-home-weekday="${today}"]`)!.getAttribute('aria-pressed')).toBe('false');
  });

  it('eff P2-2：renderAll 全量重建不丢滚位（keepHome 刷新场景）', async () => {
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '甲', dt: todayAt(10) }]);
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    // 时间线列滚到中部（jsdom 无真实布局，直接设 scrollTop 再触发一轮刷新）
    const flow = document.querySelector('[data-home-flow]') as HTMLElement;
    flow.scrollTop = 120;
    // 重开（showOverlay → refreshRiverAndRender → renderAll）后滚位保持
    closeOverlay();
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const flow2 = document.querySelector('[data-home-flow]') as HTMLElement;
    expect(flow2.scrollTop).toBe(120); // 修复前归零
  });

  it('ui P3-4：renderAll 全量重建后焦点落回等价新元素（入口行）', async () => {
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '甲', dt: todayAt(10) }]);
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const row = document.querySelector('[data-home-go="cinema"]') as HTMLElement;
    row.focus();
    expect(document.activeElement).toBe(row);
    // 重开触发一轮刷新（全量重建）→ 焦点应在新 DOM 的等价元素上，而不是跌回 body
    closeOverlay();
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const fresh = document.querySelector('[data-home-go="cinema"]') as HTMLElement;
    expect(fresh).not.toBe(row); // 元素确实是重建的新节点
    expect(document.activeElement).toBe(fresh);
  });

  it('issue 287：默认打开日＝最后有动静 → 开面板落在昨天并高亮那一格', async () => {
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '甲', dt: yesterdayAt(9) }]); // 只有昨天有动静
    setSettingsProvider(() => ({
      ...DEFAULT_SETTINGS,
      homeTimelineRange: 'week', // 窗口要够宽，昨天才在可选范围内
      homeDefaultDay: 'lastActive',
    }));
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const yesterday = yesterdayDateStr();
    expect(document.querySelector(`[data-home-weekday="${yesterday}"]`)!.classList.contains('bz-home-wk--sel')).toBe(true);
    expect(document.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(1); // 直接就看到昨天那条
  });

  it('时间线查看日随关闭保留、随卸载归零（issue 290 反转：重开停在上次查看日）', async () => {
    writeBehavior(vault, [
      { source: 'memo', type: 'added', name: '甲', dt: todayAt(9) },
      { source: 'memo', type: 'added', name: '乙', dt: yesterdayAt(9) }, // 昨天也有一条：切过去才有事件可断言
    ]);
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    // 点周历切到昨天 → 查看日停在过去
    const yesterday = yesterdayDateStr();
    (document.querySelector(`[data-home-weekday="${yesterday}"]`) as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(H.riverView).toBe(yesterday);

    // 关面板再重开（issue 290）：DOM 与查看日保留——同一元素复用，仍停昨天的选中
    const el1 = document.querySelector('.bz-home-overlay');
    closeOverlay();
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.bz-home-overlay')).toBe(el1); // 复用不重建
    expect(H.riverView).toBe(yesterday);
    expect(document.querySelector(`[data-home-weekday="${yesterday}"]`)!.classList.contains('bz-home-wk--sel')).toBe(true);
    expect(document.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(1); // 停在昨天：只出昨天那条（今天的不在）

    // 卸载（resetHomeState）才是查看日的真归零时机
    unloadHome();
    resetHomeState();
    expect(H.riverView).toBeNull();
  });

  it('点关闭钮 / 遮罩均关闭（issue 290：隐藏保留 DOM，非移除）', async () => {
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('[data-home-close]') as HTMLElement).click();
    const afterClose = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(afterClose).toBeTruthy();
    expect(afterClose.style.display).toBe('none');

    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(overlay.style.display).not.toBe('none');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect((document.querySelector('.bz-home-overlay') as HTMLElement).style.display).toBe('none');
  });

  it('issue 290：首次打开秒开——openHome 同步返回即有面板骨架，时间线异步汇入', async () => {
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '甲', dt: todayAt(9) }]);
    const app = recApp(vault);
    openHome(app); // 不 await：同步段就该有完整面板壳 + 骨架占位
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('[data-home-close]')).toBeTruthy();
    expect((overlay.querySelector('[data-home-flow]') as HTMLElement).textContent).toContain('正在汇入今天的痕迹');
    await new Promise((r) => setTimeout(r, 20));
    // 动态加载到位：骨架被真数据替换（时间线出今天那条，不再有「正在汇入」）
    expect((overlay.querySelector('[data-home-flow]') as HTMLElement).textContent).not.toContain('正在汇入今天的痕迹');
    expect(overlay.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(1);
  });

  it('issue 290：关闭保留 DOM——重开复用同一元素秒显旧渲染，动态刷新写入新数据', async () => {
    const app = recApp(vault); // 初始无行为流文件 → 时间线空态
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const el1 = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(el1.querySelector('.bz-home-flow-empty')!.textContent).toContain('这一天还没有留下痕迹');

    closeOverlay();
    expect(el1.isConnected).toBe(true); // DOM 保留
    expect(el1.style.display).toBe('none');

    // 行为流新增今日动静后重开：同一元素、同步恢复显示（秒显旧内容），刷新尚未到达
    writeBehavior(vault, [{ source: 'memo', type: 'added', name: '新条目', dt: todayAt(10) }]);
    openHome(app);
    expect(document.querySelector('.bz-home-overlay')).toBe(el1); // 复用不重建
    expect(el1.style.display).not.toBe('none');
    expect(H.overlayVisible).toBe(true);
    expect(el1.querySelector('.bz-home-flow-empty')!.textContent).toContain('这一天还没有留下痕迹'); // 旧渲染还在
    // 动态刷新到达：时间线写进新条目
    await new Promise((r) => setTimeout(r, 20));
    expect(el1.querySelectorAll('.bz-home-timeline .bz-home-ev').length).toBe(1);
  });

  it('issue 290：unloadHome 真销毁——隐藏保留的 DOM 被移除、状态整体归零', async () => {
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    closeOverlay();
    expect(document.querySelector('.bz-home-overlay')).toBeTruthy(); // 关闭保留
    unloadHome();
    expect(document.querySelector('.bz-home-overlay')).toBeNull(); // 卸载真销毁
    expect(H.currentOverlay).toBeNull();
    expect(H.overlayVisible).toBe(false);
    expect(H.river).toBeNull();
  });

  it('ui P3-1：字号档白名单——手改设置值含引号时白名单回落 normal，不逃逸 markup 属性位', async () => {
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, homeTimelineSize: '"><img src=x>' }));
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 20));
    const tl = document.querySelector('.bz-home-timeline') as HTMLElement;
    expect(tl).toBeTruthy();
    expect(tl.dataset.tlSize).toBe('normal'); // 非三档值 → readHomeSettings 源头回落
    expect(document.querySelector('.bz-home-timeline img')).toBeNull();
  });
});

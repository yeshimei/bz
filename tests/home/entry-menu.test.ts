// @vitest-environment node
/**
 * 首页入口菜单纯层契约（core/item-actions 的接线面，2026-09-10）：
 *  - DOMAIN_MENU 形状：只放域自己的快捷动作（无「打开 X」、无「整理顺序」；
 *    issue 449 D 起唯一例外 = people 的「打开脸谱」右键/长按直达，用户点名采纳）；
 *  - 末尾统一「设置」直达项（issue 388，2026-09-21）：每域动作后恒追加一条，定位该域设置页；
 *  - pomodoroMenuAction：番茄钟是唯一**相位敏感项**（四相位互斥、一次只出一条：
 *    未开始→开始专注 / 专注中→停止专注 / 暂停中→继续专注 / 休息中→跳过休息）；
 *  - sheetHeadHtml：长按抽屉盒头 = 域彩色图标 + 域名 + **入口行那行灰字**（口径与 riverCountText 同源，
 *    无计数文案回落域副题 —— 与入口行 `riverCountText(...) ?? d.sub` 完全一致）；
 *  - domainColor：入口行 / 瓦片 / 盒头共用同一取色口径，未登记域回落中性灰。
 */
import { describe, it, expect } from 'vitest';
import {
  DOMAIN_MENU, DOMAIN_MAP, DOMAIN_DOT, DOMAIN_ICONS, domainColor,
  pomodoroMenuAction, settingsMenuAction, sheetHeadHtml, menuHeadHtml, riverCountText, EMPTY_COUNTS,
} from '../../src/home/render';
import type { RiverData, RiverStreak } from '../../src/home/render';

const NOW = new Date(2026, 8, 7, 21, 36).getTime();

function ds(n: number): string {
  const d = new Date(NOW - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function riverData(counts: Partial<typeof EMPTY_COUNTS> = {}, streak?: RiverStreak): RiverData {
  const day = (i: number) => ({
    dateStr: ds(i),
    events: [],
    summary: { diary: 0, movies: 0, books: 0, memoDone: 0, memoCreated: 0, pomodoros: 0, pomodoroMinutes: 0 },
    firstTs: null,
  });
  const wk = (i: number) => ({ dateStr: ds(i), label: ds(i).slice(5), dayOfMonth: Number(ds(i).slice(8)), weekday: '', hit: false });
  return {
    today: day(0),
    yesterday: day(1),
    days: Array.from({ length: 7 }, (_, i) => day(i)),
    week: Array.from({ length: 7 }, (_, i) => wk(i)),
    streak: streak ?? { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS, ...counts },
    pomodoroFocusing: false, // item-1789106079981：专注态入 RiverData 后的必填字段（本文件不涉彩点，恒 false）
  };
}

describe('DOMAIN_MENU 形状', () => {
  it('只放域快捷动作：无「打开 X」、无「整理顺序」', () => {
    const ids = Object.keys(DOMAIN_MENU);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(DOMAIN_MAP.has(id), `菜单域 ${id} 必须在 DOMAINS 里`).toBe(true);
      const list = DOMAIN_MENU[id];
      expect(list.length).toBeGreaterThan(0);
      for (const a of list) {
        expect(a.label.trim()).not.toBe('');
        // 「无『打开 X』」契约：入口卡本身就是打开。唯一例外 = people「打开脸谱」
        // （issue 449 D，用户点名要右键/长按直达，见 shared.ts DOMAIN_MENU_RAW.people 声明处）
        if (id !== 'people') expect(a.label.startsWith('打开')).toBe(false);
        expect(a.label).not.toContain('整理顺序');
        expect(a.commandId).toMatch(/^bz-[a-z0-9-]+$/);
        expect(a.icon).toBeTruthy();
      }
    }
  });

  it('番茄钟是唯一相位敏感项，且表里只有一条（其余项按相位派发）', () => {
    const dyn = Object.entries(DOMAIN_MENU)
      .filter(([, list]) => list.some((a) => a.dynamic))
      .map(([id]) => id);
    expect(dyn).toEqual(['pomodoro']);
    // 1 条域动作 + 末尾统一「设置」直达（issue 388）；相位敏感的仍只有那一条
    expect(DOMAIN_MENU.pomodoro.length).toBe(2);
    expect(DOMAIN_MENU.pomodoro.filter((a) => a.dynamic).length).toBe(1);
    expect(DOMAIN_MENU.pomodoro[0].dynamic).toBe('phase');
    // 静态声明 = idle 兜底（挂菜单时整条被 pomodoroMenuAction 盖掉）
    expect(DOMAIN_MENU.pomodoro[0].label).toBe(pomodoroMenuAction('idle').label);
    expect(DOMAIN_MENU.pomodoro[0].keepHome).toBe(true);
  });

  it('设置 / 附件不在菜单里（无域快捷动作 → 不挂浮层）', () => {
    // 剪藏本与保险库 2026-09-11 起有条目（未读全部标为已读 / 锁定保险库），不再是空菜单
    for (const id of ['settings', 'attach']) {
      expect(DOMAIN_MENU[id], id).toBeUndefined();
    }
  });

  it('2026-09-11 新增项：命令 id 与开关标记（danger / keepHome / dynamic）', () => {
    const byId = (domain: string, commandId: string) =>
      DOMAIN_MENU[domain].find((a) => a.commandId === commandId);
    const added: Array<[string, string]> = [
      ['memo', 'bz-memo-note-binding'],
      ['cinema', 'bz-cinema-random-pick'],
      ['bookshelf', 'bz-bookshelf-continue'],
      ['secondbrain', 'bz-secondbrain-rebuild-index'],
      ['encrypt', 'bz-encrypt-lock-vault'],
      ['vault', 'bz-password-vault-lock'],
      ['clipping', 'bz-clipbook-mark-all-read'],
    ];
    for (const [domain, commandId] of added) {
      expect(byId(domain, commandId), commandId).toBeTruthy();
    }
    // 清空类：红字 + 不关首页（确认框叠在首页上，清完当场看到计数归零）
    expect(byId('clipping', 'bz-clipbook-mark-all-read')!.kind).toBe('danger');
    expect(byId('clipping', 'bz-clipbook-mark-all-read')!.keepHome).toBe(true);
    // 即时类：不关首页；开别域面板类（继续在读/随机抽一部/记一笔）保持默认关首页
    expect(byId('encrypt', 'bz-encrypt-lock-vault')!.keepHome).toBe(true);
    expect(byId('bookshelf', 'bz-bookshelf-continue')!.keepHome).toBeUndefined();
    // 番茄钟的「跳过休息 / 暂停·继续」不进表：它们是相位派发的结果（见下个 describe）
    expect(byId('pomodoro', 'bz-pomodoro-skip')).toBeUndefined();
  });

  it('2026-09-17 游戏库：立即同步（即时类，不关首页）+ 数据统计（开面板落统计页）', () => {
    const list = DOMAIN_MENU.gameshelf;
    // 2 条域动作 + 末尾统一「设置」直达（issue 388，形状见下方专门 describe）
    expect(list.length).toBe(3);
    // 顺序：即时类在前（与影院/书库的「先动作后报告」一致）
    expect(list[0].label).toBe('立即同步');
    expect(list[0].commandId).toBe('bz-gameshelf-sync');
    expect(list[0].keepHome).toBe(true); // 拉库要好几秒，关掉首页就看不到结果了
    expect(list[1].label).toBe('数据统计');
    expect(list[1].commandId).toBe('bz-gameshelf-stats');
    expect(list[1].keepHome).toBeUndefined(); // 开别域面板类 → 关首页再执行
    // 图标错开：统计类不与「阅读分析报告」的 bar-chart-3 重名（enh-sweep-a 惯例）
    expect(list[1].icon).not.toBe(DOMAIN_MENU.bookshelf[0].icon);
    // 菜单项不许叫「打开游戏库」（入口本身就是打开）
    expect(list.some((a) => a.label.startsWith('打开'))).toBe(false);
  });

  it('2026-09-24 密码本：快速生成密码（跳过选择器直接生成，与快速取密并存、图标错开）', () => {
    const byId = (commandId: string) => DOMAIN_MENU.vault.find((a) => a.commandId === commandId);
    const item = byId('bz-password-vault-quick-gen');
    expect(item).toBeTruthy();
    expect(item!.label).toBe('快速生成密码');
    expect(item!.icon).toBe('wand-sparkles');
    // 与「快速取密」（fuzzy 选择器）并存且图标错开
    expect(byId('bz-password-vault-gen')).toBeTruthy();
    expect(item!.icon).not.toBe(byId('bz-password-vault-gen')!.icon);
    // 缺省关首页再执行（复制完通常切走去粘贴，不 keepHome）
    expect(item!.keepHome).toBeUndefined();
  });

  it('2026-09-25 脸谱（people 域，issue 449 D）：入口卡 + 右键两条快捷 + 设置直达', () => {
    // 入口卡：iconOf('people') 走 core/domain-icons 单源（home 的 ICON_KEY 无异名，无需登记）
    const card = DOMAIN_MAP.get('people');
    expect(card, 'people 必须在 DOMAINS 里（DOMAIN_MAP 锁死菜单域与入口域同源）').toBeTruthy();
    expect(card!.name).toBe('脸谱');
    expect(card!.commandId).toBe('bz-people-open');
    expect(card!.icon).toBe(DOMAIN_ICONS.people);
    // 菜单：2 条域动作 + 末尾统一「设置」直达（settings-panel 已有 id:'people' 设置页，同名直通无需映射）
    const list = DOMAIN_MENU.people;
    expect(list.length).toBe(3);
    expect(list[0].label).toBe('打开脸谱');
    expect(list[0].commandId).toBe('bz-people-open');
    expect(list[0].icon).toBe('drama'); // 与磁贴同源（DOMAIN_ICONS.people）
    expect(list[1].label).toBe('导入聊天数据源');
    expect(list[1].commandId).toBe('bz-people-import');
    expect(list[1].icon).toBe('folder-down'); // 已在原型图标表（attach「入库」同语义）
    // 两条域动作都开别域面板 → 默认关首页（无 keepHome），也非慢动作（无 busyText）
    for (const a of list.slice(0, 2)) {
      expect(a.keepHome).toBeUndefined();
      expect(a.busyText).toBeUndefined();
    }
    const last = list[list.length - 1];
    expect(last.label).toBe('设置');
    expect(last.settingsDeep).toBe('people');
  });
});

describe('DOMAIN_MENU 设置直达（2026-09-21 拍板，issues 388）', () => {
  it('每个有菜单的域末尾统一追加一条「设置」，直达本域设置页', () => {
    const ids = Object.keys(DOMAIN_MENU);
    expect(ids.length).toBe(15); // 15 个有快捷动作的域全追加（issue 449 D 起 people 入表）；settings/attach 本就不在表内
    for (const id of ids) {
      const last = DOMAIN_MENU[id][DOMAIN_MENU[id].length - 1];
      expect(last.label, id).toBe('设置'); // 末位恒为设置项（域动作在前）
      expect(last.label.startsWith('打开'), id).toBe(false); // 不违反「无『打开 X』」契约
      expect(last.commandId).toBe('bz-settings-panel-open');
      expect(last.keepHome, '开设置面板 = 关首页再开（非 keepHome）').toBeUndefined();
      expect(last.busyText).toBeUndefined();
    }
  });

  it('settingsDeep 域 id 映射：vault→password-vault 异名一处，其余同名直通', () => {
    for (const [id, list] of Object.entries(DOMAIN_MENU)) {
      const last = list[list.length - 1];
      expect(last.settingsDeep, id).toBe(id === 'vault' ? 'password-vault' : id);
    }
    expect(DOMAIN_MENU.vault[DOMAIN_MENU.vault.length - 1].settingsDeep).toBe('password-vault');
  });

  it('settingsMenuAction 纯函数与导出表末尾项同源（id 归一化出口单源）', () => {
    expect(settingsMenuAction('vault')).toMatchObject({ label: '设置', commandId: 'bz-settings-panel-open', settingsDeep: 'password-vault' });
    expect(settingsMenuAction('diary').settingsDeep).toBe('diary');
    // 图标与「设置」入口磁贴同款（domain-icons 单源 settings-2，原型图标表已有，零新增）
    expect(settingsMenuAction('diary').icon).toBe(DOMAIN_ICONS['settings-panel']);
  });

  it('settings / attach 维持不挂浮层（设置入口点开本就是设置面板，不加冗余尾部项）', () => {
    for (const id of ['settings', 'attach']) {
      expect(DOMAIN_MENU[id], id).toBeUndefined();
    }
  });
});

describe('pomodoroMenuAction（相位敏感的单个动作）', () => {
  it('用户口径四条：未开始→开始专注 / 专注中→暂停专注 / 暂停中→继续专注 / 休息中→跳过休息', () => {
    expect(pomodoroMenuAction('idle').label).toBe('开始专注');
    expect(pomodoroMenuAction('focusing').label).toBe('暂停专注'); // PM2 残款：随命令侧对齐（原「停止专注」）
    expect(pomodoroMenuAction('paused').label).toBe('继续专注');
    expect(pomodoroMenuAction('break').label).toBe('跳过休息');
  });

  it('命令派发：① 开始走 focus-toggle；②③ 共用 pause（计时中暂停 / 暂停中继续）；④ 走 skip', () => {
    expect(pomodoroMenuAction('idle').commandId).toBe('bz-pomodoro-focus-toggle');
    expect(pomodoroMenuAction('focusing').commandId).toBe('bz-pomodoro-pause');
    expect(pomodoroMenuAction('paused').commandId).toBe('bz-pomodoro-pause');
    expect(pomodoroMenuAction('break').commandId).toBe('bz-pomodoro-skip');
  });

  it('四相位互斥：每支只出**一条**，且不出现「停止专注 + 继续专注」并列（2026-09-11 修正）', () => {
    const phases = ['idle', 'focusing', 'paused', 'break'] as const;
    const labels = phases.map((p) => pomodoroMenuAction(p).label);
    expect(new Set(labels).size).toBe(4); // 四支各不相同
    for (const p of phases) {
      // 单条：命令与图标各自非空，不存在「一条里塞多个动作」的形状
      const a = pomodoroMenuAction(p);
      expect(a.commandId).toMatch(/^bz-pomodoro-/);
      expect(a.icon).toBeTruthy();
      // 互斥语义：同一相位下不得同时给出停止与继续
      if (p === 'focusing') expect(a.label).not.toBe('继续专注');
      if (p === 'paused') expect(a.label).not.toBe('停止专注');
    }
  });
});

describe('menuHeadHtml（桌面菜单单行盒头，B 方案）', () => {
  it('一行版：域色点 + 域名 + 计数（计数与抽屉盒头同源）', () => {
    const data = riverData({ diaryTotal: 518 }, { diaryStreak: 3, diaryWrittenToday: true });
    const d = DOMAIN_MAP.get('diary')!;
    const html = menuHeadHtml(d, data);
    expect(html).toContain('bz-item-menu-head-dot');
    expect(html).toContain(DOMAIN_DOT.diary); // 域色点 = 域色（内联 style）
    expect(html).toContain('日记本');
    expect(html).toContain(riverCountText('diary', data)!);
    expect(html).toContain('518 篇');
    // 桌面菜单是**单行**窄条：不能带抽屉那两行版式的类名（否则排版会打架）
    expect(html).not.toContain('bz-home-sheet-head');
  });

  it('无计数文案的域 → 右侧留空，**不回落域副题**（副题偏长会把菜单顶宽）', () => {
    const data = riverData();
    const d = DOMAIN_MAP.get('settings')!;
    expect(riverCountText('settings', data)).toBeNull();
    const html = menuHeadHtml(d, data);
    expect(html).toContain('bz-item-menu-head-dot');
    expect(html).toContain(d.name);
    expect(html).not.toContain('bz-item-menu-head-cnt');
    expect(html).not.toContain(d.sub);
  });
});

describe('sheetHeadHtml（长按抽屉盒头）', () => {
  it('版式：上排=彩色域图标+域名同行，下排=入口行那行灰字', () => {
    const data = riverData({ diaryTotal: 518 }, { diaryStreak: 3, diaryWrittenToday: true });
    const d = DOMAIN_MAP.get('diary')!;
    const html = sheetHeadHtml(d, data);
    // 上排：图标占位与域名在同一容器内；该容器收起后才跟下排灰字（灰字不在图标行里）
    expect(html).toMatch(
      /<div class="bz-home-sheet-top">[\s\S]*data-lucide[\s\S]*bz-home-sheet-nm[\s\S]*<\/div>\s*<div class="bz-home-sheet-sub">/
    );
    expect(html).toContain('日记本');
    expect(html).toContain(riverCountText('diary', data)!); // 「518 篇 · 今日已写」
    expect(html).toContain('518 篇 · 今日已写');
    expect(html).toContain(DOMAIN_DOT.diary); // 图标色 = 域色（彩色图标）
  });

  it('无计数文案的域回落域副题（与入口行 `riverCountText ?? sub` 一致）', () => {
    const data = riverData();
    const d = DOMAIN_MAP.get('settings')!;
    expect(riverCountText('settings', data)).toBeNull();
    expect(sheetHeadHtml(d, data)).toContain(d.sub);
  });

  it('未知域色回落中性灰；已登记域取 DOMAIN_DOT', () => {
    expect(domainColor('nope')).toBe('#8a8f99');
    expect(domainColor('diary')).toBe(DOMAIN_DOT.diary);
  });
});

describe('DOMAIN_MENU busyText 槽位（eff P3-2：慢动作 busy 反馈）', () => {
  it('只挂 keepHome 慢动作（同步/重建索引），即时类动作不挂', () => {
    const busy: string[] = [];
    for (const [id, acts] of Object.entries(DOMAIN_MENU)) {
      for (const a of acts) {
        if (!a.busyText) continue;
        busy.push(`${id}:${a.label}`);
        expect(a.keepHome, 'busyText 只对 keepHome 动作有意义').toBe(true);
      }
    }
    expect(busy.sort()).toEqual(['gameshelf:立即同步', 'secondbrain:重建索引']);
  });
});

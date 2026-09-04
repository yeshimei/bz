/**
 * 今日回顾（recap 域）UI 测试（方向一 R2）：面板开合（toggle/ESC/卸载）、
 * 摘要行五格与 N/A 降级、痕迹时间轴渲染、空天 .bz-empty 引导（写日记动作）、
 * R3「生成今日总结」disabled 占位、home 入口磁贴注册。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { resetRecapState } from '../../src/recap/state';
import { openRecap, unloadRecap } from '../../src/recap';
import { openHome, unloadHome } from '../../src/home';
import { resetHomeState } from '../../src/home/state';
import { DOMAINS, ALL_DOMAIN_IDS } from '../../src/home/domains';
import { DOMAIN_ICONS } from '../../src/core/domain-icons';

/** 带数字 stat 的 vault（同 aggregate.test.ts；UI 集成用例带影视/读书 mtime 痕迹） */
class StatVault extends MockVault {
  stats = new Map<string, { ctime: number; mtime: number }>();
  file(path: string): any {
    const f = super.file(path);
    const s = this.stats.get(path);
    if (s) f.stat = s;
    return f;
  }
}

/** 带 listCommands/executeCommandById 的 app（记录执行过的命令，home/weekly-ui 同款） */
function recApp(vault: MockVault) {
  const base = mockAppWithVault(vault);
  const executed: string[] = [];
  (base as any).commands.listCommands = () => [];
  (base as any).commands.executeCommandById = async (id: string) => {
    executed.push(id);
  };
  (base as any).__executed = executed;
  return base as any;
}

const TODAY0 = new Date().setHours(0, 0, 0, 0);
const AT = (h: number, m: number) => TODAY0 + h * 3600000 + m * 60000;

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 种混合数据（同 aggregate 集成用例的浓缩版：五域各有痕迹） */
function seedDay(vault: StatVault): void {
  const t = todayStr();
  const y = todayStr(-1);
  vault.files.set(`我的/日记/${t}.md`, '# 📖 09:00\n\n早读了一会儿\n\n# 📖 23:10\n\n睡前记一笔');
  vault.files.set('我的/影视/《夜片》.md', '---\ntags:\n- 电影\n观影日期: ' + t + '\n评分: 9\n---\n');
  vault.stats.set('我的/影视/《夜片》.md', { ctime: AT(10, 0), mtime: AT(23, 14) });
  vault.files.set('书库/读完的书.md', '---\ntags:\n- book\nreadingDate: 2026-08-01\ncompletionDate: ' + t + '\n---\n');
  vault.stats.set('书库/读完的书.md', { ctime: AT(9, 0), mtime: AT(21, 0) });
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
    { title: '晨跑', created: `${y} 08:00:00`, completed: `${t} 09:02:00` },
  ]));
  vault.files.set('CONFIG/STORAGE/pomodoro.json', JSON.stringify({
    version: 1,
    state: {},
    history: [{ ts: AT(21, 25), duration: 1500, task: '写周报' }],
  }));
}

describe('今日回顾面板（recap 域）', () => {
  let vault: StatVault;

  beforeEach(() => {
    vault = new StatVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetObsidianMocks();
    resetRecapState();
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    unloadRecap();
    document.body.innerHTML = '';
  });

  const overlay = (): HTMLElement => document.querySelector('.bz-recap-overlay') as HTMLElement;

  it('打开面板：头行（今日回顾 + 日期）+ R3 占位钮禁用 + 摘要行/时间轴渲染正序痕迹', async () => {
    seedDay(vault);
    openRecap(recApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    expect(overlay()).toBeTruthy();
    expect(overlay().querySelector('.bz-recap-title')!.textContent).toBe('今日回顾');
    expect(overlay().querySelector('.bz-recap-date')!.textContent).toMatch(/周/);
    // R3 占位：「生成今日总结」禁用 + tooltip 即将可用
    const ai = overlay().querySelector('[data-recap-ai]') as HTMLButtonElement;
    expect(ai.disabled).toBe(true);
    expect(ai.title).toBe('即将可用');
    // 摘要行五格：日记 2 条 / 影视 1 / 读书 1 / 待办完成 1 / 番茄 1 个 25 分钟
    const stats = [...overlay().querySelectorAll('.bz-recap-stat')];
    expect(stats.map((s) => s.querySelector('.bz-recap-stat-k')!.textContent)).toEqual(
      ['日记', '影视', '读书', '待办完成', '番茄']
    );
    expect(stats.map((s) => s.querySelector('.bz-recap-stat-v')!.textContent)).toEqual(
      ['2 条', '1', '1', '1', '1 个 · 25 分钟']
    );
    // 时间轴：时间正序，行=时刻+域图标+域名前缀+一句话
    const rows = [...overlay().querySelectorAll('.bz-recap-row')] as HTMLElement[];
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.querySelector('.bz-recap-time')!.textContent)).toEqual(
      ['09:02', '21:00', '21:00–21:25', '23:10', '23:14']
    );
    expect(rows[0].textContent).toContain('完成『晨跑』');
    expect(rows[3].textContent).toContain('新增 2 条');
    expect(rows[3].querySelector('.bz-recap-dom')!.textContent).toBe('日记');
    expect(rows[4].textContent).toContain('标记《夜片》已看 · ★★★★☆');
    // 域图标（lucide 占位经 uiIcon 渲染为 .bz-ic）
    expect(rows[4].querySelector('.bz-recap-row-ic .bz-ic')).toBeTruthy();
  });

  it('空天：.bz-empty「今天还没有记录」+ 写日记动作（点击关面板并执行 bz-diary-write）', async () => {
    const app = recApp(vault);
    openRecap(app);
    await new Promise((r) => setTimeout(r, 0));
    const empty = overlay().querySelector('.bz-empty') as HTMLElement;
    expect(empty).toBeTruthy();
    expect(empty.querySelector('.bz-empty-title')!.textContent).toBe('今天还没有记录');
    const btn = [...empty.querySelectorAll('button')].find((b) => b.textContent === '写日记') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect((app as any).__executed).toEqual(['bz-diary-write']);
    expect(overlay()).toBeNull(); // 面板已关
  });

  it('失败域降级：memo.json 解析失败 → 待办完成格 N/A，其余格与时间轴照常', async () => {
    seedDay(vault);
    vault.files.set('CONFIG/STORAGE/memo.json', '{{{bad json');
    openRecap(recApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    const stats = [...overlay().querySelectorAll('.bz-recap-stat')];
    const values = stats.map((s) => s.querySelector('.bz-recap-stat-v')!.textContent);
    expect(values[3]).toBe('N/A'); // 待办完成
    expect(values[0]).toBe('2 条'); // 日记不受牵连
    expect(overlay().querySelectorAll('.bz-recap-row').length).toBe(4); // 待办痕迹缺席
  });

  it('toggle 语义：重复命令关闭；ESC 关闭；unloadRecap 清 DOM 与状态', async () => {
    openRecap(recApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    expect(overlay()).toBeTruthy();
    openRecap(recApp(vault)); // toggle 关
    expect(overlay()).toBeNull();
    // 重开 + ESC 关（escManager 层）
    openRecap(recApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay()).toBeNull();
    // 重开 + 卸载清理
    openRecap(recApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    unloadRecap();
    expect(overlay()).toBeNull();
    resetRecapState();
    expect(document.querySelectorAll('.bz-recap-overlay').length).toBe(0);
  });
});

describe('home 入口磁贴（今日回顾）', () => {
  let vault: StatVault;

  beforeEach(() => {
    vault = new StatVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetObsidianMocks();
    resetRecapState();
    resetHomeState();
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    unloadRecap();
    unloadHome();
    document.body.innerHTML = '';
  });

  it('磁贴清单注册：id recap、命令 bz-recap-today、图标与 DOMAIN_ICONS.recap 同源', () => {
    const tile = DOMAINS.find((d) => d.id === 'recap');
    expect(tile).toBeTruthy();
    expect(tile!.commandId).toBe('bz-recap-today');
    expect(tile!.name).toBe('今日回顾');
    expect(tile!.icon).toBe(DOMAIN_ICONS.recap);
    expect(ALL_DOMAIN_IDS).toContain('recap');
  });

  it('未钉选时以迷你 chip 可达（点击执行 bz-recap-today）', async () => {
    vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned: ['diary'] }));
    const app = recApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const mini = document.querySelector('[data-home-mini="recap"]') as HTMLElement;
    expect(mini).toBeTruthy();
    mini.click();
    await new Promise((r) => setTimeout(r, 0));
    expect((app as any).__executed).toEqual(['bz-recap-today']);
    // 首页已关（mock 命令通道只记录 id，回顾面板真实开合由上一组用例覆盖）
    expect(document.querySelector('.bz-home-overlay')).toBeNull();
  });
});

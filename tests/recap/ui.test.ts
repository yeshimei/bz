/**
 * 今日回顾（recap 域）UI 测试（方向一 R2）：面板开合（toggle/ESC/卸载）、
 * 摘要行五格与 N/A 降级、痕迹时间轴渲染、空天 .bz-empty 引导（写日记动作）、
 * R3「生成今日总结」按钮（AI 写入日记/失败降级模板动作/防重复点击/重新生成态）、
 * home 入口磁贴注册。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setApp as setDiaryApp } from '../../src/diary/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { resetRecapState } from '../../src/recap/state';
import { openRecap, unloadRecap } from '../../src/recap';
import { openHome, unloadHome } from '../../src/home';
import { resetHomeState } from '../../src/home/state';
import { DOMAINS, ALL_DOMAIN_IDS } from '../../src/home/domains';
import { DOMAIN_ICONS } from '../../src/core/domain-icons';

vi.mock('../../src/core/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/ai')>();
  return { ...actual, createAI: vi.fn(), getAIProvider: vi.fn() };
});

import { createAI, getAIProvider } from '../../src/core/ai';
import { recapDiaryFilePath, RECAP_MARKER } from '../../src/recap/summarize';
import { H } from '../../src/recap/state';
import { parseFile } from '../../src/diary/parser';
import { setDiaryDataMap, state as diaryState } from '../../src/diary/state';

const mockedCreateAI = vi.mocked(createAI);
const mockedGetProvider = vi.mocked(getAIProvider);

/** 等一个宏任务（采集/探测/写入链路全是异步） */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const overlay = (): HTMLElement => document.querySelector('.bz-recap-overlay') as HTMLElement;

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
    vi.clearAllMocks();
    // diary 写入 API 的 app 注入 + 内存状态复位（writeRecapEntry 走真实 diary store）
    setDiaryApp(mockAppWithVault(vault) as any);
    setDiaryDataMap(null);
    diaryState.data.originalDiaryEntries = [];
    diaryState.data.currentFilteredEntries = [];
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    unloadRecap();
    document.body.innerHTML = '';
  });

  it('打开面板：头行（今日回顾 + 日期）+ R3 生成钮就绪 + 摘要行/时间轴渲染正序痕迹', async () => {
    seedDay(vault);
    openRecap(recApp(vault));
    await flush();
    await flush();
    expect(overlay()).toBeTruthy();
    expect(overlay().querySelector('.bz-recap-title')!.textContent).toBe('今日回顾');
    expect(overlay().querySelector('.bz-recap-date')!.textContent).toMatch(/周/);
    // R3 生成钮：数据就绪后启用；当天还没有回顾条目 → 「生成今日总结」
    const ai = overlay().querySelector('[data-recap-ai]') as HTMLButtonElement;
    expect(ai.disabled).toBe(false);
    expect(ai.textContent).toBe('生成今日总结');
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

describe('R3 生成今日总结（写进日记）', () => {
  let vault: StatVault;
  const diaryPath = (): string => recapDiaryFilePath(Date.now());

  /** 在 seedDay 之上再种一条已有回顾条目（21:45，时刻乱序只为验证解析健壮性） */
  function seedRecap(): void {
    const p = `我的/日记/${todayStr()}.md`;
    vault.files.set(p, (vault.files.get(p) ?? '') + `\n\n# 📖 21:45\n\n${RECAP_MARKER}\n下午生成的旧总结`);
  }

  /** 打开面板并等采集+按钮探测就绪（按钮启用=链路落定；写路径含首次动态 import diary/store，
   *  vite-node 加载耗时不确定，固定 flush 会竞态——统一 vi.waitFor 轮询） */
  async function openReady(app: any): Promise<HTMLButtonElement> {
    openRecap(app);
    return vi.waitFor(() => {
      const b = overlay().querySelector('[data-recap-ai]') as HTMLButtonElement | null;
      expect(b).toBeTruthy();
      expect(b!.disabled).toBe(false);
      return b!;
    });
  }

  /** 等一次生成流程彻底结束（写入/通知均已落定） */
  async function waitForIdle(): Promise<void> {
    await vi.waitFor(() => expect(H.generating).toBe(false));
  }

  beforeEach(() => {
    vault = new StatVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetObsidianMocks();
    resetRecapState();
    vi.clearAllMocks();
    setDiaryApp(mockAppWithVault(vault) as any);
    setDiaryDataMap(null);
    diaryState.data.originalDiaryEntries = [];
    diaryState.data.currentFilteredEntries = [];
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    unloadRecap();
    document.body.innerHTML = '';
  });

  it('当天已有回顾条目：按钮变「重新生成」', async () => {
    seedDay(vault);
    seedRecap();
    const ai = await openReady(recApp(vault));
    expect(ai.disabled).toBe(false);
    expect(ai.textContent).toBe('重新生成');
  });

  it('AI 成功：点击 → 写入当天日记一条回顾条目 + 成功通知带「查看」+ 按钮变「重新生成」', async () => {
    seedDay(vault);
    mockedGetProvider.mockResolvedValue({} as never);
    mockedCreateAI.mockReturnValue({
      chat: vi.fn(async () => '今天你早读了很久，睡前还记了两笔，节奏很稳。'),
    } as never);
    const app = recApp(vault);
    const opened: string[] = [];
    (app as any).workspace.openLinkText = async (p: string) => {
      opened.push(p);
    };
    const ai = await openReady(app);
    ai.click();
    await waitForIdle();
    // 写入：恰好一条回顾条目，正文=AI 总结+关键数字行
    const content = vault.files.get(diaryPath()) ?? '';
    expect(content).toContain('今天你早读了很久');
    expect(content).toContain('今日数字：日记 2 条');
    const parsed = parseFile(content, todayStr());
    expect(parsed.filter((e) => e.content.trimStart().startsWith(RECAP_MARKER))).toHaveLength(1);
    // 通知 + 查看动作打开当天日记
    expect(hasNotice('今日总结已写入日记')).toBe(true);
    const viewBtn = [...document.querySelectorAll('.bz-notice-action')].find(
      (el) => el.textContent === '查看'
    ) as HTMLElement;
    viewBtn.click();
    expect(opened).toEqual([diaryPath()]);
    // 按钮态（sync 探测落定后变「重新生成」）
    await vi.waitFor(() => expect(ai.textContent).toBe('重新生成'));
    expect(ai.disabled).toBe(false);
  });

  it('AI 未配置：不写盘 + 警告通知给「写入日记/复制」双动作；点写入日记才落盘', async () => {
    seedDay(vault);
    mockedGetProvider.mockRejectedValue(new Error('未配置 OpenCode API Key：插件设置 → AI 配置 → OpenCode 密钥'));
    const ai = await openReady(recApp(vault));
    ai.click();
    await waitForIdle();
    // 未自动写盘
    expect(vault.files.get(diaryPath()) ?? '').not.toContain(RECAP_MARKER);
    // 人话降级通知 + 双动作
    expect(hasNotice(/未配置 AI 服务/)).toBe(true);
    const labels = [...document.querySelectorAll('.bz-notice-action')].map((el) => el.textContent);
    expect(labels).toEqual(['写入日记', '复制']);
    // 点「写入日记」→ 模板条目落盘（等待写入完成再断言）
    const writeBtn = [...document.querySelectorAll('.bz-notice-action')].find(
      (el) => el.textContent === '写入日记'
    ) as HTMLElement;
    writeBtn.click();
    await vi.waitFor(() => expect(vault.files.get(diaryPath()) ?? '').toContain(RECAP_MARKER));
    const content = vault.files.get(diaryPath()) ?? '';
    expect(content).toContain('今天：日记 2 条'); // 模板句（无 AI 文案）
    expect(parseFile(content, todayStr()).filter((e) => e.content.trimStart().startsWith(RECAP_MARKER))).toHaveLength(1);
  });

  it('生成进行中再点：忽略重复点击（AI 只请求一次），完成后写入一条', async () => {
    seedDay(vault);
    mockedGetProvider.mockResolvedValue({} as never);
    let resolveChat!: (v: string) => void;
    const chat = vi.fn(
      () => new Promise<string>((res) => { resolveChat = res; })
    );
    mockedCreateAI.mockReturnValue({ chat } as never);
    const ai = await openReady(recApp(vault));
    ai.click();
    ai.click(); // H.generating 已在首击同步置位 → 忽略
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(1)); // 请求已发出
    ai.click(); // 请求挂起期间再点 → 仍忽略
    expect(chat).toHaveBeenCalledTimes(1);
    resolveChat('今天你过得很踏实。');
    await waitForIdle();
    expect(parseFile(vault.files.get(diaryPath()) ?? '', todayStr())).toHaveLength(3); // 2 普通 + 1 回顾
  });

  it('生成中关面板再重开：请求落定后新面板按钮恢复可用（不卡死 disabled）', async () => {
    seedDay(vault);
    mockedGetProvider.mockResolvedValue({} as never);
    let resolveChat!: (v: string) => void;
    const chat = vi.fn(
      () => new Promise<string>((res) => { resolveChat = res; })
    );
    mockedCreateAI.mockReturnValue({ chat } as never);
    const app = recApp(vault);
    const ai = await openReady(app);
    ai.click();
    // 等 chat 真正被调用（promise 已创建 → resolveChat 已赋值；生成链路有若干微任务）
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    // 生成中 ESC 关面板
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay()).toBeNull();
    // 请求落定后重开面板：按钮由生成收口的 sync 接管，恢复可用且为「重新生成」
    resolveChat('今天你过得很踏实。');
    await waitForIdle();
    const ai2 = await openReady(app);
    await vi.waitFor(() => expect(ai2.textContent).toBe('重新生成'));
    expect(ai2.disabled).toBe(false);
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

import { todayStr } from '../helpers/date';
/**
 * home「生成今日总结」动作测试（ADR-0154：自 recap 独立面板迁入时间线河卡动作行）：
 * 今天视图动作行渲染（昨天视图不出现）、AI 成功 → 写日记落点（回顾条目 + 关键数字行）
 * + 成功通知「查看」+ 按钮变「重新生成」、AI 未配置降级模板双动作（写入日记才落盘）、
 * 生成中防重复点击、域清单无 recap 残留。
 * AI 调用一律 mock（core/ai），写盘走真实 diary store（内存 vault）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, hasNotice } from '../mock-obsidian-entry';
import { setApp, setApp as setDiaryApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { openHome, unloadHome } from '../../src/home';
import { resetHomeState, H } from '../../src/home/state';
import { DOMAINS, ALL_DOMAIN_IDS } from '../../src/home/domains';
import { diaryEntryPath, diaryDateFromEntryPath, parseDiaryEntryFile, serializeDiaryEntryFile } from '../../src/core/diary-format';
import { setDiaryDataMap } from '../../src/diary/store';
import { RECAP_MARKER } from '../../src/recap/summarize';

vi.mock('../../src/core/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/ai')>();
  return { ...actual, createAI: vi.fn(), getAIProvider: vi.fn() };
});

import { createAI, getAIProvider } from '../../src/core/ai';

const mockedCreateAI = vi.mocked(createAI);
const mockedGetProvider = vi.mocked(getAIProvider);

/** 带数字 stat 的 vault（同原 tests/recap/ui.test.ts：UI 集成用例带影视/读书 mtime 痕迹） */
class StatVault extends MockVault {
  stats = new Map<string, { ctime: number; mtime: number }>();
  file(path: string): any {
    const f = super.file(path);
    const s = this.stats.get(path);
    if (s) f.stat = s;
    return f;
  }
}

/** 带 listCommands/executeCommandById 的 app（记录执行过的命令，tests/home 同款） */
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

/** 种混合数据（五域各有痕迹；同原 recap 面板测试的浓缩版） */
function seedDay(vault: StatVault): void {
  const t = todayStr();
  const y = todayStr(-1);
  vault.files.set(diaryEntryPath('我的/日记', t, '09:00'), serializeDiaryEntryFile({ date: t, time: '09:00' }, ['日记'], '早读了一会儿'));
  vault.files.set(diaryEntryPath('我的/日记', t, '23:10'), serializeDiaryEntryFile({ date: t, time: '23:10' }, ['日记'], '睡前记一笔'));
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

/** 当天「日记目录下条目文件」枚举与「今日回顾」条目文件定位 */
function dayFiles(vault: MockVault): string[] {
  return [...vault.files.keys()].filter((p) => p.startsWith('我的/日记/') && diaryDateFromEntryPath(p) === todayStr());
}
function recapFile(vault: MockVault): string | null {
  return (
    dayFiles(vault).find((p) => parseDiaryEntryFile(vault.files.get(p)!).body.trimStart().startsWith(RECAP_MARKER)) ??
    null
  );
}

/** 时间线卡动作行按钮（render 层 [data-home-ai]） */
function aiBtn(): HTMLButtonElement | null {
  return document.querySelector('.bz-home-overlay [data-home-ai]') as HTMLButtonElement | null;
}

/** 等面板数据渲染完 + 按钮探测落定（启用 = 链路落定；写路径含动态 import diary/store，
 *  固定 sleep 会竞态——统一 vi.waitFor 轮询） */
async function waitReady(): Promise<HTMLButtonElement> {
  return vi.waitFor(() => {
    const b = aiBtn();
    expect(b, '时间线卡动作行按钮未渲染').toBeTruthy();
    expect(b!.disabled).toBe(false);
    return b!;
  });
}

/** 等一次生成流程彻底结束（写入/通知均已落定） */
async function waitForIdle(): Promise<void> {
  await vi.waitFor(() => expect(H.aiGenerating).toBe(false));
}

describe('home 生成今日总结（ADR-0154 迁入时间线卡）', () => {
  let vault: StatVault;

  beforeEach(() => {
    vault = new StatVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetObsidianMocks();
    resetHomeState();
    vi.clearAllMocks();
    // diary 写入 API 的 app 注入 + 内存状态复位（writeRecapEntry 走真实 diary store）
    setDiaryApp(mockAppWithVault(vault) as any);
    setDiaryDataMap(null);
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    unloadHome();
    resetHomeState();
    document.body.innerHTML = '';
  });

  it('动作行渲染：今天视图出「生成今日总结」并随探测启用；切昨天消失、切回今天恢复', async () => {
    seedDay(vault);
    const app = recApp(vault);
    openHome(app);
    const ai = await waitReady();
    expect(ai.textContent).toBe('生成今日总结'); // 当天还没有回顾条目
    // 动作行挂在时间线卡内（bz-home-timeline 容器）
    expect(ai.closest('.bz-home-timeline')).toBeTruthy();

    // 切昨天：总结写的是「今天」，昨天视图不出现动作行
    const ybtn = document.querySelector(`[data-home-weekday="${todayStr(-1)}"]`) as HTMLElement;
    expect(ybtn, '周历昨天格子缺失').toBeTruthy();
    ybtn.click();
    await vi.waitFor(() => expect(aiBtn()).toBeNull());

    // 切回今天：动作行恢复，探测落定后启用
    (document.querySelector(`[data-home-weekday="${todayStr()}"]`) as HTMLElement).click();
    await waitReady();
  });

  it('AI 成功：点击 → 现场采集 → 写入当天回顾条目（标记+AI 文案+关键数字行）+ 成功通知「查看」+ 按钮变「重新生成」', async () => {
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
    openHome(app);
    const ai = await waitReady();
    ai.click();
    await waitForIdle();
    // 写入落点：恰好一篇回顾条目文件，正文 = AI 总结 + 末尾关键数字行（口径与原面板一致）
    const p = recapFile(vault)!;
    expect(p).toBeTruthy();
    const content = vault.files.get(p)!;
    expect(content).toContain('今天你早读了很久');
    expect(content).toContain('今日数字：日记 2 条');
    expect(parseDiaryEntryFile(content).body.trimStart().startsWith(RECAP_MARKER)).toBe(true);
    // 成功通知 + 「查看」动作打开当天回顾条目文件
    expect(hasNotice('今日总结已写入日记')).toBe(true);
    const viewBtn = [...document.querySelectorAll('.bz-notice-action')].find(
      (el) => el.textContent === '查看'
    ) as HTMLElement;
    viewBtn.click();
    await vi.waitFor(() => expect(opened.length).toBe(1));
    expect(opened[0]).toBe(p.replace(/\.md$/, ''));
    // 按钮态收口（sync 探测落定后变「重新生成」）
    await vi.waitFor(() => expect(ai.textContent).toBe('重新生成'));
    expect(ai.disabled).toBe(false);
  });

  it('AI 未配置：不写盘 + 警告通知给「写入日记/复制」双动作；点写入日记才落盘', async () => {
    seedDay(vault);
    mockedGetProvider.mockRejectedValue(new Error('未配置 OpenCode API Key：插件设置 → AI 配置 → OpenCode 密钥'));
    openHome(recApp(vault));
    const ai = await waitReady();
    ai.click();
    await waitForIdle();
    // 未自动写盘
    expect(recapFile(vault)).toBeNull();
    // 人话降级通知 + 双动作
    expect(hasNotice(/未配置 AI 服务/)).toBe(true);
    const labels = [...document.querySelectorAll('.bz-notice-action')].map((el) => el.textContent);
    expect(labels).toEqual(['写入日记', '复制']);
    // 点「写入日记」→ 模板条目落盘
    const writeBtn = [...document.querySelectorAll('.bz-notice-action')].find(
      (el) => el.textContent === '写入日记'
    ) as HTMLElement;
    writeBtn.click();
    await vi.waitFor(() => expect(recapFile(vault)).toBeTruthy());
    const content = vault.files.get(recapFile(vault)!)!;
    expect(content).toContain('今天：日记 2 条'); // 模板句（无 AI 文案）
    // 同日仅一条回顾条目
    expect(dayFiles(vault).filter((f) => parseDiaryEntryFile(vault.files.get(f)!).body.trimStart().startsWith(RECAP_MARKER))).toHaveLength(1);
  });

  it('生成进行中再点：忽略重复点击（AI 只请求一次），完成后写入一条', async () => {
    seedDay(vault);
    mockedGetProvider.mockResolvedValue({} as never);
    let resolveChat!: (v: string) => void;
    const chat = vi.fn(
      () => new Promise<string>((res) => { resolveChat = res; })
    );
    mockedCreateAI.mockReturnValue({ chat } as never);
    openHome(recApp(vault));
    const ai = await waitReady();
    ai.click();
    ai.click(); // H.aiGenerating 已在首击同步置位 → 忽略
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    ai.click(); // 请求挂起期间再点 → 仍忽略
    expect(chat).toHaveBeenCalledTimes(1);
    resolveChat('今天你过得很踏实。');
    await waitForIdle();
    expect(dayFiles(vault)).toHaveLength(3); // 2 普通 + 1 回顾（各一篇条目文件）
  });
});

describe('home 域清单（recap 退役后，ADR-0154）', () => {
  it('recap 已从首页入口清单退役', () => {
    expect(DOMAINS.some((d) => d.id === 'recap')).toBe(false);
    expect(ALL_DOMAIN_IDS).not.toContain('recap');
  });
});

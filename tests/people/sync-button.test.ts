// @vitest-environment jsdom
/**
 * 数据源册页「同步」按钮接线测试（issue 465 / ADR-0196 决策 6、10）：
 * 点同步 = 插件调 bz-face sync 跑完整条链，册页内一条进度行推进；运行中该位置只出「停止」；
 * 完成（终态）重扫数据根刷新列表并标出更新数、**不自动导入**；错误面（微信未开 / 工具未装 /
 * 数据根未配置）在册页内给中文人话；同步进行中「画脸谱」入口被同步锁死（ADR-0196 决策 10：
 * 详情页动作签置灰、数据源页脚同锁——issue 505 相册簿改版后由 applySyncLockdown 按新钩子覆盖）。
 *
 * 进程壳经 setSyncRunnerForTests 注入假件喂预录协议行；引擎经 setJobsModuleForTests 注入
 * 假件（空队列）；数据根用临时真实目录（datasource 读库外文件夹走 window.require('fs')）。
 * 不 spawn 真进程、不碰真实微信与真实 vault。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  closePeoplePanel,
  isPeopleOpen,
  openDataSource,
  openPeoplePanel,
  setJobsModuleForTests,
  type JobsApi,
} from '../../src/people/ui';
import type { ExternalToolCallbacks, ExternalToolOutcome, ExternalToolSpec } from '../../src/core/external-tool';
import { BZ_FACE_INSTALL_HINT, setSyncRunnerForTests, stopSync, type SyncRunner } from '../../src/people/sync';
import { setExportRunnerForTests } from '../../src/people/export';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { PersonEntry } from '../../src/people/types';
import type { JobView, PersonJob } from '../../src/people/jobs';

const require = createRequire(import.meta.url);
const PW = 'sync-test-pw';
const T0 = 1_750_000_000; // chat.json ct 秒级
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** 假进程壳（同 tests/people/sync.test.ts：记录 spec、转发协议行、手动终结） */
class FakeTool {
  calls: ExternalToolSpec[] = [];
  stopCalls = 0;
  private cb: ExternalToolCallbacks | null = null;
  private resolve: ((o: ExternalToolOutcome) => void) | null = null;

  runner: SyncRunner = (spec, cb) => {
    this.calls.push(spec);
    this.cb = cb;
    return {
      stop: () => {
        this.stopCalls++;
        void this.settle({ ok: false, stopped: true, code: null, stderr: '', error: null });
      },
      done: new Promise<ExternalToolOutcome>((r) => {
        this.resolve = r;
      }),
    };
  };

  step(text: string): void { this.cb!.onStep(text); }
  progress(phase: string | null, pct: number | null): void { this.cb!.onProgress(phase, pct); }
  info(data: Record<string, unknown>): void { this.cb!.onInfo(data); }
  result(data: Record<string, unknown>): void { this.cb!.onResult(data); }
  settle(o: Partial<ExternalToolOutcome>): Promise<void> {
    this.resolve?.({ ok: false, stopped: false, code: 1, stderr: '', error: null, ...o } as ExternalToolOutcome);
    return new Promise((r) => setTimeout(r, 0));
  }
  /** 一次「从起跑到成功交付」的标准剧本 */
  async runHappy(stats: Record<string, unknown>): Promise<void> {
    this.step('正在取密钥');
    this.progress('key', null);
    this.progress('decrypt', 50);
    this.progress('contacts', 100);
    this.result({ ok: true, ...stats });
    await this.settle({ ok: true, code: 0 });
  }
}

/** 假引擎：队列可注（空队列 = 无任务；486 起可喂 paused / running 任务验守卫口径）；只记录调用 */
function fakeJob(partial: Partial<PersonJob>): JobView {
  return { batchesTotal: 3, queueIndex: 1, queueTotal: 1, stage: 'chunked', batchesDone: 0, ...partial } as JobView;
}

/** startJobs 捕获（492 回归用）：记录每次引擎收到的 (app, targets) */
let engineStarted: Array<[unknown, { talker: string; msgs: unknown[] }[]]> = [];

function fakeEngine(queue: JobView[] = []): JobsApi {
  return {
    startJobs: async (app, targets) => {
      engineStarted.push([app, targets as { talker: string; msgs: unknown[] }[]]);
      return { queued: [], skipped: [], resumed: [] };
    },
    resumeJobs: async () => {},
    resume: () => false,
    pauseJobs: () => {},
    removeJob: () => false,
    subscribe: () => () => {},
    snapshot: () => ({ queue, currentIndex: queue.length ? 0 : -1, running: false }),
  };
}

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** 497：startGeneration 起引擎前弹一次总确认——等它出现（505 起是册子里的一页）并点「开始生成」放行 */
async function confirmGen(): Promise<void> {
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="gen"]')).toBeTruthy());
  click('[data-people-gen-start]');
}

/** 点照片进详情：册子先放一段「抽照片」的动画（240ms），等对面那页翻开 */
async function openDetail(id: string): Promise<void> {
  // 505：册页（数据源 / 找一找 / 开工单…）摊开时册子上画的是那一页，照片不在册上——先把那页合上
  if (document.querySelector('[data-people-close]')) click('[data-people-close]');
  await vi.waitFor(() => expect(document.querySelector(`[data-people-pocket="${id}"]`)).toBeTruthy());
  click(`[data-people-pocket="${id}"]`);
  await vi.waitFor(() => expect(document.querySelector(`[data-people-detail="${id}"]`)).toBeTruthy());
}

/**
 * 走画脸谱入口（详情头「画脸谱」）验同步解锁后一路走到业务分支（ADR-0196 决策 10）：
 * 同步终态后入口可点，点完等那一下新冒出的通知（业务分支那条），供调用方断言。
 * 注意：同步运行中该入口是置灰的（点不动、不出通知），验拦截请直接断言 disabled + click 无事发生。
 */
async function tapGenerate(id: string): Promise<void> {
  const before = getNoticeMessages().length;
  await openDetail(id);
  click('[data-people-act="generate"]');
  await vi.waitFor(() => expect(getNoticeMessages().length).toBeGreaterThan(before));
}

let tool: FakeTool;
let dataRoot: string;
let lastSafe: PeopleSafeStore | null = null;

async function boot(seed?: PersonEntry[], cfg: Record<string, unknown> = {}, queue: JobView[] = []): Promise<void> {
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: dataRoot, ...cfg }) as never);
  const sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  lastSafe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(lastSafe);
  for (const p of seed ?? []) {
    await lastSafe.write(p.id, (rec) => {
      rec.person = p;
    });
  }
  setJobsModuleForTests(fakeEngine(queue));
  setSyncRunnerForTests(tool.runner);
}

/** 开面板 + 开数据源册页并等首轮扫描完成（临时数据根里有联系人） */
async function bootWithDsOpen(seed?: PersonEntry[], cfg: Record<string, unknown> = {}, queue: JobView[] = []): Promise<void> {
  // 505：册页是「册子里翻出来的一页」——册上得有人才画得出页（空册时数据源页不渲染），
  // 所以缺种子时默认放一位在册上（数据源扫描读的仍是临时数据根，不看这位）
  await boot(seed ?? [person()], cfg, queue);
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
  openDataSource();
  await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeTruthy());
  if (dataRoot) await vi.waitFor(() => expect(document.querySelector('.bz-people-ds-row')).toBeTruthy());
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  (window as unknown as { require?: unknown }).require = require; // datasource 读库外目录用
  tool = new FakeTool();
  engineStarted = [];
  dataRoot = mkdtempSync(join(tmpdir(), 'bz-people-sync-'));
  mkdirSync(join(dataRoot, '陈默'), { recursive: true });
  writeFileSync(join(dataRoot, '陈默', 'chat.json'), JSON.stringify([
    { ct: T0, type: 1, msg: '早' },
    { ct: T0 + 60, type: 1, msg: '吃了没' },
  ]));
});

afterEach(async () => {
  // 终态渲染是 fire-and-forget（ui 的 void renderAlbum）：关面板前先放它落地，收尾干净
  for (let i = 0; i < 3; i++) await tick(0);
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setSyncRunnerForTests(null);
  setPeopleSafeStoreForTests(null);
  lastSafe = null;
  try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* 临时目录尽力清 */ }
});

const person = (): PersonEntry => ({ id: 'wxid_a', name: '陈默', createdAt: new Date().toISOString(), imports: [] });

describe('空册也能翻出数据源页（issue 505 修复：弹窗不被 albumEmpty 顶掉）', () => {
  it('册上一位都没有时，「打开数据源」照常翻出那页；合上回到空册', async () => {
    await boot([], {}, []);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('.bz-people-empty')).toBeTruthy());
    click('[data-people-dialog="ds"]'); // 空册页上的「打开数据源」
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeTruthy());
    click('[data-people-close]'); // 「合上这页」——空册页（含它的入口）原样回来
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeNull());
    expect(document.querySelector('.bz-people-empty')).toBeTruthy();
  });
});

describe('点「同步」：运行中形态与互斥（ADR-0196 决策 6、10）', () => {
  it('点同步起跑：册页内出进度行、右上角只出「停止」不与同步并列、页脚导入置灰、画脸谱入口被同步锁死；参数按设置下发', async () => {
    await bootWithDsOpen([person()]);
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    // 起了 bz-face sync，--data-root 下发数据根
    expect(tool.calls.length).toBe(1);
    expect(tool.calls[0].cmd).toBe('bz-face');
    expect(tool.calls[0].args).toEqual(['sync', '--data-root', process.platform === 'win32' ? `"${dataRoot}"` : dataRoot]);
    // 右上角动作收敛：只有「停止」，没有「同步」
    expect(document.querySelector('[data-people-ds-sync-stop]')).toBeTruthy();
    expect(document.querySelector('[data-people-ds-sync-line]')!.querySelector('[data-people-ds-sync-stop]')).toBeNull();
    expect([...document.querySelectorAll('[data-people-ds-sync-stop]')].length).toBe(1);
    // 页脚「导入所选」置灰；册页页脚没有可与同步并列的第二动作
    const importBtn = document.querySelector<HTMLButtonElement>('[data-people-ds-import]');
    expect(importBtn?.disabled).toBe(true);
    // 进度行不占画像生成的进度块（面板便签槽里没有任务便签）
    const jobsSlot = document.querySelector<HTMLElement>('[data-people-jobs-slot]');
    expect(jobsSlot).toBeTruthy();
    expect(jobsSlot!.querySelector('.bz-people-jobs')).toBeNull();
    // 画脸谱入口被同步锁死（ADR-0196 决策 10：数据正在变，不画半截素材）：
    // 同步运行中详情页「画脸谱」动作签置灰，点它无事发生——不开开工单页、不起引擎、不冒通知
    await openDetail('wxid_a');
    const genBtn = document.querySelector<HTMLButtonElement>('[data-people-act="generate"]');
    expect(genBtn).toBeTruthy();
    expect(genBtn!.disabled).toBe(true);
    expect(genBtn!.getAttribute('data-people-sync-lock')).toBe('1');
    genBtn!.click();
    await tick();
    expect(document.querySelector('[data-people-sub="gen"]')).toBeNull();
    expect(engineStarted.length).toBe(0);
  });

  it('进度行逐段推进：阶段标签 + 百分比 + [bz-step] 副文案；原位更新不重建册页', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    tool.step('正在解密数据库');
    tool.progress('decrypt', 40);
    await tick();
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('解密数据库');
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('40%');
    expect(document.querySelector('[data-people-ds-sync-sub]')!.textContent).toBe('正在解密数据库');
    // 确定态间原位推进（484：不定态 → 确定态要重建进度条结构，是特例；此后不再重建）
    const line = document.querySelector('[data-people-ds-sync-line]')!;
    tool.progress('decrypt', 45);
    await tick();
    expect(document.querySelector('[data-people-ds-sync-line]')!.isSameNode(line)).toBe(true); // 原位推进
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('45%');
    // 不可估阶段不假报百分比（不定态脉冲条替代）
    tool.progress('key', null);
    await tick();
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).not.toContain('%');
    expect(document.querySelector('.bz-people-sync-indet')).toBeTruthy();
  });

  it('点停止：真的停下（handle.stop）、进度行给「已停止，可重跑续传」、动作全部恢复', async () => {
    await bootWithDsOpen([person()]);
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-stop]')).toBeTruthy());
    click('[data-people-ds-sync-stop]');
    expect(tool.stopCalls).toBe(1); // 杀进程
    await tool.settle({ ok: false, stopped: true, code: null });
    await tick();
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('已停止');
    expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('重跑');
    expect(document.querySelector('[data-people-ds-sync-stop]')).toBeNull(); // 停止态恢复「同步」钮
    expect(document.querySelector<HTMLButtonElement>('[data-people-ds-sync]')?.textContent).toContain('同步');
    // 画脸谱入口解锁（ADR-0196 决策 10）：同步终态后不再被同步守卫拦，一路走到业务分支
    await tapGenerate('wxid_a');
    expect(getNoticeMessages().join('\n')).not.toContain('正在同步微信数据');
    expect(getNoticeMessages().join('\n')).toContain('还没有可画的消息素材');
    expect(getNoticeMessages().join('\n')).toContain('同步已停止');
  });

  it('运行中册页可关可重开：同步照跑，重开即恢复进度行、勾选快照还在', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-check]'); // 先勾上陈默——合上这页 / 重开要保住这份快照
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    click('[data-people-close]'); // 「合上这页」= 关册页（505 起弹窗无遮罩，页眉右上就是关闭钮）
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeNull());
    openDataSource(); // 重开
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeTruthy());
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    expect(document.querySelector('[data-people-ds-sync-stop]')).toBeTruthy(); // 进度与停止钮都在
    expect(tool.calls.length).toBe(1); // 没有重跑
    expect(document.querySelector('[data-people-ds-check]')?.getAttribute('aria-checked')).toBe('true'); // 勾选快照还在
    expect(document.querySelector('[data-people-ds-count]')?.textContent).toContain('已选 1 位');
    stopSync();
    await tool.settle({ ok: false, stopped: true, code: null });
  });
});

describe('同步完成：刷新列表、标出更新数、不自动导入', () => {
  it('完成后重扫数据根：列表刷新并按聊天仓水位标「全新 · N 条」；保库记录 store 段不动（不自动导入）', async () => {
    const seeded = person();
    await bootWithDsOpen([seeded]);
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    await tool.runHappy({ contacts: 1, written: 1, unchanged: 0, failed: 0, skipped: 0, msgTotal: 2, named: 0, failures: [] });
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('同步完成'));
    // 列表刷新：联系人行在，且按新素材标出「全新 · 2 条」水位签与「未导入」尾注（数据根 2 条消息、聊天仓为空）
    await vi.waitFor(() => expect(document.querySelector('.bz-people-ds-row')).toBeTruthy());
    expect(document.querySelector('.bz-people-ds-water')?.textContent).toContain('全新 · 2 条');
    expect(document.querySelector('.bz-people-ds-mark')?.textContent).toContain('未导入');
    // 不自动导入：保库记录里聊天仓仍是空仓
    const rec = await lastSafe!.readAll().then((m) => m.get('wxid_a'));
    expect(rec?.store?.msgs?.length ?? 0).toBe(0);
    // 画脸谱入口恢复（ADR-0196 决策 10）：不再被同步守卫拦，一路走到业务分支；完成通知发出
    await tapGenerate('wxid_a');
    expect(getNoticeMessages().join('\n')).not.toContain('正在同步微信数据');
    expect(getNoticeMessages().join('\n')).toContain('还没有可画的消息素材');
    expect(getNoticeMessages().join('\n')).toContain('同步完成');
  });

  it('exit 0 但有失败：完成行列失败者名与原因，通知给「N 人失败」口径', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    await tool.runHappy({
      contacts: 1, written: 0, unchanged: 0, failed: 1, skipped: 0, msgTotal: 0, named: 0,
      failures: [{ name: '阿坏', error: '写盘失败：磁盘满' }],
    });
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('失败'));
    expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('阿坏：写盘失败：磁盘满');
    expect(getNoticeMessages().join('\n')).toContain('阿坏');
    expect(getNoticeMessages().join('\n')).toContain('只补失败项');
  });
});

describe('错误面：册页内中文原因与下一步动作，不抛栈', () => {
  it('微信未开：工具预检 [bz-result]{ok:false,error} 原文显示在进度行，随后恢复「同步」', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    tool.result({ ok: false, error: '未检测到微信进程（Weixin.exe）——请先打开并登录微信（登录后停在主界面），再重跑 bz-face sync' });
    await tool.settle({ ok: false, code: 1 });
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toBe('同步失败'));
    expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('请先打开并登录微信');
    expect(document.querySelector('[data-people-ds-sync-stop]')).toBeNull();
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).not.toContain('Error');
  });

  it('工具未装（ENOENT）：进度行给安装指引（npm link 口径）', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    await tool.settle({ ok: false, code: null, error: new Error('外部工具启动失败：spawn bz-face ENOENT') });
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('npm link'));
    expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('bz-face');
    expect(BZ_FACE_INSTALL_HINT).toContain('@jwbz/obsidian-face');
  });

  it('数据根未配置：点同步不开进程，进度行给「先在下方配置数据根目录」与设置页指引', async () => {
    await boot([person()], { peopleDataDir: '' });
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
    openDataSource();
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeTruthy());
    const callsBefore = tool.calls.length;
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')?.textContent).toContain('先在下方配置数据根目录'));
    expect(tool.calls.length).toBe(callsBefore); // 没起进程
    expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('设置');
  });
});

describe('暂停任务不锁数据源（issue 486）：只有真在跑的生成才拦', () => {
  it('引擎只剩 paused 任务：数据源册页照常打开，无「正在生成脸谱」拦截通知', async () => {
    await bootWithDsOpen([person()], {}, [fakeJob({ status: 'paused', talker: '梨花花' })]);
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeTruthy());
    expect(getNoticeMessages().join('\n')).not.toContain('正在生成脸谱');
    // paused 也不拦导入：守卫同口径
    click('[data-people-ds-import]');
    await tick();
    expect(getNoticeMessages().join('\n')).toContain('还没有勾选联系人'); // 走到了业务分支 = 未被忙守卫吞掉
  });

  it('引擎有 running 任务：仍然拦截并给中文通知', async () => {
    await boot([person()], {}, [fakeJob({ status: 'running', talker: '梨花花', batchesDone: 2 })]);
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
    openDataSource();
    await tick();
    expect(document.querySelector('[data-people-sub="ds"]')).toBeNull();
    expect(getNoticeMessages().join('\n')).toContain('正在生成脸谱');
  });
});

describe('导入后同会话画谱（issue 492 徐雯静实案回归）', () => {
  it('导入所选后重开数据源页点「画脸谱」：引擎拿到非空 msgs，同会话不再读导入前的空仓', async () => {
    await bootWithDsOpen([person()]);
    click('[data-people-ds-check]'); // 勾上陈默（jsdom 合成 click 触发勾选激活）
    click('[data-people-ds-import]');
    // issue 507：导入完成即合上数据源这一页（新照片飞回册页），不再赖在页上
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeNull());
    openDataSource(); // 再打开
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-generate]')).toBeTruthy());
    click('[data-people-ds-generate]');
    await confirmGen(); // 497：总确认放行后才起引擎
    await vi.waitFor(() => expect(engineStarted.length).toBe(1));
    const targets = engineStarted[0][1];
    expect(targets[0]?.talker).toBe('陈默');
    expect(targets[0]?.msgs.length).toBeGreaterThan(0); // 492 前：此处读到导入前空仓，引擎空手而归
  });
});

describe('导入完的收尾：这一页自己合上、勾选摘掉、无新素材沉底（issue 507）', () => {
  /** 数据根里再加一位（列目录用；不导入） */
  function seedDir(name: string): void {
    mkdirSync(join(dataRoot, name), { recursive: true });
    writeFileSync(join(dataRoot, name, 'chat.json'), JSON.stringify([{ ct: T0, type: 1, msg: '在吗' }]));
  }
  const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.bz-people-ds-row')];
  const rowOf = (name: string): HTMLElement => rows().find((r) => r.textContent?.includes(name))!;
  const tickRow = (name: string): void => {
    rowOf(name).querySelector<HTMLElement>('[data-people-ds-check]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  it('导入所选后这一页自己合上；再打开时刚导入的那位已勾选摘掉、不可再勾，且沉到列表下面', async () => {
    seedDir('林晚'); // 数据根里两位：陈默（要导入）+ 林晚（全新，不动）
    await bootWithDsOpen([person()]);
    expect(rows().length).toBe(2);
    tickRow('陈默'); // 勾上陈默
    expect(rowOf('陈默').classList.contains('bz-people-ds-on')).toBe(true);
    click('[data-people-ds-import]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeNull());
    // 合上这一页那一下：刚导进来的几位挂上「飞回册页」的类（issue 507：505 之后这枚动效没人挂）
    expect(document.querySelector('[data-people-pocket="陈默"]')!.classList.contains('bz-people-drop')).toBe(true);
    openDataSource();
    await vi.waitFor(() => expect(rows().length).toBe(2));
    // 水位落到「无新素材」：沉到最后、且行不可勾
    expect(rows()[rows().length - 1].textContent).toContain('陈默');
    const chen = rowOf('陈默');
    expect(chen.classList.contains('bz-people-ds-skip')).toBe(true);
    expect(chen.classList.contains('bz-people-ds-on')).toBe(false); // 取消选中状态
    tickRow('陈默'); // 点它一下也不该勾上（jsdom 合成 click 走委托分支）
    expect(rowOf('陈默').classList.contains('bz-people-ds-on')).toBe(false);
    // 另一位（全新）照旧可勾——不可勾的只有「已导入且无新素材」
    tickRow('林晚');
    expect(rowOf('林晚').classList.contains('bz-people-ds-on')).toBe(true);
  });
});

describe('同步进度显示（issue 484）：阶段主文案 / 已耗时 / 当前联系人副行', () => {
  it('主文案跟阶段切换、contacts 段带 N/M、已耗时上屏；联系人副行滚动显示最近一位（跳过不上屏）', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    // 取密钥（pct=null）：主行给阶段词 + 已耗时，不定态条出 pulse 轨
    tool.step('取密钥：从微信进程内存提取');
    tool.progress('key', null);
    await tick();
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('取密钥');
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('已 ');
    expect(document.querySelector('.bz-people-sync-indet')).toBeTruthy();
    expect(document.querySelector('.bz-people-sync-bar')).toBeNull();
    // 解密 → contacts：阶段词切换 + N/M 位置；联系人事件滚动上屏，跳过的不顶掉
    tool.progress('decrypt', null);
    await tick();
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('解密数据库');
    tool.progress('contacts', 0);
    tool.info({ phase: 'contacts', total: 57 });
    tool.info({ phase: 'contact', name: '大琳', status: 'skipped', reason: '没有消息记录' });
    await tick();
    // skipped 也算处理过一位（工具逐人事件语义），主行位置计数 1/57
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('统计联系人 1/57');
    expect((document.querySelector('[data-people-ds-sync-contact]') as HTMLElement).hidden).toBe(true);
    tool.info({ phase: 'contact', name: '大琳', status: 'ok', msgs: 20773, chat: 'new', imgs: 3 });
    await tick();
    expect(document.querySelector('[data-people-ds-sync-contact]')!.textContent).toBe('大琳 · 20,773 条');
    tool.info({ phase: 'contact', name: '阿坏', status: 'failed', error: '写盘失败' });
    await tick();
    expect(document.querySelector('[data-people-ds-sync-contact]')!.textContent).toBe('阿坏 · 失败');
    // pct 来了 → 不定态让位确定态条（结构重建，走整渲染）
    tool.progress('contacts', 5);
    await tick();
    expect(document.querySelector('.bz-people-sync-bar')).toBeTruthy();
    expect(document.querySelector('.bz-people-sync-indet')).toBeNull();
    stopSync();
    await tool.settle({ ok: false, stopped: true, code: null });
  });

  it('终态停表：进度行不再带「已」耗时，联系人副行收起', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    await tool.runHappy({ contacts: 1, written: 1, unchanged: 0, failed: 0, skipped: 0, msgTotal: 2, named: 0, failures: [] });
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('同步完成'));
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).not.toContain('已 ');
    expect((document.querySelector('[data-people-ds-sync-contact]') as HTMLElement).hidden).toBe(true); // 终态联系人行收起（节点常驻、空则隐藏）
  });
});

describe('导入所选按需导出（issue 485）', () => {
  /** 数据根换成「只有 stats.json」的联系人目录（485 后 sync 轮产物形态） */
  function seedStatsOnly(name: string, stats: Record<string, unknown>): void {
    mkdirSync(join(dataRoot, name), { recursive: true });
    writeFileSync(join(dataRoot, name, 'stats.json'), JSON.stringify({
      msgs: 2, voices: 0, images: 0, voiceSec: 0, lastCt: T0 + 60, maxSid: 0, group: false, ...stats,
    }));
  }

  it('缺 chat.json 的勾选者先起 bz-face export --contact，完成后走既有归一合并落保库记录', async () => {
    rmSync(join(dataRoot, '陈默', 'chat.json'));
    seedStatsOnly('陈默', {});
    const exportTool = new FakeTool();
    setExportRunnerForTests(exportTool.runner);
    await bootWithDsOpen([person()]);
    click('[data-people-ds-check]');
    click('[data-people-ds-import]');
    // 先对勾选者起 export（不是 sync！），--contact 下发目录名
    await vi.waitFor(() => expect(exportTool.calls.length).toBe(1));
    expect(exportTool.calls[0].cmd).toBe('bz-face');
    expect(exportTool.calls[0].args?.[0]).toBe('export');
    expect(exportTool.calls[0].args).toContain('--contact');
    expect(tool.calls.length).toBe(0); // sync 驱动不被误用
    // export 假件按工具语义落 chat.json（模拟工具产物），逐人事件 + 结果行
    writeFileSync(join(dataRoot, '陈默', 'chat.json'), JSON.stringify([
      { ct: T0, type: 1, msg: '早' },
      { ct: T0 + 60, type: 1, who: '我', msg: '吃了没' },
    ]));
    exportTool.info({ phase: 'contact', name: '陈默', status: 'ok', msgs: 2, chat: 'new' });
    exportTool.result({ ok: true, mode: 'export', contacts: 1, written: 1, unchanged: 0, failed: 0, skipped: 0, msgTotal: 2, named: 0, failures: [] });
    await exportTool.settle({ ok: true, code: 0 });
    // issue 507：导入完成即合上数据源页 → 再打开看落账文案
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeNull());
    openDataSource();
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-notice]')?.textContent).toContain('已导入'));
    const rec = await lastSafe!.readAll().then((m) => m.get('陈默'));
    expect(rec?.store?.msgs?.length).toBe(2); // 归一合并落保库记录
  });

  it('存量 chat.json 直接导入：不起 export（免重复导出），也不起 sync', async () => {
    const exportTool = new FakeTool();
    setExportRunnerForTests(exportTool.runner);
    await bootWithDsOpen([person()]);
    click('[data-people-ds-check]');
    click('[data-people-ds-import]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-sub="ds"]')).toBeNull()); // 507：导完自己合上
    openDataSource();
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-notice]')?.textContent).toContain('已导入'));
    expect(exportTool.calls.length).toBe(0);
    expect(tool.calls.length).toBe(0);
    const rec = await lastSafe!.readAll().then((m) => m.get('陈默')); // 保库记录键 = 数据根目录名
    expect(rec?.store?.msgs?.length).toBe(2);
  });

  it('export 轮硬失败（无缓存密钥）：导入中止，进度行给中文原因，保库记录不动', async () => {
    rmSync(join(dataRoot, '陈默', 'chat.json'));
    seedStatsOnly('陈默', {});
    const exportTool = new FakeTool();
    setExportRunnerForTests(exportTool.runner);
    await bootWithDsOpen([person()]);
    click('[data-people-ds-check]');
    click('[data-people-ds-import]');
    await vi.waitFor(() => expect(exportTool.calls.length).toBe(1));
    exportTool.result({ ok: false, error: '还没有缓存的解密密钥（数据根 .bz-face/key.json）——先跑一次 bz-face sync，再按需导出' });
    await exportTool.settle({ ok: false, code: 1 });
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-notice]')?.textContent).toContain('导出失败'));
    expect(document.querySelector('[data-people-ds-notice]')!.textContent).toContain('key.json');
    const rec = await lastSafe!.readAll().then((m) => m.get('陈默'));
    expect(rec?.store?.msgs?.length ?? 0).toBe(0);
  });
});

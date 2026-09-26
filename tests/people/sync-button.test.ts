// @vitest-environment jsdom
/**
 * 数据源弹窗「同步」按钮接线测试（issue 465 / ADR-0196 决策 6、10）：
 * 点同步 = 插件调 bz-face sync 跑完整条链，弹窗内一条进度行推进；运行中该位置只出「停止」；
 * 完成（终态）重扫数据根刷新列表并标出更新数、**不自动导入**；错误面（微信未开 / 工具未装 /
 * 数据根未配置）在弹窗内给中文人话；同步进行中「画脸谱」入口（印章 / 详情头 / 页脚）置灰。
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
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import type { PersonEntry } from '../../src/people/types';

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

/** 假引擎：空队列（同步守卫 jobsBusy 走这条）；只记录调用 */
function fakeEngine(): JobsApi {
  return {
    startJobs: async () => ({ queued: [], skipped: [], resumed: [] }),
    resumeJobs: async () => {},
    resume: () => false,
    pauseJobs: () => {},
    removeJob: () => false,
    subscribe: () => () => {},
    snapshot: () => ({ queue: [], currentIndex: -1, running: false }),
  };
}

function click(sel: string): void {
  document.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

let tool: FakeTool;
let dataRoot: string;
let lastSafe: PeopleSafeStore | null = null;

async function boot(seed?: PersonEntry[], cfg: Record<string, unknown> = {}): Promise<void> {
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
  setJobsModuleForTests(fakeEngine());
  setSyncRunnerForTests(tool.runner);
}

/** 开面板 + 开数据源弹窗并等首轮扫描完成（临时数据根里有联系人） */
async function bootWithDsOpen(seed?: PersonEntry[], cfg: Record<string, unknown> = {}): Promise<void> {
  await boot(seed, cfg);
  openPeoplePanel(getApp());
  await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
  openDataSource();
  await vi.waitFor(() => expect(document.querySelector('[data-people-ds-pop]')).toBeTruthy());
  if (dataRoot) await vi.waitFor(() => expect(document.querySelector('.bz-people-ds-row')).toBeTruthy());
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  (window as unknown as { require?: unknown }).require = require; // datasource 读库外目录用
  tool = new FakeTool();
  dataRoot = mkdtempSync(join(tmpdir(), 'bz-people-sync-'));
  mkdirSync(join(dataRoot, '陈默'), { recursive: true });
  writeFileSync(join(dataRoot, '陈默', 'chat.json'), JSON.stringify([
    { ct: T0, type: 1, msg: '早' },
    { ct: T0 + 60, type: 1, msg: '吃了没' },
  ]));
});

afterEach(async () => {
  try { closePeoplePanel(); } catch { /* 幂等 */ }
  setJobsModuleForTests(null);
  setSyncRunnerForTests(null);
  setPeopleSafeStoreForTests(null);
  lastSafe = null;
  try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* 临时目录尽力清 */ }
});

const person = (): PersonEntry => ({ id: 'wxid_a', name: '陈默', createdAt: new Date().toISOString(), imports: [] });

describe('点「同步」：运行中形态与互斥（ADR-0196 决策 6、10）', () => {
  it('点同步起跑：弹窗内出进度行、右上角只出「停止」不与同步并列、页脚导入置灰、印章置灰；参数按设置下发', async () => {
    await bootWithDsOpen([person()]);
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    // 起了 bz-face sync，--data-root 下发数据根
    expect(tool.calls.length).toBe(1);
    expect(tool.calls[0].cmd).toBe('bz-face');
    expect(tool.calls[0].args).toEqual(['sync', '--data-root', dataRoot]);
    // 右上角动作收敛：只有「停止」，没有「同步」
    expect(document.querySelector('[data-people-ds-sync-stop]')).toBeTruthy();
    expect(document.querySelector('[data-people-ds-sync-line]')!.querySelector('[data-people-ds-sync-stop]')).toBeNull();
    expect([...document.querySelectorAll('[data-people-ds-sync-stop]')].length).toBe(1);
    // 页脚「导入所选」置灰；弹窗页脚没有可与同步并列的第二动作
    const importBtn = document.querySelector<HTMLButtonElement>('[data-people-ds-import]');
    expect(importBtn?.disabled).toBe(true);
    // 画脸谱入口置灰：封面墙印章 + 详情头按钮（ADR-0196 决策 10）
    const seal = document.querySelector<HTMLButtonElement>('[data-people-seal-act="draw"]');
    expect(seal).toBeTruthy();
    expect(seal?.disabled).toBe(true);
    // 进度行不占画像生成的进度块（面板 jobs 槽保持隐藏）
    const jobsSlot = document.querySelector<HTMLElement>('[data-people-jobs-slot]');
    expect(jobsSlot?.hidden ?? true).toBe(true);
  });

  it('进度行逐段推进：阶段标签 + 百分比 + [bz-step] 副文案；原位更新不重建弹窗', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    const line = document.querySelector('[data-people-ds-sync-line]')!;
    tool.step('正在解密数据库');
    tool.progress('decrypt', 40);
    await tick();
    expect(document.querySelector('[data-people-ds-sync-line]')!.isSameNode(line)).toBe(true); // 原位推进
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('解密数据库');
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('40%');
    expect(document.querySelector('[data-people-ds-sync-sub]')!.textContent).toBe('正在解密数据库');
    // 不可估阶段不假报百分比
    tool.progress('key', null);
    await tick();
    expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).not.toContain('%');
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
    const seal = document.querySelector<HTMLButtonElement>('[data-people-seal-act="draw"]');
    expect(seal?.disabled).toBe(false); // 印章解锁
    expect(getNoticeMessages().join('\n')).toContain('同步已停止');
  });

  it('运行中弹窗可关可重开：同步照跑，重开即恢复进度行', async () => {
    await bootWithDsOpen();
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    click('[data-people-ds-dim]'); // 遮罩点击 = 关闭弹窗（弹窗无独立关闭钮，与现网一致）
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-pop]')).toBeNull());
    openDataSource(); // 重开
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-pop]')).toBeTruthy());
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    expect(document.querySelector('[data-people-ds-sync-stop]')).toBeTruthy(); // 进度与停止钮都在
    expect(tool.calls.length).toBe(1); // 没有重跑
    stopSync();
    await tool.settle({ ok: false, stopped: true, code: null });
  });
});

describe('同步完成：刷新列表、标出更新数、不自动导入', () => {
  it('完成后重扫数据根：列表刷新并按聊天仓水位标「新 N 条」；保库记录 store 段不动（不自动导入）', async () => {
    const seeded = person();
    await bootWithDsOpen([seeded]);
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')).toBeTruthy());
    await tool.runHappy({ contacts: 1, written: 1, unchanged: 0, failed: 0, skipped: 0, msgTotal: 2, named: 0, failures: [] });
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('同步完成'));
    // 列表刷新：联系人行在，且按新素材标出「新 2 条」（数据根 2 条消息、聊天仓为空）
    await vi.waitFor(() => expect(document.querySelector('.bz-people-ds-row')).toBeTruthy());
    expect(document.querySelector('.bz-people-ds-new')?.textContent).toContain('新 2 条');
    // 不自动导入：保库记录里聊天仓仍是空仓
    const rec = await lastSafe!.readAll().then((m) => m.get('wxid_a'));
    expect(rec?.store?.msgs?.length ?? 0).toBe(0);
    // 画脸谱入口恢复（印章可点）；完成通知发出
    expect(document.querySelector<HTMLButtonElement>('[data-people-seal-act="draw"]')?.disabled).toBe(false);
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

describe('错误面：弹窗内中文原因与下一步动作，不抛栈', () => {
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
    await boot([], { peopleDataDir: '' });
    openPeoplePanel(getApp());
    await vi.waitFor(() => expect(isPeopleOpen()).toBe(true));
    openDataSource();
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-pop]')).toBeTruthy());
    const callsBefore = tool.calls.length;
    click('[data-people-ds-sync]');
    await vi.waitFor(() => expect(document.querySelector('[data-people-ds-sync-line]')?.textContent).toContain('先在下方配置数据根目录'));
    expect(tool.calls.length).toBe(callsBefore); // 没起进程
    expect(document.querySelector('[data-people-ds-sync-line]')!.textContent).toContain('设置');
  });
});

// @vitest-environment jsdom
/**
 * 脸谱数据源同步驱动层测试（issue 465 / ADR-0196 决策 1、5、6、10）。
 *
 * 被测对象 src/people/sync.ts（bz-face sync 驱动 + 模块级状态机）：
 * runExternalTool 经 setSyncRunnerForTests 注入假件，喂预录协议行与预录终结——
 * **不 spawn 真进程、不探测真实环境、不碰真实微信与数据根**。
 * 纯函数（buildSyncSpec / syncPhaseLabel / collectContactInfo / statsFromResult /
 * describeSyncStats / classifySyncFailure）与状态机分流（成功 / 停止 / 工具预检失败 /
 * 工具未装 / 依赖缺失 / exit 0 但 failed>0）分开断言。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import type { ExternalToolCallbacks, ExternalToolOutcome, ExternalToolSpec } from '../../src/core/external-tool';
import {
  BZ_FACE_INSTALL_HINT,
  buildSyncSpec,
  classifySyncFailure,
  collectContactInfo,
  describeSyncStats,
  emptySyncStats,
  isSyncing,
  setSyncRunnerForTests,
  startSync,
  statsFromResult,
  stopSync,
  subscribeSync,
  syncPhaseLabel,
  syncState,
  type SyncRunner,
} from '../../src/people/sync';

/** 假进程壳：记录 spec、转发协议行、手动终结（形状对齐 runExternalTool 返回的 handle） */
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
    this.resolve?.({
      ok: false, stopped: false, code: 1, stderr: '', error: null,
      ...o,
    } as ExternalToolOutcome);
    // done.then 的终态分流在微任务里——宏任务兜底等它落地
    return new Promise((r) => setTimeout(r, 0));
  }
}

/** 微任务 flush（done.then 回调落地后再断言） */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** 注入设置（sync 只读 peopleDataDir / peopleWxAccountDir / pythonPath 三键） */
const setCfg = (over: Record<string, unknown> = {}): void =>
  setSettingsProvider(() => ({ peopleDataDir: 'D:\\微信脸谱数据\\export_full', ...over }) as never);

let tool: FakeTool;

beforeEach(() => {
  resetObsidianMocks();
  tool = new FakeTool();
  setSyncRunnerForTests(tool.runner);
  setCfg();
});

afterEach(() => {
  setSyncRunnerForTests(null);
});

describe('纯函数：参数组装与协议映射', () => {
  it('buildSyncSpec：cmd=bz-face + sync + --data-root；shell:true（.cmd shim 先例）', () => {
    const spec = buildSyncSpec({ dataRoot: 'E:\\数据根' });
    expect(spec.cmd).toBe('bz-face');
    // shell:true 会把含空格路径按空格拆散（bili-dl b64 同源坑）——Windows 下路径参数包引号无损（Win32 路径不含双引号）
    expect(spec.args).toEqual(['sync', '--data-root', process.platform === 'win32' ? '"E:\\数据根"' : 'E:\\数据根']);
    expect(buildSyncSpec({ dataRoot: 'E:\\My Data\\根' }).args?.[2] ?? '').toMatch(process.platform === 'win32' ? /"/ : /^(?!").*$/);
    expect(spec.shell).toBe(true);
  });

  it('buildSyncSpec：--src / --python 非空才下发（域无关键留空跟随工具默认；路径带引号、命令词不带）', () => {
    const full = buildSyncSpec({ dataRoot: 'D:\\根', src: 'wxid_x', python: 'py -3' });
    expect(full.args).toEqual([
      'sync',
      '--data-root',
      process.platform === 'win32' ? '"D:\\根"' : 'D:\\根',
      '--src',
      process.platform === 'win32' ? '"wxid_x"' : 'wxid_x',
      '--python',
      'py -3',
    ]);
    expect(buildSyncSpec({ dataRoot: 'D:\\根', src: '  ', python: '' }).args).toEqual([
      'sync',
      '--data-root',
      process.platform === 'win32' ? '"D:\\根"' : 'D:\\根',
    ]);
  });

  it('syncPhaseLabel：phase 词 → 中文阶段（与工具 SYNC_PHASES 同词汇）；未知 / null 给空', () => {
    expect(syncPhaseLabel('key')).toBe('取密钥');
    expect(syncPhaseLabel('decrypt')).toBe('解密数据库');
    expect(syncPhaseLabel('contacts')).toBe('导出聊天');
    expect(syncPhaseLabel('avatar')).toBe('头像源');
    expect(syncPhaseLabel('wat')).toBe('');
    expect(syncPhaseLabel(null)).toBe('');
  });

  it('collectContactInfo：逐人事件实时累计（ok→written/unchanged、skipped、failed 入名单）', () => {
    const st = emptySyncStats();
    expect(collectContactInfo(st, { phase: 'contact', name: '陈默', status: 'ok', chat: 'new', msgs: 3, named: 1 })).toBe(true);
    expect(collectContactInfo(st, { phase: 'contact', name: '林晚', status: 'ok', chat: 'updated', msgs: 5, named: 0 })).toBe(true);
    expect(collectContactInfo(st, { phase: 'contact', name: '老周', status: 'ok', chat: 'unchanged', msgs: 9, named: 0 })).toBe(true);
    expect(collectContactInfo(st, { phase: 'contact', name: '群甲', status: 'skipped', reason: '没有消息记录' })).toBe(true);
    expect(collectContactInfo(st, { phase: 'contact', name: '阿坏', status: 'failed', error: '库坏了' })).toBe(true);
    expect(st).toMatchObject({ contacts: 3, written: 2, unchanged: 1, skipped: 1, failed: 1, msgTotal: 17, named: 1 });
    expect(st.failures).toEqual([{ name: '阿坏', error: '库坏了' }]);
    // 非 contact 事件 / 缺名不认
    expect(collectContactInfo(st, { phase: 'key', wxid: 'x' })).toBe(false);
    expect(collectContactInfo(st, { phase: 'contact', status: 'ok' })).toBe(false);
  });

  it('statsFromResult：[bz-result] 为权威，缺失字段回落实时累计；failures 映射清洗', () => {
    const live = emptySyncStats();
    collectContactInfo(live, { phase: 'contact', name: '甲', status: 'ok', chat: 'new', msgs: 2, named: 0 });
    const st = statsFromResult(
      { ok: true, contacts: 7, written: 4, unchanged: 3, failed: 1, skipped: 2, msgTotal: 99, named: 5, failures: [{ name: '乙', error: '写盘失败' }, { name: 3 }, null] },
      live,
    );
    expect(st).toMatchObject({ contacts: 7, written: 4, unchanged: 3, skipped: 2, failed: 1, msgTotal: 99, named: 5 });
    expect(st.failures).toEqual([{ name: '乙', error: '写盘失败' }]);
    // result 不带 failures → 回落实时名单
    expect(statsFromResult({ ok: true }, live).failures).toEqual([]);
    expect(statsFromResult({ ok: true, written: 2 }, { ...emptySyncStats(), failed: 3 }).failed).toBe(3);
  });

  it('describeSyncStats：更新数入摘要；有失败单独点名', () => {
    expect(describeSyncStats({ ...emptySyncStats(), contacts: 5, written: 2, unchanged: 3, msgTotal: 100 }))
      .toBe('同步完成：更新 2 位 · 未变 3 位 · 跳过 0 位，消息 100 条');
    const failed = { ...emptySyncStats(), contacts: 2, written: 1, failed: 1 };
    expect(describeSyncStats(failed)).toContain('1 位失败');
  });

  it('classifySyncFailure：ENOENT → 安装指引；依赖缺失 → doctor；微信文案透传不带多余 hint', () => {
    expect(classifySyncFailure({ ok: false, stopped: false, code: null, stderr: '', error: new Error('外部工具启动失败：spawn bz-face ENOENT') }).hint)
      .toBe(BZ_FACE_INSTALL_HINT);
    const dep = classifySyncFailure({ ok: false, stopped: false, code: 1, stderr: 'ModuleNotFoundError: No module named Crypto.Cipher', error: new Error('外部工具异常退出（退出码 1）') });
    expect(dep.message).toBe('Python 缺少同步依赖');
    expect(dep.hint).toContain('bz-face doctor');
    const wechat = classifySyncFailure({ ok: false, stopped: false, code: 1, stderr: '未检测到微信进程', error: new Error('外部工具异常退出：未检测到微信进程') });
    expect(wechat.message).toContain('微信');
    expect(wechat.hint).toBe('');
    const plain = classifySyncFailure({ ok: false, stopped: false, code: 1, stderr: '', error: new Error('外部工具异常退出（退出码 1）') });
    expect(plain.hint).toContain('doctor');
  });
});

describe('状态机：startSync / stopSync 终态分流', () => {
  it('数据根未配置：不开进程，错误面给「先在下方配置数据根目录」与设置页指引', () => {
    setCfg({ peopleDataDir: '  ' });
    startSync();
    expect(tool.calls.length).toBe(0);
    const s = syncState();
    expect(s.outcome).toBe('error');
    expect(s.message).toContain('先在下方配置数据根目录');
    expect(s.hint).toContain('设置');
    expect(isSyncing()).toBe(false);
  });

  it('成功链：running 推进（step / pct / 逐人累计）→ [bz-result] 权威落 ok + 摘要；参数按设置下发', async () => {
    setCfg({ peopleWxAccountDir: 'wxidacct', pythonPath: 'C:\\py\\python.exe' });
    const seen: string[] = [];
    subscribeSync((s) => seen.push(s.outcome));
    startSync();
    expect(isSyncing()).toBe(true);
    expect(tool.calls.length).toBe(1);
    expect(tool.calls[0].args).toEqual([
      'sync',
      '--data-root',
      process.platform === 'win32' ? '"D:\\微信脸谱数据\\export_full"' : 'D:\\微信脸谱数据\\export_full',
      '--src',
      process.platform === 'win32' ? '"wxidacct"' : 'wxidacct',
      '--python',
      'C:\\py\\python.exe',
    ]);
    tool.step('正在解密数据库');
    tool.progress('decrypt', 40);
    expect(syncState().step).toBe('正在解密数据库');
    expect(syncState().pct).toBe(40);
    expect(syncState().phase).toBe('decrypt');
    tool.info({ phase: 'contact', name: '陈默', status: 'ok', chat: 'unchanged', msgs: 9, named: 0 });
    tool.result({ ok: true, contacts: 1, written: 0, unchanged: 1, failed: 0, skipped: 0, msgTotal: 9, named: 0, failures: [] });
    await tool.settle({ ok: true, code: 0 });
    const s = syncState();
    expect(s.outcome).toBe('ok');
    expect(isSyncing()).toBe(false);
    expect(s.stats).toMatchObject({ contacts: 1, written: 0, unchanged: 1, failed: 0 });
    expect(s.message).toBe(describeSyncStats(s.stats));
    expect(seen[0]).toBe('running');
    expect(seen[seen.length - 1]).toBe('ok');
    expect(getNoticeMessages().join('\n')).toContain('同步完成');
  });

  it('运行中重复点同步被忽略（幂等）；pct null 保留 null（绝不假报）', () => {
    startSync();
    tool.progress('contacts', null);
    startSync();
    startSync();
    expect(tool.calls.length).toBe(1);
    expect(syncState().pct).toBeNull();
    expect(syncState().phase).toBe('contacts');
  });

  it('点停止：handle.stop 被调、终态 stopped 给「可重跑续传」文案与 info 通知', async () => {
    startSync();
    stopSync();
    expect(tool.stopCalls).toBe(1);
    await flush();
    const s = syncState();
    expect(s.outcome).toBe('stopped');
    expect(s.hint).toContain('重跑');
    expect(getNoticeMessages().join('\n')).toContain('同步已停止');
    // 停止后再点 = 全新一次跑
    startSync();
    expect(tool.calls.length).toBe(2);
  });

  it('工具预检硬失败（微信未开）：[bz-result]{ok:false,error} 原文透传，不包装不抛栈', async () => {
    startSync();
    const reason = '未检测到微信进程（Weixin.exe）——请先打开并登录微信（登录后停在主界面），再重跑 bz-face sync';
    tool.result({ ok: false, error: reason });
    await tool.settle({ ok: false, code: 1 });
    const s = syncState();
    expect(s.outcome).toBe('error');
    expect(s.message).toBe(reason);
    expect(s.hint).toBe('');
    expect(getNoticeMessages().join('\n')).toContain('请先打开并登录微信');
  });

  it('工具未装（spawn ENOENT、无结果行）：错误面给安装指引', async () => {
    startSync();
    await tool.settle({ ok: false, code: null, error: new Error('外部工具启动失败：spawn bz-face ENOENT') });
    const s = syncState();
    expect(s.outcome).toBe('error');
    expect(s.hint).toBe(BZ_FACE_INSTALL_HINT);
    expect(s.hint).toContain('npm link');
  });

  it('Python 依赖缺失（stderr ModuleNotFoundError、无结果行）：给 doctor 引导', async () => {
    startSync();
    await tool.settle({ ok: false, code: 1, stderr: 'Traceback …\nModuleNotFoundError: No module named Crypto.Cipher' });
    const s = syncState();
    expect(s.outcome).toBe('error');
    expect(s.message).toBe('Python 缺少同步依赖');
    expect(s.hint).toContain('bz-face doctor');
  });

  it('exit 0 但 failed>0：属正常完成——ok 态 + warning 通知点名失败者', async () => {
    startSync();
    tool.result({ ok: true, contacts: 2, written: 1, unchanged: 0, failed: 1, skipped: 0, msgTotal: 5, named: 0, failures: [{ name: '阿坏', error: '写盘失败' }] });
    await tool.settle({ ok: true, code: 0 });
    const s = syncState();
    expect(s.outcome).toBe('ok');
    expect(s.stats.failed).toBe(1);
    expect(s.stats.failures).toEqual([{ name: '阿坏', error: '写盘失败' }]);
    expect(s.message).toContain('1 位失败');
    const notices = getNoticeMessages().join('\n');
    expect(notices).toContain('阿坏');
    expect(notices).toContain('只补失败项');
  });
});

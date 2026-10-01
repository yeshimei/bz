// @vitest-environment node
// @vitest-environment jsdom
/**
 * 脸谱按需导出驱动层测试（issue 485）。
 *
 * 被测对象 src/people/export.ts（bz-face export 驱动）：runExternalTool 经
 * setExportRunnerForTests 注入假件，喂预录协议行与预录终结——**不 spawn 真进程、
 * 不探测真实环境、不碰真实微信与数据根**。
 * 覆盖：buildExportSpec 参数组装（--contact 可重复 / 引号口径）、exportContactEvent
 * 纯函数、finishExport 终结分流（[bz-result] 权威 / 工具预检失败透传 / ENOENT 指引 /
 * stopped）、startContactsExport 全链（逐人事件 idx/total 推进 + 空名单兜底终态）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { quotePythonArg } from '../../src/people/sync';
import type { ExternalToolCallbacks, ExternalToolOutcome, ExternalToolSpec } from '../../src/core/external-tool';
import {
  buildExportSpec,
  exportContactEvent,
  finishExport,
  setExportRunnerForTests,
  startContactsExport,
  type ExportRunner,
} from '../../src/people/export';

/** 假进程壳（同 tests/people/sync.test.ts 口径） */
class FakeTool {
  calls: ExternalToolSpec[] = [];
  stopCalls = 0;
  private cb: ExternalToolCallbacks | null = null;
  private resolve: ((o: ExternalToolOutcome) => void) | null = null;

  runner: ExportRunner = (spec, cb) => {
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
  info(data: Record<string, unknown>): void { this.cb!.onInfo(data); }
  result(data: Record<string, unknown>): void { this.cb!.onResult(data); }
  settle(o: Partial<ExternalToolOutcome>): Promise<void> {
    this.resolve?.({ ok: false, stopped: false, code: 1, stderr: '', error: null, ...o } as ExternalToolOutcome);
    return new Promise((r) => setTimeout(r, 0));
  }
}

let tool: FakeTool;

beforeEach(() => {
  resetObsidianMocks();
  tool = new FakeTool();
  setExportRunnerForTests(tool.runner);
  setSettingsProvider(() => ({ pythonPath: 'C:\\py\\python.exe' }) as never);
});

afterEach(() => {
  setExportRunnerForTests(null);
});

describe('buildExportSpec 参数组装', () => {
  it('cmd=bz-face + export + --data-root + 逐位 --contact；--python 非空才下发；shell:true', () => {
    const spec = buildExportSpec({ dataRoot: 'E:\\数据根', contacts: ['大琳', '老周'], python: 'C:\\py\\python.exe' });
    expect(spec.cmd).toBe('bz-face');
    expect(spec.args).toEqual([
      'export',
      '--data-root',
      process.platform === 'win32' ? '"E:\\数据根"' : "'E:\\数据根'",
      '--contact',
      process.platform === 'win32' ? '"大琳"' : "'大琳'",
      '--contact',
      process.platform === 'win32' ? '"老周"' : "'老周'",
      '--python',
      // .exe 路径形态 → quotePythonArg 包引号（防空格路径被 shell 拆碎）
      process.platform === 'win32' ? '"C:\\py\\python.exe"' : quotePythonArg('C:\\py\\python.exe'),
    ]);
    expect(spec.shell).toBe(true);
  });

  it('python 留空跟随工具默认；引号口径与 buildSyncSpec 同源（quotePathArg）', () => {
    const spec = buildExportSpec({ dataRoot: 'D:\\根', contacts: ['陈默'] });
    expect(spec.args).toEqual([
      'export',
      '--data-root',
      process.platform === 'win32' ? '"D:\\根"' : "'D:\\根'",
      '--contact',
      process.platform === 'win32' ? '"陈默"' : "'陈默'",
    ]);
  });
});

describe('exportContactEvent 纯函数', () => {
  it('contact 事件 → 上屏形状；ok 带 msgs；skipped / failed 无条数', () => {
    expect(exportContactEvent({ phase: 'contact', name: '大琳', status: 'ok', msgs: 20773, chat: 'new' }))
      .toEqual({ name: '大琳', status: 'ok', msgs: 20773 });
    expect(exportContactEvent({ phase: 'contact', name: '老周', status: 'skipped', reason: '没有消息记录' }))
      .toEqual({ name: '老周', status: 'skipped' });
    expect(exportContactEvent({ phase: 'contact', name: '阿坏', status: 'failed', error: '写盘失败' }))
      .toEqual({ name: '阿坏', status: 'failed' });
  });

  it('非 contact 事件 / 缺名 / 未知 status → null', () => {
    expect(exportContactEvent({ phase: 'contacts', total: 3 })).toBeNull();
    expect(exportContactEvent({ phase: 'contact', status: 'ok' })).toBeNull();
    expect(exportContactEvent({ phase: 'contact', name: '甲', status: 'wat' })).toBeNull();
    expect(exportContactEvent({})).toBeNull();
  });
});

describe('finishExport 终结分流', () => {
  it('[bz-result] ok:true 为权威：written / failed / failures 以结果行为准', () => {
    const res = finishExport(
      { ok: true, stopped: false, code: 0, stderr: '', error: null },
      { ok: true, mode: 'export', contacts: 2, written: 1, unchanged: 0, failed: 1, skipped: 0, msgTotal: 9, named: 0, failures: [{ name: '阿坏', error: '写盘失败' }] },
    );
    expect(res.ok).toBe(true);
    expect(res.stopped).toBe(false);
    expect(res).toMatchObject({ written: 1, unchanged: 0, failed: 1, skipped: 0 });
    expect(res.failures).toEqual([{ name: '阿坏', error: '写盘失败' }]);
  });

  it('[bz-result] ok:false（工具预检失败）→ error 原文透传；含密钥/数据根词不带 doctor hint', () => {
    const res = finishExport(
      { ok: false, stopped: false, code: 1, stderr: '', error: null },
      { ok: false, error: '还没有缓存的解密密钥（数据根 .bz-face/key.json）——先跑一次 bz-face sync' },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain('key.json');
    expect(res.hint).toBe('');
  });

  it('spawn ENOENT 无结果行 → 安装指引（复用 sync 驱动归类）', () => {
    const res = finishExport({ ok: false, stopped: false, code: null, stderr: '', error: new Error('外部工具启动失败：spawn bz-face ENOENT') }, null);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('未找到 bz-face 命令');
    expect(res.hint).toContain('npm link');
  });

  it('stopped 优先：即使结果行已来也按中止算', () => {
    const res = finishExport(
      { ok: false, stopped: true, code: 0, stderr: '', error: null },
      { ok: true, written: 5 },
    );
    expect(res.stopped).toBe(true);
    expect(res.ok).toBe(false);
  });
});

describe('startContactsExport 全链', () => {
  it('一条命令带全部名单；逐人事件带 idx/total 推进；total 以工具 [bz-info] 校正', async () => {
    const seen: Array<{ name: string; idx: number; total: number }> = [];
    const run = startContactsExport({ dataRoot: 'D:\\根', contacts: ['大琳', '老周', '陈默'] }, (ev) => seen.push({ name: ev.name, idx: ev.idx, total: ev.total }));
    expect(tool.calls.length).toBe(1);
    // 工具报的总人数覆盖本地名单长度（名单被工具侧去重等场景的兜底口径）
    tool.info({ phase: 'contacts', total: 3 });
    tool.info({ phase: 'contact', name: '大琳', status: 'ok', msgs: 100, chat: 'new' });
    tool.info({ phase: 'contact', name: '老周', status: 'skipped', reason: '没有消息记录' });
    tool.info({ phase: 'contact', name: '陈默', status: 'ok', msgs: 2, chat: 'unchanged' });
    tool.result({ ok: true, mode: 'export', contacts: 2, written: 1, unchanged: 1, failed: 0, skipped: 1, msgTotal: 102, named: 0, failures: [] });
    await tool.settle({ ok: true, code: 0 });
    const res = await run.done;
    expect(res.ok).toBe(true);
    expect(res.written).toBe(1);
    expect(seen).toEqual([
      { name: '大琳', idx: 1, total: 3 },
      { name: '老周', idx: 2, total: 3 },
      { name: '陈默', idx: 3, total: 3 },
    ]);
  });

  it('stop → stopped 终态；句柄 stop 透传进程壳', async () => {
    const run = startContactsExport({ dataRoot: 'D:\\根', contacts: ['大琳'] });
    run.stop();
    expect(tool.stopCalls).toBe(1);
    await tool.settle({ ok: false, stopped: true, code: null });
    const res = await run.done;
    expect(res.stopped).toBe(true);
    expect(res.ok).toBe(false);
  });

  it('空名单不起进程，直接给确定失败终态', async () => {
    const run = startContactsExport({ dataRoot: 'D:\\根', contacts: [' ', ''] });
    const res = await run.done;
    expect(tool.calls.length).toBe(0);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('名单为空');
  });
});

// @vitest-environment node
/**
 * 直达运行命令（bz-dock-run-<id>）的口径测试（src/dock/command.ts）。
 *
 * 钉的是门槛判定 `judgeDirectRun` 与面板 runFlow / 调度器 inputOf 三方共用的那条口径：
 * 没 run 硬拦（顺序在前）、未信任 / 信任过期走既有信任确认（needTrust，D7：确认之前
 * 一个字节都不执行）、必填参数缺失点名拦下、全过放行；以及命令名 `dockToolLabel` 的
 * 取名回落（声明名 > 登记 id）。判定是纯函数，node 直测；执行路径（ui.ts 的
 * runToolDirect）要碰面板模块态，不在这里测。
 */
import { describe, it, expect } from 'vitest';
import { judgeDirectRun, dockToolLabel } from '../../src/dock/command';
import { setDockFs } from '../../src/dock/declaration';
import type { DockToolView } from '../../src/dock/data';
import type { DockManifest } from '../../src/dock/schema';

const ENTRY = {
  id: 'iamtxt-signin',
  path: 'E:/tools/daily-signin/manifest.json',
  trustedAt: '2026-01-01T00:00:00.000Z',
  trustedRun: 'node\0false\0main.mjs',
};

const RUN = { cmd: 'node', args: ['main.mjs'], cwd: 'E:/tools/daily-signin', shell: false };

/** 「全绿」基础视图：用例只覆盖自己关心的那一两处 */
function makeView(patch: Partial<DockToolView> = {}): DockToolView {
  return {
    entry: { ...ENTRY },
    manifest: { v: 1, id: ENTRY.id, name: 'iamtxt 签到', params: [] } as unknown as DockManifest,
    declError: null,
    declPath: ENTRY.path,
    valuesPath: 'E:/tools/daily-signin/data.json',
    run: { ...RUN },
    trustStale: false,
    values: {},
    runs: [],
    runsUnreadable: false,
    due: { state: 'none', detail: '' },
    dueToRun: false,
    declaredSchedule: undefined,
    schedule: undefined,
    scheduleOverridden: false,
    declChangedSinceOverride: false,
    nextDue: null,
    runState: undefined,
    overLimit: false,
    runsPath: 'E:/tools/daily-signin/runs.json',
    rules: [],
    ruleFiredAt: {},
    ...patch,
  };
}

describe('judgeDirectRun —— 直达运行的门槛判定（面板 / 调度器 / 命令三方同一口径）', () => {
  it('全过 → pass（信任在、信任没过期、声明有 run、必填参数齐）', () => {
    expect(judgeDirectRun(makeView())).toEqual({ pass: true });
  });

  it('声明没写怎么跑（无 run 段也无约定入口）→ 硬拦，话照面板那句说', () => {
    expect(judgeDirectRun(makeView({ run: null }))).toEqual({
      pass: false,
      message: '这份声明没写怎么跑：既无 run 段，目录里也没有 main.mjs',
    });
  });

  it('口径顺序：没 run 硬拦在前、信任问题在后（同 runFlow：先看有没有得跑，再看信不信得过）', () => {
    const v = judgeDirectRun(makeView({ run: null, trustStale: true }));
    expect(v).toHaveProperty('message'); // 是硬拦，不是 needTrust
  });

  it('未信任（trustedAt 缺）→ needTrust：不拦死，走既有信任确认（确认框展示将跑的命令）', () => {
    expect(judgeDirectRun(makeView({ entry: { id: ENTRY.id, path: ENTRY.path } }))).toEqual({
      pass: false,
      needTrust: true,
    });
  });

  it('信任过期（trustStale = 命令变了）→ 同样要求重新确认', () => {
    expect(judgeDirectRun(makeView({ trustStale: true }))).toEqual({ pass: false, needTrust: true });
  });

  it('必填参数缺失 → 硬拦并点名（undefined / 空串 / 空数组都算缺，与调度器 paramsReady 同源）', () => {
    const v = judgeDirectRun(
      makeView({
        manifest: {
          v: 1,
          id: ENTRY.id,
          name: 'iamtxt 签到',
          params: [
            { key: 'cookie', label: '登录凭据', type: 'secret', required: true },
            { key: 'note', label: '附言', type: 'str', required: true },
            { key: 'tags', label: '标签', type: 'multichoice', required: true },
            { key: 'free', label: '选填', type: 'str' },
          ],
        } as unknown as DockManifest,
        values: { note: '', tags: [] },
      }),
    );
    expect(v).toEqual({ pass: false, message: '还差必填参数：登录凭据、附言、标签' });
  });

  it('选填参数缺失不拦；值取工具目录 data.json 那份（命令路径没有表单草稿可冲）', () => {
    const v = judgeDirectRun(
      makeView({
        manifest: {
          v: 1,
          id: ENTRY.id,
          name: 'iamtxt 签到',
          params: [{ key: 'cookie', label: '登录凭据', type: 'secret', required: true }],
        } as unknown as DockManifest,
        values: { cookie: 'SID=xx' },
      }),
    );
    expect(v).toEqual({ pass: true });
  });
});

describe('dockToolLabel —— 命令名里的工具名', () => {
  it('声明名 > 登记 id；声明读不到回落 id（移动端够不着 fs 时自然落 id，命令照样注册）', () => {
    setDockFs({
      readText: (p) =>
        p === ENTRY.path
          ? JSON.stringify({ v: 1, id: ENTRY.id, name: 'iamtxt 签到', params: [] })
          : null,
      writeText: () => {},
    });
    try {
      expect(dockToolLabel({ ...ENTRY })).toBe('iamtxt 签到');
      expect(dockToolLabel({ id: 'gone-tool', path: 'E:/nowhere/manifest.json' })).toBe('gone-tool');
    } finally {
      setDockFs(undefined); // 复原真身（node 环境下即 null）
    }
  });
});

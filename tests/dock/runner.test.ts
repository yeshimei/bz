// @vitest-environment node
/**
 * runner（在场运行）—— 这里只测注入给外部进程的环境变量。
 *
 * 钉的是一条**真出过的缺陷**及其后的模型修订：`BZ_DOCK_RUNS_FILE` 曾经给的是 vault 内相对
 * 路径（`CONFIG/STORAGE/dock/runs/<id>.json`），而工具进程的 cwd 是它自己的目录 —— 于是记录
 * 被写进了 `<工具目录>/CONFIG/...`，bz 在 vault 里读不到，表现成「跑完了却没有运行记录」。
 *
 * 修法不是「把相对路径改绝对」，而是**记录改住工具目录**（spec D9/D10 修订）：路径由声明文件
 * 的位置推出，天生绝对，也天生与 vault 无关。外部进程拿到的路径一律必须绝对。
 */
import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { dockEnvOf } from '../../src/dock/runner';

const ENTRY = { id: 'iamtxt-signin', path: 'E:/tools/daily-signin/dock.json' };

/** 只兑现 runner 用到的那一个面：`vault.adapter.getBasePath` */
function fakeApp(basePath?: string): App {
  return {
    vault: { adapter: basePath === undefined ? {} : { getBasePath: () => basePath } },
  } as unknown as App;
}

describe('dockEnvOf —— 注入给工具进程的环境', () => {
  it('运行记录路径 = 声明文件同目录下的 dock.runs.json（绝对、工具侧）', () => {
    const env = dockEnvOf(ENTRY, fakeApp('E:/Obsidian/叫我包仔'));
    expect(env.BZ_DOCK_RUNS_FILE).toBe('E:/tools/daily-signin/dock.runs.json');
  });

  it('记录路径不靠 vault 推 —— 拿不到 vault 根也照给', () => {
    const env = dockEnvOf(ENTRY, fakeApp(undefined));
    expect(env.BZ_DOCK_RUNS_FILE).toBe('E:/tools/daily-signin/dock.runs.json');
  });

  it('vault 根可用时仍暴露 BZ_DOCK_VAULT（便利面，去掉尾分隔符）', () => {
    expect(dockEnvOf(ENTRY, fakeApp('E:/Obsidian/叫我包仔/')).BZ_DOCK_VAULT).toBe(
      'E:/Obsidian/叫我包仔',
    );
    expect(dockEnvOf(ENTRY, fakeApp(undefined)).BZ_DOCK_VAULT).toBeUndefined();
  });

  it('契约与工具标识恒在', () => {
    const env = dockEnvOf(ENTRY, fakeApp('E:/v'));
    expect(env.BZ_DOCK_CONTRACT).toBe('1');
    expect(env.BZ_DOCK_TOOL).toBe('iamtxt-signin');
  });

  it('触发器缺省 manual；调度器拉起时注入 auto（工具据此给记录标 trigger）', () => {
    expect(dockEnvOf(ENTRY, fakeApp('E:/v')).BZ_DOCK_TRIGGER).toBe('manual');
    expect(dockEnvOf(ENTRY, fakeApp('E:/v'), 'auto').BZ_DOCK_TRIGGER).toBe('auto');
  });
});

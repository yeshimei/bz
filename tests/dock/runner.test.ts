// @vitest-environment node
/**
 * runner（在场运行）—— 这里只测注入给外部进程的环境变量。
 *
 * 钉的是一条**真出过的缺陷**：`BZ_DOCK_RUNS_FILE` 曾经给的是 vault 内相对路径
 * （`CONFIG/STORAGE/dock/runs/<id>.json`），而工具进程的 cwd 是它自己的目录 —— 于是记录
 * 被写进了 `<工具目录>/CONFIG/...`，bz 在 vault 里读不到，表现成「跑完了却没有运行记录」。
 * 外部进程拿到的路径一律必须是绝对的。
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
  it('运行记录路径是绝对的（vault 根 + 约定相对路径）', () => {
    const env = dockEnvOf(ENTRY, fakeApp('E:/Obsidian/叫我包仔'));
    expect(env.BZ_DOCK_RUNS_FILE).toMatch(/^E:\/Obsidian\/叫我包仔\//);
    expect(env.BZ_DOCK_RUNS_FILE).toMatch(/CONFIG\/STORAGE\/dock\/runs\/iamtxt-signin\.json$/);
    expect(env.BZ_DOCK_VAULT).toBe('E:/Obsidian/叫我包仔');
  });

  it('vault 根带尾分隔符也不出现双斜杠', () => {
    const env = dockEnvOf(ENTRY, fakeApp('E:/Obsidian/叫我包仔/'));
    expect(env.BZ_DOCK_RUNS_FILE).not.toMatch(/\/\//);
    expect(env.BZ_DOCK_VAULT).toBe('E:/Obsidian/叫我包仔');
  });

  it('拿不到 vault 根时索性不给路径 —— 宁可没有，也不给会被解析歪的相对路径', () => {
    const env = dockEnvOf(ENTRY, fakeApp(undefined));
    expect(env.BZ_DOCK_RUNS_FILE).toBeUndefined();
    expect(env.BZ_DOCK_VAULT).toBeUndefined();
  });

  it('契约与工具标识恒在', () => {
    const env = dockEnvOf(ENTRY, fakeApp('E:/v'));
    expect(env.BZ_DOCK_CONTRACT).toBe('1');
    expect(env.BZ_DOCK_TOOL).toBe('iamtxt-signin');
  });
});

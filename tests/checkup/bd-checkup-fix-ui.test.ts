/**
 * 数据体检拍板修复批回归（bd-fix-bd-checkup-attach，独立命名防撞）：
 * - CK2（呈报#10）：单条修复免确认直达；批量（一键修复）保留确认框（danger 主动作）；
 * - CK5（呈报#28）：空态同屏只剩空态 CTA 一个「开始体检」，foot 留白；
 * - CK7（呈报#51）：黄组按域分组修复中间档（修收藏本/修剪藏本），点击只修该域；
 * - CK8（呈报#30）：重开面板「数据可能已变化」提示条就地挂「重新体检」行动钮；
 * - CK6（呈报#29）回归锁：体检完成进度条补满 setValue(100) 再切结果页；
 * - CK4（呈报#62）回归锁：移动端报告面板高度 86dvh（老内核 86vh 兜底）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { escManager } from '../../src/core/esc-manager';
import { __resetNoticeForTests } from '../../src/core/notice';
import { openDataCheckup, unloadDataCheckup } from '../../src/checkup';
import { __resetCheckupCacheForTests } from '../../src/checkup/run';

/** CK6 回归锁：捕获 uiProgress.setValue 序列（完成补满 100 断言用） */
const progressCalls = vi.hoisted(() => [] as number[]);
vi.mock('../../src/core/ui', async (importOriginal) => {
  const mod = await importOriginal<Record<string, any>>();
  return {
    ...mod,
    uiProgress: (...args: unknown[]) => {
      const ctl = mod.uiProgress(...args);
      return {
        ...ctl,
        setValue: (n: number) => {
          progressCalls.push(n);
          ctl.setValue(n);
        },
      };
    },
  };
});

// 确认框替身：默认「清除」；用例可改返回值。参数原样透传，供断言 actions（danger 标记）
const flowMock = vi.fn((..._args: unknown[]) => Promise.resolve<string | undefined>('ok'));
vi.mock('../../src/core/flow-dialog', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, openFlowDialog: (...args: unknown[]) => flowMock(...args) };
});

const DIR = 'CONFIG/STORAGE';

/** 轮询等待（面板运行链有 setTimeout 让出 + 自动重跑，事件驱动等待不可靠） */
async function waitFor(fn: () => boolean, timeout = 3000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('waitFor 超时');
}

/** 双域可修样本：favorites 失效关联 + clipbook 残留（CK2 批量确认 / CK7 分组修复共用） */
function twoDomainFixtures() {
  const fav = [
    { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
  ];
  const sidecar = { articleOverrides: {}, savedArchive: [{ url: 'https://gone', title: '甲', savedAt: '1' }], order: [], marks: {}, savedImages: {}, pendingSource: {}, readLog: [] };
  return {
    [`${DIR}/favorites.json`]: JSON.stringify(fav),
    [`${DIR}/clipbook.json`]: JSON.stringify(sidecar),
  };
}

function makeApp(files: Record<string, string>, frontmatter: Record<string, Record<string, unknown>> = {}) {
  const vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  const app = {
    vault,
    metadataCache: { getFileCache: (f: any) => (frontmatter[f.path] ? { frontmatter: frontmatter[f.path] } : null) },
    plugins: {},
  } as any;
  setApp(app);
  setSettingsProvider(() => ({}) as any);
  return { app, vault };
}

/** 体检到出结果页（默认全绿样本） */
async function runToReport(popup: HTMLElement) {
  ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
  await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));
}

describe('数据体检拍板修复批（bd-checkup-fix-ui）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    __resetNoticeForTests();
    __resetCheckupCacheForTests();
    progressCalls.length = 0;
    document.body.innerHTML = '';
    unloadDataCheckup();
    (escManager as any).handlers = new Map();
    flowMock.mockClear();
    flowMock.mockImplementation(() => Promise.resolve<string | undefined>('ok'));
  });

  it('CK2：批量一键修复保留确认框（写明数量 + danger 主动作）；取消不写盘', async () => {
    flowMock.mockImplementation(() => Promise.resolve<string | undefined>('cancel'));
    const { app, vault } = makeApp(twoDomainFixtures());
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    await runToReport(popup);
    ;[...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-group--warn button')].find((b) => b.textContent!.includes('一键修复'))!.click();
    expect(flowMock).toHaveBeenCalledTimes(1);
    // issue 291 评审补：「清除」是删除类主动作（可撤销）→ danger 主钮不高亮（§9/§10）
    expect(flowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('将清除 2 项失效引用'),
        actions: expect.arrayContaining([expect.objectContaining({ label: '清除', danger: true })]),
      })
    );
    // 取消：两域数据原样
    expect(JSON.parse(vault.files.get(`${DIR}/favorites.json`)!)[0].linkedNote).toBe('我的/gone.md');
    expect(JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!).savedArchive).toHaveLength(1);
  });

  it('CK2：单条修复免确认直达（确认框零调用），撤销链与自动收敛照常', async () => {
    const fav = [
      { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
    ];
    const { app, vault } = makeApp({ [`${DIR}/favorites.json`]: JSON.stringify(fav) });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    await runToReport(popup);
    ;[...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-group--warn button')].find((b) => b.textContent!.includes('清除关联'))!.click();
    // 修复前必红口径：旧实现此处弹确认框（flowMock 被调用）
    expect(flowMock).not.toHaveBeenCalled();
    await waitFor(() => getNoticeMessages().some((m) => m.includes('已清除 1 项失效引用：收藏关联 1')));
    expect(JSON.parse(vault.files.get(`${DIR}/favorites.json`)!)[0].linkedNote).toBeNull();
  });

  it('CK5：空态全面板只有空态 CTA 一个「开始体检」，foot 无按钮', () => {
    const { app } = makeApp({});
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    const runBtns = [...popup.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent!.includes('开始体检'));
    expect(runBtns).toHaveLength(1); // 修复前：空态 CTA + foot 各一枚 = 2
    expect(runBtns[0].closest('.bz-checkup-foot')).toBeNull(); // 留下的是空态 CTA
    expect(popup.querySelector('.bz-checkup-foot')!.querySelectorAll('button')).toHaveLength(0);
  });

  it('CK7：跨域黄组出「修收藏本/修剪藏本」分组修复档，点击只修该域', async () => {
    const { app, vault } = makeApp(twoDomainFixtures());
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    await runToReport(popup);
    const warn = popup.querySelector('.bz-checkup-group--warn')!;
    // 分组档在「一键修复」与「逐条」之间：两个域都有可修项才出（单一域时一键修复即该域）
    const domainBtns = [...warn.querySelectorAll<HTMLButtonElement>('.bz-checkup-fixdomains button')];
    expect(domainBtns.map((b) => b.textContent)).toEqual(['修收藏本（1）', '修剪藏本（1）']);
    // 单域问题行免确认直达：只清收藏关联，剪藏残留不动
    domainBtns[0].click();
    expect(flowMock).not.toHaveBeenCalled();
    await waitFor(() => {
      const w = popup.querySelector('.bz-checkup-group--warn');
      return !!w && !w.textContent!.includes('关联笔记不存在');
    });
    expect(JSON.parse(vault.files.get(`${DIR}/favorites.json`)!)[0].linkedNote).toBeNull();
    expect(JSON.parse(vault.files.get(`${DIR}/clipbook.json`)!).savedArchive).toHaveLength(1);
    // 收敛后只剩剪藏本问题：单一域不再重复出分组档
    const warnAfter = popup.querySelector('.bz-checkup-group--warn')!;
    expect(warnAfter.querySelector('.bz-checkup-fixdomains')).toBeNull();
    expect(warnAfter.textContent).toContain('剪藏残留');
  });

  it('CK8：数据可能已变化的 stale 提示条就地挂「重新体检」钮，点击重入体检；未变化时不挂钮', async () => {
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    await runToReport(popup);
    // 关面板 → 模拟体检后数据文件 mtime 变化 → 重开
    const mask = document.getElementById('bz-checkup-mask')!;
    mask.dispatchEvent(new Event('click'));
    const origFile = vault.file.bind(vault);
    (vault as any).file = (p: string) => {
      const f = origFile(p);
      if (p === `${DIR}/memo.json`) f.stat.mtime += 60000;
      return f;
    };
    openDataCheckup(app);
    const stale = popup.querySelector('.bz-checkup-stale') as HTMLElement;
    expect(stale).toBeTruthy();
    expect(stale.textContent).toContain('数据可能已变化');
    const actBtn = stale.querySelector<HTMLButtonElement>('button');
    expect(actBtn).toBeTruthy(); // 修复前：纯文字提示条不可操作
    expect(actBtn!.textContent).toContain('重新体检');
    // 行动钮重入体检：运行态 → 新报告
    actBtn!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-progress'));
    await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));

    // 对照面：体检后数据未变化 → 重开提示「此后数据未变化」且不挂钮（clean 口径维持弱化）
    mask.dispatchEvent(new Event('click'));
    openDataCheckup(app);
    const stale2 = popup.querySelector('.bz-checkup-stale') as HTMLElement;
    expect(stale2.textContent).toContain('此后数据未变化');
    expect(stale2.querySelector('button')).toBeNull();
  });

  it('CK6 回归锁：体检完成进度条补满 100% 再切结果页', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    await runToReport(popup);
    // 修复前（旧实现最后一次 onProgress 只到 75%，随即切页）：终值必不到 100
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]).toBe(100);
  });

  it('CK4 回归锁：移动端报告面板高度接 dvh（86vh 兜底在前，零劣化）', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/checkup/styles.css'), 'utf8');
    expect(css).toMatch(/max-height:\s*86vh;/);
    expect(css).toMatch(/max-height:\s*86dvh;/);
    expect(css.indexOf('86vh')).toBeLessThan(css.indexOf('86dvh'));
  });
});

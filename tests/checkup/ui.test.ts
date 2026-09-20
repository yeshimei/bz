/**
 * 数据体检面板 UI 测试（checkup 域，D4）：
 * - 面板开合/空态/重开显示上次结果（缓存提示）；
 * - 三态分组渲染（红=坏 json、黄=可修复孤儿、绿=通过项）+ 查看详情展开；
 * - 体检中取消（挂起 vault 读，点取消后回空态且不产报告）；
 * - 一键修复撤销链：确认框 → 定点清理 → notifyUndo 撤销通知 → 自动重新体检收敛；
 * - 设置面板通用组「数据体检」按钮行直达面板。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { escManager } from '../../src/core/esc-manager';
import { __resetNoticeForTests } from '../../src/core/notice';
import { openDataCheckup, unloadDataCheckup } from '../../src/checkup';
import { __resetCheckupCacheForTests } from '../../src/checkup/run';

// 确认框替身：默认「清除」；用例可改返回值。参数原样透传给 flowMock，供断言 actions（danger 标记）
const flowMock = vi.fn((..._args: unknown[]) => Promise.resolve<string | undefined>('ok'));
vi.mock('../../src/core/flow-dialog', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, openFlowDialog: (...args: unknown[]) => flowMock(...args) };
});

// run 模块替身开关（eff P3-3 体检失败 / P3-2 修复挂起用）：
// failRun=true 时 runCheckup 抛错；fixGate 非空时 fixOrphanIssues 挂起至调用它放行
let failRun = false;
let fixGate: ((resolve: () => void) => void) | null = null;
vi.mock('../../src/checkup/run', async (importOriginal) => {
  const mod = await importOriginal<Record<string, any>>();
  return {
    ...mod,
    runCheckup: (...args: unknown[]) => (failRun ? Promise.reject(new Error('disk exploded')) : mod.runCheckup(...args)),
    fixOrphanIssues: (...args: unknown[]) => {
      if (!fixGate) return mod.fixOrphanIssues(...args);
      const gate = fixGate;
      fixGate = null;
      return new Promise<void>((resolve) => gate(resolve)).then(() => mod.fixOrphanIssues(...args));
    },
  };
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

describe('数据体检面板（checkup UI）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    __resetNoticeForTests();
    __resetCheckupCacheForTests();
    document.body.innerHTML = '';
    unloadDataCheckup();
    failRun = false;
    fixGate = null;
    (escManager as any).handlers = new Map();
    flowMock.mockClear();
    flowMock.mockImplementation(() => Promise.resolve<string | undefined>('ok'));
  });

  it('开合与空态：还没体检过显示空态与「开始体检」；重复打开不重复建；卸载清理 DOM', () => {
    makeApp({});
    openDataCheckup({} as never);
    const mask = document.getElementById('bz-checkup-mask')!;
    const popup = document.getElementById('bz-checkup-popup')!;
    expect(mask).toBeTruthy();
    expect(popup).toBeTruthy();
    // 壳走样式库共享类（issue 198 批次 C）：单根遮罩 .bz-panel-overlay + 面板 .bz-panel-frame
    expect(mask.classList.contains('bz-panel-overlay')).toBe(true);
    expect(popup.classList.contains('bz-panel-frame')).toBe(true);
    // 头行走 .bz-panel-head 族（品牌块 + 标题）
    expect(popup.querySelector('.bz-panel-head .bz-panel-title')!.textContent).toBe('数据体检');
    expect(popup.querySelector('.bz-panel-brand')).toBeTruthy();
    expect(popup.querySelector('.bz-empty-title')!.textContent).toContain('还没体检过');
    const runBtn = [...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'));
    expect(runBtn).toBeTruthy();
    // 重复打开：同一实例抬顶，不新建
    openDataCheckup({} as never);
    expect(document.getElementById('bz-checkup-popup')).toBe(popup);
    // 卸载清理
    unloadDataCheckup();
    expect(document.getElementById('bz-checkup-mask')).toBeNull();
    expect(document.getElementById('bz-checkup-popup')).toBeNull();
  });

  it('体检全绿：跑完显示「全部通过」+ 通过分组 + 重新体检按钮；重开面板显示上次结果提示', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    const runBtn = [...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!;
    runBtn.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));
    expect(popup.querySelector('.bz-checkup-summary')!.textContent).toContain('全部通过');
    expect(popup.querySelector('.bz-checkup-group--ok')!.textContent).toContain('通过（4）');
    // 底部变「重新体检」
    expect([...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-foot button')].some((b) => b.textContent!.includes('重新体检'))).toBe(true);
    // 关闭再开：显示缓存结果 + 可重跑提示
    const mask = document.getElementById('bz-checkup-mask')!;
    mask.dispatchEvent(new Event('click'));
    openDataCheckup(app);
    expect(popup.querySelector('.bz-checkup-stale')!.textContent).toContain('上次体检');
    expect(popup.querySelector('.bz-checkup-summary')!.textContent).toContain('全部通过');
  });

  it('三态渲染：坏 json 出红组、可修复孤儿出黄组（含一键修复与查看详情）、无问题项进绿组', async () => {
    const fav = [
      { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
    ];
    const { app } = makeApp(
      {
        [`${DIR}/memo.json`]: '{oops',
        [`${DIR}/favorites.json`]: JSON.stringify(fav),
        '我的/影视/《T》.md': '# T',
      },
      { '我的/影视/《T》.md': { tags: ['电影'], 海报: 'nope.png' } }
    );
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));
    // 红：坏 json
    expect(popup.querySelector('.bz-checkup-summary')!.textContent).toContain('需要处理');
    expect(popup.querySelector('.bz-checkup-group--bad')!.textContent).toContain('无法解析');
    // 黄：孤儿（影院海报 + 收藏关联）
    const warn = popup.querySelector('.bz-checkup-group--warn')!;
    expect(warn.textContent).toContain('建议处理');
    expect(warn.textContent).toContain('影视《T》');
    expect(warn.textContent).toContain('关联笔记不存在');
    expect(warn.textContent).toContain('一键修复');
    // 查看详情展开（定位到「关联笔记不存在」那行，避开黄组内其他提示项的详情）
    const issueRowEl = [...popup.querySelectorAll('.bz-checkup-issue')].find(
      (r) => r.textContent!.includes('关联笔记不存在')
    )!;
    const toggle = issueRowEl.querySelector('.bz-checkup-detail-toggle') as HTMLButtonElement;
    const detail = issueRowEl.querySelector('.bz-checkup-detail') as HTMLElement;
    expect(detail.style.display).toBe('none');
    // ui P3-3：读屏语义——aria-expanded 随展开翻转
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // eff P3-4：隐藏详情不全量进 DOM——展开前不填充文本
    expect(detail.textContent).toBe('');
    toggle.click();
    expect(detail.style.display).toBe('block');
    expect(detail.textContent).toContain('我的/gone.md');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // 绿：至少同源一致性（坏 json 跳过）等无问题项进通过组
    expect(popup.querySelector('.bz-checkup-group--ok')).toBeTruthy();
  });

  it('体检中取消：回空态、不产报告（再开为空态）', async () => {
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    // 挂起 adapter.read：体检停在第一步
    const pending: Array<() => void> = [];
    (vault.adapter as any).read = (path: string) =>
      new Promise<string>((resolve) => {
        pending.push(() => resolve(vault.files.get(path) ?? '[]'));
      });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-progress'));
    expect(popup.querySelector('.bz-checkup-step.is-current')).toBeTruthy();
    // 取消
    ;[...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-foot button')].find((b) => b.textContent!.includes('取消体检'))!.click();
    while (pending.length) pending.shift()!();
    await waitFor(() => !!popup.querySelector('.bz-empty-title'));
    expect(popup.querySelector('.bz-checkup-summary')).toBeNull();
  });

  it('一键修复撤销链：确认后清除失效关联 + 撤销通知 + 自动重新体检收敛报告', async () => {
    const fav = [
      { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
    ];
    const { app, vault } = makeApp({ [`${DIR}/favorites.json`]: JSON.stringify(fav) });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-group--warn'));
    // 逐条修复按钮
    const fixBtn = [...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-group--warn button')].find((b) => b.textContent!.includes('清除关联'))!;
    fixBtn.click();
    expect(flowMock).toHaveBeenCalled();
    // issue 291 评审补：「清除」是删除类主动作（从数据文件里删失效引用/残留，可撤销）→
    // 必须标 danger，主按钮不高亮（设计手册 §9/§10）
    expect(flowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([expect.objectContaining({ label: '清除', danger: true })]),
      })
    );
    await waitFor(() => getNoticeMessages().some((m) => m.includes('已清除 1 项失效引用：收藏关联 1')));
    // 数据落盘：linkedNote 置 null
    const after = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    expect(after[0].linkedNote).toBeNull();
    // 清理后自动重新体检：报告收敛（孤儿问题消失）
    await waitFor(() => {
      const warn = popup.querySelector('.bz-checkup-group--warn');
      return !warn || !warn.textContent!.includes('关联笔记不存在');
    });
  });

  it('一键修复取消：确认框返回取消则不写盘', async () => {
    flowMock.mockImplementation(() => Promise.resolve<string | undefined>('cancel'));
    const fav = [
      { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
    ];
    const { app, vault } = makeApp({ [`${DIR}/favorites.json`]: JSON.stringify(fav) });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-group--warn'));
    ;[...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-group--warn button')].find((b) => b.textContent!.includes('清除关联'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));
    const after = JSON.parse(vault.files.get(`${DIR}/favorites.json`)!);
    expect(after[0].linkedNote).toBe('我的/gone.md');
  });

  it('设置面板通用组「数据体检」按钮行：点击直达体检面板', async () => {
    const { app } = makeApp({});
    const { SettingsPanelUI } = await import('../../src/settings-panel/ui');
    const ui = new SettingsPanelUI();
    ui.open('global');
    const spPopup = document.getElementById('bz-settings-panel-popup')!;
    // 通用组出现 + 「打开体检」按钮行（D4 新增）
    await waitFor(() => spPopup.querySelectorAll('.bz-sp-group').length > 0);
    await waitFor(() => [...spPopup.querySelectorAll<HTMLButtonElement>('button')].some((b) => b.textContent!.includes('打开体检')));
    const btn = [...spPopup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('打开体检'))!;
    btn.click();
    await waitFor(() => !!document.getElementById('bz-checkup-popup'));
    expect(document.getElementById('bz-checkup-popup')!.querySelector('.bz-panel-title')!.textContent).toBe('数据体检');
    ui.cleanup();
    unloadDataCheckup();
    void app;
  });

  it('ui P2-1：hide 型常驻层重开重放注册——ESC 关最上面的体检面板，不再关底下被盖住的设置面板', async () => {
    const { app } = makeApp({});
    // ① 体检面板 build + 显示（ESC 注册于栈位 0）
    openDataCheckup(app);
    const mask = document.getElementById('bz-checkup-mask')!;
    // ② 设置面板打开（ESC 注册于栈尾）
    const { SettingsPanelUI } = await import('../../src/settings-panel/ui');
    const sp = new SettingsPanelUI();
    sp.open('global');
    const spMask = document.getElementById('bz-settings-panel-mask')!;
    await waitFor(() => spMask.style.display === 'block');
    // ③ 体检面板 hide 后重开：旧实现只 topifyZ 不重放 ESC 注册 → ESC 关错层
    mask.style.display = 'none';
    openDataCheckup(app);
    expect(mask.style.display).toBe('flex');
    // ④ ESC：关最上面的体检面板，设置面板不动（修复前此断言反向必红）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(mask.style.display).toBe('none');
    expect(spMask.style.display).toBe('block');
    sp.cleanup();
    unloadDataCheckup();
  });

  it('ui P3-1：撤销后报告重算——数据回到失效态，报告跟着回去（反向收敛）', async () => {
    const fav = [
      { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
    ];
    const { app } = makeApp({ [`${DIR}/favorites.json`]: JSON.stringify(fav) });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-group--warn'));
    ;[...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-group--warn button')].find((b) => b.textContent!.includes('清除关联'))!.click();
    // 修复收敛：问题行消失
    await waitFor(() => {
      const warn = popup.querySelector('.bz-checkup-group--warn');
      return !warn || !warn.textContent!.includes('关联笔记不存在');
    });
    // 点撤销通知
    const undoBtn = [...document.querySelectorAll<HTMLButtonElement>('.bz-notice-action')].find((b) => b.textContent!.includes('撤销'));
    expect(undoBtn).toBeTruthy();
    undoBtn!.click();
    // 报告跟着回去：失效关联问题重新出现
    await waitFor(() => {
      const warn = popup.querySelector('.bz-checkup-group--warn');
      return !!warn && warn.textContent!.includes('关联笔记不存在');
    });
  });

  it('eff P3-1：跨组一键修复撤销通知聚合单条（总数 + 分组计数），不再一组一条刷屏', async () => {
    const fav = [
      { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
    ];
    const sidecar = { articleOverrides: {}, savedArchive: [{ url: 'https://gone', title: '甲', savedAt: '1' }], order: [], marks: {}, savedImages: {}, pendingSource: {}, readLog: [] };
    const { app } = makeApp({
      [`${DIR}/favorites.json`]: JSON.stringify(fav),
      [`${DIR}/clipbook.json`]: JSON.stringify(sidecar),
    });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => {
      const warn = popup.querySelector('.bz-checkup-group--warn');
      return !!warn && warn.textContent!.includes('一键修复');
    });
    ;[...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-group--warn button')].find((b) => b.textContent!.includes('一键修复'))!.click();
    await waitFor(() => getNoticeMessages().some((m) => m.includes('已清除 2 项失效引用')));
    const cleared = getNoticeMessages().filter((m) => m.includes('已清除'));
    expect(cleared).toHaveLength(1); // 单条聚合（旧实现每组一条 = 2 条）
    expect(cleared[0]).toContain('收藏关联 1');
    expect(cleared[0]).toContain('剪藏残留 1');
  });

  it('eff P3-2：修复执行期忙碌态——面板按钮全部禁用、foot 显修复中，完成后恢复', async () => {
    const fav = [
      { id: 'a', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: '我的/gone.md', created: '', type: '', llmConfig: null },
    ];
    const { app } = makeApp({ [`${DIR}/favorites.json`]: JSON.stringify(fav) });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-group--warn'));
    let releaseFix: () => void = () => {};
    fixGate = (resolve) => {
      releaseFix = resolve;
    };
    ;[...popup.querySelectorAll<HTMLButtonElement>('.bz-checkup-group--warn button')].find((b) => b.textContent!.includes('清除关联'))!.click();
    // 挂起窗口：全部按钮禁用（确认框闭幕后）
    await waitFor(() => {
      const btns = [...popup.querySelectorAll<HTMLButtonElement>('button')];
      return btns.length > 0 && btns.every((b) => b.disabled);
    });
    releaseFix();
    // 完成后恢复：重新体检收敛，出现可点按钮
    await waitFor(() => {
      const btns = [...popup.querySelectorAll<HTMLButtonElement>('button')];
      return btns.some((b) => !b.disabled);
    });
  });

  it('eff P3-3：体检失败通知带「重试」出口，点击后重入体检', async () => {
    const { app } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    failRun = true;
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => getNoticeMessages().some((m) => m.includes('体检失败：disk exploded')));
    const retry = [...document.querySelectorAll<HTMLButtonElement>('.bz-notice-action')].find((b) => b.textContent!.includes('重试'));
    expect(retry).toBeTruthy();
    failRun = false;
    retry!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));
  });

  it('eff P3-5：体检中关面板，后台跑完出完成通知（含查看出口），点击重开面板见报告', async () => {
    const { app, vault } = makeApp({ [`${DIR}/memo.json`]: '[]' });
    const pending: Array<() => void> = [];
    (vault.adapter as any).read = (path: string) =>
      new Promise<string>((resolve) => {
        pending.push(() => resolve(vault.files.get(path) ?? '[]'));
      });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    const mask = document.getElementById('bz-checkup-mask')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-progress'));
    // 关面板（hide 不作废在途 run），放行体检继续
    mask.dispatchEvent(new Event('click'));
    expect(mask.style.display).toBe('none');
    // 持续放行挂起的逐文件读（checkJsonFiles 每个文件都会挂起一次）
    const drain = setInterval(() => {
      while (pending.length) pending.shift()!();
    }, 5);
    // 后台完成通知：带计数
    try {
      await waitFor(() => getNoticeMessages().some((m) => m.includes('体检完成')));
    } finally {
      clearInterval(drain);
    }
    // 点「查看」重开面板
    const view = [...document.querySelectorAll<HTMLButtonElement>('.bz-notice-action')].find((b) => b.textContent!.includes('查看'));
    expect(view).toBeTruthy();
    view!.click();
    await waitFor(() => mask.style.display === 'flex');
    await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));
  });

  it('func P3-9：纯 info 报告 summary 显示「建议处理」，不再与黄组矛盾地报「全部通过」', async () => {
    // memo 条目缺 due 字段 → 检查二 info「部分条目缺少常见字段」（全报告唯一问题）
    const memoNoDue = {
      id: 'm1', title: 'T', scene: 's', priority: 'minor', created: 'c', completed: null,
      notePath: null, notePosition: null, scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    };
    const { app } = makeApp({ [`${DIR}/memo.json`]: JSON.stringify([memoNoDue]) });
    openDataCheckup(app);
    const popup = document.getElementById('bz-checkup-popup')!;
    ;[...popup.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('开始体检'))!.click();
    await waitFor(() => !!popup.querySelector('.bz-checkup-summary'));
    const summary = popup.querySelector('.bz-checkup-summary')!.textContent!;
    expect(summary).toContain('1 处建议处理');
    expect(summary).not.toContain('全部通过');
    // 黄组确实列着这条 info
    expect(popup.querySelector('.bz-checkup-group--warn')!.textContent).toContain('缺少常见字段');
  });
});

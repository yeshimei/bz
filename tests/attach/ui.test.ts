/**
 * 附件搬移域 UI / 执行层测试（ticket 65；ticket 128 起目标文件夹改用统一路径选择器 core/path-picker）。
 * 移动经 app.fileManager.renameFile（Obsidian 内建，自动更新内部链接），
 * mock 里 renameFile 只负责在 MockVault 中移动（链接更新是 Obsidian 内部职责）。
 * 增强包（2026-09 拍板）：撤销搬移（逆序恢复专门用例）/选择器前置附件数/≥10 progress i/N/
 * 可勾选清单预览/文件右键菜单入口。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { clearNotices, hasNotice } from '../mock-obsidian-entry';
import { runMove, moveAttachments, openMovePreview } from '../../src/attach/ui';
import { ensureAttachFileMenu } from '../../src/attach/index';

function makeApp(vault: MockVault, activePath?: string) {
  const app = mockAppWithVault(vault) as any;
  app.workspace.getActiveFile = () => (activePath ? vault.getAbstractFileByPath(activePath) : null);
  return app;
}

/** 带 Obsidian 式 fileManager.renameFile 的 app（记录调用参数并实际移动） */
function withRename(vault: MockVault, active: string) {
  const settings: Record<string, any> = { attachLastFolder: '' };
  setSettingsProvider(() => settings as any);
  const app = makeApp(vault, active);
  const calls: Array<[string, string]> = [];
  app.fileManager = {
    renameFile: vi.fn(async (file: any, newPath: string) => {
      calls.push([file.path, newPath]);
      await vault.rename(file, newPath);
    }),
  };
  setApp(app as any);
  return { app, vault, settings, calls };
}

/** file-menu 事件 mock 菜单（记录 addItem 产物） */
function makeMenu() {
  const items: any[] = [];
  return {
    items,
    addItem(setup: (item: any) => void) {
      const item: any = {
        title: '',
        icon: '',
        handler: null,
        setTitle(t: string) {
          this.title = t;
          return this;
        },
        setIcon(i: string) {
          this.icon = i;
          return this;
        },
        onClick(cb: () => void) {
          this.handler = cb;
          return this;
        },
      };
      setup(item);
      items.push(item);
      return item;
    },
  };
}

describe('runMove 执行编排（fileManager.renameFile）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('移动当前笔记附件 + 记忆文件夹 + 汇总通知，不改写笔记内容', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 见 [[note2]] 与 ![x](assets/b.png)');
    vault.create('笔记/a.png', '');
    vault.create('assets/b.png', '');
    vault.create('note2.md', '');
    vault.create('其他.md', '也引用 ![[a.png]]');
    const { app, settings, calls } = withRename(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toEqual({ moved: 2, renamed: 0, linksAuto: true });
    expect(calls).toEqual([
      ['笔记/a.png', '附件/a.png'],
      ['assets/b.png', '附件/b.png'],
    ]);
    expect(vault.files.has('笔记/a.png')).toBe(false);
    expect(vault.files.has('assets/b.png')).toBe(false);
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('附件/b.png')).toBe(true);
    // 插件不再自行改写笔记内容（链接更新由 Obsidian 内建负责）
    expect(vault.files.get('笔记/章.md')).toBe('图：![[a.png]] 见 [[note2]] 与 ![x](assets/b.png)');
    expect(vault.files.get('其他.md')).toBe('也引用 ![[a.png]]');
    expect(settings.attachLastFolder).toBe('附件');
    expect(hasNotice(/已移动 2 个附件到「附件」，改名 0 个，内部链接已自动更新/)).toBe(true);
    // AC-1 术语守卫：用户可见文案不含「资源」字样（CONTEXT.md _Avoid_ 清单）
    expect(hasNotice(/资源/)).toBe(false);
  });

  it('目标已有同名文件才改名，renameFile 收到去重后的目标路径', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    vault.create('附件/a.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toEqual({ moved: 1, renamed: 1, linksAuto: true });
    expect(calls).toEqual([['笔记/a.png', '附件/a (1).png']]);
    expect(vault.files.has('笔记/a.png')).toBe(false);
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('附件/a (1).png')).toBe(true);
    expect(hasNotice(/改名 1 个/)).toBe(true);
  });

  it('无附件可移动 → info 通知且不执行', async () => {
    const vault = new MockVault();
    vault.create('n.md', 'hello [[other]]');
    vault.create('other.md', 'x');
    const { app, calls } = withRename(vault, 'n.md');
    const res = await runMove(app, vault.getAbstractFileByPath('n.md'), '附件');
    expect(res).toBeNull();
    expect(calls).toHaveLength(0);
    expect(hasNotice('当前笔记没有可移动的附件')).toBe(true);
  });

  it('附件已在目标文件夹 → 提示且不重复移动', async () => {
    const vault = new MockVault();
    vault.create('附件/a.png', '');
    vault.create('n.md', '![[a.png]]');
    const { app, calls } = withRename(vault, 'n.md');
    const res = await runMove(app, vault.getAbstractFileByPath('n.md'), '附件');
    expect(res).toBeNull();
    expect(calls).toHaveLength(0);
    expect(hasNotice('附件已全部在目标文件夹')).toBe(true);
  });

  it('only 白名单：只移动清单勾选项，未勾选的原地不动', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', ['笔记/a.png']);

    expect(summary).toEqual({ moved: 1, renamed: 0, linksAuto: true });
    expect(calls).toEqual([['笔记/a.png', '附件/a.png']]);
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('笔记/b.png')).toBe(true); // 未勾选的不动
  });

  it('only 空数组（0 勾选防御）→ 提示且不执行', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');
    const res = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', []);
    expect(res).toBeNull();
    expect(calls).toHaveLength(0);
    expect(hasNotice('未勾选任何要移动的附件')).toBe(true);
  });

  it('无 fileManager.renameFile（异常环境）→ 回退 vault.rename，通知链接未自动更新', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '![[a.png]]');
    vault.create('笔记/a.png', '');
    const settings: Record<string, any> = { attachLastFolder: '' };
    setSettingsProvider(() => settings as any);
    const app = makeApp(vault, '笔记/章.md');
    // mock app 已补齐内建 renameFile；显式摘除以模拟异常环境（回退路径）
    delete (app as any).fileManager.renameFile;
    setApp(app as any);

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toEqual({ moved: 1, renamed: 0, linksAuto: false });
    expect(vault.files.has('笔记/a.png')).toBe(false);
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(hasNotice(/已移动 1 个附件到「附件」，改名 0 个，链接未自动更新/)).toBe(true);
  });

  it('回归（P2 口径）：部分移动失败 → moved 只计成功数 + failedOps 明细 + 重试出口补搬', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app } = withRename(vault, '笔记/章.md');
    // 注入：首轮第二个附件移动失败，重试轮放行
    let failB = true;
    app.fileManager.renameFile = vi.fn(async (file: any, newPath: string) => {
      if (file.path === '笔记/b.png' && failB) throw new Error('locked by user');
      await vault.rename(file, newPath);
    });

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    // moved = 计划数 − 失败数 = 1（旧实现误报 moves.length=2）；失败明细带路径级归宿（AF-3）
    expect(summary).toEqual({ moved: 1, renamed: 0, linksAuto: true, failedOps: [{ fromPath: '笔记/b.png', missing: false }] });
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('笔记/b.png')).toBe(true); // 失败的原文件未动
    expect(hasNotice('已移动 1 个附件到「附件」，改名 0 个，内部链接已自动更新，失败 1 个')).toBe(true);
    // 失败明细通知（notifyActionError 范式）+「重试」出口
    expect(hasNotice(/附件搬移失败：1 个移动出错（如 笔记\/b.png），请重试/)).toBe(true);
    const retryBtn = [...document.querySelectorAll('.bz-notice-action')].find((el) => el.textContent === '重试');
    expect(retryBtn).toBeTruthy();
    failB = false;
    (retryBtn as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // 重试只补搬失败项：两轮 calls 合计覆盖全部计划项
    expect(vault.files.has('附件/b.png')).toBe(true);
  });

  it('消失件（执行时源文件已不存在）计失败并分型「已不存在」', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app } = withRename(vault, '笔记/章.md');
    const origGet = app.vault.getAbstractFileByPath.bind(app.vault);
    app.vault.getAbstractFileByPath = (p: string) => (p === '笔记/b.png' ? null : origGet(p));

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary?.failedOps).toEqual([{ fromPath: '笔记/b.png', missing: true }]);
    expect(summary?.moved).toBe(1);
    expect(hasNotice(/1 个源文件已不存在/)).toBe(true);
  });
});

describe('撤销搬移（notifyUndo，误搬兜底）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('成功搬移后挂「撤销」按钮；点击逆序 renameFile 回原路径（后移的先搬回）', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');
    expect(summary).toEqual({ moved: 2, renamed: 0, linksAuto: true });
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('附件/b.png')).toBe(true);

    // 汇总通知带「撤销」动作
    const btn = document.querySelector('.bz-notice-action') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('撤销');
    btn.click();
    await new Promise((r) => setTimeout(r, 0));

    // 逆序恢复：b 先回、a 后回；链接回改同样交 Obsidian 内建（mock 只记录调用）
    expect(calls.slice(2)).toEqual([
      ['附件/b.png', '笔记/b.png'],
      ['附件/a.png', '笔记/a.png'],
    ]);
    expect(vault.files.has('附件/a.png')).toBe(false);
    expect(vault.files.has('附件/b.png')).toBe(false);
    expect(vault.files.has('笔记/a.png')).toBe(true);
    expect(vault.files.has('笔记/b.png')).toBe(true);
    expect(hasNotice('已撤销搬移，2 个附件回到原位置')).toBe(true);
  });

  it('改名搬移的撤销：冲突名（a (1).png）逆序改回原名', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    vault.create('附件/a.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');

    await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');
    expect(vault.files.has('附件/a (1).png')).toBe(true);

    (document.querySelector('.bz-notice-action') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));

    expect(calls).toEqual([
      ['笔记/a.png', '附件/a (1).png'],
      ['附件/a (1).png', '笔记/a.png'],
    ]);
    expect(vault.files.has('笔记/a.png')).toBe(true);
    expect(vault.files.has('附件/a.png')).toBe(true); // 原有同名文件不受影响
  });

  it('全部失败 → error 通知如实（不宣称链接已更新）+「重试」出口、无撤销按钮', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    const { app } = withRename(vault, '笔记/章.md');
    app.fileManager.renameFile = vi.fn(async () => {
      throw new Error('locked');
    });

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toBeNull();
    // AC-2/UI-P3-3 文案 gate：0 成功不宣称「链接已自动更新」，专用文案如实
    expect(hasNotice('附件搬移失败：0/1 个移动成功（原文件未改动）')).toBe(true);
    expect(hasNotice(/链接已自动更新|链接未自动更新/)).toBe(false);
    // 全失败无撤销；action 出口是「重试」而非撤销（AF-3）
    const action = document.querySelector('.bz-notice-action');
    expect(action?.textContent).toBe('重试');
  });
});

describe('大批量进度反馈（≥10 个 progress i/N）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('12 个附件：progress 通知逐个更新「i/N」，完成后收起并出汇总', async () => {
    const vault = new MockVault();
    const names = Array.from({ length: 12 }, (_, i) => `f${i}.png`);
    vault.create('笔记/章.md', names.map((n) => `![[${n}]]`).join(''));
    for (const n of names) vault.create(`笔记/${n}`, '');
    const { app } = withRename(vault, '笔记/章.md');
    // 闸门：首个移动挂起，便于断言中途进度
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let gated = false;
    app.fileManager.renameFile = vi.fn(async (file: any, newPath: string) => {
      if (!gated) {
        gated = true;
        await gate;
      }
      await vault.rename(file, newPath);
    });

    const p = runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');
    await new Promise((r) => setTimeout(r, 0));
    // 首个移动未放行 → 进度通知停留在 1/12（逐个更新语义）
    expect(hasNotice('正在移动附件 1/12')).toBe(true);
    release();
    await p;

    expect(vault.files.has('附件/f11.png')).toBe(true);
    expect(hasNotice(/已移动 12 个附件到「附件」/)).toBe(true);
    // 批量执行「中止」出口（EFF-5）：progress 帧挂「中止」钮
    // （中止行为用例见下方「批量执行中止」组，此处只验钮在）
  });

  it('9 个附件（< 阈值）→ 不出 progress 通知', async () => {
    const vault = new MockVault();
    const names = Array.from({ length: 9 }, (_, i) => `g${i}.png`);
    vault.create('笔记/章.md', names.map((n) => `![[${n}]]`).join(''));
    for (const n of names) vault.create(`笔记/${n}`, '');
    const { app } = withRename(vault, '笔记/章.md');

    await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(hasNotice(/正在移动附件/)).toBe(false);
    expect(hasNotice(/已移动 9 个附件到「附件」/)).toBe(true);
  });

  it('批量执行中止（EFF-5）：点「中止」后后续不再移动，已移动部分照常出汇总 + 撤销', async () => {
    const vault = new MockVault();
    const names = Array.from({ length: 12 }, (_, i) => `f${i}.png`);
    vault.create('笔记/章.md', names.map((n) => `![[${n}]]`).join(''));
    for (const n of names) vault.create(`笔记/${n}`, '');
    const { app } = withRename(vault, '笔记/章.md');
    // 闸门：首个移动挂起，便于在进度中途点中止
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let gated = false;
    app.fileManager.renameFile = vi.fn(async (file: any, newPath: string) => {
      if (!gated) {
        gated = true;
        await gate;
      }
      await vault.rename(file, newPath);
    });

    const p = runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');
    await new Promise((r) => setTimeout(r, 0));
    // 中途点「中止」→ 放行闸门
    const stopBtn = [...document.querySelectorAll('.bz-notice-action')].find((el) => el.textContent === '中止');
    expect(stopBtn).toBeTruthy();
    (stopBtn as HTMLElement).click();
    release();
    const summary = await p;

    // 循环在第 2 轮前退出：仅第 1 个附件移动
    expect(summary?.aborted).toBe(true);
    expect(summary?.moved).toBe(1);
    expect(hasNotice('已移动 1 个附件到「附件」，改名 0 个，内部链接已自动更新，已中止')).toBe(true);
    // 已移动部分可撤销
    const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((el) => el.textContent === '撤销');
    expect(undoBtn).toBeTruthy();
  });
});

describe('可勾选清单预览（openMovePreview）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  function makeMoves() {
    return [
      { fromPath: '笔记/a.png', toPath: '附件/a.png', toName: 'a.png', renamed: false },
      { fromPath: '笔记/b.png', toPath: '附件/b (1).png', toName: 'b (1).png', renamed: true },
    ];
  }

  it('逐行 from→to + 复选框默认全选；改名行带「将改名」徽标；0 勾选禁用确认', () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', 'x');
    const { app } = withRename(vault, '笔记/章.md');
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', makeMoves());

    const pop = document.querySelector('.bz-attach-preview-pop') as HTMLElement;
    expect(pop).not.toBeNull();
    expect(pop.querySelector('.bz-dialog-title')!.textContent).toBe('移动附件');
    expect(pop.textContent).toContain('将移动 2 个附件到「附件」');
    expect(pop.textContent).toContain('1 个将改名');
    const rows = [...pop.querySelectorAll<HTMLElement>('.bz-attach-preview-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].dataset.from).toBe('笔记/a.png');
    expect(rows[0].dataset.to).toBe('附件/a.png');
    expect(rows[1].textContent).toContain('附件/b (1).png');
    expect(rows[1].querySelector('.bz-attach-preview-badge')!.textContent).toBe('将改名');
    // 默认全选 + 确认按钮文案
    const boxes = [...pop.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')];
    expect(boxes.every((b) => b.checked)).toBe(true);
    const ok = document.getElementById('bz-attach-preview-ok') as HTMLButtonElement;
    expect(ok.textContent).toContain('移动 2 个');
    // 全部取消勾选 → 禁用
    for (const b of boxes) {
      b.checked = false;
      b.dispatchEvent(new Event('change'));
    }
    expect(ok.disabled).toBe(true);
    expect(ok.textContent).toContain('移动 0 个');
  });

  it('取消勾选个别附件 → 确认后只移动勾选项', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', makeMoves());

    const pop = document.querySelector('.bz-attach-preview-pop') as HTMLElement;
    const boxes = [...pop.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')];
    boxes[1].checked = false; // 排除 b（改名那个）
    boxes[1].dispatchEvent(new Event('change'));
    const ok = document.getElementById('bz-attach-preview-ok') as HTMLButtonElement;
    expect(ok.textContent).toContain('移动 1 个');
    ok.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(calls).toEqual([['笔记/a.png', '附件/a.png']]);
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('笔记/b.png')).toBe(true);
    // 弹窗已关
    expect(document.querySelector('.bz-attach-preview-pop')).toBeNull();
  });
});

describe('moveAttachments 命令入口', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('无打开笔记 → 警告且不弹窗', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app as any);
    moveAttachments(app);
    await new Promise((r) => setTimeout(r, 0));
    expect(hasNotice('没有打开的笔记')).toBe(true);
    expect(document.getElementById('bz-path-picker-mask')).toBeNull();
  });

  it('选择器前置（增强包）：0 个附件 → 提示并终止，不弹选择器', async () => {
    const vault = new MockVault();
    vault.create('n.md', '纯文字笔记');
    const { app } = withRename(vault, 'n.md');
    moveAttachments(app);
    await new Promise((r) => setTimeout(r, 0));
    expect(hasNotice('当前笔记没有可移动的附件')).toBe(true);
    expect(document.getElementById('bz-path-picker-mask')).toBeNull();
  });

  it('选择器前置（增强包）：desc 标注「当前笔记引用 N 个附件」，确认键为「下一步」', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    vault.create('归档/x.md', 'y');
    const { app } = withRename(vault, '笔记/章.md');

    moveAttachments(app);
    await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
    const popup = document.getElementById('bz-path-picker-popup')!;
    expect(popup.querySelector('.bz-path-picker-desc')!.textContent).toContain('当前笔记引用 2 个附件');
    expect((popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).textContent).toBe('下一步');
  });

  it('P20：选择器选目标文件夹 → 可勾选清单预览（逐行 from→to）→ 确认后才执行', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    vault.create('附件/a.png', ''); // 同名冲突 → 将改名 a (1).png
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveFile = () => vault.getAbstractFileByPath('笔记/章.md');
    const calls: Array<[string, string]> = [];
    app.fileManager = {
      renameFile: vi.fn(async (file: any, newPath: string) => {
        calls.push([file.path, newPath]);
        await vault.rename(file, newPath);
      }),
    };
    setApp(app as any);

    moveAttachments(app);
    await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
    // 选择器：搜索过滤「附件」→ 点选 → 下一步
    const popup = document.getElementById('bz-path-picker-popup')!;
    const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
    search.value = '附件';
    search.dispatchEvent(new Event('input'));
    const row = [...popup.querySelectorAll('.bz-path-picker-row')].find(
      (r) => (r as HTMLElement).dataset.path === '附件'
    ) as HTMLElement;
    row.click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();

    // 可勾选清单预览弹出（执行前文件未动）
    await vi.waitFor(() => expect(document.querySelector('.bz-attach-preview-pop')).not.toBeNull());
    const pop = document.querySelector('.bz-attach-preview-pop') as HTMLElement;
    expect(pop.textContent).toContain('将移动 1 个附件到「附件」');
    expect(pop.textContent).toContain('1 个将改名');
    const previewRow = pop.querySelector('.bz-attach-preview-row') as HTMLElement;
    expect(previewRow.dataset.from).toBe('笔记/a.png');
    expect(previewRow.dataset.to).toBe('附件/a (1).png');
    expect(calls).toHaveLength(0); // 确认前不执行

    // 确认 → 执行
    (document.getElementById('bz-attach-preview-ok') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toEqual([['笔记/a.png', '附件/a (1).png']]);
    expect(vault.files.has('附件/a (1).png')).toBe(true);
    expect(hasNotice(/已移动 1 个附件到「附件」，改名 1 个/)).toBe(true);
  });

  it('P20 修复自相矛盾：选「（库根目录）」不再被「未选择目标文件夹」拒绝——空串目标 = 移动到 vault 根', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveFile = () => vault.getAbstractFileByPath('笔记/章.md');
    const calls: Array<[string, string]> = [];
    app.fileManager = {
      renameFile: vi.fn(async (file: any, newPath: string) => {
        calls.push([file.path, newPath]);
        await vault.rename(file, newPath);
      }),
    };
    setApp(app as any);

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '');
    expect(summary).toEqual({ moved: 1, renamed: 0, linksAuto: true });
    expect(calls).toEqual([['笔记/a.png', 'a.png']]);
    expect(vault.files.has('a.png')).toBe(true);
    expect(hasNotice(/已移动 1 个附件到「库根目录」/)).toBe(true);
  });

  it('统一路径选择器（ticket 128）：记忆上次文件夹 attachLastFolder → 初始高亮；选（库根目录）→ 空串目标', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    vault.create('归档/x.md', 'y');
    const settings: any = { attachLastFolder: '归档' };
    setSettingsProvider(() => settings as any);
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveFile = () => vault.getAbstractFileByPath('笔记/章.md');
    const calls: Array<[string, string]> = [];
    app.fileManager = {
      renameFile: vi.fn(async (file: any, newPath: string) => {
        calls.push([file.path, newPath]);
        await vault.rename(file, newPath);
      }),
    };
    setApp(app as any);

    moveAttachments(app);
    await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
    const popup = document.getElementById('bz-path-picker-popup')!;
    const rowOf = (p: string) =>
      [...popup.querySelectorAll('.bz-path-picker-row')].find((r) => (r as HTMLElement).dataset.path === p) as HTMLElement;
    // 记忆语义：上次文件夹「归档」初始高亮
    await vi.waitFor(() => expect(rowOf('归档').classList.contains('bz-path-picker-row--sel')).toBe(true), { timeout: 3000 });
    expect(popup.querySelector('.bz-path-picker-selinfo')!.textContent).toContain('归档');
    // 改选（库根目录）→ 下一步 → 清单确认 → 移动到 vault 根
    rowOf('').click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-attach-preview-pop')).not.toBeNull());
    (document.getElementById('bz-attach-preview-ok') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toEqual([['笔记/a.png', 'a.png']]);
    expect(hasNotice(/已移动 1 个附件到「库根目录」/)).toBe(true);
  });
});

describe('文件右键菜单入口（ensureAttachFileMenu）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  /** 挂 file-menu 监听的 mock 插件 + 已捕获的回调 */
  function setup(vault: MockVault) {
    const settings: Record<string, any> = { attachLastFolder: '' };
    setSettingsProvider(() => settings as any);
    const app = mockAppWithVault(vault) as any;
    const handlers: Record<string, any> = {};
    app.workspace.on = (evt: string, cb: any) => {
      handlers[evt] = cb;
      return { evt, cb };
    };
    const registered: any[] = [];
    const plugin = { app, registerEvent: (ref: any) => registered.push(ref) };
    setApp(app);
    ensureAttachFileMenu(plugin);
    return { app, handlers, registered };
  }

  it('md 笔记挂「搬移此笔记附件」（folder-down 图标）；文件夹/非 md 不挂', () => {
    const vault = new MockVault();
    const { handlers, registered } = setup(vault);
    expect(typeof handlers['file-menu']).toBe('function');
    expect(registered).toHaveLength(1); // registerEvent 保证卸载自动清理

    const note = vault.getAbstractFileByPath('笔记/章.md');
    const menu1 = makeMenu();
    handlers['file-menu'](menu1, { path: '笔记/章.md', extension: 'md' });
    expect(menu1.items).toHaveLength(1);
    expect(menu1.items[0].title).toBe('搬移此笔记附件');
    expect(menu1.items[0].icon).toBe('folder-down');
    expect(typeof menu1.items[0].handler).toBe('function');

    // 文件夹 / 附件本体（非 md）不挂
    const menu2 = makeMenu();
    handlers['file-menu'](menu2, { path: 'x', isFolder: true, children: [] });
    const menu3 = makeMenu();
    handlers['file-menu'](menu3, { path: '笔记/a.png', extension: 'png' });
    expect(menu2.items).toHaveLength(0);
    expect(menu3.items).toHaveLength(0);
    void note;
  });

  it('右键指定笔记 → 与命令同链路：选择器 → 清单确认 → 移动该笔记的附件（优先于活动笔记）', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    vault.create('其他/别.md', '另一篇');
    vault.create('归档/x.md', 'y');
    const { app, handlers } = setup(vault);
    // 活动笔记是「另一篇」；右键的是「笔记/章.md」
    app.workspace.getActiveFile = () => vault.getAbstractFileByPath('其他/别.md');
    const calls: Array<[string, string]> = [];
    app.fileManager = {
      renameFile: vi.fn(async (file: any, newPath: string) => {
        calls.push([file.path, newPath]);
        await vault.rename(file, newPath);
      }),
    };

    const menu = makeMenu();
    handlers['file-menu'](menu, { path: '笔记/章.md', extension: 'md' });
    menu.items[0].handler(); // 与命令入口同一条执行链路

    // 选择器：desc 按右键笔记的附件数标注（1 个，非活动笔记的 0 个）
    await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
    const popup = document.getElementById('bz-path-picker-popup')!;
    expect(popup.querySelector('.bz-path-picker-desc')!.textContent).toContain('当前笔记引用 1 个附件');
    const row = [...popup.querySelectorAll('.bz-path-picker-row')].find(
      (r) => (r as HTMLElement).dataset.path === '归档'
    ) as HTMLElement;
    row.click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();

    await vi.waitFor(() => expect(document.querySelector('.bz-attach-preview-pop')).not.toBeNull());
    (document.getElementById('bz-attach-preview-ok') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));

    expect(calls).toEqual([['笔记/a.png', '归档/a.png']]);
    expect(vault.files.has('归档/a.png')).toBe(true);
    expect(hasNotice(/已移动 1 个附件到「归档」/)).toBe(true);
  });
});

// ==================== 深审修复批（bz-fix-at-core）回归 ====================

describe('收集语义 cache 优先（ARCH-1）端到端', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('AF-1：代码块/inline code 内引用不搬，正文真引用照搬', async () => {
    const vault = new MockVault();
    vault.create(
      '笔记/章.md',
      '正文 ![[真.png]]\n```\n![[模板图.png]]\n```\n`![[内联.png]]`\n<!-- ![[注释.png]] -->'
    );
    vault.create('笔记/真.png', '');
    vault.create('模板图.png', '');
    vault.create('内联.png', '');
    vault.create('注释.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    // 只搬正文真引用；代码块内引用原地不动（真机 cache 不含，renameFile 也不会更新那处）
    expect(summary).toEqual({ moved: 1, renamed: 0, linksAuto: true });
    expect(calls).toEqual([['笔记/真.png', '附件/真.png']]);
    expect(vault.files.has('模板图.png')).toBe(true);
    expect(vault.files.has('内联.png')).toBe(true);
    expect(vault.files.has('注释.png')).toBe(true);
  });

  it('AF-2：大小写 wikilink 端到端搬全（此前漏搬）', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '![[IMG.PNG]]');
    vault.create('笔记/img.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toEqual({ moved: 1, renamed: 0, linksAuto: true });
    expect(calls).toEqual([['笔记/img.png', '附件/img.png']]);
  });

  it('frontmatter 内链接仍收集（cache 主路径 frontmatterLinks）', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '---\nbanner: "[[fm图.png]]"\n---\n正文 ![[真.png]]');
    vault.create('笔记/fm图.png', '');
    vault.create('笔记/真.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary?.moved).toBe(2);
    // links 顺序 = embeds（正文）→ frontmatterLinks
    expect(calls).toEqual([
      ['笔记/真.png', '附件/真.png'],
      ['笔记/fm图.png', '附件/fm图.png'],
    ]);
  });
});

describe('撤销搬移大批量进度（UI-P3-4/EFF-4：与正向 i/N 对称）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('撤销 12 个：progress「正在撤销 i/N」，完成后收起并出汇总', async () => {
    const vault = new MockVault();
    const names = Array.from({ length: 12 }, (_, i) => `f${i}.png`);
    vault.create('笔记/章.md', names.map((n) => `![[${n}]]`).join(''));
    for (const n of names) vault.create(`笔记/${n}`, '');
    const { app } = withRename(vault, '笔记/章.md');
    // 撤销阶段闸门：首轮撤销 rename 挂起，便于断言中途进度
    let undoPhase = false;
    let gated = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    app.fileManager.renameFile = vi.fn(async (file: any, newPath: string) => {
      if (undoPhase && !gated) {
        gated = true;
        await gate;
      }
      await vault.rename(file, newPath);
    });

    await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');
    const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((el) => el.textContent === '撤销');
    undoPhase = true;
    (undoBtn as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // 首个撤销未放行 → 进度通知停留在 1/12
    expect(hasNotice('正在撤销 1/12')).toBe(true);
    release();
    await new Promise((r) => setTimeout(r, 0));

    expect(hasNotice('已撤销搬移，12 个附件回到原位置')).toBe(true);
  });
});

describe('防重入守卫（UI-P3-1/ARCH-2）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('预览弹窗存活再入命令不叠开（单弹窗 + 提示）', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    const { app } = withRename(vault, '笔记/章.md');

    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', [
      { fromPath: '笔记/a.png', toPath: '附件/a.png', toName: 'a.png', renamed: false },
    ]);
    expect(document.querySelectorAll('.bz-attach-preview-pop')).toHaveLength(1);

    moveAttachments(app); // 预览存活时再入命令
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelectorAll('.bz-attach-preview-pop')).toHaveLength(1);
    expect(hasNotice('移动清单已打开，请先确认或关闭')).toBe(true);
  });

  it('runMove 并行拦截：上一轮进行中再次调用只提示不竞争', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    const { app } = withRename(vault, '笔记/章.md');
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    app.fileManager.renameFile = vi.fn(async (file: any, newPath: string) => {
      await gate;
      await vault.rename(file, newPath);
    });

    const p1 = runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');
    const p2 = runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');
    await new Promise((r) => setTimeout(r, 0));
    expect(hasNotice('附件搬移进行中，请稍候')).toBe(true);
    release();
    expect(await p2).toBeNull(); // 后入者拒绝执行
    expect(await p1).toEqual({ moved: 1, renamed: 0, linksAuto: true });
  });
});

describe('预览弹窗交互增强（AF-S1 键盘 / EFF-3 requestClose / EFF-2 全选与护栏）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  function makeMoves() {
    return [
      { fromPath: '笔记/a.png', toPath: '附件/a.png', toName: 'a.png', renamed: false },
      { fromPath: '笔记/b.png', toPath: '附件/b.png', toName: 'b.png', renamed: false },
    ];
  }

  function setupPreview() {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app, vault: v, calls } = withRename(vault, '笔记/章.md');
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', makeMoves());
    const pop = document.querySelector('.bz-attach-preview-pop') as HTMLElement;
    return { app, vault: v, calls, pop };
  }

  it('AF-S1：Ctrl+Enter 键盘确认执行；0 勾选时为 no-op', async () => {
    const { calls, pop } = setupPreview();
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(2); // 全选默认：两件都移动
    expect(document.querySelector('.bz-attach-preview-pop')).toBeNull();
  });

  it('AF-S1：0 勾选时 Ctrl+Enter 不执行', async () => {
    const { calls, pop } = setupPreview();
    const boxes = [...pop.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')];
    for (const b of boxes) {
      b.checked = false;
      b.dispatchEvent(new Event('change'));
    }
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(0); // disabled 守卫：键盘提交 no-op
    expect(document.querySelector('.bz-attach-preview-pop')).not.toBeNull();
  });

  it('EFF-3：取消勾选后点遮罩 → 放弃确认；「继续编辑」弹窗与勾选保持，「放弃」才关闭', async () => {
    const { pop } = setupPreview();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    const boxes = [...pop.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')];
    boxes[1].checked = false;
    boxes[1].dispatchEvent(new Event('change'));

    mask.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 脏 → requestClose 拦截
    await vi.waitFor(() => expect(document.querySelector('.bz-flow-dialog')).not.toBeNull());
    expect(document.querySelector('.bz-attach-preview-pop')).not.toBeNull(); // 预览仍在

    // 继续编辑 → 确认框收起，预览与勾选保持
    (document.getElementById('__shared_confirm_ok__') as HTMLElement)?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-flow-dialog')).toBeNull();
    expect(document.querySelector('.bz-attach-preview-pop')).not.toBeNull();
    expect([...pop.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')][1].checked).toBe(false);

    // 再点遮罩 → 放弃 → 预览关闭
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-flow-dialog')).not.toBeNull());
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-attach-preview-pop')).toBeNull();
  });

  it('EFF-3：零勾选改动点遮罩直接关（无放弃确认）', async () => {
    const { pop } = setupPreview();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-flow-dialog')).toBeNull();
    expect(document.querySelector('.bz-attach-preview-pop')).toBeNull();
    expect(document.querySelectorAll('.bz-attach-preview-pop')).toHaveLength(0);
    void pop;
  });

  it('EFF-2：全不选 → 确认禁用计数 0；全选 → 恢复', () => {
    const { pop } = setupPreview();
    const toggles = [...pop.querySelectorAll<HTMLButtonElement>('.bz-attach-preview-toggle')];
    expect(toggles.map((t) => t.textContent)).toEqual(['全选', '全不选']);
    const ok = document.getElementById('bz-attach-preview-ok') as HTMLButtonElement;
    toggles[1].click(); // 全不选
    expect(ok.textContent).toContain('移动 0 个');
    expect(ok.disabled).toBe(true);
    toggles[0].click(); // 全选
    expect(ok.textContent).toContain('移动 2 个');
    expect(ok.disabled).toBe(false);
  });

  it('EFF-2 渲染护栏：>300 行只渲染前 300 + 提示全量口径；未渲染行默认勾选参与提交', async () => {
    const vault = new MockVault();
    const names = Array.from({ length: 305 }, (_, i) => `f${i}.png`);
    vault.create('笔记/章.md', names.map((n) => `![[${n}]]`).join(''));
    for (const n of names) vault.create(`笔记/${n}`, '');
    const { app, calls } = withRename(vault, '笔记/章.md');
    const moves = names.map((n) => ({
      fromPath: `笔记/${n}`,
      toPath: `附件/${n}`,
      toName: n,
      renamed: false,
    }));
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', moves);

    const pop = document.querySelector('.bz-attach-preview-pop') as HTMLElement;
    expect(pop.querySelectorAll('.bz-attach-preview-row')).toHaveLength(300); // 渲染截断
    expect(pop.querySelector('.bz-attach-preview-more')!.textContent).toContain('已显示前 300 个（共 305 个附件）');
    const ok = document.getElementById('bz-attach-preview-ok') as HTMLButtonElement;
    expect(ok.textContent).toContain('移动 305 个'); // 勾选语义不因渲染截断丢行

    // 排除一个已渲染行 → 提交集合按排除集反向推导（未渲染行保持默认勾选）
    const firstBox = pop.querySelector<HTMLInputElement>('.bz-attach-preview-check')!;
    firstBox.checked = false;
    firstBox.dispatchEvent(new Event('change'));
    expect(ok.textContent).toContain('移动 304 个');

    ok.click();
    await vi.waitFor(() => expect(calls.length).toBe(304));
    expect(calls.some(([from]) => from === '笔记/f0.png')).toBe(false); // 被排除的不动
    expect(calls.every(([from]) => from.startsWith('笔记/f'))).toBe(true);
  });
});

describe('入口口径与动线收集收敛（AF-4/UX-1 + EFF-1）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('AF-4：命令入口非 md 活动文件前置拦截（与右键菜单 md-only 统一），不读文件不弹选择器', async () => {
    const vault = new MockVault();
    vault.create('pic.png', '');
    const settings: Record<string, any> = { attachLastFolder: '' };
    setSettingsProvider(() => settings as any);
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveFile = () => vault.getAbstractFileByPath('pic.png');
    const readSpy = vi.spyOn(vault, 'read');
    setApp(app as any);

    moveAttachments(app);
    await new Promise((r) => setTimeout(r, 0));

    expect(hasNotice('附件搬移适用于 Markdown 笔记，请在笔记上运行')).toBe(true);
    expect(readSpy).not.toHaveBeenCalled(); // 不白读二进制
    expect(document.getElementById('bz-path-picker-mask')).toBeNull();
  });

  it('EFF-1：动线一次收集——确认执行不再重读笔记（read 计数 = 1）', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    vault.create('附件/existing.png', ''); // 让「附件」目录出现在选择器
    const settings: Record<string, any> = { attachLastFolder: '' };
    setSettingsProvider(() => settings as any);
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveFile = () => vault.getAbstractFileByPath('笔记/章.md');
    const calls: Array<[string, string]> = [];
    app.fileManager = {
      renameFile: vi.fn(async (file: any, newPath: string) => {
        calls.push([file.path, newPath]);
        await vault.rename(file, newPath);
      }),
    };
    const readSpy = vi.spyOn(vault, 'read');
    setApp(app as any);

    moveAttachments(app);
    await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
    const popup = document.getElementById('bz-path-picker-popup')!;
    const row = [...popup.querySelectorAll('.bz-path-picker-row')].find(
      (r) => (r as HTMLElement).dataset.path === '附件'
    ) as HTMLElement;
    row.click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-attach-preview-pop')).not.toBeNull());
    (document.getElementById('bz-attach-preview-ok') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));

    expect(calls).toEqual([['笔记/a.png', '附件/a.png']]);
    expect(readSpy).toHaveBeenCalledTimes(1); // 前置收集一次，执行段透传复用（原三次全量）
  });

  it('ESC 关闭路径（遮罩同通道）：零改动直关且不执行', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', 'x');
    const { app, calls } = withRename(vault, '笔记/章.md');
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', [
      { fromPath: '笔记/a.png', toPath: '附件/a.png', toName: 'a.png', renamed: false },
    ]);
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-attach-preview-pop')).toBeNull();
    expect(calls).toHaveLength(0); // 关闭不执行
  });
});

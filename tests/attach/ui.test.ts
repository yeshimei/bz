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
    expect(hasNotice(/已移动 2 个资源到 附件，改名 0 个，内部链接已自动更新/)).toBe(true);
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

  it('无资源可移动 → info 通知且不执行', async () => {
    const vault = new MockVault();
    vault.create('n.md', 'hello [[other]]');
    vault.create('other.md', 'x');
    const { app, calls } = withRename(vault, 'n.md');
    const res = await runMove(app, vault.getAbstractFileByPath('n.md'), '附件');
    expect(res).toBeNull();
    expect(calls).toHaveLength(0);
    expect(hasNotice('当前笔记没有可移动的资源文件')).toBe(true);
  });

  it('资源已在目标文件夹 → 提示且不重复移动', async () => {
    const vault = new MockVault();
    vault.create('附件/a.png', '');
    vault.create('n.md', '![[a.png]]');
    const { app, calls } = withRename(vault, 'n.md');
    const res = await runMove(app, vault.getAbstractFileByPath('n.md'), '附件');
    expect(res).toBeNull();
    expect(calls).toHaveLength(0);
    expect(hasNotice('资源已全部在目标文件夹')).toBe(true);
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
    expect(hasNotice(/已移动 1 个资源到 附件，改名 0 个，链接未自动更新/)).toBe(true);
  });

  it('回归（P2 口径）：部分移动失败 → moved 只计成功数，通知文案与实际一致', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app } = withRename(vault, '笔记/章.md');
    // 注入：第二个附件移动失败
    app.fileManager.renameFile = vi.fn(async (file: any, newPath: string) => {
      if (file.path === '笔记/b.png') throw new Error('locked by user');
      await vault.rename(file, newPath);
    });

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    // moved = 计划数 − 失败数 = 1（旧实现误报 moves.length=2）
    expect(summary).toEqual({ moved: 1, renamed: 0, linksAuto: true });
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('笔记/b.png')).toBe(true); // 失败的原文件未动
    expect(hasNotice('已移动 1 个资源到 附件，改名 0 个，内部链接已自动更新，失败 1 个')).toBe(true);
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

  it('全部失败 → error 通知、无撤销按钮', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    const { app } = withRename(vault, '笔记/章.md');
    app.fileManager.renameFile = vi.fn(async () => {
      throw new Error('locked');
    });

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toBeNull();
    expect(hasNotice(/已移动 0 个资源到 附件/)).toBe(true);
    expect(document.querySelector('.bz-notice-action')).toBeNull(); // 无可撤销项不挂撤销
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
    expect(hasNotice(/已移动 12 个资源到 附件/)).toBe(true);
  });

  it('9 个附件（< 阈值）→ 不出 progress 通知', async () => {
    const vault = new MockVault();
    const names = Array.from({ length: 9 }, (_, i) => `g${i}.png`);
    vault.create('笔记/章.md', names.map((n) => `![[${n}]]`).join(''));
    for (const n of names) vault.create(`笔记/${n}`, '');
    const { app } = withRename(vault, '笔记/章.md');

    await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(hasNotice(/正在移动附件/)).toBe(false);
    expect(hasNotice(/已移动 9 个资源到 附件/)).toBe(true);
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
    expect(hasNotice('当前笔记没有可移动的资源文件')).toBe(true);
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
    expect(hasNotice(/已移动 1 个资源到 附件，改名 1 个/)).toBe(true);
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
    expect(hasNotice(/已移动 1 个资源到 库根目录/)).toBe(true);
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
    expect(hasNotice(/已移动 1 个资源到 库根目录/)).toBe(true);
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
    expect(hasNotice(/已移动 1 个资源到 归档/)).toBe(true);
  });
});

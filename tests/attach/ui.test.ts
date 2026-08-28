/**
 * 附件搬移域 UI / 执行层测试（ticket 65；ticket 128 起目标文件夹改用统一路径选择器 core/path-picker）。
 * 移动经 app.fileManager.renameFile（Obsidian 内建，自动更新内部链接），
 * mock 里 renameFile 只负责在 MockVault 中移动（链接更新是 Obsidian 内部职责）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { clearNotices, hasNotice } from '../mock-obsidian-entry';
import { runMove, moveAttachments } from '../../src/attach/ui';
import { ensureAttachSeed } from '../../src/attach/index';

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

  it('无 fileManager（异常环境）→ 回退 vault.rename，通知链接未自动更新', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '![[a.png]]');
    vault.create('笔记/a.png', '');
    const settings: Record<string, any> = { attachLastFolder: '' };
    setSettingsProvider(() => settings as any);
    const app = makeApp(vault, '笔记/章.md');
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

describe('moveAttachments 命令入口', () => {
  it('无打开笔记 → 警告且不弹窗', () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app as any);
    clearNotices();
    moveAttachments(app);
    expect(hasNotice('没有打开的笔记')).toBe(true);
    expect(document.getElementById('bz-path-picker-mask')).toBeNull();
  });

  it('P20：统一路径选择器选目标文件夹 → 先弹预览确认「将移动 N 个、改名 M 个」→ 确认后才执行', async () => {
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
    await new Promise((r) => setTimeout(r, 0));
    const mask = document.getElementById('bz-path-picker-mask')!;
    expect(mask).not.toBeNull();
    // 选择器：上一次记忆为空 → 「未选择」；搜索过滤「附件」→ 点选 → 确定
    const popup = document.getElementById('bz-path-picker-popup')!;
    const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
    search.value = '附件';
    search.dispatchEvent(new Event('input'));
    const row = [...popup.querySelectorAll('.bz-path-picker-row')].find(
      (r) => (r as HTMLElement).dataset.path === '附件'
    ) as HTMLElement;
    row.click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();

    // 预览确认弹出（执行前文件未动）
    await new Promise((r) => setTimeout(r, 30));
    const confirmMask = document.getElementById('__shared_confirm_mask__') as HTMLElement;
    expect(confirmMask).not.toBeNull();
    expect(confirmMask.textContent).toContain('将移动 1 个资源到「附件」');
    expect(confirmMask.textContent).toContain('1 个将改名');
    expect(calls).toHaveLength(0); // 确认前不执行

    // 确认 → 执行
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
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
    await new Promise((r) => setTimeout(r, 60));
    const popup = document.getElementById('bz-path-picker-popup')!;
    const rowOf = (p: string) =>
      [...popup.querySelectorAll('.bz-path-picker-row')].find((r) => (r as HTMLElement).dataset.path === p) as HTMLElement;
    // 记忆语义：上次文件夹「归档」初始高亮
    await vi.waitFor(() => expect(rowOf('归档').classList.contains('bz-path-picker-row--sel')).toBe(true), { timeout: 3000 });
    expect(popup.querySelector('.bz-path-picker-selinfo')!.textContent).toContain('归档');
    // 改选（库根目录）→ 确定 → 预览确认 → 移动到 vault 根
    rowOf('').click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 60));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toEqual([['笔记/a.png', 'a.png']]);
    expect(hasNotice(/已移动 1 个资源到 库根目录/)).toBe(true);
  });
});

describe('ensureAttachSeed 主页磁贴播种', () => {
  it('缺磁贴时 desktop+mobile 各追加一条（末尾、1×1），幂等', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    await ensureAttachSeed(app);
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/launcher.json') as string);
    const desktop = data.desktop.tiles;
    const mobile = data.mobile.tiles;
    expect(desktop.filter((t: any) => t.commandId === 'bz-attach-move')).toHaveLength(1);
    expect(mobile.filter((t: any) => t.commandId === 'bz-attach-move')).toHaveLength(1);
    expect(desktop[0]).toMatchObject({ commandId: 'bz-attach-move', x: 0, y: 0, w: 1, h: 1 });
    expect(desktop[0].id).toMatch(/^lt-/);
    await ensureAttachSeed(app);
    const again = JSON.parse(vault.files.get('CONFIG/STORAGE/launcher.json') as string);
    expect(again.desktop.tiles.filter((t: any) => t.commandId === 'bz-attach-move')).toHaveLength(1);
    expect(again.mobile.tiles.filter((t: any) => t.commandId === 'bz-attach-move')).toHaveLength(1);
  });
});
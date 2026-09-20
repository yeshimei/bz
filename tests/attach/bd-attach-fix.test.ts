/**
 * 附件搬移拍板修复批回归（bd-fix-bd-checkup-attach，独立命名防撞）：
 * - AT1（呈报#64）：动作动词全线统一「搬移」——命令名（main.ts attach 行）/预览弹窗
 *   标题与按钮/通知文案不再有「移动」残留；
 * - AT3（呈报#34）：附件已全部在上次目标时，进选择器前先预告终止（「不用了」/「换个文件夹」双出口）；
 * - AT2（呈报#11）：预览弹窗「跳过预览直接搬（本会话）」快捷出口——本次按当前勾选照常执行，
 *   会话旗标置位后后续搬移选完文件夹直接执行不再弹预览。
 * 顺序注意：AT2 用例置位模块级会话旗标，必须放在本文件最后（模块态同文件共享）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { clearNotices, hasNotice } from '../mock-obsidian-entry';
import { runMove, moveAttachments, openMovePreview } from '../../src/attach/ui';

function makeApp(vault: MockVault, activePath?: string) {
  const app = mockAppWithVault(vault) as any;
  app.workspace.getActiveFile = () => (activePath ? vault.getAbstractFileByPath(activePath) : null);
  return app;
}

/** 带 Obsidian 式 fileManager.renameFile 的 app（记录调用参数并实际移动） */
function withRename(vault: MockVault, active: string, lastFolder = '') {
  const settings: Record<string, any> = { attachLastFolder: lastFolder };
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

/** 选择器：过滤出目标文件夹并确认（「下一步」） */
async function pickFolder(path: string) {
  await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
  const popup = document.getElementById('bz-path-picker-popup')!;
  const search = popup.querySelector('.bz-path-picker-search') as HTMLInputElement;
  search.value = path;
  search.dispatchEvent(new Event('input'));
  const row = [...popup.querySelectorAll('.bz-path-picker-row')].find(
    (r) => (r as HTMLElement).dataset.path === path
  ) as HTMLElement;
  row.click();
  (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
}

describe('AT1 动词统一「搬移」（呈报#64）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('main.ts attach 命令名为「搬移附件」，不再有「移动附件」', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(main).toMatch(/name: '搬移附件'/);
    expect(main).not.toMatch(/name: '移动附件'/);
  });

  it('预览弹窗标题/汇总行/确认钮全线「搬移」；通知不再出现「已移动」', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', [
      { fromPath: '笔记/a.png', toPath: '附件/a.png', toName: 'a.png', renamed: false },
      { fromPath: '笔记/b.png', toPath: '附件/b.png', toName: 'b.png', renamed: false },
    ]);
    const pop = document.querySelector('.bz-attach-preview-pop') as HTMLElement;
    expect(pop.querySelector('.bz-dialog-title')!.textContent).toBe('搬移附件');
    expect(pop.textContent).toContain('将搬移 2 个附件到「附件」');
    const ok = document.getElementById('bz-attach-preview-ok') as HTMLButtonElement;
    expect(ok.textContent).toContain('搬移 2 个');
    ok.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(2);
    // 全线动词守卫：通知是「已搬移」，无「已移动」残留
    expect(hasNotice(/已搬移 2 个附件到「附件」/)).toBe(true);
    expect(hasNotice(/已移动/)).toBe(false);
  });
});

describe('AT3 已全部在上次目标前置预告（呈报#34）', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('附件均在上次目标 → 预告弹窗（不弹选择器）；「不用了」终止', async () => {
    const vault = new MockVault();
    vault.create('n.md', '![[a.png]]');
    vault.create('附件/a.png', '');
    const { app, calls } = withRename(vault, 'n.md', '附件');
    moveAttachments(app);
    // 修复前必红口径：旧实现直接弹选择器，走完两步才知道「搬了个寂寞」
    await vi.waitFor(() => expect(document.querySelector('.bz-flow-dialog')).not.toBeNull());
    const dialog = document.querySelector('.bz-flow-dialog') as HTMLElement;
    expect(dialog.textContent).toContain('均已在上次目标「附件」');
    expect(dialog.textContent).toContain('要搬到其他文件夹吗？');
    expect(document.getElementById('bz-path-picker-mask')).toBeNull();
    // 「不用了」→ 终止，不执行任何搬移
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(0);
    expect(document.getElementById('bz-path-picker-mask')).toBeNull();
  });

  it('预告弹窗点「换个文件夹」→ 选择器照常打开（改投他处出路保留）', async () => {
    const vault = new MockVault();
    vault.create('n.md', '![[a.png]]');
    vault.create('附件/a.png', '');
    vault.create('归档/x.md', 'y');
    const { app } = withRename(vault, 'n.md', '附件');
    moveAttachments(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-flow-dialog')).not.toBeNull());
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
  });

  it('并非全部在上次目标 → 不预告，直接进选择器（常态动线不受扰）', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '![[a.png]] ![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('附件/b.png', '');
    const { app } = withRename(vault, '笔记/章.md', '附件');
    moveAttachments(app);
    await vi.waitFor(() => expect(document.getElementById('bz-path-picker-popup')).not.toBeNull());
    expect(document.querySelector('.bz-flow-dialog')).toBeNull();
  });
});

describe('AT2 跳过预览直接搬（呈报#11）——置位会话旗标，放文件最后', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('「跳过预览直接搬（本会话）」：本次按当前勾选立即执行；0 勾选同确认钮禁用', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', [
      { fromPath: '笔记/a.png', toPath: '附件/a.png', toName: 'a.png', renamed: false },
      { fromPath: '笔记/b.png', toPath: '附件/b.png', toName: 'b.png', renamed: false },
    ]);
    const pop = document.querySelector('.bz-attach-preview-pop') as HTMLElement;
    const skip = document.getElementById('bz-attach-preview-skip') as HTMLButtonElement;
    expect(skip).toBeTruthy();
    expect(skip.disabled).toBe(false);
    // 0 勾选：与确认钮同禁
    for (const b of [...pop.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')]) {
      b.checked = false;
      b.dispatchEvent(new Event('change'));
    }
    expect(skip.disabled).toBe(true);
    for (const b of [...pop.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')]) {
      b.checked = true;
      b.dispatchEvent(new Event('change'));
    }
    // 点击 → 立即执行（不再有第二段确认），弹窗关闭
    skip.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([
      ['笔记/a.png', '附件/a.png'],
      ['笔记/b.png', '附件/b.png'],
    ]);
    expect(document.querySelector('.bz-attach-preview-pop')).toBeNull();
  });

  it('会话旗标生效：后续搬移选完文件夹直接执行，不再弹预览清单', async () => {
    const vault = new MockVault();
    // 三个附件：首轮预览只搬 a、b（跳过预览出口），二轮增量 c 免预览直搬
    vault.create('笔记/章.md', '图：![[a.png]] 图：![[b.png]] 图：![[c.png]]');
    vault.create('笔记/a.png', '');
    vault.create('笔记/b.png', '');
    vault.create('笔记/c.png', '');
    const { app, calls } = withRename(vault, '笔记/章.md');
    openMovePreview(app, vault.getAbstractFileByPath('笔记/章.md'), '附件', [
      { fromPath: '笔记/a.png', toPath: '附件/a.png', toName: 'a.png', renamed: false },
      { fromPath: '笔记/b.png', toPath: '附件/b.png', toName: 'b.png', renamed: false },
    ]);
    (document.getElementById('bz-attach-preview-skip') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(2);

    // 二轮：常规命令动线 → 选择器选「附件」→ 确认后不弹预览直接执行（只剩 c 待搬）
    moveAttachments(app);
    await pickFolder('附件');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.bz-attach-preview-pop')).toBeNull(); // 修复前必红：此处会弹预览
    expect(calls).toEqual([
      ['笔记/a.png', '附件/a.png'],
      ['笔记/b.png', '附件/b.png'],
      ['笔记/c.png', '附件/c.png'],
    ]);
    expect(hasNotice(/已搬移 1 个附件到「附件」/)).toBe(true);
  });
});

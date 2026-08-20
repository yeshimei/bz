/**
 * 附件搬移域 UI / 执行层测试（ticket 65）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { clearNotices, hasNotice } from '../mock-obsidian-entry';
import { runMove, moveAttachments, FolderSelectModal } from '../../src/attach/ui';
import { ensureAttachSeed } from '../../src/attach/index';

function makeApp(vault: MockVault, activePath?: string) {
  const app = mockAppWithVault(vault) as any;
  app.workspace.getActiveFile = () => (activePath ? vault.getAbstractFileByPath(activePath) : null);
  return app;
}

function withSettings(vault: MockVault, active: string, extra?: Record<string, any>) {
  const settings: Record<string, any> = { attachLastFolder: '', ...extra };
  setSettingsProvider(() => settings as any);
  const app = makeApp(vault, active);
  setApp(app as any);
  return { app, vault, settings };
}

describe('runMove 执行编排', () => {
  beforeEach(() => {
    clearNotices();
    document.body.innerHTML = '';
    setSettingsSaver(async () => {});
  });

  it('移动附件 + 全库改写 wikilink 与 md 链接 + 记忆文件夹', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]] 见 [[note2]] 与 ![x](assets/b.png)');
    vault.create('笔记/a.png', '');
    vault.create('assets/b.png', '');
    vault.create('note2.md', '');
    vault.create('其他.md', '也引用 ![[a.png]]');
    const { app, settings } = withSettings(vault, '笔记/章.md');

    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toEqual({ moved: 2, renamed: 0, links: 3, notes: 2 });
    expect(vault.files.has('笔记/a.png')).toBe(false);
    expect(vault.files.has('assets/b.png')).toBe(false);
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('附件/b.png')).toBe(true);
    expect(vault.files.get('笔记/章.md')).toBe('图：![[附件/a.png]] 见 [[note2]] 与 ![x](附件/b.png)');
    expect(vault.files.get('其他.md')).toBe('也引用 ![[附件/a.png]]');
    expect(settings.attachLastFolder).toBe('附件');
    expect(hasNotice(/已移动 2 个资源到 附件/)).toBe(true);
  });

  it('目标已有同名文件才改名，已存在文件保留', async () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', '图：![[a.png]]');
    vault.create('笔记/a.png', '');
    vault.create('附件/a.png', '');
    vault.create('引用.md', '引用 ![[a.png]]');
    const { app } = withSettings(vault, '笔记/章.md');

    // 笔记旁资源就近解析成功；库根 引用.md 的 a.png 前后均含糊（笔记/附件两处）→ 保守不改写
    const summary = await runMove(app, vault.getAbstractFileByPath('笔记/章.md'), '附件');

    expect(summary).toEqual({ moved: 1, renamed: 1, links: 1, notes: 1 });
    expect(vault.files.has('笔记/a.png')).toBe(false);
    expect(vault.files.has('附件/a.png')).toBe(true);
    expect(vault.files.has('附件/a (1).png')).toBe(true);
    expect(vault.files.get('笔记/章.md')).toBe('图：![[附件/a (1).png]]');
    expect(vault.files.get('引用.md')).toBe('引用 ![[a.png]]');
  });

  it('无资源可移动 → info 通知且不执行', async () => {
    const vault = new MockVault();
    vault.create('n.md', 'hello [[other]]');
    vault.create('other.md', 'x');
    const { app } = withSettings(vault, 'n.md');
    const res = await runMove(app, vault.getAbstractFileByPath('n.md'), '附件');
    expect(res).toBeNull();
    expect(hasNotice('当前笔记没有可移动的资源文件')).toBe(true);
  });

  it('资源已在目标文件夹 → 提示且不重复移动', async () => {
    const vault = new MockVault();
    vault.create('附件/a.png', '');
    vault.create('n.md', '![[a.png]]');
    const { app } = withSettings(vault, 'n.md');
    const res = await runMove(app, vault.getAbstractFileByPath('n.md'), '附件');
    expect(res).toBeNull();
    expect(hasNotice('资源已全部在目标文件夹')).toBe(true);
  });
});

describe('moveAttachments 命令入口', () => {
  it('无打开笔记 → 警告且不弹窗', () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app as any);
    clearNotices();
    void moveAttachments(app);
    expect(hasNotice('没有打开的笔记')).toBe(true);
    expect(document.getElementById('bz-attach-folder-mask')).toBeNull();
  });
});

describe('FolderSelectModal 文件夹选择弹窗', () => {
  it('打开弹窗、预填上次文件夹、列出目录、提交回调', () => {
    const vault = new MockVault();
    vault.create('笔记/章.md', 'x');
    vault.create('归档/a.md', 'y');
    vault.create('z.png', '');
    const settings: any = { attachLastFolder: '归档' };
    setSettingsProvider(() => settings as any);
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveFile = () => vault.getAbstractFileByPath('笔记/章.md');
    setApp(app as any);

    let picked = '';
    const modal = new FolderSelectModal(app, (f) => (picked = f));
    modal.open();

    const mask = document.getElementById('bz-attach-folder-mask');
    expect(mask).not.toBeNull();
    const input = document.querySelector('.bz-attach-input') as HTMLInputElement;
    expect(input.value).toBe('归档');
    const items = Array.from(document.querySelectorAll('.bz-attach-folder-item')).map((el) => el.textContent);
    expect(items).toContain('（库根目录）');
    expect(items).toContain('笔记');
    expect(items).toContain('归档');
    // 输入过滤：只留匹配目录
    input.value = '笔';
    input.dispatchEvent(new Event('input'));
    const filtered = Array.from(document.querySelectorAll('.bz-attach-folder-item')).map((el) => el.textContent);
    expect(filtered.filter((t) => t !== '（库根目录）')).toEqual(['笔记']);
    input.value = '附件';
    (document.querySelector('.bz-attach-btn--primary') as HTMLButtonElement).click();
    expect(picked).toBe('附件');
    expect(document.getElementById('bz-attach-folder-mask')).toBeNull();
    modal.close();
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
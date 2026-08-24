/**
 * 覆盖率补测：quote 命令注册（写日记命令幂等 + 回调）与 diary/app 注入守卫。
 * 独立文件：quote 的 diaryCommandRegistered 是模块级状态，须在未 init 面板的干净注册表中验证。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { getApp, setApp } from '../../../src/diary/app';
import { registerOpenDialogCommand } from '../../../src/diary/ui/quote';
import { createAddDialog } from '../../../src/diary/ui/dialogs';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { resetObsidianMocks } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';

beforeEach(() => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
});

describe('diary/app 注入守卫', () => {
  it('未注入时 getApp 抛出明确错误', () => {
    // 模块级 app 默认 null（本文件独立注册表，未执行过 setApp）
    expect(() => getApp()).toThrow('app 尚未注入');
  });

  it('setApp(null) 后同样抛错；注入后返回同一实例', () => {
    setApp(null as any);
    expect(() => getApp()).toThrow('app 尚未注入');
    const app = { vault: {} } as any;
    setApp(app);
    expect(getApp()).toBe(app);
  });
});

describe('写日记命令注册（quote）', () => {
  it('registerOpenDialogCommand 幂等：重复调用只注册一次 bz-diary-write；回调打开写日记弹窗', async () => {
    const vault = new MockVault();
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n内容\n');
    setApp(mockAppWithVault(vault));

    createAddDialog(); // 弹窗 DOM 先就位（init 流程中由 panel 创建）
    await registerOpenDialogCommand();
    await registerOpenDialogCommand();

    const registered = (getApp() as any).commands.registered as any[];
    const writeCmds = registered.filter((c) => c.id === 'bz-diary-write');
    expect(writeCmds.length).toBe(1);
    expect(writeCmds[0].name).toBe('写日记');

    // 回调 = openAddDialog：遮罩与弹窗显示
    writeCmds[0].callback();
    expect(document.getElementById('add-diary-mask')!.style.display).toBe('block');
    expect(document.getElementById('add-diary-popup')!.style.display).toBe('block');
  });
});

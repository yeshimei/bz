/**
 * 文献盒面板 UI 测试（src/bili-downloader/ui.ts）：
 * 主窗口结构（正名「文献盒」+ ⬇️ 下载按钮钩子）、空态/行渲染与状态徽标、添加/编辑弹窗与校验、
 * 点击分流、行内详细进度（[bz-step]/[bz-p] 时间线+百分比+耗时）、移动端仅暂存、destroy 清理。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { Platform } from 'obsidian';
import { UIManager, biliTasksSettingsSchema } from '../../src/bili-downloader/ui';
import { TasksData } from '../../src/bili-downloader/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { clearNotices, getNoticeMessages, resetObsidianMocks } from '../mock-obsidian-entry';

function strNotices(): string {
  return getNoticeMessages().join('\n');
}

function makeApp(vault: MockVault) {
  const openFile = vi.fn();
  const app = {
    vault,
    workspace: { getLeaf: () => ({ openFile }) },
    commands: {},
  };
  setApp(app as any);
  return { app, openFile };
}

describe('文献盒面板 UI', () => {
  let vault: MockVault;
  let openFile: ReturnType<typeof vi.fn>;
  let ui: UIManager;

  beforeEach(() => {
    resetObsidianMocks();
    vault = new MockVault();
    ({ openFile } = makeApp(vault));
    TasksData.init({ storagePath: 'CONFIG/STORAGE' });
    clearNotices();
    ui = new UIManager({} as any);
  });

  afterEach(() => {
    ui.destroy();
    (Platform as any).isMobile = false;
    document.body.innerHTML = '';
  });

  it('showMain 渲染主窗口：标题文献盒/头部行/关闭按钮/空态提示', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.getElementById('bili-tasks-popup')).toBeTruthy());
    const popup = document.getElementById('bili-tasks-popup')!;
    expect(popup.querySelector('.bz-win-head h3')!.textContent).toBe('文献盒');
    expect(popup.querySelector('.bz-win-head')).toBeTruthy();
    expect(popup.querySelector('.bz-win-close')).toBeTruthy();
    expect(popup.querySelector('#bili-btn-settings')).toBeTruthy();
    expect(popup.querySelector('#bili-btn-run')).toBeTruthy();
    expect(popup.querySelector('#bili-btn-download')).toBeTruthy();
    await vi.waitFor(() => expect(document.getElementById('bili-tasks-list')!.textContent).toContain('暂无转文献任务'));
  });

  it('行渲染：状态徽标（待处理/处理中/成功/失败）+ 时间范围 + 进度文案', async () => {
    const t1 = await TasksData.addTask({ url: 'BV1xx411c7mD', start: '1:02:03', end: '1:05:00', remark: '重点段' });
    await TasksData.updateTask(t1.id, { status: 'processing', reason: '下载中…' } as any);
    const t2 = await TasksData.addTask({ url: 'BV1xx411c7mE' });
    await TasksData.updateTask(t2.id, { status: 'success', notePath: '文献盒/测试.md' } as any);
    const t3 = await TasksData.addTask({ url: 'BV1xx411c7mF' });
    await TasksData.updateTask(t3.id, { status: 'failed', reason: '视频已删除' } as any);
    await TasksData.addTask({ url: 'BV1xx411c7mG' }); // 保留一条待处理
    await ui.refreshPanel();
    const list = document.getElementById('bili-tasks-list')!;
    const txt = list.textContent!;
    expect(txt).toContain('待处理');
    expect(txt).toContain('处理中');
    expect(txt).toContain('成功');
    expect(txt).toContain('失败');
    expect(txt).toContain('BV1xx411c7mD');
    expect(txt).toContain('1:02:03 ~ 1:05:00');
    expect(txt).toContain('重点段');
    expect(txt).toContain('下载中…');   // 行内进度文案
    expect(txt).toContain('视频已删除'); // 失败原因
    expect(txt).toContain('文献盒/测试.md');
  });

  it('空列表无处理按钮联动：处理按钮禁用 + 无待处理提示', async () => {
    await ui.refreshPanel();
    const run = document.getElementById('bili-btn-run') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    const r = await TasksData.addTask({ url: 'BV1xx411c7mD' });
    await ui.refreshPanel();
    expect((document.getElementById('bili-btn-run') as HTMLButtonElement).disabled).toBe(false);
    await TasksData.updateTask(r.id, { status: 'success' } as any);
    await ui.refreshPanel();
    expect((document.getElementById('bili-btn-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('添加弹窗：保存成功入库 + 字段回填（编辑态）', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 0));
    (document.getElementById('bili-btn-add') as HTMLButtonElement)!.click();
    const popup = document.getElementById('bili-add-popup')!;
    expect(popup.style.display).toBe('flex');
    (document.getElementById('bili-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1xx411c7mD';
    (document.getElementById('bili-add-start') as HTMLInputElement).value = '0:30';
    (document.getElementById('bili-add-end') as HTMLInputElement).value = '2:10';
    (document.getElementById('bili-add-remark') as HTMLInputElement).value = '精讲';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('已保存'));
    let all = await TasksData.loadTasks();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', start: '0:30', end: '2:10', remark: '精讲', status: 'pending' });
    // 点击待处理行 → 编辑回填
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    expect(popup.style.display).toBe('flex');
    expect((document.getElementById('bili-add-url') as HTMLInputElement).value).toContain('BV1xx411c7mD');
    // 改备注保存 → 更新而非新增
    (document.getElementById('bili-add-remark') as HTMLInputElement).value = '改过';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(async () => {
      all = await TasksData.loadTasks();
      expect(all[0].remark).toBe('改过');
    });
    expect(all).toHaveLength(1);
  });

  it('添加校验：缺链接 / 时间格式错 / 起止不成对', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 0));
    (document.getElementById('bili-btn-add') as HTMLButtonElement)!.click();
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('请填写视频链接或 BV 号'));
    clearNotices();
    (document.getElementById('bili-add-url') as HTMLInputElement).value = 'BV1xx411c7mD';
    (document.getElementById('bili-add-start') as HTMLInputElement).value = 'abc';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('时间格式'));
    clearNotices();
    (document.getElementById('bili-add-start') as HTMLInputElement).value = '';
    (document.getElementById('bili-add-end') as HTMLInputElement).value = '1:00';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('成对填写'));
    expect((await TasksData.loadTasks())).toHaveLength(0);
  });

  it('点击分流：成功项打开文献笔记', async () => {
    const t = await TasksData.addTask({ url: 'BV1xx411c7mD' });
    await TasksData.updateTask(t.id, { status: 'success', notePath: '文献盒/测试.md' } as any);
    vault.files.set('文献盒/测试.md', '# 测试');
    await ui.refreshPanel();
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    expect(openFile).toHaveBeenCalledTimes(1);
  });

  it('移动端仅暂存：处理/下载/中止/清空按钮隐藏', () => {
    ui.destroy();
    (Platform as any).isMobile = true;
    ui = new UIManager({} as any);
    expect((document.getElementById('bili-btn-run') as HTMLButtonElement).style.display).toBe('none');
    expect((document.getElementById('bili-btn-download') as HTMLButtonElement).style.display).toBe('none');
    expect((document.getElementById('bili-btn-abort') as HTMLButtonElement).style.display).toBe('none');
    expect((document.getElementById('bili-btn-clear') as HTMLButtonElement).style.display).toBe('none');
  });

  it('⬇️ 下载按钮 → 触发 hooks.onDownload（弹出原 B站下载弹窗入口，ADR-0066）', () => {
    ui.destroy();
    const onDownload = vi.fn();
    ui = new UIManager({} as any, { onDownload });
    (document.getElementById('bili-btn-download') as HTMLButtonElement).click();
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('设置 schema（ADR-0066）：移动端组 + 文献盒处理组五项设置', () => {
    const schema = biliTasksSettingsSchema();
    expect(schema.groups).toHaveLength(2);
    const rows = schema.groups[1].rows.map((r: any) => r.name);
    expect(rows).toEqual(['详细进度提示', '保留视频原件', '下载清晰度', '遇错即停', '输出目录']);
    expect((schema.groups[1].rows[2] as any).options).toHaveLength(3); // 清晰度三档
  });

  it('批量处理中行内渲染：步骤时间线 + 百分比 + 耗时（[bz-step]/[bz-p] 驱动，ADR-0066）', async () => {
    // 打桩 child_process：spawn 返回可控子进程
    const origRequire = (window as any).require;
    class FC extends EventEmitter { stdout = new EventEmitter(); stderr = new EventEmitter(); kill = vi.fn(); }
    const child = new FC();
    (window as any).require = () => ({ spawn: vi.fn(() => child) });
    try {
      ui.showMain();
      await new Promise((r) => setTimeout(r, 0));
      await TasksData.addTask({ url: 'BV1xx411c7mD' });
      await ui.refreshPanel();
      (document.getElementById('bili-btn-run') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(document.querySelector('.bz-bili-progress-box')).toBeTruthy());
      child.stdout.emit('data', Buffer.from('[bz-step] 解析中\n[bz-step] 下载中\n'));
      child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"download","pct":42}\n'));
      await vi.waitFor(() => {
        const box = document.querySelector('.bz-bili-progress-box')!;
        expect(box.textContent).toContain('解析中');
        expect(box.textContent).toContain('下载中');
        expect(box.textContent).toContain('42%');
        expect(box.textContent).toContain('⌛');
      });
      // 已完成步骤带 ✓（时间线形态）
      const done = document.querySelector('.bz-bili-step-done')!;
      expect(done.textContent).toContain('✓ 解析中');
    } finally {
      // 无论断言成败都收尾整批（防 BatchRunner.running 卡死重试）
      child.emit('close', 1);
      (window as any).require = origRequire;
    }
  });

  it('destroy 清空全部 DOM 与键盘监听', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 0));
    ui.destroy();
    expect(document.getElementById('bili-tasks-popup')).toBeNull();
    expect(document.getElementById('bili-tasks-mask')).toBeNull();
    expect(document.getElementById('bili-add-popup')).toBeNull();
  });
});
/**
 * 文献盒面板 UI 测试（src/bili-downloader/ui.ts）：
 * 主窗口结构（正名「文献盒」+ ⬇️ 下载按钮钩子 + 🕘 历史切换）、空态/行渲染与状态徽标、
 * 行内标题链接+UP主+失败重试按钮（ADR-0067）、添加/编辑弹窗（含清晰度/分P）与校验、
 * 点击分流、行内详细进度（[bz-step]/[bz-p] 时间线+百分比+耗时）、历史视图（自动归档/清空）、
 * 移动端仅暂存、destroy 清理。
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
  const openUrl = vi.fn();
  const app = {
    vault,
    workspace: { getLeaf: () => ({ openFile }) },
    commands: {},
    openUrl,
  };
  setApp(app as any);
  return { app, openFile, openUrl };
}

describe('文献盒面板 UI', () => {
  let vault: MockVault;
  let openFile: ReturnType<typeof vi.fn>;
  let openUrl: ReturnType<typeof vi.fn>;
  let ui: UIManager;

  beforeEach(() => {
    resetObsidianMocks();
    vault = new MockVault();
    ({ openFile, openUrl } = makeApp(vault));
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
    const t1 = await TasksData.addTask({ url: 'BV1xx411c7mD', start: '1:02:03', end: '1:05:00' });
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

  it('添加弹窗：保存成功入库 + 字段回填（编辑态）+ 宽松时间归一', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 0));
    (document.getElementById('bili-btn-add') as HTMLButtonElement)!.click();
    const popup = document.getElementById('bili-add-popup')!;
    expect(popup.style.display).toBe('flex');
    (document.getElementById('bili-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1xx411c7mD';
    (document.getElementById('bili-add-start') as HTMLInputElement).value = '12.2';
    (document.getElementById('bili-add-end') as HTMLInputElement).value = '12-30';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('已保存'));
    let all = await TasksData.loadTasks();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', start: '12:02', end: '12:30', status: 'pending' });
    // 点击待处理行 → 编辑回填
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    expect(popup.style.display).toBe('flex');
    expect((document.getElementById('bili-add-url') as HTMLInputElement).value).toContain('BV1xx411c7mD');
    expect((document.getElementById('bili-add-start') as HTMLInputElement).value).toBe('12:02');
    // 改时间保存 → 更新而非新增
    (document.getElementById('bili-add-start') as HTMLInputElement).value = '12';
    (document.getElementById('bili-add-end') as HTMLInputElement).value = '12.2';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(async () => {
      all = await TasksData.loadTasks();
      expect(all[0].start).toBe('12:00');
      expect(all[0].end).toBe('12:02');
    });
    expect(all).toHaveLength(1);
    // 弹窗无备注输入框（已移除）
    expect(document.getElementById('bili-add-remark')).toBeNull();
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

  it('添加弹窗新字段（ticket 134）：标题/UP主落库 + 聚合讯入口预填新增模式 + 编辑回填', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 0));
    (document.getElementById('bili-btn-add') as HTMLButtonElement)!.click();
    (document.getElementById('bili-add-url') as HTMLInputElement).value = 'BV1xx411c7mD';
    (document.getElementById('bili-add-vtitle') as HTMLInputElement).value = '某视频';
    (document.getElementById('bili-add-uploader') as HTMLInputElement).value = 'UP主甲';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(async () => {
      const all = await TasksData.loadTasks();
      expect(all[0]).toMatchObject({ title: '某视频', uploader: 'UP主甲' });
    });
    // 编辑回填：点击待处理行 → 两个新字段回显
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    expect((document.getElementById('bili-add-vtitle') as HTMLInputElement).value).toBe('某视频');
    expect((document.getElementById('bili-add-uploader') as HTMLInputElement).value).toBe('UP主甲');
    // 聚合讯入口预填（无 id = 新增模式，标题不显示「编辑」，起止留空）
    ui.showAddDialog({ url: 'https://www.bilibili.com/video/BV1xx411c7mE', title: '预填标题', uploader: '预填UP' });
    const popup = document.getElementById('bili-add-popup')!;
    expect(popup.querySelector('#bili-add-title')!.textContent).toBe('添加转文献任务');
    expect((document.getElementById('bili-add-url') as HTMLInputElement).value).toBe('https://www.bilibili.com/video/BV1xx411c7mE');
    expect((document.getElementById('bili-add-vtitle') as HTMLInputElement).value).toBe('预填标题');
    expect((document.getElementById('bili-add-uploader') as HTMLInputElement).value).toBe('预填UP');
    expect((document.getElementById('bili-add-start') as HTMLInputElement).value).toBe('');
  });

  it('队列行展示优先标题（ticket 134）：预填 title 即渲染标题文字链接，无 title 回退原始链接（ADR-0067 形态）', async () => {
    await TasksData.addTask({ url: 'BV1xx411c7mD', title: '某视频标题' });
    await TasksData.addTask({ url: 'BV1xx411c7mE' });
    await ui.refreshPanel();
    const cards = document.querySelectorAll('.bz-bili-task-card');
    // 有标题：标题文字链接（href 指向原链接）；无标题：原始链接文本
    const anchor = cards[0].querySelector('a.bz-bili-title') as HTMLAnchorElement;
    expect(anchor.textContent).toBe('某视频标题');
    expect(anchor.getAttribute('href')).toBe('BV1xx411c7mD');
    expect((cards[1].querySelector('.bz-bili-url') as HTMLElement).textContent).toBe('BV1xx411c7mE');
  });

  it('点击分流：成功项打开文献笔记', async () => {
    const t = await TasksData.addTask({ url: 'BV1xx411c7mD' });
    await TasksData.updateTask(t.id, { status: 'success', notePath: '文献盒/测试.md' } as any);
    vault.files.set('文献盒/测试.md', '# 测试');
    await ui.refreshPanel();
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    expect(openFile).toHaveBeenCalledTimes(1);
  });

  it('移动端仅暂存：处理/下载/中止隐藏；历史可见；无清空按钮（ADR-0067）', () => {
    ui.destroy();
    (Platform as any).isMobile = true;
    ui = new UIManager({} as any);
    expect((document.getElementById('bili-btn-run') as HTMLButtonElement).style.display).toBe('none');
    expect((document.getElementById('bili-btn-download') as HTMLButtonElement).style.display).toBe('none');
    expect((document.getElementById('bili-btn-abort') as HTMLButtonElement).style.display).toBe('none');
    expect(document.getElementById('bili-btn-clear')).toBeNull(); // 清空入口移至历史视图
    expect(document.getElementById('bili-btn-history')).toBeTruthy();
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
      // 非下载阶段不显示百分比（ADR-0067 拍板：仅下载显示）
      child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"ai","pct":77}\n'));
      await new Promise((r) => setTimeout(r, 0));
      const box2 = document.querySelector('.bz-bili-progress-box')!;
      expect(box2.textContent).not.toContain('77%');
      expect(box2.querySelector('.bz-bili-progress-fill')).toBeNull();
    } finally {
      // 无论断言成败都收尾整批（防 BatchRunner.running 卡死重试）
      child.emit('close', 1);
      (window as any).require = origRequire;
    }
  });

  it('行内信息（ADR-0067）：标题链接（浏览器打开）+ UP主 + 失败行重试按钮', async () => {
    const t = await TasksData.addTask({ url: 'https://www.bilibili.com/video/BV1xx411c7mD' });
    await TasksData.updateTask(t.id, { title: '从零开始学B站', uploader: '某UP', status: 'failed', reason: 'AI 返回的不是 JSON：xxx' } as any);
    await ui.refreshPanel();
    const list = document.getElementById('bili-tasks-list')!;
    const txt = list.textContent!;
    expect(txt).toContain('从零开始学B站'); // 文字链接（不再裸显 URL）
    expect(txt).toContain('UP主 某UP');
    expect(txt).not.toContain('BV1xx411c7mD'); // 原始链接被标题替换
    const link = document.querySelector('.bz-bili-title') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    link.click(); // 浏览器打开 + 不冒泡触发失败原因弹窗
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(String(openUrl.mock.calls[0][0])).toContain('BV1xx411c7mD');
    // 失败行行内「重试」→ 回到待处理
    const retry = document.querySelector('.bz-bili-retry-btn') as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    await vi.waitFor(async () => {
      const all = await TasksData.loadTasks();
      expect(all[0].status).toBe('pending');
    });
  });

  it('历史视图（ADR-0067）：成功自动归档不出现在任务列表；🕘 切换后可见并可清空', async () => {
    const ok = await TasksData.addTask({ url: 'https://www.bilibili.com/video/BV1xx411c7mD' });
    await TasksData.updateTask(ok.id, { status: 'success', archived: true, archivedAt: '2026-08-28 21:00:00', title: '从零开始学B站', notePath: '文献盒/从零开始学B站.md' } as any);
    const pend = await TasksData.addTask({ url: 'BV1xx411c7mE' });
    await ui.refreshPanel();
    // 任务视图：归档项不可见
    let list = document.getElementById('bili-tasks-list')!;
    expect(list.textContent).toContain('BV1xx411c7mE');
    expect(list.textContent).not.toContain('从零开始学B站');
    // 切历史
    (document.getElementById('bili-btn-history') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-bili-hstrip')).toBeTruthy());
    list = document.getElementById('bili-tasks-list')!;
    expect(list.textContent).toContain('历史 · 1 条');
    expect(list.textContent).toContain('从零开始学B站');
    expect(list.textContent).toContain('文献盒/从零开始学B站.md');
    // 清空历史（确认弹窗 → 标准双动作确认钮 __shared_confirm_ok__）
    (document.getElementById('bili-btn-clear-history') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_ok__')).toBeTruthy());
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-bili-hstrip')!.textContent).toContain('历史 · 0 条'));
    const all = await TasksData.loadTasks();
    expect(all.some((x) => x.archived)).toBe(false);
    expect(all[0].id).toBe(pend.id);
  });

  it('添加弹窗（ADR-0067）：清晰度 + 分P 可选并入库；非法分P 报错', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 0));
    (document.getElementById('bili-btn-add') as HTMLButtonElement)!.click();
    (document.getElementById('bili-add-url') as HTMLInputElement).value = 'BV1xx411c7mD';
    (document.getElementById('bili-add-quality') as HTMLSelectElement).value = '720';
    (document.getElementById('bili-add-page') as HTMLInputElement).value = '2';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('已保存'));
    let all = await TasksData.loadTasks();
    expect(all[0].quality).toBe('720');
    expect(all[0].page).toBe(2);
    // 非法分P：0 或小数 → 报错不入库
    (document.getElementById('bili-btn-add') as HTMLButtonElement)!.click();
    (document.getElementById('bili-add-url') as HTMLInputElement).value = 'BV1xx411c7mF';
    (document.getElementById('bili-add-page') as HTMLInputElement).value = '0';
    (document.getElementById('bili-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('分P 应为正整数'));
    all = await TasksData.loadTasks();
    expect(all).toHaveLength(1);
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
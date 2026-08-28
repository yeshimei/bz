/**
 * B站下载器补充覆盖测试（src/bili-downloader/index.ts 未触达分支）：
 * require('child_process') 抛异常兜底、stderr 缓冲滑窗、close(0) 正常退出提示、
 * 6 秒未解析地址兜底通知、settled 后事件不再覆盖提示。
 * 外部进程一律经 window.require 打桩，无真实网络与子进程。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { openBiliDownloader, openBiliAddTask, unloadBiliDownloader } from '../../src/bili-downloader';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';

/** 假子进程：stdout/stderr 可 emit */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

function noticeText(): string {
  return getNoticeMessages().join('\n');
}

describe('bili-downloader 启动命令补充分支', () => {
  const origRequire = (window as any).require;

  beforeEach(() => {
    clearNotices();
  });

  afterEach(() => {
    (window as any).require = origRequire;
    vi.useRealTimers();
    clearNotices();
  });

  it('window.require 存在但加载 child_process 抛异常 → 视同非桌面端', () => {
    (window as any).require = () => {
      throw new Error('Cannot find module');
    };
    openBiliDownloader();
    expect(noticeText()).toContain('仅桌面端可用：B站下载器需要 Node.js 外部进程');
  });

  it('stderr 输出只进缓冲不触发额外提示；地址随后在 stdout 命中', () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    // spawn 即有一条「正在启动」即时反馈（ticket 117）
    expect(getNoticeMessages()).toEqual(['正在启动 B站下载器…']);
    // stderr 大段输出（>8KB 触发滑窗裁剪）→ 除启动提示外不产生任何提示
    child.stderr.emit('data', Buffer.alloc(20 * 1024, 'x'));
    expect(getNoticeMessages()).toEqual(['正在启动 B站下载器…']);
    // 地址从 stdout 到达 → 成功
    child.stdout.emit('data', Buffer.from('地址: http://127.0.0.1:7777\n'));
    expect(noticeText()).toContain('B站下载器已启动：http://127.0.0.1:7777');
  });

  it('未解析到地址且 close(0) → 「B站下载器已退出」常规提示', () => {
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    child.emit('close', 0);
    expect(noticeText()).toContain('正在启动 B站下载器…');
    expect(noticeText()).toContain('B站下载器已退出');
  });

  it('6 秒未解析地址 → 软超时「启动中」提示；随后 close/error 可升级（ticket 117）', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    await vi.advanceTimersByTimeAsync(6000);
    expect(noticeText()).toContain('B站下载器启动中…浏览器将自动打开');
    // 软超时不 settle：进程随后失败可覆盖升级为准确提示（旧语义「不再改口」废止）
    child.emit('error', new Error('spawn bili-dl ENOENT'));
    expect(noticeText()).toContain('未找到 bili-dl');
    // error 已 settle → close 不再重复改口（仍保留失败信息，不退回「启动中」）
    child.emit('close', 1);
    expect(noticeText()).toContain('未找到 bili-dl');
    expect(noticeText()).not.toContain('启动失败');
  });
});

describe('openBiliAddTask（聚合讯「保存至文献」入口，ticket 134/ADR-0067）', () => {
  afterEach(() => {
    unloadBiliDownloader();
    document.body.innerHTML = '';
  });

  it('ensure 幂等初始化 → 主面板叠开添加弹窗，预填链接去空白/标题/UP主（新增模式标题）', () => {
    setApp({ vault: new MockVault() } as any);
    openBiliAddTask({} as any, { url: ' https://www.bilibili.com/video/BV1xx411c7mD ', title: '某视频', uploader: 'UP主甲' });
    expect(document.getElementById('bili-tasks-popup')!.style.display).toBe('flex');
    expect(document.getElementById('bili-add-popup')!.style.display).toBe('flex');
    expect((document.getElementById('bili-add-url') as HTMLInputElement).value).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    expect((document.getElementById('bili-add-vtitle') as HTMLInputElement).value).toBe('某视频');
    expect((document.getElementById('bili-add-uploader') as HTMLInputElement).value).toBe('UP主甲');
    expect(document.getElementById('bili-add-title')!.textContent).toBe('添加转文献任务');
  });
});

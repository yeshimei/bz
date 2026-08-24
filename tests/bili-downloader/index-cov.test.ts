/**
 * B站下载器补充覆盖测试（src/bili-downloader/index.ts 未触达分支）：
 * require('child_process') 抛异常兜底、stderr 缓冲滑窗、close(0) 正常退出提示、
 * 6 秒未解析地址兜底通知、settled 后事件不再覆盖提示。
 * 外部进程一律经 window.require 打桩，无真实网络与子进程。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { openBiliDownloader } from '../../src/bili-downloader';
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

  it('stderr 输出只进缓冲不触发提示；地址随后在 stdout 命中', () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    // stderr 大段输出（>8KB 触发滑窗裁剪）→ 不产生任何提示
    child.stderr.emit('data', Buffer.alloc(20 * 1024, 'x'));
    expect(getNoticeMessages()).toHaveLength(0);
    // 地址从 stdout 到达 → 成功
    child.stdout.emit('data', Buffer.from('地址: http://127.0.0.1:7777\n'));
    expect(noticeText()).toContain('B站下载器已启动：http://127.0.0.1:7777');
  });

  it('未解析到地址且 close(0) → 「B站下载器已退出」常规提示', () => {
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    child.emit('close', 0);
    expect(noticeText()).toBe('B站下载器已退出');
  });

  it('6 秒未解析地址 → 兜底「启动中」提示；此后 close/error 不再改口', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    await vi.advanceTimersByTimeAsync(6000);
    expect(noticeText()).toContain('B站下载器启动中…浏览器将自动打开');
    // settled 后的残余事件不再覆盖提示
    child.emit('error', new Error('spawn bili-dl ENOENT'));
    child.emit('close', 1);
    expect(noticeText()).toContain('B站下载器启动中…浏览器将自动打开');
    expect(getNoticeMessages()).toHaveLength(1);
  });
});

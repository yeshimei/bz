/**
 * B站下载器启动命令测试（bz-bili-downloader-open，ticket 无——外部工具启动器）
 * 场景：非桌面端提示 / 桌面端 spawn bili-dl 解析地址提示 / ENOENT 提示安装 / 退出码非 0 提示安装
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { openBiliDownloader } from '../src/bili-downloader';

/** 假子进程：stdout/stderr 都是可 emit 的 EventEmitter */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

function noticeText(): string {
  return document.querySelector('#bz-notice-container')?.textContent ?? '';
}

describe('bili-downloader 启动命令', () => {
  const origRequire = (window as any).require;
  afterEach(() => {
    (window as any).require = origRequire;
  });

  it('非桌面端（无 window.require）：提示仅桌面端可用', () => {
    (window as any).require = undefined;
    openBiliDownloader();
    expect(noticeText()).toContain('仅桌面端可用');
  });

  it('桌面端：以 shell 方式 spawn bili-dl，解析 stdout 地址并提示', () => {
    const child = new FakeChild();
    const spawn = vi.fn(() => child);
    (window as any).require = () => ({ spawn });
    openBiliDownloader();
    expect(spawn).toHaveBeenCalledWith('bili-dl', [], expect.objectContaining({ shell: true, windowsHide: true }));
    child.stdout.emit('data', Buffer.from('==============================================\n  B站下载器\n  地址: http://127.0.0.1:8800\n  按 Ctrl+C 退出\n'));
    expect(noticeText()).toContain('http://127.0.0.1:8800');
  });

  it('spawn 抛错：提示安装命令', () => {
    (window as any).require = () => ({ spawn: () => { throw new Error('spawn ENOENT') } });
    openBiliDownloader();
    expect(noticeText()).toContain('npm install -g @jwbz/bili-downloader');
  });

  it('子进程 error ENOENT（未安装全局命令）：提示安装', () => {
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    child.emit('error', new Error('spawn bili-dl ENOENT'));
    expect(noticeText()).toContain('npm install -g @jwbz/bili-downloader');
  });

  it('子进程退出码非 0（启动失败）：提示安装', () => {
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    child.emit('close', 1);
    expect(noticeText()).toContain('npm install -g @jwbz/bili-downloader');
  });

  it('地址解析成功后 close 不再重复提示（settled 去重）', () => {
    const child = new FakeChild();
    (window as any).require = () => ({ spawn: () => child });
    openBiliDownloader();
    child.stdout.emit('data', Buffer.from('地址: http://127.0.0.1:8800\n'));
    const first = noticeText();
    child.emit('close', 0);
    expect(noticeText()).toBe(first);
  });
});

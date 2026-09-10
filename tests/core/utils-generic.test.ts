// @vitest-environment node
/**
 * core 通用化收编工具测试（全域扫描 2026-09 批次 A）：
 * localDayKey / stripMdExt / stripTitleMarks / cmpZh / isUnderFolder / hash31 / debounce / yieldToMainThread。
 * 各函数以收编蓝本（clipbook/constants、review/watch、checkup/run 等）的原行为为基准。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  localDayKey,
  stripMdExt,
  stripTitleMarks,
  cmpZh,
  isUnderFolder,
  hash31,
  debounce,
  yieldToMainThread,
} from '../../src/core/utils';

describe('localDayKey', () => {
  it('本地时区 YYYY-MM-DD（非 UTC 切片）', () => {
    // UTC 2025-06-14 17:30 = 本地 UTC+8 2025-06-15 01:30，本地键应落在 15 日
    const ts = Date.UTC(2025, 5, 14, 17, 30, 0);
    const d = new Date(ts);
    expect(localDayKey(ts)).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  });
  it('接受 Date 入参并补零', () => {
    expect(localDayKey(new Date(2025, 0, 3))).toBe('2025-01-03');
  });
  it('缺省为当前时刻', () => {
    const now = new Date();
    expect(localDayKey()).toBe(localDayKey(now.getTime()));
  });
});

describe('stripMdExt', () => {
  it('剥离结尾 .md', () => {
    expect(stripMdExt('日记/2025-06-15.md')).toBe('日记/2025-06-15');
    expect(stripMdExt('note.md')).toBe('note');
  });
  it('大小写不敏感（.MD 同样剥离）', () => {
    expect(stripMdExt('NOTE.MD')).toBe('NOTE');
  });
  it('非 .md 结尾原样返回', () => {
    expect(stripMdExt('a.mdx')).toBe('a.mdx');
    expect(stripMdExt('plain')).toBe('plain');
  });
});

describe('stripTitleMarks', () => {
  it('剥首尾书名号', () => {
    expect(stripTitleMarks('《三体》')).toBe('三体');
    expect(stripTitleMarks('《三体')).toBe('三体');
    expect(stripTitleMarks('三体》')).toBe('三体');
  });
  it('中间书名号与无书名号原样', () => {
    expect(stripTitleMarks('《a》与《b》')).toBe('a》与《b');
    expect(stripTitleMarks('三体')).toBe('三体');
  });
});

describe('cmpZh', () => {
  it('中文按拼音序', () => {
    expect(cmpZh('啊', '吧')).toBeLessThan(0);
    expect(cmpZh('吧', '啊')).toBeGreaterThan(0);
  });
  it('相同串返回 0', () => {
    expect(cmpZh('测试', '测试')).toBe(0);
  });
});

describe('isUnderFolder', () => {
  it('恰为目录自身或位于其下', () => {
    expect(isUnderFolder('书库', '书库')).toBe(true);
    expect(isUnderFolder('书库', '书库/a.md')).toBe(true);
    expect(isUnderFolder('书库', '书库/子/b.md')).toBe(true);
  });
  it('目录外与前缀同名字目不算', () => {
    expect(isUnderFolder('书库', '书库2/a.md')).toBe(false);
    expect(isUnderFolder('书库', '日记/a.md')).toBe(false);
  });
  it('尾斜杠与空白容错；空 folder 返回 false', () => {
    expect(isUnderFolder('书库/', '书库/a.md')).toBe(true);
    expect(isUnderFolder('  ', 'x')).toBe(false);
  });
});

describe('hash31', () => {
  it('稳定且逐字对应蓝本公式（h*31+code >>> 0）', () => {
    let h = 0;
    const s = 'douban.com';
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    expect(hash31(s)).toBe(h);
  });
  it('同串同值，异串异值', () => {
    expect(hash31('a')).toBe(hash31('a'));
    expect(hash31('a')).not.toBe(hash31('b'));
  });
  it('空串返回 0', () => {
    expect(hash31('')).toBe(0);
  });
});

describe('debounce', () => {
  afterEach(() => vi.useRealTimers());
  it('尾触防抖：窗口内多次调用只执行最后一次', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    vi.advanceTimersByTime(50);
    d('b');
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });
  it('cancel 丢弃未决调用', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('yieldToMainThread', () => {
  it('返回 promise 并 resolve（jsdom 有 requestIdleCallback 或退化为 setTimeout）', async () => {
    await expect(yieldToMainThread(10)).resolves.toBeUndefined();
  });
});

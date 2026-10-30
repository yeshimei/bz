// @vitest-environment node
/**
 * 首页时间线采集（home/timeline-collect.ts）
 *
 * 这层的契约只有两条，但都是硬要求：
 *  1. 各域自己的数据文件里有没有可信时间，决定这条事件进不进时间线；
 *  2. 任何一域读崩了都不许拖垮整条时间线（各域独立 try/catch，缺失/坏 JSON 一律回落空）。
 *
 * 第 2 条是最容易回归的：把某个 collect 函数改成不 catch，面板一遇到坏文件就整块空掉，
 * 而单元测试若只喂正常数据，永远看不出来。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { collectTimelineEvents, parseWhen, toTimeLabel } from '../../src/home/timeline-collect';

const NOW = new Date(2026, 8, 7, 21, 0).getTime(); // 2026-09-07 21:00
const WIN = { now: NOW, days: 7 };

function app(vault: MockVault): any {
  return mockAppWithVault(vault) as any;
}

/** 存储根固定成老库口径：storageFile() 读的是设置里的 storagePath，不设就会指向 <插件>/storage；
 *  影视目录同理——ADR-0274 后域目录缺省留空，不显式配置就采集不到夹具里写的笔记 */
beforeEach(() => {
  setApp(mockAppWithVault(new MockVault()) as any);
  setSettingsProvider(() => ({
    ...DEFAULT_SETTINGS,
    storagePath: 'CONFIG/STORAGE',
    cinemaFolderPath: '我的/影视',
  }));
});

describe('parseWhen：落盘形态归一', () => {
  it('日期、日期时间、ISO、毫秒、秒级都认', () => {
    expect(parseWhen('2026-09-07')).toBe(new Date(2026, 8, 7).getTime());
    expect(parseWhen('2026-09-07 09:30:15')).toBe(new Date(2026, 8, 7, 9, 30, 15).getTime());
    expect(parseWhen('2026-09-07T09:30:00')).toBe(new Date(2026, 8, 7, 9, 30).getTime());
    const ms = new Date(2026, 8, 7, 9, 30).getTime();
    expect(parseWhen(ms)).toBe(ms);
    expect(parseWhen(Math.floor(ms / 1000))).toBe(ms);
  });

  it('认不出的一律 null（宁缺勿假）', () => {
    expect(parseWhen('')).toBeNull();
    expect(parseWhen('前天')).toBeNull();
    expect(parseWhen(undefined)).toBeNull();
  });

  it('时刻标签补零', () => {
    expect(toTimeLabel(new Date(2026, 8, 7, 9, 5).getTime())).toBe('09:05');
  });
});

describe('collectTimelineEvents：从各域数据文件算事件', () => {
  it('备忘录：新增与完成各一条，完成带「挂了几天」', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { title: '交房租', created: '2026-09-05 09:00:00', completed: '2026-09-07 10:30:00', due: '2026-09-08' },
    ]));
    const events = await collectTimelineEvents(app(vault), WIN);
    const memo = events.filter((e) => e.domain === 'memo');
    expect(memo.map((e) => e.text)).toEqual(['记下『交房租』，2026-09-08 前要办', '办完『交房租』，挂了 2 天']);
    expect(memo.map((e) => e.kind)).toEqual(['progress', 'produce']);
    expect(memo[1].timeLabel).toBe('10:30');
  });

  it('番茄钟：每轮一条，带任务名', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/pomodoro.json', JSON.stringify({
      version: 1,
      history: [
        { ts: new Date(2026, 8, 7, 14, 0).getTime(), duration: 25 * 60000, task: '写周报' },
        { ts: new Date(2026, 8, 7, 15, 0).getTime(), duration: 50 * 60000 },
      ],
    }));
    const events = await collectTimelineEvents(app(vault), WIN);
    expect(events.filter((e) => e.domain === 'pomodoro').map((e) => e.text)).toEqual([
      '专注 25 分钟 · 写周报', '专注了 50 分钟',
    ]);
  });

  it('影院：已看日期带时分 → 按分钟落位，评分并进同一句', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《沙丘》.md', '---\n评分: 8.5\n已看日期: 2026-09-06 21:12:00\n---\n');
    const events = await collectTimelineEvents(app(vault), WIN);
    const cinema = events.filter((e) => e.domain === 'cinema');
    expect(cinema).toHaveLength(1);
    expect(cinema[0].text).toBe('看完《沙丘》，给了 ★8.5');
    expect(cinema[0].timeLabel).toBe('21:12');
  });

  it('窗口外的事件不进', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
      { title: '很旧的', created: '2026-01-01 09:00:00', completed: null },
    ]));
    const events = await collectTimelineEvents(app(vault), WIN);
    expect(events).toHaveLength(0);
  });

  it('数据文件缺失 / 坏 JSON / 字段缺失：回落空数组，不抛', async () => {
    const missing = await collectTimelineEvents(app(new MockVault()), WIN);
    expect(missing).toEqual([]);

    const broken = new MockVault();
    broken.files.set('CONFIG/STORAGE/memo.json', '{ 这不是 json');
    broken.files.set('CONFIG/STORAGE/belongings.json', 'null');
    broken.files.set('我的/影视/《坏》.md', '没有 frontmatter 的正文');
    await expect(collectTimelineEvents(app(broken), WIN)).resolves.toEqual([]);
  });
});

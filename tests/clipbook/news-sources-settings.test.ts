// @vitest-environment jsdom
/**
 * clipbook 设置「数据源」组声明式重写回归：
 * - schema 形态：两条路径（news.json 缺失 → 安装引导行；存在 → 声明行），
 *   全组零 custom 插槽（与面板其他组同一渲染链——推翻 ticket 131 custom 方案的锚点）；
 * - 三函数绑定：三源开关/B站条数读写字盒、save 经数据层落盘 news.json；
 * - 显隐联动：B 站开关关闭 → UP 名单/抓取条数行 visibleWhen 假（闭包读状态盒）；
 * - 保留天数行绑定 numStrBinding（data.json string 键）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import { readDataSourceState, emptyDataSourceState } from '../../src/clipbook/news-source-settings';
import { dataSourceGroupRows } from '../../src/clipbook/news-sources-group';
import { clipbookSettingsSchema } from '../../src/clipbook/ui';
import type { SettingsRow } from '../../src/core/settings-schema';

function seedDisk(sources = { zhihu: true, guokr: false, bilibili: true }): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles: [{ platform: '知乎日报', title: '文章', url: 'https://zh.com/1', body: '正文', fetchedAt: '2026-09-08T10:00:00Z' }],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: ['11'],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
      sources,
    })
  );
  setApp(mockAppWithVault(vault));
  return vault;
}

const rowByName = (rows: SettingsRow[], name: string) => rows.find((r) => (r as { name?: string }).name === name) as any;
const diskJson = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

let savedDataJson = 0;
beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', newsRetentionUnsavedDays: '30', articleDirectory: '归档/网页剪藏' }) as any);
  setSettingsSaver(async () => { savedDataJson++; });
});

describe('数据源组 schema 形态（声明式重写）', () => {
  it('news.json 存在：全组声明行、零 custom 插槽', async () => {
    seedDisk();
    const state = await readDataSourceState();
    const rows = dataSourceGroupRows(state);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.some((r) => r.type === 'custom')).toBe(false);
    expect(rows.map((r) => r.type)).toEqual(['toggle', 'toggle', 'toggle', 'button', 'number', 'number']);
  });

  it('news.json 缺失：安装引导（info + 复制安装命令按钮）', async () => {
    setApp(mockAppWithVault(new MockVault())); // 显式空 vault（隔离上一用例的 app 残留）
    const state = await readDataSourceState();
    expect(state.exists).toBe(false);
    const rows = dataSourceGroupRows(state);
    const info = rowByName(rows, '尚未启用新闻数据源');
    expect(info.type).toBe('info');
    expect(rowByName(rows, '安装数据源').buttonText).toBe('复制安装命令');
  });

  it('clipbookSettingsSchema 组装：数据源组消费预载状态（外部 news.json 键不进 data.json）', async () => {
    seedDisk();
    const schema = clipbookSettingsSchema(await readDataSourceState());
    const group = schema.groups.find((g) => g.name === '数据源')!;
    expect(group.rows.some((r) => r.type === 'custom')).toBe(false);
    expect(rowByName(group.rows as SettingsRow[], '知乎日报')).toBeTruthy();
  });
});

describe('数据源组三函数绑定（news.json 落盘）', () => {
  it('三源开关：set 改字盒 + save 合并落盘 sources 段', async () => {
    const vault = seedDisk({ zhihu: true, guokr: false, bilibili: true });
    const rows = dataSourceGroupRows(await readDataSourceState());
    const b = rowByName(rows, '果壳科学人').binding;
    expect(b.get()).toBe(false);
    b.set(true);
    expect(b.get()).toBe(true);
    await b.save();
    expect(diskJson(vault).sources.guokr).toBe(true);
    expect(diskJson(vault).sources.zhihu).toBe(true); // 未声明变更段不丢
  });

  it('B站抓取条数：set/save 落盘 bilibiliMaxItems', async () => {
    const vault = seedDisk();
    const rows = dataSourceGroupRows(await readDataSourceState());
    const b = rowByName(rows, 'B站抓取条数').binding;
    expect(b.get()).toBe(10);
    b.set(25);
    await b.save();
    expect(diskJson(vault).bilibiliMaxItems).toBe(25);
  });

  it('未保存文章保留天数：numStrBinding（data.json string 键，显示数字）', async () => {
    seedDisk();
    const rows = dataSourceGroupRows(await readDataSourceState());
    const b = rowByName(rows, '文章保留天数').binding;
    expect(b.get()).toBe(30); // 键值 '30'
    b.set(45);
    await b.save();
    expect(savedDataJson).toBe(1); // 落 data.json 而非 news.json
  });
});

describe('数据源组显隐联动（B 站开关联动，闭包读状态盒）', () => {
  it('B站关 → UP 名单/抓取条数行 visibleWhen 假；字盒置开后转真（无需重建）', async () => {
    seedDisk({ zhihu: true, guokr: true, bilibili: false });
    const rows = dataSourceGroupRows(await readDataSourceState());
    const snap = {} as never; // 外部绑定行：visibleWhen 不依赖 data.json 快照
    const upRow = rowByName(rows, 'UP 主名单');
    const countRow = rowByName(rows, 'B站抓取条数');
    expect(upRow.visibleWhen(snap)).toBe(false);
    expect(countRow.visibleWhen(snap)).toBe(false);
    rowByName(rows, 'B站 UP 主').binding.set(true);
    expect(upRow.visibleWhen(snap)).toBe(true);
    expect(countRow.visibleWhen(snap)).toBe(true);
  });

  it('UP 名单行 desc 计数：已跟踪 N 位 / 暂未跟踪', async () => {
    seedDisk();
    const rows = dataSourceGroupRows(await readDataSourceState());
    expect(rowByName(rows, 'UP 主名单').desc).toBe('已跟踪 1 位 UP 主，添加与移除在管理弹窗');
    const empty = dataSourceGroupRows({ ...emptyDataSourceState(true), exists: true });
    expect(rowByName(empty, 'UP 主名单').desc).toBe('暂未跟踪 UP 主，添加与移除在管理弹窗');
  });
});

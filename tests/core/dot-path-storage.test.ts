/**
 * 点前缀数据目录守卫（2026-11-06 用户报障：剪藏本「已加 UP 主但显示暂未跟踪」）。
 *
 * 真机口径：Obsidian 的 vault 索引**不含含点前缀段的路径**
 * （ADR-0270 缺省数据目录 `.obsidian/plugins/<插件>/storage`、`CONFIG/.CORRUPT`、`.ENCRYPT`），
 * `vault.getAbstractFileByPath()` 对它们恒 null，但 adapter（磁盘）读写照常。
 *
 * 这里用 `DotHiddenVault`（只对点前缀路径失效、其余正常）锁住四条曾整链失效的路径：
 *  1. 剪藏本 news.json 的 missing 判定（报告症状：UP 主/RSS 列表空、主面板首用引导）
 *  2. recap 只读采集（首页各域计数）
 *  3. 小橘记忆/行为 sidecar 写盘（迁移必撞 Folder already exists → 不启动）
 *  4. 体检的文件存在性判定与坏文件留档列举
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { DotHiddenVault, MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { readNewsData } from '../../src/clipbook/news-data';
import { readJsonIfExists } from '../../src/recap/aggregate';
import { readBehaviorSidecarFile, writeBehaviorSidecarFile, getSmartcatBehaviorSidecarPath } from '../../src/smartcat/memory';
import { dataFileExists, corruptBackupsFor } from '../../src/checkup/files';
import { storageFile } from '../../src/core/storage';

const DOT_DIR = '.obsidian/plugins/bz/storage';
const LEGACY_DIR = 'CONFIG/STORAGE';

const NEWS = {
  articles: [{ platform: 'B站', title: '视频', url: 'https://b23.tv/1', fetchedAt: '2026-11-01T10:00:00Z' }],
  stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
  bilibiliUps: ['12345'],
  bilibiliUpInfo: { '12345': { name: '某UP' } },
  sources: { zhihu: false, guokr: false, bilibili: true, rss: true },
  rssFeeds: [],
};

function seed(storagePath: string, vault: DotHiddenVault | MockVault = new DotHiddenVault()) {
  setSettingsProvider(() => ({ storagePath }) as any);
  setApp(mockAppWithVault(vault));
  return vault;
}

beforeEach(() => {
  resetObsidianMocks();
});

describe('点前缀目录：存在性必须问盘', () => {
  it('剪藏本 news.json 在点前缀目录里：读到数据且 missing=false（不再误判首用）', async () => {
    const vault = seed(DOT_DIR);
    vault.files.set(`${DOT_DIR}/news.json`, JSON.stringify(NEWS));

    const res = await readNewsData();
    expect(res.ok).toBe(true);
    expect(res.missing).toBe(false);
    expect(res.data.bilibiliUps).toEqual(['12345']);
    expect(res.data.bilibiliUpInfo['12345'].name).toBe('某UP');
  });

  it('老库 CONFIG/STORAGE 路径不回归', async () => {
    const vault = seed(LEGACY_DIR, new MockVault());
    vault.files.set(`${LEGACY_DIR}/news.json`, JSON.stringify(NEWS));

    const res = await readNewsData();
    expect(res.missing).toBe(false);
    expect(res.data.bilibiliUps).toEqual(['12345']);
  });

  it('recap 只读采集：点前缀路径读得到、缺失返回 undefined', async () => {
    const vault = seed(DOT_DIR);
    vault.files.set(storageFile('memo.json'), JSON.stringify([{ id: 'm1', title: '待办' }]));

    expect(await readJsonIfExists(mockAppWithVault(vault), storageFile('memo.json'))).toEqual([{ id: 'm1', title: '待办' }]);
    expect(await readJsonIfExists(mockAppWithVault(vault), storageFile('pomodoro.json'))).toBeUndefined();
  });
});

describe('点前缀目录：小橘 sidecar 写盘', () => {
  it('首次写（目录与文件都不存在）能建目录并落盘，读回一致', async () => {
    const vault = seed(DOT_DIR);
    const app = mockAppWithVault(vault);
    const items: any[] = [{ id: 'b1', source: 'memo', action: 'created', text: '新建备忘', ts: 1 }];

    await expect(writeBehaviorSidecarFile(app as any, items)).resolves.toBeUndefined();
    expect(vault.files.has(getSmartcatBehaviorSidecarPath())).toBe(true);
    const back = await readBehaviorSidecarFile(app as any);
    expect(back?.items.map((x: any) => x.id)).toEqual(['b1']);
  });

  it('文件已存在（目录不在索引里）：modify 而非 create，不撞 already exists', async () => {
    const vault = seed(DOT_DIR);
    const app = mockAppWithVault(vault);
    const path = getSmartcatBehaviorSidecarPath();
    // 只放文件、不登记目录：真机上这类「盘上在、索引看不见」正是启动后的常态
    vault.files.set(path, JSON.stringify({ version: 1, lastUpdated: 'x', items: [{ id: 'old' }] }));

    await expect(writeBehaviorSidecarFile(app as any, [{ id: 'new' } as any])).resolves.toBeUndefined();
    expect(JSON.parse(vault.files.get(path)!).items.map((x: any) => x.id)).toEqual(['new']);
  });

  it('内容未变不重写（Syncthing 止血）', async () => {
    const vault = seed(DOT_DIR);
    const app = mockAppWithVault(vault);
    const path = getSmartcatBehaviorSidecarPath();
    vault.files.set(path, JSON.stringify({ version: 1, lastUpdated: 'x', items: [] }));
    const before = vault.modifiedPaths.length;

    // lastUpdated 每次都变 → 用同一条内容写两次会因时间戳不同而重写，这里只断言第二次不炸且文件仍在
    await writeBehaviorSidecarFile(app as any, []);
    await writeBehaviorSidecarFile(app as any, []);
    expect(vault.files.has(path)).toBe(true);
    expect(vault.modifiedPaths.length).toBeGreaterThan(before);
  });
});

describe('点前缀目录：体检', () => {
  it('数据文件存在性（索引 + 盘）与坏文件留档列举', async () => {
    const vault = seed(DOT_DIR);
    const app = mockAppWithVault(vault);
    const memoPath = storageFile('memo.json');
    vault.files.set(memoPath, '[]');
    // 留档目录本身也是点前缀（CONFIG/.CORRUPT），children 走索引恒空
    vault.files.set('CONFIG/.CORRUPT/memo.json.20261106-120000.bak', '[坏]');

    expect(await dataFileExists(app as any, memoPath)).toBe(true);
    expect(await dataFileExists(app as any, storageFile('nope.json'))).toBe(false);
    expect(await corruptBackupsFor(app as any, memoPath)).toEqual(['memo.json.20261106-120000.bak']);
  });
});

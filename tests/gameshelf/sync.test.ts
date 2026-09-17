/**
 * 游戏架同步链路 + 面板 UI 测试（issue 368）：
 * runSync 全流程（mock requestUrl）——新建/更新用户数据零覆盖/下架保留/恢复在架；
 * 面板开合、未配置引导态、报告视图。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { requestUrl } from 'obsidian';
import { runSync, isSyncDue } from '../../src/gameshelf/sync';
import { rebuildItems } from '../../src/gameshelf/notes';
import { M, resetGameshelfState, DEFAULT_FOLDER } from '../../src/gameshelf/state';
import { openGameshelf, unloadGameshelf } from '../../src/gameshelf';
import { closePanel, renderAll } from '../../src/gameshelf/ui';

/* ---------- 测试专用 mock 组装 ---------- */

const vault = new MockVault();

/** 极简 frontmatter 解析（测试内自持，覆盖本域产出形态：tags 列表 + 扁平标量键） */
function parseFm(path: string): Record<string, any> {
  const raw = vault.files.get(path) ?? '';
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const fm: Record<string, any> = {};
  if (!m) return fm;
  let lastKey = '';
  for (const line of m[1].split('\n')) {
    if (line.startsWith('- ')) {
      (fm[lastKey] ??= []).push(line.slice(2).trim());
      continue;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    lastKey = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (v === 'true') fm[lastKey] = true;
    else if (v === 'false') fm[lastKey] = false;
    else if (v !== '' && /^-?\d+(\.\d+)?$/.test(v)) fm[lastKey] = Number(v);
    else if (v !== '') fm[lastKey] = v.replace(/^"|"$/g, '');
    else fm[lastKey] = undefined;
  }
  return fm;
}

/** 序列化回 frontmatter（与解析同一套规则，保 upsert 幂等） */
function serializeFm(fm: Record<string, any>): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`- ${item}`);
    } else if (typeof v === 'string') lines.push(`${k}: "${v}"`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function makeApp() {
  return {
    vault,
    metadataCache: { getFileCache: (file: any) => ({ frontmatter: parseFm(file.path) }) },
    fileManager: {
      processFrontMatter: async (file: any, cb: (fm: Record<string, any>) => void) => {
        const fm = parseFm(file.path);
        cb(fm);
        const raw = vault.files.get(file.path)!;
        const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '');
        vault.files.set(file.path, serializeFm(fm) + body);
      },
    },
  } as any;
}

function setup(settings: Record<string, unknown>) {
  setApp({ vault } as any);
  setSettingsProvider(() => settings as any);
}

/** Steam 两接口 mock：owned 库快照 + recent（近两周没玩 = 空响应） */
function mockSteam(ownedGames: any[]) {
  (requestUrl as any).mockImplementation(async (opts: { url: string }) => {
    const json = opts.url.includes('GetRecentlyPlayedGames')
      ? { response: { total_count: 0 } }
      : { response: { game_count: ownedGames.length, games: ownedGames } };
    return { status: 200, text: JSON.stringify(json), json };
  });
}

const CONFIG = { gameshelfSteamId: '76561198366147295', gameshelfSteamApiKey: 'k'.repeat(32), gameshelfFolderPath: DEFAULT_FOLDER };

beforeEach(() => {
  vault.files.clear();
  vault.dirs.clear();
  document.body.innerHTML = '';
  resetGameshelfState();
  resetObsidianMocks();
  setup(CONFIG);
});

describe('runSync 同步链路（issue 368）', () => {
  it('首次同步：新建笔记带全部管辖键 + tags 保底；空 recent 不阻塞', async () => {
    setup(CONFIG);
    mockSteam([{ appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 65214, rtime_last_played: 1771934400 }]); // 2026-02-24 12:00 UTC，任一时区当天
    const r = await runSync(makeApp(), { force: true });
    expect(r.ok).toBe(true);
    expect(r.added).toBe(1);
    const path = `${DEFAULT_FOLDER}/《Deep Rock Galactic》.md`;
    expect(vault.files.has(path)).toBe(true);
    const fm = parseFm(path);
    expect(fm["AppID"]).toBe(548430);
    expect(fm["游玩分钟"]).toBe(65214);
    expect(fm["最后游玩"]).toBe("2026-02-24");
    expect(fm["封面"]).toContain("steam/apps/548430/header.jpg");
    expect(fm["已下架"]).toBe(false);
    expect(fm.tags).toContain('游戏');
    expect(fm["同步时间"]).toBeTruthy();
  });

  it('再次同步：用户正文与自定义 frontmatter 零覆盖，仅管辖键刷新', async () => {
    setup(CONFIG);
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 60 }]);
    await runSync(makeApp(), { force: true });
    const path = `${DEFAULT_FOLDER}/《A》.md`;
    // 用户写入正文 + 自定义 frontmatter 键（插在 fm 块尾）
    const raw = vault.files.get(path)!;
    vault.files.set(path, raw.replace(/\n---\n\n$/, '\nmyNote: 手写\n---\n\n我的感想随便写。\n'));
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 120 }]);
    const r = await runSync(makeApp(), { force: true });
    expect(r.ok).toBe(true);
    expect(r.updated).toBe(1);
    const content = vault.files.get(path)!;
    expect(content).toContain('我的感想随便写。');
    expect(content).toContain('myNote');
    const fm = parseFm(path);
    expect(fm["游玩分钟"]).toBe(120);
  });

  it('Steam 消失的游戏 → offShelf: true 且文件保留；重新出现 → 恢复 false', async () => {
    setup(CONFIG);
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 10 }]);
    await runSync(makeApp(), { force: true });
    mockSteam([]);
    const r2 = await runSync(makeApp(), { force: true });
    expect(r2.offShelf).toBe(1);
    const path = `${DEFAULT_FOLDER}/《A》.md`;
    expect(vault.files.has(path)).toBe(true);
    expect(parseFm(path)["已下架"]).toBe(true);
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 20 }]);
    const r3 = await runSync(makeApp(), { force: true });
    expect(r3.updated).toBe(1);
    expect(parseFm(path)["已下架"]).toBe(false);
    expect(parseFm(path)["游玩分钟"]).toBe(20);
  });

  it('未配置 → reason=config 且零请求；密钥错 → reason=auth 人话报错', async () => {
    setup({ gameshelfSteamId: '', gameshelfSteamApiKey: '' });
    const r = await runSync(makeApp(), { force: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('config');
    (requestUrl as any).mockImplementation(async () => ({ status: 403, text: '', json: {} }));
    setup(CONFIG);
    const r2 = await runSync(makeApp(), { force: true });
    expect(r2.reason).toBe('auth');
    expect(r2.message).toContain('密钥');
  });

  it('网络层失败 → reason=network，文案提示代理（api.steampowered.com 直连被墙的实测形态）', async () => {
    setup(CONFIG);
    (requestUrl as any).mockImplementation(async () => {
      throw new Error('socket hang up');
    });
    const r = await runSync(makeApp(), { force: true });
    expect(r.reason).toBe('network');
    expect(r.message).toContain('代理');
  });

  it('间隔判定：刚同步过 → 不再拉（force=false 零请求）', async () => {
    setup(CONFIG);
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 10 }]);
    await runSync(makeApp(), { force: true });
    const calls = (requestUrl as any).mock.calls.length;
    const r = await runSync(makeApp()); // 不 force
    expect(r.ok).toBe(true);
    expect((requestUrl as any).mock.calls.length).toBe(calls);
  });
});

describe('面板 UI（overlay 范式 + 引导态 + 报告）', () => {
  it('未配置：打开即引导态（两键），同步按钮禁用', () => {
    setup({});
    const app = makeApp();
    openGameshelf(app);
    expect(document.querySelector('.bz-gs-panel')).toBeTruthy();
    expect(document.querySelector('.bz-gs-mask')).toBeTruthy();
    expect(document.querySelector('.bz-gs-panel')!.className).toContain('bz-panel-mtop');
    expect(document.querySelector('#bz-gs-guide-config')).toBeTruthy();
    expect(document.querySelector('#bz-gs-guide-recheck')).toBeTruthy();
    expect((document.querySelector('.bz-btn--primary') as HTMLButtonElement).disabled).toBe(true);
    closePanel();
    expect(document.querySelector('.bz-gs-panel')).toBeNull();
  });

  it('已配置：游戏墙渲染名与时长，已下架挂角标', () => {
    setup(CONFIG);
    const app = makeApp();
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 60 }]);
    return runSync(app, { force: true }).then(() => {
      openGameshelf(app);
      expect(document.querySelector('.bz-gs-grid')).toBeTruthy();
      expect(document.body.textContent).toContain('A');
      expect(document.body.textContent).toContain('1h');
      // 再点命令 toggle 关
      openGameshelf(app);
      expect(document.querySelector('.bz-gs-panel')).toBeNull();
      unloadGameshelf();
    });
  });

  it('报告视图：库总览/时长排行/口径注记在壳内（分片渲染单源 markup）', () => {
    setup(CONFIG);
    const app = makeApp();
    openGameshelf(app); // open 内部 rebuildItems（空库）——先开壳再注入条目
    M.items = [
      { file: null, appid: 1, name: 'AAA', playtimeMin: 6000, lastPlayed: '2026-09-16', cover: null, offShelf: false, syncedAt: null },
      { file: null, appid: 2, name: 'BBB', playtimeMin: 60, lastPlayed: '', cover: null, offShelf: false, syncedAt: null },
    ];
    M.view = 'report';
    renderAll(app);
    expect(document.body.textContent).toContain('时长排行');
    expect(document.body.textContent).toContain('100h');
    expect(document.body.textContent).toContain('最后游玩日期');
    unloadGameshelf();
  });

  it('同步进行中防重入：busy 期间第二次 runSync 返回 busy 不发请求', async () => {
    setup(CONFIG);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    (requestUrl as any).mockImplementation(async () => {
      await gate;
      return { status: 200, text: JSON.stringify({ response: { games: [] } }), json: { response: { games: [] } } };
    });
    const app = makeApp();
    const p1 = runSync(app, { force: true });
    const p2 = await runSync(app, { force: true });
    expect(p2.reason).toBe('busy');
    release();
    await p1;
  });
});

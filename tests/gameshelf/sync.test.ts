/**
 * 游戏库同步链路 + 面板 UI 测试（issue 368）：
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
import { openGameshelf, openGameshelfStats, syncGameshelf, unloadGameshelf } from '../../src/gameshelf';
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

/** 测试条目工厂（GameItem 全文；只关心少数字段时也能一眼看清默认值） */
function item(appid: number, name: string, playtimeMin: number, lastPlayed = '', offShelf = false) {
  return {
    file: null, appid, name, zhName: null, playtimeMin, lastPlayed,
    cover: null, coverSrc: null, icon: null, iconSrc: null,
    windowsMin: playtimeMin, deckMin: 0, macMin: 0, linuxMin: 0, hasAch: false,
    offShelf, syncedAt: null,
  };
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

  it('库内无变化：状态行留空（不再写「同步完成：库内无变化」）', async () => {
    setup(CONFIG);
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 60 }]);
    const app = makeApp();
    await runSync(app, { force: true });
    expect(M.statusMsg).toContain('新增 1');
    const again = await runSync(app, { force: true }); // 数值一致 → 无变化
    expect(again.ok).toBe(true);
    expect(M.statusMsg).toBe('');
  });
});

describe('面板 UI（core 面板壳 + 引导态 + 游戏墙）', () => {
  it('未配置：打开即引导态（两键），同步按钮禁用', () => {
    setup({});
    const app = makeApp();
    openGameshelf(app);
    expect(document.querySelector('.bz-gs-panel')).toBeTruthy();
    // 面板基座 = core .bz-panel-overlay（13 域同款），域内不再自造遮罩
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    expect(document.querySelector('.bz-gs-panel')!.className).toContain('bz-panel-frame');
    expect(document.querySelector('.bz-gs-panel')!.className).toContain('bz-panel-mtop');
    // 回归钉（2026-09-17 真机「只有遮罩没有主窗口」）：frame 必须是遮罩的**子节点**——
    // 居中的是 .bz-panel-overlay（fixed inset:0 + flex 居中），.bz-panel-frame 自身零定位，
    // 挂到 body 上就落进文档流，真机里被 Obsidian 的 .app-container 顶到视口外。
    const mask = document.querySelector('.bz-panel-overlay')!;
    const frame = document.querySelector('.bz-gs-panel')!;
    expect(frame.parentElement).toBe(mask);
    expect(mask.parentElement).toBe(document.body);
    expect(mask.children.length).toBe(1);
    expect(document.querySelector('#bz-gs-guide-config')).toBeTruthy();
    expect(document.querySelector('#bz-gs-guide-recheck')).toBeTruthy();
    // 头行退役：同步钮是海报右上角的图标钮，未配置时置灰
    expect((document.querySelector('#bz-gs-heroops [title="立即同步"]') as HTMLButtonElement).disabled).toBe(true);
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
      // 工具行两套形态（CSS 按屏宽取一套，状态同一份）：桌面 chips 6 + 三档分段；
      // 移动端两个下拉（档位/排序）
      expect(document.querySelectorAll('.bz-gs-chips .bz-chip').length).toBe(6);
      expect(document.querySelector('.bz-gs-sortseg .bz-segmented')).toBeTruthy();
      expect(document.querySelectorAll('.bz-gs-sels .bz-select').length).toBe(2);
      // 游戏墙标记：移动端「搜索行固定（滚动权在网格）」那套 CSS 认它（data-view=shelf）
      expect(document.querySelector('#bz-gs-body')!.getAttribute('data-view')).toBe('shelf');
      // 海报右上角常驻操作（头行退役）：统计在同步左侧，关闭钮在（桌面由 CSS 隐藏）
      const ops = [...document.querySelectorAll('#bz-gs-heroops .bz-icon-btn')];
      expect(ops.findIndex((e) => e.getAttribute('title') === '数据统计')).toBeLessThan(
        ops.findIndex((e) => e.getAttribute('title') === '立即同步'),
      );
      expect(document.querySelector('.bz-gs-close')).toBeTruthy();
      // 再点命令 toggle 关
      openGameshelf(app);
      expect(document.querySelector('.bz-gs-panel')).toBeNull();
      unloadGameshelf();
    });
  });

  it('数据统计视图：总览卡/时长排行/档位分布/年份分布/口径注记在壳内', () => {
    setup(CONFIG);
    const app = makeApp();
    openGameshelf(app); // open 内部 rebuildItems（空库）——先开壳再注入条目
    M.items = [
      item(1, 'AAA', 6000, '2026-09-16'),
      item(2, 'BBB', 60, ''),
    ];
    M.view = 'stats';
    renderAll(app);
    expect(document.body.textContent).toContain('时长排行');
    expect(document.body.textContent).toContain('100h');
    expect(document.body.textContent).toContain('时长档位分布');
    expect(document.body.textContent).toContain('最后游玩年份分布');
    expect(document.body.querySelectorAll('.bz-stat').length).toBe(5);
    expect(document.body.textContent).toContain('没有逐日游玩时长');
    // 统计页不带游戏墙标记 → 移动端那套「滚动权在网格」的布局不套到统计页（统计页仍整页滚动）
    expect(document.querySelector('#bz-gs-body')!.hasAttribute('data-view')).toBe(false);
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

describe('命令入口（2026-09-17 首页右键菜单 / 长按抽屉）：立即同步 + 数据统计', () => {
  it('立即同步：不开面板也能拉库落盘（面板全程未挂）', async () => {
    setup(CONFIG);
    mockSteam([{ appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 65214 }]);
    await syncGameshelf(makeApp());
    expect(vault.files.has(`${DEFAULT_FOLDER}/《Deep Rock Galactic》.md`)).toBe(true);
    expect(M.currentOverlay).toBeNull();
    expect([...document.querySelectorAll('.bz-notice')].some((n) => n.textContent.includes('游戏库已同步'))).toBe(true);
  });

  it('立即同步：库内无变化 → 「已同步，暂无变化」（命令是显式意图，不能静默）', async () => {
    setup(CONFIG);
    mockSteam([{ appid: 1, name: 'A', playtime_forever: 60 }]);
    const app = makeApp();
    await syncGameshelf(app);
    document.querySelectorAll('.bz-notice').forEach((n) => n.remove());
    await syncGameshelf(app);
    expect([...document.querySelectorAll('.bz-notice')].some((n) => n.textContent.includes('暂无变化'))).toBe(true);
  });

  it('立即同步：未配置 → 指引一条；进行中 → busy 明话（不重复拉）', async () => {
    setup({});
    await syncGameshelf(makeApp());
    expect([...document.querySelectorAll('.bz-notice')].some((n) => n.textContent.includes('尚未配置'))).toBe(true);
    document.querySelectorAll('.bz-notice').forEach((n) => n.remove());
    setup(CONFIG);
    M.syncing = true; // 模拟同步在途（面板「立即同步」已防重入，命令路径靠 runSync 兜底）
    await syncGameshelf(makeApp());
    expect([...document.querySelectorAll('.bz-notice')].some((n) => n.textContent.includes('同步已在进行中'))).toBe(true);
  });

  it('数据统计：直开面板落统计页；已开时就地切页不重开；缺省打开仍落游戏墙', async () => {
    setup(CONFIG);
    const app = makeApp();
    mockSteam([{ appid: 1, name: 'AAA', playtime_forever: 6000 }]);
    await syncGameshelf(app); // 库里得有一篇笔记，rebuildItems 才读得到
    openGameshelfStats(app);
    expect(document.querySelectorAll('.bz-gs-panel').length).toBe(1);
    expect(M.view).toBe('stats');
    expect(document.body.textContent).toContain('时长排行');
    expect(document.body.querySelectorAll('.bz-stat').length).toBe(5);
    openGameshelfStats(app); // 已开 → 就地切页（面板不重建、不叠加）
    expect(document.querySelectorAll('.bz-gs-panel').length).toBe(1);
    expect(M.view).toBe('stats');
    closePanel();
    openGameshelf(app); // openPanel 的 view 参数缺省 = 游戏墙
    expect(M.view).toBe('shelf');
    unloadGameshelf();
  });
});

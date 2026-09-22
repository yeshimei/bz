/**
 * 游戏库 UI v3 测试（V1 海报墙落域批）：
 * 海报墙 markup（门面/网格/排名角标/下架置灰）、数据统计面板、筛选与排序、
 * 详情弹窗全量数据（商店元数据 + 成就明细 + frontmatter 缓存兜底）。
 * 纯 markup 函数直断言字符串/DOM；端到端部分 mock requestUrl 走真加载链。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, displayNameOf, resetGameshelfState, type GameItem } from '../../src/gameshelf/state';
import { achListHtml, bindShotReel, detailShellHtml, filterList, heroHtml, hoursOf, numText, renderAll, shelfHtml, shotReelHtml, sortList, statsHtml, storeRowsHtml } from '../../src/gameshelf/ui';
import { buildReport } from '../../src/gameshelf/report';
import { fmToStore, storeToFm } from '../../src/gameshelf/detail';
import { parseAchievementRows, parseStoreMeta, parseReviews, parseZhName } from '../../src/gameshelf/steam';
import { openGameshelf, unloadGameshelf } from '../../src/gameshelf/index';

const CONFIG = { gameshelfSteamId: '76561198366147295', gameshelfSteamApiKey: 'k'.repeat(32) };

function item(appid: number, name: string, playtimeMin: number, lastPlayed = '', offShelf = false, hasAch = false, zhName: string | null = null): GameItem {
  return {
    file: null, appid, name, zhName, playtimeMin, lastPlayed,
    cover: `https://cdn/${appid}.jpg`, coverSrc: `https://cdn/${appid}.jpg`, icon: null, iconSrc: null,
    windowsMin: playtimeMin, deckMin: 0, macMin: 0, linuxMin: 0, hasAch, offShelf, syncedAt: '2026-09-17T05:35:19.664Z',
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetGameshelfState();
  resetObsidianMocks();
  setApp({ vault: { getMarkdownFiles: () => [], getAbstractFileByPath: () => null, createFolder: async () => {} } } as any);
  setSettingsProvider(() => CONFIG as any);
});

describe('海报墙 markup', () => {
  it('门面：排口标签 + 名字 + 时长副行 + 三个总览数字', () => {
    const list = [item(548430, 'Deep Rock Galactic', 65214, '2026-07-20'), item(1, 'B', 60)];
    const rp = buildReport(list);
    const html = heroHtml(list[0], 'https://cdn/548430.jpg', rp);
    expect(html).toContain('时长第一');
    expect(html).toContain('Deep Rock Galactic');
    expect(html).toContain('1,087 小时');
    expect(html).toContain('2026-07-20');
    expect(html).toContain('在架游戏');
    expect(html).toContain('从未启动');
    expect(html).toContain('background-image:url(\'https://cdn/548430.jpg\')');
  });

  it('网格：卡片数与数据一致，排名角标只给前三，下架挂角标并置灰', () => {
    const list = [item(1, 'A', 600), item(2, 'B', 500), item(3, 'C', 400), item(4, 'D', 300, '', true)];
    const html = shelfHtml(list, (it) => it.cover ?? '', { showRank: true });
    expect((html.match(/data-appid="/g) ?? []).length).toBe(4);
    expect(html).toContain('NO.1');
    expect(html).toContain('NO.3');
    expect(html).not.toContain('NO.4');
    expect(html).toContain('bz-gs-card--off');
    expect(html).toContain('已下架');
    // achOf 缺省（无成就数据）→ 进度条整条不渲染
    expect(html).not.toContain('bz-gs-strip');
  });

  it('未筛选关闭排名角标（换口径的序号没有意义）', () => {
    const list = [item(1, 'A', 600)];
    expect(shelfHtml(list, () => '')).not.toContain('NO.1');
  });

  it('进度条改成就口径（issue 378）：宽度 = 已解/总数，全成就满条挂奖杯，无成就页不渲染', () => {
    const list = [item(1, 'A', 60, '', false, true), item(2, 'B', 60), item(3, 'C', 60, '', false, true)];
    const achOf = (it: GameItem) => (it.appid === 1 ? { unlocked: 69, total: 69 } : it.appid === 3 ? { unlocked: 10, total: 28 } : null);
    const html = shelfHtml(list, (it) => it.cover ?? '', { achOf });
    expect((html.match(/bz-gs-strip/g) ?? []).length).toBe(2); // 无成就页的 B 不渲染条
    expect(html).toContain('width:100%'); // 69/69 满条
    expect(html).toContain('is-full');
    expect((html.match(/bz-gs-trophy/g) ?? []).length).toBe(1); // 只有全成就挂杯
    expect(html).toContain('bz-gs-trophy" title="全成就达成">🏆</span>'); // 🏆 字符角标（2026-09-19 点版：lucide 线性杯弃用）
    expect(html).not.toContain('data-lucide="trophy"'); // 不能带 lucide 标记，否则 mountIcons 会把字符换成 SVG
    expect(html).toContain('width:36%'); // 10/28 ≈ 36%
  });

  it('卡片不挂 title（悬浮不弹游戏名原生提示，2026-09-19 点版）', () => {
    const zh = item(1, 'Deep Rock Galactic', 65214, '2026-07-20', false, false, '深岩银河');
    const html = shelfHtml([zh], (it) => it.cover ?? '');
    expect(html).toMatch(/<button type="button" class="bz-gs-card" data-appid="1">/);
    expect(html).not.toContain('title="深岩银河 · Deep Rock Galactic"');
  });

  it('无封面走占位：首字 data-initial + 不注入 img', () => {
    const html = shelfHtml([item(1, "Balatro", 100)], () => "");
    expect(html).toContain('data-initial="B"');
    expect(html).not.toContain('<img');
  });
});

describe('筛选与排序（单一出口：filterList/sortList）', () => {
  const lib = [
    item(1, 'Beta', 30, '2026-01-01'),
    item(2, 'Alpha', 100, '2026-08-01'),
    item(3, 'Gamma', 6000, '2024-03-02'),
    item(4, 'Delta', 300, ''),
    item(5, 'Epsilon', 0, '2026-02-02'),
  ];

  it('档位筛选命中区间：10 小时以内含不足 1 小时，但排除未启动', () => {
    M.bucket = 'b1'; // 「10 小时以内」= 玩过但不足 10 小时；0 分钟走「从未启动」档，不在此列
    expect(filterList(lib).map((g) => g.name)).toEqual(['Beta', 'Alpha', 'Delta']);
    M.bucket = 'idle';
    expect(filterList(lib).map((g) => g.name)).toEqual(['Epsilon']);
    M.bucket = 'b10'; // 10-50 小时
    expect(filterList(lib).map((g) => g.name)).toEqual([]);
    M.bucket = 'b50'; // 50-200 小时（Gamma 100 h）
    expect(filterList(lib).map((g) => g.name)).toEqual(['Gamma']);
    M.bucket = 'b200'; // 200 小时以上（本组没有）
    expect(filterList(lib).map((g) => g.name)).toEqual([]);
    M.bucket = 'all';
    expect(filterList(lib)).toHaveLength(5);
  });

  it('搜索按名称模糊（大小写不敏感）', () => {
    M.bucket = 'all';
    M.query = 'alp';
    expect(filterList(lib).map((g) => g.name)).toEqual(['Alpha']);
  });

  it('三种排序：时长降 / 最近玩降（无日期排最后）/ 名称升', () => {
    M.sort = 'hours';
    expect(sortList(lib).map((g) => g.name)).toEqual(['Gamma', 'Delta', 'Alpha', 'Beta', 'Epsilon']);
    M.sort = 'last';
    expect(sortList(lib).map((g) => g.name)).toEqual(['Alpha', 'Epsilon', 'Beta', 'Gamma', 'Delta']);
    M.sort = 'name';
    expect(sortList(lib).map((g) => g.name)).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
  });
});

describe('数据统计面板', () => {
  it('五块俱全：排行/档位分布/年份分布/平台分项/口径注记', () => {
    const list = [
      item(1, 'AAA', 6000, '2026-08-01'),
      item(2, 'BBB', 0, ''),
      item(3, 'CCC', 3000, '2024-05-05'),
    ];
    const html = statsHtml(buildReport(list, new Date(2026, 8, 17).getTime()));
    expect(html).toContain('时长排行 · Top 10');
    expect(html).toContain('时长档位分布');
    expect(html).toContain('最后游玩年份分布');
    expect(html).toContain('平台分项时长');
    expect(html).toContain('最近玩过');
    expect(html).toContain('没有逐日游玩时长');   // 口径诚实注记
    expect(html).toContain('AAA');
    expect(html).toContain('100 h');              // 6000 分钟 = 100 小时
    expect(html).toContain('2026');
    expect(html).toContain('2024');
    expect(html).toContain('Windows');            // 平台分项（windowsMin 非 0）
  });

  it('空库不炸：各段退回占位文案', () => {
    const html = statsHtml(buildReport([]));
    expect(html).toContain('库里还没有游戏');
    expect(html).toContain('还没有带日期的游玩记录');
  });

  it('时长文案口径：千位分隔、≥100 取整、其余一位小数', () => {
    expect(numText(hoursOf(65214))).toBe('1,087');
    expect(numText(hoursOf(6000))).toBe('100');
    expect(numText(hoursOf(16606))).toBe('277');
    expect(numText(hoursOf(1500))).toBe('25');
    expect(numText(hoursOf(70))).toBe('1.2');
  });
});

describe('详情弹窗 markup', () => {
  it('骨架：速度块来自 frontmatter 缓存（未拉取也能显示最近一次的资料）', () => {
    const cached = { 类型: '动作、独立', 平台: 'Windows、Linux', 发行日期: '2020 年 5 月 13 日', 价格: '¥ 90', 简体中文支持: true, Metacritic: 85 };
    const html = detailShellHtml(item(548430, 'DRG', 65214, '2026-07-20', false, true), 'https://cdn/x.jpg', cached);
    expect(html).toContain('DRG');
    expect(html).toContain('动作、独立');
    expect(html).toContain('支持简体中文');
    expect(html).toContain('Metacritic 85');
    expect(html).toContain('我的游玩数据');
    expect(html).toContain('1,087');
    expect(html).toContain('AppID 548430');
    expect(html).toContain('id="bz-gs-detail-ach"');
    expect(html).toContain('id="bz-gs-detail-store"');
  });

  it('资料段：拿得到的行都出现，空字段整行不出现', () => {
    const meta = parseStoreMeta([{ success: true, data: {
      type: 'game',
      genres: [{ description: '动作' }],
      developers: ['Ghost Ship Studios'],
      publishers: ['Coffee Stain'],
      release_date: { date: '2020 年 5 月 13 日' },
      supported_languages: '英语, 简体中文',
      platforms: { windows: true, mac: false, linux: true },
      categories: [{ description: '单人' }, { description: '成就' }],
      metacritic: { score: 85 },
      recommendations: { total: 123456 },
      is_free: false,
      price_overview: { final_formatted: '¥ 90', discount_percent: 0 },
      website: 'https://example.com',
      short_description: '挖矿射击',
      screenshots: [{ path_full: 'https://shot/1.jpg' }],
      dlc: [1, 2, 3],
      achievements: { total: 69 },
      support_info: { url: 'https://support', email: 'a@b.c' },
    } }])!;
    const reviews = parseReviews({ query_summary: { review_score_desc: '特别好评', total_reviews: 1000, total_positive: 950, total_negative: 50 } });
    const html = storeRowsHtml(item(1, 'A', 60), { meta: { ...meta, ...reviews }, error: null, fromCache: false, screenshots: meta.screenshots });
    expect(html).toContain('开发商');
    expect(html).toContain('Ghost Ship Studios');
    expect(html).toContain('发行商');
    expect(html).toContain('Coffee Stain');
    expect(html).toContain('Windows、Linux');
    expect(html).toContain('单人、成就');
    expect(html).toContain('特别好评');
    expect(html).toContain('950');     // 好评数
    expect(html).toContain('1,000');   // 评测数千位分隔
    expect(html).toContain('Metacritic');
    expect(html).toContain('123,456'); // 推荐数
    expect(html).toContain('3 个');    // DLC
    expect(html).toContain('挖矿射击');
    expect(html).toContain('在商店打开');
    expect(html).not.toContain('没有成就'); // 无关文案不该串进来
  });

  it('资料段出错回落缓存：标 fromCache 提示，并写明错误', () => {
    const cached = fmToStore({ 开发商: '缓存里的开发商', 好评率: '多半好评' });
    const html = storeRowsHtml(item(1, 'A', 60), { meta: cached, error: null, fromCache: true, screenshots: [] });
    expect(html).toContain('缓存里的开发商');
    expect(html).toContain('多半好评');
    expect(html).toContain('上次同步时缓存');
  });

  it('成就段：进度 + 稀有行 + 逐条明细（解锁态/全球解锁率/描述）', () => {
    const detail = parseAchievementRows(
      { game: { availableGameStats: { achievements: [
        { name: 'A1', displayName: '初次挖掘', description: '挖一下', icon: 'https://i/1.jpg' },
        { name: 'A2', displayName: '全成就大佬', description: '全拿到' },
      ] } } },
      { playerstats: { achievements: [
        { apiname: 'A1', achieved: 1, unlocktime: 1700000000 },
        { apiname: 'A2', achieved: 0 },
      ] } },
      { achievementpercentages: { achievements: [{ name: 'A1', percent: 42.5 }, { name: 'A2', percent: 0.4 }] } },
    )!;
    expect(detail).toMatchObject({ total: 2, unlocked: 1, percent: 50, rarestName: '初次挖掘', rarestPercent: 42.5 });
    // 稀有度升序：0.4% 的未解锁成就排在 42.5% 的前面
    expect(detail.rows.map((r) => r.name)).toEqual(['全成就大佬', '初次挖掘']);
    const html = achListHtml(item(1, 'A', 60, '', false, true), { detail, summary: null, error: null, fromCache: false });
    expect(html).toContain('1 / 2（50%）');
    expect(html).toContain('稀有成就：初次挖掘（全球 42.5% 拥有）');
    expect(html).toContain('初次挖掘');
    expect(html).toContain('42.5%');
    expect(html).toContain('未解锁');
    // 成就图标**不落盘**（ADR-0176）：img src 直接吃 Schema 给的远端 URL，
    // 没有 icon 的行（A2）画占位方块而不是空白
    expect(html).toContain('class="bz-gs-achicon" src="https://i/1.jpg"');
    expect(html).toContain('bz-gs-achicon--none');
  });

  it('成就段拉不到但有缓存摘要：画进度条 + 说明缓存来源', () => {
    const html = achListHtml(item(1, 'A', 60), {
      detail: null, summary: { total: 69, unlocked: 30, rare: '硬核（全球 0.2% 拥有）' },
      error: '成就拉取失败：请检查网络与系统代理', fromCache: true,
    });
    expect(html).toContain('30 / 69');
    expect(html).toContain('硬核（全球 0.2% 拥有）');
    expect(html).toContain('请检查网络与系统代理');
    expect(html).toContain('上次同步缓存');
  });

  it('frontmatter 标量回写与回读闭环', () => {
    const meta = parseStoreMeta([{ success: true, data: {
      genres: [{ description: '独立' }], developers: ['A'], publishers: ['B'], release_date: { date: '2019' },
      supported_languages: '简体中文', platforms: { windows: true }, categories: [{ description: '单人' }],
      is_free: true, short_description: '简介', screenshots: [{ path_full: 'https://s/1.jpg' }],
    } }])!;
    const fm = storeToFm({ ...meta, reviewDesc: '好评如潮', reviewsTotal: 10, reviewsPositive: 9, reviewsNegative: 1 });
    expect(fm['简体中文支持']).toBe(true);
    expect(fm['价格']).toBe('免费');
    expect(fm['好评数']).toBe(9);
    expect(fm['详情时间']).toBeTruthy();
    const back = fmToStore(fm);
    expect(back).toMatchObject({ genres: '独立', developers: 'A', publishers: 'B', price: '免费', zhSupported: true, reviewsPositive: 9 });
  });
});

describe('中文名（展示名单源 / 搜索 / 排序 / 卡片）', () => {
  it('展示名中文优先，空串与 null 都回落原名', () => {
    expect(displayNameOf(item(1, 'Balatro', 60, '', false, false, '小丑牌'))).toBe('小丑牌');
    expect(displayNameOf(item(2, 'Balatro', 60))).toBe('Balatro');
    expect(displayNameOf(item(3, 'Balatro', 60, '', false, false, '   '))).toBe('Balatro');
  });

  it('搜索：原名与中文名都命中', () => {
    M.bucket = 'all';
    const lib = [item(1, 'Balatro', 60, '', false, false, '小丑牌'), item(2, 'Hades', 60, '', false, false, '哈迪斯')];
    M.query = 'balatro';
    expect(filterList(lib).map(displayNameOf)).toEqual(['小丑牌']);
    M.query = '哈迪斯';
    expect(filterList(lib).map(displayNameOf)).toEqual(['哈迪斯']);
  });

  it('名称排序按展示名（中文名优先）', () => {
    M.sort = 'name';
    const lib = [item(1, 'Zelda', 60, '', false, false, '阿尔法'), item(2, 'Alpha', 60, '', false, false, '贝塔')];
    expect(sortList(lib).map(displayNameOf)).toEqual(['阿尔法', '贝塔']);
  });

  it('卡片与门面：中文名主显 + 原名另起一行；中文名与原名相同则不出第二行', () => {
    const zh = item(1, 'Deep Rock Galactic', 65214, '2026-07-20', false, false, '深岩银河');
    const same = item(2, 'Bongo Cat', 600, '', false, false, 'Bongo Cat');
    const html = shelfHtml([zh, same], (it) => it.cover ?? "");
    expect(html).toContain('深岩银河');
    expect(html).toContain('Deep Rock Galactic');
    expect((html.match(/class="bz-gs-orig"/g) ?? []).length).toBe(1);
    const hero = heroHtml(zh, 'https://cdn/1.jpg', buildReport([zh, same]));
    expect(hero).toContain('bz-gs-hero-name" title="Deep Rock Galactic">深岩银河');
    expect(hero).toContain('bz-gs-hero-orig');
    expect(heroHtml(same, 'https://cdn/2.jpg', buildReport([zh, same]))).not.toContain('bz-gs-hero-orig');
  });

  it('统计排行与最近玩过也用展示名（原名只留在 tooltip）', () => {
    const zh = item(1, 'Deep Rock Galactic', 65214, '2026-07-20', false, false, '深岩银河');
    const html = statsHtml(buildReport([zh]));
    expect(html).toContain('>深岩银河<');
    expect(html).not.toContain('>Deep Rock Galactic<');
    expect(html).toContain('title="Deep Rock Galactic"');
  });

  it('parseZhName：取 appdetails 本地化名；空/缺 → null', () => {
    expect(parseZhName([{ success: true, data: { name: '深岩银河' } }])).toBe('深岩银河');
    expect(parseZhName([{ success: true, data: { name: '  ' } }])).toBeNull();
    expect(parseZhName([{ success: false }])).toBeNull();
    expect(parseZhName({})).toBeNull();
  });

  it('详情弹窗：中文名做主标题，原名写进 AppID 行', () => {
    const zh = item(548430, 'Deep Rock Galactic', 65214, '2026-07-20', false, true, '深岩银河');
    const html = detailShellHtml(zh, 'https://cdn/x.jpg', {});
    expect(html).toContain('深岩银河');
    expect(html).toContain('原名 Deep Rock Galactic · AppID 548430');
  });
});

describe('详情弹窗端到端（mock requestUrl：商店 + 成就三接口）', () => {
  beforeEach(() => {
    (requestUrl as any).mockImplementation(async (opts: { url: string }) => {
      const u = opts.url;
      let json: unknown = {};
      if (u.includes('appdetails')) {
        json = [{ success: true, data: {
          type: 'game', genres: [{ description: '动作' }], developers: ['Ghost Ship Studios'],
          release_date: { date: '2020 年 5 月 13 日' }, supported_languages: '英语, 简体中文',
          platforms: { windows: true }, categories: [{ description: '单人' }], is_free: true,
          short_description: '挖矿射击', header_image: 'https://h/x.jpg',
        } }];
      } else if (u.includes('appreviews')) {
        json = { query_summary: { review_score_desc: '特别好评', total_reviews: 1000, total_positive: 950, total_negative: 50 } };
      } else if (u.includes('GetSchemaForGame')) {
        json = { game: { availableGameStats: { achievements: [{ name: 'A1', displayName: '初次挖掘', description: '挖一下' }] } } };
      } else if (u.includes('GetPlayerAchievements')) {
        json = { playerstats: { achievements: [{ apiname: 'A1', achieved: 1, unlocktime: 1700000000 }] } };
      } else if (u.includes('GlobalAchievementPercentages')) {
        json = { achievementpercentages: { achievements: [{ name: 'A1', percent: 7.5 }] } };
      }
      return { status: 200, text: JSON.stringify(json), json };
    });
  });

  it('点卡片 → 弹窗拉全量数据（资料段与成就段各自填装）', async () => {
    const app = { vault: { getMarkdownFiles: () => [], getAbstractFileByPath: () => null, createFolder: async () => {} } } as any;
    openGameshelf(app); // 内部 rebuildItems 会清空 M.items（假库里没文件）→ 之后再注入
    M.items = [item(548430, 'Deep Rock Galactic', 65214, '2026-07-20', false, true)];
    renderAll(app);
    const card = document.querySelector('.bz-gs-card') as HTMLElement;
    expect(card).toBeTruthy();
    card.click();
    await vi.waitFor(() => {
      expect(document.querySelector('#bz-gs-detail-store')!.textContent).toContain('Ghost Ship Studios');
    });
    const store = document.querySelector('#bz-gs-detail-store')!;
    expect(store.textContent).toContain('动作');
    expect(store.textContent).toContain('特别好评');
    expect(store.textContent).toContain('挖矿射击');
    expect(store.textContent).toContain('在商店打开');
    const ach = document.querySelector('#bz-gs-detail-ach')!;
    await vi.waitFor(() => {
      expect(ach.textContent).toContain('初次挖掘');
    });
    expect(ach.textContent).toContain('1 / 1（100%）');
    expect(ach.textContent).toContain('7.5%');
    unloadGameshelf();
  });
});

describe('海报头与悬浮预览（issue 378：头行退役 / 截图快轮播 / 门面换脸）', () => {
  it('shotReelHtml：全套截图叠放，首张亮（is-on 只有一枚），原图留在 data-shot-full', () => {
    const html = shotReelHtml(['https://s/1.jpg', 'https://s/2.jpg', 'https://s/3.jpg']);
    expect((html.match(/class="bz-gs-reel"/g) ?? []).length).toBe(1);
    expect((html.match(/<img /g) ?? []).length).toBe(3);
    expect((html.match(/is-on/g) ?? []).length).toBe(1);
    expect(html.indexOf('s/1.jpg')).toBeLessThan(html.indexOf('s/2.jpg'));
    expect(html).toContain('data-shot-full="https://s/2.jpg"');
  });

  it('heroHtml peek 态：口径标签隐去（描述列表首位为何是它的标签，挂在悬浮款头上是假信息）', () => {
    const rp = buildReport([item(1, 'A', 600)]);
    expect(heroHtml(item(1, 'A', 600), 'https://c/1.jpg', rp)).toContain('bz-gs-hero-tag');
    expect(heroHtml(item(1, 'A', 600), 'https://c/1.jpg', rp, '', true)).not.toContain('bz-gs-hero-tag');
    expect(heroHtml(item(1, 'A', 600), 'https://c/1.jpg', rp, '', true)).toContain('bz-gs-hero-name');
  });

  it('面板壳：头行退役——没有标题/N款，海报右上角只剩三枚图标钮（统计/同步/移动端关闭）', () => {
    const app = { vault: { getMarkdownFiles: () => [], getAbstractFileByPath: () => null, createFolder: async () => {} } } as any;
    openGameshelf(app);
    M.items = [item(1, 'A', 600), item(2, 'B', 100)];
    renderAll(app);
    expect(document.querySelector('.bz-main-head')).toBeNull();
    expect(document.querySelector('.bz-main-title')).toBeNull();
    const ops = document.querySelector('#bz-gs-heroops')!;
    expect((ops.querySelectorAll('.bz-icon-btn').length)).toBe(3);
    expect(ops.querySelector('[title="数据统计"]')).toBeTruthy();
    expect(ops.querySelector('[title="立即同步"]')).toBeTruthy();
    // 关闭钮桌面隐藏（点遮罩/ESC 出门），仍在 DOM 里给移动端用
    expect(ops.querySelector('.bz-gs-close')).toBeTruthy();
    // 门面顶格：海报头是 frame 直接子节点（body 之外），统计视图也在
    expect(document.querySelector('.bz-gs-heroz > #bz-gs-hero')).toBeTruthy();
    unloadGameshelf();
  });

  it('悬浮：卡片海报换成截图快轮播（只轮已就绪的图）+ 门面换脸防抖，离开复原', () => {
    vi.useFakeTimers();
    try {
      const app = {
        vault: { getMarkdownFiles: () => [], getAbstractFileByPath: () => null, createFolder: async () => {} },
        metadataCache: { getFileCache: (f: any) => (f?.__fm ? { frontmatter: f.__fm } : null) },
      } as any;
      const shots = { 截图源: [
        'https://cdn/ss_a.1920x1080.jpg',
        'https://cdn/ss_b.1920x1080.jpg',
        'https://cdn/ss_c.1920x1080.jpg',
      ] };
      const a = item(1, 'AAA', 6000);
      const b = item(2, 'BBB', 600);
      (b as any).file = { __fm: shots };
      openGameshelf(app);
      M.items = [a, b];
      renderAll(app);
      const body = document.querySelector('#bz-gs-body') as HTMLElement;
      expect(body).toBeTruthy();
      bindShotReel(app, body, true); // jsdom 无真 hover 能力，显式开

      const hero = () => document.querySelector('#bz-gs-hero')!.innerHTML;
      expect(hero()).toContain('AAA'); // 静息态门面 = 列表首位（按时长）

      const cardB = document.querySelector('.bz-gs-card[data-appid="2"]') as HTMLElement;
      cardB.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      // 卡片：reel 落位、三张叠放、首张亮；展示 src 走缩略图定式，原图留在 data-shot-full
      const reel = cardB.querySelector('.bz-gs-reel')!;
      const imgs = [...reel.querySelectorAll('img')];
      expect(imgs).toHaveLength(3);
      expect(reel.querySelector('img.is-on')).toBe(imgs[0]);
      expect(imgs[0].getAttribute('src')).toBe('https://cdn/ss_a.600x338.jpg');
      expect(imgs[0].getAttribute('data-shot-full')).toBe('https://cdn/ss_a.1920x1080.jpg');
      // 门面：正脸换成 BBB（口径标签隐去）
      expect(hero()).toContain('BBB');
      expect(hero()).not.toContain('bz-gs-hero-tag');
      // 门面防抖：同款重复悬浮（子元素边界连环 mouseover）不重写正脸
      const heroNode = document.querySelector('#bz-gs-hero')!.firstElementChild;
      cardB.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(document.querySelector('#bz-gs-hero')!.firstElementChild).toBe(heroNode);

      // 轮转只认「已就绪」的图（complete + 解码出尺寸）：没图就绪 → 原地不动，不亮空框
      vi.advanceTimersByTime(300);
      expect(reel.querySelector('img.is-on')).toBe(imgs[0]);
      // 第 2 张就绪 → 下个节拍轮到它；之后没有别的就绪图 → 原地守着
      Object.defineProperty(imgs[1], 'complete', { value: true });
      Object.defineProperty(imgs[1], 'naturalWidth', { value: 600 });
      vi.advanceTimersByTime(300);
      expect(reel.querySelector('img.is-on')).toBe(imgs[1]);
      vi.advanceTimersByTime(300);
      expect(reel.querySelector('img.is-on')).toBe(imgs[1]);

      // 悬浮没截图的款：门面照常换脸，卡片封面不动（无 reel）
      const cardA = document.querySelector('.bz-gs-card[data-appid="1"]') as HTMLElement;
      cardA.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(hero()).toContain('AAA');
      expect(cardA.querySelector('.bz-gs-reel')).toBeNull();
      expect(cardB.querySelector('.bz-gs-reel')).toBeNull(); // 换卡时上一张的轮播已摘

      // 离开：轮播摘除、门面回静息态快照；再推进若干节拍不再轮转
      cardA.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
      expect(cardA.querySelector('.bz-gs-reel')).toBeNull();
      expect(hero()).toContain('AAA');
      expect(hero()).toContain('时长第一');
      const after = hero();
      vi.advanceTimersByTime(2100);
      expect(hero()).toBe(after);
    } finally {
      vi.useRealTimers();
      unloadGameshelf();
    }
  });

  it('悬浮能力关（触屏/jsdom 默认）：不挂监听，悬浮无副作用', () => {
    const app = { vault: { getMarkdownFiles: () => [], getAbstractFileByPath: () => null, createFolder: async () => {} } } as any;
    openGameshelf(app);
    M.items = [item(1, 'AAA', 6000)];
    renderAll(app);
    const body = document.querySelector('#bz-gs-body') as HTMLElement;
    bindShotReel(app, body, false);
    const card = document.querySelector('.bz-gs-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(card.querySelector('.bz-gs-reel')).toBeNull();
    unloadGameshelf();
  });
});

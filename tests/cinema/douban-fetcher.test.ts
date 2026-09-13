// @vitest-environment jsdom
/**
 * 影院豆瓣抓取核心测试（issue 303 / ADR-0129，jsdom：端到端用 vault.process/writeBinary）：
 * - 纯函数：parseSearchResults / searchLooksBlocked（风控检测）/ upgradePosterUrl /
 *   extractSid / parseCelebrities / extractMovieName / normalizeListValue（C2 逗号归一）/
 *   updateFrontmatterFields（C3 换行单行化 / C8 ifMissing 缺失才填）/ insertPosterEmbed
 *   （C4 无尾换行形态；正则口径对齐 douban-client.js / note-processor.js）；
 * - ApiZero 客户端：字段解析 / code!=0 错误态 → null；
 * - fetchNoteDouban 端到端（fake 注入）：ApiZero 主链 / 无 key rexxar 兜底 /
 *   ApiZero 缺导演主演 rexxar 补 / 搜索风控 → blocked / 无结果 → notfound /
 *   网络异常 → network（C6）/ 海报下载失败 → network、写盘失败 → write（C6 拆分）/
 *   海报下载写盘 + embed 插入 / 已齐全跳过 / 存量退役字段不覆盖 /
 *   C1 剧集不写季集 / C8 抓取中途用户手改不被覆盖 / C9 六字段缺失才填。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import {
  parseSearchResults, searchLooksBlocked, upgradePosterUrl, extractSid, parseCelebrities,
  extractMovieName, normalizeListValue, updateFrontmatterFields, insertPosterEmbed,
  fetchApizeroInfo, fetchNoteDouban,
  POSTER_FOLDER, type HttpGet, type DoubanFetchDeps,
} from '../../src/cinema/douban-fetcher';

beforeEach(() => {
  resetObsidianMocks();
});

// ---------- 纯函数 ----------

// 夹具垫到真实搜索页量级（实测正常页 >20KB；风控拦截页约 3KB——尺寸本身是风控信号）
const SEARCH_HTML = `<!DOCTYPE html><html><head><style>${'x'.repeat(20000)}</style></head><body><div class="result"><div class="pic"><a href="//www.douban.com/link2/?url=https%3A%2F%2Fmovie.douban.com%2Fsubject%2F35267208%2F" title="The Wandering Earth II"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2916835424.jpg"></a></div><div class="title"><a href="#">流浪地球2</a></div></div>
<div class="result"><div class="pic"><a href="https://movie.douban.com/subject/999/" ><img src="https://img9.doubanio.com/x.jpg"></a></div><div class="title"><a>直接链接条目</a></div></div></html>`;

describe('parseSearchResults（照搬守护正则）', () => {
  it('result 块提取标题/详情链接（link2 解码）/海报 URL', () => {
    const rs = parseSearchResults(SEARCH_HTML);
    expect(rs).toHaveLength(2);
    expect(rs[0].title).toBe('流浪地球2');
    expect(rs[0].detailUrl).toBe('https://movie.douban.com/subject/35267208/');
    expect(rs[0].posterUrl).toContain('s_ratio_poster');
    expect(rs[1].detailUrl).toBe('https://movie.douban.com/subject/999/');
  });

  it('无结果页返回空数组', () => {
    expect(parseSearchResults('<html>没有找到相关结果</html>')).toEqual([]);
  });
});

describe('searchLooksBlocked（风控页检测）', () => {
  it('短响应/无结构判风控；正常搜索页与空态页放行', () => {
    // 实测拦截页形态：约 3KB、title 只有「豆瓣」、无 result 结构
    const blocked = '<!DOCTYPE html><html><head><title>豆瓣</title><style type="t' + 'x'.repeat(2500) + '</style></head><body></body></html>';
    expect(searchLooksBlocked(blocked)).toBe(true);
    expect(searchLooksBlocked(null)).toBe(true);
    expect(searchLooksBlocked(SEARCH_HTML)).toBe(false);
    // 正常「无结果」空态页（>8KB、含空态文案）不放行为风控
    const empty = '<html>' + 'x'.repeat(9000) + '没有找到相关的搜索结果</html>';
    expect(searchLooksBlocked(empty)).toBe(false);
  });
});

describe('upgradePosterUrl / extractSid / extractMovieName', () => {
  it('海报升级 s→l；sid 提取；片名剥离书名号', () => {
    expect(upgradePosterUrl('https://img9.doubanio.com/view/photo/s_ratio_poster/public/p1.jpg')).toContain('l_ratio_poster');
    expect(extractSid('https://movie.douban.com/subject/35267208/')).toBe('35267208');
    expect(extractSid('https://movie.douban.com/')).toBeNull();
    expect(extractMovieName('《流浪地球2》.md')).toBe('流浪地球2');
    expect(extractMovieName('肖申克的救赎.md')).toBe('肖申克的救赎');
  });
});

describe('parseCelebrities（照搬守护口径）', () => {
  it('导演/编剧（roles 匹配）/主演截前 6；msg 风控形态返回空', () => {
    const data = {
      directors: [{ name: '郭帆' }],
      celebrities: [
        { name: '龚格尔', roles: ['编剧', '演员'] },
        { name: '吴京', roles: ['演员'] },
      ],
      actors: [{ name: '吴京' }, { name: '刘德华' }, { name: '李雪健' }, { name: '沙溢' }, { name: '宁理' }, { name: '王智' }, { name: '第七人' }],
    };
    const c = parseCelebrities(data);
    expect(c.directors).toBe('郭帆');
    expect(c.writers).toBe('龚格尔');
    expect(c.casts.split(' / ')).toHaveLength(6);
    expect(parseCelebrities({ msg: '风控' })).toEqual({ directors: '', writers: '', casts: '' });
  });
});

describe('normalizeListValue（C2：ApiZero 逗号 → 消费端 " / " 切分口径）', () => {
  it('半角/全角逗号及后置空格归一为 " / "；已是 " / " 不重复替换', () => {
    expect(normalizeListValue('吴京, 刘德华')).toBe('吴京 / 刘德华');
    expect(normalizeListValue('科幻,灾难')).toBe('科幻 / 灾难');
    expect(normalizeListValue('科幻， 灾难')).toBe('科幻 / 灾难');
    expect(normalizeListValue('科幻，灾难,剧情')).toBe('科幻 / 灾难 / 剧情');
    expect(normalizeListValue('科幻 / 灾难')).toBe('科幻 / 灾难');
    expect(normalizeListValue('郭帆')).toBe('郭帆');
  });
});

describe('updateFrontmatterFields / insertPosterEmbed（note-processor 口径）', () => {
  it('新字段插 tags 列表后；已有字段原地更新；空值跳过', () => {
    const content = '---\ntags:\n  - 电影\n评分: 8\n---\n正文';
    const next = updateFrontmatterFields(content, { '海报': 'CONFIG/MOVIE POSTER/a.jpg', '评分': '9.4', '简介': '' });
    expect(next).toContain('海报: "CONFIG/MOVIE POSTER/a.jpg"');
    expect(next).toMatch(/评分: 9\.4/);
    expect(next).not.toContain('简介');
    // tags 列表后插入（不移到最前）
    expect(next.indexOf('海报:')).toBeGreaterThan(next.indexOf('- 电影'));
    expect(next.endsWith('正文')).toBe(true);
  });

  it('值含空格/冒号加引号；无 frontmatter 新建', () => {
    const next = updateFrontmatterFields('正文', { '豆瓣链接': 'https://movie.douban.com/subject/1/' });
    expect(next).toMatch(/^---\n豆瓣链接: "https:\/\/movie\.douban\.com\/subject\/1\/"\n---\n正文/);
  });

  it('C3：值含换行 → 序列化单行化（不裸写 \n 进 frontmatter），值可读回', () => {
    const content = '---\ntags: [电影]\n---\n正文';
    const next = updateFrontmatterFields(content, { '热门短评': '第一行\n第二行\r\n第三行' });
    // 该行单行化（无裸换行），多行压成单空格
    expect(next).toMatch(/^热门短评: "第一行 第二行 第三行"$/m);
    // 写回结果仍是可解析的 frontmatter + 原正文
    const fm = parseFrontmatter(next);
    expect(fm?.['热门短评']).toBe('第一行 第二行 第三行');
    expect(next.endsWith('正文')).toBe(true);
  });

  it('C8：ifMissing 字段已有值则跳过（不覆盖），缺失则写入', () => {
    const content = '---\ntags: [电影]\n豆瓣评分: 9.9\n---\n正文';
    const next = updateFrontmatterFields(content, {
      '豆瓣评分': { value: '8.3', ifMissing: true },
      '导演': { value: '郭帆', ifMissing: true },
    });
    expect(next).toMatch(/^豆瓣评分: 9\.9$/m); // 已有值保留
    expect(next).toContain('导演: 郭帆');       // 缺失则写入
  });

  it('insertPosterEmbed 插到 frontmatter 后；已存在跳过', () => {
    const content = '---\ntags: [电影]\n---\n正文';
    expect(insertPosterEmbed(content, 'CONFIG/MOVIE POSTER/a.jpg')).toBe('---\ntags: [电影]\n---\n![[CONFIG/MOVIE POSTER/a.jpg]]\n正文');
    expect(insertPosterEmbed(insertPosterEmbed(content, 'a'), 'a')).toBe(insertPosterEmbed(content, 'a'));
  });

  it('C4：FM 闭合 --- 无尾换行（恰为文件末行）→ 补换行后 embed 居 FM 后，frontmatter 仍居首，且不重复插入', () => {
    const content = '---\ntags: [电影]\n---'; // 无尾换行：FM 即文件末尾
    const once = insertPosterEmbed(content, 'CONFIG/MOVIE POSTER/a.jpg');
    expect(once.startsWith('---')).toBe(true); // frontmatter 仍居首（旧缺陷：embed 插到首行、FM 失效）
    const fmEnd = once.indexOf('\n---\n');
    expect(fmEnd).toBeGreaterThan(0); // FM 闭合行仍存在
    expect(once.indexOf('![[CONFIG/MOVIE POSTER/a.jpg]]')).toBeGreaterThan(fmEnd); // embed 在 FM 之后
    expect(parseFrontmatter(once)).not.toBeNull(); // frontmatter 仍可解析
    // 已有 embed 不重复插入
    expect(insertPosterEmbed(once, 'CONFIG/MOVIE POSTER/a.jpg')).toBe(once);
  });
});

// ---------- ApiZero 客户端 ----------

describe('fetchApizeroInfo', () => {
  const OK_JSON = JSON.stringify({
    code: 0, msg: '成功',
    data: { douban_id: '35267208', name: '流浪地球2', year: '2023', score: '8.3', star: 4, director: '郭帆', actor: '吴京, 刘德华', genre: '科幻', area: '中国大陆', duration: '173分钟', episodes: '', is_tv: false, subtype: 'Movie', douban_url: 'https://movie.douban.com/subject/35267208/' },
  });

  it('code=0 解析全字段并带 Bearer 鉴权头', async () => {
    let captured: Record<string, string> | undefined;
    const httpGet: HttpGet = async (_url, headers) => { captured = headers; return OK_JSON; };
    const info = await fetchApizeroInfo('35267208', 'sk_test', httpGet);
    expect(captured?.Authorization).toBe('Bearer sk_test');
    expect(info).toMatchObject({ score: '8.3', director: '郭帆', actor: '吴京, 刘德华', duration: '173分钟', isTv: false });
    expect(info?.doubanUrl).toContain('35267208');
  });

  it('code!=0 / 非JSON / 网络失败 → null（交 rexxar 兜底）', async () => {
    const err = JSON.stringify({ code: 5020, msg: '电影不存在或数据解析失败' });
    expect(await fetchApizeroInfo('1', 'k', async () => err)).toBeNull();
    expect(await fetchApizeroInfo('1', 'k', async () => '<html>502</html>')).toBeNull();
    expect(await fetchApizeroInfo('1', 'k', async () => null)).toBeNull();
  });
});

// ---------- fetchNoteDouban 端到端 ----------

function makeDeps(over: {
  httpGet?: HttpGet;
  vault?: MockVault;
  apizeroKey?: string;
  posterBytes?: ArrayBuffer | null;
} = {}): { deps: DoubanFetchDeps; vault: MockVault } {
  const vault = over.vault ?? new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  const searchHtml = SEARCH_HTML;
  const apizeroJson = JSON.stringify({
    code: 0, msg: '成功',
    data: { douban_id: '35267208', name: '流浪地球2', year: '2023', score: '8.3', director: '郭帆', actor: '吴京, 刘德华', genre: '科幻', area: '中国大陆', duration: '173分钟', episodes: '', is_tv: false, short_comment: '好看', comment_author: '某甲', douban_url: 'https://movie.douban.com/subject/35267208/' },
  });
  const rexxarJson = JSON.stringify({
    total: 40, padding: 'x'.repeat(400),
    directors: [{ name: '郭帆' }],
    celebrities: [{ name: '龚格尔', roles: ['编剧'] }],
    actors: [{ name: '吴京' }, { name: '刘德华' }],
  });
  const defaultGet: HttpGet = async (url) => {
    if (url.includes('douban.com/search')) return searchHtml;
    if (url.includes('apizero.cn')) return apizeroJson;
    if (url.includes('rexxar')) return rexxarJson;
    return null;
  };
  const deps: DoubanFetchDeps = {
    httpGet: over.httpGet ?? defaultGet,
    downloadBinary: async () => over.posterBytes ?? null,
    writeBinary: async (p, d) => { vault.binaryFiles.set(p, new Uint8Array(d)); },
    mkdir: async (p) => { vault.dirs.add(p); },
    apizeroKey: over.apizeroKey,
    now: () => 1700000000000,
  };
  return { deps, vault };
}

const FILE_PATH = '我的/影视/《流浪地球2》.md';

async function runOn(vault: MockVault, deps: DoubanFetchDeps) {
  const app = mockAppWithVault(vault);
  setApp(app);
  const file = app.vault.getAbstractFileByPath(FILE_PATH) as any;
  return fetchNoteDouban(app, file, deps);
}

describe('fetchNoteDouban 端到端（fake 注入）', () => {
  it('主链：搜索 + ApiZero 字段 + 海报写盘 + embed + frontmatter 落盘', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags:\n  - 电影\n评分: -1\n---');
    const { deps } = makeDeps({ vault, apizeroKey: 'sk_test', posterBytes: new ArrayBuffer(1024) });
    const r = await runOn(vault, deps);
    expect(r).toEqual({ ok: true });

    const content = vault.files.get(FILE_PATH)!;
    expect(content).toContain('海报: "CONFIG/MOVIE POSTER/流浪地球2_1700000000000.jpg"');
    expect(content).toContain('豆瓣链接: "https://movie.douban.com/subject/35267208/"');
    expect(content).toContain('豆瓣评分: 8.3');
    expect(content).toContain('导演: 郭帆');
    expect(content).toContain('主演: "吴京 / 刘德华"'); // C2：ApiZero 逗号归一为 " / "（消费端切分口径）
    expect((parseFrontmatter(content)?.['主演'] as string).split(' / ')).toHaveLength(2);
    expect(content).toContain('类型: 科幻');
    expect(content).toContain('制片国家/地区: 中国大陆');
    expect(content).toContain('片长: 173分钟');
    // 字段扩展（ADR-0129 修订）：电影 is_tv=false 不写季集；上映日期降级年份；热门短评带出
    expect(content).toContain('上映日期: 2023');
    expect(content).toContain('热门短评: 好看');
    expect(content).not.toMatch(/^季集:/m);
    expect(content).toContain('![[CONFIG/MOVIE POSTER/流浪地球2_1700000000000.jpg]]');
    // C4：夹具即 FM 无尾换行形态——frontmatter 仍居首，embed 位于 FM 闭合之后
    expect(content.startsWith('---')).toBe(true);
    expect(content.indexOf('![[')).toBeGreaterThan(content.indexOf('\n---'));
    // ApiZero 有导演/主演 → 不调 rexxar，无编剧字段
    expect(content).not.toContain('编剧');
    expect(vault.binaryFiles.get(`${POSTER_FOLDER}/流浪地球2_1700000000000.jpg`)?.length).toBe(1024);
  });

  it('无 key：字段落 rexxar 兜底（导演/编剧/主演），无评分', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n---');
    const { deps } = makeDeps({ vault, posterBytes: new ArrayBuffer(1) });
    const r = await runOn(vault, deps);
    expect(r).toEqual({ ok: true });
    const content = vault.files.get(FILE_PATH)!;
    expect(content).toContain('导演: 郭帆');
    expect(content).toContain('编剧: 龚格尔');
    expect(content).toContain('主演: "吴京 / 刘德华"');
    expect(content).not.toContain('豆瓣评分');
  });

  it('有 key 但 ApiZero 缺导演/主演 → rexxar 补齐（编剧仍出）', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n---');
    const vaultDeps = makeDeps({ vault, apizeroKey: 'sk_test', posterBytes: new ArrayBuffer(1) });
    // ApiZero 只回评分，无导演/主演
    vaultDeps.deps.httpGet = async (url) => {
      if (url.includes('douban.com/search')) return SEARCH_HTML;
      if (url.includes('apizero.cn')) return JSON.stringify({ code: 0, msg: '成功', data: { score: '8.3', douban_url: 'https://movie.douban.com/subject/35267208/' } });
      if (url.includes('rexxar')) return JSON.stringify({ total: 40, padding: 'x'.repeat(400), directors: [{ name: '郭帆' }], celebrities: [{ name: '龚格尔', roles: ['编剧'] }], actors: [{ name: '吴京' }] });
      return null;
    };
    await runOn(vault, vaultDeps.deps);
    const content = vault.files.get(FILE_PATH)!;
    expect(content).toContain('豆瓣评分: 8.3'); // ApiZero 出评分
    expect(content).toContain('导演: 郭帆');   // rexxar 补导演
    expect(content).toContain('编剧: 龚格尔'); // rexxar 出编剧
    expect(content).toContain('主演: 吴京');   // rexxar 补主演
  });

  it('搜索风控 → blocked；无结果 → notfound；海报下载失败 → network、写盘失败 → write（C6 拆分）', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n---');
    const { deps } = makeDeps({ vault, apizeroKey: 'k' });
    const blockedPage = '<html><title>豆瓣</title>' + 'x'.repeat(3000) + '</html>';

    deps.httpGet = async () => blockedPage;
    expect(await runOn(vault, deps)).toEqual({ ok: false, reason: 'blocked' });

    deps.httpGet = async () => '<html>' + 'x'.repeat(9000) + '没有找到相关的搜索结果</html>';
    expect(await runOn(vault, deps)).toEqual({ ok: false, reason: 'notfound' });

    deps.httpGet = async () => SEARCH_HTML;
    deps.downloadBinary = async () => null;
    expect(await runOn(vault, deps)).toEqual({ ok: false, reason: 'network' }); // C6：下载失败 ≠ 写盘失败

    deps.downloadBinary = async () => { throw new Error('ECONNRESET'); };
    expect(await runOn(vault, deps)).toEqual({ ok: false, reason: 'network' }); // C6：网络异常不再被吞成风控

    deps.downloadBinary = async () => new ArrayBuffer(1);
    deps.mkdir = async () => { throw new Error('disk full'); };
    expect(await runOn(vault, deps)).toEqual({ ok: false, reason: 'write' });
  });

  it('C6：搜索 httpGet reject → network（不误报风控）；返回 null 仍 → blocked（原语义不变）', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n---');
    const { deps } = makeDeps({ vault, apizeroKey: 'k' });

    deps.httpGet = async () => { throw new Error('ECONNREFUSED'); };
    expect(await runOn(vault, deps)).toEqual({ ok: false, reason: 'network' });

    deps.httpGet = async () => null;
    expect(await runOn(vault, deps)).toEqual({ ok: false, reason: 'blocked' });
  });

  it('已齐全跳过（零网络）；海报已有只补字段（不重下海报不重复 embed）', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/old.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n---');
    let calls = 0;
    const { deps } = makeDeps({ vault, apizeroKey: 'k' });
    deps.httpGet = async (url) => { calls++; return url.includes('apizero.cn') ? JSON.stringify({ code: 0, data: { score: '8.3', douban_url: 'x' } }) : null; };

    expect(await runOn(vault, deps)).toEqual({ ok: true, skipped: true });
    expect(calls).toBe(0); // 齐全条目零网络

    // 有海报缺链接：只补字段
    const vault2 = new MockVault();
    vault2.files.set(FILE_PATH, '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/old.jpg\n---');
    let downloads = 0;
    const d2 = makeDeps({ vault: vault2, apizeroKey: 'k', posterBytes: new ArrayBuffer(1) });
    d2.deps.httpGet = async (url) => {
      if (url.includes('douban.com/search')) return SEARCH_HTML;
      if (url.includes('apizero.cn')) return JSON.stringify({ code: 0, data: { score: '8.3', douban_url: 'https://movie.douban.com/subject/35267208/' } });
      return null;
    };
    d2.deps.downloadBinary = async () => { downloads++; return new ArrayBuffer(1); };
    await runOn(vault2, d2.deps);
    expect(downloads).toBe(0); // 已有海报不重下（防孤儿文件与重复 embed）
    expect(vault2.files.get(FILE_PATH)).toContain('豆瓣链接: "https://movie.douban.com/subject/35267208/"');
    // C9：海报字段缺失才填——已有旧值原样保留（不再经格式化重写）
    expect(vault2.files.get(FILE_PATH)).toContain('海报: CONFIG/MOVIE POSTER/old.jpg');
    expect(vault2.files.get(FILE_PATH)).not.toContain('![[');
  });

  it('存量退役字段（语言/又名/IMDb/简介）不被清除；已有上映日期/季集不被覆盖', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n语言: 汉语\n又名: 流浪地球贰\nIMDb: tt123\n简介: 旧简介\n上映日期: 2023-01-22\n季集: "3"\n---');
    const { deps } = makeDeps({ vault, apizeroKey: 'sk_test', posterBytes: new ArrayBuffer(1) });
    await runOn(vault, deps);
    const content = vault.files.get(FILE_PATH)!;
    expect(content).toContain('语言: 汉语');
    expect(content).toContain('又名: 流浪地球贰');
    expect(content).toContain('IMDb: tt123');
    expect(content).toContain('简介: 旧简介');
    expect(content).toContain('上映日期: 2023-01-22'); // 已有具体日期不被年份降级覆盖
    expect(content).toMatch(/^季集: "3"/m); // 已有季集不动
  });

  it('C1：is_tv 剧集不写季集（ApiZero episodes 是总集数非季数，撤回该扩展）', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n---');
    const vaultDeps = makeDeps({ vault, apizeroKey: 'sk_test', posterBytes: new ArrayBuffer(1) });
    vaultDeps.deps.httpGet = async (url) => {
      if (url.includes('douban.com/search')) return SEARCH_HTML;
      if (url.includes('apizero.cn')) {
        return JSON.stringify({ code: 0, data: { score: '8.3', director: '某导演', actor: '某主演', douban_url: 'https://movie.douban.com/subject/35267208/', is_tv: true, episodes: '24' } });
      }
      return null;
    };
    const r = await runOn(vault, vaultDeps.deps);
    expect(r).toEqual({ ok: true });
    const content = vault.files.get(FILE_PATH)!;
    // 回归防复发：写入 24 会被 analysis.ts 追剧深度展示为「24 季」
    expect(content).not.toMatch(/^季集:/m);
  });

  it('C3：ApiZero 热门短评含换行 → 写回单行化，frontmatter 可解析、值可读回', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n---');
    const vaultDeps = makeDeps({ vault, apizeroKey: 'sk_test', posterBytes: new ArrayBuffer(1) });
    vaultDeps.deps.httpGet = async (url) => {
      if (url.includes('douban.com/search')) return SEARCH_HTML;
      if (url.includes('apizero.cn')) {
        return JSON.stringify({ code: 0, data: { score: '8.3', douban_url: 'https://movie.douban.com/subject/35267208/', short_comment: '神作\n后半段直接封神', comment_author: '某甲' } });
      }
      return null;
    };
    await runOn(vault, vaultDeps.deps);
    const content = vault.files.get(FILE_PATH)!;
    // 短评行内无裸换行（裸 \n 会破坏 YAML 解析、影片从面板消失）
    expect(content).toMatch(/^热门短评: "神作 后半段直接封神"$/m);
    expect(parseFrontmatter(content)?.['热门短评']).toBe('神作 后半段直接封神');
  });

  it('C8：抓取中途文件被用户手改（补填字段/贴海报）→ 写回基于 fresh 内容复核，用户值保留', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n---');
    const vaultDeps = makeDeps({ vault, apizeroKey: 'sk_test', posterBytes: new ArrayBuffer(1) });
    // 在搜索之后、写回之前（ApiZero 响应时机）模拟用户手改：补填上映日期/热门短评/贴海报
    const baseGet = vaultDeps.deps.httpGet;
    let mutated = false;
    vaultDeps.deps.httpGet = async (url, headers) => {
      const r = await baseGet(url, headers);
      if (!mutated && url.includes('apizero.cn')) {
        mutated = true;
        const cur = vault.files.get(FILE_PATH)!;
        vault.files.set(FILE_PATH, cur.replace('---\n', '---\n上映日期: 2020-05-15\n热门短评: 用户手评\n海报: CONFIG/MOVIE POSTER/用户.jpg\n'));
      }
      return r;
    };
    const r = await runOn(vault, vaultDeps.deps);
    expect(r).toEqual({ ok: true });
    const content = vault.files.get(FILE_PATH)!;
    expect(content).toContain('上映日期: 2020-05-15');   // 用户值不被年份覆盖
    expect(content).toContain('热门短评: 用户手评');     // 用户值不被短评覆盖
    expect(content).toContain('海报: CONFIG/MOVIE POSTER/用户.jpg'); // 用户贴的海报不被下载路径覆盖
    expect(content).not.toContain('![[');               // 已有海报 → 不插 embed
  });

  it('C9：六字段缺失才填——已有豆瓣评分/导演/主演不被 ApiZero 覆盖', async () => {
    const vault = new MockVault();
    vault.files.set(FILE_PATH, '---\ntags: [电影]\n评分: -1\n豆瓣评分: 9.9\n导演: 用户手改\n主演: "用户 / 手选"\n---');
    const { deps } = makeDeps({ vault, apizeroKey: 'sk_test', posterBytes: new ArrayBuffer(1) });
    await runOn(vault, deps);
    const content = vault.files.get(FILE_PATH)!;
    expect(content).toContain('豆瓣评分: 9.9');
    expect(content).toContain('导演: 用户手改');
    expect(content).toContain('主演: "用户 / 手选"');
  });
});

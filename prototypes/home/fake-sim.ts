/**
 * 内容首页行为单源 · sim 启动入口（issue 245/ADR-0106）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（vault + metadataCache——core/storage 的 jsonFileStore、
 *     recap 影院/书库扫描、review 数据层全部真实现跑在假 vault 上，见 fake/fake-obsidian.ts）；
 *   - 设置注入：setSettingsProvider 注入演示路径（与插件默认值同形）；
 *   - 种子数据：home 是只读聚合域，活动河横跨 recap（diary/cinema/bookshelf/todo/pomodoro）、
 *     review、clipbook(news)、favorites、belongings——种子按相对「今天」生成一整套跨域
 *     演示数据灌进 fake vault 对应路径，面板永远有真实内容；跨天自动重灌（活动河口径
 *     以「今天」为锚，旧种子不重灌就会整体失真——与 belongings「编辑可持久」的差异在此）。
 *
 * 种子口径对照（自检断言依赖，改种子先改壳断言）：
 *   日记 518 篇（连击 3、今日未写）· 影院 想看 8 / 在看 2 · 书库 在读 9 / 读完 4
 *   复习 9 张（逾期 1、明天到期 0）· 剪藏未读 12 · 收藏在册 18 · 归物 12 件
 *   今日时间线 9 条（三体 07:42 → 影院已看 21:05），昨日 5 条（写周报初稿 09:00 → 日记 22:15）
 *   规则点评 2 条：首条「早了 78 分钟」（今日首动 07:42 vs 昨日首动 09:00）+ 末条日记连击提醒
 */
import { FakeApp, encodeSeedFile } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openHome as openHomeReal } from '../../src/home/index';

/** 种子版本（种子形状变化时 +1，触发重灌） */
const SEED_REV = 3;
const SEED_MARK = 'bz-sim:__home_seed';
const KEY_PREFIX = 'bz-sim:';

/* ---------- 相对日期工具（活动河以「今天」为锚） ---------- */

const p2 = (n: number): string => String(n).padStart(2, '0');

/** n 天前的本地日期串 'YYYY-MM-DD' */
function dstr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** n 天前的 'HH:mm' 时刻（本地毫秒）；n 为负 = 未来 */
function at(n: number, hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** 未来 n 天的 ISO 串（review nextReviewDate 用） */
function isoFuture(n: number, hm = '09:00'): string {
  return new Date(at(-n, hm)).toISOString();
}

/** frontmatter 拼装（fake-obsidian parseFrontmatter 的生成侧） */
function fm(fields: Record<string, string | number | string[]>): string {
  const lines = Object.entries(fields).map(([k, v]) =>
    Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join('\n')}` : `${k}: ${v}`
  );
  return `---\n${lines.join('\n')}\n---\n`;
}

interface SeedFile {
  path: string;
  content: string;
  ctime?: number;
  mtime?: number;
}

/* ---------- 各域种子（文件路径/字段 = river/recap 真实现读取口径） ---------- */

/** 日记：连击 3 天（昨天起算）+ 515 天历史（总数 518）；今天故意不写 → 连击提醒/彩点 warn */
function seedDiary(out: SeedFile[]): void {
  const dayFile = (n: number, times: string[]): void => {
    out.push({
      path: `我的/日记/${dstr(n)}.md`,
      content: times.map((t) => `# 🌤 ${t}\n记一笔。\n`).join('\n'),
      ctime: at(n, '08:00'),
      mtime: at(n, times[times.length - 1]),
    });
  };
  dayFile(1, ['08:30', '22:15']);
  dayFile(2, ['09:00']);
  dayFile(3, ['21:00']);
  // 历史：n=7..521 共 515 天（空内容真实文件名，仅参与 diaryTotal/wall 计数；recap 窗口外不解析）
  for (let n = 7; n <= 521; n++) {
    out.push({ path: `我的/日记/${dstr(n)}.md`, content: '', ctime: at(n, '12:00'), mtime: at(n, '12:00') });
  }
}

/** 影院：今日已看 1（recap「标记已看」）+ 昨日加片单 1 + 想看 8 + 在看 2 + 旧已看 3。
 *  文件名带书名号（cinema parseMovieFile 会剥出正名）；mtime 决定时间线时刻。 */
function seedCinema(out: SeedFile[]): void {
  const movie = (
    name: string,
    fields: Record<string, string | number>,
    ctime: [number, string],
    mtime: [number, string]
  ): void => {
    out.push({
      path: `我的/影视/${name}.md`,
      content: fm({ tags: ['电影'], ...fields }) + `观影短评：${name}。\n`,
      ctime: at(ctime[0], ctime[1]),
      mtime: at(mtime[0], mtime[1]),
    });
  };
  // 今日已看（评分 4 → 10 分制 2 星；mtime 落今晚 21:05 → 时间线末条 + 连击提醒挂靠行）
  movie('《百年孤独》', { 评分: 4, 观影日期: dstr(0) }, [30, '12:00'], [0, '21:05']);
  // 昨日加入片单（无评分无观影日期；ctime 落昨天窗口 → 「加入片单」）
  movie('《沙丘 2》', {}, [1, '10:15'], [1, '10:15']);
  // 想看 8（评分 -1）/ 在看 2（评分 0）：ctime 一律放远（≥9 天前）——recap 会把
  // 「ctime 落当天窗口」的非已看影片扫成「加入片单」，近几天会让周历天天 hit
  ['《奥本海默》', '《流浪地球 3》', '《花样年华》', '《完美日子》', '《怪物》', '《坠落的审判》', '《瞬息全宇宙》', '《驾驶我的车》'].forEach(
    (name, i) => movie(name, { 评分: -1 }, [30 + i, '12:00'], [30 + i, '12:00'])
  );
  // 在看 2（评分 0）
  movie('《漫长的季节》', { 评分: 0 }, [12, '12:00'], [12, '20:00']);
  movie('《幕府将军》', { 评分: 0 }, [13, '12:00'], [13, '20:00']);
  // 旧已看 3（观影日期窗口外，只进统计不进时间线）
  movie('《怦然心动》', { 评分: 5, 观影日期: dstr(9) }, [9, '12:00'], [9, '21:00']);
  movie('《海边的曼彻斯特》', { 评分: 4, 观影日期: dstr(15) }, [15, '12:00'], [15, '21:00']);
  movie('《入殓师》', { 评分: 3, 观影日期: dstr(22) }, [22, '12:00'], [22, '21:00']);
}

/** 书库：在读 9（三体今日有进度）+ 已读 3（时间简史今日读完）。
 *  文件名不带书名号（bookshelf parseBookFile 的 title = basename 原样）。 */
function seedBookshelf(out: SeedFile[]): void {
  const book = (
    name: string,
    fields: Record<string, string | number>,
    ctime: [number, string],
    mtime: [number, string]
  ): void => {
    out.push({
      path: `书库/${name}.md`,
      content: fm({ tags: ['book'], ...fields }) + `${name} 的书摘。\n`,
      ctime: at(ctime[0], ctime[1]),
      mtime: at(mtime[0], mtime[1]),
    });
  };
  book('三体', { author: '刘慈欣', category: '科幻', readingDate: dstr(20), readingProgress: 62 }, [30, '12:00'], [0, '07:42']);
  // 在读 8 本：mtime 一律放远（≥15 天前）——recap 把「在读 + mtime 落当天窗口」扫成
  // 「读到 N%」，近几天会让周历天天 hit；只有三体今天有进度
  ['算法导论', '人类简史', '经济学原理', '雪国', '万历十五年', '乡土中国', '失控', '哥德尔、艾舍尔、巴赫'].forEach((name, i) =>
    book(name, { author: '佚名', category: '未分类', readingDate: dstr(30 + i), readingProgress: 15 + i * 9 }, [60 + i, '12:00'], [15 + i, '12:00'])
  );
  book('时间简史', { author: '霍金', category: '科普', readingDate: dstr(18), completionDate: dstr(0) }, [40, '12:00'], [0, '18:20']);
  book('小王子', { author: '圣埃克苏佩里', category: '文学', readingDate: dstr(40), completionDate: dstr(12) }, [60, '12:00'], [12, '12:00']);
  book('活着', { author: '余华', category: '文学', readingDate: dstr(60), completionDate: dstr(30) }, [80, '12:00'], [30, '12:00']);
}

/** EPUB（weave-data.json，ADR-0013 口径）：读完 1 本（完成时刻放前天——recap 的
 *  EPUB 读完事件 ts 恒钉当天 0 点，落在今天会把「今日首动」变成 00:00，点评失真） */
function seedEpub(out: SeedFile[]): void {
  out.push({ path: '书库/EPUB/深入理解计算机系统.epub', content: 'fake-epub' });
  out.push({
    path: 'CONFIG/STORAGE/weave-data.json',
    content: JSON.stringify(
      {
        books: {
          csapp: {
            meta: { title: '深入理解计算机系统', author: 'Randal E. Bryant', subjects: ['计算机'] },
            file: { vaultPath: '书库/EPUB/深入理解计算机系统.epub' },
            reading: {
              position: { percent: 1 },
              stats: { lastReadTime: at(2, '09:40'), completedTime: at(2, '09:40'), totalReadTime: 7200000 },
            },
            notes: { highlights: [1, 2, 3], excerpts: [] },
          },
        },
      },
      null,
      2
    ),
  });
}

/** 复习：9 条在册（1 逾期、1 完成；到期日全部避开明天 → 预告首卡=逾期卡） */
function seedReview(out: SeedFile[]): void {
  const notes = ['费曼学习法', '间隔重复原理', 'FSRS 参数', '记忆曲线', '主动回忆', '交错练习', '双编码理论', '检索练习', '艾宾浩斯遗忘曲线'];
  for (const n of notes) {
    out.push({ path: `复习卡片/${n}.md`, content: `# ${n}\n\n卡片正文。\n` });
  }
  const item = (i: number, filePath: string, nextReviewDate: string, completed = false): Record<string, unknown> => ({
    id: `review_seed_${i}`,
    filePath,
    name: filePath.split('/').pop()?.replace(/\.md$/, '') || filePath,
    reviewStart: isoFuture(-20),
    stage: i % 5,
    phase: 'ladder',
    stability: 1,
    difficulty: 0.3,
    reviewHistory: [],
    totalReviews: i,
    averageConfidence: 0.6,
    nextReviewDate,
    lastReviewed: isoFuture(-2),
    lastDifficulty: '记得',
    completed,
  });
  const items = [
    item(1, '复习卡片/费曼学习法.md', isoFuture(-1, '12:00')), // 逾期
    item(2, '复习卡片/间隔重复原理.md', isoFuture(3)),
    item(3, '复习卡片/FSRS 参数.md', isoFuture(5)),
    item(4, '复习卡片/记忆曲线.md', isoFuture(7)),
    item(5, '复习卡片/主动回忆.md', isoFuture(10)),
    item(6, '复习卡片/交错练习.md', isoFuture(14)),
    item(7, '复习卡片/双编码理论.md', isoFuture(20)),
    item(8, '复习卡片/检索练习.md', isoFuture(30)),
    item(9, '复习卡片/艾宾浩斯遗忘曲线.md', isoFuture(45), true), // 已完成（不计逾期）
  ];
  out.push({ path: 'CONFIG/STORAGE/review.json', content: JSON.stringify(items, null, 2) });
}

/** 剪藏：15 篇（12 未读） */
function seedNews(out: SeedFile[]): void {
  const titles = [
    '为什么深度工作越来越难', 'Obsidian 插件开发入门', '本地优先软件宣言', '间隔重复的实践误区', '卡片笔记写作法复盘',
    'ES2026 新特性速览', 'TypeScript 类型体操实例', '数字花园的养护指南', '阅读的技艺', '注意力和时间的经济学',
    '极简主义的陷阱', '知识管理工具评测', '写作是思考的过程', '第二大脑的边界', '效率工具断舍离',
  ];
  const articles = titles.map((title, i) => ({
    id: `news_seed_${i}`,
    title,
    url: `https://example.com/${i + 1}`,
    read: i >= 12, // 前 12 篇未读
    created: new Date(at(14 - i, '10:00')).toISOString(),
  }));
  out.push({ path: 'CONFIG/STORAGE/news.json', content: JSON.stringify({ articles }, null, 2) });
}

/** 收藏：20 条（2 归档 → 18 在册） */
function seedFavorites(out: SeedFile[]): void {
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: `fav_seed_${i}`,
    title: `收藏条目 ${i + 1}`,
    url: `https://example.com/fav/${i + 1}`,
    tags: ['网站'],
    created: new Date(at(30 - i, '09:00')).toISOString(),
    archived: i >= 18,
  }));
  out.push({ path: 'CONFIG/STORAGE/favorites.json', content: JSON.stringify(items, null, 2) });
}

/** 归物：12 件登记 */
function seedBelongings(out: SeedFile[]): void {
  const items: Record<string, unknown> = {};
  const names = ['机械键盘', '降噪耳机', 'Kindle', '保温杯', '人体工学椅', '显示器灯', '移动电源', '相机', '桌面支架', '手账本', '钢笔', '台灯'];
  names.forEach((name, i) => {
    items[`bel_seed_${i}`] = {
      id: `bel_seed_${i}`,
      name,
      category: '数码',
      price: 100 + i * 37,
      purchase_date: dstr(100 + i * 10),
      current_status: '在用',
      last_updated: new Date(at(30, '12:00')).toISOString(),
    };
  });
  out.push({
    path: 'CONFIG/STORAGE/belongings.json',
    content: JSON.stringify({ version: '1.0', last_updated: new Date().toISOString(), items }, null, 2),
  });
}

/** 待办（memo.json，recap 同源直读）：今日完成 2 + 新增 2，昨日完成 1 */
function seedMemo(out: SeedFile[]): void {
  const memo = [
    { id: 'memo_seed_1', title: '给 obsidian 提 issue', created: `${dstr(0)} 09:05`, completed: `${dstr(0)} 09:10` },
    { id: 'memo_seed_2', title: '写周报初稿', created: `${dstr(1)} 09:00`, completed: `${dstr(0)} 20:44` },
    { id: 'memo_seed_3', title: '预约体检', created: `${dstr(0)} 12:20`, completed: null },
    { id: 'memo_seed_4', title: '清理收件箱', created: `${dstr(2)} 10:00`, completed: `${dstr(1)} 20:44` },
    { id: 'memo_seed_5', title: '回复审稿意见', created: `${dstr(3)} 09:00`, completed: null },
  ];
  out.push({ path: 'CONFIG/STORAGE/memo.json', content: JSON.stringify(memo, null, 2) });
}

/** 番茄：今日 2 轮 + 昨日 1 轮（ts=完成时刻，时长 25 分钟） */
function seedPomodoro(out: SeedFile[]): void {
  out.push({
    path: 'CONFIG/STORAGE/pomodoro.json',
    content: JSON.stringify(
      {
        version: 1,
        state: { phase: 'idle' },
        history: [
          { task: '周报', duration: 1500, ts: at(0, '09:00') },
          { task: '读书笔记', duration: 1500, ts: at(0, '14:27') },
          { task: '周报', duration: 1500, ts: at(1, '14:27') },
        ],
      },
      null,
      2
    ),
  });
}

function buildSeedFiles(): SeedFile[] {
  const out: SeedFile[] = [];
  seedDiary(out);
  seedCinema(out);
  seedBookshelf(out);
  seedEpub(out);
  seedReview(out);
  seedNews(out);
  seedFavorites(out);
  seedBelongings(out);
  seedMemo(out);
  seedPomodoro(out);
  return out;
}

/* ---------- 种子写入 / 重灌 ---------- */

function wipeSimKeys(): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) doomed.push(k);
  }
  for (const k of doomed) localStorage.removeItem(k);
}

/**
 * 种子灌库（幂等；跨天/版本变化自动重灌）：
 * home 的活动河以「今天」为锚——种子里的「今日痕迹/连击/周历」过了当天就整体失真，
 * 与 belongings「编辑可持久」刻意不同：这里是演示数据新鲜度优先。
 */
function seedDatabase(): void {
  const today = dstr(0);
  let fresh = false;
  try {
    const mark = JSON.parse(localStorage.getItem(SEED_MARK) || 'null') as { rev?: number; seededOn?: string } | null;
    fresh = !!mark && mark.rev === SEED_REV && mark.seededOn === today;
  } catch {
    fresh = false;
  }
  if (!fresh) {
    wipeSimKeys();
    for (const f of buildSeedFiles()) {
      localStorage.setItem(KEY_PREFIX + f.path, encodeSeedFile(f.content, { ctime: f.ctime, mtime: f.mtime }));
    }
    localStorage.setItem(SEED_MARK, JSON.stringify({ rev: SEED_REV, seededOn: today }));
  }
}

/** 默认设置（settings-provider 真实现注入；键与插件 data.json 同形，值 = 插件默认路径） */
function injectSettings(): void {
  setSettingsProvider(
    () =>
      ({
        storagePath: 'CONFIG/STORAGE',
        diaryDirectory: '我的/日记',
        cinemaFolderPath: '我的/影视',
        bookshelfFolderPath: '书库',
        bookTag: 'book',
      }) as never
  );
}

let appRef: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入 + app 注入；幂等） */
export function bootHomeSim(): void {
  const g = window as unknown as { __bzHomeSimBooted?: boolean };
  if (g.__bzHomeSimBooted) return;
  g.__bzHomeSimBooted = true;
  seedDatabase();
  injectSettings();
  appRef = new FakeApp();
  setApp(appRef as never);
}

/** 打开内容首页（真 index.openHome：ESC 注册 + overlay 生命周期 + 活动河采集）。
 *  selftest 的「入口点击降级」断言依赖 FakeApp 无 commands——openDomain 捕获后走真 notice 降级。 */
export function openHome(): void {
  bootHomeSim();
  openHomeReal(appRef as never);
}

/** 重置演示数据（壳重置按钮用）：清 fake vault 全部键，由调用方 reload 重灌 */
export function resetHomeSim(): void {
  wipeSimKeys();
  localStorage.removeItem(SEED_MARK);
}

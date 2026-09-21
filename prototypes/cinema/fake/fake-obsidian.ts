/**
 * 影院行为单源 · 公共假 obsidian（issue 245/ADR-0106；范式自 belongings 试点适配）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但影院 ui.ts / core 的
 * 真实现只用到以下少数出口，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.CN_ICONS，prototype-icons.js）
 *   - TFile                    → ui.ts posterUrl 的 instanceof 判定（FakeVault 返回本类实例）
 *   - requestUrl               → 抛错（core/ai → AI 荐片走页内降级提示，原型不碰真 AI）
 *   - App / vault              → localStorage 文件系统（影院数据 = 我的/影视/*.md 笔记而非
 *                               json——读改写/建目录/列文件/回收站/改名/frontmatter 写入
 *                               全真，只把「文件系统」换成 localStorage）；
 *                               同源 storage 事件桥 = 跨 iframe「文件 modify 自动刷新」
 *   - metadataCache            → getFileCache 现场解析 frontmatter（data.ts 唯一消费面）
 *
 * 与插件侧的差异收敛到这里（本文件是浏览器版假层，随 prototype-behavior.js 产物进 git）：
 *   - frontmatter 解析/序列化是最小 YAML 面（键: 值 顶格列表项/内联数组），覆盖
 *     persistItem 的写入格式与 prototype-data.js 种子格式——不是完整 YAML；
 *   - 文件 stat：种子 ctime 按导出序递减（「加入先后」排序 = 导出序），运行期新建取当下时刻。
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.CN_ICONS） ====================

declare global {
  interface Window {
    CN_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.CN_ICONS?.[iconId]) || '';
  if (!d) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // 表里存的是内层 path/circle/polygon 片段——注入 innerHTML（内容为受控图标表）
  svg.innerHTML = d;
  // Obsidian setIcon 会保留容器已有 class；span.bz-ic 场景由调用方控制外观
  container.replaceChildren(svg);
}

export type IconName = string;

// ==================== requestUrl：罐头网关（issue 395） ====================

/** 演示预设（原型无真网络）：按片名关键词命中，让「输入不同片名 → 不同分类」看得出效果。
 *  命中不到回落第 0 套。豆瓣信息区展示的是预设字段，标题用你输入的名字。 */
const CANNED_PRESETS = [
  { keys: ['千与千寻', '宫崎骏', '龙猫', '动画'], genre: '剧情, 动画, 奇幻', area: '日本', isTv: false, director: '宫崎骏', actor: '柊瑠美, 入野自由', year: '2001', duration: '125分钟', score: '9.4', poster: '/__vault-media/1049345607.jpg', shortComment: '不管前方的路有多苦，只要走的方向正确，都比站在原地更接近幸福。' },
  { keys: ['三体'], genre: '剧情, 科幻', area: '中国大陆', isTv: true, director: '杨磊', actor: '张鲁一, 于和伟', year: '2023', duration: '45分钟', score: '8.7', poster: '/__vault-media/1164394344.jpg', shortComment: '不要回答。' },
  { keys: ['绝命毒师', '毒师', '美剧'], genre: '剧情, 犯罪, 惊悚', area: '美国', isTv: true, director: '文斯·吉里根', actor: '布莱恩·科兰斯顿', year: '2008', duration: '45分钟', score: '9.6', poster: '/__vault-media/1170083317.jpg', shortComment: '我就是危险本身。' },
  { keys: ['地球脉动', '纪录片', '行星'], genre: '纪录片', area: '英国', isTv: true, director: '阿拉斯泰尔·福瑟吉尔', actor: '大卫·爱登堡', year: '2006', duration: '50分钟', score: '9.7', poster: '/__vault-media/1214927835.jpg', shortComment: '这颗星球远比我们想象的更壮丽。' },
  { keys: ['星际穿越', '诺兰'], genre: '剧情, 科幻, 冒险', area: '美国', isTv: false, director: '克里斯托弗·诺兰', actor: '马修·麦康纳', year: '2014', duration: '169分钟', score: '9.4', poster: '/__vault-media/1215062315.jpg', shortComment: '爱是唯一可以超越时间与空间的事物。' },
];

/** 命中片名 → 预设下标（找不到回落第 0 套） */
function presetIndexOf(q: string): number {
  const i = CANNED_PRESETS.findIndex((p) => p.keys.some((k) => q.includes(k)));
  return i < 0 ? 0 : i;
}

/** sid 承载预设下标（extractSid 要求 subject/<数字>）：搜索与 ApiZero 两步靠它对齐 */
function sidOf(i: number): string {
  return `900${i + 1}`;
}

/** 原型专属：罐头响应延迟（**真实插件没有**）。2026-09-21 用户要求「拆两段看渐进」——
 *  豆瓣两跳（搜索 + 字段）各 500ms ≈ 1 秒后翻面；Jev 判定再 1 秒，用来看分类「占位 → 填值」。 */
const CANNED_DOUBAN_MS = 500;
const CANNED_JEV_MS = 1000;
const cannedDelay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 从 ApiZero 请求 URL 的 id 反查预设 */
function presetFromSid(url: string): (typeof CANNED_PRESETS)[number] {
  const m = /id=(\d+)/.exec(url);
  const i = m ? Number(m[1].slice(3)) - 1 : 0;
  return CANNED_PRESETS[i >= 0 && i < CANNED_PRESETS.length ? i : 0];
}

/** 1×1 透明 PNG（下载海报用；空 ArrayBuffer 会让 downloadBinary 判失败） */
const PNG_1PX = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196,
  137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68,
  174, 66, 96, 130,
]);

/** 豆瓣搜索页罐头（结构须匹配 douban-fetcher.parseSearchResults 的正则）。
 *  ⚠ 必须 >8000 字节：searchLooksBlocked 对短响应直接判风控，故补足填充块。 */
function cannedSearchHtml(title: string, idx: number): string {
  const hit =
    `<div class="result"><div class="pic">` +
    `<a href="https://www.douban.com/link2/?url=https%3A%2F%2Fmovie.douban.com%2Fsubject%2F${sidOf(idx)}%2F">` +
    `<img src="${CANNED_PRESETS[idx].poster}"></a></div>` +
    `<div class="title"><a href="#">${title}</a></div></div>`;
  return `<!DOCTYPE html><html><body>${hit}${'<div class="filler"></div>'.repeat(400)}</body></html>`;
}

/** ApiZero 字段罐头（结构须匹配 fetchApizeroInfo 的消费面） */
function cannedApizero(p: (typeof CANNED_PRESETS)[number]): string {
  return JSON.stringify({
    code: 0,
    data: {
      name: '',
      year: p.year,
      score: p.score,
      director: p.director,
      actor: p.actor,
      genre: p.genre,
      area: p.area,
      duration: p.duration,
      episodes: '',
      is_tv: p.isTv,
      douban_url: 'https://movie.douban.com/subject/1291561/',
      short_comment: p.shortComment,
      comment_author: '豆瓣用户',
    },
  });
}

const CANNED_AREA_TAG: Record<string, string> = {
  中国大陆: '国产剧', 美国: '美剧', 英国: '英剧', 德国: '德剧', 日本: '日剧', 韩国: '韩剧', 哥伦比亚: '哥伦比亚剧',
};
const CANNED_AREA_ANIME: Record<string, string> = { 日本: '日漫', 中国大陆: '国漫', 美国: '美漫' };

/** 按 state 现场推一个分类（与 src/cinema/type-decide 的哨兵同值）。
 *  演示里「自动分类」要是活的——永远回同一个值就看不出功能，故这里真按豆瓣字段推。 */
function cannedChoice(state: string, keys: string[]): string {
  const grab = (re: RegExp) => re.exec(state)?.[1]?.trim() ?? '';
  const area = grab(/制片国家\/地区：([^\n]+)/).split(/[,，/]/)[0].trim();
  const genre = grab(/豆瓣类型：([^\n]+)/);
  const isTv = /是否剧集：是/.test(state);
  let guess = '';
  if (genre.includes('纪录片')) guess = '纪录片';
  else if (genre.includes('动画')) guess = CANNED_AREA_ANIME[area] ?? '';
  else if (!isTv) guess = '电影';
  else guess = CANNED_AREA_TAG[area] ?? '';
  return keys.includes(guess) ? guess : '以上都不是';
}

/** Jev 罐头：按请求里的 questions 逐题回一个形状正确的答案 */
function cannedJev(body: string): string {
  let state = '';
  let questions: Record<string, { type?: string; criteria?: Record<string, string> }> = {};
  try {
    const req = JSON.parse(body || '{}') as { state?: string; questions?: typeof questions };
    state = String(req.state ?? '');
    questions = req.questions ?? {};
  } catch {
    // 罐头容错：请求体解析不了就回空 answers（调用方会按畸形响应处理）
  }
  const answers: Record<string, unknown> = {};
  for (const [key, q] of Object.entries(questions)) {
    if (q?.type === 'choice') {
      const pick = cannedChoice(state, Object.keys(q.criteria ?? {}));
      answers[key] = { type: 'choice', choice: pick, confidence: pick === '以上都不是' ? 0.31 : 0.93, probabilities: {} };
    } else if (q?.type === 'noul') {
      answers[key] = { type: 'noul', noul: 0.88 };
    } else {
      answers[key] = { type: 'score', score: 3, confidence: 0.8, legend: [] };
    }
  }
  return JSON.stringify({ model: 'jev-canned', answers, usage: { input_tokens: 0, output_tokens: 0 } });
}

/**
 * requestUrl：原型无网络，改为**罐头网关**（issue 395 影院表单「解析」链路）。
 * 拦三类：豆瓣搜索页（HTML 罐头）、ApiZero 字段（JSON 罐头）、Jev 判定（按 state 现推）。
 * 海报二进制回 1×1 PNG（否则落盘后的抓取队列必然报 network 失败）。
 * 其余请求维持原口径——抛错（core/ai → AI 荐片走页内降级提示，原型不碰真 AI）。
 */
export async function requestUrl(req: { url?: string; method?: string; body?: string } | string): Promise<{
  status: number;
  text: string;
  json: unknown;
  arrayBuffer: ArrayBuffer;
}> {
  const url = typeof req === 'string' ? req : String((req as { url?: string })?.url ?? '');
  const body = typeof req === 'string' ? '' : String((req as { body?: string })?.body ?? '');
  // json 必须惰性容错：搜索页返回 HTML，直接 JSON.parse 会抛异常 →
  // 整个查询被当成网络失败（点「解析」毫无反应，2026-09-21 实测踩到）
  const ok = (text: string) => ({
    status: 200,
    text,
    json: (() => { try { return JSON.parse(text || 'null'); } catch { return null; } })(),
    arrayBuffer: new ArrayBuffer(0),
  });
  if (url.includes('douban.com/search')) {
    await cannedDelay(CANNED_DOUBAN_MS);
    const q = decodeURIComponent((/[?&]q=([^&]*)/.exec(url)?.[1] ?? '').replace(/\+/g, ' '));
    return ok(cannedSearchHtml(q || '未命名', presetIndexOf(q)));
  }
  if (url.includes('v1.apizero.cn')) {
    await cannedDelay(CANNED_DOUBAN_MS);
    return ok(cannedApizero(presetFromSid(url)));
  }
  if (url.includes('api.typesafe.ai')) {
    await cannedDelay(CANNED_JEV_MS);
    return ok(cannedJev(body));
  }
  if (url.includes('doubanio.com')) {
    return { status: 200, text: '', json: null, arrayBuffer: PNG_1PX.buffer.slice(0) as ArrayBuffer };
  }
  // rexxar 演职员兜底：404 → fetchCelebrities 视作该类型无数据，回落到 ApiZero 的导演/主演
  if (url.includes('m.douban.com/rexxar')) return { status: 404, text: '', json: null, arrayBuffer: new ArrayBuffer(0) };
  throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== TFile（posterUrl instanceof 判定 + 文件元信息面） ====================

/** 最小 TFile：path/name/basename/extension/stat——data.ts / ui.ts / douban-queue 消费面 */
export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
  stat: { ctime: number; mtime: number } = { ctime: 0, mtime: 0 };
}

// ==================== 绝对路径海报（演示数据的 file:// 媒体） ====================

/** 媒体扩展名（与 ui.ts posterUrl 的判据同口径的超集） */
const MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/**
 * 演示海报是 vault **绝对路径**（`file:///E:/…/CONFIG/MOVIE POSTER/x.png`；种子直写 frontmatter，
 * 真插件里海报是 vault 相对路径）——它不在 localStorage 文件系统的键里，但评审壳要能显示真图。
 * 判定：带协议的绝对路径 + 媒体扩展名 → 返回解码后的**文件名**（取流按 basename 走预览服务）。
 */
function absoluteMediaPath(path: string | null | undefined): string | null {
  if (!path || !/^(file|https?):\/\//i.test(path)) return null;
  const base = decodeURIComponent((path.split('?')[0].split('/').pop()) || '');
  return MEDIA_EXT_RE.test(base) ? base : null;
}

/** 绝对路径媒体的合成 TFile（只为 getResourcePath 取流；不在文件系统里，不参与读写） */
function mediaFile(base: string): TFile {
  const f = new TFile();
  f.path = base;
  f.name = base;
  f.basename = base.replace(/\.[^.]+$/, '');
  f.extension = base.includes('.') ? base.split('.').pop()! : '';
  return f;
}

// ==================== frontmatter 最小解析 / 序列化 ====================

/** 去引号（persistItem/种子均写裸值；容忍成对引号） */
function stripQuotes(v: string): string {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/** 最小 YAML：`key: 值` 顶格 + `- 值` 列表项 + 内联 `[a, b]`；值一律保字符串（消费方自转型） */
function parseYaml(text: string): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  let lastKey: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^\s*-\s+/.test(line)) {
      const v = stripQuotes(line.replace(/^\s*-\s+/, '').trim());
      if (!lastKey) continue;
      const cur = fm[lastKey];
      if (Array.isArray(cur)) cur.push(v);
      else fm[lastKey] = cur === '' || cur === undefined ? [v] : [String(cur), v];
      continue;
    }
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    lastKey = key;
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim();
      fm[key] = inner ? inner.split(',').map((s) => stripQuotes(s.trim())) : [];
    } else {
      fm[key] = stripQuotes(val);
    }
  }
  return fm;
}

/** 序列化回 persistItem 的写入格式（列表键逐行 `- x`；空值写裸键；保持键序） */
function serializeYaml(fm: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`- ${String(item)}`);
    } else if (v === '') {
      lines.push(`${k}:`);
    } else {
      lines.push(`${k}: ${String(v)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

/** 拆 frontmatter：有则解析并返回 body；无则整体按 body（frontmatter = null） */
export function splitFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
  had: boolean;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/.exec(content);
  if (!m) return { frontmatter: null, body: content, had: false };
  return { frontmatter: parseYaml(m[1]), body: m[2] ?? '', had: true };
}

// ==================== App / vault（localStorage 文件系统 + 跨实例 storage 桥） ====================

const LS_PREFIX = 'bz-sim:';
const STAT_KEY = 'bz-sim:__stat__';
type FileStat = { ctime: number; mtime: number };

/**
 * 内存 vault：实现影院依赖链用到的文件系统面（读改写/建目录/列文件/回收站）。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * 浏览器自动向另一 iframe 广播 storage 事件 → 本类转译为 delete/modify 事件 →
 * core/obsidian-adapter 转发为 vault:md-* 域事件 → cinema 自动刷新——完整模拟插件
 * 「数据文件外部变更自动刷新」语义）。
 */
export class FakeVault {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  private idSeq = 0;

  constructor() {
    // 跨实例写入：浏览器只向「非写者」文档派发 storage 事件——收到即视为外部变更
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith(LS_PREFIX) || e.key === STAT_KEY) return;
        const path = e.key.slice(LS_PREFIX.length);
        this.emit(e.newValue == null ? 'delete' : 'modify', { path });
      });
    }
  }

  private raw(path: string): string | null {
    return localStorage.getItem(LS_PREFIX + path);
  }

  private stats(): Record<string, FileStat> {
    try {
      return JSON.parse(localStorage.getItem(STAT_KEY) || '{}') as Record<string, FileStat>;
    } catch {
      return {};
    }
  }

  private saveStats(stats: Record<string, FileStat>): void {
    localStorage.setItem(STAT_KEY, JSON.stringify(stats));
  }

  private makeFile(path: string): TFile | null {
    if (this.raw(path) == null) return null;
    const s = this.stats()[path] || { ctime: 0, mtime: 0 };
    const f = new TFile();
    f.path = path;
    f.name = path.split('/').pop() || path;
    f.basename = f.name.replace(/\.[^.]+$/, '');
    f.extension = f.name.includes('.') ? f.name.split('.').pop()! : '';
    f.stat = { ...s };
    return f;
  }

  getAbstractFileByPath(path: string): TFile | null {
    // 演示海报是 vault **绝对路径**（`file:///E:/…/CONFIG/MOVIE POSTER/x.png`，种子直写 frontmatter；
    // 真插件里海报是 vault 相对路径）→ 不在 localStorage 文件系统里，但必须能解析成 TFile，
    // 否则 ui.posterUrl 判空、整片海报退回首字占位（评审壳看着像「海报一直在加载」，2026-09-20 用户反馈）。
    // 取流见 getResourcePath。
    const media = absoluteMediaPath(path);
    if (media) return mediaFile(media);
    return this.makeFile(path);
  }

  /** 资源 URL（真插件返回 vault 资源路径）：
   *  - http(s) 环境（`node scripts/preview-live.mjs` 起的评审服务）：`/__vault-media/<文件名>`，
   *    服务端按 basename 从**真实 vault** 现场取流——海报全量 1.8G 不可能入库，只留名不入图；
   *  - file:// 双击直开：无服务端 → 返回绝对路径，浏览器直读本地文件（原口径）。 */
  getResourcePath(f: TFile): string {
    if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      return '/__vault-media/' + encodeURIComponent(f.name);
    }
    return f.path;
  }

  /** 列 md 文件（getMarkdownFiles：跳过 __stat__ 等内部键；顺序 = localStorage 插入序） */
  getMarkdownFiles(): TFile[] {
    const paths: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX) || k === STAT_KEY) continue;
      const p = k.slice(LS_PREFIX.length);
      if (p.endsWith('.md')) paths.push(p);
    }
    return paths.map((p) => this.makeFile(p)!);
  }

  async read(f: TFile): Promise<string> {
    const raw = this.raw(f.path);
    if (raw == null) throw new Error('文件不存在：' + f.path);
    return raw;
  }

  async modify(f: TFile, content: string): Promise<void> {
    localStorage.setItem(LS_PREFIX + f.path, content);
    const stats = this.stats();
    const cur = stats[f.path] || { ctime: Date.now(), mtime: Date.now() };
    stats[f.path] = { ctime: cur.ctime, mtime: Date.now() };
    this.saveStats(stats);
    this.emit('modify', { path: f.path });
  }

  async create(path: string, content: string): Promise<TFile> {
    if (this.raw(path) != null) throw new Error('文件已存在：' + path);
    localStorage.setItem(LS_PREFIX + path, content);
    const stats = this.stats();
    stats[path] = { ctime: Date.now(), mtime: Date.now() };
    this.saveStats(stats);
    const f = this.makeFile(path)!;
    this.emit('create', f);
    return f;
  }

  async createFolder(_path: string): Promise<void> {
    // localStorage 无目录概念——persistItem/quickAddWant 的 ensureDir 调用此方法，no-op
    return undefined as never;
  }

  /** 回收站删除（openConfirm 的 vault.trash；system 参数与 Obsidian 同形，原型的回收站即消失） */
  async trash(f: TFile, _system?: boolean): Promise<void> {
    localStorage.removeItem(LS_PREFIX + f.path);
    const stats = this.stats();
    delete stats[f.path];
    this.saveStats(stats);
    this.emit('delete', { path: f.path });
  }

  /** 事件订阅（core/obsidian-adapter 的 vault.on/offref 同形；cb 可带第二参 rename oldPath） */
  on(evt: string, cb: (...args: unknown[]) => void): { ref: number } {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(cb);
    const id = ++this.idSeq;
    return { ref: id };
  }

  offref(_ref: unknown): void {
    // 简化：全量退订（原型单会话无并发退订场景）
    this.listeners.clear();
  }

  /** 内部派发（FakeFileManager 改名回放 rename 事件用） */
  emitEvent(evt: string, ...args: unknown[]): void {
    this.emit(evt, ...args);
  }

  /** 内部迁移 stat（FakeFileManager.renameFile 用；源无记录则给当下时刻） */
  moveStat(from: string, to: string): void {
    const stats = this.stats();
    stats[to] = stats[from] || { ctime: Date.now(), mtime: Date.now() };
    delete stats[from];
    this.saveStats(stats);
  }

  private emit(evt: string, ...args: unknown[]): void {
    for (const cb of this.listeners.get(evt) ?? []) cb(...args);
  }
}

/** fileManager 面：改名（renameFile）+ frontmatter 写入（processFrontMatter）——persistItem 消费 */
export class FakeFileManager {
  constructor(private vault: FakeVault) {}

  async renameFile(file: TFile, newPath: string): Promise<void> {
    const content = localStorage.getItem(LS_PREFIX + file.path);
    if (content == null) throw new Error('改名失败，源文件不存在：' + file.path);
    localStorage.setItem(LS_PREFIX + newPath, content);
    localStorage.removeItem(LS_PREFIX + file.path);
    this.vault.moveStat(file.path, newPath);
    const oldPath = file.path;
    file.path = newPath;
    file.name = newPath.split('/').pop() || newPath;
    file.basename = file.name.replace(/\.[^.]+$/, '');
    this.vault.emitEvent('rename', file, oldPath);
  }

  /** frontmatter 读改写：fn 就地改 fm → 序列化回写（body 保留；无 frontmatter 的文件按 Obsidian 语义补建）→ 走 vault.modify（含事件） */
  async processFrontMatter(file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> {
    const content = localStorage.getItem(LS_PREFIX + file.path) ?? '';
    const { frontmatter, body } = splitFrontmatter(content);
    const fm = frontmatter ?? {};
    fn(fm);
    await this.vault.modify(file, serializeYaml(fm) + body);
  }
}

/**
 * 评审壳种子直写（fake-sim 启动时用；不经事件——种子完成前行为层尚未挂订阅）。
 * ctime 由调用方给定：种子按导出序递减，让「加入先后」排序 = 导出序。
 */
export function seedVaultFile(path: string, content: string, ctime: number): void {
  localStorage.setItem(LS_PREFIX + path, content);
  let stats: Record<string, FileStat> = {};
  try {
    stats = JSON.parse(localStorage.getItem(STAT_KEY) || '{}') as Record<string, FileStat>;
  } catch {
    stats = {};
  }
  stats[path] = { ctime, mtime: ctime };
  localStorage.setItem(STAT_KEY, JSON.stringify(stats));
}

/** 评审壳种子数据（fake-sim 启动时写入） */
export class FakeApp {
  vault = new FakeVault();
  fileManager = new FakeFileManager(this.vault);
  metadataCache = {
    /** data.ts parseMovieFile 唯一消费面：现场解析 frontmatter（文件缺失/无 frontmatter → null） */
    getFileCache(file: TFile): { frontmatter: Record<string, unknown> } | null {
      const content = localStorage.getItem(LS_PREFIX + file.path);
      if (content == null) return null;
      const { frontmatter } = splitFrontmatter(content);
      return frontmatter ? { frontmatter } : null;
    },
  };
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
// （fake-sim.ts import '../core/app' 的 setApp 注入 FakeApp；core/ai 的 getApp 取到同一
// 实例，单源不裂）。

export type App = FakeApp;

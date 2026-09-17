/**
 * 游戏架行为单源 · 公共假 obsidian（范式自 cinema/belongings 适配）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但游戏架真实现只用到以下出口：
 *   - Platform.isMobile   → 视口 ≤768 判定（评审壳移动 iframe 归它管）
 *   - setIcon / IconName  → DOM 内联 SVG（表 = window.GS_ICONS，prototype-icons.js）
 *   - TFile               → instanceof 判定与文件元信息面（FakeVault 返回本类实例）
 *   - requestUrl          → **Steam 响应罐头回放**（见下；真 parse 函数跑真数据形状）
 *   - App / vault         → localStorage 文件系统（游戏数据 = 我的/游戏/*.md 笔记，
 *                           读改写/建目录/列文件/回收站/frontmatter 写入全真）
 *   - metadataCache       → getFileCache 现场解析 frontmatter（notes.ts 唯一消费面）
 *
 * requestUrl 罐头（这是本域与影院假层的最大差别：游戏架的核心数据来自网络）：
 *   - GetOwnedGames        → 由 window.GAMESHELF_DATA（真实 vault 147 篇笔记快照）现拼，
 *                            于是「立即同步」在壳里跑的是**真对账链**，结果与笔记一致（零变更）；
 *   - GetRecentlyPlayedGames → 真机也是空的（近两周没玩，total_count=0）；
 *   - appdetails / appreviews / 成就三接口 → window.GAMESHELF_DETAIL 的**真实响应原样回放**
 *                            （抓取脚本 .scratch/fetch-gameshelf-detail.py，凭据不入库）；
 *   - 未抓到详情的 appid → 给一份**自报家门的演示罐头**（成就名「演示成就 N」、
 *                            简介写明「原型罐头」），绝不用编造值冒充真数据；
 *   - 图片类 URL（CDN 封面/成就图标）→ 回 1 字节 arrayBuffer，让 posters.ts 的
 *                            本地缓存队列正常走完（显示仍回落远端 URL）。
 *
 * 与插件侧的差异收敛到这里（本文件是浏览器版假层，随 prototype-behavior.js 产物进 git）：
 *   - frontmatter 解析/序列化是最小 YAML 面（键: 值 顶格列表项/内联数组），
 *     覆盖 notes.ts 的写入格式与 prototype-data.js 种子格式——不是完整 YAML。
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.GS_ICONS） ====================

declare global {
  interface Window {
    GS_ICONS?: Record<string, string>;
    GAMESHELF_DATA?: SeedGame[];
    GAMESHELF_DETAIL?: DetailBundle;
  }
}

/** 种子单条（prototype-data.js；字段与笔记管辖键同名同义） */
export interface SeedGame {
  appid: number;
  name: string;
  /** 中文名（真实 appdetails 本地化名；空 = 未抓到 → 界面回落英文名，names.ts 队列会去补） */
  zh: string;
  min: number;
  last: string;
  cover: string;
  icon: string;
  win: number;
  deck: number;
  mac: number;
  linux: number;
  ach: boolean;
}

/** 详情罐头（prototype-detail.js：真实 API 响应原样） */
export interface DetailBundle {
  store: Record<string, unknown>;
  ach: Record<string, { schema: unknown; player: unknown; global: unknown }>;
  reviews?: Record<string, unknown>;
  caveat?: Record<string, string>;
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.GS_ICONS?.[iconId]) || '';
  if (!d) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = d; // 内容为受控图标表
  container.replaceChildren(svg);
}

export type IconName = string;

// ==================== Steam 罐头回放 ====================

/** 同文档优先，其次父页（评审壳持有全局；iframe 场景读父页） */
function globalOf<T>(key: 'GAMESHELF_DATA' | 'GAMESHELF_DETAIL'): T | null {
  const self = (window as unknown as Record<string, unknown>)[key] as T | undefined;
  if (self) return self;
  try {
    const p = window.parent as unknown as Record<string, unknown>;
    return (p && (p[key] as T)) || null;
  } catch {
    return null;
  }
}

function seedGames(): SeedGame[] {
  return globalOf<SeedGame[]>('GAMESHELF_DATA') ?? [];
}

function detailBundle(): DetailBundle {
  return globalOf<DetailBundle>('GAMESHELF_DETAIL') ?? { store: {}, ach: {} };
}

/** 'YYYY-MM-DD' → unix 秒（真机 rtime_last_played 口径；空 → 0） */
function unixOf(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return 0;
  return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1000);
}

/** icon URL 里的 hash 段（真机 img_icon_url 只有 hash，notes.ts 会再拼回完整 URL） */
function iconHash(icon: string): string {
  const m = /\/apps\/\d+\/([^/]+)\.jpg$/.exec(icon || '');
  return m ? m[1] : '';
}

/** appdetails 请求 URL → appid（批量时取首个；本域每次只查一个） */
function appidOf(url: string): number {
  const m = /appids=(\d+)/.exec(url) || /appreviews\/(\d+)/.exec(url) || /appid=(\d+)/.exec(url) || /gameid=(\d+)/.exec(url);
  return m ? Number(m[1]) : 0;
}

/** 演示罐头（未抓到真详情的 appid）：名字自报家门，不冒充真数据 */
function demoStore(g: SeedGame): unknown {
  return [{ success: true, data: {
    type: 'game',
    name: g.name,
    is_free: false,
    short_description: '原型罐头：这款游戏的真实商店资料没抓到，这里用占位文案走通版式。真机在装了系统代理时会拉到 Steam 的中文简介。',
    supported_languages: '英语, 简体中文',
    developers: ['演示开发商'],
    publishers: ['演示发行商'],
    platforms: { windows: true, mac: false, linux: false },
    categories: [{ description: '单人' }, { description: 'Steam 成就' }],
    genres: [{ description: '演示类型' }],
    recommendations: { total: 1234 },
    release_date: { date: '20xx 年 x 月 x 日' },
    price_overview: { final_formatted: '¥ 00', discount_percent: 0 },
    screenshots: [
      { path_full: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg` },
      { path_full: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/capsule_616x353.jpg` },
      { path_full: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg` },
    ],
    achievements: { total: 12 },
    support_info: { url: 'https://help.steampowered.com/', email: '' },
  } }];
}

function demoReviews(): unknown {
  return { query_summary: { review_score_desc: '多半好评', total_reviews: 1234, total_positive: 1000, total_negative: 234 } };
}

/** 演示成就（未抓到真成就的 appid）：12 条自报家门的假成就，只为把版式跑满 */
function demoAchievements(g: SeedGame): { schema: unknown; player: unknown; global: unknown } {
  const n = 12;
  const names = Array.from({ length: n }, (_, i) => `DEMOACH${String(i + 1).padStart(2, '0')}`);
  return {
    schema: { game: { availableGameStats: { achievements: names.map((nm, i) => ({
      name: nm,
      displayName: `演示成就 ${String(i + 1).padStart(2, '0')}`,
      description: '原型罐头：真机为 Steam 成就说明',
      hidden: 0,
      icon: g.icon || '',
    })) } } },
    player: { playerstats: { achievements: names.map((nm, i) => ({
      apiname: nm,
      achieved: i % 3 === 0 ? 1 : 0,
      unlocktime: i % 3 === 0 ? 1700000000 + i * 86400 : 0,
    })) } },
    global: { achievementpercentages: { achievements: names.map((nm, i) => ({ name: nm, percent: Math.round((4 + i * 7.3) * 10) / 10 })) } },
  };
}

/** URL → 罐头响应（null = 本假层不认这个请求） */
function replay(url: string): { status: number; json: unknown; text: string } | null {
  const reply = (json: unknown) => ({ status: 200, json, text: JSON.stringify(json) });

  if (url.includes('IPlayerService/GetOwnedGames')) {
    const games = seedGames().map((g) => ({
      appid: g.appid,
      name: g.name,
      playtime_forever: g.min,
      rtime_last_played: unixOf(g.last),
      img_icon_url: iconHash(g.icon),
      playtime_windows_forever: g.win,
      playtime_deck_forever: g.deck,
      playtime_mac_forever: g.mac,
      playtime_linux_forever: g.linux,
      has_community_visible_stats: g.ach,
    }));
    return reply({ response: { game_count: games.length, games } });
  }
  if (url.includes('IPlayerService/GetRecentlyPlayedGames')) {
    // 真机同款：近两周没玩 → total_count 0 且 games 缺省
    return reply({ response: { total_count: 0 } });
  }

  const appid = appidOf(url);
  const bundle = detailBundle();
  const seed = seedGames().find((g) => g.appid === appid);

  if (url.includes('/api/appdetails')) {
    const real = bundle.store[String(appid)];
    if (real) return reply(real);
    return seed ? reply(demoStore(seed)) : reply([{ success: false }]);
  }
  if (url.includes('/appreviews/')) {
    const real = bundle.reviews?.[String(appid)];
    return reply(real ?? demoReviews());
  }
  if (url.includes('GetSchemaForGame')) {
    const real = bundle.ach[String(appid)];
    return reply(real?.schema ?? (seed ? demoAchievements(seed).schema : { game: {} }));
  }
  if (url.includes('GetPlayerAchievements')) {
    const real = bundle.ach[String(appid)];
    if (real) return reply(real.player);
    // 真机语义：没有成就页的游戏这里返回 400 → UI 走「没有公开成就」分支
    if (seed && !seed.ach) return { status: 400, json: {}, text: '{}' };
    return reply(seed ? demoAchievements(seed).player : { playerstats: {} });
  }
  if (url.includes('GetGlobalAchievementPercentagesForApp')) {
    const real = bundle.ach[String(appid)];
    return reply(real?.global ?? (seed ? demoAchievements(seed).global : { achievementpercentages: { achievements: [] } }));
  }
  // 图片（封面 CDN / 成就图标）：给 1 字节，让 posters.ts 的本地缓存队列走完
  if (/steamstatic\.com|steampowered\.com\/steamcommunity/.test(url)) {
    return { status: 200, json: {}, text: '', arrayBuffer: new ArrayBuffer(1) } as never;
  }
  return null;
}

/** Steam 通道（真实现走 obsidian requestUrl；壳里回放罐头） */
export async function requestUrl(opts?: { url?: string }): Promise<{ status: number; json: unknown; text: string }> {
  const url = String(opts?.url ?? '');
  const r = replay(url);
  if (!r) throw new Error('原型壳没有这个请求的罐头：' + url);
  return r as { status: number; json: unknown; text: string };
}

// ==================== 设置面板直达链的壳类桩 ====================
// ui.ts 的引导态「去配置」动态 import('../settings-panel')，那条链内联了全域 schema
// （path-picker / settings-schema / clipbook / encrypt 等）。这些出口只需**可解析**：
// 原型 sim 不打开设置面板，运行期不构造它们。范式同 review 域假层。

export class Setting {
  settingEl = document.createElement('div');
  constructor(_container?: unknown) {}
}
export class MarkdownRenderer {
  static render(): Promise<void> {
    return Promise.resolve();
  }
  static renderMarkdown(): Promise<string> {
    return Promise.resolve('');
  }
}
export class MarkdownView {}
export class Component {
  load(): void {}
  unload(): void {}
  onload(): void {}
  onunload(): void {}
  addChild<T>(): T | null {
    return null;
  }
  removeChild(): void {}
  registerEvent(): void {}
  register(): void {}
  registerDomEvent(): void {}
  registerInterval(): number {
    return 0;
  }
}
export class Notice {
  constructor(_msg?: string, _duration?: number) {}
  hide(): void {}
  setMessage(): this {
    return this;
  }
}
export class Modal {
  app?: unknown;
  constructor(_app?: unknown) {}
  open(): void {}
  close(): void {}
}
export class TFolder {}
export class TAbstractFile {}
export class Plugin {
  constructor(_app?: unknown, _manifest?: unknown) {}
  addRibbonIcon(): unknown {
    return null;
  }
  addSettingTab(): void {}
  registerEvent(): void {}
  register(): void {}
  registerDomEvent(): void {}
  registerInterval(): number {
    return 0;
  }
}
export class PluginSettingTab {
  constructor(_app?: unknown, _plugin?: unknown) {}
  display(): void {}
  hide(): void {}
}
export class FuzzySuggestModal {
  constructor(_app?: unknown) {}
  open(): void {}
  getItems(): unknown[] {
    return [];
  }
}
export class AbstractInputSuggest {
  constructor(_app?: unknown, _input?: unknown) {}
  open(): void {}
  close(): void {}
}
export class Scope {}
export function normalizePath(p: string): string {
  return p.replace(/([\\/])+/g, '/');
}
export function addIcon(_id?: string, _svg?: string): void {}

// ==================== TFile ====================

/** 最小 TFile：path/name/basename/extension/stat——notes.ts / posters.ts 消费面 */
export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
  stat: { ctime: number; mtime: number } = { ctime: 0, mtime: 0 };
}

// ==================== frontmatter 最小解析 / 序列化 ====================

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

/** 布尔/数字还原：最小 YAML 把一切读成字符串，而 notes.ts 判 `=== true` / Number() */
function coerce(fm: Record<string, unknown>): Record<string, unknown> {
  for (const k of ['已下架', '有成就', '简体中文支持']) {
    if (fm[k] === 'true') fm[k] = true;
    else if (fm[k] === 'false') fm[k] = false;
  }
  return fm;
}

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
      const s = String(v);
      // 含冒号/引号的值加引号（Obsidian 的 YAML 写入语义；简中简介里常有冒号）
      lines.push(/[:#"']/.test(s) ? `${k}: "${s.replace(/"/g, '\\"')}"` : `${k}: ${s}`);
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
  return { frontmatter: coerce(parseYaml(m[1])), body: m[2] ?? '', had: true };
}

// ==================== App / vault（localStorage 文件系统 + 跨实例 storage 桥） ====================

const LS_PREFIX = 'bz-sim:';
const STAT_KEY = 'bz-sim:__stat__';
type FileStat = { ctime: number; mtime: number };

export class FakeVault {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  private idSeq = 0;

  constructor() {
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
    return this.makeFile(path);
  }

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
    // localStorage 无目录概念——posters.ts 的 ensureDir 调它，no-op
    return undefined as never;
  }

  async trash(f: TFile, _system?: boolean): Promise<void> {
    localStorage.removeItem(LS_PREFIX + f.path);
    const stats = this.stats();
    delete stats[f.path];
    this.saveStats(stats);
    this.emit('delete', { path: f.path });
  }

  /** 二进制写（posters.ts 的本地海报缓存用）：只记账占位，内容不落 localStorage */
  adapter = {
    writeBinary: async (path: string, buf: ArrayBuffer): Promise<void> => {
      localStorage.setItem(LS_PREFIX + path, 'binary:' + buf.byteLength);
      const stats = this.stats();
      if (!stats[path]) stats[path] = { ctime: Date.now(), mtime: Date.now() };
      this.saveStats(stats);
    },
  };

  on(evt: string, cb: (...args: unknown[]) => void): { ref: number } {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(cb);
    return { ref: ++this.idSeq };
  }

  offref(_ref: unknown): void {
    this.listeners.clear();
  }

  emitEvent(evt: string, ...args: unknown[]): void {
    this.emit(evt, ...args);
  }

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

/** fileManager 面：改名 + frontmatter 写入（notes.ts 的 processFrontMatter 消费） */
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

  async processFrontMatter(file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> {
    const content = localStorage.getItem(LS_PREFIX + file.path) ?? '';
    const { frontmatter, body } = splitFrontmatter(content);
    const fm = frontmatter ?? {};
    fn(fm);
    await this.vault.modify(file, serializeYaml(fm) + body);
  }
}

/** 评审壳种子直写（fake-sim 启动时用；不经事件——种子完成前行为层尚未挂订阅） */
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

export class FakeApp {
  vault = new FakeVault();
  fileManager = new FakeFileManager(this.vault);
  metadataCache = {
    /** notes.ts rebuildItems 唯一消费面：现场解析 frontmatter */
    getFileCache(file: TFile): { frontmatter: Record<string, unknown> } | null {
      const content = localStorage.getItem(LS_PREFIX + file.path);
      if (content == null) return null;
      const { frontmatter } = splitFrontmatter(content);
      return frontmatter ? { frontmatter } : null;
    },
  };
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
export type App = FakeApp;

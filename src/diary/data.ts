/**
 * 日记本（diary）域数据层——原回忆墙升格正名（ADR-0115）
 * 聚合四类内容：日记 + 影视 + 信 + 书，统一按日期时间降序混排。
 * - 日记：`我的/日记/YYMMDDHHmm(-N)?.md` → parseEntryFile（ADR-0130/0131 一目一文件，filename=file.path）；
 * - 影视：`我的/影视/*.md` → parseMovieFile（每文件一条，无影评/无观影日期跳过）；
 * - 信：`我的/信/*.md` → parseLetterFile（readonly 跳过）；
 * - 书：`书库/*.md` → parseBookFile（无 completionDate/readingDate 跳过；封面经 extractMedia 提取）。
 * 数据格式（ADR-0130/0131）：条目文件，frontmatter `date`+`type`，契约单源 core/diary-format.ts（解析见 ./parser，自包含）。
 * 依赖方向（ADR-0002）：core ← config/state ← parser ← store ← ui ← main；本文件不碰 DOM，App 一律参数注入。
 * 自包含：不依赖 ../diary/（用户决策「回忆墙自包含，日后删除日记本域」）——config/parser/types 均在本域内。
 * 媒体 URL 走 vault API（getResourcePath / getFirstLinkpathDest）：原型里硬编码 file:// 路径在 vault 内不可播放，
 * 必须经 Obsidian 资源路径才能被 img/video/audio 加载。
 *
 * **分批读盘（ADR-0259）**：四类混排的全序不必读正文就能定——日记的日/时在题目里（`YYMMDDHHmm`），
 * 影视/书只读 frontmatter、信读正文但量小，一次解析齐。于是读盘按窗推进（一窗 = `diaryPageSize` 则，
 * 缺省 50）：开册由 UI 读到「第 1 卷收卷」为止即停（`loadMoreWallEntries`），其余交给 `fillWallEntries`
 * 在后台读完——数据层最终是全量，只摊开哪一卷由 UI 的分卷（`./volume`）决定。
 */
import type { App, TFile } from 'obsidian';
import { parseEntryFile, parseMovieFile, parseLetterFile, parseBookFile } from './parser';
import { diaryMetaFromEntryPath } from '../core/diary-format';
import { DIARY_DIRECTORY, LETTER_DIRECTORY, movieDirectory, bookDirectory, inWallDirs } from './config';
import { onDomainEvent } from '../core/domain-bus';
import { tryGetSettings } from '../core/settings-provider';
import type { DiaryEntry } from './types';

// WallEntry 家族类型已上移 ./types（render 纯层经 types 引用，不触本文件 obsidian 依赖）
export type { WallMedia, WallEntryKind, WallSegment, WallEntry } from './types';
import type { WallMedia, WallEntryKind, WallSegment, WallEntry } from './types';

/** 扩展名 → 媒体类型（jpg/jpeg/png/webp/gif/avif→img；mp4/mov/webm→video；wav/m4a/mp3/flac/aac/ogg→audio） */
const MEDIA_EXT_KIND: Record<string, WallMedia['kind']> = {
  jpg: 'img',
  jpeg: 'img',
  png: 'img',
  webp: 'img',
  gif: 'img',
  avif: 'img',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  wav: 'audio',
  m4a: 'audio',
  mp3: 'audio',
  flac: 'audio',
  aac: 'audio',
  ogg: 'audio',
};

/** `![[引用]]` 内链正则（含 `|参数` 后缀；`#` 后的块引用定位符不属于链接名，不纳入引用名） */
const WIKILINK_RE = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;

/**
 * 从正文提取 `![[文件名.扩展名]]` / `![[路径/文件名.扩展名]]` 媒体引用（Obsidian 内链语法）。
 * - 只提取图片/视频/音频扩展名，忽略 `.md` 等非媒体内链；
 * - 支持 `![[xxx.jpg|400]]` 尺寸参数（去掉 `|...` 后缀）；
 * - 支持带路径引用（保留完整引用路径，media.name 即引用原文）；
 * - 去重：同一引用只保留首次出现。
 * vaultDir：媒体归属目录（loadWallEntries 传入各内容目录），为「按目录过滤媒体」预留的解析基目录；
 * 当前提取阶段不改变引用原文——Obsidian 链接是全局解析，拼接目录会破坏 getFirstLinkpathDest 解析。
 */
export function extractMedia(content: string, vaultDir: string): WallMedia[] {
  void vaultDir; // 预留参数：目录过滤语义待 UI 联调确定，接口先行稳定
  const seen = new Set<string>();
  const media: WallMedia[] = [];
  const re = new RegExp(WIKILINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const ref = m[1].trim();
    const dot = ref.lastIndexOf('.');
    if (dot <= 0 || dot === ref.length - 1) continue;
    const ext = ref.slice(dot + 1).toLowerCase();
    const kind = MEDIA_EXT_KIND[ext];
    if (!kind) continue; // 非媒体扩展名（.md 等）忽略
    if (seen.has(ref)) continue;
    seen.add(ref);
    media.push({ name: ref, kind });
  }
  return media;
}

/**
 * 去除正文中的媒体嵌入（`![[...]]`，含图片/视频/音频及 `|400` 尺寸参数），返回剩余 markdown 原文（渲染用）。
 * - 与 extractMedia 同一扩展名判定：只删媒体类 `![[...]]`（整体删除，含 `![[` 与 `]]`）；
 * - 非媒体内链（`[[其他笔记]]`、`[[书库/xx#^block]]`、`![[xx.md]]`）原样保留——不是要隐藏的媒体引用；
 * - 其余 markdown 语法（加粗/斜体/标题/列表/引用/链接等）不受影响，原样保留；
 * - 结果 trim（全媒体条目返回空串）。
 */
export function stripMediaLinks(content: string): string {
  const re = new RegExp(WIKILINK_RE.source, 'g');
  return content.replace(re, (whole, ref: string) => {
    const name = ref.trim();
    const dot = name.lastIndexOf('.');
    if (dot <= 0 || dot === name.length - 1) return whole;
    return MEDIA_EXT_KIND[name.slice(dot + 1).toLowerCase()] ? '' : whole;
  }).trim();
}

/** 批量并发读取窗口（日记/影视/信/书共用：控制单批 vault.read 并发量） */
const READ_BATCH_SIZE = 10;

/**
 * 读盘进度订阅者：`(已读篇数, 总篇数)`。
 *
 * 只服务「开册进度条」（日记域 UI）——日记正文是 1243 篇走 `vault.read` 的磁盘读 + 每批 10 的
 * 串行批次，读完要好几秒；这期间书还是空的，得让人看见「在读、读到哪儿了」。
 *
 * 用**模块级订阅**而不是 `loadWallEntries(app, onProgress)` 的入参：预热（`prewarmDiary`）可能
 * 已经在读同一轮，UI 打开时命中的是**在途**那一个 promise，入参式回调用不上；订阅制对
 * 「命中在途」与「新起一轮」一视同仁。缓存命中（同步返回全量）不报进度——那时没有等待可言。
 */
export type WallProgressFn = (done: number, total: number) => void;
const progressSinks = new Set<WallProgressFn>();

/** 订阅「当前/下一轮」读盘进度，返回退订函数 */
export function onWallProgress(fn: WallProgressFn): () => void {
  progressSinks.add(fn);
  return () => {
    progressSinks.delete(fn);
  };
}

function emitWallProgress(done: number, total: number): void {
  for (const fn of [...progressSinks]) {
    try {
      fn(done, total);
    } catch {
      /* 单个订阅者出错不拖垮读盘 */
    }
  }
}

/**
 * 批量读一个批次（D5' per-file 容错）：单个文件读取/解析失败只跳过该文件
 * （console.warn 一次汇总），不让整墙因一个坏文件空掉。返回成功解析的 WallEntry。
 */
async function readBatch<T>(
  batch: T[],
  readOne: (file: T) => Promise<WallEntry[]>,
  failed: string[]
): Promise<WallEntry[]> {
  const results = await Promise.all(
    batch.map(async (file) => {
      try {
        return await readOne(file);
      } catch (e) {
        const path = (file as { path?: string })?.path || String(file);
        failed.push(path);
        return [];
      }
    })
  );
  const out: WallEntry[] = [];
  for (const r of results) out.push(...r);
  return out;
}

/** 批量读取结束后汇总告警一次（不刷屏） */
function warnFailedBatch(kind: string, failed: string[]): void {
  if (failed.length > 0) {
    console.warn(`[diary] ${kind}加载：${failed.length} 个文件读取失败已跳过：`, failed.join(', '));
  }
}

/**
 * 递归枚举目录下全部 .md 文件路径（vault.adapter.list，Obsidian DataAdapter 标准接口；
 * mock vault 与真实 vault 行为一致，且天然支持子目录递归）。
 * 目录不存在/无权限：list 抛错时跳过该目录，不阻断整体加载。
 */
async function collectMdPaths(app: App, dirPath: string): Promise<string[]> {
  const out: string[] = [];
  // 空目录 = 未配置：不扫（否则 `|| '/'` 会把整个库当成日记目录，几千篇全被读一遍）
  if (!dirPath || !dirPath.trim()) return out;
  const stack: string[] = [dirPath.replace(/\/+$/, '') || dirPath];
  const seen = new Set<string>();
  while (stack.length) {
    const dir = stack.pop()!;
    if (seen.has(dir)) continue;
    seen.add(dir);
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await app.vault.adapter.list(dir);
    } catch {
      continue; // 目录不存在：跳过
    }
    if (!listing) continue;
    for (const f of listing.files || []) {
      if (f.toLowerCase().endsWith('.md')) out.push(f);
    }
    for (const d of listing.folders || []) stack.push(d);
  }
  return out;
}

/** 收集目录下全部 .md TFile（路径 → getAbstractFileByPath 转 TFile，过滤目录） */
async function mdFilesUnder(app: App, dirPath: string): Promise<TFile[]> {
  const vault = app.vault;
  const mdPaths = await collectMdPaths(app, dirPath);
  const mdFiles: TFile[] = [];
  for (const p of mdPaths) {
    const f = vault.getAbstractFileByPath(p);
    if (f && !('children' in f) && (f as TFile).extension === 'md') mdFiles.push(f as TFile);
  }
  return mdFiles;
}

/**
 * 按原文顺序提取内容段（issue 213）：媒体嵌入切开文字，交错保留。
 * - 媒体段 = `![[媒体文件]]`（与 extractMedia 同一扩展名判定，含 `|参数`）；
 * - 文字段 = 嵌入之间的 markdown 原文（trim，空段丢弃）；非媒体内链原样保留在文字段；
 * - 空串输入返回 []。
 */
export function extractSegments(content: string): WallSegment[] {
  const segs: WallSegment[] = [];
  const re = new RegExp(WIKILINK_RE.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (raw: string) => {
    const t = raw.trim();
    if (t) segs.push({ kind: 'text', text: t });
  };
  while ((m = re.exec(content)) !== null) {
    pushText(content.slice(last, m.index));
    const ref = m[1].trim();
    const dot = ref.lastIndexOf('.');
    const kind = dot > 0 && dot < ref.length - 1 ? MEDIA_EXT_KIND[ref.slice(dot + 1).toLowerCase()] : undefined;
    if (kind) segs.push({ kind: 'media', media: { name: ref, kind } });
    else pushText(m[0]); // 非媒体内链（如 ![[xx.md]]）：原样保留为文字
    last = re.lastIndex;
  }
  pushText(content.slice(last));
  return segs;
}

/** DiaryEntry → WallEntry（透传定位字段 + kind 标记 + 派生 media/text；dir 为媒体归属目录） */
function toWallEntry(e: DiaryEntry, kind: WallEntry['kind'], dir: string): WallEntry {
  return {
    date: e.date,
    time: e.time,
    tags: e.tags,
    emoji: e.emoji,
    content: e.content,
    // 透传解析层条目的定位/标识信息：供 UI 跳转/动作区分
    // （ADR-0130 起日记/影视/信/书的 filename 均为完整 vault 路径）
    filename: e.filename,
    filePath: e.filePath,
    lineNumber: e.lineNumber,
    id: e.id,
    // 加密日记条目的保险箱 SafeNote id（encrypted=true 时存在；UI 解密时用，非加密条目为 undefined）
    noteId: e.noteId,
    kind,
    media: extractMedia(e.content, dir),
    // 渲染用正文：去媒体嵌入，保留 markdown 语法（content 保留原文供复制/跳转）
    text: stripMediaLinks(e.content),
    // 按原文顺序的内容段（issue 213：UI 段序渲染，文字不重复、媒体归位）
    segments: extractSegments(e.content),
    // 附加元信息（ADR-0230）：影视/书库的展示余项——票根 meta/score、藏书票 author/category
    extra: e.extra,
  };
}

/**
 * 刚落盘的一篇日记 → 墙条目（ADR-0259 决策 8）。
 * 写完当场插进内存首位并重排落第 0 页，不等那次 400ms 防抖回刷；
 * 回刷落地时 `loadEntries` 会整体替换 `entries`，这一份影子不会留下第二份。
 */
export function wallEntryOfDiary(e: DiaryEntry): WallEntry {
  return toWallEntry(e, 'diary', DIARY_DIRECTORY);
}

/**
 * 日记候补：只按**文件名**排出日/时（题目 `YYMMDDHHmm`），正文一个字都不读。
 * 「先有全序、再按窗读正文」就是开册只读一窗的全部秘密（见 `pickWindow`）。
 */
interface DiarySlot {
  path: string;
  date: string;
  time: string;
}

/** 降序比较器（日期降序、同日时降序）：`<0` 表示 a 更新、排在前面（`HH:mm` 字典序与数值序一致） */
function cmpDesc(aDate: string, aTime: string, bDate: string, bTime: string): number {
  const byDate = bDate.localeCompare(aDate);
  return byDate !== 0 ? byDate : bTime.localeCompare(aTime);
}

/** 枚举目录下全体日记条目文件，按题目日期时间降序（含子目录递归；非条目命名的一律不进候补） */
async function diarySlots(app: App, diaryDir: string): Promise<DiarySlot[]> {
  const mdFiles = await mdFilesUnder(app, diaryDir);
  const slots: DiarySlot[] = [];
  for (const f of mdFiles) {
    const meta = diaryMetaFromEntryPath(f.name);
    if (meta) slots.push({ path: f.path, date: meta.date, time: meta.time });
  }
  /* 同日同刻落了两篇时按文件名字典序定序（`-2` 后缀即题目的次序），保证全序稳定 */
  slots.sort((a, b) => cmpDesc(a.date, a.time, b.date, b.time) || b.path.localeCompare(a.path));
  return slots;
}

/** 读一篇日记条目（D5' 单文件容错：读/解析失败只跳过它，记进 failed 由窗末统一告警） */
async function readDiarySlot(app: App, slot: DiarySlot, diaryDir: string, failed: string[]): Promise<WallEntry | null> {
  const file = app.vault.getAbstractFileByPath(slot.path);
  if (!file || 'children' in file) return null;
  try {
    const content = await app.vault.read(file as TFile);
    const e = parseEntryFile(content, slot.path);
    return e ? toWallEntry(e, 'diary', diaryDir) : null;
  } catch {
    failed.push(slot.path);
    return null;
  }
}

/** 加载单文件单条目的特殊内容（影视/信/书）：parse 返回 null 的跳过；kind 由调用方标记 */
async function loadSpecialEntries(
  app: App,
  dir: string,
  kind: WallEntry['kind'],
  parse: (file: TFile, app: App) => Promise<DiaryEntry | null>
): Promise<WallEntry[]> {
  const mdFiles = await mdFilesUnder(app, dir);
  const entries: WallEntry[] = [];
  const failed: string[] = [];
  for (let i = 0; i < mdFiles.length; i += READ_BATCH_SIZE) {
    const batch = mdFiles.slice(i, i + READ_BATCH_SIZE);
    entries.push(
      ...(await readBatch(
        batch,
        async (file) => {
          const e = await parse(file, app);
          return e ? [toWallEntry(e, kind, dir)] : [];
        },
        failed
      ))
    );
  }
  warnFailedBatch(kind, failed);
  return entries;
}

/**
 * 影视/信/书三类（① 三目录并行）：一个文件一条，量小且日期取自 frontmatter
 * （影视/书连正文都不用读，只走 metadataCache），故**一次解析齐**，作为窗口流里那一侧的游标源。
 * 排序与全墙同口径：date 降序、time 降序。
 */
async function loadOtherEntries(app: App): Promise<WallEntry[]> {
  const [movieE, letterE, bookE] = await Promise.all([
    loadSpecialEntries(app, movieDirectory(), 'movie', parseMovieFile),
    loadSpecialEntries(app, LETTER_DIRECTORY, 'letter', parseLetterFile),
    loadSpecialEntries(app, bookDirectory(), 'book', parseBookFile),
  ]);
  const entries = [...movieE, ...letterE, ...bookE];
  entries.sort((a, b) => cmpDesc(a.date, a.time, b.date, b.time));
  return entries;
}

// ---------- ② 墙数据窗口流（按窗读盘；后台预热与开册共用同一个流） ----------

/** 一窗的默认条数（设置项未注入/非法时的回落值） */
export const WALL_WINDOW_FALLBACK = 50;

/**
 * 卷容量（设置项 `diaryPageSize`，缺省 50；ADR-0259）。
 * 既是**一卷装多少则**，也是读盘一窗的条数：开册先读到第 1 卷收卷，后台再续读剩下的。
 * 非法/缺省值回落 50；夹在 1~1000 之间（1000 以上这本册子就等于回到「一次读全量」了）。
 */
export function wallWindowSize(): number {
  const raw = Number(tryGetSettings()?.diaryPageSize);
  if (!Number.isFinite(raw) || raw <= 0) return WALL_WINDOW_FALLBACK;
  return Math.max(1, Math.min(1000, Math.floor(raw)));
}

/** 一次窗口取条：日记只带候补（正文没读），影视/信/书已解析好 */
type WallPick = { from: 'diary'; slot: DiarySlot } | { from: 'other'; entry: WallEntry };

/**
 * 一段可续读的墙。四类混排的**全序**在首窗就定下来（日记靠题目、三类靠 frontmatter），
 * 正文则按窗读：`entries` 是已读出来的那一段（降序），`diaryAt`/`otherAt` 是两条游标。
 */
interface WallStream {
  app: App;
  /** 首窗（枚举 + 三类解析 + 第一窗读盘）的 promise；失败即整轮作废 */
  ready: Promise<void>;
  /** 读盘期间被域事件作废（并发编辑）：本轮结果不落缓存 */
  invalidated: boolean;
  /** 影视/信/书（已解析，降序）与游标 */
  other: WallEntry[];
  otherAt: number;
  /** 日记候补（只带题目时间，降序）与游标 */
  diary: DiarySlot[];
  diaryAt: number;
  /** 已读出来的条目（降序）——`loadWallEntries` 交给 UI 的就是这一个数组 */
  entries: WallEntry[];
  /** 续读在途（并发去重：连翻几页只多读一窗） */
  more: Promise<WallEntry[]> | null;
  /** 回源补齐在途（并发去重：两条游标不能被两路同时推进） */
  filling: Promise<void> | null;
  /** 本窗读失败的文件（窗末统一 warn 一次，不刷屏） */
  failed: string[];
}

let wallCacheApp: App | null = null;
let stream: WallStream | null = null;
/**
 * 这个 app 会话里「UI 至少要看多少则」。深翻到第 200 则后被外部改动逼着回源，
 * 重读要照这个数补齐——否则整册会突然缩回一窗，人正读的那一页直接没了。
 */
let wallAsked = 0;
let offFns: Array<() => void> = [];

/** 摘除当前域事件订阅（幂等：退订函数本身幂等，clear 后置空数组） */
function detachWallInvalidators(): void {
  for (const off of offFns) off();
  offFns = [];
}

/** 挂墙数据失效订阅：经 core/domain-bus 订 vault:md-*（全插件唯一 vault 订阅点转译，ADR-0047；
 *  不自挂 app.vault.on）。通用路对四目录 md「恒发」（adapter 契约），语义通道不重复订阅。
 *  只作废**当前这一轮**（换 app/新一轮后 stream 已指向新对象，旧订阅回调自然空转）。 */
function attachWallInvalidators(s: WallStream): void {
  const onPath = (p?: string): void => {
    if (p && stream === s && inWallDirs(p)) s.invalidated = true;
  };
  const off = (ch: string, handler: (evt: any) => void): void => {
    offFns.push(onDomainEvent(ch, handler));
  };
  off('vault:md-created', (e: any) => onPath(e?.path));
  off('vault:md-modified', (e: any) => onPath(e?.path));
  off('vault:md-deleted', (e: any) => onPath(e?.path));
  off('vault:md-renamed', (e: any) => {
    onPath(e?.newPath);
    onPath(e?.oldPath);
  });
}

/** 还有没读进来的旧条目（两条游标任一没走到底） */
function streamHasMore(s: WallStream): boolean {
  return s.diaryAt < s.diary.length || s.otherAt < s.other.length;
}

/**
 * 从两条降序游标里取 n 条（**只定序、不读正文**）：谁新先取谁。
 * 日记的日/时来自题目，故未读正文也能与三类条目比出先后。
 */
function pickWindow(s: WallStream, n: number): WallPick[] {
  const picks: WallPick[] = [];
  while (picks.length < n) {
    const d = s.diary[s.diaryAt];
    const o = s.other[s.otherAt];
    if (!d && !o) break;
    const takeDiary = !!d && (!o || cmpDesc(d.date, d.time, o.date, o.time) <= 0);
    if (takeDiary) {
      s.diaryAt++;
      picks.push({ from: 'diary', slot: d });
    } else {
      s.otherAt++;
      picks.push({ from: 'other', entry: o });
    }
  }
  return picks;
}

/** 读一窗（每 READ_BATCH_SIZE 并发；单文件失败只跳过该文件）。返回这一窗解析出来的条目，降序。 */
async function pullWindow(s: WallStream, n: number): Promise<WallEntry[]> {
  const picks = pickWindow(s, n);
  if (!picks.length) return [];
  const out: (WallEntry | null)[] = new Array(picks.length).fill(null);
  for (let i = 0; i < picks.length; i += READ_BATCH_SIZE) {
    const slice = picks.slice(i, i + READ_BATCH_SIZE);
    await Promise.all(
      slice.map(async (p, k) => {
        out[i + k] = p.from === 'other' ? p.entry : await readDiarySlot(s.app, p.slot, DIARY_DIRECTORY, s.failed);
      })
    );
    if (progressSinks.size) emitWallProgress(Math.min(i + READ_BATCH_SIZE, picks.length), picks.length);
  }
  warnFailedBatch('日记', s.failed.splice(0));
  return out.filter((e): e is WallEntry => !!e);
}

/** 首窗：定全序 + 读第一窗。目录枚举与三类解析并行（wall-clock ≈ 较慢的那一侧）。 */
async function buildStream(s: WallStream): Promise<void> {
  const [diary, other] = await Promise.all([diarySlots(s.app, DIARY_DIRECTORY), loadOtherEntries(s.app)]);
  s.diary = diary;
  s.other = other;
  s.entries.push(...(await pullWindow(s, wallWindowSize())));
}

/**
 * 回源补齐：把已读段补到 `wallAsked`（上次翻到第几则）。
 * 串行化——UI 刷新与启动预热可能同时调进来，两条游标不能被两路并发推进（那会把次序打乱）。
 */
function fillStream(s: WallStream): Promise<void> {
  if (s.filling) return s.filling;
  const run = (async () => {
    if (s.more) await s.more.catch(() => undefined); // 续读在路上：等它落地再补，别两路一起推游标
    while (s.entries.length < wallAsked && streamHasMore(s)) {
      s.entries.push(...(await pullWindow(s, wallWindowSize())));
    }
  })().finally(() => {
    if (s.filling === run) s.filling = null;
  });
  s.filling = run;
  return run;
}

/**
 * 聚合加载回忆墙（日记 + 影视 + 信 + 书）的**第一窗**，统一 date 降序、time 降序混排。
 *
 * ②：按 app 键控缓存——同一 app 的重复/并发调用命中在途或新鲜结果，已读的那一段直接复用；
 *    域事件（四目录 md 变更/增删/改名）置 invalidated 后自动回源。app 切换（含测试逐例新建）即失效。
 *    UI 开墙路径命中预热缓存秒开；刷新路径经 invalidateWallCache 强制回源（见 ui.loadAndRender）。
 *    回源会按 `wallAsked` 把「上次已经读到第几则」补齐，深翻过的册子不会缩回一窗。
 */
export async function loadWallEntries(app: App): Promise<WallEntry[]> {
  // 换 app：整轮作废（订阅、游标、已读条数全部重来）
  if (wallCacheApp !== app) {
    detachWallInvalidators();
    stream = null;
    wallCacheApp = app;
    wallAsked = 0;
  }
  // 上一轮已被外部改动作废：先摘订阅再重建
  if (stream && stream.invalidated) {
    detachWallInvalidators();
    stream = null;
  }
  if (!stream) {
    const created: WallStream = {
      app,
      ready: Promise.resolve(),
      invalidated: false,
      other: [],
      otherAt: 0,
      diary: [],
      diaryAt: 0,
      entries: [],
      more: null,
      filling: null,
      failed: [],
    };
    stream = created;
    attachWallInvalidators(created);
    created.ready = buildStream(created);
  }
  const s = stream;
  try {
    await s.ready;
    // 回源补齐：上次翻到第 N 则，重读后还得有第 N 则，否则人正读的那一页凭空消失
    if (s.entries.length < wallAsked) await fillStream(s);
  } catch (e) {
    // 加载失败不缓存：复位，下次调用重新读盘（保持旧「异常即重抛、无残留态」语义）
    if (stream === s) {
      detachWallInvalidators();
      stream = null;
    }
    throw e;
  }
  if (stream === s) {
    // 读盘/合并期间被事件作废（并发编辑）→ 本轮结果不写缓存，下次调用回源重取
    if (s.invalidated) {
      detachWallInvalidators();
      stream = null;
    } else {
      wallAsked = Math.max(wallAsked, s.entries.length);
    }
  }
  return s.entries;
}

/**
 * 续读下一窗：返回**新增**的那一段（降序，接在已读段之后）；没有更多则空数组。
 * UI 开册靠自己循环它读到「第 1 卷收卷」，剩下的由 `fillWallEntries` 接着读。
 * 与 `loadWallEntries` 共用同一个流，故已读段是同一数组的增长，不必整册重读。
 */
export async function loadMoreWallEntries(app: App): Promise<WallEntry[]> {
  const s = stream;
  if (!s || wallCacheApp !== app || s.invalidated) return [];
  try {
    await s.ready;
    // 补齐全过程里先让位（同一段已读区只允许一条游标在动）
    if (s.filling) await s.filling;
  } catch {
    return []; // 首窗就没读出来：这一册等下次开册重来
  }
  if (s.invalidated || !streamHasMore(s)) return [];
  if (s.more) return s.more;
  const run = (async () => {
    const added = await pullWindow(s, wallWindowSize());
    s.entries.push(...added);
    wallAsked = Math.max(wallAsked, s.entries.length);
    return added;
  })();
  s.more = run;
  try {
    return await run;
  } finally {
    if (s.more === run) s.more = null;
  }
}

/** 后面还有没有没读进来的旧条目（UI 判：后台要不要接着读 / 索引里要不要注明「还在读」） */
export function wallHasMore(app: App): boolean {
  return !!stream && wallCacheApp === app && !stream.invalidated && streamHasMore(stream);
}

/**
 * 后台把剩下的读完（ADR-0259 决策 3）：开册只读够第 1 卷，其余在这里续。
 *
 * 读完只让索引 / 搜索 / 台历的覆盖面变大，**不重排书页**——用户当年否掉的就是「书自己变厚」。
 * 返回读到的总条数；中途被域事件作废则停在作废处（下一轮开册重来）。
 */
export async function fillWallEntries(app: App, onChunk?: (read: number) => void): Promise<number> {
  const s = stream;
  if (!s || wallCacheApp !== app) return 0;
  try {
    await s.ready;
  } catch {
    return 0; // 首窗就没读出来：这一轮没有可续的东西
  }
  while (streamHasMore(s) && !s.invalidated && stream === s) {
    const added = await loadMoreWallEntries(app);
    if (!added.length) break; // 全是读失败的文件：别在原地打转
    onChunk?.(s.entries.length);
  }
  return s.entries.length;
}

/** 作废旧订阅 + 缓存：下次 loadWallEntries 强制回源重读（UI 刷新路径 / unloadDiary 复位共用）。
 *  已读条数（`wallAsked`）不随之清零——刷新是「同一本册子重读一遍」，不是「缩回一窗」；
 *  `wallCacheApp` 也留着，它记的是「这是哪个 app 的会话」，只有换 app 才该整轮重来。 */
export function invalidateWallCache(): void {
  detachWallInvalidators();
  stream = null;
}

/**
 * 缓存还新不新（UI 的「这一册不用重排」快路要用）：同一个 app、有在途/已完成的加载、且没被事件作废。
 * 为真 ⇒ 再调 `loadWallEntries` 会拿到**同一份结果**，书页不必重排；为假 ⇒ 得回源重读。
 */
export function wallCacheFresh(app: App): boolean {
  return wallCacheApp === app && !!stream && !stream.invalidated;
}

/** 按月份分组（key 为 'YYYY-MM'），组内保持传入顺序 */
export function groupByMonth(entries: WallEntry[]): Map<string, WallEntry[]> {
  const map = new Map<string, WallEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7); // YYYY-MM
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push(e);
  }
  return map;
}

/**
 * 「那年今天」派生（回忆墙自包含口径，不依赖 diary 域）：取 mmdd 与 today 相同的历史条目。
 * - 口径：`entry.date.slice(5) === today.slice(5)`（月-日逐字比较，跨年命中）；
 * - 排除当年（今天写的日记不属于「那年」，避免首屏与今日内容重复）；
 * - 不做加密过滤——入参传已过滤后的可见条目集（未解锁加密条目本就不在墙上）；
 * - 不筛媒体：纯文字条目与媒体条目一并命中（issue 352 放开，媒体/文字卡分流在 UI 层 mkMemories）；
 * - today 非 YYYY-MM-DD 形状（slice(5) 为空）返回空数组（无命中不渲染由调用方保证）。
 */
export function pickOnThisDay(entries: WallEntry[], today: string): WallEntry[] {
  const mmdd = (today || '').slice(5);
  const thisYear = (today || '').slice(0, 4);
  if (!mmdd || mmdd.length !== 5) return [];
  return entries.filter((e) => e.date.slice(5) === mmdd && e.date.slice(0, 4) !== thisYear);
}

/**
 * 媒体 URL 解析：返回 vault 内文件的可访问资源 URL（媒体可播放的关键，原型硬编码 file:// 不可用）。
 * - 优先 Obsidian 链接解析（getFirstLinkpathDest）：传 sourcePath（来源文件路径，如 '我的/影视/xx.md'）
 *   时以该文件为基准解析（Obsidian 链接解析先找同目录/相对路径，修复纯文件名全局解析失败问题）；
 *   sourcePath 不传时保持向后兼容（'' 全局解析，行为同现状）；
 * - 带路径引用回退 getAbstractFileByPath（此时 sourcePath 无关，仍以引用原文为准）；
 * - 找不到（或命中目录）返回 ''。
 */
export function mediaSrc(app: App, mediaName: string, sourcePath?: string): string {
  if (!mediaName) return '';
  const basePath = sourcePath ?? '';
  const file =
    (app.metadataCache?.getFirstLinkpathDest?.(mediaName, basePath) as TFile | null) ??
    (app.vault.getAbstractFileByPath(mediaName) as TFile | null);
  if (!file || 'children' in file) return ''; // 目录不是媒体文件
  try {
    return app.vault.getResourcePath(file as TFile);
  } catch {
    return ''; // 资源路径解析失败（异常/mock 环境）安全降级
  }
}

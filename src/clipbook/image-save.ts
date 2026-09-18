/**
 * clipbook（issue 329）：保存正文图片到本地。
 *
 * requestUrl 拉二进制（桌面/移动同源，cinema douban-queue 先例 / ADR-0129）→ 写入
 * clipbookImageFolder 设置键目录（留空回落 `<articleDirectory>/assets`，回落范式同
 * knowledge resolveImageDir——只读参考，不在本域 import knowledge）→ 文件名优先取 URL
 * 自带文件名（取不到回落时间戳），判重永不覆盖（writeUniqueBinary 范式）。
 *
 * 落盘两路（ADR-0144 保存图片）：
 * - 已保存条目（有 notePath）：立即把剪藏 md 该外链改写为 `![[本地路径]]`（直写换链）；
 * - 未保存条目：仅落盘 + 记侧写 savedImages（news.json 外部双写不可写；保存物化时统一换链）。
 *
 * 全量本地化（issue 329 追加修订）：extractImageUrls 提取正文全部外链图 +
 * localizeArticleImages 逐张下载落盘（复用侧写 savedImages 不重下），保存剪藏
 * （save.ts writeClipNote）据此把整篇正文图片换成本地嵌入。
 */
import { requestUrl, TFile } from 'obsidian';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { clipDir } from './save';
import type { ClipbookData, ClipSavedImage } from './data';
import { addArticleImageSwap, applyClipContentTransforms } from './anchor';

/** 单请求超时 ms（requestUrl 不支持中止 → Promise.race，对齐 douban-queue 口径） */
const HTTP_TIMEOUT_MS = 15000;
/** 桌面/移动同源 UA（对齐 douban-queue 先例：部分图床对无 UA 请求拒绝） */
const UA_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };

/** 图片扩展名白名单（其余一律落 png；webp/avif Obsidian 原生可显） */
const EXT_WHITELIST = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']);

/**
 * 剪藏图片目录：设置键 clipbookImageFolder（留空回落 <articleDirectory>/assets）。
 * 回落口径走 save.clipDir 单源（CB4/A3 收编；articleDirectory 缺省与尾斜杠归一同一处）。
 */
export function clipbookImageDir(): string {
  const s = tryGetSettings() as any;
  const configured = String((s && s.clipbookImageFolder) || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (configured) return configured;
  return `${clipDir()}/assets`;
}

/** 协议相对地址补全（//host/a.png → https://host/a.png）；data:/blob: 原样返回 */
export function normalizeImageSrc(src: string): string {
  const s = String(src || '').trim();
  if (s.startsWith('//')) return 'https:' + s;
  return s;
}

/** 图片外链 → 扩展名（query 串剥离；白名单外/无扩展名 → png） */
export function extOfImageUrl(src: string): string {
  try {
    const path = String(src || '').split(/[?#]/)[0];
    const ext = (path.split('.').pop() || '').toLowerCase();
    return EXT_WHITELIST.has(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'png';
  } catch (e) {
    return 'png';
  }
}

/** 文件名命中判定用的图片扩展名（大小写兼容；与 EXT_WHITELIST 分列——命名口径更收紧，无 bmp/ico） */
const NAME_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
/** 基名 + 图片扩展名的命中正则（由 NAME_EXTS 单源生成） */
const NAME_EXT_RE = new RegExp(`^(.+)\\.(${NAME_EXTS.join('|')})$`, 'i');

/** 文件名基名清洗（issue 329 追加修订）：只保留中英文数字点横线下划线，其余剥掉 */
function cleanFileName(s: string): string {
  return String(s || '').replace(/[^0-9A-Za-z._\-\u4e00-\u9fff]/g, '');
}

/** contentType → 扩展名（image/jpeg→jpg、png/gif/webp 一直映射；未知回落 jpg） */
function extFromContentType(contentType?: string): string {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('avif')) return 'avif';
  if (ct.includes('svg')) return 'svg';
  return 'jpg';
}

/** 时间戳基名 `clip-<yyyymmdd>-<hhmmss>-<seq>`（同秒多图靠 seq 区分） */
function clipTimestampBase(seq: number): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
  const time = `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return `clip-${day}-${time}-${seq}`;
}

/**
 * 图片文件命名（issue 329 追加修订，单图保存与全量本地化两路统一）：
 * 1. URL pathname 末段 → decodeURIComponent → 清洗，必须带图片扩展名才算命中
 *    （query/锚点天然剥离——只取 pathname；大小写兼容，命中后扩展名归一小写）；
 * 2. 未命中 → `clip-<yyyymmdd>-<hhmmss>-<seq>` + contentType 映射扩展名（未知回落 .jpg）；
 * 3. 撞名由 writeUniqueImage 的 `_2` 序号兜底（永不覆盖契约不动）。
 */
export function imageNameFromUrl(url: string, seq: number, contentType?: string): string {
  try {
    const raw = String(new URL(url).pathname.split('/').pop() || '');
    let decoded = raw;
    try { decoded = decodeURIComponent(raw); } catch (e) { /* 百分号序列畸形 → 保留原段清洗 */ }
    const cleaned = cleanFileName(decoded).slice(0, 80);
    const m = cleaned.match(NAME_EXT_RE);
    if (m && m[1]) return `${m[1]}.${m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase()}`;
  } catch (e) { /* 非 URL 形态 → 走时间戳回落 */ }
  return `${clipTimestampBase(seq)}.${extFromContentType(contentType)}`;
}

/** 拉取结果：buf = 二进制；contentType = 响应头（时间戳命名时映射扩展名用） */
interface FetchedImage {
  buf: ArrayBuffer;
  contentType: string;
}

/** 带超时的 requestUrl 二进制 GET；非 2xx/超时/网络异常 → 抛错（调用方给 error 通知）。
 *  返回 buffer + contentType（命名管线消费） */
async function fetchImageWithMeta(url: string): Promise<FetchedImage> {
  const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS));
  const req = requestUrl({ url, method: 'GET', headers: { ...UA_HEADERS }, throw: false }).then((resp: any) => {
    if (!resp || resp.status < 200 || resp.status >= 300) return null;
    const headers = (resp && resp.headers) || {};
    const ct = headers['content-type'] || headers['Content-Type'] || '';
    return { buf: resp.arrayBuffer as ArrayBuffer, contentType: String(ct) };
  });
  req.catch(() => { /* race 选中 timer 时消化 rejection，防 unhandled */ });
  const hit = await Promise.race([req, timer]);
  if (!hit) throw new Error('图片下载失败或超时：' + url);
  return hit;
}

/** 带超时的 requestUrl 二进制 GET（只要 buffer 的旧口径，图版 data URL 管线消费） */
export async function fetchImageBinary(url: string): Promise<ArrayBuffer> {
  return (await fetchImageWithMeta(url)).buf;
}

/** ArrayBuffer → data URL（图版录入 data URL 管线预填用；分块 btoa 防栈溢出） */
export async function fetchImageDataUrl(src: string): Promise<string> {
  const url = normalizeImageSrc(src);
  if (url.startsWith('data:')) return url;
  const buf = await fetchImageBinary(url);
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return `data:image/${extOfImageUrl(url)};base64,${btoa(bin)}`;
}

/** 写唯一路径二进制（永不覆盖；目录不存在自动建——knowledge writeUniqueBinary 同款范式，本域自含） */
async function writeUniqueImage(dir: string, baseName: string, ext: string, bytes: ArrayBuffer): Promise<string> {
  const app = getApp();
  const folder = String(dir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  let path = `${folder}/${baseName}.${ext}`;
  for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${folder}/${baseName}_${i}.${ext}`;
  try {
    const exists = await app.vault.adapter.exists(folder);
    if (!exists) await app.vault.createFolder(folder);
  } catch (e) { /* 目录已存在等 */ }
  await app.vault.createBinary(path, bytes);
  return path;
}

/** 保存图片入参：src = 正文里的外链；articleKey = 条目稳定标识；savedNotePath = 已保存条目的剪藏 md 路径。
 *  文件名不再吃条目标题（issue 329 追加修订）：imageNameFromUrl 优先 URL 自带名，回落时间戳。 */
export interface SaveClipImageOpts {
  src: string;
  articleKey: string;
  savedNotePath?: string | null;
}

/** 保存结果：local = 本地路径；sidecar = 未保存路径下更新后的侧写（供调用方同步内存面，已保存路径为 null） */
export interface SaveClipImageResult {
  local: string;
  sidecar: ClipbookData | null;
}

/** 文件名拆 base/ext（最后一个点分；无点整体作 base、ext 兜底 jpg） */
function splitName(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.');
  return i > 0 ? { base: name.slice(0, i), ext: name.slice(i + 1) } : { base: name, ext: 'jpg' };
}

/**
 * 保存正文图片：拉二进制 → 落盘 → 已保存条目直写换链 / 未保存记侧写 savedImages。
 * 失败抛错（调用方 catch 后给 error 通知）。
 */
export async function saveClipImage(opts: SaveClipImageOpts): Promise<SaveClipImageResult> {
  const url = normalizeImageSrc(opts.src);
  if (!url || (!/^https?:\/\//.test(url) && !url.startsWith('data:'))) {
    throw new Error('不是可保存的图片地址');
  }
  if (url.startsWith('data:')) throw new Error('图片已是本地数据，无需保存');
  const { buf, contentType } = await fetchImageWithMeta(url);
  // 命名统一走 URL 自带名（无扩展名回落时间戳）；单图 seq 恒 1，撞名由 _2 序号兜底
  const name = splitName(imageNameFromUrl(url, 1, contentType));
  const local = await writeUniqueImage(clipbookImageDir(), name.base, name.ext, buf);
  if (opts.savedNotePath) {
    // 已保存条目：立即改写剪藏 md 该外链 → ![[本地路径]]（整篇拆 frontmatter 只动正文）
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(opts.savedNotePath) as TFile | null;
    if (file) {
      const content = await app.vault.read(file);
      const next = applyClipContentTransforms(content, [], [{ src: String(opts.src || '').trim(), local }]);
      if (next !== content) await app.vault.modify(file, next);
    }
    notice('图片已保存并替换进笔记', 'success');
    return { local, sidecar: null };
  }
  // 未保存条目：news.json 不可写 → 仅落盘 + 侧写记录（保存为剪藏时随物化换链）
  const sidecar = await addArticleImageSwap(opts.articleKey, { src: String(opts.src || '').trim(), local });
  notice('图片已保存，保存剪藏时一并换链', 'success');
  return { local, sidecar };
}

// ==================== 全量图片本地化（issue 329 追加修订：保存剪藏链路） ====================

/**
 * 从 markdown 正文提取全部外链图片 URL（`![...](http…)` 形态）：去重保序；
 * 只收 http(s) 与协议相对（`//`）地址——data:/相对路径已是本地或不完整，不进下载流。
 * 返回**正文原样 src**（不归一），保证与 applyBodyTransforms 的字面量精确匹配对得上。
 */
export function extractImageUrls(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(body || '')))) {
    // URL 段 = 括号内首段（剥 `![a](url "title")` 的 title 尾巴）
    const raw = String(m[1] || '').trim().split(/\s+/)[0];
    if (!raw || seen.has(raw)) continue;
    if (!/^https?:\/\//i.test(raw) && !raw.startsWith('//')) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/** 全量本地化入参：body = 剥壳正文；existing = 侧写 savedImages（此前单图保存过的映射，复用不重下）；
 *  onProgress = 每张开跑回调（done 从 1 计，进度通知原地更新用） */
export interface LocalizeImagesOpts {
  body: string;
  existing: ClipSavedImage[];
  onProgress?: (done: number, total: number) => void;
}

/** 全量本地化结果：swaps = src→local 全量映射（复用 + 新下，保正文序）；localized = 新下载数；failed = 失败数 */
export interface LocalizeImagesResult {
  swaps: ClipSavedImage[];
  localized: number;
  failed: number;
}

/**
 * 全量图片本地化：逐张下载 → 按 A 命名 → 落 clipbookImageDir → 组装 src→local 全量映射
 * （喂 anchor.applyBodyTransforms 的 imageSwaps 管线，与划词替换同一变换）。
 * 单张失败只计数不阻断（该图保留外链）；侧写已存的 src 直接复用不重下。
 */
export async function localizeArticleImages(opts: LocalizeImagesOpts): Promise<LocalizeImagesResult> {
  const urls = extractImageUrls(opts.body);
  const reuse = new Map((Array.isArray(opts.existing) ? opts.existing : [])
    .filter((s) => s && s.src && s.local)
    .map((s) => [s.src, s.local]));
  const swaps: ClipSavedImage[] = [];
  let localized = 0;
  let failed = 0;
  const dir = clipbookImageDir();
  for (let i = 0; i < urls.length; i++) {
    const src = urls[i];
    const seq = i + 1;
    opts.onProgress?.(seq, urls.length);
    // 侧写已存映射：直接复用（不重下、不重写盘）
    const hit = reuse.get(src);
    if (hit) {
      swaps.push({ src, local: hit });
      continue;
    }
    try {
      const url = normalizeImageSrc(src);
      const { buf, contentType } = await fetchImageWithMeta(url);
      const name = splitName(imageNameFromUrl(url, seq, contentType));
      const local = await writeUniqueImage(dir, name.base, name.ext, buf);
      swaps.push({ src, local });
      localized++;
    } catch (e) {
      // 单张失败：保留外链，不阻断整体
      failed++;
    }
  }
  return { swaps, localized, failed };
}

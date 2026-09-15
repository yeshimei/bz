/**
 * clipbook（issue 329）：保存正文图片到本地。
 *
 * requestUrl 拉二进制（桌面/移动同源，cinema douban-queue 先例 / ADR-0129）→ 写入
 * clipbookImageFolder 设置键目录（留空回落 `<articleDirectory>/assets`，回落范式同
 * knowledge resolveImageDir——只读参考，不在本域 import knowledge）→ 文件名取条目标题
 * 判重永不覆盖（writeUniqueBinary 范式）。
 *
 * 落盘两路（ADR-0144 保存图片）：
 * - 已保存条目（有 notePath）：立即把剪藏 md 该外链改写为 `![[本地路径]]`（直写换链）；
 * - 未保存条目：仅落盘 + 记侧写 savedImages（news.json 外部双写不可写；保存物化时统一换链）。
 */
import { requestUrl, TFile } from 'obsidian';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import type { ClipbookData } from './data';
import { addArticleImageSwap, applyClipContentTransforms } from './anchor';

/** 单请求超时 ms（requestUrl 不支持中止 → Promise.race，对齐 douban-queue 口径） */
const HTTP_TIMEOUT_MS = 15000;
/** 桌面/移动同源 UA（对齐 douban-queue 先例：部分图床对无 UA 请求拒绝） */
const UA_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };

/** 图片扩展名白名单（其余一律落 png；webp/avif Obsidian 原生可显） */
const EXT_WHITELIST = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']);

/**
 * 剪藏图片目录：设置键 clipbookImageFolder（留空回落 <articleDirectory>/assets）。
 * 回落口径与 loader.clipDir 的 articleDirectory 缺省一致。
 */
export function clipbookImageDir(): string {
  const s = tryGetSettings() as any;
  const configured = String((s && s.clipbookImageFolder) || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (configured) return configured;
  const dir = String((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
  return `${dir}/assets`;
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

/** 文件名基名清洗（条目标题 → 安全文件名；空标题兜底 image，对齐 save.ts 清洗口径） */
export function imageBaseName(title: string): string {
  const t = String(title || '').replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return t || 'image';
}

/** 带超时的 requestUrl 二进制 GET；非 2xx/超时/网络异常 → 抛错（调用方给 error 通知） */
export async function fetchImageBinary(url: string): Promise<ArrayBuffer> {
  const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS));
  const req = requestUrl({ url, method: 'GET', headers: { ...UA_HEADERS }, throw: false }).then((resp: any) => {
    return resp && resp.status >= 200 && resp.status < 300 ? (resp.arrayBuffer as ArrayBuffer) : null;
  });
  req.catch(() => { /* race 选中 timer 时消化 rejection，防 unhandled */ });
  const buf = await Promise.race([req, timer]);
  if (!buf) throw new Error('图片下载失败或超时：' + url);
  return buf;
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

/** 保存图片入参：src = 正文里的外链；title = 条目标题（文件名）；savedNotePath = 已保存条目的剪藏 md 路径 */
export interface SaveClipImageOpts {
  src: string;
  title: string;
  articleKey: string;
  savedNotePath?: string | null;
}

/** 保存结果：local = 本地路径；sidecar = 未保存路径下更新后的侧写（供调用方同步内存面，已保存路径为 null） */
export interface SaveClipImageResult {
  local: string;
  sidecar: ClipbookData | null;
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
  const bytes = await fetchImageBinary(url);
  const local = await writeUniqueImage(clipbookImageDir(), imageBaseName(opts.title), extOfImageUrl(url), bytes);
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

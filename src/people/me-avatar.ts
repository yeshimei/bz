/**
 * 「我」的头像单源（issue 529）。
 *
 * 三级取值，一处判定（面板聊天页 / 录音轮次预览 / 设置行预览三处共用）：
 *   1. **自定义**：设置键 `peopleMyAvatar` 有值——库内相对路径直接用（`avatarUri` 走
 *      vault `getResourcePath`），库外绝对路径（老键值 / 用户手填）读字节转 data URL；
 *   2. **微信里扒出来的本人头像**：工具侧 sync 轮导出到 `<数据根>/.bz-face/me/avatar.<ext>`
 *      （放 `.bz-face` 下 = 不会被数据源扫描误当成一位联系人）；同样读字节转 data URL；
 *   3. 都没有 → 空串（渲染层落「首字印」）。
 *
 * 上传落的盘在 vault 内 `CONFIG/FACES/我/avatar.<ext>`（467 后退役的明文头像目录，仍在）：
 * 键值存**库内相对路径**——换机 / 同步 vault 也带得走，且两端都能加载。
 */
import { getApp } from '../core/app';
import { readAvatarInput } from './datasource';
import type { AvatarInput } from './safe-store';

/** 头像扩展名探测序（与 datasource 的 AVA_EXTS 同表——本人头像与联系人头像同一套格式） */
const AVA_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/** 上传的「我」头像落位（vault 内相对目录） */
export const MY_AVATAR_DIR = 'CONFIG/FACES/我';

/** 工具侧导出的本人微信头像（数据根下；`.bz-face` 是工具的基础设施目录） */
const SELF_AVATAR_REL = '.bz-face/me/avatar';

function getFs(): any {
  const w = typeof window === 'undefined' ? null : (window as any);
  if (!w || !w.require) return null;
  try {
    return w.require('fs');
  } catch {
    return null;
  }
}

/** 库外图字节 → data URL 缓存（同路径换了图 / 先写错路径再补文件，面板每次打开清一次） */
const localImgCache = new Map<string, string>();

/** 面板开面板时清一次（与 `ui.localImgCache` 同口径；改用本模块后旧的已并入） */
export function clearMyAvatarCache(): void {
  localImgCache.clear();
}

/** 头像入参 → data URL（空入参 = 空串） */
export function avatarDataUrl(a: AvatarInput | null): string {
  return a ? `data:image/${a.ext};base64,${a.base64}` : '';
}

/**
 * 库外图 → data URL（留影缩略图 / 大图与「我」的头像同一口径）：app://local 不解库外文件，
 * 读字节最稳（456 头像入库 / 467 头像进保库两轮的教训）。按路径缓存，面板每次打开清一次
 * （同路径换了图、或先写错路径再补文件，不用重载插件）。
 */
export function localImgOf(absolutePath: string): string {
  const hit = localImgCache.get(absolutePath);
  if (hit !== undefined) return hit;
  const url = avatarDataUrl(readAvatarInput(absolutePath));
  localImgCache.set(absolutePath, url);
  return url;
}

/** 微信数据里的本人头像文件（工具侧导出；没导过 / 数据根没配 = null） */
export function wechatSelfAvatarPath(dataRoot: string): string | null {
  const fs = getFs();
  const root = String(dataRoot ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!fs || !root) return null;
  for (const ext of AVA_EXTS) {
    const p = `${root}/${SELF_AVATAR_REL}.${ext}`;
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* 探测失败按没有 */ }
  }
  return null;
}

/** 头像来源（设置行文案用）：自定义 / 微信导出 / 都没有 */
export type MyAvatarSource = 'custom' | 'wechat' | 'none';

export function myAvatarSource(setting: string | undefined, dataRoot: string): MyAvatarSource {
  if (String(setting ?? '').trim()) return 'custom';
  return wechatSelfAvatarPath(dataRoot) ? 'wechat' : 'none';
}

/**
 * 渲染层直接吃的「我」的头像值：data URL（库外文件读字节）/ 库内相对路径原样 / 空串。
 * 每次调用最多一次盘探测（有自定义键时连探测都省），聊天逐条重画不重读盘。
 */
export function resolveMyAvatar(setting: string | undefined, dataRoot: string): string {
  const p = String(setting ?? '').trim();
  if (p) return /^[A-Za-z]:/.test(p) || p.startsWith('\\\\') ? localImgOf(p) : p;
  const wechat = wechatSelfAvatarPath(dataRoot);
  return wechat ? localImgOf(wechat) : '';
}

/** 逐级建目录（Obsidian `adapter.mkdir` 未文档化递归建父级；已存在 / 不支持都当无事） */
async function ensureDir(adapter: { mkdir?: (p: string) => Promise<void> }, relDir: string): Promise<void> {
  if (!adapter.mkdir) return;
  let cur = '';
  for (const part of relDir.split('/')) {
    cur = cur ? `${cur}/${part}` : part;
    try {
      await adapter.mkdir(cur);
    } catch { /* 已存在 / 不支持 → 继续下一级 */ }
  }
}

/** base64 → 字节（写 vault 的 writeBinary 吃 ArrayBuffer） */
function bytesOf(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 用户选的图片 → 复制进 vault（返回库内相对路径；读不动 / 写不进 = null）。
 * 同目录里换过扩展名的旧图先清掉：探测序会先撞上旧的那张，不清就会出现「换了图却没生效」。
 */
export async function importMyAvatarFromFile(absPath: string): Promise<string | null> {
  const src = readAvatarInput(absPath);
  if (!src) return null;
  const vault = (getApp() as unknown as {
    vault?: {
      adapter?: {
        mkdir?: (p: string) => Promise<void>;
        writeBinary?: (p: string, d: ArrayBuffer) => Promise<void>;
        remove?: (p: string) => Promise<void>;
        exists?: (p: string) => Promise<boolean>;
      };
    };
  })?.vault;
  const adapter = vault?.adapter;
  if (!adapter?.writeBinary) return null;
  await ensureDir(adapter, MY_AVATAR_DIR);
  const rel = `${MY_AVATAR_DIR}/avatar.${src.ext}`;
  for (const ext of AVA_EXTS) {
    if (ext === src.ext) continue;
    const stale = `${MY_AVATAR_DIR}/avatar.${ext}`;
    try {
      if (adapter.exists ? await adapter.exists(stale) : true) await adapter.remove?.(stale);
    } catch { /* 清旧图失败不影响新图 */ }
  }
  const bytes = bytesOf(src.base64);
  await adapter.writeBinary(rel, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return rel;
}

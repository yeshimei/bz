/**
 * Obsidian「默认新附件位置」→ 插件的图片/海报目录（core 单源）
 *
 * 为什么要有这一层：插件自己的图片类设置（剪藏图片、影院海报、游戏封面、知识盒配图、
 * 书库封面）本质都在回答同一个问题——「图往哪存」。用户在 Obsidian 里早就答过一遍
 * （设置 → 文件与链接 → 默认新附件位置），再让他在插件里填第四第五遍是多余的。
 *
 * 读的是什么：`app.vault.getConfig('attachmentFolderPath')`（同步、无 Promise，不污染
 * 各域现有的同步解析函数）。它的取值有四种形态，只有第三、四种能直接用：
 *   1) 空串            → 库根。插件不往根目录堆图，视为未设；
 *   2) '/'             → 同上；
 *   3) './'            → 与当前笔记同目录。插件写的是固定位置（海报、剪藏配图），
 *                        没有「当前笔记」这个上下文，无法映射，视为未设；
 *   4) './子目录'       → 当前笔记旁的子目录，同上，视为未设；
 *   5) '附件' / '归档/附件' → 固定文件夹，直接采用（这才是能跟随的那种设置）。
 *
 * 拿不到（老版本宿主没有 getConfig、或它抛错）一律返回 null，由调用方回落域内缺省。
 *
 * 为什么不走 `vault.getAvailablePathForAttachment()`：那是 async（要 sourcePath 才能解
 * './' 与 './子'），会把六个域里一堆同步的目录解析函数全部染成 async；而能跟随的形态
 * 里根本不需要它——固定文件夹直接读配置就是最终答案。
 */
import { getApp } from './app';

/** 目录来源（设置页/空态文案要如实说图存哪了） */
export type AssetDirSource = 'setting' | 'obsidian' | 'fallback';

export interface AssetDir {
  /** vault 相对目录（'/' 分隔、无首尾斜杠）；可能为空串（调用方兜底） */
  dir: string;
  source: AssetDirSource;
}

/** 去首尾斜杠 + 反斜杠归一（多处目录解析共用） */
export function cleanDir(v: unknown): string {
  return String(v ?? '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * Obsidian 的附件目录（仅「固定文件夹」形态可用）。不可用返回 null。
 * 结果不做缓存：用户随时会在 Obsidian 设置里改，改完回到插件就该生效。
 */
export function obsidianAttachmentDir(): string | null {
  let raw = '';
  try {
    const vault: any = getApp().vault;
    raw = String(vault?.getConfig?.('attachmentFolderPath') ?? '');
  } catch (e) {
    return null; // 宿主不支持 / 取值抛错：按「没设」处理，调用方回落域内缺省
  }
  const v = raw.trim().replace(/\\/g, '/');
  if (!v || v === '/') return null; // 库根
  if (v.startsWith('./')) return null; // 跟随当前笔记（同目录 / 子目录）：插件没有这个上下文
  const dir = cleanDir(v);
  return dir || null;
}

/**
 * 目录解析单一入口：显式设置 → Obsidian 附件目录 → 域内缺省。
 * @param configured 设置键现值（空 = 没设过）
 * @param fallback 域内缺省（如 `<剪藏文件夹>/assets`）
 */
export function resolveAssetDir(configured: unknown, fallback: string): AssetDir {
  const c = cleanDir(configured);
  if (c) return { dir: c, source: 'setting' };
  const o = obsidianAttachmentDir();
  if (o) return { dir: o, source: 'obsidian' };
  return { dir: cleanDir(fallback), source: 'fallback' };
}

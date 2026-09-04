/**
 * 数据体检（checkup 域）：扫描目标清单 + 只读读取工具。
 *
 * 各域数据文件路径在此收敛（读各域 data 层同款解析逻辑的常量/函数，不改域代码）：
 * 全部经 core/storage 的 storageDir()/storageFile() 解析（跟随 storagePath 设置），
 * weave-data.json 走书架墙的 Weave 插件 dataPath 解析。
 *
 * 只读纪律：体检绝不走 jsonFileStore.read()——那会触发「损坏留档 + 重建」写路径，
 * 把待报告的坏文件原地重建、毁掉现场。这里一律 adapter 直读原文。
 */
import type { App } from 'obsidian';
import { storageDir, storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import { getStoragePath } from '../favorites/config';
import { resolveWeaveDataPath, WEAVE_DATA_FILE } from '../bookshelf/data';

/** 冲突留档目录（与 core/storage D1 原语 3 的 CORRUPT_BACKUP_DIR 同名；勿改，合并时对齐） */
export const CORRUPT_DIR = 'CONFIG/.CORRUPT';

/** 单个扫描目标：文件路径 + 人话标签 */
export interface JsonScanTarget {
  file: string;
  label: string;
}

/** 全部域数据 json 清单（与各域 data 层路径解析同款；新增域数据文件时在此补一行） */
export function jsonScanTargets(app: App): JsonScanTarget[] {
  const s = tryGetSettings() as any;
  return [
    { file: storageFile('memo.json', storageDir()), label: '备忘录 / 待办' },
    // 收藏本：目录可配置（storagePath 优先，旧 favoritesStoragePath 兜底）——favorites/app.ts 同款
    { file: getStoragePath(s.storagePath || s.favoritesStoragePath), label: '收藏本' },
    { file: storageFile('belongings.json'), label: '归物本' },
    { file: storageFile('clipbook.json'), label: '剪藏本侧写' },
    { file: storageFile('news.json'), label: '剪藏本（未读流）' },
    { file: storageFile('launcher.json'), label: '入口页' },
    { file: storageFile('pomodoro.json'), label: '番茄钟' },
    { file: storageFile('review.json'), label: '复习计划' },
    { file: storageFile('review-fit.json'), label: '复习拟合参数' },
    { file: storageFile('home.json'), label: '内容首页' },
    { file: storageFile('smartcat.json'), label: '小橘' },
    { file: storageFile('literature.json'), label: '文献盒' },
    { file: storageFile('secondbrain.json'), label: '第二大脑' },
    { file: storageFile('quiz.json'), label: '复习做题' },
    { file: `${resolveWeaveDataPath(app)}/${WEAVE_DATA_FILE}`, label: 'EPUB 阅读数据（书架墙）' },
  ];
}

/** 文件是否存在（不读内容） */
export function fileExists(app: App, path: string): boolean {
  return !!app.vault.getAbstractFileByPath(path);
}

/**
 * 只读直读文件原文；不存在返回 null（区别于读到的空串）。
 * 走 adapter.read——不经 jsonFileStore，无任何写副作用。
 */
export async function readRawFile(app: App, path: string): Promise<string | null> {
  try {
    return await app.vault.adapter.read(path);
  } catch {
    return null;
  }
}

/** 解析后的 json 读结果：ok=解析成功 / corrupt=解析失败（raw 保留现场） */
export type RawJson =
  | { ok: true; data: unknown }
  | { ok: false; raw: string };

/** 只读直读 + 尝试解析（不存在的文件返回 null） */
export async function readRawJson(app: App, path: string): Promise<RawJson | null> {
  const raw = await readRawFile(app, path);
  if (raw === null) return null;
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, raw };
  }
}

/** 目录下直接子文件名（目录不存在返回空数组） */
export function listDirNames(app: App, dir: string): string[] {
  const f = app.vault.getAbstractFileByPath(dir) as { children?: Array<{ name?: string }> } | null;
  if (!f || !Array.isArray(f.children)) return [];
  return f.children.map((c) => (c && c.name) || '').filter(Boolean);
}

/** 某数据文件在留档目录里的全部备份文件名（无则空数组） */
export function corruptBackupsFor(app: App, filePath: string): string[] {
  const base = filePath.includes('/') ? filePath.slice(filePath.lastIndexOf('/') + 1) : filePath;
  return listDirNames(app, CORRUPT_DIR)
    .filter((n) => n.startsWith(base + '.') && n.endsWith('.bak'))
    .sort();
}

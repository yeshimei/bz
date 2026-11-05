/**
 * 动态目录分类：按插件设置里的各域目录配置，把 vault 内 .md 文件路径归类到语义域。
 *
 * - 每次调用实时读 settings（tryGetSettings）：用户运行时改目录，分类即时跟随，无缓存失效问题；
 * - 目录边界语义对齐 src/review/watch.ts 的 isUnderFolder：path === dir || path.startsWith(dir + '/')，
 *   防「我的/日记.md」「我的/日记本/a.md」这类前缀相近路径误判；
 * - 反斜杠统一归一化为正斜杠后再匹配（Windows 手输路径容错）；
 * - settings 缺键 / 值为空（2026-10-31 起目录缺省留空）= 该域未配置，不归类（不回退任何字面量）；
 *   只有设置里真配了目录的域才参与匹配——与各域「未配置 → 引导态」同一口径；
 * - 本文件属 core 层：按依赖方向（ADR-0002 core ← 域模块）不得反向 import src/diary、src/smartcat 取常量，
 *   故默认值与硬编码目录均为本地副本 + 出处注释，改动上游时须同步此处。
 */
import { tryGetSettings } from './settings-provider';
import { obsidianDailyNotesFolder } from './daily-notes';
import { diaryDayDateFromOwnPath, diaryDayDateFromPath, diaryDayFormats, diaryDateFromEntryPath } from './diary-format';
import { cleanDir } from './attachment-dir';

export type FileDomainKind = 'diary' | 'flash' | 'cinema' | 'clipping' | 'poem' | 'letter' | 'knowledge';

/** 目录归一：走 core/attachment-dir 的 cleanDir 单源（trim + 反斜杠归一 + 去首尾斜杠） */
function normalizeDir(dir: string): string {
  return cleanDir(dir);
}

/** 目录边界判定（对齐 src/review/watch.ts isUnderFolder：path 恰为该目录或位于其下）；空目录不匹配 */
function isUnderDir(dir: string, p: string): boolean {
  const d = normalizeDir(dir);
  if (!d) return false;
  return p === d || p.startsWith(d + '/');
}

/** 设置项目录匹配：值缺省/空白时回退 fallback 默认目录再判定 */
function matchSettingDir(value: unknown, p: string, fallback: string): boolean {
  const raw = typeof value === 'string' && value.trim() ? value : fallback;
  return isUnderDir(raw, p);
}

/** 日记实际生效目录：设置值 → Obsidian 日记的新日记存放位置 → 空（未配置） */
function diaryDirectory(): string {
  const raw = tryGetSettings().diaryDirectory;
  const v = typeof raw === 'string' ? normalizeDir(raw) : '';
  return v || obsidianDailyNotesFolder();
}

/**
 * 按 settings 目录配置识别 md 文件所属域；未命中返回 null（兜底通道用）。
 * 只认 .md（对齐 src/smartcat/context-source.ts classifyPath）；
 * 判定顺序沿用其既有优先级 diary → flash → clipping → movie → poem → letter → literature，同路径命中多域取先者。
 */
export function classifyFilePath(path: string | null | undefined): FileDomainKind | null {
  if (!path) return null;
  const p = String(path).replace(/\\/g, '/');
  if (!p.endsWith('.md')) return null;
  const s = tryGetSettings();
  // 日记：settings.diaryDirectory（「📂 日记目录」）；留空时跟随 Obsidian 日记的新日记存放位置。
  // 两边都没有 = 未配置，不归类（不回退字面量——否则设置里空着，旧目录里的笔记仍被认成日记）。
  if (isUnderDir(diaryDirectory(), p)) return 'diary';
  // 闪念（卡片盒）：settings 无对应键，沿用 src/smartcat/context-source.ts FLASH_DIR 硬编码 '卡片盒'
  if (isUnderDir('卡片盒', p)) return 'flash';
  // 剪藏：settings.articleDirectory（「📂 剪藏目录」）；未配置不归类（同上，不回退字面量）
  if (matchSettingDir(s.articleDirectory, p, '')) return 'clipping';
  // 影院（cinema 域，ADR-0087 起接管影视目录）：只看显式配置，未配置不归类
  if (matchSettingDir(s.cinemaFolderPath, p, '')) return 'cinema';
  // 旧 'movie' 分类随 diary 旧域退役（ADR-0115）：其目录唯一真理已并入 cinemaFolderPath（上一分支），
  // movie:file-* 语义事件无消费者，不再派发
  // 现代诗：settings 无对应键，沿用 src/smartcat/context-source.ts 硬编码 '我的/现代诗'
  if (isUnderDir('我的/现代诗', p)) return 'poem';
  // 信：settings.letterDirectory（「✉️ 信目录」）；可选项目，未配置不归类
  if (matchSettingDir(s.letterDirectory, p, '')) return 'letter';
  // 文献盒：settings.knowledgeDirectory（「文献目录」）；未配置不归类（ADR-0072 迁出为新域）
  if (matchSettingDir(s.knowledgeDirectory, p, '')) return 'knowledge';
  return null;
}

/** 从日记路径取日期：条目文件 basename（ADR-0130）或 day 日期文件（按 Obsidian 日期格式）；否则 null */
export function diaryDateFromPath(path: string): string | null {
  const p = String(path ?? '').replace(/\\/g, '/');
  const entry = diaryDateFromEntryPath(p);
  if (entry) return entry;
  const byDir = diaryDayDateFromPath(p, diaryDirectory(), diaryDayFormats());
  if (byDir) return byDir;
  // 目录未知/未配置（或路径不在当前日记目录下）：按路径自身目录解析——与旧 basename 口径一致，
  // 不依赖设置也能认出 `2026-08-23.md` 这类日期文件
  return diaryDayDateFromOwnPath(p, diaryDayFormats());
}

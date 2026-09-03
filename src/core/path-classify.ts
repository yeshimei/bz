/**
 * 动态目录分类：按插件设置里的各域目录配置，把 vault 内 .md 文件路径归类到语义域。
 *
 * - 每次调用实时读 settings（tryGetSettings）：用户运行时改目录，分类即时跟随，无缓存失效问题；
 * - 目录边界语义对齐 src/review/watch.ts 的 isUnderFolder：path === dir || path.startsWith(dir + '/')，
 *   防「我的/日记.md」「我的/日记本/a.md」这类前缀相近路径误判；
 * - 反斜杠统一归一化为正斜杠后再匹配（Windows 手输路径容错）；
 * - settings 缺键（提供者未注入 / 测试注入部分对象）时回退各域现行默认值——默认值从现有代码抄入并逐条注明出处；
 * - 本文件属 core 层：按依赖方向（ADR-0002 core ← 域模块）不得反向 import src/diary、src/smartcat 取常量，
 *   故默认值与硬编码目录均为本地副本 + 出处注释，改动上游时须同步此处。
 */
import { tryGetSettings } from './settings-provider';

export type FileDomainKind = 'diary' | 'flash' | 'cinema' | 'movie' | 'clipping' | 'poem' | 'letter' | 'literature';

/** 目录归一：trim + 反斜杠转正斜杠 + 去尾斜杠 */
function normalizeDir(dir: string): string {
  return (dir || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
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
  // 日记：settings.diaryDirectory（「📂 日记目录」）；缺键回退 '我的/日记'
  // （出处：src/settings.ts DEFAULT_SETTINGS，同 src/diary/config.ts DIARY_DIRECTORY 初值）
  if (matchSettingDir(s.diaryDirectory, p, '我的/日记')) return 'diary';
  // 闪念（卡片盒）：settings 无对应键，沿用 src/smartcat/context-source.ts FLASH_DIR 硬编码 '卡片盒'
  if (isUnderDir('卡片盒', p)) return 'flash';
  // 剪藏：settings.articleDirectory（「📂 剪藏目录」）；缺键回退 '归档/网页剪藏'（出处：DEFAULT_SETTINGS）
  if (matchSettingDir(s.articleDirectory, p, '归档/网页剪藏')) return 'clipping';
  // 影院（cinema 域，ADR-0087 起接管影视目录）：显式配置 cinemaFolderPath 命中即归类
  // （缺省回落 '我的/影视'——旧 movieFolderPath 键已退役；与 cinema/state DEFAULT_FOLDER 同源副本）
  if (matchSettingDir(s.cinemaFolderPath, p, '我的/影视')) return 'cinema';
  // 影视（movie 语义保留，仅服务 diary 侧 movieDirectory 键——日记本「影视」归类）：
  // movieDirectory 默认 '我的/影视'（src/settings.ts DEFAULT_SETTINGS 与 src/diary/config.ts MOVIE_DIRECTORY 一致）
  if (matchSettingDir(s.movieDirectory, p, '我的/影视')) return 'movie';
  // 现代诗：settings 无对应键，沿用 src/smartcat/context-source.ts 硬编码 '我的/现代诗'
  if (isUnderDir('我的/现代诗', p)) return 'poem';
  // 信：settings.letterDirectory（「✉️ 信目录」）；缺键回退 '我的/信'
  // （出处：src/settings.ts DEFAULT_SETTINGS，同 src/diary/config.ts LETTER_DIRECTORY 初值）
  if (matchSettingDir(s.letterDirectory, p, '我的/信')) return 'letter';
  // 文献盒：settings.literatureDirectory（「文献目录」）；缺键回退 '文献盒'（ADR-0072 迁出为新域）
  if (matchSettingDir(s.literatureDirectory, p, '文献盒')) return 'literature';
  return null;
}

/** 从日记路径取日期：basename 形如 YYYY-MM-DD.md → 'YYYY-MM-DD'；否则 null（口径对齐 src/smartcat/index.ts diaryFileDate） */
export function diaryDateFromPath(path: string): string | null {
  const base = (path || '').replace(/\\/g, '/').split('/').pop() || '';
  const m = base.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  return m ? m[1] : null;
}

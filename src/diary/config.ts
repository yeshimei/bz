/**
 * 日记本（diary）域配置：目录常量、存储格式、日记分类表（emoji 编码）。
 * 本域 = 原回忆墙升格正名（ADR-0115，issue 256）：唯一日记 UI + 写链路宿主。
 *
 * - 目录常量：DIARY_DIRECTORY（日记）/LETTER_DIRECTORY（信）为可变常量（设置应用时更新）；
 *   目录唯一真理跨域化：影视读影院域 resolveCinemaFolderPath、书库读书架墙域 resolveFolderPath
 *   （movieDirectory()/bookDirectory() 实时解析，D6 修复——改影院/书架目录无需重启）。
 * - 存储格式 DIARY_ENTRY_FORMAT：entry = 一篇一个文件；day = 一天一个文件（Obsidian 日记原生）。
 * - 日记分类（2026-11 起）：**全部平级**（不再有主标签/二级标签），用户配置落 settings.diaryTypes。
 *   代码只留两份常量：`DEFAULT_DIARY_TYPES`（唯一默认值：新装与老库升级都只写这 3 个示例）与
 *   `LEGACY_DIARY_TYPES`（旧版 28 类拍平表，**只**用于读旧日记：旧「一天一文件」的 emoji 头行
 *   靠它反查标签；不再是任何默认值，也不参与迁移落盘）。
 * - emoji ↔ 分类名双向映射、写弹窗分类序 getSortedTagsForAddDialog 都从当前分类表派生。
 *
 * 兼容说明：`getSubTagsOfPrimary`/`isSubTag`/`getParentPrimaryTag` 保留导出但恒空/恒否——
 * 层级概念已退役，调用方若还引用不会炸，只是永远拿不到子项。
 */
import type { SubTagConfig, TagConfig } from './types';
import { tryGetSettings } from '../core/settings-provider';
import { obsidianDailyNotesFolder } from '../core/daily-notes';
import { resolveCinemaFolderPath } from '../cinema/state';
import { resolveFolderPath as resolveBookshelfFolderPath } from '../bookshelf/data';

// ===== 可变常量（设置应用时更新） =====
export let DIARY_DIRECTORY = '我的/日记';
export let LETTER_DIRECTORY = '我的/信';

/** 日记存储格式：entry = 一篇一个文件；day = 一天一个文件（YYYY-MM-DD.md） */
export type DiaryEntryFormat = 'entry' | 'day';

/** 日记分类（用户可编辑）：一个名字 + 一个 emoji，全部平级 */
export interface DiaryTypeConfig {
  tag: string;
  emoji: string;
}

/** 分类没配 emoji / 旧 type 不在当前分类表时的兜底图标（读旧日记不能出现空白签） */
export const DEFAULT_DIARY_EMOJI = '📖';

/** 默认只给 3 个示例（一个新装用户需要的全部；其余由用户自己加） */
export const DEFAULT_DIARY_TYPES: DiaryTypeConfig[] = [
  { tag: '日记', emoji: DEFAULT_DIARY_EMOJI },
  { tag: '随笔', emoji: '✍️' },
  { tag: '生活', emoji: '🏠' },
];

/**
 * 旧版内置 28 类（ADR-0115 时代写死在代码里的那份）——**已拍平**：
 * 旧「旅游」下的四川/大理、旧「收藏」下的 13 个子标签都成为独立分类。
 * **只服务读旧日记**：旧「一天一文件」的 `# emoji HH:mm` 头行没有标签名，只能靠这张表反查
 * （见 `./legacy` 的 LEGACY_EMOJI_TO_TAG）。2026-11 收尾起老库升级**不再**把它写进设置——
 * 默认分类只有 `DEFAULT_DIARY_TYPES` 的 3 个；旧日记里的 type 由 `getTagEmoji` 的兜底
 * 显示，不依赖它仍在分类表里。
 */
export const LEGACY_DIARY_TYPES: DiaryTypeConfig[] = [
  { tag: '日记', emoji: '📖' },
  { tag: '加密', emoji: '🔐' },
  { tag: '念念碎', emoji: '😶' },
  { tag: '对谈', emoji: '🤝' },
  { tag: '随笔', emoji: '✍️' },
  { tag: '梦', emoji: '🌙' },
  { tag: '诗', emoji: '🌟' },
  { tag: '书', emoji: '📕' },
  { tag: '信', emoji: '✉️' },
  { tag: '摘抄', emoji: '📌' },
  { tag: '摄影', emoji: '📸' },
  { tag: '骑行', emoji: '🚴' },
  { tag: '代码', emoji: '⚙️' },
  { tag: '做饭', emoji: '🥘' },
  { tag: '游戏', emoji: '🎮' },
  { tag: '音乐', emoji: '🎧' },
  { tag: '电影', emoji: '📽' },
  { tag: '电视剧', emoji: '📺' },
  { tag: '动漫', emoji: '🎨' },
  { tag: '纪录片', emoji: '🎞' },
  { tag: '猫', emoji: '🐱' },
  { tag: '狗', emoji: '🐶' },
  { tag: '仓鼠', emoji: '🐹' },
  { tag: '熊猫', emoji: '🐼' },
  { tag: '博物馆', emoji: '🏛️' },
  { tag: '美食', emoji: '🍔' },
  { tag: '旅游', emoji: '✈️' },
  // 旧「旅游」的二级标签，拍平成独立分类
  { tag: '四川', emoji: '🀄' },
  { tag: '大理', emoji: '🛶' },
  { tag: '收藏', emoji: '⭐' },
  // 旧「收藏」的二级标签，拍平成独立分类
  { tag: '咪咪', emoji: '🐈' },
  { tag: '广告', emoji: '📢' },
  { tag: '神评', emoji: '🤣' },
  { tag: '冷笑话', emoji: '😅' },
  { tag: '抽象', emoji: '🌀' },
  { tag: 'AI', emoji: '🤖' },
  { tag: '愚人节', emoji: '🤪' },
  { tag: '舞蹈', emoji: '🕺' },
  { tag: '达人秀', emoji: '🤹' },
  { tag: '艺术', emoji: '🧑‍🎨' },
  { tag: '摄影集', emoji: '📷' },
  { tag: '植物', emoji: '🌳' },
  { tag: '创意', emoji: '🧩' },
];

/** 当前生效的存储格式（applyDirectories 更新） */
export let DIARY_ENTRY_FORMAT: DiaryEntryFormat = 'entry';

/** 当前生效的日记分类（applyDirectories 更新；外部只读时用 currentDiaryTypes() 拿副本） */
let DIARY_TYPES: DiaryTypeConfig[] = clone(DEFAULT_DIARY_TYPES);

/** 当前分类表转成 PRIMARY_TAGS_CONFIG 形状（筛选栏/写弹窗/映射共用） */
let PRIMARY_TAGS_CONFIG: Record<string, TagConfig> = toPrimaryConfig(DIARY_TYPES);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** DiaryTypeConfig[] → PRIMARY_TAGS_CONFIG 形状（保持顺序；层级已退役，value 只有 emoji） */
function toPrimaryConfig(types: DiaryTypeConfig[]): Record<string, TagConfig> {
  const out: Record<string, TagConfig> = {};
  for (const t of types) out[t.tag] = { emoji: t.emoji };
  return out;
}

/**
 * 解析设置里的日记分类（字符串 JSON 或数组）。任何损坏/空值一律回退默认 3 个示例。
 * 容错口径：非对象项跳过、空名跳过、重名保序去重、emoji 缺失回退 📖。
 * **兼容旧配置**：项里若还带 `subTags`（层级退役前的 JSON），把子标签拍平成独立分类追加，
 * 保证用户升级后不丢任何一个分类名。
 */
export function parseDiaryTypes(raw: unknown): DiaryTypeConfig[] {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return clone(DEFAULT_DIARY_TYPES);
    try {
      value = JSON.parse(s);
    } catch (e) {
      return clone(DEFAULT_DIARY_TYPES);
    }
  }
  if (!Array.isArray(value)) return clone(DEFAULT_DIARY_TYPES);

  const out: DiaryTypeConfig[] = [];
  const seen = new Set<string>();
  const push = (tagRaw: unknown, emojiRaw: unknown): void => {
    const tag = String(tagRaw ?? '').trim();
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    out.push({
      tag,
      emoji: typeof emojiRaw === 'string' && emojiRaw.trim() ? emojiRaw.trim() : DEFAULT_DIARY_EMOJI,
    });
  };

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    push(rec.tag, rec.emoji);
    // 旧层级配置拍平：子标签当成独立分类（放在其主标签后面）
    if (Array.isArray(rec.subTags)) {
      for (const s of rec.subTags) {
        if (!s || typeof s !== 'object') continue;
        const srec = s as Record<string, unknown>;
        push(srec.tag, srec.emoji);
      }
    }
  }
  return out.length > 0 ? out : clone(DEFAULT_DIARY_TYPES);
}

/** 应用一份分类表（设置变更/启动时调用），同时重建 emoji 映射 */
export function applyDiaryTypes(raw: unknown): void {
  DIARY_TYPES = parseDiaryTypes(raw);
  PRIMARY_TAGS_CONFIG = toPrimaryConfig(DIARY_TYPES);
  buildTagMaps();
}

/** 从当前设置刷新分类表（设置页保存后调用） */
export function refreshDiaryTypesFromSettings(): void {
  applyDiaryTypes(tryGetSettings().diaryTypes ?? '');
}

/** 当前分类表副本（设置页编辑器读取；外部不得直接改内部数组） */
export function currentDiaryTypes(): DiaryTypeConfig[] {
  return clone(DIARY_TYPES);
}

/** 序列化分类表（写入 settings.diaryTypes） */
export function serializedDiaryTypes(types?: DiaryTypeConfig[]): string {
  return JSON.stringify(types ?? DIARY_TYPES);
}

/**
 * 老库一次性迁移（main.ts onload 调用）：data.json 里没有 diaryTypes 时写入**默认 3 个示例**。
 * 返回 true = 发生了迁移（调用方调度落盘）。`loaded` 为 null（真新装）不动。
 *
 * 2026-11 收尾（接 b8fbb1f1）用户实测反馈「一升级就冒出二十多个分类」：迁移原先写的是
 * `LEGACY_DIARY_TYPES`（旧版 28 类拍平），老库没有 diaryTypes 键就整串灌进设置页。现在改回
 * 3 个示例——旧日记里仍留着的 type（四川/咪咪…）由 `getTagEmoji` 兜底显示、列表编辑器不会
 * 凭空多出条目；`LEGACY_DIARY_TYPES` 只留在读旧「一天一文件」的 emoji 反查路径上。
 */
export function migrateDiaryTypes(loaded: unknown): boolean {
  if (!loaded || typeof loaded !== 'object') return false;
  const rec = loaded as Record<string, unknown>;
  if (typeof rec.diaryTypes === 'string' && rec.diaryTypes.trim()) return false;
  // 只认「确实用过日记」的老库：data.json 是全量落盘，老库必然带这些键之一；
  // 不含日记键的 data.json（测试夹具/别的插件残留）不写迁移，避免每次启动多一次落盘。
  const hasDiaryTrace =
    'diaryDirectory' in rec ||
    'letterDirectory' in rec ||
    'diaryEntryFormat' in rec ||
    'diaryPageSize' in rec ||
    'diarySkin' in rec ||
    'useFileDateTime' in rec;
  if (!hasDiaryTrace) return false;
  rec.diaryTypes = serializedDiaryTypes(DEFAULT_DIARY_TYPES);
  return true;
}

/** 当前是否一天一文件格式 */
export function isDayFormat(): boolean {
  return DIARY_ENTRY_FORMAT === 'day';
}

/**
 * 影视/书库目录（D6 修复）：函数实时解析对端域设置——旧实现只在 applyDirectories
 * （插件启动/日记设置变更）时快照一次，用户改影院/书架目录后日记本一直读旧目录直到重启。
 * 每次读取实时 resolve，与 applyDirectories 注释「实时读对域设置」的既有契约对齐。
 */
export function movieDirectory(): string {
  return safeResolve(resolveCinemaFolderPath, '我的/影视');
}
export function bookDirectory(): string {
  return safeResolve(resolveBookshelfFolderPath, '书库');
}

/** 跨域目录解析兜底：对域设置未注入/抛错时回落本域默认，绝不让目录应用整体失败 */
function safeResolve(resolver: () => string, fallback: string): string {
  try {
    const v = resolver();
    return v && v.trim() ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * 墙四内容目录（日记/影视/信/书）路径命中判定——单源：data 层缓存失效订阅与
 * ui 层 vault 订阅/引用同步共用，避免同一判定散落三份（改口径只动这里）。
 */
export function inWallDirs(p: string): boolean {
  return [DIARY_DIRECTORY, movieDirectory(), LETTER_DIRECTORY, bookDirectory()].some(
    (d) => p.startsWith(d + '/') || p === d + '.md'
  );
}

/**
 * 应用设置（启动/日记设置变更时调用）。
 * 影视/书库走跨域实时解析（movieDirectory/bookDirectory），不在此快照（D6 修复）。
 * N6：目录键 trim 尾斜杠（与 data.ts collectMdPaths 同口径 normalize）——否则监听侧
 * `startsWith(dir + '/')` 拼成双斜杠恒不命中，改名/删除/修改的自动回刷整体失效。
 */
export function applyDirectories(settings: {
  diaryDirectory?: string;
  letterDirectory?: string;
  diaryEntryFormat?: unknown;
  diaryTypes?: unknown;
}) {
  const clean = (v: string | undefined, fallback: string): string => {
    const t = (v || '').trim().replace(/\/+$/, '');
    return t || fallback;
  };
  DIARY_DIRECTORY = clean(settings.diaryDirectory, '') || obsidianDailyNotesFolder() || '我的/日记';
  LETTER_DIRECTORY = clean(settings.letterDirectory, '我的/信');
  DIARY_ENTRY_FORMAT = settings.diaryEntryFormat === 'day' ? 'day' : 'entry';
  applyDiaryTypes(settings.diaryTypes);
}

/** 加密分类名（ADR-0017；写块标题、筛选/计数、排序用） */
export const ENCRYPT_TAG = '加密';

/**
 * 分类展示顺序（筛选栏）：配置顺序，但「加密」固定排在最后（用户决策）。
 * 用于筛选栏分类按钮的遍历顺序。
 */
export function getPrimaryTagsInDisplayOrder(): string[] {
  const tags = Object.keys(PRIMARY_TAGS_CONFIG);
  const idx = tags.indexOf(ENCRYPT_TAG);
  if (idx === -1) return tags;
  const rest = tags.filter((t) => t !== ENCRYPT_TAG);
  rest.push(ENCRYPT_TAG);
  return rest;
}

/** 恢复默认分类（测试与设置重置使用）：只回到 3 个示例，不回到旧版列表 */
export function resetTagsConfig() {
  DIARY_TYPES = clone(DEFAULT_DIARY_TYPES);
  PRIMARY_TAGS_CONFIG = toPrimaryConfig(DIARY_TYPES);
  buildTagMaps();
}

// ===== emoji 映射表（与当前分类表同步） =====
export const tagToEmojiMap: Record<string, string> = {};
export const emojiToTagMap: Record<string, string> = {};

// ===== 模块加载时立即构建映射（须在映射表声明之后；此调用是唯一构建入口，不可删除） =====
buildTagMaps();

/** 构建分类↔emoji 双向映射 */
export function buildTagMaps() {
  for (const key of Object.keys(tagToEmojiMap)) delete tagToEmojiMap[key];
  for (const key of Object.keys(emojiToTagMap)) delete emojiToTagMap[key];
  for (const [tag, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    tagToEmojiMap[tag] = config.emoji;
    emojiToTagMap[config.emoji] = tag;
  }
}

/**
 * 获取分类对应的 emoji；未知 type 回退 `DEFAULT_DIARY_EMOJI`（📖）。
 * 旧日记的 frontmatter type / 旧块头 emoji 可能不在当前分类表（用户升级后只保留 3 个示例、
 * 手动删过分类）——这里必须给默认图标，渲染层才能在类型签/票根/藏书票上照常显示 type 原文，
 * 不出现空签、也不抛错。
 */
export function getTagEmoji(tag: string): string {
  return tagToEmojiMap[tag] || DEFAULT_DIARY_EMOJI;
}

/** 层级已退役：恒返回 null（保留导出，旧调用方不会炸） */
export function getSubTagsOfPrimary(_primaryTag: string): SubTagConfig[] | null {
  return null;
}

/** 层级已退役：恒 false */
export function isSubTag(_tag: string): boolean {
  return false;
}

/** 层级已退役：恒 null */
export function getParentPrimaryTag(_subTag: string): string | null {
  return null;
}

/**
 * 写日记弹窗里的分类顺序：全部平级，按配置顺序（「加密」不进新建弹窗，ADR-0017）。
 *
 * `extraTags`：把「当前条目已有的 type」并进来（去重、排在配置项之后）。读旧日记/换贴纸时
 * 旧 type（如「四川」）可能已不在分类表——不并进来就会在贴纸册里隐身，用户盖一次贴纸
 * 保存后旧标签被静默丢掉。新建日记不传，行为与原来完全一致。
 */
export function getSortedTagsForAddDialog(extraTags?: Iterable<string>): string[] {
  const tags = Object.keys(PRIMARY_TAGS_CONFIG).filter((t) => t !== ENCRYPT_TAG);
  const seen = new Set(tags);
  for (const raw of extraTags ?? []) {
    const tag = String(raw ?? '').trim();
    if (!tag || tag === ENCRYPT_TAG || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/**
 * 收藏本配置（ticket 11 移植 + ticket 177 重构）：源码 收藏本.js L12-25。
 * 9 类固定标签（顺序即 UI 顺序）：数据 tags[] 存 label（如 'GitHub'）。
 * 归档冷存（ADR-0074）为数据层字段扩展，见 types.ts。
 *
 * issue 363 标签自定义：9 类降为内置 seed（DEFAULT_TAGS），定义本体存 data.json 设置键
 * favoriteTags（issue 363 修订，2026-09-16 拍板：伴生文件 favorites.tags.json 退役——
 * favorites.json 顶层纯条目数组契约不动：主页.js 读 favorites.length、checkup 字段漂移
 * 检查依赖纯数组根）。getTags 读设置层即时生效（无键/空/坏回退 seed，不落盘）；
 * setTags 写设置层（持久化由 data.saveTags / 旧文件迁移任务收口，首次改动才落盘）。
 */
import { tryGetSettings } from '../core/settings-provider';
import type { FavTag } from './types';

export const CONFIG = {
  /** 默认存储目录（文件名固定 favorites.json，设置只允许改目录） */
  DEFAULT_STORAGE_PATH: 'CONFIG/STORAGE',
  /** 数据文件名（固定，不允许用户修改） */
  STORAGE_FILE: 'favorites.json',
  /** 标签定义设置键（data.json；旧伴生文件 favorites.tags.json 仅迁移期识别，见 data.ts） */
  TAGS_SETTINGS_KEY: 'favoriteTags',
};

/**
 * 内置 9 类 seed（旧硬编码 TAGS 收编）：id 固定不随改名变化——GitHub 强标签特判、
 * 删除迁移兜底目标（'web' 网站）等内部引用一律按 id 取当前 label。
 */
export const DEFAULT_TAGS: FavTag[] = [
  { id: 'github', label: 'GitHub', ic: 'github' },
  { id: 'desktop', label: '桌面软件', ic: 'app-window' },
  { id: 'web', label: '网站', ic: 'globe' },
  { id: 'llm', label: '大模型', ic: 'brain-circuit' },
  { id: 'pi', label: 'pi', ic: 'keyboard' },
  { id: 'claude', label: 'Claude', ic: 'bot' },
  { id: 'skills', label: 'skills', ic: 'zap' },
  { id: 'pub', label: '酒馆', ic: 'beer' },
  { id: 'dsh', label: 'DeepSeek Harness', ic: 'waypoints' },
];

/** 运行时标签集（null = 未载入，getTags() 首次访问自设置键播种；setTags 写键时同步注入） */
let currentTags: FavTag[] | null = null;

/** 设置键现值归一化（坏行剔除/缺 id 补，data.json 手改防御）：无键/空/坏 → []，由调用方回退 seed */
function tagsFromSettings(): FavTag[] {
  return normalizeTags((tryGetSettings() as any)?.[CONFIG.TAGS_SETTINGS_KEY]);
}

/**
 * 当前生效标签定义（设置键优先，无键/空/坏回退内置 9 类 seed；顺序即磁贴行与表单顺序）。
 * 缓存语义（审查修复注明）：本运行时缓存只在「未播种/setTags 写入」时读设置键，之后不再
 * 回读——外部直接改 data.json 的 favoriteTags 在本次会话内不感知，需重载插件（resetTagsState）
 * 或走任一 saveTags/迁移写入路径才会刷新；正常链路都经 setTags 单点写，缓存即最新。
 */
export function getTags(): FavTag[] {
  if (!currentTags) {
    const tags = tagsFromSettings();
    currentTags = tags.length ? tags : DEFAULT_TAGS;
  }
  return currentTags;
}

/**
 * 注入标签定义到设置层（归一化后写 data.json 设置键 favoriteTags + 运行时即时生效）。
 * 注意：只写不落盘——持久化由 data.saveTags（管理界面唯一落盘点）与旧伴生文件迁移任务
 * 经 saveSettings 收口；seed 回退不写键（首次改动才落盘）。
 */
export function setTags(tags: FavTag[]): void {
  currentTags = tags;
  (tryGetSettings() as any)[CONFIG.TAGS_SETTINGS_KEY] = tags;
}

/** 测试/卸载重置（丢弃运行时集，下次 getTags 自设置键重播种——设置键即真理） */
export function resetTagsState(): void {
  currentTags = null;
}

/** 按稳定 id 取标签定义（GitHub 特判等内部引用单源；不存在返回 null） */
export function getTagById(id: string): FavTag | null {
  return getTags().find((t) => t.id === id) ?? null;
}

/** 新增标签 id（'t' + 时间戳36进制 + 同毫秒递增序；id 一经生成不再变化）。
 *  审查修复：纯时间戳同毫秒批量新增/归一化多行会撞 id，追加毫秒内计数器保证唯一。 */
let tagIdSeq = 0;
export function newTagId(): string {
  tagIdSeq = (tagIdSeq + 1) % 1679616; // 36^4 循环（单毫秒内不可能耗尽，跨毫秒回绕也无碰撞面）
  return 't' + Date.now().toString(36) + tagIdSeq.toString(36);
}

/** 标签定义归一化：坏行剔除、缺 id 补（旧手改文件防御）、缺图标回落 tag、名称去空白 */
export function normalizeTags(raw: unknown): FavTag[] {
  if (!Array.isArray(raw)) return [];
  const out: FavTag[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Partial<FavTag>;
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    if (!label) continue;
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : newTagId(),
      label,
      ic: typeof o.ic === 'string' && o.ic ? o.ic : 'tag',
    });
  }
  return out;
}



/**
 * 归一化存储目录：设置只允许填目录；兼容旧值（旧设置可能存了完整文件路径，
 * 以 .json 结尾时取其所在目录）。
 */
export function getStorageDir(value?: string): string {
  let dir = (value || CONFIG.DEFAULT_STORAGE_PATH).trim().replace(/\/+$/, '');
  if (/\.json$/i.test(dir)) {
    const idx = dir.lastIndexOf('/');
    dir = idx >= 0 ? dir.slice(0, idx) : '';
  }
  return dir || CONFIG.DEFAULT_STORAGE_PATH;
}

/** 完整数据文件路径（目录 + 固定文件名） */
export function getStoragePath(value?: string): string {
  return getStorageDir(value) + '/' + CONFIG.STORAGE_FILE;
}


/** 补协议头（无 http(s) 前缀时补 https://） */
export function normalizeUrl(url: string): string {
  const u = (url || '').trim();
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

/** URL 形态判定（ticket 188 贴链自动搬家）：无空白的 http(s):// 或 www. 开头串 */
export function isUrlLike(text: string): boolean {
  const t = (text || '').trim();
  return t.length > 0 && !/\s/.test(t) && (/^https?:\/\//i.test(t) || /^www\./i.test(t));
}

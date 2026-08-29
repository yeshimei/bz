/**
 * 收藏本动作观察文案层（ticket 078，ADR-0031，对齐影视/备忘录/聚合讯方法监听样板）：
 * 用户拍板——观察只来自 favorites UI 确认回调（方法监听）：favorites 域 UI 确认回调直接调
 * smartcat.notifyFavoritesAction(事件)，文案构造集中本模块（纯函数可测）。
 * 覆盖动作：添加（键值式有才加）/ 编辑（α 变化列表，只列真正变化）/ 删除（仅标题）/ 归档（仅标题，ticket 140）。
 * 置顶/取消置顶不观察（不单独发观察，编辑里的置顶变化也不列入变化列表）；
 * 打开链接、跳转笔记、刷新余额不观察（不落盘或系统数据）。
 * 数据语义零改动：字段对齐 favorites.json（id/tags/title/description/pinned/url/…/type/llmConfig）。
 *
 * P2b（ticket 123）：新增 buildFavoritesStructured——构造 StructuredMeta 供行为流写入。
 */
import type { FavoritesItem } from '../favorites/types';
import type { StructuredMeta } from './types';

/** 收藏本动作事件（favorites 域确认回调 → smartcat.notifyFavoritesAction） */
export type FavoritesActionEvent =
  | { kind: 'add'; item: FavoritesItem }
  | { kind: 'edit'; title: string; changes: string[] }
  | { kind: 'delete'; title: string }
  | { kind: 'archive'; title: string };

/** 编辑变化列表（α：比较旧/新条目，只列真正变化的字段；无变化 → 空数组）。
 *  参与比较字段：title/description/url/tags（tags 用 join(',') 比较）；
 *  不参与：created/id/type/llmConfig/balance*（pinned 置顶变化不列——用户拍板，置顶另走抽屉不观察）。
 *  变化项标签与顺序：改了标题 / 改了简介 / 改了链接 / 改了分类（对齐 ticket 示例）。 */
export function favoritesEditChanges(oldItem: FavoritesItem, nextItem: FavoritesItem): string[] {
  const changes: string[] = [];
  if ((oldItem.title || '').trim() !== (nextItem.title || '').trim()) changes.push('改了标题');
  if ((oldItem.description || '').trim() !== (nextItem.description || '').trim()) changes.push('改了简介');
  if ((oldItem.url || '').trim() !== (nextItem.url || '').trim()) changes.push('改了链接');
  if ((oldItem.tags || []).join(',') !== (nextItem.tags || []).join(',')) changes.push('改了分类');
  return changes;
}

/** 添加观察文案（键值式：标题必填，UI 已校验；追加字段顺序固定、有才加——
 *  分类（tags 全列顿号）→ 简介「…」→ 链接 url 原文 → 已置顶（仅 pinned=true）） */
export function favoritesAddedText(item: FavoritesItem): string {
  const kv: string[] = [];
  const tags = (item.tags || []).map((t) => t.trim()).filter(Boolean);
  if (tags.length) kv.push(`分类（${tags.join('、')}）`);
  const desc = (item.description || '').trim();
  if (desc) kv.push(`简介「${desc}」`);
  const url = (item.url || '').trim();
  if (url) kv.push(`链接 ${url}`);
  if (item.pinned) kv.push('已置顶');
  const title = (item.title || '').trim();
  return kv.length ? `你收藏了《${title}》：${kv.join('、')}` : `你收藏了《${title}》`;
}

/** 编辑观察文案（α 变化列表：变化项顿号分隔；无变化省略列表——发「你编辑了收藏《X》」不带尾冒号） */
export function favoritesEditedText(title: string, changes: string[]): string {
  return changes.length ? `你编辑了收藏《${title}》：${changes.join('、')}` : `你编辑了收藏《${title}》`;
}

/** 删除观察文案（标题必填） */
export function favoritesDeletedText(title: string): string {
  return `你删除了收藏《${title}》`;
}

/** 归档观察文案（标题必填；ticket 140：与删除同构短文案，ADR-0074 冷存无查看面，观察流是唯一可读痕迹） */
export function favoritesArchivedText(title: string): string {
  return `你归档了《${title}》`;
}

/** 事件 → 观察文本（smartcat.notifyFavoritesAction 调用；本域所有事件均有观察，保持 string | null 签名一致） */
export function buildFavoritesActionText(evt: FavoritesActionEvent): string | null {
  switch (evt.kind) {
    case 'add':
      return favoritesAddedText(evt.item);
    case 'edit':
      return favoritesEditedText(evt.title, evt.changes);
    case 'delete':
      return favoritesDeletedText(evt.title);
    case 'archive':
      return favoritesArchivedText(evt.title);
  }
}

// ==================== P2b 结构化元数据（行为流） ====================

/** 收藏本事件 → StructuredMeta（行为流） */
export function buildFavoritesStructured(evt: FavoritesActionEvent): StructuredMeta | null {
  switch (evt.kind) {
    case 'add':
      return {
        entityType: 'favorite', action: 'added', name: evt.item.title,
        extras: { tags: evt.item.tags, description: evt.item.description, url: evt.item.url, pinned: evt.item.pinned },
      };
    case 'edit':
      return { entityType: 'favorite', action: 'edited', name: evt.title, extras: { changes: evt.changes } };
    case 'delete':
      return { entityType: 'favorite', action: 'deleted', name: evt.title };
    case 'archive':
      return { entityType: 'favorite', action: 'archived', name: evt.title };
  }
}
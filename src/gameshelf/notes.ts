/**
 * 游戏架（gameshelf）域 vault 读写（store 层）：
 * 扫描现存游戏笔记（metadataCache 零 IO，ADR-0137 挂载树同口径）→ 快照；
 * 新建笔记 / processFrontMatter 管辖键 upsert（用户正文与自定义 frontmatter 绝不覆盖）。
 */
import type { App, TFile } from 'obsidian';
import { M, resolveGameshelfFolderPath, type GameItem } from './state';
import { buildSyncPlan, managedFm, mergeTags, notePathFor, sanitizeFileName, type NoteSnapshot } from './reconcile';
import type { SteamOwnedGame } from './steam';
import { steamCoverUrl } from './steam';

/** 扫描游戏目录全部笔记 → 条目（appid 缺失/非法的文件跳过——不是本域数据不碰） */
export function rebuildItems(app: App): GameItem[] {
  const folder = resolveGameshelfFolderPath();
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + '/'));
  const items: GameItem[] = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const appid = Number(fm?.appid);
    if (!fm || !Number.isFinite(appid) || appid <= 0) continue;
    items.push({
      file,
      appid,
      name: file.basename.replace(/^《/, '').replace(/》$/, '').trim() || `App ${appid}`,
      playtimeMin: Number.isFinite(Number(fm.playtimeMin)) ? Math.max(0, Math.floor(Number(fm.playtimeMin))) : 0,
      lastPlayed: typeof fm.lastPlayed === 'string' ? fm.lastPlayed : '',
      cover: typeof fm.cover === 'string' && /^https?:\/\//.test(fm.cover) ? fm.cover : steamCoverUrl(appid),
      offShelf: fm.offShelf === true,
      syncedAt: typeof fm.syncedAt === 'string' ? fm.syncedAt : null,
    });
  }
  M.items = items;
  return items;
}

/** 现存笔记 → 对账快照（buildSyncPlan 入参） */
export function scanSnapshots(app: App, folder: string): NoteSnapshot[] {
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + '/'));
  const out: NoteSnapshot[] = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const appid = Number(fm?.appid);
    if (!fm || !Number.isFinite(appid) || appid <= 0) continue;
    out.push({
      path: file.path,
      appid,
      playtimeMin: Number.isFinite(Number(fm.playtimeMin)) ? Math.max(0, Math.floor(Number(fm.playtimeMin))) : null,
      offShelf: fm.offShelf === true,
    });
  }
  return out;
}

/**
 * 应用对账计划：新建 + 管辖键 upsert + offShelf 标记。
 * - upsert 只写 managedFm 六键 + tags 保底归并，其余 frontmatter 键不动（用户数据零覆盖）；
 * - offShelf 只翻布尔，不删文件（票 368：退款/隐藏的游戏笔记保留）。
 */
export async function applySyncPlan(app: App, folder: string, owned: SteamOwnedGame[], nowIso: string): Promise<{ added: number; updated: number; offShelf: number }> {
  const plan = buildSyncPlan(owned, scanSnapshots(app, folder));
  if (plan.toCreate.length > 0 && !app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder);
  }
  const taken = new Set(app.vault.getMarkdownFiles().map((f) => f.path));
  for (const game of plan.toCreate) {
    const path = notePathFor(folder, game, taken);
    taken.add(path);
    await app.vault.create(path, noteMarkdown(game, nowIso));
  }
  const byPath = new Map<string, TFile>();
  for (const f of app.vault.getMarkdownFiles()) byPath.set(f.path, f);
  for (const { game, note } of plan.toUpdate) {
    const file = byPath.get(note.path);
    if (!file) continue;
    await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      Object.assign(fm, managedFm(game, nowIso));
      fm.tags = mergeTags(fm.tags);
    });
  }
  for (const note of plan.toOffShelf) {
    const file = byPath.get(note.path);
    if (!file) continue;
    await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm.offShelf = true;
    });
  }
  return { added: plan.toCreate.length, updated: plan.toUpdate.length, offShelf: plan.toOffShelf.length };
}

/** 新建游戏笔记：frontmatter（管辖键 + tags 保底）+ 空正文（用户自由书写） */
function noteMarkdown(game: SteamOwnedGame, nowIso: string): string {
  const fm = managedFm(game, nowIso);
  const lines = [
    '---',
    'tags:',
    '- 游戏',
    `appid: ${fm.appid}`,
    `playtimeMin: ${fm.playtimeMin}`,
  ];
  if (fm.lastPlayed) lines.push(`lastPlayed: "${fm.lastPlayed}"`);
  lines.push(
    `cover: ${fm.cover}`,
    `syncedAt: "${fm.syncedAt}"`,
    'offShelf: false',
    '---',
    '',
    '',
  );
  return lines.join('\n');
}

/** 展示名 → 文件名（对外给「改名」类功能留口；当前域内无改名入口，测试消费） */
export function gameNotePath(folder: string, name: string): string {
  return `${folder}/《${sanitizeFileName(name)}》.md`;
}

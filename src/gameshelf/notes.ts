/**
 * 游戏架（gameshelf）域 vault 读写（store 层）：
 * 扫描现存游戏笔记（metadataCache 零 IO，ADR-0137 挂载树同口径）→ 快照；
 * 新建笔记 / processFrontMatter 管辖键 upsert（用户正文与自定义 frontmatter 绝不覆盖）。
 */
import type { App, TFile } from 'obsidian';
import { M, resolveGameshelfFolderPath, type GameItem } from './state';
import { buildSyncPlan, managedFm, mergeTags, migrateLegacyKeys, notePathFor, sanitizeFileName, type NoteSnapshot } from './reconcile';
import type { SteamOwnedGame } from './steam';
import { steamCoverUrl } from './steam';

/** 读管辖值：中文键优先，旧英文键回退（首版部署的存量笔记在下次同步时迁移） */
function readVal(fm: Record<string, unknown>, cn: string, legacy: string): unknown {
  return fm[cn] !== undefined ? fm[cn] : fm[legacy];
}

/** 非负整数读数（缺键/非法/负数 → 0） */
function intOf(v: unknown): number {
  return Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0;
}

/** 扫描游戏目录全部笔记 → 条目（AppID 缺失/非法的文件跳过——不是本域数据不碰） */
export function rebuildItems(app: App): GameItem[] {
  const folder = resolveGameshelfFolderPath();
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + '/'));
  const items: GameItem[] = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const appid = Number(readVal(fm ?? {}, 'AppID', 'appid'));
    if (!fm || !Number.isFinite(appid) || appid <= 0) continue;
    const icon = readVal(fm, '图标', '');
    items.push({
      file,
      appid,
      name: file.basename.replace(/^《/, '').replace(/》$/, '').trim() || `App ${appid}`,
      playtimeMin: intOf(readVal(fm, '游玩分钟', 'playtimeMin')),
      lastPlayed: typeof readVal(fm, '最后游玩', 'lastPlayed') === 'string' ? String(readVal(fm, '最后游玩', 'lastPlayed')) : '',
      cover: typeof readVal(fm, '封面', 'cover') === 'string' && /^https?:\/\//.test(String(readVal(fm, '封面', 'cover'))) ? String(readVal(fm, '封面', 'cover')) : steamCoverUrl(appid),
      icon: typeof icon === 'string' && /^https?:\/\//.test(icon) ? icon : null,
      windowsMin: intOf(fm['Windows分钟']),
      deckMin: intOf(fm['SteamDeck分钟']),
      macMin: intOf(fm['Mac分钟']),
      linuxMin: intOf(fm['Linux分钟']),
      hasAch: fm['有成就'] === true,
      offShelf: readVal(fm, '已下架', 'offShelf') === true,
      syncedAt: typeof readVal(fm, '同步时间', 'syncedAt') === 'string' ? String(readVal(fm, '同步时间', 'syncedAt')) : null,
    });
  }
  M.items = items;
  return items;
}

/** 现存笔记 → 对账快照（buildSyncPlan 入参；旧英文键标记 legacy 待迁移） */
export function scanSnapshots(app: App, folder: string): NoteSnapshot[] {
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + '/'));
  const out: NoteSnapshot[] = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const appid = Number(readVal(fm ?? {}, 'AppID', 'appid'));
    if (!fm || !Number.isFinite(appid) || appid <= 0) continue;
    out.push({
      path: file.path,
      appid,
      playtimeMin: Number.isFinite(Number(readVal(fm, '游玩分钟', 'playtimeMin'))) ? Math.max(0, Math.floor(Number(readVal(fm, '游玩分钟', 'playtimeMin')))) : null,
      offShelf: readVal(fm, '已下架', 'offShelf') === true,
      legacy: 'appid' in fm || 'playtimeMin' in fm,
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
      migrateLegacyKeys(fm); // 中文键已 assign，此调用实际是清掉残留旧键
      fm.tags = mergeTags(fm.tags);
    });
  }
  for (const note of plan.toOffShelf) {
    const file = byPath.get(note.path);
    if (!file) continue;
    await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm['已下架'] = true;
      delete fm['offShelf']; // 旧键迁移（offShelf 语义唯一出口 = 已下架）
    });
  }
  return { added: plan.toCreate.length, updated: plan.toUpdate.length, offShelf: plan.toOffShelf.length };
}

/** 新建游戏笔记：frontmatter（中文管辖键 + tags 保底）+ 空正文（用户自由书写） */
function noteMarkdown(game: SteamOwnedGame, nowIso: string): string {
  const fm = managedFm(game, nowIso);
  const lines = [
    '---',
    'tags:',
    '- 游戏',
    `AppID: ${fm.AppID}`,
    `游玩分钟: ${fm['游玩分钟']}`,
  ];
  if (fm['最后游玩']) lines.push(`最后游玩: "${fm['最后游玩']}"`);
  lines.push(
    `封面: ${fm['封面']}`,
    `同步时间: "${fm['同步时间']}"`,
    `已下架: ${fm['已下架']}`,
    `图标: ${fm['图标'] || '""'}`,
    `Windows分钟: ${fm['Windows分钟']}`,
    `SteamDeck分钟: ${fm['SteamDeck分钟']}`,
    `Mac分钟: ${fm['Mac分钟']}`,
    `Linux分钟: ${fm['Linux分钟']}`,
    `有成就: ${fm['有成就']}`,
    '---',
    '',
    '',
  );
  return lines.join('\n');
}

/** 详情按需拉取后写回（成就/商店元数据；只碰详情键，其余不问） */
export async function upsertDetail(app: App, file: TFile, fields: Record<string, unknown>): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    Object.assign(fm, fields);
  });
}

/** 读详情缓存（成就/商店键是否已写入；detailFm 读法与 upsertDetail 同契约） */
export function readDetailFm(app: App, file: TFile): Record<string, unknown> {
  return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
}

/** 展示名 → 文件名（对外给「改名」类功能留口；当前域内无改名入口，测试消费） */
export function gameNotePath(folder: string, name: string): string {
  return `${folder}/《${sanitizeFileName(name)}》.md`;
}

/**
 * 游戏库（gameshelf）域 vault 读写（store 层）：
 * 扫描现存游戏笔记（metadataCache 零 IO，ADR-0137 挂载树同口径）→ 快照；
 * 新建笔记 / processFrontMatter 管辖键 upsert（用户正文与自定义 frontmatter 绝不覆盖）。
 */
import type { App, TFile } from 'obsidian';
import { M, resolveGameshelfFolderPath, type GameItem } from './state';
import { GS_FM, GS_LEGACY_FM } from './constants';
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

/** 非空字符串读数（缺键/空串/非字符串 → null）——封面/图标既可能是本地路径也可能是远端地址 */
function strOf(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * 展示名解析：`《名》.md` → 名（深审 F12）——同名消歧文件名 `《名》 12345.md` 连尾巴
 * 一起剥，否则卡片/门面/弹窗显示成「名》 12345」，搜索匹配与名称排序也随之歪。
 * 不匹配书名号形态的回落旧剥法（只剥首《与尾》），用户手建的怪名行为不变。
 */
function displayBaseName(basename: string): string {
  const m = /^《(.+?)》(?:\s+\d+)?$/.exec(basename);
  if (m) return m[1];
  return basename.replace(/^《/, '').replace(/》$/, '');
}

/** GameItem 逐字段浅比较（A1 复用判据：除 file 外全是解析产物标量，file 只比 path） */
function sameItem(a: GameItem, b: GameItem): boolean {
  return (
    (a.file?.path ?? null) === (b.file?.path ?? null) &&
    a.appid === b.appid &&
    a.name === b.name &&
    a.zhName === b.zhName &&
    a.playtimeMin === b.playtimeMin &&
    a.lastPlayed === b.lastPlayed &&
    a.cover === b.cover &&
    a.coverSrc === b.coverSrc &&
    a.icon === b.icon &&
    a.iconSrc === b.iconSrc &&
    a.windowsMin === b.windowsMin &&
    a.deckMin === b.deckMin &&
    a.macMin === b.macMin &&
    a.linuxMin === b.linuxMin &&
    a.hasAch === b.hasAch &&
    a.offShelf === b.offShelf &&
    a.syncedAt === b.syncedAt
  );
}

/**
 * 扫描游戏目录全部笔记 → 条目（AppID 缺失/非法的文件跳过——不是本域数据不碰）。
 *
 * 两条与队列的契约（深审 A1/A2，改动前先读）：
 * - **A1 未变条目复用旧对象**：names/posters 等后台队列持「入队时的条目引用」就地写回填
 *   成果（zhName/cover），本函数整表替换 M.items 时若连对象一起换新，在途队列的成果就写进
 *   无人引用的旧对象（home 首页采集、同步链 rebuild 都会触发）。frontmatter 未变的条目
 *   保持同一引用 = 队列写的就是 M.items 现值，渐进渲染才有意义。
 * - **A2 缓存未就绪保留既有条目**：metadataCache 对新建文件的索引是异步的，同步批量建完
 *   立即重建时会追不上——cache 为 null 的文件从上一轮 M.items 按 path 保留（cinema
 *   data.ts 同款守卫，issue 256），缓存就绪的下一次重建正常解析接管。
 */
export function rebuildItems(app: App): GameItem[] {
  const folder = resolveGameshelfFolderPath();
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + '/'));
  const prevByPath = new Map<string, GameItem>();
  for (const it of M.items) {
    if (it.file) prevByPath.set(it.file.path, it);
  }
  const items: GameItem[] = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) {
      // A2：文件在而缓存未索引 → 保留上一轮既有条目（没有就不凭空造——不是本域数据不碰）
      const kept = prevByPath.get(file.path);
      if (kept) items.push(kept);
      continue;
    }
    const appid = Number(readVal(fm, GS_FM.appId, GS_LEGACY_FM.appId));
    if (!Number.isFinite(appid) || appid <= 0) continue;
    const icon = readVal(fm, GS_FM.icon, '');
    const zh = fm[GS_FM.zhName];
    const coverRaw = readVal(fm, GS_FM.cover, GS_LEGACY_FM.cover);
    const iconSrc = fm[GS_FM.iconSrc];
    const coverSrc = fm[GS_FM.coverSrc];
    const next: GameItem = {
      file,
      appid,
      name: displayBaseName(file.basename).trim() || `App ${appid}`,
      zhName: typeof zh === 'string' && zh.trim() ? zh.trim() : null,
      playtimeMin: intOf(readVal(fm, GS_FM.playtimeMin, GS_LEGACY_FM.playtimeMin)),
      lastPlayed:
        typeof readVal(fm, GS_FM.lastPlayed, GS_LEGACY_FM.lastPlayed) === 'string'
          ? String(readVal(fm, GS_FM.lastPlayed, GS_LEGACY_FM.lastPlayed))
          : '',
      // 封面/图标：既可能是本地 vault 路径（媒体队列写过），也可能是远端地址（没本地化过）
      cover: strOf(coverRaw) || steamCoverUrl(appid),
      coverSrc: strOf(coverSrc) || steamCoverUrl(appid),
      icon: strOf(icon),
      iconSrc: strOf(iconSrc),
      windowsMin: intOf(fm[GS_FM.windowsMin]),
      deckMin: intOf(fm[GS_FM.deckMin]),
      macMin: intOf(fm[GS_FM.macMin]),
      linuxMin: intOf(fm[GS_FM.linuxMin]),
      hasAch: fm[GS_FM.hasAch] === true,
      offShelf: readVal(fm, GS_FM.offShelf, GS_LEGACY_FM.offShelf) === true,
      syncedAt:
        typeof readVal(fm, GS_FM.syncedAt, GS_LEGACY_FM.syncedAt) === 'string'
          ? String(readVal(fm, GS_FM.syncedAt, GS_LEGACY_FM.syncedAt))
          : null,
    };
    // A1：frontmatter 未变 → 沿用上一轮对象（契约见函数头注释）
    const prev = prevByPath.get(file.path);
    items.push(prev && sameItem(prev, next) ? prev : next);
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
    const appid = Number(readVal(fm ?? {}, GS_FM.appId, GS_LEGACY_FM.appId));
    if (!fm || !Number.isFinite(appid) || appid <= 0) continue;
    out.push({
      path: file.path,
      appid,
      playtimeMin: Number.isFinite(Number(readVal(fm, GS_FM.playtimeMin, GS_LEGACY_FM.playtimeMin)))
        ? Math.max(0, Math.floor(Number(readVal(fm, GS_FM.playtimeMin, GS_LEGACY_FM.playtimeMin))))
        : null,
      offShelf: readVal(fm, GS_FM.offShelf, GS_LEGACY_FM.offShelf) === true,
      legacy: GS_LEGACY_FM.appId in fm || GS_LEGACY_FM.playtimeMin in fm,
      // 媒体本地化改造前建的笔记没有「封面源」→ 借这次同步补齐（补过即自愈，不再 churn）
      mediaPending: fm[GS_FM.coverSrc] === undefined,
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
      fm[GS_FM.offShelf] = true;
      delete fm[GS_LEGACY_FM.offShelf]; // 旧键迁移（offShelf 语义唯一出口 = 已下架）
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
    `AppID: ${fm[GS_FM.appId]}`,
    `游玩分钟: ${fm[GS_FM.playtimeMin]}`,
  ];
  if (fm[GS_FM.lastPlayed]) lines.push(`最后游玩: "${fm[GS_FM.lastPlayed]}"`);
  lines.push(
    // 源键（同步管辖）+ 现值：新建时现值先填远端，媒体队列拉到本地后改写成 vault 路径
    `封面源: ${fm[GS_FM.coverSrc]}`,
    `封面: ${fm[GS_FM.coverSrc]}`,
    `图标源: ${fm[GS_FM.iconSrc] || '""'}`,
    `图标: ${fm[GS_FM.iconSrc] || '""'}`,
    `同步时间: "${fm[GS_FM.syncedAt]}"`,
    `已下架: ${fm[GS_FM.offShelf]}`,
    `Windows分钟: ${fm[GS_FM.windowsMin]}`,
    `SteamDeck分钟: ${fm[GS_FM.deckMin]}`,
    `Mac分钟: ${fm[GS_FM.macMin]}`,
    `Linux分钟: ${fm[GS_FM.linuxMin]}`,
    `有成就: ${fm[GS_FM.hasAch]}`,
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

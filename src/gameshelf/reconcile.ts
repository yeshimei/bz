/**
 * 游戏架（gameshelf）域对账纯函数（issue 368 核心机制）：
 * Steam 库快照 × 现存笔记 → 同步计划；Steam 管辖字段归一。
 * 零 IO、零 DOM、无 obsidian 依赖——node 环境可测。
 *
 * 对账规则（票 368 拍板）：
 * - 笔记身份 = frontmatter appid（不是文件名——游戏名可能改，文件名保持首次创建稳定）；
 * - Steam 管辖字段 appid/playtimeMin/lastPlayed/cover/syncedAt/offShelf 全量 upsert；
 *   用户正文与自定义 frontmatter 一律不碰（notes.ts 只 processFrontMatter 管辖键）；
 * - Steam 库中消失的游戏（退款/隐藏）笔记保留、标 offShelf: true，不删。
 */
import type { SteamOwnedGame } from './steam';
import { steamCoverUrl } from './steam';

/** 游戏笔记统一 tag（frontmatter tags 保底一项；用户可自行追加，upsert 不清） */
export const GAME_TAG = '游戏';

/** 目录内现存游戏笔记的最小快照（notes.ts 扫描产出） */
export interface NoteSnapshot {
  path: string;
  appid: number;
  playtimeMin: number | null;
  offShelf: boolean;
}

export interface SyncPlan {
  /** Steam 有、库内无 → 新建笔记 */
  toCreate: SteamOwnedGame[];
  /** 两边都有且 Steam 数值有变化 → 更新管辖字段 */
  toUpdate: Array<{ game: SteamOwnedGame; note: NoteSnapshot }>;
  /** Steam 没了、笔记还在且未标 → 标 offShelf */
  toOffShelf: NoteSnapshot[];
  /** 两边都有且数值一致（含已 offShelf 的在场恢复） */
  unchanged: number;
}

/**
 * 对账主入口：
 * - 数值变化判定只看 playtimeMin / 在架状态（lastPlayed/syncedAt 每轮必新，不算变化依据）；
 * - 之前 offShelf 的游戏若重新出现在 Steam 库 → 归入 toUpdate（恢复在架 + 刷新数值）。
 */
export function buildSyncPlan(owned: SteamOwnedGame[], notes: NoteSnapshot[]): SyncPlan {
  const byAppid = new Map<number, NoteSnapshot>();
  for (const n of notes) byAppid.set(n.appid, n);
  const seen = new Set<number>();
  const plan: SyncPlan = { toCreate: [], toUpdate: [], toOffShelf: [], unchanged: 0 };
  for (const game of owned) {
    if (seen.has(game.appid)) continue; // Steam 侧异常重复 appid：首见优先
    seen.add(game.appid);
    const note = byAppid.get(game.appid);
    if (!note) {
      plan.toCreate.push(game);
      continue;
    }
    const valueChanged = note.playtimeMin === null || note.playtimeMin !== game.playtimeMin;
    if (valueChanged || note.offShelf) plan.toUpdate.push({ game, note });
    else plan.unchanged += 1;
  }
  for (const note of notes) {
    if (!seen.has(note.appid) && !note.offShelf) plan.toOffShelf.push(note);
  }
  return plan;
}

/** 文件名清洗：Steam 游戏名常含 Windows 非法字符（如冒号），替换为全角横线 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '－').trim();
}

/** 《名》.md；同名冲突（罕见：不同 appid 同名）追加 appid 消歧 */
export function notePathFor(folder: string, game: SteamOwnedGame, takenPaths: Set<string>): string {
  const base = `《${sanitizeFileName(game.name)}》`;
  const direct = `${folder}/${base}.md`;
  if (!takenPaths.has(direct)) return direct;
  return `${folder}/${base} ${game.appid}.md`;
}

/** 管辖 frontmatter 归一（同步时刻 nowIso 由调用方注入，纯函数可测） */
export function managedFm(game: SteamOwnedGame, nowIso: string): Record<string, unknown> {
  return {
    appid: game.appid,
    playtimeMin: game.playtimeMin,
    lastPlayed: lastPlayedStr(game.lastPlayedTs),
    cover: steamCoverUrl(game.appid),
    syncedAt: nowIso,
    offShelf: false,
  };
}

/** lastPlayed 落盘格式 YYYY-MM-DD（本地时区；从未玩 → 空串，frontmatter 写空则省略键） */
export function lastPlayedStr(tsMs: number): string {
  if (!tsMs || tsMs <= 0) return '';
  const d = new Date(tsMs);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * tags 归并：保底含 GAME_TAG，用户已追加的 tag 原样保留（upsert 不清用户数据）。
 * 接受 string / string[] / 缺省 → 统一 string[]。
 */
export function mergeTags(raw: unknown): string[] {
  const list = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw.map((t) => String(t)) : [];
  const out: string[] = [];
  for (const t of list) {
    const s = t.trim();
    if (s && !out.includes(s)) out.push(s);
  }
  if (!out.includes(GAME_TAG)) out.unshift(GAME_TAG);
  return out;
}

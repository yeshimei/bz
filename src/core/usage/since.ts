/**
 * 本地考古：这台机器上 bz 最早从哪天开始被用。
 *
 * 为什么要这个：使用统计 2026-11-12 才上线，老用户升级上来那一刻 `firstSeen`
 * 记的是「升级那天」，不是「开始用那天」——设备寿命、累计时长全从 0 起算，
 * 用了几个月的人被当成今天刚装。历史当时没记，事后补不回来，只能看本地还剩什么痕迹。
 *
 * 交出去什么：只有一个日期（YYYY-MM-DD），作者那边的看板拿它把「统计上线前」那段
 * 按日均折算出来。**不收路径、不收文件名、不收任何内容**（ADR-0297 隐私边界）。
 *
 * 看哪两处（取更早的一个，再夹到 [EARLIEST_DAY, 今天]）：
 *  1. 日记文件名里的日期——内容自带日期，换电脑、同步都不会改，最可信；
 *  2. 数据目录里最早的文件修改时间——同步工具保留 mtime，但仍可能被「复制」刷新，只当兜底。
 *
 * 只算一次：查到的日子锁进账本（`Ledger.sinceDay`），之后不再重算、不随版本变化；
 * 查不到（新装、目录还没建）就先空着，下次启动再试。
 */
import { getApp } from '../app';
import { tryGetSettings } from '../settings-provider';
import { storageDir } from '../storage';
import { localDayKey } from '../ui/str';

/**
 * 比这更早的痕迹一律当「从别处拷来的旧文件」，按这天算。
 * bz 仓库第一个提交是 2026-08-07，插件不可能在那之前存在。
 */
export const EARLIEST_DAY = '2026-08-01';

/** 单次列出上限：数据目录正常几十个文件，超了说明路径指到了别处（比如整个库根），不往下猜 */
const MAX_FILES = 5000;

const ISO_DAY = /(\d{4})-(\d{2})-(\d{2})/;
const CN_DAY = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 设备级的「最早使用日」存在 localStorage，跟 installId 同一个地方。
 *
 * 为什么不能只存账本：账本在**库**里（`<数据目录>/usage-<id>.json`），一个安装号开两个库就有两份账本，
 * 谁后启动谁把服务端那条记录的 since 覆盖掉——主库算出 8-31、测试库算出 11-09，
 * 来回切就会把起点改晚。设备号是设备级的，起点也必须是设备级的。
 */
const SINCE_KEY = 'bz.usage.sinceDay';

/** 读设备级起点；没有或坏了返回 '' */
export function readSinceLocal(): string {
  try {
    const v = String(localStorage.getItem(SINCE_KEY) || '').trim();
    return DAY_KEY.test(v) ? v : '';
  } catch {
    // 无 localStorage 的宿主（测试 / 只读壳）：退回账本那一份
    return '';
  }
}

export function writeSinceLocal(day: string): void {
  if (!DAY_KEY.test(String(day || ''))) return;
  try {
    localStorage.setItem(SINCE_KEY, day);
  } catch {
    // 写不进去就只靠账本，不影响上报
  }
}

/** 两个日期取更早的，空串不参与比较（「只往早里走」的唯一入口） */
export function earlierDay(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

/** 这个日期的来源，只在本机日志里用得上，不上报 */
export type SinceSource = 'diary' | 'data' | 'none';

export interface SinceHint {
  /** YYYY-MM-DD；'' = 没查到 */
  day: string;
  source: SinceSource;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 夹进合法区间：太早按插件最早可能的日子算，太晚（时钟漂移）按今天算 */
export function clampSince(day: string, today: string): string {
  if (!day) return '';
  if (day < EARLIEST_DAY) return EARLIEST_DAY;
  if (day > today) return today;
  return day;
}

interface DirListing {
  files: string[];
  folders: string[];
}

async function listDir(app: any, dir: string): Promise<DirListing | null> {
  if (!dir) return null;
  try {
    const out = await app?.vault?.adapter?.list?.(dir);
    if (!out || !Array.isArray(out.files)) return null;
    return {
      files: out.files.slice(0, MAX_FILES),
      folders: Array.isArray(out.folders) ? out.folders.slice(0, MAX_FILES) : [],
    };
  } catch {
    // 目录不存在 / 适配器不支持 / 权限不够：这条痕迹就当没有，绝不冒泡打断启动
    return null;
  }
}

/** 文件名里带的日期（日记一天一个文件，名字就是日子） */
export function dayFromName(name: string): string {
  const base = String(name || '').split('/').pop() || '';
  const cn = CN_DAY.exec(base);
  if (cn) return `${cn[1]}-${pad2(Number(cn[2]))}-${pad2(Number(cn[3]))}`;
  const iso = ISO_DAY.exec(base);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return '';
}

/** 数据目录里最早那个文件的修改时间 */
async function dataEarliest(app: any): Promise<string> {
  const dir = String(storageDir() || '').trim();
  const listed = await listDir(app, dir);
  if (!listed) return '';
  let best = 0;
  for (const p of listed.files) {
    try {
      const st = await app.vault.adapter.stat(p);
      const ms = Number(st?.mtime) || 0;
      if (ms > 0 && (!best || ms < best)) best = ms;
    } catch {
      // 单个文件 stat 不到就跳过：一个坏文件不该让整次考古失败
    }
  }
  return best ? dayOf(best) : '';
}

/** 日记目录里最早那一篇 */
async function diaryEarliest(app: any): Promise<string> {
  const s = tryGetSettings() as { diaryDirectory?: string };
  const dir = String(s?.diaryDirectory || '').trim().replace(/\/+$/, '');
  // 留空时跟随 Obsidian 自己的日记位置，那个路径要问别的插件，这里不去猜
  if (!dir) return '';
  const listed = await listDir(app, dir);
  if (!listed) return '';
  let best = '';
  for (const p of listed.files) {
    const d = dayFromName(p);
    if (!d) continue;
    if (!best || d < best) best = d;
  }
  return best;
}

/**
 * 考古入口。任何一步失败都只是「这次没查到」，不抛错、不影响插件启动。
 * 新装用户通常返回 ''，服务端会拿 `firstSeen` 兜底，结果等价于「今天开始」。
 */
export async function probeSince(app: any = getApp(), now = Date.now()): Promise<SinceHint> {
  const today = localDayKey(now);
  let diary = '';
  let data = '';
  try {
    [diary, data] = await Promise.all([diaryEarliest(app), dataEarliest(app)]);
  } catch {
    return { day: '', source: 'none' };
  }
  const diaryDay = clampSince(diary, today);
  const dataDay = clampSince(data, today);
  if (diaryDay && (!dataDay || diaryDay <= dataDay)) return { day: diaryDay, source: 'diary' };
  if (dataDay) return { day: dataDay, source: 'data' };
  return { day: '', source: 'none' };
}

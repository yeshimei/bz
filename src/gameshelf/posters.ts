/**
 * 游戏库媒体本地化（issue 368 增补；2026-09-17 扩到图标 + 回写本地路径；
 * 2026-09-18 扩到商店截图；2026-09-22 **成就图标不再本地化**——只留封面 / 库内图标 / 截图，
 * 成就图标改「远端直取、不落盘」，见 ADR-0176）。
 *
 * 落在这个文件夹（设置键 gameshelfPosterFolder；空 = Obsidian 附件位置 → <游戏目录>/assets）的三类图：
 * - `<appid>.jpg`            封面 header.jpg
 * - `<appid>-icon.jpg`       库内小图标
 * - `<appid>-shot-<n>.jpg`   商店截图（第 n 张，1 基）
 *
 * **封面兜底链**（2026-11-02 用户点版）：header.jpg 有的 appid 根本没有（新上架 / 下架 / 只发过
 * 截图的小品），卡片就只剩首字占位。落不到 header 时按 `header → capsule_616x353 → 第一张商店
 * 截图 → library_hero` **四跳**往下走，落到的那张**存成同一个 `<appid>.jpg`**——下游（notes 的
 * `封面`、coverDisplayUrl、原地重绘）一条路径不用改，`needsWork` 也自然「有文件 = 齐了」。
 * 只在**确实没有**（HTTP 404）时跳下一跳：超时/重置等网络失败原样留给下次，否则一次断网就把
 * 那款的封面永久钉在胶囊图/截图上。
 * 四跳**全** 404 = 远端确实一张都没有 → 落 `封面缺`（判缺时刻 ISO），30 天内不再为这款重跑
 * 整条链。没有这条记录时，这类 appid 每次开面板都要白打三四个 404，而且结论没有去处——
 * 下次打开还得从头试一遍（本机库里那两款就是）。
 *
 * 为什么成就图标不走这条路（ADR-0176 的判据）：它是**按成就条目逐条生成**的，且每个成就两色
 * （彩色 + 灰图）——实测 147 款库累积出 8,118 个文件，是封面 / 库内图标 / 截图三类合计
 * （约 1,400 个）的近六倍。文件数正是 Obsidian 每次启动都要遍历的量，所以它改成界面直取
 * Steam 的远端 URL（ui.ts::achListHtml），一个本地文件都不产生。判据是**是否随条目数膨胀**，
 * 不是「是不是图标」——库内小图标是每款一张的固定量，照本地化。
 *
 * frontmatter 键的分工（这是本模块的核心约定，别在别处另立一套）：
 * - `封面源` / `图标源` / `截图源` = Steam 远端地址，**同步管辖**（随库刷新，hash 变了能跟上）；
 * - `封面` / `图标` / `截图`       = 本地图片的 vault 路径，**由本模块写**，同步绝不碰
 *   （否则每次同步都把本地路径冲回远端）。`截图源` 与 `截图` **同序同长**，下载失败位留空串。
 *
 * CDN 实测直连可达（不走代理）。两条队列各自串行：封面 / 库内图标一条（要「立刻可看」），
 * 截图另一条（量大，逐条之间留间隔，别拿几百张图去冲 Steam CDN）。
 */
import type { App, TFile } from 'obsidian';
import { requestUrl } from 'obsidian';
import { withTimeout } from '../core/http';
import { tryGetSettings } from '../core/settings-provider';
import { resolveAssetDir, domainAssetsDir } from '../core/attachment-dir';
import { upsertDetail } from './notes';
import { M, type GameItem } from './state';
import { steamCapsuleUrl, steamCoverUrl, steamHeroUrl } from './steam';
import { GS_FM } from './constants';

/**
 * 单张媒体下载超时（深审 F8）：对照本域 steam 通道 withTimeout(…, 20s)。此前裸 requestUrl，
 * 网络劣化时一张挂起图让串行队列整体停摆到传输层自身超时——几百张截图排队时尤其致命。
 * 超时仅弃结果（requestUrl 无中止能力，core/http 同款语义），失败位走原有兜底。
 */
const MEDIA_DOWNLOAD_TIMEOUT_MS = 20_000;

/** 海报文件夹解析：显式配置优先 → Obsidian 附件位置 → <游戏目录>/assets（core/attachment-dir 单源）。
 *  三跳全空（游戏目录还没配）= 空串：调用方据此不下载、不写盘，绝不落库根。 */
export function resolvePosterFolder(): string {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    return resolveAssetDir(s.gameshelfPosterFolder, domainAssetsDir(s.gameshelfFolderPath)).dir;
  } catch {
    return '';
  }
}

/** 本地媒体路径（vault 相对）。目录为空 = 还没定位置 → 空串，绝不拼成 `/123.jpg` 那种库根路径：
 *  这类字符串一旦流到 getAbstractFileByPath / writeBinary，就是往 vault 根堆文件。 */
function mediaPath(name: string): string {
  const dir = resolvePosterFolder();
  return dir ? `${dir}/${name}` : '';
}

/** 本地封面路径（写进 frontmatter `封面` 的就是它） */
export function localCoverPath(appid: number): string {
  return mediaPath(`${appid}.jpg`);
}

/** 本地图标路径（与封面同文件夹，`-icon` 后缀区分） */
export function localIconPath(appid: number): string {
  return mediaPath(`${appid}-icon.jpg`);
}

/** 值是不是远端地址（不是 → 当本地 vault 路径看待） */
function isRemote(v: string | null | undefined): boolean {
  return !!v && /^https?:\/\//i.test(v);
}

/** 本地文件是否存在 */
function hasFile(app: App, path: string): boolean {
  try {
    return app.vault.getAbstractFileByPath(path) !== null;
  } catch {
    return false;
  }
}

/** vault 文件 → 可显示的 resource URL（拿不到 → ''） */
function resourceUrl(app: App, path: string): string {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) return '';
  try {
    return app.vault.getResourcePath(f as never);
  } catch {
    return '';
  }
}

/**
 * 封面显示 URL：本地文件 → resource URL；否则用属性里的远端值；再否则回落 CDN 直拼。
 * （四种状态都兜得住，UI 侧只管调这一个函数。）
 */
export function coverDisplayUrl(app: App, appid: number, value: string | null, src?: string | null): string {
  const local = resourceUrl(app, localCoverPath(appid));
  if (local) return local;
  if (isRemote(value)) return value as string;
  if (isRemote(src)) return src as string;
  return steamCoverUrl(appid);
}

/** 图标显示 URL（无本地文件且属性里也没有远端值 → ''，UI 不渲染图标） */
export function iconDisplayUrl(app: App, appid: number, value: string | null, src?: string | null): string {
  const local = resourceUrl(app, localIconPath(appid));
  if (local) return local;
  if (isRemote(value)) return value as string;
  return isRemote(src) ? (src as string) : '';
}

/** 队列条目（appid + 属性现状 + 远端源；file 为 null 时只显示不落盘——测试场景） */
export interface MediaItem {
  appid: number;
  /** frontmatter `封面` 现值（本地路径或远端） */
  cover: string | null;
  /** frontmatter `封面源`（远端；缺省用 CDN 直拼兜底） */
  coverSrc?: string | null;
  /** frontmatter `图标` 现值 */
  icon?: string | null;
  /** frontmatter `图标源`（远端；没有就跳过图标） */
  iconSrc?: string | null;
  /** frontmatter `封面缺`（判缺时刻 ISO；30 天内不再重跑兜底链） */
  coverMissing?: string | null;
  file: TFile | null;
}

/** GameItem[] → 队列条目（ui / index 两处调用共用，别再各拼一遍字段） */
export function mediaItemsOf(items: GameItem[]): MediaItem[] {
  return items.map((it) => ({
    appid: it.appid,
    cover: it.cover,
    coverSrc: it.coverSrc,
    icon: it.icon,
    iconSrc: it.iconSrc,
    coverMissing: it.coverMissing ?? null,
    file: it.file,
  }));
}

interface QueueJob {
  app: App;
  item: MediaItem;
}
const queue: QueueJob[] = [];
const pending = new Set<number>();
/**
 * 「封面还在等第一张截图」的 appid（2026-11-02）：header 与胶囊图都 404，剩下的素材只有商店截图，
 * 而截图比封面慢一拍（商店资料在回填队列里）。记账后由 ensureShots 在截图落地时补拷封面——
 * 否则这一款要等下次开面板才补得上，用户盯着那两张占位卡看不到任何变化。
 * 会话级即可：真错过了，下一轮 ensurePosters 还会重算。
 */
const coverFallbackPending = new Set<number>();
let running = false;
let rerenderTimer: ReturnType<typeof setTimeout> | null = null;

/** 「判缺」结论的有效期：Steam 偶尔后补素材，过了这段时间再试一次 */
const COVER_MISSING_TTL_MS = 30 * 24 * 3600 * 1000;

/** 这款是不是刚被判过「远端确实没有封面」（窗口内不再重跑兜底链） */
function coverGaveUp(it: MediaItem, now = Date.now()): boolean {
  if (!it.coverMissing) return false;
  const at = Date.parse(it.coverMissing);
  return Number.isFinite(at) && now - at < COVER_MISSING_TTL_MS;
}

/** 该条目还有没有活要干（本地文件齐 + 属性已指本地 → 无事可做，别排队） */
function needsWork(app: App, it: MediaItem): boolean {
  const cover = localCoverPath(it.appid);
  if (hasFile(app, cover)) {
    if (it.cover !== cover) return true; // 文件在、属性没指过来 → 还差一次回写
  } else if (!coverGaveUp(it)) {
    // 没封面文件：刚判过缺（30 天内）就不再试——否则每次开面板都为它白打三四个 404
    return true;
  }
  if (isRemote(it.iconSrc)) {
    const icon = localIconPath(it.appid);
    if (!hasFile(app, icon)) return true;
    if (it.icon !== icon) return true;
  }
  return false;
}

/** 把缺本地媒体的条目入队（幂等；调用方为同步完成 / 面板打开） */
export function ensurePosters(app: App, items: MediaItem[]): void {
  const folder = resolvePosterFolder();
  // 没有可用目录（游戏目录还没配）：整套媒体下载都不启动
  if (!folder) return;
  if (!app.vault.getAbstractFileByPath(folder)) {
    try {
      void app.vault.createFolder(folder);
    } catch {
      /* 并发建目录：已存在即忽略 */
    }
  }
  let added = 0;
  for (const it of items) {
    if (pending.has(it.appid)) continue;
    if (!needsWork(app, it)) continue;
    pending.add(it.appid);
    queue.push({ app, item: it });
    added += 1;
  }
  if (added > 0 && !running) void runQueue();
}

/**
 * 下载结果三态（封面兜底链要据此分流，别再退化成 boolean）：
 * - `ok`      落地了；
 * - `missing` 远端明确说没有（404）——**只有这种才该试下一跳**；
 * - `fail`    超时 / 网络错 / 5xx / 403 等：图可能还在，下次再来，不往下兜。
 */
type DownloadOutcome = 'ok' | 'missing' | 'fail';

/** 下载到 vault（成功 ok；404 = missing；其余失败 fail） */
async function download(app: App, path: string, url: string): Promise<DownloadOutcome> {
  try {
    const resp = await withTimeout(
      requestUrl({ url, method: 'GET', throw: false }),
      MEDIA_DOWNLOAD_TIMEOUT_MS,
      url,
    );
    // obsidian 的 RequestUrlResponse.arrayBuffer 是属性（非方法）；mock 环境缺省 undefined
    const buf = (resp as { arrayBuffer?: ArrayBuffer }).arrayBuffer;
    if (resp.status >= 200 && resp.status < 300 && buf) {
      if (!app.vault.getAbstractFileByPath(path)) await app.vault.adapter.writeBinary(path, buf);
      return 'ok';
    }
    // 403 不算 missing：CDN / 代理侧拒绝也报这个码，跳过它会把封面误钉在兜底图上
    if (resp.status === 404) return 'missing';
  } catch (e) {
    console.warn('bz 游戏库：媒体下载失败:', url, e);
  }
  return 'fail';
}

/** 本地已有文件 → 复制一份当封面（第一张截图通常在回填时早下好了，不必再走网络） */
async function copyAsCover(app: App, from: string, to: string): Promise<boolean> {
  try {
    const buf = await app.vault.adapter.readBinary(from);
    if (!buf || !buf.byteLength) return false;
    await app.vault.adapter.writeBinary(to, buf);
    return true;
  } catch (e) {
    console.warn('bz 游戏库：封面复制失败:', from, e);
    return false;
  }
}

/**
 * 封面兜底链的结果。
 * - `ok`   ：落到一张了（写进同一个 `<appid>.jpg`）；
 * - `absent`：**远端确实一张都没有**（四跳全 404）→ 调用方落「封面缺」，30 天内不再试；
 * - 其余失败（超时 / 网络错 / 写盘失败）：`ok=false, absent=false`，原样留到下次。
 */
interface CoverOutcome {
  ok: boolean;
  absent: boolean;
}

const FELL_BACK: CoverOutcome = { ok: true, absent: false };
const GAVE_UP: CoverOutcome = { ok: false, absent: true };
const RETRY_LATER: CoverOutcome = { ok: false, absent: false };

/**
 * 封面四跳兜底（写进同一个 `<appid>.jpg`）：header → 胶囊图 → 第一张商店截图 → 库内主视觉。
 * 前面几跳远端都没有（404）才继续；网络失败就地收工，等下一次队列。
 */
async function fetchCover(app: App, item: MediaItem, path: string): Promise<CoverOutcome> {
  const first = await download(app, path, item.coverSrc || steamCoverUrl(item.appid));
  if (first === 'ok') return FELL_BACK;
  if (first !== 'missing') return RETRY_LATER;
  // 第二跳：capsule_616x353 是同款封面图，比例（1.75）比 16:9 的截图更贴卡片的 460/215
  const capsule = await download(app, path, steamCapsuleUrl(item.appid));
  if (capsule === 'ok') return FELL_BACK;
  if (capsule !== 'missing') return RETRY_LATER;
  // 两跳都 404 = 这款的 `steam/apps/<id>/` 常规封面图确实没有。记一笔：截图比它晚到
  //（商店资料在回填队列里、比本队列慢），落地时由 ensureShots 顺手补上，不用再等下一次开面板。
  coverFallbackPending.add(item.appid);
  // 第三跳：第一张商店截图。截图队列通常早把它下好了（`<appid>-shot-1.jpg`），直接拷一份当封面，
  // 零网络；还没下到就先空手回去，等截图落地（见上面的记账）。
  const shot = localShotPath(item.appid, 0);
  if (hasFile(app, shot)) {
    if (!(await copyAsCover(app, shot, path))) return RETRY_LATER; // 复制失败是写盘问题，不是「没有」
    coverFallbackPending.delete(item.appid);
    return FELL_BACK;
  }
  // 第四跳：库内主视觉（3862670 这类未上架/极少素材的 app 只剩这张，比例 3.1:1，卡片里左右各裁一截）
  const hero = await download(app, path, steamHeroUrl(item.appid));
  if (hero === 'ok') {
    coverFallbackPending.delete(item.appid);
    return FELL_BACK;
  }
  // 只有四跳都拿到「远端说没有」才算判缺；网络问题（retry later）不落结论
  return hero === 'missing' ? GAVE_UP : RETRY_LATER;
}

async function runQueue(): Promise<void> {
  running = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    const { app, item } = job;
    try {
      const wrote: Record<string, unknown> = {};
      // 封面：本地文件优先；没有则走兜底链（header → 胶囊图 → 截图 → 主视觉，见 fetchCover）
      const coverPath = localCoverPath(item.appid);
      if (hasFile(app, coverPath)) {
        if (item.cover !== coverPath) wrote[GS_FM.cover] = coverPath;
      } else {
        const res = await fetchCover(app, item, coverPath);
        if (res.ok) {
          wrote[GS_FM.cover] = coverPath;
          // 之前判过缺（后来 Steam 补了素材）：把结论撤掉，别让笔记挂着一条假记录
          if (item.coverMissing) wrote[GS_FM.coverMissing] = null;
        } else if (res.absent && item.file) {
          // 远端确实没有 → 落一条带日期的结论，30 天内不再为它重跑兜底链
          //（否则每次开面板都白打三四个 404，而结论从来没有去处）
          const at = new Date().toISOString();
          item.coverMissing = at;
          wrote[GS_FM.coverMissing] = at;
        }
      }
      // 图标：只认「图标源」（hash 拼不出，没源就跳过——下次同步会补上）
      if (isRemote(item.iconSrc)) {
        const iconPath = localIconPath(item.appid);
        if (hasFile(app, iconPath)) {
          if (item.icon !== iconPath) wrote[GS_FM.icon] = iconPath;
        } else if ((await download(app, iconPath, item.iconSrc as string)) === 'ok') {
          wrote[GS_FM.icon] = iconPath;
        }
      }
      if (Object.keys(wrote).length > 0) {
        // 内存态先跟上（本会话立刻显示本地图），再落盘（同步不碰这两个键，故只写一次）
        const coverWrote = wrote[GS_FM.cover];
        if (typeof coverWrote === 'string') item.cover = coverWrote;
        if (typeof wrote[GS_FM.icon] === 'string') item.icon = wrote[GS_FM.icon] as string;
        if (item.file) {
          try {
            await upsertDetail(app, item.file, wrote);
          } catch (e) {
            console.warn('bz 游戏库：媒体路径写回失败:', item.appid, e);
          }
        }
        scheduleRerender();
      }
    } finally {
      pending.delete(item.appid);
    }
  }
  running = false;
}

/* ---------- 商店截图 ---------- */

/** 本地截图路径（与「截图源」同序，index 0 基 → 文件名 1 基） */
export function localShotPath(appid: number, index: number): string {
  return mediaPath(`${appid}-shot-${index + 1}.jpg`);
}

/**
 * 截图展示 URL（本地优先、远端兜底）：本地文件在 → resource URL；本地缺 → 该位的远端源。
 * 两数组同序同长（detail.ts::fmToShots 保证），空位跳过。
 */
export function resolveShotUrls(app: App, local: string[], remote: string[]): string[] {
  const n = Math.max(local.length, remote.length);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const localPath = local[i] ?? '';
    const localUrl = localPath ? resourceUrl(app, localPath) : '';
    if (localUrl) out.push(localUrl);
    else if (isRemote(remote[i])) out.push(remote[i] as string);
  }
  return out;
}

/** 截图下载任务（整组一起下完再写 `截图`——数组是整体的，分次写会留半截状态） */
export interface ShotJob {
  appid: number;
  file: TFile | null;
  /** `截图源` 远端地址（与 album 同序） */
  remote: string[];
  /** 当前的 `截图` 值（相同则不写盘，避免无谓的 frontmatter 重写） */
  prevLocal: string[];
}

/** 第二条队列（截图）。任务间留间隔，别拿几百张图去冲 Steam CDN */
const MEDIA_INTERVAL_MS = 120;
let mediaIntervalMs = MEDIA_INTERVAL_MS;
/** 测试用：把队列间隔归零（生产恒 120ms，见 MEDIA_INTERVAL_MS） */
export function setMediaInterval(ms: number): void {
  mediaIntervalMs = ms;
}
const mediaTasks: Array<() => Promise<void>> = [];
const mediaQueued = new Set<string>();
let mediaRunning = false;

/** 截图入队（缺哪张下哪张；下完把整组路径写回 `截图`，失败位留空串保对齐） */
export function ensureShots(app: App, job: ShotJob): void {
  if (job.remote.length === 0) return;
  const key = `s:${job.appid}`;
  if (mediaQueued.has(key)) return;
  mediaQueued.add(key);
  mediaTasks.push(async () => {
    try {
      const paths: string[] = [];
      let downloaded = 0;
      for (let i = 0; i < job.remote.length; i += 1) {
        const path = localShotPath(job.appid, i);
        if (hasFile(app, path)) {
          paths.push(path);
          continue;
        }
        if ((await download(app, path, job.remote[i])) === 'ok') {
          paths.push(path);
          downloaded += 1;
        } else {
          paths.push(''); // 失败留空位：两数组靠下标对齐，不能压缩
        }
      }
      const wanted = job.prevLocal.concat(Array(Math.max(0, job.remote.length - job.prevLocal.length)).fill(''));
      const same = wanted.length === paths.length && wanted.every((v, i) => v === paths[i]);
      // 封面还在等截图（见 coverFallbackPending）：第一张一到就顺手拷成封面，同一次写盘写两个键，
      // 这样「这款没有 header」的那几款，本次开面板内就能看到封面，而不是等下一轮。
      const coverPath = localCoverPath(job.appid);
      let coverFixed = false;
      if (job.file && coverFallbackPending.has(job.appid) && paths[0] && !hasFile(app, coverPath)) {
        coverFixed = await copyAsCover(app, paths[0], coverPath);
        if (coverFixed) coverFallbackPending.delete(job.appid);
      }
      if (job.file && (downloaded > 0 || !same || coverFixed)) {
        try {
          const fields: Record<string, unknown> = { [GS_FM.shots]: paths };
          if (coverFixed) fields[GS_FM.cover] = coverPath;
          await upsertDetail(app, job.file, fields);
          scheduleRerender();
        } catch (e) {
          console.warn('bz 游戏库：截图路径写回失败:', job.appid, e);
        }
      }
    } finally {
      mediaQueued.delete(key);
    }
  });
  void pumpMedia();
}

async function pumpMedia(): Promise<void> {
  if (mediaRunning) return;
  mediaRunning = true;
  while (mediaTasks.length > 0) {
    const task = mediaTasks.shift()!;
    try {
      await task();
    } catch (e) {
      console.warn('bz 游戏库：媒体任务异常:', e);
    }
    if (mediaTasks.length > 0) await new Promise((r) => setTimeout(r, mediaIntervalMs));
  }
  mediaRunning = false;
}

/**
 * 逐条完成后节流重绘（1.5s 尾沿；面板关着钩子为空，空转无害）。
 *
 * 走 `repaintFn`（原地重绘）而不是 `renderFn`（整面板整刷）：封面是一整个库逐款下完的，
 * 整刷会把工具行、门面、整片网格连同所有 img 元素一起换掉，下图期间界面看起来就是
 * 「一直在闪」——2026-11-01 用户反馈的主界面屏闪就是这个。原地重绘做不到的场合
 *（统计页 / 按名称排 / 搜索中）它返回 false，这里回落整刷。
 * 截图下载与游戏墙无关（只有详情弹窗里看得见），所以只叫弹窗那一声。
 */
function scheduleRerender(): void {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    if (!M.repaintFn?.()) M.renderFn?.();
    M.modalRepaintFn?.(); // 详情弹窗不在面板树里，得单独叫一声
  }, 1500);
}

/** 卸载收口：清两条队列与节流计时器（在途请求随响应自然落地，不阻塞卸载） */
export function unloadPosters(): void {
  queue.length = 0;
  pending.clear();
  mediaTasks.length = 0;
  mediaQueued.clear();
  if (rerenderTimer) {
    clearTimeout(rerenderTimer);
    rerenderTimer = null;
  }
}

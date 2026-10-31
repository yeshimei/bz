/* ============================================================
 * bz · 远端单文件资产下载（core/remote-asset.ts，单源）
 *
 * 使用手册（core/manual.ts）、更新日志（core/changelog.ts）与下载清单
 * （core/download-manifest.ts）都走这一层：资产不随插件构建分发
 * （main.js 里不含它们），而是发布在 GitHub 仓库 downloads/ 目录下，
 * 写入**插件安装目录的 downloads/ 单独目录**（<configDir>/plugins/bz/downloads/，
 * issue 480b 拍板：全部下载资源一个目录，不散落插件目录根）。
 *
 * 为什么放插件目录而不是数据目录：这些是程序资产、跟版本走，
 * 放数据目录会跟「数据存储路径」这个用户键纠缠。
 *
 * 下载链路：GitHub Release 主（tag 已知时）→ jsDelivr 备；全链失败才报错。
 *
 * 双源基址的唯一事实源见 core/remote-base.ts（REPO_BASES / downloadRemotesFor）——
 * 本层 `remotesFor` 仅作转发，不在此重述域名。
 *
 * 路径口径（ADR-0203 / issue 480b）：`fileName` 是**相对 `downloads/` 的路径**
 * （可为多级，如 `skins/bookshelf/noir.css`）；本地落盘是插件安装目录 downloads/
 * 内的同名路径——本地 downloads/ 即远端 downloads/ 的逐字镜像。
 * 仓库旧 `manual/` 目录是改名前的冻结过渡副本（旧版插件还在读它，内容停更，
 * 若干版本后删除）。旧落位（插件目录根的文档、plugins/bz/skins/ 的皮肤）由
 * skin-pack 做一次性惰性清扫，插件自身 manifest.json 不经本口径（版本区间校验直读）。
 *
 * 三条口径：`ensureAssetReady` 管「有没有」——无则下载、有则直接用；
 * `refreshAsset` 管「新不新」——入口先本地秒开，再后台核对一次，远端真变了才覆盖；
 * `ensureAssetWithHash` 管「信不信」——下载内容 sha256 对不上清单声明就拒收。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { textSha256 } from './sha256';
import { emitDomainEvent } from './domain-bus';
import { downloadRemotesFor, isValidTag, releaseDownloadUrl } from './remote-base';
import { pluginVaultPath } from './plugin-path';
import { readOfflineText } from './offline-source';

/** 下载资源落盘事件（issue 492）：派发收口在 writeAssetText（所有下载资产唯一落盘口），
 *  消费 = 设置面板在线资源组把已渲染行态同步成磁盘事实（导航入口更新文档后组内按钮翻「已下载」）。 */
export const DOWNLOADS_CHANGED_EVENT = 'downloads:asset-changed';

/** 远端 URL：master 快照的通道链（jsDelivr 各边缘；唯一事实源见 core/remote-base.ts）。
 *  导出与签名不变（测试在用）；函数体直接转发 downloadRemotesFor。
 *
 *  顺序按「上次谁成功过」动态排（`rankRemotes`）：一条卡死的通道不该永远占着队首。 */
export function remotesFor(fileName: string): string[] {
  return rankRemotes(downloadRemotesFor(fileName));
}

/* ---------- 通道超时与健康排序（2026-10-28 报障：清单永远「没拉到」） ----------
 *
 * 此前这里是「串行 await requestUrl」，没有任何单通道超时。raw 一旦卡住（被墙时常见的
 * 是 TCP 连上但不回），要等 Chromium 自己的超时（十几秒到几十秒），而调用方
 * `fetchManifestWithTimeout` 只等 12 s —— 一条通道卡住，后面三条能用的根本没被试到，
 * 界面就报「资源清单没拉到」。两个改法：
 *
 *  1. **单通道 8 s 封顶**：超过就算这条不可用，换下一条；
 *  2. **成功的通道排到队首**（会话内记忆）：第二次请求直接走已知能用的那条。
 */
const CHANNEL_TIMEOUT_MS = 8000;

/* 正文下载时限（2026-10-30 实测补）：8 s 那条是给**清单**这种几 KB 的小文件定的。
 * 正文完全不是一回事——国内直连 jsDelivr 边缘实测约 40~110 KB/s：
 * 手册 154 KB / 2.6 s 没问题，但「豆瓣影视索引」5.5 MB 要 **51 s**、main.js 2.8 MB 要 18~48 s。
 * 用 8 s 给正文封顶，结果是「自动更新开了也永远下不完」，面板却说有新版。
 * 所以正文按体积估时限（40 KB/s 下限，封顶 3 分钟）：知道体积就按体积算，
 * 不知道体积就退回 8 s（保持小文件的快速失败）。 */
const CONTENT_TIMEOUT_MIN_MS = CHANNEL_TIMEOUT_MS;
const CONTENT_TIMEOUT_CAP_MS = 180_000;
const CONTENT_BYTES_PER_SEC = 40 * 1024;

/** 正文下载的单通道时限：体积已知按体积估，未知退回 8 s */
function contentTimeoutFor(sizeBytes?: number): number {
  const size = Number(sizeBytes) || 0;
  if (size <= 0) return CHANNEL_TIMEOUT_MS;
  const ms = Math.round((size / CONTENT_BYTES_PER_SEC) * 1000);
  return Math.min(CONTENT_TIMEOUT_CAP_MS, Math.max(CONTENT_TIMEOUT_MIN_MS, ms));
}

/** 最近一次成功拿到内容的通道基址（空 = 还不知道） */
let preferredBase = '';

/** URL 去掉 `/downloads/...` 之后的基址（master 与 tag 两条口径都适用） */
function baseOfUrl(url: string): string {
  return url.replace(/\/downloads\/.*$/, '');
}

/** 主机名（错误消息里只说主机，不糊一长串 URL） */
function hostOf(url: string): string {
  const m = /^https?:\/\/([^/]+)/.exec(url);
  return m ? m[1] : url;
}

/** 把「上次成功过的通道」提到最前；没记忆就原样返回 */
function rankRemotes(urls: string[]): string[] {
  if (!preferredBase) return urls;
  const front = urls.filter((u) => u.startsWith(preferredBase));
  return front.length ? [...front, ...urls.filter((u) => !u.startsWith(preferredBase))] : urls;
}

/** 测试用：清掉通道记忆（跨用例不该互相影响） */
export function resetChannelPreferenceForTests(): void {
  preferredBase = '';
}

/* ---------- GitHub Release 通道（2026-10-31 新增，见 remote-base.releaseDownloadUrl） ----------
 *
 * 通道链 = Release 资产（tag 已知时）在前，jsDelivr 在后兜底（raw 已退场）。tag 从
 * 发布指针解析（self-update 拉指针后回填；这里只读缓存不发网络），localStorage 缓存
 * 24h——指针只有 46 字节，但每次下载都先拉一遍指针没必要，tag 在两次发布之间不会变。
 *
 * 失败语义：tag 拿不到 → 通道链退化为纯 jsDelivr，**不会**让任何原本能成功的下载
 * 变成失败。
 */

/** release tag 缓存键与 TTL（与自更新巡检同期） */
const RELEASE_TAG_KEY = 'bz-remote:release-tag';
const RELEASE_TAG_TTL_MS = 24 * 3600 * 1000;

/** 会话内记忆（省 localStorage 解析；模块级，测试可重置） */
let releaseTagMemo = '';

function readCachedReleaseTag(): string {
  if (releaseTagMemo) return releaseTagMemo;
  try {
    const raw = localStorage.getItem(RELEASE_TAG_KEY);
    if (!raw) return '';
    const o = JSON.parse(raw) as { tag?: unknown; at?: unknown };
    const tag = String(o?.tag || '');
    const at = Number(o?.at || 0);
    if (!isValidTag(tag) || !at || Date.now() - at > RELEASE_TAG_TTL_MS) return '';
    releaseTagMemo = tag;
    return tag;
  } catch {
    return '';
  }
}

/** 回填 release tag（self-update 拉到指针后调用；tag 不合法则忽略） */
export function noteReleaseTag(tag: string): void {
  const t = String(tag || '');
  if (!isValidTag(t)) return;
  releaseTagMemo = t;
  try {
    localStorage.setItem(RELEASE_TAG_KEY, JSON.stringify({ tag: t, at: Date.now() }));
  } catch {
    /* 隐私模式/配额满：会话内记忆仍有效 */
  }
}

/** 测试用：清掉 release tag 记忆 */
export function resetReleaseTagForTests(): void {
  releaseTagMemo = '';
  try {
    localStorage.removeItem(RELEASE_TAG_KEY);
  } catch {
    /* 同上 */
  }
}

/**
 * 惰性解析当前发布 tag：**只读缓存，不发网络**（self-update 每次拉到发布指针后经
 * noteReleaseTag 回填，TTL 24h）。这里刻意不做「拉不到指针就自己拉一遍」——
 * 那会让每次资源下载多出一跳网络、失败语义膨胀，且单测环境会打真网。
 * 缓存没有/过期 → 返回空串，通道链退化为纯 jsDelivr，行为可预期。
 */
export async function ensureReleaseTag(): Promise<string> {
  return readCachedReleaseTag();
}

/** 完整通道链：Release 资产（tag 已知时）在前 + jsDelivr（含镜像）在后 */
export async function remotesForWithRelease(fileName: string): Promise<string[]> {
  return channelUrls(fileName);
}

async function channelUrls(fileName: string, opts: { releasePath?: string } = {}): Promise<string[]> {
  const tag = await ensureReleaseTag();
  const rel = opts.releasePath ?? `downloads/${fileName}`;
  const release = releaseDownloadUrl(tag, rel);
  return [...(release ? [release] : []), ...remotesFor(fileName)];
}

/**
 * 单通道取文本（8 s 封顶，非 2xx 抛人话）。
 *
 * `throw: false` 而不是 `throw: true`：jsDelivr 的 403 正文写着原因
 * （「Package size exceeded the configured limit of 50 MB」——本仓库 284 MB 已超限，
 * 未缓存的文件一律被拒）。用 throw:true 只能拿到一句 `status 403`，把「通道拒绝分发」
 * 误读成「网络不通」，排查方向整个跑偏。
 */
async function requestText(url: string, timeoutMs: number = CHANNEL_TIMEOUT_MS): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const req = requestUrl({ url, method: 'GET', throw: false });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`超时（${timeoutMs} ms 内没有响应）`)), timeoutMs);
    });
    const res = await Promise.race([req, timeout]);
    const text = String(res?.text || '');
    const status = Number(res?.status) || 0;
    if (status && (status < 200 || status >= 300)) {
      throw new Error(
        /Package size exceeded/i.test(text)
          ? 'HTTP 403 · 通道拒绝分发（仓库超过 50 MB，jsDelivr 已停发未缓存的文件）'
          : `HTTP ${status}`,
      );
    }
    preferredBase = baseOfUrl(url);
    return text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 一条通道的失败说明（主机 + 原因；原因里已经带了 HTTP 码的不重复糊 URL） */
function describeChannelError(url: string, e: unknown): string {
  return `${hostOf(url)} ${String((e as Error)?.message || e || '未知错误')}`;
}

/**
 * 并发取第一条通过校验的内容（清单这种小文件专用）。
 *
 * 为什么能并发：清单 9 KB，五份加起来不到 50 KB，代价可以忽略；而串行在「第一条卡住」
 * 时会把后面能用的通道全耽误掉。下载正文（手册、皮肤、目录包）仍走串行——那是 MB 级，
 * 五路并发既费流量又费带宽。
 */
function fetchConcurrently(
  urls: string[],
  validate: (text: string) => boolean,
  label: string,
  unit: string,
): Promise<string> {
  const errors: string[] = [];
  let settled = false;
  return new Promise<string>((resolve, reject) => {
    let left = urls.length;
    for (const url of urls) {
      requestText(url)
        .then((text) => {
          if (!validate(text)) throw new Error(`返回内容不是${label}${unit}`);
          if (!settled) {
            settled = true;
            resolve(text);
          }
        })
        .catch((e: unknown) => {
          errors.push(describeChannelError(url, e));
          if (--left === 0 && !settled) reject(new Error(`${label}下载失败：${errors.join('；')}`));
        });
    }
  });
}

/**
 * 资产在 vault 里的相对路径（插件安装目录内；仅插件自身 manifest.json 等非下载资源用）。
 *
 * 目录名不能写死 `bz`：用户手动装时文件夹可能叫任何名字（见 core/plugin-path 文件头）。
 * 写死会让「下载落位」和「读取位置」都错到一个不存在的目录，症状是下载成功但功能不可用。
 */
export function assetVaultPath(app: unknown, fileName: string): string {
  return pluginVaultPath(app, fileName);
}

/** 统一资源目录名（远端仓库 downloads/ ↔ 本地插件安装目录 downloads/，逐字镜像） */
export const DOWNLOADS_DIR = 'downloads';

/** 下载资源的本地路径 = <插件安装目录>/downloads/<fileName>（fileName 相对 downloads/） */
export function downloadsVaultPath(app: unknown, fileName: string): string {
  return assetVaultPath(app, `${DOWNLOADS_DIR}/${fileName}`);
}

/**
 * 建目录（**逐级**；失败静默）。
 * 逐级的理由：皮肤包落在 `skins/<域>/<id>.css`——`skins/` 在全新安装时并不存在，
 * 而 Obsidian `adapter.mkdir` 未文档化「递归建父级」，单次 `mkdir('skins/bookshelf')`
 * 在非递归实现下会直接失败 → write 失败 → 远端皮肤永久静默回落首套（功能全失效）。
 * 逐级 try/catch 幂等：目录已存在抛错也无所谓，最终由 write 决定成败。
 *
 * 导出给 core/bundle-asset（目录包解包时同一套建目录口径，别在下游再抄一遍）。
 *
 * **根目录必须单独建**（2026-10-28 新库报障）：`relPath` 没有斜杠时（`manifest.json`、
 * `bz-manual.html` 这些单文件资产），「父目录」就是 `downloads/` 本身，而下面按段建的
 * 循环只在有斜杠时进得去 —— 于是全新库里 `downloads/` 从来没被创建，`adapter.write`
 * 因父目录不存在直接失败，`refreshManifest` 抛错被引导页吞成「资源清单没拉到」。
 * Obsidian 的 `adapter.write` 不建父目录（`fs.writeFile` 语义），这一句不能省。
 */
export async function ensureDir(app: unknown, relPath: string): Promise<void> {
  const adapter = (app as { vault?: { adapter?: { mkdir?: (p: string) => Promise<void> } } }).vault?.adapter;
  if (!adapter?.mkdir) return;
  try {
    await adapter.mkdir(assetVaultPath(app, DOWNLOADS_DIR));
  } catch (e) {
    /* 已存在 / 不支持 mkdir → 继续建子级 */
  }
  const slash = relPath.lastIndexOf('/');
  if (slash <= 0) return;
  let cur = '';
  for (const part of relPath.slice(0, slash).split('/')) {
    cur = cur ? `${cur}/${part}` : part;
    try {
      await adapter.mkdir(downloadsVaultPath(app, cur));
    } catch (e) {
      /* 已存在 / 不支持 mkdir → 继续下一级 */
    }
  }
}

/** 取文本的可选开关 */
export interface FetchAssetOpts {
  /** 并发试通道（**只给清单这类 KB 级小文件用**；下载正文是 MB 级，并发既费流量又费带宽） */
  concurrent?: boolean;
  /** 给 URL 追加一次性破缓存参数（`?t=<时间戳>`）。
   *
   *  为什么需要（2026-10-31 报障）：jsDelivr 对 `@master` 的缓存是**逐 POP**的。`push-assets`
   *  purge 之后，清掉的是回源时打到的那台边缘，用户机器可能落在另一台还拿着旧副本的边缘上——
   *  清单里的 sha256 与已发布的包不是同一版，症状是「名字还是旧的、每一项下载都校验失败」，
   *  而且**再启动几次也不会自愈**（每次刷新都命中同一个旧边缘，还把旧清单写回本地缓存）。
   *  带上变化的时间戳等于换一个缓存键，强制回源。
   *
   *  只给清单用：它 9 KB，回源代价可忽略；正文资源带不带都一样（体积大，本来就难命中）。 */
  bust?: boolean;
}

/** 双源取文本（不落盘）；全失败抛人话错误
 *  @param unit 内容校验失败文案的后缀（手册/日志是「页」，皮肤包不是）
 *  @param app  给了就先看离线包（`<vault>/bz-offline/downloads/<file>`）；不给只走网络
 *  @param opts 见 FetchAssetOpts */
export async function fetchAssetText(
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
  unit = '页',
  app?: unknown,
  opts?: FetchAssetOpts,
): Promise<string> {
  // 离线包优先（同 ensureAssetWithHash 的理由）
  if (app) {
    try {
      const offline = await readOfflineText(app, `downloads/${fileName}`);
      if (offline !== null && validate(offline)) return offline;
    } catch {
      /* 走网络 */
    }
  }
  const raw = await channelUrls(fileName);
  // 破缓存参数（见 FetchAssetOpts.bust）：每个通道各加一个同一时刻的时间戳——
  // 同一轮请求用同一个值，既是新的缓存键，也不至于让同一份清单的几条通道各算一次代价。
  const stamp = opts?.bust ? Date.now() : 0;
  const urls = stamp ? raw.map((u) => `${u}${u.includes('?') ? '&' : '?'}t=${stamp}`) : raw;
  if (opts?.concurrent && urls.length > 1) return fetchConcurrently(urls, validate, label, unit);

  let lastErr = '';
  for (const url of urls) {
    try {
      const text = await requestText(url);
      if (!validate(text)) {
        lastErr = `${hostOf(url)} 返回内容不是${label}${unit}`;
        continue;
      }
      return text;
    } catch (e: unknown) {
      lastErr = describeChannelError(url, e);
    }
  }
  throw new Error(`${label}下载失败：${lastErr}`);
}

/** 写资产文本（自动建目录；覆盖旧版）；成功落盘后广播事件（消费方自行兜底，fire-and-forget） */
export async function writeAssetText(app: unknown, fileName: string, text: string): Promise<void> {
  await ensureDir(app, fileName);
  await (app as { vault?: { adapter?: { write?: (p: string, data: string) => Promise<void> } } })
    .vault!.adapter!.write!(downloadsVaultPath(app, fileName), text);
  emitDomainEvent(DOWNLOADS_CHANGED_EVENT, { fileName });
}

/**
 * 取资产文本并校验 sha256（皮肤包专用，ADR-0199）：
 * 本地已有且 hash 匹配 → 直接复用（**这就是「存在即跳过」升级后的增量判据**）；
 * 否则双源下载 → hash 不匹配视为该源不可信（换下一个源）→ 全失败抛错。
 * @param expected 期望的 64 位小写 sha256（对归一换行后的文本）
 */
export async function ensureAssetWithHash(
  app: unknown,
  fileName: string,
  expected: string,
  label: string,
  /** 体积（清单条目 size）：给了就按它放大单通道时限，避免大文件被 8 s 判死 */
  sizeBytes?: number,
): Promise<string | null> {
  const want = String(expected || '').toLowerCase();
  const cached = await readAsset(app, fileName);
  if (cached !== null && (!want || textSha256(cached) === want)) return cached;

  let lastErr = '';

  // 离线包优先（`<vault>/bz-offline/downloads/<file>`）：企业网 / 无外网时这是唯一的路。
  // hash 对不上就整份丢弃当没有——离线包也要过同一道校验，否则「本地文件」就成了免检通道。
  try {
    const offline = await readOfflineText(app, `downloads/${fileName}`);
    if (offline !== null) {
      if (!want || textSha256(offline) === want) {
        await writeAssetText(app, fileName, offline);
        return offline;
      }
      lastErr = 'bz-offline 里的副本 sha256 对不上（与清单不是同一版）';
    }
  } catch {
    /* 没有离线包：走网络 */
  }

  const timeoutMs = contentTimeoutFor(sizeBytes);
  for (const url of await channelUrls(fileName)) {
    try {
      const text = await requestText(url, timeoutMs);
      if (want && textSha256(text) !== want) {
        lastErr = `${hostOf(url)} 内容 sha256 不匹配（可能被篡改或版本错位）`;
        continue;
      }
      await writeAssetText(app, fileName, text);
      return text;
    } catch (e: unknown) {
      lastErr = describeChannelError(url, e);
    }
  }
  throw new Error(`${label}下载失败：${lastErr}`);
}

/** 资产是否已经下载到插件目录 */
export async function hasAsset(app: unknown, fileName: string): Promise<boolean> {
  try {
    return await (app as { vault?: { adapter?: { exists?: (p: string) => Promise<boolean> } } })
      .vault!.adapter!.exists!(downloadsVaultPath(app, fileName));
  } catch (e) {
    return false;
  }
}

/**
 * 从 GitHub 下载资产并写入插件安装目录（覆盖旧版）。
 * @param validate 内容可信判定（false = 该远端内容可疑，换下一个）
 * @param label    错误消息里的资产名（人话，如「手册」「更新日志」）
 * 全部远端失败/内容不可信 → 抛错（人话消息，含最后失败原因），调用方弹通知。
 */
export async function downloadAsset(
  app: unknown,
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
): Promise<void> {
  const text = await fetchAssetText(fileName, validate, label, '页', app);
  await writeAssetText(app, fileName, text);
}

/** 读已下载的资产文本；未下载/读失败 → null（调用方决定引导下载） */
export async function readAsset(app: unknown, fileName: string): Promise<string | null> {
  try {
    if (!(await hasAsset(app, fileName))) return null;
    return await (app as { vault?: { adapter?: { read?: (p: string) => Promise<string> } } })
      .vault!.adapter!.read!(downloadsVaultPath(app, fileName));
  } catch (e) {
    return null;
  }
}

/**
 * 确保资产在本地并返回文本（入口一键口径）：
 * 本地没有 → 从 GitHub 下载；然后读出文本交给弹窗层内嵌渲染。
 * 下载失败抛人话 Error；本地读取异常视同未下载走重下（自愈陈旧半截文件）。
 */
export async function ensureAssetReady(
  app: unknown,
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
): Promise<string> {
  let text = await readAsset(app, fileName);
  if (!text) {
    await downloadAsset(app, fileName, validate, label);
    text = await readAsset(app, fileName);
  }
  if (!text) throw new Error(`${label}下载后读取失败：插件目录写入异常`);
  return text;
}

/**
 * 新鲜度核对（issue 476）：远端内容与本地不同 → 覆盖落盘并返回新文本；否则 null。
 *
 * 与 `ensureAssetReady` 的分工：那个管**有没有**（无则下载），本函数管**新不新**
 * （有则核对）。入口口径 = 先 `ensureAssetReady` 本地秒开，再后台调本函数：
 * 远端推了新文档（重新生成 manual/*.html 并 push，插件版本没动）时，
 * 靠这一层才能发现——否则「存在即用」会让线上新版永远进不来。
 *
 * **全程静默**：同版 → null；离线 / 被墙 / 内容可疑 → null（保持本地已存版本，
 * 不给用户任何通知与转圈——它是后台动作，失败不是用户的操作失败）。
 *
 * 比对用 sha256 且先过 `normalizeEol`（`textSha256` 内建）：Windows 本地 CRLF
 * 与仓库 LF 不会被误判成新版而触发一次无意义的重写。
 *
 * `expectedSha256`（ADR-0203 省流增补）：调用方从缓存下载清单取该文件的清单 hash
 * 传入——本地内容与之相等即「清单确认无新版」，**直接返回 null 跳过远端拉取**
 * （手册 327KB 不必每次打开都白拉）。清单缺席（null/空串）回落全量拉取对比，行为只省不破。
 *
 * @returns 新版文本（调用方据此决定是否热替换已打开的弹窗）；同版或失败 → null
 */
export async function refreshAsset(
  app: unknown,
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
  expectedSha256?: string | null,
): Promise<string | null> {
  try {
    const want = String(expectedSha256 || '').toLowerCase();
    if (want) {
      const local = await readAsset(app, fileName);
      if (local !== null && textSha256(local) === want) return null;
    }
    const text = await fetchAssetText(fileName, validate, label, '页', app);
    const local = await readAsset(app, fileName);
    if (local !== null && textSha256(text) === textSha256(local)) return null;
    await writeAssetText(app, fileName, text);
    return text;
  } catch (e) {
    return null;
  }
}

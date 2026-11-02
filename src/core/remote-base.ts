/* ============================================================
 * bz · 仓库双源基址（core/remote-base.ts，零依赖叶子模块）
 *
 * 全仓**唯一事实源**——资源通道（remote-asset 的 downloads/ 资产）与插件
 * 自更新（self-update 的仓库根三件套）都从这里取双源地址，杜绝两处各写一份
 * 字面量导致漂移。
 *
 * 通道口径（2026-11-02 用户拍板，替换 10-31 的「Release 主 → jsDelivr 备」）：
 *  **GitHub Release 主 → 码云 Release 备**。
 *  - 主：`https://github.com/<REPO_SLUG>/releases/download/<tag>/<资产名>`；
 *  - 备：`https://gitee.com/<GITEE_SLUG>/releases/download/<tag>/<资产名>`。
 *
 * jsDelivr 为什么整条退场（2026-11-02 v1.39.2 实测）：
 *  `--re-purge` 跑了两轮、又按路径 / 按旧提交 SHA / 整包清了三次，purge 接口都回
 *  `CF:true FY:true`，四条边缘照旧发旧指针（fastly 8.3 小时前的 1.39.1、gcore 与
 *  testingcf 的 1.39.0，另有 POP 还在发已回撤的 1.40.0）。它的缓存不可控，而
 *  「用户点检查更新却拿到半个月前的版本」这种故障没有任何本地兜底手段。
 *  码云是 tag 冻结的 Release 资产，没有 `@master` 快照这层缓存；raw 也只有 60 秒。
 *
 * ---------- 两条分支：Release 资产 与 发布指针 ----------
 *
 * | 用途 | 形状 | 谁用 |
 * |---|---|---|
 * | 插件本体三件套 / 在线资源 | `releases/download/<tag>/<扁平资产名>` | 版本已知时 |
 * | 发布指针（有没有新版） | 见 self-update.fetchPointer 的三段链 | 版本未知时 |
 *
 * 指针与产物分离的理由：`version.json` 必须能在「还没决定装不装」的时候读到，它只能住在
 * 一个恒定可达的地方；而它指向的 tag 才是版本的真身。这样「检查更新」只花几百字节。
 *
 * **码云没有 `releases/latest/download/…` 这种免 tag 恒定位**（实测 `releases/latest`
 * 会 302 到源码包，不是资产），所以码云那条指针要两步：API `releases/latest` 拿 tag，
 * 再取该 tag 下的 `manifest.json`。细节见 self-update.fetchPointer。
 *
 * 以上资产全部住在**源码仓库** `REPO_SLUG` 的 Release 上。
 *
 * 分发仓 `yeshimei/bz-assets` 已退役（2026-11-02 用户拍板）：它是 10-28 为绕 jsDelivr
 * 的 50 MB 上限建的，jsDelivr 退场后新客户端对它零依赖（通道链只有 Release 与码云 raw，
 * 离线包直接打自主仓 `downloads/`，唯一指着它的 HTML 反代分支也没有 html 资产可服务）。
 * 仓库原地冻结、不再上传；旧版客户端（≤1.39.x）的 jsDelivr 备链里还有它，删了会让那批人
 * 连滞后的副本都拿不到。手动重建用 `scripts/push-assets.mjs`（已退出发布流程）。
 * ============================================================ */

/** 源码 / 反馈 / issue 的仓库 slug（`<owner>/<repo>`）。Release 资产挂在这里。 */
export const REPO_SLUG = 'yeshimei/bz';

/**
 * 码云镜像 slug（国内第二出口）。
 *
 * 为什么是它：GitHub Release 在国内裸网时通时不通，而码云是国内直连、tag 冻结、
 * 资产匿名可取（实测 3 MB 的 main.js ≈ 1 MB/s），且**没有 12 小时级的 CDN 快照缓存**。
 *
 * 为什么只用它的 Release、不用 raw master：raw 上的 `downloads/version.json` 在
 * 推代码那一刻就变成新版号，而 Release 资产要等发布流程走到最后才齐 —— 中间那段时间
 * 用户会「查到新版、下不下来」。Release 资产天然没有这个窗口（码云那边由 `push-gitee`
 * 在 GitHub 转正之后才建）。
 */
export const GITEE_SLUG = 'ntbl/bz';

/** 码云「最新 Release」的 API（免登录；限流 60 次/小时/IP，只在 GitHub 通道失败时才走）。
 *  返回体里的 `tag_name` 就是我们要的 tag —— 码云没有 latest 别名，只能这么拿。 */
export const GITEE_LATEST_API = `https://gitee.com/api/v5/repos/${GITEE_SLUG}/releases/latest`;

// 只读设置（type-only import 在 settings-provider 里已擦除，不会成环）。
// 静态导入而不是 require：vite/ESM 下没有 require，懒加载写法在测试与将来的构建形态里会静默失效。
import { tryGetSettings } from './settings-provider';

/**
 * 发布指针文件名（`{ "version": "1.34.0", "tag": "v1.34.0" }`）。
 *
 * 为什么不用 GitHub API 的 `releases/latest`：那个域名限流（未登录 60 次/小时，按 IP 算，
 * 同一出口的整个局域网共用）且国内常在超时名单里。GitHub 这边用**免 tag 的资产地址**
 * `releases/latest/download/downloads-manifest.json`（302 到当前最新发布，不需要 API）；
 * 码云那边没有这个别名，才退到 API。
 */
export const RELEASE_POINTER = 'version.json';

/**
 * 仓库路径 → Release 资产名（`downloads/manifest.json` → `downloads-manifest.json`）。
 *
 * **资产名一律扁平化**（2026-10-31 立，review #1）：虽然 GitHub 网页/API 允许带斜杠的
 * 资产名，但 `gh release upload` **只取文件 basename**，造不出带斜杠的名字——照仓库路径
 * 传上去，`downloads/manifest.json` 会变成 `manifest.json`，与三件套那份撞名（422，
 * v1.37.0 首发就是这么翻的车）。码云同一套规则，两端都按这个函数拼。
 */
export function flatAssetName(path: string): string {
  return String(path || '')
    .replace(/^\/+/, '')
    .replace(/\//g, '-');
}

/** GitHub Release 资产 URL（**主通道**）。tag 未知/非法或路径为空 → 空串，调用方跳过。 */
export function releaseDownloadUrl(tag: string, path: string): string {
  if (!isValidTag(tag) || !String(path || '').trim()) return '';
  return `https://github.com/${REPO_SLUG}/releases/download/${tag}/${flatAssetName(path)}`;
}

/** 码云 Release 资产 URL（**备通道**）。形状与 GitHub 完全同构，只换域名与 slug。 */
export function giteeReleaseUrl(tag: string, path: string): string {
  if (!isValidTag(tag) || !String(path || '').trim()) return '';
  return `https://gitee.com/${GITEE_SLUG}/releases/download/${tag}/${flatAssetName(path)}`;
}

/** tag 名的合法形状（防把远端返回的脏串拼进 URL 造出别的地址） */
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** tag 是否可安全拼进 URL（空串/含斜杠/含空白一律 false） */
export function isValidTag(tag: unknown): boolean {
  return typeof tag === 'string' && TAG_RE.test(tag);
}

/**
 * 某次发布的三件套基址：码云 Release 的资产目录（`…/releases/download/<tag>`）。
 *
 * 为什么只这里留码云、不留 GitHub：GitHub 那条在调用方用 `releaseDownloadUrl` 拼（它带
 * 扁平化，且要判空），这里返回的是「除主通道外的兜底目录」。用户自定义镜像不参与三件套——
 * 让用户自己镜像主程序，出问题时没人分得清是谁的锅。
 *
 * tag 不合法 → 空数组（调用方据此判「这条发布不可用」，而不是拿拼坏的 URL 去撞网络）。
 */
export function tagBasesFor(tag: string): string[] {
  if (!isValidTag(tag)) return [];
  return [`https://gitee.com/${GITEE_SLUG}/releases/download/${tag}`];
}

/** 某个发布目录下的三件套 URL（自更新用：manifest.json / main.js / styles.css）。
 *  三件套本身就在仓库根，资产名是扁平的原名，无需再映射。 */
export function repoRemotesForTag(tag: string, name: string): string[] {
  return tagBasesFor(tag).map((b) => `${b}/${name}`);
}

/**
 * `downloads/` 资产的静态通道（**不含** GitHub / 码云 Release —— 那两条要 tag，
 * 由 remote-asset.channelUrls 拼在最前）。
 *
 * 顺序：用户自定义镜像 → 码云 raw master（静态兜底）。
 *
 * 为什么留码云 raw 这条（2026-11-02）：`remotesFor` 在 tag 还没拉到时是**唯一的**通道
 * （首次引导、指针没拿到的场景）。没有它，那种情况下在线资源一个都下不动——而它只是
 * 「国内可达的静态副本」，正文有清单里的 sha256 兜底，对不上就拒收，不会装错内容。
 * 指针**不用**它：raw 的 version.json 在推代码那一刻就是新版号，比 Release 资产早，
 * 顺序是反的（见文件头）。
 *
 * 早先对 html 资产还追加过一条 gh-proxy 反代（指向分发仓 master）。分发仓退役后那条
 * 必然 404，且 `downloads/` 下已无 html 资产（手册与远端日志都已退场），一并删掉。
 */
export function downloadRemotesFor(fileName: string): string[] {
  const urls = repoBases().map((b) => `${b}/downloads/${fileName}`);
  urls.push(`https://gitee.com/${GITEE_SLUG}/raw/master/downloads/${fileName}`);
  return urls;
}

/* ============================================================
 * 自定义镜像（企业内网 / 无外网环境）
 *
 * 上面那几条通道都在公网。公司网里可能**全部**不通，那时除了「改系统代理」之外没有别的路 ——
 * 而系统代理不是每个人都有权限改。所以留一个口子：用户自己填基址（内网 nginx 静态目录、
 * 自建镜像都行），下载时**优先**走它。
 *
 * 地址形状必须与仓库一致（`<基址>/downloads/xxx`），这样「把仓库 downloads/ 目录挂到
 * nginx 上」就是全部工作量。镜像只影响**资源下载**（master 路径）；插件自更新的三件套
 * 仍走官方 tag —— 让用户自己镜像主程序，出问题时没人分得清是谁的锅。
 *
 * 读设置是惰性的（每次调用现读）：改完镜像点保存立刻生效，不需要重载插件。
 * `core/settings-provider.ts` 只有 type import，不会与这里成环。
 * ============================================================ */

/** 一条镜像基址的合法形状（只接受 http/https，去尾斜杠；空/非法 → 空串） */
export function normalizeMirrorBase(raw: unknown): string {
  const text = String(raw ?? '').trim().replace(/\/+$/, '');
  if (!text) return '';
  if (!/^https?:\/\/[^\s]+$/i.test(text)) return '';
  return text;
}

/** 用户填的镜像基址（空格/逗号/换行分隔，可多条；读不到设置 → 空数组） */
export function mirrorBases(): string[] {
  try {
    const raw = String((tryGetSettings() as { resourceMirror?: unknown }).resourceMirror ?? '');
    return raw
      .split(/[\s,;]+/)
      .map(normalizeMirrorBase)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 实际可用的静态基址（只有用户镜像；2026-11-02 起没有官方 CDN 快照层） */
export function repoBases(): string[] {
  return mirrorBases();
}

/** 仓库根文件的静态 URL（只来自用户镜像；没有镜像就是空数组）。
 *  用于发布指针这类「恒取最新」的小文件的最后兜底。 */
export function repoRemotesFor(name: string): string[] {
  return repoBases().map((b) => `${b}/${name}`);
}

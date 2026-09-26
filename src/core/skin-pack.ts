/* ============================================================
 * bz · 皮肤包（core/skin-pack.ts，单源）——ADR-0199，加载策略经 ADR-0203 修订
 *
 * 皮肤（主题轴）的**云端分发**层：条目来自统一下载清单（downloads/manifest.json
 * 的 skins[] 段，core/download-manifest.ts），每皮肤一个 `.css`，落
 * `<configDir>/plugins/bz/skins/`。**下载/更新由用户决定**（设置面板「在线资源」
 * 组按钮触发 downloadSkinUpdates）——ADR-0199 原「启动静默全量同步、不要按钮」
 * 口径废止：启动链（串在自更新检查之后——自更新会覆写 manifest.json 改掉插件
 * 版本号，而皮肤的版本区间校验正是拿这个版本号算的）只做**对比 + 下架清理 +
 * 就绪注入**，绝不下载；已下载的皮肤有更新，用户不点就停在旧版（知情后果，
 * 用户拍板接受）。
 *
 * ⚠️ 本文件是**全仓唯一的运行时样式注入点**（铁律 4 / ADR-0020 的例外，
 * 边界见 ADR-0199 决策 4）。任何其他文件要注入 `<style>` 都得另开 ADR；
 * `tests/core/skin-pack-split-guard.test.ts` 扫全仓守这条线。
 *
 * 设计口径：
 * - **内置首套恒在**（留在 `src/<域>/styles.css`，构建进产物）——任何情况下
 *   面板都有皮肤样式，不允许断网裸奔；本层只管远端那几套。
 * - **不生效的东西不许出现在选择卡里**：只有「本地文件存在 + sha256 与清单匹配 +
 *   版本区间内」的皮肤才进就绪表，选择卡与 normalizeSkin 都只认就绪表。
 *   （旧「本地就绪表 skins/index.json」文件已退役——就绪 = 缓存清单条目 + 文件实测。）
 * - **完整性**：远端是公开 raw 地址，谁有仓库写权限谁就能投毒——清单条目的
 *   sha256 不匹配一律拒绝注入（手册吃这个亏顶多少看一页，皮肤是被注入执行）。
 * - **启动期失败一律静默**（照 self-update 范式）；「在线资源」组里的失败态由
 *   UI 自己呈现（检查更新失败 + 重试），本层不发通知。
 * ============================================================ */
import { assetVaultPath, downloadsVaultPath, ensureAssetWithHash, readAsset } from './remote-asset';
import { textSha256 } from './sha256';
import { cachedManifest, type DownloadManifest, type SkinPackEntry } from './download-manifest';

/** 皮肤清单条目类型随清单统一上收 download-manifest（转出供各域选择卡消费，type-only） */
export type { SkinPackEntry } from './download-manifest';

/** 选择卡选项（域内 schema 的 choiceCards options 项形状；core 层不引 settings-schema，结构对齐即可） */
export interface SkinOption {
  value: string;
  label: string;
  layout: string;
  prevClass?: string;
}

/** 就绪条目（含已读到的 CSS 文本，免二次读盘） */
interface ReadySkin {
  entry: SkinPackEntry;
  text: string;
}

/** 就绪表：域 → 已就绪的远端皮肤（顺序 = 清单顺序 = 展示顺序） */
let ready = new Map<string, ReadySkin[]>();
/** 唯一注入节点 id */
const STYLE_ID = 'bz-skin-pack-style';

/** 半语义版本比较：`ver >= min`（与 self-update 同口径：非数字段按 0） */
function versionAtLeast(ver: string, min: string): boolean {
  const pa = String(ver || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(min || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return true; // 相等
}

/** 版本区间判定：`since <= 插件版本 < until`（缺省侧不限） */
export function isInVersionRange(entry: SkinPackEntry, pluginVersion: string): boolean {
  const ver = String(pluginVersion || '');
  if (!ver) return false;
  if (entry.since && !versionAtLeast(ver, entry.since)) return false;
  if (entry.until && versionAtLeast(ver, entry.until)) return false;
  return true;
}

/** 就绪条目（域内 normalizeSkin / 选择卡消费） */
export function localSkinEntries(domain: string): SkinPackEntry[] {
  return (ready.get(domain) ?? []).map((r) => r.entry);
}

/** 该域有没有这套远端皮肤可用（内置首套不在这里判——域内自己 union） */
export function isRemoteSkinReady(domain: string, id: unknown): boolean {
  const v = String(id ?? '');
  return !!v && (ready.get(domain) ?? []).some((r) => r.entry.id === v);
}

/** 就绪的远端皮肤 id 列表（清单顺序） */
export function remoteSkinIds(domain: string): string[] {
  return localSkinEntries(domain).map((e) => e.id);
}

/**
 * 选择卡选项：内置首套（恒首位）+ 就绪的远端皮肤（按清单顺序，ADR-0199 决策 7）。
 * @param builtins 域内声明的内置选项（现况只剩首套）
 */
export function skinPackOptions(domain: string, builtins: SkinOption[]): SkinOption[] {
  const extra = localSkinEntries(domain)
    .filter((e) => !builtins.some((b) => b.value === e.id))
    .map((e) => ({ value: e.id, label: e.name, layout: builtins[0]?.layout ?? 'default', prevClass: e.previewClass }));
  return [...builtins, ...extra];
}

/** 就绪表重置（测试用；生产只在应用清单/下载完成时改写） */
export function resetSkinPackState(): void {
  ready = new Map();
}

/** 测试用：直接播种就绪表（免真读盘） */
export function seedSkinPackState(entries: SkinPackEntry[]): void {
  ready = new Map();
  for (const e of entries) {
    const arr = ready.get(e.domain) ?? [];
    arr.push({ entry: e, text: `/* ${e.id} */` });
    ready.set(e.domain, arr);
  }
}

/** 测试用：取当前实际注入的 CSS（守卫/快照断言） */
export function injectedSkinPackCss(): string {
  return (document.getElementById(STYLE_ID) as HTMLStyleElement | null)?.textContent ?? '';
}

/**
 * 唯一注入点（ADR-0199 决策 4）：把就绪皮肤的 CSS 拼成一个 `<style>` 挂 head。
 * 传空串 = 摘掉样式节点（本地无远端皮肤时不留空节点）。
 */
export function injectSkinPackStyles(css: string): void {
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.textContent = css;
    return;
  }
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  document.head.appendChild(el);
}

/** 插件当前版本（自更新完成后读，才是有效版本号；读不到 → 空）。
 *  插件自身的 Obsidian 清单在插件目录根（不在 downloads/），必须直读——
 *  readAsset 已是 downloads 口径，误用会把下载清单缓存当版本事实源。 */
async function readPluginVersion(app: unknown): Promise<string> {
  try {
    const adapter = (app as { vault?: { adapter?: { read?: (p: string) => Promise<string> } } }).vault?.adapter;
    if (!adapter?.read) return '';
    const text = await adapter.read(assetVaultPath(app, 'manifest.json'));
    return String(JSON.parse(text || '{}')?.version || '');
  } catch (e) {
    return '';
  }
}

/** 就绪表 + 注入（先表后注入，保证「能选=能生效」） */
function applyReady(items: ReadySkin[]): void {
  ready = new Map();
  for (const it of items) {
    const arr = ready.get(it.entry.domain) ?? [];
    arr.push(it);
    ready.set(it.entry.domain, arr);
  }
  injectSkinPackStyles(items.map((it) => `/* bz skin-pack · ${it.entry.domain}/${it.entry.id} */\n${it.text}`).join('\n'));
}

/** 逐条读盘并校验（存在 + sha256 匹配）；不合格的静默跳过 */
async function readVerified(app: unknown, entries: SkinPackEntry[]): Promise<ReadySkin[]> {
  const out: ReadySkin[] = [];
  for (const e of entries) {
    const text = await readAsset(app, e.file);
    if (text === null) continue;
    if (textSha256(text) !== e.sha256) continue; // 半截/被改写的本地文件不入表（用户点「更新」会重下）
    out.push({ entry: e, text });
  }
  return out;
}

/** 区间内条目（清单过滤单源） */
function wantedEntries(manifest: DownloadManifest, pluginVersion: string): SkinPackEntry[] {
  return manifest.skins.filter((e) => isInVersionRange(e, pluginVersion));
}

/**
 * 启动即用的**纯本地**入口（不碰网络）：读缓存清单 + 验 hash → 就绪表 + 注入。
 *
 * 存在的理由：启动链的清单对比排在自更新巡检之后（启动 15 秒），若只靠它，用户上次
 * 选好的远端皮肤会在**每次重启后的那十几秒**里回落首套——看着像「我的皮肤被重置了」。
 * 版本区间按**当下**的 `manifest.json` 判；自更新覆写版本号后由 `applySkinManifest` 重判一次。
 */
export async function loadLocalSkinPack(app: unknown): Promise<void> {
  const pluginVersion = await readPluginVersion(app);
  if (!pluginVersion) return; // 读不到版本 → 区间无从判定，宁可不加载
  const cached = await cachedManifest(app);
  if (!cached) return; // 无缓存清单（全新安装未联网过）→ 本地也没有皮肤文件，无事可注入
  applyReady(await readVerified(app, wantedEntries(cached, pluginVersion)));
}

/** 限并发（几十套并发会打爆请求；失败不阻塞其余） */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

/** 删本地皮肤文件（下架 / 区间外；失败静默） */
async function removeSkinFile(app: unknown, file: string): Promise<void> {
  const adapter = (app as { vault?: { adapter?: { remove?: (p: string) => Promise<void> } } }).vault?.adapter;
  if (!adapter?.remove) return;
  try {
    await adapter.remove(downloadsVaultPath(app, file));
  } catch (e) {
    /* 文件本就不在 → 静默 */
  }
}

/** 删**旧落位**文件（issue 480b 前文档在插件目录根、皮肤在 plugins/bz/skins/；幂等惰性清扫） */
async function removeLegacyFile(app: unknown, file: string): Promise<void> {
  const adapter = (app as { vault?: { adapter?: { remove?: (p: string) => Promise<void> } } }).vault?.adapter;
  if (!adapter?.remove) return;
  try {
    await adapter.remove(assetVaultPath(app, file));
  } catch (e) {
    /* 文件本就不在 → 静默 */
  }
}

/** 皮肤三态计数（启动链统计 + 在线资源组按钮状态的数据源） */
export interface SkinStatus {
  /** 就绪条目数（区间内 + 文件 hash 匹配） */
  ready: number;
  /** 区间内但本地无文件（未下载套数） */
  missing: number;
  /** 区间内、文件在但 hash 与清单不符（可更新套数） */
  updated: number;
}

/** 区间内条目三态计数（纯读盘，无副作用、不注入不清理） */
export async function skinStatus(app: unknown, manifest: DownloadManifest): Promise<SkinStatus> {
  const pluginVersion = await readPluginVersion(app);
  if (!pluginVersion) return { ready: 0, missing: 0, updated: 0 };
  const wanted = wantedEntries(manifest, pluginVersion);
  const verified = await readVerified(app, wanted);
  const status: SkinStatus = { ready: verified.length, missing: 0, updated: 0 };
  const goodFiles = new Set(verified.map((r) => r.entry.file));
  for (const e of wanted) {
    if (goodFiles.has(e.file)) continue;
    // 文件在但 hash 不符 = 可更新；文件不在 = 未下载
    if (await readAsset(app, e.file) !== null) status.updated++;
    else status.missing++;
  }
  return status;
}

/** 应用清单结果（启动链统计） */
export interface SkinApplyResult extends SkinStatus {
  /** 本次清理的本地文件数（下架或区间外） */
  removed: number;
}

/**
 * 应用清单（**不下载**，ADR-0203 启动链入口；失败语义由调用方定——启动链静默）。
 * 顺序：区间过滤 → 逐条验 hash 算三态 → 就绪注入 → 下架/区间外清理。
 *
 * `previous` = 覆写前的缓存清单（refreshManifest 返回）：下架清理的差集基准——
 * 它里面有的、新清单区间内没有的，说明远端下架或版本区间不再覆盖，删本地文件
 * （沿用 ADR-0199「下架 = 清单移除 + 删本地」口径）。首次使用无缓存 → 无从谈下架，
 * 顺带把旧格式的就绪表 skins/index.json 一并退役删除。
 */
export async function applySkinManifest(
  app: unknown,
  manifest: DownloadManifest,
  previous?: DownloadManifest | null,
): Promise<SkinApplyResult> {
  const pluginVersion = await readPluginVersion(app);
  if (!pluginVersion) {
    // 读不到插件版本 → 区间无从判定，宁可不加载（防「按错版本放行」）
    return { ready: 0, missing: 0, updated: 0, removed: 0 };
  }

  // 1) 区间过滤 + 逐条验 hash → 三态计数 + 就绪注入（离线也可用已有的）
  const wanted = wantedEntries(manifest, pluginVersion);
  const verified = await readVerified(app, wanted);
  applyReady(verified);
  const result: SkinApplyResult = { ready: verified.length, missing: 0, updated: 0, removed: 0 };
  const goodFiles = new Set(verified.map((r) => r.entry.file));
  for (const e of wanted) {
    if (goodFiles.has(e.file)) continue;
    // 文件在但 hash 不符 = 可更新；文件不在 = 未下载
    if (await readAsset(app, e.file) !== null) result.updated++;
    else result.missing++;
  }

  // 2) 下架 / 区间外 → 删本地文件（差集基准 = 覆写前缓存清单）
  const wantedFiles = new Set(wanted.map((e) => e.file));
  const staleFiles = new Set((previous?.skins ?? []).map((e) => e.file));
  for (const file of staleFiles) {
    if (wantedFiles.has(file)) continue;
    await removeSkinFile(app, file);
    result.removed++;
  }
  // 旧落位惰性清扫（issue 480b 前的形态，幂等）：旧就绪表 + 插件目录根的文档副本
  await removeLegacyFile(app, 'skins/index.json');
  await removeLegacyFile(app, 'bz-changelog.html');
  await removeLegacyFile(app, 'bz-manual.html');

  return result;
}

/** 手动下载结果（在线资源组按钮消费） */
export interface SkinDownloadResult {
  /** 下载成功且过 hash 校验的套数 */
  downloaded: number;
  /** 双源都失败的套数（本地已有的不动，下次再试） */
  failed: number;
}

/**
 * 用户显式下载/更新（ADR-0203：皮肤分发的唯一下载入口）——
 * 把「区间内且非就绪」（未下载 + 可更新）的全部套数拉一遍，限并发 4；
 * 已就绪的绝不动（用户已可用的皮肤不因一次点击承担被换内容的风险）。
 *
 * 就绪表以**当前注入的集合为底**、只覆盖「本次下载且过验」的条目：若就绪表还停在
 * 旧清单口径（启动链刷新失败后组内核对才成功刷了缓存清单），一次**失败**的更新点击
 * 不能把本地仍在生效的旧内容皮肤按新清单 hash 摘出选择卡——失败即维持现状，只报 failed。
 */
export async function downloadSkinUpdates(app: unknown, manifest: DownloadManifest): Promise<SkinDownloadResult> {
  const result: SkinDownloadResult = { downloaded: 0, failed: 0 };

  const pluginVersion = await readPluginVersion(app);
  if (!pluginVersion) return result;

  const wanted = wantedEntries(manifest, pluginVersion);
  const verified = await readVerified(app, wanted);
  const goodFiles = new Set(verified.map((r) => r.entry.file));
  const todo = wanted.filter((e) => !goodFiles.has(e.file));

  // 底座两层：盘上验过的（新清单口径，冷启动首次注入的兜底）先铺；
  // 当前就绪表的在用条目后铺覆盖（旧清单口径的也保留——内容仍在生效）
  const byFile = new Map<string, ReadySkin>();
  for (const r of verified) byFile.set(r.entry.file, r);
  for (const arr of ready.values()) for (const r of arr) byFile.set(r.entry.file, r);

  await mapLimit(todo, 4, async (e) => {
    try {
      const text = await ensureAssetWithHash(app, e.file, e.sha256, `皮肤「${e.name}」`);
      if (text !== null) {
        byFile.set(e.file, { entry: e, text });
        await removeLegacyFile(app, e.file); // 旧落位副本（plugins/bz/skins/ 时代）顺手清掉
      }
      result.downloaded++;
    } catch (err) {
      console.warn(`[bz] 皮肤「${e.domain}/${e.id}」下载失败:`, (err as Error)?.message || err);
      result.failed++;
    }
  });

  // 按清单顺序重灌：旧口径的保留、新下载成功的覆盖（能选 = 能生效）
  applyReady(wanted.map((e) => byFile.get(e.file)).filter((r): r is ReadySkin => r !== undefined));
  return result;
}

/* ============================================================
 * bz · 皮肤包（core/skin-pack.ts，单源）——ADR-0199
 *
 * 皮肤（主题轴）的**云端分发**层：清单 `manual/skins/index.json` +
 * 每皮肤一个 `.css`，落 `<configDir>/plugins/bz/skins/`，启动时静默同步
 * （串在自更新检查之后——自更新会覆写 manifest.json 改掉插件版本号，
 * 而皮肤的版本区间校验正是拿这个版本号算的）。
 *
 * ⚠️ 本文件是**全仓唯一的运行时样式注入点**（铁律 4 / ADR-0020 的例外，
 * 边界见 ADR-0199 决策 4）。任何其他文件要注入 `<style>` 都得另开 ADR；
 * `tests/core/skin-pack-split-guard.test.ts` 扫全仓守这条线。
 *
 * 设计口径：
 * - **内置首套恒在**（留在 `src/<域>/styles.css`，构建进产物）——任何情况下
 *   面板都有皮肤样式，不允许断网裸奔；本层只管远端那几套。
 * - **不生效的东西不许出现在选择卡里**：只有「本地文件存在 + sha256 匹配 +
 *   版本区间内」的皮肤才进就绪表，选择卡与 normalizeSkin 都只认就绪表。
 * - **完整性**：远端是公开 raw 地址，谁有仓库写权限谁就能投毒——清单条目的
 *   sha256 不匹配一律拒绝注入（手册吃这个亏顶多少看一页，皮肤是被注入执行）。
 * - **失败一律静默**：启动期网络失败不该弹脸（照 self-update 范式）；本层
 *   不发任何通知，拉不到就等下次启动再拉（用户拍板：不要按钮、不要节流）。
 * ============================================================ */
import { assetVaultPath, ensureAssetWithHash, fetchAssetText, readAsset } from './remote-asset';
import { textSha256 } from './sha256';

/** 远端清单路径（相对插件安装目录，与 remote-asset 的 manual/ 口径一致） */
export const SKIN_PACK_INDEX = 'skins/index.json';

/** 单条皮肤条目（清单形状；构建脚本 `scripts/build-skin-pack.mjs` 产出） */
export interface SkinPackEntry {
  /** 皮肤 id（域内唯一，= CSS 类名后缀） */
  id: string;
  /** 所属域 id（= `src/<域>/` 目录名） */
  domain: string;
  /** 中文名（选择卡文案） */
  name: string;
  /** 相对插件安装目录的路径，如 `skins/bookshelf/noir.css` */
  file: string;
  /** 选择卡预览区附加类（预览规则随包下发，见 ADR-0199 决策 6） */
  previewClass?: string;
  /** 最低插件版本（含），空 = 不限 */
  since?: string;
  /** 最高插件版本（不含），空 = 不限 */
  until?: string;
  /** 归一换行后文本的 sha256（64 位小写） */
  sha256: string;
}

export interface SkinPackManifest {
  version: number;
  skins: SkinPackEntry[];
}

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
/** 本地索引记录（用于「下架 → 删本地文件」的差集计算） */
let localIndex: SkinPackEntry[] = [];
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

/** 清单解析（纯函数；形状不对/JSON 崩/错误页 → null，调用方静默跳过） */
export function parseSkinPackManifest(text: string | null): SkinPackManifest | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return null;
  }
  const obj = raw as { version?: unknown; skins?: unknown };
  if (!obj || !Array.isArray(obj.skins)) return null;
  const skins: SkinPackEntry[] = [];
  for (const item of obj.skins as unknown[]) {
    const e = item as Partial<SkinPackEntry>;
    if (!e || typeof e.id !== 'string' || !e.id) return null;
    if (typeof e.domain !== 'string' || !e.domain) return null;
    if (typeof e.file !== 'string' || !e.file) return null;
    if (typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256.toLowerCase())) return null;
    skins.push({
      id: e.id,
      domain: e.domain,
      name: typeof e.name === 'string' && e.name ? e.name : e.id,
      file: e.file,
      previewClass: typeof e.previewClass === 'string' && e.previewClass ? e.previewClass : undefined,
      since: typeof e.since === 'string' && e.since ? e.since : undefined,
      until: typeof e.until === 'string' && e.until ? e.until : undefined,
      sha256: e.sha256.toLowerCase(),
    });
  }
  const version = typeof obj.version === 'number' ? obj.version : 1;
  return { version, skins };
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

/** 就绪表重置（测试用；生产只在同步时改写） */
export function resetSkinPackState(): void {
  ready = new Map();
  localIndex = [];
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

/** 插件当前版本（自更新完成后读，才是有效版本号；读不到 → 空） */
async function readPluginVersion(app: unknown): Promise<string> {
  try {
    const text = await readAsset(app, 'manifest.json');
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
    if (textSha256(text) !== e.sha256) continue; // 半截/被改写的本地文件不入表（下次同步会重下）
    out.push({ entry: e, text });
  }
  return out;
}

/** 读本地索引（顺带刷新 `localIndex`）+ 逐条验 hash → 就绪条目（网络前的那一半） */
async function readLocalReady(app: unknown, pluginVersion: string): Promise<ReadySkin[]> {
  const previous = parseSkinPackManifest(await readAsset(app, SKIN_PACK_INDEX));
  localIndex = previous?.skins ?? [];
  return readVerified(
    app,
    localIndex.filter((e) => isInVersionRange(e, pluginVersion)),
  );
}

/**
 * 启动即用的**纯本地**入口（不碰网络）：读本地索引 + 验 hash → 就绪表 + 注入。
 *
 * 存在的理由：`syncSkinPack` 排在自更新巡检之后（启动 15 秒），若只靠它，用户上次选好的
 * 远端皮肤会在**每次重启后的那十几秒**里回落首套——看着像「我的皮肤被重置了」。
 * 版本区间按**当下**的 `manifest.json` 判；自更新覆写版本号后由 `syncSkinPack` 重判一次。
 */
export async function loadLocalSkinPack(app: unknown): Promise<void> {
  const pluginVersion = await readPluginVersion(app);
  if (!pluginVersion) return; // 读不到版本 → 区间无从判定，宁可不加载
  applyReady(await readLocalReady(app, pluginVersion));
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
    await adapter.remove(assetVaultPath(app, file));
  } catch (e) {
    /* 文件本就不在 → 静默 */
  }
}

/** 同步结果（只给测试与日志用；生产不弹通知） */
export interface SkinSyncResult {
  /** 就绪条目数 */
  ready: number;
  /** 下载/更新的文件数 */
  downloaded: number;
  /** 删除的本地文件数（下架或区间外） */
  removed: number;
  /** 拉不到远端清单（离线/被墙）——不是错误，等下次启动 */
  offline: boolean;
}

/**
 * 启动同步入口（串在自更新检查之后调用；失败一律静默）。
 * 顺序：读本地就绪表并注入（离线也能用已有的）→ 拉远端清单 →
 * 补下缺失/变更的 → 删下架与区间外的 → 写本地索引 → 重注入。
 */
export async function syncSkinPack(app: unknown): Promise<SkinSyncResult> {
  const result: SkinSyncResult = { ready: 0, downloaded: 0, removed: 0, offline: false };

  const pluginVersion = await readPluginVersion(app);
  if (!pluginVersion) {
    // 读不到插件版本 → 区间无从判定，宁可不加载（防「按错版本放行」）
    return result;
  }

  // 1) 本地优先：离线也有皮可用（与 loadLocalSkinPack 共用同一条读盘路径；
  //    localIndex 同时也由它按当前索引刷新——下面「下架删文件」用的就是它）
  const localReady = await readLocalReady(app, pluginVersion);
  applyReady(localReady);
  result.ready = localReady.length;

  // 2) 拉远端清单（双源；拉不到就到此为止，本地那份继续生效）
  let remote: SkinPackManifest | null = null;
  try {
    remote = parseSkinPackManifest(
      await fetchAssetText(SKIN_PACK_INDEX, (t) => parseSkinPackManifest(t) !== null, '皮肤包清单', ''),
    );
  } catch (e) {
    console.warn('[bz] 皮肤包清单拉取失败（已静默，等下次启动）:', (e as Error)?.message || e);
  }
  if (!remote) {
    result.offline = true;
    return result;
  }

  // 3) 差集：区间内且（本地缺 / 本地 hash 不符）→ 下载（限并发）
  //    判据吃**第 1 步验过的结果**（localReady），不是本地索引：索引只记「上次写下的 hash」，
  //    文件被改写/写了一半时索引仍说「已就绪」，会误跳过下载、要等下一次启动才自愈。
  //    键用 file（= `skins/<域>/<id>.css`）而非 id：id 只保证域内唯一，全局可能撞车。
  const wanted = remote.skins.filter((e) => isInVersionRange(e, pluginVersion));
  const localGood = new Map(localReady.map((r) => [r.entry.file, r.entry.sha256]));
  await mapLimit(
    wanted.filter((e) => localGood.get(e.file) !== e.sha256),
    4,
    async (e) => {
      try {
        await ensureAssetWithHash(app, e.file, e.sha256, `皮肤「${e.name}」`);
        result.downloaded++;
      } catch (err) {
        console.warn(`[bz] 皮肤包「${e.domain}/${e.id}」下载失败（已静默）:`, (err as Error)?.message || err);
      }
    },
  );

  // 4) 下架 / 区间外 → 删本地文件（用户拍板：下架 = 清单移除 + 删本地文件）
  const wantedFiles = new Set(wanted.map((e) => e.file));
  for (const e of localIndex) {
    if (wantedFiles.has(e.file)) continue;
    await removeSkinFile(app, e.file);
    result.removed++;
  }

  // 5) 重新逐条验 hash（下载可能部分失败）→ 重注入 → 写本地索引
  const nextReady = await readVerified(app, wanted);
  applyReady(nextReady);
  result.ready = nextReady.length;
  try {
    await (app as { vault?: { adapter?: { write?: (p: string, d: string) => Promise<void> } } })
      .vault!.adapter!.write!(
        assetVaultPath(app, SKIN_PACK_INDEX),
        JSON.stringify({ version: remote.version, skins: nextReady.map((r) => r.entry) }, null, 2),
      );
  } catch (e) {
    console.warn('[bz] 皮肤包本地索引写入失败（已静默）:', (e as Error)?.message || e);
  }

  return result;
}

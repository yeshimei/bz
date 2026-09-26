/* ============================================================
 * bz · 下载清单（core/download-manifest.ts，单源）——ADR-0202
 *
 * 全插件在线资源的**单一事实源**：仓库 downloads/manifest.json，
 * 内联 docs[]（更新日志/使用手册等单文件资源）与 skins[]（皮肤包条目）。
 * 插件每次启动双源拉取一次（**只对比不下载**——下载永远由用户在设置面板
 * 「在线资源」组里点按钮、或点手册/日志入口触发），拉不到沿用上次缓存。
 *
 * 本地镜像口径：远端 `downloads/<path>` ↔ 本地 `<configDir>/plugins/bz/<path>`
 * 逐字同构——清单本身也是清单的下载产物之一（downloads/manifest.json）。
 * 不叫 `plugins/bz/manifest.json` 是因为插件自身的 Obsidian 清单就住在那
 * （skin-pack 的版本区间校验读它），撞名即事故。
 *
 * 资源是否就绪 = 缓存清单条目 + 本地文件 sha256 匹配（旧「皮肤本地就绪表
 * skins/index.json」随本层退役，ADR-0199 那套「清单记上次就绪集」的职责
 * 由缓存清单 + 文件实测接管）。
 * ============================================================ */
import { fetchAssetText, readAsset, writeAssetText } from './remote-asset';
import { textSha256 } from './sha256';

/** 统一清单的本地路径（相对插件安装目录；与远端 downloads/ 镜像同构） */
export const MANIFEST_FILE = 'downloads/manifest.json';
/** 清单的远端路径（相对 downloads/；remotesFor 的口径是「相对 downloads/」拼 URL） */
const MANIFEST_REMOTE = 'manifest.json';

/**
 * 皮肤包清单条目（形状；构建脚本 build-manifest.mjs 产出）。
 * 原声明在 skin-pack.ts（ADR-0199）——它本质是**清单条目**概念，ADR-0202 清单统一后
 * 随校验逻辑上收到本层；skin-pack 转出类型仅供各域选择卡消费（type-only，零运行时边）。
 */
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

/** 单文件资源条目（更新日志/使用手册；新资源在 build-manifest.mjs 的 DOCS 表登记） */
export interface ManifestDocEntry {
  /** 资源 id（在线资源组行定位；现役 changelog / manual） */
  id: string;
  /** 中文名（在线资源组行文案） */
  name: string;
  /** 相对插件安装目录的路径（= 远端 downloads/ 内相对路径） */
  file: string;
  /** 归一换行后文本的 sha256（64 位小写） */
  sha256: string;
}

export interface DownloadManifest {
  version: number;
  docs: ManifestDocEntry[];
  skins: SkinPackEntry[];
}

const SHA_RE = /^[0-9a-f]{64}$/;

/** 皮肤条目校验与归一（形状不对 → null，整条拒绝；与原 skin-pack 内联版同口径） */
function normalizeSkinEntry(item: unknown): SkinPackEntry | null {
  const e = item as Partial<SkinPackEntry>;
  if (!e || typeof e.id !== 'string' || !e.id) return null;
  if (typeof e.domain !== 'string' || !e.domain) return null;
  if (typeof e.file !== 'string' || !e.file) return null;
  if (typeof e.sha256 !== 'string' || !SHA_RE.test(e.sha256.toLowerCase())) return null;
  return {
    id: e.id,
    domain: e.domain,
    name: typeof e.name === 'string' && e.name ? e.name : e.id,
    file: e.file,
    previewClass: typeof e.previewClass === 'string' && e.previewClass ? e.previewClass : undefined,
    since: typeof e.since === 'string' && e.since ? e.since : undefined,
    until: typeof e.until === 'string' && e.until ? e.until : undefined,
    sha256: e.sha256.toLowerCase(),
  };
}

/**
 * 清单解析（纯函数；形状不对 / JSON 崩 / CDN 错误页 → null，调用方静默跳过）。
 * docs 与 skins 各自逐条校验；docs 允许空（皮肤是分发主体），skins 允许空（清单只剩文档也是合法态）。
 */
export function parseDownloadManifest(text: string | null): DownloadManifest | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return null;
  }
  const obj = raw as { version?: unknown; docs?: unknown; skins?: unknown };
  if (!obj || !Array.isArray(obj.docs) || !Array.isArray(obj.skins)) return null;
  const docs: ManifestDocEntry[] = [];
  for (const item of obj.docs as unknown[]) {
    const e = item as Partial<ManifestDocEntry>;
    if (!e || typeof e.id !== 'string' || !e.id) return null;
    if (typeof e.name !== 'string' || !e.name) return null;
    if (typeof e.file !== 'string' || !e.file) return null;
    if (typeof e.sha256 !== 'string' || !SHA_RE.test(e.sha256.toLowerCase())) return null;
    docs.push({ id: e.id, name: e.name, file: e.file, sha256: e.sha256.toLowerCase() });
  }
  const skins: SkinPackEntry[] = [];
  for (const item of obj.skins as unknown[]) {
    const e = normalizeSkinEntry(item);
    if (!e) return null;
    skins.push(e);
  }
  const version = typeof obj.version === 'number' ? obj.version : 1;
  return { version, docs, skins };
}

/** 读本地缓存的清单（上次成功拉取的镜像）；无缓存/坏形 → null */
export async function cachedManifest(app: unknown): Promise<DownloadManifest | null> {
  return parseDownloadManifest(await readAsset(app, MANIFEST_FILE));
}

/** 缓存清单里某文件的清单 sha256（manual/changelog 入口省流用）；清单缺席/条目不在 → null */
export async function cachedSha256For(app: unknown, file: string): Promise<string | null> {
  const m = await cachedManifest(app);
  if (!m) return null;
  return m.docs.find((d) => d.file === file)?.sha256 ?? m.skins.find((s) => s.file === file)?.sha256 ?? null;
}

/** 拉取结果：`previous` = 覆写前的缓存清单（皮肤下架清理的差集基准；首次使用 → null） */
export interface ManifestRefresh {
  manifest: DownloadManifest;
  previous: DownloadManifest | null;
}

/**
 * 拉取最新清单并写缓存（启动链与组内重试共用）。
 * 双源全失败 / 内容不可信 → 抛人话 Error（**不写缓存**——旧缓存原样保留，UI 沿用它渲染）。
 */
export async function refreshManifest(app: unknown): Promise<ManifestRefresh> {
  const previous = await cachedManifest(app);
  const text = await fetchAssetText(
    MANIFEST_REMOTE,
    (t) => parseDownloadManifest(t) !== null,
    '下载清单',
    '',
  );
  const manifest = parseDownloadManifest(text)!;
  await writeAssetText(app, MANIFEST_FILE, text);
  return { manifest, previous };
}
/** 单文件资源的本地状态（在线资源组按钮状态机） */
export type DocStatus = 'missing' | 'updated' | 'ready';

/** 算单文件资源状态：未下载 / 本地与清单 hash 不符（有更新）/ 已最新 */
export async function docStatus(app: unknown, entry: ManifestDocEntry): Promise<DocStatus> {
  const local = await readAsset(app, entry.file);
  if (local === null) return 'missing';
  return textSha256(local) === entry.sha256 ? 'ready' : 'updated';
}

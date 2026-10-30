/* ============================================================
 * bz · 设置面板「在线资源」组（settings-panel/online-resources.ts）——ADR-0203 / ADR-0205 / ADR-0207
 *
 * 通用域最后一组，**行集合由下载清单驱动**（ADR-0207）：
 * 清单 `rowOrder` 决定行序（SKINS_ROW_ID 是皮肤聚合行的保留 id），每个 doc 条目一行；
 * 内置的「检查更新」「全部更新」两行恒在组首（rows[0] / rows[1]）。
 * 状态机（未下载 → 下载 N；有更新 → 更新 N；已最新 → 已下载 禁用；动作中转圈禁用）。
 * ADR-0205：整组为**通用声明行**（button 行 + visibleWhen 门控 + 行按钮三态助手）。
 *
 * 状态永远从**磁盘单源**现算（缓存清单 + 本地文件 sha256），组内不持久状态；
 * 构建期本地现算一次，打开面板顺手后台核对一次清单（60s 节流）；
 * 核对失败有缓存沿用缓存渲染 + 检查更新行留档；无缓存则只留操作行并禁用。
 * **跨入口同步**：导航入口更新文档 / 分类表拉取落盘后，本组订阅下载事件把行态同步成磁盘事实。
 * **半自动铁则的 UI 面**：本组按钮与手册/日志导航入口是仅有的两个下载触发点。
 *
 * 新增一条在线资源 = 出版产物 + `pnpm manifest` 登记 docs 条目与 rowOrder，本文件零改动
 * （只用通用状态机的资源不必碰代码；要专属描述补规模才加一条 DESC_EXTRAS）。
 * ============================================================ */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { onDomainEvent } from '../core/domain-bus';
import { DOWNLOADS_CHANGED_EVENT } from '../core/remote-asset';
import type { GroupDecl, SettingsRow, SettingsRowContext } from '../core/settings-schema';
import { setRowBtnState } from '../core/settings-btn-state';
import {
  cachedManifest,
  docStatus,
  refreshManifest,
  SKINS_ROW_ID,
  type DocStatus,
  type DownloadManifest,
  type ManifestDocEntry,
} from '../core/download-manifest';
import {
  downloadSkinUpdates,
  isInVersionRange,
  readPluginVersion,
  skinStatus,
  type SkinStatus,
} from '../core/skin-pack';
import { ensureAssetWithHash } from '../core/remote-asset';
import { bundleDirOf, bundleStatus, installBundle, readBundleMarker } from '../core/bundle-asset';
import { readAsset } from '../core/remote-asset';
import { TOOL_ENTRIES, TOOL_IDS, toolManifestId, toolReadyState, type ToolId } from '../core/tool-runtime';
import { isToolBundleId, setupAfterInstall } from '../core/tool-setup';
import { loadCategoryTable } from '../core/category-table';
import { loadRssCatalog, catalogCategoryCounts } from '../core/rss-catalog';
import { loadDoubanNameIndex, indexKindCounts } from '../core/douban-name-index';

/** 千分位（8.5 万级的条数不加分隔没法读；en-US 固定/locale 无关） */
const thousand = (n: number): string => n.toLocaleString('en-US');

/** 皮肤聚合行的行名（它不是 doc 条目、清单里没有 name，只能内置；各域选择卡叫法不变） */
const SKINS_ROW_NAME = '主题';

/** 全部更新行的忙碌哨兵：只用于拦重入与「补丁别覆盖」，不是任何资源 id */
const ALL_BUSY_ID = '__all__';

/**
 * 行的专属描述补充（读本地产物算规模这类，塞进「已是最新版本（…）」的括号里）。
 * 这是本组唯一的「按 id 特判」处——只用通用状态机的新资源什么都不用加。
 */
const DESC_EXTRAS: Record<string, (app: unknown, entry: ManifestDocEntry) => Promise<string | null>> = {
  'belongings-categories': async (app) => {
    const table = await loadCategoryTable(app);
    if (!table) return null; // 读不出表 → 只说「已是最新版本」，不编规模
    const items = table.groups.reduce((n, g) => n + g.items.length, 0);
    return `${table.groups.length} 组 ${items} 条`;
  },
  // issue 495：RSS 源库就绪描述捎带「N 类 M 源」（只数非空大类，0 条的分类不冒充规模）
  'rss-catalog': async (app) => {
    const catalog = await loadRssCatalog(app);
    if (!catalog) return null;
    const cats = catalogCategoryCounts(catalog).filter((c) => c.count > 0).length;
    return `${cats} 类 ${catalog.feeds.length} 源`;
  },
  // issue 498：豆瓣影视索引就绪描述捎带「N 条 · 各类型条数」（用户点名按类型给量级参考）
  'cinema-douban-index': async (app) => {
    const idx = await loadDoubanNameIndex(app);
    if (!idx) return null;
    const parts = indexKindCounts(idx).map(({ k, count }) => `${k} ${thousand(count)}`);
    return `${thousand(idx.stats.total)} 条 · ${parts.join(' / ')}`;
  },
};

/**
 * 读目录包自带的版本号（包内 `package.json` 的 version）。
 *
 * 为什么不再说「N 个文件」：文件数只说明解包了几条，说明不了「这是哪个版本的工具」——
 * 用户排查问题时想知道的是版本。体积那一项由 rowDesc 统一拼在括号里，这里只给版本。
 */
async function bundleVersionOf(app: unknown, entry: ManifestDocEntry): Promise<string> {
  const text = await readAsset(app, `${bundleDirOf(entry.file)}/package.json`);
  if (!text) return '';
  try {
    const v = String((JSON.parse(text) as { version?: unknown })?.version || '').trim();
    return v ? (v.startsWith('v') ? v : `v${v}`) : '';
  } catch {
    return ''; // 坏 JSON：宁可不显示版本，也不显示一个编的
  }
}

/** 就绪态的描述补充：目录包说**脚本版本**，文本资源走 DESC_EXTRAS 表（无则不补） */
async function readyExtra(app: unknown, id: string, entry: ManifestDocEntry): Promise<string | null> {
  if (entry.kind === 'bundle') {
    const m = await readBundleMarker(app, entry);
    if (!m) return null;
    const version = await bundleVersionOf(app, entry);
    return version || null;
  }
  return DESC_EXTRAS[id] ? DESC_EXTRAS[id](app, entry) : null;
}

/** 打开面板时后台核对的节流窗（快速开关面板不狂拉；启动链每次启动独立跑不受此限） */
const CHECK_THROTTLE_MS = 60_000;
let lastCheckAt = 0;
/** 本次会话最近一次核对是否失败（检查更新行据此呈失败文案与「重试」） */
let checkFailed = false;
/** 组内行按钮（button 行窄档；行对象可变——syncGroupRows 就地改写，下次重渲即新值） */
type BtnRow = Extract<SettingsRow, { type: 'button' }>;

/** 组范围：外部工具（清单里 kind='bundle' 的三个目录包）/ 在线资源（文档、数据表、皮肤） */
export type ResourceScope = 'tools' | 'resources';

/**
 * 一个组卡的引用账（构建期建立；行对象是重渲真相源，已渲染 DOM 另走 patchRenderedGroup 补丁）。
 *
 * 2026-10-29：两组各带一行「全部更新」——此前只有在线资源组有，工具组只能一行一行点。
 * 组级动作按 `scope` 认行，不按 DOM 位置认：两组的行对象来自同一张 entries 表。
 */
interface GroupMeta {
  /** 组名（与 schema 里的组名逐字一致；DOM 补丁按 data-sp-group 对位） */
  name: string;
  scope: ResourceScope;
  /** 与 group.rows 同引用（DOM 行序 = 此序，补丁按序对位） */
  rows: SettingsRow[];
  /** 组级「全部更新」行（恒在组首；无待办时禁用，无清单时呈「等待检查更新」） */
  allRow: BtnRow;
}

/** 当前两个组卡的账（外部工具在前、在线资源在后；顺序 = 构造顺序） */
let currentGroups: GroupMeta[] = [];
/** 资源行账（id → 行对象；顺序 = 清单 rowOrder，两组共用一张表） */
let currentEntries: Array<{ id: string; row: BtnRow }> = [];
/** 检查更新行（只在线资源组有；visibleWhen 与本模块 DOM 补丁同读此位） */
let retryRow: BtnRow | null = null;
/** 检查更新行显隐真相（visibleWhen 与本模块 DOM 补丁同读此位） */
let retryVisible = false;
/** 当前清单里属于「外部工具」的 id 集合（组范围判据；清单拉不到时是本地兜底那三行） */
let toolIds = new Set<string>();
/** 单飞（single-flight）同步：并发请求合流——下载事件逐条扑面时不排队做 N 次全量重扫 */
let syncRunning: Promise<void> | null = null;
/** 合流窗内又来了请求（本轮跑完立刻补一轮：收尾态必须落在最后一次请求之后的磁盘事实上） */
let syncDirty = false;
/** 动作进行中的资源 id（schema 面置忙，见 runAction）：重算不得把它们的行对象改写回可点——
 *  批量下载逐条落盘、每套都触发重算，不禁写就把「动作中禁用」当场抹掉（切域重渲即重复点击面）。 */
const busyIds = new Set<string>();

/** 重置会话状态（测试用；生产进程内随会话存续无需重置） */
export function resetOnlineResourcesState(): void {
  lastCheckAt = 0;
  checkFailed = false;
  currentGroups = [];
  currentEntries = [];
  retryRow = null;
  retryVisible = false;
  toolIds = new Set();
  syncRunning = null;
  syncDirty = false;
  busyIds.clear();
}

/** 行渲染所需的全部事实（一次算齐） */
interface RowState {
  /** 清单条目 id（动作分发用）；皮肤聚合行是 SKINS_ROW_ID */
  id: string;
  /** 行名（doc 行取清单 name；皮肤行取内置名） */
  name: string;
  /** doc 行状态；皮肤行 null */
  doc: DocStatus | null;
  /** 皮肤行三态计数；doc 行 null */
  skin: SkinStatus | null;
  /**
   * 本地兜底行（清单没拉到时的那三个外部工具）：`ready` = 包在磁盘上，
   * `missing` = 没下载。非空即说明这一行不是清单给的，不能下载也不能检查更新。
   */
  local: 'ready' | 'missing' | null;
  /** 描述里的规模补充（如「26 组 515 条」）；无则 null */
  extra: string | null;
  /** 该行资源的体积（doc = 清单 size；皮肤 = 区间内各套合计）；无信息 null */
  size: number | null;
}

/** 外部工具的本地行表（清单拉不到时据此出三行；id/行名与 core/tool-runtime 同源） */
const LOCAL_TOOL_ROWS: Array<{ id: string; name: string; toolId: ToolId }> = TOOL_IDS.map((id) => ({
  id: toolManifestId(id),
  name: TOOL_ENTRIES[id].label,
  toolId: id,
}));

/**
 * 行序：清单 `rowOrder` 优先（SKINS_ROW_ID 是皮肤聚合行的保留 id）；缺失 = docs 顺序 + 皮肤末位。
 * rowOrder 漏提的 doc 追加在末尾（清单是事实源，漏登记不该让条目凭空消失），漏提皮肤也补在末尾。
 */
function rowIdsOf(manifest: DownloadManifest): string[] {
  const docIds = manifest.docs.map((d) => d.id);
  const order = manifest.rowOrder;
  if (!order || order.length === 0) return [...docIds, SKINS_ROW_ID];
  const ids = order.filter((id) => id === SKINS_ROW_ID || docIds.includes(id));
  if (!ids.includes(SKINS_ROW_ID)) ids.push(SKINS_ROW_ID);
  const seen = new Set(ids);
  for (const id of docIds) if (!seen.has(id)) ids.push(id);
  return ids;
}

/** 皮肤总体积（区间内已登记 size 的条目合计）；一条都没登记 → null（不提体积） */
function skinTotalSize(manifest: DownloadManifest, pluginVersion: string): number | null {
  let sum = 0;
  let any = false;
  for (const e of manifest.skins) {
    if (pluginVersion && !isInVersionRange(e, pluginVersion)) continue;
    if (typeof e.size === 'number' && e.size > 0) {
      sum += e.size;
      any = true;
    }
  }
  return any ? sum : null;
}

/** 体积文案（MB 一位小数 / KB 取整；不足 1 KB 折成 <1 KB） */
function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return '<1 KB';
}

/** 组内容一次性算齐（缓存清单 + 本地文件实测）；无清单 → 外部工具行按磁盘事实兜底，其余没有 */
async function computeRowStates(app: unknown): Promise<{ rows: RowState[]; manifest: DownloadManifest | null }> {
  const manifest = await cachedManifest(app);
  if (!manifest) {
    // 清单拉不到（首次启动没网 / 资源站不可达）时，外部工具这一组不能整组消失：
    // 它们是**本机已经装好的东西**，状态只由磁盘决定，与能不能连外网无关
    // （2026-10-28 用户报障：断网时「外部工具」一行都没有，看起来像插件坏了）。
    return {
      rows: LOCAL_TOOL_ROWS.map((t) => ({
        id: t.id,
        name: t.name,
        doc: null,
        skin: null,
        local: toolReadyState(app, t.toolId).ready ? 'ready' : 'missing',
        extra: null,
        size: null,
      })),
      manifest: null,
    };
  }
  // 插件版本：doc 版本区间过滤与皮肤区间计数共用（读不到 → 皮肤状态不可判，doc 不过滤）
  const pluginVersion = await readPluginVersion(app);

  const rows: RowState[] = [];
  for (const id of rowIdsOf(manifest)) {
    if (id === SKINS_ROW_ID) {
      rows.push({
        id,
        name: SKINS_ROW_NAME,
        doc: null,
        skin: pluginVersion ? await skinStatus(app, manifest) : null,
        local: null,
        extra: null,
        size: skinTotalSize(manifest, pluginVersion),
      });
      continue;
    }
    const entry = manifest.docs.find((d) => d.id === id);
    if (!entry) continue;
    // 版本区间外 → 该行不呈现（旧版插件看到「需新版」的资源不误报可下载）
    if (pluginVersion && !isInVersionRange(entry, pluginVersion)) continue;
    // 两种形态共用三态（missing / updated / ready），只有「怎么判就绪」不同：
    // doc 看文件 sha256，bundle 看解包目录里的标记（core/bundle-asset）
    const doc = entry.kind === 'bundle' ? await bundleStatus(app, entry) : await docStatus(app, entry);
    // 规模补充只在就绪态读（未下载时读本地产物无意义，白读盘）
    const extra = doc === 'ready' ? await readyExtra(app, id, entry) : null;
    rows.push({ id, name: entry.name, doc, skin: null, local: null, extra, size: entry.size ?? null });
  }
  return { rows, manifest };
}

/** 行状态 → 描述文案（设置项文案规范：一句自然句，无符号花样；就绪态捎带规模与体积） */
function rowDesc(st: RowState): string {
  const size = st.size !== null ? sizeText(st.size) : '';
  // 本地兜底行：没有清单就没有下载地址，能说的只有「装没装」与「为什么现在下不了」
  if (st.local === 'ready') return '已下载，可以正常使用（清单没拉到，暂时无法检查更新）';
  if (st.local === 'missing') return '尚未下载。资源清单没拉到（网络不可用），联网后可下载';
  if (st.skin) {
    const { ready, missing, updated } = st.skin;
    if (updated > 0) return missing > 0 ? `${updated} 套主题有更新，另有 ${missing} 套未下载` : `${updated} 套主题有更新，已就绪 ${ready} 套`;
    if (missing > 0) return `${missing} 套主题可下载，已就绪 ${ready} 套`;
    return `全部主题已是最新（已下载 ${ready} 套${size ? `，共 ${size}` : ''}）`;
  }
  if (st.doc === 'missing') return '尚未下载，下载后即可查看';
  if (st.doc === 'updated') return '有新版本，可更新到最新';
  if (st.doc === 'ready') {
    const inner = [st.extra, size].filter((x) => !!x).join('，');
    return inner ? `已是最新版本（${inner}）` : '已是最新版本';
  }
  return '等待检查更新';
}

/** 行状态 → 按钮文案与禁用态（更新优先于下载；两者并存的差额在描述里说清） */
function rowButton(st: RowState): { text: string; disabled: boolean } {
  // 本地兜底行恒禁用：没有清单就没有下载地址与 sha256，点下去只能转到 timeout
  if (st.local) return { text: st.local === 'ready' ? '已下载' : '下载', disabled: true };
  if (st.skin) {
    const { missing, updated } = st.skin;
    if (updated > 0) return { text: `更新 ${updated}`, disabled: false };
    if (missing > 0) return { text: missing > 1 ? `下载 ${missing}` : '下载', disabled: false };
    return { text: '已下载', disabled: true };
  }
  if (st.doc === 'missing') return { text: '下载', disabled: false };
  if (st.doc === 'updated') return { text: '更新', disabled: false };
  if (st.doc === 'ready') return { text: '已下载', disabled: true };
  return { text: '下载', disabled: true };
}

/** 该行是否属于这个组（组范围判据单源：两组的「全部更新」都按它取行） */
function inScope(id: string, scope: ResourceScope): boolean {
  if (id === SKINS_ROW_ID) return scope === 'resources'; // 皮肤聚合行恒属在线资源
  return scope === 'tools' ? toolIds.has(id) : !toolIds.has(id);
}

/** 待办统计：整行口径（皮肤行按「有缺或有更」算一行），供「全部更新」取数；按组范围过滤 */
function pendingOf(states: RowState[], scope: ResourceScope): { pending: number; updatable: number } {
  let pending = 0;
  let updatable = 0;
  for (const st of states) {
    if (!inScope(st.id, scope)) continue;
    if (st.skin) {
      if (st.skin.missing + st.skin.updated > 0) pending++;
      if (st.skin.updated > 0) updatable++;
      continue;
    }
    if (st.doc === 'missing' || st.doc === 'updated') {
      pending++;
      if (st.doc === 'updated') updatable++;
    }
  }
  return { pending, updatable };
}

/** 全部更新行的按钮态：字面**恒为动作词**（与行名同源，钮上不换成状态词——
 *  行名说动作、钮说状态，用户读到的就是「没有这个按钮」）。待办数只在有得做时缀上：
 *  无待办 → 全部更新（禁用；「没得做」由禁用态表达，就绪事实由各行自述）；有更新 → 全部更新 N；
 *  只有未下载 → 全部下载 N。无清单 → 等待检查更新（状态未知，不假装没得做）。
 *  按组范围取数：外部工具那行只说三个目录包的事，不会把文档/皮肤的待办算进来。 */
function allButton(states: RowState[], hasManifest: boolean, scope: ResourceScope): { text: string; disabled: boolean } {
  if (!hasManifest) return { text: '等待检查更新', disabled: true };
  const { pending, updatable } = pendingOf(states, scope);
  if (pending === 0) return { text: '全部更新', disabled: true };
  return { text: updatable > 0 ? `全部更新 ${pending}` : `全部下载 ${pending}`, disabled: false };
}

/** 组级动作行（两组各建一枚：行名相同、动手范围不同） */
function makeAllRow(scope: ResourceScope, states: RowState[], hasManifest: boolean): BtnRow {
  const ab = allButton(states, hasManifest, scope);
  return {
    type: 'button',
    name: '全部更新',
    desc: scope === 'tools' ? '一次处理三个工具包的未下载与更新' : '一次处理全部未下载与有更新的资源',
    buttonText: ab.text,
    disabled: ab.disabled,
    onClick: (ctx) => void runAll(ctx, scope),
  };
}

/**
 * 两个组：**外部工具**（知识盒 / 工具坞 / 脸谱三个目录包，kind='bundle'）在**在线资源**（文档 / 皮肤）之上。
 *
 * 为什么拆：这三个不是「文档类资源」，它们是**插件运行时真的要 spawn 的程序**——下载完还要
 * Node、值守还要注册自启。和更新日志/手册排在一个列表里，用户看不出这层区别（2026-10-28 用户拍板拆组）。
 *
 * 两组的行共用同一个状态机、同一张资源行表、同一条落盘事件同步链；差别只有两点：
 * 每组装哪些行（按清单条目 kind 分），以及各自那行「全部更新」的动手范围
 * （2026-10-29 用户要求：工具组也补一行，此前只能一行一行点）。
 * 「检查更新」只留在在线资源组：清单是全插件共用的一份，两组各摆一行是同一件事说两遍。
 */
export async function onlineResourcesGroups(): Promise<[GroupDecl, GroupDecl]> {
  const { rows: states, manifest } = await computeRowStates(getApp());
  const hasManifest = !!manifest;

  // 外部工具的 id 集合（组范围判据）：清单里 kind='bundle' 的条目；
  // 清单没拉到时是本地兜底那三行——它们本来就属于工具组
  toolIds = new Set((manifest?.docs ?? []).filter((d) => d.kind === 'bundle').map((d) => d.id));
  if (!manifest) for (const t of LOCAL_TOOL_ROWS) toolIds.add(t.id);

  retryVisible = !hasManifest || checkFailed;
  const checkRow: BtnRow = {
    type: 'button',
    name: '检查更新',
    desc: checkFailed ? '检查更新失败，可能是网络不可用' : '尚未检查更新',
    buttonText: checkFailed ? '重试' : '检查更新',
    // 显隐真相挂在模块位上：visibleWhen 与 DOM 补丁同读一处，别各存一份
    visibleWhen: () => retryVisible,
    onClick: (ctx) => void retryCheck(ctx),
  };
  retryRow = checkRow;

  const toolAllRow = makeAllRow('tools', states, hasManifest);
  const resAllRow = makeAllRow('resources', states, hasManifest);

  // 资源行（两组共用一张表；行对象按 id 建一次，组只是引用它）
  currentEntries = [];
  for (const st of states) {
    const btn = rowButton(st);
    currentEntries.push({
      id: st.id,
      row: {
        type: 'button',
        name: st.name,
        desc: rowDesc(st),
        buttonText: btn.text,
        disabled: btn.disabled,
        onClick: (ctx) => void runAction(ctx, st.id),
      },
    });
  }

  const rowOf = (id: string): BtnRow[] => currentEntries.filter((e) => e.id === id).map((e) => e.row);
  const toolRows = [...toolIds].flatMap(rowOf);
  const resRows = [checkRow, resAllRow, ...currentEntries.filter((e) => !toolIds.has(e.id)).map((e) => e.row)];

  // 两组各只有自己的行：外部工具 = 自己的全部更新 + 三个目录包；
  // 在线资源 = 检查更新 + 全部更新 + 文档/皮肤/数据表。
  // （2026-10-28 用户要求：工具单独成组、排在在线资源之上。此前按「行名 ∈ bundle id 集合」
  //  过滤——名字是给人看的、id 才是主键，永远匹配不上，于是外部工具组是空的、
  //  三个工具全混进在线资源里。）
  const toolsRows = [toolAllRow, ...toolRows];
  const tools: GroupDecl = { name: '外部工具', icon: 'wrench', rows: toolsRows };
  const resources: GroupDecl = { name: '在线资源', icon: 'cloud-download', rows: resRows };
  currentGroups = [
    { name: tools.name, scope: 'tools', rows: toolsRows, allRow: toolAllRow },
    { name: resources.name, scope: 'resources', rows: resRows, allRow: resAllRow },
  ];
  subscribeOnce();

  // 打开面板顺手核对一次（60s 节流；无论成败都记窗——失败也补丁呈现，不记窗补丁链会雪球式重核）
  if (Date.now() - lastCheckAt > CHECK_THROTTLE_MS) void checkInBackground();

  return [tools, resources];
}

/** 兼容入口：只要「在线资源」那一组（旧调用方与测试） */
export async function onlineResourcesGroup(): Promise<GroupDecl> {
  return (await onlineResourcesGroups())[1];
}

/** 下载事件订阅（幂等单例）：任何下载资产落盘（导航入口更新文档、分类表自动拉取、皮肤注入）
 *  都把已渲染行态同步成磁盘事实——派发方不感知本组存在（总线 fire-and-forget）。 */
let subscribed = false;
function subscribeOnce(): void {
  if (subscribed) return;
  subscribed = true;
  onDomainEvent(DOWNLOADS_CHANGED_EVENT, () => void syncLogged());
}

/** 同步出口（失败只留档不上抛）：后台事件 / 面板开启 / 动作收尾三面都是「算了就好」——
 *  吞掉未处理拒绝，但留一条 warn，别让「按钮没翻」变成无声谜案。 */
function syncLogged(): Promise<void> {
  return syncGroupRows().catch((e) => {
    console.warn('[bz] 在线资源状态同步失败:', (e as Error)?.message || e);
  });
}

/** 后台核对清单；成败都 syncGroupRows——失败态就在补丁里呈现。
 *  「重试」按钮直调本函数（不经尾部节流判断），失败后立即可重试。 */
async function checkInBackground(): Promise<void> {
  lastCheckAt = Date.now();
  try {
    await refreshManifest(getApp());
    checkFailed = false;
  } catch (e) {
    checkFailed = true;
    console.warn('[bz] 在线资源清单核对失败:', (e as Error)?.message || e);
  }
  await syncLogged();
}

/** 检查更新行动作：转圈 → 核对 → 门控重求值（行按需消失/留下 + 组徽标重算） */
async function retryCheck(ctx: SettingsRowContext): Promise<void> {
  const btn = ctx.rowEl.querySelector<HTMLButtonElement>('.bz-sp-btn') ?? undefined;
  const row = retryRow;
  setRowBtnState(btn, 'busy', '检查更新');
  if (row) row.disabled = true; // schema 面同步置忙：动作中重开的钮也点不动（busy 类只是 DOM 瞬态）
  await checkInBackground(); // 内部走 syncLogged：显隐/文案此刻已落定
  // 摘转圈 + 补一次补丁：上面那轮补丁把 busy 钮跳过了，摘后按刚落定的行态写回
  if (row) row.disabled = undefined;
  setRowBtnState(btn, 'idle', row?.buttonText ?? '检查更新');
  patchRenderedGroup();
  ctx.refreshVisibility();
}

/** 重算资源行状态（唯一刷新通道，单飞合流）：后台核对落地、下载动作完成、下载事件三处共用。
 *  合流窗内再来的请求只置脏不排队——本轮跑完补一轮，收尾态落在最后一次请求之后的磁盘事实上。 */
async function syncGroupRows(): Promise<void> {
  if (!currentGroups.length) return;
  if (syncRunning) {
    syncDirty = true;
    return syncRunning;
  }
  syncRunning = (async () => {
    try {
      do {
        syncDirty = false;
        await syncOnce();
      } while (syncDirty && currentGroups.length);
    } finally {
      syncRunning = null;
    }
  })();
  return syncRunning;
}

/** 单轮：读磁盘事实 → 就地改写行对象（下次重渲即新值）+ 已渲染组卡 DOM 补丁（打开中即所见即所得）。
 *  两组共用一次读盘：行对象是同一批引用，组只是把它们分开摆。 */
async function syncOnce(): Promise<void> {
  const meta = currentGroups;
  if (!meta.length) return;
  const { rows: states, manifest } = await computeRowStates(getApp());
  if (currentGroups !== meta) return; // 等待期间面板重开换了组（行对象已换代）→ 本轮结果作废

  const hasManifest = !!manifest;
  retryVisible = !hasManifest || checkFailed;
  if (retryRow) {
    retryRow.desc = checkFailed ? '检查更新失败，可能是网络不可用' : '尚未检查更新';
    retryRow.buttonText = checkFailed ? '重试' : '检查更新';
  }

  // 行集合变了（远端清单增删了条目、或 rowOrder 改了）= DOM 行数与行对象不再对位，硬补必然错位：
  // 本轮直接不补，等面板重开按新清单重建整组。低频事件，不值得为它加一条重渲通道。
  if (states.length !== currentEntries.length || states.some((st, i) => st.id !== currentEntries[i].id)) return;

  // 两组各自的「全部更新」按各自范围取数：工具行的待办不会算进在线资源那枚钮（反之亦然）
  for (const g of meta) {
    if (busyIds.has(allBusyId(g.scope))) continue;
    const ab = allButton(states, hasManifest, g.scope);
    g.allRow.buttonText = ab.text;
    g.allRow.disabled = ab.disabled;
  }

  for (const { id, row } of currentEntries) {
    if (busyIds.has(id)) continue; // 动作中：行态留给动作收尾那一轮写（此时写会把置忙抹掉）
    const st = states.find((s) => s.id === id);
    if (!st) continue;
    const btn = rowButton(st);
    row.name = st.name;
    row.desc = rowDesc(st);
    row.buttonText = btn.text;
    row.disabled = btn.disabled;
  }
  patchRenderedGroup();
}

/** 已渲染组卡的 DOM 补丁（行序 = 各组的 rows 序，操作行恒在组首）。
 *  检查更新行显隐在此直接落地：后台核对落地路径没有 ctx.refreshVisibility 可借；
 *  visibleWhen 已覆盖渲染/refresh 两条通用路径，这里同读 retryVisible 不冲突。 */
function patchRenderedGroup(): void {
  if (!currentGroups.length) return;
  for (const g of currentGroups) {
    document.querySelectorAll<HTMLElement>(`[data-sp-group="${g.name}"]`).forEach((card) => {
      const domRows = card.querySelectorAll<HTMLElement>('.bz-sp-group-body > .bz-sp-set-row');
      g.rows.forEach((row, i) => {
        const el = domRows[i];
        if (!el) return;
        const btnRow = row as BtnRow;
        // 搜索过滤亲手藏的行不碰 display（归 applyHitFilter 所有）
        if (retryRow && row === retryRow && el.dataset.spHitHidden !== '1') el.style.display = retryVisible ? '' : 'none';
        const desc = el.querySelector<HTMLElement>('.bz-sp-set-desc');
        if (desc) {
          const text = btnRow.desc ?? '';
          // 文案没变不写：写 textContent 会把搜索高亮的 <mark> 包裹拍平
          if (desc.textContent !== text) {
            desc.textContent = text;
            // 高亮快照同源更新，否则下次敲键 markHitText 会按旧文还原（本次更新被吞）
            if (desc.dataset.spOrig !== undefined) desc.dataset.spOrig = text;
          }
        }
        const btn = el.querySelector<HTMLButtonElement>('.bz-sp-btn');
        // 动作中的钮（busy 转圈）不接手：批量下载逐条事件扑面时别把转圈拍回 idle（成重复点击面）
        if (btn && !btn.classList.contains('bz-rowbtn--busy')) {
          setRowBtnState(btn, 'idle', btnRow.buttonText); // 清 busy/ok/fail 残留 + 恢复文案
          btn.disabled = btnRow.disabled === true;
        }
      });
    });
  }
}

/** 单条资源的下载（皮肤聚合行走批量入口）；失败抛错，由调用方决定通知口径 */
async function downloadOne(app: unknown, manifest: DownloadManifest, id: string): Promise<void> {
  if (id === SKINS_ROW_ID) {
    const r = await downloadSkinUpdates(app, manifest);
    if (r.failed > 0) throw new Error(`${r.failed} 套主题下载失败，可稍后重试`);
    return;
  }
  const entry: ManifestDocEntry | undefined = manifest.docs.find((d) => d.id === id);
  if (!entry) return;
  // 目录包：解包 + 落就绪标记，然后（工具类）走下载后初始化
  if (entry.kind === 'bundle') {
    await installBundle(app, entry);
    // 工具 id 带 `tool-` 前缀（清单里与文档资源同表，前缀是给人看的分组线索）。
    // 只有值守需要「初始化」这一步（注册登录自启）；另两个落盘即完成。
    const toolId = id.replace(/^tool-/, '');
    if (isToolBundleId(toolId)) await setupAfterInstall(app, toolId);
    return;
  }
  // 走 sha256 校验通道（与皮肤同口径）：清单 hash 对不上即拒收，不把坏内容写进本地
  await ensureAssetWithHash(app, entry.file, entry.sha256, entry.name, entry.size);
}

/** 组级动作的忙位（两组各一枚：同时点两组的「全部更新」互不阻塞，自己重入仍被拦） */
function allBusyId(scope: ResourceScope): string {
  return `${ALL_BUSY_ID}:${scope}`;
}

/** 单行动作：置忙 → 下载 → 收尾按磁盘事实落定 */
async function runAction(ctx: SettingsRowContext, id: string): Promise<void> {
  // 拦重入要在首个 await 之前：读缓存清单是个让位点（慢盘），让位点上再来的第二击
  // 此时 busy 类还没上、busyIds 也还空着——只拦不置忙等于没拦，两击会并发跑两轮下载。
  if (busyIds.has(id)) return;
  busyIds.add(id);
  const btn = ctx.rowEl.querySelector<HTMLButtonElement>('.bz-sp-btn') ?? undefined;
  const row = currentEntries.find((e) => e.id === id)?.row;
  setRowBtnState(btn, 'busy', btn?.textContent ?? '下载');
  if (row) row.disabled = true; // schema 面同步置忙：动作中重开的钮也点不动（busy 类只是 DOM 瞬态）
  try {
    const app = getApp();
    // 清单已不可用（禁用态理论不可达）→ 不动作，尾段按磁盘事实就地校正
    const manifest = await cachedManifest(app);
    if (manifest) await downloadOne(app, manifest, id);
  } catch (e) {
    notice(e instanceof Error ? e.message : String(e), 'error');
  }
  busyIds.delete(id); // 撤忙要在同步之前：下面那轮才把本行按磁盘事实写回
  await syncLogged(); // 动作完成（成败皆然）→ 磁盘事实已变，行对象落定真态（补丁此刻跳过 busy 钮）
  // 摘转圈 + 补一次补丁：上面那轮补丁把动作钮跳过了，摘后按刚落定的行态写回（不留「旧文案可点」窗口）
  setRowBtnState(btn, 'idle', row?.buttonText ?? '下载');
  patchRenderedGroup();
}

/**
 * 全部更新（组级动作）：按行序逐条跑**本组**未就绪行，每条落盘后同步一次——逐条可见进展，
 * 而不是憋到最后一起翻。失败行聚合计数，收尾一条 error 通知；单行动作正在跑的行跳过不抢。
 *
 * 范围由 `scope` 定（2026-10-29：外部工具组也有这一行）：组内的行才动手，
 * 另一组按自己的进度照常跑——两枚钮各管各的，不互相等也不重复下。
 */
async function runAll(ctx: SettingsRowContext, scope: ResourceScope): Promise<void> {
  const busy = allBusyId(scope);
  if (busyIds.has(busy)) return; // 拦重入同单行：置忙提到首个 await 之前
  busyIds.add(busy);
  const btn = ctx.rowEl.querySelector<HTMLButtonElement>('.bz-sp-btn') ?? undefined;
  const allRow = currentGroups.find((g) => g.scope === scope)?.allRow;
  setRowBtnState(btn, 'busy', btn?.textContent ?? '全部更新');
  if (allRow) allRow.disabled = true;

  let failed = 0;
  try {
    const app = getApp();
    const manifest = await cachedManifest(app);
    // 清单不可用（禁用态理论不可达）→ 不动作，尾段按磁盘事实就地校正
    if (manifest) {
      const { rows: states } = await computeRowStates(app);
      for (const st of states) {
        if (!inScope(st.id, scope)) continue; // 另一组的行不归这枚钮管
        if (busyIds.has(st.id)) continue; // 单行动作正在跑 → 跳过，不抢
        const isPending = st.skin ? st.skin.missing + st.skin.updated > 0 : st.doc === 'missing' || st.doc === 'updated';
        if (!isPending) continue;
        busyIds.add(st.id);
        const row = currentEntries.find((e) => e.id === st.id)?.row;
        if (row) row.disabled = true; // 逐行置忙：跑到的行在 schema 面也点不动
        try {
          await downloadOne(app, manifest, st.id);
        } catch (e) {
          failed++;
          console.warn(`[bz] 在线资源「${st.name}」下载失败:`, (e as Error)?.message || e);
        } finally {
          busyIds.delete(st.id);
        }
        await syncLogged(); // 每条落盘即刷新（逐条可见，不是憋到最后）
      }
    }
  } catch (e) {
    notice(e instanceof Error ? e.message : String(e), 'error');
  }

  busyIds.delete(busy);
  await syncLogged();
  if (failed > 0) notice(`${failed} 项下载失败，可稍后重试`, 'error');
  // 摘转圈：补丁刻意绕过 busy 钮（见 patchRenderedGroup），不摘会一直转
  setRowBtnState(btn, 'idle', allRow?.buttonText ?? '全部更新');
  patchRenderedGroup();
}

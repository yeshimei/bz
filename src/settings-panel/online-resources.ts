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
import { loadCategoryTable } from '../core/category-table';
import { loadRssCatalog, catalogCategoryCounts } from '../core/rss-catalog';

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
};

/** 打开面板时后台核对的节流窗（快速开关面板不狂拉；启动链每次启动独立跑不受此限） */
const CHECK_THROTTLE_MS = 60_000;
let lastCheckAt = 0;
/** 本次会话最近一次核对是否失败（检查更新行据此呈失败文案与「重试」） */
let checkFailed = false;
/** 组内行按钮（button 行窄档；行对象可变——syncGroupRows 就地改写，下次重渲即新值） */
type BtnRow = Extract<SettingsRow, { type: 'button' }>;

/** 组行引用账（构建期建立；行对象是重渲真相源，已渲染 DOM 另走 patchRenderedGroup 补丁） */
interface GroupMeta {
  /** 与 group.rows 同引用（DOM 行序 = 此序，补丁按序对位） */
  rows: SettingsRow[];
  /** 检查更新行（恒在 rows[0]，visibleWhen 门控显隐；desc/buttonText 随核对结果就地翻转） */
  retryRow: BtnRow;
  /** 全部更新行（恒在 rows[1]；无待办时禁用，无清单时呈「等待检查更新」） */
  allRow: BtnRow;
  /** 资源行（id → 行对象；顺序 = 清单 rowOrder） */
  entries: Array<{ id: string; row: BtnRow }>;
  /** 检查更新行显隐真相（visibleWhen 与本模块 DOM 补丁同读此位） */
  retryVisible: boolean;
}
let currentGroup: GroupMeta | null = null;
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
  currentGroup = null;
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
  /** 描述里的规模补充（如「26 组 515 条」）；无则 null */
  extra: string | null;
  /** 该行资源的体积（doc = 清单 size；皮肤 = 区间内各套合计）；无信息 null */
  size: number | null;
}

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

/** 组内容一次性算齐（缓存清单 + 本地文件实测）；无清单 → 没有资源行（只剩操作行） */
async function computeRowStates(app: unknown): Promise<{ rows: RowState[]; manifest: DownloadManifest | null }> {
  const manifest = await cachedManifest(app);
  if (!manifest) return { rows: [], manifest: null };
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
        extra: null,
        size: skinTotalSize(manifest, pluginVersion),
      });
      continue;
    }
    const entry = manifest.docs.find((d) => d.id === id);
    if (!entry) continue;
    // 版本区间外 → 该行不呈现（旧版插件看到「需新版」的资源不误报可下载）
    if (pluginVersion && !isInVersionRange(entry, pluginVersion)) continue;
    const doc = await docStatus(app, entry);
    // 规模补充只在就绪态读（未下载时读本地产物无意义，白读盘）
    const extra = doc === 'ready' && DESC_EXTRAS[id] ? await DESC_EXTRAS[id](app, entry) : null;
    rows.push({ id, name: entry.name, doc, skin: null, extra, size: entry.size ?? null });
  }
  return { rows, manifest };
}

/** 行状态 → 描述文案（设置项文案规范：一句自然句，无符号花样；就绪态捎带规模与体积） */
function rowDesc(st: RowState): string {
  const size = st.size !== null ? sizeText(st.size) : '';
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

/** 待办统计：整行口径（皮肤行按「有缺或有更」算一行），供全部更新行取数 */
function pendingOf(states: RowState[]): { pending: number; updatable: number } {
  let pending = 0;
  let updatable = 0;
  for (const st of states) {
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

/** 全部更新行的按钮态：无待办 → 已是最新（禁用）；有更新 → 全部更新 N；只有未下载 → 全部下载 N。
 *  无清单 → 等待检查更新（状态未知，不假装「已是最新」）。 */
function allButton(states: RowState[], hasManifest: boolean): { text: string; disabled: boolean } {
  if (!hasManifest) return { text: '等待检查更新', disabled: true };
  const { pending, updatable } = pendingOf(states);
  if (pending === 0) return { text: '已是最新', disabled: true };
  return { text: updatable > 0 ? `全部更新 ${pending}` : `全部下载 ${pending}`, disabled: false };
}

/**
 * 「在线资源」组（通用域 schema loader 尾部追加；ADR-0205 起为 async——本地状态现算后建声明行）。
 * 行序：检查更新（可视状态门控）→ 全部更新 → 资源行（清单 rowOrder）；全部 button 行。
 */
export async function onlineResourcesGroup(): Promise<GroupDecl> {
  const { rows: states, manifest } = await computeRowStates(getApp());
  const hasManifest = !!manifest;

  const meta: GroupMeta = {
    rows: [],
    retryRow: null as unknown as BtnRow,
    allRow: null as unknown as BtnRow,
    entries: [],
    retryVisible: !hasManifest || checkFailed,
  };
  const retryRow: BtnRow = {
    type: 'button',
    name: '检查更新',
    desc: checkFailed ? '检查更新失败，可能是网络不可用' : '尚未检查更新',
    buttonText: checkFailed ? '重试' : '检查更新',
    visibleWhen: () => meta.retryVisible,
    onClick: (ctx) => void retryCheck(ctx),
  };
  meta.retryRow = retryRow;
  meta.rows.push(retryRow);

  const ab = allButton(states, hasManifest);
  const allRow: BtnRow = {
    type: 'button',
    name: '全部更新',
    desc: '一次处理全部未下载与有更新的资源',
    buttonText: ab.text,
    disabled: ab.disabled,
    onClick: (ctx) => void runAll(ctx),
  };
  meta.allRow = allRow;
  meta.rows.push(allRow);

  for (const st of states) {
    const btn = rowButton(st);
    const row: BtnRow = {
      type: 'button',
      name: st.name,
      desc: rowDesc(st),
      buttonText: btn.text,
      disabled: btn.disabled,
      onClick: (ctx) => void runAction(ctx, st.id),
    };
    meta.rows.push(row);
    meta.entries.push({ id: st.id, row });
  }
  currentGroup = meta;
  subscribeOnce();

  // 打开面板顺手核对一次（60s 节流；无论成败都记窗——失败也补丁呈现，不记窗补丁链会雪球式重核）
  if (Date.now() - lastCheckAt > CHECK_THROTTLE_MS) void checkInBackground();
  return { name: '在线资源', icon: 'cloud-download', rows: meta.rows };
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
  const retryRow = currentGroup?.retryRow;
  setRowBtnState(btn, 'busy', '检查更新');
  if (retryRow) retryRow.disabled = true; // schema 面同步置忙：动作中重开的钮也点不动（busy 类只是 DOM 瞬态）
  await checkInBackground(); // 内部走 syncLogged：显隐/文案此刻已落定
  // 摘转圈 + 补一次补丁：上面那轮补丁把 busy 钮跳过了，摘后按刚落定的行态写回
  if (retryRow) retryRow.disabled = undefined;
  setRowBtnState(btn, 'idle', retryRow?.buttonText ?? '检查更新');
  patchRenderedGroup();
  ctx.refreshVisibility();
}

/** 重算资源行状态（唯一刷新通道，单飞合流）：后台核对落地、下载动作完成、下载事件三处共用。
 *  合流窗内再来的请求只置脏不排队——本轮跑完补一轮，收尾态落在最后一次请求之后的磁盘事实上。 */
async function syncGroupRows(): Promise<void> {
  if (!currentGroup) return;
  if (syncRunning) {
    syncDirty = true;
    return syncRunning;
  }
  syncRunning = (async () => {
    try {
      do {
        syncDirty = false;
        await syncOnce();
      } while (syncDirty && currentGroup);
    } finally {
      syncRunning = null;
    }
  })();
  return syncRunning;
}

/** 单轮：读磁盘事实 → 就地改写行对象（下次重渲即新值）+ 已渲染组卡 DOM 补丁（打开中即所见即所得） */
async function syncOnce(): Promise<void> {
  const meta = currentGroup;
  if (!meta) return;
  const { rows: states, manifest } = await computeRowStates(getApp());
  if (currentGroup !== meta) return; // 等待期间面板重开换了组（行对象已换代）→ 本轮结果作废

  const hasManifest = !!manifest;
  meta.retryVisible = !hasManifest || checkFailed;
  meta.retryRow.desc = checkFailed ? '检查更新失败，可能是网络不可用' : '尚未检查更新';
  meta.retryRow.buttonText = checkFailed ? '重试' : '检查更新';

  // 行集合变了（远端清单增删了条目、或 rowOrder 改了）= DOM 行数与行对象不再对位，硬补必然错位：
  // 本轮直接不补，等面板重开按新清单重建整组。低频事件，不值得为它加一条重渲通道。
  if (states.length !== meta.entries.length || states.some((st, i) => st.id !== meta.entries[i].id)) return;

  if (!busyIds.has(ALL_BUSY_ID)) {
    const ab = allButton(states, hasManifest);
    meta.allRow.buttonText = ab.text;
    meta.allRow.disabled = ab.disabled;
  }

  for (const { id, row } of meta.entries) {
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

/** 已渲染组卡的 DOM 补丁（行序 = meta.rows 序，检查更新行恒在首位）。
 *  检查更新行显隐在此直接落地：后台核对落地路径没有 ctx.refreshVisibility 可借；
 *  visibleWhen 已覆盖渲染/refresh 两条通用路径，这里同读 meta.retryVisible 不冲突。 */
function patchRenderedGroup(): void {
  const meta = currentGroup;
  if (!meta) return;
  document.querySelectorAll<HTMLElement>('[data-sp-group="在线资源"]').forEach((card) => {
    const domRows = card.querySelectorAll<HTMLElement>('.bz-sp-group-body > .bz-sp-set-row');
    meta.rows.forEach((row, i) => {
      const el = domRows[i];
      if (!el) return;
      const btnRow = row as BtnRow;
      // 搜索过滤亲手藏的行不碰 display（归 applyHitFilter 所有）
      if (row === meta.retryRow && el.dataset.spHitHidden !== '1') el.style.display = meta.retryVisible ? '' : 'none';
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

/** 单条资源的下载（皮肤聚合行走批量入口）；失败抛错，由调用方决定通知口径 */
async function downloadOne(app: unknown, manifest: DownloadManifest, id: string): Promise<void> {
  if (id === SKINS_ROW_ID) {
    const r = await downloadSkinUpdates(app, manifest);
    if (r.failed > 0) throw new Error(`${r.failed} 套主题下载失败，可稍后重试`);
    return;
  }
  const entry: ManifestDocEntry | undefined = manifest.docs.find((d) => d.id === id);
  if (!entry) return;
  // 走 sha256 校验通道（与皮肤同口径）：清单 hash 对不上即拒收，不把坏内容写进本地
  await ensureAssetWithHash(app, entry.file, entry.sha256, entry.name);
}

/** 单行动作：置忙 → 下载 → 收尾按磁盘事实落定 */
async function runAction(ctx: SettingsRowContext, id: string): Promise<void> {
  // 拦重入要在首个 await 之前：读缓存清单是个让位点（慢盘），让位点上再来的第二击
  // 此时 busy 类还没上、busyIds 也还空着——只拦不置忙等于没拦，两击会并发跑两轮下载。
  if (busyIds.has(id)) return;
  busyIds.add(id);
  const btn = ctx.rowEl.querySelector<HTMLButtonElement>('.bz-sp-btn') ?? undefined;
  const row = currentGroup?.entries.find((e) => e.id === id)?.row;
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
 * 全部更新（组级动作）：按行序逐条跑未就绪行，每条落盘后同步一次——逐条可见进展，
 * 而不是憋到最后一起翻。失败行聚合计数，收尾一条 error 通知；单行动作正在跑的行跳过不抢。
 */
async function runAll(ctx: SettingsRowContext): Promise<void> {
  if (busyIds.has(ALL_BUSY_ID)) return; // 拦重入同单行：置忙提到首个 await 之前
  busyIds.add(ALL_BUSY_ID);
  const btn = ctx.rowEl.querySelector<HTMLButtonElement>('.bz-sp-btn') ?? undefined;
  const allRow = currentGroup?.allRow;
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
        if (busyIds.has(st.id)) continue; // 单行动作正在跑 → 跳过，不抢
        const isPending = st.skin ? st.skin.missing + st.skin.updated > 0 : st.doc === 'missing' || st.doc === 'updated';
        if (!isPending) continue;
        busyIds.add(st.id);
        const row = currentGroup?.entries.find((e) => e.id === st.id)?.row;
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

  busyIds.delete(ALL_BUSY_ID);
  await syncLogged();
  if (failed > 0) notice(`${failed} 项下载失败，可稍后重试`, 'error');
  // 摘转圈：补丁刻意绕过 busy 钮（见 patchRenderedGroup），不摘会一直转
  setRowBtnState(btn, 'idle', allRow?.buttonText ?? '全部更新');
  patchRenderedGroup();
}

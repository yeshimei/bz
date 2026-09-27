/* ============================================================
 * bz · 设置面板「在线资源」组（settings-panel/online-resources.ts）——ADR-0203 / ADR-0205
 *
 * 通用域最后一组：更新日志 / 使用手册 / 主题 / 归物分类表四行统一状态机
 * （未下载 → 下载 [N]；有更新 → 更新 N；已最新 → 已下载 禁用；动作中转圈禁用）。
 * ADR-0205：整组为**通用声明行**（button 行 + visibleWhen 门控 + 行按钮三态助手），
 * 自绘 bz-sp-res 骨架退役——行视觉与其余组零漂移。
 * 状态永远从**磁盘单源**现算（缓存清单 + 本地文件 sha256），组内不持久任何状态；
 * 构建期本地现算一次，打开面板顺手后台核对一次清单（60s 节流），
 * 失败有缓存沿用缓存渲染 + 检查更新行留档；无缓存四行禁用 + 检查更新行置顶。
 * **跨入口同步**：导航入口更新文档 / 分类表自动拉取落盘后，本组订阅下载事件把行态
 * 同步成磁盘事实（issue 492 用户拍板：更新日志入口更新后组内按钮要翻「已下载」）。
 * **半自动铁则的 UI 面**：本组按钮与手册/日志导航入口是仅有的两个下载触发点。
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
  type DocStatus,
  type DownloadManifest,
  type ManifestDocEntry,
} from '../core/download-manifest';
import { downloadSkinUpdates, skinStatus, type SkinStatus } from '../core/skin-pack';
import { ensureAssetWithHash } from '../core/remote-asset';
import { loadCategoryTable } from '../core/category-table';

/** 无缓存清单时的行骨架（行名内置；有清单后以清单 name 为准）。分类表排皮肤之后（数据表跟在文档/皮肤后面，行序稳定） */
const FALLBACK_ROWS: Array<{ id: string; name: string }> = [
  { id: 'changelog', name: '更新日志' },
  { id: 'manual', name: '使用手册' },
  { id: 'skins', name: '主题' },
  { id: 'belongings-categories', name: '归物分类表' },
];

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
  /** 四资源行（id → 行对象） */
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
  /** 清单条目 id（动作分发用） */
  id: string;
  /** 行名（清单 name 优先，回退内置表） */
  name: string;
  /** doc 行状态；皮肤行/无清单 null */
  doc: DocStatus | null;
  /** 皮肤行三态计数；doc 行/无清单 null */
  skin: SkinStatus | null;
  /** 分类表行专用：本地已就绪表的规模（归物本 AI 归类与选择器的候选池），其余行 null */
  catInfo: { groups: number; items: number } | null;
}

/** 组内容一次性算齐（缓存清单 + 本地文件实测） */
async function computeRowStates(app: unknown): Promise<{ rows: RowState[]; manifest: DownloadManifest | null }> {
  const manifest = await cachedManifest(app);
  const rows: RowState[] = [];
  for (const fb of FALLBACK_ROWS) {
    if (fb.id === 'skins') {
      rows.push({ id: fb.id, name: fb.name, doc: null, skin: manifest ? await skinStatus(app, manifest) : null, catInfo: null });
    } else {
      const entry = manifest?.docs.find((d) => d.id === fb.id) ?? null;
      const doc = entry ? await docStatus(app, entry) : null;
      // 分类表行：就绪时把表规模读出来（loadCategoryTable 有内存缓存，二次打开零读盘）
      let catInfo: RowState['catInfo'] = null;
      if (fb.id === 'belongings-categories' && doc === 'ready') {
        const t = await loadCategoryTable(app);
        if (t) catInfo = { groups: t.groups.length, items: t.groups.reduce((n, g) => n + g.items.length, 0) };
      }
      rows.push({
        id: fb.id,
        name: entry?.name ?? fb.name,
        doc,
        skin: null,
        catInfo,
      });
    }
  }
  return { rows, manifest };
}

/** 行状态 → 描述文案（设置项文案规范：一句自然句，无符号花样；皮肤行明示已下载套数） */
function rowDesc(st: RowState): string {
  if (st.skin) {
    const { ready, missing, updated } = st.skin;
    if (updated > 0) return missing > 0 ? `${updated} 套主题有更新，另有 ${missing} 套未下载` : `${updated} 套主题有更新，已就绪 ${ready} 套`;
    if (missing > 0) return `${missing} 套主题可下载，已就绪 ${ready} 套`;
    return `全部主题已是最新（已下载 ${ready} 套）`;
  }
  if (st.doc === 'missing') return '尚未下载，下载后即可查看';
  if (st.doc === 'updated') return '有新版本，可更新到最新';
  if (st.doc === 'ready') {
    return st.catInfo ? `已是最新版本（${st.catInfo.groups} 组 ${st.catInfo.items} 条）` : '已是最新版本';
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
  // 清单在但该 id 未登记（或无清单）= 状态未知：按钮禁用（等信息到位，不误导「已是最新」）
  return { text: '下载', disabled: true };
}

/**
 * 「在线资源」组（通用域 schema loader 尾部追加；ADR-0205 起为 async——本地状态现算后建声明行）。
 * 行序：检查更新（可视状态门控）+ 四资源行；全部 button 行，走两个渲染器的通用分支。
 */
export async function onlineResourcesGroup(): Promise<GroupDecl> {
  const { rows: states, manifest } = await computeRowStates(getApp());
  const hasManifest = !!manifest;

  const meta: GroupMeta = {
    rows: [],
    retryRow: null as unknown as BtnRow,
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

/** 重算四行状态（唯一刷新通道，单飞合流）：后台核对落地、下载动作完成、下载事件三处共用。
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

/** 行动作：doc → ensureAssetWithHash（覆盖写）；皮肤 → downloadSkinUpdates（拉全部非就绪） */
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
    if (manifest) {
      if (id === 'skins') {
        const r = await downloadSkinUpdates(app, manifest);
        if (r.failed > 0) notice(`${r.failed} 套主题下载失败，可稍后重试`, 'error');
      } else {
        const entry: ManifestDocEntry | undefined = manifest.docs.find((d) => d.id === id);
        // 走 sha256 校验通道（与皮肤同口径）：清单 hash 对不上即拒收，不把坏内容写进本地
        if (entry) await ensureAssetWithHash(app, entry.file, entry.sha256, entry.name);
      }
    }
  } catch (e) {
    notice(e instanceof Error ? e.message : String(e), 'error');
  }
  busyIds.delete(id); // 撤忙要在同步之前：下面那轮才把本行按磁盘事实写回
  await syncLogged(); // 动作完成（成败皆然）→ 磁盘事实已变，行对象落定真态（补丁此刻跳过 busy 钮）
  // 摘转圈 + 补一次补丁：上面那轮补丁把动作钮跳过了，摘后按刚落定的行态写回（不留「旧文案可点」窗口）
  setRowBtnState(btn, 'idle', row?.buttonText ?? '下载');
  patchRenderedGroup();
}

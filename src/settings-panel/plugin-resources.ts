/* ============================================================
 * bz · 设置面板「插件」组（settings-panel/plugin-resources.ts）
 *
 * 2026-11-05 用户要求：在「外部工具」上面加一组「插件」，组首「全部更新」，
 * 每个配套插件一行显示版本号，右侧两个按钮 —— GitHub（跳仓库）+ 安装/更新。
 * 「自动更新」开着时，启动链会顺带把它们更到最新（core/reader-install.autoUpdateCompanionPlugins）；
 * 关着时这组只显示「新版 x.y.z」，用户点「更新」才装。
 *
 * 2026-11-22 用户要求把 bz review 也纳进来：一组里两个插件（reader → review），
 * 装 / 更 / 探针全部同构。顺序有意义——review 的卡片来源是 reader 的划线。
 *
 * 数据只有两个来源：
 *  - 本机：core/reader-install.readPluginInstall（磁盘 manifest + Obsidian 清单，以磁盘为准）；
 *  - 远端：core/reader-install.fetchLatestPluginRelease（GitHub 主 → 码云备）。
 * 打开面板先按本机状态渲染，最新版后台查到后补丁 DOM（同 online-resources 的做法），
 * 不让一次网络请求卡住设置面板。
 * ============================================================ */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { openExternalUrl } from '../core/utils';
import type { GroupDecl, InfoRow, SettingsRow, SettingsRowContext } from '../core/settings-schema';
import { setRowBtnState } from '../core/settings-btn-state';
import {
  COMPANION_SPECS,
  fetchLatestPluginRelease,
  installPlugin,
  isPluginHealthy,
  pluginActionOf,
  readPluginInstall,
  type PluginInstallState,
  type PluginSpec,
} from '../core/reader-install';

/** 组名（DOM 补丁按 data-sp-group 对位；改这里要同步测试） */
export const PLUGIN_GROUP_NAME = '插件';
/** 组图标（lucide） */
const GROUP_ICON = 'puzzle';

type BtnRow = Extract<SettingsRow, { type: 'button' }>;

/**
 * GitHub 标记（feather 那只描边猫，与「关于」组 GitHub 行的行图标同一支形状——
 * 那边 12px 画在淡色方块里，这里 13px 直接摆在字前面，看着才是同一个入口）。
 * 吃 currentColor：钮的悬停/禁用/明暗主题由 button 自己管，图标不另立颜色。
 */
const GITHUB_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 00-.9-2.6c3.1-.4 6.4-1.5 6.4-7A5.4 5.4 0 0020 4.8 5.1 5.1 0 0019.9 1S18.7.7 16 2.5a13.4 13.4 0 00-7 0C6.3.7 5.1 1 5.1 1A5.1 5.1 0 005 4.8 5.4 5.4 0 003.5 8.5c0 5.4 3.3 6.6 6.4 7a3.4 3.4 0 00-.9 2.6V22"/></svg>';

/** 插件目录里的一行（读状态/安装按 id 分派） */
export interface PluginEntry {
  id: string;
  name: string;
  repoUrl: string;
}

/** 一行的全部运行期状态（每插件一份） */
interface EntryState {
  spec: PluginSpec;
  /** 已确认的最新版（查询失败/未完成 → null） */
  latest: string | null;
  checked: boolean;
  failed: boolean;
  /** 构建期建一次；syncRows 就地改写，下次重渲即新值 */
  row: InfoRow | null;
}

export const PLUGIN_ENTRIES: PluginEntry[] = COMPANION_SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  repoUrl: `https://github.com/${spec.repoSlug}`,
}));

/** 本会话状态：按插件 id 存，重开面板先用上次值渲染，后台再核对一次 */
const stateOf = new Map<string, EntryState>();
let currentAllRow: BtnRow | null = null;
let latestToken = 0;
/** 组级 / 单行动作的忙位（一次只跑一个插件，全部更新串行） */
let busy = false;

function entryOf(spec: PluginSpec): EntryState {
  let entry = stateOf.get(spec.id);
  if (!entry) {
    entry = { spec, latest: null, checked: false, failed: false, row: null };
    stateOf.set(spec.id, entry);
  }
  return entry;
}

/**
 * 当前可用的最新版：只有**查询成功**才认缓存值。
 * 未查完 / 查询失败 → null（不替用户猜有新版，也不拿上一次的旧值冒充本次结果）。
 */
function confirmedLatest(entry: EntryState): string | null {
  return entry.checked && !entry.failed ? entry.latest : null;
}

/** 版本文案（用户要的版本号就长在这句里） */
export function pluginDescOf(state: PluginInstallState, latest: string | null): string {
  if (!isPluginHealthy(state)) return '未安装';
  const head = `已安装 ${state.version || '版本未知'}`;
  if (pluginActionOf(state, latest) === 'update') return `${head} · 新版 ${latest}`;
  return head;
}

/**
 * 已装且**没有确认的新版** → 行里连「安装」钮都不留。
 * 2026-11-05 用户要求（原话）：已安装就隐藏安装按钮、只显示 GitHub，有更新才显示更新按钮。
 * 此前那枚灰的「已安装」钮既点不动、又占着位置，等于把「没有动作」画成一个动作。
 */
function actionVisible(entry: EntryState, state: PluginInstallState): boolean {
  return pluginActionOf(state, confirmedLatest(entry)) !== 'none';
}

/**
 * 行内动作钮文字（只在钮露出来时有意义）。
 *
 * 2026-11-05 用户报障：打开面板先看到「更新」，点一下才变「已安装」灰——因为旧逻辑在
 * 「最新版还没查到」时写「更新」，等于替用户猜「有新版」。现在的口径更硬：**只有确认**
 * 有新版，这枚钮才露出来写「更新」；最新版未知/查询失败/已是最新，钮根本不在
 * （见 actionVisible）——不拿文案去表达「什么都不用做」。
 */
function actionTextOf(entry: EntryState, state: PluginInstallState): string {
  return pluginActionOf(state, confirmedLatest(entry)) === 'install' ? '安装' : '更新';
}

/** 有没有待办：未装 / 半装 / 有新版。最新版未知时按「可点」处理（点下去现查） */
function hasWork(entry: EntryState, state: PluginInstallState): boolean {
  if (pluginActionOf(state, confirmedLatest(entry)) !== 'none') return true;
  return !entry.checked || entry.failed;
}

/** 一行（info 型）：GitHub + 安装/更新 */
function buildInfoRow(entry: EntryState, state: PluginInstallState): InfoRow {
  const row: InfoRow = {
    type: 'info',
    name: entry.spec.name,
    // 右列已有两个按钮，再挂一枚同名徽标只会把按钮挤窄（与关于组「版本」行同口径）
    hideBadge: true,
    desc: pluginDescOf(state, confirmedLatest(entry)),
    // 动作恒占两个位（补丁按位置对位），第二个按状态显隐：已装且没有新版 → 收起
    actions: [
      {
        text: 'GitHub',
        iconHtml: GITHUB_ICON,
        onClick: () => openExternalUrl(getApp(), `https://github.com/${entry.spec.repoSlug}`),
      },
      {
        text: actionTextOf(entry, state),
        cta: true,
        hidden: !actionVisible(entry, state),
        onClick: (_value, ctx) => void runUpdateRow(ctx, entry.spec),
      },
    ],
  };
  entry.row = row;
  return row;
}

/**
 * 组首「全部更新」：只要还有插件可能要做点什么就可点。
 * 最新版还没查回来的插件按「可点」算（点下去现查），与行内按钮同一口径。
 */
function buildAllRow(): BtnRow {
  const work = COMPANION_SPECS.some((spec) => {
    const entry = entryOf(spec);
    if (!entry.checked || entry.failed) return true;
    return entry.row?.actions?.[1]?.hidden === false;
  });
  return {
    type: 'button',
    name: '全部更新',
    desc: '把插件更新到最新版',
    buttonText: '全部更新',
    disabled: !work,
    onClick: (ctx) => void runUpdateAll(ctx),
  };
}

/**
 * 「插件」组：组首「全部更新」，下面每插件一行。
 * 异步只为读本机状态（磁盘小文件）；最新版在返回后后台查，查到再补丁。
 */
export async function pluginResourcesGroup(): Promise<GroupDecl> {
  const app = getApp();
  const rows: SettingsRow[] = [];
  for (const spec of COMPANION_SPECS) {
    const entry = entryOf(spec);
    const state = await readPluginInstall(app, spec);
    rows.push(buildInfoRow(entry, state));
  }
  currentAllRow = buildAllRow();

  // 后台核对最新版（不阻塞面板）；失败静默，行里继续显示本机版本。
  // catch 兜住尾部的 syncRows：面板关掉/测试环境拆除后 getApp() 会抛，不能变成 unhandled rejection。
  void refreshLatest().catch((e) => {
    console.warn('[bz] 插件组刷新失败（已静默）:', (e as Error)?.message || e);
  });
  // 缓存命中（刚刚查过）时把「收起 / 露出」同步到已渲染按钮上——
  // info 行的 actions 没有 disabled 字段，显隐也只能渲染后补
  setTimeout(() => patchRenderedGroup(), 0);
  return { name: PLUGIN_GROUP_NAME, icon: GROUP_ICON, rows: [currentAllRow, ...rows] };
}

/** 核对所有插件的最新版（唯一刷新通道）：查到/失败都回落 syncRows + DOM 补丁 */
async function refreshLatest(): Promise<void> {
  const token = ++latestToken;
  await Promise.all(
    COMPANION_SPECS.map(async (spec) => {
      const entry = entryOf(spec);
      try {
        const rel = await fetchLatestPluginRelease(spec);
        if (token !== latestToken) return;
        entry.latest = rel.version;
        entry.checked = true;
        entry.failed = false;
      } catch (e) {
        if (token !== latestToken) return;
        entry.checked = true;
        entry.failed = true;
        console.warn(`[bz] ${spec.name} 最新版核对失败（已静默）:`, (e as Error)?.message || e);
      }
    }),
  );
  try {
    await syncRows();
    patchRenderedGroup();
  } catch (e) {
    // 跑完时面板可能已经关了（测试里 app 也可能已被清理）：这一轮结果作废即可
    console.warn('[bz] 插件行状态刷新失败（已静默）:', (e as Error)?.message || e);
  }
}

/** 按磁盘事实改写行对象（下次重渲即新值） */
async function syncRows(): Promise<void> {
  if (!stateOf.size) return;
  const app = getApp();
  for (const entry of stateOf.values()) {
    const state = await readPluginInstall(app, entry.spec);
    if (entry.row) {
      entry.row.desc = pluginDescOf(state, confirmedLatest(entry));
      const act = entry.row.actions?.[1];
      if (act) {
        act.text = actionTextOf(entry, state);
        act.hidden = !actionVisible(entry, state);
      }
    }
  }
  currentAllRow = buildAllRow();
}

/** 已渲染组卡的 DOM 补丁：行序 = [全部更新, ...每个插件] */
function patchRenderedGroup(): void {
  if (!stateOf.size) return;
  const entries = COMPANION_SPECS.map((spec) => entryOf(spec));
  document.querySelectorAll<HTMLElement>(`[data-sp-group="${PLUGIN_GROUP_NAME}"]`).forEach((card) => {
    const domRows = card.querySelectorAll<HTMLElement>('.bz-sp-group-body > .bz-sp-set-row');
    if (currentAllRow) {
      const btn = domRows[0]?.querySelector<HTMLButtonElement>('.bz-sp-btn');
      // 动作中的钮（busy 转圈）不接手：别把转圈拍回 idle
      if (btn && !btn.classList.contains('bz-rowbtn--busy')) {
        setRowBtnState(btn, 'idle', currentAllRow.buttonText);
        btn.disabled = currentAllRow.disabled === true;
      }
    }
    entries.forEach((entry, i) => {
      const el = domRows[i + 1];
      if (!entry.row || !el) return;
      const desc = el.querySelector<HTMLElement>('.bz-sp-set-desc');
      if (desc) {
        const text = entry.row.desc ?? '';
        // 文案没变不写：写 textContent 会把搜索高亮的 <mark> 包裹拍平
        if (desc.textContent !== text) {
          desc.textContent = text;
          if (desc.dataset.spOrig !== undefined) desc.dataset.spOrig = text;
        }
      }
      const btns = el.querySelectorAll<HTMLButtonElement>('.bz-sp-btn');
      // [0] = GitHub、[1] = 安装/更新
      const updateBtn = btns[1];
      if (updateBtn && !updateBtn.classList.contains('bz-rowbtn--busy')) {
        updateBtn.textContent = entry.row.actions?.[1]?.text || '更新';
        // 已装且无新版（或最新版没查到）→ 连钮都不留，行里只剩 GitHub；有新版才露出来
        updateBtn.style.display = entry.row.actions?.[1]?.hidden ? 'none' : '';
      }
    });
  });
}

/**
 * 装 / 更新一个插件。
 * 先现查最新版：已是最新就只给一句提示，不白下一次 0.8 MB。
 */
async function updateOnce(spec: PluginSpec): Promise<void> {
  const app = getApp();
  const entry = entryOf(spec);
  const before = await readPluginInstall(app, spec);
  const rel = await fetchLatestPluginRelease(spec);
  entry.latest = rel.version;
  entry.checked = true;
  entry.failed = false;
  if (pluginActionOf(before, rel.version) === 'none') {
    notice(`${spec.name} 已是最新版本（${before.version}）`);
    return;
  }
  const wasInstalled = isPluginHealthy(before);
  const r = await installPlugin(app, spec);
  notice(
    wasInstalled
      ? `${spec.name} 已更新到 ${r.version}，重启 Obsidian 后生效`
      : r.enabled
        ? `${spec.name} 已安装并启用（${r.version}）`
        : `${spec.name} 已安装（${r.version}），到「设置 → 第三方插件」里启用`,
    r.enabled ? 'success' : 'warning',
  );
}

/** 单行「安装 / 更新」 */
async function runUpdateRow(ctx: SettingsRowContext, spec: PluginSpec): Promise<void> {
  if (busy) return;
  busy = true;
  const entry = entryOf(spec);
  const btns = ctx.rowEl.querySelectorAll<HTMLButtonElement>('.bz-sp-btn');
  const updateBtn = btns[1];
  setRowBtnState(updateBtn, 'busy', updateBtn?.textContent || '更新');
  try {
    await updateOnce(spec);
  } catch (e) {
    notice(`${spec.name} 更新失败：${String((e as Error)?.message || e)}`, 'error');
  } finally {
    busy = false;
  }
  await syncRows();
  patchRenderedGroup();
  const state = await readPluginInstall(getApp(), spec);
  setRowBtnState(updateBtn, 'idle', actionTextOf(entry, state));
  // idle 会把 disabled 复位成 false，这里按状态定显隐：装完就该收起（不再留一枚灰钮）
  if (updateBtn) updateBtn.style.display = actionVisible(entry, state) ? '' : 'none';
}

/** 组级「全部更新」：按 COMPANION_SPECS 顺序逐个跑（reader 在前，review 在后） */
async function runUpdateAll(ctx: SettingsRowContext): Promise<void> {
  if (busy) return;
  busy = true;
  const btn = ctx.rowEl.querySelector<HTMLButtonElement>('.bz-sp-btn') ?? undefined;
  setRowBtnState(btn, 'busy', '全部更新');
  try {
    for (const spec of COMPANION_SPECS) {
      try {
        await updateOnce(spec);
      } catch (e) {
        notice(`${spec.name} 更新失败：${String((e as Error)?.message || e)}`, 'error');
      }
    }
  } finally {
    busy = false;
  }
  await syncRows();
  setRowBtnState(btn, 'idle', '全部更新');
  if (btn && currentAllRow) btn.disabled = currentAllRow.disabled === true;
  patchRenderedGroup();
}

/** 测试用：清掉模块级状态（最新版缓存 / 行引用 / 忙位） */
export function resetPluginResourcesState(): void {
  stateOf.clear();
  currentAllRow = null;
  latestToken++;
  busy = false;
}

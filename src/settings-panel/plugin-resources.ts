/* ============================================================
 * bz · 设置面板「插件」组（settings-panel/plugin-resources.ts）
 *
 * 2026-11-05 用户要求：在「外部工具」上面加一组「插件」，组首「全部更新」，
 * bz reader 一行显示版本号，右侧两个按钮 —— GitHub（跳仓库）+ 安装/更新。
 * 「自动更新」开着时，启动链会顺带把它更到最新（core/reader-install.autoUpdateReaderPlugin）；
 * 关着时这组只显示「新版 x.y.z」，用户点「更新」才装。
 *
 * 数据只有两个来源：
 *  - 本机：core/reader-install.readReaderInstall（磁盘 manifest + Obsidian 清单，以磁盘为准）；
 *  - 远端：core/reader-install.fetchLatestReaderRelease（GitHub 主 → 码云备）。
 * 打开面板先按本机状态渲染，最新版后台查到后补丁 DOM（同 online-resources 的做法），
 * 不让一次网络请求卡住设置面板。
 * ============================================================ */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { openExternalUrl } from '../core/utils';
import type { GroupDecl, InfoRow, SettingsRow, SettingsRowContext } from '../core/settings-schema';
import { setRowBtnState } from '../core/settings-btn-state';
import { compareVersions } from '../core/version';
import {
  READER_PLUGIN_ID,
  READER_PLUGIN_NAME,
  READER_REPO_SLUG,
  fetchLatestReaderRelease,
  installReaderPlugin,
  readReaderInstall,
  type ReaderInstallState,
} from '../core/reader-install';

/** 组名（DOM 补丁按 data-sp-group 对位；改这里要同步测试） */
export const PLUGIN_GROUP_NAME = '插件';
/** 组图标（lucide） */
const GROUP_ICON = 'puzzle';

type BtnRow = Extract<SettingsRow, { type: 'button' }>;

/** 插件目录：现在只有 bz reader；以后加插件在这里加一行（读状态/安装按 id 分派） */
export interface PluginEntry {
  id: string;
  name: string;
  repoUrl: string;
}

export const PLUGIN_ENTRIES: PluginEntry[] = [
  { id: READER_PLUGIN_ID, name: READER_PLUGIN_NAME, repoUrl: `https://github.com/${READER_REPO_SLUG}` },
];

/** 本会话最新版缓存：面板重开先用上次值渲染，后台再核对一次 */
let latestVersion: string | null = null;
let latestChecked = false;
let latestFailed = false;
let latestToken = 0;
/** 组内行（构建期建一次；syncRows 就地改写，下次重渲即新值） */
let currentRows: InfoRow[] = [];
let currentAllRow: BtnRow | null = null;
/** 组级 / 单行动作的忙位（只有一个插件，共用一个即可） */
let busy = false;
/** 当前插件是否已是最新（渲染器不认 actions 的禁用态，补丁按它设按钮灰） */
let currentUpToDate = false;

/** 版本文案（用户要的版本号就长在这句里） */
export function pluginDescOf(state: ReaderInstallState, latest: string | null): string {
  if (!state.installed || state.broken) return '未安装';
  const head = `已安装 ${state.version || '版本未知'}`;
  if (latest && compareVersions(latest, state.version) > 0) return `${head} · 新版 ${latest}`;
  return head;
}

/** 已是最新（本机版本 ≥ 最新版，且这次核对成功过；没查到 ≠ 已最新） */
function isUpToDate(state: ReaderInstallState): boolean {
  return (
    state.installed &&
    !state.broken &&
    latestChecked &&
    !latestFailed &&
    !!latestVersion &&
    compareVersions(latestVersion, state.version) <= 0
  );
}

/** 已知有新版（查询成功、且最新版比本机新） */
function hasKnownUpdate(state: ReaderInstallState): boolean {
  return (
    state.installed &&
    !state.broken &&
    latestChecked &&
    !latestFailed &&
    !!latestVersion &&
    compareVersions(latestVersion, state.version) > 0
  );
}

/**
 * 行内动作钮文字。
 *
 * 2026-11-05 用户报障：打开面板先看到「更新」，点一下才变「已安装」灰——因为旧逻辑在
 * 「最新版还没查到」时写「更新」，等于替用户猜「有新版」。现在反过来：本地**已装**就
 * 默认「已安装」，只有**确认**有新版才写「更新」；查询中/查失败都保持「已安装」，
 * 点它时现查（查不到会给人话）。
 */
function actionTextOf(state: ReaderInstallState): string {
  if (!state.installed || state.broken) return '安装';
  return hasKnownUpdate(state) ? '更新' : '已安装';
}

/** 有没有待办：未装 / 半装 / 有新版。最新版未知时按「可点」处理（点下去现查） */
function hasWork(state: ReaderInstallState): boolean {
  if (!state.installed || state.broken) return true;
  if (!latestChecked || latestFailed || !latestVersion) return true;
  return compareVersions(latestVersion, state.version) > 0;
}

/**
 * 「插件」组：组首「全部更新」，下面每个插件一行。
 * 异步只为读本机状态（磁盘小文件）；最新版在返回后后台查，查到再补丁。
 */
export async function pluginResourcesGroup(): Promise<GroupDecl> {
  const app = getApp();
  const state = await readReaderInstall(app);
  const entry = PLUGIN_ENTRIES[0];

  const info: InfoRow = {
    type: 'info',
    name: entry.name,
    // 右列已有两个按钮，再挂一枚同名徽标只会把按钮挤窄（与关于组「版本」行同口径）
    hideBadge: true,
    desc: pluginDescOf(state, latestFailed ? null : latestVersion),
    actions: [
      { text: 'GitHub', onClick: () => openExternalUrl(app, entry.repoUrl) },
      { text: actionTextOf(state), cta: true, onClick: (_value, ctx) => void runUpdateRow(ctx) },
    ],
  };
  const allRow: BtnRow = {
    type: 'button',
    name: '全部更新',
    desc: '把插件更新到最新版',
    buttonText: '全部更新',
    disabled: !hasWork(state),
    onClick: (ctx) => void runUpdateAll(ctx),
  };

  currentRows = [info];
  currentAllRow = allRow;
  // 后台核对最新版（不阻塞面板）；失败静默，行里继续显示本机版本。
  // catch 兜住尾部的 syncRows：面板关掉/测试环境拆除后 getApp() 会抛，不能变成 unhandled rejection。
  void refreshLatest().catch((e) => {
    console.warn('[bz] 插件组刷新失败（已静默）:', (e as Error)?.message || e);
  });
  // 缓存命中（刚刚查过）时把「已安装」的灰态同步到已渲染按钮上——
  // info 行的 actions 没有 disabled 字段，只能渲染后补
  setTimeout(() => patchRenderedGroup(), 0);
  return { name: PLUGIN_GROUP_NAME, icon: GROUP_ICON, rows: [allRow, info] };
}

/** 核对最新版（唯一刷新通道）：查到/失败都回落 syncRows + DOM 补丁 */
async function refreshLatest(): Promise<void> {
  const token = ++latestToken;
  try {
    const rel = await fetchLatestReaderRelease();
    if (token !== latestToken) return;
    latestVersion = rel.version;
    latestChecked = true;
    latestFailed = false;
  } catch (e) {
    if (token !== latestToken) return;
    latestChecked = true;
    latestFailed = true;
    console.warn('[bz] 插件最新版核对失败（已静默）:', (e as Error)?.message || e);
  }
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
  if (!currentRows.length) return;
  const state = await readReaderInstall(getApp());
  const info = currentRows[0];
  info.desc = pluginDescOf(state, latestFailed ? null : latestVersion);
  const act = info.actions?.[1];
  if (act) act.text = actionTextOf(state);
  currentUpToDate = isUpToDate(state);
  if (currentAllRow) currentAllRow.disabled = !hasWork(state);
}

/** 已渲染组卡的 DOM 补丁：行序 = [全部更新, bz reader] */
function patchRenderedGroup(): void {
  if (!currentRows.length) return;
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
    const info = currentRows[0];
    const el = domRows[1];
    if (!info || !el) return;
    const desc = el.querySelector<HTMLElement>('.bz-sp-set-desc');
    if (desc) {
      const text = info.desc ?? '';
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
      updateBtn.textContent = info.actions?.[1]?.text || '更新';
      // 已是最新 → 灰掉（用户 2026-11-05 要求：按钮变灰、写「已安装」）
      updateBtn.disabled = currentUpToDate;
    }
  });
}

/**
 * 装 / 更新一个插件（现在只有 bz reader）。
 * 先现查最新版：已是最新就只给一句提示，不白下一次 0.8 MB。
 */
async function updateOnce(): Promise<void> {
  const app = getApp();
  const before = await readReaderInstall(app);
  const rel = await fetchLatestReaderRelease();
  latestVersion = rel.version;
  latestChecked = true;
  latestFailed = false;
  if (before.installed && !before.broken && compareVersions(rel.version, before.version) <= 0) {
    notice(`bz reader 已是最新版本（${before.version}）`);
    return;
  }
  const wasInstalled = before.installed && !before.broken;
  const r = await installReaderPlugin(app);
  notice(
    wasInstalled
      ? `bz reader 已更新到 ${r.version}，重启 Obsidian 后生效`
      : r.enabled
        ? `bz reader 已安装并启用（${r.version}）`
        : `bz reader 已安装（${r.version}），到「设置 → 第三方插件」里启用`,
    r.enabled ? 'success' : 'warning',
  );
}

/** 单行「安装 / 更新」 */
async function runUpdateRow(ctx: SettingsRowContext): Promise<void> {
  if (busy) return;
  busy = true;
  const btns = ctx.rowEl.querySelectorAll<HTMLButtonElement>('.bz-sp-btn');
  const updateBtn = btns[1];
  setRowBtnState(updateBtn, 'busy', updateBtn?.textContent || '更新');
  try {
    await updateOnce();
  } catch (e) {
    notice(`bz reader 更新失败：${String((e as Error)?.message || e)}`, 'error');
  } finally {
    busy = false;
  }
  await syncRows();
  patchRenderedGroup();
  const state = await readReaderInstall(getApp());
  setRowBtnState(updateBtn, 'idle', actionTextOf(state));
  // idle 会把 disabled 复位成 false，这里按「已是最新」重新灰掉
  if (updateBtn) updateBtn.disabled = isUpToDate(state);
}

/** 组级「全部更新」：逐个插件跑一遍（现在只有一个） */
async function runUpdateAll(ctx: SettingsRowContext): Promise<void> {
  if (busy) return;
  busy = true;
  const btn = ctx.rowEl.querySelector<HTMLButtonElement>('.bz-sp-btn') ?? undefined;
  setRowBtnState(btn, 'busy', '全部更新');
  try {
    await updateOnce();
  } catch (e) {
    notice(`bz reader 更新失败：${String((e as Error)?.message || e)}`, 'error');
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
  latestVersion = null;
  latestChecked = false;
  latestFailed = false;
  latestToken++;
  currentRows = [];
  currentAllRow = null;
  currentUpToDate = false;
  busy = false;
}

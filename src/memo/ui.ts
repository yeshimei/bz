/**
 * 备忘录（memo）域 UI：场景工作台（原型 1 定稿形态）
 * 桌面：遮罩 + 720×580 面板（壳 = 组件库 .bz-panel-overlay/.bz-panel-frame，
 *       ADR-0094 接入；ADR-0084：右缘/底缘/右下角拖动缩放，钳制 720×520 ~
 *       min(1280×880, 视口92%)，尺寸记忆 persist → settings.memoPanelWidth/Height）：
 *       左场景栏（.bz-rail 族：全部/今日/重要 = 图标前缀，用户场景 = 场景色点；
 *       「添加场景」虚线钮挂列表尾部，紧贴最后一个场景之下）+ 右侧列表
 *       （.bz-main-head 主头行 + .bz-toolrow 工具行（.bz-search 搜索 + 排序下拉
 *       uiSelect，issue 268 起由三档平铺改单枚下拉）；条目卡 meta 对齐源码 buildMeta 顺序）
 * 头行：.bz-panel-brand 品牌块 + 右侧「打开备忘录设置 / 关闭」图标钮（issue 197，
 *       对齐剪藏本头行范式；设置钮直达设置面板备忘录域）。皮肤段桌面收掉整组，
 *       移动端只放回关闭一枚（issue 268：设置/新建撤出移动头行）
 * 移动：真全屏 + 顶部横滑场景条（.bz-mobstrip：场景 chips + 尾部「添加场景」虚线 chip）
 *       + 底部录入（「添加」= 打开创建弹窗并把已输入文字带过去，issue 268 用户拍板）
 * 交互：
 *   - 桌面右键条目 → 跟手菜单（无顶部信息卡）；移动长按 → 底部抽屉（带 sheetHead）
 *     （两者复用 core/item-actions：attachItemActions）
 *   - 行内勾选完成（300ms 防抖 + emitDomainEvent('memo', completed) 行为流）
 *   - 编辑/新建弹窗 = uiModal（无关闭按钮，点遮罩/ESC 关；无滚动条）
 *   - 场景/优先级平铺选择 = 组件库 .bz-choice（选中 = 品牌色，非黑底）
 *   - 添加场景弹窗：输入场景名 → 写入 memoScenarios 设置并即时生效
 *   - 场景项右键/长按 = 管理菜单（在设置中编辑直达 / 重命名批量改条目 / 删除迁入默认场景）
 *   - 条目右键/长按「专注这个」= 开始一个归属到该备忘录的专注番茄（pomodoro 域动态 import）
 *   - 伪场景：今日 = 只看今天（今日/逾期未完成 + 今天完成）；重要 = 跨场景聚合 star 条目
 *   - 删除接撤销（core notifyUndo，条目插回原位）；composer 保存 toast 挂「补全」直开编辑器
 *   - 打开默认场景 = 设置 memoOpenScene（@last 上次停留：关面板记住当下场景，跨开合与重启；
 *     固定场景/伪场景直用，非法值回落「全部」；提醒 notePath 定位开面板不受其限，恒「全部」）
 *   - 已完成折叠区时间窗 = 设置 memoDoneWindow（7/30/90 天，全部=不折叠）：窗内完成直列，
 *     更早的收进尾部「更早 N 条」放全；空态 = 组件库 .bz-empty 三件套
 * 基线：按钮/输入/弹窗/平铺选择走组件库；域内只留备忘录特有布局。
 * 图标：一律 lucide。
 * 数据：与旧 memo 域读写同一 memo.json；后台任务由旧 memo 域执行。
 */
import type { App, EventRef } from 'obsidian';
import moment from 'moment';
import { notice, notify, notifyUndo, notifySaveError, notifyActionError } from '../core/notice';
import { escManager, registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { topifyZ } from '../core/dom';
import { isMobileEnv } from '../core/mobile';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { uiModal, uiIcon, uiChoice, uiSelect, uiBtn, uiBtnRow, uiResizable, uiEmpty, mountIcons, uiSuggest } from '../core/ui';
import { bindFormSubmit } from '../core/ui/modal';
import { openFlowDialog, confirmDiscard } from '../core/flow-dialog';
import { emitDomainEvent } from '../core/domain-bus';
import { attachItemActions, closeItemMenu, openItemMenu, resetItemMenuClickGuard, type ItemAction } from '../core/item-actions';
import {
  debounce, formatRelativeTime, getCurrentNoteInfo, getCurrentCursorPosition, localDayKey, stripMdExt,
  generateId, extractUrlAndDisplay, escapeHtml, fetchPageTitle, openExternalUrl,
} from '../core/utils';
import { MemoData, DEFAULT_SCENARIOS } from './data';
import { getDueStatus, formatDueText } from './due';
import {
  MEMO_ICONS as ICON, iconSpan, sceneDot, sceneLabel, mainCountHtml,
  navBtnHtml, mobChipHtml, mobAddSceneChipHtml, panelShellHtml, metaTagsHtml,
  cardHtml as renderCard, checkHtml, sectionLabelHtml, doneBarHtml, doneMoreHtml, type MetaDue,
} from './render';
import type { MemoItem } from './types';
import { M } from './state';

/** 备忘录主面板缩放钳制（ADR-0084：最小/硬上限，实际另受视口 92% 约束；默认 720×580 走域内 CSS） */
const PANEL = { MIN_W: 720, MIN_H: 520, MAX_W: 1280, MAX_H: 880 };
/** 搜索防抖（180ms，favorites/belongings 同值） */
const SEARCH_DEBOUNCE_MS = 180;
/** 搜索防抖（180ms，favorites/belongings 同值；issue 347 收编 core debounce：尾触语义与原手写
 *  定时器等价——最后一次 input 的输入值生效，面板关闭 cancel 防孤儿回调） */
const searchDebounced = debounce((v: string) => {
  M.search = v;
  renderAll();
}, SEARCH_DEBOUNCE_MS);

// ---------- 小工具 ----------


const esc = escapeHtml;



/** 某时间串（YYYY-MM-DD HH:mm:ss）是否为今天（「今日」视图只看今天完成的口径）。
 *  memo2-consistency 旧-5：today 串收编 core localDayKey 单源（此前手写 moment().format
 *  两套口径并存）；today 可注入（memo2-efficiency 新-4：大列表逐条取当前时刻是纯空耗） */
function isTodayStr(s: string, today: string = localDayKey()): boolean {
  return !!s && s.slice(0, 10) === today;
}

/** composer/编辑器场景缺省兜底：设置 memoDefaultScene（合法时）否则第一个场景 */
function fallbackScene(): string {
  const scenes = MemoData.getScenarios();
  const s = tryGetSettings().memoDefaultScene;
  return s && scenes.includes(s) ? s : scenes[0];
}

/** composer 当前生效场景：具体场景直用；伪场景（全部/今日/重要）兜底设置默认（addFromComposer 同口径） */
function composerScene(): string {
  const scenes = MemoData.getScenarios();
  const specific =
    M.activeScene !== '全部' && M.activeScene !== '今日' && M.activeScene !== '重要' && scenes.includes(M.activeScene);
  return specific ? M.activeScene : fallbackScene();
}

/** 已完成折叠区时间窗（设置 memoDoneWindow）：天数；'all'=null（不折叠全列）；非法值回落 30 天 */
function doneWindowDays(): number | null {
  const v = tryGetSettings()?.memoDoneWindow;
  if (v === 'all') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/** 打开面板默认场景（设置 memoOpenScene）：'@last'=取关面板记忆 memoLastScene（issue 293）；
 *  伪场景/场景名直用；非法值（含场景已删/改名）回落「全部」 */
function resolveOpenScene(): string {
  const s = tryGetSettings();
  const v = s?.memoOpenScene;
  const scenes = MemoData.getScenarios();
  const known = (x: string) => x === '全部' || x === '今日' || x === '重要' || scenes.includes(x);
  if (v === '@last') {
    const last = s?.memoLastScene;
    return last && known(last) ? last : '全部';
  }
  return v && known(v) ? v : '全部';
}

// ---------- 剪藏场景剪贴板预填（复用 core 同款 extractUrlAndDisplay + fetchPageTitle，与 memo 域一致） ----------

/** composer 预填标题候选（URL 预填时抓到；保存时仅当内容仍是该 URL 才采用，用户改动即弃） */
let clipTitleHint: { url: string; title: string } | null = null;

/** 读剪贴板做剪藏分流：URL 形态 → {url, 标题候选}；空/非 URL/读取失败 → null（非 URL 不打扰）。
 *  标题候选 = markdown 链接文本；裸 URL 时在线抓页面标题（memo 同款 fetchPageTitle，失败回退空） */
async function readClipUrl(): Promise<{ url: string; title: string } | null> {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch (e) {
    return null; // 剪贴板不可用（权限/环境）静默
  }
  const trimmed = text.trim();
  if (!trimmed) return null;
  const { url, display } = extractUrlAndDisplay(trimmed);
  if (!url) return null;
  const title = display && display !== url ? display : (await fetchPageTitle(url)) || '';
  return { url, title };
}

/** 预填成功轻提示（正文无 emoji；同键去重防连续聚焦刷屏） */
function notifyClipPrefill(): void {
  notify('已从剪贴板预填链接', { type: 'info', dedupeKey: 'memo-clip-prefill' });
}

// ---------- 数据操作 ----------

/** 读盘通道级失败标记（memo2-func #7 / memo2-arch A9 / memo2-efficiency 旧#14）：
 *  vault.read 抛错（同步盘锁/权限/磁盘满）此前沿 void 链一路 reject——面板壳在而列表
 *  永不渲染、无解释且 unhandled rejection。置位后面板渲染错误空态（重试钮），读成功复位。 */
let loadFailed = false;

/** 读取数据（从 memo.json），清空状态计数后给 items。
 *  错误面：读盘失败 notifyActionError + 「重试」出口，不再沿 void 链 unhandled；
 *  失败保持 items 原值（面板已有数据不闪空）。 */
async function loadData(): Promise<void> {
  try {
    M.items = await MemoData.loadItems();
    loadFailed = false;
  } catch (e) {
    loadFailed = true;
    notifyActionError(e, '读取备忘录', { onRetry: () => void refresh() });
    console.error(e);
  }
}

/** 写盘后刷新 UI */
async function refresh(): Promise<void> {
  await loadData();
  M.renderFn?.();
}

// ---------- T1：同源 memo.json 跨域同步（旧 memo 面板/后台任务改动 → 已开 memo 面板重读） ----------
let vaultSyncRef: EventRef | null = null;
let vaultSyncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false; // 自己写盘引发的 modify 不重复刷新（写路径已自 refresh）
let origMemoWrite: ((data: any) => Promise<unknown>) | null = null; // 包装前原始 write（卸载还原）

/** 订阅 vault modify：memo.json 文件变更（任意来源——memo 面板/后台任务/外部）→ 面板开着时防抖重读 */
function subscribeMemoSync(app: App): void {
  if (vaultSyncRef) return;
  // 包装 MemoData.write：memo 自己的写盘置 syncing，modify 事件不再重复刷新（写路径已自 refresh）
  if (!origMemoWrite) {
    origMemoWrite = MemoData.write.bind(MemoData);
    MemoData.write = async (data: any) => {
      syncing = true;
      try {
        return await origMemoWrite!(data);
      } finally {
        syncing = false;
      }
    };
  }
  vaultSyncRef = app.vault.on('modify', (file) => {
    if (syncing) return; // 自己写盘
    if (!M.overlay) return; // 面板没开不刷
    if (file && file.path !== MemoData.memoFilePath) return; // 只关心 memo.json
    if (vaultSyncTimer !== null) clearTimeout(vaultSyncTimer);
    vaultSyncTimer = setTimeout(() => {
      vaultSyncTimer = null;
      void refresh();
    }, 150);
  });
}
function unsubscribeMemoSync(): void {
  if (vaultSyncRef) {
    // vault.on 返回 EventRef，注销走 offref（M.appRef 在 unloadMemo 里于本函数之后才置空）
    M.appRef?.vault.offref(vaultSyncRef);
    vaultSyncRef = null;
  }
  if (vaultSyncTimer !== null) {
    clearTimeout(vaultSyncTimer);
    vaultSyncTimer = null;
  }
  syncing = false;
  // 还原 write 包装（卸载后不再拦截，避免引用的 UI 闭包残留）
  if (origMemoWrite) {
    MemoData.write = origMemoWrite;
    origMemoWrite = null;
  }
}

// ---------- 视图判定（过滤 + 排序） ----------

/** 到期排序优先级：overdue 0 / today 1 / future 2 / 无 3 */
function dueRank(it: MemoItem): number {
  if (!it.due) return 3;
  const st = getDueStatus(it.due);
  return st === 'overdue' ? 0 : st === 'today' ? 1 : 2;
}

function getVisibleItems(): MemoItem[] {
  const kw = M.search.trim().toLowerCase();
  const today = localDayKey(); // memo2-efficiency 新-4：今日串一次算好，不逐条目取当前时刻
  let list = M.items.filter((it) => {
    // 场景筛选
    if (M.activeScene === '今日') {
      // 只看今天：已完成项仅今天完成的进 done 折叠区（含今日补完的逾期项）；
      // 未完成项需今日/逾期才进列表；历史完成去「全部」场景看
      if (!it.completed) {
        const st = getDueStatus(it.due);
        if (st !== 'overdue' && st !== 'today') return false;
      } else if (!isTodayStr(it.completed, today)) {
        return false;
      }
    } else if (M.activeScene === '重要') {
      // 跨场景聚合 star 标记条目（已完成重要项同样放行进 done 折叠区）
      if (it.priority !== 'important') return false;
    } else if (M.activeScene !== '全部' && it.scene !== M.activeScene) return false;
    // 搜索（内容/场景/笔记名）
    if (kw) {
      const hay = [it.title, it.scene, it.notePath, it.scriptName, it.courseName].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
  // 录入当场可见：伪场景（今日/重要）过滤可能排除刚保存的新条目（无到期/未标星），
  // 置顶放行避免「保存了却看不见」；切场景/关面板/下一条新建时清除
  if (M.pinnedNewId && M.activeScene !== '全部') {
    const pinned = M.items.find((i) => i.id === M.pinnedNewId);
    if (pinned && !pinned.completed && !list.some((i) => i.id === pinned.id)) list = [pinned, ...list];
  }
  // 排序：priority 模式 = 到期优先 + 重要优先（对齐 memo sortFn）
  list.sort((a, b) => {
    const ac = !!a.completed, bc = !!b.completed;
    if (ac !== bc) return ac ? 1 : -1;
    const dr = dueRank(a) - dueRank(b);
    if (dr !== 0) return dr;
    if (M.sortMode === 'priority') {
      const pa = a.priority === 'important' ? 0 : 1;
      const pb = b.priority === 'important' ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    if (M.sortMode === 'created') {
      return (b.created || '').localeCompare(a.created || '');
    }
    if (a.due && b.due) return a.due.localeCompare(b.due);
    return (b.created || '').localeCompare(a.created || '');
  });
  return list;
}

/** 场景计数（memo2-efficiency 新-4：一遍 filter 顺便聚合全部场景计数——此前 renderNav
 *  逐场景各跑一遍全量 filter，场景数×O(n)；不随搜索过滤，与其他域 nav 计数=场景总数的
 *  范式一致；伪场景与列表口径一致——今日 = 今日/逾期未完成 + 今天完成） */
function sceneCounts(): Map<string, number> {
  const today = localDayKey();
  const counts = new Map<string, number>([
    ['全部', M.items.length],
    ['今日', 0],
    ['重要', 0],
  ]);
  for (const it of M.items) {
    if (it.scene) counts.set(it.scene, (counts.get(it.scene) || 0) + 1);
    if (it.priority === 'important') counts.set('重要', (counts.get('重要') || 0) + 1);
    const todayHit = it.completed ? isTodayStr(it.completed, today) : (() => {
      const st = getDueStatus(it.due);
      return st === 'overdue' || st === 'today';
    })();
    if (todayHit) counts.set('今日', (counts.get('今日') || 0) + 1);
  }
  return counts;
}

// ---------- 主面板（打开/关闭/ESC） ----------

/**
 * 皮肤应用（issue 210）：面板根挂 bz-memo-skin-{paper|editorial}（默认无修饰类）。
 * 双入口：openMemoPanel 打开时按 memoSkin 挂载；设置行 onChange 热切换已开面板。
 * 面板未开时仅落盘（设置行已持久化），下次打开生效。
 */
export function applyMemoSkin(skin: unknown): void {
  if (!M.overlay) return;
  const panel = M.overlay.querySelector('.bz-memo-panel') as HTMLElement | null;
  if (!panel) return;
  panel.classList.remove('bz-memo-skin-paper', 'bz-memo-skin-editorial');
  // 默认风格已下线（issue 210 四轮）：未知/缺省值一律回落纸感手账
  const v = skin === 'editorial' ? 'editorial' : 'paper';
  panel.classList.add(`bz-memo-skin-${v}`);
}

/**
 * 当前皮肤类名（issue 210）：挂 body 的浮层（uiModal 弹窗 / 流程框 / 右键菜单 / 抽屉）
 * 与面板共用同套皮肤。回落口径**必须与 applyMemoSkin 逐字一致**（未知/缺省 → 纸感手账）：
 * 面板回落纸感而弹窗返回空类的话，弹窗就掉回 core 裸皮——正是 issue 291 要消灭的
 * 「面板有皮、子弹窗没皮」；且四类浮层都靠这个类才拿得到 --bz-* 皮肤 token。
 */
function skinClass(): string {
  const s = tryGetSettings().memoSkin;
  return s === 'editorial' ? 'bz-memo-skin-editorial' : 'bz-memo-skin-paper';
}

/**
 * 打开主面板（toggle：开着再调关闭）。
 * opts.notePath：提醒改道定位（file-open 接管）——面板打开后搜索框预设为该笔记路径，
 * 列表即只显该笔记的关联备忘录；不传则普通打开。
 */
export function openMemoPanel(app: App, opts?: { notePath?: string }): void {
  if (M.overlay) {
    closeMemoPanel();
    return;
  }
  MemoData.init(tryGetSettings());
  // 设置播种（P2）：「默认排序方式」（与 memo 共用 memoSortMode 键）与「默认显示归档」
  // 在面板打开时初始化——此前恒「紧急优先」+ 折叠，两项设置对 memo 面板不生效
  const sortSetting = tryGetSettings().memoSortMode;
  M.sortMode = sortSetting === 'priority' || sortSetting === 'due' || sortSetting === 'created' ? sortSetting : 'priority';
  M.showDone = tryGetSettings().memoShowArchivedByDefault === true;
  // 打开默认场景（memoOpenScene）：提醒 notePath 定位恒「全部」——定位靠搜索过滤，场景过滤会把目标条目挡掉
  M.activeScene = opts?.notePath ? '全部' : resolveOpenScene();
  M.showEarlierDone = false; // 「更早 N 条」每次打开重新收起
  M.pinnedNewId = null;
  M.search = ''; // E8：搜索词跨开合残留——输入框是新的但列表仍被旧关键词过滤（notePath 定位在 loadData 后另行覆写）

  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay';
  overlay.innerHTML = panelShellHtml();

  document.body.appendChild(overlay);
  topifyZ(overlay); // T6：ADR-0067 动态发号——后开恒压先开的动态 overlay；不再占死静态 100000
  M.overlay = overlay;
  M.appRef = app;
  M.renderFn = () => renderAll();

  const panelEl = overlay.querySelector('.bz-memo-panel') as HTMLElement;
  applyMemoSkin(tryGetSettings().memoSkin);
  mountIcons(overlay);

  // 排序 = 组件库下拉（issue 268 用户拍板：三档平铺占宽把搜索框挤窄，改单枚下拉——
  // 收起态只占一行文案宽，搜索框（.bz-search flex:1）随之变长；展开菜单走 .bz-select-menu，
  // 皮肤段按 paper/editorial 各自风格化。值域/写回口径不变）
  const sortEl = overlay.querySelector('[data-memo-sort]') as HTMLElement;
  const sortSelect = uiSelect<string>({
    options: [
      { value: 'priority', label: '紧急优先' },
      { value: 'due', label: '仅按到期' },
      { value: 'created', label: '按创建' },
    ],
    value: M.sortMode,
    className: 'bz-memo-sortsel',
    onChange: (v) => {
      M.sortMode = v;
      // 同步写入默认排序（与 memo 共用 memoSortMode 键）
      // memo2-func #13 / memo2-consistency 旧-13：设置写盘收编——高频低价值写走 quiet
      // 兜底（失败仅 console，不弹错误 toast 刷屏；此前 void 裸奔 + unhandled rejection）
      getSettings().memoSortMode = v;
      void saveSettings().catch((e) => console.error('[memo] 排序设置保存失败', e));
      renderAll();
    },
  });
  sortEl.appendChild(sortSelect.el);
  sortSelectDetach = sortSelect.detach;

  // 桌面拖动缩放（ADR-0084；移动端真全屏/常规卡都由 CSS 撑满视口，不挂）。
  // 尺寸记忆（ADR-0094）：persist.load 挂载时恢复（resize 工厂钳到与拖拽同口径），
  // save 防抖 300ms 落盘 + detach 补存尾值——settings 键 memoPanelWidth/Height 语义不变
  if (!isMobileEnv()) {
    panelResizeDetach = uiResizable(panelEl, {
      minW: PANEL.MIN_W, minH: PANEL.MIN_H,
      maxW: PANEL.MAX_W, maxH: PANEL.MAX_H,
      persist: {
        load: () => {
          const s = tryGetSettings();
          const w = Number(s?.memoPanelWidth) || 0;
          const h = Number(s?.memoPanelHeight) || 0;
          // 无记忆/越界旧值回 null → 面板走 CSS 默认尺寸（720×580）
          if (w < PANEL.MIN_W || h < PANEL.MIN_H) return null;
          return { w, h };
        },
        save: (w, h) => {
          const s = tryGetSettings();
          s.memoPanelWidth = w;
          s.memoPanelHeight = h;
          // 设置写盘 quiet 兜底（memo2-func #13 / 旧-13，同排序口径）
          void saveSettings().catch((e) => console.error('[memo] 面板尺寸保存失败', e));
        },
      },
    });
  }

  // 事件委托
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // 点遮罩 = 关闭主面板（无关闭按钮，靠遮罩/ESC）
    if (e.target === overlay) {
      closeMemoPanel();
      return;
    }
    // 头行钮组：关闭（设置钮已随 memo2-ui M3-7 退役——皮肤段恒 display:none 死 UI，
    // 设置入口保留在场景菜单「在设置中编辑」）
    const headClose = t.closest('[data-memo-head-close]');
    if (headClose) { closeMemoPanel(); return; }
    // 场景切换（左栏 / 移动 chips）
    const nav = t.closest('[data-memo-scene]') as HTMLElement | null;
    if (nav) {
      const scene = nav.dataset.memoScene as string;
      M.activeScene = M.activeScene === scene ? '全部' : scene;
      M.pinnedNewId = null; // 录入置顶只服务当前视图，切场景即清
      renderAll();
      return;
    }
    const addScene = t.closest('[data-memo-addscene]');
    if (addScene) { openAddSceneDialog(); return; }
    // 主头行「新建备忘录」按钮 → 打开创建编辑器
    const newBtn = t.closest('[data-memo-newbtn]');
    if (newBtn) { openEditor(null); return; }
    // 已完成折叠条
    const donebar = t.closest('[data-memo-donebar]');
    if (donebar) {
      M.showDone = !M.showDone;
      renderAll();
      return;
    }
    // 「更早 N 条」：放全时间窗外的已完成条目
    const doneMore = t.closest('[data-memo-donemore]');
    if (doneMore) {
      M.showEarlierDone = true;
      renderAll();
      return;
    }
    // 底部录入（桌面 = 快速落盘；移动 = 打开创建弹窗，见 submitComposer）
    const composerAdd = t.closest('[data-memo-composer-add]');
    if (composerAdd) { submitComposer(); return; }
  });

  // 行内勾选（完成/恢复；300ms 防抖对齐 memo 卡片）——切换逻辑抽 toggleCheck，与移动抽屉头共用
  const content = overlay.querySelector('[data-memo-content]') as HTMLElement;
  content.addEventListener('click', (e) => {
    const check = (e.target as HTMLElement).closest('[data-memo-check]') as HTMLElement | null;
    if (!check) return;
    const card = check.closest('.bz-memo-card') as HTMLElement | null;
    if (!card) return;
    const it = M.items.find((i) => i.id === card.dataset.memoId);
    if (!it) return;
    e.stopPropagation();
    toggleCheck(it);
  });

  // 键盘可达（memo2-ui M3-10，core UX 整改 38 按钮范式）：卡片 Enter/Space 开操作菜单；
  // 勾选圈 Enter/Space 切换；已完成折叠条 Enter/Space 展开收起（markup 侧补 role/tabindex）
  content.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    if (!t || t.closest('a')) return; // 标题链接保留原生语义
    const check = t.closest?.('[data-memo-check]');
    if (check) {
      e.preventDefault();
      const card = (check as HTMLElement).closest('.bz-memo-card') as HTMLElement | null;
      const it = card ? M.items.find((i) => i.id === card.dataset.memoId) : null;
      if (it) toggleCheck(it);
      return;
    }
    if (t.closest?.('[data-memo-donebar]')) {
      e.preventDefault();
      M.showDone = !M.showDone;
      renderAll();
      return;
    }
    if (t.classList?.contains('bz-memo-card')) {
      e.preventDefault();
      const card = t as HTMLElement;
      const it = M.items.find((i) => i.id === card.dataset.memoId);
      if (!it) return;
      const r = card.getBoundingClientRect();
      openItemMenu(r.left + 24, r.top + 24, buildCardActions(it), false, skinClass() || undefined);
      resetItemMenuClickGuard(); // 键盘开菜单无右键时序，复位残余 click 抑制（issue 198 同款）
    }
  });

  // 底部录入 Enter（memo2-func #8：isComposing 守卫——中文 IME 组词确认的 Enter
  // （keyCode 229 同判）不提交；memo2-func #6 / memo2-ui M2-2：移动端分流 submitComposer——
  // 「添加」钮走弹窗（issue 268 拍板：移动 = 打开创建弹窗补场景/优先级/截止/定位），
  // 软键盘回车此前却直落盘绕开弹窗，两入口行为分叉。桌面保持 Enter 快速落盘）
  const composerInput = overlay.querySelector('[data-memo-composer-input]') as HTMLInputElement;
  // memo2-func #6 / memo2-ui M2-2：占位符分形态（移动端回车不开弹窗，别许诺 Enter 保存）
  composerInput.placeholder = isMobileEnv() ? '输入内容，点「添加」补全细节…' : '输入内容，Enter 保存…';
  composerInput.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key !== 'Enter') return;
    if (isMobileEnv()) submitComposer();
    else addFromComposer();
  });

  // 剪藏场景剪贴板预填（memo 同款逻辑）：聚焦时读剪贴板，URL 形态自动填入并抓标题；
  // 非 URL 内容不打扰（不填、不提示）；已有输入不覆盖
  composerInput.addEventListener('focus', () => {
    void (async () => {
      if (composerScene() !== '剪藏') return;
      if (composerInput.value.trim()) return;
      const hit = await readClipUrl();
      if (!hit) return;
      if (composerInput.value.trim()) return; // await 期间用户已输入
      composerInput.value = hit.url;
      if (hit.title) clipTitleHint = { url: hit.url, title: hit.title };
      notifyClipPrefill();
    })();
  });

  // 搜索（防抖 180ms，对齐 favorites/belongings——修复前每键全量重渲且注释与实现不符）
  const searchInput = overlay.querySelector('[data-memo-search]') as HTMLInputElement;
  searchInput.addEventListener('input', () => searchDebounced(searchInput.value.trim()));

  void (async () => {
    await loadData();
    // 提醒定位（file-open 改道接管）：搜索预设关联笔记路径（hay 含 notePath，直接命中）
    if (opts?.notePath) {
      M.search = opts.notePath;
      const presetInput = overlay.querySelector('[data-memo-search]') as HTMLInputElement | null;
      if (presetInput) presetInput.value = opts.notePath;
    }
    renderAll();
  })();
}

export function closeMemoPanel(): void {
  if (M.overlay) {
    // 上次停留（memoOpenScene='@last' 的取数源）：关面板记住当下场景，下次打开取回
    const s = tryGetSettings();
    if (s) {
      s.memoLastScene = M.activeScene;
      // 设置写盘 quiet 兜底（memo2-func #13 / 旧-13，同排序口径）
      void saveSettings().catch((e) => console.error('[memo] 上次场景保存失败', e));
    }
    M.overlay.remove();
    M.overlay = null;
  }
  // 防抖窗口内关闭面板：取消挂起回调防孤儿执行
  searchDebounced.cancel();
  // memo2-func #10：完成防抖 300ms 窗口内关面板——挂起的完成意图此前被 clearTimeout
  // 静默丢弃（用户以为已勾完，重开发现没完成）。flush 口径：关闭前对未决 id 直接落盘
  // （completeItem 自带错误面）；插件卸载（unloadMemo）走取消语义不 flush。
  for (const [id, t] of M.completeTimers) {
    clearTimeout(t);
    const it = M.items.find((i) => i.id === id);
    if (it) void completeItem(it);
  }
  M.completeTimers.clear();
  // 卸载拖动缩放（detach 幂等；persist 未落盘的尾值由工厂立即补存）
  if (panelResizeDetach) {
    panelResizeDetach.detach();
    panelResizeDetach = null;
  }
  // 摘排序下拉的 document 级监听（开合/ESC）
  if (sortSelectDetach) {
    sortSelectDetach();
    sortSelectDetach = null;
  }
  M.renderFn = null;
  M.pinnedNewId = null;
  clipTitleHint = null; // 剪贴板预填候选随面板生命周期清空
}

export function registerEscapeHandler(): void {
  registerPanelEsc('bz-memo', () => !!M.overlay, () => closeMemoPanel());
}

// ---------- 面板尺寸记忆（ADR-0084/0094：uiResizable persist 托管，见 openMemoPanel） ----------

/** 面板当前 resize detach（打开期间非空，关闭清空） */
let panelResizeDetach: { detach: () => void } | null = null;
/** 排序下拉（uiSelect）的 document 级监听 detach（面板关闭时摘除，防孤儿监听） */
let sortSelectDetach: (() => void) | null = null;

// ---------- 渲染 ----------

function renderAll(): void {
  if (!M.overlay) return;
  // memo2-efficiency 新-4：getVisibleItems（全量 filter+sort）每轮渲染只算一次，
  // 主头行计数与列表共用（此前 renderMainHead/renderContent 各算一遍 O(n log n)×2）
  const items = getVisibleItems();
  renderNav();
  renderMobScenes();
  renderMainHead(items);
  renderContent(items);
}

/** 主头行（原型 p1-main-head）：当前场景标题 + “· N 项 · M 未完成” + 右侧新建按钮 */
function renderMainHead(items: MemoItem[]): void {
  const overlay = M.overlay!;
  const titleEl = overlay.querySelector('[data-memo-main-title]') as HTMLElement | null;
  const countEl = overlay.querySelector('[data-memo-main-count]') as HTMLElement | null;
  if (!titleEl || !countEl) return;
  titleEl.textContent = sceneLabel(M.activeScene);
  // 计数 = 当前场景 + 当前搜索下的条目总数与未完成数（对齐原型 updateCount）；
  // 数字包 .bz-memo-cnt-num 供皮肤染色（issue 210 纸感/编辑部计数数字着色）
  const undone = items.filter((i) => !i.completed).length;
  countEl.innerHTML = mainCountHtml(items.length, undone);
}

/** 场景选项归一（桌面 nav / 移动 chips 共用）；dot 仅用户场景携带（伪场景走 SCENE_PSEUDO_ICONS 图标） */
function sceneOptions(): { scene: string; dot: string }[] {
  return [
    { scene: '全部', dot: '' },
    { scene: '今日', dot: '' },
    { scene: '重要', dot: '' },
    ...MemoData.getScenarios().map((s) => ({ scene: s, dot: sceneDot(s) })),
  ];
}



/** 场景项管理菜单（重命名/删除/设置直达；伪场景不挂）——桌面右键浮层 / 移动长按抽屉复用组件库 */
function attachSceneActions(el: HTMLElement, scene: string): void {
  if (scene === '全部' || scene === '今日' || scene === '重要') return;
  attachItemActions(el, buildSceneActions(scene), { sheetTitle: scene, sheetSub: '场景', menuClass: skinClass() || undefined });
}

function renderNav(): void {
  const nav = M.overlay!.querySelector('[data-memo-nav]') as HTMLElement;
  if (!nav) return;
  const counts = sceneCounts();
  nav.innerHTML = sceneOptions()
    .map((o) => navBtnHtml(o, M.activeScene === o.scene, counts.get(o.scene) || 0))
    .join('');
  mountIcons(nav);
  nav.querySelectorAll<HTMLElement>('[data-memo-scene]').forEach((el) => {
    attachSceneActions(el, el.dataset.memoScene as string);
  });
}

function renderMobScenes(): void {
  // memo2-efficiency 旧#9：桌面整条 display:none（core components.css）却照建 DOM、
  // 挂逐 chip 监听——空耗，isMobileEnv() 门控掉
  if (!isMobileEnv()) return;
  const wrap = M.overlay!.querySelector('[data-memo-mob-scenes]') as HTMLElement;
  if (!wrap) return;
  // 「添加场景」固定挂在平铺场景条的**最后面**（issue 268 用户拍板：与收藏本磁贴行同款，
  // 动作磁贴跟在全部场景之后）；左栏桌面那条虚线钮位置不变
  // memo2-ui M2-4：横滚位保持——重建前存 scrollLeft，重建后恢复（否则任意列表交互
  // 都让滑到中后段的 chips 弹回起点）
  const keepLeft = wrap.scrollLeft;
  wrap.innerHTML = sceneOptions()
    .map((o) => mobChipHtml(o, M.activeScene === o.scene))
    .join('') + mobAddSceneChipHtml();
  wrap.scrollLeft = keepLeft;
  mountIcons(wrap);
  wrap.querySelectorAll<HTMLElement>('[data-memo-scene]').forEach((el) => {
    attachSceneActions(el, el.dataset.memoScene as string);
  });
}

/** meta 注入包（ADR-0104：moment/settings 留行为层——due 状态/文案在此算好注入纯层） */
function metaDueOf(it: MemoItem): MetaDue {
  if (!it.due || it.completed) return null;
  const st = getDueStatus(it.due);
  if (!st) return null;
  return { status: st, text: formatDueText(it.due) };
}

/** 卡片 meta 行（纯层 metaTagsHtml 的行为侧封装：注入 due 包与相对时间） */
function metaTags(it: MemoItem): string {
  return metaTagsHtml(it, metaDueOf(it), it.created ? formatRelativeTime(it.created) : '');
}

function renderContent(items: MemoItem[]): void {
  const content = M.overlay!.querySelector('[data-memo-content]') as HTMLElement;
  if (!content) return;
  // memo2-ui M2-4：纵滚位保持——重建前存 scrollTop，重建后恢复（长列表中段操作后
  // 不再跳回顶部；diary「保存 scrollTop 恢复」先例同款）
  const keepTop = content.scrollTop;
  if (items.length === 0) {
    // 空态三件套（组件库 .bz-empty：图标 + 一句话 + 动作按钮）
    content.innerHTML = '';
    if (loadFailed) {
      // 读盘通道级失败错误态（memo2-func #7 / memo2-arch A9 / memo2-efficiency 旧#14）：
      // 面板壳在而数据未达时不再伪装成「还没有备忘录」
      content.appendChild(uiEmpty({
        icon: ICON.overdue,
        title: '备忘录读取失败',
        desc: '数据文件暂时无法读取，可点击重试',
        actions: uiBtnRow([uiBtn({ label: '重试', icon: ICON.clock, tone: 'primary', onClick: () => void refresh() })], { center: true }),
      }));
      return;
    }
    content.appendChild(uiEmpty({
      icon: ICON.empty,
      title: M.search ? '没有匹配的备忘录' : '这里还没有备忘录',
      desc: M.search ? '试试其他关键词，或清除搜索' : '随手记一条，别让它溜走',
      actions: uiBtnRow([uiBtn({ label: '新建备忘录', icon: ICON.add, tone: 'primary', onClick: () => openEditor(null) })], { center: true }),
    }));
    return;
  }
  // 分组：到期优先（overdue/today）→ 其他 → 已完成（折叠条）
  const active = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);
  const urgent = active.filter((i) => dueRank(i) <= 1);
  const normal = active.filter((i) => dueRank(i) > 1);

  const cardHtml = (it: MemoItem) => renderCard(it, metaDueOf(it), it.created ? formatRelativeTime(it.created) : '');

  const sections: string[] = [];
  if (urgent.length) {
    sections.push(sectionLabelHtml('到期优先', urgent.length));
    sections.push(...urgent.map((it) => cardHtml(it)));
  }
  if (normal.length) {
    sections.push(sectionLabelHtml('其他', normal.length));
    sections.push(...normal.map((it) => cardHtml(it)));
  }
  if (done.length) {
    const open = M.showDone;
    // 时间界（设置 memoDoneWindow）：展开默认只列时间窗内完成的，更早的收进尾部「更早 N 条」（点开放全；全部=不收）
    const win = doneWindowDays();
    const cutoff = win === null ? null : moment().subtract(win, 'days').format('YYYY-MM-DD HH:mm:ss');
    const recent = cutoff === null ? done : done.filter((i) => (i.completed as string) >= cutoff);
    const earlier = done.length - recent.length;
    const listed = !open || M.showEarlierDone ? done : recent;
    sections.push(doneBarHtml(open, done.length));
    if (open) {
      sections.push(...listed.map((it) => cardHtml(it)));
      if (earlier > 0 && !M.showEarlierDone) {
        sections.push(doneMoreHtml(earlier));
      }
    }
  }
  content.innerHTML = sections.join('');
  mountIcons(content);
  content.scrollTop = keepTop; // M2-4：滚位还原

  // 链接点击：打开关联内容（内部笔记 / 外部 URL），不走浏览器默认
  content.querySelectorAll('[data-memo-openitem]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const it = M.items.find((i) => i.id === (el as HTMLElement).dataset.memoOpenitem);
      if (it) openItem(it);
    });
  });
  // 位置标签点击 → 跳转关联笔记
  content.querySelectorAll('[data-memo-pos]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = M.items.find((i) => i.id === (el as HTMLElement).dataset.memoPos);
      if (it) jumpToNote(it);
    });
  });

  // 条目卡操作（右键菜单 / 移动长按抽屉）——桌面右键无头卡、移动抽屉带 sheetHead 由组件库分发
  content.querySelectorAll('.bz-memo-card').forEach((card) => {
    const id = (card as HTMLElement).dataset.memoId;
    const it = M.items.find((i) => i.id === id);
    if (!it) return;
    attachItemActions(card as HTMLElement, buildCardActions(it), {
      menuClass: skinClass() || undefined,
      sheetClass: skinClass() || undefined, // 抽屉挂 body，需自带皮肤类，头部勾选圈皮肤样式才随行
      sheetHead: buildSheetHead(it),
    });
  });
}

/** 移动抽屉顶部信息说明（与列表卡同源 markup——勾选圈走 checkHtml 单源（ADR-0104），
 *  完成态 = 圈 bz-memo-checked + 头 bz-memo-done 暗淡 + 标题 .done 划线；点圈恢复/标记完成
 *  走列表同款 toggleCheck（先关抽屉再执行，与功能项「先关再执行」同款收束）。
 *  桌面右键菜单不带头部，组件库自动区分） */
function buildSheetHead(it: MemoItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry bz-memo-sheet-entry';
  if (it.completed) head.classList.add('bz-memo-done');
  head.insertAdjacentHTML('afterbegin', checkHtml(it));
  const text = document.createElement('div');
  text.className = 'bz-memo-body-text';
  const title = document.createElement('div');
  title.textContent = it.title;
  if (it.completed) title.classList.add('done');
  text.appendChild(title);
  const meta = document.createElement('div');
  meta.className = 'bz-memo-meta';
  meta.innerHTML = metaTags(it);
  mountIcons(meta);
  text.appendChild(meta);
  head.appendChild(text);
  head.querySelector('[data-memo-check]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeItemMenu();
    toggleCheck(it);
  });
  // memo2-ui M3-3：抽屉头的「位置」标签此前死可点——样式 cursor:pointer 但点击只接在
  // [data-memo-content] 内，抽屉挂 body 不在接线范围。补「先关抽屉再跳转」（勾选圈同款收束）。
  head.querySelector('[data-memo-pos]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeItemMenu();
    jumpToNote(it);
  });
  return head;
}

// ---------- 卡片操作（菜单/抽屉动作全集） ----------

function openItem(it: MemoItem): void {
  const app = M.appRef!;
  if (it.linkedNote) {
    const file = app.vault.getAbstractFileByPath(it.linkedNote);
    if (!file) {
      // 呈报#15（15A 拍板，memo2-ui MR2-5）：先确认目标存在再关面板——此前首步即关面板，
      // 失败只剩一条通知，用户丢掉整个列表视图。失败时面板留着并提示原因。
      notice('关联笔记不存在');
      return;
    }
    closeMemoPanel();
    void app.workspace.getLeaf().openFile(file as any);
  } else if (it.url) {
    closeMemoPanel();
    // memo2-consistency 旧-14：换线 core openExternalUrl 单源（三级兜底 + 终末错误提示，
    // 注释点名 memo 传 M.appRef 为预期消费方；此前域内私有两级副本缺第三级与失败提示）
    openExternalUrl(app, it.url);
  }
}

function jumpToNote(it: MemoItem): void {
  if (!it.notePath) return;
  const app = M.appRef!;
  const file = app.vault.getAbstractFileByPath(it.notePath);
  if (!file) {
    // 呈报#15（15A 拍板）：失败不关面板——先确认文件存在再收面板（openItem 同口径）
    notice('关联笔记不存在');
    return;
  }
  closeMemoPanel();
  const leaf = app.workspace.getLeaf();
  // memo2-func #3 / memo2-arch A2（旧账 review-all2-bugs N8）：openFile 未 await 就同步取
  // editor——此刻 leaf.view 多半还是旧视图，setCursor/scrollIntoView 打在上一篇笔记上，
  // 「位置」跳转的行定位从不生效。await 后新视图已就位再定位（与 15A「失败不关面板」
  // 组合语义：文件存在才关面板，关了就一定 await 到位再打光标）。
  void (async () => {
    await leaf.openFile(file as any);
    const editor = (leaf as any).view?.editor;
    if (editor && it.notePosition) {
      const { line, ch } = it.notePosition;
      editor.focus();
      editor.setCursor(line, ch || 0);
      editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    }
  })();
}

/** 行内勾选切换（列表卡与移动抽屉头共用）：已完成 = 恢复；未完成 = 300ms 防抖后标记完成
 *  （防抖窗口内再点 = 反悔取消） */
function toggleCheck(it: MemoItem): void {
  // 已恢复路径（已完成条目勾选 = 恢复）
  if (it.completed) {
    void restoreItem(it);
    return;
  }
  // 完成防抖：300ms 内反悔取消
  if (M.completeTimers.has(it.id)) {
    clearTimeout(M.completeTimers.get(it.id));
    M.completeTimers.delete(it.id);
    return;
  }
  const timer = setTimeout(() => {
    M.completeTimers.delete(it.id);
    void completeItem(it);
  }, 300);
  M.completeTimers.set(it.id, timer);
}

async function completeItem(it: MemoItem): Promise<void> {
  try {
    await MemoData.completeItem(it.id);
    emitDomainEvent('memo', { kind: 'completed', title: it.title });
  } catch (e) {
    notifySaveError(e, '标记完成');
    console.error(e);
  }
  await refresh();
}

async function restoreItem(it: MemoItem): Promise<void> {
  try {
    await MemoData.updateItem(it.id, { completed: null });
    emitDomainEvent('memo', { kind: 'restored', title: it.title });
  } catch (e) {
    notifySaveError(e, '恢复未完成');
    console.error(e);
  }
  await refresh();
}

async function postponeItem(id: string, days: number): Promise<void> {
  const it = M.items.find((i) => i.id === id);
  if (!it || !it.due) return;
  // memo2-func #4（memo2-ui M2-3）：手写 new Date('YYYY-MM-DD HH:mm') 在 iOS WebKit
  // 解析为 Invalid Date → setDate/getHours 全 NaN → due 落盘 'NaN-NaN-NaN …' 脏数据，
  // 到期标记永久消失。改走域内 moment 单源（due.ts/data.ts 同口径）；既有 NaN 脏串由
  // loadItems 归一清洗（normalizeItem）。时刻沿用原条目时分（延后整天语义）。
  const keepHm = it.due.replace('T', ' ').slice(11, 16) || '09:00';
  const next = moment(it.due.replace('T', ' ').slice(0, 10), 'YYYY-MM-DD')
    .add(days, 'days')
    .format(`YYYY-MM-DD ${keepHm}`);
  try {
    await MemoData.updateItem(id, { due: next });
    emitDomainEvent('memo', { kind: 'postponed', title: it.title, due: next });
    notice(`已延后 ${days} 天`, 'success');
  } catch (e) {
    notifySaveError(e, '延后备忘录');
    console.error(e);
  }
  await refresh();
}

async function togglePrio(id: string): Promise<void> {
  const it = M.items.find((i) => i.id === id);
  if (!it) return;
  const to = it.priority === 'important' ? 'minor' : 'important';
  try {
    await MemoData.updateItem(id, { priority: to });
    emitDomainEvent('memo', { kind: 'priority', title: it.title, to });
    notice(to === 'important' ? '已转为重要' : '已转为次要', 'success');
  } catch (e) {
    notifySaveError(e, '切换优先级');
    console.error(e);
  }
  await refresh();
}

async function deleteItemWithUndo(it: MemoItem): Promise<void> {
  // memo2-consistency 旧-2（B7 全局删除口径定稿）：接 notifyUndo 的删除不再走
  // openFlowDialog 二次确认——撤销兜底已覆盖误删风险，确认+撤销双保险只是多一次打断
  // （belongings/clipbook/review/favorites 先行落地）。场景删除保留确认（批量迁移 +
  // 写设置串影响面大，且其无撤销链，口径区分见旧-2）。
  try {
    const idx = await MemoData.deleteItem(it.id);
    // memo2-func #11：条目已在盘上不存在（外部同步/双端同库先行删除、面板未刷新）——
    // 此前照发 deleted 事件 + notifyUndo「已删除」，点撤销把陈旧快照插回头部复活外部刚删
    // 的数据。idx=-1 跳过事件与撤销，提示并刷新。
    if (idx === -1) {
      notice('该备忘录已不存在，列表已刷新');
      await refresh();
      return;
    }
    emitDomainEvent('memo', { kind: 'deleted', title: it.title });
    notifyUndo(`已删除备忘录「${it.title}」`, () => {
      void (async () => {
        try {
          await MemoData.restoreItem(it, idx); // 插回删除前的原位置
          await refresh();
        } catch (e) {
          notifySaveError(e, '撤销删除');
          console.error(e);
        }
      })();
    });
  } catch (e) {
    notifySaveError(e, '删除备忘录');
    console.error(e);
  }
  await refresh();
}

/** 专注这个：直接开始一个番茄并把归属记到该备忘录（pomodoro 域动态 import，ADR-0002 延迟解析防环引用） */
function focusMemoItem(it: MemoItem): void {
  const app = M.appRef;
  if (!app) return;
  void import('../pomodoro').then((m) => m.startFocusForTask(app, it.title));
}

/** 条目操作动作（桌面右键菜单 / 移动长按抽屉共用；keepOpen 用于抽屉内继续操作） */
function buildCardActions(it: MemoItem): ItemAction[] {
  const actions: ItemAction[] = [];
  if (it.linkedNote || it.url) {
    let sub: string | undefined;
    if (it.linkedNote) sub = stripMdExt(it.linkedNote.split('/').pop() || '');
    else if (it.url) {
      try { sub = new URL(it.url).hostname; } catch (e) { /* 忽略 */ }
    }
    actions.push({ icon: 'external-link', label: '打开', title: '打开关联内容', sub, onClick: () => openItem(it) });
  }
  if (it.notePath) {
    actions.push({
      icon: 'book-open', label: '跳转关联笔记', title: '跳转关联笔记',
      sub: stripMdExt(it.notePath.split('/').pop() || ''),
      onClick: () => jumpToNote(it),
    });
  }
  if (!it.completed) {
    // 备忘录×番茄联动：开始一个归属到该备忘录的专注番茄（未完成条目才有专注意义）
    actions.push({ icon: 'timer', label: '专注这个', title: '开始一个归属到该备忘录的专注番茄', onClick: () => focusMemoItem(it) });
    actions.push({
      icon: 'check-circle', label: '标记完成', title: '标记完成',
      sub: it.due ? formatDueText(it.due) : undefined,
      onClick: async () => { await completeItem(it); },
    });
  } else {
    actions.push({ icon: 'rotate-ccw', label: '恢复未完成', title: '恢复未完成', onClick: async () => { await restoreItem(it); } });
  }
  if (it.due && !it.completed) {
    // memo2-func #4（memo2-ui M2-3）：延后菜单副标签同改 moment 单源（原手写 new Date
    // 在 iOS 产出 NaN 展示）；日期算术与 postponeItem 同口径
    const postponeSub = (days: number) =>
      moment(it.due!.replace('T', ' ').slice(0, 10), 'YYYY-MM-DD').add(days, 'days').format('MM-DD');
    actions.push({ icon: 'clock', label: '延后 1 天', title: '延后 1 天', sub: `→ ${postponeSub(1)}`, onClick: async () => { await postponeItem(it.id, 1); } });
    actions.push({ icon: 'clock', label: '延后 3 天', title: '延后 3 天', sub: `→ ${postponeSub(3)}`, onClick: async () => { await postponeItem(it.id, 3); } });
  }
  const isImportant = it.priority === 'important';
  actions.push({
    icon: 'star', label: isImportant ? '转为次要' : '转为重要', title: '切换优先级',
    onClick: async () => { await togglePrio(it.id); },
  });
  actions.push({
    icon: 'copy', label: '复制内容', title: '复制内容',
    sub: `${it.title.length} 字`,
    // memo2-consistency 新-6：剪贴板权限拒绝/环境不支持此前静默 unhandled——
    // 走 notifyActionError 口径（与全域非写盘动作失败人话提示对齐）
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(it.title);
        notice('内容已复制', 'success');
      } catch (e) {
        notifyActionError(e, '复制内容');
      }
    },
  });
  // 编辑紧贴删除之上；删除永远垫底（danger）
  actions.push({ icon: 'pencil', label: '编辑', title: '编辑', onClick: () => openEditor(it) });
  actions.push({ icon: 'trash-2', label: '删除', title: '删除', kind: 'danger', onClick: () => void deleteItemWithUndo(it) });
  return actions;
}

// ---------- 编辑器（新建/编辑弹窗） ----------

/**
 * 底部录入提交（issue 268）：两端逻辑分叉——
 * 桌面 = `addFromComposer()` 快速落盘（保留既有「输入即存 + toast 补全」链路）；
 * 移动 = 打开创建弹窗（真全屏下弹窗能补场景/优先级/截止/定位，且移动端头行已撤掉新建钮，
 * 这一枚就是移动端的新建入口）。已输入文字**带进弹窗**当初始内容（用户拍板），
 * 输入框留到弹窗保存成功才清——中途取消不丢草稿。
 * 「当前选中的场景」也一并带进弹窗（issue 269 用户拍板：选中某场景再点添加，
 * 弹窗里预选这个场景）——与桌面 composer 快速落盘的 composerScene() 同口径。
 */
function submitComposer(): void {
  if (!isMobileEnv()) { addFromComposer(); return; }
  const input = M.overlay!.querySelector('[data-memo-composer-input]') as HTMLInputElement | null;
  const txt = (input?.value || '').trim();
  // 剪藏剪贴板预填的标题候选随草稿一起交接（内容仍是原始 URL 才认，用户改动即弃）
  const hint = clipTitleHint && clipTitleHint.title && txt === clipTitleHint.url ? clipTitleHint : null;
  openEditor(null, {
    presetContent: txt,
    presetTitle: hint ? hint.title : '',
    presetScene: composerScene(),
    onSaved: () => {
      if (input) input.value = '';
      clipTitleHint = null;
    },
  });
}

/** composer 落盘进行中标志（E19：双击防重入——清空移到成功分支后，输入框不再是防重入屏障） */
let composerBusy = false;

function addFromComposer(): void {
  if (composerBusy) return; // E19：落盘窗口期忽略再次提交，防同文本双条目
  const overlay = M.overlay!;
  const input = overlay.querySelector('[data-memo-composer-input]') as HTMLInputElement;
  const txt = (input.value || '').trim();
  if (!txt) { notice('请输入内容'); return; }
  composerBusy = true;
  // 场景缺省兜底：具体场景直用，伪场景回退 memoDefaultScene/第一个（composerScene 同口径）
  const scene = composerScene();
  void (async () => {
    // T4：composer 快速录入与编辑器同口径提取 URL（标题含链接 → url 可点）
    const { url } = extractUrlAndDisplay(txt);
    // 剪贴板预填标题候选：内容仍是预填的原始 URL 才采用（用户改动即弃）
    const hint = clipTitleHint && clipTitleHint.title && txt === clipTitleHint.url ? clipTitleHint : null;
    clipTitleHint = null;
    const it: MemoItem = {
      id: generateId(), // T5：与旧 memo 同前缀 'item'（同源 memo.json）
      title: hint ? hint.title : txt,
      scene,
      // memo2-func #14 / memo2-arch A5：读「新条目默认优先级」设置（此前恒 minor 硬编码，
      // 设置 desc 承诺「新建备忘录时默认选中的优先级」对 composer 完全失效，两入口口径分裂；
      // 「重要」聚合与启动提醒判定随之漏报）
      priority: tryGetSettings().memoDefaultPriority === 'important' ? 'important' : 'minor',
      created: moment().format('YYYY-MM-DD HH:mm:ss'),
      completed: null,
      due: null,
      notePath: null,
      notePosition: null,
      scriptName: null,
      courseName: null,
      coursePath: null,
      linkedNote: null,
      url,
    };
    try {
      await MemoData.addItem(it);
      emitDomainEvent('memo', { kind: 'added', title: it.title, scene: it.scene, priority: it.priority, due: it.due });
      M.pinnedNewId = it.id; // 录入当场可见：伪场景过滤放行这条新目
      // 补全半径：toast 挂「补全」按钮直开该条编辑器
      notify(`已添加到「${scene}」`, {
        type: 'success',
        action: { label: '补全', onClick: () => openEditor(it) },
      });
      input.value = ''; // E20：成功才清空——保存失败草稿留在输入框（移动端弹窗路径同口径）
    } catch (e) {
      notifySaveError(e, '保存备忘录');
      console.error(e);
    }
    composerBusy = false;
    await refresh();
  })();
}

/** 打开编辑器（item = null 新建）；用 uiModal：无关闭按钮、点遮罩/ESC 关闭
 *
 * opts（新建态预填，issue 268 移动端「底部添加 → 弹窗」交接用；编辑态忽略）：
 *  - presetContent：内容框初值（底部录入已输入的文字带进弹窗）
 *  - presetTitle：剪藏标题框初值（剪贴板预填抓到的页面标题）
 *  - presetScene：场景平铺预选（issue 269：当前选中的场景带进弹窗；非法/缺省回落
 *    memoDefaultScene → 第一个场景，与 fallbackScene 同口径）
 *  - presetNote：关联笔记预置（2026-09-11「给当前笔记记一笔」命令；同「定位到笔记」的绑定字段）
 *  - onSaved：保存成功后的回调（调用方清底部录入草稿）
 */
export function openEditor(
  item: MemoItem | null,
  opts?: {
    presetContent?: string; presetTitle?: string; presetScene?: string; onSaved?: () => void;
    presetNote?: { path: string; position: { line: number; ch: number } | null };
  },
): void {
  const isEdit = !!item;
  const scenes = MemoData.getScenarios();
  const editing = item ?? null;
  // 默认场景：编辑态用条目自身场景；新建优先 opts.presetScene（合法才认），否则走
  // fallbackScene（设置 memoDefaultScene 或第一个）
  const presetScene = opts?.presetScene && scenes.includes(opts.presetScene) ? opts.presetScene : null;
  const defaultScene = editing ? editing.scene : (presetScene ?? fallbackScene());
  const isClip = defaultScene === '剪藏';
  const isCode = defaultScene === '代码';
  const isCourse = defaultScene === '公开课';

  // 构建表单（字段全部组件库类；图标 lucide）
  const form = document.createElement('div');
  form.className = 'bz-memo-form';
  const title = document.createElement('div');
  title.className = 'bz-memo-form-title';
  title.textContent = isEdit ? '编辑备忘录' : '创建备忘录';
  form.appendChild(title);

  // 内容
  const contentField = document.createElement('div');
  contentField.className = 'bz-field';
  const contentLabel = document.createElement('span');
  contentLabel.className = 'bz-field-label';
  contentLabel.textContent = '内容';
  const contentInput = document.createElement('textarea');
  contentInput.className = 'bz-input';
  contentInput.placeholder = '输入备忘录内容...';
  contentInput.value = editing ? editing.title : (opts?.presetContent || '');
  contentField.append(contentLabel, contentInput);
  form.appendChild(contentField);

  // 第二输入框区（剪藏标题/代码脚本/公开课课程；随场景显隐）——放在场景平铺上方
  const titleBox = document.createElement('div');
  titleBox.className = 'bz-memo-extra' + (isClip ? ' bz-memo-extra-on' : '');
  const titleInput = document.createElement('input');
  titleInput.className = 'bz-input';
  titleInput.placeholder = '标题（可选）';
  titleInput.value = editing ? '' : (opts?.presetTitle || '');
  titleBox.appendChild(titleInput);
  form.appendChild(titleBox);

  const scriptBox = document.createElement('div');
  scriptBox.className = 'bz-memo-extra' + (isCode ? ' bz-memo-extra-on' : '');
  const scriptInput = document.createElement('input');
  scriptInput.className = 'bz-input';
  scriptInput.placeholder = '脚本名';
  scriptInput.value = editing?.scriptName || '';
  scriptBox.appendChild(scriptInput);
  form.appendChild(scriptBox);

  const courseBox = document.createElement('div');
  courseBox.className = 'bz-memo-extra' + (isCourse ? ' bz-memo-extra-on' : '');
  const courseInput = document.createElement('input');
  courseInput.className = 'bz-input';
  courseInput.placeholder = '课程名';
  courseInput.value = editing?.courseName || '';
  courseBox.appendChild(courseInput);
  form.appendChild(courseBox);

  // 剪藏场景剪贴板预填（memo 弹窗同款交互：占位符预填 + 抓标题；编辑模式不预填——
  // 编辑回填先于异步读取，预填占位符会误导）
  function tryEditorClipPrefill(): void {
    void (async () => {
      if (isEdit) return;
      if (contentInput.value.trim()) return;
      const hit = await readClipUrl();
      if (!hit) return; // 非 URL 不打扰
      if (contentInput.value.trim()) return;
      contentInput.placeholder = hit.url;
      if (hit.title) titleInput.placeholder = hit.title;
      notifyClipPrefill();
    })();
  }

  // 场景平铺单选（uiChoice：无彩色圆点，选中 = 品牌色非黑底）
  const sceneField = document.createElement('div');
  sceneField.className = 'bz-field';
  const sceneLabel = document.createElement('span');
  sceneLabel.className = 'bz-field-label';
  sceneLabel.textContent = '场景';
  sceneField.appendChild(sceneLabel);
  const choice = uiChoice<string>({
    options: scenes.map((s) => ({ value: s, label: s })),
    value: defaultScene,
    float: true, // 浮岛 segmented（issue 199 拍板：滑动白卡）
    label: '场景',
    onChange: (v) => {
      // 场景联动：剪藏 → 标题框；代码 → 脚本框；公开课 → 课程框（class 驱动显隐）
      titleBox.classList.toggle('bz-memo-extra-on', v === '剪藏');
      scriptBox.classList.toggle('bz-memo-extra-on', v === '代码');
      courseBox.classList.toggle('bz-memo-extra-on', v === '公开课');
      // 切入剪藏：尝试剪贴板预填（memo 同款「剪藏场景触达即读剪贴板」）
      if (v === '剪藏') tryEditorClipPrefill();
    },
  });
  sceneField.appendChild(choice.el);
  form.appendChild(sceneField);

  // 优先级平铺单选（无彩色圆点）
  const prioField = document.createElement('div');
  prioField.className = 'bz-field';
  const prioLabel = document.createElement('span');
  prioLabel.className = 'bz-field-label';
  prioLabel.textContent = '优先级';
  prioField.appendChild(prioLabel);
  const prioChoice = uiChoice<string>({
    options: [
      { value: 'minor', label: '次要' },
      { value: 'important', label: '重要' },
    ],
    value: editing ? editing.priority : tryGetSettings().memoDefaultPriority || 'minor',
    float: true, // 浮岛 segmented（issue 199 拍板）
    label: '优先级',
    onChange: () => { /* 值由保存时读取 */ },
  });
  prioField.appendChild(prioChoice.el);
  form.appendChild(prioField);

  // 建议（从已有条目收集脚本名/课程名 + 公开课笔记）
  const knownScripts = [...new Set(M.items.map((i) => i.scriptName).filter((n): n is string => !!n))].sort();
  const knownCourses = [...new Set(M.items.map((i) => i.courseName).filter((n): n is string => !!n))].sort();
  /**
   * 联想候选下拉（issue 203：收敛为组件库 uiSuggest——聚焦/输入惰性弹出、外点收起、
   * Escape 只收下拉不关弹窗；候选排除当前值，上限 5。issue 200 焦点门控保留）。
   */
  function bindSug(input: HTMLInputElement, list: () => string[], onPick?: (val: string) => void) {
    uiSuggest({ anchor: input, source: list, max: 5, excludeCurrent: true, onPick });
  }
  // 公开课课程路径（对照 memo：点建议记 path；手改名按名匹配兜底——课程标签跳转依赖 coursePath）
  let courseNotes: { name: string; path: string }[] = [];
  let pickedCourse: { name: string; path: string } | null =
    editing?.courseName && editing.coursePath ? { name: editing.courseName, path: editing.coursePath } : null;
  bindSug(scriptInput, () => knownScripts);
  bindSug(courseInput, () => knownCourses, (val) => {
    pickedCourse = courseNotes.find((n) => n.name === val) || null;
  });
  void MemoData.getCourseNotes().then((notes) => {
    courseNotes = notes;
    const extra = notes.map((n) => n.name);
    knownCourses.push(...extra.filter((n) => !knownCourses.includes(n)));
    // memo2-ui MR2-2：不再合成 focus 事件「刷新候选」——合成事件同样触发 uiSuggest 的
    // focus=open，编辑公开课时联想层不请自来（真实焦点还在内容框，键盘导航无效）。
    // source 闭包读同一数组，候选随 push 自动生效，无需任何触发。
  });

  // 截止时间
  const dueField = document.createElement('div');
  dueField.className = 'bz-field';
  const dueLabel = document.createElement('span');
  dueLabel.className = 'bz-field-label';
  dueLabel.textContent = '截止时间（可选）';
  const dueRow = document.createElement('div');
  dueRow.className = 'bz-memo-due-row';
  const dueInput = document.createElement('input');
  dueInput.type = 'datetime-local';
  dueInput.className = 'bz-input';
  if (editing?.due) dueInput.value = editing.due.replace(' ', 'T');
  const dueClear = uiIconBtnClear();
  dueClear.style.display = editing?.due ? 'inline-flex' : 'none';
  dueClear.addEventListener('click', () => { dueInput.value = ''; dueClear.style.display = 'none'; });
  dueInput.addEventListener('input', () => { dueClear.style.display = dueInput.value ? 'inline-flex' : 'none'; });
  dueRow.append(dueInput, dueClear);
  dueField.append(dueLabel, dueRow);
  form.appendChild(dueField);

  // 📌 定位（F 款已入组件库 .bz-btn--chip，issue 200；真实读取当前笔记与光标，绑定后转品牌色）
  const posRow = document.createElement('div');
  posRow.className = 'bz-memo-pos-row';
  // 新建态可预置关联笔记（2026-09-11「给当前笔记记一笔」命令：从首页入口一步进来就带着绑定，
  // 不必再点一次「定位到笔记」）；编辑态一律以条目自身的绑定为准，预置值不参与。
  const posState: { notePath: string | null; notePosition: { line: number; ch: number } | null } = {
    notePath: editing?.notePath || opts?.presetNote?.path || null,
    notePosition: editing?.notePosition || opts?.presetNote?.position || null,
  };
  // 定位钮 = 组件库 chip 档（issue 200 F 款入库：.bz-btn--chip 图标圆底 + 文字素排）
  const posBtn = uiBtn({ icon: 'pin', label: '定位到笔记', chip: true });
  const posLabel = posBtn.lastElementChild as HTMLElement;
  const setPosBtn = (name: string, active: boolean) => {
    posLabel.textContent = name;
    posBtn.classList.toggle('is-on', active);
  };
  posBtn.addEventListener('click', () => {
    if (posState.notePath) {
      posState.notePath = null;
      posState.notePosition = null;
      setPosBtn('定位到笔记', false);
      return;
    }
    const info = getCurrentNoteInfo();
    const pos = getCurrentCursorPosition();
    if (info && pos) {
      posState.notePath = info.path;
      posState.notePosition = { line: pos.line, ch: pos.ch };
      setPosBtn(info.name, true);
    } else {
      notice('无法获取当前位置');
    }
  });
  if (posState.notePath) {
    const name = stripMdExt(posState.notePath.split('/').pop() || '');
    setPosBtn(name, true);
  } else {
    setPosBtn('定位到笔记', false);
  }
  const posHint = document.createElement('span');
  posHint.className = 'bz-memo-pos-hint';
  posHint.textContent = '绑定当前打开的笔记位置';
  posRow.append(posBtn, posHint);
  form.appendChild(posRow);

  // 底部按钮行（先建好 modal 拿 close，再绑按钮；避免 TDZ）
  let closeModal: () => void = () => {};
  const modalBox = document.createElement('div');
  modalBox.className = 'bz-memo-editor';
  const cancelBtn = uiBtn({ label: '取消', onClick: () => closeModal() });
  const saveBtn = uiBtn({ label: isEdit ? '保存' : '添加', tone: 'primary' });
  const actionsRow = document.createElement('div');
  actionsRow.className = 'bz-memo-form-actions';
  actionsRow.appendChild(uiBtnRow([cancelBtn, saveBtn]));
  form.appendChild(actionsRow);
  modalBox.appendChild(form);

  // 保存（保存逻辑提为具名 doSave 供按钮与 bindFormSubmit 键盘提交共用——memo2-ui M3-11 /
  // memo2-arch A4：memo 是主力表单域中唯一未接 bindFormSubmit 的，单行 input 回车无反应、
  // Ctrl/⌘+Enter 未绑；textarea 纯 Enter 换行不受影响。防重入 busy 对齐 composer E19 同款
  // ——memo2-func #1 / memo2-ui M2-1：落盘窗口期二次点击/回车此前各自走完整校验再 addItem
  // 一次，新建态同内容双条目入库）
  let editorBusy = false;
  const readScene = (): string => {
    const on = choice.el.querySelector('.is-on') as HTMLElement | null;
    return (on?.dataset.value as string) || defaultScene;
  };
  const readPrio = (): string => {
    const on = prioChoice.el.querySelector('.is-on') as HTMLElement | null;
    return (on?.dataset.value as string) || 'minor';
  };
  const doSave = () => {
    if (editorBusy) return;
    let content = contentInput.value.trim();
    if (!content) {
      // 剪藏预填兜底（memo 同款）：内容空但占位符已预填 URL → 采用占位符
      const ph = contentInput.placeholder;
      if (ph && ph !== '输入备忘录内容...') content = ph;
    }
    if (!content) { notice('请输入内容'); return; }
    const scene = readScene();
    const priority = readPrio();
    const dueVal = dueInput.value;
    const due = dueVal ? dueVal.replace('T', ' ') : null;
    let titleVal = titleInput.value.trim();
    if (!titleVal && scene === '剪藏') {
      // 剪藏标题占位符兜底（memo 同款）：未手填时采用预填的展示文本/抓取标题
      const ph = titleInput.placeholder;
      if (ph && ph !== '标题（可选）') titleVal = ph;
    }
    const scriptName = scene === '代码' ? (scriptInput.value.trim() || null) : null;
    let courseName: string | null = null;
    let coursePath: string | null = null;
    if (scene === '公开课') {
      const cv = courseInput.value.trim();
      if (cv) {
        courseName = cv;
        // 课程路径（对照 memo 语义）：建议点选记录的 path 仅在名字一致时采用；
        // 手改名字按名匹配建议列表兜底；匹配不到置 null（旧 path 必须清，防指向旧文件）
        if (pickedCourse && pickedCourse.name === cv) coursePath = pickedCourse.path;
        else {
          const matched = courseNotes.find((n) => n.name.toLowerCase() === cv.toLowerCase());
          if (matched) coursePath = matched.path;
        }
      }
    }
    // 剪藏：标题可选（未填则用内容）
    const finalTitle = scene === '剪藏' && titleVal ? titleVal : content;
    const { url } = extractUrlAndDisplay(content);
    editorBusy = true;
    void (async () => {
      try {
        if (isEdit && editing) {
          await MemoData.updateItem(editing.id, {
            title: finalTitle,
            scene,
            priority,
            due,
            notePath: posState.notePath,
            notePosition: posState.notePosition,
            scriptName,
            courseName,
            coursePath,
            // memo2-arch 新-1 / memo2-func #9 / memo2-ui MR2-3：url 按场景分流——
            // 非剪藏跟随内容（新内容无链接即清除，「移除链接」意图可表达，data 层
            // 自动提取分支也不再被恒有值短路）；剪藏保留兜底（标题=页面标题、正文
            // 无 URL 的形态防丢链）
            url: scene === '剪藏' ? (url ?? editing.url) : url,
          });
          emitDomainEvent('memo', { kind: 'edited', old: { title: editing.title }, next: { title: finalTitle, scene, priority, due } });
        } else {
          const it: MemoItem = {
            id: generateId(), // T5：与旧 memo 同前缀 'item'（同源 memo.json）
            title: finalTitle,
            scene,
            priority,
            created: moment().format('YYYY-MM-DD HH:mm:ss'),
            completed: null,
            due,
            notePath: posState.notePath,
            notePosition: posState.notePosition,
            scriptName,
            courseName,
            coursePath,
            linkedNote: null,
            url,
          };
          await MemoData.addItem(it);
          emitDomainEvent('memo', { kind: 'added', title: finalTitle, scene, priority, due });
          M.pinnedNewId = it.id; // 录入当场可见：伪场景过滤放行这条新目
        }
        editorBusy = false;
        closeModal();
        opts?.onSaved?.(); // 新建成功才回调（调用方清底部录入草稿；失败分支不触发）
        await refresh();
      } catch (e) {
        editorBusy = false;
        notifySaveError(e, isEdit ? '保存备忘录' : '新建备忘录');
        console.error(e);
      }
    })();
  };
  saveBtn.addEventListener('click', doSave);

  // 脏表单拦截（memo2-consistency 旧-1，favorites/clipbook 同款）：开弹窗前对全部字段
  // 做快照，requestClose 内脏检测——脏 → confirmDiscard 确认后才放行关闭（点遮罩/ESC）
  const formSnapshot = (): string =>
    JSON.stringify([
      contentInput.value, titleInput.value, scriptInput.value, courseInput.value,
      readScene(), readPrio(), dueInput.value, posState.notePath, posState.notePosition,
    ]);
  const formBaseline = formSnapshot();
  const requestClose = (): void => {
    if (formSnapshot() === formBaseline) {
      closeModal();
      return;
    }
    confirmDiscard(() => closeModal(), undefined, skinClass());
  };

  const { close, popup } = uiModal({ content: modalBox, maxWidth: 420, className: skinClass(), requestClose });
  closeModal = close;
  bindFormSubmit(popup, doSave);
  if (!isMobileEnv()) contentInput.focus();
  // 剪藏默认场景：打开即尝试剪贴板预填（新建限定；与切场景入口共用 tryEditorClipPrefill）
  if (!isEdit && defaultScene === '剪藏') tryEditorClipPrefill();
}

function uiIconBtnClear(): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bz-icon-btn bz-icon-btn--lg';
  b.title = '清除截止时间';
  b.appendChild(uiIcon('x'));
  return b;
}

// ---------- 添加场景弹窗 ----------

function openAddSceneDialog(): void {
  const wrap = document.createElement('div');
  wrap.className = 'bz-memo-addscene';
  const title = document.createElement('div');
  title.className = 'bz-memo-form-title';
  title.textContent = '添加场景';
  const input = document.createElement('input');
  input.className = 'bz-input';
  input.placeholder = '场景名称（如：健身）';
  const hint = document.createElement('div');
  hint.className = 'bz-memo-addscene-hint';
  hint.textContent = '场景将写入备忘录设置（与备忘录共用）';
  const saveBtn = uiBtn({ label: '添加', tone: 'primary' });
  const cancelBtn = uiBtn({ label: '取消' });
  const row = uiBtnRow([cancelBtn, saveBtn]);
  wrap.append(title, input, hint, row);
  const { close, popup } = uiModal({ content: wrap, maxWidth: 340, className: skinClass() });
  // memo2-arch 新-2 / memo2-ui M3-5 / memo2-func #13：doSave 改 async + try/catch →
  // notifySaveError——此前 void saveSettings().then 无 catch，落盘 reject 时 unhandled
  // rejection、场景未生效、弹窗不关像「点了没反应」；失败不关弹窗草稿保留（E20 同哲学）
  const doSave = () => {
    const name = input.value.trim();
    if (!name) { notice('请输入场景名称'); return; }
    if (/[,，]/.test(name)) { notice('场景名不能包含逗号'); return; }
    const scenes = MemoData.getScenarios();
    if (scenes.includes(name)) { notice('场景已存在'); return; }
    void (async () => {
      try {
        const settings = getSettings();
        settings.memoScenarios = [...scenes, name].join(',');
        await saveSettings();
        MemoData.init(getSettings());
        notice(`已添加场景「${name}」`, 'success');
        close();
        await refresh();
      } catch (e) {
        notifySaveError(e, '添加场景');
        console.error(e);
      }
    })();
  };
  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', () => close());
  // memo2-ui M3-11 / memo2-arch A4：bindFormSubmit 收编键盘提交（单行 input 回车即存、
  // Ctrl/⌘+Enter 提交、isComposing 组词守卫内建——memo2-func #8）；Escape 关闭收编
  // escManager/uiModal 层（memo2-consistency 旧-3：手写 Escape 与 escManager 层重复）
  bindFormSubmit(popup, doSave);
  if (!isMobileEnv()) setTimeout(() => input.focus(), 30);
}

// ---------- 场景管理（左栏场景项右键菜单 / 移动长按抽屉） ----------

/** 场景项动作集（伪场景不挂，见 attachSceneActions；默认场景禁重命名/删除——issue 200 拍板） */
function buildSceneActions(scene: string): ItemAction[] {
  const actions: ItemAction[] = [
    { icon: ICON.settings, label: '在设置中编辑', title: '打开设置面板编辑场景列表', onClick: () => openMemoInSettings() },
  ];
  if (DEFAULT_SCENARIOS.includes(scene)) return actions;
  actions.push(
    { icon: ICON.edit, label: '重命名', title: '重命名场景', onClick: () => openRenameSceneDialog(scene) },
    { icon: ICON.del, label: '删除场景', title: '删除场景', kind: 'danger', onClick: () => void deleteSceneConfirm(scene) },
  );
  return actions;
}

/** 设置直达：关面板 → 设置面板定位备忘录域（头行设置钮 / 场景菜单「在设置中编辑」共用；
 *  动态 import 防顶层环引用，ADR-0002） */
function openMemoInSettings(): void {
  const app = M.appRef;
  closeMemoPanel();
  if (!app) return;
  void import('../settings-panel').then((m) => m.openSettingsPanel(app, 'memo'));
}

/** 场景列表写回设置串（与旧 memo 共用 memoScenarios 键）→ 重建数据层 → 刷新 */
function commitScenarios(next: string[], okMsg: string): Promise<void> {
  getSettings().memoScenarios = next.join(',');
  return saveSettings().then(async () => {
    MemoData.init(getSettings());
    notice(okMsg, 'success');
    await refresh();
  });
}

/** 场景重命名浮层：批量改条目 scene 字段 + 更新设置串（默认场景拒改，issue 200 拍板） */
function openRenameSceneDialog(scene: string): void {
  if (DEFAULT_SCENARIOS.includes(scene)) { notice('默认场景不支持重命名'); return; }
  const wrap = document.createElement('div');
  wrap.className = 'bz-memo-addscene';
  const title = document.createElement('div');
  title.className = 'bz-memo-form-title';
  title.textContent = '重命名场景';
  const input = document.createElement('input');
  input.className = 'bz-input';
  input.value = scene;
  const count = M.items.filter((i) => i.scene === scene).length;
  const hint = document.createElement('div');
  hint.className = 'bz-memo-addscene-hint';
  hint.textContent = count > 0 ? `保存后 ${count} 条备忘录将同步改为新场景名` : '场景将写入备忘录设置（与备忘录共用）';
  const saveBtn = uiBtn({ label: '保存', tone: 'primary' });
  const cancelBtn = uiBtn({ label: '取消' });
  const row = uiBtnRow([cancelBtn, saveBtn]);
  wrap.append(title, input, hint, row);
  const { close, popup } = uiModal({ content: wrap, maxWidth: 340, className: skinClass() });
  const doSave = () => {
    const name = input.value.trim();
    if (!name) { notice('请输入场景名称'); return; }
    if (/[,，]/.test(name)) { notice('场景名不能包含逗号'); return; }
    if (name === scene) { close(); return; }
    const scenes = MemoData.getScenarios();
    if (scenes.includes(name)) { notice('场景已存在'); return; }
    void (async () => {
      let moved = 0;
      try {
        moved = await MemoData.updateSceneBulk(scene, name); // 批量改条目 scene 字段（同源 memo.json）
        if (moved === 0 && count > 0) throw new Error('场景迁移未生效');
        await commitScenarios(scenes.map((s) => (s === scene ? name : s)), `已重命名为「${name}」`);
        if (M.activeScene === scene) M.activeScene = name;
        renderAll();
        close();
      } catch (e) {
        // memo2-func #12：两段写非原子——设置串写失败时条目 scene 已改而场景列表仍旧名，
        // 条目挂进「不可达」场景。失败分支反向迁移补偿（别追求跨文件原子，自愈即可）。
        if (moved > 0) {
          try { await MemoData.updateSceneBulk(name, scene); } catch { /* 补偿失败仅留痕，抛原错误 */ }
        }
        notifySaveError(e, '重命名场景');
        console.error(e);
      }
    })();
  };
  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', () => close());
  // 键盘提交/Escape 收编：bindFormSubmit + escManager 层（openAddSceneDialog 同款，见该处注）
  bindFormSubmit(popup, doSave);
  if (!isMobileEnv()) setTimeout(() => { input.focus(); input.select(); }, 30);
}

/** 删除场景：非空条目确认迁入默认场景（memoDefaultScene，兜底其余场景第一个）；空场景直接确认移除
 *  （默认场景拒删，issue 200 拍板） */
async function deleteSceneConfirm(scene: string): Promise<void> {
  if (DEFAULT_SCENARIOS.includes(scene)) { notice('默认场景不支持删除'); return; }
  const scenes = MemoData.getScenarios();
  const others = scenes.filter((s) => s !== scene);
  const defSetting = tryGetSettings().memoDefaultScene;
  const target = defSetting && others.includes(defSetting) ? defSetting : others[0];
  if (!target) { notice('至少保留一个场景'); return; }
  const count = M.items.filter((i) => i.scene === scene).length;
  const ok = await openFlowDialog({
    title: '删除场景',
    message: count > 0
      ? `确定删除场景「${scene}」吗？\n其中 ${count} 条备忘录将迁入默认场景「${target}」。`
      : `确定删除场景「${scene}」吗？\n场景将从设置中移除。`,
    className: skinClass(), // 挂 body 的流程框须显式带皮肤类（issue 291）
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'delete', danger: true, cta: true },
    ],
  });
  if (ok !== 'delete') return;
  let moved = 0;
  try {
    moved = count > 0 ? await MemoData.updateSceneBulk(scene, target) : 0;
    await commitScenarios(others, `已删除场景「${scene}」`);
    if (M.activeScene === scene) M.activeScene = '全部';
    renderAll();
  } catch (e) {
    // memo2-func #12：两段写非原子——设置串写失败时条目已迁入目标场景而场景列表仍旧名，
    // 条目挂进「不可达」场景。失败分支反向迁移补偿（重命名同款）。
    if (moved > 0) {
      try { await MemoData.updateSceneBulk(target, scene); } catch { /* 补偿失败仅留痕，抛原错误 */ }
    }
    notifySaveError(e, '删除场景');
    console.error(e);
  }
}

// ---------- 导出（index.ts 用） ----------

/** 启动链单次读盘（memo2-efficiency 新-5）：ensureMemo 发起的 loadData 由提醒后台经
 *  memoDataReady() 复用——此前 onLayoutReady 同一链路 ensureMemo 的 void loadData 与
 *  autoPopupOnStart 的 loadItems 背靠背全量读两遍 memo.json（同队列串行无竞态但纯冗余）。
 *  loadData 自兜错误（不 reject），本 Promise 恒 resolve。 */
let initialLoad: Promise<void> | null = null;
export function memoDataReady(): Promise<void> {
  return initialLoad ?? Promise.resolve();
}

export function ensureMemo(app: App): void {
  if (M.appRef) return;
  M.appRef = app;
  registerEscapeHandler();
  subscribeMemoSync(app); // T1：同源 memo.json 跨域同步
  initialLoad = loadData();
}

export function addMemo(app: App): void {
  ensureMemo(app);
  void (async () => {
    if (!M.items.length) await loadData();
    if (!M.overlay) openMemoPanel(app);
    openEditor(null);
  })();
}

export function unloadMemo(): void {
  closeMemoPanel();
  unsubscribeMemoSync(); // T1：退订 vault modify + 还原 MemoData.write 包装
  M.completeTimers.forEach((t) => clearTimeout(t));
  M.completeTimers.clear();
  M.appRef = null;
}

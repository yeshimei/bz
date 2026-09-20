/**
 * 备忘录（memo）提醒后台（memo→memo 接管迁移第 3 项的提前实施）
 * 自 memo/app.ts 迁入的两处被动捕获入口，落点改备忘录面板：
 *   - 启动自动弹出：autoPopupOnStart 开（缺省开）且存在重要/到期未完成备忘录 → 300ms 后打开备忘录面板；
 *   - 打开笔记提醒：openNoteReminder 开（缺省开）且笔记有关联的重要/到期未完成备忘录 →
 *     打开备忘录面板并以笔记路径定位（搜索框预设 notePath，列表即只显该笔记关联备忘录）；
 *     无关联备忘录则不自动打开。
 * 设置键与旧 memo 共享（autoPopupOnStart/openNoteReminder）；memo 侧旧弹窗已随入口改道移除
 * （见 memo/app.ts）。纯接线层：判断用 memo/due + memo/data，打开走 memo/ui 的 openMemoPanel。
 */
import type { App, EventRef } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { notifyActionError } from '../core/notice';
import { MemoData } from './data';
import { getDueStatus } from './due';
import { M } from './state';
import { openMemoPanel, memoDataReady } from './ui';
import type { MemoItem } from './types';

/** 是否存在未完成的重要或到期备忘录（path 给定时只看该笔记的关联备忘录）——memo/app.ts 同款语义 */
export function hasPendingUrgent(items: MemoItem[], path?: string | null): boolean {
  return items.some(
    (i) =>
      i.completed === null &&
      (!path || i.notePath === path) &&
      (i.priority === 'important' || (i.due && getDueStatus(i.due) !== 'future'))
  );
}

let fileOpenRef: EventRef | null = null;
/** E7：注册时自持 app 引用——此前卸载经 M.appRef 可选链，uiUnload 先置空 M.appRef 时
 *  offref 短路永不执行：禁用插件后 file-open 监听仍在（开笔记照弹面板写 memo.json），
 *  再启用还会叠加翻倍。存本模块变量后卸载顺序无关。 */
let fileOpenApp: App | null = null;
let startPopupTimer: ReturnType<typeof setTimeout> | null = null;
/** 已提醒笔记（同 memo remindedFiles 口径：同一笔记只提醒一次，防反复弹出） */
const remindedFiles = new Set<string>();

/** 打开备忘录面板并定位到该笔记的关联备忘录（面板已开时不闪关，只更新定位条件） */
function openForNote(app: App, path: string): void {
  if (M.overlay) {
    M.search = path;
    const input = M.overlay.querySelector('[data-memo-search]') as HTMLInputElement | null;
    if (input) input.value = path;
    // memo2-func #5 / memo2-arch A3：已开分支此前不重置场景——用户停在具体场景/「今日」/
    // 「重要」时，搜索词虽命中但目标条目被场景过滤挡掉，提醒定位静默失效。对齐冷开分支
    // 口径（openMemoPanel notePath 分支恒「全部」，注释明言「场景过滤会把目标条目挡掉」）。
    M.activeScene = '全部';
    M.pinnedNewId = null;
    M.renderFn?.();
    return;
  }
  openMemoPanel(app, { notePath: path });
}

/** 启动自动弹出（memo init 同款 300ms 延迟；无重要/到期未完成备忘录不弹）。
 *  memo2-efficiency 新-5：await memoDataReady() 消费 ensureMemo 已启动的那次读盘，
 *  不再背靠背二读 memo.json。 */
async function autoPopupOnStart(app: App): Promise<void> {
  await memoDataReady();
  if (!hasPendingUrgent(M.items)) return;
  startPopupTimer = setTimeout(() => {
    startPopupTimer = null;
    if (!M.overlay) openMemoPanel(app);
  }, 300);
}

/** 注册提醒后台（幂等；main.ts onLayoutReady 调用） */
export function ensureMemoReminders(app: App): void {
  if (fileOpenRef) return;
  const s = tryGetSettings();
  fileOpenApp = app; // E7：自持引用，卸载不再依赖 M.appRef 存活
  // 启动自动弹出（开关注册时判定；关=不弹也不设定时）
  if (s?.autoPopupOnStart !== false) void autoPopupOnStart(app);
  // 打开笔记提醒（开关事件触发时判定——设置变更即时生效，无需重注册）
  fileOpenRef = app.workspace.on('file-open', (file: any) => {
    void (async () => {
      if (!file) return;
      if (tryGetSettings()?.openNoteReminder === false) return;
      const path = file.path as string;
      if (!path || remindedFiles.has(path)) return;
      // memo2-efficiency 新-2：file-open 是切笔记级高频事件，此前每次都全量读盘
      // memo.json。先以内存 M.items 预判（ensureMemo/autoPopup 已装载），命中才重读确认
      // （防 file-sync 刚改的 stale）；miss 直接返回——绝大多数切换零 IO。
      // M.items 为空 = 启动窗口尚未装载（或读失败），不预判直读，保提醒不漏。
      if (M.items.length && !hasPendingUrgent(M.items, path)) return;
      try {
        const items = await MemoData.loadItems();
        M.items = items;
        if (hasPendingUrgent(items, path)) {
          remindedFiles.add(path);
          openForNote(app, path);
        }
      } catch (e) {
        // memo2-func #7 / memo2-arch A9：读盘通道级失败此前沿 void 链静默断，提醒失效无解释
        notifyActionError(e, '读取备忘录');
        console.error(e);
      }
    })();
  });
}

/** 卸载清理（memo/index.ts unloadMemo 调用；幂等） */
export function unloadMemoReminders(): void {
  if (fileOpenRef) {
    try {
      fileOpenApp?.workspace.offref?.(fileOpenRef as any); // E7：用自持 app，不依赖 M.appRef
    } catch (e) { /* 环境无 offref 时忽略 */ }
    fileOpenRef = null;
  }
  fileOpenApp = null;
  if (startPopupTimer !== null) {
    clearTimeout(startPopupTimer);
    startPopupTimer = null;
  }
  remindedFiles.clear();
}

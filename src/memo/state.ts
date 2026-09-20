/**
 * 备忘录（memo）域状态：模块级可变对象 M + 界面状态
 * memo.json 唯一属主（ADR-0092，旧 memo 域已退役删除）：后台任务在域内
 * reminder.ts（启动/file-open 提醒）与 file-sync.ts（引用同步）执行。
 */
import type { App } from 'obsidian';
import type { MemoItem } from './types';

export interface MemoState {
  appRef: App | null;
  /** 面板是否已初始化/打开 */
  overlay: HTMLElement | null;
  /** 全部条目（loadItems 结果） */
  items: MemoItem[];
  /** 场景筛选：'全部' | '今日'（到期优先视图） | 场景名 */
  activeScene: string;
  /** 排序：priority（紧急优先）/ due（仅按到期）/ created（按创建） */
  sortMode: string;
  /** 搜索关键字（桌面工具行） */
  search: string;
  /** 已完成折叠区是否展开 */
  showDone: boolean;
  /** 已完成折叠区：「更早 N 条」（时间窗外，memoDoneWindow）是否展开 */
  showEarlierDone: boolean;
  /** 录入当场可见：composer/编辑器新建条目 id（伪场景「今日」「重要」过滤放行，切场景/关面板清空） */
  pinnedNewId: string | null;
  /** 勾选完成防抖计时（300ms，对齐 memo 卡片行为） */
  completeTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** UI 重渲染回调（ADR-0002：store 层无 DOM，UI 注册） */
  renderFn: (() => void) | null;
}

export const M: MemoState = {
  appRef: null,
  overlay: null,
  items: [],
  activeScene: '全部',
  sortMode: 'priority',
  search: '',
  showDone: false,
  showEarlierDone: false,
  pinnedNewId: null,
  completeTimers: new Map(),
  renderFn: null,
};

/** 测试/重建用：整体重置模块状态 */
export function resetMemoState(): void {
  M.appRef = null;
  M.overlay = null;
  M.items = [];
  M.activeScene = '全部';
  M.sortMode = 'priority';
  M.search = '';
  M.showDone = false;
  M.showEarlierDone = false;
  M.pinnedNewId = null;
  M.completeTimers.forEach((t) => clearTimeout(t));
  M.completeTimers.clear();
  M.renderFn = null;
}

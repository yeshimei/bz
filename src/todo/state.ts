/**
 * 待办（todo）域状态：模块级可变对象 M + 界面状态
 * 与 memo 域并存：读写同一 memo.json；后台任务（引用同步/AI 剪藏归档/启动与
 * file-open 提醒）仍由旧 memo 域执行，todo 只负责 UI 与交互（旧 memo 删除时再交接）。
 */
import type { App } from 'obsidian';
import type { TodoItem } from './types';

export interface TodoState {
  appRef: App | null;
  /** 面板是否已初始化/打开 */
  overlay: HTMLElement | null;
  /** 全部条目（loadItems 结果） */
  items: TodoItem[];
  /** 场景筛选：'全部' | '今日'（到期优先视图） | 场景名 */
  activeScene: string;
  /** 排序：priority（紧急优先）/ due（仅按到期）/ created（按创建） */
  sortMode: string;
  /** 搜索关键字（桌面工具行） */
  search: string;
  /** 已完成折叠区是否展开 */
  showDone: boolean;
  /** 已完成折叠区：「更早 N 条」（30 天前）是否展开 */
  showEarlierDone: boolean;
  /** 录入当场可见：composer/编辑器新建条目 id（伪场景「今日」「重要」过滤放行，切场景/关面板清空） */
  pinnedNewId: string | null;
  /** 勾选完成防抖计时（300ms，对齐 memo 卡片行为） */
  completeTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** UI 重渲染回调（ADR-0002：store 层无 DOM，UI 注册） */
  renderFn: (() => void) | null;
  /** 当前编辑条目 id（null = 新建） */
  editingId: string | null;
}

export const M: TodoState = {
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
  editingId: null,
};

/** 测试/重建用：整体重置模块状态 */
export function resetTodoState(): void {
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
  M.editingId = null;
}

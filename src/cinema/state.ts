/**
 * 影院（cinema）域状态：模块级可变对象 M
 * 自 ADR-0087 起接管原 movie 域（旧 src/movie 已退役），数据仍是 `我的/影视/*.md`。
 */
import type { App, TFile } from 'obsidian';

/** 影视目录默认值（cinemaFolderPath 未配置时回落；旧 movieFolderPath 键已退役） */
export const DEFAULT_FOLDER = '我的/影视';

export interface CinemaItem {
  file: TFile | null;
  name: string;
  typeTag: string;
  group: string;
  watchDate: string | null;
  rating: number | null;
  status: number;
  poster: string | null;
  review: string | null;
  genre: string | null;
  director: string | null;
  actors: string | null;
  region: string | null;
  year: string | null;
  doubanRating: string | null;
  doubanUrl: string | null;
  synopsis: string | null;
}

/** 排序模式：date=最近观看（默认）/ created=按创建 / rating=按评分 */
export type CinemaSortMode = 'date' | 'created' | 'rating';

export interface CinemaState {
  currentOverlay: HTMLElement | null;
  items: CinemaItem[];
  /** 当前筛选：type=组（null=全部）、sub=细分 tag、status=状态（null=全部） */
  typeFilter: string | null;
  subFilter: string | null;
  statusFilter: string | null;
  /** 左栏展开的二级分组（组名 → 是否展开） */
  expanded: Record<string, boolean>;
  /** 排序模式 */
  sortMode: CinemaSortMode;
  /** 当前视图：list / ai / stat */
  view: 'list' | 'ai' | 'stat';
  searchKeyword: string;
  searchDebounceTimer: ReturnType<typeof setTimeout> | null;
  appRef: App | null;
  folderPath: string;
  renderFn: (() => void) | null;
  aiOverlay: HTMLElement | null;
  statOverlay: HTMLElement | null;
  /** AI 页内状态（不弹窗）：是否运行中 / 等待消息 / 结果列表 / 错误信息 / 页标题（找同类区分） */
  aiRunning: boolean;
  aiWaitMsg: string;
  aiResult: any[] | null;
  aiError: string | null;
  aiTitle: string;
}

export const M: CinemaState = {
  currentOverlay: null,
  items: [],
  typeFilter: null,
  subFilter: null,
  statusFilter: null,
  expanded: {},
  sortMode: 'date',
  view: 'list',
  searchKeyword: '',
  searchDebounceTimer: null,
  appRef: null,
  folderPath: DEFAULT_FOLDER,
  renderFn: null,
  aiOverlay: null,
  statOverlay: null,
  aiRunning: false,
  aiWaitMsg: '',
  aiResult: null,
  aiError: null,
  aiTitle: 'AI 荐片',
};

/** 测试/重建用：整体重置模块状态 */
export function resetCinemaState(): void {
  M.currentOverlay = null;
  M.items = [];
  M.typeFilter = null;
  M.subFilter = null;
  M.statusFilter = null;
  M.expanded = {};
  M.sortMode = 'date';
  M.view = 'list';
  M.searchKeyword = '';
  M.searchDebounceTimer = null;
  M.appRef = null;
  M.folderPath = DEFAULT_FOLDER;
  M.renderFn = null;
  M.aiOverlay = null;
  M.statOverlay = null;
  M.aiRunning = false;
  M.aiWaitMsg = '';
  M.aiResult = null;
  M.aiError = null;
  M.aiTitle = 'AI 荐片';
}

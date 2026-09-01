/**
 * 影院（cinema）域状态：模块级可变对象 M（与 movie 域同构但独立）
 */
import type { App, TFile } from 'obsidian';

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

export interface CinemaState {
  currentOverlay: HTMLElement | null;
  items: CinemaItem[];
  /** 当前筛选：type=组（null=全部）、sub=细分 tag、status=状态（null=全部） */
  typeFilter: string | null;
  subFilter: string | null;
  statusFilter: string | null;
  /** 左栏展开的二级分组（组名 → 是否展开） */
  expanded: Record<string, boolean>;
  /** 当前视图：list / ai / stat */
  view: 'list' | 'ai' | 'stat';
  searchKeyword: string;
  searchDebounceTimer: ReturnType<typeof setTimeout> | null;
  appRef: App | null;
  folderPath: string;
  renderFn: (() => void) | null;
  aiOverlay: HTMLElement | null;
  statOverlay: HTMLElement | null;
}

export const M: CinemaState = {
  currentOverlay: null,
  items: [],
  typeFilter: null,
  subFilter: null,
  statusFilter: null,
  expanded: {},
  view: 'list',
  searchKeyword: '',
  searchDebounceTimer: null,
  appRef: null,
  folderPath: '我的/影视',
  renderFn: null,
  aiOverlay: null,
  statOverlay: null,
};

/** 测试/重建用：整体重置模块状态 */
export function resetCinemaState(): void {
  M.currentOverlay = null;
  M.items = [];
  M.typeFilter = null;
  M.subFilter = null;
  M.statusFilter = null;
  M.expanded = {};
  M.view = 'list';
  M.searchKeyword = '';
  M.searchDebounceTimer = null;
  M.appRef = null;
  M.folderPath = '我的/影视';
  M.renderFn = null;
  M.aiOverlay = null;
  M.statOverlay = null;
}

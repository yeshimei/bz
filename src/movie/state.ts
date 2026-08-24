/**
 * 影视模块级状态（ticket 14，源码逐字移植）
 * 统一可变对象 M：TS 对 `export let` 的导入绑定只读，故收敛为对象属性。
 */
import type { App, TFile } from 'obsidian';

export interface MovieItem {
  file: TFile;
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
}

export interface MovieState {
  currentOverlay: HTMLElement | null;
  items: MovieItem[];
  sortState: { key: string; order: 'asc' | 'desc' };
  typeFilter: string;
  statusFilter: string;
  addOverlay: HTMLElement | null;
  settingsOverlay: HTMLElement | null;
  editOverlay: HTMLElement | null;
  recommendOverlay: HTMLElement | null;
  appRef: App | null;
  folderPath: string;
  renderListFn: (() => void) | null;
  loadedCount: number;
  pageSize: number;
  isLoadingMore: boolean;
  searchKeyword: string;
  searchDebounceTimer: ReturnType<typeof setTimeout> | null;
  homeFilmStatus: string | null;
}

export const M: MovieState = {
  currentOverlay: null,
  items: [],
  sortState: { key: 'date', order: 'desc' },
  typeFilter: '全部',
  statusFilter: '全部',
  addOverlay: null,
  settingsOverlay: null,
  editOverlay: null,
  recommendOverlay: null,
  appRef: null,
  folderPath: '我的/影视',
  renderListFn: null,
  loadedCount: 0,
  pageSize: 20,
  isLoadingMore: false,
  searchKeyword: '',
  searchDebounceTimer: null,
  homeFilmStatus: null,
};

/** 首页「打开影视」传入的初始状态过滤（'全部'/'想看'/'在看'/'已看'） */
export function setHomeFilmStatus(status: string | null): void {
  M.homeFilmStatus = status;
}

/** 读取并清除首页传入的状态 */
export function takeHomeFilmStatus(): string | null {
  const s = M.homeFilmStatus;
  M.homeFilmStatus = null;
  return s;
}

/** 测试/重建用：整体重置模块状态 */
export function resetMovieState(): void {
  M.currentOverlay = null;
  M.items = [];
  M.sortState = { key: 'date', order: 'desc' };
  M.typeFilter = '全部';
  M.statusFilter = '全部';
  M.addOverlay = null;
  M.settingsOverlay = null;
  M.editOverlay = null;
  M.recommendOverlay = null;
  M.appRef = null;
  M.folderPath = '我的/影视';
  M.renderListFn = null;
  M.loadedCount = 0;
  M.pageSize = 20;
  M.isLoadingMore = false;
  M.searchKeyword = '';
  M.searchDebounceTimer = null;
  M.homeFilmStatus = null;
}

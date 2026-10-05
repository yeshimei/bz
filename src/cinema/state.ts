/**
 * 影院（cinema）域状态：模块级可变对象 M
 * 自 ADR-0087 起接管原 movie 域（旧 src/movie 已退役），数据仍是 `我的/影视/*.md`。
 */
import type { CinemaViewKind } from './shared';
import type { Rewatch } from './constants';
import type { App, TFile } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';

/** 影视目录默认值（cinemaFolderPath 未配置时回落；旧 movieFolderPath 键已退役） */
export const DEFAULT_FOLDER = '我的/影视';

/** 影视目录解析（目录唯一真理跨域化，ADR-0115）：cinemaFolderPath 显式配置优先，缺省回落默认。
 *  日记本域经此函数读取影视目录（不再有独立的 movieDirectory 设置键），设置访问器未注入时回落默认。 */
export function resolveCinemaFolderPath(): string {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    return typeof s.cinemaFolderPath === 'string' && s.cinemaFolderPath.trim() ? s.cinemaFolderPath : DEFAULT_FOLDER;
  } catch (e) {
    return DEFAULT_FOLDER;
  }
}

export interface CinemaItem {
  file: TFile | null;
  name: string;
  typeTag: string;
  group: string;
  watchDate: string | null;
  rating: number | null;
  status: number;
  /** 进入「想看」的日期（frontmatter「想看日期」，YYYY-MM-DD；想看建档 / 状态切回想看时记）。
   *  与观影日期分工：三状态各记各的到达日，旧笔记无键 = null 不显示 */
  wantDate: string | null;
  /** 进入「在看」的日期（frontmatter「在看日期」，YYYY-MM-DD；标记在看 / 编辑切在看时记） */
  watchingDate: string | null;
  /** 到「已看」的日期（frontmatter「已看日期」，YYYY-MM-DD；编辑切已看时记）。
   *  **与观影日期分工**（2026-10-01 拍板，issue 536）：观影日期是**排序时间戳**——建档/编辑/标记在看
   *  都会刷它，所以它不能当「看过」的凭据（用户报的幽灵节点：一条刚导入的在看条目，时间线里凭空
   *  多出一行「已看」，日期就是入库日）。凡是要表达「哪天看的」（详情时间线的已看/首看节点、
   *  合集行副行、年书各轴），一律读本键。
   *  只增不删（同另两个状态日期）；旧笔记无键 = 读取层在已看态回落观影日期（data.ts 单点兜底）。 */
  watchedDate: string | null;
  /** 重温（刷次）记录（frontmatter「重看」数组，每项一次重温；ADR-0240 起每项带当刷评分）。
   *  刷数 = 1 + 本数组长度（首看占第 1 刷，不入数组）；界面评分取平均评分 avgRating（constants）。
   *  建档/编辑不写此键，只有「重温 +1」落盘；旧档为纯时刻字符串，解析层补 rating: null。 */
  rewatches: Rewatch[];
  /** 自建片单（frontmatter「片单」数组；建档/编辑不写，归入/移出时落盘）。
   *  含内置片单「重映厅」（constants REWATCH_SHELF）。侧栏片单区 / 片单筛选 / 归入弹层消费 */
  lists: string[];
  /** 片单收纳（frontmatter「片单收纳」= true）：豆瓣片单一键导入的新片专属——只在其
   *  片单里呈现，不混入正常影视视图（浏览态：全部/类型/状态排除；片单筛选命中时显示）。
   *  **搜索不受此限**（2026-10-05 拍板）：全局搜索在全库匹配，收纳条目也能搜到。
   *  状态离开「想看」（标记在看/已看，persistItem 汇合）即摘除——用户开始正式管理就回归
   *  正常视图。在库旧档归片单不打此标，一切照旧 */
  shelvedOnly: boolean;
  /** 手动归入的合集名（frontmatter「合集」= 目标合并卡的归一名称，如「绝命毒师」）。
   *  自动并入靠片名前缀（seasons.specialHostOf），前缀对不上的（「续命之徒：绝命毒师电影」）
   *  用本键手动挂——ADR-0241（2026-10-05）：合并从「纯渲染层分组」放开到允许这一条声明键。
   *  声明的卡不存在 = 悬空声明 → 条目回落普通卡（不报错、不吞条目）；建档/编辑不写此键。 */
  mergeInto: string | null;
  poster: string | null;
  review: string | null;
  genre: string | null;
  director: string | null;
  actors: string | null;
  region: string | null;
  year: string | null;
  /** 完整上映日期原文（frontmatter「上映日期」，如 2013-01-08）。year 只留前 4 位
   *  （卡片副行 / 分析页片龄统计按年聚合），详情弹窗要的是完整日期，故另存一份（687/687 有值） */
  releaseDate: string | null;
  doubanRating: string | null;
  doubanUrl: string | null;
  synopsis: string | null;
  /** 片长原文（frontmatter「片长」，如「118分钟」；分析页片长画像用，ADR-0090 并入） */
  duration: string | null;
  /** 季集原文（frontmatter「季集」，如「2季」；分析页追剧深度用，ADR-0090 并入） */
  seasonText: string | null;
  /** 豆瓣热门短评原文（frontmatter「热门短评」；451/687 抓到，中位 39 字、最长 465） */
  hotComment: string | null;
}

/** 排序模式：date=最近观看（默认）/ created=按创建 / rating=按评分 */
export type CinemaSortMode = 'date' | 'created' | 'rating';

export interface CinemaState {
  currentOverlay: HTMLElement | null;
  items: CinemaItem[];
  /** 当前筛选：type=组（null=全部）、status=状态（null=全部）、list=片单（null=全部；与类型/状态叠加） */
  typeFilter: string | null;
  statusFilter: string | null;
  listFilter: string | null;
  /** 排序模式 */
  sortMode: CinemaSortMode;
  /** 当前视图：list / ai */
  view: CinemaViewKind;
  searchKeyword: string;
  searchDebounceTimer: ReturnType<typeof setTimeout> | null;
  /** 面板内最近一次键入时刻（Date.now()，0=从未输入）。后台整刷（豆瓣补抓 / vault 事件）
   *  据此判定「用户还在打字」→ 顺延渲染，不再打断输入（issue: 影院搜索框打几个字就失焦） */
  lastInputAt: number;
  appRef: App | null;
  folderPath: string;
  renderFn: (() => void) | null;
  /** AI 页内状态（不弹窗）：是否运行中 / 等待消息 / 结果列表 / 错误信息 */
  aiRunning: boolean;
  aiWaitMsg: string;
  aiResult: any[] | null;
  aiError: string | null;
  /** 找同类基准影片（「换一批」按基准重跑；荐片为 null） */
  aiBase: CinemaItem | null;
}

export const M: CinemaState = {
  currentOverlay: null,
  items: [],
  typeFilter: null,
  statusFilter: null,
  listFilter: null,
  sortMode: 'date',
  view: 'list',
  searchKeyword: '',
  searchDebounceTimer: null,
  lastInputAt: 0,
  appRef: null,
  folderPath: DEFAULT_FOLDER,
  renderFn: null,
  aiRunning: false,
  aiWaitMsg: '',
  aiResult: null,
  aiError: null,
  aiBase: null,
};

/** 测试/重建用：整体重置模块状态 */
export function resetCinemaState(): void {
  M.currentOverlay = null;
  M.items = [];
  M.typeFilter = null;
  M.statusFilter = null;
  M.listFilter = null;
  M.sortMode = 'date';
  M.view = 'list';
  M.searchKeyword = '';
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer); // 悬挂防抖真定时器必须清（只置 null = 定时器仍在，到点把旧词写回搜索态）
  M.searchDebounceTimer = null;
  M.lastInputAt = 0;
  M.appRef = null;
  M.folderPath = DEFAULT_FOLDER;
  M.renderFn = null;
  M.aiRunning = false;
  M.aiWaitMsg = '';
  M.aiResult = null;
  M.aiError = null;
  M.aiBase = null;
}

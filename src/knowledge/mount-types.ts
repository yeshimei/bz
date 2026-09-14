/**
 * 挂载树包共享契约（ADR-0137 挂载点/挂载树、ADR-0138 语义建议、ADR-0139 零落盘）
 *
 * 本文件是 issues 314–320 各模块之间的**唯一接口**，只放类型与常量、不放逻辑：
 *   mount-data（314/315 数据层）
 *     → mount-layout / mount-route（316 几何层，纯函数、可在 node 断言）
 *       → mount-canvas（317/319 渲染层，唯一接线处）
 *   mount-suggest（318 建议链路，独立于几何层）
 * 依赖方向（ADR-0002）：core ← data ← geom ← ui。各模块**只 import type 本文件**，
 * 严禁互相 import 实现（渲染层 mount-canvas 负责把四者接起来）。
 */

/** 六类内容形态（ADR-0137 §3）：整篇笔记 / 标题+内容 / 段落块引用 / 图片 / 视频 / 卡片 */
export type MountKind = 'note' | 'head' | 'para' | 'image' | 'video' | 'card';

/** 挂载来源（ADR-0137 §2）。`ai` 只出现在建议幽灵节点上——建议不是挂载、不落盘（ADR-0138） */
export type MountSource = 'self' | 'sameName' | 'link' | 'related' | 'manual' | 'ai';

/** 视图方向：`downstream` = 以主卡为根看它挂了谁；`upstream` = 看谁挂了我（右键临时翻，同一构建器两个方向） */
export type MountDirection = 'downstream' | 'upstream';

/** 建议处置态（ADR-0139 §3）：待定 / 已固定（写 wikilink 留档）/ 已取消（永不再推） */
export type SuggestState = 'pending' | 'fixed' | 'dismissed';

/** 建议链路状态（顶栏显示用）：生成中 / 命中缓存 / 无向量索引（降级）/ 无可用 AI（降级） */
export type SuggestStatus = 'generating' | 'cached' | 'fresh' | 'no-index' | 'no-ai';

/** 锚点：正文里的一段文字。**以 text 重定位**，from/to 只是当次解析的偏移（ADR-0138 后果节） */
export interface AnchorRef {
  from: number;
  to: number;
  text: string;
}

/** 正文双链解析产物（314 `parseMountLinks` 的一条） */
export interface MountLink {
  /** 原文，含 `!` 与方括号 */
  raw: string;
  /** 链接目标原文（未解析成路径，如 `某卡#标题|别名` 里的 `某卡`） */
  target: string;
  /** `[[x|别名]]` 的别名 */
  alias: string | null;
  /** `#标题` 或 `#^块id`（不含 `#`） */
  subpath: string | null;
  /** 语法上是 `![[…]]` 嵌入 */
  embed: boolean;
  kind: MountKind;
  /** 解析不到文件（已删/改名/盒外） */
  missing: boolean;
  /** 解析到的库内路径；missing 时为 null */
  path: string | null;
  /** 该链接在正文中的锚点 */
  anchor: AnchorRef;
}

/** 挂载树节点。文献（`sameName`）吸附在所属卡片正下方、**不拉线**（`attached`） */
export interface MountNode {
  /** 稳定 id：由 path 与 subpath 派生（同一目标在同一棵树里只出现一次） */
  id: string;
  /** 库内路径（`missing` 时为原始目标文本，画灰节点用） */
  path: string;
  /** 显示名：卡片名 / 文件名 / 标题文本 / 段落摘要 */
  title: string;
  kind: MountKind;
  source: MountSource;
  /** BFS 最短代际（从主卡起算，主卡自身 = 0）；决定层级与「严格跨代」判定 */
  depth: number;
  /** 从父节点正文的哪句话挂出（`link` 有；其余来源为 null） */
  anchor: AnchorRef | null;
  missing: boolean;
  /** 建议（虚线，不落盘）；`true` 时同时为幽灵节点 */
  suggested: boolean;
  /** 吸附在父节点正下方、不拉线（仅同名文献） */
  attached: boolean;
  /** 画布上节点体内要显示的正文：卡片 = 完整正文；head/para = 片段；image/video = null */
  body: string | null;
}

/** 挂载树的边。`suggested` = 建议虚线（未采纳，不落盘） */
export interface MountEdge {
  from: string;
  to: string;
  suggested: boolean;
}

/** 挂载树（派生、零落盘，ADR-0139）。只含**要画的边**：可达 ／ 非回指 ／ 严格跨代（depth(to) > depth(from)） */
export interface MountTree {
  /** 根节点 id（= 主卡） */
  root: string;
  direction: MountDirection;
  nodes: MountNode[];
  edges: MountEdge[];
}

/* ---------- 几何层（316）：布局与路由都是纯函数、给定输入必得同一结果 ---------- */

/** 布局输入：一张卡在画布上的尺寸由渲染层量出（文本高度不可预测），布局只认 w/h/depth */
export interface LayoutBox {
  id: string;
  w: number;
  h: number;
  depth: number;
  kind: MountKind;
}

/** 布局输入的一条边 */
export interface LayoutEdge {
  from: string;
  to: string;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

/**
 * 布局选项。`viewport` 只服务**超大图降级**（spec 风险 1）：按**种子位**判定哪些节点参与施力，
 * 未命中视口的节点原样留在种子位——**它们彼此之间以及与参与节点都可能重叠**（实测 100 节点
 * 传 900×900 会留下数百对重叠），所以**不可当可视区/裁剪区用**；要按可视区渲染，请由渲染层
 * 自己用 `pos` + `world` 裁剪。默认 `null` = 全量布局（正常路径，零重叠保证只在这个路径上有）。
 * `maxNodes` 触发降级：超过时只布局前 N 个（按 BFS 序）、其余进 `culled`。
 */
export interface LayoutOptions {
  viewport?: { x: number; y: number; w: number; h: number } | null;
  /** 超过此数只布局前 N 个（按 BFS 序）、其余进 `culled` */
  maxNodes?: number;
}

export interface LayoutResult {
  pos: Record<string, LayoutPoint>;
  /** 世界尺寸（已含内边距） */
  world: { w: number; h: number };
  /** 被降级裁掉的节点 id */
  culled: string[];
}

/** 路由输入：节点盒（含布局后的 x/y；左上角为原点） */
export interface RouteBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 路由输入的一条边。`anchor` = 源节点内锚点圆点的绝对坐标（渲染层量出）；缺省按源盒左上角内缩兜底 */
export interface RouteEdgeInput extends LayoutEdge {
  anchor?: LayoutPoint | null;
}

/** 出/入盒的四条边 */
export type MountSide = 'L' | 'R' | 'T' | 'B';

/**
 * 路由产物。`d` 是可直接塞进 `<path>` 的 SVG 命令串（`M/L/C`），起点即源锚点、终点即入卡点；
 * `fallback` = 降级走了直线（A\* 无解或超过 maxNodes 时）
 */
export interface RoutedEdge extends LayoutEdge {
  d: string;
  exit: MountSide;
  entry: MountSide;
  fallback: boolean;
}

/* ---------- 建议链路（318） ---------- */

/** 一条候选：「锚点 → 目标」+ 一句话理由（ADR-0138/0139） */
export interface MountSuggestion {
  /** 源卡正文中的锚点（以 text 重定位） */
  anchor: AnchorRef;
  /** 目标库内路径 */
  target: string;
  kind: MountKind;
  /** 一句话理由（展示在「看理由」里） */
  reason: string;
  score: number;
  state: SuggestState;
}

/** 单张主卡的建议缓存片（按 `bodyHash` 逐卡失效：改哪张卡只重跑那张） */
export interface SuggestCardCache {
  bodyHash: string;
  generatedAt: number;
  suggestions: MountSuggestion[];
}

/** 建议缓存文件（域内单文件，如 `CONFIG/STORAGE/mount-suggest.json`） */
export interface SuggestCacheFile {
  cards: Record<string, SuggestCardCache>;
}

/** 建议生成结果：降级时 `status` 非 fresh/cached 且 `suggestions` 为空 */
export interface SuggestRun {
  status: SuggestStatus;
  suggestions: MountSuggestion[];
  /** 命中缓存时的生成时间（顶栏「已缓存」提示用） */
  generatedAt?: number;
}

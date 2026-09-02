/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：类型定义。
 *
 * 数据模型（决策要点）：
 * - news.json 不新增段（外部守护进程写契约不动）；插件状态落在 clipbook.json 侧写。
 * - 阅读视图条目是纯函数裁剪派生（见 data.ts clipArticle），st 为派生状态。
 */

/** 阅读流状态点：unread 蓝 / reading 琥珀 / read 空心（仅剪藏保留语义）/ saved 绿 */
export type ClipState = 'unread' | 'reading' | 'read' | 'saved';

/** 条目来源：news.json（聚合讯）或剪藏目录（.md frontmatter） */
export type ClipOrigin = 'news' | 'clip';

/** 源类型：收件流（news 聚合） / 剪藏本（目录） / 全部聚合 */
export type RailKind = 'inbox' | 'clip' | 'all';

/**
 * 阅读视图条目（渲染统一结构，news 与剪藏两源归一）。
 * news 条目由 clipArticle 裁剪派生；剪藏条目由扫描 .md frontmatter 派生。
 */
export interface ClipArticle {
  /** 稳定标识：news 用 url|title+date（对齐 news/data.ts articleKeyOf）；剪藏用文件路径 */
  id: string;
  origin: ClipOrigin;
  title: string;
  /** 原文 URL（剪藏可能缺省） */
  url: string;
  /** 展示站点名（news：平台；剪藏：frontmatter site） */
  site: string;
  /** 站点域名（favicon 用；无则空） */
  domain: string;
  /** 作者/UP 主 */
  author: string;
  /** 展示来源（B站 UP 用 upName，余用 site） */
  srcName: string;
  /** 条目类型小字（news 有平台后缀；剪藏展示时间） */
  typeLabel: string;
  /** 排序/展示时间（news：fetchedAt/date；剪藏：created） */
  timeText: string;
  /** 排序时间戳（展示用相对时间） */
  timeTs: number;
  /** 列表摘要（news：body 首段截取；剪藏：frontmatter summary） */
  summary: string;
  /** 正文（news：body，可能已清空；剪藏：不读正文为空） */
  body: string;
  /** 标签（剪藏 frontmatter tags；news 无） */
  tags: string[];
  /** 剪藏笔记路径（origin=clip 或已保存的 news 命中目录时） */
  notePath: string | null;
  /** 状态点 */
  st: ClipState;
  /** 是否命中剪藏目录（saved 保底） */
  clipped: boolean;
  /** news.json 原文引用（渲染细节用；origin=clip 无） */
  raw?: any;
  /** 剪藏解析引用（origin=clip；metadataCache 等） */
  note?: any;
  /** 反链源（剪藏；打开笔记入口用） */
  backlinks: string[];
}

/** 文件行（右栏/移动详情渲染指令） */
export interface ClipParagraph {
  type: 'p' | 'quote';
  text: string;
}

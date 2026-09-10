/**
 * 日记本（diary）域类型定义——原回忆墙升格正名（ADR-0115）
 *
 * 方向：回忆墙日后要删除对 diary 域的依赖（用户决策「回忆墙自包含，日后删除日记本域」）。
 * 本文件从 src/diary/types.ts 拷贝 DiaryEntry/TagConfig/SubTagConfig/DateFilter，
 * 仅保留回忆墙需要的部分；后续 diary 域删除后此处即数据契约唯一来源。
 */
/** 日记条目（原 diary 域 entry 对象；回忆墙透传其定位字段供 UI 接 diary 既有动作） */
export interface DiaryEntry {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 时间 HH:mm */
  time: string;
  /** 时间数值 HHmm，用于排序 */
  timeValue: number;
  /** 标签数组（主标签/二级标签） */
  tags: string[];
  /** emoji 序列（由标签生成，写入文件标题） */
  emoji: string;
  /** 正文 */
  content: string;
  /** 来源文件名（日期字符串或含目录的路径） */
  filename: string;
  /** 在文件中的行号（# 标题行） */
  lineNumber: number;
  /** 稳定 id */
  id?: string;
  /** 是否为加密日记条目（ADR-0017）：解锁后解密进列表、卡片🔐角标、点击只读预览不跳 md */
  encrypted?: boolean;
  /** 对应的保险箱 SafeNote id（encrypted=true 时存在） */
  noteId?: string;
}

/**
 * 标签配置：主标签或二级标签
 */
export interface SubTagConfig {
  tag: string;
  emoji: string;
}

export interface TagConfig {
  emoji: string;
  subTags?: SubTagConfig[];
}

/** 日期筛选条件 */
export interface DateFilter {
  year: string;
  month?: string;
}

// ===== 媒体墙条目类型（issue 255 起 WallEntry 家族自 data.ts 上移；render 纯层经此引用，
// 不触 data.ts 的 obsidian 依赖，render-purity 守卫要求） =====

/** 媒体文件（从正文 `![[...]]` 内链提取） */
export interface WallMedia {
  /** 引用名：纯文件名或完整引用路径（不含 `|参数` 后缀） */
  name: string;
  /** 按扩展名判定的媒体类型 */
  kind: 'img' | 'video' | 'audio';
}

/** 条目来源类型（UI 渲染/跳转区分用：日记 filename=dateStr，影视/信/书 filename=完整 vault 路径） */
export type WallEntryKind = 'diary' | 'movie' | 'letter' | 'book';

/** 内容段：文字段（markdown，已去媒体嵌入）或单个媒体段 */
export type WallSegment = { kind: 'text'; text: string } | { kind: 'media'; media: WallMedia };

/** 媒体墙条目 = 日记条目核心字段 + 来源类型 + 媒体列表 + 渲染正文（content 保留原文，media/text 由内容派生） */
export interface WallEntry
  extends Pick<
    DiaryEntry,
    'date' | 'time' | 'tags' | 'emoji' | 'content' | 'filename' | 'lineNumber' | 'id' | 'noteId' | 'encrypted'
  > {
  kind: WallEntryKind;
  media: WallMedia[];
  /**
   * 渲染用正文：去除媒体嵌入（`![[图片/视频/音频]]`）后的 markdown 原文（UI 用 MarkdownRenderer 渲染）。
   * 保留其余 markdown 语法（加粗/斜体/标题/列表/引用/`[[笔记链接]]` 等）与普通文本；
   * content 保留完整原文供复制/跳转。
   */
  text: string;
  /**
   * 按原文顺序的内容段（issue 213）：文字段/媒体段交错保留，
   * UI 段序渲染用——旧结构 media[]+text 把「文字·图·文字·图」压平，无法还原交错语义。
   */
  segments: WallSegment[];
}

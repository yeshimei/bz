/**
 * 日记条目（原脚本 entry 对象）
 */
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

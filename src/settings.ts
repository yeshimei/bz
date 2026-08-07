/**
 * 插件设置（对应原 QuickAdd 宏 settings.options 的 11 项）
 */
export default interface DiarySettings {
  /** 📂 日记目录 */
  diaryDirectory: string;
  /** 🎬 影视目录 */
  movieDirectory: string;
  /** ✉️ 信目录 */
  letterDirectory: string;
  /** 📄 每批加载数量 */
  batchSize: string;
  /** ⏱️ 长按识别时长(毫秒) */
  longPressDuration: string;
  /** ⏳ 文件变更延迟(ms) */
  fileChangeDelay: string;
  /** 👆 启用长按手势 */
  enableLongPress: boolean;
  /** 📊 显示标签计数 */
  showTagCount: boolean;
  /** 🕒 使用文件日期作为默认日期 */
  useFileDateTime: boolean;
}

export const DEFAULT_SETTINGS: DiarySettings = {
  diaryDirectory: '我的/日记',
  movieDirectory: '我的/影视',
  letterDirectory: '我的/信',
  batchSize: '20',
  longPressDuration: '800',
  fileChangeDelay: '100',
  enableLongPress: true,
  showTagCount: true,
  useFileDateTime: false,
}

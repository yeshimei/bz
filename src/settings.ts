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
  /** 📌 默认标签 */
  defaultTag: string;
  /** 🕒 使用文件日期作为默认日期 */
  useFileDateTime: boolean;
  /** 🏷️ 标签配置（每行一个） */
  primaryTagsConfig: string;
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
  defaultTag: '日记',
  useFileDateTime: false,
  primaryTagsConfig: `日记 📖
念念碎 😶
对谈 🤝
随笔 ✍️
梦 🌙
诗 🌟
书 📕
信 ✉️
摘抄 📌
摄影 📸
骑行 🚴
代码 ⚙️
做饭 🥘
游戏 🎮
音乐 🎧
电影 📽
电视剧 📺
动漫 🎨
纪录片 🎞
猫 🐱
狗 🐶
仓鼠 🐹
熊猫 🐼
博物馆 🏛️
美食 🍔
旅游 ✈️ > 四川 🀄, 大理 🛶
收藏 ⭐ > 咪咪 🐈, 广告 📢, 神评 🤣, 冷笑话 😅, 抽象 🌀, AI 🤖, 愚人节 🤪, 舞蹈 🕺, 达人秀 🤹, 艺术 🧑‍🎨, 摄影集 📷, 植物 🌳, 创意 🧩`,
};

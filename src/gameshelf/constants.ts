/**
 * 游戏库（gameshelf）域共享常量：frontmatter 键名台账（深审 A7）+ 后台队列人话文案（深审 S2）。
 *
 * 键名此前以字符串字面量散布五个文件，读写两侧靠人肉对齐——任何一侧改名/笔误均无编译期
 * 信号。本表是唯一台账：域内读侧一律引此表，新键先入表再使用。
 *
 * 收编进度（2026-09 批 A）：state / notes / sync / names / backfill / posters 读侧已接表；
 * reconcile.ts（managedFm 写侧 + LEGACY_KEY_MAP）、detail.ts、ui.ts 仍持字面量，属后续批次
 * 辖区——接表前由 tests/gameshelf/gs-sync-fix.test.ts 的键台账守卫锁住「与台账同值」不漂移。
 */

/** 管辖与媒体键（中文键 = 展示口径，与 vault 中文属性习惯一致；tags 为 Obsidian 约定保留英文） */
export const GS_FM = {
  /** Steam AppID（条目身份键） */
  appId: 'AppID',
  /** 中文名（names 队列从商店接口回填；storeToFm 空值不写防覆盖） */
  zhName: '中文名',
  /** 封面现值：本地 vault 路径，或还没本地化时的远端地址（posters 独占写） */
  cover: '封面',
  /** 封面远端源（同步管辖；本地化后仍在，供删缓存后重下） */
  coverSrc: '封面源',
  /** 图标现值（posters 独占写） */
  icon: '图标',
  /** 图标远端源（同步管辖；hash 拼不出来，只有同步能刷新它） */
  iconSrc: '图标源',
  /** 截图本地路径数组（与截图源同序同长、失败位空串；posters 独占写） */
  shots: '截图',
  /** 截图远端源数组（同步/回填管辖；空数组 = 「商店查过、确实没有」的自愈标记） */
  shotsSrc: '截图源',
  /** 截图落盘时刻 ISO */
  shotsAt: '截图更新',
  /** 商店资料回填时刻 ISO（backfillNeeds 补跑判据键） */
  detailAt: '详情时间',
  /** 累计游玩分钟 */
  playtimeMin: '游玩分钟',
  /** 最后游玩 YYYY-MM-DD */
  lastPlayed: '最后游玩',
  /** 最近一次同步时刻 ISO */
  syncedAt: '同步时间',
  /** Steam 库中消失（退款/隐藏）标记；也是用户唯一会手改的管辖键（func F2 拍板项在案） */
  offShelf: '已下架',
  /** 有社区成就页 */
  hasAch: '有成就',
  windowsMin: 'Windows分钟',
  deckMin: 'SteamDeck分钟',
  macMin: 'Mac分钟',
  linuxMin: 'Linux分钟',
} as const;

/** 首版英文旧键（notes 读侧回退 + 同步 upsert 时顺带迁移；与 reconcile.LEGACY_KEY_MAP 逐对同值，守卫测试锁定） */
export const GS_LEGACY_FM = {
  appId: 'appid',
  playtimeMin: 'playtimeMin',
  lastPlayed: 'lastPlayed',
  cover: 'cover',
  syncedAt: 'syncedAt',
  offShelf: 'offShelf',
} as const;

/**
 * 后台队列连错熔断的人话收尾（S2）：names / backfill 两队列共用同一文案与去重键——
 * 熔断此前只有 console.warn，用户视角是「中文名一直是英文 / 图一直不出」而无一字出口；
 * 两队列同窗先后熔断时 dedupeKey 原地合并，不刷屏。逐条下载失败不弹（147 张逐条报是灾难），
 * 只在整队熔断这一处出声。
 */
export const QUEUE_HALTED_NOTICE = '网络不畅，游戏库自动补全已暂停，下次打开会继续';
export const QUEUE_HALTED_DEDUPE_KEY = 'bz-gameshelf-autofill-halt';

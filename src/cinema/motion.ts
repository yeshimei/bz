/**
 * 影院动效台账（issue 400，2026-09-21 用户拍板）：本域只用这四档时长、两条曲线。
 *
 * 为什么是「两边各存一份 + 门禁钉死」而不是运行时读 CSS 变量：行为层（WAAPI）在 jsdom 与
 * 原型壳里都要能跑，`getComputedStyle` 拿不到变量时必须有确定回落值，读一次缓存又会在
 * 面板换壳（明暗 / 布局切换）时失真。于是取值在 CSS（token）与 TS（本文件）各存一份，
 * 由 `tests/cinema/motion-ledger.test.ts` 断言两侧相等——手写第六个时长（`.37s` 这种）
 * 会被那道门禁当场挡下，这是「节奏不漂」的唯一机械保障。
 *
 * 新动效先归类，再用这里的值：
 *   fast    微反馈：hover / 按下 / 底色 / 高亮滑行
 *   move    空间位移：海报飞行、FLIP 让位、面板撑开与折回、涟漪扩散与折回
 *   base    揭示：面板入场、下拉展开、内容接力、海报淡入、卡片抬升与推近
 *   impulse 冲量：表单翻转这类一次性状态切换
 * 加载类循环（转圈 / 骨架 / 脉冲 / 扫描）是功能性指示，不入台账、取值不随交互节奏变。
 */

/** 时长（毫秒；CSS 侧对应 --cn-m-* token，值为「秒」） */
export const MOTION = { fast: 160, move: 200, base: 280, impulse: 740 } as const;

/** 接力步进（毫秒）：同一批元素依次入场的间隔（涟漪文案、网格进场、星级点亮）。
 *  与 styles.css 内容接力阶梯的 .03s 同口径——入场是「一波」，不是一个一个来。 */
export const STAGGER = 30;

/** 曲线：out = 揭示（先快后缓、末尾收势）；move = 迁移与冲量（起手重、收尾干脆） */
export const EASE = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;

/** CSS token 名（门禁测试与注释引用用；CSS 侧定义见 styles.css 的台账段） */
export const MOTION_VARS = {
  fast: '--cn-m-fast',
  move: '--cn-m-move',
  base: '--cn-m-base',
  impulse: '--cn-m-impulse',
} as const;

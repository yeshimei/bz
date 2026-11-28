/**
 * 自动摘要设置键单源（A6）：六键键名唯一定义处。
 * 域内消费（processor/index）一律引此常量——键名以字面量散布时，改名/新增键漏改一处
 * 即静默回退默认值（`String(s.x || 'standard')` 形态不报错）。
 * settings.ts 接口与 clipbook 设置 schema 现仍持字面量（跨域字面收口属主线程批），
 * 本常量先锁域内两处消费面。
 */
export const AUTO_SUMMARY_KEYS = {
  enabled: 'autoSummaryEnabled',
  length: 'autoSummaryLength',
  tagsEnabled: 'autoSummaryTagsEnabled',
  tagCount: 'autoSummaryTagCount',
  timing: 'autoSummaryTiming',
  /**
   * 用 AI 标题重命名笔记（2026-11-28，fb-20261128-qqg-01）：默认开＝老行为，
   * 缺 title 时生成标题并把文件名换成它；关掉＝只补摘要与标签，文件名保持剪藏原样。
   */
  titleRename: 'autoSummaryTitleRename',
} as const;

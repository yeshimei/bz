/**
 * 自动摘要设置键单源（A6）：五键键名唯一定义处。
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
} as const;

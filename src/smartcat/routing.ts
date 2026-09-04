/**
 * 路由规则（P1 数据基座，ticket 123）
 *
 * 根据 source:action 决定事件写入 memory 流（参与向量化/检索/反思）、behavior 流（轻量行为记录）
 * 或 exempt（豁免：不写任何流，ADR-0069 隐私豁免——密码/加密域及日记加密动作不留痕）。
 * memory 流条目从规则获取 importance/emotion/credibility 默认值；behavior 流不参与向量化。
 */

/** 路由规则 */
export interface RoutingRule {
  /** 目标流：memory（记忆流）/ behavior（行为流）/ exempt（豁免：不写任何流，ADR-0069 隐私豁免） */
  stream: 'memory' | 'behavior' | 'exempt';
  /** 重要度 0-1（仅 memory 流；behavior 流忽略） */
  importance?: number;
  /** 默认情绪（仅 memory 流；behavior 流忽略） */
  defaultEmotion?: string;
  /** 可信度 0-1（仅 memory 流；默认 0.8） */
  credibility?: number;
}

/**
 * 完整路由规则表
 * key 格式：`source:action`；按事件粒度静态指定 importance（importance 按事件粒度静态指定）
 *
 * 注释格式：(importance, emotion) 或 (→behavior) 表示路由到行为流
 */
export const ROUTING_RULES: Record<string, RoutingRule> = {
  // === 日记 ===
  'diary:created':   { stream: 'behavior', importance: 0.85, defaultEmotion: 'calm', credibility: 0.9 },
  'diary:updated':   { stream: 'behavior', importance: 0.80, defaultEmotion: 'calm', credibility: 0.9 },
  'diary:deleted':   { stream: 'behavior' },

  // === 闪念 ===
  'flash:created':   { stream: 'behavior' },
  'flash:updated':   { stream: 'behavior' },
  'flash:deleted':   { stream: 'behavior' },

  // === 诗 ===
  'poem:created':    { stream: 'behavior', importance: 0.75, defaultEmotion: 'calm', credibility: 0.9 },
  'poem:updated':    { stream: 'behavior', importance: 0.70, defaultEmotion: 'calm', credibility: 0.9 },
  'poem:deleted':    { stream: 'behavior' },

  // === 信 ===
  'letter:created':  { stream: 'behavior', importance: 0.80, defaultEmotion: 'calm', credibility: 0.9 },
  'letter:updated':  { stream: 'behavior', importance: 0.75, defaultEmotion: 'calm', credibility: 0.9 },
  'letter:deleted':  { stream: 'behavior' },

  // === 影视 ===
  'movie:want':      { stream: 'behavior', importance: 0.60, defaultEmotion: 'curious', credibility: 0.6 },
  'movie:watching':  { stream: 'behavior', importance: 0.65, defaultEmotion: 'focused', credibility: 0.6 },
  'movie:watched':   { stream: 'behavior', importance: 0.85, defaultEmotion: 'happy',   credibility: 0.6 },
  'movie:rated':     { stream: 'behavior', importance: 0.70, defaultEmotion: 'happy',   credibility: 0.6 },
  'movie:reviewed':  { stream: 'behavior', importance: 0.75, defaultEmotion: 'happy',   credibility: 0.6 },
  'movie:deleted':   { stream: 'behavior' },

  // === 备忘录 ===
  'memo:added':      { stream: 'behavior' },
  'memo:edited':     { stream: 'behavior' },
  'memo:completed':  { stream: 'behavior' },
  'memo:restored':   { stream: 'behavior' },
  'memo:postponed':  { stream: 'behavior' },
  'memo:priority':   { stream: 'behavior' },
  'memo:deleted':    { stream: 'behavior' },
  'memo:due':        { stream: 'behavior' },

  // === 聚合讯 ===
  'news:read':       { stream: 'behavior' },
  'news:saved':      { stream: 'behavior' },
  'news:skipped':    { stream: 'behavior' },

  // === 收藏本 ===
  'favorites:added':   { stream: 'behavior' },
  'favorites:edited':  { stream: 'behavior' },
  'favorites:deleted': { stream: 'behavior' },

  // === 归物本 ===
  'belongings:added':   { stream: 'behavior' },
  'belongings:edited':  { stream: 'behavior' },
  'belongings:status':  { stream: 'behavior' },
  'belongings:deleted': { stream: 'behavior' },

  // === 番茄钟 ===
  'pomodoro:focus-done': { stream: 'behavior', importance: 0.70, defaultEmotion: 'focused', credibility: 0.6 },

  // === 聊天 ===
  'chat:said': { stream: 'behavior', importance: 0.75, defaultEmotion: 'calm', credibility: 0.5 },

  // === 书库 ===
  'library:started':    { stream: 'behavior', importance: 0.70, defaultEmotion: 'curious',  credibility: 0.6 },
  'library:completed':  { stream: 'behavior', importance: 0.85, defaultEmotion: 'happy',    credibility: 0.6 },
  'library:progressed': { stream: 'behavior', importance: 0.60, defaultEmotion: 'focused',  credibility: 0.6 },
  'library:highlight':  { stream: 'behavior', importance: 0.65, defaultEmotion: 'focused',  credibility: 0.7 },
  'library:thought':    { stream: 'behavior', importance: 0.70, defaultEmotion: 'focused',  credibility: 0.75 },
  'library:added':      { stream: 'behavior' },
  'library:removed':    { stream: 'behavior' },

  // === 文献盒（literature，ADR-0066 用户拍板仅行为流、不向量化；ADR-0072 迁出为 literature 域） ===
  'literature:converted':      { stream: 'behavior' },
  'literature:term-generated': { stream: 'behavior' },

  // === 反思 ===
  'reflection:insight': { stream: 'memory', importance: 0.90, defaultEmotion: 'calm', credibility: 0.9 },
  'reflection:digest':  { stream: 'memory', importance: 0.85, defaultEmotion: 'calm', credibility: 0.9 },

  // === 周报 ===
  'weekly-report:generated': { stream: 'memory', importance: 0.95, defaultEmotion: 'calm', credibility: 0.8 },

  // === dossier ===
  'dossier:generated': { stream: 'memory', importance: 0.90, defaultEmotion: 'calm', credibility: 0.8 },

  // === 兜底 ===
  'system:fallback': { stream: 'behavior' },

  // ==================== ADR-0069 行为流全量盘点补齐 ====================

  // === 日记分类调整（diary 域 dialogs 的 tags-changed 域事件接线，本流补齐此前无观察的动作） ===
  'diary:tagged': { stream: 'behavior' },

  // === 日记条目加密/解密/清除（diary 域加密语义动作；ADR-0069 隐私豁免——敏感操作不留痕，
  //     与密码/加密域同口径。规则先行落表：即使未来接线，addObservation 也判 exempt 不写任何流） ===
  'diary:entry-encrypted':  { stream: 'exempt' },
  'diary:entry-decrypted':  { stream: 'exempt' },
  'diary:encrypted-purged': { stream: 'exempt' },

  // === 剪藏（created/modified/deleted 均不产：保存观察已由 news 通道覆盖，删除记录按用户拍板断开，2026-08-29） ===

  // === 密码域（ADR-0069 隐私豁免：查看/新增/生成等敏感操作不留痕；通配覆盖该域全部动作） ===
  'password:*': { stream: 'exempt' },

  // === 加密域（ADR-0069 隐私豁免：加密/解密/保险箱操作不留痕） ===
  'encrypt:*': { stream: 'exempt' },

  // === 复习计划（规则就绪：review 域当前不发域事件，规则先行落表待接线） ===
  'review:started': { stream: 'behavior' },
  'review:added':   { stream: 'behavior' },
  'review:removed': { stream: 'behavior' },
  'review:rated':   { stream: 'behavior' },

  // === 题库（规则就绪：quiz 域当前不发域事件） ===
  'quiz:added':    { stream: 'behavior' },
  'quiz:answered': { stream: 'behavior' },

  // === 附件搬移（规则就绪：attach 域当前不发域事件） ===
  'attach:moved': { stream: 'behavior' },
};

/**
 * 解析路由规则
 * 优先 `source:action` 精确匹配，其次 `source:*`，最后 `system:fallback`。
 *
 * @param source 来源域（如 'diary'、'movie'、'chat'）
 * @param action 动作（如 'created'、'watched'、'said'）
 * @returns 匹配的路由规则（始终返回，兜底为 system:fallback）
 */
export function resolveRouting(source: string, action: string): RoutingRule {
  // 精确匹配：source:action
  const exactKey = `${source}:${action}`;
  if (exactKey in ROUTING_RULES) {
    return ROUTING_RULES[exactKey];
  }
  // 通配匹配：source:*
  const wildcardKey = `${source}:*`;
  if (wildcardKey in ROUTING_RULES) {
    return ROUTING_RULES[wildcardKey];
  }
  // 兜底
  return ROUTING_RULES['system:fallback'];
}

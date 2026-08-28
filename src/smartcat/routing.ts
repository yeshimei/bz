/**
 * 路由规则（P1 数据基座，ticket 123）
 *
 * 根据 source:action 决定事件写入 memory 流（参与向量化/检索/反思）还是 behavior 流（轻量行为记录）。
 * memory 流条目从规则获取 importance/emotion/credibility 默认值；behavior 流不参与向量化。
 */

/** 路由规则 */
export interface RoutingRule {
  /** 目标流：memory（记忆流）或 behavior（行为流） */
  stream: 'memory' | 'behavior';
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
  'diary:created':   { stream: 'memory', importance: 0.85, defaultEmotion: 'calm', credibility: 0.9 },
  'diary:updated':   { stream: 'memory', importance: 0.80, defaultEmotion: 'calm', credibility: 0.9 },
  'diary:deleted':   { stream: 'behavior' },

  // === 闪念 ===
  'flash:created':   { stream: 'behavior' },
  'flash:updated':   { stream: 'behavior' },
  'flash:deleted':   { stream: 'behavior' },

  // === 诗 ===
  'poem:created':    { stream: 'memory', importance: 0.75, defaultEmotion: 'calm', credibility: 0.9 },
  'poem:updated':    { stream: 'memory', importance: 0.70, defaultEmotion: 'calm', credibility: 0.9 },
  'poem:deleted':    { stream: 'behavior' },

  // === 信 ===
  'letter:created':  { stream: 'memory', importance: 0.80, defaultEmotion: 'calm', credibility: 0.9 },
  'letter:updated':  { stream: 'memory', importance: 0.75, defaultEmotion: 'calm', credibility: 0.9 },
  'letter:deleted':  { stream: 'behavior' },

  // === 影视 ===
  'movie:want':      { stream: 'memory', importance: 0.60, defaultEmotion: 'curious', credibility: 0.6 },
  'movie:watching':  { stream: 'memory', importance: 0.65, defaultEmotion: 'focused', credibility: 0.6 },
  'movie:watched':   { stream: 'memory', importance: 0.85, defaultEmotion: 'happy',   credibility: 0.6 },
  'movie:rated':     { stream: 'memory', importance: 0.70, defaultEmotion: 'happy',   credibility: 0.6 },
  'movie:reviewed':  { stream: 'memory', importance: 0.75, defaultEmotion: 'happy',   credibility: 0.6 },
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
  'pomodoro:focus-done': { stream: 'memory', importance: 0.70, defaultEmotion: 'focused', credibility: 0.6 },

  // === 聊天 ===
  'chat:said': { stream: 'memory', importance: 0.75, defaultEmotion: 'calm', credibility: 0.5 },

  // === 书库 ===
  'library:started':    { stream: 'memory', importance: 0.70, defaultEmotion: 'curious',  credibility: 0.6 },
  'library:completed':  { stream: 'memory', importance: 0.85, defaultEmotion: 'happy',    credibility: 0.6 },
  'library:progressed': { stream: 'memory', importance: 0.60, defaultEmotion: 'focused',  credibility: 0.6 },
  'library:highlight':  { stream: 'memory', importance: 0.65, defaultEmotion: 'focused',  credibility: 0.7 },
  'library:thought':    { stream: 'memory', importance: 0.70, defaultEmotion: 'focused',  credibility: 0.75 },
  'library:added':      { stream: 'behavior' },
  'library:removed':    { stream: 'behavior' },

  // === 文献盒（bili-downloader，ADR-0066：用户拍板仅行为流、不向量化） ===
  'bili-downloader:added':     { stream: 'behavior' },
  'bili-downloader:converted': { stream: 'behavior' },

  // === 反思 ===
  'reflection:insight': { stream: 'memory', importance: 0.90, defaultEmotion: 'calm', credibility: 0.9 },
  'reflection:digest':  { stream: 'memory', importance: 0.85, defaultEmotion: 'calm', credibility: 0.9 },

  // === 周报 ===
  'weekly-report:generated': { stream: 'memory', importance: 0.95, defaultEmotion: 'calm', credibility: 0.8 },

  // === dossier ===
  'dossier:generated': { stream: 'memory', importance: 0.90, defaultEmotion: 'calm', credibility: 0.8 },

  // === 兜底 ===
  'system:fallback': { stream: 'behavior' },
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

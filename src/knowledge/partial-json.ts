/**
 * 半截 JSON 的字符串字段抽取（ADR-0152 / issue 343）
 *
 * 场景：知识盒三态录入走 `ai.json()`（`response_format: json_object`），但传输层本来就是流式的
 * （`core/ai` 的 streamChatCompletions 带 `onDelta`）——每个 delta 拼起来，在任意时刻都是
 * **最终 JSON 文本的一个前缀**（残缺、未闭合）。于是只要解析器容忍「未闭合」，就能在流式过程中
 * 不断取出正文（summary）的当前值，逐字显示，不必等整段回来。
 *
 * 核心设计：**纯函数 + 无状态**——每帧拿「累积前缀」重算一遍，不维护任何增量状态。
 * 于是「转义序列被切成两半」自动自愈：这一帧先丢掉半截 `\`，下一帧前缀变长、重算即完整。
 * 没有状态机，也就没有状态漂移。
 *
 * 抽取结果只用于**显示**：收尾仍走 `parseAiJson`（note-gen.ts），落盘值以它为准。
 * 测试须钉住「抽取终值 == JSON.parse 终值」，否则会出现「预览看到 A、落盘写入 B」的静默不一致。
 */

/** JSON 转义字符表（`\uXXXX` 单独走 code unit 分支；未知转义原样保留字符本身） */
const ESCAPE_CHARS: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  '"': '"',
  '\\': '\\',
  '/': '/',
};

function isWs(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * 定位键值对里**字符串值的起始位置**（开引号之后那一位），未到达返回 -1。
 * 只在键名带引号且后随 `:` 时才算命中——避免命中出现在某个字符串值内部的同名文本。
 */
function valueStartOf(prefix: string, key: string): number {
  const marker = `"${key}"`;
  let from = 0;
  for (;;) {
    const i = prefix.indexOf(marker, from);
    if (i < 0) return -1; // 键还没出现
    let j = i + marker.length;
    while (j < prefix.length && isWs(prefix[j])) j++;
    if (prefix[j] === ':') {
      j++;
      while (j < prefix.length && isWs(prefix[j])) j++;
      return prefix[j] === '"' ? j + 1 : -1; // 值不是字符串 / 值还没开始
    }
    from = i + marker.length; // 这次命中在别的值内部 → 继续往后找
  }
}

/**
 * 从 JSON 文本前缀里取出某个字符串字段的当前值；键未出现、值未开始或类型不是字符串时返回 null。
 * 未闭合的转义（结尾一个孤 `\`、或不足 4 位的 `\uXXX`）当帧丢弃——下一帧前缀变长即自愈。
 * 值一旦闭合引号出现，返回的就是终值（后续帧不再变化）。
 */
export function partialStringField(prefix: string, key: string): string | null {
  const start = valueStartOf(prefix, key);
  if (start < 0) return null;
  let out = '';
  let i = start;
  while (i < prefix.length) {
    const ch = prefix[i];
    if (ch === '\\') {
      if (i + 1 >= prefix.length) break; // 半截转义（只有 `\`）→ 本帧丢弃，下帧重算
      const esc = prefix[i + 1];
      if (esc === 'u') {
        const hex = prefix.slice(i + 2, i + 6);
        if (hex.length < 4) break; // `\u4e2` 这种半截 → 丢弃，下帧重算
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) { i += 2; continue; } // 非法 `\u`：跳过反斜杠与 u
        // 代理对（BMP 外字符）在 JSON 里就是两个 \uXXXX，两次 fromCharCode 拼接即正确
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
      out += esc in ESCAPE_CHARS ? ESCAPE_CHARS[esc] : esc;
      i += 2;
      continue;
    }
    if (ch === '"') break; // 值已闭合 → 终值
    out += ch;
    i++;
  }
  return out;
}

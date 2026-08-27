/**
 * 日记「未解析行」扫描与修复引擎（ticket 121，ADR-0054）。
 * 纯函数、不碰 DOM/vault：扫描结果与修复动作可单测。
 *
 * 语义与 src/diary/parser.ts 完全同源（headingRegex 同款）：
 * - 游离于首个条目之前的非空行、任意位置的「时间越界」条目标题行 = 未解析行（parseFile 的 onUnparsed 口径）；
 * - 可自动修：仅限「形似标题但不合规」的头行——R1 补空格 / R2 时间补零；
 *   修复仅改动格式局部（行尾其它内容一字不动），修复后该行成为合法条目标题，其下正文自动归位；
 * - 不可自动修：时间越界标题行（值无法推断）、以及「位于第一个可修头行之前、修复也无法归位」的游离正文。
 * 修复 ≠ 改数据格式：只把不合规数据修复到既有格式（铁律 1 边界见 ADR-0054）。
 */

/** 与 parser.ts 同款：合法条目标题 `# emoji序列 HH:mm`（emoji 与时间间须有空白、时间恰两位） */
const HEADING_RE = /^#\s*((?:\S+)+)\s+(\d{2}:\d{2})/u;
/** 形似标题但 emoji 与时间间缺空白：`# 🤝02:43` */
const NO_SPACE_RE = /^#\s*((?:\S+)+)(\d{2}:\d{2})/u;
/** 形似标题但时间非两位：`# 📖 9:33` / `# 📖 09:3` */
const SHORT_TIME_RE = /^#\s*((?:\S+)+)\s+(\d{1,2}):(\d{1,2})/u;

export type UnparsedRepairKind = 'space' | 'pad-time';

/** 可自动修复项：单行替换（before → after），行号 1-based */
export interface UnparsedRepair {
  line: number;
  kind: UnparsedRepairKind;
  before: string;
  after: string;
}

/** 不可自动修复项：时间越界标题行 / 游离正文（无法归位） */
export interface UnparsedFreeText {
  line: number;
  text: string;
  reason: 'time-oob' | 'free-text';
}

export interface UnparsedScan {
  repairs: UnparsedRepair[];
  freeTexts: UnparsedFreeText[];
}

/** 解析 `HH:mm` 成 {h,m}；值越界/格式非法返回 null */
function parseTime(t: string): { h: number; m: number } | null {
  const [hh, mm] = t.split(':').map(Number);
  if (isNaN(hh) || hh < 0 || hh > 23 || isNaN(mm) || mm < 0 || mm > 59) return null;
  return { h: hh, m: mm };
}

/**
 * 扫描一篇日期文件，产出可修复项与不可修复项。全行扫描（不提前退）：
 * - 任意位置的「时间越界」标题行都计入 freeTexts（parseFile 同口径——正文行不查，
 *   避免把条目内形似标题的句子误报）；
 * - 游离正文仅在「位于第一个可修头行之前」时进入 freeTexts（其后正文修复后自然归位，
 *   不打扰用户；位于不可修头行之后、可修头行之前的游离正文修复后仍无归属，必须列出）。
 */
export function scanUnparsed(content: string): UnparsedScan {
  // CRLF 归一（行号不变；applyRepairs 侧保留原行尾）
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const repairs: UnparsedRepair[] = [];
  const freeTexts: UnparsedFreeText[] = [];
  const pendingFree: UnparsedFreeText[] = [];
  let entered = false;
  let firstRepairLine = Infinity;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!entered && line.trim() === '') continue;

    let m = line.match(HEADING_RE);
    if (m) {
      if (parseTime(m[2])) {
        entered = true; // 合法标题
        continue;
      }
      // 时间越界标题行：值无法推断，不可自动修（正文区亦会命中，parseFile 同口径）
      freeTexts.push({ line: i + 1, text: line, reason: 'time-oob' });
      continue;
    }
    if (entered) continue; // 条目正文不纳入未解析（含形似标题的句子/短时间句子）

    m = line.match(NO_SPACE_RE);
    if (m) {
      const time = m[2];
      if (parseTime(time)) {
        // 仅插空格，行尾其它内容一字不动
        const after = line.replace(NO_SPACE_RE, '# $1 $2');
        repairs.push({ line: i + 1, kind: 'space', before: line, after });
        if (firstRepairLine === Infinity) firstRepairLine = i + 1;
        entered = true; // 修复后成为合法标题，正文随之归位
        continue;
      }
      freeTexts.push({ line: i + 1, text: line, reason: 'time-oob' });
      continue;
    }

    m = line.match(SHORT_TIME_RE);
    if (m) {
      // 仅补零，行尾其它内容一字不动
      const after = line.replace(SHORT_TIME_RE, (_f, emoji: string, h: string, mi: string) =>
        `# ${emoji} ${h.padStart(2, '0')}:${mi.padStart(2, '0')}`
      );
      if (parseTime(`${m[2].padStart(2, '0')}:${m[3].padStart(2, '0')}`)) {
        repairs.push({ line: i + 1, kind: 'pad-time', before: line, after });
        if (firstRepairLine === Infinity) firstRepairLine = i + 1;
        entered = true;
        continue;
      }
      freeTexts.push({ line: i + 1, text: line, reason: 'time-oob' });
      continue;
    }

    // 游离正文：暂存；仅当位于第一个可修头行之前（修复后仍无归属）才进不可修清单
    pendingFree.push({ line: i + 1, text: line, reason: 'free-text' });
  }

  for (const pf of pendingFree) {
    if (pf.line < firstRepairLine) freeTexts.push(pf);
  }
  return { repairs, freeTexts };
}

/**
 * 应用修复：按行号替换（行内容与 before 不一致时跳过，防并发改动错位）；
 * 保留原行尾（CRLF 文件不受影响）。
 */
export function applyRepairs(content: string, repairs: UnparsedRepair[]): string {
  const lines = content.split('\n');
  for (const r of repairs) {
    const idx = r.line - 1;
    if (idx < 0 || idx >= lines.length) continue;
    const raw = lines[idx];
    const stripped = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (stripped === r.before) {
      lines[idx] = r.after + (raw.endsWith('\r') ? '\r' : '');
    }
  }
  return lines.join('\n');
}
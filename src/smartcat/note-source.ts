/**
 * 卡片盒/现代诗/信 观察文案与判定层（ticket 083，ADR-0035；v1 基础 + v2 差异观察 + v3 真实日期 + v4 readonly 准入）：
 * 用户拍板——flash（卡片盒）/poem（现代诗）/letter（信）从「observationText 快照 + 10 分钟去弹跳」改为
 * **每篇文件独立 10 分钟结算**（对齐日记模型 ticket 077 的 per-file 简化版）：
 * - v1：新建有字 → 静置 10 分钟生成首次观察（带全文）；删除 → 追加删除观察；正文**全文不截断**。
 * - v2：修改不再带新全文——改为**段落级 diff 摘要**（任何正文内容变化即产，不再用累计 >50 阈值；
 *   10 分钟静置结算负责把窗口内连续编辑合并为一次 diff 观察）。
 * - v3：首落带真实日期（信 = frontmatter `date:`；现代诗 = frontmatter date / 文件名 YYMMDD / 父目录年份+MMDD 三层回退，
 *   无任何日期来源不补首落但修改照产 diff；卡片盒无日期概念维持无日期文案）；信无 frontmatter date → 不跟踪不观察；
 *   存量信/诗（从未产出过首落）首次被修改 → **先补带日期全文的首落观察，再产修改 diff 观察**。
 * - v4：信 frontmatter `readonly: true` → 不观察（与「无 date 不观察」并列的准入条件；现代诗/卡片盒无此字段约束）。
 * 观察是**静态快照**，只有「新增」「新增修改摘要」「新增删除」三种产出（无覆盖、无引用、无动态读取）。
 * 本模块为纯函数层（可测）：文案、文件名、正文提取（去 frontmatter）、日期解析、段落 diff、结算判定。
 *
 * 措辞原则（用户拍板，不得自改）：三域统一句式——首落 `你在 <date> 写了一封信「X」：<全文>` /
 * `你在 <date> 写了一首现代诗「X」：<全文>` / `你在卡片盒记下了「X」：「<全文>」`；更新动词「修改」：
 * `你修改了<域>「X」：<diff 摘要>`；删除 `你删除了<域>「X」`；diff 片段截断：删/增段前 50 字、修改段旧前 30 字 → 新前 30 字。
 * 正文 = 去 frontmatter 后全文（对齐 observationText 既有 poem/letter 分支 `replace(/^---...---/)` 先例；
 * 仅改 frontmatter 属性不产观察）。
 */

/** 三域 kind（classifyPath 对 `卡片盒`/`我的/现代诗`/`我的/信` 前缀匹配产出；递归天然命中二级子目录） */
export type NoteKind = 'flash' | 'poem' | 'letter';

/** 结算静置时长（10 分钟；index 层可注入缩短——测试经 __setNoteSettleMsForTests 覆盖生产默认） */
export const NOTE_SETTLE_MS = 10 * 60 * 1000;

/** 段落 diff 每类最多列出的段数（超出 → 该类追加「等 N 处<类名>」） */
const DIFF_MAX_PER_CAT = 3;
/** 删除/新增段展示前 50 字；修改段旧/新各展示前 30 字（超长加「…」） */
const DIFF_SNIPPET_LEN = 50;
const DIFF_MOD_LEN = 30;
/** 相邻删增块判定「修改段」的字符重叠率阈值（≥0.5 = 修改，报旧段号；否则按删除/新增分别报） */
const DIFF_OVERLAP_THRESHOLD = 0.5;

/** 单篇文件的结算状态（index 层计时表携带：是否已产出/上次生成正文基线；v2 起无 accum 累计字段） */
export interface NoteSettleState {
  /** 该篇是否已进入「已生成」分支（重启基线有字文件视为已见——防重启后旧文件被当首次；真首落产出与否另由 index 层 observed 位区分） */
  generated: boolean;
  /** 上次生成/结算时的正文基线（diff 基准；每次结算后推进到当前正文全文） */
  baseline: string;
}

/** 结算产出形态：first=新增观察 / update=新增修改 diff 观察 / none=不生成（或无日期首落跳过） */
export type NoteSettleResult =
  | { kind: 'first'; text: string; next: NoteSettleState }
  | { kind: 'update'; text: string; next: NoteSettleState }
  | { kind: 'none'; text: null; next: NoteSettleState };

/** 文件名（basename 去 `.md` 后缀，保留原名含日期前缀/标点；`我的/现代诗/2016/161230 忧郁啊.md` → `161230 忧郁啊`） */
export function noteFileName(path: string): string {
  const base = (path || '').replace(/\\/g, '/').split('/').pop() || '';
  return base.replace(/\.md$/i, '');
}

/** 正文 = 去 frontmatter 块后全量 trim（`---\n...\n---` 前置块剥离；对齐 observationText 既有诗/信分支先例） */
export function noteBodyText(content: string): string {
  return (content || '').replace(/^---\r?\n[\s\S]*?\r?\n---\s*(?:\n|$)/, '').trim();
}

/**
 * 轻量 frontmatter 提取（本层只需 date/readonly 两个标量键；正则解析对齐 smartcat 既有 frontmatter 前端
 * 口吻（context-source 剪藏 summary 同款），不做 YAML 全子集）。值一律字符串化（调用方自行判读）。
 */
export function frontmatterOf(content: string): Record<string, string> {
  const m = (content || '').match(/^---\r?\n([\s\S]*?)\r?\n---\s*(?:\n|$)/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (val) fm[key] = val;
  }
  return fm;
}

/** 信 readonly 准入判定（frontmatter `readonly: true` → 该信不观察；实测仅第 0 封信，v4） */
export function letterReadonly(content: string): boolean {
  return frontmatterOf(content).readonly === 'true';
}

/**
 * 日期规范化（raw → `YYYY-MM-DD HH:mm`；ISO / 空格式 / 仅日期三式兼容）：
 * - `2026-06-17 23:44`（空格式）→ `2026-06-17 23:44`
 * - `2026-07-06T12:14:00`（ISO，可带时区后缀）→ `2026-07-06 12:14`
 * - `2026-06-17`（仅日期）→ `2026-06-17 08:00`（时间缺省 08:00 占位，对齐 v3 现代诗文件名派生口径）
 * 解析失败 → null。
 */
export function formatNoteDate(raw: string): string | null {
  const s = String(raw ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const time = m[4] ? `${m[4]}:${m[5]}` : '08:00';
  return `${m[1]}-${m[2]}-${m[3]} ${time}`;
}

/** basename 前缀 6 位 YYMMDD（`161230 忧郁啊` → 2016-12-30 08:00；2014-2024 老诗无 frontmatter 场景） */
function dateFromBaseNameYYMMDD(filePath: string): string | null {
  const base = noteFileName(filePath);
  const m = base.match(/^(\d{2})(\d{2})(\d{2})(?![0-9])/);
  if (!m) return null;
  const year = 2000 + Number(m[1]);
  if (year < 1990 || year > 2099) return null;
  return `${year}-${m[2]}-${m[3]} 08:00`;
}

/** 父目录名 = 年份 + 文件名前缀 4 位 MMDD（`我的/现代诗/2026/0115.md` → 2026-01-15 08:00；2025-2026 新诗场景） */
function dateFromParentYearMMDD(filePath: string): string | null {
  const parts = (filePath || '').replace(/\\/g, '/').split('/');
  const parent = parts.length >= 2 ? parts[parts.length - 2] : '';
  const base = noteFileName(filePath);
  const m = base.match(/^(\d{2})(\d{2})(?![0-9])/);
  if (!m || !/^\d{4}$/.test(parent)) return null;
  return `${parent}-${m[1]}-${m[2]} 08:00`;
}

/**
 * 观察日期解析（v3）：
 * - flash：恒 null（卡片盒无日期概念）
 * - letter：frontmatter `date:`（ISO/空格两式兼容）→ 格式化；无 → null（信准入：无 date 不跟踪不观察）
 * - poem：三层回退——① frontmatter `date:`（带时间保留时间）→ ② 文件名 YYMMDD 前缀（08:00 占位）→
 *   ③ 父目录名=年份 + 文件名 MMDD 前缀（08:00 占位）→ 全部无 → null（不补首落，修改/删除照产）
 */
export function parseNoteDate(kind: NoteKind, content: string, filePath: string): string | null {
  if (kind === 'flash') return null;
  const fm = frontmatterOf(content || '');
  if (fm.date) {
    const d = formatNoteDate(fm.date);
    if (d) return d;
  }
  if (kind === 'letter') return null;
  return dateFromBaseNameYYMMDD(filePath || '') ?? dateFromParentYearMMDD(filePath || '');
}

// ---------------- 观察文案（用户拍板措辞，不得自改） ----------------

/** 三域中文头（文案拼接用） */
const DOMAIN_HEAD: Record<NoteKind, string> = { flash: '卡片盒', poem: '现代诗', letter: '信' };

/** 首落文案（v3 三句式）：poem/letter 带日期（date 为 null 返回 null——调用方不产）；
 *  flash 无日期概念：`你在卡片盒记下了「X」：「<全文>」`（v1 不变）。 */
export function noteFirstText(kind: NoteKind, name: string, body: string, date: string | null): string | null {
  switch (kind) {
    case 'flash':
      return `你在卡片盒记下了「${name}」：「${body}」`;
    case 'poem':
      return date ? `你在 ${date} 写了一首现代诗「${name}」：${body}` : null;
    case 'letter':
      return date ? `你在 ${date} 写了一封信「${name}」：${body}` : null;
  }
}

/** 删除观察文案（v1 不变）：`你删除了卡片盒「X」` / `你删除了现代诗「X」` / `你删除了信「X」`（仅追加，原观察保留） */
export function noteDeleteText(kind: NoteKind, name: string): string {
  return `你删除了${DOMAIN_HEAD[kind]}「${name}」`;
}

// ---------------- 段落级 diff 摘要（v2） ----------------

/** 段落切分（空行分段 `\n{2,}`，trim 后非空段；段内单个换行保留） */
function splitParagraphs(text: string): string[] {
  return (text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** 字符重叠率（多重集交集大小 / 两段较长者字符数；≥0.5 = 修改段判据；中文按码点计） */
function overlapRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const count = new Map<string, number>();
  for (const ch of a) count.set(ch, (count.get(ch) || 0) + 1);
  let common = 0;
  for (const ch of b) {
    const c = count.get(ch) || 0;
    if (c > 0) {
      common++;
      count.set(ch, c - 1);
    }
  }
  return common / Math.max(Array.from(a).length, Array.from(b).length);
}

/** 前 N 字截断（码点安全；超长加「…」） */
function truncate(s: string, max: number): string {
  const chars = Array.from(s || '');
  if (chars.length <= max) return s;
  return chars.slice(0, max).join('') + '…';
}

interface DiffSeg {
  /** 1-based 段号（A/B 各自文档内序号） */
  no: number;
  text: string;
}

/**
 * 段落 diff 摘要纯函数（v2，ticket「有变化就发」）：
 * 段落切分（空行分段 trim 非空）→ 段落级 LCS（段全文相等配对）→ 未配对旧段=删除（旧文档段号）、
 * 未配对新段=新增（新文档段号）；相邻删增块按位置配对，字符重叠率 ≥0.5 = 修改段（报旧段号），
 * 否则按删除/新增分别报。每类最多列 3 段，超出 → 「等 N 处<类名>」；同类「、」异类「；」。
 * 片段截断：删/增段前 50 字、修改段旧前 30 字 → 新前 30 字。正文无段落级变化 → null。
 */
export function noteDiffSummary(kind: NoteKind, name: string, baseline: string, current: string): string | null {
  const A: DiffSeg[] = splitParagraphs(baseline).map((text, i) => ({ no: i + 1, text }));
  const B: DiffSeg[] = splitParagraphs(current).map((text, i) => ({ no: i + 1, text }));
  if (!A.length && !B.length) return null;

  // 段落级 LCS（相等匹配）：dp 回溯标记 aMatch[i] = 匹配的 B 索引（-1 未匹配）
  const n = A.length;
  const m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i].text === B[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const aMatch: number[] = new Array<number>(n).fill(-1);
  const bMatch: number[] = new Array<number>(m).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i].text === B[j].text) {
      aMatch[i] = j;
      bMatch[j] = i;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const dels: { no: number; text: string }[] = [];
  const adds: { no: number; text: string }[] = [];
  const mods: { no: number; text: string; newText: string }[] = [];

  // 按「相邻删增块」配对：在 LCS 锚点之间收集未匹配旧段/新段，按位置逐对判定
  let runA: number[] = [];
  let runB: number[] = [];
  const flushRun = (): void => {
    if (!runA.length && !runB.length) return;
    const max = Math.max(runA.length, runB.length);
    for (let k = 0; k < max; k++) {
      const d = runA[k] !== undefined ? A[runA[k]] : null;
      const a = runB[k] !== undefined ? B[runB[k]] : null;
      if (d && a) {
        if (overlapRatio(d.text, a.text) >= DIFF_OVERLAP_THRESHOLD) {
          mods.push({ no: d.no, text: d.text, newText: a.text });
        } else {
          dels.push({ no: d.no, text: d.text });
          adds.push({ no: a.no, text: a.text });
        }
      } else if (d) {
        dels.push({ no: d.no, text: d.text });
      } else if (a) {
        adds.push({ no: a.no, text: a.text });
      }
    }
    runA = [];
    runB = [];
  };

  i = 0;
  j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && aMatch[i] === j) {
      flushRun();
      i++;
      j++;
      continue;
    }
    if (i < n && aMatch[i] < 0) {
      runA.push(i);
      i++;
    } else if (j < m && bMatch[j] < 0) {
      runB.push(j);
      j++;
    } else if (i < n) {
      i++;
    } else {
      j++;
    }
  }
  flushRun();

  if (!dels.length && !adds.length && !mods.length) return null;

  /** 类内条目拼接（最多 3 段 + 超出「等 N 处<类>」；同类「、」） */
  const cat = (items: { render: string }[], placeLabel: string): string => {
    if (!items.length) return '';
    const shown = items.slice(0, DIFF_MAX_PER_CAT).map((it) => it.render);
    if (items.length > DIFF_MAX_PER_CAT) shown.push(`等 ${items.length - DIFF_MAX_PER_CAT} 处${placeLabel}`);
    return shown.join('、');
  };

  const parts: string[] = [];
  const delText = cat(
    dels.map((d) => ({ render: `删除了第 ${d.no} 段「${truncate(d.text, DIFF_SNIPPET_LEN)}」` })),
    '删除',
  );
  const addText = cat(
    adds.map((a) => ({ render: `新增了第 ${a.no} 段「${truncate(a.text, DIFF_SNIPPET_LEN)}」` })),
    '新增',
  );
  const modText = cat(
    mods.map((x) => ({ render: `修改了第 ${x.no} 段「${truncate(x.text, DIFF_MOD_LEN)}」→「${truncate(x.newText, DIFF_MOD_LEN)}」` })),
    '修改',
  );
  // 异类「；」分隔（类间顺序固定：删除 → 新增 → 修改，对齐样例会序）
  if (delText) parts.push(delText);
  if (addText) parts.push(addText);
  if (modText) parts.push(modText);
  if (!parts.length) return null;
  return `你修改了${DOMAIN_HEAD[kind]}「${name}」：${parts.join('；')}`;
}

// ---------------- 结算判定（纯函数可测） ----------------

/**
 * 结算判定纯函数（v1 首落 + v2 diff 简化 + v3 日期；对齐 decideDiarySettle 语义、无 tag 维度、无累计阈值）：
 * - 首落（!generated）：正文有字（trim 后非空）才生成首次观察——flash 恒可产；poem/letter 需 date 非 null
 *   （无日期 → 不产且记已见防重复，v3「无日期首落跳过」）；空文件 → 不生成（next 不变，补字后走首落）。
 * - 已生成：当前正文 === 基线 → 不产（状态不变）；正文变化 → 产 noteDiffSummary（若为纯空白/换行变化 →
 *   diff 为 null，不产但 **next.baseline 推进到当前全文**，吸收空白差异避免反复比）；next.baseline 恒 = 当前正文全文。
 * 存量补首落（observed 位）由 index 层 settleNoteFile 负责（见 index 注释），本函数不含该会话态。
 */
export function decideNoteSettle(
  kind: NoteKind,
  name: string,
  body: string,
  state: NoteSettleState,
  date: string | null,
): NoteSettleResult {
  if (!state.generated) {
    if (!(body || '').trim()) return { kind: 'none', text: null, next: state };
    if ((kind === 'poem' || kind === 'letter') && !date) {
      // v3：无日期首落不产（信在准入层已被过滤，此处防御）；记已见防重复
      return { kind: 'none', text: null, next: { generated: true, baseline: body } };
    }
    const text = noteFirstText(kind, name, body, date);
    if (!text) return { kind: 'none', text: null, next: { generated: true, baseline: body } };
    return { kind: 'first', text, next: { generated: true, baseline: body } };
  }
  if (body === state.baseline) return { kind: 'none', text: null, next: state };
  const diff = noteDiffSummary(kind, name, state.baseline, body);
  if (diff) return { kind: 'update', text: diff, next: { generated: true, baseline: body } };
  // 纯空白/换行变化（段落级无差异）：不产但推进基线（吸收空白，避免下次重复比）
  return { kind: 'none', text: null, next: { generated: true, baseline: body } };
}
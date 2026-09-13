/**
 * 日记条目文件格式契约单源（ADR-0130 / ADR-0131 / issue 304 / 305）。
 *
 * 条目文件 = 一条日记一篇笔记：`我的/日记/YYMMDDHHmm(-N)?.md`（如 `2606131223.md`），
 * frontmatter 恰两属性——`date: YYYY-MM-DD HH:mm`（英文冒号）+ `type:`（多值标签名列表），
 * 正文即条目内容（无一级标题）。
 *
 * 题目用数字简写 YYMMDDHHmm 的由来：NTFS/exFAT 禁英文 `:`（实测 ENOENT），全角 `：` 又不合
 * 「英文冒号」初衷，故题目取简写（字典序 = 时间序）；可读形式 `YYYY-MM-DD HH:mm` 只出现在
 * 属性值与界面展示。两种形态的互译只发生在本文件——消费方一律经 helper，不自行拆正则。
 *
 * 消费方：diary（parser/store/encrypt/repair/data）、smartcat、recap、home、encrypt、core/path-classify。
 * 本文件属 core 层（ADR-0002）：只依赖与 obsidian 无关的纯函数，禁反向 import 任何域。
 */

/** 条目文件名（题目）：`YYMMDDHHmm` 或同刻第 N 篇 `YYMMDDHHmm-N` */
export const DIARY_ENTRY_FILE_RE = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.md$/;

/** 旧「一天一文件」日期文件名（迁移后本域不再产出；体检按 legacy 报出、加密还原按它换算条目路径） */
export const DIARY_LEGACY_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})\.md$/;

/** frontmatter 属性名（英文字面量单源：序列化与解析共用，防两侧漂移） */
export const DIARY_DATE_KEY = 'date';
export const DIARY_TYPE_KEY = 'type';

/** 条目文件的 frontmatter 元数据（日期+时间合并值 `YYYY-MM-DD HH:mm`） */
export interface DiaryEntryMeta {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 时间 HH:mm */
  time: string;
}

/** 条目文件路径解析结果：同刻序号（`-N` 让位文件才有） */
export interface DiaryEntryPathMeta extends DiaryEntryMeta {
  seq?: number;
}

/** parseDiaryEntryFile 结果：meta 为 null 表示 frontmatter 日期不可信（调用方从文件名降级）；tags/body 照常提取 */
export interface ParsedDiaryEntryFile {
  meta: DiaryEntryMeta | null;
  tags: string[];
  body: string;
}

/** 由日期+时间（+同刻序号）生成条目文件 basename（不含 .md）：`YYMMDDHHmm`，同刻第 N 篇加 `-N` */
export function diaryEntryBaseName(dateStr: string, timeStr: string, seq?: number): string {
  const d = String(dateStr || '').replace(/-/g, '');
  const t = String(timeStr || '').replace(/:/g, '');
  const stamp = `${d.slice(2, 8)}${t.slice(0, 4)}`; // YYMMDD + HHmm
  return seq && seq > 1 ? `${stamp}-${seq}` : stamp;
}

/** 由目录+日期+时间（+同刻序号）生成条目文件完整路径 */
export function diaryEntryPath(dir: string, dateStr: string, timeStr: string, seq?: number): string {
  return `${dir}/${diaryEntryBaseName(dateStr, timeStr, seq)}.md`;
}

/**
 * 从条目文件路径（完整路径或 basename）解析日期+时间（+同刻序号）；非条目文件名/日历时间非法 → null。
 * 「文件名降级」的唯一入口：frontmatter 不可信时，日期与时间都可从题目完整还原。
 */
export function diaryMetaFromEntryPath(path: string): DiaryEntryPathMeta | null {
  const base = (path || '').replace(/\\/g, '/').split('/').pop() || '';
  const m = DIARY_ENTRY_FILE_RE.exec(base);
  if (!m) return null;
  const date = `20${m[1]}-${m[2]}-${m[3]}`;
  const time = `${m[4]}:${m[5]}`;
  if (!isValidDiaryDate(date) || !isValidDiaryTime(time)) return null;
  return m[6] ? { date, time, seq: Number(m[6]) } : { date, time };
}

/** 旧日期文件名（`YYYY-MM-DD.md`）→ 日期；非该形状或日历非法 → null（组号不外泄，调用方别自己拆） */
export function diaryDateFromLegacyPath(path: string): string | null {
  const base = (path || '').replace(/\\/g, '/').split('/').pop() || '';
  const m = DIARY_LEGACY_FILE_RE.exec(base);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidDiaryDate(date) ? date : null;
}

/** 从条目文件路径取日期；非条目文件名返回 null */
export function diaryDateFromEntryPath(path: string): string | null {
  return diaryMetaFromEntryPath(path)?.date ?? null;
}

/**
 * 「运行时宽」元数据：frontmatter 可信则用它，损坏/缺失则从题目（YYMMDDHHmm）降级；
 * 两处都拿不到（非条目命名且属性不可信）→ null。
 * diary 墙、smartcat 观察、记忆链、recap 统一走这里——「属性坏了也不丢条目」的口径全域一致。
 */
export function resolveDiaryEntryMeta(path: string, parsed: ParsedDiaryEntryFile): DiaryEntryMeta | null {
  return parsed.meta ?? diaryMetaFromEntryPath(path);
}

/** 人类可读时间戳（界面展示与属性值同形）：`YYYY-MM-DD HH:mm` */
export function diaryStampText(date: string, time: string): string {
  return `${date} ${time}`;
}

/** 解析可读时间戳 `YYYY-MM-DD HH:mm`（属性值与展示同形）；形状/日历/时刻任一非法 → null */
export function parseDiaryStamp(value: string): DiaryEntryMeta | null {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(String(value || '').trim());
  return m && isValidDiaryDate(m[1]) && isValidDiaryTime(m[2]) ? { date: m[1], time: m[2] } : null;
}

/** 校验 YYYY-MM-DD 为真实日历日期（含闰年） */
export function isValidDiaryDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= days[mo - 1];
}

/** 校验 HH:mm 为 00:00-23:59 */
export function isValidDiaryTime(s: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(s || '');
  if (!m) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/**
 * 序列化条目文件全文：frontmatter（date + type）+ 空行 + 正文。
 * tags 为空时 `type:` 留空键（解析回空数组）。
 */
export function serializeDiaryEntryFile(meta: DiaryEntryMeta, tags: string[], content: string): string {
  const lines = ['---', `${DIARY_DATE_KEY}: ${diaryStampText(meta.date, meta.time)}`, `${DIARY_TYPE_KEY}:`];
  for (const t of tags) lines.push(`  - ${t}`);
  lines.push('---', '', content);
  let out = lines.join('\n');
  if (!out.endsWith('\n')) out += '\n';
  return out;
}

/** 去掉值两侧成对引号（frontmatter 容错） */
function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

/** SafeNote 加密块头（ADR-0130 §5，v2）：`# 标签名/标签名 HH:mm`——emoji 表不参与加密链路 */
export function serializeDiaryBlockHeader(tags: string[], time: string): string {
  return `# ${tags.join('/')} ${time}`;
}

/** 解析加密块头 → { tags, time }；非块头行 → null。
 *  tags = `/` 分隔的标签名（去空白、去重保序；可能为空数组，兜底「日记」由调用方决定）。 */
export function parseDiaryBlockHeader(line: string): { tags: string[]; time: string } | null {
  const m = /^#\s+(.+)\s+(\d{2}:\d{2})$/.exec(String(line || '').trim());
  if (!m) return null;
  const tags: string[] = [];
  for (const name of m[1].split('/')) {
    const t = name.trim();
    if (t && !tags.includes(t)) tags.push(t);
  }
  return { tags, time: m[2] };
}

/** 读 frontmatter 区某键的原始值（不做语义校验；体检/诊断需区分「键缺失」与「值损坏」时用）。
 *  无 frontmatter 或无该键 → null。 */
export function readDiaryFrontmatterFieldRaw(content: string, key: string): string | null {
  const text = (content || '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return null;
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^${safeKey}:[^\\S\\n]*(.*)$`, 'm').exec(text.slice(4, end));
  return m ? m[1].trim() : null;
}

/**
 * 解析条目文件全文（frontmatter 极简容错：CRLF / 成对引号 / 行内数组 `[a, b]`）。
 * - `date` 缺失或非法、时间非法 → meta=null（类型/正文照常返回，调用方从文件名降级）；
 * - 无 frontmatter → meta=null、tags=[]、body=全文。
 * 只认英文键（`date`/`type`）：旧中文键文件按「属性不可信」走文件名降级，由体检报出。
 */
export function parseDiaryEntryFile(content: string): ParsedDiaryEntryFile {
  const text = (content || '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { meta: null, tags: [], body: content || '' };
  const end = text.indexOf('\n---', 4);
  if (end < 0) return { meta: null, tags: [], body: content || '' };
  // 关闭行须独占一行：'\n---' 后紧跟行尾
  const afterClose = text.slice(end + 4);
  if (afterClose && !afterClose.startsWith('\n')) return { meta: null, tags: [], body: content || '' };
  const fmText = text.slice(4, end);
  // 正文 = 关闭行之后：剥掉 `---` 行终止换行 + 恰一个空行分隔（serialize 的固定格式）；
  // 正文自身的首个空行只被吃掉一层（serialize(以空行开头的正文) 往返稳定）
  let body = afterClose;
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.startsWith('\n')) body = body.slice(1);

  let meta: DiaryEntryMeta | null = null;
  const tags: string[] = [];
  let inTags = false;
  for (const line of fmText.split('\n')) {
    const tagItem = /^\s+-\s*(.*)$/.exec(line);
    if (inTags && tagItem) {
      const v = unquote(tagItem[1]);
      if (v) tags.push(v);
      continue;
    }
    inTags = false;
    const kv = /^([^:]+):(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].trim();
    const val = kv[2].trim();
    if (key === DIARY_DATE_KEY) {
      meta = parseDiaryStamp(unquote(val));
    } else if (key === DIARY_TYPE_KEY) {
      inTags = true;
      // 行内数组形式 `[a, b]`
      if (val.startsWith('[') && val.endsWith(']')) {
        for (const item of val.slice(1, -1).split(',')) {
          const v = unquote(item);
          if (v) tags.push(v);
        }
        inTags = false;
      } else if (val) {
        // 单行标量形式 `type: 日记`
        const v = unquote(val);
        if (v) tags.push(v);
        inTags = false;
      }
    }
  }
  return { meta, tags, body };
}

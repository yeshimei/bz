/**
 * 日记条目文件格式契约单源（ADR-0130 / issue 304）。
 *
 * 条目文件 = 一条日记一篇笔记：`我的/日记/YYYY-MM-DD HH-MM(-N)?.md`，
 * frontmatter 恰两属性——`日期: YYYY-MM-DD HH:mm`（英文冒号）+ `类型:`（多值标签名列表），
 * 正文即条目内容（无一级标题）。文件名因 NTFS 禁 `:`（实测 ENOENT）用 `-` 连接，
 * 属性值保留英文 `:`——两侧的互译只发生在本文件。
 *
 * 消费方：diary（parser/store/encrypt）、smartcat、recap、home、encrypt、core/path-classify。
 * 本文件属 core 层（ADR-0002）：只依赖obsidian 无关的纯函数，禁反向 import 任何域。
 */

/** 条目文件名：`YYYY-MM-DD HH-MM` 或同刻第 N 篇 `YYYY-MM-DD HH-MM-N` */
export const DIARY_ENTRY_FILE_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})(?:-(\d+))?\.md$/;

/** 条目文件的 frontmatter 元数据（日期+时间合并值 `YYYY-MM-DD HH:mm`） */
export interface DiaryEntryMeta {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 时间 HH:mm */
  time: string;
}

/** parseDiaryEntryFile 结果：meta 为 null 表示 frontmatter 日期不可信（调用方从文件名降级）；tags/body 照常提取 */
export interface ParsedDiaryEntryFile {
  meta: DiaryEntryMeta | null;
  tags: string[];
  body: string;
}

/** 由日期+时间（+同刻序号）生成条目文件 basename（不含 .md；文件名连接符为 `-`） */
export function diaryEntryBaseName(dateStr: string, timeStr: string, seq?: number): string {
  const [h = '00', m = '00'] = timeStr.split(':');
  return seq && seq > 1 ? `${dateStr} ${h}-${m}-${seq}` : `${dateStr} ${h}-${m}`;
}

/** 由目录+日期+时间（+同刻序号）生成条目文件完整路径 */
export function diaryEntryPath(dir: string, dateStr: string, timeStr: string, seq?: number): string {
  return `${dir}/${diaryEntryBaseName(dateStr, timeStr, seq)}.md`;
}

/** 从条目文件路径（完整路径或 basename）取日期；非条目文件名返回 null */
export function diaryDateFromEntryPath(path: string): string | null {
  const base = (path || '').replace(/\\/g, '/').split('/').pop() || '';
  const m = base.match(DIARY_ENTRY_FILE_RE);
  return m ? m[1] : null;
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
 * 序列化条目文件全文：frontmatter（日期+类型）+ 空行 + 正文。
 * tags 为空时 `类型:` 留空键（解析回空数组）。
 */
export function serializeDiaryEntryFile(meta: DiaryEntryMeta, tags: string[], content: string): string {
  const lines = ['---', `日期: ${meta.date} ${meta.time}`, '类型:'];
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

/**
 * 解析条目文件全文（frontmatter 极简容错：CRLF / 成对引号 / 行内数组 `[a, b]`）。
 * - `日期` 缺失或非法、时间非法 → meta=null（类型/正文照常返回，调用方降级）；
 * - 无 frontmatter → meta=null、tags=[]、body=全文。
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
    if (key === '日期') {
      const dm = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(unquote(val));
      if (dm && isValidDiaryDate(dm[1]) && isValidDiaryTime(dm[2])) meta = { date: dm[1], time: dm[2] };
    } else if (key === '类型') {
      inTags = true;
      // 行内数组形式 `[a, b]`
      if (val.startsWith('[') && val.endsWith(']')) {
        for (const item of val.slice(1, -1).split(',')) {
          const v = unquote(item);
          if (v) tags.push(v);
        }
        inTags = false;
      } else if (val) {
        // 单行标量形式 `类型: 日记`
        const v = unquote(val);
        if (v) tags.push(v);
        inTags = false;
      }
    }
  }
  return { meta, tags, body };
}

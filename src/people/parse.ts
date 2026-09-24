/**
 * 微信聊天导出解析（issue 435 / ADR-0191，issue 436 多联系人）：消费「留痕 MemoTrace」
 * （LC044/WeChatMsg）导出的 CSV / JSON 文件，产出**按联系人分组**的统一消息流。
 *
 * 覆盖形态（嗅探式，字段别名 / 大小写容错）：
 * - CSV：talker 列（TalkerId/talker/StrTalker）区分联系人；缺列 → 文件名整体一组（单人导出）；
 * - JSON 数组：元素带 talker 字段分组；缺 → 文件名一组；
 * - JSON keyed 对象：{ "wxid_a": [...], "wxid_b": [...] }（每 key 一位联系人）；
 * - JSON 单对象：{ talker, messages: [...] } / { messages: [...] }（老形态，元素 talker 优先）。
 *
 * 解密导出全部由社区工具完成（用户在留痕 GUI 操作），本层假设输入已是明文表格；
 * 格式变更只改本层——外部工具的灰色易碎性由留痕侧承担升级。
 */
import type { UnifiedMessage } from './types';

export type WechatExportFormat = 'csv' | 'json';

/** 一位联系人的消息组（组内按时间升序） */
export interface ContactGroup {
  /** 对方标识：talker / wxid，缺省回落文件名去扩展名 */
  talker: string;
  messages: UnifiedMessage[];
  /** 该联系人被过滤的非文本 / 空消息条数 */
  skippedCount: number;
}

export interface ParsedWechatExport {
  /** 按联系人分组（消息数降序，并列按 talker 字典序）；单聊导出即一组 */
  contacts: ContactGroup[];
}

/** 探测导出格式：首非空字符 [/{ → json；否则首行含逗号 → csv；null = 不认识 */
export function detectWechatFormat(text: string): WechatExportFormat | null {
  const head = text.replace(/^\uFEFF/, '').trimStart();
  if (!head) return null;
  if (head[0] === '[' || head[0] === '{') return 'json';
  const firstLine = head.split('\n', 1)[0] ?? '';
  return firstLine.includes(',') ? 'csv' : null;
}

/** 解析导出文件（CSV / JSON 自动探测；不认识的格式抛错） */
export function parseWechatExport(fileName: string, text: string): ParsedWechatExport {
  const format = detectWechatFormat(text);
  if (!format) throw new Error('不是可识别的聊天导出文件（支持留痕导出的 CSV / JSON）');
  return format === 'json' ? parseJson(fileName, text) : parseCsv(fileName, text);
}

// ---------------- CSV ----------------

/** 小型 RFC4180 状态机：引号包裹 / "" 转义 / CRLF·LF·CR 行分隔 / BOM */
function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } // "" → 字面引号
        else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row); // 丢纯空行
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

const TALKER_KEYS = ['talker', 'talkerid', 'talker_id', 'strtalker', 'wxid', 'username', 'nickname'];

/** CSV 路径：首行表头嗅探列索引 → 数据行按 talker 分桶 */
function parseCsv(fileName: string, text: string): ParsedWechatExport {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error('CSV 没有数据行');
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (candidates: string[]) => headers.findIndex((h) => candidates.includes(h));
  const iSender = idx(['is_sender', 'issender', 'isself']);
  const iText = idx(['msg', 'strcontent', 'content', 'text', 'message']);
  const iTime = idx(['createtime', 'create_time', 'timestamp', 'time', 'msgtime']);
  const iType = idx(['type']);
  const iTypeName = idx(['type_name', 'typename']);
  const iTalker = idx(TALKER_KEYS);
  if (iText < 0 || iTime < 0) throw new Error('CSV 缺少消息内容或时间列（不是留痕导出格式？）');

  const out = new GroupBuilder(fileName);
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const typeName = iTypeName >= 0 ? String(row[iTypeName] ?? '').trim() : undefined;
    const typeNum = iType >= 0 ? String(row[iType] ?? '').trim() : undefined;
    const ts = parseTimestamp(row[iTime]);
    const text = String(row[iText] ?? '').trim();
    const sender = iSender >= 0 ? toBoolSender(row[iSender]) : false;
    const talker = iTalker >= 0 ? String(row[iTalker] ?? '').trim() : undefined;
    out.offer(talker, typeName, typeNum, ts, text, sender);
  }
  return out.build();
}

// ---------------- JSON ----------------

function parseJson(fileName: string, text: string): ParsedWechatExport {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (e) {
    throw new Error(`JSON 解析失败: ${(e as Error).message}`);
  }
  const out = new GroupBuilder(fileName);

  if (Array.isArray(data)) {
    ingestArray(out, data);
    return out.build();
  }
  if (!data || typeof data !== 'object') throw new Error('JSON 里没有消息数组');

  const rec = data as Record<string, unknown>;
  // keyed 形态：{ "wxid_a": [ ... ], ... }（全部值为数组 → 每 key 一位联系人）
  const keys = Object.keys(rec);
  if (keys.length && keys.every((k) => Array.isArray(rec[k]))) {
    for (const k of keys) ingestArray(out, rec[k] as unknown[], k);
    return out.build();
  }
  // 单对象形态：{ talker, messages } / { messages } / { data } / { list } / { records }
  const arr = (['messages', 'data', 'list', 'records'] as const)
    .map((k) => rec[k])
    .find(Array.isArray);
  if (!arr) throw new Error('JSON 里没有消息数组');
  const rootTalker = asStr(pickField(rec, TALKER_KEYS));
  ingestArray(out, arr as unknown[], rootTalker);
  return out.build();
}

/** 消息数组 → 分桶（defaultTalker 缺省时逐元素嗅探 talker，缺则回落文件名） */
function ingestArray(out: GroupBuilder, arr: unknown[], defaultTalker?: string): void {
  for (const item of arr) {
    if (!item || typeof item !== 'object') { out.bumpSkipped(defaultTalker); continue; }
    const obj = item as Record<string, unknown>;
    const typeName = asStr(pickField(obj, ['type_name', 'typeName']));
    const typeNum = asStr(pickField(obj, ['type']));
    const ts = parseTimestamp(pickField(obj, ['createtime', 'create_time', 'timestamp', 'time', 'msgtime']));
    const text = String(pickField(obj, ['msg', 'strcontent', 'content', 'text', 'message']) ?? '').trim();
    const sender = toBoolSender(pickField(obj, ['is_sender', 'isSender', 'isself']));
    const talker = defaultTalker ?? asStr(pickField(obj, TALKER_KEYS));
    out.offer(talker, typeName, typeNum, ts, text, sender);
  }
}

function asStr(v: unknown): string | undefined {
  return v === undefined || v === null ? undefined : String(v).trim() || undefined;
}

function pickField(obj: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of Object.keys(obj)) {
    if (candidates.includes(key)) return obj[key];
  }
  // 兜底：大小写不敏感再扫一遍
  const lower = candidates.map((c) => c.toLowerCase());
  for (const key of Object.keys(obj)) {
    if (lower.includes(key.toLowerCase())) return obj[key];
  }
  return undefined;
}

// ---------------- 共用小件 ----------------

/** 消息收集器：按 talker 分桶 + 文本类型判定 / 空值过滤 / 计数 / 时间排序 */
class GroupBuilder {
  private readonly buckets = new Map<string, { messages: UnifiedMessage[]; skipped: number }>();
  private readonly fallbackTalker: string;

  constructor(fileName: string) {
    this.fallbackTalker = stripExt(fileName);
  }

  private bucketOf(talker: string | undefined): { messages: UnifiedMessage[]; skipped: number } {
    const key = talker && talker.trim() ? talker.trim() : this.fallbackTalker;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { messages: [], skipped: 0 };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  /** 类型 / 时间 / 文本三道过滤；通过则收集。返回是否收集 */
  offer(talker: string | undefined, typeName: string | undefined, typeNum: string | undefined, ts: number | null, text: string, isSender: boolean): boolean {
    const bucket = this.bucketOf(talker);
    if (!isTextType(typeName, typeNum) || ts === null || !text) { bucket.skipped++; return false; }
    bucket.messages.push({ ts, isSender, text });
    return true;
  }

  /** 非消息级跳过（JSON 里非对象元素）计数 */
  bumpSkipped(talker?: string): void {
    this.bucketOf(talker).skipped++;
  }

  build(): ParsedWechatExport {
    const contacts: ContactGroup[] = [...this.buckets.entries()].map(([talker, b]) => ({
      talker,
      messages: [...b.messages]
        .sort((a, b2) => a.ts - b2.ts)
        .map((m) => ({ ...m, text: m.text.replace(/\r\n?/g, '\n') })), // 引号字段内的硬换行归一 LF
      skippedCount: b.skipped,
    }));
    contacts.sort((a, b) => b.messages.length - a.messages.length || a.talker.localeCompare(b.talker));
    return { contacts };
  }
}

/** 文本消息判定：type_name 优先（'文本'），缺位回落数字 Type（1=文本）；两者皆缺放行有文本的 */
function isTextType(typeName: string | undefined, typeNum: string | undefined): boolean {
  if (typeName !== undefined && typeName !== '') return typeName === '文本';
  if (typeNum !== undefined && typeNum !== '') return Number(typeNum) === 1;
  return true;
}

/** 时间戳：秒级(10位) / 毫秒级(13位) / 日期字符串（'2024-01-02 12:00' 空格换 T）→ 毫秒；无效 null */
export function parseTimestamp(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return finiteOrNull(normalizeEpoch(v));
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return finiteOrNull(normalizeEpoch(Number(s)));
  const t = Date.parse(s.includes('T') ? s : s.replace(' ', 'T'));
  return Number.isFinite(t) ? t : null;
}

function finiteOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

function normalizeEpoch(n: number): number {
  if (n > 1e12) return Math.round(n); // 毫秒
  if (n > 1e9) return Math.round(n * 1000); // 秒
  return NaN; // 太小不是合法 epoch
}

function toBoolSender(v: unknown): boolean {
  const s = String(v ?? '').trim();
  return s === '1' || s.toLowerCase() === 'true';
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

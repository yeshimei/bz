/**
 * 工具登记（registry）—— **零 import 的纯契约层**，node 可直接加载，便于单测。
 *
 * 一条登记**只记 bz 自己那份事实**：
 *
 * | 记什么 | 为什么不记别的 |
 * |---|---|
 * | `id` | 稳定键。导入时从声明抄来，决定运行记录文件名 |
 * | `path` | 声明文件路径 —— **元数据的唯一真理源**。标题/描述/参数/节奏/怎么跑全在那边 |
 * | `enabled` | bz 侧状态（停用不等于删除） |
 * | `trustedAt` / `trustedRun` | bz 侧状态。信任的对象是**那条命令**，不是这个 id |
 *
 * 刻意**不**记 `name` / `note` / `trigger` / `cmd` —— 那几项声明里都有。抄一份就多一个会和
 * 声明打架的事实源（曾经真的打起来过：脚本声明 `daily`、登记里 `trigger='manual'`，
 * 卡片标签与详情页各说各话）。所以这里连字段都不给。
 *
 * 校验从严，因为 `path` 指向的声明里有 `run.cmd` —— 那是本插件权限最高的数据。
 */

/** 工具 id 的合法形态（与 schema.ts 的 DOCK_ID_RE 同口径；此处独立定义以保零依赖） */
export const TOOL_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
export const TOOL_ID_MAX_LEN = 64;

/** 触发方式（模型上是一个实体，只有这一个字段不同 —— spec D2）。**由声明的节奏推出**，
 *  不是登记里的字段：有 `schedule` = 自动化，没有 = 手动（`scheduleOfTrigger`）。 */
export type DockTrigger = 'auto' | 'manual';

export interface DockToolEntry {
  /** 稳定标识；决定运行记录文件名，须匹配 TOOL_ID_RE */
  id: string;
  /** 声明文件（`dock.json`）路径 —— 标题 / 描述 / 参数 / 节奏 / 启动命令的唯一来源 */
  path: string;
  /** 停用的工具仍登记在册，但面板不给运行入口 */
  enabled?: boolean;
  /** 「信任此命令」建立时刻（ISO）—— 未信任者不执行 */
  trustedAt?: string;
  /** 建立信任时的启动命令签名；与声明当前值不符 → 信任作废（见 `runSignature`） */
  trustedRun?: string;
}

/**
 * 启动命令的签名 —— 信任绑定的就是它。
 *
 * 声明文件是可改的，所以「信任过这条命令」必须能比对出**命令有没有换过**。`shell` 一起入
 * 签名：它决定命令行怎么过 shell，同样影响「实际执行了什么」。
 */
export function runSignature(run: { cmd: string; args?: string[]; shell?: boolean }): string {
  return [run.cmd, run.shell ? 'shell' : 'raw', ...(run.args ?? [])].join('\u0000');
}

/** 单条登记校验：合法返回归一结果，否则 null（脏值丢弃该条，不连累其余，不抛） */
export function parseToolEntry(raw: unknown): DockToolEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const path = typeof r.path === 'string' ? r.path.trim() : '';
  if (!id || id.length > TOOL_ID_MAX_LEN || !TOOL_ID_RE.test(id)) return null;
  if (!path) return null;

  const out: DockToolEntry = { id, path };
  if (typeof r.enabled === 'boolean') out.enabled = r.enabled;
  if (typeof r.trustedAt === 'string' && r.trustedAt.trim()) out.trustedAt = r.trustedAt.trim();
  if (typeof r.trustedRun === 'string' && r.trustedRun !== '') out.trustedRun = r.trustedRun;
  return out;
}

/**
 * 从设置里的原始值读出登记表。
 * 逐条校验、同 id 只留第一条（后出现的重复项丢弃）—— 重复 id 会让运行记录文件互相串台。
 */
export function parseToolEntries(raw: unknown): DockToolEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DockToolEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = parseToolEntry(item);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    out.push(parsed);
  }
  return out;
}

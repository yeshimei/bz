/**
 * 工具登记（registry）—— 登记契约的类型与校验。只依赖同为纯函数的 `schema`（`parseSchedule`），
 * node 照样可直接加载、直测。
 *
 * 一条登记**只记 bz 自己那份事实**：
 *
 * | 记什么 | 为什么不记别的 |
 * |---|---|
 * | `id` | 稳定键。导入时从声明抄来，决定运行记录文件名 |
 * | `path` | 声明文件路径 —— **元数据的唯一真理源**。标题/描述/参数/节奏/怎么跑全在那边 |
 * | `enabled` | bz 侧状态（停用不等于删除） |
 * | `trustedAt` / `trustedRun` | bz 侧状态。信任的对象是**那条命令**，不是这个 id |
 * | `autoRun` / `scheduleOverride` / `overrideDeclSig` | bz 侧状态 —— **用户对调度的覆盖层**（见下） |
 *
 * 刻意**不**记 `name` / `note` / `trigger` / `cmd` —— 那几项声明里都有。抄一份就多一个会和
 * 声明打架的事实源（曾经真的打起来过：脚本声明 `daily`、登记里 `trigger='manual'`，
 * 卡片标签与详情页各说各话）。所以这里连字段都不给。
 *
 * **`scheduleOverride` 为什么不违反上面那条**：它跟声明里的 `schedule` **本来就允许不同** ——
 * 那正是它的用途（作者写默认节奏，用户改成自己合适的）。它不是「抄的一份真值」，而是**用户的
 * 覆盖层**，生效口径是「覆盖优先」（`effectiveSchedule`）。`overrideDeclSig` 只记下「做这次
 * 覆盖时作者那份长什么样」，好在作者后来改了声明时提示一句「你可能想重看」。`autoRun` 是这套
 * 覆盖的总闸（关掉 = 声明了节奏也不自动跑，只手动）。
 *
 * 校验从严，因为 `path` 指向的声明里有 `run.cmd` —— 那是本插件权限最高的数据。
 */

import { parseSchedule, type DockSchedule } from './schema';

/** 工具 id 的合法形态（与 schema.ts 的 DOCK_ID_RE 同口径；此处独立定义以保零依赖） */
export const TOOL_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
export const TOOL_ID_MAX_LEN = 64;

/** 触发方式（模型上是一个实体，只有这一个字段不同 —— spec D2）。**由声明的节奏推出**，
 *  不是登记里的字段：有 `schedule` = 自动化，没有 = 手动（`scheduleOfTrigger`）。 */
export type DockTrigger = 'auto' | 'manual';

export interface DockToolEntry {
  /** 稳定标识；决定运行记录文件名，须匹配 TOOL_ID_RE */
  id: string;
  /** 声明文件（`manifest.json`）路径 —— 标题 / 描述 / 参数 / 节奏 / 启动命令的唯一来源 */
  path: string;
  /** 停用的工具仍登记在册，但面板不给运行入口 */
  enabled?: boolean;
  /** 「信任此命令」建立时刻（ISO）—— 未信任者不执行 */
  trustedAt?: string;
  /** 建立信任时的启动命令签名；与声明当前值不符 → 信任作废（见 `runSignature`） */
  trustedRun?: string;
  /** 自动运行总闸（缺省 = 开）。关掉 = 即使声明了节奏也不自动跑，只在面板里手动点 */
  autoRun?: boolean;
  /** 节奏覆盖 —— 用户改过的节奏；缺省 = 用声明里的默认值（`effectiveSchedule`） */
  scheduleOverride?: DockSchedule;
  /** 建立覆盖时**声明那份节奏**的签名（`scheduleSignature`）—— 判断「作者后来改没改」用 */
  overrideDeclSig?: string;
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
  if (typeof r.autoRun === 'boolean') out.autoRun = r.autoRun;
  // 覆盖节奏与声明节奏**同一把尺子**校验（parseSchedule）；不合法就当没覆盖，回落声明默认
  const override = parseSchedule(r.scheduleOverride);
  if (override) {
    out.scheduleOverride = override;
    if (typeof r.overrideDeclSig === 'string' && r.overrideDeclSig !== '') {
      out.overrideDeclSig = r.overrideDeclSig;
    }
  }
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

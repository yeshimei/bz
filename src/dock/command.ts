/**
 * 直达运行命令（`bz-dock-run-<工具id>`）的口径层。
 *
 * 背景：已登记的外部工具原先只能在面板里点「运行」。拍板翻案 ADR-0235 的「缓做」项——
 * 每个启用的工具注册一条独立 Obsidian 命令，可挂快捷键，**不打开面板直接跑**。命令的
 * 动作 = 「加载视图 → 过门槛 → 直接跑」，注册本身在 main.ts（照 bz-dock-open 的裸注册
 * 范式）；本文件只收两样与 UI 无关的东西：
 *
 *  - `judgeDirectRun`：门槛**判定**。刻意做成零 UI 依赖的纯函数（node 可直测），面板的
 *    runFlow、调度器的 inputOf、命令的执行路径三方共用同一份口径，不会各说各话；
 *  - `dockToolLabel`：命令名里的工具名（读声明只为拿名字——读文件不执行任何东西）。
 *
 * 判定与执行分居两处：执行要碰 notify / flow-dialog / 面板模块态，住在 ui.ts 的
 * `runToolDirect`。工具随后增删**需重启生效**（命令表是启动时一次性注册的），在那边注释里说明。
 */

import { readDeclaration } from './declaration';
import { isTrusted, type DockToolEntry, type DockToolView } from './data';
import { missingRequiredParams } from './schedule';

/**
 * 直达运行的门槛判定结果。
 *
 * `needTrust` 不是「拦死」而是「要走既有信任确认」（applyTrust 的确认框会展示将跑的命令，
 * D7 语义：确认之前一个字节都不会被执行）；`message` 才是硬拦（通知里说清为什么不让跑）。
 */
export type DirectRunVerdict =
  | { pass: true }
  | { pass: false; needTrust: true }
  | { pass: false; message: string };

/**
 * 必填参数缺失 → 人话文案；齐了 → null。判定层与 ui.ts 的「信任后补查」共用这一份措辞——
 * 信任建立后手里是旧视图、不能重跑整份判定，只能单独补查参数（见 runToolDirect），
 * 两处各写一遍迟早漂开。
 */
export function missingParamsMessage(
  params: readonly { key: string; label: string; required?: boolean }[] | undefined,
  values: Record<string, unknown>,
): string | null {
  const missing = missingRequiredParams(params, values);
  return missing.length ? `还差必填参数：${missing.join('、')}` : null;
}

/**
 * 这个视图现在能不能直接跑。与面板 runFlow / 调度器 inputOf 同一条口径：
 *  - 声明里写了怎么跑（`run`）——没写就硬拦，话照面板那句说；
 *  - 已信任且信任没过期（trustStale = 命令变了，必须重新确认）；
 *  - 必填参数不缺（值取工具目录 `data.json` 那份——命令路径没有表单草稿可冲，与调度器
 *    paramsReady 同源；`null` / 空串 / 空数组都算缺）。
 *
 * 移动端不在这里判——那读的是宿主环境（Platform），命令回调里自行 notify 后返回。
 */
export function judgeDirectRun(v: DockToolView): DirectRunVerdict {
  if (!v.run) return { pass: false, message: '这份声明没写怎么跑：既无 run 段，目录里也没有 main.mjs' };
  if (!isTrusted(v.entry) || v.trustStale) return { pass: false, needTrust: true };
  const msg = missingParamsMessage(v.manifest?.params, v.values);
  return msg === null ? { pass: true } : { pass: false, message: msg };
}

/**
 * 命令名里的工具名：声明名 > 登记 id。启动时读一次声明只为拿名字，声明读不到不折腾、
 * 回落 id（移动端本就够不着 fs，自然落 id——命令照样注册，回调里会被桌面端检查拦下）。
 */
export function dockToolLabel(entry: DockToolEntry): string {
  return readDeclaration(entry.path).manifest?.name || entry.id;
}

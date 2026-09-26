/**
 * 声明式设置 schema 渲染器（ticket 131，ADR-0064）：设置界面 = 对象字面量声明（分组 + 行数组 +
 * 联动条件），core 统一构建。域只声明「有什么设置」，防抖落盘/显隐联动/徽标回填/移动端两行式
 * 等行为只存在本模块一处口径。
 *
 * - 绑定二选一：`{ key }`（keyof BzSettings 泛型收窄，自动读值 + 落盘 data.json）或
 *   `{ get, set, save }` 外部数据三函数逃生口（news.json 等域内数据）。
 * - 行类型十类：toggle / text / path / select / slider（基准五类）+ custom 插槽 /
 *   button（actionRow 豁免组徽标）/ info / number / textarea。
 * - text/textarea/number 行沿用原 main.ts textSetting 语义（f1）：800ms 防抖 + 失焦/回车立即
 *   落盘 + onCommit 一次性提示（值相对初始值有变更才提示、同一次编辑会话至多一次、
 *   改回原值后复位可再次提示——warnedInitial 细节逐字保留）。
 * - visibleWhen 声明式联动：任意行变更后统一重求值全部条件，显隐挂 .bz-setting-hidden，
 *   随后 refreshSettingsGroupCounts 徽标刷新一并收口。
 * - 与 settings-modal 为函数级引用环（两模块仅在函数体内互访，无模块顶层互访——AGENTS 依赖铁律）。
 */
import { Setting } from 'obsidian';
import type BzSettings from '../settings';
import { ROW_BTN_RESET_MS, armRowBtnReset, setRowBtnState, shortFailReason } from './settings-btn-state';
import { getSettings, saveSettings, tryGetSettings } from './settings-provider';
import { renderPathSettingRow } from './path-picker';
import { createSettingsGroup, markSettingSplitRows, refreshSettingsGroupCounts } from './settings-modal';
import { uiCardChoice, uiSetlist } from './ui';
import { notifySaveError } from './notice';

/** 设置快照：visibleWhen 条件函数的入参（键直绑行的当前值；外部数据行请自行闭包捕获）。 */
export type SettingsSnapshot = Readonly<BzSettings>;

/** BzSettings 中值类型与 V 精确匹配的键集合（双向收窄，防把 boolean 键绑到 text 行等错绑）。 */
export type SettingsKeyOfType<V> = {
  [K in keyof BzSettings]-?: [NonNullable<BzSettings[K]>] extends [V]
    ? [V] extends [NonNullable<BzSettings[K]>]
      ? K
      : never
    : never;
}[keyof BzSettings];

/** 行值绑定二选一：键直绑（自动读值 + saveSettings 落盘）或外部数据三函数逃生口。 */
export type RowBinding<V> =
  | { key: SettingsKeyOfType<V> }
  | {
      /** 读当前值 */
      get: () => V;
      /** 写新值（仅内存；持久化由 save 负责） */
      set: (v: V) => void;
      /** 持久化（如域内 json-store 落盘） */
      save: () => Promise<void> | void;
    };

/** 行渲染上下文（custom 行 render 与各行回调可用） */
export interface SettingsRowContext {
  /** 行根元素（custom 行为渲染包装容器） */
  rowEl: HTMLElement;
  /** 触发全部 visibleWhen 重求值 + 徽标刷新 + 两行式重标注（custom 行内部动态增删设置行后调用） */
  refreshVisibility: () => void;
}

/** 行公共字段（name 由各具体行按需声明，custom 行可省略） */
interface RowBase {
  /** 描述（ticket 100 文案规范：约 20 字自然句） */
  desc?: string;
  /** 声明式显隐条件：初始渲染与任意行变更后重求值（省略 = 恒显示） */
  visibleWhen?: (snapshot: SettingsSnapshot) => boolean;
  /**
   * 子项联动显隐（ticket 170）：true = 本行跟随所在组内前面最近的 toggle 父项——父项关闭时
   * 本行隐藏、开启才显示（与行自身 visibleWhen 取与）。父项须为键直绑（外部绑定无法判定）；
   * 父键为「缺省开」语义（键缺失视为开）的域不适用 isChild，请显式写 visibleWhen。
   */
  isChild?: boolean;
  /** 行底补充提示（拍板原型：『↳』前缀灰字，渲染于描述之下——如存储路径的迁移提示） */
  note?: string;
}

interface ToggleRow extends RowBase {
  type: 'toggle';
  name: string;
  binding: RowBinding<boolean>;
  /** 开关变更（写内存 + 落盘后触发） */
  onChange?: (value: boolean, ctx: SettingsRowContext) => void;
}

/** 文本类行共用字段：防抖 commit 落盘点回调（一次性提示语义内置） */
interface TextualCommit {
  /** 防抖到期 / 失焦 / 回车（textarea 无回车提交）触发的落盘点回调 */
  onCommit?: () => void;
  /**
   * 行级联动刷新（ticket 172 延伸）：任意行变更后重求值时，重读本行输入框的显示值。
   * 声明方式：键名（读 getSettings()[key]）或函数（从快照求值）——结果即为当前应显示值。
   * 用途：per-provider 配置输入随「AI 服务商」切换刷新（值 = 覆盖 > 注册表默认）。
   * 语义与 custom 行 onRefresh 一致：只刷新显示，不落盘（用户未编辑时重求值不触发保存）。
   */
  refreshKey?: string | ((snapshot: SettingsSnapshot) => string);
}

/** 行内附加按钮（text/number/slider/info 行通用）：颠覆 custom 插槽的「文本+按钮」「滑条+按钮」复合行。
 *  text/number 行 onClick 的 value = 当前输入值；slider/info 行为 undefined。
 *  渲染序：两端一致为「按钮在输入框左侧」（2026-09-08 拍板：输入框右缘与同行列对齐）；
 *  onClick 完成后渲染器重读本行绑定值回填显示（不落盘），供「填入/拉取回填」类动作即时回显。 */
export interface RowAction {
  text: string;
  /** 强调色按钮 */
  cta?: boolean;
  /** 状态反馈钮（issue 434，测试类按钮专用）：点击即转圈，resolve→绿✓、reject→红✕，
   *  短暂停留后复原；约定不弹通知——结果长在按钮上（core/settings-btn-state 单源）。 */
  stateful?: boolean;
  onClick: (value: string | undefined, ctx: SettingsRowContext) => void | Promise<void>;
}

/** 输入框键盘语义（移动端软键盘/自动填充提示；桌面无可见影响、不做校验——面板无 form 提交面，
 *  真正的合法性由各域消费侧兜底，别在这里演「格式校验」）。'url' = 地址类行（端点/服务地址）。 */
export type SettingsInputMode = 'text' | 'url' | 'numeric' | 'decimal' | 'tel' | 'search' | 'email';

interface TextRow extends RowBase, TextualCommit {
  type: 'text';
  name: string;
  binding: RowBinding<string>;
  /** 占位提示；函数形式 = 随快照联动（ticket 172：placeholder 跟随 aiProvider 显示注册表默认） */
  placeholder?: string | ((snapshot: SettingsSnapshot) => string);
  /** 每键触发（写内存后；落盘走防抖/失焦/回车 commit） */
  onChange?: (value: string, ctx: SettingsRowContext) => void;
  /** 数字型文本行修饰：右对齐已退役（2026-09-08 左对齐拍板），现仅窄框宽度档（设置面板渲染器消费） */
  num?: boolean;
  /** 行内附加按钮（渲染于输入框左侧） */
  actions?: RowAction[];
  /** 输入框键盘语义（见 SettingsInputMode；仅提示，不参与校验） */
  inputMode?: SettingsInputMode;
}

interface TextAreaRow extends RowBase, TextualCommit {
  type: 'textarea';
  name: string;
  binding: RowBinding<string>;
  placeholder?: string;
  onChange?: (value: string, ctx: SettingsRowContext) => void;
  /** 行内附加按钮（issue 330：与 text 行同口径，渲染于多行文本左侧） */
  actions?: RowAction[];
}

/**
 * 单行掩码行（2026-09-23 自 settings-panel 收编进 core 联合，原 GS3「密钥型」档位）：
 * 控件形态 = 密码框 + 眼睛切明文，其余（防抖落盘 / 失焦回车提交 / refreshKey 联动 /
 * actions / onCommit）与 text 行同内核。**凭据类设置一律走本档，别用 text 行裸奔**——
 * 收编前本档位不在 core 联合里，core 层（如 settings-main-schema 的 Jev 行）只能
 * `as unknown as SettingsRow` 就地断言硬塞，AI 服务商密钥则一直是明文 text 行。
 */
export interface SecretRow extends RowBase, TextualCommit {
  type: 'secret';
  name: string;
  binding: RowBinding<string>;
  placeholder?: string | ((snapshot: SettingsSnapshot) => string);
  onChange?: (value: string, ctx: SettingsRowContext) => void;
  /** 行内附加按钮（渲染于输入框左侧，与 text 行同口径） */
  actions?: RowAction[];
}

export interface NumberRow extends RowBase, TextualCommit {
  type: 'number';
  name: string;
  binding: RowBinding<number>;
  /** 钳制下界（写入前钳制；同时落到输入框 min 属性） */
  min?: number;
  /** 钳制上界；函数形式 = 随快照联动（issue 457：AI「最大输出 token」按当前 provider/模型取真上限，
   *  与 refreshKey 联动刷新同口径），返回 undefined = 本次不钳制 */
  max?: number | ((snapshot: SettingsSnapshot) => number | undefined);
  /** 输入框步进（浏览器 spinner 口径；不参与写入钳制） */
  step?: number;
  /** 占位提示；函数形式 = 随快照联动（ticket 172） */
  placeholder?: string | ((snapshot: SettingsSnapshot) => string);
  onChange?: (value: number, ctx: SettingsRowContext) => void;
  /** 行内附加按钮（渲染于输入框左侧） */
  actions?: RowAction[];
}

interface SelectRow extends RowBase {
  type: 'select';
  name: string;
  binding: RowBinding<string>;
  /** 选项（对象字面量书写，Q1 拍板）。函数形式 = 随快照求值（issue 411/ADR-0179：思考档位随
   *  「AI 服务商」切换换表——档位词表是 provider 属性，固定五档会把不生效的档摆给用户） */
  options: SelectOption[] | ((snapshot: SettingsSnapshot) => SelectOption[]);
  /** 值随快照联动重读（语义同 TextualCommit.refreshKey）；与函数型 options 同用时，任意行变更后
   *  重建选项并回填当前 provider 的值（不落盘、不置脏） */
  refreshKey?: string | ((snapshot: SettingsSnapshot) => string);
  onChange?: (value: string, ctx: SettingsRowContext) => void;
}

/** 下拉选项（静态数组与函数求值共用） */
export interface SelectOption {
  value: string;
  label: string;
}

// ---- select 决策三件套（issue 412）：两套渲染器（本文件 addDropdown 路径 / settings-panel
// ---- 自绘 .bz-select 路径）共用——DOM 形态各自实现，选项求值/换表判定/显示值回落只有一份 ----

/** 选项求值：静态数组原样返回，函数形式随快照重取（服务商切换后换表） */
export function selectOptionsOf(
  options: SelectOption[] | ((snapshot: SettingsSnapshot) => SelectOption[]),
  snapshot: SettingsSnapshot,
): SelectOption[] {
  return typeof options === 'function' ? options(snapshot) : options;
}

/** 选项集签名（value 序列）：签名变了 = 换了一张表，整只下拉须重建，旧选项不能留 */
export function selectOptionsSignature(opts: SelectOption[]): string {
  return opts.map((o) => o.value).join('\u0001');
}

/** 当前应显示值：绑定值不在选项内（空/历史遗留档位）→ 回落首个选项（原「空值回退首项」口径）。
 *  与 core/thinkingBodyFor「不在表内不注入」同口径——显示值不许落在选项外。 */
export function selectDisplayValue(read: () => unknown, opts: SelectOption[]): string {
  const v = String(read() ?? '');
  return opts.some((o) => o.value === v) ? v : (opts[0]?.value ?? '');
}

interface SliderRow extends RowBase {
  type: 'slider';
  name: string;
  binding: RowBinding<number>;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number, ctx: SettingsRowContext) => void;
  /** 行内附加按钮（渲染于滑条右侧，如「试听」） */
  actions?: RowAction[];
}

interface PathRow extends RowBase {
  type: 'path';
  name: string;
  /** single = 单值（绑定 string 键）；multi = 多值（绑定 string[] 键）。ADR-0061 选择器录入 */
  mode: 'single' | 'multi';
  binding: RowBinding<string> | RowBinding<string[]>;
  /** 选择器标题（缺省用 name） */
  pickerTitle?: string;
  /** 选择器内补充说明 */
  pickerDesc?: string;
  /** 按钮文案（缺省：single「选择…」/ multi「添加…」） */
  buttonText?: string;
  /** 选择器确定按钮文案 */
  okText?: string;
  /** chips 空态文案（缺省「未选择」） */
  emptyText?: string;
  /** 空值回落显示（可选）：绑定值为空时 chips 区展示该函数返回的「实际生效目录」锁定 chip
   *  （仅展示不落盘，点击重开选择器可改为显式设置。先例：bookshelfFolderPath 空 = 回落旧 library 键/「书库」） */
  fallbackValue?: () => string;
  /** 选择确定 / chip 移除后（写内存 + 落盘后触发）。返回 string[]（或其 Promise）= 否决/改写后的
   *  最终清单（如异步收编确认被取消时回退旧值），以返回值为落盘与 chips 渲染口径；void = 以 list 为准。 */
  onChange?: (list: string[], ctx: SettingsRowContext) => void | string[] | Promise<void | string[]>;
  /** 有意落盘点回调：一次性提示语义内置（同 text 行） */
  onCommit?: () => void;
}

/** 纯操作行（如「添加监听文件夹」）：挂 .bz-setting-action-row 豁免分组徽标计数 */
interface ButtonRow extends RowBase {
  type: 'button';
  name: string;
  buttonText: string;
  /** 强调色按钮（setCta） */
  cta?: boolean;
  onClick: (ctx: SettingsRowContext) => void;
}

/** 纯展示行（名称 + 描述，无控件；如影视「海报抓取」指引行）；actions 供展示行附带操作按钮 */
interface InfoRow extends RowBase {
  type: 'info';
  name: string;
  actions?: RowAction[];
}

/** 列表行条目：key 为移除判定身份，label 主文案，sub 副文案（灰字），imageUrl 头像（加载失败不占位） */
export interface SettingsListItem {
  key: string;
  label: string;
  sub?: string;
  imageUrl?: string;
}

/** 通用列表行（推翻UP名单/排除名单等 chips 自绘 DOM）：移除按钮逐条触发 onChange 传回剩余键集。
 *  items 支持函数形式（每次移除后重读重建，域侧以磁盘/字盒为基底）；空数组渲染 emptyText 空态。 */
interface ListRow extends RowBase {
  type: 'list';
  name: string;
  items: SettingsListItem[] | (() => SettingsListItem[]);
  emptyText?: string;
  /** 移除按钮文案（默认「移除」） */
  removeLabel?: string;
  /** 布局变体（通用组件 .bz-setlist 修饰类，两渲染器同口径；缺省 = chips 流式胶囊，2026-09-12 拍板）：
   *  rows = 全宽行列表 / grid = 卡片网格 / dense = 紧密分隔行 */
  variant?: 'rows' | 'grid' | 'chips' | 'dense';
  onChange?: (keys: string[], ctx: SettingsRowContext) => void;
}

/** 非常规内容唯一出口：render 插槽（内容渲染进独立包装容器，visibleWhen 作用于包装容器） */
interface CustomRow extends RowBase {
  type: 'custom';
  render: (body: HTMLElement, ctx: SettingsRowContext) => void;
  /** ticket 172：任意行变更后（含 aiProvider 切换）重求值时回调，供外部绑定行刷新显示值 */
  onRefresh?: (ctx: SettingsRowContext) => void;
}

/** 视觉卡片单选行（issue 210）：预览卡 + 名称的「看脸选」设置项（如备忘录面板皮肤）。
 *  prevClass = 预览区附加类，视觉由使用方域样式提供；无编号无描述为拍板形态。
 *  layoutKey/layout（外观组范式）：布局绑定的主题行按该键当前值过滤 options——主题不通用（拍板）。 */
interface ChoiceCardsRow extends RowBase {
  type: 'choiceCards';
  name: string;
  binding: RowBinding<string>;
  options: Array<{ value: string; label: string; prevClass?: string; layout?: string }>;
  layoutKey?: string;
  onChange?: (value: string, ctx: SettingsRowContext) => void;
}

/** 十一类行判别联合（Q5；issue 210 增 choiceCards） */
export type SettingsRow =
  | ToggleRow
  | TextRow
  | TextAreaRow
  | NumberRow
  | SelectRow
  | SliderRow
  | PathRow
  | ButtonRow
  | InfoRow
  | CustomRow
  | ChoiceCardsRow
  | SecretRow
  | ListRow;

/** 分组声明：有 icon = 分组卡片（createSettingsGroup）；无 icon = 区块标题 + 平铺行
 *  （主设置页 ADR-0009 单页形态，DOM 契约 .bz-setting-section-title 不破）。 */
export interface GroupDecl {
  /** 卡片组名 / 区块标题文案 */
  name: string;
  /** lucide 图标名（缺省 = 区块标题平铺形态） */
  icon?: string;
  rows: SettingsRow[];
  /** 组级显隐条件（false 时整组挂 .bz-setting-hidden） */
  visibleWhen?: (snapshot: SettingsSnapshot) => boolean;
}

export interface SettingsSchema {
  groups: GroupDecl[];
}

/** 渲染句柄：refresh = 重求值显隐 + 徽标回填 + 两行式重标注（动态内容变更后调用） */
interface SettingsRenderHandle {
  refresh: () => void;
}

/** text 行防抖窗口（ms）：连续输入不逐键落盘，停顿后才持久化（原 main.ts TEXT_COMMIT_DELAY）。
 *  导出：settings-panel 自绘渲染器消费同一窗口（ARCH-1 行为内核单源，字面量平行复刻退役）。 */
export const TEXT_COMMIT_DELAY = 800;

/** 绑定统一读写通道：键直绑走 settings-provider（getSettings/saveSettings），外部数据走三函数 */
export interface ValueAccess<V> {
  read: () => V;
  write: (v: V) => void;
  persist: () => Promise<void> | void;
}

export function bindValue<V>(binding: RowBinding<V>): ValueAccess<V> {
  if ('key' in binding) {
    const key = binding.key;
    return {
      read: () => getSettings()[key] as V,
      write: (v) => {
        (getSettings() as unknown as Record<string, unknown>)[key as string] = v;
      },
      persist: () => saveSettings(),
    };
  }
  return { read: () => binding.get(), write: (v) => binding.set(v), persist: () => binding.save() };
}

/**
 * persist 统一兜底（N5，与 C10 列表行同口径）：saveQueue reject / 同步抛错不再裸奔成
 * unhandled rejection——控件已显示新值而盘上没存上，必须人话提示（notifySaveError）。
 * 导出：settings-panel 自绘渲染器 8 处行级 persist 消费同一实现（ARCH-1 行为内核单源，
 * core 历轮加固经此传导面板侧，不再各修一轮）。
 */
export function safePersist(persist: () => Promise<void> | void, what: string): void {
  try {
    Promise.resolve(persist()).catch((e) => notifySaveError(e, what));
  } catch (e) {
    notifySaveError(e, what);
  }
}

/**
 * onCommit 一次性提示机制（原 textSetting f1 语义收口，warnedInitial 细节逐字保留）：
 * 值相对初始值有变更才触发；同一次编辑会话至多一次；改回原值后复位可再次提示。
 * 导出：settings-panel 自绘渲染器消费同一类（ARCH-1，域内 SpCommitWarn 同语义副本退役）。
 */
export class CommitWarn {
  private warnedInitial: string | null = null;

  constructor(
    private readonly initial: string,
    private readonly onCommit?: () => void
  ) {}

  fire(current: string): void {
    if (!this.onCommit) return;
    if (current !== this.initial) {
      if (this.warnedInitial !== this.initial) {
        this.warnedInitial = this.initial;
        this.onCommit();
      }
    } else {
      this.warnedInitial = null;
    }
  }
}

/** 渲染器内部登记项：显隐重求值目标（行根元素 / 组根元素 / custom 包装容器） */
interface VisibilityEntry {
  el: HTMLElement;
  visibleWhen?: (snapshot: SettingsSnapshot) => boolean;
}

/** 当前快照：未注入 provider 时返回空对象（纯显隐 schema 在测试/早期调用下不炸） */
function currentSnapshot(): SettingsSnapshot {
  return tryGetSettings() as SettingsSnapshot;
}

/**
 * number 行的 min/max 求值（issue 457/ADR-0193）：静态数值原样返回；函数形式随快照取当前值
 * （如 AI「最大输出 token」的上界 = 当前 provider 当前模型的官方最大输出）。返回 undefined 即
 * 本次不钳制——非有限数（NaN / Infinity）与 undefined 同路，宁可不动也不写脏值。
 */
export function resolveNumberBound(
  bound: number | ((snapshot: SettingsSnapshot) => number | undefined) | undefined,
  snapshot: SettingsSnapshot,
): number | undefined {
  if (bound === undefined) return undefined;
  if (typeof bound !== 'function') return bound;
  const v = bound(snapshot);
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** 数字解析 + min/max 钳制；空串/非有限数返回 null（不写入，防脏值落盘） */
export function parseClampedNumber(raw: string, min?: number, max?: number): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  let out = n;
  if (min !== undefined) out = Math.max(min, out);
  if (max !== undefined) out = Math.min(max, out);
  return out;
}

/** 可掩码控件的最小结构面（单行密钥档位）：真实 input 与 TextualComponent.inputEl 均满足 */
interface MaskableEl {
  type: string;
}

/**
 * 掩码控件的「眼睛」切换钮：翻 `input.type` 在 password ↔ text 之间。
 * 切换只翻显示形态，不动值、不落盘（与设置面板渲染器的眼睛同语义）。
 */
function wireSecretEye(setting: Setting, el: MaskableEl): void {
  let revealed = false;
  setting.addExtraButton((b) => {
    b.setIcon('eye').setTooltip('显示 / 隐藏');
    b.extraSettingsEl.setAttribute('aria-label', '显示密钥');
    b.extraSettingsEl.setAttribute('aria-pressed', 'false');
    b.onClick(() => {
      revealed = !revealed;
      el.type = revealed ? 'text' : 'password';
      b.setIcon(revealed ? 'eye-off' : 'eye');
      b.extraSettingsEl.setAttribute('aria-pressed', String(revealed));
      b.extraSettingsEl.setAttribute('aria-label', revealed ? '隐藏密钥' : '显示密钥');
    });
  });
}

/** 文本/多行/数字/掩码组件的最小结构面（真实 obsidian Text/TextAreaComponent 与 mock 均满足）。
 *  掩码档位用到 type/autocomplete/spellcheck（单行翻 password↔text）；inputMode 为键盘语义提示。 */
interface TextualComponent {
  setValue: (v: string) => unknown;
  setPlaceholder?: (p: string) => unknown;
  onChange: (cb: (v: string) => void) => unknown;
  inputEl?: {
    type: string;
    min?: string;
    max?: string;
    step?: string;
    autocomplete?: string;
    spellcheck?: boolean;
    inputMode?: string;
    classList: { add(c: string): void; remove(c: string): void };
    addEventListener: (type: string, listener: (e: { key: string }) => void) => void;
  };
}

/**
 * 把 schema 渲染进任意容器（主设置页容器 / openSettingsModal 内容区 / 自建 overlay）。
 * 渲染完成后统一：初始显隐求值 → 分组徽标回填 → 移动端两行式标注。
 * 返回 refresh 句柄：动态内容（如 custom 行增删设置行）变更后调用。
 */
export function renderSettingsInto(container: HTMLElement, schema: SettingsSchema): SettingsRenderHandle {
  const entries: VisibilityEntry[] = [];
  /** ticket 172：custom 行 onRefresh 回调（provider 切换等任意变更后重刷外部绑定行显示值） */
  const customRefreshes: Array<() => void> = [];

  const reevaluate = (): void => {
    const snap = currentSnapshot();
    for (const e of entries) {
      e.el.classList.toggle('bz-setting-hidden', e.visibleWhen ? !e.visibleWhen(snap) : false);
    }
    for (const fn of customRefreshes) {
      try { fn(); } catch { /* 单行刷新失败不影响其余 */ }
    }
    refreshSettingsGroupCounts(container);
    markSettingSplitRows(container);
  };

  /** 行 Setting 统一构建：名称 + 可选描述 + visibleWhen 显隐登记（七类行共用样板收口） */
  const newRowSetting = (body: HTMLElement, row: RowBase & { name: string }): Setting => {
    const setting = new Setting(body).setName(row.name);
    if (row.desc) setting.setDesc(row.desc);
    if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
    return setting;
  };

  /** 文本类行（text/textarea/number/secret）：原 main.ts textSetting 语义逐字收口 */
  const renderTextualRow = (body: HTMLElement, row: TextRow | TextAreaRow | NumberRow | SecretRow): void => {
    const ctx: SettingsRowContext = { rowEl: body, refreshVisibility: reevaluate };
    const setting = newRowSetting(body, row);

    const isNumber = row.type === 'number';
    const acc: ValueAccess<string | number> = isNumber
      ? bindValue(row.binding as RowBinding<number>)
      : bindValue(row.binding as RowBinding<string>);
    // 三类行 onChange 的值参类型不同（string | number），行类型判别后统一签名调用
    const changeCb = row.onChange as ((value: string | number, ctx: SettingsRowContext) => void) | undefined;
    const initial = String(acc.read() ?? '');
    let pending: ReturnType<typeof setTimeout> | null = null;
    let last = initial;
    /** 用户是否实际编辑过（P2-2：refreshKey 程序化改写显示值不置脏，防 blur 假写覆盖换 provider 的值） */
    let dirty = false;
    /** number 行输入框当前原文（R9：commit 点判定非法输入用——commit 只有 inputEl，无回调值参） */
    let raw = initial;
    const warn = new CommitWarn(initial, row.onCommit);
    /** number 行非法输入的行内报错态（R9/效率#14）：输入框 error 描边 + desc 提示「已保留原值 N」，
     *  下次有效输入或 commit 回显时清除。desc 走 Setting.setDesc（无新 DOM 结构，不影响徽标/两行式） */
    let numError = false;
    const markNumberError = (): void => {
      if (numError) return;
      numError = true;
      currentText?.inputEl?.classList.add('bz-input--error');
      const base = row.desc ? `${row.desc}；` : '';
      setting.setDesc(`${base}需为数字，已保留原值 ${String(acc.read() ?? '')}`);
    };
    const clearNumberError = (): void => {
      if (!numError) return;
      numError = false;
      currentText?.inputEl?.classList.remove('bz-input--error');
      setting.setDesc(row.desc ?? '');
    };
    /** 有意的落盘点：防抖到期 / 失焦 / 回车（textarea 无回车提交）——统一落盘 */
    const commit = (): void => {
      if (pending !== null) {
        clearTimeout(pending);
        pending = null;
      }
      if (!dirty) return; // 未编辑（仅程序化刷新显示值）不落盘、不提示、不求值
      // R9/效率#14：number 行非空非法输入——回显生效旧值并清报错态（内存未写入，落的是旧值；
      // 不再让「显示值 ≠ 生效值」的缝留给用户）。空串不回显（留空回落默认是有意义的状态）
      if (isNumber) {
        const snap = currentSnapshot();
        const n = parseClampedNumber(
          raw,
          resolveNumberBound((row as NumberRow).min, snap),
          resolveNumberBound((row as NumberRow).max, snap),
        );
        if (n === null && raw.trim() !== '') {
          dirty = false;
          if (currentText) currentText.setValue(String(acc.read() ?? ''));
          clearNumberError();
        }
      }
      safePersist(acc.persist, row.name);
      warn.fire(last);
      reevaluate(); // 有意变更点重求值显隐（逐键重排会闪烁，文本类行只在 commit 点联动）
    };
    // refreshKey 联动刷新 + R9 报错态：保存输入框引用供闭包回调 setValue/classList（声明在 addInto 外）
    let currentText: TextualComponent | null = null;
    /** addInto 形参复用 currentText 类型（声明在后，运行时同一对象） */
    const addInto = (t: TextualComponent) => {
      currentText = t;
      t.setValue(initial);
      // placeholder：函数形式 = 随快照联动（ticket 172 提供商默认提示），字符串形式 = 静态
      const place = (snap: SettingsSnapshot): string | undefined =>
        typeof row.placeholder === 'function' ? row.placeholder(snap) : row.placeholder;
      const applyPlaceholder = (): void => {
        if (t.setPlaceholder) {
          const p = place(currentSnapshot());
          if (p !== undefined) t.setPlaceholder(p);
        }
      };
      applyPlaceholder();
      t.onChange((v: string) => {
        dirty = true; // 用户真实输入（程序化 setValue 不经过 onChange → 不置脏）
        if (isNumber) {
          raw = v;
          const snap = currentSnapshot();
          const n = parseClampedNumber(
            v,
            resolveNumberBound((row as NumberRow).min, snap),
            resolveNumberBound((row as NumberRow).max, snap),
          );
          if (n === null) {
            // 空串/非数字不写入（防脏值落盘），已有计时照常走完；非空非法行内报错（效率#14）
            if (v.trim() !== '') markNumberError();
            return;
          }
          clearNumberError();
          acc.write(n);
          if (String(n) !== v) {
            // R9：钳制值 ≠ 输入值 → 回写输入框（程序化 setValue 不经 onChange，dirty 保持——
            // 防抖 commit 照常落钳制值，显示值不再 ≠ 落盘值）
            last = String(n);
            t.setValue(last);
          } else {
            last = v;
          }
        } else {
          acc.write(v);
          last = v;
        }
        try {
          changeCb?.(isNumber ? (acc.read() as number) : v, ctx);
        } catch (e) {
          // 新-1 连带：域行 onChange 同步抛错不得中断防抖排程（否则落盘只剩 blur/回车兜底）
          console.error(e);
          notifySaveError(e, row.name);
        }
        if (pending !== null) clearTimeout(pending);
        pending = setTimeout(commit, TEXT_COMMIT_DELAY);
      });
      const inputEl = t.inputEl;
      if (inputEl) {
        if (isNumber) {
          const num = row as NumberRow;
          inputEl.type = 'number';
          // issue 457/ADR-0193：max 可以是函数（随 provider / 模型联动）——初始求值一次，并挂进
          // customRefreshes，在任意行变更（含切服务商、改模型名）后重设，防止上界停在上一条通道。
          // 静态 max 无需刷新（老口径行为不变）。
          const applyBounds = (): void => {
            const snap = currentSnapshot();
            const lo = resolveNumberBound(num.min, snap);
            const hi = resolveNumberBound(num.max, snap);
            // undefined = 本次不钳制 → 属性一并清空：否则切到「无上限可依」的通道（本地 Ollama）
            // 时会残留上一个 provider 的上界
            inputEl.min = lo === undefined ? '' : String(lo);
            inputEl.max = hi === undefined ? '' : String(hi);
          };
          applyBounds();
          if (typeof num.max === 'function') customRefreshes.push(applyBounds);
          if (num.step !== undefined) inputEl.step = String(num.step);
        }
        // 单行掩码（type:'secret'）：密码框 + 右侧眼睛切明文——与设置面板渲染器同口径
        // （切形态只翻 input.type，不动值不落盘）
        if (row.type === 'secret') {
          inputEl.type = 'password';
          inputEl.autocomplete = 'off';
          inputEl.spellcheck = false;
          wireSecretEye(setting, inputEl);
        }
        // 键盘语义提示（仅移动端软键盘；不参与校验）
        const mode = (row as { inputMode?: SettingsInputMode }).inputMode;
        if (mode && mode !== 'text') inputEl.inputMode = mode;
        inputEl.addEventListener('blur', commit);
        if (row.type !== 'textarea') {
          inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
          });
        }
      }
      // 函数型 placeholder 随快照联动：任意行变更（含 aiProvider 切换）后刷新占位提示
      if (typeof row.placeholder === 'function') {
        const origReevaluate = ctx.refreshVisibility;
        ctx.refreshVisibility = () => {
          applyPlaceholder();
          origReevaluate();
        };
      }
      // refreshKey 联动刷新：任意行变更（含 aiProvider 切换）后重读显示值写回输入框（不落盘）。
      // 程序化改写须清 dirty（P2-2）：否则后续 blur 触发 commit 会把刷新后的显示值误写落盘
      if (row.refreshKey !== undefined) {
        const ref = row.refreshKey;
        customRefreshes.push(() => {
          if (currentText) {
            const snap = currentSnapshot();
            const fresh = typeof ref === 'function' ? ref(snap) : String((snap as any)[ref]);
            if (currentText.setValue) {
              dirty = false;
              currentText.setValue(String(fresh ?? ''));
            }
          }
        });
      }
    };
    // 行内附加按钮（先注册 → 渲染于输入框左侧，2026-09-08 拍板换位的对齐口径；textarea 行同口径，issue 330）：
    // onClick 完成后重读本行绑定值回填显示（不置脏）+ 重求值——供「填入/拉取回填」类动作即时回显。
    // stateful 钮（issue 434）：点击即转圈、resolve 绿✓ / reject 红✕（红叉吞错不外抛——反馈长在按钮上）
    const actions = (row as TextRow | TextAreaRow | NumberRow | SecretRow).actions;
    if (actions) {
      for (const a of actions) {
        setting.addButton((b) => {
          if (a.cta) b.setCta();
          b.setButtonText(a.text).onClick(() => {
            void (async () => {
              const el = (b as unknown as { buttonEl?: HTMLElement }).buttonEl;
              try {
                if (a.stateful) setRowBtnState(el, 'busy', a.text);
                await a.onClick(last, ctx);
                if (a.stateful) setRowBtnState(el, 'ok', a.text);
              } catch (e) {
                if (a.stateful) setRowBtnState(el, 'fail', a.text, shortFailReason(e));
                else throw e;
              } finally {
                if (a.stateful) armRowBtnReset(el, a.text);
              }
              if (currentText && currentText.setValue) {
                dirty = false;
                currentText.setValue(String(acc.read() ?? ''));
              }
              reevaluate();
            })();
          });
        });
      }
    }
    if (row.type === 'text') setting.addText(addInto);
    else if (row.type === 'textarea') setting.addTextArea(addInto);
    else setting.addText(addInto);
  };

  const renderRow = (body: HTMLElement, rowArg: SettingsRow, parentToggleKey?: string | null): void => {
    const ctx: SettingsRowContext = { rowEl: body, refreshVisibility: reevaluate };
    let row = rowArg;
    // isChild 联动显隐（ticket 170）：跟随组内前面最近的 toggle 父项（键直绑）——父项关闭时本行
    // 隐藏、开启才显示，与行自身 visibleWhen 取与；父项为外部绑定（无 key）时不联动，恒显示。
    if (row.isChild && parentToggleKey) {
      row = {
        ...row,
        visibleWhen: (snap: SettingsSnapshot) =>
          (snap as unknown as Record<string, unknown>)[parentToggleKey] === true &&
          (rowArg.visibleWhen ? rowArg.visibleWhen(snap) : true),
      } as SettingsRow;
    }

    switch (row.type) {
      case 'custom': {
        // 非常规内容唯一出口：渲染进独立包装容器（visibleWhen 显隐作用对象）
        const wrap = document.createElement('div');
        body.appendChild(wrap);
        if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
        row.render(wrap, { rowEl: wrap, refreshVisibility: reevaluate });
        if (row.onRefresh) customRefreshes.push(() => row.onRefresh!({ rowEl: wrap, refreshVisibility: reevaluate }));
        return;
      }
      case 'path': {
        const acc = bindValue<string | string[]>(row.binding as RowBinding<string | string[]>);
        const multi = row.mode === 'multi';
        const initialRaw = acc.read();
        const initialKey = multi ? JSON.stringify(initialRaw ?? []) : String(initialRaw ?? '');
        const warn = new CommitWarn(initialKey, row.onCommit);
        // N6：当前生效值（域回调抛错时的回滚锚点）——初始为绑定初值，成功 apply 后推进
        let applied: string | string[] = multi
          ? Array.isArray(initialRaw)
            ? [...initialRaw]
            : []
          : String(initialRaw ?? '');
        // 行 DOM 由 renderPathSettingRow 自建（Setting + chips + 按钮）；包装容器作 visibleWhen 宿主
        const wrap = document.createElement('div');
        body.appendChild(wrap);
        if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
        renderPathSettingRow({
          parent: wrap,
          name: row.name,
          desc: row.desc,
          mode: row.mode,
          value: multi
            ? Array.isArray(initialRaw)
              ? [...initialRaw]
              : []
            : String(initialRaw ?? ''),
          pickerTitle: row.pickerTitle,
          pickerDesc: row.pickerDesc,
          buttonText: row.buttonText,
          okText: row.okText,
          emptyText: row.emptyText,
          onChange: (list) => {
            const v = multi ? list : (list[0] || '').trim().replace(/^\/+|\/+$/g, '');
            acc.write(v as string | string[]);
            safePersist(() => acc.persist(), row.name);
            let res: void | string[] | Promise<void | string[]>;
            try {
              res = row.onChange?.(list, ctx);
            } catch (e) {
              // N6：域行回调同步抛错 → 人话提示 + 回滚绑定值；回传旧清单供 path-picker 回滚
              // chips 渲染（原先 unhandled rejection：chips 停留新值假象且无提示）
              notifySaveError(e, row.name);
              acc.write(applied);
              safePersist(() => acc.persist(), row.name);
              reevaluate();
              return multi
                ? Array.isArray(applied)
                  ? [...applied]
                  : []
                : String(applied ?? '')
                  ? [String(applied)]
                  : [];
            }
            // 回调在落盘后触发（原口径）；返回清单（含异步解析结果）回传 path 行作 chips 渲染口径——
            // 异步否决场景的落盘改写由回调自行负责（如外部 binding 自管写盘）
            applied = v as string | string[];
            warn.fire(multi ? JSON.stringify(v) : String(v));
            reevaluate();
            if (res && typeof (res as { then?: unknown }).then === 'function') {
              return Promise.resolve(res as Promise<void | string[]>).then(
                (final) => (Array.isArray(final) ? final : list)
              );
            }
            return Array.isArray(res) ? res : undefined;
          },
        });
        return;
      }
      case 'toggle': {
        const acc = bindValue(row.binding);
        const setting = newRowSetting(body, row);
        setting.addToggle((t) =>
          t.setValue(acc.read() === true).onChange(async (v) => {
            acc.write(v);
            // 显隐随值同步切换（原 refreshKeys 在落盘前同步刷新的口径）
            reevaluate();
            // N5：persist reject 不再裸奔（开关已显新值盘上没有，必须人话提示）
            try {
              await acc.persist();
            } catch (e) {
              notifySaveError(e, row.name);
            }
            row.onChange?.(v, ctx);
          })
        );
        return;
      }
      case 'select': {
        const acc = bindValue(row.binding);
        const setting = newRowSetting(body, row);
        // 选项求值 / 签名 / 显示值回落 = core 单源三件套（issue 412；settings-panel 自绘下拉同源）
        const readOptions = (): SelectOption[] => selectOptionsOf(row.options, currentSnapshot());
        let dd: { setValue: (v: string) => void } | null = null;
        let optionsSig: string | null = null;
        const mount = (): void => {
          // 重建先清控件区（选项集变化 = 换了一张表，旧 <select> 的 option 不能留）
          while (setting.controlEl.firstChild) setting.controlEl.removeChild(setting.controlEl.firstChild);
          setting.addDropdown((d) => {
            dd = d as unknown as { setValue: (v: string) => void };
            const opts = readOptions();
            for (const opt of opts) d.addOption(opt.value, opt.label);
            d.setValue(selectDisplayValue(() => acc.read(), opts));
            d.onChange(async (v) => {
              acc.write(v);
              // 显隐随值同步切换（原 refreshKeys 口径）
              reevaluate();
              try {
                await acc.persist();
              } catch (e) {
                notifySaveError(e, row.name); // N5 同口径
              }
              row.onChange?.(v, ctx);
            });
          });
        };
        mount();
        optionsSig = selectOptionsSignature(readOptions());
        // 联动刷新（issue 411/ADR-0179）：选项集变了 → 整只下拉重建；否则只回填当前值（不落盘）。
        // 与 text/number 行的 refreshKey 同一登记表（任意行变更后统一重求值）
        if (row.refreshKey !== undefined || typeof row.options === 'function') {
          const sync = (): void => {
            const opts = readOptions();
            const sig = selectOptionsSignature(opts);
            if (sig !== optionsSig) {
              optionsSig = sig;
              mount();
              return;
            }
            dd?.setValue(selectDisplayValue(() => acc.read(), opts));
          };
          customRefreshes.push(sync);
        }
        return;
      }
      case 'choiceCards': {
        // 视觉卡片单选（issue 210）：与 select 同绑定通道；空值回退首个选项（同 select 口径）
        const acc = bindValue(row.binding);
        const setting = newRowSetting(body, row);
        const pick = uiCardChoice({
          value: String(acc.read() ?? '') || row.options[0].value,
          options: row.options,
          label: row.name,
          onChange: async (v) => {
            acc.write(v);
            reevaluate();
            try {
              await acc.persist();
            } catch (e) {
              notifySaveError(e, row.name); // N5 同口径
            }
            row.onChange?.(v, ctx);
          },
        });
        setting.controlEl.appendChild(pick.el);
        return;
      }
      case 'slider': {
        const acc = bindValue(row.binding);
        const setting = newRowSetting(body, row);
        setting.addSlider((sl) => {
          sl.setLimits(row.min, row.max, row.step ?? 1);
          sl.setValue(Number(acc.read()) || 0);
          sl.setDynamicTooltip();
          sl.onChange(async (v) => {
            acc.write(v);
            // 显隐随值同步切换（同 toggle 口径）
            reevaluate();
            try {
              await acc.persist();
            } catch (e) {
              notifySaveError(e, row.name); // N5 同口径
            }
            row.onChange?.(v, ctx);
          });
        });
        // 行内附加按钮（滑条右侧，如「试听」）
        for (const a of row.actions ?? []) {
          setting.addButton((b) => {
            if (a.cta) b.setCta();
            b.setButtonText(a.text).onClick(() => void a.onClick(undefined, ctx));
          });
        }
        return;
      }
      case 'button': {
        const setting = newRowSetting(body, row);
        setting.addButton((b) => {
          if (row.cta) b.setCta();
          b.setButtonText(row.buttonText).onClick(() => row.onClick(ctx));
        });
        setting.settingEl.classList.add('bz-setting-action-row'); // 豁免组徽标计数
        return;
      }
      case 'info': {
        // 纯展示：名称 + 描述（actions 在场时附操作按钮）
        const setting = newRowSetting(body, row);
        for (const a of row.actions ?? []) {
          setting.addButton((b) => {
            if (a.cta) b.setCta();
            b.setButtonText(a.text).onClick(() => void a.onClick(undefined, ctx));
          });
        }
        return;
      }
      case 'list': {
        // 通用列表行：条目 markup/行为 = 组件库 uiSetlist（唯一源，与面板渲染器同调）；
        // 包装容器作 visibleWhen 宿主；items 函数形式在每次移除后重读重建（域侧以磁盘为基底）
        const wrap = document.createElement('div');
        wrap.className = 'bz-setlist-wrap';
        body.appendChild(wrap);
        const setting = new Setting(wrap).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
        const readItems = () => (typeof row.items === 'function' ? row.items() : row.items);
        const renderItems = (): void => {
          wrap.querySelector('.bz-setlist')?.remove();
          wrap.appendChild(uiSetlist({
            items: readItems(),
            variant: row.variant,
            removeLabel: row.removeLabel,
            emptyText: row.emptyText,
            onRemove: (key) => {
              void (async () => {
                const remaining = readItems().map((x) => x.key).filter((k) => k !== key);
                try {
                  await row.onChange?.(remaining, ctx);
                } catch (e) {
                  // C10：移除回调抛错 → 通知 + 回滚重绘（原先 unhandled rejection：
                  // UI 停在已删假象、无提示，renderItems/reevaluate 被跳过）
                  notifySaveError(e, row.name || '列表项');
                } finally {
                  reevaluate(); // 经 customRefreshes 重读重建（含本行）——与添加同路径
                }
              })();
            },
          }));
        };
        renderItems();
        // 列表行随任意行变更重读重建（添加按钮/输入提交后即时可见；否则要重开弹窗——2026-09-12 修）
        customRefreshes.push(renderItems);
        return;
      }
      case 'text':
      case 'textarea':
      case 'number':
      case 'secret':
        renderTextualRow(body, row);
        return;
    }
  };

  /** 组内行渲染（ticket 170 isChild 联动）：本组首个键直绑 toggle 视为「组级父项」，
   *  所有 isChild 行跟随它显隐——而非跟随「前面最近的 toggle」——避免组内多个 toggle 时
   *  子项级联绑到错误父项。首个 toggle 自身的 isChild 会被忽略（无父项可跟）。 */
  const renderGroupRows = (body: HTMLElement, rows: SettingsRow[]): void => {
    const firstToggleKey =
      (rows.find((r) => r.type === 'toggle' && 'key' in r.binding) as { binding: { key: string } } | undefined)?.binding.key ?? null;
    for (const row of rows) renderRow(body, row, firstToggleKey);
  };

  for (const group of schema.groups) {
    if (group.icon) {
      // 分组卡片形态（createSettingsGroup 基座收编）
      const body = createSettingsGroup(container, { icon: group.icon, name: group.name });
      const groupEl = (body.parentElement ?? container) as HTMLElement;
      if (group.visibleWhen) entries.push({ el: groupEl, visibleWhen: group.visibleWhen });
      renderGroupRows(body, group.rows);
    } else {
      // 区块标题平铺形态（主设置页）：.bz-setting-section-title 契约保持
      const title = document.createElement('div');
      title.className = 'bz-setting-section-title';
      title.textContent = group.name;
      container.appendChild(title);
      if (group.visibleWhen) entries.push({ el: title, visibleWhen: group.visibleWhen });
      renderGroupRows(container, group.rows);
    }
  }

  reevaluate();
  return { refresh: reevaluate };
}

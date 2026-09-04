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
import { getSettings, saveSettings, tryGetSettings } from './settings-provider';
import { renderPathSettingRow } from './path-picker';
import { createSettingsGroup, markSettingSplitRows, refreshSettingsGroupCounts } from './settings-modal';

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
type RowBinding<V> =
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

interface TextRow extends RowBase, TextualCommit {
  type: 'text';
  name: string;
  binding: RowBinding<string>;
  /** 占位提示；函数形式 = 随快照联动（ticket 172：placeholder 跟随 aiProvider 显示注册表默认） */
  placeholder?: string | ((snapshot: SettingsSnapshot) => string);
  /** 每键触发（写内存后；落盘走防抖/失焦/回车 commit） */
  onChange?: (value: string, ctx: SettingsRowContext) => void;
  /** 数字型文本行修饰（issue 187 采样参数）：右对齐窄框（设置面板渲染器消费；core 渲染器忽略） */
  num?: boolean;
}

interface TextAreaRow extends RowBase, TextualCommit {
  type: 'textarea';
  name: string;
  binding: RowBinding<string>;
  placeholder?: string;
  onChange?: (value: string, ctx: SettingsRowContext) => void;
}

export interface NumberRow extends RowBase, TextualCommit {
  type: 'number';
  name: string;
  binding: RowBinding<number>;
  /** 钳制下界（写入前钳制；同时落到输入框 min 属性） */
  min?: number;
  /** 钳制上界 */
  max?: number;
  /** 输入框步进（浏览器 spinner 口径；不参与写入钳制） */
  step?: number;
  /** 占位提示；函数形式 = 随快照联动（ticket 172） */
  placeholder?: string | ((snapshot: SettingsSnapshot) => string);
  onChange?: (value: number, ctx: SettingsRowContext) => void;
}

interface SelectRow extends RowBase {
  type: 'select';
  name: string;
  binding: RowBinding<string>;
  /** 选项（对象字面量书写，Q1 拍板） */
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string, ctx: SettingsRowContext) => void;
}

interface SliderRow extends RowBase {
  type: 'slider';
  name: string;
  binding: RowBinding<number>;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number, ctx: SettingsRowContext) => void;
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

/** 纯展示行（名称 + 描述，无控件；如影视「海报抓取」指引行） */
interface InfoRow extends RowBase {
  type: 'info';
  name: string;
}

/** 非常规内容唯一出口：render 插槽（内容渲染进独立包装容器，visibleWhen 作用于包装容器） */
interface CustomRow extends RowBase {
  type: 'custom';
  render: (body: HTMLElement, ctx: SettingsRowContext) => void;
  /** ticket 172：任意行变更后（含 aiProvider 切换）重求值时回调，供外部绑定行刷新显示值 */
  onRefresh?: (ctx: SettingsRowContext) => void;
}

/** 十类行判别联合（Q5） */
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
  | CustomRow;

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

/** text 行防抖窗口（ms）：连续输入不逐键落盘，停顿后才持久化（原 main.ts TEXT_COMMIT_DELAY） */
const TEXT_COMMIT_DELAY = 800;

/** 绑定统一读写通道：键直绑走 settings-provider（getSettings/saveSettings），外部数据走三函数 */
interface ValueAccess<V> {
  read: () => V;
  write: (v: V) => void;
  persist: () => Promise<void> | void;
}

function bindValue<V>(binding: RowBinding<V>): ValueAccess<V> {
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
 * onCommit 一次性提示机制（原 textSetting f1 语义收口，warnedInitial 细节逐字保留）：
 * 值相对初始值有变更才触发；同一次编辑会话至多一次；改回原值后复位可再次提示。
 */
class CommitWarn {
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

  /** 文本类行（text/textarea/number）：原 main.ts textSetting 语义逐字收口 */
  const renderTextualRow = (body: HTMLElement, row: TextRow | TextAreaRow | NumberRow): void => {
    const ctx: SettingsRowContext = { rowEl: body, refreshVisibility: reevaluate };
    const setting = new Setting(body).setName(row.name);
    if (row.desc) setting.setDesc(row.desc);
    if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });

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
    const warn = new CommitWarn(initial, row.onCommit);
    /** 有意的落盘点：防抖到期 / 失焦 / 回车（textarea 无回车提交）——统一落盘 */
    const commit = (): void => {
      if (pending !== null) {
        clearTimeout(pending);
        pending = null;
      }
      if (!dirty) return; // 未编辑（仅程序化刷新显示值）不落盘、不提示、不求值
      void acc.persist();
      warn.fire(last);
      reevaluate(); // 有意变更点重求值显隐（逐键重排会闪烁，文本类行只在 commit 点联动）
    };
    // refreshKey 联动刷新：保存输入框引用供重求值回调 setValue（声明在 addInto 外，闭包内写入）
    let currentText: { setValue: (v: string) => unknown } | null = null;
    /** 文本/多行文本组件的最小结构面（真实 obsidian Text/TextAreaComponent 与 mock 均满足） */
    const addInto = (t: {
      setValue: (v: string) => unknown;
      setPlaceholder?: (p: string) => unknown;
      onChange: (cb: (v: string) => void) => unknown;
      inputEl?: {
        type: string;
        min?: string;
        max?: string;
        step?: string;
        addEventListener: (type: string, listener: (e: { key: string }) => void) => void;
      };
    }) => {
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
          const n = parseClampedNumber(v, (row as NumberRow).min, (row as NumberRow).max);
          if (n === null) return; // 空串/非数字不写入（防脏值落盘），已有计时照常走完
          acc.write(n);
        } else {
          acc.write(v);
        }
        last = v;
        changeCb?.(isNumber ? (acc.read() as number) : v, ctx);
        if (pending !== null) clearTimeout(pending);
        pending = setTimeout(commit, TEXT_COMMIT_DELAY);
      });
      const inputEl = t.inputEl;
      if (inputEl) {
        if (isNumber) {
          const num = row as NumberRow;
          inputEl.type = 'number';
          if (num.min !== undefined) inputEl.min = String(num.min);
          if (num.max !== undefined) inputEl.max = String(num.max);
          if (num.step !== undefined) inputEl.step = String(num.step);
        }
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
            void acc.persist();
            // 回调在落盘后触发（原口径）；返回清单（含异步解析结果）回传 path 行作 chips 渲染口径——
            // 异步否决场景的落盘改写由回调自行负责（如外部 binding 自管写盘）
            const res = row.onChange?.(list, ctx);
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
        const setting = new Setting(body).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
        setting.addToggle((t) =>
          t.setValue(acc.read() === true).onChange(async (v) => {
            acc.write(v);
            // 显隐随值同步切换（原 refreshKeys 在落盘前同步刷新的口径）
            reevaluate();
            await acc.persist();
            row.onChange?.(v, ctx);
          })
        );
        return;
      }
      case 'select': {
        const acc = bindValue(row.binding);
        const setting = new Setting(body).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
        setting.addDropdown((dd) => {
          for (const opt of row.options) dd.addOption(opt.value, opt.label);
          // 空值回退首个选项（对齐原 diary 行 `s[field] || options[0][0]` 口径，防 undefined 值 setValue 抛错）
          dd.setValue(String(acc.read() ?? '') || row.options[0].value);
          dd.onChange(async (v) => {
            acc.write(v);
            // 显隐随值同步切换（原 refreshKeys 口径）
            reevaluate();
            await acc.persist();
            row.onChange?.(v, ctx);
          });
        });
        return;
      }
      case 'slider': {
        const acc = bindValue(row.binding);
        const setting = new Setting(body).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
        setting.addSlider((sl) => {
          sl.setLimits(row.min, row.max, row.step ?? 1);
          sl.setValue(Number(acc.read()) || 0);
          sl.setDynamicTooltip();
          sl.onChange(async (v) => {
            acc.write(v);
            // 显隐随值同步切换（同 toggle 口径）
            reevaluate();
            await acc.persist();
            row.onChange?.(v, ctx);
          });
        });
        return;
      }
      case 'button': {
        const setting = new Setting(body).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
        setting.addButton((b) => {
          if (row.cta) b.setCta();
          b.setButtonText(row.buttonText).onClick(() => row.onClick(ctx));
        });
        setting.settingEl.classList.add('bz-setting-action-row'); // 豁免组徽标计数
        return;
      }
      case 'info': {
        // 纯展示：仅名称 + 描述，无控件
        const setting = new Setting(body).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
        return;
      }
      case 'text':
      case 'textarea':
      case 'number':
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

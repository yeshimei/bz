/**
 * 设置面板自绘渲染器（settings-panel，ADR-0080）
 * 数据 = 各域真实 schema（xxxSettingsSchema() 行声明，与 ⚙️ 弹窗同源）；
 * 视觉 = 新体系组件库（src/core/ui：按钮/输入/开关/下拉/滑条/chip/徽标），
 * 行/分组卡骨架仍为域布局（.bz-sp-set-row/.bz-sp-group，取值 tokens.css）。
 * 绑定逻辑照抄 core/settings-schema.ts：键直绑（getSettings/saveSettings）/
 * 三函数逃生口 / visibleWhen 求值 / onChange 回调 / text 防抖落盘。
 *
 * 与 core/settings-schema.ts 渲染器的关键差异：
 * 1. 行渲染完全不使用 Obsidian Setting 组件——路径行也是自绘（chips + 选择按钮 +
 *    openPathPicker 选择器），不再出现「设置行里再套一层原生设置行」的嵌套；
 * 2. custom 行走自绘卡片行骨架（custom 内容渲染进控件区，插槽占满整行），
 *    兼容现有各域 custom 插槽内的 new Setting() 代码（它们渲染进本面板的
 *    .bz-sp-settings-body 时同样被自绘容器包裹）。
 * 3. 图标一律 lucide（setIcon/组件库），禁止 emoji 当图标（ui-kit-manual §5）。
 */
import { getSettings, saveSettings } from '../core/settings-provider';
import { openPathPicker } from '../core/path-picker';
// 行为内核单源（ARCH-1）：safePersist（N5）/CommitWarn（H1）/parseClampedNumber（R9）/
// TEXT_COMMIT_DELAY（防抖窗口）下沉 core 导出，两渲染器消费同一实现——core 历轮加固经此传导
import {
  bindValue, safePersist, CommitWarn, parseClampedNumber, TEXT_COMMIT_DELAY,
} from '../core/settings-schema';
import type { RowBinding, SettingsSchema, SettingsRow, SettingsSnapshot, SettingsRowContext, SecretRow, SelectOption } from '../core/settings-schema';
import { setIcon } from 'obsidian';
import { notice, notifySaveError } from '../core/notice';
import { escManager } from '../core/esc-manager';
// markup 单源（ADR-0104/0105）：行/组/控件结构串全出自渲染纯层，本文件只留行为绑定
import * as R from './render';
import { mountIcons, uiSetlist, uiChip, uiBtn } from '../core/ui';
// 动效层（校准台语义世界，见 motion.ts 文件头）：只在行为反馈点被调用，markup 契约不变
import {
  motionSwitchFlip, motionSelectPick, motionCardChoose,
  motionInputSaved, motionInputReject, motionInputAdjust,
} from './motion';

/** 快照读取（visibleWhen 求值输入；键直绑行从 getSettings 读，三函数行由外部提供） */
function snapshot(): SettingsSnapshot {
  return getSettings() as unknown as SettingsSnapshot;
}

/* ==================== 密钥型行（GS3 档位，呈报#48） ==================== */

/**
 * 密钥型行（type:'secret'）：TextRow 的掩码档位变体——input type=password 掩码显示 +
 * 眼睛切换明文，提交链（防抖落盘 / 失焦回车提交 / refreshKey 联动 / actions）与 text 行同内核。
 * 2026-09-23：本档位已收编进 core 的 SettingsRow 判别联合（core/settings-schema.ts 的
 * SecretRow，两渲染器同口径）——原先这里自持一份 SecretRow + secretRow() 受控断言，
 * 只为绕开 core 联合未收编；现在直接用 core 类型，断言与跨层 hack 一并退场。
 */

/** 行绑定写入失败的统一提示（H5：先写后翻 UI——写入抛错时不翻 UI 只提示）；
 *  文案收编 core notifySaveError 单源（review-deep 一致#3） */
function notifyWriteError(e: unknown): void {
  notifySaveError(e, '设置写入');
}

/** 行上下文（供 onChange/custom/button 回调；结构与 core SettingsRowContext 一致） */
function makeCtx(rowEl: HTMLElement, refreshVisibility: () => void): SettingsRowContext {
  return { rowEl, refreshVisibility };
}

/* ==================== 行控件（全部消费组件库共享类） ==================== */

/** refreshKey 联动的程序化显示值写回入口（makeInput 与 textarea 分支均挂入；WeakMap 替代元素挂属性） */
const displaySetters = new WeakMap<HTMLInputElement | HTMLTextAreaElement, (v: string) => void>();

/** 文本提交行为内核（ARCH-1）：防抖落盘（TEXT_COMMIT_DELAY 单源 core）+ 失焦/回车提交 +
 *  refreshKey 程序化写回入口。makeInput（text/number）与 makeSecretInput（GS3 密钥型）共用。 */
function bindTextCommit(
  input: HTMLInputElement,
  onCommit: (v: string) => string | void,
): void {
  // 防抖落盘（TEXT_COMMIT_DELAY=800 单源 core + 失焦/回车）
  let timer: number | null = null;
  let dirty = false; // 用户是否实际编辑过（refreshKey 程序化 setValue 不置脏，防 blur 假写覆盖）
  const commit = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (!dirty) return; // 未编辑（仅程序化刷新显示值）不落盘
    const echo = onCommit(input.value);
    if (typeof echo === 'string' && input.value !== echo) {
      dirty = false;
      input.value = echo;
    }
  };
  input.addEventListener('input', () => {
    dirty = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(commit, TEXT_COMMIT_DELAY);
  });
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
  });
  // refreshKey 联动刷新显示值的入口：程序化写值（不置脏——清 dirty 防后续 blur 假写覆盖）
  displaySetters.set(input, (v: string) => {
    dirty = false;
    if (input.value !== v) input.value = v;
  });
}

/**
 * refreshKey 联动注册（makeInput 系共用）：任意行变更后重读显示值，
 * 经程序化写回输入框（不落盘、不置脏）。
 */
function regRefreshDisplay(
  regRefresh: ((fn: () => void) => void) | undefined,
  ref: string | ((snapshot: SettingsSnapshot) => string) | undefined,
  input: HTMLInputElement,
): void {
  if (!regRefresh || ref === undefined) return;
  regRefresh(() => {
    const snap = snapshot();
    const fresh = typeof ref === 'function' ? ref(snap) : String((snap as any)[ref]);
    displaySetters.get(input)?.(String(fresh ?? ''));
  });
}

/** 文本/数字输入：.bz-input 共享底 + 行内布局修饰（mono/num 尺寸见域样式）。
 *  行为层独有：防抖落盘 + 失焦/回车提交 + refreshKey 程序化刷新（不置脏，防 blur 假写）。
 *  掩码档位不走这里（单行 = makeSecretInput，多行 = makeMaskedArea）。 */
function makeInput(opts: {
  value: string;
  type?: 'text' | 'number';
  mono?: boolean;
  num?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  /** 软键盘语义提示（仅提示不校验） */
  inputMode?: string;
  /** 提交回调；返回字符串 = 回显值（R9：number 非法输入不写入，回显生效旧值防「显示 ≠ 生效」） */
  onCommit: (v: string) => string | void;
}): HTMLInputElement {
  // 结构单源（R.textInputHtml 逐字原型），行为（防抖落盘/refreshKey 联动）留本层
  const holder = document.createElement('div');
  holder.innerHTML = R.textInputHtml({
    value: opts.value,
    type: opts.type,
    mono: opts.mono,
    num: opts.num,
    placeholder: opts.placeholder,
    min: opts.min,
    max: opts.max,
    inputMode: opts.inputMode,
  });
  const input = holder.firstElementChild as HTMLInputElement;
  bindTextCommit(input, opts.onCommit); // 防抖落盘/失焦回车提交/refreshKey 写回入口（内核单源）
  return input;
}

/** 眼睛钮行为（单行掩码与多行掩码共用，别各写一份）：翻显示形态 + aria 同步 + 图标换形。
 *  apply() 执行形态切换并返回切换后的「已显示明文」态；只翻形态，不动值不落盘。 */
function bindSecretEye(eye: HTMLButtonElement, apply: () => boolean): void {
  eye.addEventListener('click', () => {
    const revealed = apply();
    eye.setAttribute('aria-pressed', String(revealed));
    eye.setAttribute('aria-label', revealed ? '隐藏密钥' : '显示密钥');
    eye.innerHTML = R.iconSpan(revealed ? 'eye-off' : 'eye'); // 图标随形态换（占位串 → mountIcons 兑现）
    mountIcons(eye);
  });
}

/** 密钥型输入（GS3 档位）：type=password 掩码 + 眼睛切换明文（切换只翻显示形态，
 *  不动值不落盘）；提交行为与 text 行同内核（bindTextCommit 单源，ARCH-1）。 */
function makeSecretInput(opts: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => string | void;
}): HTMLDivElement {
  const holder = document.createElement('div');
  holder.innerHTML = R.secretInputHtml({ value: opts.value, placeholder: opts.placeholder });
  const input = holder.querySelector('.bz-sp-secret-input') as HTMLInputElement;
  const eye = holder.querySelector('.bz-sp-secret-eye') as HTMLButtonElement;
  bindTextCommit(input, opts.onCommit);
  bindSecretEye(eye, () => {
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    return reveal;
  });
  return holder.firstElementChild as HTMLDivElement;
}

/** 多行掩码输入（TextAreaRow.masked，Cookie 类长串凭据）：保留多行粘贴面（textarea 不换单行
 *  input），打点走 core/ui/components.css 的 .bz-maskarea（-webkit-text-security，textarea
 *  没有 type=password）；眼睛翻 .bz-maskarea--revealed。提交行为与 textarea 行同内核。 */
function makeMaskedArea(opts: {
  value: string;
  placeholder?: string;
}): { holder: HTMLDivElement; ta: HTMLTextAreaElement } {
  const holder = document.createElement('div');
  holder.innerHTML = R.maskedAreaHtml({ value: opts.value, placeholder: opts.placeholder });
  const ta = holder.querySelector<HTMLTextAreaElement>('textarea')!;
  const eye = holder.querySelector<HTMLButtonElement>('.bz-sp-secret-eye')!;
  bindSecretEye(eye, () => {
    const revealed = !ta.classList.contains('bz-maskarea--revealed');
    ta.classList.toggle('bz-maskarea--revealed', revealed);
    return revealed;
  });
  return { holder: holder.firstElementChild as HTMLDivElement, ta };
}

/* ==================== 路径行（共享 chips + 选择按钮） ==================== */

/**
 * 路径行控件区：chips（已选目录，✕ 移除、文本点击重开选择器）+ 选择按钮（空态显示）。
 * 行内 chips 与按钮收编组件库（C-3：uiChip 可删 ✕ 自带 role/aria-label/tabIndex/键盘三件套，
 * uiBtn 出 .bz-btn——注释宣称与实现自此对齐，.bz-sp-chip 自绘族退役）；**弹窗** = core 统一
 * 选择器 openPathPicker（ADR-0061）+ `.bz-sp-skin` 面板皮肤（ADR-0127：全域单一实现，皮肤随宿主）。
 * 行为与 core/path-picker 的 renderPathSettingRow 对齐（ticket 133 形态）：
 * - 空态只显示「选择…/添加…」按钮（无灰字占位 chip）；
 * - 有文件夹 chip（显式值或回落 chip）时按钮移出 DOM，chip 文本点击重开选择器、✕ 清除；
 * - 选择器确定 / ✕ 移除后统一回调 onChange（支持返回 Promise 改写）。
 */
export function makePathRowCtrl(opts: {
  name: string;
  mode: 'single' | 'multi';
  value: string | string[];
  pickerTitle?: string;
  pickerDesc?: string;
  buttonText?: string;
  okText?: string;
  /** 绑定值为空时的回落展示 chip（锁定态，仅显示实际生效目录不落盘；点击重开选择器可改显式值） */
  fallbackChip?: string;
  onChange: (list: string[]) => void | string[] | Promise<void | string[]>;
}): HTMLElement {
  const readValue = (): string[] => {
    const v = opts.value;
    return Array.isArray(v) ? [...v] : v ? [v] : [];
  };
  let current = readValue();

  const ctrl = document.createElement('div');
  ctrl.className = 'bz-sp-chips';

  /** 统一变更入口：onChange 返回 Promise 时异步解析改写清单后重渲染；同步返回（含 void）立即重渲染 */
  const apply = (list: string[]): void | Promise<void> => {
    const res = opts.onChange(list);
    if (res && typeof (res as { then?: unknown }).then === 'function') {
      return Promise.resolve(res as Promise<void | string[]>).then((final) => {
        current = Array.isArray(final) ? final : list;
        renderChips();
      });
    }
    current = Array.isArray(res) ? res : list;
    renderChips();
  };

  const openPicker = () => {
    const multiMode = opts.mode === 'multi';
    // 弹窗走 core 统一路径选择器（ADR-0061）——全域单一实现，⚙️ 设置页 / 各域设置弹窗 /
    // 附件搬移命令 / 本面板同一套 DOM 与行为；面板内观感由 .bz-sp-skin 皮肤类就近覆写（ADR-0127）
    openPathPicker({
      title: (multiMode ? '添加文件夹 · ' : '选择文件夹 · ') + (opts.pickerTitle || opts.name),
      desc: opts.pickerDesc,
      mode: multiMode ? 'multi' : 'single',
      selected: current,
      okText: opts.okText || (multiMode ? '添加所选' : '选用'),
      skinClassName: 'bz-sp-skin',
      onConfirm: (list) => {
        void apply(list);
      },
    });
  };

  const multi = opts.mode === 'multi';
  const addBtn = uiBtn({
    label: opts.buttonText || (multi ? '添加…' : '选择…'),
    className: 'bz-sp-path-btn',
    onClick: openPicker,
  });

  const renderChips = () => {
    // 重渲前清旧 chip（.bz-chip 契约类——uiChip 收编 C-3；旧值残留即双 chip 缺陷）
    ctrl.querySelectorAll('.bz-chip').forEach((c) => c.remove());
    // 回落 chip（可选）：绑定值为空时展示「实际生效目录」锁定态 chip（不可移除；点击重开选择器改显式值）
    if (!current.length && opts.fallbackChip) {
      ctrl.appendChild(uiChip({
        label: opts.fallbackChip,
        locked: true,
        title: '未单独设置时的实际生效目录（点击可改为显式设置）',
        onClick: openPicker,
      }));
    }
    for (const path of current) {
      const label = path === '' ? '（库根目录）' : path;
      ctrl.appendChild(uiChip({
        label,
        title: label,
        removable: multi,
        // ✕ 移除（uiChip 自带 role=button/aria-label/tabIndex/Enter-Space 键盘三件套）；
        // 文本点击重开选择器（✕ 点击 stopPropagation 不连锁）
        onRemove: multi ? () => { void apply(current.filter((p) => p !== path)); } : undefined,
        onClick: openPicker,
      }));
    }
    const empty = !current.length && !opts.fallbackChip;
    // 空态只显示「选择…/添加…」按钮（「未设置/未选择」灰字 chip 已退役——2026-09-08 拍板）
    if (empty) {
      if (!addBtn.isConnected) ctrl.appendChild(addBtn);
    } else {
      addBtn.remove();
    }
  };
  ctrl.appendChild(addBtn);
  renderChips();
  return ctrl;
}

/* ==================== 行渲染 ==================== */

/** 文本/数字/多行文本行行内附加按钮：先插按钮再插输入框（2026-09-08 拍板：按钮在左、输入框右缘对齐；
 *  issue 330 起 textarea 行同口径）。onClick 传当前输入值，完成后重读绑定回填显示（不置脏）+
 *  刷新显隐——供「填入/回填」类动作 */
function mountTextActions(
  ctrlEl: HTMLElement,
  input: HTMLInputElement | HTMLTextAreaElement,
  acc: { read: () => unknown },
  actions: Array<{ text: string; cta?: boolean; onClick: (value: string | undefined, ctx: SettingsRowContext) => void | Promise<void> }> | undefined,
  ctx: SettingsRowContext,
  refresh: () => void
): void {
  for (const a of actions ?? []) {
    const holder = document.createElement('div');
    holder.innerHTML = R.rowBtnHtml(a.text, a.cta);
    const btn = holder.firstElementChild as HTMLElement;
    btn.addEventListener('click', () => {
      void (async () => {
        await a.onClick(input.value, ctx);
        displaySetters.get(input)?.(String(acc.read() ?? ''));
        refresh();
      })();
    });
    ctrlEl.appendChild(btn);
  }
}

/** 渲染单行（返回行元素；isChild 仅挂 child 语义类，样式不缩进——issue 186 全部行左缘对齐）。
 *  入参放宽为 SettingsRow | SecretRow（GS3 密钥型档位经 secretRow() 收口进联合，
 *  运行时 type 'secret' 由 case 'secret' 单点消费——见 SecretRow 注） */
function renderRow(
  row: SettingsRow | SecretRow,
  refresh: () => void,
  regRefresh?: (fn: () => void) => void
): HTMLElement {
  // 行骨架单源（R.rowHtml 逐字原型 rowEl 结构：info 区/custom 插槽/cards 容器 + data-key 定位契约）
  const rowName = (row as { name?: string }).name;
  const bindKey = (row as { binding?: { key?: string } }).binding?.key;
  const isCustom = row.type === 'custom';
  const isCardsRow = row.type === 'choiceCards';
  const holder = document.createElement('div');
  holder.innerHTML = R.rowHtml({
    key: bindKey || rowName || '',
    cls: [
      (row as { isChild?: boolean }).isChild ? 'child' : '',
      // 列表行 = 面板行宿主 modifier（名称/描述一行在上，列表占满行宽在下；缺它条目会横铺进右侧控件区）
      row.type === 'list' ? 'bz-sp-set-row--list' : '',
    ].filter(Boolean).join(' ') || undefined,
    isCards: isCardsRow,
    isCustom,
    name: rowName,
    desc: (row as { desc?: string }).desc,
    note: (row as { note?: string }).note,
  });
  const el = holder.firstElementChild as HTMLElement;
  const ctx = makeCtx(el, refresh);
  // 行上下文的 rowEl 即本行元素（switch 内 custom 分支渲染插槽时已可用）
  (ctx as { rowEl: HTMLElement }).rowEl = el;
  // 控件区：普通行 = .bz-sp-set-ctrl；cards 行 = .bz-sp-set-cards；custom 行 = 整行插槽占满
  const ctrlEl = (isCustom
    ? el
    : el.querySelector<HTMLElement>(isCardsRow ? '.bz-sp-set-cards' : '.bz-sp-set-ctrl')) as HTMLElement;

  switch (row.type) {
    case 'toggle': {
      const acc = bindValue<boolean>(row.binding as unknown as RowBinding<boolean>);
      // 开关结构单源（R.toggleHtml 逐字原型），行为绑定留本层
      ctrlEl.innerHTML = R.toggleHtml(acc.read() === true);
      const sw = ctrlEl.querySelector<HTMLElement>('.bz-sw')!;
      sw.addEventListener('click', () => {
        const v = !sw.classList.contains('on');
        // 先写后翻 UI（H5）：写入抛错（三函数逃生口）时不翻开关只提示，避免显示值与实际值背离
        try {
          acc.write(v);
        } catch (e) {
          notifyWriteError(e);
          return;
        }
        sw.classList.toggle('on', v);
        sw.setAttribute('aria-checked', String(v));
        motionSwitchFlip(sw, v); // 动效：拨杆按弹 + 到位微光（旋钮滑行归 CSS transition）
        safePersist(() => acc.persist(), rowName || '开关设置'); // N5 兜底（ARCH-1 单源）
        row.onChange?.(v, ctx);
        refresh();
      });
      break;
    }
    case 'text': {
      const acc = bindValue<string>(row.binding as unknown as RowBinding<string>);
      const ph = typeof row.placeholder === 'function' ? row.placeholder(snapshot()) : row.placeholder;
      // 行级 onCommit 一次性提示（H1：与 core 渲染器同语义，CommitWarn 内核单源 ARCH-1）
      const warn = new CommitWarn(String(acc.read() ?? ''), (row as { onCommit?: () => void }).onCommit);
      const input = makeInput({
        value: acc.read() ?? '',
        mono: !!(row as { mono?: boolean }).mono,
        num: !!(row as { num?: boolean }).num,
        placeholder: ph,
        inputMode: row.inputMode,
        onCommit: (v) => {
          acc.write(v);
          motionInputSaved(input); // 动效：入槽一呼吸（提交落盘确认，轻到不打断输入流）
          safePersist(() => acc.persist(), rowName || '文本设置'); // N5 兜底（ARCH-1 单源）
          row.onChange?.(v, ctx);
          warn.fire(v);
          refresh(); // C-2：值驱动 visibleWhen 的子行跟随（core 渲染器 commit 点 reevaluate 同口径）
        },
      });
      mountTextActions(ctrlEl, input, acc, (row as { actions?: unknown }).actions as never, ctx, refresh);
      ctrlEl.appendChild(input);
      // refreshKey 联动：任意行变更（含 aiProvider 切换）后重读显示值写回输入框（不落盘）
      regRefreshDisplay(regRefresh, row.refreshKey, input);
      break;
    }
    case 'secret': {
      // 密钥型行（GS3，呈报#48；2026-09-23 类型收编进 core 联合）：password 掩码 + 眼睛切换
      // 明文；提交链 / refreshKey / actions 全走 text 行同内核
      const sec = row as SecretRow;
      const acc = bindValue<string>(sec.binding as unknown as RowBinding<string>);
      const input = makeSecretInput({
        value: String(acc.read() ?? ''),
        placeholder: typeof sec.placeholder === 'function' ? sec.placeholder(snapshot()) : sec.placeholder,
        onCommit: (v) => {
          acc.write(v);
          motionInputSaved(input.querySelector('.bz-sp-secret-input') as HTMLInputElement); // 动效：入槽（密钥提交同皮同反馈）
          safePersist(() => acc.persist(), rowName || '密钥设置'); // N5 兜底（ARCH-1 单源）
          sec.onChange?.(v, ctx);
          refresh(); // C-2：值驱动 visibleWhen 的子行跟随（text 行 commit 点同口径）
        },
      });
      // 行内附加按钮（text 行同口径，渲染于输入框左侧）：B站 Cookie 那种「从 CLI 导入」不再
      // 只能挂在多行行上——密钥行也能带动作
      mountTextActions(ctrlEl, input.querySelector('.bz-sp-secret-input') as HTMLInputElement, acc, sec.actions, ctx, refresh);
      ctrlEl.appendChild(input);
      // refreshKey 联动（text 行同口径）：任意行变更后重读显示值写回输入框（不落盘）
      regRefreshDisplay(regRefresh, sec.refreshKey, input.querySelector('.bz-sp-secret-input') as HTMLInputElement);
      break;
    }
    case 'textarea': {
      const acc = bindValue<string>(row.binding as unknown as RowBinding<string>);
      // 掩码档位（Cookie 类长串凭据）：保留多行粘贴面，外壳换成「多行 + 打点 + 眼睛」；
      // 提交链与普通多行完全同内核，只是挂载的是外壳（holder）而不是裸 textarea
      const masked = row.masked === true;
      const holder = document.createElement('div');
      let ta: HTMLTextAreaElement;
      let ctrl: HTMLElement;
      if (masked) {
        const m = makeMaskedArea({ value: acc.read() ?? '', placeholder: row.placeholder });
        ta = m.ta;
        ctrl = m.holder;
      } else {
        holder.innerHTML = R.textareaHtml(acc.read() ?? '', row.placeholder);
        ta = holder.firstElementChild as HTMLTextAreaElement;
        ctrl = ta;
      }
      // 行级 onCommit 一次性提示（H1：备忘录「自定义场景列表」memoReloadScenes 即 textarea 行钩子）
      const warn = new CommitWarn(String(acc.read() ?? ''), (row as { onCommit?: () => void }).onCommit);
      let timer: number | null = null;
      let dirty = false; // refreshKey 程序化写值不置脏（防 blur 假写覆盖，同 makeInput）
      const commit = () => {
        if (timer !== null) window.clearTimeout(timer);
        if (!dirty) return;
        acc.write(ta.value);
        motionInputSaved(ta); // 动效：入槽一呼吸（多行文本提交同皮同反馈）
        safePersist(() => acc.persist(), rowName || '多行文本设置'); // N5 兜底（ARCH-1 单源）
        warn.fire(ta.value);
        refresh(); // C-2：值驱动 visibleWhen 的子行跟随（core commit 点 reevaluate 同口径）
      };
      ta.addEventListener('input', () => {
        dirty = true;
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(commit, TEXT_COMMIT_DELAY);
      });
      ta.addEventListener('blur', commit);
      // 程序化写值入口（动作回填 / refreshKey 联动共用；清 dirty 防 blur 假写覆盖，同 makeInput）
      displaySetters.set(ta, (v: string) => {
        dirty = false;
        if (ta.value !== v) ta.value = v;
      });
      // refreshKey 联动：任意行变更后重读显示值写回（不落盘）
      if (regRefresh && row.refreshKey !== undefined) {
        const ref = row.refreshKey;
        regRefresh(() => {
          const snap = snapshot();
          const fresh = typeof ref === 'function' ? ref(snap) : String((snap as any)[ref]);
          displaySetters.get(ta)?.(String(fresh ?? ''));
        });
      }
      // 行内附加按钮在左（issue 330，同 text 行拍板口径）——多行控件最后插入
      mountTextActions(ctrlEl, ta, acc, row.actions, ctx, refresh);
      ctrlEl.appendChild(ctrl);
      break;
    }
    case 'number': {
      const acc = bindValue<number>(row.binding as unknown as RowBinding<number>);
      const ph = typeof row.placeholder === 'function' ? row.placeholder(snapshot()) : row.placeholder;
      // 行级 onCommit 一次性提示（H1：与 core 渲染器同语义；fire 用原始输入值，同 core last 口径）
      const warn = new CommitWarn(String(acc.read() ?? ''), (row as { onCommit?: () => void }).onCommit);
      const input = makeInput({
        value: String(acc.read() ?? ''),
        type: 'number',
        num: true,
        placeholder: ph,
        min: row.min,
        max: row.max,
        onCommit: (raw) => {
          // 空串不写不删键（对齐 core 渲染器 parseClampedNumber 空→null→不写语义）：
          // 显式「0」才触发删键回落默认（见 setProviderValue 0=删键）；空串仅清显示
          if (raw.trim() === '') return;
          // R9 口径对齐 core（parseClampedNumber 内核单源 ARCH-1）：非空非法输入不写入——
          // 回显生效旧值（返回值经 makeInput 回写输入框），不再 NaN→0 意外改写绑定
          const v = parseClampedNumber(raw, row.min, row.max);
          if (v === null) {
            motionInputReject(input); // 动效：卡簧弹回（校验拒绝——摇头 + 红晕一闪）
            return String(acc.read() ?? '');
          }
          acc.write(v);
          // 动效：钳制回显 = 规整轻弹（值被修正到位）；原样写入 = 入槽一呼吸
          if (String(v) !== raw.trim()) motionInputAdjust(input);
          else motionInputSaved(input);
          safePersist(() => acc.persist(), rowName || '数字设置'); // N5 兜底（ARCH-1 单源）
          row.onChange?.(v, ctx);
          warn.fire(raw);
          refresh(); // C-2：值驱动 visibleWhen 的子行跟随
          // 钳制值 ≠ 输入原文 → 回显钳制值（core R9 同口径：显示值不再 ≠ 落盘值）
          return String(v) !== raw.trim() ? String(v) : undefined;
        },
      });
      (input as HTMLInputElement).step = String(row.step ?? 1);
      mountTextActions(ctrlEl, input, acc, row.actions as never, ctx, refresh);
      ctrlEl.appendChild(input);
      // refreshKey 联动：任意行变更（含 aiProvider 切换）后重读显示值写回输入框（不落盘）
      regRefreshDisplay(regRefresh, row.refreshKey, input);
      break;
    }
    case 'select': {
      const acc = bindValue<string>(row.binding as unknown as RowBinding<string>);
      /** 选项求值（issue 411/ADR-0179）：静态数组原样，函数形式随快照重取——思考档位随
       *  「AI 服务商」切换换表（档位词表是 provider 属性，固定五档会把不生效的档摆给用户） */
      const readOptions = (): SelectOption[] =>
        typeof row.options === 'function' ? row.options(snapshot()) : row.options;
      const optSigOf = (opts: SelectOption[]): string => opts.map((o) => o.value).join('\u0001');
      /** 应显示值：绑定值不在选项内（空/历史遗留档位）→ 回落首项（同 core 渲染器口径） */
      const displayValue = (opts: SelectOption[]): string => {
        const v = String(acc.read() ?? '');
        return opts.some((o) => o.value === v) ? v : (opts[0]?.value ?? '');
      };

      let vspan: HTMLElement | null = null;
      /** 上一次挂载的收尾（重建前释放 document 监听与 ESC 层，防切换服务商时监听堆叠） */
      let teardown: (() => void) | null = null;

      const mount = (): void => {
        teardown?.();
        teardown = null;
        const options = readOptions();
        // 下拉结构单源（R.selectTriggerHtml 触发器 + R.selectItemHtml 菜单项；旋转样式 styles.css .bz-select-car 单源）。
        // UI-1/UI-2（对齐 core uiSelect 范式）：触发器带 tabindex/aria-expanded 可键盘聚焦，
        // Enter/Space/↑↓ 开合菜单、菜单内 ↑↓ 移高亮 Enter 提交；ESC 经 escManager 层先收菜单不关面板。
        const labelOf = (v: string) => (options.find((o) => o.value === v) || { label: v }).label;
        ctrlEl.innerHTML = R.selectTriggerHtml(labelOf(displayValue(options)));
        const sel = ctrlEl.querySelector('.bz-select') as HTMLElement;
        vspan = sel.querySelector('.bz-select-val')!;

        let group: HTMLElement | null = null;
        let docH: ((ev: MouseEvent) => void) | null = null;
        let docTimer: ReturnType<typeof setTimeout> | null = null;
        let escLayer: ReturnType<typeof escManager.register> | null = null;

        const closeMenu = () => {
          sel.querySelector('.bz-select-menu')?.remove();
          sel.setAttribute('aria-expanded', 'false');
          if (escLayer) {
            escLayer.unregister();
            escLayer = null;
          }
          // 组卡 overflow 还原前查本组是否还有打开的菜单（H4）：A 的 closeMenu 冒泡末段
          // 若无条件还原会把 B 刚设的 visible 抹掉，B 菜单被组卡裁剪
          if (group && !group.querySelector('.bz-select-menu')) {
            group.style.overflow = '';
            group.style.zIndex = '';
          }
          // 挂起的外点监听定时器一并撤（开合过快时它会在收菜单之后才把监听挂上去）
          if (docTimer !== null) {
            clearTimeout(docTimer);
            docTimer = null;
          }
          if (docH) document.removeEventListener('click', docH);
        };
        // 重建/换表前的收尾：摘挂起的 document 监听定时器 + 收菜单 + 摘已挂的监听
        // （DOM 由下一次 innerHTML 覆盖；不摘干净会在切服务商时堆叠监听）
        teardown = () => {
          if (docTimer !== null) {
            clearTimeout(docTimer);
            docTimer = null;
          }
          closeMenu();
          docH = null;
        };

        /** 菜单内高亮移动（键盘 ↑↓；is-on + aria-selected 同步，焦点保持在触发器上） */
        const moveHighlight = (delta: number) => {
          const items = [...sel.querySelectorAll<HTMLElement>('.bz-select-item')];
          if (!items.length) return;
          const curIdx = items.findIndex((it) => it.classList.contains('is-on'));
          const nextIdx = Math.min(items.length - 1, Math.max(0, (curIdx < 0 ? 0 : curIdx) + delta));
          items.forEach((it, i) => {
            const on = i === nextIdx;
            it.classList.toggle('is-on', on);
            it.setAttribute('aria-selected', String(on));
          });
        };

        /** 选项落盘统一入口（先写后翻 H5 + persist N5 兜底 ARCH-1；点击与键盘提交同路径） */
        const applyOption = (o: { value: string }) => {
          try {
            acc.write(o.value);
          } catch (e) {
            notifyWriteError(e);
            closeMenu();
            return;
          }
          closeMenu();
          vspan!.textContent = labelOf(o.value);
          motionSelectPick(sel); // 动效：旋钮位提亮一拍 + 箭头回弹（菜单本体不加动效——用户拍板）
          safePersist(() => acc.persist(), rowName || '下拉设置');
          row.onChange?.(o.value, ctx);
          refresh();
        };

        const openMenu = () => {
          if (sel.querySelector('.bz-select-menu')) return;
          // 组卡 overflow:hidden 会裁剪伸出的菜单——展开期间放开并提层
          group = sel.closest<HTMLElement>('.bz-sp-group');
          if (group) { group.style.overflow = 'visible'; group.style.zIndex = '10'; }
          const menu = document.createElement('div');
          menu.className = 'bz-select-menu';
          menu.setAttribute('role', 'listbox');
          const curNow = displayValue(options);
          menu.innerHTML = options.map((o) => R.selectItemHtml(o.label, o.value === curNow)).join('');
          menu.querySelectorAll<HTMLElement>('.bz-select-item').forEach((it) => it.classList.add('bz-touch-target--lg')); // UI-4：30px 菜单项热区抬档
          menu.querySelectorAll('.bz-select-item').forEach((it, i) => {
            const o = options[i];
            it.addEventListener('click', (ev) => {
              ev.stopPropagation();
              applyOption(o);
            });
          });
          sel.appendChild(menu);
          sel.setAttribute('aria-expanded', 'true');
          mountIcons(menu); // 菜单项勾标占位物化
          docH = (ev: MouseEvent) => {
            if (!sel.contains(ev.target as Node)) closeMenu();
          };
          // 延后一拍挂监听（本次点击同拍不误关）；重建时经 teardown 撤掉挂起定时器
          docTimer = setTimeout(() => {
            if (docH) document.addEventListener('click', docH);
          });
          // ESC 收菜单走 escManager 层序（UI-1，core uiSelect 同款）：开着菜单按 ESC 先收菜单不关
          // 面板（层命中后 stopImmediatePropagation 短路面板层）；焦点不在触发器上（纯鼠标流）同样可收
          escLayer = escManager.register('bz-ui-select', {
            isVisible: () => !!sel.querySelector('.bz-select-menu'),
            close: () => closeMenu(),
          });
        };

        sel.addEventListener('click', () => {
          if (sel.querySelector('.bz-select-menu')) closeMenu();
          else openMenu();
        });
        sel.addEventListener('keydown', (e) => {
          const menu = sel.querySelector('.bz-select-menu');
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (menu) {
              // 菜单开着：提交当前高亮项（无高亮则仅收起）
              const items = [...menu.querySelectorAll<HTMLElement>('.bz-select-item')];
              const idx = items.findIndex((it) => it.classList.contains('is-on'));
              if (idx >= 0) applyOption(options[idx]);
              else closeMenu();
            } else {
              openMenu();
            }
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            // 内层导航语义（UI-2）：下拉聚焦时 ↑↓ 移菜单高亮，不冒泡给面板 ↑↓ 切域（onNavKey）
            e.stopPropagation();
            if (!menu) openMenu();
            moveHighlight(e.key === 'ArrowDown' ? 1 : -1);
          }
        });
      };

      mount();
      let optSig = optSigOf(readOptions());
      // 联动刷新（issue 411/ADR-0179）：选项集变了 → 整只下拉重建（换表）；否则只回填当前值（不落盘）
      if (regRefresh && (row.refreshKey !== undefined || typeof row.options === 'function')) {
        regRefresh(() => {
          const opts = readOptions();
          const sig = optSigOf(opts);
          if (sig !== optSig) {
            optSig = sig;
            mount();
            return;
          }
          if (vspan) vspan.textContent = (opts.find((o) => o.value === displayValue(opts)) || { label: '' }).label;
        });
      }
      break;
    }
    case 'slider': {
      const acc = bindValue<number>(row.binding as unknown as RowBinding<number>);
      // 滑杆结构单源（R.sliderHtml：range + 轻量读数 span），行为留本层
      const cur = acc.read() ?? row.min ?? 0;
      ctrlEl.innerHTML = R.sliderHtml(row.min, row.max, row.step ?? 1, cur);
      const range = ctrlEl.querySelector('input[type="range"]') as HTMLInputElement;
      const em = ctrlEl.querySelector('.bz-sp-slider-val')!;
      range.addEventListener('input', () => {
        em.textContent = range.value;
        const v = Number(range.value);
        acc.write(v);
        safePersist(() => acc.persist(), rowName || '滑条设置'); // N5 兜底（ARCH-1 单源；拖动高频触发，写盘走 saveQueue 串行安全）
        row.onChange?.(v, ctx);
        refresh(); // C-2：值驱动 visibleWhen 同步切换（core slider onChange reevaluate 同口径）
      });
      // 行内附加按钮（滑条右侧，如「试听」）
      for (const a of row.actions ?? []) {
        const holder = document.createElement('div');
        holder.innerHTML = R.rowBtnHtml(a.text, a.cta);
        const btn = holder.firstElementChild as HTMLElement;
        btn.addEventListener('click', () => void a.onClick(undefined, ctx));
        ctrlEl.appendChild(btn);
      }
      break;
    }
    case 'path': {
      const acc = bindValue<string | string[]>(row.binding as unknown as RowBinding<string | string[]>);
      const multi = row.mode === 'multi';
      const fallbackFn = (row as { fallbackValue?: () => string }).fallbackValue;
      // 行级 onCommit 一次性提示（H1：与 core 渲染器 path 分支同口径——清单 JSON 串比较）
      const onCommit = (row as { onCommit?: () => void }).onCommit;
      const initRaw = acc.read();
      const warn = new CommitWarn(
        multi ? JSON.stringify(initRaw ?? []) : String(initRaw ?? ''),
        onCommit
      );
      ctrlEl.appendChild(makePathRowCtrl({
        name: row.name,
        mode: row.mode,
        value: multi
          ? Array.isArray(acc.read())
            ? [...(acc.read() as string[])]
            : []
          : String(acc.read() ?? ''),
        pickerTitle: row.pickerTitle,
        pickerDesc: row.pickerDesc,
        buttonText: row.buttonText,
        okText: row.okText,
        fallbackChip: typeof fallbackFn === 'function' ? fallbackFn() : '',
        onChange: (list) => {
          const v = multi ? list : (list[0] || '').trim().replace(/^\/+|\/+$/g, '');
          acc.write(v as string | string[]);
          safePersist(() => acc.persist(), rowName || '路径设置'); // N5 兜底（ARCH-1 单源）
          // 回调在落盘后触发（原口径）；返回清单（含异步解析结果）回传 path 行作 chips 渲染口径——
          // 异步否决场景的落盘改写由回调自行负责（如外部 binding 自管写盘）
          const res = row.onChange?.(list, ctx);
          warn.fire(multi ? JSON.stringify(v) : String(v));
          refresh(); // C-2：值驱动 visibleWhen 的子行跟随（core path onChange reevaluate 同口径）
          if (res && typeof (res as { then?: unknown }).then === 'function') {
            return Promise.resolve(res as Promise<void | string[]>).then(
              (final) => (Array.isArray(final) ? final : list)
            );
          }
          return Array.isArray(res) ? res : undefined;
        },
      }));
      break;
    }
    case 'button': {
      // 按钮结构单源（R.rowBtnHtml：bz-sp-btn；cta → accent 实底）
      ctrlEl.innerHTML = R.rowBtnHtml(row.buttonText, row.cta);
      const b2 = ctrlEl.querySelector('.bz-sp-btn')!;
      b2.addEventListener('click', () => row.onClick(ctx));
      break;
    }
    case 'info': {
      // 徽标结构单源（R.badgeHtml）；actions 在场时附操作按钮
      ctrlEl.innerHTML = R.badgeHtml(row.name);
      for (const a of row.actions ?? []) {
        const holder = document.createElement('div');
        holder.innerHTML = R.rowBtnHtml(a.text, a.cta);
        const btn = holder.firstElementChild as HTMLElement;
        btn.addEventListener('click', () => void a.onClick(undefined, ctx));
        ctrlEl.appendChild(btn);
      }
      break;
    }
    case 'list': {
      // 通用列表行：条目 markup/行为 = 组件库 uiSetlist（唯一源，与 core 渲染器同调）；
      // items 函数形式在每次移除后重读重建（域侧以磁盘/字盒为基底），空数组回退 emptyText
      const renderItems = () => {
        const items = typeof row.items === 'function' ? row.items() : row.items;
        ctrlEl.innerHTML = '';
        ctrlEl.appendChild(uiSetlist({
          items,
          variant: (row as { variant?: 'rows' | 'grid' | 'chips' | 'dense' }).variant,
          removeLabel: row.removeLabel,
          emptyText: row.emptyText,
          onRemove: (key) => {
            void (async () => {
              const cur = (typeof row.items === 'function' ? row.items() : row.items).map((x) => x.key);
              try {
                await row.onChange?.(cur.filter((k) => k !== key), ctx);
              } catch (e) {
                // F-3（与 core 渲染器 C10 同口径，内核单源 ARCH-1）：移除回调抛错 → 人话提示，
                // refresh 照跑（列表按 items() 重读，不停在已删假象；原先 unhandled rejection 无提示）
                notifySaveError(e, rowName || '列表项');
              } finally {
                refresh(); // 经 refreshKey 链重读重建（含本行）——与添加同路径
              }
            })();
          },
        }));
      };
      renderItems();
      // 列表行随任意行变更重读重建（添加按钮/输入提交后即时可见；否则要重开弹窗——2026-09-12 修）
      regRefresh?.(renderItems);
      break;
    }
    case 'choiceCards': {
      // 卡组结构单源（R.cardpickHtml：bz-sp-cardpick 卡 = mini 预览 + 名称；空值回退首个选项同 select 口径）。
      // options.layout + layoutKey：布局绑定的主题行只渲当前布局配套的单卡——主题不通用（拍板）。
      const acc = bindValue<string>(row.binding as unknown as RowBinding<string>);
      const layoutKey = (row as { layoutKey?: string }).layoutKey;
      const curLayout = layoutKey ? String((snapshot() as any)[layoutKey] ?? '') : '';
      let opts2 = row.options.filter((o) => {
        const lo = (o as { layout?: string }).layout;
        return !lo || !layoutKey || lo === curLayout;
      });
      // 布局值与主题 options 全不匹配（如存量脏值/换版后布局值退役）→ 回退全量 options（H10），
      // 防主题行渲染成空白卡组
      if (!opts2.length) opts2 = row.options;
      const cur = String(acc.read() ?? '') || (opts2[0] && opts2[0].value) || '';
      ctrlEl.innerHTML = R.cardpickHtml(opts2.map((o) => ({
        value: o.value,
        label: o.label,
        on: o.value === cur,
        prevClass: o.prevClass,
      })));
      const wrap = ctrlEl.querySelector('.bz-sp-cardpick')!;
      wrap.querySelectorAll<HTMLElement>('.bz-sp-cardpick-card').forEach((c) => {
        c.addEventListener('click', () => {
          // 先写后翻 UI（H5）：写入抛错时不切换选中态只提示
          try {
            acc.write(c.dataset.spCard ?? '');
          } catch (e) {
            notifyWriteError(e);
            return;
          }
          wrap.querySelectorAll('.is-on').forEach((x) => {
            x.classList.remove('is-on');
            x.setAttribute('aria-checked', 'false');
          });
          c.classList.add('is-on');
          c.setAttribute('aria-checked', 'true'); // UI-2：radio 选中态同步播报
          motionCardChoose(c); // 动效：选卡按实 + 提亮一拍
          safePersist(() => acc.persist(), rowName || '卡片设置'); // N5 兜底（ARCH-1 单源）
          row.onChange?.(c.dataset.spCard ?? '', ctx);
          refresh();
        });
      });
      break;
    }
    case 'custom': {
      // custom 行：内容插槽自带标题/描述（各域 new Setting().setName/setDesc），面板不再渲染 info 区
      // （否则标题描述两遍）；插槽直接占满整行，custom 内容（含原生 Setting 行）渲染进插槽，
      // 原生设置行在面板内同样被自绘容器包裹（视觉由本面板容器收敛）。
      const slot = document.createElement('div');
      slot.className = 'bz-sp-custom-slot bz-sp-custom-slot--full';
      el.appendChild(slot);
      try {
        row.render(slot, ctx);
      } catch (e) {
        notice(`自定义设置行渲染失败：${e instanceof Error ? e.message : String(e)}`, 'error');
      }
      // 行级 name/desc 在场时移除内层原生 Setting 的 info 区（AI 模型名称行等内外两层同名同描述——
      // 留面板层 info，标题/描述只出一遍；clipbook 等行级无 name 的 custom 不受影响）
      if (rowName || (row as { desc?: string }).desc) {
        slot.querySelectorAll('.setting-item-info').forEach((n) => n.remove());
      }
      // custom 行 onRefresh：与 core 渲染器对齐（模型行等切 provider 后联动刷新内部输入框显示值）
      if (regRefresh && (row as { onRefresh?: (c: SettingsRowContext) => void }).onRefresh) {
        const onRefresh = (row as { onRefresh: (c: SettingsRowContext) => void }).onRefresh;
        regRefresh(() => onRefresh(ctx));
      }
      break;
    }
    default:
      break;
  }
  return el;
}

/** 渲染整组（分组卡结构单源 R.groupCardHtml：图标块 + 名称 + 项数徽标；行渲染见 renderRow）。
 *  rows 放宽收 SecretRow（GS3；与 renderRow 同口径，见 SecretRow 注） */
function renderGroup(
  container: HTMLElement,
  group: { name: string; icon?: string; rows: (SettingsRow | SecretRow)[] },
  refresh: () => void,
  regRefresh?: (fn: () => void) => void
): HTMLElement {
  const cardHolder = document.createElement('div');
  // 项数徽标：动态计算（可见非 button 行数；button 行是操作行不计数，与 ⚙️ 弹窗 refreshSettingsGroupCounts 口径一致）
  cardHolder.innerHTML = R.groupCardHtml(group.icon, group.name, `${group.rows.length} 项`);
  const card = cardHolder.firstElementChild as HTMLElement;
  const count = card.querySelector('.bz-sp-group-count') as HTMLElement;

  const body = card.querySelector('.bz-sp-group-body') as HTMLElement;
  const rowEls: HTMLElement[] = [];
  group.rows.forEach((r) => {
    const rowEl = renderRow(r, refresh, regRefresh);
    rowEls.push(rowEl);
    body.appendChild(rowEl);
  });
  container.appendChild(card);

  /** 重算项数徽标：排除隐藏行（含 group 整体隐藏时恒 0）与 button 操作行 */
  const updateCount = () => {
    const groupHidden = card.style.display === 'none' || card.classList.contains('bz-sp-hidden');
    let n = 0;
    if (!groupHidden) {
      group.rows.forEach((r, i) => {
        if (r.type === 'button') return; // 操作行不计
        const el = rowEls[i];
        if (el && el.style.display !== 'none') n++;
      });
    }
    count.textContent = `${n} 项`;
    // 功能性显隐（铁律 8 允许）：0 项组隐藏徽标（对齐 ⚙️ 弹窗 refreshSettingsGroupCounts）
    count.style.display = n > 0 ? '' : 'none';
  };
  groupCountUpdaters.set(card, updateCount);
  updateCount();
  return card;
}

/** 分组项数徽标重算回调（renderGroup 挂入；refresh 内统一执行） */
const groupCountUpdaters = new WeakMap<HTMLElement, () => void>();

/**
 * 渲染 schema 到容器（与 ⚙️ 同数据源）。
 * visibleWhen 求值：false 的行/组挂 display none（含组级 visibleWhen，如移动端组桌面隐藏）；
 * isChild 行只参与显隐联动，不缩进（issue 186）。
 * 显隐条件用 WeakMap 存函数引用（不可序列化，避免 new Function 脆弱方案）。
 * 返回 { refresh }（重求值显隐）。
 */
export function renderPanelSchema(container: HTMLElement, schema: SettingsSchema): { refresh: () => void } {
  const visibleConditions = new WeakMap<HTMLElement, (s: SettingsSnapshot) => boolean>();
  // refreshKey 联动：登记「任意行变更后重读显示值」的回调（refresh 内统一执行，不落盘）
  const valueRefreshes: Array<() => void> = [];
  /** 显隐求值 + 应用（H6：visibleWhen 抛错视为可见——与 ui.ts visibleItemCount 同口径，
   *  单行求值异常不得中断整轮显隐/徽标/refreshKey 联动） */
  const applyCond = (el: HTMLElement, cond: (s: SettingsSnapshot) => boolean): void => {
    let visible = true;
    try {
      visible = cond(snapshot());
    } catch {
      /* 求值异常视为可见 */
    }
    el.style.display = visible ? '' : 'none';
  };
  const refresh = () => {
    container.querySelectorAll<HTMLElement>('[data-sp-row]').forEach((el) => {
      const cond = visibleConditions.get(el);
      if (!cond) return;
      applyCond(el, cond);
    });
    container.querySelectorAll<HTMLElement>('[data-sp-group]').forEach((el) => {
      const cond = visibleConditions.get(el);
      if (!cond) return;
      applyCond(el, cond);
    });
    // 行/组显隐变化后重算各分组项数徽标（动态计算；button 操作行与隐藏行不计）
    container.querySelectorAll<HTMLElement>('.bz-sp-group').forEach((card) => {
      groupCountUpdaters.get(card)?.();
    });
    // refreshKey：重读绑定值写回已渲染输入框（如 per-provider 输入随 aiProvider 切换联动）
    for (const fn of valueRefreshes) fn();
  };

  schema.groups.forEach((g) => {
    const card = renderGroup(container, g, refresh, (fn) => valueRefreshes.push(fn));
    card.dataset.spGroup = g.name;
    // 组级 visibleWhen 门控：false 整组隐藏（F-4：初始求值走 applyCond 容错——单行异常保守可见，
    // 不放大成整域「加载失败」，与 refresh 链 H6 口径归一）
    const groupVw = (g as { visibleWhen?: (s: SettingsSnapshot) => boolean }).visibleWhen;
    if (groupVw) {
      card.dataset.spGroupCond = '1';
      visibleConditions.set(card, groupVw);
      applyCond(card, groupVw);
    }
    // isChild 联动（H2，比照 core 渲染器 ticket 170 口径）：本组首个键直绑 toggle = 组级父项，
    // 所有 isChild 行跟随它显隐——与行自身 visibleWhen 取与；父项为外部绑定（无 key）不联动。
    const parentToggleKey = (
      g.rows.find(
        (pr) => pr.type === 'toggle' && typeof (pr.binding as { key?: string } | undefined)?.key === 'string'
      ) as { binding: { key: string } } | undefined
    )?.binding.key ?? null;
    g.rows.forEach((r, i) => {
      const rowEl = card.querySelectorAll('.bz-sp-set-row')[i] as HTMLElement | undefined;
      if (!rowEl) return;
      let vw = (r as { visibleWhen?: (s: SettingsSnapshot) => boolean }).visibleWhen;
      if ((r as { isChild?: boolean }).isChild && parentToggleKey) {
        const parentKey: string = parentToggleKey;
        const selfVw = vw;
        vw = (snap: SettingsSnapshot) =>
          (snap as unknown as Record<string, unknown>)[parentKey] === true &&
          (selfVw ? selfVw(snap) : true);
      }
      if (vw) {
        rowEl.dataset.spRow = String(i);
        visibleConditions.set(rowEl, vw);
        applyCond(rowEl, vw); // F-4：初始求值容错同 refresh（异常保守可见）
      }
    });
  });

  // 纯层串里的 <i data-lucide> 占位统一物化（组卡图标/下拉箭头/菜单勾标等）
  mountIcons(container);
  return { refresh };
}

/** 强制收起 root 内全部自绘下拉菜单（UI-1 纵深）：hide/cleanup 等非常规关闭路径不经
 *  closeMenu，菜单 DOM 与组卡提层样式（overflow/zIndex）残留会在重开面板时「复活」——
 *  此处兜底摘菜单 + 还原组卡样式。 */
export function closeAllSelectMenus(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.bz-select').forEach((sel) => {
    if (!sel.querySelector('.bz-select-menu')) return;
    sel.querySelector('.bz-select-menu')?.remove();
    sel.setAttribute('aria-expanded', 'false');
    const group = sel.closest<HTMLElement>('.bz-sp-group');
    if (group && !group.querySelector('.bz-select-menu')) {
      group.style.overflow = '';
      group.style.zIndex = '';
    }
  });
}

/** 重算 root 内全部分组卡「N 项」徽标（UI-6）：搜索过滤/恢复后与实际可见行数同步，
 *  口径与渲染器 refresh 链同一 updateCount（排除隐藏行与 button 操作行）。 */
export function refreshGroupCounts(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.bz-sp-group').forEach((card) => {
    groupCountUpdaters.get(card)?.();
  });
}

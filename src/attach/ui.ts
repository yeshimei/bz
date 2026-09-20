/**
 * 附件搬移域——UI 层（统一路径选择器 + 可勾选清单预览 + 执行编排）。
 * 自绘 DOM 弹窗（铁律 3/9：bz- 前缀类名，样式收敛在根 styles.css）；不依赖 obsidian Modal。
 * ticket 128（ADR-0061）：原 FolderSelectModal（运行时单选弹窗 + 手输输入框）退役，目标文件夹
 * 经 core 统一路径选择器（core/path-picker，卡片弹窗 + 搜索选择）录入；保留 attachLastFolder
 * 记忆语义（选择器初始高亮上次文件夹）与「（库根目录）」空串语义（dest '' = 移动到 vault 根）。
 * 移动与全库链接更新走 Obsidian 内建 `app.fileManager.renameFile`（ADR-0014，自动更新内部链接，
 * 避免 v1 自研全库扫描 + 逐个 modify 导致的大库卡顿）。
 * 增强包（2026-09 拍板）：
 * - 选择器前置收集：进选择器前先收集附件，desc 标注「当前笔记引用 N 个附件」；
 *   0 个附件直接提示并终止，不弹选择器。
 * - 预览升级可勾选清单：确认预览从纯数字（openFlowDialog）升级为组件库 uiModal 自绘小弹窗，
 *   逐行 from→to + 复选框默认全选，可排除个别不想动的附件。
 * - 大批量进度：附件 ≥10 个用 core notice 的 progress 形态逐个更新「i/N」。
 * - 撤销搬移：成功后 notifyUndo，点击「撤销」逆序 renameFile 回原路径（链接由 Obsidian 内建自动回改）。
 * 深审修复批（2026-09，bz-fix-at-core）：
 * - ARCH-1：收集语义对齐 encrypt「cache 为主 + 正则兜底」范式（collectForNote）——
 *   metadataCache 天然不含代码块内引用（AF-1 根治）；cache 缺失退化正则兜底（同口径剥段）。
 * - EFF-1/SUG-1：动线一次收集（前置→确认→执行透传 MoveScan），不再三次全量重算。
 * - AF-3/UI-P3-2：失败明细数据结构（failedOps）+ 部分失败 notifyActionError+onRetry +
 *   全失败/部分失败/消失件口径分级。
 * - AF-4/UX-1/UI-P3-1/ARCH-2：命令入口非 md 前置拦截（与右键菜单 md-only 统一）+
 *   预览弹窗防叠开 + runMove 防并行。
 * - UI-P3-3/AC-2：链接更新宣称按执行结果 gate（0 成功不宣称）。
 * - UI-P3-4/EFF-4：撤销搬移大批量同款 i/N progress。
 * - EFF-3/SUG-2：预览弹窗 requestClose 脏关闭拦截（belongings 同款）。
 * - EFF-2：全选/全不选工具条 + 大清单渲染护栏（RENDER_LIMIT，未渲染行不丢勾选语义）。
 * - EFF-5：批量执行 progress 帧「中止」出口（已移动部分照常出汇总 + 撤销）。
 * - AC-1：用户可见文案「资源/资源文件」→「附件」，destLabel 引号形制统一。
 * - ARCH-3：getSettings?.() 假防御改 tryGetSettings + BzSettings 类型（settings-provider 契约）。
 * - ARCH-5：dest 归一化 normalizeDest 单源。
 */
import { notice, notify, notifyUndo, notifyActionError } from '../core/notice';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { openPathPicker } from '../core/path-picker';
import { uiModal, uiDialogActions } from '../core/ui';
import { bindFormSubmit } from '../core/ui/modal';
import { confirmDiscard } from '../core/flow-dialog';
import { emitDomainEvent } from '../core/domain-bus';
import type BzSettings from '../settings';
import { collectResources, collectResourcesCached, planMoves, type MoveOp } from './data';

/** 大批量阈值：附件数 ≥ 此值时用 progress 通知逐个更新 i/N */
const PROGRESS_MIN = 10;
/**
 * 预览清单渲染护栏（对齐 core path-picker LIMIT=300 先例，EFF-2）：只渲染前 300 行，
 * 超量行尾部提示——勾选语义不静默截断（未渲染行视为默认勾选照常提交，见 excluded 排除集）。
 */
const RENDER_LIMIT = 300;

/** 当前打开笔记；无则 null */
function getActiveNote(app: any): any | null {
  return app?.workspace?.getActiveFile?.() ?? null;
}

/**
 * vault 全部文件路径清单，含文件夹路径（AT1 常态口径：planMoves 冲突集含文件夹——
 * 目标下同名子文件夹同样会让 renameFile 抛错，规划期即避让改名；顺带消除
 * 「正常环境只有文件 / 回退环境混入文件夹」的口径分裂）。
 * getFiles 缺失的异常环境回退 getAllLoadedFiles（本就含文件 + 文件夹）。
 */
function listAllFilePaths(app: any): string[] {
  if (typeof app?.vault?.getFiles === 'function') {
    const files: string[] = (app.vault.getFiles() || []).map((f: any) => f.path);
    for (const f of app.vault.getAllLoadedFiles?.() || []) {
      if (f?.path && (f.isFolder || f.children)) files.push(f.path);
    }
    return files;
  }
  return (app?.vault?.getAllLoadedFiles?.() || []).map((f: any) => f.path);
}

/** 目标文件夹归一化单源（ARCH-5）：trim + 去首尾斜杠；空串 = 库根目录 */
function normalizeDest(dest: string): string {
  return (dest || '').trim().replace(/^\/+|\/+$/g, '');
}

/**
 * 收集笔记引用的附件（ARCH-1 对齐 encrypt「cache 为主 + 正则兜底」范式，ui.ts:collectNoteAttachmentPaths 同构）：
 * metadataCache.getFileCache 的 embeds/links/frontmatterLinks 为主——真机 cache 天然不含
 * 代码块内引用（AF-1 根治）；cache 未索引/读取失败退化正则兜底（collectResources 内部
 * 同口径剥段 + AF-2 大小写不敏感档，功能不降级）。
 */
function collectForNote(app: any, note: any, content: string, allFiles: string[]): string[] {
  try {
    const cache = app?.metadataCache?.getFileCache?.(note);
    if (cache) {
      const links: string[] = [];
      for (const e of cache.embeds || []) if (e && typeof e.link === 'string') links.push(e.link);
      for (const l of cache.links || []) if (l && typeof l.link === 'string') links.push(l.link);
      for (const l of cache.frontmatterLinks || []) if (l && typeof l.link === 'string') links.push(l.link);
      return collectResourcesCached(links, allFiles, note.path);
    }
  } catch (e) {
    /* 缓存读取失败退化为正则兜底 */
  }
  return collectResources(content, allFiles, note.path);
}

/** 失败明细（AF-3/UI-P3-2）：哪几个失败 + 分型（消失件与 renameFile 抛错口径分开） */
export interface MoveFailure {
  /** 计划的源路径 */
  fromPath: string;
  /** true = 执行时源文件已不存在（消失件）；false = renameFile 抛错 */
  missing: boolean;
}

export interface MoveSummary {
  moved: number;
  renamed: number;
  /** 是否走了 fileManager（自动更新内部链接） */
  linksAuto: boolean;
  /** 失败明细：仅在确有失败时挂载（0 失败不出场，返回契约向后兼容） */
  failedOps?: MoveFailure[];
  /** 用户在批量执行中点了「中止」（EFF-5）：仅中止且无成功的场合单独研判，有成功时并入 summary */
  aborted?: boolean;
}

/**
 * 动线扫描结果（EFF-1/SUG-1）：前置收集一次，选择器/预览/执行三段透传复用——
 * 原实现前置、确认、执行三次全量 read+collect（大库三倍开销），拍板收敛为动线一次。
 */
export interface MoveScan {
  /** 前置收集的附件路径集 */
  resources: string[];
  /** 扫描时的 vault 全路径清单（planMoves 冲突集，含文件夹） */
  allFiles: string[];
}

/** 批量执行防重入（UI-P3-1/ARCH-2）：runMove 并行时后入者提示并拒绝（renameFile 序列不竞争） */
let moveInFlight = false;

/** 失败重试出口（AF-3）：对失败项重跑 runMove（planMoves 幂等：已在目标的自动跳过） */
function retryMove(app: any, note: any, dest: string, fromPaths: string[]): () => void {
  return () => void runMove(app, note, dest, fromPaths);
}

/** 部分失败明细呈现（AF-3/UI-P3-2）：notifyActionError + onRetry 范式；消失件分型「已不存在」 */
function reportFailures(app: any, note: any, dest: string, failedOps: MoveFailure[]): void {
  const missing = failedOps.filter((f) => f.missing);
  const errored = failedOps.filter((f) => !f.missing);
  const parts: string[] = [];
  if (errored.length) parts.push(`${errored.length} 个移动出错（如 ${errored[0].fromPath}）`);
  if (missing.length) parts.push(`${missing.length} 个源文件已不存在`);
  notifyActionError(new Error(parts.join('；')), '附件搬移', {
    onRetry: retryMove(app, note, dest, failedOps.map((f) => f.fromPath)),
  });
}

/**
 * 执行附件搬移：移动当前笔记附件到目标文件夹（仅同名冲突才改名）。
 * 经 `app.fileManager.renameFile` 移动并自动更新全库内部链接（Obsidian 内建）；
 * 无 fileManager（异常环境）回退 `vault.rename`（不更新链接，warning 通知）。
 * dest 允许空串 = 库根目录（与文件夹选择器「（库根目录）」选项一致，P20 修复自相矛盾——
 * 可选却提交被拒；根目录场景 dest 为空时直接移动到 vault 根）。
 * only（可选）：fromPath 白名单——可勾选清单排除个别附件后只移动勾选项；不传 = 全量移动。
 * scan（可选，EFF-1）：动线前置扫描结果透传（命令动线独占；缺省 = 自行收集，供直调兼容）。
 */
export async function runMove(app: any, note: any, destFolder: string, only?: string[], scan?: MoveScan): Promise<MoveSummary | null> {
  if (moveInFlight) {
    notice('附件搬移进行中，请稍候', 'warning');
    return null;
  }
  moveInFlight = true;
  const dest = normalizeDest(destFolder);
  try {
    const allFiles = scan?.allFiles ?? listAllFilePaths(app);
    const resources = scan?.resources ?? collectForNote(app, note, await app.vault.read(note), allFiles);
    if (resources.length === 0) {
      notice('当前笔记没有可移动的附件', 'info');
      return null;
    }
    let moves = planMoves(resources, dest, allFiles);
    if (only) {
      const allow = new Set(only);
      moves = moves.filter((m) => allow.has(m.fromPath));
    }
    if (moves.length === 0) {
      notice(only ? '未勾选任何要移动的附件' : '附件已全部在目标文件夹', 'info');
      return null;
    }

    // 仅非根目录需要建目录；根目录（''）必然存在
    if (dest && !app.vault.getAbstractFileByPath(dest)) await app.vault.createFolder(dest);
    const fmRename = app?.fileManager?.renameFile;
    const movedOps: MoveOp[] = [];
    const failedOps: MoveFailure[] = [];
    // 大批量进度反馈：≥ PROGRESS_MIN 个用 progress 形态逐个更新「i/N」（常驻通知，循环不再像卡死）
    const prog = moves.length >= PROGRESS_MIN ? notify(`正在移动附件 0/${moves.length}`, { type: 'progress' }) : null;
    // 中止出口（EFF-5）：progress 帧挂「中止」，循环每轮检查——已移动部分照常出汇总 + 撤销
    let aborted = false;
    prog?.setAction({ label: '中止', onClick: () => { aborted = true; } });
    for (let i = 0; i < moves.length; i++) {
      if (aborted) break;
      const m = moves[i];
      prog?.setMessage(`正在移动附件 ${i + 1}/${moves.length}`);
      prog?.setProgress(Math.round(((i + 1) / moves.length) * 100));
      const f = app.vault.getAbstractFileByPath(m.fromPath);
      if (!f) {
        failedOps.push({ fromPath: m.fromPath, missing: true }); // 消失件分型（UI-P3-2）
        continue;
      }
      try {
        if (fmRename) await fmRename.call(app.fileManager, f, m.toPath);
        else await app.vault.rename(f, m.toPath);
        movedOps.push(m); // 仅记录成功者（撤销只回滚真正移动过的）
      } catch (e) {
        failedOps.push({ fromPath: m.fromPath, missing: false });
        console.warn('[附件搬移] 移动失败:', m.fromPath, e);
      }
    }
    prog?.hide();

    // 记忆上次文件夹（持久化设置字段，不入设置页；写失败静默——便利记忆不阻断搬移）
    const settings = tryGetSettings() as BzSettings;
    if (settings) {
      settings.attachLastFolder = dest;
      try {
        await saveSettings();
      } catch (e) {
        /* 失败静默 */
      }
    }

    const linksAuto = !!fmRename;
    const renamedCount = movedOps.filter((m) => m.renamed).length;
    const failed = failedOps.length;
    const destLabel = dest || '库根目录';
    // 全失败 / 全中止（0 成功）分支（AC-2/UI-P3-3 文案 gate）：不宣称链接已更新，专用文案如实；
    // 全失败挂「重试」出口（AF-3），全中止为用户主动行为挂 info 即可
    if (movedOps.length === 0) {
      if (aborted) {
        notice(`附件搬移已中止：0/${moves.length} 个移动（原文件未改动）`, 'info');
        return null;
      }
      notify(`附件搬移失败：0/${moves.length} 个移动成功（原文件未改动）`, {
        type: 'error',
        action: { label: '重试', onClick: retryMove(app, note, dest, moves.map((m) => m.fromPath)) },
      });
      return null;
    }
    // 成功数口径（P2）：moved = 实际成功数（movedOps），通知文案与实际一致；
    // linkTail 仅在确有成功时宣称（UI-P3-3 gate），部分失败/中止追加如实尾缀
    const failTail = failed ? `，失败 ${failed} 个` : '';
    const abortTail = aborted ? '，已中止' : '';
    const linkTail = linksAuto ? '，内部链接已自动更新' : '，链接未自动更新';
    const summaryMsg = `已移动 ${movedOps.length} 个附件到「${destLabel}」，改名 ${renamedCount} 个${linkTail}${failTail}${abortTail}`;
    // 撤销搬移（误搬兜底）：点击「撤销」逆序 renameFile 回原路径，链接由 Obsidian 内建自动回改
    notifyUndo(summaryMsg, () => void undoMove(app, movedOps), { type: 'restore' });
    // AF-3：部分失败明细 + 重试出口（与撤销钮并存——撤销是误搬兜底、重试是补救，语义不冲突）
    if (failed) reportFailures(app, note, dest, failedOps);
    // 行为流（issue 261）：搬移成功入小橘行为流（attach:moved，带实际成功数）
    emitDomainEvent('attach', { kind: 'moved', count: movedOps.length });
    const summary: MoveSummary = { moved: movedOps.length, renamed: renamedCount, linksAuto };
    if (failed) summary.failedOps = failedOps;
    if (aborted) summary.aborted = true;
    return summary;
  } catch (e) {
    console.error('[附件搬移] 失败:', e);
    notice('附件搬移失败，已中止（原文件未改动）', 'error');
    return null;
  } finally {
    moveInFlight = false;
  }
}

/**
 * 撤销搬移：逆序把已移动的附件 renameFile 回原路径（后移的先搬回，防同名冲突号回退错位）；
 * 链接更新由 Obsidian 内建 renameFile 自动完成。逐个容错：失败的计数的 warning 提示。
 * 大批量与正向搬移对称的 progress 形态（UI-P3-4/EFF-4）：≥ PROGRESS_MIN 时「正在撤销 i/N」。
 */
async function undoMove(app: any, ops: MoveOp[]): Promise<void> {
  const fmRename = app?.fileManager?.renameFile;
  let failed = 0;
  const prog = ops.length >= PROGRESS_MIN ? notify(`正在撤销 0/${ops.length}`, { type: 'progress' }) : null;
  let done = 0;
  for (let i = ops.length - 1; i >= 0; i--) {
    const m = ops[i];
    done++;
    prog?.setMessage(`正在撤销 ${done}/${ops.length}`);
    prog?.setProgress(Math.round((done / ops.length) * 100));
    try {
      const f = app.vault.getAbstractFileByPath(m.toPath);
      if (!f) {
        failed++;
        continue;
      }
      if (fmRename) await fmRename.call(app.fileManager, f, m.fromPath);
      else await app.vault.rename(f, m.fromPath);
    } catch (e) {
      failed++;
      console.warn('[附件搬移] 撤销失败:', m.toPath, e);
    }
  }
  prog?.hide();
  if (failed) notice(`撤销未完成：${failed} 个附件未能回到原位置（原位置可能已被占用）`, 'warning');
  else notice(`已撤销搬移，${ops.length} 个附件回到原位置`, 'success');
}

/**
 * 可勾选移动清单预览（组件库 uiModal 自绘小弹窗）：逐行 from→to + 复选框默认全选，
 * 可排除个别不想动的附件；按钮/弹窗壳走组件库（uiModal/uiDialogActions），
 * 域 styles.css 只做清单行布局。
 * - 键盘确认（UI-P2-1/AF-S1）：bindFormSubmit 接 Ctrl/⌘+Enter 直提（0 勾选 no-op）。
 * - requestClose 脏关闭拦截（EFF-3/SUG-2，belongings 同款）：有取消勾选项时 ESC/遮罩先弹放弃确认。
 * - 全选/全不选工具条 + 大清单渲染护栏（EFF-2）：勾选状态以「排除集」单源（未渲染行默认勾选），
 *   渲染截断不丢行语义；提交集合按排除集反向推导。
 * scan（可选，EFF-1）：透传给 runMove，执行段不再重收集。
 */
export function openMovePreview(app: any, note: any, dest: string, moves: MoveOp[], scan?: MoveScan): void {
  const destLabel = dest || '库根目录';
  const renamedCount = moves.filter((m) => m.renamed).length;

  const body = document.createElement('div');
  body.className = 'bz-attach-preview';

  const sum = document.createElement('div');
  sum.className = 'bz-attach-preview-sum';
  sum.textContent = `将移动 ${moves.length} 个附件到「${destLabel}」${renamedCount ? `，${renamedCount} 个将改名（目标已有同名文件）` : ''}`;
  body.appendChild(sum);

  const hint = document.createElement('div');
  hint.className = 'bz-attach-preview-hint';
  hint.textContent = '移动后全库引用这些附件的链接会自动更新；不想动的附件可取消勾选。';
  body.appendChild(hint);

  // 勾选状态单源 = 被排除集（EFF-2 渲染护栏配套）：只渲染前 RENDER_LIMIT 行建 DOM，
  // 未渲染行视为默认勾选照常提交——勾选语义不因渲染截断而静默丢行
  const excluded = new Set<string>();
  const list = document.createElement('div');
  list.className = 'bz-attach-preview-list';
  let rendered = 0;
  for (const m of moves) {
    if (rendered >= RENDER_LIMIT) break; // 超量行不建 DOM（尾部提示行说明全量口径）
    rendered++;
    const row = document.createElement('label');
    row.className = 'bz-attach-preview-row';
    row.dataset.from = m.fromPath;
    row.dataset.to = m.toPath;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'bz-attach-preview-check';
    box.value = m.fromPath;
    box.checked = true; // 默认全选：只排除个别不想动的
    box.addEventListener('change', () => {
      if (box.checked) excluded.delete(m.fromPath);
      else excluded.add(m.fromPath);
      syncOk();
    });
    const fromEl = document.createElement('span');
    fromEl.className = 'bz-attach-preview-from';
    fromEl.textContent = m.fromPath;
    fromEl.title = m.fromPath;
    const arrow = document.createElement('span');
    arrow.className = 'bz-attach-preview-arrow';
    arrow.textContent = '→';
    const toEl = document.createElement('span');
    toEl.className = 'bz-attach-preview-to';
    toEl.textContent = m.toPath;
    toEl.title = m.toPath;
    if (m.renamed) {
      toEl.classList.add('bz-attach-preview-to--renamed');
      const badge = document.createElement('span');
      badge.className = 'bz-badge bz-badge--warning bz-attach-preview-badge';
      badge.textContent = '将改名';
      row.appendChild(box);
      row.appendChild(fromEl);
      row.appendChild(arrow);
      row.appendChild(toEl);
      row.appendChild(badge);
    } else {
      row.appendChild(box);
      row.appendChild(fromEl);
      row.appendChild(arrow);
      row.appendChild(toEl);
    }
    list.appendChild(row);
  }
  body.appendChild(list);
  if (moves.length > RENDER_LIMIT) {
    const more = document.createElement('div');
    more.className = 'bz-attach-preview-more';
    more.textContent = `已显示前 ${RENDER_LIMIT} 个（共 ${moves.length} 个附件），其余默认勾选并将一并移动`;
    body.appendChild(more);
  }

  // 全选/全不选（EFF-2）：排除集整体清空/填充 + 已渲染行 DOM 同步
  const tools = document.createElement('div');
  tools.className = 'bz-attach-preview-tools';
  const mkToggle = (label: string, check: boolean): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-attach-preview-toggle';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (check) {
        excluded.clear();
      } else {
        for (const m of moves) excluded.add(m.fromPath);
      }
      for (const box of list.querySelectorAll<HTMLInputElement>('.bz-attach-preview-check')) box.checked = check;
      syncOk();
    });
    return btn;
  };
  tools.appendChild(mkToggle('全选', true));
  tools.appendChild(mkToggle('全不选', false));
  body.appendChild(tools);

  let okBtnRef: HTMLButtonElement | null = null;
  // 键盘确认执行体（AF-S1）：复用确认钮唯一入口，0 勾选（disabled）时为 no-op
  const doMove = (): void => {
    if (!okBtnRef || okBtnRef.disabled) return;
    okBtnRef.click();
  };
  // close 句柄先声明后赋值（requestClose/onOk 闭包异步触发时已就绪）
  let closePreview: () => void = () => {};

  const actions = uiDialogActions({
    okText: `移动 ${moves.length} 个`,
    onOk: () => {
      const only = moves.filter((m) => !excluded.has(m.fromPath)).map((m) => m.fromPath);
      closePreview();
      void runMove(app, note, dest, only, scan);
    },
    onCancel: () => closePreview(),
  });
  okBtnRef = actions.okBtn;
  actions.okBtn.id = 'bz-attach-preview-ok';
  const syncOk = (): void => {
    const n = moves.length - excluded.size;
    actions.okBtn.disabled = n === 0;
    const label = actions.okBtn.querySelector('span') || actions.okBtn;
    label.textContent = `移动 ${n} 个`;
  };

  const { popup, close } = uiModal({
    content: body,
    maxWidth: 480,
    head: true, // 标题头行保留；✕ 已在 core uiModal 退役（issue 271：点遮罩/ESC 关闭）
    title: '移动附件',
    className: 'bz-attach-preview-pop',
    // EFF-3/SUG-2 脏关闭拦截（belongings requestCloseBelForm 同款）：有取消勾选项时
    // ESC/遮罩先弹放弃确认，零勾选改动直关
    requestClose: () => {
      if (excluded.size > 0) confirmDiscard(() => closePreview());
      else closePreview();
    },
  });
  closePreview = close;
  // 键盘确认（UI-P2-1/AF-S1）：Ctrl/⌘+Enter 恒提交，对齐 flow-dialog「回车=确认」范式
  bindFormSubmit(popup, doMove);
  body.appendChild(actions.row);
}

/** 命令入口：当前笔记 → 前置收集附件数（0 个直接提示终止）→ 统一路径选择器选目标文件夹（记忆上次 attachLastFolder → 初始高亮）→ 可勾选清单预览 → 执行 */
export function moveAttachments(app: any, noteOverride?: any): void {
  void (async () => {
    // 防重入（UI-P3-1/ARCH-2）：预览弹窗存活不叠开（DOM 判定，belongings openForm 先例）
    if (document.querySelector('.bz-attach-preview-pop')) {
      notice('移动清单已打开，请先确认或关闭', 'info');
      return;
    }
    if (moveInFlight) {
      notice('附件搬移进行中，请稍候', 'warning');
      return;
    }
    const note = noteOverride || getActiveNote(app);
    if (!note) {
      notice('没有打开的笔记', 'warning');
      return;
    }
    // 入口口径统一（AF-4/UX-1）：附件搬移语义是「笔记引用的附件」，非 md 活动文件
    // 与右键菜单 md-only 同口径前置拦截（原先守卫只在右键菜单侧）
    if (note.extension !== 'md') {
      notice('附件搬移适用于 Markdown 笔记，请在笔记上运行', 'info');
      return;
    }
    try {
      // 前置收集（EFF-1/SUG-1）：动线一次计算，结果向选择器/预览/执行三段透传
      const allFiles = listAllFilePaths(app);
      const noteContent = await app.vault.read(note);
      const resources = collectForNote(app, note, noteContent, allFiles);
      if (resources.length === 0) {
        notice('当前笔记没有可移动的附件', 'info');
        return;
      }
      // 记忆上次文件夹（attachLastFolder 持久化设置字段，不入设置页）：选择器初始高亮
      const settings = tryGetSettings() as BzSettings;
      const last = normalizeDest((settings && settings.attachLastFolder) || '');
      openPathPicker({
        title: '选择目标文件夹',
        mode: 'single',
        // 确认键用选择器缺省「下一步」（两段式：选目录 → 下一步看清单）
        desc: `当前笔记引用 ${resources.length} 个附件，选好目标文件夹后进入移动清单确认（同名冲突自动改名，全库引用链接自动更新）`,
        selected: last ? [last] : [],
        onConfirm: (list) => {
          const dest = normalizeDest(list[0] || '');
          try {
            // EFF-1：复用前置扫描结果规划（原确认段/执行段各重收集一遍，收敛为动线一次）
            const moves = planMoves(resources, dest, allFiles);
            if (moves.length === 0) {
              notice('附件已全部在目标文件夹', 'info');
              return;
            }
            openMovePreview(app, note, dest, moves, { resources, allFiles });
          } catch (e) {
            console.error('[附件搬移] 预览失败:', e);
            notice('附件搬移失败，已中止（原文件未改动）', 'error');
          }
        },
      });
    } catch (e) {
      console.error('[附件搬移] 失败:', e);
      notice('附件搬移失败，已中止（原文件未改动）', 'error');
    }
  })();
}

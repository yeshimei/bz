/**
 * 附件搬移域——UI 层（统一路径选择器 + 可勾选清单预览 + 执行编排）。
 * 自绘 DOM 弹窗（铁律 3/9：bz- 前缀类名，样式收敛在根 styles.css）；不依赖 obsidian Modal。
 * ticket 128（ADR-0061）：原 FolderSelectModal（运行时单选弹窗 + 手输输入框）退役，目标文件夹
 * 经 core 统一路径选择器（core/path-picker，卡片弹窗 + 搜索选择）录入；保留 attachLastFolder
 * 记忆语义（选择器初始高亮上次文件夹）与「（库根目录）」空串语义（dest '' = 移动到 vault 根）。
 * 移动与全库链接更新走 Obsidian 内建 `app.fileManager.renameFile`（ADR-0014，自动更新内部链接，
 * 避免 v1 自研全库扫描 + 逐个 modify 导致的大库卡顿）。
 * 增强包（2026-09 拍板）：
 * - 选择器前置收集：进选择器前先 collectResources，desc 标注「当前笔记引用 N 个附件」；
 *   0 个附件直接提示并终止，不弹选择器。
 * - 预览升级可勾选清单：确认预览从纯数字（openFlowDialog）升级为组件库 uiModal 自绘小弹窗，
 *   逐行 from→to + 复选框默认全选，可排除个别不想动的附件。
 * - 大批量进度：附件 ≥10 个用 core notice 的 progress 形态逐个更新「i/N」。
 * - 撤销搬移：成功后 notifyUndo，点击「撤销」逆序 renameFile 回原路径（链接由 Obsidian 内建自动回改）。
 */
import { notice, notify, notifyUndo } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { openPathPicker } from '../core/path-picker';
import { uiModal, uiDialogActions } from '../core/ui';
import { collectResources, planMoves, type MoveOp } from './data';

/** 大批量阈值：附件数 ≥ 此值时用 progress 通知逐个更新 i/N */
const PROGRESS_MIN = 10;

/** 当前打开笔记；无则 null */
function getActiveNote(app: any): any | null {
  return app?.workspace?.getActiveFile?.() ?? null;
}

/** vault 全部文件路径清单（getFiles 缺失的异常环境回退 getAllLoadedFiles） */
function listAllFilePaths(app: any): string[] {
  return (app.vault.getFiles?.() || app.vault.getAllLoadedFiles?.() || []).map((f: any) => f.path);
}

export interface MoveSummary {
  moved: number;
  renamed: number;
  /** 是否走了 fileManager（自动更新内部链接） */
  linksAuto: boolean;
}

/**
 * 执行附件搬移：移动当前笔记附件到目标文件夹（仅同名冲突才改名）。
 * 经 `app.fileManager.renameFile` 移动并自动更新全库内部链接（Obsidian 内建）；
 * 无 fileManager（异常环境）回退 `vault.rename`（不更新链接，warning 通知）。
 * dest 允许空串 = 库根目录（与文件夹选择器「（库根目录）」选项一致，P20 修复自相矛盾——
 * 可选却提交被拒；根目录场景 dest 为空时直接移动到 vault 根）。
 * only（可选）：fromPath 白名单——可勾选清单排除个别附件后只移动勾选项；不传 = 全量移动。
 */
export async function runMove(app: any, note: any, destFolder: string, only?: string[]): Promise<MoveSummary | null> {
  const dest = (destFolder || '').trim().replace(/^\/+|\/+$/g, '');
  try {
    const allFiles = listAllFilePaths(app);
    const noteContent = await app.vault.read(note);
    const resources = collectResources(noteContent, allFiles, note.path);
    if (resources.length === 0) {
      notice('当前笔记没有可移动的资源文件', 'info');
      return null;
    }
    let moves = planMoves(resources, dest, allFiles);
    if (only) {
      const allow = new Set(only);
      moves = moves.filter((m) => allow.has(m.fromPath));
    }
    if (moves.length === 0) {
      notice(only ? '未勾选任何要移动的附件' : '资源已全部在目标文件夹', 'info');
      return null;
    }

    // 仅非根目录需要建目录；根目录（''）必然存在
    if (dest && !app.vault.getAbstractFileByPath(dest)) await app.vault.createFolder(dest);
    const fmRename = app?.fileManager?.renameFile;
    const movedOps: MoveOp[] = [];
    // 大批量进度反馈：≥ PROGRESS_MIN 个用 progress 形态逐个更新「i/N」（常驻通知，循环不再像卡死）
    const prog = moves.length >= PROGRESS_MIN ? notify(`正在移动附件 0/${moves.length}`, { type: 'progress' }) : null;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      prog?.setMessage(`正在移动附件 ${i + 1}/${moves.length}`);
      prog?.setProgress(Math.round(((i + 1) / moves.length) * 100));
      const f = app.vault.getAbstractFileByPath(m.fromPath);
      if (!f) continue;
      try {
        if (fmRename) await fmRename.call(app.fileManager, f, m.toPath);
        else await app.vault.rename(f, m.toPath);
        movedOps.push(m); // 仅记录成功者（撤销只回滚真正移动过的）
      } catch (e) {
        console.warn('[附件搬移] 移动失败:', m.fromPath, e);
      }
    }
    prog?.hide();

    // 记忆上次文件夹（运行时字段，不暴露设置）
    const settings: any = getSettings?.();
    if (settings) {
      settings.attachLastFolder = dest;
      try {
        await saveSettings?.();
      } catch (e) {
        /* 失败静默 */
      }
    }

    const linksAuto = !!fmRename;
    const renamedCount = movedOps.filter((m) => m.renamed).length;
    // 成功数口径（P2）：moved = 实际成功数（movedOps），通知文案与实际一致
    const failed = moves.length - movedOps.length;
    const failTail = failed ? `，失败 ${failed} 个` : '';
    const linkTail = linksAuto ? '，内部链接已自动更新' : '，链接未自动更新';
    const destLabel = dest || '库根目录';
    const summaryMsg = `已移动 ${movedOps.length} 个资源到 ${destLabel}，改名 ${renamedCount} 个${linkTail}${failTail}`;
    if (movedOps.length === 0) {
      notice(summaryMsg, 'error');
      return null;
    }
    // 撤销搬移（误搬兜底）：点击「撤销」逆序 renameFile 回原路径，链接由 Obsidian 内建自动回改
    notifyUndo(summaryMsg, () => void undoMove(app, movedOps), { type: 'restore' });
    return { moved: movedOps.length, renamed: renamedCount, linksAuto };
  } catch (e) {
    console.error('[附件搬移] 失败:', e);
    notice('附件搬移失败，已中止（原文件未改动）', 'error');
    return null;
  }
}

/**
 * 撤销搬移：逆序把已移动的附件 renameFile 回原路径（后移的先搬回，防同名冲突号回退错位）；
 * 链接更新由 Obsidian 内建 renameFile 自动完成。逐个容错：失败的计数的 warning 提示。
 */
async function undoMove(app: any, ops: MoveOp[]): Promise<void> {
  const fmRename = app?.fileManager?.renameFile;
  let failed = 0;
  for (let i = ops.length - 1; i >= 0; i--) {
    const m = ops[i];
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
  if (failed) notice(`撤销未完成：${failed} 个附件未能回到原位置（原位置可能已被占用）`, 'warning');
  else notice(`已撤销搬移，${ops.length} 个附件回到原位置`, 'success');
}

/**
 * 可勾选移动清单预览（组件库 uiModal 自绘小弹窗）：逐行 from→to + 复选框默认全选，
 * 可排除个别不想动的附件；按钮/弹窗壳走组件库（uiModal/uiDialogActions），
 * 域 styles.css 只做清单行布局。
 */
export function openMovePreview(app: any, note: any, dest: string, moves: MoveOp[]): void {
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

  const list = document.createElement('div');
  list.className = 'bz-attach-preview-list';
  const boxes: HTMLInputElement[] = [];
  for (const m of moves) {
    const row = document.createElement('label');
    row.className = 'bz-attach-preview-row';
    row.dataset.from = m.fromPath;
    row.dataset.to = m.toPath;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'bz-attach-preview-check';
    box.value = m.fromPath;
    box.checked = true; // 默认全选：只排除个别不想动的
    boxes.push(box);
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

  const { close } = uiModal({
    content: body,
    maxWidth: 480,
    head: true,
    title: '移动附件',
    className: 'bz-attach-preview-pop',
  });

  const actions = uiDialogActions({
    okText: `移动 ${moves.length} 个`,
    onOk: () => {
      const only = boxes.filter((b) => b.checked).map((b) => b.value);
      close();
      void runMove(app, note, dest, only);
    },
    onCancel: () => close(),
  });
  actions.okBtn.id = 'bz-attach-preview-ok';
  const syncOk = (): void => {
    const n = boxes.filter((b) => b.checked).length;
    actions.okBtn.disabled = n === 0;
    const label = actions.okBtn.querySelector('span') || actions.okBtn;
    label.textContent = `移动 ${n} 个`;
  };
  for (const b of boxes) b.addEventListener('change', syncOk);
  body.appendChild(actions.row);
}

/** 命令入口：当前笔记 → 前置收集附件数（0 个直接提示终止）→ 统一路径选择器选目标文件夹（记忆上次 attachLastFolder → 初始高亮）→ 可勾选清单预览 → 执行 */
export function moveAttachments(app: any, noteOverride?: any): void {
  void (async () => {
    const note = noteOverride || getActiveNote(app);
    if (!note) {
      notice('没有打开的笔记', 'warning');
      return;
    }
    try {
      // 前置收集：进选择器前先知道附件数（0 个不弹选择器）
      const allFiles = listAllFilePaths(app);
      const noteContent = await app.vault.read(note);
      const resources = collectResources(noteContent, allFiles, note.path);
      if (resources.length === 0) {
        notice('当前笔记没有可移动的资源文件', 'info');
        return;
      }
      // 记忆上次文件夹（attachLastFolder 运行时字段）：选择器初始高亮，便于快速重复搬移
      const settings: any = getSettings?.();
      const last = ((settings && settings.attachLastFolder) || '').trim().replace(/^\/+|\/+$/g, '');
      openPathPicker({
        title: '选择目标文件夹',
        mode: 'single',
        // 确认键用选择器缺省「下一步」（两段式：选目录 → 下一步看清单）
        desc: `当前笔记引用 ${resources.length} 个附件，选好目标文件夹后进入移动清单确认（同名冲突自动改名，全库引用链接自动更新）`,
        selected: last ? [last] : [],
        onConfirm: (list) => {
          const dest = (list[0] || '').trim().replace(/^\/+|\/+$/g, '');
          void (async () => {
            try {
              // 确认清单：以选择时的最新状态规划（预览到执行之间笔记可能又变化，执行时还会再校验）
              const files = listAllFilePaths(app);
              const content = await app.vault.read(note);
              const refs = collectResources(content, files, note.path);
              const moves = planMoves(refs, dest, files);
              if (moves.length === 0) {
                notice('资源已全部在目标文件夹', 'info');
                return;
              }
              openMovePreview(app, note, dest, moves);
            } catch (e) {
              console.error('[附件搬移] 预览失败:', e);
              notice('附件搬移失败，已中止（原文件未改动）', 'error');
            }
          })();
        },
      });
    } catch (e) {
      console.error('[附件搬移] 失败:', e);
      notice('附件搬移失败，已中止（原文件未改动）', 'error');
    }
  })();
}

/**
 * 条目级动作 helper（issue 256 随写链路迁入；仅保留宿主仍在用的三件：
 * 跳原文 / 复制双链 / 删除确认。旧编辑面板专属的插卡/滚动/筛选随域退役）。
 * 删除确认分流（ADR-0017）：加密条目永久销毁保险箱密文；普通条目走写层守卫删除。
 * 动作结果经域事件通知宿主（墙），跳转/复制后的面板关闭由调用方负责。
 */
import { notice } from '../../core/notice';
import { openFlowDialog } from '../../core/flow-dialog';
import { getApp } from '../../core/app';
import { emitDomainEvent } from '../../core/domain-bus';
import { stripMdExt } from '../../core/utils';
import { DIARY_DIRECTORY } from '../config';
import { isUnparsedRefusal, isDiaryReadFailure, removeDiaryEntries } from '../store';
import { deleteEncryptedEntry } from '../encrypt';
import type { DiaryEntryLocator } from './dialogs';
import { buildLocatorPredicateFor } from './locator';

/** 条目锚点面：filename（日期串或完整路径）或 filePath（完整路径）二选一；
 *  ADR-0130 起条目即文件，emoji/time 不再参与锚点构造（字段保留兼容旧调用面） */
export interface DiaryAnchorRef {
  filename: string;
  /** 完整 vault 路径（条目文件定位依据） */
  filePath?: string;
  emoji: string;
  time: string;
}

/** 条目所在 md 文件路径（filePath 优先；缺省按顶层 `<日记目录>/<filename>.md` 拼） */
function diaryEntryFilePath(entry: DiaryAnchorRef): string {
  return entry.filePath || `${DIARY_DIRECTORY}/${entry.filename}.md`;
}

/** 跳转日记条目原文（ADR-0130 一目一文件）：直接打开条目文件 */
export async function jumpToDiaryEntry(entry: DiaryAnchorRef): Promise<void> {
  const filePath = diaryEntryFilePath(entry);

  // 检查文件是否存在
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) {
    notice('找不到日记文件');
    return;
  }

  await getApp().workspace.openLinkText(stripMdExt(filePath), '', false, { active: true });
}

/** 复制日记条目的双链引用（`[[条目文件路径不带扩展名]]`） */
export async function copyDiaryLink(entry: DiaryAnchorRef): Promise<void> {
  const link = `[[${stripMdExt(diaryEntryFilePath(entry))}]]`;
  await navigator.clipboard.writeText(link);
  notice(`已复制双链引用：${link}`, 'success');
}

/**
 * 删除确认弹窗（原 entries.showConfirm；加密分支永久销毁密文，普通分支走写层守卫删除）。
 * 删除成功发 diary:entry-deleted（加密为 diary:encrypted-purged）通知宿主刷新；
 * 守卫拒写（磁盘有未解析行）静默——人话通知已由写层发出。
 */
export function showConfirm(loc: DiaryEntryLocator): void {
  const isEncrypted = !!loc.encrypted;
  void openFlowDialog({
    title: '确认删除',
    message: isEncrypted
      ? '确定删除这篇加密日记吗？\n\n此操作不可撤销，密文将从保险库永久销毁。'
      : '确定要删除这篇日记吗？\n\n此操作不可撤销，日记将从笔记中永久删除。',
    actions: [
      { label: '取消', value: 'cancel' },
      // danger（issue 291 评审补）：删除日记是不可撤销的（加密分支还会销毁保险库密文），
      // 主按钮不得高亮——手册 §9/§10 的慎重决策口径
      { label: '删除日记', value: 'ok', cta: true, danger: true },
    ],
  })
    .then(async (v) => {
      if (v !== 'ok') return;
      if (isEncrypted && loc.noteId) {
        // 加密条目：永久删除保险箱密文（ADR-0017）
        await deleteEncryptedEntry(loc.noteId);
        // 动作埋点：加密日记密文销毁（本期无消费者，emit 即可）
        emitDomainEvent('diary:encrypted-purged', { noteId: loc.noteId });
      } else {
        const removed = await removeDiaryEntries(loc.date, await buildLocatorPredicateFor(loc.date, loc), {
          filePath: loc.filePath,
        });
        if (removed === 0) {
          notice('未能在日记数据中定位该条目，没有删除', 'error');
          return;
        }
        // 动作埋点：普通条目删除意图（结构性事实 file-vacated 由 store 在整文件删除时另发）
        emitDomainEvent('diary:entry-deleted', { date: loc.date, time: loc.time, wasEncrypted: false });
      }
      // 删除成功通知带条目标识（review-deep 一致#11：对齐 memo/favorites「已删除X「名」」句式；
      // 日记条目以 日期+时间 标识，删错时可辨认是哪篇）
      notice(`已删除日记「${loc.date} ${loc.time}」`, 'success');
    })
    .catch((err: any) => {
      if (err && (isUnparsedRefusal(err) || isDiaryReadFailure(err))) return; // 守卫拒删/读失败：人话通知已由写层发出
      // P3 审查修复：删除失败必须有人话提示（旧实现 .then 无 .catch，deleteEntry 抛错
      // 成为 unhandled rejection，用户确认后什么都没发生也无从排查）
      notice('删除日记失败：' + (err?.message || err), 'error');
    });
}

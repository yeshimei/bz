/**
 * 复习计划文件树徽标（ticket 16，源码 applyReviewStyles L719-772 移植）
 */
import { FSRS, LADDER_MAX } from './fsrs';

/** 文件树条目上色 + 阶段徽标 */
export function applyReviewStyles(app: any, dataManager: any, file: any): void {
  if (!dataManager || !file) return;
  const item = dataManager.items.find((i: any) => i.filePath === file.path);
  const treeItems = document.querySelectorAll('.tree-item-inner');
  let target: HTMLElement | null = null;
  for (const el of treeItems) {
    if (el.textContent === file.basename || (el as HTMLElement).getAttr?.('data-path') === file.path) {
      target = el as HTMLElement;
      break;
    }
  }
  if (!target) return;

  // 清除旧徽标
  target.querySelectorAll('.review-stage-badge').forEach((b) => b.remove());
  target.style.color = '';

  if (!item) return;

  const fsrs = new FSRS();
  let color = '';
  let badge = '';
  const now = Date.now();

  if (item.completed) {
    color = '#52c41a';
    badge = '✅';
  } else if (item.isOverdue) {
    color = '#ff4757';
    badge = '⚠️';
  } else if (item.phase === 'fsrs' && item.stability && item.lastReviewed) {
    const r = fsrs.R((now - item.lastReviewed) / 86400000, item.stability);
    color = r > 0.8 ? '#52c41a' : r > 0.5 ? '#faad14' : '#ff4757';
    badge = `R${Math.round(r * 100)}%`;
  } else {
    const stage = item.currentStage || 1;
    color = stage <= 3 ? '#1890ff' : stage <= 6 ? '#faad14' : '#52c41a';
    badge = String(stage);
  }

  target.style.color = color;
  const span = document.createElement('span');
  span.className = 'review-stage-badge';
  span.textContent = badge;
  span.style.cssText = `margin-left:6px; font-size:.65rem; color:${color}; border:1px solid ${color}; border-radius:8px; padding:0 5px;`;
  target.appendChild(span);
}

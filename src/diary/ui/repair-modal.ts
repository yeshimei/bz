/**
 * 日记格式体检面板（ADR-0130 重定义；原「解析检测 + 一键修复」随条目文件化退役为只读体检）。
 * 手动驱动：仅经设置面板「日记本」页维护组「日记格式体检」按钮打开；启动不自动触发。
 * 打开即逐文件体检（进度条）→ 汇报清单：
 *  - 旧格式残留（legacy）/ 解析失败（unparsable）/ 属性与文件名不一致（name-mismatch）；
 *  - 每行点击打开文件（不定位行——条目文件小，肉眼即见），修复由用户手工完成（面板不改写任何内容）。
 */
import { createOverlay } from '../../core/dom';
import { escManager } from '../../core/esc-manager';
import { getApp } from '../../core/app';
import { notify } from '../../core/notice';
import { DIARY_DIRECTORY } from '../config';
import { lintEntryFile, LINT_REASON_TEXT, type DiaryLintItem, type DiaryLintReason } from '../repair';

const BATCH_CONCURRENCY = 10;

interface ScannedFile {
  path: string;
  reason: DiaryLintReason | null;
}

function findDirRecursive(node: any, target: string): any | null {
  if (node.path === target) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findDirRecursive(child, target);
      if (found) return found;
    }
  }
  return null;
}

/** 递归收集日记目录下全部 .md（含子目录） */
async function collectDiaryFiles(): Promise<any[]> {
  const app = getApp();
  let dir = app.vault.getAbstractFileByPath(DIARY_DIRECTORY) as any;
  if (!dir || !dir.children) {
    const root = app.vault.getRoot() as any;
    dir = findDirRecursive(root, DIARY_DIRECTORY);
  }
  if (!dir || !dir.children) return [];
  const out: any[] = [];
  const walk = (node: any) => {
    for (const child of node.children ?? []) {
      if (child.children) walk(child); // 子目录递归
      else if (child.extension === 'md') out.push(child);
    }
  };
  walk(dir);
  return out.sort((a: any, b: any) => b.name.localeCompare(a.name));
}

async function runScan(
  isAlive: () => boolean,
  onProgress: (done: number, total: number, fileLabel: string) => void
): Promise<ScannedFile[]> {
  const app = getApp();
  const mdFiles = await collectDiaryFiles();
  const total = mdFiles.length;
  const scanned: ScannedFile[] = [];
  for (let i = 0; i < mdFiles.length; i += BATCH_CONCURRENCY) {
    if (!isAlive()) return scanned;
    const batch = mdFiles.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (file: any, idx: number) => {
        const content = await app.vault.read(file);
        if (isAlive()) onProgress(Math.min(i + idx + 1, total), total, file.name);
        return { path: file.path, reason: lintEntryFile(file.path, content) };
      })
    );
    scanned.push(...results);
  }
  return scanned;
}

/** 打开文件（定位到顶部；条目文件短小，不定位行）。
 *  D-UI8：打开成功后关闭体检弹窗——全屏弹窗不关会把打开的文件盖在遮罩后面。 */
async function openAtTop(path: string, onOpened: () => void): Promise<void> {
  const app = getApp();
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) return;
  const leaf = app.workspace.getLeaf();
  await leaf.openFile(file as any);
  const view: any = leaf.view;
  if (view && view.editor) {
    view.editor.focus();
    view.editor.setCursor(0, 0);
    view.editor.scrollIntoView({ from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } }, true);
  }
  onOpened();
}

export function openDiaryRepairModal(): void {
  const { mask, popup } = createOverlay({
    maskId: 'bz-diary-repair-mask',
    popupId: 'bz-diary-repair-popup',
    maxWidth: 640,
    onMaskClick: close,
  });

  // 头部（沿用设置弹窗布局：不放关闭按钮，靠遮罩 + ESC）
  const header = document.createElement('div');
  header.className = 'bz-settings-header';
  const title = document.createElement('h3');
  title.className = 'bz-settings-title';
  title.textContent = '日记格式体检';
  header.appendChild(title);

  const content = document.createElement('div');
  content.className = 'bz-settings-content';

  popup.appendChild(header);
  popup.appendChild(content);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');

  const handle = escManager.register('bz-diary-repair', {
    isVisible: () => mask.isConnected,
    close,
  });

  function close(): void {
    mask.remove();
    popup.remove();
    handle.unregister();
  }

  // ===== 进度态 =====
  const progressWrap = document.createElement('div');
  progressWrap.className = 'bz-diary-repair-progress';
  const track = document.createElement('div');
  track.className = 'bz-diary-repair-progress-track';
  const fill = document.createElement('div');
  fill.className = 'bz-diary-repair-progress-fill';
  const ptext = document.createElement('div');
  ptext.className = 'bz-diary-repair-progress-text';
  ptext.textContent = '正在体检日记文件…';
  track.appendChild(fill);
  progressWrap.appendChild(track);
  progressWrap.appendChild(ptext);
  content.appendChild(progressWrap);

  const summarize = (scanned: ScannedFile[]): void => {
    content.innerHTML = '';
    content.appendChild(progressWrap);
    progressWrap.style.display = 'none';

    const items: DiaryLintItem[] = [];
    for (const s of scanned) {
      if (s.reason) items.push({ path: s.path, reason: s.reason, detail: LINT_REASON_TEXT[s.reason] });
    }

    const summary = document.createElement('div');
    summary.className = 'bz-diary-repair-summary';
    summary.textContent =
      items.length === 0
        ? `共体检 ${scanned.length} 个日记文件：全部健康`
        : `共体检 ${scanned.length} 个日记文件：${items.length} 个需要处理（点击条目打开文件手工处理，面板不改写内容）。`;
    content.appendChild(summary);

    // 按原因分组展示（legacy → unparsable → name-mismatch）
    const order: DiaryLintReason[] = ['legacy', 'unparsable', 'name-mismatch'];
    for (const reason of order) {
      const group = items.filter((i) => i.reason === reason);
      if (group.length === 0) continue;
      const sec = document.createElement('div');
      sec.className = 'bz-diary-repair-section-title';
      sec.textContent = `${LINT_REASON_TEXT[reason]}（${group.length}）`;
      content.appendChild(sec);

      for (const item of group) {
        const row = document.createElement('div');
        row.className = 'bz-diary-repair-row';
        const link = document.createElement('span');
        link.className = 'bz-diary-repair-link';
        link.textContent = item.path.split('/').pop() || item.path;
        link.addEventListener('click', () => void openAtTop(item.path, close));
        const snippet = document.createElement('span');
        snippet.className = 'bz-diary-repair-snippet';
        snippet.textContent = item.path;
        row.append(link, snippet);
        content.appendChild(row);
      }
    }

    // 底栏：重新体检（与出错重试态同一构造）
    mountRetryFooter();
  };

  /** 出错后的可重试底栏（D10'）：进度条不死，用户可点「重新体检」重扫 */
  function mountRetryFooter(): void {
    const again = document.createElement('button');
    again.className = 'bz-button';
    again.textContent = '重新体检';
    again.addEventListener('click', () => void startScan());
    const bar = document.createElement('div');
    bar.className = 'bz-diary-repair-footer';
    bar.appendChild(again);
    content.appendChild(bar);
  }

  async function startScan(): Promise<void> {
    progressWrap.style.display = 'block';
    fill.style.width = '0%';
    ptext.textContent = '正在体检日记文件…';
    content.innerHTML = '';
    content.appendChild(progressWrap);
    // D10'：扫描任一文件读抛错不再 unhandled rejection 卡死进度条——回可重试态 + 人话 error 通知
    try {
      const scanned = await runScan(
        () => mask.isConnected,
        (done, total, label) => {
          fill.style.width = `${Math.round((done / total) * 100)}%`;
          ptext.textContent = `正在体检 ${label}（${done}/${total}）…`;
        }
      );
      if (!mask.isConnected) return;
      summarize(scanned);
    } catch (e) {
      if (!mask.isConnected) return;
      const msg = (e as Error)?.message || String(e);
      ptext.textContent = `体检失败：${msg}（可点下方按钮重试）`;
      mountRetryFooter();
      try {
        notify(`日记格式体检失败：${msg}`, { type: 'error' });
      } catch {
        /* 无通知环境（node 测试）静默 */
      }
    }
  }

  void startScan();
}

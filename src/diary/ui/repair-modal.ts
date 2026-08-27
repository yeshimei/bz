/**
 * 日记解析检测面板（ticket 121，ADR-0054）。
 * 手动驱动：仅经日记⚙️设置弹窗「检测日记解析」按钮打开；启动不自动触发（UX-9 toast 已移除）。
 * 打开即逐文件扫描（进度条）→ 汇报两区：
 *  - 可自动修复：头行补空格/时间补零，展示修改前后，确认后一键批量写回（正文归位不改写）；
 *  - 不可自动修复：时间越界标题行/游离正文，点击打开文件并定位到行手工改。
 */
import { createOverlay } from '../../core/dom';
import { escManager } from '../../core/esc-manager';
import { confirm } from '../../core/confirm';
import { notice } from '../../core/notice';
import { getApp } from '../app';
import { DIARY_DIRECTORY } from '../config';
import { scanUnparsed, applyRepairs, type UnparsedScan } from '../repair';

const BATCH_CONCURRENCY = 10;
/** companion 档（z-index 家族表注释：11100+ 为 companion 档，须 > 设置弹窗 10050） */
const Z_INDEX = 11200;

interface ScannedFile {
  file: any;
  path: string;
  scan: UnparsedScan;
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

async function collectDiaryFiles(): Promise<any[]> {
  const app = getApp();
  let dir = app.vault.getAbstractFileByPath(DIARY_DIRECTORY) as any;
  if (!dir || !dir.children) {
    const root = app.vault.getRoot() as any;
    dir = findDirRecursive(root, DIARY_DIRECTORY);
  }
  if (!dir || !dir.children) return [];
  return dir.children
    .filter((f: any) => f.extension === 'md')
    .sort((a: any, b: any) => b.name.localeCompare(a.name));
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
        return { file, path: file.path, scan: scanUnparsed(content) };
      })
    );
    scanned.push(...results);
  }
  return scanned;
}

const REASON_TEXT: Record<string, string> = {
  'time-oob': '时间越界',
  'free-text': '游离正文（条目前）',
};

/** 打开文件并定位到行（memo 域 openLinkedNote 同款：openFile 后取 view.editor setCursor） */
async function openAtLine(path: string, line: number): Promise<void> {
  const app = getApp();
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) {
    notice('日记文件不存在');
    return;
  }
  const leaf = app.workspace.getLeaf();
  await leaf.openFile(file as any);
  const locate = (view: any) => {
    const editor = view && view.editor;
    if (!editor) return false;
    const target = Math.max(0, line - 1);
    editor.focus();
    editor.setCursor(target, 0);
    editor.scrollIntoView({ from: { line: target, ch: 0 }, to: { line: target, ch: 0 } }, true);
    return true;
  };
  if (!locate((leaf as any).view)) {
    // 编辑器尚未就绪兜底
    setTimeout(() => locate((leaf as any).view), 250);
  }
}

export function openDiaryRepairModal(): void {
  const app = getApp();
  const { mask, popup } = createOverlay({
    maskId: 'bz-diary-repair-mask',
    popupId: 'bz-diary-repair-popup',
    zIndex: Z_INDEX,
    maxWidth: 640,
    onMaskClick: close,
  });

  // 头部（沿用设置弹窗布局：不放关闭按钮，靠遮罩 + ESC）
  const header = document.createElement('div');
  header.className = 'bz-settings-header';
  const title = document.createElement('h3');
  title.className = 'bz-settings-title';
  title.textContent = '日记解析检测';
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
  ptext.textContent = '正在解析日记文件…';
  track.appendChild(fill);
  progressWrap.appendChild(track);
  progressWrap.appendChild(ptext);
  content.appendChild(progressWrap);

  const summarize = (scanned: ScannedFile[]): void => {
    content.innerHTML = '';
    content.appendChild(progressWrap);
    progressWrap.style.display = 'none';

    const repairs = scanned.filter((s) => s.scan.repairs.length > 0);
    const freeFiles = scanned.filter((s) => s.scan.freeTexts.length > 0);
    const repairCount = repairs.reduce((n, s) => n + s.scan.repairs.length, 0);
    const freeCount = freeFiles.reduce((n, s) => n + s.scan.freeTexts.length, 0);

    const summary = document.createElement('div');
    summary.className = 'bz-diary-repair-summary';
    if (repairCount === 0 && freeCount === 0) {
      summary.textContent = `共扫描 ${scanned.length} 个日记文件：全部正常解析`;
    } else {
      summary.textContent =
        `共扫描 ${scanned.length} 个日记文件：${repairs.length} 个文件可自动修复（${repairCount} 处），` +
        `${freeFiles.length} 个文件需手动处理（${freeCount} 行）。`;
    }
    content.appendChild(summary);

    // 可自动修复区
    if (repairs.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'bz-diary-repair-section-title';
      const name = document.createElement('span');
      name.textContent = `可自动修复（${repairCount} 处）`;
      const fixBtn = document.createElement('button');
      fixBtn.className = 'bz-button';
      fixBtn.textContent = `一键修复 ${repairCount} 处`;
      fixBtn.addEventListener('click', () => confirmFix(scanned, repairs));
      sec.appendChild(name);
      sec.appendChild(fixBtn);
      content.appendChild(sec);

      for (const f of repairs) {
        const fileBox = document.createElement('div');
        fileBox.className = 'bz-diary-repair-file';
        const head = document.createElement('div');
        head.className = 'bz-diary-repair-file-head';
        head.textContent = f.path;
        fileBox.appendChild(head);
        for (const r of f.scan.repairs) {
          const row = document.createElement('div');
          row.className = 'bz-diary-repair-row';
          row.append(document.createTextNode(`第 ${r.line} 行（${r.kind === 'space' ? '补空格' : '时间补零'}）：`));
          const before = document.createElement('code');
          before.textContent = r.before;
          const arrow = document.createElement('span');
          arrow.textContent = ' → ';
          const after = document.createElement('code');
          after.textContent = r.after;
          row.append(before, arrow, after);
          fileBox.appendChild(row);
        }
        content.appendChild(fileBox);
      }
    }

    // 需手动处理区
    if (freeFiles.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'bz-diary-repair-section-title';
      sec.textContent = `需手动处理（${freeCount} 行）`;
      content.appendChild(sec);

      for (const f of freeFiles) {
        const fileBox = document.createElement('div');
        fileBox.className = 'bz-diary-repair-file';
        const head = document.createElement('div');
        head.className = 'bz-diary-repair-file-head';
        head.textContent = f.path;
        fileBox.appendChild(head);
        for (const ft of f.scan.freeTexts) {
          const row = document.createElement('div');
          row.className = 'bz-diary-repair-row';
          const link = document.createElement('span');
          link.className = 'bz-diary-repair-link';
          link.textContent = `第 ${ft.line} 行（${REASON_TEXT[ft.reason] || ft.reason}）`;
          link.addEventListener('click', () => void openAtLine(f.path, ft.line));
          const snippet = document.createElement('span');
          snippet.className = 'bz-diary-repair-snippet';
          snippet.textContent = ft.text.slice(0, 60) + (ft.text.length > 60 ? '…' : '');
          row.append(link, snippet);
          fileBox.appendChild(row);
        }
        content.appendChild(fileBox);
      }
    }

    // 底栏：重新检测
    const again = document.createElement('button');
    again.className = 'bz-button';
    again.textContent = '重新检测';
    again.addEventListener('click', () => void startScan());
    const bar = document.createElement('div');
    bar.className = 'bz-diary-repair-footer';
    bar.appendChild(again);
    content.appendChild(bar);
  };

  const confirmFix = (scanned: ScannedFile[], repairs: ScannedFile[]): void => {
    const count = repairs.reduce((n, s) => n + s.scan.repairs.length, 0);
    confirm({
      title: '修复日记标题格式',
      message:
        `将修改 ${repairs.length} 个日记文件中的 ${count} 处标题行：` +
        `补空格/时间补零使其符合「# emoji HH:mm」格式，正文内容不变。` +
        `修改不可撤销，可通过 Obsidian 文件历史恢复。`,
      confirmText: '修复',
      onConfirm: () => void runFix(scanned, repairs),
    });
  };

  const runFix = async (scanned: ScannedFile[], repairs: ScannedFile[]): Promise<void> => {
    let fixed = 0;
    let failed = 0;
    for (const f of repairs) {
      try {
        const content = await app.vault.read(f.file);
        const next = applyRepairs(content, f.scan.repairs);
        if (next !== content) {
          await app.vault.modify(f.file, next);
          fixed += f.scan.repairs.length;
        }
      } catch (e) {
        failed += f.scan.repairs.length;
        console.warn('[diary] 修复失败', f.path, e);
      }
    }
    if (failed === 0) {
      notice(`已修复 ${fixed} 处未解析行`, 'success');
    } else {
      notice(`修复 ${fixed} 处成功、${failed} 处失败`, 'warning');
    }
    await startScan();
  };

  async function startScan(): Promise<void> {
    progressWrap.style.display = 'block';
    fill.style.width = '0%';
    content.innerHTML = '';
    content.appendChild(progressWrap);
    const scanned = await runScan(
      () => mask.isConnected,
      (done, total, label) => {
        fill.style.width = `${Math.round((done / total) * 100)}%`;
        ptext.textContent = `正在解析 ${label}（${done}/${total}）…`;
      }
    );
    if (!mask.isConnected) return;
    summarize(scanned);
  }

  void startScan();
}